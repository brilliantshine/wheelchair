---
slug: thread-asides
date: 2026-11-15
implemented-by: "gpt standard (gpt-6.1-terra) for T1-T4, T1 attempt 2 at xhigh effort; gpt light (gpt-6-luna) for T5; sub-lead: claude (claude-opus-5-5)"
verified-by:
  - round: 1
    lane: gpt verifier (hub could not avoid gpt), FAIL
    checks: gpt standard (gpt-6.1-terra) build
  - round: 2
    lane: gpt verifier (hub could not avoid gpt), FAIL
    checks: gpt standard (gpt-6.1-terra) build + remediation 1
  - round: 3
    lane: gpt verifier (hub could not avoid gpt), FAIL
    checks: gpt standard (gpt-6.1-terra) build + remediations 1-2
---

# Completion Report — Asides

Written for a hostile reviewer: every claim checkable, no claim without evidence. Line
references are to the feature branch `wc/54ce860aef63` at the commit this report is committed
in. Base: `main` at `e440dec`.

## Spec coverage

Prior Work was empty, so every row is `this run`.

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| §1 Message ids: each lead assistant text item gets `id: "<session>#<n>"`, counted before the Tool-steps filter (hidden turns counted too) | this run | `viewer/app/chat.js:149`, `:167` | `viewer/test/app-asides.test.js` "assistant ids count hidden transcript text before filtering" |
| §2 Selection bar for a selection inside one lead bubble, none across bubbles; floats with `(pointer: fine)`, fixed above the composer otherwise | this run | `viewer/pages/aside.js:85-91` (`selected`), `:89` (pointer test); bubble ids `viewer/pages/thread.js:280` | `viewer/test/app-asides.spec.js` (in-bubble shows bar, cross-bubble hides it) |
| §2 "Ask about this message" on every lead bubble (hover with a mouse, always on touch) | this run | `viewer/pages/aside.js:77-80` (`decorate`); `viewer/pages/thread.css` "Asides" block (`.lead-aside-head`) | read in review; not exercised by a spec (see gaps) |
| §2 `POST /threads/:id/asides {message_id,start,end,quote,action}`; panel opens at once; `fork_parent` recorded | this run | page `viewer/pages/aside.js:30-35`; hub `viewer/app/asides.js:28-40`; route `viewer/app/routes.js:333` | spec checks the exact posted body; `app-asides.test.js` "routes anchor lead messages, …" |
| §2 First message with no `start` in history/pending/`turn.message` becomes `start`; `simpler`/`draw` queue `start` at once | this run | `viewer/app/asides.js:43-47`, `:39` | `app-asides.test.js` "aside turns fork, resume, …" |
| §3 Record fields (`id, number, anchor, action, created_at, provider, account, account_dir, fork_parent, cli_id, slot, status, pending, turn, history, failed, closed_at, outcome, sent_line`); `/chat` returns asides without `history` | this run | `viewer/app/asides.js:39`, `brief` at `:9`; `viewer/app/chat.js:227-228`; `viewer/app/threads.js:31` | `app-asides.test.js` "routes anchor …" (asides in `/chat` without history) |
| §4 Machine route `POST/GET/DELETE /v1/aside-turns`, `POST …/ack`; hub auth; idempotent POST; 404 for unknown | this run | `machine/service.js:821-827`; `machine/lib/aside-turns.js:51-61` | `machine/test/aside-turns.test.js` "hub authentication, validation and aside routes" |
| §4 Turn written before spawn, pid and start time after; kept until ack (30-day cap) | this run | `machine/lib/aside-turns.js:51-56`, `:76` (`onSpawn`), `:18-31` (`load`) | `aside-turns.test.js` "aside turns use isolated CLI commands and persist their outcomes" |
| §4 15-minute timeout → `failed` "took too long"; own process group | this run | `machine/lib/aside-turns.js:16`, `:77`, spawn `detached: true` in `run` (`:62-99`) | `aside-turns.test.js` (timeout case) |
| §4 Restart recovery: kill recorded group if start time matches, and any process with `WHEELCHAIR_ASIDE_TURN`; confirm gone; mark failed "the machine restarted" | this run | `machine/lib/aside-turns.js:9-14` (`proc`), `:18-31`; called before serving at `machine/service.js:160` | `aside-turns.test.js` "recovery kills matching and marker-only process groups before failing" and "recovery kills real detached groups, including a marker-only process" |
| §4 Environment: login env + `WHEELCHAIR_LANE=1` (+ turn marker), no other `WHEELCHAIR_*`; cwd = worktree | this run | `machine/lib/aside-turns.js:64-65` | `aside-turns.test.js` (fake CLI records env and cwd) |
| §4 + Decision 18 Claude argv: `-p --output-format json --model [--effort] --permission-mode dontAsk --tools Read,Grep,Glob --strict-mcp-config --system-prompt-snapshot off --append-system-prompt <aside prompt>` + fork/resume | this run | `machine/adapters/claude.js:9` | `aside-turns.test.js` (exact argv); real CLI: `reports/T1.md` |
| §4 + Decision 18 Codex argv: `exec -s read-only --json -m [effort] -c mcp_servers.<n>.enabled=false… --disable apps fork|resume <from> -`; servers from `codex mcp list --json`; preamble on fork only | this run | `machine/adapters/codex.js:9`; listing `machine/lib/aside-turns.js:79-86`; stdin `:87` | `aside-turns.test.js` (argv, preamble, mcp list failure); real CLI: `reports/T1.md` |
| §4 Reply/id/limit parsing for both CLIs | this run | `machine/lib/aside-turns.js:89-97` | `aside-turns.test.js` (parse, limit, failing CLI error line) |
| §4 Aside prompt `protocol/app/aside.md` (role, headers, ask/simpler/draw, step-up, control) | this run | `protocol/app/aside.md` (45 lines); pointer text `machine/lib/aside-turns.js:66-67` | read against §4 (T5 report) |
| §4 Prompts the hub sends, slot in every header | this run | `viewer/app/asides.js:21-27` | `app-asides.test.js` (prompt headers incl. `slot=heavy`) |
| §4 Provider/account/model from the latest live lead; slots "Not used" skipped; the two 409s | this run | `viewer/app/asides.js:11-17` (`model`), `:33-38` | `app-asides.test.js` (409 no ready lead, 409 no usable model) |
| §4 Conversation ids reach the hub from the listing and turn-ended events; machine lists `codex_thread_id` | this run | `viewer/app/sessions.js:340`, `:464`; `machine/service.js:741` | `app-asides.test.js` "routes anchor …" (event and listing copies); `aside-turns.test.js` (listing field) |
| §5 One rule: save `turn` as `dispatching` before POST; re-POST same id; 404 on dispatching → POST again; 2 s poll; ack after save | this run | `viewer/app/asides.js:83-135` (`run`), `:137` (`pump`); timer `viewer/app/hub.js:47` | `app-asides.test.js` "dispatching turns recover a lost POST with the same id", "aside turns fork, resume, save before ack, …" |
| §5 Fork `fork_parent` first, resume `cli_id` after | this run | `viewer/app/asides.js:105` (request body in `run`) | `app-asides.test.js` "aside turns fork, resume, …" |
| §5 Step-up: eligible → note + heavy + same message; ineligible → note when heavy off, one re-run with "Answer now…", second marker fails; never for control | this run | `viewer/app/asides.js:111-127`, `:26` | `app-asides.test.js` "step-up refusal retries once; controls never step up; graphs are saved" |
| §5 Failed → message back to front of `pending`, waits for Retry | this run | `viewer/app/asides.js:128-132`; retry `:59-60` | `app-asides.test.js` "aside turns fork, resume, save before ack, and retry failures" |
| §5 Closing clears pending/failed; running turn's reply still saved; late failure adds a note | this run | `viewer/app/asides.js:18-20` (`close`), `:130` | `app-asides.test.js` (close mid-turn keeps reply, starts nothing more) |
| §5 Reopening by typing | this run | `viewer/app/asides.js:44-47` | `app-asides.test.js` (reopen runs the typed message only) |
| §5 Think harder enabling rule | this run | `viewer/app/asides.js:61-64` | `app-asides.test.js` "Think harder repeats the last question …" and the success case in "routes anchor …" |
| §5 Archive closes asides, DELETEs running turns (404 tolerated), changing routes 409, GET still works | this run | `viewer/app/threads.js:160-167`; `viewer/app/routes.js:337` | `app-asides.test.js` "routes anchor …" (all six changing routes 409, GET 200, archive with a 404 DELETE) |
| §6 `wc-graph` block saved via the viewer's validated write to `<cache-root>/<repo-key>/asides/<id>-<n>.json`; registered; error → "Couldn't draw that: …"; re-registered on GET | this run | `viewer/app/asides.js:71-81`; `viewer/server.js:1578` (`writeGraph`, shared with `handleGraphPut`), `:2217` (`saveGraph`); re-register `viewer/app/routes.js:341-343` (aside GET) | `app-asides.test.js` "step-up refusal …; graphs are saved"; existing graph PUT tests unchanged and passing |
| §7 Panel: desktop side column replacing files; phone ≤899px full-screen sheet with Back | this run | `viewer/pages/aside.js:29` (`openAside`), `:16-20` (`closePanel`); `viewer/pages/thread.css:252-256`; `viewer/pages/thread.html` (`#aside-panel`) | `app-asides.spec.js` (390×844: `.col-side` box is 390×844, Back visible) |
| §7 Waiting-on line by the Needs-you rule; "The lead is working" / "Nothing is waiting on you" | this run | `viewer/pages/aside.js:15`, `:41-42` | `app-asides.spec.js` ("Waiting on: Which option?") |
| §7 Body: history without control, Markdown replies, notes, graphs embedded, "Thinking…", failed + Retry; input and Send | this run | `viewer/pages/aside.js:47-58`, `:65` | partly by spec (quote, panel); rest read in review (see gaps) |
| §7 Footer: Think harder, Done back to …, This changes my answer; 2 s polling while open | this run | `viewer/pages/aside.js:61-64`, `:29` (poll) | `app-asides.spec.js` ("Done, back to your question" posts `{outcome:"done"}`) |
| §8 Done closes and scrolls to the waiting card | this run | `viewer/pages/aside.js:64`, `:16-20` | `app-asides.spec.js` |
| §8 This changes my answer: `summary` → draft box → Send `close {outcome:"changed", line}` / Cancel; hub enqueues as `collin` with "(from aside n on: …)" | this run | page `viewer/pages/aside.js:59`, `:64`; hub `viewer/app/asides.js:48-58`, `:65-67` | `app-asides.test.js` (close "changed" enqueues to the lead as collin; summary 409 gates) |
| §8 `lead.md` line for "(from aside n on: …)" | this run | `protocol/app/lead.md:38-40` | read (T5 report) |
| §8 Handoff text in a human item becomes a link to aside n | this run | `viewer/pages/aside.js:82` | `app-asides.spec.js` (`.aside-handoff` opens the panel) |
| §9 Underlines re-applied after each chat rebuild; Decision 12 placement; newer wins overlaps; click reopens | this run | `viewer/pages/aside.js:72-81`, hook `viewer/pages/thread.js:672` | `app-asides.spec.js` (mark present after a rebuild; click reopens) |
| §9 "N asides" chip and list | this run | `viewer/pages/aside.js:67-70` | read in review (see gaps) |
| §10 Probe `machine/test/aside-probe.sh`, real CLIs, findings in `reports/T1.md` | this run | `machine/test/aside-probe.sh`, `machine/test/aside-probe-mcp.js`; `docs/plans/thread-asides/reports/T1.md` | run once per CLI (attempt 2); sub-lead read both fork transcripts ("Sub-lead verification" in T1.md) |

