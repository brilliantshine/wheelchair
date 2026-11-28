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
| 1 | Automatically derive the accent token family (`--accent`, `--accent-ink`, `--accent-hover`, `--accent-hover-ink`, `--accent-soft`, `--accent-line`, `--accent-text`, `--accent-hi`, `--accent-chip`, `--human`) from one chosen base hex color and active color mode, enforcing readable WCAG AA text contrast and replacing hardcoded blue literals (`assistant-popup.css`, etc.). | Users should pick one accent color, not individual CSS tokens; automatic contrast derivation keeps buttons, links, and chips legible in both light and dark modes. | defaulted |
| 2 | Place Theme controls in Settings → You alongside Background, using a browser-cached pre-paint bootstrap so signed-in pages do not flash the wrong color mode on load. | Matches the existing Appearance/You home in Settings and prevents light/dark FOUC on page load. | defaulted |
| 3 | Leave `signin.html` on the default theme. | Unauthenticated browsers cannot fetch user settings, and sign-in is a one-time gate. | defaulted |
| 4 | Apply theme (color mode, preset, custom accent color) to all signed-in app pages, standalone doc (`viewer/doc.html`), and graph viewer (`viewer/index.html` + `picture-export.js`), while keeping the embedded terminal (`xterm.js` in `viewer/pages/term-view.js`) dark. | Keeps all Wheelchair UI and diagrams cohesive without making CLI ANSI colors unreadable in light mode. | user |
| 5 | Store theme settings in hub `settings.json` synced across all devices, backed by a browser-local cache applied before first paint so pages do not flash the wrong theme on load. | Matches Background sync behavior across phone and computer; `system` color mode lets each device follow its own OS light/dark schedule. | user |
| 6 | Ship curated full-palette theme presets (Wheelchair Default plus Midnight, Forest, Amber, Rose, and Slate) that each define both light and dark surface/border/text palettes and a default accent, while allowing the user to override the accent to any custom hex color (and reset to preset or default). | Lets the user change the whole mood of the app in both light and dark modes while keeping full freedom over the accent color. | user |
| 7 | Overlap with 72ca062b2848: isolate Theme storage, routes, and Settings → You UI in dedicated modules (`viewer/app/theme.js`, `viewer/pages/theme.js`, `viewer/pages/theme-editor.js`) rather than modifying shared Settings polling; thread 72ca062b2848 was building Settings auto-refresh (in-memory revision endpoint and per-block polling in `viewer/pages/settings.js`, with no `settings.json` schema changes) at the time (overlap card 6ba3f145-8654-4340-8c7c-3268b8559d43) | Keeps Theme cleanly decoupled from Settings auto-refresh, matching how Background is structured. | user |
| 8 | Approved the three v1 mockups: `docs/plans/theme-options/graphs/mockup-theme-settings-desktop.html` (1280×900), `docs/plans/theme-options/graphs/mockup-theme-settings-phone.html` (390×844), and `docs/plans/theme-options/graphs/mockup-theme-thread-light.html` (1280×900). | Settings controls fit cleanly above Background on desktop and phone, and the light-mode Thread view shows clear contrast with a non-blue accent. | user |
| 9 | Default persisted theme for existing and fresh installs is `{ mode: "dark", preset: "default", accent: null, revision: 0 }`. | Preserves Wheelchair's exact current dark slate + `#5b9dd9` blue look on upgrade with zero visual regression until the user changes it. | defaulted |
| 10 | Apply the active accent color to the Wheelchair loading spinner's wheel/caster highlight (and match its wheelchair outline/spokes to the active light/dark ink and idle colors). | Collin requested that the loading spinner also use the chosen accent color. | user |
| 11 | Choosing a preset preserves an existing custom accent override until the user clicks "Reset to preset" or "Reset to default", and "Reset to default" resets preset and accent (`preset: "default", accent: null`) without overwriting the user's color mode. | Keeps accent overrides non-destructive while browsing presets and avoids unexpectedly switching a `system` user back to `dark`. | review-round-1 |

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
   - `normalizeTheme(raw)` validates every field strictly; if `raw` is missing, malformed, or any field is out of range, it returns `{ ...DEFAULT }`. Uppercase hex in `accent` is accepted and lowercased on `PUT` input; stored/normalized `accent` is always lowercase `#rrggbb` or `null`.
   - `viewer/app/settings.js`'s `normalize()` calls `theme.normalizeTheme(raw?.theme)` so every `settings.update()` preserves `settings.theme` instead of dropping it.
   - **Malformed `theme` field vs unparseable `settings.json`:** A malformed `theme` field inside valid `settings.json` normalizes to `{ ...DEFAULT }` on `GET` and can be cleanly overwritten by `PUT` (at revision `0`). An unparseable `settings.json` file (JSON syntax error from `hub.state.settings(null)`) is never silently replaced: both `GET` and `PUT` propagate the read error (`500`) without touching `settings.json`.

