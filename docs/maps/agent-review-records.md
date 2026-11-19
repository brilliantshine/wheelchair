# Map: review and verification records for agent decks

Checked against: `207c02f5e0b56cfbcc96046cca10a8df92002a9c` (origin/main)
Files covered: `protocol/app/lead.md`, `protocol/app/sub-lead.md`, `protocol/app/reviewer.md`, `protocol/app/verifier.md`, `protocol/app/cards.md`, `protocol/templates/PLAN.md`, `viewer/app/sessions.js`, `viewer/app/cards.js`, `viewer/app/card.js`, `viewer/app/agents.js`

```text
start reviewer/verifier -> last assistant message -> session result card -> starter and Agents report
start round/attempt -> progress pass -> triage or remediation -> round-level count and outcome
```

Fresh reviewers are started per review round, one or two according to settings; the lead posts `review` progress with `pass: N` after starting them and records triaged findings in PLAN's Review Rounds (`protocol/app/lead.md:253-267,277-298`). Its template has a numbered round, lane family/model and finding/verdict/resolution rows, including a lanes line for a clean round; it does not require session names (`protocol/templates/PLAN.md:69-88`). Review `found` excludes declined findings and includes accepted risks and other triaged categories; it is not necessarily the number a particular reviewer raised (`protocol/app/lead.md:300-305`). Dead or blocked reviewers can be restarted within a round, and an interrupted round can restart with fresh reviewers under the same number (`protocol/app/lead.md:277-280,313-319,732-734`).

After build, one or two verifiers start for an attempt and `verify` progress records its number. PASS requires all to pass; FAIL records distinct gaps after deduplication in `REMEDIATION-N.md`, then fixes and starts a fresh attempt. Blocked reports do not start remediation, and lighter-mode deferral can change which gaps are recorded (`protocol/app/sub-lead.md:223-240,243-274`). Thus the remediation file is a record of failed attempt gaps, not a complete per-verifier or successful-attempt ledger.

Progress cards carry stage, pass, phase and sometimes found/fixed; checking and verify clean forbid counts, and review clean may omit them (`protocol/app/cards.md:68-83`; `viewer/app/card.js:198-214`). Cards persist in the thread array, with the prior singleton marked replaced and the newest pinned (`viewer/app/cards.js:9-26`). They describe a whole pass and have no session membership; start calls require a caller-chosen `attempt_id` for retry deduplication, not a shared pass number (`viewer/app/sessions.js:604-622`). Timestamps alone cannot reliably reconstruct membership, particularly when a session starts before the checking card or is restarted.

Per session, the strongest direct source is the internal result card attributed to that session: the hub takes the last assistant message from the event or transcript, stores its full text as summary and delivers it to the starter (`viewer/app/sessions.js:373-397`); Agents exposes the newest such summary (`viewer/app/agents.js:108-110`). Reviewer reports prescribe one severity line per finding or `No findings.`, and may be blocked (`protocol/app/reviewer.md:59-70`); verifier reports prescribe PASS, FAIL with GAP lines, or BLOCKED, with a separate steps-only form (`protocol/app/verifier.md:85-115`). This is raw reported text, not structured per-session counts, adjudication or reliable round membership. `outcome: done` on the generated result means delivery, not verifier PASS (`viewer/app/sessions.js:381-385`). Neither the public node nor start path assigns structured round number, count, first finding or round outcome (`viewer/app/sessions.js:280-297,604-622`; `viewer/app/agents.js:71-77,106-110`).

## What I did not look at

Individual historical plan or remediation files, transcript retention and every exceptional review workflow. These protocol records are prescribed sources, not proof that every historical run followed them. This focused map replaces overlapping claims in the older review-progress map only for these flows.
