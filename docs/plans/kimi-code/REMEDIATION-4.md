# Remediation 4 — Kimi Code support

Verification attempt 4 at `c29a95b`: `wc-01b8cb1bf051-verifier-7` (claude-opus-5-5) PASS; `wc-01b8cb1bf051-verifier-8` (gpt-6.2-sol) FAIL with 3 gaps.

## Gaps, verbatim (from `wc-01b8cb1bf051-verifier-8`)

1. GAP: Permission detection under Decision 48 — A title and choice in separate blocks of ordinary output can trigger a permission hold. An isolated readiness poll paired `Run this command?` from one block with `Approve once` from another, set `prompt_open`, and emitted `permission_prompt` — `machine/adapters/kimi.js:104–114`, `machine/service.js:832–835`.
2. GAP: Fatal-stop notification — Retrying Stop after a confirmed fatal stop sends the starter the same message and card again. Two Stop requests through the hub and machine handlers produced two starter messages and two `Session ended` cards — `machine/service.js:652–658`, `viewer/app/sessions.js:683–697`.
3. GAP: Settings account diagnostics — A named Kimi account with no home yet on a machine shows `signed out` even when the machine reports a version-floor problem. An isolated hub probe with Kimi 2.6.2 showed the version problem on the default account and `signed_out` on the newly added account — `viewer/app/usage.js:59–67`, `viewer/app/usage.js:109`.

## Surviving gaps

- **Permission-prompt detection:** fixed in R1, Q1 and A1 (Collin's Decision 48); fails again. Sent to the lead.
- **Fatal-stop notification:** fixed in R3 and P1; fails again (duplicate notice on a retried Stop). Sent to the lead.

Gap 3 is new. Per the sub-lead rules, work stops while the surviving gaps are with Collin.

**Gap 1 settled by the plan (Collin, Decision 50):** live with it; Accepted Risk added. Gap 3 fixed by C1.
Gap 2 fixed by B1 (Decision 51).
