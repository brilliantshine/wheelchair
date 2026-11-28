# R1-B: Settings UI verification gaps and firefox-specs

## Changes

- `viewer/pages/settings.js`
  - `headsUpAction()` now awaits `refreshDiffs(true)`, so the legacy pin notice follows a Switch, Skip or Reset without a reload.
  - `refreshDiffs(force)` can re-read even when no notice is showing.
  - `ladderList` `commit()`: switched-off providers keep their saved index, capped so those after them still fit, which keeps their relative order. The comment above says so.
- `viewer/pages/settings.css`
  - `.m-agent-main` wraps; `.m-id` is `flex: 1 1 240px; min-width: 220px`.
  - `.model-controls` wraps. Not named in the brief: at 900 px the Claude tier tab's effort pills ran to x=947 and were clipped, while `documentElement.scrollWidth` still read 900.
- `viewer/test/firefox-specs.js`: added `app-assistant-popup.spec.js`.
- `viewer/test/app-settings.spec.js`: three tests (switched-off order on both shared ladders; 900 px preview width, no overflow, element edges on every tier tab and a single row at 1280; heads-up Switch updating the notice).

## Validation

### `npm --prefix viewer run test:browser -- app-settings.spec.js app-assistant-popup.spec.js`

```
exit 0

> agent-graph-viewer@1.0.0 test:browser
> playwright test --reporter=list app-settings.spec.js app-assistant-popup.spec.js


Running 210 tests using 2 workers

  ✓    2 [chromium] › test/app-settings.spec.js:43:3 › desktop › the nav shows Settings and the route serves (244ms)
  ✓    3 [chromium] › test/app-settings.spec.js:53:3 › desktop › nine categories in order, kept across a reload through the hash (476ms)
  ✓    4 [chromium] › test/app-settings.spec.js:69:3 › desktop › the Kimi tab has no effort pills while Claude keeps them (257ms)
  ✓    5 [chromium] › test/app-settings.spec.js:77:3 › desktop › permission labels name the tools in their groups (165ms)
  ✓    6 [chromium] › test/app-settings.spec.js:85:3 › desktop › a slashed Kimi alias saves through Other, survives a reload, and other providers refuse a slash (796ms)
  ✓    7 [chromium] › test/app-settings.spec.js:109:3 › desktop › editing a table cell saves, and Not used saves null (1.3s)
  ✓    8 [chromium] › test/app-settings.spec.js:151:3 › desktop › effort pills offer each provider its levels and save at once (547ms)
  ✓    1 [chromium] › test/app-assistant-popup.spec.js:37:3 › assistant pop-up › button shows on a project thread page, not on the assistant thread page; off adds nothing (4.0s)
  ✓    9 [chromium] › test/app-settings.spec.js:169:3 › desktop › no Lead or Sub-lead pickers remain, and the scout tiers save independently (333ms)
  ✓   11 [chromium] › test/app-settings.spec.js:182:3 › desktop › Escalation: default text, Model first, Highest tier Heavy (691ms)
  ✓   12 [chromium] › test/app-settings.spec.js:204:3 › desktop › creating and saving a template, marking it in use, and the worker-only switch (1.3s)
  ✓   13 [chromium] › test/app-settings.spec.js:264:3 › desktop › a template whose project is gone says so (193ms)
  ✓   10 [chromium] › test/app-assistant-popup.spec.js:55:3 › assistant pop-up › turning off removes an open panel without reloading (2.8s)
  ✓   14 [chromium] › test/app-settings.spec.js:273:3 › desktop › the auto-merge switch says Saved, not applies to new sessions, and survives a reload (542ms)
  ✓   16 [chromium] › test/app-settings.spec.js:287:3 › desktop › the style saves (559ms)
  ✓   17 [chromium] › test/app-settings.spec.js:305:3 › desktop › preview: disabled with a spinner while pending, then the result; nothing is saved (377ms)
  ✓   18 [chromium] › test/app-settings.spec.js:330:3 › desktop › a failed preview shows one plain line under the panel (285ms)
  ✓   19 [chromium] › test/app-settings.spec.js:344:3 › phone › the Settings link shows a gear, is wide enough to tap, and opens Settings (188ms)
  ✓   15 [chromium] › test/app-assistant-popup.spec.js:64:3 › assistant pop-up › turning on in an open tab and off and on again restores the button (2.3s)
  ✓   20 [chromium] › test/app-settings.spec.js:356:3 › phone › every category fits without scrolling sideways (3.3s)
  ✓   22 [chromium] › test/app-settings.spec.js:370:7 › phone › the nav fits 390px on /app/threads (134ms)
  ✓   23 [chromium] › test/app-settings.spec.js:370:7 › phone › the nav fits 390px on /app/settings (123ms)
  ✓   24 [chromium] › test/app-settings.spec.js:370:7 › phone › the nav fits 390px on /app/new (119ms)
  ✓   25 [chromium] › test/app-settings.spec.js:370:7 › phone › the nav fits 360px on /app/threads (128ms)
  ✓   26 [chromium] › test/app-settings.spec.js:370:7 › phone › the nav fits 360px on /app/settings (121ms)
  ✓   27 [chromium] › test/app-settings.spec.js:370:7 › phone › the nav fits 360px on /app/new (126ms)
  ✓   28 [chromium] › test/app-settings.spec.js:391:3 › phone › the Escalation section fits a phone and the effort pills stay usable (490ms)
  ✓   29 [chromium] › test/app-settings.spec.js:411:3 › phone › Your name saves and survives a reload, and a too-long name is refused with the typed value kept (718ms)
  ✓   30 [chromium] › test/app-settings.spec.js:433:3 › phone › the Default project folder saves, and a refusal shows under it with the typed value kept (629ms)
  ✓   31 [chromium] › test/app-settings.spec.js:456:3 › phone › Settings keeps its accessible name on a phone (122ms)
  ✓   32 [chromium] › test/app-settings.spec.js:464:1 › picks a lead name list and uploads a custom one in Settings (412ms)
  ✓   33 [chromium] › test/app-settings.spec.js:478:1 › a quoted CSV upload keeps commas inside names (252ms)
  ✓   34 [chromium] › test/app-settings.spec.js:485:1 › a later dropdown choice wins over a slow upload save (373ms)
  ✓   35 [chromium] › test/app-settings.spec.js:502:1 › a slow upload does not undo a list picked after switching sections (1.8s)
  ✓   36 [chromium] › test/app-settings.spec.js:533:1 › picking Custom while another list saves keeps Custom and its file picker (407ms)
  ✓   37 [chromium] › test/app-settings.spec.js:560:1 › Custom picked again during a slow upload and another save stays Custom (660ms)
  ✓   38 [chromium] › test/app-settings.spec.js:584:1 › a failed save of another list keeps a later pick of Custom (410ms)
  ✓   39 [chromium] › test/app-settings.spec.js:604:1 › only the newest uploaded file is saved (656ms)
  ✓   40 [chromium] › test/app-settings.spec.js:626:1 › the preview panes are unfilled and Visibility is a short track under its label (219ms)
  ✓   41 [chromium] › test/app-settings.spec.js:641:1 › the preview panes carry the mockup’s text and are its height at 390px (211ms)
  ✓   42 [chromium] › test/app-settings.spec.js:658:1 › Models fits at 390px (227ms)
  ✓   21 [chromium] › test/app-assistant-popup.spec.js:80:3 › assistant pop-up › a new restart context line lights the unread dot (11.0s)
  ✓   43 [chromium] › test/app-settings.spec.js:674:1 › shared tools picker uses saved projects, resolves in parallel and retains a missing choice (478ms)
  -   45 [chromium] › test/app-settings.spec.js:699:1 › capture shared tools picker screens
  ✓   46 [chromium] › test/app-settings.spec.js:730:3 › categories › each moved control is in its category (700ms)
  ✓   47 [chromium] › test/app-settings.spec.js:757:3 › categories › Diagrams choices show in You (227ms)
  ✓   48 [chromium] › test/app-settings.spec.js:765:3 › categories › old keys open the category holding them, and an unknown key opens You (312ms)
  ✓   44 [chromium] › test/app-assistant-popup.spec.js:99:3 › assistant pop-up › keeps a draft until the first chat response arrives (2.1s)
  ✓   49 [chromium] › test/app-settings.spec.js:778:3 › categories › both lesson addresses open that role's editor (496ms)
  ✓   50 [chromium] › test/app-assistant-popup.spec.js:139:3 › assistant pop-up › keeps a pending message when earlier transcript text matches (632ms)
  ✓   51 [chromium] › test/app-settings.spec.js:790:3 › categories › on a phone no hash lists the categories, and ‹ Settings returns to the list (538ms)
  ✓   53 [chromium] › test/app-settings.spec.js:816:3 › categories › crossing the phone width rebuilds nothing (431ms)
  ✓   54 [chromium] › test/app-settings.spec.js:840:3 › categories › switching the Harnesses machine keeps an open account rename (274ms)
  ✓   52 [chromium] › test/app-assistant-popup.spec.js:152:3 › assistant pop-up › renders context, a press, and question consequences and sends an answer (2.1s)
  ✓   55 [chromium] › test/app-settings.spec.js:851:3 › categories › an install progress tick keeps an open account rename (2.6s)
  ✓   57 [chromium] › test/app-settings.spec.js:863:3 › categories › saving a background keeps text typed in Writing style (420ms)
  ✓   56 [chromium] › test/app-assistant-popup.spec.js:172:3 › assistant pop-up › system needs, file, image and lesson cards retain their content and actions (2.0s)
  ✓   58 [chromium] › test/app-settings.spec.js:881:3 › categories › the phone list keeps the hidden background editor until You is reopened (608ms)
  ✓   60 [chromium] › test/app-settings.spec.js:958:3 › one place for sign-in, usage and each draft › Harnesses' sign-in link opens the account cards' sign-in for the Harnesses machine (361ms)
  ✓   61 [chromium] › test/app-settings.spec.js:986:3 › one place for sign-in, usage and each draft › account cards show one usage line and no usage bars (232ms)
  ✓   62 [chromium] › test/app-settings.spec.js:1000:3 › one place for sign-in, usage and each draft › the per-account table draws a bar for each window and account cards draw none (306ms)
  ✓   63 [chromium] › test/app-settings.spec.js:1023:3 › one place for sign-in, usage and each draft › Harnesses answering while a button below is pressed does not move it from under the press (275ms)
  ✓   64 [chromium] › test/app-settings.spec.js:1047:3 › one place for sign-in, usage and each draft › Harnesses answering during Send code keeps the sign-in card in place (560ms)
  ✓   65 [chromium] › test/app-settings.spec.js:1106:3 › one place for sign-in, usage and each draft › the balancing Save sends no provider order and updates the reserve label (278ms)
  ✓   66 [chromium] › test/app-settings.spec.js:1122:3 › one place for sign-in, usage and each draft › opening Usage and balancing re-reads the reserved provider and keeps what was typed (323ms)
  ✓   67 [chromium] › test/app-settings.spec.js:1138:3 › one place for sign-in, usage and each draft › turning a harness on shows its account cards, waiting while an account edit is open (394ms)
  ✓   59 [chromium] › test/app-assistant-popup.spec.js:217:7 › assistant pop-up › configuration wait on desktop › shows why the assistant cannot start above the composer, only while it waits on Settings → Models (7.0s)
  ✓   68 [chromium] › test/app-settings.spec.js:1166:3 › one place for sign-in, usage and each draft › after an account sign-in, Harnesses and the account card show the new status (4.2s)
  ✓   70 [chromium] › test/app-settings.spec.js:1203:3 › one place for sign-in, usage and each draft › pausing and adding an account reload the Harnesses status (503ms)
  ✓   71 [chromium] › test/app-settings.spec.js:1223:1 › shared keys follow machine, show refusals and reload on revision conflicts (337ms)
  ✓   72 [chromium] › test/app-settings.spec.js:1257:1 › shared key saves from two tabs use the read revision and reload the stale tab (558ms)
  ✓   73 [chromium] › test/app-settings.spec.js:1286:1 › capture shared keys with a chosen project at phone size (231ms)
  ✓   74 [chromium] › test/app-settings.spec.js:1350:3 › Antigravity levels › effort choices are the chosen model's levels, and a level it has is kept (529ms)
  ✓   75 [chromium] › test/app-settings.spec.js:1360:3 › Antigravity levels › effort resets to CLI default when the new model lacks the level (392ms)
  ✓   76 [chromium] › test/app-settings.spec.js:1370:3 › Antigravity levels › effort is disabled at CLI default for a model with no levels (392ms)
  ✓   77 [chromium] › test/app-settings.spec.js:1380:3 › Antigravity levels › effort offers every level for a typed model with unknown levels (504ms)
  ✓   78 [chromium] › test/app-settings.spec.js:1389:3 › Antigravity levels › effort comes from a member id typed through Other (516ms)
  ✓   79 [chromium] › test/app-settings.spec.js:1398:3 › Antigravity levels › effort save redraws the saved cell from a fresh read of the settings (644ms)
  ✓   80 [chromium] › test/app-settings.spec.js:1417:3 › Antigravity levels › effort save leaves the drafts typed in other cells (468ms)
  ✓   81 [chromium] › test/app-settings.spec.js:1438:3 › Antigravity levels › effort saves made while the list is still being re-read each get the fresh list (1.1s)
  ✓   69 [chromium] › test/app-assistant-popup.spec.js:217:7 › assistant pop-up › configuration wait on phone › shows why the assistant cannot start above the composer, only while it waits on Settings → Models (6.9s)
  ✓   82 [chromium] › test/app-settings.spec.js:1456:3 › Antigravity levels › effort stays saved, and says so, when the list cannot be re-read after a save (557ms)
  ✓   83 [chromium] › test/app-assistant-popup.spec.js:245:3 › assistant pop-up › the configuration wait follows the project lead and Assistant switch (861ms)
  ✓   84 [chromium] › test/app-settings.spec.js:1501:3 › Models: tiers, ladders and notices › ten roles in order, each tier saving at once with its model preview following (2.5s)
  ✓   85 [chromium] › test/app-assistant-popup.spec.js:270:3 › assistant pop-up › the thread page shows a configuration wait as its own reason (1.9s)
  ✓   86 [chromium] › test/app-settings.spec.js:1534:3 › Models: tiers, ladders and notices › a refused tier or ladder save puts the choice back and says why on its row (711ms)
  ✓   87 [chromium] › test/app-assistant-popup.spec.js:288:7 › assistant pop-up › phone › closed button clears the short project composer (676ms)
  ✓   89 [chromium] › test/app-assistant-popup.spec.js:288:7 › assistant pop-up › phone › closed button clears the long project composer (675ms)
  ✓   88 [chromium] › test/app-settings.spec.js:1549:3 › Models: tiers, ladders and notices › a role ladder shows its default, starts Custom from it and saves each edit while staying open (1.8s)
  ✓   91 [chromium] › test/app-settings.spec.js:1603:3 › Models: tiers, ladders and notices › a custom order keeps a switched-off provider where it was saved (545ms)
  ✓   92 [chromium] › test/app-settings.spec.js:1613:3 › Models: tiers, ladders and notices › removing an enabled provider keeps two switched-off ones in their order (560ms)
  ✓   93 [chromium] › test/app-settings.spec.js:1624:3 › Models: tiers, ladders and notices › at 900px with every provider on and a custom ladder, the preview stays readable (647ms)
  ✓   90 [chromium] › test/app-assistant-popup.spec.js:297:5 › assistant pop-up › phone › button follows the composer as a short thread grows (3.0s)
  ✓   95 [chromium] › test/app-assistant-popup.spec.js:309:5 › assistant pop-up › phone › opens as a sheet covering nearly the screen, with a close control (580ms)
  ✓   94 [chromium] › test/app-settings.spec.js:1651:3 › Models: tiers, ladders and notices › switching a GPT heads-up model updates the saved Lead models notice without a reload (800ms)
  ✓   97 [chromium] › test/app-settings.spec.js:1663:3 › Models: tiers, ladders and notices › the shared ladders save at once and the role rows follow (954ms)
  ✓   98 [chromium] › test/app-settings.spec.js:1686:3 › Models: tiers, ladders and notices › tabs list only enabled providers, and a Not used tier disables its pills (867ms)
  ✓   96 [chromium] › test/app-assistant-popup.spec.js:331:5 › assistant pop-up › desktop › opens as a side panel and sends text to the assistant thread (2.1s)
  ✓   99 [chromium] › test/app-settings.spec.js:1703:3 › Models: tiers, ladders and notices › the saved Lead models notice recovers a Not used tier only on a press, and Dismiss ends it (999ms)
  ✓  101 [chromium] › test/app-settings.spec.js:1729:3 › Models: tiers, ladders and notices › with every provider on, a phone shows the open ladder without sideways scrolling (432ms)
  ✓  100 [chromium] › test/app-assistant-popup.spec.js:349:5 › assistant pop-up › desktop › shows thinking while the lead is mid-turn and not after (4.6s)
  ✓  102 [firefox] › test/app-assistant-popup.spec.js:37:3 › assistant pop-up › button shows on a project thread page, not on the assistant thread page; off adds nothing (4.6s)
  ✓  103 [chromium] › test/app-assistant-popup.spec.js:363:5 › assistant pop-up › desktop › unread dot appears for a newer item and clears on open (2.2s)
  ✓  105 [chromium] › test/app-assistant-popup.spec.js:381:5 › assistant pop-up › desktop › says the assistant is not running and offers Restart (892ms)
  ✓  104 [firefox] › test/app-assistant-popup.spec.js:55:3 › assistant pop-up › turning off removes an open panel without reloading (3.0s)
  ✓  107 [firefox] › test/app-assistant-popup.spec.js:64:3 › assistant pop-up › turning on in an open tab and off and on again restores the button (1.0s)
  ✓  106 [chromium] › test/app-assistant-popup.spec.js:396:1 › poll does not allow a second send while a message is in flight (3.4s)
  ✓  109 [chromium] › test/app-assistant-popup.spec.js:422:1 › sending preserves a different draft typed while the request is in flight (595ms)
  ✓  110 [firefox] › test/app-settings.spec.js:43:3 › desktop › the nav shows Settings and the route serves (954ms)
  ✓  111 [firefox] › test/app-settings.spec.js:53:3 › desktop › nine categories in order, kept across a reload through the hash (676ms)
  ✓  112 [firefox] › test/app-settings.spec.js:69:3 › desktop › the Kimi tab has no effort pills while Claude keeps them (410ms)
  ✓  113 [firefox] › test/app-settings.spec.js:77:3 › desktop › permission labels name the tools in their groups (318ms)
  ✓  114 [firefox] › test/app-settings.spec.js:85:3 › desktop › a slashed Kimi alias saves through Other, survives a reload, and other providers refuse a slash (1.1s)
  ✓  115 [firefox] › test/app-settings.spec.js:109:3 › desktop › editing a table cell saves, and Not used saves null (1.8s)
  ✓  116 [firefox] › test/app-settings.spec.js:151:3 › desktop › effort pills offer each provider its levels and save at once (767ms)
  ✓  117 [firefox] › test/app-settings.spec.js:169:3 › desktop › no Lead or Sub-lead pickers remain, and the scout tiers save independently (648ms)
  ✓  118 [firefox] › test/app-settings.spec.js:182:3 › desktop › Escalation: default text, Model first, Highest tier Heavy (940ms)
  ✓  108 [firefox] › test/app-assistant-popup.spec.js:80:3 › assistant pop-up › a new restart context line lights the unread dot (11.3s)
  ✓  119 [firefox] › test/app-settings.spec.js:204:3 › desktop › creating and saving a template, marking it in use, and the worker-only switch (2.8s)
  ✓  121 [firefox] › test/app-settings.spec.js:264:3 › desktop › a template whose project is gone says so (440ms)
  ✓  122 [firefox] › test/app-settings.spec.js:273:3 › desktop › the auto-merge switch says Saved, not applies to new sessions, and survives a reload (669ms)
  ✓  120 [firefox] › test/app-assistant-popup.spec.js:99:3 › assistant pop-up › keeps a draft until the first chat response arrives (2.4s)
  ✓  123 [firefox] › test/app-settings.spec.js:287:3 › desktop › the style saves (871ms)
  ✓  124 [firefox] › test/app-assistant-popup.spec.js:139:3 › assistant pop-up › keeps a pending message when earlier transcript text matches (858ms)
  ✓  125 [firefox] › test/app-settings.spec.js:305:3 › desktop › preview: disabled with a spinner while pending, then the result; nothing is saved (611ms)
  ✓  127 [firefox] › test/app-settings.spec.js:330:3 › desktop › a failed preview shows one plain line under the panel (404ms)
  ✓  128 [firefox] › test/app-settings.spec.js:344:3 › phone › the Settings link shows a gear, is wide enough to tap, and opens Settings (395ms)
  ✓  126 [firefox] › test/app-assistant-popup.spec.js:152:3 › assistant pop-up › renders context, a press, and question consequences and sends an answer (2.3s)
  ✓  130 [firefox] › test/app-assistant-popup.spec.js:172:3 › assistant pop-up › system needs, file, image and lesson cards retain their content and actions (819ms)
  ✓  129 [firefox] › test/app-settings.spec.js:356:3 › phone › every category fits without scrolling sideways (3.6s)
  ✓  132 [firefox] › test/app-settings.spec.js:370:7 › phone › the nav fits 390px on /app/threads (311ms)
  ✓  133 [firefox] › test/app-settings.spec.js:370:7 › phone › the nav fits 390px on /app/settings (341ms)
  ✓  134 [firefox] › test/app-settings.spec.js:370:7 › phone › the nav fits 390px on /app/new (1.2s)
  ✓  135 [firefox] › test/app-settings.spec.js:370:7 › phone › the nav fits 360px on /app/threads (352ms)
  ✓  136 [firefox] › test/app-settings.spec.js:370:7 › phone › the nav fits 360px on /app/settings (322ms)
  ✓  137 [firefox] › test/app-settings.spec.js:370:7 › phone › the nav fits 360px on /app/new (303ms)
  ✓  138 [firefox] › test/app-settings.spec.js:391:3 › phone › the Escalation section fits a phone and the effort pills stay usable (678ms)
  ✓  139 [firefox] › test/app-settings.spec.js:411:3 › phone › Your name saves and survives a reload, and a too-long name is refused with the typed value kept (795ms)
  ✓  131 [firefox] › test/app-assistant-popup.spec.js:217:7 › assistant pop-up › configuration wait on desktop › shows why the assistant cannot start above the composer, only while it waits on Settings → Models (6.8s)
  ✓  140 [firefox] › test/app-settings.spec.js:433:3 › phone › the Default project folder saves, and a refusal shows under it with the typed value kept (796ms)
  ✓  142 [firefox] › test/app-settings.spec.js:456:3 › phone › Settings keeps its accessible name on a phone (339ms)
  ✓  143 [firefox] › test/app-settings.spec.js:464:1 › picks a lead name list and uploads a custom one in Settings (811ms)
  ✓  144 [firefox] › test/app-settings.spec.js:478:1 › a quoted CSV upload keeps commas inside names (466ms)
  ✓  145 [firefox] › test/app-settings.spec.js:485:1 › a later dropdown choice wins over a slow upload save (1.3s)
  ✓  146 [firefox] › test/app-settings.spec.js:502:1 › a slow upload does not undo a list picked after switching sections (2.0s)
  ✓  147 [firefox] › test/app-settings.spec.js:533:1 › picking Custom while another list saves keeps Custom and its file picker (545ms)
  ✓  148 [firefox] › test/app-settings.spec.js:560:1 › Custom picked again during a slow upload and another save stays Custom (805ms)
  ✓  149 [firefox] › test/app-settings.spec.js:584:1 › a failed save of another list keeps a later pick of Custom (588ms)
  ✓  141 [firefox] › test/app-assistant-popup.spec.js:217:7 › assistant pop-up › configuration wait on phone › shows why the assistant cannot start above the composer, only while it waits on Settings → Models (7.1s)
  ✓  150 [firefox] › test/app-settings.spec.js:604:1 › only the newest uploaded file is saved (873ms)
  ✓  152 [firefox] › test/app-settings.spec.js:626:1 › the preview panes are unfilled and Visibility is a short track under its label (422ms)
  ✓  151 [firefox] › test/app-assistant-popup.spec.js:245:3 › assistant pop-up › the configuration wait follows the project lead and Assistant switch (1.2s)
  ✓  153 [firefox] › test/app-settings.spec.js:641:1 › the preview panes carry the mockup’s text and are its height at 390px (422ms)
  ✓  154 [firefox] › test/app-assistant-popup.spec.js:270:3 › assistant pop-up › the thread page shows a configuration wait as its own reason (590ms)
  ✓  155 [firefox] › test/app-settings.spec.js:658:1 › Models fits at 390px (477ms)
  ✓  156 [firefox] › test/app-assistant-popup.spec.js:288:7 › assistant pop-up › phone › closed button clears the short project composer (901ms)
  ✓  157 [firefox] › test/app-settings.spec.js:674:1 › shared tools picker uses saved projects, resolves in parallel and retains a missing choice (773ms)
  ✓  158 [firefox] › test/app-assistant-popup.spec.js:288:7 › assistant pop-up › phone › closed button clears the long project composer (856ms)
  -  159 [firefox] › test/app-settings.spec.js:699:1 › capture shared tools picker screens
  ✓  161 [firefox] › test/app-settings.spec.js:730:3 › categories › each moved control is in its category (1.1s)
  ✓  162 [firefox] › test/app-settings.spec.js:757:3 › categories › Diagrams choices show in You (392ms)
  ✓  163 [firefox] › test/app-settings.spec.js:765:3 › categories › old keys open the category holding them, and an unknown key opens You (590ms)
  ✓  160 [firefox] › test/app-assistant-popup.spec.js:297:5 › assistant pop-up › phone › button follows the composer as a short thread grows (3.2s)
  ✓  164 [firefox] › test/app-settings.spec.js:778:3 › categories › both lesson addresses open that role's editor (802ms)
  ✓  165 [firefox] › test/app-assistant-popup.spec.js:309:5 › assistant pop-up › phone › opens as a sheet covering nearly the screen, with a close control (821ms)
  ✓  166 [firefox] › test/app-settings.spec.js:790:3 › categories › on a phone no hash lists the categories, and ‹ Settings returns to the list (761ms)
  ✓  167 [firefox] › test/app-assistant-popup.spec.js:331:5 › assistant pop-up › desktop › opens as a side panel and sends text to the assistant thread (938ms)
  ✓  168 [firefox] › test/app-settings.spec.js:816:3 › categories › crossing the phone width rebuilds nothing (899ms)
  ✓  170 [firefox] › test/app-settings.spec.js:840:3 › categories › switching the Harnesses machine keeps an open account rename (571ms)
  ✓  171 [firefox] › test/app-settings.spec.js:851:3 › categories › an install progress tick keeps an open account rename (2.7s)
  ✓  172 [firefox] › test/app-settings.spec.js:863:3 › categories › saving a background keeps text typed in Writing style (586ms)
  ✓  169 [firefox] › test/app-assistant-popup.spec.js:349:5 › assistant pop-up › desktop › shows thinking while the lead is mid-turn and not after (4.9s)
  ✓  173 [firefox] › test/app-settings.spec.js:881:3 › categories › the phone list keeps the hidden background editor until You is reopened (2.0s)
  ✓  175 [firefox] › test/app-settings.spec.js:958:3 › one place for sign-in, usage and each draft › Harnesses' sign-in link opens the account cards' sign-in for the Harnesses machine (632ms)
  ✓  176 [firefox] › test/app-settings.spec.js:986:3 › one place for sign-in, usage and each draft › account cards show one usage line and no usage bars (369ms)
  ✓  174 [firefox] › test/app-assistant-popup.spec.js:363:5 › assistant pop-up › desktop › unread dot appears for a newer item and clears on open (2.4s)
  ✓  177 [firefox] › test/app-settings.spec.js:1000:3 › one place for sign-in, usage and each draft › the per-account table draws a bar for each window and account cards draw none (554ms)
  ✓  179 [firefox] › test/app-settings.spec.js:1023:3 › one place for sign-in, usage and each draft › Harnesses answering while a button below is pressed does not move it from under the press (597ms)
  ✓  178 [firefox] › test/app-assistant-popup.spec.js:381:5 › assistant pop-up › desktop › says the assistant is not running and offers Restart (1.6s)
  ✓  180 [firefox] › test/app-settings.spec.js:1047:3 › one place for sign-in, usage and each draft › Harnesses answering during Send code keeps the sign-in card in place (761ms)
  ✓  182 [firefox] › test/app-settings.spec.js:1106:3 › one place for sign-in, usage and each draft › the balancing Save sends no provider order and updates the reserve label (579ms)
  ✓  183 [firefox] › test/app-settings.spec.js:1122:3 › one place for sign-in, usage and each draft › opening Usage and balancing re-reads the reserved provider and keeps what was typed (510ms)
  ✓  184 [firefox] › test/app-settings.spec.js:1138:3 › one place for sign-in, usage and each draft › turning a harness on shows its account cards, waiting while an account edit is open (629ms)
  ✓  181 [firefox] › test/app-assistant-popup.spec.js:396:1 › poll does not allow a second send while a message is in flight (3.8s)
  ✓  186 [firefox] › test/app-assistant-popup.spec.js:422:1 › sending preserves a different draft typed while the request is in flight (794ms)
  ✓  185 [firefox] › test/app-settings.spec.js:1166:3 › one place for sign-in, usage and each draft › after an account sign-in, Harnesses and the account card show the new status (4.0s)
  ✓  187 [firefox] › test/app-settings.spec.js:1203:3 › one place for sign-in, usage and each draft › pausing and adding an account reload the Harnesses status (1.9s)
  ✓  188 [firefox] › test/app-settings.spec.js:1223:1 › shared keys follow machine, show refusals and reload on revision conflicts (644ms)
  ✓  189 [firefox] › test/app-settings.spec.js:1257:1 › shared key saves from two tabs use the read revision and reload the stale tab (867ms)
  ✓  190 [firefox] › test/app-settings.spec.js:1286:1 › capture shared keys with a chosen project at phone size (388ms)
  ✓  191 [firefox] › test/app-settings.spec.js:1350:3 › Antigravity levels › effort choices are the chosen model's levels, and a level it has is kept (697ms)
  ✓  192 [firefox] › test/app-settings.spec.js:1360:3 › Antigravity levels › effort resets to CLI default when the new model lacks the level (574ms)
  ✓  193 [firefox] › test/app-settings.spec.js:1370:3 › Antigravity levels › effort is disabled at CLI default for a model with no levels (547ms)
  ✓  194 [firefox] › test/app-settings.spec.js:1380:3 › Antigravity levels › effort offers every level for a typed model with unknown levels (768ms)
  ✓  195 [firefox] › test/app-settings.spec.js:1389:3 › Antigravity levels › effort comes from a member id typed through Other (909ms)
  ✓  196 [firefox] › test/app-settings.spec.js:1398:3 › Antigravity levels › effort save redraws the saved cell from a fresh read of the settings (908ms)
  ✓  197 [firefox] › test/app-settings.spec.js:1417:3 › Antigravity levels › effort save leaves the drafts typed in other cells (2.3s)
  ✓  198 [firefox] › test/app-settings.spec.js:1438:3 › Antigravity levels › effort saves made while the list is still being re-read each get the fresh list (1.4s)
  ✓  199 [firefox] › test/app-settings.spec.js:1456:3 › Antigravity levels › effort stays saved, and says so, when the list cannot be re-read after a save (711ms)
  ✓  200 [firefox] › test/app-settings.spec.js:1501:3 › Models: tiers, ladders and notices › ten roles in order, each tier saving at once with its model preview following (2.8s)
  ✓  201 [firefox] › test/app-settings.spec.js:1534:3 › Models: tiers, ladders and notices › a refused tier or ladder save puts the choice back and says why on its row (859ms)
  ✓  202 [firefox] › test/app-settings.spec.js:1549:3 › Models: tiers, ladders and notices › a role ladder shows its default, starts Custom from it and saves each edit while staying open (2.1s)
  ✓  203 [firefox] › test/app-settings.spec.js:1603:3 › Models: tiers, ladders and notices › a custom order keeps a switched-off provider where it was saved (749ms)
  ✓  204 [firefox] › test/app-settings.spec.js:1613:3 › Models: tiers, ladders and notices › removing an enabled provider keeps two switched-off ones in their order (769ms)
  ✓  205 [firefox] › test/app-settings.spec.js:1624:3 › Models: tiers, ladders and notices › at 900px with every provider on and a custom ladder, the preview stays readable (2.5s)
  ✓  206 [firefox] › test/app-settings.spec.js:1651:3 › Models: tiers, ladders and notices › switching a GPT heads-up model updates the saved Lead models notice without a reload (882ms)
  ✓  207 [firefox] › test/app-settings.spec.js:1663:3 › Models: tiers, ladders and notices › the shared ladders save at once and the role rows follow (2.7s)
  ✓  208 [firefox] › test/app-settings.spec.js:1686:3 › Models: tiers, ladders and notices › tabs list only enabled providers, and a Not used tier disables its pills (1.2s)
  ✓  209 [firefox] › test/app-settings.spec.js:1703:3 › Models: tiers, ladders and notices › the saved Lead models notice recovers a Not used tier only on a press, and Dismiss ends it (1.2s)
  ✓  210 [firefox] › test/app-settings.spec.js:1729:3 › Models: tiers, ladders and notices › with every provider on, a phone shows the open ladder without sideways scrolling (685ms)

  2 skipped
  208 passed (2.5m)
```

