# changelog

all notable changes to this project will be documented here.

format loosely follows [keep a changelog](https://keepachangelog.com/en/1.1.0/).
project follows [semver](https://semver.org/spec/v2.0.0.html).

## [unreleased]

### planned

- v1.1 real tokenizer (vendor `js-tiktoken` cl100k encoding)
- v1.2 optional anthropic `count_tokens` api integration
- v1.3 shareable usage card export
- v1.4 learned overhead detection per conversation

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

[unreleased]: https://github.com/iam25th1/claude-context-pill/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/iam25th1/claude-context-pill/releases/tag/v1.0.0
