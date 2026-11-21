---
slug: overlap-questions
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-20
---

# Asking about overlapping threads

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

Background: split from lead-chat (`docs/plans/lead-chat/PLAN.md` on main, Decisions 19-24,
Review Rounds 4-6). Map: `MAP.md`, `docs/maps/overlap-decision-flow.md`.

## Open Questions

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode: thorough | User's pick | user |
| 2 | Every new overlap becomes a `question` card; the one-line mention in a reply is no longer the way to raise it | IDEA.md "What good looks like" bullet 1 | defaulted |
| 3 | An overlap learned before IDEA.md is confirmed is held and asked as the first question after confirmation; a restarted lead finds it again by looking at other leads once on restart | IDEA.md bullet 2; no plan file exists yet to hold it | defaulted |
| 4 | A change answered during a running review is logged at once as `Pending change: <card id>`, applied after triage, marked `Applied change: <card id>`, and listed in the next round's "Changed since"; a round with a pending change is not clean and counts it as one found item | Mirrors the existing `Pending pull-back:` rule; gives a zero-finding round a `fixing` state | defaulted |
| 5 | During a build, the answer acts at once without writing to the worktree (a follow-up `stub` card, or nothing); the running build never changes | The sub-lead owns the worktree; a stub card is itself durable, so nothing is pending | defaulted |
| 6 | The machine's delivery id becomes the card's id, so `card.js` can print the id even when the card is queued while the app is offline | The machine already gives every card a random UUID delivery id before queuing (`machine/service.js:1323`, `:2055`); no second round trip | defaulted |
| 7 | `card.js` prints `{"id","kind"}` (plus `"queued":true` when queued) for kinds that make a stored card, and `{"ok":true}` for `title`, `resolve`, `retract`; never card text | Settled in lead-chat round 4-5 | defaulted |
| 8 | During a build the overlap card offers no way to stop it: "Let it finish" or "Let it finish, then start a follow-up thread"; to stop, the user archives the thread | User's pick (card 84bc0114); archiving already stops every session with a confirmation | user |
| 9 | Supersedes 4: an overlap card during review is that round's `user-decision`; its stored answer (not a Log line) holds it until triage folds it in | Simpler; reuses the user-decision rules and gives zero-finding rounds a `fixing` state | review-round-1 |
| 10 | Overlap identity is the other thread's id, in a hidden `about_thread` field on the question card; each action leaves a Done marker naming the card id | Titles are not unique; a restart must not act twice | review-round-1 |
| 11 | At Start building, open overlap cards are retracted and reposted with build options; late pre-build answers map to build answers | A pressed "Change it" must still mean something | review-round-1 |
| 12 | A retract is relayed like `done`, never queued; supersedes the fallback in 6: the delivery id is always the card id | A queued retract could fail silently after Start building; a fallback id broke receipts | review-round-1 |
| 13 | A retract of an approval that Start building already answered is refused with its own reason; a change with no open approval just returns the plan to review | The lead must know whether Start won | review-round-2 |
| 14 | Before acting on any overlap answer, the lead checks its Done marker; restart also recovers chat answers from recent messages and finishes an interrupted Start building replacement | Replayed presses and restarts must not act twice or leave the user waiting | review-round-2 |
| 15 | An overlap card belongs to the round it is posted in, or moves to the next round if that starts first; a small fix after its first push uses the Done options on purpose | Names the owning round; the user can close a pushed pull request | review-round-2 |
| 16 | Threads at stage `done` are not overlaps for a card; answers are read against their own card's options; a follow-up card completes the original; the Drop revert is one marked commit | Round 3 findings | review-round-3 |
| 17 | Restart: an untriaged round restarts under the same number; a sub-lead is restarted only while the build is unfinished; retracted cards without a successor are reposted | Round 3 findings | review-round-3 |
| 18 | Supersedes 5, 8, 11 and the build/done/small-fix-after-edits parts of 15-17: overlap cards are asked only before building (before a small fix's edits, planning, review, approval). Once a build has started or a small fix's edits are made, the lead mentions the overlap in one line and offers a follow-up thread. IDEA.md "What good looks like" bullet 2 changed to match | Review rounds 1-3 kept finding corners in the build, Start building hand-off and undo cases, where the answer cannot change the work; the user picked "Only before building" (card 73943c05) | idea-change |
| 19 | Also supersedes Decision 2 for late overlaps and done threads (a one-line mention). An overlap card after approval first withdraws the approval, so no overlap card is ever open at Start building; the Start building retract step is removed | Closes the Start-building race by ordering, with no hub lock | review-round-4 |
| 20 | Restart review recovery is gated on `ready-for-review` and a pinned `checking` progress card; a retracted card gets its own refusal `card was already withdrawn` | Round 4 findings | review-round-4 |
| 21 | In `approved`, an overlap is written to the Watch List and the approval withdrawn as soon as it is learned; no approval card is posted (also on restart) while one is open; a change's Decision, Spec and status are one commit | Round 5 findings | review-round-5 |
| 22 | A pushed small fix (`no plan` with a `pr_url`) counts as finished; overlap cards need one to three change options; restart review recovery also checks live reviewers | Round 5 findings | review-round-5 |
| 23 | Overlap Watch List items stay until their Decision is logged; a bare general "Change it" gets a follow-up card; the approval retract is skipped when none was posted | Round 6 findings | review-round-6 |
| 24 | After the review budget was reached again (rounds 4-6), run another review round with the plan as it is | User's pick (card 4bcb64a3) | user |

## Spec

### Terms

- **Overlap:** another thread (from `wc.js session leads`, a peer lead's message, or the user)
  whose work touches the same files or behaviour as this thread's, and whose `stage` is not
  `done`, and is not a small fix whose `done` card is posted (`stage` `no plan` with a `pr_url`,
  which the peer list takes from that card). A finished
  thread's overlap is mentioned in one line of the reply, not asked. Its identity is the other
  thread's id (`thread` in `session leads`), never its title.
- **Overlap card:** a `question` card carrying the new optional field `about_thread` (§3), the
  other thread's id. The app stores it and never shows it.
- **New overlap:** one whose thread id is not the `about_thread` of any overlap card in this
  thread (open, answered, or retracted and replaced by a later card with the same
  `about_thread`), and not in a Decision Log entry of this plan. An overlap already asked is
  asked again only when new information changes what the answered option would do; then it is
  posted as a fresh overlap card with the same `about_thread`.
- **Actionable answer** of an overlap card, in this order: `answered_value` when
  `answered_action` is `picked` or `answered` (a press or the card's own box); else
  `resolved_note` when the lead resolved it from a chat answer; else, on restart only, a chat
  answer to it in `recent_messages` sent after the card was posted, handled by "Settling an
  answer" (then resolve the card with a note of it). A card with `retracted_at` has no answer.
  An answer is read against the options of its own card.
- **Settling an answer:** an answer that clearly picks one of the card's options is acted on.
  One that does not (an objection, a condition, something else) gets a follow-up overlap card
  for the same thread with the current stage's options, and no Done marker until that one is
  settled. A bare pick of a general "Change it" is not settled: it gets a follow-up overlap card
  asking what to change. The original card counts as handled once a later overlap card with the same
  `about_thread` exists. In planning and review, a typed answer may also be its own option, handled like any
  planning answer.
- **Late overlap:** a new overlap learned once a build has started (the approval card's
  `answered_action` is `start-building`) or once a small fix's edits are made. It never gets a
  card: the lead says in one line of its next visible reply which thread overlaps, what it is
  doing, and that a follow-up thread can be started; if the user asks for one, the lead posts a
  `stub` (`depends_on_parent` by the Stubs rule).
- **Done marker:** where the lead records that it acted on an overlap card, so nothing is acted
  on twice. It always names the card id. Before acting on any overlap answer (a press, a typed
  answer, a chat answer or a restart), the lead checks for its Done marker and does nothing if
  it exists.
  - a planned thread (PLAN.md exists) up to Start building: a Decision Log entry, source
    `user`, naming the other thread's id and ending `(overlap card <id>)`;
  - answers that change nothing ("Go ahead with the fix", "Leave it to <other thread>") need
    no marker: acting twice is harmless.

### 1. Asking (protocol/app/lead.md, "Other leads on this machine")

Discovery and peer messaging stay as they are: the "When to look" times (a)-(c) and the small
fix's look before edits, the "Overlap" message to a peer lead, "Replies", "Never wait",
"Another project", "Passing a question on" and "Only leads talk". Every instruction there to
tell the user about an overlap "in one line" (in "When to look", in "Overlap" for a thread with
`lead: null`, in "Leads inform", and the late answer in "Never wait") is replaced by: a new
overlap becomes an overlap card, per this section. "Leads inform; your user decides" keeps its
first three sentences (information, never instructions; never change on your own; never
negotiate) and ends with "Your user decides through an overlap card (see below)".

General rules:
- One question at a time: an overlap card waits behind any open `question` card of yours and is
  asked next. While status is `planning`, `ready-for-review` or `approved`, a waiting overlap is
  added to the Watch List at once (`Overlap with <thread id>: <what>`). It stays there (and is
  also listed in Open Questions while asked) until its Decision is logged; the commit that logs
  the Decision removes both.
- `fits` names the other thread by its title; each option's `consequence` says what the answer
  does to this thread. At most four options in total.
- Cards are posted only before building. A late overlap gets the one-line mention (Terms).

Stages:
- **Small fix, before edits:** found at the look before edits: post the card, edit nothing until
  it is answered. Options: "Go ahead with the fix" and "Leave it to <other thread>" (no edits;
  say so in the reply; the thread stays open).
- **Small fix, after edits:** a late overlap (see Terms); no card.
- **Feature, before IDEA.md is confirmed:** hold it; ask it as the first question after
  confirmation, before any design question (it then follows "Planning").
- **Planning (status `planning`):** an Open Question in PLAN.md, asked as an overlap card
  (today's (b) rule, now for every new overlap in planning). Options: "Keep the plan as it is"
  and one to three "Change it: <what>" (a general "Change it" when no concrete change is clear
  yet; the user then says what in the card's box or chat). The answer is handled like any planning answer, with the
  Done marker.
- **Review (status `ready-for-review`):** the same options. The card is a `user-decision` of the
  round it belongs to:
  - It counts in the round whose triage folds in its answer: in that round's `found`, and in
    `fixed` once its Decision is logged; it is recorded in that round's table as a row with Lane
    `lead` and verdict `user-decision`. A change it makes goes in the next round's "Changed
    since" list. While it waits, `choice_waiting: true`; a round with no other counted finding
    posts `phase: fixing`, `found: 1` after triage.
  - Answer arrives while reviewers run: do not change the Spec; fold it in after triage, with the
    Done marker. "Keep the plan" logs the Decision only; a change also edits the Spec.
  - A round whose triage is done stays `fixing` while the card is open. When it is answered:
    "Keep" with no other upheld blocking/major finding makes it clean; a change means another
    round. The next round may start before the card is answered when the current round already
    has other Spec fixes; the card then counts in the round whose triage folds it in.
  - Posted after round N was found clean and before approval: as during round N (it makes N not
    clean until answered).
- **Approved (status `approved`, before Start building):** as soon as a new overlap is learned
  (whether its card can be posted now or must wait behind another question), add it to the
  Watch List and commit, then withdraw the approval: retract the last approval card this
  thread's leads posted (§3: a retract is never queued, so its result is final); if no approval
  card has been posted yet (for example, the Ready check or an app update is still pending),
  skip the retract. Status stays
  `approved`, as in the existing "talk instead of building" rule. If the refusal is `Start
  building was already pressed`, this is a late overlap: mark the Watch List item `late` and post
  no card. If it is `card was already withdrawn`, carry on. On 503, retry after a minute. Then
  post the card when its turn comes, options as in Review. While any overlap Watch List item or
  overlap card is open in this stage, post no approval card. "Keep the plan as it is": log the
  Decision with the Done marker and commit, then post a fresh approval card with a fresh Ready
  check once nothing else is open. A change: write the Decision (Done marker), the Spec change
  and `status: ready-for-review` and commit them in one commit, then go to step 5 with the
  change listed.
- **Start building:** unchanged. No overlap card is open then: a round with one is not clean, and
  one posted after approval withdraws the approval first. Cards from then on follow "Late
  overlap" (Terms).

### 2. Restart (protocol/app/lead.md, "Restarting what died")

On `[wc:context restart]`, after rereading the plan and cards:
- If `status:` is `ready-for-review` and either the pinned progress card is review `phase:
  checking` or `session list` shows a live reviewer (an interrupted launch), handle it as for pending pull-backs today: stop any live reviewers,
  discard their reports, apply every overlap answer that has no Done marker (with its marker),
  and restart the round under the same number, listing the change in its "Changed since".
- Otherwise, for each overlap card with an actionable answer and no Done marker (search the
  Decision Log): act on it now, at the current stage's rules. (Safety net that should not
  occur after Decisions 19 and 21: once the approval card's `answered_action` is
  `start-building`, such an answer is a late overlap: the one-line mention, no change to the
  build.)
- An open overlap card stays open and is not asked again.
- With `status: approved` and the approval card's `answered_action` not `start-building`: if an overlap Watch List item (not
  marked `late`) or an overlap card is open, finish §1 Approved (withdraw the approval if still
  open, post the waiting card) and post no approval card, overriding the restart rules that
  would repost one; otherwise those rules apply as today.
- Run `wc.js session leads` once and treat any overlap not covered by an overlap card or a
  Decision Log entry as new (a late overlap after Start building). Repeating a late overlap's
  one-line mention after a restart is accepted as harmless. A planned thread before Start building also asks any `Overlap with`
  Watch List item not yet asked.

### 3. Card ids and retract (machine, hub, card.js)

- `viewer/app/cards.js` `acceptCard`/`addCard`: a stored card's `id` is the payload's
  `delivery_id` when present (the machine always sets one: `crypto.randomUUID()` or the spool
  file's UUID, `machine/service.js:1323`, `:1330`, `:2055`); otherwise `crypto.randomUUID()`
  as today (app-made cards). A delivery whose id is already in `delivered_ids` or is already a
  card id in this thread returns `{ ok: true, duplicate: true, id: <delivery_id> }`. So the id
  printed when a card is queued is the id it gets.
- `machine/service.js` card post: unchanged spooling. The 202 spooled response becomes
  `{ ok: true, spooled: true, id: <delivery_id> }`.
- `retract` is never queued: the machine relays it like `done` (no spool; 503 "the app is
  unreachable; the retract was not recorded; try again in a minute" when the spool is behind or
  the hub is unreachable). Its success and refusals come straight from the hub.
- `viewer/app/card.js` `retractable`, before the generic `card is already answered`: an approval
  card whose `answered_action` is `start-building` is refused with `Start building was already
  pressed`; a card with `retracted_at` is refused with `card was already withdrawn`.
- `question` cards accept an optional `about_thread`: a string of 12 lowercase hex characters.
  Stored on the card, never rendered.
- `viewer/app/card.js` on success prints exactly one JSON line: `{"id":"<id>","kind":"<kind>"}`
  for kinds that create a stored card, with `"queued":true` added when the machine spooled it;
  `{"ok":true}` for `title`, `resolve`, `retract`. Never any other field of the card.
- Docs: `protocol/app/cards.md` "Posting a card" documents the output and names the
  exceptions to "succeeds once the card is on disk, even if the app is down" (`done` and
  `retract` are never queued), and its rule that cards never carry a thread id names
  `question.about_thread` as an exception alongside `reach`. `cards-lead.md`: `question` table
  gains `about_thread`; `retract` says the id comes from `card.js`'s output or the restart
  context, that it is never queued, and lists the two new refusals in its refusal order.

### Non-goals

No change to how leads list or message each other; no lead-to-lead negotiation; no automatic
merging of branches; no sub-lead or worker rule changes.

### Validation

- `node --test viewer/test/*.test.js` passes, with new tests: a card's id equals its
  `delivery_id`; a re-delivery returns the same id with `duplicate: true`; `about_thread` is
  accepted on `question` (12 hex) and refused otherwise or on other kinds; `card.js` prints
  `{id,kind}`, `{id,kind,queued}` and `{ok}`, and never a text field; retracting an approval
  answered with Start building is refused with `Start building was already pressed`, and
  retracting a withdrawn card with `card was already withdrawn`.
- `bash machine/test/run.sh` passes, with tests: the spooled response carries `id` equal to the
  delivery id and the drained card's hub id equals it; a retract with the hub down returns 503
  and writes nothing to the spool.
- `grep -n "overlap card" protocol/app/lead.md` shows the stage and restart rules;
  `grep -n "Your user decides in chat\|tell your user in one line that it exists" protocol/app/lead.md`
  finds nothing (the replaced instructions are gone; the late-overlap and done-thread one-line
  mentions are allowed).

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| An overlap learned from a peer message before PLAN.md exists, still waiting to be asked, is lost if the lead also restarts before asking, and the peer's summary in `session leads` does not reveal it | Needs a restart inside a short window plus a peer summary that hides the overlap; the restart re-look covers the usual case | review-round-1 |
| A retract saved by the hub whose reply is lost in a network drop returns 503; the retry then gets `card was already withdrawn`, which the lead treats as success | Handled by the distinct refusal; listed so later rounds don't re-raise | review-round-4 |
| A lead that dies while launching round N+1's reviewers may restart the round under the pinned pass N | Needs a death within the seconds of a launch; a misnumbered round is cosmetic | review-round-6 |
| A replacement lead re-posts an overlap card or stub that the dead lead's post still has queued on the machine (the app was down), making a duplicate | Needs a lead death during an app outage right after posting; a duplicate card is visible and harmless | review-round-2 |
| A restart in the middle of a multi-commit "Drop the fix" leaves some fix commits unreverted with no completion rule | Needs a crash within the seconds a few reverts take; moot since Decision 18 removed Drop the fix | review-round-2 |

## Review Rounds

### Round 7 — 2026-11-21

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 6:** Decision 23: Terms "Overlap" cutoff is the peer's done card; "Settling an answer" treats a bare general "Change it" as unsettled; §1 General rules keep the Watch List item until its Decision; §1 Approved skips the retract when no approval was posted; §2 uses the approval's `answered_action` and marks the late-answer clause a safety net; one Accepted Risk.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

### Round 6 — 2026-11-21

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 5:** Decisions 21-22: Terms "Overlap" excludes pushed small fixes; §1 Planning needs one to three change options; §1 Approved rewritten (Watch List and withdraw at once, no approval while open, one-commit change); §2 recovery also checks live reviewers, leftover repost rule removed, new approved-stage restart bullet.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | "No Start building recorded" is ambiguous in thorough mode | upheld | Uses the approval's `answered_action` |
| intent | minor | Restart clause describes an impossible path | upheld | Marked as a safety net |
| mechanics | major | Pushed small fix before its done card still gets a card | declined | Until `done` the other fix is unfinished, so asking is fair; Terms now say the cutoff is its done card |
| mechanics | major | Approved with no approval card posted yet | downgraded (minor) | Retract skipped (Decision 23) |
| mechanics | major | Watch List item moved to Open Questions is missed on restart | upheld | Item stays until its Decision (Decision 23) |
| mechanics | major | Bare "Change it" press has nothing to apply | upheld | Follow-up card (Decision 23) |
| mechanics | minor | Round number source when dying mid-launch | accepted-risk | Rare path; Accepted Risks |

### Round 5 — 2026-11-21

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 4:** Decisions 19-20: §1 Approved now withdraws the approval before posting an overlap card and reposts it after "Keep"; §1 Start building unchanged (retract step and "Answers after Start building" removed); General rules leftover removed; §2 review recovery gated on status and pinned progress, sub-lead/Start building bullet removed, late-overlap repeat accepted; §3 new `card was already withdrawn` refusal; Validation grep rewritten; one Accepted Risk.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Restart reposts approval while an overlap card is open | upheld | §2 posts no approval while one is open (Decision 21) |
| intent | minor | Leftover repost-retracted-card rule | upheld | Removed |
| intent | minor | Waiting overlap leaves the approval live | upheld | Approval withdrawn when the overlap is learned (Decision 21) |
| mechanics | blocking | Restart restores approval while an overlap question is open | downgraded (major) | Same fix as intent's (Decision 21) |
| mechanics | blocking | Done marker saved before the change | downgraded (major) | One commit (Decision 21) |
| mechanics | major | Lead dies during reviewer launch | upheld | Also checks live reviewers (Decision 22) |
| mechanics | major | Finished small fix shows `no plan` | downgraded (minor) | A stray card, not a wrong build; `no plan` + `pr_url` counts as finished |
| mechanics | minor | Zero change options fails validation | upheld | One to three change options |

### Round 4 — 2026-11-21

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 3:** Round 3 fixes (Decisions 16-17), then Decision 18 (user, after the review budget): cards only before building. IDEA.md bullet 2 changed. Terms: new "Late overlap", Done marker list shortened; §1 Small fix after edits is a late overlap, Approved's Start-won outcome, Start building now retracts open overlap cards, new "Answers after Start building", no Building/Done stage cards; §2 Restart retracts instead of replacing.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Validation grep contradicts the late-overlap one-line rule | upheld | Grep targets the replaced wording |
| intent | minor | Simpler: withdraw approval when posting an overlap card | upheld | Adopted (Decision 19) |
| intent | minor | Late overlap line repeats after restarts | upheld | Accepted as harmless, stated in §2 |
| intent | minor | Decision 18 does not supersede 2 | upheld | Decision 19 |
| intent | minor | Leftover build-stage sentence | upheld | Removed |
| mechanics | blocking | Restart misreads a clean zero-finding round as interrupted | downgraded (major) | Gated on status and pinned `checking` progress (Decision 20) |
| mechanics | blocking | Start sequence order vs Build accepted | downgraded (major) | Start building step removed; existing sequence unchanged (Decision 19) |
| mechanics | blocking | Overlap card posted while Start press is queued | downgraded (major) | Approval retracted before the card; refusal means late overlap (Decision 19) |
| mechanics | major | Change before the first approval card | declined | No overlap card can be open then: the round could not be clean with one (§1 Review) |
| mechanics | major | Retract saved, reply lost | downgraded (minor) | Distinct `card was already withdrawn` refusal (Decision 20) |

### Round 3 — 2026-11-20

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 2:** Terms: "New overlap" re-ask rule, "Actionable answer" adds restart chat recovery, new "Settling an answer", Done marker names the thread id and is checked before every action; §1 Watch List limited to pre-build statuses, Small fix drop identifies fix commits and the after-push narrowing is stated, Review ownership of rounds rewritten, Approved retract outcomes, Start building order and replacement; §2 Restart rewritten (reviewers running, Start building resume); §3 new retract refusal and Docs bullet; Decisions 13-15; two Accepted Risks.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Card moving between rounds lands in the wrong "Changed since" | upheld | One ownership rule: the round whose triage folds it in |
| intent | minor | How the card is recorded in the table | upheld | Lane `lead`, verdict `user-decision` |
| intent | minor | Done threads would raise cards | upheld | Stage `done` excluded (Decision 16) |
| intent | minor | Done-stage stub forces `depends_on_parent` | upheld | Set by the Stubs rule |
| intent | minor | "As today" sub-lead restart is not explicit | upheld | Stated (Decision 17) |
| mechanics | blocking | Change pressed before Start, handled after | downgraded (major) | Always retract the last approval; any unmarked pre-build answer maps once Start won |
| mechanics | major | Card retracted at Start then lead dies | upheld | Reposted on restart (Decision 17) |
| mechanics | blocking | Restart starts a sub-lead after the build finished | downgraded (major) | Only while status is unfinished (Decision 17) |
| mechanics | major | Objection follow-up repeats on restart | upheld | Later card for the same thread completes it |
| mechanics | major | Chat-proposed option lost on restart | upheld | Recovered via "Settling an answer" |
| mechanics | major | Answer read against the wrong stage | upheld | Read against its own card's options |
| mechanics | major | Reports received but untriaged at restart | upheld | Round restarts under the same number |
| mechanics | major | Revert message lacks the marker | upheld | `--no-commit` reverts then one marked commit |

### Round 2 — 2026-11-20

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 1:** Terms rewritten (thread-id identity, `about_thread`, actionable answer, Done markers); §1 lists the replaced one-line instructions, adds Small fix after edits/after push, Review as user-decision with progress rules, Approved retract handling, new Start building rule; §2 Restart rewritten around Done markers; §3 delivery id always the card id, retract never queued, `about_thread`; Validation updated; Decisions 9-12; one Accepted Risk.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Watch List write during a build | upheld | Watch List only while `planning`/`ready-for-review`/`approved` |
| intent | major | Restart "reviewers running" contradicts the pull-back restart rule | upheld | §2 reuses it: stop, apply, restart the round |
| intent | minor | Waiting between rounds stalls review | upheld | Next round may start; card moves to it (Decision 15) |
| intent | minor | Two retract refusals cannot be told apart | upheld | Own refusal for Start building (Decision 13) |
| intent | minor | Decision entry may lack the thread id | upheld | Done marker names the thread id |
| intent | minor | Re-asking an already-asked thread undefined | upheld | Re-asked only if it changes what the answer would do |
| intent | minor | Small fix after push cannot drop | declined | Intentional: the user can close the pull request; recorded in §1 |
| mechanics | blocking | Withdrawn vs started approval look the same | downgraded (major) | A worker would ask; Decision 13 |
| mechanics | major | Start building replacement not resumable | upheld | §1 order (sub-lead first) and §2 finishes it |
| mechanics | major | Spooled duplicate post after restart; replayed press | upheld (press) / accepted-risk (spool) | Done marker checked before every action; spool case is a rare path |
| mechanics | major | Chat answer lost if the lead dies before resolving | upheld | Recovered from recent messages (Terms) |
| mechanics | major | Multi-commit drop not resumable | upheld (identification) / accepted-risk (partial) | Fix commits = branch commits not on default; partial revert rare |
| mechanics | major | Between-rounds card's owning round unclear | upheld | Decision 15 |
| mechanics | major | Unsettled typed answers | upheld | "Settling an answer" in Terms |
| mechanics | minor | cards.md shared rules not updated | upheld | §3 Docs |

### Round 1 — 2026-11-20

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Pre-build overlap card answered after Start building has no meaning | upheld | Retract and repost at Start; late answers mapped (Decision 11) |
| intent | major | Restart test for "already acted" covers only review | upheld | Done markers per stage (Decision 10) |
| intent | minor | Pending-change Log lines duplicate user-decision rules | upheld | Review cards are user-decisions (Decision 9) |
| intent | minor | Up to five options | upheld | At most four in total |
| mechanics | blocking | Up to five options fails validation | downgraded (minor) | The lead sees the refusal and fixes the card; capped at four |
| mechanics | major | Old one-line overlap instructions remain | upheld | §1 names each one replaced |
| mechanics | blocking | Zero-finding round with an open overlap card has no progress | downgraded (major) | A worker would ask; counted as user-decision, `fixing` found 1 |
| mechanics | blocking | Small fix: uncommitted edits, push timing | downgraded (major) | Hold the push; commit then revert; after push use Done options |
| mechanics | blocking | Queued retract can fail silently | downgraded (major) | Retract never queued (Decision 12) |
| mechanics | major | Stale pre-build choices at Start; restart boundary | upheld | Decision 11; boundary is the approval's start-building answer |
| mechanics | major | Held overlap lost on restart | upheld | Watch List once PLAN.md exists; earlier window is an Accepted Risk |
| mechanics | major | Title prefix and stub name are not stable identities | upheld | `about_thread` and `From overlap card <id>` (Decision 10) |
| mechanics | major | Chat resolutions and retractions misread on restart | upheld | "Actionable answer" defined in Terms |
| mechanics | blocking | Fallback id breaks duplicate receipts | upheld | Delivery id always the card id (Decision 12) |

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
