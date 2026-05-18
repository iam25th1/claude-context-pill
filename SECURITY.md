# security policy

this extension runs on `claude.ai`, a surface that handles potentially sensitive conversations. the security model matters.

## what this extension does

- reads visible message text from the claude.ai DOM
- runs that text through a vendored js-tiktoken (cl100k_base) tokenizer locally
- displays a token estimate in a fixed-position pill
- persists settings to `chrome.storage.local`: `enabled`, `overhead` settings, calibration state
- **if calibration is opt-in enabled**: sends visible conversation text to `https://api.anthropic.com/v1/messages/count_tokens` using the api key you supplied, to compute a correction factor. no other endpoints are contacted.

## what this extension does NOT do

- send data over the network to any service other than `api.anthropic.com` (and only when calibration is on)
- store, log, or transmit conversation content beyond the calibration call described above
- request permissions beyond `storage`, the `claude.ai` host, and the optional `api.anthropic.com` host (requested only when calibration is enabled)
- inject remote scripts, use `eval`, or use `unsafe-inline`
- run on any domain other than `https://claude.ai/*`
- store or transmit your api key anywhere besides `chrome.storage.local` and the anthropic api call

## reporting a vulnerability

if you find a security issue, please do not open a public github issue.

instead, dm [@25thprmr on x](https://x.com/25thprmr) with:

- a description of the issue
- steps to reproduce
- the affected version
- any suggested fix

you should expect an initial response within 48 hours. confirmed issues will be patched and disclosed via a github security advisory.

## supported versions

only the latest minor release on `main` receives security fixes.

## verifying a release

extension bundles are not yet signed. install only from this repo or from the chrome web store listing (once published).

before loading the unpacked extension, you can verify the manifest with:

```bash
cat manifest.json | grep -E '"permissions"|"host_permissions"|"optional_host_permissions"|"content_security_policy"'
```

expected output should match exactly the values in `main`.
