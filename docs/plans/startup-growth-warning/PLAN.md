---
slug: startup-growth-warning
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-17
---

# Warn when agent sessions start bigger again

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

None.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Measure startup tokens, not the tool list | Deferred tools appear only as a placeholder in transcripts, and the request-shape record is undocumented (MAP.md §5); token usage on the first assistant record is stable | defaulted |
| 2 | The machine records each Claude session's startup sample when it handles that session's first Stop hook: it reads the first usable assistant record (model not `<synthetic>`, input + cache write + cache read > 0) from the transcript path it already gets, and appends `{at, kind: "startup", cli_session_id, cli_version, startup_tokens}` to the session ledger once per session | Stop already carries `transcript_path` (MAP.md §3–4); one line per session keeps the check a ledger read | defaulted |
| 3 | The lead fetches the warnings itself during its Ready check (a new `wc.js` command backed by a ledger-only machine route) and puts them in an optional `warnings` field on the approval card; the hub stores and draws them and never re-computes them | The hub's Ready gate compares only `ready` (MAP.md §7), so a separate lead-supplied field cannot consume a Start press; no hub cache or background poll is needed — the part of the cut design that drew most findings | defaulted |
| 4 | Any failure in capture or check means no sample or no warning, never an error on a start, hook, card or build | IDEA.md constraint | defaulted |
| 5 | Growth means: per role, the median startup on the newest setup is at least 5,000 tokens above the previous setup's, with at least 3 samples on each. A setup is the Claude Code version plus the turned-off tool list | Ties the warning to an update, needs little history, and role-text edits within one setup never trip it. Including the tool list means turning off a new tool clears the warning once 3 sessions run with the new list | user (setup = version + tool list: defaulted) |
| 6 | Supersedes 2: no capture in hooks. The check reads each Claude start's first usable assistant record on demand, from the machine's kept transcript copy (else the CLI's own transcript), joined from the ledger start line. The start line gains `deny_hash`; start lines without it count as the tool list shipped in PR #100 | Hook capture drew race, durability and latency findings (as in lean-sessions Decision 54); the copies are kept after archive and today's ledger lines become the baseline at once | review-round-1 |
| 7 | Supersedes the "previous setup" part of 5: the newest setup is compared with the lowest median among earlier setups seen in the 30 days before it, not with the one just before | Otherwise the grown setup becomes the reference at the next release and the leak goes unnoticed | review-round-1 |
| 8 | One warning line for all roles, naming each grown role; wording says the increase is measured and the cause is a guess | Every role shares one tool list; per-role lines repeat; the setup change alone cannot prove the cause | review-round-1 |
| 9 | `wc.js startup check` has a 3-second total deadline; the route stops scanning after 1.5 seconds and answers with what it has; a refused approval card is posted again without `warnings` | The check must never hold up the approval card; an older hub refuses the new field | review-round-1 |
| 10 | Samples are compared only within the same role and model | A model change alters tokenizer and built-in prompt and would read as growth | review-round-2 |
| 11 | Each setup needs at least 5 samples (was 3) | A median of 5 tolerates two unusually long briefs | review-round-2 |
| 12 | One 30-day window anchored on the newest sample's time bounds every sample used, so a grown setup stops warning once all lower samples are over 30 days older | Single definition; also bounds how long a growth Collin keeps warns | review-round-2 |
| 13 | Supersedes the repost part of 9: the machine, not the lead, retries an approval card without `warnings` when the hub refuses it, in both the live relay and the spool drain | A spooled card's refusal never reaches the lead | review-round-2 |
| 14 | The route's 1.5-second budget covers ledger reading, transcript discovery and reads; the ledger is read from its last 512 KB only; one check runs at a time | The client deadline cannot stop server work | review-round-2 |
| 15 | Supersedes 5, 6 (deny hash and setups), 7, 10, 11, 12 and 14: growth means a role's last 5 Claude sessions have a median startup above a fixed per-role limit kept in code (today's typical size + about 5,000) | Claude Code updates every 1-3 days and this machine runs few Claude sessions, so a version-based comparison rarely has enough samples; Collin chose Fixed limit | user |
| 16 | Supersedes 3 and 9: the machine attaches the warning to a lead's approval card in its card route before spooling; no `wc.js` command and no lead rule | With Decision 13's resend helper in place, this is less code than a CLI command, its deadline and a lead step, and the lead cannot drop or paraphrase it | review-round-3 |
| 17 | Samples come only from the machine's kept transcript copies, read asynchronously within a 1-second budget; no CLI transcript discovery | The discovery helper probes synchronously and could stall the service | review-round-3 |

