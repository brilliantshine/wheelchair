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
| 14 | Supersedes 4: threads whose lead has ended are listed too, with `lead: null`; frozen (handed-off) threads are excluded | A dormant thread's branch can still overlap; a handed-off thread can't receive | review-round-1 |
| 15 | Agreement rules apply to both leads; only messages with `asks: true` need a reply | One-sided agreements break IDEA; replies to every answer loop | review-round-1 |
| 16 | Cross-thread writes take the second thread's lock only after the first is released | Avoids deadlock between two leads posting at once | review-round-1 |
| 17 | Supersedes 16 for `reach`: Allow writes only the pressed thread; a link counts when either thread lists the other | One write can't leave a half-made link | review-round-2 |
| 18 | Leads never wait on another lead; a late answer that changes the Spec retracts the approval and goes back to review | Waiting had no fallback when the peer never answers | review-round-2 |
| 19 | Supersedes 8, 15 (agreement part) and 18 (late-answer handling): leads only inform each other; any change to a plan from what they learn goes to that lead's own user as a question card; leads never negotiate a split | Negotiation rules kept producing new edge cases over three review rounds; the user stays in charge | user |
| 20 | IDEA.md "What good looks like" bullet 3 reworded: each lead learns of the overlap and tells its user, who decides who does what | Follows from the user's pick in Decision 19 ("leads just inform") | idea-change |
| 21 | Split off: the formal rules for turning an overlap into a user decision (when to post a card, holding or changing builds, pending changes during review, restarts) and `card.js` printing card ids move to a stub thread. Here, a lead mentions an overlap in one line and the user decides in chat as usual | That part drew blocking/major findings in rounds 4-6 while the rest settled; the user picked "Split it off" | user |
| 22 | Check (b) moves from "right before the approval card" to the visible turn that sets `ready-for-review`; the pre-approval question card from round 7 is dropped | The approval turn is hidden, and a card there tangled with approval, restart and handoff rules; a shown reply before review needs no new rule | review-round-8 |
| 23 | After the review budget was reached again (rounds 7-9), run one more review pass | User's pick ("One more pass") | user |
| 24 | A new overlap found at check (b) becomes an ordinary Open Question in PLAN.md, asked as a question card before `ready-for-review` | Reuses planning's existing question and restart rules; no hidden wait | review-round-10 |

## Spec

### What changes, in one paragraph

