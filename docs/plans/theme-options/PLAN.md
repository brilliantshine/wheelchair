---
slug: theme-options
status: ready-for-review
created: 2026-11-28
---

# Custom accent color and theme options

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

None.

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
| 6 | Ship curated full-palette theme presets (Wheelchair Default plus Midnight, Forest, Amber, Rose, and Slate) that each define both light and dark surface/border/text palettes and a default accent, while allowing the user to override the accent to any custom hex color (and reset to preset or default). | Lets the user change the whole mood of the app in both light and dark modes while keeping full freedom over the accent color. | user |
| 7 | Overlap with 72ca062b2848: isolate Theme storage, routes, and Settings → You UI in dedicated modules (`viewer/app/theme.js`, `viewer/pages/theme.js`, `viewer/pages/theme-editor.js`) rather than modifying shared Settings polling; thread 72ca062b2848 was building Settings auto-refresh (in-memory revision endpoint and per-block polling in `viewer/pages/settings.js`, with no `settings.json` schema changes) at the time (overlap card 6ba3f145-8654-4340-8c7c-3268b8559d43) | Keeps Theme cleanly decoupled from Settings auto-refresh, matching how Background is structured. | user |
| 8 | Approved the three v1 mockups: `docs/plans/theme-options/graphs/mockup-theme-settings-desktop.html` (1280×900), `docs/plans/theme-options/graphs/mockup-theme-settings-phone.html` (390×844), and `docs/plans/theme-options/graphs/mockup-theme-thread-light.html` (1280×900). | Settings controls fit cleanly above Background on desktop and phone, and the light-mode Thread view shows clear contrast with a non-blue accent. | user |
| 9 | Default persisted theme for existing and fresh installs is `{ mode: "dark", preset: "default", accent: null, revision: 0 }`. | Preserves Wheelchair's exact current dark slate + `#5b9dd9` blue look on upgrade with zero visual regression until the user changes it. | defaulted |

## Spec

### Mockups

| Path | Screen / state | Size |
|---|---|---|
| `docs/plans/theme-options/graphs/mockup-theme-settings-desktop.html` | Settings → You with Theme controls above Background (dark mode, desktop) | 1280×900 |
| `docs/plans/theme-options/graphs/mockup-theme-settings-phone.html` | Settings → You with Theme controls stacked (dark mode, phone) | 390×844 |
| `docs/plans/theme-options/graphs/mockup-theme-thread-light.html` | Thread page in Light mode with emerald custom accent (desktop) | 1280×900 |

### 1. Data model and hub API (`viewer/app/theme.js`, `viewer/app/settings.js`, `viewer/app/routes.js`, `viewer/app/API.md`)

