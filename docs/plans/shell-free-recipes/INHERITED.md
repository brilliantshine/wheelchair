---
slug: shell-free-recipes
kind: inherited-material
---

# What the windows-support plan already established about this work

This is **not** an approved design. It is the material four review rounds produced while
this work was still inside `docs/plans/windows-support/`, carried over so nothing is
relearned. Every design decision below drew at least one review finding and several were
superseded twice; treat them as evidence and as a list of traps, not as settled.

Stage 1 for this plan still starts with its own map.

## Not inherited: two helpers that stayed behind

**This plan does not own the path conversion or the destination resolution.** Two places below say
otherwise and are superseded, not deleted, because later decisions dereference them: the carried
Spec prose assigning both to `shell/`, and decision D38 in the table. Both stayed in
`windows-support` and live in `install/` there.

## The Spec sections as they stood when the split happened

### The per-turn recipes become single commands

No rule document contains shell syntax for these two flows any more. The wrapping moves into
the programs the documents already call, and the documents call them in one line.

**The viewer's server gains three things.**

**`--open` is unchanged** — same behaviour, same callers, same tests. The first start against a
cache root becomes the server and blocks; every later one prints the URL and exits. Five places
in the suite depend on that arrangement, two by injecting `--require` into the server process to
freeze the lockfile-claim window, which no re-spawning design can preserve.

**`--start <path>` is new**, and is what the recipes call. It registers the path exactly as
`--open` does, spawns `--open` as a detached child, waits until the server answers `/whoami`,
then prints the URL and returns — always returning and always printing, whether it started the
server or found one already running.

This is a supervisor over the same implementation, not a second one: one server, one lockfile
protocol, two entry points, where the outer exists to remove the ambiguity the inner has. The
wait is also the readiness contract — `--start` does not return until a request would be
answered, so the `--write` that follows it cannot race the server it just asked for.

**When `--start` cannot deliver a server** it says so and exits non-zero, rather than returning
a URL nothing answers. It waits a bounded time for `/whoami`; if the detached child exits first,
if the wait elapses, or if `startServer` refuses a lockfile owned by another live process
(`viewer/server.js:1472`), it reports which of those happened and surfaces the child's output.
The recipe it replaces did this by printing the log it had been polling, and that diagnostic must
not be lost — a start that fails silently is worse than one that hangs, because the write that
follows fails somewhere unrelated.

`--stop` is unchanged. `--show` is unchanged except that it now reports a browser launch it could
not hand off. **That change stayed with `windows-support` and is not described here** — this
sentence is carried-over Spec prose whose subject did not come with it.

`--write <file> --path <target> --hash <hash>` performs the write the recipe does with `curl`
today, reading port and token from the lockfile itself and printing the new hash. The file holds
**the graph alone**, not the request body — the body's `hash` field arrives as its own flag,
because that is the one part an agent must carry between calls and burying it inside the file
invites sending a stale one. An empty `--hash ""` means "create". It honours the hash rules already in `protocol/graphs.md` — an empty hash creates, a
mismatch returns the current hash — and reports a refusal by its existing name, so that
document's list of refusals stays accurate.

`--read --path <target>` prints what the read route returns.

One constraint the route did not previously have to carry: every `GET /graph` marks the path
watched (`viewer/server.js:1326`), because a page polling that route once a second is what tells
`--show` a tab is already open, and `--show` declines to launch when it sees one (`:1559`). An
agent reading a graph back would therefore suppress its own browser launch. The page is what should be
marking itself, so the page marks itself: `viewer/index.html`'s poll sends a header naming itself
a page, and the route updates the timestamp only for reads carrying it. `--read` sends nothing and
therefore marks nothing, and so does any other non-page client that appears later. Opting the page
in is correct where opting `--read` out would leave the next client to rediscover this;
`viewer/index.html` is named here because it is the only Spec item that touches it. Without
this, a recipe that reads before showing silently opens nothing — the exact failure this plan
already exists to fix, reintroduced by its own new subcommand.

Between them these remove both `curl` calls and both `node -e` invocations. The routes
themselves are unchanged, still token-guarded and still bound to `127.0.0.1`; the subcommands
are clients of the same routes, not a second way in.

**A lane runner at `lanes/run.js`** wraps `codex exec`. One requirement beyond the mechanics,
stated concretely because the earlier wording was not implementable.