### `node --test machine/test/name-guard.test.js`

```
exit 0
TAP version 13
# Subtest: detector recognizes name checks across lines
ok 1 - detector recognizes name checks across lines
  ---
  duration_ms: 5.136977
  type: 'test'
  ...
# Subtest: tool names do not dispatch outside connectors
ok 2 - tool names do not dispatch outside connectors
  ---
  duration_ms: 180.053733
  type: 'test'
  ...
1..2
# tests 2
# suites 0
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 235.618992
```

### New tests with the fix removed (Chromium, one at a time)

- Source changes to `settings.js` and `settings.css` reverted: the ladder order test failed on the saved array; the 900 px test failed with `Expected: >= 200, Received: 130`; the heads-up test failed with the notice still reading `Heavy is gpt-6.1-sol (high)`.
- Only `.model-controls` wrapping removed: the 900 px test failed listing `xhigh`, `max` as outside their block.

## Screenshots

Compared against `docs/plans/agent-model-preferences/graphs/mockup-models-desktop-v5.html` at 1280 wide. They are in session scratch space, so they may not survive a reboot.

- Built, 1280: `/tmp/claude-1000/-home-collin--local-state-wheelchair-worktrees-wheelchair-wc-c29d9fe6f697-w7/b4e7de31-1094-4420-ba2f-8a448ad4b136/scratchpad/models-1280.png`
- Mockup, 1280: `/tmp/claude-1000/-home-collin--local-state-wheelchair-worktrees-wheelchair-wc-c29d9fe6f697-w7/b4e7de31-1094-4420-ba2f-8a448ad4b136/scratchpad/mockup-1280.png`
- Built, 900 (no mockup at this width): `/tmp/claude-1000/-home-collin--local-state-wheelchair-worktrees-wheelchair-wc-c29d9fe6f697-w7/b4e7de31-1094-4420-ba2f-8a448ad4b136/scratchpad/models-900.png`
- Built, 900 with Code mapping's ladder editor open: `/tmp/claude-1000/-home-collin--local-state-wheelchair-worktrees-wheelchair-wc-c29d9fe6f697-w7/b4e7de31-1094-4420-ba2f-8a448ad4b136/scratchpad/models-900-editor.png`

At 1280 the Leads and Code mapping rows are single-row, as the mockup has them. Previews wrap to two or three lines where the mockup has one, because they show full model ids (already noted in REMEDIATION-1). Wording and sample data differences in other parts were not part of this task.

## Not done

The optional tightening of row padding mentioned in REMEDIATION-1 was not in this brief and was left alone.

## Choices

- A switched-off provider whose old index no longer leaves room for those after it moves up, even if its own index was in range, since pinning it would reverse the order (`settings.js` `commit`).
- The notice is re-read after every heads-up action, including when none was showing; the hub returns an empty list once dismissed (`settings.js` `headsUpAction`).
- Used flex wrapping rather than a media query, with a 240 px basis and 220 px minimum (`settings.css` `.m-id`).
- Wrapped controls sit left-aligned under the preview (`settings.css` `.m-agent-main`).
- Fixed the clipped tier effort pills at 900 px by letting them drop below the model picker (`settings.css` `.model-controls`).
