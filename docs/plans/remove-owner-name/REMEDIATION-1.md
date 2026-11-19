# Remediation 1 — remove-owner-name

## Gaps (verification attempt 1, commit 1188b129; GPT verifier FAIL, Claude verifier PASS)

GAP: Validation 4 — the full viewer and browser suites exited 1 — `viewer/test/app-uploads-archive.test.js:72` failed in both full viewer runs, and the browser suite failed at `viewer/test/app-handoff.spec.js:222` and `viewer/test/app-threads.spec.js:550`.
GAP: Validation 6 — the checked-in test asserts the queued context before delivery — `viewer/test/app-handoff-restart.test.js:85` reads `lead.queue[0]`. A separate probe confirmed that both import and restart context reached the fake machine with the expected tags and preserved the original tags on disk.
GAP: Rewriting rule 1 — “The user’s” is capitalized mid-sentence — `protocol/app/lead.md:491`.

(The Claude verifier also saw different flaky failures per run in untouched files: app-quiet "6 message clears debt", server.test.js "global write lock"/port refusal, browser app-threads.spec.js:340.)

## Tasks

- G1 (suite flakes in untouched files): sent to the lead for a per-gap answer; no task yet.
- R1-1 (G2 + G3): brief below.

# Task R1-1 — plan `remove-owner-name`: remediation of verification attempt 1

The lead's session is `wc-d4f6b0a949c2-lead`; message it if this brief does not settle something.

**Objective:** fix two gaps the verifier found.

**G2 (Validation 6 test is weak).** `viewer/test/app-handoff-restart.test.js:70-96`, test "import restart relabels owner tags in context without changing saved state", reads the context from `lead.queue[0]` (the queue) rather than from what was actually delivered to the machine. Change it so that it asserts on the `[wc:context import|restart]` message **as delivered to the (fake) machine session** — i.e. after the hub's queue delivery runs, read the text the fake machine received. Find how the test helpers' fake machine records text sent to a session (look in `viewer/test/helpers/` and at how other tests in `viewer/test/app-hub.test.js` or `app-handoff-restart.test.js` observe delivered messages, e.g. a recorded send/type list on `context.machine` or a fake hub client). If the setup the test uses (a `Hub` on `setup()` from helpers/app.js) has no way to observe delivery, switch the test to the `withContext`/`api(...)/restart` style used in `viewer/test/app-hub.test.js:1400` and trigger delivery there. Keep every existing assertion (source/resolved_by in cards and pinned/who = `user`; `pinned.other` passes through; saved state still `collin`). Do not change product code; if delivery cannot be observed without changing product code, stop and message the lead.

**G3 (one word).** `protocol/app/lead.md:491` reads `The user's request for a small fix,` mid-sentence; change `The` to `the`. Nothing else in that file.

**Ownership boundary:** `viewer/test/app-handoff-restart.test.js`, `protocol/app/lead.md` (line 491 only), and new test-helper code only if strictly necessary (under `viewer/test/helpers/`, additive). Plus your report.

**Validation (paste output of each):**
```
sed -n 491p protocol/app/lead.md
node --test viewer/test/app-handoff-restart.test.js
node --test viewer/test/app-hub.test.js
git grep -n -i collin -- protocol    # expect only protocol/app/sub-lead.md:33
```
If the same gate fails twice, stop and report rather than iterating.

## Rules
- **Never delete files** (no `rm`, `git rm`, `git clean`). Never run `./install.sh`. Never start a viewer server by hand except through the test helpers. Your own `wc.js` and `card.js` calls are always allowed.
- Commit with `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit -m "<msg>" --paths <exact paths>`.
- Report at `docs/plans/remove-owner-name/reports/R1-1.md`, committed, with pasted command output and files changed; finish with a `result` card (task id R1-1, outcome, summary, report path, commit).
- List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none. (A "Choices" section in the report.)
