# Remediation 2 — Kimi Code support

Verification attempt 2 at `de31e26`: `wc-01b8cb1bf051-verifier-3` (claude-opus-5-5) PASS; `wc-01b8cb1bf051-verifier-4` (gpt-6.2-sol) FAIL with 5 gaps.

## Gaps, verbatim (from `wc-01b8cb1bf051-verifier-4`)

1. GAP: Exactly-once turn handoff — If the spool drains after the poller breaks out of the batch, the poller saves the offset past an unhandled turn. In an isolated two-turn reproduction, only turn 0 reached `hook()` and the offset advanced to EOF. A second tick still missed turn 1 — `machine/service.js:725–741`.
2. GAP: Rate-limit notification — A Kimi worker's `limit-hit` ends the turn and records the cooldown, but the starter gets no notice. A hub probe with `[provider.rate_limit] too many requests` left the starter's queue empty — `viewer/app/sessions.js:522–545`, `docs/plans/kimi-code/PLAN.md:106`.
3. GAP: Permission prompts — The Bash approval fixture passes, but Kimi's shipped plan-review prompt, `Ready to build with this plan?` with `Approve`, returns `false` from `promptText`. The pane scraper therefore raises no permission card for it — `machine/adapters/kimi.js:97`, `machine/service.js:831–834`, `docs/plans/kimi-code/reports/R1.md:6`.
4. GAP: Minimum Kimi version — `2.6.3-rc.1` is now correctly rejected, but a fake CLI reporting `kimi 2.6.3foo` or `kimi 2.6.3.0` was still marked eligible. The regex accepts a version substring without validating the full token — `machine/service.js:1313–1315`.
5. GAP: Log protocol guard — A fixture with `min_protocol_version: "1.5.1"` bound successfully even though the Spec caps it at `1.5`. A malformed `"1.bad"` also bound — `machine/adapters/kimi.js:63–67`.

## Tasks

| Task | Gaps | Provider (built by) | Files |
|------|------|---------------------|-------|
| Q1 | 1, 3, 4, 5 | gpt (T1, T3, R1) | `machine/adapters/kimi.js`, `machine/service.js`, `machine/test/kimi*.test.js` |
| — | 2 | — | Plan question sent to the lead: the hub's `limit-hit` handling is shared and unchanged for every CLI (cooldown recorded, session sent "Continue." later; only `turn-failed` messages the starter), and IDEA.md rules out changing how the other CLIs work. Awaiting the answer. |

Q1 summary: (1) advance `kimi_offset` only when every turn in the batch was handed off; if the loop stopped early for the spool gate, keep the old offset (`kimi_last_turn` already prevents re-sending); test: spool drains between the break and the offset save → turn 1 is still handed off on the next tick. (3) `promptText` also matches the plan-review screen: `Ready to build with this plan?` together with an `Approve` choice line; tests with that pane and with ordinary text. (4) The version must be a whole token: the output's version word must match `^v?(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$` (after an optional leading `kimi`/`Kimi Code` name); `2.6.3foo`, `2.6.3.0` fail; tests. (5) `protocol_version` and `min_protocol_version` must each be dotted non-negative integers; compatible means major of `protocol_version` is 1 and `min_protocol_version` (when present) compares ≤ `1.5` component-wise (`1.5.1` > `1.5`); malformed values are incompatible (and stop the session only when the file carries this session's marker, as today); tests for `1.5.1`, `1.bad`, `1.5`, `1.4.9`.
