# R1b — absolute image paths

## Changes

- `viewer/app/card.js`: require a non-empty absolute path for image cards.
- `machine/service.js`: reject non-string or relative image paths with 422 before file checks or copying.
- `viewer/test/app-hub.test.js`: cover relative paths and an absolute path in image-card validation.
- `machine/test/service.test.js`: cover the 422 response and absence of spooled or copied files.

## Validation

`npm --prefix viewer ci` (dependencies were missing; exit 0):

```text
added 5 packages, and audited 6 packages in 375ms

2 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

`bash machine/test/run.sh` (exit 0):

```text
TAP version 13
# Subtest: exhausted windows and expired resets choose a future reset
ok 1 - exhausted windows and expired resets choose a future reset
  ---
  duration_ms: 1.057889
  type: 'test'
  ...
# Subtest: adapters seed account files and locate transcripts
ok 2 - adapters seed account files and locate transcripts
  ---
  duration_ms: 5.906259
  type: 'test'
  ...
# Subtest: Codex rollout fixture maps windows by their lengths
ok 3 - Codex rollout fixture maps windows by their lengths
  ---
  duration_ms: 0.413433
  type: 'test'
  ...
# Subtest: Claude failure hooks and status line survive an offline service
ok 4 - Claude failure hooks and status line survive an offline service
  ---
  duration_ms: 67.269105
  type: 'test'
  ...
# Subtest: captured login screens parse wrapped URLs and device codes
ok 5 - captured login screens parse wrapped URLs and device codes
  ---
  duration_ms: 0.897071
  type: 'test'
  ...
# Subtest: seed links instruction files and preserves existing Codex configuration
ok 6 - seed links instruction files and preserves existing Codex configuration
  ---
  duration_ms: 0.631561
  type: 'test'
  ...
# Subtest: Codex maps both quota windows and reached flag
ok 7 - Codex maps both quota windows and reached flag
  ---
  duration_ms: 0.15596
  type: 'test'
  ...
# machine service listening on 127.0.0.1:39365
# Subtest: hub route refuses a session token
ok 8 - hub route refuses a session token
  ---
  duration_ms: 59.127229
  type: 'test'
  ...
# machine service listening on 127.0.0.1:32959
# Subtest: archive stops the thread sessions and not another thread
ok 9 - archive stops the thread sessions and not another thread
  ---
  duration_ms: 112.175869
  type: 'test'
  ...
# machine service listening on 127.0.0.1:45355
# Subtest: archive commits a dirty worktree and removes it while retaining its branch
ok 10 - archive commits a dirty worktree and removes it while retaining its branch
  ---
  duration_ms: 145.98618
  type: 'test'
  ...
# machine service listening on 127.0.0.1:33497
# Subtest: archive forgets sessions whose worktree was already removed
ok 11 - archive forgets sessions whose worktree was already removed
  ---
  duration_ms: 111.462941
  type: 'test'
  ...
# machine service listening on 127.0.0.1:36969
# Subtest: archive commits a worktree mid-merge as it stands
ok 12 - archive commits a worktree mid-merge as it stands
  ---
  duration_ms: 155.631578
  type: 'test'
  ...
# machine service listening on 127.0.0.1:39899
# Subtest: archive keeps and reports a worktree mid-rebase
ok 13 - archive keeps and reports a worktree mid-rebase
  ---
  duration_ms: 128.90176
  type: 'test'
  ...
# machine service listening on 127.0.0.1:45783
# Subtest: a retained rebase worktree is removed by archive after the rebase is aborted
ok 14 - a retained rebase worktree is removed by archive after the rebase is aborted
  ---
  duration_ms: 187.044079
  type: 'test'
  ...
# machine service listening on 127.0.0.1:39543
# Subtest: archive route refuses a session token
ok 15 - archive route refuses a session token
  ---
  duration_ms: 35.743237
  type: 'test'
  ...
# machine service listening on 127.0.0.1:42611
# Subtest: agent route refuses the machine secret
ok 16 - agent route refuses the machine secret
  ---
  duration_ms: 39.193606
  type: 'test'
  ...
# machine service listening on 127.0.0.1:41473
# Subtest: Claude command line has session, hooks, auto permission, and appended role prompt
ok 17 - Claude command line has session, hooks, auto permission, and appended role prompt
  ---
  duration_ms: 47.385057
  type: 'test'
  ...
# machine service listening on 127.0.0.1:39507
# Subtest: Codex command line has session-name notify and inline projects trust
ok 18 - Codex command line has session-name notify and inline projects trust
  ---
  duration_ms: 53.032429
  type: 'test'
  ...
# machine service listening on 127.0.0.1:41553
# Subtest: Claude trust dialog is answered Down then Enter
ok 19 - Claude trust dialog is answered Down then Enter
  ---
  duration_ms: 48.797536
  type: 'test'
  ...
# machine service listening on 127.0.0.1:39551
# Subtest: session is stuck after 30 seconds then becomes ready
ok 20 - session is stuck after 30 seconds then becomes ready
  ---
  duration_ms: 48.186554
  type: 'test'
  ...
# machine service listening on 127.0.0.1:40667
# Subtest: submit is bracketed paste followed by one Enter
ok 21 - submit is bracketed paste followed by one Enter
  ---
  duration_ms: 56.770239
  type: 'test'
  ...
# machine service listening on 127.0.0.1:33003
# Subtest: raw keys add no Enter
ok 22 - raw keys add no Enter
  ---
  duration_ms: 46.007455
  type: 'test'
  ...
# machine service listening on 127.0.0.1:40561
# Subtest: hook posts a turn-ended event
ok 23 - hook posts a turn-ended event
  ---
  duration_ms: 37.171036
  type: 'test'
  ...
# machine service listening on 127.0.0.1:40633
# Subtest: hook posts a permission prompt
ok 24 - hook posts a permission prompt
  ---
  duration_ms: 36.49052
  type: 'test'
  ...
# machine service listening on 127.0.0.1:46359
# Subtest: hook ignores an idle prompt
ok 25 - hook ignores an idle prompt
  ---
  duration_ms: 39.296052
  type: 'test'
  ...
# machine service listening on 127.0.0.1:33443
# machine service listening on 127.0.0.1:39009
# Subtest: down-service hook is rebound to its session and drained when service starts
ok 26 - down-service hook is rebound to its session and drained when service starts
  ---
  duration_ms: 112.517143
  type: 'test'
  ...
# machine service listening on 127.0.0.1:39903
# Subtest: Codex binding rejects title notify and requires literal role marker plus rollout
ok 27 - Codex binding rejects title notify and requires literal role marker plus rollout
  ---
  duration_ms: 60.783676
  type: 'test'
  ...
# machine service listening on 127.0.0.1:33135
# Subtest: transcript copy dedupes content after source shrinks
ok 28 - transcript copy dedupes content after source shrinks
  ---
  duration_ms: 45.105715
  type: 'test'
  ...
# machine service listening on 127.0.0.1:36331
# Subtest: card spool keeps order and retries until acknowledged
ok 29 - card spool keeps order and retries until acknowledged
  ---
  duration_ms: 41.577938
  type: 'test'
  ...
# machine service listening on 127.0.0.1:42061
# machine: rejected cards spool 001794784719440-0685cc46-1d11-4b18-92ce-616557313da9.json: worker may not post done
# Subtest: a refused card is returned to its worker, retained as rejected, and does not stop a following result
ok 30 - a refused card is returned to its worker, retained as rejected, and does not stop a following result
  ---
  duration_ms: 66.517333
  type: 'test'
  ...
# machine service listening on 127.0.0.1:41773
# machine: rejected cards spool 001794784719505-1321d5cd-9436-4538-98fe-68f9b91a90a5.json: worker may not post done
# Subtest: a refused spooled card moves aside and the following card drains
ok 31 - a refused spooled card moves aside and the following card drains
  ---
  duration_ms: 65.124462
  type: 'test'
  ...
# machine service listening on 127.0.0.1:43351
# Subtest: concurrent card drains send each spooled card exactly once
ok 32 - concurrent card drains send each spooled card exactly once
  ---
  duration_ms: 39.354013
  type: 'test'
  ...
# machine service listening on 127.0.0.1:35833
# Subtest: status keeps the version read when the service was constructed
ok 33 - status keeps the version read when the service was constructed
  ---
  duration_ms: 60.306782
  type: 'test'
  ...
# machine service listening on 127.0.0.1:34791
# Subtest: a worktree starts from origin trunk and records trunk as its default branch
ok 34 - a worktree starts from origin trunk and records trunk as its default branch
  ---
  duration_ms: 107.144097
  type: 'test'
  ...
# machine service listening on 127.0.0.1:40549
# Subtest: a worker restart reuses its worktree and branch, while a missing worktree is refused
ok 35 - a worker restart reuses its worktree and branch, while a missing worktree is refused
  ---
  duration_ms: 179.070766
  type: 'test'
  ...
# machine service listening on 127.0.0.1:43559
# Subtest: transcript copies wait for a complete JSONL line before advancing their offset
ok 36 - transcript copies wait for a complete JSONL line before advancing their offset
  ---
  duration_ms: 37.865308
  type: 'test'
  ...
# machine service listening on 127.0.0.1:46247
# Subtest: a live session serves its kept transcript copy after the source transcript disappears
ok 37 - a live session serves its kept transcript copy after the source transcript disappears
  ---
  duration_ms: 38.50812
  type: 'test'
  ...
# machine service listening on 127.0.0.1:37247
# Subtest: Claude trust is checked within a second instead of waiting for the two-second readiness poll
ok 38 - Claude trust is checked within a second instead of waiting for the two-second readiness poll
  ---
  duration_ms: 534.220932
  type: 'test'
  ...
# machine service listening on 127.0.0.1:37161
# Subtest: agent session forward retries then reports hub unavailable
ok 39 - agent session forward retries then reports hub unavailable
  ---
  duration_ms: 62.817928
  type: 'test'
  ...
# machine service listening on 127.0.0.1:43647
# Subtest: git refuses paths outside the calling worktree
ok 40 - git refuses paths outside the calling worktree
  ---
  duration_ms: 38.394193
  type: 'test'
  ...
# machine service listening on 127.0.0.1:44937
# Subtest: git commit refuses no paths
ok 41 - git commit refuses no paths
  ---
  duration_ms: 38.679028
  type: 'test'
  ...
# machine service listening on 127.0.0.1:37291
# Subtest: a verifier gets its own detached worktree at the lead's unpushed commit
ok 42 - a verifier gets its own detached worktree at the lead's unpushed commit
  ---
  duration_ms: 156.405162
  type: 'test'
  ...
# machine service listening on 127.0.0.1:40089
# Subtest: stopping a verifier removes its throwaway worktree even with untracked files
ok 43 - stopping a verifier removes its throwaway worktree even with untracked files
  ---
  duration_ms: 155.024735
  type: 'test'
  ...
# machine service listening on 127.0.0.1:35657
# machine: rejected events spool 001794784720992-d9e0511b-eb4c-4f42-a316-1389f9cf7ea2.json: hub refused (400)
# Subtest: a hub refusal reaches the agent at once, without retries
ok 44 - a hub refusal reaches the agent at once, without retries
  ---
  duration_ms: 38.310391
  type: 'test'
  ...
# machine service listening on 127.0.0.1:45305
# Subtest: a commit with no message is refused rather than titled for the agent
ok 45 - a commit with no message is refused rather than titled for the agent
  ---
  duration_ms: 99.612592
  type: 'test'
  ...
# machine service listening on 127.0.0.1:39361
# Subtest: a thread branch made from origin/main tracks nothing
ok 46 - a thread branch made from origin/main tracks nothing
  ---
  duration_ms: 101.386925
  type: 'test'
  ...
