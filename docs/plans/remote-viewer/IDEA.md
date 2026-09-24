---
slug: remote-viewer
status: confirmed   # draft | confirmed
created: 2026-09-23
---

# See and rule on hearth's graphs from a phone or laptop

## What we're building

A way to open the graph viewer running on hearth, an always-on headless server, from
Collin's phone and laptops over the private Tailscale network. One bookmarked address
opens a page listing every graph, grouped by the tmux session and the agent (Claude or
Codex) that drew it. Tapping one opens the viewer, where the graph can be read,
rearranged and ruled on, on a phone as well as on a laptop. The same page also shows the
workflow's plan documents (MAP, IDEA, PLAN and the rest), readable on a phone.

Hearth is the machine that needs it, but nothing about it is hearth-only. Any machine
wheelchair is installed on runs the same code, and making a machine reachable from other
devices is something that machine opts into.

## Why — the problem

Collin runs long agent sessions on hearth inside tmux and drives them from a phone or
laptop over SSH. When one of those agents draws a graph, the viewer only answers on
hearth itself, and hearth has no screen. Every graph drawn there is invisible.

Even with a way in, three things would get in the way. The link changes every time the
viewer restarts. There is nowhere to see which graphs exist, or which session drew them.
And the viewer assumes a mouse and keyboard: on a phone you can't move around a picture
at all.

## What good looks like

- On the phone or a laptop, Collin opens one bookmarked `https://` address on the tailnet
  and sees a list of graphs, grouped by tmux session name and marked Claude or Codex,
  newest first. It still works after hearth reboots.
- Each session in the list shows whether it is still running and the command to attach to
  it, so moving from the graph to the terminal session that drew it is quick.
- A graph drawn by an agent a moment ago appears in the list without anyone restarting
  anything, and an open graph updates itself as the agent redraws it, as it does today.
- On the phone, a graph can be panned, zoomed with a pinch, have its boxes dragged, and
  have entries marked agreed or rejected, with the result saved back as it is on a laptop.
- From the same page, Collin can open a plan's documents and read them comfortably on the
  phone, without a terminal.
- Nothing is reachable from outside the tailnet.
- Using the viewer on a machine with a screen, the way it works today, is unchanged. A
  laptop that opts in gets the same reachable page as hearth.
- There is still one viewer server per machine. Agents opening a graph find the always-on
  one and use it; nothing runs a second server alongside it.

## Not doing

- Sending commands to agents from the browser. Commands stay in SSH and tmux. The viewer
  is not a terminal.
- Exposing anything to the public internet, or adding user accounts or logins beyond what
  the tailnet already provides.
- A native app or anything installed on the phone or laptop beyond Tailscale, which is
  already there.
- Redesigning the viewer for phones beyond what it takes to read, move around and rule on
  a graph.
- Editing plan documents in the browser. They are read-only there; agents and the terminal
  still write them.
- One page gathering graphs from several machines. Each machine's page shows that machine's
  own graphs and documents.

## Constraints

- The viewer's server has no runtime dependencies (`viewer/package.json`), and adding one
  needs a reason.
- The rules in `protocol/graphs.md` for how an agent opens and writes a graph are a
  contract every existing agent follows. A change there updates both harnesses' behavior at
  once.
- Hearth runs Node v20.19.2. The repo was developed against Node 26 (`README.md:234`).
- Configuring `tailscale serve` on hearth needs `sudo` once, since no tailscale operator is
  set.
- The pages must work in Firefox, on the laptops and on the Android phone, as well as in
  Chromium-based browsers. Collin uses both (added 2026-09-23).
