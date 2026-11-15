# Remediation 2 — app-shell

Verification round 2 at commit 9aa03cb. The round-1 verifiers were resumed: Opus (Claude,
the same agent) and Sol (`gpt-6.1-sol`, thread `01a1dd51-d8d6-7942-9d49-0f7c06f2a8c3`).
Both returned `VERDICT: FAIL`.

## Gaps, verbatim

### Opus

```
GAP: Invalid card refused with the reason, thread not changed (remediation regression) — any refused card (422 role, 409 archived) or an update for an unknown thread kills the viewer process: `State.queued` keeps a failing promise nobody catches, and server.js has no handler — `viewer/app/state.js:50-60`; demo4: caller caught `422 worker may not post done`, then the process exited 1 with that error; demo5 (real server.js via the suite helper): refused card → 422, next request → ECONNREFUSED
GAP: Edge cases: dead worker restarted in the same worktree and branch — the `--replaces` mechanism exists but no role file or API doc mentions it, so a sub-lead following `protocol/app/sub-lead.md` (start command at :73-77, restart rule at :91-92) still gets a new `wc-<id>-w<n>` worktree — `grep -rn replaces protocol/ machine/API.md viewer/app/API.md` finds nothing about it; the flag is only parsed in `viewer/app/wc.js:88` and `sessions.js:292-296`
```

### Sol

```
GAP: Invalid-card handling — a refused queued update leaves an unhandled rejected promise that terminates the viewer — viewer/app/state.js:53-60; repeated reproduction: invalid card returned 422, viewer exited 1, next request received ECONNREFUSED.
GAP: Durable event delivery — an event’s delivery id is saved before processing finishes, so retry after a failed submit acknowledges “duplicate” without delivering the retained message — viewer/app/sessions.js:211-219,256-257; repeated reproduction: first attempt failed, retry returned duplicate:true, successfulSubmits=0, remainingQueue=1.
GAP: New diagrams inside threads — registering the plan does not register the graph checked by the iframe route — viewer/app/cards.js:43-46 registers only the plan; viewer/server.js:1244-1271 maintains separate registries; repeated browser reproduction: card accepted with 202, iframe returned 403 not-registered.
GAP: Running-version readiness gate — the hub captures HEAD on the first API request rather than when the viewer process starts — viewer/app/hub.js:16-19; viewer/server.js:2182-2184 initializes it lazily; repeated reproduction: viewer started before simulated pull, service reported the new commit, and a new lead was accepted with 201.
GAP: Worker recovery — the role protocol does not teach the required --replaces flag or original-session cleanup convention — protocol/app/sub-lead.md:73-79,91-93 at 9aa03cb; ordinary restart still produced w2 instead of w1, while removal using the replacement session returned “worker has no removable worktree” (machine/service.js:269,591).
GAP: Codex human-turn filtering — the turn-context flag never resets between turns, allowing later injected user entries before their turn_context to appear as Collin’s messages — viewer/app/chat.js:154-165; repeated reproduction rendered “second-turn injected before context”.
GAP: Archive recovery after a rebase — the service forgets the owner of a retained worktree, so “resolve the rebase, then archive again” leaves that worktree behind — machine/service.js:426-427,445; viewer/app/threads.js:143; repeated reproduction: secondRemoved=[], registered=0, worktreeStillExists=true.
GAP: Archived diagrams — child navigation always fetches the initial archived file, so opening a child redraws the parent — viewer/index.html:469-483 ignores the requested navigation path; repeated browser reproduction requested parent.json twice and displayed no child details.
GAP: Card resolution / declined finding — typed answers remain supported by the card protocol but leave answered questions permanently open; the decline’s claim that typed answers are undefined is contradicted by protocol/app/cards.md:93-95 — viewer/app/routes.js:91-99 only queues the answer; repeated reproduction left questionAnswered=false.
```

## Lead triage

