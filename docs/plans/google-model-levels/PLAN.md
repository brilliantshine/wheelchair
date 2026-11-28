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

## Spec

Terms. **Level**: one of `low`, `medium`, `high`, `xhigh`, `max`, in that order. **Level group**: a model Antigravity lists in two or more levels. **Base id**: a level group's id with the level dropped (`gemini-4-hydrogen`). Everything here applies only to the `gemini` provider (Antigravity, `connectors/agy/`); other providers do not change.

Facts this rests on (live `agy`, 2026-11-27): `agy --model <base id> --effort <level>` runs that level; `--model <base id>` alone runs; `--model <base>-<level> --effort <other level>` is refused; an effort a model does not list is refused; `--effort` on a model with no levels (Orchestrator, `claude-*`, `gpt-oss-*`) is refused.

### S1. Discovery and grouping (`codex/model.sh`)

1. `agy_parse` groups lines generically. A line `<id>\t<name>` joins group `<base>` when `<id>` ends in `-<level>` and `<name>` ends in ` (<Level>)` with the same level, compared case-insensitively (`XHigh` = `xhigh`). A group is kept only with two or more members (Decision 8); otherwise its lines stay single entries.
2. A group becomes one entry `{value: <base>, label: "<name without the trailing (Level)> · <base>", efforts: [<its levels in level order>]}`, placed where its first member appeared. Every other line is `{value, label}` as today plus `efforts: []`. Existing filters (`none`, duplicates, id format) still apply, to the base id too.
3. Freshness: `agy_models` reuses the saved list only when it is under 30 seconds old (Decision 9); otherwise it runs `agy models`. A failed, timed-out or empty run falls back to the saved list whatever its age, as today; with none, `[]`. The saved file keeps its path and gains `efforts` per entry; `agy_valid` accepts entries with or without `efforts` (an old file without it is read as `efforts` unknown, not `[]`).
4. A new read-only command `model.sh levels gemini <model>` prints the model's levels from the saved list (one per line, level order) without running `agy`, exits 0 with no output for a model listed with no levels, and exits 4 when the model is not in the saved list or there is no saved list.

### S2. Saved settings carry over (`codex/model.sh`, `connectors/agy/manifest.js`)

1. A gemini pin whose model is `<base>-<level>` with no effort of its own, where `<base>` is a level group in the saved list, is read as model `<base>` with effort `<level>` by every reader (`model.sh <provider> <slot>`, `model.sh effort`, `show --json`). The pins file itself is not rewritten; the next save from Settings writes the new form. When there is no saved list, or `<base>` is not a group in it, the pin is read as is.
2. A pin `<base>-<level> @<effort>` (both) is read as `<base> @<effort>`, the pin's effort winning, under the same group condition.
3. Shipped defaults become base id plus effort: light `gemini-3.8-flash @low`, standard `@medium`, heavy, critical and lead `@high`. If the manifest's pin shape cannot hold an effort, extend it and regenerate the registry (`node connectors/export.js`). `install.sh` still only writes a missing pins file.

### S3. Settings (`viewer/app/settings.js`, `viewer/pages/settings.js`, `viewer/app/routes.js`)

1. `options()` passes each entry's `efforts` through. Pinned models not in the list are appended as today, with efforts unknown.
2. For a gemini cell, the effort selector offers "CLI default" plus only the chosen model's levels. A model listed with no levels shows only "CLI default" and the selector is disabled. A model with unknown levels (typed through Other…, or missing from the list) offers all gemini efforts, as today.
3. Choosing a different model keeps the cell's effort when the new model has that level; otherwise the effort resets to CLI default, and that is what is saved.
4. PUT `/settings/models` refuses a gemini effort the model is known not to have (`<model> has no <effort> level; it has <levels>`, or `<model> takes no effort` for a no-level model); unknown levels are accepted as today.

### S4. Starting a session (`viewer/app/sessions.js`, `connectors/agy/machine.js`)

1. After the effort is settled (worker `--effort`, else the pin's), and only for gemini, the hub runs `model.sh levels gemini <model>`:
   - exit 0 with no levels: the session has no effort, and `agy` gets no `--effort`.
   - levels listed and the effort is one of them: unchanged.
   - levels listed and the effort is above the top level: the session starts at the top level, and the start output's `note` says `<model>'s top level is <top>; started at <top>. A further step moves tier.` (joined to any existing note).
   - levels listed and the effort is below every level or between levels: the lowest listed level at or above it.
   - exit 4 or any other failure: unchanged (today's behaviour).
2. `checkEffort` keeps its existing checks against the provider's efforts and the Settings ceiling; S4.1 runs after it. The session record's `effort` and the machine start body carry the effort actually used.
3. `connectors/agy/machine.js` keeps sending `--model` and, only when an effort is set, `--effort`.

### S5. Stepping up (`viewer/app/settings.js` `escalationSentences`, `protocol/app/sub-lead.md`)

1. Add one generated sentence, always present: `An Antigravity model's top level is its highest effort: when a start's note says it started at the top level, or the model takes no effort, the next step moves tier.`
2. In `protocol/app/sub-lead.md`'s escalation section, state the same in one line so a sub-lead reads the start output's `note`.

### Not changing

Claude, GPT, Kimi, OpenRouter models and their effort; the scout lines (they show the pin's model as read by S2); asides (Gemini has none); usage, onboarding and the Ready check.

### Validation

- `bash codex/test/run.sh` with new cases: grouping from a fake listing matching the 2026-11-27 output (Hydrogen and Neon with four levels, Carbon, Argon and Flash with three, Orchestrator, Claude and GPT-OSS single); a lone `<base>-<level>` stays single; the 30-second reuse and the stale fallback on failure; `levels` exit codes; S2 pin reads for suffixed pins with and without effort, with and without a saved list.
- `node connectors/export.js --check`.
- `node --test viewer/test/model-options.test.js viewer/test/app-settings.test.js viewer/test/app-hub.test.js viewer/test/worker-effort-membership.test.js` with new cases for S3.4, S4.1 (each branch, including the note text) and S5.1.
- `npm --prefix viewer run test:browser -- --grep 'effort'` with a new case for S3.2 and S3.3.
- `node --test machine/test/project-mcp-agy.test.js` (argv with and without `--effort`).
- `bash install/test/run.sh` (shipped default pins).
- `node test-support/pick-tests.js --base <comparison commit>`, and the commands it prints.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-27

**Lanes:** intent (pending); mechanics (pending); cross-family: pending.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
