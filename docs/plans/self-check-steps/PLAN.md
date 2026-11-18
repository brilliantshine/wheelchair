---
slug: self-check-steps
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-18
---

# Check-it-yourself steps after Done

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

None.

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
| 1 | Plan mode: thorough | Collin's pick on the mode card | user |
| 2 | Steps fit the change, phone first: a change visible in the app gets steps done in the app on a phone; only a change with nothing to see there (scripts, machine service, protocol docs) gets commands to run on the machine | Most changes show in the app; the rest can only be checked by running something | user |
| 3 | The steps are a card of their own, posted right after the done card, not a section of it | Easier to spot and lays out step by step; Collin picked it over the leaning (part of Done) | user |
| 4 | An agent follows the steps before Collin sees them: a verifier tries each step and reports what it saw; the lead fixes any step that does not match | The point is not having to trust; untried steps would be one more thing to trust | user |
| 5 | The steps are for after Collin merges and updates; the card says so. Before merging he relies on the agent having tried them. A live preview of the branch is not part of this | Works for every project today; a preview is its own thread | user |
| 6 | Kind name `check`, not pinned, tied to its done card by `head` | A done card can be followed by fixes with their own done cards; `head` says which one a set of steps belongs to | defaulted |
| 7 | One combined verifier for small fixes and after-done fixes (it checks the fix and tries the steps); a separate steps verifier for a planned build, started by the lead after the sub-lead's result | Small paths already start one verifier; a planned build's verification is the sub-lead's and is finished by then | defaulted |
| 8 | A step that shows the work itself is wrong is fixed by the lead in the worktree, like an after-done fix, before any push | The sub-lead's result already handed the worktree back; restarting a sub-lead for one gap costs more than the fix | defaulted |
| 9 | A step no agent could try is still shown, marked "Not tried by an agent" with the reason | Hiding it loses a check Collin can still do; marking it keeps the card honest | defaulted |
| 10 | No buttons for "it worked" or "it didn't" on the check card; he reports a problem by typing in the thread as today | IDEA.md: not recording whether he did them | defaulted |

## Spec

### What Collin gets

Right after every accepted `done` card, the lead posts a `check` card: "Check it yourself".
It says first how to get the change running (merge, then how this project updates), then
gives numbered steps. Each step says where it is done (in the app, or on the machine), what
to do, and what he should see. Steps an agent followed say nothing extra; a step no agent
could try carries "Not tried by an agent" and the reason. All three done paths get one:
small fix, planned build, and a fix after done (whose steps cover only what that fix
changed). Steps are for after merging (Decision 5).

### Where the steps are done (Decision 2)

- A change Collin can see in an app (wheelchair's own app, or the project's) gets steps he
  follows there on his phone: what to open or tap, and what he should see.
- Only a change with nothing to see in an app (scripts, the machine service, protocol
  documents) gets commands to run on the machine, each with the output to look for.
- One card may mix both; app steps first.
- A protocol-only change (how agents behave) is checked by what he would see agents do in
  a thread, when that is observable; otherwise by a machine command (for example a `grep`
  of the rule in the installed file) with the line to look for. Machine commands point at
  the installed paths Collin will have after updating; the lead gives the verifier a path
  map from those paths to the worktree so it can try them.

### The `check` card

Lead-only, shown, not pinned, no presses. Fields:

| Field | Type | Required | Rule |
|---|---|---|---|
| `head` | string | yes | 40-char lowercase hex. Must equal the `head` of the most recent `done` card in the thread (done cards are never replaced or retracted: `viewer/app/cards.js:9,22-31`, `viewer/app/card.js:224-233`); the hub refuses otherwise (422 `check head must match the latest done card`), refuses when the thread has no `done` card (422 `post the done card first`), and refuses a second check card for the same `head` (422 `this done card already has a check card`) |
| `update` | string | yes | How to get the merged change running, e.g. "Merge the pull request, then on the machine run `cd /home/collin/projects/personal/wheelchair && git pull && ./install.sh`". At most 300 chars |
| `steps` | array | yes | 1 to 6 items, each `{where, do, see, command?, tried, why_not?}` |

Each step:

