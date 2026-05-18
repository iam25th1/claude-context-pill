# privacy policy

last updated: 2026-05-18

## summary

this extension does not collect, store, transmit, or sell any user data.

## what data is accessed

when active on `https://claude.ai/*`, the extension reads visible message
text from the DOM in order to compute a token-count estimate. this read is
ephemeral and used only to produce a number rendered locally in the pill.

## what data is stored

three settings persist in `chrome.storage.local`, scoped to your browser
profile:

| key       | type    | purpose                                    |
|-----------|---------|--------------------------------------------|
| enabled   | boolean | whether the pill is shown                  |
| overhead  | number  | tokens added to the visible count          |
| showRaw   | boolean | compact vs raw display preference          |

no message content, no conversation ids, no user identifiers, no
analytics, no telemetry are stored.

## what data is transmitted

nothing. the extension makes zero network requests. there is no backend.

## third parties

none. the extension does not load remote scripts, does not embed
third-party trackers, and does not communicate with any external service.

## permissions explained

- `storage`: required to persist the three settings above
- host permission for `https://claude.ai/*`: required so the content
  script can read the conversation DOM and mount the pill

no other permissions are requested.

## children

this extension is not directed to children under 13.

## changes to this policy

material changes will be noted at the top of this file and announced in
the [CHANGELOG.md](CHANGELOG.md).

## contact

questions: dm [@25thprmr on x](https://x.com/25thprmr).
security disclosures: see [SECURITY.md](SECURITY.md).
