# Remediation 3 — Kimi Code support

Verification attempt 3 at `5ffc328`: `wc-01b8cb1bf051-verifier-5` (claude-opus-5-5) PASS; `wc-01b8cb1bf051-verifier-6` (gpt-6.2-sol) FAIL with 3 gaps.

## Gaps, verbatim (from `wc-01b8cb1bf051-verifier-6`)

1. GAP: Permission prompts — Ordinary Kimi output that mentions `Run this command?` and `Approve once` triggers a permission hold. An isolated three-poll probe with the same ready pane created three "Permission needed" cards and left the hold open after every poll — `machine/adapters/kimi.js:104`, `machine/service.js:827–851`.
2. GAP: Fatal-stop notification — If an ordinary Stop confirms the fatal kill before `pollDead` runs, the hub marks the worker stopped and loses the reason and starter notice. An isolated probe ran the machine Stop, hub Stop, and `pollDead` in sequence. The machine retained `end_reason`, while the hub had no reason, no starter message, and no card — `machine/service.js:652–658`, `viewer/app/sessions.js:683–694,723–725,749–762`.
3. GAP: Minimum Kimi version — The version gate still accepts malformed SemVer. An isolated `cliStatus` probe returned `logged_in: true` with no problem for `02.6.3`, `2.6.3+abc..def`, and `2.6.4-01` — `docs/plans/kimi-code/PLAN.md:141–148`, `machine/service.js:1315–1318`.

## Surviving gaps (two fix attempts each)

- **Permission prompt detection:** attempt 1 gap 2 (guessed pattern) → R1; attempt 2 gap 3 (plan-review screen missed) → Q1; attempt 3 gap 1 (ordinary text triggers it). Sent to the lead as a plan defect.
- **Version floor parsing:** attempt 1 gap 6 (`2.6.3-rc.1`) → R1; attempt 2 gap 4 (`2.6.3foo`, `2.6.3.0`) → Q1; attempt 3 gap 3 (`02.6.3`, `2.6.3+abc..def`, `2.6.4-01`). Sent to the lead as a plan defect.

Gap 2 (fatal-stop reason lost when a hub Stop confirms the kill first) has had one fix attempt (R3, a different path) and is remediable, but per the sub-lead rules no remediation proceeds while the surviving gaps are with Collin.
