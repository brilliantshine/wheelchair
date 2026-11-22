# Remediation 1 — account-switchover

## Gap list (verification attempt 1, verbatim)

From the GPT verifier (`wc-71bee3e28391-verifier-2`), commit 38075feec5206b6483df5f915a7376a87e2e85af:

- GAP: §3 machine step 6 and §4 — A Claude onboarding prompt bypasses the readiness deadline. After 60 seconds, the session was still `starting` and fatal stop had never run — `machine/service.js:1193–1214`, readiness probe
- GAP: §3 hub steps 3–5 — If the machine accepts the switch but the connection drops through all three requests, the hub restores the hold on the old account while the machine runs on the new one. A later matching `ready` releases no carry-on message — `viewer/app/sessions.js:576–591, 663–670`, network-loss probe — **rare path, Accepted Risks (lead's call)**
- GAP: §3 hub step 5 — Explicitly stopping a session leaves `switching` set. A delayed matching `ready` then changes the stopped record to `ready` and queues a carry-on message while `live` remains false — `viewer/app/sessions.js:663–670, 814–829`, stop probe — **rare path, Accepted Risks**
- GAP: Validation — The switch tests use a lead with no starter for the report-suppression case, give Gemini no alternate account, and check quiet predicates without running the reminder sweep. Separate probes passed those behaviors, but the committed tests do not guard them — `viewer/test/app-switch.test.js:23–54, 67–74`, behavior probes

The Claude verifier (`wc-71bee3e28391-verifier`) passed.

## Tasks

- R1 (gap 1): machine — the relaunch deadline is checked before any prompt is answered. Brief: `briefs/R1.md` (scratch); owner `machine/service.js`, `machine/test/switch*.test.js`.
- R2 (gap 4): hub tests — strengthen `viewer/test/app-switch.test.js` for report suppression with a starter, gemini with a second signed-in account, and the real quiet sweep. Brief: `briefs/R2.md` (scratch); owner `viewer/test/app-switch.test.js`.
