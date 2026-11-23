# Remediation 1 — overlap-questions

Verification attempt 1 on 3c0b7556: Claude verifier PASS; GPT verifier FAIL. Gaps verbatim (GPT verifier):

- GAP: §1 First overlap look — The lead protocol schedules the first look after PLAN.md is created but omits the instruction to include overlaps learned earlier. A lead can miss an overlap from chat or a peer message when the peer list does not show the shared work — `docs/plans/overlap-questions/PLAN.md:175`, `protocol/app/lead.md:717`, `protocol/app/lead.md:734`.
- GAP: §1 Cancelled or moot question and §2 Restart — When a follow-up is still waiting, the cancellation rule does not tell the lead to put the original card's ID in the Done marker. Without that suffix, a restart can replay the original vague answer and ask the cancelled question again — `docs/plans/overlap-questions/PLAN.md:248`, `protocol/app/lead.md:758`, `protocol/app/lead.md:815`.
- GAP: §3 Machine API documentation — The route contract promises a queued `202` for outage and backlog cases without naming the `done` exception. The machine returns `503` in those cases for `done`, which is never queued — `machine/API.md:32`, `machine/service.js:2051`, `protocol/app/cards-lead.md:135`.
- GAP: Validation — full viewer suite failed under load. Judged not a gap (lead agreed): pre-existing load flakiness in files this build did not touch; `server.test.js:599` race fails 1 in 6 on base d5e5d1e7.

Lead's answer: fix gaps 1-3 in one remediation task; gap 4 noted, not remediated.

## R1 — three one-sentence text fixes (Light, claude, the provider that built these files)

Brief: see the worker brief R1 (exact text in it). Files: protocol/app/lead.md (lines 717 and 758), machine/API.md (line 32).
