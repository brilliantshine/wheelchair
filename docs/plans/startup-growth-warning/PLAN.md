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
| 18 | Only lead and reviewer sessions are checked, against a typical size per role; the limit is typical + 5,000 and the text gives the growth over typical | Every role shares one tool list, so these two measured, steady roles catch any tool growth; brief-driven roles would mostly track brief length | review-round-4 |
| 19 | Supersedes the budget and timing of 17: the warning is computed in the background (at service start, every 10 minutes, and after each approval card) and the card route only reads the last result, never waiting | A card must not wait on a scan; no waiter can pile up behind a stalled read | review-round-4 |
| 20 | A failed or abandoned refresh clears the warning; an abandoned scan stops at its next read and never writes the cache; a trigger during a refresh queues exactly one more | A failed check shows no warning (IDEA.md); no scans pile up; a new sample is picked up promptly | review-round-5 |
| 21 | Only the spool drain strips and resends; the live relay, on a 4xx to an approval with `warnings`, leaves the spool file and triggers the drain | One owner (the drain is already single-flight per kind) from refusal through rewrite, resend and removal | review-round-5 |
| 22 | Supersedes 13 and 21: no older-hub fallback. Card forwarding is unchanged; a machine newer than its hub may have a lead's approval card refused (`unknown field: warnings`) until the hub is updated | The Ready check already fails "service out of date" in that window (`viewer/app/ready.js:13-16`); the fallback drew a blocking finding in rounds 2, 4, 5 and 6 | review-round-6 |
| 23 | A refresh's error handling, abandonment and every read are gated on its id being current: a non-current refresh destroys its open stream, publishes nothing and clears nothing | A late failure must not clear a newer result; an abandoned scan must stop reading mid-file | review-round-6 |
| 24 | Supersedes the abandonment parts of 19, 20 and 23: no timeout, refresh ids or stream destruction. One refresh in flight, one coalesced rerun, publish only on finish; an error clears the warning | It only guarded a local read hanging past 30 s while no card waits on it; a hang just leaves the last result showing | review-round-7 |
| 25 | When `card.js` refuses a lead's approval card with `unknown field: warnings`, the lead posts a `needs` card saying the hub is older than this machine and needs updating | The lead never sent the field and cannot remove it; Collin would otherwise see no approval card | review-round-7 |

## Spec

### What changes, in one paragraph

In the background, the machine looks at the last 5 Claude lead sessions and the last 5
Claude reviewer sessions on that machine, reads how many tokens each one's first call used
from the transcript copies it already keeps, and compares each role's median with that
role's typical size. When a lead posts an approval card, the machine attaches the latest
result: if a role is more than 5,000 over typical, one warning line saying by how much. The
thread page shows it under the Ready result as a "Heads-up". The card is never held for the
check, nothing about it can disable or consume Start building, and any failure just means
no warning.

### Typical sizes (machine)

- `machine/adapters/claude.js`, next to `DISALLOWED_TOOLS`, exports
  `STARTUP_TYPICAL = { lead: 41000, reviewer: 23000 }` and `STARTUP_MARGIN = 5000`, with a
  comment: typical first-call size measured 2026-11-17 (Claude Code 2.1.326-327,
  claude-opus-5-5: lead 39.6k-40.7k, reviewer 21.4k-22.8k); raise a value when that role's
  starting text grows. Only these roles are checked: every role gets the same tool list,
  and these two have short, steady first messages.

### Computing the warning (machine, background)

