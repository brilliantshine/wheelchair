---
slug: windows-support
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-08-31
---

# Windows support for both harnesses

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

None. All five settled; see the Decision Log.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| W1 | mapping | Which shell Codex actually gives an agent on native Windows. | yes | settled — became check C1 |
| W2 | mapping | Whether `command -v claude` resolves `claude.exe` under Git Bash (`install.sh:28-29`). | no | settled — became check C3 |
| W3 | mapping | Whether `npm --prefix "$ROOT/viewer"` survives MSYS path translation (`install.sh:73-74`). | no | settled — became check C4 |
| W4 | mapping | Whether Playwright's pinned Chromium download completes unattended on Windows (`install.sh:74`). | no | settled — became check C5 |
| W5 | queue-building | The line-ending rule has to cover `.json`, not just scripts: graph files are byte-canonical and compared by hash (`viewer/server.js` canonical form), so a CRLF checkout would make every stored hash wrong. Folded into D2. | no | settled |
| W9 | D12 | The repo's own routers and README go stale on this change. | no | settled — Spec, "The repo's own documentation" |
| W10 | D12 | Rewriting `protocol/graphs.md`'s command blocks is the largest single piece of work here. | no | settled — its own Spec section and its own task |
| W11 | D12 | Nothing covers a detached start or the new subcommands. | no | settled — Spec, Validation |
| W8 | D8 | Q1 (`$HOME` vs the Windows user folder) is now adjacent to D8's installer check — both ask "does what we wrote land where the tool actually looks". They may want to be one check rather than two. | yes | settled — merged into one routine by D11 |
| W7 | D7 | Whether a `workspace-write` lane with network access can bind a localhost port under Codex's Windows sandbox. | no | settled — became check C7 |
| W6 | queue-building | Windows ignores the viewer's `0o700`/`0o600` modes (`viewer/server.js:997`, `:998`, `:1301`). | no | settled — Accepted Risk below |

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D1 | The installer renders paths as `C:/Users/...` — drive letter, forward slashes | The one form both a POSIX shell and the harnesses' own Windows file APIs accept. Backslashes would additionally break the `sed` substitution that does the rendering (`install.sh:41`). | defaulted |
| D2 | A repo-wide line-ending rule pinning everything to LF, not just `*.sh` | Scripts are the loud failure, but graph JSON is the silent one: those files are byte-canonical and hash-compared, so a CRLF checkout invalidates every stored hash. Markdown matters too — the dial writer matches its markers by exact line (`sensitivity/set.sh:60`, `:72`). | defaulted |
| D3 | Checks that Windows cannot represent are skipped with a stated reason, not silently, and not by refusing to run the suite | The idea asks for suites that "run, pass, and say plainly which checks were skipped." A suite that refuses to run on Windows tells you nothing about the parts that do work. | defaulted |
| D4 | No rule document branches on platform | The repo's own layout rule is that a rule lives in exactly one place and both harnesses get identical instructions (`AGENTS.md`). A platform branch inside a protocol file is the same failure as a second copy. This is what forces Q4's shape. | defaulted |
| D5 | macOS is out of scope, recorded rather than fixed | Six GNU/bash-4 assumptions, none of which the Windows path touches, and no Mac in the loop. `MAP.md` carries the list with citations. | user |
| D6 | Windows verification is done by the user on their own machine, on instructions from this plan | There is a Windows PC with both tools installed; there is no automated route to it from here. | user |
| D15 | Windows checks are written as a brief an agent on that machine works through — `WINDOWS-CHECKS.md` in this directory — and its filled-in results land in the Windows Checks table below | The machine has agents on it, which was not known when the question was framed. That removes the trade the question was built around: a brief can be far more thorough than anything a person would type, and it needs no fourth executable. Results still land in a document because the verify stage reads documents, never the conversation. | user |
| D12 | The shell wrapping around both per-turn recipes moves into the programs those recipes already call: the viewer's server gains detached start, graph write and graph read; a new lane runner wraps `codex exec`. Each recipe in a rule document becomes one command with no shell syntax | Deleting the wrapping instead would cost resume, which the remediation loop is built on; doing only the picture flow leaves the four stages that delegate broken on Windows. The `curl` calls were the deciding evidence — PowerShell aliases `curl` to a different command, so those lines fail looking like a network fault. | user |
| D13 | `--open` starts detached and returns, rather than blocking when it is the first starter. The old blocking mode is removed, not kept alongside | A flag that sometimes blocks and sometimes does not is exactly why the recipe had to poll a log. Keeping both would be a dual path maintained for nothing, since no document would use the blocking one. Observable behaviour is unchanged — the URL still prints, `--stop` still stops it. | defaulted |
| D14 | The lane runner lives in a new top-level `lanes/` directory with its own router | The repo's layout rule gives every directory that owns something a router saying what it owns and where to go next. A new executable directory without one is the drift `/spine` exists to fix. | defaulted |
| D10 | On Windows the dial writer resolves its target from the folder the harness actually reads, not from whatever the shell calls home, and refuses with an explanation when it cannot establish that folder | A silent no-op is precisely what this script's all-or-nothing design exists to prevent, and it already refuses rather than half-succeeding in four other situations. Writing both places was rejected on the idea's rule against keeping anything twice. | user |
| D11 | D8's harness-reachability check and D10's destination check are one routine with one report, not two overlapping ones | Both ask the same question — does what we wrote land where the tool looks. Consolidation was surfaced to the user and taken as the lead's to own. | defaulted |
| D8 | Two catches, both built: a small non-shell entry point that finds the shell and hands off to `install.sh` or explains what to install, and a check inside the installer that warns when the harness will not reach that shell | They catch different failures and neither substitutes for the other — one is a terminal error the installer cannot itself produce, the other is a clean install that breaks an hour later somewhere unrelated. The entry point carries a check and a hand-off, no rules, so it stays on the right side of the wrapper rule. | user |
| D9 | That entry point is a `.cmd`, not a `.ps1` | A `.cmd` runs from `cmd.exe`, from PowerShell, and on double-click. A `.ps1` will not run from `cmd.exe` and is blocked outright under the default PowerShell execution policy — a second failure mode in the file whose entire job is to avoid one. | defaulted |
| D7 | Lanes pass the same isolation flags on every platform; `protocol/lanes.md` gains a passage saying what those flags actually buy on Windows and what to distrust. No platform detection, no restriction on what a Windows lane may do | The flags are requests rather than guarantees on Linux too — verified there when a lane silently lost network and still reported confidently — so no option can promise more isolation than the tool gives, and they differ only in what is written down. Documenting keeps the lane instructions one set for both harnesses, which D4 requires. | user |