The `--json` stream emits one `item.completed` per `command_execution`, carrying `command`,
`exit_code` and `aggregated_output`. The runner summarises those into its result: how many
commands ran, and how many exited zero while producing no output at all. It does not attempt to
correlate the model's prose against individual commands — there is no mapping from one to the
other, and a rule that flagged every silent command would fire on every `mkdir`.

What the count is for: a lane that reports success having run no commands, or only silent ones,
is a report with nothing observable behind it, and the stage reading the result can say so.
This is a signal for the lead, not a verdict the runner reaches on its own. The C7 rerun
motivated it but does not prove it — the same run's other probe printed output normally, so a
capture artifact is at least as likely an explanation there as a fabricated claim. The counting
is worth having either way; the fabrication reading is not load-bearing.

It takes the model, the reasoning effort, the sandbox mode, whether network access is
needed, the working directory, and a file holding the brief; it creates whatever temporary files it needs, detects the credentials slot
the shell recipe checks for today, runs the lane, recovers the session identifier from the
event stream, and prints one JSON object carrying the exit status, the session identifier, where
the report was written, the silent-command count above, and **the exact `codex exec` command it
ran**. That last field is not decoration: `IDEA.md:49` asks that a person can see the command
that did it, and `protocol/lanes.md:9-10` gives inspectability as the reason this workflow is
built on `codex exec` rather than any other runtime. A wrapper that hides the invocation would
take that away, which is the one thing the move must not cost.

**The result file is written before the lane finishes, not after.** As soon as the session
identifier appears in the event stream, the runner writes its result file — session identifier,
the exact command, the report path — and updates it on completion. It prints that path on
startup as well as returning the full object at the end. Without this, a caller that times out
loses the very handle the runner exists to preserve: the lane survives, and nobody can find it.
That is the failure the detached spawn was added to prevent, and it would have been reintroduced
one paragraph later.

**Running several at once.** The runner blocks by default. `--no-wait` returns as soon as the
result file exists, so a stage can start several lanes and then wait on their files — which is
what backgrounding bought and what `protocol/plan-review.md:37` needs when it launches a
cross-family pair in parallel. Deleting the shell backgrounding without this would have made
every stage that runs two lanes sequential.

**Exit status.** The runner's own process exits zero whenever it successfully ran a lane, even a
lane that failed; the lane's status is the `exit_code` field in the JSON. The runner exits
non-zero only when it could not run one at all — bad arguments, no `codex` on the path, an
unreadable brief. Otherwise a stage cannot distinguish "the lane reported a failure" from "the
runner broke", which `protocol/lanes.md:152-158` treats as different things. A resume mode takes a session identifier and a follow-up,
repeating every `-c` override as `protocol/lanes.md` already requires.

`lanes/` is a new top-level directory and gets a router, like every other directory here that
owns something. It holds the lane runner and nothing else, so it stays the
`protocol/lanes.md` ↔ `lanes/` pairing that justified it. Its router says plainly that the rules
for dispatching a lane live in `protocol/lanes.md` and that nothing here is guidance.

The three helpers this change also creates do **not** go there — a directory named for lanes that
owns a Git Bash locator is exactly the drift `/spine` exists to correct. They share a different
concern: reaching a POSIX shell from anywhere, and translating paths for it. That is `shell/`, a
second new directory with its own router, holding the Git Bash locator (used by the `.cmd` and by
the script shim), the shim itself, and the path conversion both renderers call. The destination
resolution — the one routine answering "does this land where the tool looks", today duplicated at
`install.sh:20-21` and `sensitivity/set.sh:10-11` — lives there too, for the same reason: it is
shell-facing, shared, and belongs to neither caller.

**The runner must outlive the call that started it.** `protocol/lanes.md:94` says to run lanes
in a background call so a foreground timeout cannot kill them, and that reason survives the
move: a lane is long, and the harness that invoked the runner may time out first. So the runner
spawns `codex exec` detached and does not die with its caller — a caller that goes away leaves
the lane running and its report file still arriving. This is the one thing backgrounding was
buying, and it moves into the runner rather than being deleted with the syntax that expressed
it.

