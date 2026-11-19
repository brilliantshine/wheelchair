---
slug: local-checkout-handoff
date: 2026-11-19
implemented-by: "machine: standard xhigh (gpt-6.1-terra), tasks T1a, T1b, T1c; hub: standard (gpt-6.1-terra), T2; page: standard (claude-sonnet-5-5), T3; sub-lead: claude-opus-5-5"
verified-by: []   # Stage 4 appends; Stage 3 leaves this empty.
---

# Completion Report — Try a thread's work in my own checkout

Written for a hostile reviewer: every claim checkable, no claim without evidence.

Code: `machine/lib/try.js` (class `TryService`, all machine behaviour), the `/v1/try` route
in `machine/service.js`, the hub routes in `viewer/app/routes.js`, the client method in
`viewer/app/machine-client.js`, the panel in `viewer/pages/thread.js` and
`viewer/pages/thread.css`. Tests: `machine/test/try.test.js` (64 tests),
`viewer/test/app-try.test.js`, `viewer/test/app-try.spec.js` (9 tests × 2 browsers).
Line numbers below are at the commit this report is committed in.

## Spec coverage

All rows are `this run`; the plan's Prior Work table was empty.

| Spec item | Origin | Implemented at (file:line) | Validated by (`machine/test/try.test.js` line unless named) |
|-----------|--------|----------------------------|--------------|
| The folder is `thread.project` on `thread.machine` | this run | `viewer/app/routes.js:470-505` (machine and project from the record only) | `viewer/test/app-try.test.js:16` |
| Identity (folder real path + real common dir), stamped at first Try, checked only while `active`/`pending` | this run | `machine/lib/try.js:93-99`, `:108-129`, `:212-216` | 208, 333, 355 |
| HEAD identity `{branch, sha}`, compared on both parts | this run | `try.js:79-83` | 233, 238, 264 |
| Status scan command, only inside writes | this run | `try.js:58-74` | 65, 429 |
| Protected paths side file, written at first Try, deleted when `active` and `pending` both clear; exact untracked match only | this run | `try.js:75-78`, `:100-104`, `:212-216`, `:242`, `:257-294`, `:330` | 48, 283, 301 |
| Clean / not clean | this run | `try.js:75-78`, `:204-209` | 112, 178, 243 |
| Folder's own lock keyed by real path, separate from `inRepoQueue`, refused at once when held; lock generation | this run | `try.js:10-12`, `:149` | 24, 152, 384, 392 |
| Running git: own process group, deadlines (15 min switch, 5 min scan), SIGTERM → 10 s → SIGKILL, wait for the group; `LC_ALL=C` | this run | `try.js:38-57`; metadata calls `:27-37` (4 s) | 32, 455, 89, 97, 224 |
| Acknowledged, then finished; scan-free checks first; every accepted try/back writes `last` | this run | `try.js:137-198`, `:251-255`, `:341-345` | 105, 112, 168 |
| Outcome table, `unable to unlink`/`unable to rmdir` override, hooks by exit code | this run | `try.js:84-92` | 39, 140, 442, 451, 162 |
| Interrupted keeps `pending` with files; Status says interrupted with files, earlier branch, Done; index.lock line wording | this run | `try.js:246-249`, `:336-339`, `:347-372`; `viewer/pages/thread.js:246-277` | 200, 347, 435, 465, 133, 399 |
| Done/Try/Back refused while `index.lock` exists; never deleted | this run | `try.js:173`, `:258` | 133, 255 |
| Try and Back refused while `pending` set | this run | `try.js:172` | 133, 307 |
| Switch command flags (`--no-guess --no-overwrite-ignore --no-recurse-submodules`, `submodule.recurse=false`) | this run | `try.js:229`, `:316-317` | 162, 363 |
| Same place: no git when source equals target | this run | `try.js:229`, `:318` | 118 |
| Pins under `refs/wheelchair/<return\|kept>/<folder hash>/<nonce>`, saved in the record first; no stash | this run | `try.js:218-228`, `:301-305` | 105, 126 |
| Record shape, atomic write, `version` per write | this run | `try.js:15-26` | 13 |
| Trying / Moved / Stale | this run | `try.js:357-363` | 126, 407 |
| Folder checks: top level / bare; under `<stateDir>/worktrees`; service root; operations in progress and unmerged index; identity | this run | `try.js:108-129`; hub own-root `viewer/app/routes.js:476-505` | 55, 183, 371, 376; `app-try.test.js:16` |
| Action checks: submodule/gitlink, not clean, Stale, missing `wc/<id>`, return branch gone or checked out elsewhere, stale `version` | this run | `try.js:132-136`, `:153`, `:170-191`, `:204-209`, `:308-312` | 147, 112, 126, 316, 341 |
| 1. Try: already newest, Moved pin, first/later `pending`, return pin, outcomes | this run | `try.js:176-179`, `:200-256` | 105, 118, 126, 216, 276 |
| 2. Switch back: resolve tip, Moved pin, one-scan judging, `appeared` raw difference capped, return pin deleted | this run | `try.js:180-190`, `:295-346` | 233, 238, 249, 289, 294, 416 |
| 3. Status: no lock, generation check, metadata only, all states in order, `refused`, `index_lock`, `last`, `kept`, capped lists | this run | `try.js:347-372` | 65, 173, 407, 416, 425, 429 |
| 4. Dismiss / Done: five cases; Forget | this run | `try.js:257-294`; Forget `:154-163` | 259, 264, 311, 323, 333, 269, 341 |
| 5. Start-up leaves `pending`; shown as interrupted | this run | `try.js:347-372` (no start-up hook runs git) | 65, 465 |
| 6. Errors as one sentence; `last` shown until next try/back; Dismiss/Forget never change `last`; "in the way" sentence | this run | `try.js:240-245`, `:331-335`; `thread.js:355-368` | 162, 269; `app-try.spec.js:126` |
| Machine endpoint `POST /v1/try`, hub-secret only, input validation | this run | `machine/service.js:1912-1917`, constructed at `:222`; `try.js:137-145` | 6, 187 |
| Hub `GET`/`POST /api/threads/<id>/try`, archived allowed, `version`/`kept` forwarded, title added, write auth | this run | `viewer/app/routes.js:470-505`; `viewer/app/machine-client.js:83-93` | `viewer/test/app-try.test.js:16` |
| Thread page "Your copy" panel: status, buttons by state, confirmations, kept list with Delete, Switching…, 3 s re-read while busy, error line, archived threads, never on the poll timer | this run | `viewer/pages/thread.js:246-368`, `:1250`; `viewer/pages/thread.css` | `viewer/test/app-try.spec.js:46-159` |
| Non-goals (no merge/push, no app launch, no file deletion in his folder, no stash, no submodule support) | this run | No `rm`/`clean`/`stash`/`reset` in `try.js` (`grep -nE "clean|stash|reset|unlink" machine/lib/try.js` shows only the `clean` variable and `.protected` side-file unlinks in `<stateDir>`, lines 242, 292, 330) | 243, 283, 347 |