## Spec

Both harnesses work on native Windows. Nothing about Linux behaviour changes except where
this section says so, and macOS is out of scope (`IDEA.md`).

Read `MAP.md` first: it carries the current-state citations every item below refers to.

### The clone has to survive git

A `.gitattributes` at the repo root pins the whole tree to LF. Not `*.sh` alone.

Scripts are the loud failure: git's Windows default rewrites them with CRLF and
`#!/usr/bin/env bash\r` fails as a bad interpreter before line one. Graph JSON is the silent
one: those files are byte-canonical and compared by hash, so a CRLF checkout invalidates
every stored hash and every fixture. Markdown matters because the dial writer finds its
region by exact line match (`sensitivity/set.sh:60`, `:72`) and reads the level with an
anchored regex (`:81-91`), all of which a trailing `\r` defeats.

Binary files — `docs/viewer.png` — are marked so nothing touches them.

### Rendered paths use a form both worlds accept

`install.sh:18` derives `$ROOT` from `cd`/`pwd`, and `render()` at `:41` substitutes it for
`{{WHEELCHAIR_ROOT}}` in every wrapper. On Windows that must produce a drive-letter path with
forward slashes — `C:/Users/name/wheelchair` — not the `/c/Users/...` form the shell reports
by default.

Both halves need it. The wrapper is read by the harness, whose file tools are Windows APIs
and cannot resolve `/c/...`; the same path is also used from the shell, which accepts the
drive-letter form. Backslashes are wrong for a third reason: the substitution is done by
`sed`, and a backslash in the replacement is an escape.

