# Remediation 1 — thread-asides

Verification attempt 1 (verifier `wc-54ce860aef63-verifier`, GPT, commit
`5f55f763cf96f8362c69aded013cbdc7b804725f`): **FAIL**.

## Gap list (verbatim)

```
GAP: Spec §5 — Queued messages can remain stranded after a hub restart because polling selects only threads with an existing turn — viewer/app/hub.js:47; recovery probe left pending=1, turn=null and machineCalls=0 after two polls.
GAP: Spec §7 — The waiting-on line becomes stale when the main thread changes — viewer/pages/aside.js:26 and :93; browser probe showed the main card as "Answered" while the panel still said "Waiting on: Which option?".
GAP: Spec §5/§7 — Think harder remains enabled when Heavy is "Not used" — viewer/pages/aside.js:64; browser probe confirmed Heavy=null through the real Settings route and the button remained enabled.
GAP: Spec §2 — Opening an Ask aside does not focus its input — viewer/pages/aside.js:29 and :65; browser probe reported "Ask input focused: false".
```

Sub-lead triage: all four confirmed against the code. One task, R1-1, because gap 3 spans the
hub and the page and the four share files.

## Task R1-1 — brief

Role: read /home/collin/projects/personal/wheelchair/protocol/app/worker.md and follow it (it points you at cards.md).
Plan slug: thread-asides. Task: R1-1. Lead session (for questions): wc-54ce860aef63-lead.

Read this file's gap list, then PLAN.md Spec §2, §5 and §7, then `viewer/app/asides.js`,
`viewer/app/hub.js:40-50`, `viewer/app/routes.js:333-350` and `viewer/pages/aside.js`. The
design is accepted; make only the four fixes below, each with a test.

**Ownership boundary:** `viewer/app/asides.js`, `viewer/app/hub.js`, `viewer/app/routes.js`
(aside GET only), `viewer/pages/aside.js`, `viewer/test/app-asides.test.js`,
`viewer/test/app-asides.spec.js`, `viewer/app/API.md` (document `heavy_usable`),
`docs/plans/thread-asides/reports/R1-1.md`. Nothing else. Never start a viewer server by hand
on the default port; tests use `viewer/test/helpers/`. Never run `./install.sh`. Never run
`rm` or delete files.

**Fixes (decisions already made):**

1. **Stranded queue (§5).** Add and export `needsPump(thread)` in `asides.js`: true when the
   thread isn't archived and some aside has `turn` set, or is `status: "open"` with a non-empty
   `pending` and `failed` null. The Hub's 2-second timer (`hub.js:47`) pumps every thread for
   which `needsPump` is true (not only those with a `turn`). Test: a thread saved with an open
   aside whose `pending` holds one message, `turn: null`, `failed: null`, then a fresh `Hub`
   on the same state directory with a fake machine — after one timer tick (or calling the
   same selection the timer uses, then `pump`), the machine receives the POST. Also test that
   an aside with `failed` set is not selected.
2. **Stale waiting-on line (§7).** In `aside.js`, `WCAside.update` re-renders the open panel
   when what the panel shows from `/chat` changes: the waiting-on card (id, kind, label,
   answered) or the lead-working state. `renderPanel` already keeps the input's value; also
   keep its focus and the draft box. Spec test: with the panel open on a thread whose question
   card is open, mark the card answered in the next `/chat` response (route stub) → within one
   poll the panel no longer says "Waiting on: Which option?" and shows "Nothing is waiting on
   you" (or "The lead is working").
3. **Think harder when Heavy is "Not used" (§5/§7).** `GET /threads/:id/asides/:aside` adds
   `heavy_usable: true|false` to the record it returns, computed when served with the same
   `model(hub, provider, 'heavy')` helper (`null` → false). It is not stored. The page enables
   Think harder only when `heavy_usable === true` and §5's other conditions hold (undefined →
   disabled). Unit test: with `codex/model.sh` faked to exit 3 for `heavy`, GET returns
   `heavy_usable: false`; otherwise true. Spec test: a record with `heavy_usable: false` and an
   answered `ask` leaves Think harder disabled.
4. **Ask focus (§2).** When an `ask` aside is created (from the selection bar or "Ask about this
   message"), the panel's "Ask more about this" input receives focus as soon as the panel
   opens, and keeps it after the hub's answer re-renders the panel. Spec test: after pressing
   **Ask about this**, the input is `document.activeElement`. For `simpler`/`draw`, focus is
   not moved.

**Validation.** First, once: `npm --prefix viewer ci` in your worktree.

```bash
node --test viewer/test/app-asides.test.js
(cd viewer && npx playwright test test/app-asides.spec.js)
node --test viewer/test/*.test.js        # unquoted glob
npm --prefix viewer run test:browser
git status --short                       # only files in the boundary
```

Known baselines, not yours: `node --test` "a starter that loses the freed port registers
through the new holder" (`docs/known-issues.md`); browser "no drawn arrow's line passes through
either box it connects, over every committed graph" (fails on main, both browsers). Under
machine load the Firefox "approval: Start building" spec can time out; if it fails, re-run it
alone and paste both outputs. Every other test must pass. Paste summary lines and every
failure in your report. If the same gate (excluding those) fails twice, stop and report
rather than iterating.

List each decision you made that this brief did not settle, one line each, naming the file or
piece of the design it affected. Write 'none' if there were none.
