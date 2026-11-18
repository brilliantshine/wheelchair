---
slug: plan-handoffs
date: 2026-11-17
implemented-by: "standard (gpt / gpt-6.1-terra) for T1-T7; T1 and T2 second attempts at effort xhigh; T5 asked for claude, placed on gpt by the hub (sub-lead: claude-opus-5-5)"
verified-by: []   # Stage 4 appends; Stage 3 leaves this empty.
---

# Completion Report — Plan handoffs: export and import a thread

Written for a hostile reviewer: every claim checkable, no claim without evidence.
Line numbers are at commit `21db739` on `wc/80b0be8f90fe`. Every item is `this run`; Prior
Work was empty.

## Spec coverage

| # | Spec item | Origin | Implemented at (file:line) | Validated by |
|---|-----------|--------|----------------------------|--------------|
| 1 | Export points: quiet test (hub part: sessions, deliverable queues, asides, sudo, uploads) | this run | `viewer/app/handoff.js:91-99`; upload counter `viewer/app/routes.js:99`, `:118-120` | `viewer/test/app-handoff.test.js:66`, `:224`, `:262` |
| 2 | Three points: idea-confirmed (MAP.md, answered-question anchor), approved, done (open PR, HEAD equals remote tip) | this run | `viewer/app/handoff.js:105-117`, `:122`, `:127`; machine statuses `machine/service.js:1277-1282`, `:1386-1398` | `viewer/test/app-handoff.test.js:66`, `:330`, `:350`; `machine/test/service.test.js:1448` |
| 3 | Reasons table, first match wins; disabled reason from hub state and last status read | this run | `viewer/app/handoff.js:84`, `:118-130`; `viewer/app/hub.js:216-240` | `viewer/test/app-handoff.test.js:66`; `viewer/test/app-handoff.spec.js:147` |
| 4 | The file: fields, patterns, unknown fields refused, 10 MB, validator | this run | `viewer/app/handoff.js:4`, `:12-32` | `viewer/test/app-handoff.test.js:9`, `:294` |
| 5 | History entries, `historyText`, cutting and trimming, omission entry | this run | `viewer/app/handoff.js:34-48`, `:55-82` | `viewer/test/app-handoff.test.js:22`, `:37` |
| 6 | Download filename | this run | `viewer/app/handoff.js:50-53` | `viewer/test/app-handoff.test.js:37`; `viewer/test/app-handoff.spec.js:19` |
| 7 | Claims: `commit-tree` with nonce, `--force-with-lease` push on the exact parent | this run | `viewer/app/handoff-ops.js:49-71`; `machine/service.js:1284-1312` | `viewer/test/app-handoff-ops.test.js:14`, `:187`; `machine/test/service.test.js:1490` |
| 8 | Export route steps 1-6 (check, build and validate, push exact sha, `.new`/save/rename with re-read, stop sessions, 200 attachment) | this run | `viewer/app/routes.js:458-462`; `viewer/app/handoff.js:131-195` | `viewer/test/app-handoff.test.js:147`, `:161`, `:181`, `:308` |
| 9 | Thread page Export button, reason line, confirm, download | this run | `viewer/pages/thread.js:162-197`; `viewer/pages/thread.html:25` | `viewer/test/app-handoff.spec.js:19`, `:147` |
| 10 | Frozen threads: every entry point, enqueue drop, `canDeliver`, both `Continue.` paths, archive only while unfinished | this run | `viewer/app/handoff.js:84-90`; `viewer/app/routes.js:96`, `:465-467`, `:511-514`, `:578-580`; `viewer/app/threads.js:107-109`, `:123-125`, `:195-197`, `:307-309`, `:377-379`; `viewer/app/cards.js:52-53`; `viewer/app/sessions.js:213-214`, `:415-417`, `:436-437`, `:525-531`, `:779-782`; `viewer/app/hub.js:148` | `viewer/test/app-handoff.test.js:94`; `viewer/test/app-handoff-ops.test.js:166`; `viewer/test/app-handoff.spec.js:173` |
| 11 | Handed-off banner: `GET /threads/:id/handoff` (60 s cache, no machine call under the lock) and page states | this run | `viewer/app/routes.js:452`; `viewer/app/hub.js:192-213`; `viewer/app/handoff.js:234-251`; `viewer/pages/thread.js:205-216`, `:1028-1032` | `viewer/test/app-handoff.test.js:194`, `:276`; `viewer/test/app-handoff.spec.js:35`, `:158` |
| 12 | Download again (under the thread lock, copy matching `handed_off.head`, `.json.new` rename) | this run | `viewer/app/routes.js:453-457`; `viewer/app/handoff.js:197-217`; `viewer/pages/thread.js:216`, `:224` | `viewer/test/app-handoff.test.js:205`, `:216`; `viewer/test/app-handoff.spec.js:35` |
| 13 | `handoffs/` start-up sweep and `.json.new` recovery | this run | `viewer/app/hub.js:56`; `viewer/app/handoff.js:218-233` | `viewer/test/app-handoff.test.js:205` |
| 14 | Threads list "handed off" label | this run | `viewer/pages/threads.js:70`; `viewer/app/routes.js:437`, `:441` | `viewer/test/app-handoff.test.js:276`; `viewer/test/app-handoff.spec.js:77` |
| 15 | `POST /threads/import`, raw body, 413 before parsing | this run | `viewer/app/routes.js:42-62` | `viewer/test/app-handoff-import.test.js:132`, `:230` |
| 16 | Import step 1: validation; saved Create/Advance re-run, saved Undo opened; thread's own machine and project | this run | `viewer/app/handoff-import.js:13-32` | `viewer/test/app-handoff-import.test.js:11`, `:16`, `:28`, `:116`, `:145` |
| 17 | Step 2: repository match, non-GitHub origin | this run | `viewer/app/handoff-import.js:36-38`; `machine/service.js:43-47`, `:1276` | `viewer/test/app-handoff-import.test.js:21`, `:154`, `:295` |
| 18 | Step 3: branch has `head`; stage statuses (and MAP.md) at `head` | this run | `viewer/app/handoff-import.js:34-41`; `machine/service.js:1404-1423` | `viewer/test/app-handoff-import.test.js:34`, `:277`; `machine/test/service.test.js:1618` |
| 19 | Step 4 outcome table: refusal rows, Create, Open notes, Advance, diverged | this run | `viewer/app/handoff-import.js:43-69` | `viewer/test/app-handoff-import.test.js:16`, `:40`, `:79`, `:98`, `:277`, `:288`, `:295` |
| 20 | Remote tip must equal `head`; own cancelled claim → "still being taken back" and revoke after the lock | this run | `viewer/app/handoff-import.js:42`, `:52-60`, `:72` | `viewer/test/app-handoff-import.test.js:53`, `:196` |
| 21 | Advance busy check | this run | `viewer/app/handoff-import.js:61-62`; `viewer/app/handoff.js:91-99` | `viewer/test/app-handoff-import.test.js:48`, `:177` |
| 22 | Carried state applied: `imported`, cards retracted, pins cleared | this run | `viewer/app/handoff-ops.js:15-17`, `:101-108` | `viewer/test/app-handoff-ops.test.js:37`, `:62`; `viewer/test/app-handoff-import.test.js:163`, `:177`, `:220` |
| 23 | PR lookups for imported threads (`mergedPr`, `prOf`, done point) | this run | `viewer/app/handoff.js:105-107`; `viewer/app/threads.js:390-396`; `viewer/app/chat.js:259-265` | `viewer/test/app-handoff-restart.test.js:5`, `:103`, `:192` |
| 24 | "Before the handoff" section; own conversation from `imported.at` | this run | `viewer/pages/thread.html:30`; `viewer/pages/thread.js:227-229`, `:342-350` | `viewer/test/app-handoff.spec.js:57`, `:132` |
| 25 | Operation record; steps Claim, Stop, Checkout, Apply, Done, each skip-if-done | this run | `viewer/app/handoff-ops.js:15-17`, `:73-117` | `viewer/test/app-handoff-ops.test.js:14`, `:62`, `:98`, `:150`, `:214`, `:246` (fault matrix for all three kinds) |
| 26 | Pre-claim checks: before the first save, and on every Retry while unlanded | this run | `viewer/app/handoff-ops.js:26-44`, `:51-54`, `:128`, `:134`, `:153` | `viewer/test/app-handoff-ops.test.js:23`, `:300`, `:320`; `viewer/test/app-handoff-import.test.js:220` |
| 27 | Abandoning (Create deletes, Advance/Undo clear; re-import wording) | this run | `viewer/app/handoff-ops.js:45-48`, `:66-68` | `viewer/test/app-handoff-ops.test.js:202`; `viewer/test/app-handoff-import.test.js:110` |
| 28 | Own cancelled claim at the Claim step | this run | `viewer/app/handoff-ops.js:64-66` | `viewer/test/app-handoff-ops.test.js:120` |
| 29 | Lead started after the operation; `checkout_sha` → `from_remote_branch`; missing worktree cleared via `inspect` | this run | `viewer/app/handoff-ops.js:107`, `:118-122`, `:139-146`, `:159-160`; `viewer/app/handoff-import.js:74`; `viewer/app/threads.js:130-135`, `:166`, `:174` | `viewer/test/app-handoff-restart.test.js:36`, `:84`, `:146`, `:156`; `viewer/test/app-handoff-import.test.js:257` |
| 30 | Plan registration on lead start and at hub start | this run | `viewer/app/sessions.js:366-367`; `viewer/app/hub.js:66-71` | hub start: `viewer/test/app-handoff-restart.test.js:13`; lead start: no dedicated test (see gaps) |
| 31 | Dead-lead panel condition | this run | `viewer/pages/thread.js:331` | hidden while frozen: `viewer/test/app-handoff.spec.js:173`; imported-with-no-lead case untested (see gaps) |
| 32 | Partial lead starts at hub start (imported threads' leads only) | this run | `viewer/app/hub.js:57-65` | `viewer/test/app-handoff-restart.test.js:13`, `:117` |
| 33 | Restart order for imported threads (running/kill/refuse, queue moves, pending record saved before start) | this run | `viewer/app/threads.js:147-168` | `viewer/test/app-handoff-restart.test.js:36`, `:70`, `:117`, `:178` |
| 34 | Import context block, `[wc:context import]` marker, chat bubble "Imported from a handoff" | this run | `viewer/app/threads.js:144-146`; `viewer/app/chat.js:127-135` | `viewer/test/app-handoff-restart.test.js:36`, `:97`; `viewer/test/app-handoff-import.test.js:257` |
| 35 | Retry route and panel | this run | `viewer/app/routes.js:536`; `viewer/pages/thread.js:198-204`, `:217-225` | `viewer/test/app-handoff-ops.test.js:246`, `:271`; `viewer/test/app-handoff.spec.js:98`, `:176` |
| 36 | Cancel route, only before `claim_landed`; revoke entry | this run | `viewer/app/routes.js:537`; `viewer/app/handoff-ops.js:162-174` | `viewer/test/app-handoff-ops.test.js:166`, `:271`, `:286`; `viewer/test/app-handoff.spec.js:98`, `:176` |
| 37 | Revoke sweep (operation wins, revoked/waiting/gone/failed, renewal, expiry), Dismiss, threads-list notice | this run | `viewer/app/handoff-ops.js:175-198`; `viewer/app/routes.js:68`, `:443`; `viewer/pages/threads.js:84-95` | `viewer/test/app-handoff-ops.test.js:83`, `:137`, `:229`, `:290`; `viewer/test/app-handoff.spec.js:77` |
| 38 | Undo route; saved Undo shows only the Retry panel | this run | `viewer/app/routes.js:535`; `viewer/app/handoff-ops.js:147-161`; `viewer/app/hub.js:188`, `:197`; `viewer/pages/thread.js:207`, `:214` | `viewer/test/app-handoff-ops.test.js:166`, `:271`; `viewer/test/app-handoff.spec.js:85`, `:123` |
| 39 | Machine `createWorktree` `from_remote_branch` (paths 1-4, upstream config, archive ownership) | this run | `machine/service.js:478-511` | `machine/test/service.test.js:1596` |
| 40 | Machine `/v1/handoff` actions (status, push, inspect, claim-commit/state/push/revoke, reopen, fast-forward, set-branch, running, kill, known); all 200 except 422 | this run | `machine/service.js:1226-1423`; documented in `machine/API.md` | `machine/test/service.test.js:1448`, `:1490`, `:1521`, `:1548`, `:1569`, `:1618` |
| 41 | Fetch helper: exact `ls-remote` match, missing branch not an error | this run | `machine/service.js:1214-1225` | `machine/test/service.test.js:1432` |
| 42 | Durable `archiving`/`archived` markers | this run | `machine/service.js:233-257`, `:342-344`, `:784-851`, `:1362-1368` | `machine/test/service.test.js:1569`, `:1585`, `:1636` |
| 43 | Machine lock order (thread lock, then repository queue) and input validation | this run | `machine/service.js:1226-1265` | `machine/test/service.test.js:1405` (waits for an archive; repo-queue order not asserted) |
| 44 | 120 s hub timeout for `/v1/handoff` | this run | `viewer/app/machine-client.js:98-114` | `viewer/test/app-handoff.test.js:51-62` (timeout path with a short override) |
| 45 | Normalization | this run | `machine/service.js:43-47` | `machine/test/service.test.js:1393` |
| 46 | `lead.md`: Imported threads subsection; step 4 commits IDEA/PLAN before ending a turn | this run | `protocol/app/lead.md:416-430`, `:196-199` | doc; `viewer/test/protocol-rules.test.js` passes |
| 47 | `cards.md` marker row | this run | `protocol/app/cards.md:143` | doc |
| 48 | README section | this run | `README.md:119-135` | doc |

## Deviations from plan

- Hub tests are four files (`app-handoff.test.js`, `app-handoff-ops.test.js`,
  `app-handoff-restart.test.js`, `app-handoff-import.test.js`), not the Spec's single
  `app-handoff.test.js`, so tasks run in sequence didn't edit one file.
- Field names the Spec left open were settled during the build (PLAN.md Log): `known`
  returns `{known, local_branch, local_ancestor, checked_out: [paths]}`; `running`/`kill`
  return `{names}`; action failures are `{result: "failed", error}`; `inspect` takes
  `fallback_head`; `revoke.json` is a JSON array of entries that also carry `repository`;
  outcomes `undone`/`cancelled`; banner state `undo-unfinished`; payload `revoke_notices`
  and `handoff_op` summary; Dismiss route `POST /handoff-revokes/dismiss`.
- The page's Export reason line is a non-sticky row under the thread head rather than
  inside it. Inside the sticky head it pushed the pinned area and composer over the chat.
- An existing thread with no head to compare (`relation` null) opens unchanged with note
  "This thread here has no checkout to compare with, so nothing was changed." The Spec's
  table does not name this case.
- A hub-to-machine failure while revoking is kept as `waiting`, not `failed`, so an offline
  machine raises no threads-list notice.
- Every other choice made under the Spec is a `Choice:` line in PLAN.md's Log.

## Routers

- `viewer/AGENTS.md`: rows for `app/handoff.js`, `app/handoff-ops.js` and
  `app/handoff-import.js`.
- `machine/AGENTS.md`: the `service.js` row now names `from_remote_branch`, the hub-only
  `/v1/handoff` actions and the durable archive markers. `machine/API.md` documents every
  `/v1/handoff` action; `viewer/app/API.md` documents the new hub routes and payload fields.

## Validation evidence

At `21db739` (all tasks merged), run by the sub-lead one after another:

`node --test viewer/test/*.test.js`
```text
# tests 615
# suites 0
# pass 615
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

`bash machine/test/run.sh`
```text
# tests 146
# suites 0
# pass 146
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

`npm --prefix viewer run test:browser` (third run, exit 0)
```text
  28 skipped
  746 passed (3.2m)
```
The first two full browser runs each failed one test, a different one each time:
`app-handoff.spec.js:19` with "server exited before ready: Refused to use a port held by a
process it cannot identify", and `app-settings.spec.js:61` (Firefox, a permission-mode poll
timing out; this feature changed no settings code). Each passed 3 of 3 when run alone.

## Known gaps / residual risks

- No dedicated test for plan registration on a lead start (it is tested at hub start), or
  for the dead-lead panel showing on an imported thread that never had a lead.
- The 120 s default timeout and the machine's repository-queue ordering are not asserted
  directly. The timeout path is tested with a short override, and the archive-lock wait is
  tested.
- Two existing browser tests are timing-sensitive under load (above). They are not part of
  this change.
- The accepted risks in PLAN.md (rare crash timing, two hubs on one machine, archive records
  that never expire, unsaved starts for non-imported threads) stand as accepted.

## Remediation rounds
