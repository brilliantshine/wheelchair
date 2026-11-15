---
slug: app-settings
date: 2026-11-15
implemented-by: "Codex standard (gpt-5.6-terra): T1, T3, T3b; Codex light (gpt-6-luna): T1b; Claude standard (sonnet): T2, T4, T5; sub-lead (Claude, lead model): family-fallback fix, routers"
verified-by: []
---

# Completion Report — A Settings page for how agents run and behave

Written for a hostile reviewer: every claim checkable, no claim without evidence.

```yaml
verified-by:
  - round: <n>
    lane: <verifier lane/model>
    checks: <the implementing lane it checked>
```

All paths are relative to the repository root on branch `wc/983d91c069d3`. Per-task reports,
with each worker's pasted output and choices, are in `docs/plans/app-settings/reports/`
(T1, T1b, T2, T3, T3b, T4, T5). Every worker choice is logged in PLAN.md's Log.

## Spec coverage

All rows are `this run`: PLAN.md's Prior Work is empty.

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| Tier names: Light/Standard/Heavy/Critical everywhere; old names accepted as aliases, output new names | this run | `codex/model.sh:15-30` (SLOTS, DEFAULTS, ALIASES), `:50-53`; `viewer/app/settings.js:11-13`; `viewer/app/sessions.js:16-28`; protocol files listed below | `bash codex/test/run.sh` ("legacy aliases resolve in files", "old alias writes the new name"); `viewer/test/app-hub.test.js:862`, `:894`; rename grep (evidence) |
| `haiku/sonnet/opus` are Claude-only aliases meaning slots | this run | `viewer/app/sessions.js:23-24`; `codex/model.sh:52-53` | `viewer/test/app-hub.test.js:894` |
| `top` = Heavy for a worker | this run | `viewer/app/sessions.js:27` | `viewer/test/app-hub.test.js:862` |
| Protocol rename + Claude lane section and ladder (`lanes.md`), alias lines, "old names mean slots" | this run | `protocol/lanes.md:63-87`, `:155-179`, `:200-205`; `protocol/app/sub-lead.md:52-84`, `:122-127`; `protocol/implementation.md`, `protocol/verification.md`, `protocol/plan-review.md`, `protocol/templates/COMPLETION.md:4` | rename grep (evidence); `reports/T5.md` |
| Models file format: provider.slot lines, `none`, Claude ` @<effort>`, `skip`, legacy lines = gpt, malformed fallback | this run | `codex/model.sh` (parser `parse_pins`/`read_pins`, around `:60-140`) | codex suite: "new format reads …", "legacy-only file reads as GPT", "malformed pins reader …" |
| Shipped defaults (incl. `claude.critical = claude-fable-5-2`, leads) | this run | `codex/model.sh:17-27` | codex suite "init writes the shipped models file"; `install/test/run.sh` default-file assertion |
| Writing renders the new form, every provider and slot, under lock + atomic replace; legacy file rewritten on first write | this run | `codex/model.sh` (`rendered`, `atomic_write`, `locked_write`) | codex suite "legacy first write rewrites every provider slot", "set and skip retain new rendering" |
| `model.sh` commands: `<tier>`, `<provider> <slot>` (exit 3 on none), `effort`, `family`, `set`, `skip`, `init`, `check`, `check --json`, `show --json` | this run | `codex/model.sh:284-345` (`main`) | codex suite (70 assertions; see evidence) |
| Added by sub-lead: `show --json` returns `visible`; `model.sh reset` | this run | `codex/model.sh:316`, `:329-340` | codex suite "reset writes defaults and drops skips", "reset repairs a malformed file", "show JSON supplies … visible cache" |
| Heads-up rules unchanged apart from names; GPT `none` tier ignored; hand-set pin family fallback | this run | `codex/model.sh:195-240` (`heads_up_events`; fallback `:208`) | codex suite "check text uses Heavy and the new switch form", "an unparseable pin uses its available-for line", "a none GPT tier is ignored by heads-up" |
| resolveModel per role (lead/sub-lead → `lead` slot; reviewer/verifier/mapper → Settings; worker → requested tier) | this run | `viewer/app/sessions.js:16-38` | `viewer/test/app-hub.test.js:862`, `:880` |
| Model always passed; Claude effort passed; `none` → 400 "<provider> is not used at <tier>; use the other CLI"; unknown tier 400 with list | this run | `viewer/app/sessions.js:30-37`, `:126-131` | `viewer/test/app-hub.test.js:880`, `:923` |
| Critical startable on both CLIs | this run | `viewer/app/settings.js:12`; `viewer/app/sessions.js:25` | `viewer/test/app-hub.test.js:862` |
| Machine passes `--effort` to Claude only | this run | `machine/service.js:52`, `:66-69`, `:274` | `machine/test/service.test.js:587` |
| Settings store `settings.json`, mode 0600, defaults, serialized read-modify-write | this run | `viewer/app/state.js:47`, `:176-194`; `viewer/app/settings.js:22-24`, `:150-177` | `viewer/test/app-settings.test.js:21`, `:96`, `:164` (file mode) |
| `other_agents` app-only; panel line "For threads in the app. Terminal commands keep their own rules." | this run | `viewer/pages/settings.js:276` | `viewer/test/app-settings.spec.js` (Models section) |
| Permission mode: hub sends `permission_mode`; service maps to `--permission-mode auto|bypassPermissions`; missing = auto | this run | `viewer/app/sessions.js:130`; `machine/service.js:51`, `:63-67`, `:274` | `machine/test/service.test.js:535`, `:557`; `viewer/test/app-hub.test.js:880` |
| Bypass readiness and confirmation handling (W3) | this run | `machine/service.js:270` (skip-prompt key for bypass), `:320`, `:339-345` | `machine/test/service.test.js:565`, `:576`; installed-CLI pane capture in `reports/T2.md` |
| Permission mode UI with "Codex never asks: it runs sandboxed to its worktree." | this run | `viewer/pages/settings.js:260-270` | browser spec (Models section) |
| Templates: shape, roles, scope, switches (incl. worker-only `unsettled`, `file_limit`), text ≤ 4000 | this run | `viewer/app/settings.js:48-91` | `viewer/test/app-settings.test.js:21`, `:164` |
| In use per role+scope, project beats all, none = no layer | this run | `viewer/app/routes.js:96-116`; `viewer/app/settings.js:116-119` | `viewer/test/app-settings.test.js:21` |
| One fixed sentence per switch value | this run | `viewer/app/settings.js:93-106` | `viewer/test/app-settings.test.js:21` |
| "N <role>s are using this now" via recorded `template_id` | this run | `viewer/app/sessions.js:107`; `viewer/app/settings.js:197-205` | `viewer/test/app-settings.test.js:21` |
| `worker.md` names the one rule a template may change; `sub-lead.md` keeps the flag | this run | `protocol/app/worker.md:35-39`; `protocol/app/sub-lead.md:107-112` | `reports/T5.md` |
| Templates page: grouped list, New/Save/Duplicate/Delete, layer stack footer (worker exception), layer 1 caption | this run | `viewer/pages/settings.js` (templates section, footer `:485-486`) | `viewer/test/app-settings.spec.js:91`, `:131` |
| Starting instructions: service pointer with its own root and new second sentence; `role_layers` after a blank line; `role_prompt` wins; same for Codex `[wc:role]` | this run | `machine/service.js:56-61`, `:265`, `:303` | `machine/test/service.test.js:599`, `:612`, `:619` |
| Hub composes `role_layers` (precedence line, worker decide variant, template block + "the brief wins", lead style block) | this run | `viewer/app/settings.js:121-134`; `viewer/app/sessions.js:85-87`, `:131` | `viewer/test/app-settings.test.js:21` |
| "See it in full" with the hub's root | this run | `viewer/app/settings.js:136-140`; `viewer/app/routes.js:126-130` | `viewer/test/app-settings.test.js:21` |
| `role_layers` cap 12000; saves that exceed it refused | this run | `viewer/app/settings.js:142-148`, `:168-177` | `viewer/test/app-settings.test.js:110` |
| Writing style fields, defaults (Collin's), rendering | this run | `viewer/app/settings.js:16-20`, `:36-46`, `:108-114` | `viewer/test/app-settings.test.js:60` |
| Style delivery to running leads: `style_version`, trailer once, new leads owe nothing, Codex leads too | this run | `viewer/app/sessions.js:108`, `:221-243` | `viewer/test/app-settings.test.js:60` |
| Chat strips a trailing `[wc:style]` block | this run | `viewer/app/chat.js:23-25`, `:137` | `viewer/test/app-settings.test.js:60` |
| `cards.md` marker row, `lead.md` style rule, `protocol/app/AGENTS.md` | this run | `protocol/app/cards.md:256`; `protocol/app/lead.md:31-33`; `protocol/app/AGENTS.md:23-25` | `reports/T5.md` |
| Writing style section (Covers line without phone notifications), explicit Save | this run | `viewer/pages/settings.js` (writing section, `:577-660`) | `viewer/test/app-settings.spec.js:140` |
| Style preview: hub route, Light model or haiku fallback, 75 s client timeout, `{before, after}` | this run | `viewer/app/settings.js:208-218`; `viewer/app/machine-client.js:10`, `:64`; `viewer/app/routes.js:125` | `viewer/test/app-settings.test.js:60`, `:136` |
| `/v1/preview` on the machine: `claude -p --model … --permission-mode dontAsk`, stdin, 60 s, async; 400/502/503/504 | this run | `machine/service.js:707-728`, `:736` | `machine/test/service.test.js:635`, `:645`, `:657` |
| Preview UI: spinner + disabled while running, error line, saves nothing | this run | `viewer/pages/settings.js:530-565` | `viewer/test/app-settings.spec.js:158`, `:183` |
| Heads-up on the page: Switch/Skip on GPT tier, tierless Skip only, malformed Reset to defaults | this run | `viewer/app/routes.js:61-74`; `viewer/pages/settings.js:162-190` | `viewer/test/app-settings.test.js:164` |
| Settings page route, files, nav link | this run | `viewer/server.js:1830`; `viewer/pages/settings.html`, `settings.js`, `settings.css`; `viewer/pages/nav.js:42` | `viewer/test/app-settings.spec.js:35` |
| Desktop section list / phone tabs, no horizontal scroll, section in hash | this run | `viewer/pages/settings.js:681-686`; `viewer/pages/settings.css` | `viewer/test/app-settings.spec.js:43`, `:197` |
| Models table pickers: Claude "Latest …" aliases + exact models, GPT visible + current, Not used, Other…, effort; leads pickers; saves at once | this run | `viewer/app/settings.js:186-195`; `viewer/pages/settings.js:85-110`, `:213-275` | `viewer/test/app-settings.spec.js:59` |
| Settings API table (all ten routes), 400/404, browser-route rules | this run | `viewer/app/routes.js:44-131`; documented `viewer/app/API.md:28-37`, `:64` | `viewer/test/app-settings.test.js` (all six tests) |
| Edge cases: missing models file, legacy rewrite, delete in-use template, project no longer listed, queued message gets trailer, Codex leads | this run | as rows above; `scope_missing` at `viewer/app/settings.js:204` | codex suite; `viewer/test/app-settings.test.js:60`, `:96`; `viewer/test/app-settings.spec.js:131` |
| Non-goals not built (Accounts, Usage, other providers, balancing, asides …) | this run | absent from `viewer/pages/settings.js` (T4 brief listed them) | `reports/T4.md`; reviewer inspection |

## Deviations from plan

- `model.sh show --json` also returns `visible`, and `model.sh reset` is new. Both were the
  sub-lead's decisions, so the hub never reads the Codex cache itself and "Reset to defaults"
  has a writer. They add to the Spec's interface without changing any of it.
- The 12000-character cap can't be reached through valid fields: one template of at most 4000
  characters plus a style of at most 2000 per role stays well under it. The check is in place,
  and its tests use a stored oversized template.
- Settings page wording and layout choices are listed under T4 in PLAN.md's Log (e.g. a
  "Mark in use" button the design lacks; Checker and Mapper listed as separate groups).

