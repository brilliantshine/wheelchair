# Remediation 4: finished-agent-decks

Verification attempt 4 ran on commit 8f4a9e075a78829436ff073c8321de23771d5ee3. The Claude verifier (claude-opus-5-5) passed with no gaps. The GPT verifier (gpt-6.2-sol) failed with one gap and tied it to G5. G5 had already had two fix attempts, so the gap went to the lead and on to Collin (sub-lead.md step 6). The root cause is behaviour that predates this build: on a refresh, the page scroll is restored only when an agent is selected (`viewer/pages/agents.js:246`). Collin chose to fix it now, which changes the Agents page's refresh behaviour beyond decks (PLAN.md Decision 17).

## Gap (verbatim)

GAP: Spec §5 and Remediation 1 G5 — On a long tree at 390×844, the five-second refresh jumps the page to the top and leaves the open deck popover extending below the viewport — In Chromium and Firefox, a tree with 12 live workers and a 40-reviewer deck jumped from `scrollY=1219` to `0`. The deck moved below the screen and the popover’s bottom moved from y=663 to y=949. `viewer/pages/agents.js:136–137` captures the page scroll before rebuilding the tree, but `:246` restores it only when an agent is selected. `:234–242` then sizes the popover using the offscreen deck.

## Tasks

| Task | Gap | Provider / tier | Ownership |
|------|-----|-----------------|-----------|
| R5 | page scroll on refresh | claude, light (the brief dictates the change) | `viewer/pages/agents.js` (lines 6 and 246), `viewer/test/app-agents-decks.spec.js` |

### R5 brief
## Remediation brief R5: keep the page scroll across the Agents refresh (verification attempt 4)

Plan slug: finished-agent-decks. Task id: R5 (remediation of verification attempt 4). Lead session (for questions the plan does not settle): wc-d268e3df9c50-lead.

Gap: `docs/plans/finished-agent-decks/REMEDIATION-4.md`. Collin decided this (PLAN.md Decision 17). The Agents page restores its page scroll on every 5-second refresh, not only when an agent is selected, and an open deck popover is placed again against the restored deck position. Make exactly the changes below.

### Code change, `viewer/pages/agents.js` only
1. Line 6, the module-level `let data = ...` declaration: append `, lastLead = null` to the end of that declaration list.
2. Line 246 currently reads:
   `if (selected) { side.dataset.agent = selected.name; if (kept.agent === selected.name) { side.scrollTop = kept.side; scrollTo(scrollX, kept.page); } }`
   Replace it with these three statements on one line:
   `if (selected) { side.dataset.agent = selected.name; if (kept.agent === selected.name) side.scrollTop = kept.side; } if (lead.thread_id === lastLead && selected?.name === kept.agent) scrollTo(scrollX, kept.page); lastLead = lead.thread_id; placePopNow?.();`
   The page scroll is now restored whenever the refresh shows the same lead with the same selection, both with no agent selected and with the same agent selected as before. Switching lead or agent still starts at the top, as today. `placePopNow` then places any open popover against the deck's restored position.
Change nothing else.

### Test, `viewer/test/app-agents-decks.spec.js`, phone only (`test.skip(label !== 'phone')`)
Build a lead with 12 live workers (`node('lw'+i, 'worker', i, { live: true, state: 'working' })`) followed by a 40-reviewer deck: 40 finished reviewers, round 1..40, with `rounds.review` entries. Open the page with no `agent` parameter and show finished agents, using the existing `open` helper. Scroll the deck into view with `scrollIntoView({ block: 'center' })`, record `scrollY` (it must be greater than 0), click the deck, and record the popover's bounding box. Wait 5500 ms for one refresh. Assert:
- `scrollY` is within 2px of the recorded value;
- the popover is still open;
- the popover's bounding box is fully inside the viewport (8px margins, the same check as the existing "popover stays inside the viewport" case);
- its top is within 2px of the recorded top.

### Ownership boundary
You own `viewer/pages/agents.js` (the two edits above only) and `viewer/test/app-agents-decks.spec.js`. Touch nothing else except your report at `docs/plans/finished-agent-decks/reports/R5.md`.

### Validation
```bash
cd viewer && npx playwright test test/app-agents-decks.spec.js test/app-views.spec.js; cd ..
npm --prefix viewer run test:browser
```

### Rules
- Never delete files with `rm` or any other deletion command.
- Never run `./install.sh`. Never start a viewer server by hand. Tests use `viewer/test/helpers/server.js`.
- Commit with `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit -m "<msg>" --paths <path1>,<path2>`, where the comma-separated list is every path you changed, your report included.
- If the same gate fails twice, stop and report rather than iterating. These tests fail intermittently on this machine without this change too, so if only they fail, re-run that file alone and paste both outputs:
  - `app-threads.spec.js` (:340, :401, :538)
  - `app-handoff.spec.js` (:205, :227)
  - `browser.spec.js:2157`
  - `app-settings.spec.js:45`
  - `pages.spec.js:360`
  - any test whose server says "Refused to use a port held by a process it cannot identify"

### Deliverable
Committed code and test, plus your report. The report must list what changed in each file and paste the summary lines of every validation command, giving the pass, fail, skipped and did-not-run counts. Close it with this section:

List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.
