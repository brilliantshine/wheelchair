---
slug: lead-chat
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-19
---

# Leads that know about each other

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

(none)

## Watch List

Things noticed that need looking into — not yet decisions for the user. Written down the
moment they're spotted so they can't be forgotten, surfaced to the user one line at a
time as they appear, and emptied before Stage 1 exits.

Each item ends up settled by the agent (noted in the Log), promoted to an Open Question,
promoted to a Constraint or Accepted Risk, or waved off by the user.

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Plan mode is two-part | User's pick on the mode card | user |
| 2 | A lead addresses another lead by its session name (`wc-<thread-id>-lead[-n]`) in a `message` card's `to`; the hub resolves names across threads only for lead-to-lead messages | Session names are already unique; no new card kind needed | defaulted |
| 3 | "Same project" means the same resolved project path on the same machine; other machines are never listed or reachable | IDEA.md: same machine, same project | defaulted |
| 4 | The listing shows threads that are not archived and have a live lead, excluding the caller's own thread | Archived or dead threads cannot answer | defaulted |
| 5 | The summary is built from what the hub already has: thread title, latest lead, pinned idea bullets, pinned progress line, plan slug and status, PR link if any; no new summary text written by leads | Cheapest; always current; no extra lead turns | defaulted |
| 6 | Cross-thread messages stay hidden in both threads, like in-thread messages; the receiving lead answers with its own `message` back | IDEA.md constraint; reuses existing delivery | defaulted |
| 7 | `asks` works across threads; `passes_on` still only references a question from the poster's own thread | A lead that needs its user's decision posts its own question card | defaulted |
| 8 | If two leads agree on a split that changes what either user-facing plan promises, each lead takes it to its user as a card before acting | Leads may not change scope without the user (lead.md, IDEA.md stability) | defaulted |
| 9 | Leads check other leads at set points: once mapping finishes, before Start building, and whenever the user asks | User's pick | user |
| 10 | A cross-project OK lasts for the rest of the thread: the lead asks once on a card naming the other thread; after "Allow" both leads may message each other until either thread is archived | User's pick | user |
| 11 | The cross-project OK is a new shown card kind `reach` with fixed Allow / Don't allow buttons, not a free-form question card | The hub must know exactly which thread was allowed; a question card's options are free text | defaulted |
| 12 | A lead finds a thread in another project only through `wc.js session leads --all-projects`, which lists name, project and title only (no summary), and the rules allow it only after the user named that thread or project | The user said no extra security; this keeps unrelated projects out of normal summaries | defaulted |
| 13 | A message to any lead session of another thread is delivered to that thread's latest live lead; with none live it is refused | Leads restart and get new names; a dead name would queue forever | defaulted |

## Spec

### What changes, in one paragraph

Leads gain two abilities across threads on the same machine: **list** the other active
threads (with a short summary) in their project, and **message** another thread's lead.
Messages reuse the existing `message` card; only lead-to-lead messages may cross threads.
A lead in a different project can be messaged only after the user presses Allow on a new
`reach` card. All of this is hidden from the user like in-thread messages today, except the
`reach` card itself.

### Terms

- **Peer thread** of thread T: a thread that is not T, not archived, has a live lead, and has
  the same `machine` and the same `project` (the stored resolved project path) as T.
- **Linked thread** of T: a not-archived thread on the same machine, in another project,
  whose id is in T's `lead_links` (set by an allowed `reach` card, below).
- **Latest live lead** of a thread: `[...thread.sessions].reverse().find(s => s.role === 'lead' && s.live)`,
  the same rule user messages use (`viewer/app/threads.js:385`).

### 1. Listing: `wc.js session leads`

- `node <root>/viewer/app/wc.js session leads` sends `{action: 'leads'}` along the existing
  session path (`viewer/app/wc.js` `sessionRequest` → machine `/v1/agent/session`
  `forwardSession` → hub `sessionRequest` in `viewer/app/sessions.js`). The machine needs no
  change if it already forwards any action; confirm, and add `leads` if it filters.
- Only a caller whose role is `lead` may use it; any other role gets 403
  `only a lead may list other leads`.
