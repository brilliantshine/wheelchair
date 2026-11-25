# R2c report

- `machine/lib/project-lead.js`: resets and cleans the clone before applying the non-cone exclusions on every refresh, then performs the existing detached checkout and clean. Git's sparse-checkout documentation confirms `--no-cone` accepts patterns; Git version: `git version 2.47.3`.
- `machine/test/project-lead.test.js`: covers existing clones, all excluded paths, clean projects, modified and untracked config, and `git show` access; updates the earlier Claude expectation.
- `protocol/app/project-lead.md`: tells the lead which paths are omitted and how to read them.
- `docs/plans/project-lead/reports/R2c.md`: records this work and validation.

No screenshots: this change has no visible UI or mockup.

Mutation checks: without sparse-checkout, the old-clone and dirty-clone tests failed; changing the include pattern to exclude ordinary files made the ordinary-file test fail, and changing the `git show` path to a missing file made the history-read assertion fail. Both mutations were restored. The first implementation left dirty excluded files in place; the dirty-clone test caught it, and reset plus clean before sparse-checkout fixed it.

## Validation

`node --check machine/lib/project-lead.js machine/test/project-lead.test.js`

```text
exit 0

```

`node --test machine/test/project-lead.test.js`

```text
exit 0
  duration_ms: 90.360282
  type: 'test'
  ...
# machine service listening on 127.0.0.1:33147
# Subtest: project lead relay and agent fence use the authenticated session
ok 12 - project lead relay and agent fence use the authenticated session
  ---
  duration_ms: 171.8646
  type: 'test'
  ...
# machine service listening on 127.0.0.1:41173
# Subtest: project lead records sandboxed Codex mode
ok 13 - project lead records sandboxed Codex mode
  ---
  duration_ms: 179.940828
  type: 'test'
  ...
# machine service listening on 127.0.0.1:43331
# Subtest: account switch relaunches in the clone without project tools
ok 14 - account switch relaunches in the clone without project tools
  ---
  duration_ms: 182.787837
  type: 'test'
  ...
# machine service listening on 127.0.0.1:33793
# Subtest: remote lacking the default branch uses the local default
ok 15 - remote lacking the default branch uses the local default
  ---
  duration_ms: 154.922671
  type: 'test'
  ...
# machine service listening on 127.0.0.1:44663
# Subtest: Claude project lead excludes project settings and MCP discovery
ok 16 - Claude project lead excludes project settings and MCP discovery
  ---
  duration_ms: 176.44333
  type: 'test'
  ...
# Subtest: Codex project lead disables project config by marking the clone untrusted
ok 17 - Codex project lead disables project config by marking the clone untrusted
  ---
  duration_ms: 0.243116
  type: 'test'
  ...
# Subtest: Pi project lead ignores project inputs
ok 18 - Pi project lead ignores project inputs
  ---
  duration_ms: 4.406781
  type: 'test'
  ...
# machine service listening on 127.0.0.1:42003
# Subtest: refresh applies exclusions to an older clone and keeps committed config readable through git
ok 19 - refresh applies exclusions to an older clone and keeps committed config readable through git
  ---
  duration_ms: 136.106217
  type: 'test'
  ...
# machine service listening on 127.0.0.1:45753
# Subtest: refresh keeps all ordinary files when there are no excluded paths
ok 20 - refresh keeps all ordinary files when there are no excluded paths
  ---
  duration_ms: 124.561678
  type: 'test'
  ...
# machine service listening on 127.0.0.1:40329
# Subtest: refresh removes modified and untracked excluded paths before detached checkout
ok 21 - refresh removes modified and untracked excluded paths before detached checkout
  ---
  duration_ms: 157.647126
  type: 'test'
  ...
1..21
# tests 21
# suites 0
# pass 21
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 4307.299837
```

`bash machine/test/run.sh`

```text
exit 0
ok 749 - archive waits once for a final sync and retains a failed copy
  ---
  duration_ms: 704.653884
  type: 'test'
  ...
# Subtest: sweep reconciles a dead lead with no apps
ok 750 - sweep reconciles a dead lead with no apps
  ---
  duration_ms: 1034.172912
  type: 'test'
  ...
# Subtest: sweep marks dead app copies and reconciles a shared thread worktree after a worker registered
ok 751 - sweep marks dead app copies and reconciles a shared thread worktree after a worker registered
  ---
  duration_ms: 1335.816816
  type: 'test'
  ...
# Subtest: tracker close callback marks the copy used
ok 752 - tracker close callback marks the copy used
  ---
  duration_ms: 540.255455
  type: 'test'
  ...
# Subtest: sessions sharing a worktree share the copy and Windows tool use triggers stop sync
ok 753 - sessions sharing a worktree share the copy and Windows tool use triggers stop sync
  ---
  duration_ms: 1232.488887
  type: 'test'
  ...
# Subtest: archive deletes copies while retaining conflict refs
ok 754 - archive deletes copies while retaining conflict refs
  ---
  duration_ms: 1245.039043
  type: 'test'
  ...
# Subtest: cleanup removes a vanished linked worktree copy without a reconcile
ok 755 - cleanup removes a vanished linked worktree copy without a reconcile
  ---
  duration_ms: 667.623118
  type: 'test'
  ...
# Subtest: info reports a PowerShell startup failure and environment names are case insensitive
ok 756 - info reports a PowerShell startup failure and environment names are case insensitive
  ---
  duration_ms: 0.955693
  type: 'test'
  ...
# Subtest: launch and restart mark existing copies used and recover only live copies
ok 757 - launch and restart mark existing copies used and recover only live copies
  ---
  duration_ms: 7.391174
  type: 'test'
  ...
# Subtest: launch marking causes a final reconcile after readying
ok 758 - launch marking causes a final reconcile after readying
  ---
  duration_ms: 1073.220415
  type: 'test'
  ...
# Subtest: without launch marking, readying does not cause a final reconcile
ok 759 - without launch marking, readying does not cause a final reconcile
  ---
  duration_ms: 717.756035
  type: 'test'
  ...
# Subtest: restart recovery tracks a live lead and reconciles on stop
ok 760 - restart recovery tracks a live lead and reconciles on stop
  ---
  duration_ms: 1167.116822
  type: 'test'
  ...
1..760
# tests 760
# suites 0
# pass 758
# fail 0
# cancelled 0
# skipped 2
# todo 0
# duration_ms 370130.232887
```

## Choices

- `machine/lib/project-lead.js`: reset tracked changes and clean untracked files before sparse-checkout so dirty excluded paths cannot survive its application or obstruct checkout; retain the existing clean afterward.
