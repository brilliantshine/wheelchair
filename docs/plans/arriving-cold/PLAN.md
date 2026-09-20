---
slug: arriving-cold
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-09-19
---

# Knowing what you have actually seen

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

### Q6: Where does the check run relative to the turn that needs grounding?

- **Context:** Round 1 killed the two arrangements the Spec had. A hook fires after a turn is
  already composed, so hook-only grounding always lands one turn late — the stage summary that
  references round three still reaches the reader ungrounded. And the check being the only
  thing that writes the record makes the firing gate circular: nothing marks a turn as having
  produced unseen work, because only the check writes, and it only runs when something was
  written. Both defects have the same root — the record is produced *after* the work by a
  separate observer, rather than *during* it by whatever did the work.
- **Options:**
  - **Stage fires it before composing.** Each stage runs the check at the end of its work and
    reads the result before writing its turn. Grounds the primary case in time; needs the same
    code in four stage documents on both harnesses, and hooks still cover ordinary chat.
  - **Hook only, and accept the lag.** Simplest, one mechanism, and the turn you most need
    grounded is the one turn it cannot ground. Fails the idea's first success criterion.
  - **The working agent writes the record as it goes; no check lane.** A stage that finishes
    a review round records what it found in plain words, right then. The record is already
    current when the turn is composed, so the stage grounds itself with no lane, no race, no
    circular gate, and no quota cost. The hook becomes a pure reader for ordinary chat and the
    gap rule. Cheapest by a wide margin, and it moves the honesty burden onto the agent doing
    the work rather than onto an independent observer.
- **Recommendation:** the third. It dissolves four of Round 1's eight blocking findings rather
  than patching them, and the fifth — the register being write-only — is a separate question
  either way. The cost is real and worth stating plainly: an agent recording what it showed you
  is not independent of the agent that showed it, which is exactly the separation the original
  idea reached for. Whether that separation was load-bearing or just the obvious first shape is
  the actual decision.

## Watch List

Things noticed that need looking into — not yet decisions for the user. Written down the
moment they're spotted so they can't be forgotten, surfaced to the user one line at a
time as they appear, and emptied before Stage 1 exits.

