// Claude Context Pill - popup
'use strict';

const STORAGE_KEY = 'ccp_settings_v1';
const DEFAULTS = { overhead: 40_000, enabled: true, showRaw: false };

const $enabled = document.getElementById('enabled');
const $overhead = document.getElementById('overhead');
const $save = document.getElementById('save');
const $reset = document.getElementById('reset');

let statusEl = document.createElement('div');
statusEl.id = 'status-msg';
document.querySelector('.btns').after(statusEl);

function clampOverhead(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > 200000) return 200000;
  return Math.floor(n);
}

function load() {
  chrome.storage.local.get(STORAGE_KEY, (data) => {
    const s = (data && data[STORAGE_KEY]) || {};
    const merged = { ...DEFAULTS, ...s };
    $enabled.checked = !!merged.enabled;
    $overhead.value = clampOverhead(merged.overhead);
  });
}

function flash(msg) {
  statusEl.textContent = msg;
  statusEl.classList.add('show');
  setTimeout(() => statusEl.classList.remove('show'), 1400);
}

$save.addEventListener('click', () => {
  const next = {
    enabled: !!$enabled.checked,
    overhead: clampOverhead($overhead.value),
    // preserve showRaw set via pill click
  };
  chrome.storage.local.get(STORAGE_KEY, (data) => {
    const prev = (data && data[STORAGE_KEY]) || {};
    chrome.storage.local.set(
      { [STORAGE_KEY]: { ...DEFAULTS, ...prev, ...next } },
      () => flash('saved')
    );
  });
});

$reset.addEventListener('click', () => {
  chrome.storage.local.set({ [STORAGE_KEY]: { ...DEFAULTS } }, () => {
    load();
    flash('reset');
  });
});

document.addEventListener('DOMContentLoaded', load);