| Field | Type | Required | Rule |
|---|---|---|---|
| `where` | `app` \| `machine` | yes | |
| `do` | string | yes | What to do, at most 300 chars |
| `see` | string | yes | What he should see if it worked, at most 300 chars |
| `command` | string | no | Only with `where: machine`; the exact command, full paths, at most 1000 chars; may span lines |
| `tried` | boolean | yes | true when an agent followed the step and saw `see` |
| `why_not` | string | when `tried` is false | Forbidden when `tried` is true. One line, at most 300 chars |

Unknown fields are refused, as for every kind. The card is posted through the normal
spooled path (not synchronous like `done`); the head and duplicate rules are checked at the
hub when the card is accepted (`viewer/app/cards.js` `acceptCard`, under the thread lock).
The duplicate rule makes posting idempotent: a lead that gets
`this done card already has a check card` treats it as posted.

No presses: `press` in `viewer/app/threads.js` refuses every action on a `check` card
(400 `a check card has no buttons`), before anything is marked answered or enqueued.

Rendering (`viewer/pages/thread.js` `renderCard`): heading "Check it yourself", the `update` text
(which says whether to merge first), then an ordered list. Each item shows a small label
"In the app" or "On the machine", the `do` text, the `command` in a monospace block with a
Copy button (hidden when `navigator.clipboard` is unavailable; copying never posts
anything), then "You should see:" and the `see` text. An untried step shows a muted line
"Not tried by an agent: <why_not>". All text is set as text, never HTML. It must read at
phone width (390px) without horizontal page scroll; a long command scrolls inside its own
block.

Other app touch points:
- `viewer/app/card.js`: add `check` to `shown`, `roles` (`['lead']`) and `fields`, with the
  rules above and the cross-field checks (`command` only with `machine`; `why_not` required
  iff `tried` is false).
- `viewer/app/handoff.js`: add `check` to `KINDS`; `historyText` returns the `update` line
  and one line per step: `<n>. [app|machine] <do> — see: <see>`, plus the command and
  "(not tried: <why_not>)" where present.
- `machine/service.js`: no change beyond what the generic card path already does (confirm
  `check` is spooled and forwarded like other shown kinds).
- `protocol/app/cards.md`: add `check` to the kinds table (shown, lead, not pinned).
- `protocol/app/cards-lead.md`: a `check` section with the fields, rendering summary and
  refusals.

### How the lead writes and tries the steps (`protocol/app/lead.md`)

**Writing.** The lead drafts 1 to 6 steps (usually 3 to 5; a sentence or two per field,
readable on a phone) from what the change is for: IDEA.md's "What good looks like" for a
planned build, Collin's request for a small fix, the reported problem for an after-done fix
(whose steps cover only what that fix changed). Steps follow "Where the steps are done".
Each `see` is something he can observe, not "it works". Commands use full paths and name
the output to look for. `update` says how this project picks up a merged change; when the
lead does not know, it says so plainly and gives its best guess marked as such. When the
done card is for an already merged pull request, `update` leaves out the merge.

When the lead drafts:
- Small fix and after-done fix: before starting the fix's verifier, so the draft goes in
  that verifier's brief.
- Planned build: after the sub-lead's `result` (sub-lead stopped as today).