- Output (printed as one JSON line; no `--full` variant): `{ "leads": [entry, ...] }`, one
  entry per peer thread **and** per linked thread, newest thread first. Each entry:
  - `thread`: the thread id
  - `lead`: name of its latest live lead
  - `project`: the project path (lets a lead tell peers from linked threads)
  - `linked`: `true` for a linked thread, else `false`
  - `title`: the thread title
  - `stage`: the plan's `status:` when the hub knows a plan slug for the thread (the
    `last_status` logic in `viewer/app/views.js`), else `"no plan"`
  - `idea`: the texts of the pinned idea card's bullets, at most 6, else `[]`
  - `progress`: the folded progress label text as the app shows it (see `cards.md`,
    `progress`), else `null`
  - `branch`: the thread's branch, `pr_url`: the latest non-retracted done card's `pr_url`, else `null`
- `wc.js session leads --all-projects` additionally lists every other not-archived thread
  with a live lead on the same machine in other projects, each with only `thread`, `lead`,
  `project`, `title` and `linked`. It exists so a lead can find a thread the user named.
- No thread is listed from another machine, ever.

### 2. Messaging another lead

- A `message` card whose `to` names a session that is not in the sender's thread is resolved
  across threads **only when** the sender's role is `lead`. Otherwise the existing 404
  `session not found in thread` stands.
- Cross-thread resolution: find the thread whose `sessions` contain a session with that name
  and role `lead`. Refuse with 422 and these reasons, in order:
  1. no such lead on any thread, or the named session is not a lead → `no lead by that name`
  2. the target thread is on another machine → `that lead is on another machine`
  3. the target thread is archived → `that thread is archived`
  4. the target thread is in another project and not linked to the sender's thread →
     `that lead is in another project; ask the user with a reach card first`
  5. the target thread has no live lead → `that thread has no live lead right now`
- On success: the card is stored in the sender's thread as today (with `to` as written).
  The text queued is
  `[wc:from <sender name>] [thread <sender thread id>: <sender thread title>] ` plus
  `[question <card id>] ` when `asks` is true, plus the text, queued on the target thread's
  **latest live lead** (not necessarily the named one) and delivered with the existing
  `deliver`. The target thread's queue write is a second `hub.updateThread` on the target
  after the sender's save; it is not atomic with it (see Accepted Risks).
- `passes_on` still only names a question in the sender's own thread (unchanged check).
- The same-thread path is unchanged in every respect.
- The receiver's reply stays hidden (the message starts with `[wc:from`); the hub needs no
  change for that. Check `viewer/app/chat.js` hides it in the receiving thread's view too.

### 3. The `reach` card (cross-project OK)

- New lead-only, shown, unpinned kind `reach`. Fields: `thread` (required, the other thread's
  id from `--all-projects`), `why` (required, one line in the user's terms). The hub refuses
  it (422) when the thread does not exist, is the sender's own thread, is on another machine,
  is archived, is in the same project (`already in your project; no OK needed`), or is
  already linked (`already allowed`). On accept, the hub stores on the card `target_title`
  and `target_project` for display.
- Shown as: "Let this thread's lead talk to the lead of **<target_title>** (<project folder
  name>)?", the `why`, and two buttons **Allow** and **Don't allow**, styled like a question
  card. Follows the question-card one-answer rule: a second press is refused
  `card is already answered`.
- Allow: in the same press, add each thread's id to the other's `lead_links` (two
  `updateThread`s, the pressed thread first), mark the card answered, and queue
  `[card <id>] picked: allow` to the lead. Don't allow: mark answered, queue
  `[card <id>] picked: don't allow`. Nothing else changes.
- Retractable like a question card (add `reach` to the retract kinds and its refusal text).
- A link lasts until either thread is archived; archived threads are never listed or
  reachable, so no cleanup is needed.
- Add `reach` to `protocol/app/cards.md`'s kinds table and its fields and press forms to
  `protocol/app/cards-lead.md`.

### 4. Lead rules (`protocol/app/lead.md`)

Add a section "Other leads on this machine":
- When to look: run `wc.js session leads` (a) when the mapper's `result` arrives and you
  have read MAP.md, (b) right before posting the approval card, (c) when the user asks. For a
  small fix, once before committing. Nothing is shown to the user unless something overlaps.
- Overlap: when a listed thread's title, idea or stage suggests it touches the same files
  or behaviour, message its lead once: what you are building, the areas you will touch,
  and ask (`asks: true`) what it is doing there. Agree who does what.