Non-Windows behaviour is unchanged.

### Delegated lanes keep one set of instructions

`protocol/lanes.md` continues to pass `-s read-only` for review and verify lanes,
`-s workspace-write` for implementation lanes, and
`-c sandbox_workspace_write.network_access=true` for any lane that runs a suite — on every
platform, with no detection and no branch. Nothing in the file asks what operating system it
is on.

What changes is that the file states what those flags buy. On Linux the kernel enforces them.
On Windows the GPT lane gets Codex's own sandbox, a different implementation its authors label
experimental, with two modes — one needing administrator setup on first run, one falling back
to weaker network blocking. On Windows the Claude lane gets no sandbox at all; Claude Code
documents sandboxing as unsupported outside WSL.

The passage must say what follows, because the consequence is the point: a lane that does not
get the isolation or the network it asked for still returns a confident report with nothing
behind it. That is not a Windows problem — it was verified on Linux, where the same brief
died on `listen EPERM` without the network flag and ran the full suite with it — and the
standing defence is unchanged and platform-independent: the lead re-runs the suite itself
before believing either the pass or the failure. Windows widens the window in which that
defence is the only one operating. It does not create it.

No lane is refused on Windows, and no lane is given different flags there.

### Getting installed on Windows has two catches

`install.sh` is unchanged in what it does and still requires a POSIX shell.

**A `.cmd` entry point at the repo root.** Its only job is to locate Git Bash and hand off to
`install.sh`, or, failing that, print what to install and where to get it. It carries no rules
and duplicates no guidance — a check and a hand-off. It is a `.cmd` because that runs from
`cmd.exe`, from PowerShell, and on double-click, where a `.ps1` runs from neither `cmd.exe`
nor a default execution policy. It exists because the loud failure — no shell on the machine
— happens when the only thing that could explain it is itself a shell script.

**A check inside `install.sh`.** Once running on Windows it establishes whether the harness
will actually reach the shell it just used, and warns when it will not. Claude Code falls back
to PowerShell when it cannot find Git Bash and exposes `CLAUDE_CODE_GIT_BASH_PATH` in settings
for pointing at it; the warning names that key. This catches the quiet failure — everything
installs, prints success, and every per-turn recipe fails later looking unrelated.

The warning does not fail the install, on the reasoning that already makes a dial-writer
refusal a warning rather than a failure (`install.sh:78-82`): what installed is useful, and
the condition is fixable afterwards without re-running anything.

### One routine answers "does this land where the tool looks"

The reachability check above and the dial writer's destination check are the same question
asked twice, so they are one routine reporting once.

On Windows it establishes the folder each harness actually reads its always-on file from —
the Windows user folder, which Git Bash exposes independently of whatever it calls home. In
order: an explicit `WHEELCHAIR_CLAUDE_HOME` or `WHEELCHAIR_CODEX_HOME` still wins, because
that is the existing testing seam and this must not break it; otherwise on Windows the
Windows user folder wins over the shell's `HOME`; otherwise `HOME`, as today, everywhere else.

Differing values are not an error — that case is resolvable, and resolving it correctly is the
point. The refusal is for the unresolvable case: on Windows, with no way to establish the
folder at all. Then the writer refuses and explains, exactly as it already does for duplicated
markers, a hand-edited level, an unwritable target, and a non-empty override.

`install.sh` reports a refusal as a warning and completes, unchanged (`install.sh:78-82`), and
the reachability finding is a second line in that same report.

Non-Windows behaviour is unchanged: `HOME` resolves the target.

