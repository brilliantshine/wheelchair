# Remediation 1 — finished-agent-decks

Verification attempt 1 ran on commit 6cee58287ada9954a0092cfa818f3472b26b4878. The Claude verifier (claude-opus-5-5) passed. The GPT verifier (gpt-6.2-sol) failed. The lead said fix all five and defer none. G2 widens the scope to one line in `machine/service.js` `forwardSession` plus its machine test.

## Gaps (verbatim from the GPT verifier)

GAP: Spec §1 round validation — The hub accepts JSON arrays as reviewer round numbers. An isolated API probe returned HTTP 200 and stored `round: 2` for `[2]`. A retry with `[[3]]` also returned HTTP 200 — `viewer/app/sessions.js:602` coerces the input before checking it.
GAP: Spec §1 refusal reason — An invalid `--round -1` produces `app-error` at the machine relay. The hub includes the flag-specific reason in `detail`, which the relay drops — isolated relay probe, `machine/service.js:1081`.
GAP: Spec §3 one-line title — “Plan review · 20 rounds, last round clean” takes two lines at 1280px in Chromium and Firefox — `viewer/pages/views.css:169` gives the deck the ordinary card’s three-line clamp.
GAP: Spec §3 stacked outlines — The offset dashed outlines paint across the top and left of the deck face — `viewer/pages/views.css:144–147` and the [Chromium screenshot](/tmp/wc-d268e3df9c50-verifier-2/deck.png).
GAP: Spec §5 phone popover — Clicking a visible deck near the bottom of a 390×844 viewport opens the entire popover below the screen. Both browsers placed its top at about 848px — `viewer/pages/agents.js:230` and the [browser probe](/tmp/wc-d268e3df9c50-verifier-2/deck-probe.log).

Numbered G1–G5 in that order.

## Tasks

The tasks go back to the provider that built each part. They are sharpened briefs, not bigger models (attempt 1).

| Task | Gaps | Provider / tier | Ownership |
|------|------|-----------------|-----------|
| R1 | G1, G2 | gpt, standard | `viewer/app/sessions.js`, `viewer/test/app-session-meta.test.js`, `machine/service.js` (forwardSession only), `machine/test/service.test.js` |
| R2 | G3, G4, G5 | claude, standard | `viewer/pages/agents.js`, `viewer/pages/views.css`, `viewer/test/app-agents-decks.spec.js` |

### R1 brief
## Remediation brief R1 — round validation and the refusal reason (gaps G1, G2)

Plan slug: finished-agent-decks. Task id: R1 (remediation of verification attempt 1). Lead session (for questions the plan does not settle): wc-d268e3df9c50-lead.

Context: `docs/plans/finished-agent-decks/PLAN.md` Spec §1 is binding. Gap list: `docs/plans/finished-agent-decks/REMEDIATION-1.md`.

### G1: refuse non-scalar round values
`viewer/app/sessions.js:602` tests `/^[0-9]+$/.test(String(payload.round))`, so the JSON array `[2]` (and `[[3]]`) passes and is stored as 2. Change the check so that only a JSON number that is an integer, or a string of decimal digits, is accepted. Arrays, objects, booleans and null are refused with the existing 400 message. Keep everything else on that line as it is: the reviewer-only rule, the safe-integer and >= 1 checks, and running before dedupe. Add cases `[2]`, `[[3]]`, `{}`, `true` and `null` to the existing test `viewer/test/app-session-meta.test.js:122`, calling the hub function directly with those payload values the way that test already does.

### G2: the hub's refusal reason must reach the caller
The viewer server answers a refused app route with `{ error: 'app-error', detail: <message> }` (`viewer/server.js:2111`, `fail()` at `:95`). `machine/service.js` `forwardSession` (about line 1079-1082) reads only `.error`, so `wc.js` prints `app-error` and the flag-specific reason is lost. Change that one place to use `detail` when it is a non-empty string, else `error`, else the existing generic reason. Change nothing else in `machine/`. Add a test to `machine/test/service.test.js` next to the existing 400 case at line 501. The fake hub `hubServer` (line 40) needs a way to answer a 400 with `{ error: 'app-error', detail: '--round requires a positive integer and is only allowed for reviewers' }`; add the smallest option for that. Assert that the rejected error's message equals the detail text.

### Ownership boundary
You own `viewer/app/sessions.js`, `viewer/test/app-session-meta.test.js`, `machine/service.js` (forwardSession only) and `machine/test/service.test.js`. Touch nothing else except your report at `docs/plans/finished-agent-decks/reports/R1.md`.

### Validation
```bash
node --test viewer/test/*.test.js
bash machine/test/run.sh
```