## Spec

### What changes, in one paragraph

When a lead posts an approval card, the machine looks at each role's last 5 Claude
sessions on that machine, reads how many tokens each one's first call used from the
transcript copies it already keeps, and compares the median with a fixed limit for that
role. If any role is over its limit, the machine adds one warning line to the card before
passing it on. The thread page shows it under the Ready result as a "Heads-up". Nothing
about it can disable, delay or consume Start building, and any failure just means no
warning.

### Limits (machine)

- `machine/adapters/claude.js`, next to `DISALLOWED_TOOLS`, exports
  `STARTUP_LIMITS = { lead: 46000, 'sub-lead': 46000, worker: 32000, verifier: 30000, reviewer: 28000, mapper: 28000 }`
  with a comment: typical startup measured 2026-11-17 plus about 5,000; raise a limit when
  that role's starting text grows. A role not in the table is never checked.
- Measured on 2026-11-17 (Claude Code 2.1.326-327, claude-opus-5-5): lead 39.6k-40.7k,
  reviewer 21.4k-22.8k. Sub-lead, worker, verifier and mapper had no samples; their limits
  are set from their role text size relative to these (lean-sessions measured a worker at
  about 21k plus its brief).

### Sampling (machine)

- `startupWarning()` in `machine/service.js` (or a small module beside it):
  1. Read the last 512 KB of `<stateDir>/session-ledger.jsonl` asynchronously (whole file if
     smaller; first partial line dropped; missing file: no warning). Keep start lines (no
     `kind` field) with `provider: "claude"`, a `cli_session_id`, a `name`, a `thread_id`,
     and a `role` in `STARTUP_LIMITS`. Skip lines that do not parse. Sort newest first by `at`.
  2. Walk them newest first. For each role, stop once it has 5 samples. A start's sample:
     read `<stateDir>/transcripts/<thread_id>/<name>.jsonl` asynchronously line by line, at
     most the first 4 MB, skipping lines that do not parse; the first record with
     `type: "assistant"`, `sessionId` equal to `cli_session_id` when the record has one,
     `message.model` not `<synthetic>`, and
     `input_tokens + cache_creation_input_tokens + cache_read_input_tokens > 0` (missing
     counts are 0). Missing file or no such record: no sample; go on to the next start.
     Examine at most 100 starts in total.
  3. Found samples are cached in memory by `cli_session_id` (`{tokens, model}`); misses
     are not cached.
- **Budget.** The whole of steps 1-2 races a 1-second timer. At the timer, the warning is
  computed from the samples gathered so far; the walk stops before its next read (all
  reads are async, so nothing blocks the service). Only one walk runs at a time; a card
  arriving while one runs waits for that walk's result.
- **Rule.** A role with 5 samples is over when their median (the 3rd largest) is above
  its limit. Fewer than 5 samples: not checked.
- **Text.** When any role is over, one string, roles in the order of `STARTUP_LIMITS`,
  numbers rounded to the nearest 100 with thousands separators:
  `Claude <role> sessions start at about <median> tokens, over the <limit> limit[; <role> ...]. A new Claude Code tool may need turning off, or the limit raising if our own instructions grew.`
  Built from numbers only, so it always passes the card validator.

### The approval card

- `viewer/app/card.js` approval schema gains optional `warnings`: an array of 1 to 10
  non-empty strings. Agents never send it: as with `sudoMachineFields` (`viewer/app/card.js:56-58,152`),
  the field is allowed only when `validate` is called with `{ machine: true }`, which the
  hub's call at `viewer/app/cards.js:59` already passes.
- `machine/service.js` `/v1/agent/cards` (`:1256`): for a lead's `approval` card, after
  validation and before spooling (beside the sudo step), run `startupWarning()`; on a
  string, set `warnings: [string]`; on none or any error, leave the card unchanged.
