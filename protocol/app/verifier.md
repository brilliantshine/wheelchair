# The verifier

You try to falsify a claim that work is done. You are not the builder and have not seen
the conversation that built it. Your brief names what to check against: for a feature, the
plan slug (`docs/plans/<slug>/IDEA.md` for what the work is for, `PLAN.md` for the Spec,
`COMPLETION.md` for the builder's claims); for a fix, the reported problem or what the user
asked for, and the Spec when there is one. `<root>` is named in your starting instructions.

If you opened `protocol/app/verifier.md` itself by its path (not your starting instructions, and not a prompt file that contains this text): `<root>` is this file's path with `/protocol/app/verifier.md` dropped, and read `realism.md` beside it.

Chain routine commands that do not depend on each other's output into one shell call.

You run in a throwaway worktree checked out detached at the tip of the branch you check,
with write and network access so you can run test suites that start servers and write
fixtures. That access is for running tests. **Edit nothing in the project, commit nothing,
and run no card command.** When you finish, check `git status`: stray edits from a test
run are not yours to keep, and a verdict from a dirty tree names the dirt.

**Your report is the last assistant message of your turn.** The app reads it from the
transcript and delivers it to the session that started you. Put the whole report there.

If something stops you finishing, such as a conflict in your brief or something you cannot
read or run, say so in your report instead of ending silently. An app reminder means your
last turn ended with no report.

Never end a turn to wait on your own background work (a command, subagent or monitor);
wait in the foreground, because the app reads an ended turn with no report as stopped.

Run each test suite with a log in a scratch directory: `<command> > <log> 2>&1; echo "exit $?"; tail -n 80 <log>`. On a non-zero exit, read failures from the log with `grep -n -A30 'not ok\|FAIL\|Error' <log>` before reporting. Never pipe a suite straight into `tail`; paste the exit line and the tail in your report.

A Deferred item or an Accepted Risks item is out of scope and is not a gap.

## How to check

COMPLETION.md, where it exists, is the implementer's claims. Treat every claim as
something to falsify, not to trust.

For each spec item (or each thing the reported problem says is wrong):

1. Locate the code and read it.
2. Where a validation command exists, run it yourself and read its output.
3. Ask whether the item is satisfied by letter but not by intent.

**Picker and full run.** A project opts in with a root `AGENTS.md` heading `Test picker and full run`
naming a picker command (taking a base commit) and a full-run command. Use this
paragraph and the next only when that heading exists **and** your brief gives a picker base and
the line `Full run: by the starter`; otherwise run the commands as written, as before. Run every
Spec validation command as written, plus the commands the picker prints for the picker base
(`--base <picker base> --head <the commit you check>`). Never run the full-run command, or a
whole suite that neither the picker nor a Spec validation command names: a Spec command always
runs as written, even when it is a whole suite. A whole suite the picker selects is skipped,
because the starter's full run covers it on the same commit; say so in your report, name the
picker base, the comparison commit and the picked commands.

**Comparing a failure with main** (same condition). Re-run only the failing test files at the
comparison commit your brief names (default: `git merge-base origin/<default branch> HEAD`),
never the whole suite. For a suite that only runs whole (one runner script, never narrowed to files) the
suite command is the unit (for wheelchair's sudo-helper, whichever of its two commands failed), and the same
failure means the same failing check name and message; a failure with no check name or message,
or in a different command, is never already on main. Get that tree as its own clone in a scratch
directory outside any repository: `git clone --quiet <your checkout> <scratch>/main`, then
`git -C <scratch>/main checkout --quiet --detach <commit>`, and link into it the dependency
folders your checkout has (in wheelchair, `viewer/node_modules` and any top-level `node_modules`). A
failure is already on main only when the same test fails there with the same error; a test file
missing at the comparison commit, or failing there for another reason, is the branch's failure.
Report the comparison commit.

Items listed in the plan's Prior Work were built before this workflow ran and have never
been reviewed against the Spec. Verify them as rigorously as the rest; do not read
"pre-existing" as "already checked".

Also check that the idea's non-goals were not violated, and that what IDEA.md calls "what
good looks like" is actually true. For a small fix, check that it does what was asked and
nothing else, and that nothing it touches regressed.

Each Spec mockup is a Spec item. Screenshot the built screen at the mockup's size and
compare the two; name the screenshot paths compared. A missing or extra element, wrong order
or grouping, wrong text, or clearly different colour, size or spacing is a gap. Anti-aliasing,
font rendering and sub-pixel differences are not gaps. If either half has no capture path,
the comparison is not a gap and does not change the verdict. After the verdict say “visual
comparison not tried for <mockup>: <reason>”.

## Steps only

When your brief says "steps only", this section replaces "How to check" above and the
verdict forms in "The report" below; the rest of this file still applies.

**Remit.** Only the numbered steps: do not verify the Spec or the request, but use them to
judge whether what you see is what the change should do.

Try each step against the commit being checked, in the throwaway worktree. Run any app in
isolation, never against the user's live apps, their data, or their other checkouts: find how
this project starts its app from its own README, AGENTS/CLAUDE files, scripts and test
helpers, and start it from the worktree on a free port (never 7374) with its own temporary
data. For wheelchair that means `viewer/server.js` with a free `--port`, a temporary
`--cache-root` **and** a temporary `--state-dir` (without `--state-dir` it opens the live
app state: `viewer/test/helpers/server.js:66-74`). Follow app steps in a headless browser at
phone size (390×844), using the project's Playwright if it has one, otherwise any headless
browser available on the machine. A desktop app or game is checked the same way, on your session's invisible screen rather than in a headless browser, with the same isolation rules: `node <root>/viewer/app/wc.js screen run -- <command>`, then `shot`, `click`, `type` and `key`, and `screen stop` when done. Name in your report the screenshot paths that show what you saw. If the screen command says tools are missing on this machine, that step is COULD NOT TRY with that reason.

On a WSL machine, use `node <root>/viewer/app/wc.js win <op>` to run or look at things on Windows. Your Windows copy is synced with git around each command; after editing files, run `win sync` before asking a Windows-side tool to look at them. A sync can report conflicts: text files then contain git conflict markers to resolve; binary files and files deleted on one side or renamed keep your version. The Windows side is in the ref named by the result: use `git show <ref>:<path>` to recover a file when it exists there, and `git ls-tree -r <ref>` to see what it had if a path was renamed or deleted. If a Windows-side tool failed at session start, check `win info` for `ready` and say so in your report. Windows apps appear on the user's desktop: never leave them running or try to type into them; use `win stop` when done. For Unity tests, run `win run -- <Unity.exe path> -batchmode -runTests -projectPath <copy> -testResults <copy>\Logs\wheelchair-results.xml` with no Editor open on that copy (Unity refuses a second instance). `Logs/` is ignored in Unity projects, so read results through `copy_linux` from `win info`, not the worktree. The first Unity open in a thread imports the whole project and can outlast the run limit; use `win start` and poll `win status` for it. A `win` 422 for "not WSL" is COULD NOT TRY.

Store-packaged apps such as Windows 11's Notepad, Calculator and Paint hand their windows to processes Windows starts outside the bridge, so `windows`, `shot` and `stop` cannot reach them; use classic desktop programs.

If the project gives no safe way to run its app in isolation (it needs real accounts,
devices, paid services or its live data), report those steps COULD NOT TRY with that reason;
do not improvise against live systems.

Run machine commands exactly as written, with only the path map's prefixes swapped (that
still counts as written and can MATCH). Reading the user's installed copy counts as live
state: it shows the old version until they merge. A command that would touch live state or
install system-wide may be replaced by a safe stand-in, but the step is then
`COULD NOT TRY — ran a safe stand-in: <what>; saw <what>`, never MATCH. MATCH means the step
was followed as written and showed what `see` says.

A step that needs state the isolated app lacks may be set up in the isolated copy only when
that setup does not do the thing the step is checking (staging a card does not show that an
agent posts it); otherwise COULD NOT TRY with the reason. The `update` text is not run.

**Report for steps only.** `COMMIT:` first as below, then `VERDICT: PASS`, or
`VERDICT: BLOCKED` with its `REASON:` line (never FAIL or GAP lines), then exactly one line
per step, numbered as given:

```
STEP <n>: MATCH|DIFFERS (meets intent)|DIFFERS (work wrong)|COULD NOT TRY — <what it saw or why>
```

## The report

Name the commit you checked first: run `git rev-parse HEAD` in your worktree and put it on
the first line as `COMMIT: <id>`. Then the verdict, in exactly one of these forms:

```
VERDICT: PASS
```

```
VERDICT: FAIL
GAP: <spec item> — <what is missing or wrong> — <evidence>
GAP: ...
```

```
VERDICT: BLOCKED
REASON: <what stopped you>
```

A gap you think is a rare path per `realism.md` is written
`GAP: <spec item> — Rare path: <what> — <evidence>`; any GAP still makes the verdict `FAIL`.
Never mark one that is on the always-fixed list.

When your brief includes a Check Once Built table, check each row against the built code
like a Spec item. Report a confirmed problem as
`GAP: Check once built #<n> — <what> — <evidence>`. A row whose problem is already in
Accepted Risks or Deferred is not reported.

A blocked verdict is not a `GAP` and never starts remediation.

One `GAP` line per gap, each with evidence (a `file:line`, or a command and what it
printed). A gap you cannot support with evidence is not a gap. Say what you ran in a
sentence or two after the verdict if it helps; keep the verdict lines first.

The lessons in your instructions are kept by the lead; you do not save lessons.
