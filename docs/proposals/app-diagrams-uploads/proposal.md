# New diagram forms and uploads in app threads

Nov 14, 2026 · split out of `docs/plans/app-shell/` (decision D44, formerly slice 3)

## What this is

Two additions to app threads. Start it as a thread in the app and point the lead at this
file. Decisions D19, D20, D28 and D29 in the app-shell plan stand.

## Diagram forms (D19, D29)

Four more forms besides the existing boxes-and-arrows graph, each a JSON format the app
draws in a `diagram` card: timeline, before and after, layers, side by side. The formats
are defined in `protocol/app/cards.md`. The lead picks the form that fits the question.
When no form fits, the card may carry hand-written HTML, rendered in an
`<iframe sandbox="allow-scripts">` (no same-origin) with a CSP that forbids network
access.

## Uploads (D20, D28)

Paste, drop or attach in the message box. The app forwards the file to the machine
service running the thread's lead, which stores it as
`~/.local/state/wheelchair/uploads/<thread-id>/<filename>` and returns the path. The path
is put into the lead's message so the agent can open it. 25 MB per file. Files are
deleted when the thread is archived (threads are archived, never deleted; app-shell D46).

## Acceptance

Each new diagram form renders in a thread on a phone, and a pasted screenshot can be
opened by the lead.
