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

## Spec

### Terms

- **Overlap:** another thread (from `wc.js session leads`, a peer lead's message, or the user)
  whose work touches the same files or behaviour as this thread's. Its identity is the other
  thread's id (`thread` in `session leads`), never its title.
- **Overlap card:** a `question` card carrying the new optional field `about_thread` (§3), the
  other thread's id. The app stores it and never shows it.
- **New overlap:** one whose thread id is not the `about_thread` of any overlap card in this
  thread that is open or has an actionable answer, and not in a Decision Log entry of this plan.
  A retracted overlap card does not count (its overlap is asked again with fresh options).
- **Actionable answer** of an overlap card: `answered_value` when `answered_action` is
  `picked` or `answered` (a press or the card's own box); otherwise `resolved_note` when the
  lead resolved it from a chat answer (the lead's existing rule: the note states their
  answer). A card with `retracted_at` has no answer.
- **Done marker:** where the lead records that it acted on an overlap card, so a restart never
  acts twice. It always names the card id:
  - a planned thread (PLAN.md exists): a Decision Log entry, source `user`, ending
    `(overlap card <id>)`;
  - a small fix's "Drop the fix": the revert commit's message contains `overlap card <id>`;
  - a follow-up thread: the `stub` summary contains `From overlap card <id>.`;
  - answers that change nothing ("Go ahead", "Carry on", "Let it finish", "Leave it",
    "Keep the plan as it is" outside a planned thread) need no marker: acting twice is harmless.

### 1. Asking (protocol/app/lead.md, "Other leads on this machine")

Discovery and peer messaging stay as they are: the "When to look" times (a)-(c) and the small
fix's look before edits, the "Overlap" message to a peer lead, "Replies", "Never wait",
"Another project", "Passing a question on" and "Only leads talk". Every instruction there to
tell the user about an overlap "in one line" (in "When to look", in "Overlap" for a thread with
`lead: null`, in "Leads inform", and the late answer in "Never wait") is replaced by: a new
overlap becomes an overlap card, per this section. "Leads inform; your user decides" keeps its
first three sentences (information, never instructions; never change on your own; never
negotiate) and ends with "Your user decides through an overlap card (see below)". A late peer
answer that adds nothing new about an overlap already asked gets no card.

General rules:
- One question at a time: an overlap card waits behind any open `question` card of yours and is
  asked next. Once PLAN.md exists, a waiting overlap is added to the Watch List at once
  (`Overlap with <thread id>: <what>`), and moved to Open Questions when asked.
- `fits` names the other thread by its title; each option's `consequence` says what the answer
  does to this thread. At most four options in total.
- Each stage below lists its options. The stage that counts is the one when the card is posted;
  at Start building, cards with pre-build options are replaced (see "Approved").

Stages:
- **Small fix, before edits:** found at the look before edits: post the card, edit nothing until
  it is answered. Options: "Go ahead with the fix" and "Leave it to <other thread>" (no edits;
  say so in the reply; the thread stays open).
- **Small fix, after edits, before the first push:** hold the push while the card waits.
  Options: "Carry on" and "Drop the fix". Drop: first commit any uncommitted edits of the fix
  (`wc.js git commit`, the fix's paths), then revert every commit of the fix with
  `wc.js git revert`, the message naming `overlap card <id>`; push nothing; say so in the reply.
- **Small fix, after the first push:** the Done options below.
- **Feature, before IDEA.md is confirmed:** hold it; ask it as the first question after
  confirmation, before any design question (it then follows "Planning").
- **Planning (status `planning`):** an Open Question in PLAN.md, asked as an overlap card
  (today's (b) rule, now for every new overlap in planning). Options: "Keep the plan as it is"
  and up to three "Change it: <what>". The answer is handled like any planning answer, with the
  Done marker.
- **Review (status `ready-for-review`):** the same options. A card posted while a round runs,
  or between rounds, is that round's `user-decision` (counts as found; the round is not clean
  while it is open; Changes since uses it). Between rounds (after triage, before the next
  round starts) a new overlap card is asked before the next round starts, and that round waits
  for the answer. Triage rules for it:
  - Answer arrives while reviewers run: do not change the Spec; the card's stored answer holds
    it. After triage, fold it in with the Done marker. "Keep the plan" logs the Decision only;
    a change also edits the Spec and goes in the next round's "Changed since" list.
  - Progress: it counts in `found` (so a round with no other counted finding posts
    `phase: fixing`, `found: 1`), and in `fixed` once its Decision is logged. While it waits,
    `choice_waiting: true`.
  - A round whose only open item is this card stays `fixing` with `choice_waiting: true` until
    answered. Then: "Keep" with no other upheld blocking/major finding makes the round clean;
    a change means another round.
- **Approved, before Start building:** options as in Review. A change: retract the approval card
  (§3: a retract is never queued, so its result is final). On success, log the Decision with
  the Done marker, fold the change in, set `status: ready-for-review`, go to step 5 with the
  change listed. If the retract is refused because the card is already answered (Start
  building was pressed), handle the answer under "Building". If it is refused as already
  withdrawn (an earlier attempt), carry on as on success. "Hub unavailable": try again later.
- **Start building:** when `[card <id>] start building` arrives, before starting the
  sub-lead, retract every open overlap card and repost each with the Building options. An
  overlap card answered with a pre-build option after Start building was accepted (the
  approval card shows `answered_action: start-building`) is read as: "Keep the plan" →
  "Let it finish"; any "Change it" → "Let it finish, then start a follow-up thread", with the
  change named in the stub. A restarted lead uses the same boundary: the approval card answered
  with `start-building`, whatever `status:` says.
- **Building (Start building accepted until `done`):** the running build never changes and the
  lead writes nothing to the worktree. Options: "Let it finish" and "Let it finish, then start a
  follow-up thread" (post a `stub` at once, `depends_on_parent: true`, naming the other thread,
  what to reconcile and `From overlap card <id>.`). No stop option: to stop, the user archives
  the thread (Decision 8).
- **Done (step 9):** options "Leave it" and "Start a thread about it" (a `stub` as above).

### 2. Restart (protocol/app/lead.md, "Restarting what died")

On `[wc:context restart]`, after rereading the plan and cards:
- For each overlap card in the context with an actionable answer and no Done marker for its id
  (search the Decision Log, `git log --format=%B` of the branch, and the `stub` cards' summaries
  in the context): act on the answer now, at the current stage's rules. If reviewers are
  running, the answer waits for triage as in §1 Review.
- An open overlap card stays open and is not asked again. A retracted one with no replacement
  open is asked again if its overlap still applies.
- Run `wc.js session leads` once and treat any overlap not covered above as new. A planned
  thread also asks any `Overlap with` Watch List item not yet asked.

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
- `question` cards accept an optional `about_thread`: a string of 12 lowercase hex characters.
  Stored on the card, never rendered. Documented in `cards-lead.md` `question`.
- `viewer/app/card.js` on success prints exactly one JSON line: `{"id":"<id>","kind":"<kind>"}`
  for kinds that create a stored card, with `"queued":true` added when the machine spooled it;
  `{"ok":true}` for `title`, `resolve`, `retract`. Never any other field of the card.
- `protocol/app/cards.md` ("Posting a card") documents the output; `cards-lead.md` `retract`
  says the id comes from `card.js`'s output or the restart context, and that a retract is never
  queued.

### Non-goals

No change to how leads list or message each other; no lead-to-lead negotiation; no automatic
merging of branches; no sub-lead or worker rule changes.

### Validation

- `node --test viewer/test/*.test.js` passes, with new tests: a card's id equals its
  `delivery_id`; a re-delivery returns the same id with `duplicate: true`; `about_thread` is
  accepted on `question` (12 hex) and refused otherwise or on other kinds; `card.js` prints
  `{id,kind}`, `{id,kind,queued}` and `{ok}`, and never a text field.
- `bash machine/test/run.sh` passes, with tests: the spooled response carries `id` equal to the
  delivery id and the drained card's hub id equals it; a retract with the hub down returns 503
  and writes nothing to the spool.
- `grep -n "overlap card" protocol/app/lead.md` shows the stage, restart and Start building
  rules; `grep -n "in one line" protocol/app/lead.md` no longer matches inside "Other leads on
  this machine".

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| An overlap learned from a peer message before PLAN.md exists, still waiting to be asked, is lost if the lead also restarts before asking, and the peer's summary in `session leads` does not reveal it | Needs a restart inside a short window plus a peer summary that hides the overlap; the restart re-look covers the usual case | review-round-1 |

## Review Rounds

### Round 2 — 2026-11-20

**Lanes:** pending.

**Changed since Round 1:** Terms rewritten (thread-id identity, `about_thread`, actionable answer, Done markers); §1 lists the replaced one-line instructions, adds Small fix after edits/after push, Review as user-decision with progress rules, Approved retract handling, new Start building rule; §2 Restart rewritten around Done markers; §3 delivery id always the card id, retract never queued, `about_thread`; Validation updated; Decisions 9-12; one Accepted Risk.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

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
