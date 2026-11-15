---
slug: app-settings
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-15
---

# A Settings page for how agents run and behave

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

Map: `MAP.md` (sessions, thread page, serving), with detail in `docs/maps/app-sessions.md`.
Source proposal: `docs/proposals/app-settings/proposal.md`.

## Open Questions

None.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| W1 | The running app refuses the `title` card kind, the `doc` field on question cards, and `resolve` on question cards, all of which `protocol/app/cards.md` and `viewer/app/API.md` on main allow | The installed services likely predate main; not this feature | yes (in chat) | waved off: outside this feature, raised to Collin |
| W3 | What Claude's pane shows in bypass mode, and whether it asks for a one-time confirmation in an interactive session | The implementer must check against the installed CLI and handle both in the ready test | no | settled into the Spec as a requirement |
| W2 | The heads-up from `/v1/preflight` is discarded by the hub (`viewer/app/ready.js:17-24`) | Needed for the switch/skip on the page | no | settled: the hub runs `model.sh check --json` itself (Spec, heads-up) |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Asides are not built here; the side-conversations thread owns them | They need none of the settings work; avoid building them twice | user |
| 2 | Accounts, usage, balancing and providers beyond Claude and GPT split into their own stub thread ("Accounts, usage and balancing") | Nothing reads usage today and accounts need per-account login folders; the rest has a slot ready (`role_prompt`) | user |
| 3 | The lead's model is a setting, defaulting to Claude Opus 5.5, not a fixed rule | Collin: "that's my preference … not a global rule" | user |
| 4 | Settings sidebar entries without a design here (Accounts, Usage, Nodes, Diagrams, Notifications) are left out of the sidebar until their thread builds them | Nothing to show; dead links read as broken | defaulted |
| 5 | Templates and the writing style reach an agent through the machine service's existing `role_prompt` (`machine/service.js:245`, `283-286`), composed by the hub as built-in pointer, then template, then (leads only) style | The slot exists and is fixed at start, matching "applies to agents started after saving" | defaulted |
| 6 | Rename the tiers everywhere: Luna→Light, Terra→Standard, Sol→Heavy, Astra→Critical in the app, `protocol/`, `codex/model.sh`, the pins file and tests; the old names stay accepted as aliases | One vocabulary; aliases keep existing pins files and old plan docs readable | user |
| 7 | One models file: the Settings page reads and writes the hub machine's models file (`~/.wheelchair/models`), extended to hold Claude's cells, "Not used" and the lead's model; `codex/model.sh` (or its successor) stays its only parser and writer, used by both the hub and the terminal workflow | Follows from 6: one vocabulary and one source, so the terminal workflow and the app never disagree | defaulted |
| 8 | The Models screen here builds the tier table (Claude, GPT), the lead's model, and "Other agents" (plan reviewers, checker, code mapping). Worker provider order, Save Claude for leads, the margin, rules by kind of work (UI, critical marking, suggested rules) and the asides row go to the "Accounts, usage and balancing" thread | Everything kept here works without usage data; the deferred parts are about running low, which needs the balancer | user |
| 9 | Critical here means only that the tier is startable and resolves through the table (fixing today's refusal of Astra); marking parts critical and the cross-check by another provider's Critical model are rules by kind of work, so they go with decision 8 to the accounts thread | Follows from 8 | defaulted |
| 10 | Claude sessions get a permission mode setting: auto (today's) or bypass. Codex is unchanged (`-a never`, sandboxed to its worktree) | Bypass is what Collin assumed sessions did; auto stays as the tested fallback | user |
| 11 | A saved writing style reaches running leads too: the next message the hub delivers to each live lead after the save carries the new style once. IDEA's Not doing gains this one exception | Threads live for days; waiting for a lead restart would hide the change. Collin agreed to the IDEA change on the card | idea-change |
| 12 | The style preview is a real rewrite of a fixed sample by Claude's Light model, run when Collin presses Preview, not live on every change | Honest preview of his own words without a model call per keystroke | user |
| 13 | The lead's model is one `lead` slot per provider in the models file (defaults Claude Opus 5.5, GPT Heavy); the thread's CLI still picks the provider | Decision 3 without the balancing-dependent fallback choices | defaulted |
| 14 | Reviewer, checker and mapper tiers come from Settings ("Other agents"); the cross-family rule for which provider stays in `lead.md` | The design's "two providers" / "not the provider that built it" is already the lead's rule | defaulted |
| 15 | Effort is a per-cell option for Claude only (`--effort`); GPT cells take none | The design's only effort choice is "Opus 5.5, highest effort" | defaulted |
| 16 | `codex/model.sh` keeps its path while covering Claude too | Moving it touches every protocol reference for no behavior gain | defaulted |
| 17 | Running leads get a new style as a `[wc:style]` trailer at the end of their next delivered message, stripped from the chat | A trailer keeps start-of-message markers working and stays out of Collin's bubble | defaulted |

## Spec

The settled design. A fresh agent with no conversation history implements from this section.

### Scope

Builds: a Settings page in the hub app with three sections (Models and preferences,
Behavior templates, Writing style), the settings store and API behind it, the tier rename,
the hub's per-role model resolution, the permission mode, templates and style reaching
agents, and the style preview. Follows `docs/proposals/app-shell/design/SettingsModels`,
`SettingsTemplates` and `SettingsWriting` (`.dc.html`) for layout and wording, minus the
parts listed as non-goals.

Non-goals (do not build, do not stub in the UI): Accounts, Usage and balancing, Nodes,
Diagrams and Notifications sections; provider rows other than Claude and GPT and the "Add a
coding CLI" buttons; the "Providers covering it" row; Leads' provider fallback choices
("Claude, then GPT heavy", "Either"); Save Claude for leads; the Claude margin; "Workers try
these in order"; rules by kind of work, including critical marking and suggested rules; the
Asides row of Other agents; account counts ("2 accounts") on provider rows; anything about
asides. Running agents are not changed, except the style delivery below.

### Tier names

- Four tiers, everywhere: **Light** (was Luna), **Standard** (Terra), **Heavy** (Sol),
  **Critical** (Astra). Every file that names a tier uses the new name: `viewer/app/sessions.js`,
  `viewer/app/API.md`, `codex/model.sh`, `protocol/lanes.md`, `protocol/app/sub-lead.md`,
  `protocol/app/lead.md`, `protocol/implementation.md`, `protocol/verification.md`,
  `protocol/plan-review.md`, `protocol/templates/COMPLETION.md`, and the codex, installer and
  hub test suites (full list: `docs/maps/app-sessions.md`, "Every place the tier names …").
- Old names are accepted on input wherever a tier is read and mean the new tier:
  `luna|terra|sol|astra` → light/standard/heavy/critical for any CLI, and Claude's current
  `haiku|sonnet|opus` → light/standard/heavy. Output always uses the new name. Old plan
  documents under `docs/plans/` are history and are not edited.
- GPT model names (`gpt-6-luna` …) are model names, not tier names, and are unchanged.
- `top` stays accepted and means Heavy for a worker (see resolution below).

### The models file

- One file, the hub machine's `~/.wheelchair/models` (`WHEELCHAIR_MODELS` overrides, as
  today). `codex/model.sh` stays its only parser and writer (the path is kept to avoid
  churn); the hub calls it, never parses the file itself.
- Format, one entry per line, `#` comments allowed:
  - `<provider>.<slot> = <model>` or `<provider>.<slot> = none` ("Not used"), where provider
    is `claude` or `gpt` and slot is `light`, `standard`, `heavy`, `critical` or `lead`.
  - A Claude entry may end in ` @<effort>` with effort one of `low medium high xhigh max`
    (Claude's `--effort` values). GPT entries take no effort.
  - `skip = <model>` as today.
  - Legacy lines `<tier> = <model>` (old or new tier name, no provider) mean `gpt.<tier>`.
    A file with only legacy lines (every pins file today) reads correctly. `lead` and `none`
    are not valid in legacy lines.
  - Any other line makes the file malformed, as today: readers fall back to the shipped
    defaults and the heads-up says so.
- Shipped defaults: `claude.light = claude-haiku-5-5`, `claude.standard = claude-sonnet-5-5`,
  `claude.heavy = claude-opus-5-5`, `claude.critical = claude-fable-5-2`,
  `claude.lead = claude-opus-5-5`; `gpt.light = gpt-6-luna`, `gpt.standard = gpt-5.6-terra`,
  `gpt.heavy = gpt-6.1-sol`, `gpt.critical = gpt-6-astra`, `gpt.lead = gpt-6.1-sol`. (The
  proposal named Fable 5.1; Fable 5.2 is the current model.)
- Writing always renders the new form, every provider and slot, plus skips, under the
  existing lock and atomic replace.
- `model.sh` commands (old forms keep working and act on `gpt`):
  - `model.sh <tier>` → GPT model for that tier, as today (`none` exits 3 with
    "gpt is not used at <tier>").
  - `model.sh <provider> <slot>` → the model; exits 3 with "<provider> is not used at
    <slot>" when `none`.
  - `model.sh effort <provider> <slot>` → the effort, or nothing.
  - `model.sh set <provider> <slot> <model|none> [effort]`; `set <tier> <model>` = gpt.
  - `model.sh skip <model>`, `init`, `check` as today; `check --json` prints
    `[{kind:"newer"|"available"|"tierless"|"malformed", tier, model, current}]` with the same
    rules the text form uses; the text form is unchanged apart from tier names.
  - `model.sh show --json` prints `{claude:{light:{model,effort}|null,…,lead},gpt:{…},
    malformed:bool}` for the Settings page.
- Validation: model values match the existing `VALUE` pattern.

### How the hub picks a session's model

`resolveModel` (`viewer/app/sessions.js:21-35`) becomes per role:

| Role | Model |
|---|---|
| lead, sub-lead | the CLI's `lead` slot; the request's tier is ignored |
| reviewer | the Settings "Plan reviewers" tier (default Heavy) |
| verifier | the Settings "Checker" tier (default Heavy) |
| mapper | the Settings "Code mapping" tier (default Standard) |
| worker | the request's tier (`top` = Heavy) |

- The tier is looked up for the session's CLI (`claude` → provider `claude`, `codex` →
  `gpt`) through `model.sh <provider> <slot>` and passed to the machine as `model`, plus
  `effort` for Claude when set. Claude no longer starts without `--model`.
- A slot set to `none` refuses the start with 400: "<provider> is not used at <tier>; use the
  other CLI". An unknown tier is 400 with the list of valid ones.
- Critical is startable on both CLIs (today `astra` is refused).
- The machine service passes `effort` as `--effort <value>` to Claude only.
- `protocol/app/lead.md` and `sub-lead.md` are updated: lead keeps passing `--tier top` (now
  ignored for the roles above, and documented as such); the sub-lead's tier list becomes
  `light`, `standard`, `heavy`, `critical` (or `top`) for both CLIs, and its ladder text
  uses the new names; reviewer, verifier and mapper tiers are named as coming from Settings.

### Settings store

- `<hub state dir>/settings.json` (beside `machines.json`, `viewer/app/state.js:45-46`),
  written atomically through `State.queued`, mode 0600. Missing file = defaults. Holds:
  `permission_mode` (`auto` | `bypass`, default `auto`), `other_agents`
  (`{reviewer, verifier, mapper}` tiers, defaults heavy/heavy/standard), `templates`
  (below), `style` (below) and `style_version` (integer, bumped on each style save).
- Model choices are not in it; they are in the models file.

### Permission mode

- Claude only: **Auto** (default) or **Bypass**. Shown on Models and preferences under the
  lead's model, with one line: "Codex never asks: it runs sandboxed to its worktree."
- Applies to sessions started after saving. The hub sends `permission_mode` on
  `POST /v1/sessions`; the machine service passes `--permission-mode auto` or
  `--permission-mode bypassPermissions` (`machine/service.js:254`). Missing = auto.
- Readiness (`machine/service.js:297-300`) recognises the bypass pane as ready the way it
  recognises "auto mode on" today. Any one-time confirmation Claude shows on entering
  bypass must not block the start: the implementer checks the installed Claude CLI's pane
  in bypass mode and either answers it the way the service answers the folder-trust prompt
  or suppresses it through the per-session settings file, and records which in the Log.

### Behavior templates

- A template: `{id, name, role, scope, switches, text}`. `role` is one of `lead`, `sub-lead`,
  `worker`, `reviewer`, `verifier` (shown as "Checker"), `mapper`. `scope` is `all` or a
  project path from `projects.json`. `switches`, all optional:
  - `save_every_step` (bool), `full_tests_before_done` (bool),
  - `packages`: `ask` | `go` | `never` ("Ask the lead first", "Go ahead", "Never"),
  - `unsettled`: `ask` | `decide` ("Ask the lead", "Pick, record it, keep going"),
  - `file_limit`: integer ≥ 1 or absent.
  `text`: free text, at most 4000 characters.
- In use: per role, at most one template is in use for `all` and one per project. Marking a
  template in use clears the previous one for the same role and scope. A project-scoped
  template in use beats the `all` one for sessions in that project. A role with none in use
  gets no template layer. The page lists templates grouped by role with "in use" tags, as
  the design does; New template, Save, Duplicate and Delete act on them.
- Each switch renders to one fixed English sentence (the implementer writes them, plain,
  one per value; e.g. `packages: ask` → "Before installing a new package, ask whoever
  started you."). The template layer is those sentences, then `text` as is.
- "N <role>s are using this now": live sessions in any thread whose recorded
  `template_id` is this template. The hub records `template_id` (or null) on each session at
  start.
- "See it in full" shows the exact composed starting instructions for that role (below).

### What an agent is told at start

The hub sends `role_prompt` on `POST /v1/sessions` (the service already accepts it,
`machine/service.js:245`, `283-286`), composed of, in order:
1. `Read <root>/protocol/app/<role>.md before responding. It is wheelchair's built-in rules
   for your role; nothing below overrides it.`
2. If a template applies: a heading line naming it as Collin's behavior template for this
   role, then its sentences and text.
3. For a lead only, if a style is saved: a heading line naming it as Collin's writing style
   for everything he reads (thread replies and the text of cards), then its rendering
   (below).
Total `role_prompt` length is capped at 12000 characters; the API refuses a template or
style save that would exceed it. Templates and style apply to sessions started after
saving.

### Writing style

- Leads only. `style`: `length` (`short` | `balanced` | `thorough`), `lists`
  (`prose` | `when-helpful` | `always`), `terms` (`build-up` | `freely` | `avoid`),
  `never_say` (list of phrases), `text` (free text, at most 2000 characters). Defaults are
  Collin's starting style: short, when-helpful, build-up, never say "It's worth noting" and
  "load-bearing", and the two sentences of free text in `SettingsWriting.dc.html`.
- Rendering: one fixed sentence per choice, the never-say list as one sentence listing the
  phrases, then `text`. The same rendering is used at start, on delivery and in the preview.
- Delivery to running leads: on a style save, the hub records the new `style_version`.
  When `deliver` (`viewer/app/sessions.js:208-233`) submits a message to a live `lead`
  session whose recorded `style_version` is lower, it appends to that message's text a
  trailer: a blank line, `[wc:style]`, and the rendering, saying it replaces any earlier
  style; then sets the session's `style_version`. A lead started after the save records the
  current version at start and owes nothing. The `sent` record keeps the text as submitted.
- The chat (`viewer/app/chat.js`) strips a trailing `[wc:style]` block from human items
  before display, so Collin's bubble shows only what he typed or pressed, and the existing
  start-of-message markers (`[wc:from …]`, `[card …]`) keep working because the trailer is
  at the end.
- `protocol/app/cards.md`'s marker table gains the `[wc:style]` trailer; `lead.md`'s "How
  you talk to Collin" says to follow the writing style in the starting instructions, a
  later `[wc:style]` trailer replacing it, under the rules of `lead.md` and `cards.md`.
  `protocol/app/AGENTS.md:23-25` is updated to say leads follow Collin's style while the
  wording hook stays off.

### Style preview

- The Writing style section shows "Without your style" (a fixed sample, the design's
  text) and "With your style" (empty until previewed) and a **Preview** button.
- Preview sends the unsaved style to `POST /wheelchair/api/settings/style/preview`; the hub
  calls the hub machine's new `POST /v1/preview` `{prompt, model}`, which runs
  `claude -p --model <model> --permission-mode default` with `WHEELCHAIR_LANE=1`, the prompt
  on stdin, no tools needed, a 60 s timeout, and returns `{text}`. Model = the `claude.light`
  slot, or `claude-haiku-5-5` if it is `none`.
- The prompt asks for the sample rewritten under the rendered style, output only.
- While running the button shows a spinner and is disabled. Errors (Claude not installed or
  not logged in, timeout, non-zero exit) show one plain line under the panel; nothing is
  saved by previewing.

### The newer-model heads-up

- `GET /settings` includes the heads-up from `model.sh check --json`, run by the hub on the
  hub machine. Models and preferences shows each item as one line on the GPT row's tier
  with **Switch** (`model.sh set gpt <tier> <model>`) and **Skip** (`model.sh skip <model>`),
  then reloads. Tierless items list the model with **Skip** only. A malformed file shows one
  line with **Reset to defaults** (writes the shipped defaults).

### Settings page

- Route `/wheelchair/app/settings` (`APP_PAGES`, `viewer/server.js:1830`), files
  `viewer/pages/settings.html|js|css`, and a fourth nav link "Settings" (`viewer/pages/nav.js:38-42`).
- Desktop: the design's left section list with the three sections only; phone width: the
  list becomes a row of tabs above the section, no horizontal page scroll. The section is in
  the URL hash so a reload keeps it.
- Models and preferences: the tier table (rows Claude "Claude Code" and GPT "Codex"; columns
  Light, Standard, Heavy, Critical with the design's one-line descriptions); each cell a
  picker of the provider's models plus "Not used", and for Claude an effort picker (default
  "CLI default"). Claude's list: `claude-haiku-5-5`, `claude-sonnet-5-5`, `claude-opus-5-5`,
  `claude-fable-5-2`. GPT's list: models visible in the Codex models cache plus the current
  values. The current value always appears in the list even when unknown. Then "Leads and
  sub-leads run on": one picker per provider (same lists, no Not used). Then Permission
  mode. Then Other agents: Plan reviewers, Checker, Code mapping, each a tier picker, with
  the design's explanatory lines (reviewers and checker keep the cross-family rule from
  `lead.md`, so the lines say "two providers when both are installed" and "not the provider
  that built it"). Each change saves at once and shows "Saved, applies to new sessions".
- Behavior templates and Writing style as in their designs, with explicit Save.

### Settings API (browser routes, `viewer/app/routes.js`, documented in `viewer/app/API.md`)

| Route | Request | Response |
|---|---|---|
| `GET /settings` | — | `{models, model_options, heads_up, permission_mode, other_agents, templates, in_use, style, projects}` |
| `PUT /settings/models` | `{provider, slot, model\|null, effort?}` | the new `models` |
| `POST /settings/models/heads-up` | `{action:"switch"\|"skip"\|"reset", tier?, model?}` | `{models, heads_up}` |
| `PUT /settings/preferences` | `{permission_mode?, other_agents?}` | the saved values |
| `POST /settings/templates` | template without `id` | the template with `id` |
| `PUT /settings/templates/:id` | template fields, `in_use?` | the template |
| `DELETE /settings/templates/:id` | — | `{ok:true}` |
| `PUT /settings/style` | style | `{style, style_version}` |
| `POST /settings/style/preview` | style | `{before, after}` |
| `GET /settings/prompt?role=&project=` | — | `{text}`, the composed starting instructions |

Invalid input is 400 with the reason; unknown template 404. Writes follow the existing
browser-route rules (remember cookie, origin check).

### Edge cases

- Models file missing: shipped defaults; the first write creates it.
- A legacy pins file is rewritten in the new form on the first Settings write, keeping its
  GPT values and skips.
- Deleting a template that is in use: allowed; the role falls back to the `all` template or
  none. Running sessions are unaffected.
- A project removed from `projects.json`: its templates stay, shown as "project no longer
  listed".
- A lead with a queued message when the style changes gets the trailer on that message.
- Codex leads get the same role_prompt through their first `[wc:role]` message
  (`service.js:284-286`) and the same trailer.

### Validation

```bash
bash codex/test/run.sh                # new file format, legacy read, aliases, none, effort, check --json, show --json
bash machine/test/run.sh              # permission_mode argv and bypass readiness, effort, role_prompt, /v1/preview
bash install/test/run.sh              # renamed tier names in installer assertions
node --test viewer/test/*.test.js     # resolveModel per role, none refusal, critical startable, settings routes, templates in use, role_prompt composition and cap, style trailer once, chat strips trailer
npm --prefix viewer run test:browser  # Settings page: three sections, table edit saves, phone width tabs, template save, preview button states
grep -rnE '\b(luna|terra|astra)\b|\bSol\b' protocol viewer/app codex machine --include=*.md --include=*.js --include=*.sh | grep -v 'gpt-'   # only alias tables and tests remain
```

### Handed to the "Accounts, usage and balancing" thread

Its stub summary predates decisions 8 and 9. Besides accounts, usage and balancing, that
thread also owns, from `SettingsModels`: worker provider order, Save Claude for leads, the
Claude margin, rules by kind of work (UI and front end, critical marking and its
cross-check, suggested rules), and the providers beyond Claude and GPT as rows of the
table built here.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-15

**Lanes:** Codex / Heavy (gpt-6.1-sol), mechanics; Claude / CLI default, intent; cross-family: yes.

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
