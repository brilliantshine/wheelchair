---
slug: google-model-levels
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-27
---

# Google model list and levels

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first.

## Open Questions

(None.)

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Use agy's own base model ids plus `--effort` (e.g. `--model gemini-4-hydrogen --effort high`) rather than mapping effort to suffixed ids. | Live checks 2026-11-27: `agy -p … --model gemini-4-hydrogen --effort high`, `gemini-4-neon --effort low` and `gemini-3.8-flash --effort medium` succeed; `gemini-4-hydrogen` with no effort succeeds; `gemini-4-hydrogen-low --effort xhigh` fails ("conflicts with --effort=xhigh"), so today's suffixed pins break effort escalation outright. | defaulted |
| 2 | Group levels generically from `agy models`: an id `<base>-<level>` with level in low, medium, high, xhigh, max, whose display name ends in `(<Level>)`, belongs to model `<base>` (label = name without the level part). Ids that do not fit stay single models with no levels. | IDEA requires a general rule, not a list of names. | defaulted |
| 3 | Models with no levels (Orchestrator variants, Claude and GPT-OSS inside agy) never get `--effort`; their effort choice in Settings is only "CLI default", and escalation skips their effort step. | agy refuses `--effort` for them ("--effort is not supported for model …"). | defaulted |
| 4 | Saved pins with a level suffix (including shipped defaults `gemini-3.8-flash-low/-medium/-high`) are read as base + that effort when the pin has no effort of its own; shipped defaults change to base ids with effort. | IDEA: saved settings keep working. | defaulted |
| 5 | The model list is fetched fresh from `agy models` whenever Settings loads it (about 1 s); the saved copy is only a fallback when agy fails. | IDEA: new models appear the next time Settings opens. | defaulted |
| 6 | No designer: the only visible change is fewer, plainer entries in an existing dropdown. | Trivial visible part. | defaulted |
| 7 | A step up past a model's top level: the hub starts it at the model's top level, says so in the start output, and the escalation rules treat that model as having no effort step left, so the next step moves tier. | User picked "Stay at top, then next tier" over refusing the start. | user |
| 8 | Group only when two or more levels share a base; a lone `<base>-<level>` id stays a single model. | agy's acceptance of a base id was only checked for models it lists in several levels. | defaulted |
| 9 | Settings' list reuses a fetch younger than 30 seconds, so one page load (which asks for the list more than once) runs `agy models` once. | `agy models` takes about 1 s; `show --json` is called from several routes (`viewer/app/routes.js:356`, `:373`, `viewer/app/settings.js:459`). | defaulted |
| 10 | A step up past a model's levels rounds down to the highest listed level (never up past the request); the sub-lead's generated escalation lines list each Antigravity tier's levels, replacing Decision 7's start-output note. | Review round 1: a note reached only some start paths, and rounding up could pass the Settings ceiling. | review-round-1 |
| 11 | The launch fix-up (suffix, cap, drop) runs on the machine that runs Antigravity, through `model.sh agy-launch`, not in the hub; Decision 10's rounding stays, with the lowest-level exception named. | Review round 2: the hub may not have Antigravity installed. | review-round-2 |

## Spec

Terms. **Level**: one of `low`, `medium`, `high`, `xhigh`, `max`, in that order. **Level group**: a model Antigravity lists in two or more levels. **Base id**: a level group's id with the level dropped (`gemini-4-hydrogen`). Everything here applies only to the `gemini` provider (Antigravity, `connectors/agy/`); other providers do not change.

Facts this rests on (live `agy`, 2026-11-27): `agy --model <base id> --effort <level>` runs that level; `--model <base id>` alone runs; `--model <base>-<level> --effort <other level>` is refused; an effort a model does not list is refused; `--effort` on a model with no levels (Orchestrator, `claude-*`, `gpt-oss-*`) is refused.

### S1. Discovery and grouping (`codex/model.sh`)

