---
slug: arriving-cold
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-09-19
---

# Knowing what you have actually seen

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

## Watch List

Things noticed that need looking into — not yet decisions for the user. Written down the
moment they're spotted so they can't be forgotten, surfaced to the user one line at a
time as they appear, and emptied before Stage 1 exits.

Each item ends up settled by the agent (noted in the Log), promoted to an Open Question,
promoted to a Constraint or Accepted Risk, or waved off by the user.

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| W1 | 2026-09-19 | How a Codex hook is actually configured. `hooks` is a stable, enabled feature, the binary carries `struct HooksToml`, but no path that was tried fired one. Needs Codex's own hook docs or an interactive session that can answer the trust prompt — not more path guessing. | yes | settled by D18 — Codex hooks fire at user scope; nothing is deferred |
| W2 | 2026-09-19 | Whether injected context is visible to the user, counted against the context window, or breaks prompt caching. The Claude run proved the model received it and nothing more. | yes | **Accepted risk** — unmeasured; the lane dominates the cost and D6 gates the lane |
| W3 | 2026-09-19 | `protocol/sensitivity.md:23` holds an inert level line that disagrees with both installed copies (`MAP.md`, Problems found). | yes | **Deferred** (Source: planning) — a real defect, in a neighbouring file, with nothing to do with this feature |
| W5 | 2026-09-19 | JSON has no comment marker, so "owns only what it wrote" needs a mechanism the sensitivity writer does not have. | yes | settled by D14 — match on the command path, which the schema already requires |
| W6 | 2026-09-24 | `MAP.md` was written before `remember-me` (PR #14) rewrote parts of the protocol and moved the viewer under `/wheelchair/`. Its `file:line` citations are now off by a few lines in places (`protocol/planning.md:118` is now `:112`). Re-check the citations Q6's answer leans on before the Spec is rewritten | yes | settled — `MAP.md` citations re-checked and corrected against current files, including the installed dial level, which now reads `default` |
| W7 | 2026-09-24 | `IDEA.md`'s last constraint still says neither harness's per-turn mechanism has been proven here. Both have since fired (`MAP.md` item 3, D18), so the sentence is stale and its "revisit the idea" clause no longer applies. Correcting it is a Constraints edit, not a scope change | yes | settled — the constraint now says both were proven |
| W8 | 2026-09-24 | Whether a subagent-finished hook (`SubagentStop` on Claude Code, `subagent_stop` on Codex) could append a record entry mechanically when ordinary chat runs a helper agent — closing D21's accepted limit with no model call and no instruction. Untested on either harness, including what its payload carries | yes | **Deferred** (Source: planning) — D21's accepted limit, listed under Deferred |
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
| D19 | **The stage writes the record as it works.** Each time a unit of hidden work finishes — a review round after triage, a worker task's result, a verification round — the stage appends one line saying what happened, in words you would recognise. Before composing a turn to you it reads the record, grounds every entry you have not been shown, and marks them shown | Q6. The fact the record needs — this happened where you could not see it — is certain at the moment the work is done, so it needs no independent observer. Grounds the stage's own summary in time, which a post-turn hook cannot. Dissolves four Round 1 blocking findings rather than patching them: the circular firing gate, the detached-lane race, the one-turn lag, and the quota cost | user |
| D20 | **Supersedes D1, D6 and D16.** There is no check lane, no model runs for this feature, and there is no firing condition | All three existed to schedule and pay for a lane D19 removes. D5 still holds for what the stage writes: evidence, never drafted prose or a writing instruction | defaulted |
| D21 | **A hook also covers ordinary chat**, on both harnesses: a `UserPromptSubmit` hook that reads files and calls no model. It carries three things into a turn: the confirmed wording list, a note when four hours or more have passed since your last message, and any stage-written entry you have not been shown | Q7. The wording list is your own, confirmed, visible and editable, so handing it to a turn is evidence of your rulings rather than a standing instruction — the "standing instruction by another route" objection raised against this was overstated and is withdrawn. Accepted limit: nothing records hidden work done in ordinary chat itself (W8) | user |
| D22 | No `Stop` hook. The one hook is `UserPromptSubmit`, installed at user scope on both harnesses | D19 left nothing to do after a turn lands. User scope is the one scope verified on Codex (`MAP.md` item 3) | defaulted |
| D23 | **Supersedes the session-record half of D9, and D11.** There is no session record. The hook reads every `docs/plans/*/SEEN.md` under the git top level of the hook's `cwd`; the only per-session file is the time of your last message, under `~/.cache/wheelchair/<repo-key>/<session-id>`, keyed per D12 | Nothing in ordinary chat writes entries (D21's accepted limit), so a session record would stay empty. Reading every plan record in the repo settles Round 1's finding that a hook cannot tell which plan a turn belongs to: it does not need to. One reader, so an entry surfaced in the "wrong" session was still surfaced to the right person | defaulted |
| D24 | `SEEN.md` is an append-only log of one-line events, committed with the plan, with no frontmatter state. An entry is added as `new`; showing it is a later `shown` line naming its id; state is the latest line per id. There is no turn counter | Settles three Round 1 findings: no ordered turn id exists on either harness, so none is used; a single short line appended with `>>` does not interleave with another writer's, so there is no lost update; and with no volatile frontmatter the file changes only when hidden work happens, so it belongs in the plan's commits | defaulted |
| D25 | After a gap of four hours or more (D17), the hook injects the gap and the entries shown since the previous gap, **once** — the next message is inside four hours, so it does not repeat. There is no `cold` state | Settles Round 1's finding that `cold` entries never retire and pad every later turn. A one-shot injection cannot accumulate | defaulted |
| D26 | **Supersedes D13's refusal rule.** The installer adds its own hook group beside any hooks already there, recognised by command path (D14), and refuses only when the file is not valid JSON or not an object. It writes `~/.claude/settings.json` and `~/.codex/hooks.json`, each only when its harness is present | Settles Round 1's upheld finding that refusing on any other hook silently denies the feature to anyone who has one. The hooks config is an array of groups, so coexisting is an append; the delimited-region precedent exists because Markdown has nothing to append into | defaulted |
| D27 | Two home roots, one rule: `~/.cache/…` holds only what is safe to delete (graph cache, last-message times); `~/.wheelchair/` holds what is yours and hand-edited (the wording list) | Settles Round 1's three-roots finding by giving each root a reason rather than merging them | defaulted |
| D28 | **Stages suggest wording entries, and you approve them in the conversation.** When you push back on wording during a stage turn — ask what a word means, ask for something simpler — the stage appends a suggestion to `## Proposed` and ends that turn with **one short line** asking whether to keep it. You answer in your ordinary reply and the stage moves it to `## Confirmed` or `## Struck`. Ignored, it stays in `## Proposed` and is never asked about again. At most one suggestion per turn, and the line never displaces the turn's content. Removing a confirmed entry is a plain request in any conversation | Q8. You named the failure: a file you have to find and edit is a file you will not maintain, and suggestion lines crowding a turn would be the over-explaining this feature exists against. Settles Round 1's finding that a suggested entry never reached you. **Supersedes D15's rule** that only you write `## Confirmed` and `## Struck`: the stage writes them, on your answer | user |
| D29 | Every wording entry carries its phrase in double quotes. A suggestion whose quoted phrase matches a `## Struck` phrase, ignoring case and surrounding whitespace, is not made | Settles Round 1's finding that struck-entry matching had no identity rule. The quoted phrase is the identity; the date and the prose around it are not | defaulted |

