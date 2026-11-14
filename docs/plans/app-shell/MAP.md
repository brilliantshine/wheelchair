# How wheelchair works today

First pass, built 2026-11-14 for the app-shell plan. It covers the parts the app replaces or
grows out of. Detail gets added per question.

## End to end

Collin types a slash command such as `/plan <slug>` into a Claude Code or Codex session in
a terminal. The command is a one-line wrapper that tells the agent to read one protocol
file and follow it (`skills/plan/SKILL.md:6-8`). From then on, that terminal session is the
lead, and it reads and writes the feature's state in `docs/plans/<slug>/`. The `status:`
line in `PLAN.md` decides which stage may run next (root `AGENTS.md`, "status is the state
machine").

When a stage needs other agents (reviewers in plan review, workers in implementation,
the verifier), the lead starts them itself, in one of two ways:

- A GPT lane is a headless `codex exec` run that blocks until it finishes. The lead
  starts it as a background shell call, reads the final report from an `-o` file, and keeps
  the `thread_id` from its event stream so it can resume it (`protocol/lanes.md:39-48`,
  `protocol/implementation.md:191-196`).
- A Claude lane is Claude Code's in-process Agent tool when the lead is Claude, or
  `claude -p` when the lead is Codex (`protocol/lanes.md:153-157`).

Either way, a lane is invisible while it runs. You can't open it, and the lead only sees
what it returns. Every lane runs on the machine and in the checkout the lead is in, and two
write-lanes never share a checkout (`protocol/lanes.md:185-187`).

While a stage works, it registers the plan with the viewer and draws graphs into
`docs/plans/<slug>/graphs/`. The viewer is a Node server with no runtime dependencies
(`viewer/package.json`). It listens only on 127.0.0.1 (`viewer/server.js:2096-2099`). On a
machine set to serve, `install.sh` runs it as an always-on systemd user service that
restarts on failure, with linger enabled so it survives logout (`install.sh:268-283`). It
also maps `/wheelchair` through Tailscale Serve so other tailnet devices can reach it
(`install.sh:243-247`).

A browser gets in by following a link carrying the server's token once. After that a
remember cookie lets it in (`viewer/server.js:1858-1877`). Every write must also come from
the viewer's own origin, either 127.0.0.1 or the served tailnet address
(`viewer/server.js:1418-1431`). The pages poll the server rather than holding a live
connection: the list page every 5 seconds (`viewer/list.js:4`), the graph page every second
(`viewer/index.html:307`).

The list page shows two things (`viewer/server.js:1796-1800`):

- Open graphs, grouped by the tmux session that opened them, with a `tmux attach` command
  for any session still running. The server only knows tmux sessions on its own machine,
  by running `tmux list-sessions` (`viewer/server.js:1718-1735`). It learns a graph's
  session from the `TMUX` environment of the agent that opened it
  (`viewer/server.js:1968-1978`).
- Registered plans, each with its `status`, its repo, and a link to its run picture if
  there is one (`viewer/server.js:1768-1794`).

```
Collin types /plan in a terminal session
        ↓
that session is the lead → reads protocol/<stage>.md → writes docs/plans/<slug>/
        ↓                                   ↓
starts lanes (codex exec / Agent / claude -p)     registers plan + writes graphs
   headless, same machine, report on return        ↓
        ↓                                  viewer (127.0.0.1, systemd, Tailscale Serve)
lead reads reports, updates PLAN.md               ↓
                                          browser: list of plans and graphs, polling
```

## What matters for this change

1. **Nothing runs unless a terminal session is driving it.** The lead is whatever session
   Collin typed into, and all stage logic lives in the protocol prose that session is
   following. There's no process that holds a feature's progress except that session and
   the files it writes. The app needs something that can start and own lead sessions,
   which doesn't exist anywhere today.
2. **The viewer is read-mostly and single-machine.** It serves pages and accepts graph
   edits, but it never starts a process, never types into a terminal, and only sees tmux
   on its own host. Its security model (token once, then a cookie, plus an origin check on
   writes) was designed for graph edits, not for typing into agent terminals.
3. **Headless lanes are baked into the protocol.** `lanes.md`, `implementation.md`,
   `plan-review.md` and `verification.md` all describe dispatch as "start a blocking run,
   read its report file". The `seen/` hook goes silent on these runs because of
   `WHEELCHAIR_LANE=1` (`protocol/lanes.md:12-21`). Moving every agent into an interactive
   tmux session rewrites how all four stages dispatch and collect.

## What I didn't check

- How plan review and verification merge reports and count rounds, beyond their section
  headings. These matter for the "silent review" decisions and will be read when those
  questions come up.
- Whether Claude Code or Codex exposes a session's conversation in a form the app could
  render as chat (transcript files, hooks, an API). This is research for Open Question 8,
  not something in this repo.
- Codex's `notify` setting and Claude Code's Stop hook, the proposal's worker done signal.
  Neither is used anywhere in this tree today.
- The graph page's internals (`viewer/index.html`, 2,575 lines) beyond its poll interval.
- `docs/known-issues.md`.
