---
slug: app-diagrams-uploads
status: draft   # draft | confirmed
created: 2026-11-15
---

# More diagram forms and file uploads in app threads

## What we're building

Two additions to threads in the app. First, the lead can answer with four more kinds of
picture besides boxes and arrows: a timeline, a before and after, layers, and side by side.
When none fits, it can draw a one-off picture of its own, shown so it cannot reach the
network or the rest of the app. Second, Collin can paste, drop or attach a file in the
message box, and the lead can open it.

## Why — the problem

Today the only picture a lead can show in a thread is boxes and arrows. Many answers are
really a sequence, a comparison or a stack, and get squeezed into the wrong shape or left
as prose. And there is no way to hand the lead a screenshot or a file from the phone: the
message box takes text only.

## What good looks like

- In a thread on a phone, each of the four new forms is readable without zooming or
  scrolling sideways.
- A one-off picture shows in the thread and cannot load anything from the network.
- Collin pastes a screenshot into the message box, sends, and the lead opens and
  describes it.
- A file over 25 MB is refused with a plain message before anything is sent.
- After a thread is archived, its uploaded files are gone from the machine.

## Not doing

- Changing how boxes-and-arrows graphs work, including proposals Collin approves or strikes.
- Showing uploaded files back in the thread as previews or downloads.
- Uploads for anything except the thread's lead (no sending files to workers or reviewers
  directly).
- Deleting threads (threads are archived, never deleted).

## Constraints

- Decisions D19, D20, D28, D29 and D46 in `docs/plans/app-shell/PLAN.md` stand.
- Files are stored on the machine running the thread's lead, under
  `~/.local/state/wheelchair/uploads/<thread-id>/`.
- 25 MB per file.
- Hand-written pictures run sandboxed: no same-origin access, no network.
