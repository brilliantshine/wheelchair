---
slug: model-effort-escalation
date: 2026-11-15
implemented-by: "codex standard (gpt-6.1-terra): T1, T3; codex light (gpt-6-luna): T2; claude standard (claude-sonnet-5-5): T4, T5; sub-lead claude-opus-5-5"
verified-by: []
---

# Completion Report — Effort and escalation rules in Settings

Written for a hostile reviewer: every claim checkable, no claim without evidence.
Feature branch `wc/70d7c545bb47`; all line numbers are at the commit that adds this file.

## Spec coverage

No Prior Work items existed; every row was built this run.

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| §1 model.sh: GPT `@effort` parsed (low…xhigh), `max` malformed, none rejects effort | this run | codex/model.sh:32, :79-85 | codex/test/run.sh "GPT max in a pins file is malformed", "set rejects GPT effort with none" |
| §1 model.sh: writer writes GPT effort | this run | codex/model.sh:127 | "GPT effort is written to the pins file" |
| §1 model.sh: `set gpt <slot> <m> [effort]`, `max` → exit 2 naming allowed values | this run | codex/model.sh:369-381 | "set accepts GPT effort", "set rejects GPT max and names allowed efforts" |
| §1 model.sh: `effort gpt <slot>` prints it; `show --json` includes GPT effort | this run | codex/model.sh:321-325, :353-361 | "GPT effort reads back", "show JSON reports GPT effort" |
| §1 PUT /settings/models accepts GPT effort, validates GPT list, absent clears | this run | viewer/app/routes.js:57-61 | viewer/test/app-settings.test.js "settings model and heads-up routes reject bad input…" (GPT xhigh saved, max refused, cleared) |
| §1 Settings page: GPT tier row and both Leads rows get effort selects, per-provider values, disabled when Not used, new hint text | this run | viewer/pages/settings.js:16, :109, :150-158, :224, :287, :293 | app-settings.spec.js:98 "effort selects: GPT tier and both leads save; GPT has no max" (Chromium, Firefox) |
| §1 Phone width for the effort selects | this run | viewer/pages/settings.css (existing stacked table) | app-settings.spec.js:294 phone test |
| §1 resolveModel reads effort for both providers incl. `lead` | this run | viewer/app/sessions.js:32 | app-hub.test.js "worker effort overrides and escalation ceilings…" (codex lead gets GPT lead pin effort `high`) |
| §1 machine service: codex argv `-c model_reasoning_effort=<e>` only when set | this run | machine/service.js:287 | machine/test/service.test.js "Codex effort is passed as model_reasoning_effort when set", "Codex without effort has no model_reasoning_effort setting" |
| §2 wc.js `--effort` sent as `effort` only when given | this run | viewer/app/wc.js:86 | app-hub.test.js "wc session start includes effort only when supplied" |
| §2 effort only for sub-lead → worker, else 400 "effort can only be set for a worker" | this run | viewer/app/sessions.js:325 | app-hub.test.js ceilings test (reviewer and verifier starts by a lead refused) |
| §2 effort validated per CLI; codex `max` → "GPT's highest effort is xhigh"; overrides pin | this run | viewer/app/sessions.js:328-334, :137 | ceilings test (max refused, xhigh accepted, `low` overrides pinned `xhigh`) |
| §2 tier above `max_tier` refused, `top`→heavy before the check | this run | viewer/app/sessions.js:76-78 | ceilings test (critical and top refused with max_tier standard, exact message) |
| §2 requested effort above `max_effort` refused; codex `max` ceiling counts as xhigh | this run | viewer/app/sessions.js:79-83 | ceilings test (xhigh above high refused; with max ceiling codex xhigh accepted) |
| §2 pinned effort never checked; non-worker starts never checked | this run | viewer/app/sessions.js:76 (`role === 'worker'` only, checks `input.effort` only) | ceilings test (standard pinned xhigh starts under max_effort high) |
| §2 refusals leave no session record (brief detail) | this run | viewer/app/sessions.js:74-84 (before preflight and push) | ceilings test (session count and preflight call count unchanged) |
| §3 `escalation` stored in settings.json, defaults effort/xhigh/critical/critical, normalize falls back per key | this run | viewer/app/settings.js:14, :24, :176 | app-settings.test.js "escalation settings, sentences, and role layers" (normalize case, GET defaults) |
| §3 PUT /settings/preferences `escalation` partial, 400 naming key/value/non-object; response adds `escalation`, `escalation_text` | this run | viewer/app/routes.js:93-107 | same test (each key invalid, null/[]/string, unknown key) |
| §3 GET /settings returns `escalation`, `escalation_text` | this run | viewer/app/settings.js:226 | same test |
| §3 `escalationSentences`: four sentences, model-first variant, actual values named, GPT clause for max, sentence 3 rules incl. omission when max_tier < critical | this run | viewer/app/settings.js:122-136 | same test (defaults verbatim; model/max/heavy/any; never; critical with heavy → 3 sentences) |
| §3 role layers: sub-lead only, "Escalation rules from Settings:" + sentences, within 12000 check | this run | viewer/app/settings.js:149 | same test (sub-lead contains, lead/worker/reviewer/verifier/mapper do not) |
| §3 Settings page Escalation section after Leads: text, four segmented rows, immediate save, re-render, Saved note, phone width | this run | viewer/pages/settings.js:250-271, :294-303; viewer/pages/settings.css:56-57 | app-settings.spec.js:114 "Escalation: default text, Model first, Highest tier Heavy"; :294 phone, no side scroll at 390px |
| §3 API.md updated | this run | viewer/app/API.md:28-31, :66-82 | read |
| §4 sub-lead.md escalation section defers to the Settings block, `--effort`, refusal handling, first-dispatch carve-out, asking via message | this run | protocol/app/sub-lead.md:74-76, :124-151 | read; `grep "Light, Standard, Heavy, Critical" protocol/app/sub-lead.md` is empty |
| §4 lead.md §7 Step up / Stop here sentence | this run | protocol/app/lead.md:244-246 | read |
| §4 machine/API.md effort for Codex | this run | machine/API.md:10 | read |
| §4 cards.md, lanes.md, implementation.md, verification.md unchanged | this run | `git diff 695931e --name-only` lists none of them | below |
| Edge: saved settings without `escalation` load defaults | this run | viewer/app/settings.js:176 | GET defaults in app-settings.test.js |

