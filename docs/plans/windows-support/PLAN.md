---
slug: windows-support
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-08-31
---

# Windows support for Claude Code

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

None. All seven settled; see the Decision Log.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| W12 | results | The Windows box ran Codex 0.142.5, below the v0.146+ floor `README.md:229` states, so C1 and C7 could only be established through substituted models. | yes | settled — updated to 0.152.0 and re-checked; both facts hold on the required models |
| W13 | results | UTF-8 punctuation rendered as mojibake through Windows PowerShell 5.1, in a block a harness reads every turn. | yes | settled — Spec section and acceptance check, D31 (raised by review round 1, F12) |
| W1 | mapping | Which shell Codex actually gives an agent on native Windows. | yes | settled — became check C1 |
| W2 | mapping | Whether `command -v claude` resolves `claude.exe` under Git Bash (`install.sh:28-29`). | no | settled — became check C3 |
| W3 | mapping | Whether `npm --prefix "$ROOT/viewer"` survives MSYS path translation (`install.sh:71` and `:74`). | no | settled — became check C4 |
| W4 | mapping | Whether Playwright's pinned Chromium download completes unattended on Windows (`install.sh:74`). | no | settled — became check C5 |
| W5 | queue-building | The line-ending rule has to cover `.json`, not just scripts: graph files are byte-canonical and compared by hash (`viewer/server.js` canonical form), so a CRLF checkout would make every stored hash wrong. Folded into D2. | no | settled |
| W9 | D12 | The repo's own routers and README go stale on this change. | no | settled — Spec, "The repo's own documentation" |
| W10 | D12 | Rewriting `protocol/graphs.md`'s command blocks is the largest single piece of work here. | yes | moved — belongs to shell-free-recipes, carried over in its `INHERITED.md` |
| W11 | D12 | Nothing covers a detached start or the new subcommands. | yes | moved — belongs to shell-free-recipes with the subcommands themselves |
| W8 | D8 | Q1 (`$HOME` vs the Windows user folder) is now adjacent to D8's installer check — both ask "does what we wrote land where the tool actually looks". They may want to be one check rather than two. | yes | settled — merged into one routine by D11 |
| W7 | D7 | Whether a `workspace-write` lane with network access can bind a localhost port under Codex's Windows sandbox. | no | settled — became check C7 |
| W6 | queue-building | Windows ignores the viewer's `0o700`/`0o600` modes (`viewer/server.js:1074`, `:1075`, `:1378`). | no | settled — Accepted Risk below |

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D1 | The installer renders paths as `C:/Users/...` — drive letter, forward slashes | The one form both a POSIX shell and the harnesses' own Windows file APIs accept. (Superseded twice: by D16 on the file-API premise, and by the escaping helper on the backslash argument this row also carried.) | defaulted |
| D2 | A repo-wide line-ending rule pinning everything to LF, not just `*.sh` | Scripts are the loud failure, but graph JSON is the silent one: those files are byte-canonical and hash-compared, so a CRLF checkout invalidates every stored hash. Markdown matters too — the dial writer matches its markers by exact line (`sensitivity/set.sh:60`, `:72`). | defaulted |
| D3 | Checks that Windows cannot represent are skipped with a stated reason, not silently, and not by refusing to run the suite | The idea asks for suites that "run, pass, and say plainly which checks were skipped." A suite that refuses to run on Windows tells you nothing about the parts that do work. | defaulted |
| D4 | No rule document branches on platform | The repo's own layout rule is that a rule lives in exactly one place and both harnesses get identical instructions (`AGENTS.md`). A platform branch inside a protocol file is the same failure as a second copy. This is what forces Q4's shape. | defaulted |
| D5 | macOS is out of scope, recorded rather than fixed | Six GNU/bash-4 assumptions, none of which the Windows path touches, and no Mac in the loop. `MAP.md` carries the list with citations. | user |
| D6 | Windows verification is done by the user on their own machine, on instructions from this plan | There is a Windows PC with both tools installed; there is no automated route to it from here. | user |
| D40 | The path conversion and the destination resolution stay in this plan and live in `install/`, which gains the router it does not have today. D38's assignment of them to `shell/` is superseded, and `INHERITED.md` no longer claims them | The split left both plans claiming the same two helpers. They belong here because both are shell-facing helpers shared by two scripts and neither has anything to do with lanes. The earlier rationale — "both consumers are install-time" — was wrong: `protocol/sensitivity.md:101-102` has an agent run `set.sh` on every `/diagram-sensitivity`, so it is a live-command dependency too. The placement stands; the reason did not. Review round 6, K3 and K5. | review-round-6 |
| D42 | `CLAUDE_CONFIG_DIR` is honoured, above the Windows user folder and below the `WHEELCHAIR_*` seams; a relative value is refused rather than resolved; every destination is normalized out of Win32 form before any shell consumer sees it | It relocates every `~/.claude` path including the always-on file and `skills/`, so ignoring it installs where Claude does not read. Honoured rather than warned about because nothing in this repo sets it — the asymmetry with D41 is exactly that `protocol/lanes.md:33` sets `CODEX_HOME` for every GPT lane. Relative values resolve against the working directory, measured, and the installer's differs from the harness's. Review round 10. | review-round-10 |
| D41 | `CODEX_HOME` is not honoured; the misdirection it causes is an accepted risk | The one-line fix would make a GPT lane, which runs with `CODEX_HOME` pointed at a credentials slot, install wheelchair into that slot when it runs `./install.sh` as validation. Review round 6, K6. | review-round-6 |
| D39 | The plan splits. This one repairs the existing code for Windows; rewriting the shell recipes in `protocol/graphs.md` and `protocol/lanes.md` becomes `docs/plans/shell-free-recipes/`. The promise narrows to Claude Code fully and Codex partially | Four review rounds, 57 findings, and all but two of rounds 3 and 4's landed in the restructuring half while the repairs stayed stable from round 1. One PR was carrying two efforts. Splitting also dissolves several open findings by removing their subject rather than patching them. Agreed with the user. | user |
| D38 | *(superseded by D40; the shell/ half moved to shell-free-recipes)* `lanes/` holds the lane runner only. A new `shell/` owns the Git Bash locator, the script shim, the path conversion and the destination resolution | Those four share a concern — reaching a POSIX shell from anywhere and translating paths for it — and none of them is a lane. A directory named for lanes owning a Git Bash locator is the drift `/spine` exists to correct. Review round 3, H6 and H10. | review-round-3 |
| D37 | *(moved to shell-free-recipes)* The runner writes its result file as soon as the session identifier appears, prints that path on startup, and takes `--no-wait` | A detached lane whose handle is only printed on return is a lane nobody can recover, which is what the detachment was for. `--no-wait` restores the concurrency that deleting shell backgrounding removed, which `protocol/plan-review.md:37` requires. Review round 3, H4 and H5. | review-round-3 |
| D36 | The idea's Linux constraint is rewritten as "no Linux user loses anything", with the changes this plan does make to Linux enumerated in the idea itself | Both earlier wordings were defective: the original was so literal the Spec granted itself an exception in its own text, and the amendment was obtained for a change since abandoned. A north star the plan has to carve itself out of is not doing its job. Review round 3, H2. | review-round-3 |
| D35 | The idea's Linux constraint reverts to its original wording; the amendment is withdrawn | It was obtained to permit changing `--open`, on a cost estimate that was wrong, and D34 removes the need for it. Leaving an unused loosening in the north star would let a later change lean on permission nobody weighed. | user |
| D34 | *(moved to shell-free-recipes)* `--open` keeps its exact behaviour and callers. A new `--start <path>` registers the path, spawns `--open` detached, waits for `/whoami`, prints the URL and returns. Supersedes D32, D13 and D33 | Five sites depend on the launched process being the server and two inject `--require` into it, which cannot survive re-spawning; repairing those means plumbing injection through the launcher — production code whose only consumer is a test. `--start` supervises the same implementation rather than duplicating it, and its wait supplies the readiness contract G11 asked for. Review round 2, G1. | user |
| D33 | *(moved to shell-free-recipes)* The test helper is rewritten to read the server's pid from the lockfile, and that rewrite is in scope for this change | It spawns `--open` and treats that child as the server (`viewer/test/helpers/server.js:88`, `:97`), and one test asserts the lockfile pid equals it (`viewer/test/server.test.js:1094`). The lockfile is where that pid is already written and what the rest of the code trusts. Review round 1, F2. | review-round-1 |
| D32 | *(moved to shell-free-recipes)* `--open` starts detached and returns; `IDEA.md`'s Linux constraint is amended to cover what is observable rather than how processes are arranged | Proposed explicitly and agreed. The URL, the server and `--stop` are unchanged; what changes is that the command returns and the process holding the port is not the one launched. Nobody depends on the hang — the recipe works around it, which is the defect. Supersedes D13's reasoning, keeps its choice. Review round 1, F3. | user |
| D31 | Whether the mojibake is display or decoding is established before the change ships, and the remedy chosen then | The two have very different consequences for a block read on every turn, and no remedy should be committed to for a fault that may not exist. Review round 1, F12. | review-round-1 |
| D30 | A second brief, `WINDOWS-ACCEPTANCE.md`, checks the built change on Windows; the existing checks brief stays a pre-change diagnostic | `WINDOWS-CHECKS.md:9-14` explicitly installs and changes nothing, which is what made it clean fact-finding and what makes it unable to accept a change. `IDEA.md`'s "What good looks like" requires the real machine. Review round 1, F11. | review-round-1 |
| D29 | The browser bug rests on one measurement, not two, and the `--show` test's opener fixture is made portable as part of this change | That test points `WHEELCHAIR_BROWSER` at a bash-shebang script Windows cannot spawn (`viewer/test/server.test.js:978`), so it never reaches the `start` path and would stay red after the fix. Review round 1, F9. | review-round-1 |
| D28 | *(moved to shell-free-recipes)* `protocol/implementation.md` loses its backgrounding sentence; dispatch is described only in `protocol/lanes.md` | Backgrounding is shell syntax PowerShell does not share, and after the runner owns blocking there is nothing to background. `CONTRIBUTING.md` already says lane commands live in one file. Review round 1, F5. | review-round-1 |
| D27 | The `.cmd` entry point is pinned to CRLF, exempt from the repo-wide LF rule | `cmd.exe` mishandles LF-only batch files in labels, `goto` and `for` blocks — the constructs an entry point needs. Review round 1, F8. | review-round-1 |
| D26 | *(moved to shell-free-recipes)* The runner counts commands that exited zero with no output and reports the count; it does not try to match model prose to commands | The `--json` stream carries `exit_code` and `aggregated_output` per `command_execution`, so counting is well-defined where correlation is not. Supersedes D23, whose rule had no implementable mapping and rested on a single ambiguous transcript. Review round 1, F4 and F17. | review-round-1 |
| D25 | The path conversion happens at the substitution, in a helper shared by both renderers, not at either script's root variable | `$ROOT` is also used for `npm --prefix`, the wrapper glob and the call into `set.sh`, which all want the shell's own form. Review round 1, F20. | review-round-1 |
| D24 | Both renderers convert, not just the installer: `sensitivity/set.sh` substitutes the same placeholder into the block both harnesses read every turn | Fixing only `install.sh` leaves `/c/...` — the form C6 measured Codex failing on — in the most-read file on the machine. Review round 1, F1. | review-round-1 |
| D23 | *(moved to shell-free-recipes)* The lane runner treats a lane's own claim of success as unverified when its transcript carries no output for the step it is describing | Observed in the C7 rerun: a probe's tool transcript showed `succeeded in 8ms:` with nothing after it, while the model's prose reported `ok`. That is the exact shape of the failure this workflow already guards — a confident report with nothing behind it — surfacing in the stream the runner will parse. | defaulted |
| D22 | D16 and D17 both hold on the required models and the current CLI; the substituted-model caveats come out of the Spec | Re-checked on Codex 0.152.0. C1 confirmed PowerShell on `gpt-5.6-sol`. C7 bound a port with and without the network flag on `gpt-5.6-terra`, matching 0.142.5. C6 reversed and became decisive: 0.152.0 reads `C:/...` and mangles `/c/...` into `C:\c\...`, so the path decision is now measured rather than argued. | defaulted |
| D21 | The browser suite's child-graph navigation timeout is diagnosed before this ships, and either fixed or skipped with a stated reason — not left as an unexplained red | An unexplained 30-second timeout in the one suite that exercises the real browser is indistinguishable from a real defect in child-graph navigation, which is a feature this workflow uses. `IDEA.md` asks for suites that run, pass, and name their skips. | defaulted |
| D20 | The concurrent-write failure is in scope as a correctness fix, not a skip | `viewer/test/server.test.js:534` expects exactly one of two racing writes to return 200; on Windows neither did. That is a graph write failing under contention on a supported platform, not a check Windows cannot represent. Suspected cause is rename-over-existing under contention, which POSIX permits and Windows does not. | defaulted |
| D19 | Supersedes D3 in scope: the suites' *fixture builders* must also not attempt what Windows cannot represent, not only their individual checks | Observed: `spine/test/run.sh:147` runs `ln -s` unconditionally during setup and `set -e` takes the whole suite with it, so zero checks ran. A per-check skip cannot help a suite that dies before the first check. D3's reporting rule is unchanged. | defaulted |
| D18 | The `.cmd` entry point is still built, although the failure it was designed for did not occur on the test machine | The loud case did not appear because that machine has Git Bash; it remains the documented default state of native Windows Claude Code, where Git for Windows is optional. C2 also made the quiet case worse than D8 described: `where bash` resolves to the WSL launcher rather than Git's, and `CLAUDE_CODE_GIT_BASH_PATH` was unset. | defaulted |
| D17 | Supersedes the evidence, not the shape, of D7: the isolation passage states what was measured on Windows rather than implying the Linux failure carries over | Measured: a `workspace-write` lane bound a localhost port both with and without `sandbox_workspace_write.network_access=true`, so Windows is more permissive rather than more restrictive. The passage must say that plainly — a lane there is less likely to lose a suite silently and less contained. Flags and structure are unchanged. | defaulted |
| D16 | Supersedes D1's rationale, keeping its choice. Paths still render as `C:/Users/...`, but because a Codex agent on Windows is handed PowerShell, which cannot resolve `/c/...` — not because the harnesses' file tools cannot | D1 asserted Claude's file reader could not open `/c/...`. C6 disproves that: both forms read successfully. C1 supplies the replacement: Codex runs its agent's commands through Windows PowerShell, so the path a wrapper carries has to be one PowerShell resolves.  | defaulted |
| D15 | Windows checks are written as a brief an agent on that machine works through — `WINDOWS-CHECKS.md` in this directory — and its filled-in results land in the Windows Checks table below | The machine has agents on it, which was not known when the question was framed. That removes the trade the question was built around: a brief can be far more thorough than anything a person would type, and it needs no fourth executable. Results still land in a document because the verify stage reads documents, never the conversation. | user |
| D12 | *(moved to shell-free-recipes)* The shell wrapping around both per-turn recipes moves into the programs those recipes already call: the viewer's server gains detached start, graph write and graph read; a new lane runner wraps `codex exec`. Each recipe in a rule document becomes one command with no shell syntax | Deleting the wrapping instead would cost resume, which the remediation loop is built on; doing only the picture flow leaves the four stages that delegate broken on Windows. The `curl` calls were the deciding evidence — PowerShell aliases `curl` to a different command, so those lines fail looking like a network fault. | user |
| D13 | *(moved to shell-free-recipes)* `--open` starts detached and returns, rather than blocking when it is the first starter. The old blocking mode is removed, not kept alongside | A flag that sometimes blocks and sometimes does not is exactly why the recipe had to poll a log. Keeping both would be a dual path maintained for nothing, since no document would use the blocking one. Observable behaviour is unchanged — the URL still prints, `--stop` still stops it. | defaulted |
| D14 | *(moved to shell-free-recipes)* The lane runner lives in a new top-level `lanes/` directory with its own router | The repo's layout rule gives every directory that owns something a router saying what it owns and where to go next. A new executable directory without one is the drift `/spine` exists to fix. | defaulted |
| D10 | On Windows the dial writer resolves its target from the folder the harness actually reads, not from whatever the shell calls home, and refuses with an explanation when it cannot establish that folder | A silent no-op is precisely what this script's all-or-nothing design exists to prevent, and it already refuses rather than half-succeeding in four other situations. Writing both places was rejected on the idea's rule against keeping anything twice. | user |
| D11 | D8's harness-reachability check and D10's destination check are one routine with one report, not two overlapping ones | Both ask the same question — does what we wrote land where the tool looks. Consolidation was surfaced to the user and taken as the lead's to own. | defaulted |
| D8 | Two catches, both built: a small non-shell entry point that finds the shell and hands off to `install.sh` or explains what to install, and a check inside the installer that warns when the harness will not reach that shell | They catch different failures and neither substitutes for the other — one is a terminal error the installer cannot itself produce, the other is a clean install that breaks an hour later somewhere unrelated. The entry point carries a check and a hand-off, no rules, so it stays on the right side of the wrapper rule. | user |
| D9 | That entry point is a `.cmd`, not a `.ps1` | A `.cmd` runs from `cmd.exe`, from PowerShell, and on double-click. A `.ps1` will not run from `cmd.exe` and is blocked outright under the default PowerShell execution policy — a second failure mode in the file whose entire job is to avoid one. | defaulted |
| D7 | Lanes pass the same isolation flags on every platform; `protocol/lanes.md` gains a passage saying what those flags actually buy on Windows and what to distrust. No platform detection, no restriction on what a Windows lane may do | The flags are requests rather than guarantees on Linux too — verified there when a lane silently lost network and still reported confidently — so no option can promise more isolation than the tool gives, and they differ only in what is written down. Documenting keeps the lane instructions one set for both harnesses, which D4 requires. | user |

