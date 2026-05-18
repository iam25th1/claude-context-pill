# contributing

thanks for considering a contribution. this is a small project so the bar is just: keep it simple, keep it safe.

## ground rules

- no new dependencies without a clear reason. the extension currently ships zero deps and that is a feature.
- if you do add a dep, commit the lockfile.
- manifest v3 only. no `unsafe-eval`, no remote scripts, no broad host permissions.
- selectors targeting claude.ai DOM should always include fallbacks.
- the pill is an estimate. do not claim accuracy beyond what the heuristic can deliver.

## dev loop

1. clone the repo
2. `npm ci --ignore-scripts` to install dev tooling (esbuild + js-tiktoken)
3. open `chrome://extensions`, enable developer mode, click `load unpacked`, select the repo folder
4. edit files
5. if you changed the tokenizer entry, run `npm run bundle:tokenizer` to rebuild `vendor/tokenizer.bundle.js`
6. click the reload icon on the extension card after any change
7. reload your claude.ai tab

before pushing: `npm run lint && npm run verify`. both run in ci on every PR.

## testing checklist before a PR

- pill renders on a fresh `claude.ai/new` page
- pill updates within ~1 second of sending or receiving a message
- pill survives switching between conversations
- popup tabs (main, calibration) both render correctly
- main panel settings persist after browser restart
- if you touched calibration: api key field is masked, permission prompt fires on enable
- color shifts correctly past 60% and 85% thresholds (use manual overhead temporarily to test)
- works in light mode and dark mode claude.ai
- `npm run lint` passes with 0 errors

## opening a PR

- one focused change per PR
- update `CHANGELOG.md` under `[unreleased]`
- bump `version` in `manifest.json` for release PRs only
- describe what you tested in the PR body

## reporting security issues

do not open a public issue. see `SECURITY.md`.
