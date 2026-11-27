---
slug: shell-tool-keys
date: 2026-11-27
implemented-by: "T1, T3, T4, T5, T6: standard / gpt-6.1-terra; T2: light / gpt-6-luna (sub-lead: claude-opus-5-5)"
verified-by: []
---

# Completion Report — Keyed folder tools for Kimi and Pi

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 contract member | this run | connectors/contract.js:24 | machine/test/connectors-contract.test.js |
| S1 README row | this run | connectors/README.md:78 | read |
| S1 Kimi/Pi define `keyedToolsByMachine`, drop `keyedToolsReason` | this run | connectors/kimi/machine.js:250, connectors/pi/machine.js:20 | connectors-contract.test.js |
| S1 one eligibility helper used by launch, tools, run | this run | machine/service.js:42 (`machineKeyedTools`); called at :1006, :1124, :2421, run route :2422 ff. | folder-tools-launch.test.js, tool-machine-run.test.js, name-guard.test.js |
| S1 export | this run | registry unchanged by `node connectors/export.js` | `export.js --check` exit 0 |
| S2 no "needs keys, which" line; not-set line in keyed bucket, worded "when this session started" | this run | machine/service.js:1006-1020 | folder-tools-launch.test.js "shell-only sessions report keyed tools…", linked-worktree test |
| S2 keyed tools never in the bridge entry | this run | machine/service.js:1020 (`scriptRows` excludes keyed for eligible) | folder-tools-launch.test.js (`doesNotMatch tool-bridge.js`) |
| S2 instructions line clause | this run | machine/service.js:1124 | folder-tools-launch.test.js (prompt equality and match tests) |
| S2 sandboxed Codex unchanged | this run | machine/service.js:1006-1008, :1124 (non-eligible branch) | folder-tools-launch.test.js codex branch |
| S3 `keyed_run` | this run | machine/service.js:2421 | folder-tools-launch.test.js "agent routes report key status…" |
| S4 checks 1–4, statuses and texts | this run | machine/service.js:2422-2459 | tool-machine-run.test.js (14 tests) |
| S4 env: toolEnv + keys override caller | this run | machine/service.js ~:2449-2450 | tool-machine-run.test.js caller env / override |
| S4 disconnect aborts run | this run | machine/service.js:2428 (`response.on('close')`) | tool-machine-run.test.js disconnect test |
| S4 per-session abort set; stop/stopFatal/archive abort it; pre-spawn check | this run | machine/service.js:296, :1152, :1154, :1323, :1430, ~:2452 | tool-machine-run.test.js stop-mid-run and stop-during-discovery tests |
| S4 exit handlers before first run | this run | machine/service.js:2453 | tool-machine-run.test.js SIGTERM listener count |
| S5 `roots` returns `keyed_run` | this run | viewer/app/tool-cli.js:47 | viewer/test/wc-tool.test.js |
| S5 machine run, outcomes and messages | this run | viewer/app/tool-cli.js:11-30, :143-156 | wc-tool.test.js "machine keyed runs handle results, transport failures, and local fallback", "machine run reports refusal…" |
| S5 bytes decoded once | this run | viewer/app/tool-cli.js:26 | wc-tool.test.js multibyte case |
| S5 local path unchanged | this run | viewer/app/tool-cli.js:143 (else branch) | wc-tool.test.js local/missing `keyed_run` |
| S6 runner signal | this run | machine/lib/tool-run.js:13, :17, :44, :48 | machine/test/folder-tools-run.test.js (abort kills only its group; already-aborted runs nothing; keyed and keyless) |
| S7 protocol/tools.md three places | this run | protocol/tools.md:68, :70, :82, :102 | negative grep exit 0; read against service.js:1124 text |
| S7 machine/API.md | this run | machine/API.md:37-38 | read |
| S7 connectors/README.md | this run | connectors/README.md:78 | read |

## Deviations from plan

- S5: every `run` (keyless too) now reports `couldn't reach the machine service; the tool did not run` when its `/tools` request is refused. S5 asks this for `run` when `roots()` fails that way; before, a keyless `run` showed the raw error.
- S5: "did not run" covers ECONNREFUSED, ENOENT, EHOSTUNREACH, ENETUNREACH and ENOTFOUND before connect and flush; any other failure, and a non-200 without a readable `error`, says "may already have run" (the cautious side).

## Routers

None. This change moved no ownership, and no router names a file it touched in a way that became false (T5 checked protocol/AGENTS.md:18).

## Validation evidence

Run on the feature branch at the merge of all tasks:

```
$ node --test machine/test/folder-tools-run.test.js machine/test/folder-tools-launch.test.js machine/test/project-tools-service.test.js machine/test/key-redact.test.js machine/test/connectors-contract.test.js machine/test/name-guard.test.js machine/test/tool-machine-run.test.js
exit 0
# tests 107
# pass 107
# fail 0
$ node --test viewer/test/wc-tool.test.js viewer/test/app-project-tools-card.test.js
exit 0
# tests 29
# pass 29
# fail 0
$ node connectors/export.js --check
export exit 0
$ ! grep -nE "Kimi and Pi can't|cannot use keyed tools yet" protocol/tools.md
grep exit 0
```

Worker reports with full outputs: docs/plans/shell-tool-keys/reports/T1.md … T6.md.

## Known gaps / residual risks

- The route's disconnect and stop tests use a tool that kills its own child on SIGTERM, so they can't tell a group kill from a parent-only kill. Group killing on abort is tested directly in folder-tools-run.test.js (T1).
- The multibyte test in wc-tool.test.js writes the two halves with `setImmediate` between them but does not assert they arrived as two chunks.
- Workers showed deliberate-break checks for only some new tests (T4 one mutation; T6 none for the shared-tool wording).
- Accepted Risks in PLAN.md (service crash mid-run; caller-chosen env; edited tool script) stand.

## Remediation rounds
