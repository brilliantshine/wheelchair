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

### Q1: How far does the tier rename reach?
- **Context:** The app tiers become Light, Standard, Heavy, Critical. Today the names
  Luna/Terra/Sol/Astra are the tier names in `viewer/app/sessions.js:15-25`, the keys of
  the pins file `~/.wheelchair/models` (`codex/model.sh:15-25`), and appear in seven
  `protocol/` files used by both the app and the terminal workflow (`/plan`, `/implement`),
  plus the codex and installer test suites. The proposal keeps the old names only inside GPT
  model names.
- **Options:** (a) rename everywhere: protocol, `model.sh` (old names accepted as aliases
  so an existing pins file and old plan docs still read), hub, tests; (b) rename in the app
  and the app role files (`protocol/app/`) only, terminal workflow keeps the old names and
  the hub maps between them; (c) labels only: the app screens say Light…Critical, every
  file keeps the old names.
- **Recommendation:** (a). One vocabulary; the aliases keep the terminal workflow working.

### Q2: One source for model choices, or two?
- **Context:** GPT pins live in `~/.wheelchair/models`, read by `codex/model.sh` for the
  terminal workflow. The Settings table needs somewhere to store Claude's cells, "Not used"
  and the lead's model too.
- **Options:** (a) the Settings page writes the one models file (extended to Claude and
  Not used), so the terminal workflow follows the page; (b) the hub keeps its own settings
  file and the terminal workflow keeps the pins file; (c) the hub file wins and the pins
  file is retired.
- **Recommendation:** (a), pending Q1.

### Q3: Which parts of the Models screen land here?
- **Context:** `SettingsModels` also shows worker provider order, "Save Claude for
  leads", the 5% margin, rules by kind of work (UI prefers Claude, critical, suggested
  rules) and "Other agents" (reviewers, checker, mapping, asides). Most of the first group
  depends on accounts and the balancer's forecast, which moved to the stub thread.
- **Options:** (a) tier table, lead's model and "Other agents" (minus asides) here; order,
  save-Claude, margin and rules by kind of work go to the stub; (b) also the rules by kind
  of work here (they only pick a tier and provider, no usage needed); (c) table and lead
  model only.
- **Recommendation:** (a) or (b); to discuss.

### Q4: What does "Critical" do in this thread?
- **Context:** Critical needs a second provider to check it, and parts are marked critical
  on the plan or the Plan approved card. Today the hub refuses `--tier astra`
  (`sessions.js:17`, `27-29`) while `sub-lead.md:119` lists it.
- **Options:** (a) the tier works when the sub-lead asks for it, cross-check by the other
  provider's Critical model as a checker rule; marking on the card waits; (b) also the
  "mark critical" flow on the Plan approved card; (c) only make the tier startable.
- **Recommendation:** (a).

### Q5: The permission mode setting
- **Context:** Sessions run Claude `--permission-mode auto`, Codex `-a never`
  (`machine/service.js:242-262`). Claude's readiness waits for "auto mode on" in the pane
  (`service.js:254`, `298`). Collin wanted to be able to bypass permissions
  (`docs/plans/app-shell/acceptance-followups.md:25`). No design shows it.
- **Options:** which modes to offer (auto / bypass, per CLI), and where on the page.
- **Recommendation:** auto and bypass for Claude, in Models and preferences.

### Q6: When does a running lead follow a changed writing style?
- **Context:** The design says "Leads pick it up on their next message"; IDEA's Not doing
  says running agents don't change. The hub can prefix the style to messages it delivers
  to the lead, or only set it at start.
- **Recommendation:** to discuss.

### Q7: The before-and-after preview
- **Context:** The design says "Rewritten live as you change the settings above." That
  means a model call per change.
- **Options:** (a) a real rewrite by a cheap model on demand (button) of a fixed sample;
  (b) live on every change; (c) fixed examples per setting, no model.
- **Recommendation:** (a).

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| W1 | The running app refuses the `title` card kind, the `doc` field on question cards, and `resolve` on question cards, all of which `protocol/app/cards.md` allows | Not this feature; a follow-up for the app | yes (in chat) | |
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

## Spec

The settled design, grown as decisions land.

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