- `refreshStartupWarning()` in `machine/service.js` (or a small module beside it) sets
  `this.startupWarning` to a string or `null`. It runs at service start, every 10 minutes
  (an unref'd interval beside the spool timer), and after each lead approval card is
  handled (not awaited). Only one refresh runs at a time: a trigger while one runs sets a
  flag, and when that refresh ends (success or error) exactly one more starts if the flag
  is set (further triggers coalesce). `this.startupWarning` changes only when a refresh
  ends: its result on success, `null` on any error (logged). There is no timeout: a refresh
  whose read never settles leaves the last result showing and later triggers only set the
  flag (Accepted Risks).
- Steps:
  1. Read the last 512 KB of `<stateDir>/session-ledger.jsonl` asynchronously (whole file if
     smaller; first partial line dropped; missing file: result `null`). Keep start lines (no
     `kind` field) with `provider: "claude"`, string `cli_session_id`, `name`, `thread_id`,
     and a `role` in `STARTUP_TYPICAL`. Skip lines that do not parse. Sort newest first by `at`.
  2. Walk them newest first, examining at most 100; a role stops collecting at 5 samples.
     A start's sample: read `<stateDir>/transcripts/<thread_id>/<name>.jsonl` asynchronously
     line by line, at most the first 4 MB, skipping lines that do not parse. The sample is
     the first record with `type: "assistant"`, `sessionId` equal to `cli_session_id` when
     the record has one, `message.model` a non-empty string other than `<synthetic>`, and
     `message.usage` whose `input_tokens`, `cache_creation_input_tokens` and
     `cache_read_input_tokens` are each absent or a finite number >= 0 (absent counts as 0),
     with a sum above 0. A record failing any of these is skipped and the search continues
     in that transcript. Missing file or no such record: no sample.
  3. Found samples are cached in memory by `cli_session_id`; misses are not cached.
- **Rule.** A role with 5 samples is over when their median (the 3rd largest) is more than
  `STARTUP_TYPICAL[role] + STARTUP_MARGIN`. Fewer than 5: not checked.
- **Text.** When any role is over, one string, lead before reviewer, numbers rounded to the
  nearest 100 with thousands separators:
  `Claude <role> sessions now start about <median - typical> tokens bigger than usual (<median> vs <typical>)[; <role> ...]. A new Claude Code tool may need turning off, or the usual size raising if our own instructions grew.`
  Built from numbers only, so it always passes the card validator.

### The approval card

- `viewer/app/card.js` approval schema gains optional `warnings`: an array of 1 to 10
  non-empty strings. Agents never send it: as with `sudoMachineFields` (`viewer/app/card.js:56-58,152`),
  the field is allowed only when `validate` is called with `{ machine: true }`, which the
  hub's call at `viewer/app/cards.js:59` already passes.
- `machine/service.js` `/v1/agent/cards` (`:1256`): first delete any `warnings` field from
  every incoming card (an agent never supplies it). Then, for a lead's `approval` card,
  beside the sudo step and before spooling, set `warnings: [this.startupWarning]` when it is
  a string; no awaiting, so the card is never held. Then trigger a background refresh.
- Card forwarding to the hub (live relay and spool drain) is unchanged.
- `protocol/app/cards-lead.md` approval table gains the row `warnings` — "Added by the
  machine, never by the lead: startup-size warnings. Shown as information; never affects
  Start building."
- `viewer/pages/thread.js` approval rendering (`:590-629`): when `warnings` is a non-empty
  array, show it under the Ready status as a list headed "Heads-up", in the existing
  amber notice style, as text (never HTML). Start building's enabled state still depends
  only on `ready.ok` and the existing conditions.
- The hub's Re-check and Start building paths (`viewer/app/threads.js:272-337`) only replace
  `card.ready`; `warnings` stays as attached. A fresh approval card gets a fresh check.
- `protocol/app/lead.md` step 6.3 (the approval card): if `card.js` refuses the approval
  card and the refusal mentions `unknown field: warnings` (it arrives wrapped, e.g.
  `machine refused card (400): {"error":"unknown field: warnings"}`), post a `needs` card
  saying the app's hub is older than this machine and needs updating before an approval
  card can be shown. When he answers it (Keep going, or says it is updated), rerun the
  Ready check and post a fresh approval card.
- `machine/API.md`: note that lead approval cards may gain `warnings`.

### Boundaries and non-goals

- Claude lead and reviewer sessions only.
- No automatic changes to the turned-off tool list or the limits; no dashboard; no warning
  elsewhere; no hub cache, poll or Ready-gate change. Ledger format unchanged.

### Edge cases

- A session that ended before any reply, or whose transcript was never copied: no sample;
  older starts are used.
- Under 5 samples for a role in the last 100 starts: that role is not checked.
- Two long first messages among 5 samples: the median ignores them.
- An approval card posted before any refresh has finished since the service started
  carries no warning; cards posted after a finished refresh that found growth carry it.
- A hub older than its machine refuses a lead's approval card carrying `warnings`. On the
  live relay the lead sees the refusal and posts a `needs` card (Decision 25); if the card
  was spooled first, the refusal goes to the rejected spool and the lead is not told (see
  Accepted Risks).
- Corrupt ledger or transcript lines, or malformed usage values, are skipped.

### Validation

- `bash machine/test/run.sh`, with fixture ledgers and kept transcripts, calling
  `refreshStartupWarning()` directly and posting cards through `/v1/agent/cards` with a
  session token: a lead approval card gains `warnings` when the lead median is over
  typical + 5,000, and not at exactly that; reviewer likewise; both over: one string naming
  both, lead first, with the growth numbers; 4 samples: none; two long outliers among 5:
  none; `<synthetic>`, missing model, zero, negative, string or non-finite usage skipped
  and the next record used; another `sessionId` skipped; missing copy skipped and an older
  start used; other roles and non-Claude starts ignored; ledger over 512 KB read from its
  tail; corrupt lines; an agent-supplied `warnings` is removed from any card, with and
  without a current warning; a non-approval card and a non-lead approval are not enriched;
  the card route returns without waiting while a refresh is stalled, and the stalled
  refresh's trigger only sets the rerun flag; triggers during a refresh coalesce into
  exactly one rerun, which sees a sample added mid-refresh; a thrown error clears the
  warning and the queued rerun still runs. Card forwarding behaves exactly as before for
  every card.
- `node --test viewer/test/*.test.js`: `card.js` refuses `warnings` from an agent, accepts
  1-10 non-empty strings with `machine: true`, refuses empty strings and 11 items;
  `protocol-rules.test.js` still finds exactly one section per kind.
- `npm --prefix viewer run test:browser`: an approval card with warnings shows the
  Heads-up list and Start building is enabled when `ready.ok`; without warnings no list.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| Growth that stays under a role's limit, or comes from something other than tools (connectors, skills, a model change), is not attributed; the warning only says the limit was crossed | IDEA.md wants a heads-up, not a diagnosis; the text names both likely causes | 1, 3 |
| Typical sizes go stale as lead or reviewer role files grow, giving false warnings until raised | Collin chose fixed limits knowing this; the text names the usual size | 3 |
| Sessions with no kept transcript copy give no sample | Kept copies are made on every Stop hook; the walk uses older starts instead | 3 |
| A machine newer than its hub may have a lead's approval card refused (`unknown field: warnings`) until the hub is updated | Nothing can build in that window (Ready fails "service out of date"); on the live relay the lead tells Collin (Decision 25); a card spooled during a hub outage, or posted by a lead started before the upgrade (it keeps its old instructions), is refused without that notice. Update the hub first | 6, 7, 8 |
| A refresh whose local file read never settles stops further refreshes until the service restarts, leaving the last result showing | Local async reads of small kept files; guarding it drew more findings than it was worth | 7 |
| A warning can lag behind the newest sessions by one refresh (seconds normally; up to 10 minutes plus one refresh after a quiet spell) | The card is never held; tool growth persists for days | 4, 5 |

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

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 3:** the growth rule replaced by fixed per-role limits (Decision 15); the machine attaches the warning in its card route, no `wc.js` command or lead rule (Decision 16); samples only from kept copies with async reads (Decision 17). Spec, Edge cases, Validation and Accepted Risks rewritten: review the whole Spec in depth.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Warning gives the limit, not the growth | upheld | Decision 18 |
| intent | minor | Brief-driven roles add false warnings without catching more | upheld | Decision 18 |
| mechanics | blocking | Card waits up to a second for the scan | upheld | Decision 19 |
| mechanics | blocking | Agent-supplied `warnings` not stripped on the route | upheld | Route deletes it from every card |
| mechanics | major | Timer race leaves stalled reads and waiters | upheld | Decision 19: no waiters, 30 s abandon with refresh id |
| mechanics | major | Stripped resend failing leaves the original in the spool | upheld | Spool file rewritten before resend |
| mechanics | minor | Timeout with a completed role ambiguous | upheld | Moot: no budget on the card path; abandoned refresh publishes nothing |
| mechanics | minor | Malformed usage or model values | upheld | Validity rules in step 2 |

### Round 5 — 2026-11-17

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 4:**
- Only lead and reviewer checked, against typical sizes; text gives growth over typical (Decision 18)
- Warning computed in the background; the card route only reads the last result and strips agent-supplied `warnings` (Decision 19)
- Spool file rewritten without `warnings` before the resend
- Usage and model validity rules; Edge cases and Validation updated

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | 10-minute interval may be unnecessary | declined | Without it, the first card after a quiet spell of days would carry a result from days ago |
| mechanics | blocking | Live relay and drain can both strip and resend the same card | upheld | Decision 21 |
| mechanics | major | A failure could leave an old warning forever | upheld | Decision 20: failure clears it |
| mechanics | major | Abandoned scan keeps reading and writing the cache | upheld | Decision 20 |
| mechanics | minor | RE-RAISE: dropped triggers miss new samples | upheld | Decision 20: coalesced rerun; risk text updated |

### Round 6 — 2026-11-17

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 5:**
- Refresh failure and abandonment clear the warning; abandoned scans stop reading and never write the cache; triggers coalesce into one rerun (Decision 20)
- Only the spool drain strips and resends; the live relay hands a refused approval to the drain (Decision 21)
- Validation and the lag risk updated

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Older-hub fallback is the largest part and only covers a window Ready already blocks | upheld | Decision 22: fallback removed, accepted risk |
| mechanics | blocking | Fallback turns real rejections into a 202 | upheld | Moot: fallback removed (Decision 22) |
| mechanics | major | A late error clears a newer warning | upheld | Decision 23 |
| mechanics | major | Abandoned scan keeps reading an open file | upheld | Decision 23 |
| mechanics | major | Live relay and drain can both unlink a delivered spool file | declined | Pre-existing behavior of today's relay (`machine/service.js:874-907,1273-1278`), not changed by this plan once the fallback is gone (Decision 22) |

### Round 7 — 2026-11-17

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 6:** Collin chose Keep going (budget reset).
- Older-hub fallback removed; card forwarding unchanged; accepted risk added (Decision 22)
- Refresh error handling, abandonment and every read gated on the refresh id (Decision 23)
- Edge cases and Validation updated

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | RE-RAISE: older-hub risk rationale wrong; card can be lost silently | upheld | Decision 25 and risk rewritten |
| intent | minor | Abandonment machinery guards an unlikely hang | upheld | Decision 24 |
| mechanics | major | Abandoned refresh can clear a newer refresh's guard | upheld | Moot: abandonment removed (Decision 24) |
| mechanics | major | Abandonment leaves the stalled stream open | upheld | Moot: abandonment removed (Decision 24) |
| mechanics | minor | "Lead sees the refusal" only on the live relay | upheld | Edge case qualified |

### Round 8 — 2026-11-17

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 7:**
- Refresh timeout, ids and stream destruction removed; one in flight, coalesced rerun, publish on finish (Decision 24)
- Lead posts a `needs` card when the hub refuses `warnings` (Decision 25); Edge case and Accepted Risks rewritten

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Decision 25 doesn't say what happens after the hub is updated | upheld | Lead reruns Ready and posts a fresh approval card |
| intent | minor | Refusal text arrives wrapped | upheld | "mentions", with the wrapped example |
| mechanics | major | RE-RAISE: leads started before the upgrade won't post the notice | accepted-risk | Needs a hub/machine skew and a lead spanning the upgrade at once; nothing can build then; folded into the existing risk row |
| mechanics | major | No step after Collin updates the hub | upheld | Same fix as the intent finding |
| mechanics | minor | Restart edge case overpromises | upheld | Edge case reworded |

### Round 9 — 2026-11-17

**Lanes:** pending.

**Changed since Round 8:**
- Lead step 6.3: match the refusal by substring; after Collin answers, rerun Ready and post a fresh approval card
- Restart edge case and the older-hub risk row reworded

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
