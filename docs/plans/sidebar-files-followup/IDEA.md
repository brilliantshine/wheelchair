---
slug: sidebar-files-followup
status: confirmed  # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-20
---

# Thread files: the parts saved for later

## What we're building

Finishing the thread sidebar's files. You can download pictures as image files and all
project documents at once, preview documents an agent sent you without leaving the app,
keep those sent files after archiving a thread, and see the map, idea and plan of threads that
run on another computer.

## Why — the problem

The sidebar files feature shipped the basics and saved five things for later. Today:

- Pictures only open full size; there is no way to save one as an image.
- Documents download one at a time.
- A sent document that is not a picture can only be downloaded, then opened in the phone's
  own viewer.
- Archiving a thread deletes the files agents sent you.
- For a thread on another computer, the sidebar cannot show its map, idea, plan or pictures.

## What good looks like

- On a picture, a download gives you an image file that looks like what you see on screen. The
  rare interactive-page pictures save as their page file instead, with scripts blocked.
- One button downloads all of a thread's project documents as a single file.
- Tapping a sent text or Markdown document shows it inside the app, with a way to download.
- After archiving a thread, the files agents sent you are still listed and still download.
- A thread running on another computer shows its map, idea and plan in the sidebar, and
  they open and download, the same as a thread on this computer.

## Not doing

- Editing documents in the app.
- Previewing every file type (spreadsheets, Word files, PDFs beyond what the browser shows
  itself).
- Changing how you attach files to your own messages.
- Keeping your own attachments after archiving.
- Pictures of threads running on another computer: moved to their own thread ("Pictures
  from threads on another computer").

## Constraints

- Must work from a phone browser.
- Files from agents must not be able to run code in the browser (same safety as today).
- Reading from another computer must not slow down or freeze the thread list.
