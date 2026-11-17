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

## Spec

### What changes, in one paragraph

The machine's session ledger notes which turned-off tool list each Claude session started
with. A lead's Ready check asks the machine for warnings: the machine reads each recent
Claude session's first call from its transcript (its size and Claude Code version) and,
per role, compares sessions on the newest setup with the lowest earlier one. Any warning goes on
the approval card as information. Nothing about the warning can disable, delay or consume
Start building.

### Recording what the check needs (machine)

- `machine/adapters/claude.js`: export `denyListHash()` = first 12 hex of sha256 of
  `DISALLOWED_TOOLS` sorted and joined with `,`, and `LEGACY_DENY_HASH`, the same hash of
  the list as it was at commit `c81c022` (computed once and written as a literal, with a
  test that recomputes it from that list written out in the test).
- The ledger start line (`machine/service.js:558`) gains `deny_hash` for Claude sessions
  (`denyListHash()` at start time). Nothing else is written; hooks are unchanged.

### Checking for growth (machine route + `wc.js`)

- New route `GET /v1/agent/startup-check`, authorized as an agent (any role, like
  `/v1/agent/session`), documented in `machine/API.md`. Returns `200 {"warnings": [string]}`
  (zero or one string). Never 5xx for data problems: any error inside gives `{"warnings": []}`.
- **Budget.** One deadline, 1.5 seconds from the moment the route starts, covers every
  step below: ledger read, transcript discovery and transcript reads. Each step checks it
  before starting; once passed, the route stops gathering and applies the rule to the
  samples it has. Checks are serialized: a request arriving while one runs waits for that
  one's result and returns it.
- **Samples.** Read the last 512 KB of `<stateDir>/session-ledger.jsonl` (the whole file if
  smaller; the first partial line dropped; missing file: no warnings), keep start
  lines (no `kind`) with `provider: "claude"` and a `cli_session_id`, skip lines that do not
  parse, and take the newest 300 by `at`, newest first. For each, look for a sample first in
  the kept copy `<stateDir>/transcripts/<thread_id>/<name>.jsonl`; if it is missing or holds
  no usable record, in `adapters.claude.findTranscript({cli_session_id}, account_dir)`
  (its result path cached per `cli_session_id`). Read each line by line, at
  most the first 4 MB, skipping lines that do not parse. The sample is the first record with
  `type: "assistant"`, `sessionId` equal to `cli_session_id` when the record has a
  `sessionId`, `message.model` not `<synthetic>`, and
  `input_tokens + cache_creation_input_tokens + cache_read_input_tokens > 0` (missing counts
  are 0). No such record or no transcript: that start has no sample. A sample's time is the
  start line's `at`; its setup is `<record.version or "unknown">|<deny_hash or LEGACY_DENY_HASH>`;
  its group is the start line's `role` plus its `model` (`null` is its own model).
- Found samples are cached in memory by `cli_session_id` (they never change); misses are
  not cached.
- **Rule.** Only samples whose time is within 30 days before the newest sample's time are
  used. The newest setup is the setup of the newest sample. For each group (role + model):
  the newest setup's median over the group's latest 20 samples on it (at least 5 needed,
  else the group is skipped); the baseline is the lowest median (latest 20, at least 5)
  among the group's other setups. No baseline: skipped. Median of an even count is the mean
  of the middle two. The group has grown when newest median minus baseline is at least
  5,000.
- **Text.** When any role has grown, one warning, groups in role then model order, numbers rounded to
  the nearest 100 with thousands separators:
  `Claude sessions now start bigger than before (now on Claude Code <version>): <role> on <model> about <d> more tokens (<baseline> before, <newest> now)[; <role> on <model> ...]. A new Claude Code tool, or a tool turned back on, may be the cause; the increase is measured, the cause is a guess.`
- `wc.js startup check` calls the route through the local machine service the way other
  `wc.js` agent calls do, with a 3-second deadline covering connection, headers and the whole
  body, and prints one JSON line `{"warnings": [...]}`. On any failure (deadline, refused,
  bad JSON, a body without a `warnings` array of strings) it prints
  `{"warnings": [], "error": "<reason>"}` and exits 0. Usage errors exit non-zero.

### The approval card

- `viewer/app/card.js` approval schema gains optional `warnings`: an array of non-empty
  strings, at most 10 items. Absent is valid. Anything else is refused as today.
- `protocol/app/cards-lead.md` approval table gains the `warnings` row: "Startup-growth
  warnings from `wc.js startup check`, copied verbatim. Shown as information; never affects
  Start building."
