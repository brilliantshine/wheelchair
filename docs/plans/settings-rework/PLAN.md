---
slug: settings-rework
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-24
---

# Rework the Settings page

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here.

Map: `MAP.md`.

## Open Questions

### Q2: Agree the mockups
- **Context:** A designer mocks the agreed categories on phone and desktop once Q1 is settled.

### Q3: Usage readings and sign-in shown twice (Accounts and Usage; Accounts and Harnesses): keep both or show once?
- **Context:** MAP.md Grouping observations.

### Q4: Old links to sections (`#models`, `#usage`, ... and text saying "Settings → Models")
- **Context:** MAP.md Literal section-reference index. Must still land somewhere sensible; the global instructions' diagram dial text names "Models, Diagrams".

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode two-part | Collin's pick on the mode card | user |
| 2 | Eight categories: You; AI providers; Usage and balancing; Models; Assistant and project leads; Threads; Agent behavior; Project tools (graphs/categories.json) | Collin plans to add customization for the assistant and project leads; one shared home keeps Threads focused | user |

## Spec

### S1. Categories

The Settings page has eight categories, in this order, each holding exactly these existing controls (MAP.md Inventory names them). No control changes what it does or where it is stored.

1. **You**: your name, Writing style (whole current section), Diagrams, Enter-to-send, Background (whole current section).
2. **AI providers**: Harnesses and Accounts (both whole current sections).
3. **Usage and balancing**: Usage (whole current section, including Balancing) plus the lead provider order moved from Models.
4. **Models**: Tiers, lead and sub-lead models, Other agents, Escalation.
5. **Assistant and project leads**: the personal assistant switch and the project leads switch. Future customization for both goes here.
6. **Threads**: tool steps, auto-merge and branch deletion, default project folder, Permission mode, lead names.
7. **Agent behavior**: Behavior templates and Lessons learned (whole current section).
8. **Project tools**: unchanged.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
