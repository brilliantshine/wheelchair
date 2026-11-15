# The rest of the app's screens

Nov 14, 2026 · from the design canvas, after the app-shell UI pass

## What this is

The app-shell UI pass restyled the existing pages to match Collin's design boards
(`docs/proposals/app-shell/design/`, and the canvas at
https://claude.ai/artifact/RRWYSCz681JTHiRCD8dkwo). It left out the screens and parts that
need data or pages the app doesn't have yet. Start it as a thread in the app and point the
lead at this file. Settings (accounts, usage, models, templates, writing) is not here: it
has its own proposal, `docs/proposals/app-settings/`.

## Screens

- **Feature pages.** `Planning.dc.html` (one question at a time) and `Run.dc.html`
  (implementing: lanes, choices, progress). Today a feature only exists as a card on
  Features and as its thread.
- **Session wall.** `SessionWall.dc.html`, a home made of live session panes. It needs pane
  previews from the machine service.
- **Search.** The header's "Find a feature, session or file".
- **Code maps.** The sidebar's "Code maps · N areas · M out of date". It needs the maps that
  mapping sessions keep per project.

## Parts of existing screens

- **Feature cards:** progress bars and "N lanes running · 1 choice to rule on". These need
  build progress per feature, which the `progress` card has but the Features API doesn't
  carry.
- **Session cards:** a pane preview, and "Keep" or "Strike" for a choice waiting on Collin.
- **Thread:** idea bullets marked "new" and "↑ added to your idea"; "Show conversation" on a
  talked-through objection; "What got built" on the Done card.
- **Phone:** the "Running" list on the phone home (`PhoneInbox`).

## Checks

Each screen keeps the existing pages working at 390 px with no sideways scroll, as the UI
pass's `viewer/test/app-ui.spec.js` checks. Any new data comes from a documented route in
`viewer/app/API.md`, with tests.
