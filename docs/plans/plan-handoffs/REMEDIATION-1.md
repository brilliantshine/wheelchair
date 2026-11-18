# Remediation 1 — plan-handoffs

Verification attempt 1 (verifier `wc-80b0be8f90fe-verifier`, claude / claude-opus-5-5) at 742d6ad: FAIL, one gap.

## Gaps (verbatim)

GAP: Machine service changes, `status` action ("`pr_state: null` and `pr_error` when gh fails, which blocks a `done` export with "Couldn't check the pull request"") — when `gh` fails, the hub tells Collin the PR is merged or closed, which is wrong. The machine does return `pr_error` (`machine/service.js:1392-1398`), but the hub never reads it: `viewer/app/handoff.js:122` treats any `pr_state !== 'OPEN'` as merged or closed, and `grep -rn "Couldn't check the pull" viewer/` finds nothing. Evidence: I called `exportReason` with a `done` thread and status `{pr_state: null, pr_error: 'gh: not authenticated', …}` and it printed `The pull request is merged or closed; nothing left to hand off`.

## Tasks

### R1-1 — "Couldn't check the pull request"

- Objective: in `exportReason` (`viewer/app/handoff.js:118-131`), when Export is pressed (`pressed`), the stage is `done`, and the status carries `pr_error` or `pr_state` is null, return "Couldn't check the pull request" (not the merged/closed sentence). Keep the merged/closed sentence for a `merged` card or a non-null `pr_state` other than `OPEN`. Place the new check right after the merged/closed check, in the same position of the reasons order.
- Ownership: `viewer/app/handoff.js` (that function only), `viewer/test/app-handoff.test.js`.
- Tests: a `done` thread with status `{pr_state: null, pr_error: 'gh: not authenticated'}` gives "Couldn't check the pull request" from `exportReason(..., {pressed: true})` and from the export route (409 with that sentence, nothing pushed); `pr_state: 'CLOSED'` still gives the merged/closed sentence.
- Validation: `node --test viewer/test/app-handoff.test.js`; `node --test viewer/test/*.test.js`.
