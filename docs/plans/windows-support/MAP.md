---
slug: windows-support
---

# How this works today

The current system, before any of this plan's changes. Every claim carries `file:line`.
This is a map of the **platform-facing** surface only — the places where wheelchair
touches a shell, a path, or a process. The stage logic (`protocol/planning.md` and
friends) is plain markdown and has no platform opinion, so it is not mapped here.

## End to end

```
./install.sh ─→ is claude on PATH? is codex on PATH?
                     ↓ neither
                 exit 1, install nothing
                     ↓ at least one
              render wrappers, substituting this clone's absolute path
                     ↓
      ~/.claude/skills/<name>/SKILL.md , ~/.codex/prompts/<name>.md
                     ↓
              npm install + playwright install chromium
                     ↓
              sensitivity/set.sh → dial region into ~/.claude/CLAUDE.md
                                                and ~/.codex/AGENTS.md
                     ↓ refuses
                 warn, install still succeeds


later, once per turn:

/plan ─→ harness reads the rendered wrapper ─→ "read <ROOT>/protocol/<stage>.md"
                                                      ↓
                                   the agent runs the commands that file spells out
                                        ↓                          ↓
                              codex exec lane              node viewer/server.js
                            mktemp, bash array,           mktemp, background, disown,
                            background, grep log          grep log, then curl PUT
                                                                   ↓
                                                          launchBrowser: open /
                                                          xdg-open / start
```

## What happens

1. **`install.sh` decides which harnesses exist by asking the shell**, not by looking for
   home directories — `command -v claude` and `command -v codex` at `install.sh:28-29`,
   with `WHEELCHAIR_PRESENT` as a testing seam above them. `sensitivity/set.sh:20-21`
   repeats the same two lines for the same reason.

2. **It computes this clone's absolute path once** — `ROOT="$(cd "$(dirname
   "${BASH_SOURCE[0]}")" && pwd)"` at `install.sh:18` — and `render()` at `install.sh:40`
   substitutes it for the literal `{{WHEELCHAIR_ROOT}}` in every wrapper it writes
   (`:51` for Claude skills, `:61` for Codex prompts). The wrappers are rendered rather
   than symlinked because a command runs with some *other* repo as its working directory,
   so a relative path resolves nowhere. That path is the only thing a wrapper contains:
   `skills/graph/SKILL.md` is four lines, of which one is
   `{{WHEELCHAIR_ROOT}}/protocol/graphs.md`.

3. **It installs the viewer's dependencies** — `npm --prefix "$ROOT/viewer" install` and
   `npx --prefix "$ROOT/viewer" playwright install chromium` at `install.sh:71` and `:74`.

4. **Last, it calls the dial writer** (`install.sh:78`), which renders a delimited region
   of `protocol/sensitivity.md` into whichever global harness files are present —
   `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, or both. That writer finds its region by
   exact line match (`grep -Fxc` at `sensitivity/set.sh:60-61`, `grep -Fnx` at `:72-73`)
   and reads the level out with an anchored awk regex, `^diagram-sensitivity:
   (ask|default|high)$`, at `:81-91`. It is all-or-nothing across both targets: it stages
   each output under `mktemp` (`:204`, `:216`), backs up each existing target (`:235`),
   and restores every already-written target if any `mv` fails.

5. **Per turn, the agent reads a protocol file and runs the commands in it.** Four of those
   files spell out shell, not just guidance — `protocol/sensitivity.md:101` and `:102` tell an
   agent to run `sensitivity/set.sh`, and `protocol/spine.md:19-20` to run `spine/scan.sh`. The
   two below are the ones with pipelines rather than a single invocation. `protocol/lanes.md:29-40` is the GPT lane:
   three `mktemp` files, a bash array holding either `env CODEX_HOME=... codex` or plain
   `codex` depending on whether a balancer slot exists (`:32-36`), `codex exec` with the
   brief on stdin, then `grep -m1 -o '"thread_id"...' | cut` to recover the session id.
   `protocol/graphs.md:430-443` is the viewer start: background the server with `&`,
   `disown`, poll a `mktemp` log with `seq`/`sleep 0.1` until a line starting `http`
   appears, then read the URL out of it. `:477-486` follows with a `curl` PUT, and `:510`
   with a second `--show` invocation.

