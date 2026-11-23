# Remediation 1 — auto-merge

Verification attempt 1 at `768b036e`: Claude (claude-opus-5-5) and GPT (gpt-6.2-sol) verifiers, both FAIL.

## Gap list (verbatim)

GPT verifier:

> GAP: §3 Finishing — A held check adds a notice even when the thread already has a `merged` card for that PR. The stubbed run created a notice saying the PR was still open and made zero GitHub calls. `viewer/app/auto-merge.js:38–40` bypasses the existing-card guard at line 93.
> GAP: §3 Step 8 — A readiness response received after the retry deadline can still trigger a merge. With a 60 ms wait budget, a stub returned `UNKNOWN` and then `CLEAN` after the deadline. The hub sent the merge request and recorded `merged` after 175 ms. `viewer/app/auto-merge.js:54–74` checks the deadline only after handling the response.
> GAP: §1 Settings — Saving the switch says “Saved, applies to new sessions,” even though it takes effect for running threads. Chromium and Firefox both displayed that message after saving. `viewer/pages/settings.js:31`, `viewer/pages/settings.js:495–507`, `viewer/app/auto-merge.js:77`.

Claude verifier:

> GAP: §3 Finishing, "held" outcome — Rare path: a `held` result adds the "Not merged automatically" card even when the thread already has a `merged` card for this pull request. (… `viewer/app/auto-merge.js:38-40` adds the card with no check for an existing `merged` card (compare `:93`).)

## Judgment (sub-lead, realism.md)

1. Held notice despite a `merged` card (both verifiers; merged): **normal use**. Collin merging by hand during the finishing wait and a check with no matched step are each ordinary, and the card then wrongly says the PR is still open. → R1-a.
2. Ready response after the deadline still merges: **rare path**. It needs the last readiness call to straddle the deadline, and the response was ready anyway. Recorded in Accepted Risks (verification-1).
3. Settings "applies to new sessions" message: **normal use**. Every save shows wrong information. → R1-b.

## Tasks

### R1-a

Plan slug: `auto-merge`. Task id: R1-a (remediation of verification attempt 1). Spec §3 "Finishing".
Lead session: `wc-91de6c1c2eb1-lead`.

## The gap
A `held` outcome (gates 5–7) adds the "Not merged automatically" card even when the thread already has a `merged`
card for that pull request. Spec §3 says a held outcome is "recorded and noticed as in Finishing", and Finishing adds
no card when the thread already has a `merged` card for this PR (or a current done at a different head — impossible
at that point, since gate 2 just checked it).

## Ownership boundary
- `viewer/app/auto-merge.js`
- `viewer/test/app-auto-merge.test.js`
- report `docs/plans/auto-merge/reports/R1-a.md`

## Exact change
1. `viewer/app/auto-merge.js` lines ~38-40 (the `if (reason) {` branch): only call `notice(...)` when
   `!thread.cards.some(c => c.kind === 'merged' && c.pr_url === done.pr_url)`; the attempt record is still
   `{ at, outcome: 'held', reason }`, with `card: <id>` only when a card was added. Same condition the Finishing block
   uses at line ~93; do not change anything else.
2. `viewer/test/app-auto-merge.test.js`: add one test: a thread with the fixture's verified done, a check whose only step
   is `agent: 'not-tried'`, and a card `{ kind: 'merged', pr_url: url }` → after `f.run()`, attempt outcome is `held`,
   no card with `auto_merge`, no `gh` calls. Copy the style of the 'silent gates and held gates' test.

## Validation (paste output)
```bash
cd viewer && node --test test/app-auto-merge.test.js
cd viewer && node --test test/*.test.js
```
If the same gate fails twice, stop and report rather than iterating. Your own `wc.js` and `card.js` calls are always
allowed. Never delete files (no `rm`).

List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.

### R1-b

Plan slug: `auto-merge`. Task id: R1-b (remediation of verification attempt 1). Spec §1.
Lead session: `wc-91de6c1c2eb1-lead`.

## The gap
Saving the "Merge pull requests when done" switch shows "Saved, applies to new sessions" (`SAVED`,
`viewer/pages/settings.js:31`, set by `modeGroup` at ~line 507). That is untrue: the hub reads the setting each time a
check card is accepted, so it applies to running threads too (the help text says "It applies to pull requests checked
after it is turned on").

## Ownership boundary
- `viewer/pages/settings.js`
- `viewer/test/app-settings.spec.js`
- report `docs/plans/auto-merge/reports/R1-b.md`

## Exact change
1. `viewer/pages/settings.js` `modeGroup` (~line 495): add an optional fourth parameter `saved = SAVED` and use it in
   `setNote(saved, false)` instead of `setNote(SAVED, false)`. The `auto_merge` call (~line 594) passes
   `'Saved'`. Every other `modeGroup` call stays as it is.
2. `viewer/test/app-settings.spec.js`: add one test, copying the setup of an existing test in that file that clicks a
   `modeGroup` radio (search for `aside_access` or `Aside access` or `radiogroup`): click "On" in the radiogroup named
   "Merge pull requests when done", expect it `aria-checked="true"`, expect the page note to read exactly `Saved`
   (not "applies to new sessions"), reload, expect "On" still checked.

## Validation (paste output)
```bash
cd viewer && npx playwright test test/app-settings.spec.js --reporter=list
cd viewer && node --test test/*.test.js
```
Never start a viewer server by hand (the spec's own helpers start an isolated one). Your own `wc.js` and `card.js`
calls are always allowed. Never delete files (no `rm`).

List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.
