# Remediation 1: stub-dedupe

Verification attempt 1 on a808c9af19db5957984861a20a01b46b5acca4d4. The Claude verifier passed; the GPT verifier failed with one gap.

## Gaps (verbatim)

GAP: Spec 2, `stub.duplicate` — A fresh duplicate note returns HTTP 200, the same status as a delivery replay, although the card API promises 202 for newly accepted cards — `viewer/app/routes.js:461` uses the stored card's `duplicate` field to choose the replay status. The fresh note and its replay both returned 200 in an isolated hub check. The contract is at `viewer/app/API.md:40`.

Judged normal use (every duplicate note hits it), hardening. The lead answered: fix it. acceptCard should return the replay flag separately, with a test, then re-verify.

## Tasks

### R1-1: replay flag separate from the card's `duplicate` field
- Objective: a new duplicate note gets 202 and a replayed delivery still gets 200, with response bodies unchanged. acceptCard marks a replay with a non-enumerable `REPLAY` symbol exported from cards.js, and routes.js:461 reads that instead of `.duplicate`.
- Ownership: viewer/app/cards.js, viewer/app/routes.js, viewer/test/app-hub.test.js.
- Lane: standard, gpt (same provider that built T1).
- Validation: the focused node --test list in the brief, then `cd viewer && npm test`.