### Rules
- Never delete files with `rm` (or any other deletion command). If something must be removed, say so in your report instead.
- Never run `./install.sh`. Never start a viewer server by hand; tests use `viewer/test/helpers/server.js` (with `--port` and `--cache-root`).
- Commit with `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit -m "<msg>" --paths <path1>,<path2>` (comma-separated list; every path you changed, including your report).
- If the same gate fails twice, stop and report rather than iterating. Known intermittent tests on this machine, failing without this change too: `app-quiet.test.js` "6 message clears debt", the `app-uploads-archive.test.js` stalled-upload case, `app-threads.spec.js` phone "message box posts and shows queued", and any test whose server says "Refused to use a port held by a process it cannot identify". If only those fail, re-run that file alone and paste both outputs; that counts as passing.

### Deliverable
Committed code and tests, plus your report at the path above. The report must have what changed in each file, the pasted tail of every validation command (the summary lines with pass/fail counts, not just "exit 0"), and a closing section:

List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.

### R2 brief
## Remediation brief R2 — deck title, deck outlines, popover placement (gaps G3, G4, G5)

Plan slug: finished-agent-decks. Task id: R2 (remediation of verification attempt 1). Lead session (for questions the plan does not settle): wc-d268e3df9c50-lead.

Context: `docs/plans/finished-agent-decks/PLAN.md` Spec §3 and §5 are binding. Gap list: `docs/plans/finished-agent-decks/REMEDIATION-1.md`. The design screen is `docs/proposals/app-shell/design/AgentsFinishedDecks.dc.html` (a Design-canvas artboard; read its markup for how the deck's stacked outlines sit behind the card).

### G3: one-line deck title
The deck title is the `.agents-box-title` element built in `deckCard` (`viewer/pages/agents.js:183-191`). It inherits the 3-line clamp at `viewer/pages/views.css:169`, so "Plan review · 20 rounds, last round clean" wraps to two lines at 1280px. Make the deck's title exactly one line with an ellipsis. Set its `title` attribute (tooltip) to the full text, and include the full title in the deck button's accessible name. Do not change the ordinary box title.

### G4: stacked outlines behind the deck, never over its face
`viewer/pages/views.css:144-147` draws `::before`/`::after` with negative z-index inside `isolation: isolate`. The result is that the offset dashed outlines paint over the top and left of the deck face. Make the two offset outlines show only behind the card, offset down and right, with the card's own background fully opaque over them. Keep it CSS only. Test, in a Playwright case: the computed `background-color` of `.agents-deck` has alpha 1 (opaque); `getComputedStyle(deck, '::before')` and `'::after'` have positive x and y translate offsets; and a screenshot-free pixel check is not required. In your report, describe how you confirmed the outlines no longer show on the card face (for example a screenshot you looked at, saved under the scratch area and not committed).

### G5: popover stays inside the viewport
`placePop` (`viewer/pages/agents.js:230`) always puts the popover under the deck, so a deck near the bottom of a 390x844 screen opens it at top ≈ 848px, off screen. Placement rule: if the popover's height fits below the deck within the viewport (8px margin), keep it below. Otherwise, if it fits above, place it above. Otherwise, place it in whichever side has more room, with max-height set to that room and the popover scrolling inside. The whole popover box must always be within the viewport (8px margins) on phone and desktop. Test, at phone 390x844 and desktop 1280x800: scroll so a deck sits near the bottom of the viewport, open its popover, and assert its bounding box is fully inside the viewport. The existing cases in `viewer/test/app-agents-decks.spec.js` must still pass.

### Ownership boundary
You own `viewer/pages/agents.js`, `viewer/pages/views.css` and `viewer/test/app-agents-decks.spec.js`. Touch nothing else except your report at `docs/plans/finished-agent-decks/reports/R2.md`.

### Validation
```bash
npm --prefix viewer run test:browser
node --test viewer/test/*.test.js
```

### Rules
- Never delete files with `rm` (or any other deletion command). If something must be removed, say so in your report instead.
- Never run `./install.sh`. Never start a viewer server by hand; tests use `viewer/test/helpers/server.js` (with `--port` and `--cache-root`).
- Commit with `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit -m "<msg>" --paths <path1>,<path2>` (comma-separated list; every path you changed, including your report).
- If the same gate fails twice, stop and report rather than iterating. Known intermittent tests on this machine, failing without this change too: `app-quiet.test.js` "6 message clears debt", the `app-uploads-archive.test.js` stalled-upload case, `app-threads.spec.js` phone "message box posts and shows queued", and any test whose server says "Refused to use a port held by a process it cannot identify". If only those fail, re-run that file alone and paste both outputs; that counts as passing.

### Deliverable
Committed code and tests, plus your report at the path above. The report must have what changed in each file, the pasted tail of every validation command (the summary lines with pass/fail counts, not just "exit 0"), and a closing section:

List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.