## Routers

highways is not installed, so this run didn't sweep the routers. Three edits were made by hand
so they don't misdescribe the change: `viewer/AGENTS.md` (pages list gains `settings`; new row
for `app/settings.js`), the root `AGENTS.md` (`pages/` includes the Settings page), and
`codex/AGENTS.md` (T1: `model.sh` now covers Claude and GPT cells, `reset` and `show --json`).

## Validation evidence

Run on the integrated feature branch, before COMPLETION.md was committed:

```
$ sha256sum ~/.wheelchair/models   (before and after everything below)
cdb9373d2d90d7b38be4c5c1b18ce9c1e3bbaa30abf8f1709c81abf191ef73c2  (identical)

$ bash codex/test/run.sh
RESULT 70 passed, 0 failed

$ bash machine/test/run.sh
# tests 62
# pass 62
# fail 0

$ bash install/test/run.sh
PASS real Codex config is byte-identical after suite
PASS real wheelchair directory is byte-identical after suite
RESULT 90 passed, 0 failed

$ bash sensitivity/test/run.sh ; bash seen/test/run.sh
RESULT 64 passed, 0 failed
PASS every lane invocation in protocol/lanes.md carries WHEELCHAIR_LANE=1

$ node --test viewer/test/*.test.js
not ok 155 - a starter that loses the freed port registers through the new holder
not ok 183 - an app page carries font-src self and the font route serves only the allowlist
# tests 261
# pass 259
# fail 2

$ npm --prefix viewer run test:browser
  2 failed
    [chromium] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
    [firefox] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
  2 skipped
  428 passed (1.4m)

$ grep -rnE '\b(luna|terra|astra)\b|\bSol\b' protocol viewer/app codex machine --include=*.md --include=*.js --include=*.sh | grep -v 'gpt-'
protocol/lanes.md:85:  The old names `luna`, `terra`, `sol`, `astra` (any CLI) and `haiku`, `sonnet`, `opus` (Claude)
protocol/app/sub-lead.md:75:cell in Settings is Not used for that CLI is refused. The old names `luna`, `terra`, `sol`, `astra`
viewer/app/settings.js:13:const TIER_ALIASES = { luna: 'light', terra: 'standard', sol: 'heavy', astra: 'critical' };
viewer/app/API.md:64:Heavy). The tiers are `light`, `standard`, `heavy`, and `critical`; `luna`, `terra`, `sol`, `astra` and,
codex/model.sh:29:ALIASES = {"luna": "light", "terra": "standard", "sol": "heavy", "astra": "critical"}
codex/test/run.sh:67:printf '%s\n' 'luna = old-light' 'terra = old-standard' 'sol = old-heavy' 'astra = old-critical' > "$pins"
codex/test/run.sh:74:run_model set gpt luna replacement
```

