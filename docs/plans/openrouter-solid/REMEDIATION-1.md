# Remediation 1 — openrouter-solid

Verification attempt 1 on commit 1a9e3781: Claude verifier PASS; GPT verifier FAIL. Gaps verbatim (GPT verifier):

- GAP: S1 — The required spend layout test failed intermittently in Chromium — `viewer/test/app-openrouter-spend.spec.js:40` got an empty computed `flexGrow` where it expected `1`. The case passed 24 consecutive targeted reruns across Chromium and Firefox.
- GAP: S3 — Pi aside replies can lose Unicode characters at stdout chunk boundaries — `machine/lib/aside-turns.js:106` decodes each chunk separately. An offline fixture sent `café` and the runner returned `caf��` with `state: ok`.
- GAP: S3 — Pi failures before the session header lose the original error and limit status — `machine/lib/aside-turns.js:133` returns `invalid Pi session header` before reading stderr. A fixture that exited with `HTTP 429 rate limit` returned `limit: false`.
- GAP: S4 — Session polling can report a startup exit before the reason is persisted — `machine/service.js:1587` and `:2067` use separate tmux snapshots. An exit between snapshots returned `running: false` without an `end_reason`. A concurrent poll also returned `running: false` while the reason's save was pending.

Judgment: the S4 gap is a rare path (sub-second window between two actors), recorded in PLAN.md Accepted Risks (verification-1). The lead answered fix for the other three (gap 3 is normal use for the user: their OpenRouter key has a $10 credit limit).

## Tasks

### R1a — gap 1 (built by Claude in T1; routed to Claude)
Make `viewer/test/app-openrouter-spend.spec.js` use retrying assertions (`toHaveCSS`, `expect.poll` for the height) instead of a one-shot `getComputedStyle`. Ownership: that spec file. Validation: `cd viewer && npx playwright test test/app-openrouter-spend.spec.js --repeat-each=20 --reporter=line`.

### R1b — gaps 2 and 3 (built by GPT in T5; routed to GPT)
`machine/lib/aside-turns.js`: `setEncoding('utf8')` on the child's stdout and stderr; in the openrouter branch, a missing or mismatched header with a non-zero exit or stderr text reports Pi's redacted error and applies the limit rule; only exit 0 keeps `invalid Pi session header`. Tests in `machine/test/aside-turns.test.js`: split multi-byte character, pre-header 429 on stderr (limit true), key redacted, exit-0 missing header. Validation: `bash machine/test/run.sh`.