2. **HTTP routes (`viewer/app/routes.js`):**
   - Dispatch `bits[0] === 'settings' && bits[1] === 'theme'` to `require('./theme.js').handle(hub, request, response, url, bits, send)` (matching `background.js` at `viewer/app/routes.js:49`).
   - Inherits the hub's remember-cookie auth and same-origin write checks from `viewer/server.js`.
   - **Shared error envelope:** All theme route errors return JSON via `send(response, status, { error: "<plain message>", ...extra })` (400 invalid input, 404/405 wrong path/method, 409 conflict with current theme fields `{ error: "Theme changed elsewhere", ...current }`, 413 body > 4 KiB). Do not mix `appError`'s `{ error: "app-error", detail }` envelope for validation/conflict responses; `theme-editor.js` still reads `body?.error || body?.detail` defensively.
   - **`GET /wheelchair/api/settings/theme`** (`bits.length === 2`): returns `200` with `{ mode, preset, accent, revision }` and `Cache-Control: no-store`.
   - **`PUT /wheelchair/api/settings/theme`** (`bits.length === 2`):
     - Body limit: 4 KiB (reject larger with `413` `{ error: "Request body too large" }`). Requires valid JSON object `{ mode, preset, accent, revision }`.
     - Validates `mode` in `MODES`, `preset` in `PRESETS`, `accent` is `null` or `/^#[0-9a-fA-F]{6}$/` (normalized to lowercase), and `revision` is a non-negative safe integer. Invalid input returns `400` with `{ error: "<reason>" }`.
     - Runs inside `hub.state.queued(hub.state.settingsPath, ...)` (same settings file queue as `background.js`):
       - Reads and normalizes current `settings.json` (propagating parse errors as 500).
       - If `body.revision !== current.revision`: returns `409` with `{ error: "Theme changed elsewhere", ...current }`.
       - If `mode`, `preset`, and `accent` all equal `current`: returns `200` with `current` without bumping `revision` or rewriting `settings.json`.
       - If `current.revision === Number.MAX_SAFE_INTEGER`: returns `400` (`{ error: "Revision limit reached" }`).
       - Otherwise writes updated `settings.theme` with `revision: current.revision + 1` via `atomicWrite(hub.state.settingsPath, ...)` and returns `200` with the new `{ mode, preset, accent, revision }`.
   - Document `GET /settings/theme` and `PUT /settings/theme` in `viewer/app/API.md`.

### 2. Shared palette & contrast derivation (`viewer/pages/theme-palette.js`)

- Pure, zero-dependency dual-environment module (CommonJS `module.exports` for Node tests and `window.wcThemePalette` in the browser, matching `viewer/pages/background-format.js`).
- **6 curated presets** (`PRESETS`), each defining `id`, `label`, `swatches: [c1, c2, c3]` (matching `mockup-theme-settings-desktop.html`), `defaultAccent`, and complete `dark` and `light` surface/border/text palettes:

| Preset | Label | Swatches | Default accent | Mode | `--bg` | `--panel` | `--panel-2` | `--panel-3` | `--band` | `--line` | `--line-2` | `--ink` | `--ink-2` | `--dim` | `--figure` | `--code-bg` | `--idle` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `default` | Wheelchair Default | `#18212c,#5b9dd9,#354a60` | `#5b9dd9` | dark | `#14161a` | `#1c1f25` | `#23262d` | `#181a1e` | `#161a20` | `#2a2f38` | `#3a3f48` | `#e6e8ec` | `#c5cad3` | `#8b929e` | `#111316` | `#23262d` | `#6b7280` |
| `default` | Wheelchair Default | `#18212c,#5b9dd9,#354a60` | `#5b9dd9` | light | `#f6f7f9` | `#ffffff` | `#edf0f4` | `#f2f4f7` | `#eef1f5` | `#d8dee6` | `#bfc8d4` | `#161b22` | `#3d4754` | `#576371` | `#e7ecf2` | `#edf0f4` | `#64707d` |
| `midnight` | Midnight | `#101725,#8294e8,#303b61` | `#8294e8` | dark | `#101522` | `#171e2f` | `#1f273c` | `#131928` | `#121827` | `#27314a` | `#374464` | `#e7ebf5` | `#c4cce0` | `#8d98b3` | `#0c101b` | `#1f273c` | `#6d7896` |
| `midnight` | Midnight | `#101725,#8294e8,#303b61` | `#8294e8` | light | `#f5f7fc` | `#ffffff` | `#ebeefa` | `#f0f3fb` | `#edf0f9` | `#d5dcef` | `#bcc7e2` | `#151b2b` | `#39435c` | `#545f7a` | `#e4e9f7` | `#ebeefa` | `#646f8a` |
| `forest` | Forest | `#14251e,#10b981,#365848` | `#10b981` | dark | `#111c17` | `#17261f` | `#1e3128` | `#14201b` | `#131f1a` | `#273d33` | `#365346` | `#e6efe9` | `#c2d4c9` | `#89a193` | `#0d1612` | `#1e3128` | `#6b8275` |
| `forest` | Forest | `#14251e,#10b981,#365848` | `#10b981` | light | `#f7f8f7` | `#ffffff` | `#edf1ee` | `#f2f5f3` | `#eef2ef` | `#dce3de` | `#c4d0c7` | `#18231c` | `#3e4d43` | `#55645a` | `#e4ebe6` | `#edf1ee` | `#637368` |
| `amber` | Amber | `#2c2418,#e5a63a,#705831` | `#e5a63a` | dark | `#1b1712` | `#252019` | `#2f2820` | `#201b15` | `#1e1913` | `#3d3428` | `#524636` | `#f0ebe3` | `#d3c9ba` | `#a49784` | `#15120e` | `#2f2820` | `#807464` |
| `amber` | Amber | `#2c2418,#e5a63a,#705831` | `#e5a63a` | light | `#faf7f2` | `#ffffff` | `#f2ece2` | `#f6f1e9` | `#f3ede3` | `#e3d9ca` | `#cfc1ac` | `#231d15` | `#4d4234` | `#665847` | `#ebe3d5` | `#f2ece2` | `#756858` |
| `rose` | Rose | `#291d22,#e06c75,#704650` | `#e06c75` | dark | `#1b1418` | `#261c21` | `#31242b` | `#20181c` | `#1e161a` | `#402e37` | `#573f4b` | `#f2e9ed` | `#d6c3cc` | `#a8909c` | `#151013` | `#31242b` | `#846e79` |
| `rose` | Rose | `#291d22,#e06c75,#704650` | `#e06c75` | light | `#fbf6f7` | `#ffffff` | `#f4eaec` | `#f7eff1` | `#f4ebed` | `#e5d5d9` | `#d2bcc2` | `#26181d` | `#523b43` | `#6b515a` | `#ede0e3` | `#f4eaec` | `#7a6069` |
| `slate` | Slate | `#20262c,#94a3b8,#4e5a69` | `#94a3b8` | dark | `#16191d` | `#1f242a` | `#272d35` | `#1a1e23` | `#181c21` | `#303741` | `#414a57` | `#e7eaee` | `#c5cbd3` | `#8f98a4` | `#111417` | `#272d35` | `#6e7784` |
| `slate` | Slate | `#20262c,#94a3b8,#4e5a69` | `#94a3b8` | light | `#f5f6f8` | `#ffffff` | `#eceff3` | `#f1f3f6` | `#edeff3` | `#d7dde5` | `#bfc7d2` | `#181d23` | `#3e4652` | `#586270` | `#e5e9ef` | `#eceff3` | `#66707e` |