- **Fixed by the lead at ba2c84f, before this file was written: the viewer crash.** Both
  verifiers found it. Hearth's live viewer was already running that code, so the lead fixed
  it at once instead of waiting. The write queue's chain now swallows the error while the
  caller still gets it. `viewer/test/app-state-queue.test.js` fails without the fix and
  passes with it, and the live services were redeployed with `./install.sh`.
- **Fixed by the lead at ba2c84f: worker recovery.** Both verifiers found it.
  `protocol/app/sub-lead.md` now teaches `--replaces <dead worker>` with a new
  `--attempt`, and says that removing the worktree still names the original worker.
  `viewer/app/API.md` documents the route. The D72 wording is corrected too (Opus: the hub
  marks the stub ready and doesn't start it).
- **Card resolution: the decline stands, and Collin is asked.** Sol is right that
  `cards.md:93-95` allows a typed answer to a question, as an ordinary message the lead
  answers. Neither the Spec nor `cards.md` says the card then closes, and a typed message
  doesn't name which card it answers. Whether a typed answer should close the question is a
  design decision. It goes to Collin together with the side-conversations follow-up
  (`docs/proposals/app-side-conversations/proposal.md`), which covers "answer in his own
  words". It is not a remediation task.
- **Surviving gaps, and their escalation per the verification protocol:**
  - Gaps that survived round 1: new diagrams, the version gate, Codex turn filtering,
    archive after a rebase, archived diagrams.
  - All five were nearly right and missed an edge case. None misread the task.
  - So round 2 takes the effort rung at the same tier, in fresh lanes: Terra at `xhigh`
    for the hub and service gaps, and a fresh Sonnet for archived diagrams.
- **New: an event retry is answered "duplicate".** It came from round 1's fix, so it goes in
  the same Terra lane.

## Tasks

| Task | Owns | Lane | Gaps |
|---|---|---|---|
| R4 | `viewer/app/`, `viewer/server.js` (two small hooks), `machine/service.js` (archive only), their tests | GPT / Terra, `xhigh`, fresh | event delivery id after success, diagram graph registration, boot-time version from server start, Codex turn reset, archive after a rebase |
| R5 | `viewer/index.html`, `viewer/test/*.spec.js` | Claude / Sonnet, fresh | archived child navigation |

### R4 — hub and service (GPT / Terra, xhigh)

Objective: close five gaps. Each needs a test that fails before its fix and passes after.
Use the real components wherever one exists, not a permissive fake: round 1's bugs hid
behind fakes.

1. **Event delivery id after success.** In `viewer/app/sessions.js:211-219` and `:256-257`,
   the delivery id is recorded before the event's work finishes. When that work then fails
   (for example the submit to the machine fails), the service's retry is answered
   `duplicate` and the queued message is never delivered. Record the delivery id only once
   the event has been fully applied, in the same per-thread lock (`hub.withThread`). On
   failure nothing is recorded, so the retry runs again. Apply the same check to
   `viewer/app/cards.js`'s card path. Test: the first event's submit fails, the retry
   succeeds, the message is submitted exactly once, and the queue is empty.
2. **New diagrams load in the thread.** The iframe route checks the graph registry
   (`ensureRegistered`/`loadRegistered`, `viewer/server.js:1250`), not the plan registry
   that `registerPlan` writes (`:1244`). Have `viewer/server.js` pass the Hub a
   `registerGraph(graphPath)` callback that adds the path to the graph registry, under the
   same `withMutex`, the way `registerPlan` is passed at `:2183-2184`. When a `diagram` card
   arrives, `cards.js` calls it with
   `<thread worktree>/docs/plans/<plan>/graphs/<graph>.json` (fields `plan` and `graph`,
   `protocol/app/cards.md:155-156`), as well as registering the plan. Test through the real
   server: post a diagram card, then GET the URL the thread page's iframe uses, and get
   200 rather than 403 `not-registered`.
3. **Version from server start.** The Hub is built on the first API request
   (`viewer/server.js:2183`), so `hub.codeVersion` is read late. Have `viewer/server.js` read
   `git rev-parse HEAD` of its own clone once, when the server starts (beside
   `currentCode()`), and pass it to the Hub as `codeVersion`. The Hub uses a given
   `codeVersion` and reads git itself only when none is given (tests). Test: start the real
   server, move the clone's HEAD (a temp clone used as root), then make the first app
   request. A machine reporting the new HEAD is out of date.
4. **Codex turn filtering per turn.** In `viewer/app/chat.js:154-165`, the flag that marks a
   Codex turn as having seen its `turn_context` is set once and never reset. Reset it when
   each new turn starts (`task_started`, or the user entry that opens a turn), so every turn
   needs its own `turn_context` before a user entry counts as Collin's. Test with two turns,
   each with an injected user entry before its `turn_context`. Neither shows, and the real
   human messages after each `turn_context` do.
5. **Archive again after a rebase.** `machine/service.js:426-427` keeps the worktree, but
   `:445` deletes every session record of the thread, so a second archive finds nothing.
   Keep the record (marked `archived_pending: true`, not running) for every session whose
   worktree was kept. A later `/v1/archive` for that thread processes those records and
   removes them once their worktree is removed. On the hub, `viewer/app/threads.js:143`'s
   second archive then sees the worktree removed and records the archive. Test with real
   git: a worktree mid-rebase is kept on the first archive. Abort the rebase, archive again,
   and the worktree is removed and the thread archived.

Ownership: `viewer/app/`, `viewer/server.js` (only the two hooks in items 2 and 3),
`machine/service.js` (only the archive in item 5), `machine/API.md`,
`viewer/test/app-*.test.js`, `viewer/test/helpers/app-machine.js`, `machine/test/`.

Validation: `bash machine/test/run.sh`, `node --test viewer/test/*.test.js` (known failure:
"a starter that loses the freed port registers through the new holder"; "global write lock"
is intermittent), and `npm --prefix viewer run test:browser` (known failure: "no drawn
arrow's line passes through either box it connects", Chromium and Firefox). Paste the
counts. Don't run `./install.sh`, don't touch the live services, `wc-*` tmux sessions or
`~/.local/state/wheelchair/`, never start a viewer on the default port, never call the real
`systemd-run` (shim it), and never delete files. Your sandbox can't write git metadata, so
leave the changes uncommitted; the lead commits them. If the same gate fails twice, stop and
report rather than iterating.

Deliverable: a report with the pasted test output, each gap mapped to its fix and test,
and: "List each decision you made that this brief did not settle, one line each, naming
the file or piece of the design it affected. Write 'none' if there were none."

### R5 — archived child pictures (Claude / Sonnet)

Objective: on an archived thread's drawn diagram (`viewer/index.html`, `?archive=<thread>&
file=<name>.json`, added by R3), opening a child graph shows the child. Today the page always
fetches the initial archived file, so the parent redraws (`viewer/index.html:469-483`). The
archived route (`GET /wheelchair/api/threads/:id/graph?file=`, `viewer/app/routes.js`)
already serves any file under the plan's `graphs/` from the branch. Navigation in archive
mode should request the navigated file, keep the breadcrumb back to the parent working, and
stay read-only (no `PUT`).

Test: extend R3's archived-diagram test in `viewer/test/app-threads.spec.js` with a
committed parent whose node opens a child. Open the child. The child's nodes draw, the
request names the child's file, the breadcrumb returns to the parent, and nothing is
written.

Ownership: `viewer/index.html` and `viewer/test/*.spec.js` only.

Validation: `npm --prefix viewer run test:browser` (known failure: "no drawn arrow"), and
`node --test viewer/test/*.test.js` (known: the port race). Paste the counts. Don't run
`./install.sh`, don't touch the live services, `wc-*` sessions or
`~/.local/state/wheelchair/`, never start a viewer on the default port, and never delete
files. Commit on your branch with a message ending `Co-Authored-By: Claude Opus 5.5
<noreply@anthropic.com>`.

Deliverable: commits, and a report with the pasted test output and: "List each decision
you made that this brief did not settle, one line each, naming the file or piece of the
design it affected. Write 'none' if there were none."
