# Remediation 8 — thread-asides

Verification attempt 8 (verifier `wc-54ce860aef63-verifier-8`, GPT, commit
`c714088d93118a14845ac61fec1d96c57553e69b`): **FAIL**, one gap: the read-only-panel gap from
verification 7, surviving its first fix for the draft box. The lead approved fixing it once for
every control, with a browser test covering every one.

## Gap (verbatim)

```
GAP: Spec §5 archived panel read-only / Remediation 7 — An existing "This changes my answer" draft remains editable, with Send enabled, after archive. `viewer/pages/aside.js:61` applies no archive guard to these controls. `node /tmp/wc-v8-panel-probe.js` printed `mainDisabled:true,asideDisabled:true,draftDisabled:false,draftSendDisabled:false`; editing the draft after archive succeeded.
```

## Task R8-1 — brief

Role: read /home/collin/projects/personal/wheelchair/protocol/app/worker.md and follow it (it points you at cards.md).
Plan slug: thread-asides. Task: R8-1. Lead session (for questions): wc-54ce860aef63-lead.

Read this file, PLAN.md Spec §5 "Archiving" and §7, then `viewer/pages/aside.js` (all of it) and
`viewer/test/app-asides.spec.js`.

**Ownership boundary:** `viewer/pages/aside.js`, `viewer/test/app-asides.spec.js`,
`docs/plans/thread-asides/reports/R8-1.md`. Nothing else. Never start a viewer server by hand
on the default port. Never run `./install.sh`. Never run `rm` or delete files.

**Decisions already made:**

1. **One guard for every control that changes anything.** In `renderPanel`, compute
   `const readOnly = !!data.thread.archived;` once, and use it to set `disabled = true` on
   every control that changes something, in addition to their existing conditions:
   - the "Ask more about this" textarea and its Send;
   - the draft textarea ("Your changed answer") and its **Send** and **Cancel**;
   - **Think harder**, **Done, back to …**, **This changes my answer**;
   - **Retry**.
   Leave enabled: the close (×) and Back controls, the "Waiting on" link, the graph "Open full
   screen" link, and reading/scrolling. Remove any per-control `archived` checks this makes
   redundant, so `readOnly` is the one place.
2. **Starting new asides on an archived thread.** The routes refuse it (409), so also hide the
   selection bar and the "Ask about this message" controls when `data.thread.archived` is true
   (the bar never shows; `decorate` adds no "Ask about this message" buttons). Underlines and
   reopening a closed aside to read it still work.
3. Nothing in the hub changes.

**Test** (extend `viewer/test/app-asides.spec.js`): one test that opens the panel on an aside
whose record makes **every** control present: it has an answered `ask` entry and
`heavy_usable: true`, `slot: "standard"`, `cli_id` set, so Think harder, Done and This changes my
answer are enabled. Press This changes my answer, with the stubbed record then returning a
`control` entry, so the draft box with Send and Cancel appears. Then make the next `/chat` return
`thread.archived: true`. Within one poll, assert each of these is disabled: the main input, its
Send, the draft textarea, draft Send, draft Cancel, Think harder, Done, This changes my answer.
Assert the close control is still enabled. In a second step, stub the aside record with `failed`
set and assert Retry is disabled while archived. Finally, select text in a lead bubble and assert
the selection bar stays hidden and no "Ask about this message" button is present.

**Validation.** First, once: `npm --prefix viewer ci` in your worktree.

```bash
(cd viewer && npx playwright test test/app-asides.spec.js --repeat-each=3)
npm --prefix viewer run test:browser
node --test viewer/test/*.test.js               # unquoted glob
git status --short                              # only files in the boundary
```

Known baselines, not yours: `node --test` "a starter that loses the freed port registers through
the new holder" (`docs/known-issues.md`); browser "no drawn arrow's line passes through either
box it connects, over every committed graph" (fails on main, both browsers). If another test
fails, re-run its file alone and paste both outputs. If the same gate (excluding those) fails
twice, stop and report rather than iterating.

List each decision you made that this brief did not settle, one line each, naming the file or
piece of the design it affected. Write 'none' if there were none.
