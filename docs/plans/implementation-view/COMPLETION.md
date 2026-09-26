---
slug: implementation-view
date: 2026-09-25
implemented-by: "gpt-5.6-terra (T1), sonnet (T2, T3) (lead: opus)"
verified-by:
  - round: 1
    lane: claude default reviewer
    checks: gpt-5.6-terra
  - round: 1
    lane: gpt-5.6-sol
    checks: sonnet
---

# Completion Report — A live picture of an implementation run

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## What the change does

```mermaid
flowchart LR
  subgraph lead [the implementation lead, protocol/implementation.md]
    A[move any old picture aside] --> B[one start message]
    B --> C[draw run.json: parts not started]
    C --> D[dispatch: in progress]
    D --> E[checks pass: done, choices logged then drawn]
    D --> F[needs Collin]
    E --> G[collect struck choices, then follow-ups]
  end
  subgraph server [viewer/server.js]
    S1[validate run fields and refusals] --> S2[left-to-right layout, or keep positions]
    S3[GET: rollups and updated]
  end
  subgraph page [viewer/index.html]
    P1[sockets and curved wires] --> P2[status tags and needs text]
    P3[poll: redraw on rollups change] --> P4[tab title and notifications]
  end
  C --> S1
  D --> S1
  S3 --> P3
```