### The per-turn recipes become single commands

No rule document contains shell syntax for these two flows any more. The wrapping moves into
the programs the documents already call, and the documents call them in one line.

**The viewer's server gains three things.**

`--open` starts the server detached and returns, printing the URL, whether or not it was the
process that became the server. Today the first start blocks forever and every later one exits
at once, with nothing on the command line saying which you get — that ambiguity is the only
reason the recipe backgrounds the process and polls a log. The blocking mode is removed rather
than kept alongside: no document would use it, and a flag that sometimes blocks is the defect
being fixed. `--show` and `--stop` are unchanged.

`--write <file> --path <target>` reads a graph from a file and performs the write the recipe
does with `curl` today, reading port and token from the lockfile itself and printing the new
hash. It honours the hash rules already in `protocol/graphs.md` — an empty hash creates, a
mismatch returns the current hash — and reports a refusal by its existing name, so that
document's list of refusals stays accurate.

`--read --path <target>` prints what the read route returns.

Between them these remove both `curl` calls and both `node -e` invocations. The routes
themselves are unchanged, still token-guarded and still bound to `127.0.0.1`; the subcommands
are clients of the same routes, not a second way in.

**A lane runner at `lanes/run.js`** wraps `codex exec`. It takes the model, the reasoning
effort, the sandbox mode, whether network access is needed, the working directory, and a file
holding the brief; it creates whatever temporary files it needs, detects the credentials slot
the shell recipe checks for today, runs the lane, recovers the session identifier from the
event stream, and prints one JSON object carrying the exit status, the session identifier, and
where the report was written. A resume mode takes a session identifier and a follow-up,
repeating every `-c` override as `protocol/lanes.md` already requires.

`lanes/` is a new top-level directory and gets a router, like every other directory here that
owns something.

**What does not change:** which flags a lane passes, what the routes do, the graph format, the
verdict rules, and every stage document that references these flows by name rather than by
command.

### The browser opens, or says it did not

`viewer/server.js:1462` selects the string `start` on Windows and `:1464` hands it to `spawn`
without a shell. `start` is a `cmd.exe` builtin rather than a program, so the spawn fails, the
error handler at `:1465` discards it, and `:1467` returns success. Routed through `cmd /c` it
would still break, because the URL carries `&`.

The Windows opener becomes one that is an actual executable and takes the URL as a single
argument without reinterpreting it. `WHEELCHAIR_BROWSER` still overrides on every platform.

Separately, `launchBrowser` stops claiming success it did not have: it reports whether the
launch was actually handed off, and `--show` says so when it was not. The launch stays
best-effort — a headless box still prints its URL and carries on, and a failure never fails a
write that already succeeded — but "best effort" must not mean "silently reports the effort
worked."

### Rewriting `protocol/graphs.md`

The largest single piece of writing in this change, and the one with the worst failure mode:
that file is the only thing an agent reads before its first graph write, so a wrong command
block means no picture ever reaches a screen.

Every shell block in the producer sequence is replaced by the corresponding single command:
the start-and-poll block (`:414-425`), the lockfile read (`:447`), the path encoding and
`curl` write (`:461-470`), and the `curl` read-back (`:535`). The prose around them —
the schema, the verdict rules, the preservation contract, containment, what the server
refuses — is unchanged except where it names a mechanism that no longer exists.

Two facts the current text teaches implicitly must survive explicitly, because the commands
that taught them are gone: that the first `--open` against a cache root is what makes a path
writable at all, and that `--show` is a separate later step because `--open` runs before the
graph exists.

### Tests skip what Windows cannot represent

Three suites assert things a Windows filename cannot hold: a directory named with a raw `0xFF`
byte (`spine/test/run.sh:189-190`), real symlinks (`:137`, `:141`, `:147`, `:173-174`), and an
unwritable target built with `chmod a-w` (`sensitivity/test/run.sh:162`).

