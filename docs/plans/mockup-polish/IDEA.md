---
slug: mockup-polish
status: draft   # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-23
---

# Mockups that behave well in a thread

Follow-up to design-in-threads (PR #174, merged): its deferred items plus a bug Collin hit.

## What we're building

Four changes to how mockups and built screenshots behave in a thread:

1. A thread with mockups in it stays still when new messages or cards arrive: no jump, no flash, no mockup reloading.
2. Collin can tap a spot on a mockup and write a comment about that spot. The comment reaches whoever is drafting the mockups, with where it points.
3. From a mockup's Open full size page, Collin can download it as a PNG picture, like he already can for diagrams.
4. A built screenshot's Open full size shows it at its true size on a phone, scrollable, with no extra tap to zoom.

## Why — the problem

- While an agent sent mockups earlier, every new card made the whole thread scroll, flash and reload unpredictably. It's hard to read or reply while that happens.
- Today, feedback on a mockup has to describe the spot in words ("the button under the header, on the left").
- Full size mockups only download as HTML, which can't be dropped into a chat or note.
- Built screenshots open as a raw image that the phone shrinks to fit, so it takes an extra tap to see them at real size.

## What good looks like

- With several mockups in a thread, new cards arrive and the thread doesn't move, flash or redraw the mockups already there.
- Tapping a mockup spot and sending a comment leads to a reply from the agent that clearly knows which spot was meant.
- Open full size on a mockup offers a PNG that looks like the mockup.
- Open full size on a built screenshot on a phone shows it at real size straight away, scrollable.

## Not doing

- Editing mockups by hand in the app.
- Comments on built screenshots or on ordinary diagrams (mockups only).
- Changing how designers draft mockups or how mockups are agreed.

## Constraints

- Phone first: everything works by touch in a phone browser.
- Mockups stay static and sandboxed: no scripts run in them.
