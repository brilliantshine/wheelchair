---
slug: startup-growth-warning
date: 2026-11-17
implemented-by: "T1 standard / gpt-6.1-terra; T2 standard / gpt-6.1-terra (asked Claude, hub routed to GPT); integrated by sub-lead claude-opus-5-5"
verified-by:
  - round: 1
    lane: verifier / claude-opus-5-5
    checks: standard / gpt-6.1-terra (T1, T2)
---

# Completion Report — Warn when agent sessions start bigger again

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| `STARTUP_TYPICAL = { lead: 41000, reviewer: 23000 }`, `STARTUP_MARGIN = 5000` beside `DISALLOWED_TOOLS`, exported, with the measurement comment | this run | `machine/adapters/claude.js:46-52` | `machine/test/startup-warning.test.js:28` (thresholds use them) |
| `refreshStartupWarning()` sets `this.startupWarning` (string or null) | this run | `machine/service.js:239-248`; scan in `machine/lib/startup-warning.js:38-61` | `machine/test/startup-warning.test.js:56` |
| Triggers: service start, unref'd 10-minute interval beside the spool timer (cleared on close), after each lead approval card (not awaited) | this run | `machine/service.js:1321-1326`, `:1279` | `machine/test/service.test.js:1392` (card trigger); start/interval by inspection |
| One refresh at a time; triggers during one set a flag; exactly one rerun; publish only on end; error → null + log; no timeout | this run | `machine/service.js:239-248` | `machine/test/startup-warning.test.js:56` (3 triggers → 2 scans; first throws, rerun runs and sees sample added mid-refresh; later throw clears to null); `machine/test/service.test.js:1392` (stalled refresh: card route returns, trigger only sets rerun flag) |
| Step 1: last 512 KB of ledger, async, partial first line dropped, missing → null; start lines only (no `kind`), `provider: claude`, string `cli_session_id`/`name`/`thread_id`, role in `STARTUP_TYPICAL`; unparsable skipped; newest first by `at` | this run | `machine/lib/startup-warning.js:6-23,39-42` | `machine/test/startup-warning.test.js:28` (codex and worker starts ignored), `:40` (530 KB ledger read from tail; corrupt lines) |
| Step 2: at most 100 starts; role stops at 5; kept copy `<stateDir>/transcripts/<thread>/<name>.jsonl`, first 4 MB, line by line; first valid assistant record (sessionId match when present, model non-empty and not `<synthetic>`, usage fields absent or finite >= 0, sum > 0) | this run | `machine/lib/startup-warning.js:24-37,44-52` | `machine/test/startup-warning.test.js:40` (`<synthetic>`, missing model, 0, -1, string, null, 1e999, other sessionId all skipped and the next record used; missing copy skipped, older start used) |
| Step 3: in-memory cache by `cli_session_id`, hits only | this run | `machine/lib/startup-warning.js:46-50`; `machine/service.js:208` | `machine/test/startup-warning.test.js:40` (cache size 5, miss not cached, later filled) |
| Rule: 5 samples, median = 3rd largest, over when > typical + 5,000; fewer than 5 not checked | this run | `machine/lib/startup-warning.js:55-59` | `machine/test/startup-warning.test.js:28` (4 samples → none; exactly 46,000/28,000 → none; two 100,000 outliers → none) |
| Text: one string, lead first, rounded to 100 with separators, exact wording | this run | `machine/lib/startup-warning.js:53,58,60` | `machine/test/startup-warning.test.js:28` (`6,200 … 47,200 vs 41,000`; both roles, lead first) |
| Card route: delete `warnings` from every card; lead approval gets `[this.startupWarning]` when a string, before spooling, no await; then trigger refresh | this run | `machine/service.js:1276-1280` | `machine/test/service.test.js:1392` (forged warnings removed from approval, idea, worker approval; lead approval enriched; no warning → none added) |
| Card forwarding unchanged | this run (unchanged) | `machine/service.js` relay/drain untouched by diff | full `machine/test/run.sh` passes (138) |
| `card.js` approval `warnings`: 1-10 non-empty strings, only with `{ machine: true }` | this run | `viewer/app/card.js:145-148,157-158` | `viewer/test/app-sudo.test.js:91-102` |
| `cards-lead.md` approval row `warnings` | this run | `protocol/app/cards-lead.md:64` | `viewer/test/protocol-rules.test.js` passes (one section per kind) |
| Thread page Heads-up list under Ready, amber, text only; Start building still gated only on `ready.ok` | this run | `viewer/pages/thread.js:629-638`, `:612` unchanged | `viewer/test/app-threads.spec.js:474` (list shown, `<b>` rendered literally, Start enabled), `:463` (no list without warnings) |
| Hub Re-check / Start only replace `card.ready`; `warnings` kept | pre-existing behaviour, confirmed unchanged | `viewer/app/threads.js:287,293` | by inspection (scout, T2 report) |
| `lead.md` step 6.3 refusal rule (`unknown field: warnings` → needs card; Keep going / updated → rerun Ready, fresh approval; Talk about it → explain) | this run | `protocol/app/lead.md:277-281` | by inspection |
| `machine/API.md`: approvals may gain `warnings`; ledger read in the background (last 512 KB) | this run | `machine/API.md:10,30` | by inspection |

## Deviations from plan

None in behaviour. Implementation choices the Spec left open are logged in PLAN.md's Log (scan in a new `machine/lib/startup-warning.js`; scan function held on the instance for tests; truncated final line at the 4 MB cut dropped; Heads-up reuses the Ready notice classes; Heads-up not hidden on a retracted/answered approval; no per-string length cap).

## Routers

`machine/AGENTS.md`: added a file/role row for the new `machine/lib/startup-warning.js` (background startup-size check). No ownership moved between directories.

## Validation evidence

Run on the integrated branch at `57b39b7` (later commits add only COMPLETION.md, PLAN.md status and a router row).

`bash machine/test/run.sh`:
```
# pass 138
# fail 0
machine exit 0
```

`node --test viewer/test/*.test.js` (run in two halves of the file list to stay under the 10-minute tool limit):
```
first half:  # tests 284  # pass 284  # fail 0   (exit 0)
second half: # tests 252  # pass 252  # fail 0   (exit 0)
```

`npm --prefix viewer run test:browser`:
```
first run:  1 failed [firefox] test/app-settings.spec.js:61:3 editing a table cell saves, and Not used saves null
            (permission_mode poll timeout; unrelated to this change); 27 did not run; 694 passed
            app-settings.spec.js alone: 60 passed
second run: 28 skipped
            722 passed (3.1m)   exit 0
```

Flakes seen during integration, both unrelated and passing on rerun: `viewer/test/app-hub.test.js` "send now hands a queued message to the lead mid-turn" (failed once under full-suite load on T1's branch; file passes alone on base and branch, 111/111), and the settings spec above.

## Known gaps / residual risks

- Service-start and 10-minute interval triggers are verified by inspection, not by a test.
- The scan's 512 KB tail read: if the tail holds no newline at all, the whole slice is kept and parsed (it fails to parse and is skipped). Harmless.
- Accepted Risks in PLAN.md stand (older hub refuses `warnings`; stale typical sizes; stalled read stops refreshes until restart).

## Remediation rounds
