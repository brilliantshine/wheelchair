# Remediation 5: finished-agent-decks

Verification attempt 5 ran on commit 55abd18d10187aa283698345939082b8c5be257a. The Claude verifier (claude-opus-5-5) passed with no gaps. The GPT verifier (gpt-6.2-sol) failed with two gaps, both popover gaps that had already had two or more fix attempts (G5; Remediation 2 A). They went to the lead and on to Collin, who chose one more fix together with an invariant test across layouts (PLAN.md Decision 18).

## Gaps (verbatim)

GAP: Spec §5 and Remediation 2 A, popover scroll across refresh — On a 390×844 long tree with no agent selected, a five-second poll preserved the page scroll at 1230px but reset the expanded 40-round popover from `scrollTop=250` to `0` in Chromium and Firefox — `viewer/pages/agents.js:228` restores the popover scroll before `:246` restores the page and repositions the popover.
GAP: Spec §5 and Remediation 1 G5, popover viewport bounds — When a newly finished reviewer moved the open deck below the fold, the expanded popover extended to y=902 in an 844px viewport in both browsers — `viewer/pages/agents.js:234–242` calculates available space from the offscreen deck and leaves the popover taller than the viewport.

## Tasks

| Task | Gaps | Provider / tier | Ownership |
|------|------|-----------------|-----------|
| R6 | both, with the invariant test | claude, standard | `viewer/pages/agents.js` (lines 6, 228, 230-243, 246), `viewer/test/app-agents-decks.spec.js` |

### R6 brief
## Remediation brief R6: popover invariant across refreshes (verification attempt 5)

Plan slug: finished-agent-decks. Task id: R6 (remediation of verification attempt 5). Lead session (for questions the plan does not settle): wc-d268e3df9c50-lead.

Gaps: `docs/plans/finished-agent-decks/REMEDIATION-5.md`. Collin's decision is PLAN.md Decision 18: one more fix, held in place by an invariant test. **The invariant:** after any refresh, an open deck popover is fully inside the viewport (8px margins) and keeps its `scrollTop`. This is the last fix attempt for these gaps, so make exactly the code change below and build the test exactly as described.

### Code change, `viewer/pages/agents.js` only

1. Line 6, the module-level `let` list: append `, popTop = null`.

2. Line 228, the end of `redrawPop`, currently reads:
   `document.body.append(box); placePop(); if (prev && prev.member === pop.member && prev.top) box.scrollTop = prev.top;`
   Replace it with:
   `document.body.append(box); popTop = prev && prev.member === pop.member ? prev.top : null; placePop(popTop);`

3. Replace the whole `placePop` function (lines 230-243) with:
```js
    const placePop = (want) => {
      const box = document.querySelector('.deck-pop'), hit = box && deckNow.find(d => d.members.some(m => m.name === pop?.member)); if (!hit) return;
      const r = hit.card.getBoundingClientRect(), w = Math.min(360, innerWidth - 16), M = 8, GAP = 6, maxH = Math.max(40, innerHeight - 2 * M);
      box.style.width = `${w}px`; box.style.left = `${Math.max(M, Math.min(r.left, innerWidth - w - M))}px`;
      const saved = want ?? box.scrollTop, h = Math.min(maxH, box.scrollHeight + (box.offsetHeight - box.clientHeight));
      // Room actually visible on each side of the deck; never more than the viewport, never negative.
      const below = Math.max(0, innerHeight - M - Math.max(r.bottom + GAP, M)), above = Math.max(0, Math.min(r.top - GAP, innerHeight - M) - M);
      let height = h, top;
      if (h <= below) top = r.bottom + GAP;
      else if (h <= above) top = Math.min(r.top - GAP, innerHeight - M) - h;
      else if (Math.max(below, above) >= 160) { height = Math.max(below, above); top = below >= above ? r.bottom + GAP : Math.min(r.top - GAP, innerHeight - M) - height; }
      else top = M;
      top = Math.max(M, Math.min(top, innerHeight - M - height));
      box.style.maxHeight = `${height}px`; box.style.top = `${top}px`; box.scrollTop = saved;
    };
```