Only alias tables, alias lines and alias tests remain.

The failures predate this build, and none of them touches it:
- "an app page carries font-src self …" and "a starter that loses the freed port …" fail the
  same way on the feature branch before T3 merged (checked by the sub-lead). The first needs
  font files a worktree lacks; the second is a port-race timing test.
- "no drawn arrow's line …" fails the same way on `main` (`fb9e244`, run in the canonical
  clone).
- One more test, "the global write lock serializes concurrent writes …", failed once under load
  and passed on five reruns.

## Known gaps / residual risks

- **Bypass confirmation never seen live.** The installed Claude Code (2.1.325) showed none,
  because `~/.claude/settings.json` already sets `skipDangerousModePermissionPrompt`. Two
  things cover it: the bypass per-session settings file sets that key, and `checkReady`
  answers a "Yes, I accept" dialog. Neither was exercised against a real dialog. A bypass
  session started on a machine without that user setting could get stuck at startup if the
  `--settings` key isn't honoured and the dialog wording differs.
- **Running hub predates this branch.** The hub serving the app runs main. Until this merges
  and the services restart, it accepts only the old tier names and has no Settings routes.
- **Preview against real Claude not run.** The style preview was tested with a fake `claude`
  only; no real `claude -p` preview was executed.

## Remediation rounds