## Deviations from plan

- Machine tests are in a new `machine/test/try.test.js`, not in `machine/test/service.test.js`. `machine/test/run.sh` globs `*.test.js`, so `bash machine/test/run.sh` runs them as the Spec's Validation says.
- Metadata git calls (`rev-parse`, `symbolic-ref`, `update-ref`, `ls-files -u`, `worktree list`) have their own 4-second deadline. The Spec names deadlines only for switches and scans. Repository-sized reads (`ls-files --others --ignored`, `diff --raw`, `merge-base --is-ancestor`) use the 5-minute scan deadline. A metadata timeout gives "Git did not answer in time. Try again."
- Identity-mismatch Dismiss runs read-only metadata git (to detect the mismatch) but no ref write or ancestry check. The Spec's "without any git command" is read as "nothing acts on the replaced repository".
- The delayed-filter test (`try.test.js:465`) moves HEAD inside the fixture, because this git version had not moved HEAD at a natural delayed failure.
- Browser tests mock `/api/threads/<id>/try` with `page.route` and do not go through the hub and a fake machine. The hub is covered by `viewer/test/app-try.test.js`.
- Choices the Spec did not word (sentences, labels, button gating) are logged one per line in PLAN.md's Log.

## Routers

- `machine/AGENTS.md`: adds `lib/try.js` and `test/try.test.js` to its file table.
- `machine/API.md`: documents `POST /v1/try`.
- `viewer/app/API.md`: lists the two hub routes.

## Validation evidence

Run on the feature branch after all merges, 2026-11-19.

`bash machine/test/run.sh`:

```text
# tests 409
# pass 409
# fail 0
exit 0
```

`node --test viewer/test/*.test.js`:

```text
# tests 695
# pass 695
# fail 0
exit 0
```

`npm --prefix viewer run test:browser`:

```text
  1 failed
    [firefox] › test/app-send-now.spec.js:59:1 › a regular composer send already shown by a poll does not get a queued duplicate
  34 skipped
  1057 passed (16.3m)
exit 1
```

