---
slug: agents-activity
attempt: 1
---

# Remediation 1

## Gaps (verbatim from the verifier)

VERDICT: FAIL
GAP: §7 Tree amber question path (and IDEA "path … drawn in amber in the tree") — with real hub data the amber path is never drawn. The hub puts `question_paths` on the lead's tree node, but the page reads it from the lead record. — `viewer/app/agents.js:73` sets `root.question_paths`, and the lead record built at `viewer/app/agents.js:116` has no such field. `viewer/pages/agents.js:98` loops over `lead.question_paths || []`. With a worker asking the lead and an open lead `question` card carrying `passes_on`, `buildAgents` gives `record.question_paths = undefined ; record.session.question_paths = [["wc-a-worker","wc-a-lead"]]`. That means no amber edge, no overlay and no legend. The browser test (`viewer/test/app-views.spec.js:181`) only passes because its mocked payload puts `question_paths` on the record, a shape the API never sends.
GAP: §7 question trail wording — real API trails end with the lead's own question card, and the page renders that hop as the lead passing the question to itself. — `viewer/pages/agents.js:42`: when the hop is the last one, `to` falls back to the lead, so the line reads "<Lead> passed it to <Lead>: …". For the common case (a worker asks the lead directly), I ran the real `buildAgents` output through the page's `questionPanel` and it printed: `Asked Lead at 06:23` / `Lead passed it to Lead: Which port should the worker use?` / `Lead is asking you in the thread`. Both the Spec and `AgentsTree.dc.html` show only the real hops, followed by "Beta is asking you in the thread". The browser test misses this because its mocked trail has no lead hop. `viewer/test/app-questions.test.js:41` shows the real API trail is `['worker','lead']`.
GAP: §2 Codex turn end and §2 Transport (spool → drain) — if a Codex turn-complete notice gets spooled, for example because it fired while the machine service was down, the event spool deadlocks for good. — The drain handles the unprepared event by calling `hook()` (`machine/service.js:863`). That calls `readCodexSteps` (`:892`), which calls `emitEvent`, and `emitEvent` waits on `drainSpool('events')`. That returns the drain already in progress (`:849`), which is itself waiting on `hook()`. My repro (`/tmp/claude-1000/-home-collin--local-state-wheelchair-worktrees-wheelchair-wc-eb5a9e5941a0-verifier/5ff2957f-7ffc-4a4d-a876-fe80f61118db/scratchpad/deadlock.js`) used a bound Codex session with one unread rollout line, a spooled `turn-ended` and a live fake hub. It printed `TIMEOUT after 5s hub received: [] spool left: [2 files]`. The same setup with an empty rollout printed `drained hub received: [ 'turn-ended' ]`. Once stuck, every later machine event waits behind it, Claude's included, and so does every 2-second Codex read. The step offset is never saved, so it hangs again after each restart.

Notes (not counted as gaps, fixed anyway):
- The turn-end flush reads at most one 8 MiB chunk, not "to the end of the file".
- A lead message delivered mid-turn (`viewer/app/sessions.js:485`) leaves the earlier turn in `session.turns` with no end time. A tool start arriving late after the next turn ends could then match that open turn and stay running instead of closing.


## Tasks

One task per gap, grouped by ownership (gaps 1, 2 and the open-turn note share viewer files; gap 3 and the flush note are machine-only). Both route to gpt, the provider that built this work.

---

# Task R1 (remediation 1) — question path reaches the screen with real API data; trail wording; open turns

## Gaps to close (verifier, attempt 1)
1. With real hub data the amber path is never drawn: `viewer/app/agents.js:73` sets `root.question_paths` on the lead's **tree node**, but the page (`viewer/pages/agents.js:98`) reads `lead.question_paths` from the **lead record** (built at `viewer/app/agents.js:116`), which never has it. The browser test passes only because its mock puts `question_paths` on the record.
2. Real trails end with the lead's own question-card hop, and `questionPanel` (`viewer/pages/agents.js:39-44`) renders it as "<Lead> passed it to <Lead>: …". For a worker asking the lead directly, real output is "Asked Lead at 06:23 / Lead passed it to Lead: … / Lead is asking you in the thread"; the Spec and `AgentsTree.dc.html` show only real hops, then "<Lead> is asking you in the thread".
3. (Verifier note, fix too) A message delivered mid-turn (`viewer/app/sessions.js` `deliver` with `midTurn`, ~line 485) calls `beginTurn` while the previous turn in `session.turns` has no `ended_at`, leaving an open turn that a late step start can match and stay running.