In words: the lead writes `graphs/run.json` through the server, which checks the new fields and
lays the picture out left to right. A write that changes only statuses keeps every box where it
was. On each read, the server adds the nested pictures' status summaries and the newest change
time. The page draws sockets made from the wires and status tags. It redraws when a nested
picture changes, and it flags a part that needs Collin in the tab title and with a notification.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| `run` switch, canonical position, omitted when false, non-boolean refused | this run | `viewer/server.js:140`, `:166-176` | `run.test.js` "legacy canonical bytes…", "run validation refuses…" (`unknown-schema`); existing `server.test.js` canonical round-trip |
| `task`/`status`/`needs` keys, canonical position, omitted on plain graphs | this run | `viewer/server.js:105-118`, `:198-201` | `run.test.js` "legacy canonical bytes…"; existing fixtures unchanged (`server.test.js:186-197`) |
| `store` and `choice` kinds | this run | `viewer/server.js:60`, `:213-215` | `run.test.js` "run validation refuses…" (`run-field`, `choice-shape`) |
| Refusals `run-field`, `run-field-shape`, `bad-status`, `status-without-task`, `needs-missing`, `needs-hidden`, `container-status`, `choice-shape` | this run | `viewer/server.js:213-237`, `:330-335` | `run.test.js` "run validation refuses each new schema violation" |
| `run-name`, `run-nesting` | this run | `viewer/server.js:1539-1550` | `run.test.js` "run validation refuses…", "run nesting and reserved names…" |
| Preservation exemption for the three keys; `/view` may not change them or `run` | this run | `viewer/server.js:373-374`, `:1499`, `:1517` | `run.test.js` "agent progress preserves ruled entries…" |
| `rollups` `{status, needs, cut}` for one-level children | this run | `viewer/server.js:415-437` | `run.test.js` "rollups, nesting, updated…" (all four statuses, needs list, run:false / missing / unreadable child) |
| `updated`, newest across the file and its children | this run | `viewer/server.js:440-448`, `:1653` | `run.test.js` "rollups, nesting, updated…" (touching the child moves `updated`) |
| Left-to-right layout, plain graphs unchanged | this run | `viewer/server.js:940-983`, `:664`, `:985-986` | `run.test.js` "run layouts are left-to-right…"; every existing layout test in `server.test.js` and `render.spec.js` passes |
| Box height reservation | this run | `viewer/server.js:644-657`; `protocol/graphs.md:247` | read against the Spec formula; page copy in `viewer/index.html:1087-1114` |
| Keep positions when layout inputs unchanged | this run | `viewer/server.js:1552-1564`, `:1588` | `run.test.js` "run layouts…preserve drags for progress-only writes" (dragged box kept; added edge relays out) |
| List `run` field | this run | `viewer/server.js:1782-1786` | `run.test.js` "rollups, nesting, updated, and the list run path…" (valid, malformed, run:false) |
| Sockets made from wires, curved wires, no face slotting | this run | `viewer/index.html:1052-1068`, `:1583-1600`, `:2012-2034` | `run.spec.js` "sockets render named, unnamed and shared…" |
| Box contents: status line, label, needs (container first entry + "+N more"), socket rows, cut names with hover title | this run | `viewer/index.html:1087-1114`, `:1400-1466` | `run.spec.js` "sockets render…", "status tags and needs text render…", "a container shows its rollup…" |
| Status tags and borders, colour not the only signal | this run | `viewer/index.html:141-151`, `:1400-1412`, `:1476` | `run.spec.js` "status tags and needs text render…" |
| Container rollup status, `cut` message in detail panel | this run | `viewer/index.html:1070-1084`, `:1826-1845` | `run.spec.js` "a container shows its rollup status and needs, and a cut child explains itself…" |
| `choice` box: no status, normal controls, label only | this run | `viewer/index.html:1395-1458` | `run.spec.js` "status tags… and a choice box carries no status" |
| No task id on faces; task id in detail panel | this run | `viewer/index.html:1826-1830` | `run.spec.js` "status tags and needs text render…" |
| "updated N min ago" | this run | `viewer/index.html:256`, `:627-634` | `run.spec.js` "a child file's status change redraws…" |
| Redraw when `rollups` changes | this run | `viewer/index.html:2506-2523` | `run.spec.js` "a child file's status change redraws the open root without the root file changing" |
| Reserved-name 422 shows fatal; later success clears it | this run | `viewer/index.html:1125-1128`, `:2500`, `:2508` | `run.spec.js` "on a reserved-name path a removed file shows the fatal screen…", "a reserved-name file that no longer validates…" |
| Tab title prefix | this run | `viewer/index.html:600-603`, `:627-643` | `run.spec.js` "the title prefix appears and clears across polls" |
| One-time notification offer, remembered; one notification per node (file + id) newly needs-you | this run | `viewer/index.html:273-277`, `:356-358`, `:576-622` | `run.spec.js` "exactly one notification per node newly needs-you, including two nodes sharing an id in different files" |
| List page "run picture" link | this run | `viewer/list.js:85`, `:100-105` | `run.spec.js` "the list page shows a run picture link…" |
| `graphs.md` "Run pictures" section, key order, kinds, refusal table | this run | `protocol/graphs.md:713-863`, `:327-345`, `:247`, `:917-918` | read by the lead against the Spec |
| Stage 3: precondition accepts `implementing`; small-patch bypass | this run | `protocol/implementation.md:20-23`, `:25-29` | read against Spec |
| Stage 3: move aside at every start, one-sentence pointer | this run | `protocol/implementation.md:55-70` | read against Spec |
| Stage 3: brief closing section for choices | this run | `protocol/implementation.md:76-79` | read against Spec |
| Stage 3 step 1: ask once, start message, `Stage 3 started` line | this run | `protocol/implementation.md:89-103` | read against Spec |
| Stage 3 step 2: draw, `prior`, `--register-plan` again | this run | `protocol/implementation.md:105-122` | read against Spec |
| Stage 3 step 3: four states and when each is set; tell Collin | this run | `protocol/implementation.md:124-136` | read against Spec |
| Stage 3 step 4: `Choice:` Log line before the box; lead lists choices from the diff when missing | this run | `protocol/implementation.md:183-195` | read against Spec |
| Stage 3 step 5: collect struck choices from plain file reads, follow-ups, end-of-run list | this run | `protocol/implementation.md:204-216` | read against Spec |
| Stage 3 step 6: never block, 409 cap, end the picture on any other failure | this run | `protocol/implementation.md:138-146` | read against Spec |
| lanes.md "Checking a lane can log in"; exit-2 wording | this run | `protocol/lanes.md:240-252`, `:228-229` | read against Spec |

## Deviations from plan

None in behaviour. Choices the workers made that the Spec didn't settle, recorded in PLAN.md's
Log:

- Run-picture boxes showed no kind tag (T2). Verification round 1 flagged this, and D57 put the
  kind tag on every box's top line in remediation 1. There's still no fork tag.
- A loop-back wire's ends were only nearly horizontal. This was replaced in remediation 1 by two
  cubic segments that are flat at both sockets (D58).