## Deviations from plan

- **Decision 18 (amended in the plan, approved by the lead):** Claude fork/resume pass
  `--system-prompt-snapshot off`; Codex fork/resume pass `--disable apps`. Without them T1
  showed the Claude aside ignoring the aside prompt and Codex keeping ChatGPT apps tools.
- **`style` in the aside-turn POST** (sub-lead decision, logged in PLAN.md, lead informed):
  snapshot off drops a Claude lead's recorded system prompt, which is where Collin's writing
  style lives. The hub sends the current rendered style (`viewer/app/asides.js`, request
  body in `run`); the machine appends it after the aside pointer
  (`machine/lib/aside-turns.js:66-67`).
- **`account_dir` on the record** (an addition to §3's list): the lead's own account folder is
  recorded at creation and sent on each turn, instead of being derived from the account id.
- **History `note` entries and `graph_error`**: step-up lines and late-failure notices are their
  own `{kind:"note"}` entries; a refused drawing sets `graph_error` on its entry. §5/§6 name
  the lines and the message; the field shapes were settled in the T3 brief.
- **Routes `…/retry`, `…/think-harder`, `…/summary`**: §5/§8 name the actions; the paths were
  settled in the T3 brief.
- **Probe check for Codex `command_execution` events**: the script still fails that check,
  because this Codex runs shell calls through a code-mode `exec` tool and emits no such event.
  Refusal was established from the transcript's tool-result events instead (T1.md, "Sub-lead
  verification").

## Routers

highways not installed; routers not maintained by highways. Updated by hand in the same
changes: `machine/AGENTS.md` (row for `lib/aside-turns.js`), `viewer/AGENTS.md` (rows for
`app/asides.js` and `pages/aside.js`), `protocol/app/AGENTS.md` (row for `aside.md`). Route
contracts: `machine/API.md` (aside-turn routes) and `viewer/app/API.md` (aside routes, `/chat`
`asides`).

## Validation evidence

Run by the sub-lead on the merged feature branch at `c181d06` (all five tasks merged):

```
== bash sensitivity/test/run.sh
exit=0
RESULT 64 passed, 0 failed
== bash seen/test/run.sh
exit=0
PASS every lane invocation in protocol/lanes.md carries WHEELCHAIR_LANE=1
== bash codex/test/run.sh
exit=0
RESULT 78 passed, 0 failed
== bash install/test/run.sh
exit=0
RESULT 90 passed, 0 failed
== bash machine/test/run.sh
# tests 89
# pass 89
# fail 0
== node --test viewer/test/*.test.js
# tests 347
# pass 347
# fail 0
== npm --prefix viewer run test:browser
  4 failed
    [chromium] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
    [firefox] › test/app-threads.spec.js:339:5 › phone › approval: Start building enabled when Ready and presses; offer press
    [firefox] › test/app-threads.spec.js:339:5 › desktop › approval: Start building enabled when Ready and presses; offer press
    [firefox] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
  2 skipped
  554 passed (3.9m)
```

The two `approval` failures came from machine load (other threads' sessions were running; the
suite took 3.9 min against 1.7 min on T4's branch). Re-run alone:

```
$ npx playwright test test/app-threads.spec.js -g "approval: Start building" --project=firefox --repeat-each=3
  6 passed (5.6s)
```

The `browser.spec.js:2395` graph spec fails the same way on `main` (`e440dec`), checked on
the canonical clone: `1 failed [chromium] › test/browser.spec.js:2395:1`. It isn't
in `docs/known-issues.md`; the lead has been told.

On T4's branch alone (before merge) the browser suite was `556 passed, 2 skipped, 2 failed`
(only the graph spec). The viewer unit suite's known flaky test ("a starter that loses the
freed port registers through the new holder", in `docs/known-issues.md`) passed in this
run and failed in earlier runs.

T1 real-CLI probe: `docs/plans/thread-asides/reports/T1.md`. Claude: every check PASS,
including the MCP positive control and the marker in both replies; the fork transcript has 0
`tool_use`. Codex: every check PASS except the absent `command_execution` event; the
transcript shows `exec_command … written-by-fork.txt` → exit 1 "Read-only file system" and
`apply_patch` → "writing is blocked by read-only sandbox".

## Known gaps / residual risks

- Page features read in review but not exercised by a browser spec: "Ask about this message",
  the asides chip and list, Think harder / This changes my answer / Retry in the panel, graph
  embedding in the panel, "Thinking…". The hub side of each is unit-tested.
- Codex usage-limit and Claude `rate_limit` detection in headless output are pattern matches
  (`machine/lib/aside-turns.js:91`, `:96`) that no real limit has exercised (T1 couldn't
  trigger one).
- Machine restart recovery throws, so the service won't start, if a recovered turn's processes
  survive SIGKILL for 5 s (`machine/lib/aside-turns.js:27`).
- Recovery reads `/proc` and so is Linux-only.
- The 30-day cap on unacknowledged turns is an Accepted Risk in PLAN.md.
- Nothing was run against a real running hub with real CLIs end to end; T1 proved the CLI
  commands and the suites prove each side against fakes.
- An abandoned worker branch `wc-54ce860aef63-w3` and its worktree remain (unmerged; two
  workers wrote it at once after a false "ended" notice). The service refuses to remove an
  unmerged worktree, and nothing in this build uses it.

## Remediation rounds

### Remediation 1 — 2026-11-15

Verification attempt 1 (GPT verifier, commit `5f55f76`) failed with four gaps; the gap list
and the brief are in `REMEDIATION-1.md`. One task, R1-1, built on GPT (standard,
gpt-6.1-terra), merged at `031dedc`.

| Gap | Fix (file:line) | Validated by |
|-----|-----------------|--------------|
| §5 queued messages stranded after a hub restart | `viewer/app/asides.js:137` (`needsPump`: a turn, or an open aside with pending and no failure); timer `viewer/app/hub.js:47` uses it | `viewer/test/app-asides.test.js` "a fresh hub selects stranded queued asides but not failed or archived ones" |
| §7 waiting-on line stale when the main thread changes | `viewer/pages/aside.js:95-96` (`panelChatSig`; `update` re-renders the open panel when the waiting card or lead state changes; input/draft value, focus and selection kept across renders) | `viewer/test/app-asides.spec.js` (card answered in the next `/chat` → panel stops saying "Waiting on: Which option?") |
| §5/§7 Think harder enabled with Heavy "Not used" | `viewer/app/routes.js:343` (GET adds computed `heavy_usable`, not stored); `viewer/pages/aside.js:66` (button requires `heavy_usable === true`) | `app-asides.test.js` "aside GET computes heavy usability from the model command without storing it"; spec (disabled with `heavy_usable: false`) |
| §2 Ask input not focused on opening | `viewer/pages/aside.js:29` (`openAside(a, focusInput)`), `:30-35` (`create` focuses for `ask` only, before and after the hub answers) | spec (input is `document.activeElement` after Ask about this) |

Worker choices: the provisional Ask input accepts typing before the hub answers (Send stays
disabled), so focus can land at once; the selection range is kept in both text boxes across
panel renders.

Validation, run by the sub-lead on the R1-1 branch (`418871c`):

```
$ (cd viewer && npx playwright test test/app-asides.spec.js --repeat-each=4)
  8 passed (10.3s)
$ node --test viewer/test/*.test.js
not ok 234 - a starter that loses the freed port registers through the new holder
# tests 349
# pass 348
# fail 1
$ npm --prefix viewer run test:browser
  4 failed
    [chromium] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
    [firefox] › test/app-threads.spec.js:339:5 › phone › approval: Start building enabled when Ready and presses; offer press
    [firefox] › test/app-threads.spec.js:339:5 › desktop › approval: Start building enabled when Ready and presses; offer press
    [firefox] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
  2 skipped
  554 passed (3.7m)
$ (cd viewer && npx playwright test test/app-threads.spec.js --project=firefox)
  54 passed (1.1m)
$ uptime
 load average: 10.47, 25.50, 29.69
```

The port test is the known one in `docs/known-issues.md`; the graph spec fails on `main`; the
Firefox approval spec fails only in full runs while the machine is heavily loaded (other
threads' sessions) and passes alone. On the merged branch (`031dedc`):
`node --test viewer/test/app-asides.test.js` → `# tests 8 # pass 8 # fail 0`. The worker's own
two failed focused runs were a test race (asserting `closed` before the request landed, then
a route fetch after the server closed); its final test edit (`expect.poll`) is what passed
8/8 above.

### Remediation 2 — 2026-11-15

Verification attempt 2 (GPT verifier, commit `3fdc8a2`) confirmed all four Remediation 1
fixes and failed on one new gap: aside polls held the thread lock during machine calls and
the timer started a pump every 2 s regardless, so with a slow machine Done waited 16.5 s
behind five polls. Gap and brief: `REMEDIATION-2.md`. One task, R2-1, built on GPT (standard,
gpt-6.1-terra), merged at `7087567`. Worker choices: none.

| Change | Where (file:line) |
|--------|-------------------|
| Claim under the lock: dispatch rule, POST body built, work items recorded | `viewer/app/asides.js:83-108` (`claim`) |
| Machine GET / POST with no lock held | `viewer/app/asides.js:110-118` (`call`) |
| Apply under the lock, only for turns the aside still holds; acks sent after the lock is released; repeat while newly runnable messages exist | `viewer/app/asides.js:120-145` (`applyResult`, today's handling unchanged), `:147-166` (`pass`) |
| One pump per thread; a route call during a pass gets one more pass; the timer skips when one is running | `viewer/app/asides.js:168-180` (`pumps`, `pump`); `viewer/app/hub.js:47` (`fromTimer: true`) |
| Aside routes answer without waiting for the pump | `viewer/app/routes.js:349` |

Validation, run by the sub-lead:

```
# R2-1 branch (79837b5)
$ node --test viewer/test/app-asides.test.js     (three runs)
# pass 9 # fail 0
# pass 9 # fail 0
# pass 9 # fail 0
$ node --test viewer/test/*.test.js
not ok 235 - a starter that loses the freed port registers through the new holder
# tests 350
# pass 349
# fail 1
$ (cd viewer && npx playwright test test/app-asides.spec.js --repeat-each=2)
  4 passed (7.3s)
# merged branch (7087567)
$ node --test viewer/test/app-asides.test.js
# pass 9 # fail 0
$ bash machine/test/run.sh
# pass 89 # fail 0
```

New test `viewer/test/app-asides.test.js` "slow machine calls leave routes free, coalesce
pumps, and discard archived results": with the machine GET held open, five timer pumps make
one GET (max concurrency 1); `close {outcome:"done"}` answers 200 within 1 s and the aside is
closed on disk; the route's pump causes exactly one more pass (2 GETs); a result released
after the thread is archived adds nothing to history. The port test is the known one.
