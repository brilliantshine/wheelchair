---
slug: windows-support
kind: agent-brief
---

# Windows checks — brief for an agent on the Windows machine

You are running on a Windows PC with the Claude CLI and the Codex CLI installed. Wheelchair
is not installed here and you are not installing it. Your job is to establish ten facts about
this machine and report them.

**This is a fact-finding brief, not an implementation brief.** Change nothing, install
nothing, and fix nothing. If a check fails, that is a result, not a problem to solve — record
what happened and move on. A wrong "it works" is far more expensive here than a failure,
because the whole point is to stop the other side guessing.

**Paste raw output.** Do not summarize, do not tidy, do not translate an error into your own
words. If a command prints forty lines, paste the forty lines. The exact text of a failure is
usually the answer.

**If a check cannot be run at all,** say so and say why, rather than inferring what it would
have done. "Not run — no repo on this machine" is a good answer. A guess is not.

## Setup

Clone the repository somewhere on this machine. Do not run any installer.

```
git clone <repo-url> wheelchair
```

Record the exact path you cloned to. Several checks need it, and it is written below as
`<CLONE>`.

Run everything from a normal user session unless a check says otherwise. Do not run as
Administrator; if something needs elevation, that is itself the finding.

---

## C1 — which shell does Codex hand an agent?

Run, in `<CLONE>`:

```
codex exec -s read-only 'Run exactly this command and paste its raw output verbatim: echo "$0 :: $SHELL :: $OSTYPE"'
```

Report the raw output. Three filled-in fields means bash. The literal text `$0 :: $SHELL ::
$OSTYPE` echoed back means `cmd.exe`. Two separators with nothing between them means
PowerShell. If it is none of those, paste what you got.

Then, in the same place:

```
codex exec -s read-only 'Run these two commands and paste both outputs raw: (1) uname -a  (2) ver'
```

Report both, including whichever one failed and how.

## C2 — does Claude Code reach Git Bash?

```
claude doctor
```

Paste the whole output. Then report specifically: does it mention Git Bash or Git for
Windows, and does it say the Bash tool or the PowerShell tool is in use?

Then, in a Claude Code session in `<CLONE>`, ask it to run:

```
echo "$0 :: $SHELL :: $OSTYPE"
```

Report the raw output, and report which tool it used to run it if that is visible to you.

Also report whether `CLAUDE_CODE_GIT_BASH_PATH` is set anywhere in this machine's Claude
settings, and whether Git for Windows is installed at all (`where git` and
`where bash` from `cmd.exe`).

## C3 — do the harness commands resolve under Git Bash?

Open Git Bash. If there is no Git Bash on this machine, record that and skip to C10.

```
command -v claude ; echo "rc=$?"
command -v codex ; echo "rc=$?"
```

Paste both. What matters is whether each resolves at all, and what path it reports.

## C4 — does the installer complete?

In Git Bash, from `<CLONE>`:

```
./install.sh
```

Paste the entire output, including anything on stderr, and report the exit status
(`echo "rc=$?"` straight after).

This is expected to fail, possibly immediately. **The exact failure is the result.** In
particular:

- If it fails with something like `bad interpreter` or a stray `^M`, paste the exact line.
  Also run `file install.sh` and `head -1 install.sh | od -c | head -2` and paste those.
- If it gets as far as `npm --prefix`, paste what npm said about the path it was given.
- If it completes, say so, and go on to C5.

