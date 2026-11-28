# Remediation Round 2 — `theme-options`

Verified commit: `c6adebc013518833d52a38e4baf5c3b6cac0802e`

## Verifier GAPs (verbatim)

### From `wc-11c53653de4e-verifier-3` (Claude, `claude-opus-5-5`)
- None (`VERDICT: PASS`).

### From `wc-11c53653de4e-verifier-4` (GPT, `gpt-6.2-sol`)
- `GAP: Spec §5.1, non-text accent contrast — The connector between events in a Thread timeline uses --accent-line and measures 1.01:1 against the card surface in Default Light with a white (#ffffff) accent. The spec requires 3:1 — viewer/pages/thread.css:335`

## Remediation Task

### R2-1 — Switch Thread timeline connector to `--accent-vis` and add regression check

- **Plan slug:** `theme-options`
- **Task ID:** `R2-1`
- **Lead session:** `wc-11c53653de4e-lead`
- **Ownership boundary:** `viewer/pages/thread.css`, `viewer/test/theme-rendering.spec.js`
- **Lane:** `standard / claude-sonnet-5-5` (`--provider claude`, same provider that built T3)
- **Objective:**
  1. In `viewer/pages/thread.css:335`, change `.form-event { border-left: 2px solid var(--accent-line); ... }` to `border-left: 2px solid var(--accent-vis);` so the timeline connector matches `.form-event::before` (`:336`) and clears `>= 3.0:1` non-text contrast against `--panel` even with `#ffffff` and `#000000` accents in light and dark modes.
  2. In `viewer/test/theme-rendering.spec.js`, add a regression assertion checking that `.form-event`'s left border clears `>= 3.0:1` contrast against `--panel` in Default Light with `#ffffff` accent (verified to fail against `--accent-line` and pass with `--accent-vis`).
- **Validation commands:**
  - `npm --prefix viewer run test:browser -- test/theme-rendering.spec.js`
  - `node --test machine/test/name-guard.test.js`