Each item ends up settled by the agent (noted in the Log), promoted to an Open Question,
promoted to a Constraint or Accepted Risk, or waved off by the user.

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| W1 | 2026-09-19 | How a Codex hook is actually configured. `hooks` is a stable, enabled feature, the binary carries `struct HooksToml`, but no path that was tried fired one. Needs Codex's own hook docs or an interactive session that can answer the trust prompt — not more path guessing. | yes | **Deferred** (Source: planning). D7 makes it a third trigger added later, changing nothing else |
| W2 | 2026-09-19 | Whether injected context is visible to the user, counted against the context window, or breaks prompt caching. The Claude run proved the model received it and nothing more. | yes | **Accepted risk** — unmeasured; the lane dominates the cost and D6 gates the lane |
| W3 | 2026-09-19 | `protocol/sensitivity.md:23` holds an inert level line that disagrees with both installed copies (`MAP.md`, Problems found). | yes | **Deferred** (Source: planning) — a real defect, in a neighbouring file, with nothing to do with this feature |
| W5 | 2026-09-19 | JSON has no comment marker, so "owns only what it wrote" needs a mechanism the sensitivity writer does not have. | yes | settled by D14 — match on the command path, which the schema already requires |
| W4 | 2026-09-19 | Whether the check should fire inside a subagent's own turns. `subagent_start`/`subagent_stop` exist on both harnesses; a worker lane is not the reader this feature serves. Defaulted to no (D4), reopen if a stage turn's summary turns out to need it. | no | settled by D4 |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D1 | The check runs on Sonnet for Claude lanes and `gpt-5.6-terra` for GPT lanes | Named in the original request. Both are the default implementation tier on their side, and the work is judgment-shaped enough that the transcription tier would be wrong | user |
| D2 | This is a build people depend on, graded for Collin daily and for every project the wording record reaches | Confirmed with `IDEA.md` | user |
| D3 | A check that is too eager is the dangerous failure; too quiet merely leaves today in place | Confirmed with `IDEA.md`. Sets which way every later judgment call breaks | user |
| D4 | The check does not run on subagent turns | A worker lane is not the reader this serves, and firing there would spend quota to ground text nobody reads | defaulted |
| D5 | The check returns evidence — a list of what the turn leans on that you have not seen — never drafted prose or an instruction about how to write | Handing back prose makes the checker the author of the turn, which is the thing the idea's first non-goal rules out | defaulted |
| D6 | The check fires only when something you have not seen entered the record since your last message | Firing on every turn regardless spends a single account's quota on turns that cannot fail the check. Also the cheapest guard against D3's failure | defaulted |
| D7 | Two triggers, one mechanism. The record, the register, the check and what it returns are identical on both harnesses; only what fires them differs — Claude Code's user-prompt hook on every turn, Codex's stage commands on stage turns | The only option where solving the Codex hook later is an addition rather than a rewrite. The named pain — a question arriving after review rounds nobody saw — is a stage turn on both harnesses, so both are covered from the start | user |
| D8 | Every stage that composes a turn for the user fires the check on Codex: planning, plan review, implementation, verification | Named individually so no stage is left out by omission. D6's firing condition still gates each one, so a stage turn that follows nothing unseen pays nothing | defaulted |
| D9 | The record of what you have seen lives with the work: inside `docs/plans/<slug>/` for anything belonging to a plan, and in a session-scoped file in a cache directory for chat that belongs to no plan | The only option that survives both a resume and a harness switch, which `IDEA.md` makes a hard constraint. Falls out of D7 as well — Codex fires the check from a stage, a stage always has a slug, so there is nowhere else it could write | user |
| D10 | The register of wording does **not** follow D9. It lives outside any repository, one file, shared by every project | Settled by `IDEA.md` rather than open: the idea commits to wording changing how you are written to "in other work, on other days," which a per-plan file cannot do | defaulted |
| D11 | When a plan is created in a session that already has a session-scoped record, that record is folded into the plan's record at creation | The hour of chat immediately before `/plan` is the most relevant thing the plan's record could start with, and both files already exist at that moment | defaulted |
| D12 | The session-scoped file is keyed the way question graphs already are — repository basename plus a hash of its absolute path, under the same cache root | Reuses a derivation this repo already relies on (`protocol/graphs.md`, "Where graph files live"), including its reason: two worktrees of one repo share a basename and would otherwise collide | defaulted |
| D13 | `install.sh` writes Claude Code's hook entry into `~/.claude/settings.json`, owning only what it wrote and refusing rather than merging when it finds something it did not | Per-repository setup fails the requirement that ordinary chat be covered everywhere; printing a block to paste fails it slowly instead of immediately. The refusal path is what makes writing a file the user owns safe, so it is built first | user |
| D14 | The installer recognises its own hook entry by the command path it points at, rather than by any added key | Settles W5. JSON has no comment marker, and the command string is a value the schema already requires, so nothing has to be smuggled into a shape the harness validates. A moved clone breaks the match — but a moved clone already requires re-running `install.sh` for every wrapper, so this adds no new failure mode | defaulted |
| D15 | The register is one file with three sections — proposed, confirmed, struck — edited by hand, with struck entries kept rather than deleted so a rejection sticks | The cheapest surface that still closes the only gap in it. Borrows the one load-bearing rule from the graph verdict model and leaves the rest unbuilt | user |
| D16 | The check runs at the **end** of the turn that produced the unseen work, not at the start of the turn that would report it. Its finding is written to the record; the next turn reads a file rather than waiting for a lane | Supersedes the latency cost written into the Spec after D7. `IDEA.md` makes "you do not wait longer for an answer than you do today" a constraint, and a lane on the reading turn violates it on both harnesses. The finding — what entered the record that the reader has not seen — is fully known when the work finishes, so nothing is lost by computing it then | defaulted |
| D18 | **Supersedes D7.** Both harnesses use the same hook configuration; there is no asymmetry and no stage-only fallback | The premise of D7 was that Codex hooks could not be made to fire. They fire — verified on a headless `codex exec` run with a user-level `~/.codex/hooks.json`. The earlier failure was project scope needing a trusted `.codex/` layer, which is a fact about my test, not about Codex | review-round-1 |
| D17 | A gap of **4 hours or more** between the reader's messages flips every `shown` entry to `cold`; `decided` entries never flip | A number the plan has to state so review can argue with it. The asymmetry is the point: what you chose survives a break, what you were shown does not | defaulted |

## Spec

The settled design. Bar: a fresh agent with no conversation history can implement from this
section alone.

### What this adds, in one paragraph

