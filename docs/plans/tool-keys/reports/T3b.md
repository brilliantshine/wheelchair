# T3b report — attempt 2

Merged `wc/1d9da322519c` before working and kept the first attempt's forwarding and UI work. The Shared keys switch did make the second read: the bug was that the returned note elements were passed as an array to native `replaceChildren`, which converted the array to text. Spreading the elements fixes the display.

- `viewer/app/routes.js`: forwards project key status and shared-key actions to the selected machine, adding that machine's configured shared-project candidates and retaining the existing timeout/error mapping.
- `viewer/pages/project-tools.js`: renders folder key lines, key usage and unusable values. Successful key writes apply the reply first, then refresh status best effort; conflicts refresh best effort without discarding drafts. Unrelated pending key values survive key-only writes, including when a reply lists a key newly stored elsewhere. Folder usage and removal text also work when there is no `.mcp.json` baseline.
- `viewer/pages/settings.js`, `viewer/pages/settings.css`: machine-specific Shared keys editor, revision conflicts, inline refusals and notes, including when no shared project is chosen. Empty error elements and hint margins no longer add extra card spacing.
- `viewer/test/helpers/app-machine.js`, `viewer/test/app-project-tools.test.js`, `viewer/test/app-project-tools.spec.js`, `viewer/test/app-settings.spec.js`: fake routes and coverage for forwarding, two machines, key secrecy, failed and successful status refreshes, retained drafts, conflicts, combined saves, usage, machine switching, shared-key refusals and the no-copy note. The shared-project Tools page check uses a machine-response fixture; the machine's store selection is independently covered by its tests.

## Screenshots

Captured at 390×844 in the browser specs and compared with rendered mockups:

- `/tmp/t3b-tools-phone.png` versus `/tmp/t3b-mockup-tools-mixed-phone.png` (`docs/plans/tool-keys/graphs/mockup-tools-mixed-phone.html`). The key warning and mixed folder rows have the same hierarchy, color and spacing. Existing phone navigation differs; fixture machine/project names differ, and weather is labeled this project instead of shared.
- `/tmp/t3b-shared-chosen-phone.png` versus `/tmp/t3b-mockup-shared-chosen-phone.png` (`docs/plans/tool-keys/graphs/mockup-shared-chosen-phone.html`). The chosen project uses its fixture repository name. Existing phone navigation differs; the machine chooser is added by Decision 12 and shifts the keys downward.

## Mutation checks

Each temporary mutation was restored after its focused test failed; logs are `/tmp/t3b-mut-<name>.log`. The exit was 1 for each: `route-machine` (wrong shared machine), `route-config` (wrong candidates), `route-secret-log` (log a key), `route-errors` (hide transport errors), `folder-line`, `key-usage`, `confirm-users`, `project-unusable`, `shared-unusable`, `status-refresh`, `save-reply`, `conflict-refresh`, `combined-reload`, `combined-keys-reload`, `shared-switch`, `shared-note`, `shared-reason`, `shared-revision`, `pending`, and `no-baseline`. Failures were read from each log. The tests use fixtures for browser responses and do not replace end-to-end machine integration verification.

## Choices

- `viewer/pages/project-tools.js`: treat a malformed key-status success body as a failed best-effort refresh so it cannot partially replace current status.
- `viewer/pages/project-tools.js`: when folder users are known but no baseline exists, removal says `Tools using it` rather than `Tools on main using it`.
- `viewer/test/app-project-tools.test.js`: use a second fake machine service to verify routing to the chosen machine independently of candidate injection.

## Validation

`node --test viewer/test/app-project-tools.test.js viewer/test/app-settings.test.js viewer/test/app-shared-tools-setting.test.js machine/test/project-tools.test.js`