- **Older hub.** The machine forwards cards in two places, the live relay (`:1276`) and
  the spool drain (`drainSpoolNow`, `:880`). Both go through one helper: when the hub
  answers 4xx to an `approval` card that has `warnings`, it sends the same card once more
  without `warnings`, and that second answer decides success or rejection as today.
- `protocol/app/cards-lead.md` approval table gains the row `warnings` — "Added by the
  machine, never by the lead: startup-size warnings. Shown as information; never affects
  Start building."
- `viewer/pages/thread.js` approval rendering (`:590-629`): when `warnings` is a non-empty
  array, show it under the Ready status as a list headed "Heads-up", in the existing
  amber notice style, as text (never HTML). Start building's enabled state still depends
  only on `ready.ok` and the existing conditions.
- The hub's Re-check and Start building paths (`viewer/app/threads.js:272-337`) only replace
  `card.ready`; `warnings` stays as attached. A fresh approval card gets a fresh check.
- `machine/API.md`: note that lead approval cards may gain `warnings`.

### Boundaries and non-goals

- Claude sessions only. No lead-rule change.
- No automatic changes to the turned-off tool list or the limits; no dashboard; no warning
  elsewhere; no hub cache, poll or Ready-gate change. Ledger format unchanged.

### Edge cases

- A session that ended before any reply, or whose transcript was never copied (no Stop
  hook yet): no sample; the walk goes on to older starts.
- A role with under 5 samples in the last 100 starts: not checked.
- Two long briefs among 5 samples: the median ignores them.
- An older hub refusing `warnings`, live or after an outage: the card arrives without them.
- Corrupt ledger or transcript lines are skipped.

### Validation

- `bash machine/test/run.sh`, with fixture ledgers and kept transcripts: a lead approval
  card gains `warnings` when a role's 5 samples have median above its limit, and not at
  exactly the limit; 4 samples: no warning; two long outliers among 5: no warning; two roles
  over: one string naming both; `<synthetic>` and zero-usage records skipped; records of
  another `sessionId` skipped; missing copy skipped and an older start used; non-Claude
  and unlisted roles ignored; a ledger over 512 KB read from its tail; corrupt lines; a
  transcript read that stalls returns the card within about 1 second, with no warning, and
  the service answers other requests meanwhile; two approval cards at once run one walk;
  a non-approval card and a non-lead card are untouched; any thrown error leaves the card
  unchanged and accepted. Forwarding: an `approval` with `warnings` refused 4xx by the hub
  is resent without them on the live relay and on the spool drain after an outage; a card
  without `warnings` refused 4xx is not resent.
- `node --test viewer/test/*.test.js`: `card.js` refuses `warnings` from an agent, accepts
  1-10 non-empty strings with `machine: true`, refuses empty strings and 11 items;
  `protocol-rules.test.js` still finds exactly one section per kind.
- `npm --prefix viewer run test:browser`: an approval card with warnings shows the
  Heads-up list and Start building is enabled when `ready.ok`; without warnings no list.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| Growth that stays under a role's limit, or comes from something other than tools (connectors, skills, a model change), is not attributed; the warning only says the limit was crossed | IDEA.md wants a heads-up, not a diagnosis; the text names both likely causes | 1, 3 |
| Limits go stale as role files grow, giving false warnings until raised | Collin chose fixed limits knowing this; the text tells him which limit | 3 |
| Sessions with no kept transcript copy give no sample | Kept copies are made on every Stop hook; the walk uses older starts instead | 3 |
| Limits for sub-lead, worker, verifier and mapper are estimates without measured samples | They can be raised by editing one constant | 3 |

## Review Rounds