## Deviations from plan

- Added (sub-lead decision, logged in PLAN.md): `POST /settings/models/heads-up` `switch`
  keeps the GPT cell's effort (viewer/app/routes.js:68-69). Without it, model.sh `set`
  without an effort would silently clear a GPT effort on a heads-up model switch. Tested in
  app-settings.test.js ("switched.body.models.gpt.heavy.effort === 'xhigh'").
- `escalation_text` joins the sentences with "\n" (Spec said "joined"); the page renders one
  paragraph per line.
- Otherwise none.

## Routers

highways not installed; routers not maintained. (No ownership moved; every file touched
keeps the role its router already gives it.)

## Validation evidence

Run by the sub-lead on the merged feature branch (c959d63), from the worktree root:

```
$ bash codex/test/run.sh          → RESULT 78 passed, 0 failed   (exit 0)
$ bash machine/test/run.sh        → # pass 67  # fail 0          (exit 0)
$ bash install/test/run.sh        → RESULT 90 passed, 0 failed   (exit 0; nothing under install/ changed)
$ node --test viewer/test/*.test.js
# tests 267
# pass 266
# fail 1
not ok 161 - a starter that loses the freed port registers through the new holder
$ npm --prefix viewer run test:browser
  ✘ [chromium] test/browser.spec.js:2395 no drawn arrow's line passes through either box it connects, over every committed graph
  ✘ [firefox]  test/browser.spec.js:2395 (same)
  2 failed
  2 skipped
  452 passed (1.7m)
```

New tests passing (excerpts from the same runs):

```
ok 57 - Codex effort is passed as model_reasoning_effort when set
ok 58 - Codex without effort has no model_reasoning_effort setting
ok 104 - worker effort overrides and escalation ceilings reject before starting
ok 105 - wc session start includes effort only when supplied
ok 125 - escalation settings, sentences, and role layers
✓ [chromium] app-settings.spec.js:98 effort selects: GPT tier and both leads save; GPT has no max
✓ [chromium] app-settings.spec.js:114 Escalation: default text, Model first, Highest tier Heavy
✓ [chromium] app-settings.spec.js:294 phone: the Escalation section fits a phone and the effort selects stay usable
✓ [firefox]  (the same three)
PASS set accepts GPT effort / GPT effort reads back / show JSON reports GPT effort
PASS set rejects GPT max and names allowed efforts / GPT max in a pins file is malformed
```

The three failures are not from this build:
- "a starter that loses the freed port…" (viewer/test/lifecycle.test.js:420) fails on the
  feature branch at d9ee0ca, before any hub or page change merged (run twice, failed both
  times), and is recorded in docs/known-issues.md:6.
- browser.spec.js:2395 checks only committed `docs/plans/*/graphs/*.json` through the graph
  viewer (`viewer/index.html`, `viewer/server.js`). This thread changes no graph file and
  neither of those (`git diff 695931e --name-only` above). The error is a null SVG path
  `match` while parsing an existing graph's arrow.

## Known gaps / residual risks

- Neither Codex's handling of `-c model_reasoning_effort=<e>` nor Claude's `--effort max`
  per model was exercised against a live CLI; tests use fake CLIs (MAP.md "What I did not
  look at"). Decision 5 relies on `codex exec --help` 0.169.0.
- "Ask me before" is followed by agents as written rules only; the hub does not enforce it
  (Decision 13).
- A pins file written by this version with a GPT effort is malformed to an older model.sh
  (Spec Edge cases; accepted).

## Remediation rounds

None yet.