# machine service listening on 127.0.0.1:40905
# Subtest: a hub 500 reaches the agent at once; a 502 is retried
ok 47 - a hub 500 reaches the agent at once; a 502 is retried
  ---
  duration_ms: 71.470274
  type: 'test'
  ...
# machine service listening on 127.0.0.1:34981
# Subtest: a refused start is a 400 with the reason
ok 48 - a refused start is a 400 with the reason
  ---
  duration_ms: 17.462222
  type: 'test'
  ...
# Subtest: a Codex notify payload is posted as turn-ended, keeping its last message
ok 49 - a Codex notify payload is posted as turn-ended, keeping its last message
  ---
  duration_ms: 37.861029
  type: 'test'
  ...
# machine service listening on 127.0.0.1:34707
# Subtest: an archived session's kept transcript is still served; an unknown one is not
ok 50 - an archived session's kept transcript is still served; an unknown one is not
  ---
  duration_ms: 250.451978
  type: 'test'
  ...
# machine service listening on 127.0.0.1:37577
# Subtest: a stopped session is not reported stuck while it shuts down
ok 51 - a stopped session is not reported stuck while it shuts down
  ---
  duration_ms: 79.059049
  type: 'test'
  ...
# machine service listening on 127.0.0.1:34135
# Subtest: a relayed permission prompt is reported cleared when the pane shows input again
ok 52 - a relayed permission prompt is reported cleared when the pane shows input again
  ---
  duration_ms: 148.026131
  type: 'test'
  ...
# machine service listening on 127.0.0.1:38377
# Subtest: a Claude transcript is found by session id before any Stop hook
ok 53 - a Claude transcript is found by session id before any Stop hook
  ---
  duration_ms: 113.961694
  type: 'test'
  ...
# machine service listening on 127.0.0.1:46211
# Subtest: the spool is retried on a timer until the hub acknowledges
ok 54 - the spool is retried on a timer until the hub acknowledges
  ---
  duration_ms: 117.191669
  type: 'test'
  ...
# machine service listening on 127.0.0.1:43591
# Subtest: status lists other tmux sessions read-only and typing into them is refused
ok 55 - status lists other tmux sessions read-only and typing into them is refused
  ---
  duration_ms: 190.67841
  type: 'test'
  ...
# machine service listening on 127.0.0.1:46593
# Subtest: a live wc-* tmux session missing from sessions.json is rebuilt and tokenless
ok 56 - a live wc-* tmux session missing from sessions.json is rebuilt and tokenless
  ---
  duration_ms: 100.924257
  type: 'test'
  ...
# machine service listening on 127.0.0.1:34945
# Subtest: worktree-remove: only a merged, finished worker of the same thread, called by a sub-lead
ok 57 - worktree-remove: only a merged, finished worker of the same thread, called by a sub-lead
  ---
  duration_ms: 344.468848
  type: 'test'
  ...
# machine service listening on 127.0.0.1:45857
# machine service listening on 127.0.0.1:42493
# Subtest: a Claude session gets the model the hub chose, and none when it chose none
ok 58 - a Claude session gets the model the hub chose, and none when it chose none
  ---
  duration_ms: 105.858762
  type: 'test'
  ...
# machine service listening on 127.0.0.1:36159
# Subtest: Claude login comes from claude auth status
ok 59 - Claude login comes from claude auth status
  ---
  duration_ms: 82.522331
  type: 'test'
  ...
# machine service listening on 127.0.0.1:44929
# Subtest: permission_mode: auto by default and when named, bypass maps to bypassPermissions, anything else is refused
ok 60 - permission_mode: auto by default and when named, bypass maps to bypassPermissions, anything else is refused
  ---
  duration_ms: 107.439694
  type: 'test'
  ...
# machine service listening on 127.0.0.1:40331
# Subtest: permission_mode does not change Codex
ok 61 - permission_mode does not change Codex
  ---
  duration_ms: 68.108435
  type: 'test'
  ...
# machine service listening on 127.0.0.1:38669
# Subtest: codex_mode: sandboxed by default, unrestricted drops the sandbox, reviewers stay read-only, anything else is refused
ok 62 - codex_mode: sandboxed by default, unrestricted drops the sandbox, reviewers stay read-only, anything else is refused
  ---
  duration_ms: 186.209058
  type: 'test'
  ...
# machine service listening on 127.0.0.1:40427
# Subtest: codex_mode does not change Claude
ok 63 - codex_mode does not change Claude
  ---
  duration_ms: 48.235018
  type: 'test'
  ...
# machine service listening on 127.0.0.1:39891
# Subtest: Codex effort is passed as model_reasoning_effort when set
ok 64 - Codex effort is passed as model_reasoning_effort when set
  ---
  duration_ms: 76.243007
  type: 'test'
  ...
# machine service listening on 127.0.0.1:32933
# Subtest: Codex without effort has no model_reasoning_effort setting
ok 65 - Codex without effort has no model_reasoning_effort setting
  ---
  duration_ms: 70.749911
  type: 'test'
  ...
# machine service listening on 127.0.0.1:43431
# Subtest: a bypass session is ready on the bypass status line, not on the auto one, and an auto session the reverse
ok 66 - a bypass session is ready on the bypass status line, not on the auto one, and an auto session the reverse
  ---
  duration_ms: 99.135677
  type: 'test'
  ...
# machine service listening on 127.0.0.1:45195
# Subtest: a Bypass Permissions confirmation is answered Down then Enter, and the session is not ready until it clears
ok 67 - a Bypass Permissions confirmation is answered Down then Enter, and the session is not ready until it clears
  ---
  duration_ms: 76.762895
  type: 'test'
  ...
# machine service listening on 127.0.0.1:41085
# Subtest: effort adds --effort for Claude and is refused when unknown
ok 68 - effort adds --effort for Claude and is refused when unknown
  ---
  duration_ms: 219.101137
  type: 'test'
  ...
# machine service listening on 127.0.0.1:44639
# Subtest: role_layers follow the local pointer for Claude; the pointer carries the new sentence with or without layers
ok 69 - role_layers follow the local pointer for Claude; the pointer carries the new sentence with or without layers
  ---
  duration_ms: 102.857115
  type: 'test'
  ...
# machine service listening on 127.0.0.1:34049
# Subtest: role_layers follow the local pointer in the Codex [wc:role] message
ok 70 - role_layers follow the local pointer in the Codex [wc:role] message
  ---
  duration_ms: 62.796236
  type: 'test'
  ...
# machine service listening on 127.0.0.1:32915
# machine service listening on 127.0.0.1:34775
# Subtest: role_prompt wins over role_layers for both CLIs
ok 71 - role_prompt wins over role_layers for both CLIs
  ---
  duration_ms: 108.503946
  type: 'test'
  ...
# machine service listening on 127.0.0.1:42241
# Subtest: /v1/preview runs claude -p with the prompt on stdin and returns trimmed stdout
ok 72 - /v1/preview runs claude -p with the prompt on stdin and returns trimmed stdout
  ---
  duration_ms: 29.666381
  type: 'test'
  ...
# machine service listening on 127.0.0.1:45423
# Subtest: /v1/preview refuses a bad request, a session token, and reports a non-zero exit with the last stderr line
ok 73 - /v1/preview refuses a bad request, a session token, and reports a non-zero exit with the last stderr line
  ---
  duration_ms: 49.819136
  type: 'test'
  ...
# machine service listening on 127.0.0.1:36445
# Subtest: /v1/preview times out with 504 without blocking the service, and reports claude not installed with 503
ok 74 - /v1/preview times out with 504 without blocking the service, and reports claude not installed with 503
  ---
  duration_ms: 324.271278
  type: 'test'
  ...
# machine service listening on 127.0.0.1:46847
# Subtest: account starts bind the CLI environment, validate directories, and report account status
ok 75 - account starts bind the CLI environment, validate directories, and report account status
  ---
  duration_ms: 145.185623
  type: 'test'
  ...
# machine service listening on 127.0.0.1:35279
# Subtest: usage and failures are forwarded with account and limit time
ok 76 - usage and failures are forwarded with account and limit time
  ---
  duration_ms: 47.918529
  type: 'test'
  ...
# machine service listening on 127.0.0.1:45407
# Subtest: statusline posts a live reading and preflight accepts an account directory
ok 77 - statusline posts a live reading and preflight accepts an account directory
  ---
  duration_ms: 247.14159
  type: 'test'
  ...
# machine service listening on 127.0.0.1:42283
# Subtest: login sessions start, expose state, accept code and stay out of session recovery
ok 78 - login sessions start, expose state, accept code and stay out of session recovery
  ---
  duration_ms: 195.79829
  type: 'test'
  ...
# machine service listening on 127.0.0.1:32881
# Subtest: Claude login menu is answered once across repeated login state reads
ok 79 - Claude login menu is answered once across repeated login state reads
  ---
  duration_ms: 79.578967
  type: 'test'
  ...
# machine service listening on 127.0.0.1:34435
# Subtest: default Claude start preserves complete command and settings
ok 80 - default Claude start preserves complete command and settings
  ---
  duration_ms: 152.289609
  type: 'test'
  ...
# machine service listening on 127.0.0.1:32871
# Subtest: Codex account turn ends read only new rollout lines and report limits
ok 81 - Codex account turn ends read only new rollout lines and report limits
  ---
  duration_ms: 75.782534
  type: 'test'
  ...
# machine service listening on 127.0.0.1:34681
# machine service listening on 127.0.0.1:40193
# Subtest: spooled Codex turn end carries its limit reading on drain
ok 82 - spooled Codex turn end carries its limit reading on drain
  ---
  duration_ms: 132.518506
  type: 'test'
  ...
# machine service listening on 127.0.0.1:36259
# Subtest: Codex raw spool retries the same prepared reading
ok 83 - Codex raw spool retries the same prepared reading
  ---
  duration_ms: 67.535947
  type: 'test'
  ...
# machine service listening on 127.0.0.1:42049
# Subtest: Codex live hook retries the same prepared reading
ok 84 - Codex live hook retries the same prepared reading
  ---
  duration_ms: 63.093456
  type: 'test'
  ...
# machine service listening on 127.0.0.1:34095
# Subtest: /v1/projects lists git folders, expands ~, and checks paths
ok 85 - /v1/projects lists git folders, expands ~, and checks paths
  ---
  duration_ms: 41.192229
  type: 'test'
  ...
# machine service listening on 127.0.0.1:41697
# Subtest: uploads sanitize, stream, serve, and enforce admission and size
ok 86 - uploads sanitize, stream, serve, and enforce admission and size
  ---
  duration_ms: 154.678691
  type: 'test'
  ...
# machine service listening on 127.0.0.1:37495
# Subtest: image cards are validated and copied before spooling, including archive ordering
ok 87 - image cards are validated and copied before spooling, including archive ordering
  ---
  duration_ms: 67.028343
  type: 'test'
  ...
# machine service listening on 127.0.0.1:38129
# Subtest: archive cancels a paused upload before acquiring the lock
ok 88 - archive cancels a paused upload before acquiring the lock
  ---
  duration_ms: 60.639279
  type: 'test'
  ...
# machine service listening on 127.0.0.1:32805
# Subtest: a retained non-rebase session cannot post an image after archive
ok 89 - a retained non-rebase session cannot post an image after archive
  ---
  duration_ms: 56.883445
  type: 'test'
  ...
