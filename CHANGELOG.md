# changelog

all notable changes to this project will be documented here.

format loosely follows [keep a changelog](https://keepachangelog.com/en/1.1.0/).
project follows [semver](https://semver.org/spec/v2.0.0.html).

## [unreleased]

### planned

- v1.3 shareable usage card export
- v1.4 per-conversation profile-based overhead history (long-term learning)
- v1.5 toolbar badge with live count

## [1.2.0] - 2026-05-18

### added

- pill is draggable. click and hold, drag anywhere on screen, release to snap.
- magnetic snap on release. eight snap targets: composer top, bottom, left, right and screen top, bottom, left, right.
- snap chooses the closest edge by distance from the pill's center. no free-floating, so the pill always rests on a surface.
- position persists in `settings.position` (`anchor` + `offset` along the edge) and survives reloads, sidebar toggles, and route changes.
- new CSS classes `.ccp-dragging` (lifts the pill while held) and `.ccp-snapping` (240ms ease-out animation when snapping home).
- distinguishes click from drag with a 4px threshold so quick clicks still toggle raw view.

### changed

- positioning is now anchor-based with a normalized 0-1 offset along the anchor edge, replacing the v1.1 hardcoded composer-top-left placement.
- default placement remains composer-top, offset 0 (top-left of the composer), matching v1.1.1 visual default.
- `touch-action: none` on the pill so mobile drags don't scroll the page.

## [1.1.1] - 2026-05-18

### changed

- pill is now anchored directly above the composer's left edge rather than the bottom-right viewport corner. follows the composer through sidebar toggles, window resizes, and route changes.
- removes the fixed `right`/`bottom` viewport offsets in `pill.css` in favor of JS-computed `left`/`bottom` from the composer's bounding rect.
- adds a `ResizeObserver` on the composer plus a debounced window-resize listener and a low-rate position poll for edge cases like sidebar toggles that do not fire a resize event.

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

[unreleased]: https://github.com/iam25th1/claude-context-pill/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/iam25th1/claude-context-pill/releases/tag/v1.2.0
[1.1.1]: https://github.com/iam25th1/claude-context-pill/releases/tag/v1.1.1
[1.1.0]: https://github.com/iam25th1/claude-context-pill/releases/tag/v1.1.0
[1.0.0]: https://github.com/iam25th1/claude-context-pill/releases/tag/v1.0.0