4. Line 246, at its end: replace `placePopNow?.();` with `placePopNow?.(popTop); popTop = null;`.
   Leave the scroll/resize listeners that call `placePopNow?.()` with no argument as they are. With no argument, `placePop` keeps the box's current scroll.

Change nothing else in the file.

### Test, `viewer/test/app-agents-decks.spec.js`: the invariant

Add one `test.describe('popover invariant across a refresh')` inside the existing per-viewport loop, so it runs at phone 390×844 and desktop 1280×800, in Chromium and Firefox. Each scenario below is its own `test`. Use a mutable data closure, as the existing "a poll adding a member…" case does.

- **Base data:** a 40-reviewer deck, rounds 1..40 (one reviewer per round, `rounds.review` entries with `found: 1`).
- **Setup in every scenario:** open with no agent selected and finished agents shown (the `open` helper). Bring the deck on screen (`scrollIntoView({ block: 'center' })`), click it, press "Show all 40 rounds", then set the popover's `scrollTop` to 250. Read it back and record it; it must be greater than 0.
- **Wait for a refresh:** change the data if the scenario says so. Wait for the next `/api/agents` response (`page.waitForResponse`, timeout 8000), then wait two animation frames.
- **Assert in every scenario:**
  - the popover is open;
  - its bounding box is inside the viewport with 8px margins (0.5px slack);
  - its `scrollTop` is within 2px of the recorded value.

Scenarios:
1. **Deck on screen, page not scrolled:** only the base data.
2. **Page scrolled:** 12 live workers (`{ live: true, state: 'working' }`) created before the deck, so the page must scroll to bring the deck into view. Also assert `scrollY > 0` before the refresh.
3. **Deck pushed off screen by a new finished member:** the scenario 2 data. Before the refresh, add 12 more live workers created before the deck, plus one more finished reviewer as round 41 with a `rounds.review` entry. Also assert the deck's bounding box is now at least partly outside the viewport (top > viewport height, or bottom > viewport height). The invariant must still hold.
4. **Expanded round, long popover:** the base data. Before setting `scrollTop`, also expand Round 40 by clicking its row, then continue as in the setup.

Keep all existing cases. If one conflicts with the new placement rule, change only its expectation, and say so in the report.

### Ownership boundary
You own `viewer/pages/agents.js` (the four edits above) and `viewer/test/app-agents-decks.spec.js`. Touch nothing else except your report at `docs/plans/finished-agent-decks/reports/R6.md`.

### Validation
```bash
cd viewer && npx playwright test test/app-agents-decks.spec.js test/app-views.spec.js; cd ..
npm --prefix viewer run test:browser
```
Before committing, also show that the new tests catch the bugs. Temporarily put the old `agents.js` in place with `git show HEAD:viewer/pages/agents.js > viewer/pages/agents.js`, run only the new describe block, and paste which scenarios fail. Then restore your version (`git checkout` is not usable if you have not committed, so save your version to a scratch file first and copy it back). Confirm `git diff` shows only your intended edits.

### Rules
- Never delete files with `rm` or any other deletion command.
- Never run `./install.sh`. Never start a viewer server by hand. Tests use `viewer/test/helpers/server.js`.
- Commit with `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit -m "<msg>" --paths <path1>,<path2>`, listing every path you changed (your report included), comma-separated.
- If the same gate fails twice, stop and report rather than iterating. Other sessions' test suites may load this machine heavily.
- These tests fail intermittently on this machine without this change too:
  - `app-threads.spec.js`, any case
  - `app-handoff.spec.js` (:205, :227)
  - `browser.spec.js` (:875, :2157)
  - `app-settings.spec.js` (:45, :61)
  - `pages.spec.js:360`
  - any test whose server says "Refused to use a port held by a process it cannot identify"

  If only these fail, re-run that file alone and paste both outputs.

### Deliverable
Committed code and tests, plus your report. The report must include:
- what changed in each file;
- the old-code failure list;
- the summary lines of every validation command (pass, fail, skipped and did-not-run counts);
- a closing section, in the form below.

List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.