## Spec

The settled design. Bar: a fresh agent with no conversation history can implement from this
section alone.

### What this adds, in one paragraph

Two records. The first says what the reader has been shown; the second says what wording
has landed badly with them. A stage appends to the first as each piece of hidden work —
anything done where the reader cannot see it, such as review rounds or worker tasks —
finishes, and reads it before writing a turn, so a turn that leans on something the reader
never saw explains it first (D19). A file-reading hook carries the wording list, the gap
after a long break, and anything still unshown into ordinary chat turns too (D21). No model
is called for any of this (D20), and nothing is added to any agent's standing instructions.

### The files

**The plan record — `docs/plans/<slug>/SEEN.md`.** Created by whichever stage first appends to
it, and committed with the plan (D24). No frontmatter state. The body is an append-only log, one event
per line:

```
2026-09-24T10:02Z new 7c1e round 2 found the spec never said what happens when the settings file is malformed
2026-09-24T10:02Z new a40b round 2 found the installer refuses whenever any other hook exists
2026-09-24T10:05Z shown 7c1e
2026-09-24T10:05Z shown a40b
```

An entry is unshown until a `shown` line names its id. An id is four random hex characters,
redrawn if it already appears in the file, so two writers never need to agree on a counter. Every write is one short line appended with `>>`, so two writers cannot
lose each other's lines. Nothing ever edits or deletes a line.

**The last-message time — `~/.cache/wheelchair/<repo-key>/<session-id>`.** One ISO 8601
timestamp, overwritten by the hook each time you send a message. `<repo-key>` is the
repository basename, a hyphen, and the first eight hex characters of a SHA-256 of its absolute
path (D12). Safe to delete; losing it only means the next gap goes unnoticed (D27).

**The register — `~/.wheelchair/wording.md`.** One file, outside any repository, shared by
every project (D10). Durable and yours, which is why it is not under a cache root (D27). Stages
write it on your answers (D28); you may also edit it by hand.
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

