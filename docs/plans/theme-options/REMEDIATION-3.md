# Remediation Round 3 — `theme-options`

Verified commit: `ce661e8fef85a5e6c054a29b0e78135a4874ec79`

## Verifier GAPs (verbatim)

### From `wc-11c53653de4e-verifier-5` (Claude, `claude-opus-5-5`)
- None (`VERDICT: PASS`).

### From `wc-11c53653de4e-verifier-6` (GPT, `gpt-6.2-sol`)
- `GAP: Spec §5.1, non-text accent contrast — Hovering the recommended answer in Thread overrides --accent-vis with --accent-line. In Default Light with a white accent, the border drops from 5.10:1 to 1.20:1 against the card, below the required 3:1 — viewer/pages/thread.css:138`
- `GAP: Spec §7.2, browser regression validation — The prescribed browser.spec.js command exited 1 with 119 passes and three isolated-server startup timeouts. The startup errors did not reproduce on the comparison commit` *(Infrastructure: `/tmp` tmpfs was 99–100% full at 14G from concurrent runs across worktrees; `wc-11c53653de4e-verifier-5` passed `browser.spec.js` 122/122 on the same commit using disk-backed `TMPDIR`.)*

## Remediation Task

### R3-1 — Keep `--accent-vis` on hovered Thread options (and sent-file hover) + regression test

- **Plan slug:** `theme-options`
- **Task ID:** `R3-1`
- **Lead session:** `wc-11c53653de4e-lead`
- **Ownership boundary:** `viewer/pages/thread.css`, `viewer/test/theme-rendering.spec.js`
- **Lane:** `standard / claude-sonnet-5-5` (`--provider claude`, same provider that built T3)
- **Objective:**
  1. In `viewer/pages/thread.css:138`, change `.opt:hover:not(:disabled) { border-color: var(--accent-line); }` to `border-color: var(--accent-vis);` (and likewise `a.sent-file:hover` at `viewer/pages/thread.css:348` to `border-color: var(--accent-vis);`) so hovering `.opt.lean` or `.opt` never overrides `--accent-vis` with low-contrast `--accent-line` in Default Light with a `#ffffff` accent.
  2. In `viewer/test/theme-rendering.spec.js`, add a regression assertion that hovering `.opt.lean` in Default Light with `#ffffff` accent keeps its border contrast `>= 3.0:1` against `--panel` and `--accent-soft` (verified to fail when `:138` is `--accent-line` and pass with `--accent-vis`).
- **Validation commands:**
  - `npm --prefix viewer run test:browser -- test/theme-rendering.spec.js`
  - `node --test machine/test/name-guard.test.js`