Those individual checks skip on Windows and print why. The suite still runs, still passes on
its remaining checks, and reports the skips in its summary — a suite that refuses to run tells
you nothing about the parts that do work. Skips are per-check and named; no suite is skipped
whole.

On Linux nothing skips, and a skip appearing there is a failure.

### The repo's own documentation

Stale the moment this lands, and updated as part of it rather than after: the root
`AGENTS.md` directory table and its Verification section, `README.md`'s layout block, install
section and viewer section, and `skills/AGENTS.md` where it describes what a wrapper renders
to. `lanes/` gets a new router. `protocol/sensitivity.md` gains the resolution rule for where
the dial is written.

### Non-goals

macOS. WSL, which already works and needs nothing. Removing the shell requirement for
installing. Changing what any stage does. Making the two platforms equally isolated.

## Validation

Everything already in the root `AGENTS.md` Verification section still has to pass on Linux,
unchanged:

```bash
bash spine/test/run.sh
bash sensitivity/test/run.sh
bash install/test/run.sh
./install.sh && ./install.sh          # idempotent; git status --porcelain stays empty
node --test 'viewer/test/*.test.js'   # the glob is required
npm --prefix viewer run test:browser
```

New, and required:

- Server suite coverage for a detached `--open`: that it returns rather than blocking, that it
  prints a URL carrying port and token, and that a second start against a live server returns
  the same URL and does not start a second server. This is the behaviour the old recipe polled
  for, so it is the one that must not regress.
- Server suite coverage for `--write` and `--read`: a create against an absent file with an
  empty hash, a write against a stale hash returning the current one, and a refusal reported
  by its documented name.
- A lane runner suite that runs the real thing against a stub standing in for `codex` at the
  process boundary — not a faked-out internal seam — covering a lane that exits non-zero, one
  whose report file is empty, and one whose event stream carries a session identifier to
  recover.
- Every suite run on Windows through `WINDOWS-CHECKS.md`, with skips reported and no failures.

## Windows Checks

Filled in from `WINDOWS-CHECKS.md` as results come back. Empty rows are unchecked, not passed.

| # | Check | Result | Reported |
|---|-------|--------|----------|
| C1 | Which shell Codex hands an agent on native Windows | | |
| C2 | Whether Claude Code reaches Git Bash, or falls back to PowerShell | | |
| C3 | Whether `command -v claude` / `command -v codex` resolve the `.exe` under Git Bash | | |
| C4 | Whether the installer completes, including `npm --prefix` under MSYS path translation | | |
| C5 | Whether Playwright's pinned Chromium installs unattended | | |
| C6 | Whether a rendered wrapper's path opens with the harness's own file tools | | |
| C7 | Whether a `workspace-write` lane with network access can bind a localhost port | | |
| C8 | Whether the dial lands in the file the harness actually reads | | |
| C9 | Whether a graph can be started, written, read back and opened in a browser | | |
| C10 | Whether all five suites run, pass, and report their skips | | |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| Windows ignores the viewer's file modes. The cache root (`viewer/server.js:997`, `:1388`), the lockfile (`:1301`) and the registry of writable paths (`:998`) are created `0o700`/`0o600` because the lockfile holds the token authorizing every graph write. Those bits mean nothing on Windows, so any process running as the same user can read that token. | Fixing it means Windows access-control lists, which is a second permission model to carry and test for a defence that was never the primary one. The token is unguessable, the server binds `127.0.0.1` only, and every write also requires a matching `Origin`. This weakens defence in depth on a single-user developer machine rather than opening a route in. `IDEA.md` says where the platforms differ in protection it gets written down, not fixed. | planning |

## Review Rounds

<!-- Filled by Stage 2. -->

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

Nothing built yet.

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- 2026-08-31 — Map, idea and queue built in one session from Claude Code. The idea was
  revised twice before confirmation: the "no Windows testing" non-goal came out when a
  Windows PC turned out to be available, and macOS came out of the "still works today"
  claim once it turned out never to have worked at all.
