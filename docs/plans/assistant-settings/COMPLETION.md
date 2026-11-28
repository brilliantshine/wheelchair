---
slug: assistant-settings
date: 2026-11-28
implemented-by: standard / gpt-6.1-terra (T1, T2, T3)
verified-by:
  - round: 1
    lane: claude / claude-opus-5-5
    checks: standard / gpt-6.1-terra
---

# Completion Report — Let the personal assistant change settings

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| §1 Overview & Boundaries: personal assistant only; project leads rejected; excluded/manual-only settings refused; live refresh split out (Decision 13; `viewer/pages/settings.js`, `viewer/app/settings.js`, `viewer/app/background.js` untouched) | this run | `viewer/app/wc.js:100-113`, `viewer/app/assistant-actions.js:13,23-31,128-159`, `protocol/app/assistant.md:31-63` | `viewer/test/wc-cli.test.js`, `viewer/test/assistant.test.js`, `machine/test/assistant.test.js` |
| §2 CLI surface (`wc.js assistant settings [--include-history]` with 503 retry; `wc.js assistant setting <target> --file <json-file>` with validation, no 503 retry, JSON failure output; `project-lead` rejects both) | this run | `viewer/app/wc.js:100-113`, `viewer/app/wc.js:216-222` | `node --test viewer/test/wc-cli.test.js` (8/8 pass) |
| §3 Direct settings handler adapter (`invokeSettings(hub, method, relPath, body)` exported from `viewer/app/routes.js`, existing HTTP routes unchanged) | this run | `viewer/app/routes.js:894-902` | `node --test viewer/test/assistant.test.js viewer/test/app-settings.test.js viewer/test/app-shared-tools-setting.test.js viewer/test/app-diagram-sensitivity.test.js viewer/test/background.test.js` (62/62 pass) |
| §4 Hub assistant dispatcher (`allowSettings: true` in `dispatch`; 403 defense-in-depth in `run`; `settings` snapshot + `diagram_sensitivity` + `background`, omitting `lesson_history` unless `include_history === true`; `setting` custom handlers `preferences` / `diagram-sensitivity` / `background` + 16-entry route lookup table + 400/403/409 handling) | this run | `viewer/app/assistant-actions.js:13,23-31,105-159` | `node --test viewer/test/assistant.test.js viewer/test/app-settings.test.js viewer/test/app-shared-tools-setting.test.js viewer/test/app-diagram-sensitivity.test.js viewer/test/background.test.js` (62/62 pass) |
| §5 Assistant protocol rules (`protocol/app/assistant.md`: scratch-file permission, Settings read/write rules, reload reminder, `account-restore` default-only note, partial-payload preservation, confirmation triggers, 6 manual-only categories, retry rules, Actions table with all 19 targets) | this run | `protocol/app/assistant.md:11-16`, `protocol/app/assistant.md:31-63`, `protocol/app/assistant.md:75-87` | `node --test machine/test/name-guard.test.js machine/test/assistant.test.js` (4/4 pass); prose reviewed against `wc.js` and `assistant-actions.js` |
| §5 API documentation (`viewer/app/API.md`: `settings` and `setting` actions on `POST /api/machine/assistant`, including partial `diagram-sensitivity` HTTP 200 shape) | this run | `viewer/app/API.md:220-231` | Prose reviewed against `viewer/app/assistant-actions.js` |
| §5 Activation / Rollout (restart personal assistant session after merge so fresh session loads updated `protocol/app/assistant.md`) | this run | `machine/test/assistant.test.js:106-112` (fresh-session composed prompt verified) | `node --test machine/test/name-guard.test.js machine/test/assistant.test.js` (4/4 pass) |
| §6 Assistant popup UI regression check | pre-existing | `viewer/pages/assistant-popup.js` (unchanged) | `npm --prefix viewer run test:browser -- app-assistant-popup.spec.js` (44/44 pass) |

