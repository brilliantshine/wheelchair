# Remediation 2: finished-agent-decks

Verification attempt 2 ran on commit 151b5c285bed8b929249c88d82745cba41507ced, and both verifiers (claude-opus-5-5, gpt-6.2-sol) reported FAIL. Combining their duplicates leaves two distinct gaps. Both are remediation-1 gaps that came back, so this is their **second** fix attempt; if either survives it, it goes to the lead as a plan defect. The lead said to fix both and defer neither. The lead also folded in a wider deck card so the example title isn't cut off at 1280px.

## Gaps (verbatim)

From the GPT verifier:

GAP: Spec §3 stacked outlines (G4) — Both offset outlines disappear at 390×844 in Chromium and Firefox. The phone deck looks like a single card — `viewer/pages/views.css:147` puts both outlines at negative z-indices, and the phone layout lacks the desktop tree’s stacking context.
GAP: Spec §5 popover scrolling (G5) — After “Show all 20 rounds,” scrolling the capped popover snaps back to the top in both browsers at phone and desktop widths — `viewer/pages/agents.js:44` handles the popover’s own scroll event, and `:233` removes the height cap during measurement. The probe recorded `scrollTop` changing from 250 to 0.

From the Claude verifier:

GAP: Spec §5 "Show all N rounds" expands in place / Remediation G5 "max-height set to that room and the popover scrolling inside" — a deck popover taller than the screen can't be scrolled, so the older rows can't be reached. `viewer/pages/agents.js:44` listens for every scroll event on the page, the popover's own included, and calls `placePop`. `placePop` sets `box.style.maxHeight = 'none'` (`viewer/pages/agents.js:233`) to measure the popover, and that puts its scroll back to 0. (The full probe evidence is in the verifier's result.)

Merged:
- **A**: the popover can't be scrolled (G5 again; both verifiers).
- **B**: the outlines vanish on phone (G4 again; GPT verifier).
- **C** (the lead's decision, not a verifier gap): the deck card widens to at most about 280px, so "Plan review · 20 rounds, last round clean" fits at 1280px.

## Tasks

| Task | Gaps | Provider / tier | Ownership |
|------|------|-----------------|-----------|
| R3 | A, B, C | claude, standard | `viewer/pages/agents.js`, `viewer/pages/views.css`, `viewer/test/app-agents-decks.spec.js` |

### R3 brief
## Remediation brief R3: popover scrolling, deck outlines on phone, wider deck title (verification attempt 2)

Plan slug: finished-agent-decks. Task id: R3 (remediation of verification attempt 2). Lead session (for questions the plan does not settle): wc-d268e3df9c50-lead.

Context: `docs/plans/finished-agent-decks/PLAN.md` Spec §3 and §5 are binding. Gap list: `docs/plans/finished-agent-decks/REMEDIATION-2.md`. Earlier fixes, which must keep working: REMEDIATION-1.md G3–G5 and the existing cases in `viewer/test/app-agents-decks.spec.js`. This is the **second** fix attempt for A and B. Make the fix match the cause described here, and prove it with the tests named below.

### A: the popover must scroll (found by both verifiers)
Cause: `viewer/pages/agents.js:44` calls `placePopNow` for every scroll event on the page, the popover's own included (`capture: true`). `placePop` (around `:230-243`) sets `box.style.maxHeight = 'none'` to measure, which resets the popover's `scrollTop` to 0. A capped popover therefore snaps back to the top on wheel or touch scroll.
Fix, all three parts:
1. In the scroll listener, ignore events whose target is the `.deck-pop` element or inside it.
2. In `placePop`, measure the popover's natural height without clearing `maxHeight`: use `box.scrollHeight + (box.offsetHeight - box.clientHeight)`. Never write `maxHeight = 'none'`. Save `scrollTop` before changing styles and restore it after.
3. `redrawPop` rebuilds the popover on every 5-second poll, and that would also reset the scroll. When it rebuilds the popover for the same deck (same remembered member), carry the old box's `scrollTop` over to the new box after placing it.
Test, in `viewer/test/app-agents-decks.spec.js`, at phone 390×844 and desktop 1280×800:
- Build a 20-round reviewer deck, open it, and press "Show all 20 rounds". Assert the popover is capped (`scrollHeight > clientHeight`).
- Hover the popover and scroll with `page.mouse.wheel(0, 300)`. Assert `scrollTop > 0`, and that it is still greater than 0 after two animation frames.
- Wait for one poll (about 5.5 s), and assert `scrollTop` is still greater than 0 and the popover is still open.
- Scroll to the bottom and click the "Round 1" row (a real click, not a dispatched one). Assert its agents are listed.

### B: the stacked outlines must show on phone (found by the GPT verifier)
Cause: R2 removed `isolation: isolate` from `.agents-deck`. On the phone layout the outlines' negative z-index (`viewer/pages/views.css` `.agents-deck::before/::after`) now paints behind an ancestor's background, so the deck looks like a single card at 390×844.
Fix: give the deck's own branch wrapper a stacking context, so the outlines no longer depend on any ancestor. In `branch()` (`viewer/pages/agents.js`, where `item.deck` builds the card), add the class `agents-deck-branch` to that `wrap`, and add `.agents-deck-branch { isolation: isolate; }` to views.css. Keep the deck button opaque, with no `isolation` on the button, and keep the pseudo-element outlines with negative z-index. In that stacking context they paint above the wrapper's transparent background and below the button's positioned face. Do not add any element between the card and its wrapper: `drawQuestionPaths` relies on `box.parentElement.parentElement` being the children list.
Test, at phone and desktop sizes: take a `page.screenshot({ clip })` of a 4×4 px area 2px inside the outer outline's offset strip (just past the deck's right edge, about 7–9px right of it and 30px down from its top). Take another of an equally sized empty area of the tree background nearby. Assert the two images differ (the outline is painted). Keep the existing opacity and offset case.