Two records and one check. The records say what the reader has been shown and what wording
has landed badly with them. The check runs when a turn finishes, works out what entered the
record that the reader has not seen, and writes that list down. The next turn reads the list
and grounds those things before leaning on them. Nothing is added to any agent's standing
instructions.

### The three files

**The plan record — `docs/plans/<slug>/SEEN.md`.** Created by Stage 1 alongside `MAP.md`.
Frontmatter carries `slug`, `acknowledged-through` (an integer turn index) and
`last-message-at` (an ISO 8601 timestamp). The body is one append-only table:

```
| # | Turn | What | State |
|---|------|------|-------|
| 1 | 4 | round 2 found the spec did not say what happens on a malformed settings file | shown |
| 2 | 5 | chose to keep the record with the work rather than with the session | decided |
```

`State` is `shown`, `decided` or `cold`. `shown` means it was put in front of the reader;
`decided` means the reader chose it; `cold` means a gap has passed and it can no longer be
assumed held. `decided` never becomes `cold` (D17). Entries are appended, never edited,
except for the single-field `shown` → `cold` transition.

**The session record — `<cache-root>/<repo-key>/<session-id>.md`.** Same format, no `slug`.
`<cache-root>` defaults to `~/.cache/wheelchair`. `<repo-key>` is the repository directory
basename, a hyphen, and the first eight hex characters of a SHA-256 of the repository's
absolute path — the derivation `protocol/graphs.md` already defines under "Where graph files
live", reused for the reason stated there (D12). Used for conversation belonging to no plan.

**The register — `~/.wheelchair/wording.md`.** One file, outside any repository, shared by
every project (D10). Durable and hand-edited, which is why it is not under a cache root.
Three sections, in this order, each holding one line per entry with the date and a short
quotation of what prompted it:

```
## Confirmed
- 2026-09-19 — avoid "north star"; asked for it plainly twice

## Proposed
- 2026-09-20 — possibly avoid "surface" as a noun; asked what it meant once

## Struck
- 2026-09-18 — not a dislike of "ledger"; that was a question about the design
```

Only `## Confirmed` is read by the check when it judges wording. A `## Struck` entry may
never be re-proposed — matched on the entry's text, and a struck entry is never deleted by
any agent (D15). The reader promotes and strikes by editing the file; nothing else writes to
`## Confirmed` or `## Struck`.

### The check

A lane: Sonnet from Claude Code, `gpt-5.6-terra` from Codex (D1), dispatched per
`protocol/lanes.md`. It is given the record, the register's `## Confirmed` section, and the
transcript of the turn that just finished. It returns two things:

- **A list of what entered the record that the reader has not seen** — each item one line,
  naming the thing in the words a reader would recognise. Evidence only. It never returns
  drafted prose and never returns an instruction about how to write (D5).
- **Zero or more proposed register entries**, each appended to `## Proposed` and to nothing
  else.

It appends its list to the record as `shown` entries carrying the current turn index, and
writes nothing else.

**When it runs.** At the end of the turn that produced the work, not at the start of the
turn that would report it (D16). It runs only when at least one entry was added during that
turn (D6). It never runs on a subagent's own turns (D4).

**Claude Code** — a `Stop` hook fires it. A `UserPromptSubmit` hook then reads the record and
returns any entry whose turn index is greater than `acknowledged-through` as
`hookSpecificOutput.additionalContext`, and updates `acknowledged-through` and
`last-message-at`. That hook reads a file and runs no lane, so it adds no measurable wait.

**Codex** — the stage commands fire it: planning, plan review, implementation, verification
(D8). Each runs it as an ordinary lane at the end of its work, and reads the record before
composing its next turn. The lane runs inside work the reader is already waiting for, so
this costs no separate wait either.

When the Codex hook is solved (Deferred) it becomes a third trigger for the same check.
No record, brief, return shape or firing condition changes, and the stage-fired trigger
stays as the fallback for a Codex install without hook configuration.

### The gap rule

When `UserPromptSubmit` fires, it compares now against `last-message-at`. At **4 hours or
more** (D17) it rewrites every `shown` entry to `cold` before computing what to inject, and
injects the `cold` entries alongside the unseen ones. `decided` entries are untouched. The
threshold is a constant in one place, named so it can be changed in one edit.

### The installer

`install.sh` gains a call to `seen/set.sh`, placed **before** the `sensitivity/set.sh` call
so an existing warning-not-failing step stays last. `seen/set.sh`:

- Writes the `UserPromptSubmit` and `Stop` entries into `~/.claude/settings.json`, creating
  the file holding only those entries if it is absent.
- Recognises its own entries by the command path they point at — a value the schema already
  requires, since JSON has no comment marker (D14).
- **Refuses and changes nothing** when it finds a `UserPromptSubmit` or `Stop` entry whose
  command path is not its own, when the file is not valid JSON, or when the file is valid
  JSON but not an object. It reports what it found and exits non-zero.
- Rewrites its own entries in place when they are already there, so a second run is a no-op.
- Does nothing and exits 0 when `claude` does not resolve on `PATH`, matching how
  `protocol/lanes.md` defines presence.

A refusal **warns without failing the install**, for the reason `protocol/sensitivity.md`
gives for its own writer: `install.sh` runs under `set -euo pipefail`, and a non-zero writer
would abort it mid-run and break its own idempotence check for an unrelated reason.

### Failing open

Every path here fails open, without exception. A hook that exits non-zero, times out,
returns unparseable output, or cannot reach a lane must let the turn proceed unchanged. A
missing or malformed record is treated as empty rather than repaired. A quota-exhausted lane
is a no-op. The hook entries carry a 10-second timeout; the lane behind `Stop` is dispatched
detached so the reader never waits on it.

This is the single most important property in the Spec. The feature's whole value is
marginal; a turn it blocks or delays costs more than every turn it improves.

### Documents this changes

- **New: `protocol/seen.md`** — the canonical definition of all of the above. The one place
  the rules live, in the repository's own pattern.
- **New: `seen/set.sh`** and **`seen/test/run.sh`** — the writer and its fixture suite,
  following `sensitivity/set.sh` and `sensitivity/test/run.sh` exactly, including that the
  suite never touches a real `~/.claude`.
- **New: `seen/hook.sh`** — the entry point both hook entries point at, dispatching on
  `hook_event_name`.
- **New: `seen/AGENTS.md`** — the directory router, per `protocol/routers.md`.
- **Edited: `protocol/planning.md`, `plan-review.md`, `implementation.md`,
  `verification.md`** — each gains the trigger from D8, stated once and pointing at
  `protocol/seen.md`, never restating its rules.
- **Edited: `protocol/lanes.md`** — the check's lane invocation, beside the others.
- **Edited: `protocol/templates/`** — `SEEN.md` joins the template set.
- **Edited: `install.sh`, `AGENTS.md`, `README.md`** — the new call, the new directory in the
  router table and the layout block.

`protocol/writing.md` is **not** edited. Its rules are correct and stay exactly as they are;
this feature supplies the fact they were always missing.

### Edge cases

- **First turn of anything.** No record exists; the check does not fire, because nothing
  entered the record during a turn that has not happened.
- **A plan created mid-session.** The session record's contents are folded into the new
  `SEEN.md` at creation, and the session record is left in place untouched (D11).
- **Two sessions in one repository.** Each has its own session record. Both may append to the
  same `SEEN.md`; every append re-reads the file first and appends, so a concurrent write
  loses nothing. Nothing here edits an existing row except the `shown` → `cold` flip, which
  is idempotent.
- **Two worktrees of one repository.** Distinguished by the path hash in `<repo-key>` (D12).
- **A struck register entry proposed again.** Matched on text against `## Struck` and
  dropped silently.
- **`~/.claude/settings.json` already holds a hook that is not ours.** Refuse, report, change
  nothing.
- **The reader edits a record by hand.** Permitted. Anything unparseable is treated as empty
  rather than repaired.

### Non-goals

From `IDEA.md`, restated here because the Spec is what a reviewer grades: no revision of any
agent's standing instructions; no model of what the reader knows in general; no preference
learned without the reader ruling on it; no participation in the work itself; nothing running
between turns; no replacement for `protocol/writing.md` or the graph verdicts; not a second
copy of the transcript.

### Validation

```bash
bash seen/test/run.sh                      # writer + record-format assertions, exit-code gated
./install.sh && ./install.sh               # idempotent; git status --porcelain stays empty
bash install/test/run.sh                   # presence-aware installer assertions still pass
bash sensitivity/test/run.sh               # the neighbouring writer is unaffected
```