1. **Settings schema (`settings.json`):**
   - Add top-level `theme` object to `DEFAULTS` in `viewer/app/settings.js`:
     ```json
     { "mode": "dark", "preset": "default", "accent": null, "revision": 0 }
     ```
   - `mode`: `"system" | "light" | "dark"`.
   - `preset`: `"default" | "midnight" | "forest" | "amber" | "rose" | "slate"`.
   - `accent`: `null` (use preset's default accent) or a lowercase 6-digit hex string matching `/^#[0-9a-f]{6}$/`.
   - `revision`: non-negative safe integer (`Number.isSafeInteger(v) && v >= 0`).
   - `viewer/app/theme.js` exports `DEFAULT`, `MODES`, `PRESETS`, `normalizeTheme(raw)`, and `handle(hub, request, response, url, bits, send)`.
   - `normalizeTheme(raw)` validates every field strictly; if `raw` is missing, malformed, or any field is out of range, it returns `{ ...DEFAULT }`. Uppercase hex in `accent` is normalized to lowercase only on API input; stored/normalized `accent` is always lowercase `#rrggbb` or `null`.
   - `viewer/app/settings.js`'s `normalize()` calls `theme.normalizeTheme(raw?.theme)` so every `settings.update()` preserves `settings.theme` instead of dropping it.

2. **HTTP routes (`viewer/app/routes.js`):**
   - Dispatch `bits[0] === 'settings' && bits[1] === 'theme'` to `require('./theme.js').handle(hub, request, response, url, bits, send)` (matching `background.js` at `viewer/app/routes.js:49`).
   - Inherits the hub's remember-cookie auth and same-origin write checks from `viewer/server.js`.
   - **`GET /wheelchair/api/settings/theme`** (`bits.length === 2`): returns `200` with `{ mode, preset, accent, revision }` and `Cache-Control: no-store`.
   - **`PUT /wheelchair/api/settings/theme`** (`bits.length === 2`):
     - Body limit: 4 KiB (reject larger with `413`). Requires valid JSON object `{ mode, preset, accent, revision }`.
     - Validates `mode` in `MODES`, `preset` in `PRESETS`, `accent` is `null` or `/^#[0-9a-fA-F]{6}$/` (normalized to lowercase), and `revision` is a non-negative safe integer. Invalid input returns `400` with a plain-language `{ error }`.
     - Runs inside `hub.state.queued(hub.state.settingsPath, ...)` (same settings file queue as `background.js`):
       - Reads and normalizes current `settings.json`.
       - If `body.revision !== current.revision`: returns `409` with `{ error: "Theme changed elsewhere", ...current }`.
       - If `mode`, `preset`, and `accent` all equal `current`: returns `200` with `current` without bumping `revision` or rewriting `settings.json`.
       - If `current.revision === Number.MAX_SAFE_INTEGER`: returns `400` (`Revision limit reached`).
       - Otherwise writes updated `settings.theme` with `revision: current.revision + 1` via `atomicWrite(hub.state.settingsPath, ...)` and returns `200` with the new `{ mode, preset, accent, revision }`.
   - Other methods or subpaths under `/settings/theme` return `404` / `405` via `appError`.
   - Document `GET /settings/theme` and `PUT /settings/theme` in `viewer/app/API.md`.

### 2. Shared palette & contrast derivation (`viewer/pages/theme-palette.js`)

- Pure, zero-dependency dual-environment module (CommonJS `module.exports` for Node tests and `window.wcThemePalette` in the browser, matching `viewer/pages/background-format.js`).
- **6 curated presets**, each with `id`, `label`, `swatches: [c1, c2, c3]` (matching the desktop mockup), `defaultAccent`, `dark` surface/border/text/status tokens, and `light` surface/border/text/status tokens:
  1. `default` (**Wheelchair Default**): `dark` matches `viewer/pages/app.css:12-22` verbatim (`--bg: #14161a`, `--panel: #1c1f25`, `--panel-2: #23262d`, `--panel-3: #181a1e`, `--band: #161a20`, `--line: #2a2f38`, `--line-2: #3a3f48`, `--ink: #e6e8ec`, `--ink-2: #c5cad3`, `--dim: #8b929e`, `defaultAccent: '#5b9dd9'`); `light` is clean neutral slate (`--bg: #f6f7f9`, `--panel: #ffffff`, `--panel-2: #edf0f4`, `--panel-3: #f2f4f7`, `--band: #eef1f5`, `--line: #d8dee6`, `--line-2: #bfc8d4`, `--ink: #161b22`, `--ink-2: #3d4754`, `--dim: #5e6a78`).
  2. `midnight` (**Midnight**): deep indigo dark surfaces (`#101522` / `#171e2f`), cool indigo-tinted light surfaces (`#f5f7fc` / `#ffffff`), `defaultAccent: '#8294e8'`.
  3. `forest` (**Forest**): deep pine dark surfaces (`#111c17` / `#17261f`), crisp sage-tinted light surfaces matching `mockup-theme-thread-light.html` (`--bg: #f7f8f7`, `--panel: #ffffff`, `--panel-2: #edf1ee`, `--line: #dce3de`, `--line-2: #c7d2ca`, `--ink: #18231c`, `--ink-2: #44534a`, `--dim: #65756a`), `defaultAccent: '#10b981'`.
  4. `amber` (**Amber**): warm charcoal dark surfaces (`#1b1712` / `#252019`), warm sand light surfaces (`#faf7f2` / `#ffffff`), `defaultAccent: '#e5a63a'`.
  5. `rose` (**Rose**): deep plum-charcoal dark surfaces (`#1b1418` / `#261c21`), soft blush-white light surfaces (`#fbf6f7` / `#ffffff`), `defaultAccent: '#e06c75'`.
  6. `slate` (**Slate**): cool neutral graphite dark surfaces (`#16191d` / `#1f242a`), cool stone light surfaces (`#f5f6f8` / `#ffffff`), `defaultAccent: '#94a3b8'`.
- Every preset's `light` and `dark` token sets also define light-appropriate and dark-appropriate semantic status tokens (`--good`, `--good-ink`, `--good-bg`, `--good-line`, `--good-soft`, `--good-text`, `--warn`, `--warn-bg`, `--warn-line`, `--warn-tint`, `--bad`, `--bad-text`, `--bad-bg`, `--figure`, `--code-bg`, `--idle`) so status badges, warnings, errors, and code blocks have >= 4.5:1 text contrast in both modes.
- **Quick accent swatches** exported as `QUICK_ACCENTS`: `['#5b9dd9', '#10b981', '#d6a53b', '#e06c75', '#a78bfa', '#94a3b8']`.
- **Accent derivation (`deriveAccent(hex, resolvedMode, surfaces)`):**
  - Special-case exact Wheelchair Default in dark mode (`preset === 'default' && resolvedMode === 'dark' && hex === '#5b9dd9'`): returns the exact original 7 tokens (`#5b9dd9`, `#0e1114`, `#1a2230`, `#3a5778`, `#7fb4e6`, `#a9cdf0`, `#1f2b3a`) and `--human: #23303f` so existing default appearance is pixel-identical.
  - For any other `(hex, resolvedMode, surfaces)`:
    - `--accent`: normalized `#rrggbb` chosen color.
    - `--accent-ink`: `#0e1114` or `#ffffff`, whichever has the higher WCAG 2.1 contrast ratio against `--accent` (guaranteed >= 4.5:1 across all valid RGB colors since `sqrt(21) ≈ 4.58`).
    - `--accent-text`: starts from `--accent` in HSL and steps lightness (lighter in dark mode, darker in light mode) until WCAG 2.1 contrast ratio against both `surfaces['--bg']` and `surfaces['--panel']` is >= 4.5:1 (falling back to `surfaces['--ink']` if needed for extreme inputs).
    - `--accent-hi`: hover/highlight accent derived from `--accent-text` (slightly lighter in dark mode, slightly darker in light mode) while maintaining >= 4.5:1 contrast against `surfaces['--bg']` and `surfaces['--panel']`.
    - `--accent-soft`: RGB mix of `--accent` (14% in dark, 10% in light) over `surfaces['--panel']`.
    - `--accent-line`: RGB mix of `--accent` (42% in dark, 38% in light) over `surfaces['--line']`.
    - `--accent-chip`: RGB mix of `--accent` (20% in dark, 14% in light) over `surfaces['--panel']`.
    - `--human`: RGB mix of `--accent` (18% in dark, 14% in light) over `surfaces['--panel-2']` so user chat bubbles harmonize with any accent color in both light and dark modes while preserving `--ink` contrast >= 4.5:1.
- **`resolveTheme(theme, prefersLight)`**: accepts `{ mode, preset, accent }` (normalizing invalid values to defaults) and boolean `prefersLight`, returns `{ mode, preset, accent, resolvedMode: 'light' | 'dark', effectiveAccent, vars }` where `vars` is a plain object mapping every CSS custom property (`--bg` .. `--human`) to its hex value.
- **`parseHexColor(input)`**: trims whitespace, accepts optional leading `#`, accepts 3-digit (`#abc` → `#aabbcc`) or 6-digit hex, returns lowercase `#rrggbb` or `null`.

### 3. Browser theme controller & pre-paint bootstrap (`viewer/pages/theme.js`)

- Loaded synchronously in `<head>` (after `theme-palette.js`, before page stylesheets paint; no `defer` attribute) on:
  - Every signed-in page under `viewer/pages/*.html`: `threads.html`, `thread.html`, `agents.html`, `settings.html`, `features.html`, `terminal.html`, `doc.html`, `file.html` (verify complete list of `viewer/pages/*.html` during implementation).
  - Standalone `viewer/doc.html` and graph viewer `viewer/index.html`.
  - **Not** loaded on `viewer/signin.html`.
- **Pre-paint application:**
  - Reads `localStorage.getItem('wc-theme-v1')` inside `try/catch`; if valid, immediately resolves with `window.matchMedia('(prefers-color-scheme: light)').matches` and applies all `--*` CSS custom properties onto `document.documentElement.style`, sets `document.documentElement.dataset.themeMode` (`light` | `dark`), `document.documentElement.dataset.themePreset`, and `document.documentElement.style.colorScheme = resolvedMode`.
  - If `localStorage` is empty or invalid, leaves CSS defaults untouched until hub fetch resolves (default dark matches `app.css`).
- **Hub sync & live updates:**
  - On load, fetches `GET /wheelchair/api/settings/theme` (`credentials: 'same-origin'`, `cache: 'no-store'`). On `200`, caches JSON in `localStorage['wc-theme-v1']` and applies unless an active Settings preview token holds ownership.
  - Listens to `window.matchMedia('(prefers-color-scheme: light)')` `change` events: immediately re-applies when active theme (saved or previewed) has `mode === 'system'`.
  - Listens to `window` `storage` events for key `wc-theme-v1`: immediately applies cross-tab updates in the same browser unless previewing.
  - Refreshes from hub every 10 seconds while `document.visibilityState === 'visible'` (using `window.wcPoller` when available or a visibility-gated timer on pages without `nav.js` like `viewer/index.html` and `viewer/doc.html`), plus on `focus` and `pageshow` (matching `background.js`).
  - Dispatches a custom event `wc-theme-change` on `window` whenever applied CSS variables change so JS consumers (graph viewer SVG/canvas, `agents.js` activity colors) can re-read computed values if needed.
- **Public API (`window.wcTheme`):**
  - `current()` → `{ metadata, ready, error }`
  - `subscribe(fn)` → returns unsubscribe function
  - `acquire()` → returns exclusive preview token (mirrors `window.wcBackground.acquire()`)
  - `preview(token, draft)` → applies `{ mode, preset, accent }` live on the current page without touching `localStorage` or hub (ignored if token is not current owner)
  - `release(token)` → releases preview ownership and restores the last saved hub theme
  - `refresh()` → fetches `GET /wheelchair/api/settings/theme`
  - `applySaved(metadata)` → updates cached hub metadata, writes `localStorage['wc-theme-v1']`, applies if not previewing, notifies subscribers.

### 4. Settings → You Theme editor (`viewer/pages/theme-editor.js`, `viewer/pages/settings.js`, `viewer/pages/settings.css`)

- Isolated in `viewer/pages/theme-editor.js` (loaded by `viewer/pages/settings.html` via `<script defer>`) exposing `window.wcThemeEditor`.
- `viewer/pages/settings.js` makes only minimal wiring changes in the `You` section: adds a `theme` block right above `background` that mounts `window.wcThemeEditor.render(...)` and calls `window.wcThemeEditor.discard()` when leaving the `You` section (matching `discardBackground()`). Does not alter Settings polling or other blocks.
- **Controls (matching `mockup-theme-settings-desktop.html` and `mockup-theme-settings-phone.html`):**
  1. **Color mode:** 3-button segmented control (`System`, `Light`, `Dark`) with `aria-pressed`.
  2. **Theme preset:** 6-card grid (`Wheelchair Default`, `Midnight`, `Forest`, `Amber`, `Rose`, `Slate`), each showing its 3-color swatch bar, name, and active checkmark (`aria-pressed`). Clicking a preset sets `draft.preset = id` and clears any custom accent override (`draft.accent = null`) so the preset's signature accent takes effect immediately in preview.
  3. **Accent color:**
     - Native `<input type="color">` synced to the effective accent (preset's default accent when `draft.accent === null`, or `draft.accent`). Picking a color sets `draft.accent` to that lowercase hex.
     - Hex `<input type="text">` (`aria-label="Accent hex color"`) displaying the effective hex; typing a valid 3- or 6-digit hex updates preview live; invalid text shows an inline validation hint and disables Save until corrected or reset.
     - 6 quick accent swatch buttons (`#5b9dd9`, `#10b981`, `#d6a53b`, `#e06c75`, `#a78bfa`, `#94a3b8`) that set `draft.accent` to that color.
     - **Reset to preset** button: sets `draft.accent = null` (disabled when `draft.accent === null`).
     - **Reset to default** button: sets `draft` to `{ mode: 'dark', preset: 'default', accent: null }` (disabled when already at default).
  4. **Save / Cancel actions:**
     - **Cancel** (or **Reset**): discards unsaved edits, releases preview token, restores last saved hub theme (disabled when clean).
     - **Save theme**: sends `PUT /wheelchair/api/settings/theme` with `{ mode, preset, accent, revision }`.
       - On `200`: calls `wcTheme.applySaved(saved)`, releases preview token, clears dirty state, shows brief saved status ("Saved").
       - On `409`: shows inline conflict message ("Theme changed elsewhere. Cancel to load the latest settings.") and updates stored metadata via `wcTheme.applySaved(latest)` while keeping the user's draft visible until they click Cancel (matching `background` conflict handling).
       - On network/4xx/5xx error: shows inline error message and keeps draft editable.
- Responsive layout in `viewer/pages/settings.css`: 3-column preset grid on desktop, 2-column preset grid on narrow/phone viewports (`<= 640px`), no horizontal overflow at 390px width.

### 5. Surface tokenization & special views

1. **Main app stylesheets (`viewer/pages/app.css`, `assistant-popup.css`, `thread.css`, `views.css`, `settings.css`, `doc.css`, `file.css`, `background.css`):**
   - `viewer/pages/app.css`: set `color-scheme: dark` as default and `html[data-theme-mode="light"] { color-scheme: light; }`; ensure `#app-nav .logo` uses `color: var(--accent-ink)` instead of `color: var(--bg)` so the logo icon stays legible against any accent color in both light and dark modes.
   - `viewer/pages/assistant-popup.css:40`: replace hardcoded `#23303f` with `var(--human)`.
   - Audit `viewer/pages/*.css` for any remaining hardcoded blue hex/rgba literals or dark-only text/surface literals that break in light mode (such as hardcoded `#fff`/`#000` where `--ink`/`--panel` is intended, or blue `rgba(91, 157, 217, ...)` replaced with `var(--accent-soft)` / `color-mix(in srgb, var(--accent) ..., transparent)`).
   - `viewer/pages/background.css`: verify opaque content surfaces remain opaque using `var(--bg)` / `var(--panel)` in light mode when a background image is active.
2. **Graph viewer (`viewer/index.html`) and PNG export (`viewer/pages/picture-export.js`):**
   - Load `theme-palette.js` and `theme.js` in `viewer/index.html` `<head>`.
   - Map `viewer/index.html`'s `:root` colors to the shared palette variables (keeping its current dark values as fallback defaults when no theme is set) and replace hardcoded `rgba(91, 157, 217, .12)` (`viewer/index.html:219`) with `color-mix(in srgb, var(--accent) 14%, transparent)` (with `--accent-soft` fallback).
   - Ensure SVG nodes, edges, selection highlights, and `viewer/pages/picture-export.js` canvas background/stroke/text colors read computed styles from `document.documentElement` so exported PNGs reflect the active theme.
3. **Standalone doc page (`viewer/doc.html`):**
   - Load `theme-palette.js` and `theme.js` in `<head>` and align its `:root` palette variables with the shared theme tokens (preserving dark defaults as fallback).
4. **Embedded terminal (`viewer/pages/term-view.js`, `viewer/pages/terminal.css`, `viewer/pages/app.css`):**
   - Terminal stays dark in all color modes (Decision #4): `.term-wrap` / terminal mount explicitly keeps `background: #0c0e10; color: #e6e8ec; color-scheme: dark;` and xterm's constructor passes an explicit dark `theme: { background: '#0c0e10', foreground: '#e6e8ec', cursor: '#e6e8ec' }` (while preserving the existing warning-color cursor while typing).
5. **Agents activity colors (`viewer/pages/agents.js`):**
   - Read accent/status colors from computed CSS variables (with existing hex fallbacks) where accent-colored indicators appear, and refresh on `wc-theme-change`.
6. **Router & test map upkeep (`CONTRIBUTING.md`):**
   - Update `viewer/AGENTS.md` file table to include `app/theme.js`, `pages/theme-palette.js`, `pages/theme.js`, and `pages/theme-editor.js`.
   - Update `test-support/test-map.json` if any new test files are not already matched by existing globs.
   - Add the new browser theme rendering spec to `viewer/test/firefox-specs.js` (per `CONTRIBUTING.md`: specs testing pixels/drawing/rendering run in both Chromium and Firefox).

### 6. Non-goals (from IDEA.md)

- Typography, font-size, layout density, or corner-radius controls.
- Per-project or per-thread theme overrides.
- Custom raw CSS editing or user-uploaded stylesheet files.
- Theming `viewer/signin.html` or switching xterm.js to a light terminal palette.

### 7. Validation commands

Targeted tests (run by workers and verifiers; full suite runs before push via `test-support/full-run.sh`):

1. **Theme unit & API tests (`viewer/test/theme.test.js`):**
   - Covers `theme-palette.js` contrast ratios (>= 4.5:1 for `--accent-ink` on `--accent`, `--accent-text` and `--accent-hi` on `--bg` and `--panel`, `--human` + `--ink`) across all 6 presets, both `light` and `dark` modes, and edge hex colors (`#000000`, `#ffffff`, `#ffff00`, `#ff0000`, `#00ff00`, `#5b9dd9`); verifies exact pixel-identical default dark tokens.
   - Covers `GET /wheelchair/api/settings/theme` and `PUT /wheelchair/api/settings/theme` (defaults, normalization of corrupt `settings.json`, valid save + revision increment, idempotent no-op save, 400 invalid input, 409 revision conflict with current state, 413 oversized payload, preservation across unrelated `settings.update()` calls).
   - Command: `node --test viewer/test/theme.test.js`
2. **Existing settings & background regression tests:**
   - Command: `node --test viewer/test/background.test.js viewer/test/settings.test.js`
3. **Browser Settings editor & sync spec (`viewer/test/theme-editor.spec.js`):**
   - Isolated server via `viewer/test/helpers/server.js`.
   - Tests Settings → You Theme controls: live preview of mode/preset/custom hex/quick swatch without saving, Cancel reverting preview, Save persisting across reload, Reset to preset & Reset to default, invalid hex validation disabling Save, 409 conflict handling, phone viewport (390×844) with zero horizontal overflow.
   - Command: `npx --prefix viewer playwright test test/theme-editor.spec.js`
4. **Browser rendering & cross-page spec (`viewer/test/theme-rendering.spec.js`, listed in `viewer/test/firefox-specs.js`):**
   - Tests that saved light mode + custom accent color applies to Thread, Threads, Agents, Graph (`viewer/index.html`), and Standalone Doc (`viewer/doc.html`), while Terminal (`xterm`) stays dark (`#0c0e10`), Sign-in stays default dark, pre-paint bootstrap avoids dark flash on reload in light mode, and light mode + background image keeps cards opaque.
   - Command: `npx --prefix viewer playwright test test/theme-rendering.spec.js`

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

### Round 1 — 2026-11-28

**Lanes:** pending.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