```text
exit 0
ok 62 - lead name settings trim and validate names
  ---
  duration_ms: 250.737333
  type: 'test'
  ...
# Subtest: lead name list choice saves, validates and migrates
ok 63 - lead name list choice saves, validates and migrates
  ---
  duration_ms: 210.526067
  type: 'test'
  ...
# Subtest: gemini settings migrate and enforce account and model rules
ok 64 - gemini settings migrate and enforce account and model rules
  ---
  duration_ms: 175.718354
  type: 'test'
  ...
# Subtest: removed worker providers stay removed after saving
ok 65 - removed worker providers stay removed after saving
  ---
  duration_ms: 188.438701
  type: 'test'
  ...
# Subtest: scout preferences and session layers follow the selected provider
ok 66 - scout preferences and session layers follow the selected provider
  ---
  duration_ms: 868.954623
  type: 'test'
  ...
# Subtest: model ID limits protect near-limit scout role layers
ok 67 - model ID limits protect near-limit scout role layers
  ---
  duration_ms: 584.82431
  type: 'test'
  ...
# Subtest: your name is saved, validated, and told to every agent only when set
ok 68 - your name is saved, validated, and told to every agent only when set
  ---
  duration_ms: 263.154658
  type: 'test'
  ...
# Subtest: shared tools project choice saves and clears
ok 69 - shared tools project choice saves and clears
  ---
  duration_ms: 243.744849
  type: 'test'
  ...
# Subtest: shared tools setting defaults, validates and saves
ok 70 - shared tools setting defaults, validates and saves
  ---
  duration_ms: 367.408355
  type: 'test'
  ...
# Subtest: folder problem lines appear and clear on a newer update
ok 71 - folder problem lines appear and clear on a newer update
  ---
  duration_ms: 1.497182
  type: 'test'
  ...
# Subtest: session start sends this machine’s saved paths in order and omits an unset choice
ok 72 - session start sends this machine’s saved paths in order and omits an unset choice
  ---
  duration_ms: 428.437441
  type: 'test'
  ...
# Subtest: ready event updates folder problem card
ok 73 - ready event updates folder problem card
  ---
  duration_ms: 269.387466
  type: 'test'
  ...
1..73
# tests 73
# suites 0
# pass 73
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9735.984492
```

`npm --prefix viewer run test:browser -- app-project-tools.spec.js app-settings.spec.js`