- `viewer/pages/thread.js` approval rendering (`:590-629`): when `warnings` is a non-empty
  array, show them under the Ready status as a list headed "Heads-up", in the existing
  amber/notice style, with text set as text (never HTML). Start building's enabled state
  still depends only on `ready.ok` and the existing conditions.
- **Older hub.** The machine forwards cards to the hub in two places, the live relay in the
  `/v1/agent/cards` route (`machine/service.js:1276`) and the spool drain
  (`drainSpoolNow`, `:880`). Both go through one helper: when the hub answers 4xx to an
  `approval` card that has `warnings`, it sends the same card once more without
  `warnings`, and only that second answer decides success or rejection.
- The hub's Re-check and Start building paths (`viewer/app/threads.js:272-337`) only replace
  `card.ready`; `warnings` stays as the lead posted it. Not re-computed by the hub.

### Lead rules

- `protocol/app/lead.md` step 6.2, Ready check: also run
  `node <root>/viewer/app/wc.js startup check` and copy its `warnings` onto the approval
  card unchanged; omit the field when the list is empty or the command reports an error.
  A warning never changes `ready` and never stops the approval card
  being posted.

### Boundaries and non-goals

- Claude sessions only. GPT and Gemini sessions write no samples.
- No automatic changes to the turned-off tool list; no dashboard; no warning elsewhere.
- No hub cache, background poll or Ready-gate change.
- Ledger is never pruned (as today).

### Edge cases

- A session that ends before any assistant reply: no sample.
- A session interrupted after its first reply: its transcript still holds the record, so it counts.
- A group with samples on only one setup, or a setup with fewer than 5 samples: no comparison for it.
- A role moved to another model: a new group, so no warning until both its setups have samples.
- A rollback to an older Claude Code version: just another setup.
- Growth that persists: it keeps warning until the newest setup's median drops (for example the tool is turned off, which is a new setup) or the lower samples are all more than 30 days older than the newest sample.
- Corrupt ledger or transcript lines are skipped.

### Validation

- `bash machine/test/run.sh`: a Claude start line carries `deny_hash`, a Codex one does not;
  `LEGACY_DENY_HASH` matches the c81c022 list. `/v1/agent/startup-check` on fixture ledgers
  and transcripts: no ledger; kept copy preferred, `findTranscript` fallback; `<synthetic>`
  first record skipped; records of another `sessionId` skipped; a kept copy without a usable
  record falls back to the CLI transcript; start line without `deny_hash` grouped with the
  legacy list; one setup only; newest with 4 samples (none); growth of 4,900 (none) and
  5,000 (warn); baseline is the lowest earlier setup, not the latest (A 17k, B 23k, C 23k:
  warns on C); a model change is a separate group (no warning); samples over 30 days older
  than the newest ignored; two roles in one line; shrink; 20-sample window; corrupt lines;
  a ledger over 512 KB read from its tail; a slow ledger read, a slow discovery and a slow
  transcript read each stop at 1.5 s and still answer 200; two concurrent requests run one
  check; unauthorized request refused. Card forwarding: an `approval` with `warnings` refused
  4xx by the hub is resent without them, on the live relay and on the spool drain after an
  outage; a card without `warnings` refused 4xx is not resent.
- `node --test viewer/test/*.test.js`: `card.js` accepts approval with and without
  `warnings`, refuses non-array, empty strings and 11 items; `wc.js startup check` prints
  the route's warnings, and prints `warnings: []` with `error` when the service is down,
  stalls past 3 s mid-body, or returns a malformed body; `protocol-rules.test.js` still
  finds exactly one section per kind.
- `npm --prefix viewer run test:browser`: an approval card with warnings shows the
  Heads-up list and Start building is enabled when `ready.ok`; without warnings no list.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| Growth with no change of Claude Code version or tool list (new connectors, skills, plugins, role text) never warns | IDEA.md targets updates; a moving-average rule for this drew most of the lean-sessions findings | 1 |
| A growth Collin decides to keep warns on every approval card until its lower samples are 30 days older than the newest; no dismiss button | Approval cards are occasional and the warning says the cause is a guess; a dismiss control is new UI for a rare case | 2 |
| Sessions older than the newest 300 Claude starts, or whose transcripts Claude Code has cleaned up and the machine never copied, give no sample | A comparison needs only 5 samples per group within 30 days | 1 |

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

**Lanes:** pending.

**Changed since Round 2:**
- Samples grouped by role and model (Decision 10); 5 samples per setup (Decision 11)
- One 30-day window anchored on the newest sample (Decision 12)
- Machine resends a refused approval without `warnings` on live relay and spool drain; lead repost rule removed (Decision 13)
- Route budget covers ledger, discovery and reads; ledger tail read; checks serialized (Decision 14)
- Kept copy without a usable record falls back to the CLI transcript

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
