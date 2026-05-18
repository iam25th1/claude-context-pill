# privacy policy

last updated: 2026-05-18

## summary

this extension does not collect, store, transmit, or sell any user data.

## what data is accessed

when active on `https://claude.ai/*`, the extension reads visible message
text from the DOM in order to compute a token-count estimate locally
(using a vendored `js-tiktoken` tokenizer). this read is ephemeral.

if you **opt in** to calibration mode, visible conversation text is also
sent to `https://api.anthropic.com/v1/messages/count_tokens` using your
own anthropic api key, in order to compute a correction factor for the
local tokenizer. no other external service is ever contacted.

## what data is stored

settings persist in `chrome.storage.local`, scoped to your browser
profile:

| key                       | type    | purpose                                    |
|---------------------------|---------|--------------------------------------------|
| enabled                   | boolean | whether the pill is shown                  |
| overheadMode              | string  | `auto` or `manual`                         |
| manualOverhead            | number  | override value if mode is `manual`         |
| memoryActive              | boolean | whether to add user-memory overhead        |
| showRaw                   | boolean | compact vs raw display preference          |
| calibration.enabled       | boolean | whether calibration mode is on             |
| calibration.apiKey        | string  | your anthropic api key (only if you set it)|
| calibration.intervalMessages | number | how often to calibrate                  |
| calibration state         | object  | rolling correction factor and sample count |

no message content, no conversation ids, no user identifiers, no
analytics, no telemetry are stored.

## what data is transmitted

- by default: nothing
- with calibration enabled: visible conversation text is sent to
  `https://api.anthropic.com/v1/messages/count_tokens` using your api
  key, on the schedule you configure. this is the only outbound network
  call the extension ever makes.

## third parties

if calibration mode is enabled by you, anthropic receives the visible
conversation text via the `count_tokens` endpoint, governed by anthropic's
own privacy policy and the terms tied to your api key.

no other third parties are involved. no trackers, no analytics, no CDNs.

## permissions explained

- `storage`: required to persist settings and calibration state
- host permission for `https://claude.ai/*`: required so the content
  script can read the conversation DOM and mount the pill
- `optional_host_permissions` for `https://api.anthropic.com/*`:
  requested **only** when you enable calibration mode, and dropped
  automatically when you disable it

no other permissions are requested.

## children

this extension is not directed to children under 13.

## changes to this policy

material changes will be noted at the top of this file and announced in
the [CHANGELOG.md](CHANGELOG.md).

## contact

questions: dm [@25thprmr on x](https://x.com/25thprmr).
security disclosures: see [SECURITY.md](SECURITY.md).
