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
2. open `chrome://extensions`, enable developer mode, click `load unpacked`, select the repo folder
3. edit files
4. click the reload icon on the extension card after changes
5. reload your claude.ai tab

there is no build step.

## testing checklist before a PR

- pill renders on a fresh `claude.ai/new` page
- pill updates within ~1 second of sending or receiving a message
- pill survives switching between conversations
- popup opens, settings persist after browser restart
- color shifts correctly past 60% and 85% thresholds (adjust overhead temporarily to test)
- works in light mode and dark mode claude.ai
- no console errors

## opening a PR

- one focused change per PR
- update `CHANGELOG.md` under `[unreleased]`
- bump `version` in `manifest.json` for release PRs only
- describe what you tested in the PR body

## reporting security issues

do not open a public issue. see `SECURITY.md`.
