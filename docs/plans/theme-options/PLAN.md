---
slug: theme-options
status: planning
created: 2026-11-28
---

# Custom accent color and theme options

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

### Q1: Which pages and surfaces should follow your theme?
- **Context:** Main app pages share `viewer/pages/app.css`. The graph viewer (`viewer/index.html`), standalone doc page (`viewer/doc.html`), embedded terminal (`xterm.js` in `viewer/pages/term-view.js`), and sign-in page (`viewer/signin.html`) currently use their own palettes or defaults.
- **Options:**
  - `all-app`: All signed-in pages, graph viewer, standalone doc, and terminal (sign-in stays default).
  - `app-and-graph`: All signed-in pages, standalone doc, and graph viewer, while keeping the terminal dark so CLI ANSI colors stay readable.
  - `app-only`: Main app shell pages only, leaving the graph viewer and terminal unchanged.
- **Recommendation:** `app-and-graph` — keeps everything in Wheelchair cohesive without making terminal ANSI colors unreadable in light mode.

### Q2: Should theme settings sync across devices or stay per browser?
- **Context:** Background settings are stored in hub `settings.json` and synced across devices, whereas browser-local storage lets each device keep its own theme.
- **Options:**
  - `sync-hub`: Sync across all devices via hub `settings.json`, plus a local browser cache for instant pre-paint loading.
  - `per-device`: Store per browser/device locally.
  - `hybrid`: Sync preset and accent color on the hub, keep light/dark/system mode per device.
- **Recommendation:** `sync-hub` — matches Background, and `system` color mode already lets each device follow its own OS light/dark schedule.

### Q3: What kind of ready-made presets should ship?
- **Context:** Collin wants ready-made color theme presets alongside picking any custom accent color.
- **Options:**
  - `curated-palettes`: 6–8 curated full-palette presets (Wheelchair Default + distinct palettes) that each work in both light and dark modes, with optional custom accent override.
  - `accent-swatches`: One light and one dark base palette, with one-click accent presets plus custom color picker.
  - `distinct-themes`: Editor-style named themes where each theme sets its own fixed surface + accent palette.
- **Recommendation:** `curated-palettes` — gives cohesive looks in both light and dark modes while still allowing any custom accent color.

### Overlap with 72ca062b2848 (Auto-refresh an open Settings page when settings change): both threads touch Settings (`viewer/pages/settings.js`) and unsaved-draft / save handling in the You section.
- **Context:** Thread `72ca062b2848` is working on auto-refreshing an open Settings page without clobbering unsaved drafts or focused controls. Messaged its lead to learn what it is changing in Settings.

### Q4: Agree the mockups
- **Context:** Designer is creating mockups for Settings → You (desktop and phone) and a themed Light-mode Thread page with a custom accent color.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Automatically derive the 7-token accent family (`--accent`, `--accent-ink`, `--accent-soft`, `--accent-line`, `--accent-text`, `--accent-hi`, `--accent-chip`) from one chosen base hex color and active color mode, enforcing readable WCAG AA text contrast and replacing hardcoded blue literals (`assistant-popup.css`, etc.). | Users should pick one accent color, not 7 CSS tokens; automatic contrast derivation keeps buttons, links, and chips legible in both light and dark modes. | defaulted |
| 2 | Place Theme controls in Settings → You alongside Background, using a browser-cached pre-paint bootstrap so signed-in pages do not flash the wrong color mode on load. | Matches the existing Appearance/You home in Settings and prevents light/dark FOUC on page load. | defaulted |
| 3 | Leave `signin.html` on the default theme. | Unauthenticated browsers cannot fetch user settings, and sign-in is a one-time gate. | defaulted |

## Spec

To be filled as Open Questions are settled.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
