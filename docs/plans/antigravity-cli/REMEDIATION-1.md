# Remediation 1 — antigravity-cli

Verification attempt 1 (verifier `wc-9340ecf1256c-verifier`, gpt-6.1-sol, commit f64fbe7) returned FAIL.

## Gaps, verbatim

> GAP: Phone-only sign-in and runnable sessions — first-run onboarding is unfinished when Settings reports success. `loginDone` accepts the color-choice screen and the service kills the login; startup cannot answer that screen. Evidence: machine/adapters/agy.js:34-35,56; machine/service.js:938-941. Replaying fixtures/agy/login-success.txt produced login state `done`, then session state `stuck` with the initial role message unsent.

## Tasks

### R1-1 — finish `agy`'s first-run screens inside the sign-in session

Brief: `R1-1` below, as given to the worker (also kept outside the repo at the sub-lead's scratch `briefs/R1-1.md`).

- **Objective**: sign-in reports done only once `agy` reaches its idle prompt, with every first-run screen answered in the login session. A later session start then never meets a first-run screen.
- **Evidence path**: `agy` keeps its first-run progress in `~/.gemini/antigravity-cli/jetski_state.pbtxt` (`post_onboarding.completed_steps`: `…MANAGER_WELCOME`, `…USAGE_MODE`, `…AGENT_CONFIGURATION`, `…ADD_WORKSPACE`). A copy of the signed-in config in a scratch HOME, with those steps removed, shows the real screens without a new Google sign-in.
- **Ownership**: `machine/adapters/agy.js`, `machine/service.js` (login path only), `machine/test/` (incl. new fixtures in `machine/test/fixtures/agy/`), `reports/R1-1.md`.
- **Lane**: standard, gpt (the provider that built T4). Attempt 1 sharpens the brief rather than raising the tier.
- **Validation**: `bash machine/test/run.sh`; a replay of every captured first-run screen through `loginState` ends in `done` only at the idle screen.

### R1-1 outcome

Blocked: a copied signed-in HOME with `post_onboarding` removed showed only the trust question, then idle. The first-run screens can't be reproduced without a sign-in. Nothing was built (`reports/R1-1.md`). Not a worker defect: the brief's capture method didn't work. The same lane is kept.

### R1-2 — same objective, capture by a fresh sign-in (Collin chose option A)

- **Objective**: as R1-1. Part 1 captures the screens by signing in once in an empty scratch HOME, with Collin's code through the lead. The scratch HOME, which holds a token, is left in place and reported for Collin to delete.
- **Safety net (lead)**: `loginDone` is true only at the idle prompt, so an unrecognised first-run screen keeps the sign-in waiting rather than reporting done.
- **Ownership, lane, validation**: as R1-1; report `reports/R1-2.md`.
