# How the graph viewer is reached today

## End to end

An agent that wants to show a graph runs `node viewer/server.js --open <graph path>` in the
background (`protocol/graphs.md:436-457`). That command first writes the path into a list
of graphs the server will allow, `<cache-root>/.registered` (`viewer/server.js:1456`,
`registerPath` at `:994`). It then tries to become the server (`startServer`, `:1367`).

Becoming the server means creating a lockfile, `<cache-root>/.server`, holding a fresh
random pid, port, token and start id (`:1370-1374`). The cache root defaults to
`~/.cache/agent-graphs` (`:922`) and the port to 7373 (`:36`). If the lockfile already
exists and the process in it answers on `/whoami`, the command reuses that server, prints
its URL and exits (`:1376-1378`). So one server serves every repo and every session on the
machine, and it is whichever agent `--open` happened to run first. It lives as long as that
background process lives. Nothing restarts it.

The server listens on `127.0.0.1` only (`:1417`). The URL it prints is
`http://127.0.0.1:7373/?path=<graph>&token=<token>` (`viewerUrl`, `:1342`).

The page reads `path` and `token` out of its own address bar (`viewer/index.html:263-265`),
polls `GET /graph` every second, and sends drags and verdicts back with `PUT /view`
(`index.html:413-416`). All its fetches use relative URLs, so the page itself does not care
what host it was loaded from.

The server checks two things on a write: the `X-Graph-Token` header matches the token, and
the browser's `Origin` header is exactly `http://127.0.0.1:<port>` (`requirePutAuth`,
`server.js:1092-1098`). Reads only check the token (`:1086`).

```
agent: server.js --open <path>
        ↓
  add <path> to .registered
        ↓
  lockfile exists and its server answers?
   ├─ yes → print that server's URL, exit
   └─ no  → new random token, listen on 127.0.0.1:7373, stay running
        ↓
  browser on the same machine opens http://127.0.0.1:7373/?path=…&token=…
        ↓
  GET /graph every second (token)      PUT /view on drag or verdict (token + Origin)
```

## What matters for this change

Nothing off the machine can reach the server. It binds `127.0.0.1`, and even a request that
did get through from another address would have its writes refused, because the `Origin`
check names `127.0.0.1` literally.

The token changes every time a server starts (`:1372`), and a server only starts when an
agent opens a graph. A bookmarked URL stops working the next time the server restarts.

There is no page that lists graphs. `GET /` returns the viewer only when given a registered
`path` and the token (`handleRoot`, `:1242-1255`), and there is no route that lists
`.registered`. That file already is a list of every graph opened in the last 30 days, pruned
by age at each server start (`REGISTERED_MAX_AGE`, `:38`; `pruneRegistered`, `:984`). Each
entry holds only `added` and `opened` (`:997`). Nothing records which tmux session or which
harness opened a graph.

The `--open` command runs in the agent's own shell, so it can see that session's environment.
In this Claude Code session under tmux, `TMUX`, `TMUX_PANE` and `CLAUDECODE=1` are all set.
I did not check what a Codex session sets.

The server drops any graph field it doesn't know about when it writes a graph out
(`AGENTS.md`, verification section; canonicalization in `server.js`). So a session name
can't be stored inside the graph file itself.

## The phone is more work than a viewport tag

The page has no `<meta name="viewport">` (`index.html:1-3`), so a phone renders it at
desktop width and shrinks it.

Zoom is the mouse wheel or the + and − buttons (`index.html:1897-1903`). There is no pinch.

Panning is alt-drag or the middle mouse button. A plain drag on the empty canvas is
box-select (`index.html:1789-1800`). A phone has neither alt nor a middle button, so today
you cannot pan on a phone at all. Multi-select also leans on shift-click (`pick(e.id,
ev.shiftKey)`, `:1255`).

Dragging a box works, because the page uses pointer events throughout and sets
`touch-action: none` on the canvas (`index.html:82`).

## The machine

Checked on hearth on 2026-09-23. These are facts about this box, not about the code:

- Tailscale 1.102.4 is running. The machine's tailnet name is `hearth.taileb4e52.ts.net`,
  MagicDNS is on, and HTTPS certificates are available for that name. The phone `firefly`
  and the laptops are on the same tailnet.
- `tailscale serve` has no configuration yet. No tailscale operator is set, so configuring
  it needs `sudo` once. `collin` is in the `sudo` group.
- systemd user services run, but lingering is off (`Linger=no`). Without it, a user service
  stops when the last login session for `collin` ends.
- Node is v20.19.2. The repo says it was developed against Node 26 (`README.md:234`).
- `~/.cache/agent-graphs` does not exist yet: no graph has been drawn on this machine.

## Not checked

- What environment a Codex CLI session exposes, and whether it can be told apart from a
  plain shell.
- Whether the viewer's test suites pass on Node 20.
- How the page's layout (top bar, side panel) behaves at phone width. I read the input
  handling, not the layout.
- Whether `tailscale serve` passes the browser's `Origin` header through unchanged. I
  expect it does, but I haven't tried it.