- Anything you agree that changes what your user asked for, IDEA.md or the Spec, goes to
  your user as a `question` card before you act on it. Otherwise note the agreement in
  the PLAN.md Log (or say it in your reply for a small fix) and tell your user in one line in
  your next reply.
- Receiving `[wc:from wc-<id>-lead...] [thread ...]`: answer with a `message` back to that
  name, briefly and from what you know; it does not change your step. Never reply to a plain
  acknowledgement, and send no acknowledgements yourself.
- Another project: only when the user names a thread or project. Find it with
  `--all-projects`, post a `reach` card, and message only after `picked: allow`. On
  `don't allow`, drop it and say so in a line.
- A sub-lead never messages another thread; it asks you.
- Mention in the lead rules that the sub-lead, workers, reviewers, verifiers and mappers
  cannot message across threads (the hub refuses).

### Non-goals

Other machines; non-lead roles across threads; showing cross-thread traffic in the thread;
automatic coordination; leads writing their own summaries.

### Validation

```bash
node --test viewer/test/*.test.js
npm --prefix viewer run test:browser
bash machine/test/run.sh
```

New tests in `viewer/test/` must cover: `session leads` lists only same-machine, same-project
peers with live leads and excludes the caller's own, archived and other-machine threads;
`--all-projects` adds other-project threads with only the five fields; non-lead callers
refused; each cross-thread message refusal in order; a successful cross-thread message
lands on the target's latest live lead (after a lead restart) with the `[thread ...]`
marker; a non-lead naming another thread's session still gets 404; a `reach` card's
refusals, Allow linking both threads both ways, Don't allow linking nothing, and a second
press refused. A browser test shows a `reach` card with its two buttons and the answered state.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| D1 | Hold a message for a thread whose lead is restarting, instead of refusing it | A refused sender can retry later; restarts are short | planning | Queue on the thread and deliver to the next live lead |
| D2 | A hub cap on cross-thread messages so two leads can't loop | The lead rules forbid acknowledgements; loops need a rule break | planning | e.g. N per hour per pair, refusal reason in the card |
| D3 | A restarted lead sees its earlier cross-thread conversations | Restart context today carries cards, not hidden traffic | planning | Include recent cross-thread messages in the restart context |
| D4 | A visible note in the thread when leads agreed something | Leads already say it in their next reply | planning | Small "Talked with <thread>" line |

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them. Rare paths per `protocol/app/realism.md` land here in every mode, with round
`review-round-N`, `verification-N` or `lead-check`.

| Risk | Why accepted | Round |
|------|--------------|-------|
| A crash between saving a cross-thread message in the sender's thread and queuing it on the target loses that one delivery | Needs a hub crash inside a sub-second window; the sender can resend | planning |

## Check Once Built

Review findings only the built code can settle, per `protocol/app/realism.md`. Verifiers
check each row against the build; a listed row is settled for later review rounds and
stays as review history.

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

### Round 1 — <date>

**Lanes:** <family / model>; <family / model>; cross-family: <yes|no>.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most.

<!-- Round 2+: list what changed since the previous round; that list scopes the reviewers. -->

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

Reported severity is the reviewer's opinion; the lead verdict
(`upheld`/`downgraded`/`declined`/`accepted-risk`/`check-once-built`/`user-decision`) is what gates the
exit. Downgrades and declines cite evidence.

## Prior Work

Parts of the Spec already built before this plan reached Stage 3 — adopted from outside
with work already done, or left behind by an implementation run that died partway.

Stage 3 does not re-implement `pre-existing` items and does not touch their code. Stage 4
verifies them exactly as rigorously as everything else: this code has never been through
the gate, so skipping it would leave the least-trustworthy part of the change as the only
part nobody checked.

Ambiguous evidence means **not done**. A wrong "done" is a silent hole; a wrong "not done"
costs a worker one look.

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|
|           | pre-existing / partial | | high / low |

`partial` items are implemented by Stage 3 — the brief names what exists so the worker
completes it instead of restarting it.

## Implementation Tasks

Filled by Stage 3. One row per worker brief.

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

Session id = the `thread_id` of a `codex exec` lane, so remediation can resume it.

## Log

Free-form running notes: deviations discovered mid-implementation, scope events,
anything a future session needs that fits nowhere above.
