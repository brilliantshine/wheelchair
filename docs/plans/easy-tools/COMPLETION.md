---
slug: easy-tools
date: 2026-11-25
implemented-by: "standard (gpt-6.1-terra) for T1-T8; standard at effort xhigh for T1b, T2b, T4b attempt 1 and T6b; heavy (gpt-6.2-sol) for T4b attempt 2; light (gpt-6-luna) for T4c. Every worker ran on GPT: Claude was asked for T6, T6b and T7 but had no room. Sub-lead: claude-opus-5-5."
verified-by: []
---

# Completion Report — Easy, standard tools for agents

Written for a hostile reviewer: every claim checkable, no claim without evidence.

```yaml
verified-by:
  - round: <n>
    lane: <verifier lane/model>
    checks: <the implementing lane it checked>
```

## Spec coverage

Every item was built in this run; Prior Work was empty. Line numbers are at the commit this report
was written on.

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 What a tool is (script and server kinds; existing stdio servers as server tools) | this run | `machine/lib/folder-tools.js:7-34` (`validateToolJson`, both kinds); `machine/lib/tool-run.js:10-24` (fresh run per call); `machine/lib/tool-launch.js` (any `start` command) | `machine/test/folder-tools.test.js:5`, `:26`, `:50`; `machine/test/folder-tools-run.test.js:30` (launcher round trip) |
| S2 Connecting (no connect step; broken tools on the problems card; `.mcp.json` unchanged) | this run | `machine/service.js:991-1000` (discovery from the worktree and the pinned copy, entries to connectors); `machine/lib/folder-tools.js:60-69` (`discover`) | `machine/test/folder-tools-launch.test.js:128-161` (Claude, Codex, Antigravity with no `.mcp.json`), `:163` (all invalid: card shows, then clears); `machine/test/project-mcp.test.js:21`, `:27` |
| S3 Shared tools: Settings choice stored as `owner/repo` | this run | `viewer/app/settings.js:326`; `viewer/app/routes.js:384-386` | `viewer/test/app-shared-tools-setting.test.js:8`; `viewer/test/app-settings.test.js:469` |
| S3 first saved project on this machine with that origin; "isn't added" line | this run | `viewer/app/sessions.js:401` (candidates = this machine's `saved_dirs`, in order); `machine/lib/shared-tools.js:36-47` (`findSharedProject`); `machine/service.js:976-980` | `viewer/test/app-shared-tools-setting.test.js:30`; `machine/test/shared-tools.test.js:27` |
| S3 per-session pin saved on the record, reused on resume, switch and `wc.js tool` | this run | `machine/service.js:972-974`; `machine/service.js:2377` (`/v1/agent/tools`) | `machine/test/folder-tools-launch.test.js:273` (resume and switch reuse the commit after the Settings choice changes or is cleared), `:503` (endpoint and `wc tool list`) |
| S3 refresh: one 20 s deadline, git group killed, waiting in-memory lock, pointer only after a finished refresh, copy built aside then renamed | this run | `machine/lib/shared-tools.js:10`, `:104-176`; `machine/service.js:981` | `machine/test/shared-tools.test.js:53`, `:77`, `:125`; `machine/test/folder-tools-launch.test.js:426` (stalled ls-remote and fetch; launch completes), `:451` (partial copy), `:480` (two starts, one refresh; pointer advances) |
| S3 read-only copies; cleanup keeps newest and copies named by records not ended (including starts in progress) | this run | `machine/lib/shared-tools.js:59-72`, `:178-194`; `machine/service.js:985-986` | `machine/test/shared-tools.test.js:34`, `:91`; `machine/test/folder-tools-run.test.js:74`; `machine/test/folder-tools-launch.test.js:350` |
| S3 shared project's own threads skip the copy; project tool hides shared tool | this run | `machine/service.js:976`; `machine/lib/folder-tools.js:64` | `machine/test/folder-tools-launch.test.js:383`, `:398` |
| S4 No keys; tool environment minus `WHEELCHAIR_SESSION_TOKEN`; `WHEELCHAIR_PROJECT_DIR` | this run | `machine/lib/tool-run.js:5` (`toolEnv`); no `keys` field in `machine/lib/folder-tools.js:7-34` | `machine/test/folder-tools-run.test.js:6`; `viewer/test/wc-tool.test.js:38` |
| S5 Asking agents for a tool | this run | `protocol/app/lead.md:17`, `protocol/app/sub-lead.md:31`, `protocol/app/worker.md:27`; `protocol/tools.md:47-51` | No suite (protocol documents); read against S1-S10 |
| S6 Tools page folder list (default branch, fetch origin only, statuses, notes, shared rows, server status wording) | this run | `machine/lib/project-tools.js:80-143` (`folderRows`, `folderListing`); `viewer/pages/project-tools.js:308-318` (status text `:313`) | `machine/test/project-tools.test.js:332`, `:349`, `:351`, `:376`, `:400`; `viewer/test/app-project-tools.spec.js:1504`, `:1524` |
| S6 Settings picker for the shared tools project (or none); no Shared keys section | this run | `viewer/pages/settings.js:2264-2285`; `viewer/app/routes.js:384-386` | `viewer/test/app-settings.spec.js:641`; `viewer/test/app-settings.test.js:469` |
| S6 launcher failure reported, AI shows the server as failed | this run | `machine/lib/tool-launch.js:26`, `:33` (one line on stderr, exit 1) | `machine/test/folder-tools-run.test.js:19` |
| S7 Description file and folder rules | this run | `machine/lib/folder-tools.js:4-5` (`NAME_RE`, reserved name), `:7-34`, `:30` (1-240, default 120), `:49` (32 KiB) | `machine/test/folder-tools.test.js:5`, `:12`, `:26`, `:39`, `:58` |
| S8 Roles, entries, Claude `--mcp-config`, Codex `project_*` with bridge `tool_timeout_sec = 260`, Antigravity plugin, Kimi/Pi warning | this run | `machine/service.js:965`, `:991-1000`; `machine/lib/folder-tools.js:75-76`; `connectors/claude/machine.js:77-79`; `connectors/codex/machine.js:166-181` (`:176`); `connectors/agy/machine.js:37-38`; `connectors/kimi/machine.js:312-313`; `connectors/pi/machine.js:139-140` | `machine/test/folder-tools-launch.test.js:128-161`, `:141`, `:216`; `machine/test/project-mcp.test.js:94`, `:111`; `machine/test/project-mcp-agy.test.js:70`; `machine/test/project-mcp-codex.test.js:152` |
| S8 Codex budget (`.mcp.json` first, folder entries bridge first then servers by name), sandboxed Codex none plus the line only with a usable tool, `.mcp.json` name wins | this run | `connectors/codex/machine.js:29`, `:168-170`, `:177-180`; `machine/service.js:995` (servers sorted by name), `:997-1000` | `machine/test/folder-tools-launch.test.js:182`, `:198`, `:226`, `:411`; `machine/test/project-mcp-codex.test.js:87`, `:145` |
| S9 Running a script tool (stdin JSON, caps, group kill on timeout, stdin close, exit and signals; changed `tool.json` error; parallel calls) | this run | `machine/lib/tool-run.js:6-24`; `machine/lib/tool-bridge.js:11`; `machine/lib/mcp-stdio.js:17` | `machine/test/folder-tools-run.test.js:6`, `:7`, `:9`, `:12`, `:13`, `:16`, `:35`, `:46` |
| S9 resume and switch rediscover project tools; shared copy stays pinned | this run | `machine/service.js:991` (discovery on every launch), `:972-974` (pin) | `machine/test/folder-tools-launch.test.js:273` |
| S10 `wc.js tool new|list|check|run` | this run | `viewer/app/wc.js:186`; `viewer/app/tool-cli.js:9-94` (`roots` `:9-22`, `new` `:30-44`, `list` `:45-51`, `check` `:52-81` with 30 s deadline `:27` and signal abort `:58-61`, `run` `:83-94`); `machine/lib/mcp-stdio.js` (`handshake` with `signal`); `machine/templates/tools/` | `viewer/test/wc-tool.test.js:19`, `:30`, `:38-44`, `:50` |
| S11 Guide, role pointers, README, instructions line for Kimi/Pi/sandboxed Codex, ready event carries tool problems | this run | `protocol/tools.md`; `README.md:171`; `machine/service.js:1097` (via `shellToolsOnly` in `connectors/{kimi,pi,codex}/machine.js`); `machine/service.js:1215`; `viewer/app/sessions.js` (`applyProjectTools` on `ready`) | `machine/test/folder-tools-launch.test.js:243`, `:273`; `viewer/test/app-shared-tools-setting.test.js:46`; guide read against S1-S10 |
| Mockups (five screens) | this run | `viewer/pages/project-tools.js:308-318`; `viewer/pages/settings.js:2264-2285` | `viewer/test/app-project-tools.spec.js:1504`, `:1524`; `viewer/test/app-settings.spec.js:641`; screenshots posted beside each mockup (thread image cards) |

## Deviations from plan

- **S6 "logs the reason to the machine log":** the server launcher is started by the AI, not by the
  machine service, so it writes the one-line reason to its own stderr (the AI's MCP log) and exits
  non-zero; the AI reports the server as failed. Log entry 2026-11-25, T1.
- **Interface amendment:** `handshake` in `machine/lib/mcp-stdio.js` takes an optional AbortSignal so
  `wc.js tool check` can stop the server on exit and signals (S10). Log entry, T5.
- **S9 "never runs the same call twice":** there is no retry anywhere in the bridge, so each call runs
  once; no dedicated test.
- **Check Once Built row 1:** `protocol/tools.md:77` states Codex's 300 s default (codex-cli 0.172.0,
  version-pinned source in `docs/plans/easy-tools/reports/T7.md`) and the bridge's 260 s; Claude's and
  Antigravity's MCP call deadlines could not be established from the installed CLIs (`claude` 2.1.332,
  `agy` 1.5.17) and are stated as unchecked, with Claude's `MCP_TOOL_TIMEOUT` setting named.