1..89
# tests 89
# suites 0
# pass 89
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 11524.271144
```

`node --test viewer/test/*.test.js` (exit 0):

```text
TAP version 13
# Subtest: default placement, strict and preferred constraints, and invalid flags
ok 1 - default placement, strict and preferred constraints, and invalid flags
  ---
  duration_ms: 1093.645705
  type: 'test'
  ...
# Subtest: placement ranks accounts and respects provider policy
    # Subtest: soonest
    ok 1 - soonest
      ---
      duration_ms: 104.283411
      type: 'test'
      ...
    # Subtest: spread
    ok 2 - spread
      ---
      duration_ms: 105.3412
      type: 'test'
      ...
    # Subtest: one
    ok 3 - one
      ---
      duration_ms: 111.602939
      type: 'test'
      ...
    # Subtest: leave, paused and signed out
    ok 4 - leave, paused and signed out
      ---
      duration_ms: 253.24653
      type: 'test'
      ...
    # Subtest: save Claude and pinned leads
    ok 5 - save Claude and pinned leads
      ---
      duration_ms: 252.370989
      type: 'test'
      ...
    # Subtest: lead any and constraint fallback
    ok 6 - lead any and constraint fallback
      ---
      duration_ms: 678.50751
      type: 'test'
      ...
    # Subtest: wait estimate accounts for every exhausted window
    ok 7 - wait estimate accounts for every exhausted window
      ---
      duration_ms: 121.709024
      type: 'test'
      ...
    # Subtest: reviewers and verifiers wait when neither provider has room
    ok 8 - reviewers and verifiers wait when neither provider has room
      ---
      duration_ms: 146.36267
      type: 'test'
      ...
    # Subtest: margin skips Claude for workers but not leads
    ok 9 - margin skips Claude for workers but not leads
      ---
      duration_ms: 164.292441
      type: 'test'
      ...
    1..9
ok 2 - placement ranks accounts and respects provider policy
  ---
  duration_ms: 1949.609565
  type: 'test'
  ...
# Subtest: a reading promotes the same waiting worker and keeps its queue
ok 3 - a reading promotes the same waiting worker and keeps its queue
  ---
  duration_ms: 613.939175
  type: 'test'
  ...
# Subtest: a turn-ended reading promotes the same waiting worker and keeps its token
ok 4 - a turn-ended reading promotes the same waiting worker and keeps its token
  ---
  duration_ms: 796.636236
  type: 'test'
  ...
# Subtest: limit hold releases with Continue and failed turns notify without a result
ok 5 - limit hold releases with Continue and failed turns notify without a result
  ---
  duration_ms: 589.032482
  type: 'test'
  ...
# Subtest: promotion failure marks the waiting session failed
ok 6 - promotion failure marks the waiting session failed
  ---
  duration_ms: 550.617942
  type: 'test'
  ...
# Subtest: waiting sessions survive polling and stop without a machine call
ok 7 - waiting sessions survive polling and stop without a machine call
  ---
  duration_ms: 391.23111
  type: 'test'
  ...
# Subtest: old threads acquire a provider on first read
ok 8 - old threads acquire a provider on first read
  ---
  duration_ms: 5.195986
  type: 'test'
  ...
# Subtest: unused worker cell refuses a strict provider
ok 9 - unused worker cell refuses a strict provider
  ---
  duration_ms: 382.794769
  type: 'test'
  ...
# Subtest: preflight retries on the other signed-in GPT account
ok 10 - preflight retries on the other signed-in GPT account
  ---
  duration_ms: 522.925906
  type: 'test'
  ...
# Subtest: startup promotes a waiting session when room is available
ok 11 - startup promotes a waiting session when room is available
  ---
  duration_ms: 354.264777
  type: 'test'
  ...
# Subtest: worker placement uses account login on its own machine
ok 12 - worker placement uses account login on its own machine
  ---
  duration_ms: 173.21294
  type: 'test'
  ...
# Subtest: limited verifier reports only after release and continuation
ok 13 - limited verifier reports only after release and continuation
  ---
  duration_ms: 332.73977
  type: 'test'
  ...
# Subtest: reviewer: live limit-ended delivery
ok 14 - reviewer: live limit-ended delivery
  ---
  duration_ms: 339.029083
  type: 'test'
  ...
# Subtest: reviewer: late limit-ended delivery
ok 15 - reviewer: late limit-ended delivery
  ---
  duration_ms: 335.738833
  type: 'test'
  ...
# Subtest: reviewer: spooled retry limit-ended delivery
ok 16 - reviewer: spooled retry limit-ended delivery
  ---
  duration_ms: 330.59635
  type: 'test'
  ...
# Subtest: reviewer: limit-hit limit-ended delivery
ok 17 - reviewer: limit-hit limit-ended delivery
  ---
  duration_ms: 335.449618
  type: 'test'
  ...
# Subtest: reviewer: control limit-ended delivery
ok 18 - reviewer: control limit-ended delivery
  ---
  duration_ms: 331.912985
  type: 'test'
  ...
# Subtest: verifier: live limit-ended delivery
ok 19 - verifier: live limit-ended delivery
  ---
  duration_ms: 340.473133
  type: 'test'
  ...
# Subtest: verifier: late limit-ended delivery
ok 20 - verifier: late limit-ended delivery
  ---
  duration_ms: 363.137394
  type: 'test'
  ...
# Subtest: verifier: spooled retry limit-ended delivery
ok 21 - verifier: spooled retry limit-ended delivery
  ---
  duration_ms: 357.153326
  type: 'test'
  ...
# Subtest: verifier: limit-hit limit-ended delivery
ok 22 - verifier: limit-hit limit-ended delivery
  ---
  duration_ms: 376.146426
  type: 'test'
  ...
# Subtest: verifier: control limit-ended delivery
ok 23 - verifier: control limit-ended delivery
  ---
  duration_ms: 391.253001
  type: 'test'
  ...
# Subtest: worker: live limit-ended delivery
ok 24 - worker: live limit-ended delivery
  ---
  duration_ms: 513.145447
  type: 'test'
  ...
# Subtest: worker: late limit-ended delivery
ok 25 - worker: late limit-ended delivery
  ---
  duration_ms: 561.412866
  type: 'test'
  ...
# Subtest: worker: spooled retry limit-ended delivery
ok 26 - worker: spooled retry limit-ended delivery
  ---
  duration_ms: 480.528756
  type: 'test'
  ...
# Subtest: worker: limit-hit limit-ended delivery
ok 27 - worker: limit-hit limit-ended delivery
  ---
  duration_ms: 517.371412
  type: 'test'
  ...
# Subtest: worker: control limit-ended delivery
ok 28 - worker: control limit-ended delivery
  ---
  duration_ms: 491.205265
  type: 'test'
  ...
# Subtest: waiting lead records provider and promoted role layers and style
ok 29 - waiting lead records provider and promoted role layers and style
  ---
  duration_ms: 305.068845
  type: 'test'
  ...
# Subtest: renders a Claude human turn after unwrapping pasted content
ok 30 - renders a Claude human turn after unwrapping pasted content
  ---
  duration_ms: 3.234944
  type: 'test'
  ...
# Subtest: hides a Claude role turn and its reply
ok 31 - hides a Claude role turn and its reply
  ---
  duration_ms: 0.336034
  type: 'test'
  ...
# Subtest: replaces a stub context marker and keeps its lead reply
ok 32 - replaces a stub context marker and keeps its lead reply
  ---
  duration_ms: 0.261232
  type: 'test'
  ...
# Subtest: replaces a restart context marker and keeps its lead reply
ok 33 - replaces a restart context marker and keeps its lead reply
  ---
  duration_ms: 0.196857
  type: 'test'
  ...
# Subtest: renders a card press as a short Collin bubble
ok 34 - renders a card press as a short Collin bubble
  ---
  duration_ms: 0.53688
  type: 'test'
  ...
# Subtest: collapses a Claude tool call to one chat item
ok 35 - collapses a Claude tool call to one chat item
  ---
  duration_ms: 0.306888
  type: 'test'
  ...
# Subtest: ignores Codex injected entries before turn_context
ok 36 - ignores Codex injected entries before turn_context
  ---
  duration_ms: 0.562799
  type: 'test'
  ...
# Subtest: does not let Codex task_started open a human turn before turn_context
ok 37 - does not let Codex task_started open a human turn before turn_context
  ---
  duration_ms: 0.242655
  type: 'test'
  ...
# Subtest: requires a fresh Codex turn_context for each turn
ok 38 - requires a fresh Codex turn_context for each turn
  ---
  duration_ms: 0.688751
  type: 'test'
  ...
# Subtest: collapses a Codex function call to one chat item
ok 39 - collapses a Codex function call to one chat item
  ---
  duration_ms: 0.560936
  type: 'test'
  ...
# Subtest: uses each transcript line timestamp for chat items
ok 40 - uses each transcript line timestamp for chat items
  ---
  duration_ms: 0.319333
  type: 'test'
  ...
# Subtest: a line without a timestamp takes the previous one, and Claude echoes are not repeated
ok 41 - a line without a timestamp takes the previous one, and Claude echoes are not repeated
  ---
  duration_ms: 0.407001
  type: 'test'
  ...
# Subtest: folds a Claude tool result into its call, cut at 2000 characters
ok 42 - folds a Claude tool result into its call, cut at 2000 characters
  ---
  duration_ms: 0.642492
  type: 'test'
  ...
# Subtest: folds a Codex function_call_output into its call
ok 43 - folds a Codex function_call_output into its call
  ---
  duration_ms: 0.258746
  type: 'test'
  ...
# Subtest: GET /threads/:id/graph reads an archived thread graph from its branch, and nothing else
ok 44 - GET /threads/:id/graph reads an archived thread graph from its branch, and nothing else
  ---
  duration_ms: 614.636633
  type: 'test'
  ...
# Subtest: accepts a valid card for its own lead
ok 45 - accepts a valid card for its own lead
  ---
  duration_ms: 553.083421
  type: 'test'
  ...
# Subtest: stores an ISO timestamp on every card
ok 46 - stores an ISO timestamp on every card
  ---
  duration_ms: 352.761253
  type: 'test'
  ...
# Subtest: keeps initialized hub state on disk across a new Hub instance
ok 47 - keeps initialized hub state on disk across a new Hub instance
  ---
  duration_ms: 335.296044
  type: 'test'
  ...
# Subtest: uses the card CLI validator for a locally valid card
ok 48 - uses the card CLI validator for a locally valid card
  ---
  duration_ms: 0.513525
  type: 'test'
  ...
# Subtest: derives an opening title and lets only the lead rename it with title cards
ok 49 - derives an opening title and lets only the lead rename it with title cards
  ---
  duration_ms: 603.322902
  type: 'test'
  ...
# Subtest: validates the optional question document name
ok 50 - validates the optional question document name
  ---
  duration_ms: 0.534005
  type: 'test'
  ...
# Subtest: refuses a card with an unknown field
ok 51 - refuses a card with an unknown field
  ---
  duration_ms: 264.64948
  type: 'test'
  ...
# Subtest: refuses a card a role may not emit
ok 52 - refuses a card a role may not emit
  ---
  duration_ms: 294.174291
  type: 'test'
  ...
# Subtest: refuses a card envelope with a session from another thread
ok 53 - refuses a card envelope with a session from another thread
  ---
  duration_ms: 394.574031
  type: 'test'
  ...
# Subtest: replaces a thread singleton card
ok 54 - replaces a thread singleton card
  ---
  duration_ms: 215.06773
  type: 'test'
  ...
# Subtest: records a press and lets a lead resolve an open question only in its thread
ok 55 - records a press and lets a lead resolve an open question only in its thread
  ---
  duration_ms: 408.58176
  type: 'test'
  ...
# Subtest: limits offers to a second request after keep talking first
ok 56 - limits offers to a second request after keep talking first
  ---
  duration_ms: 603.137326
  type: 'test'
  ...
# Subtest: routes a session message to the named target queue
ok 57 - routes a session message to the named target queue
  ---
  duration_ms: 359.941445
  type: 'test'
  ...
# Subtest: marks a result task finished and relays it to its starter
ok 58 - marks a result task finished and relays it to its starter
  ---
  duration_ms: 315.886956
  type: 'test'
  ...
# Subtest: holds a queued message until both readiness and a turn end
ok 59 - holds a queued message until both readiness and a turn end
  ---
  duration_ms: 190.952416
  type: 'test'
  ...
# Subtest: stamps when Collin last wrote in a thread, and only for his messages
ok 60 - stamps when Collin last wrote in a thread, and only for his messages
  ---
  duration_ms: 216.024796
  type: 'test'
  ...
# Subtest: posts a permission need and holds the session queue while the prompt is open
ok 61 - posts a permission need and holds the session queue while the prompt is open
  ---
  duration_ms: 209.056249
  type: 'test'
  ...
# Subtest: a turn ending after a permission prompt clears the hold and the card
ok 62 - a turn ending after a permission prompt clears the hold and the card
  ---
  duration_ms: 199.740722
  type: 'test'
  ...
# Subtest: closes a permission need and resumes the queue
ok 63 - closes a permission need and resumes the queue
  ---
  duration_ms: 189.492135
  type: 'test'
  ...
# Subtest: posts and clears a stuck-session need
ok 64 - posts and clears a stuck-session need
  ---
  duration_ms: 191.417358
  type: 'test'
  ...
# Subtest: allows a lead to start only its permitted roles
ok 65 - allows a lead to start only its permitted roles
  ---
  duration_ms: 281.02552
  type: 'test'
  ...
# Subtest: refuses a second live sub-lead
ok 66 - refuses a second live sub-lead
  ---
  duration_ms: 273.74673
  type: 'test'
  ...
# Subtest: deduplicates a live start attempt
ok 67 - deduplicates a live start attempt
  ---
  duration_ms: 264.538748
  type: 'test'
  ...
# Subtest: allows a lead to stop a session it started
ok 68 - allows a lead to stop a session it started
  ---
  duration_ms: 273.473695
  type: 'test'
  ...
# Subtest: starts a replacement lead after the old lead ends
ok 69 - starts a replacement lead after the old lead ends
  ---
  duration_ms: 275.445518
  type: 'test'
  ...
# Subtest: a fresh Claude lead with no first message takes its queue without a turn-ended event
ok 70 - a fresh Claude lead with no first message takes its queue without a turn-ended event
  ---
  duration_ms: 177.347631
  type: 'test'
  ...
# Subtest: puts restart context ahead of transferred queued messages
ok 71 - puts restart context ahead of transferred queued messages
  ---
  duration_ms: 280.158918
  type: 'test'
  ...
# Subtest: reports a dead worker to its starter
ok 72 - reports a dead worker to its starter
  ---
  duration_ms: 275.056821
  type: 'test'
  ...
# Subtest: raises Sessions ended when the lead dies
ok 73 - raises Sessions ended when the lead dies
  ---
  duration_ms: 202.324038
  type: 'test'
  ...
# Subtest: creates an unstarted stub and opens it after a role turn ends
ok 74 - creates an unstarted stub and opens it after a role turn ends
  ---
  duration_ms: 283.742752
  type: 'test'
  ...
# Subtest: stub lead follows lead order instead of inheriting its parent provider
ok 75 - stub lead follows lead order instead of inheriting its parent provider
  ---
  duration_ms: 313.215501
  type: 'test'
  ...
# Subtest: waits for a dependent stub until the parent merges
ok 76 - waits for a dependent stub until the parent merges
  ---
  duration_ms: 180.956493
  type: 'test'
  ...
# Subtest: opens a waiting stub after the 10-minute check finds its parent merged
ok 77 - opens a waiting stub after the 10-minute check finds its parent merged
  ---
  duration_ms: 311.111096
  type: 'test'
  ...
# Subtest: rechecks an approval in place and gates Start building on the fresh result
ok 78 - rechecks an approval in place and gates Start building on the fresh result
  ---
  duration_ms: 192.635725
  type: 'test'
  ...
# Subtest: asks the machine service to archive the thread
ok 79 - asks the machine service to archive the thread
  ---
  duration_ms: 182.051724
  type: 'test'
  ...
# Subtest: queues a card press as a lead message
ok 80 - queues a card press as a lead message
  ---
  duration_ms: 198.477219
  type: 'test'
  ...
# Subtest: reads archived MAP.md with git show from the thread branch
ok 81 - reads archived MAP.md with git show from the thread branch
  ---
  duration_ms: 187.898939
  type: 'test'
  ...
# Subtest: reads archived IDEA.md with git show from the thread branch
ok 82 - reads archived IDEA.md with git show from the thread branch
  ---
  duration_ms: 200.472765
  type: 'test'
  ...
# Subtest: reads archived PLAN.md with git show from the thread branch
ok 83 - reads archived PLAN.md with git show from the thread branch
  ---
  duration_ms: 202.169671
  type: 'test'
  ...
# Subtest: refuses archived documents outside MAP, IDEA and PLAN
ok 84 - refuses archived documents outside MAP, IDEA and PLAN
  ---
  duration_ms: 208.59762
  type: 'test'
  ...
# Subtest: finds a worktree plan slug on thread and chat routes
ok 85 - finds a worktree plan slug on thread and chat routes
  ---
  duration_ms: 213.803544
  type: 'test'
  ...
# Subtest: groups features by the current plan status and lists open needs
ok 86 - groups features by the current plan status and lists open needs
  ---
  duration_ms: 225.418413
  type: 'test'
  ...
# Subtest: returns every machine session and persists its last-seen time
ok 87 - returns every machine session and persists its last-seen time
  ---
  duration_ms: 196.29879
  type: 'test'
  ...
# Subtest: proxies pane reads and raw terminal keys through the machine service
ok 88 - proxies pane reads and raw terminal keys through the machine service
  ---
  duration_ms: 211.08995
  type: 'test'
  ...
# Subtest: reads an unrecorded service pane but refuses its keys
ok 89 - reads an unrecorded service pane but refuses its keys
  ---
  duration_ms: 104.528109
  type: 'test'
  ...
# Subtest: refuses a browser write from the wrong origin
ok 90 - refuses a browser write from the wrong origin
  ---
  duration_ms: 88.197497
  type: 'test'
  ...
# Subtest: refuses a machine callback without its secret
ok 91 - refuses a machine callback without its secret
  ---
  duration_ms: 244.923434
  type: 'test'
  ...
# Subtest: a verifier the lead starts is pointed at the thread branch
ok 92 - a verifier the lead starts is pointed at the thread branch
  ---
  duration_ms: 379.987754
  type: 'test'
  ...
# Subtest: the chat reads the lead transcript through the machine service
ok 93 - the chat reads the lead transcript through the machine service
  ---
  duration_ms: 207.910612
  type: 'test'
  ...
# Subtest: Tool steps: Hide leaves the lead's tool calls out of the chat
ok 94 - Tool steps: Hide leaves the lead's tool calls out of the chat
  ---
  duration_ms: 224.60356
  type: 'test'
  ...
# Subtest: a verifier report from its transcript reaches the lead as its result
ok 95 - a verifier report from its transcript reaches the lead as its result
  ---
  duration_ms: 361.907284
  type: 'test'
  ...
# Subtest: a Codex verifier report comes from the notify payload when present, once
ok 96 - a Codex verifier report comes from the notify payload when present, once
  ---
  duration_ms: 370.615217
  type: 'test'
  ...
# Subtest: a mapper works in the thread worktree; a worker branches from the thread branch
ok 97 - a mapper works in the thread worktree; a worker branches from the thread branch
  ---
  duration_ms: 580.023582
  type: 'test'
  ...
# Subtest: models per role: leads, other agents, workers, aliases, and critical resolve through their provider cells
ok 98 - models per role: leads, other agents, workers, aliases, and critical resolve through their provider cells
  ---
  duration_ms: 2019.980936
  type: 'test'
  ...
# Subtest: models per role: Claude always gets a model and effort, and preferences reach the machine
ok 99 - models per role: Claude always gets a model and effort, and preferences reach the machine
  ---
  duration_ms: 554.629845
  type: 'test'
  ...
# Subtest: models per role: Claude family aliases do not become Codex tiers
ok 100 - models per role: Claude family aliases do not become Codex tiers
  ---
  duration_ms: 802.69249
  type: 'test'
  ...
# Subtest: models per role: unknown tiers and unused provider cells are refused
ok 101 - models per role: unknown tiers and unused provider cells are refused
  ---
  duration_ms: 453.987258
  type: 'test'
  ...
# Subtest: no session starts while the machine service runs another commit
ok 102 - no session starts while the machine service runs another commit
  ---
  duration_ms: 407.505213
  type: 'test'
  ...
# Subtest: the Ready check covers the other family and uses account login status
ok 103 - the Ready check covers the other family and uses account login status
  ---
  duration_ms: 213.368721
  type: 'test'
  ...
# Subtest: projects.json records each thread project once and GET /projects lists them
ok 104 - projects.json records each thread project once and GET /projects lists them
  ---
  duration_ms: 392.090718
  type: 'test'
  ...
# Subtest: the sessions list passes unmanaged tmux sessions through as read-only
ok 105 - the sessions list passes unmanaged tmux sessions through as read-only
  ---
  duration_ms: 181.660904
  type: 'test'
  ...
# Subtest: serializes concurrent cards and de-duplicates a delivered card
ok 106 - serializes concurrent cards and de-duplicates a delivered card
  ---
  duration_ms: 203.811881
  type: 'test'
  ...
# Subtest: a failed event submit records its delivery id and leaves its queue for a later retry
ok 107 - a failed event submit records its delivery id and leaves its queue for a later retry
  ---
  duration_ms: 207.401245
  type: 'test'
  ...
# Subtest: a failed result-card submit is accepted, queued, and never rejected
ok 108 - a failed result-card submit is accepted, queued, and never rejected
  ---
  duration_ms: 278.406396
  type: 'test'
  ...
# Subtest: a browser message stays queued and reports delivery failure without failing its route
ok 109 - a browser message stays queued and reports delivery failure without failing its route
  ---
  duration_ms: 191.551495
  type: 'test'
  ...
# Subtest: a verifier report survives a failed submit and the queue timer retries it
ok 110 - a verifier report survives a failed submit and the queue timer retries it
  ---
  duration_ms: 327.18238
  type: 'test'
  ...
# Subtest: talking about an approval keeps it open for Needs you and Start building
ok 111 - talking about an approval keeps it open for Needs you and Start building
  ---
  duration_ms: 215.928079
  type: 'test'
  ...
# Subtest: successful submits record their destination, source, text, and time
ok 112 - successful submits record their destination, source, text, and time
  ---
  duration_ms: 184.69849
  type: 'test'
  ...
# Subtest: sent history keeps 500 entries and appends older entries beside the thread file
ok 113 - sent history keeps 500 entries and appends older entries beside the thread file
  ---
  duration_ms: 193.893055
  type: 'test'
  ...
# Subtest: restart context includes the latest twenty Collin and card messages
ok 114 - restart context includes the latest twenty Collin and card messages
  ---
  duration_ms: 274.025383
  type: 'test'
  ...
# Subtest: runs Codex preflight before a lead start and records its failure as a need
ok 115 - runs Codex preflight before a lead start and records its failure as a need
  ---
  duration_ms: 150.646777
  type: 'test'
  ...
# Subtest: terminal Enter marks its session busy before the next hook event
ok 116 - terminal Enter marks its session busy before the next hook event
  ---
  duration_ms: 182.838082
  type: 'test'
  ...
# Subtest: unreachable sessions are public and marked unreachable
ok 117 - unreachable sessions are public and marked unreachable
  ---
  duration_ms: 178.566698
  type: 'test'
  ...
# Subtest: a kept rebase makes a need and leaves the thread open
ok 118 - a kept rebase makes a need and leaves the thread open
  ---
  duration_ms: 191.758501
  type: 'test'
  ...
# Subtest: a second archive records the thread after a retained rebase worktree is removed
ok 119 - a second archive records the thread after a retained rebase worktree is removed
  ---
  duration_ms: 191.996228
  type: 'test'
  ...
# Subtest: serializes concurrent card and event arrivals without losing either
ok 120 - serializes concurrent card and event arrivals without losing either
  ---
  duration_ms: 213.23801
  type: 'test'
  ...
# Subtest: Features includes an opened stub but not an unopened one, and needs need no slug
ok 121 - Features includes an opened stub but not an unopened one, and needs need no slug
  ---
  duration_ms: 289.338725
  type: 'test'
  ...
# Subtest: stub commits persist and reach the opened lead context
ok 122 - stub commits persist and reach the opened lead context
  ---
  duration_ms: 289.834755
  type: 'test'
  ...
# Subtest: registers a diagram plan before persisting its card
ok 123 - registers a diagram plan before persisting its card
  ---
  duration_ms: 186.899221
  type: 'test'
  ...
# Subtest: a diagram card registers its graph for the real viewer iframe route
ok 124 - a diagram card registers its graph for the real viewer iframe route
  ---
  duration_ms: 195.306727
  type: 'test'
  ...
# Subtest: the real viewer keeps its boot commit when its clone moves before the first app request
ok 125 - the real viewer keeps its boot commit when its clone moves before the first app request
  ---
  duration_ms: 860.951673
  type: 'test'
  ...
# Subtest: reachable Sessions responses do not expose tokens
ok 126 - reachable Sessions responses do not expose tokens
  ---
  duration_ms: 179.267773
  type: 'test'
  ...
# Subtest: a replacement sub-lead stops its predecessor worker, but a worker cannot stop a worker child
ok 127 - a replacement sub-lead stops its predecessor worker, but a worker cannot stop a worker child
  ---
  duration_ms: 490.966084
  type: 'test'
  ...
# Subtest: worker replacement reuses a dead worker worktree and branch only
ok 128 - worker replacement reuses a dead worker worktree and branch only
  ---
  duration_ms: 1236.734891
  type: 'test'
  ...
# Subtest: validates a resolve card and the targets it may close
ok 129 - validates a resolve card and the targets it may close
  ---
  duration_ms: 0.558852
  type: 'test'
  ...
# Subtest: a lead resolve closes its needs card and removes it from the Needs strip
ok 130 - a lead resolve closes its needs card and removes it from the Needs strip
  ---
  duration_ms: 421.986429
  type: 'test'
  ...
# Subtest: a resolve is refused for a system card, another kind, another thread and a missing card
ok 131 - a resolve is refused for a system card, another kind, another thread and a missing card
  ---
  duration_ms: 526.151852
  type: 'test'
  ...
# Subtest: a resolve retried with the same delivery id is a duplicate
ok 132 - a resolve retried with the same delivery id is a duplicate
  ---
  duration_ms: 486.859067
  type: 'test'
  ...
# Subtest: keep going and talk about it close a lead needs card and reach the lead
ok 133 - keep going and talk about it close a lead needs card and reach the lead
  ---
  duration_ms: 728.047747
  type: 'test'
  ...
# Subtest: dismiss closes a lead needs card as collin and refuses a system one
ok 134 - dismiss closes a lead needs card as collin and refuses a system one
  ---
  duration_ms: 794.666585
  type: 'test'
  ...
# Subtest: worker effort overrides and escalation ceilings reject before starting
ok 135 - worker effort overrides and escalation ceilings reject before starting
  ---
  duration_ms: 3240.82975
  type: 'test'
  ...
# Subtest: wc session start includes effort only when supplied
ok 136 - wc session start includes effort only when supplied
  ---
  duration_ms: 2.515846
  type: 'test'
  ...
# Subtest: restarting a failed lead answers its turn-failed card
ok 137 - restarting a failed lead answers its turn-failed card
  ---
  duration_ms: 724.852038
  type: 'test'
  ...
# Subtest: diagram formats and lead-only image cards validate and persist
ok 138 - diagram formats and lead-only image cards validate and persist
  ---
  duration_ms: 498.329026
  type: 'test'
  ...
# Subtest: uploads and files stream through the hub and enforce admission
ok 139 - uploads and files stream through the hub and enforce admission
  ---
  duration_ms: 2037.319706
  type: 'test'
  ...
# Subtest: a machine reset during an upload returns 409
ok 140 - a machine reset during an upload returns 409
  ---
  duration_ms: 1927.571072
  type: 'test'
  ...
# Subtest: archive keeps thread open on upload removal failure and archives after success
ok 141 - archive keeps thread open on upload removal failure and archives after success
  ---
  duration_ms: 399.014726
  type: 'test'
  ...
# Subtest: archived HTML route sends the static sandbox headers
ok 142 - archived HTML route sends the static sandbox headers
  ---
  duration_ms: 1.14691
  type: 'test'
  ...
# Subtest: "hub" names the installer-registered entry for this host's own service
ok 143 - "hub" names the installer-registered entry for this host's own service
  ---
  duration_ms: 19.015082
  type: 'test'
  ...
# Subtest: a lead waits when its machine passes the path check but cannot start it
ok 144 - a lead waits when its machine passes the path check but cannot start it
  ---
  duration_ms: 183.546511
  type: 'test'
  ...
# Subtest: a reachable machine that refuses a lead start records failure
ok 145 - a reachable machine that refuses a lead start records failure
  ---
  duration_ms: 523.965521
  type: 'test'
  ...
# --cli is ignored: the hub picks the provider
# Subtest: an unreachable machine leaves no thread and no projects.json entry
ok 146 - an unreachable machine leaves no thread and no projects.json entry
  ---
  duration_ms: 22.076955
  type: 'test'
  ...
# Subtest: wc.js passes worktree-remove through with the worker session, and requires a commit message
ok 147 - wc.js passes worktree-remove through with the worker session, and requires a commit message
  ---
  duration_ms: 1.535114
  type: 'test'
  ...
# Subtest: wc.js preserves git flags and the worker replacement option
ok 148 - wc.js preserves git flags and the worker replacement option
  ---
  duration_ms: 0.749227
  type: 'test'
  ...
# Subtest: a hub keeps the version captured at construction after its clone advances
ok 149 - a hub keeps the version captured at construction after its clone advances
  ---
  duration_ms: 47.210913
  type: 'test'
  ...
# Subtest: wc.js sends provider constraints and prints waiting and notice output
ok 150 - wc.js sends provider constraints and prints waiting and notice output
  ---
  duration_ms: 67.390168
  type: 'test'
  ...
# Subtest: GET /new-thread returns found repositories for the machine and passes folder_error on
ok 151 - GET /new-thread returns found repositories for the machine and passes folder_error on
  ---
  duration_ms: 286.370152
  type: 'test'
  ...
# Subtest: GET /new-thread asks for no folder when none is set
ok 152 - GET /new-thread asks for no folder when none is set
  ---
  duration_ms: 179.100644
  type: 'test'
  ...
# Subtest: GET /new-thread says an unreachable machine is not reachable and an old one needs updating
ok 153 - GET /new-thread says an unreachable machine is not reachable and an old one needs updating
  ---
  duration_ms: 230.882454
  type: 'test'
  ...
# Subtest: GET /new-thread lists hub first and folds the hub hostname entry into it
ok 154 - GET /new-thread lists hub first and folds the hub hostname entry into it
  ---
  duration_ms: 176.070983
  type: 'test'
  ...
# Subtest: GET /new-thread filters saved directories by machine
ok 155 - GET /new-thread filters saved directories by machine
  ---
  duration_ms: 226.173693
  type: 'test'
  ...
# Subtest: GET /new-thread previous comes from threads on that machine, newest first, hostname alias included
ok 156 - GET /new-thread previous comes from threads on that machine, newest first, hostname alias included
  ---
  duration_ms: 732.278966
  type: 'test'
  ...
# Subtest: saved directories: add, duplicate 409, remove, remove unknown 404
ok 157 - saved directories: add, duplicate 409, remove, remove unknown 404
  ---
  duration_ms: 227.146939
  type: 'test'
  ...
# Subtest: saving a directory is refused with the check reason, and 502 when the machine does not answer
ok 158 - saving a directory is refused with the check reason, and 502 when the machine does not answer
  ---
  duration_ms: 177.860445
  type: 'test'
  ...
# Subtest: default_project_folder is trimmed, cleared by empty, and must be absolute or start with ~
ok 159 - default_project_folder is trimmed, cleared by empty, and must be absolute or start with ~
  ---
  duration_ms: 291.118168
  type: 'test'
  ...
# Subtest: starting a thread on a path the machine refuses leaves no thread and no projects.json entry
ok 160 - starting a thread on a path the machine refuses leaves no thread and no projects.json entry
  ---
  duration_ms: 118.439062
  type: 'test'
  ...
# Subtest: starting a thread stores the path the machine expanded
ok 161 - starting a thread stores the path the machine expanded
  ---
  duration_ms: 229.601246
  type: 'test'
  ...
# Subtest: a template scope may name a saved directory path, and settings lists it as a project
ok 162 - a template scope may name a saved directory path, and settings lists it as a project
  ---
  duration_ms: 139.956924
  type: 'test'
  ...
# Subtest: saved directories refuse . and .. as names and treat a malformed escape as unknown
ok 163 - saved directories refuse . and .. as names and treat a malformed escape as unknown
  ---
  duration_ms: 92.635249
  type: 'test'
  ...
# Subtest: an app page without the remember cookie gets the sign-in page
ok 164 - an app page without the remember cookie gets the sign-in page
  ---
  duration_ms: 181.259255
  type: 'test'
  ...
# Subtest: the bookmark token signs a new browser in on an app page, and a wrong one does not
ok 165 - the bookmark token signs a new browser in on an app page, and a wrong one does not
  ---
  duration_ms: 162.411193
  type: 'test'
  ...
# Subtest: the document page is served behind the remember cookie like the other app pages
ok 166 - the document page is served behind the remember cookie like the other app pages
  ---
  duration_ms: 183.896782
  type: 'test'
  ...
# Subtest: the New thread page is served behind the remember cookie, with its assets
ok 167 - the New thread page is served behind the remember cookie, with its assets
  ---
  duration_ms: 134.166778
  type: 'test'
  ...
# Subtest: an unknown app page is not served
ok 168 - an unknown app page is not served
  ---
  duration_ms: 124.666346
  type: 'test'
  ...
# Subtest: asset names outside pages/ and vendor/, or climbing out, are refused
ok 169 - asset names outside pages/ and vendor/, or climbing out, are refused
  ---
  duration_ms: 138.65685
  type: 'test'
  ...
# Subtest: the existing page scripts are still served
ok 170 - the existing page scripts are still served
  ---
  duration_ms: 133.914945
  type: 'test'
  ...
# Subtest: app pages may frame this origin, for diagram cards
ok 171 - app pages may frame this origin, for diagram cards
  ---
  duration_ms: 1.421146
  type: 'test'
  ...
# Subtest: settings defaults, templates, prompt composition, counts, and validation
ok 172 - settings defaults, templates, prompt composition, counts, and validation
  ---
  duration_ms: 1279.859713
  type: 'test'
  ...
# Subtest: style saving, trailer delivery, chat stripping, and preview stay scoped to leads
ok 173 - style saving, trailer delivery, chat stripping, and preview stay scoped to leads
  ---
  duration_ms: 693.488023
  type: 'test'
  ...
# Subtest: settings updates serialize concurrent saves and report a missing template project
ok 174 - settings updates serialize concurrent saves and report a missing template project
  ---
  duration_ms: 196.1527
  type: 'test'
  ...
# Subtest: the role-layer cap refuses template and style saves without changing settings
ok 175 - the role-layer cap refuses template and style saves without changing settings
  ---
  duration_ms: 116.381485
  type: 'test'
  ...
# Subtest: preview has a 75-second machine timeout while ordinary calls retain five seconds
ok 176 - preview has a 75-second machine timeout while ordinary calls retain five seconds
  ---
  duration_ms: 5.321477
  type: 'test'
  ...
# Subtest: settings model and heads-up routes reject bad input and preserve the settings file mode
ok 177 - settings model and heads-up routes reject bad input and preserve the settings file mode
  ---
  duration_ms: 867.635857
  type: 'test'
  ...
# Subtest: template scopes must be listed when added or changed, while removed-project templates remain editable
ok 178 - template scopes must be listed when added or changed, while removed-project templates remain editable
  ---
  duration_ms: 93.150577
  type: 'test'
  ...
# Subtest: escalation settings, sentences, and role layers
ok 179 - escalation settings, sentences, and role layers
  ---
  duration_ms: 147.372958
  type: 'test'
  ...
# warning: You appear to have cloned an empty repository.
# Subtest: an untracked new plan directory is the thread plan, not an existing one
ok 180 - an untracked new plan directory is the thread plan, not an existing one
  ---
  duration_ms: 108.939612
  type: 'test'
  ...
# warning: You appear to have cloned an empty repository.
# Subtest: a plan directory committed on the thread branch is found against its upstream
ok 181 - a plan directory committed on the thread branch is found against its upstream
  ---
  duration_ms: 153.799114
  type: 'test'
  ...
# warning: You appear to have cloned an empty repository.
# Preparing worktree (new branch 'wc/no-track')
# Subtest: finds a committed plan on a no-track worktree branch against origin/default
ok 182 - finds a committed plan on a no-track worktree branch against origin/default
  ---
  duration_ms: 176.221752
  type: 'test'
  ...
# warning: You appear to have cloned an empty repository.
# Subtest: finding the slug registers the plan directory once
ok 183 - finding the slug registers the plan directory once
  ---
  duration_ms: 115.048509
  type: 'test'
  ...
# Subtest: a failed queued operation reaches its caller and leaves the process running
ok 184 - a failed queued operation reaches its caller and leaves the process running
  ---
  duration_ms: 172.557705
  type: 'test'
  ...
# machine service listening on 127.0.0.1:36641
# Subtest: archive through the hub cancels a stalled upload to the real machine
ok 185 - archive through the hub cancels a stalled upload to the real machine
  ---
  duration_ms: 6186.011064
  type: 'test'
  ...
# Subtest: account normalization and balancing settings survive round trip
ok 186 - account normalization and balancing settings survive round trip
  ---
  duration_ms: 3.366677
  type: 'test'
  ...
# Subtest: effective windows, room and forecasts
ok 187 - effective windows, room and forecasts
  ---
  duration_ms: 0.774485
  type: 'test'
  ...
# Subtest: ranking and unknown transcript
ok 188 - ranking and unknown transcript
  ---
  duration_ms: 0.872183
  type: 'test'
  ...
# Subtest: Ready accepts a second signed-in account and old service status
ok 189 - Ready accepts a second signed-in account and old service status
  ---
  duration_ms: 1.144225
  type: 'test'
  ...
# Subtest: account and balancing routes and usage shape
ok 190 - account and balancing routes and usage shape
  ---
  duration_ms: 392.130174
  type: 'test'
  ...
# Subtest: normalization supplies defaults and all plan weights
ok 191 - normalization supplies defaults and all plan weights
  ---
  duration_ms: 1.346293
  type: 'test'
  ...
# Subtest: room boundaries, windows, forecast and margin
ok 192 - room boundaries, windows, forecast and margin
  ---
  duration_ms: 0.486814
  type: 'test'
  ...
# Subtest: rank chooses by reset, weighted room, live sessions and last choice and explains skips
ok 193 - rank chooses by reset, weighted room, live sessions and last choice and explains skips
  ---
  duration_ms: 41.182139
  type: 'test'
  ...
# Subtest: record serializes readings and chosen accounts
ok 194 - record serializes readings and chosen accounts
  ---
  duration_ms: 31.050476
  type: 'test'
  ...
# Subtest: Ready rejects paused accounts and preserves old Codex preflight
ok 195 - Ready rejects paused accounts and preserves old Codex preflight
  ---
  duration_ms: 1.31928
  type: 'test'
  ...
# Subtest: account route assigns unique slugs and resets weight on plan change
ok 196 - account route assigns unique slugs and resets weight on plan change
  ---
  duration_ms: 173.909958
  type: 'test'
  ...
# Subtest: usage endpoints expose machine state, sessions and alert weeks
ok 197 - usage endpoints expose machine state, sessions and alert weeks
  ---
  duration_ms: 190.184012
  type: 'test'
  ...
# Subtest: sign-in proxies forward the account, machine path and payload
ok 198 - sign-in proxies forward the account, machine path and payload
  ---
  duration_ms: 204.219723
  type: 'test'
  ...
# Subtest: removing an account leaves its live session intact and removes it from settings and usage
ok 199 - removing an account leaves its live session intact and removes it from settings and usage
  ---
  duration_ms: 197.292116
  type: 'test'
  ...
# Subtest: newer ordinary readings preserve a future limit until it expires
ok 200 - newer ordinary readings preserve a future limit until it expires
  ---
  duration_ms: 326.370174
  type: 'test'
  ...
# Subtest: removed account ids are retired and do not inherit usage or sessions
ok 201 - removed account ids are retired and do not inherit usage or sessions
  ---
  duration_ms: 312.733477
  type: 'test'
  ...
# Subtest: alerts are acknowledged per provider and local ISO week
ok 202 - alerts are acknowledged per provider and local ISO week
  ---
  duration_ms: 20.040489
  type: 'test'
  ...
# Subtest: the token lasts across a restart, rotates only explicitly, and whoami proves a nonce
ok 203 - the token lasts across a restart, rotates only explicitly, and whoami proves a nonce
  ---
  duration_ms: 1949.161055
  type: 'test'
  ...
# Subtest: a stale .server never blocks listen and a live server repairs a deleted record before whoami
ok 204 - a stale .server never blocks listen and a live server repairs a deleted record before whoami
  ---
  duration_ms: 88.874506
  type: 'test'
  ...
# Subtest: stop treats a refused connection as no viewer even when stale information remains
ok 205 - stop treats a refused connection as no viewer even when stale information remains
  ---
  duration_ms: 52.097385
  type: 'test'
  ...
# Subtest: serving origin is accepted for PUT and drives the bookmark URL
ok 206 - serving origin is accepted for PUT and drives the bookmark URL
  ---
  duration_ms: 152.464725
  type: 'test'
  ...
# Subtest: two simultaneous first starts end with one .token
ok 207 - two simultaneous first starts end with one .token
  ---
  duration_ms: 109.589158
  type: 'test'
  ...
# Subtest: simultaneous delayed listeners elect one server and print one token
ok 208 - simultaneous delayed listeners elect one server and print one token
  ---
  duration_ms: 573.685416
  type: 'test'
  ...
# Subtest: SIGKILL leaves stale .server and the next start listens immediately
ok 209 - SIGKILL leaves stale .server and the next start listens immediately
  ---
  duration_ms: 122.11857
  type: 'test'
  ...
# Subtest: a plain foreign listener makes --open refuse without signalling it
ok 210 - a plain foreign listener makes --open refuse without signalling it
  ---
  duration_ms: 2091.365278
  type: 'test'
  ...
# Subtest: a copied start id with a made-up pid and no proof is foreign
ok 211 - a copied start id with a made-up pid and no proof is foreign
  ---
  duration_ms: 58.535834
  type: 'test'
  ...
# Subtest: /whoami supplies pid and code, and proof only for a nonce
ok 212 - /whoami supplies pid and code, and proof only for a nonce
  ---
  duration_ms: 77.02663
  type: 'test'
  ...
# Subtest: stopping refuses a mismatched .server pid
ok 213 - stopping refuses a mismatched .server pid
  ---
  duration_ms: 104.138383
  type: 'test'
  ...
# Subtest: --stop exits 1 against a foreign listener
ok 214 - --stop exits 1 against a foreign listener
  ---
  duration_ms: 2060.85674
  type: 'test'
  ...
# Subtest: --stop waits five seconds then fails when the server ignores SIGTERM
ok 215 - --stop waits five seconds then fails when the server ignores SIGTERM
  ---
  duration_ms: 6904.983017
  type: 'test'
  ...
# Subtest: --stop --if-stale keeps current code and stops a changed server copy
ok 216 - --stop --if-stale keeps current code and stops a changed server copy
  ---
  duration_ms: 1759.029208
  type: 'test'
  ...
# Subtest: an older server is stopped only by --stop and every other command gives the upgrade message
ok 217 - an older server is stopped only by --stop and every other command gives the upgrade message
  ---
  duration_ms: 435.202338
  type: 'test'
  ...
# Subtest: a proof-valid pre-prefix holder is stopped only by stop and every other command reports the upgrade
ok 218 - a proof-valid pre-prefix holder is stopped only by stop and every other command reports the upgrade
  ---
  duration_ms: 425.02667
  type: 'test'
  ...
# Subtest: a no-proof pre-prefix holder stops only with its matching server start id and open refuses it
ok 219 - a no-proof pre-prefix holder stops only with its matching server start id and open refuses it
  ---
  duration_ms: 214.661691
  type: 'test'
  ...
# Subtest: a proof-valid pre-prefix holder without a pid is not ours and open does not signal it
ok 220 - a proof-valid pre-prefix holder without a pid is not ours and open does not signal it
  ---
  duration_ms: 89.206191
  type: 'test'
  ...
# Subtest: --service takes over an open server without changing port or token
ok 221 - --service takes over an open server without changing port or token
  ---
  duration_ms: 1672.926399
  type: 'test'
  ...
# Subtest: --service gives up after three takeovers
ok 222 - --service gives up after three takeovers
  ---
  duration_ms: 1974.647683
  type: 'test'
  ...
# Subtest: a post-bind .server rename failure rolls back listener and record
ok 223 - a post-bind .server rename failure rolls back listener and record
  ---
  duration_ms: 46.137504
  type: 'test'
  ...
# Subtest: --open waits a closing server out and succeeds
ok 224 - --open waits a closing server out and succeeds
  ---
  duration_ms: 1605.08843
  type: 'test'
  ...
# Subtest: only localhost and served origins write, and serve false prints localhost
ok 225 - only localhost and served origins write, and serve false prints localhost
  ---
  duration_ms: 98.660325
  type: 'test'
  ...
# Subtest: --url never listens and reports the running token after a timed-out rotation
ok 226 - --url never listens and reports the running token after a timed-out rotation
  ---
  duration_ms: 7410.404389
  type: 'test'
  ...
# Subtest: --rotate-token refuses an old-version holder and leaves it running
ok 227 - --rotate-token refuses an old-version holder and leaves it running
  ---
  duration_ms: 148.906118
  type: 'test'
  ...
# Subtest: --register-plan retries a silent holder until it registers through it
ok 228 - --register-plan retries a silent holder until it registers through it
  ---
  duration_ms: 738.51817
  type: 'test'
  ...
# Subtest: --rotate-token waits for shutdown and leaves .server removal to the server
ok 229 - --rotate-token waits for shutdown and leaves .server removal to the server
  ---
  duration_ms: 270.804605
  type: 'test'
  ...
# Subtest: --rotate-token prints the new prefixed bookmark for a current server
ok 230 - --rotate-token prints the new prefixed bookmark for a current server
  ---
  duration_ms: 1773.654314
  type: 'test'
  ...
# Subtest: shutdown releases the port before it removes only its own .server record
ok 231 - shutdown releases the port before it removes only its own .server record
  ---
  duration_ms: 117.811247
  type: 'test'
  ...
# Subtest: --stop leaves .server removal to the exiting server
ok 232 - --stop leaves .server removal to the exiting server
  ---
  duration_ms: 310.147316
  type: 'test'
  ...
# Subtest: a starter that loses the freed port registers through the new holder
ok 233 - a starter that loses the freed port registers through the new holder
  ---
  duration_ms: 2324.867253
  type: 'test'
  ...
# Subtest: frontmatter, headings, tables and lists parse as the document page expects
ok 234 - frontmatter, headings, tables and lists parse as the document page expects
  ---
  duration_ms: 2.750295
  type: 'test'
  ...
# Subtest: a semicolon key reaches the pane only as backslash-semicolon
ok 235 - a semicolon key reaches the pane only as backslash-semicolon
  ---
  duration_ms: 715.30546
  type: 'test'
  ...
# Subtest: the sessions response marks the hub entry whatever name it is registered under
ok 236 - the sessions response marks the hub entry whatever name it is registered under
  ---
  duration_ms: 237.129987
  type: 'test'
  ...
# Subtest: open, show, and register-plan use the server registration writer
ok 237 - open, show, and register-plan use the server registration writer
  ---
  duration_ms: 647.891807
  type: 'test'
  ...
# Subtest: register rejects unsigned, stale, foreign-origin, and out-of-scope paths
ok 238 - register rejects unsigned, stale, foreign-origin, and out-of-scope paths
  ---
  duration_ms: 185.813449
  type: 'test'
  ...
# Subtest: a refused POST /register leaves .registered and .plans byte-identical
ok 239 - a refused POST /register leaves .registered and .plans byte-identical
  ---
  duration_ms: 149.203289
  type: 'test'
  ...
# Subtest: commands reuse a proven server and register without exposing its token
ok 240 - commands reuse a proven server and register without exposing its token
  ---
  duration_ms: 260.974211
  type: 'test'
  ...
# Subtest: --register-plan is best effort and never starts a server
ok 241 - --register-plan is best effort and never starts a server
  ---
  duration_ms: 2075.582266
  type: 'test'
  ...
# Subtest: --open records the caller tmux session, while a missing tmux records null
ok 242 - --open records the caller tmux session, while a missing tmux records null
  ---
  duration_ms: 195.27655
  type: 'test'
  ...
# Subtest: a failing tmux lookup records a null session
ok 243 - a failing tmux lookup records a null session
  ---
  duration_ms: 141.963482
  type: 'test'
  ...
# Subtest: twenty concurrent opens all land in the running server registry
ok 244 - twenty concurrent opens all land in the running server registry
  ---
  duration_ms: 322.194865
  type: 'test'
  ...
# Subtest: simultaneous first opens register their own paths and a later plan
ok 245 - simultaneous first opens register their own paths and a later plan
  ---
  duration_ms: 1827.512255
  type: 'test'
  ...
# Subtest: a failed listener never changes either pre-existing list
ok 246 - a failed listener never changes either pre-existing list
  ---
  duration_ms: 2088.169167
  type: 'test'
  ...
# Subtest: a plan first graph creates its missing graphs directory and registers
ok 247 - a plan first graph creates its missing graphs directory and registers
  ---
  duration_ms: 56.549846
  type: 'test'
  ...
# Subtest: show signs watching without sending the token
ok 248 - show signs watching without sending the token
  ---
  duration_ms: 65.18083
  type: 'test'
  ...
# Subtest: a port thief after proof receives a signature but never the token
ok 249 - a port thief after proof receives a signature but never the token
  ---
  duration_ms: 3140.271637
  type: 'test'
  ...
# Subtest: show overwrites open session and harness metadata with its own environment
ok 250 - show overwrites open session and harness metadata with its own environment
  ---
  duration_ms: 199.476877
  type: 'test'
  ...
# Subtest: open and show print token-free prefixed graph URLs, while show opens the token link and url prints the bookmark
ok 251 - open and show print token-free prefixed graph URLs, while show opens the token link and url prints the bookmark
  ---
  duration_ms: 299.333625
  type: 'test'
  ...
# Subtest: the nearest codex process wins over inherited CLAUDECODE and a claude ancestor
ok 252 - the nearest codex process wins over inherited CLAUDECODE and a claude ancestor
  ---
  duration_ms: 155.786737
  type: 'test'
  ...
# Subtest: registration rejects every out-of-scope plan and graph path before open reaches a port
ok 253 - registration rejects every out-of-scope plan and graph path before open reaches a port
  ---
  duration_ms: 162.884811
  type: 'test'
  ...
# Subtest: a registered graph replaced by an external symlink is refused on GET and PUT
ok 254 - a registered graph replaced by an external symlink is refused on GET and PUT
  ---
  duration_ms: 79.474436
  type: 'test'
  ...
# Subtest: register-plan has a two-second no-server grace and remains zero for bad paths
ok 255 - register-plan has a two-second no-server grace and remains zero for bad paths
  ---
  duration_ms: 2096.741196
  type: 'test'
  ...
# Subtest: pruning uses the newer graph mtime and added, and the newest plan markdown mtime
ok 256 - pruning uses the newer graph mtime and added, and the newest plan markdown mtime
  ---
  duration_ms: 72.68304
  type: 'test'
  ...
# Subtest: /list groups and orders opened graphs, marks ended sessions, quotes attach commands, and skips absent children
ok 257 - /list groups and orders opened graphs, marks ended sessions, quotes attach commands, and skips absent children
  ---
  duration_ms: 288.53305
  type: 'test'
  ...
# Subtest: /plan lists Markdown at every depth in byte order and refuses an unregistered directory
ok 258 - /plan lists Markdown at every depth in byte order and refuses an unregistered directory
  ---
  duration_ms: 284.621357
  type: 'test'
  ...
# Subtest: /doc returns 404 for non-Markdown files, parent paths, and a symlink leading outside its plan
ok 259 - /doc returns 404 for non-Markdown files, parent paths, and a symlink leading outside its plan
  ---
  duration_ms: 218.453264
  type: 'test'
  ...
# Subtest: /wheelchair/docs and list have CSP while a graph page keeps the index page header-free
ok 260 - /wheelchair/docs and list have CSP while a graph page keeps the index page header-free
  ---
  duration_ms: 187.766726
  type: 'test'
  ...
# Subtest: an app page carries font-src self and the font route serves only the allowlist
ok 261 - an app page carries font-src self and the font route serves only the allowlist
  ---
  duration_ms: 114.519485
  type: 'test'
  ...
# Subtest: /assets/list.js needs no token and other asset names are 404
ok 262 - /assets/list.js needs no token and other asset names are 404
  ---
  duration_ms: 95.218032
  type: 'test'
  ...
# Subtest: every other route requires a token while /whoami remains available
ok 263 - every other route requires a token while /whoami remains available
  ---
  duration_ms: 107.02501
  type: 'test'
  ...
# Subtest: a page changed on disk is served changed without restarting the server
ok 264 - a page changed on disk is served changed without restarting the server
  ---
  duration_ms: 92.730702
  type: 'test'
  ...
# Subtest: list-build pruning writes only when it removes entries and never rewrites again within an hour
ok 265 - list-build pruning writes only when it removes entries and never rewrites again within an hour
  ---
  duration_ms: 148.737035
  type: 'test'
  ...
# Subtest: GET /wheelchair/?token redirects without the token and sets the remember cookie attributes
ok 266 - GET /wheelchair/?token redirects without the token and sets the remember cookie attributes
  ---
  duration_ms: 85.999421
  type: 'test'
  ...
# Subtest: a remember cookie reads the page, list, plan, document, and graph
ok 267 - a remember cookie reads the page, list, plan, document, and graph
  ---
  duration_ms: 168.007467
  type: 'test'
  ...
# Subtest: JSON reads accept token directly and never set a remember cookie
ok 268 - JSON reads accept token directly and never set a remember cookie
  ---
  duration_ms: 179.105533
  type: 'test'
  ...
# Subtest: a wrong page token redirects with a valid cookie, but otherwise gets the sign-in page
ok 269 - a wrong page token redirects with a valid cookie, but otherwise gets the sign-in page
  ---
  duration_ms: 85.763739
  type: 'test'
  ...
# Subtest: wrong cookies and cookies from before a rotation are refused
ok 270 - wrong cookies and cookies from before a rotation are refused
  ---
  duration_ms: 1800.928898
  type: 'test'
  ...
# Subtest: a remember cookie is not a token, header token, or registration key
ok 271 - a remember cookie is not a token, header token, or registration key
  ---
  duration_ms: 95.874632
  type: 'test'
  ...
# Subtest: PUT graph and view accept a remember cookie only from a permitted origin
ok 272 - PUT graph and view accept a remember cookie only from a permitted origin
  ---
  duration_ms: 99.566494
  type: 'test'
  ...
# Subtest: PUT /wheelchair/graph accepts a remember cookie only from a permitted origin
ok 273 - PUT /wheelchair/graph accepts a remember cookie only from a permitted origin
  ---
  duration_ms: 94.733923
  type: 'test'
  ...
# Subtest: root routes move to /wheelchair and /wheelchair gains its trailing slash
ok 274 - root routes move to /wheelchair and /wheelchair gains its trailing slash
  ---
  duration_ms: 78.196735
  type: 'test'
  ...
# Subtest: page responses renew the Lax cookie while JSON responses do not, and anonymous pages explain sign-in
ok 275 - page responses renew the Lax cookie while JSON responses do not, and anonymous pages explain sign-in
  ---
  duration_ms: 84.441022
  type: 'test'
  ...
# Subtest: an anonymous JSON route returns a JSON 401 error
ok 276 - an anonymous JSON route returns a JSON 401 error
  ---
  duration_ms: 67.749597
  type: 'test'
  ...
# Subtest: diagram readers restrict registered graph files and preserve forms and sandbox HTML
ok 277 - diagram readers restrict registered graph files and preserve forms and sandbox HTML
  ---
  duration_ms: 140.193888
  type: 'test'
  ...
# Subtest: legacy canonical bytes remain unchanged, while a run graph writes its explicit fields
ok 278 - legacy canonical bytes remain unchanged, while a run graph writes its explicit fields
  ---
  duration_ms: 250.032293
  type: 'test'
  ...
# Subtest: run validation refuses each new schema violation
ok 279 - run validation refuses each new schema violation
  ---
  duration_ms: 1266.754777
  type: 'test'
  ...
# Subtest: agent progress preserves ruled entries and the page may not change it
ok 280 - agent progress preserves ruled entries and the page may not change it
  ---
  duration_ms: 134.484838
  type: 'test'
  ...
# Subtest: run and plain chain layouts keep their respective axes and spacing
ok 281 - run and plain chain layouts keep their respective axes and spacing
  ---
  duration_ms: 211.624556
  type: 'test'
  ...
# Subtest: a task-only run update keeps every position, including a drag
ok 282 - a task-only run update keeps every position, including a drag
  ---
  duration_ms: 127.256283
  type: 'test'
  ...
# Subtest: a progress-only write keeps a dragged position, and an added edge lays the picture out again
ok 283 - a progress-only write keeps a dragged position, and an added edge lays the picture out again
  ---
  duration_ms: 149.927709
  type: 'test'
  ...
# Subtest: rollups, nesting, updated, and the list run path follow run-picture rules
ok 284 - rollups, nesting, updated, and the list run path follow run-picture rules
  ---
  duration_ms: 201.415955
  type: 'test'
  ...
# Subtest: run nesting and reserved names are refused on registered paths
ok 285 - run nesting and reserved names are refused on registered paths
  ---
  duration_ms: 236.664905
  type: 'test'
  ...
# Subtest: canonical round-trip canonicalizes byte-for-byte
ok 286 - canonical round-trip canonicalizes byte-for-byte
  ---
  duration_ms: 407.001158
  type: 'test'
  ...
# Subtest: explanation written through /graph is retained on disk in canonical order
ok 287 - explanation written through /graph is retained on disk in canonical order
  ---
  duration_ms: 141.527186
  type: 'test'
  ...
# Subtest: groups canonicalize member lists, order, and byte round-trip
ok 288 - groups canonicalize member lists, order, and byte round-trip
  ---
  duration_ms: 158.24387
  type: 'test'
  ...
# Subtest: visible groups round-trip without explanation references
ok 289 - visible groups round-trip without explanation references
  ---
  duration_ms: 146.361568
  type: 'test'
  ...
# Subtest: groups default on writes and reads of legacy disk files
ok 290 - groups default on writes and reads of legacy disk files
  ---
  duration_ms: 128.751282
  type: 'test'
  ...
# Subtest: groups refuse malformed claims and unmatched explanation references
ok 291 - groups refuse malformed claims and unmatched explanation references
  ---
  duration_ms: 173.222228
  type: 'test'
  ...
# Subtest: ordinary markdown links in explanations do not require groups
ok 292 - ordinary markdown links in explanations do not require groups
  ---
  duration_ms: 107.181179
  type: 'test'
  ...
# Subtest: explanation accepts only strings or null
ok 293 - explanation accepts only strings or null
  ---
  duration_ms: 94.545373
  type: 'test'
  ...
# Subtest: agent prose refuses positional claims in explanations and groups
ok 294 - agent prose refuses positional claims in explanations and groups
  ---
  duration_ms: 119.60071
  type: 'test'
  ...
# Subtest: quoted spans mask positional claims without masking apostrophes or stray delimiters
ok 295 - quoted spans mask positional claims without masking apostrophes or stray delimiters
  ---
  duration_ms: 181.721069
  type: 'test'
  ...
# Subtest: positional claims leave the downhill vocabulary, node text, and page reads alone
ok 296 - positional claims leave the downhill vocabulary, node text, and page reads alone
  ---
  duration_ms: 281.825996
  type: 'test'
  ...
# Subtest: self edges are refused after missing endpoints
ok 297 - self edges are refused after missing endpoints
  ---
  duration_ms: 91.013999
  type: 'test'
  ...
# Subtest: both write routes enforce their distinct authority
ok 298 - both write routes enforce their distinct authority
  ---
  duration_ms: 133.756883
  type: 'test'
  ...
# Subtest: /view cannot alter explanation
ok 299 - /view cannot alter explanation
  ---
  duration_ms: 75.892625
  type: 'test'
  ...
# Subtest: /view cannot alter groups and accepts an untouched deep clone
ok 300 - /view cannot alter groups and accepts an untouched deep clone
  ---
  duration_ms: 108.654975
  type: 'test'
  ...
# Subtest: optimistic concurrency returns and accepts the current hash, including create
ok 301 - optimistic concurrency returns and accepts the current hash, including create
  ---
  duration_ms: 189.46843
  type: 'test'
  ...
# Subtest: an agent create cannot pre-rule entries or claim a reset record
ok 302 - an agent create cannot pre-rule entries or claim a reset record
  ---
  duration_ms: 84.345448
  type: 'test'
  ...
# Subtest: node and edge kinds are closed sets while omitted kinds default
ok 303 - node and edge kinds are closed sets while omitted kinds default
  ---
  duration_ms: 148.797952
  type: 'test'
  ...
# Subtest: the global write lock serializes concurrent writes and retry retains both changes
ok 304 - the global write lock serializes concurrent writes and retry retains both changes
  ---
  duration_ms: 110.199367
  type: 'test'
  ...
# Subtest: agent preservation protects agreed and rejected entries
ok 305 - agent preservation protects agreed and rejected entries
  ---
  duration_ms: 90.60768
  type: 'test'
  ...
# Subtest: PUT /graph ignores every supplied position and lays every node out again
ok 306 - PUT /graph ignores every supplied position and lays every node out again
  ---
  duration_ms: 102.628657
  type: 'test'
  ...
# Subtest: a create is deterministic, keeps group-less layout intact, and permits matching group and node ids
ok 307 - a create is deterministic, keeps group-less layout intact, and permits matching group and node ids
  ---
  duration_ms: 477.067017
  type: 'test'
  ...
# Subtest: visible groups occupy units, preserve their rows, and leave every outsider clear
ok 308 - visible groups occupy units, preserve their rows, and leave every outsider clear
  ---
  duration_ms: 82.73511
  type: 'test'
  ...
# Subtest: a wide group’s real right edge clears the next disconnected component
ok 309 - a wide group’s real right edge clears the next disconnected component
  ---
  duration_ms: 85.708633
  type: 'test'
  ...
# Subtest: global variable rows align disconnected components and use a tall group’s real edge
ok 310 - global variable rows align disconnected components and use a tall group’s real edge
  ---
  duration_ms: 89.864585
  type: 'test'
  ...
# Subtest: the third pass keeps an arrow-less member’s middle first-pass slot
ok 311 - the third pass keeps an arrow-less member’s middle first-pass slot
  ---
  duration_ms: 91.677552
  type: 'test'
  ...
# Subtest: parallel arrows do not weight a third-pass median twice, and quotient loops still write
ok 312 - parallel arrows do not weight a third-pass median twice, and quotient loops still write
  ---
  duration_ms: 173.14486
  type: 'test'
  ...
# Subtest: the third pass deduplicates endpoint pairs before it counts external crossings
ok 313 - the third pass deduplicates endpoint pairs before it counts external crossings
  ---
  duration_ms: 85.654791
  type: 'test'
  ...
# Subtest: the third pass keeps the first pass’s crossing count on an internal counter-example
ok 314 - the third pass keeps the first pass’s crossing count on an internal counter-example
  ---
  duration_ms: 82.356885
  type: 'test'
  ...
# Subtest: the third pass keys a member on every neighbour, including members of its group
ok 315 - the third pass keys a member on every neighbour, including members of its group
  ---
  duration_ms: 84.099887
  type: 'test'
  ...
# Subtest: the third pass gives internal and external neighbours equal weight in its median
ok 316 - the third pass gives internal and external neighbours equal weight in its median
  ---
  duration_ms: 82.641581
  type: 'test'
  ...
# Subtest: the third pass freezes other groups before it walks either group
ok 317 - the third pass freezes other groups before it walks either group
  ---
  duration_ms: 79.421364
  type: 'test'
  ...
# Subtest: a bend point reserves its own pitch, so a multi-row arrow lays out unchanged
ok 318 - a bend point reserves its own pitch, so a multi-row arrow lays out unchanged
  ---
  duration_ms: 74.738832
  type: 'test'
  ...
# Subtest: a unit shorter than its row sits on the row line rather than centred in it
ok 319 - a unit shorter than its row sits on the row line rather than centred in it
  ---
  duration_ms: 80.937802
  type: 'test'
  ...
# Subtest: the third pass reads earlier group-mates live as it walks a row
ok 320 - the third pass reads earlier group-mates live as it walks a row
  ---
  duration_ms: 91.510291
  type: 'test'
  ...
# Subtest: the third pass leaves a group rectangle and member rows at their first-pass values
ok 321 - the third pass leaves a group rectangle and member rows at their first-pass values
  ---
  duration_ms: 161.629413
  type: 'test'
  ...
# Subtest: verdict reversal is page-only and agents reset agreed entries explicitly
ok 322 - verdict reversal is page-only and agents reset agreed entries explicitly
  ---
  duration_ms: 89.796003
  type: 'test'
  ...
# Subtest: bulk verdicts are additive and one reversal is permitted
ok 323 - bulk verdicts are additive and one reversal is permitted
  ---
  duration_ms: 74.522478
  type: 'test'
  ...
# Subtest: retargeting and dropping a container preserve verdict-bearing children
ok 324 - retargeting and dropping a container preserve verdict-bearing children
  ---
  duration_ms: 74.228103
  type: 'test'
  ...
# Subtest: container removal accepts proposed-only child and recursively finds grandchild verdicts
ok 325 - container removal accepts proposed-only child and recursively finds grandchild verdicts
  ---
  duration_ms: 137.378138
  type: 'test'
  ...
# Subtest: all containment retarget cases, cycles, deep acyclic writes, and missing children follow the contract
ok 326 - all containment retarget cases, cycles, deep acyclic writes, and missing children follow the contract
  ---
  duration_ms: 299.462844
  type: 'test'
  ...
# Subtest: retargeting away unregisters a derivable child and unreadable children block removal
ok 327 - retargeting away unregisters a derivable child and unreadable children block removal
  ---
  duration_ms: 146.95126
  type: 'test'
  ...
# Subtest: whoami is unauthenticated identity, never a mutation credential
ok 328 - whoami is unauthenticated identity, never a mutation credential
  ---
  duration_ms: 67.727474
  type: 'test'
  ...
# Subtest: --show opens a browser once, and never while a tab is already on that graph
ok 329 - --show opens a browser once, and never while a tab is already on that graph
  ---
  duration_ms: 1527.316024
  type: 'test'
  ...
# Subtest: two starts at the same instant leave one server, and the loser reuses it rather than dying
ok 330 - two starts at the same instant leave one server, and the loser reuses it rather than dying
  ---
  duration_ms: 4507.719345
  type: 'test'
  ...
# Subtest: listen-first startup reuses the port holder and ignores stale .server information
ok 331 - listen-first startup reuses the port holder and ignores stale .server information
  ---
  duration_ms: 1759.145412
  type: 'test'
  ...
# Subtest: the token is published atomically while independent ports can start
ok 332 - the token is published atomically while independent ports can start
  ---
  duration_ms: 125.912807
  type: 'test'
  ...
# Subtest: GET change detection exposes agent hashes and preserves the page write hash
ok 333 - GET change detection exposes agent hashes and preserves the page write hash
  ---
  duration_ms: 112.970482
  type: 'test'
  ...
# Subtest: a kill before rename leaves the committed graph as either whole version, never a partial write
ok 334 - a kill before rename leaves the committed graph as either whole version, never a partial write
  ---
  duration_ms: 6579.748725
  type: 'test'
  ...
# Subtest: registered paths are pruned by age at startup
ok 335 - registered paths are pruned by age at startup
  ---
  duration_ms: 58.085841
  type: 'test'
  ...
# Subtest: agent reset records are durable and page verdicts clear them only while changing origin
ok 336 - agent reset records are durable and page verdicts clear them only while changing origin
  ---
  duration_ms: 85.367488
  type: 'test'
  ...
# Subtest: malformed on-disk graphs refuse without repair
ok 337 - malformed on-disk graphs refuse without repair
  ---
  duration_ms: 245.886702
  type: 'test'
  ...
# Subtest: layout runs downhill: an arrow never points back up the page
ok 338 - layout runs downhill: an arrow never points back up the page
  ---
  duration_ms: 75.567191
  type: 'test'
  ...
# Subtest: layout places every component, including a disconnected two-cycle
ok 339 - layout places every component, including a disconnected two-cycle
  ---
  duration_ms: 73.348024
  type: 'test'
  ...
# Subtest: cache-root isolation never changes the live default cache
ok 340 - cache-root isolation never changes the live default cache
  ---
  duration_ms: 71.700785
  type: 'test'
  ...
1..340
# tests 349
# suites 0
# pass 349
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 37924.545612
```

`git diff --check` (exit 0; no output).

## Could not do

Nothing.

## Choices

none
