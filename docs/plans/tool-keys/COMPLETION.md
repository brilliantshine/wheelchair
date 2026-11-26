---
slug: tool-keys
date: 2026-11-26
implemented-by: "standard / gpt-6.1-terra (T1, T2a, T2b, T2c, T2d attempts 1-2 (attempt 2 at xhigh), T3a, T3b attempts 1-2 (attempt 2 at xhigh), T4, T5 attempt 1); light / gpt-6-luna (T3c, T5 attempt 2); sub-lead: claude-opus-5-5. Claude was requested for T3b and T5 but unavailable."
verified-by:
  - round: 1
    lane: verifier / claude (top tier)
    checks: standard and light / gpt-6.1-terra, gpt-6-luna
---

# Completion Report — Keys for folder tools

Written for a hostile reviewer: every claim checkable, no claim without evidence. Line numbers
are at commit `31b139ff`.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| K1 `keys` in `tool.json` (1-20 unique names, `KEY_NAME`, not reserved; `keys` carried, `[]` default) | this run | `machine/lib/folder-tools.js:15-16` | `machine/test/folder-tools.test.js` |
| K1 server tools with keys refused by the validator (launcher, discovery, CLI all use it) | this run | `machine/lib/folder-tools.js:17`; launcher re-validates at `machine/lib/tool-launch.js` (unchanged) | `folder-tools.test.js`; `folder-tools-run.test.js` (launcher refuses server tool declaring keys); `folder-tools-launch.test.js` (keyed server excluded while keyless server connects) |
| K2 project tools use the project store, shared tools the shared store, the shared project's own tools the shared store | this run | `machine/lib/folder-tools.js:80` (`toolKeyStore`); `machine/service.js:1000`; `machine/lib/project-tools.js:150-160` | `folder-tools-run.test.js`, `folder-tools-launch.test.js` (own worktree uses `--key-store shared`), `project-tools.test.js` |
| K2 shared key store `<stateDir>/shared-keys/keys.json` (0700/0600, atomic, revision) | this run | `machine/lib/shared-keys.js:6-29` | `machine/test/shared-keys.test.js` |
| K2 usable values (8-4096 of letters, digits, `. _ ~ + / = -`) and reasons | this run | `machine/lib/project-keys.js:9-15` | `project-keys.test.js` |
| K2 Shared keys refuses unusable values; project editor marks them; names routes return `set`/`folder_usable`/reason, never values | this run | `machine/lib/shared-keys-page.js` (`write`); `machine/lib/project-tools.js:289` (`storeInfo`), `decorate`; `viewer/pages/project-tools.js:1105` | `shared-keys-page.test.js`, `project-tools.test.js` (no value in any response), `app-project-tools.spec.js` |
| K3 bridge entry unchanged for keyless tools; keyed rows add store and names; `--state-dir` once | this run | `machine/lib/folder-tools.js:78` | `project-mcp-codex.test.js` (keyless bridge retains legacy arguments and fits the same near-limit budget), `folder-tools.test.js` |
| K3 bridge reads the store on each call, adds exactly the declared keys, override of inherited names | this run | `machine/lib/tool-bridge.js:10-24` | `folder-tools-run.test.js` |
| K3 bound to agent start: changed keys refused as changed | this run | `machine/lib/tool-bridge.js:14-15` | `folder-tools-run.test.js`, `wc-tool.test.js` (changed-tool text) |
| K3 no value in MCP configs, agent env or instructions; `.mcp.json` injection unchanged | this run (injection pre-existing, untouched) | `machine/service.js:995-1022` | `folder-tools-launch.test.js` (no key value in artifacts) |
| K3 missing key: not offered, problem line names every missing key | this run | `machine/service.js:1013` | `folder-tools-launch.test.js` |
| K3 mid-session: replaced value next call; removed key errors without running; added key from next agent start | this run | `machine/lib/tool-bridge.js:17-20` | `folder-tools-run.test.js` |
| K4 cut edges, plain-key marking with one `[key]` per run, then 1 MiB / 4 KiB cuts; capture limits; nothing returned before close | this run | `machine/lib/key-redact.js:4-23`; `machine/lib/tool-run.js:16-45` | `machine/test/key-redact.test.js` |
| K4 Node `child_process` debug output refuses keyed runs | this run | `machine/lib/tool-run.js:18`; bridge returns the refusal `tool-bridge.js:23` | `key-redact.test.js` (`*`, `child*`, `CHILD_PROCESS`), `folder-tools-run.test.js` |
| K4 launch errors report only the code | this run | `machine/lib/tool-run.js:22` | `key-redact.test.js` |
| K4 keyless output unchanged | this run | `machine/lib/tool-run.js` (`runKeylessScript`, the previous body) | `key-redact.test.js`, existing `folder-tools-run.test.js` |
| K5 reasons from connectors; sandboxed Codex, Kimi, Pi get `needs keys, which <reason>` per valid, non-hidden keyed script tool; keyed tools absent from their entries | this run | `connectors/codex/machine.js:125`, `connectors/kimi/machine.js:250`, `connectors/pi/machine.js:20`; `machine/service.js:1001-1008` | `folder-tools-launch.test.js`, `name-guard.test.js`, `connectors-contract.test.js` |
| K5 lines kept per session (`state.keyed`), removed when it ends; hub card keeps them, dismissal by text, new lines first under the 20 cap | this run | `machine/service.js:783-785`; `viewer/app/sessions.js:148-215` | `viewer/test/app-project-tools-card.test.js` |
| K5 `/v1/agent/tools` `keyed_unavailable` | this run | `machine/service.js:2413` | `folder-tools-launch.test.js` |
| K6 `list` key status via names-only route; `keyed_unavailable`; no-token text | this run | `machine/service.js:2414`; `viewer/app/tool-cli.js:46-75` | `viewer/test/wc-tool.test.js` |
| K6 `check` says validated without keys; `run` keyless with its notice; changed-tool error points to next agent start | this run | `viewer/app/tool-cli.js:93`, `:117`; `machine/lib/tool-bridge.js:15` | `wc-tool.test.js` |
| K6 `new` template unchanged | this run (no change) | `machine/templates/tools/` untouched | — |
| K7 Tools page needs-key line, Settings hint on the shared project's own page, uses-keys line | this run | `machine/lib/project-tools.js:150-165`; `viewer/pages/project-tools.js:309-321` | `project-tools.test.js`, `app-project-tools.spec.js` |
| K7 project key editor lists folder-tool names (project store only), usage and remove texts | this run | `viewer/pages/project-tools.js` (`keyRowNames`, `keyUsage`, `keyRow`) | `app-project-tools.spec.js` |
| K7 key-only refresh keeps drafts and baseline, returns `key_revision`; 409 key-only keeps drafts; combined save reloads | this run | `machine/lib/project-tools.js:168`; `machine/service.js:2181`; `viewer/pages/project-tools.js:950-1032` | `project-tools.test.js`, `shared-keys-page.test.js` (route), `app-project-tools.spec.js` |
| K7 Settings Shared keys with machine chooser, write-only values, revision, `changed elsewhere, reload`, serialized writes, no-copy fetch and failure note | this run | `viewer/pages/settings.js:2416-2460`; `machine/lib/shared-keys-page.js`; `machine/service.js:2192-2203` | `shared-keys-page.test.js`, `app-settings.spec.js` |
| K7 hub routes pass shared-key reads/writes to the chosen machine | this run | `viewer/app/routes.js:85-112` | `viewer/test/app-project-tools.test.js` |
| K8 guide: `keys` field and example, stores, what reaches the agent, redaction and its limit, never print or log a key, which agents, how to try one, server tools can't have keys | this run | `protocol/tools.md:45-72` | greps below; rendered read |
| K8 starting line for any valid script tool, keyed clause only when a valid non-hidden script tool declares keys | this run | `machine/service.js:1120` | `folder-tools-launch.test.js` |

