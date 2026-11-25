---
slug: settings-rework
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-24
---

# Rework the Settings page

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here.

Map: `MAP.md`.

## Open Questions

(none)

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode two-part | Collin's pick on the mode card | user |
| 2 | Eight categories: You; AI providers; Usage and balancing; Models; Assistant and project leads; Threads; Agent behavior; Project tools (graphs/categories.json) | Collin plans to add customization for the assistant and project leads; one shared home keeps Threads focused | user |
| 3 | Show each repeated thing once: sign-in only on account cards (Harnesses links to them); detailed usage only in Usage, account cards keep a one-line reading | The repetition is a main source of clutter; each thing stays one tap away | user |
| 4 | New section keys `you`, `providers`, `usage`, `models`, `leads`, `threads`, `behavior`, `tools`; old keys keep working as aliases (`harnesses`, `accounts` → providers; `writing`, `background` → you; `templates` and `templates/lessons/<role>` → behavior); in-repo links and texts that name old sections are updated | Lesson cards and onboarding already link to old keys; aliases cost a lookup table | defaulted |
| 5 | Mockups agreed: graphs/mockup-phone-navigation.html, mockup-phone-you.html, mockup-phone-assistant.html, mockup-desktop-threads.html (versions at commit 9abeca2f) | Collin pressed "Looks good" | user |

## Spec

### S1. Categories

The Settings page has eight categories, in this order, each holding exactly these existing controls (MAP.md Inventory names them). No control changes what it does or where it is stored.

1. **You**: your name, Writing style (whole current section), Diagrams, Enter-to-send, Background (whole current section).
2. **AI providers**: Harnesses and Accounts (both whole current sections).
3. **Usage and balancing**: Usage (whole current section, including Balancing) plus the lead provider order moved from Models. The lead order goes inside the Balancing box next to the worker order and is saved by Balancing's one Save; its own separate Save goes away. (Both already share one draft, `viewer/pages/settings.js:1663-1671`; one Save means one save never clears the other group's unsaved edits.)
4. **Models**: Tiers, lead and sub-lead models, Other agents, Escalation.
5. **Assistant and project leads**: the personal assistant switch and the project leads switch. Future customization for both goes here.
6. **Threads**: tool steps, auto-merge and branch deletion, default project folder, Permission mode, lead names.
7. **Agent behavior**: Behavior templates and Lessons learned (whole current section).
8. **Project tools**: unchanged.

### S2. Each repeated thing shown once

- Sign-in for a provider happens only on its account cards in AI providers. A Harnesses row that needs sign-in links to that provider's account cards instead of signing in itself; the link carries the machine selected in Harnesses, and the account card's sign-in opens for that machine. When that sign-in succeeds, the Harnesses rows refresh their status (today only usage refreshes, `viewer/pages/settings.js:1401-1408`).
- Detailed usage (5-hour and weekly bars, per-account tables) appears only in Usage and balancing. Each account card keeps a one-line reading of its current usage.

### S3. Section addresses and references