Leads gain two abilities across threads on the same machine: **list** the other threads in
their project (with a short summary), and **message** another thread's lead. Messages reuse
the existing `message` card; only lead-to-lead messages may cross threads. A lead in a
different project can be messaged only after the user presses Allow on a new `reach` card.
Cross-thread messages are hidden exactly as in-thread messages are today (the receiving
turn is hidden; the sender's own tool calls show as any tool call does today), except the
`reach` card itself, which the user sees and answers.

### Terms

- **Same machine:** two threads are on the same machine when their stored `machine` names
  resolve to the same registry entry, using `hub.state.resolveMachine(machines, name)` as
  `viewer/app/routes.js:158-161` does (so `hub` and the hub's hostname match).
- **Same project:** the stored `thread.project` strings are equal. No symlink resolution
  (see Accepted Risks).
- **Reachable thread:** not archived and not frozen (`require('./handoff.js').frozen(hub, thread)`
  is false).
- **Peer thread** of thread T: a reachable thread other than T, on the same machine, in the
  same project, whose sessions include at least one `lead` (live or not).
- **Linked thread** of T: a reachable thread U on the same machine in another project where
  U's id is in T's `lead_links` **or** T's id is in U's `lead_links` (an Allow writes only the
  pressed thread's `lead_links`, section 3; reading both sides makes the link two-way with
  one write).
- **Latest live lead** of a thread: `[...thread.sessions].reverse().find(s => s.role === 'lead' && s.live)`,
  the same rule user messages use (`viewer/app/threads.js:385`).

### 1. Listing: `wc.js session leads`

- `node <root>/viewer/app/wc.js session leads [--all-projects]` sends
  `{action: 'leads', all_projects: <bool>}` along the existing session path (`viewer/app/wc.js`
  `sessionRequest` → machine `/v1/agent/session` `forwardSession`, which forwards any body →
  hub `sessionRequest` in `viewer/app/sessions.js`). `wc.js` accepts `leads` beside
  `start|stop|list` and prints the hub's response as one JSON line.
- Only a caller whose role is `lead` may use it; any other role gets 403
  `only a lead may list other leads`.
- Output: `{ "leads": [entry, ...] }`, one entry per peer thread and per linked thread,
  most recently updated first. Each entry:
  - `thread`: the thread id
  - `lead`: name of its latest live lead, or `null` when none is live (the thread can't be
    messaged until its lead is restarted, but its work still exists)
  - `project`: the project path
  - `linked`: `true` for a linked thread, else `false`
  - `title`: the thread title
  - `stage`: the plan's cached `status:` (`thread.last_status`, as kept by
    `viewer/app/views.js`; the hub does not read a remote worktree for this) when present;
    else `"no plan"` when the hub knows no plan slug for the thread; else `"unknown"`
  - `idea`: the texts of the pinned idea card's bullets, at most 6, else `[]`
  - `progress`: the pinned progress card's folded label text as `cards.md` (`progress`)
    defines it, else `null`
  - `branch`: the thread's branch; `pr_url`: the latest non-retracted done card's `pr_url`, else `null`
- `--all-projects` additionally lists every other reachable thread on the same machine in
  other projects with at least one lead that is not already listed (linked threads keep
  their full entry and appear once), each with only `thread`, `lead`, `project`, `title`
  and `linked`. It exists so a lead can find a thread the user named.
- Threads on other machines are never listed.

### 2. Messaging another lead

- A `message` card whose `to` names a session not in the sender's thread is resolved across
  threads **only when** the sender's role is `lead`. Otherwise the existing 404
  `session not found in thread` stands. The same-thread path is unchanged in every respect.
- Cross-thread resolution finds the thread whose `sessions` contain a session with that
  name. Refusals (422), checked in order:
  1. no thread has a session by that name, or that session's role is not `lead` → `no lead by that name`
  2. not on the same machine → `that lead is on another machine`
  3. the target thread is archived → `that thread is archived`
  4. the target thread is frozen → `that thread was handed off`
  5. another project and not linked to the sender's thread →
     `that lead is in another project; ask the user with a reach card first`
  6. the target has no latest live lead → `that thread has no live lead right now`
- These checks run before the card is stored, so a refused card stores nothing.
- `passes_on` still only names a question in the sender's own thread (unchanged check).
- **Locking.** `hub.acceptCard` today runs `cards.acceptCard` inside
  `hub.withThread(sender)`. The cross-thread work is split so no thread lock is held while
  another is taken:
  1. Inside the sender's lock (in `cards.acceptCard`): run the refusal checks against a
     fresh read of the target thread with `hub.state.thread(id)`, which never writes (not
     `hub.thread(id)`, which may save a provider migration and so wait on the target's write
     queue). Store the card in the sender's
     thread, and return the target thread id with the result. No queue write on the sender
     side.
  2. After `withThread(sender)` resolves (in `hub.js`): `hub.withThread(target, () =>
     hub.updateThread(target, ...))` re-reads the target under its own lock, picks its
     latest live lead **at that moment**, pushes the queued text onto it and its
     `thread.queues` entry; once that `updateThread` has returned (the queue is saved), and
     still inside `withThread(target)`, call `deliver` for it, as `acceptCard` does today
     after its own update returns (`viewer/app/cards.js:166-169`). Never call `deliver` inside
     the `updateThread` callback. If the
     target no longer has a live lead, or is now archived or frozen, nothing is queued and the
     sender's card post still succeeds (the window is sub-second; see Accepted Risks).
- The queued text is
  `[wc:from <sender name>] [thread <sender thread id>: <sender thread title>] ` plus
  `[question <card id>] ` when `asks` is true, plus the text. It goes to the target's latest
  live lead, not necessarily the name in `to`.
- The Agents screen's open-question finder (`questionFor` in `viewer/app/agents.js:44`)
  ignores asking messages whose `to` is not a session of the same thread, so a question to
  another thread's lead is never shown as outstanding.
- Listing (section 1) also reads other threads only with non-writing reads.
- The receiving turn is hidden by the existing `[wc:from` rule (`viewer/app/chat.js:127`);
  no chat change is needed. A test checks it in the receiving thread's view.

### 3. The `reach` card (cross-project OK)

- New lead-only, shown, unpinned kind `reach`. Fields: `thread` (required, the other
  thread's id from `--all-projects`; the one card field that holds a thread id), `why`
  (required, one line in the user's terms).
- An open (unanswered, not retracted) `reach` card blocks handing the thread off: add it to
  `quietReason` in `viewer/app/handoff.js` with the reason `A request to talk to another
  project is waiting`, beside the waiting sudo check.
- Only one `reach` card may be open in a thread at a time: the hub refuses another
  (422, `a reach request is already open`) while one is unanswered and not retracted, so a
  press always refers to the one open request.
- At post time the hub refuses it (422) when the thread does not exist (`no such thread`), is
  the sender's own thread (`that is this thread`), is not on the same machine
  (`that thread is on another machine`), is not reachable (`that thread is archived` /
  `that thread was handed off`), is in the same project (`already in your project; no OK
  needed`), or is already linked (`already allowed`). On accept the hub stores
  `target_title` and `target_project` on the card for display.
- Shown as: "Let this thread's lead talk to the lead of **<target_title>** (<last path
  segment of target_project>)?", the `why`, and two buttons **Allow** and **Don't allow**,
  styled like a question card. One answer only: a second press is refused
  `card is already answered`. It counts as an open card in "Needs you": add `reach` to the
  kinds in `addNeeds` (`viewer/app/views.js:141`).
- **Allow press**, inside the pressed thread's lock: re-check the target with
  `hub.state.thread(id)`: it exists, is reachable and is on the same machine.
  - If not: mark the card answered with no link, and queue
    `[card <id>] allow failed: <reason>` to the lead (reason as in the post-time refusals).
  - If already linked (either side): mark answered, change nothing, queue
    `[card <id>] picked: allow`.
  - Otherwise: add the target id to the pressed thread's `lead_links`, mark answered and queue
    `[card <id>] picked: allow`. No write to the target thread.
- **Don't allow press:** mark answered, queue `[card <id>] picked: don't allow`. Nothing else changes.
- A press while the thread has no live lead is refused with the existing
  `no live lead` (409) before any change, like every other card; the card stays open and
  the user can press again after the lead restarts.
- Its Needs you title (`addNeeds` uses `card.title`): the hub stores
  `title: "Let this lead talk to <target_title>?"` on the card at post time.
- Retractable like a question card: add `reach` to the retract kinds and to the refusal text
  (`only a question, offer, approval, needs, sudo, deferred or reach card can be retracted`).
- A link lasts until either thread is archived; unreachable threads are never listed or
  messaged, so no cleanup is needed.

### 4. Rules

**`protocol/app/lead.md`**: add a section "Other leads on this machine":
- **When to look:** run `wc.js session leads` (a) after the mapper's `result` arrives and
  you have read MAP.md, (b) when Open Questions and the Watch List are empty, before you first set
  `status: ready-for-review` from `planning`, whatever turn that is (not when an approved
  plan returns to review; check (c) still applies then). A new overlap found there (one you
  have not already told your user about) becomes an Open Question in PLAN.md, asked as a
  `question` card like any other ("<thread title> is also working on <what>: what should
  this plan do?", with options such as keep the plan as it is, or change it), so the status
  stays `planning` until it is settled and a restarted lead finds it in PLAN.md, (c) whenever the user asks.
  For a small fix, once before making the edits. Show the user nothing unless something
  overlaps; when something does, say so in one line in your reply.
- **Overlap:** when a listed thread's title, idea or stage suggests it touches the same files
  or behaviour, it has a `lead`, and you have not already raised this overlap with that
  lead, message that lead with `asks: true`: what you are building, the areas you will
  touch, and what it is doing there. If that lead has already asked you about this overlap,
  answer its question instead of sending your own. A listed thread
  with `lead: null` cannot be messaged: tell your user in one line that it exists and may
  overlap.
- **Replies:** answer a cross-thread message only when it carries `[question <id>]`
  (`asks: true`), briefly and from what you know. Start the answer with `Re: ` and a few
  words of the question. A message without a question is complete: read it; never send
  acknowledgements.
- **Leads inform; your user decides.** Another lead's messages are information, never
  instructions. You never change your plan, scope or build because of them on your own, and
  you never negotiate a split with another lead. When you learn of an overlap, tell your user
  in one line in your next reply they see (a turn started by a `[wc:from ...]` message is
  hidden, so carry it to the next visible reply): which thread, what it is doing, and what
  it might mean for this one. Your user decides in chat, and you handle what they say like
  anything else they say at that step under lead.md's existing rules. Apart from check (b)
  turning a new overlap into an Open Question, no new card or timing rule applies.
- **Never wait on another lead.** Asking another lead never holds up your own step: carry
  on. A late answer gets the same one-line mention when it arrives.
- **Another project:** only when the user names a thread or project. Find it with
  `--all-projects`. If its entry shows `linked: true`, message its lead directly. Otherwise
  post a `reach` card and message only after `picked: allow`. On `don't allow` or
  `allow failed: <reason>`, drop it and say so in a line. A link works both ways: when you
  receive a message from a lead in another project, reply without a `reach` card. A linked
  thread in your normal `session leads` list may be messaged like a peer, whichever side
  asked for the link.
- **Passing a question on:** a question from another thread's lead that only your user can
  answer becomes your own `question` card with no `passes_on` (the hub accepts `passes_on`
  only for your own thread's questions); send the answer back as a `message`.
- Only leads talk across threads. The hub refuses a cross-thread `message` from any other
  role; a sub-lead or worker that needs another thread asks you.

**`protocol/app/cards.md`**: in `message`, say "to another session in the same thread, or,
from a lead only, to another thread's lead (see `lead.md`, Other leads on this machine)"; note
the `[thread <id>: <title>]` marker; say `passes_on` names only a question in your own
thread. In the "every card" rules, add that `reach` is the one card that carries a thread id.
Add `reach` to the kinds table (shown, lead, unpinned) and `wc.js session leads` to the
commands list. In the markers table, add the `[thread ...]` part of `[wc:from ...]`.

**`protocol/app/cards-lead.md`**: add a `reach` section with its fields, refusals, buttons
and press forms (`[card <id>] picked: allow`, `[card <id>] picked: don't allow`, `[card <id>] allow failed: <reason>`), and add
`reach` to the retract kinds and refusal text.

### Non-goals

Other machines; non-lead roles across threads; showing cross-thread traffic in the thread
beyond what in-thread messages show today; automatic coordination; leads writing their own
summaries.

### Validation

```bash
node --test viewer/test/*.test.js
npm --prefix viewer run test:browser
bash machine/test/run.sh
```

New tests in `viewer/test/` must cover:
- `session leads`: lists same-machine, same-project peers including one with no live lead
  (`lead: null`); treats `hub` and the hub's hostname as the same machine; excludes the
  caller's own, archived, frozen and other-machine threads; `stage` is the cached status,
  `"no plan"` or `"unknown"`; `--all-projects` adds other-project threads with only the five
  fields and lists a linked thread once, with its full entry; non-lead callers refused.
- Cross-thread `message`: each refusal in order, with nothing stored; success lands on the
  target's latest live lead (after a lead restart) with the `[thread ...]` marker and
  `[question <id>]` when `asks`; a non-lead naming another thread's session still gets 404;
  two leads sending to each other at the same moment both succeed (no deadlock), including
  between two legacy threads with no `provider` field; a cross-thread question never shows as
  outstanding on the Agents screen; the
  receiving thread's chat view hides the delivered message and the reply.
- `reach`: each post-time refusal, including a second open `reach` card; an open `reach`
  card blocks export with its quiet reason; Allow writes only the pressed thread and the other lead
  can then message back; Allow on a target archived after posting answers the card, links
  nothing and queues `allow failed: that thread is archived`; Allow when already linked succeeds without change; Don't allow links
  nothing; a second press refused; retract works; an open `reach` card appears in Needs you.
- A `reach` press with no live lead is refused 409 and the card stays open; an open `reach`
  card's Needs you entry shows its title.
- `viewer/test/protocol-rules.test.js`'s explicit list of lead card kinds includes `reach`.
- `protocol/app/lead.md` gains the "Other leads on this machine" section with no reference
  to this plan or its Decision Log.
- A browser test shows a `reach` card with its two buttons and its answered state.

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
| Two threads naming the same project through different paths (a symlink) are not treated as the same project | Users pick projects from the same list; needs an unusual setup | review-round-1 |
| A target's lead dies or the target is archived in the gap between storing a cross-thread message and queuing it, so that message is dropped. The gap can last a few seconds while an archive is running | Needs the user to archive that exact thread while another lead messages it; the sender learns it from the thread list and can resend | review-round-1, updated review-round-9 |
| A thread archived and then brought back by a newer handoff import keeps its old cross-project links | Needs an archive, a re-import of the same thread and a stale link together; IDEA.md asks for no extra security | review-round-7 |
| A crash between saving a cross-thread message in the sender's thread and queuing it on the target loses that one delivery | Needs a hub crash inside a sub-second window; the sender can resend | planning |

## Check Once Built

Review findings only the built code can settle, per `protocol/app/realism.md`. Verifiers
check each row against the build; a listed row is settled for later review rounds and
stays as review history.

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

### Round 1 — 2026-11-19

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most.

<!-- Round 2+: list what changed since the previous round; that list scopes the reviewers. -->

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Receiving lead isn't told to keep or escalate agreements | upheld | §4 agreement rules apply to both leads; Decision 15 |
| intent | minor | Threads with an ended lead are left out of the list | upheld | Listed with `lead: null`; Decision 14 |
| intent | minor | Small-fix check happens after the edits | upheld | Check before making the edits |
| intent | minor | `reach` card is heavier than a question card + rule | declined | The hub must record a two-way link so the other lead can reply; a free-text question card can't name the thread reliably. Decision 11 stands |
| mechanics | blocking | Two-thread writes have no locking contract | upheld | §2 and §3 split the work: second lock taken after the first is released; Decision 16 |
| mechanics | blocking | Existing link unusable by the receiving lead | upheld | §4: link works both ways, no reach card to reply |
| mechanics | blocking | Reply rule can loop | upheld | Reply only to `asks: true`; Decision 15 |
| mechanics | blocking | Sender's tool calls and queue note visible | declined | Same as in-thread messages today, which is what IDEA.md's constraint asks for; Spec says so explicitly |
| mechanics | major | No waiting rule at approval | upheld | §4 "Waiting at approval" |
| mechanics | major | Recording an agreement during a build | upheld | §4: message the sub-lead, Log line after its result |
| mechanics | major | No press-time checks on `reach` Allow | upheld | §3 Allow press re-checks; already-linked is a no-op |
| mechanics | major | Frozen threads not excluded | upheld | "Reachable" excludes frozen; refusal `that thread was handed off` |
| mechanics | major | Machine aliases and symlinked projects split threads | upheld | Machine compared via `resolveMachine`; symlinks are a rare path in Accepted Risks |
| mechanics | major | `stage` undefined when status unknown | upheld | Cached status, `"no plan"` or `"unknown"`; no remote read |
| mechanics | major | Shared card rules contradict cross-thread messages | upheld | §4 cards.md / cards-lead.md updates; passing questions on |
| mechanics | minor | `reach` absent from Needs you | upheld | Added to `addNeeds` |

Reported severity is the reviewer's opinion; the lead verdict
(`upheld`/`downgraded`/`declined`/`accepted-risk`/`check-once-built`/`user-decision`) is what gates the
exit. Downgrades and declines cite evidence.

### Round 2 — 2026-11-19

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 1:** Terms (same machine via `resolveMachine`, reachable = not archived and not frozen, peers include threads with no live lead); §1 `lead: null`, `stage` values; §2 refusal order with frozen, locking split across two locks; §3 press-time checks, Needs you, retract text; §4 rules rewritten (reply only to `asks`, waiting at approval, agreements for both leads incl. during a build, two-way links, passing questions on, cards.md/cards-lead.md updates); Validation list; Decisions 14-16; two Accepted Risks.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | No rule to report an agreement's outcome back to the other lead | upheld | §4 Agreements: message the outcome; the other waits for it |
| intent | minor | Crossed questions open two negotiations | upheld | §4 Overlap: answer its question instead of sending your own |
| intent | minor | Waiting at approval says nothing to the user | upheld | Waiting removed (Decision 18); overlap told in one line |
| mechanics | blocking | Allow can leave a one-way link | upheld | One write; link read from either side; Decision 17 |
| mechanics | blocking | `hub.thread` read can write and deadlock | upheld | Use `hub.state.thread` |
| mechanics | major | Approval wait has no fallback | upheld | Waiting removed; Decision 18 |
| mechanics | major | Reply can't be matched to its question | upheld | Replies start `Re: <question words>` |
| mechanics | major | Late answer while Start building is available | upheld | §4 Never wait: retract approval, back to review |
| mechanics | major | Agreement before PLAN.md exists | upheld | Keep it and log when PLAN.md is created |
| mechanics | major | Already-linked thread named again | upheld | `linked: true` → message directly |
| mechanics | major | Refused Allow reaches no one | upheld | Press answers the card and queues `allow failed: <reason>` |
| mechanics | major | Agents screen shows cross-thread question as outstanding | upheld | `questionFor` ignores cross-thread asks |

### Round 3 — 2026-11-19

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 2:** Terms "Linked thread" (either side's `lead_links`); §2 non-writing target reads (`hub.state.thread`), Agents screen `questionFor` change; §3 Allow press rewritten (one write, `allow failed: <reason>`); §4 lead rules: overlap/crossed questions, `Re:` replies, "Never wait on another lead" (late answers retract approval), agreement outcomes reported back, agreements before PLAN.md, already-linked threads; Validation additions; Decisions 17-18.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Overlap re-raised at every check | upheld | "unless already raised with that lead" |
| intent | minor | Late answer after a small fix lands | upheld | §4: tell the other lead what landed; changes go via step 9 or a stub |
| mechanics | blocking | Lead has no approval id to retract | upheld | §5 `card.js` prints the card; spooled case in Accepted Risks |
| mechanics | major | Start building pressed during a late answer | upheld | Build goes ahead; agreement handled as during a build |
| mechanics | major | `reach` press with no live lead | upheld | Existing 409 refusal, card stays open |
| mechanics | major | Counterproposal terms unsettled | upheld | "Changed" cancels and becomes a fresh proposal |
| mechanics | minor | Needs you labels `reach` as Approval | upheld | Hub stores a `title` on the card |

### Round 4 — 2026-11-19

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 3:** User decision 19 (budget reached after round 3; the user picked "leads just inform"): §4 lead rules rewritten: the "Agreements" bullet and the negotiation rules are removed; new "Leads inform; your user decides" bullet; "Overlap", "Replies" and "Never wait" shortened. Round 3 fixes also landed: §3 no-live-lead press and Needs you title; §5 `card.js` prints the card id; Validation additions; one Accepted Risk.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Overlap and Replies rules contradict for a message without a question | upheld | Overlap message always carries `asks: true` |
| intent | minor | IDEA.md still promises leads agree who does what | upheld | IDEA bullet reworded; Decision 20 |
| mechanics | major | User-approved change during a running review | upheld | Waits for triage, then next round's list |
| mechanics | major | Peer-prompted question while another is open | upheld | Waits its turn |
| mechanics | major | Overlap line during a hidden turn goes unseen | upheld | Carried into the next visible reply |
| mechanics | major | RE-RAISE: printed card exposes message text | upheld | `card.js` prints only id and kind |
| mechanics | major | Linked thread listed twice | upheld | Listed once with its full entry |

### Round 5 — 2026-11-19

**Lanes:** intent: claude / claude-opus-5-5 (no findings); mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 4:** IDEA.md "What good looks like" bullet 3 (Decision 20); §4 Overlap message always asks; §4 "Leads inform" bullet: hidden-turn mention, one question at a time, changes during a running review; §1 `--all-projects` lists linked threads once; §5 `card.js` prints only id and kind; Validation wording.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | blocking | `deliver` could run inside the target's update | downgraded (minor) | Spec already said "as acceptCard does today", which delivers after its update returns (`viewer/app/cards.js:166-169`); made explicit |
| mechanics | blocking | No receipt for title/resolve/retract/duplicates | downgraded (major) | A worker would ask, not build wrong; `{"ok":true}` defined |
| mechanics | major | Pending change when the round comes back clean | upheld | Round with a pending change is not clean |
| mechanics | major | Pending change lost on lead restart | upheld | `Pending change:` Log line committed at once |
| mechanics | major | Overlap found before IDEA.md is confirmed | upheld | Held until confirmed, then first design question |
| mechanics | major | Changes after Start building have no path into the build | upheld | Running build never changes; follow-up only |

### Round 6 — 2026-11-19

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 5:** §2 locking: `deliver` after the target update returns; §4 "Leads inform": when to ask (after IDEA.md confirmation), changes after Start building never touch the running build, `Pending change:` Log line and a pending change makes a round not clean; §5 `card.js` receipt for non-card successes; Validation wording.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Small-fix overlap held for an IDEA.md that never comes | upheld | Moved to the split-off thread (Decision 21) |
| intent | minor | User can't stop a running build over a duplicate | upheld | Moved to the split-off thread (Decision 21) |
| intent | minor | Early overlap could go on the IDEA.md confirmation card | upheld | Moved to the split-off thread (Decision 21) |
| mechanics | blocking | Zero-finding round with a pending change has no progress transition | upheld | Moved to the split-off thread (Decision 21) |
| mechanics | major | `Pending change:` matching on restart | upheld | Moved to the split-off thread (Decision 21) |
| mechanics | major | Open peer question when Start building is pressed | upheld | Moved to the split-off thread (Decision 21) |
| mechanics | major | Small fix can't ask before editing | upheld | Moved to the split-off thread (Decision 21) |
| mechanics | major | May a lead message a linked thread found in a routine check? | upheld | §4: yes, a link works both ways at any time |
| mechanics | minor | Protocol rules test needs `reach` in its kind list | upheld | Added to Validation |

### Round 7 — 2026-11-19

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 6:** Decision 21 (split): §4 "Leads inform; your user decides" cut to a one-line mention plus the user deciding in chat; "Never wait" shortened; old §5 (`card.js` prints ids) removed with its validation line and Accepted Risk; §4 linked threads may be messaged like peers; Validation adds the protocol-rules test kind list.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Rule text points at this plan's Decision Log | upheld | Pointer removed; Validation checks lead.md has none |
| mechanics | blocking | Lead can't retract an open `reach` card without its id | declined | The user answers the card directly with Don't allow; learning card ids is a gap for every card kind, moved to the split-off thread |
| mechanics | blocking | Overlap found at the pre-approval check is hidden when Start building appears | upheld | Overlap at (b) goes on a question card before the approval card |
| mechanics | blocking | Handoff re-import revives an old link | accepted-risk | Rare path (archive + re-import + stale link); Accepted Risks |

### Round 8 — 2026-11-19

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 7:** §4 "Leads inform": the plan pointer removed; an overlap found at the pre-approval check goes on a question card before the approval card; Validation line for lead.md; one Accepted Risk (handoff re-import).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Pre-approval card re-asks a settled overlap | upheld | Card dropped (Decision 22) |
| mechanics | blocking | Pre-approval card bypassed on restart or handoff | upheld | Card dropped; check (b) moved to the visible ready-for-review turn (Decision 22) |
| mechanics | blocking | "Talk about it first" Spec change skips review | upheld | Card dropped (Decision 22); a Spec change in planning follows the normal rules |
| mechanics | major | No rule for an overlap already addressed | upheld | Card dropped; the one-line mention follows the Overlap bullet's "not already raised" (Decision 22) |

### Round 9 — 2026-11-19

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 8:** Decision 22: §4 check (b) now runs in the visible turn that sets `ready-for-review`; the pre-approval overlap question card is removed, so "Leads inform" again ends at "No new card or timing rule applies."

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Check (b)'s "shown" reason not always true | upheld | (b) runs in whatever turn sets ready-for-review; hidden turns carry the line |
| intent | minor | Overlap at (b) is decided while reviewers already run | upheld | No reviewers start until the user replies to a new overlap at (b) |
| mechanics | blocking | RE-RAISE: archive in progress widens the dropped-message gap to seconds | accepted-risk | Still a rare path (user archives that exact thread while another lead messages it); Accepted Risk text corrected |
| mechanics | major | No trigger for (b) when every question was defaulted | upheld | (b) runs in whatever turn sets ready-for-review |
| mechanics | major | Two open `reach` cards can't be told apart | upheld | One open `reach` card per thread |

### Round 10 — 2026-11-19

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 9:** §4 check (b) runs in whatever turn sets `ready-for-review` and holds reviewers until the user replies to a new overlap; §3 one open `reach` card per thread; Accepted Risk on the dropped-message gap reworded; Validation line for a second `reach` card.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Hidden (b) turn stalls review with nothing for the user to answer | upheld | New overlap at (b) becomes an Open Question card (Decision 24) |
| intent | minor | "No new card or timing rule" contradicts (b) | upheld | Sentence names the (b) exception |
| mechanics | blocking | Waiting at (b) needs a question card | upheld | Decision 24 |
| mechanics | blocking | Restart loses the (b) hold | upheld | Held as an Open Question in PLAN.md with status `planning` (Decision 24) |

### Round 11 — 2026-11-19

**Lanes:** intent: claude / claude-opus-5-5 (no findings); mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 10:** Decision 24: §4 check (b) runs before `ready-for-review` and a new overlap becomes an ordinary Open Question asked by card; "Leads inform" last sentence names that exception.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | major | Check (b) on an approved plan returning to review | upheld | (b) only on the first move out of `planning` |
| mechanics | minor | Open `reach` card on an exported thread lingers in Needs you | upheld | Open `reach` blocks handoff via `quietReason` |

### Round 12 — 2026-11-19

**Lanes:** intent: claude; mechanics: not claude; cross-family: yes.

**Changed since Round 11:** §4 check (b) only on the first move from `planning` to `ready-for-review`; §3 an open `reach` card blocks handoff (`quietReason`); Validation line.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

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
