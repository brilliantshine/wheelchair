---
slug: remember-me
status: confirmed   # draft | confirmed
created: 2026-09-23
---

# The viewer remembers a device after its first visit

## What we're building

Opening the viewer's long token link once on a phone or laptop is enough. After that, the
plain address, `https://hearth.taileb4e52.ts.net/wheelchair/`, opens the list on that
device, and every page works without the token in its address. The token stops showing up
in URLs and in browser history. The viewer moves under `/wheelchair/`, so the root of the
address stays free for a hub or another service later.

## Why — the problem

Today the token is the only way in. It has to be in the address of every page, so each
device needs a bookmark that carries a 64-character secret. Typing the plain address gets
an error. The token also lands in the history of every page visited, and in anything copied
from the address bar.

Collin also expects to serve other things from hearth later, and doesn't want this change to
make that harder.

## What good looks like

- On a device that has opened the token link once, typing or bookmarking
  `https://hearth.taileb4e52.ts.net/wheelchair/` opens the list, and graphs and plan documents open
  from it. Nothing asks for the token again until it is rotated.
- After that first visit, the token no longer appears in the address bar or in the history
  of any viewer page.
- A device that has never opened the token link still gets nothing.
- `--rotate-token` still locks everyone out until they open the new link, including devices
  that were remembered.
- Links agents print open directly on any device that has been remembered, without a token
  in them; on a device that hasn't, the page says to open the bookmark once. The old bookmark
  with the token keeps working. While nothing else
  is at the root, an old root link is sent on to the same place under `/wheelchair/`.
- The root of `https://hearth.taileb4e52.ts.net/` stays free: the viewer answers only under
  `/wheelchair/` apart from that redirect, and nothing it sets reaches other paths.
- Adding another service on hearth later needs no change to the viewer and no change to how
  Collin reaches it.

## Not doing

- Logins, passwords or accounts. Being on the tailnet, plus having opened the token link
  once, is the whole model.
- Serving any other service now. This plan only makes sure the viewer won't get in the way
  of one.
- Changing how agents authenticate. Their signed registrations and the token they read from
  `.server` stay as they are.
- Changing which network the viewer is reachable from. It stays tailnet-only through
  `tailscale serve`.

## Constraints

- The viewer's server has no runtime dependencies (`viewer/package.json`).
- The browser pages' Content-Security-Policy stays as strict as it is (remote-viewer
  Decision Log #42).
- Everything must work in Firefox and Chromium, on the phone and the laptops (remote-viewer
  IDEA constraint).
- The viewer can't tell a tailnet request from a local one: every request reaches it from
  `127.0.0.1` (MAP.md).