### C: the full example title fits at 1280px (lead's decision)
Deck cards may be wider than ordinary boxes. On desktop (min-width 900px), set `.agents-deck { width: max-content; min-width: 190px; max-width: 280px; }`. If "Plan review · 20 rounds, last round clean" still doesn't fit at the page's font, raise the max to the smallest width that fits it, no more than 300px, and say which value you chose in the report. Longer titles keep the one-line ellipsis and the tooltip. On phone the deck stays full width, as `.agents-box` is today. Ordinary boxes are unchanged. Check that the tree connectors still meet the deck's centre (existing layout cases in `viewer/test/app-views.spec.js` must pass).
Test at 1280×800: a 20-round reviewer deck whose last round is clean shows the title "Plan review · 20 rounds, last round clean". Assert the title element's `scrollWidth <= clientWidth`, meaning it is not truncated.

### Ownership boundary
You own `viewer/pages/agents.js`, `viewer/pages/views.css` and `viewer/test/app-agents-decks.spec.js`. Touch nothing else except your report at `docs/plans/finished-agent-decks/reports/R3.md`.

### Validation
```bash
npx --prefix viewer playwright test --config viewer/playwright.config.js viewer/test/app-agents-decks.spec.js   # or: cd viewer && npx playwright test test/app-agents-decks.spec.js
npm --prefix viewer run test:browser
node --test viewer/test/*.test.js
```

### Rules
- Never delete files with `rm` or any other deletion command. If something must be removed, say so in your report instead.
- Never run `./install.sh`. Never start a viewer server by hand. Tests use `viewer/test/helpers/server.js`.
- Commit with `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit -m "<msg>" --paths <path1>,<path2>` (a comma-separated list of every path you changed, your report included).
- If the same gate fails twice, stop and report rather than iterating. These tests fail intermittently on this machine without this change too:
  - `app-quiet.test.js` "6 message clears debt"
  - the `app-uploads-archive.test.js` stalled-upload case
  - `routes.test.js` remember-cookie case
  - `app-handoff.spec.js:205`
  - `app-threads.spec.js` phone "message box posts and shows queued"
  - `browser.spec.js:2157`
  - `app-settings.spec.js:45`
  - any test whose server says "Refused to use a port held by a process it cannot identify"

  If only those fail, re-run that file alone and paste both outputs; that counts as passing.

### Deliverable
Committed code and tests, plus your report. The report must have what changed in each file, and the pasted summary lines of every validation command (pass/fail/skipped/did-not-run counts, not just "exit 0"). It also needs a closing section:

List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.