## Deviations from plan

None.

Worker choice logged in `PLAN.md`:
- `viewer/app/assistant-actions.js:146`: validate optional `background` `opacity` `revision` as a non-negative safe integer (`Number.isSafeInteger(payload.revision) && payload.revision >= 0`), matching `background` `remove` revision semantics.

## Routers

None — this change moved no ownership and no router (`AGENTS.md`, `viewer/AGENTS.md`, `protocol/AGENTS.md`, `machine/AGENTS.md`) named a file or responsibility that became untrue.

## Validation evidence

### CLI (`viewer/test/wc-cli.test.js`)
```text
$ node --test viewer/test/wc-cli.test.js
✔ line bands and tricky (583.614144ms)
✔ excluded paths, raw names, subdirectories and executable scout diff (102.496993ms)
✔ only excluded changes and exact file or symlink (295.129073ms)
✔ renames across exclusion with renames disabled in config (76.56788ms)
✔ binary counts zero and errors are prefixed (91.251086ms)
✔ session output compact and full (145.405245ms)
✔ session leads sends the all-projects flag and prints the response (67.434104ms)
✔ assistant settings reads retry and setting writes do not (2514.158348ms)
ℹ tests 8
ℹ suites 0
ℹ pass 8
ℹ fail 0
```

### Machine relay & name guard (`machine/test/name-guard.test.js`, `machine/test/assistant.test.js`)
```text
$ node --test machine/test/name-guard.test.js machine/test/assistant.test.js
✔ assistant start uses its own folder and prompt, and switch requires the matching session (209.218587ms)
✔ assistant relay forwards once, preserves refusals, and waits beyond five seconds (6184.75011ms)
✔ detector recognizes name checks across lines (5.236929ms)
✔ tool names do not dispatch outside connectors (185.737771ms)
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
```

### Hub settings adapter, routes, and assistant actions
```text
$ node --test viewer/test/assistant.test.js viewer/test/app-settings.test.js viewer/test/app-shared-tools-setting.test.js viewer/test/app-diagram-sensitivity.test.js viewer/test/background.test.js
ℹ tests 62
ℹ suites 0
ℹ pass 62
ℹ fail 0
```
(Includes `assistant settings reads, writes and authorization`, `assistant diagram failure preserves machine results`, `assistant changes models, lessons and background with browser read-back`, `project lead dispatcher rejects settings actions`, and `assistant diagram update is visible through settings route`.)

### Assistant popup UI (`app-assistant-popup.spec.js`)
```text
$ npm --prefix viewer run test:browser -- app-assistant-popup.spec.js
Running 44 tests using 2 workers
  44 passed (1.1m)
```

### Full test run (`bash test-support/full-run.sh`)
```text
commit 5d70a45a10a9d265966ada4c074f8d7a638ff406
suite viewer-browser exit 0 seconds 447
suite viewer-node exit 0 seconds 133
suite machine exit 0 seconds 133
suite test-support exit 0 seconds 27
suite sensitivity exit 0 seconds 5
suite codex exit 0 seconds 22
suite install exit 0 seconds 44
suite sudo-helper exit 0 seconds 10
```

## Known gaps / residual risks

- **Accepted risk (review-round-4):** Simultaneous browser edit on Settings during the few seconds while the assistant reads and writes a replacement payload (`style`, `held_back`, or a model slot) can overwrite the concurrent browser save (rare path per `protocol/app/realism.md`).
- **Rollout note:** Role file edits (`protocol/app/assistant.md`) take effect on fresh assistant sessions; after merging and updating, restart the personal assistant session (or toggle it off and on in Settings) so it picks up the new Settings rules.
- **Follow-up stub (Decision 13):** Automatic live refresh of an already-open Settings page when settings change externally is tracked separately; for now the assistant reminds Collin to reload any already-open Settings page before editing that block.

## Remediation rounds

None yet.
