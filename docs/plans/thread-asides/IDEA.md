---
slug: thread-asides
status: draft   # draft | confirmed
created: 2026-11-15
---

# Asides: talk about one point without derailing the thread

## What we're building

A way to open a short side conversation about part of a lead's message in the app's thread
page. Collin highlights some words and asks about them, asks for them said more simply, or
asks for a picture. A side panel holds that conversation, and the main thread stays as it
was.

## Why — the problem

Today a question about one part of a lead's reply goes into the main thread. The thread
drifts into a side quest, the record of decisions gets cluttered, and it's hard to get back
to what the thread was doing, such as a question card still waiting on him.

## What good looks like

- Highlighting words in a lead message shows a small bar: **Ask about this**, **Say it
  simpler**, **Draw it**. Every lead message also has **Ask about this message**.
- The aside opens in a side panel quoting the highlight. The main thread doesn't change.
- The panel always shows what the main thread is waiting on (for example "your answer to
  Q6"), with a link back to it.
- The aside already knows everything the lead knows, without Collin re-explaining, and
  nothing said in it shows up in the lead's own conversation.
- **Done, back to …** closes the aside. **This changes my answer** carries a one-line
  summary into the main thread, and the lead treats it like his answer.
- The highlighted words stay underlined, so a closed aside can be reopened and read again.
- It works on a phone as well as a desktop browser.

## Not doing

- The free-text answer box on question cards (the side-conversations thread owns it).
- Any Settings screen or row for asides.
- Letting an aside act for the lead: it doesn't post cards to the main thread, start
  sessions or change the plan.
- Asides on anything other than lead messages (cards, Collin's own messages, other
  sessions).

## Constraints

- An aside uses the same provider as the lead (Claude lead, Claude aside), because it is a
  copy of the lead's conversation.
- The lead's own conversation must not grow from an aside.
- Design: `docs/proposals/app-settings/proposal.md` ("Asides") and
  `docs/proposals/app-shell/design/ThreadAside.dc.html`.
