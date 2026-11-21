# T3a — Windows app tracking

Outcome: blocked. The implementation and tests are committed, but the required real Notepad check failed: this machine's packaged Notepad launched processes outside the wrapper's Job Object and delegated its visible window to a separate PID. The job-only window enumeration correctly returned no windows, and the launched Notepad PIDs survived job termination. This violates the required real check and the process containment contract; the lead was notified and asked how to proceed. Do not treat this tracker as complete until that is resolved.

## Changes

- `machine/lib/win-apps.js`: named job wrapper, app lifecycle and durable records, log handling, window enumeration and PNG capture, restart cleanup, and dead-session sweep.
- `machine/test/fixtures/win/powershell.exe`: fake wrapper, termination, window capture and restart cleanup operations.
- `machine/test/win-apps.test.js`: coverage of lifecycle, logs, isolation, capture, recovery, and sweep.
- `docs/plans/windows-bridge/reports/T3.md`: removed the superseded report.

## Validation

`node --test machine/test/win-apps.test.js`:

```
exit 0
✔ run reads the done code, caps output, and does not leak the token (84.915143ms)
✔ wrapper exit without done has null code, and closure is reported (77.50678ms)
✔ job remains running until the wrapper closes; timeout terminates it (729.258296ms)
✔ four started jobs are allowed and stop returns their copy keys (129.874343ms)
✔ windows and shots are restricted to the session and reject minimized windows (269.11881ms)
✔ shots retain only the newest 50 (93.672916ms)
✔ startup kills a matching wrapper first and never kills reused PIDs (43.875427ms)
✔ sweep terminates dead sessions and returns their copy keys (197.506378ms)
ℹ tests 8
ℹ suites 0
ℹ pass 8
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1681.859653
```

`bash machine/test/run.sh` (known pre-existing missing Kimi Code failure; run before the final fake-only test refinement):

```
exit 1
✔ files appearing after back are listed (239.097081ms)
✔ a file untracked before and after Back is not in appeared (288.629234ms)
✔ a new file in an originally ignored directory whose rule the thread removed is listed on Back (286.251659ms)
✔ Back refused while pending is set (214.711892ms)
✔ after an interrupted move between threads active is kept (214.772429ms)
✔ return branch deleted or checked out elsewhere is refused (457.335139ms)
✔ stale record: Back refused; Dismiss deletes return pin when its branch contains it, else keeps it (564.678094ms)
✔ folder replaced by another clone during a trial: Dismiss keeps entries marked old identity (202.643494ms)
✔ stale version on back, dismiss and forget is refused (235.342675ms)
✔ required smudge filter failing on Back is interrupted, files recorded and no file deleted (302.877411ms)
✔ re-cloning after a completed Back allows Try (422.324932ms)
✔ tracked path colliding with an ignored file on Back is refused with the file intact (301.350037ms)
✔ Try keeps an ignored directory intact when the thread tracks its path as a file (190.930924ms)
✔ Back keeps an ignored directory intact when the earlier branch tracks its path as a file (319.450366ms)
✔ folder under state worktrees is refused (65.749079ms)
✔ real git am in progress is refused (104.297549ms)
✔ a long switch does not delay the same project agent worktree queue (2153.66235ms)
✔ two symlink spellings of one folder pressed together are refused (1179.941252ms)
✔ index.lock is shown after nothing moved and hidden while a switch runs (215.858863ms)
✔ Status for stale, moved, trying-other and mismatch includes the right fields (383.328729ms)
✔ capped file lists retain full files_count and appeared_count (655.354571ms)
✔ kept entries show missing and old_identity flags (65.227425ms)
✔ Status runs no content filter while active (268.701945ms)
✔ required smudge filter failing on a move between threads records exact interrupted paths (365.065816ms)
✔ real git switch unable to unlink warning is interrupted (216.636031ms)
✔ commit subject containing unable to unlink gives plain success (205.698885ms)
✔ hanging filter subprocess outlives deadline and its whole process group is killed (598.05975ms)
✔ delayed process filter failing after HEAD moved records files across reload (242.258459ms)
✔ run reads the done code, caps output, and does not leak the token (98.691153ms)
✔ wrapper exit without done has null code, and closure is reported (92.055816ms)
✔ job remains running until the wrapper closes; timeout terminates it (741.066249ms)
✔ four started jobs are allowed and stop returns their copy keys (138.713419ms)
✔ windows and shots are restricted to the session and reject minimized windows (326.816684ms)
✔ shots retain only the newest 50 (113.953642ms)
✔ startup kills a matching wrapper first and never kills reused PIDs (50.897571ms)
✔ sweep terminates dead sessions and returns their copy keys (201.78379ms)
✔ parses every operation (2.144736ms)
✔ rejects invalid operations and arguments with 400 (0.638403ms)
✔ detects WSL and its mount root (5.097279ms)
✔ repairs interop without leaking token or mutating the input (0.732425ms)
✔ PowerShell startup failure includes interop guidance (7.545154ms)
✔ gitWin translates a Windows path and runs real git in the copy (130.562658ms)
✔ state is persisted and unresolved paths are reported (6.585782ms)
✔ reconcile transfers additions, edits, deletions, renames and independent changes (1821.061102ms)
✔ text conflicts preserve the Windows version and mask markers until resolved (1750.676061ms)
✔ binary and modify/delete conflicts choose Linux and save Windows (975.384106ms)
✔ refuses case collisions and leaves external symlinks out (566.200553ms)
✔ refuses after two changes during apply without losing edits (1101.490991ms)
✔ interrupted Windows apply is resumed after another Linux edit (1182.958724ms)
✔ raw bytes, executable mode, force-added and newly ignored files (1216.253321ms)
✔ seeding copies only ignored paths accepted by the new worktree (758.473835ms)
✔ deleting unresolved copies saves the Windows snapshot and removes copy refs (918.521838ms)
✔ concurrent reconciles for the same copy are serialized (965.846534ms)
✔ interrupted conflict application retains marker masking on the next sync (1271.168257ms)
✔ later force-add, repeated tracked deletion, and successive Windows edits sync (1879.883895ms)
✔ clean checkout LFS and eol attributes do not transform bridge bytes (556.739251ms)
ℹ tests 474
ℹ suites 0
ℹ pass 473
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 38216.667153

✖ failing tests:

test at machine/test/kimi.test.js:164:1
✖ new login clears previous result and uses exact target (108.726251ms)
  Error: Kimi Code is not installed
      at MachineService.startLogin (/home/gleam/.local/state/wheelchair/worktrees/wheelchair/wc-c833faa8e033-w5/machine/service.js:1471:70)
      at TestContext.<anonymous> (/home/gleam/.local/state/wheelchair/worktrees/wheelchair/wc-c833faa8e033-w5/machine/test/kimi.test.js:168:17)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1402:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:974:18)
      at Test.postRun (node:internal/test_runner/test:1542:19)
      at Test.run (node:internal/test_runner/test:1467:12)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    status: 409
  }
```

