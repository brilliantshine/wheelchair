---
slug: server-tool-keys
date: 2026-11-27
implemented-by: "standard (gpt-6.1-terra): T1, T2, T3, T4; light (gpt-6-luna): T5, T6; sub-lead claude-opus-5-5"
verified-by: []
---

# Completion Report — Keys for server tools

Written for a hostile reviewer: every claim checkable, no claim without evidence.

Commit checked by the validation below: `2372fa51`. Prior Work was empty; every row is `this run`.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 keyed servers valid, refusal removed, same key-name rules | this run | `machine/lib/folder-tools.js:15` (key rules, refusal line deleted) | `machine/test/folder-tools.test.js` (key declarations test); `grep -rn -i "aren't supported yet" machine viewer protocol` finds nothing |
| S2 discovery: missing/unusable key not offered, same problems text, `shared tool` prefix, store read error as problems line | this run | `machine/service.js:1024-1035` | `machine/test/folder-tools-launch.test.js` tests `keyed server discovery checks keys and keeps values out of entries`, `shared project uses shared store and missing shared tool identifies its source` |
| S2 no extra key line where servers aren't connected (sandboxed Codex, Kimi, Pi) | this run | `machine/service.js:1026` (`!adapter.shellToolsOnly`) | same discovery test, loop over kimi, pi, sandboxed |
| S2 Tools page and `wc.js tool list` key status for keyed servers | this run (route unchanged; already kind-agnostic) | `machine/lib/project-tools.js:155-160`; agent `tool-keys` route in `machine/service.js` | `machine/test/project-tools.test.js:486`; `viewer/test/wc-tool.test.js` `keyed server lists report key status`; `agent routes report key status ...` (`srv` row) |
| S2 `tool check` without keys, ` (checked without its keys)`, failure line; `tool run` still refuses servers | this run | `viewer/app/tool-cli.js:123-127` | `viewer/test/wc-tool.test.js` `keyed check and run describe key handling while preserving caller environment` |
| S3 `serverEntry` store args for keyed rows only, no values | this run | `machine/lib/folder-tools.js:78`; `machine/service.js:1035` passes `stateDir` | discovery test asserts args and value absence; `folder-tools.test.js:53` keyless entry shape |
| S3 launcher: args, NODE_DEBUG refusal, keys-changed both directions, fresh store read, missing key/read error, values only in env, spawn errors name only code | this run | `machine/lib/tool-launch.js:11-48` | `folder-tools-launch.test.js` keyed launcher tests from line 631 (refusals, env not in argv, `keyless entry refuses a server that gained keys` :689) |
| S3 keyless server unchanged | this run (untouched path) | `machine/lib/tool-launch.js:50-53` | `keyless launcher still spawns with inherited stderr` :767 |
| S4 JSON reader | this run | `machine/lib/server-lines.js:10` | `server-lines.test.js` `reader reports decoded string ranges and complete members` |
| S4 detection (raw search, pieces, escape runs, 4 KiB, batches ≤1 MiB, one budget, combining) | this run | `machine/lib/server-lines.js:90-128` | `server-lines.test.js` (11 named cases + T6 cases); `folder-tools-launch.test.js:828`, `:835` |
| S4 outcomes 1–3 (unchanged / replaced / held back), every message kind | this run | `machine/lib/server-lines.js:130-212` | `folder-tools-launch.test.js:799`, `:815`, `:823`; `server-lines.test.js` |
| S4 backpressure (stdout and stderr) | this run | `machine/lib/server-relay.js:29-36`, `:83-84` | `paused client receives final server reply after eight seconds` :726; `server-relay.test.js` writable-queue/memory test |
| S4 size limit 32 MiB | this run | `machine/lib/server-relay.js:49-63`; `server-lines.js:212` | `oversized lines use only a complete id before the cutoff` :733; `:849`; `server-relay.test.js` line-bound test |
| S4 shutdown (stdin end, 5 s unpaused, 60 s hard, 2 s post-exit unpaused, client gone, signals) | this run | `machine/lib/server-relay.js:14-28`, `:85-105`; signals `tool-launch.js:46` | `:707`, `:713`, `:740`, `:747`, `:754`; `server-relay.test.js` pause-deadline tests |
| S5 held-back replies (clean id copied, fresh budgets, generated line checked, drop otherwise) | this run | `machine/lib/server-lines.js:132-150` | `:799` (id bytes `9007199254740993`, string id, key in id dropped), `:835` (unchecked, id-stretch case) |
| S6 held-back server requests answered on server stdin, injection at client line boundary, input backpressure, server stdin error/close | this run | `machine/lib/server-relay.js:37-42`, `:92-104`; text `server-lines.js:141-143` | `held server request waits for the end of the client line before injection`; `:815`; `:719`; `:760`; `server-relay.test.js` input-queue test |
| S7 stderr piped and redacted in 4 KiB pieces with carry-over | this run | `machine/lib/server-relay.js:65-80` | `stderr redacts a key across the piece edge and preserves long ordinary lines` :701 |
| S8 guide | this run | `protocol/tools.md:47`, `:62`, `:66`, `:68`, `:70`, plus Make and test and AI limits wording | `grep` checks below; read as Markdown |
| `key-spell.js`, `key-redact.js` unchanged (Decisions 16, 18) | this run | — | `git diff 0cfa4742..HEAD -- machine/lib/key-spell.js machine/lib/key-redact.js` is empty |

