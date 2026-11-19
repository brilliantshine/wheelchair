# Remediation 3: finished-agent-decks

Verification attempt 3 ran on commit ca38d3588f375d3b8e5b7ba6941fae5f5387e8e9. The Claude verifier (claude-opus-5-5) passed with no gaps. The GPT verifier (gpt-6.2-sol) failed with two new gaps. Neither repeats an earlier gap. The lead's answer was to fix both as one small task.

## Gaps (verbatim)

GAP: Remediation 2 C, desktop tree connectors — At 1280×800 in Chromium and Firefox, the incoming connector lands 5px right of the deck’s center. On a deck with children, the outgoing connector starts 10px below the card face — The deck margins shift the card within its branch while the connectors still use the branch midpoint. See `viewer/pages/views.css:144` and `viewer/pages/views.css:179–185`.
GAP: Spec §2, finish times — The deck and popover still fall back to `ended_at` when `finished_at` is absent. The Spec makes `finished_at` the page’s sole source for finish times — `viewer/pages/agents.js:83`, used at `:188` and `:211`.

These are numbered D and E.

## Tasks

| Task | Gaps | Provider / tier | Ownership |
|------|------|-----------------|-----------|
| R4 | D, E | claude, light (the brief dictates every change) | `viewer/pages/agents.js:83`, `viewer/pages/views.css` `.agents-deck`, `viewer/test/app-agents-decks.spec.js` |

### R4 brief
## Remediation brief R4: deck connectors and finish-time source (verification attempt 3)

Plan slug: finished-agent-decks. Task id: R4 (remediation of verification attempt 3). Lead session (for questions the plan does not settle): wc-d268e3df9c50-lead.

Gap list: `docs/plans/finished-agent-decks/REMEDIATION-3.md`. Make exactly the changes below.

### D: connector lines must meet the deck card
In `viewer/pages/views.css`, the rule `.agents-deck { position: relative; margin: 0 10px 10px 0; background-color: var(--panel); }` becomes `.agents-deck { position: relative; background-color: var(--panel); }` (delete the margin, nothing else). The connectors (`.agents-children:before` and `.agents-children > .agents-branch:before`, around lines 179-182) aim at the branch's horizontal midpoint and its bottom. Without the margin, the card fills its branch, so they meet the card. The two offset outlines may overflow the card down and to the right; that is intended.

Test, in `viewer/test/app-agents-decks.spec.js`, at desktop 1280×800 only (`test.skip(label !== 'desktop')`, as the existing title case does). Use the existing "decked sub-leads share one deck of workers" data: two finished sub-leads with worker children under the lead, giving a sub-lead deck that has a child deck. Then:
- `getBoundingClientRect()` of the sub-lead `.agents-deck`, and of its branch's `::before` connector. Read the connector with `getComputedStyle(branch, '::before')`: left is 50% of the branch, and its bottom is the branch's top. Simpler: assert the deck's left/right equal its parent `.agents-branch`'s left/right (within 0.5px), so the card is centred where the connector lands.
- Assert the deck's bottom equals the top of its `.agents-children` list minus that list's `margin-top` (30px), within 0.5px, so the outgoing connector starts at the card's bottom edge.

### E: the page uses only `finished_at`
In `viewer/pages/agents.js:83`, `const finishedAt = n => n.finished_at || n.ended_at || '';` becomes `const finishedAt = n => n.finished_at || '';`. Nothing else changes, since the deck card and popover rows already show plain "Finished" when there is no time. Test: in the existing deck spec, add a finished worker pair where one member has `ended_at` but no `finished_at`. Assert that its popover row reads exactly "Finished" with no clock time. (The `node()` helper sets `finished_at`, so pass `{ finished_at: undefined, ended_at: '<iso>' }` in extra.)

### Ownership boundary
You own `viewer/pages/agents.js` (line 83 only), `viewer/pages/views.css` (the `.agents-deck` rule only) and `viewer/test/app-agents-decks.spec.js`. Touch nothing else except your report at `docs/plans/finished-agent-decks/reports/R4.md`.

### Validation
```bash
cd viewer && npx playwright test test/app-agents-decks.spec.js test/app-views.spec.js; cd ..
npm --prefix viewer run test:browser
```

### Rules
- Never delete files with `rm` or any other deletion command.
- Never run `./install.sh`. Never start a viewer server by hand. Tests use `viewer/test/helpers/server.js`.
- Commit with `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit -m "<msg>" --paths <path1>,<path2>` (a comma-separated list of every path you changed, your report included).
- If the same gate fails twice, stop and report rather than iterating. These tests fail intermittently on this machine without this change too, so if only they fail, re-run that file alone and paste both outputs:
  - `app-threads.spec.js` (:340, :401, :538)
  - `app-handoff.spec.js:205`
  - `browser.spec.js:2157`
  - `app-settings.spec.js:45`
  - `pages.spec.js:360`
  - any test whose server says "Refused to use a port held by a process it cannot identify"

### Deliverable
Committed code and tests, plus your report. The report must list what changed in each file and paste the summary lines of every validation command (pass, fail, skipped and did-not-run counts). Close it with this section:

List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.
