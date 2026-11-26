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


(Full TAP output cut by the sub-lead; failing tests and final summary lines kept.)
```text
not ok 538 - 6 message clears debt
not ok 599 - ready event updates folder problem card
# tests 1024
# suites 0
# pass 1022
# fail 2
# cancelled 0
# skipped 0
# todo 0
# duration_ms 89216.154575
not ok 599 - ready event updates folder problem card
# tests 1024
# suites 0
# pass 1023
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 55291.361606
```