Then report, whether or not it completed: what is in `%USERPROFILE%\.claude\skills\` and
`%USERPROFILE%\.codex\prompts\` (`dir` both), and if any file exists there, paste the full
contents of one of them.

## C5 — does Playwright's Chromium install?

Only if C4 got past the npm step. In Git Bash, from `<CLONE>`:

```
npx --prefix ./viewer playwright install chromium
```

Paste the output and the exit status. Report roughly how long it took and whether it needed
any interaction.

## C6 — can the harness open the path a wrapper carries?

Only if C4 wrote a skill or prompt file. Take the absolute path written inside it — the one
before `/protocol/`.

In a Claude Code session, ask it to read that exact path using its file-reading tool, not a
shell command. Report whether it succeeded, and paste the error if not.

Then ask it to read the same location rewritten as a drive-letter path with forward slashes,
for example `C:/Users/you/wheelchair/protocol/graphs.md`. Report whether that succeeded.

Repeat both in a Codex session. Report all four outcomes separately.

## C7 — can a sandboxed lane bind a local port?

In Git Bash, from `<CLONE>`:

```
codex exec -m gpt-5.6-terra -c model_reasoning_effort=high \
  -s workspace-write -c sandbox_workspace_write.network_access=true \
  -C "$PWD" --skip-git-repo-check \
  'Start a Node HTTP server listening on 127.0.0.1 port 7399, make one request to it, print the response, then stop it. If binding fails, print the entire error including its error code. Do not work around a failure — report it.'
```

Paste the whole result. If it binds, say so. If it fails, the error code matters — `EPERM`,
`EACCES` and `EADDRINUSE` mean different things.

Then run the same command **without** the `-c sandbox_workspace_write.network_access=true`
flag and report whether the outcome differs. If Codex asks for administrator elevation or
mentions a sandbox setup step at any point, report exactly what it asked for and whether you
granted it.

## C8 — where would the picture setting land?

In Git Bash:

```
echo "HOME=$HOME"
echo "USERPROFILE=$USERPROFILE"
ls -la "$HOME" | head -20
```

Paste all of it. Report plainly whether `$HOME` and `$USERPROFILE` point at the same folder.

Then, from `cmd.exe`:

```
echo %USERPROFILE%
dir "%USERPROFILE%\.claude\CLAUDE.md"
dir "%USERPROFILE%\.codex\AGENTS.md"
```

Report which of those two files exist. If either does, report whether it contains a line
starting `diagram-sensitivity:` and paste the surrounding few lines.

## C9 — can a graph be drawn and opened?

Only if C4 got as far as installing the viewer's dependencies. In Git Bash, from `<CLONE>`:

```
node viewer/server.js --open "$PWD/scratch/check.json"
```

Report whether that command **returned** or hung. If it hung, that is a result — note it, stop
it with Ctrl-C, and say so. Paste any URL it printed.

If you got a URL, extract its port and token, and follow the write sequence in
`protocol/graphs.md` to write a small graph to that path. Report whether the write succeeded
and what the response body was. Then:

```
node viewer/server.js --show "$PWD/scratch/check.json"
node viewer/server.js --stop
```

Report whether a browser window actually opened, and what each command printed. **The browser
question is the one that matters most here** — the current code is expected to print success
whether or not anything opened, so trust the window, not the message.

## C10 — do the suites run?

In Git Bash, from `<CLONE>`, run each of these separately and paste the full output and exit
status of each:

```
bash spine/test/run.sh
bash sensitivity/test/run.sh
bash install/test/run.sh
node --test 'viewer/test/*.test.js'
npm --prefix viewer run test:browser
```

For any suite that fails, report how many checks passed before it failed and the exact text of
the first failure. Do not attempt to fix anything.

If a suite fails at startup — a missing command, a bad interpreter — that is a different
result from a suite that runs and fails an assertion. Say which it was.

---

## Reporting back

Return one report with a section per check, in order, each carrying:

- the exact commands you ran,
- their raw output,
- their exit statuses,
- a one-line plain statement of the fact established, or `NOT ESTABLISHED` and why.

End with anything you noticed that this brief did not ask about — a warning, an unexpected
prompt, a path that looked wrong. That section is often the most useful one, so do not leave
it empty out of politeness; write "nothing noticed" only if that is true.

Do not recommend fixes. Do not judge whether a result is good or bad. Report what happened.
