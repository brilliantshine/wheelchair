---
slug: stub-dedupe
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-21
---

# No duplicate stubs

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first. Map: `MAP.md`.

## Open Questions

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is two-part | Collin picked it | user |
| 2 | Candidates are stubs (threads created from a stub card) in the same project on the same machine, not archived or handed off, and whose own work is not done (no `done` card, no merged PR) | Only these can still take the work | defaulted |
| 3 | `session leads` lists candidate stubs even with no lead (`lead: null`), and every stub entry carries `stub: true` and `summary` (its current context, additions included) | Agents can't compare without the summary; MAP.md shows both are missing today | defaulted |
| 4 | Adding uses the existing `stub` card with a new optional `adds_to: <thread id>` field; the card's `summary` is the addition. Exact duplicates use it too, with a one-line summary ("Also came up in this thread") | One card kind, and the target stub records every thread that hit the same problem | defaulted |
| 5 | An addition with `depends_on_parent: true` or `commits` is refused; such work gets its own stub | A stub waits on exactly one parent branch | defaulted |
| 6 | An agent may add only to a stub that is unopened, or opened and still planning (its PLAN.md `status` is `planning`, or it has no plan status and no `progress` card yet). Otherwise it makes a new stub as today, whose summary names the related stub | Keeps approved or in-progress work from changing underneath Collin (IDEA.md constraint) | user |
| 7 | The lead adds without asking Collin; the addition is visible in both threads, and an opened stub's lead brings it to its own user before taking it on | Collin picked "Just add it" | user |
| 8 | An opened stub's lead that receives an addition asks its user with a question card (take it in / make it its own thread / drop it); a duplicate note gets no card | Keeps the IDEA.md constraint: nothing joins work Collin has seen without him | defaulted |
| 9 | A duplicate note (`duplicate: true`) may go on any candidate stub, including one being built, because it adds no work | Decision 6 limits added work, not a record that the problem came up again | defaulted |
| 10 | An addition (not a duplicate note) to an opened stub whose lead is not live is refused; the agent makes its own stub. Holding it for the next lead is deferred | Thread f4c68e8cbb15 is building held delivery for cross-thread messages; the follow-up can reuse it | defaulted |

## Spec

### Terms
- **Stub thread**: a thread whose record has `stub: true` (created by `createStub`, `viewer/app/threads.js:92`). Its `context` is the summary its first lead receives.
- **Candidate**: a stub thread in the caller's project, on the same resolved machine, not archived, not frozen (handed off), with no current `done` card (`currentDone`, `viewer/app/cards.js:51`) and no merged pull request of its own.
- **Takes additions**: a candidate that has no sessions (unopened), or that has a live lead (`latestLiveLead`), `last_status` absent or `planning`, and no pinned `progress` card.

### 1. Discovery: `wc.js session leads`
`listLeads` (`viewer/app/peers.js:41`) also lists every candidate in the caller's own project, whether or not it ever had a lead (unopened ones show `lead: null`). Every entry for a stub thread in the caller's project gains:
- `stub: true`
- `summary`: the thread's current `context` (additions included, see 2)
- `takes_additions`: boolean, by the rule above.
Non-stub entries are unchanged (no new fields). Stubs in other projects (linked or `--all-projects`) get no new fields and unopened ones are not added there. A stub thread that is no longer a candidate (done, merged) and never had a lead stays out of the list; one that had a lead is listed as today, with `takes_additions: false`.

### 2. Adding: the `stub` card's `adds_to`
`stub` cards gain two optional fields, validated in `viewer/app/card.js` (fields table at line 170) and again by the hub:
- `adds_to`: the target thread id, 12 lowercase hex characters.
- `duplicate`: boolean; allowed only with `adds_to`.
With `adds_to` present: `depends_on_parent` must be `false` and `commits` absent, else refused (`an addition can't depend on this thread's unmerged work; post your own stub`). `title` and `summary` stay required.

