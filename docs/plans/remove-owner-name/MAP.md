# Map: remove owner name

Checked against: `ea9506df5175d5c81a8303229d3c2dd4502fe678` (origin/main and worktree HEAD). Detailed current maps: `docs/maps/owner-name-prompts.md` and `docs/maps/owner-name-state.md`. Existing overlapping maps were compared with their recorded commits against origin/main; their covered files have changed, so the feature-specific flows here supersede them for this question.

```text
protocol + settings -> agent instructions -> agent wording
user action -> stored queue / card / timestamp -> UI and handoff export -> import
```

## 1. Text reaching agents

Machine inlines the role and card files (`machine/service.js:145`), stores the prompt (`machine/service.js:750`), and the hub supplies settings layers (`viewer/app/settings.js:144`, `viewer/app/settings.js:158`, `viewer/app/sessions.js:377`). Provider delivery is described at `machine/API.md:10`. The complete literal protocol hit inventory, with lines, is in `docs/maps/owner-name-prompts.md`; it includes the role and card rules, `protocol/diagrams.md:3`, `protocol/graphs.md:3`, the encoded path at `protocol/graphs.md:493`, and `protocol/sensitivity.md:6`. A phrase in `protocol/app/sub-lead.md:32` is matched against a plan and written at `protocol/app/sub-lead.md:257`; changing it has a compatibility consequence for existing plans.

The sensitivity block has placeholder paths (`protocol/sensitivity.md:33`, `protocol/sensitivity.md:41`), rendered using the checkout root (`sensitivity/set.sh:5`, `sensitivity/set.sh:254`), not a literal `/home/collin`. Its global targets use configurable or `$HOME` paths (`sensitivity/set.sh:10`). Installer ROOT and home also derive at runtime (`install.sh:6`, `install.sh:10`); machine and hub default to `os.homedir()` (`machine/service.js:34`, `viewer/app/state.js:9`). No runtime user-name derivation was found in these checked flows; the named sentences are literals (`viewer/app/settings.js:144`, `machine/service.js:1952`).

## 2. Text shown in the app UI

The missing sudo helper error names Collin (`machine/service.js:1952`), and its contract repeats that text (`protocol/app/cards-lead.md:252`). Imported handoff entries display `who` literally (`viewer/pages/thread.js:231`), so historical `collin` is visible there. `viewer/index.html:318` and `viewer/index.html:330` are comments, not visible labels. Lists use the timestamp for ordering and age (`viewer/pages/threads.js:38`, `viewer/pages/threads.js:74`, `viewer/pages/agents.js:139`); card resolution uses the value to select a fallback label (`viewer/pages/thread.js:580`).

## 3. Persisted identifiers and data formats

Messages from the initial thread, route and aside write `source: 'collin'` (`viewer/app/threads.js:79`, `viewer/app/routes.js:531`, `viewer/app/asides.js:62`). Enqueue sets `collin_at` (`viewer/app/sessions.js:477`); card actions and dismissals also set it and `resolved_by` (`viewer/app/threads.js:325`, `viewer/app/threads.js:402`, `viewer/app/threads.js:420`). Thread JSON and spilled sent JSONL persist these values (`viewer/app/state.js:84`, `viewer/app/state.js:91`, `viewer/app/sessions.js:528`); queue, send-now, restart context, and UI readers compare old sources (`viewer/app/sessions.js:542`, `viewer/app/threads.js:145`, `viewer/pages/thread.js:436`). See `docs/maps/owner-name-state.md` for all flows. Migration or backward-compatible reads must cover both thread JSON and its append-only history, plus imported history and public API consumers (`viewer/app/API.md:22`).

Version 1 handoff exports `who: 'collin'` (`viewer/app/handoff.js:61`, `viewer/app/handoff.js:71`) and validates against a fixed enum (`viewer/app/handoff.js:29`); imports validate it (`viewer/app/handoff-import.js:13`). A new value is rejected by older installations. Preserve old-file import and decide old-reader export compatibility explicitly.

## 4. Comments, tests and fixtures

The following case-insensitive owner-name matches include comment, test, fixture and router locations, excluding unrelated “collinear” matches. Runtime references are in the sections above; protocol's complete inventory is in the prompt map.

