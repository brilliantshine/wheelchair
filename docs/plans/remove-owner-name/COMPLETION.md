---
slug: remove-owner-name
date: 2026-11-19
implemented-by: "T1, T2: standard (claude-sonnet-5-5); T3: standard (gpt-6.1-terra); sub-lead: claude-opus-5-5"
verified-by: []
---

# Completion Report — Remove the owner's name from wheelchair

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| Role and card rules reworded (lead, sub-lead, worker, verifier, aside, cards, cards-lead, protocol/app/AGENTS.md) | this run | `protocol/app/lead.md` (T1, 105 lines), `protocol/app/{sub-lead,worker,verifier,aside,cards,cards-lead,AGENTS}.md` (T2) | Validation 1, 2 below |
| Other protocol files (graphs, diagrams, sensitivity) | this run | `protocol/graphs.md`, `protocol/diagrams.md`, `protocol/sensitivity.md` (T2); `{{WHEELCHAIR_ROOT}}` kept | Validation 1, 2; `bash sensitivity/test/run.sh` 67 passed |
| Routers agents read | this run | `AGENTS.md:17`, `sudo-helper/AGENTS.md:3` | Validation 1 |
| Prompt text built by the hub | this run | `viewer/app/settings.js:144,145,158` | `viewer/test/app-settings.test.js:273,278` (the 158 template label has no direct assertion) |
| Machine sudo message + quoted form | this run | `machine/service.js:1952`, `protocol/app/cards-lead.md:252` | `machine/test/sudo.test.js:91` |
| Imported history shows `collin` as You | this run | `viewer/pages/thread.js:231` | `viewer/test/app-handoff.spec.js:57` (asserts `2025-01-02 · You · My message`, line 61) — Validation 5 |
| Lead context relabels `collin` -> `user` on copies | this run | `viewer/app/threads.js:138-150` (`asUser`, `relabelCard`; cards, pinned, recent_messages, import.history) | `viewer/test/app-handoff-restart.test.js:70` "import restart relabels owner tags in context without changing saved state" — Validation 6; `viewer/test/app-hub.test.js` restart-context assertion updated |
| Tests asserting changed strings | this run | `machine/test/sudo.test.js:91`, `viewer/test/app-settings.test.js:273,278`, `viewer/test/app-hub.test.js` (restart context expects `source: 'user'`) | suites below |
| Rewriting rule 4: example paths | this run | `protocol/graphs.md:493` (`%2Fhome%2Fyou%2F`), `protocol/app/lead.md:506` (`/home/you/projects/personal/wheelchair`) | grep |
| Rewriting rule 5: legacy marker | this run | reader `protocol/app/sub-lead.md:32-33` (accepts both, names the older form), writer `protocol/app/sub-lead.md:258` | Validation 3 |

## Deviations from plan

- `viewer/app/threads.js:139,150`: a card or history entry without a `resolved_by`/`who` key is passed by reference rather than copied; nothing mutates it (the state is only serialised), and stored state is asserted unchanged by the restart test.
- `viewer/app/threads.js:143`: `thread.pinned` is now iterated with `Object.entries`; it is always created as `{}` (`viewer/app/threads.js:33`).
- Ambiguity rule: where "they" could read as the lead or another party, "the user" was written instead (lead.md:461, sub-lead.md:264, aside.md:11,22, cards-lead.md:118,277).

## Routers

`AGENTS.md:17` and `sudo-helper/AGENTS.md:3` reworded ("The user installs ..."); `protocol/app/AGENTS.md` reworded. No ownership moved.

## Validation evidence

Run on the feature branch at the T3-accepted commit (c64a2f85).

```
== V1
protocol/app/sub-lead.md:33:   `Deferred and finished at Collin's choice`), send the done result described below and
== V2
exit 1
== V3
protocol/app/sub-lead.md:32:   contains `Deferred and finished at the user's choice` (or the older form
protocol/app/sub-lead.md:258:   the rows with `Deferred and finished at the user's choice` in the same commit, messages
```
(Validation 2 prints nothing; "exit 1" is git grep's no-match exit.)

```
$ bash machine/test/run.sh        -> exit 0
# tests 345
# pass 345
# fail 0
$ node --test viewer/test/*.test.js   -> exit 0
# tests 686
# pass 686
# fail 0
$ bash sensitivity/test/run.sh    -> exit 0
RESULT 67 passed, 0 failed
$ npm --prefix viewer run test:browser   -> exit 1
  2 failed
    [chromium] › test/app-agents-decks.spec.js:247:94 › desktop › popover invariant across a refresh › deck on screen, page not scrolled 
    [firefox] › test/app-threads.spec.js:620:5 › phone › dead lead offers Restart; archive asks to confirm 
  34 skipped
  1026 passed (7.1m)
$ npx playwright test test/app-agents-decks.spec.js test/app-threads.spec.js test/app-handoff.spec.js   (rerun)
  1 failed
    [firefox] › test/app-agents-decks.spec.js:247:94 › phone › popover invariant across a refresh › expanded round, long popover 
  6 skipped
  273 passed (3.4m)
$ npx playwright test test/app-agents-decks.spec.js   (twice)
  78 passed (1.9m)
  78 passed (1.8m)
```

The browser failures are timing-flaky and in specs this change does not touch: `app-agents-decks.spec.js` "popover invariant across a refresh" failed in a different case on each run and passed twice alone; `app-threads.spec.js:620` "dead lead offers Restart" passed on the rerun. T3's own full browser run passed (1028 passed, report `reports/T3.md`). The worker also saw `server.test.js` "global write lock" fail 1 in 4 runs on its branch; it passed in the full run above.

## Known gaps / residual risks

- The template label at `viewer/app/settings.js:158` has no direct test assertion.
- Accepted Risks in PLAN.md (queued pre-upgrade context, `session list --full`) stand; D1-D3 deferred.
- Browser suite has timing-flaky specs unrelated to this change (above).

## Remediation rounds

Appended by Stage 4 loops; never erase earlier content.

### Remediation 1 — 2026-11-19

Verification attempt 1 on 1188b129: Claude verifier PASS, GPT verifier FAIL with 3 gaps (`REMEDIATION-1.md`).

- **G1 — full viewer/browser suites exit 1 (Validation 4).** Lead's ruling: not a gap in this change, and not deferred. Evidence: every failing test differed between runs (`app-uploads-archive.test.js:72`, `app-quiet.test.js` "6 message clears debt", `server.test.js` "global write lock" and a port refusal, browser `app-handoff.spec.js:222`, `app-threads.spec.js:340,550,620`, `app-agents-decks.spec.js:247`). None of those files, nor `viewer/server.js`, is changed on this branch. The GPT verifier reproduced the Firefox approval timeout on the pre-change commit. Each passes when rerun alone. The sub-lead's full `node --test viewer/test/*.test.js` run passed 686/686 (above), and T3's full browser run passed 1028.
- **G2 — Validation 6 test read the queue, not delivery.** Fixed: `viewer/test/app-handoff-restart.test.js:85-88` now fires `turn-ended` and asserts on `c.machine.sessions.get(lead.name).submits[0]` (prefix `[wc:context import]`), keeping the saved-state assertions. `node --test viewer/test/app-handoff-restart.test.js` → 13 pass, 0 fail (rerun by the sub-lead); `app-hub.test.js` 115 pass.
- **G3 — `protocol/app/lead.md:491` capitalised "The user's" mid-sentence.** Fixed to "the user's".
