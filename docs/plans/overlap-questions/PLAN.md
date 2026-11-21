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
Review Rounds 4-6). Map: `MAP.md`, `docs/maps/overlap-decision-flow.md`. The map predates
Decision 28: its review, approval and build overlap paths are out of scope.

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
| 25 | No general "Change it" button: overlap cards offer "Keep the plan as it is" plus one to three concrete changes, and the box takes any other; a concrete typed answer settles in approved too; a round restarted by recovery counts the answer applied in it | Round 7 findings | review-round-7 |
| 26 | Approved-stage withdrawal applies to every overlap card, re-asks included; one fallback change option always exists; a split offer goes before waiting overlap cards but after an open one; a typed change follows its stage's change rules | Round 8 findings | review-round-8 |
| 27 | Several overlaps on a small fix are all settled before edits; an answer that removes promised scope is an `idea-change` (its own Done marker); chat answers are resolved at once; a split settles waiting overlaps it made moot; the fallback option is always one of the change options and points to a follow-up | Round 9 findings | review-round-9 |
| 28 | Supersedes the review, approved, Start building and restart-round parts of Decisions 4, 9, 11, 13-15, 17, 19-23, 25-27: overlap cards are asked only in the card window (before a small fix's edits; a feature while `planning`). From `ready-for-review` on, an overlap is a late overlap: one line and an offered follow-up thread. IDEA.md What we're building, What good looks like and Not doing changed to match. The card-id and retract changes (§3) stay | After rounds 7-9 again found new corners where overlap cards meet review, approval and splits, the user picked "Cards only while planning" (card 8d02e56a) | idea-change |
| 29 | Pre-confirmation overlaps are held, not late; withdrawn overlap cards clear their Open Question; a Spec change asked in chat during a running round waits for triage and the next round; on a small fix the latest instruction wins and committed edits close its cards; a talk-instead retract refused by Start building leaves the build running | Round 10 findings | review-round-10 |
| 30 | A Spec change asked in chat during a running round uses the pending pull-back pattern (`Pending change:` / `Applied change:` Log lines; not clean; counts as one found item; replayed on restart) | Round 11 findings | review-round-11 |
| 31 | A chat Spec change logs `idea-change` when it drops promised scope; restart with live reviewers applies a pending change before restarting the same pass; a chat change to an approved plan retracts the approval first; re-asking an open card retracts and reposts it | Round 12 findings | review-round-12 |
| 32 | Split off: how a Spec change the user asks for in chat during a running review or after approval is saved, counted, survives a restart and withdraws the approval moves to its own thread (stub). Supersedes Decisions 30 and the chat-change parts of 31; a late overlap here gets only the one-line mention and a follow-up offer | Rounds 10-12 kept finding gaps there, and they are gaps in the existing review rules, not about overlaps; the user picked "Split it off" (card 72ce279f) | user |
| 33 | Overlap questions from a peer follow the card window; (b)'s own overlap sentence is replaced; a re-ask posts its replacement only after the retract is confirmed | Round 13 findings | review-round-13 |
| 34 | Peer overlap questions get four explicit paths (settled, held, in window, late) and the answer goes back to the peer, recorded on the Open Question for restarts; every retract 503 is retried after a minute | Round 14 findings | review-round-14 |
| 35 | Peer replies are best effort and never hold the plan: the Decision carries who asked and the reply follows its commit; a small fix does not reply after a restart; only a re-ask and the talk-instead approval retract wait for a retract to succeed | Round 15 findings | review-round-15 |

## Spec

### Terms

- **Overlap:** another thread (from `wc.js session leads`, a peer lead's message, or the user)
  whose work touches the same files or behaviour as this thread's, whose `stage` is not
  `done`, and which is not a small fix whose `done` card is posted (`stage` `no plan` with a
  `pr_url`, which the peer list takes from that card). A finished thread's overlap is
  mentioned in one line of the reply, not asked. Its identity is the other thread's id
  (`thread` in `session leads`), never its title.
- **Overlap card:** a `question` card carrying the new optional field `about_thread` (§3), the
  other thread's id. The app stores it and never shows it.
- **Card window:** when overlap cards are asked: a small fix before its edits, and a feature
  from IDEA.md confirmation while `status:` is `planning`. Before IDEA.md is confirmed an
  overlap is held and asked first after confirmation.
- **New overlap:** one whose thread id is not the `about_thread` of any overlap card in this
  thread and not in a Decision Log entry of this plan. An overlap already asked is asked again,
  inside the card window, only when new information changes what the answered option would do.
- **Late overlap:** a new overlap learned outside the card window (status `ready-for-review` or
  later, or once a small fix's edits are made). It never gets a card: the lead says in one line
  of its next visible reply which thread overlaps, what it is doing, and that a follow-up thread
  can be started; if the user asks for one, the lead posts a `stub` (`depends_on_parent` by the
  Stubs rule). If the user instead asks in chat to change this thread's plan or work, that is
  handled like any other change they ask for at that step (this plan adds no rule for that; a separate thread covers chat changes during review and after approval, Decision 32). Repeating the line after a restart
  is harmless.
- **Actionable answer** of an overlap card, in this order: `answered_value` when
  `answered_action` is `picked` or `answered` (a press or the card's own box); else
  `resolved_note` when the lead resolved it from a chat answer; else, on restart only, a chat
  answer to it in `recent_messages` sent after the card was posted (then resolve the card with
  a note of it). A card with `retracted_at` has no answer. A chat answer is resolved on the card
  as soon as it arrives; if that resolve is refused because the card was already answered, the
  stored card answer wins.
- **Settling an answer:** an answer that clearly picks one option, or (for a feature) states a
  concrete change of its own, is acted on. Anything else (an objection, a condition, a vague
  answer) gets a follow-up overlap card for the same thread, with no Done marker until that one
  is settled; the original card counts as handled once a later overlap card with the same
  `about_thread` exists.
- **Done marker:** a Decision Log entry naming the other thread's id and ending
  `(overlap card <id>)`, source `user`, or `idea-change` when the answer removes something
  IDEA.md's What or What good looks like promises (the answer is the user's agreement: the
  item moves to Not doing). It is committed in the same commit as the Spec change it causes.
  Small-fix answers need no marker. On a small fix, the latest instruction wins: a later chat
  message from the user about that overlap overrides the card's answer, and once the fix's
  edits are committed every answered small-fix overlap card is handled. Before acting on any overlap
  answer (a press, a typed or chat answer, or a restart), the lead checks for its Done marker
  and does nothing if it exists.

### 1. Asking (protocol/app/lead.md, "Other leads on this machine")

Discovery and peer messaging stay as they are: the "When to look" times (a)-(c) and the small
fix's look before edits, the "Overlap" message to a peer lead, "Replies", "Never wait",
"Another project", "Passing a question on" and "Only leads talk". Every instruction there to
tell the user about an overlap "in one line" (in "When to look", in "Overlap" for a thread with
`lead: null`, in "Leads inform", and the late answer in "Never wait") is replaced by: a new
overlap inside the card window becomes an overlap card; outside it, it is a late overlap
(Terms). "Leads inform; your user decides" keeps its first three sentences (information, never
instructions; never change on your own; never negotiate) and ends with "Your user decides
through an overlap card, or in chat for a late overlap (see below)". In "When to look" (b),
the sentence that turns a new overlap into an Open Question with "keep the plan as it is, or
change it" options is replaced by a pointer to this section; (b) keeps only its timing. In
"Passing a question on", a peer's question about an overlap with this thread takes one of these
paths:
- the overlap is already settled (a Decision Log entry, or an answered small-fix card): answer
  the peer from that decision, with no new card, unless the question brings new information that
  changes what the answered option would do (then it is a re-ask, inside the card window only);
- before IDEA.md is confirmed: held, like any overlap, and asked first after confirmation;
- inside the card window: it becomes (or joins) the overlap card for that thread;
- after the card window: the late-overlap mention, and the lead answers the peer from what it
  knows, saying its user was not asked.
When a held or carded peer question is settled, the lead sends the answer back to that peer as a
`message`, best effort: a refused reply (the peer archived or has no live lead) is dropped with a
Log line. For a feature, the Open Question line records who asked (`asked by <session name>,
question <id>`); the Decision Log entry copies it, the Open Question is removed with the Decision
as usual, and the reply is sent right after that commit. On a small fix nothing records who asked,
so a lead restarted before the answer does not reply to the peer. Unrelated peer questions pass on as today.

- **One question at a time:** an overlap card waits behind any open `question` card of yours
  and is asked next. For a feature, a waiting or asked overlap is in PLAN.md's Open Questions
  (`Overlap with <thread id>: <what>`; before PLAN.md exists, it is held and asked first after
  IDEA.md confirmation), so status stays `planning` until it is settled. The commit that logs
  its Decision removes it.
- **Card text:** `fits` names the other thread by its title; each option's `consequence` says
  what the answer does to this thread. At most four options.
- **Small fix, before edits:** post the card and edit nothing until it is answered. Options:
  "Go ahead with the fix" and "Leave it to <other thread>" (no edits; say so in the reply; the
  thread stays open). With several overlaps, every card is settled (one at a time) before any
  edit; one "Leave it" stops the fix unless the user later says otherwise. When it stops, the
  reply says the thread can be archived, or picked up again if they ask.
- **Feature, while planning:** an Open Question asked as an overlap card. Options: "Keep the
  plan as it is" and one to three concrete "Change it: <what>"; one of them is always "Change
  it: leave <shared area> out of this plan (it can come back later as a follow-up)", used when
  no other concrete change fits. Any other change the user types in the box or in chat. The
  answer is handled like any planning answer, with the Done marker.
- **Feature, before IDEA.md is confirmed:** held, not late: once IDEA.md is confirmed and
  PLAN.md created with `status: planning`, it is the first Open Question asked.
- **Everything later** (status `ready-for-review` or after, a small fix after edits): late
  overlap (Terms). No card.
- **Re-asking an open card:** to re-ask an open overlap card with new information, retract it
  and post the new card only once the retract succeeds (or is refused as `card was already
  withdrawn`); for a feature, its Open Question stays and is updated in the same commit. If the retract is
  refused because the card was answered, act on that answer against its own options instead.
  On a 503, retry after a minute before posting anything.
- **Withdrawn card:** when the lead retracts an overlap card because it no longer applies, it
  removes its Open Question in the same commit, with a Log line `Overlap with <thread id>
  dropped: <why>`.

### 2. Restart (protocol/app/lead.md, "Restarting what died")

On `[wc:context restart]`, after rereading the plan and cards:
- For each overlap card with an actionable answer and no Done marker: act on it now. If status
  is no longer in the card window (rare: the answer would have to cross the move to review),
  treat it as a late overlap.
- An open overlap card stays open and is not asked again. A retracted overlap card whose
  `Overlap with` Open Question is still in PLAN.md is asked again, unless a later overlap card
  with the same `about_thread` exists.
- Run `wc.js session leads` once and treat any overlap not covered by an overlap card or a
  Decision Log entry as new (a card inside the window, else a late overlap). A planned thread
  also asks any `Overlap with` Open Question not yet asked.

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
  the hub is unreachable). Its success and refusals come straight from the hub. Every retract a
  lead makes (overlap, approval, deferred, offer, question, needs, sudo) that gets this 503 is
  retried after a minute until it succeeds or is refused. The lead holds only where it needs the
  result (a re-ask, the approval retract at "talk instead of building"); elsewhere it carries on
  and retries later in the same turn or the next. `cards-lead.md` `retract` says so, so
  the existing retract steps (for example the deferred card on a switch to thorough) keep working
  through an outage.
- `viewer/app/card.js` `retractable`, before the generic `card is already answered`: an approval
  card whose `answered_action` is `start-building` is refused with `Start building was already
  pressed`; a card with `retracted_at` is refused with `card was already withdrawn`.
- `question` cards accept an optional `about_thread`: a string of 12 lowercase hex characters.
  Stored on the card, never rendered.
- `viewer/app/card.js` on success prints exactly one JSON line: `{"id":"<id>","kind":"<kind>"}`
  for kinds that create a stored card, with `"queued":true` added when the machine spooled it;
  `{"ok":true}` for `title`, `resolve`, `retract`. Never any other field of the card.
- `protocol/app/lead.md`: where it says to retract an approval card (mode change, pull-back,
  talk instead of building), the id is the one `card.js` printed for it, or from the restart
  context. At the "talk instead of building" retract, `Start building was already pressed`
  means the build stands: the lead says so in a line, noting that archiving the thread stops
  it and closes the thread, and keeps talking, without stopping the
  sub-lead.
- Docs: `protocol/app/cards.md` "Posting a card" documents the output and names the
  exceptions to "succeeds once the card is on disk, even if the app is down" (`done` and
  `retract` are never queued), and its rule that cards never carry a thread id names
  `question.about_thread` as an exception alongside `reach`. `cards-lead.md`: the `reach` field
  description no longer says it is the only card field holding a thread id; `question` table
  gains `about_thread`; `retract` says the id comes from `card.js`'s output or the restart
  context, that it is never queued, and lists the two new refusals in its refusal order.
  `machine/API.md`: the card route's sentence on when a spooled 202 is returned is replaced to
  cover every case (no answer, HTTP 500/502/503/504, a backlog, no hub configured), documents the
  queued `id`, and says `retract` is relayed synchronously (503 when the app is unreachable).

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
  and writes nothing to the spool, and a retract sent after the hub returns succeeds.
- `grep -n "overlap card" protocol/app/lead.md` shows the card-window, late-overlap and restart
  rules; `grep -n "Your user decides in chat\|tell your user in one line that it exists" protocol/app/lead.md`
  finds nothing.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| An overlap learned from a peer message before PLAN.md exists, still waiting to be asked, is lost if the lead also restarts before asking, and the peer's summary in `session leads` does not reveal it | Needs a restart inside a short window plus a peer summary that hides the overlap; the restart re-look covers the usual case | review-round-1 |
| A retract saved by the hub whose reply is lost in a network drop returns 503; the retry then gets `card was already withdrawn`, which the lead treats as success | Handled by the distinct refusal; listed so later rounds don't re-raise | review-round-4 |
| A lead that dies while launching round N+1's reviewers may restart the round under the pinned pass N | Needs a death within the seconds of a launch; a misnumbered round is cosmetic | review-round-6 |
| An item marked `late` in §1 Approved stays on the Watch List with no Decision | Needs Start building to cross the retract; the item is harmless text | review-round-7 |
| A fresh question for an already-answered overlap, still waiting behind another card at a restart, can look already asked | Needs an obsolete answer, a waiting re-ask and a restart together | review-round-7 |
| An approval card still queued on the machine at a restart can be missed, so the retract is skipped and the approval arrives beside an overlap question | Needs an app outage at approval, an overlap and a restart together | review-round-7 |
| A lead that dies twice, the second time while a restarted round's reviewers run, may count a recovery-applied answer in the wrong round | Needs two lead deaths in one round; counts are display only | review-round-8 |
| On a small fix, a later chat instruction overriding a card answer can be missed if the lead dies before edits and the message has fallen out of the last 20 in the restart context | Needs a reversal, a restart and many messages in between, before a small fix's edits | review-round-11 |
| A chat answer resolved while the app is down is queued; if the user presses an option on the same card before the queue drains, the hub keeps the press and drops the resolve silently | Needs an app outage, a chat answer and a press on the same card inside the reconnect window | review-round-12 |
| A late-overlap mention learned in a hidden turn is lost if the lead dies before its next visible reply and the peer list does not reveal it | Needs a restart inside that window; the restart re-look covers the usual case | review-round-13 |
| On a small fix, a re-ask whose original card was withdrawn is lost if the lead dies before posting the replacement | Needs a restart within seconds of the retract | review-round-13 |
| A re-ask whose retract got a 503 is lost if the lead restarts during the retry wait; the old card stays open with its old options | Needs an app outage and a restart within that minute | review-round-15 |
| A replacement lead re-posts an overlap card or stub that the dead lead's post still has queued on the machine (the app was down), making a duplicate | Needs a lead death during an app outage right after posting; a duplicate card is visible and harmless | review-round-2 |
| A restart in the middle of a multi-commit "Drop the fix" leaves some fix commits unreverted with no completion rule | Needs a crash within the seconds a few reverts take; moot since Decision 18 removed Drop the fix | review-round-2 |

## Review Rounds

### Round 15 — 2026-11-21

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 14:** Decision 34: §1 "Passing a question on" paths and peer reply; §1 re-ask "for a feature"; §3 every retract retried on 503; Validation adds a retract after the hub returns.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Small-fix peer reply lost on restart | upheld | Stated: no reply after a restart (Decision 35) |
| intent | minor | Whether the lead waits on a retract retry | upheld | Holds only where it needs the result (Decision 35) |
| mechanics | major | Open Question held until the peer reply is delivered | upheld | Decoupled; reply best effort (Decision 35) |
| mechanics | major | Small-fix peer link not persisted | downgraded (minor) | Defined behavior: no reply after a restart; the peer never waits on it |
| mechanics | major | Re-ask lost during a 503 retry at restart | accepted-risk | Rare path; Accepted Risks |

### Round 14 — 2026-11-21

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 13:** Decision 33: §1 opening paragraph (replaced (b) sentence; peer overlap questions follow the card window); §1 "Re-asking an open card" waits for a confirmed retract; two Accepted Risks.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Peer never hears the user's answer; settled overlap | upheld | Answer sent back; settled path (Decision 34) |
| intent | minor | Re-ask Open Question assumes PLAN.md | upheld | "For a feature" |
| mechanics | major | Peer question before IDEA.md confirmation | upheld | Held path (Decision 34) |
| mechanics | major | Peer question about a settled overlap | upheld | Answered from the decision (Decision 34) |
| mechanics | major | Peer reply lost on restart | upheld | Recorded on the Open Question (Decision 34) |
| mechanics | major | Synchronous retract breaks other retract steps when the app is down | upheld | Every retract retried on 503 (Decision 34) |

### Round 13 — 2026-11-21

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 12:** Round 12 fixes (Decision 31), then Decision 32 (split): Terms "Late overlap" no longer defines how a chat Spec change during review or after approval is handled (pending lines, counting, restart replay and approval retract removed); those cases are out of scope here.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | (b)'s own overlap sentence left in lead.md | upheld | Replaced by a pointer (Decision 33) |
| mechanics | major | Re-ask replacement posted before the retract is confirmed | upheld | Post only after a confirmed retract (Decision 33) |
| mechanics | major | Small-fix re-ask lost at restart | accepted-risk | Rare path; Accepted Risks |
| mechanics | major | Late notice lost if the lead dies in a hidden turn | accepted-risk | Rare path; Accepted Risks |
| mechanics | major | Passed-on peer overlap question bypasses the card window | upheld | Follows the card window (Decision 33) |

### Round 12 — 2026-11-21

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 11:** Decision 30: Terms "Late overlap" chat Spec change during a round (pending pattern); §2 successor guard on re-asking withdrawn cards; §3 build-stands line mentions archiving, machine/API.md in Docs; one Accepted Risk.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Chat change that drops scope logged as `user` | upheld | `idea-change` (Decision 31) |
| intent | minor | When a successor card exists is undefined | upheld | Re-asking an open card rule |
| intent | minor | "Archiving stops it" may read as a pause | upheld | Says it closes the thread |
| mechanics | major | Pending change with live reviewers at restart | upheld | Applied before restarting the same pass (Decision 31) |
| mechanics | blocking | Chat change to an approved plan leaves Start live | downgraded (major) | Retract the approval first (Decision 31) |
| mechanics | major | Queued chat resolve dropped after a press | accepted-risk | Rare path; Accepted Risks |
| mechanics | minor | machine/API.md spool sentence incomplete | upheld | §3 Docs |

### Round 11 — 2026-11-21

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 10:** Decision 29: Background map note; Terms "Late overlap" (chat Spec change during a round) and "Done marker" (small-fix latest instruction wins); §1 small-fix stop reply, held pre-confirmation stage, withdrawn-card rule; §2 re-ask of withdrawn cards; §3 talk-instead retract refusal.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | major | Chat Spec change lost on restart | upheld | `Pending change:` Log line (Decision 30) |
| mechanics | major | Round with a waiting chat change counted clean | upheld | Not clean, counts one found item (Decision 30) |
| mechanics | major | Small-fix override not durable | accepted-risk | Rare path; Accepted Risks |
| mechanics | minor | machine/API.md not in Docs | upheld | §3 Docs |
| intent | minor | Waiting chat change and clean rule | upheld | Same fix (Decision 30) |
| intent | minor | Withdrawn card re-asked despite a successor | upheld | Successor guard |
| intent | minor | Build-stands line should say how to stop | upheld | Mentions archiving |

### Round 10 — 2026-11-21

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 9:** Round 9 fixes (Decision 27), then Decision 28 (user, after the review budget): cards only in the card window. IDEA.md rewritten to match. Spec Terms rewritten (card window, late overlap now from `ready-for-review`, one Done marker form); §1 rewritten (no Review, Approved or Start building stages); §2 Restart reduced to planning; §3 unchanged except a lead.md bullet on where retract ids come from; Validation grep updated. Treat the whole Spec as changed.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Small-fix answers replayed after edits or after a later chat answer | upheld | Latest instruction wins; edits close them (Decision 29) |
| intent | minor | Talk-instead retract has no rule for the new refusal | upheld | §3 lead.md bullet |
| intent | minor | "Leave it" small fix has no closure hint | upheld | Reply mentions archiving |
| intent | minor | Map describes removed paths | upheld | Background note |
| mechanics | major | Pre-confirmation overlap read as late | upheld | Held stage restored in §1 |
| mechanics | major | Withdrawn overlap stuck in Open Questions | upheld | Withdrawn-card rule and restart re-ask |
| mechanics | major | Chat Spec change during a running review | upheld | Waits for triage, then next round (Terms) |
| mechanics | major | Restart reinstates a superseded small-fix answer | upheld | Latest instruction wins (Decision 29) |

### Round 9 — 2026-11-21

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 8:** Decision 26: Terms "Settling an answer" points a typed change at each stage's rules; §1 Planning fallback option; §1 Approved covers re-asks; §1 Review split-offer ordering; one Accepted Risk.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Fallback option wording reads as conditional or a fifth option | upheld | Always one of the change options (Decision 27) |
| intent | minor | Fallback "until checked" has no follow-through | upheld | Points to a follow-up instead |
| mechanics | major | Waiting overlaps after a split | upheld | Settled by the split (Decision 27) |
| mechanics | major | Overlap answer that changes scope | upheld | `idea-change` entry is the Done marker (Decision 27) |
| mechanics | major | When to resolve a chat answer during review | upheld | Resolved at once; stored answer wins on refusal |
| mechanics | major | Several overlaps on a small fix | upheld | All settled before edits; "Leave it" stops the fix |
| mechanics | minor | `reach` field text still says sole thread id | upheld | §3 Docs |

### Round 8 — 2026-11-21

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 7:** Decision 25: §1 Planning options (no general "Change it"); Terms "Settling an answer" (bare-pick rule removed; typed answers settle in approved too); §1 Review restarted-round counting; three Accepted Risks.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Typed change in approved left at `approved` | upheld | Terms point at each stage's change rules |
| intent | minor | No concrete option when scope is unclear | upheld | Fallback option (Decision 26) |
| mechanics | blocking | Re-asked overlap skips approval withdrawal | downgraded (major) | Applies to every overlap card (Decision 26) |
| mechanics | major | Keep-only card fails validation | upheld | Fallback option (Decision 26) |
| mechanics | major | Split offer vs open overlap card ordering | upheld | Ordering stated (Decision 26) |
| mechanics | minor | Round of a recovery-applied answer after a second death | accepted-risk | Rare path; Accepted Risks |

### Round 7 — 2026-11-21

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 6:** Decision 23: Terms "Overlap" cutoff is the peer's done card; "Settling an answer" treats a bare general "Change it" as unsettled; §1 General rules keep the Watch List item until its Decision; §1 Approved skips the retract when no approval was posted; §2 uses the approval's `answered_action` and marks the late-answer clause a safety net; one Accepted Risk.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | General "Change it" button cannot work with the box | upheld | Dropped (Decision 25) |
| intent | minor | Rare path: `late` Watch List item never closes | accepted-risk | Rare path; Accepted Risks |
| mechanics | major | Bare "Change it" and typed answers in Approved | upheld | General button dropped; typed answers settle in approved (Decision 25) |
| mechanics | major | Re-asked overlap waiting at restart looks already asked | accepted-risk | Rare path (three things together); Accepted Risks |
| mechanics | major | Restarted round omits the decision applied during recovery | downgraded (minor) | Counts and rows only; §1 Review says it counts once in the restarted round |
| mechanics | blocking | Rare path: queued approval missed at restart | accepted-risk | Rare path; Accepted Risks |

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