Only `## Confirmed` is carried into turns, by the hook (D21), together with the file's path
so any agent asked to remove an entry can find it. Every entry carries its phrase in double
quotes; a suggestion whose quoted phrase matches a `## Struck` one, ignoring case and
surrounding whitespace, is never made (D29). Struck entries are never deleted by any agent
(D15). You never have to open the file (D28).

**How an entry gets there (D28).** When you push back on wording during a stage turn, the
stage appends a suggestion to `## Proposed` and ends that turn with one short line, for
example: `Add "hidden work" to your wording list (explain it, don't assume it)? yes/no`. Your
next reply's yes or no moves it to `## Confirmed` or `## Struck`. No answer leaves it in
`## Proposed`, never asked about again. At most one such line per turn, always last, never
more than one sentence. Ordinary chat outside a stage makes no suggestions; it only carries the
confirmed list (D21).

### Writing and reading the record

**What a stage writes (D19).** One line per unit of hidden work, appended the moment that unit
finishes: each Stage 2 review round after triage, each Stage 3 worker task's accepted result,
each Stage 4 verification round, and a map build's findings that the map shown to the reader
does not contain. The line names what the unit found in words the reader would recognise,
with no coined labels. It is evidence only — never drafted prose, never an instruction about
how to write (D5).

**What a stage reads.** Before composing any turn to the reader, the stage reads the record,
grounds every entry not yet shown to the reader in that turn, and then marks those entries
shown. A turn with no such entries reads exactly as it does today.

**Order within one turn.** The hook fires first, on your message, and marks as shown whatever it
hands the turn — those entries are in front of the agent composing the turn, which grounds them
like any other. The stage then does its work, appends entries as units finish, and before
writing to you reads what is still unshown: the entries its own work just added. So an entry is
surfaced exactly once, by whichever of the two reaches it first.

No lane, no model call and no firing condition exist for this feature (D20). It never runs on
a subagent's own turns (D4) — a worker lane does not write the record; the lead that accepts
its result does.

### The hook (D21, D22)

One `UserPromptSubmit` hook, the same script on both harnesses, installed at user scope. It
reads files and runs no model. On each of your messages it:

1. Finds the git top level of its `cwd`; outside a git repository it skips steps 3–4.
2. Reads `## Confirmed` from `~/.wheelchair/wording.md`.
3. Reads every `docs/plans/*/SEEN.md` there and collects unshown entries, then appends a
   `shown` line for each one it collected (D23, D24).
4. Reads the last-message time for this session. At four hours or more (D17), it adds the gap
   and the entries shown since the previous gap, once (D25). Then it writes the current time.
5. Returns whatever it collected as `hookSpecificOutput.additionalContext`, plain lines, no
   instructions (D5). With nothing collected it returns nothing, and the turn reads exactly as
   it does today.

The four-hour threshold is a named constant in one place.

### The installer

`install.sh` gains a call to `seen/set.sh`, placed **before** the `sensitivity/set.sh` call
so the existing warning-not-failing step stays last. `seen/set.sh`, per harness present on
`PATH` (the presence rule `protocol/lanes.md` uses):

- Adds its hook group to `~/.claude/settings.json` or `~/.codex/hooks.json`, creating the file
  holding only that group if it is absent.
- Recognises its own group by the command path it points at (D14), and rewrites it in place
  when present, so a second run is a no-op.
- Leaves every other hook exactly where it is (D26).
- **Refuses and changes nothing** only when the file is not valid JSON, or is valid JSON but
  not an object. It reports what it found and exits non-zero.

A refusal **warns without failing the install**, for the reason `protocol/sensitivity.md`
gives for its own writer: `install.sh` runs under `set -euo pipefail`, and a non-zero writer
would abort it mid-run and break its own idempotence check for an unrelated reason.

### Failing open

Every path here fails open, without exception. A hook that exits non-zero, times out, or
returns unparseable output must let the turn proceed unchanged. A missing or malformed record
or wording list is treated as empty rather than repaired. The hook entry carries a 10-second
timeout, and in practice reads a handful of small files.

This is the most important property in the Spec, and the reason is the asymmetry of cost: a
turn this feature blocks or delays is a failure you notice every time, while a turn it fails to
improve is only today's behaviour.

### Documents this changes

- **New: `protocol/seen.md`** — the canonical definition of all of the above. The one place
  the rules live, in the repository's own pattern.
- **New: `seen/set.sh`** and **`seen/test/run.sh`** — the writer and its fixture suite,
  following `sensitivity/set.sh` and `sensitivity/test/run.sh` exactly, including that the
  suite never touches a real `~/.claude`.