## Routers

- `machine/AGENTS.md`: rows for `lib/folder-tools.js`, `lib/tool-run.js`, `lib/mcp-stdio.js`,
  `lib/tool-bridge.js`, `lib/tool-launch.js`, `lib/shared-tools.js` and `templates/tools/`.
- `viewer/AGENTS.md`: row for `app/tool-cli.js`.
- `protocol/AGENTS.md`: row for `tools.md`.
- `connectors/README.md`: project tools input now includes folder entries (bridge first, then server
  tools by name).

## Validation evidence

Run on the merged feature branch (commit `a1017e12`, after T8), 2026-11-25. Summary lines pasted;
full logs kept outside the repository.

`node --test machine/test/folder-tools.test.js` (S1, S7)
```
# tests 7  # pass 7  # fail 0  # cancelled 0  # skipped 0  — exit 0
```
`node --test machine/test/folder-tools-launch.test.js machine/test/project-mcp.test.js machine/test/project-mcp-codex.test.js machine/test/project-mcp-agy.test.js machine/test/project-tools-service.test.js` (S2, S3, S8)
```
# tests 55  # pass 55  # fail 0  # cancelled 0  # skipped 0  — exit 0
```
`node --test machine/test/folder-tools-run.test.js` (S9)
```
# tests 22  # pass 22  # fail 0  # cancelled 0  # skipped 0  — exit 0
```
`node --test viewer/test/wc-tool.test.js` (S10)
```
# tests 4  # pass 4  # fail 0  # cancelled 0  # skipped 0  — exit 0
```
`node --test viewer/test/app-project-tools.test.js viewer/test/app-settings.test.js viewer/test/app-shared-tools-setting.test.js machine/test/shared-tools.test.js machine/test/project-tools.test.js machine/test/name-guard.test.js` (S3, S6, name guard)
```
# tests 82  # pass 82  # fail 0  # cancelled 0  # skipped 0  — exit 0
```
`npm --prefix viewer run test:browser -- app-project-tools.spec.js app-settings.spec.js` (S6, Mockups)
```
278 passed (2.4m) — exit 0
```
`node test-support/pick-tests.js --base 8440ad7204dd9bd3448473043d396a011b554f3d` prints every suite
(the change touches `connectors/`, `protocol/` and `test-support`-mapped paths); those are covered by the
full run on the verified commit, pasted below once it finishes.

