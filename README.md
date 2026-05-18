<div align="center">

<img src="preview/pill-states.png" alt="Claude Context Pill" width="720" />

# claude context pill

a tiny chrome extension that pins an estimated token-usage counter to the claude.ai composer.

[![license: mit](https://img.shields.io/badge/license-MIT-6ee7b7.svg?style=flat-square)](LICENSE)
[![version](https://img.shields.io/badge/version-1.0.0-6ee7b7.svg?style=flat-square)](CHANGELOG.md)
[![manifest v3](https://img.shields.io/badge/manifest-v3-fbbf24.svg?style=flat-square)](manifest.json)
[![zero deps](https://img.shields.io/badge/runtime%20deps-0-6ee7b7.svg?style=flat-square)](#zero-dependencies)

</div>

---

claude.ai does not expose a context-usage counter. this extension scrapes the
visible conversation from the DOM, estimates tokens with a char-based
heuristic, and renders a floating pill near the composer. it tells you,
roughly, how much of the 1M token window you've burned.

```
  ●  ~248k / 1M   24.8%       <  60%   green
  ●  ~712k / 1M   71.2%       60-85%   amber
  ●  ~924k / 1M   92.4%       >  85%   red
```

## why

long sessions silently drift toward the context ceiling. you only notice when
claude starts forgetting things you said an hour ago. this pill gives you a
visual signal so you can pre-emptively start a fresh chat, hand off context,
or trim attachments.

## install

### from source

1. `git clone https://github.com/iam25th1/claude-context-pill.git`
2. open `chrome://extensions`
3. enable `Developer mode` (top right)
4. click `Load unpacked` and select the cloned folder
5. reload any open claude.ai tab

the pill mounts bottom-right above the composer. the toolbar icon opens
settings.

### from chrome web store

coming soon.

## how the estimate works

| component                              | counted    |
|----------------------------------------|-----------:|
| visible user + assistant messages      | yes (~80%) |
| code blocks (denser ratio)             | yes        |
| system prompt                          | offset     |
| user memories                          | offset     |
| skills + tool definitions              | offset     |
| hidden tool result payloads            | no         |

the `~` prefix in the display is deliberate. heuristic accuracy is around
80% on the visible portion, and the hidden portion uses a configurable
overhead offset (default `40,000` tokens). tune it in the popup based on
your typical setup. chats heavy with tool use should bump it higher.

## features

- floating glass pill, pinned bottom-right of the composer
- 3-tier color status with subtle pulse animation
- click pill to toggle compact (`~612k / 1M`) and raw (`612,348 / 1,000,000`) views
- settings popup with overhead offset and global enable toggle
- SPA route-change aware (switches conversations cleanly)
- mutation observer with debounced re-render, low overhead
- respects `prefers-reduced-motion`

## zero dependencies

the extension ships zero runtime dependencies. no bundler, no transpiler.
everything is plain js, html, and css that chrome loads directly.

the only optional dev dep is `web-ext` for the lint job in ci.

## security

- manifest v3, host scoped to `https://claude.ai/*` only
- permissions limited to `storage`
- no remote scripts, no `eval`, csp-locked extension pages (`script-src 'self'`)
- message content is read from the DOM but never stored, never transmitted
- only three settings persist (`enabled`, `overhead`, `showRaw`)

see [SECURITY.md](SECURITY.md) for the full policy and how to report issues.

## privacy

see [PRIVACY.md](PRIVACY.md). short version: nothing leaves your browser.

## contributing

PRs welcome for selector fixes, tokenizer improvements, ui polish. see
[CONTRIBUTING.md](CONTRIBUTING.md) for the dev loop and test checklist.

## roadmap

- `v1.1` real tokenizer via vendored `js-tiktoken` cl100k encoding
- `v1.2` optional anthropic `count_tokens` api integration (user supplies key)
- `v1.3` shareable usage card export
- `v1.4` learned overhead detection per conversation

full history in [CHANGELOG.md](CHANGELOG.md).

## license

[MIT](LICENSE), built by [25TH](https://x.com/25thprmr)