## Spec

Claude Code works on native Windows, given Git for Windows and a Claude Code that can reach it.
Codex installs and registers its prompts there and runs `/adopt`; the other seven commands need
`docs/plans/shell-free-recipes/`. What changes on Linux is enumerated in `IDEA.md`'s constraint
rather than carved out here — a Spec granting itself an exception to its own north star is
backwards. macOS is out of scope.

Read `MAP.md` first: it carries the current-state citations every item below refers to.

### The clone has to survive git

A `.gitattributes` at the repo root pins the whole tree to LF with **`* text=auto eol=lf`**. Not
`*.sh` alone, and not `* text=auto` — the attribute matters and twelve review rounds discussed this
rule without naming it. Measured: in a clone with `core.eol=crlf` and `core.autocrlf=false`, which
is an ordinary native-Windows configuration, `* text=auto` checks `#!/usr/bin/env bash` out as
`bash\r\n` and `* text=auto eol=lf` checks it out as `bash\n`. Only the second makes the outcome
independent of the reader's git configuration, which is the entire point of the rule. The mistake
would be invisible here — `git ls-files --eol` reports `w/lf` under both on Linux — and would
surface for the first time at the Windows acceptance run.

Scripts are the loud failure: git's Windows default rewrites them with CRLF and
`#!/usr/bin/env bash\r` fails as a bad interpreter before line one. Graph JSON is the silent
one: those files are byte-canonical and compared by hash, so a CRLF checkout invalidates
every stored hash and every fixture. Markdown matters because the dial writer finds its
region by exact line match (`sensitivity/set.sh:60`, `:72`) and reads the level with an
anchored regex (`:81-91`), all of which a trailing `\r` defeats.

Two exemptions. Binary files — `docs/viewer.png` — are marked so nothing touches them. And the
`.cmd` entry point below is pinned to **CRLF**, not LF: `cmd.exe` parses batch files by line and
mishandles LF-only files in exactly the constructs an entry point needs — labels, `goto`, and
`for` blocks. Pinning the tree to LF without that exemption would break the one file whose job
is to make a broken setup explain itself.

Observed on Windows: the scripts ran despite this being absent, and the JSON did not. The
canonical round-trip check failed with a CRLF fixture on disk against LF from the server
(`viewer/test/server.test.js:183`). Whether that machine's `.sh` files were also converted
was not captured, since the brief only asked for it if the installer failed and it did not.
So the silent half is confirmed and the loud half is observed **not** to have happened on that
machine — its scripts were LF while its JSON was CRLF, and `git config core.autocrlf` there was
never captured, so the reason is unknown. The rule makes the outcome independent of both `core.autocrlf` and `core.eol`, which is the point
— and only with `eol=lf`, as above; it is not justified by a shebang failure anyone has seen.

Adding the file does not fix a clone that already exists, and the verification machine has one.
`git add --renormalize .` is run here and is expected to change nothing: development is on Linux
and the committed blobs are already LF. It proves less than it looks like it proves, and two earlier
attempts to state the check were both wrong — recorded because the third only makes sense against
them. On a dirty tree the real run stages every modified file regardless of line endings. And
`--dry-run` prints `add '<path>'` for **every** path unconditionally, so "it named nothing" is
unachievable on any tree; measured on git 2.55.0 against a two-file repo where only one blob was
CRLF, the dry run named both files and the real run staged one.

The discriminating form is the real run followed by `git status --porcelain`: what it names is what
needed normalizing. In that same measurement it printed exactly `M crlf.txt`.

It needs a clean tree to be readable, and Stage 3 never has one — it writes `status: implementing`
into `PLAN.md` before any work and `COMPLETION.md` before it exits
(`protocol/implementation.md:38`, `:94-101`). So this check does not run during implementation. It
runs once, by the implementer, on a scratch clone of the branch with `.gitattributes` applied and
nothing else modified, and its result goes in this plan's Log — a one-time proof, not a standing
check, which is why it is named here and not in Validation. That is the only condition under which its output means anything.

Repairing the existing Windows clone is a separate step and belongs to the acceptance run, not
here: adding the file changes nothing already checked out, so that machine re-checks out its working
tree before anything else. `git reset --hard` discards uncommitted work, so the step is guarded:
fetch first, confirm `git status --porcelain` is empty and that `HEAD` **is** the commit under test — present
in the history is not enough, since a reset would then restore a different one — and only then
`git rm --cached -r . && git reset --hard`. An acceptance run that silently erased
the change it was accepting would report a failure of the wrong thing. Skipping that
makes the very next check run against the files this rule exists to eliminate and report a fix
that did not happen.

### Rendered paths use a form both worlds accept

**There are two renderers, not one.** `install.sh:18` derives `$ROOT` and `render()` at `:41`
substitutes it into every wrapper. `sensitivity/set.sh:5` derives its own root independently
and `:210` substitutes it into the diagram-sensitivity block — which is written into
`~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md`, is loaded by both harnesses on every turn in
every project, and dereferences `{{WHEELCHAIR_ROOT}}/protocol/planning.md` and
`{{WHEELCHAIR_ROOT}}/protocol/graphs.md` (`protocol/sensitivity.md:35`, `:43`). Fixing only the
installer leaves the most-read file on the machine carrying the broken form.

Both must produce a drive-letter path with forward slashes on Windows —
`C:/Users/name/wheelchair` — not the `/c/Users/...` the shell reports by default.

**Convert at the substitution, not at the root variable.** `$ROOT` is also used for
`npm --prefix` (`install.sh:71`), `npx --prefix` (`:74`), the wrapper glob (`:46`) and the call
into `sensitivity/set.sh` (`:78`), all of which want the shell's own form. The conversion
belongs where the placeholder is replaced, in `render()` and in `set.sh`'s substitution, so
exactly the strings an agent will dereference are converted and nothing else. Since both
scripts need it, it is one shared helper rather than two implementations.

This is measured. On Codex 0.152.0 (C6 rerun) the drive-letter path read successfully while the
`/c/...` form the installer writes today resolved to `C:\c\Users\...` and failed with `ENOENT` —
the leading `/c` taken as a directory under the current drive rather than as the drive. One
precision: the capability that read it was a `node_repl/js` server present on that machine, so
what was measured is Node's path handling on Windows rather than a file reader belonging to
Codex. That makes it weaker evidence about Codex's own tooling and no weaker about the path
form, which is what this decides — `/c/...` is not a Windows path, and nothing Codex reaches it
through treats it as one. Claude's own reader does accept it; that is measured too, and it is why
Codex rather than Claude sets this requirement.

The requirement is set by C1 independently: Codex hands its agent Windows PowerShell, which does
not resolve `/c/...` either. Claude's reader tolerates both forms, so Codex is the constraint in
both of the ways an agent reaches a file.

The drive-letter form with forward slashes is understood by PowerShell, by `cmd.exe`, by Git Bash,
and by Claude's reader; for Codex, by the capability that read it, which was Node's path handling
rather than a reader of Codex's own.

