// Claude Context Pill - calibrator
// OPT-IN ONLY. Requires user API key. Sends visible conversation text to
// Anthropic's count_tokens endpoint to derive a multiplicative correction
// factor for the local tokenizer. No data is stored remotely.
//
// Architectural note: we do not store API keys in plaintext logs, we do not
// transmit message content anywhere besides the official Anthropic endpoint,
// and we only call out when the user has explicitly opted in and granted the
// optional host permission for api.anthropic.com.

(() => {
  'use strict';

  const ENDPOINT = 'https://api.anthropic.com/v1/messages/count_tokens';
  const MODEL = 'claude-opus-4-7';
  const ANTHROPIC_VERSION = '2023-06-01';
  const STORAGE_KEY = 'ccp_calibration_v1';

  const DEFAULT_STATE = {
    correctionFactor: 1.0, // multiplier on local token counts
    samples: 0,
    lastCalibratedAt: null,
    rollingError: 0,
    consecutiveFailures: 0
  };

  function loadState() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(STORAGE_KEY, (data) => {
          resolve({ ...DEFAULT_STATE, ...(data?.[STORAGE_KEY] || {}) });
        });
      } catch {
        resolve({ ...DEFAULT_STATE });
      }
    });
  }

  function saveState(state) {
    try {
      chrome.storage.local.set({ [STORAGE_KEY]: state });
    } catch { /* noop */ }
  }

  async function countTokensRemote(apiKey, text) {
    if (!apiKey || !text) return null;
    const body = {
      model: MODEL,
      messages: [{ role: 'user', content: text }]
    };
    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(body)
      });
    } catch (e) {
      return { error: 'network', detail: String(e?.message || e) };
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { error: 'http_' + res.status, detail: errText.slice(0, 200) };
    }
    let json;
    try { json = await res.json(); } catch { return { error: 'parse' }; }
    const count = json?.input_tokens ?? json?.usage?.input_tokens;
    if (typeof count !== 'number') return { error: 'shape' };
    return { count };
  }

  // Run one calibration round. Returns updated state or error info.
  async function runRound({ apiKey, localCount, text }) {
    const state = await loadState();
    if (!apiKey) return { state, error: 'no_api_key' };
    if (!text || localCount <= 0) return { state, error: 'empty_input' };

    const remote = await countTokensRemote(apiKey, text);
    if (remote?.error) {
      state.consecutiveFailures = (state.consecutiveFailures || 0) + 1;
      saveState(state);
      return { state, error: remote.error, detail: remote.detail };
    }

    const ratio = remote.count / localCount;
    // Clamp the ratio to a sane range so a corrupted call cannot poison state
    const clamped = Math.max(0.5, Math.min(2.0, ratio));

    const n = state.samples + 1;
    // Exponential moving average, weighted toward recent samples.
    const alpha = Math.min(0.3, 1 / Math.max(n, 1));
    const newFactor = state.correctionFactor * (1 - alpha) + clamped * alpha;

    const newState = {
      ...state,
      correctionFactor: Number(newFactor.toFixed(4)),
      samples: n,
      lastCalibratedAt: Date.now(),
      rollingError: Number((Math.abs(clamped - 1) * 100).toFixed(2)),
      consecutiveFailures: 0
    };
    saveState(newState);
    return { state: newState };
  }

  function reset() {
    saveState({ ...DEFAULT_STATE });
  }

  window.__ccp_calibrator = {
    loadState,
    runRound,
    reset,
    ENDPOINT,
    MODEL
  };
})();
