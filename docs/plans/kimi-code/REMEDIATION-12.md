# Remediation 12 — Kimi Code support

Verification attempt 12 at `d8545fa`: `wc-01b8cb1bf051-verifier-23` (claude-opus-5-5) PASS; `wc-01b8cb1bf051-verifier-24` (gpt-6.2-sol) FAIL with 2 gaps.

## Gaps, verbatim (from `wc-01b8cb1bf051-verifier-24`)

1. GAP: Recovered Kimi panes — A ready Kimi pane with thinking off is classified as Claude and left running without an `end_reason`. The installed Kimi renderer omits `thinking` when it is off, but recovery requires that word. In an isolated replay, the pane with `│ >`, `Ask When Needed`, and `context:` stayed ready as Claude. Adding `thinking: high` to the same pane triggered the required fatal stop. — `machine/service.js:402`, `docs/plans/kimi-code/PLAN.md:423`
2. GAP: Account authentication — A directory named `credentials/example.json` counts as a credential file. With a valid global config, a scratch home containing only that directory returned `authenticated: true` and `logged_in: true`, making the account eligible for Ready and placement. The untrusted-config fallback also counted the directory as authentication. — `machine/adapters/kimi.js:52`, `docs/plans/kimi-code/PLAN.md:237`

## Status

Gap 1 is recovered-pane classification again (after R1, W1, K1): sent to the lead. Gap 2 is new.
Gap 2 fixed by F1.
Gap 1 fixed at Collin's choice (Decision 58), commit `569d4fe`.