**The substitution has to escape its own metacharacters, which it does not today.** Both renderers
use `sed "s|{{WHEELCHAIR_ROOT}}|$root|g"` (`install.sh:41`, `sensitivity/set.sh:210`), and in a
`sed` replacement `&` means "the whole match", `\` starts an escape, and `|` closes the
expression. All three were run rather than reasoned about, and they fail differently. `&` is
the silent one: a clone at `C:/Users/A&B/wheelchair` renders as
`C:/Users/A{{WHEELCHAIR_ROOT}}B/wheelchair` — a wrapper pointing nowhere, written without
complaint. A `|` is the loud one: `sed` exits with `unknown option to 's'`, and under
`install.sh:16`'s `set -euo pipefail` the run dies at `:51` having already truncated that wrapper
through the redirect. A backslash silently drops or transforms, depending on what follows it. All
three are broken on Linux today as much as on Windows.

So the shared helper escapes `&`, `\` and the delimiter before substituting, and it is the reason
the conversion is one helper rather than two open-coded `sed` calls. Validation covers a clone path
containing each of the three.

Non-Windows behaviour changes in exactly one way, and it is a repair: the escaping above fixes a
clone path containing `&`, a backslash or a `|`, which corrupts every rendered command today on
every platform. The path *form* is unchanged off Windows — `HOME`'s value is rendered as it always
was.

Two suites assert the rendering by re-running the same substitution themselves and comparing:
`install/test/run.sh:48` and `:58`, and `sensitivity/test/run.sh:217`, `:220` and `:288`. They
must learn the conversion, because on Windows their own root is the shell's form while the
rendered output is the drive-letter form, and a mismatch there is a real disagreement rather
than something Windows cannot represent — it is exactly the behaviour under test, so it must not
be skipped.

### Delegated lanes keep one set of instructions

`protocol/lanes.md` keeps the flags it has today, unchanged, on every platform, with no
detection and no branch: `read-only` for plan reviewers, `workspace-write` for implementers
**and for verifiers that must run a test suite**, plus
`-c sandbox_workspace_write.network_access=true` for any lane that runs one (`lanes.md:77-83`). Nothing in the file asks what operating system it
is on.

What changes is that the file states what those flags buy, and it states what was measured
rather than what was assumed.

On Linux the kernel enforces them, and a lane denied network fails loudly at the bind — the
verified case where the same brief died on `listen EPERM` without the flag and ran the full
suite with it.

On Windows it goes the other way. A `workspace-write` lane bound a localhost port **both with
and without** `sandbox_workspace_write.network_access=true` (C7), so Windows is more permissive
than Linux, not more restrictive. Two consequences, and the passage must carry both: a lane
there is *less* likely to lose a suite silently, and *less contained* while it runs. Claude's
lane on Windows has no sandbox at all — its own docs list sandboxing as unsupported outside
WSL — so nothing constrains it either.

Measured twice, on Codex 0.142.5 and again on 0.152.0, the second time with the exact
`gpt-5.6-terra` this workflow dispatches. Same result both times, so it is a property of the
platform rather than of a CLI version or a substituted model.

The standing defence is unchanged and platform-independent: the lead re-runs the suite itself
before believing either the pass or the failure. What Windows changes is which way a lane
fails, not whether that defence is needed.

No lane is refused on Windows, and no lane is given different flags there.

### Getting installed on Windows has two catches

`install.sh` is unchanged in what it does and still requires a POSIX shell.

**`install.cmd`, at the repo root.** Its only job is to locate Git Bash and hand off to
`install.sh`, or, failing that, print what to install and where to get it. It carries no rules
and duplicates no guidance — a check and a hand-off. It is a `.cmd` because that runs from
`cmd.exe`, from PowerShell, and on double-click, where a `.ps1` runs from neither `cmd.exe`
nor a default execution policy. It exists because the loud failure — no shell on the machine
— happens when the only thing that could explain it is itself a shell script.

**A check inside `install.sh`.** Once running on Windows it establishes whether the harness
will actually reach the shell it just used, and warns when it will not. Claude Code falls back
to PowerShell when it cannot find Git Bash and exposes `CLAUDE_CODE_GIT_BASH_PATH` in settings
for pointing at it; the warning names that key. The PowerShell fallback is **measured**, not
documentation: it is in the same binary the resolver was read out of — with
`CLAUDE_CODE_USE_POWERSHELL_TOOL` unset, the PowerShell tool is offered exactly when the Git Bash
resolver returns nothing. C2's probe was blocked by a local pre-tool policy and established only
that the variable was unset. The check must therefore verify the condition it
warns about rather than trusting the documented fallback.

**The check reproduces Claude Code's own resolver**, whose four rungs are, in order:
`CLAUDE_CODE_GIT_BASH_PATH` when it exists and its lowercased basename is one of `bash.exe`,
`sh.exe`, `bash` or `sh`; else `C:\Program Files\Git\bin\bash.exe`; else
`C:\Program Files (x86)\Git\bin\bash.exe`; else `bash.exe` two directories above wherever `git`
resolves — and `git` is resolved by running `where.exe git`, so the fourth rung **does** consult
`PATH`. **Two of those four rungs the installer cannot see**, and the check must say so rather than
pretend otherwise. Rung one reads `process.env.CLAUDE_CODE_GIT_BASH_PATH` *in the harness process*,
and a value set the way this Spec itself describes — "in settings" — is merged into that process's
environment at harness startup, so it is invisible to `install.sh`. Rung four resolves `git` through
the harness's `PATH`, not the installer's, and under Git Bash those differ.

So the check reproduces the two rungs it genuinely can — both `Program Files` paths — plus an
explicitly exported `CLAUDE_CODE_GIT_BASH_PATH`, and its message says what it could not check. It
warns that it **could not confirm** the harness will reach a shell, naming the settings value and
the harness's `PATH` as the two things it cannot see from here. That is weaker than the earlier
draft promised and it is what is actually available; a check that claimed the harness will fail
would be wrong on any machine configured through settings.

Two things are worth stating because earlier drafts got both wrong. The resolver was described here
as never consulting `PATH`; that was false, and the false version was load-bearing in the
acceptance brief. And rung one's predicate was written as "named `bash` or `sh`", which implemented
literally rejects `...\bin\bash.exe` — the value almost everyone sets — and falls through to warn
on a working machine, which is precisely the failure this passage was rewritten to prevent.

All four rungs, their order, the basename list and the `where.exe` call were read out of the
installed binary (2.1.220) directly.

An earlier draft of this told a worker not to accept the first `bash` on `PATH`, reasoning from C2
that `where bash` returns the WSL launcher. That was aimed at the wrong mechanism: `PATH` plays no
part, and on the very machine cited, `git` at `C:\Program Files\Git\cmd\git.exe`
(`WINDOWS-RESULTS.md:246`) means rung two already hits and the harness **does** reach Git Bash —
corroborated by C2's own note that the Bash tool was offered at all, since it is offered only when
that resolver succeeds. A check built from the old reasoning would warn on a working machine. This catches the quiet failure — everything
installs, prints success, and every per-turn recipe fails later looking unrelated.

The warning does not fail the install, on the reasoning that already makes a dial-writer
refusal a warning rather than a failure (`install.sh:78-82`): what installed is useful, and
the condition is fixable afterwards without re-running anything.

### One routine answers "does this land where the tool looks"

The reachability check above and the dial writer's destination check are the same question
asked twice, so they are one routine reporting once.

It owns **both** destinations this repo writes to outside the clone, because both are resolved
the same way and can be wrong the same way: the always-on file the dial is written into, and the
harness homes every wrapper is rendered into (`install.sh:20-21`, duplicated at
`sensitivity/set.sh:10-11`). One resolution, used by both scripts, so a wrapper and a dial can never land in different places.
It lives beside the path conversion in `install/`, for the same reason and on the same terms.

On Windows it establishes the folder each harness actually reads from — the Windows user folder,
which Git Bash exposes independently of whatever it calls home. In order: an explicit `WHEELCHAIR_CLAUDE_HOME` or `WHEELCHAIR_CODEX_HOME` wins, because that is
the existing testing seam and this must not break it; then **`CLAUDE_CONFIG_DIR`** for the Claude
side, which relocates every `~/.claude` path including `CLAUDE.md` and `skills/` and which neither
`install.sh:20` nor `sensitivity/set.sh:10` honours today; then on Windows the Windows user folder
over the shell's `HOME`; then `HOME`, as today, everywhere else.

**A relative `CLAUDE_CONFIG_DIR` is refused, not guessed at.** Claude resolves it against the
current working directory — measured: `CLAUDE_CONFIG_DIR=relative-cfg` run from `/tmp` reads
`/tmp/relative-cfg/settings.json`. The installer runs in this clone and Claude later runs in
whatever repository you are working in, so a relative value names two different folders and the
installer cannot know the second. It refuses and explains, which is what this writer already does
rather than guessing.

**Every destination is normalized to the form the shell consumers need**, whichever rung produced
it. `CLAUDE_CONFIG_DIR` and the Windows user folder both arrive as Win32 paths with backslashes —
`USERPROFILE=C:\Users\Collin` against `HOME=/c/Users/Collin` on the machine measured
(`WINDOWS-RESULTS.md:638`) — while every consumer is POSIX shell: `mkdir -p`, `mktemp
"$directory/…"`, `${target%/*}`, `[[ -w ]]`. The resolution converts before returning, so no
caller sees a backslash path. This is the same care D1 takes over the rendered form, applied to the
destination, which the earlier draft simply forgot.

`CLAUDE_CONFIG_DIR` is honoured rather than merely warned about, unlike its Codex counterpart
below, and the difference is the reason: nothing in this repo sets it. `protocol/lanes.md:33` sets
`CODEX_HOME` for every GPT lane, which is what makes honouring *that* one hazardous; no lane, no
script and no document here touches `CLAUDE_CONFIG_DIR`, so there is no inherited value to be
misled by. This was the gap the Spec previously left to the acceptance run to discover — it is
answered here instead, from Claude Code's own documentation.

**`CODEX_HOME` is deliberately not honoured, and that is a known defect this plan declines to
fix.** `install.sh:21` and `sensitivity/set.sh:11` hardcode `$HOME/.codex` while
`protocol/lanes.md:35` says an existing setting "remains theirs", so anyone who sets it gets their
prompts written where Codex will not read them — on every platform, today. The obvious one-line
fix introduces a worse bug: `protocol/lanes.md:33` runs every GPT lane as
`env CODEX_HOME=<balancer slot> codex`, child processes inherit it, and a lane running
`./install.sh` as its own validation would render the wrappers and the dial into the credentials
slot. Untangling that means deciding what a lane's environment should mean to an installer, which is a
change of its own with its own reasoning.

The middle option — **warn** when `CODEX_HOME` is set and names a different directory from the one
being written — carries none of that hazard, costs one line in the report described above, which this change creates: it prints nothing on an ordinary install resolving through
plain `HOME`, and where any other rung produced a destination it names that destination and which
rung,
and turns a silent misdirection into a visible one. It is taken. "Different directory" is compared after
normalization, not textually: `C:\Users\Collin\.codex` and `/c/Users/Collin/.codex` are the same
folder in two spellings, and a textual comparison would warn on every Windows install where the
variable is set to the place it is already going. Both sides go through the same conversion the
destinations use, and the case where the two spellings agree is a validation case of its own.

What stays accepted is the misdirection itself, not the silence: someone who has set that variable will be told their prompts
are going somewhere Codex will not read, and can decide what to do about it.

Differing values are not an error — that case is resolvable, and resolving it correctly is the
point. The refusal is for the unresolvable case: on Windows, with no way to establish the
folder at all. Then the writer refuses and explains, in the same voice it already uses for its other refusals —
though not with the same consequence, as the next paragraph says.

**Where the resolution runs, and what a refusal means.** Today the catch would come too late:
wrappers render at `install.sh:44-63` and the dial writer runs at `:78`, so an unresolvable folder
discovered at `:78` leaves wrappers already written to whatever `$HOME` happened to be. So the
resolution runs **before any wrapper is rendered**. It establishes both destinations or neither,
and when it cannot, the installer writes nothing at all, says which condition it hit, and exits
non-zero. Half an install — wrappers somewhere arbitrary, no dial — is exactly what this prevents,
and validation asserts the exit status and that neither destination was touched, not merely that
something refused.

This is the one refusal that stops the install. The dial writer's other refusals — duplicated
markers, a hand-edited level, an unwritable target, a non-empty override — are unchanged: they are
discovered at `:78`, after the wrappers are legitimately in place, and `install.sh:78-82` reports
them as a warning and completes. The reachability finding is a second line in that same report.
The difference is whether anything was written to the wrong place, not how loud the message is.

Non-Windows behaviour changes in two ways, both repairs: `CLAUDE_CONFIG_DIR` is honoured where it
is ignored today, and a set-but-ignored `CODEX_HOME` now produces a warning where it produced
silence. Otherwise `HOME` resolves the target, as now.

### The browser opens, or says it did not

`viewer/server.js:1539` selects the string `start` on Windows and `:1541` hands it to `spawn`
without a shell. `start` is a `cmd.exe` builtin rather than a program, so the spawn fails, the
error handler at `:1542` discards it, and `:1544` returns success. Routed through `cmd /c` it
would still break, because the URL carries `&`.

The Windows opener becomes one that is an actual executable and takes the URL as a single
argument without reinterpreting it. `WHEELCHAIR_BROWSER` still overrides on every platform.

Separately, `launchBrowser` stops claiming success it did not have: it reports whether the
launch was actually handed off, and `--show` says so when it was not. The launch stays
best-effort — a headless box still prints its URL and carries on, and a failure never fails a
write that already succeeded — but "best effort" must not mean "silently reports the effort
worked."

**The opener is named, and "handed off" is defined.** Windows gets `explorer.exe`. Its three
relevant properties — that it is a real executable rather than a shell builtin, that it takes the
URL as one argument without reinterpreting `&`, and that it exits non-zero even on a successful
open — are **stated from documentation and have not been measured here**, which matters because
this is the one item the idea promises is checked on the real machine and the one C9 measured
failing. So the acceptance run opens a graph and requires a browser window to actually appear,
and the implementer confirms the exit-status behaviour on that machine before relying on it. If
`explorer.exe` turns out not to behave this way, the opener changes rather than the claim. Exit
status cannot be the signal: handed off means the
process spawned without an `error` event, which is what `viewer/server.js:1542` currently
discards. That event is asynchronous while `launchBrowser` returns `true` synchronously at
`:1544`, so it becomes awaitable — resolving once the spawn has either errored or is known to
have started. It still never waits for the browser itself, and a failure still never fails a
write that already succeeded.

**One correction to the evidence.** The browser bug has one measurement, not two. C9's
window-handle observation is real. The C10 suite failure is not corroboration: that test writes
`fake-browser.sh` with a `#!/usr/bin/env bash` shebang and points `WHEELCHAIR_BROWSER` at it
(`viewer/test/server.test.js:978`), and Windows cannot spawn it — so the test fails before
reaching the `start` path and would keep failing after this fix. Making that fixture portable
is part of this change; leaving it would leave a permanent red that looks like the bug we just
fixed.

### A graph write must survive contention on Windows

`viewer/test/server.test.js:534` races two writes against the same graph and expects exactly
one to return 200 and the other 409. On Windows neither returned 200.

That is not a check Windows cannot represent — it is a graph write failing on a supported
platform, and it is the one failure here that can lose a person's work rather than merely
annoy them. The suspected cause is `atomicWrite`'s rename over an existing file
(`viewer/server.js:1052`): POSIX replaces atomically under contention, Windows can refuse with
a sharing violation when the target is open. The lockfile claim uses `link` (`:1384`) and is a
separate path.

The implementer diagnoses it rather than assuming that cause, then makes both racing writes
resolve as the test already specifies: one commits, the other is told its hash is stale. The
existing test is the acceptance criterion and is not modified to accommodate the platform.

### The browser suite's child-graph timeout

`viewer/test/browser.spec.js:1359` — collapse state surviving a child-graph navigation —
times out after 30 seconds on Windows waiting for the child graph to load. Every other
browser check passes.

Diagnosed before this ships. If the cause is a defect in child-graph navigation, it is fixed —
that is a feature this workflow uses, and shipping it broken is not an option this plan offers.
A skip is permitted only if diagnosis shows the check depends on something Windows cannot
represent, which is the same bar every other skip here meets. "We could not work out why" is not
a stated reason; it is an unfinished diagnosis, and it blocks.

### Tests skip what Windows cannot represent

Three suites assert things a Windows filename cannot hold: a directory named with a raw `0xFF`
byte (`spine/test/run.sh:189-190`), real symlinks (`:137`, `:141`, `:147`, `:173-174`), and an
unwritable target built with `chmod a-w` (`sensitivity/test/run.sh:162`).

Those individual checks skip on Windows and print why. The suite still runs, still passes on
its remaining checks, and reports the skips in its summary — a suite that refuses to run tells
you nothing about the parts that do work. Skips are named; no suite is skipped whole.

Skipping the checks is not sufficient, and this is the part observation corrected. The spine
suite never reached a check: `spine/test/run.sh:147` runs `ln -s` while *building fixtures*,
and under `set -e` that took the whole suite down with zero passes. So the fixture builders
carry the same rule as the checks — a builder does not construct what the platform cannot
represent, and the checks depending on that fixture are the ones that skip.

On Linux nothing skips, and a skip appearing there is a failure.

### The always-on block has to survive the encoding it is read in

The diagram-sensitivity block is written into `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md`,
which both harnesses load every turn, and its source is full of em-dashes. Windows PowerShell
5.1 rendered UTF-8 punctuation as mojibake during the checks, and no protocol file carries a
byte-order mark.

Whether that is a display artifact of the console or a decoding fault that reaches the harness
is unestablished, and the difference matters: the first is cosmetic, the second silently
corrupts an instruction block read on every turn in every project. So the writer states the
encoding it writes, the acceptance run compares the landed block against the **rendered** region — the source with
the root and level substituted, which is what `sensitivity/test/run.sh:214-220` already
constructs — not against the raw source, which cannot match. It reads it back both through a
harness and through the console, since the question is precisely whether those two decode it the
same way, and records the answer.

If the console mangles it but the harness reads it correctly, that is a display artifact and
nothing is done beyond recording it.

If a harness reads it wrongly, neither obvious remedy is free, and both were checked rather than
assumed:

A byte-order mark is **not** available. It is only meaningful at offset zero of the file, which is
outside the delimited region, and `sensitivity/AGENTS.md:17` makes never touching bytes outside
the markers this writer's central contract.

Restricting the region's source to ASCII punctuation **is** the remedy, and it is not free either:
`sensitivity/test/run.sh:257` and `:268` assert on the region's wording verbatim, em-dashes
included, so those two expected strings change with it. That is a legitimate update — the
assertion follows the content it asserts — and it is named here so a worker does not read
"existing suites pass unchanged" as forbidding it. The change is confined to
`protocol/sensitivity.md`'s delimited region; `protocol/writing.md:136` declines an em-dash ban
for these documents generally, and this is one region bending to a decoder, not a new rule.

Restricting the source is still not sufficient on its own, because the block carries a value the
repo does not control: the clone's own path, substituted in. A clone under a directory with
non-ASCII characters puts them into the block however ASCII the source is. **When the writer can know this, and what it does.** The condition is a property of the path and
the decoder, not something discoverable only after the fact: the writer can see whether the root it
is about to substitute contains a non-ASCII byte, and that is the trigger. It does not need to
install and read back to decide — the acceptance run does that to establish whether the trigger is
the *right* one, which is a different question and belongs to the run rather than to the code.

So, **on Windows only**: when the substituted root carries a non-ASCII byte, the block is not
installed and the installer says why. The branch is platform-qualified because the fault is a
Windows decoding one — a Linux clone under a non-ASCII directory would otherwise lose a block it
gets today, a fifth Linux change against an idea that calls its four exhaustive — and because `sensitivity/set.sh`
replaces a valid block in place (`:219-223`), "not installing" is not the same as doing nothing: an
existing block from an earlier run would survive carrying a path that no longer decodes. So the
writer **removes** any block it finds and installs none, leaving the surrounding file untouched as
always. The dial then behaves as `ask` — nothing drawn unprompted.

Whether every other command still works there is **not** inferred. C6 opened an ASCII path, so it
says nothing about a non-ASCII one, and the wrappers have a different reader from the always-on
file. The acceptance case therefore installs from such a clone and then actually invokes a command
through a rendered wrapper. If that fails too, the limitation is larger than the dial and is
recorded as measured rather than reasoned.

An earlier draft said this case blocks the whole change. That was wrong: it conflated the block's
reader with the wrappers' reader, which C6 measured separately.

Each branch names its remedy and what that remedy costs, so implementation does not stop here to
ask — which is why this is a Spec item rather than an open question.

### The repo's own documentation

Stale the moment this lands, and updated as part of it rather than after.

The root `AGENTS.md` carries three tables and this change touches all three: "Files at the root"
gains `.gitattributes` and `install.cmd`; the "Kind" table's `Executable` row gains `install.cmd`;
and the "Where to go" table's `install/` row gains a router where it currently shows `—`, and a
contents description beyond the fixture suite.

`install/AGENTS.md` **does not exist and this change creates it** — verified: only the root,
`protocol/`, `sensitivity/`, `skills/` and `spine/` carry routers today. It says what `install/`
owns: the fixture suite it already holds, plus the path conversion and the destination resolution
this change moves in. `sensitivity/AGENTS.md`'s file-and-role table has two rows, `set.sh` and `test/run.sh`, and names
no destination resolution — so there is nothing to remove there. What it needs instead is a line saying
`set.sh` now takes that resolution from `install/` rather than deriving it, which is the "both
sides" `CONTRIBUTING.md`'s editing conventions ask for.

**Two refusal contracts elsewhere become false and are corrected in the same change.**
`sensitivity/AGENTS.md:18`'s Boundaries line "A refusal is never a repair" — the block-removal
branch refuses *by* removing something. And `protocol/sensitivity.md:85-89`'s all-or-nothing
contract, which enumerates what the writer may do when it refuses and has room for neither removing
a block nor stopping the install.

`CONTRIBUTING.md` and `skills/AGENTS.md` join the list: both state the harness home as an
unconditional default path, which `CLAUDE_CONFIG_DIR` makes false. `README.md` states it twice —
the wrapper destination (`:80`) and the always-on block (`:108-110`) — so it needs **eight** edits
in total: those two, plus six of its own. Two are claims of harness parity that this change makes
false and that earlier sweeps missed: its opening says the workflow "runs the same from Claude Code
and from the Codex CLI", and its usage section presents the commands as working from either. Both
now carry the Windows qualification. The other four: its layout block gains `install.cmd` and a corrected
`install/` line; its router enumeration at the `AGENTS.md` entry — "also protocol/, skills/,
spine/ and sensitivity/" — gains `install/`; its install section gains the Windows entry point;
and its dependency list gains Git for Windows.
`CONTRIBUTING.md`'s installation section says to run `./install.sh` after cloning, which is not
the Windows entry point; its validation list needs nothing, since this plan adds no suite.
`protocol/sensitivity.md` gains the resolution rule for where the dial is written, and its
delimited region carries the ASCII restriction if the encoding check calls for it.

**The platform statement is new, not an edit.** `MAP.md` records that no document in this repo
claims a supported platform today, so there is nothing to correct — there is something to add. It
goes in `README.md`'s Dependencies section, which is where a person already looks to find out what
this needs, and it says: Linux and Windows; on Windows, Claude Code with Git for Windows; Codex on
Windows installs but only `/adopt` runs until `docs/plans/shell-free-recipes/` lands. Naming
`install.cmd` literally, since two other documents have to list the file.

### Non-goals

Rewriting the shell recipes in `protocol/graphs.md` and `protocol/lanes.md` — that is
`docs/plans/shell-free-recipes/`, together with the shim that would let `/spine` and
`/diagram-sensitivity` run there. Deferring both is what leaves Codex installable but not usable on Windows: seven of the eight
commands reach a shell recipe, and only `/adopt` does not.
macOS. WSL, which already works and needs nothing. Removing the shell requirement for installing.
Changing what any stage does. Making the two platforms equally isolated.

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

- The `--show` test's opener fixture made portable, so it exercises the launch path on Windows
  instead of failing to spawn a bash script (`viewer/test/server.test.js:978`), plus a case where
  the opener does not exist, proving `--show` reports the failure rather than
  discarding it and returning success as it does today.
- A destination-resolution case where the shell's home and the Windows user folder **differ**,
  and one where the Windows folder cannot be established at all. Neither occurred on the machine
  checked and the Linux suite always passes explicit overrides (`install/test/run.sh:73-77`), so
  without these the precedence rule and the refusal are asserted nowhere.
- Two concurrent writes to one graph resolving as `viewer/test/server.test.js:534` already
  specifies — one committing, the other told its hash is stale. That test is the acceptance
  criterion and is not modified to accommodate the platform.
- The child-graph navigation check green, or skipped with a stated platform reason.
- `CLAUDE_CONFIG_DIR` honoured, a relative one refused, and the `CODEX_HOME` warning fired, each
  with its own case. Its rung *ordering* against the Windows user folder can only be asserted in the
  acceptance run, since that rung does not exist on Linux — an acceptance bullet covers it.
- The installer suite's own safety net follows the resolution it guards: `install/test/run.sh:113`
  asserts `$HOME/.claude/CLAUDE.md` is untouched, which under the new precedence is no longer
  necessarily the live target. The
  installer suite always passes `WHEELCHAIR_CLAUDE_HOME` (`install/test/run.sh:76`), which wins the
  precedence, so without these the two new rungs are asserted nowhere — the same argument that
  bought the divergent-home fixture.
- The path conversion applied to a clone path containing `&`, a backslash and the `sed` delimiter,
  proving the helper escapes rather than corrupts — the `&` case fails today on every platform. The
  expectation is a **literal string written into the test**, not the helper's own output: the two
  suites that re-run the substitution would otherwise compare helper against helper, and a helper
  that escapes wrongly corrupts both sides identically and passes.
- The path conversion asserted by the two suites that re-run the substitution themselves
  (`install/test/run.sh:48`, `:58`; `sensitivity/test/run.sh:217`, `:220`, `:288`), which must
  learn it rather than skip.

**A post-change Windows acceptance run.** The existing `WINDOWS-CHECKS.md` cannot serve this: it
says at `:9-14` that wheelchair is not installed there and that the agent must change and install
nothing, which is what made it a clean pre-change diagnostic. A second brief —
`WINDOWS-ACCEPTANCE.md`, same form, run the same way — installs the built change and checks what
the first one could not.

**Before anything else on that machine**, the working tree is re-checked out and
`git ls-files --eol` confirms LF, with exactly one `w/crlf` row — `install.cmd`, pinned that way
on purpose. Adding `.gitattributes` does not touch files already on disk, so every check below is
measuring the old checkout until this one passes, and any other CRLF row is a failure.

- `install.cmd` on a machine where Git Bash is reachable, and again on one with **no Git Bash at
  all**, where it must explain rather than hand off and nothing installs
- the installer's warning when the harness will not reach the shell, and its report naming which
  rung produced each destination
- `CLAUDE_CONFIG_DIR` set to an absolute path outranking the Windows user folder, which is the one
  rung ordering Linux cannot assert
- that a rendered wrapper's path opens from both harnesses. For Claude that is its own file tool.
  For Codex it is whatever non-shell capability that session has — on the machine checked it was an
  optional `node_repl/js` server, and Codex reported no local reader of its own, so the criterion
  is "the path resolves", not "a first-party reader opens it". A session with no such capability
  demonstrates nothing either way and is recorded as not established rather than as a pass
- that the dial lands in the file the harness reads, and its block matches the region as
  **rendered for that machine** — the source with the root substituted in its converted form and
  the level filled in — read back both through a harness and through the console, since whether
  those two agree is the question. Comparing against the raw source, or against a rendering that
  skipped the path conversion, fails for reasons that are not the encoding.
- a graph drawn and **a browser window observed to appear** — not a success message, the window,
  since the current code reports success either way and that is the defect. Plus `explorer.exe`'s
  exit status on that machine, recorded, since the Spec relies on it and nobody has measured it
- from Claude Code: every command runs **against a fixture staged to reach the mechanics**, not
  merely invoked. Each stage command refuses out of order by design, so the brief carries a plan
  directory at the right `status:` for each — `ready-for-review` for `/plan-review`, `approved` for
  `/implement`, and for `/verify` both `verifying` **and** a present `COMPLETION.md`, which
  `protocol/verification.md:6` requires and staging the status alone does not satisfy. `/implement`
  needs a Spec substantial enough to dispatch a lane, since `protocol/implementation.md:11-13` lets
  a small patch bypass the dispatch that is the mechanic under test — and substantial is not
  sufficient on its own, because task content selects the lane family
  (`protocol/implementation.md:44-63`) and `implemented-by` selects the verifier
  (`protocol/verification.md:11-29`). The fixture's tasks must be ones that route to a **GPT** lane,
  since that is the Git-Bash-dependent path; a fixture that dispatches only Claude lanes exercises
  nothing this check exists for. And `/plan` is driven to
  a shape-bearing question so it reaches the graph turn its protocol makes mandatory. A command that refuses at its state gate has
  tested nothing and is recorded as not established, not as a pass
- from Codex: the install lands, the prompts register, and `/adopt` runs. **Seven of the eight
  commands are expected to fail here** and the brief names all seven; a report claiming any of them
  worked is the finding, not the pass.
- from Claude Code with Git Bash reachable by `install.sh` but **not by the harness's resolver**.
  Staging it is specific and the brief says how. Pointing `CLAUDE_CODE_GIT_BASH_PATH` at something
  invalid only logs a fallback to auto-detection, so that is not the lever. Defeating the rungs means all four, in the
  harness's own environment: a Git outside both `Program Files` locations, no
  `CLAUDE_CODE_GIT_BASH_PATH` in Claude's settings or environment, and `git` absent from the
  **harness process's** `PATH`. Note what the installer will and will not say: run from a Git Bash
  whose own `PATH` still has `git`, `install.sh` cannot see any of that and will report only that it
  could not confirm — so the expected result is the harness losing four commands while the installer
  emits its could-not-confirm warning, not a confident failure. When it can: the
  installer warns, and the failures are *not* the same seven. `/graph` and `/plan`
  fail on the graph recipe, `/spine` and `/diagram-sensitivity` on their script invocations. But
  `/plan-review`, `/implement` and `/verify` reach a Claude lane through the Agent tool, which
  needs no shell — what they cannot reach is the GPT half of the cross-family pair the protocol
  mandates when both families are on `PATH`. Record what each of those three actually does, because
  the protocol has no stated behaviour for a family that is present but whose invocation needs a
  shell that is not, and that gap is a finding in its own right
- all five suites, green, with every skip named
- a clone under a directory whose name carries a non-ASCII character. The installer's behaviour is
  decided at write time by the path, so this check does not discover a branch — it confirms the
  writer took the one it should: the block absent, any pre-existing one removed, and `set.sh`
  exiting so that `install.sh:78-82` reports a warning rather than "installed". Then invoke a
  command through a rendered wrapper, to establish whether the wrappers survive a path the block
  could not — that part is genuinely unknown, and if they fail too the limitation is larger than
  the dial. Until now this branch existed only in prose and was exercised by nothing

`IDEA.md`'s "What good looks like" requires every item to be checked on the real machine, and the
pre-change checks were fact-finding about a machine, not acceptance of a change.

## Windows Checks

Filled in from `WINDOWS-CHECKS.md` as results come back. Empty rows are unchecked, not passed.

Run on `GLEAMPC`, 2026-08-31, on Codex CLI 0.142.5, then C1, C3, C6 and C7 re-run on 0.152.0
after the update. Raw output for both rounds in `WINDOWS-RESULTS.md`; that file is the
evidence, this table is the index.

| # | Check | Result | Established |
|---|-------|--------|-------------|
| C1 | Which shell Codex hands an agent | **Windows PowerShell**, confirmed on 0.152.0 running the required `gpt-5.6-sol`. Individual Unix *programs* resolve there because Git's tools are on `PATH` — `uname -a` works, bare `ver` does not — so it is shell *syntax* that is unavailable, not every Unix binary | yes |
| C2 | Whether Claude reaches Git Bash | Bash tool present and attempted; a local pre-tool policy blocked the probe, so the shell behind it is unknown. `CLAUDE_CODE_GIT_BASH_PATH` unset; `where bash` finds the WSL launcher, not Git's | partly |
| C3 | Whether the harness commands resolve under Git Bash | Both resolve; Codex now reports 0.152.0 | yes |
| C4 | Whether the installer completes | `rc=0`. Both harnesses, viewer dependencies, Chromium and both dial blocks written. Wrappers carry `/c/Users/...` | yes |
| C5 | Whether Chromium installs unattended | `rc=0`, ~1s, no interaction | yes |
| C6 | Whether a wrapper's path resolves from each harness (Claude: its own file tool; Codex: whatever non-shell capability the session has) | **Claude reads both forms. Codex 0.152.0 reads `C:/...` and fails `/c/...`**, which it resolves to `C:\c\Users\...` with `ENOENT`. The first round's "no reader for either" was a 0.142.5 artifact | yes — disproves D1's premise and proves its choice |
| C7 | Whether a sandboxed lane can bind a localhost port | **Bound with and without the network flag**, on both CLI versions, the second time with the exact `gpt-5.6-terra`. Windows is more permissive than Linux, which contradicts `protocol/lanes.md:80`'s categorical claim that `workspace-write` alone cannot bind a port — that line gains the qualification | yes |
| C8 | Whether the dial lands where the harness reads | `$HOME` and `%USERPROFILE%` name the same folder here; both files carry `diagram-sensitivity: default` | yes — the divergence case remains unobserved |
| C9 | Whether a graph can be started, written and opened | Start, register, write and stop all succeeded. **`--show` printed success and opened nothing**; no page began polling | yes |
| C10 | Whether the suites run and report their skips | sensitivity 62/62, installer 12/12, node 53/56, browser 60/61, **spine 0 — died in fixture setup** | yes |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| `CODEX_HOME` is ignored by `install.sh:21` and `sensitivity/set.sh:11`, so anyone who sets it has their prompts and diagram-sensitivity block written where Codex will not read them — on every platform, today. The installer now **warns** when it is set and differs, so the misdirection is visible rather than silent, but it is not corrected. | Honouring it introduces a worse bug: `protocol/lanes.md:33` runs every GPT lane with `CODEX_HOME` pointed at a credentials slot, and a lane running `./install.sh` as validation would install into that slot. Deciding what a lane's environment should mean to an installer is a change of its own. Recorded here so the next person meets it rather than rediscovering it. | 6 |
| Windows ignores the viewer's file modes. The cache root (`viewer/server.js:1074`, `:1465`), the lockfile (`:1378`) and the registry of writable paths (`:1075`) are created `0o700`/`0o600` because the lockfile holds the token authorizing every graph write. Those bits mean nothing on Windows, so any process running as the same user can read that token. | Fixing it means Windows access-control lists, which is a second permission model to carry and test for a defence that was never the primary one. The token is unguessable, the server binds `127.0.0.1` only, and every write also requires a matching `Origin`. This weakens defence in depth on a single-user developer machine rather than opening a route in. `IDEA.md` says where the platforms differ in protection it gets written down, not fixed. | planning |

## Review Rounds

### Round 12 — 2026-09-03

**Lanes:** GPT / gpt-5.6-sol (mechanics lens); Claude / default reviewer model (intent lens);
cross-family: yes. No document is edited until both lanes return.

**The rule, second clause.** Round 11 tested whether "execute what a fix asserts" bends the major
curve. It caught two errors pre-launch, both citations, and missed two, both assertions about a
binary's behaviour — inside the passage rewritten to end that very failure class. So the rule gains:
a claim about how something behaves is unverified until the thing has been run or read, and *partly
confirmed counts as unverified*. Applied to this round's fixes before the lanes launched: the four
resolver rungs, their order, the basename array and the `where.exe` call were all read out of the
installed binary rather than taken from a reviewer.

**Changed since Round 11:** the resolver passage now states all four rungs correctly — rung one
accepts `bash.exe`, `sh.exe`, `bash` or `sh` lowercased, and rung four *does* consult `PATH` through
`where.exe git`, reversing a claim the Spec made twice; the acceptance brief's staging lever changes
accordingly, since removing `git` from the harness's `PATH` defeats rung four and is far easier than
what the brief previously demanded; the renormalization check moves to a scratch clone, because
Stage 3 writes `PLAN.md` and `COMPLETION.md` and so never has the clean tree that check needs; the
`CODEX_HOME` warning compares paths after normalization, since `C:\Users\Collin\.codex` and
`/c/Users/Collin/.codex` are one folder in two spellings; the destination report prints only when a
rung other than plain `HOME` was taken, so ordinary Linux installs gain no output; the escaping
validation takes a literal expectation rather than the helper's own output, which would otherwise
compare helper against helper; `sensitivity/AGENTS.md:18`'s "A refusal is never a repair" joins the
sweep, since the block-removal branch refuses *by* removing; the Spec now asks for the report the
acceptance run requires; and the non-ASCII carve-out moves into `IDEA.md`, which was the one place
the Spec granted itself an exception to its own north star.

**The rule was aimed one step too late, and both lanes found it.** Three of round 11's triage rows
described text that was never written — the non-ASCII carve-out "now lives in the idea", the report
"prints only when a rung other than plain `HOME` was taken", "both the writer contract and that
boundary now name it". None of those edits landed. The cause is mechanical: these documents are
edited by string replacement, and a replacement whose pattern does not match silently changes
nothing while the script reports success. The rule verified what a fix *claimed* and assumed the fix
was *in the file*.

Fixed at the tool, not by resolve: every edit now asserts its pattern matches before applying and
that the result is present after, and every claimed fix is grepped back out of the document before
its triage row is written. Applying that to this round's fixes caught four patterns that would have
silently no-opped, including the same idea edit that failed last round.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| both | blocking | **S1** The non-ASCII carve-out is not in `IDEA.md`; round 11 recorded it there twice | upheld | Never written — the replacement pattern did not match and the script said it had. Now in "What good looks like", grepped back |
| intent | major | **S2** `.gitattributes`'s attribute is never named in twelve rounds, and the idiomatic `* text=auto` reproduces the exact failure the rule exists to kill under `core.eol=crlf` | upheld | Measured here: `* text=auto` checks the shebang out as CRLF, `* text=auto eol=lf` does not. Invisible on Linux, would have surfaced first at the Windows acceptance run. The best finding of the review, at Spec item one |
| intent | major | **S3** The reachability check cannot answer its own question: rung one reads the *harness's* `process.env`, into which settings-file `env` blocks are merged at startup, and rung four resolves `git` through the *harness's* `PATH` — neither visible to `install.sh` | upheld | Read out of the binary. The check now reproduces only the rungs the installer can see and its message says it **could not confirm**, naming the two things it cannot. Weaker than promised and it is what is actually available |
| intent | major | **S4** The new staging lever therefore asserts an outcome the mechanism cannot produce — run from a Git Bash whose own `PATH` has `git`, the installer does not warn | upheld | The brief now names all four rungs in the harness's environment and states what the installer will actually emit |
| both | major | **S5** The destination report's conditional governed only the rung name, so destinations printed on every install — the unenumerated Linux output R5 rejected | upheld | The conditional now governs the whole line |
| both | major | **S6** The `sensitivity/AGENTS.md:18` and `protocol/sensitivity.md:85-89` refusal contracts exist only in review rows, never in the sweep | upheld | Both named in the sweep now, grepped back |
| mechanics | major | **S7** The non-ASCII branch was platform-unqualified, so a Linux clone under a non-ASCII directory would lose a block it gets today — a fifth Linux change | upheld | Qualified to Windows |
| both | minor | **S8-S13** The garbled clause R7-R13 recorded as fixed was still there; the README count said seven against two-plus-six; the renormalization check had no owner after moving to a scratch clone; the PowerShell fallback was marked unmeasured though it is in the binary the resolver was read from; `MAP.md` carried the retired file-API premise in a third place; and `IDEA.md` stated as settled what the acceptance brief says must be recorded as a finding | upheld | All fixed and grepped back |

### Round 11 — 2026-09-01

**Lanes:** GPT / gpt-5.6-sol (mechanics lens); Claude / default reviewer model (intent lens);
cross-family: yes. No document is edited until both lanes return.

**New working rule, applied from here.** Ten rounds produced a flat rate of ~7 major findings, and
four of round 10's seven were defects in fixes made during rounds 8 and 9 — a check that could
never pass, a variable honoured without asking what its value means, a branch made circular by its
own repair. The cause is consistent: fixes written quickly and asserted rather than run. So: no fix
is recorded without executing what it asserts, and no triage row says "corrected" until the changed
text has been re-read. **This round's fixes were audited under that rule before the lanes launched**
— ten claims checked, two wrong: `install/test/run.sh:105` was a reviewer's citation I had copied
without checking (the assertion is at `:113`), and the Git Bash resolver was stated as fully
extracted when only three of its four elements are literal strings I confirmed in the binary. Both
corrected, and the resolver passage now says which parts are verified here and which come from a
reviewer's reading.

**Changed since Round 10:** the `--renormalize` check becomes the real run plus `git status
--porcelain`, since `--dry-run` names every path unconditionally — measured, and both earlier wrong
forms are recorded so the third is legible; the Git Bash check reproduces Claude Code's four actual
resolver rungs instead of reasoning about `PATH` (that rewrite was itself wrong about `PATH`, and
round 11 corrects it); the
"hidden from the harness" scenario states what staging it actually requires, since removing Git from
`PATH` does nothing; `CLAUDE_CONFIG_DIR` refuses a relative value, because Claude resolves it
against the working directory and the installer's differs from the harness's; every destination is
normalized out of Win32 backslash form before any POSIX consumer; the non-ASCII trigger moves to
write time, where it is visible, resolving a circularity; the `/implement` fixture must route tasks
to a GPT lane, since task content selects the family; D42 records the `CLAUDE_CONFIG_DIR` policy;
the report names which rung produced each destination; and the doc sweep gains
`protocol/sensitivity.md:85-89`, `sensitivity/AGENTS.md`, `CONTRIBUTING.md` and `skills/AGENTS.md`.

**Did the rule work? Partly, and the miss is instructive.** It caught two errors before launch —
both citations, which are cheap to check. It missed two, both assertions about a binary's behaviour,
both inside the passage rewritten to end this exact failure class. Cheap checks got done; the check
that needed reading a binary got done halfway and then written past. The rule needs a second clause:
a claim about something's behaviour is unverified until the thing has been run or read, and
"partly confirmed" is unverified.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| both | major | **R1** The Spec asserts twice that Claude Code's resolver "never consults `PATH`" — false: its fourth rung resolves `git` via `where.exe`, which searches `PATH`. The acceptance brief then rules out a staging lever that works | upheld | Confirmed in the binary myself: `where.exe` is there. The false claim was load-bearing — it told the Windows agent that removing `git` from `PATH` does nothing, ruling out the easiest way to stage the check the brief calls hardest to arrange. Both corrected |
| intent | major | **R2** Rung one's predicate was "named `bash` or `sh`"; the binary accepts `bash.exe`, `sh.exe`, `bash`, `sh`, lowercased. Implemented literally it rejects `...\bin\bash.exe` and warns on a working machine | upheld | Confirmed: the four-element array is a literal string in the binary. This is the failure the passage was rewritten to prevent, reintroduced by the rewrite. The lane also found I *under*-claimed the ordering and fourth rung, which are exactly right |
| mechanics | major | **R3** The renormalization check needs a clean tree, and Stage 3 never has one — it writes `PLAN.md` before work and `COMPLETION.md` before exit | upheld | The check now runs once on a scratch clone with `.gitattributes` applied and nothing else modified, which is the only condition where its output means anything |
| mechanics | major | **R4** The `CODEX_HOME` warning never defined path equivalence: `C:\Users\Collin\.codex` and `/c/Users/Collin/.codex` are one folder in two spellings, so a textual comparison warns on every Windows install already going to the right place | upheld | Compared after normalization, with the agreeing-spellings case as its own validation |
| mechanics | major | **R5** The destination-rung report has no platform contract — emitting it on every install adds Linux output beyond the idea's exhaustive list | upheld | It prints only when a rung other than plain `HOME` was taken, so an ordinary Linux install prints nothing new |
| mechanics | major | **R6** The block-removal branch makes `sensitivity/AGENTS.md:18`'s "A refusal is never a repair" false, and the sweep does not reach it | upheld | Verified. That branch refuses *by* removing something. Both the writer contract and that boundary now name it |
| intent | minor | **R7-R13** The escaping validation is self-confirming if both sides use the helper — demonstrated by the lane; `MAP.md` carried the retired file-API premise in the second of two places, recorded fixed last round; a duplicated garbled clause introduced by this round's edits survived the re-read rule; the acceptance run required a resolution report no Spec item asked anyone to build; `WINDOWS-RESULTS.md:245` is the command line and `:246` the path; `INHERITED.md` said "two places above" where both are below; `README.md` states the home path unconditionally twice, not once; and `IDEA.md` had no non-ASCII carve-out while the Spec created one — the one place the Spec granted itself an exception to its own north star, which it elsewhere calls backwards | upheld | All fixed. The carve-out now lives in the idea |

### Round 10 — 2026-09-01

**Lanes:** GPT / gpt-5.6-sol (mechanics lens); Claude / default reviewer model (intent lens);
cross-family: yes. No document is edited until both lanes return, so both review the same text —
round 9 failed that and its intent lane reviewed a moving target.

**Changed since Round 9, and one thing changed *during* it.** Reviewed by nobody so far, and
first in scope: `CLAUDE_CONFIG_DIR` enters the destination precedence above the Windows user
folder, honoured outright rather than warned about because nothing in this repo sets it — landed
after round 9's scoping paragraph was written, so it is in no previous brief.

The rest: `explorer.exe`'s three properties are marked as documentation rather than measurement,
and acceptance now requires an actual browser window plus its exit status recorded; the staged
fixtures gain `COMPLETION.md` for `/verify` and a Spec substantial enough to defeat
`protocol/implementation.md:11-13`'s small-patch bypass for `/implement`; the non-ASCII acceptance
check establishes which branch applies before asserting either, and the dial writer removes an
existing block rather than leaving a stale one; the three `sed` metacharacters are described by how
each actually fails, since `|` aborts the installer rather than corrupting silently; the
`--renormalize` check becomes `--dry-run` from a clean tree, because on a dirty one it stages
everything and proves nothing; the idea's Linux change-list goes to four and names the `CODEX_HOME`
warning's output; `IDEA.md` stops claiming Claude without Git Bash loses the same commands as
Codex; the two new destination rungs gain validation cases; `MAP.md` and the Spec stop asserting an
`autocrlf` mechanism the one Windows run observed *not* to happen; and D1, D16 and D40 lose
rationales their own later fixes invalidated.

**Both headline questions answered.** Honouring `CLAUDE_CONFIG_DIR` is correct and the asymmetry
with `CODEX_HOME` is sound — the intent lane verified against the installed harness that the
variable relocates the config root, that `CLAUDE.md` and `skills/` hang off it, and that nothing in
this repo sets it. And the Spec is still the simplest shape for its promise: ten items, each
traceable to a measured failure, nothing it would cut. Both lanes ran mechanisms rather than
reasoning about them, which is where every finding below came from.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | **Q1** `git add --renormalize . --dry-run` prints `add '<path>'` for **every** path unconditionally, so "names no file" is unachievable on any tree | upheld | Reproduced: a two-file repo with one CRLF blob had the dry run name both and the real run stage one. Round 9's fix replaced a check that was wrong on a dirty tree with one wrong on every tree. The discriminating form is the real run then `git status --porcelain`, and both wrong versions are recorded so the third is legible |
| intent | major | **Q2** The Git Bash reachability check is aimed at the wrong mechanism: Claude Code's resolver never consults `PATH`, and on the machine cited it already succeeds, so a worker building the check from the Spec's hints warns on a working machine | upheld | The lane extracted the resolver from the installed binary. My whole line of reasoning from C2's `where bash` output was a red herring. **Partly wrong as recorded:** round 11 established that rung four does consult `PATH`, via `where.exe git` — the reviewer's "never consults `PATH`" was too strong and I repeated it into the Spec. See R1 |
| intent | major | **Q3** The "Git Bash hidden from the harness" scenario is not stageable by anything the plan implies — `PATH` is ignored and an invalid `CLAUDE_CODE_GIT_BASH_PATH` only logs a fallback | upheld | The brief now says exactly what staging it requires, and to skip and say so rather than report a pass if that cannot be arranged |
| intent | major | **Q4** `CLAUDE_CONFIG_DIR` and the Windows-user-folder rung both hold backslash Win32 paths, and the Spec never says whether the resolution normalizes before every consumer, all of which are POSIX shell | upheld | The plan is fanatical about the *rendered* form and forgot the *destination*. Normalized at the resolution |
| mechanics | major | **Q5** `CLAUDE_CONFIG_DIR` has no contract for relative values, which Claude resolves against the working directory — so the installer's and the harness's differ | upheld | Measured both ways. Refused with an explanation rather than guessed at |
| mechanics | major | **Q6** The non-ASCII branch was circular: the writer is told to act on a condition only the post-install read discovers | upheld | Resolved by locating the trigger correctly — a non-ASCII byte in the root about to be substituted is visible at write time. The acceptance run establishes whether that trigger is the right one, which is a different question |
| mechanics | major | **Q7** The staged `/implement` fixture still would not force the mechanic under test: task content selects the lane family, so a substantial Spec can dispatch only Claude lanes | upheld | The fixture's tasks must route to a GPT lane, which is the Git-Bash-dependent path |
| both | minor | **Q8-Q18** The idea said four Linux changes in one paragraph and three in the other, and still described two shell-invoking rule documents where the map now says four; the Spec's destination section declared one non-Windows change while making two; D1 kept a backslash rationale its own escaping helper removed; the doc sweep missed `protocol/sensitivity.md:85-89`'s writer contract, `sensitivity/AGENTS.md`'s Boundaries, and the unconditional home-path claims in `README.md`, `CONTRIBUTING.md` and `skills/AGENTS.md`; the block-removal branch's exit status was unspecified, which decides whether the installer prints "installed" or "warning"; there was no Decision Log row for honouring `CLAUDE_CONFIG_DIR` and no report line naming which rung produced a destination; the new rung's ordering was asserted nowhere; `install/test/run.sh:113`'s safety net watches a file that may no longer be the target (the reviewer cited `:105`; the assertion is at `:113` — checked); `MAP.md` kept the file-API premise D16 retired and cited `protocol/lanes.md:142-143` where it is `:141-142`; and `INHERITED.md` referred to a section that left with this plan | upheld | All fixed, each verified individually |

### Round 9 — 2026-09-01

**Lanes:** GPT / gpt-5.6-sol (mechanics lens); Claude / default reviewer model (intent lens);
cross-family: yes.

**Changed since Round 8:** the shared path helper now escapes `&`, backslash and the `sed`
delimiter, with a validation case for each — a clone path containing `&` corrupts every wrapper
today, on every platform; the unresolvable-destination case has one behaviour instead of two
contradictory ones, and stops the install before anything is written while the dial writer's other
refusals still warn and complete; the non-ASCII clone path gets a bounded remedy — the block is not
installed and the dial behaves as `ask` — replacing my earlier claim that it blocks the change,
which conflated two different readers; the re-checkout guard requires `HEAD` to be the commit under
test rather than merely present; the Windows command criteria now stage a plan directory at the
right `status:` for each stage command and drive `/plan` to a shape-bearing turn, since every one
of them refuses out of order by design and would otherwise pass without testing anything;
`README.md`'s two harness-parity claims join the sweep, making it six edits; and the C6 precision,
the `sensitivity.md` citation, the duplicated ASCII disclaimer, the one-versus-two Linux changes,
the acceptance list's ordering and `INHERITED.md`'s retraction position are all corrected.

**Process failure: the documents moved during the round.** I applied the mechanics lane's fixes
while the intent lane was still reading, so its findings are against a mid-round snapshot and it
said so. Worse, the `CLAUDE_CONFIG_DIR` precedence rung landed after this round's own scoping
paragraph was written, so it is in **no** reviewer's brief and is unreviewed. Round 10 scopes it
explicitly. Fixes wait for both lanes from here.

**On over-repair, asked directly:** the intent lane's verdict was no — ten Spec items, each tracing
to a failure measured on the real machine plus its documentation consequence, with no simpler shape
that keeps the promise. What it found instead was scar tissue in the prose, which is most of the
table below.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | blocking | **P1** The resolver ignores `CLAUDE_CONFIG_DIR`, which relocates every `~/.claude` path including the always-on file and `skills/`, so it would install Claude's wrappers where Claude does not read them | upheld | The gap the Spec had left to the acceptance run to discover. Honoured rather than warned about, because nothing in this repo sets it — the asymmetry with `CODEX_HOME`, which `protocol/lanes.md:33` sets for every GPT lane, is the whole reason that one is only warned about |
| mechanics | blocking | **P2** The non-ASCII branch had mutually exclusive required outcomes, and "not installing" the block leaves an existing one intact because `sensitivity/set.sh:219-223` replaces a valid block in place | upheld | The writer now removes any block it finds. The acceptance check is also conditional on which branch applies rather than asserting one outright |
| intent | major | **P3** `IDEA.md` still said Claude without Git Bash "loses the same commands Codex does", which round 7 upheld as blocking and the Spec now denies | upheld | The north star was the one place that fix never reached. It names the four |
| intent | major | **P4** `explorer.exe`'s three asserted properties are unmeasured, in the one item the idea promises is checked on the real machine — and the suite case points `WHEELCHAIR_BROWSER` at a fixture, so the default opener is never taken | upheld | Sharp. The Spec now says plainly that those properties come from documentation and not from measurement, and acceptance requires a browser window to actually appear plus the exit status recorded |
| intent | major | **P5** The staged-fixture criterion is incomplete: `protocol/verification.md:6` needs `COMPLETION.md` as well as the status, and `protocol/implementation.md:11-13`'s small-patch bypass lets a trivial Spec skip the lane dispatch under test | upheld | Both staged properly |
| intent | major | **P6** The non-ASCII acceptance check was unconditional while the behaviour it asserts is decided by that same run | upheld | Restructured to establish the branch first |
| intent | minor | **P7** A `\|` in a clone path does not silently corrupt — it aborts the installer after truncating the wrapper through the redirect | upheld | Ran it: `sed: unknown option to 's'`. All three metacharacters now described by how they actually fail, which differs per character |
| intent | minor | **P8** `git add --renormalize .` on a dirty tree stages every modified file, so "its emptiness confirmed" proves nothing as written | upheld | Verified — it staged this plan's own documents. The check is now `--dry-run` from a clean tree naming no file |
| both | minor | **P9-P16** D1 and D16 still credited a backslash argument the escaping helper removed; the four other dial refusals were named twice with contradictory consequences; a dangling sentence fragment sat in the encoding section; `protocol/sensitivity.md:91-94`'s categorical "warns without failing" needed its exception named in the sweep; D40's rationale was wrong that both consumers are install-time; the two new destination rungs had no validation case by the plan's own argument; `MAP.md` and the Spec asserted an `autocrlf` mechanism the one Windows run observed **not** to happen; and this round's changed-since list was stale before the round began | upheld | All fixed. `git config core.autocrlf` on that machine was never captured though it is one command — recorded as unestablished rather than asserted either way |

### Round 8 — 2026-09-01

**Lanes:** GPT / gpt-5.6-sol (mechanics lens); Claude / default reviewer model (intent lens);
cross-family: yes.

**Changed since Round 7:** the Spec's opening line now states the narrowed promise instead of
"both harnesses work"; the encoding item admits it had no free remedy and names the two suite
assertions the ASCII restriction changes; the non-ASCII clone path gains an acceptance check
rather than existing only in prose; the destination resolution moves to before any wrapper is
rendered, so a refusal writes nothing rather than leaving wrappers somewhere arbitrary; the
Windows re-checkout is guarded against erasing the commit under test; the acceptance brief
distinguishes the Claude-without-Git-Bash failure set from the Codex one and records the
protocol's undefined behaviour for a present-but-unreachable family; C6's criterion becomes "the
path resolves" rather than "a first-party reader opens it"; `sensitivity/AGENTS.md` gains a line
instead of losing one that never existed; `README.md`'s four edits are all named; `MAP.md` gains
the two shell-invoking protocol files it had missed; and `INHERITED.md`'s ownership retraction
moves ahead of the rows it retracts.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | major | **N1** The substitution never escaped its own metacharacters. `&` in a `sed` replacement means the whole match, so a clone at `C:/Users/A&B/wheelchair` renders as `C:/Users/A{{WHEELCHAIR_ROOT}}B/wheelchair` | upheld | Reproduced by running it. Eight rounds of discussing backslashes in this substitution and nobody, including me, checked `&`. Broken on Linux today too. The shared helper now escapes `&`, `\` and the delimiter, and validation covers all three |
| intent | major | **N2** The Spec gave two mutually exclusive behaviours for an unresolvable destination — warn-and-complete in one paragraph, write-nothing in the next | upheld | Both mine; I added the second last round without removing the first. Now: an unresolvable destination stops the install before anything is written; the dial writer's other refusals still warn and complete, because by then the wrappers are legitimately in place |
| both | major | **N3** The non-ASCII clone path was still an unresolved design decision while Open Questions said none | upheld | Given a bounded remedy: the block is not installed on that machine and the installer says why, so the dial behaves as `ask` and nothing else is affected. My earlier "this blocks the change" was wrong — it conflated the block's reader with the wrappers', which C6 measured separately |
| mechanics | major | **N4** The re-checkout guard confirmed the commit under test was *present*, which still lets a reset restore a different one | upheld | `HEAD` must equal it |
| mechanics | major | **N5** The Windows command criteria could pass without exercising anything: the stage commands refuse out of order by design, and `/plan` was not required to reach a shape-bearing turn | upheld | Sharp. The brief now stages a plan directory at the right `status:` for each command and drives `/plan` to the graph turn; a command that refuses at its gate is recorded as not established, not as a pass |
| mechanics | minor | **N6** `README.md`'s opening claims the workflow "runs the same from Claude Code and from the Codex CLI", which this change falsifies, and the sweep called itself exhaustive at four edits | upheld | Six edits now, with both parity claims named |
| both | minor | **N7-N12** The C6 precision was still wrong in the idea and overclaimed in the Spec; `MAP.md` cited `protocol/sensitivity.md:100` where the invocation is `:101`; the ASCII disclaimer appeared twice twelve lines apart; the idea said "one thing changes" and "two things" in different paragraphs; the acceptance list's blocking first check was its last bullet; and `INHERITED.md`'s retraction sat after what it retracted | upheld | All fixed and each verified individually rather than declared. Five of these were recorded "All corrected" in round 7's triage without being checked — the triage rows were themselves unverified claims, which is now the thing I check before writing one |

### Round 7 — 2026-09-01

**Lanes:** GPT / gpt-5.6-sol (mechanics lens); Claude / default reviewer model (intent lens);
cross-family: yes. The intent lane died once on a server-side `529 Overloaded` and was relaunched
rather than triaged around — a dead lane means no round, not a one-lane round, which is the
mistake round 6 made.

**Changed since Round 6:** the promise is Claude Code on Windows, with Codex stated as
installable-but-not-usable and the count corrected to seven of eight in every document that
carries it; `CODEX_HOME` is withdrawn from the precedence and its misdirection recorded as an
accepted risk, because honouring it would make a GPT lane install into a credentials slot;
`install/AGENTS.md` is created rather than assumed and the third root table is named;
`git add --renormalize` is documented as the no-op it is, with a re-checkout as the acceptance
run's blocking first step; a non-ASCII clone path breaking the encoding now blocks rather than
becoming an accepted risk; `install.cmd` is named literally; the two shared helpers are settled in
`install/` with the second plan's claim on them withdrawn; and `MAP.md`'s C6 attribution is
corrected to the `node_repl/js` capability it actually was.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| — | — | **Count independently re-derived.** The intent lane traced all eight skills and their stage documents itself and confirmed seven of eight, consistently stated. After three wrong counts, that is the first independent confirmation | n/a | Recorded because it is the one claim this review has broken most often |
| mechanics | blocking | **M1** The narrowed promise never reached the Spec's own opening line, which still said "Both harnesses work on native Windows" | upheld | The pattern again, in the sentence a worker reads first. Rewritten |
| mechanics | blocking | **M2** The acceptance brief wrongly requires the same seven commands to fail from Claude Code without Git Bash: review, implement and verify reach a Claude lane through the Agent tool, which needs no shell | upheld | Correct. What those three cannot reach is the GPT half of the cross-family pair, and the protocol has no stated behaviour for a family present on `PATH` whose invocation needs an absent shell. The brief now records what each actually does and names that gap as a finding in its own right |
| intent | major | **M3** The ASCII encoding remedy breaks the suite this plan promises will pass unchanged: `sensitivity/test/run.sh:257` and `:268` assert the region's wording verbatim, em-dashes included | upheld | Verified. My "bounded, needs no decision" claim was false — with the byte-order mark already ruled out, the item had no viable remedy at all. The two expected strings now change with the region, named explicitly so nobody reads "unchanged" as forbidding it |
| intent | major | **M4** The non-ASCII clone path was promoted to blocking last round and is exercised by no check | upheld | An acceptance bullet installs from a clone under a non-ASCII directory. A branch that blocks and is never tested is a branch that never fires |
| both | major | **M5** The sweep tells a worker to remove a `sensitivity/AGENTS.md` entry that does not exist — K3's failure on the other side of the same ownership move | upheld | Verified: that table has two rows and names no destination resolution. The instruction is now to add a line saying where `set.sh` gets it from |
| both | major | **M6** Creating `install/AGENTS.md` falsifies `README.md`'s router enumeration, which the sweep does not name | upheld | `README.md` needs four edits, now all four named |
| mechanics | major | **M7** The C6 acceptance criterion says "both harnesses' own file tools", but Codex reported no local reader and the successful read went through an optional `node_repl/js` server | upheld | The criterion is "the path resolves", and a session without such a capability is recorded as not established rather than as a pass |
| mechanics | major | **M8** The unresolvable-home lifecycle is undefined: wrappers are rendered at `install.sh:44-63`, before the dial writer at `:78`, so a late refusal leaves them already written somewhere arbitrary | upheld | Sharp. The resolution now runs before any wrapper is rendered: both destinations or neither, and on refusal nothing is written at all |
| mechanics | major | **M9** The Windows re-checkout can erase the implementation being accepted — `git reset --hard` with no precondition | upheld | Guarded: fetch, confirm a clean tree and that the commit under test is present, then reset |
| intent | minor | **M10-M16** The plan claims the drive-letter form is verified against Codex's own reader in three places while its own precision paragraph eleven lines above denies it; the "first item" of the acceptance list is its last bullet; D40 says `INHERITED.md` no longer claims the two helpers while its Spec prose still does; two different machine states share the word "hidden"; the `CODEX_HOME` risk never weighed simply warning; `protocol/lanes.md:80` states categorically what Windows contradicts; and `MAP.md` still said two files spell out shell when it is four, with a Problems list of five under a heading I had just changed to seven | upheld | All corrected. The last one was caught by my own enumeration check rather than by a reviewer, which is the first time that has happened |

### Round 6 — 2026-09-01

**Lanes:** GPT / gpt-5.6-sol (mechanics lens); Claude / default reviewer model (intent lens);
cross-family: yes.

**Changed since Round 5:** the Codex gap is stated as four commands everywhere it appears — the
idea, the non-goals, the doc sweep and the acceptance brief — rather than two; `CODEX_HOME` enters
the destination precedence, and is named as a pre-existing misdirection on every platform rather
than a Windows fix; the two shared helpers get a home in `install/` and a router line; the
encoding check gains a non-ASCII clone path and the Spec declines to claim it has solved that
case; `MAP.md`'s disproven premise about the rendered path is corrected in place with the
disproof stated; two Watch rows are re-marked as moved; the `CONTRIBUTING.md` validation no-op is
removed; a garbled Validation bullet is rewritten; and `INHERITED.md` gains three findings, a
Validation section and three known-unresolved design problems.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | **K1** "Four of the eight commands" undercounts exactly as "two" did: the honest set is **seven of eight**. Only `/adopt` reaches no shell recipe. `protocol/planning.md:130-137` makes `/plan` write a graph through `protocol/graphs.md`'s bash recipe and calls that trigger the floor at every dial level; `/plan-review`, `/implement` and `/verify` all need lanes | upheld | Verified against the eight skills and every stage document. Escalated to the user: this is the second consecutive round where the fix for an undercount was itself an undercount, and it falsifies the basis on which the split was agreed |
| intent | major | **K2** the idea still said "the two commands named above", and the second plan's idea inherited the wrong count too | upheld | Held for the escalation — the count itself is now wrong, so fixing the copies first would propagate a second wrong number |
| intent | major | **K3** `install/AGENTS.md` does not exist, so J3's resolution rests on a file that is absent | upheld | Verified: only root, `protocol/`, `sensitivity/`, `skills/` and `spine/` carry routers. The fix cited a file I did not check for |
| intent | major | **K4** The `install/` move also falsifies the third root table, which the sweep says it does not touch, and `README.md`'s layout block | upheld | Held for the escalation |
| intent | major | **K5** D38 is marked moved and assigns the two helpers to `shell/`, while they now live in `install/` here — so `INHERITED.md` and this plan both claim them | upheld | A real ownership collision created by the split. Held for the escalation |
| intent | major | **K6** `CODEX_HOME` in the precedence collides with this repo's own lane recipe: `protocol/lanes.md:33` runs every GPT lane as `env CODEX_HOME=<balancer slot> codex`, and lanes run `./install.sh` as validation, so a lane would render wrappers and the dial into the credentials slot | upheld | Verified. A genuine Linux regression the fix would have introduced, and no Validation case covers it because the suite always passes `WHEELCHAIR_CODEX_HOME`, which wins |
| intent | major | **K7** "From Claude Code, every wheelchair command works" has no Git Bash precondition, while the Spec builds a warning for exactly the case where Claude falls back to PowerShell — in which case the Claude side loses the same commands | upheld | Held for the escalation; it bears on the same promise K1 falsifies |
| intent | major | **K8** The sweep's honesty sentence has no destination: `MAP.md` records that no document claims a supported platform | upheld | Held for the escalation |
| intent | major | **K9** `git add --renormalize .` is a no-op on a Linux clone whose blobs are already LF, and supplies no repair for the Windows clone it is named for | upheld | Verified reasoning. The acceptance step would fail at something that is not the change's defect |
| intent | minor | **K10-K12** The non-ASCII encoding failure is routed to a plan that owns neither renderer; the `sensitivity/AGENTS.md` side of the ownership move is unnamed; and the `.cmd` is never given a filename while the sweep requires it to appear literally in two documents | upheld | Held for the escalation |

**Lane collection failure.** Round 6 was triaged on the intent lane alone: the mechanics lane
completed and its output was not collected before triage, which `protocol/plan-review.md` forbids
— a partial round is not a round. It was collected afterwards and its findings are below, marked
`late`. Both lanes independently reported the command undercount, the missing `install/` router
and the `--renormalize` no-op, so the triage above was not wrong; it was unsupported, which is a
different defect and is recorded rather than quietly repaired.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics (late) | blocking | **L1** The non-ASCII clone-path branch would ship a harness that corrupts the installed root path, leaving every wrapper unable to reach its protocol document | upheld | Correct and it overturns my own resolution: I had made that an accepted risk. The block carries the path every wrapper dereferences, so a decode failure there is the whole promise gone. It now blocks |
| mechanics (late) | minor | **L2** The corrected `MAP.md` attributes C6 to "Codex's own file reader", contradicting the precision the Spec already carries — it was an external `node_repl/js` capability | upheld | My correction reintroduced an imprecision round 3 had already fixed. Corrected in place |
| mechanics (late) | blocking / major | **L3-L6** The command undercount, the absent `install/` router, the `--renormalize` no-op, and the `CODEX_HOME` contradiction | upheld, already resolved | All four were independently reported by the intent lane and fixed before this lane was collected; `CODEX_HOME` was withdrawn entirely, which moots its two findings |

### Round 5 — 2026-09-01

**Lanes:** GPT / gpt-5.6-sol (mechanics lens); Claude / default reviewer model (intent lens);
cross-family: yes.

**Changed since Round 4:** the plan split. Three Spec sections — the per-turn recipes, the
cross-shell shim, and the `protocol/graphs.md` rewrite — moved wholesale to
`docs/plans/shell-free-recipes/`, along with eleven decisions and twenty-five findings. The idea's
promise narrowed to Claude Code fully and Codex partially, stated once instead of twice, with the
Codex gap named as a deliberate non-goal. Validation lost everything belonging to the moved half
and gained the write-contention and path-conversion cases. The acceptance brief now expects two
Codex commands to fail and treats a report that they worked as the finding. The encoding remedy
dropped the byte-order mark, which would have written outside the only bytes that writer may
touch.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| both | blocking | **J1** Four commands fail from Codex on Windows, not the two the plan names: `protocol/sensitivity.md:101-102` and `protocol/spine.md:20` also tell an agent to run a `.sh`, and their fix moved out with the shim | upheld | Checked. The idea, the non-goals, the doc sweep and the acceptance brief all named two. All four are now named everywhere, and the acceptance brief treats a report that any of them worked as the finding. Bringing the shim back was considered and declined: it would re-import a Node-side helper needing its own home and router, which is what the split removed |
| mechanics | blocking | **J2** The destination precedence ignores `CODEX_HOME`, so the install lands in the wrong directory for anyone who sets it | upheld | Checked, and it is worse than reported: `install.sh:21` and `sensitivity/set.sh:11` hardcode `$HOME/.codex` on every platform while `protocol/lanes.md:35` says an existing setting "remains theirs". Added to the precedence, and named as a Linux gain rather than a Windows fix |
| both | major | **J3** The two shared helpers lost their home when `shell/` moved out, silently reopening an upheld round-2 finding | upheld | They live in `install/`, which exists, already holds the installer's fixture suite, and is the one directory both consumers belong to. Its router gains the entry; no new directory appears |
| intent | major | **J4** The moved half's Validation is recorded in neither document, and `INHERITED.md` omits G3, H9 and F13 | upheld | The three findings and a full Validation section are now carried over, plus the three known-unresolved design problems the split dissolved rather than answered |
| mechanics | major | **J5** The encoding fallback does not cover a non-ASCII clone path: the block carries the substituted root, so ASCII-ing the source is not sufficient | upheld | The check now includes a non-ASCII clone path, and the Spec says plainly it does not claim to have solved a case it has not seen |
| intent | minor | **J6** Round 4's I4 resolution overclaimed: the installer's reachability check must also locate Git's own bash, so two locators in two languages remain | upheld | Acknowledged in the Spec rather than left as a false claim |
| intent | minor | **J7** Watch rows W10 and W11 record outcomes pointing at removed content | upheld | Both re-marked as moved, naming where they went |
| intent | minor | **J8** The doc sweep says three tables and names one plus a section that is not a table | upheld | The `Kind` table's `Executable` row is named |
| intent | minor | **J9** The sweep tells the worker to add to `CONTRIBUTING.md`'s validation list while the same sentence says nothing is added | upheld | Removed; it was left from when the lane runner contributed a suite |
| intent | minor | **J10** `IDEA.md` counts the write-contention fix as a Linux gain, but the failure was observed on Windows and the Linux suite is green | upheld | Replaced with the `CODEX_HOME` fix, which genuinely is one |
| intent | minor | **J11** `INHERITED.md` carried the `curl` write block citation without round 4's correction | upheld | Corrected to `protocol/graphs.md:473-484` |
| intent | minor | **J12** A Validation bullet is garbled mid-sentence | upheld | Rewritten |
| intent | minor | **J13** `MAP.md` still gives the disproven reason the rendered path is wrong, and the Spec sends the worker there first | upheld | Corrected in place, with the disproof stated rather than the sentence quietly swapped |

### Round 4 — 2026-08-31

**Lanes:** GPT / gpt-5.6-sol (mechanics lens); Claude / default reviewer model (intent lens);
cross-family: yes.

**Changed since Round 3:** the idea's Linux constraint is rewritten a third time, as "no Linux
user loses anything", with the changes this plan makes to Linux enumerated there instead of
carved out by the Spec; the stale Validation bullet demanding a returning `--open` is replaced by
`--start` coverage; `--start` gains a bounded wait and a failure contract; the runner writes its
result file as soon as the session identifier appears, prints that path on startup, and takes
`--no-wait` so lanes can run concurrently; `lanes/` is narrowed to the runner alone and a new
`shell/` owns the Git Bash locator, the script shim, the path conversion and the destination
resolution; the encoding item gains criteria and an ordered remedy; the acceptance list's
byte-for-byte comparison is corrected to the rendered region and gains shim coverage; the
`--read` page marker is assigned to `viewer/index.html`; and Validation gains runner exit-code,
exact-command, kill-mid-lane, `--start` failure and cross-shell cases.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | blocking | **I1** The idea stated its Linux promise twice — the "what good looks like" copy (since rewritten) still said "everything still behaves exactly as it does today. The same installer, the same commands, the same documents", contradicting the constraint, which had been rewritten three times | upheld | Checked. Three rewrites of one copy, none of the other. Fixed by rewriting both as part of the split: there is now one statement and a pointer to it |
| both | major | **I2** The documentation sweep names only `lanes/`; D38 also creates `shell/`, and `sensitivity/AGENTS.md:3` keeps ownership of a routine that moved out | upheld | Dissolved by the split — `shell/` and `lanes/` both move to shell-free-recipes, so the sweep has neither to name |
| both | major | **I3** A stale round-3 sentence still puts the Git Bash locator "beside the lane runner", contradicting D38 in the same Spec | upheld | Dissolved by the split — the locator moves out entirely |
| intent | major | **I4** The single locator cannot serve both its callers: the `.cmd` runs where no POSIX shell exists, so a bash helper is uncallable from it, while a Node helper reintroduces D9's failure since Node is only established inside the installer | upheld | Dissolved by the split — the `.cmd` is the only caller left here, so it locates Git Bash in batch and nothing has to serve two languages. Recorded in the inherited material as a trap for the second plan |
| intent | major | **I5** The page-marker fix breaks a green Linux test the Spec does not name: `viewer/test/server.test.js:1000-1004` marks a graph watched with a plain `GET` and asserts a second `--show` opens nothing | upheld | Dissolved by the split — the page-marker change moves out, and the green test it would have broken stays green |
| both | major | **I6** `--no-wait` restores concurrency with no join step and no completion lifecycle — the runner must exit while still owing an updated result file, and no subcommand waits on one | upheld | Dissolved by the split — `--no-wait` moves out. Recorded as an open design problem in the inherited material |
| intent | major | **I7** The encoding comparison's "rendered region" omits the path conversion, so it fails spuriously on Windows | upheld | Fixed. The comparison is against the region as rendered for that machine, including the path conversion |
| intent | major | **I8** The first-ordered encoding remedy writes a byte-order mark at offset 0, outside the only bytes the writer is allowed to own — `sensitivity/AGENTS.md:17` | upheld | Fixed, and the remedy inverted: a byte-order mark is ruled out because it lands outside the markers, so the ASCII restriction is the remedy rather than the fallback |
| both | minor | **I9-I17** `shell/` gets no suite or command while `lanes/` does; the `--port`/`--cache-root` resolution never landed in the Spec; "three helpers" names four; the `graphs.md` rewrite preserves a fact about a command the recipe no longer calls; the idea's enumerated changes omit the watched-marking change and its headline still contradicts them; the ASCII fallback contradicts `protocol/writing.md:136`; `--no-wait`'s exit status is unstated; `--start`'s diagnostic is promised but unasserted; and the `curl` write block is `protocol/graphs.md:473-484`, not `:477-486` | upheld | Most dissolved with their subject. The survivors are fixed: the idea\'s two promises are one, the encoding remedy no longer contradicts `protocol/writing.md`, and the `--port`/`--cache-root` and `graphs.md` items moved out |

### Round 3 — 2026-08-31

**Lanes:** GPT / gpt-5.6-sol (mechanics lens); Claude / default reviewer model (intent lens);
cross-family: yes.

**Changed since Round 2:** `--open` is left untouched and a new `--start` supervises it,
replacing the detach entirely — the idea's Linux constraint is restored and the amendment
withdrawn; `/diagram-sensitivity` and `/spine` join the scope through a Git Bash locator shared
with the `.cmd`; `--read` no longer marks a graph watched; the runner spawns detached so it
outlives its caller, surfaces the command it ran, and has defined exit semantics;
`implementation.md`'s worktree rule stays while its dispatch sentence goes; the `graphs.md`
rewrite covers the root block and the interpolating `--show` line; both renderer suites learn
the path conversion; the shared helpers get a home in `lanes/` with a router; the encoding check
compares against the rendered region; `launchBrowser` becomes awaitable; and Validation gains
the runner suite command, a diverging-home fixture, an opener-error case, a readiness case and a
`--read`/`--show` case.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| both | blocking | **H1** Validation still demanded a detached `--open` that returns, which the Spec now forbids — an impossible test | upheld | Checked. D34 rewrote the Spec section and not its Validation bullet; the bullet now covers `--start` and leaves `--open`'s tests alone |
| both | blocking / minor | **H2** Restoring the idea's literal Linux constraint conflicts with making a swallowed browser-launch failure visible, and with the recipes changing at all; the Spec had granted itself the exception in its own text | upheld at blocking | Checked at `viewer/server.js:1542-1544`. The constraint was mine and was always too literal — it is rewritten to say what it meant, with the Linux changes enumerated in the idea rather than carved out by the Spec. D36 |
| mechanics | major | **H3** `--start` has no bounded wait or failure contract; the recipe it replaces printed the log it had been polling | upheld | A failure contract added: bounded wait, names which failure occurred, surfaces the child's output, exits non-zero |
| both | major | **H4** The runner's detached spawn preserves the lane but not its handle: the session identifier and command exist only in the JSON printed on return, so a killed caller loses them | upheld | The result file is now written as soon as the session identifier appears, and its path printed on startup. D37 |
| intent | major | **H5** Deleting backgrounding removed the only stated way to run lanes concurrently, which `protocol/plan-review.md:37` requires | upheld | `--no-wait` returns once the result file exists, so a stage can start several and wait on their files. D37 |
| intent | major | **H6** Putting a Git Bash locator in `lanes/` makes that router false and recreates the drift `/spine` exists to fix | upheld | Checked. `lanes/` holds the runner only; a new `shell/` owns the locator, the shim, the path conversion and the destination resolution, with its own router. D38 |
| mechanics | major | **H7** The encoding branch is an unresolved decision while Open Questions says none: no remedy and no criteria | upheld | Criteria and an ordered remedy stated, both bounded and neither needing a decision, so implementation does not stop |
| mechanics | major | **H8** The Windows acceptance list still demanded a byte-for-byte match against the source, which substitution makes impossible | upheld | Corrected to the rendered region, matching the Spec |
| mechanics | major | **H9** Nothing validates the cross-shell shim: the suites invoke the scripts directly and acceptance never runs either command through it | upheld | Acceptance now runs `/diagram-sensitivity` and `/spine` from a Codex session |
| mechanics | minor | **H10** The shared-helper home omitted the destination-resolution routine the Spec separately requires both renderers to share | upheld | Folded into `shell/` with the others |
| mechanics | minor | **H11** Runner validation asserts neither the exact-command field nor the runner-level non-zero cases | upheld | Both added, plus a kill-mid-lane case for the result file |
| intent | minor | **H12** "`--show` and `--stop` are unchanged" contradicts the browser section two sections later | upheld | Reworded to say what actually changes |
| intent | minor | **H13** The `--read` fix was ambiguous about who marks a read as a page's, and one reading needed an unnamed `viewer/index.html` change | upheld | The page marks itself, `viewer/index.html` is named, and any future non-page client inherits the correct default |
| intent | minor | **H14** The new subcommands' cache-root and port handling is unstated while Validation requires coverage | upheld | They take `--port` and `--cache-root` like every other entry point, as the root router requires |
| intent | minor | **H15** Citation off-by-one: the `--report` invocation is `protocol/sensitivity.md:102`, not `:103` | upheld | Corrected |

### Round 2 — 2026-08-31

**Lanes:** GPT / gpt-5.6-sol (mechanics lens); Claude / default reviewer model (intent lens);
cross-family: yes.

**Changed since Round 1:** the path section now covers both renderers and converts at the
substitution; the lane flags are corrected to match `lanes.md`; `.cmd` is exempted from the LF
rule and a renormalize step added; the install check's Claude-side claims are marked as
documented rather than measured; the destination routine now owns the wrapper homes too; the
runner's unverified rule is replaced by a silent-command count; `--write` takes the graph alone
with the hash as a flag; the backgrounding instruction moves out of `implementation.md`; the
browser section names `explorer.exe`, defines "handed off", and retracts the claim that the
suite corroborated the bug; the child-graph skip is narrowed to platform limits only; a new
encoding section and a new acceptance-run requirement; Validation extends the runner suite; and
`--open` detaches with the test-helper rewrite named as in-scope, against an amended idea
constraint.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | **G1** The `--open` detach fix is materially incomplete. Four further sites depend on the spawned process *being* the server, and one class cannot be repaired by a pid lookup at all: `viewer/test/server.test.js:1042-1045` asserts one racer stays alive and one exits; `:1058-1059` SIGKILLs `first.child` to manufacture a stale lock; `spawnHookedServer` at `:176-181` injects `--require` into the `--open` process so the hook at `:147-165` can freeze the lockfile-claim window, and `--require` does not reach a re-spawned child | upheld | Checked, all four. Reopens the decision — see Q1. The lead's Q1 framing was wrong on this point and the user agreed on it |
| intent | major | **G2** The amended idea constraint says "the only thing that depended on the old arrangement was this repo's own test helper", which G1 falsifies | upheld | The sentence is the lead's, written into `IDEA.md` off the same wrong premise. Corrected as part of Q1 |
| mechanics | blocking | **G3** `/diagram-sensitivity` and `/spine` still tell an agent to run a `.sh` directly — `protocol/sensitivity.md:101`, `:103`, `protocol/spine.md:20` — so two of the eight commands stay broken under PowerShell | upheld | Checked. A real scoping hole: "the per-turn recipes" was drawn around `lanes.md` and `graphs.md` only, and never asked which other protocol files spell out a command |
| mechanics | blocking | **G4** `--read` would suppress a later `--show`: every GET marks the graph watched (`viewer/server.js:1326`) and `--show` declines to launch when watched (`:1559`) | upheld | Checked. Introduced by this plan's own new subcommand |
| mechanics | blocking | **G5** Backgrounding exists so a foreground timeout cannot kill a lane (`protocol/lanes.md:94`); D28 deletes it and makes the runner blocking without preserving that protection | upheld | Checked. The runner must outlive its caller, which the Spec never says |
| mechanics | major | **G6** The `graphs.md` rewrite omits the `WHEELCHAIR=<root>` block at `:415-417`, and the surviving `--show` line at `:510` interpolates two shell variables; nothing says how a single-command recipe names an absolute path under PowerShell | upheld | Checked |
| intent | major | **G7** The runner's output does not satisfy `IDEA.md:49`, "the person can see the command that did it", and `protocol/lanes.md:9-10` gives inspectability as the reason this workflow uses `codex exec` at all | upheld | The runner must surface the command it ran |
| intent | major | **G8** Converting at the substitution breaks suite assertions that re-run the same substitution with the shell's own root — `install/test/run.sh:48`, `:58`; `sensitivity/test/run.sh:217`, `:220`, `:288` | upheld | Not a "Windows cannot represent" skip; the assertions must learn the conversion |
| intent | major | **G9** D28 removes the dispatch mechanism but leaves `protocol/implementation.md:77-80`'s worktree rule depending on it, and never says whether `protocol/lanes.md:94` survives | upheld | Resolved together with G5 |
| intent | major | **G10** Two fixes each require "one shared thing used by both scripts" and neither says where it lives, in a repo whose rule is that anything owning something carries a router | upheld | Needs a home and a router line |
| mechanics | major | **G11** Detached `--open` has no readiness contract: the URL is printed after `listen` today, but a launcher could return before the detached server accepts the write that follows | upheld | Folded into Q1 — the answer changes what this needs |
| mechanics | major | **G12** The encoding acceptance check is not implementable as written: rendering substitutes the root and the level, so the landed block cannot match the source byte-for-byte | upheld | Compare against the rendered region, as `sensitivity/test/run.sh:214-220` already does |
| mechanics | major | **G13** The runner contract does not say whether its process propagates a lane's non-zero exit or always exits zero with the status in JSON | upheld | Specified |
| mechanics | minor | **G14** Validation never exercises the destination rule's motivating case — no measured machine had `$HOME` and the Windows folder differing, and the Linux suite always passes explicit overrides | upheld | Needs a fixture with them diverging |
| mechanics | minor | **G15** Validation proves only successful browser handoff; no case makes the opener emit `error` | upheld | Added |
| intent | minor | **G16** `launchBrowser` returns `true` synchronously while the `error` it must report arrives asynchronously (`viewer/server.js:1541-1545`) | upheld | It becomes awaitable |
| intent | minor | **G17** Round 1's F2 row cited D25; the F2 decision is D33 | upheld | Corrected |
| intent | minor | **G18** The acceptance brief asks for `git ls-files --eol` showing LF while D27 pins the `.cmd` to CRLF | upheld | The check must expect exactly that one exception |
| intent | minor | **G19** The documentation sweep names one `AGENTS.md` table; the change falsifies two others | upheld | Named |
| intent | minor | **G20** The acceptance brief says "all five suites" while Validation adds a sixth whose location and command are never stated | upheld | Named |
| intent | minor | **G21** The silent-command count is new behaviour in a plan whose idea is removing assumptions, and the Spec retracts its own motivating evidence in the same passage | downgraded to minor, kept | Checked: the count is cheap, well-defined, and the runner already parses the stream. Recorded here so it is not re-raised |
| intent | minor | **G22** Citation off by one: `install.sh:45` is `mkdir`, the glob is `:46` | upheld | Corrected |

### Round 1 — 2026-08-31

**Lanes:** GPT / gpt-5.6-sol (mechanics lens); Claude / default reviewer model (intent lens);
cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| both | blocking | **F1** The path fix covers `install.sh` only. `sensitivity/set.sh:5` computes its own root and `:210` substitutes it into the dial block, which dereferences `{{WHEELCHAIR_ROOT}}/protocol/graphs.md` at `protocol/sensitivity.md:43` — so the one file both harnesses read every turn keeps the `/c/...` form C6 measured Codex failing on | upheld | Checked: both citations are real and the Spec named only `install.sh`. Spec now covers every renderer. D24 |
| intent | blocking | **F2** A detached `--open` breaks the suite on Linux. `viewer/test/helpers/server.js:88` spawns `--open` and treats that child as the server, `:97` kills it, and `viewer/test/server.test.js:1094` asserts `lock.pid` equals it; every node and browser test reaches the server through that helper | upheld | Checked, exactly as reported. The helper rewrite is now named as in-scope work rather than left implicit. D33. Round 2 found this fix incomplete — see G1 |
| mechanics | blocking | **F3** Detaching `--open` changes observable Linux command behaviour, which the idea's Linux constraint forbade | user-decision — settled | Put to the user as Q1; they chose to detach and amend the constraint to cover the observable contract. D32, and the idea's Constraints section is edited |
| both | blocking | **F4** D23's "report the step as unverified" is not implementable as written — no defined mapping from model prose to exec events, and the cited evidence is a non-`--json` human transcript | downgraded to major | Checked the real `--json` stream: each `command_execution` item carries `aggregated_output` and `exit_code`, so a concrete rule *is* specifiable — the defect is an unspecified mechanism, not an impossible one. Spec now states the rule. D26 |
| both | blocking / major | **F5** `protocol/implementation.md:76` spells out a background Bash call and `protocol/lanes.md:94` repeats it, so Stage 3 stays broken under PowerShell; the Spec claimed stage documents need no change | upheld at blocking | Checked both lines. Spec's documentation section now names `implementation.md`, and the backgrounding instruction moves to the runner |
| mechanics | blocking | **F6** The child-graph timeout may be "skipped with a stated reason", which permits shipping broken navigation | downgraded to major | Real ambiguity, but a worker would stop and ask rather than build the wrong thing. Spec now allows a skip only for a platform-representation limit, never for an unfixed defect |
| mechanics | major | **F7** Spec says lanes pass `read-only` for verify lanes; `protocol/lanes.md:77-78` says `workspace-write` for verifiers that run a suite | upheld | Checked. Straight factual error in the Spec; corrected |
| intent | major | **F8** `.gitattributes` pins the whole tree to LF while the Spec adds a root `.cmd`; batch parsing is CRLF-sensitive and no exemption is stated | upheld | Real contradiction inside one Spec. `.cmd` now exempted explicitly |
| intent | major | **F9** The `--show` node failure is misattributed: `viewer/test/server.test.js:978` writes `fake-browser.sh` with a bash shebang and points `WHEELCHAIR_BROWSER` at it, so Windows never reaches the `start` path | upheld | Checked, and it corrects a Spec claim — the browser bug has one real measurement (C9), not two. Spec no longer claims corroboration it does not have |
| intent | major | **F10** The "does this land where the tool looks" routine covers the dial's destination but not the wrapper homes, which `install.sh:20-21` resolves the same way | upheld | Checked. Routine now owns both destinations |
| both | major | **F11** No post-implementation Windows acceptance run; `WINDOWS-CHECKS.md:9-14` is explicitly a pre-change diagnostic that installs and changes nothing | upheld | Real gap against `IDEA.md`'s "What good looks like". Validation now requires a second, post-change brief |
| both | major | **F12** W13 is `open` at `status: ready-for-review`, against `protocol/planning.md`'s rule that the Watch List empties before Stage 1 exits | upheld | Checked; my own gate. Encoding question now has a Spec item and an acceptance check |
| mechanics | major | **F13** The lane-runner suite proves three cases and leaves argument forwarding, slot selection, resume and repeated `-c` overrides unproven | upheld | Validation extended |
| intent | major | **F14** `.gitattributes` does not renormalize an existing clone, and the verification machine has one | upheld | Spec now names the renormalize step |
| intent | minor | **F15** The Windows opener is unnamed while `launchBrowser` must report whether the launch was handed off; `explorer.exe` exits non-zero on success | upheld | Cheap; opener named and "handed off" defined |
| intent | minor | **F16** Claude-side claims are stated as established where C2 was blocked | upheld | Cheap honesty fix; sourced to docs rather than measurement |
| intent | minor | **F17** D23 rests on one reading; the same rerun's other probe printed output after `succeeded in 0ms:`, so a capture artifact competes with fabrication | upheld | Folded into F4's rewrite, which no longer depends on the fabrication reading |
| intent | minor | **F18** C6 measured a `node_repl/js` MCP capability, not Codex's own reader | upheld | Precision fix; the decision already rests on C1 |
| mechanics | minor | **F19** `--write` does not define whether the file holds the request body or the graph alone | upheld | Specified |
| intent | minor | **F20** Converting `$ROOT` at `install.sh:18` also changes `npm --prefix`, the wrapper glob and the `set.sh` call; the Spec does not say which conversion it wants | upheld | Specified: convert at the substitution, not at `$ROOT` |

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

Nothing built yet.

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- 2026-08-31 — Codex updated to 0.152.0 on the Windows machine and the four version-sensitive
  checks re-run. C1 and C7 hold on the models this workflow actually dispatches, so their
  substituted-model caveats come out of the Spec. C6 reversed and settled the path question by
  measurement: 0.152.0 reads `C:/...` and turns `/c/...` into `C:\c\...`, failing `ENOENT`.
  The first round's "no reader for either form" was a CLI artifact. One new item from the
  transcripts, logged as D23: a probe reported success in prose while its tool transcript
  carried no output for that step.
- 2026-08-31 — Citation correction. An earlier re-ground reported all citations as
  byte-identical; that check only confirmed each line *number existed*, not that the line
  still said what the claim said, and it was wrong. `viewer/server.js` (+77 lines),
  `viewer/index.html` (+144) and `protocol/graphs.md` (+16) had all moved relative to the
  reads the map was built from, so every citation into those three was off. All of them are
  now fixed and verified by reading the cited line and matching it to its claim. The other
  cited files — `install.sh`, both shell scripts, the three suites, `protocol/lanes.md` —
  were unaffected and re-verified the same way. Any future re-ground checks content, never
  line existence.
- 2026-08-31 — `WINDOWS-CHECKS.md` run on `GLEAMPC`; raw output committed as
  `WINDOWS-RESULTS.md`. Status returned to `planning` to fold the results in. Confirmed: the
  PowerShell shell behind a Codex lane, the browser never opening, the installer completing,
  and the line-ending fault — the last one in the JSON fixtures rather than the shebang, which
  is the half that pinning `*.sh` alone would have missed. Contradicted: D1's premise, that a
  harness file tool cannot open `/c/...`; the choice survives on C1's evidence instead, logged
  as D16. Weakened: the isolation passage, since the sandbox proved more permissive rather
  than more restrictive (D17). Newly in scope: the concurrent-write failure (D20), the spine
  fixture-setup death (D19), and the browser child-graph timeout (D21).

- 2026-08-31 — Re-grounded against `origin/main` after the contributing guide merged. Every
  one of the plan's 42 `file:line` citations was checked: none of the cited files changed
  between the plan's base (`a618b03`) and the merge, so every citation is byte-identical, not
  merely still in range. The only non-plan changes in that range are `CONTRIBUTING.md` (new)
  and one row added to `AGENTS.md`'s file table. No decision reopened; the Spec's
  documentation section gained the `CONTRIBUTING.md` items above.

- 2026-08-31 — Map, idea and queue built in one session from Claude Code. The idea was
  revised twice before confirmation: the "no Windows testing" non-goal came out when a
  Windows PC turned out to be available, and macOS came out of the "still works today"
  claim once it turned out never to have worked at all.