- **Shared semantic status tokens** per resolved mode (dark matches `viewer/pages/app.css:18-21` verbatim):
  - **Dark:** `--good: #4ea87b`, `--good-ink: #0c1410`, `--good-bg: #172019`, `--good-line: #3f7a5c`, `--good-soft: #1d2a23`, `--good-text: #8fd0ad`, `--warn: #d9a441`, `--warn-bg: #241f15`, `--warn-line: #5c4a24`, `--warn-tint: #1a1813`, `--bad: #c4645f`, `--bad-text: #e09a96`, `--bad-bg: #2a1a19`.
  - **Light:** `--good: #1f8a54`, `--good-ink: #ffffff`, `--good-bg: #e8f5ee`, `--good-line: #8bc9a8`, `--good-soft: #eef8f2`, `--good-text: #15693e`, `--warn: #9a6700`, `--warn-bg: #fdf5e6`, `--warn-line: #e2c27d`, `--warn-tint: #faf4e8`, `--bad: #c23b3b`, `--bad-text: #a32626`, `--bad-bg: #fdeeee`.
- **Quick accent swatches** exported as `QUICK_ACCENTS`: `['#5b9dd9', '#10b981', '#d6a53b', '#e06c75', '#a78bfa', '#94a3b8']`.
- **Accent derivation (`deriveAccent(hex, resolvedMode, surfaces, presetId)`):**
  - Special-case exact Wheelchair Default in dark mode (`presetId === 'default' && resolvedMode === 'dark' && hex === '#5b9dd9'`): returns exact original tokens (`--accent: #5b9dd9`, `--accent-ink: #0e1114`, `--accent-hover: #a9cdf0`, `--accent-hover-ink: #0e1114`, `--accent-soft: #1a2230`, `--accent-line: #3a5778`, `--accent-text: #7fb4e6`, `--accent-hi: #a9cdf0`, `--accent-chip: #1f2b3a`, `--human: #23303f`) so existing default appearance is pixel-identical.
  - Helper `pickContrastInk(bgHex)`: computes WCAG 2.1 contrast ratio against `#0e1114`, `#000000`, and `#ffffff`. If `#0e1114` meets `>= 4.5` and is at least as high as `#ffffff`, return `#0e1114`; otherwise return whichever of `#000000` and `#ffffff` has the higher contrast ratio (mathematically `>= 4.58:1` for every RGB color, including mid-gray `#777777`).
  - For any other `(hex, resolvedMode, surfaces)`:
    - `--accent`: normalized `#rrggbb` chosen color.
    - `--accent-ink`: `pickContrastInk(accent)`.
    - `--accent-hover`: hover fill for filled primary buttons/FABs — shifts `--accent` in HSL lightness (+8% in dark mode, -8% in light mode; if already near 0% or 100% lightness, shifts toward middle so hover is visibly distinct).
    - `--accent-hover-ink`: `pickContrastInk(accentHover)` (guaranteed `>= 4.5:1` against `--accent-hover` even for `#000000` or `#ffffff` accents).
    - `--accent-soft`: RGB mix of `--accent` (14% in dark, 10% in light) over `surfaces['--panel']`.
    - `--accent-line`: RGB mix of `--accent` (42% in dark, 38% in light) over `surfaces['--line']`.
    - `--accent-chip`: RGB mix of `--accent` (20% in dark, 14% in light) over `surfaces['--panel']`.
    - `--accent-text`: computed **after** `--accent-soft` and `--accent-chip`; starts from `--accent` in HSL and steps lightness (lighter in dark mode, darker in light mode) until WCAG 2.1 contrast ratio against all five surfaces (`--bg`, `--panel`, `--panel-2`, `--accent-soft`, `--accent-chip`) is `>= 4.5:1` (falling back to `surfaces['--ink']` if needed).
    - `--accent-hi`: hover/highlight text accent derived from `--accent-text` (slightly lighter in dark mode, slightly darker in light mode) while maintaining `>= 4.5:1` contrast against all five surfaces (`--bg`, `--panel`, `--panel-2`, `--accent-soft`, `--accent-chip`).
    - `--human`: RGB mix of `--accent` (16% in dark, 12% in light) over `surfaces['--panel-2']` (verified `>= 4.5:1` with `surfaces['--ink']`; if a very bright/dark accent lowers contrast below 4.5:1, reduce mix weight until `>= 4.5:1`).
- **Spinner SVG derivation (`buildSpinnerUrls(ink, idle, accent, surfaces, resolvedMode)`):**
  - Derives `spinnerAccent` from `accent` by stepping HSL lightness (lighter in dark mode, darker in light mode) only if needed so its WCAG 2.1 non-text contrast ratio against `--bg` and `--panel` is `>= 3.0:1` (unchanged exact `accent` whenever it already clears `3.0:1`, including Default Dark `#5b9dd9`).
  - Builds the two `url("data:image/svg+xml,...")` strings (normal speed and `prefers-reduced-motion` speed, matching `viewer/pages/app.css:204,206`) with `%23` URI-encoded `ink`, `idle`, and `spinnerAccent` hex values, exposed as `--spinner-svg` and `--spinner-svg-reduced` in `vars`.
- **`resolveTheme(theme, prefersLight)`**: accepts `{ mode, preset, accent }` (normalizing invalid values to defaults) and boolean `prefersLight`, returns `{ mode, preset, accent, resolvedMode: 'light' | 'dark', effectiveAccent, vars }`.
- **`parseHexColor(input)`**: trims whitespace, accepts optional leading `#`, accepts 3-digit (`#abc` → `#aabbcc`) or 6-digit hex, returns lowercase `#rrggbb` or `null`.