**The backgrounding instruction moves.** `protocol/implementation.md:76` tells a stage to "run
each lane as a background Bash call and collect the `-o` files as they finish", and
`protocol/lanes.md:94` repeats it. Both are shell syntax PowerShell does not share, and after
this change the runner owns `codex exec`, the `-o` file and the blocking. So the runner returns
when its lane is done and a stage runs several by invoking it several times. `lanes.md:94` loses
the backgrounding sentence, since the runner now owns that guarantee; `implementation.md` loses
its dispatch sentence and points at `lanes.md`, which keeps the one description of how a lane is
dispatched. `implementation.md:77-80`'s rule — parallelize only disjoint ownership boundaries,
and only across worktrees — is about *what may run at once*, not about how a lane is launched,
so it stays exactly where it is. That is `CONTRIBUTING.md`'s existing rule that lane commands live only
in `protocol/lanes.md`, honoured rather than newly created.

**What does not change:** which flags a lane passes, what the routes do, the graph format, the
verdict rules, and every stage document that names these flows without spelling out a command.


### Every command an agent runs, not just two of them

Scoping "the per-turn recipes" to `protocol/lanes.md` and `protocol/graphs.md` missed two more.
`protocol/sensitivity.md:101` and `:102` tell an agent to run `sensitivity/set.sh`, and
`protocol/spine.md:20` to run `spine/scan.sh`. Under PowerShell neither runs, so
`/diagram-sensitivity` and `/spine` stay broken while the idea promises every command works.

Those two scripts stay shell — porting them is not this change, and Git Bash is already
required. What they need is an invocation that works from any shell. Falling back to `bash
<script>` is not it: on the machine checked, `bash` on the Windows path resolves to the WSL
launcher rather than Git's, so that would run the script in an entirely different operating
system.

So one small Node shim locates Git Bash by absolute path and runs a repo script through it, and
the two protocol files call it the way `graphs.md` calls the viewer — one command, no shell
syntax. Node is already required; nothing new is added to the dependency list.

**The same locator serves the `.cmd` entry point**, which has to answer the identical question
before it can hand off. One implementation, two callers, and it lives beside the lane runner.


### Rewriting `protocol/graphs.md`

The largest single piece of writing in this change, and the one with the worst failure mode:
that file is the only thing an agent reads before its first graph write, so a wrong command
block means no picture ever reaches a screen.

Every shell block in the producer sequence is replaced by the corresponding single command:
the root-setting block (`:415-417`), the start-and-poll block (`:430-443`), the lockfile read
(`:463`), the path encoding and `curl` write (`:473-484`), the `--show` line (`:510`), and the
`curl` read-back (`:552`).

The root block is the one that is easy to miss, because it is not a pipeline: it sets
`$WHEELCHAIR` from the path the agent read the file at, and the surviving commands interpolate
it. A shell variable is shell syntax, so the replacement is to say it in prose — the agent knows
the absolute path it read this file at, and writes it into the command it types. The same
applies wherever `$GRAPH_PATH` or `$PWD` appears. `protocol/lanes.md` has no equivalent block,
so its commands must name the runner by absolute path on the same terms. The prose around them —
the schema, the verdict rules, the preservation contract, containment, what the server
refuses — is unchanged except where it names a mechanism that no longer exists.

Two facts the current text teaches implicitly must survive explicitly, because the commands
that taught them are gone: that the first `--open` against a cache root is what makes a path
writable at all, and that `--show` is a separate later step because `--open` runs before the
graph exists.


## Decisions that belonged to this half