Plus one live check that cannot be faked at a seam, run in a throwaway project directory with
the hooks installed at project scope: fire a real `claude -p` turn, assert the `Stop` hook
ran and the record grew, then fire a second turn and assert the injected context named the
entry the first turn added. The fixture suite covers the writer's refusal paths; this covers
the one thing only a real harness can prove.

## Deferred

Work this plan left undone because of the kind of build it states. Not "not worth fixing" —
that is Accepted Risks. This is what the next plan starts from if this one earns a second life.

| Source | What was skipped | Why it is out of scope here | What it would take |
|---|---|---|---|
| planning | Firing the check from a Codex hook rather than from a stage command (W1) | D7 makes it an added trigger that changes no record, no brief and no return shape. Nothing in this plan waits on it, and guessing at config paths is not work | Codex's own hook documentation, or an interactive session that can answer the trust prompt; then one more entry in the installer |
| planning | Repairing the inert `diagram-sensitivity` level line at `protocol/sensitivity.md:23` (W3) | A real defect in a neighbouring file that this feature neither causes nor depends on. Folding it in would put an unrelated change through this plan's review gate | A sentence in `protocol/sensitivity.md` saying the region's level line is a template and the installed copies hold the live value, or a writer change that keeps them in step |

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them.

| Risk | Why accepted | Round |
|------|--------------|-------|
| The effect of injected context on prompt caching is unmeasured (W2) | The check's cost is dominated by the lane it runs, not by the text it injects, and D6 already gates the lane to turns where something unseen actually landed. Measuring it needs instrumentation this plan would otherwise have no reason to build | planning |

## Review Rounds

### Round 1 — 2026-09-19

**Lanes:** GPT / gpt-5.6-sol (mechanics); Claude / default reviewer model (intent); cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

Nineteen findings after merging the two lanes; six were found independently by both. Eight
upheld at `blocking`. The round is not clean and the Spec's premise did not survive it.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| gpt | blocking | Codex hooks are documented and working; deferring them leaves ordinary Codex turns uncovered, contradicting the same-on-both constraint | `upheld` | **Verified myself.** A user-level `~/.codex/hooks.json` `UserPromptSubmit` hook fired on headless `codex exec` and its `additionalContext` reached the model in a clean directory. The earlier failure was project scope needing a trusted `.codex/` layer. D7 rests on a false premise |
| both | blocking | The firing gate is circular: the check runs only when an entry was added, and the check is the only thing that adds entries | `upheld` | No producer exists. Nothing else in the Spec marks a turn as having produced unseen work |
| both | blocking | The `Turn` integer and `acknowledged-through` counter map to nothing either harness supplies | `upheld` | Confirmed against both payloads: Claude gives `prompt_id` (UUID), Codex gives `turn_id` (opaque string). Neither is an ordered integer, and neither orders a record shared by two sessions |
| both | blocking | "Re-read then append" is the lost-update race, not a defence against it | `upheld` | Correct. `sensitivity/set.sh:213,250` writes a temp file and `mv -f`s it with rollback — atomic replacement, not mutual exclusion, exactly as the GPT lane described. The Claude lane's version of this finding cited a lock-and-rename passage at `MAP.md:126-132` that does not exist there; the defect is real, the citation was not |
| both | blocking | A detached `Stop` lane cannot guarantee its result exists when the next `UserPromptSubmit` reads; a quick reply gets nothing and the entry is then invisible once acknowledged | `upheld` | Also conflicts with the idea's non-goal of nothing running between turns |
| claude | blocking | The register is write-only — nothing carries `## Confirmed` into a turn, and D5 forbids the only channel that could | `upheld` | The wording half of the feature does not reach a turn as specified. D5 and the idea's promise are in direct contradiction |
| claude | blocking | `cold` entries never retire, so the first four-hour gap pads every later turn permanently | `upheld` | Cold rows carry indices already below `acknowledged-through`, so no defined transition removes them. This is D3's dangerous failure arriving by mechanism |
| claude | blocking | D16 lands the grounding one turn late on Claude: the stage's summary is composed before `Stop` fires, so the confusing turn still reaches the reader | `upheld` | Confirmed. The Codex path does not share the defect because its stage fires and reads in one turn, which also breaks the same-on-both constraint |
| both | major | Nothing tells a hook whether the turn belongs to a plan or to no plan, so it cannot choose between `SEEN.md` and the session record | `upheld` | Inputs carry `cwd` and a session id, never a slug; a repository holds many plan directories |
| both | major | Validation cannot detect the failure the idea calls most dangerous | `upheld` | No assertion that a turn depending on nothing unseen injects nothing; the live test uses project scope while the installer writes user scope |
| gpt | major | `transcript_path` is not a stable interface and may lag the turn that just finished | `upheld` | Both vendors document this. Codex's guide says the transcript format "isn't a stable interface for hooks"; Claude's points `Stop` hooks at `last_assistant_message` |
| gpt | major | The struck-entry guarantee has no implementable identity rule — rows carry a date and free-form prose, matched "on the entry's text" | `upheld` | Exact matching misses the same wording on another date; semantic matching is undefined |
| claude | major | The check's brief is unspecified, and it is the only thing standing between this and the dangerous failure | `upheld` | No criterion for "not seen", no cap on items returned, no floor on what is too small to name |
| claude | major | The installer refuses on any foreign `UserPromptSubmit` or `Stop` entry, and the refusal only warns — so a user with any other hook silently gets no feature, forever | `upheld` | Correct, and the reasoning is sound: Claude's `hooks` config is an array of matcher groups, so coexisting is an append. The delimited-region precedent exists because Markdown has no structure to append into; JSON does |
| claude | major | A proposed register entry has no route to the reader, so the promote step never triggers | `upheld` | Pairs with the write-only finding above: the wording half has neither an input the reader sees nor an output that reaches a turn |
| claude | major | The machinery is disproportionate; the unseen-work delta is mechanically derivable from the record, so a lane is needed only to phrase items | `user-decision` | A genuine fork about scope, not a defect. Appended to Open Questions |
| claude | minor | `SEEN.md` dirties the working tree continuously and lands in every PR; tracked-or-ignored is unspecified | `upheld` | Volatile fields do not belong in a committed file |
| claude | minor | The Spec calls the feature's value "marginal" while D2 grades it as depended-on daily | `upheld` | The sentence is load-bearing for fail-open and the wording undercuts D2. Rewrite to argue fail-open from asymmetry of cost, not from low value |
| claude | minor | Three home-directory roots now exist for adjacent state with no rule saying which gets what | `upheld` | `~/.cache/agent-graphs`, `~/.cache/wheelchair`, `~/.wheelchair` |