- **New: `seen/hook.sh`** — the one script both harnesses' hook entries point at.
- **New: `seen/AGENTS.md`** — the directory router, per `protocol/routers.md`.
- **Edited: `protocol/planning.md`, `plan-review.md`, `implementation.md`,
  `verification.md`** — each gains the write-and-read step from D19, stated once and pointing
  at `protocol/seen.md`, never restating its rules.
- **Edited: `protocol/templates/`** — `SEEN.md` joins the template set.
- **Edited: `install.sh`, `AGENTS.md`, `README.md`** — the new call, the new directory in the
  router table and the layout block.

`protocol/writing.md` is **not** edited. Its rules are correct and stay exactly as they are;
this feature supplies the fact they were always missing.

### Edge cases

- **No plan in the repository, or not a repository.** The hook carries only the wording list
  and the gap.
- **Two sessions in one repository.** Both append to the same `SEEN.md`; single-line appends
  do not interleave (D24). Whichever session's hook fires first shows an entry, and the other
  does not repeat it — one reader either way (D23).
- **Two worktrees of one repository.** Each has its own `SEEN.md` in its own checkout, and the
  last-message files are distinguished by the path hash (D12).
- **A struck wording entry suggested again.** Not made; matched on the quoted phrase (D29).
- **Settings already hold other hooks.** Ours is added beside them (D26).
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
bash seen/test/run.sh                      # writer, hook and record-format assertions, exit-code gated
./install.sh && ./install.sh               # idempotent; git status --porcelain stays empty
bash install/test/run.sh                   # presence-aware installer assertions still pass
bash sensitivity/test/run.sh               # the neighbouring writer is unaffected
```

`seen/test/run.sh` asserts, against a throwaway `HOME` and fixture repository, never a real
one: the hook returns nothing when no entry is unshown and the wording list is empty; it
returns an unshown entry once and appends its `shown` line; a gap of four hours or more is
reported once and not on the next message; a malformed record or wording file yields nothing
and exit 0; a suggestion matching a struck phrase is not made; and the installer adds its group
beside an existing foreign hook, is a no-op on a second run, and refuses a non-JSON file with a
warning and no change.

Plus one live check per harness that cannot be faked at a seam, with the hook installed at
**user** scope inside a throwaway `HOME`, the scope the installer actually writes: seed a
`SEEN.md` with one unshown entry, fire a real `claude -p` (and `codex exec`) turn, and assert
the injected context named it and a `shown` line was appended. Then fire a second turn and
assert **nothing** was injected — the too-eager failure D3 calls the dangerous one, and the
assertion Round 1 found missing.

## Deferred

Work this plan left undone because of the kind of build it states. Not "not worth fixing" —
that is Accepted Risks. This is what the next plan starts from if this one earns a second life.

| Source | What was skipped | Why it is out of scope here | What it would take |
|---|---|---|---|
| planning | Recording hidden work done in ordinary chat, through a subagent-finished hook (W8) | D21 accepts that ordinary chat writes no entries. The hook exists on both harnesses but was never fired, and its payload is unverified | Fire `SubagentStop` / `subagent_stop` once on each harness, confirm what the payload carries, then one more branch in `seen/hook.sh` |
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

- 2026-09-24 — Q8 settled as D28 (stages suggest wording entries; you answer yes or no in
  one short line, never editing the file). D29 defaulted. Watch list emptied: W6 and W7
  settled, W8 deferred. `MAP.md` citations corrected; `IDEA.md`'s stale harness constraint
  corrected as a Constraints edit. Stage 1 exit: every graph under `graphs/` holds only
  `proposed` entries and none contains a container node, so there are no rejections for the
  Spec to account for. Status `ready-for-review`; Round 2 should treat the whole Spec as
  changed since Round 1.
- 2026-09-24 — Q7 settled as D21 (a file-reading hook covers ordinary chat too). Defaulted
  D22–D27 to settle the hook-shaped Round 1 findings; rewrote the files, hook, installer,
  failing-open, edge-case and validation sections. Added W8. Open: Q8 (who proposes wording).
- 2026-09-24 — Q6 settled as D19 (the stage writes the record as it works), with D20
  retiring the check lane. Spec summary and the check section rewritten. Of Round 1's
  upheld findings, four are dissolved by D19 (circular gate, detached-lane race, one-turn lag,
  transcript instability — no transcript is read) and the brief finding is answered by D19's
  unit list. The rest — ordering, concurrent writes, plan-or-session selection, validation,
  struck-entry identity, the register's reach, the installer's refusal, `SEEN.md` tracking,
  the "marginal" wording, the home-directory roots — wait on Q7, since several vanish if
  hooks go.
- 2026-09-24 — Resumed on a rebuilt `arriving-cold` branch, now based on main after `remember-me`; the plan content is unchanged. Drew `graphs/who-writes-what-you-havent-seen.json` for Q6. Added W6.
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