Carried over verbatim. Several supersede each other; the chain is part of the evidence.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D38 | `lanes/` holds the lane runner only. A new `shell/` owns the Git Bash locator, the script shim, the path conversion and the destination resolution | Those four share a concern — reaching a POSIX shell from anywhere and translating paths for it — and none of them is a lane. A directory named for lanes owning a Git Bash locator is the drift `/spine` exists to correct. Review round 3, H6 and H10. | review-round-3 |
| D37 | The runner writes its result file as soon as the session identifier appears, prints that path on startup, and takes `--no-wait` | A detached lane whose handle is only printed on return is a lane nobody can recover, which is what the detachment was for. `--no-wait` restores the concurrency that deleting shell backgrounding removed, which `protocol/plan-review.md:37` requires. Review round 3, H4 and H5. | review-round-3 |
| D34 | `--open` keeps its exact behaviour and callers. A new `--start <path>` registers the path, spawns `--open` detached, waits for `/whoami`, prints the URL and returns. Supersedes D32, D13 and D33 | Five sites depend on the launched process being the server and two inject `--require` into it, which cannot survive re-spawning; repairing those means plumbing injection through the launcher — production code whose only consumer is a test. `--start` supervises the same implementation rather than duplicating it, and its wait supplies the readiness contract G11 asked for. Review round 2, G1. | user |
| D33 | The test helper is rewritten to read the server's pid from the lockfile, and that rewrite is in scope for this change | It spawns `--open` and treats that child as the server (`viewer/test/helpers/server.js:88`, `:97`), and one test asserts the lockfile pid equals it (`viewer/test/server.test.js:1094`). The lockfile is where that pid is already written and what the rest of the code trusts. Review round 1, F2. | review-round-1 |
| D32 | `--open` starts detached and returns; `IDEA.md`'s Linux constraint is amended to cover what is observable rather than how processes are arranged | Proposed explicitly and agreed. The URL, the server and `--stop` are unchanged; what changes is that the command returns and the process holding the port is not the one launched. Nobody depends on the hang — the recipe works around it, which is the defect. Supersedes D13's reasoning, keeps its choice. Review round 1, F3. | user |
| D28 | `protocol/implementation.md` loses its backgrounding sentence; dispatch is described only in `protocol/lanes.md` | Backgrounding is shell syntax PowerShell does not share, and after the runner owns blocking there is nothing to background. `CONTRIBUTING.md` already says lane commands live in one file. Review round 1, F5. | review-round-1 |
| D26 | The runner counts commands that exited zero with no output and reports the count; it does not try to match model prose to commands | The `--json` stream carries `exit_code` and `aggregated_output` per `command_execution`, so counting is well-defined where correlation is not. Supersedes D23, whose rule had no implementable mapping and rested on a single ambiguous transcript. Review round 1, F4 and F17. | review-round-1 |
| D23 | The lane runner treats a lane's own claim of success as unverified when its transcript carries no output for the step it is describing | Observed in the C7 rerun: a probe's tool transcript showed `succeeded in 8ms:` with nothing after it, while the model's prose reported `ok`. That is the exact shape of the failure this workflow already guards — a confident report with nothing behind it — surfacing in the stream the runner will parse. | defaulted |
| D12 | The shell wrapping around both per-turn recipes moves into the programs those recipes already call: the viewer's server gains detached start, graph write and graph read; a new lane runner wraps `codex exec`. Each recipe in a rule document becomes one command with no shell syntax | Deleting the wrapping instead would cost resume, which the remediation loop is built on; doing only the picture flow leaves the four stages that delegate broken on Windows. The `curl` calls were the deciding evidence — PowerShell aliases `curl` to a different command, so those lines fail looking like a network fault. | user |
| D13 | `--open` starts detached and returns, rather than blocking when it is the first starter. The old blocking mode is removed, not kept alongside | A flag that sometimes blocks and sometimes does not is exactly why the recipe had to poll a log. Keeping both would be a dual path maintained for nothing, since no document would use the blocking one. Observable behaviour is unchanged — the URL still prints, `--stop` still stops it. | defaulted |
| D14 | The lane runner lives in a new top-level `lanes/` directory with its own router | The repo's layout rule gives every directory that owns something a router saying what it owns and where to go next. A new executable directory without one is the drift `/spine` exists to fix. | defaulted |

## Review findings against this half, from the windows-support rounds