1. `agy_parse` groups lines generically. A line `<id>\t<name>` joins group `<base>` when `<id>` ends in `-<level>` and `<name>` ends in ` (<Level>)` with the same level, compared case-insensitively (`XHigh` = `xhigh`). A group is kept only with two or more members (Decision 8); otherwise its lines stay single entries.
2. A group becomes one entry `{value: <base>, label: "<name without the trailing (Level)> · <base>", efforts: [<its levels in level order>]}`, placed where its first member appeared. Every other line is `{value, label}` as today plus `efforts: []`. Existing filters (`none`, duplicates, id format) still apply, to the base id too.
3. Freshness: `agy_models` reuses the saved list only when it is under 30 seconds old (Decision 9); otherwise it runs `agy models`. A failed, timed-out or empty run falls back to the saved list whatever its age, as today; with none, `[]`. The saved file keeps its path and gains `efforts` per entry; `agy_valid` accepts entries with or without `efforts` (an old file without it is read as `efforts` unknown, not `[]`).
4. A new command `model.sh levels gemini <model>` prints the model's levels (one per line, level order) and exits 0; it exits 0 with no output for a model listed with `efforts: []`; it exits 4 for a model not in the list, or listed with unknown efforts (an old-format entry).
5. **Catalog on demand.** Every reader that needs the list (`levels`, `agy-launch`, and the S2 reads below) uses the saved list when it exists in the new format (entries carry `efforts`), whatever its age; when the saved list is missing or in the old format, it runs `agy models` first regardless of the 30-second reuse (an old-format list is never reused as fresh), and saves the result. So a fresh or upgraded install resolves levels at its first session start without Settings having been opened.

### S2. Saved settings carry over (`codex/model.sh`, `connectors/agy/manifest.js`)

1. A gemini pin whose model is `<base>-<level>` with no effort of its own, where `<base>` is a level group in the list (S1.5), is read as model `<base>` with effort `<level>` by every reader (`model.sh <provider> <slot>`, `model.sh effort`, `show --json`). After that, an effort the model is known not to have is read as S4.1 would launch it (dropped for a no-level model, else the highest listed level at or below it, else the lowest), so Settings never shows an effort its picker cannot display. The pins file itself is not rewritten; the next save from Settings writes the new form. When the list cannot be had (agy fails and nothing is saved), or `<base>` is not a group in it, the pin is read as is.
2. A pin `<base>-<level> @<effort>` (both) is read as `<base> @<effort>`, the pin's effort winning, under the same group condition.
3. Shipped defaults become base id plus effort: light `gemini-3.8-flash @low`, standard `@medium`, heavy, critical and lead `@high`. The manifest's pin shape already holds `effort`; regenerate the committed registry (`node connectors/export.js`) whenever the manifest changes. `install.sh` still only writes a missing pins file.

### S3. Settings (`viewer/app/settings.js`, `viewer/pages/settings.js`, `viewer/app/routes.js`)

1. `options()` passes each entry's `efforts` through. Pinned models not in the list are appended as today, with efforts unknown.
2. For a gemini cell, the effort selector offers "CLI default" plus only the chosen model's levels. A model listed with no levels shows only "CLI default" and the selector is disabled. A model with unknown levels (typed through Other…, or missing from the list) offers all gemini efforts, as today.
3. Choosing a different model keeps the cell's effort when the new model has that level; otherwise the effort resets to CLI default, and that is what is saved.
4. PUT `/settings/models` first reads a gemini model and effort through S2.1–S2.2's suffix rules, using the saved list (S1.5) without the 30-second refresh (so `gemini-3.8-flash-high @max` becomes `gemini-3.8-flash @max`), then refuses an effort the normalized model is known not to have (`<model> has no <effort> level; it has <levels>`, or `<model> takes no effort` for a no-level model), and saves the normalized form. Unknown levels are accepted as today.
5. After a save, the page re-reads GET `/settings` (which already returns `models`, `model_options` and `escalation_text`) and redraws the model cells from it. The PUT response is unchanged.

### S4. Starting a session (`codex/model.sh`, `connectors/agy/machine.js`)

The fix-up happens on the machine that runs Antigravity, at launch, because the hub may not have Antigravity installed.