## Settled fixes
1. **One place for the paths: the lead record.** In `viewer/app/agents.js`, put `question_paths` on the lead record returned by `buildAgents` (the object with `thread_id`, `lead_name`, `session`, …) and remove it from the root tree node. Update `viewer/app/API.md` to say so. The page keeps reading `lead.question_paths`.
2. **Trail wording.** In `questionPanel`: line 1 "Asked <describe(q.to)> at HH:MM". Then one line per hop strictly between the asker's own entry and the final lead-card entry: for trail entry i (not the first, not one whose `who` is the lead session), "<Describe(who)> passed it to <describe(next who)>: <text>". Identify the asker by the selected node's name (pass it in), not by object identity. Then, when `card_id` is set, "<lead name> is asking you in the thread" and the Go to the question link (unchanged). A worker asking the lead directly therefore shows just the first line and the "asking you" line.
3. **Open turns.** In `beginTurn` (`viewer/app/sessions.js`), when the last kept turn has no `ended_at` and a new turn starts at a later time, set that turn's `ended_at` to the new turn's start before pushing the new one. Add a test in `viewer/test/app-activity.test.js`: mid-turn delivery, then a late start dated inside the first turn is stored finished at that turn's end.
4. **Contract test across hub and page.** Add a browser test in `viewer/test/app-views.spec.js` whose `/api/agents` payload is produced by the real `buildAgents` from `viewer/app/agents.js` (require it in the spec, build a thread with a lead, a sub-lead, a worker, an `asks: true` message from the worker to the lead, and an open lead `question` card with `passes_on`), not hand-written. Assert: the amber `question-path` class on the worker and lead boxes, the legend visible, and the panel text for the worker is exactly the two lines above (no "passed it to" line). Add a second case where the worker asks the sub-lead, the sub-lead asks the lead with `passes_on`, and the lead's card has `passes_on`: expect one "The sub-lead passed it to <lead name>: …" line. Fix the existing hand-written mock in the old test to the real shape (record-level `question_paths`).

## Ownership boundary
`viewer/app/agents.js`, `viewer/app/sessions.js` (`beginTurn` only), `viewer/pages/agents.js`, `viewer/app/API.md`, `viewer/test/app-views.spec.js`, `viewer/test/app-activity.test.js`, `viewer/test/app-questions.test.js`, `docs/plans/agents-activity/reports/R1.md`.

## Validation
```bash
node --test viewer/test/*.test.js
npm --prefix viewer run test:browser
```

## Rules for every task in this build

- Your role file: /home/collin/projects/personal/wheelchair/protocol/app/worker.md — read it first. Plan slug: `agents-activity`. This is remediation for verification attempt 1: `docs/plans/agents-activity/REMEDIATION-1.md`. The plan is `docs/plans/agents-activity/PLAN.md` (read the **Spec** section in full, and IDEA.md and MAP.md beside it). The lead's session is `wc-eb5a9e5941a0-lead`; questions the plan does not settle go to the lead with a `message` card (`asks: true` is not available yet; send a plain message).
- Work only inside your ownership boundary below. If you find you must change a file outside it, stop and message the lead rather than editing it.
- **Never delete files** (no `rm`, `git rm`, `git clean`, no unlinking in scripts outside temp dirs your tests create). Leave cleanup to Collin.
- Never run `./install.sh`. Never start a viewer server by hand on the default port; the test suites start their own. If you must start one, use `--port <free port>` and `--cache-root <a temp dir>` as the root AGENTS.md says.
- No tmux commands against real sessions. Your own `wc.js` and `card.js` calls are always allowed (port 7374 is fine for them).
- Commit with `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit -m "<msg>" --paths <exact paths...>`.
- If the same validation gate fails twice, stop and report rather than iterating.
- Write your report to `docs/plans/agents-activity/reports/<task id>.md` on your branch and commit it. It must contain **pasted output** of every validation command you ran (the tail with pass/fail counts at least), the list of files changed, and a final section:
  "List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none."
- Finish with a `result` card (`task` = your task id, `outcome`, `summary`, `report`, `commit`).

---