## Deviations from plan

- K7 says the Shared keys machine chooser is "the same control the project Tools page uses". It
  is the same kind of `<select>` fed from the same machine list (`/new-thread`), but a separate
  element (`#shared-keys-machine`), not a shared component.
- Settings shows Shared keys even with no shared tools project chosen (stored names plus the
  machine's note); the Spec doesn't say either way.
- Shell-only sessions (Kimi, Pi, sandboxed Codex) show only the `needs keys, which …` line for a
  keyed tool; other folder problem lines for that tool are dropped there.

## Routers

`machine/AGENTS.md` gained rows for `lib/shared-keys.js`, `lib/shared-keys-page.js` and
`lib/key-redact.js`. `connectors/README.md` lists the optional `shellToolsOnly` and
`keyedToolsReason` members.

## Validation evidence

Every Spec validation command, run by the sub-lead on commit `31b139ff`:

```text
$ node --test machine/test/folder-tools.test.js machine/test/folder-tools-run.test.js machine/test/folder-tools-launch.test.js machine/test/project-keys.test.js machine/test/shared-keys.test.js
exit 0
# tests 74
# pass 74
# fail 0
# skipped 0
$ node --test machine/test/key-redact.test.js machine/test/folder-tools-run.test.js
exit 0
# tests 33
# pass 33
# fail 0
# skipped 0
$ node --test machine/test/project-mcp-codex.test.js machine/test/project-tools-service.test.js machine/test/folder-tools-launch.test.js
exit 0
# tests 50
# pass 50
# fail 0
# skipped 0
$ node --test viewer/test/app-project-tools-card.test.js
exit 0
# tests 20
# pass 20
# fail 0
# skipped 0
$ node --test machine/test/project-tools-service.test.js
exit 0
# tests 7
# pass 7
# fail 0
# skipped 0
$ node --test machine/test/name-guard.test.js
exit 0
# tests 2
# pass 2
# fail 0
# skipped 0
$ node --test viewer/test/wc-tool.test.js
exit 0
# tests 7
# pass 7
# fail 0
# skipped 0
$ node --test viewer/test/app-project-tools.test.js viewer/test/app-settings.test.js viewer/test/app-shared-tools-setting.test.js machine/test/project-tools.test.js
exit 0
# tests 73
# pass 73
# fail 0
# skipped 0
$ npm --prefix viewer run test:browser -- app-project-tools.spec.js app-settings.spec.js
exit 0
  ✓  123 [chromium] › test/app-project-tools.spec.js:1060:1 › Unity preset reports a failed fetch (318ms)
  ✓  143 [chromium] › test/app-project-tools.spec.js:1237:1 › a failed request says Couldn't check (1.0s)
  2 skipped
  172 passed (1.2m)
$ grep -n '"keys"' protocol/tools.md
58:  "keys": ["LOOKUP_API_KEY"]
$ grep -n -i "never print or log a key" protocol/tools.md
70:Never print or log a key
$ grep -n -i "do not support keys yet\|must wait for key support" protocol/tools.md
exit 1
31b139ff8525b371425604b588ea1e2a4ddb795c
```

Full run (`bash test-support/full-run.sh`) on the verified commit, second run; the first run's only failure was `machine/test/screen.test.js` "marker mode and app umask preserve service umask" (ENOENT on a temp file), a file this change does not touch, which passed 3/3 alone and in the repeat run:

```text
commit 42bbb5cf647174ed2740c1673ae4b7edd5b643d9
suite viewer-browser exit 0 seconds 356
suite viewer-node exit 0 seconds 94
suite machine exit 0 seconds 382
suite test-support exit 0 seconds 24
suite sensitivity exit 0 seconds 4
suite codex exit 0 seconds 6
suite install exit 0 seconds 33
suite sudo-helper exit 0 seconds 9
```

Verification attempt 1 (claude verifier): PASS on `42bbb5cf`, no gaps. Its observations, not gaps: `machine/API.md` does not list the new routes (`/v1/shared-keys/*`, `/v1/project-tools/key-status`, `/v1/agent/tool-keys`, `keyed_unavailable`); the names routes call the field `stored` where K2 says `set`; two specs write screenshots to fixed `/tmp/t3b-*.png` paths.

## Known gaps / residual risks

- No test of Shared keys Remove, Add a key or its hint text in `app-settings.spec.js`; no hub
  route timeout test for the shared-keys pass-through.
- The unreadable-shared-store note on the Tools page (`project-tools.js:152`) has no test.
- T2c's "no key value in bridge args" check uses literal args; the Codex variant only checks the
  bridge is present. The generated-config check for Claude is exact.
- A pending key value is restored after a key-only removal, including one for the removed name.
- Accepted Risks in PLAN.md stand (key files readable by a same-user agent; Codex 64 KiB limit near
  the boundary; two-tab draft overwrite; server-originated request carrying a key).

## Remediation rounds