1. New command `model.sh agy-launch <model> [<effort>]`, run on the launching machine with that machine's list (S1.5), prints `<model>\t<effort or empty>`:
   - S2.1–S2.2's suffix rules first (a suffixed id of a known group becomes the base; a suffix level is the effort only when no effort was given).
   - no effort: unchanged; no effort is printed.
   - the model is listed with no levels: the effort is dropped.
   - levels listed and the effort is one of them: unchanged.
   - levels listed and the effort is not one of them: the highest listed level at or below it; if none is below it, the lowest listed level (the one case that goes above the request; a rare path, see Accepted Risks).
   - the model is not listed, or the list cannot be had: unchanged.
2. `connectors/agy/machine.js` runs `<c.root>/codex/model.sh agy-launch` before building its argv and uses what it prints for `--model` and `--effort` (`--effort` only when non-empty). If the command fails or times out (10 s), it uses the model and effort it was given, as today.
3. The hub's start path does not change; the session record keeps the requested effort.

### S5. Stepping up (`viewer/app/settings.js`)

The sub-lead learns which rungs exist from its generated instructions, not from start output, so every start path (immediate, queued, retried) is covered.

1. The lines are worked out only when a sub-lead starts, in `viewer/app/sessions.js` (which already calls `model.sh`), and passed into `roleLayers`; `escalationSentences`, the Settings escalation text and the length check do not change. They are added only when Antigravity can take workers (enabled in `harnesses` and present in `worker_order`): one line per gemini tier cell (light, standard, heavy, critical) that is set, `Antigravity <Tier>: <model>, levels <l1, l2, …>, set to <effort or CLI default>` (`takes no effort` for a no-level model, `levels unknown` when S1.4 exits 4), then the sentences: `On Antigravity, a tier's highest listed level is its highest effort: once a worker ran there, or the model takes no effort, the next step moves tier. Skip a tier whose model and level were already tried.` Otherwise nothing is added.
2. `protocol/app/sub-lead.md` is not changed.

### S6. Scout lines

For a gemini scout whose pin (read by S2) has an effort, and whose list holds the member id `<model>-<effort>`, the scout line names that member id (e.g. `gemini-3.8-flash-low`), and the same for the bigger-changes scout, so an agent on Antigravity keeps the pin's level. Otherwise it names the model as read. Other providers' scout lines do not change.

### Not changing

Claude, GPT, Kimi, OpenRouter models and their effort; asides (Gemini has none); usage, onboarding and the Ready check.

### Validation

