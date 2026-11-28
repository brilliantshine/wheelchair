---
slug: theme-options
date: 2026-11-28
implemented-by: standard / gpt-6.1-terra (T1), standard / claude-sonnet-5-5 (T2, T3), light / gpt-6-luna (T4)
verified-by:
  - round: 1
    lane: heavy / claude-opus-5-5
    checks: standard / gpt-6.1-terra (T1), standard / claude-sonnet-5-5 (T2, T3), light / gpt-6-luna (T4)
  - round: 1
    lane: heavy / gpt-6.2-sol
    checks: standard / gpt-6.1-terra (T1), standard / claude-sonnet-5-5 (T2, T3), light / gpt-6-luna (T4)
---

# Completion Report — Custom accent color and theme options

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|---|---|---|---|
| §1.1 Settings schema (`mode`, `preset`, `accent`, `revision`), strict `normalizeTheme`, malformed `theme` vs unparseable `settings.json` (500 without overwriting) | this run | `viewer/app/theme.js:1-52`, `viewer/app/settings.js:58,320` | `node --test viewer/test/theme.test.js`, `node --test viewer/test/app-settings.test.js` |
| §1.2 HTTP routes (`GET`/`PUT /wheelchair/api/settings/theme`), 4 KiB limit (413), revision check (409), idempotent no-op, `{ error }` JSON envelope, `Cache-Control: no-store`, `API.md` docs | this run | `viewer/app/routes.js:49`, `viewer/app/theme.js:12-52`, `viewer/app/API.md:239-243` | `node --test viewer/test/theme.test.js`, `node --test viewer/test/background.test.js` |
| §2 Shared palette & WCAG 2.1 contrast derivation: 6 presets (dark + light), semantic status tokens (light `--term-bg` = `--figure`), `QUICK_ACCENTS`, Default Dark pixel-identical special case, `pickContrastInk`, `--accent-hover`/`--accent-hover-ink`, `--accent-soft`/`--human` mix caps, `--accent-vis` (`>= 3.0:1`), `--accent-text`/`--accent-hi` (`>= 4.5:1`), `buildSpinnerUrls`, `resolveTheme`, `parseHexColor` | this run | `viewer/pages/theme-palette.js:1-297` | `node --test viewer/test/theme.test.js` |
| §3 Browser theme controller & synchronous pre-paint bootstrap on all 10 `viewer/pages/*.html` + `viewer/doc.html` (not `signin.html` or `index.html`); monotonic `acceptedRevision` gate; `localStorage` cache; `matchMedia`, `storage`, 10s visibility-gated polling, `focus`, `pageshow`, `wc-theme-change`, `window.wcTheme` API | this run | `viewer/pages/theme.js:1-52`, `viewer/pages/{agents,doc,features,file,new,picture,settings,terminal,thread,threads}.html:4-5`, `viewer/doc.html:4-5` | `npm --prefix viewer run test:browser -- test/theme-editor.spec.js test/theme-rendering.spec.js` |
| §4 Settings → You Theme editor (`theme-editor.js`), minimal `settings.js` wiring above `background` + `discard()` on leaving `You` & `pagehide`, `pageshow` repaint, 6-col desktop / 3-col `<=700px` responsive grid, all controls & 409/error/saving states | this run | `viewer/pages/theme-editor.js:1-204`, `viewer/pages/settings.js:12,2392,2787,2892`, `viewer/pages/settings.css:447-499`, `viewer/pages/settings.html:4-5,17` | `npm --prefix viewer run test:browser -- test/theme-editor.spec.js` (Chromium + Firefox) |
| §5.1 Main app stylesheet tokenization (`color-scheme`, `#app-nav .logo`, `:focus-visible` & 3 thread textareas, non-text `--accent-vis` marks incl. `settings.css`, light-mode Agents trail `0.75` opacity, filled button/FAB hover pairs incl. `.wc-asst-send:hover`, `.bubble.human .by-assistant` & `.wc-asst-tag` `var(--ink-2)`, `.spot-error` `var(--bad-text)`, raw `color: var(--accent)` → `var(--accent-text)`, `.spinner` `--spinner-svg*`, `#23303f` → `var(--human)`, `background.css` opaque surfaces) | this run | `viewer/pages/app.css:18,31-32,47,73,85,103-108,125,144,207-210`, `viewer/pages/assistant-popup.css:16-18,29-31,40,47-48,56,63,82`, `viewer/pages/thread.css:59,142,151,224,294,306,336,459,469,473,479`, `viewer/pages/views.css:94,151,169,237-243,250`, `viewer/pages/settings.css:21,202,217,462` | `npm --prefix viewer run test:browser -- test/theme-rendering.spec.js` (Chromium + Firefox) |
| §5.2 Standalone doc (`viewer/doc.html`) palette, links, error banner; `picture-export.js` reading graph PNG canvas background from dark graph iframe (graph viewer `viewer/index.html` left unthemed per Decision #13) | this run | `viewer/doc.html:4-5,14-16,49,70-71`, `viewer/pages/picture-export.js:37-42,56,80` | `npm --prefix viewer run test:browser -- test/theme-rendering.spec.js` (Chromium + Firefox) |
| §5.3 Embedded terminal dark lock (`#0c0e10`, `#e6e8ec`, `#d9a441` typing cursor) | this run | `viewer/pages/views.css:94`, `viewer/pages/term-view.js:84,169-170` | `npm --prefix viewer run test:browser -- test/theme-rendering.spec.js` (Chromium + Firefox) |
| §5.4 Agents activity colors reading computed CSS variables and refreshing on `wc-theme-change` | this run | `viewer/pages/agents.js:68-72,87,92,117` | `npm --prefix viewer run test:browser -- test/theme-rendering.spec.js` (Chromium + Firefox) |
| §5.5 Router & Firefox spec list upkeep (`viewer/AGENTS.md`, `viewer/test/firefox-specs.js`) | this run | `viewer/AGENTS.md:25,28-30`, `viewer/test/firefox-specs.js:13-14` | `npm --prefix viewer run test:browser -- browser.spec.js test/theme-editor.spec.js test/theme-rendering.spec.js` |

## Deviations from plan

None.

## Routers

- `viewer/AGENTS.md`: added file/role rows for `app/theme.js` (`:25`), `pages/theme-palette.js` (`:28`), `pages/theme.js` (`:29`), and `pages/theme-editor.js` (`:30`) beside the existing `background.js` rows without reformatting the rest of the router.

## Validation evidence

All Spec §7 targeted commands were run by the sub-lead against the built worktrees:

- `node --test viewer/test/theme.test.js` — 4/4 pass (exit 0)
- `node --test viewer/test/background.test.js viewer/test/app-settings.test.js machine/test/name-guard.test.js` — 32/32 pass (exit 0)
- `npm --prefix viewer run test:browser -- browser.spec.js test/theme-editor.spec.js test/theme-rendering.spec.js` — 184/184 pass across Chromium and Firefox (exit 0)
- `node --test machine/test/name-guard.test.js` — 2/2 pass (exit 0)

Build screenshots posted as `image` cards comparing against the three agreed mockups:
- Settings → You (desktop, 1280×900) vs `mockup-theme-settings-desktop.html`
- Settings → You (phone, 390×844) vs `mockup-theme-settings-phone.html`
- Thread page in Light mode with emerald custom accent (1280×900) vs `mockup-theme-thread-light.html`

## Known gaps / residual risks

- Graph viewer (`viewer/index.html`) and graph PNG export theming remain intentionally out of scope per Decision #13 (split into a follow-up thread); `picture-export.js` preserves dark canvas export from the dark graph iframe when Picture is in light mode.
- Accepted Risks from `PLAN.md`: (1) malformed on-disk `theme` resetting to revision 0 while a browser caches a higher revision (rare path, review-round-2); (2) transient queued-message bubbles at `opacity: 0.7` while sending (review-round-9).
- `viewer/signin.html` has no stylesheet and uses the browser's default unstyled page; `theme-rendering.spec.js` verifies no theme scripts or variables reach it.

## Remediation rounds

### Remediation 1 (`docs/plans/theme-options/REMEDIATION-1.md`, commit `354c2148`, `standard / claude-sonnet-5-5`)

Addressed all three genuine Attempt 1 verification gaps:
1. **`viewer/pages/views.css:119`:** Changed `.agents-entry.selected` `border-color` from `var(--accent-line)` to `var(--accent-vis)` so the selected Agents sidebar entry border clears `>= 3.0:1` non-text contrast against `--panel-3` and `--accent-soft` even with `#ffffff` / `#000000` accents in light and dark modes (also improves Default Dark border from `#3a5778` to `#5b9dd9`).
2. **`viewer/test/theme-rendering.spec.js:22-26`:** Guarded `test.afterEach` by navigating to `about:blank` before `page.unrouteAll({ behavior: 'ignoreErrors' })` (both with `.catch(() => {})`) to prevent Firefox's intermittent `NS_BINDING_ABORTED` teardown race when `seedThread`'s chat-polling route is mid-flight.
3. **`viewer/test/theme-rendering.spec.js:54-67`:** Made `textContrast` and the new `.agents-entry.selected` border contrast check poll and skip detached DOM nodes (`!n.isConnected`), preventing `NaN` contrast results when background polling replaces a node mid-read.

Validation after Remediation 1:
- `npm --prefix viewer run test:browser -- test/theme-rendering.spec.js` — 24/24 pass across Chromium and Firefox (3 consecutive runs by worker + 1 independent re-run by sub-lead, all exit 0).
- `node --test machine/test/name-guard.test.js` — 2/2 pass (exit 0).
