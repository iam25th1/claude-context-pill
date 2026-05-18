// Claude Context Pill - popup v1.1
'use strict';

const SETTINGS_KEY = 'ccp_settings_v1';
const CAL_KEY = 'ccp_calibration_v1';

const DEFAULTS = {
  enabled: true,
  showRaw: false,
  overheadMode: 'auto',
  manualOverhead: 40_000,
  memoryActive: false,
  calibration: {
    enabled: false,
    apiKey: null,
    intervalMessages: 10
  }
};

const CAL_DEFAULTS = {
  correctionFactor: 1.0,
  samples: 0,
  lastCalibratedAt: null,
  rollingError: 0,
  consecutiveFailures: 0
};

// ---- helpers ----

const $ = (id) => document.getElementById(id);

function get(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (data) => resolve(data?.[key]));
  });
}

function set(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

function flash(el, msg, isError = false) {
  el.textContent = msg;
  el.classList.toggle('error', !!isError);
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1600);
}

function clampOverhead(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > 200_000) return 200_000;
  return Math.floor(n);
}

function clampInterval(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return 1;
  if (n > 100) return 100;
  return Math.floor(n);
}

function fmtAgo(ts) {
  if (!ts) return 'never';
  const d = Date.now() - ts;
  if (d < 60_000) return `${Math.floor(d / 1000)}s ago`;
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return `${Math.floor(d / 86_400_000)}d ago`;
}

// ---- tab switching ----

const tabs = {
  main: { btn: $('tab-main'), panel: $('panel-main') },
  cal:  { btn: $('tab-cal'),  panel: $('panel-cal') }
};

function showTab(name) {
  for (const [k, { btn, panel }] of Object.entries(tabs)) {
    const active = k === name;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
    panel.hidden = !active;
  }
}

tabs.main.btn.addEventListener('click', () => showTab('main'));
tabs.cal.btn.addEventListener('click', () => showTab('cal'));

// ---- main panel ----

let settings = structuredClone(DEFAULTS);

async function loadMain() {
  const stored = (await get(SETTINGS_KEY)) || {};
  settings = {
    ...DEFAULTS,
    ...stored,
    calibration: { ...DEFAULTS.calibration, ...(stored.calibration || {}) }
  };
  $('enabled').checked = !!settings.enabled;
  $('manual-overhead').value = clampOverhead(settings.manualOverhead);
  $('memory-active').checked = !!settings.memoryActive;
  paintMode(settings.overheadMode);
}

function paintMode(mode) {
  for (const b of document.querySelectorAll('.seg-btn')) {
    const active = b.dataset.val === mode;
    b.classList.toggle('active', active);
    b.setAttribute('aria-checked', String(active));
  }
  $('manual-overhead-row').hidden = mode !== 'manual';
  $('memory-row').hidden = mode !== 'auto';
  $('mode-hint').textContent = mode === 'auto'
    ? 'auto: detects project mode, files, searches, and artifacts and estimates overhead from those signals. recommended.'
    : 'manual: use the value below as a fixed overhead. ignores feature detection.';
}

for (const b of document.querySelectorAll('.seg-btn')) {
  b.addEventListener('click', () => {
    settings.overheadMode = b.dataset.val;
    paintMode(settings.overheadMode);
  });
}

$('save-main').addEventListener('click', async () => {
  const next = {
    ...settings,
    enabled: !!$('enabled').checked,
    manualOverhead: clampOverhead($('manual-overhead').value),
    memoryActive: !!$('memory-active').checked
  };
  await set(SETTINGS_KEY, next);
  settings = next;
  flash($('status-main'), 'saved');
});

$('reset-main').addEventListener('click', async () => {
  const reset = {
    ...DEFAULTS,
    calibration: settings.calibration // keep calibration state on main reset
  };
  await set(SETTINGS_KEY, reset);
  settings = reset;
  await loadMain();
  flash($('status-main'), 'reset');
});

// ---- calibration panel ----

async function loadCal() {
  const stored = (await get(SETTINGS_KEY)) || {};
  const cal = { ...DEFAULTS.calibration, ...(stored.calibration || {}) };
  $('cal-enabled').checked = !!cal.enabled;
  $('cal-key').value = cal.apiKey || '';
  $('cal-interval').value = clampInterval(cal.intervalMessages || 10);
  await refreshCalStats();
}

async function refreshCalStats() {
  const state = { ...CAL_DEFAULTS, ...((await get(CAL_KEY)) || {}) };
  $('stat-samples').textContent = String(state.samples);
  $('stat-factor').textContent = (state.correctionFactor || 1).toFixed(3) + 'x';
  $('stat-last').textContent = fmtAgo(state.lastCalibratedAt);
  $('stat-error').textContent = state.consecutiveFailures > 0
    ? `${state.consecutiveFailures} fail${state.consecutiveFailures === 1 ? '' : 's'}`
    : 'none';
}

async function requestPermission() {
  return new Promise((resolve) => {
    try {
      chrome.permissions.request(
        { origins: ['https://api.anthropic.com/*'] },
        (granted) => resolve(!!granted)
      );
    } catch { resolve(false); }
  });
}

async function dropPermission() {
  return new Promise((resolve) => {
    try {
      chrome.permissions.remove(
        { origins: ['https://api.anthropic.com/*'] },
        (removed) => resolve(!!removed)
      );
    } catch { resolve(false); }
  });
}

$('cal-key-show').addEventListener('click', () => {
  const input = $('cal-key');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  $('cal-key-show').textContent = showing ? 'show' : 'hide';
});

$('save-cal').addEventListener('click', async () => {
  const cal = {
    enabled: !!$('cal-enabled').checked,
    apiKey: $('cal-key').value.trim() || null,
    intervalMessages: clampInterval($('cal-interval').value)
  };
  if (cal.enabled) {
    if (!cal.apiKey) {
      flash($('status-cal'), 'api key required', true);
      $('cal-enabled').checked = false;
      return;
    }
    // request permission only when we don't already have it
    const granted = await requestPermission();
    if (!granted) {
      flash($('status-cal'), 'permission denied', true);
      $('cal-enabled').checked = false;
      return;
    }
  } else {
    // optional: drop the permission when calibration is turned off
    await dropPermission();
  }
  const stored = (await get(SETTINGS_KEY)) || {};
  const next = {
    ...DEFAULTS,
    ...stored,
    calibration: cal
  };
  await set(SETTINGS_KEY, next);
  flash($('status-cal'), 'saved');
});

$('reset-cal').addEventListener('click', async () => {
  await set(CAL_KEY, { ...CAL_DEFAULTS });
  await refreshCalStats();
  flash($('status-cal'), 'calibration history cleared');
});

// Live update stats while popup is open
let statsTimer = null;
function startStatsPolling() {
  if (statsTimer) clearInterval(statsTimer);
  statsTimer = setInterval(refreshCalStats, 3000);
}
function stopStatsPolling() {
  if (statsTimer) clearInterval(statsTimer);
  statsTimer = null;
}
window.addEventListener('unload', stopStatsPolling);

// ---- boot ----

document.addEventListener('DOMContentLoaded', async () => {
  await loadMain();
  await loadCal();
  startStatsPolling();
});
