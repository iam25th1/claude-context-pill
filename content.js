// Claude Context Pill - content script v1.1
// Uses window.__ccp_tokenizer (cl100k BPE), window.__ccp_overhead (smart
// feature detection), and window.__ccp_calibrator (opt-in API calibration).
// All three are set up by sibling content scripts loaded before this one.

(() => {
  'use strict';

  const CONFIG = {
    maxTokens: 1_000_000,
    fallbackCharsPerToken: 3.8,
    fallbackCodeCharsPerToken: 3.2,
    debounceMs: 350,
    routeCheckMs: 1000,
    thresholds: { warn: 0.60, danger: 0.85 },
    settingsKey: 'ccp_settings_v1',
    calibrationCooldownMs: 60_000 // never run remote calibration more than once a minute
  };

  const MESSAGE_SELECTORS = [
    '[data-testid="user-message"]',
    '[data-testid="assistant-message"]',
    '[data-testid="message"]',
    '.font-user-message',
    '.font-claude-message',
    'div[class*="message-content"]'
  ];

  // Composer container selectors, in priority order. We use the outer
  // box (the rounded container with input + buttons), not just the
  // contenteditable inside it, so the pill aligns to the visual edge.
  const COMPOSER_BOX_SELECTORS = [
    'fieldset:has(div[contenteditable="true"])',
    'div[class*="composer"]:has(div[contenteditable="true"])',
    'form:has(div[contenteditable="true"])'
  ];
  const COMPOSER_INPUT_SELECTORS = [
    'div[contenteditable="true"].ProseMirror',
    'div[contenteditable="true"]',
    'div[role="textbox"]'
  ];

  // -------- settings (migrated from v1.0 shape) --------

  const DEFAULT_SETTINGS = {
    enabled: true,
    showRaw: false,
    overheadMode: 'auto',     // 'auto' | 'manual'
    manualOverhead: 40_000,
    memoryActive: false,
    calibration: {
      enabled: false,
      apiKey: null,
      intervalMessages: 10
    }
  };

  let settings = structuredClone(DEFAULT_SETTINGS);
  let pillEl = null;
  let lastValue = -1;
  let observer = null;
  let lastPath = location.pathname;
  let debounceTimer = null;
  let lastCalibrationAt = 0;
  let composerObserver = null;
  let watchedComposer = null;
  let messagesSinceCalibration = 0;
  let lastVisibleText = '';

  // -------- token estimation --------

  function fallbackCount(text) {
    if (!text) return 0;
    let total = 0;
    const codeFenceRegex = /```[\s\S]*?```|`[^`\n]+`/g;
    let lastIdx = 0;
    let match;
    while ((match = codeFenceRegex.exec(text)) !== null) {
      total += Math.ceil(text.slice(lastIdx, match.index).length / CONFIG.fallbackCharsPerToken);
      total += Math.ceil(match[0].length / CONFIG.fallbackCodeCharsPerToken);
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < text.length) {
      total += Math.ceil(text.slice(lastIdx).length / CONFIG.fallbackCharsPerToken);
    }
    return total;
  }

  function countTokens(text) {
    const t = window.__ccp_tokenizer;
    if (t && t.ready) {
      try { return t.count(text); }
      catch { return fallbackCount(text); }
    }
    return fallbackCount(text);
  }

  function gatherConversationText() {
    const seen = new Set();
    let combined = '';
    for (const sel of MESSAGE_SELECTORS) {
      let nodes;
      try { nodes = document.querySelectorAll(sel); }
      catch { continue; }
      for (const node of nodes) {
        if (seen.has(node)) continue;
        let skip = false;
        for (const s of seen) {
          if (s.contains(node)) { skip = true; break; }
        }
        if (skip) continue;
        seen.add(node);
        combined += '\n' + (node.innerText || node.textContent || '');
      }
      if (seen.size > 0) break;
    }
    return combined;
  }

  function getOverhead() {
    if (settings.overheadMode === 'manual') {
      return {
        total: Math.max(0, settings.manualOverhead | 0),
        detected: { mode: 'manual' },
        weights: null
      };
    }
    const detector = window.__ccp_overhead;
    if (!detector) {
      return { total: settings.manualOverhead, detected: { mode: 'fallback' }, weights: null };
    }
    return detector.compute(undefined, { memoryActive: settings.memoryActive });
  }

  async function getCorrectionFactor() {
    const cal = window.__ccp_calibrator;
    if (!cal) return 1.0;
    try {
      const state = await cal.loadState();
      const f = state?.correctionFactor;
      if (typeof f === 'number' && f > 0.5 && f < 2.0) return f;
    } catch { /* noop */ }
    return 1.0;
  }

  // -------- pill DOM --------

  function ensurePill() {
    if (pillEl && document.body.contains(pillEl)) return pillEl;
    pillEl = document.createElement('div');
    pillEl.id = 'ccp-pill';
    pillEl.setAttribute('role', 'status');
    pillEl.setAttribute('aria-live', 'polite');
    pillEl.innerHTML = `
      <span class="ccp-dot"></span>
      <span class="ccp-count">~0 / 1M</span>
      <span class="ccp-pct">0%</span>
    `;
    pillEl.title = 'Click to toggle raw / compact view';
    pillEl.addEventListener('click', () => {
      settings.showRaw = !settings.showRaw;
      saveSettings();
      render(true);
    });
    document.body.appendChild(pillEl);
    return pillEl;
  }

  // -------- composer-relative positioning --------

  function findComposerBox() {
    // Try outer box selectors first
    for (const sel of COMPOSER_BOX_SELECTORS) {
      let el;
      try { el = document.querySelector(sel); } catch { continue; }
      if (el && el.getBoundingClientRect().width > 100) return el;
    }
    // Fallback: walk up from the contenteditable to find a stable box
    for (const sel of COMPOSER_INPUT_SELECTORS) {
      let input;
      try { input = document.querySelector(sel); } catch { continue; }
      if (!input) continue;
      // Walk up until we hit something that looks like the composer container
      let node = input;
      for (let i = 0; i < 6 && node && node !== document.body; i++) {
        const r = node.getBoundingClientRect();
        if (r.width > 200 && r.height > 30) return node;
        node = node.parentElement;
      }
      return input;
    }
    return null;
  }

  function positionPill() {
    if (!pillEl) return;
    const box = findComposerBox();
    if (!box) {
      // Fallback: bottom-left, away from corner
      pillEl.style.left = '20px';
      pillEl.style.bottom = '96px';
      return;
    }
    const rect = box.getBoundingClientRect();
    const GAP_ABOVE = 8;   // px gap between pill bottom and composer top
    const PILL_HEIGHT_GUESS = 30;
    const bottom = Math.max(8, window.innerHeight - rect.top + GAP_ABOVE);
    const left = Math.max(8, rect.left);
    pillEl.style.left = `${Math.round(left)}px`;
    pillEl.style.bottom = `${Math.round(bottom)}px`;
    // If the pill would sit off-screen above, drop it inside the composer top instead
    if (rect.top - GAP_ABOVE - PILL_HEIGHT_GUESS < 8) {
      pillEl.style.bottom = `${Math.round(window.innerHeight - rect.top - PILL_HEIGHT_GUESS - GAP_ABOVE)}px`;
    }
    // Track this composer for size changes if it changed
    if (box !== watchedComposer) {
      watchedComposer = box;
      if (composerObserver) composerObserver.disconnect();
      try {
        composerObserver = new ResizeObserver(() => positionPill());
        composerObserver.observe(box);
      } catch { /* ResizeObserver unsupported, fall through to scroll/resize hooks */ }
    }
  }

  function fmtTokens(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(n >= 100_000 ? 0 : 1) + 'k';
    return String(n);
  }

  function statusFor(ratio) {
    if (ratio >= CONFIG.thresholds.danger) return 'danger';
    if (ratio >= CONFIG.thresholds.warn) return 'warn';
    return 'ok';
  }

  async function render(force = false) {
    if (!settings.enabled) {
      if (pillEl) pillEl.style.display = 'none';
      return;
    }
    const pill = ensurePill();
    pill.style.display = '';
    positionPill();

    const text = gatherConversationText();
    const rawVisible = countTokens(text);
    const factor = await getCorrectionFactor();
    const visible = Math.round(rawVisible * factor);
    const overhead = getOverhead();
    const total = visible + overhead.total;
    const ratio = total / CONFIG.maxTokens;

    if (!force && total === lastValue) {
      maybeScheduleCalibration(text, rawVisible);
      return;
    }
    lastValue = total;

    pill.dataset.status = statusFor(ratio);
    pill.querySelector('.ccp-count').textContent = settings.showRaw
      ? total.toLocaleString() + ' / 1,000,000'
      : '~' + fmtTokens(total) + ' / 1M';
    pill.querySelector('.ccp-pct').textContent = (ratio * 100).toFixed(ratio < 0.1 ? 2 : 1) + '%';

    const overheadDesc = window.__ccp_overhead && overhead.weights
      ? window.__ccp_overhead.describe(overhead)
      : `${overhead.total.toLocaleString()} (manual)`;
    pill.title =
      'estimated context usage\n' +
      `visible: ~${visible.toLocaleString()} tokens` +
      (factor !== 1.0 ? ` (cal x${factor.toFixed(3)})` : '') + '\n' +
      `overhead: ${overhead.total.toLocaleString()} tokens\n` +
      (overhead.detected.mode !== 'manual' ? `  ${overheadDesc}\n` : '') +
      `total: ${total.toLocaleString()} / 1,000,000\n` +
      'click to toggle raw view. settings in popup.';

    maybeScheduleCalibration(text, rawVisible);
  }

  // -------- calibration scheduling --------

  function maybeScheduleCalibration(text, localCount) {
    if (!settings.calibration?.enabled) return;
    if (!settings.calibration?.apiKey) return;
    if (text === lastVisibleText) return;
    lastVisibleText = text;
    messagesSinceCalibration++;
    const interval = Math.max(1, settings.calibration.intervalMessages | 0);
    if (messagesSinceCalibration < interval) return;
    const now = Date.now();
    if (now - lastCalibrationAt < CONFIG.calibrationCooldownMs) return;
    lastCalibrationAt = now;
    messagesSinceCalibration = 0;
    // Fire and forget. Errors recorded in state by the calibrator.
    window.__ccp_calibrator?.runRound({
      apiKey: settings.calibration.apiKey,
      localCount,
      text
    }).then((r) => {
      if (r && !r.error) render(true); // re-render once factor updates
    }).catch(() => { /* noop */ });
  }

  // -------- observation --------

  function scheduleRender() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => render(false), CONFIG.debounceMs);
  }

  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes.length || m.removedNodes.length || m.type === 'characterData') {
          scheduleRender();
          return;
        }
      }
    });
    observer.observe(document.body, {
      childList: true, subtree: true, characterData: true
    });
  }

  function watchRouteChanges() {
    setInterval(() => {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        lastValue = -1;
        lastVisibleText = '';
        messagesSinceCalibration = 0;
        scheduleRender();
      }
    }, CONFIG.routeCheckMs);
  }

  // -------- settings persistence + migration --------

  function loadSettings() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(CONFIG.settingsKey, (data) => {
          const stored = (data && data[CONFIG.settingsKey]) || {};
          // migrate v1.0 shape -> v1.1
          if (typeof stored.overhead === 'number' && !('overheadMode' in stored)) {
            stored.manualOverhead = stored.overhead;
            stored.overheadMode = 'manual';
            delete stored.overhead;
          }
          settings = {
            ...DEFAULT_SETTINGS,
            ...stored,
            calibration: { ...DEFAULT_SETTINGS.calibration, ...(stored.calibration || {}) }
          };
          // persist migration
          if (stored.manualOverhead !== undefined && stored.overheadMode === 'manual') {
            try { chrome.storage.local.set({ [CONFIG.settingsKey]: settings }); } catch { /* noop */ }
          }
          resolve();
        });
      } catch { resolve(); }
    });
  }

  function saveSettings() {
    try { chrome.storage.local.set({ [CONFIG.settingsKey]: settings }); }
    catch { /* noop */ }
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes[CONFIG.settingsKey]) {
        const next = changes[CONFIG.settingsKey].newValue;
        if (next && typeof next === 'object') {
          settings = {
            ...DEFAULT_SETTINGS,
            ...next,
            calibration: { ...DEFAULT_SETTINGS.calibration, ...(next.calibration || {}) }
          };
          render(true);
        }
      }
      // re-render if calibration state changed (correction factor updated)
      if (changes.ccp_calibration_v1) render(true);
    });
  } catch { /* noop */ }

  // -------- boot --------

  function whenTokenizerReady() {
    return new Promise((resolve) => {
      if (window.__ccp_tokenizer?.ready) return resolve();
      const onReady = () => resolve();
      window.addEventListener('ccp:tokenizer-ready', onReady, { once: true });
      // safety timeout: don't block the pill forever
      setTimeout(resolve, 2000);
    });
  }

  async function init() {
    await loadSettings();
    ensurePill();
    positionPill();
    render(true); // immediate render with fallback tokenizer
    await whenTokenizerReady();
    render(true); // re-render once real tokenizer is online
    startObserver();
    watchRouteChanges();
    setInterval(() => render(false), 5000);

    // Reposition on viewport changes. Debounce so rapid resizes don't thrash.
    let repositionTimer = null;
    const debouncedReposition = () => {
      if (repositionTimer) clearTimeout(repositionTimer);
      repositionTimer = setTimeout(() => positionPill(), 60);
    };
    window.addEventListener('resize', debouncedReposition, { passive: true });
    // Some layouts shift on sidebar toggle without a resize event;
    // a low-rate poll catches edge cases for a tiny cost.
    setInterval(positionPill, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
