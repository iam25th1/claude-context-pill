# changelog

all notable changes to this project will be documented here.

format loosely follows [keep a changelog](https://keepachangelog.com/en/1.1.0/).
project follows [semver](https://semver.org/spec/v2.0.0.html).

## [unreleased]

### planned

- v1.2 shareable usage card export
- v1.3 per-conversation profile-based overhead history (long-term learning)
- v1.4 toolbar badge with live count

## [1.1.0] - 2026-05-18

### added

- real BPE tokenizer via vendored `js-tiktoken` (cl100k_base), ~95% accurate on visible text
- smart overhead detector replaces the fixed 40k default
  - detects project mode, attached files, web searches, artifacts, thinking blocks
  - manual `user memory active` toggle for what cannot be auto-detected
- opt-in API calibration mode
  - user supplies anthropic api key
  - extension calls `/v1/messages/count_tokens` periodically
  - stores a rolling multiplicative correction factor (clamped 0.5x to 2.0x)
  - exponential moving average so recent samples weight higher
  - requires explicit `optional_host_permissions` grant at toggle time
- popup redesigned with tabs (main, calibration)
- live calibration stats: samples, factor, last run, error count
- manifest CSP `connect-src` scoped to `api.anthropic.com` only

### changed

- settings shape v1.0 -> v1.1, migration is automatic on first load
  - `overhead` field renamed to `manualOverhead`, mode defaults to `auto`
- content script load order now: `tokenizer.bundle.js`, `overhead-detector.js`, `calibrator.js`, `content.js`

### security

- api key stored only in `chrome.storage.local`, never logged, never sent anywhere besides `api.anthropic.com`
- network access to anthropic API is `optional_host_permissions`, only granted when calibration is enabled
- correction factor mathematically clamped so a malicious or malformed API response cannot poison the estimator

## [1.0.0] - 2026-05-18

### added

- initial release
- char-based token estimator with code-block weighting
- fixed-position pill mounted bottom-right of claude.ai
- 3-tier status colors (ok / warn / danger) at 60% and 85% thresholds
- mutation observer for live updates
- SPA route change detection
- settings popup with configurable overhead offset and enable toggle
- click-to-toggle compact vs raw token display
- chrome.storage.local persistence for settings
- manifest v3 with minimal permissions (`storage` + claude.ai host)
- csp-locked extension pages, no remote scripts, no `eval`

[unreleased]: https://github.com/iam25th1/claude-context-pill/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/iam25th1/claude-context-pill/releases/tag/v1.1.0
[1.0.0]: https://github.com/iam25th1/claude-context-pill/releases/tag/v1.0.0
