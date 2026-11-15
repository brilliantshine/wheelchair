---
slug: app-paper-cuts
status: confirmed   # draft | confirmed
created: 2026-11-14
---

# The app's screen paper cuts

## What we're building

Six small fixes to the app's thread screens, the ones Collin hit while using it: real
thread titles, the idea question carrying the idea, plan documents opening inside the app,
answered questions saying what was picked, a "Keep talking first" button on the offer, and
the design's fonts actually loading.

## Why — the problem

Using the app on a phone, each of these cost a hunt or a guess:

- A thread shows its project's name, so two threads on one project look the same.
- Confirming the idea means scrolling up to find the IDEA.md link.
- MAP, IDEA and PLAN open in the old viewer, with no app nav and no way back to the thread.
- An answered question only says "Answered", not what was chosen.
- The only way to say "not yet" to the planning offer is to keep typing.
- Inter and JetBrains Mono only show if the device happens to have them installed.

## What good looks like

- Every thread in the list and on its page has a title that says what it's about, from the
  first message or named by the lead.
- The question that confirms the idea shows IDEA.md, or opens it in one tap.
- Tapping MAP, IDEA or PLAN opens the document inside the app, with the nav and a way back
  to the thread it came from.
- An answered question shows the option that was pressed, or "answered in chat" when he
  answered by typing.
- The offer has a "Keep talking first" button next to "Take it into planning".
- The app's text renders in Inter and its code in JetBrains Mono on a device that has
  neither installed.
- Each fix has a test that fails before the fix and passes after.

## Not doing

- Session and card cleanup (Escape, merged pull requests, leftover sessions and cards):
  its own thread.
- The real smoke suite and the hub risks (timeouts, duplicate relayed cards, the projects
  list): its own thread.
- A redesign of the thread page or of the old document viewer beyond what these six need.
- Settings, permission modes, side conversations: separate proposals.

## Constraints

- Each fix comes with a test that fails before it.
- Card shapes stay documented in `protocol/app/cards.md`, and any new lead behaviour in
  `protocol/app/lead.md`; the app and the protocol must agree.
- The page's content-security policy stays strict; fonts are served by the app itself, not
  a third-party font host.
- Works on Node 20, which the always-on viewer service runs.