Appended by Stage 4 loops; never erase earlier content.

### Remediation 1 — 2026-11-15

Verification attempt 1 (commit `10bf75b`): Claude verifier PASS, Codex verifier FAIL with two
gaps, both upheld. The gaps and tasks are in `REMEDIATION-1.md`.

| Gap | Fix | Lane | Validated by |
|-----|-----|------|--------------|
| The page dropped `false` boolean switch values on template Save | `viewer/pages/settings.js:288` (new drafts start `false`), `:303-304` (save the boolean either way) | Claude / Light (haiku) | `viewer/test/app-settings.spec.js` template test: both stored `false`, both "off" sentences in `GET /settings/prompt` |
| `show --json` `visible` omitted cached models without a family word (e.g. `gpt-7`) | `codex/model.sh:195-212` (`listed_models`, used only by `show --json` at `:359`); heads-up still uses `visible_models` | Codex / Light (gpt-6-luna) | `bash codex/test/run.sh` (visible `gpt-7`, `gpt-7-nova`, hidden `gpt-8` → `["gpt-7-nova","gpt-7"]`; check output unchanged) |

Validation after remediation, on the integrated branch (`~/.wheelchair/models` checksum
`cdb9373d…` unchanged before and after):

```
$ bash codex/test/run.sh                 RESULT 72 passed, 0 failed
$ bash machine/test/run.sh               # pass 62  # fail 0
$ bash install/test/run.sh               RESULT 90 passed, 0 failed
$ node --test viewer/test/*.test.js      # tests 261  # pass 260  # fail 1
  not ok 155 - a starter that loses the freed port registers through the new holder   (fails without this work; see above)
$ npm --prefix viewer run test:browser   428 passed, 2 skipped, 2 failed
  [chromium|firefox] no drawn arrow's line passes through either box …                (fails on main)
```