- `AGENTS.md:17`
- `machine/test/fixtures/agy/permission-after.txt:17`, `machine/test/fixtures/agy/permission-after.txt:18`, `machine/test/fixtures/agy/permission-after.txt:19`
- `machine/test/fixtures/agy/stop-role.json:2`, `machine/test/fixtures/agy/stop-role.json:13`
- `machine/test/fixtures/agy/stop-second.json:2`, `machine/test/fixtures/agy/stop-second.json:13`
- `machine/test/fixtures/agy/stop-tools.json:2`, `machine/test/fixtures/agy/stop-tools.json:13`
- `machine/test/fixtures/agy/stop.json:2`, `machine/test/fixtures/agy/stop.json:13`
- `machine/test/fixtures/codex-steps/instant.jsonl:1`, `machine/test/fixtures/codex-steps/instant.jsonl:2`
- `machine/test/fixtures/codex-steps/wait.jsonl:1`, `machine/test/fixtures/codex-steps/wait.jsonl:4`
- `machine/test/sudo.test.js:91`
- `sudo-helper/AGENTS.md:3`
- `test-support/smoke/live.js:44`
- `viewer/playwright.config.js:3`
- `viewer/server.js:499`
- `viewer/test/app-asides.test.js:176`
- `viewer/test/app-chat.test.js:81`, `viewer/test/app-chat.test.js:145`
- `viewer/test/app-check-card.spec.js:130`
- `viewer/test/app-handoff-restart.test.js:46`, `viewer/test/app-handoff-restart.test.js:123`, `viewer/test/app-handoff-restart.test.js:181`
- `viewer/test/app-handoff.test.js:40`, `viewer/test/app-handoff.test.js:43`, `viewer/test/app-handoff.test.js:46`, `viewer/test/app-handoff.test.js:109`
- `viewer/test/app-hub.test.js:261`, `viewer/test/app-hub.test.js:265`, `viewer/test/app-hub.test.js:366`, `viewer/test/app-hub.test.js:375`, `viewer/test/app-hub.test.js:380`, `viewer/test/app-hub.test.js:384`, `viewer/test/app-hub.test.js:394`, `viewer/test/app-hub.test.js:398`, `viewer/test/app-hub.test.js:1374`, `viewer/test/app-hub.test.js:1385`, `viewer/test/app-hub.test.js:1400`, `viewer/test/app-hub.test.js:1409`, `viewer/test/app-hub.test.js:1422`, `viewer/test/app-hub.test.js:1788`, `viewer/test/app-hub.test.js:1804`, `viewer/test/app-hub.test.js:1820`
- `viewer/test/app-merged.spec.js:41`
- `viewer/test/app-send-now.spec.js:19`
- `viewer/test/app-settings.test.js:273`, `viewer/test/app-settings.test.js:278`
- `viewer/test/app-threads.spec.js:108`, `viewer/test/app-threads.spec.js:109`, `viewer/test/app-threads.spec.js:111`, `viewer/test/app-threads.spec.js:113`, `viewer/test/app-threads.spec.js:117`, `viewer/test/app-threads.spec.js:119`, `viewer/test/app-threads.spec.js:122`, `viewer/test/app-threads.spec.js:356`, `viewer/test/app-threads.spec.js:383`, `viewer/test/app-threads.spec.js:411`
- `viewer/test/helpers/app-views-setup.js:53`

The captured fixture paths and owner columns are historical capture data (`machine/test/fixtures/agy/stop.json:2`, `machine/test/fixtures/agy/permission-after.txt:17`); sudo error assertions (`machine/test/sudo.test.js:91`) and state/handoff assertions (`viewer/test/app-hub.test.js:1788`, `viewer/test/app-handoff.test.js:40`) need coordinated changes. Sensitivity test checks absolute substitution (`sensitivity/test/run.sh:304`).

## 5. Historical docs

Case-insensitive `collin` match counts at the checked commit, grouped by top-level historical directory: `docs/plans/`: 2068 matches in 292 files; `docs/proposals/`: 38 matches in 9 files. These are historical records, not an inventory of active rules.

Not checked: actual installed instruction files or live state on any machine, all third-party handoff consumers, and semantic correctness of every historical record.