All were upheld. Most were still open when the split happened, and they are the reason it happened.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| both | major | **I2** The documentation sweep names only `lanes/`; D38 also creates `shell/`, and `sensitivity/AGENTS.md:3` keeps ownership of a routine that moved out | upheld | Held for the escalation |
| both | major | **I3** A stale round-3 sentence still puts the Git Bash locator "beside the lane runner", contradicting D38 in the same Spec | upheld | Held for the escalation |
| intent | major | **I4** The single locator cannot serve both its callers: the `.cmd` runs where no POSIX shell exists, so a bash helper is uncallable from it, while a Node helper reintroduces D9's failure since Node is only established inside the installer | upheld | A real design fault, not a wording slip. Held for the escalation |
| intent | major | **I5** The page-marker fix breaks a green Linux test the Spec does not name: `viewer/test/server.test.js:1000-1004` marks a graph watched with a plain `GET` and asserts a second `--show` opens nothing | upheld | Checked at source. Held for the escalation |
| both | major | **I6** `--no-wait` restores concurrency with no join step and no completion lifecycle — the runner must exit while still owing an updated result file, and no subcommand waits on one | upheld | Held for the escalation |
| both | blocking | **H1** Validation still demanded a detached `--open` that returns, which the Spec now forbids — an impossible test | upheld | Checked. D34 rewrote the Spec section and not its Validation bullet; the bullet now covers `--start` and leaves `--open`'s tests alone |
| mechanics | major | **H3** `--start` has no bounded wait or failure contract; the recipe it replaces printed the log it had been polling | upheld | A failure contract added: bounded wait, names which failure occurred, surfaces the child's output, exits non-zero |
| both | major | **H4** The runner's detached spawn preserves the lane but not its handle: the session identifier and command exist only in the JSON printed on return, so a killed caller loses them | upheld | The result file is now written as soon as the session identifier appears, and its path printed on startup. D37 |
| intent | major | **H5** Deleting backgrounding removed the only stated way to run lanes concurrently, which `protocol/plan-review.md:37` requires | upheld | `--no-wait` returns once the result file exists, so a stage can start several and wait on their files. D37 |
| intent | major | **H6** Putting a Git Bash locator in `lanes/` makes that router false and recreates the drift `/spine` exists to fix | upheld | Checked. `lanes/` holds the runner only; a new `shell/` owns the locator, the shim, the path conversion and the destination resolution, with its own router. D38 |
| mechanics | minor | **H11** Runner validation asserts neither the exact-command field nor the runner-level non-zero cases | upheld | Both added, plus a kill-mid-lane case for the result file |
| intent | minor | **H12** "`--show` and `--stop` are unchanged" contradicts the browser section two sections later | upheld | Reworded to say what actually changes |
| intent | minor | **H13** The `--read` fix was ambiguous about who marks a read as a page's, and one reading needed an unnamed `viewer/index.html` change | upheld | The page marks itself, `viewer/index.html` is named, and any future non-page client inherits the correct default |
| intent | minor | **H14** The new subcommands' cache-root and port handling is unstated while Validation requires coverage | upheld | They take `--port` and `--cache-root` like every other entry point, as the root router requires |
| intent | blocking | **G1** The `--open` detach fix is materially incomplete. Four further sites depend on the spawned process *being* the server, and one class cannot be repaired by a pid lookup at all: `viewer/test/server.test.js:1042-1045` asserts one racer stays alive and one exits; `:1058-1059` SIGKILLs `first.child` to manufacture a stale lock; `spawnHookedServer` at `:176-181` injects `--require` into the `--open` process so the hook at `:147-165` can freeze the lockfile-claim window, and `--require` does not reach a re-spawned child | upheld | Checked, all four. Reopens the decision — see Q1. The lead's Q1 framing was wrong on this point and the user agreed on it |
| mechanics | blocking | **G5** Backgrounding exists so a foreground timeout cannot kill a lane (`protocol/lanes.md:94`); D28 deletes it and makes the runner blocking without preserving that protection | upheld | Checked. The runner must outlive its caller, which the Spec never says |
| mechanics | major | **G6** The `graphs.md` rewrite omits the `WHEELCHAIR=<root>` block at `:415-417`, and the surviving `--show` line at `:510` interpolates two shell variables; nothing says how a single-command recipe names an absolute path under PowerShell | upheld | Checked |
| intent | major | **G7** The runner's output does not satisfy `IDEA.md:49`, "the person can see the command that did it", and `protocol/lanes.md:9-10` gives inspectability as the reason this workflow uses `codex exec` at all | upheld | The runner must surface the command it ran |
| intent | major | **G9** D28 removes the dispatch mechanism but leaves `protocol/implementation.md:77-80`'s worktree rule depending on it, and never says whether `protocol/lanes.md:94` survives | upheld | Resolved together with G5 |
| intent | major | **G10** Two fixes each require "one shared thing used by both scripts" and neither says where it lives, in a repo whose rule is that anything owning something carries a router | upheld | Needs a home and a router line |
| mechanics | major | **G11** Detached `--open` has no readiness contract: the URL is printed after `listen` today, but a launcher could return before the detached server accepts the write that follows | upheld | Folded into Q1 — the answer changes what this needs |
| mechanics | major | **G13** The runner contract does not say whether its process propagates a lane's non-zero exit or always exits zero with the status in JSON | upheld | Specified |
| both | blocking | **F4** D23's "report the step as unverified" is not implementable as written — no defined mapping from model prose to exec events, and the cited evidence is a non-`--json` human transcript | downgraded to major | Checked the real `--json` stream: each `command_execution` item carries `aggregated_output` and `exit_code`, so a concrete rule *is* specifiable — the defect is an unspecified mechanism, not an impossible one. Spec now states the rule. D26 |
| both | blocking / major | **F5** `protocol/implementation.md:76` spells out a background Bash call and `protocol/lanes.md:94` repeats it, so Stage 3 stays broken under PowerShell; the Spec claimed stage documents need no change | upheld at blocking | Checked both lines. Spec's documentation section now names `implementation.md`, and the backgrounding instruction moves to the runner |
| mechanics | minor | **F19** `--write` does not define whether the file holds the request body or the graph alone | upheld | Specified |

