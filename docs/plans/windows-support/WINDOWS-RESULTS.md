---
slug: windows-support
kind: machine-check-report
machine: GLEAMPC
checked-at: 2026-08-31
clone: C:\Users\Collin\Projects\Code\wheelchair
---

# Windows machine-check results

This report records the results of running `WINDOWS-CHECKS.md` on the Windows machine.
It reports observations only; it does not recommend fixes.

The checks ran from a normal, non-administrator user session (`gleampc\collin`, medium
integrity). The existing clone was used at:

```text
C:\Users\Collin\Projects\Code\wheelchair
```

Its remote was:

```text
origin  https://github.com/brilliantshine/wheelchair.git (fetch)
origin  https://github.com/brilliantshine/wheelchair.git (push)
```

The worktree was clean before the checks and clean after them.

## Outcome summary

| Check | Result |
|---|---|
| C1 | Required default-model probes were blocked by the installed CLI; the supported-model diagnostic established Windows PowerShell. |
| C2 | Claude attempted its `Bash` tool, but machine policy denied the requested expansions; the underlying shell was not established. |
| C3 | Both `claude` and `codex` resolve in Git Bash. |
| C4 | Installer completed with `rc=0`; wrappers, viewer dependencies, Chromium, and sensitivity blocks were installed. |
| C5 | Explicit Chromium install completed with `rc=0` in about one second and without interaction. |
| C6 | Claude reads both path forms; this Codex CLI has no working non-shell arbitrary local-file reader for either form. |
| C7 | Required `gpt-5.6-terra` probes were blocked by the installed CLI; supported-model probes bound port 7399 both with and without the network flag. |
| C8 | Git Bash and Windows home variables name the same physical folder; both global files contain `diagram-sensitivity: default`. |
| C9 | Isolated server start, graph write, and stop succeeded; `--show` printed a URL but opened no observed browser page. |
| C10 | Spine: fixture startup failure. Sensitivity: 62/62. Installer: 12/12. Node: 53/56. Browser: 60/61. |

## C1 — which shell does Codex hand an agent?

### Required default-model probe

Command:

```bash
codex exec -s read-only 'Run exactly this command and paste its raw output verbatim: echo "$0 :: $SHELL :: $OSTYPE"'
```

Output:

```text
Reading additional input from stdin...
2026-09-01T02:20:41.411975Z ERROR codex_models_manager::cache: failed to load models cache: missing field `base_instructions` at line 97 column 5
OpenAI Codex v0.142.5
--------
workdir: C:\Users\Collin\Projects\Code\wheelchair
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: high
reasoning summaries: none
session id: 01a05ac4-cbf4-77e0-b80e-deeff6a321c7
--------
user
Run exactly this command and paste its raw output verbatim: echo "$0 :: $SHELL :: $OSTYPE"
warning: Model metadata for `gpt-5.6-sol` not found. Defaulting to fallback metadata; this can degrade performance and cause issues.
ERROR: {"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-5.6-sol' model requires a newer version of Codex. Please upgrade to the latest app or CLI and try again."}}
ERROR: {"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-5.6-sol' model requires a newer version of Codex. Please upgrade to the latest app or CLI and try again."}}
rc=1
```

Command:

```bash
codex exec -s read-only 'Run these two commands and paste both outputs raw: (1) uname -a  (2) ver'
```

Output:

```text
Reading additional input from stdin...
OpenAI Codex v0.142.5
--------
workdir: C:\Users\Collin\Projects\Code\wheelchair
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: read-only
reasoning effort: high
reasoning summaries: none
session id: 01a05ac4-f606-7d80-b41d-cc6c9f1f21fa
--------
user
Run these two commands and paste both outputs raw: (1) uname -a (2) ver
warning: Model metadata for `gpt-5.6-sol` not found. Defaulting to fallback metadata; this can degrade performance and cause issues.
ERROR: {"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-5.6-sol' model requires a newer version of Codex. Please upgrade to the latest app or CLI and try again."}}
ERROR: {"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-5.6-sol' model requires a newer version of Codex. Please upgrade to the latest app or CLI and try again."}}
rc=1
```

### Supported-model diagnostic

The same probes were repeated with `-m gpt-5.5` so the shell fact could still be
established without updating the CLI.

Output:

````text
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'echo "$0 :: $SHELL :: $OSTYPE"'
 succeeded in 948ms:
 ::  ::

codex
```text
 ::  ::
```
rc=0
````

Second diagnostic output:

```text
exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command 'uname -a'
 succeeded in 321ms:
MINGW64_NT-10.0-26200 GLEAMPC 3.6.5-22c95533.x86_64 2025-10-10 12:02 UTC x86_64 Msys

exec
"C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command ver
 exited 1:
ver : The term 'ver' is not recognized as the name of a cmdlet, function, script file, or operable program. Check the
spelling of the name, or if a path was included, verify that the path is correct and try again.
At line:2 char:1
+ ver
+ ~~~
    + CategoryInfo          : ObjectNotFound: (ver:String) [], CommandNotFoundException
    + FullyQualifiedErrorId : CommandNotFoundException

rc=0
```

**Fact established:** Codex hands the agent Windows PowerShell. The two required
default-model commands were independently blocked by the installed Codex CLI/model
incompatibility.

## C2 — does Claude Code reach Git Bash?

Command:

```text
claude doctor
```

Visible terminal output (terminal control sequences omitted):

```text
Checking installation status…

Diagnostics
└ Currently running: native (2.1.91)
└ Path: C:\Users\Collin\.local\bin\claude.exe
└ Invoked: C:\Users\Collin\.local\bin\claude.exe
└ Config install method: native
└ Search: OK (bundled)

Updates
└ Auto-updates: enabled
└ Auto-update channel: latest
└ Stable version: 2.1.236
└ Latest version: 2.1.252

Press Enter to continue…
rc=0
```

It did not mention Git Bash or Git for Windows and did not say whether Bash or
PowerShell was in use.

