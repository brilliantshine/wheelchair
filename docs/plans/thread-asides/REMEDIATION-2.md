# Remediation 2 — thread-asides

Verification attempt 2 (verifier `wc-54ce860aef63-verifier-2`, GPT, commit
`3fdc8a21128b812fb8bda1e91459a28518222961`): **FAIL**, one gap. All four Remediation 1 gaps
were checked and passed, so this is a new gap (its first fix attempt), not a surviving one.

## Gap list (verbatim)

```
GAP: Spec §5/§8 — Slow machine requests accumulate aside polls behind the shared thread lock, delaying Done and main-thread actions — viewer/app/hub.js:47 schedules every 2 seconds without awaiting prior pumps; viewer/app/asides.js:138 holds the thread lock during requests. With five-second timeouts, an isolated probe queued Done after 10.5 seconds; it waited another 16,522 ms behind five polls.
```

Sub-lead triage: confirmed. `pump` (`viewer/app/asides.js:138`) runs every aside's machine
GET/POST/ack inside `hub.withThread`, the lock every thread route uses; the timer
(`viewer/app/hub.js:47`) starts a pump every 2 s whether or not the last one finished; and the
aside routes await a pump before answering (`viewer/app/routes.js:350`). Each machine call
can take up to its 5 s timeout (`viewer/app/machine-client.js:64`).

## Task R2-1 — brief

Role: read /home/collin/projects/personal/wheelchair/protocol/app/worker.md and follow it (it points you at cards.md).
Plan slug: thread-asides. Task: R2-1. Lead session (for questions): wc-54ce860aef63-lead.

Read this file's gap and triage, PLAN.md Spec §5, then `viewer/app/asides.js` (all of it,
especially `run` and `pump`), `viewer/app/hub.js:40-90` (the timer and `withThread`),
`viewer/app/routes.js:333-352`, `viewer/app/threads.js:157-170`. Keep every behaviour §5
specifies; change only **when** the lock is held and **how many** pumps run.

**Ownership boundary:** `viewer/app/asides.js`, `viewer/app/hub.js` (timer line only),
`viewer/app/routes.js` (the aside block only), `viewer/test/app-asides.test.js`,
`docs/plans/thread-asides/reports/R2-1.md`. Nothing else. Never start a viewer server by hand
on the default port. Never run `./install.sh`. Never run `rm` or delete files.

**Decisions already made:**

1. **One pump per thread at a time.** A module-level map `threadId → in-flight promise`.
   `pump(hub, id)` called while one is in flight sets a "run again" flag for that thread and
   returns the in-flight promise, which runs one more pass before it resolves if the flag is
   set. `pump(hub, id, { fromTimer: true })` (the timer's call) returns at once without setting
   the flag when one is in flight. So at most one pump per thread is ever running, and the
   timer never queues work behind a slow one.
2. **No machine call while holding the thread lock.** Split each pass into three phases:
   - **Claim** (inside `hub.withThread`): read the thread; for each aside apply §5's dispatch
     rule (resolve the model; move the first `pending` message into `turn`, `state:
     "dispatching"`; save). For every aside with a `turn`, record a work item: aside id, turn
     id, turn state, and, for a `dispatching` turn, the full POST body built now (as `run`
     builds it today).
   - **Call** (no lock): for each item, `GET /v1/aside-turns/:id`; on 404 for a `dispatching`
     item, `POST` the recorded body; on 404 for a `running` item, the result is failed "the
     machine lost this turn"; other errors leave the item untouched until the next pass.
   - **Apply** (inside `hub.withThread`): re-read the thread; for each item whose aside still
     has `turn.id` equal to the item's turn id, apply exactly today's handling (POST accepted
     → `running`; `ok`/`failed` → history, step-up, graph save, failure rules, `turn = null`,
     save). An item whose turn id no longer matches (archived or replaced meanwhile) is
     discarded. Collect the turn ids whose results were saved.
   - Then, with no lock, send each collected `POST …/ack`. If any aside now has runnable
     `pending` (open, not failed, no turn), run another pass (the same loop as today's
     recursive `run`, but iterative and bounded by "something changed").
   Move today's result-handling body of `run` into a function used by Apply, unchanged in
   behaviour.
3. **Routes don't wait for a pump.** In `routes.js`, after an aside-changing route, start the
   pump without awaiting it (`asides.pump(hub, id).catch(() => {})`) and answer at once. Tests
   that depended on the route awaiting the pump call `await asides.pump(hub, id)` themselves;
   decision 1 makes that return after any in-flight pass and its rerun.
4. The timer in `hub.js` calls `pump(this, t.id, { fromTimer: true })`.
5. `threads.archive` is unchanged: it still DELETEs inside its own lock, and Apply discards
   results for the turns it cleared.

**Tests to add** (in `viewer/test/app-asides.test.js`, with a fake machine whose GET can be
held open by a promise the test controls):

- While a pump's machine GET is held open, `POST …/close {outcome:"done"}` answers 200
  without waiting for the GET to be released (assert the close response arrives first), and
  the aside is closed on disk.
- While a GET is held open, five timer-style calls (`pump(hub, id, {fromTimer:true})`) start
  no second machine call: the fake sees at most one concurrent request for that turn.
- A route-triggered `pump` during an in-flight pass causes exactly one more pass after it.
- A result for a turn the aside no longer holds (simulate: archive the thread while the GET is
  held, then release it with `state: "ok"`) is discarded: nothing added to history.
- Every existing aside test still passes (update only the ones that relied on the route
  awaiting the pump, by awaiting `asides.pump` explicitly).

**Validation.** First, once: `npm --prefix viewer ci` in your worktree.

```bash
node --test viewer/test/app-asides.test.js
node --test viewer/test/*.test.js        # unquoted glob
(cd viewer && npx playwright test test/app-asides.spec.js)
git status --short                       # only files in the boundary
```

Known baseline, not yours: `node --test` "a starter that loses the freed port registers
through the new holder" (`docs/known-issues.md`). Under heavy machine load a timing test can
fail; if one outside `app-asides` fails, re-run that file alone and paste both outputs. Every
other test must pass. Paste summary lines and every failure in your report. If the same gate
(excluding those) fails twice, stop and report rather than iterating.

List each decision you made that this brief did not settle, one line each, naming the file or
piece of the design it affected. Write 'none' if there were none.
