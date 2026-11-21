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

## Spec

### Terms

- **Overlap:** another thread (from `wc.js session leads`, a peer lead's message, or the user)
  whose work touches the same files or behaviour as this thread's, and whose `stage` is not
  `done` (a finished thread's overlap is mentioned in one line of the reply, not asked). Its identity is the other
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
  An answer is read against the options of its own card, then the Start building mapping
  applies where it does.
- **Settling an answer:** an answer that clearly picks one of the card's options is acted on.
  One that does not (an objection, a condition, something else) gets a follow-up overlap card
  for the same thread with the current stage's options, and no Done marker until that one is
  settled. The original card counts as handled once a later overlap card with the same
  `about_thread` exists. In planning and review, a typed answer may also be its own option, handled like any
  planning answer.
- **Done marker:** where the lead records that it acted on an overlap card, so nothing is acted
  on twice. It always names the card id. Before acting on any overlap answer (a press, a typed
  answer, a chat answer or a restart), the lead checks for its Done marker and does nothing if
  it exists.
  - a planned thread (PLAN.md exists) up to Start building: a Decision Log entry, source
    `user`, naming the other thread's id and ending `(overlap card <id>)`;
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
negotiate) and ends with "Your user decides through an overlap card (see below)".

General rules:
- One question at a time: an overlap card waits behind any open `question` card of yours and is
  asked next. While status is `planning`, `ready-for-review` or `approved`, a waiting overlap is
  added to the Watch List at once (`Overlap with <thread id>: <what>`) and moved to Open
  Questions when asked. During a build or after `done` the lead writes nothing for it; a restart
  finds it again by looking (§2).
- `fits` names the other thread by its title; each option's `consequence` says what the answer
  does to this thread. At most four options in total.
- The stage that counts is the one when the card is posted; at Start building, cards with
  pre-build options are replaced (see "Start building").

Stages:
- **Small fix, before edits:** found at the look before edits: post the card, edit nothing until
  it is answered. Options: "Go ahead with the fix" and "Leave it to <other thread>" (no edits;
  say so in the reply; the thread stays open).
- **Small fix, after edits, before the first push:** hold the push while the card waits.
  Options: "Carry on" and "Drop the fix". Drop: first commit any uncommitted edits of the fix
  (`wc.js git commit`, the fix's paths), then `wc.js git revert --no-commit` every commit on the
  branch that is not on the default branch, newest first, then one `wc.js git commit` of the
  reverted paths whose message names `overlap card <id>`. Check `ok` in each result. Push
  nothing; say so in the reply.
- **Small fix, after the first push:** the Done options below. This narrowing is intentional:
  the user can close the pull request themselves.
- **Feature, before IDEA.md is confirmed:** hold it; ask it as the first question after
  confirmation, before any design question (it then follows "Planning").
- **Planning (status `planning`):** an Open Question in PLAN.md, asked as an overlap card
  (today's (b) rule, now for every new overlap in planning). Options: "Keep the plan as it is"
  and up to three "Change it: <what>". The answer is handled like any planning answer, with the
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
- **Approved, before Start building:** options as in Review. A change: retract the approval
  card: always the last approval card this thread's leads posted, pinned or not (§3: a retract is
  never queued, so its result is final). On success, or when that card was already withdrawn by a
  lead (the refusal says `card is already answered` and it has `retracted_at` in the thread
  state): log the Decision with the
  Done marker, fold the change in, set `status: ready-for-review`, and go to step 5 with the
  change listed. If the refusal says `Start building was already pressed` (§3), handle the
  answer under "Start building". On 503, retry after a minute.
- **Start building:** on `[card <id>] start building`, start the sub-lead first (as today).
  Then retract every open overlap card whose options are not the Building options, and repost
  each with the Building options and the same `about_thread` (a retract 503: retry after a
  minute; already answered: read its answer by the mapping below). Once the approval card's
  `answered_action` is `start-building`, every pre-build overlap answer without a Done marker,
  whenever it was given, is read as: "Keep the plan" → "Let it finish"; any "Change it" → "Let it finish, then start a
  follow-up thread", naming the change in the stub. The boundary is that approval answer,
  whatever `status:` says.
- **Building (Start building accepted until `done`):** the running build never changes and the
  lead writes nothing to the worktree. Options: "Let it finish" and "Let it finish, then start a
  follow-up thread" (post a `stub` at once, `depends_on_parent: true`, naming the other thread,
  what to reconcile and `From overlap card <id>.`). No stop option: to stop, the user archives
  the thread (Decision 8).
- **Done (step 9):** options "Leave it" and "Start a thread about it" (a `stub` naming
  `From overlap card <id>.`, with `depends_on_parent` set by the Stubs rule).

### 2. Restart (protocol/app/lead.md, "Restarting what died")

On `[wc:context restart]`, after rereading the plan and cards:
- If the latest review round is not triaged (reviewers still running, or its table has no rows
  and no reviewer is live), handle it as for pending pull-backs today: stop any live reviewers,
  discard their reports, apply every overlap answer that has no Done marker (with its marker),
  and restart the round under the same number, listing the change in its "Changed since".
- Otherwise, for each overlap card with an actionable answer and no Done marker (search the
  Decision Log, `git log --format=%B` of the branch, and the `stub` cards' summaries in the
  context): act on it now, at the current stage's rules.
- If the approval card is answered with `start-building` and `status:` is `approved`,
  `implementing` or `verifying`: if no sub-lead is live, start one as in Start building step 1;
  then finish the Start building card replacement for any open overlap card that still has
  pre-build options. With `status: done` no sub-lead is started.
- An open overlap card stays open and is not asked again. An overlap card retracted by a lead
  with no later overlap card for the same `about_thread` is reposted with the current stage's
  options.
- Run `wc.js session leads` once and treat any overlap not covered by an overlap card or a
  Decision Log entry as new. A planned thread before Start building also asks any `Overlap with`
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
- `viewer/app/card.js` `retractable`: an approval card whose `answered_action` is
  `start-building` is refused with `Start building was already pressed`, before the generic
  `card is already answered`.
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
  context, that it is never queued, and lists the new refusal.

### Non-goals

No change to how leads list or message each other; no lead-to-lead negotiation; no automatic
merging of branches; no sub-lead or worker rule changes.

### Validation

- `node --test viewer/test/*.test.js` passes, with new tests: a card's id equals its
  `delivery_id`; a re-delivery returns the same id with `duplicate: true`; `about_thread` is
  accepted on `question` (12 hex) and refused otherwise or on other kinds; `card.js` prints
  `{id,kind}`, `{id,kind,queued}` and `{ok}`, and never a text field; retracting an approval
  answered with Start building is refused with `Start building was already pressed`.
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
| A replacement lead re-posts an overlap card or stub that the dead lead's post still has queued on the machine (the app was down), making a duplicate | Needs a lead death during an app outage right after posting; a duplicate card is visible and harmless | review-round-2 |
| A restart in the middle of a multi-commit "Drop the fix" leaves some fix commits unreverted with no completion rule | Needs a crash within the seconds a few reverts take | review-round-2 |

## Review Rounds

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
