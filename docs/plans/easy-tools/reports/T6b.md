# T6b report

`machine/lib/project-tools.js:73` reads folder paths literally, checks relative executable Git tree modes and symlinks, checks absolute and bare programs with launch's `findProgram`, isolates folder and shared lookup failures with one-line notes while retaining successful rows, and leaves the `.mcp.json` editor result intact. `machine/lib/project-tools.js:150` supports a lightweight `repo_only` read.

`viewer/pages/settings.js:2247` reads only `saved_dirs`, resolves origins concurrently, labels each project with its machine when needed, retains duplicate-repository project choices and keeps an unavailable saved choice. `machine/test/project-tools.test.js:25` and `:351` cover temporary refs, project and shared folder rows, program checks, failure isolation and literal paths. `viewer/test/app-project-tools.spec.js:1504` covers escaping, shared error and hidden states, and read-only controls; `viewer/test/app-settings.spec.js:641` covers the picker, concurrency, and an unavailable saved selection. Screenshot tests at `viewer/test/app-project-tools.spec.js:1529` and `viewer/test/app-settings.spec.js:666` skip unless `WHEELCHAIR_SCREENSHOTS` is set, capture in the managed test run folder, and copy to the requested external directory.

## Screenshots

Captured at mockup size on an isolated test server and compared with the rendered mockups. The app shell and fixture project/tool names differ; the mixed screens omit the deferred key-dependent row and use the specified updated server and validation messages. The shared screens omit the deferred shared keys section.

- `mockup-tools-mixed-phone.html`: `/tmp/wc-t6b-logs/tools-mixed-phone.png`
- `mockup-tools-mixed-desktop.html`: `/tmp/wc-t6b-logs/tools-mixed-desktop.png`
- `mockup-tools-empty-phone.html`: `/tmp/wc-t6b-logs/tools-empty-phone.png`
- `mockup-shared-none-phone.html`: `/tmp/wc-t6b-logs/shared-none-phone.png`
- `mockup-shared-chosen-phone.html`: `/tmp/wc-t6b-logs/shared-chosen-phone.png`

## Tests watched fail

- `folder failures preserve editor and shared listing`, `folder program checks use executable tree modes, absolute paths and PATH`, and `repo-only read does not fetch or list tools` failed before the implementation; program checks also failed under separate broken modes for executable bits, absolute programs, missing bare names, and a sibling-folder executable.
- `shared listing failure preserves project rows and keys-only editor` failed when the shared lookup exception was allowed to escape; `project listing failure keeps successfully discovered shared rows` failed when the successful shared row was suppressed.
- `literal tool paths do not interpret wildcard folder names` failed with literal pathspecs removed; `reading from remote default branch via a private ref with FETCH_HEAD and tags untouched` failed when temporary-ref cleanup was removed.
- `shared folder copy, collision, and refresh notes` failed when invalid and missing-program shared rows were filtered; `folder tools show mixed and empty states` failed when status reasons were replaced.
- `shared tools picker uses saved projects, resolves in parallel and retains a missing choice` failed against the original picker and again when duplicate repository entries were filtered.

## Choices

- `viewer/pages/settings.js`: show every saved project, including multiple copies of one repository, because each machine's saved copy is independently usable.
- Screenshot tests: `WHEELCHAIR_SCREENSHOTS` names the external directory receiving copies of screenshots captured under the managed test-run folder.

## Validation

### `node --test viewer/test/app-project-tools.test.js viewer/test/app-settings.test.js machine/test/project-tools.test.js`

exit 0

```text
TAP version 13
# Subtest: reading from remote default branch via a private ref with FETCH_HEAD and tags untouched
ok 1 - reading from remote default branch via a private ref with FETCH_HEAD and tags untouched
  ---
  duration_ms: 106.675297
  type: 'test'
  ...
# Subtest: temp-worktree commit, new-branch push and PR; two saves make two PRs
ok 2 - temp-worktree commit, new-branch push and PR; two saves make two PRs
  ---
  duration_ms: 240.358731
  type: 'test'
  ...
# Subtest: keys-only without a GitHub origin, key-only save and removal with revision checks
ok 3 - keys-only without a GitHub origin, key-only save and removal with revision checks
  ---
  duration_ms: 62.415329
  type: 'test'
  ...
# Subtest: pr_failed with compare link
ok 4 - pr_failed with compare link
  ---
  duration_ms: 145.195999
  type: 'test'
  ...
# Subtest: push refuses an existing branch name and keys remain saved
ok 5 - push refuses an existing branch name and keys remain saved
  ---
  duration_ms: 142.341736
  type: 'test'
  ...
# Subtest: offline fetch returns failed with original key revision and keys; Read falls back
ok 6 - offline fetch returns failed with original key revision and keys; Read falls back
  ---
  duration_ms: 107.867083
  type: 'test'
  ...
# Subtest: reserved names and conflicts created by edited tools are refused
ok 7 - reserved names and conflicts created by edited tools are refused
  ---
  duration_ms: 112.034503
  type: 'test'
  ...
# Subtest: changed key revision and project identity are refused
ok 8 - changed key revision and project identity are refused
  ---
  duration_ms: 80.289092
  type: 'test'
  ...
# Subtest: waiting tools PRs filtered by wc-tools and same repository; gh failure still lists tools
ok 9 - waiting tools PRs filtered by wc-tools and same repository; gh failure still lists tools
  ---
  duration_ms: 105.335938
  type: 'test'
  ...
# Subtest: changed file refused, unrelated commit allowed, and key-only save never fetches
ok 10 - changed file refused, unrelated commit allowed, and key-only save never fetches
  ---
  duration_ms: 229.616673
  type: 'test'
  ...
# Subtest: Start over replaces unreadable file and is refused on readable source
ok 11 - Start over replaces unreadable file and is refused on readable source
  ---
  duration_ms: 203.448627
  type: 'test'
  ...
# Subtest: dropped Save still runs to the end
ok 12 - dropped Save still runs to the end
  ---
  duration_ms: 166.700063
  type: 'test'
  ...
# Subtest: a failed key write leaves no temporary file
ok 13 - a failed key write leaves no temporary file
  ---
  duration_ms: 75.426929
  type: 'test'
  ...
# Subtest: key store mode 600 and fresh key revision after a key write
ok 14 - key store mode 600 and fresh key revision after a key write
  ---
  duration_ms: 79.676999
  type: 'test'
  ...
# Subtest: existing conflicts do not block editing unrelated fields
ok 15 - existing conflicts do not block editing unrelated fields
  ---
  duration_ms: 162.693851
  type: 'test'
  ...
# Subtest: commit failure after keys stored returns updated revision and keys
ok 16 - commit failure after keys stored returns updated revision and keys
  ---
  duration_ms: 126.29107
  type: 'test'
  ...
# Subtest: changed repository is refused
ok 17 - changed repository is refused
  ---
  duration_ms: 89.504041
  type: 'test'
  ...
# Subtest: Start over replaces a symlink with a regular file
ok 18 - Start over replaces a symlink with a regular file
  ---
  duration_ms: 172.907185
  type: 'test'
  ...
# Subtest: raw configured fetch and push URLs select the GitHub repository while Git applies insteadOf
ok 19 - raw configured fetch and push URLs select the GitHub repository while Git applies insteadOf
  ---
  duration_ms: 111.259396
  type: 'test'
  ...
# Subtest: multiple configured push URLs use keys-only mode
ok 20 - multiple configured push URLs use keys-only mode
  ---
  duration_ms: 79.207959
  type: 'test'
  ...
# Subtest: multiple configured origin URLs use keys-only mode
ok 21 - multiple configured origin URLs use keys-only mode
  ---
  duration_ms: 52.697746
  type: 'test'
  ...
# Subtest: PR URL is the last HTTPS line in gh output
ok 22 - PR URL is the last HTTPS line in gh output
  ---
  duration_ms: 143.201304
  type: 'test'
  ...
# Subtest: changed default branch refuses a tool save
ok 23 - changed default branch refuses a tool save
  ---
  duration_ms: 124.513872
  type: 'test'
  ...
# Subtest: concurrent route saves on one project serialize PR creation
ok 24 - concurrent route saves on one project serialize PR creation
  ---
  duration_ms: 2263.732124
  type: 'test'
  ...
# Subtest: alias and thread worktree share keys through routes
ok 25 - alias and thread worktree share keys through routes
  ---
  duration_ms: 149.967348
  type: 'test'
  ...
# Subtest: failed worktree add after registration removes and prunes the temporary worktree
ok 26 - failed worktree add after registration removes and prunes the temporary worktree
  ---
  duration_ms: 127.916717
  type: 'test'
  ...
# Subtest: special names work in checks and keys, and Start over requires an empty list
ok 27 - special names work in checks and keys, and Start over requires an empty list
  ---
  duration_ms: 174.864727
  type: 'test'
  ...
# Subtest: checks expose per-tool eligible and held-back key names
ok 28 - checks expose per-tool eligible and held-back key names
  ---
  duration_ms: 101.415962
  type: 'test'
  ...
# Subtest: save stages an ignored, untracked .mcp.json
ok 29 - save stages an ignored, untracked .mcp.json
  ---
  duration_ms: 181.074895
  type: 'test'
  ...
# Subtest: unreadable key store gives complete failed save and remove replies
ok 30 - unreadable key store gives complete failed save and remove replies
  ---
  duration_ms: 92.21025
  type: 'test'
  ...
# Subtest: malformed key stores never expose values in replies or launch logs
ok 31 - malformed key stores never expose values in replies or launch logs
  ---
  duration_ms: 206.248975
  type: 'test'
  ...
# Subtest: R7-1: compare_url encodes branch names but keeps slashes
ok 32 - R7-1: compare_url encodes branch names but keeps slashes
  ---
  duration_ms: 167.979004
  type: 'test'
  ...
# Subtest: Windows marks read and save independently while preserving document keys
ok 33 - Windows marks read and save independently while preserving document keys
  ---
  duration_ms: 426.869958
  type: 'test'
  ...
# Subtest: folder tools come from the default branch even with a different push destination
ok 34 - folder tools come from the default branch even with a different push destination
  ---
  duration_ms: 154.779635
  type: 'test'
  ...
# Subtest: shared folder copy, collision, and refresh notes
ok 35 - shared folder copy, collision, and refresh notes
  ---
  duration_ms: 282.159531
  type: 'test'
  ...
# Subtest: folder failures preserve editor and shared listing
ok 36 - folder failures preserve editor and shared listing
  ---
  duration_ms: 115.352293
  type: 'test'
  ...
# Subtest: folder program checks use executable tree modes, absolute paths and PATH
ok 37 - folder program checks use executable tree modes, absolute paths and PATH
  ---
  duration_ms: 190.709309
  type: 'test'
  ...
# Subtest: repo-only read does not fetch or list tools
ok 38 - repo-only read does not fetch or list tools
  ---
  duration_ms: 47.022544
  type: 'test'
  ...
# Subtest: shared listing failure preserves project rows and keys-only editor
ok 39 - shared listing failure preserves project rows and keys-only editor
  ---
  duration_ms: 116.199979
  type: 'test'
  ...
# Subtest: project listing failure keeps successfully discovered shared rows
ok 40 - project listing failure keeps successfully discovered shared rows
  ---
  duration_ms: 74.662212
  type: 'test'
  ...
# Subtest: literal tool paths do not interpret wildcard folder names
ok 41 - literal tool paths do not interpret wildcard folder names
  ---
  duration_ms: 113.953512
  type: 'test'
  ...
# Subtest: project tools routes forward requests and machine responses without storing keys
ok 42 - project tools routes forward requests and machine responses without storing keys
  ---
  duration_ms: 156.410613
  type: 'test'
  ...
# Subtest: project tools transport failures, validation and browser authorization
ok 43 - project tools transport failures, validation and browser authorization
  ---
  duration_ms: 113.648588
  type: 'test'
  ...
# Subtest: project tools forwards with a 120 second timeout
ok 44 - project tools forwards with a 120 second timeout
  ---
  duration_ms: 1.584007
  type: 'test'
  ...
# Subtest: machine replies keep multi-byte characters split across chunks
ok 45 - machine replies keep multi-byte characters split across chunks
  ---
  duration_ms: 57.856228
  type: 'test'
  ...
# Subtest: project tools forwards windows-status like the other routes
ok 46 - project tools forwards windows-status like the other routes
  ---
  duration_ms: 0.715712
  type: 'test'
  ...
# Subtest: read forwards the configured shared project and this machine’s saved paths
ok 47 - read forwards the configured shared project and this machine’s saved paths
  ---
  duration_ms: 107.835461
  type: 'test'
  ...
# Subtest: settings defaults, templates, prompt composition, counts, and validation
ok 48 - settings defaults, templates, prompt composition, counts, and validation
  ---
  duration_ms: 985.680755
  type: 'test'
  ...
# Subtest: settings prompt preview composes role and card rule placeholders by role
ok 49 - settings prompt preview composes role and card rule placeholders by role
  ---
  duration_ms: 92.756698
  type: 'test'
  ...
# Subtest: style saving, trailer delivery, chat stripping, and preview stay scoped to leads
ok 50 - style saving, trailer delivery, chat stripping, and preview stay scoped to leads
  ---
  duration_ms: 559.688056
  type: 'test'
  ...
# Subtest: settings updates serialize concurrent saves and report a missing template project
ok 51 - settings updates serialize concurrent saves and report a missing template project
  ---
  duration_ms: 145.611076
  type: 'test'
  ...
# Subtest: the role-layer cap refuses template and style saves without changing settings
ok 52 - the role-layer cap refuses template and style saves without changing settings
  ---
  duration_ms: 83.489619
  type: 'test'
  ...
# Subtest: preview has a 75-second machine timeout while ordinary calls retain five seconds
ok 53 - preview has a 75-second machine timeout while ordinary calls retain five seconds
  ---
  duration_ms: 3.370332
  type: 'test'
  ...
# Subtest: settings model and heads-up routes reject bad input and preserve the settings file mode
ok 54 - settings model and heads-up routes reject bad input and preserve the settings file mode
  ---
  duration_ms: 753.662074
  type: 'test'
  ...
# Subtest: template scopes must be listed when added or changed, while removed-project templates remain editable
ok 55 - template scopes must be listed when added or changed, while removed-project templates remain editable
  ---
  duration_ms: 89.990454
  type: 'test'
  ...
# Subtest: escalation settings, sentences, and role layers
ok 56 - escalation settings, sentences, and role layers
  ---
  duration_ms: 138.763966
  type: 'test'
  ...
# Subtest: lead name settings trim and validate names
ok 57 - lead name settings trim and validate names
  ---
  duration_ms: 175.98228
  type: 'test'
  ...
# Subtest: lead name list choice saves, validates and migrates
ok 58 - lead name list choice saves, validates and migrates
  ---
  duration_ms: 186.185375
  type: 'test'
  ...
# Subtest: gemini settings migrate and enforce account and model rules
ok 59 - gemini settings migrate and enforce account and model rules
  ---
  duration_ms: 155.271919
  type: 'test'
  ...
# Subtest: removed worker providers stay removed after saving
ok 60 - removed worker providers stay removed after saving
  ---
  duration_ms: 175.514904
  type: 'test'
  ...
# Subtest: scout preferences and session layers follow the selected provider
ok 61 - scout preferences and session layers follow the selected provider
  ---
  duration_ms: 755.057949
  type: 'test'
  ...
# Subtest: model ID limits protect near-limit scout role layers
ok 62 - model ID limits protect near-limit scout role layers
  ---
  duration_ms: 524.380552
  type: 'test'
  ...
# Subtest: your name is saved, validated, and told to every agent only when set
ok 63 - your name is saved, validated, and told to every agent only when set
  ---
  duration_ms: 218.095361
  type: 'test'
  ...
# Subtest: shared tools project choice saves and clears
ok 64 - shared tools project choice saves and clears
  ---
  duration_ms: 178.864988
  type: 'test'
  ...
1..64
# tests 64
# suites 0
# pass 64
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 8048.205189

```

### `npm --prefix viewer run test:browser -- app-project-tools.spec.js app-settings.spec.js`

exit 0

```text

> agent-graph-viewer@1.0.0 test:browser
> playwright test --reporter=list app-project-tools.spec.js app-settings.spec.js


Running 282 tests using 2 workers

(node:1630624) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:1630623) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ✓    2 [chromium] › test/app-project-tools.spec.js:84:1 › shows tools, key status, skip reasons, key warnings, waiting pull requests and notes (430ms)
  ✓    3 [chromium] › test/app-project-tools.spec.js:112:1 › waiting_error is shown as a sentence (243ms)
  ✓    4 [chromium] › test/app-project-tools.spec.js:117:1 › editing a URL keeps an unrepresentable header and unknown fields verbatim, then shows the PR link (402ms)
  ✓    5 [chromium] › test/app-project-tools.spec.js:142:1 › an unchanged form sends tools null, and changing kind is refused with a read-only header (321ms)
  ✓    1 [chromium] › test/app-settings.spec.js:36:3 › desktop › the nav shows Settings and the route serves (1.6s)
  ✓    7 [chromium] › test/app-settings.spec.js:46:3 › desktop › eight sections, kept across a reload through the hash (483ms)
  ✓    6 [chromium] › test/app-project-tools.spec.js:153:1 › adding and removing keys rebuilds the Keys list while an unsaved tool edit stays (668ms)
  ✓    8 [chromium] › test/app-settings.spec.js:62:3 › desktop › the Kimi row has no effort select while Claude keeps one (235ms)
  ✓   10 [chromium] › test/app-settings.spec.js:70:3 › desktop › permission labels name the tools in their groups (208ms)
  ✓    9 [chromium] › test/app-project-tools.spec.js:201:1 › add a tool, edit one keeping unknown fields, remove one with a confirmation (895ms)
  ✓   11 [chromium] › test/app-settings.spec.js:78:3 › desktop › a slashed Kimi alias saves through Other, survives a reload, and other providers refuse a slash (643ms)
  ✓   12 [chromium] › test/app-project-tools.spec.js:253:1 › a header with a key keeps its text before the key (440ms)
  ✓   14 [chromium] › test/app-project-tools.spec.js:291:3 › reply: pr_failed (517ms)
  ✓   13 [chromium] › test/app-settings.spec.js:100:3 › desktop › editing a table cell saves, and Not used saves null (1.1s)
  ✓   15 [chromium] › test/app-project-tools.spec.js:291:3 › reply: failed (522ms)
  ✓   16 [chromium] › test/app-settings.spec.js:137:3 › desktop › effort selects: GPT tier and both leads save; GPT has no max (744ms)
  ✓   17 [chromium] › test/app-project-tools.spec.js:291:3 › reply: refused 400 (541ms)
  ✓   18 [chromium] › test/app-settings.spec.js:157:3 › desktop › sub-lead models and scout tiers render and save independently (405ms)
  ✓   19 [chromium] › test/app-project-tools.spec.js:291:3 › reply: refused 409 (525ms)
  ✓   21 [chromium] › test/app-project-tools.spec.js:291:3 › reply: 504 (537ms)
  ✓   20 [chromium] › test/app-settings.spec.js:178:3 › desktop › Escalation: default text, Model first, Highest tier Heavy (814ms)
  ✓   22 [chromium] › test/app-project-tools.spec.js:291:3 › reply: no outcome (526ms)
  ✓   24 [chromium] › test/app-project-tools.spec.js:291:3 › reply: dropped connection (527ms)
  ✓   25 [chromium] › test/app-project-tools.spec.js:302:1 › keys-only mode shows the notice and only the keys list (243ms)
  ✓   26 [chromium] › test/app-project-tools.spec.js:313:1 › unreadable source shows the reason and Start over sends start_over (297ms)
  ✓   23 [chromium] › test/app-settings.spec.js:200:3 › desktop › creating and saving a template, marking it in use, and the worker-only switch (1.5s)
  ✓   28 [chromium] › test/app-settings.spec.js:258:3 › desktop › a template whose project is gone says so (259ms)
  ✓   27 [chromium] › test/app-project-tools.spec.js:329:3 › phone › no sideways scroll and the main flow works (617ms)
  ✓   29 [chromium] › test/app-settings.spec.js:267:3 › desktop › the auto-merge switch says Saved, not applies to new sessions, and survives a reload (572ms)
  ✓   30 [chromium] › test/app-project-tools.spec.js:355:1 › a reserved name referenced in a setting is read as the agent's own environment, not a key (398ms)
  ✓   32 [chromium] › test/app-project-tools.spec.js:373:1 › an unsaved tool removal survives a Settings re-render (315ms)
  ✓   31 [chromium] › test/app-settings.spec.js:281:3 › desktop › the style saves (584ms)
  ✓   33 [chromium] › test/app-project-tools.spec.js:394:3 › changing kind is refused for a read-only setting (292ms)
  ✓   34 [chromium] › test/app-settings.spec.js:299:3 › desktop › preview: disabled with a spinner while pending, then the result; nothing is saved (417ms)
  ✓   35 [chromium] › test/app-project-tools.spec.js:394:3 › changing kind is refused for an argument with a newline (273ms)
  ✓   36 [chromium] › test/app-settings.spec.js:324:3 › desktop › a failed preview shows one plain line under the panel (291ms)
  ✓   37 [chromium] › test/app-project-tools.spec.js:394:3 › changing kind is refused for an unknown field (317ms)
  ✓   38 [chromium] › test/app-settings.spec.js:338:3 › phone › the Settings link shows a gear, is wide enough to tap, and opens Settings (228ms)
  ✓   39 [chromium] › test/app-project-tools.spec.js:394:3 › changing kind is refused for a command with a variable (282ms)
  ✓   41 [chromium] › test/app-project-tools.spec.js:403:1 › the pickers are locked while a save is pending, and the reply lands on its own project (315ms)
  ✓   42 [chromium] › test/app-project-tools.spec.js:418:1 › arguments with a variable are read-only and kept as sent (367ms)
  ✓   43 [chromium] › test/app-project-tools.spec.js:430:1 › an unknown field is shown on the card and in the form (256ms)
  ✓   44 [chromium] › test/app-project-tools.spec.js:439:1 › key warnings follow the current key status (309ms)
  ✓   45 [chromium] › test/app-project-tools.spec.js:450:1 › shared with comes from the loaded checks, on cards and while typing in the editor (289ms)
  ✓   40 [chromium] › test/app-settings.spec.js:350:3 › phone › the sections are tabs above the section and the page never scrolls sideways (1.8s)
  ✓   46 [chromium] › test/app-project-tools.spec.js:467:1 › an unreadable source still shows waiting pull requests (242ms)
  ✓   47 [chromium] › test/app-settings.spec.js:371:7 › phone › the nav fits 390px on /app/threads (141ms)
  ✓   49 [chromium] › test/app-settings.spec.js:371:7 › phone › the nav fits 390px on /app/settings (189ms)
  ✓   48 [chromium] › test/app-project-tools.spec.js:484:1 › machine key warnings show for read-only tools and rows, and follow the key status (356ms)
  ✓   50 [chromium] › test/app-settings.spec.js:371:7 › phone › the nav fits 390px on /app/new (149ms)
  ✓   52 [chromium] › test/app-settings.spec.js:371:7 › phone › the nav fits 360px on /app/threads (162ms)
  ✓   51 [chromium] › test/app-project-tools.spec.js:513:1 › the machine picker is locked while the project list loads (254ms)
  ✓   53 [chromium] › test/app-settings.spec.js:371:7 › phone › the nav fits 360px on /app/settings (158ms)
  ✓   55 [chromium] › test/app-settings.spec.js:371:7 › phone › the nav fits 360px on /app/new (146ms)
  ✓   54 [chromium] › test/app-project-tools.spec.js:529:1 › the pickers are locked while a read is pending (283ms)
  ✓   56 [chromium] › test/app-settings.spec.js:392:3 › phone › the Escalation section fits a phone and the effort selects stay usable (415ms)
  ✓   57 [chromium] › test/app-project-tools.spec.js:540:1 › the pickers are locked during the reload after opened (476ms)
  ✓   59 [chromium] › test/app-project-tools.spec.js:557:1 › the pickers are locked while a remove-key reply is pending (336ms)
  ✓   58 [chromium] › test/app-settings.spec.js:411:3 › phone › Your name saves and survives a reload, and a too-long name is refused with the typed value kept (789ms)
  ✓   60 [chromium] › test/app-project-tools.spec.js:570:1 › a __proto__ header survives an edit of its tool URL (356ms)
  ✓   62 [chromium] › test/app-project-tools.spec.js:585:1 › a tool and a key named constructor render and save (458ms)
  ✓   61 [chromium] › test/app-settings.spec.js:433:3 › phone › the Default project folder saves, and a refusal shows under it with the typed value kept (792ms)
  ✓   63 [chromium] › test/app-project-tools.spec.js:606:1 › a $ in the text before a key is refused (369ms)
  ✓   64 [chromium] › test/app-settings.spec.js:456:3 › phone › Settings keeps its accessible name on a phone (140ms)
  ✓   65 [chromium] › test/app-project-tools.spec.js:624:1 › loading locks the section: machine change, project pick and the reload after opened (458ms)
  ✓   66 [chromium] › test/app-settings.spec.js:464:1 › picks a lead name list and uploads a custom one in Settings (684ms)
  ✓   67 [chromium] › test/app-project-tools.spec.js:666:1 › key warnings and shared with follow the loaded checks, not draft edits (543ms)
  ✓   68 [chromium] › test/app-settings.spec.js:478:1 › a quoted CSV upload keeps commas inside names (249ms)
  ✓   69 [chromium] › test/app-project-tools.spec.js:691:1 › renaming an editable header to a read-only header name is refused (400ms)
  ✓   70 [chromium] › test/app-settings.spec.js:485:1 › a later dropdown choice wins over a slow upload save (473ms)
  ✓   71 [chromium] › test/app-project-tools.spec.js:706:1 › arguments with a carriage return are read-only and kept on a rename (374ms)
  ✓   73 [chromium] › test/app-project-tools.spec.js:718:1 › cards use the baseline name across a rename and a removal (402ms)
  ✓   74 [chromium] › test/app-project-tools.spec.js:736:1 › fields the user did not change are sent exactly as read (469ms)
  ✓   75 [chromium] › test/app-project-tools.spec.js:761:1 › a failed reload after a 409 is shown with a Reload button (347ms)
  ✓   72 [chromium] › test/app-settings.spec.js:502:1 › a slow upload does not undo a list picked after switching sections (1.9s)
  ✓   76 [chromium] › test/app-project-tools.spec.js:777:1 › a failed reload after opened shows the pull request link and the reload error (366ms)
  ✓   77 [chromium] › test/app-settings.spec.js:533:1 › picking Custom while another list saves keeps Custom and its file picker (461ms)
  ✓   78 [chromium] › test/app-project-tools.spec.js:791:1 › editing one field sends the raw entry with only that field changed (467ms)
  ✓   80 [chromium] › test/app-project-tools.spec.js:811:1 › an edited header name with a space at the end is refused (317ms)
  ✓   79 [chromium] › test/app-settings.spec.js:560:1 › Custom picked again during a slow upload and another save stays Custom (720ms)
  ✓   81 [chromium] › test/app-project-tools.spec.js:819:1 › the open editor shows the value field when a key is removed from the Keys list (408ms)
  ✓   82 [chromium] › test/app-settings.spec.js:584:1 › a failed save of another list keeps a later pick of Custom (464ms)
  ✓   83 [chromium] › test/app-project-tools.spec.js:832:1 › the Reload button is disabled while its own read is pending (438ms)
  ✓   85 [chromium] › test/app-project-tools.spec.js:850:1 › editing one header value keeps an untouched sibling header name exactly (393ms)
  ✓   84 [chromium] › test/app-settings.spec.js:604:1 › only the newest uploaded file is saved (688ms)
  ✓   87 [chromium] › test/app-settings.spec.js:626:1 › models and preferences fits at 390px (185ms)
  ✓   86 [chromium] › test/app-project-tools.spec.js:865:1 › R6-1: an untouched tool name is kept exactly; an edited name with a space is refused (486ms)
  ✓   89 [chromium] › test/app-project-tools.spec.js:881:1 › R6-1: "Add a key" with a trailing space is refused, not trimmed (306ms)
  ✓   88 [chromium] › test/app-settings.spec.js:641:1 › shared tools picker uses saved projects, resolves in parallel and retains a missing choice (493ms)
  -   91 [chromium] › test/app-settings.spec.js:666:1 › capture shared tools picker screens
(node:1634660) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ✓   90 [chromium] › test/app-project-tools.spec.js:890:1 › R6-1: removing a tool closes its open editor and the tool does not come back (594ms)
  ✓   92 [chromium] › test/app-project-tools.spec.js:908:1 › R6-1: a tool the form cannot edit still shows its kind and what it runs (238ms)
  ✓   94 [chromium] › test/app-project-tools.spec.js:915:1 › R6-2: a touched field that ends equal to the original is written back as read (414ms)
  ✓   95 [chromium] › test/app-project-tools.spec.js:929:1 › R6-2: command and web address are not trimmed (329ms)
  ✓   96 [chromium] › test/app-project-tools.spec.js:939:1 › R6-2: typing in the web address and restoring it sends the entry unchanged (328ms)
  ✓   97 [chromium] › test/app-project-tools.spec.js:949:1 › R7-1: a setting with a newline is read-only, refuses a kind change and is sent unchanged (360ms)
  ✓   98 [chromium] › test/app-project-tools.spec.js:962:1 › R7-1: a header value with a tab is read-only (259ms)
  ✓   93 [firefox] › test/app-project-tools.spec.js:84:1 › shows tools, key status, skip reasons, key warnings, waiting pull requests and notes (1.5s)
  ✓   99 [chromium] › test/app-project-tools.spec.js:968:1 › R7-1: a command with a control character is read-only and kept on an unrelated edit (359ms)
  ✓  100 [firefox] › test/app-project-tools.spec.js:112:1 › waiting_error is shown as a sentence (503ms)
  ✓  101 [chromium] › test/app-project-tools.spec.js:979:1 › R7-1: a tool name with a newline shows read-only with no Edit button (255ms)
  ✓  103 [chromium] › test/app-project-tools.spec.js:986:1 › R7-1: a read-only web tool card shows every raw field and its key chip (256ms)
  ✓  104 [chromium] › test/app-project-tools.spec.js:994:1 › R7-2: a read-only value with a newline shows in its JSON form, not collapsed (255ms)
  ✓  102 [firefox] › test/app-project-tools.spec.js:117:1 › editing a URL keeps an unrepresentable header and unknown fields verbatim, then shows the PR link (783ms)
  ✓  105 [chromium] › test/app-project-tools.spec.js:999:1 › R8-2: a tool with both url and command shows every raw field in file order (257ms)
  ✓  107 [chromium] › test/app-project-tools.spec.js:1008:1 › R8-2: an unknown type is shown as written with all its fields (256ms)
  ✓  106 [firefox] › test/app-project-tools.spec.js:142:1 › an unchanged form sends tools null, and changing kind is refused with a read-only header (635ms)
  ✓  108 [chromium] › test/app-project-tools.spec.js:1016:1 › R8-2: an editable header row with a key and trailing text shows the key status (484ms)
  ✓  110 [chromium] › test/app-project-tools.spec.js:1028:1 › R8-2: a tool the form cannot edit shows a key line from the machine checks (263ms)
  ✓  111 [chromium] › test/app-project-tools.spec.js:1035:1 › R8-2: a field value with HTML is shown as text and creates no element (231ms)
  ✓  109 [firefox] › test/app-project-tools.spec.js:153:1 › adding and removing keys rebuilds the Keys list while an unsaved tool edit stays (1.2s)
  ✓  113 [firefox] › test/app-project-tools.spec.js:201:1 › add a tool, edit one keeping unknown fields, remove one with a confirmation (1.3s)
  ✓  114 [firefox] › test/app-project-tools.spec.js:253:1 › a header with a key keeps its text before the key (814ms)
  ✓  115 [firefox] › test/app-project-tools.spec.js:291:3 › reply: pr_failed (797ms)
  ✓  112 [chromium] › test/app-project-tools.spec.js:1042:1 › Unity preset adds distinct tools and reports preparation (3.8s)
  ✓  117 [chromium] › test/app-project-tools.spec.js:1057:1 › Unity preset reports a failed fetch (319ms)
  ✓  116 [firefox] › test/app-project-tools.spec.js:291:3 › reply: failed (910ms)
  ✓  118 [chromium] › test/app-project-tools.spec.js:1063:1 › Unity button ignores a double press while the first request is held (320ms)
  ✓  120 [chromium] › test/app-project-tools.spec.js:1089:1 › the Runs on Windows switch shows only on WSL for eligible web addresses and follows URL edits (319ms)
  ✓  121 [chromium] › test/app-project-tools.spec.js:1107:1 › the switch is hidden when the machine is not WSL (282ms)
  ✓  122 [chromium] › test/app-project-tools.spec.js:1115:1 › a switch change alone is dirty and saves windows with tools (384ms)
  ✓  123 [chromium] › test/app-project-tools.spec.js:1131:3 › open editor follows card switch off through save (387ms)
  ✓  119 [firefox] › test/app-project-tools.spec.js:291:3 › reply: refused 400 (1.9s)
  ✓  124 [chromium] › test/app-project-tools.spec.js:1131:3 › open editor follows card switch on through save (388ms)
  ✓  126 [chromium] › test/app-project-tools.spec.js:1144:1 › the form switch follows the card until touched, then the form choice wins (411ms)
  ✓  127 [chromium] › test/app-project-tools.spec.js:1159:1 › cancel discards the form switch choice but keeps the card switch change (372ms)
  ✓  125 [firefox] › test/app-project-tools.spec.js:291:3 › reply: refused 409 (872ms)
  ✓  128 [chromium] › test/app-project-tools.spec.js:1171:1 › rename and delete update the saved windows list; marks on hidden entries are kept (388ms)
  ✓  129 [firefox] › test/app-project-tools.spec.js:291:3 › reply: 504 (794ms)
  ✓  130 [chromium] › test/app-project-tools.spec.js:1183:1 › a mark on a hidden entry stays; deleting an entry removes its mark (507ms)
  ✓  132 [chromium] › test/app-project-tools.spec.js:1197:1 › a key-only save sends no windows (332ms)
  ✓  131 [firefox] › test/app-project-tools.spec.js:291:3 › reply: no outcome (817ms)
  ✓  134 [firefox] › test/app-project-tools.spec.js:291:3 › reply: dropped connection (717ms)
  ✓  133 [chromium] › test/app-project-tools.spec.js:1207:1 › the status line shows each state with its check time and Check again (1.2s)
  ✓  135 [firefox] › test/app-project-tools.spec.js:302:1 › keys-only mode shows the notice and only the keys list (502ms)
  ✓  137 [firefox] › test/app-project-tools.spec.js:313:1 › unreadable source shows the reason and Start over sends start_over (557ms)
  ✓  136 [chromium] › test/app-project-tools.spec.js:1234:1 › a failed request says Couldn't check (1.1s)
  ✓  138 [firefox] › test/app-project-tools.spec.js:329:3 › phone › no sideways scroll and the main flow works (1.1s)
  ✓  140 [firefox] › test/app-project-tools.spec.js:355:1 › a reserved name referenced in a setting is read as the agent's own environment, not a key (685ms)
  ✓  139 [chromium] › test/app-project-tools.spec.js:1239:1 › after an opened pull request the reread clears the store and a stale reply is dropped (2.0s)
  ✓  141 [firefox] › test/app-project-tools.spec.js:373:1 › an unsaved tool removal survives a Settings re-render (530ms)
  ✓  142 [chromium] › test/app-project-tools.spec.js:1255:1 › two rows with the same name and different URLs each get their own result (1.1s)
  ✓  143 [firefox] › test/app-project-tools.spec.js:394:3 › changing kind is refused for a read-only setting (1.6s)
  ✓  145 [firefox] › test/app-project-tools.spec.js:394:3 › changing kind is refused for an argument with a newline (564ms)
  ✓  146 [firefox] › test/app-project-tools.spec.js:394:3 › changing kind is refused for an unknown field (515ms)
  ✓  147 [firefox] › test/app-project-tools.spec.js:394:3 › changing kind is refused for a command with a variable (466ms)
  ✓  148 [firefox] › test/app-project-tools.spec.js:403:1 › the pickers are locked while a save is pending, and the reply lands on its own project (488ms)
  ✓  144 [chromium] › test/app-project-tools.spec.js:1268:1 › Cancel, Keep changes, a reload and the Unity poll end with a line for the current values (3.0s)
  ✓  149 [firefox] › test/app-project-tools.spec.js:418:1 › arguments with a variable are read-only and kept as sent (587ms)
  ✓  151 [firefox] › test/app-project-tools.spec.js:430:1 › an unknown field is shown on the card and in the form (525ms)
  ✓  152 [firefox] › test/app-project-tools.spec.js:439:1 › key warnings follow the current key status (515ms)
  ✓  150 [chromium] › test/app-project-tools.spec.js:1287:1 › a URL edited A to B to A before the check fires shows A's result; rename keeps the line; kind change hides it (1.9s)
  ✓  153 [firefox] › test/app-project-tools.spec.js:450:1 › shared with comes from the loaded checks, on cards and while typing in the editor (651ms)
  ✓  155 [firefox] › test/app-project-tools.spec.js:467:1 › an unreadable source still shows waiting pull requests (433ms)
  ✓  154 [chromium] › test/app-project-tools.spec.js:1307:1 › a reply that arrives after switching project or for an old URL is not applied (2.2s)
  ✓  156 [firefox] › test/app-project-tools.spec.js:484:1 › machine key warnings show for read-only tools and rows, and follow the key status (2.1s)
  ✓  158 [firefox] › test/app-project-tools.spec.js:513:1 › the machine picker is locked while the project list loads (469ms)
  ✓  159 [firefox] › test/app-project-tools.spec.js:529:1 › the pickers are locked while a read is pending (418ms)
  ✓  160 [firefox] › test/app-project-tools.spec.js:540:1 › the pickers are locked during the reload after opened (700ms)
  ✓  157 [chromium] › test/app-project-tools.spec.js:1320:1 › a stale reply for an old URL is not applied (2.2s)
  ✓  161 [firefox] › test/app-project-tools.spec.js:557:1 › the pickers are locked while a remove-key reply is pending (595ms)
  ✓  163 [firefox] › test/app-project-tools.spec.js:570:1 › a __proto__ header survives an edit of its tool URL (586ms)
  ✓  164 [firefox] › test/app-project-tools.spec.js:585:1 › a tool and a key named constructor render and save (703ms)
  ✓  162 [chromium] › test/app-project-tools.spec.js:1342:1 › timing: URL A to B to A inside the debounce shows A's stored result and sends no request for B (1.9s)
  ✓  165 [firefox] › test/app-project-tools.spec.js:606:1 › a $ in the text before a key is refused (667ms)
  ✓  166 [chromium] › test/app-project-tools.spec.js:1355:1 › timing: Keep changes before the debounce fires still ends on a result (1.2s)
  ✓  167 [firefox] › test/app-project-tools.spec.js:624:1 › loading locks the section: machine change, project pick and the reload after opened (701ms)
  ✓  169 [firefox] › test/app-project-tools.spec.js:666:1 › key warnings and shared with follow the loaded checks, not draft edits (929ms)
  ✓  168 [chromium] › test/app-project-tools.spec.js:1368:1 › timing: renaming during a check keeps the pending request and shows its result (2.0s)
  ✓  171 [chromium] › test/app-project-tools.spec.js:1382:1 › timing: changing kind away and back during a check never leaves the line on Checking (1.9s)
  ✓  170 [firefox] › test/app-project-tools.spec.js:691:1 › renaming an editable header to a read-only header name is refused (2.9s)
  ✓  173 [firefox] › test/app-project-tools.spec.js:706:1 › arguments with a carriage return are read-only and kept on a rename (760ms)
  ✓  174 [firefox] › test/app-project-tools.spec.js:718:1 › cards use the baseline name across a rename and a removal (678ms)
  ✓  175 [firefox] › test/app-project-tools.spec.js:736:1 › fields the user did not change are sent exactly as read (818ms)
  ✓  176 [firefox] › test/app-project-tools.spec.js:761:1 › a failed reload after a 409 is shown with a Reload button (581ms)
  ✓  177 [firefox] › test/app-project-tools.spec.js:777:1 › a failed reload after opened shows the pull request link and the reload error (670ms)
  ✓  178 [firefox] › test/app-project-tools.spec.js:791:1 › editing one field sends the raw entry with only that field changed (758ms)
  ✓  179 [firefox] › test/app-project-tools.spec.js:811:1 › an edited header name with a space at the end is refused (577ms)
  ✓  172 [chromium] › test/app-project-tools.spec.js:1398:1 › timing: a Unity poll re-render while a check is pending still ends on the held reply (5.0s)
  ✓  180 [firefox] › test/app-project-tools.spec.js:819:1 › the open editor shows the value field when a key is removed from the Keys list (815ms)
  ✓  182 [firefox] › test/app-project-tools.spec.js:832:1 › the Reload button is disabled while its own read is pending (640ms)
  ✓  181 [chromium] › test/app-project-tools.spec.js:1417:1 › timing: a same-project reload while a check is pending drops the old reply and ends on a result (2.5s)
  ✓  183 [firefox] › test/app-project-tools.spec.js:850:1 › editing one header value keeps an untouched sibling header name exactly (3.5s)
  ✓  184 [chromium] › test/app-project-tools.spec.js:1435:1 › timing: a save clears the store and a reply to a request made before it is not stored (2.4s)
  ✓  185 [firefox] › test/app-project-tools.spec.js:865:1 › R6-1: an untouched tool name is kept exactly; an edited name with a space is refused (1.1s)
  ✓  186 [chromium] › test/app-project-tools.spec.js:1454:1 › timing: two rows with the same name and different URLs go in one request with distinct ids (1.1s)
  ✓  187 [firefox] › test/app-project-tools.spec.js:881:1 › R6-1: "Add a key" with a trailing space is refused, not trimmed (674ms)
  ✓  188 [chromium] › test/app-project-tools.spec.js:1467:1 › timing: same-name rows with different URLs go in one request, distinct ids, each shows its own result (card and form copy) (1.2s)
  ✓  189 [firefox] › test/app-project-tools.spec.js:890:1 › R6-1: removing a tool closes its open editor and the tool does not come back (921ms)
  ✓  191 [firefox] › test/app-project-tools.spec.js:908:1 › R6-1: a tool the form cannot edit still shows its kind and what it runs (492ms)
  ✓  190 [chromium] › test/app-project-tools.spec.js:1484:1 › timing: two keys due in one debounce window go out in one request, not before it ends (1.2s)
  ✓  192 [firefox] › test/app-project-tools.spec.js:915:1 › R6-2: a touched field that ends equal to the original is written back as read (782ms)
  ✓  193 [chromium] › test/app-project-tools.spec.js:1498:1 › timing: a network abort says Couldn't check (1.1s)
  ✓  194 [firefox] › test/app-project-tools.spec.js:929:1 › R6-2: command and web address are not trimmed (707ms)
  ✓  195 [chromium] › test/app-project-tools.spec.js:1504:1 › folder tools show mixed and empty states (271ms)
  ✓  197 [chromium] › test/app-project-tools.spec.js:1524:1 › folder tools empty state (288ms)
  -  198 [chromium] › test/app-project-tools.spec.js:1529:1 › capture folder tool screens
  ✓  196 [firefox] › test/app-project-tools.spec.js:939:1 › R6-2: typing in the web address and restoring it sends the entry unchanged (693ms)
(node:1646069) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ✓  199 [firefox] › test/app-project-tools.spec.js:949:1 › R7-1: a setting with a newline is read-only, refuses a kind change and is sent unchanged (837ms)
  ✓  201 [firefox] › test/app-project-tools.spec.js:962:1 › R7-1: a header value with a tab is read-only (579ms)
  ✓  200 [firefox] › test/app-settings.spec.js:36:3 › desktop › the nav shows Settings and the route serves (2.6s)
  ✓  203 [firefox] › test/app-settings.spec.js:46:3 › desktop › eight sections, kept across a reload through the hash (802ms)
  ✓  204 [firefox] › test/app-settings.spec.js:62:3 › desktop › the Kimi row has no effort select while Claude keeps one (392ms)
  ✓  202 [firefox] › test/app-project-tools.spec.js:968:1 › R7-1: a command with a control character is read-only and kept on an unrelated edit (3.3s)
  ✓  205 [firefox] › test/app-settings.spec.js:70:3 › desktop › permission labels name the tools in their groups (574ms)
  ✓  206 [firefox] › test/app-project-tools.spec.js:979:1 › R7-1: a tool name with a newline shows read-only with no Edit button (584ms)
  ✓  208 [firefox] › test/app-project-tools.spec.js:986:1 › R7-1: a read-only web tool card shows every raw field and its key chip (478ms)
  ✓  207 [firefox] › test/app-settings.spec.js:78:3 › desktop › a slashed Kimi alias saves through Other, survives a reload, and other providers refuse a slash (982ms)
  ✓  209 [firefox] › test/app-project-tools.spec.js:994:1 › R7-2: a read-only value with a newline shows in its JSON form, not collapsed (443ms)
  ✓  211 [firefox] › test/app-project-tools.spec.js:999:1 › R8-2: a tool with both url and command shows every raw field in file order (534ms)
  ✓  212 [firefox] › test/app-project-tools.spec.js:1008:1 › R8-2: an unknown type is shown as written with all its fields (447ms)
  ✓  210 [firefox] › test/app-settings.spec.js:100:3 › desktop › editing a table cell saves, and Not used saves null (1.6s)
  ✓  213 [firefox] › test/app-project-tools.spec.js:1016:1 › R8-2: an editable header row with a key and trailing text shows the key status (935ms)
  ✓  214 [firefox] › test/app-settings.spec.js:137:3 › desktop › effort selects: GPT tier and both leads save; GPT has no max (838ms)
  ✓  215 [firefox] › test/app-project-tools.spec.js:1028:1 › R8-2: a tool the form cannot edit shows a key line from the machine checks (469ms)
  ✓  217 [firefox] › test/app-project-tools.spec.js:1035:1 › R8-2: a field value with HTML is shown as text and creates no element (467ms)
  ✓  216 [firefox] › test/app-settings.spec.js:157:3 › desktop › sub-lead models and scout tiers render and save independently (838ms)
  ✓  219 [firefox] › test/app-settings.spec.js:178:3 › desktop › Escalation: default text, Model first, Highest tier Heavy (1.1s)
  ✓  218 [firefox] › test/app-project-tools.spec.js:1042:1 › Unity preset adds distinct tools and reports preparation (3.9s)
  ✓  220 [firefox] › test/app-settings.spec.js:200:3 › desktop › creating and saving a template, marking it in use, and the worker-only switch (2.9s)
  ✓  222 [firefox] › test/app-settings.spec.js:258:3 › desktop › a template whose project is gone says so (524ms)
  ✓  223 [firefox] › test/app-settings.spec.js:267:3 › desktop › the auto-merge switch says Saved, not applies to new sessions, and survives a reload (775ms)
  ✓  224 [firefox] › test/app-settings.spec.js:281:3 › desktop › the style saves (767ms)
  ✓  225 [firefox] › test/app-settings.spec.js:299:3 › desktop › preview: disabled with a spinner while pending, then the result; nothing is saved (606ms)
  ✓  226 [firefox] › test/app-settings.spec.js:324:3 › desktop › a failed preview shows one plain line under the panel (405ms)
  ✓  221 [firefox] › test/app-project-tools.spec.js:1057:1 › Unity preset reports a failed fetch (3.7s)
  ✓  227 [firefox] › test/app-settings.spec.js:338:3 › phone › the Settings link shows a gear, is wide enough to tap, and opens Settings (460ms)
  ✓  228 [firefox] › test/app-project-tools.spec.js:1063:1 › Unity button ignores a double press while the first request is held (716ms)
  ✓  230 [firefox] › test/app-project-tools.spec.js:1089:1 › the Runs on Windows switch shows only on WSL for eligible web addresses and follows URL edits (527ms)
  ✓  231 [firefox] › test/app-project-tools.spec.js:1107:1 › the switch is hidden when the machine is not WSL (511ms)
  ✓  229 [firefox] › test/app-settings.spec.js:350:3 › phone › the sections are tabs above the section and the page never scrolls sideways (2.1s)
  ✓  232 [firefox] › test/app-project-tools.spec.js:1115:1 › a switch change alone is dirty and saves windows with tools (670ms)
  ✓  233 [firefox] › test/app-settings.spec.js:371:7 › phone › the nav fits 390px on /app/threads (348ms)
  ✓  235 [firefox] › test/app-settings.spec.js:371:7 › phone › the nav fits 390px on /app/settings (394ms)
  ✓  234 [firefox] › test/app-project-tools.spec.js:1131:3 › open editor follows card switch off through save (648ms)
  ✓  237 [firefox] › test/app-project-tools.spec.js:1131:3 › open editor follows card switch on through save (662ms)
  ✓  238 [firefox] › test/app-project-tools.spec.js:1144:1 › the form switch follows the card until touched, then the form choice wins (698ms)
  ✓  236 [firefox] › test/app-settings.spec.js:371:7 › phone › the nav fits 390px on /app/new (1.4s)
  ✓  240 [firefox] › test/app-settings.spec.js:371:7 › phone › the nav fits 360px on /app/threads (400ms)
  ✓  239 [firefox] › test/app-project-tools.spec.js:1159:1 › cancel discards the form switch choice but keeps the card switch change (683ms)
  ✓  241 [firefox] › test/app-settings.spec.js:371:7 › phone › the nav fits 360px on /app/settings (374ms)
  ✓  243 [firefox] › test/app-settings.spec.js:371:7 › phone › the nav fits 360px on /app/new (360ms)
  ✓  242 [firefox] › test/app-project-tools.spec.js:1171:1 › rename and delete update the saved windows list; marks on hidden entries are kept (640ms)
  ✓  244 [firefox] › test/app-settings.spec.js:392:3 › phone › the Escalation section fits a phone and the effort selects stay usable (746ms)
  ✓  246 [firefox] › test/app-settings.spec.js:411:3 › phone › Your name saves and survives a reload, and a too-long name is refused with the typed value kept (934ms)
  ✓  247 [firefox] › test/app-settings.spec.js:433:3 › phone › the Default project folder saves, and a refusal shows under it with the typed value kept (920ms)
  ✓  248 [firefox] › test/app-settings.spec.js:456:3 › phone › Settings keeps its accessible name on a phone (322ms)
  ✓  249 [firefox] › test/app-settings.spec.js:464:1 › picks a lead name list and uploads a custom one in Settings (644ms)
  ✓  250 [firefox] › test/app-settings.spec.js:478:1 › a quoted CSV upload keeps commas inside names (454ms)
  ✓  245 [firefox] › test/app-project-tools.spec.js:1183:1 › a mark on a hidden entry stays; deleting an entry removes its mark (4.7s)
  ✓  252 [firefox] › test/app-project-tools.spec.js:1197:1 › a key-only save sends no windows (651ms)
  ✓  251 [firefox] › test/app-settings.spec.js:485:1 › a later dropdown choice wins over a slow upload save (1.5s)
  ✓  253 [firefox] › test/app-project-tools.spec.js:1207:1 › the status line shows each state with its check time and Check again (1.5s)
  ✓  254 [firefox] › test/app-settings.spec.js:502:1 › a slow upload does not undo a list picked after switching sections (2.1s)
  ✓  255 [firefox] › test/app-project-tools.spec.js:1234:1 › a failed request says Couldn't check (1.2s)
  ✓  256 [firefox] › test/app-settings.spec.js:533:1 › picking Custom while another list saves keeps Custom and its file picker (606ms)
  ✓  258 [firefox] › test/app-settings.spec.js:560:1 › Custom picked again during a slow upload and another save stays Custom (902ms)
  ✓  259 [firefox] › test/app-settings.spec.js:584:1 › a failed save of another list keeps a later pick of Custom (618ms)
  ✓  257 [firefox] › test/app-project-tools.spec.js:1239:1 › after an opened pull request the reread clears the store and a stale reply is dropped (2.3s)
  ✓  260 [firefox] › test/app-settings.spec.js:604:1 › only the newest uploaded file is saved (975ms)
  ✓  262 [firefox] › test/app-settings.spec.js:626:1 › models and preferences fits at 390px (359ms)
  ✓  261 [firefox] › test/app-project-tools.spec.js:1255:1 › two rows with the same name and different URLs each get their own result (1.3s)
  ✓  263 [firefox] › test/app-settings.spec.js:641:1 › shared tools picker uses saved projects, resolves in parallel and retains a missing choice (717ms)
  -  265 [firefox] › test/app-settings.spec.js:666:1 › capture shared tools picker screens
  ✓  264 [firefox] › test/app-project-tools.spec.js:1268:1 › Cancel, Keep changes, a reload and the Unity poll end with a line for the current values (3.5s)
  ✓  266 [firefox] › test/app-project-tools.spec.js:1287:1 › a URL edited A to B to A before the check fires shows A's result; rename keeps the line; kind change hides it (2.1s)
  ✓  267 [firefox] › test/app-project-tools.spec.js:1307:1 › a reply that arrives after switching project or for an old URL is not applied (2.4s)
  ✓  268 [firefox] › test/app-project-tools.spec.js:1320:1 › a stale reply for an old URL is not applied (2.4s)
  ✓  269 [firefox] › test/app-project-tools.spec.js:1342:1 › timing: URL A to B to A inside the debounce shows A's stored result and sends no request for B (4.9s)
  ✓  270 [firefox] › test/app-project-tools.spec.js:1355:1 › timing: Keep changes before the debounce fires still ends on a result (1.5s)
  ✓  271 [firefox] › test/app-project-tools.spec.js:1368:1 › timing: renaming during a check keeps the pending request and shows its result (2.1s)
  ✓  272 [firefox] › test/app-project-tools.spec.js:1382:1 › timing: changing kind away and back during a check never leaves the line on Checking (2.2s)
  ✓  273 [firefox] › test/app-project-tools.spec.js:1398:1 › timing: a Unity poll re-render while a check is pending still ends on the held reply (5.3s)
  ✓  274 [firefox] › test/app-project-tools.spec.js:1417:1 › timing: a same-project reload while a check is pending drops the old reply and ends on a result (2.7s)
  ✓  275 [firefox] › test/app-project-tools.spec.js:1435:1 › timing: a save clears the store and a reply to a request made before it is not stored (2.6s)
  ✓  276 [firefox] › test/app-project-tools.spec.js:1454:1 › timing: two rows with the same name and different URLs go in one request with distinct ids (1.2s)
  ✓  277 [firefox] › test/app-project-tools.spec.js:1467:1 › timing: same-name rows with different URLs go in one request, distinct ids, each shows its own result (card and form copy) (1.4s)
  ✓  278 [firefox] › test/app-project-tools.spec.js:1484:1 › timing: two keys due in one debounce window go out in one request, not before it ends (1.4s)
  ✓  279 [firefox] › test/app-project-tools.spec.js:1498:1 › timing: a network abort says Couldn't check (4.8s)
  ✓  280 [firefox] › test/app-project-tools.spec.js:1504:1 › folder tools show mixed and empty states (588ms)
  ✓  281 [firefox] › test/app-project-tools.spec.js:1524:1 › folder tools empty state (373ms)
  -  282 [firefox] › test/app-project-tools.spec.js:1529:1 › capture folder tool screens

  4 skipped
  278 passed (2.5m)

```

### `WHEELCHAIR_SCREENSHOTS=/tmp/wc-t6b-logs npm --prefix viewer run test:browser -- app-project-tools.spec.js --project=chromium --grep 'capture folder tool screens'`

exit 0

```text

> agent-graph-viewer@1.0.0 test:browser
> playwright test --reporter=list app-project-tools.spec.js --project=chromium --grep capture folder tool screens


Running 1 test using 1 worker

(node:1616984) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ✓  1 [chromium] › test/app-project-tools.spec.js:1529:1 › capture folder tool screens (489ms)

  1 passed (1.1s)

```

### `WHEELCHAIR_SCREENSHOTS=/tmp/wc-t6b-logs npm --prefix viewer run test:browser -- app-settings.spec.js --project=chromium --grep 'capture shared tools picker screens'`

exit 0

```text

> agent-graph-viewer@1.0.0 test:browser
> playwright test --reporter=list app-settings.spec.js --project=chromium --grep capture shared tools picker screens


Running 1 test using 1 worker

(node:1628660) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ✓  1 [chromium] › test/app-settings.spec.js:666:1 › capture shared tools picker screens (2.4s)

  1 passed (3.0s)

```

### `node --test viewer/test/*.test.js`

Both runs exited 1. The first, concurrent with browser tests, also failed `app-quiet.test.js` test `6 message clears debt` (expected 0, got 1); that failure passed in the second run. Both runs failed the known out-of-boundary `viewer/test/app-shared-tools-setting.test.js:50` test `ready event updates folder problem card` with `Cannot read properties of undefined (reading 'some')`. The second run started before the final sibling-program fix was made; the subsequent targeted Node validation above covers that fix. The two-failure rule stops further retries.

First run, exit 1:

```text
TAP version 13
# Subtest: events pair in either order, upgrade closure once, and preserve turn and queue
ok 1 - events pair in either order, upgrade closure once, and preserve turn and queue
  ---
  duration_ms: 44.830391
  type: 'test'
  ...
# Subtest: retention, parallel current, trail, failures and context
ok 2 - retention, parallel current, trail, failures and context
  ---
  duration_ms: 7.843126
  type: 'test'
  ...
# Subtest: late starts and pending ends expire, with bounded running steps
ok 3 - late starts and pending ends expire, with bounded running steps
  ---
  duration_ms: 4.064518
  type: 'test'
  ...
# Subtest: thinking gaps and current choose the latest running step, then the previous one
ok 4 - thinking gaps and current choose the latest running step, then the previous one
  ---
  duration_ms: 1.996981
  type: 'test'
  ...
# Subtest: pending ends are bounded
ok 5 - pending ends are bounded
  ---
  duration_ms: 4.319015
  type: 'test'
  ...
# Subtest: mid-turn delivery closes the preceding turn for late step starts
ok 6 - mid-turn delivery closes the preceding turn for late step starts
  ---
  duration_ms: 6.345904
  type: 'test'
  ...
# Subtest: lead names pick a random free name, case insensitively, and release archived names
ok 7 - lead names pick a random free name, case insensitively, and release archived names
  ---
  duration_ms: 3.787426
  type: 'test'
  ...
# Subtest: lead names come from the chosen list
ok 8 - lead names come from the chosen list
  ---
  duration_ms: 2.178449
  type: 'test'
  ...
# Subtest: agent tree keeps finished nodes, derives states and hides briefs
ok 9 - agent tree keeps finished nodes, derives states and hides briefs
  ---
  duration_ms: 13.364227
  type: 'test'
  ...
# Subtest: individual states and needs-you belong to the lead
ok 10 - individual states and needs-you belong to the lead
  ---
  duration_ms: 0.689072
  type: 'test'
  ...
# Subtest: messages only make an agent wait for its starter until the starter replies
ok 11 - messages only make an agent wait for its starter until the starter replies
  ---
  duration_ms: 0.713959
  type: 'test'
  ...
# Subtest: a plain status message to the starter leaves the agent idle, not waiting
ok 12 - a plain status message to the starter leaves the agent idle, not waiting
  ---
  duration_ms: 0.204132
  type: 'test'
  ...
# Subtest: waiting on children, asides, stage and completion
ok 13 - waiting on children, asides, stage and completion
  ---
  duration_ms: 0.564502
  type: 'test'
  ...
# Subtest: titles, result ownership, first turn and secrets
ok 14 - titles, result ownership, first turn and secrets
  ---
  duration_ms: 0.473458
  type: 'test'
  ...
# Subtest: tree handles old leads, orphans, ordering, exclusions and cycles
ok 15 - tree handles old leads, orphans, ordering, exclusions and cycles
  ---
  duration_ms: 0.580864
  type: 'test'
  ...
# Subtest: agents reads stage from worktree or saved status without one
ok 16 - agents reads stage from worktree or saved status without one
  ---
  duration_ms: 14.325651
  type: 'test'
  ...
# Subtest: review rounds use latest fixing or clean card including replaced cards
ok 17 - review rounds use latest fixing or clean card including replaced cards
  ---
  duration_ms: 0.395077
  type: 'test'
  ...
# Subtest: review reports and finished timestamps use the newest result
ok 18 - review reports and finished timestamps use the newest result
  ---
  duration_ms: 0.545837
  type: 'test'
  ...
# Subtest: agents carry the account name and the latest move, with removed accounts named as such
ok 19 - agents carry the account name and the latest move, with removed accounts named as such
  ---
  duration_ms: 0.671288
  type: 'test'
  ...
# Subtest: assistant ids count hidden transcript text before filtering
ok 20 - assistant ids count hidden transcript text before filtering
  ---
  duration_ms: 7.008755
  type: 'test'
  ...
# Subtest: aside turns fork, resume, save before ack, and retry failures
ok 21 - aside turns fork, resume, save before ack, and retry failures
  ---
  duration_ms: 141.339381
  type: 'test'
  ...
# Subtest: step-up refusal retries once; controls never step up; graphs are saved
ok 22 - step-up refusal retries once; controls never step up; graphs are saved
  ---
  duration_ms: 37.18276
  type: 'test'
  ...
# Subtest: dispatching turns recover a lost POST with the same id
ok 23 - dispatching turns recover a lost POST with the same id
  ---
  duration_ms: 9.603243
  type: 'test'
  ...
# Subtest: routes anchor lead messages, expose summaries, hand off and archive
ok 24 - routes anchor lead messages, expose summaries, hand off and archive
  ---
  duration_ms: 274.751534
  type: 'test'
  ...
# Subtest: Think harder repeats the last question and summary observes its readiness gates
ok 25 - Think harder repeats the last question and summary observes its readiness gates
  ---
  duration_ms: 12.316658
  type: 'test'
  ...
# Subtest: a fresh hub selects stranded queued asides but not failed or archived ones
ok 26 - a fresh hub selects stranded queued asides but not failed or archived ones
  ---
  duration_ms: 24.019819
  type: 'test'
  ...
# Subtest: aside GET computes heavy usability from the model command without storing it
ok 27 - aside GET computes heavy usability from the model command without storing it
  ---
  duration_ms: 36.030921
  type: 'test'
  ...
# Subtest: slow machine calls leave routes free, coalesce pumps, and discard archived results
ok 28 - slow machine calls leave routes free, coalesce pumps, and discard archived results
  ---
  duration_ms: 19.047761
  type: 'test'
  ...
# Subtest: archive races compensate claimed turns without changing history
    # Subtest: before recheck
    ok 1 - before recheck
      ---
      duration_ms: 14.88248
      type: 'test'
      ...
    # Subtest: before post response
    ok 2 - before post response
      ---
      duration_ms: 32.372403
      type: 'test'
      ...
    # Subtest: finished unheld
    ok 3 - finished unheld
      ---
      duration_ms: 15.12737
      type: 'test'
      ...
    1..3
ok 29 - archive races compensate claimed turns without changing history
  ---
  duration_ms: 64.701712
  type: 'test'
  ...
# Subtest: a cancelled turn is never acknowledged, so a late start runs nothing
ok 30 - a cancelled turn is never acknowledged, so a late start runs nothing
  ---
  duration_ms: 20.194981
  type: 'test'
  ...
# Subtest: a stopped result after archive is never acknowledged, so a late start runs nothing
ok 31 - a stopped result after archive is never acknowledged, so a late start runs nothing
  ---
  duration_ms: 29.433134
  type: 'test'
  ...
# Subtest: archive tombstones a delayed POST whose response is lost
ok 32 - archive tombstones a delayed POST whose response is lost
  ---
  duration_ms: 36.117957
  type: 'test'
  ...
# Subtest: a partly failed archive saves first and the hub retries the cancel
ok 33 - a partly failed archive saves first and the hub retries the cancel
  ---
  duration_ms: 47.223682
  type: 'test'
  ...
# Subtest: a fresh hub retries pending cancels on init
ok 34 - a fresh hub retries pending cancels on init
  ---
  duration_ms: 53.421132
  type: 'test'
  ...
# Subtest: brief carries one graphs entry per history entry that has a graph, and drops history
ok 35 - brief carries one graphs entry per history entry that has a graph, and drops history
  ---
  duration_ms: 0.30216
  type: 'test'
  ...
# Subtest: done verified validation
ok 36 - done verified validation
  ---
  duration_ms: 2.091402
  type: 'test'
  ...
# Subtest: silent gates and held gates
ok 37 - silent gates and held gates
  ---
  duration_ms: 131.722192
  type: 'test'
  ...
# Subtest: held gate does not add notice when pull request already has a merged card
ok 38 - held gate does not add notice when pull request already has a merged card
  ---
  duration_ms: 15.235136
  type: 'test'
  ...
# Subtest: GitHub outcomes and exact merge arguments
ok 39 - GitHub outcomes and exact merge arguments
  ---
  duration_ms: 1627.987325
  type: 'test'
  ...
# Subtest: dismiss auto-merge card and refuse lead resolution
ok 40 - dismiss auto-merge card and refuse lead resolution
  ---
  duration_ms: 11.068814
  type: 'test'
  ...
# Subtest: result delivery includes commit when supplied
ok 41 - result delivery includes commit when supplied
  ---
  duration_ms: 19.082708
  type: 'test'
  ...
# Subtest: accepting a check triggers auto-merge
ok 42 - accepting a check triggers auto-merge
  ---
  duration_ms: 36.417281
  type: 'test'
  ...
# Subtest: switching off during the readiness wait prevents merge
ok 43 - switching off during the readiness wait prevents merge
  ---
  duration_ms: 71.018769
  type: 'test'
  ...
# Subtest: merge timeout produces unknown and its specific notice
ok 44 - merge timeout produces unknown and its specific notice
  ---
  duration_ms: 330.347166
  type: 'test'
  ...
# Subtest: finishing respects concurrent merged, newer done, and unrelated cards
ok 45 - finishing respects concurrent merged, newer done, and unrelated cards
  ---
  duration_ms: 139.988669
  type: 'test'
  ...
# Subtest: pollMerged closes open auto-merge notices
ok 46 - pollMerged closes open auto-merge notices
  ---
  duration_ms: 18.467518
  type: 'test'
  ...
# Subtest: done acceptance closes notices for older heads and leaves same head open
ok 47 - done acceptance closes notices for older heads and leaves same head open
  ---
  duration_ms: 58.495205
  type: 'test'
  ...
# Subtest: lead resolve through acceptCard refuses auto-merge needs
ok 48 - lead resolve through acceptCard refuses auto-merge needs
  ---
  duration_ms: 13.97008
  type: 'test'
  ...
# Subtest: deleting the branch after a merge follows its setting and only records a failure
ok 49 - deleting the branch after a merge follows its setting and only records a failure
  ---
  duration_ms: 100.09111
  type: 'test'
  ...
# Subtest: branch deletion targets the repository that holds the branch
ok 50 - branch deletion targets the repository that holds the branch
  ---
  duration_ms: 125.497029
  type: 'test'
  ...
# Subtest: target PR check does not merge, notify, or delete its branch
ok 51 - target PR check does not merge, notify, or delete its branch
  ---
  duration_ms: 16.009642
  type: 'test'
  ...
# Subtest: default placement, strict and preferred constraints, and invalid flags
ok 52 - default placement, strict and preferred constraints, and invalid flags
  ---
  duration_ms: 2472.200842
  type: 'test'
  ...
# Subtest: placement ranks accounts and respects provider policy
    # Subtest: soonest
    ok 1 - soonest
      ---
      duration_ms: 352.103892
      type: 'test'
      ...
    # Subtest: spread
    ok 2 - spread
      ---
      duration_ms: 342.354379
      type: 'test'
      ...
    # Subtest: one
    ok 3 - one
      ---
      duration_ms: 384.337267
      type: 'test'
      ...
    # Subtest: three provider placement and constraints
    ok 4 - three provider placement and constraints
      ---
      duration_ms: 1529.313458
      type: 'test'
      ...
    # Subtest: leave, paused and signed out
    ok 5 - leave, paused and signed out
      ---
      duration_ms: 853.734263
      type: 'test'
      ...
    # Subtest: save Claude and pinned leads
    ok 6 - save Claude and pinned leads
      ---
      duration_ms: 562.554196
      type: 'test'
      ...
    # Subtest: lead any and constraint fallback
    ok 7 - lead any and constraint fallback
      ---
      duration_ms: 1578.159969
      type: 'test'
      ...
    # Subtest: lead reserve follows signed-in lead order and margin
    ok 8 - lead reserve follows signed-in lead order and margin
      ---
      duration_ms: 499.535832
      type: 'test'
      ...
    # Subtest: single review family overrides flags and waits or falls back
    ok 9 - single review family overrides flags and waits or falls back
      ---
      duration_ms: 915.020312
      type: 'test'
      ...
    # Subtest: mixed families report the one family when only one is signed in
    ok 10 - mixed families report the one family when only one is signed in
      ---
      duration_ms: 1199.21996
      type: 'test'
      ...
    # Subtest: wait estimate accounts for every exhausted window
    ok 11 - wait estimate accounts for every exhausted window
      ---
      duration_ms: 593.292164
      type: 'test'
      ...
    # Subtest: reviewers and verifiers wait when neither provider has room
    ok 12 - reviewers and verifiers wait when neither provider has room
      ---
      duration_ms: 1391.610162
      type: 'test'
      ...
    # Subtest: margin skips Claude for workers but not leads
    ok 13 - margin skips Claude for workers but not leads
      ---
      duration_ms: 3236.290344
      type: 'test'
      ...
    1..13
ok 53 - placement ranks accounts and respects provider policy
  ---
  duration_ms: 13469.22616
  type: 'test'
  ...
# Subtest: a reading promotes the same waiting worker and keeps its queue
ok 54 - a reading promotes the same waiting worker and keeps its queue
  ---
  duration_ms: 3547.175189
  type: 'test'
  ...
# Subtest: a turn-ended reading promotes the same waiting worker and keeps its token
ok 55 - a turn-ended reading promotes the same waiting worker and keeps its token
  ---
  duration_ms: 3928.615082
  type: 'test'
  ...
# Subtest: limit hold releases with Continue and failed turns notify without a result
ok 56 - limit hold releases with Continue and failed turns notify without a result
  ---
  duration_ms: 4401.527712
  type: 'test'
  ...
# Subtest: promotion failure marks the waiting session failed
ok 57 - promotion failure marks the waiting session failed
  ---
  duration_ms: 4370.561287
  type: 'test'
  ...
# Subtest: waiting sessions survive polling and stop without a machine call
ok 58 - waiting sessions survive polling and stop without a machine call
  ---
  duration_ms: 2356.287927
  type: 'test'
  ...
# Subtest: old threads acquire a provider on first read
ok 59 - old threads acquire a provider on first read
  ---
  duration_ms: 50.016895
  type: 'test'
  ...
# Subtest: unused worker cell refuses a strict provider
ok 60 - unused worker cell refuses a strict provider
  ---
  duration_ms: 2193.693182
  type: 'test'
  ...
# Subtest: preflight retries on the other signed-in GPT account
ok 61 - preflight retries on the other signed-in GPT account
  ---
  duration_ms: 2626.964475
  type: 'test'
  ...
# Subtest: startup promotes a waiting session when room is available
ok 62 - startup promotes a waiting session when room is available
  ---
  duration_ms: 1268.645257
  type: 'test'
  ...
# Subtest: worker placement uses account login on its own machine
ok 63 - worker placement uses account login on its own machine
  ---
  duration_ms: 726.672683
  type: 'test'
  ...
# Subtest: limited verifier reports only after release and continuation
ok 64 - limited verifier reports only after release and continuation
  ---
  duration_ms: 1291.399579
  type: 'test'
  ...
# Subtest: reviewer: live limit-ended delivery
ok 65 - reviewer: live limit-ended delivery
  ---
  duration_ms: 1119.55827
  type: 'test'
  ...
# Subtest: reviewer: late limit-ended delivery
ok 66 - reviewer: late limit-ended delivery
  ---
  duration_ms: 1030.869049
  type: 'test'
  ...
# Subtest: reviewer: spooled retry limit-ended delivery
ok 67 - reviewer: spooled retry limit-ended delivery
  ---
  duration_ms: 1030.771579
  type: 'test'
  ...
# Subtest: reviewer: limit-hit limit-ended delivery
ok 68 - reviewer: limit-hit limit-ended delivery
  ---
  duration_ms: 886.644838
  type: 'test'
  ...
# Subtest: reviewer: control limit-ended delivery
ok 69 - reviewer: control limit-ended delivery
  ---
  duration_ms: 900.379
  type: 'test'
  ...
# Subtest: verifier: live limit-ended delivery
ok 70 - verifier: live limit-ended delivery
  ---
  duration_ms: 983.874673
  type: 'test'
  ...
# Subtest: verifier: late limit-ended delivery
ok 71 - verifier: late limit-ended delivery
  ---
  duration_ms: 827.579931
  type: 'test'
  ...
# Subtest: verifier: spooled retry limit-ended delivery
ok 72 - verifier: spooled retry limit-ended delivery
  ---
  duration_ms: 838.256709
  type: 'test'
  ...
# Subtest: verifier: limit-hit limit-ended delivery
ok 73 - verifier: limit-hit limit-ended delivery
  ---
  duration_ms: 794.034099
  type: 'test'
  ...
# Subtest: verifier: control limit-ended delivery
ok 74 - verifier: control limit-ended delivery
  ---
  duration_ms: 722.662841
  type: 'test'
  ...
# Subtest: worker: live limit-ended delivery
ok 75 - worker: live limit-ended delivery
  ---
  duration_ms: 1213.772467
  type: 'test'
  ...
# Subtest: worker: late limit-ended delivery
ok 76 - worker: late limit-ended delivery
  ---
  duration_ms: 1162.166482
  type: 'test'
  ...
# Subtest: worker: spooled retry limit-ended delivery
ok 77 - worker: spooled retry limit-ended delivery
  ---
  duration_ms: 1256.870309
  type: 'test'
  ...
# Subtest: worker: limit-hit limit-ended delivery
ok 78 - worker: limit-hit limit-ended delivery
  ---
  duration_ms: 1259.617206
  type: 'test'
  ...
# Subtest: worker: control limit-ended delivery
ok 79 - worker: control limit-ended delivery
  ---
  duration_ms: 1245.587129
  type: 'test'
  ...
# Subtest: waiting lead records provider and promoted role layers and style
ok 80 - waiting lead records provider and promoted role layers and style
  ---
  duration_ms: 750.410394
  type: 'test'
  ...
# Subtest: lead and sub-lead use distinct model slots
ok 81 - lead and sub-lead use distinct model slots
  ---
  duration_ms: 0.521821
  type: 'test'
  ...
# Subtest: OpenRouter explicit placement outside order respects review family
ok 82 - OpenRouter explicit placement outside order respects review family
  ---
  duration_ms: 559.77792
  type: 'test'
  ...
# Subtest: renders Antigravity fixture turns, tools, timestamps and report
ok 83 - renders Antigravity fixture turns, tools, timestamps and report
  ---
  duration_ms: 4.968191
  type: 'test'
  ...
# Subtest: renders the single-turn Antigravity fixture
ok 84 - renders the single-turn Antigravity fixture
  ---
  duration_ms: 0.633595
  type: 'test'
  ...
# Subtest: skips unknown Antigravity rows and folds queued tool results in order
ok 85 - skips unknown Antigravity rows and folds queued tool results in order
  ---
  duration_ms: 0.893334
  type: 'test'
  ...
# Subtest: reports unreadable nonempty Antigravity transcripts
ok 86 - reports unreadable nonempty Antigravity transcripts
  ---
  duration_ms: 0.619638
  type: 'test'
  ...
# Subtest: renders a Claude human turn after unwrapping pasted content
ok 87 - renders a Claude human turn after unwrapping pasted content
  ---
  duration_ms: 1.368425
  type: 'test'
  ...
# Subtest: renders a Claude message sent mid-turn as a the user bubble, and skips task notices
ok 88 - renders a Claude message sent mid-turn as a the user bubble, and skips task notices
  ---
  duration_ms: 0.415838
  type: 'test'
  ...
# Subtest: hides a Claude role turn and its reply
ok 89 - hides a Claude role turn and its reply
  ---
  duration_ms: 0.26573
  type: 'test'
  ...
# Subtest: replaces a stub context marker and keeps its lead reply
ok 90 - replaces a stub context marker and keeps its lead reply
  ---
  duration_ms: 0.373987
  type: 'test'
  ...
# Subtest: hides a switch marker with no line of its own and keeps the reply
ok 91 - hides a switch marker with no line of its own and keeps the reply
  ---
  duration_ms: 0.55251
  type: 'test'
  ...
# Subtest: replaces a restart context marker and keeps its lead reply
ok 92 - replaces a restart context marker and keeps its lead reply
  ---
  duration_ms: 0.769917
  type: 'test'
  ...
# Subtest: renders a card press as a short the user bubble
ok 93 - renders a card press as a short the user bubble
  ---
  duration_ms: 0.495841
  type: 'test'
  ...
# Subtest: collapses a Claude tool call to one chat item
ok 94 - collapses a Claude tool call to one chat item
  ---
  duration_ms: 0.36512
  type: 'test'
  ...
# Subtest: ignores Codex injected entries before turn_context
ok 95 - ignores Codex injected entries before turn_context
  ---
  duration_ms: 1.069462
  type: 'test'
  ...
# Subtest: does not let Codex task_started open a human turn before turn_context
ok 96 - does not let Codex task_started open a human turn before turn_context
  ---
  duration_ms: 0.272993
  type: 'test'
  ...
# Subtest: requires a fresh Codex turn_context for each turn
ok 97 - requires a fresh Codex turn_context for each turn
  ---
  duration_ms: 0.416148
  type: 'test'
  ...
# Subtest: collapses a Codex function call to one chat item
ok 98 - collapses a Codex function call to one chat item
  ---
  duration_ms: 0.292822
  type: 'test'
  ...
# Subtest: uses each transcript line timestamp for chat items
ok 99 - uses each transcript line timestamp for chat items
  ---
  duration_ms: 0.298393
  type: 'test'
  ...
# Subtest: a line without a timestamp takes the previous one, and Claude echoes are not repeated
ok 100 - a line without a timestamp takes the previous one, and Claude echoes are not repeated
  ---
  duration_ms: 0.286419
  type: 'test'
  ...
# Subtest: folds a Claude tool result into its call, cut at 2000 characters
ok 101 - folds a Claude tool result into its call, cut at 2000 characters
  ---
  duration_ms: 0.635038
  type: 'test'
  ...
# Subtest: folds a Codex function_call_output into its call
ok 102 - folds a Codex function_call_output into its call
  ---
  duration_ms: 0.355782
  type: 'test'
  ...
# Subtest: GET /threads/:id/graph reads an archived thread graph from its branch, and nothing else
ok 103 - GET /threads/:id/graph reads an archived thread graph from its branch, and nothing else
  ---
  duration_ms: 731.070281
  type: 'test'
  ...
# Subtest: a failed transcript read keeps the last copy for the chat, not for a report
ok 104 - a failed transcript read keeps the last copy for the chat, not for a report
  ---
  duration_ms: 1.269105
  type: 'test'
  ...
# Subtest: stamped chat polls share parsed items and invalidate them when parser context changes
ok 105 - stamped chat polls share parsed items and invalidate them when parser context changes
  ---
  duration_ms: 4.15983
  type: 'test'
  ...
# Subtest: old machines, missing entries, empty replies and failures follow transcript fallback rules
ok 106 - old machines, missing entries, empty replies and failures follow transcript fallback rules
  ---
  duration_ms: 1.144896
  type: 'test'
  ...
# Subtest: idle transcript pruning protects queued and active chat operations
ok 107 - idle transcript pruning protects queued and active chat operations
  ---
  duration_ms: 0.846985
  type: 'test'
  ...
# Subtest: peer_log becomes folded peer items interleaved by time, without message text
ok 108 - peer_log becomes folded peer items interleaved by time, without message text
  ---
  duration_ms: 1.635367
  type: 'test'
  ...
# Subtest: queued leaves out held peer messages for a stopped lead
ok 109 - queued leaves out held peer messages for a stopped lead
  ---
  duration_ms: 1.344489
  type: 'test'
  ...
# Subtest: check schema validates required fields, limits and cross-field rules
ok 110 - check schema validates required fields, limits and cross-field rules
  ---
  duration_ms: 3.552385
  type: 'test'
  ...
# Subtest: hub accepts only a current done head and one check per head
ok 111 - hub accepts only a current done head and one check per head
  ---
  duration_ms: 8.771888
  type: 'test'
  ...
# Subtest: press checks action, broken status, current head, answer and live lead before enqueue
ok 112 - press checks action, broken status, current head, answer and live lead before enqueue
  ---
  duration_ms: 2.920302
  type: 'test'
  ...
# Subtest: handoff preserves a maximum size check history and validates
ok 113 - handoff preserves a maximum size check history and validates
  ---
  duration_ms: 1.780145
  type: 'test'
  ...
# auto-merge: TypeError: hub.withThread is not a function
#     at attempt (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/app/auto-merge.js:22:13)
#     at Object.afterCheck (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/app/auto-merge.js:111:19)
#     at acceptCard (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/app/cards.js:313:65)
#     at async TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/test/app-check-card.test.js:35:3)
#     at async Test.run (node:internal/test_runner/test:1054:7)
#     at async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
# auto-merge: TypeError: hub.withThread is not a function
#     at attempt (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/app/auto-merge.js:22:13)
#     at Object.afterCheck (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/app/auto-merge.js:111:19)
#     at acceptCard (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/app/cards.js:313:65)
#     at async TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/test/app-check-card.test.js:36:140)
#     at async Test.run (node:internal/test_runner/test:1054:7)
#     at async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
# Subtest: designer reopens on starter delivery and owes a result after a status
ok 114 - designer reopens on starter delivery and owes a result after a status
  ---
  duration_ms: 1089.982326
  type: 'test'
  ...
# Subtest: another sender does not reopen a designer
ok 115 - another sender does not reopen a designer
  ---
  duration_ms: 1557.971625
  type: 'test'
  ...
# Subtest: a mapper remains finished after its starter follows up
ok 116 - a mapper remains finished after its starter follows up
  ---
  duration_ms: 1257.639654
  type: 'test'
  ...
# Subtest: GET reports each machine, and POST forwards to all of them
ok 117 - GET reports each machine, and POST forwards to all of them
  ---
  duration_ms: 305.616956
  type: 'test'
  ...
# Subtest: one machine failing gives 502 with the per-machine map; the others keep the level
ok 118 - one machine failing gives 502 with the per-machine map; the others keep the level
  ---
  duration_ms: 175.914909
  type: 'test'
  ...
# Subtest: a machine that does not answer is "did not answer" within the timeout, on GET and POST
ok 119 - a machine that does not answer is "did not answer" within the timeout, on GET and POST
  ---
  duration_ms: 784.762812
  type: 'test'
  ...
# Subtest: a refused connection is "did not answer", and a bad level is 400 without calling machines
ok 120 - a refused connection is "did not answer", and a bad level is 400 without calling machines
  ---
  duration_ms: 252.655857
  type: 'test'
  ...
# Subtest: file card validation and machine relay storage
ok 121 - file card validation and machine relay storage
  ---
  duration_ms: 649.51059
  type: 'test'
  ...
# Subtest: live documents share listing and route eligibility
ok 122 - live documents share listing and route eligibility
  ---
  duration_ms: 629.517615
  type: 'test'
  ...
# Subtest: archived documents list is cached without a worktree and route reads the branch
ok 123 - archived documents list is cached without a worktree and route reads the branch
  ---
  duration_ms: 698.210441
  type: 'test'
  ...
# Subtest: archived listing follows branch tip and excludes oversized blobs
ok 124 - archived listing follows branch tip and excludes oversized blobs
  ---
  duration_ms: 186.693756
  type: 'test'
  ...
# Subtest: ZIP serves live and archived eligible documents and 404 for an empty plan
ok 125 - ZIP serves live and archived eligible documents and 404 for an empty plan
  ---
  duration_ms: 893.89867
  type: 'test'
  ...
# Subtest: merge state and identity decisions
ok 126 - merge state and identity decisions
  ---
  duration_ms: 2.642339
  type: 'test'
  ...
# Subtest: hub accepts a matching merged PR
ok 127 - hub accepts a matching merged PR
  ---
  duration_ms: 42.705835
  type: 'test'
  ...
# Subtest: invalid schema and URL skip gh, and refusal never writes the thread
ok 128 - invalid schema and URL skip gh, and refusal never writes the thread
  ---
  duration_ms: 10.523758
  type: 'test'
  ...
# Subtest: gh failures and authentication refusals
ok 129 - gh failures and authentication refusals
  ---
  duration_ms: 35.454665
  type: 'test'
  ...
# Subtest: slow gh does not hold the thread lock
ok 130 - slow gh does not hold the thread lock
  ---
  duration_ms: 3031.729319
  type: 'test'
  ...
# Subtest: target PR uses its head branch only for the exact URL
ok 131 - target PR uses its head branch only for the exact URL
  ---
  duration_ms: 0.411329
  type: 'test'
  ...
# Subtest: a session started while the poll waits for the thread lock is not reported ended
ok 132 - a session started while the poll waits for the thread lock is not reported ended
  ---
  duration_ms: 1795.095359
  type: 'test'
  ...
# Subtest: a session the machine could not check stays live; one gone from tmux ends
ok 133 - a session the machine could not check stays live; one gone from tmux ends
  ---
  duration_ms: 2033.86764
  type: 'test'
  ...
# Subtest: --replaces is refused while the old worker still runs in tmux
ok 134 - --replaces is refused while the old worker still runs in tmux
  ---
  duration_ms: 2661.626059
  type: 'test'
  ...
# Subtest: answers without waiting on a thread that is busy
ok 135 - answers without waiting on a thread that is busy
  ---
  duration_ms: 17.025381
  type: 'test'
  ...
# Subtest: saves a changed status under the lock, on a fresh read
ok 136 - saves a changed status under the lock, on a fresh read
  ---
  duration_ms: 6.271652
  type: 'test'
  ...
# Subtest: records a status from a fresh read under the lock
ok 137 - records a status from a fresh read under the lock
  ---
  duration_ms: 10.765012
  type: 'test'
  ...
# Subtest: validates input before inspecting and reports invalid JSON
ok 138 - validates input before inspecting and reports invalid JSON
  ---
  duration_ms: 3.504583
  type: 'test'
  ...
# Subtest: opens an existing thread on its own machine and project
ok 139 - opens an existing thread on its own machine and project
  ---
  duration_ms: 1.864457
  type: 'test'
  ...
# Subtest: rejects a mismatched repository and missing branch
ok 140 - rejects a mismatched repository and missing branch
  ---
  duration_ms: 0.783994
  type: 'test'
  ...
# Subtest: saved undo opens without inspecting or running it
ok 141 - saved undo opens without inspecting or running it
  ---
  duration_ms: 0.626021
  type: 'test'
  ...
# Subtest: checks the file stage at the exported head
ok 142 - checks the file stage at the exported head
  ---
  duration_ms: 0.735441
  type: 'test'
  ...
# Subtest: opens older and diverged files without changing the thread
ok 143 - opens older and diverged files without changing the thread
  ---
  duration_ms: 0.799775
  type: 'test'
  ...
# Subtest: refuses advancing a busy thread
ok 144 - refuses advancing a busy thread
  ---
  duration_ms: 0.596064
  type: 'test'
  ...
# Subtest: refuses an advanced remote tip
ok 145 - refuses an advanced remote tip
  ---
  duration_ms: 0.722476
  type: 'test'
  ...
# Subtest: Create claims in order, persists history, and restarts outside the lock
ok 146 - Create claims in order, persists history, and restarts outside the lock
  ---
  duration_ms: 72.511243
  type: 'test'
  ...
# Subtest: imports of one ID serialize into Create then Open
ok 147 - imports of one ID serialize into Create then Open
  ---
  duration_ms: 20.83551
  type: 'test'
  ...
# Subtest: Create refuses occupied machine, checked out and divergent branches
ok 148 - Create refuses occupied machine, checked out and divergent branches
  ---
  duration_ms: 53.418847
  type: 'test'
  ...
# Subtest: moved claim abandons the Create record
ok 149 - moved claim abandons the Create record
  ---
  duration_ms: 14.139355
  type: 'test'
  ...
# Subtest: saved Create and Advance validate first and resume without the route inspection
ok 150 - saved Create and Advance validate first and resume without the route inspection
  ---
  duration_ms: 29.53042
  type: 'test'
  ...
# Subtest: raw route rejects oversized bodies before invoking import
ok 151 - raw route rejects oversized bodies before invoking import
  ---
  duration_ms: 3.069879
  type: 'test'
  ...
# Subtest: invalid file shapes fail before any machine handoff call
ok 152 - invalid file shapes fail before any machine handoff call
  ---
  duration_ms: 59.934136
  type: 'test'
  ...
# Subtest: repository and branch failures precede creating a record
ok 153 - repository and branch failures precede creating a record
  ---
  duration_ms: 39.608103
  type: 'test'
  ...
# Subtest: Advance reopens retained and absent worktrees and retracts prior cards
ok 154 - Advance reopens retained and absent worktrees and retracts prior cards
  ---
  duration_ms: 25.841463
  type: 'test'
  ...
# Subtest: busy Advance preserves imported state, cards and pins; ended worker queue does not block
ok 155 - busy Advance preserves imported state, cards and pins; ended worker queue does not block
  ---
  duration_ms: 47.121145
  type: 'test'
  ...
# Subtest: own cancelled tip schedules revoke after releasing the lock and Open shows waiting note
ok 156 - own cancelled tip schedules revoke after releasing the lock and Open shows waiting note
  ---
  duration_ms: 26.049843
  type: 'test'
  ...
# Subtest: handed-off thread with unchanged tip offers Undo and passes retained checkout and fallback
ok 157 - handed-off thread with unchanged tip offers Undo and passes retained checkout and fallback
  ---
  duration_ms: 15.588364
  type: 'test'
  ...
# Subtest: dirty Advance refuses before claim and preserves prior imported content
ok 158 - dirty Advance refuses before claim and preserves prior imported content
  ---
  duration_ms: 12.612065
  type: 'test'
  ...
# Subtest: HTTP import returns 413 for an oversized file without recording a thread
ok 159 - HTTP import returns 413 for an oversized file without recording a thread
  ---
  duration_ms: 246.122803
  type: 'test'
  ...
# Subtest: invalid picker project returns the createThread sentence
ok 160 - invalid picker project returns the createThread sentence
  ---
  duration_ms: 9.47176
  type: 'test'
  ...
# Subtest: Advance stops an idle live lead before restarting
ok 161 - Advance stops an idle live lead before restarting
  ---
  duration_ms: 31.685544
  type: 'test'
  ...
# Subtest: Create starts a real imported lead with import context
ok 162 - Create starts a real imported lead with import context
  ---
  duration_ms: 646.504602
  type: 'test'
  ...
# Subtest: same-head archived thread opens unchanged and null relation explains missing checkout
ok 163 - same-head archived thread opens unchanged and null relation explains missing checkout
  ---
  duration_ms: 44.08978
  type: 'test'
  ...
# Subtest: Undo hint compares the remote tip to the handed-off head
ok 164 - Undo hint compares the remote tip to the handed-off head
  ---
  duration_ms: 0.679513
  type: 'test'
  ...
# Subtest: repository and containment errors use the specified status and sentence
ok 165 - repository and containment errors use the specified status and sentence
  ---
  duration_ms: 43.520498
  type: 'test'
  ...
# Subtest: imports both history versions and retries interrupted old history before export
ok 166 - imports both history versions and retries interrupted old history before export
  ---
  duration_ms: 106.336182
  type: 'test'
  ...
# Subtest: v3 imports valid lessons into target scope and ignores malformed entries; v2 imports none
ok 167 - v3 imports valid lessons into target scope and ignores malformed entries; v2 imports none
  ---
  duration_ms: 104.006061
  type: 'test'
  ...
# Subtest: opened and pending operation imports do not merge uploaded lessons
ok 168 - opened and pending operation imports do not merge uploaded lessons
  ---
  duration_ms: 102.607579
  type: 'test'
  ...
# Subtest: Retry of a pending operation does not merge lessons
ok 169 - Retry of a pending operation does not merge lessons
  ---
  duration_ms: 44.414994
  type: 'test'
  ...
# Subtest: Advance merges lessons into the existing thread project
ok 170 - Advance merges lessons into the existing thread project
  ---
  duration_ms: 56.455833
  type: 'test'
  ...
# Subtest: exported project lessons are scoped to the destination project
ok 171 - exported project lessons are scoped to the destination project
  ---
  duration_ms: 45.123673
  type: 'test'
  ...
# Subtest: startCreate and startAdvance do not merge file lessons
ok 172 - startCreate and startAdvance do not merge file lessons
  ---
  duration_ms: 69.369456
  type: 'test'
  ...
# Subtest: claim persists the commit before pushing and retries the same commit
ok 173 - claim persists the commit before pushing and retries the same commit
  ---
  duration_ms: 3.797465
  type: 'test'
  ...
# Subtest: preclaim refuses unsafe local branches and worktrees
ok 174 - preclaim refuses unsafe local branches and worktrees
  ---
  duration_ms: 1.343588
  type: 'test'
  ...
# Subtest: operation applies carried state after reopening, and restarts after completion
ok 175 - operation applies carried state after reopening, and restarts after completion
  ---
  duration_ms: 75.378554
  type: 'test'
  ...
# Subtest: failed reopen preserves operation and retry uses the original imported cutoff
ok 176 - failed reopen preserves operation and retry uses the original imported cutoff
  ---
  duration_ms: 17.128409
  type: 'test'
  ...
# Subtest: cancelled claim is retained after revoke and dismissed only after failure
ok 177 - cancelled claim is retained after revoke and dismissed only after failure
  ---
  duration_ms: 27.377019
  type: 'test'
  ...
# Subtest: each kind retries failed steps without creating a second claim
ok 178 - each kind retries failed steps without creating a second claim
  ---
  duration_ms: 204.87195
  type: 'test'
  ...
# Subtest: own cancelled claim schedules a revoke after releasing the thread lock
ok 179 - own cancelled claim schedules a revoke after releasing the thread lock
  ---
  duration_ms: 22.014322
  type: 'test'
  ...
# Subtest: revocation writes for different threads are serialized and an operation wins
ok 180 - revocation writes for different threads are serialized and an operation wins
  ---
  duration_ms: 19.994026
  type: 'test'
  ...
# Subtest: stop accepts an unknown managed session and refuses surviving tmux sessions
ok 181 - stop accepts an unknown managed session and refuses surviving tmux sessions
  ---
  duration_ms: 21.009564
  type: 'test'
  ...
# Subtest: undo and cancel routes enforce saved operation and frozen archive
ok 182 - undo and cancel routes enforce saved operation and frozen archive
  ---
  duration_ms: 315.991577
  type: 'test'
  ...
# Subtest: lost push response saves the claim and retries without another commit
ok 183 - lost push response saves the claim and retries without another commit
  ---
  duration_ms: 59.862919
  type: 'test'
  ...
# Subtest: moved claim abandons each kind and uses re-import wording
ok 184 - moved claim abandons each kind and uses re-import wording
  ---
  duration_ms: 43.536308
  type: 'test'
  ...
# Subtest: checkout failure is saved and reopen is called on open threads
ok 185 - checkout failure is saved and reopen is called on open threads
  ---
  duration_ms: 20.331132
  type: 'test'
  ...
# Subtest: revoke expiry, machine exceptions, repeated revocation, and dismissal
ok 186 - revoke expiry, machine exceptions, repeated revocation, and dismissal
  ---
  duration_ms: 42.735332
  type: 'test'
  ...
# Subtest: faults at every operation step converge to the uninterrupted record
ok 187 - faults at every operation step converge to the uninterrupted record
  ---
  duration_ms: 660.723508
  type: 'test'
  ...
# Subtest: undo retry and cancellation routes report moved claims and enforce claim boundary
ok 188 - undo retry and cancellation routes report moved claims and enforce claim boundary
  ---
  duration_ms: 1484.713917
  type: 'test'
  ...
# Subtest: failed revoke notice uses repository and survives handoff file sweep
ok 189 - failed revoke notice uses repository and survives handoff file sweep
  ---
  duration_ms: 293.804432
  type: 'test'
  ...
# Subtest: first preclaim refusals do not save operations; retry retains its error
ok 190 - first preclaim refusals do not save operations; retry retains its error
  ---
  duration_ms: 24.955383
  type: 'test'
  ...
# Subtest: first Undo saves inspect repository before its claim
ok 191 - first Undo saves inspect repository before its claim
  ---
  duration_ms: 44.4285
  type: 'test'
  ...
# Subtest: imported PR ignores older done cards and falls back to carried PR
ok 192 - imported PR ignores older done cards and falls back to carried PR
  ---
  duration_ms: 1.603917
  type: 'test'
  ...
# Subtest: startup repairs only partial imported lead starts and registers plans
ok 193 - startup repairs only partial imported lead starts and registers plans
  ---
  duration_ms: 112.727793
  type: 'test'
  ...
# Subtest: import restart saves context before launch, moves queues, and uses checkout SHA
ok 194 - import restart saves context before launch, moves queues, and uses checkout SHA
  ---
  duration_ms: 918.43307
  type: 'test'
  ...
# Subtest: import restart normalizes old owner tags in context and saved state
ok 195 - import restart normalizes old owner tags in context and saved state
  ---
  duration_ms: 1056.646572
  type: 'test'
  ...
# Subtest: surviving orphan refuses restart without losing its queue
ok 196 - surviving orphan refuses restart without losing its queue
  ---
  duration_ms: 613.314358
  type: 'test'
  ...
# Subtest: ordinary restart with checkout SHA sends it to the machine
ok 197 - ordinary restart with checkout SHA sends it to the machine
  ---
  duration_ms: 1157.711486
  type: 'test'
  ...
# Subtest: import context marker is presented in chat
ok 198 - import context marker is presented in chat
  ---
  duration_ms: 1.911136
  type: 'test'
  ...
# Subtest: merge watcher uses the imported PR over an old done card
ok 199 - merge watcher uses the imported PR over an old done card
  ---
  duration_ms: 18.893895
  type: 'test'
  ...
# Could not register plan: Error: registration failed
#     at Hub.registerPlan (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/test/app-handoff-restart.test.js:151:78)
#     at Hub.init (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/app/hub.js:76:26)
#     at async TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/test/app-handoff-restart.test.js:159:3)
#     at async Test.run (node:internal/test_runner/test:1054:7)
#     at async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
# Could not register plan: Error: registration failed
#     at Hub.registerPlan (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/test/app-handoff-restart.test.js:151:78)
#     at startSession (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/app/sessions.js:447:21)
#     at async Object.restartLead (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/app/threads.js:181:18)
# Could not register plan: Error: registration failed
#     at Hub.registerPlan (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/test/app-handoff-restart.test.js:151:78)
#     at startSession (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/app/sessions.js:447:21)
#     at async Object.restartLead (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/app/threads.js:181:18)
# Subtest: partial imported start is repaired, killed, and restarted twice with the right context
ok 200 - partial imported start is repaired, killed, and restarted twice with the right context
  ---
  duration_ms: 1411.745047
  type: 'test'
  ...
# Subtest: imported Claude lead receives context immediately on start
ok 201 - imported Claude lead receives context immediately on start
  ---
  duration_ms: 1031.978747
  type: 'test'
  ...
# Subtest: imported waiting lead retries with checkout SHA and delivers context
ok 202 - imported waiting lead retries with checkout SHA and delivers context
  ---
  duration_ms: 987.486583
  type: 'test'
  ...
# Subtest: failed pending start retains non-context queue for the next restart and failed inspect is tolerated
ok 203 - failed pending start retains non-context queue for the next restart and failed inspect is tolerated
  ---
  duration_ms: 1310.555297
  type: 'test'
  ...
# Subtest: ordinary chat and merge watcher retain their different done-card rules
ok 204 - ordinary chat and merge watcher retain their different done-card rules
  ---
  duration_ms: 1087.258393
  type: 'test'
  ...
# Subtest: held peer messages follow context in normal and imported restart
ok 205 - held peer messages follow context in normal and imported restart
  ---
  duration_ms: 4553.119232
  type: 'test'
  ...
# Subtest: held peer queues do not make export busy and archive drops them
ok 206 - held peer queues do not make export busy and archive drops them
  ---
  duration_ms: 1279.018272
  type: 'test'
  ...
# Subtest: archive drops held peer entries from a live lead but keeps ordinary entries
ok 207 - archive drops held peer entries from a live lead but keeps ordinary entries
  ---
  duration_ms: 1009.349246
  type: 'test'
  ...
# Subtest: handoff validator checks schema, limits and unknown fields
ok 208 - handoff validator checks schema, limits and unknown fields
  ---
  duration_ms: 13.872151
  type: 'test'
  ...
# Subtest: history renders shown cards and skips hidden and progress cards
ok 209 - history renders shown cards and skips hidden and progress cards
  ---
  duration_ms: 1.227385
  type: 'test'
  ...
# Subtest: history accumulates, orders and trims entries, and names downloads
ok 210 - history accumulates, orders and trims entries, and names downloads
  ---
  duration_ms: 357.019816
  type: 'test'
  ...
# Subtest: machine client sends scripted handoff actions and times out
ok 211 - machine client sends scripted handoff actions and times out
  ---
  duration_ms: 82.544931
  type: 'test'
  ...
# Subtest: export reasons follow their order and committed stopping points
ok 212 - export reasons follow their order and committed stopping points
  ---
  duration_ms: 2.123814
  type: 'test'
  ...
# Subtest: frozen threads refuse mutation entry points and never deliver queued work
ok 213 - frozen threads refuse mutation entry points and never deliver queued work
  ---
  duration_ms: 797.523121
  type: 'test'
  ...
# Subtest: exports each stopping point, validates before pushing and freezes the thread
ok 214 - exports each stopping point, validates before pushing and freezes the thread
  ---
  duration_ms: 45.424441
  type: 'test'
  ...
# Subtest: push and save failures preserve retryability; a saved handoff survives lost save reply
ok 215 - push and save failures preserve retryability; a saved handoff survives lost save reply
  ---
  duration_ms: 30.495452
  type: 'test'
  ...
# Subtest: export route returns a downloadable JSON file
ok 216 - export route returns a downloadable JSON file
  ---
  duration_ms: 678.567669
  type: 'test'
  ...
# Subtest: export route reports a failed PR check without pushing
ok 217 - export route reports a failed PR check without pushing
  ---
  duration_ms: 552.292907
  type: 'test'
  ...
# Subtest: banner reports remote states and caches inspection
ok 218 - banner reports remote states and caches inspection
  ---
  duration_ms: 32.6581
  type: 'test'
  ...
# Subtest: download recovery selects matching head, and startup sweeps stray files
ok 219 - download recovery selects matching head, and startup sweeps stray files
  ---
  duration_ms: 48.00471
  type: 'test'
  ...
# Subtest: download waits for export to finish its rename
ok 220 - download waits for export to finish its rename
  ---
  duration_ms: 7.604909
  type: 'test'
  ...
# Subtest: an admitted upload blocks export until its stream completes
ok 221 - an admitted upload blocks export until its stream completes
  ---
  duration_ms: 649.582292
  type: 'test'
  ...
# Subtest: page status refresh is background, cached, skips archived and handed-off threads and retains prior results
ok 222 - page status refresh is background, cached, skips archived and handed-off threads and retains prior results
  ---
  duration_ms: 54.221967
  type: 'test'
  ...
# Subtest: export cancels asides found after the quiet check
ok 223 - export cancels asides found after the quiet check
  ---
  duration_ms: 23.738479
  type: 'test'
  ...
# Subtest: handoff banner HTTP route reports each state and the thread list marks handoff
ok 224 - handoff banner HTTP route reports each state and the thread list marks handoff
  ---
  duration_ms: 824.733634
  type: 'test'
  ...
# Subtest: validator rejects each malformed scalar and history limit
ok 225 - validator rejects each malformed scalar and history limit
  ---
  duration_ms: 8.448347
  type: 'test'
  ...
# Subtest: export uses session stop lifecycle and preserves recovery on rename failure
ok 226 - export uses session stop lifecycle and preserves recovery on rename failure
  ---
  duration_ms: 43.20354
  type: 'test'
  ...
# Subtest: slow banner inspection does not hold the thread lock
ok 227 - slow banner inspection does not hold the thread lock
  ---
  duration_ms: 35.870292
  type: 'test'
  ...
# Subtest: idea answers, retractions, imported anchor, approvals and sudo waiting set export eligibility
ok 228 - idea answers, retractions, imported anchor, approvals and sudo waiting set export eligibility
  ---
  duration_ms: 0.697348
  type: 'test'
  ...
# Subtest: done export supplies its PR URL and rejects a non-open PR
ok 229 - done export supplies its PR URL and rejects a non-open PR
  ---
  duration_ms: 6.934273
  type: 'test'
  ...
# Subtest: chat holds the thread lock through assembly while status refresh remains outside
ok 230 - chat holds the thread lock through assembly while status refresh remains outside
  ---
  duration_ms: 13.914534
  type: 'test'
  ...
# Subtest: handoff versions translate v1 and enforce their history labels
ok 231 - handoff versions translate v1 and enforce their history labels
  ---
  duration_ms: 0.967465
  type: 'test'
  ...
# Subtest: v3 exports only this thread’s lessons in transferable scope
ok 232 - v3 exports only this thread’s lessons in transferable scope
  ---
  duration_ms: 0.67809
  type: 'test'
  ...
# Subtest: export download includes exactly the saved lessons for the thread
ok 233 - export download includes exactly the saved lessons for the thread
  ---
  duration_ms: 23.710816
  type: 'test'
  ...
# Subtest: harness settings normalize and preserve fresh onboarding
ok 234 - harness settings normalize and preserve fresh onboarding
  ---
  duration_ms: 5.975544
  type: 'test'
  ...
# Subtest: switches, lead guard, waiting reason and harness status
ok 235 - switches, lead guard, waiting reason and harness status
  ---
  duration_ms: 1338.270031
  type: 'test'
  ...
# Subtest: cached status, placement and onboarding follow the installed CLI and enabled orders
ok 236 - cached status, placement and onboarding follow the installed CLI and enabled orders
  ---
  duration_ms: 4976.025852
  type: 'test'
  ...
# Subtest: install routes preserve machine responses and report unreachable machines
ok 237 - install routes preserve machine responses and report unreachable machines
  ---
  duration_ms: 3.477051
  type: 'test'
  ...
# Subtest: GET settings describes the harness switches
ok 238 - GET settings describes the harness switches
  ---
  duration_ms: 310.46
  type: 'test'
  ...
# Subtest: switch and balancing writes guard the expanded lead order with the exact message
ok 239 - switch and balancing writes guard the expanded lead order with the exact message
  ---
  duration_ms: 498.65809
  type: 'test'
  ...
# Subtest: new leads and all ordered worker roles skip switched-off harnesses
ok 240 - new leads and all ordered worker roles skip switched-off harnesses
  ---
  duration_ms: 674.445009
  type: 'test'
  ...
# Subtest: a switched-off review family uses the existing fallback
ok 241 - a switched-off review family uses the existing fallback
  ---
  duration_ms: 144.193172
  type: 'test'
  ...
# Subtest: ready and pinned leads report the left-out harness; unpinned waits name an enabled one
ok 242 - ready and pinned leads report the left-out harness; unpinned waits name an enabled one
  ---
  duration_ms: 220.244435
  type: 'test'
  ...
# Subtest: status shape counts live threads, ignores paused and retired logins, and marks old recipes unknown
ok 243 - status shape counts live threads, ignores paused and retired logins, and marks old recipes unknown
  ---
  duration_ms: 642.897448
  type: 'test'
  ...
# Subtest: fresh harness status fetch clears cached machine status
ok 244 - fresh harness status fetch clears cached machine status
  ---
  duration_ms: 3117.145548
  type: 'test'
  ...
# Subtest: can_start reports orders, room, version, connectivity and the resolved hub hostname
ok 245 - can_start reports orders, room, version, connectivity and the resolved hub hostname
  ---
  duration_ms: 5631.782602
  type: 'test'
  ...
# Subtest: onboarding requires installation and sign-in on the same machine, saves completion, and short-circuits
ok 246 - onboarding requires installation and sign-in on the same machine, saves completion, and short-circuits
  ---
  duration_ms: 6707.741085
  type: 'test'
  ...
# Subtest: missing executable prevents placement and ranking identifies switched-off providers
ok 247 - missing executable prevents placement and ranking identifies switched-off providers
  ---
  duration_ms: 421.392937
  type: 'test'
  ...
# Subtest: lead reservation skips a switched-off provider
ok 248 - lead reservation skips a switched-off provider
  ---
  duration_ms: 0.4377
  type: 'test'
  ...
# Subtest: a live lead aside fork and an unanswered start retry survive switching off
ok 249 - a live lead aside fork and an unanswered start retry survive switching off
  ---
  duration_ms: 2493.758223
  type: 'test'
  ...
# Subtest: wc session start prints the left-out waiting reason
ok 250 - wc session start prints the left-out waiting reason
  ---
  duration_ms: 131.028059
  type: 'test'
  ...
# Subtest: install forwarders retain every machine status and response body
ok 251 - install forwarders retain every machine status and response body
  ---
  duration_ms: 4.720196
  type: 'test'
  ...
# Subtest: install passthrough accepts DELETE and refuses POST while the harness is switched off
ok 252 - install passthrough accepts DELETE and refuses POST while the harness is switched off
  ---
  duration_ms: 8.515004
  type: 'test'
  ...
# Subtest: switching a harness off cancels its install on every known machine, without waiting
ok 253 - switching a harness off cancels its install on every known machine, without waiting
  ---
  duration_ms: 2128.290052
  type: 'test'
  ...
# Subtest: accepts a valid card for its own lead
ok 254 - accepts a valid card for its own lead
  ---
  duration_ms: 702.562951
  type: 'test'
  ...
# Subtest: validates progress stages and their counts
ok 255 - validates progress stages and their counts
  ---
  duration_ms: 6.70846
  type: 'test'
  ...
# Subtest: verify progress replaces build progress in the pin
ok 256 - verify progress replaces build progress in the pin
  ---
  duration_ms: 671.909386
  type: 'test'
  ...
# Subtest: stores an ISO timestamp on every card
ok 257 - stores an ISO timestamp on every card
  ---
  duration_ms: 682.136664
  type: 'test'
  ...
# Subtest: keeps initialized hub state on disk across a new Hub instance
ok 258 - keeps initialized hub state on disk across a new Hub instance
  ---
  duration_ms: 648.428429
  type: 'test'
  ...
# Subtest: uses the card CLI validator for a locally valid card
ok 259 - uses the card CLI validator for a locally valid card
  ---
  duration_ms: 0.344461
  type: 'test'
  ...
# Subtest: derives an opening title and lets only the lead rename it with title cards
ok 260 - derives an opening title and lets only the lead rename it with title cards
  ---
  duration_ms: 1983.733004
  type: 'test'
  ...
# Subtest: validates the optional question document name
ok 261 - validates the optional question document name
  ---
  duration_ms: 0.630369
  type: 'test'
  ...
# Subtest: refuses a card with an unknown field
ok 262 - refuses a card with an unknown field
  ---
  duration_ms: 667.871683
  type: 'test'
  ...
# Subtest: refuses a card a role may not emit
ok 263 - refuses a card a role may not emit
  ---
  duration_ms: 555.100737
  type: 'test'
  ...
# Subtest: refuses a card envelope with a session from another thread
ok 264 - refuses a card envelope with a session from another thread
  ---
  duration_ms: 934.764994
  type: 'test'
  ...
# Subtest: replaces a thread singleton card
ok 265 - replaces a thread singleton card
  ---
  duration_ms: 557.763172
  type: 'test'
  ...
# Subtest: refuses a second press on an answered question or offer and queues only the first
ok 266 - refuses a second press on an answered question or offer and queues only the first
  ---
  duration_ms: 583.803566
  type: 'test'
  ...
# Subtest: records a press and lets a lead resolve an open question only in its thread
ok 267 - records a press and lets a lead resolve an open question only in its thread
  ---
  duration_ms: 1879.998456
  type: 'test'
  ...
# Subtest: limits offers to a second request after keep talking first
ok 268 - limits offers to a second request after keep talking first
  ---
  duration_ms: 2482.824095
  type: 'test'
  ...
# Subtest: routes a session message to the named target queue
ok 269 - routes a session message to the named target queue
  ---
  duration_ms: 1992.394835
  type: 'test'
  ...
# Subtest: marks a result task finished and relays it to its starter
ok 270 - marks a result task finished and relays it to its starter
  ---
  duration_ms: 1891.458266
  type: 'test'
  ...
# Subtest: holds a queued message until both readiness and a turn end
ok 271 - holds a queued message until both readiness and a turn end
  ---
  duration_ms: 988.785946
  type: 'test'
  ...
# Subtest: stamps when the user last wrote in a thread, and only for their messages
ok 272 - stamps when the user last wrote in a thread, and only for their messages
  ---
  duration_ms: 1205.052881
  type: 'test'
  ...
# Subtest: stamps when the user answers a card, so the thread moves up the list
ok 273 - stamps when the user answers a card, so the thread moves up the list
  ---
  duration_ms: 1354.608931
  type: 'test'
  ...
# Subtest: posts a permission need and holds the session queue while the prompt is open
ok 274 - posts a permission need and holds the session queue while the prompt is open
  ---
  duration_ms: 1491.542506
  type: 'test'
  ...
# Subtest: a turn ending after a permission prompt clears the hold and the card
ok 275 - a turn ending after a permission prompt clears the hold and the card
  ---
  duration_ms: 1086.167579
  type: 'test'
  ...
# Subtest: closes a permission need and resumes the queue
ok 276 - closes a permission need and resumes the queue
  ---
  duration_ms: 1232.623302
  type: 'test'
  ...
# Subtest: posts and clears a stuck-session need
ok 277 - posts and clears a stuck-session need
  ---
  duration_ms: 1174.205805
  type: 'test'
  ...
# Subtest: allows a lead to start only its permitted roles
ok 278 - allows a lead to start only its permitted roles
  ---
  duration_ms: 1971.354585
  type: 'test'
  ...
# Subtest: refuses a second live sub-lead
ok 279 - refuses a second live sub-lead
  ---
  duration_ms: 1479.931946
  type: 'test'
  ...
# Subtest: deduplicates a live start attempt
ok 280 - deduplicates a live start attempt
  ---
  duration_ms: 2010.782009
  type: 'test'
  ...
# Subtest: two starts fired at once with one attempt id start one session
ok 281 - two starts fired at once with one attempt id start one session
  ---
  duration_ms: 1709.963276
  type: 'test'
  ...
# Subtest: a start the machine never answered is asked again by name, and a retry returns it
ok 282 - a start the machine never answered is asked again by name, and a retry returns it
  ---
  duration_ms: 1636.358724
  type: 'test'
  ...
# Subtest: a start unanswered twice answers 503, and the retry finds the same session
ok 283 - a start unanswered twice answers 503, and the retry finds the same session
  ---
  duration_ms: 1672.897367
  type: 'test'
  ...
# Subtest: allows a lead to stop a session it started
ok 284 - allows a lead to stop a session it started
  ---
  duration_ms: 1468.49888
  type: 'test'
  ...
# Subtest: starts a replacement lead after the old lead ends
ok 285 - starts a replacement lead after the old lead ends
  ---
  duration_ms: 1115.16642
  type: 'test'
  ...
# Subtest: a fresh Claude lead with no first message takes its queue without a turn-ended event
ok 286 - a fresh Claude lead with no first message takes its queue without a turn-ended event
  ---
  duration_ms: 560.958785
  type: 'test'
  ...
# Subtest: puts restart context ahead of transferred queued messages
ok 287 - puts restart context ahead of transferred queued messages
  ---
  duration_ms: 931.179161
  type: 'test'
  ...
# Subtest: reports a dead worker to its starter
ok 288 - reports a dead worker to its starter
  ---
  duration_ms: 948.324097
  type: 'test'
  ...
# Subtest: raises Sessions ended when the lead dies
ok 289 - raises Sessions ended when the lead dies
  ---
  duration_ms: 516.807537
  type: 'test'
  ...
# Subtest: creates an unstarted stub and opens it after a role turn ends
ok 290 - creates an unstarted stub and opens it after a role turn ends
  ---
  duration_ms: 1031.909792
  type: 'test'
  ...
# Subtest: stub lead follows lead order instead of inheriting its parent provider
ok 291 - stub lead follows lead order instead of inheriting its parent provider
  ---
  duration_ms: 1003.214783
  type: 'test'
  ...
# Subtest: waits for a dependent stub until the parent merges
ok 292 - waits for a dependent stub until the parent merges
  ---
  duration_ms: 547.607897
  type: 'test'
  ...
# Subtest: opens a waiting stub after the 10-minute check finds its parent merged
ok 293 - opens a waiting stub after the 10-minute check finds its parent merged
  ---
  duration_ms: 778.492208
  type: 'test'
  ...
# Subtest: rechecks an approval in place and gates Start building on the fresh result
ok 294 - rechecks an approval in place and gates Start building on the fresh result
  ---
  duration_ms: 465.475616
  type: 'test'
  ...
# Subtest: asks the machine service to archive the thread
ok 295 - asks the machine service to archive the thread
  ---
  duration_ms: 451.313538
  type: 'test'
  ...
# Subtest: queues a card press as a lead message
ok 296 - queues a card press as a lead message
  ---
  duration_ms: 401.526775
  type: 'test'
  ...
# Subtest: reads archived MAP.md with git show from the thread branch
ok 297 - reads archived MAP.md with git show from the thread branch
  ---
  duration_ms: 401.538397
  type: 'test'
  ...
# Subtest: reads archived IDEA.md with git show from the thread branch
ok 298 - reads archived IDEA.md with git show from the thread branch
  ---
  duration_ms: 454.222928
  type: 'test'
  ...
# Subtest: reads archived PLAN.md with git show from the thread branch
ok 299 - reads archived PLAN.md with git show from the thread branch
  ---
  duration_ms: 426.562828
  type: 'test'
  ...
# Subtest: refuses archived documents outside MAP, IDEA and PLAN
ok 300 - refuses archived documents outside MAP, IDEA and PLAN
  ---
  duration_ms: 436.79177
  type: 'test'
  ...
# Subtest: finds a worktree plan slug on thread and chat routes
ok 301 - finds a worktree plan slug on thread and chat routes
  ---
  duration_ms: 473.33622
  type: 'test'
  ...
# Subtest: groups features by the current plan status and lists open needs
ok 302 - groups features by the current plan status and lists open needs
  ---
  duration_ms: 364.869946
  type: 'test'
  ...
# Subtest: returns every machine session and persists its last-seen time
ok 303 - returns every machine session and persists its last-seen time
  ---
  duration_ms: 369.870898
  type: 'test'
  ...
# Subtest: throttles persisted last-seen times and retries a failed write
ok 304 - throttles persisted last-seen times and retries a failed write
  ---
  duration_ms: 1.297889
  type: 'test'
  ...
# Subtest: proxies pane reads and raw terminal keys through the machine service
ok 305 - proxies pane reads and raw terminal keys through the machine service
  ---
  duration_ms: 394.199125
  type: 'test'
  ...
# Subtest: reads an unrecorded service pane but refuses its keys
ok 306 - reads an unrecorded service pane but refuses its keys
  ---
  duration_ms: 155.766015
  type: 'test'
  ...
# Subtest: refuses a browser write from the wrong origin
ok 307 - refuses a browser write from the wrong origin
  ---
  duration_ms: 123.168456
  type: 'test'
  ...
# Subtest: refuses a machine callback without its secret
ok 308 - refuses a machine callback without its secret
  ---
  duration_ms: 326.296532
  type: 'test'
  ...
# Subtest: a verifier the lead starts is pointed at the thread branch
ok 309 - a verifier the lead starts is pointed at the thread branch
  ---
  duration_ms: 666.125229
  type: 'test'
  ...
# Subtest: the chat reads the lead transcript through the machine service
ok 310 - the chat reads the lead transcript through the machine service
  ---
  duration_ms: 327.73959
  type: 'test'
  ...
# Subtest: Tool steps: Hide leaves the lead's tool calls out of the chat
ok 311 - Tool steps: Hide leaves the lead's tool calls out of the chat
  ---
  duration_ms: 378.431356
  type: 'test'
  ...
# Subtest: a verifier report from its transcript reaches the lead as its result
ok 312 - a verifier report from its transcript reaches the lead as its result
  ---
  duration_ms: 819.460469
  type: 'test'
  ...
# Subtest: a Codex verifier report comes from the notify payload when present, once
ok 313 - a Codex verifier report comes from the notify payload when present, once
  ---
  duration_ms: 696.472008
  type: 'test'
  ...
# Subtest: a mapper works in the thread worktree; a worker branches from the thread branch
ok 314 - a mapper works in the thread worktree; a worker branches from the thread branch
  ---
  duration_ms: 1461.664803
  type: 'test'
  ...
# Subtest: models per role: leads, other agents, workers, aliases, and critical resolve through their provider cells
ok 315 - models per role: leads, other agents, workers, aliases, and critical resolve through their provider cells
  ---
  duration_ms: 5012.375807
  type: 'test'
  ...
# Subtest: models per role: Claude always gets a model and effort, and preferences reach the machine
ok 316 - models per role: Claude always gets a model and effort, and preferences reach the machine
  ---
  duration_ms: 990.7292
  type: 'test'
  ...
# Subtest: models per role: Claude family aliases do not become Codex tiers
ok 317 - models per role: Claude family aliases do not become Codex tiers
  ---
  duration_ms: 1678.861152
  type: 'test'
  ...
# Subtest: models per role: unknown tiers and unused provider cells are refused
ok 318 - models per role: unknown tiers and unused provider cells are refused
  ---
  duration_ms: 869.364653
  type: 'test'
  ...
# Subtest: no session starts while the machine service runs another commit
ok 319 - no session starts while the machine service runs another commit
  ---
  duration_ms: 746.807792
  type: 'test'
  ...
# Subtest: the Ready check covers only the thread family and uses account login status
ok 320 - the Ready check covers only the thread family and uses account login status
  ---
  duration_ms: 318.032328
  type: 'test'
  ...
# Subtest: projects.json records each thread project once and GET /projects lists them
ok 321 - projects.json records each thread project once and GET /projects lists them
  ---
  duration_ms: 591.688252
  type: 'test'
  ...
# Subtest: the sessions list passes unmanaged tmux sessions through as read-only
ok 322 - the sessions list passes unmanaged tmux sessions through as read-only
  ---
  duration_ms: 257.07052
  type: 'test'
  ...
# Subtest: serializes concurrent cards and de-duplicates a delivered card
ok 323 - serializes concurrent cards and de-duplicates a delivered card
  ---
  duration_ms: 259.073423
  type: 'test'
  ...
# Subtest: a failed event submit records its delivery id and leaves its queue for a later retry
ok 324 - a failed event submit records its delivery id and leaves its queue for a later retry
  ---
  duration_ms: 272.528982
  type: 'test'
  ...
# Subtest: a failed result-card submit is accepted, queued, and never rejected
ok 325 - a failed result-card submit is accepted, queued, and never rejected
  ---
  duration_ms: 447.079343
  type: 'test'
  ...
# Subtest: a browser message stays queued and reports delivery failure without failing its route
ok 326 - a browser message stays queued and reports delivery failure without failing its route
  ---
  duration_ms: 290.98787
  type: 'test'
  ...
# Subtest: a verifier report survives a failed submit and the queue timer retries it
ok 327 - a verifier report survives a failed submit and the queue timer retries it
  ---
  duration_ms: 567.906881
  type: 'test'
  ...
# Subtest: talking about an approval keeps it open for Needs you and Start building
ok 328 - talking about an approval keeps it open for Needs you and Start building
  ---
  duration_ms: 312.182975
  type: 'test'
  ...
# Subtest: successful submits record their destination, source, text, and time
ok 329 - successful submits record their destination, source, text, and time
  ---
  duration_ms: 307.765871
  type: 'test'
  ...
# Subtest: sent history keeps 500 entries and appends older entries beside the thread file
ok 330 - sent history keeps 500 entries and appends older entries beside the thread file
  ---
  duration_ms: 290.197663
  type: 'test'
  ...
# Subtest: restart context includes the latest twenty the user and card messages
ok 331 - restart context includes the latest twenty the user and card messages
  ---
  duration_ms: 513.765617
  type: 'test'
  ...
# Subtest: runs Codex preflight before a lead start and records its failure as a need
ok 332 - runs Codex preflight before a lead start and records its failure as a need
  ---
  duration_ms: 192.503627
  type: 'test'
  ...
# Subtest: terminal Enter marks its session busy before the next hook event
ok 333 - terminal Enter marks its session busy before the next hook event
  ---
  duration_ms: 277.953986
  type: 'test'
  ...
# Subtest: unreachable sessions are public and marked unreachable
ok 334 - unreachable sessions are public and marked unreachable
  ---
  duration_ms: 274.964422
  type: 'test'
  ...
# Subtest: a kept rebase makes a need and leaves the thread open
ok 335 - a kept rebase makes a need and leaves the thread open
  ---
  duration_ms: 283.240877
  type: 'test'
  ...
# Subtest: a second archive records the thread after a retained rebase worktree is removed
ok 336 - a second archive records the thread after a retained rebase worktree is removed
  ---
  duration_ms: 284.187111
  type: 'test'
  ...
# Subtest: serializes concurrent card and event arrivals without losing either
ok 337 - serializes concurrent card and event arrivals without losing either
  ---
  duration_ms: 397.836722
  type: 'test'
  ...
# Subtest: Features includes an opened stub but not an unopened one, and needs need no slug
ok 338 - Features includes an opened stub but not an unopened one, and needs need no slug
  ---
  duration_ms: 445.315794
  type: 'test'
  ...
# Subtest: stub commits persist and reach the opened lead context
ok 339 - stub commits persist and reach the opened lead context
  ---
  duration_ms: 432.758036
  type: 'test'
  ...
# Subtest: registers a diagram plan before persisting its card
ok 340 - registers a diagram plan before persisting its card
  ---
  duration_ms: 263.944882
  type: 'test'
  ...
# Subtest: a diagram card registers its graph for the real viewer iframe route
ok 341 - a diagram card registers its graph for the real viewer iframe route
  ---
  duration_ms: 293.396877
  type: 'test'
  ...
# Subtest: the real viewer keeps its boot commit when its clone moves before the first app request
ok 342 - the real viewer keeps its boot commit when its clone moves before the first app request
  ---
  duration_ms: 1865.613517
  type: 'test'
  ...
# Subtest: reachable Sessions responses do not expose tokens
ok 343 - reachable Sessions responses do not expose tokens
  ---
  duration_ms: 281.850627
  type: 'test'
  ...
# Subtest: a replacement sub-lead stops its predecessor worker, but a worker cannot stop a worker child
ok 344 - a replacement sub-lead stops its predecessor worker, but a worker cannot stop a worker child
  ---
  duration_ms: 1008.963572
  type: 'test'
  ...
# Subtest: worker replacement reuses a dead worker worktree and branch only
ok 345 - worker replacement reuses a dead worker worktree and branch only
  ---
  duration_ms: 912.223957
  type: 'test'
  ...
# Subtest: validates a resolve card and the targets it may close
ok 346 - validates a resolve card and the targets it may close
  ---
  duration_ms: 0.514417
  type: 'test'
  ...
# Subtest: a lead resolve closes its needs card and removes it from the Needs strip
ok 347 - a lead resolve closes its needs card and removes it from the Needs strip
  ---
  duration_ms: 281.573785
  type: 'test'
  ...
# Subtest: a resolve is refused for a system card, another kind, another thread and a missing card
ok 348 - a resolve is refused for a system card, another kind, another thread and a missing card
  ---
  duration_ms: 460.213555
  type: 'test'
  ...
# Subtest: a resolve retried with the same delivery id is a duplicate
ok 349 - a resolve retried with the same delivery id is a duplicate
  ---
  duration_ms: 302.287966
  type: 'test'
  ...
# Subtest: keep going and talk about it close a lead needs card and reach the lead
ok 350 - keep going and talk about it close a lead needs card and reach the lead
  ---
  duration_ms: 338.381701
  type: 'test'
  ...
# Subtest: dismiss closes lead needs and refuses a live held system card
ok 351 - dismiss closes lead needs and refuses a live held system card
  ---
  duration_ms: 323.336982
  type: 'test'
  ...
# Subtest: worker effort overrides and escalation ceilings reject before starting
ok 352 - worker effort overrides and escalation ceilings reject before starting
  ---
  duration_ms: 1744.823798
  type: 'test'
  ...
# Subtest: a Kimi worker started with an effort stores none and sends none to the machine
ok 353 - a Kimi worker started with an effort stores none and sends none to the machine
  ---
  duration_ms: 870.371267
  type: 'test'
  ...
# Subtest: wc session start includes effort only when supplied
ok 354 - wc session start includes effort only when supplied
  ---
  duration_ms: 2.366058
  type: 'test'
  ...
# Subtest: restarting a failed lead answers its turn-failed card
ok 355 - restarting a failed lead answers its turn-failed card
  ---
  duration_ms: 404.630453
  type: 'test'
  ...
# Subtest: concurrent threads get distinct persisted names and session model
ok 356 - concurrent threads get distinct persisted names and session model
  ---
  duration_ms: 272.81486
  type: 'test'
  ...
# Subtest: hub startup backfills existing unnamed leads with distinct names
ok 357 - hub startup backfills existing unnamed leads with distinct names
  ---
  duration_ms: 428.651408
  type: 'test'
  ...
# Subtest: diagram formats and lead-only image cards validate and persist
ok 358 - diagram formats and lead-only image cards validate and persist
  ---
  duration_ms: 257.420672
  type: 'test'
  ...
# Subtest: uploads and files stream through the hub and enforce admission
ok 359 - uploads and files stream through the hub and enforce admission
  ---
  duration_ms: 1747.423557
  type: 'test'
  ...
# Subtest: a machine reset during an upload returns 409
ok 360 - a machine reset during an upload returns 409
  ---
  duration_ms: 1749.614752
  type: 'test'
  ...
# Subtest: archive keeps thread open on upload removal failure and archives after success
ok 361 - archive keeps thread open on upload removal failure and archives after success
  ---
  duration_ms: 260.055393
  type: 'test'
  ...
# Subtest: archived HTML route sends the static sandbox headers
ok 362 - archived HTML route sends the static sandbox headers
  ---
  duration_ms: 2.152188
  type: 'test'
  ...
# Subtest: send now hands a queued message to the lead mid-turn
ok 363 - send now hands a queued message to the lead mid-turn
  ---
  duration_ms: 294.540351
  type: 'test'
  ...
# Subtest: send now waits out a permission prompt
ok 364 - send now waits out a permission prompt
  ---
  duration_ms: 299.480836
  type: 'test'
  ...
# Subtest: retract validates targets, removes pins and refuses stale presses
ok 365 - retract validates targets, removes pins and refuses stale presses
  ---
  duration_ms: 555.255287
  type: 'test'
  ...
# Subtest: approval replacement skips Needs and pins persist until accepted start or retraction
ok 366 - approval replacement skips Needs and pins persist until accepted start or retraction
  ---
  duration_ms: 324.752661
  type: 'test'
  ...
# Subtest: a non-lead cannot retract, and a retracted offer stays in the conversation after a new offer
ok 367 - a non-lead cannot retract, and a retracted offer stays in the conversation after a new offer
  ---
  duration_ms: 492.63468
  type: 'test'
  ...
# Subtest: deferred validates, stays pinned and accepts only valid pull-backs
ok 368 - deferred validates, stays pinned and accepts only valid pull-backs
  ---
  duration_ms: 310.105896
  type: 'test'
  ...
# Subtest: restart context preserves stub summary and all card kinds
ok 369 - restart context preserves stub summary and all card kinds
  ---
  duration_ms: 562.027865
  type: 'test'
  ...
# Subtest: nonblocking system needs dismiss without notifying lead, including stale holds
ok 370 - nonblocking system needs dismiss without notifying lead, including stale holds
  ---
  duration_ms: 255.92031
  type: 'test'
  ...
# Subtest: restart context carries recent peer messages after import cutoff and omits empty history
ok 371 - restart context carries recent peer messages after import cutoff and omits empty history
  ---
  duration_ms: 541.435214
  type: 'test'
  ...
# Subtest: stub additions validate and append only to unopened candidates
ok 372 - stub additions validate and append only to unopened candidates
  ---
  duration_ms: 277.128218
  type: 'test'
  ...
# Subtest: archive sends only live lead files and records kept uploads on retry
ok 373 - archive sends only live lead files and records kept uploads on retry
  ---
  duration_ms: 756.889449
  type: 'test'
  ...
# Subtest: archive stays open while a fatal stop is pending, then retries successfully
ok 374 - archive stays open while a fatal stop is pending, then retries successfully
  ---
  duration_ms: 37.406379
  type: 'test'
  ...
# Subtest: Kimi transcript displays human, tool and reply while hiding role and thinking
ok 375 - Kimi transcript displays human, tool and reply while hiding role and thinking
  ---
  duration_ms: 8.476431
  type: 'test'
  ...
# Subtest: Kimi report selects a turn and orders the last step parts by block
ok 376 - Kimi report selects a turn and orders the last step parts by block
  ---
  duration_ms: 4.332251
  type: 'test'
  ...
# Subtest: Kimi report ignores stale and subagent turn ends
ok 377 - Kimi report ignores stale and subagent turn ends
  ---
  duration_ms: 0.400167
  type: 'test'
  ...
# Subtest: turn watermark drops retries and interrupted turn releases permission without report or reminder
ok 378 - turn watermark drops retries and interrupted turn releases permission without report or reminder
  ---
  duration_ms: 4.35299
  type: 'test'
  ...
# Subtest: confirming listing supplies ended reasons and pending stop stays live
ok 379 - confirming listing supplies ended reasons and pending stop stays live
  ---
  duration_ms: 1.990048
  type: 'test'
  ...
# Subtest: ended workers notify their starter and only those with a reason add a card
ok 380 - ended workers notify their starter and only those with a reason add a card
  ---
  duration_ms: 0.903102
  type: 'test'
  ...
# Subtest: confirmed fatal stops notify once while ordinary stops stay silent
ok 381 - confirmed fatal stops notify once while ordinary stops stay silent
  ---
  duration_ms: 2.039873
  type: 'test'
  ...
# Subtest: Kimi settings: defaults, plans, migration and review families
ok 382 - Kimi settings: defaults, plans, migration and review families
  ---
  duration_ms: 6.492034
  type: 'test'
  ...
# Subtest: Kimi through the Settings API: accounts, preferences, effort and slashed model pins
ok 383 - Kimi through the Settings API: accounts, preferences, effort and slashed model pins
  ---
  duration_ms: 967.290733
  type: 'test'
  ...
# Subtest: Ready: a per-CLI Kimi problem is the line; otherwise the first account problem; otherwise not logged in
ok 384 - Ready: a per-CLI Kimi problem is the line; otherwise the first account problem; otherwise not logged in
  ---
  duration_ms: 99.165815
  type: 'test'
  ...
# Subtest: Usage: one Kimi account signed in on one machine and with a problem on another
ok 385 - Usage: one Kimi account signed in on one machine and with a problem on another
  ---
  duration_ms: 31.421358
  type: 'test'
  ...
# Subtest: Usage: a named Kimi account with no home on a machine below the floor shows the version problem
ok 386 - Usage: a named Kimi account with no home on a machine below the floor shows the version problem
  ---
  duration_ms: 23.125554
  type: 'test'
  ...
# Subtest: OpenRouter Pi warning appears in usage and does not block Ready
ok 387 - OpenRouter Pi warning appears in usage and does not block Ready
  ---
  duration_ms: 19.935464
  type: 'test'
  ...
# Subtest: lead listing respects machine, project, reachability, links and summaries
ok 388 - lead listing respects machine, project, reachability, links and summaries
  ---
  duration_ms: 155.024844
  type: 'test'
  ...
# Subtest: discovers only candidate stubs with addition and dependency details
ok 389 - discovers only candidate stubs with addition and dependency details
  ---
  duration_ms: 23.29608
  type: 'test'
  ...
# Subtest: cross-thread refusals are ordered and store nothing
ok 390 - cross-thread refusals are ordered and store nothing
  ---
  duration_ms: 239.365309
  type: 'test'
  ...
# Subtest: restart routes to latest lead; cross-thread question is hidden in agents and chat
ok 391 - restart routes to latest lead; cross-thread question is hidden in agents and chat
  ---
  duration_ms: 32.050675
  type: 'test'
  ...
# Subtest: receiving chat hides cross-thread traffic and retains ordinary turns
ok 392 - receiving chat hides cross-thread traffic and retains ordinary turns
  ---
  duration_ms: 39.144954
  type: 'test'
  ...
# Subtest: workers cannot cross threads
ok 393 - workers cannot cross threads
  ---
  duration_ms: 19.48567
  type: 'test'
  ...
# Subtest: simultaneous legacy leads exchange messages without deadlock
ok 394 - simultaneous legacy leads exchange messages without deadlock
  ---
  duration_ms: 29.601176
  type: 'test'
  ...
# Subtest: a link on either side permits messages in both directions
ok 395 - a link on either side permits messages in both directions
  ---
  duration_ms: 92.333499
  type: 'test'
  ...
# Subtest: ended lead holds a peer message and logs only the send
ok 396 - ended lead holds a peer message and logs only the send
  ---
  duration_ms: 31.679372
  type: 'test'
  ...
# Subtest: lead ending between acceptance and delivery holds the message
ok 397 - lead ending between acceptance and delivery holds the message
  ---
  duration_ms: 44.597524
  type: 'test'
  ...
# Subtest: pause persists outside capped log until user activity and counts only recent sends
ok 398 - pause persists outside capped log until user activity and counts only recent sends
  ---
  duration_ms: 130.638712
  type: 'test'
  ...
# Subtest: user message and card press each lift a paused pair
ok 399 - user message and card press each lift a paused pair
  ---
  duration_ms: 151.213912
  type: 'test'
  ...
# Subtest: only sends after user activity count toward the pair limit
ok 400 - only sends after user activity count toward the pair limit
  ---
  duration_ms: 60.174185
  type: 'test'
  ...
# Subtest: accepted held message follows restart context on the new lead
ok 401 - accepted held message follows restart context on the new lead
  ---
  duration_ms: 1728.773925
  type: 'test'
  ...
# Subtest: successful submit records received and caps the peer log
ok 402 - successful submit records received and caps the peer log
  ---
  duration_ms: 62.746891
  type: 'test'
  ...
# Subtest: agent changes, restore, keep and normalization retain history
ok 403 - agent changes, restore, keep and normalization retain history
  ---
  duration_ms: 66.389259
  type: 'test'
  ...
# Subtest: Keep clears staleness without changing the saved lesson or history
ok 404 - Keep clears staleness without changing the saved lesson or history
  ---
  duration_ms: 10.532054
  type: 'test'
  ...
# Subtest: agent removal appends the current text to existing history
ok 405 - agent removal appends the current text to existing history
  ---
  duration_ms: 12.720332
  type: 'test'
  ...
# Subtest: a second merge skips a lesson already waiting
ok 406 - a second merge skips a lesson already waiting
  ---
  duration_ms: 14.641107
  type: 'test'
  ...
# Subtest: merge matches trimmed text in the same scope
ok 407 - merge matches trimmed text in the same scope
  ---
  duration_ms: 15.127169
  type: 'test'
  ...
# Subtest: history caps, removals, merge and waiting
ok 408 - history caps, removals, merge and waiting
  ---
  duration_ms: 769.461143
  type: 'test'
  ...
# Subtest: handoff projects and file routes
ok 409 - handoff projects and file routes
  ---
  duration_ms: 414.210214
  type: 'test'
  ...
# Subtest: user edits and removals, capacity, and history matching
ok 410 - user edits and removals, capacity, and history matching
  ---
  duration_ms: 404.745316
  type: 'test'
  ...
# Subtest: merge skips older versions of current and removed lessons
ok 411 - merge skips older versions of current and removed lessons
  ---
  duration_ms: 78.416561
  type: 'test'
  ...
# Subtest: file limits, known directories, waiting recheck and normalization
ok 412 - file limits, known directories, waiting recheck and normalization
  ---
  duration_ms: 301.963815
  type: 'test'
  ...
# Subtest: new ids avoid removed history and different project scopes remain distinct
ok 413 - new ids avoid removed history and different project scopes remain distinct
  ---
  duration_ms: 17.451859
  type: 'test'
  ...
# Subtest: restore preserves version scope and appends removed lessons
ok 414 - restore preserves version scope and appends removed lessons
  ---
  duration_ms: 73.471314
  type: 'test'
  ...
# Subtest: import avoids removed history ids
ok 415 - import avoids removed history ids
  ---
  duration_ms: 16.601568
  type: 'test'
  ...
# Subtest: waiting avoids removed history ids
ok 416 - waiting avoids removed history ids
  ---
  duration_ms: 5.278576
  type: 'test'
  ...
# Subtest: export contains exactly the specified fields
ok 417 - export contains exactly the specified fields
  ---
  duration_ms: 257.715911
  type: 'test'
  ...
# Subtest: merge validates authors, handles threads, and fills the twelfth slot
ok 418 - merge validates authors, handles threads, and fills the twelfth slot
  ---
  duration_ms: 17.80731
  type: 'test'
  ...
# Subtest: waiting actions select role and id and discard the requested entry
ok 419 - waiting actions select role and id and discard the requested entry
  ---
  duration_ms: 9.588234
  type: 'test'
  ...
# Subtest: normalization rejects invalid history authors and waiting sources
ok 420 - normalization rejects invalid history authors and waiting sources
  ---
  duration_ms: 0.636832
  type: 'test'
  ...
# Subtest: import refuses a newer lessons file version
ok 421 - import refuses a newer lessons file version
  ---
  duration_ms: 236.992977
  type: 'test'
  ...
# Subtest: restore scope after agent replacement
ok 422 - restore scope after agent replacement
  ---
  duration_ms: 54.70809
  type: 'test'
  ...
# Subtest: card schema and saver pairs
ok 423 - card schema and saver pairs
  ---
  duration_ms: 55.464821
  type: 'test'
  ...
# Subtest: sub-lead can save a worker lesson for another provider
ok 424 - sub-lead can save a worker lesson for another provider
  ---
  duration_ms: 15.309209
  type: 'test'
  ...
# Subtest: reviewers and verifiers cannot save lessons through the hub
ok 425 - reviewers and verifiers cannot save lessons through the hub
  ---
  duration_ms: 13.729358
  type: 'test'
  ...
# Subtest: scope, repeat safety, replacement, removal and user ownership
ok 426 - scope, repeat safety, replacement, removal and user ownership
  ---
  duration_ms: 88.097833
  type: 'test'
  ...
# Subtest: normalization, cap, prompts and preview
ok 427 - normalization, cap, prompts and preview
  ---
  duration_ms: 60.716747
  type: 'test'
  ...
# Subtest: lead roleLayers keeps reviewer, verifier, mapper and designer blocks
ok 428 - lead roleLayers keeps reviewer, verifier, mapper and designer blocks
  ---
  duration_ms: 0.500981
  type: 'test'
  ...
# Subtest: card.js lesson validation refuses reviewer and missing why
ok 429 - card.js lesson validation refuses reviewer and missing why
  ---
  duration_ms: 0.520899
  type: 'test'
  ...
# Subtest: settings PUT merges edits and removals over HTTP
ok 430 - settings PUT merges edits and removals over HTTP
  ---
  duration_ms: 493.533535
  type: 'test'
  ...
# Subtest: all saver and target pairs enforce the role matrix
ok 431 - all saver and target pairs enforce the role matrix
  ---
  duration_ms: 48.566358
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-0f60d90bc923.slice
# Subtest: machine refuses an unconfirmed lesson without spooling it
ok 432 - machine refuses an unconfirmed lesson without spooling it
  ---
  duration_ms: 318.333368
  type: 'test'
  ...
# Subtest: "hub" names the installer-registered entry for this host's own service
ok 433 - "hub" names the installer-registered entry for this host's own service
  ---
  duration_ms: 31.799663
  type: 'test'
  ...
# Subtest: a lead waits when its machine passes the path check but cannot start it
ok 434 - a lead waits when its machine passes the path check but cannot start it
  ---
  duration_ms: 414.062431
  type: 'test'
  ...
# Subtest: a reachable machine that refuses a lead start records failure
ok 435 - a reachable machine that refuses a lead start records failure
  ---
  duration_ms: 1069.319446
  type: 'test'
  ...
# --cli is ignored: the hub picks the provider
# Subtest: an unreachable machine leaves no thread and no projects.json entry
ok 436 - an unreachable machine leaves no thread and no projects.json entry
  ---
  duration_ms: 37.204942
  type: 'test'
  ...
# Subtest: wc.js passes worktree-remove through with the worker session, and requires a commit message
ok 437 - wc.js passes worktree-remove through with the worker session, and requires a commit message
  ---
  duration_ms: 7.908221
  type: 'test'
  ...
# Subtest: wc.js preserves git flags and the worker replacement option
ok 438 - wc.js preserves git flags and the worker replacement option
  ---
  duration_ms: 0.875319
  type: 'test'
  ...
# Subtest: a hub keeps the version captured at construction after its clone advances
ok 439 - a hub keeps the version captured at construction after its clone advances
  ---
  duration_ms: 74.083989
  type: 'test'
  ...
# Subtest: wc.js sends provider constraints and prints waiting and notice output
ok 440 - wc.js sends provider constraints and prints waiting and notice output
  ---
  duration_ms: 96.326157
  type: 'test'
  ...
# Subtest: MERGED posts exactly one card and marker; a second poll posts nothing
ok 441 - MERGED posts exactly one card and marker; a second poll posts nothing
  ---
  duration_ms: 42.771301
  type: 'test'
  ...
# Subtest: overlapping sweeps return immediately and call gh once per thread
ok 442 - overlapping sweeps return immediately and call gh once per thread
  ---
  duration_ms: 46.531924
  type: 'test'
  ...
# Subtest: archiving during gh leaves no merged card
ok 443 - archiving during gh leaves no merged card
  ---
  duration_ms: 65.026444
  type: 'test'
  ...
# Subtest: init resolves while gh is still running
ok 444 - init resolves while gh is still running
  ---
  duration_ms: 64.251567
  type: 'test'
  ...
# Subtest: OPEN, CLOSED and failing gh leave threads unchanged and do not throw
ok 445 - OPEN, CLOSED and failing gh leave threads unchanged and do not throw
  ---
  duration_ms: 40.405262
  type: 'test'
  ...
# Subtest: archived and invalid URLs are not checked; newest unreplaced done URL wins
ok 446 - archived and invalid URLs are not checked; newest unreplaced done URL wins
  ---
  duration_ms: 28.553276
  type: 'test'
  ...
# Subtest: merged needs attention until keep resolves without a live lead
ok 447 - merged needs attention until keep resolves without a live lead
  ---
  duration_ms: 22.609583
  type: 'test'
  ...
# Subtest: successful archive resolves merged cards; failed archive leaves them open
ok 448 - successful archive resolves merged cards; failed archive leaves them open
  ---
  duration_ms: 24.278795
  type: 'test'
  ...
# Subtest: card.js refuses merged from a session
ok 449 - card.js refuses merged from a session
  ---
  duration_ms: 91.675687
  type: 'test'
  ...
# Subtest: mockup fields and roles are validated
ok 450 - mockup fields and roles are validated
  ---
  duration_ms: 5.798734
  type: 'test'
  ...
# Subtest: CLI checks mockup files before asking for a token
ok 451 - CLI checks mockup files before asking for a token
  ---
  duration_ms: 231.362807
  type: 'test'
  ...
# Subtest: hub discovers and stores the plan while checking mockup files
ok 452 - hub discovers and stores the plan while checking mockup files
  ---
  duration_ms: 89.268699
  type: 'test'
  ...
# Subtest: GET /new-thread returns found repositories for the machine and passes folder_error on
ok 453 - GET /new-thread returns found repositories for the machine and passes folder_error on
  ---
  duration_ms: 406.364031
  type: 'test'
  ...
# Subtest: GET /new-thread asks for no folder when none is set
ok 454 - GET /new-thread asks for no folder when none is set
  ---
  duration_ms: 230.683814
  type: 'test'
  ...
# Subtest: GET /new-thread says an unreachable machine is not reachable and an old one needs updating
ok 455 - GET /new-thread says an unreachable machine is not reachable and an old one needs updating
  ---
  duration_ms: 261.496795
  type: 'test'
  ...
# Subtest: GET /new-thread lists hub first and folds the hub hostname entry into it
ok 456 - GET /new-thread lists hub first and folds the hub hostname entry into it
  ---
  duration_ms: 246.082103
  type: 'test'
  ...
# Subtest: GET /new-thread filters saved directories by machine
ok 457 - GET /new-thread filters saved directories by machine
  ---
  duration_ms: 280.313631
  type: 'test'
  ...
# Subtest: GET /new-thread previous comes from threads on that machine, newest first, hostname alias included
ok 458 - GET /new-thread previous comes from threads on that machine, newest first, hostname alias included
  ---
  duration_ms: 1873.178967
  type: 'test'
  ...
# Subtest: saved directories: add, duplicate 409, remove, remove unknown 404
ok 459 - saved directories: add, duplicate 409, remove, remove unknown 404
  ---
  duration_ms: 487.719666
  type: 'test'
  ...
# Subtest: saving a directory is refused with the check reason, and 502 when the machine does not answer
ok 460 - saving a directory is refused with the check reason, and 502 when the machine does not answer
  ---
  duration_ms: 334.582636
  type: 'test'
  ...
# Subtest: default_project_folder is trimmed, cleared by empty, and must be absolute or start with ~
ok 461 - default_project_folder is trimmed, cleared by empty, and must be absolute or start with ~
  ---
  duration_ms: 613.407528
  type: 'test'
  ...
# Subtest: starting a thread on a path the machine refuses leaves no thread and no projects.json entry
ok 462 - starting a thread on a path the machine refuses leaves no thread and no projects.json entry
  ---
  duration_ms: 222.718461
  type: 'test'
  ...
# Subtest: starting a thread stores the path the machine expanded
ok 463 - starting a thread stores the path the machine expanded
  ---
  duration_ms: 480.433186
  type: 'test'
  ...
# Subtest: a template scope may name a saved directory path, and settings lists it as a project
ok 464 - a template scope may name a saved directory path, and settings lists it as a project
  ---
  duration_ms: 398.201938
  type: 'test'
  ...
# Subtest: saved directories refuse . and .. as names and treat a malformed escape as unknown
ok 465 - saved directories refuse . and .. as names and treat a malformed escape as unknown
  ---
  duration_ms: 438.231568
  type: 'test'
  ...
# Subtest: Pi sample shows text and folded tool calls without thinking or system content
ok 466 - Pi sample shows text and folded tool calls without thinking or system content
  ---
  duration_ms: 4.2062
  type: 'test'
  ...
# Subtest: Pi report selects only the named assistant entry
ok 467 - Pi report selects only the named assistant entry
  ---
  duration_ms: 0.778333
  type: 'test'
  ...
# Subtest: completed Pi event delivers the named report to the starter
ok 468 - completed Pi event delivers the named report to the starter
  ---
  duration_ms: 6.440815
  type: 'test'
  ...
# Subtest: Pi sample completed entry reaches the starting session
ok 469 - Pi sample completed entry reaches the starting session
  ---
  duration_ms: 1.526589
  type: 'test'
  ...
# Subtest: Pi sample aborted entry delivers no report
ok 470 - Pi sample aborted entry delivers no report
  ---
  duration_ms: 0.585904
  type: 'test'
  ...
# Subtest: aborted and failed Pi turns deliver no report
ok 471 - aborted and failed Pi turns deliver no report
  ---
  duration_ms: 0.51077
  type: 'test'
  ...
# Subtest: an aborted first turn permits the second report
ok 472 - an aborted first turn permits the second report
  ---
  duration_ms: 1.054042
  type: 'test'
  ...
# Subtest: completed turns advance watermark, replay is ignored, and null abort cannot reuse a reply
ok 473 - completed turns advance watermark, replay is ignored, and null abort cannot reuse a reply
  ---
  duration_ms: 1.580953
  type: 'test'
  ...
# Subtest: rate-limit failures do not cool down the OpenRouter account and redacted errors reach the starter
ok 474 - rate-limit failures do not cool down the OpenRouter account and redacted errors reach the starter
  ---
  duration_ms: 0.755139
  type: 'test'
  ...
# Subtest: Pi chat response redacts synthetic keys from text and tool details
ok 475 - Pi chat response redacts synthetic keys from text and tool details
  ---
  duration_ms: 5.749851
  type: 'test'
  ...
# Subtest: OpenRouter settings defaults, migration and page display
ok 476 - OpenRouter settings defaults, migration and page display
  ---
  duration_ms: 10.026905
  type: 'test'
  ...
# Subtest: OpenRouter model IDs agree in the page and save route
ok 477 - OpenRouter model IDs agree in the page and save route
  ---
  duration_ms: 1246.944603
  type: 'test'
  ...
# Subtest: OpenRouter effort pin round-trips through Settings; unknown level is refused
ok 478 - OpenRouter effort pin round-trips through Settings; unknown level is refused
  ---
  duration_ms: 1991.595068
  type: 'test'
  ...
# Subtest: a key-only waiting state shows the paste field with the key hint
ok 479 - a key-only waiting state shows the paste field with the key hint
  ---
  duration_ms: 1.524385
  type: 'test'
  ...
# Subtest: states with a link or without wantsCode keep the existing behaviour
ok 480 - states with a link or without wantsCode keep the existing behaviour
  ---
  duration_ms: 0.644767
  type: 'test'
  ...
# Subtest: the page treats key-only waiting like a link: the startup timeout stops, the key is a password field, 409 offers a restart for OpenRouter only
ok 481 - the page treats key-only waiting like a link: the startup timeout stops, the key is a password field, 409 offers a restart for OpenRouter only
  ---
  duration_ms: 2.009445
  type: 'test'
  ...
# Subtest: spend sums every account on every machine
ok 482 - spend sums every account on every machine
  ---
  duration_ms: 1.618074
  type: 'test'
  ...
# Subtest: all zero says no spend yet; unreachable and 404 machines mark it incomplete
ok 483 - all zero says no spend yet; unreachable and 404 machines mark it incomplete
  ---
  duration_ms: 1.442718
  type: 'test'
  ...
# Subtest: spend formatting
ok 484 - spend formatting
  ---
  duration_ms: 0.337307
  type: 'test'
  ...
# Subtest: OpenRouter accounts are never out of room, amber or alerting
ok 485 - OpenRouter accounts are never out of room, amber or alerting
  ---
  duration_ms: 1.019605
  type: 'test'
  ...
# Subtest: the usage route carries spend for OpenRouter only and a 404 machine is incomplete
ok 486 - the usage route carries spend for OpenRouter only and a 404 machine is incomplete
  ---
  duration_ms: 343.058879
  type: 'test'
  ...
# Subtest: normalizes all old thread fields in place and is idempotent
ok 487 - normalizes all old thread fields in place and is idempotent
  ---
  duration_ms: 2.761207
  type: 'test'
  ...
# Subtest: an app page without the remember cookie gets the sign-in page
ok 488 - an app page without the remember cookie gets the sign-in page
  ---
  duration_ms: 255.861824
  type: 'test'
  ...
# Subtest: the bookmark token signs a new browser in on an app page, and a wrong one does not
ok 489 - the bookmark token signs a new browser in on an app page, and a wrong one does not
  ---
  duration_ms: 205.441771
  type: 'test'
  ...
# Subtest: the document page is served behind the remember cookie like the other app pages
ok 490 - the document page is served behind the remember cookie like the other app pages
  ---
  duration_ms: 205.442301
  type: 'test'
  ...
# Subtest: the New thread page is served behind the remember cookie, with its assets
ok 491 - the New thread page is served behind the remember cookie, with its assets
  ---
  duration_ms: 182.237967
  type: 'test'
  ...
# Subtest: an unknown app page is not served
ok 492 - an unknown app page is not served
  ---
  duration_ms: 146.774986
  type: 'test'
  ...
# Subtest: asset names outside pages/ and vendor/, or climbing out, are refused
ok 493 - asset names outside pages/ and vendor/, or climbing out, are refused
  ---
  duration_ms: 175.064084
  type: 'test'
  ...
# Subtest: the existing page scripts are still served
ok 494 - the existing page scripts are still served
  ---
  duration_ms: 138.309437
  type: 'test'
  ...
# Subtest: app pages may frame this origin, for diagram cards
ok 495 - app pages may frame this origin, for diagram cards
  ---
  duration_ms: 1.148343
  type: 'test'
  ...
# Subtest: the old Sessions page redirects to Agents
ok 496 - the old Sessions page redirects to Agents
  ---
  duration_ms: 166.72636
  type: 'test'
  ...
# Subtest: the picture page is served behind the remember cookie with its assets
ok 497 - the picture page is served behind the remember cookie with its assets
  ---
  duration_ms: 192.75361
  type: 'test'
  ...
# Subtest: schema: lead only, both fields required, nothing else
ok 498 - schema: lead only, both fields required, nothing else
  ---
  duration_ms: 2.126399
  type: 'test'
  ...
# Subtest: refusals 1-9 and 4a, in order, and a refusal writes nothing
ok 499 - refusals 1-9 and 4a, in order, and a refusal writes nothing
  ---
  duration_ms: 159.604518
  type: 'test'
  ...
# Subtest: refusal 7: another thread by branch or by target_pr; not another project branch; yes another project target_pr
ok 500 - refusal 7: another thread by branch or by target_pr; not another project branch; yes another project target_pr
  ---
  duration_ms: 128.462196
  type: 'test'
  ...
# Subtest: refusals 8 and 9
ok 501 - refusals 8 and 9
  ---
  duration_ms: 70.106499
  type: 'test'
  ...
# Subtest: accepted card stores copied fields; Allow sets target_pr and tells the lead
ok 502 - accepted card stores copied fields; Allow sets target_pr and tells the lead
  ---
  duration_ms: 36.504037
  type: 'test'
  ...
# Subtest: Allow after another thread claimed the branch gives allow failed; Don't allow changes nothing
ok 503 - Allow after another thread claimed the branch gives allow failed; Don't allow changes nothing
  ---
  duration_ms: 51.908128
  type: 'test'
  ...
# Subtest: retract while open; a press on a withdrawn card is refused
ok 504 - retract while open; a press on a withdrawn card is refused
  ---
  duration_ms: 36.426529
  type: 'test'
  ...
# Subtest: an assistant press on a permit card is attributed
ok 505 - an assistant press on a permit card is attributed
  ---
  duration_ms: 48.639117
  type: 'test'
  ...
# Subtest: card opens, keeps id on same names, replaces on different names, closes on reset
ok 506 - card opens, keeps id on same names, replaces on different names, closes on reset
  ---
  duration_ms: 2992.441925
  type: 'test'
  ...
# Subtest: per-CLI and program lines are kept apart; a file line uses the name file
ok 507 - per-CLI and program lines are kept apart; a file line uses the name file
  ---
  duration_ms: 1222.284704
  type: 'test'
  ...
# Subtest: more than 20 lines shows and N more; duplicates by text drop
ok 508 - more than 20 lines shows and N more; duplicates by text drop
  ---
  duration_ms: 1985.745708
  type: 'test'
  ...
# Subtest: a line with underscores is kept byte-for-byte in items
ok 509 - a line with underscores is kept byte-for-byte in items
  ---
  duration_ms: 2381.943945
  type: 'test'
  ...
# Subtest: seq and boot ordering
ok 510 - seq and boot ordering
  ---
  duration_ms: 5469.664105
  type: 'test'
  ...
# Subtest: project_tools is not left on the session record
ok 511 - project_tools is not left on the session record
  ---
  duration_ms: 2822.919309
  type: 'test'
  ...
# Subtest: applied in a queued promotion and in resumeUnanswered, without re-taking the lock
ok 512 - applied in a queued promotion and in resumeUnanswered, without re-taking the lock
  ---
  duration_ms: 2472.887301
  type: 'test'
  ...
# Subtest: default wc.js session list shows project_tools on the lead entry
ok 513 - default wc.js session list shows project_tools on the lead entry
  ---
  duration_ms: 161.639783
  type: 'test'
  ...
# Subtest: with two lead sessions only the newest lead carries project_tools in the hub list
ok 514 - with two lead sessions only the newest lead carries project_tools in the hub list
  ---
  duration_ms: 2359.472421
  type: 'test'
  ...
# Subtest: a new thread gets the default project_tools record when the machine start answer has none
ok 515 - a new thread gets the default project_tools record when the machine start answer has none
  ---
  duration_ms: 1440.182661
  type: 'test'
  ...
# Subtest: a handoff import creates a thread with the default project_tools, even when the lead cannot start
ok 516 - a handoff import creates a thread with the default project_tools, even when the lead cannot start
  ---
  duration_ms: 47.539063
  type: 'test'
  ...
# Subtest: dismissed project tools card stays closed until problem names change
ok 517 - dismissed project tools card stays closed until problem names change
  ---
  duration_ms: 4275.712291
  type: 'test'
  ...
# Subtest: project tools routes forward requests and machine responses without storing keys
ok 518 - project tools routes forward requests and machine responses without storing keys
  ---
  duration_ms: 425.062189
  type: 'test'
  ...
# Subtest: project tools transport failures, validation and browser authorization
ok 519 - project tools transport failures, validation and browser authorization
  ---
  duration_ms: 303.945997
  type: 'test'
  ...
# Subtest: project tools forwards with a 120 second timeout
ok 520 - project tools forwards with a 120 second timeout
  ---
  duration_ms: 3.76866
  type: 'test'
  ...
# Subtest: machine replies keep multi-byte characters split across chunks
ok 521 - machine replies keep multi-byte characters split across chunks
  ---
  duration_ms: 64.575207
  type: 'test'
  ...
# Subtest: project tools forwards windows-status like the other routes
ok 522 - project tools forwards windows-status like the other routes
  ---
  duration_ms: 1.754887
  type: 'test'
  ...
# Subtest: read forwards the configured shared project and this machine’s saved paths
ok 523 - read forwards the configured shared project and this machine’s saved paths
  ---
  duration_ms: 285.744559
  type: 'test'
  ...
# Subtest: optional question fields validate and old cards remain valid
ok 524 - optional question fields validate and old cards remain valid
  ---
  duration_ms: 2.172147
  type: 'test'
  ...
# Subtest: acceptance tags asking messages and refuses invalid references within the thread
ok 525 - acceptance tags asking messages and refuses invalid references within the thread
  ---
  duration_ms: 7.096203
  type: 'test'
  ...
# Subtest: paths and waiting questions follow direct and relayed cards and close on replies
ok 526 - paths and waiting questions follow direct and relayed cards and close on replies
  ---
  duration_ms: 5.320487
  type: 'test'
  ...
# Subtest: agents hides raw activity state
ok 527 - agents hides raw activity state
  ---
  duration_ms: 24.615311
  type: 'test'
  ...
# Subtest: delivery ids identify stored cards and both duplicate paths
ok 528 - delivery ids identify stored cards and both duplicate paths
  ---
  duration_ms: 1.091664
  type: 'test'
  ...
# Subtest: about_thread is a question-only lowercase thread id
ok 529 - about_thread is a question-only lowercase thread id
  ---
  duration_ms: 0.572909
  type: 'test'
  ...
# Subtest: 1 first quiet turn nudges worker
ok 530 - 1 first quiet turn nudges worker
  ---
  duration_ms: 1951.843763
  type: 'test'
  ...
# Subtest: 2 second quiet turn nudges starter
ok 531 - 2 second quiet turn nudges starter
  ---
  duration_ms: 1664.383004
  type: 'test'
  ...
# Subtest: 3 third quiet turn creates and result closes card
ok 532 - 3 third quiet turn creates and result closes card
  ---
  duration_ms: 2525.658223
  type: 'test'
  ...
# Subtest: 4 timer escalates after starter told
ok 533 - 4 timer escalates after starter told
  ---
  duration_ms: 4272.936096
  type: 'test'
  ...
# Subtest: 5 late result within grace prevents nudge
ok 534 - 5 late result within grace prevents nudge
  ---
  duration_ms: 3574.095358
  type: 'test'
  ...
# Subtest: 6b status message without a question does not clear debt
ok 535 - 6b status message without a question does not clear debt
  ---
  duration_ms: 3314.428742
  type: 'test'
  ...
# Subtest: 6c finished agent answering a follow-up with a plain message is not nudged
ok 536 - 6c finished agent answering a follow-up with a plain message is not nudged
  ---
  duration_ms: 3012.995394
  type: 'test'
  ...
# Subtest: 6d worker question to the lead protects its waiting sub-lead
ok 537 - 6d worker question to the lead protects its waiting sub-lead
  ---
  duration_ms: 3396.344573
  type: 'test'
  ...
# Subtest: 6 message clears debt
not ok 538 - 6 message clears debt
  ---
  duration_ms: 3417.049639
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/test/app-quiet.test.js:41:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    
    1 !== 0
    
  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 0
  actual: 1
  operator: 'strictEqual'
  stack: |-
    /home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/test/app-quiet.test.js:41:164
    async run (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/test/app-quiet.test.js:31:77)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: 7 child owing reply or waiting protects sub-lead
ok 539 - 7 child owing reply or waiting protects sub-lead
  ---
  duration_ms: 3143.815621
  type: 'test'
  ...
# Subtest: 8 reviewer empty report nudges, text reports
ok 540 - 8 reviewer empty report nudges, text reports
  ---
  duration_ms: 4025.40901
  type: 'test'
  ...
# Subtest: 9 lead is never watched
ok 541 - 9 lead is never watched
  ---
  duration_ms: 1720.392686
  type: 'test'
  ...
# Subtest: 10 stopping answers card
ok 542 - 10 stopping answers card
  ---
  duration_ms: 1701.726942
  type: 'test'
  ...
# Subtest: 11 failed nudge is removed by result
ok 543 - 11 failed nudge is removed by result
  ---
  duration_ms: 1703.479185
  type: 'test'
  ...
# Subtest: 12 timer starts on delivery to held starter
ok 544 - 12 timer starts on delivery to held starter
  ---
  duration_ms: 2281.686487
  type: 'test'
  ...
# Subtest: 13 re-messaged finished child protects sub-lead
ok 545 - 13 re-messaged finished child protects sub-lead
  ---
  duration_ms: 1366.035421
  type: 'test'
  ...
# Subtest: 14 due check survives needs hold
ok 546 - 14 due check survives needs hold
  ---
  duration_ms: 1290.097629
  type: 'test'
  ...
# Subtest: 15 child question does not protect starter
ok 547 - 15 child question does not protect starter
  ---
  duration_ms: 1088.759212
  type: 'test'
  ...
# Subtest: 16 quiet turn waits for queued starter reminder
ok 548 - 16 quiet turn waits for queued starter reminder
  ---
  duration_ms: 1312.967882
  type: 'test'
  ...
# Subtest: 17 dead starter escalates queued reminder
ok 549 - 17 dead starter escalates queued reminder
  ---
  duration_ms: 1253.628992
  type: 'test'
  ...
# Subtest: 18 queued child answer protects starter
ok 550 - 18 queued child answer protects starter
  ---
  duration_ms: 1347.320378
  type: 'test'
  ...
# Subtest: starter message resets open or dismissed quiet card on acceptance and stays queued
ok 551 - starter message resets open or dismissed quiet card on acceptance and stays queued
  ---
  duration_ms: 1220.092342
  type: 'test'
  ...
# Subtest: child starts reset quiet card on new and duplicate starts, but not refusal
ok 552 - child starts reset quiet card on new and duplicate starts, but not refusal
  ---
  duration_ms: 1480.596262
  type: 'test'
  ...
# Subtest: starter message before warning leaves quiet stage unchanged
ok 553 - starter message before warning leaves quiet stage unchanged
  ---
  duration_ms: 1133.946368
  type: 'test'
  ...
# Subtest: retry of unanswered child start resets its starter after success
ok 554 - retry of unanswered child start resets its starter after success
  ---
  duration_ms: 978.675554
  type: 'test'
  ...
# Subtest: app queue messages do not close a quiet card
ok 555 - app queue messages do not close a quiet card
  ---
  duration_ms: 824.6612
  type: 'test'
  ...
# Subtest: dismissed quiet episode rearms the ladder after starter message or child start
ok 556 - dismissed quiet episode rearms the ladder after starter message or child start
  ---
  duration_ms: 2526.138554
  type: 'test'
  ...
# Subtest: validation and ordered post refusals
ok 557 - validation and ordered post refusals
  ---
  duration_ms: 249.087418
  type: 'test'
  ...
# Subtest: allow links only sender and permits reply, and handoff and Needs reflect state
ok 558 - allow links only sender and permits reply, and handoff and Needs reflect state
  ---
  duration_ms: 59.457
  type: 'test'
  ...
# Subtest: target changes, existing links and denial
ok 559 - target changes, existing links and denial
  ---
  duration_ms: 135.61111
  type: 'test'
  ...
# Subtest: retraction, bad presses and missing lead leave no link
ok 560 - retraction, bad presses and missing lead leave no link
  ---
  duration_ms: 48.695305
  type: 'test'
  ...
# Subtest: remote document and ZIP use machine for live and archived threads, mapping failures
ok 561 - remote document and ZIP use machine for live and archived threads, mapping failures
  ---
  duration_ms: 811.400723
  type: 'test'
  ...
# Subtest: refresh checks its snapshot and never starts a machine call under the lock
ok 562 - refresh checks its snapshot and never starts a machine call under the lock
  ---
  duration_ms: 36.736202
  type: 'test'
  ...
# Subtest: real plan-file callers do not start or await machine requests under a thread lock
ok 563 - real plan-file callers do not start or await machine requests under a thread lock
  ---
  duration_ms: 4886.459233
  type: 'test'
  ...
# Subtest: remote refresh saves committed status for Features
ok 564 - remote refresh saves committed status for Features
  ---
  duration_ms: 1219.274689
  type: 'test'
  ...
# Subtest: remote refresh does not record a target PR plan, including a target set during discovery
ok 565 - remote refresh does not record a target PR plan, including a target set during discovery
  ---
  duration_ms: 107.314895
  type: 'test'
  ...
# Subtest: report retries a failed read and delivers exactly once
ok 566 - report retries a failed read and delivers exactly once
  ---
  duration_ms: 7.713407
  type: 'test'
  ...
# Subtest: Pi retries an empty transcript until its entry arrives
ok 567 - Pi retries an empty transcript until its entry arrives
  ---
  duration_ms: 3.656975
  type: 'test'
  ...
# Subtest: absent non-Pi transcript reads once and arms quiet; failures exhaust retries
ok 568 - absent non-Pi transcript reads once and arms quiet; failures exhaust retries
  ---
  duration_ms: 3.041234
  type: 'test'
  ...
# Subtest: deadline boundary skips the gap at 749ms and permits it at 750ms
ok 569 - deadline boundary skips the gap at 749ms and permits it at 750ms
  ---
  duration_ms: 4.461138
  type: 'test'
  ...
# Subtest: strict absence falls back locally and failed local reads throw
ok 570 - strict absence falls back locally and failed local reads throw
  ---
  duration_ms: 32.780044
  type: 'test'
  ...
# Subtest: strict request cuts off dribbling response at its wall cap
ok 571 - strict request cuts off dribbling response at its wall cap
  ---
  duration_ms: 155.376177
  type: 'test'
  ...
# Subtest: timeout and dropped response after headers are retried
ok 572 - timeout and dropped response after headers are retried
  ---
  duration_ms: 3037.426453
  type: 'test'
  ...
# Subtest: session title, brief, timing and history routes
ok 573 - session title, brief, timing and history routes
  ---
  duration_ms: 1481.763884
  type: 'test'
  ...
# Subtest: pane forwards history unchanged to the machine
ok 574 - pane forwards history unchanged to the machine
  ---
  duration_ms: 24.760279
  type: 'test'
  ...
# Subtest: title normalization and session lifecycle timestamps
ok 575 - title normalization and session lifecycle timestamps
  ---
  duration_ms: 2069.045416
  type: 'test'
  ...
# Subtest: open and restart responses filter every session, including waiting stub wrapper
ok 576 - open and restart responses filter every session, including waiting stub wrapper
  ---
  duration_ms: 3.016627
  type: 'test'
  ...
# Subtest: archive records end times and preserves existing values on success and partial failure
ok 577 - archive records end times and preserves existing values on success and partial failure
  ---
  duration_ms: 4.401764
  type: 'test'
  ...
# Subtest: review round is validated before dedupe and retained on retry
ok 578 - review round is validated before dedupe and retained on retry
  ---
  duration_ms: 1630.18982
  type: 'test'
  ...
# Subtest: settings defaults, templates, prompt composition, counts, and validation
ok 579 - settings defaults, templates, prompt composition, counts, and validation
  ---
  duration_ms: 2567.882213
  type: 'test'
  ...
# Subtest: settings prompt preview composes role and card rule placeholders by role
ok 580 - settings prompt preview composes role and card rule placeholders by role
  ---
  duration_ms: 218.268835
  type: 'test'
  ...
# Subtest: style saving, trailer delivery, chat stripping, and preview stay scoped to leads
ok 581 - style saving, trailer delivery, chat stripping, and preview stay scoped to leads
  ---
  duration_ms: 2284.668433
  type: 'test'
  ...
# Subtest: settings updates serialize concurrent saves and report a missing template project
ok 582 - settings updates serialize concurrent saves and report a missing template project
  ---
  duration_ms: 1069.664546
  type: 'test'
  ...
# Subtest: the role-layer cap refuses template and style saves without changing settings
ok 583 - the role-layer cap refuses template and style saves without changing settings
  ---
  duration_ms: 510.946927
  type: 'test'
  ...
# Subtest: preview has a 75-second machine timeout while ordinary calls retain five seconds
ok 584 - preview has a 75-second machine timeout while ordinary calls retain five seconds
  ---
  duration_ms: 14.5387
  type: 'test'
  ...
# Subtest: settings model and heads-up routes reject bad input and preserve the settings file mode
ok 585 - settings model and heads-up routes reject bad input and preserve the settings file mode
  ---
  duration_ms: 4135.914158
  type: 'test'
  ...
# Subtest: template scopes must be listed when added or changed, while removed-project templates remain editable
ok 586 - template scopes must be listed when added or changed, while removed-project templates remain editable
  ---
  duration_ms: 361.279189
  type: 'test'
  ...
# Subtest: escalation settings, sentences, and role layers
ok 587 - escalation settings, sentences, and role layers
  ---
  duration_ms: 631.597105
  type: 'test'
  ...
# Subtest: lead name settings trim and validate names
ok 588 - lead name settings trim and validate names
  ---
  duration_ms: 928.754266
  type: 'test'
  ...
# Subtest: lead name list choice saves, validates and migrates
ok 589 - lead name list choice saves, validates and migrates
  ---
  duration_ms: 800.261694
  type: 'test'
  ...
# Subtest: gemini settings migrate and enforce account and model rules
ok 590 - gemini settings migrate and enforce account and model rules
  ---
  duration_ms: 639.641423
  type: 'test'
  ...
# Subtest: removed worker providers stay removed after saving
ok 591 - removed worker providers stay removed after saving
  ---
  duration_ms: 1018.436998
  type: 'test'
  ...
# Subtest: scout preferences and session layers follow the selected provider
ok 592 - scout preferences and session layers follow the selected provider
  ---
  duration_ms: 3959.849815
  type: 'test'
  ...
# Subtest: model ID limits protect near-limit scout role layers
ok 593 - model ID limits protect near-limit scout role layers
  ---
  duration_ms: 3001.940244
  type: 'test'
  ...
# Subtest: your name is saved, validated, and told to every agent only when set
ok 594 - your name is saved, validated, and told to every agent only when set
  ---
  duration_ms: 1163.769124
  type: 'test'
  ...
# Subtest: shared tools project choice saves and clears
ok 595 - shared tools project choice saves and clears
  ---
  duration_ms: 836.647319
  type: 'test'
  ...
# Subtest: shared tools setting defaults, validates and saves
ok 596 - shared tools setting defaults, validates and saves
  ---
  duration_ms: 645.942375
  type: 'test'
  ...
# Subtest: folder problem lines appear and clear on a newer update
ok 597 - folder problem lines appear and clear on a newer update
  ---
  duration_ms: 1.907149
  type: 'test'
  ...
# Subtest: session start sends this machine’s saved paths in order and omits an unset choice
ok 598 - session start sends this machine’s saved paths in order and omits an unset choice
  ---
  duration_ms: 949.972168
  type: 'test'
  ...
# Subtest: ready event updates folder problem card
not ok 599 - ready event updates folder problem card
  ---
  duration_ms: 611.589971
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/test/app-shared-tools-setting.test.js:43:1'
  failureType: 'testCodeFailure'
  error: "Cannot read properties of undefined (reading 'some')"
  code: 'ERR_TEST_FAILURE'
  name: 'TypeError'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/test/app-shared-tools-setting.test.js:50:27)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# warning: You appear to have cloned an empty repository.
# Subtest: an untracked new plan directory is the thread plan, not an existing one
ok 600 - an untracked new plan directory is the thread plan, not an existing one
  ---
  duration_ms: 237.350782
  type: 'test'
  ...
# warning: You appear to have cloned an empty repository.
# Subtest: a plan directory committed on the thread branch is found against its upstream
ok 601 - a plan directory committed on the thread branch is found against its upstream
  ---
  duration_ms: 199.766272
  type: 'test'
  ...
# warning: You appear to have cloned an empty repository.
# Subtest: an edited file in an existing plan directory does not claim that plan
ok 602 - an edited file in an existing plan directory does not claim that plan
  ---
  duration_ms: 153.591272
  type: 'test'
  ...
# warning: You appear to have cloned an empty repository.
# Subtest: a file committed into an existing plan directory does not claim that plan
ok 603 - a file committed into an existing plan directory does not claim that plan
  ---
  duration_ms: 170.756401
  type: 'test'
  ...
# warning: You appear to have cloned an empty repository.
# Preparing worktree (new branch 'wc/no-track')
# Subtest: finds a committed plan on a no-track worktree branch against origin/default
ok 604 - finds a committed plan on a no-track worktree branch against origin/default
  ---
  duration_ms: 176.862354
  type: 'test'
  ...
# warning: You appear to have cloned an empty repository.
# Subtest: finding the slug registers the plan directory once
ok 605 - finding the slug registers the plan directory once
  ---
  duration_ms: 183.611681
  type: 'test'
  ...
# Subtest: an archived thread whose worktree is gone is not searched for a slug
ok 606 - an archived thread whose worktree is gone is not searched for a slug
  ---
  duration_ms: 17.160199
  type: 'test'
  ...
# warning: You appear to have cloned an empty repository.
# Subtest: an archived thread whose worktree the archive left behind is still searched
ok 607 - an archived thread whose worktree the archive left behind is still searched
  ---
  duration_ms: 147.935882
  type: 'test'
  ...
# warning: You appear to have cloned an empty repository.
# Subtest: target PR threads never discover a local plan
ok 608 - target PR threads never discover a local plan
  ---
  duration_ms: 116.344259
  type: 'test'
  ...
# Subtest: open permit appears in Needs you with its PR number
ok 609 - open permit appears in Needs you with its PR number
  ---
  duration_ms: 0.911519
  type: 'test'
  ...
# Subtest: thread snapshots track external and internal changes and are frozen
ok 610 - thread snapshots track external and internal changes and are frozen
  ---
  duration_ms: 2322.24055
  type: 'test'
  ...
# Subtest: recent rewrites are reread and settled files reuse their cached record
ok 611 - recent rewrites are reread and settled files reuse their cached record
  ---
  duration_ms: 2235.738264
  type: 'test'
  ...
# Subtest: list matches the captured response without rereading unchanged files
ok 612 - list matches the captured response without rereading unchanged files
  ---
  duration_ms: 2246.888691
  type: 'test'
  ...
# Subtest: slug discovery is read-only and missing or already present slugs return null
ok 613 - slug discovery is read-only and missing or already present slugs return null
  ---
  duration_ms: 0.310736
  type: 'test'
  ...
# Subtest: legacy provider migration is persisted by list and chat
ok 614 - legacy provider migration is persisted by list and chat
  ---
  duration_ms: 2296.023602
  type: 'test'
  ...
# Subtest: chat reuses thread and parent snapshots under the lock
ok 615 - chat reuses thread and parent snapshots under the lock
  ---
  duration_ms: 4443.339424
  type: 'test'
  ...
# Subtest: list joins all locks at once and overlays the fresh record on the listing
ok 616 - list joins all locks at once and overlays the fresh record on the listing
  ---
  duration_ms: 2258.974408
  type: 'test'
  ...
# Subtest: discovery is read-only and the list saves and returns a discovered slug
ok 617 - discovery is read-only and the list saves and returns a discovered slug
  ---
  duration_ms: 2456.56952
  type: 'test'
  ...
# Subtest: a save finishing during listing appears after joining the thread lock
ok 618 - a save finishing during listing appears after joining the thread lock
  ---
  duration_ms: 2236.165334
  type: 'test'
  ...
# Subtest: a failed queued operation reaches its caller and leaves the process running
ok 619 - a failed queued operation reaches its caller and leaves the process running
  ---
  duration_ms: 169.752845
  type: 'test'
  ...
# Subtest: approval warnings are optional machine-only bounded non-empty strings
ok 620 - approval warnings are optional machine-only bounded non-empty strings
  ---
  duration_ms: 4.45687
  type: 'test'
  ...
# Subtest: the hub stores machine approval warnings
ok 621 - the hub stores machine approval warnings
  ---
  duration_ms: 739.059432
  type: 'test'
  ...
# Subtest: sudo validation: the agent sends only command, does and why
ok 622 - sudo validation: the agent sends only command, does and why
  ---
  duration_ms: 0.90176
  type: 'test'
  ...
# Subtest: sudo validation: agent-side role check refuses everyone but a lead
ok 623 - sudo validation: agent-side role check refuses everyone but a lead
  ---
  duration_ms: 0.284726
  type: 'test'
  ...
# Subtest: sudo validation: a machine-posted card needs the machine-added fields
ok 624 - sudo validation: a machine-posted card needs the machine-added fields
  ---
  duration_ms: 0.731994
  type: 'test'
  ...
# Subtest: the hub stores a lead sudo card as waiting and indexes its request_id
ok 625 - the hub stores a lead sudo card as waiting and indexes its request_id
  ---
  duration_ms: 706.020961
  type: 'test'
  ...
# Subtest: the hub refuses a sudo card from a non-lead, without machine fields, or for a repeat request
ok 626 - the hub refuses a sudo card from a non-lead, without machine fields, or for a repeat request
  ---
  duration_ms: 1181.999749
  type: 'test'
  ...
# Subtest: a redelivered sudo card with the same delivery_id answers 200 and makes no second card
ok 627 - a redelivered sudo card with the same delivery_id answers 200 and makes no second card
  ---
  duration_ms: 1104.648218
  type: 'test'
  ...
# Subtest: sudo-outcome: unknown request is 409, a bad body 400, and the machine secret is required
ok 628 - sudo-outcome: unknown request is 409, a bad body 400, and the machine secret is required
  ---
  duration_ms: 1192.601629
  type: 'test'
  ...
# Subtest: sudo-outcome ran: sets the result and tells the lead once, with the output
ok 629 - sudo-outcome ran: sets the result and tells the lead once, with the output
  ---
  duration_ms: 1715.390596
  type: 'test'
  ...
# Subtest: sudo-outcome: each terminal state reaches the lead with its exact text
ok 630 - sudo-outcome: each terminal state reaches the lead with its exact text
  ---
  duration_ms: 4064.593851
  type: 'test'
  ...
# Subtest: sudo-outcome waiting is ignored and a card never moves back
ok 631 - sudo-outcome waiting is ignored and a card never moves back
  ---
  duration_ms: 1207.901726
  type: 'test'
  ...
# Subtest: Talk about it tells the lead and leaves the card waiting and unanswered
ok 632 - Talk about it tells the lead and leaves the card waiting and unanswered
  ---
  duration_ms: 1370.712734
  type: 'test'
  ...
# Subtest: Decline: the machine answers declined, the card closes and the lead hears it once
ok 633 - Decline: the machine answers declined, the card closes and the lead hears it once
  ---
  duration_ms: 1281.132376
  type: 'test'
  ...
# Subtest: Decline that lost the race shows the run result, not declined
ok 634 - Decline that lost the race shows the run result, not declined
  ---
  duration_ms: 1316.012152
  type: 'test'
  ...
# Subtest: Decline answered with running keeps the card running and tells nobody yet
ok 635 - Decline answered with running keeps the card running and tells nobody yet
  ---
  duration_ms: 1163.124632
  type: 'test'
  ...
# Subtest: Decline with an unreachable or refusing machine saves nothing and says so
ok 636 - Decline with an unreachable or refusing machine saves nothing and says so
  ---
  duration_ms: 4452.537481
  type: 'test'
  ...
# Subtest: Decline with a machine that never answers gives up after the limit and saves nothing
ok 637 - Decline with a machine that never answers gives up after the limit and saves nothing
  ---
  duration_ms: 1407.919641
  type: 'test'
  ...
# Subtest: a press on a sudo card other than talk or decline is refused
ok 638 - a press on a sudo card other than talk or decline is refused
  ---
  duration_ms: 1222.145699
  type: 'test'
  ...
# Subtest: the chat bubble for a sudo result keeps only its first line
ok 639 - the chat bubble for a sudo result keeps only its first line
  ---
  duration_ms: 0.750018
  type: 'test'
  ...
# Subtest: retracting a waiting sudo cancels without deadlock or a lead message
ok 640 - retracting a waiting sudo cancels without deadlock or a lead message
  ---
  duration_ms: 1092.158153
  type: 'test'
  ...
# Subtest: sudo retraction refusal preserves the card and later outcomes are delivered
ok 641 - sudo retraction refusal preserves the card and later outcomes are delivered
  ---
  duration_ms: 3907.848714
  type: 'test'
  ...
# Subtest: claude switches and carries on before held messages
ok 642 - claude switches and carries on before held messages
  ---
  duration_ms: 147.779743
  type: 'test'
  ...
# Subtest: gpt switches and carries on before held messages
ok 643 - gpt switches and carries on before held messages
  ---
  duration_ms: 73.005019
  type: 'test'
  ...
# Subtest: no alternate and other providers retain the limit hold
ok 644 - no alternate and other providers retain the limit hold
  ---
  duration_ms: 82.90497
  type: 'test'
  ...
# Subtest: gpt worker does not report a limited turn to its starter
ok 645 - gpt worker does not report a limited turn to its starter
  ---
  duration_ms: 74.529443
  type: 'test'
  ...
# Subtest: claude worker does not report a limited turn to its starter
ok 646 - claude worker does not report a limited turn to its starter
  ---
  duration_ms: 51.146326
  type: 'test'
  ...
# Subtest: gpt reviewer does not report a limited turn to its starter
ok 647 - gpt reviewer does not report a limited turn to its starter
  ---
  duration_ms: 72.899557
  type: 'test'
  ...
# Subtest: gemini holds even with another signed-in account
ok 648 - gemini holds even with another signed-in account
  ---
  duration_ms: 17.925296
  type: 'test'
  ...
# Subtest: quiet sweep holds reminders during a switch and sends them afterward
ok 649 - quiet sweep holds reminders during a switch and sends them afterward
  ---
  duration_ms: 40.828563
  type: 'test'
  ...
# Subtest: matching failures restore hold and unrelated callbacks are ignored
ok 650 - matching failures restore hold and unrelated callbacks are ignored
  ---
  duration_ms: 61.922148
  type: 'test'
  ...
# Subtest: selector respects reserve and preflight retry
ok 651 - selector respects reserve and preflight retry
  ---
  duration_ms: 23.479822
  type: 'test'
  ...
# Subtest: refused and unreachable switch requests restore the old hold
ok 652 - refused and unreachable switch requests restore the old hold
  ---
  duration_ms: 4088.224781
  type: 'test'
  ...
# Subtest: lead reserve holds a worker back
ok 653 - lead reserve holds a worker back
  ---
  duration_ms: 63.83621
  type: 'test'
  ...
# Subtest: the list view keeps the summary and drops the history
ok 654 - the list view keeps the summary and drops the history
  ---
  duration_ms: 699.751775
  type: 'test'
  ...
# Subtest: the list view marks a thread whose lead posted a done card
ok 655 - the list view marks a thread whose lead posted a done card
  ---
  duration_ms: 1028.842261
  type: 'test'
  ...
# Subtest: the list view gives a quick fix its stage from the pinned progress line
ok 656 - the list view gives a quick fix its stage from the pinned progress line
  ---
  duration_ms: 1480.855862
  type: 'test'
  ...
# Subtest: the list view leaves a planned thread to its plan, even with a progress line
ok 657 - the list view leaves a planned thread to its plan, even with a progress line
  ---
  duration_ms: 1279.513024
  type: 'test'
  ...
# Subtest: tools.js defines WHEELCHAIR_TOOLS: five tools in registry order, no install field
ok 658 - tools.js defines WHEELCHAIR_TOOLS: five tools in registry order, no install field
  ---
  duration_ms: 240.392495
  type: 'test'
  ...
# Subtest: try routes forward recorded identity, preserve fields, allow archive and enrich status
ok 659 - try routes forward recorded identity, preserve fields, allow archive and enrich status
  ---
  duration_ms: 557.718064
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-1ad64c904f28.slice
# machine service listening on 127.0.0.1:39311
# machine: screen teardown failed: wcscreen-1ad64c904f28-62f8019aa5f6.slice
# Subtest: archive through the hub cancels a stalled upload to the real machine
ok 660 - archive through the hub cancels a stalled upload to the real machine
  ---
  duration_ms: 13107.1146
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-7b07f1efecf3.slice
# machine service listening on 127.0.0.1:42839
# Subtest: a lead still waiting takes uploads on the real machine
ok 661 - a lead still waiting takes uploads on the real machine
  ---
  duration_ms: 7248.045571
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-250465bb81f7.slice
# machine service listening on 127.0.0.1:39191
# Subtest: a lead still starting takes uploads on the real machine
ok 662 - a lead still starting takes uploads on the real machine
  ---
  duration_ms: 6366.477607
  type: 'test'
  ...
# Subtest: account normalization and balancing settings survive round trip
ok 663 - account normalization and balancing settings survive round trip
  ---
  duration_ms: 14.076795
  type: 'test'
  ...
# Subtest: effective windows, room and forecasts
ok 664 - effective windows, room and forecasts
  ---
  duration_ms: 9.174801
  type: 'test'
  ...
# Subtest: ranking and unknown transcript
ok 665 - ranking and unknown transcript
  ---
  duration_ms: 4.296442
  type: 'test'
  ...
# Subtest: Ready accepts a second signed-in account and old service status
ok 666 - Ready accepts a second signed-in account and old service status
  ---
  duration_ms: 11.960184
  type: 'test'
  ...
# Subtest: account and balancing routes and usage shape
ok 667 - account and balancing routes and usage shape
  ---
  duration_ms: 1025.708776
  type: 'test'
  ...
# Subtest: normalization supplies defaults and all plan weights
ok 668 - normalization supplies defaults and all plan weights
  ---
  duration_ms: 8.011739
  type: 'test'
  ...
# Subtest: room boundaries, windows, forecast and margin
ok 669 - room boundaries, windows, forecast and margin
  ---
  duration_ms: 0.564953
  type: 'test'
  ...
# Subtest: rank chooses by reset, weighted room, live sessions and last choice and explains skips
ok 670 - rank chooses by reset, weighted room, live sessions and last choice and explains skips
  ---
  duration_ms: 77.866254
  type: 'test'
  ...
# Subtest: record serializes readings and chosen accounts
ok 671 - record serializes readings and chosen accounts
  ---
  duration_ms: 38.672046
  type: 'test'
  ...
# Subtest: Ready rejects paused accounts and preserves old Codex preflight
ok 672 - Ready rejects paused accounts and preserves old Codex preflight
  ---
  duration_ms: 1.659524
  type: 'test'
  ...
# Subtest: account route assigns unique slugs and resets weight on plan change
ok 673 - account route assigns unique slugs and resets weight on plan change
  ---
  duration_ms: 470.548751
  type: 'test'
  ...
# Subtest: usage endpoints expose machine state, sessions and alert weeks
ok 674 - usage endpoints expose machine state, sessions and alert weeks
  ---
  duration_ms: 516.096074
  type: 'test'
  ...
# Subtest: sign-in proxies forward the account, machine path and payload
ok 675 - sign-in proxies forward the account, machine path and payload
  ---
  duration_ms: 506.217354
  type: 'test'
  ...
# Subtest: removing an account leaves its live session intact and removes it from settings and usage
ok 676 - removing an account leaves its live session intact and removes it from settings and usage
  ---
  duration_ms: 841.474246
  type: 'test'
  ...
# Subtest: newer ordinary readings preserve a future limit until it expires
ok 677 - newer ordinary readings preserve a future limit until it expires
  ---
  duration_ms: 1852.779567
  type: 'test'
  ...
# Subtest: removed account ids are retired and do not inherit usage or sessions
ok 678 - removed account ids are retired and do not inherit usage or sessions
  ---
  duration_ms: 1197.455186
  type: 'test'
  ...
# Subtest: alerts are acknowledged per provider and local ISO week
ok 679 - alerts are acknowledged per provider and local ISO week
  ---
  duration_ms: 100.611615
  type: 'test'
  ...
# Subtest: legacy reserve value is carried over from the saved settings file
ok 680 - legacy reserve value is carried over from the saved settings file
  ---
  duration_ms: 29.20224
  type: 'test'
  ...
# Subtest: a default account can be removed, stays removed, and can be added back
ok 681 - a default account can be removed, stays removed, and can be added back
  ---
  duration_ms: 830.086602
  type: 'test'
  ...
# Subtest: idle poll probes eligible accounts in order and records the selected machine
ok 682 - idle poll probes eligible accounts in order and records the selected machine
  ---
  duration_ms: 318.092743
  type: 'test'
  ...
# Subtest: idle poll stores default and named Kimi account readings
ok 683 - idle poll stores default and named Kimi account readings
  ---
  duration_ms: 338.059976
  type: 'test'
  ...
# Subtest: idle poll stores a Kimi reading while its session is live
ok 684 - idle poll stores a Kimi reading while its session is live
  ---
  duration_ms: 277.522065
  type: 'test'
  ...
# Subtest: idle poll tries another machine when a Kimi probe fails
ok 685 - idle poll tries another machine when a Kimi probe fails
  ---
  duration_ms: 266.948952
  type: 'test'
  ...
# Subtest: idle poll skips a live Claude account
ok 686 - idle poll skips a live Claude account
  ---
  duration_ms: 286.36093
  type: 'test'
  ...
# Subtest: idle poll drops a reading when the account becomes live
ok 687 - idle poll drops a reading when the account becomes live
  ---
  duration_ms: 327.566385
  type: 'test'
  ...
# Subtest: idle poll keeps stored usage on failure and throttles retries
ok 688 - idle poll keeps stored usage on failure and throttles retries
  ---
  duration_ms: 316.866499
  type: 'test'
  ...
# Subtest: overlapping idle polls share one run
ok 689 - overlapping idle polls share one run
  ---
  duration_ms: 457.1257
  type: 'test'
  ...
# Subtest: idle poll skips readings less than nine minutes old
ok 690 - idle poll skips readings less than nine minutes old
  ---
  duration_ms: 351.925192
  type: 'test'
  ...
# Subtest: idle poll rechecks later accounts before probing
ok 691 - idle poll rechecks later accounts before probing
  ---
  duration_ms: 365.817973
  type: 'test'
  ...
# Subtest: a newer live reading survives an idle probe after the session ends
ok 692 - a newer live reading survives an idle probe after the session ends
  ---
  duration_ms: 467.39627
  type: 'test'
  ...
# Subtest: idle poll drops a removed account result
ok 693 - idle poll drops a removed account result
  ---
  duration_ms: 523.24781
  type: 'test'
  ...
# Subtest: idle poll promotes a waiting start when usage frees room
ok 694 - idle poll promotes a waiting start when usage frees room
  ---
  duration_ms: 4074.864828
  type: 'test'
  ...
# Subtest: a reported GPT plan sets the account plan and weight unless the weight was typed in
ok 695 - a reported GPT plan sets the account plan and weight unless the weight was typed in
  ---
  duration_ms: 33.212702
  type: 'test'
  ...
# Subtest: assistant messages and presses retain attribution after style stripping
ok 696 - assistant messages and presses retain attribution after style stripping
  ---
  duration_ms: 21.257639
  type: 'test'
  ...
# Subtest: restart context identifies the assistant and handles malformed state
ok 697 - restart context identifies the assistant and handles malformed state
  ---
  duration_ms: 0.676969
  type: 'test'
  ...
# Subtest: ordinary messages and presses stay unchanged
ok 698 - ordinary messages and presses stay unchanged
  ---
  duration_ms: 0.336716
  type: 'test'
  ...
# Subtest: assistant lifecycle, visibility, refusals and fresh context
ok 699 - assistant lifecycle, visibility, refusals and fresh context
  ---
  duration_ms: 3723.785237
  type: 'test'
  ...
# Subtest: account switching sends assistant identity without a project
ok 700 - account switching sends assistant identity without a project
  ---
  duration_ms: 255.364351
  type: 'test'
  ...
# Subtest: assistant actions authenticate, list, send, press, restart and archive
ok 701 - assistant actions authenticate, list, send, press, restart and archive
  ---
  duration_ms: 3897.108333
  type: 'test'
  ...
# Subtest: assistant command retries reads but not writes and reports failures as JSON
ok 702 - assistant command retries reads but not writes and reports failures as JSON
  ---
  duration_ms: 1474.721196
  type: 'test'
  ...
# Subtest: browser thread creation ignores the private assistant title
ok 703 - browser thread creation ignores the private assistant title
  ---
  duration_ms: 1375.299099
  type: 'test'
  ...
# Subtest: threads lists both registered machines and includes archives only on request
ok 704 - threads lists both registered machines and includes archives only on request
  ---
  duration_ms: 2975.129821
  type: 'test'
  ...
# Subtest: start reports the saved thread and URL when lead launch fails
ok 705 - start reports the saved thread and URL when lead launch fails
  ---
  duration_ms: 2516.023106
  type: 'test'
  ...
# Subtest: assistant press attribution is cleared by a later browser press on the same idea
ok 706 - assistant press attribution is cleared by a later browser press on the same idea
  ---
  duration_ms: 2134.076105
  type: 'test'
  ...
# Subtest: approval recheck refreshes Ready without attributing an answer
ok 707 - approval recheck refreshes Ready without attributing an answer
  ---
  duration_ms: 2140.484324
  type: 'test'
  ...
# Subtest: press and archive results do not expose session tokens
ok 708 - press and archive results do not expose session tokens
  ---
  duration_ms: 1757.975746
  type: 'test'
  ...
# Subtest: message and restart refuse archived threads and restart refuses handed-off threads
ok 709 - message and restart refuse archived threads and restart refuses handed-off threads
  ---
  duration_ms: 1669.865169
  type: 'test'
  ...
# Subtest: every assistant action refuses the assistant thread as a target
ok 710 - every assistant action refuses the assistant thread as a target
  ---
  duration_ms: 1420.894498
  type: 'test'
  ...
# Subtest: assistant CLI sends the contents of message and text files
ok 711 - assistant CLI sends the contents of message and text files
  ---
  duration_ms: 297.562394
  type: 'test'
  ...
# Subtest: the thread guard reads without writing, so it cannot overwrite a concurrent change
ok 712 - the thread guard reads without writing, so it cannot overwrite a concurrent change
  ---
  duration_ms: 23.599821
  type: 'test'
  ...
# Subtest: assistant reads omit aside conversations
ok 713 - assistant reads omit aside conversations
  ---
  duration_ms: 1800.972971
  type: 'test'
  ...
# Subtest: assistant reads refresh local plan status like features
ok 714 - assistant reads refresh local plan status like features
  ---
  duration_ms: 1310.246784
  type: 'test'
  ...
# Subtest: assistant recent filters before applying the 30 item limit
ok 715 - assistant recent filters before applying the 30 item limit
  ---
  duration_ms: 2.405103
  type: 'test'
  ...
# Subtest: restart starts a fresh assistant after first preflight fails
ok 716 - restart starts a fresh assistant after first preflight fails
  ---
  duration_ms: 745.048064
  type: 'test'
  ...
# Subtest: assistant actions exclude and refuse project lead threads
ok 717 - assistant actions exclude and refuse project lead threads
  ---
  duration_ms: 744.95355
  type: 'test'
  ...
# Subtest: background normalization retains current harness, onboarding, lessons and merge preferences
ok 718 - background normalization retains current harness, onboarding, lessons and merge preferences
  ---
  duration_ms: 4.161563
  type: 'test'
  ...
# Subtest: GIF loop variants preserve frames, control blocks and empty comments
ok 719 - GIF loop variants preserve frames, control blocks and empty comments
  ---
  duration_ms: 2.454138
  type: 'test'
  ...
# Subtest: containers reject malformed dimensions, payload, signatures and mismatches
ok 720 - containers reject malformed dimensions, payload, signatures and mismatches
  ---
  duration_ms: 1.57391
  type: 'test'
  ...
# Subtest: API saves and serves all formats, validates metadata and preserves unrelated settings
ok 721 - API saves and serves all formats, validates metadata and preserves unrelated settings
  ---
  duration_ms: 1399.657887
  type: 'test'
  ...
# Subtest: authentication, origin and bounded declared and streamed bodies
ok 722 - authentication, origin and bounded declared and streamed bodies
  ---
  duration_ms: 688.722456
  type: 'test'
  ...
# Subtest: concurrent uploads and slow upload recheck revision after reading
ok 723 - concurrent uploads and slow upload recheck revision after reading
  ---
  duration_ms: 450.858783
  type: 'test'
  ...
# Background cleanup failed: injected cleanup failure
# Subtest: failed metadata commit preserves old file; cleanup failure is retried after commit
ok 724 - failed metadata commit preserves old file; cleanup failure is retried after commit
  ---
  duration_ms: 120.13099
  type: 'test'
  ...
# Subtest: format validation and animated GIF loop normalization
ok 725 - format validation and animated GIF loop normalization
  ---
  duration_ms: 4.359983
  type: 'test'
  ...
# Subtest: authenticated background saves, conflict, reset and restart
ok 726 - authenticated background saves, conflict, reset and restart
  ---
  duration_ms: 1112.818644
  type: 'test'
  ...
# Subtest: card CLI prints only a receipt for delivered and spooled cards and instructions
ok 727 - card CLI prints only a receipt for delivered and spooled cards and instructions
  ---
  duration_ms: 2646.993432
  type: 'test'
  ...
# Subtest: idle probes all and only supported tools, including live Kimi
ok 728 - idle probes all and only supported tools, including live Kimi
  ---
  duration_ms: 254.24759
  type: 'test'
  ...
# Subtest: usage displays forecasts, spend, problems and warnings by provider
ok 729 - usage displays forecasts, spend, problems and warnings by provider
  ---
  duration_ms: 126.00555
  type: 'test'
  ...
# Subtest: settings preserve provider plans, scout wording, review fallback and discovery
ok 730 - settings preserve provider plans, scout wording, review fallback and discovery
  ---
  duration_ms: 15.100678
  type: 'test'
  ...
# Subtest: model routes validate each provider, aliases, efforts and review choices
ok 731 - model routes validate each provider, aliases, efforts and review choices
  ---
  duration_ms: 4486.594108
  type: 'test'
  ...
# Subtest: aside fork chooses each supported parent and rejects unsupported providers
ok 732 - aside fork chooses each supported parent and rejects unsupported providers
  ---
  duration_ms: 8.623452
  type: 'test'
  ...
# Subtest: chat selects distinct report and transcript formats for every CLI
ok 733 - chat selects distinct report and transcript formats for every CLI
  ---
  duration_ms: 18.685144
  type: 'test'
  ...
# Subtest: session limit switching and persisted harness ids vary by provider
ok 734 - session limit switching and persisted harness ids vary by provider
  ---
  duration_ms: 213.99489
  type: 'test'
  ...
# Subtest: worker effort ceilings apply to every provider with effort
ok 735 - worker effort ceilings apply to every provider with effort
  ---
  duration_ms: 8485.21111
  type: 'test'
  ...
# Subtest: session model resolution uses provider cells and tier aliases
ok 736 - session model resolution uses provider cells and tier aliases
  ---
  duration_ms: 1071.029414
  type: 'test'
  ...
# Subtest: switch placement runs preflight only for GPT
ok 737 - switch placement runs preflight only for GPT
  ---
  duration_ms: 109.577821
  type: 'test'
  ...
# Subtest: readiness uses each CLI login and reserves preflight for Codex
ok 738 - readiness uses each CLI login and reserves preflight for Codex
  ---
  duration_ms: 27.695429
  type: 'test'
  ...
# Subtest: fresh and migrated placement orders preserve exclusions and add unseen families
ok 739 - fresh and migrated placement orders preserve exclusions and add unseen families
  ---
  duration_ms: 24.869618
  type: 'test'
  ...
# Subtest: HTML download places policy after leading doctype and removes refresh tags
ok 740 - HTML download places policy after leading doctype and removes refresh tags
  ---
  duration_ms: 3.175923
  type: 'test'
  ...
# Subtest: sign-in hint uses the account tool prompt
ok 741 - sign-in hint uses the account tool prompt
  ---
  duration_ms: 3.755464
  type: 'test'
  ...
# Subtest: the token lasts across a restart, rotates only explicitly, and whoami proves a nonce
ok 742 - the token lasts across a restart, rotates only explicitly, and whoami proves a nonce
  ---
  duration_ms: 878.89288
  type: 'test'
  ...
# Subtest: a stale .server never blocks listen and a live server repairs a deleted record before whoami
ok 743 - a stale .server never blocks listen and a live server repairs a deleted record before whoami
  ---
  duration_ms: 362.20775
  type: 'test'
  ...
# Subtest: stop treats a refused connection as no viewer even when stale information remains
ok 744 - stop treats a refused connection as no viewer even when stale information remains
  ---
  duration_ms: 139.403591
  type: 'test'
  ...
# Subtest: serving origin is accepted for PUT and drives the bookmark URL
ok 745 - serving origin is accepted for PUT and drives the bookmark URL
  ---
  duration_ms: 414.74903
  type: 'test'
  ...
# Subtest: two simultaneous first starts end with one .token
ok 746 - two simultaneous first starts end with one .token
  ---
  duration_ms: 354.403047
  type: 'test'
  ...
# Subtest: simultaneous delayed listeners elect one server and print one token
ok 747 - simultaneous delayed listeners elect one server and print one token
  ---
  duration_ms: 711.388328
  type: 'test'
  ...
# Subtest: SIGKILL leaves stale .server and the next start listens immediately
ok 748 - SIGKILL leaves stale .server and the next start listens immediately
  ---
  duration_ms: 432.399528
  type: 'test'
  ...
# Subtest: a plain foreign listener makes --open refuse without signalling it
ok 749 - a plain foreign listener makes --open refuse without signalling it
  ---
  duration_ms: 2245.001521
  type: 'test'
  ...
# Subtest: a copied start id with a made-up pid and no proof is foreign
ok 750 - a copied start id with a made-up pid and no proof is foreign
  ---
  duration_ms: 289.196348
  type: 'test'
  ...
# Subtest: /whoami supplies pid and code, and proof only for a nonce
ok 751 - /whoami supplies pid and code, and proof only for a nonce
  ---
  duration_ms: 284.611822
  type: 'test'
  ...
# Subtest: stopping refuses a mismatched .server pid
ok 752 - stopping refuses a mismatched .server pid
  ---
  duration_ms: 445.724096
  type: 'test'
  ...
# Subtest: --stop exits 1 against a foreign listener
ok 753 - --stop exits 1 against a foreign listener
  ---
  duration_ms: 2191.591654
  type: 'test'
  ...
# Subtest: --stop waits five seconds then fails when the server ignores SIGTERM
ok 754 - --stop waits five seconds then fails when the server ignores SIGTERM
  ---
  duration_ms: 7166.894866
  type: 'test'
  ...
# Subtest: --stop --if-stale keeps current code and stops a changed server copy
ok 755 - --stop --if-stale keeps current code and stops a changed server copy
  ---
  duration_ms: 724.282886
  type: 'test'
  ...
# Subtest: an older server is stopped only by --stop and every other command gives the upgrade message
ok 756 - an older server is stopped only by --stop and every other command gives the upgrade message
  ---
  duration_ms: 992.287471
  type: 'test'
  ...
# Subtest: a proof-valid pre-prefix holder is stopped only by stop and every other command reports the upgrade
ok 757 - a proof-valid pre-prefix holder is stopped only by stop and every other command reports the upgrade
  ---
  duration_ms: 1364.268398
  type: 'test'
  ...
# Subtest: a no-proof pre-prefix holder stops only with its matching server start id and open refuses it
ok 758 - a no-proof pre-prefix holder stops only with its matching server start id and open refuses it
  ---
  duration_ms: 699.665037
  type: 'test'
  ...
# Subtest: a proof-valid pre-prefix holder without a pid is not ours and open does not signal it
ok 759 - a proof-valid pre-prefix holder without a pid is not ours and open does not signal it
  ---
  duration_ms: 283.190986
  type: 'test'
  ...
# Subtest: --service takes over an open server without changing port or token
ok 760 - --service takes over an open server without changing port or token
  ---
  duration_ms: 502.970222
  type: 'test'
  ...
# Subtest: --service gives up after three takeovers
ok 761 - --service gives up after three takeovers
  ---
  duration_ms: 1336.282473
  type: 'test'
  ...
# Subtest: a post-bind .server rename failure rolls back listener and record
ok 762 - a post-bind .server rename failure rolls back listener and record
  ---
  duration_ms: 119.571801
  type: 'test'
  ...
# Subtest: --open waits a closing server out and succeeds
ok 763 - --open waits a closing server out and succeeds
  ---
  duration_ms: 247.084102
  type: 'test'
  ...
# Subtest: only localhost and served origins write, and serve false prints localhost
ok 764 - only localhost and served origins write, and serve false prints localhost
  ---
  duration_ms: 267.383232
  type: 'test'
  ...
# Subtest: --url never listens and reports the running token after a timed-out rotation
ok 765 - --url never listens and reports the running token after a timed-out rotation
  ---
  duration_ms: 7365.753378
  type: 'test'
  ...
# Subtest: --rotate-token refuses an old-version holder and leaves it running
ok 766 - --rotate-token refuses an old-version holder and leaves it running
  ---
  duration_ms: 74.325724
  type: 'test'
  ...
# Subtest: --register-plan retries a silent holder until it registers through it
ok 767 - --register-plan retries a silent holder until it registers through it
  ---
  duration_ms: 686.278297
  type: 'test'
  ...
# Subtest: --rotate-token waits for shutdown and leaves .server removal to the server
ok 768 - --rotate-token waits for shutdown and leaves .server removal to the server
  ---
  duration_ms: 214.583774
  type: 'test'
  ...
# Subtest: --rotate-token prints the new prefixed bookmark for a current server
ok 769 - --rotate-token prints the new prefixed bookmark for a current server
  ---
  duration_ms: 206.035835
  type: 'test'
  ...
# Subtest: shutdown releases the port before it removes only its own .server record
ok 770 - shutdown releases the port before it removes only its own .server record
  ---
  duration_ms: 86.673811
  type: 'test'
  ...
# Subtest: --stop leaves .server removal to the exiting server
ok 771 - --stop leaves .server removal to the exiting server
  ---
  duration_ms: 212.357251
  type: 'test'
  ...
# Subtest: a starter that loses the freed port registers through the new holder
ok 772 - a starter that loses the freed port registers through the new holder
  ---
  duration_ms: 599.57639
  type: 'test'
  ...
# Subtest: frontmatter, headings, tables and lists parse as the document page expects
ok 773 - frontmatter, headings, tables and lists parse as the document page expects
  ---
  duration_ms: 6.846965
  type: 'test'
  ...
# Subtest: minimal manifest can be read by the settings store
ok 774 - minimal manifest can be read by the settings store
  ---
  duration_ms: 19.633984
  type: 'test'
  ...
# Subtest: minimal manifest works in hub routes, assets and usage
ok 775 - minimal manifest works in hub routes, assets and usage
  ---
  duration_ms: 1794.329679
  type: 'test'
  ...
# Subtest: model choices preserve the current lists and pins
ok 776 - model choices preserve the current lists and pins
  ---
  duration_ms: 6.482525
  type: 'test'
  ...
# Subtest: model choices include a sixth manifest
ok 777 - model choices include a sixth manifest
  ---
  duration_ms: 0.794885
  type: 'test'
  ...
# Subtest: a semicolon key reaches the pane only as backslash-semicolon
ok 778 - a semicolon key reaches the pane only as backslash-semicolon
  ---
  duration_ms: 812.932213
  type: 'test'
  ...
# Subtest: the sessions response marks the hub entry whatever name it is registered under
ok 779 - the sessions response marks the hub entry whatever name it is registered under
  ---
  duration_ms: 599.045119
  type: 'test'
  ...
# Subtest: poll stops for clean with a passed check
ok 780 - poll stops for clean with a passed check
  ---
  duration_ms: 222.886106
  type: 'test'
  ...
# Subtest: poll stops for dirty
ok 781 - poll stops for dirty
  ---
  duration_ms: 99.950207
  type: 'test'
  ...
# Subtest: poll stops for changed head
ok 782 - poll stops for changed head
  ---
  duration_ms: 103.639453
  type: 'test'
  ...
# Subtest: poll stops for merged
ok 783 - poll stops for merged
  ---
  duration_ms: 105.622778
  type: 'test'
  ...
# Subtest: poll stops for failed check under unstable
ok 784 - poll stops for failed check under unstable
  ---
  duration_ms: 109.407658
  type: 'test'
  ...
# Subtest: concurrent opens share a record across the hub alias and hostname, with separate projects on a second machine
ok 785 - concurrent opens share a record across the hub alias and hostname, with separate projects on a second machine
  ---
  duration_ms: 707.616761
  type: 'test'
  ...
# Subtest: project status is read-only and requires a non-archived ordinary thread in the project
ok 786 - project status is read-only and requires a non-archived ordinary thread in the project
  ---
  duration_ms: 1001.90678
  type: 'test'
  ...
# Subtest: project lead start forces the sandbox and includes only the project role layers
ok 787 - project lead start forces the sandbox and includes only the project role layers
  ---
  duration_ms: 2182.283941
  type: 'test'
  ...
# Subtest: off stops sessions, hides records, and guards direct thread routes
ok 788 - off stops sessions, hides records, and guards direct thread routes
  ---
  duration_ms: 2469.749081
  type: 'test'
  ...
# Subtest: project lead sessions cannot use the machine session relay or receive cross-thread cards
ok 789 - project lead sessions cannot use the machine session relay or receive cross-thread cards
  ---
  duration_ms: 1437.293894
  type: 'test'
  ...
# Subtest: features and peer discovery exclude project leads but Needs you keeps their open questions
ok 790 - features and peer discovery exclude project leads but Needs you keeps their open questions
  ---
  duration_ms: 1348.662799
  type: 'test'
  ...
# Subtest: restart drops old card messages and renders the project lead fresh-context line
ok 791 - restart drops old card messages and renders the project lead fresh-context line
  ---
  duration_ms: 1755.380585
  type: 'test'
  ...
# Subtest: auto-merge ignores an otherwise eligible project lead record
ok 792 - auto-merge ignores an otherwise eligible project lead record
  ---
  duration_ms: 38.984423
  type: 'test'
  ...
# Subtest: the merged-PR poller calls GitHub only for ordinary threads
ok 793 - the merged-PR poller calls GitHub only for ordinary threads
  ---
  duration_ms: 105.588388
  type: 'test'
  ...
# Subtest: account switching keeps the project lead identity
ok 794 - account switching keeps the project lead identity
  ---
  duration_ms: 85.166414
  type: 'test'
  ...
# Subtest: opening a project lead starts it only on the first message
ok 795 - opening a project lead starts it only on the first message
  ---
  duration_ms: 1401.218623
  type: 'test'
  ...
# Subtest: failed starts retain queued messages in order and a later start carries them
ok 796 - failed starts retain queued messages in order and a later start carries them
  ---
  duration_ms: 2246.710364
  type: 'test'
  ...
# Subtest: concurrent first sends start only one lead and preserve order
ok 797 - concurrent first sends start only one lead and preserve order
  ---
  duration_ms: 1213.806271
  type: 'test'
  ...
# Subtest: a dead lead restarts on a message and turn ends deliver queued messages
ok 798 - a dead lead restarts on a message and turn ends deliver queued messages
  ---
  duration_ms: 1172.168504
  type: 'test'
  ...
# Subtest: off refuses messages and failed stops retry on machine contact only while off
ok 799 - off refuses messages and failed stops retry on machine contact only while off
  ---
  duration_ms: 1758.640239
  type: 'test'
  ...
# Subtest: ordinary threads still reject messages without a live lead
ok 800 - ordinary threads still reject messages without a live lead
  ---
  duration_ms: 266.576113
  type: 'test'
  ...
# Subtest: project lead actions enforce project scope and redact cross-project content
ok 801 - project lead actions enforce project scope and redact cross-project content
  ---
  duration_ms: 151.226431
  type: 'test'
  ...
# Subtest: project lead CLI sends files and retries reads only
ok 802 - project lead CLI sends files and retries reads only
  ---
  duration_ms: 1390.148265
  type: 'test'
  ...
# Subtest: refresh waits for a slow machine
ok 803 - refresh waits for a slow machine
  ---
  duration_ms: 6196.70041
  type: 'test'
  ...
# Subtest: outside titles do not erase local question text
ok 804 - outside titles do not erase local question text
  ---
  duration_ms: 41.804251
  type: 'test'
  ...
# Subtest: outside pull request URLs are removed from recent chat
ok 805 - outside pull request URLs are removed from recent chat
  ---
  duration_ms: 24.827496
  type: 'test'
  ...
# Subtest: outside PR URLs match whole URLs without hiding local PR prefixes
ok 806 - outside PR URLs match whole URLs without hiding local PR prefixes
  ---
  duration_ms: 38.773407
  type: 'test'
  ...
# Subtest: outside object target PR URLs are removed from thread details
ok 807 - outside object target PR URLs are removed from thread details
  ---
  duration_ms: 24.657578
  type: 'test'
  ...
# Subtest: the same path on another registered machine is outside the project
ok 808 - the same path on another registered machine is outside the project
  ---
  duration_ms: 40.337286
  type: 'test'
  ...
# Subtest: another project lead is refused as a target of every targeted action
ok 809 - another project lead is refused as a target of every targeted action
  ---
  duration_ms: 27.709965
  type: 'test'
  ...
# Subtest: closed reach and permit cards are absent from waiting and cards
ok 810 - closed reach and permit cards are absent from waiting and cards
  ---
  duration_ms: 26.361597
  type: 'test'
  ...
# Subtest: cross-thread messages and recent chat omit other project identifiers but keep titles
ok 811 - cross-thread messages and recent chat omit other project identifiers but keep titles
  ---
  duration_ms: 26.614774
  type: 'test'
  ...
# Subtest: short other-project titles do not redact same-project text
ok 812 - short other-project titles do not redact same-project text
  ---
  duration_ms: 21.942601
  type: 'test'
  ...
# Subtest: same-project text mentioning its project path remains in recent chat
ok 813 - same-project text mentioning its project path remains in recent chat
  ---
  duration_ms: 26.964384
  type: 'test'
  ...
# Subtest: every project lead action is refused when the setting is off
ok 814 - every project lead action is refused when the setting is off
  ---
  duration_ms: 22.285268
  type: 'test'
  ...
# Subtest: project lead CLI retries thread reads and does not retry writes
ok 815 - project lead CLI retries thread reads and does not retry writes
  ---
  duration_ms: 2330.025704
  type: 'test'
  ...
# Subtest: worker permits its own commands
ok 816 - worker permits its own commands
  ---
  duration_ms: 2.672186
  type: 'test'
  ...
# Subtest: mapper permits its own commands
ok 817 - mapper permits its own commands
  ---
  duration_ms: 0.488417
  type: 'test'
  ...
# Subtest: designer permits its own commands
ok 818 - designer permits its own commands
  ---
  duration_ms: 0.293613
  type: 'test'
  ...
# Subtest: sub-lead permits its own commands
ok 819 - sub-lead permits its own commands
  ---
  duration_ms: 0.442078
  type: 'test'
  ...
# Subtest: lead permits its own commands
ok 820 - lead permits its own commands
  ---
  duration_ms: 0.778494
  type: 'test'
  ...
# Subtest: cards permits its own commands
ok 821 - cards permits its own commands
  ---
  duration_ms: 0.404055
  type: 'test'
  ...
# Subtest: worker reports conflicts instead of stopping silently
ok 822 - worker reports conflicts instead of stopping silently
  ---
  duration_ms: 0.555044
  type: 'test'
  ...
# Subtest: mapper reports conflicts instead of stopping silently
ok 823 - mapper reports conflicts instead of stopping silently
  ---
  duration_ms: 0.275399
  type: 'test'
  ...
# Subtest: designer reports conflicts instead of stopping silently
ok 824 - designer reports conflicts instead of stopping silently
  ---
  duration_ms: 10.02438
  type: 'test'
  ...
# Subtest: sub-lead reports conflicts instead of stopping silently
ok 825 - sub-lead reports conflicts instead of stopping silently
  ---
  duration_ms: 1.067668
  type: 'test'
  ...
# Subtest: reviewer reports obstacles instead of stopping silently
ok 826 - reviewer reports obstacles instead of stopping silently
  ---
  duration_ms: 0.561978
  type: 'test'
  ...
# Subtest: verifier reports obstacles instead of stopping silently
ok 827 - verifier reports obstacles instead of stopping silently
  ---
  duration_ms: 0.306398
  type: 'test'
  ...
# Subtest: worker waits for background work in the foreground
ok 828 - worker waits for background work in the foreground
  ---
  duration_ms: 0.287582
  type: 'test'
  ...
# Subtest: mapper waits for background work in the foreground
ok 829 - mapper waits for background work in the foreground
  ---
  duration_ms: 0.423242
  type: 'test'
  ...
# Subtest: designer waits for background work in the foreground
ok 830 - designer waits for background work in the foreground
  ---
  duration_ms: 0.221515
  type: 'test'
  ...
# Subtest: sub-lead waits for background work in the foreground
ok 831 - sub-lead waits for background work in the foreground
  ---
  duration_ms: 0.467807
  type: 'test'
  ...
# Subtest: reviewer waits for background work in the foreground
ok 832 - reviewer waits for background work in the foreground
  ---
  duration_ms: 0.257655
  type: 'test'
  ...
# Subtest: verifier waits for background work in the foreground
ok 833 - verifier waits for background work in the foreground
  ---
  duration_ms: 0.195826
  type: 'test'
  ...
# Subtest: each schema kind has one card section, in its intended file
ok 834 - each schema kind has one card section, in its intended file
  ---
  duration_ms: 24.925474
  type: 'test'
  ...
# Subtest: lead has no obsolete read pointer
ok 835 - lead has no obsolete read pointer
  ---
  duration_ms: 0.754578
  type: 'test'
  ...
# Subtest: sub-lead has no obsolete read pointer
ok 836 - sub-lead has no obsolete read pointer
  ---
  duration_ms: 0.239139
  type: 'test'
  ...
# Subtest: worker has no obsolete read pointer
ok 837 - worker has no obsolete read pointer
  ---
  duration_ms: 0.172681
  type: 'test'
  ...
# Subtest: mapper has no obsolete read pointer
ok 838 - mapper has no obsolete read pointer
  ---
  duration_ms: 0.152232
  type: 'test'
  ...
# Subtest: designer has no obsolete read pointer
ok 839 - designer has no obsolete read pointer
  ---
  duration_ms: 0.148345
  type: 'test'
  ...
# Subtest: reviewer has no obsolete read pointer
ok 840 - reviewer has no obsolete read pointer
  ---
  duration_ms: 0.147022
  type: 'test'
  ...
# Subtest: verifier has no obsolete read pointer
ok 841 - verifier has no obsolete read pointer
  ---
  duration_ms: 0.40699
  type: 'test'
  ...
# Subtest: cards has no obsolete read pointer
ok 842 - cards has no obsolete read pointer
  ---
  duration_ms: 0.233278
  type: 'test'
  ...
# Subtest: lead has the direct pointer fallback
ok 843 - lead has the direct pointer fallback
  ---
  duration_ms: 0.896169
  type: 'test'
  ...
# Subtest: sub-lead has the direct pointer fallback
ok 844 - sub-lead has the direct pointer fallback
  ---
  duration_ms: 0.312941
  type: 'test'
  ...
# Subtest: worker has the direct pointer fallback
ok 845 - worker has the direct pointer fallback
  ---
  duration_ms: 0.184313
  type: 'test'
  ...
# Subtest: mapper has the direct pointer fallback
ok 846 - mapper has the direct pointer fallback
  ---
  duration_ms: 0.158484
  type: 'test'
  ...
# Subtest: designer has the direct pointer fallback
ok 847 - designer has the direct pointer fallback
  ---
  duration_ms: 0.152532
  type: 'test'
  ...
# Subtest: reviewer has the direct pointer fallback
ok 848 - reviewer has the direct pointer fallback
  ---
  duration_ms: 0.167572
  type: 'test'
  ...
# Subtest: verifier has the direct pointer fallback
ok 849 - verifier has the direct pointer fallback
  ---
  duration_ms: 0.226985
  type: 'test'
  ...
# Subtest: repo law paths are ordered and kept in one file
ok 850 - repo law paths are ordered and kept in one file
  ---
  duration_ms: 1.654133
  type: 'test'
  ...
# Subtest: verifier reports repo law gaps from the merge-base
ok 851 - verifier reports repo law gaps from the merge-base
  ---
  duration_ms: 0.361183
  type: 'test'
  ...
# Subtest: repo law breaks are always fixed and asides do not read it
ok 852 - repo law breaks are always fixed and asides do not read it
  ---
  duration_ms: 0.273395
  type: 'test'
  ...
# Subtest: sub-lead uses the binding sizing command and no-scout fallback
ok 853 - sub-lead uses the binding sizing command and no-scout fallback
  ---
  duration_ms: 0.528985
  type: 'test'
  ...
# Subtest: sub-lead briefs say role rules are in starting instructions
ok 854 - sub-lead briefs say role rules are in starting instructions
  ---
  duration_ms: 0.240582
  type: 'test'
  ...
# Subtest: worker preserves suite exit status
ok 855 - worker preserves suite exit status
  ---
  duration_ms: 0.204432
  type: 'test'
  ...
# Subtest: verifier preserves suite exit status
ok 856 - verifier preserves suite exit status
  ---
  duration_ms: 0.204683
  type: 'test'
  ...
# Subtest: lead finishing steps point to mergeability before done
ok 857 - lead finishing steps point to mergeability before done
  ---
  duration_ms: 3.345918
  type: 'test'
  ...
# Subtest: done card table lists the pushed head
ok 858 - done card table lists the pushed head
  ---
  duration_ms: 6.132143
  type: 'test'
  ...
# Subtest: lead.md has the Other leads on this machine section, as a standing rule
ok 859 - lead.md has the Other leads on this machine section, as a standing rule
  ---
  duration_ms: 0.914374
  type: 'test'
  ...
# Subtest: lead.md Overlap questions covers any project, earlier chat, finished check and re-ask
ok 860 - lead.md Overlap questions covers any project, earlier chat, finished check and re-ask
  ---
  duration_ms: 4.476337
  type: 'test'
  ...
# Subtest: lead.md Restarting what died resolves an unrecorded chat answer
ok 861 - lead.md Restarting what died resolves an unrecorded chat answer
  ---
  duration_ms: 0.884567
  type: 'test'
  ...
# Subtest: sub-lead posts screenshots as image cards
ok 862 - sub-lead posts screenshots as image cards
  ---
  duration_ms: 0.304925
  type: 'test'
  ...
# Subtest: open, show, and register-plan use the server registration writer
ok 863 - open, show, and register-plan use the server registration writer
  ---
  duration_ms: 1093.714837
  type: 'test'
  ...
# Subtest: register rejects unsigned, stale, foreign-origin, and out-of-scope paths
ok 864 - register rejects unsigned, stale, foreign-origin, and out-of-scope paths
  ---
  duration_ms: 493.418711
  type: 'test'
  ...
# Subtest: a refused POST /register leaves .registered and .plans byte-identical
ok 865 - a refused POST /register leaves .registered and .plans byte-identical
  ---
  duration_ms: 304.676955
  type: 'test'
  ...
# Subtest: commands reuse a proven server and register without exposing its token
ok 866 - commands reuse a proven server and register without exposing its token
  ---
  duration_ms: 1109.089304
  type: 'test'
  ...
# Subtest: --register-plan is best effort and never starts a server
ok 867 - --register-plan is best effort and never starts a server
  ---
  duration_ms: 2259.232922
  type: 'test'
  ...
# Subtest: --open records the caller tmux session, while a missing tmux records null
ok 868 - --open records the caller tmux session, while a missing tmux records null
  ---
  duration_ms: 703.606147
  type: 'test'
  ...
# Subtest: a failing tmux lookup records a null session
ok 869 - a failing tmux lookup records a null session
  ---
  duration_ms: 455.043218
  type: 'test'
  ...
# Subtest: twenty concurrent opens all land in the running server registry
ok 870 - twenty concurrent opens all land in the running server registry
  ---
  duration_ms: 910.878183
  type: 'test'
  ...
# Subtest: simultaneous first opens register their own paths and a later plan
ok 871 - simultaneous first opens register their own paths and a later plan
  ---
  duration_ms: 688.272167
  type: 'test'
  ...
# Subtest: a failed listener never changes either pre-existing list
ok 872 - a failed listener never changes either pre-existing list
  ---
  duration_ms: 2269.519824
  type: 'test'
  ...
# Subtest: a plan first graph creates its missing graphs directory and registers
ok 873 - a plan first graph creates its missing graphs directory and registers
  ---
  duration_ms: 276.485028
  type: 'test'
  ...
# Subtest: show signs watching without sending the token
ok 874 - show signs watching without sending the token
  ---
  duration_ms: 348.945647
  type: 'test'
  ...
# Subtest: a port thief after proof receives a signature but never the token
ok 875 - a port thief after proof receives a signature but never the token
  ---
  duration_ms: 684.834466
  type: 'test'
  ...
# Subtest: show overwrites open session and harness metadata with its own environment
ok 876 - show overwrites open session and harness metadata with its own environment
  ---
  duration_ms: 819.116096
  type: 'test'
  ...
# Subtest: open and show print token-free prefixed graph URLs, while show opens the token link and url prints the bookmark
ok 877 - open and show print token-free prefixed graph URLs, while show opens the token link and url prints the bookmark
  ---
  duration_ms: 873.983312
  type: 'test'
  ...
# Subtest: the nearest codex process wins over inherited CLAUDECODE and a claude ancestor
ok 878 - the nearest codex process wins over inherited CLAUDECODE and a claude ancestor
  ---
  duration_ms: 404.725897
  type: 'test'
  ...
# Subtest: registration rejects every out-of-scope plan and graph path before open reaches a port
ok 879 - registration rejects every out-of-scope plan and graph path before open reaches a port
  ---
  duration_ms: 348.428882
  type: 'test'
  ...
# Subtest: a registered graph replaced by an external symlink is refused on GET and PUT
ok 880 - a registered graph replaced by an external symlink is refused on GET and PUT
  ---
  duration_ms: 373.826492
  type: 'test'
  ...
# Subtest: register-plan has a two-second no-server grace and remains zero for bad paths
ok 881 - register-plan has a two-second no-server grace and remains zero for bad paths
  ---
  duration_ms: 2303.304724
  type: 'test'
  ...
# Subtest: pruning uses the newer graph mtime and added, and the newest plan markdown mtime
ok 882 - pruning uses the newer graph mtime and added, and the newest plan markdown mtime
  ---
  duration_ms: 286.952281
  type: 'test'
  ...
# Subtest: fresh accounts take unknown weight from the manifest
ok 883 - fresh accounts take unknown weight from the manifest
  ---
  duration_ms: 41.238507
  type: 'test'
  ...
# Subtest: a manifest without report takes hook text before reading the transcript
ok 884 - a manifest without report takes hook text before reading the transcript
  ---
  duration_ms: 8.032338
  type: 'test'
  ...
# Subtest: /list groups and orders opened graphs, marks ended sessions, quotes attach commands, and skips absent children
ok 885 - /list groups and orders opened graphs, marks ended sessions, quotes attach commands, and skips absent children
  ---
  duration_ms: 742.267796
  type: 'test'
  ...
# Subtest: /plan lists Markdown at every depth in byte order and refuses an unregistered directory
ok 886 - /plan lists Markdown at every depth in byte order and refuses an unregistered directory
  ---
  duration_ms: 462.22951
  type: 'test'
  ...
# Subtest: /doc returns 404 for non-Markdown files, parent paths, and a symlink leading outside its plan
ok 887 - /doc returns 404 for non-Markdown files, parent paths, and a symlink leading outside its plan
  ---
  duration_ms: 586.407398
  type: 'test'
  ...
# Subtest: /wheelchair/docs has CSP while a graph page keeps the index page header-free
ok 888 - /wheelchair/docs has CSP while a graph page keeps the index page header-free
  ---
  duration_ms: 473.622955
  type: 'test'
  ...
# Subtest: an app page carries font-src self and the font route serves only the allowlist
ok 889 - an app page carries font-src self and the font route serves only the allowlist
  ---
  duration_ms: 336.949146
  type: 'test'
  ...
# Subtest: /assets/doc.js needs no token and other asset names, including the removed list.js, are 404
ok 890 - /assets/doc.js needs no token and other asset names, including the removed list.js, are 404
  ---
  duration_ms: 343.934966
  type: 'test'
  ...
# Subtest: every other route requires a token while /whoami remains available
ok 891 - every other route requires a token while /whoami remains available
  ---
  duration_ms: 315.297309
  type: 'test'
  ...
# Subtest: a page changed on disk is served changed without restarting the server
ok 892 - a page changed on disk is served changed without restarting the server
  ---
  duration_ms: 328.69
  type: 'test'
  ...
# Subtest: list-build pruning writes only when it removes entries and never rewrites again within an hour
ok 893 - list-build pruning writes only when it removes entries and never rewrites again within an hour
  ---
  duration_ms: 523.814825
  type: 'test'
  ...
# Subtest: GET /wheelchair/?token redirects without the token and sets the remember cookie attributes
ok 894 - GET /wheelchair/?token redirects without the token and sets the remember cookie attributes
  ---
  duration_ms: 185.314415
  type: 'test'
  ...
# Subtest: a remember cookie reads the graph page, list, plan, document, and graph
ok 895 - a remember cookie reads the graph page, list, plan, document, and graph
  ---
  duration_ms: 561.99231
  type: 'test'
  ...
# Subtest: JSON reads accept token directly and never set a remember cookie
ok 896 - JSON reads accept token directly and never set a remember cookie
  ---
  duration_ms: 575.344691
  type: 'test'
  ...
# Subtest: a signed-in /wheelchair/ and /wheelchair/app/ redirect to the Threads page; a graph path still opens the graph page
ok 897 - a signed-in /wheelchair/ and /wheelchair/app/ redirect to the Threads page; a graph path still opens the graph page
  ---
  duration_ms: 269.787428
  type: 'test'
  ...
# Subtest: a wrong page token redirects with a valid cookie, but otherwise gets the sign-in page
ok 898 - a wrong page token redirects with a valid cookie, but otherwise gets the sign-in page
  ---
  duration_ms: 214.298054
  type: 'test'
  ...
# Subtest: wrong cookies and cookies from before a rotation are refused
ok 899 - wrong cookies and cookies from before a rotation are refused
  ---
  duration_ms: 567.604181
  type: 'test'
  ...
# Subtest: a remember cookie is not a token, header token, or registration key
ok 900 - a remember cookie is not a token, header token, or registration key
  ---
  duration_ms: 178.014661
  type: 'test'
  ...
# Subtest: PUT graph and view accept a remember cookie only from a permitted origin
ok 901 - PUT graph and view accept a remember cookie only from a permitted origin
  ---
  duration_ms: 263.667837
  type: 'test'
  ...
# Subtest: PUT /wheelchair/graph accepts a remember cookie only from a permitted origin
ok 902 - PUT /wheelchair/graph accepts a remember cookie only from a permitted origin
  ---
  duration_ms: 278.471504
  type: 'test'
  ...
# Subtest: root routes move to /wheelchair and /wheelchair gains its trailing slash
ok 903 - root routes move to /wheelchair and /wheelchair gains its trailing slash
  ---
  duration_ms: 244.378926
  type: 'test'
  ...
# Subtest: page responses renew the Lax cookie while JSON responses do not, and anonymous pages explain sign-in
ok 904 - page responses renew the Lax cookie while JSON responses do not, and anonymous pages explain sign-in
  ---
  duration_ms: 254.907663
  type: 'test'
  ...
# Subtest: an anonymous JSON route returns a JSON 401 error
ok 905 - an anonymous JSON route returns a JSON 401 error
  ---
  duration_ms: 252.959375
  type: 'test'
  ...
# Subtest: diagram readers restrict registered graph files and preserve forms and sandbox HTML
ok 906 - diagram readers restrict registered graph files and preserve forms and sandbox HTML
  ---
  duration_ms: 384.429409
  type: 'test'
  ...
# Subtest: legacy canonical bytes remain unchanged, while a run graph writes its explicit fields
ok 907 - legacy canonical bytes remain unchanged, while a run graph writes its explicit fields
  ---
  duration_ms: 404.643885
  type: 'test'
  ...
# Subtest: run validation refuses each new schema violation
ok 908 - run validation refuses each new schema violation
  ---
  duration_ms: 3675.148022
  type: 'test'
  ...
# Subtest: the page may not change run status
ok 909 - the page may not change run status
  ---
  duration_ms: 190.103362
  type: 'test'
  ...
# Subtest: run and plain chain layouts keep their respective axes and spacing
ok 910 - run and plain chain layouts keep their respective axes and spacing
  ---
  duration_ms: 481.441869
  type: 'test'
  ...
# Subtest: a task-only run update keeps every position, including a drag
ok 911 - a task-only run update keeps every position, including a drag
  ---
  duration_ms: 232.928181
  type: 'test'
  ...
# Subtest: a progress-only write keeps a dragged position, and an added edge lays the picture out again
ok 912 - a progress-only write keeps a dragged position, and an added edge lays the picture out again
  ---
  duration_ms: 421.787355
  type: 'test'
  ...
# Subtest: rollups, nesting, updated, and the list run path follow run-picture rules
ok 913 - rollups, nesting, updated, and the list run path follow run-picture rules
  ---
  duration_ms: 472.410624
  type: 'test'
  ...
# Subtest: run nesting and reserved names are refused on registered paths
ok 914 - run nesting and reserved names are refused on registered paths
  ---
  duration_ms: 634.890865
  type: 'test'
  ...
# Subtest: default servers allocate independent temporary hub state
ok 915 - default servers allocate independent temporary hub state
  ---
  duration_ms: 663.698273
  type: 'test'
  ...
# Subtest: legacy verdict fields load and disappear after an agent removes an entry
ok 916 - legacy verdict fields load and disappear after an agent removes an entry
  ---
  duration_ms: 661.674941
  type: 'test'
  ...
# Subtest: canonical round-trip canonicalizes byte-for-byte
ok 917 - canonical round-trip canonicalizes byte-for-byte
  ---
  duration_ms: 866.032394
  type: 'test'
  ...
# Subtest: explanation written through /graph is retained on disk in canonical order
ok 918 - explanation written through /graph is retained on disk in canonical order
  ---
  duration_ms: 461.453947
  type: 'test'
  ...
# Subtest: groups canonicalize member lists, order, and byte round-trip
ok 919 - groups canonicalize member lists, order, and byte round-trip
  ---
  duration_ms: 343.350973
  type: 'test'
  ...
# Subtest: visible groups round-trip without explanation references
ok 920 - visible groups round-trip without explanation references
  ---
  duration_ms: 267.415858
  type: 'test'
  ...
# Subtest: groups default on writes and reads of legacy disk files
ok 921 - groups default on writes and reads of legacy disk files
  ---
  duration_ms: 235.128873
  type: 'test'
  ...
# Subtest: groups refuse malformed claims and unmatched explanation references
ok 922 - groups refuse malformed claims and unmatched explanation references
  ---
  duration_ms: 408.173039
  type: 'test'
  ...
# Subtest: edge labels are optional except on a fork arm
ok 923 - edge labels are optional except on a fork arm
  ---
  duration_ms: 304.437815
  type: 'test'
  ...
# Subtest: ordinary markdown links in explanations do not require groups
ok 924 - ordinary markdown links in explanations do not require groups
  ---
  duration_ms: 311.16005
  type: 'test'
  ...
# Subtest: explanation accepts only strings or null
ok 925 - explanation accepts only strings or null
  ---
  duration_ms: 231.033586
  type: 'test'
  ...
# Subtest: agent prose refuses positional claims in explanations and groups
ok 926 - agent prose refuses positional claims in explanations and groups
  ---
  duration_ms: 231.999799
  type: 'test'
  ...
# Subtest: quoted spans mask positional claims without masking apostrophes or stray delimiters
ok 927 - quoted spans mask positional claims without masking apostrophes or stray delimiters
  ---
  duration_ms: 432.828814
  type: 'test'
  ...
# Subtest: positional claims leave the downhill vocabulary, node text, and page reads alone
ok 928 - positional claims leave the downhill vocabulary, node text, and page reads alone
  ---
  duration_ms: 673.578175
  type: 'test'
  ...
# Subtest: self edges are refused after missing endpoints
ok 929 - self edges are refused after missing endpoints
  ---
  duration_ms: 248.262986
  type: 'test'
  ...
# Subtest: both write routes enforce their distinct authority
ok 930 - both write routes enforce their distinct authority
  ---
  duration_ms: 374.4374
  type: 'test'
  ...
# Subtest: /view cannot alter explanation
ok 931 - /view cannot alter explanation
  ---
  duration_ms: 292.406142
  type: 'test'
  ...
# Subtest: /view cannot alter groups and accepts an untouched deep clone
ok 932 - /view cannot alter groups and accepts an untouched deep clone
  ---
  duration_ms: 402.544989
  type: 'test'
  ...
# Subtest: optimistic concurrency returns and accepts the current hash, including create
ok 933 - optimistic concurrency returns and accepts the current hash, including create
  ---
  duration_ms: 544.217353
  type: 'test'
  ...
# Subtest: node and edge kinds are closed sets while omitted kinds default
ok 934 - node and edge kinds are closed sets while omitted kinds default
  ---
  duration_ms: 543.600409
  type: 'test'
  ...
# Subtest: the global write lock serializes concurrent writes and retry retains both changes
ok 935 - the global write lock serializes concurrent writes and retry retains both changes
  ---
  duration_ms: 319.604705
  type: 'test'
  ...
# Subtest: PUT /graph ignores every supplied position and lays every node out again
ok 936 - PUT /graph ignores every supplied position and lays every node out again
  ---
  duration_ms: 288.192148
  type: 'test'
  ...
# Subtest: a create is deterministic, keeps group-less layout intact, and permits matching group and node ids
ok 937 - a create is deterministic, keeps group-less layout intact, and permits matching group and node ids
  ---
  duration_ms: 728.382408
  type: 'test'
  ...
# Subtest: visible groups occupy units, preserve their rows, and leave every outsider clear
ok 938 - visible groups occupy units, preserve their rows, and leave every outsider clear
  ---
  duration_ms: 148.34307
  type: 'test'
  ...
# Subtest: a wide group’s real right edge clears the next disconnected component
ok 939 - a wide group’s real right edge clears the next disconnected component
  ---
  duration_ms: 164.621036
  type: 'test'
  ...
# Subtest: global variable rows align disconnected components and use a tall group’s real edge
ok 940 - global variable rows align disconnected components and use a tall group’s real edge
  ---
  duration_ms: 181.579306
  type: 'test'
  ...
# Subtest: the third pass keeps an arrow-less member’s middle first-pass slot
ok 941 - the third pass keeps an arrow-less member’s middle first-pass slot
  ---
  duration_ms: 195.744268
  type: 'test'
  ...
# Subtest: parallel arrows do not weight a third-pass median twice, and quotient loops still write
ok 942 - parallel arrows do not weight a third-pass median twice, and quotient loops still write
  ---
  duration_ms: 356.191176
  type: 'test'
  ...
# Subtest: the third pass deduplicates endpoint pairs before it counts external crossings
ok 943 - the third pass deduplicates endpoint pairs before it counts external crossings
  ---
  duration_ms: 181.294801
  type: 'test'
  ...
# Subtest: the third pass keeps the first pass’s crossing count on an internal counter-example
ok 944 - the third pass keeps the first pass’s crossing count on an internal counter-example
  ---
  duration_ms: 156.057408
  type: 'test'
  ...
# Subtest: the third pass keys a member on every neighbour, including members of its group
ok 945 - the third pass keys a member on every neighbour, including members of its group
  ---
  duration_ms: 186.852982
  type: 'test'
  ...
# Subtest: the third pass gives internal and external neighbours equal weight in its median
ok 946 - the third pass gives internal and external neighbours equal weight in its median
  ---
  duration_ms: 157.163931
  type: 'test'
  ...
# Subtest: the third pass freezes other groups before it walks either group
ok 947 - the third pass freezes other groups before it walks either group
  ---
  duration_ms: 147.520411
  type: 'test'
  ...
# Subtest: a bend point reserves its own pitch, so a multi-row arrow lays out unchanged
ok 948 - a bend point reserves its own pitch, so a multi-row arrow lays out unchanged
  ---
  duration_ms: 154.92239
  type: 'test'
  ...
# Subtest: a unit shorter than its row sits on the row line rather than centred in it
ok 949 - a unit shorter than its row sits on the row line rather than centred in it
  ---
  duration_ms: 161.597896
  type: 'test'
  ...
# Subtest: the third pass reads earlier group-mates live as it walks a row
ok 950 - the third pass reads earlier group-mates live as it walks a row
  ---
  duration_ms: 188.30165
  type: 'test'
  ...
# Subtest: the third pass leaves a group rectangle and member rows at their first-pass values
ok 951 - the third pass leaves a group rectangle and member rows at their first-pass values
  ---
  duration_ms: 314.509299
  type: 'test'
  ...
# Subtest: all containment retarget cases, cycles, deep acyclic writes, and missing children follow the contract
ok 952 - all containment retarget cases, cycles, deep acyclic writes, and missing children follow the contract
  ---
  duration_ms: 607.64201
  type: 'test'
  ...
# Subtest: retargeting away unregisters a derivable child
ok 953 - retargeting away unregisters a derivable child
  ---
  duration_ms: 164.552574
  type: 'test'
  ...
# Subtest: whoami is unauthenticated identity, never a mutation credential
ok 954 - whoami is unauthenticated identity, never a mutation credential
  ---
  duration_ms: 168.935029
  type: 'test'
  ...
# Subtest: --show opens a browser once, and never while a tab is already on that graph
ok 955 - --show opens a browser once, and never while a tab is already on that graph
  ---
  duration_ms: 1909.714255
  type: 'test'
  ...
# Subtest: two starts at the same instant leave one server, and the loser reuses it rather than dying
ok 956 - two starts at the same instant leave one server, and the loser reuses it rather than dying
  ---
  duration_ms: 4515.702296
  type: 'test'
  ...
# Subtest: listen-first startup reuses the port holder and ignores stale .server information
ok 957 - listen-first startup reuses the port holder and ignores stale .server information
  ---
  duration_ms: 354.920891
  type: 'test'
  ...
# Subtest: the token is published atomically while independent ports can start
ok 958 - the token is published atomically while independent ports can start
  ---
  duration_ms: 163.959663
  type: 'test'
  ...
# Subtest: GET change detection exposes agent hashes and preserves the page write hash
ok 959 - GET change detection exposes agent hashes and preserves the page write hash
  ---
  duration_ms: 137.01138
  type: 'test'
  ...
# Subtest: a kill before rename leaves the committed graph as either whole version, never a partial write
ok 960 - a kill before rename leaves the committed graph as either whole version, never a partial write
  ---
  duration_ms: 6892.566514
  type: 'test'
  ...
# Subtest: registered paths are pruned by age at startup
ok 961 - registered paths are pruned by age at startup
  ---
  duration_ms: 120.53409
  type: 'test'
  ...
# Subtest: malformed on-disk graphs refuse without repair
ok 962 - malformed on-disk graphs refuse without repair
  ---
  duration_ms: 416.738963
  type: 'test'
  ...
# Subtest: layout runs downhill: an arrow never points back up the page
ok 963 - layout runs downhill: an arrow never points back up the page
  ---
  duration_ms: 143.378771
  type: 'test'
  ...
# Subtest: layout places every component, including a disconnected two-cycle
ok 964 - layout places every component, including a disconnected two-cycle
  ---
  duration_ms: 156.851254
  type: 'test'
  ...
# Subtest: cache-root isolation never changes the live default cache
ok 965 - cache-root isolation never changes the live default cache
  ---
  duration_ms: 161.023927
  type: 'test'
  ...
# Subtest: line bands and tricky
ok 966 - line bands and tricky
  ---
  duration_ms: 2375.525896
  type: 'test'
  ...
# Subtest: excluded paths, raw names, subdirectories and executable scout diff
ok 967 - excluded paths, raw names, subdirectories and executable scout diff
  ---
  duration_ms: 328.098463
  type: 'test'
  ...
# Subtest: only excluded changes and exact file or symlink
ok 968 - only excluded changes and exact file or symlink
  ---
  duration_ms: 1069.553528
  type: 'test'
  ...
# Subtest: renames across exclusion with renames disabled in config
ok 969 - renames across exclusion with renames disabled in config
  ---
  duration_ms: 246.69043
  type: 'test'
  ...
# Subtest: binary counts zero and errors are prefixed
ok 970 - binary counts zero and errors are prefixed
  ---
  duration_ms: 406.282831
  type: 'test'
  ...
# Subtest: session output compact and full
ok 971 - session output compact and full
  ---
  duration_ms: 479.252396
  type: 'test'
  ...
# Subtest: session leads sends the all-projects flag and prints the response
ok 972 - session leads sends the all-projects flag and prints the response
  ---
  duration_ms: 268.424321
  type: 'test'
  ...
# Subtest: screen start passes the operation and unchanged arguments
ok 973 - screen start passes the operation and unchanged arguments
  ---
  duration_ms: 191.122277
  type: 'test'
  ...
# Subtest: screen run passes the operation and unchanged arguments
ok 974 - screen run passes the operation and unchanged arguments
  ---
  duration_ms: 133.040951
  type: 'test'
  ...
# Subtest: screen shot passes the operation and unchanged arguments
ok 975 - screen shot passes the operation and unchanged arguments
  ---
  duration_ms: 165.341743
  type: 'test'
  ...
# Subtest: screen windows passes the operation and unchanged arguments
ok 976 - screen windows passes the operation and unchanged arguments
  ---
  duration_ms: 172.754792
  type: 'test'
  ...
# Subtest: screen move passes the operation and unchanged arguments
ok 977 - screen move passes the operation and unchanged arguments
  ---
  duration_ms: 197.484641
  type: 'test'
  ...
# Subtest: screen click passes the operation and unchanged arguments
ok 978 - screen click passes the operation and unchanged arguments
  ---
  duration_ms: 142.811774
  type: 'test'
  ...
# Subtest: screen drag passes the operation and unchanged arguments
ok 979 - screen drag passes the operation and unchanged arguments
  ---
  duration_ms: 218.05983
  type: 'test'
  ...
# Subtest: screen type passes the operation and unchanged arguments
ok 980 - screen type passes the operation and unchanged arguments
  ---
  duration_ms: 120.207782
  type: 'test'
  ...
# Subtest: screen key passes the operation and unchanged arguments
ok 981 - screen key passes the operation and unchanged arguments
  ---
  duration_ms: 205.96553
  type: 'test'
  ...
# Subtest: screen focus passes the operation and unchanged arguments
ok 982 - screen focus passes the operation and unchanged arguments
  ---
  duration_ms: 175.101233
  type: 'test'
  ...
# Subtest: screen stop passes the operation and unchanged arguments
ok 983 - screen stop passes the operation and unchanged arguments
  ---
  duration_ms: 143.440459
  type: 'test'
  ...
# Subtest: screen status passes the operation and unchanged arguments
ok 984 - screen status passes the operation and unchanged arguments
  ---
  duration_ms: 125.388551
  type: 'test'
  ...
# Subtest: screen non-2xx response is reported with the wc prefix
ok 985 - screen non-2xx response is reported with the wc prefix
  ---
  duration_ms: 130.557085
  type: 'test'
  ...
# Subtest: unknown screen op fails without sending a request
ok 986 - unknown screen op fails without sending a request
  ---
  duration_ms: 94.421106
  type: 'test'
  ...
# Subtest: screenRequest rejects unknown and missing operations
ok 987 - screenRequest rejects unknown and missing operations
  ---
  duration_ms: 0.711655
  type: 'test'
  ...
# Subtest: templates work, reject existing folders and names, and use checkout top
ok 988 - templates work, reject existing folders and names, and use checkout top
  ---
  duration_ms: 1281.543935
  type: 'test'
  ...
# Subtest: session list reads pinned shared tools and hides collisions
ok 989 - session list reads pinned shared tools and hides collisions
  ---
  duration_ms: 173.903815
  type: 'test'
  ...
# Subtest: run and check sanitize environment and report failures
ok 990 - run and check sanitize environment and report failures
  ---
  duration_ms: 901.461329
  type: 'test'
  ...
# Subtest: check deadline and SIGTERM kill stalled server and grandchild
ok 991 - check deadline and SIGTERM kill stalled server and grandchild
  ---
  duration_ms: 1673.807944
  type: 'test'
  ...
# Subtest: win info passes the operation and unchanged arguments
ok 992 - win info passes the operation and unchanged arguments
  ---
  duration_ms: 115.099302
  type: 'test'
  ...
# Subtest: win sync passes the operation and unchanged arguments
ok 993 - win sync passes the operation and unchanged arguments
  ---
  duration_ms: 105.268915
  type: 'test'
  ...
# Subtest: win run passes the operation and unchanged arguments
ok 994 - win run passes the operation and unchanged arguments
  ---
  duration_ms: 203.484869
  type: 'test'
  ...
# Subtest: win start passes the operation and unchanged arguments
ok 995 - win start passes the operation and unchanged arguments
  ---
  duration_ms: 118.097804
  type: 'test'
  ...
# Subtest: win status passes the operation and unchanged arguments
ok 996 - win status passes the operation and unchanged arguments
  ---
  duration_ms: 101.394934
  type: 'test'
  ...
# Subtest: win windows passes the operation and unchanged arguments
ok 997 - win windows passes the operation and unchanged arguments
  ---
  duration_ms: 103.648486
  type: 'test'
  ...
# Subtest: win shot passes the operation and unchanged arguments
ok 998 - win shot passes the operation and unchanged arguments
  ---
  duration_ms: 96.864011
  type: 'test'
  ...
# Subtest: win stop passes the operation and unchanged arguments
ok 999 - win stop passes the operation and unchanged arguments
  ---
  duration_ms: 238.884435
  type: 'test'
  ...
# Subtest: win path passes the operation and unchanged arguments
ok 1000 - win path passes the operation and unchanged arguments
  ---
  duration_ms: 132.27601
  type: 'test'
  ...
# Subtest: win non-2xx response is reported with the wc prefix
ok 1001 - win non-2xx response is reported with the wc prefix
  ---
  duration_ms: 151.986301
  type: 'test'
  ...
# Subtest: unknown win op fails without sending a request
ok 1002 - unknown win op fails without sending a request
  ---
  duration_ms: 89.328716
  type: 'test'
  ...
# Subtest: winRequest rejects unknown and missing operations
ok 1003 - winRequest rejects unknown and missing operations
  ---
  duration_ms: 0.869929
  type: 'test'
  ...
# Subtest: win info writes disk warnings to stderr and preserves JSON stdout
ok 1004 - win info writes disk warnings to stderr and preserves JSON stdout
  ---
  duration_ms: 182.620555
  type: 'test'
  ...
# Subtest: the page eligibility regex equals the machine one
ok 1005 - the page eligibility regex equals the machine one
  ---
  duration_ms: 2.00657
  type: 'test'
  ...
# Subtest: the page eligibility function
ok 1006 - the page eligibility function
  ---
  duration_ms: 7.115229
  type: 'test'
  ...
# Subtest: worker effort must be a supported level and cannot exceed the manifest ceiling
ok 1007 - worker effort must be a supported level and cannot exceed the manifest ceiling
  ---
  duration_ms: 5564.582197
  type: 'test'
  ...
# Subtest: stored ZIP has names and bytes readable by Python
ok 1008 - stored ZIP has names and bytes readable by Python
  ---
  duration_ms: 81.058402
  type: 'test'
  ...
1..1008
# tests 1024
# suites 0
# pass 1022
# fail 2
# cancelled 0
# skipped 0
# todo 0
# duration_ms 89216.154575

```

Second run, exit 1:

```text
TAP version 13
# Subtest: events pair in either order, upgrade closure once, and preserve turn and queue
ok 1 - events pair in either order, upgrade closure once, and preserve turn and queue
  ---
  duration_ms: 35.766994
  type: 'test'
  ...
# Subtest: retention, parallel current, trail, failures and context
ok 2 - retention, parallel current, trail, failures and context
  ---
  duration_ms: 8.848778
  type: 'test'
  ...
# Subtest: late starts and pending ends expire, with bounded running steps
ok 3 - late starts and pending ends expire, with bounded running steps
  ---
  duration_ms: 7.032885
  type: 'test'
  ...
# Subtest: thinking gaps and current choose the latest running step, then the previous one
ok 4 - thinking gaps and current choose the latest running step, then the previous one
  ---
  duration_ms: 1.708406
  type: 'test'
  ...
# Subtest: pending ends are bounded
ok 5 - pending ends are bounded
  ---
  duration_ms: 5.204891
  type: 'test'
  ...
# Subtest: mid-turn delivery closes the preceding turn for late step starts
ok 6 - mid-turn delivery closes the preceding turn for late step starts
  ---
  duration_ms: 6.290282
  type: 'test'
  ...
# Subtest: lead names pick a random free name, case insensitively, and release archived names
ok 7 - lead names pick a random free name, case insensitively, and release archived names
  ---
  duration_ms: 4.421729
  type: 'test'
  ...
# Subtest: lead names come from the chosen list
ok 8 - lead names come from the chosen list
  ---
  duration_ms: 1.660324
  type: 'test'
  ...
# Subtest: agent tree keeps finished nodes, derives states and hides briefs
ok 9 - agent tree keeps finished nodes, derives states and hides briefs
  ---
  duration_ms: 14.384341
  type: 'test'
  ...
# Subtest: individual states and needs-you belong to the lead
ok 10 - individual states and needs-you belong to the lead
  ---
  duration_ms: 0.834881
  type: 'test'
  ...
# Subtest: messages only make an agent wait for its starter until the starter replies
ok 11 - messages only make an agent wait for its starter until the starter replies
  ---
  duration_ms: 1.015618
  type: 'test'
  ...
# Subtest: a plain status message to the starter leaves the agent idle, not waiting
ok 12 - a plain status message to the starter leaves the agent idle, not waiting
  ---
  duration_ms: 0.291138
  type: 'test'
  ...
# Subtest: waiting on children, asides, stage and completion
ok 13 - waiting on children, asides, stage and completion
  ---
  duration_ms: 0.84975
  type: 'test'
  ...
# Subtest: titles, result ownership, first turn and secrets
ok 14 - titles, result ownership, first turn and secrets
  ---
  duration_ms: 0.689773
  type: 'test'
  ...
# Subtest: tree handles old leads, orphans, ordering, exclusions and cycles
ok 15 - tree handles old leads, orphans, ordering, exclusions and cycles
  ---
  duration_ms: 0.788973
  type: 'test'
  ...
# Subtest: agents reads stage from worktree or saved status without one
ok 16 - agents reads stage from worktree or saved status without one
  ---
  duration_ms: 26.036726
  type: 'test'
  ...
# Subtest: review rounds use latest fixing or clean card including replaced cards
ok 17 - review rounds use latest fixing or clean card including replaced cards
  ---
  duration_ms: 0.711514
  type: 'test'
  ...
# Subtest: review reports and finished timestamps use the newest result
ok 18 - review reports and finished timestamps use the newest result
  ---
  duration_ms: 0.668542
  type: 'test'
  ...
# Subtest: agents carry the account name and the latest move, with removed accounts named as such
ok 19 - agents carry the account name and the latest move, with removed accounts named as such
  ---
  duration_ms: 0.572958
  type: 'test'
  ...
# Subtest: assistant ids count hidden transcript text before filtering
ok 20 - assistant ids count hidden transcript text before filtering
  ---
  duration_ms: 3.382185
  type: 'test'
  ...
# Subtest: aside turns fork, resume, save before ack, and retry failures
ok 21 - aside turns fork, resume, save before ack, and retry failures
  ---
  duration_ms: 106.589048
  type: 'test'
  ...
# Subtest: step-up refusal retries once; controls never step up; graphs are saved
ok 22 - step-up refusal retries once; controls never step up; graphs are saved
  ---
  duration_ms: 37.429983
  type: 'test'
  ...
# Subtest: dispatching turns recover a lost POST with the same id
ok 23 - dispatching turns recover a lost POST with the same id
  ---
  duration_ms: 14.868422
  type: 'test'
  ...
# Subtest: routes anchor lead messages, expose summaries, hand off and archive
ok 24 - routes anchor lead messages, expose summaries, hand off and archive
  ---
  duration_ms: 222.6344
  type: 'test'
  ...
# Subtest: Think harder repeats the last question and summary observes its readiness gates
ok 25 - Think harder repeats the last question and summary observes its readiness gates
  ---
  duration_ms: 22.599105
  type: 'test'
  ...
# Subtest: a fresh hub selects stranded queued asides but not failed or archived ones
ok 26 - a fresh hub selects stranded queued asides but not failed or archived ones
  ---
  duration_ms: 43.192083
  type: 'test'
  ...
# Subtest: aside GET computes heavy usability from the model command without storing it
ok 27 - aside GET computes heavy usability from the model command without storing it
  ---
  duration_ms: 18.205379
  type: 'test'
  ...
# Subtest: slow machine calls leave routes free, coalesce pumps, and discard archived results
ok 28 - slow machine calls leave routes free, coalesce pumps, and discard archived results
  ---
  duration_ms: 27.980403
  type: 'test'
  ...
# Subtest: archive races compensate claimed turns without changing history
    # Subtest: before recheck
    ok 1 - before recheck
      ---
      duration_ms: 11.866355
      type: 'test'
      ...
    # Subtest: before post response
    ok 2 - before post response
      ---
      duration_ms: 15.245323
      type: 'test'
      ...
    # Subtest: finished unheld
    ok 3 - finished unheld
      ---
      duration_ms: 14.430781
      type: 'test'
      ...
    1..3
ok 29 - archive races compensate claimed turns without changing history
  ---
  duration_ms: 42.651666
  type: 'test'
  ...
# Subtest: a cancelled turn is never acknowledged, so a late start runs nothing
ok 30 - a cancelled turn is never acknowledged, so a late start runs nothing
  ---
  duration_ms: 22.210219
  type: 'test'
  ...
# Subtest: a stopped result after archive is never acknowledged, so a late start runs nothing
ok 31 - a stopped result after archive is never acknowledged, so a late start runs nothing
  ---
  duration_ms: 23.87413
  type: 'test'
  ...
# Subtest: archive tombstones a delayed POST whose response is lost
ok 32 - archive tombstones a delayed POST whose response is lost
  ---
  duration_ms: 13.623202
  type: 'test'
  ...
# Subtest: a partly failed archive saves first and the hub retries the cancel
ok 33 - a partly failed archive saves first and the hub retries the cancel
  ---
  duration_ms: 27.333223
  type: 'test'
  ...
# Subtest: a fresh hub retries pending cancels on init
ok 34 - a fresh hub retries pending cancels on init
  ---
  duration_ms: 40.654175
  type: 'test'
  ...
# Subtest: brief carries one graphs entry per history entry that has a graph, and drops history
ok 35 - brief carries one graphs entry per history entry that has a graph, and drops history
  ---
  duration_ms: 0.303992
  type: 'test'
  ...
# Subtest: done verified validation
ok 36 - done verified validation
  ---
  duration_ms: 1.748813
  type: 'test'
  ...
# Subtest: silent gates and held gates
ok 37 - silent gates and held gates
  ---
  duration_ms: 135.057569
  type: 'test'
  ...
# Subtest: held gate does not add notice when pull request already has a merged card
ok 38 - held gate does not add notice when pull request already has a merged card
  ---
  duration_ms: 5.860518
  type: 'test'
  ...
# Subtest: GitHub outcomes and exact merge arguments
ok 39 - GitHub outcomes and exact merge arguments
  ---
  duration_ms: 1617.517934
  type: 'test'
  ...
# Subtest: dismiss auto-merge card and refuse lead resolution
ok 40 - dismiss auto-merge card and refuse lead resolution
  ---
  duration_ms: 29.939059
  type: 'test'
  ...
# Subtest: result delivery includes commit when supplied
ok 41 - result delivery includes commit when supplied
  ---
  duration_ms: 34.751738
  type: 'test'
  ...
# Subtest: accepting a check triggers auto-merge
ok 42 - accepting a check triggers auto-merge
  ---
  duration_ms: 55.725044
  type: 'test'
  ...
# Subtest: switching off during the readiness wait prevents merge
ok 43 - switching off during the readiness wait prevents merge
  ---
  duration_ms: 55.673576
  type: 'test'
  ...
# Subtest: merge timeout produces unknown and its specific notice
ok 44 - merge timeout produces unknown and its specific notice
  ---
  duration_ms: 322.468315
  type: 'test'
  ...
# Subtest: finishing respects concurrent merged, newer done, and unrelated cards
ok 45 - finishing respects concurrent merged, newer done, and unrelated cards
  ---
  duration_ms: 110.254828
  type: 'test'
  ...
# Subtest: pollMerged closes open auto-merge notices
ok 46 - pollMerged closes open auto-merge notices
  ---
  duration_ms: 43.142448
  type: 'test'
  ...
# Subtest: done acceptance closes notices for older heads and leaves same head open
ok 47 - done acceptance closes notices for older heads and leaves same head open
  ---
  duration_ms: 53.383585
  type: 'test'
  ...
# Subtest: lead resolve through acceptCard refuses auto-merge needs
ok 48 - lead resolve through acceptCard refuses auto-merge needs
  ---
  duration_ms: 30.232933
  type: 'test'
  ...
# Subtest: deleting the branch after a merge follows its setting and only records a failure
ok 49 - deleting the branch after a merge follows its setting and only records a failure
  ---
  duration_ms: 174.517935
  type: 'test'
  ...
# Subtest: branch deletion targets the repository that holds the branch
ok 50 - branch deletion targets the repository that holds the branch
  ---
  duration_ms: 96.193444
  type: 'test'
  ...
# Subtest: target PR check does not merge, notify, or delete its branch
ok 51 - target PR check does not merge, notify, or delete its branch
  ---
  duration_ms: 34.53385
  type: 'test'
  ...
# Subtest: default placement, strict and preferred constraints, and invalid flags
ok 52 - default placement, strict and preferred constraints, and invalid flags
  ---
  duration_ms: 1844.304255
  type: 'test'
  ...
# Subtest: placement ranks accounts and respects provider policy
    # Subtest: soonest
    ok 1 - soonest
      ---
      duration_ms: 277.662778
      type: 'test'
      ...
    # Subtest: spread
    ok 2 - spread
      ---
      duration_ms: 246.562193
      type: 'test'
      ...
    # Subtest: one
    ok 3 - one
      ---
      duration_ms: 261.19429
      type: 'test'
      ...
    # Subtest: three provider placement and constraints
    ok 4 - three provider placement and constraints
      ---
      duration_ms: 1074.068574
      type: 'test'
      ...
    # Subtest: leave, paused and signed out
    ok 5 - leave, paused and signed out
      ---
      duration_ms: 537.928878
      type: 'test'
      ...
    # Subtest: save Claude and pinned leads
    ok 6 - save Claude and pinned leads
      ---
      duration_ms: 383.483181
      type: 'test'
      ...
    # Subtest: lead any and constraint fallback
    ok 7 - lead any and constraint fallback
      ---
      duration_ms: 1203.443384
      type: 'test'
      ...
    # Subtest: lead reserve follows signed-in lead order and margin
    ok 8 - lead reserve follows signed-in lead order and margin
      ---
      duration_ms: 422.895165
      type: 'test'
      ...
    # Subtest: single review family overrides flags and waits or falls back
    ok 9 - single review family overrides flags and waits or falls back
      ---
      duration_ms: 529.859903
      type: 'test'
      ...
    # Subtest: mixed families report the one family when only one is signed in
    ok 10 - mixed families report the one family when only one is signed in
      ---
      duration_ms: 490.261272
      type: 'test'
      ...
    # Subtest: wait estimate accounts for every exhausted window
    ok 11 - wait estimate accounts for every exhausted window
      ---
      duration_ms: 298.489743
      type: 'test'
      ...
    # Subtest: reviewers and verifiers wait when neither provider has room
    ok 12 - reviewers and verifiers wait when neither provider has room
      ---
      duration_ms: 533.062504
      type: 'test'
      ...
    # Subtest: margin skips Claude for workers but not leads
    ok 13 - margin skips Claude for workers but not leads
      ---
      duration_ms: 1025.936313
      type: 'test'
      ...
    1..13
ok 53 - placement ranks accounts and respects provider policy
  ---
  duration_ms: 7314.371839
  type: 'test'
  ...
# Subtest: a reading promotes the same waiting worker and keeps its queue
ok 54 - a reading promotes the same waiting worker and keeps its queue
  ---
  duration_ms: 1646.78752
  type: 'test'
  ...
# Subtest: a turn-ended reading promotes the same waiting worker and keeps its token
ok 55 - a turn-ended reading promotes the same waiting worker and keeps its token
  ---
  duration_ms: 1515.098389
  type: 'test'
  ...
# Subtest: limit hold releases with Continue and failed turns notify without a result
ok 56 - limit hold releases with Continue and failed turns notify without a result
  ---
  duration_ms: 1482.346494
  type: 'test'
  ...
# Subtest: promotion failure marks the waiting session failed
ok 57 - promotion failure marks the waiting session failed
  ---
  duration_ms: 1384.004098
  type: 'test'
  ...
# Subtest: waiting sessions survive polling and stop without a machine call
ok 58 - waiting sessions survive polling and stop without a machine call
  ---
  duration_ms: 1292.499434
  type: 'test'
  ...
# Subtest: old threads acquire a provider on first read
ok 59 - old threads acquire a provider on first read
  ---
  duration_ms: 8.048463
  type: 'test'
  ...
# Subtest: unused worker cell refuses a strict provider
ok 60 - unused worker cell refuses a strict provider
  ---
  duration_ms: 1021.684609
  type: 'test'
  ...
# Subtest: preflight retries on the other signed-in GPT account
ok 61 - preflight retries on the other signed-in GPT account
  ---
  duration_ms: 1291.040533
  type: 'test'
  ...
# Subtest: startup promotes a waiting session when room is available
ok 62 - startup promotes a waiting session when room is available
  ---
  duration_ms: 767.587361
  type: 'test'
  ...
# Subtest: worker placement uses account login on its own machine
ok 63 - worker placement uses account login on its own machine
  ---
  duration_ms: 387.060665
  type: 'test'
  ...
# Subtest: limited verifier reports only after release and continuation
ok 64 - limited verifier reports only after release and continuation
  ---
  duration_ms: 703.094264
  type: 'test'
  ...
# Subtest: reviewer: live limit-ended delivery
ok 65 - reviewer: live limit-ended delivery
  ---
  duration_ms: 644.906226
  type: 'test'
  ...
# Subtest: reviewer: late limit-ended delivery
ok 66 - reviewer: late limit-ended delivery
  ---
  duration_ms: 540.171637
  type: 'test'
  ...
# Subtest: reviewer: spooled retry limit-ended delivery
ok 67 - reviewer: spooled retry limit-ended delivery
  ---
  duration_ms: 540.390656
  type: 'test'
  ...
# Subtest: reviewer: limit-hit limit-ended delivery
ok 68 - reviewer: limit-hit limit-ended delivery
  ---
  duration_ms: 519.489878
  type: 'test'
  ...
# Subtest: reviewer: control limit-ended delivery
ok 69 - reviewer: control limit-ended delivery
  ---
  duration_ms: 549.851587
  type: 'test'
  ...
# Subtest: verifier: live limit-ended delivery
ok 70 - verifier: live limit-ended delivery
  ---
  duration_ms: 548.885012
  type: 'test'
  ...
# Subtest: verifier: late limit-ended delivery
ok 71 - verifier: late limit-ended delivery
  ---
  duration_ms: 535.464489
  type: 'test'
  ...
# Subtest: verifier: spooled retry limit-ended delivery
ok 72 - verifier: spooled retry limit-ended delivery
  ---
  duration_ms: 536.995924
  type: 'test'
  ...
# Subtest: verifier: limit-hit limit-ended delivery
ok 73 - verifier: limit-hit limit-ended delivery
  ---
  duration_ms: 534.609078
  type: 'test'
  ...
# Subtest: verifier: control limit-ended delivery
ok 74 - verifier: control limit-ended delivery
  ---
  duration_ms: 511.718734
  type: 'test'
  ...
# Subtest: worker: live limit-ended delivery
ok 75 - worker: live limit-ended delivery
  ---
  duration_ms: 693.064006
  type: 'test'
  ...
# Subtest: worker: late limit-ended delivery
ok 76 - worker: late limit-ended delivery
  ---
  duration_ms: 675.566363
  type: 'test'
  ...
# Subtest: worker: spooled retry limit-ended delivery
ok 77 - worker: spooled retry limit-ended delivery
  ---
  duration_ms: 668.778616
  type: 'test'
  ...
# Subtest: worker: limit-hit limit-ended delivery
ok 78 - worker: limit-hit limit-ended delivery
  ---
  duration_ms: 662.695142
  type: 'test'
  ...
# Subtest: worker: control limit-ended delivery
ok 79 - worker: control limit-ended delivery
  ---
  duration_ms: 668.20216
  type: 'test'
  ...
# Subtest: waiting lead records provider and promoted role layers and style
ok 80 - waiting lead records provider and promoted role layers and style
  ---
  duration_ms: 463.639942
  type: 'test'
  ...
# Subtest: lead and sub-lead use distinct model slots
ok 81 - lead and sub-lead use distinct model slots
  ---
  duration_ms: 0.355702
  type: 'test'
  ...
# Subtest: OpenRouter explicit placement outside order respects review family
ok 82 - OpenRouter explicit placement outside order respects review family
  ---
  duration_ms: 376.009408
  type: 'test'
  ...
# Subtest: renders Antigravity fixture turns, tools, timestamps and report
ok 83 - renders Antigravity fixture turns, tools, timestamps and report
  ---
  duration_ms: 5.264535
  type: 'test'
  ...
# Subtest: renders the single-turn Antigravity fixture
ok 84 - renders the single-turn Antigravity fixture
  ---
  duration_ms: 0.637913
  type: 'test'
  ...
# Subtest: skips unknown Antigravity rows and folds queued tool results in order
ok 85 - skips unknown Antigravity rows and folds queued tool results in order
  ---
  duration_ms: 0.921557
  type: 'test'
  ...
# Subtest: reports unreadable nonempty Antigravity transcripts
ok 86 - reports unreadable nonempty Antigravity transcripts
  ---
  duration_ms: 0.495991
  type: 'test'
  ...
# Subtest: renders a Claude human turn after unwrapping pasted content
ok 87 - renders a Claude human turn after unwrapping pasted content
  ---
  duration_ms: 1.090992
  type: 'test'
  ...
# Subtest: renders a Claude message sent mid-turn as a the user bubble, and skips task notices
ok 88 - renders a Claude message sent mid-turn as a the user bubble, and skips task notices
  ---
  duration_ms: 0.280958
  type: 'test'
  ...
# Subtest: hides a Claude role turn and its reply
ok 89 - hides a Claude role turn and its reply
  ---
  duration_ms: 0.181829
  type: 'test'
  ...
# Subtest: replaces a stub context marker and keeps its lead reply
ok 90 - replaces a stub context marker and keeps its lead reply
  ---
  duration_ms: 0.24501
  type: 'test'
  ...
# Subtest: hides a switch marker with no line of its own and keeps the reply
ok 91 - hides a switch marker with no line of its own and keeps the reply
  ---
  duration_ms: 0.377594
  type: 'test'
  ...
# Subtest: replaces a restart context marker and keeps its lead reply
ok 92 - replaces a restart context marker and keeps its lead reply
  ---
  duration_ms: 0.790767
  type: 'test'
  ...
# Subtest: renders a card press as a short the user bubble
ok 93 - renders a card press as a short the user bubble
  ---
  duration_ms: 0.478677
  type: 'test'
  ...
# Subtest: collapses a Claude tool call to one chat item
ok 94 - collapses a Claude tool call to one chat item
  ---
  duration_ms: 0.335423
  type: 'test'
  ...
# Subtest: ignores Codex injected entries before turn_context
ok 95 - ignores Codex injected entries before turn_context
  ---
  duration_ms: 1.090451
  type: 'test'
  ...
# Subtest: does not let Codex task_started open a human turn before turn_context
ok 96 - does not let Codex task_started open a human turn before turn_context
  ---
  duration_ms: 0.227777
  type: 'test'
  ...
# Subtest: requires a fresh Codex turn_context for each turn
ok 97 - requires a fresh Codex turn_context for each turn
  ---
  duration_ms: 0.288914
  type: 'test'
  ...
# Subtest: collapses a Codex function call to one chat item
ok 98 - collapses a Codex function call to one chat item
  ---
  duration_ms: 0.176479
  type: 'test'
  ...
# Subtest: uses each transcript line timestamp for chat items
ok 99 - uses each transcript line timestamp for chat items
  ---
  duration_ms: 0.171058
  type: 'test'
  ...
# Subtest: a line without a timestamp takes the previous one, and Claude echoes are not repeated
ok 100 - a line without a timestamp takes the previous one, and Claude echoes are not repeated
  ---
  duration_ms: 0.258997
  type: 'test'
  ...
# Subtest: folds a Claude tool result into its call, cut at 2000 characters
ok 101 - folds a Claude tool result into its call, cut at 2000 characters
  ---
  duration_ms: 0.626581
  type: 'test'
  ...
# Subtest: folds a Codex function_call_output into its call
ok 102 - folds a Codex function_call_output into its call
  ---
  duration_ms: 0.332227
  type: 'test'
  ...
# Subtest: GET /threads/:id/graph reads an archived thread graph from its branch, and nothing else
ok 103 - GET /threads/:id/graph reads an archived thread graph from its branch, and nothing else
  ---
  duration_ms: 642.739698
  type: 'test'
  ...
# Subtest: a failed transcript read keeps the last copy for the chat, not for a report
ok 104 - a failed transcript read keeps the last copy for the chat, not for a report
  ---
  duration_ms: 1.359838
  type: 'test'
  ...
# Subtest: stamped chat polls share parsed items and invalidate them when parser context changes
ok 105 - stamped chat polls share parsed items and invalidate them when parser context changes
  ---
  duration_ms: 4.105592
  type: 'test'
  ...
# Subtest: old machines, missing entries, empty replies and failures follow transcript fallback rules
ok 106 - old machines, missing entries, empty replies and failures follow transcript fallback rules
  ---
  duration_ms: 0.937357
  type: 'test'
  ...
# Subtest: idle transcript pruning protects queued and active chat operations
ok 107 - idle transcript pruning protects queued and active chat operations
  ---
  duration_ms: 0.676156
  type: 'test'
  ...
# Subtest: peer_log becomes folded peer items interleaved by time, without message text
ok 108 - peer_log becomes folded peer items interleaved by time, without message text
  ---
  duration_ms: 1.534643
  type: 'test'
  ...
# Subtest: queued leaves out held peer messages for a stopped lead
ok 109 - queued leaves out held peer messages for a stopped lead
  ---
  duration_ms: 1.297749
  type: 'test'
  ...
# Subtest: check schema validates required fields, limits and cross-field rules
ok 110 - check schema validates required fields, limits and cross-field rules
  ---
  duration_ms: 2.368912
  type: 'test'
  ...
# Subtest: hub accepts only a current done head and one check per head
ok 111 - hub accepts only a current done head and one check per head
  ---
  duration_ms: 8.393885
  type: 'test'
  ...
# Subtest: press checks action, broken status, current head, answer and live lead before enqueue
ok 112 - press checks action, broken status, current head, answer and live lead before enqueue
  ---
  duration_ms: 2.848802
  type: 'test'
  ...
# Subtest: handoff preserves a maximum size check history and validates
ok 113 - handoff preserves a maximum size check history and validates
  ---
  duration_ms: 1.844316
  type: 'test'
  ...
# auto-merge: TypeError: hub.withThread is not a function
#     at attempt (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/app/auto-merge.js:22:13)
#     at Object.afterCheck (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/app/auto-merge.js:111:19)
#     at acceptCard (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/app/cards.js:313:65)
#     at async TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/test/app-check-card.test.js:35:3)
#     at async Test.run (node:internal/test_runner/test:1054:7)
#     at async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
# auto-merge: TypeError: hub.withThread is not a function
#     at attempt (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/app/auto-merge.js:22:13)
#     at Object.afterCheck (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/app/auto-merge.js:111:19)
#     at acceptCard (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/app/cards.js:313:65)
#     at async TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/test/app-check-card.test.js:36:140)
#     at async Test.run (node:internal/test_runner/test:1054:7)
#     at async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
# Subtest: designer reopens on starter delivery and owes a result after a status
ok 114 - designer reopens on starter delivery and owes a result after a status
  ---
  duration_ms: 883.474407
  type: 'test'
  ...
# Subtest: another sender does not reopen a designer
ok 115 - another sender does not reopen a designer
  ---
  duration_ms: 1151.244966
  type: 'test'
  ...
# Subtest: a mapper remains finished after its starter follows up
ok 116 - a mapper remains finished after its starter follows up
  ---
  duration_ms: 884.82784
  type: 'test'
  ...
# Subtest: GET reports each machine, and POST forwards to all of them
ok 117 - GET reports each machine, and POST forwards to all of them
  ---
  duration_ms: 296.799174
  type: 'test'
  ...
# Subtest: one machine failing gives 502 with the per-machine map; the others keep the level
ok 118 - one machine failing gives 502 with the per-machine map; the others keep the level
  ---
  duration_ms: 164.576733
  type: 'test'
  ...
# Subtest: a machine that does not answer is "did not answer" within the timeout, on GET and POST
ok 119 - a machine that does not answer is "did not answer" within the timeout, on GET and POST
  ---
  duration_ms: 775.257396
  type: 'test'
  ...
# Subtest: a refused connection is "did not answer", and a bad level is 400 without calling machines
ok 120 - a refused connection is "did not answer", and a bad level is 400 without calling machines
  ---
  duration_ms: 173.922854
  type: 'test'
  ...
# Subtest: file card validation and machine relay storage
ok 121 - file card validation and machine relay storage
  ---
  duration_ms: 579.081422
  type: 'test'
  ...
# Subtest: live documents share listing and route eligibility
ok 122 - live documents share listing and route eligibility
  ---
  duration_ms: 448.414642
  type: 'test'
  ...
# Subtest: archived documents list is cached without a worktree and route reads the branch
ok 123 - archived documents list is cached without a worktree and route reads the branch
  ---
  duration_ms: 465.982088
  type: 'test'
  ...
# Subtest: archived listing follows branch tip and excludes oversized blobs
ok 124 - archived listing follows branch tip and excludes oversized blobs
  ---
  duration_ms: 119.500648
  type: 'test'
  ...
# Subtest: ZIP serves live and archived eligible documents and 404 for an empty plan
ok 125 - ZIP serves live and archived eligible documents and 404 for an empty plan
  ---
  duration_ms: 657.888586
  type: 'test'
  ...
# Subtest: merge state and identity decisions
ok 126 - merge state and identity decisions
  ---
  duration_ms: 2.418347
  type: 'test'
  ...
# Subtest: hub accepts a matching merged PR
ok 127 - hub accepts a matching merged PR
  ---
  duration_ms: 38.488844
  type: 'test'
  ...
# Subtest: invalid schema and URL skip gh, and refusal never writes the thread
ok 128 - invalid schema and URL skip gh, and refusal never writes the thread
  ---
  duration_ms: 10.401395
  type: 'test'
  ...
# Subtest: gh failures and authentication refusals
ok 129 - gh failures and authentication refusals
  ---
  duration_ms: 31.737147
  type: 'test'
  ...
# Subtest: slow gh does not hold the thread lock
ok 130 - slow gh does not hold the thread lock
  ---
  duration_ms: 3022.432969
  type: 'test'
  ...
# Subtest: target PR uses its head branch only for the exact URL
ok 131 - target PR uses its head branch only for the exact URL
  ---
  duration_ms: 0.446666
  type: 'test'
  ...
# Subtest: a session started while the poll waits for the thread lock is not reported ended
ok 132 - a session started while the poll waits for the thread lock is not reported ended
  ---
  duration_ms: 1376.398808
  type: 'test'
  ...
# Subtest: a session the machine could not check stays live; one gone from tmux ends
ok 133 - a session the machine could not check stays live; one gone from tmux ends
  ---
  duration_ms: 1457.825645
  type: 'test'
  ...
# Subtest: --replaces is refused while the old worker still runs in tmux
ok 134 - --replaces is refused while the old worker still runs in tmux
  ---
  duration_ms: 1958.898998
  type: 'test'
  ...
# Subtest: answers without waiting on a thread that is busy
ok 135 - answers without waiting on a thread that is busy
  ---
  duration_ms: 25.056346
  type: 'test'
  ...
# Subtest: saves a changed status under the lock, on a fresh read
ok 136 - saves a changed status under the lock, on a fresh read
  ---
  duration_ms: 15.768927
  type: 'test'
  ...
# Subtest: records a status from a fresh read under the lock
ok 137 - records a status from a fresh read under the lock
  ---
  duration_ms: 12.367195
  type: 'test'
  ...
# Subtest: validates input before inspecting and reports invalid JSON
ok 138 - validates input before inspecting and reports invalid JSON
  ---
  duration_ms: 2.725597
  type: 'test'
  ...
# Subtest: opens an existing thread on its own machine and project
ok 139 - opens an existing thread on its own machine and project
  ---
  duration_ms: 1.686454
  type: 'test'
  ...
# Subtest: rejects a mismatched repository and missing branch
ok 140 - rejects a mismatched repository and missing branch
  ---
  duration_ms: 0.858917
  type: 'test'
  ...
# Subtest: saved undo opens without inspecting or running it
ok 141 - saved undo opens without inspecting or running it
  ---
  duration_ms: 0.652872
  type: 'test'
  ...
# Subtest: checks the file stage at the exported head
ok 142 - checks the file stage at the exported head
  ---
  duration_ms: 0.747714
  type: 'test'
  ...
# Subtest: opens older and diverged files without changing the thread
ok 143 - opens older and diverged files without changing the thread
  ---
  duration_ms: 0.879336
  type: 'test'
  ...
# Subtest: refuses advancing a busy thread
ok 144 - refuses advancing a busy thread
  ---
  duration_ms: 0.629498
  type: 'test'
  ...
# Subtest: refuses an advanced remote tip
ok 145 - refuses an advanced remote tip
  ---
  duration_ms: 0.694531
  type: 'test'
  ...
# Subtest: Create claims in order, persists history, and restarts outside the lock
ok 146 - Create claims in order, persists history, and restarts outside the lock
  ---
  duration_ms: 72.902584
  type: 'test'
  ...
# Subtest: imports of one ID serialize into Create then Open
ok 147 - imports of one ID serialize into Create then Open
  ---
  duration_ms: 19.675007
  type: 'test'
  ...
# Subtest: Create refuses occupied machine, checked out and divergent branches
ok 148 - Create refuses occupied machine, checked out and divergent branches
  ---
  duration_ms: 49.525067
  type: 'test'
  ...
# Subtest: moved claim abandons the Create record
ok 149 - moved claim abandons the Create record
  ---
  duration_ms: 19.719032
  type: 'test'
  ...
# Subtest: saved Create and Advance validate first and resume without the route inspection
ok 150 - saved Create and Advance validate first and resume without the route inspection
  ---
  duration_ms: 36.084003
  type: 'test'
  ...
# Subtest: raw route rejects oversized bodies before invoking import
ok 151 - raw route rejects oversized bodies before invoking import
  ---
  duration_ms: 2.712721
  type: 'test'
  ...
# Subtest: invalid file shapes fail before any machine handoff call
ok 152 - invalid file shapes fail before any machine handoff call
  ---
  duration_ms: 45.552119
  type: 'test'
  ...
# Subtest: repository and branch failures precede creating a record
ok 153 - repository and branch failures precede creating a record
  ---
  duration_ms: 29.842745
  type: 'test'
  ...
# Subtest: Advance reopens retained and absent worktrees and retracts prior cards
ok 154 - Advance reopens retained and absent worktrees and retracts prior cards
  ---
  duration_ms: 26.0494
  type: 'test'
  ...
# Subtest: busy Advance preserves imported state, cards and pins; ended worker queue does not block
ok 155 - busy Advance preserves imported state, cards and pins; ended worker queue does not block
  ---
  duration_ms: 56.907253
  type: 'test'
  ...
# Subtest: own cancelled tip schedules revoke after releasing the lock and Open shows waiting note
ok 156 - own cancelled tip schedules revoke after releasing the lock and Open shows waiting note
  ---
  duration_ms: 8.940803
  type: 'test'
  ...
# Subtest: handed-off thread with unchanged tip offers Undo and passes retained checkout and fallback
ok 157 - handed-off thread with unchanged tip offers Undo and passes retained checkout and fallback
  ---
  duration_ms: 7.578963
  type: 'test'
  ...
# Subtest: dirty Advance refuses before claim and preserves prior imported content
ok 158 - dirty Advance refuses before claim and preserves prior imported content
  ---
  duration_ms: 10.844916
  type: 'test'
  ...
# Subtest: HTTP import returns 413 for an oversized file without recording a thread
ok 159 - HTTP import returns 413 for an oversized file without recording a thread
  ---
  duration_ms: 236.147742
  type: 'test'
  ...
# Subtest: invalid picker project returns the createThread sentence
ok 160 - invalid picker project returns the createThread sentence
  ---
  duration_ms: 13.807447
  type: 'test'
  ...
# Subtest: Advance stops an idle live lead before restarting
ok 161 - Advance stops an idle live lead before restarting
  ---
  duration_ms: 27.270011
  type: 'test'
  ...
# Subtest: Create starts a real imported lead with import context
ok 162 - Create starts a real imported lead with import context
  ---
  duration_ms: 453.238913
  type: 'test'
  ...
# Subtest: same-head archived thread opens unchanged and null relation explains missing checkout
ok 163 - same-head archived thread opens unchanged and null relation explains missing checkout
  ---
  duration_ms: 20.841905
  type: 'test'
  ...
# Subtest: Undo hint compares the remote tip to the handed-off head
ok 164 - Undo hint compares the remote tip to the handed-off head
  ---
  duration_ms: 0.663061
  type: 'test'
  ...
# Subtest: repository and containment errors use the specified status and sentence
ok 165 - repository and containment errors use the specified status and sentence
  ---
  duration_ms: 21.364577
  type: 'test'
  ...
# Subtest: imports both history versions and retries interrupted old history before export
ok 166 - imports both history versions and retries interrupted old history before export
  ---
  duration_ms: 69.310976
  type: 'test'
  ...
# Subtest: v3 imports valid lessons into target scope and ignores malformed entries; v2 imports none
ok 167 - v3 imports valid lessons into target scope and ignores malformed entries; v2 imports none
  ---
  duration_ms: 71.85234
  type: 'test'
  ...
# Subtest: opened and pending operation imports do not merge uploaded lessons
ok 168 - opened and pending operation imports do not merge uploaded lessons
  ---
  duration_ms: 39.438144
  type: 'test'
  ...
# Subtest: Retry of a pending operation does not merge lessons
ok 169 - Retry of a pending operation does not merge lessons
  ---
  duration_ms: 13.247813
  type: 'test'
  ...
# Subtest: Advance merges lessons into the existing thread project
ok 170 - Advance merges lessons into the existing thread project
  ---
  duration_ms: 31.670729
  type: 'test'
  ...
# Subtest: exported project lessons are scoped to the destination project
ok 171 - exported project lessons are scoped to the destination project
  ---
  duration_ms: 26.156747
  type: 'test'
  ...
# Subtest: startCreate and startAdvance do not merge file lessons
ok 172 - startCreate and startAdvance do not merge file lessons
  ---
  duration_ms: 34.170904
  type: 'test'
  ...
# Subtest: claim persists the commit before pushing and retries the same commit
ok 173 - claim persists the commit before pushing and retries the same commit
  ---
  duration_ms: 3.099012
  type: 'test'
  ...
# Subtest: preclaim refuses unsafe local branches and worktrees
ok 174 - preclaim refuses unsafe local branches and worktrees
  ---
  duration_ms: 0.82912
  type: 'test'
  ...
# Subtest: operation applies carried state after reopening, and restarts after completion
ok 175 - operation applies carried state after reopening, and restarts after completion
  ---
  duration_ms: 88.523367
  type: 'test'
  ...
# Subtest: failed reopen preserves operation and retry uses the original imported cutoff
ok 176 - failed reopen preserves operation and retry uses the original imported cutoff
  ---
  duration_ms: 22.918828
  type: 'test'
  ...
# Subtest: cancelled claim is retained after revoke and dismissed only after failure
ok 177 - cancelled claim is retained after revoke and dismissed only after failure
  ---
  duration_ms: 23.887456
  type: 'test'
  ...
# Subtest: each kind retries failed steps without creating a second claim
ok 178 - each kind retries failed steps without creating a second claim
  ---
  duration_ms: 186.623557
  type: 'test'
  ...
# Subtest: own cancelled claim schedules a revoke after releasing the thread lock
ok 179 - own cancelled claim schedules a revoke after releasing the thread lock
  ---
  duration_ms: 17.394876
  type: 'test'
  ...
# Subtest: revocation writes for different threads are serialized and an operation wins
ok 180 - revocation writes for different threads are serialized and an operation wins
  ---
  duration_ms: 26.745585
  type: 'test'
  ...
# Subtest: stop accepts an unknown managed session and refuses surviving tmux sessions
ok 181 - stop accepts an unknown managed session and refuses surviving tmux sessions
  ---
  duration_ms: 17.744597
  type: 'test'
  ...
# Subtest: undo and cancel routes enforce saved operation and frozen archive
ok 182 - undo and cancel routes enforce saved operation and frozen archive
  ---
  duration_ms: 306.091482
  type: 'test'
  ...
# Subtest: lost push response saves the claim and retries without another commit
ok 183 - lost push response saves the claim and retries without another commit
  ---
  duration_ms: 34.035985
  type: 'test'
  ...
# Subtest: moved claim abandons each kind and uses re-import wording
ok 184 - moved claim abandons each kind and uses re-import wording
  ---
  duration_ms: 37.979587
  type: 'test'
  ...
# Subtest: checkout failure is saved and reopen is called on open threads
ok 185 - checkout failure is saved and reopen is called on open threads
  ---
  duration_ms: 26.90418
  type: 'test'
  ...
# Subtest: revoke expiry, machine exceptions, repeated revocation, and dismissal
ok 186 - revoke expiry, machine exceptions, repeated revocation, and dismissal
  ---
  duration_ms: 22.923756
  type: 'test'
  ...
# Subtest: faults at every operation step converge to the uninterrupted record
ok 187 - faults at every operation step converge to the uninterrupted record
  ---
  duration_ms: 363.284824
  type: 'test'
  ...
# Subtest: undo retry and cancellation routes report moved claims and enforce claim boundary
ok 188 - undo retry and cancellation routes report moved claims and enforce claim boundary
  ---
  duration_ms: 1083.806249
  type: 'test'
  ...
# Subtest: failed revoke notice uses repository and survives handoff file sweep
ok 189 - failed revoke notice uses repository and survives handoff file sweep
  ---
  duration_ms: 230.866575
  type: 'test'
  ...
# Subtest: first preclaim refusals do not save operations; retry retains its error
ok 190 - first preclaim refusals do not save operations; retry retains its error
  ---
  duration_ms: 23.539638
  type: 'test'
  ...
# Subtest: first Undo saves inspect repository before its claim
ok 191 - first Undo saves inspect repository before its claim
  ---
  duration_ms: 43.909689
  type: 'test'
  ...
# Subtest: imported PR ignores older done cards and falls back to carried PR
ok 192 - imported PR ignores older done cards and falls back to carried PR
  ---
  duration_ms: 1.157239
  type: 'test'
  ...
# Subtest: startup repairs only partial imported lead starts and registers plans
ok 193 - startup repairs only partial imported lead starts and registers plans
  ---
  duration_ms: 100.918425
  type: 'test'
  ...
# Subtest: import restart saves context before launch, moves queues, and uses checkout SHA
ok 194 - import restart saves context before launch, moves queues, and uses checkout SHA
  ---
  duration_ms: 781.541205
  type: 'test'
  ...
# Subtest: import restart normalizes old owner tags in context and saved state
ok 195 - import restart normalizes old owner tags in context and saved state
  ---
  duration_ms: 750.902455
  type: 'test'
  ...
# Subtest: surviving orphan refuses restart without losing its queue
ok 196 - surviving orphan refuses restart without losing its queue
  ---
  duration_ms: 431.822166
  type: 'test'
  ...
# Subtest: ordinary restart with checkout SHA sends it to the machine
ok 197 - ordinary restart with checkout SHA sends it to the machine
  ---
  duration_ms: 763.595672
  type: 'test'
  ...
# Subtest: import context marker is presented in chat
ok 198 - import context marker is presented in chat
  ---
  duration_ms: 1.988212
  type: 'test'
  ...
# Subtest: merge watcher uses the imported PR over an old done card
ok 199 - merge watcher uses the imported PR over an old done card
  ---
  duration_ms: 8.225914
  type: 'test'
  ...
# Could not register plan: Error: registration failed
#     at Hub.registerPlan (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/test/app-handoff-restart.test.js:151:78)
#     at Hub.init (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/app/hub.js:76:26)
#     at async TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/test/app-handoff-restart.test.js:159:3)
#     at async Test.run (node:internal/test_runner/test:1054:7)
#     at async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
# Could not register plan: Error: registration failed
#     at Hub.registerPlan (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/test/app-handoff-restart.test.js:151:78)
#     at startSession (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/app/sessions.js:447:21)
#     at async Object.restartLead (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/app/threads.js:181:18)
# Could not register plan: Error: registration failed
#     at Hub.registerPlan (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/test/app-handoff-restart.test.js:151:78)
#     at startSession (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/app/sessions.js:447:21)
#     at async Object.restartLead (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/app/threads.js:181:18)
# Subtest: partial imported start is repaired, killed, and restarted twice with the right context
ok 200 - partial imported start is repaired, killed, and restarted twice with the right context
  ---
  duration_ms: 1140.082789
  type: 'test'
  ...
# Subtest: imported Claude lead receives context immediately on start
ok 201 - imported Claude lead receives context immediately on start
  ---
  duration_ms: 772.802626
  type: 'test'
  ...
# Subtest: imported waiting lead retries with checkout SHA and delivers context
ok 202 - imported waiting lead retries with checkout SHA and delivers context
  ---
  duration_ms: 786.406831
  type: 'test'
  ...
# Subtest: failed pending start retains non-context queue for the next restart and failed inspect is tolerated
ok 203 - failed pending start retains non-context queue for the next restart and failed inspect is tolerated
  ---
  duration_ms: 943.984081
  type: 'test'
  ...
# Subtest: ordinary chat and merge watcher retain their different done-card rules
ok 204 - ordinary chat and merge watcher retain their different done-card rules
  ---
  duration_ms: 466.650315
  type: 'test'
  ...
# Subtest: held peer messages follow context in normal and imported restart
ok 205 - held peer messages follow context in normal and imported restart
  ---
  duration_ms: 1462.972635
  type: 'test'
  ...
# Subtest: held peer queues do not make export busy and archive drops them
ok 206 - held peer queues do not make export busy and archive drops them
  ---
  duration_ms: 463.174731
  type: 'test'
  ...
# Subtest: archive drops held peer entries from a live lead but keeps ordinary entries
ok 207 - archive drops held peer entries from a live lead but keeps ordinary entries
  ---
  duration_ms: 407.32155
  type: 'test'
  ...
# Subtest: handoff validator checks schema, limits and unknown fields
ok 208 - handoff validator checks schema, limits and unknown fields
  ---
  duration_ms: 13.80922
  type: 'test'
  ...
# Subtest: history renders shown cards and skips hidden and progress cards
ok 209 - history renders shown cards and skips hidden and progress cards
  ---
  duration_ms: 1.19422
  type: 'test'
  ...
# Subtest: history accumulates, orders and trims entries, and names downloads
ok 210 - history accumulates, orders and trims entries, and names downloads
  ---
  duration_ms: 337.195526
  type: 'test'
  ...
# Subtest: machine client sends scripted handoff actions and times out
ok 211 - machine client sends scripted handoff actions and times out
  ---
  duration_ms: 68.433314
  type: 'test'
  ...
# Subtest: export reasons follow their order and committed stopping points
ok 212 - export reasons follow their order and committed stopping points
  ---
  duration_ms: 2.37249
  type: 'test'
  ...
# Subtest: frozen threads refuse mutation entry points and never deliver queued work
ok 213 - frozen threads refuse mutation entry points and never deliver queued work
  ---
  duration_ms: 656.98751
  type: 'test'
  ...
# Subtest: exports each stopping point, validates before pushing and freezes the thread
ok 214 - exports each stopping point, validates before pushing and freezes the thread
  ---
  duration_ms: 38.992048
  type: 'test'
  ...
# Subtest: push and save failures preserve retryability; a saved handoff survives lost save reply
ok 215 - push and save failures preserve retryability; a saved handoff survives lost save reply
  ---
  duration_ms: 26.990887
  type: 'test'
  ...
# Subtest: export route returns a downloadable JSON file
ok 216 - export route returns a downloadable JSON file
  ---
  duration_ms: 476.184101
  type: 'test'
  ...
# Subtest: export route reports a failed PR check without pushing
ok 217 - export route reports a failed PR check without pushing
  ---
  duration_ms: 454.06146
  type: 'test'
  ...
# Subtest: banner reports remote states and caches inspection
ok 218 - banner reports remote states and caches inspection
  ---
  duration_ms: 25.809079
  type: 'test'
  ...
# Subtest: download recovery selects matching head, and startup sweeps stray files
ok 219 - download recovery selects matching head, and startup sweeps stray files
  ---
  duration_ms: 29.835871
  type: 'test'
  ...
# Subtest: download waits for export to finish its rename
ok 220 - download waits for export to finish its rename
  ---
  duration_ms: 8.795486
  type: 'test'
  ...
# Subtest: an admitted upload blocks export until its stream completes
ok 221 - an admitted upload blocks export until its stream completes
  ---
  duration_ms: 563.616355
  type: 'test'
  ...
# Subtest: page status refresh is background, cached, skips archived and handed-off threads and retains prior results
ok 222 - page status refresh is background, cached, skips archived and handed-off threads and retains prior results
  ---
  duration_ms: 60.440256
  type: 'test'
  ...
# Subtest: export cancels asides found after the quiet check
ok 223 - export cancels asides found after the quiet check
  ---
  duration_ms: 16.612795
  type: 'test'
  ...
# Subtest: handoff banner HTTP route reports each state and the thread list marks handoff
ok 224 - handoff banner HTTP route reports each state and the thread list marks handoff
  ---
  duration_ms: 554.342391
  type: 'test'
  ...
# Subtest: validator rejects each malformed scalar and history limit
ok 225 - validator rejects each malformed scalar and history limit
  ---
  duration_ms: 3.351186
  type: 'test'
  ...
# Subtest: export uses session stop lifecycle and preserves recovery on rename failure
ok 226 - export uses session stop lifecycle and preserves recovery on rename failure
  ---
  duration_ms: 35.946629
  type: 'test'
  ...
# Subtest: slow banner inspection does not hold the thread lock
ok 227 - slow banner inspection does not hold the thread lock
  ---
  duration_ms: 17.726001
  type: 'test'
  ...
# Subtest: idea answers, retractions, imported anchor, approvals and sudo waiting set export eligibility
ok 228 - idea answers, retractions, imported anchor, approvals and sudo waiting set export eligibility
  ---
  duration_ms: 0.728256
  type: 'test'
  ...
# Subtest: done export supplies its PR URL and rejects a non-open PR
ok 229 - done export supplies its PR URL and rejects a non-open PR
  ---
  duration_ms: 11.489841
  type: 'test'
  ...
# Subtest: chat holds the thread lock through assembly while status refresh remains outside
ok 230 - chat holds the thread lock through assembly while status refresh remains outside
  ---
  duration_ms: 12.189043
  type: 'test'
  ...
# Subtest: handoff versions translate v1 and enforce their history labels
ok 231 - handoff versions translate v1 and enforce their history labels
  ---
  duration_ms: 0.992032
  type: 'test'
  ...
# Subtest: v3 exports only this thread’s lessons in transferable scope
ok 232 - v3 exports only this thread’s lessons in transferable scope
  ---
  duration_ms: 0.700763
  type: 'test'
  ...
# Subtest: export download includes exactly the saved lessons for the thread
ok 233 - export download includes exactly the saved lessons for the thread
  ---
  duration_ms: 38.260456
  type: 'test'
  ...
# Subtest: harness settings normalize and preserve fresh onboarding
ok 234 - harness settings normalize and preserve fresh onboarding
  ---
  duration_ms: 4.617033
  type: 'test'
  ...
# Subtest: switches, lead guard, waiting reason and harness status
ok 235 - switches, lead guard, waiting reason and harness status
  ---
  duration_ms: 1058.384734
  type: 'test'
  ...
# Subtest: cached status, placement and onboarding follow the installed CLI and enabled orders
ok 236 - cached status, placement and onboarding follow the installed CLI and enabled orders
  ---
  duration_ms: 3632.722876
  type: 'test'
  ...
# Subtest: install routes preserve machine responses and report unreachable machines
ok 237 - install routes preserve machine responses and report unreachable machines
  ---
  duration_ms: 3.656281
  type: 'test'
  ...
# Subtest: GET settings describes the harness switches
ok 238 - GET settings describes the harness switches
  ---
  duration_ms: 261.094498
  type: 'test'
  ...
# Subtest: switch and balancing writes guard the expanded lead order with the exact message
ok 239 - switch and balancing writes guard the expanded lead order with the exact message
  ---
  duration_ms: 347.412326
  type: 'test'
  ...
# Subtest: new leads and all ordered worker roles skip switched-off harnesses
ok 240 - new leads and all ordered worker roles skip switched-off harnesses
  ---
  duration_ms: 470.035178
  type: 'test'
  ...
# Subtest: a switched-off review family uses the existing fallback
ok 241 - a switched-off review family uses the existing fallback
  ---
  duration_ms: 117.600814
  type: 'test'
  ...
# Subtest: ready and pinned leads report the left-out harness; unpinned waits name an enabled one
ok 242 - ready and pinned leads report the left-out harness; unpinned waits name an enabled one
  ---
  duration_ms: 177.805478
  type: 'test'
  ...
# Subtest: status shape counts live threads, ignores paused and retired logins, and marks old recipes unknown
ok 243 - status shape counts live threads, ignores paused and retired logins, and marks old recipes unknown
  ---
  duration_ms: 434.273824
  type: 'test'
  ...
# Subtest: fresh harness status fetch clears cached machine status
ok 244 - fresh harness status fetch clears cached machine status
  ---
  duration_ms: 1376.269389
  type: 'test'
  ...
# Subtest: can_start reports orders, room, version, connectivity and the resolved hub hostname
ok 245 - can_start reports orders, room, version, connectivity and the resolved hub hostname
  ---
  duration_ms: 2068.610189
  type: 'test'
  ...
# Subtest: onboarding requires installation and sign-in on the same machine, saves completion, and short-circuits
ok 246 - onboarding requires installation and sign-in on the same machine, saves completion, and short-circuits
  ---
  duration_ms: 2241.498551
  type: 'test'
  ...
# Subtest: missing executable prevents placement and ranking identifies switched-off providers
ok 247 - missing executable prevents placement and ranking identifies switched-off providers
  ---
  duration_ms: 228.477451
  type: 'test'
  ...
# Subtest: lead reservation skips a switched-off provider
ok 248 - lead reservation skips a switched-off provider
  ---
  duration_ms: 0.284656
  type: 'test'
  ...
# Subtest: a live lead aside fork and an unanswered start retry survive switching off
ok 249 - a live lead aside fork and an unanswered start retry survive switching off
  ---
  duration_ms: 947.586019
  type: 'test'
  ...
# Subtest: wc session start prints the left-out waiting reason
ok 250 - wc session start prints the left-out waiting reason
  ---
  duration_ms: 55.823764
  type: 'test'
  ...
# Subtest: install forwarders retain every machine status and response body
ok 251 - install forwarders retain every machine status and response body
  ---
  duration_ms: 1.587835
  type: 'test'
  ...
# Subtest: install passthrough accepts DELETE and refuses POST while the harness is switched off
ok 252 - install passthrough accepts DELETE and refuses POST while the harness is switched off
  ---
  duration_ms: 4.97501
  type: 'test'
  ...
# Subtest: switching a harness off cancels its install on every known machine, without waiting
ok 253 - switching a harness off cancels its install on every known machine, without waiting
  ---
  duration_ms: 1324.056678
  type: 'test'
  ...
# Subtest: accepts a valid card for its own lead
ok 254 - accepts a valid card for its own lead
  ---
  duration_ms: 498.677714
  type: 'test'
  ...
# Subtest: validates progress stages and their counts
ok 255 - validates progress stages and their counts
  ---
  duration_ms: 2.107952
  type: 'test'
  ...
# Subtest: verify progress replaces build progress in the pin
ok 256 - verify progress replaces build progress in the pin
  ---
  duration_ms: 477.052847
  type: 'test'
  ...
# Subtest: stores an ISO timestamp on every card
ok 257 - stores an ISO timestamp on every card
  ---
  duration_ms: 454.463861
  type: 'test'
  ...
# Subtest: keeps initialized hub state on disk across a new Hub instance
ok 258 - keeps initialized hub state on disk across a new Hub instance
  ---
  duration_ms: 527.310037
  type: 'test'
  ...
# Subtest: uses the card CLI validator for a locally valid card
ok 259 - uses the card CLI validator for a locally valid card
  ---
  duration_ms: 0.530658
  type: 'test'
  ...
# Subtest: derives an opening title and lets only the lead rename it with title cards
ok 260 - derives an opening title and lets only the lead rename it with title cards
  ---
  duration_ms: 1431.854733
  type: 'test'
  ...
# Subtest: validates the optional question document name
ok 261 - validates the optional question document name
  ---
  duration_ms: 0.597105
  type: 'test'
  ...
# Subtest: refuses a card with an unknown field
ok 262 - refuses a card with an unknown field
  ---
  duration_ms: 472.851038
  type: 'test'
  ...
# Subtest: refuses a card a role may not emit
ok 263 - refuses a card a role may not emit
  ---
  duration_ms: 523.275438
  type: 'test'
  ...
# Subtest: refuses a card envelope with a session from another thread
ok 264 - refuses a card envelope with a session from another thread
  ---
  duration_ms: 691.972861
  type: 'test'
  ...
# Subtest: replaces a thread singleton card
ok 265 - replaces a thread singleton card
  ---
  duration_ms: 452.504482
  type: 'test'
  ...
# Subtest: refuses a second press on an answered question or offer and queues only the first
ok 266 - refuses a second press on an answered question or offer and queues only the first
  ---
  duration_ms: 436.724723
  type: 'test'
  ...
# Subtest: records a press and lets a lead resolve an open question only in its thread
ok 267 - records a press and lets a lead resolve an open question only in its thread
  ---
  duration_ms: 840.299369
  type: 'test'
  ...
# Subtest: limits offers to a second request after keep talking first
ok 268 - limits offers to a second request after keep talking first
  ---
  duration_ms: 1119.554218
  type: 'test'
  ...
# Subtest: routes a session message to the named target queue
ok 269 - routes a session message to the named target queue
  ---
  duration_ms: 702.797244
  type: 'test'
  ...
# Subtest: marks a result task finished and relays it to its starter
ok 270 - marks a result task finished and relays it to its starter
  ---
  duration_ms: 769.607885
  type: 'test'
  ...
# Subtest: holds a queued message until both readiness and a turn end
ok 271 - holds a queued message until both readiness and a turn end
  ---
  duration_ms: 456.419205
  type: 'test'
  ...
# Subtest: stamps when the user last wrote in a thread, and only for their messages
ok 272 - stamps when the user last wrote in a thread, and only for their messages
  ---
  duration_ms: 485.583419
  type: 'test'
  ...
# Subtest: stamps when the user answers a card, so the thread moves up the list
ok 273 - stamps when the user answers a card, so the thread moves up the list
  ---
  duration_ms: 448.39556
  type: 'test'
  ...
# Subtest: posts a permission need and holds the session queue while the prompt is open
ok 274 - posts a permission need and holds the session queue while the prompt is open
  ---
  duration_ms: 411.654988
  type: 'test'
  ...
# Subtest: a turn ending after a permission prompt clears the hold and the card
ok 275 - a turn ending after a permission prompt clears the hold and the card
  ---
  duration_ms: 452.413615
  type: 'test'
  ...
# Subtest: closes a permission need and resumes the queue
ok 276 - closes a permission need and resumes the queue
  ---
  duration_ms: 439.69743
  type: 'test'
  ...
# Subtest: posts and clears a stuck-session need
ok 277 - posts and clears a stuck-session need
  ---
  duration_ms: 415.078142
  type: 'test'
  ...
# Subtest: allows a lead to start only its permitted roles
ok 278 - allows a lead to start only its permitted roles
  ---
  duration_ms: 688.156114
  type: 'test'
  ...
# Subtest: refuses a second live sub-lead
ok 279 - refuses a second live sub-lead
  ---
  duration_ms: 620.115295
  type: 'test'
  ...
# Subtest: deduplicates a live start attempt
ok 280 - deduplicates a live start attempt
  ---
  duration_ms: 641.984458
  type: 'test'
  ...
# Subtest: two starts fired at once with one attempt id start one session
ok 281 - two starts fired at once with one attempt id start one session
  ---
  duration_ms: 885.041025
  type: 'test'
  ...
# Subtest: a start the machine never answered is asked again by name, and a retry returns it
ok 282 - a start the machine never answered is asked again by name, and a retry returns it
  ---
  duration_ms: 693.017294
  type: 'test'
  ...
# Subtest: a start unanswered twice answers 503, and the retry finds the same session
ok 283 - a start unanswered twice answers 503, and the retry finds the same session
  ---
  duration_ms: 829.018017
  type: 'test'
  ...
# Subtest: allows a lead to stop a session it started
ok 284 - allows a lead to stop a session it started
  ---
  duration_ms: 551.664196
  type: 'test'
  ...
# Subtest: starts a replacement lead after the old lead ends
ok 285 - starts a replacement lead after the old lead ends
  ---
  duration_ms: 577.674981
  type: 'test'
  ...
# Subtest: a fresh Claude lead with no first message takes its queue without a turn-ended event
ok 286 - a fresh Claude lead with no first message takes its queue without a turn-ended event
  ---
  duration_ms: 336.222291
  type: 'test'
  ...
# Subtest: puts restart context ahead of transferred queued messages
ok 287 - puts restart context ahead of transferred queued messages
  ---
  duration_ms: 519.66735
  type: 'test'
  ...
# Subtest: reports a dead worker to its starter
ok 288 - reports a dead worker to its starter
  ---
  duration_ms: 490.956516
  type: 'test'
  ...
# Subtest: raises Sessions ended when the lead dies
ok 289 - raises Sessions ended when the lead dies
  ---
  duration_ms: 332.323264
  type: 'test'
  ...
# Subtest: creates an unstarted stub and opens it after a role turn ends
ok 290 - creates an unstarted stub and opens it after a role turn ends
  ---
  duration_ms: 513.726368
  type: 'test'
  ...
# Subtest: stub lead follows lead order instead of inheriting its parent provider
ok 291 - stub lead follows lead order instead of inheriting its parent provider
  ---
  duration_ms: 498.739901
  type: 'test'
  ...
# Subtest: waits for a dependent stub until the parent merges
ok 292 - waits for a dependent stub until the parent merges
  ---
  duration_ms: 250.425134
  type: 'test'
  ...
# Subtest: opens a waiting stub after the 10-minute check finds its parent merged
ok 293 - opens a waiting stub after the 10-minute check finds its parent merged
  ---
  duration_ms: 413.838991
  type: 'test'
  ...
# Subtest: rechecks an approval in place and gates Start building on the fresh result
ok 294 - rechecks an approval in place and gates Start building on the fresh result
  ---
  duration_ms: 253.014659
  type: 'test'
  ...
# Subtest: asks the machine service to archive the thread
ok 295 - asks the machine service to archive the thread
  ---
  duration_ms: 229.519927
  type: 'test'
  ...
# Subtest: queues a card press as a lead message
ok 296 - queues a card press as a lead message
  ---
  duration_ms: 257.35981
  type: 'test'
  ...
# Subtest: reads archived MAP.md with git show from the thread branch
ok 297 - reads archived MAP.md with git show from the thread branch
  ---
  duration_ms: 257.558191
  type: 'test'
  ...
# Subtest: reads archived IDEA.md with git show from the thread branch
ok 298 - reads archived IDEA.md with git show from the thread branch
  ---
  duration_ms: 246.13673
  type: 'test'
  ...
# Subtest: reads archived PLAN.md with git show from the thread branch
ok 299 - reads archived PLAN.md with git show from the thread branch
  ---
  duration_ms: 237.833699
  type: 'test'
  ...
# Subtest: refuses archived documents outside MAP, IDEA and PLAN
ok 300 - refuses archived documents outside MAP, IDEA and PLAN
  ---
  duration_ms: 236.601356
  type: 'test'
  ...
# Subtest: finds a worktree plan slug on thread and chat routes
ok 301 - finds a worktree plan slug on thread and chat routes
  ---
  duration_ms: 263.459185
  type: 'test'
  ...
# Subtest: groups features by the current plan status and lists open needs
ok 302 - groups features by the current plan status and lists open needs
  ---
  duration_ms: 241.85012
  type: 'test'
  ...
# Subtest: returns every machine session and persists its last-seen time
ok 303 - returns every machine session and persists its last-seen time
  ---
  duration_ms: 244.063454
  type: 'test'
  ...
# Subtest: throttles persisted last-seen times and retries a failed write
ok 304 - throttles persisted last-seen times and retries a failed write
  ---
  duration_ms: 0.762612
  type: 'test'
  ...
# Subtest: proxies pane reads and raw terminal keys through the machine service
ok 305 - proxies pane reads and raw terminal keys through the machine service
  ---
  duration_ms: 250.710901
  type: 'test'
  ...
# Subtest: reads an unrecorded service pane but refuses its keys
ok 306 - reads an unrecorded service pane but refuses its keys
  ---
  duration_ms: 94.896896
  type: 'test'
  ...
# Subtest: refuses a browser write from the wrong origin
ok 307 - refuses a browser write from the wrong origin
  ---
  duration_ms: 84.300226
  type: 'test'
  ...
# Subtest: refuses a machine callback without its secret
ok 308 - refuses a machine callback without its secret
  ---
  duration_ms: 233.285186
  type: 'test'
  ...
# Subtest: a verifier the lead starts is pointed at the thread branch
ok 309 - a verifier the lead starts is pointed at the thread branch
  ---
  duration_ms: 429.788333
  type: 'test'
  ...
# Subtest: the chat reads the lead transcript through the machine service
ok 310 - the chat reads the lead transcript through the machine service
  ---
  duration_ms: 241.693559
  type: 'test'
  ...
# Subtest: Tool steps: Hide leaves the lead's tool calls out of the chat
ok 311 - Tool steps: Hide leaves the lead's tool calls out of the chat
  ---
  duration_ms: 259.351548
  type: 'test'
  ...
# Subtest: a verifier report from its transcript reaches the lead as its result
ok 312 - a verifier report from its transcript reaches the lead as its result
  ---
  duration_ms: 440.277756
  type: 'test'
  ...
# Subtest: a Codex verifier report comes from the notify payload when present, once
ok 313 - a Codex verifier report comes from the notify payload when present, once
  ---
  duration_ms: 428.471086
  type: 'test'
  ...
# Subtest: a mapper works in the thread worktree; a worker branches from the thread branch
ok 314 - a mapper works in the thread worktree; a worker branches from the thread branch
  ---
  duration_ms: 785.166201
  type: 'test'
  ...
# Subtest: models per role: leads, other agents, workers, aliases, and critical resolve through their provider cells
ok 315 - models per role: leads, other agents, workers, aliases, and critical resolve through their provider cells
  ---
  duration_ms: 2881.163812
  type: 'test'
  ...
# Subtest: models per role: Claude always gets a model and effort, and preferences reach the machine
ok 316 - models per role: Claude always gets a model and effort, and preferences reach the machine
  ---
  duration_ms: 654.285713
  type: 'test'
  ...
# Subtest: models per role: Claude family aliases do not become Codex tiers
ok 317 - models per role: Claude family aliases do not become Codex tiers
  ---
  duration_ms: 1174.093815
  type: 'test'
  ...
# Subtest: models per role: unknown tiers and unused provider cells are refused
ok 318 - models per role: unknown tiers and unused provider cells are refused
  ---
  duration_ms: 640.190394
  type: 'test'
  ...
# Subtest: no session starts while the machine service runs another commit
ok 319 - no session starts while the machine service runs another commit
  ---
  duration_ms: 548.473648
  type: 'test'
  ...
# Subtest: the Ready check covers only the thread family and uses account login status
ok 320 - the Ready check covers only the thread family and uses account login status
  ---
  duration_ms: 243.122216
  type: 'test'
  ...
# Subtest: projects.json records each thread project once and GET /projects lists them
ok 321 - projects.json records each thread project once and GET /projects lists them
  ---
  duration_ms: 507.507684
  type: 'test'
  ...
# Subtest: the sessions list passes unmanaged tmux sessions through as read-only
ok 322 - the sessions list passes unmanaged tmux sessions through as read-only
  ---
  duration_ms: 225.808677
  type: 'test'
  ...
# Subtest: serializes concurrent cards and de-duplicates a delivered card
ok 323 - serializes concurrent cards and de-duplicates a delivered card
  ---
  duration_ms: 234.789378
  type: 'test'
  ...
# Subtest: a failed event submit records its delivery id and leaves its queue for a later retry
ok 324 - a failed event submit records its delivery id and leaves its queue for a later retry
  ---
  duration_ms: 239.776521
  type: 'test'
  ...
# Subtest: a failed result-card submit is accepted, queued, and never rejected
ok 325 - a failed result-card submit is accepted, queued, and never rejected
  ---
  duration_ms: 394.952991
  type: 'test'
  ...
# Subtest: a browser message stays queued and reports delivery failure without failing its route
ok 326 - a browser message stays queued and reports delivery failure without failing its route
  ---
  duration_ms: 245.78983
  type: 'test'
  ...
# Subtest: a verifier report survives a failed submit and the queue timer retries it
ok 327 - a verifier report survives a failed submit and the queue timer retries it
  ---
  duration_ms: 457.578625
  type: 'test'
  ...
# Subtest: talking about an approval keeps it open for Needs you and Start building
ok 328 - talking about an approval keeps it open for Needs you and Start building
  ---
  duration_ms: 258.789478
  type: 'test'
  ...
# Subtest: successful submits record their destination, source, text, and time
ok 329 - successful submits record their destination, source, text, and time
  ---
  duration_ms: 238.691971
  type: 'test'
  ...
# Subtest: sent history keeps 500 entries and appends older entries beside the thread file
ok 330 - sent history keeps 500 entries and appends older entries beside the thread file
  ---
  duration_ms: 234.148268
  type: 'test'
  ...
# Subtest: restart context includes the latest twenty the user and card messages
ok 331 - restart context includes the latest twenty the user and card messages
  ---
  duration_ms: 356.636177
  type: 'test'
  ...
# Subtest: runs Codex preflight before a lead start and records its failure as a need
ok 332 - runs Codex preflight before a lead start and records its failure as a need
  ---
  duration_ms: 166.600576
  type: 'test'
  ...
# Subtest: terminal Enter marks its session busy before the next hook event
ok 333 - terminal Enter marks its session busy before the next hook event
  ---
  duration_ms: 231.384468
  type: 'test'
  ...
# Subtest: unreachable sessions are public and marked unreachable
ok 334 - unreachable sessions are public and marked unreachable
  ---
  duration_ms: 226.472339
  type: 'test'
  ...
# Subtest: a kept rebase makes a need and leaves the thread open
ok 335 - a kept rebase makes a need and leaves the thread open
  ---
  duration_ms: 230.356827
  type: 'test'
  ...
# Subtest: a second archive records the thread after a retained rebase worktree is removed
ok 336 - a second archive records the thread after a retained rebase worktree is removed
  ---
  duration_ms: 238.957149
  type: 'test'
  ...
# Subtest: serializes concurrent card and event arrivals without losing either
ok 337 - serializes concurrent card and event arrivals without losing either
  ---
  duration_ms: 254.504971
  type: 'test'
  ...
# Subtest: Features includes an opened stub but not an unopened one, and needs need no slug
ok 338 - Features includes an opened stub but not an unopened one, and needs need no slug
  ---
  duration_ms: 362.672401
  type: 'test'
  ...
# Subtest: stub commits persist and reach the opened lead context
ok 339 - stub commits persist and reach the opened lead context
  ---
  duration_ms: 364.808989
  type: 'test'
  ...
# Subtest: registers a diagram plan before persisting its card
ok 340 - registers a diagram plan before persisting its card
  ---
  duration_ms: 230.00883
  type: 'test'
  ...
# Subtest: a diagram card registers its graph for the real viewer iframe route
ok 341 - a diagram card registers its graph for the real viewer iframe route
  ---
  duration_ms: 235.652853
  type: 'test'
  ...
# Subtest: the real viewer keeps its boot commit when its clone moves before the first app request
ok 342 - the real viewer keeps its boot commit when its clone moves before the first app request
  ---
  duration_ms: 1565.457239
  type: 'test'
  ...
# Subtest: reachable Sessions responses do not expose tokens
ok 343 - reachable Sessions responses do not expose tokens
  ---
  duration_ms: 227.974239
  type: 'test'
  ...
# Subtest: a replacement sub-lead stops its predecessor worker, but a worker cannot stop a worker child
ok 344 - a replacement sub-lead stops its predecessor worker, but a worker cannot stop a worker child
  ---
  duration_ms: 713.874316
  type: 'test'
  ...
# Subtest: worker replacement reuses a dead worker worktree and branch only
ok 345 - worker replacement reuses a dead worker worktree and branch only
  ---
  duration_ms: 742.310862
  type: 'test'
  ...
# Subtest: validates a resolve card and the targets it may close
ok 346 - validates a resolve card and the targets it may close
  ---
  duration_ms: 0.591344
  type: 'test'
  ...
# Subtest: a lead resolve closes its needs card and removes it from the Needs strip
ok 347 - a lead resolve closes its needs card and removes it from the Needs strip
  ---
  duration_ms: 259.481101
  type: 'test'
  ...
# Subtest: a resolve is refused for a system card, another kind, another thread and a missing card
ok 348 - a resolve is refused for a system card, another kind, another thread and a missing card
  ---
  duration_ms: 398.95986
  type: 'test'
  ...
# Subtest: a resolve retried with the same delivery id is a duplicate
ok 349 - a resolve retried with the same delivery id is a duplicate
  ---
  duration_ms: 230.660558
  type: 'test'
  ...
# Subtest: keep going and talk about it close a lead needs card and reach the lead
ok 350 - keep going and talk about it close a lead needs card and reach the lead
  ---
  duration_ms: 253.236578
  type: 'test'
  ...
# Subtest: dismiss closes lead needs and refuses a live held system card
ok 351 - dismiss closes lead needs and refuses a live held system card
  ---
  duration_ms: 275.771879
  type: 'test'
  ...
# Subtest: worker effort overrides and escalation ceilings reject before starting
ok 352 - worker effort overrides and escalation ceilings reject before starting
  ---
  duration_ms: 1481.396966
  type: 'test'
  ...
# Subtest: a Kimi worker started with an effort stores none and sends none to the machine
ok 353 - a Kimi worker started with an effort stores none and sends none to the machine
  ---
  duration_ms: 718.500212
  type: 'test'
  ...
# Subtest: wc session start includes effort only when supplied
ok 354 - wc session start includes effort only when supplied
  ---
  duration_ms: 1.505206
  type: 'test'
  ...
# Subtest: restarting a failed lead answers its turn-failed card
ok 355 - restarting a failed lead answers its turn-failed card
  ---
  duration_ms: 353.258367
  type: 'test'
  ...
# Subtest: concurrent threads get distinct persisted names and session model
ok 356 - concurrent threads get distinct persisted names and session model
  ---
  duration_ms: 252.108704
  type: 'test'
  ...
# Subtest: hub startup backfills existing unnamed leads with distinct names
ok 357 - hub startup backfills existing unnamed leads with distinct names
  ---
  duration_ms: 373.588309
  type: 'test'
  ...
# Subtest: diagram formats and lead-only image cards validate and persist
ok 358 - diagram formats and lead-only image cards validate and persist
  ---
  duration_ms: 233.253329
  type: 'test'
  ...
# Subtest: uploads and files stream through the hub and enforce admission
ok 359 - uploads and files stream through the hub and enforce admission
  ---
  duration_ms: 1735.799191
  type: 'test'
  ...
# Subtest: a machine reset during an upload returns 409
ok 360 - a machine reset during an upload returns 409
  ---
  duration_ms: 1722.21024
  type: 'test'
  ...
# Subtest: archive keeps thread open on upload removal failure and archives after success
ok 361 - archive keeps thread open on upload removal failure and archives after success
  ---
  duration_ms: 233.429877
  type: 'test'
  ...
# Subtest: archived HTML route sends the static sandbox headers
ok 362 - archived HTML route sends the static sandbox headers
  ---
  duration_ms: 2.395904
  type: 'test'
  ...
# Subtest: send now hands a queued message to the lead mid-turn
ok 363 - send now hands a queued message to the lead mid-turn
  ---
  duration_ms: 255.59607
  type: 'test'
  ...
# Subtest: send now waits out a permission prompt
ok 364 - send now waits out a permission prompt
  ---
  duration_ms: 238.782731
  type: 'test'
  ...
# Subtest: retract validates targets, removes pins and refuses stale presses
ok 365 - retract validates targets, removes pins and refuses stale presses
  ---
  duration_ms: 477.738612
  type: 'test'
  ...
# Subtest: approval replacement skips Needs and pins persist until accepted start or retraction
ok 366 - approval replacement skips Needs and pins persist until accepted start or retraction
  ---
  duration_ms: 288.519209
  type: 'test'
  ...
# Subtest: a non-lead cannot retract, and a retracted offer stays in the conversation after a new offer
ok 367 - a non-lead cannot retract, and a retracted offer stays in the conversation after a new offer
  ---
  duration_ms: 390.648569
  type: 'test'
  ...
# Subtest: deferred validates, stays pinned and accepts only valid pull-backs
ok 368 - deferred validates, stays pinned and accepts only valid pull-backs
  ---
  duration_ms: 273.747253
  type: 'test'
  ...
# Subtest: restart context preserves stub summary and all card kinds
ok 369 - restart context preserves stub summary and all card kinds
  ---
  duration_ms: 489.366297
  type: 'test'
  ...
# Subtest: nonblocking system needs dismiss without notifying lead, including stale holds
ok 370 - nonblocking system needs dismiss without notifying lead, including stale holds
  ---
  duration_ms: 233.648936
  type: 'test'
  ...
# Subtest: restart context carries recent peer messages after import cutoff and omits empty history
ok 371 - restart context carries recent peer messages after import cutoff and omits empty history
  ---
  duration_ms: 479.102586
  type: 'test'
  ...
# Subtest: stub additions validate and append only to unopened candidates
ok 372 - stub additions validate and append only to unopened candidates
  ---
  duration_ms: 245.521871
  type: 'test'
  ...
# Subtest: archive sends only live lead files and records kept uploads on retry
ok 373 - archive sends only live lead files and records kept uploads on retry
  ---
  duration_ms: 608.724773
  type: 'test'
  ...
# Subtest: archive stays open while a fatal stop is pending, then retries successfully
ok 374 - archive stays open while a fatal stop is pending, then retries successfully
  ---
  duration_ms: 35.855635
  type: 'test'
  ...
# Subtest: Kimi transcript displays human, tool and reply while hiding role and thinking
ok 375 - Kimi transcript displays human, tool and reply while hiding role and thinking
  ---
  duration_ms: 4.586455
  type: 'test'
  ...
# Subtest: Kimi report selects a turn and orders the last step parts by block
ok 376 - Kimi report selects a turn and orders the last step parts by block
  ---
  duration_ms: 0.398624
  type: 'test'
  ...
# Subtest: Kimi report ignores stale and subagent turn ends
ok 377 - Kimi report ignores stale and subagent turn ends
  ---
  duration_ms: 0.390569
  type: 'test'
  ...
# Subtest: turn watermark drops retries and interrupted turn releases permission without report or reminder
ok 378 - turn watermark drops retries and interrupted turn releases permission without report or reminder
  ---
  duration_ms: 2.115126
  type: 'test'
  ...
# Subtest: confirming listing supplies ended reasons and pending stop stays live
ok 379 - confirming listing supplies ended reasons and pending stop stays live
  ---
  duration_ms: 1.451434
  type: 'test'
  ...
# Subtest: ended workers notify their starter and only those with a reason add a card
ok 380 - ended workers notify their starter and only those with a reason add a card
  ---
  duration_ms: 0.660367
  type: 'test'
  ...
# Subtest: confirmed fatal stops notify once while ordinary stops stay silent
ok 381 - confirmed fatal stops notify once while ordinary stops stay silent
  ---
  duration_ms: 0.761731
  type: 'test'
  ...
# Subtest: Kimi settings: defaults, plans, migration and review families
ok 382 - Kimi settings: defaults, plans, migration and review families
  ---
  duration_ms: 6.150313
  type: 'test'
  ...
# Subtest: Kimi through the Settings API: accounts, preferences, effort and slashed model pins
ok 383 - Kimi through the Settings API: accounts, preferences, effort and slashed model pins
  ---
  duration_ms: 678.194854
  type: 'test'
  ...
# Subtest: Ready: a per-CLI Kimi problem is the line; otherwise the first account problem; otherwise not logged in
ok 384 - Ready: a per-CLI Kimi problem is the line; otherwise the first account problem; otherwise not logged in
  ---
  duration_ms: 63.066202
  type: 'test'
  ...
# Subtest: Usage: one Kimi account signed in on one machine and with a problem on another
ok 385 - Usage: one Kimi account signed in on one machine and with a problem on another
  ---
  duration_ms: 25.215502
  type: 'test'
  ...
# Subtest: Usage: a named Kimi account with no home on a machine below the floor shows the version problem
ok 386 - Usage: a named Kimi account with no home on a machine below the floor shows the version problem
  ---
  duration_ms: 23.256295
  type: 'test'
  ...
# Subtest: OpenRouter Pi warning appears in usage and does not block Ready
ok 387 - OpenRouter Pi warning appears in usage and does not block Ready
  ---
  duration_ms: 17.769182
  type: 'test'
  ...
# Subtest: lead listing respects machine, project, reachability, links and summaries
ok 388 - lead listing respects machine, project, reachability, links and summaries
  ---
  duration_ms: 103.342583
  type: 'test'
  ...
# Subtest: discovers only candidate stubs with addition and dependency details
ok 389 - discovers only candidate stubs with addition and dependency details
  ---
  duration_ms: 12.701837
  type: 'test'
  ...
# Subtest: cross-thread refusals are ordered and store nothing
ok 390 - cross-thread refusals are ordered and store nothing
  ---
  duration_ms: 189.181122
  type: 'test'
  ...
# Subtest: restart routes to latest lead; cross-thread question is hidden in agents and chat
ok 391 - restart routes to latest lead; cross-thread question is hidden in agents and chat
  ---
  duration_ms: 23.757698
  type: 'test'
  ...
# Subtest: receiving chat hides cross-thread traffic and retains ordinary turns
ok 392 - receiving chat hides cross-thread traffic and retains ordinary turns
  ---
  duration_ms: 28.756492
  type: 'test'
  ...
# Subtest: workers cannot cross threads
ok 393 - workers cannot cross threads
  ---
  duration_ms: 14.559307
  type: 'test'
  ...
# Subtest: simultaneous legacy leads exchange messages without deadlock
ok 394 - simultaneous legacy leads exchange messages without deadlock
  ---
  duration_ms: 17.582687
  type: 'test'
  ...
# Subtest: a link on either side permits messages in both directions
ok 395 - a link on either side permits messages in both directions
  ---
  duration_ms: 69.606924
  type: 'test'
  ...
# Subtest: ended lead holds a peer message and logs only the send
ok 396 - ended lead holds a peer message and logs only the send
  ---
  duration_ms: 14.000035
  type: 'test'
  ...
# Subtest: lead ending between acceptance and delivery holds the message
ok 397 - lead ending between acceptance and delivery holds the message
  ---
  duration_ms: 22.958083
  type: 'test'
  ...
# Subtest: pause persists outside capped log until user activity and counts only recent sends
ok 398 - pause persists outside capped log until user activity and counts only recent sends
  ---
  duration_ms: 52.559314
  type: 'test'
  ...
# Subtest: user message and card press each lift a paused pair
ok 399 - user message and card press each lift a paused pair
  ---
  duration_ms: 60.797872
  type: 'test'
  ...
# Subtest: only sends after user activity count toward the pair limit
ok 400 - only sends after user activity count toward the pair limit
  ---
  duration_ms: 39.807222
  type: 'test'
  ...
# Subtest: accepted held message follows restart context on the new lead
ok 401 - accepted held message follows restart context on the new lead
  ---
  duration_ms: 1236.029802
  type: 'test'
  ...
# Subtest: successful submit records received and caps the peer log
ok 402 - successful submit records received and caps the peer log
  ---
  duration_ms: 51.85315
  type: 'test'
  ...
# Subtest: agent changes, restore, keep and normalization retain history
ok 403 - agent changes, restore, keep and normalization retain history
  ---
  duration_ms: 66.04861
  type: 'test'
  ...
# Subtest: Keep clears staleness without changing the saved lesson or history
ok 404 - Keep clears staleness without changing the saved lesson or history
  ---
  duration_ms: 7.541992
  type: 'test'
  ...
# Subtest: agent removal appends the current text to existing history
ok 405 - agent removal appends the current text to existing history
  ---
  duration_ms: 15.05128
  type: 'test'
  ...
# Subtest: a second merge skips a lesson already waiting
ok 406 - a second merge skips a lesson already waiting
  ---
  duration_ms: 11.606236
  type: 'test'
  ...
# Subtest: merge matches trimmed text in the same scope
ok 407 - merge matches trimmed text in the same scope
  ---
  duration_ms: 8.583589
  type: 'test'
  ...
# Subtest: history caps, removals, merge and waiting
ok 408 - history caps, removals, merge and waiting
  ---
  duration_ms: 459.03125
  type: 'test'
  ...
# Subtest: handoff projects and file routes
ok 409 - handoff projects and file routes
  ---
  duration_ms: 316.530479
  type: 'test'
  ...
# Subtest: user edits and removals, capacity, and history matching
ok 410 - user edits and removals, capacity, and history matching
  ---
  duration_ms: 278.632347
  type: 'test'
  ...
# Subtest: merge skips older versions of current and removed lessons
ok 411 - merge skips older versions of current and removed lessons
  ---
  duration_ms: 62.618163
  type: 'test'
  ...
# Subtest: file limits, known directories, waiting recheck and normalization
ok 412 - file limits, known directories, waiting recheck and normalization
  ---
  duration_ms: 243.94318
  type: 'test'
  ...
# Subtest: new ids avoid removed history and different project scopes remain distinct
ok 413 - new ids avoid removed history and different project scopes remain distinct
  ---
  duration_ms: 12.044125
  type: 'test'
  ...
# Subtest: restore preserves version scope and appends removed lessons
ok 414 - restore preserves version scope and appends removed lessons
  ---
  duration_ms: 24.66204
  type: 'test'
  ...
# Subtest: import avoids removed history ids
ok 415 - import avoids removed history ids
  ---
  duration_ms: 10.114275
  type: 'test'
  ...
# Subtest: waiting avoids removed history ids
ok 416 - waiting avoids removed history ids
  ---
  duration_ms: 12.760759
  type: 'test'
  ...
# Subtest: export contains exactly the specified fields
ok 417 - export contains exactly the specified fields
  ---
  duration_ms: 216.967684
  type: 'test'
  ...
# Subtest: merge validates authors, handles threads, and fills the twelfth slot
ok 418 - merge validates authors, handles threads, and fills the twelfth slot
  ---
  duration_ms: 21.115279
  type: 'test'
  ...
# Subtest: waiting actions select role and id and discard the requested entry
ok 419 - waiting actions select role and id and discard the requested entry
  ---
  duration_ms: 10.057686
  type: 'test'
  ...
# Subtest: normalization rejects invalid history authors and waiting sources
ok 420 - normalization rejects invalid history authors and waiting sources
  ---
  duration_ms: 0.517873
  type: 'test'
  ...
# Subtest: import refuses a newer lessons file version
ok 421 - import refuses a newer lessons file version
  ---
  duration_ms: 165.538265
  type: 'test'
  ...
# Subtest: restore scope after agent replacement
ok 422 - restore scope after agent replacement
  ---
  duration_ms: 53.303212
  type: 'test'
  ...
# Subtest: card schema and saver pairs
ok 423 - card schema and saver pairs
  ---
  duration_ms: 36.84415
  type: 'test'
  ...
# Subtest: sub-lead can save a worker lesson for another provider
ok 424 - sub-lead can save a worker lesson for another provider
  ---
  duration_ms: 11.975013
  type: 'test'
  ...
# Subtest: reviewers and verifiers cannot save lessons through the hub
ok 425 - reviewers and verifiers cannot save lessons through the hub
  ---
  duration_ms: 6.711971
  type: 'test'
  ...
# Subtest: scope, repeat safety, replacement, removal and user ownership
ok 426 - scope, repeat safety, replacement, removal and user ownership
  ---
  duration_ms: 73.494247
  type: 'test'
  ...
# Subtest: normalization, cap, prompts and preview
ok 427 - normalization, cap, prompts and preview
  ---
  duration_ms: 35.272236
  type: 'test'
  ...
# Subtest: lead roleLayers keeps reviewer, verifier, mapper and designer blocks
ok 428 - lead roleLayers keeps reviewer, verifier, mapper and designer blocks
  ---
  duration_ms: 0.457067
  type: 'test'
  ...
# Subtest: card.js lesson validation refuses reviewer and missing why
ok 429 - card.js lesson validation refuses reviewer and missing why
  ---
  duration_ms: 0.217377
  type: 'test'
  ...
# Subtest: settings PUT merges edits and removals over HTTP
ok 430 - settings PUT merges edits and removals over HTTP
  ---
  duration_ms: 343.434429
  type: 'test'
  ...
# Subtest: all saver and target pairs enforce the role matrix
ok 431 - all saver and target pairs enforce the role matrix
  ---
  duration_ms: 55.070119
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-3ed0f76fd125.slice
# Subtest: machine refuses an unconfirmed lesson without spooling it
ok 432 - machine refuses an unconfirmed lesson without spooling it
  ---
  duration_ms: 215.689082
  type: 'test'
  ...
# Subtest: "hub" names the installer-registered entry for this host's own service
ok 433 - "hub" names the installer-registered entry for this host's own service
  ---
  duration_ms: 35.705346
  type: 'test'
  ...
# Subtest: a lead waits when its machine passes the path check but cannot start it
ok 434 - a lead waits when its machine passes the path check but cannot start it
  ---
  duration_ms: 340.794045
  type: 'test'
  ...
# Subtest: a reachable machine that refuses a lead start records failure
ok 435 - a reachable machine that refuses a lead start records failure
  ---
  duration_ms: 777.487661
  type: 'test'
  ...
# --cli is ignored: the hub picks the provider
# Subtest: an unreachable machine leaves no thread and no projects.json entry
ok 436 - an unreachable machine leaves no thread and no projects.json entry
  ---
  duration_ms: 37.514044
  type: 'test'
  ...
# Subtest: wc.js passes worktree-remove through with the worker session, and requires a commit message
ok 437 - wc.js passes worktree-remove through with the worker session, and requires a commit message
  ---
  duration_ms: 1.771257
  type: 'test'
  ...
# Subtest: wc.js preserves git flags and the worker replacement option
ok 438 - wc.js preserves git flags and the worker replacement option
  ---
  duration_ms: 1.061846
  type: 'test'
  ...
# Subtest: a hub keeps the version captured at construction after its clone advances
ok 439 - a hub keeps the version captured at construction after its clone advances
  ---
  duration_ms: 56.416631
  type: 'test'
  ...
# Subtest: wc.js sends provider constraints and prints waiting and notice output
ok 440 - wc.js sends provider constraints and prints waiting and notice output
  ---
  duration_ms: 64.157665
  type: 'test'
  ...
# Subtest: MERGED posts exactly one card and marker; a second poll posts nothing
ok 441 - MERGED posts exactly one card and marker; a second poll posts nothing
  ---
  duration_ms: 70.658831
  type: 'test'
  ...
# Subtest: overlapping sweeps return immediately and call gh once per thread
ok 442 - overlapping sweeps return immediately and call gh once per thread
  ---
  duration_ms: 37.074552
  type: 'test'
  ...
# Subtest: archiving during gh leaves no merged card
ok 443 - archiving during gh leaves no merged card
  ---
  duration_ms: 42.64288
  type: 'test'
  ...
# Subtest: init resolves while gh is still running
ok 444 - init resolves while gh is still running
  ---
  duration_ms: 41.713377
  type: 'test'
  ...
# Subtest: OPEN, CLOSED and failing gh leave threads unchanged and do not throw
ok 445 - OPEN, CLOSED and failing gh leave threads unchanged and do not throw
  ---
  duration_ms: 54.694098
  type: 'test'
  ...
# Subtest: archived and invalid URLs are not checked; newest unreplaced done URL wins
ok 446 - archived and invalid URLs are not checked; newest unreplaced done URL wins
  ---
  duration_ms: 30.30456
  type: 'test'
  ...
# Subtest: merged needs attention until keep resolves without a live lead
ok 447 - merged needs attention until keep resolves without a live lead
  ---
  duration_ms: 30.000366
  type: 'test'
  ...
# Subtest: successful archive resolves merged cards; failed archive leaves them open
ok 448 - successful archive resolves merged cards; failed archive leaves them open
  ---
  duration_ms: 44.576898
  type: 'test'
  ...
# Subtest: card.js refuses merged from a session
ok 449 - card.js refuses merged from a session
  ---
  duration_ms: 63.904028
  type: 'test'
  ...
# Subtest: mockup fields and roles are validated
ok 450 - mockup fields and roles are validated
  ---
  duration_ms: 2.674539
  type: 'test'
  ...
# Subtest: CLI checks mockup files before asking for a token
ok 451 - CLI checks mockup files before asking for a token
  ---
  duration_ms: 214.132156
  type: 'test'
  ...
# Subtest: hub discovers and stores the plan while checking mockup files
ok 452 - hub discovers and stores the plan while checking mockup files
  ---
  duration_ms: 64.768485
  type: 'test'
  ...
# Subtest: GET /new-thread returns found repositories for the machine and passes folder_error on
ok 453 - GET /new-thread returns found repositories for the machine and passes folder_error on
  ---
  duration_ms: 286.906042
  type: 'test'
  ...
# Subtest: GET /new-thread asks for no folder when none is set
ok 454 - GET /new-thread asks for no folder when none is set
  ---
  duration_ms: 180.486349
  type: 'test'
  ...
# Subtest: GET /new-thread says an unreachable machine is not reachable and an old one needs updating
ok 455 - GET /new-thread says an unreachable machine is not reachable and an old one needs updating
  ---
  duration_ms: 220.493654
  type: 'test'
  ...
# Subtest: GET /new-thread lists hub first and folds the hub hostname entry into it
ok 456 - GET /new-thread lists hub first and folds the hub hostname entry into it
  ---
  duration_ms: 189.301713
  type: 'test'
  ...
# Subtest: GET /new-thread filters saved directories by machine
ok 457 - GET /new-thread filters saved directories by machine
  ---
  duration_ms: 213.302876
  type: 'test'
  ...
# Subtest: GET /new-thread previous comes from threads on that machine, newest first, hostname alias included
ok 458 - GET /new-thread previous comes from threads on that machine, newest first, hostname alias included
  ---
  duration_ms: 1371.853817
  type: 'test'
  ...
# Subtest: saved directories: add, duplicate 409, remove, remove unknown 404
ok 459 - saved directories: add, duplicate 409, remove, remove unknown 404
  ---
  duration_ms: 391.884812
  type: 'test'
  ...
# Subtest: saving a directory is refused with the check reason, and 502 when the machine does not answer
ok 460 - saving a directory is refused with the check reason, and 502 when the machine does not answer
  ---
  duration_ms: 260.008304
  type: 'test'
  ...
# Subtest: default_project_folder is trimmed, cleared by empty, and must be absolute or start with ~
ok 461 - default_project_folder is trimmed, cleared by empty, and must be absolute or start with ~
  ---
  duration_ms: 448.294609
  type: 'test'
  ...
# Subtest: starting a thread on a path the machine refuses leaves no thread and no projects.json entry
ok 462 - starting a thread on a path the machine refuses leaves no thread and no projects.json entry
  ---
  duration_ms: 146.572818
  type: 'test'
  ...
# Subtest: starting a thread stores the path the machine expanded
ok 463 - starting a thread stores the path the machine expanded
  ---
  duration_ms: 398.171807
  type: 'test'
  ...
# Subtest: a template scope may name a saved directory path, and settings lists it as a project
ok 464 - a template scope may name a saved directory path, and settings lists it as a project
  ---
  duration_ms: 247.080445
  type: 'test'
  ...
# Subtest: saved directories refuse . and .. as names and treat a malformed escape as unknown
ok 465 - saved directories refuse . and .. as names and treat a malformed escape as unknown
  ---
  duration_ms: 173.632535
  type: 'test'
  ...
# Subtest: Pi sample shows text and folded tool calls without thinking or system content
ok 466 - Pi sample shows text and folded tool calls without thinking or system content
  ---
  duration_ms: 3.988027
  type: 'test'
  ...
# Subtest: Pi report selects only the named assistant entry
ok 467 - Pi report selects only the named assistant entry
  ---
  duration_ms: 0.721834
  type: 'test'
  ...
# Subtest: completed Pi event delivers the named report to the starter
ok 468 - completed Pi event delivers the named report to the starter
  ---
  duration_ms: 6.078706
  type: 'test'
  ...
# Subtest: Pi sample completed entry reaches the starting session
ok 469 - Pi sample completed entry reaches the starting session
  ---
  duration_ms: 1.503803
  type: 'test'
  ...
# Subtest: Pi sample aborted entry delivers no report
ok 470 - Pi sample aborted entry delivers no report
  ---
  duration_ms: 0.59417
  type: 'test'
  ...
# Subtest: aborted and failed Pi turns deliver no report
ok 471 - aborted and failed Pi turns deliver no report
  ---
  duration_ms: 0.479269
  type: 'test'
  ...
# Subtest: an aborted first turn permits the second report
ok 472 - an aborted first turn permits the second report
  ---
  duration_ms: 1.180283
  type: 'test'
  ...
# Subtest: completed turns advance watermark, replay is ignored, and null abort cannot reuse a reply
ok 473 - completed turns advance watermark, replay is ignored, and null abort cannot reuse a reply
  ---
  duration_ms: 1.862701
  type: 'test'
  ...
# Subtest: rate-limit failures do not cool down the OpenRouter account and redacted errors reach the starter
ok 474 - rate-limit failures do not cool down the OpenRouter account and redacted errors reach the starter
  ---
  duration_ms: 0.722997
  type: 'test'
  ...
# Subtest: Pi chat response redacts synthetic keys from text and tool details
ok 475 - Pi chat response redacts synthetic keys from text and tool details
  ---
  duration_ms: 5.892428
  type: 'test'
  ...
# Subtest: OpenRouter settings defaults, migration and page display
ok 476 - OpenRouter settings defaults, migration and page display
  ---
  duration_ms: 5.775574
  type: 'test'
  ...
# Subtest: OpenRouter model IDs agree in the page and save route
ok 477 - OpenRouter model IDs agree in the page and save route
  ---
  duration_ms: 880.880499
  type: 'test'
  ...
# Subtest: OpenRouter effort pin round-trips through Settings; unknown level is refused
ok 478 - OpenRouter effort pin round-trips through Settings; unknown level is refused
  ---
  duration_ms: 1519.440989
  type: 'test'
  ...
# Subtest: a key-only waiting state shows the paste field with the key hint
ok 479 - a key-only waiting state shows the paste field with the key hint
  ---
  duration_ms: 1.390236
  type: 'test'
  ...
# Subtest: states with a link or without wantsCode keep the existing behaviour
ok 480 - states with a link or without wantsCode keep the existing behaviour
  ---
  duration_ms: 0.578529
  type: 'test'
  ...
# Subtest: the page treats key-only waiting like a link: the startup timeout stops, the key is a password field, 409 offers a restart for OpenRouter only
ok 481 - the page treats key-only waiting like a link: the startup timeout stops, the key is a password field, 409 offers a restart for OpenRouter only
  ---
  duration_ms: 2.548507
  type: 'test'
  ...
# Subtest: spend sums every account on every machine
ok 482 - spend sums every account on every machine
  ---
  duration_ms: 2.185591
  type: 'test'
  ...
# Subtest: all zero says no spend yet; unreachable and 404 machines mark it incomplete
ok 483 - all zero says no spend yet; unreachable and 404 machines mark it incomplete
  ---
  duration_ms: 1.823176
  type: 'test'
  ...
# Subtest: spend formatting
ok 484 - spend formatting
  ---
  duration_ms: 0.337467
  type: 'test'
  ...
# Subtest: OpenRouter accounts are never out of room, amber or alerting
ok 485 - OpenRouter accounts are never out of room, amber or alerting
  ---
  duration_ms: 0.976262
  type: 'test'
  ...
# Subtest: the usage route carries spend for OpenRouter only and a 404 machine is incomplete
ok 486 - the usage route carries spend for OpenRouter only and a 404 machine is incomplete
  ---
  duration_ms: 308.532752
  type: 'test'
  ...
# Subtest: normalizes all old thread fields in place and is idempotent
ok 487 - normalizes all old thread fields in place and is idempotent
  ---
  duration_ms: 2.486037
  type: 'test'
  ...
# Subtest: an app page without the remember cookie gets the sign-in page
ok 488 - an app page without the remember cookie gets the sign-in page
  ---
  duration_ms: 212.90894
  type: 'test'
  ...
# Subtest: the bookmark token signs a new browser in on an app page, and a wrong one does not
ok 489 - the bookmark token signs a new browser in on an app page, and a wrong one does not
  ---
  duration_ms: 134.331907
  type: 'test'
  ...
# Subtest: the document page is served behind the remember cookie like the other app pages
ok 490 - the document page is served behind the remember cookie like the other app pages
  ---
  duration_ms: 140.011807
  type: 'test'
  ...
# Subtest: the New thread page is served behind the remember cookie, with its assets
ok 491 - the New thread page is served behind the remember cookie, with its assets
  ---
  duration_ms: 124.019291
  type: 'test'
  ...
# Subtest: an unknown app page is not served
ok 492 - an unknown app page is not served
  ---
  duration_ms: 129.044657
  type: 'test'
  ...
# Subtest: asset names outside pages/ and vendor/, or climbing out, are refused
ok 493 - asset names outside pages/ and vendor/, or climbing out, are refused
  ---
  duration_ms: 129.750632
  type: 'test'
  ...
# Subtest: the existing page scripts are still served
ok 494 - the existing page scripts are still served
  ---
  duration_ms: 106.828797
  type: 'test'
  ...
# Subtest: app pages may frame this origin, for diagram cards
ok 495 - app pages may frame this origin, for diagram cards
  ---
  duration_ms: 1.008353
  type: 'test'
  ...
# Subtest: the old Sessions page redirects to Agents
ok 496 - the old Sessions page redirects to Agents
  ---
  duration_ms: 119.819308
  type: 'test'
  ...
# Subtest: the picture page is served behind the remember cookie with its assets
ok 497 - the picture page is served behind the remember cookie with its assets
  ---
  duration_ms: 160.546173
  type: 'test'
  ...
# Subtest: schema: lead only, both fields required, nothing else
ok 498 - schema: lead only, both fields required, nothing else
  ---
  duration_ms: 2.004995
  type: 'test'
  ...
# Subtest: refusals 1-9 and 4a, in order, and a refusal writes nothing
ok 499 - refusals 1-9 and 4a, in order, and a refusal writes nothing
  ---
  duration_ms: 133.505462
  type: 'test'
  ...
# Subtest: refusal 7: another thread by branch or by target_pr; not another project branch; yes another project target_pr
ok 500 - refusal 7: another thread by branch or by target_pr; not another project branch; yes another project target_pr
  ---
  duration_ms: 81.514827
  type: 'test'
  ...
# Subtest: refusals 8 and 9
ok 501 - refusals 8 and 9
  ---
  duration_ms: 75.086842
  type: 'test'
  ...
# Subtest: accepted card stores copied fields; Allow sets target_pr and tells the lead
ok 502 - accepted card stores copied fields; Allow sets target_pr and tells the lead
  ---
  duration_ms: 20.741472
  type: 'test'
  ...
# Subtest: Allow after another thread claimed the branch gives allow failed; Don't allow changes nothing
ok 503 - Allow after another thread claimed the branch gives allow failed; Don't allow changes nothing
  ---
  duration_ms: 36.35881
  type: 'test'
  ...
# Subtest: retract while open; a press on a withdrawn card is refused
ok 504 - retract while open; a press on a withdrawn card is refused
  ---
  duration_ms: 15.199926
  type: 'test'
  ...
# Subtest: an assistant press on a permit card is attributed
ok 505 - an assistant press on a permit card is attributed
  ---
  duration_ms: 53.231083
  type: 'test'
  ...
# Subtest: card opens, keeps id on same names, replaces on different names, closes on reset
ok 506 - card opens, keeps id on same names, replaces on different names, closes on reset
  ---
  duration_ms: 2245.125875
  type: 'test'
  ...
# Subtest: per-CLI and program lines are kept apart; a file line uses the name file
ok 507 - per-CLI and program lines are kept apart; a file line uses the name file
  ---
  duration_ms: 917.198999
  type: 'test'
  ...
# Subtest: more than 20 lines shows and N more; duplicates by text drop
ok 508 - more than 20 lines shows and N more; duplicates by text drop
  ---
  duration_ms: 921.831319
  type: 'test'
  ...
# Subtest: a line with underscores is kept byte-for-byte in items
ok 509 - a line with underscores is kept byte-for-byte in items
  ---
  duration_ms: 1055.77
  type: 'test'
  ...
# Subtest: seq and boot ordering
ok 510 - seq and boot ordering
  ---
  duration_ms: 2075.768814
  type: 'test'
  ...
# Subtest: project_tools is not left on the session record
ok 511 - project_tools is not left on the session record
  ---
  duration_ms: 1217.354709
  type: 'test'
  ...
# Subtest: applied in a queued promotion and in resumeUnanswered, without re-taking the lock
ok 512 - applied in a queued promotion and in resumeUnanswered, without re-taking the lock
  ---
  duration_ms: 904.481535
  type: 'test'
  ...
# Subtest: default wc.js session list shows project_tools on the lead entry
ok 513 - default wc.js session list shows project_tools on the lead entry
  ---
  duration_ms: 54.675131
  type: 'test'
  ...
# Subtest: with two lead sessions only the newest lead carries project_tools in the hub list
ok 514 - with two lead sessions only the newest lead carries project_tools in the hub list
  ---
  duration_ms: 818.426972
  type: 'test'
  ...
# Subtest: a new thread gets the default project_tools record when the machine start answer has none
ok 515 - a new thread gets the default project_tools record when the machine start answer has none
  ---
  duration_ms: 534.003883
  type: 'test'
  ...
# Subtest: a handoff import creates a thread with the default project_tools, even when the lead cannot start
ok 516 - a handoff import creates a thread with the default project_tools, even when the lead cannot start
  ---
  duration_ms: 17.902529
  type: 'test'
  ...
# Subtest: dismissed project tools card stays closed until problem names change
ok 517 - dismissed project tools card stays closed until problem names change
  ---
  duration_ms: 1625.136884
  type: 'test'
  ...
# Subtest: project tools routes forward requests and machine responses without storing keys
ok 518 - project tools routes forward requests and machine responses without storing keys
  ---
  duration_ms: 301.592244
  type: 'test'
  ...
# Subtest: project tools transport failures, validation and browser authorization
ok 519 - project tools transport failures, validation and browser authorization
  ---
  duration_ms: 225.076592
  type: 'test'
  ...
# Subtest: project tools forwards with a 120 second timeout
ok 520 - project tools forwards with a 120 second timeout
  ---
  duration_ms: 3.106497
  type: 'test'
  ...
# Subtest: machine replies keep multi-byte characters split across chunks
ok 521 - machine replies keep multi-byte characters split across chunks
  ---
  duration_ms: 58.236681
  type: 'test'
  ...
# Subtest: project tools forwards windows-status like the other routes
ok 522 - project tools forwards windows-status like the other routes
  ---
  duration_ms: 1.441895
  type: 'test'
  ...
# Subtest: read forwards the configured shared project and this machine’s saved paths
ok 523 - read forwards the configured shared project and this machine’s saved paths
  ---
  duration_ms: 211.891188
  type: 'test'
  ...
# Subtest: optional question fields validate and old cards remain valid
ok 524 - optional question fields validate and old cards remain valid
  ---
  duration_ms: 2.024472
  type: 'test'
  ...
# Subtest: acceptance tags asking messages and refuses invalid references within the thread
ok 525 - acceptance tags asking messages and refuses invalid references within the thread
  ---
  duration_ms: 5.866699
  type: 'test'
  ...
# Subtest: paths and waiting questions follow direct and relayed cards and close on replies
ok 526 - paths and waiting questions follow direct and relayed cards and close on replies
  ---
  duration_ms: 4.993194
  type: 'test'
  ...
# Subtest: agents hides raw activity state
ok 527 - agents hides raw activity state
  ---
  duration_ms: 27.206169
  type: 'test'
  ...
# Subtest: delivery ids identify stored cards and both duplicate paths
ok 528 - delivery ids identify stored cards and both duplicate paths
  ---
  duration_ms: 0.889175
  type: 'test'
  ...
# Subtest: about_thread is a question-only lowercase thread id
ok 529 - about_thread is a question-only lowercase thread id
  ---
  duration_ms: 0.348679
  type: 'test'
  ...
# Subtest: 1 first quiet turn nudges worker
ok 530 - 1 first quiet turn nudges worker
  ---
  duration_ms: 1409.130116
  type: 'test'
  ...
# Subtest: 2 second quiet turn nudges starter
ok 531 - 2 second quiet turn nudges starter
  ---
  duration_ms: 1239.878828
  type: 'test'
  ...
# Subtest: 3 third quiet turn creates and result closes card
ok 532 - 3 third quiet turn creates and result closes card
  ---
  duration_ms: 1320.454322
  type: 'test'
  ...
# Subtest: 4 timer escalates after starter told
ok 533 - 4 timer escalates after starter told
  ---
  duration_ms: 1795.7697
  type: 'test'
  ...
# Subtest: 5 late result within grace prevents nudge
ok 534 - 5 late result within grace prevents nudge
  ---
  duration_ms: 1802.013578
  type: 'test'
  ...
# Subtest: 6b status message without a question does not clear debt
ok 535 - 6b status message without a question does not clear debt
  ---
  duration_ms: 1139.499869
  type: 'test'
  ...
# Subtest: 6c finished agent answering a follow-up with a plain message is not nudged
ok 536 - 6c finished agent answering a follow-up with a plain message is not nudged
  ---
  duration_ms: 1242.824876
  type: 'test'
  ...
# Subtest: 6d worker question to the lead protects its waiting sub-lead
ok 537 - 6d worker question to the lead protects its waiting sub-lead
  ---
  duration_ms: 1297.245556
  type: 'test'
  ...
# Subtest: 6 message clears debt
ok 538 - 6 message clears debt
  ---
  duration_ms: 1461.204739
  type: 'test'
  ...
# Subtest: 7 child owing reply or waiting protects sub-lead
ok 539 - 7 child owing reply or waiting protects sub-lead
  ---
  duration_ms: 1729.727164
  type: 'test'
  ...
# Subtest: 8 reviewer empty report nudges, text reports
ok 540 - 8 reviewer empty report nudges, text reports
  ---
  duration_ms: 1677.122479
  type: 'test'
  ...
# Subtest: 9 lead is never watched
ok 541 - 9 lead is never watched
  ---
  duration_ms: 1016.827251
  type: 'test'
  ...
# Subtest: 10 stopping answers card
ok 542 - 10 stopping answers card
  ---
  duration_ms: 825.316285
  type: 'test'
  ...
# Subtest: 11 failed nudge is removed by result
ok 543 - 11 failed nudge is removed by result
  ---
  duration_ms: 904.724691
  type: 'test'
  ...
# Subtest: 12 timer starts on delivery to held starter
ok 544 - 12 timer starts on delivery to held starter
  ---
  duration_ms: 1719.843208
  type: 'test'
  ...
# Subtest: 13 re-messaged finished child protects sub-lead
ok 545 - 13 re-messaged finished child protects sub-lead
  ---
  duration_ms: 918.575677
  type: 'test'
  ...
# Subtest: 14 due check survives needs hold
ok 546 - 14 due check survives needs hold
  ---
  duration_ms: 843.446134
  type: 'test'
  ...
# Subtest: 15 child question does not protect starter
ok 547 - 15 child question does not protect starter
  ---
  duration_ms: 683.766969
  type: 'test'
  ...
# Subtest: 16 quiet turn waits for queued starter reminder
ok 548 - 16 quiet turn waits for queued starter reminder
  ---
  duration_ms: 981.047945
  type: 'test'
  ...
# Subtest: 17 dead starter escalates queued reminder
ok 549 - 17 dead starter escalates queued reminder
  ---
  duration_ms: 774.290496
  type: 'test'
  ...
# Subtest: 18 queued child answer protects starter
ok 550 - 18 queued child answer protects starter
  ---
  duration_ms: 902.722845
  type: 'test'
  ...
# Subtest: starter message resets open or dismissed quiet card on acceptance and stays queued
ok 551 - starter message resets open or dismissed quiet card on acceptance and stays queued
  ---
  duration_ms: 591.898838
  type: 'test'
  ...
# Subtest: child starts reset quiet card on new and duplicate starts, but not refusal
ok 552 - child starts reset quiet card on new and duplicate starts, but not refusal
  ---
  duration_ms: 766.217985
  type: 'test'
  ...
# Subtest: starter message before warning leaves quiet stage unchanged
ok 553 - starter message before warning leaves quiet stage unchanged
  ---
  duration_ms: 578.344095
  type: 'test'
  ...
# Subtest: retry of unanswered child start resets its starter after success
ok 554 - retry of unanswered child start resets its starter after success
  ---
  duration_ms: 588.911077
  type: 'test'
  ...
# Subtest: app queue messages do not close a quiet card
ok 555 - app queue messages do not close a quiet card
  ---
  duration_ms: 586.94114
  type: 'test'
  ...
# Subtest: dismissed quiet episode rearms the ladder after starter message or child start
ok 556 - dismissed quiet episode rearms the ladder after starter message or child start
  ---
  duration_ms: 1821.058607
  type: 'test'
  ...
# Subtest: validation and ordered post refusals
ok 557 - validation and ordered post refusals
  ---
  duration_ms: 207.650648
  type: 'test'
  ...
# Subtest: allow links only sender and permits reply, and handoff and Needs reflect state
ok 558 - allow links only sender and permits reply, and handoff and Needs reflect state
  ---
  duration_ms: 29.946203
  type: 'test'
  ...
# Subtest: target changes, existing links and denial
ok 559 - target changes, existing links and denial
  ---
  duration_ms: 82.522469
  type: 'test'
  ...
# Subtest: retraction, bad presses and missing lead leave no link
ok 560 - retraction, bad presses and missing lead leave no link
  ---
  duration_ms: 27.658887
  type: 'test'
  ...
# Subtest: remote document and ZIP use machine for live and archived threads, mapping failures
ok 561 - remote document and ZIP use machine for live and archived threads, mapping failures
  ---
  duration_ms: 639.328184
  type: 'test'
  ...
# Subtest: refresh checks its snapshot and never starts a machine call under the lock
ok 562 - refresh checks its snapshot and never starts a machine call under the lock
  ---
  duration_ms: 34.006208
  type: 'test'
  ...
# Subtest: real plan-file callers do not start or await machine requests under a thread lock
ok 563 - real plan-file callers do not start or await machine requests under a thread lock
  ---
  duration_ms: 3608.919017
  type: 'test'
  ...
# Subtest: remote refresh saves committed status for Features
ok 564 - remote refresh saves committed status for Features
  ---
  duration_ms: 532.322954
  type: 'test'
  ...
# Subtest: remote refresh does not record a target PR plan, including a target set during discovery
ok 565 - remote refresh does not record a target PR plan, including a target set during discovery
  ---
  duration_ms: 104.150211
  type: 'test'
  ...
# Subtest: report retries a failed read and delivers exactly once
ok 566 - report retries a failed read and delivers exactly once
  ---
  duration_ms: 8.790656
  type: 'test'
  ...
# Subtest: Pi retries an empty transcript until its entry arrives
ok 567 - Pi retries an empty transcript until its entry arrives
  ---
  duration_ms: 3.718059
  type: 'test'
  ...
# Subtest: absent non-Pi transcript reads once and arms quiet; failures exhaust retries
ok 568 - absent non-Pi transcript reads once and arms quiet; failures exhaust retries
  ---
  duration_ms: 1.785924
  type: 'test'
  ...
# Subtest: deadline boundary skips the gap at 749ms and permits it at 750ms
ok 569 - deadline boundary skips the gap at 749ms and permits it at 750ms
  ---
  duration_ms: 1.393021
  type: 'test'
  ...
# Subtest: strict absence falls back locally and failed local reads throw
ok 570 - strict absence falls back locally and failed local reads throw
  ---
  duration_ms: 20.975923
  type: 'test'
  ...
# Subtest: strict request cuts off dribbling response at its wall cap
ok 571 - strict request cuts off dribbling response at its wall cap
  ---
  duration_ms: 134.140739
  type: 'test'
  ...
# Subtest: timeout and dropped response after headers are retried
ok 572 - timeout and dropped response after headers are retried
  ---
  duration_ms: 3029.660935
  type: 'test'
  ...
# Subtest: session title, brief, timing and history routes
ok 573 - session title, brief, timing and history routes
  ---
  duration_ms: 1093.793466
  type: 'test'
  ...
# Subtest: pane forwards history unchanged to the machine
ok 574 - pane forwards history unchanged to the machine
  ---
  duration_ms: 18.084769
  type: 'test'
  ...
# Subtest: title normalization and session lifecycle timestamps
ok 575 - title normalization and session lifecycle timestamps
  ---
  duration_ms: 1541.034122
  type: 'test'
  ...
# Subtest: open and restart responses filter every session, including waiting stub wrapper
ok 576 - open and restart responses filter every session, including waiting stub wrapper
  ---
  duration_ms: 2.02353
  type: 'test'
  ...
# Subtest: archive records end times and preserves existing values on success and partial failure
ok 577 - archive records end times and preserves existing values on success and partial failure
  ---
  duration_ms: 1.443718
  type: 'test'
  ...
# Subtest: review round is validated before dedupe and retained on retry
ok 578 - review round is validated before dedupe and retained on retry
  ---
  duration_ms: 835.487804
  type: 'test'
  ...
# Subtest: settings defaults, templates, prompt composition, counts, and validation
ok 579 - settings defaults, templates, prompt composition, counts, and validation
  ---
  duration_ms: 1990.985651
  type: 'test'
  ...
# Subtest: settings prompt preview composes role and card rule placeholders by role
ok 580 - settings prompt preview composes role and card rule placeholders by role
  ---
  duration_ms: 192.987741
  type: 'test'
  ...
# Subtest: style saving, trailer delivery, chat stripping, and preview stay scoped to leads
ok 581 - style saving, trailer delivery, chat stripping, and preview stay scoped to leads
  ---
  duration_ms: 1071.156235
  type: 'test'
  ...
# Subtest: settings updates serialize concurrent saves and report a missing template project
ok 582 - settings updates serialize concurrent saves and report a missing template project
  ---
  duration_ms: 290.000826
  type: 'test'
  ...
# Subtest: the role-layer cap refuses template and style saves without changing settings
ok 583 - the role-layer cap refuses template and style saves without changing settings
  ---
  duration_ms: 176.63883
  type: 'test'
  ...
# Subtest: preview has a 75-second machine timeout while ordinary calls retain five seconds
ok 584 - preview has a 75-second machine timeout while ordinary calls retain five seconds
  ---
  duration_ms: 6.5553
  type: 'test'
  ...
# Subtest: settings model and heads-up routes reject bad input and preserve the settings file mode
ok 585 - settings model and heads-up routes reject bad input and preserve the settings file mode
  ---
  duration_ms: 1548.079487
  type: 'test'
  ...
# Subtest: template scopes must be listed when added or changed, while removed-project templates remain editable
ok 586 - template scopes must be listed when added or changed, while removed-project templates remain editable
  ---
  duration_ms: 174.710522
  type: 'test'
  ...
# Subtest: escalation settings, sentences, and role layers
ok 587 - escalation settings, sentences, and role layers
  ---
  duration_ms: 295.756341
  type: 'test'
  ...
# Subtest: lead name settings trim and validate names
ok 588 - lead name settings trim and validate names
  ---
  duration_ms: 358.976697
  type: 'test'
  ...
# Subtest: lead name list choice saves, validates and migrates
ok 589 - lead name list choice saves, validates and migrates
  ---
  duration_ms: 384.637232
  type: 'test'
  ...
# Subtest: gemini settings migrate and enforce account and model rules
ok 590 - gemini settings migrate and enforce account and model rules
  ---
  duration_ms: 288.140928
  type: 'test'
  ...
# Subtest: removed worker providers stay removed after saving
ok 591 - removed worker providers stay removed after saving
  ---
  duration_ms: 306.664237
  type: 'test'
  ...
# Subtest: scout preferences and session layers follow the selected provider
ok 592 - scout preferences and session layers follow the selected provider
  ---
  duration_ms: 1366.952565
  type: 'test'
  ...
# Subtest: model ID limits protect near-limit scout role layers
ok 593 - model ID limits protect near-limit scout role layers
  ---
  duration_ms: 892.169305
  type: 'test'
  ...
# Subtest: your name is saved, validated, and told to every agent only when set
ok 594 - your name is saved, validated, and told to every agent only when set
  ---
  duration_ms: 417.001901
  type: 'test'
  ...
# Subtest: shared tools project choice saves and clears
ok 595 - shared tools project choice saves and clears
  ---
  duration_ms: 295.978845
  type: 'test'
  ...
# Subtest: shared tools setting defaults, validates and saves
ok 596 - shared tools setting defaults, validates and saves
  ---
  duration_ms: 514.423825
  type: 'test'
  ...
# Subtest: folder problem lines appear and clear on a newer update
ok 597 - folder problem lines appear and clear on a newer update
  ---
  duration_ms: 2.565489
  type: 'test'
  ...
# Subtest: session start sends this machine’s saved paths in order and omits an unset choice
ok 598 - session start sends this machine’s saved paths in order and omits an unset choice
  ---
  duration_ms: 757.411252
  type: 'test'
  ...
# Subtest: ready event updates folder problem card
not ok 599 - ready event updates folder problem card
  ---
  duration_ms: 436.213694
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/test/app-shared-tools-setting.test.js:43:1'
  failureType: 'testCodeFailure'
  error: "Cannot read properties of undefined (reading 'some')"
  code: 'ERR_TEST_FAILURE'
  name: 'TypeError'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-7fac691ef321-w11/viewer/test/app-shared-tools-setting.test.js:50:27)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# warning: You appear to have cloned an empty repository.
# Subtest: an untracked new plan directory is the thread plan, not an existing one
ok 600 - an untracked new plan directory is the thread plan, not an existing one
  ---
  duration_ms: 172.71677
  type: 'test'
  ...
# warning: You appear to have cloned an empty repository.
# Subtest: a plan directory committed on the thread branch is found against its upstream
ok 601 - a plan directory committed on the thread branch is found against its upstream
  ---
  duration_ms: 171.318028
  type: 'test'
  ...
# warning: You appear to have cloned an empty repository.
# Subtest: an edited file in an existing plan directory does not claim that plan
ok 602 - an edited file in an existing plan directory does not claim that plan
  ---
  duration_ms: 146.497574
  type: 'test'
  ...
# warning: You appear to have cloned an empty repository.
# Subtest: a file committed into an existing plan directory does not claim that plan
ok 603 - a file committed into an existing plan directory does not claim that plan
  ---
  duration_ms: 124.570598
  type: 'test'
  ...
# warning: You appear to have cloned an empty repository.
# Preparing worktree (new branch 'wc/no-track')
# Subtest: finds a committed plan on a no-track worktree branch against origin/default
ok 604 - finds a committed plan on a no-track worktree branch against origin/default
  ---
  duration_ms: 131.575391
  type: 'test'
  ...
# warning: You appear to have cloned an empty repository.
# Subtest: finding the slug registers the plan directory once
ok 605 - finding the slug registers the plan directory once
  ---
  duration_ms: 116.752837
  type: 'test'
  ...
# Subtest: an archived thread whose worktree is gone is not searched for a slug
ok 606 - an archived thread whose worktree is gone is not searched for a slug
  ---
  duration_ms: 3.058996
  type: 'test'
  ...
# warning: You appear to have cloned an empty repository.
# Subtest: an archived thread whose worktree the archive left behind is still searched
ok 607 - an archived thread whose worktree the archive left behind is still searched
  ---
  duration_ms: 121.585584
  type: 'test'
  ...
# warning: You appear to have cloned an empty repository.
# Subtest: target PR threads never discover a local plan
ok 608 - target PR threads never discover a local plan
  ---
  duration_ms: 92.080518
  type: 'test'
  ...
# Subtest: open permit appears in Needs you with its PR number
ok 609 - open permit appears in Needs you with its PR number
  ---
  duration_ms: 0.895678
  type: 'test'
  ...
# Subtest: thread snapshots track external and internal changes and are frozen
ok 610 - thread snapshots track external and internal changes and are frozen
  ---
  duration_ms: 2292.98357
  type: 'test'
  ...
# Subtest: recent rewrites are reread and settled files reuse their cached record
ok 611 - recent rewrites are reread and settled files reuse their cached record
  ---
  duration_ms: 2216.181072
  type: 'test'
  ...
# Subtest: list matches the captured response without rereading unchanged files
ok 612 - list matches the captured response without rereading unchanged files
  ---
  duration_ms: 2222.141936
  type: 'test'
  ...
# Subtest: slug discovery is read-only and missing or already present slugs return null
ok 613 - slug discovery is read-only and missing or already present slugs return null
  ---
  duration_ms: 0.333109
  type: 'test'
  ...
# Subtest: legacy provider migration is persisted by list and chat
ok 614 - legacy provider migration is persisted by list and chat
  ---
  duration_ms: 2228.864681
  type: 'test'
  ...
# Subtest: chat reuses thread and parent snapshots under the lock
ok 615 - chat reuses thread and parent snapshots under the lock
  ---
  duration_ms: 4418.736884
  type: 'test'
  ...
# Subtest: list joins all locks at once and overlays the fresh record on the listing
ok 616 - list joins all locks at once and overlays the fresh record on the listing
  ---
  duration_ms: 2212.024031
  type: 'test'
  ...
# Subtest: discovery is read-only and the list saves and returns a discovered slug
ok 617 - discovery is read-only and the list saves and returns a discovered slug
  ---
  duration_ms: 2264.246281
  type: 'test'
  ...
# Subtest: a save finishing during listing appears after joining the thread lock
ok 618 - a save finishing during listing appears after joining the thread lock
  ---
  duration_ms: 2211.198925
  type: 'test'
  ...
# Subtest: a failed queued operation reaches its caller and leaves the process running
ok 619 - a failed queued operation reaches its caller and leaves the process running
  ---
  duration_ms: 169.962409
  type: 'test'
  ...
# Subtest: approval warnings are optional machine-only bounded non-empty strings
ok 620 - approval warnings are optional machine-only bounded non-empty strings
  ---
  duration_ms: 2.950097
  type: 'test'
  ...
# Subtest: the hub stores machine approval warnings
ok 621 - the hub stores machine approval warnings
  ---
  duration_ms: 550.222549
  type: 'test'
  ...
# Subtest: sudo validation: the agent sends only command, does and why
ok 622 - sudo validation: the agent sends only command, does and why
  ---
  duration_ms: 0.553191
  type: 'test'
  ...
# Subtest: sudo validation: agent-side role check refuses everyone but a lead
ok 623 - sudo validation: agent-side role check refuses everyone but a lead
  ---
  duration_ms: 0.221134
  type: 'test'
  ...
# Subtest: sudo validation: a machine-posted card needs the machine-added fields
ok 624 - sudo validation: a machine-posted card needs the machine-added fields
  ---
  duration_ms: 0.45876
  type: 'test'
  ...
# Subtest: the hub stores a lead sudo card as waiting and indexes its request_id
ok 625 - the hub stores a lead sudo card as waiting and indexes its request_id
  ---
  duration_ms: 463.597653
  type: 'test'
  ...
# Subtest: the hub refuses a sudo card from a non-lead, without machine fields, or for a repeat request
ok 626 - the hub refuses a sudo card from a non-lead, without machine fields, or for a repeat request
  ---
  duration_ms: 486.272923
  type: 'test'
  ...
# Subtest: a redelivered sudo card with the same delivery_id answers 200 and makes no second card
ok 627 - a redelivered sudo card with the same delivery_id answers 200 and makes no second card
  ---
  duration_ms: 475.232703
  type: 'test'
  ...
# Subtest: sudo-outcome: unknown request is 409, a bad body 400, and the machine secret is required
ok 628 - sudo-outcome: unknown request is 409, a bad body 400, and the machine secret is required
  ---
  duration_ms: 542.111564
  type: 'test'
  ...
# Subtest: sudo-outcome ran: sets the result and tells the lead once, with the output
ok 629 - sudo-outcome ran: sets the result and tells the lead once, with the output
  ---
  duration_ms: 621.812623
  type: 'test'
  ...
# Subtest: sudo-outcome: each terminal state reaches the lead with its exact text
ok 630 - sudo-outcome: each terminal state reaches the lead with its exact text
  ---
  duration_ms: 1512.506022
  type: 'test'
  ...
# Subtest: sudo-outcome waiting is ignored and a card never moves back
ok 631 - sudo-outcome waiting is ignored and a card never moves back
  ---
  duration_ms: 518.695302
  type: 'test'
  ...
# Subtest: Talk about it tells the lead and leaves the card waiting and unanswered
ok 632 - Talk about it tells the lead and leaves the card waiting and unanswered
  ---
  duration_ms: 443.940436
  type: 'test'
  ...
# Subtest: Decline: the machine answers declined, the card closes and the lead hears it once
ok 633 - Decline: the machine answers declined, the card closes and the lead hears it once
  ---
  duration_ms: 482.980718
  type: 'test'
  ...
# Subtest: Decline that lost the race shows the run result, not declined
ok 634 - Decline that lost the race shows the run result, not declined
  ---
  duration_ms: 498.723395
  type: 'test'
  ...
# Subtest: Decline answered with running keeps the card running and tells nobody yet
ok 635 - Decline answered with running keeps the card running and tells nobody yet
  ---
  duration_ms: 497.466064
  type: 'test'
  ...
# Subtest: Decline with an unreachable or refusing machine saves nothing and says so
ok 636 - Decline with an unreachable or refusing machine saves nothing and says so
  ---
  duration_ms: 1366.442655
  type: 'test'
  ...
# Subtest: Decline with a machine that never answers gives up after the limit and saves nothing
ok 637 - Decline with a machine that never answers gives up after the limit and saves nothing
  ---
  duration_ms: 566.212495
  type: 'test'
  ...
# Subtest: a press on a sudo card other than talk or decline is refused
ok 638 - a press on a sudo card other than talk or decline is refused
  ---
  duration_ms: 426.420319
  type: 'test'
  ...
# Subtest: the chat bubble for a sudo result keeps only its first line
ok 639 - the chat bubble for a sudo result keeps only its first line
  ---
  duration_ms: 0.592356
  type: 'test'
  ...
# Subtest: retracting a waiting sudo cancels without deadlock or a lead message
ok 640 - retracting a waiting sudo cancels without deadlock or a lead message
  ---
  duration_ms: 657.981384
  type: 'test'
  ...
# Subtest: sudo retraction refusal preserves the card and later outcomes are delivered
ok 641 - sudo retraction refusal preserves the card and later outcomes are delivered
  ---
  duration_ms: 1808.507146
  type: 'test'
  ...
# Subtest: claude switches and carries on before held messages
ok 642 - claude switches and carries on before held messages
  ---
  duration_ms: 109.387234
  type: 'test'
  ...
# Subtest: gpt switches and carries on before held messages
ok 643 - gpt switches and carries on before held messages
  ---
  duration_ms: 58.110579
  type: 'test'
  ...
# Subtest: no alternate and other providers retain the limit hold
ok 644 - no alternate and other providers retain the limit hold
  ---
  duration_ms: 37.247413
  type: 'test'
  ...
# Subtest: gpt worker does not report a limited turn to its starter
ok 645 - gpt worker does not report a limited turn to its starter
  ---
  duration_ms: 50.61686
  type: 'test'
  ...
# Subtest: claude worker does not report a limited turn to its starter
ok 646 - claude worker does not report a limited turn to its starter
  ---
  duration_ms: 46.355328
  type: 'test'
  ...
# Subtest: gpt reviewer does not report a limited turn to its starter
ok 647 - gpt reviewer does not report a limited turn to its starter
  ---
  duration_ms: 52.709552
  type: 'test'
  ...
# Subtest: gemini holds even with another signed-in account
ok 648 - gemini holds even with another signed-in account
  ---
  duration_ms: 13.783732
  type: 'test'
  ...
# Subtest: quiet sweep holds reminders during a switch and sends them afterward
ok 649 - quiet sweep holds reminders during a switch and sends them afterward
  ---
  duration_ms: 20.880098
  type: 'test'
  ...
# Subtest: matching failures restore hold and unrelated callbacks are ignored
ok 650 - matching failures restore hold and unrelated callbacks are ignored
  ---
  duration_ms: 48.605342
  type: 'test'
  ...
# Subtest: selector respects reserve and preflight retry
ok 651 - selector respects reserve and preflight retry
  ---
  duration_ms: 25.33975
  type: 'test'
  ...
# Subtest: refused and unreachable switch requests restore the old hold
ok 652 - refused and unreachable switch requests restore the old hold
  ---
  duration_ms: 4109.481061
  type: 'test'
  ...
# Subtest: lead reserve holds a worker back
ok 653 - lead reserve holds a worker back
  ---
  duration_ms: 19.287134
  type: 'test'
  ...
# Subtest: the list view keeps the summary and drops the history
ok 654 - the list view keeps the summary and drops the history
  ---
  duration_ms: 525.355606
  type: 'test'
  ...
# Subtest: the list view marks a thread whose lead posted a done card
ok 655 - the list view marks a thread whose lead posted a done card
  ---
  duration_ms: 462.948127
  type: 'test'
  ...
# Subtest: the list view gives a quick fix its stage from the pinned progress line
ok 656 - the list view gives a quick fix its stage from the pinned progress line
  ---
  duration_ms: 561.796171
  type: 'test'
  ...
# Subtest: the list view leaves a planned thread to its plan, even with a progress line
ok 657 - the list view leaves a planned thread to its plan, even with a progress line
  ---
  duration_ms: 524.968112
  type: 'test'
  ...
# Subtest: tools.js defines WHEELCHAIR_TOOLS: five tools in registry order, no install field
ok 658 - tools.js defines WHEELCHAIR_TOOLS: five tools in registry order, no install field
  ---
  duration_ms: 186.714832
  type: 'test'
  ...
# Subtest: try routes forward recorded identity, preserve fields, allow archive and enrich status
ok 659 - try routes forward recorded identity, preserve fields, allow archive and enrich status
  ---
  duration_ms: 397.324421
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-1c7cd0c0be92.slice
# machine service listening on 127.0.0.1:42711
# machine: screen teardown failed: wcscreen-1c7cd0c0be92-ac9bc96d932c.slice
# Subtest: archive through the hub cancels a stalled upload to the real machine
ok 660 - archive through the hub cancels a stalled upload to the real machine
  ---
  duration_ms: 9300.244497
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-279ff90fb787.slice
# machine service listening on 127.0.0.1:38865
# Subtest: a lead still waiting takes uploads on the real machine
ok 661 - a lead still waiting takes uploads on the real machine
  ---
  duration_ms: 3528.953917
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-dd3262bb5d22.slice
# machine service listening on 127.0.0.1:46027
# Subtest: a lead still starting takes uploads on the real machine
ok 662 - a lead still starting takes uploads on the real machine
  ---
  duration_ms: 2847.617513
  type: 'test'
  ...
# Subtest: account normalization and balancing settings survive round trip
ok 663 - account normalization and balancing settings survive round trip
  ---
  duration_ms: 8.245321
  type: 'test'
  ...
# Subtest: effective windows, room and forecasts
ok 664 - effective windows, room and forecasts
  ---
  duration_ms: 1.104969
  type: 'test'
  ...
# Subtest: ranking and unknown transcript
ok 665 - ranking and unknown transcript
  ---
  duration_ms: 1.331834
  type: 'test'
  ...
# Subtest: Ready accepts a second signed-in account and old service status
ok 666 - Ready accepts a second signed-in account and old service status
  ---
  duration_ms: 1.735408
  type: 'test'
  ...
# Subtest: account and balancing routes and usage shape
ok 667 - account and balancing routes and usage shape
  ---
  duration_ms: 550.733808
  type: 'test'
  ...
# Subtest: normalization supplies defaults and all plan weights
ok 668 - normalization supplies defaults and all plan weights
  ---
  duration_ms: 2.413267
  type: 'test'
  ...
# Subtest: room boundaries, windows, forecast and margin
ok 669 - room boundaries, windows, forecast and margin
  ---
  duration_ms: 0.638975
  type: 'test'
  ...
# Subtest: rank chooses by reset, weighted room, live sessions and last choice and explains skips
ok 670 - rank chooses by reset, weighted room, live sessions and last choice and explains skips
  ---
  duration_ms: 25.252814
  type: 'test'
  ...
# Subtest: record serializes readings and chosen accounts
ok 671 - record serializes readings and chosen accounts
  ---
  duration_ms: 28.133026
  type: 'test'
  ...
# Subtest: Ready rejects paused accounts and preserves old Codex preflight
ok 672 - Ready rejects paused accounts and preserves old Codex preflight
  ---
  duration_ms: 1.62201
  type: 'test'
  ...
# Subtest: account route assigns unique slugs and resets weight on plan change
ok 673 - account route assigns unique slugs and resets weight on plan change
  ---
  duration_ms: 178.359089
  type: 'test'
  ...
# Subtest: usage endpoints expose machine state, sessions and alert weeks
ok 674 - usage endpoints expose machine state, sessions and alert weeks
  ---
  duration_ms: 217.72259
  type: 'test'
  ...
# Subtest: sign-in proxies forward the account, machine path and payload
ok 675 - sign-in proxies forward the account, machine path and payload
  ---
  duration_ms: 212.616318
  type: 'test'
  ...
# Subtest: removing an account leaves its live session intact and removes it from settings and usage
ok 676 - removing an account leaves its live session intact and removes it from settings and usage
  ---
  duration_ms: 264.866179
  type: 'test'
  ...
# Subtest: newer ordinary readings preserve a future limit until it expires
ok 677 - newer ordinary readings preserve a future limit until it expires
  ---
  duration_ms: 633.261437
  type: 'test'
  ...
# Subtest: removed account ids are retired and do not inherit usage or sessions
ok 678 - removed account ids are retired and do not inherit usage or sessions
  ---
  duration_ms: 653.241859
  type: 'test'
  ...
# Subtest: alerts are acknowledged per provider and local ISO week
ok 679 - alerts are acknowledged per provider and local ISO week
  ---
  duration_ms: 54.524172
  type: 'test'
  ...
# Subtest: legacy reserve value is carried over from the saved settings file
ok 680 - legacy reserve value is carried over from the saved settings file
  ---
  duration_ms: 11.741786
  type: 'test'
  ...
# Subtest: a default account can be removed, stays removed, and can be added back
ok 681 - a default account can be removed, stays removed, and can be added back
  ---
  duration_ms: 408.475643
  type: 'test'
  ...
# Subtest: idle poll probes eligible accounts in order and records the selected machine
ok 682 - idle poll probes eligible accounts in order and records the selected machine
  ---
  duration_ms: 122.488264
  type: 'test'
  ...
# Subtest: idle poll stores default and named Kimi account readings
ok 683 - idle poll stores default and named Kimi account readings
  ---
  duration_ms: 106.598746
  type: 'test'
  ...
# Subtest: idle poll stores a Kimi reading while its session is live
ok 684 - idle poll stores a Kimi reading while its session is live
  ---
  duration_ms: 110.739666
  type: 'test'
  ...
# Subtest: idle poll tries another machine when a Kimi probe fails
ok 685 - idle poll tries another machine when a Kimi probe fails
  ---
  duration_ms: 128.636353
  type: 'test'
  ...
# Subtest: idle poll skips a live Claude account
ok 686 - idle poll skips a live Claude account
  ---
  duration_ms: 126.66348
  type: 'test'
  ...
# Subtest: idle poll drops a reading when the account becomes live
ok 687 - idle poll drops a reading when the account becomes live
  ---
  duration_ms: 111.920371
  type: 'test'
  ...
# Subtest: idle poll keeps stored usage on failure and throttles retries
ok 688 - idle poll keeps stored usage on failure and throttles retries
  ---
  duration_ms: 105.423162
  type: 'test'
  ...
# Subtest: overlapping idle polls share one run
ok 689 - overlapping idle polls share one run
  ---
  duration_ms: 104.092489
  type: 'test'
  ...
# Subtest: idle poll skips readings less than nine minutes old
ok 690 - idle poll skips readings less than nine minutes old
  ---
  duration_ms: 110.218857
  type: 'test'
  ...
# Subtest: idle poll rechecks later accounts before probing
ok 691 - idle poll rechecks later accounts before probing
  ---
  duration_ms: 110.601963
  type: 'test'
  ...
# Subtest: a newer live reading survives an idle probe after the session ends
ok 692 - a newer live reading survives an idle probe after the session ends
  ---
  duration_ms: 119.705739
  type: 'test'
  ...
# Subtest: idle poll drops a removed account result
ok 693 - idle poll drops a removed account result
  ---
  duration_ms: 162.447065
  type: 'test'
  ...
# Subtest: idle poll promotes a waiting start when usage frees room
ok 694 - idle poll promotes a waiting start when usage frees room
  ---
  duration_ms: 1457.765459
  type: 'test'
  ...
# Subtest: a reported GPT plan sets the account plan and weight unless the weight was typed in
ok 695 - a reported GPT plan sets the account plan and weight unless the weight was typed in
  ---
  duration_ms: 16.632794
  type: 'test'
  ...
# Subtest: assistant messages and presses retain attribution after style stripping
ok 696 - assistant messages and presses retain attribution after style stripping
  ---
  duration_ms: 4.407681
  type: 'test'
  ...
# Subtest: restart context identifies the assistant and handles malformed state
ok 697 - restart context identifies the assistant and handles malformed state
  ---
  duration_ms: 0.764837
  type: 'test'
  ...
# Subtest: ordinary messages and presses stay unchanged
ok 698 - ordinary messages and presses stay unchanged
  ---
  duration_ms: 0.429554
  type: 'test'
  ...
# Subtest: assistant lifecycle, visibility, refusals and fresh context
ok 699 - assistant lifecycle, visibility, refusals and fresh context
  ---
  duration_ms: 1364.416879
  type: 'test'
  ...
# Subtest: account switching sends assistant identity without a project
ok 700 - account switching sends assistant identity without a project
  ---
  duration_ms: 97.910025
  type: 'test'
  ...
# Subtest: assistant actions authenticate, list, send, press, restart and archive
ok 701 - assistant actions authenticate, list, send, press, restart and archive
  ---
  duration_ms: 1480.516159
  type: 'test'
  ...
# Subtest: assistant command retries reads but not writes and reports failures as JSON
ok 702 - assistant command retries reads but not writes and reports failures as JSON
  ---
  duration_ms: 1184.932318
  type: 'test'
  ...
# Subtest: browser thread creation ignores the private assistant title
ok 703 - browser thread creation ignores the private assistant title
  ---
  duration_ms: 413.599478
  type: 'test'
  ...
# Subtest: threads lists both registered machines and includes archives only on request
ok 704 - threads lists both registered machines and includes archives only on request
  ---
  duration_ms: 1078.448018
  type: 'test'
  ...
# Subtest: start reports the saved thread and URL when lead launch fails
ok 705 - start reports the saved thread and URL when lead launch fails
  ---
  duration_ms: 922.221159
  type: 'test'
  ...
# Subtest: assistant press attribution is cleared by a later browser press on the same idea
ok 706 - assistant press attribution is cleared by a later browser press on the same idea
  ---
  duration_ms: 850.392967
  type: 'test'
  ...
# Subtest: approval recheck refreshes Ready without attributing an answer
ok 707 - approval recheck refreshes Ready without attributing an answer
  ---
  duration_ms: 1016.102407
  type: 'test'
  ...
# Subtest: press and archive results do not expose session tokens
ok 708 - press and archive results do not expose session tokens
  ---
  duration_ms: 831.25644
  type: 'test'
  ...
# Subtest: message and restart refuse archived threads and restart refuses handed-off threads
ok 709 - message and restart refuse archived threads and restart refuses handed-off threads
  ---
  duration_ms: 748.922842
  type: 'test'
  ...
# Subtest: every assistant action refuses the assistant thread as a target
ok 710 - every assistant action refuses the assistant thread as a target
  ---
  duration_ms: 514.67594
  type: 'test'
  ...
# Subtest: assistant CLI sends the contents of message and text files
ok 711 - assistant CLI sends the contents of message and text files
  ---
  duration_ms: 111.26889
  type: 'test'
  ...
# Subtest: the thread guard reads without writing, so it cannot overwrite a concurrent change
ok 712 - the thread guard reads without writing, so it cannot overwrite a concurrent change
  ---
  duration_ms: 9.044824
  type: 'test'
  ...
# Subtest: assistant reads omit aside conversations
ok 713 - assistant reads omit aside conversations
  ---
  duration_ms: 684.923131
  type: 'test'
  ...
# Subtest: assistant reads refresh local plan status like features
ok 714 - assistant reads refresh local plan status like features
  ---
  duration_ms: 606.429247
  type: 'test'
  ...
# Subtest: assistant recent filters before applying the 30 item limit
ok 715 - assistant recent filters before applying the 30 item limit
  ---
  duration_ms: 1.775405
  type: 'test'
  ...
# Subtest: restart starts a fresh assistant after first preflight fails
ok 716 - restart starts a fresh assistant after first preflight fails
  ---
  duration_ms: 388.931972
  type: 'test'
  ...
# Subtest: assistant actions exclude and refuse project lead threads
ok 717 - assistant actions exclude and refuse project lead threads
  ---
  duration_ms: 500.020366
  type: 'test'
  ...
# Subtest: background normalization retains current harness, onboarding, lessons and merge preferences
ok 718 - background normalization retains current harness, onboarding, lessons and merge preferences
  ---
  duration_ms: 3.849261
  type: 'test'
  ...
# Subtest: GIF loop variants preserve frames, control blocks and empty comments
ok 719 - GIF loop variants preserve frames, control blocks and empty comments
  ---
  duration_ms: 2.324688
  type: 'test'
  ...
# Subtest: containers reject malformed dimensions, payload, signatures and mismatches
ok 720 - containers reject malformed dimensions, payload, signatures and mismatches
  ---
  duration_ms: 1.48135
  type: 'test'
  ...
# Subtest: API saves and serves all formats, validates metadata and preserves unrelated settings
ok 721 - API saves and serves all formats, validates metadata and preserves unrelated settings
  ---
  duration_ms: 531.430764
  type: 'test'
  ...
# Subtest: authentication, origin and bounded declared and streamed bodies
ok 722 - authentication, origin and bounded declared and streamed bodies
  ---
  duration_ms: 270.792051
  type: 'test'
  ...
# Subtest: concurrent uploads and slow upload recheck revision after reading
ok 723 - concurrent uploads and slow upload recheck revision after reading
  ---
  duration_ms: 169.490913
  type: 'test'
  ...
# Background cleanup failed: injected cleanup failure
# Subtest: failed metadata commit preserves old file; cleanup failure is retried after commit
ok 724 - failed metadata commit preserves old file; cleanup failure is retried after commit
  ---
  duration_ms: 23.526212
  type: 'test'
  ...
# Subtest: format validation and animated GIF loop normalization
ok 725 - format validation and animated GIF loop normalization
  ---
  duration_ms: 2.877096
  type: 'test'
  ...
# Subtest: authenticated background saves, conflict, reset and restart
ok 726 - authenticated background saves, conflict, reset and restart
  ---
  duration_ms: 399.489021
  type: 'test'
  ...
# Subtest: card CLI prints only a receipt for delivered and spooled cards and instructions
ok 727 - card CLI prints only a receipt for delivered and spooled cards and instructions
  ---
  duration_ms: 1008.032691
  type: 'test'
  ...
# Subtest: idle probes all and only supported tools, including live Kimi
ok 728 - idle probes all and only supported tools, including live Kimi
  ---
  duration_ms: 69.575332
  type: 'test'
  ...
# Subtest: usage displays forecasts, spend, problems and warnings by provider
ok 729 - usage displays forecasts, spend, problems and warnings by provider
  ---
  duration_ms: 29.630016
  type: 'test'
  ...
# Subtest: settings preserve provider plans, scout wording, review fallback and discovery
ok 730 - settings preserve provider plans, scout wording, review fallback and discovery
  ---
  duration_ms: 4.680585
  type: 'test'
  ...
# Subtest: model routes validate each provider, aliases, efforts and review choices
ok 731 - model routes validate each provider, aliases, efforts and review choices
  ---
  duration_ms: 1870.183186
  type: 'test'
  ...
# Subtest: aside fork chooses each supported parent and rejects unsupported providers
ok 732 - aside fork chooses each supported parent and rejects unsupported providers
  ---
  duration_ms: 5.853214
  type: 'test'
  ...
# Subtest: chat selects distinct report and transcript formats for every CLI
ok 733 - chat selects distinct report and transcript formats for every CLI
  ---
  duration_ms: 5.987992
  type: 'test'
  ...
# Subtest: session limit switching and persisted harness ids vary by provider
ok 734 - session limit switching and persisted harness ids vary by provider
  ---
  duration_ms: 115.058988
  type: 'test'
  ...
# Subtest: worker effort ceilings apply to every provider with effort
ok 735 - worker effort ceilings apply to every provider with effort
  ---
  duration_ms: 2896.877571
  type: 'test'
  ...
# Subtest: session model resolution uses provider cells and tier aliases
ok 736 - session model resolution uses provider cells and tier aliases
  ---
  duration_ms: 265.426622
  type: 'test'
  ...
# Subtest: switch placement runs preflight only for GPT
ok 737 - switch placement runs preflight only for GPT
  ---
  duration_ms: 37.27213
  type: 'test'
  ...
# Subtest: readiness uses each CLI login and reserves preflight for Codex
ok 738 - readiness uses each CLI login and reserves preflight for Codex
  ---
  duration_ms: 5.352904
  type: 'test'
  ...
# Subtest: fresh and migrated placement orders preserve exclusions and add unseen families
ok 739 - fresh and migrated placement orders preserve exclusions and add unseen families
  ---
  duration_ms: 7.3791
  type: 'test'
  ...
# Subtest: HTML download places policy after leading doctype and removes refresh tags
ok 740 - HTML download places policy after leading doctype and removes refresh tags
  ---
  duration_ms: 3.09201
  type: 'test'
  ...
# Subtest: sign-in hint uses the account tool prompt
ok 741 - sign-in hint uses the account tool prompt
  ---
  duration_ms: 3.189145
  type: 'test'
  ...
# Subtest: the token lasts across a restart, rotates only explicitly, and whoami proves a nonce
ok 742 - the token lasts across a restart, rotates only explicitly, and whoami proves a nonce
  ---
  duration_ms: 369.988293
  type: 'test'
  ...
# Subtest: a stale .server never blocks listen and a live server repairs a deleted record before whoami
ok 743 - a stale .server never blocks listen and a live server repairs a deleted record before whoami
  ---
  duration_ms: 111.20543
  type: 'test'
  ...
# Subtest: stop treats a refused connection as no viewer even when stale information remains
ok 744 - stop treats a refused connection as no viewer even when stale information remains
  ---
  duration_ms: 61.599358
  type: 'test'
  ...
# Subtest: serving origin is accepted for PUT and drives the bookmark URL
ok 745 - serving origin is accepted for PUT and drives the bookmark URL
  ---
  duration_ms: 212.130195
  type: 'test'
  ...
# Subtest: two simultaneous first starts end with one .token
ok 746 - two simultaneous first starts end with one .token
  ---
  duration_ms: 157.282433
  type: 'test'
  ...
# Subtest: simultaneous delayed listeners elect one server and print one token
ok 747 - simultaneous delayed listeners elect one server and print one token
  ---
  duration_ms: 586.821415
  type: 'test'
  ...
# Subtest: SIGKILL leaves stale .server and the next start listens immediately
ok 748 - SIGKILL leaves stale .server and the next start listens immediately
  ---
  duration_ms: 197.053595
  type: 'test'
  ...
# Subtest: a plain foreign listener makes --open refuse without signalling it
ok 749 - a plain foreign listener makes --open refuse without signalling it
  ---
  duration_ms: 2130.742941
  type: 'test'
  ...
# Subtest: a copied start id with a made-up pid and no proof is foreign
ok 750 - a copied start id with a made-up pid and no proof is foreign
  ---
  duration_ms: 94.963374
  type: 'test'
  ...
# Subtest: /whoami supplies pid and code, and proof only for a nonce
ok 751 - /whoami supplies pid and code, and proof only for a nonce
  ---
  duration_ms: 101.403493
  type: 'test'
  ...
# Subtest: stopping refuses a mismatched .server pid
ok 752 - stopping refuses a mismatched .server pid
  ---
  duration_ms: 168.645231
  type: 'test'
  ...
# Subtest: --stop exits 1 against a foreign listener
ok 753 - --stop exits 1 against a foreign listener
  ---
  duration_ms: 2103.947894
  type: 'test'
  ...
# Subtest: --stop waits five seconds then fails when the server ignores SIGTERM
ok 754 - --stop waits five seconds then fails when the server ignores SIGTERM
  ---
  duration_ms: 6966.107838
  type: 'test'
  ...
# Subtest: --stop --if-stale keeps current code and stops a changed server copy
ok 755 - --stop --if-stale keeps current code and stops a changed server copy
  ---
  duration_ms: 245.074453
  type: 'test'
  ...
# Subtest: an older server is stopped only by --stop and every other command gives the upgrade message
ok 756 - an older server is stopped only by --stop and every other command gives the upgrade message
  ---
  duration_ms: 403.575921
  type: 'test'
  ...
# Subtest: a proof-valid pre-prefix holder is stopped only by stop and every other command reports the upgrade
ok 757 - a proof-valid pre-prefix holder is stopped only by stop and every other command reports the upgrade
  ---
  duration_ms: 418.79845
  type: 'test'
  ...
# Subtest: a no-proof pre-prefix holder stops only with its matching server start id and open refuses it
ok 758 - a no-proof pre-prefix holder stops only with its matching server start id and open refuses it
  ---
  duration_ms: 221.696636
  type: 'test'
  ...
# Subtest: a proof-valid pre-prefix holder without a pid is not ours and open does not signal it
ok 759 - a proof-valid pre-prefix holder without a pid is not ours and open does not signal it
  ---
  duration_ms: 92.989208
  type: 'test'
  ...
# Subtest: --service takes over an open server without changing port or token
ok 760 - --service takes over an open server without changing port or token
  ---
  duration_ms: 166.512198
  type: 'test'
  ...
# Subtest: --service gives up after three takeovers
ok 761 - --service gives up after three takeovers
  ---
  duration_ms: 467.406356
  type: 'test'
  ...
# Subtest: a post-bind .server rename failure rolls back listener and record
ok 762 - a post-bind .server rename failure rolls back listener and record
  ---
  duration_ms: 45.742922
  type: 'test'
  ...
# Subtest: --open waits a closing server out and succeeds
ok 763 - --open waits a closing server out and succeeds
  ---
  duration_ms: 102.21531
  type: 'test'
  ...
# Subtest: only localhost and served origins write, and serve false prints localhost
ok 764 - only localhost and served origins write, and serve false prints localhost
  ---
  duration_ms: 102.381327
  type: 'test'
  ...
# Subtest: --url never listens and reports the running token after a timed-out rotation
ok 765 - --url never listens and reports the running token after a timed-out rotation
  ---
  duration_ms: 7055.432731
  type: 'test'
  ...
# Subtest: --rotate-token refuses an old-version holder and leaves it running
ok 766 - --rotate-token refuses an old-version holder and leaves it running
  ---
  duration_ms: 39.412774
  type: 'test'
  ...
# Subtest: --register-plan retries a silent holder until it registers through it
ok 767 - --register-plan retries a silent holder until it registers through it
  ---
  duration_ms: 1254.950516
  type: 'test'
  ...
# Subtest: --rotate-token waits for shutdown and leaves .server removal to the server
ok 768 - --rotate-token waits for shutdown and leaves .server removal to the server
  ---
  duration_ms: 143.032224
  type: 'test'
  ...
# Subtest: --rotate-token prints the new prefixed bookmark for a current server
ok 769 - --rotate-token prints the new prefixed bookmark for a current server
  ---
  duration_ms: 147.972627
  type: 'test'
  ...
# Subtest: shutdown releases the port before it removes only its own .server record
ok 770 - shutdown releases the port before it removes only its own .server record
  ---
  duration_ms: 59.060278
  type: 'test'
  ...
# Subtest: --stop leaves .server removal to the exiting server
ok 771 - --stop leaves .server removal to the exiting server
  ---
  duration_ms: 145.518401
  type: 'test'
  ...
# Subtest: a starter that loses the freed port registers through the new holder
ok 772 - a starter that loses the freed port registers through the new holder
  ---
  duration_ms: 537.02287
  type: 'test'
  ...
# Subtest: frontmatter, headings, tables and lists parse as the document page expects
ok 773 - frontmatter, headings, tables and lists parse as the document page expects
  ---
  duration_ms: 3.313063
  type: 'test'
  ...
# Subtest: minimal manifest can be read by the settings store
ok 774 - minimal manifest can be read by the settings store
  ---
  duration_ms: 15.949644
  type: 'test'
  ...
# Subtest: minimal manifest works in hub routes, assets and usage
ok 775 - minimal manifest works in hub routes, assets and usage
  ---
  duration_ms: 746.883559
  type: 'test'
  ...
# Subtest: model choices preserve the current lists and pins
ok 776 - model choices preserve the current lists and pins
  ---
  duration_ms: 2.437924
  type: 'test'
  ...
# Subtest: model choices include a sixth manifest
ok 777 - model choices include a sixth manifest
  ---
  duration_ms: 2.695408
  type: 'test'
  ...
# Subtest: a semicolon key reaches the pane only as backslash-semicolon
ok 778 - a semicolon key reaches the pane only as backslash-semicolon
  ---
  duration_ms: 706.382297
  type: 'test'
  ...
# Subtest: the sessions response marks the hub entry whatever name it is registered under
ok 779 - the sessions response marks the hub entry whatever name it is registered under
  ---
  duration_ms: 242.820785
  type: 'test'
  ...
# Subtest: poll stops for clean with a passed check
ok 780 - poll stops for clean with a passed check
  ---
  duration_ms: 66.400855
  type: 'test'
  ...
# Subtest: poll stops for dirty
ok 781 - poll stops for dirty
  ---
  duration_ms: 48.517724
  type: 'test'
  ...
# Subtest: poll stops for changed head
ok 782 - poll stops for changed head
  ---
  duration_ms: 55.606687
  type: 'test'
  ...
# Subtest: poll stops for merged
ok 783 - poll stops for merged
  ---
  duration_ms: 52.157503
  type: 'test'
  ...
# Subtest: poll stops for failed check under unstable
ok 784 - poll stops for failed check under unstable
  ---
  duration_ms: 43.303706
  type: 'test'
  ...
# Subtest: concurrent opens share a record across the hub alias and hostname, with separate projects on a second machine
ok 785 - concurrent opens share a record across the hub alias and hostname, with separate projects on a second machine
  ---
  duration_ms: 297.339295
  type: 'test'
  ...
# Subtest: project status is read-only and requires a non-archived ordinary thread in the project
ok 786 - project status is read-only and requires a non-archived ordinary thread in the project
  ---
  duration_ms: 409.311495
  type: 'test'
  ...
# Subtest: project lead start forces the sandbox and includes only the project role layers
ok 787 - project lead start forces the sandbox and includes only the project role layers
  ---
  duration_ms: 692.613803
  type: 'test'
  ...
# Subtest: off stops sessions, hides records, and guards direct thread routes
ok 788 - off stops sessions, hides records, and guards direct thread routes
  ---
  duration_ms: 951.051603
  type: 'test'
  ...
# Subtest: project lead sessions cannot use the machine session relay or receive cross-thread cards
ok 789 - project lead sessions cannot use the machine session relay or receive cross-thread cards
  ---
  duration_ms: 434.677984
  type: 'test'
  ...
# Subtest: features and peer discovery exclude project leads but Needs you keeps their open questions
ok 790 - features and peer discovery exclude project leads but Needs you keeps their open questions
  ---
  duration_ms: 411.097278
  type: 'test'
  ...
# Subtest: restart drops old card messages and renders the project lead fresh-context line
ok 791 - restart drops old card messages and renders the project lead fresh-context line
  ---
  duration_ms: 673.667421
  type: 'test'
  ...
# Subtest: auto-merge ignores an otherwise eligible project lead record
ok 792 - auto-merge ignores an otherwise eligible project lead record
  ---
  duration_ms: 14.355396
  type: 'test'
  ...
# Subtest: the merged-PR poller calls GitHub only for ordinary threads
ok 793 - the merged-PR poller calls GitHub only for ordinary threads
  ---
  duration_ms: 43.866405
  type: 'test'
  ...
# Subtest: account switching keeps the project lead identity
ok 794 - account switching keeps the project lead identity
  ---
  duration_ms: 90.976569
  type: 'test'
  ...
# Subtest: opening a project lead starts it only on the first message
ok 795 - opening a project lead starts it only on the first message
  ---
  duration_ms: 618.334358
  type: 'test'
  ...
# Subtest: failed starts retain queued messages in order and a later start carries them
ok 796 - failed starts retain queued messages in order and a later start carries them
  ---
  duration_ms: 1008.776999
  type: 'test'
  ...
# Subtest: concurrent first sends start only one lead and preserve order
ok 797 - concurrent first sends start only one lead and preserve order
  ---
  duration_ms: 528.994266
  type: 'test'
  ...
# Subtest: a dead lead restarts on a message and turn ends deliver queued messages
ok 798 - a dead lead restarts on a message and turn ends deliver queued messages
  ---
  duration_ms: 471.375009
  type: 'test'
  ...
# Subtest: off refuses messages and failed stops retry on machine contact only while off
ok 799 - off refuses messages and failed stops retry on machine contact only while off
  ---
  duration_ms: 862.574421
  type: 'test'
  ...
# Subtest: ordinary threads still reject messages without a live lead
ok 800 - ordinary threads still reject messages without a live lead
  ---
  duration_ms: 121.707616
  type: 'test'
  ...
# Subtest: project lead actions enforce project scope and redact cross-project content
ok 801 - project lead actions enforce project scope and redact cross-project content
  ---
  duration_ms: 60.212799
  type: 'test'
  ...
# Subtest: project lead CLI sends files and retries reads only
ok 802 - project lead CLI sends files and retries reads only
  ---
  duration_ms: 1215.599049
  type: 'test'
  ...
# Subtest: refresh waits for a slow machine
ok 803 - refresh waits for a slow machine
  ---
  duration_ms: 6142.759596
  type: 'test'
  ...
# Subtest: outside titles do not erase local question text
ok 804 - outside titles do not erase local question text
  ---
  duration_ms: 13.096512
  type: 'test'
  ...
# Subtest: outside pull request URLs are removed from recent chat
ok 805 - outside pull request URLs are removed from recent chat
  ---
  duration_ms: 10.288357
  type: 'test'
  ...
# Subtest: outside PR URLs match whole URLs without hiding local PR prefixes
ok 806 - outside PR URLs match whole URLs without hiding local PR prefixes
  ---
  duration_ms: 12.534326
  type: 'test'
  ...
# Subtest: outside object target PR URLs are removed from thread details
ok 807 - outside object target PR URLs are removed from thread details
  ---
  duration_ms: 12.999366
  type: 'test'
  ...
# Subtest: the same path on another registered machine is outside the project
ok 808 - the same path on another registered machine is outside the project
  ---
  duration_ms: 11.711376
  type: 'test'
  ...
# Subtest: another project lead is refused as a target of every targeted action
ok 809 - another project lead is refused as a target of every targeted action
  ---
  duration_ms: 10.02303
  type: 'test'
  ...
# Subtest: closed reach and permit cards are absent from waiting and cards
ok 810 - closed reach and permit cards are absent from waiting and cards
  ---
  duration_ms: 10.69113
  type: 'test'
  ...
# Subtest: cross-thread messages and recent chat omit other project identifiers but keep titles
ok 811 - cross-thread messages and recent chat omit other project identifiers but keep titles
  ---
  duration_ms: 10.388289
  type: 'test'
  ...
# Subtest: short other-project titles do not redact same-project text
ok 812 - short other-project titles do not redact same-project text
  ---
  duration_ms: 9.908269
  type: 'test'
  ...
# Subtest: same-project text mentioning its project path remains in recent chat
ok 813 - same-project text mentioning its project path remains in recent chat
  ---
  duration_ms: 9.065563
  type: 'test'
  ...
# Subtest: every project lead action is refused when the setting is off
ok 814 - every project lead action is refused when the setting is off
  ---
  duration_ms: 9.445382
  type: 'test'
  ...
# Subtest: project lead CLI retries thread reads and does not retry writes
ok 815 - project lead CLI retries thread reads and does not retry writes
  ---
  duration_ms: 2196.855241
  type: 'test'
  ...
# Subtest: worker permits its own commands
ok 816 - worker permits its own commands
  ---
  duration_ms: 2.126087
  type: 'test'
  ...
# Subtest: mapper permits its own commands
ok 817 - mapper permits its own commands
  ---
  duration_ms: 0.388265
  type: 'test'
  ...
# Subtest: designer permits its own commands
ok 818 - designer permits its own commands
  ---
  duration_ms: 0.229219
  type: 'test'
  ...
# Subtest: sub-lead permits its own commands
ok 819 - sub-lead permits its own commands
  ---
  duration_ms: 0.335644
  type: 'test'
  ...
# Subtest: lead permits its own commands
ok 820 - lead permits its own commands
  ---
  duration_ms: 0.673461
  type: 'test'
  ...
# Subtest: cards permits its own commands
ok 821 - cards permits its own commands
  ---
  duration_ms: 0.372614
  type: 'test'
  ...
# Subtest: worker reports conflicts instead of stopping silently
ok 822 - worker reports conflicts instead of stopping silently
  ---
  duration_ms: 0.522101
  type: 'test'
  ...
# Subtest: mapper reports conflicts instead of stopping silently
ok 823 - mapper reports conflicts instead of stopping silently
  ---
  duration_ms: 0.180165
  type: 'test'
  ...
# Subtest: designer reports conflicts instead of stopping silently
ok 824 - designer reports conflicts instead of stopping silently
  ---
  duration_ms: 1.984525
  type: 'test'
  ...
# Subtest: sub-lead reports conflicts instead of stopping silently
ok 825 - sub-lead reports conflicts instead of stopping silently
  ---
  duration_ms: 0.753294
  type: 'test'
  ...
# Subtest: reviewer reports obstacles instead of stopping silently
ok 826 - reviewer reports obstacles instead of stopping silently
  ---
  duration_ms: 0.340994
  type: 'test'
  ...
# Subtest: verifier reports obstacles instead of stopping silently
ok 827 - verifier reports obstacles instead of stopping silently
  ---
  duration_ms: 0.226133
  type: 'test'
  ...
# Subtest: worker waits for background work in the foreground
ok 828 - worker waits for background work in the foreground
  ---
  duration_ms: 0.169515
  type: 'test'
  ...
# Subtest: mapper waits for background work in the foreground
ok 829 - mapper waits for background work in the foreground
  ---
  duration_ms: 0.107306
  type: 'test'
  ...
# Subtest: designer waits for background work in the foreground
ok 830 - designer waits for background work in the foreground
  ---
  duration_ms: 0.110482
  type: 'test'
  ...
# Subtest: sub-lead waits for background work in the foreground
ok 831 - sub-lead waits for background work in the foreground
  ---
  duration_ms: 0.146341
  type: 'test'
  ...
# Subtest: reviewer waits for background work in the foreground
ok 832 - reviewer waits for background work in the foreground
  ---
  duration_ms: 0.098459
  type: 'test'
  ...
# Subtest: verifier waits for background work in the foreground
ok 833 - verifier waits for background work in the foreground
  ---
  duration_ms: 0.107396
  type: 'test'
  ...
# Subtest: each schema kind has one card section, in its intended file
ok 834 - each schema kind has one card section, in its intended file
  ---
  duration_ms: 13.685101
  type: 'test'
  ...
# Subtest: lead has no obsolete read pointer
ok 835 - lead has no obsolete read pointer
  ---
  duration_ms: 0.502183
  type: 'test'
  ...
# Subtest: sub-lead has no obsolete read pointer
ok 836 - sub-lead has no obsolete read pointer
  ---
  duration_ms: 0.152693
  type: 'test'
  ...
# Subtest: worker has no obsolete read pointer
ok 837 - worker has no obsolete read pointer
  ---
  duration_ms: 0.100001
  type: 'test'
  ...
# Subtest: mapper has no obsolete read pointer
ok 838 - mapper has no obsolete read pointer
  ---
  duration_ms: 0.08335
  type: 'test'
  ...
# Subtest: designer has no obsolete read pointer
ok 839 - designer has no obsolete read pointer
  ---
  duration_ms: 0.099331
  type: 'test'
  ...
# Subtest: reviewer has no obsolete read pointer
ok 840 - reviewer has no obsolete read pointer
  ---
  duration_ms: 0.08334
  type: 'test'
  ...
# Subtest: verifier has no obsolete read pointer
ok 841 - verifier has no obsolete read pointer
  ---
  duration_ms: 0.093479
  type: 'test'
  ...
# Subtest: cards has no obsolete read pointer
ok 842 - cards has no obsolete read pointer
  ---
  duration_ms: 0.163884
  type: 'test'
  ...
# Subtest: lead has the direct pointer fallback
ok 843 - lead has the direct pointer fallback
  ---
  duration_ms: 0.617023
  type: 'test'
  ...
# Subtest: sub-lead has the direct pointer fallback
ok 844 - sub-lead has the direct pointer fallback
  ---
  duration_ms: 0.190896
  type: 'test'
  ...
# Subtest: worker has the direct pointer fallback
ok 845 - worker has the direct pointer fallback
  ---
  duration_ms: 0.169435
  type: 'test'
  ...
# Subtest: mapper has the direct pointer fallback
ok 846 - mapper has the direct pointer fallback
  ---
  duration_ms: 0.115692
  type: 'test'
  ...
# Subtest: designer has the direct pointer fallback
ok 847 - designer has the direct pointer fallback
  ---
  duration_ms: 0.143225
  type: 'test'
  ...
# Subtest: reviewer has the direct pointer fallback
ok 848 - reviewer has the direct pointer fallback
  ---
  duration_ms: 0.117776
  type: 'test'
  ...
# Subtest: verifier has the direct pointer fallback
ok 849 - verifier has the direct pointer fallback
  ---
  duration_ms: 0.170848
  type: 'test'
  ...
# Subtest: repo law paths are ordered and kept in one file
ok 850 - repo law paths are ordered and kept in one file
  ---
  duration_ms: 1.138102
  type: 'test'
  ...
# Subtest: verifier reports repo law gaps from the merge-base
ok 851 - verifier reports repo law gaps from the merge-base
  ---
  duration_ms: 0.311117
  type: 'test'
  ...
# Subtest: repo law breaks are always fixed and asides do not read it
ok 852 - repo law breaks are always fixed and asides do not read it
  ---
  duration_ms: 0.257103
  type: 'test'
  ...
# Subtest: sub-lead uses the binding sizing command and no-scout fallback
ok 853 - sub-lead uses the binding sizing command and no-scout fallback
  ---
  duration_ms: 0.421208
  type: 'test'
  ...
# Subtest: sub-lead briefs say role rules are in starting instructions
ok 854 - sub-lead briefs say role rules are in starting instructions
  ---
  duration_ms: 0.269667
  type: 'test'
  ...
# Subtest: worker preserves suite exit status
ok 855 - worker preserves suite exit status
  ---
  duration_ms: 0.201657
  type: 'test'
  ...
# Subtest: verifier preserves suite exit status
ok 856 - verifier preserves suite exit status
  ---
  duration_ms: 0.164416
  type: 'test'
  ...
# Subtest: lead finishing steps point to mergeability before done
ok 857 - lead finishing steps point to mergeability before done
  ---
  duration_ms: 0.9493
  type: 'test'
  ...
# Subtest: done card table lists the pushed head
ok 858 - done card table lists the pushed head
  ---
  duration_ms: 1.925983
  type: 'test'
  ...
# Subtest: lead.md has the Other leads on this machine section, as a standing rule
ok 859 - lead.md has the Other leads on this machine section, as a standing rule
  ---
  duration_ms: 0.820874
  type: 'test'
  ...
# Subtest: lead.md Overlap questions covers any project, earlier chat, finished check and re-ask
ok 860 - lead.md Overlap questions covers any project, earlier chat, finished check and re-ask
  ---
  duration_ms: 0.857955
  type: 'test'
  ...
# Subtest: lead.md Restarting what died resolves an unrecorded chat answer
ok 861 - lead.md Restarting what died resolves an unrecorded chat answer
  ---
  duration_ms: 0.817187
  type: 'test'
  ...
# Subtest: sub-lead posts screenshots as image cards
ok 862 - sub-lead posts screenshots as image cards
  ---
  duration_ms: 0.274967
  type: 'test'
  ...
# Subtest: open, show, and register-plan use the server registration writer
ok 863 - open, show, and register-plan use the server registration writer
  ---
  duration_ms: 502.17889
  type: 'test'
  ...
# Subtest: register rejects unsigned, stale, foreign-origin, and out-of-scope paths
ok 864 - register rejects unsigned, stale, foreign-origin, and out-of-scope paths
  ---
  duration_ms: 178.11992
  type: 'test'
  ...
# Subtest: a refused POST /register leaves .registered and .plans byte-identical
ok 865 - a refused POST /register leaves .registered and .plans byte-identical
  ---
  duration_ms: 103.399972
  type: 'test'
  ...
# Subtest: commands reuse a proven server and register without exposing its token
ok 866 - commands reuse a proven server and register without exposing its token
  ---
  duration_ms: 291.451485
  type: 'test'
  ...
# Subtest: --register-plan is best effort and never starts a server
ok 867 - --register-plan is best effort and never starts a server
  ---
  duration_ms: 2085.40004
  type: 'test'
  ...
# Subtest: --open records the caller tmux session, while a missing tmux records null
ok 868 - --open records the caller tmux session, while a missing tmux records null
  ---
  duration_ms: 305.431391
  type: 'test'
  ...
# Subtest: a failing tmux lookup records a null session
ok 869 - a failing tmux lookup records a null session
  ---
  duration_ms: 212.800239
  type: 'test'
  ...
# Subtest: twenty concurrent opens all land in the running server registry
ok 870 - twenty concurrent opens all land in the running server registry
  ---
  duration_ms: 453.51292
  type: 'test'
  ...
# Subtest: simultaneous first opens register their own paths and a later plan
ok 871 - simultaneous first opens register their own paths and a later plan
  ---
  duration_ms: 377.621246
  type: 'test'
  ...
# Subtest: a failed listener never changes either pre-existing list
ok 872 - a failed listener never changes either pre-existing list
  ---
  duration_ms: 2127.180397
  type: 'test'
  ...
# Subtest: a plan first graph creates its missing graphs directory and registers
ok 873 - a plan first graph creates its missing graphs directory and registers
  ---
  duration_ms: 90.49174
  type: 'test'
  ...
# Subtest: show signs watching without sending the token
ok 874 - show signs watching without sending the token
  ---
  duration_ms: 103.390933
  type: 'test'
  ...
# Subtest: a port thief after proof receives a signature but never the token
ok 875 - a port thief after proof receives a signature but never the token
  ---
  duration_ms: 175.677054
  type: 'test'
  ...
# Subtest: show overwrites open session and harness metadata with its own environment
ok 876 - show overwrites open session and harness metadata with its own environment
  ---
  duration_ms: 258.068701
  type: 'test'
  ...
# Subtest: open and show print token-free prefixed graph URLs, while show opens the token link and url prints the bookmark
ok 877 - open and show print token-free prefixed graph URLs, while show opens the token link and url prints the bookmark
  ---
  duration_ms: 320.08571
  type: 'test'
  ...
# Subtest: the nearest codex process wins over inherited CLAUDECODE and a claude ancestor
ok 878 - the nearest codex process wins over inherited CLAUDECODE and a claude ancestor
  ---
  duration_ms: 155.677192
  type: 'test'
  ...
# Subtest: registration rejects every out-of-scope plan and graph path before open reaches a port
ok 879 - registration rejects every out-of-scope plan and graph path before open reaches a port
  ---
  duration_ms: 127.268159
  type: 'test'
  ...
# Subtest: a registered graph replaced by an external symlink is refused on GET and PUT
ok 880 - a registered graph replaced by an external symlink is refused on GET and PUT
  ---
  duration_ms: 78.015617
  type: 'test'
  ...
# Subtest: register-plan has a two-second no-server grace and remains zero for bad paths
ok 881 - register-plan has a two-second no-server grace and remains zero for bad paths
  ---
  duration_ms: 2103.587238
  type: 'test'
  ...
# Subtest: pruning uses the newer graph mtime and added, and the newest plan markdown mtime
ok 882 - pruning uses the newer graph mtime and added, and the newest plan markdown mtime
  ---
  duration_ms: 58.027679
  type: 'test'
  ...
# Subtest: fresh accounts take unknown weight from the manifest
ok 883 - fresh accounts take unknown weight from the manifest
  ---
  duration_ms: 10.530913
  type: 'test'
  ...
# Subtest: a manifest without report takes hook text before reading the transcript
ok 884 - a manifest without report takes hook text before reading the transcript
  ---
  duration_ms: 5.256961
  type: 'test'
  ...
# Subtest: /list groups and orders opened graphs, marks ended sessions, quotes attach commands, and skips absent children
ok 885 - /list groups and orders opened graphs, marks ended sessions, quotes attach commands, and skips absent children
  ---
  duration_ms: 197.847507
  type: 'test'
  ...
# Subtest: /plan lists Markdown at every depth in byte order and refuses an unregistered directory
ok 886 - /plan lists Markdown at every depth in byte order and refuses an unregistered directory
  ---
  duration_ms: 184.756785
  type: 'test'
  ...
# Subtest: /doc returns 404 for non-Markdown files, parent paths, and a symlink leading outside its plan
ok 887 - /doc returns 404 for non-Markdown files, parent paths, and a symlink leading outside its plan
  ---
  duration_ms: 169.71374
  type: 'test'
  ...
# Subtest: /wheelchair/docs has CSP while a graph page keeps the index page header-free
ok 888 - /wheelchair/docs has CSP while a graph page keeps the index page header-free
  ---
  duration_ms: 161.070466
  type: 'test'
  ...
# Subtest: an app page carries font-src self and the font route serves only the allowlist
ok 889 - an app page carries font-src self and the font route serves only the allowlist
  ---
  duration_ms: 107.12314
  type: 'test'
  ...
# Subtest: /assets/doc.js needs no token and other asset names, including the removed list.js, are 404
ok 890 - /assets/doc.js needs no token and other asset names, including the removed list.js, are 404
  ---
  duration_ms: 109.986491
  type: 'test'
  ...
# Subtest: every other route requires a token while /whoami remains available
ok 891 - every other route requires a token while /whoami remains available
  ---
  duration_ms: 116.911891
  type: 'test'
  ...
# Subtest: a page changed on disk is served changed without restarting the server
ok 892 - a page changed on disk is served changed without restarting the server
  ---
  duration_ms: 115.726769
  type: 'test'
  ...
# Subtest: list-build pruning writes only when it removes entries and never rewrites again within an hour
ok 893 - list-build pruning writes only when it removes entries and never rewrites again within an hour
  ---
  duration_ms: 172.746776
  type: 'test'
  ...
# Subtest: GET /wheelchair/?token redirects without the token and sets the remember cookie attributes
ok 894 - GET /wheelchair/?token redirects without the token and sets the remember cookie attributes
  ---
  duration_ms: 100.306499
  type: 'test'
  ...
# Subtest: a remember cookie reads the graph page, list, plan, document, and graph
ok 895 - a remember cookie reads the graph page, list, plan, document, and graph
  ---
  duration_ms: 369.438626
  type: 'test'
  ...
# Subtest: JSON reads accept token directly and never set a remember cookie
ok 896 - JSON reads accept token directly and never set a remember cookie
  ---
  duration_ms: 223.172688
  type: 'test'
  ...
# Subtest: a signed-in /wheelchair/ and /wheelchair/app/ redirect to the Threads page; a graph path still opens the graph page
ok 897 - a signed-in /wheelchair/ and /wheelchair/app/ redirect to the Threads page; a graph path still opens the graph page
  ---
  duration_ms: 109.466725
  type: 'test'
  ...
# Subtest: a wrong page token redirects with a valid cookie, but otherwise gets the sign-in page
ok 898 - a wrong page token redirects with a valid cookie, but otherwise gets the sign-in page
  ---
  duration_ms: 100.161251
  type: 'test'
  ...
# Subtest: wrong cookies and cookies from before a rotation are refused
ok 899 - wrong cookies and cookies from before a rotation are refused
  ---
  duration_ms: 277.547172
  type: 'test'
  ...
# Subtest: a remember cookie is not a token, header token, or registration key
ok 900 - a remember cookie is not a token, header token, or registration key
  ---
  duration_ms: 92.899417
  type: 'test'
  ...
# Subtest: PUT graph and view accept a remember cookie only from a permitted origin
ok 901 - PUT graph and view accept a remember cookie only from a permitted origin
  ---
  duration_ms: 120.619851
  type: 'test'
  ...
# Subtest: PUT /wheelchair/graph accepts a remember cookie only from a permitted origin
ok 902 - PUT /wheelchair/graph accepts a remember cookie only from a permitted origin
  ---
  duration_ms: 140.501254
  type: 'test'
  ...
# Subtest: root routes move to /wheelchair and /wheelchair gains its trailing slash
ok 903 - root routes move to /wheelchair and /wheelchair gains its trailing slash
  ---
  duration_ms: 129.989777
  type: 'test'
  ...
# Subtest: page responses renew the Lax cookie while JSON responses do not, and anonymous pages explain sign-in
ok 904 - page responses renew the Lax cookie while JSON responses do not, and anonymous pages explain sign-in
  ---
  duration_ms: 136.899538
  type: 'test'
  ...
# Subtest: an anonymous JSON route returns a JSON 401 error
ok 905 - an anonymous JSON route returns a JSON 401 error
  ---
  duration_ms: 117.682208
  type: 'test'
  ...
# Subtest: diagram readers restrict registered graph files and preserve forms and sandbox HTML
ok 906 - diagram readers restrict registered graph files and preserve forms and sandbox HTML
  ---
  duration_ms: 234.392642
  type: 'test'
  ...
# Subtest: legacy canonical bytes remain unchanged, while a run graph writes its explicit fields
ok 907 - legacy canonical bytes remain unchanged, while a run graph writes its explicit fields
  ---
  duration_ms: 176.71769
  type: 'test'
  ...
# Subtest: run validation refuses each new schema violation
ok 908 - run validation refuses each new schema violation
  ---
  duration_ms: 1454.765082
  type: 'test'
  ...
# Subtest: the page may not change run status
ok 909 - the page may not change run status
  ---
  duration_ms: 100.707358
  type: 'test'
  ...
# Subtest: run and plain chain layouts keep their respective axes and spacing
ok 910 - run and plain chain layouts keep their respective axes and spacing
  ---
  duration_ms: 229.125172
  type: 'test'
  ...
# Subtest: a task-only run update keeps every position, including a drag
ok 911 - a task-only run update keeps every position, including a drag
  ---
  duration_ms: 110.039353
  type: 'test'
  ...
# Subtest: a progress-only write keeps a dragged position, and an added edge lays the picture out again
ok 912 - a progress-only write keeps a dragged position, and an added edge lays the picture out again
  ---
  duration_ms: 139.678716
  type: 'test'
  ...
# Subtest: rollups, nesting, updated, and the list run path follow run-picture rules
ok 913 - rollups, nesting, updated, and the list run path follow run-picture rules
  ---
  duration_ms: 210.710141
  type: 'test'
  ...
# Subtest: run nesting and reserved names are refused on registered paths
ok 914 - run nesting and reserved names are refused on registered paths
  ---
  duration_ms: 334.432871
  type: 'test'
  ...
# Subtest: default servers allocate independent temporary hub state
ok 915 - default servers allocate independent temporary hub state
  ---
  duration_ms: 208.977679
  type: 'test'
  ...
# Subtest: legacy verdict fields load and disappear after an agent removes an entry
ok 916 - legacy verdict fields load and disappear after an agent removes an entry
  ---
  duration_ms: 203.990135
  type: 'test'
  ...
# Subtest: canonical round-trip canonicalizes byte-for-byte
ok 917 - canonical round-trip canonicalizes byte-for-byte
  ---
  duration_ms: 282.763053
  type: 'test'
  ...
# Subtest: explanation written through /graph is retained on disk in canonical order
ok 918 - explanation written through /graph is retained on disk in canonical order
  ---
  duration_ms: 159.876908
  type: 'test'
  ...
# Subtest: groups canonicalize member lists, order, and byte round-trip
ok 919 - groups canonicalize member lists, order, and byte round-trip
  ---
  duration_ms: 287.868023
  type: 'test'
  ...
# Subtest: visible groups round-trip without explanation references
ok 920 - visible groups round-trip without explanation references
  ---
  duration_ms: 163.680961
  type: 'test'
  ...
# Subtest: groups default on writes and reads of legacy disk files
ok 921 - groups default on writes and reads of legacy disk files
  ---
  duration_ms: 131.220549
  type: 'test'
  ...
# Subtest: groups refuse malformed claims and unmatched explanation references
ok 922 - groups refuse malformed claims and unmatched explanation references
  ---
  duration_ms: 186.992301
  type: 'test'
  ...
# Subtest: edge labels are optional except on a fork arm
ok 923 - edge labels are optional except on a fork arm
  ---
  duration_ms: 125.489368
  type: 'test'
  ...
# Subtest: ordinary markdown links in explanations do not require groups
ok 924 - ordinary markdown links in explanations do not require groups
  ---
  duration_ms: 127.115616
  type: 'test'
  ...
# Subtest: explanation accepts only strings or null
ok 925 - explanation accepts only strings or null
  ---
  duration_ms: 103.204888
  type: 'test'
  ...
# Subtest: agent prose refuses positional claims in explanations and groups
ok 926 - agent prose refuses positional claims in explanations and groups
  ---
  duration_ms: 129.599158
  type: 'test'
  ...
# Subtest: quoted spans mask positional claims without masking apostrophes or stray delimiters
ok 927 - quoted spans mask positional claims without masking apostrophes or stray delimiters
  ---
  duration_ms: 215.03869
  type: 'test'
  ...
# Subtest: positional claims leave the downhill vocabulary, node text, and page reads alone
ok 928 - positional claims leave the downhill vocabulary, node text, and page reads alone
  ---
  duration_ms: 339.347064
  type: 'test'
  ...
# Subtest: self edges are refused after missing endpoints
ok 929 - self edges are refused after missing endpoints
  ---
  duration_ms: 121.419714
  type: 'test'
  ...
# Subtest: both write routes enforce their distinct authority
ok 930 - both write routes enforce their distinct authority
  ---
  duration_ms: 154.082005
  type: 'test'
  ...
# Subtest: /view cannot alter explanation
ok 931 - /view cannot alter explanation
  ---
  duration_ms: 99.087272
  type: 'test'
  ...
# Subtest: /view cannot alter groups and accepts an untouched deep clone
ok 932 - /view cannot alter groups and accepts an untouched deep clone
  ---
  duration_ms: 125.084571
  type: 'test'
  ...
# Subtest: optimistic concurrency returns and accepts the current hash, including create
ok 933 - optimistic concurrency returns and accepts the current hash, including create
  ---
  duration_ms: 221.056901
  type: 'test'
  ...
# Subtest: node and edge kinds are closed sets while omitted kinds default
ok 934 - node and edge kinds are closed sets while omitted kinds default
  ---
  duration_ms: 181.592266
  type: 'test'
  ...
# Subtest: the global write lock serializes concurrent writes and retry retains both changes
ok 935 - the global write lock serializes concurrent writes and retry retains both changes
  ---
  duration_ms: 154.357192
  type: 'test'
  ...
# Subtest: PUT /graph ignores every supplied position and lays every node out again
ok 936 - PUT /graph ignores every supplied position and lays every node out again
  ---
  duration_ms: 133.5687
  type: 'test'
  ...
# Subtest: a create is deterministic, keeps group-less layout intact, and permits matching group and node ids
ok 937 - a create is deterministic, keeps group-less layout intact, and permits matching group and node ids
  ---
  duration_ms: 407.3603
  type: 'test'
  ...
# Subtest: visible groups occupy units, preserve their rows, and leave every outsider clear
ok 938 - visible groups occupy units, preserve their rows, and leave every outsider clear
  ---
  duration_ms: 99.556059
  type: 'test'
  ...
# Subtest: a wide group’s real right edge clears the next disconnected component
ok 939 - a wide group’s real right edge clears the next disconnected component
  ---
  duration_ms: 97.104259
  type: 'test'
  ...
# Subtest: global variable rows align disconnected components and use a tall group’s real edge
ok 940 - global variable rows align disconnected components and use a tall group’s real edge
  ---
  duration_ms: 107.77507
  type: 'test'
  ...
# Subtest: the third pass keeps an arrow-less member’s middle first-pass slot
ok 941 - the third pass keeps an arrow-less member’s middle first-pass slot
  ---
  duration_ms: 98.884112
  type: 'test'
  ...
# Subtest: parallel arrows do not weight a third-pass median twice, and quotient loops still write
ok 942 - parallel arrows do not weight a third-pass median twice, and quotient loops still write
  ---
  duration_ms: 194.327767
  type: 'test'
  ...
# Subtest: the third pass deduplicates endpoint pairs before it counts external crossings
ok 943 - the third pass deduplicates endpoint pairs before it counts external crossings
  ---
  duration_ms: 104.516592
  type: 'test'
  ...
# Subtest: the third pass keeps the first pass’s crossing count on an internal counter-example
ok 944 - the third pass keeps the first pass’s crossing count on an internal counter-example
  ---
  duration_ms: 91.575106
  type: 'test'
  ...
# Subtest: the third pass keys a member on every neighbour, including members of its group
ok 945 - the third pass keys a member on every neighbour, including members of its group
  ---
  duration_ms: 89.225842
  type: 'test'
  ...
# Subtest: the third pass gives internal and external neighbours equal weight in its median
ok 946 - the third pass gives internal and external neighbours equal weight in its median
  ---
  duration_ms: 89.776508
  type: 'test'
  ...
# Subtest: the third pass freezes other groups before it walks either group
ok 947 - the third pass freezes other groups before it walks either group
  ---
  duration_ms: 98.160314
  type: 'test'
  ...
# Subtest: a bend point reserves its own pitch, so a multi-row arrow lays out unchanged
ok 948 - a bend point reserves its own pitch, so a multi-row arrow lays out unchanged
  ---
  duration_ms: 98.273741
  type: 'test'
  ...
# Subtest: a unit shorter than its row sits on the row line rather than centred in it
ok 949 - a unit shorter than its row sits on the row line rather than centred in it
  ---
  duration_ms: 87.895631
  type: 'test'
  ...
# Subtest: the third pass reads earlier group-mates live as it walks a row
ok 950 - the third pass reads earlier group-mates live as it walks a row
  ---
  duration_ms: 99.29525
  type: 'test'
  ...
# Subtest: the third pass leaves a group rectangle and member rows at their first-pass values
ok 951 - the third pass leaves a group rectangle and member rows at their first-pass values
  ---
  duration_ms: 212.939484
  type: 'test'
  ...
# Subtest: all containment retarget cases, cycles, deep acyclic writes, and missing children follow the contract
ok 952 - all containment retarget cases, cycles, deep acyclic writes, and missing children follow the contract
  ---
  duration_ms: 370.028876
  type: 'test'
  ...
# Subtest: retargeting away unregisters a derivable child
ok 953 - retargeting away unregisters a derivable child
  ---
  duration_ms: 85.185695
  type: 'test'
  ...
# Subtest: whoami is unauthenticated identity, never a mutation credential
ok 954 - whoami is unauthenticated identity, never a mutation credential
  ---
  duration_ms: 69.9707
  type: 'test'
  ...
# Subtest: --show opens a browser once, and never while a tab is already on that graph
ok 955 - --show opens a browser once, and never while a tab is already on that graph
  ---
  duration_ms: 1541.806713
  type: 'test'
  ...
# Subtest: two starts at the same instant leave one server, and the loser reuses it rather than dying
ok 956 - two starts at the same instant leave one server, and the loser reuses it rather than dying
  ---
  duration_ms: 4511.327771
  type: 'test'
  ...
# Subtest: listen-first startup reuses the port holder and ignores stale .server information
ok 957 - listen-first startup reuses the port holder and ignores stale .server information
  ---
  duration_ms: 233.003515
  type: 'test'
  ...
# Subtest: the token is published atomically while independent ports can start
ok 958 - the token is published atomically while independent ports can start
  ---
  duration_ms: 107.878288
  type: 'test'
  ...
# Subtest: GET change detection exposes agent hashes and preserves the page write hash
ok 959 - GET change detection exposes agent hashes and preserves the page write hash
  ---
  duration_ms: 84.018086
  type: 'test'
  ...
# Subtest: a kill before rename leaves the committed graph as either whole version, never a partial write
ok 960 - a kill before rename leaves the committed graph as either whole version, never a partial write
  ---
  duration_ms: 6535.220635
  type: 'test'
  ...
# Subtest: registered paths are pruned by age at startup
ok 961 - registered paths are pruned by age at startup
  ---
  duration_ms: 62.201511
  type: 'test'
  ...
# Subtest: malformed on-disk graphs refuse without repair
ok 962 - malformed on-disk graphs refuse without repair
  ---
  duration_ms: 236.656899
  type: 'test'
  ...
# Subtest: layout runs downhill: an arrow never points back up the page
ok 963 - layout runs downhill: an arrow never points back up the page
  ---
  duration_ms: 73.07448
  type: 'test'
  ...
# Subtest: layout places every component, including a disconnected two-cycle
ok 964 - layout places every component, including a disconnected two-cycle
  ---
  duration_ms: 74.028019
  type: 'test'
  ...
# Subtest: cache-root isolation never changes the live default cache
ok 965 - cache-root isolation never changes the live default cache
  ---
  duration_ms: 72.137955
  type: 'test'
  ...
# Subtest: line bands and tricky
ok 966 - line bands and tricky
  ---
  duration_ms: 1100.574664
  type: 'test'
  ...
# Subtest: excluded paths, raw names, subdirectories and executable scout diff
ok 967 - excluded paths, raw names, subdirectories and executable scout diff
  ---
  duration_ms: 152.84847
  type: 'test'
  ...
# Subtest: only excluded changes and exact file or symlink
ok 968 - only excluded changes and exact file or symlink
  ---
  duration_ms: 435.85462
  type: 'test'
  ...
# Subtest: renames across exclusion with renames disabled in config
ok 969 - renames across exclusion with renames disabled in config
  ---
  duration_ms: 120.58297
  type: 'test'
  ...
# Subtest: binary counts zero and errors are prefixed
ok 970 - binary counts zero and errors are prefixed
  ---
  duration_ms: 145.768554
  type: 'test'
  ...
# Subtest: session output compact and full
ok 971 - session output compact and full
  ---
  duration_ms: 278.621542
  type: 'test'
  ...
# Subtest: session leads sends the all-projects flag and prints the response
ok 972 - session leads sends the all-projects flag and prints the response
  ---
  duration_ms: 140.856775
  type: 'test'
  ...
# Subtest: screen start passes the operation and unchanged arguments
ok 973 - screen start passes the operation and unchanged arguments
  ---
  duration_ms: 84.779626
  type: 'test'
  ...
# Subtest: screen run passes the operation and unchanged arguments
ok 974 - screen run passes the operation and unchanged arguments
  ---
  duration_ms: 67.689065
  type: 'test'
  ...
# Subtest: screen shot passes the operation and unchanged arguments
ok 975 - screen shot passes the operation and unchanged arguments
  ---
  duration_ms: 71.145924
  type: 'test'
  ...
# Subtest: screen windows passes the operation and unchanged arguments
ok 976 - screen windows passes the operation and unchanged arguments
  ---
  duration_ms: 60.76626
  type: 'test'
  ...
# Subtest: screen move passes the operation and unchanged arguments
ok 977 - screen move passes the operation and unchanged arguments
  ---
  duration_ms: 56.341896
  type: 'test'
  ...
# Subtest: screen click passes the operation and unchanged arguments
ok 978 - screen click passes the operation and unchanged arguments
  ---
  duration_ms: 56.168174
  type: 'test'
  ...
# Subtest: screen drag passes the operation and unchanged arguments
ok 979 - screen drag passes the operation and unchanged arguments
  ---
  duration_ms: 56.29675
  type: 'test'
  ...
# Subtest: screen type passes the operation and unchanged arguments
ok 980 - screen type passes the operation and unchanged arguments
  ---
  duration_ms: 56.552992
  type: 'test'
  ...
# Subtest: screen key passes the operation and unchanged arguments
ok 981 - screen key passes the operation and unchanged arguments
  ---
  duration_ms: 48.775307
  type: 'test'
  ...
# Subtest: screen focus passes the operation and unchanged arguments
ok 982 - screen focus passes the operation and unchanged arguments
  ---
  duration_ms: 53.893672
  type: 'test'
  ...
# Subtest: screen stop passes the operation and unchanged arguments
ok 983 - screen stop passes the operation and unchanged arguments
  ---
  duration_ms: 49.838065
  type: 'test'
  ...
# Subtest: screen status passes the operation and unchanged arguments
ok 984 - screen status passes the operation and unchanged arguments
  ---
  duration_ms: 47.880361
  type: 'test'
  ...
# Subtest: screen non-2xx response is reported with the wc prefix
ok 985 - screen non-2xx response is reported with the wc prefix
  ---
  duration_ms: 51.656862
  type: 'test'
  ...
# Subtest: unknown screen op fails without sending a request
ok 986 - unknown screen op fails without sending a request
  ---
  duration_ms: 36.368768
  type: 'test'
  ...
# Subtest: screenRequest rejects unknown and missing operations
ok 987 - screenRequest rejects unknown and missing operations
  ---
  duration_ms: 0.665366
  type: 'test'
  ...
# Subtest: templates work, reject existing folders and names, and use checkout top
ok 988 - templates work, reject existing folders and names, and use checkout top
  ---
  duration_ms: 506.762376
  type: 'test'
  ...
# Subtest: session list reads pinned shared tools and hides collisions
ok 989 - session list reads pinned shared tools and hides collisions
  ---
  duration_ms: 86.427657
  type: 'test'
  ...
# Subtest: run and check sanitize environment and report failures
ok 990 - run and check sanitize environment and report failures
  ---
  duration_ms: 342.433392
  type: 'test'
  ...
# Subtest: check deadline and SIGTERM kill stalled server and grandchild
ok 991 - check deadline and SIGTERM kill stalled server and grandchild
  ---
  duration_ms: 1366.305783
  type: 'test'
  ...
# Subtest: win info passes the operation and unchanged arguments
ok 992 - win info passes the operation and unchanged arguments
  ---
  duration_ms: 68.673212
  type: 'test'
  ...
# Subtest: win sync passes the operation and unchanged arguments
ok 993 - win sync passes the operation and unchanged arguments
  ---
  duration_ms: 62.334056
  type: 'test'
  ...
# Subtest: win run passes the operation and unchanged arguments
ok 994 - win run passes the operation and unchanged arguments
  ---
  duration_ms: 50.512179
  type: 'test'
  ...
# Subtest: win start passes the operation and unchanged arguments
ok 995 - win start passes the operation and unchanged arguments
  ---
  duration_ms: 53.309341
  type: 'test'
  ...
# Subtest: win status passes the operation and unchanged arguments
ok 996 - win status passes the operation and unchanged arguments
  ---
  duration_ms: 53.569531
  type: 'test'
  ...
# Subtest: win windows passes the operation and unchanged arguments
ok 997 - win windows passes the operation and unchanged arguments
  ---
  duration_ms: 50.467592
  type: 'test'
  ...
# Subtest: win shot passes the operation and unchanged arguments
ok 998 - win shot passes the operation and unchanged arguments
  ---
  duration_ms: 52.731684
  type: 'test'
  ...
# Subtest: win stop passes the operation and unchanged arguments
ok 999 - win stop passes the operation and unchanged arguments
  ---
  duration_ms: 50.781975
  type: 'test'
  ...
# Subtest: win path passes the operation and unchanged arguments
ok 1000 - win path passes the operation and unchanged arguments
  ---
  duration_ms: 46.057305
  type: 'test'
  ...
# Subtest: win non-2xx response is reported with the wc prefix
ok 1001 - win non-2xx response is reported with the wc prefix
  ---
  duration_ms: 52.471956
  type: 'test'
  ...
# Subtest: unknown win op fails without sending a request
ok 1002 - unknown win op fails without sending a request
  ---
  duration_ms: 43.570196
  type: 'test'
  ...
# Subtest: winRequest rejects unknown and missing operations
ok 1003 - winRequest rejects unknown and missing operations
  ---
  duration_ms: 0.580904
  type: 'test'
  ...
# Subtest: win info writes disk warnings to stderr and preserves JSON stdout
ok 1004 - win info writes disk warnings to stderr and preserves JSON stdout
  ---
  duration_ms: 51.385634
  type: 'test'
  ...
# Subtest: the page eligibility regex equals the machine one
ok 1005 - the page eligibility regex equals the machine one
  ---
  duration_ms: 1.73652
  type: 'test'
  ...
# Subtest: the page eligibility function
ok 1006 - the page eligibility function
  ---
  duration_ms: 0.550435
  type: 'test'
  ...
# Subtest: worker effort must be a supported level and cannot exceed the manifest ceiling
ok 1007 - worker effort must be a supported level and cannot exceed the manifest ceiling
  ---
  duration_ms: 2323.844668
  type: 'test'
  ...
# Subtest: stored ZIP has names and bytes readable by Python
ok 1008 - stored ZIP has names and bytes readable by Python
  ---
  duration_ms: 48.965613
  type: 'test'
  ...
1..1008
# tests 1024
# suites 0
# pass 1023
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 55291.361606

```
