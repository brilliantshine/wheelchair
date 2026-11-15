---
slug: new-thread-screen
status: confirmed
created: 2026-11-15
---

# A New thread screen, with projects found from a folder

## What we're building

Starting a thread moves out of the sidebar form and onto its own screen, opened by the
"+ New thread" button at the top left of the thread list. Settings gets a default project
folder, and every directory inside it shows up as a project to pick from a dropdown. On
the new screen you can also save other directories under a project name, so they appear
in the same dropdown.

## Why — the problem

- The form is squeezed into a sidebar on two pages, next to the thread list and files.
- The project field is free text: you type or paste a full path, and the only suggestions
  are paths already used by an earlier thread.
- A mistyped path is saved as a project and a thread before anything notices it is wrong.
- There are two New thread buttons doing the same thing.

## What good looks like

- Pressing "+ New thread" above the thread list opens a New thread screen. No sidebar form
  is left on any page.
- The New thread button in the top bar is gone.
- Settings has a "Default project folder". Once set, every directory inside it is in the
  project dropdown on the New thread screen, by name, with no typing.
- On the New thread screen you can save another directory under a project name; it stays in
  the dropdown for next time.
- Picking a project and starting works as today: the thread opens and the lead starts.
- A path that does not exist is refused before a thread is created.

## Not doing

- Changing how a thread runs once started (worktree, lead, sessions).
- Changing the thread list itself, apart from removing the form beside it.

## Constraints

- Works on a phone.
- Existing threads, and projects already in the project list, keep working.