6. **The viewer is Node with no runtime dependencies.** It claims a lockfile by writing a
   temp file and hard-linking it into place (`viewer/server.js:1378-1384`), so a second
   starter loses the race on `EEXIST` and reuses the running server instead. It checks
   liveness with `process.kill(pid, 0)`, binds `127.0.0.1` only, and gates every route on
   a token minted at start. `--show` ends at `launchBrowser`
   (`viewer/server.js:1537-1543`), which picks an opener by `process.platform` and
   `spawn`s it with the URL as a single argument.

7. **The Claude lane needs no shell at all** — `protocol/lanes.md:141-142`: the Agent tool
   from inside Claude Code, or `claude --model sonnet -p "<brief>"` from Codex. One
   command, one argument.

## What matters for this change

The platform assumptions sit in three groups, and they are not equally hard.

**The one-shot scripts** — `install.sh`, `sensitivity/set.sh`, `spine/scan.sh` — are bash
run by a person or by an agent as a single command, a handful of times. `spine/scan.sh` is
the demanding one: `realpath -z` with `read -d ''` (`spine/scan.sh:17-20`), bash namerefs
(`local -n`), `iconv` for UTF-8 validation (`:33`), and byte-wise `printf` arithmetic for
JSON escaping (`:96-160`). Git Bash carries all of it.

**The per-turn recipes** in `protocol/lanes.md` and `protocol/graphs.md` are different in
kind: they run in whatever shell the *harness* hands the agent, on every turn, forever.
That shell is Git Bash for Claude Code only when Git for Windows is installed, and is not
Git Bash for Codex on Windows at all.

**The rendered path is upstream of both.** Whatever form `install.sh:18` produces is what
every wrapper carries and every turn dereferences, so it has to be a form both a POSIX
shell and Codex accept — Claude reads either form, which the Windows checks established and
problem 2 below records.

## Problems found

Seven, all confirmed against the tree. Five were found by reading; two more — that
`protocol/sensitivity.md` and `protocol/spine.md` also invoke shell scripts directly — were found
by review after this map was first written, and are recorded here because the Spec sends a worker
to this document for current-state citations.

1. **No `.gitattributes` anywhere in the repo.** Git for Windows commonly defaults to
   `core.autocrlf=true`, which rewrites text files with CRLF on checkout, and
   `#!/usr/bin/env bash\r` then fails as a bad interpreter before line one.

   **On the one machine measured this did not happen to the scripts.** `./install.sh` returned
   `rc=0` there while the JSON fixtures were CRLF, which means that clone's `.sh` files were LF and
   its `.json` files were not. `git config core.autocrlf` on that machine was never captured,
   though it is one command, so *why* they differed is unestablished. The rule is still needed —
   it makes the outcome the same everywhere instead of depending on a setting nobody checked — but
   the shebang failure is observed **not** to have occurred, which is stronger than unobserved. The same conversion
   breaks the dial writer independently of the shebang: `sensitivity/set.sh:60` and `:72`
   match the marker lines exactly, and `:81-91` anchors on `$`, so a `\r` at end of line
   makes a correctly installed block read as absent.

2. **`install.sh:18` produces the wrong shape of path on Windows.** Under Git Bash,
   `pwd` reports `/c/Users/collin/...`. That string is rendered into every `SKILL.md`
   (`:51`) and Codex prompt (`:61`), and the agent then acts on it. **This entry originally gave
   the reason as Claude's file tools being unable to resolve `/c/...`; the Windows checks
   disproved that — Claude reads both forms.** What actually breaks is Codex, in both of the ways it
   reaches a file: it hands its agent PowerShell, which does not resolve `/c/...`, and the
   non-shell capability available in that session — a `node_repl/js` server, so Node's path
   handling rather than a reader belonging to Codex — turned `/c/Users/...` into
   `C:\c\Users\...` and failed `ENOENT`. A drive-letter path with forward slashes resolves from both
   harnesses and from bash; nothing in the installer produces one today.