**Lead note on the two lanes.** The GPT lane found the one fact that invalidates the plan's
architecture, by reading vendor documentation neither the plan nor the map had consulted. The
Claude lane found the two defects that would have shipped a feature doing the opposite of its
purpose — grounding arriving a turn late, and re-explanation accumulating without bound. Neither
lens would have been sufficient alone. One citation from the Claude lane was fabricated and is
corrected in the table above; its finding stood on its own reasoning.

## Prior Work

Parts of the Spec already built before this plan reached Stage 3.

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|
|           |       |                      |            |

## Implementation Tasks

Filled by Stage 3. One row per worker brief.

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- 2026-09-20 — Paused here, on branch `arriving-cold`. Round 1 is triaged and recorded; Q6 is
  the one open question and nothing else proceeds until it lands. The upheld findings in Round
  1 are Spec edits that follow from Q6's answer, so they are deliberately **not** applied yet —
  applying them against an architecture Q6 may replace would be wasted work.
- 2026-09-20 — Deleted `graphs/codex-without-a-hook.json`. Its whole premise — that Codex
  could not fire a hook — is false (D18), and `protocol/planning.md:94` makes a resumed session
  re-read every graph here before composing a question, so leaving it would feed a resumed
  session a fact Round 1 disproved. `protocol/graphs.md` says a stale graph is discarded rather
  than patched. The other three graphs still describe live decisions. Every entry in all of
  them is `proposed` — nothing was ruled on in the viewer, so Stage 2 must not read them as
  approvals.
- 2026-09-19 — Stage 1 exit. Open Questions and Watch List both empty. The four graphs under
  `graphs/` carry no `agreed` or `rejected` entries — every decision came through the
  conversation rather than the viewer — so the exit gate's requirement that the Spec account
  in prose for each rejection is satisfied with nothing to account for. Stage 2 should read
  them as unruled proposals, not as approvals.
- 2026-09-19 — Fired a real `UserPromptSubmit` hook on Claude Code in an isolated project
  directory to settle whether the mechanism exists. It does; details in `MAP.md` item 3.
  The equivalent Codex attempt failed and became W1. No global configuration was touched by
  either attempt.
