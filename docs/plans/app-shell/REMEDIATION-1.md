# Remediation 1 — app-shell

Verification round 1 at commit 2738897. Two verifiers: Opus (Claude, fresh, cross-family
on the Terra tasks) and Sol (`gpt-6.1-sol`, thread `01a1dd51-d8d6-7942-9d49-0f7c06f2a8c3`,
cross-family on the Sonnet tasks and the lead's fixes). Both returned `VERDICT: FAIL`.

## Gaps, verbatim

### Opus

```
GAP: hook.sh posts turn-ended or prompt, spools if the service is down — spooled events have no thread_id; the real hub refuses them (404) and the service then stops draining the event spool for good, halting delivery on that machine — `machine/lib/hook-post.js:37` spools `{...event, session}`; `Hub.event()` on that payload → "404 thread not found", and with thread_id it is accepted; `machine/service.js:469` stops at the first refusal
GAP: Invalid card refused with the reason; cards relayed in order — a card the hub refuses (role not allowed, archived thread) is answered 202 to the agent and blocks every later card from the machine — demo: worker `done` card → `202 {"ok":true}`, hub 422; the valid `result` posted next never reached the hub; 2 files left in spool/cards (`service.js:600`, `:469`)
GAP: Commit mismatch shows "out of date" / no new sessions while out of date — both sides read the shared clone's current HEAD at request time, so a pull followed by restarting only one process is never detected — `machine/service.js:567`, `viewer/app/ready.js:9-26`; the test passes only because its fake machine reports a different version
GAP: Git goes through the service via `wc.js git` — every `--option` and the word after it are dropped, so `wc.js git pr --title … --body …`, `merge --no-ff <branch>` and `revert --no-edit <sha>` run with no arguments — `viewer/app/wc.js:39-46`; `gitRequest('pr',['--title','X','--body','b','--base','main'])` → `args: []`
GAP: Feature status / Features view — a stub thread's feature is never listed, even after it is opened and planned — `viewer/app/views.js:31` skips `thread.stub`; nothing ever clears it (`viewer/app/threads.js:65`, `:77-89`)
GAP: Edge cases: dead worker restarted in the same worktree and branch — no way to restart a worker in its worktree; each start cuts a new `wc-<id>-w<n>` branch, while `protocol/app/sub-lead.md:91-92` tells sub-leads to reuse it — `viewer/app/sessions.js:258-271`, `machine/service.js:193-196`; listed only as a known gap, not a deviation
GAP: Archive: rebase in progress keeps its worktree "with a needs item" — the hub stores the service's `kept` list but posts no needs card — `viewer/app/threads.js:127-135`; nothing in `viewer/` reads `kept`
GAP: Who may stop what ("only sessions its role started") — a restarted sub-lead can't stop workers its predecessor started — `viewer/app/sessions.js:277-279` matches the exact starter name, not the role
GAP: Views: terminal keystrokes go through as typed — `;` is dropped — `viewer/pages/terminal.js:40` returns `'\;'`, which is `';'`; on a private tmux server `send-keys -t probe ';'` exits 0 and types nothing while `a` came through
GAP: Views: attach command is `tmux attach -t <name>` on the hub — the hub shows the ssh form, because it checks for the name `hub` while the installer registers the hostname — `viewer/pages/sessions.js:13`, `install.sh` writes `hostname` into machines.json (acceptance bug 2: `hearth`)
```

### Sol

```
GAP: State persistence — concurrent updates overwrite acknowledged changes because atomic file replacement does not serialize thread transactions — viewer/app/state.js:74,80; viewer/app/cards.js:30,52; reproduction: two acknowledged card requests persisted only one card.
GAP: Queued message delivery — submission failure permanently loses the message and leaves the session marked busy — viewer/app/sessions.js:186-195 removes and saves the message before submitting; reproduction: service failure left queue=[] and turn_ended=false.
GAP: Machine-service restart / hook recovery — hooks spooled while the service is down lack the thread id and are forwarded without normal hook processing, blocking delivery — machine/lib/hook-post.js:36; machine/service.js:461-470; reproduction: hub returned “thread not found” and the event remained spooled.
GAP: Ordered durable card delivery — overlapping spool drains resend the same item, and the hub has no replay deduplication — machine/service.js:461,600,612; viewer/app/cards.js:39; reproduction: one spooled card generated two deliveries.
GAP: Invalid cards — role-invalid cards receive success at the agent endpoint and then block subsequent valid cards behind repeated hub refusals — machine/service.js:600; reproduction: agent received 202, hub repeatedly returned 422, and both cards remained pending.
GAP: Codex preflight before session starts — Codex leads and other sessions can start without running the required preflight — viewer/app/sessions.js:68-112; machine/service.js:236-267; reproduction recorded only /v1/status and /v1/sessions.
GAP: Running-version readiness gate — both sides compare the checkout’s current HEAD rather than the code version their processes loaded, so pulling without restarting can falsely report compatibility — machine/service.js:567; viewer/app/ready.js:9-25; reproduction changed the reported version without restarting the service object and outOfDate remained false.
GAP: Git operations through wc.js — long git/gh options are consumed and discarded, breaking normal push and pull-request commands — viewer/app/wc.js:38-57; reproduction: push --set-upstream origin wc/abc forwarded only ["wc/abc"], and pr --title/--body/--base forwarded [].
GAP: Branches and checkouts — new threads assume origin/main instead of using the project’s default branch — machine/service.js:205; viewer/app/sessions.js:96-112 never supplies or discovers default_branch.
GAP: Dead-worker recovery — a replacement worker receives a new branch/worktree and loses access to its predecessor’s committed partial work — machine/service.js:193-195; reproduction returned wc-abc-w1 followed by wc-abc-w2.
GAP: Sub-lead recovery — a replacement sub-lead cannot stop workers started by its predecessor — viewer/app/sessions.js:277-280 compares the exact starter session; reproduction returned 403 “only the starter may stop this session”.
GAP: Feature discovery and document links — a plan committed before its first discovery can remain invisible because an untracked branch falls back to comparing against HEAD itself — viewer/app/views.js:58-64; machine/service.js:210 creates branches with --no-track; the committed-plan test instead creates an upstream-tracking branch.
GAP: Features from opened stubs — opened stubs remain permanently excluded even after their lead creates a feature — viewer/app/threads.js:77-88 never clears stub; viewer/app/views.js:31 skips every stub; reproduction showed a live planning feature absent from Features.
GAP: Needs you across threads — small-fix and other threads without a discovered slug have all their needs omitted — viewer/app/views.js:31-42 calls addNeeds only after feature filtering; reproduction: one open “Sessions ended” card produced an empty strip.
GAP: Card resolution — a typed answer does not mark its question answered, and agent-raised needs have no resolution operation — viewer/app/routes.js:86-91; viewer/app/threads.js:171-203; viewer/app/cards.js:30-52; reproduction left the answered question’s answered flag false.
GAP: Messages during terminal-originated turns — starting a turn through the browser terminal does not mark the session busy, so app messages can be submitted before that turn ends — viewer/app/routes.js:119-134; viewer/app/sessions.js:181-195; reproduction submitted immediately after terminal Enter without a turn-end event.
GAP: Transcript preservation — partial JSONL lines are committed to the copy and their byte offsets advanced, so the completed line is split into unreadable fragments — machine/service.js:419-430; reproduction produced zero parseable records from one completed JSON record.
GAP: Transcript cleanup resilience — a missing original transcript prevents serving an existing preserved copy — machine/service.js:415,448; reproduction returned ENOENT despite the kept copy existing.
GAP: Codex human-turn filtering — task_started is accepted before turn_context, permitting injected user entries to appear as Collin’s messages — viewer/app/chat.js:154-167; repeated reproduction rendered “injected before context” alongside the actual human message.
GAP: Archive during rebase — retained worktrees do not produce the required needs item and the thread is silently archived — machine/service.js:390-392; viewer/app/threads.js:127-133; reproduction returned a kept rebase worktree with zero needs cards.
GAP: Fixes that miss a PR merge — explicit commit ids on a stub are discarded rather than carried to the new lead for cherry-picking — viewer/app/threads.js:62-87; reproduction preserved the summary but lost commits=["1234567"] from the child.
GAP: New diagrams inside threads — following the lead protocol skips graph registration, while posting a diagram card does not replace that registration step — protocol/app/lead.md:305-309; viewer/app/cards.js:39-52; viewer/server.js:1908-1909; repeated browser reproduction returned 403 not-registered inside the iframe.
GAP: Archived diagrams — diagrams become raw JSON links instead of remaining drawn, readable pictures — viewer/pages/thread.js:377-385; this contradicts the diagram-card behavior and the idea’s picture-in-thread intent.
GAP: Unreachable sessions — sessions vanish when the machine service is unreachable instead of remaining listed as unreachable — viewer/app/views.js:117-118; reproduction: one recorded session became zero displayed sessions.
GAP: Done-card follow-up actions — “Start a thread about it” exists only for left_as_is entries, although the Spec requires it for both lists — viewer/pages/thread.js:360-365 renders can_do entries as plain list items.
```

## Lead triage

The lead checked the wc.js flag parsing, the spooled event's missing `thread_id`, the
terminal `;` and the stub skip in Features against the code, and all four hold. Gaps the
two verifiers share are merged into one task item.

- **Declined, Card resolution (Sol).** The Spec defines no typed answer to a question and
  no way to close a `needs` card a lead raises. Cards close only by a press or by the
  hub's own stuck/prompt rules (Spec lines 318-331). Recorded as a follow-up in
  `acceptance-followups.md`.
- **Accepted although disclosed, Archived diagrams.** COMPLETION.md disclosed it, but it
  falls short of D49's "archived documents read from the branch" for pictures. Both
  verifiers read it, and Sol counts it as a gap.
- **Settled by Collin, wait-or-start.** Opus asked for a record of it, and D72 now holds
  his words. It is not a gap.
- **Added from Opus's non-gap findings, both cheap:** remove session tokens from
  `GET /wheelchair/api/sessions`, and check for the trust dialog every half second as the
  Spec says (it is every 2 s now).

## Tasks

Each task goes to the family that built the code it touches, at the same tier as round 1
with a sharper brief. Each runs in its own worktree. R1 and R2 share one contract, given in
both briefs.

| Task | Owns | Lane | Gaps |
|---|---|---|---|
| R1 | `machine/` | GPT / Terra | spool events, card intake, drain overlap, version, default branch, worker reuse, transcript partial lines and fallback, trust interval |
| R2 | `viewer/app/`, `viewer/test/app-*.test.js`, `viewer/test/helpers/app-machine.js` | GPT / Terra | state serialization, queue loss, delivery dedupe, Codex preflight, version, wc.js flags, worker restart, sub-lead stop, Features and Needs, untracked plans, unreachable sessions, terminal busy, rebase needs, stub commits, Codex filter, diagram registration, token leak |
| R3 | `viewer/pages/`, `viewer/test/*.spec.js`, read-only archived-diagram route in `viewer/app/` | Claude / Sonnet | terminal `;`, hub attach command, Done card buttons, archived diagrams drawn |

### Shared contract (R1 and R2)

1. **Delivery ids.** Every card and event the service sends to the hub carries
   `delivery_id`, a UUID fixed when the item is first accepted (the spool file name's
   UUID). The hub remembers the delivery ids per thread file (`delivered_ids`, the last
   500) and answers a repeat with `200 {"ok":true,"duplicate":true}` without applying it
   again.
2. **Card intake is synchronous when the hub answers.** `POST /v1/cards` from an agent
   forwards to the hub at once and returns the hub's status and body to the agent: 2xx is
   accepted, and 4xx comes back as the refusal with its reason. The card goes to the spool
   (and the agent gets `202 {"ok":true,"spooled":true}`) only when the hub gives no answer
   or 502/503/504. When a spooled card or event later gets a 4xx from the hub while
   draining, the service moves the file to `spool/rejected/<kind>/`, logs the reason, and
   carries on draining. It never deletes.
3. **Spooled hook events.** When the service drains `spool/events`, each item runs through
   the same handler a live hook post uses: it finds the session, adds `thread_id`, records
   the transcript, binds Codex and sets or clears the prompt flag, then forwards it.
4. **One drain at a time.** A drain already running makes a second call wait for it or skip
   it, never run beside it.
5. **Versions are boot-time.** The service reports in `/v1/status` the commit it read when
   the process started, as `version`. The hub compares that with the commit the viewer
   server read when it started (`state.code` in `viewer/server.js`, passed into the hub),
   not with the clone's HEAD now.
6. **Worker restart in place.** `wc.js session start --role worker ... --replaces <dead
   worker session>`. The hub checks that the named session is a worker in the same thread
   and isn't live, then sends the service `worktree` and `branch` taken from that
   session's record. For a worker start that carries both, when that worktree exists on
   disk, the service starts in it on that branch and cuts nothing new. If it doesn't exist,
   the service refuses with 400 and the reason.
7. **Default branch.** The service finds the project's default branch with `git
   symbolic-ref --short refs/remotes/origin/HEAD` after its fetch (stripping `origin/`).
   When that fails, it uses `git remote show origin`'s "HEAD branch", and `main` only when
   both fail. Every place that uses `origin/main` today uses it instead.

### R1 — machine service (GPT / Terra)

Objective: close these gaps in `machine/`. Verify each one with a test that would have
failed before the fix.
- Spooled hook events follow contract 3: `machine/lib/hook-post.js:36`,
  `machine/service.js:461-470`.
- Card intake follows contract 2, and a refused item no longer blocks the spool:
  `service.js:600`, `:469`.
- Delivery ids (contract 1) on every forwarded card and event.
- One drain at a time (contract 4): `service.js:461`, `:612`.
- Boot-time `version` (contract 5): `service.js:567`.
- Default branch (contract 7): `service.js:205` and any other `origin/main`.
- Worker restart in place (contract 6): `service.js:193-196`.
- Transcript copy takes only whole lines. Bytes after the last newline are left for the
  next read and the offset isn't advanced past them: `service.js:419-430`.
- Serving a transcript works when the original is gone but the kept copy exists:
  `service.js:415`, `:448`.
- The Claude trust dialog is checked every 500 ms for up to 30 s, per the Spec. The
  2-second checks stay for stuck sessions and open prompts.

Ownership: `machine/` only. Change nothing else.

The fake hub in `machine/test/` has to refuse what the real hub refuses: an event without
`thread_id` gets 404, and a card from a role not allowed to post its kind gets 422 (read
`viewer/app/cards.js` and `viewer/app/hub.js` for the rules). Round 1's bugs passed
because the fake accepted anything. Update `machine/API.md` for each changed route and
field.

Validation: `bash machine/test/run.sh` (paste the counts), and `node --test
viewer/test/*.test.js` to show nothing else broke. One known failure there, "a starter
that loses the freed port registers through the new holder"; the "global write lock"
test sometimes fails too. Don't run `./install.sh`, don't touch the live
`wheelchair-machine`/`wheelchair-viewer` services, `wc-*` tmux sessions or
`~/.local/state/wheelchair/`, and never delete files (no `rm`; move instead). If the same
gate fails twice, stop and report rather than iterating. Commit your work on your branch
with a message ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

Deliverable: commits on your branch. A report with the pasted test output and each gap
mapped to its fix and test. Then: "List each decision you made that this brief did not
settle, one line each, naming the file or piece of the design it affected. Write 'none'
if there were none."

### R2 — hub (GPT / Terra)

Objective: close these gaps in the hub (`viewer/app/`). Verify each one with a test that
would have failed before the fix.
- **State serialization.** Every read-modify-write of a thread file (and `machines.json`,
  `projects.json`) goes through a per-file queue in `viewer/app/state.js`, so two
  concurrent updates both land. Today two acknowledged cards persist only one
  (`state.js:74,80`, `cards.js:30,52`).
- **Queue loss.** `sessions.js:186-195` takes the message off the queue only after the
  service accepted the submit. On failure the message stays first in the queue and the
  session stays not-busy.
- **Delivery ids** (contract 1) in `cards.js` and the events handler.
- **Codex preflight.** Before any Codex session starts (lead or agent-requested), the hub
  calls the machine's `POST /v1/preflight`. A non-2xx answer refuses the start with
  "Codex preflight failed: <its output>" and, for a lead, posts a `needs` card on the
  thread (`sessions.js:68-112`).
- **Boot-time versions** (contract 5): `ready.js:9-26`.
- **wc.js flags.** `wc.js git <op> ...` passes every argument after the operation through
  unchanged, so `--title X`, `--no-ff` and `--set-upstream` reach git. Only `commit`'s
  `-m <message>` is still read out as the message. `wc.js session ...` keeps its own
  `--role/--cli/--tier/--brief-file/--attempt/--replaces` options (`wc.js:39-57`).
- **Worker restart in place** (contract 6), the hub side: `sessions.js:258-271`.
- **Stop by role.** A session may stop a session whose starter had the same role in the
  same thread, not only that exact session (`sessions.js:277-280`). The lead and sub-lead
  rules in the Spec ("Who may start what") are unchanged.
- **Features from opened stubs.** A stub that has been opened (its lead started) is
  listed in Features once its slug is found. `views.js:31` skips only unopened stubs.
- **Needs from every thread.** `addNeeds` runs for every non-archived thread, with or
  without a slug (`views.js:31-42`).
- **Plans on an untracked branch.** Discovery finds a plan committed on the thread's branch
  whether or not the branch has an upstream: compare against `origin/<default branch>`
  (the default branch is stored on the thread, so it can be added to the thread record
  from the service's session-start response), not against HEAD (`views.js:58-64`). The
  test uses a `--no-track` branch, as the service makes.
- **Unreachable sessions.** When a machine's service doesn't answer, the Sessions view
  lists that machine's recorded sessions with state `unreachable` rather than dropping
  them (`views.js:117-118`, D27).
- **Terminal turns.** When the browser terminal sends `Enter` (or `C-m`) to a session, the
  hub marks it busy (`turn_ended: false`) until its next turn-end event
  (`routes.js:119-134`).
- **Rebase kept on archive.** For each entry in the archive response's `kept` that is
  mid-rebase, the hub posts a `needs` card on the thread naming the worktree and what to do
  ("finish or abort the rebase in <path>, then archive again"). The
  archive isn't recorded as complete while such a worktree is kept
  (`threads.js:127-135`).
- **Stub commits.** A `stub` card's `commits` list is saved on the child thread and put
  into the new lead's `[wc:context stub]` message (`threads.js:62-87`).
- **Codex human turns.** In `chat.js:154-167`, a Codex user entry counts as Collin's only
  after that turn's `turn_context`. A `task_started` before it doesn't open a human turn.
- **Diagrams in threads.** When a `diagram` card arrives, the hub registers that thread's
  plan directory with the viewer (the same registration `--register-plan` does, called in
  process) before storing the card, so the iframe stops getting `403 not registered`
  (`cards.js:39-52`, `viewer/server.js:1908-1909`). Put one line in
  `protocol/app/lead.md`'s Diagrams section saying the card alone is enough.
- **No tokens in the browser.** `GET /wheelchair/api/sessions` strips `token` from every
  session, as the thread routes already do.

Ownership: `viewer/app/` (not `viewer/app/` files R3 adds), `viewer/test/app-*.test.js`,
`viewer/test/helpers/app-machine.js`, and the single line in `protocol/app/lead.md`.
Don't touch `viewer/pages/` or `machine/`. R1 changes the service to the shared contract at
the same time, so make the fake machine in `helpers/app-machine.js` follow the contract.

Validation: `node --test viewer/test/*.test.js` (paste the counts; the same known
failures as in R1), and `npm --prefix viewer run test:browser` (known failure: "no drawn
arrow's line passes through either box it connects", Chromium and Firefox). Don't run
`./install.sh`, don't touch the live services, `wc-*` tmux sessions or
`~/.local/state/wheelchair/`, never start a viewer on the default port, and never delete
files (no `rm`). If the same gate fails twice, stop and report rather than iterating.
Commit on your branch with a message ending `Co-Authored-By: Claude Opus 5.5
<noreply@anthropic.com>`.

Deliverable: commits on your branch, and a report with the pasted test output, each gap
mapped to its fix and test, and: "List each decision you made that this brief did not
settle, one line each, naming the file or piece of the design it affected. Write 'none'
if there were none."

### R3 — pages (Claude / Sonnet)

Objective: close these gaps. Verify each one with a test that would have failed before
the fix.
- **Terminal `;`.** `viewer/pages/terminal.js:40` sends `'\;'`, which is just `;`, and tmux
  `send-keys` swallows a lone `;`. Send `;` so it arrives as typed: `\\;` (the string
  backslash-semicolon) if the hub hands keys to `tmux send-keys` as separate arguments.
  Check the hub's keys route to choose, and prove it in a test that runs a real tmux on a
  private socket (`tmux -L <name>`). Never touch the default server.
- **Hub attach command.** `viewer/pages/sessions.js:13` decides "hub" by the machine
  name, but the installer registers the hub under its hostname. Use a `hub: true` field.
  If `/wheelchair/api/sessions` or `/api/machines` don't carry it, add that one field in
  `viewer/app/views.js` (or wherever that response is built), marking the registry entry
  that `resolveMachine` maps "hub" to (`viewer/app/state.js`). Show `tmux attach -t
  <name>` for hub sessions and the ssh form for others.
- **Done card.** "Start a thread about it" appears on every `can_do` entry as well as
  every `left_as_is` entry, sending the same press form
  (`viewer/pages/thread.js:360-365`).
- **Archived diagrams drawn.** On an archived thread a diagram card shows the drawn graph,
  read-only, read from the branch the way archived documents are (`git show`), not a
  raw-JSON link (`viewer/pages/thread.js:377-385`). Reuse the graph page
  (`viewer/index.html`) with a read-only source if it can take one. Otherwise add the
  smallest route that serves the archived graph JSON to it. Moving boxes on an archived
  picture is never saved.

Ownership: `viewer/pages/`, `viewer/test/*.spec.js`, the one field in the views response,
and, for archived diagrams only, the smallest read-only route in `viewer/app/` and
`viewer/index.html`. Another lane is changing `viewer/app/` at the same time: keep your
`viewer/app/` edits to those few lines.

Validation: `npm --prefix viewer run test:browser` (paste the counts; known failure: "no
drawn arrow's line passes through either box it connects", Chromium and Firefox), and
`node --test viewer/test/*.test.js` (known failure: "a starter that loses the freed port
registers through the new holder"; "global write lock" is intermittent). Don't run
`./install.sh`, don't touch the live services, `wc-*` tmux sessions or
`~/.local/state/wheelchair/`, never start a viewer on the default port, and never delete
files: no `rm`, no `git clean`, no `git worktree remove`. Commit on your branch with a
message ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

Deliverable: commits on your branch, and a report with the pasted test output, each gap
mapped to its fix and test, and: "List each decision you made that this brief did not
settle, one line each, naming the file or piece of the design it affected. Write 'none'
if there were none."
