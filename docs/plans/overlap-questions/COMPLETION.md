---
slug: overlap-questions
date: 2026-11-21
implemented-by: "T1 standard / gpt-6.1-terra (code); T2 standard / claude-sonnet-5-5 (protocol text); sub-lead claude-opus-5-5 added one test case"
verified-by: []
---

# Completion Report — Asking about overlapping threads

Written for a hostile reviewer: every claim checkable, no claim without evidence.
Mode two-part: Deferred D1-D5 were not built. No Prior Work section, so every row is `this run`.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| Terms: Overlap, This project only, Overlap card, Card window, Before PLAN.md, New overlap, Late overlap, Actionable answer, Settling an answer, Overlap Decision, Done marker | this run | protocol/app/lead.md:726-740 (new `## Overlap questions` section) | `grep -n "overlap card" protocol/app/lead.md` (16 lines) |
| §1 "When to look" (a) right after PLAN.md; every feature look waits for PLAN.md; restart with confirmed IDEA and no PLAN.md creates it first; `session leads` failure follows "hub unavailable"; (b) keeps only timing + pointer | this run | protocol/app/lead.md:717 | read |
| §1 "in one line" instructions replaced (When to look, Overlap `lead: null`, Leads inform, Never wait) | this run | protocol/app/lead.md:717, 718, 720, 721 | Validation grep 2 prints nothing |
| §1 "Leads inform; your user decides" keeps three sentences + new ending | this run | protocol/app/lead.md:720 | read |
| §1 Passing a question on: four peer paths, answered at once, nothing sent back; unrelated questions as today | this run | protocol/app/lead.md:723 (pointer), 742-748 | read |
| §1 Clear chat answer to a waiting question | this run | protocol/app/lead.md:751 | read |
| §1 One question at a time (Open Question `Overlap with <thread id> (<title>): <what>`; waiting card posted as it is) | this run | protocol/app/lead.md:752 | read |
| §1 Card text | this run | protocol/app/lead.md:753 | read |
| §1 Small fix, before edits | this run | protocol/app/lead.md:754 | read |
| §1 Feature, while planning (incl. always-present "Change it: leave <shared area> out ...") | this run | protocol/app/lead.md:755 | read |
| §1 Feature, before PLAN.md is created | this run | protocol/app/lead.md:734 (Terms "Before PLAN.md"), 717 | read |
| §1 Everything later | this run | protocol/app/lead.md:756 | read |
| §1 New information while a card is open | this run | protocol/app/lead.md:757 | read |
| §1 Cancelled or moot question | this run | protocol/app/lead.md:758 | read |
| §2 Restart: act on actionable unmarked answers; open card stays; one `session leads` look by live paths | this run | protocol/app/lead.md:814-817 | grep "overlap card" |
| §3 cards.js: stored id = `delivery_id`, else randomUUID | this run | viewer/app/cards.js:15, :159 | viewer/test/app-questions.test.js:72 |
| §3 cards.js: duplicate (delivered_ids or existing card id) returns `{ok,duplicate,id}` | this run | viewer/app/cards.js:62-63 | viewer/test/app-questions.test.js:72 |
| §3 machine/service.js: spooled 202 carries `id` = delivery id on every spooled path; retract still queued | this run | machine/service.js:2062, 2064, 2069, 2073 | machine/test/service.test.js:266, :1899 |
| §3 `question.about_thread`: optional, 12 lowercase hex, never rendered, refused on other kinds | this run | viewer/app/card.js:94 | viewer/test/app-questions.test.js:86 |
| §3 card.js receipt `{id,kind}`/`{ok}` + `queued` by body `spooled: true`; no other field | this run | viewer/app/card.js:306-309 | viewer/test/card-receipt.test.js:10 (incl. delivered 202 case) |
| §3 lead.md: retract ids come from `card.js` output or restart context | this run | protocol/app/lead.md:51-53, 263, 400 | read |
| §3 Wording: "Other leads on this machine" free of `Decision Log`, `Decision `, `lead-chat` | this run | protocol/app/lead.md:713-724 | viewer/test/protocol-rules.test.js:96 passes |
| §3 Docs: cards.md "Posting a card" output; `about_thread` exception to thread-id rule | this run | protocol/app/cards.md:26, 30-35 | read |
| §3 Docs: cards-lead.md `question.about_thread`, `reach` field text, `retract` id source | this run | protocol/app/cards-lead.md:59, 292, 317 | read |
| §3 Docs: machine/API.md spooled 202 cases and queued `id` | this run | machine/API.md:32 | read |

## Deviations from plan

None in behaviour. Wording choices (logged in PLAN.md Log): overlap definitions sit in a new
`## Overlap questions` section after "Other leads on this machine" (the Spec allows this); the
sentence "an overlap the lead learned earlier is part of that look" is carried by Terms
"Before PLAN.md" rather than stated separately; the restart bullet omits the Spec's "(rare ...)"
aside.

## Routers

None — this change moved no ownership and no router named a file it touched.

## Validation evidence

On tip `a74344f7`:

```
$ node --test viewer/test/*.test.js
# tests 727
# pass 727
# fail 0
viewer-exit 0

$ bash machine/test/run.sh
# pass 448
# fail 0
machine-exit 0

$ grep -n "overlap card" protocol/app/lead.md | wc -l
16        (lines 717-721, 731-758, 815-817: card window, late overlap, restart)

$ grep -n "Your user decides in chat\|tell your user in one line that it exists" protocol/app/lead.md
(no output)
```

Earlier worker runs of the full viewer suite each saw one or two load-dependent failures
(`app-quiet.test.js` 5 and 6; `app-uploads-archive.test.js` stalled upload). Each passed when run
alone (uploads-archive run alone twice on T1's branch: 3/3 pass) and the full suite above is green.

## Known gaps / residual risks

- An agent-supplied `delivery_id` in a card file is passed through and becomes the card id or a
  duplicate (already in Accepted Risks, review-round-17).
- card.js exits with an error if a 2xx machine response body is not JSON (no current path does
  this); a 2xx body without `id` would print a receipt without `id` (no current path does this).
- Machine tests cover the 503 relay and no-hub spooled paths and the drain; the backlog, 502/504
  and no-answer spooled paths share the same code line pattern but have no dedicated test.
- Protocol rules are prose; their effect is only checkable by reading.

## Remediation rounds