**Trying (Decision 4).** Steps are tried by verifiers, reported as STEP lines (see the
verifier section). Which verifiers carry the steps:
- Small fix and after-done fix: the verifier the lead already starts gets the steps in the
  same brief ("check the fix, and try these steps"). One session, one report: the fix's
  verdict is handled first by today's rules; the STEP lines are used from the report whose
  verdict the lead acts on (a PASS, or the last report when Collin chose "push it as it
  is").
- Planned build: before setting `status: done`, the lead starts one **steps-only** verifier
  on the sub-lead's verified commit (`--not-provider <lead's provider>` when
  `review_families` is `both`, else no provider flag), briefed with the plan slug and the
  draft steps, and told it is steps-only. It posts no progress line.
- Every later verifier the lead starts before the next `done` (a repair or merge re-verify
  in "Making the pull request mergeable" 6 and 7, or a re-verify after a step showed the
  work wrong) also gets the current steps, and its STEP lines replace the earlier ones.
- Commits the lead does not verify (someone else's fast-forward, a done at a merged head
  with others' commits) keep the STEP results from the last verifier (Accepted Risks).

**Using the STEP lines.**
- `MATCH` → `tried: true`.
- `COULD NOT TRY` (including "ran a safe stand-in") → `tried: false`, `why_not` in
  Collin's words from the reason.
- Brief contents for any verifier carrying steps: the numbered steps, the path map for
  machine commands, and (for steps-only) the plan slug so it can judge intent.
- `DIFFERS (meets intent)`: the verifier judged that what it saw is what the Spec or
  request wants, so the step was worded wrong. The lead rewords the step; every reworded
  step is re-tried once by a fresh steps-only verifier on the same commit before it can be
  `tried: true`; still not matching → `tried: false`, `why_not` "an agent saw something
  different".
- Combined reports (small fix, after-done fix, and the repair and merge re-verifies): a
  step that shows the work is wrong is reported by the verifier as a `GAP` as well, so it
  goes through today's single fix loop and today's question (push as it is, or drop); the
  question below is not used there. If Collin chooses "push it as it is", the step is
  posted `tried: false`, `why_not` "an agent saw something different: <short>".
- Steps-only reports (planned build): `DIFFERS (work wrong)` → a gap (Decision 8). The lead fixes
  it in the worktree itself (no sub-lead or workers), commits, and starts a fresh verifier
  briefed with the Spec or request, the gap and all steps. If it still fails after two
  fix attempts, or the fix needs parallel workers, the lead posts a `question` card with
  two options: "Finish with that step marked" (the step is posted `tried: false`, `why_not`
  "an agent saw something different: <short>") and "Finish and start a follow-up thread"
  (the same, plus a `stub` with `depends_on_parent: true` naming the gap). Either way the
  thread then finishes as usual. Nothing is reverted on this path.
- A report missing a step's line: one fresh steps-only verifier tries just the missing
  steps; still missing → `tried: false`, `why_not` "an agent did not report on it". Two
  lines for one step: use the less favourable (DIFFERS (work wrong), DIFFERS (meets intent), COULD NOT TRY, MATCH).
- `VERDICT: BLOCKED` is a setup problem, as today: fix it and start a fresh verifier; not
  a failed attempt.
- A small fix Collin chose to drop (reverted, no `done`) gets no check card.

**Posting.** Immediately after a `done` card is accepted, post the `check` card with that
done card's `head` (including a done at a merged head other than the pushed commit). Order
in a two-part thread: `done`, then `check`, then the follow-up `stub`. The `check` card is
never a condition for `done`; `done` keeps its own gate unchanged.

**Restart.** After `[wc:context restart]`, the lead posts a missing check card only when
all of these hold: the latest `done` card in the conversation it was given has a `head`;
no `check` card has that `head`; and the local `HEAD` equals that `head`. Then it drafts
the steps and has them tried by a steps-only verifier on `HEAD` before posting (a
duplicate refusal means the original arrived; stop there). Otherwise it posts none for
that done card; the next `done` gets its own. A stub that missed the merge ("Making the
pull request mergeable" 4, exit 1) posts no check card.

**Imported threads.** No check card is posted on import.

### How the verifier tries steps (`protocol/app/verifier.md`)

A new section, used only when the brief includes check steps:
- **Remit.** A brief that says "steps only" asks only for the steps: do not verify the
  Spec. Otherwise check the work as today and also try the steps.
- Try each step against the commit being checked, in the throwaway worktree. Run any app in
  isolation, never against Collin's live apps, their data, or his other checkouts: find how
  this project starts its app from its own README, AGENTS/CLAUDE files, scripts and test
  helpers, and start it from the worktree on a free port (never 7374) with its own temporary
  data. For wheelchair this is what `viewer/test/helpers/server.js` does. App steps are
  followed in a headless browser at phone size (390×844), using the project's Playwright if
  it has one, otherwise any headless browser available on the machine.
- If the project gives no safe way to run its app in isolation (it needs real accounts,
  devices, paid services or its live data), report those steps COULD NOT TRY with that
  reason; do not improvise against live systems.
- Machine commands are run exactly as written unless they would touch Collin's live state
  or install system-wide. Reading Collin's installed copy counts as live state: it shows
  the old version until he merges. The brief may give a **path map** (for example
  `/home/collin/projects/personal/wheelchair` → the worktree); running a command with only
  those path prefixes swapped counts as running it as written, and can MATCH. Then you may run a safe stand-in, but the step is
  `COULD NOT TRY — ran a safe stand-in: <what>; saw <what>`, never MATCH. MATCH means the
  step was followed as written and showed what `see` says.
- A step that needs state the isolated app lacks (for example a thread at Done) may be set
  up in the isolated copy; if it cannot be, COULD NOT TRY with the reason.
- The `update` text is not run.
- **Report.** `COMMIT:` first as today. A steps-only report's verdict is `VERDICT: PASS`
  when every step has a line, or `VERDICT: BLOCKED`; it has no GAP lines. A combined report
  keeps today's verdict and GAP lines. Then exactly one line per step, numbered as in the
  brief: `STEP <n>: MATCH|DIFFERS (meets intent)|DIFFERS (work wrong)|COULD NOT TRY —
  <what it saw or why>`, judging "meets intent" against the Spec or request in the brief.
  In a combined report, every `DIFFERS (work wrong)` step also gets a GAP line.

### Non-goals

- No pass/fail buttons or tracking of whether he followed the steps (Decision 10).
- No preview of the unmerged branch (Decision 5).
- No change to the done card, its fields, its GitHub gate or "Making the pull request
  mergeable", beyond giving its verifiers the steps and posting `check` after `done`.
- No check cards posted on import. A thread finished before this ships gets none, except
  that a lead restarted in one may post one under the restart rule (harmless, and not
  worth telling apart).
- The sub-lead and worker protocols do not change.

### Edge cases

- Several done cards in one thread (fixes after done): each gets its own check card; older
  ones stay in the conversation unchanged.
- A `check` with a head matching an older, not latest, done card is refused; so is a second
  `check` for the same head.
- An archived or handed-off thread refuses `check` like any card.
- More than 6 steps seem needed: the lead picks the few that best show the change works
  from Collin's side; detail belongs to the verifier, not the card.
- Largest valid card (6 steps at the limits plus `update`) is about 12,000 characters of
  history text, under the handoff's 20,000-character entry limit; no truncation expected.

### Validation

- `cd viewer && npm test` passes, including new node tests:
  - `card.js` validation: accepts a valid card; refuses each missing required field,
    `command` with `where: app`, `why_not` with `tried: true`, missing `why_not` with
    `tried: false`, 0 or 7 steps, over-length fields, unknown
    fields, a non-lead role.
  - hub acceptance: refused with no done card; refused when `head` differs from the latest
    done; accepted when it matches; refused as a duplicate for the same head; accepted
    after a second done only with the second head.
  - press: every action on a `check` card is refused with 400 and leaves it unanswered and
    nothing enqueued.
  - handoff: a thread with a `check` card at the size limits exports, the file validates,
    and its `historyText` is untruncated and matches the format above.
- `cd viewer && npx playwright test` passes, including a new browser test: a posted check
  card renders the heading, the update text, numbered steps with "In the app"/"On the machine" labels, the command
  block with Copy, "You should see:", and the "Not tried by an agent" line; no buttons
  other than Copy; at 390px wide the page has no horizontal scroll.
- `grep -n "check" protocol/app/cards.md protocol/app/cards-lead.md protocol/app/lead.md protocol/app/verifier.md`
  shows the new kind row, its section, the lead's writing/trying/posting rules on all three
  done paths, the restart rule, and the verifier's steps section with the STEP format.

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them.

| Risk | Why accepted | Round |
|------|--------------|-------|
| In projects that cannot run their app in isolation, many app steps reach Collin marked "Not tried by an agent" | Trying them would mean touching live systems; the mark keeps the card honest and the steps are still useful to him | 1 |
| Commits the lead does not verify (someone else's fast-forward, a merged head with others' commits) keep the STEP results from the last verifier | lead.md already accepts those commits without re-verifying; re-trying steps for them would add a verifier the work itself does not get | 1 |
| A check card still queued when the thread is archived or handed off is refused and lost | Archive and handoff end the thread's work; the done card and PR remain | 1 |
| A delayed or restarted delivery can put other items between `done` and `check` in the conversation | The card names what it checks and the order is fixed when posting; rare and harmless | 1 |

## Review Rounds

### Round 1 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most.

<!-- Round 2+: list what changed since the previous round; that list scopes the reviewers. -->

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Verifier's try-the-steps rules only fit wheelchair; other projects' app steps would all be untried | upheld | Project-neutral isolation rule in the verifier section; COULD NOT TRY when no safe isolated run; accepted risk recorded |
| intent | minor | Limits (10 steps, 600/2000 chars) and writing rule ignore the phone constraint | upheld | 1–6 steps, usually 3–5; do/see 300, command 1000, update 300; brevity rule |
| intent | minor | Put steps in the plan so the sub-lead's verifier tries them; saves a session | declined | Steps describe what was actually built (labels, screens, output) and are written after it; plan-time steps would drift and turn wording mismatches into verification gaps. One extra session per feature is the cost of keeping the sub-lead protocol unchanged |
| intent | minor | Work-is-wrong branch turns steps into another gate; just mark and tell Collin | declined | A step showing the work is wrong is a defect found before push; shipping it marked contradicts IDEA's "not have to trust" and lead.md already fixes defects found before Done the same way. Adding a check is not replacing the automatic checks |
| intent | minor | "After you merge" and the update text are wrong when done is posted for an already merged PR | upheld | Optional `merged` flag; label "Already merged"; update leaves out the merge |
| intent | minor | Hub head check is unnecessary; "non-replaced" never applies to done | upheld (wording) | Wording fixed: done cards are never replaced or retracted. Hub check kept: it is small and stops a card attached to the wrong done |
| mechanics | blocking | Combined small-fix verifier gets steps drafted after it passes; one report per session | upheld | Lead drafts before starting the fix verifier; fix verdict handled first, STEP lines from the acted-on report |
| mechanics | blocking | Repairs/merges change code after steps were tried; restart may try an unverified tip | upheld | Every later verifier carries the steps and replaces STEP results; unverified commits carry results forward (accepted risk); restart only when HEAD equals the done head |
| mechanics | blocking | Restart backfills pre-release/legacy/pre-import dones | upheld | Restart eligibility: latest done in the given conversation, has head, no check for it, HEAD equals it; non-goal amended to allow the harmless old-thread case |
| mechanics | blocking | Crash between spool and accept can duplicate or lose a check | upheld | Hub refuses a second check per head and the lead treats it as posted; loss at archive/handoff accepted |
| mechanics | major | Ordering with two-part stub; timestamps can interleave | upheld | Order done, check, stub; interleaving accepted |
| mechanics | major | Finish path undefined when steps dropped, fix reverted, or parallel workers needed | upheld | No steps dropped or reverted on this path; question offers finish-with-step-marked or finish-plus-stub; dropped small fix gets no check |
| mechanics | major | Steps-only remit and incomplete STEP reports undefined | upheld | Steps-only remit and report format in verifier section; missing lines re-tried once, duplicates take the less favourable |
| mechanics | major | Safe stand-in commands could show as MATCH | upheld | Stand-in is COULD NOT TRY with what ran; MATCH only when followed as written |
| mechanics | major | Press API would accept presses on a check card | upheld | `press` refuses every action on check (400); test added |
| mechanics | minor | Check could exceed handoff's 20,000-char history entry | declined | With the round-1 limits the largest card is about 12,000 chars; edge case noted and the test exercises it |

Reported severity is the reviewer's opinion; the lead verdict
(`upheld`/`downgraded`/`declined`/`accepted-risk`/`user-decision`) is what gates the
exit. Downgrades and declines cite evidence.

### Round 2 — 2026-11-18

**Lanes:** intent: see table; mechanics: see table; cross-family: yes.

**Changed since Round 1:**
- Card limits tightened (1–6 steps; 300/300/1000/300 chars), optional `merged` flag and
  "Already merged" label.
- Hub refuses a duplicate check per head; `press` refuses all actions on check.
- Lead section rewritten: when steps are drafted per path, which verifiers carry them,
  how STEP lines are used (wording vs work-wrong, missing/duplicate lines), the
  finish question (no revert), posting order with the two-part stub, restart eligibility.
- Verifier section: project-neutral isolation, steps-only remit, stand-in rule, report
  format.
- New Accepted Risks (isolation-less projects, unverified commits, queued card lost at
  archive/handoff, interleaving); non-goals and edge cases amended; validation extended.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Machine steps reading installed state cannot pass before merge; DIFFERS from not-yet-merged has no rule | upheld | Reading the installed copy is live state; lead gives a path map (installed → worktree); a prefix-swapped run counts as written |
| intent | minor | Lead grades its own DIFFERS by rewriting `see` and posting tried | upheld | Verifier classifies DIFFERS (meets intent / work wrong); every reworded step is re-tried before `tried: true` |
| intent | minor | Two failure loops on combined paths | upheld | Combined reports also raise a GAP for work-wrong steps; today's loop and question apply; new question only for steps-only |
| intent | minor | `merged` flag only switches the eyebrow | upheld | Field and eyebrow removed; `update` says whether to merge |

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