Claude session request:

```bash
echo "$0 :: $SHELL :: $OSTYPE"
```

Output:

````text
The sandbox is blocking all attempts to read environment variables. I'm unable to run that exact command — the tool's sandbox prevents expanding `$0`, `$SHELL`, and `$OSTYPE` (it blocks shell variable expansions and `printenv`/`env` calls).

You'll need to run it yourself in your terminal:

```bash
echo "$0 :: $SHELL :: $OSTYPE"
```

Then paste the output here and I can help with whatever you need it for.
rc=0
````

A verbose trace identified the attempted tool as `Bash`. Its first raw tool result was:

```text
Contains simple_expansion
```

Subsequent attempts returned:

```text
Contains expansion
This command requires approval
'eval' evaluates arguments as shell code
```

No approval was granted.

Settings/environment search:

```text
--- environment values ---
Process=
User=
Machine=
--- Claude settings search ---
rg-rc=1
```

`cmd.exe` checks:

```text
> where git
C:\Program Files\Git\cmd\git.exe
rc=0

> where bash
C:\Windows\System32\bash.exe
C:\Users\Collin\AppData\Local\Microsoft\WindowsApps\bash.exe
rc=0
```

**Fact established:** Claude exposes and attempted the `Bash` tool, but the configured
pre-tool policy prevented the requested command from executing.
`CLAUDE_CODE_GIT_BASH_PATH` was not found. Git for Windows is installed, although
`where bash` does not return its Bash executable.

## C3 — do the harness commands resolve under Git Bash?

Commands and output:

```text
$ command -v claude ; echo "rc=$?"
/c/Users/Collin/.local/bin/claude
rc=0

$ command -v codex ; echo "rc=$?"
/c/Users/Collin/AppData/Roaming/npm/codex
rc=0
```

**Fact established:** Both harness commands resolve under Git Bash.

## C4 — does the installer complete?

Command:

```text
./install.sh
```

Output:

```text
harness found: claude
harness found: codex
claude skill: /adopt
claude skill: /diagram-sensitivity
claude skill: /graph
claude skill: /implement
claude skill: /plan-review
claude skill: /plan
claude skill: /spine
claude skill: /verify
codex prompt: /adopt
codex prompt: /diagram-sensitivity
codex prompt: /graph
codex prompt: /implement
codex prompt: /plan-review
codex prompt: /plan
codex prompt: /spine
codex prompt: /verify

added 3 packages, and audited 4 packages in 959ms

found 0 vulnerabilities
npm notice
npm notice New minor version of npm available! 11.7.0 -> 11.19.1
npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.19.1
npm notice To update run: npm install -g npm@11.19.1
npm notice
viewer deps: installed
Downloading Chrome for Testing 151.0.7922.34 (playwright chromium v1234) from https://cdn.playwright.dev/builds/cft/151.0.7922.34/win64/chrome-win64.zip
|                                                                                |   0% of 191.8 MiB
|■■■■■■■■                                                                        |  10% of 191.8 MiB
|■■■■■■■■■■■■■■■■                                                                |  20% of 191.8 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■                                                        |  30% of 191.8 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                                                |  40% of 191.8 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                                        |  50% of 191.8 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                                |  60% of 191.8 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                        |  70% of 191.8 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                |  80% of 191.8 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■        |  90% of 191.8 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■| 100% of 191.8 MiB
Chrome for Testing 151.0.7922.34 (playwright chromium v1234) downloaded to C:\Users\Collin\AppData\Local\ms-playwright\chromium-1234
Downloading FFmpeg (playwright ffmpeg v1011) from https://cdn.playwright.dev/dbazure/download/playwright/builds/ffmpeg/1011/ffmpeg-win64.zip
|                                                                                |   1% of 1.3 MiB
|■■■■■■■■                                                                        |  10% of 1.3 MiB
|■■■■■■■■■■■■■■■■                                                                |  20% of 1.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■                                                        |  30% of 1.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                                                |  40% of 1.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                                        |  50% of 1.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                                |  60% of 1.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                        |  71% of 1.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                |  80% of 1.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■        |  90% of 1.3 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■| 100% of 1.3 MiB
FFmpeg (playwright ffmpeg v1011) downloaded to C:\Users\Collin\AppData\Local\ms-playwright\ffmpeg-1011
Downloading Chrome Headless Shell 151.0.7922.34 (playwright chromium-headless-shell v1234) from https://cdn.playwright.dev/builds/cft/151.0.7922.34/win64/chrome-headless-shell-win64.zip
|                                                                                |   0% of 114.5 MiB
|■■■■■■■■                                                                        |  10% of 114.5 MiB
|■■■■■■■■■■■■■■■■                                                                |  20% of 114.5 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■                                                        |  30% of 114.5 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                                                |  40% of 114.5 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                                        |  50% of 114.5 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                                |  60% of 114.5 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                        |  70% of 114.5 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                |  80% of 114.5 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■        |  90% of 114.5 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■| 100% of 114.5 MiB
Chrome Headless Shell 151.0.7922.34 (playwright chromium-headless-shell v1234) downloaded to C:\Users\Collin\AppData\Local\ms-playwright\chromium_headless_shell-1234
Downloading Winldd (playwright winldd v1007) from https://cdn.playwright.dev/dbazure/download/playwright/builds/winldd/1007/winldd-win64.zip
|■■■■■■■■                                                                        |  12% of 0.1 MiB
|■■■■■■■■■■■■■■■■                                                                |  25% of 0.1 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■                                                        |  38% of 0.1 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                                        |  51% of 0.1 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                        |  70% of 0.1 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                |  82% of 0.1 MiB
|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■| 100% of 0.1 MiB
Winldd (playwright winldd v1007) downloaded to C:\Users\Collin\AppData\Local\ms-playwright\winldd-1007
viewer chromium: installed
diagram-sensitivity: set default in /c/Users/Collin/.claude/CLAUDE.md and /c/Users/Collin/.codex/AGENTS.md
diagram sensitivity: installed
rc=0
```