- `bash codex/test/run.sh` with new cases: grouping from a fake listing matching the 2026-11-27 output (Hydrogen and Neon with four levels, Carbon, Argon and Flash with three, Orchestrator, Claude and GPT-OSS single); a lone `<base>-<level>` stays single; the 30-second reuse and the stale fallback on failure; `levels` exit codes, including 4 for an old-format entry; S1.5 fetching when the saved list is missing or old-format, including a fresh old-format file; every `agy-launch` branch in S4.1; S2 pin reads for suffixed pins with and without effort, with and without a saved list.
- `node connectors/export.js --check`.
- `node --test viewer/test/model-options.test.js viewer/test/app-settings.test.js viewer/test/app-hub.test.js viewer/test/worker-effort-membership.test.js` with new cases for S3.4 (including a suffixed id normalized before the check), S5.1 (lines present when Antigravity takes workers, absent when it is off or not in the worker order; Settings' escalation text unchanged) and S6.
- `npm --prefix viewer run test:browser -- --grep 'effort'` with new cases for S3.2, S3.3 and S3.5.
- `node --test machine/test/project-mcp-agy.test.js` with new assertions (using a fake `agy-launch` or fake `agy` listing): a base id with a session effort gives `--model <base> --effort <e>`; a model with no session effort gives no `--effort`; a legacy suffixed id with a different effort gives the base and that effort; a failing `agy-launch` gives the inputs unchanged.
- `bash install/test/run.sh` (shipped default pins).

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| Settings changed during a build: the sub-lead's per-tier level lines are from its start, so one rung may be skipped or repeated. | Worst case one extra or skipped try; the task still escalates and Settings changes mid-build are uncommon. | review-round-2 |
| The list changes between a save and the page's re-read, so the picker shows choices that differ from what was just checked. | Rare path: needs Antigravity's model list to change within seconds. | review-round-2 |
| A model whose levels have a gap (e.g. low and high only) can repeat a level on one step up. | Rare path: no model Antigravity lists today has a gap. | review-round-1 |

## Review Rounds

### Round 1 — 2026-11-27

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Effort-to-level mapping needs a saved list that only Settings writes; fresh or upgraded installs still send conflicting ids. | upheld | S1.5 catalog on demand. |
| intent | minor | No-level model gives no signal to the sub-lead. | upheld | S5.1 lists levels per tier. |
| intent | minor | Landing exactly on top level gives no note; next step repeats. | upheld | S5.1 lists levels per tier. |
| intent | minor | Rare path: gaps in levels make one step do nothing. | accepted-risk | Accepted Risks (rare path). |
| intent | minor | S5.1 sentence always present. | upheld | Only when a gemini tier cell is set. |
| intent | minor | Scout line loses the pin's level. | upheld | S6. |
| mechanics | blocking | Legacy suffixed pins unresolved until Settings is opened. | upheld | S1.5, S2.1. |
| mechanics | blocking | Rounding up through a gap can pass the Settings ceiling. | downgraded (minor) | No listed model has a gap today (rare); rule changed anyway to round down (S4.1, Decision 10). |
| mechanics | blocking | Sub-lead cannot learn actual effort / remaining rungs on all start paths. | upheld | S5.1 generated lines; start-output note removed. |
| mechanics | major | PUT validation of suffixed ids undefined. | upheld | S3.4 normalizes first. |
| mechanics | minor | Old-cache entry exit status. | upheld | S1.4 exits 4. |
| mechanics | minor | CLI default case unspecified. | upheld | S4.1 first bullet. |
| mechanics | minor | Page keeps stale options after save. | upheld | S3.5. |
| mechanics | minor | Registry regeneration tied to shape change. | upheld | S2.3. |
| mechanics | minor | S5.2 duplicates rule in role file. | upheld | S5.2 removed. |
| mechanics | minor | argv test does not exercise effort. | upheld | Validation assertions. |

### Round 2 — 2026-11-27

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 1:** S1.4 exit 4 for old-format entries; new S1.5 (fetch the list when missing or old-format); S2.1 uses it; S2.3 registry regeneration; S3.4 normalizes before validating; new S3.5 (redraw after save); S4 rewritten (no start-output note; rounds down; CLI default passes through); S5 rewritten (generated per-tier level lines, no role-file change); new S6 (scout line names gemini effort); Decision 10; one Accepted Risk; validation additions.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Shipped defaults repeat Flash high across heavy, critical. | upheld | S5.1 adds "skip a tier whose model and level were already tried". |
| intent | minor | Lines added even when Antigravity can't take workers. | upheld | S5.1 condition. |
| intent | minor | escalationSentences callers unspecified. | upheld | Lines computed at sub-lead start only. |
| intent | minor | S3.5 widens PUT. | upheld | Re-read GET /settings. |
| intent | minor | Scout effort may not reach the helper. | upheld | S6 names the member id. |
| intent | minor | Rare path: Decision 10 vs lowest-level case. | upheld | Decision 11 names the exception. |
| mechanics | blocking | PUT may validate against one list and respond with another. | accepted-risk | Rare path (list changes within seconds); PUT no longer refreshes, page re-reads. |
| mechanics | major | Fresh old-format cache reused at first start. | upheld | S1.5: old format never reused. |
| mechanics | major | Hub may lack Antigravity, so on-demand lookup can't fix launches. | upheld | S4 moved to the launching machine (Decision 11). |
| mechanics | major | Sub-lead's tier lines frozen if Settings change mid-build. | downgraded (minor) | Worst case one extra or skipped try; accepted risk. |
| mechanics | minor | Saved effort the picker can't show. | upheld | S2.1 caps on read. |
| mechanics | minor | Picker commands pull whole suites into the Spec. | upheld | Line removed. |

### Round 3 — 2026-11-27

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 2:** S1.5 (old format never reused); S2.1 caps an effort on read; S3.4 uses the saved list; S3.5 re-reads GET /settings; S4 rewritten as `model.sh agy-launch` run by the agy connector on the launching machine (hub start path unchanged); S5.1 lines computed at sub-lead start, only when Antigravity takes workers, plus a skip-repeated-tier sentence; S6 names the member id; Decisions 11; two Accepted Risks; validation updates (picker line removed).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