### 3. Browser theme controller & pre-paint bootstrap (`viewer/pages/theme.js`)

- Loaded synchronously in `<head>` (after `theme-palette.js`, before page stylesheets paint; no `defer` attribute) on **all 12 signed-in/content HTML pages**:
  - `viewer/pages/agents.html`, `viewer/pages/doc.html`, `viewer/pages/features.html`, `viewer/pages/file.html`, `viewer/pages/new.html`, `viewer/pages/picture.html`, `viewer/pages/settings.html`, `viewer/pages/terminal.html`, `viewer/pages/thread.html`, `viewer/pages/threads.html`
  - `viewer/index.html` (graph viewer) and `viewer/doc.html` (standalone doc viewer).
  - **Not** loaded on `viewer/signin.html`.
- **Pre-paint application:**
  - Reads `localStorage.getItem('wc-theme-v1')` inside `try/catch`; if valid, immediately resolves with `window.matchMedia('(prefers-color-scheme: light)').matches` and applies all `--*` CSS custom properties onto `document.documentElement.style`, sets `document.documentElement.dataset.themeMode` (`light` | `dark`), `document.documentElement.dataset.themePreset`, and `document.documentElement.style.colorScheme = resolvedMode`.
  - If `localStorage` is empty or invalid, leaves CSS defaults untouched until hub fetch resolves (default dark matches `app.css`).
- **Monotonic revision gate & hub sync:**
  - Track `acceptedRevision` (initialized from cached `localStorage` if present, or `-1`).
  - Route every incoming theme metadata (`GET` response, `PUT` response via `applySaved`, and `storage` event from another tab) through one `acceptMetadata(next, source)` function:
    - If `next.revision < acceptedRevision`, ignore it (prevents a delayed stale `GET` from clobbering a newer `PUT` or `storage` update).
    - If `next.revision === acceptedRevision` and `mode`/`preset`/`accent` are identical, do nothing.
    - Otherwise update `acceptedRevision`, store in `localStorage['wc-theme-v1']` (unless `source === 'storage'`), apply CSS variables if no preview token is active, and notify subscribers.
  - On load, fetches `GET /wheelchair/api/settings/theme` (`credentials: 'same-origin'`, `cache: 'no-store'`).
  - Listens to `window.matchMedia('(prefers-color-scheme: light)')` `change` events: immediately re-applies when active theme (saved or previewed) has `mode === 'system'`.
  - Listens to `window` `storage` events for key `wc-theme-v1`: routes parsed value through `acceptMetadata(next, 'storage')`.
  - Refreshes from hub every 10 seconds while `document.visibilityState === 'visible'` (using `window.wcPoller` when available or a visibility-gated timer on pages without `nav.js` like `viewer/index.html` and `viewer/doc.html`), plus on `focus` and `pageshow` (matching `background.js`).
  - Dispatches `CustomEvent('wc-theme-change', { detail })` on `window` whenever applied CSS variables change so JS consumers (graph viewer, `agents.js`) can re-read computed values.
- **Public API (`window.wcTheme`):**
  - `current()` → `{ metadata, ready, error }`
  - `subscribe(fn)` → returns unsubscribe function
  - `acquire()` → returns exclusive preview token (mirrors `window.wcBackground.acquire()`)
  - `preview(token, draft)` → applies `{ mode, preset, accent }` live on the current page without touching `localStorage` or hub (ignored if token is not current owner)
  - `release(token)` → releases preview ownership and restores the last saved hub theme
  - `refresh()` → fetches `GET /wheelchair/api/settings/theme`
  - `applySaved(metadata)` → routes through `acceptMetadata(metadata, 'save')`.

### 4. Settings → You Theme editor (`viewer/pages/theme-editor.js`, `viewer/pages/settings.js`, `viewer/pages/settings.css`)

