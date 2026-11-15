---
slug: app-settings
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-15
---

# A Settings page for how agents run and behave

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

Map: `MAP.md` (sessions, thread page, serving), with detail in `docs/maps/app-sessions.md`.
Source proposal: `docs/proposals/app-settings/proposal.md`.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

### Q1: When does a running lead follow a changed writing style?
- **Context:** The design says "Leads pick it up on their next message"; IDEA's Not doing
  says running agents don't change. The hub can prefix the style to messages it delivers
  to the lead, or only set it at start.
- **Recommendation:** to discuss.

### Q2: The before-and-after preview
- **Context:** The design says "Rewritten live as you change the settings above." That
  means a model call per change.
- **Options:** (a) a real rewrite by a cheap model on demand (button) of a fixed sample;
  (b) live on every change; (c) fixed examples per setting, no model.
- **Recommendation:** (a).

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| W1 | The running app refuses the `title` card kind, the `doc` field on question cards, and `resolve` on question cards, all of which `protocol/app/cards.md` allows | Not this feature; a follow-up for the app | yes (in chat) | |
| W3 | What Claude's pane shows in bypass mode, and whether it asks for a one-time confirmation in an interactive session | The implementer must check against the installed CLI and handle both in the ready test | no | settled into the Spec as a requirement |
| W2 | The heads-up from `/v1/preflight` is discarded by the hub (`viewer/app/ready.js:17-24`) | Needed for the switch/skip on the page | no | |

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

## Spec

The settled design, grown as decisions land.

### Tier names

- Four tiers, everywhere: **Light** (was Luna), **Standard** (Terra), **Heavy** (Sol),
  **Critical** (Astra). Every file that names a tier uses the new name: `viewer/app/sessions.js`,
  `viewer/app/API.md`, `codex/model.sh`, `protocol/lanes.md`, `protocol/app/sub-lead.md`,
  `protocol/app/lead.md`, `protocol/implementation.md`, `protocol/verification.md`,
  `protocol/plan-review.md`, `protocol/templates/COMPLETION.md`, and the codex, installer and
  hub test suites (full list: `docs/maps/app-sessions.md`, "Every place the tier names …").
- Old names are accepted on input wherever a tier is read (`wc.js session start --tier`,
  `model.sh <tier>`, pins file keys) and mean the new tier. Output always uses the new name.
  Old plan documents under `docs/plans/` are history and are not edited.
- GPT model names (`gpt-6-luna` …) are model names, not tier names, and are unchanged.
- `top` stays as an accepted tier value meaning Heavy, for compatibility.

### Where model choices live

- One file, the hub machine's `~/.wheelchair/models` (`WHEELCHAIR_MODELS` overrides, as
  today). It holds, per provider (Claude, GPT) and tier, a model or "not used", plus the
  lead's model. `codex/model.sh`'s parser and writer are extended to it; the hub reads and
  writes it through the same code path, never a second parser.
- An existing pins file in the old format reads unchanged (old tier keys are aliases; GPT
  rows only).

### Permission mode

- One setting, Claude only: **Auto** (default, today's behavior) or **Bypass**. Shown on
  Models and preferences, under the lead's model, with one line saying Codex already never
  asks and is limited to its worktree.
- Stored in the hub's settings, not the models file. Applies to sessions started after
  saving; running sessions keep the mode they started with.
- The hub sends the chosen mode to the machine service on start; the service passes it as
  `--permission-mode auto` or `--permission-mode bypassPermissions`
  (`machine/service.js:254`).
- Readiness (`machine/service.js:298`) must recognise the bypass pane as ready, as it does
  "auto mode on" today, or every bypass session goes stuck after 30 s. Any one-time
  confirmation Claude shows when entering bypass must not block the start.

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

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
