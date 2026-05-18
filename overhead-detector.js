// Claude Context Pill - overhead detector
// Replaces the fixed 40k overhead with a feature-based estimate.
// Detects features from URL/DOM and sums per-feature overhead.
// All numbers are conservative defaults, refined by calibrator if enabled.

(() => {
  'use strict';

  // Default per-feature overhead estimates (tokens).
  // These are starting points based on observed behavior, refined per-user
  // via the calibrator's feedback loop if opt-in calibration is enabled.
  const DEFAULTS = {
    base: 18_000,         // baseline system prompt for a vanilla chat
    project: 22_000,      // additional weight for project-mode chats
    perFile: 4_500,       // per attached file in conversation
    perSearch: 6_500,     // per web search performed (results in context)
    perArtifact: 3_000,   // per artifact in conversation
    perThinking: 1_500,   // per visible thinking block (rare)
    memory: 12_000        // user-memory feature contribution (best guess)
  };

  // Heuristic detectors. Each returns a count or boolean from DOM/URL.
  const detect = {
    isProject() {
      return /\/project\//.test(location.pathname) ||
        !!document.querySelector('[data-testid*="project"], a[href*="/project/"][aria-current]');
    },
    fileCount() {
      // file chips in messages or composer
      const sels = [
        '[data-testid*="file"]',
        '[data-testid*="attachment"]',
        '[aria-label*="attachment"]',
        '[class*="file-chip"]',
        '[class*="attachment-card"]'
      ];
      const found = new Set();
      for (const s of sels) {
        try { document.querySelectorAll(s).forEach((n) => found.add(n)); }
        catch { /* invalid selector under :has support, skip */ }
      }
      return found.size;
    },
    searchCount() {
      // Look for search-result indicators
      const sels = [
        '[data-testid*="search-result"]',
        '[class*="search-result"]',
        'cite[index]', // claude citation tags in rendered output
      ];
      let n = 0;
      for (const s of sels) {
        try { n += document.querySelectorAll(s).length; } catch { /* noop */ }
      }
      // Cap so a heavily cited single response doesn't blow up the estimate
      return Math.min(n > 0 ? 1 : 0, 5);
    },
    artifactCount() {
      const sels = [
        '[data-testid*="artifact"]',
        '[class*="artifact-"]',
        '[aria-label*="artifact" i]'
      ];
      const found = new Set();
      for (const s of sels) {
        try { document.querySelectorAll(s).forEach((n) => found.add(n)); }
        catch { /* noop */ }
      }
      // Heuristic: distinct artifact containers, capped
      return Math.min(found.size, 8);
    },
    thinkingCount() {
      const sels = [
        '[data-testid*="thinking"]',
        '[aria-label*="thinking" i]',
        '[class*="thinking-block"]'
      ];
      let n = 0;
      for (const s of sels) {
        try { n += document.querySelectorAll(s).length; } catch { /* noop */ }
      }
      return n;
    },
    memoryActive() {
      // Hard to detect reliably from a single page.
      // Surface a manual toggle in settings instead. Default off.
      return false;
    }
  };

  function computeOverhead(weights = DEFAULTS, opts = {}) {
    const detected = {
      project: detect.isProject(),
      files: detect.fileCount(),
      searches: detect.searchCount(),
      artifacts: detect.artifactCount(),
      thinking: detect.thinkingCount(),
      memory: opts.memoryActive === true
    };

    let total = weights.base || DEFAULTS.base;
    if (detected.project) total += weights.project || DEFAULTS.project;
    total += detected.files * (weights.perFile || DEFAULTS.perFile);
    total += detected.searches * (weights.perSearch || DEFAULTS.perSearch);
    total += detected.artifacts * (weights.perArtifact || DEFAULTS.perArtifact);
    total += detected.thinking * (weights.perThinking || DEFAULTS.perThinking);
    if (detected.memory) total += weights.memory || DEFAULTS.memory;

    return { total, detected, weights: { ...DEFAULTS, ...weights } };
  }

  function describe(result) {
    const d = result.detected;
    const parts = [];
    parts.push('baseline: ' + result.weights.base.toLocaleString());
    if (d.project) parts.push('project: +' + result.weights.project.toLocaleString());
    if (d.files) parts.push(`${d.files} file${d.files === 1 ? '' : 's'}: +${(d.files * result.weights.perFile).toLocaleString()}`);
    if (d.searches) parts.push(`searches: +${(d.searches * result.weights.perSearch).toLocaleString()}`);
    if (d.artifacts) parts.push(`${d.artifacts} artifact${d.artifacts === 1 ? '' : 's'}: +${(d.artifacts * result.weights.perArtifact).toLocaleString()}`);
    if (d.thinking) parts.push(`thinking: +${(d.thinking * result.weights.perThinking).toLocaleString()}`);
    if (d.memory) parts.push('memory: +' + result.weights.memory.toLocaleString());
    return parts.join(' | ');
  }

  window.__ccp_overhead = {
    DEFAULTS,
    compute: computeOverhead,
    describe
  };
})();