## Windows checks

The wrapper ran `cmd.exe /c exit 256` and returned `{"done":{"exit_code":256}}`; it started Notepad and printed the PID. A real named-job termination returned `terminated` and closed its wrapper. The tracker returned the following for the two required command checks:

```
{ exit_code: 0, timed_out: false, output: 'hi\r\n', log: '/tmp/wc-t3a-check/win/wc-check/logs/efb53f7a-d65c-41cd-a030-9b0fb27a4c21.log' }
{ exit_code: 256, timed_out: false, output: '', log: '/tmp/wc-t3a-check/win/wc-check/logs/7e2fdd0d-b240-4605-bbd7-4b895e02559d.log' }
```

The Notepad gate yielded:

```
started { id: 'f4282766-98a4-4a5a-9bbf-306e71043ece', pid: 8352, log: '/tmp/wc-t3a-windows/win/wc-check/logs/f4282766-98a4-4a5a-9bbf-306e71043ece.log' }
status: running true
windows { windows: [] }
stop { stopped: [ 'f4282766-98a4-4a5a-9bbf-306e71043ece' ], wasRunning: true, copyKeys: [ 'x' ] }
Error: No window
```

A diagnostic showed the launched PID had no main window, while another Notepad PID held the visible window. Two known test-created launcher PIDs still existed after stop and were terminated after matching their recorded creation times. The first test also created an initially blank Notepad window within 84 ms of its launcher; a normal close was requested but its process remained present. No Notepad screenshot was produced; the required no-Notepad-process assertion was not met.

A separate job-contained WinForms window yielded:

```
windows { windows: [{ handle: '919674', title: 'Tracker test window', pid: 18680, app_id: 'c3984676-1f6d-4c75-8009-c73a1f691bcb', minimized: false }] }
shot { path: '/tmp/wc-t3a-forms/win/wc-check/shots/1795244764854.png' }
stop { stopped: [ 'c3984676-1f6d-4c75-8009-c73a1f691bcb' ], wasRunning: true, copyKeys: [ 'x' ] }
```

I opened that PNG and confirmed it showed the test window. A real restart recovery check started `cmd.exe` running ping, loaded its recorded wrapper in a new tracker, marked it exited with null exit code, and confirmed the recorded program PID no longer existed.

## Choices

- `win-apps.js`: store creation times as exact decimal strings in memory and serialize them as JSON numbers, preserving FILETIME precision across JavaScript parsing.
- `win-apps.js`: use decimal window-handle strings and timestamp-based numeric PNG names; retain the 50 greatest names.
- `win-apps.js`: reject an unknown requested app ID with status 400.
