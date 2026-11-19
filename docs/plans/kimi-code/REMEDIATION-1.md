# Remediation 1 — Kimi Code support

Verification attempt 1 at `8b5af87`: both verifiers FAIL (`wc-01b8cb1bf051-verifier`, claude-opus-5-5; `wc-01b8cb1bf051-verifier-2`, gpt-6.2-sol).

## Gaps, verbatim

From `wc-01b8cb1bf051-verifier-2` (gpt-6.2-sol):

1. GAP: Existing providers keep working — the synchronous Kimi version check can make the shared machine status request exceed the hub's three-second deadline. An isolated probe with a slow Kimi binary left a signed-in Claude lead waiting, and the existing Claude upload/archive test failed at the missing machine session on both full viewer runs — `machine/service.js:1275,1289`, `viewer/app/usage.js:55`, `viewer/test/app-uploads-archive.test.js:72`.
2. GAP: Kimi permission prompts — the Kimi 2.6.3 terminal renders Bash approvals under `Run this command?` with `Approve once` and `Reject` choices. A pane fixture using those strings returned `false` from `promptText`, so the permission card would never fire. The recorded live run also captured no approval prompt — `machine/adapters/kimi.js:97`, `docs/plans/kimi-code/reports/T6.md:11`.
3. GAP: Recovered Kimi panes — a pane with the Kimi footer and a reply mentioning `Codex` was recovered as Codex with no `end_reason`, bypassing the fatal stop — `machine/service.js:393–398`.
4. GAP: Decision 46 session effort — a Kimi worker request with `xhigh` returned HTTP 400 when the Settings ceiling was `high`. A direct machine start with `medium` also returned and persisted that effort — `viewer/app/sessions.js:158–164,241`, `machine/service.js:147–154,611`.
5. GAP: Exactly-once machine handoff — two `turn.ended` rows for turn 0 in the same read reached `hook()` as `[0,0]`. The poller filters the batch before advancing its watermark — `machine/service.js:722–736`.
6. GAP: Minimum Kimi version — a fake CLI reporting `2.6.3-rc.1` was accepted as eligible even though that prerelease precedes `2.6.3` — `machine/service.js:1289–1292`.
7. GAP: Fatal-stop notification — the starter receives a queued message with the reason, but the required starter card is absent. Only the branch for an ended lead creates a card — `viewer/app/sessions.js:756–768`.
8. GAP: Account status contract — `/v1/status` includes the machine-only `authenticated` flag on Kimi account rows — `machine/service.js:1274–1283`.
9. GAP: Decision 46 live smoke check — the checked-in script still asserts `thinking: low` and `thinking: max` instead of checking that the pinned model appears in the footer — `test-support/smoke/kimi-live.js:55–64`.

From `wc-01b8cb1bf051-verifier` (claude-opus-5-5), duplicates of 2 and 9:

- GAP: Launch — Permission prompts ("`promptText(pane)` detects Kimi's approval prompt… The worker captures the real prompt text from a `--yolo` run that triggers one and records it in the report") — The detector is still a guessed pattern, and no real Kimi approval prompt was ever captured. If Kimi words its approval prompt differently, no permission card is raised and the agent waits with nothing shown. — `machine/adapters/kimi.js:97` matches `/\b(?:tool|command) approval required\b/i` … The only test is a negative case (`machine/test/kimi.test.js:86`).
- GAP: Live checks — check 5 ("A launch on a pinned model shows that model in the footer (Decision 46: no effort)") — The shipped live script still tests the effort design that Decision 46 dropped. … `test-support/smoke/kimi-live.js:55-64` starts workers with `effort: 'low'` and `effort: 'xhigh'`, then asserts `/thinking:\s*low/i` and `/thinking:\s*max/i` on the footer.

## Tasks

| Task | Gaps | Provider (built by) | Files | Order |
|------|------|---------------------|-------|-------|
| R1 | 1, 2, 3, 4 (machine half), 5, 6, 8 | gpt (T1, T3) | `machine/adapters/kimi.js`, `machine/service.js`, `machine/test/kimi*.test.js`, `machine/API.md` | parallel with R2, R4 |
| R2 | 4 (hub half) | claude (T8) | `viewer/app/sessions.js` (`checkEffort` path), its test | parallel; R3 after it |
| R3 | 7 | gpt (T4) | `viewer/app/sessions.js` (`pollDead`), its test | after R2 |
| R4 | 9 | gpt (T6) | `test-support/smoke/kimi-live.js` | parallel |

Each task's brief is in the sub-lead's scratch folder and summarised here:

- **R1.** (1) Never spawn `kimi --version` while answering `/v1/status`: run it asynchronously (with a timeout) at service start and whenever the resolved path or mtime changes; `status()` reads only the cache; with no cached result yet the per-CLI row carries `problem: "Checking Kimi Code's version"` and Kimi accounts are `logged_in: false`; `startNamed` awaits the check. Test: a fake kimi whose `--version` sleeps 3 s does not delay `/v1/status` beyond 1 s, and the existing `viewer/test/app-uploads-archive.test.js` passes repeatedly. (2) `promptText` matches Kimi's approval screen: `Run this command?` together with an `Approve once` option (confirm the strings in Kimi's shipped code if readable; record what was found); unit test with that pane; existing negative cases stay. (3) Recovery: check the Kimi footer first with an anchored line match (a line starting with `Ask When Needed` or `Never Ask` containing `thinking`, plus a `context: <n>%` line), before the agy and Codex markers; tests: Kimi pane whose reply mentions Codex or Antigravity CLI → `kimi` with `end_reason`; Codex, agy and Claude panes unchanged. (4) Machine: a Kimi session stores and launches with `effort: null` whatever the start request says. (5) Within one read, a turn id at or below the last handed-off id (including one handed off earlier in the same batch) is skipped; test with duplicate turn-0 rows. (6) Version floor uses semver precedence: a prerelease of 2.6.3 (`2.6.3-rc.1`) is below the floor; test. (8) `/v1/status` account entries carry no `authenticated` (kept internal for `loginState`); test.
- **R2.** For a provider whose registry `effort` is false, `checkEffort` is skipped (a Kimi worker start with any effort is not refused, and the effort is dropped as today); test with a `high` ceiling and `xhigh` request.
- **R3.** When `pollDead` ends a session with a `started_by` and an `end_reason`, it also adds a system `needs` card titled "Session ended" with body `<session name> ended: <end_reason>. Its starter has been told.`; sessions without `end_reason` are unchanged (no new cards); test.
- **R4.** Check 5 in `test-support/smoke/kimi-live.js` starts a Kimi worker on the light pin with no effort and asserts the footer shows that pinned model (e.g. `K` model name from the pin) and no effort is passed; the effort-based assertions are removed. Run `KIMI_LIVE_CHECKS=5` once live (one short turn) and paste its output.