3. **`--show` cannot open a browser on Windows.** `viewer/server.js:1539` selects the
   string `start` for `win32`, and `:1541` passes it to `spawn` without a shell. `start`
   is a `cmd.exe` builtin, not an executable, so the spawn fails; the `child.on('error')`
   handler at `:1542` swallows it and `launchBrowser` returns `true` regardless. Even
   routed through `cmd /c`, the URL's `&token=` would split the command line. The failure
   is silent by design — the launch is best-effort so a headless box still prints its URL
   — which means on Windows it will look like it worked.

4. **Three suites assert things a Windows filename cannot hold.**
   `spine/test/run.sh:189` creates a directory named with a raw `0xFF` byte and `:190` a
   target path with another; `:137`, `:141`, `:147` and `:173-174` create real symlinks,
   which on Windows need Developer Mode or elevation and which git may check out as plain
   text files instead; `sensitivity/test/run.sh:162` uses `chmod a-w` to build an
   unwritable target, and Git Bash's `chmod` maps only loosely onto the read-only
   attribute. These cannot be made to pass; they need skips that state why.

5. **The viewer's file modes stop meaning anything.** The cache root is created `0o700`
   (`viewer/server.js:1074`, `:1465`), the lockfile `0o600` (`:1378`), and the registry of
   writable paths `0o600` (`:1075`) — because the lockfile holds the token that authorizes
   every write. Windows ignores those bits. The token is still unguessable and the server still binds
   `127.0.0.1` only, so this weakens a defense-in-depth layer rather than opening a hole —
   but it is a real difference and belongs in the docs rather than being discovered.

6. **`protocol/sensitivity.md:101` and `:102` tell an agent to run `sensitivity/set.sh`
   directly.** Not a pipeline like the two above — a single script invocation — but a shell script
   all the same, so `/diagram-sensitivity` cannot run from a harness that hands its agent
   PowerShell.

7. **`protocol/spine.md:19-20` does the same for `spine/scan.sh`**, by absolute path, for the
   same reason and with the same consequence for `/spine`.

   Both were missed when this map was first written, because the survey asked which files hold
   shell *recipes* and these hold a shell *invocation*. Recorded here rather than only in the plan,
   since the Spec sends a worker to this document for current-state citations.

## Nothing here has ever run on macOS

Not a problem this plan creates, and not one it fixes, but it invalidates any assumption
that "the Unix path" is one path. `spine/scan.sh:19` uses `realpath -z`, which BSD
`realpath` does not have; `:364` uses `stat -c %s`, which is GNU-only; `:18` and `:25` use
bash namerefs, needing bash 4.3 against the 3.2 macOS ships as `/bin/bash`.
`sensitivity/set.sh:48` and `:213` use associative arrays, needing bash 4.0. The three
suites add `sed -i` with no argument (`sensitivity/test/run.sh:109` and five more),
`sha256sum` and `sort -z` (`install/test/run.sh:35`, `spine/test/run.sh:44`).

No document in the repo claims a supported platform, and no commit in the history mentions
macOS or darwin. The single macOS-aware line is the browser-launcher ternary at
`viewer/server.js:1539`.

None of it is on the Windows path: Git Bash supplies GNU coreutils and bash 5, so every
construct above works there unchanged.

## Not checked

This section was written before the checks ran. Four of its items are now answered on a real
Windows machine and the answers live in `WINDOWS-RESULTS.md`, indexed by the plan's Windows
Checks table: Codex hands its agent Windows PowerShell, both harness commands resolve under
Git Bash, and the installer completes including the `npm --prefix` step. What remains genuinely
unchecked is below.

- I grepped `protocol/implementation.md` and `protocol/verification.md` for shell after
  writing the above rather than reading them whole: `implementation.md:76` says to run each
  lane as a background Bash call, and `verification.md` has nothing. Neither repeats an
  invocation, so both inherit whatever `protocol/lanes.md` becomes.
- **Whether the dial writer's target resolution breaks when `$HOME` and the Windows user
  folder disagree.** They agreed on the machine checked, so the failure D10 exists against was
  not reproduced — only shown not to occur in the easy case.
- **Whether `viewer/index.html` behaves on Windows beyond what the browser suite covers.** It
  is 1959 lines and nothing in it touches a path or a process, but only one of its checks
  failed and nobody has driven the page by hand there.
