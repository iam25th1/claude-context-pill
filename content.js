// Claude Context Pill
// Client-side token usage estimate for the current claude.ai conversation.
// Runs only on claude.ai. No network calls. No data storage of message content.

(() => {
  'use strict';

  const CONFIG = {
    maxTokens: 1_000_000,
    overheadDefault: 40_000,
    charsPerToken: 3.8,
    codeCharsPerToken: 3.2,
    debounceMs: 350,
    routeCheckMs: 1000,
    thresholds: { warn: 0.60, danger: 0.85 },
    storageKey: 'ccp_settings_v1'
  };

  // Multiple selectors for resilience against claude.ai DOM changes.
  // Order: most specific first, generic fallbacks last.
  const MESSAGE_SELECTORS = [
    '[data-testid="user-message"]',
    '[data-testid="assistant-message"]',
    '[data-testid="message"]',
    '.font-user-message',
    '.font-claude-message',
    'div[class*="message-content"]'
  ];

  const COMPOSER_SELECTORS = [
    'fieldset:has(div[contenteditable="true"])',
    'div[contenteditable="true"].ProseMirror',
    'div[contenteditable="true"]',
    'div[role="textbox"]'
  ];

  // Settings persisted via chrome.storage.local
  let settings = {
    overhead: CONFIG.overheadDefault,
    enabled: true,
    showRaw: false
  };

  let pillEl = null;
  let lastValue = -1;
  let observer = null;
  let lastPath = location.pathname;
  let debounceTimer = null;

  // -------- token estimation --------

  // Char-based heuristic. Directional, not exact.
  // Splits code blocks out and weights them denser.
  function estimateTokens(text) {
    if (!text) return 0;
    let total = 0;
    const codeFenceRegex = /```[\s\S]*?```|`[^`\n]+`/g;
    let lastIdx = 0;
    let match;
    while ((match = codeFenceRegex.exec(text)) !== null) {
      const prose = text.slice(lastIdx, match.index);
      total += Math.ceil(prose.length / CONFIG.charsPerToken);
      total += Math.ceil(match[0].length / CONFIG.codeCharsPerToken);
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < text.length) {
      total += Math.ceil(text.slice(lastIdx).length / CONFIG.charsPerToken);
    }
    return total;
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
        // Skip if a parent we already counted contains this node
        let skip = false;
        for (const s of seen) {
          if (s.contains(node)) { skip = true; break; }
        }
        if (skip) continue;
        seen.add(node);
        combined += '\n' + (node.innerText || node.textContent || '');
      }
      if (seen.size > 0) break; // first selector that matched wins
    }
    return combined;
  }

  function computeUsage() {
    const text = gatherConversationText();
    const visibleTokens = estimateTokens(text);
    const total = visibleTokens + settings.overhead;
    return { visibleTokens, total, ratio: total / CONFIG.maxTokens };
  }

  // -------- formatting --------

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
    pillEl.title = 'Estimated context usage. Click to toggle raw / compact.';
    pillEl.addEventListener('click', () => {
      settings.showRaw = !settings.showRaw;
      saveSettings();
      render(true);
    });
    document.body.appendChild(pillEl);
    return pillEl;
  }

  function render(force = false) {
    if (!settings.enabled) {
      if (pillEl) pillEl.style.display = 'none';
      return;
    }
    const pill = ensurePill();
    pill.style.display = '';
    const { total, ratio, visibleTokens } = computeUsage();
    if (!force && total === lastValue) return;
    lastValue = total;

    const status = statusFor(ratio);
    pill.dataset.status = status;

    const countEl = pill.querySelector('.ccp-count');
    const pctEl = pill.querySelector('.ccp-pct');
    if (settings.showRaw) {
      countEl.textContent = total.toLocaleString() + ' / 1,000,000';
    } else {
      countEl.textContent = '~' + fmtTokens(total) + ' / 1M';
    }
    pctEl.textContent = (ratio * 100).toFixed(ratio < 0.1 ? 2 : 1) + '%';

    pill.title =
      'Estimated context usage\n' +
      'visible messages: ~' + visibleTokens.toLocaleString() + ' tokens\n' +
      'hidden overhead offset: ' + settings.overhead.toLocaleString() + ' tokens\n' +
      'total: ' + total.toLocaleString() + ' / 1,000,000\n' +
      'click pill to toggle raw view. Adjust overhead in the extension popup.';
  }

  // -------- observation --------

  function scheduleRender() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => render(false), CONFIG.debounceMs);
  }

  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver((mutations) => {
      // Cheap filter: only re-render if added/removed nodes look meaningful
      for (const m of mutations) {
        if (m.addedNodes.length || m.removedNodes.length || m.type === 'characterData') {
          scheduleRender();
          return;
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function watchRouteChanges() {
    setInterval(() => {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        lastValue = -1;
        scheduleRender();
      }
    }, CONFIG.routeCheckMs);
  }

  // -------- settings --------

  function loadSettings() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(CONFIG.storageKey, (data) => {
          const stored = data && data[CONFIG.storageKey];
          if (stored && typeof stored === 'object') {
            settings = { ...settings, ...stored };
          }
          resolve();
        });
      } catch {
        resolve();
      }
    });
  }

  function saveSettings() {
    try {
      chrome.storage.local.set({ [CONFIG.storageKey]: settings });
    } catch { /* noop */ }
  }

  // Respond to popup changes
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[CONFIG.storageKey]) return;
      const next = changes[CONFIG.storageKey].newValue;
      if (next && typeof next === 'object') {
        settings = { ...settings, ...next };
        render(true);
      }
    });
  } catch { /* noop */ }

  // -------- boot --------

  async function init() {
    await loadSettings();
    ensurePill();
    render(true);
    startObserver();
    watchRouteChanges();
    // Periodic safety re-render in case the observer misses something
    setInterval(() => render(false), 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
