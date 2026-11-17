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

## Spec

### What changes, in one paragraph

When a Claude agent session's first turn ends, the machine notes how many tokens that first
call used, and which Claude Code version and turned-off tool list it ran with, as one extra
line in its session ledger. A lead's Ready check asks the machine for warnings: for each
role, it compares sessions on the newest setup with the previous one. Any warning goes on
the approval card as information. Nothing about the warning can disable, delay or consume
Start building.

### Recording a sample (machine)

- `machine/adapters/claude.js`: export a `denyListHash()` = first 12 hex of sha256 of
  `DISALLOWED_TOOLS` sorted and joined with `,`.
- At start (`machine/service.js` start, around `:538-560`), for a Claude session only,
  store `deny_hash` on the session record so a deploy between start and first Stop does not
  change it.
- In `hook()` (`machine/service.js:910`), for a Claude session whose record lacks
  `startup_recorded`, on any event with `transcript_path` and also on `turn-ended`:
  read the transcript (`event.transcript_path`, else `current.source_transcript`) line by
  line, at most the first 4 MB, skipping lines that do not parse. The sample is the first
  record with `type: "assistant"`, `message.model` not `<synthetic>`, and
  `message.usage.input_tokens + cache_creation_input_tokens + cache_read_input_tokens > 0`
  (missing counts are 0). `cli_version` is that record's `version` (string), else
  `"unknown"`.
- On a sample found, append to `<stateDir>/session-ledger.jsonl`:
  `{"at", "kind": "startup", "name", "role", "cli_session_id", "cli_version", "deny_hash", "startup_tokens"}`,
  then set `startup_recorded: true` on the record and persist it as the service persists
  other session fields. No sample yet: do nothing; a later hook tries again.
- Exactly one sample per session: the flag is checked and set inside the per-session
  hook handling (hooks for one session are already processed in order; spooled replays go
  through the same `hook()`), and set only after a successful append.
- Any error (missing file, read error, append error) is logged and swallowed: the hook's
  response and every other effect are unchanged.
- The existing start line is unchanged. Readers tell lines apart by `kind`: start lines
  have none.

### Checking for growth (machine route + `wc.js`)

- New route `GET /v1/agent/startup-check`, authorized as an agent (any role, like
  `/v1/agent/session`). Documented in `machine/API.md`. Returns
  `200 {"warnings": [string], "roles": {<role>: {"newest": {...}, "previous": {...}|null}}}`.
- It reads the ledger and keeps only lines with `kind: "startup"` and a numeric
  `startup_tokens`; a missing ledger gives `{"warnings": [], "roles": {}}`.
- Per role: a sample's setup is `cli_version + "|" + deny_hash`. Order the role's samples
  by `at`. The **newest setup** is the setup of the latest sample. The **previous setup**
  is, among the other setups, the one whose latest sample is most recent. Each setup's
  median is over its latest 20 samples (median of an even count = mean of the middle two,
  rounded). Each setup needs at least 3 samples, else the role gives no warning.
- Warning when `newest median - previous median >= 5000`. Text, one per role, numbers
  rounded to the nearest 100 with thousands separators:
  - version differs: `Claude <role> sessions now start about <d> tokens bigger since Claude Code <newest version> (<old> before, <new> now). A new Claude Code tool may need turning off.`
  - only the tool list differs: same, with `since the turned-off tool list changed` in place
    of `since Claude Code <version>`.
- Warnings ordered by role name. Shrinking or growth under 5,000 gives none.
- `wc.js startup check` calls the route through the local machine service the way other
  `wc.js` agent calls do (session token, port 7374) and prints one JSON line:
  `{"warnings": [...]}`. On any failure it prints `{"warnings": [], "error": "<reason>"}`
  and exits 0. Usage errors exit non-zero with a usage line.

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
- The hub's Re-check and Start building paths (`viewer/app/threads.js:272-337`) only replace
  `card.ready`; `warnings` stays as the lead posted it. Not re-computed by the hub.

### Lead rules

- `protocol/app/lead.md` step 6.2, Ready check: also run
  `node <root>/viewer/app/wc.js startup check` and copy its `warnings` onto the approval
  card unchanged; omit the field when the list is empty or the command reports an error.
  A warning never changes `ready` and never stops the approval card being posted.

### Boundaries and non-goals

- Claude sessions only. GPT and Gemini sessions write no samples.
- No automatic changes to the turned-off tool list; no dashboard; no warning elsewhere.
- No hub cache, background poll or Ready-gate change.
- Ledger is never pruned (as today).

### Edge cases

- A session that ends before any assistant reply: no sample.
- The same session's hooks replayed from the spool: still one sample.
- A role with samples on only one setup: no warning.
- A role's newest setup with fewer than 3 samples: no warning for that role until it has 3,
  even if the previous one had grown.
- A rollback to an older Claude Code version: it is just another setup; compared the same way.
- Corrupt ledger lines are skipped.

### Validation

- `bash machine/test/run.sh`: a Claude Stop hook with a fixture transcript appends exactly
  one `startup` line with the right sum, version and deny hash; a second Stop and a spooled
  replay append nothing; a `<synthetic>` first record is skipped; a transcript with no
  usable record appends nothing and a later Stop records it; an unreadable transcript or a
  failing append leaves the hook response unchanged; a Codex session writes nothing.
  `/v1/agent/startup-check`: no ledger; one setup only; newest with 2 samples; growth of
  4,900 (none) and 5,000 (warn); version change vs tool-list-only change wording; shrink;
  20-sample window; corrupt lines; unauthorized request refused.
- `node --test viewer/test/*.test.js`: `card.js` accepts approval with and without
  `warnings`, refuses non-array, empty strings and 11 items; `wc.js startup check` prints
  the route's warnings and prints `warnings: []` with `error` when the service is down;
  `protocol-rules.test.js` still finds exactly one section per kind.
- `npm --prefix viewer run test:browser`: an approval card with warnings shows the
  Heads-up list and Start building is enabled when `ready.ok`; without warnings no list.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-17

**Lanes:** pending.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
