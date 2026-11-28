---
slug: settings-live-refresh
status: draft
mode: thorough
created: 2026-11-28
---

# Auto-refresh an open Settings page when settings change

## What we're building

When you have the Settings page open and a setting changes somewhere else—such as through the personal assistant popup or in another browser tab—the open Settings page updates itself automatically to show the new values. Any section where you have unsaved edits or an active focused control stays untouched so your work is never wiped out.

## Why — the problem

Right now, if you ask the personal assistant to change a setting (or change it in another tab) while the Settings page is already open, the page keeps showing the old values until you manually reload it. That makes it unclear whether the change took effect, and saving something else on a stale page can accidentally overwrite the newer setting.

## What good looks like

- Changing any hub-stored setting in the personal assistant popup or another tab shows up on an already-open Settings page within a few seconds, without a manual reload.
- Sections that load separately—including accounts and usage, AI harnesses, background appearance, diagram sensitivity, and shared-tool keys—stay up to date alongside the main settings.
- While you are typing, have unsaved edits, or are focused on a control in a section, an external change never wipes out your input or moves your focus.
- If an external change arrives while a section has unsaved edits, you keep your draft and see a clear note that newer settings exist.
- Your own saves on the Settings page are never overwritten by an older refresh response that arrives late.

## Not doing

- Syncing browser-only preferences such as "Enter to send", which are stored only in that browser.
- Live-merging individual fields or characters inside a form you are actively editing.
- Live-refreshing remote repository files or pull-request edits under Project tools.
- Replacing the app's existing polling pattern with a new WebSocket or push system.

## Constraints

- Idle open Settings tabs must stay lightweight and avoid repeatedly running slow background commands when nothing has changed.
- Refresh tracking must keep working after a hub restart without getting stuck thinking nothing changed.
- Background checks must pause while the browser tab is hidden, matching the rest of the app.