```text
exit 0
  ✓   99 [chromium] › test/app-project-tools.spec.js:952:1 › R7-1: a setting with a newline is read-only, refuses a kind change and is sent unchanged (343ms)
  ✓   98 [chromium] › test/app-settings.spec.js:729:3 › categories › each moved control is in its category (760ms)
  ✓  100 [chromium] › test/app-project-tools.spec.js:965:1 › R7-1: a header value with a tab is read-only (280ms)
  ✓  101 [chromium] › test/app-settings.spec.js:756:3 › categories › Diagrams choices show in You (240ms)
  ✓  102 [chromium] › test/app-project-tools.spec.js:971:1 › R7-1: a command with a control character is read-only and kept on an unrelated edit (342ms)
  ✓  103 [chromium] › test/app-settings.spec.js:764:3 › categories › old keys open the category holding them, and an unknown key opens You (398ms)
  ✓  104 [chromium] › test/app-project-tools.spec.js:982:1 › R7-1: a tool name with a newline shows read-only with no Edit button (243ms)
  ✓  106 [chromium] › test/app-project-tools.spec.js:989:1 › R7-1: a read-only web tool card shows every raw field and its key chip (258ms)
  ✓  105 [chromium] › test/app-settings.spec.js:777:3 › categories › both lesson addresses open that role's editor (617ms)
  ✓  107 [chromium] › test/app-project-tools.spec.js:997:1 › R7-2: a read-only value with a newline shows in its JSON form, not collapsed (246ms)
  ✓  109 [chromium] › test/app-project-tools.spec.js:1002:1 › R8-2: a tool with both url and command shows every raw field in file order (259ms)
  ✓  110 [chromium] › test/app-project-tools.spec.js:1011:1 › R8-2: an unknown type is shown as written with all its fields (244ms)
  ✓  108 [chromium] › test/app-settings.spec.js:789:3 › categories › on a phone no hash lists the categories, and ‹ Settings returns to the list (535ms)
  ✓  112 [chromium] › test/app-settings.spec.js:815:3 › categories › crossing the phone width rebuilds nothing (460ms)
  ✓  111 [chromium] › test/app-project-tools.spec.js:1019:1 › R8-2: an editable header row with a key and trailing text shows the key status (486ms)
  ✓  114 [chromium] › test/app-project-tools.spec.js:1031:1 › R8-2: a tool the form cannot edit shows a key line from the machine checks (251ms)
  ✓  113 [chromium] › test/app-settings.spec.js:839:3 › categories › switching the Harnesses machine keeps an open account rename (273ms)
  ✓  115 [chromium] › test/app-project-tools.spec.js:1038:1 › R8-2: a field value with HTML is shown as text and creates no element (260ms)
  ✓  116 [chromium] › test/app-settings.spec.js:850:3 › categories › an install progress tick keeps an open account rename (2.6s)
  ✓  118 [chromium] › test/app-settings.spec.js:862:3 › categories › saving a background keeps text typed in Writing style (385ms)
  ✓  119 [chromium] › test/app-settings.spec.js:880:3 › categories › the phone list keeps the hidden background editor until You is reopened (674ms)
  ✓  120 [chromium] › test/app-settings.spec.js:957:3 › one place for sign-in, usage and each draft › Harnesses' sign-in link opens the account cards' sign-in for the Harnesses machine (330ms)
  ✓  117 [chromium] › test/app-project-tools.spec.js:1045:1 › Unity preset adds distinct tools and reports preparation (3.8s)
  ✓  121 [chromium] › test/app-settings.spec.js:985:3 › one place for sign-in, usage and each draft › account cards show one usage line and no usage bars (246ms)
  ✓  122 [chromium] › test/app-project-tools.spec.js:1060:1 › Unity preset reports a failed fetch (330ms)
  ✓  123 [chromium] › test/app-settings.spec.js:999:3 › one place for sign-in, usage and each draft › the per-account table draws a bar for each window and account cards draw none (322ms)
  ✓  124 [chromium] › test/app-project-tools.spec.js:1066:1 › Unity button ignores a double press while the first request is held (320ms)
  ✓  125 [chromium] › test/app-settings.spec.js:1022:3 › one place for sign-in, usage and each draft › Harnesses answering while a button below is pressed does not move it from under the press (277ms)
  ✓  126 [chromium] › test/app-project-tools.spec.js:1092:1 › the Runs on Windows switch shows only on WSL for eligible web addresses and follows URL edits (319ms)
  ✓  128 [chromium] › test/app-project-tools.spec.js:1110:1 › the switch is hidden when the machine is not WSL (249ms)
  ✓  127 [chromium] › test/app-settings.spec.js:1046:3 › one place for sign-in, usage and each draft › Harnesses answering during Send code keeps the sign-in card in place (582ms)
  ✓  129 [chromium] › test/app-project-tools.spec.js:1118:1 › a switch change alone is dirty and saves windows with tools (402ms)
  ✓  130 [chromium] › test/app-settings.spec.js:1106:5 › one place for sign-in, usage and each draft › pressing the lead-order Save keeps the other box's unsaved edit and updates the reserve label (304ms)
  ✓  131 [chromium] › test/app-project-tools.spec.js:1134:3 › open editor follows card switch off through save (384ms)
  ✓  132 [chromium] › test/app-settings.spec.js:1106:5 › one place for sign-in, usage and each draft › pressing the balancing Save keeps the other box's unsaved edit and updates the reserve label (391ms)
  ✓  133 [chromium] › test/app-project-tools.spec.js:1134:3 › open editor follows card switch on through save (377ms)
  ✓  134 [chromium] › test/app-settings.spec.js:1134:3 › one place for sign-in, usage and each draft › opening Usage and balancing re-reads the reserved provider and keeps what was typed (358ms)
  ✓  135 [chromium] › test/app-project-tools.spec.js:1147:1 › the form switch follows the card until touched, then the form choice wins (394ms)
  ✓  136 [chromium] › test/app-settings.spec.js:1150:3 › one place for sign-in, usage and each draft › turning a harness on shows its account cards, waiting while an account edit is open (412ms)
  ✓  137 [chromium] › test/app-project-tools.spec.js:1162:1 › cancel discards the form switch choice but keeps the card switch change (376ms)
  ✓  139 [chromium] › test/app-project-tools.spec.js:1174:1 › rename and delete update the saved windows list; marks on hidden entries are kept (372ms)
  ✓  140 [chromium] › test/app-project-tools.spec.js:1186:1 › a mark on a hidden entry stays; deleting an entry removes its mark (492ms)
  ✓  141 [chromium] › test/app-project-tools.spec.js:1200:1 › a key-only save sends no windows (295ms)
  ✓  142 [chromium] › test/app-project-tools.spec.js:1210:1 › the status line shows each state with its check time and Check again (1.2s)
  ✓  143 [chromium] › test/app-project-tools.spec.js:1237:1 › a failed request says Couldn't check (1.0s)
  ✓  138 [chromium] › test/app-settings.spec.js:1178:3 › one place for sign-in, usage and each draft › after an account sign-in, Harnesses and the account card show the new status (4.2s)
  ✓  145 [chromium] › test/app-settings.spec.js:1215:3 › one place for sign-in, usage and each draft › pausing and adding an account reload the Harnesses status (480ms)
  ✓  146 [chromium] › test/app-settings.spec.js:1235:1 › shared keys follow machine, show refusals and reload on revision conflicts (389ms)
  ✓  147 [chromium] › test/app-settings.spec.js:1269:1 › shared key saves from two tabs use the read revision and reload the stale tab (555ms)
  ✓  144 [chromium] › test/app-project-tools.spec.js:1242:1 › after an opened pull request the reread clears the store and a stale reply is dropped (2.0s)
  ✓  148 [chromium] › test/app-settings.spec.js:1298:1 › capture shared keys with a chosen project at phone size (249ms)
  ✓  149 [chromium] › test/app-project-tools.spec.js:1258:1 › two rows with the same name and different URLs each get their own result (1.1s)
  ✓  150 [chromium] › test/app-project-tools.spec.js:1271:1 › Cancel, Keep changes, a reload and the Unity poll end with a line for the current values (3.5s)
  ✓  151 [chromium] › test/app-project-tools.spec.js:1290:1 › a URL edited A to B to A before the check fires shows A's result; rename keeps the line; kind change hides it (1.9s)
  ✓  152 [chromium] › test/app-project-tools.spec.js:1310:1 › a reply that arrives after switching project or for an old URL is not applied (2.2s)
  ✓  153 [chromium] › test/app-project-tools.spec.js:1323:1 › a stale reply for an old URL is not applied (2.2s)
  ✓  154 [chromium] › test/app-project-tools.spec.js:1345:1 › timing: URL A to B to A inside the debounce shows A's stored result and sends no request for B (1.9s)
  ✓  155 [chromium] › test/app-project-tools.spec.js:1358:1 › timing: Keep changes before the debounce fires still ends on a result (1.1s)
  ✓  156 [chromium] › test/app-project-tools.spec.js:1371:1 › timing: renaming during a check keeps the pending request and shows its result (2.0s)
  ✓  157 [chromium] › test/app-project-tools.spec.js:1385:1 › timing: changing kind away and back during a check never leaves the line on Checking (1.9s)
  ✓  158 [chromium] › test/app-project-tools.spec.js:1401:1 › timing: a Unity poll re-render while a check is pending still ends on the held reply (5.0s)
  ✓  159 [chromium] › test/app-project-tools.spec.js:1420:1 › timing: a same-project reload while a check is pending drops the old reply and ends on a result (2.5s)
  ✓  160 [chromium] › test/app-project-tools.spec.js:1438:1 › timing: a save clears the store and a reply to a request made before it is not stored (2.4s)
  ✓  161 [chromium] › test/app-project-tools.spec.js:1457:1 › timing: two rows with the same name and different URLs go in one request with distinct ids (1.0s)
  ✓  162 [chromium] › test/app-project-tools.spec.js:1470:1 › timing: same-name rows with different URLs go in one request, distinct ids, each shows its own result (card and form copy) (1.1s)
  ✓  163 [chromium] › test/app-project-tools.spec.js:1487:1 › timing: two keys due in one debounce window go out in one request, not before it ends (1.2s)
  ✓  164 [chromium] › test/app-project-tools.spec.js:1501:1 › timing: a network abort says Couldn't check (1.0s)
  ✓  165 [chromium] › test/app-project-tools.spec.js:1507:1 › folder tools show mixed and empty states (243ms)
  ✓  166 [chromium] › test/app-project-tools.spec.js:1527:1 › folder tools empty state (223ms)
  -  167 [chromium] › test/app-project-tools.spec.js:1532:1 › capture folder tool screens
  ✓  168 [chromium] › test/app-project-tools.spec.js:1554:1 › folder key status refresh preserves drafts and conflict retry uses the new revision (482ms)
  ✓  169 [chromium] › test/app-project-tools.spec.js:1584:1 › key writes apply their replies when key status is unavailable (395ms)
  ✓  170 [chromium] › test/app-project-tools.spec.js:1600:1 › a key conflict keeps drafts even when status refresh fails (365ms)
  ✓  171 [chromium] › test/app-project-tools.spec.js:1613:1 › shared project folder keys point to Settings and are absent from the project editor (229ms)
  ✓  172 [chromium] › test/app-project-tools.spec.js:1620:1 › folder tool users appear beside server users and in removal confirmation (259ms)
  ✓  173 [chromium] › test/app-project-tools.spec.js:1629:1 › folder tool users remain visible when the project has no baseline (245ms)
  ✓  174 [chromium] › test/app-project-tools.spec.js:1637:1 › key-only writes retain unrelated pending values for a combined save (494ms)

  2 skipped
  172 passed (1.2m)
```