- Keys: `you`, `providers`, `usage`, `models`, `leads`, `threads`, `behavior`, `tools`. An unknown key opens `you`.
- Old keys open the category now holding them: `harnesses`, `accounts` → `providers`; `writing`, `background` → `you`; `templates` → `behavior`; `templates/lessons/<role>` opens that role's lesson editor as today.
- Settings opened with no hash (the app nav's Settings link, `viewer/pages/nav.js`) shows `#you` on desktop, and the category list on a phone (S7). Nothing opens `#models` by default any more.
- The New Thread page's hint for a missing default project folder (`viewer/pages/new.html:24`) links to `#threads`.
- Update every live link and user-facing text naming an old section or "Models > Diagrams" in code, tests, `protocol/`, `README.md` and `AGENTS.md` files (MAP.md Literal section-reference index); never edit other plans' or reports' files under `docs/plans/`. Text naming a section by its old name says the new category ("Settings → Harnesses" becomes "Settings → AI providers", e.g. `viewer/pages/thread.js:1636`, `README.md:261`). Includes: onboarding card, lesson card links, Harnesses' internal links, `protocol/sensitivity.md` (its delimited region: Settings page (You, Diagrams), and the later "Models > Diagrams" line becomes "You > Diagrams"), `sensitivity/test/run.sh`'s expected text, and tests.

### S7. Getting around on a phone

At 899px wide or less (the agreed mockups' breakpoint, also the page's first narrow rule, `viewer/pages/settings.css:126`), replacing today's horizontal tab strip:

- Settings with no hash, or `#` alone, shows only the category list (`mockup-phone-navigation.html`): each of the eight categories with its one-line description, tapping one opens it.
- A category (any key, including old keys and `templates/lessons/<role>`) shows only that category, full width, with a "‹ Settings" link at the top that opens the list (clears the hash). The browser's back button behaves the same way, since each is a hash change.
- Above 899px there is no list screen and no back link: the side navigation (`mockup-desktop-threads.html`) is always shown and no hash means `#you`.
- Crossing the breakpoint (rotating, resizing) re-renders with the rule for the new width, keeping the current hash.

### S4. Mockups

The built page matches these agreed files (in `docs/plans/settings-rework/graphs/`):

| File | Screen / state | Size |
|---|---|---|
| mockup-phone-navigation.html | Category list, all eight categories | 390 x 844 |
| mockup-phone-you.html | You open | 390 x 844 |
| mockup-phone-assistant.html | Assistant and project leads open | 390 x 844 |
| mockup-desktop-threads.html | Side navigation with Threads open | 1280 x 800 |

Categories not mocked follow the same pattern: the moved controls keep today's wording and look, under a heading per former group.

### S5. Boundaries and non-goals

- No control changes behaviour, wording (beyond headings that name a moved group), stored value or save route. Server endpoints (`viewer/app/settings.js`, `routes.js`) do not change.
- Section-specific live work moves with its controls: Harnesses install/sign-in polling, Accounts and Usage 30-second refresh, Diagrams read on visit, Models diagram drawing. Each runs while the category holding it is open and stops when it is left, as today per section.
- The saved background's 10-second refresh (`viewer/pages/background.js:68-105`) stays page-wide, running whatever category is open. Only the editor's repaint and preview cleanup are tied to the You visit (today's `section === 'background'` checks become "You is open").
- A repaint from any timer or poll in a category (Harnesses install progress, Accounts/Usage refresh) never replaces the panel while an account edit is open: a rename, plan or weight change, or the add-account form. It waits until the edit closes, as the Accounts refresh guard does today (`viewer/pages/settings.js:1371-1373`).
- Enter-to-send stays in browser storage.
- Not doing: new settings, the personal assistant changing settings, separate phone/computer backgrounds (other threads).

### S6. Validation

Run from the worktree:

```bash
node --test viewer/test/app-settings.test.js viewer/test/app-harnesses.test.js viewer/test/app-usage.test.js viewer/test/app-lessons.test.js viewer/test/background.test.js viewer/test/app-diagram-sensitivity.test.js
npm --prefix viewer run test:browser -- app-new-thread.spec.js app-assistant.spec.js app-project-lead.spec.js app-settings.spec.js app-harnesses.spec.js app-accounts.spec.js app-diagram-sensitivity.spec.js app-lessons.spec.js app-project-tools.spec.js app-hidden-tabs.spec.js background-editor.spec.js background-network.spec.js background-readiness.spec.js background-rendering.spec.js background-settings-surfaces.spec.js
bash sensitivity/test/run.sh
```

New or updated browser checks (in `viewer/test/app-settings.spec.js`) must show: the eight categories in S1 order; each moved control is found in its S1 category; each old key in S3 opens the right category; Harnesses' sign-in link opens the provider's account cards; account cards show one usage line and no usage bars; on a 390px-wide page, no hash shows the category list and "‹ Settings" returns to it; reordering leads and changing a worker balancing value then pressing Save keeps both; a Harnesses progress tick with an account rename open keeps the typed name. `app-assistant.spec.js` and `app-project-lead.spec.js` open `#leads` to find their switches; `app-new-thread.spec.js` expects the hint to link to `#threads`.

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

### Round 1 — 2026-11-24

**Lanes:** intent: claude; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Phone mockup shows a category list with back links; Spec never says so and S3 sent no-hash to `#you` | upheld (major) | Added S7; S3 no-hash rule split by width |
| mechanics | blocking | No address opens the phone category list | upheld (blocking) | Same as the intent major; S7 |
| mechanics | blocking | Background 10-second refresh is page-wide, not tied to the section | upheld (blocking) | S5: refresh stays page-wide; only editor tied to You |
| mechanics | major | Lead and worker order on one screen with two Saves lose each other's edits | upheld (major) | S1: lead order joins Balancing, one Save |
| mechanics | major | Harnesses poll repaint can erase an open account edit | upheld (major) | S5: repaint waits for open edits |
| mechanics | major | Sign-in handoff drops the selected machine; Harnesses not refreshed after | upheld (major) | S2: link carries machine, Harnesses refresh |
| mechanics | minor | New Thread hint should link to `#threads` | upheld (minor) | S3 |
| mechanics | minor | Assistant and project-lead specs missing from S6 | upheld (minor) | S6 |
| mechanics | minor | No step to refresh harness instructions from the canonical clone | declined | `install.sh` / `sensitivity/set.sh` refuse from a worktree (CONTRIBUTING.md); the refresh is Collin's update after merge, not a Spec validation. Goes in the check card's update text |
| intent | minor | S3 "every in-repo link" would rewrite old plans; "Settings → Harnesses" texts unaddressed | upheld (minor) | S3 limited to live files; old-name texts renamed |

### Round 2 — 2026-11-24

**Lanes:** intent: claude; mechanics: not claude; cross-family: yes.

**Changed since Round 1:**
- S7 added: phone category list, "‹ Settings" back link, breakpoint 899px; S3 no-hash rule split by width.
- S3: renaming limited to live files; old-name texts renamed; New Thread hint links to `#threads`.
- S1: lead provider order inside Balancing with one Save.
- S2: Harnesses sign-in link carries the machine; Harnesses refresh after sign-in.
- S5: background refresh stays page-wide; repaints wait for open edits.
- S6: more specs and checks.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | S7 breakpoint 640px differs from the agreed mockups' 899px | upheld (minor) | S7 now 899px |
| intent | minor | "a text field with focus" freezes Harnesses progress needlessly | upheld (minor) | S5 limited to account edits |

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
