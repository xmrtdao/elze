# Elze Word Add-in — Integration Notes

Status: built + verified against the live endpoint (2026-08-29).
Task: `acd30095-4488-46c0-9a5e-f8987f238fb9` "Build Elze Word plugin against verified docx-redline endpoint".

## What was built

1. **Native track-changes attribution** (the "exceed Mixus" differentiator)
   - `relay/functions/docx-redline.mjs` now sets `w:author` on every `w:ins`/`w:del`
     as `Elze · <RULE-ID> · <clause> · <statute>` instead of a generic "AI" label.
   - Verified in the emitted OOXML: `w:author="Elze · RL-005 · No 24-hour notice for entry · 55.1-1216"`.
   - Rules/statutes read from the redline objects (`id`, `clause`, `statute`), which the
     analyzer already emits (e.g. `CL-004`/`55.1-1248`, `RL-005`/`55.1-1216`, `COMMON-LAW-*`).
   - Applies to BOTH the inline redlinedHtml path (via `data-id` threading) and the
     isolated fallback sections path.
   - Unique `w:id` per revision (Word corrupts review stacks on duplicate ids).

2. **Word add-in (Office.js taskpane)** — `relay/public/elze-word-addin/`
   - `manifest.xml` — taskpane add-in, host `Document`, icons, ribbon "Analyze Lease" button.
   - `taskpane.html` / `taskpane.js` — reads the open doc, analyzes via `lease-analyzer`,
     exports/merges attributed tracked changes.
   - `commands.js`, `assets/icon-{16,32,80}.png`.

3. **Relay route** — `relay/server.js`
   - `GET /elze/word-addin/manifest.xml` (content-type `application/xml`)
   - `GET /elze/word-addin/*` static.

## Verification

- Reloaded relay; route registered: `Elze Word Add-in: .../public/elze-word-addin`.
- All add-in files return HTTP 200 locally **and** via `https://relay.mobilemonero.com/elze/word-addin/…` (tunnel).
- manifest.xml is well-formed XML.
- Live `POST /api/v1/functions/docx-redline` returns HTTP 200 with a valid .docx whose
  tracked changes carry the rule+statute author.

## Canonical seam (from fleet thread `get_canonical_seam`)

- Base: `https://relay.mobilemonero.com`
- `POST /api/v1/functions/docx-redline`
- Payload: `{"redlines":[...],"metadata":{...}}` → attributed DOCX w/ tracked changes;
  or `{"action":"final","fullText":"...","metadata":{...}}` → clean DOCX.
- Auth: `x-api-key` header = **backend key**. The publishable key only unlocks the client
  button and is NOT validated server-side. Through the public tunnel only the backend key
  authorizes `/api/v1/functions/*`.

## Known items / next steps

- The Word add-in is served but **not yet sideloaded/tested in an actual Word host**
  (no Office desktop on this machine at build time). Merge-into-doc uses the Office.js
  `trackedChanges` API; the download path is verified against the real endpoint.
- Cosmetic login gate on `/elze/*` frontends does not validate the key (matches Vex's
  fleet flag) — deferred per Joe until pre-ship hardening.
- `data-id` on `<del>/<ins>` is added by the analyzer; if a docx-redline payload lacks it,
  attribution falls back to the rule matched by redline `id`/`clause`.