# Task R2 (remediation 1) — spooled Codex turn end deadlocks the event spool

## Gap (verifier, attempt 1)
If a Codex turn-complete notify is spooled (e.g. the machine service was down when it fired), the event spool deadlocks permanently: `drainSpoolNow` handles the unprepared event by calling `hook()` (`machine/service.js:863`), which calls `readCodexSteps` (`:892`), which calls `emitEvent`, which awaits `drainSpool('events')` — and that returns the drain already running (`:849`), which is waiting on `hook()`. Every later machine event (Claude's too) and every 2 s Codex read waits behind it, and the steps offset is never saved, so it hangs again after a restart. Repro script (read it, adapt it into a test): `/tmp/claude-1000/-home-collin--local-state-wheelchair-worktrees-wheelchair-wc-eb5a9e5941a0/7e70a3e7-2e01-4742-965d-e97311e52c14/scratchpad/deadlock.js` — with a bound Codex session, one unread rollout line and a spooled `turn-ended`, it prints `TIMEOUT after 5s hub received: [] spool left: [2 files]`.

Also (verifier note, fix too): the turn-end flush reads at most one 8 MiB chunk, not "to the end of the file" as Spec §2 requires.

## Settled fix
- Give `readCodexSteps` an option so it can write its events to the spool **without** draining (spool only, via `this.spool('events', …)`), and use that option whenever it runs inside `hook()` with `spooled: true`. Never await `drainSpool` from code that the drain itself can call.
- Ordering: the hub orders by the CLI-side times (Spec §4), so step events spooled during a drain may be posted after that `turn-ended`; that is acceptable. Make sure they are posted by the next drain (the existing spool timer is enough; don't add recursion).
- Non-spooled turn end (the live hook path) keeps today's behaviour: steps emitted before `turn-ended`.
- Turn-end flush: loop `readCodexSteps`'s bounded reads until the offset reaches the file size measured at the start of the flush (the 2 s timer keeps its single bounded read).

## Tests (`machine/test/service.test.js`)
- The repro as a test: spooled Codex `turn-ended` with unread rollout lines and a live fake hub → the drain finishes within a few seconds, the hub receives `turn-ended` and the step events (any order), the spool ends empty, and `steps_offset` is persisted.
- A Claude event spooled behind it is also delivered.
- Turn-end flush over a rollout larger than one chunk (use a small chunk size made injectable for the test, e.g. a constructor option or env var read once) consumes the whole file before `turn-ended`.

## Ownership boundary
`machine/service.js`, `machine/test/service.test.js`, `machine/API.md` (only if the documented flush behaviour changes), `docs/plans/agents-activity/reports/R2.md`.

## Validation
```bash
bash machine/test/run.sh
```

## Rules for every task in this build

- Your role file: /home/collin/projects/personal/wheelchair/protocol/app/worker.md — read it first. Plan slug: `agents-activity`. This is remediation for verification attempt 1: `docs/plans/agents-activity/REMEDIATION-1.md`. The plan is `docs/plans/agents-activity/PLAN.md` (read the **Spec** section in full, and IDEA.md and MAP.md beside it). The lead's session is `wc-eb5a9e5941a0-lead`; questions the plan does not settle go to the lead with a `message` card (`asks: true` is not available yet; send a plain message).
- Work only inside your ownership boundary below. If you find you must change a file outside it, stop and message the lead rather than editing it.
- **Never delete files** (no `rm`, `git rm`, `git clean`, no unlinking in scripts outside temp dirs your tests create). Leave cleanup to Collin.
- Never run `./install.sh`. Never start a viewer server by hand on the default port; the test suites start their own. If you must start one, use `--port <free port>` and `--cache-root <a temp dir>` as the root AGENTS.md says.
- No tmux commands against real sessions. Your own `wc.js` and `card.js` calls are always allowed (port 7374 is fine for them).
- Commit with `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit -m "<msg>" --paths <exact paths...>`.
- If the same validation gate fails twice, stop and report rather than iterating.
- Write your report to `docs/plans/agents-activity/reports/<task id>.md` on your branch and commit it. It must contain **pasted output** of every validation command you ran (the tail with pass/fail counts at least), the list of files changed, and a final section:
  "List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none."
- Finish with a `result` card (`task` = your task id, `outcome`, `summary`, `report`, `commit`).
