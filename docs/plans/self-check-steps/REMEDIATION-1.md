# Remediation 1 — self-check-steps

Verification attempt 1 on `23447663f1ecab6a0134748ef6ea98ebc8cdc0a5`: claude verifier PASS;
gpt verifier FAIL with four gaps (no duplicates between the two reports).

## Gaps, verbatim

GAP: Phone readability — a valid updater path extends off-screen at 390px — an isolated browser probe measured the path ending at x=1621 in Chromium and x=1498 in Firefox. The update text lacks the wrapping applied to step text (`viewer/pages/thread.js:839`, `viewer/pages/thread.css:342–348`).
GAP: Current-head buttons — the page shows Fix it now and Leave it when the matching Done card falls at the import cutoff — both browsers showed the buttons in an isolated fixture, while the hub refused Fix it now with 422 `a newer version was finished since` (`viewer/pages/thread.js:869`, `viewer/app/cards.js:51–53`).
GAP: One-line step notes — the validator accepts Unicode line and paragraph separators in `note` — direct calls to `validate` returned `ok: true` for notes containing U+2028 or U+2029 (`viewer/app/card.js:144–145`).
GAP: Planned-build steps verifier — the lead protocol gives conflicting instructions about whether the lead may start it — the session rules list only small fixes and fixes in done threads, while step 10 requires a steps-only verifier after planned builds too (`protocol/app/lead.md:67–69`, `protocol/app/lead.md:450–452`, `protocol/app/lead.md:479–484`).

## Tasks

| # | Gaps | Ownership | Lane |
|---|------|-----------|------|
| R1 | update wrapping; current-head buttons at the import cutoff | viewer/pages/thread.js, thread.css, viewer/test/app-check-card.spec.js | standard / claude (built T3) |
| R2 | one-line note rejects U+2028/U+2029 | viewer/app/card.js, viewer/test/app-check-card.test.js | light / gpt (built T1) |
| R3 | lead may start the steps-only verifier after every done | protocol/app/lead.md | light / claude (built T2) |

Briefs: below, as sent.


# R1 — check card: wrap the update text; hide buttons when the done card is at/before the import cutoff

Task id: R1. Tier: Standard. Remediation of verification attempt 1.

Two gaps a verifier found in the `check` card rendering (`case 'check'` in `viewer/pages/thread.js`, ~line 837):

1. **Update text overflows at 390px.** A long unbroken token in `update` (e.g. a path such as `/home/collin/projects/personal/wheelchair/some/very/long/path/without/spaces/...`, ~250 chars, or a long inline-code span in backticks) extends past the screen (page scrolls sideways). Fix in `viewer/pages/thread.css`: make the check card's update block (the `.md` div `prose` creates — give it a class such as `check-update` in thread.js) wrap anywhere: `overflow-wrap: anywhere; min-width: 0;` and make inline `code` inside it wrap too (`white-space: normal` / `overflow-wrap: anywhere`, `word-break: break-word`). Scope the CSS to `.card-check` only; do not change `.md` globally.
2. **Buttons at the import cutoff.** The hub's current done card (`viewer/app/cards.js:51-54` `currentDone`) excludes a done card whose `Date.parse(card.created_at || card.at)` is **not strictly after** `Date.parse(thread.imported.at)`. The page's current-done choice (`thread.js` ~line 869: last non-retracted `done` in `data.cards`) ignores the cutoff, so it shows Fix it now / Leave it the hub then refuses. Make the page apply the same rule exactly: last `done` card that is not retracted and, when `thread().imported && thread().imported.at` exists, has `Date.parse(c.created_at || c.at) > Date.parse(thread().imported.at)` (strict; do NOT reuse `sinceImport`, which is `>=`). No current done → no buttons.

Tests: extend `viewer/test/app-check-card.spec.js` (keep `startWorld`'s temporary state dir; never live state):
- a check card whose `update` contains a 250-char unbroken path and a long inline-code span: at 390px `document.documentElement.scrollWidth <= innerWidth + 1`.
- a thread with a done + check-with-broken-step whose done `created_at` equals `imported.at` (set `imported` via `ctx.patch`, e.g. `t.imported = { at: <the done card's created_at or at>, history: [] }` — check what other specs set on `imported`, e.g. grep `imported` in viewer/test/*.spec.js, and copy that shape): neither Fix it now nor Leave it is shown. Also one with the done strictly after the cutoff: buttons shown.

## Ownership boundary
`viewer/pages/thread.js` (the `check` case only), `viewer/pages/thread.css` (check-card rules only), `viewer/test/app-check-card.spec.js`, your report `docs/plans/self-check-steps/reports/R1.md`.

## Validation (paste output tails)
```bash
npm --prefix viewer run test:browser -- app-check-card.spec.js
npm --prefix viewer run test:browser
```

# R2 — check card: a step `note` must reject Unicode line/paragraph separators

Task id: R2. Tier: Light. Remediation of verification attempt 1.

Gap: `viewer/app/card.js` (the `check` field rules, ~line 144-145) enforces a one-line `note` with `!/[\r\n]/.test(step.note)`, so a note containing U+2028 or U+2029 is accepted.

Exact change:
1. In `viewer/app/card.js`, in the `check` steps rule, replace `/[\r\n]/` with `/[\r\n  \u0085]/` (that one regex only; nothing else in the file).
2. In `viewer/test/app-check-card.test.js`, in the first test's list of refused step changes (the array containing `{ agent: 'broken', note: 'x\ny' }`), add `{ agent: 'broken', note: 'x y' }` and `{ agent: 'broken', note: 'x y' }` right after it.

## Ownership boundary
`viewer/app/card.js` (that regex), `viewer/test/app-check-card.test.js`, your report `docs/plans/self-check-steps/reports/R2.md`.

## Validation (paste output tails)
```bash
node --test viewer/test/app-check-card.test.js
node --test viewer/test/*.test.js
```

# R3 — lead.md: the lead may start the steps-only verifier after any done

Task id: R3. Tier: Light. Remediation of verification attempt 1.

Gap: `protocol/app/lead.md:67-69` says the lead may start "a **verifier** (for a small fix, or for a fix you make in a done thread)", but step 10 (`### 10. Check it yourself`, ~line 448+) has the lead start a steps-only verifier after every accepted `done`, including a planned build. The two conflict.

Exact change: in `protocol/app/lead.md`, replace
`and a **verifier** (for a small fix, or for a fix you make in a
  done thread).`
with
`and a **verifier** (for a small fix, for a fix you make in a
  done thread, or a steps-only one after any `done`, step 10).`
keeping the bullet's line wrapping and indentation style (the next sentence "Never a worker: the sub-lead starts those." stays). Change nothing else.

## Ownership boundary
`protocol/app/lead.md` (that bullet only), your report `docs/plans/self-check-steps/reports/R3.md`.

## Validation (paste output)
```bash
grep -n "steps-only one after any" protocol/app/lead.md
node --test viewer/test/protocol-rules.test.js
git diff --stat origin/main -- protocol/app/sub-lead.md protocol/app/worker.md   # must print nothing
```