### Remediation 2 — 2026-11-15

Verification attempt 2 (commit `9649e1f`): Claude verifier PASS, Codex verifier FAIL with two
new gaps, both upheld. The gaps and the task are in `REMEDIATION-2.md`.

| Gap | Fix | Lane | Validated by |
|-----|-----|------|--------------|
| `PUT /settings/models` refused old tier names (e.g. `terra`) | `viewer/app/routes.js:53-55` (slot aliases: `luna/terra/sol/astra` for either provider, `haiku/sonnet/opus` for Claude), `:65-67` (heads-up switch tier aliases) | Codex / Light (gpt-6-luna) | `viewer/test/app-settings.test.js` (alias tests: `terra` sets `gpt.standard`, Claude `opus` sets `claude.heavy`, GPT `opus` is 400, switch `sol` sets `gpt.heavy`) |
| Template scope was not checked against `projects.json` | `viewer/app/routes.js:93-97` (create), `:113-119` (update, checked only when the scope changes, so a removed project's template stays editable) | Codex / Light (gpt-6-luna) | `viewer/test/app-settings.test.js` "template scopes must be listed when added or changed, while removed-project templates remain editable" |

The worker's own validation stopped on its new test, which read the message from
`body.error`; the sub-lead changed it to `body.detail`, the hub's error field.

Validation after remediation, on the integrated branch (`~/.wheelchair/models` checksum
`cdb9373d…` unchanged):

```
$ bash codex/test/run.sh                 RESULT 72 passed, 0 failed
$ bash machine/test/run.sh               # fail 0
$ node --test viewer/test/*.test.js      # tests 262  # pass 261  # fail 1
  not ok 156 - a starter that loses the freed port registers through the new holder   (fails without this work)
$ npm --prefix viewer run test:browser   428 passed, 2 skipped, 2 failed
  [chromium|firefox] no drawn arrow's line passes through either box …                (fails on main)
```
