# Remediation 9 — Kimi Code support

Verification attempt 9 at `697d145`: `wc-01b8cb1bf051-verifier-17` (claude-opus-5-5) PASS; `wc-01b8cb1bf051-verifier-18` (gpt-6.2-sol) FAIL with 2 gaps.

## Gaps, verbatim (from `wc-01b8cb1bf051-verifier-18`)

1. GAP: Minimum Kimi version at launch — An isolated start checked `2.6.3`, then launched `2.6.2` after the executable was replaced during worktree creation. The adapter resolves the executable again after the version check. — `machine/service.js:592`, `machine/adapters/kimi.js:112`.
2. GAP: Recovered Kimi panes — When the session record is missing, recovery classifies a Kimi pane at folder trust as a ready Claude session and leaves it running. Replaying the recorded Kimi trust screen produced `cli: 'claude'`, no `end_reason`, and zero kill calls. — `machine/service.js:399`, `docs/plans/kimi-code/reports/T6.md:655`.

## Status

Gap 2 (recovered-pane classification) has survived R1 and W1: sent to the lead for Collin. Gap 1 is a new aspect of the version floor (a binary swapped between the check and the launch); sent to the lead with it.

**Resolutions:** gap 1 fixed by V1; gap 2 by K1 (Decision 54).
