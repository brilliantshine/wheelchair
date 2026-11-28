# Remediation Round 1 — `theme-options`

Verified commit: `9c84be6df05d94e34a2d2c9ac99375e3c515c3c8`

## Verifier GAPs (verbatim)

### From `wc-11c53653de4e-verifier` (Claude, `claude-opus-5-5`)
- `GAP: §7.4 validation command (npm --prefix viewer run test:browser -- test/theme-rendering.spec.js) — The spec fails in Firefox on some runs, so the command doesn't reliably pass. In 3 runs at this commit it failed twice. Every failure comes from the teardown hook, not from a theme assertion: page.unrouteAll({ behavior: 'ignoreErrors' }) throws Protocol error (Network.setRequestInterception): ... NS_BINDING_ABORTED [nsIInterceptedChannel.resetInterceptionWithURI] at viewer/test/theme-rendering.spec.js:23. Each failing test is one that sets up a route through seedThread, which intercepts the chat polling at viewer/test/theme-rendering.spec.js:105.`

### From `wc-11c53653de4e-verifier-2` (GPT, `gpt-6.2-sol`)
- `GAP: Spec §5.1, non-text accent contrast — In Default Light with a white custom accent, the selected Agents sidebar border measures 1.09:1 against the sidebar and 1.20:1 against the button fill, below the required 3:1. It still uses --accent-line — viewer/pages/views.css:119`
- `GAP: Spec §7.4, rendering validation — Chromium’s lead-chip contrast assertion returned NaN during the prescribed run. The check passed on an isolated retry, so the failure establishes intermittent validation rather than a measured contrast defect. The spec file is absent at the comparison commit — viewer/test/theme-rendering.spec.js:165`
- `GAP: Desktop Settings mockup, 1280×900 — The Forest preview uses green page and panel surfaces where the approved mockup shows dark slate. The background controls also differ in grouping and labels` *(Not a defect — Spec §2 explicitly specifies Forest dark surfaces `#111c17`/`#17261f`, and Spec §4 leaves pre-existing Background controls untouched; Claude verifier confirmed mockup match.)*
- `GAP: Phone Settings mockup, 390×844 — The approved opening screen shows the entire Theme editor. The built screen starts with Your name and Writing style, and Theme requires scrolling. The scrolled editor also uses green surfaces where the mockup shows dark slate` *(Not a defect — Spec §4 explicitly places Theme right above Background below existing Name/Writing/Diagrams/Enter blocks, and Spec §2 specifies Forest green surfaces; Claude verifier confirmed mockup match.)*
- `GAP: Light Thread mockup, 1280×900 — The built question card adds a free-text answer and “Send answer” in place of the mockup’s “Choose small group” action. The built composer is also substantially taller` *(Not a defect — the Thread question card and composer layout are pre-existing untouched UI outside theme-options; Claude verifier confirmed mockup match.)*

## Remediation Task

### R1-1 — Fix Agents selected sidebar border contrast and stabilize `theme-rendering.spec.js`

- **Plan slug:** `theme-options`
- **Task ID:** `R1-1`
- **Lead session:** `wc-11c53653de4e-lead`
- **Ownership boundary:** `viewer/pages/views.css`, `viewer/test/theme-rendering.spec.js`
- **Lane:** `standard / claude-sonnet-5-5` (`--provider claude`, same provider that built T3)
- **Objective:**
  1. In `viewer/pages/views.css:119`, change `.agents-entry.selected` `border-color: var(--accent-line);` to `border-color: var(--accent-vis);` so the selected Agents sidebar entry border clears `>= 3.0:1` non-text contrast against `--panel-3` and `--accent-soft` even with `#ffffff` and `#000000` accents in light and dark modes (Spec §5.1).
  2. In `viewer/test/theme-rendering.spec.js:22-25`, make `test.afterEach` resilient to Firefox's `NS_BINDING_ABORTED` teardown race when `seedThread`'s polling route is mid-flight (e.g., navigate to `about:blank` or guard `page.unrouteAll({ behavior: 'ignoreErrors' })` with `.catch(() => {})` before `ctx.close()`). Verify by running `test/theme-rendering.spec.js` three consecutive times across Chromium + Firefox with 0 failures.
  3. In `viewer/test/theme-rendering.spec.js:54-58,163-166`, make `textContrast` / contrast assertions resilient to DOM nodes replaced mid-read by background polling (check `n.isConnected` and use `expect.poll` or retry when computed color is empty/disconnected so `textContrast` never returns `NaN` under load).
  4. Add an assertion in `viewer/test/theme-rendering.spec.js` verifying `.agents-entry.selected` border contrast is `>= 3.0:1` against `--panel-3` and `--accent-soft` in Default Light with `#ffffff` accent.
- **Validation commands:**
  - `npm --prefix viewer run test:browser -- test/theme-rendering.spec.js` (run 3 times in a row, all 24/24 passing in Chromium + Firefox)
  - `node --test machine/test/name-guard.test.js`
