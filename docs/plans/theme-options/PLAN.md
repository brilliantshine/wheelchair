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

### Overlap with 72ca062b2848 (Auto-refresh an open Settings page when settings change): both threads touch Settings (`viewer/pages/settings.js`), `viewer/app/settings.js`, and `viewer/app/routes.js`.
- **Context:** Thread `72ca062b2848` (`settings-live-refresh`) is planning auto-refresh for an open Settings page: polling, block dirty/focus guards, and save-ordering in `viewer/pages/settings.js`, plus a lightweight settings revision endpoint in `viewer/app/routes.js` / `viewer/app/settings.js`. Our thread adds Theme controls in Settings → You (`viewer/pages/settings.js`) and theme persistence/routes in `viewer/app/settings.js` / `viewer/app/routes.js` (if hub-synced).

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
| 4 | Apply theme (color mode, preset, custom accent color) to all signed-in app pages, standalone doc (`viewer/doc.html`), and graph viewer (`viewer/index.html` + `picture-export.js`), while keeping the embedded terminal (`xterm.js` in `viewer/pages/term-view.js`) dark. | Keeps all Wheelchair UI and diagrams cohesive without making CLI ANSI colors unreadable in light mode. | user |
| 5 | Store theme settings in hub `settings.json` synced across all devices, backed by a browser-local cache applied before first paint so pages do not flash the wrong theme on load. | Matches Background sync behavior across phone and computer; `system` color mode lets each device follow its own OS light/dark schedule. | user |
| 6 | Ship curated full-palette theme presets (Wheelchair Default plus 5–7 cohesive palettes such as Midnight, Forest, Warm Sand, Rose, and Monochrome) that each define both light and dark surface/border/text palettes and a default accent, while allowing the user to override the accent to any custom hex color (and reset to preset or default). | Lets the user change the whole mood of the app in both light and dark modes while keeping full freedom over the accent color. | user |

## Spec

### 1. Themed surfaces
- All signed-in app pages (`threads`, `thread`, `agents`, `settings`, `features`, `terminal`, `pages/doc`, `pages/file`), the standalone doc page (`viewer/doc.html`), and the graph viewer (`viewer/index.html`, including SVG nodes/edges/selection and PNG export via `viewer/pages/picture-export.js`) follow the active theme (color mode, preset, and custom accent color).
- The embedded terminal (`viewer/pages/term-view.js` / xterm.js) stays dark in all color modes so CLI ANSI colors remain legible.
- The sign-in page (`viewer/signin.html`) stays on the default dark theme.
- Hardcoded blue literals (such as `#23303f` in `viewer/pages/assistant-popup.css` and `rgba(91, 157, 217, .12)` in `viewer/index.html`) are replaced with theme CSS custom properties.

### 2. Accent color derivation
- A single chosen hex accent color (or the active preset's default accent) derives the full 7-token accent family (`--accent`, `--accent-ink`, `--accent-soft`, `--accent-line`, `--accent-text`, `--accent-hi`, `--accent-chip`) for the resolved light or dark mode, maintaining WCAG AA contrast for `--accent-ink` on `--accent` and for `--accent-text`/`--accent-hi` on panel/page surfaces.

### 3. Storage, syncing, and pre-paint bootstrap
- Theme settings are stored in hub `settings.json` under a `theme` object with revision-checked writes (serialized through `viewer/app/state.js`'s settings file queue, matching `background`).
- Signed-in pages apply the last cached theme from `localStorage` via a tiny synchronous pre-paint script before stylesheets paint, then refresh from the hub (and re-sync on focus/pageshow/polling like Background) so changes on one device propagate to other open tabs and devices.

### 4. Presets and color modes
- Color mode supports `system`, `light`, and `dark` (`system` follows `prefers-color-scheme` and reacts to live OS changes).
- Ship 6 curated full-palette presets (`default` Wheelchair Slate/Blue, `midnight` Deep Indigo, `forest` Pine/Emerald, `sand` Warm Sand/Amber, `rose` Plum/Rose, `mono` Neutral Monochrome), each providing tailored light and dark surface/panel/border/ink palettes plus a preset default accent.
- The user may override the preset's accent with any custom hex color (`accent: null` uses the preset's default accent; setting a `#rrggbb` overrides it) and can reset either the accent back to the preset or the whole theme back to Wheelchair Default.

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