- Isolated in `viewer/pages/theme-editor.js` (loaded by `viewer/pages/settings.html` via `<script defer>`) exposing `window.wcThemeEditor`.
- `viewer/pages/settings.js` makes minimal wiring changes in the `You` section: adds a `theme` block right above `background` that mounts `window.wcThemeEditor.render(...)` and calls `window.wcThemeEditor.discard()` whenever leaving the `You` section (desktop sidebar navigation, phone Back link, and `window` `pagehide` so bfcache navigation away from Settings releases the preview token and clears unsaved drafts, matching `settings.js:2385-2388,2879-2889`). Does not alter Settings polling or other blocks.
- **Visit, draft baseline, and in-flight ownership:**
  - Each `You` section visit owns a `visit` state `{ generation, dirty, baseRevision, op, saving, token, draft, hexText, hexError, conflict, error, status }` (matching `backgroundVisit`).
  - When `dirty` transitions `false → true`, capture `visit.baseRevision = wcTheme.current().metadata.revision` and acquire `visit.token = wcTheme.acquire()`. Subsequent hub polls or storage events do not mutate `visit.baseRevision` or `visit.draft` while dirty.
  - While `visit.saving === true`, disable all Theme editor inputs and buttons so edits cannot race with an in-flight `PUT`.
  - Capture `(visit, op)` before calling `PUT /wheelchair/api/settings/theme` with `{ mode, preset, accent, revision: visit.baseRevision }`. If `discard()` ran (user left `You`) before the response arrives, ignore the response cleanly (only calling `wcTheme.applySaved(body)` on `200` so the saved theme still propagates globally without touching any new visit's UI).
- **Controls (matching `mockup-theme-settings-desktop.html` and `mockup-theme-settings-phone.html`):**
  1. **Color mode:** 3-button segmented control (`System`, `Light`, `Dark`) with `aria-pressed`.
  2. **Theme preset:** 6-card grid (`Wheelchair Default`, `Midnight`, `Forest`, `Amber`, `Rose`, `Slate`), each showing its 3-color swatch bar, name, and active checkmark (`aria-pressed`). Clicking a preset sets `draft.preset = id` and preserves `draft.accent` (Decision #11): if `draft.accent` is `null`, the new preset's signature accent previews immediately; if a custom accent is set, it remains active over the new preset's surfaces until reset.
  3. **Accent color:**
     - Native `<input type="color">` synced to the effective accent (`draft.accent || preset.defaultAccent`). Picking a color sets `draft.accent` to that lowercase hex.
     - Hex `<input type="text">` (`aria-label="Accent hex color"`) displaying the effective hex; typing a valid 3- or 6-digit hex updates preview live; invalid text shows an inline validation hint and disables Save until corrected or reset.
     - 6 quick accent swatch buttons (`#5b9dd9`, `#10b981`, `#d6a53b`, `#e06c75`, `#a78bfa`, `#94a3b8`) that set `draft.accent` to that color.
     - **Reset to preset** button: sets `draft.accent = null` (disabled when `draft.accent === null`).
     - **Reset to default** button: sets `draft.preset = 'default'` and `draft.accent = null`, preserving `draft.mode` (Decision #11; disabled when `draft.preset === 'default' && draft.accent === null`).
  4. **Status line & Save / Reset actions (matching mockups):**
     - While dirty (and not conflicted/error): show status line `"Previewing on this page · Save to apply across devices"`.
     - **Reset** button: discards unsaved edits, releases preview token, clears conflict/error, restores last saved hub theme (disabled when clean).
     - **Save theme** button: sends `PUT /wheelchair/api/settings/theme` with `{ mode, preset, accent, revision: visit.baseRevision }`.
       - On `200`: calls `wcTheme.applySaved(saved)`, releases preview token, clears dirty state, shows `"Saved"`.
       - On `409`: calls `wcTheme.applySaved(latest)` (updating hub cache), keeps `visit.dirty = true` and `visit.draft` visible, shows inline conflict message `"Theme changed elsewhere. Click Reset to load the latest settings."` and disables Save until Reset (matching `background` conflict handling).
       - On network/4xx/5xx error: shows inline error message (`body?.error || body?.detail || "Couldn't save theme"`) and re-enables controls.
- **Responsive layout (`viewer/pages/settings.css`, matching both approved mockups):**
  - 6-column preset grid (`repeat(6, minmax(0, 1fr))`) on desktop, dropping to 3 columns (`repeat(3, minmax(0, 1fr))`) at `@media (max-width: 700px)`, with zero horizontal overflow at `390px` viewport width.

### 5. Surface tokenization & special views

1. **Main app stylesheets (`viewer/pages/app.css`, `assistant-popup.css`, `thread.css`, `views.css`, `settings.css`, `doc.css`, `file.css`, `background.css`):**
   - `viewer/pages/app.css`:
     - Keep `:root` dark defaults unchanged (add `--accent-hover: #a9cdf0; --accent-hover-ink: #0e1114;`).
     - Set `color-scheme: dark;` on `html` only (removing `color-scheme: dark` from `body` in `app.css:29`), and override with `html[data-theme-mode="light"], html[data-theme-mode="light"] body { color-scheme: light; }` so native controls (such as `<input type="color">` and scrollbars) follow light mode while `.tv-host` keeps `color-scheme: dark`.
     - `#app-nav .logo` uses `color: var(--accent-ink)` instead of `color: var(--bg)`.
     - Filled primary button/FAB hover rules (`app.css:70`, `app.css:121-122`, `assistant-popup.css:16`) use `background: var(--accent-hover); border-color: var(--accent-hover); color: var(--accent-hover-ink);` instead of `--accent-hi` with `--accent-ink`.
     - Replace raw `color: var(--accent)` text rules (`app.css:141`, `views.css:249` `.latest-running`, and any other text-color uses of `var(--accent)` in `viewer/pages/*.css`) with `color: var(--accent-text)` so text always meets `>= 4.5:1` contrast.
     - `.spinner` (`app.css:203-206`): use `background-image: var(--spinner-svg, url(...))` and under `@media (prefers-reduced-motion: reduce)` use `background-image: var(--spinner-svg-reduced, url(...))` so the wheelchair spinner's wheel highlight uses `--accent` and its outline/spokes use `--ink`/`--idle` (Decision #10).
   - `viewer/pages/assistant-popup.css:40`: replace hardcoded `#23303f` with `var(--human)`.
   - Audit `viewer/pages/*.css` for any remaining hardcoded blue hex/rgba literals or dark-only text/surface literals that break in light mode and replace them with theme tokens.
   - `viewer/pages/background.css`: verify opaque content surfaces remain opaque using `var(--bg)` / `var(--panel)` in light mode when a background image is active.
2. **Graph viewer (`viewer/index.html`) and PNG export (`viewer/pages/picture-export.js`, `viewer/pages/picture.js`):**
   - Load `theme-palette.js` and `theme.js` in `viewer/index.html` `<head>`.
   - Align `viewer/index.html`'s `:root` variables with the shared palette (`--bg`, `--panel`, `--panel-2`, `--line`, `--ink`, `--dim`, `--accent`, `--accent-ink`, `--accent-text`, `--accent-soft`, `--warn`, `--good`, `--bad`, keeping existing dark defaults as fallbacks).
   - Replace literal dark SVG fills and raw-accent text in `viewer/index.html`:
     - `.node .node-box`: `fill: var(--panel); stroke: var(--line-2);` (instead of `#21252c`).
     - `.node.selected .node-box`: `fill: var(--accent-soft); stroke: var(--accent);` (instead of `#2b3140`).
     - `.node .node-fork` and inferred-edge detail (`viewer/index.html:109,205-208`): `fill: var(--warn);` / `color: var(--warn);` (instead of `#d8b45f`).
     - `.open-child .open-child-bg`: `fill: var(--panel-2); stroke: var(--accent-line);` (instead of `#2c3340`).
     - `.open-child .open-child-label` and `.status-tag.status-in-progress`: `fill: var(--accent-text);` (instead of `var(--accent)`).
     - Edge-label background pill (if literal dark fill) → `fill: var(--bg);`.
     - Selection box `rgba(91, 157, 217, .12)` (`viewer/index.html:219`) → `color-mix(in srgb, var(--accent) 14%, transparent)` (with `var(--accent-soft)` fallback).
     - Active/selected accent-filled toolbar toggle buttons (`viewer/index.html:29-36`): `background: var(--accent); border-color: var(--accent); color: var(--accent-ink);` and their `:hover` state uses `background: var(--accent-hover); border-color: var(--accent-hover); color: var(--accent-hover-ink);` (overriding the generic `#2b3542` hover fill).
   - **PNG export document ownership (`viewer/pages/picture-export.js`, `viewer/pages/picture.js`):**
     - Graph export (`exportGraphPng` / SVG clone from iframe): capture the iframe's computed background color (`getComputedStyle(iframe.contentDocument.documentElement).getPropertyValue('--bg')` or `getComputedStyle(svg).backgroundColor`) from the **iframe document** at the same time SVG computed styles are inlined, and pass that captured background into the canvas fill so a live theme update on the parent page cannot produce a mismatched background.
     - Form export (`exportFormPng`): reads computed palette tokens from the Picture page's own `document.documentElement` (which loads `theme-palette.js` + `theme.js`).
3. **Standalone doc page (`viewer/doc.html`):**
   - Load `theme-palette.js` and `theme.js` in `<head>`, align `:root` variables with the shared palette (dark defaults as fallback), and use `var(--accent-text)` (hover `var(--accent-hi)`) for links (`viewer/doc.html:66`) instead of raw `var(--accent)`.
4. **Embedded terminal (`viewer/pages/term-view.js`, `viewer/pages/views.css`):**
   - Terminal stays dark in all color modes (Decision #4): `.tv-host` in `viewer/pages/views.css` explicitly sets `background: #0c0e10; color: #e6e8ec; color-scheme: dark;` and xterm's constructor in `viewer/pages/term-view.js` passes an explicit dark `theme: { background: '#0c0e10', foreground: '#e6e8ec', cursor: '#e6e8ec' }` (preserving the existing warning-color cursor while typing). Surrounding controls (`.term-bar`, `.tv-view` border, `.tv-switch`, `.tv-notice`) remain themed with readable light/dark tokens including with an active background image.
5. **Agents activity colors (`viewer/pages/agents.js`):**
   - Read accent/status colors from computed CSS variables (with existing hex fallbacks) where accent-colored indicators appear, and refresh on `wc-theme-change`.
6. **Router & test map upkeep (`CONTRIBUTING.md`):**
   - Update `viewer/AGENTS.md` file table to include `app/theme.js`, `pages/theme-palette.js`, `pages/theme.js`, and `pages/theme-editor.js`.
   - Update `test-support/test-map.json` if any new files are not covered by existing globs.
   - Add **both** `test/theme-editor.spec.js` and `test/theme-rendering.spec.js` to `viewer/test/firefox-specs.js` (per `CONTRIBUTING.md`: specs testing pixels, rendering, or scroll containment run in both Chromium and Firefox).

### 6. Non-goals (from IDEA.md)

- Typography, font-size, layout density, or corner-radius controls.
- Per-project or per-thread theme overrides.
- Custom raw CSS editing or user-uploaded stylesheet files.
- Theming `viewer/signin.html` or switching xterm.js to a light terminal palette.

### 7. Validation commands

Targeted tests (run by workers and verifiers; full suite runs before push via `test-support/full-run.sh`):

1. **Theme unit & API tests (`viewer/test/theme.test.js`):**
   - Covers `theme-palette.js` WCAG 2.1 contrast (`>= 4.5:1`) for:
     - `--ink`, `--ink-2`, `--dim` against `--bg`, `--panel`, and `--panel-2` for all 6 presets in both `light` and `dark` modes.
     - `--accent-ink` on `--accent`, `--accent-hover-ink` on `--accent-hover`, `--accent-text` and `--accent-hi` on `--bg`/`--panel`/`--panel-2`/`--accent-soft`/`--accent-chip`, `--ink` on `--human`, and `spinnerAccent` (`>= 3.0:1` non-text contrast on `--bg`/`--panel`) across all 6 presets, both modes, and edge hex colors (`#000000`, `#777777`, `#8d8d8d`, `#ffffff`, `#ffff00`, `#ff0000`, `#00ff00`, `#5b9dd9`, `#d6a53b`).
     - Exact pixel-identical default dark tokens and `--spinner-svg` / `--spinner-svg-reduced` color injection.
   - Covers `GET /wheelchair/api/settings/theme` and `PUT /wheelchair/api/settings/theme`: defaults, malformed `theme` field normalization vs unparseable `settings.json` returning 500 without overwriting, valid save + revision increment, idempotent no-op save, 400 invalid input (`{ error }`), 409 revision conflict (`{ error, mode, preset, accent, revision }`), 413 oversized payload, preservation across unrelated `settings.update()` calls.
   - Command: `node --test viewer/test/theme.test.js`
2. **Existing settings & background regression tests:**
   - Command: `node --test viewer/test/background.test.js viewer/test/app-settings.test.js`
3. **Browser Settings editor & sync spec (`viewer/test/theme-editor.spec.js`, listed in `viewer/test/firefox-specs.js`):**
   - Isolated server via `viewer/test/helpers/server.js`.
   - Tests Settings → You Theme controls: live preview of mode/preset/custom hex/quick swatch without saving, status line `"Previewing on this page · Save to apply across devices"`, preset switch preserving custom accent, Reset to preset, Reset to default preserving color mode, Reset discarding preview, Save persisting across reload, invalid hex validation disabling Save, 409 conflict with stale baseRevision after concurrent update, delayed stale GET not overwriting newer PUT/storage state, navigating away (including mobile Back link and header navigation + browser Back / `pagehide`) discarding in-flight/draft state, 6-column desktop / 3-column phone (390×844) preset grid with zero horizontal overflow.
   - Command: `npm --prefix viewer run test:browser -- test/theme-editor.spec.js`
4. **Browser rendering & cross-page spec (`viewer/test/theme-rendering.spec.js`, listed in `viewer/test/firefox-specs.js`):**
   - Tests that saved light mode + custom accent color applies to Thread, Threads, Agents, New, Picture, Graph (`viewer/index.html`), and Standalone Doc (`viewer/doc.html`), including readable contrast on raw-accent-replaced labels, graph node boxes/labels, active toolbar button hover, inferred-edge detail text, standalone doc links, filled button hover pairs, `body` computed `color-scheme: light`, and spinner `--spinner-svg` containing the contrast-checked `spinnerAccent` hex; verifies Terminal (`.tv-host` / xterm) stays dark (`#0c0e10`), Sign-in stays default dark, pre-paint bootstrap avoids dark flash on reload in light mode, light mode + background image keeps cards opaque, and exported graph PNG background pixel matches the iframe's active theme background.
   - Command: `npm --prefix viewer run test:browser -- test/theme-rendering.spec.js`

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| If `settings.json`'s `theme` field is externally corrupted/malformed on disk and resets to revision `0` while a browser still caches a higher revision (e.g., `5`), the monotonic `acceptedRevision` gate ignores the lower revision until `localStorage` is cleared or revision catches up. | Rare path per `protocol/app/realism.md` (requires state-file corruption on disk combined with an already-cached higher browser revision). | review-round-2 |

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

### Round 1 — 2026-11-28

**Lanes:** claude / claude-opus-5-5 (intent); gpt / gpt-6.2-sol (mechanics); cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Preset grid layout in Spec (3-col / 2-col) contradicts approved mockups (6-col / 3-col at <=700px) | upheld | Updated Spec §4 responsive layout and §7.3 test to 6 columns desktop / 3 columns <=700px matching mockups |
| intent | major | Raw `color: var(--accent)` rules (`app.css:141`, `views.css:249`) fail contrast in light mode (e.g. amber `#d6a53b` on white is 2.26:1) | upheld | Updated Spec §5.1 to replace raw `color: var(--accent)` text rules with `var(--accent-text)` |
| intent | minor | Preset surface text tokens (`--ink`, `--ink-2`, `--dim`) not contrast-checked; Forest light `--dim #65756a` on `--panel-2 #edf1ee` is 4.28:1 | upheld | Darkened Forest light `--dim` to `#55645a` and added all-preset surface text contrast checks to §7.1 |
| intent | minor | Presets 2–6 only specified `--bg`/`--panel` hexes, leaving remaining surface/line/text/status tokens unspecified | upheld | Added complete token table for all 6 presets (dark + light) and shared dark/light status tokens in Spec §2 |
| intent | minor | "Reset to default" forcing `mode: 'dark'` surprises `system` users | upheld | Logged Decision #11 and updated Spec §4 so "Reset to default" resets preset & accent while preserving color mode |
| intent | minor | Clicking a preset always clears custom accent override | upheld | Logged Decision #11 and updated Spec §4 so preset click preserves an existing custom accent until reset |
| intent | minor | Editor button label ("Cancel (or Reset)") and missing status line drift from approved mockups | upheld | Updated Spec §4 to use exact mockup button label "Reset" and status line "Previewing on this page · Save to apply across devices" |
| intent | minor | Pre-paint page list omitted `new.html` and `picture.html` | upheld | Listed all 10 `viewer/pages/*.html` files explicitly plus `viewer/index.html` and `viewer/doc.html` in Spec §3 |
| mechanics | blocking | `#0e1114` vs `#ffffff` cannot meet 4.5:1 on mid-gray `#777777` | upheld | Added `#000000` fallback in `pickContrastInk` and added `#777777` to §7.1 contrast tests |
| mechanics | blocking | `--accent-hi` cannot serve as both readable text on dark panel and filled hover background with `--accent-ink` (fails on `#000000`) | upheld | Added dedicated `--accent-hover` / `--accent-hover-ink` tokens for filled hover buttons/FABs and added contrast tests |
| mechanics | blocking | Validation commands name nonexistent `viewer/test/settings.test.js` and `npx --prefix viewer` misses `viewer/playwright.config.js` | upheld | Fixed §7 commands to `viewer/test/app-settings.test.js` and `npm --prefix viewer run test:browser -- <spec>` |
| mechanics | major | Save contract leaves draft revision baseline unspecified (poll/storage update can bypass 409) | upheld | Specified capturing `baseRevision` when draft turns dirty and sending it on PUT in Spec §4 |
| mechanics | major | Delayed stale GET finishing after PUT or storage event can overwrite newer theme | upheld | Added monotonic `acceptedRevision` gate in Spec §3 and stale-GET test in §7.3 |
| mechanics | major | Save completion lacks ownership rule for in-flight edits and navigating away (including mobile Back) | upheld | Specified disabling controls during PUT and tying completion to `(visit, op)` with `discard()` on leaving You in Spec §4 |
| mechanics | major | Graph SVG literal dark fills (`#21252c`, `#2b3140`, `#2c3340`, `#d8b45f`), raw-accent SVG text, and standalone doc links break in light mode | upheld | Specified exact SVG fill/text/toggle variables in `viewer/index.html` and `--accent-text` links in `viewer/doc.html` in Spec §5.2–5.3 |
| mechanics | major | PNG export document ownership unspecified (iframe vs Picture page mismatch during live theme update) | upheld | Specified iframe-captured `--bg` for graph PNG export and Picture-page tokens for form export in Spec §5.2, plus pixel test in §7.4 |
| mechanics | minor | Nonexistent `terminal.css` and `.term-wrap` selector; actual target is `.tv-host` in `viewer/pages/views.css` | upheld | Updated Spec §5.4 to target `.tv-host` in `viewer/pages/views.css` and preserve themed surrounding controls |
| mechanics | minor | Corrupt `theme` field conflated with unparseable `settings.json` | upheld | Separated malformed `theme` field (normalizes to default) from unparseable `settings.json` (returns 500 without overwriting) in Spec §1.1 & §7.1 |
| mechanics | minor | `appError` envelope (`{ error: "app-error", detail }`) vs plain `{ error: message }` mismatch | upheld | Standardized theme route errors on `{ error: "<plain message>" }` via `send()` in Spec §1.2 |
| mechanics | minor | `theme-editor.spec.js` tests horizontal scroll at phone width so it belongs in `viewer/test/firefox-specs.js` | upheld | Added both `theme-editor.spec.js` and `theme-rendering.spec.js` to `viewer/test/firefox-specs.js` in Spec §5.6 & §7.3 |
| mechanics | minor | Responsive grid conflict with approved mockups (duplicate of intent finding) | upheld | Resolved with intent finding #1 in Spec §4 and §7.3 |

### Round 2 — 2026-11-28

**Lanes:** claude / claude-opus-5-5 (intent); gpt / gpt-6.2-sol (mechanics); cross-family: yes.

**Changed since Round 1:**
- Added Decision #10 (Wheelchair loading spinner `--spinner-svg` / `--spinner-svg-reduced` using active `--accent`, `--ink`, `--idle` in Spec §2, §5.1, §7.4).
- Added Decision #11 (preset click preserves custom accent override; "Reset to default" preserves color mode).
- Fixed contrast math (`pickContrastInk` with `#000000` fallback for `#777777`; dedicated `--accent-hover` / `--accent-hover-ink` tokens for filled button hovers; complete 6-preset dark/light token table + shared status tokens with adjusted Forest light `--dim`).
- Replaced raw `color: var(--accent)` text rules (`app.css:141`, `views.css:249`, `index.html:120,128`, `doc.html:66`) with `var(--accent-text)`.
- Fixed graph SVG literal dark fills (`#21252c`, `#2b3140`, `#2c3340`, `#d8b45f`), selected toggle ink, and iframe-captured `--bg` for PNG export.
- Added all 12 HTML pages explicitly (`new.html` and `picture.html` included), monotonic `acceptedRevision` gate for GET/PUT/storage, draft `baseRevision` capture, in-flight PUT locking and visit/discard ownership.
- Aligned Settings editor grid (6-col / 3-col <=700px), button label ("Reset"), and preview status line with approved mockups.
- Fixed terminal selector to `.tv-host` in `viewer/pages/views.css`, separated malformed `theme` field from unparseable `settings.json` (500), standardized `{ error }` JSON envelope, fixed validation commands (`app-settings.test.js`, `npm --prefix viewer run test:browser -- <spec>`), and added `theme-editor.spec.js` to `viewer/test/firefox-specs.js`.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | `--accent-text` and `--accent-hi` are rendered on `--accent-chip`/`--accent-soft` (lead avatar, popup avatar, side-row pill), where Slate dark falls to 4.28:1 | upheld | Ordered `--accent-soft`/`--accent-chip` derivation before `--accent-text`/`--accent-hi`, required >= 4.5:1 against all 5 surfaces, and added tests in §7.1 |
| intent | minor | Spinner highlight uses raw `--accent`, which fades on light surfaces for light accents like `#d6a53b` | upheld | Derived `spinnerAccent` with >= 3.0:1 non-text contrast against `--bg` and `--panel` in Spec §2 and added test in §7.1 |
| mechanics | blocking | `--accent-text`/`--accent-hi` on `--accent-chip` fails 4.5:1 for `#8d8d8d` in Default Dark (3.7:1) | upheld | Resolved with intent finding #1 and added `#8d8d8d` to §7.1 contrast tests |
| mechanics | blocking | Graph active Select button `:hover` keeps `#2b3542` fill under `#0e1114` ink (1.53:1) and inferred-edge detail keeps `#d8b45f` on white (1.98:1) | upheld | Specified `--accent-hover`/`--accent-hover-ink` on active toolbar button hover and `var(--warn)` on inferred-edge detail (`index.html:205-208`) in Spec §5.2, plus tests in §7.4 |
| mechanics | blocking | Setting `color-scheme: light` only on `html` leaves `body` explicitly dark under `app.css:28-29` | upheld | Removed `color-scheme: dark` from `body` and applied `color-scheme: light` to both `html` and `body` in Spec §5.1, plus check in §7.4 |
| mechanics | minor | Unsaved theme preview stays active across header navigation + browser Back (bfcache `pageshow`) | upheld | Added `pagehide` discard hook in Spec §4 (matching `settings.js:2385-2388`) and test in §7.3 |
| mechanics | minor | Spinner test only checked hex presence even when white accent disappears on light surfaces (1.07:1) | upheld | Resolved with intent finding #2 (`spinnerAccent` >= 3.0:1 non-text contrast tested in §7.1 & §7.4) |
| mechanics | major | Rare path: hub recovering malformed `theme` at revision 0 while browser caches revision 5 is ignored by monotonic gate | accepted-risk | Rare path per `realism.md` (requires on-disk state corruption + higher cached revision); recorded in Accepted Risks |

### Round 3 — 2026-11-28

**Lanes:** pending.

**Changed since Round 2:**
- Ordered `--accent-soft` and `--accent-chip` before `--accent-text`/`--accent-hi` and required >= 4.5:1 against all five surfaces (`--bg`, `--panel`, `--panel-2`, `--accent-soft`, `--accent-chip`), adding `#8d8d8d` and chip/soft pairs to §7.1.
- Added `spinnerAccent` (>= 3.0:1 non-text contrast against `--bg` and `--panel`) for `--spinner-svg` / `--spinner-svg-reduced` in Spec §2, §7.1, §7.4.
- Fixed `viewer/index.html` active toolbar button `:hover` (`--accent-hover`/`--accent-hover-ink`) and inferred-edge detail (`var(--warn)` at `index.html:205-208`) in Spec §5.2 & §7.4.
- Removed `color-scheme: dark` from `body` in `app.css:29` and applied `color-scheme: light` to `html` and `body` in Spec §5.1 & §7.4.
- Added `pagehide` discard hook in Spec §4 & §7.3 so header navigation + browser Back (bfcache) clears unsaved theme previews.
- Recorded the rare-path malformed-theme revision-reset case in `## Accepted Risks`.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