## Deviations from plan

- Four internal measurements in the S3–S7 Validation list are taken by fake-stream tests of `machine/lib/server-relay.js` (`machine/test/server-relay.test.js`), while the end-to-end launcher tests check the same behaviour from outside: the held line never above 32 MiB, the server-stdin queue during a 20 MiB request, stdout confirmed paused through the 60 s limit, and the post-exit deadline not counting paused time. The five-20-MiB-replies `writableLength`/external-memory case is also fake-stream only. The brief allowed this; the Validation line names `folder-tools-launch.test.js`, so a verifier may judge it.
- Keyed servers on shell-only AIs (Kimi, Pi, sandboxed Codex) now appear in those AIs' existing "server tools don't work" warnings (before, they were invalid and absent). No key line is added there, as S2 requires.
- The `uses keys: not available to sandboxed Codex, Kimi or Pi` Tools-page note is shown only for keyed scripts (`machine/lib/project-tools.js:160`).

## Routers

`machine/AGENTS.md`: two rows added for the new modules `lib/server-relay.js` and `lib/server-lines.js` (commit `2372fa51`). No other router names a touched file in a way that became false.

## Validation evidence

At `2372fa51`:

```text
$ node --test machine/test/folder-tools.test.js
# tests 9
# pass 9
# fail 0
$ node --test machine/test/folder-tools-run.test.js viewer/test/wc-tool.test.js machine/test/project-tools.test.js
# tests 86
# pass 86
# fail 0
$ node --test machine/test/folder-tools-launch.test.js machine/test/key-redact.test.js
# tests 72
# pass 72
# fail 0
$ node --test machine/test/server-lines.test.js
# tests 13
# pass 13
# fail 0
$ node --test machine/test/server-relay.test.js
# tests 5
# pass 5
# fail 0
$ node --test machine/test/name-guard.test.js
# tests 2
# pass 2
# fail 0
$ grep -n -i "aren't supported yet" protocol/tools.md
exit 1
$ grep -n -i "never print or log a key" protocol/tools.md
70:In script output, keys printed as-is ... Never print or log a key in any form. ...
```

`bash machine/test/run.sh` on T1's branch: 906 tests, 904 pass, 0 fail. The full run (`test-support/full-run.sh`) result is appended below once it finishes.

Sub-lead measurement: a 2.6 MiB reply of 100,000 short strings each holding `\n`, two absent keys: 4.5 s before T6, 0.18 s after.

## Known gaps / residual risks

- Accepted Risks in PLAN.md stand as written.
- A held-back-line note on stderr can land between 4 KiB pieces of a long server stderr line (notes bypass the stderr line buffer; they contain only the tool name).
- After client stdin ends, a held-back server request's injected reply is written to an ended stdin and lost (covered by the round-2 Accepted Risk).
- The over-32 MiB reply text is asserted exactly in `server-lines.test.js` and by regex end to end (`folder-tools-launch.test.js:733`).
- Elapsed bounds in the 5 s / 15 s end-to-end tests include the fake server's 1.2 s linger before exit.

## Remediation rounds

None yet.
