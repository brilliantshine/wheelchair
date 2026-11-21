---
slug: agent-lessons
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-21
---

# Agents save lessons learned

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is two-part | Collin's pick; learn what lessons are useful before hardening | user |
| 2 | A lesson reaches only agents of the type that saved it | Collin: an agent saves lessons only for its own type of agent | user |
| 3 | Lessons are shared across AIs; an agent may mark one as only for its own AI | Most lessons are about the job; a few are one AI's quirks | user |
| 4 | Shown in Settings › Behavior templates as one agent-written "Lessons learned" entry per agent type, marked apart from Collin's templates, editable with a warning | Collin: no new row per lesson; a template that can be edited but isn't recommended to | user |
| 5 | Bar for a lesson: cost real time and proven wrong (Collin's correction or a check failing twice for the same reason), recurs for that agent type across threads, one or two sentences | Collin picked "Cost + proof" | user |
| 6 | Lessons are their own always-on layer between wheelchair's role rules and Collin's in-use template; Collin's template wins where they disagree | Only one template per role is in use (`viewer/app/settings.js:131`); lessons must not replace it | defaulted |
| 7 | Lessons are stored by the hub with the other settings (`settings.json`, queued writes, `viewer/app/state.js:241`) and added to role layers at session start | One store every machine's agents get through role layers (`viewer/app/sessions.js:324`); works for every AI | defaulted |
| 8 | A lesson that conflicts with the rules or should always apply is not saved; the lead offers a stub for a protocol change instead | IDEA.md Not doing | defaulted |
| 9 | Running agents keep the lessons they started with | IDEA.md Not doing; prompts are a snapshot at start (`machine/service.js:781`) | defaulted |
| 10 | Lessons apply to all projects; an agent may mark one as only for the project it learned it in | Collin picked "All, unless marked" | user |
| 11 | Reviewer and verifier lessons are written by the lead, from what its triage of their findings and gaps shows; reviewers and verifiers never save lessons | Collin picked "Lead writes them": only the lead sees a reviewer's or verifier's mistake cost time | idea-change |
| 12 | Saving a lesson shows a one-line notice in the thread it came from (which agent type, the lesson text, link to Settings); it takes effect for agents started afterwards with no approval | Collin picked "A short notice" | user |
| 13 | Worker lessons are saved by workers themselves and by the sub-lead, from what it sees across worker tasks | Collin picked "Sub-lead too" | user |

## Spec

Lessons are short instructions that agents save for later agents of a given type. The hub
stores them with the other settings, adds the applicable ones to every agent's starting
instructions, shows a notice in the thread when one is saved, and lets Collin edit them in
Settings › Behavior templates.

### S1. What a lesson is (the bar)

An agent saves a lesson only when all of these hold (decision 5):

1. A mistake cost real time: an extra review round, a retried task, a redo, a failed check.
2. Something proved it wrong: Collin corrected it, or a check (review triage, verifier,
   tests) failed twice for the same reason.
3. It will come up again for the same type of agent in other threads.
4. It fits in one or two sentences, written as an instruction to that type of agent.

Not lessons: facts about one codebase (maps hold those), one-off bug fixes, decisions for
one thread (the Decision Log holds those), hunches, and anything the role rules already
say. A lesson that conflicts with the role rules, or that should always apply, is not
saved: the lead posts a `stub` proposing a protocol change instead; a sub-lead, worker or
mapper sends the lead a `message` suggesting one (decision 8).

Before saving, the agent reads the existing lessons in its instructions. If one already
covers the point or is now wrong, it replaces or removes that one instead of adding.

### S2. Who saves lessons for whom

| Saver | May save lessons for |
|---|---|
| lead | lead, reviewer, verifier |
| sub-lead | sub-lead, worker |
| worker | worker |
| mapper | mapper |

Reviewers and verifiers never save lessons (decisions 2, 11, 13). The lead writes a
reviewer or verifier lesson when its own triage or checks show a reviewer or verifier
mistake met the bar (for example, reviewers rating an extra question card as major,
declined across rounds). The sub-lead writes worker lessons from what it sees across
worker tasks. The hub refuses any other saver/target pair with
`a <saver> may not save lessons for <target>s`.

### S3. Storage

`settings.json` gains `lessons`, an object keyed by role (the six roles). Each value is an
array of lesson objects, oldest first:

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Hub-assigned, `L` + 6 lowercase hex, unique across all roles |
| `text` | string | 1–300 characters, one paragraph (no line breaks) |
| `provider` | string, optional | One of the `PROVIDERS` keys; the lesson reaches only agents on that AI (decision 3) |
| `project` | string, optional | A project path; the lesson reaches only agents in that project (decision 10) |
| `saved_by` | string | `agent` or `user`: who last wrote the text |
| `thread` | string, optional | The thread id it was last saved from by an agent |
| `saved_at` | string | ISO time of the last write |

At most **12 lessons per role**. `normalize()` in `viewer/app/settings.js` keeps only
well-formed entries for known roles (dropping bad ones, as it does for accounts) and
defaults `lessons` to `{}` keyed per role with empty arrays. All writes go through
`settings.update()` (the queued read-modify-write, `viewer/app/state.js:241`), so two
agents saving at once both land. `assertFits()` keeps checking only Collin's layers (S5).

### S4. Saving: the `lesson` card

A new card kind, `lesson`, posted with `card.js lesson <file>` by lead, sub-lead, worker
and mapper. It is **shown** (it is the thread notice, decision 12) and **not pinned**.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `action` | `add` \| `replace` \| `remove` | yes | What to do |
| `for` | role | yes | Whose lessons (must be allowed by S2) |
| `text` | string | `add`, `replace` | 1–300 characters, one line |
| `lesson` | string | `replace`, `remove` | The id of the lesson to change, as shown in the agent's instructions |
| `only_ai` | string | no | `add`/`replace`: a `PROVIDERS` key (`claude`, `gpt`, `gemini`, `kimi`, `openrouter`); sets `provider`, so the lesson reaches only agents on that AI. Name the AI of the agent that made the mistake, which for a reviewer, verifier or worker lesson is often not the saver's own |
| `only_project` | boolean | no | `add`/`replace`: true sets `project` to the thread's project path |
| `why` | string | `add`, `replace`, `remove` | One line, shown on the notice: what went wrong and how it was proven |

Like `done`, a `lesson` card is **never queued**: the machine relays it to the hub
synchronously and returns the hub's answer; if the hub cannot be reached it returns 503
`the app is unreachable; the lesson was not saved; try again in a minute`. The hub applies
the change to `settings.lessons` and records the card in the thread in one step: if the
settings write fails, no card is recorded. On success the stored card carries the
resulting lesson `id` (and, for `remove`, the removed text) so the notice can show it.
Refusals (422 unless noted), each a sentence the agent can act on:

- `a <saver> may not save lessons for <target>s` (S2).
- `lessons for <role>s are full (12): replace or remove one instead`.
- `no lesson <id> for <role>s` for a `replace`/`remove` naming a missing id or one under
  another role.
- field errors (400) from `card.js` validation as for other kinds.

`only_ai` absent or `only_project` false/absent on a `replace` clears that marker. An unknown `only_ai` value is refused by `card.js` (400). The stored
`saved_by` becomes `agent`.

### S5. Reaching agents

`roleLayers(settings, role, project, scout, provider)` gains a lessons block, placed
**right after** the opening "Nothing below overrides the built-in rules above." line and
**before** the user's template, so the user's template (later, lower layer) wins where
they disagree (decision 6). It contains the role's lessons whose `provider` is absent or
equals `provider` and whose `project` is absent or equals `project`:

```
Lessons learned by earlier <role>s, saved by agents. Follow them unless the rules above or
the user's template below say otherwise. To change one, see "Lessons" in your rules.
- [L1a2b3c] <text>
- [L4d5e6f] <text> (only on <AI name>)
```

No block when nothing applies. The hub already passes `role_layers` to the machine for
every provider (`viewer/app/sessions.js:324`), so all five AIs get it at session start.
Running sessions keep what they started with (decision 9). A session started with a
`role_prompt` override gets no lessons, as today it gets no layers.

The lead also gets the reviewer and verifier lessons (so it can replace or remove them):
its layer adds, after its own block, the same format headed
`Lessons you keep for reviewers:` and `Lessons you keep for verifiers:` (all of them,
with markers, unfiltered). The sub-lead likewise gets `Lessons you keep for workers:`.
Lessons blocks (the role's own and the "you keep" ones) are **not** counted by
`assertFits()`: their size is already bounded by the 12-per-role cap and 300-character
limit, and counting them would refuse a lesson with a size error before the cap is reached.

The Settings "See it in full" preview (`fullPrompt`) shows the lessons block with every
lesson for the role and its markers, filtered only by the template's project scope.

### S6. The notice in the thread

The `lesson` card renders in the thread as one compact line, styled as a notice (not a
question): "Saved a lesson for <role plural>: <text>" (`add`), "Updated a lesson for
<role plural>: <text>" (`replace`), "Removed a lesson for <role plural>: <removed text>"
(`remove`), followed by the `why` in muted text and markers ("only on GPT", "only in this
project"), and an "Open in Settings" link to the Lessons entry for that role. It needs no
answer, never counts under "Needs you" and has no buttons.

### S7. Settings › Behavior templates

The template list gets, in each role's group (shown even when that role has no templates
of Collin's), one entry **"Lessons learned"** placed first, with a distinct "Written by
agents" tag and a visual style unlike Collin's templates (an accent-tinted background and a
text label, no icon). The tag shows the count, e.g.
"Written by agents · 4". It is shown only when the role has at least one lesson; with none,
the group shows nothing extra. It has no in-use toggle, no duplicate and no delete-all.

Selecting it opens an editor with:

- A warning line at the top: "Agents keep this list up to date. You can edit it, but
  agents may reword or remove your changes later."
- One row per lesson: the text in an editable field (1–300 characters), its markers as
  read-only labels, "saved from <thread title>" as a link when `thread` is set and the
  thread still exists, and a Remove button (with a "Really remove" confirm step, as
  template Delete has).
- Save, which writes the edited texts (`saved_by: user`) through a new
  `PUT /settings/lessons/<role>` with body `{ lessons: [{ id, text }] }` that may only
  edit text or drop entries, never add or change markers; unknown ids are refused (400).
  A lesson an agent changed since the page loaded keeps the agent's version only if Collin
  did not edit that row; otherwise Collin's text wins (last write wins per row).
- The note "Changes apply to agents started after you save." like templates.

Collin cannot add lessons from Settings (agents write them; his own instructions belong in
his templates). The `GET /settings` payload includes `lessons`.

### S8. Protocol text

- `protocol/app/cards.md`: the `lesson` kind in the kinds table (shown, not pinned, emitted
  by lead, sub-lead, worker, mapper) and its section (S4 fields, never queued, refusals).
- `protocol/app/lead.md`, `sub-lead.md`, `worker.md`, `mapper.md`: a short "Lessons"
  section with the bar (S1), whom it saves for (S2), "read the existing lessons first;
  replace or remove before adding", the 12 cap, and the rule-conflict path. The lead's
  section says when it writes reviewer and verifier lessons (naming, in `only_ai`, the AI
  the reviewer or verifier ran on when the mistake is that AI's habit), and that a lesson card is a
  notice the user sees, so `why` is in the user's words. The sub-lead's says it writes
  worker lessons, naming the worker's AI in `only_ai` the same way.
- `protocol/app/reviewer.md`, `verifier.md`: one sentence that the lessons in their
  instructions are kept by the lead and they do not save lessons.

### S9. Non-goals

No undo or history, no stale-lesson detection, no sync with any AI's built-in memory, no
lessons in aside sessions, no change to running sessions, no lesson import/export with
thread handoffs.

### S10. Validation

- `cd viewer && npm test` passes, including new tests in
  `viewer/test/app-lessons.test.js` covering: S2 allowed and refused pairs; the 12 cap;
  replace/remove by id, missing id refused; `only_ai`/`only_project` set and cleared;
  `normalize()` dropping malformed lessons; `roleLayers` including only matching lessons,
  placing the block before the template text, and the lead's/sub-lead's "you keep" blocks;
  `only_ai` naming another AI than the saver's; `assertFits` ignoring lessons blocks; the `PUT /settings/lessons/<role>` edit and
  remove rules; the machine returning 503 for a `lesson` card when the hub is unreachable
  instead of spooling.
- `cd viewer && npx playwright test test/app-settings.spec.js test/app-lessons.spec.js`
  passes, with `app-lessons.spec.js` covering: the "Lessons learned" entry and its tag
  appear only when lessons exist; editing and removing a lesson; the warning line; the
  thread notice line for add, replace and remove with its Settings link.
- `node viewer/app/card.js lesson <file>` refuses a reviewer or verifier session
  (role not allowed) and a missing `why`.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| D1 | Undo and history of lesson changes | Removing or editing in Settings covers a bad lesson | planning | Keep prior versions per lesson id; restore from Settings |
| D2 | Spotting lessons that have gone stale | 12-per-role cap and agent replace/remove keep the list short at first | planning | E.g. flag lessons not reconfirmed in N months, or after the rules they reference change |
| D3 | Carrying lessons across installs and thread handoffs | One hub per user today | planning | Export/import with handoffs; merge rules on id clash |

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them. Rare paths per `protocol/app/realism.md` land here in every mode, with round
`review-round-N`, `verification-N` or `lead-check`.

| Risk | Why accepted | Round |
|------|--------------|-------|

## Check Once Built

Review findings only the built code can settle, per `protocol/app/realism.md`. Verifiers
check each row against the build; a listed row is settled for later review rounds and
stays as review history.

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

### Round 1 — 2026-11-21

**Lanes:** intent — claude / claude-opus-5-5; mechanics — gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | `only_ai` as a boolean pins the lesson to the saver's AI, but lead/sub-lead save for reviewers, verifiers and workers that often run on another AI | upheld (blocking) | S4 `only_ai` names a provider; S8 tells lead and sub-lead to name the mistaken agent's AI |
| intent | minor | Lead's "you keep" blocks (up to 36 lessons) would trip the 12,000-character check before the 12 cap | upheld (minor) | S3/S5: lessons blocks excluded from `assertFits`; bounded by cap |

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