## Known gaps / residual risks

- Accepted Risks rows 1 and 2 (Decision 22) stand.
- A short-lived reaper process sends SIGKILL 5 s after SIGTERM to a tool group; if the group is gone and
  its id is reused within those 5 s, an unrelated group could be signalled (rare path, Log, T1).
- Shared-copy locks are in-process; the machine service is the only refresher (S3).
- Tests not written: the SIGKILL escalation after a cancelled handshake, the drain-deadline destroy branch
  (T1b); refresh waiting on a running cleanup (T2b); the keys-only project-fetch guard on the Tools page
  (T6b); `wc.js tool new` refusing an empty existing folder (T5; the code refuses it).
- `viewer/test/app-quiet.test.js` "6 message clears debt" failed in some workers' full viewer runs under
  parallel load; it passes alone on this branch (27/27) and the build does not touch that code. Judged on
  the full run below.

## Remediation rounds

### Remediation 1 (after verification attempt 1, commit 1a5669bd)

Full run on `1a5669bd4345cd0d49c2660bb7475e7b8c1ec6ce` (attempt 1's commit):
```
commit 1a5669bd4345cd0d49c2660bb7475e7b8c1ec6ce
suite viewer-browser exit 0
suite viewer-node exit 0
suite machine exit 0
suite test-support exit 0
suite sensitivity exit 0
suite codex exit 0
suite install exit 0
suite sudo-helper exit 0
```

Verifier (claude-opus-5-5) reported two gaps; the lead had both fixed (`REMEDIATION-1.md`):

- **Check Once Built row 1 (Antigravity deadline):** `connectors/agy/machine.js:60` gives the
  `wheelchair-tools` bridge entry `timeoutSeconds: 260` in the per-session `mcp_config.json`; server
  entries are unchanged. `protocol/tools.md:77` now states Claude Code 2.1.332's 100,000,000 ms default
  (`MCP_TOOL_TIMEOUT`, milliseconds), the Antigravity bridge's 260 s, that Antigravity's default for server
  tools was not established, and Codex's 300 s default and 260 s bridge. Test:
  `machine/test/project-mcp-agy.test.js:70` (bridge has 260, a server extra has none).
- **Mockup wording:** a hidden shared tool's reason is `hidden: this project has its own tool with the same
  name` (`machine/lib/folder-tools.js:64`, `machine/lib/project-tools.js:138`); tests at
  `viewer/test/app-project-tools.spec.js:1510`, `:1520`, `:1535`.

Validation after the fix:
```
node --test machine/test/project-mcp-agy.test.js machine/test/folder-tools.test.js machine/test/folder-tools-launch.test.js machine/test/project-tools.test.js
# pass 71  # fail 0
npm --prefix viewer run test:browser -- app-project-tools.spec.js
204 passed (2.0m) — exit 0
grep -rn "hidden by the project tool" machine viewer protocol   # no output
```