The one failure is in a spec this change does not touch (`git diff 16036dd1 -- viewer/test/app-send-now.spec.js` is empty). Re-run alone, `npx playwright test app-send-now --repeat-each 3` (from `viewer/`):

```text
  24 passed (50.2s)
```

## Known gaps / residual risks

- Accepted Risk (PLAN.md): an app saving a file while git replaces it can lose that save.
- Deferred D1-D3 not built: no back-up-and-clear of files changed while trying, no automatic recovery of a half-switched Try, no Finish action. Interrupted switches are shown with Done.
- Panel (seen on read, minor): the version is captured when the panel renders, not when a confirmation opens; after a refusal it uses the returned status rather than re-reading; Firefox shows its own network-error text; a trying-other thread with a null title reads "another thread: another thread"; `last` with no `reason` is hidden.
- Hub: machine errors other than 422/502 (for example a 401 from a mismatched machine secret) reach the page with their own status.
- Status runs folder checks in sequence with up to 4 s per metadata call; a pathologically slow git could push Status past the hub's 5-second timeout. The page then shows the error and Refresh.
- Full-suite runs during the build saw timing flakes in `viewer/test/app-quiet.test.js` and `machine/test/project-tools-service.test.js` while several suites ran at once; both passed in isolation and in the final runs above.

## Remediation rounds

Appended by Stage 4 loops; never erase earlier content.

### Remediation 1 — 2026-11-19

Verification attempt 1 (`61a04ea9`): Claude PASS, GPT FAIL. 13 gaps after merging duplicates; the lead's per-gap answer fixed G1, G2 and G7 and deferred the rest as PLAN.md D4-D13. Details in `REMEDIATION-1.md`.

| Gap | Fix | Where | Test |
|-----|-----|-------|------|
| G1: refused Switch back pinned the same commit again on each press | Pin a commit made while trying only after the clean and submodule checks, and skip it when a kept entry already resolves to that sha (Try and Back) | `machine/lib/try.js` `performTry` and `performBack` (pin blocks inside the clean `else` branch) | `machine/test/try.test.js` "Back after a commit pins once across dirty refusals, then succeeds" |
| G2: the panel did not re-read Status after a refusal | `accepted: false` sets `reread` | `viewer/pages/thread.js:364` | `viewer/test/app-try.spec.js` "a refused write shows the reason and re-reads Status once" |
| G7: git failing to spawn crashed the machine service | `runGit` resolves at once on a spawn error; `signal`, `groupAlive` and the metadata timer skip a missing pid | `machine/lib/try.js:27-60` | `machine/test/try.test.js` "git runner spawn failure resolves and Try refuses without crashing" |

Validation after the fixes, on the feature branch:

```text
bash machine/test/run.sh            # tests 411, pass 411, fail 0
node --test viewer/test/*.test.js   # tests 695, pass 694, fail 1: routes.test.js "wrong cookies and cookies from before a rotation are refused" (file untouched by this branch; alone: pass 22, fail 0, twice)
npm --prefix viewer run test:browser   # 34 skipped, 1060 passed (11.6m), exit 0
```

### Remediation 2 — 2026-11-19

Verification attempt 2 (`e856552c`): Claude PASS (G1, G2, G7 confirmed), GPT FAIL with four gaps. The lead's per-gap answer fixed H1 and H4 and deferred H2 and H3 as PLAN.md D14 and D15. Details in `REMEDIATION-2.md`.

| Gap | Fix | Where | Test |
|-----|-----|-------|------|
| H1: raw browser text ("Failed to fetch", "NetworkError…") when the connection drops | `copyErrorText` maps any fetch `TypeError` to "Can't reach the hub." in both the status load and the write | `viewer/pages/thread.js` `copyErrorText`, `copyLoad`, `copyWrite` | `viewer/test/app-try.spec.js`: failed write with failed re-read; failed page load |
| H4: machine fixture had `wc/<id>` in the user checkout, not in a linked worktree as the Spec's Validation names | `tryFixture()` adds `git worktree add <root>/agent wc/0123456789ab`; tests that change the thread branch commit through it. No product code changed | `machine/test/try.test.js` `tryFixture` | all 66 try tests now run with the linked worktree |

Validation after the fixes, on the feature branch:

```text
bash machine/test/run.sh               # tests 411, pass 411, fail 0
npm --prefix viewer run test:browser   # 34 skipped, 1064 passed (11.1m), exit 0
node --test viewer/test/*.test.js      # tests 695, pass 694, fail 1: run.test.js "run validation refuses each new schema violation" (file untouched by this branch; alone: pass 8, fail 0, twice). The same suite passed 695/695 on this branch after R2b, before R2a, which changed only machine tests.
```