In `acceptCard` (`viewer/app/cards.js`, the `card.kind === 'stub'` branch near line 192), when `adds_to` is set, no child is created. Instead, under the target thread's own lock, the hub checks in order and refuses (422, card not stored) with:
1. `no such stub` (missing, not a stub thread, or another project or machine);
2. `that stub is archived, handed off or finished` (not a candidate);
3. for a non-duplicate: `that stub is past planning; post your own stub` when it does not take additions, and `that stub's lead isn't running; post your own stub` when it is opened with no live lead.
On success:
- It appends to the target's `context` a new paragraph: `\n\nAdded from "<parent title>" (<YYYY-MM-DD>): <summary>` or, for a duplicate, `\n\nAlso came up in "<parent title>" (<YYYY-MM-DD>): <summary>`.
- It records on the target `stub_additions: [{ from_thread, from_title, card_id, duplicate, text, at }]`.
- When the target has a live lead, it queues to that lead (as `result` delivery does, `viewer/app/cards.js:185`): `[wc:from app] [stub addition from thread <parent id>: <parent title>] <summary>` for an addition, or `[wc:from app] [stub duplicate note from thread <parent id>: <parent title>] <summary>` for a duplicate.
- The stored card keeps `adds_to` and gains `thread_id` = target id and `target_title` = the target's title, so the parent card links to it.

### 3. What the user sees
- Parent thread: the stub card (`viewer/pages/thread.js:1219`) with `adds_to` shows heading "Added to another thread" (duplicate: "Already a thread for this"), the target title, the summary, and "Go to it" to the target. Without `adds_to`, unchanged.
- Target thread: the unopened page and the opened page's start-context details already render the current `context` (`viewer/pages/thread.js:529`, `:662`), so additions appear there. The opened target's lead also brings a non-duplicate addition to its user (4).

### 4. Protocol text
`protocol/app/lead.md`, Stubs section, gains:
- **Before posting a stub**, run `session leads` and read entries with `stub: true`. Compare by the `summary`. Same thing: post the stub card with `adds_to` and `duplicate: true`, summary one line on where it came up, and say in the reply that a thread already exists. Close (the existing stub's work would naturally cover it with a small addition) and `takes_additions` true: post with `adds_to`, summary saying what to add and what this thread knows. Otherwise post a new stub as today; if a related stub exists, name it in the summary. On a refusal from the hub for an addition, post a new stub naming the related one. Exempt: the two-part follow-up stub, a missed-merge stub, and any stub needing `depends_on_parent: true` or `commits`; these are always new.
- **On `[wc:from app] [stub addition from thread …]`**: post a `question` card "Another thread added this to your work: <summary>. Take it in?" with options "Take it in" (before IDEA.md is confirmed: add an idea bullet; after: their press is agreement to the scope change, log `idea-change`, fold into the plan), "Make it its own thread" (post a `stub` with the text, no `adds_to`), "Drop it" (nothing). It waits its turn like any question card. A `stub duplicate note` gets no card and no action.
`protocol/app/cards-lead.md` `stub` section documents `adds_to`, `duplicate`, the refusals above and the parent card's look, and drops the "same CLI" claim MAP.md shows is false.

### Non-goals
Merging existing duplicates; threads Collin starts directly; other projects or machines; editing or removing an addition after it is posted.

### Validation
- `cd viewer && npm test` passes, with new tests in `viewer/test/app-lead-list.test.js` (unopened candidate listed with `lead: null`, `stub`, `summary`, `takes_additions`; archived, frozen, done and other-project stubs excluded; non-stub entries unchanged) and `viewer/test/app-hub.test.js` (addition to an unopened stub appends context and creates no thread; addition to an opened planning stub with a live lead queues the app message; each refusal in 2; duplicate note accepted on a building stub; `adds_to` with `depends_on_parent: true` or `commits` refused by `card.js` validation).
- `cd viewer && npm run test:browser` passes, with a case in `viewer/test/app-threads.spec.js` showing the parent card heading and "Go to it" link for an addition.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| 1 | Hold an addition for an opened stub whose lead isn't running, and deliver it to the next lead | Without it the agent makes its own stub, as today | planning | Reuse held cross-thread delivery from thread f4c68e8cbb15 if merged; restart context would list undelivered `stub_additions` |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- 2026-11-21: Overlap check with f4c68e8cbb15 (Make lead-to-lead chat solid): its lead says it does not change listLeads or its output; it changes cross-thread delivery. No clash; not an overlap for this plan.