- Status borders: in progress uses a dash, done a thicker green line, and needs-you a tight
  red dash, over the existing single theme (T2).
- Age text rounds to the nearest minute. If storage throws, the notification offer counts as
  already answered (T2).
- The list page adds a fifth "Run" column (T2).
- The reserved-name check applies to files directly inside a directory named `graphs`. An
  unreadable child reports `children[name]: false` alongside `cut: true` (T1).
- The new prose carries no D-number citations, and the lead's steps are spread across the
  existing sections (T3).

This run was built under the Stage 3 rules as they stood before this change, so it drew no run
picture of itself.

## Routers

`protocol/AGENTS.md`: the rows for `implementation.md` and `graphs.md` now mention the run
picture. The root `AGENTS.md` is unchanged. Its viewer row lists files, and this change adds
tests but no page files. The `lanes.md` router row is unchanged, since what it says stays true.

## Validation evidence

On the merged branch (`b702612`):

```
$ node --test viewer/test/*.test.js
not ok 31 - a starter that loses the freed port registers through the new holder
# tests 131
# pass 130
# fail 1

$ npm --prefix viewer run test:browser
  220 passed (54.6s)

$ bash spine/test/run.sh        -> RESULT 80 passed, 0 failed
$ bash sensitivity/test/run.sh  -> RESULT 62 passed, 0 failed
$ bash seen/test/run.sh         -> exit 0
$ bash install/test/run.sh      -> RESULT 70 passed, 0 failed
```

The one failing test fails on the untouched branch too. Before any change it failed three
times out of three (PLAN.md Log, Stage 3 start). It tests a server port handoff this change
does not touch.

Not run: `./install.sh && ./install.sh`. It writes into the harness homes and restarts the
always-on viewer on this machine, so it is left for Collin to run.

## Known gaps / residual risks

- The always-on viewer is still running the old code until `./install.sh` runs, so a real
  run picture won't render there until then.
- The Accepted Risks in PLAN.md stand as written.

## Remediation rounds

### Remediation 1 — 2026-09-26

Verification round 1 found 14 gaps, listed verbatim in `REMEDIATION-1.md`. The lead settled
three plan gaps as Spec amendments: D56 (120px between columns), D57 (the kind tag on every run
box) and D58 (a loop-back wire in two segments). The table above has been re-cited against the
code after remediation.

- R1 (fresh gpt-5.6-terra lane, since T1's worktree was gone): an empty `needs` now refuses
  `needs-missing` (`viewer/server.js:231`). `run-A.json` is reserved (`:1539-1542`). Columns are
  now 120px apart (`:664`, `:940-947`). New server tests cover the A→B→C chain at 320px against
  a plain chain at 140px rows, a task-only update keeping positions, a null-status child, a child
  with `needs-you` next to `done`, and a valid `run: false` child.
- R2 (sonnet): the top line now always carries the kind tag (`viewer/index.html:1087-1114`,
  `:1400-1412`). The loop-back wire is two segments (`:1583-1600`). A direct needs-you node's
  full text is in the detail panel (`:1826-1830`). Three browser tests added. The lead corrected
  one wrong code comment about fork tags.
- R3 (sonnet): `protocol/implementation.md` now carries the restart pointer only when files
  moved, the rule that a box carries the currently active task's id, one box for a choice
  spanning several parts or files, and choices not counting toward the 25-box split.
  `protocol/graphs.md` carries D56–D58, and its citations are corrected. The root `AGENTS.md`
  citations are corrected: `viewer/server.js:2306-2307` and `:157`.

Routers: the root `AGENTS.md` was updated this round. Its "never check the viewer by starting a
server by hand" paragraph cites the lines that exist now.

Validation after remediation, on the merged branch:

```
$ node --test viewer/test/*.test.js
not ok 31 - a starter that loses the freed port registers through the new holder
# tests 132
# pass 131
# fail 1          (the pre-existing lifecycle test, unchanged)

$ bash spine/test/run.sh; bash sensitivity/test/run.sh; bash seen/test/run.sh; bash install/test/run.sh
exit 0 each

$ npm --prefix viewer run test:browser
  226 passed (55.7s)
```