## Three more findings that belong here

Missed in the first carry-over; they are the ones whose *subject* moved while their row stayed.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | major | **H9** Nothing validates the cross-shell shim: the suites invoke the scripts directly and acceptance never runs either command through it | upheld | Acceptance now runs `/diagram-sensitivity` and `/spine` from a Codex session |
| mechanics | blocking | **G3** `/diagram-sensitivity` and `/spine` still tell an agent to run a `.sh` directly — `protocol/sensitivity.md:101`, `:103`, `protocol/spine.md:20` — so two of the eight commands stay broken under PowerShell | upheld | Checked. A real scoping hole: "the per-turn recipes" was drawn around `lanes.md` and `graphs.md` only, and never asked which other protocol files spell out a command |
| mechanics | major | **F13** The lane-runner suite proves three cases and leaves argument forwarding, slot selection, resume and repeated `-c` overrides unproven | upheld | Validation extended |

## Validation this half had earned, and lost in the move

The windows-support plan deleted these when it deleted their subject. They are requirements
review already upheld, not a fresh wish list, and the second plan should not rediscover them.

- Server suite coverage for `--start`: that it returns while leaving a server running, that it
  prints a URL carrying port and token, that a second `--start` against a live server returns the
  same URL without starting a second, and that a write issued the instant it returns succeeds.
  `--open`'s own blocking behaviour keeps every test it has today.
- `--start` failing loudly: the detached child unable to bind, and the wait elapsing — each
  exiting non-zero and naming which happened rather than printing a URL nothing answers.
- Server suite coverage for `--write` and `--read`: a create against an absent file with an empty
  hash, a write against a stale hash returning the current one, and a refusal reported by its
  documented name. Both take `--port` and `--cache-root`, which the root router makes the
  condition for checking the viewer at all.
- `--read` not suppressing a subsequent `--show`, and the existing test at
  `viewer/test/server.test.js:1000-1004` — which marks a graph watched with a plain read — kept
  green by whatever mechanism replaces it.
- A lane runner suite running the real thing against a stub standing in for `codex` at the process
  boundary, not a faked internal seam: a lane exiting non-zero; an empty report file; a session
  identifier recovered from the event stream; every argument reaching the stub unmangled,
  including a brief with spaces, quotes and a non-ASCII character; the credentials slot used when
  present and unset when absent; the printed JSON naming the report path, the exact command, and
  the silent-command count; a resume repeating every `-c` override; the result file existing
  before the lane completes, proved by killing the runner mid-lane; `--no-wait` returning with the
  lane still running; and the runner exiting non-zero on bad arguments, missing `codex`, and an
  unreadable brief, distinctly from a lane that ran and failed.
- The cross-shell shim invoked from a non-bash shell, and `/diagram-sensitivity` and `/spine` both
  running to completion from a Codex session on Windows — the only place the shim is exercised at
  all, since running the underlying scripts directly proves nothing about it.

## Known-unresolved design problems

Carried as problems, not solutions. Each drew a finding that the split dissolved by removing its
subject rather than by answering it.

- **`--no-wait` has no join step.** Concurrency was restored without any way to wait on a result,
  and the shell polling that used to do it is what this work deletes. `protocol/plan-review.md:37`
  needs several lanes collected.
- **One Git Bash locator cannot serve both callers.** The `.cmd` runs where no POSIX shell exists,
  so a bash helper is uncallable from it, while a Node helper cannot be the installer's first step.
  Two implementations in two languages may simply be correct; the windows-support plan now owns
  the batch one.
- **A detached runner owes a result file after it exits.** Writing the handle early solves
  recovery but leaves the question of who updates the file with the final status.