Installed Claude directory:

```text
Directory of C:\Users\Collin\.claude\skills

08/31/2026  07:24 PM    <DIR>          adopt
08/31/2026  07:24 PM    <DIR>          diagram-sensitivity
08/31/2026  07:24 PM    <DIR>          graph
07/06/2026  09:19 PM    <DIR>          graphify
08/31/2026  07:24 PM    <DIR>          implement
08/31/2026  07:24 PM    <DIR>          plan
08/31/2026  07:24 PM    <DIR>          plan-review
08/31/2026  07:24 PM    <DIR>          spine
08/31/2026  07:24 PM    <DIR>          verify
rc=0
```

Installed Codex directory:

```text
Directory of C:\Users\Collin\.codex\prompts

08/31/2026  07:24 PM               150 adopt.md
08/31/2026  07:24 PM               108 diagram-sensitivity.md
08/31/2026  07:24 PM               103 graph.md
08/31/2026  07:24 PM               125 implement.md
08/31/2026  07:24 PM               122 plan-review.md
08/31/2026  07:24 PM               105 plan.md
08/31/2026  07:24 PM               102 spine.md
08/31/2026  07:24 PM               123 verify.md
               8 File(s)            938 bytes
rc=0
```

Sample Claude wrapper:

```text
---
name: adopt
description: Fast-forward an externally-written plan document into the workflow — normalizes it into docs/plans/<slug>/ with a synthesized IDEA.md and PLAN.md, reports what the protocol needs that the document lacks, and lands it at approved, ready-for-review, or planning. The single on-ramp for plans not produced by /plan. Args - a path to the plan document.
---

Read `/c/Users/Collin/Projects/Code/wheelchair/protocol/adopt.md` and
follow it exactly. The skill argument is the path to the source document.
```

Sample Codex wrapper:

```text
Read /c/Users/Collin/Projects/Code/wheelchair/protocol/adopt.md and follow it exactly for the following path to an external plan document: $ARGUMENTS
```

**Fact established:** The installer completed with `rc=0` and wrote both harnesses,
viewer dependencies, Chromium, and both global sensitivity blocks.

## C5 — does Playwright's Chromium install?

Command:

```text
npx --prefix ./viewer playwright install chromium
```

Output:

```text
rc=0
elapsed_seconds=1
```

**Fact established:** The command completed in roughly one second with no interaction;
Chromium had already been downloaded by C4.

## C6 — can the harness open the path a wrapper carries?

The path written by the installed wrapper was:

```text
/c/Users/Collin/Projects/Code/wheelchair/protocol/adopt.md
```

### Claude, `/c/...`

Output:

````text
Success. The first line is:

```
# Adopt — fast-forward an external plan into the workflow
```
rc=0
````

### Claude, `C:/...`

Output:

````text
Success. The first line is:

```
# Adopt — fast-forward an external plan into the workflow
```
rc=0
````

### Codex, `/c/...`

Output:

````text
resources/read failed: resources/read failed for `codex_apps` (file:///c/Users/Collin/Projects/Code/wheelchair/protocol/adopt.md): Mcp error: -32002: Unknown resource({"uri":"file:///c/Users/Collin/Projects/Code/wheelchair/protocol/adopt.md"})

Error:

```text
resources/read failed: resources/read failed for `codex_apps` (file:///c/Users/Collin/Projects/Code/wheelchair/protocol/adopt.md): Mcp error: -32002: Unknown resource({"uri":"file:///c/Users/Collin/Projects/Code/wheelchair/protocol/adopt.md"})
```
rc=0
````

### Codex, `C:/...`

Output:

```text
Failed: no non-shell file-reading tool for arbitrary local text files is available in this session. I did not use a shell command.
rc=0
```

**Fact established:** Claude's file reader accepts both path forms. This Codex CLI
session cannot read either through a non-shell arbitrary local-file tool.

## C7 — can a sandboxed lane bind a local port?

### Required model, network enabled

Command:

```bash
codex exec -m gpt-5.6-terra -c model_reasoning_effort=high \
  -s workspace-write -c sandbox_workspace_write.network_access=true \
  -C "$PWD" --skip-git-repo-check \
  'Start a Node HTTP server listening on 127.0.0.1 port 7399, make one request to it, print the response, then stop it. If binding fails, print the entire error including its error code. Do not work around a failure — report it.'
```

Output:

```text
Reading additional input from stdin...
OpenAI Codex v0.142.5
--------
workdir: C:\Users\Collin\Projects\Code\wheelchair
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: high
reasoning summaries: none
session id: 01a05ac9-f791-7473-a615-6413efdc4bf1
--------
user
Start a Node HTTP server listening on 127.0.0.1 port 7399, make one request to it, print the response, then stop it. If binding fails, print the entire error including its error code. Do not work around a failure — report it.
warning: Model metadata for `gpt-5.6-terra` not found. Defaulting to fallback metadata; this can degrade performance and cause issues.
ERROR: {"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-5.6-terra' model requires a newer version of Codex. Please upgrade to the latest app or CLI and try again."}}
ERROR: {"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-5.6-terra' model requires a newer version of Codex. Please upgrade to the latest app or CLI and try again."}}
rc=1
```

### Required model, network flag omitted

Output:

```text
Reading additional input from stdin...
OpenAI Codex v0.142.5
--------
workdir: C:\Users\Collin\Projects\Code\wheelchair
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR]
reasoning effort: high
reasoning summaries: none
session id: 01a05aca-173d-74b3-9315-0ff0113f16fa
--------
user
Start a Node HTTP server listening on 127.0.0.1 port 7399, make one request to it, print the response, then stop it. If binding fails, print the entire error including its error code. Do not work around a failure — report it.
warning: Model metadata for `gpt-5.6-terra` not found. Defaulting to fallback metadata; this can degrade performance and cause issues.
ERROR: {"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-5.6-terra' model requires a newer version of Codex. Please upgrade to the latest app or CLI and try again."}}
ERROR: {"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-5.6-terra' model requires a newer version of Codex. Please upgrade to the latest app or CLI and try again."}}
rc=1
```

### Supported-model diagnostic, network enabled

The same command was run with `-m gpt-5.5`.

Output:

```text
OpenAI Codex v0.142.5
--------
workdir: C:\Users\Collin\Projects\Code\wheelchair
model: gpt-5.5
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: high
reasoning summaries: none
--------
HTTP 200
hello from 127.0.0.1:7399

The server bound successfully, handled one request, printed:

HTTP 200
hello from 127.0.0.1:7399

Then it stopped.
rc=0
```

### Supported-model diagnostic, network flag omitted

Output:

```text
OpenAI Codex v0.142.5
--------
workdir: C:\Users\Collin\Projects\Code\wheelchair
model: gpt-5.5
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR]
reasoning effort: high
reasoning summaries: none
--------
hello from node on 7399

Server started, one request succeeded, response was:

hello from node on 7399

The server was then stopped.
rc=0
```

No elevation or sandbox-setup prompt appeared.

**Fact established:** The exact `gpt-5.6-terra` check is `NOT ESTABLISHED` because the
installed CLI rejects the model. With the supported model, binding succeeds in both
configurations and the network flag produces no observed difference.

## C8 — where would the picture setting land?

Git Bash commands:

```bash
echo "HOME=$HOME"
echo "USERPROFILE=$USERPROFILE"
ls -la "$HOME" | head -20
```

Output:

```text
HOME=/c/Users/Collin
USERPROFILE=C:\Users\Collin
total 40001
drwxr-xr-x 1 Collin 197121        0 Aug 31 19:25 .
drwxr-xr-x 1 Collin 197121        0 Aug 31 19:26 ..
drwxr-xr-x 1 Collin 197121        0 Mar  4 15:56 .anaconda
drwxr-xr-x 1 Collin 197121        0 Jul  4 03:51 .android
-rw-r--r-- 1 Collin 197121        7 Jun  7 22:07 .bash_history
-rw-r--r-- 1 Collin 197121    21908 Mar 27 18:20 .boto
drwxr-xr-x 1 Collin 197121        0 Jul 28 04:08 .cache
drwxr-xr-x 1 Collin 197121        0 Jun 23 06:16 .cargo
drwxr-xr-x 1 Collin 197121        0 Jul 15 14:31 .chocolatey
drwxr-xr-x 1 Collin 197121        0 Aug 31 19:25 .claude
-rw-r--r-- 1 Collin 197121    53545 Aug 31 19:22 .claude.json
-rw-r--r-- 1 Collin 197121    46555 Jul 19 03:57 .claude.json.backup
drwxr-xr-x 1 Collin 197121        0 Aug 31 19:26 .codex
drwxr-xr-x 1 Collin 197121        0 Jun 23 06:10 .codex-sqlite-fresh
drwxr-xr-x 1 Collin 197121        0 Jun 23 05:22 .codex.backup-20260623-052217
drwxr-xr-x 1 Collin 197121        0 Jun 23 06:05 .codex.pre-restore-20260623-threads
drwxr-xr-x 1 Collin 197121        0 Mar  4 15:56 .conda
-rw-r--r-- 1 Collin 197121       92 May 28 03:56 .condarc
drwxr-xr-x 1 Collin 197121        0 Mar 20 14:52 .config
rc=0
```

`cmd.exe` output:

```text
> echo %USERPROFILE%
C:\Users\Collin
rc=0

> dir "%USERPROFILE%\.claude\CLAUDE.md"

Directory of C:\Users\Collin\.claude

08/31/2026  07:24 PM             1,904 CLAUDE.md
               1 File(s)          1,904 bytes
rc=0

> dir "%USERPROFILE%\.codex\AGENTS.md"

Directory of C:\Users\Collin\.codex

08/31/2026  07:24 PM             1,672 AGENTS.md
               1 File(s)          1,672 bytes
rc=0
```

Relevant Claude lines:

```text
<!-- wheelchair:diagram-sensitivity start -->
## Answering with a picture

diagram-sensitivity: default

Three levels — `ask`, `default`, `high`. This block is owned by the wheelchair repo and
rewritten in place.
```

Relevant Codex lines:

```text
<!-- wheelchair:diagram-sensitivity start -->
## Answering with a picture

diagram-sensitivity: default

Three levels — `ask`, `default`, `high`. This block is owned by the wheelchair repo and
rewritten in place.
```

**Fact established:** `$HOME` and `%USERPROFILE%` identify the same physical folder using
Git-Bash and drive-letter syntax. Both global files exist and contain
`diagram-sensitivity: default`.

## C9 — can a graph be drawn and opened?

The literal command from the brief was not run because the repository's root
`AGENTS.md` expressly prohibits hand-starting the viewer against the default cache root.
The check was instead run with an isolated cache root and port:

```text
node viewer/server.js --port 17399 \
  --cache-root C:\Users\Collin\AppData\Local\Temp\wheelchair-c9-cache-20260831-1928 \
  --open C:\Users\Collin\Projects\Code\wheelchair\scratch\check.json
```

Output:

```text
http://127.0.0.1:17399/?path=C%3A%5CUsers%5CCollin%5CProjects%5CCode%5Cwheelchair%5Cscratch%5Ccheck.json&token=d7b51c477b3d58e8f35420a58aee700e3e66913bf6d6a07657e4f95b4ae0aebf
```

The command did not return; it remained serving.

Protocol-compliant `PUT` response:

```text
{"hash":"4db42f8f07aa924484e1a2e7a951d2b0b5b25091ee3ad916e0c8d8d00db08bcf"}
rc=0
```

Show command:

```text
node viewer/server.js --port 17399 \
  --cache-root C:\Users\Collin\AppData\Local\Temp\wheelchair-c9-cache-20260831-1928 \
  --show C:\Users\Collin\Projects\Code\wheelchair\scratch\check.json
```

Output:

```text
http://127.0.0.1:17399/?path=C%3A%5CUsers%5CCollin%5CProjects%5CCode%5Cwheelchair%5Cscratch%5Ccheck.json&token=d7b51c477b3d58e8f35420a58aee700e3e66913bf6d6a07657e4f95b4ae0aebf
rc=0
```

Visible browser windows before and after:

```text
Id    ProcessName MainWindowHandle MainWindowTitle
27080 firefox     1509414          Minimum Moves to Clean the Classroom - LeetCode — Personal — Mozilla Firefox
```

The handle and title did not change. Server live-page check:

```text
{"watched":false}
rc=0
```

Stop command:

```text
node viewer/server.js --port 17399 \
  --cache-root C:\Users\Collin\AppData\Local\Temp\wheelchair-c9-cache-20260831-1928 \
  --stop
```

Output:

```text
Server stopped.
rc=0
```

**Fact established:** The isolated server starts, registers the graph, accepts the
write, and stops. `--show` prints success but no browser page begins polling and no
visible browser window changes.

The generated graph and cache files were removed after the check. The two now-empty
disposable directories remain.

## C10 — do the suites run?

### `bash spine/test/run.sh`

Output:

```text
ln: failed to create symbolic link '/tmp/tmp.CYeqGa8pHF/broken/docs/CLAUDE.md': No such file or directory
rc=1
```

**Fact established:** The suite failed during fixture setup before any `PASS` line. Zero
checks passed before the first failure.

### `bash sensitivity/test/run.sh`

Output:

```text
PASS claude-only writes Claude and reports Codex unavailable
PASS codex-only writes Codex and reports Claude unavailable
PASS neither present reports and writes nothing
PASS markerless prose seeds both files
PASS markerless prose keeps prefixes byte-for-byte
PASS missing targets are created with just the region
PASS ask sets and reports both files
PASS default sets and reports both files
PASS high sets and reports both files
PASS owned content is overwritten while outside bytes survive
PASS no existing blocks resolve to default
PASS one high block refreshes both at high
PASS matching high blocks stay high
PASS unrequested divergence refuses and names both levels
PASS explicit level repairs divergence in both files
PASS two marker pairs refuse
PASS two marker pairs changes neither target
PASS unclosed marker refuses
PASS unclosed marker changes neither target
PASS unwritable second target refuses
PASS unwritable second target changes neither target
PASS malformed second target refuses
PASS malformed second target changes neither target
PASS non-empty override refuses by name
PASS non-empty override changes neither target
PASS unrecognised level exits two and names every level
PASS unrecognised level changes neither target
PASS no_level level lines refuse without repair
PASS no_level level lines changes neither target
PASS two_levels level lines refuse without repair
PASS two_levels level lines changes neither target
PASS the bare command reports a disagreement instead of picking a side
PASS the bare command changes neither target
PASS the bare command names an uninstalled dial and writes nothing
PASS the bare command on an absent dial changes neither target
PASS landed regions match each other and substituted source apart from level
PASS landed region is non-empty with one parseable level
PASS landed region states item 1, the three level names
PASS landed region states item 2, that the block is the repo's and is rewritten
PASS landed region states item 2, that it is never hand-edited
PASS landed region states item 2, how the dial is moved instead
PASS landed region states item 3, the trigger property
PASS landed region states item 3, its other two limbs
PASS landed region states item 4, what ask draws
PASS landed region states item 4, the ask carve-out's own trigger
PASS landed region states item 4, where that trigger already lives
PASS landed region states item 4, what default draws
PASS landed region states item 4, what high draws
PASS landed region states item 5, the floor, at every level
PASS landed region states item 6, the high prose rule
PASS landed region states item 7, the draw instruction
PASS landed region states item 7, where the drawing procedure lives
PASS landed region states item 8, the explanation covers what it shows
PASS landed region states item 8, and what to look at
PASS landed region states item 8, and what it leaves out
PASS landed region states item 9, the subagent exclusion
PASS landed region excludes PLAN.md and Spec sections
PASS landed region names no path relative to nowhere
PASS landed region has no unsubstituted placeholder
PASS landed region names this clone by absolute path
PASS real CLAUDE.md is byte-identical after suite
PASS real AGENTS.md is byte-identical after suite
RESULT 62 passed, 0 failed
rc=0
```

**Fact established:** 62 passed, 0 failed.

### `bash install/test/run.sh`

Output:

```text
PASS claude-only install succeeds and reports Claude
PASS claude-only install renders every substituted Claude wrapper
PASS claude-only install does not create the absent Codex home
PASS codex-only install succeeds and reports Codex
PASS codex-only install renders every substituted Codex wrapper
PASS codex-only install does not create the absent Claude home
PASS neither harness exits non-zero and names both missing commands
PASS neither harness writes no homes
PASS both harnesses render every substituted wrapper
PASS a second install is idempotent
PASS real CLAUDE.md is byte-identical after suite
PASS real AGENTS.md is byte-identical after suite
RESULT 12 passed, 0 failed
rc=0
```

**Fact established:** 12 passed, 0 failed.

### `node --test 'viewer/test/*.test.js'`

Output (the repetitive byte-array portion of the first failure is elided; all test
names, result counts, exit status, and failure stacks are retained):

```text
✖ canonical round-trip canonicalizes byte-for-byte (121.5468ms)
✔ explanation written through /graph is retained on disk in canonical order (91.3097ms)
✔ groups canonicalize member lists, order, and byte round-trip (100.665ms)
✔ visible groups round-trip without explanation references (97.5142ms)
✔ groups default on writes and reads of legacy disk files (89.7008ms)
✔ groups refuse malformed claims and unmatched explanation references (112.6261ms)
✔ ordinary markdown links in explanations do not require groups (80.5581ms)
✔ explanation accepts only strings or null (72.7713ms)
✔ agent prose refuses positional claims in explanations and groups (83.2628ms)
✔ quoted spans mask positional claims without masking apostrophes or stray delimiters (124.6918ms)
✔ positional claims leave the downhill vocabulary, node text, and page reads alone (197.2738ms)
✔ self edges are refused after missing endpoints (73.7289ms)
✔ both write routes enforce their distinct authority (101.9449ms)
✔ /view cannot alter explanation (69.8688ms)
✔ /view cannot alter groups and accepts an untouched deep clone (95.9775ms)
✔ optimistic concurrency returns and accepts the current hash, including create (168.933ms)
✔ an agent create cannot pre-rule entries or claim a reset record (73.7645ms)
✔ node and edge kinds are closed sets while omitted kinds default (141.1853ms)
✖ the global write lock serializes concurrent writes and retry retains both changes (84.3077ms)
✔ agent preservation protects agreed and rejected entries (84.386ms)
✔ PUT /graph ignores known positions and lays out new nodes (86.111ms)
✔ an all-new rewrite group moves itself clear instead of moving the picture on disk (98.2081ms)
✔ a changed resident group evicts residents once and leaves its disk members still (108.5118ms)
✔ placement separates overlapping group rectangles and translates a visible-group victim whole (106.8992ms)
✔ placement sees padding-only overlap between two group boxes (116.7111ms)
✔ making a persisted invisible group visible starts placement without a membership change (111.1695ms)
✔ when two resident groups arrive together, the earlier id is the anchor (98.4989ms)
✔ equal displacement directions prefer left before right, up, and down (94.8137ms)
✔ ring-zero lattice cells enumerate by row and then column (115.4825ms)
✔ a disk free node crowding an unchanged group stays put when another node is added (119.1562ms)
✔ mixed-membership groups tuck a new member beside their disk members (109.5044ms)
✔ all-new group packing uses its edge-neighbour anchor, not its pre-pack centroid (98.539ms)
✔ a create keeps an all-new group anchored and moves a free node that crowds it (76.3604ms)
✔ a create is deterministic, keeps group-less layout intact, and permits matching group and node ids (308.0364ms)
✔ the movement search rejects a short blocked exit and lands exactly at the group gap (95.3688ms)
✔ an unchanged redraw preserves a dragged intruder, while a later resident evicts an earlier unchanged group (229.6506ms)
✔ verdict reversal is page-only and agents reset agreed entries explicitly (87.2402ms)
✔ bulk verdicts are additive and one reversal is permitted (82.4432ms)
✔ retargeting and dropping a container preserve verdict-bearing children (80.4866ms)
✔ container removal accepts proposed-only child and recursively finds grandchild verdicts (159.5399ms)
✔ all containment retarget cases, cycles, deep acyclic writes, and missing children follow the contract (337.3082ms)
✔ retargeting away unregisters a derivable child and unreadable children block removal (166.0693ms)
✔ whoami is unauthenticated identity, never a mutation credential (73.007ms)
✖ --show opens a browser once, and never while a tab is already on that graph (527.6883ms)
✔ two starts at the same instant leave one server, and the loser reuses it rather than dying (4520.1798ms)
✔ discovery reuses matching locks, reclaims dead locks, and rejects foreign live locks (3962.4648ms)
✔ a second starter sees a complete lock or no lock during an atomic claim (134.7811ms)
✔ GET change detection exposes agent hashes and preserves the page write hash (92.227ms)
✔ a kill before rename leaves the committed graph as either whole version, never a partial write (6632.0711ms)
✔ registered paths are pruned by age at startup (61.9582ms)
✔ agent reset records are durable and page verdicts clear them only while changing origin (94.673ms)
✔ malformed on-disk graphs refuse without repair (279.2595ms)
✔ layout runs downhill: an arrow never points back up the page (78.3539ms)
✔ a fresh layout keeps consecutive rows 140 pixels apart (73.1583ms)
✔ layout places every component, including a disconnected two-cycle (73.6647ms)
✔ cache-root isolation never changes the live default cache (69.7948ms)
ℹ tests 56
ℹ suites 0
ℹ pass 53
ℹ fail 3
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 21679.6028

✖ failing tests:

test at viewer\test\server.test.js:183:1
✖ canonical round-trip canonicalizes byte-for-byte (121.5468ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

  + Buffer(3561) [Uint8Array] [
  - Buffer(3736) [Uint8Array] [
      123,
  -   13,
      10,
      32,
      32,
      34,
      115,
  ...

      at C:\Users\Collin\Projects\Code\wheelchair\viewer\test\server.test.js:188:12
      at async withFixture (C:\Users\Collin\Projects\Code\wheelchair\viewer\test\server.test.js:23:16)
      at async TestContext.<anonymous> (C:\Users\Collin\Projects\Code\wheelchair\viewer\test\server.test.js:184:3)
      at async Test.run (node:internal/test_runner/test:1113:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:358:3) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: <Buffer 7b 0a 20 20 22 73 63 68 65 6d 61 22 3a 20 31 2c 0a 20 20 22 74 69 74 6c 65 22 3a 20 22 43 61 6e 6f 6e 69 63 61 6c 20 67 72 61 70 68 22 2c 0a 20 20 22 ... 3511 more bytes>,
    expected: <Buffer 7b 0d 0a 20 20 22 73 63 68 65 6d 61 22 3a 20 31 2c 0d 0a 20 20 22 74 69 74 6c 65 22 3a 20 22 43 61 6e 6f 6e 69 63 61 6c 20 67 72 61 70 68 22 2c 0d 0a ... 3686 more bytes>,
    operator: 'deepStrictEqual',
    diff: 'simple'
  }

test at viewer\test\server.test.js:534:1
✖ the global write lock serializes concurrent writes and retry retains both changes (84.3077ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

  0 !== 1

      at C:\Users\Collin\Projects\Code\wheelchair\viewer\test\server.test.js:549:12
      at runNextTicks (node:internal/process/task_queues:64:5)
      at process.processImmediate (node:internal/timers:472:9)
      at async withFixture (C:\Users\Collin\Projects\Code\wheelchair\viewer\test\server.test.js:23:16)
      at async TestContext.<anonymous> (C:\Users\Collin\Projects\Code\wheelchair\viewer\test\server.test.js:535:3)
      at async Test.run (node:internal/test_runner/test:1113:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:788:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 0,
    expected: 1,
    operator: 'strictEqual',
    diff: 'simple'
  }

test at viewer\test\server.test.js:971:1
✖ --show opens a browser once, and never while a tab is already on that graph (527.6883ms)
  AssertionError [ERR_ASSERTION]: --show on an unwatched graph opens exactly one window

  0 !== 1

      at TestContext.<anonymous> (C:\Users\Collin\Projects\Code\wheelchair\viewer\test\server.test.js:996:12)
      at async Test.run (node:internal/test_runner/test:1113:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:788:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 0,
    expected: 1,
    operator: 'strictEqual',
    diff: 'simple'
  }
rc=1
```

**Fact established:** 53 passed and 3 failed. The first test failed before any check had
passed; its actual file uses LF bytes while the expected fixture uses CRLF bytes.

### `npm --prefix viewer run test:browser`

Output:

```text
> agent-graph-viewer@1.0.0 test:browser
> playwright test test/browser.spec.js --reporter=list

Running 61 tests using 1 worker

(node:24816) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ok  1 test\browser.spec.js:159:1 › dragging a single node writes matching integer coordinates to disk (557ms)
  ok  2 test\browser.spec.js:197:1 › a freshly laid out graph puts no edge label on top of a node box (170ms)
  ok  3 test\browser.spec.js:229:1 › every edge label background is exactly its measured text width plus 14px (144ms)
  ok  4 test\browser.spec.js:258:1 › every edge label on the crowding fixture touches its own line or carries a leader back to it (137ms)
  ok  5 test\browser.spec.js:308:1 › a label with nowhere on its own line to sit is drawn with a leader back to it (145ms)
  ok  6 test\browser.spec.js:356:1 › dragging a multi-node selection moves every member (466ms)
  ok  7 test\browser.spec.js:401:1 › a drag interrupted by an agent write mid-gesture loses the drag and keeps the agent write (1.7s)
  ok  8 test\browser.spec.js:437:1 › approving a reset entry through the page clears was (351ms)
  ok  9 test\browser.spec.js:468:1 › box-select then approve sets agreed on every selected node and implied edge (400ms)
  ok 10 test\browser.spec.js:514:1 › select-all approve on a graph already holding verdicts rules only the unruled, and a lone reversal still works (469ms)
  ok 11 test\browser.spec.js:570:1 › select-all reject on a graph already holding verdicts strikes only the unruled (305ms)
  ok 12 test\browser.spec.js:615:1 › select-all approve issues exactly one PUT /view, and a select-all drag issues exactly one more (3.6s)
  ok 13 test\browser.spec.js:663:1 › shift-clicking an implied edge removes it and it stays removed (248ms)
  ok 14 test\browser.spec.js:698:1 › an edge is selectable by label, band and endpoint handle at minimum zoom (626ms)
  ok 15 test\browser.spec.js:736:1 › hovering a label reveals its edge's endpoint handles (228ms)
  ok 16 test\browser.spec.js:761:1 › two edges between one pair of nodes in opposite directions are independently selectable (171ms)
  ok 17 test\browser.spec.js:788:1 › selecting an item expands ref, note, and an edge payload with its inferred state (281ms)
  ok 18 test\browser.spec.js:829:1 › a label the box truncates is readable in full on hover and in the detail panel (232ms)
  ok 19 test\browser.spec.js:876:1 › a label needing all five lines draws five lines, with no ellipsis and no tooltip (153ms)
  ok 20 test\browser.spec.js:912:1 › a five-line box stays shorter than the server's row pitch (149ms)
  ok 21 test\browser.spec.js:954:1 › no gesture or control adds, renames or connects anything (871ms)
  ok 22 test\browser.spec.js:1006:1 › a page write through the browser carries an Origin the server accepts (324ms)
  ok 23 test\browser.spec.js:1037:1 › a 409 mid-approve is survived by re-reading and re-applying the verdict (402ms)
  ok 24 test\browser.spec.js:1080:1 › the browser suite never touches the live default cache root (514ms)
  ok 25 test\browser.spec.js:1122:1 › the explanation panel renders expanded when a graph opens, showing the explanation text (160ms)
  ok 26 test\browser.spec.js:1139:1 › the panel collapses and expands on click, and the canvas is fully usable in both states (477ms)
  ok 27 test\browser.spec.js:1186:1 › a node panned into the topmost strip of the canvas is clickable and draggable with the panel expanded (649ms)
  ok 28 test\browser.spec.js:1243:1 › a graph with a null explanation renders no panel at all (254ms)
  ok 29 test\browser.spec.js:1262:1 › a long explanation scrolls inside a bounded panel without changing the canvas height (252ms)
  ok 30 test\browser.spec.js:1299:1 › the error banner stays visible and legible with the panel expanded (266ms)
  ok 31 test\browser.spec.js:1331:1 › the fatal overlay still covers the canvas with the panel expanded (2.0s)
  x  32 test\browser.spec.js:1359:1 › collapse state survives a poll and a child-graph navigation, but not a reload (30.0s)
(node:19012) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ok 33 test\browser.spec.js:1413:1 › hovering a marked phrase lights the group and dims everything outside it, leaving approve disabled (235ms)
  ok 34 test\browser.spec.js:1452:1 › hovering a marked phrase does not rebuild the panel (225ms)
  ok 35 test\browser.spec.js:1482:1 › clicking a marked phrase selects exactly the group, approves it, and leaves an already-ruled member untouched (329ms)
  ok 36 test\browser.spec.js:1546:1 › clicking a visible group whose header would clear the canvas by only a little brings the header fully into view (685ms)
  ok 37 test\browser.spec.js:1583:1 › a graph opening at fit shows a visible group's header whole, not clipped at the edge (156ms)
  ok 38 test\browser.spec.js:1611:1 › clicking a group with a member off-screen brings it into view without changing zoom (695ms)
  ok 39 test\browser.spec.js:1650:1 › a redraw that changes a group's nodes while the explanation stays byte-identical relights and rules the new membership (2.3s)
  ok 40 test\browser.spec.js:1703:1 › the page renders a non-# markdown link as plain text, not a marked phrase (157ms)
  ok 41 test\browser.spec.js:1754:1 › a visible group pushes exactly one non-member clear, at exactly GROUP_GAP, in the direction both files must agree on (202ms)
  ok 42 test\browser.spec.js:1839:1 › a group name and note too long for the box are cut, and the header tooltip carries both in full (170ms)
  ok 43 test\browser.spec.js:1884:1 › the header hit rect is invisible and sized to its text, not the full box (174ms)
  ok 44 test\browser.spec.js:1903:1 › clicking a group header selects exactly its members and enables approve (182ms)
  ok 45 test\browser.spec.js:1927:1 › pressing a group header and releasing away from it still selects the group (292ms)
  ok 46 test\browser.spec.js:1954:1 › a marquee started on empty canvas inside a group boundary still box-selects (260ms)
  ok 47 test\browser.spec.js:1991:1 › every group boundary precedes every node, edge and label, and every header follows every edge and precedes every label, in document order (147ms)
  ok 48 test\browser.spec.js:2039:1 › an edge label that would land on a group's header is displaced clear of it (159ms)
  ok 49 test\browser.spec.js:2064:1 › hovering a group header dims nothing, and lifts the boundary stroke until the pointer leaves (210ms)
  ok 50 test\browser.spec.js:2092:1 › hovering a marked phrase dims every other visible group, leaving its own boundary and header plain (212ms)
  ok 51 test\browser.spec.js:2136:1 › measureLabelWidth is keyed on size, not just text (151ms)
  ok 52 test\browser.spec.js:2202:1 › a forward arrow's endpoints sit ANCHOR_CLEAR outside the source's bottom edge and the target's top edge (131ms)
  ok 53 test\browser.spec.js:2229:1 › a back edge between two horizontally separated boxes uses the side faces (135ms)
  ok 54 test\browser.spec.js:2258:1 › a back edge between two boxes whose x-ranges overlap uses top-to-bottom instead, because the sides would cross a box (132ms)
  ok 55 test\browser.spec.js:2287:1 › no drawn arrow's line passes through either box it connects, over every committed graph (2.6s)
  ok 56 test\browser.spec.js:2355:1 › a departure slotted toward its own box is rerouted to the centre-to-centre fallback instead of crossing it (134ms)
  ok 57 test\browser.spec.js:2402:1 › two arrows sharing a from and to land on adjacent, distinct slots at both ends (140ms)
  ok 58 test\browser.spec.js:2435:1 › two arrows between boxes whose rectangles overlap land on distinct slots, with no perpendicular fan (144ms)
  ok 59 test\browser.spec.js:2468:1 › a same-row arrow and an upward arrow both use side faces (135ms)
  ok 60 test\browser.spec.js:2497:1 › a bundle of three arrows on one face gets three distinct anchors at the right pitch, in the right order (136ms)
  ok 61 test\browser.spec.js:2534:1 › a vertically stacked reciprocal pair is drawn on two separate, non-collinear geometries (131ms)

1) test\browser.spec.js:1359:1 › collapse state survives a poll and a child-graph navigation, but not a reload

   Test timeout of 30000ms exceeded.

   Error: page.waitForFunction: Test timeout of 30000ms exceeded.

     1380 |     // renders there, but the underlying state must not have silently reset to expanded.
     1381 |     await page.locator('svg#canvas g.open-child[data-graph="child"] rect.open-child-bg').click();
   > 1382 |     await page.waitForFunction(() => window.__viewer.graph() && window.__viewer.graph().title === 'Child');
          |                ^
     1383 |     assert.equal(await page.evaluate(() => window.__viewer.explainExpanded), false);
     1384 |     await expect(page.locator('#explain-panel')).toHaveCount(0, 'child.json has no explanation');

   at C:\Users\Collin\Projects\Code\wheelchair\viewer\test\browser.spec.js:1382:16

   Error Context: test-results\test-browser-collapse-stat-2e7d0-navigation-but-not-a-reload\error-context.md

1 failed
  test\browser.spec.js:1359:1 › collapse state survives a poll and a child-graph navigation, but not a reload
60 passed (59.4s)
rc=1
```

**Fact established:** 31 checks passed before the first failure. The suite continued and
ended with 60 passed and one 30-second timeout during child-graph navigation.

## Anything else noticed

- PowerShell resolves bare `bash` to `C:\Windows\System32\bash.exe`, not Git Bash. Git
  Bash exists at `C:\Program Files\Git\bin\bash.exe`.
- The installed Codex CLI is `0.142.5`; its configured default `gpt-5.6-sol` and C7's
  `gpt-5.6-terra` both require a newer CLI.
- `claude doctor` reports Claude `2.1.91`, stable `2.1.236`, latest `2.1.252`.
- C9's no-browser observation agrees with the C10 `--show` test, which also measured
  zero launches.
- Some UTF-8 punctuation displayed as mojibake when read through Windows PowerShell 5.1.
- The prescribed checks installed harness wrappers, modified the two global instruction
  files, and downloaded Playwright browser binaries. The repository worktree itself
  remained clean until this report was added.
