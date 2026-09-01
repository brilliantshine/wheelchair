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
   `npx --prefix "$ROOT/viewer" playwright install chromium` at `install.sh:73-74`.

4. **Last, it calls the dial writer** (`install.sh:78`), which renders a delimited region
   of `protocol/sensitivity.md` into whichever global harness files are present —
   `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, or both. That writer finds its region by
   exact line match (`grep -Fxc` at `sensitivity/set.sh:60-61`, `grep -Fnx` at `:72-73`)
   and reads the level out with an anchored awk regex, `^diagram-sensitivity:
   (ask|default|high)$`, at `:81-91`. It is all-or-nothing across both targets: it stages
   each output under `mktemp` (`:204`, `:216`), backs up each existing target (`:235`),
   and restores every already-written target if any `mv` fails.

5. **Per turn, the agent reads a protocol file and runs the commands in it.** Two of those
   files spell out shell, not just guidance. `protocol/lanes.md:29-40` is the GPT lane:
   three `mktemp` files, a bash array holding either `env CODEX_HOME=... codex` or plain
   `codex` depending on whether a balancer slot exists (`:32-36`), `codex exec` with the
   brief on stdin, then `grep -m1 -o '"thread_id"...' | cut` to recover the session id.
   `protocol/graphs.md:414-425` is the viewer start: background the server with `&`,
   `disown`, poll a `mktemp` log with `seq`/`sleep 0.1` until a line starting `http`
   appears, then read the URL out of it. `:461-470` follows with a `curl` PUT, and `:493`
   with a second `--show` invocation.

6. **The viewer is Node with no runtime dependencies.** It claims a lockfile by writing a
   temp file and hard-linking it into place (`viewer/server.js:1301-1307`), so a second
   starter loses the race on `EEXIST` and reuses the running server instead. It checks
   liveness with `process.kill(pid, 0)`, binds `127.0.0.1` only, and gates every route on
   a token minted at start. `--show` ends at `launchBrowser`
   (`viewer/server.js:1460-1466`), which picks an opener by `process.platform` and
   `spawn`s it with the URL as a single argument.

7. **The Claude lane needs no shell at all** — `protocol/lanes.md:142-143`: the Agent tool
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
shell and the harness's own Windows file APIs accept.

## Problems found

Five, all confirmed against the tree.

1. **No `.gitattributes` anywhere in the repo.** Git's Windows default is
   `core.autocrlf=true`, so a Windows clone rewrites every `.sh` with CRLF and
   `#!/usr/bin/env bash\r` fails as a bad interpreter before line one. The same conversion
   breaks the dial writer independently of the shebang: `sensitivity/set.sh:60` and `:72`
   match the marker lines exactly, and `:81-91` anchors on `$`, so a `\r` at end of line
   makes a correctly installed block read as absent.

2. **`install.sh:18` produces the wrong shape of path on Windows.** Under Git Bash,
   `pwd` reports `/c/Users/collin/...`. That string is rendered into every `SKILL.md`
   (`:51`) and Codex prompt (`:61`), and the agent then hands it to a file-reading tool
   that is a Windows API and cannot resolve `/c/...`. A drive-letter path with forward
   slashes (`C:/Users/...`) is accepted by both bash and the Windows tools; nothing in the
   installer produces one today.

3. **`--show` cannot open a browser on Windows.** `viewer/server.js:1462` selects the
   string `start` for `win32`, and `:1464` passes it to `spawn` without a shell. `start`
   is a `cmd.exe` builtin, not an executable, so the spawn fails; the `child.on('error')`
   handler at `:1465` swallows it and `launchBrowser` returns `true` regardless. Even
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
   (`viewer/server.js:997`, `:1388`), the lockfile `0o600` (`:1301`), and the registry of
   writable paths `0o600` (`:998`) — because the lockfile holds the token that authorizes
   every write. Windows ignores those bits. The token is still unguessable and the server still binds
   `127.0.0.1` only, so this weakens a defense-in-depth layer rather than opening a hole —
   but it is a real difference and belongs in the docs rather than being discovered.

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
`viewer/server.js:1462`.

None of it is on the Windows path: Git Bash supplies GNU coreutils and bash 5, so every
construct above works there unchanged.

## Not checked

- **Which shell Codex CLI actually spawns on native Windows.** OpenAI's Windows page
  documents the sandbox modes and says nothing about the shell. This is the single fact
  that decides whether the per-turn recipes could have been left alone, and it is
  answerable in a minute on a Windows box. Everything below assumes it is not Git Bash.
- **Whether `command -v claude` resolves `claude.exe` under Git Bash.** MSYS bash appends
  `.exe` during lookup, so it should, but I did not run it. If it does not, harness
  detection at `install.sh:28-29` fails closed and the installer exits 1 having done
  nothing — loud, not silent.
- **Whether `npm --prefix "$ROOT/viewer"` survives MSYS path mangling** when `$ROOT` is a
  POSIX path handed to a native Windows `npm.cmd`.
- **`viewer/index.html`.** 1815 lines of browser JavaScript; nothing in it touches a path
  or a process, and Chromium behaves the same on all three platforms.
- I grepped `protocol/implementation.md` and `protocol/verification.md` for shell after
  writing the above rather than reading them whole: `implementation.md:76` says to run each
  lane as a background Bash call, and `verification.md` has nothing. Neither repeats an
  invocation, so both inherit whatever `protocol/lanes.md` becomes.
- **Whether Playwright's pinned Chromium download works unattended on Windows.**