### Round 1 — 2026-11-17

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | blocking | wc.js check can hang before the approval card is posted | upheld | Decision 9: 3 s end-to-end deadline, route 1.5 s budget |
| mechanics | blocking | Overlapping hooks can append duplicate samples | upheld | Decision 6: no hook capture at all |
| mechanics | blocking | Append and flag persistence not atomic across restart | upheld | Decision 6 |
| mechanics | major | Capture adds I/O to the synchronous Stop hook | upheld | Decision 6 |
| mechanics | major | No baseline at rollout; legacy rows lack hash | upheld | Decision 6: legacy hash; existing ledger lines are samples |
| mechanics | major | `at` undefined; late replay can reorder setups | upheld | Sample time is the start line's `at` (Decision 6) |
| mechanics | major | Session interrupted after first reply is never captured | upheld | On-demand read covers it (Decision 6) |
| mechanics | major | Older hub refuses `warnings` and the card is lost | upheld | Decision 9: lead reposts without the field |
| mechanics | minor | Warning wording overclaims the cause | upheld | Decision 8 |
| mechanics | minor | Route `roles` payload unspecified | upheld | Payload dropped |
| intent | major | Comparing with the previous setup lets growth leak at the next release | upheld | Decision 7 |
| intent | major | Hook capture reintroduces what lean-sessions Decision 54 dropped | upheld | Decision 6 |
| intent | minor | Machine could attach warnings in the card route instead of the lead | declined | The card route forwards and spools; attaching there needs a strip-and-retry path in both live relay and spool drain for an older hub, more code than one lead rule; paraphrase by the lead is harmless |
| intent | minor | One line per role repeats the same cause | upheld | Decision 8 |
| intent | minor | Tool-list-only wording points the wrong way | upheld | Decision 8 |
| intent | minor | Growth without a setup change never warns | accepted-risk | Accepted Risks |

### Round 2 — 2026-11-17

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 1:**
- Capture moved out of hooks: samples read on demand from kept transcript copies; start line gains `deny_hash`; legacy lines count as the PR #100 list (Decision 6)
- Baseline is the lowest earlier setup within 30 days, not the previous one (Decision 7)
- One combined warning line with hedged wording (Decision 8)
- Deadlines (3 s in `wc.js`, 1.5 s scan budget in the route) and the lead's repost without `warnings` (Decision 9)
- Route returns only `warnings`; Edge cases, Validation and Accepted Risks rewritten

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Model changes read as growth | upheld | Decision 10 |
| intent | minor | Brief length moves a 3-sample median | upheld | Decision 11 |
| intent | minor | A kept growth warns with no dismiss | accepted-risk | Accepted Risks |
| mechanics | blocking | A spooled approval refused by an older hub is lost | upheld | Decision 13 |
| mechanics | blocking | Kept copy without the record skips the CLI transcript | upheld | Fallback when the copy has no usable record |
| mechanics | major | 30-day window ambiguous | upheld | Decision 12 |
| mechanics | major | Budget doesn't bound ledger read and discovery | upheld | Decision 14 |

### Round 3 — 2026-11-17

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 2:**
- Samples grouped by role and model (Decision 10); 5 samples per setup (Decision 11)
- One 30-day window anchored on the newest sample (Decision 12)
- Machine resends a refused approval without `warnings` on live relay and spool drain; lead repost rule removed (Decision 13)
- Route budget covers ledger, discovery and reads; ledger tail read; checks serialized (Decision 14)
- Kept copy without a usable record falls back to the CLI transcript

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | Claude Code updates every 1-3 days, so a setup rarely reaches 5 samples and the warning almost never shows | user-decision | Collin chose Fixed limit (Decision 15) |
| intent | minor | RE-RAISE: machine attaching warnings is now cheaper than the lead copying them | upheld | Decision 15 |
| intent | minor | One-paragraph summary out of date | upheld | Rewritten |
| mechanics | blocking | Deadline cannot stop a synchronous transcript probe already running | upheld | Decision 17 |
| mechanics | major | A first sample on a third setup clears an existing warning | upheld | Decision 15 |
| mechanics | major | Configured model may be an alias; group by the record's model | upheld | Moot: no model grouping (Decision 15); model change is an accepted risk |
| mechanics | blocking | CLI passes warnings the card validator rejects | upheld | No CLI; machine builds the text from numbers (Decision 16) |

### Round 4 — 2026-11-17

**Lanes:** pending.

**Changed since Round 3:** the growth rule replaced by fixed per-role limits (Decision 15); the machine attaches the warning in its card route, no `wc.js` command or lead rule (Decision 16); samples only from kept copies with async reads (Decision 17). Spec, Edge cases, Validation and Accepted Risks rewritten: review the whole Spec in depth.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
