# R1a report

## Changes

- `viewer/pages/thread.js`: snapshot attachments for ordered upload, disable composer editing and attachment mutation during upload, preserve drafts on failure, remove sent files by identity on success, and prefer hub error detail.
- `viewer/test/app-diagrams-uploads.spec.js`: cover a held upload and the app-error explanation in both browsers.

## Validation

The full browser suite had the two documented arrow-layout failures; all other browser tests passed. The Node suite passed. No requested work remains undone.

### `npm --prefix viewer ci`

```text

added 5 packages, and audited 6 packages in 354ms

2 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

### `npm --prefix viewer run test:browser -- app-diagrams-uploads`

```text

> agent-graph-viewer@1.0.0 test:browser
> playwright test --reporter=list app-diagrams-uploads


Running 8 tests using 2 workers

(node:2895257) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:2895261) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ✓  1 [chromium] › test/app-diagrams-uploads.spec.js:15:1 › forms and static sandboxed HTML render without overflow or network (1.0s)
  ✓  2 [firefox] › test/app-diagrams-uploads.spec.js:15:1 › forms and static sandboxed HTML render without overflow or network (1.9s)
  ✓  4 [firefox] › test/app-diagrams-uploads.spec.js:49:1 › paste uploads bytes, oversize is refused, and image cards respect archive (3.0s)
  ✓  3 [chromium] › test/app-diagrams-uploads.spec.js:49:1 › paste uploads bytes, oversize is refused, and image cards respect archive (4.7s)
  ✓  5 [firefox] › test/app-diagrams-uploads.spec.js:74:1 › attachments stay fixed during upload and are sent in order (2.1s)
  ✓  6 [chromium] › test/app-diagrams-uploads.spec.js:74:1 › attachments stay fixed during upload and are sent in order (1.9s)
  ✓  7 [firefox] › test/app-diagrams-uploads.spec.js:101:1 › upload app error shows detail and preserves the draft (599ms)
  ✓  8 [chromium] › test/app-diagrams-uploads.spec.js:101:1 › upload app error shows detail and preserves the draft (381ms)

  8 passed (8.8s)

```

### `npm --prefix viewer run test:browser`

```text

> agent-graph-viewer@1.0.0 test:browser
> playwright test --reporter=list


Running 576 tests using 8 workers

(node:2901797) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:2901778) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:2901815) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:2901793) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:2901826) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:2901834) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:2901841) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:2901804) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ✓    6 [chromium] › test/app-settings.spec.js:35:3 › desktop › the nav shows Settings and the route serves (726ms)
  ✓    4 [chromium] › test/app-new-thread.spec.js:29:1 › one column, full-width controls, no sideways scroll (945ms)
  ✓    5 [chromium] › test/app-accounts.spec.js:87:5 › phone › Accounts groups accounts by provider with each machine's state (1.1s)
  ✓    8 [chromium] › test/app-threads.spec.js:29:5 › phone › the nav stays at the top of a long thread (1.4s)
  ✓    3 [chromium] › test/app-needs.spec.js:14:3 › needs cards › Keep going shows on a lead needs card, not on a system one, and closes it (1.7s)
  ✓    2 [chromium] › test/app-diagrams-uploads.spec.js:15:1 › forms and static sandboxed HTML render without overflow or network (2.3s)
  ✓    9 [chromium] › test/app-settings.spec.js:45:3 › desktop › five sections, kept across a reload through the hash (1.5s)
  ✓   10 [chromium] › test/app-new-thread.spec.js:40:1 › start posts the picked project and opens the thread (1.9s)
  ✓   13 [chromium] › test/app-ui.spec.js:42:3 › thread page layout › desktop: thread list, chat and the files column sit side by side (1.2s)
  ✓    1 [chromium] › test/app-fonts.spec.js:13:1 › Inter and JetBrains Mono load from the app with no CSP violation (446ms)
  ✓    7 [chromium] › test/app-doc.spec.js:52:5 › phone › a live thread: nav, rendered heading, a table, and Back to the thread (3.4s)
  ✓   16 [chromium] › test/app-new-thread.spec.js:51:1 › a refusal shows on the screen and keeps the fields (545ms)
  ✓   17 [chromium] › test/app-ui.spec.js:65:3 › thread page layout › phone: one column, the thread list behind the Threads tab (1.2s)
  ✓   20 [chromium] › test/app-new-thread.spec.js:64:1 › save a directory, pick it, then remove it (939ms)
  ✓   15 [chromium] › test/app-settings.spec.js:61:3 › desktop › editing a table cell saves, and Not used saves null (2.2s)
  ✓   12 [chromium] › test/app-threads.spec.js:42:5 › phone › list: last written-in first (agent activity does not reorder), stubs marked, archived behind a filter (3.2s)
  ✓   22 [chromium] › test/app-new-thread.spec.js:89:1 › an empty list disables Start and points at saving a directory (471ms)
  ✓   24 [chromium] › test/app-threads.spec.js:100:5 › phone › list: ?new=1 goes to the New thread screen (512ms)
  ✓   25 [chromium] › test/app-new-thread.spec.js:96:1 › no default folder: a line linking to Settings (498ms)
  ✓   23 [chromium] › test/app-settings.spec.js:98:3 › desktop › effort selects: GPT tier and both leads save; GPT has no max (1.1s)
  ✓   19 [chromium] › test/app-doc.spec.js:64:5 › phone › links: MAP.md stays in the app, other relative links are text, http opens a new tab (2.4s)
  ✓   21 [chromium] › test/app-ui.spec.js:84:3 › thread page layout › the thread header stays put with Archive in reach after a long chat (1.8s)
  ✓   27 [chromium] › test/app-new-thread.spec.js:110:1 › switching machine disables Start and empties the project list until the answer lands (703ms)
  ✓   18 [chromium] › test/app-views.spec.js:26:5 › phone › features are grouped by status (420ms)
  ✓   32 [chromium] › test/app-views.spec.js:43:5 › phone › the Needs you strip lists open cards with links to them (389ms)
  ✓   11 [chromium] › test/app-accounts.spec.js:111:5 › phone › the Claude sign-in card shows the link and the paste box, and posts the code (5.5s)
  ✓   31 [chromium] › test/app-new-thread.spec.js:134:1 › switching machine empties the saved list until the answer lands (639ms)
  ✓   26 [chromium] › test/app-threads.spec.js:106:5 › phone › list: new thread posts and opens the thread (1.7s)
  ✓   33 [chromium] › test/app-views.spec.js:57:5 › phone › sessions are grouped by machine with attach commands (343ms)
  ✓   28 [chromium] › test/app-settings.spec.js:114:3 › desktop › Escalation: default text, Model first, Highest tier Heavy (1.4s)
  ✓   30 [chromium] › test/app-ui.spec.js:113:3 › thread page layout › the lead's messages and card bodies render Markdown and stay inert (1.1s)
  ✓   37 [chromium] › test/app-views.spec.js:74:5 › phone › the hub gets the plain tmux attach whatever name the installer registered it under (368ms)
  ✓   35 [chromium] › test/app-new-thread.spec.js:153:1 › two saved entries with one path give one option (631ms)
  ✓   34 [chromium] › test/app-accounts.spec.js:132:5 › phone › the Codex sign-in card shows the link and the big code with Copy (795ms)
  ✓   36 [chromium] › test/app-threads.spec.js:125:5 › phone › chat: bubbles, tool line, context lines, hidden worker turn (847ms)
  ✓   41 [chromium] › test/app-new-thread.spec.js:163:1 › a failed Remove shows inside that entry; an Add refusal shows under the Add row (547ms)
  ✓   42 [chromium] › test/app-accounts.spec.js:148:5 › phone › a failed sign-in shows the fallback and an Open terminal link (533ms)
  ✓   43 [chromium] › test/app-threads.spec.js:143:5 › phone › a tool line expands to its input and result, as text (599ms)
  ✓   29 [chromium] › test/app-doc.spec.js:78:5 › phone › an archived thread reads its document from the branch (2.7s)
  ✓   44 [chromium] › test/app-new-thread.spec.js:180:1 › a Save refresh that lands after a machine switch does not take the screen back (774ms)
  ✓   45 [chromium] › test/app-accounts.spec.js:157:5 › phone › a second Claude account warns once, and Cancel saves nothing (827ms)
  ✓   38 [chromium] › test/app-settings.spec.js:136:3 › desktop › creating and saving a template, marking it in use, and the worker-only switch (1.9s)
  ✓   50 [chromium] › test/app-settings.spec.js:188:3 › desktop › a template whose project is gone says so (282ms)
  ✓   48 [chromium] › test/browser.spec.js:159:1 › dragging a single node writes matching integer coordinates to disk (580ms)
  ✓   49 [chromium] › test/app-accounts.spec.js:182:5 › phone › adding a GPT account does not warn (564ms)
  ✓   46 [chromium] › test/app-threads.spec.js:163:5 › phone › an archived thread draws a diagram read from its branch, read-only (1.1s)
  ✓   47 [chromium] › test/app-doc.spec.js:94:5 › phone › errors are a plain message with the back link, never blank (1.0s)
  ✓   52 [chromium] › test/browser.spec.js:197:1 › a freshly laid out graph puts no edge label on top of a node box (310ms)
  ✓   39 [chromium] › test/app-ui.spec.js:157:5 › Threads, Features and Sessions at phone width › /app/features is one column with no sideways scroll (889ms)
  ✓   53 [chromium] › test/app-accounts.spec.js:195:5 › phone › Usage shows bars, the amber line and the account table with reasons (479ms)
  ✓   56 [chromium] › test/browser.spec.js:229:1 › every edge label background is exactly its measured text width plus 14px (274ms)
  ✓   51 [chromium] › test/app-settings.spec.js:197:3 › desktop › the style saves (679ms)
  ✓   59 [chromium] › test/browser.spec.js:258:1 › every edge label on the crowding fixture touches its own line or carries a leader back to it (315ms)
  ✓   58 [chromium] › test/app-accounts.spec.js:214:5 › phone › Usage says no reading yet when there is none (461ms)
  ✓   61 [chromium] › test/browser.spec.js:308:1 › a label with nowhere on its own line to sit is drawn with a leader back to it (228ms)
  ✓   60 [chromium] › test/app-settings.spec.js:215:3 › desktop › preview: disabled with a spinner while pending, then the result; nothing is saved (500ms)
  ✓   57 [chromium] › test/app-ui.spec.js:157:5 › Threads, Features and Sessions at phone width › /app/threads is one column with no sideways scroll (873ms)
  ✓   54 [chromium] › test/app-threads.spec.js:197:5 › phone › an archived diagram opens a child graph from the branch, with a way back, read-only (1.3s)
  ✓   62 [chromium] › test/app-accounts.spec.js:222:5 › phone › balancing saves, and a 400 shows inline (459ms)
  ✓   64 [chromium] › test/app-settings.spec.js:240:3 › desktop › a failed preview shows one plain line under the panel (252ms)
  ✓   14 [chromium] › test/app-diagrams-uploads.spec.js:49:1 › paste uploads bytes, oversize is refused, and image cards respect archive (8.7s)
  ✓   63 [chromium] › test/browser.spec.js:356:1 › dragging a multi-node selection moves every member (682ms)
  ✓   66 [chromium] › test/app-threads.spec.js:238:5 › phone › message box posts and shows queued (608ms)
  ✓   65 [chromium] › test/app-ui.spec.js:157:5 › Threads, Features and Sessions at phone width › /app/sessions is one column with no sideways scroll (922ms)
  ✓   55 [chromium] › test/app-doc.spec.js:111:5 › phone › an archived thread has MAP/IDEA/PLAN links and no #docview panel (2.1s)
  ✓   72 [chromium] › test/app-ui.spec.js:165:3 › Threads, Features and Sessions at phone width › Features: Needs you first, then one column per stage down the page (162ms)
  ✓   68 [chromium] › test/app-settings.spec.js:254:3 › phone › the sections are tabs above the section and the page never scrolls sideways (1.6s)
  ✓   75 [chromium] › test/app-settings.spec.js:275:7 › phone › the nav fits 390px on /app/threads (143ms)
  ✓   76 [chromium] › test/app-settings.spec.js:275:7 › phone › the nav fits 390px on /app/settings (139ms)
  ✓   77 [chromium] › test/app-settings.spec.js:275:7 › phone › the nav fits 390px on /app/new (123ms)
  ✓   67 [chromium] › test/app-accounts.spec.js:239:5 › phone › the lead order editor on Models saves through the balancing route (2.1s)
  ✓   74 [chromium] › test/app-ui.spec.js:184:3 › Features and Sessions at desktop width › Features: projects and machines in the sidebar, Done collapsed to a few (151ms)
  ✓   69 [chromium] › test/app-diagrams-uploads.spec.js:74:1 › attachments stay fixed during upload and are sent in order (2.2s)
  ✓   78 [chromium] › test/app-settings.spec.js:275:7 › phone › the nav fits 360px on /app/threads (152ms)
  ✓   70 [chromium] › test/browser.spec.js:406:1 › a drag interrupted by an agent write mid-gesture loses the drag and keeps the agent write (1.8s)
  ✓   40 [chromium] › test/app-views.spec.js:87:5 › phone › stopped sessions fold under one line and stay open across a refresh (5.9s)
  ✓   80 [chromium] › test/app-ui.spec.js:196:3 › Features and Sessions at desktop width › Sessions: cards by machine with a copyable attach command, unreachable dimmed (189ms)
  ✓   82 [chromium] › test/app-settings.spec.js:275:7 › phone › the nav fits 360px on /app/settings (266ms)
  ✓   79 [chromium] › test/app-accounts.spec.js:254:5 › phone › the new-thread form has no CLI picker (385ms)
  ✓   84 [chromium] › test/app-views.spec.js:113:5 › phone › an unmanaged tmux session is listed read-only, with no terminal link (264ms)
  ✓   86 [chromium] › test/app-settings.spec.js:275:7 › phone › the nav fits 360px on /app/new (186ms)
  ✓   83 [chromium] › test/browser.spec.js:442:1 › approving a reset entry through the page clears was (540ms)
  ✓   73 [chromium] › test/app-doc.spec.js:52:5 › desktop › a live thread: nav, rendered heading, a table, and Back to the thread (2.0s)
  ✓   88 [chromium] › test/app-views.spec.js:123:5 › phone › the New thread screen offers found repositories and earlier projects (294ms)
  ✓   81 [chromium] › test/app-diagrams-uploads.spec.js:101:1 › upload app error shows detail and preserves the draft (756ms)
  ✓   87 [chromium] › test/app-accounts.spec.js:87:5 › desktop › Accounts groups accounts by provider with each machine's state (595ms)
  ✓   92 [chromium] › test/app-views.spec.js:145:5 › phone › an unreachable machine is greyed and has no sessions (256ms)
  ✓   93 [chromium] › test/render.spec.js:79:3 › list page › groups sessions and plans in the given order, with labels, ended marking and token-free links (247ms)
  ✓   85 [chromium] › test/pages.spec.js:226:3 › list and document pages against a real server › a graph opened under a fake tmux session appears under that session, with its harness label and a working link into the graph viewer (298ms)
  ✓   89 [chromium] › test/app-settings.spec.js:296:3 › phone › the Escalation section fits a phone and the effort selects stay usable (667ms)
  ✓   96 [chromium] › test/render.spec.js:119:3 › list page › empty state when nothing is registered (161ms)
  ✓   90 [chromium] › test/browser.spec.js:473:1 › box-select then approve sets agreed on every selected node and implied edge (696ms)
  ✓   97 [chromium] › test/pages.spec.js:246:3 › list and document pages against a real server › sessions group as not in tmux, ended, or running with a quoted attach command (217ms)
  ✓   91 [chromium] › test/app-doc.spec.js:64:5 › desktop › links: MAP.md stays in the app, other relative links are text, http opens a new tab (793ms)
  ✓   99 [chromium] › test/render.spec.js:129:3 › list page › a failed poll shows an error and keeps the last good list (242ms)
  ✓  103 [chromium] › test/render.spec.js:151:3 › list page › a new graph appears after the next poll (174ms)
  ✓   71 [chromium] › test/app-threads.spec.js:250:5 › phone › cards: every kind renders and presses call the press route (3.4s)
  ✓  104 [chromium] › test/render.spec.js:175:3 › list page › no horizontal page scroll at 390px wide (151ms)
  ✓  101 [chromium] › test/pages.spec.js:265:3 › list and document pages against a real server › the registered plan shows slug, repo, stripped status and session, and its document page navigates files and a same-plan link (595ms)
  ✓  106 [chromium] › test/render.spec.js:202:3 › document page › default file order: PLAN.md first (135ms)
  ✓  100 [chromium] › test/browser.spec.js:519:1 › select-all approve on a graph already holding verdicts rules only the unruled, and a lone reversal still works (732ms)
  ✓  107 [chromium] › test/pages.spec.js:294:3 › list and document pages against a real server › the document page response carries the CSP header and renders with no console errors (146ms)
  ✓   95 [chromium] › test/app-views.spec.js:156:5 › phone › the terminal shows the pane and sends typed keys without an extra Enter (1.1s)
  ✓  108 [chromium] › test/render.spec.js:215:3 › document page › default file order: IDEA.md when there is no PLAN.md (163ms)
  ✓   98 [chromium] › test/app-settings.spec.js:315:3 › phone › the Default project folder saves, and a refusal shows under it with the typed value kept (996ms)
  ✓  112 [chromium] › test/render.spec.js:227:3 › document page › default file order: first entry of files when neither PLAN.md nor IDEA.md exists (154ms)
  ✓  102 [chromium] › test/app-doc.spec.js:78:5 › desktop › an archived thread reads its document from the branch (895ms)
  ✓  110 [chromium] › test/pages.spec.js:307:3 › list and document pages against a real server › a wrong token on / and on /docs gives an error, not the page (200ms)
  ✓  113 [chromium] › test/app-settings.spec.js:338:3 › phone › Settings keeps its accessible name on a phone (266ms)
  ✓  114 [chromium] › test/render.spec.js:239:3 › document page › no documents (163ms)
  ✓  111 [chromium] › test/app-views.spec.js:172:5 › phone › a typed semicolon is sent as backslash-semicolon, one argument (446ms)
  ✓  109 [chromium] › test/browser.spec.js:575:1 › select-all reject on a graph already holding verdicts strikes only the unruled (551ms)
  ✓  118 [chromium] › test/render.spec.js:247:3 › document page › a missing file is 404 and shows "not found" (128ms)
  ✓  105 [chromium] › test/app-threads.spec.js:339:5 › phone › approval: Start building enabled when Ready and presses; offer press (887ms)
  ✓  117 [chromium] › test/run.spec.js:89:1 › sockets render named, unnamed and shared, with a long name cut and its full text in a hover title (341ms)
  ✓  121 [chromium] › test/render.spec.js:256:3 › document page › frontmatter renders as a key/value block (193ms)
  ✓  119 [chromium] › test/app-views.spec.js:183:5 › phone › the key row sends Esc, Tab, Ctrl-C and arrows on a small screen (424ms)
  ✓  124 [chromium] › test/render.spec.js:280:3 › document page › every listed Markdown feature renders (218ms)
  ✓  123 [chromium] › test/run.spec.js:128:1 › status tags and needs text render, and a choice box carries no status (290ms)
  ✓  125 [chromium] › test/app-views.spec.js:26:5 › desktop › features are grouped by status (249ms)
  ✓  126 [chromium] › test/render.spec.js:347:3 › document page › a same-plan link resolves relative to its own document and opens in the page (213ms)
  ✓  122 [chromium] › test/app-threads.spec.js:355:5 › phone › approval: Re-check button shows while not Ready (602ms)
  ✓  127 [chromium] › test/run.spec.js:154:1 › a run box always shows its kind tag, with or without a status (291ms)
  ✓  115 [chromium] › test/app-doc.spec.js:94:5 › desktop › errors are a plain message with the back link, never blank (1.1s)
  ✓  129 [chromium] › test/render.spec.js:369:3 › document page › a `..` escape, a javascript: link and raw HTML are all shown as text, nothing executes (187ms)
  ✓  128 [chromium] › test/app-views.spec.js:43:5 › desktop › the Needs you strip lists open cards with links to them (228ms)
  ✓  133 [chromium] › test/render.spec.js:401:3 › document page › a wide table scrolls sideways inside its own box, not the page (187ms)
  ✓  134 [chromium] › test/app-views.spec.js:57:5 › desktop › sessions are grouped by machine with attach commands (224ms)
  ✓  131 [chromium] › test/run.spec.js:191:1 › a loop-back wire is horizontal at both sockets and bows below both boxes' bottoms (294ms)
  ✓  135 [chromium] › test/render.spec.js:424:3 › document page › no horizontal page scroll at 390px wide (151ms)
  ✓  136 [chromium] › test/app-views.spec.js:74:5 › desktop › the hub gets the plain tmux attach whatever name the installer registered it under (215ms)
  ✓  132 [chromium] › test/app-doc.spec.js:111:5 › desktop › an archived thread has MAP/IDEA/PLAN links and no #docview panel (614ms)
  ✓  137 [chromium] › test/run.spec.js:229:1 › clicking a needs-you node shows its full needs text in the detail panel, including one cut on the face (342ms)
  ✓  138 [chromium] › test/touch.spec.js:138:3 › touch pointer gestures › the Select toggle is shown under a touch-capable context (296ms)
  ✓  130 [chromium] › test/app-threads.spec.js:364:5 › phone › idea fold: newest two past three, expandable (1.1s)
  ✓  141 [chromium] › test/touch.spec.js:149:3 › touch pointer gestures › one-finger drag on empty canvas pans the view (278ms)
(node:2913559) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ✓  143 [chromium] › test/touch.spec.js:175:3 › touch pointer gestures › two-finger pinch zooms about the midpoint, clamped to MIN_ZOOM and MAX_ZOOM (304ms)
  ✓  145 [chromium] › test/touch.spec.js:208:3 › touch pointer gestures › a second finger during a box drag switches to pinch, and the box keeps and saves its new position (367ms)
  ✓  146 [chromium] › test/touch.spec.js:248:3 › touch pointer gestures › a pointercancel ends a drag in progress the same way lifting the finger would (309ms)
  ✓   94 [chromium] › test/app-accounts.spec.js:111:5 › desktop › the Claude sign-in card shows the link and the paste box, and posts the code (4.7s)
  ✓  140 [chromium] › test/run.spec.js:262:1 › a container shows its rollup status and needs, and a cut child explains itself in the detail panel (1.6s)
  ✓  147 [chromium] › test/touch.spec.js:274:3 › touch pointer gestures › the Select toggle turns a one-finger drag into a box-select, and a tap adds or removes a node (331ms)
  ✓  150 [chromium] › test/touch.spec.js:314:3 › mouse behaviour is unchanged › the Select toggle is not shown for a plain mouse context (217ms)
  ✓  149 [chromium] › test/run.spec.js:330:1 › the detail panel shows a needs text of more than 700 characters in full, direct and in a container (301ms)
  ✓  148 [chromium] › test/app-accounts.spec.js:132:5 › desktop › the Codex sign-in card shows the link and the big code with Copy (424ms)
  ✓  120 [chromium] › test/browser.spec.js:620:1 › select-all approve issues exactly one PUT /view, and a select-all drag issues exactly one more (3.8s)
  ✓  152 [chromium] › test/run.spec.js:374:1 › the detail panel shows a needs text that is a single 739-character word in full, direct and in a container (320ms)
  ✓  151 [chromium] › test/touch.spec.js:325:3 › mouse behaviour is unchanged › a plain mouse drag on empty canvas still box-selects (358ms)
  ✓  153 [chromium] › test/app-accounts.spec.js:148:5 › desktop › a failed sign-in shows the fallback and an Open terminal link (442ms)
  ✓  156 [chromium] › test/touch.spec.js:356:3 › narrow viewport › no horizontal page scroll at 390px wide, with the controls reachable (265ms)
  ✓  154 [chromium] › test/browser.spec.js:668:1 › shift-clicking an implied edge removes it and it stays removed (397ms)
  ✓  144 [firefox] › test/app-accounts.spec.js:87:5 › phone › Accounts groups accounts by provider with each machine's state (1.8s)
(node:2914925) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ✓  157 [chromium] › test/app-accounts.spec.js:157:5 › desktop › a second Claude account warns once, and Cancel saves nothing (695ms)
  ✓  116 [chromium] › test/pages.spec.js:323:1 › a graph opened while the list page is open appears within one poll, with no reload (5.2s)
  ✓  158 [chromium] › test/browser.spec.js:703:1 › an edge is selectable by label, band and endpoint handle at minimum zoom (847ms)
  ✓  142 [chromium] › test/app-threads.spec.js:383:5 › phone › stub: a dependent stub waits by itself; start now anyway opens the lead (3.3s)
  ✓  161 [chromium] › test/app-accounts.spec.js:182:5 › desktop › adding a GPT account does not warn (513ms)
  ✓  163 [chromium] › test/browser.spec.js:741:1 › hovering a label reveals its edge's endpoint handles (334ms)
  ✓  162 [chromium] › test/pages.spec.js:350:3 › narrow touch viewport › neither the list page nor the document page scrolls sideways at 390px (653ms)
  ✓  166 [chromium] › test/browser.spec.js:766:1 › two edges between one pair of nodes in opposite directions are independently selectable (295ms)
  ✓  165 [chromium] › test/app-accounts.spec.js:195:5 › desktop › Usage shows bars, the amber line and the account table with reasons (469ms)
  ✓  167 [chromium] › test/pages.spec.js:422:3 › remember-me: the first visit and after › opening the ?token= URL lands on /wheelchair/ with no token in page.url() (82ms)
  ✓  169 [chromium] › test/app-accounts.spec.js:214:5 › desktop › Usage says no reading yet when there is none (367ms)
  ✓  168 [chromium] › test/browser.spec.js:793:1 › selecting an item expands ref, note, and an edge payload with its inferred state (448ms)
  ✓  170 [chromium] › test/pages.spec.js:429:3 › remember-me: the first visit and after › reloading /wheelchair/ in the same context shows the list (153ms)
  ✓  164 [chromium] › test/app-threads.spec.js:407:5 › phone › dead lead offers Restart; archive asks to confirm (1.1s)
  ✓  173 [chromium] › test/pages.spec.js:437:3 › remember-me: the first visit and after › a fresh context opening /wheelchair/ gets the sign-in page (both sentences visible) (120ms)
  ✓  172 [chromium] › test/browser.spec.js:834:1 › a label the box truncates is readable in full on hover and in the detail panel (440ms)
  ✓  171 [chromium] › test/app-accounts.spec.js:222:5 › desktop › balancing saves, and a 400 shows inline (575ms)
  ✓  155 [chromium] › test/run.spec.js:416:1 › the title prefix appears and clears across polls (2.9s)
  ✓  176 [chromium] › test/browser.spec.js:881:1 › a label needing all five lines draws five lines, with no ellipsis and no tooltip (268ms)
  ✓  175 [chromium] › test/pages.spec.js:446:3 › remember-me: the first visit and after › from the list, a graph and a plan document open, and a drag saves, with no token in any request URL (557ms)
  ✓  174 [chromium] › test/app-threads.spec.js:426:5 › phone › cards sit between chat items by time and carry a linkable id (640ms)
  ✓  180 [chromium] › test/pages.spec.js:496:3 › remember-me: the first visit and after › an old root bookmark /?token=… ends on /wheelchair/ with the cookie set (80ms)
  ✓  179 [chromium] › test/browser.spec.js:917:1 › a five-line box stays shorter than the server's row pitch (273ms)
  ✓  139 [chromium] › test/app-views.spec.js:87:5 › desktop › stopped sessions fold under one line and stay open across a refresh (5.8s)
  ✓  177 [chromium] › test/app-accounts.spec.js:239:5 › desktop › the lead order editor on Models saves through the balancing route (593ms)
  ✓  183 [chromium] › test/app-views.spec.js:113:5 › desktop › an unmanaged tmux session is listed read-only, with no terminal link (183ms)
(node:2916514) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ✓  185 [chromium] › test/app-views.spec.js:123:5 › desktop › the New thread screen offers found repositories and earlier projects (243ms)
  ✓  184 [chromium] › test/app-accounts.spec.js:254:5 › desktop › the new-thread form has no CLI picker (338ms)
  ✓  187 [chromium] › test/app-views.spec.js:145:5 › desktop › an unreachable machine is greyed and has no sessions (144ms)
  ✓  160 [firefox] › test/app-diagrams-uploads.spec.js:15:1 › forms and static sandboxed HTML render without overflow or network (2.7s)
  ✓  188 [chromium] › test/app-accounts.spec.js:267:3 › accounts interface paths › the reported Codex plan shows beside the chosen plan only when they differ (325ms)
  ✓  182 [chromium] › test/browser.spec.js:958:1 › no gesture or control adds, renames or connects anything (1.0s)
  ✓  191 [chromium] › test/app-accounts.spec.js:282:3 › accounts interface paths › the sign-in card gives up after 30 seconds without a link (527ms)
  ✓  192 [chromium] › test/browser.spec.js:1010:1 › a page write through the browser carries an Origin the server accepts (370ms)
  ✓  189 [chromium] › test/app-views.spec.js:156:5 › desktop › the terminal shows the pane and sends typed keys without an extra Enter (1.0s)
  ✓  181 [chromium] › test/app-threads.spec.js:444:5 › phone › plan links use the slug the API returns, not a diagram card plan (2.1s)
  ✓  193 [chromium] › test/app-accounts.spec.js:297:3 › accounts interface paths › Rename sends the new name and the card shows it (636ms)
  ✓  194 [chromium] › test/browser.spec.js:1043:1 › a 409 mid-approve is survived by re-reading and re-applying the verdict (579ms)
  ✓  195 [chromium] › test/app-views.spec.js:172:5 › desktop › a typed semicolon is sent as backslash-semicolon, one argument (377ms)
  -  199 [chromium] › test/app-views.spec.js:183:5 › desktop › the key row sends Esc, Tab, Ctrl-C and arrows on a small screen
  ✓  159 [firefox] › test/app-accounts.spec.js:111:5 › phone › the Claude sign-in card shows the link and the paste box, and posts the code (5.1s)
  ✓  196 [chromium] › test/app-threads.spec.js:455:5 › phone › S1: a thread created with a message is titled from it in the list (582ms)
(node:2917478) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ✓  198 [chromium] › test/browser.spec.js:1086:1 › the browser suite never touches the live default cache root (728ms)
  ✓  197 [chromium] › test/app-accounts.spec.js:309:3 › accounts interface paths › Change plan sends the plan and the weight override (787ms)
  ✓  178 [chromium] › test/run.spec.js:447:1 › exactly one notification per node newly needs-you, including two nodes sharing an id in different files (3.4s)
  ✓  201 [chromium] › test/app-threads.spec.js:469:5 › phone › S2: a question with doc links to the in-app page; one without has no link (630ms)
  ✓  203 [chromium] › test/browser.spec.js:1128:1 › the explanation panel renders expanded when a graph opens, showing the explanation text (327ms)
  ✓  200 [firefox] › test/app-accounts.spec.js:132:5 › phone › the Codex sign-in card shows the link and the big code with Copy (955ms)
  ✓  204 [chromium] › test/app-accounts.spec.js:328:3 › accounts interface paths › Remove asks first, then deletes; default accounts have no Remove (747ms)
  ✓  207 [chromium] › test/browser.spec.js:1145:1 › the panel collapses and expands on click, and the canvas is fully usable in both states (633ms)
  ✓  208 [firefox] › test/app-accounts.spec.js:148:5 › phone › a failed sign-in shows the fallback and an Open terminal link (748ms)
  ✓  190 [firefox] › test/app-diagrams-uploads.spec.js:49:1 › paste uploads bytes, oversize is refused, and image cards respect archive (3.3s)
  ✓  205 [chromium] › test/run.spec.js:498:1 › a child file's status change redraws the open root without the root file changing (1.6s)
  ✓  210 [chromium] › test/browser.spec.js:1192:1 › a node panned into the topmost strip of the canvas is clickable and draggable with the panel expanded (828ms)
  ✓  186 [firefox] › test/app-doc.spec.js:52:5 › phone › a live thread: nav, rendered heading, a table, and Back to the thread (3.7s)
  ✓  213 [chromium] › test/run.spec.js:537:1 › the list page shows a run picture link for a plan with a run, and none for one without (225ms)
  ✓  214 [chromium] › test/browser.spec.js:1249:1 › a graph with a null explanation renders no panel at all (473ms)
  ✓  211 [firefox] › test/app-accounts.spec.js:157:5 › phone › a second Claude account warns once, and Cancel saves nothing (1.2s)
  ✓  209 [chromium] › test/app-accounts.spec.js:345:3 › accounts interface paths › usage refreshes every 30 seconds on Accounts and Usage, and stops elsewhere (1.7s)
  ✓  217 [chromium] › test/browser.spec.js:1268:1 › a long explanation scrolls inside a bounded panel without changing the canvas height (382ms)
  ✓  215 [firefox] › test/app-doc.spec.js:64:5 › phone › links: MAP.md stays in the app, other relative links are text, http opens a new tab (851ms)
  ✓  219 [chromium] › test/app-accounts.spec.js:375:3 › nav dot › shows while usage is short and clears after opening Usage (521ms)
  ✓  220 [chromium] › test/browser.spec.js:1305:1 › the error banner stays visible and legible with the panel expanded (435ms)
  ✓  206 [chromium] › test/app-threads.spec.js:481:5 › phone › S2: the link appears when the slug becomes known, without a reload (2.8s)
  ✓  218 [firefox] › test/app-accounts.spec.js:182:5 › phone › adding a GPT account does not warn (1.0s)
  ✓  222 [chromium] › test/app-accounts.spec.js:393:3 › lead waiting line › a waiting lead shows when the provider refills (544ms)
  ✓  202 [firefox] › test/app-fonts.spec.js:13:1 › Inter and JetBrains Mono load from the app with no CSP violation (1.5s)
  ✓  212 [firefox] › test/app-diagrams-uploads.spec.js:74:1 › attachments stay fixed during upload and are sent in order (2.5s)
  ✓  226 [chromium] › test/app-accounts.spec.js:401:3 › lead waiting line › a waiting lead pinned to a provider names it when the lead has none (611ms)
  ✓  216 [chromium] › test/run.spec.js:575:1 › on a reserved-name path a removed file shows the fatal screen, and its reappearance clears it (2.3s)
  ✓  225 [firefox] › test/app-accounts.spec.js:195:5 › phone › Usage shows bars, the amber line and the account table with reasons (1.1s)
  ✓  229 [chromium] › test/app-accounts.spec.js:408:3 › lead waiting line › a waiting lead with no provider anywhere says it is waiting for room (564ms)
  ✓  227 [firefox] › test/app-needs.spec.js:14:3 › needs cards › Keep going shows on a lead needs card, not on a system one, and closes it (1.2s)
  ✓  228 [firefox] › test/app-diagrams-uploads.spec.js:101:1 › upload app error shows detail and preserves the draft (1.2s)
  ✓  231 [firefox] › test/app-accounts.spec.js:214:5 › phone › Usage says no reading yet when there is none (715ms)
  ✓  223 [chromium] › test/browser.spec.js:1337:1 › the fatal overlay still covers the canvas with the panel expanded (2.2s)
  ✓  224 [chromium] › test/app-threads.spec.js:492:5 › phone › S4: pressing an option says what was picked and marks it (2.2s)
  ✓  232 [chromium] › test/app-accounts.spec.js:416:3 › lead waiting line › a limited running lead names the account (546ms)
  ✓  221 [firefox] › test/app-doc.spec.js:78:5 › phone › an archived thread reads its document from the branch (2.7s)
  ✓  233 [firefox] › test/app-new-thread.spec.js:29:1 › one column, full-width controls, no sideways scroll (776ms)
  ✓  234 [firefox] › test/app-settings.spec.js:35:3 › desktop › the nav shows Settings and the route serves (687ms)
  ✓  237 [chromium] › test/app-threads.spec.js:507:5 › phone › S4: an answer in his own words is sent, closes the card and is shown (831ms)
  ✓  238 [chromium] › test/app-accounts.spec.js:423:3 › lead waiting line › hidden when the lead is fine or the limit has passed (888ms)
  ✓  230 [chromium] › test/run.spec.js:594:1 › a reserved-name file that no longer validates shows the fatal screen with its error (2.2s)
  ✓  235 [firefox] › test/app-accounts.spec.js:222:5 › phone › balancing saves, and a 400 shows inline (1.3s)
  ✓  243 [chromium] › test/app-accounts.spec.js:437:3 › terminal login mode › reads the login pane and sends keys to the login route (545ms)
(node:2921500) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ✓  241 [firefox] › test/app-settings.spec.js:45:3 › desktop › five sections, kept across a reload through the hash (1.4s)
  ✓  236 [chromium] › test/browser.spec.js:1365:1 › collapse state survives a poll and a child-graph navigation, but not a reload (2.0s)
(node:2921687) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ✓  239 [firefox] › test/app-doc.spec.js:94:5 › phone › errors are a plain message with the back link, never blank (2.0s)
  ✓  247 [chromium] › test/browser.spec.js:1419:1 › hovering a marked phrase lights the group and dims everything outside it, leaving approve disabled (394ms)
  ✓  250 [chromium] › test/browser.spec.js:1458:1 › hovering a marked phrase does not rebuild the panel (351ms)
  ✓  248 [firefox] › test/app-doc.spec.js:111:5 › phone › an archived thread has MAP/IDEA/PLAN links and no #docview panel (904ms)
  ✓  251 [chromium] › test/browser.spec.js:1488:1 › clicking a marked phrase selects exactly the group, approves it, and leaves an already-ruled member untouched (429ms)
  ✓  240 [firefox] › test/app-new-thread.spec.js:40:1 › start posts the picked project and opens the thread (3.0s)
  ✓  242 [chromium] › test/app-threads.spec.js:524:5 › phone › S4: a redraw while typing keeps the draft, focus and caret (2.8s)
  ✓  245 [firefox] › test/app-settings.spec.js:61:3 › desktop › editing a table cell saves, and Not used saves null (2.3s)
  ✓  253 [chromium] › test/browser.spec.js:1552:1 › clicking a visible group whose header would clear the canvas by only a little brings the header fully into view (1.1s)
  ✓  244 [firefox] › test/app-accounts.spec.js:239:5 › phone › the lead order editor on Models saves through the balancing route (3.1s)
  ✓  254 [firefox] › test/app-new-thread.spec.js:51:1 › a refusal shows on the screen and keeps the fields (1.1s)
  ✓  257 [chromium] › test/browser.spec.js:1596:1 › a graph too tall for the window opens anchored at its top edge, not clipping a group header there (374ms)
  ✓  246 [firefox] › test/app-threads.spec.js:29:5 › phone › the nav stays at the top of a long thread (2.3s)
  ✓  260 [chromium] › test/browser.spec.js:1628:1 › a graph that fits the window on both axes opens centred, not anchored (362ms)
  ✓  258 [firefox] › test/app-accounts.spec.js:254:5 › phone › the new-thread form has no CLI picker (938ms)
  ✓  262 [chromium] › test/browser.spec.js:1673:1 › a graph too wide for the window opens anchored at its left edge, centred top to bottom (413ms)
  ✓  256 [firefox] › test/app-settings.spec.js:98:3 › desktop › effort selects: GPT tier and both leads save; GPT has no max (1.3s)
  ✓  249 [firefox] › test/app-ui.spec.js:42:3 › thread page layout › desktop: thread list, chat and the files column sit side by side (2.6s)
  ✓  259 [firefox] › test/app-new-thread.spec.js:64:1 › save a directory, pick it, then remove it (1.3s)
  ✓  264 [chromium] › test/browser.spec.js:1720:1 › a graph too big for the window on both axes opens anchored at its top-left corner (284ms)
  ✓  255 [chromium] › test/app-threads.spec.js:539:5 › phone › S4: an answered card with no stored value keeps the generic tag; an unmatched value is shown bare (2.2s)
  ✓  252 [firefox] › test/app-doc.spec.js:52:5 › desktop › a live thread: nav, rendered heading, a table, and Back to the thread (2.8s)
  ✓  263 [firefox] › test/app-accounts.spec.js:87:5 › desktop › Accounts groups accounts by provider with each machine's state (972ms)
  ✓  267 [firefox] › test/app-new-thread.spec.js:89:1 › an empty list disables Start and points at saving a directory (1.0s)
  ✓  269 [chromium] › test/app-threads.spec.js:554:5 › phone › S4: a question the lead resolved shows Answered in chat and the note, dimmed (945ms)
  ✓  268 [chromium] › test/browser.spec.js:1764:1 › clicking a group with a member off-screen brings it into view without changing zoom (1.3s)
  ✓  265 [firefox] › test/app-settings.spec.js:114:3 › desktop › Escalation: default text, Model first, Highest tier Heavy (1.8s)
  ✓  270 [firefox] › test/app-doc.spec.js:64:5 › desktop › links: MAP.md stays in the app, other relative links are text, http opens a new tab (1.5s)
  ✓  266 [firefox] › test/app-ui.spec.js:65:3 › thread page layout › phone: one column, the thread list behind the Threads tab (1.9s)
  ✓  272 [firefox] › test/app-new-thread.spec.js:96:1 › no default folder: a line linking to Settings (975ms)
  ✓  273 [chromium] › test/app-threads.spec.js:567:5 › phone › S5: the offer has two buttons; Keep talking first presses its value and says so (953ms)
  ✓  261 [firefox] › test/app-threads.spec.js:42:5 › phone › list: last written-in first (agent activity does not reorder), stubs marked, archived behind a filter (3.4s)
  ✓  280 [firefox] › test/app-threads.spec.js:100:5 › phone › list: ?new=1 goes to the New thread screen (766ms)
  ✓  277 [firefox] › test/app-ui.spec.js:84:3 › thread page layout › the thread header stays put with Archive in reach after a long chat (1.9s)
  ✓  274 [chromium] › test/browser.spec.js:1803:1 › a redraw that changes a group's nodes while the explanation stays byte-identical relights and rules the new membership (2.6s)
  ✓  283 [chromium] › test/browser.spec.js:1856:1 › the page renders a non-# markdown link as plain text, not a marked phrase (249ms)
  ✓  279 [chromium] › test/app-threads.spec.js:583:5 › phone › S4: a pressed offer marks Take it into planning (2.2s)
  ✓  284 [chromium] › test/browser.spec.js:1898:1 › a visible group's boundary sits GROUP_PAD + GROUP_HEADER above its topmost member, in the direction both files must agree on (310ms)
  ✓  282 [firefox] › test/app-ui.spec.js:113:3 › thread page layout › the lead's messages and card bodies render Markdown and stay inert (919ms)
  ✓  276 [firefox] › test/app-doc.spec.js:78:5 › desktop › an archived thread reads its document from the branch (2.9s)
  ✓  278 [firefox] › test/app-new-thread.spec.js:110:1 › switching machine disables Start and empties the project list until the answer lands (2.6s)
  ✓  286 [chromium] › test/browser.spec.js:1947:1 › a group name and note too long for the box are cut, and the header tooltip carries both in full (250ms)
  ✓  290 [chromium] › test/browser.spec.js:1992:1 › the header hit rect is invisible and sized to its text, not the full box (342ms)
  ✓  285 [chromium] › test/app-threads.spec.js:593:5 › phone › pinned cards stay under the header in a long thread and fold to one line (791ms)
  ✓  291 [chromium] › test/browser.spec.js:2011:1 › clicking a group header selects exactly its members and enables approve (312ms)
  ✓  281 [firefox] › test/app-threads.spec.js:106:5 › phone › list: new thread posts and opens the thread (2.6s)
  ✓  275 [firefox] › test/app-settings.spec.js:136:3 › desktop › creating and saving a template, marking it in use, and the worker-only switch (4.2s)
  ✓  293 [chromium] › test/browser.spec.js:2035:1 › pressing a group header and releasing away from it still selects the group (463ms)
  ✓  271 [firefox] › test/app-accounts.spec.js:111:5 › desktop › the Claude sign-in card shows the link and the paste box, and posts the code (5.6s)
  ✓  288 [firefox] › test/app-doc.spec.js:94:5 › desktop › errors are a plain message with the back link, never blank (1.5s)
  ✓  296 [chromium] › test/browser.spec.js:2062:1 › a marquee started on empty canvas inside a group boundary still box-selects (436ms)
  ✓  295 [firefox] › test/app-settings.spec.js:188:3 › desktop › a template whose project is gone says so (737ms)
  ✓  299 [chromium] › test/browser.spec.js:2099:1 › every group boundary precedes every node, edge and label, and every header follows every edge and precedes every label, in document order (249ms)
  ✓  294 [firefox] › test/app-threads.spec.js:125:5 › phone › chat: bubbles, tool line, context lines, hidden worker turn (1.0s)
  ✓  289 [firefox] › test/app-new-thread.spec.js:134:1 › switching machine empties the saved list until the answer lands (2.3s)
  ✓  301 [chromium] › test/browser.spec.js:2147:1 › an edge label that would land on a group's header is displaced clear of it (330ms)
  ✓  297 [firefox] › test/app-accounts.spec.js:132:5 › desktop › the Codex sign-in card shows the link and the big code with Copy (992ms)
  ✓  292 [chromium] › test/app-threads.spec.js:622:5 › phone › plan document links open the in-app document page (2.1s)
  ✓  304 [chromium] › test/browser.spec.js:2172:1 › hovering a group header dims nothing, and lifts the boundary stroke until the pointer leaves (366ms)
  ✓  287 [firefox] › test/app-ui.spec.js:157:5 › Threads, Features and Sessions at phone width › /app/features is one column with no sideways scroll (1.3s)
  ✓  303 [firefox] › test/app-new-thread.spec.js:153:1 › two saved entries with one path give one option (901ms)
  ✓  307 [chromium] › test/browser.spec.js:2200:1 › hovering a marked phrase dims every other visible group, leaving its own boundary and header plain (544ms)
  ✓  300 [firefox] › test/app-settings.spec.js:197:3 › desktop › the style saves (1.3s)
  ✓  306 [chromium] › test/app-threads.spec.js:29:5 › desktop › the nav stays at the top of a long thread (756ms)
  ✓  302 [firefox] › test/app-threads.spec.js:143:5 › phone › a tool line expands to its input and result, as text (1.2s)
  ✓  310 [chromium] › test/browser.spec.js:2244:1 › measureLabelWidth is keyed on size, not just text (262ms)
  ✓  314 [chromium] › test/browser.spec.js:2310:1 › a forward arrow's endpoints sit ANCHOR_CLEAR outside the source's bottom edge and the target's top edge (242ms)
  ✓  315 [chromium] › test/browser.spec.js:2337:1 › a back edge between two horizontally separated boxes uses the side faces (220ms)
  ✓  309 [firefox] › test/app-new-thread.spec.js:163:1 › a failed Remove shows inside that entry; an Add refusal shows under the Add row (906ms)
  ✓  311 [firefox] › test/app-settings.spec.js:215:3 › desktop › preview: disabled with a spinner while pending, then the result; nothing is saved (907ms)
  ✓  308 [firefox] › test/app-ui.spec.js:157:5 › Threads, Features and Sessions at phone width › /app/threads is one column with no sideways scroll (1.3s)
  ✓  316 [chromium] › test/browser.spec.js:2366:1 › a back edge between two boxes whose x-ranges overlap uses top-to-bottom instead, because the sides would cross a box (230ms)

  ✓  298 [firefox] › test/app-doc.spec.js:111:5 › desktop › an archived thread has MAP/IDEA/PLAN links and no #docview panel (2.9s)
  ✘  320 [chromium] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph (277ms)
  ✓  313 [firefox] › test/app-threads.spec.js:163:5 › phone › an archived thread draws a diagram read from its branch, read-only (1.4s)
  ✓  318 [firefox] › test/app-settings.spec.js:240:3 › desktop › a failed preview shows one plain line under the panel (600ms)
  ✓  305 [firefox] › test/app-accounts.spec.js:148:5 › desktop › a failed sign-in shows the fallback and an Open terminal link (2.5s)
(node:2929341) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ✓  317 [firefox] › test/app-new-thread.spec.js:180:1 › a Save refresh that lands after a machine switch does not take the screen back (1.1s)
  ✓  312 [chromium] › test/app-threads.spec.js:42:5 › desktop › list: last written-in first (agent activity does not reorder), stubs marked, archived behind a filter (2.1s)
  ✓  319 [firefox] › test/app-ui.spec.js:157:5 › Threads, Features and Sessions at phone width › /app/sessions is one column with no sideways scroll (1.3s)
  ✓  325 [chromium] › test/browser.spec.js:2463:1 › a departure slotted toward its own box is rerouted to the centre-to-centre fallback instead of crossing it (441ms)
  ✓  327 [chromium] › test/app-threads.spec.js:100:5 › desktop › list: ?new=1 goes to the New thread screen (452ms)
  ✓  329 [chromium] › test/browser.spec.js:2510:1 › two arrows sharing a from and to land on adjacent, distinct slots at both ends (359ms)
  ✓  331 [chromium] › test/browser.spec.js:2543:1 › two arrows between boxes whose rectangles overlap land on distinct slots, with no perpendicular fan (273ms)
  ✓  326 [firefox] › test/browser.spec.js:159:1 › dragging a single node writes matching integer coordinates to disk (1.1s)
  ✓  324 [firefox] › test/app-accounts.spec.js:157:5 › desktop › a second Claude account warns once, and Cancel saves nothing (1.5s)
  ✓  322 [firefox] › test/app-threads.spec.js:197:5 › phone › an archived diagram opens a child graph from the branch, with a way back, read-only (1.8s)
  ✓  332 [chromium] › test/browser.spec.js:2576:1 › a same-row arrow and an upward arrow both use side faces (251ms)
  ✓  323 [firefox] › test/app-settings.spec.js:254:3 › phone › the sections are tabs above the section and the page never scrolls sideways (2.2s)
  ✓  336 [chromium] › test/browser.spec.js:2605:1 › a bundle of three arrows on one face gets three distinct anchors at the right pitch, in the right order (316ms)
  ✓  321 [firefox] › test/app-views.spec.js:26:5 › phone › features are grouped by status (794ms)
  ✓  333 [firefox] › test/browser.spec.js:197:1 › a freshly laid out graph puts no edge label on top of a node box (657ms)
  ✓  338 [chromium] › test/browser.spec.js:2642:1 › a vertically stacked reciprocal pair is drawn on two separate, non-collinear geometries (229ms)
  ✓  337 [firefox] › test/app-settings.spec.js:275:7 › phone › the nav fits 390px on /app/threads (644ms)
  ✓  334 [firefox] › test/app-accounts.spec.js:182:5 › desktop › adding a GPT account does not warn (1.1s)
  ✓  339 [firefox] › test/app-views.spec.js:43:5 › phone › the Needs you strip lists open cards with links to them (562ms)
  ✓  335 [firefox] › test/app-threads.spec.js:238:5 › phone › message box posts and shows queued (1.1s)
  ✓  340 [firefox] › test/browser.spec.js:229:1 › every edge label background is exactly its measured text width plus 14px (573ms)
(node:2930649) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ✓  328 [firefox] › test/app-ui.spec.js:165:3 › Threads, Features and Sessions at phone width › Features: Needs you first, then one column per stage down the page (829ms)
  ✓  341 [firefox] › test/app-settings.spec.js:275:7 › phone › the nav fits 390px on /app/settings (558ms)
  ✓  343 [firefox] › test/app-views.spec.js:57:5 › phone › sessions are grouped by machine with attach commands (530ms)
  ✓  345 [firefox] › test/browser.spec.js:258:1 › every edge label on the crowding fixture touches its own line or carries a leader back to it (552ms)
  ✓  330 [chromium] › test/app-threads.spec.js:106:5 › desktop › list: new thread posts and opens the thread (2.4s)
  ✓  342 [firefox] › test/app-accounts.spec.js:195:5 › desktop › Usage shows bars, the amber line and the account table with reasons (880ms)
  ✓  349 [firefox] › test/app-views.spec.js:74:5 › phone › the hub gets the plain tmux attach whatever name the installer registered it under (580ms)
  ✓  348 [firefox] › test/app-settings.spec.js:275:7 › phone › the nav fits 390px on /app/new (631ms)
  ✓  350 [firefox] › test/browser.spec.js:308:1 › a label with nowhere on its own line to sit is drawn with a leader back to it (627ms)
  ✓  351 [chromium] › test/app-threads.spec.js:125:5 › desktop › chat: bubbles, tool line, context lines, hidden worker turn (721ms)
  ✓  354 [firefox] › test/app-settings.spec.js:275:7 › phone › the nav fits 360px on /app/threads (683ms)
  ✓  356 [chromium] › test/app-threads.spec.js:143:5 › desktop › a tool line expands to its input and result, as text (630ms)
  ✓  355 [firefox] › test/browser.spec.js:356:1 › dragging a multi-node selection moves every member (1.2s)
  ✓  346 [firefox] › test/app-ui.spec.js:184:3 › Features and Sessions at desktop width › Features: projects and machines in the sidebar, Done collapsed to a few (602ms)
  ✓  347 [firefox] › test/pages.spec.js:226:3 › list and document pages against a real server › a graph opened under a fake tmux session appears under that session, with its harness label and a working link into the graph viewer (1.7s)
  ✓  352 [firefox] › test/app-accounts.spec.js:214:5 › desktop › Usage says no reading yet when there is none (2.3s)
  ✓  358 [chromium] › test/app-threads.spec.js:163:5 › desktop › an archived thread draws a diagram read from its branch, read-only (1.1s)
  ✓  361 [firefox] › test/pages.spec.js:246:3 › list and document pages against a real server › sessions group as not in tmux, ended, or running with a quoted attach command (566ms)
  ✓  360 [firefox] › test/app-ui.spec.js:196:3 › Features and Sessions at desktop width › Sessions: cards by machine with a copyable attach command, unreachable dimmed (1.5s)
  ✓  357 [firefox] › test/app-settings.spec.js:275:7 › phone › the nav fits 360px on /app/settings (2.3s)
  ✓  363 [chromium] › test/app-threads.spec.js:197:5 › desktop › an archived diagram opens a child graph from the branch, with a way back, read-only (1.1s)
  ✓  344 [firefox] › test/app-threads.spec.js:250:5 › phone › cards: every kind renders and presses call the press route (4.6s)
  ✓  365 [firefox] › test/render.spec.js:79:3 › list page › groups sessions and plans in the given order, with labels, ended marking and token-free links (493ms)
  ✓  366 [firefox] › test/app-settings.spec.js:275:7 › phone › the nav fits 360px on /app/new (548ms)
  ✓  364 [firefox] › test/pages.spec.js:265:3 › list and document pages against a real server › the registered plan shows slug, repo, stripped status and session, and its document page navigates files and a same-plan link (1.1s)
  ✓  367 [chromium] › test/app-threads.spec.js:238:5 › desktop › message box posts and shows queued (588ms)
  ✓  369 [firefox] › test/render.spec.js:119:3 › list page › empty state when nothing is registered (388ms)
  ✓  371 [firefox] › test/pages.spec.js:294:3 › list and document pages against a real server › the document page response carries the CSP header and renders with no console errors (386ms)
  ✓  373 [firefox] › test/render.spec.js:129:3 › list page › a failed poll shows an error and keeps the last good list (508ms)
  ✓  370 [firefox] › test/app-settings.spec.js:296:3 › phone › the Escalation section fits a phone and the effort selects stay usable (928ms)
  ✓  374 [firefox] › test/pages.spec.js:307:3 › list and document pages against a real server › a wrong token on / and on /docs gives an error, not the page (487ms)
  ✓  368 [firefox] › test/app-threads.spec.js:339:5 › phone › approval: Start building enabled when Ready and presses; offer press (1.1s)
  ✓  362 [firefox] › test/app-accounts.spec.js:222:5 › desktop › balancing saves, and a 400 shows inline (2.6s)
  ✓  375 [firefox] › test/render.spec.js:151:3 › list page › a new graph appears after the next poll (376ms)
  ✓  359 [firefox] › test/browser.spec.js:406:1 › a drag interrupted by an agent write mid-gesture loses the drag and keeps the agent write (3.9s)
  ✓  380 [firefox] › test/render.spec.js:175:3 › list page › no horizontal page scroll at 390px wide (403ms)
  ✓  382 [firefox] › test/render.spec.js:202:3 › document page › default file order: PLAN.md first (356ms)
  ✓  379 [firefox] › test/app-accounts.spec.js:239:5 › desktop › the lead order editor on Models saves through the balancing route (950ms)
  ✓  376 [firefox] › test/app-settings.spec.js:315:3 › phone › the Default project folder saves, and a refusal shows under it with the typed value kept (1.2s)
  ✓  383 [firefox] › test/render.spec.js:215:3 › document page › default file order: IDEA.md when there is no PLAN.md (299ms)
  ✓  381 [firefox] › test/browser.spec.js:442:1 › approving a reset entry through the page clears was (711ms)
  ✓  384 [firefox] › test/app-accounts.spec.js:254:5 › desktop › the new-thread form has no CLI picker (525ms)
  ✓  385 [firefox] › test/app-settings.spec.js:338:3 › phone › Settings keeps its accessible name on a phone (463ms)
  ✓  386 [firefox] › test/render.spec.js:227:3 › document page › default file order: first entry of files when neither PLAN.md nor IDEA.md exists (335ms)
  ✓  353 [firefox] › test/app-views.spec.js:87:5 › phone › stopped sessions fold under one line and stay open across a refresh (6.2s)
  ✓  390 [firefox] › test/render.spec.js:239:3 › document page › no documents (362ms)
  ✓  387 [firefox] › test/browser.spec.js:473:1 › box-select then approve sets agreed on every selected node and implied edge (810ms)
  ✓  391 [firefox] › test/app-views.spec.js:113:5 › phone › an unmanaged tmux session is listed read-only, with no terminal link (513ms)
  ✓  388 [firefox] › test/app-accounts.spec.js:267:3 › accounts interface paths › the reported Codex plan shows beside the chosen plan only when they differ (639ms)
  ✓  389 [firefox] › test/run.spec.js:89:1 › sockets render named, unnamed and shared, with a long name cut and its full text in a hover title (585ms)
  ✓  378 [firefox] › test/app-threads.spec.js:355:5 › phone › approval: Re-check button shows while not Ready (2.3s)
  ✓  394 [firefox] › test/app-views.spec.js:123:5 › phone › the New thread screen offers found repositories and earlier projects (724ms)
  ✓  396 [firefox] › test/run.spec.js:128:1 › status tags and needs text render, and a choice box carries no status (698ms)
  ✓  395 [firefox] › test/app-accounts.spec.js:282:3 › accounts interface paths › the sign-in card gives up after 30 seconds without a link (956ms)
  ✓  393 [firefox] › test/browser.spec.js:519:1 › select-all approve on a graph already holding verdicts rules only the unruled, and a lone reversal still works (1.1s)
  ✓  398 [firefox] › test/app-views.spec.js:145:5 › phone › an unreachable machine is greyed and has no sessions (491ms)
  ✓  399 [firefox] › test/run.spec.js:154:1 › a run box always shows its kind tag, with or without a status (520ms)
  ✓  401 [firefox] › test/browser.spec.js:575:1 › select-all reject on a graph already holding verdicts strikes only the unruled (729ms)
  ✓  403 [firefox] › test/run.spec.js:191:1 › a loop-back wire is horizontal at both sockets and bows below both boxes' bottoms (540ms)
  ✓  400 [firefox] › test/app-accounts.spec.js:297:3 › accounts interface paths › Rename sends the new name and the card shows it (858ms)
  ✓  392 [firefox] › test/render.spec.js:247:3 › document page › a missing file is 404 and shows "not found" (2.2s)
  ✓  372 [chromium] › test/app-threads.spec.js:250:5 › desktop › cards: every kind renders and presses call the press route (5.2s)
  ✓  405 [firefox] › test/run.spec.js:229:1 › clicking a needs-you node shows its full needs text in the detail panel, including one cut on the face (498ms)
  ✓  407 [firefox] › test/render.spec.js:256:3 › document page › frontmatter renders as a key/value block (476ms)
  ✓  402 [firefox] › test/app-views.spec.js:156:5 › phone › the terminal shows the pane and sends typed keys without an extra Enter (1.4s)
  ✓  406 [firefox] › test/app-accounts.spec.js:309:3 › accounts interface paths › Change plan sends the plan and the weight override (1.0s)
  ✓  410 [firefox] › test/render.spec.js:280:3 › document page › every listed Markdown feature renders (466ms)
  ✓  397 [firefox] › test/app-threads.spec.js:364:5 › phone › idea fold: newest two past three, expandable (2.9s)
  ✓  413 [firefox] › test/render.spec.js:347:3 › document page › a same-plan link resolves relative to its own document and opens in the page (489ms)
  ✓  377 [firefox] › test/pages.spec.js:323:1 › a graph opened while the list page is open appears within one poll, with no reload (5.9s)
  ✓  415 [firefox] › test/render.spec.js:369:3 › document page › a `..` escape, a javascript: link and raw HTML are all shown as text, nothing executes (358ms)
  ✓  412 [firefox] › test/app-accounts.spec.js:328:3 › accounts interface paths › Remove asks first, then deletes; default accounts have no Remove (935ms)
  ✓  417 [firefox] › test/render.spec.js:401:3 › document page › a wide table scrolls sideways inside its own box, not the page (432ms)
  ✓  408 [chromium] › test/app-threads.spec.js:339:5 › desktop › approval: Start building enabled when Ready and presses; offer press (2.2s)
  ✓  416 [firefox] › test/pages.spec.js:350:3 › narrow touch viewport › neither the list page nor the document page scrolls sideways at 390px (905ms)
  ✓  419 [firefox] › test/render.spec.js:424:3 › document page › no horizontal page scroll at 390px wide (405ms)
  ✓  411 [firefox] › test/app-views.spec.js:172:5 › phone › a typed semicolon is sent as backslash-semicolon, one argument (2.1s)
  ✓  421 [firefox] › test/pages.spec.js:422:3 › remember-me: the first visit and after › opening the ?token= URL lands on /wheelchair/ with no token in page.url() (299ms)
  ✓  422 [firefox] › test/touch.spec.js:138:3 › touch pointer gestures › the Select toggle is shown under a touch-capable context (439ms)
  ✓  424 [firefox] › test/pages.spec.js:429:3 › remember-me: the first visit and after › reloading /wheelchair/ in the same context shows the list (340ms)
  ✓  423 [firefox] › test/app-views.spec.js:183:5 › phone › the key row sends Esc, Tab, Ctrl-C and arrows on a small screen (827ms)
  ✓  409 [firefox] › test/run.spec.js:262:1 › a container shows its rollup status and needs, and a cut child explains itself in the detail panel (3.2s)
  ✓  425 [firefox] › test/touch.spec.js:149:3 › touch pointer gestures › one-finger drag on empty canvas pans the view (498ms)
  ✓  404 [firefox] › test/browser.spec.js:620:1 › select-all approve issues exactly one PUT /view, and a select-all drag issues exactly one more (3.9s)
  ✓  418 [firefox] › test/app-accounts.spec.js:345:3 › accounts interface paths › usage refreshes every 30 seconds on Accounts and Usage, and stops elsewhere (2.0s)
  ✓  427 [firefox] › test/app-views.spec.js:26:5 › desktop › features are grouped by status (645ms)
  ✓  420 [chromium] › test/app-threads.spec.js:355:5 › desktop › approval: Re-check button shows while not Ready (2.0s)
  ✓  428 [firefox] › test/run.spec.js:330:1 › the detail panel shows a needs text of more than 700 characters in full, direct and in a container (743ms)
  ✓  429 [firefox] › test/touch.spec.js:175:3 › touch pointer gestures › two-finger pinch zooms about the midpoint, clamped to MIN_ZOOM and MAX_ZOOM (784ms)
  ✓  430 [firefox] › test/browser.spec.js:668:1 › shift-clicking an implied edge removes it and it stays removed (948ms)
  ✓  432 [firefox] › test/app-views.spec.js:43:5 › desktop › the Needs you strip lists open cards with links to them (654ms)
  ✓  414 [firefox] › test/app-threads.spec.js:383:5 › phone › stub: a dependent stub waits by itself; start now anyway opens the lead (3.9s)
  ✓  431 [firefox] › test/app-accounts.spec.js:375:3 › nav dot › shows while usage is short and clears after opening Usage (1.2s)
  ✓  434 [firefox] › test/run.spec.js:374:1 › the detail panel shows a needs text that is a single 739-character word in full, direct and in a container (889ms)
  ✓  426 [firefox] › test/pages.spec.js:437:3 › remember-me: the first visit and after › a fresh context opening /wheelchair/ gets the sign-in page (both sentences visible) (2.0s)
  ✓  437 [firefox] › test/app-views.spec.js:57:5 › desktop › sessions are grouped by machine with attach commands (683ms)
  ✓  442 [firefox] › test/app-views.spec.js:74:5 › desktop › the hub gets the plain tmux attach whatever name the installer registered it under (536ms)
  ✓  436 [firefox] › test/browser.spec.js:703:1 › an edge is selectable by label, band and endpoint handle at minimum zoom (1.7s)
  ✓  438 [firefox] › test/app-threads.spec.js:407:5 › phone › dead lead offers Restart; archive asks to confirm (1.5s)
  ✓  441 [firefox] › test/pages.spec.js:446:3 › remember-me: the first visit and after › from the list, a graph and a plan document open, and a drag saves, with no token in any request URL (1.2s)
  ✓  444 [firefox] › test/browser.spec.js:741:1 › hovering a label reveals its edge's endpoint handles (523ms)
  ✓  446 [firefox] › test/pages.spec.js:496:3 › remember-me: the first visit and after › an old root bookmark /?token=… ends on /wheelchair/ with the cookie set (293ms)
  ✓  433 [chromium] › test/app-threads.spec.js:364:5 › desktop › idea fold: newest two past three, expandable (2.9s)
  ✓  445 [firefox] › test/app-threads.spec.js:426:5 › phone › cards sit between chat items by time and carry a linkable id (749ms)
  ✓  435 [firefox] › test/touch.spec.js:208:3 › touch pointer gestures › a second finger during a box drag switches to pinch, and the box keeps and saves its new position (2.8s)
  ✓  447 [firefox] › test/browser.spec.js:766:1 › two edges between one pair of nodes in opposite directions are independently selectable (533ms)
  ✓  439 [firefox] › test/app-accounts.spec.js:393:3 › lead waiting line › a waiting lead shows when the provider refills (2.8s)
  ✓  450 [firefox] › test/touch.spec.js:248:3 › touch pointer gestures › a pointercancel ends a drag in progress the same way lifting the finger would (655ms)
  ✓  449 [firefox] › test/app-threads.spec.js:444:5 › phone › plan links use the slug the API returns, not a diagram card plan (719ms)
  ✓  453 [firefox] › test/touch.spec.js:274:3 › touch pointer gestures › the Select toggle turns a one-finger drag into a box-select, and a tap adds or removes a node (576ms)
  ✓  440 [firefox] › test/run.spec.js:416:1 › the title prefix appears and clears across polls (3.3s)
  ✓  454 [firefox] › test/app-threads.spec.js:455:5 › phone › S1: a thread created with a message is titled from it in the list (637ms)
  ✓  455 [firefox] › test/touch.spec.js:314:3 › mouse behaviour is unchanged › the Select toggle is not shown for a plain mouse context (431ms)
  ✓  457 [firefox] › test/app-threads.spec.js:469:5 › phone › S2: a question with doc links to the in-app page; one without has no link (609ms)
  ✓  458 [firefox] › test/touch.spec.js:325:3 › mouse behaviour is unchanged › a plain mouse drag on empty canvas still box-selects (542ms)
  ✓  451 [firefox] › test/browser.spec.js:793:1 › selecting an item expands ref, note, and an edge payload with its inferred state (2.3s)
  ✓  460 [firefox] › test/touch.spec.js:356:3 › narrow viewport › no horizontal page scroll at 390px wide, with the controls reachable (395ms)
  ✓  452 [firefox] › test/app-accounts.spec.js:401:3 › lead waiting line › a waiting lead pinned to a provider names it when the lead has none (2.2s)
  ✓  448 [chromium] › test/app-threads.spec.js:383:5 › desktop › stub: a dependent stub waits by itself; start now anyway opens the lead (3.2s)
  ✓  461 [firefox] › test/browser.spec.js:834:1 › a label the box truncates is readable in full on hover and in the detail panel (616ms)
  ✓  464 [firefox] › test/browser.spec.js:881:1 › a label needing all five lines draws five lines, with no ellipsis and no tooltip (403ms)
  ✓  463 [chromium] › test/app-threads.spec.js:407:5 › desktop › dead lead offers Restart; archive asks to confirm (680ms)
  ✓  465 [firefox] › test/browser.spec.js:917:1 › a five-line box stays shorter than the server's row pitch (348ms)
  ✓  456 [firefox] › test/run.spec.js:447:1 › exactly one notification per node newly needs-you, including two nodes sharing an id in different files (3.5s)
  ✓  462 [firefox] › test/app-accounts.spec.js:408:3 › lead waiting line › a waiting lead with no provider anywhere says it is waiting for room (2.1s)
  ✓  443 [firefox] › test/app-views.spec.js:87:5 › desktop › stopped sessions fold under one line and stay open across a refresh (6.0s)
  ✓  467 [firefox] › test/browser.spec.js:958:1 › no gesture or control adds, renames or connects anything (1.1s)
  ✓  470 [firefox] › test/app-views.spec.js:113:5 › desktop › an unmanaged tmux session is listed read-only, with no terminal link (404ms)
  ✓  469 [firefox] › test/app-accounts.spec.js:416:3 › lead waiting line › a limited running lead names the account (618ms)
  ✓  471 [firefox] › test/browser.spec.js:1010:1 › a page write through the browser carries an Origin the server accepts (636ms)
  ✓  466 [chromium] › test/app-threads.spec.js:426:5 › desktop › cards sit between chat items by time and carry a linkable id (1.9s)
  ✓  472 [firefox] › test/app-views.spec.js:123:5 › desktop › the New thread screen offers found repositories and earlier projects (453ms)
  ✓  459 [firefox] › test/app-threads.spec.js:481:5 › phone › S2: the link appears when the slug becomes known, without a reload (3.8s)
  ✓  476 [firefox] › test/app-views.spec.js:145:5 › desktop › an unreachable machine is greyed and has no sessions (486ms)
  ✓  468 [firefox] › test/run.spec.js:498:1 › a child file's status change redraws the open root without the root file changing (1.7s)
  ✓  474 [firefox] › test/browser.spec.js:1043:1 › a 409 mid-approve is survived by re-reading and re-applying the verdict (824ms)
  ✓  477 [firefox] › test/app-threads.spec.js:492:5 › phone › S4: pressing an option says what was picked and marks it (897ms)
  ✓  479 [firefox] › test/run.spec.js:537:1 › the list page shows a run picture link for a plan with a run, and none for one without (418ms)
  ✓  480 [firefox] › test/browser.spec.js:1086:1 › the browser suite never touches the live default cache root (855ms)
  ✓  481 [firefox] › test/app-threads.spec.js:507:5 › phone › S4: an answer in his own words is sent, closes the card and is shown (683ms)
  ✓  475 [chromium] › test/app-threads.spec.js:444:5 › desktop › plan links use the slug the API returns, not a diagram card plan (2.0s)
  ✓  473 [firefox] › test/app-accounts.spec.js:423:3 › lead waiting line › hidden when the lead is fine or the limit has passed (2.3s)
  ✓  483 [firefox] › test/browser.spec.js:1128:1 › the explanation panel renders expanded when a graph opens, showing the explanation text (395ms)
  ✓  485 [chromium] › test/app-threads.spec.js:455:5 › desktop › S1: a thread created with a message is titled from it in the list (414ms)
  ✓  478 [firefox] › test/app-views.spec.js:156:5 › desktop › the terminal shows the pane and sends typed keys without an extra Enter (2.4s)
  ✓  487 [firefox] › test/browser.spec.js:1145:1 › the panel collapses and expands on click, and the canvas is fully usable in both states (923ms)
  ✓  489 [firefox] › test/app-views.spec.js:172:5 › desktop › a typed semicolon is sent as backslash-semicolon, one argument (524ms)
  ✓  482 [firefox] › test/run.spec.js:575:1 › on a reserved-name path a removed file shows the fatal screen, and its reappearance clears it (2.4s)
  -  491 [firefox] › test/app-views.spec.js:183:5 › desktop › the key row sends Esc, Tab, Ctrl-C and arrows on a small screen
  ✓  486 [firefox] › test/app-accounts.spec.js:437:3 › terminal login mode › reads the login pane and sends keys to the login route (2.1s)
  ✓  488 [chromium] › test/app-threads.spec.js:469:5 › desktop › S2: a question with doc links to the in-app page; one without has no link (1.9s)
  ✓  490 [firefox] › test/browser.spec.js:1192:1 › a node panned into the topmost strip of the canvas is clickable and draggable with the panel expanded (2.0s)
  ✓  484 [firefox] › test/app-threads.spec.js:524:5 › phone › S4: a redraw while typing keeps the draft, focus and caret (3.5s)
  ✓  494 [firefox] › test/browser.spec.js:1249:1 › a graph with a null explanation renders no panel at all (504ms)
  ✓  492 [firefox] › test/run.spec.js:594:1 › a reserved-name file that no longer validates shows the fatal screen with its error (2.3s)
  ✓  496 [firefox] › test/browser.spec.js:1268:1 › a long explanation scrolls inside a bounded panel without changing the canvas height (517ms)
  ✓  497 [firefox] › test/browser.spec.js:1305:1 › the error banner stays visible and legible with the panel expanded (480ms)
  ✓  493 [chromium] › test/app-threads.spec.js:481:5 › desktop › S2: the link appears when the slug becomes known, without a reload (2.6s)
  ✓  495 [firefox] › test/app-threads.spec.js:539:5 › phone › S4: an answered card with no stored value keeps the generic tag; an unmatched value is shown bare (2.0s)
  ✓  500 [firefox] › test/app-threads.spec.js:554:5 › phone › S4: a question the lead resolved shows Answered in chat and the note, dimmed (496ms)
  ✓  501 [firefox] › test/app-threads.spec.js:567:5 › phone › S5: the offer has two buttons; Keep talking first presses its value and says so (603ms)
  ✓  498 [firefox] › test/browser.spec.js:1337:1 › the fatal overlay still covers the canvas with the panel expanded (2.2s)
  ✓  499 [chromium] › test/app-threads.spec.js:492:5 › desktop › S4: pressing an option says what was picked and marks it (1.9s)
  ✓  502 [firefox] › test/app-threads.spec.js:583:5 › phone › S4: a pressed offer marks Take it into planning (595ms)
  ✓  505 [firefox] › test/app-threads.spec.js:593:5 › phone › pinned cards stay under the header in a long thread and fold to one line (793ms)
  ✓  506 [firefox] › test/app-threads.spec.js:622:5 › phone › plan document links open the in-app document page (447ms)
  ✓  503 [firefox] › test/browser.spec.js:1365:1 › collapse state survives a poll and a child-graph navigation, but not a reload (1.9s)
  ✓  504 [chromium] › test/app-threads.spec.js:507:5 › desktop › S4: an answer in his own words is sent, closes the card and is shown (2.0s)
  ✓  508 [firefox] › test/browser.spec.js:1419:1 › hovering a marked phrase lights the group and dims everything outside it, leaving approve disabled (483ms)
  ✓  510 [firefox] › test/browser.spec.js:1458:1 › hovering a marked phrase does not rebuild the panel (404ms)
  ✓  507 [firefox] › test/app-threads.spec.js:29:5 › desktop › the nav stays at the top of a long thread (1.6s)
  ✓  511 [firefox] › test/browser.spec.js:1488:1 › clicking a marked phrase selects exactly the group, approves it, and leaves an already-ruled member untouched (539ms)
  ✓  512 [firefox] › test/app-threads.spec.js:42:5 › desktop › list: last written-in first (agent activity does not reorder), stubs marked, archived behind a filter (1.3s)
  ✓  513 [firefox] › test/browser.spec.js:1552:1 › clicking a visible group whose header would clear the canvas by only a little brings the header fully into view (1.2s)
  ✓  514 [firefox] › test/app-threads.spec.js:100:5 › desktop › list: ?new=1 goes to the New thread screen (386ms)
  ✓  516 [firefox] › test/app-threads.spec.js:106:5 › desktop › list: new thread posts and opens the thread (805ms)
  ✓  515 [firefox] › test/browser.spec.js:1596:1 › a graph too tall for the window opens anchored at its top edge, not clipping a group header there (1.5s)
  ✓  517 [firefox] › test/app-threads.spec.js:125:5 › desktop › chat: bubbles, tool line, context lines, hidden worker turn (509ms)
  ✓  518 [firefox] › test/browser.spec.js:1628:1 › a graph that fits the window on both axes opens centred, not anchored (442ms)
  ✓  519 [firefox] › test/app-threads.spec.js:143:5 › desktop › a tool line expands to its input and result, as text (588ms)
  ✓  509 [chromium] › test/app-threads.spec.js:524:5 › desktop › S4: a redraw while typing keeps the draft, focus and caret (4.7s)
  ✓  520 [firefox] › test/browser.spec.js:1673:1 › a graph too wide for the window opens anchored at its left edge, centred top to bottom (447ms)
  ✓  522 [chromium] › test/app-threads.spec.js:539:5 › desktop › S4: an answered card with no stored value keeps the generic tag; an unmatched value is shown bare (418ms)
  ✓  523 [firefox] › test/browser.spec.js:1720:1 › a graph too big for the window on both axes opens anchored at its top-left corner (505ms)
  ✓  524 [chromium] › test/app-threads.spec.js:554:5 › desktop › S4: a question the lead resolved shows Answered in chat and the note, dimmed (404ms)
  ✓  526 [chromium] › test/app-threads.spec.js:567:5 › desktop › S5: the offer has two buttons; Keep talking first presses its value and says so (415ms)
  ✓  525 [firefox] › test/browser.spec.js:1764:1 › clicking a group with a member off-screen brings it into view without changing zoom (1.2s)
  ✓  521 [firefox] › test/app-threads.spec.js:163:5 › desktop › an archived thread draws a diagram read from its branch, read-only (2.7s)
  ✓  527 [chromium] › test/app-threads.spec.js:583:5 › desktop › S4: a pressed offer marks Take it into planning (1.9s)
  ✓  530 [chromium] › test/app-threads.spec.js:593:5 › desktop › pinned cards stay under the header in a long thread and fold to one line (509ms)
  ✓  529 [firefox] › test/app-threads.spec.js:197:5 › desktop › an archived diagram opens a child graph from the branch, with a way back, read-only (1.1s)
  ✓  532 [firefox] › test/app-threads.spec.js:238:5 › desktop › message box posts and shows queued (623ms)
  ✓  528 [firefox] › test/browser.spec.js:1803:1 › a redraw that changes a group's nodes while the explanation stays byte-identical relights and rules the new membership (2.6s)
  ✓  534 [firefox] › test/browser.spec.js:1856:1 › the page renders a non-# markdown link as plain text, not a marked phrase (338ms)
  ✓  535 [firefox] › test/browser.spec.js:1898:1 › a visible group's boundary sits GROUP_PAD + GROUP_HEADER above its topmost member, in the direction both files must agree on (392ms)
  ✓  531 [chromium] › test/app-threads.spec.js:622:5 › desktop › plan document links open the in-app document page (1.8s)
  ✓  536 [firefox] › test/browser.spec.js:1947:1 › a group name and note too long for the box are cut, and the header tooltip carries both in full (368ms)
  ✓  538 [firefox] › test/browser.spec.js:1992:1 › the header hit rect is invisible and sized to its text, not the full box (388ms)
  ✓  539 [firefox] › test/browser.spec.js:2011:1 › clicking a group header selects exactly its members and enables approve (1.4s)
  ✓  540 [firefox] › test/browser.spec.js:2035:1 › pressing a group header and releasing away from it still selects the group (519ms)
  ✓  533 [firefox] › test/app-threads.spec.js:250:5 › desktop › cards: every kind renders and presses call the press route (3.6s)
  ✓  537 [chromium] › test/app-threads.spec.js:639:3 › working indicator › dots show under the chat and the list dot pulses while the lead is mid-turn (2.6s)
  ✓  541 [firefox] › test/browser.spec.js:2062:1 › a marquee started on empty canvas inside a group boundary still box-selects (479ms)
  ✓  543 [firefox] › test/browser.spec.js:2099:1 › every group boundary precedes every node, edge and label, and every header follows every edge and precedes every label, in document order (330ms)
  ✓  544 [firefox] › test/browser.spec.js:2147:1 › an edge label that would land on a group's header is displaced clear of it (350ms)
  ✓  545 [firefox] › test/browser.spec.js:2172:1 › hovering a group header dims nothing, and lifts the boundary stroke until the pointer leaves (369ms)
  ✓  542 [firefox] › test/app-threads.spec.js:339:5 › desktop › approval: Start building enabled when Ready and presses; offer press (1.7s)
  ✓  546 [firefox] › test/browser.spec.js:2200:1 › hovering a marked phrase dims every other visible group, leaving its own boundary and header plain (428ms)
  ✓  548 [firefox] › test/browser.spec.js:2244:1 › measureLabelWidth is keyed on size, not just text (340ms)
  ✓  549 [firefox] › test/browser.spec.js:2310:1 › a forward arrow's endpoints sit ANCHOR_CLEAR outside the source's bottom edge and the target's top edge (346ms)
  ✓  550 [firefox] › test/browser.spec.js:2337:1 › a back edge between two horizontally separated boxes uses the side faces (317ms)
  ✓  547 [firefox] › test/app-threads.spec.js:355:5 › desktop › approval: Re-check button shows while not Ready (2.1s)
  ✓  551 [firefox] › test/browser.spec.js:2366:1 › a back edge between two boxes whose x-ranges overlap uses top-to-bottom instead, because the sides would cross a box (1.3s)

  ✓  552 [firefox] › test/app-threads.spec.js:364:5 › desktop › idea fold: newest two past three, expandable (817ms)
  ✘  553 [firefox] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph (443ms)
(node:2945253) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ✓  555 [firefox] › test/browser.spec.js:2463:1 › a departure slotted toward its own box is rerouted to the centre-to-centre fallback instead of crossing it (829ms)
  ✓  556 [firefox] › test/browser.spec.js:2510:1 › two arrows sharing a from and to land on adjacent, distinct slots at both ends (432ms)
  ✓  557 [firefox] › test/browser.spec.js:2543:1 › two arrows between boxes whose rectangles overlap land on distinct slots, with no perpendicular fan (317ms)
  ✓  558 [firefox] › test/browser.spec.js:2576:1 › a same-row arrow and an upward arrow both use side faces (297ms)
  ✓  559 [firefox] › test/browser.spec.js:2605:1 › a bundle of three arrows on one face gets three distinct anchors at the right pitch, in the right order (352ms)
  ✓  554 [firefox] › test/app-threads.spec.js:383:5 › desktop › stub: a dependent stub waits by itself; start now anyway opens the lead (3.3s)
  ✓  560 [firefox] › test/browser.spec.js:2642:1 › a vertically stacked reciprocal pair is drawn on two separate, non-collinear geometries (312ms)
  ✓  561 [firefox] › test/app-threads.spec.js:407:5 › desktop › dead lead offers Restart; archive asks to confirm (899ms)
  ✓  562 [firefox] › test/app-threads.spec.js:426:5 › desktop › cards sit between chat items by time and carry a linkable id (482ms)
  ✓  563 [firefox] › test/app-threads.spec.js:444:5 › desktop › plan links use the slug the API returns, not a diagram card plan (2.0s)
  ✓  564 [firefox] › test/app-threads.spec.js:455:5 › desktop › S1: a thread created with a message is titled from it in the list (461ms)
  ✓  565 [firefox] › test/app-threads.spec.js:469:5 › desktop › S2: a question with doc links to the in-app page; one without has no link (2.0s)
  ✓  566 [firefox] › test/app-threads.spec.js:481:5 › desktop › S2: the link appears when the slug becomes known, without a reload (2.9s)
  ✓  567 [firefox] › test/app-threads.spec.js:492:5 › desktop › S4: pressing an option says what was picked and marks it (1.4s)
  ✓  568 [firefox] › test/app-threads.spec.js:507:5 › desktop › S4: an answer in his own words is sent, closes the card and is shown (614ms)
  ✓  569 [firefox] › test/app-threads.spec.js:524:5 › desktop › S4: a redraw while typing keeps the draft, focus and caret (3.4s)
  ✓  570 [firefox] › test/app-threads.spec.js:539:5 › desktop › S4: an answered card with no stored value keeps the generic tag; an unmatched value is shown bare (2.0s)
  ✓  571 [firefox] › test/app-threads.spec.js:554:5 › desktop › S4: a question the lead resolved shows Answered in chat and the note, dimmed (489ms)
  ✓  572 [firefox] › test/app-threads.spec.js:567:5 › desktop › S5: the offer has two buttons; Keep talking first presses its value and says so (564ms)
  ✓  573 [firefox] › test/app-threads.spec.js:583:5 › desktop › S4: a pressed offer marks Take it into planning (548ms)
  ✓  574 [firefox] › test/app-threads.spec.js:593:5 › desktop › pinned cards stay under the header in a long thread and fold to one line (693ms)
  ✓  575 [firefox] › test/app-threads.spec.js:622:5 › desktop › plan document links open the in-app document page (484ms)
  ✓  576 [firefox] › test/app-threads.spec.js:639:3 › working indicator › dots show under the chat and the list dot pulses while the lead is mid-turn (2.8s)


  1) [chromium] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph 

    Error: page.evaluate: TypeError: Cannot read properties of null (reading 'map')
        at eval (eval at evaluate (:311:30), <anonymous>:44:111)
        at UtilityScript.evaluate (<anonymous>:313:16)
        at UtilityScript.<anonymous> (<anonymous>:1:44)
        at eval (eval at evaluate (:311:30), <anonymous>:44:111)
        at UtilityScript.evaluate (<anonymous>:313:16)
        at UtilityScript.<anonymous> (<anonymous>:1:44)
        at /home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-c56d4b2c5f5f-w8/viewer/test/browser.spec.js:2411:36

    Error Context: test-results/browser-no-drawn-arrow-s-l-225c5--over-every-committed-graph-chromium/error-context.md

  2) [firefox] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph 

    Error: page.evaluate: can't access property "map", line.getAttribute(...).match(...) is null
    @debugger eval code line 311 > eval:44:61
    evaluate@debugger eval code:313:16
    @debugger eval code:1:44
    @debugger eval code:1:62

        at @debugger eval code line 311 > eval:44:61
        at evaluate@debugger eval code:313:16
        at @debugger eval code:1:44
        at @debugger eval code:1:62
        at /home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-c56d4b2c5f5f-w8/viewer/test/browser.spec.js:2411:36

    Error Context: test-results/browser-no-drawn-arrow-s-l-225c5--over-every-committed-graph-firefox/error-context.md

  2 failed
    [chromium] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph 
    [firefox] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph 
  2 skipped
  572 passed (2.1m)

```

### `node --test viewer/test/*.test.js`

```text
TAP version 13
# Subtest: default placement, strict and preferred constraints, and invalid flags
ok 1 - default placement, strict and preferred constraints, and invalid flags
  ---
  duration_ms: 1235.667253
  type: 'test'
  ...
# Subtest: placement ranks accounts and respects provider policy
    # Subtest: soonest
    ok 1 - soonest
      ---
      duration_ms: 148.398525
      type: 'test'
      ...
    # Subtest: spread
    ok 2 - spread
      ---
      duration_ms: 123.475962
      type: 'test'
      ...
    # Subtest: one
    ok 3 - one
      ---
      duration_ms: 114.752841
      type: 'test'
      ...
    # Subtest: leave, paused and signed out
    ok 4 - leave, paused and signed out
      ---
      duration_ms: 300.492839
      type: 'test'
      ...
    # Subtest: save Claude and pinned leads
    ok 5 - save Claude and pinned leads
      ---
      duration_ms: 312.933921
      type: 'test'
      ...
    # Subtest: lead any and constraint fallback
    ok 6 - lead any and constraint fallback
      ---
      duration_ms: 1447.099129
      type: 'test'
      ...
    # Subtest: wait estimate accounts for every exhausted window
    ok 7 - wait estimate accounts for every exhausted window
      ---
      duration_ms: 328.076755
      type: 'test'
      ...
    # Subtest: reviewers and verifiers wait when neither provider has room
    ok 8 - reviewers and verifiers wait when neither provider has room
      ---
      duration_ms: 453.799958
      type: 'test'
      ...
    # Subtest: margin skips Claude for workers but not leads
    ok 9 - margin skips Claude for workers but not leads
      ---
      duration_ms: 602.185297
      type: 'test'
      ...
    1..9
ok 2 - placement ranks accounts and respects provider policy
  ---
  duration_ms: 3843.702077
  type: 'test'
  ...
# Subtest: a reading promotes the same waiting worker and keeps its queue
ok 3 - a reading promotes the same waiting worker and keeps its queue
  ---
  duration_ms: 1594.041471
  type: 'test'
  ...
# Subtest: a turn-ended reading promotes the same waiting worker and keeps its token
ok 4 - a turn-ended reading promotes the same waiting worker and keeps its token
  ---
  duration_ms: 1414.860403
  type: 'test'
  ...
# Subtest: limit hold releases with Continue and failed turns notify without a result
ok 5 - limit hold releases with Continue and failed turns notify without a result
  ---
  duration_ms: 1463.581191
  type: 'test'
  ...
# Subtest: promotion failure marks the waiting session failed
ok 6 - promotion failure marks the waiting session failed
  ---
  duration_ms: 1425.647602
  type: 'test'
  ...
# Subtest: waiting sessions survive polling and stop without a machine call
ok 7 - waiting sessions survive polling and stop without a machine call
  ---
  duration_ms: 769.789489
  type: 'test'
  ...
# Subtest: old threads acquire a provider on first read
ok 8 - old threads acquire a provider on first read
  ---
  duration_ms: 9.638999
  type: 'test'
  ...
# Subtest: unused worker cell refuses a strict provider
ok 9 - unused worker cell refuses a strict provider
  ---
  duration_ms: 697.252339
  type: 'test'
  ...
# Subtest: preflight retries on the other signed-in GPT account
ok 10 - preflight retries on the other signed-in GPT account
  ---
  duration_ms: 1133.279828
  type: 'test'
  ...
# Subtest: startup promotes a waiting session when room is available
ok 11 - startup promotes a waiting session when room is available
  ---
  duration_ms: 695.436416
  type: 'test'
  ...
# Subtest: worker placement uses account login on its own machine
ok 12 - worker placement uses account login on its own machine
  ---
  duration_ms: 365.569037
  type: 'test'
  ...
# Subtest: limited verifier reports only after release and continuation
ok 13 - limited verifier reports only after release and continuation
  ---
  duration_ms: 541.449742
  type: 'test'
  ...
# Subtest: reviewer: live limit-ended delivery
ok 14 - reviewer: live limit-ended delivery
  ---
  duration_ms: 454.777472
  type: 'test'
  ...
# Subtest: reviewer: late limit-ended delivery
ok 15 - reviewer: late limit-ended delivery
  ---
  duration_ms: 392.242187
  type: 'test'
  ...
# Subtest: reviewer: spooled retry limit-ended delivery
ok 16 - reviewer: spooled retry limit-ended delivery
  ---
  duration_ms: 468.57212
  type: 'test'
  ...
# Subtest: reviewer: limit-hit limit-ended delivery
ok 17 - reviewer: limit-hit limit-ended delivery
  ---
  duration_ms: 781.555115
  type: 'test'
  ...
# Subtest: reviewer: control limit-ended delivery
ok 18 - reviewer: control limit-ended delivery
  ---
  duration_ms: 792.019015
  type: 'test'
  ...
# Subtest: verifier: live limit-ended delivery
ok 19 - verifier: live limit-ended delivery
  ---
  duration_ms: 751.757681
  type: 'test'
  ...
# Subtest: verifier: late limit-ended delivery
ok 20 - verifier: late limit-ended delivery
  ---
  duration_ms: 726.056767
  type: 'test'
  ...
# Subtest: verifier: spooled retry limit-ended delivery
ok 21 - verifier: spooled retry limit-ended delivery
  ---
  duration_ms: 709.488377
  type: 'test'
  ...
# Subtest: verifier: limit-hit limit-ended delivery
ok 22 - verifier: limit-hit limit-ended delivery
  ---
  duration_ms: 670.442666
  type: 'test'
  ...
# Subtest: verifier: control limit-ended delivery
ok 23 - verifier: control limit-ended delivery
  ---
  duration_ms: 510.429654
  type: 'test'
  ...
# Subtest: worker: live limit-ended delivery
ok 24 - worker: live limit-ended delivery
  ---
  duration_ms: 510.450474
  type: 'test'
  ...
# Subtest: worker: late limit-ended delivery
ok 25 - worker: late limit-ended delivery
  ---
  duration_ms: 627.466456
  type: 'test'
  ...
# Subtest: worker: spooled retry limit-ended delivery
ok 26 - worker: spooled retry limit-ended delivery
  ---
  duration_ms: 763.567001
  type: 'test'
  ...
# Subtest: worker: limit-hit limit-ended delivery
ok 27 - worker: limit-hit limit-ended delivery
  ---
  duration_ms: 672.006325
  type: 'test'
  ...
# Subtest: worker: control limit-ended delivery
ok 28 - worker: control limit-ended delivery
  ---
  duration_ms: 798.745295
  type: 'test'
  ...
# Subtest: waiting lead records provider and promoted role layers and style
ok 29 - waiting lead records provider and promoted role layers and style
  ---
  duration_ms: 554.62392
  type: 'test'
  ...
# Subtest: renders a Claude human turn after unwrapping pasted content
ok 30 - renders a Claude human turn after unwrapping pasted content
  ---
  duration_ms: 2.976058
  type: 'test'
  ...
# Subtest: hides a Claude role turn and its reply
ok 31 - hides a Claude role turn and its reply
  ---
  duration_ms: 0.444182
  type: 'test'
  ...
# Subtest: replaces a stub context marker and keeps its lead reply
ok 32 - replaces a stub context marker and keeps its lead reply
  ---
  duration_ms: 0.360601
  type: 'test'
  ...
# Subtest: replaces a restart context marker and keeps its lead reply
ok 33 - replaces a restart context marker and keeps its lead reply
  ---
  duration_ms: 0.242185
  type: 'test'
  ...
# Subtest: renders a card press as a short Collin bubble
ok 34 - renders a card press as a short Collin bubble
  ---
  duration_ms: 0.603538
  type: 'test'
  ...
# Subtest: collapses a Claude tool call to one chat item
ok 35 - collapses a Claude tool call to one chat item
  ---
  duration_ms: 0.334452
  type: 'test'
  ...
# Subtest: ignores Codex injected entries before turn_context
ok 36 - ignores Codex injected entries before turn_context
  ---
  duration_ms: 0.58364
  type: 'test'
  ...
# Subtest: does not let Codex task_started open a human turn before turn_context
ok 37 - does not let Codex task_started open a human turn before turn_context
  ---
  duration_ms: 0.269587
  type: 'test'
  ...
# Subtest: requires a fresh Codex turn_context for each turn
ok 38 - requires a fresh Codex turn_context for each turn
  ---
  duration_ms: 0.747324
  type: 'test'
  ...
# Subtest: collapses a Codex function call to one chat item
ok 39 - collapses a Codex function call to one chat item
  ---
  duration_ms: 0.643564
  type: 'test'
  ...
# Subtest: uses each transcript line timestamp for chat items
ok 40 - uses each transcript line timestamp for chat items
  ---
  duration_ms: 0.342156
  type: 'test'
  ...
# Subtest: a line without a timestamp takes the previous one, and Claude echoes are not repeated
ok 41 - a line without a timestamp takes the previous one, and Claude echoes are not repeated
  ---
  duration_ms: 0.393645
  type: 'test'
  ...
# Subtest: folds a Claude tool result into its call, cut at 2000 characters
ok 42 - folds a Claude tool result into its call, cut at 2000 characters
  ---
  duration_ms: 0.632383
  type: 'test'
  ...
# Subtest: folds a Codex function_call_output into its call
ok 43 - folds a Codex function_call_output into its call
  ---
  duration_ms: 0.259417
  type: 'test'
  ...
# Subtest: GET /threads/:id/graph reads an archived thread graph from its branch, and nothing else
ok 44 - GET /threads/:id/graph reads an archived thread graph from its branch, and nothing else
  ---
  duration_ms: 668.944925
  type: 'test'
  ...
# Subtest: accepts a valid card for its own lead
ok 45 - accepts a valid card for its own lead
  ---
  duration_ms: 594.32471
  type: 'test'
  ...
# Subtest: stores an ISO timestamp on every card
ok 46 - stores an ISO timestamp on every card
  ---
  duration_ms: 412.438185
  type: 'test'
  ...
# Subtest: keeps initialized hub state on disk across a new Hub instance
ok 47 - keeps initialized hub state on disk across a new Hub instance
  ---
  duration_ms: 381.005575
  type: 'test'
  ...
# Subtest: uses the card CLI validator for a locally valid card
ok 48 - uses the card CLI validator for a locally valid card
  ---
  duration_ms: 0.50049
  type: 'test'
  ...
# Subtest: derives an opening title and lets only the lead rename it with title cards
ok 49 - derives an opening title and lets only the lead rename it with title cards
  ---
  duration_ms: 660.499447
  type: 'test'
  ...
# Subtest: validates the optional question document name
ok 50 - validates the optional question document name
  ---
  duration_ms: 0.655057
  type: 'test'
  ...
# Subtest: refuses a card with an unknown field
ok 51 - refuses a card with an unknown field
  ---
  duration_ms: 357.986013
  type: 'test'
  ...
# Subtest: refuses a card a role may not emit
ok 52 - refuses a card a role may not emit
  ---
  duration_ms: 549.012299
  type: 'test'
  ...
# Subtest: refuses a card envelope with a session from another thread
ok 53 - refuses a card envelope with a session from another thread
  ---
  duration_ms: 982.905005
  type: 'test'
  ...
# Subtest: replaces a thread singleton card
ok 54 - replaces a thread singleton card
  ---
  duration_ms: 650.625227
  type: 'test'
  ...
# Subtest: records a press and lets a lead resolve an open question only in its thread
ok 55 - records a press and lets a lead resolve an open question only in its thread
  ---
  duration_ms: 1162.264824
  type: 'test'
  ...
# Subtest: limits offers to a second request after keep talking first
ok 56 - limits offers to a second request after keep talking first
  ---
  duration_ms: 1048.325123
  type: 'test'
  ...
# Subtest: routes a session message to the named target queue
ok 57 - routes a session message to the named target queue
  ---
  duration_ms: 743.771656
  type: 'test'
  ...
# Subtest: marks a result task finished and relays it to its starter
ok 58 - marks a result task finished and relays it to its starter
  ---
  duration_ms: 732.316244
  type: 'test'
  ...
# Subtest: holds a queued message until both readiness and a turn end
ok 59 - holds a queued message until both readiness and a turn end
  ---
  duration_ms: 526.54155
  type: 'test'
  ...
# Subtest: stamps when Collin last wrote in a thread, and only for his messages
ok 60 - stamps when Collin last wrote in a thread, and only for his messages
  ---
  duration_ms: 583.416978
  type: 'test'
  ...
# Subtest: posts a permission need and holds the session queue while the prompt is open
ok 61 - posts a permission need and holds the session queue while the prompt is open
  ---
  duration_ms: 529.199297
  type: 'test'
  ...
# Subtest: a turn ending after a permission prompt clears the hold and the card
ok 62 - a turn ending after a permission prompt clears the hold and the card
  ---
  duration_ms: 587.731163
  type: 'test'
  ...
# Subtest: closes a permission need and resumes the queue
ok 63 - closes a permission need and resumes the queue
  ---
  duration_ms: 495.607516
  type: 'test'
  ...
# Subtest: posts and clears a stuck-session need
ok 64 - posts and clears a stuck-session need
  ---
  duration_ms: 377.6194
  type: 'test'
  ...
# Subtest: allows a lead to start only its permitted roles
ok 65 - allows a lead to start only its permitted roles
  ---
  duration_ms: 512.961733
  type: 'test'
  ...
# Subtest: refuses a second live sub-lead
ok 66 - refuses a second live sub-lead
  ---
  duration_ms: 493.270133
  type: 'test'
  ...
# Subtest: deduplicates a live start attempt
ok 67 - deduplicates a live start attempt
  ---
  duration_ms: 577.102446
  type: 'test'
  ...
# Subtest: allows a lead to stop a session it started
ok 68 - allows a lead to stop a session it started
  ---
  duration_ms: 584.57506
  type: 'test'
  ...
# Subtest: starts a replacement lead after the old lead ends
ok 69 - starts a replacement lead after the old lead ends
  ---
  duration_ms: 500.080616
  type: 'test'
  ...
# Subtest: a fresh Claude lead with no first message takes its queue without a turn-ended event
ok 70 - a fresh Claude lead with no first message takes its queue without a turn-ended event
  ---
  duration_ms: 404.15221
  type: 'test'
  ...
# Subtest: puts restart context ahead of transferred queued messages
ok 71 - puts restart context ahead of transferred queued messages
  ---
  duration_ms: 480.384257
  type: 'test'
  ...
# Subtest: reports a dead worker to its starter
ok 72 - reports a dead worker to its starter
  ---
  duration_ms: 414.26064
  type: 'test'
  ...
# Subtest: raises Sessions ended when the lead dies
ok 73 - raises Sessions ended when the lead dies
  ---
  duration_ms: 254.768336
  type: 'test'
  ...
# Subtest: creates an unstarted stub and opens it after a role turn ends
ok 74 - creates an unstarted stub and opens it after a role turn ends
  ---
  duration_ms: 321.055187
  type: 'test'
  ...
# Subtest: stub lead follows lead order instead of inheriting its parent provider
ok 75 - stub lead follows lead order instead of inheriting its parent provider
  ---
  duration_ms: 399.353927
  type: 'test'
  ...
# Subtest: waits for a dependent stub until the parent merges
ok 76 - waits for a dependent stub until the parent merges
  ---
  duration_ms: 354.153572
  type: 'test'
  ...
# Subtest: opens a waiting stub after the 10-minute check finds its parent merged
ok 77 - opens a waiting stub after the 10-minute check finds its parent merged
  ---
  duration_ms: 664.214901
  type: 'test'
  ...
# Subtest: rechecks an approval in place and gates Start building on the fresh result
ok 78 - rechecks an approval in place and gates Start building on the fresh result
  ---
  duration_ms: 467.882318
  type: 'test'
  ...
# Subtest: asks the machine service to archive the thread
ok 79 - asks the machine service to archive the thread
  ---
  duration_ms: 416.632709
  type: 'test'
  ...
# Subtest: queues a card press as a lead message
ok 80 - queues a card press as a lead message
  ---
  duration_ms: 404.210463
  type: 'test'
  ...
# Subtest: reads archived MAP.md with git show from the thread branch
ok 81 - reads archived MAP.md with git show from the thread branch
  ---
  duration_ms: 449.973507
  type: 'test'
  ...
# Subtest: reads archived IDEA.md with git show from the thread branch
ok 82 - reads archived IDEA.md with git show from the thread branch
  ---
  duration_ms: 371.366537
  type: 'test'
  ...
# Subtest: reads archived PLAN.md with git show from the thread branch
ok 83 - reads archived PLAN.md with git show from the thread branch
  ---
  duration_ms: 372.312299
  type: 'test'
  ...
# Subtest: refuses archived documents outside MAP, IDEA and PLAN
ok 84 - refuses archived documents outside MAP, IDEA and PLAN
  ---
  duration_ms: 381.826569
  type: 'test'
  ...
# Subtest: finds a worktree plan slug on thread and chat routes
ok 85 - finds a worktree plan slug on thread and chat routes
  ---
  duration_ms: 435.976872
  type: 'test'
  ...
# Subtest: groups features by the current plan status and lists open needs
ok 86 - groups features by the current plan status and lists open needs
  ---
  duration_ms: 307.31373
  type: 'test'
  ...
# Subtest: returns every machine session and persists its last-seen time
ok 87 - returns every machine session and persists its last-seen time
  ---
  duration_ms: 294.49284
  type: 'test'
  ...
# Subtest: proxies pane reads and raw terminal keys through the machine service
ok 88 - proxies pane reads and raw terminal keys through the machine service
  ---
  duration_ms: 264.268037
  type: 'test'
  ...
# Subtest: reads an unrecorded service pane but refuses its keys
ok 89 - reads an unrecorded service pane but refuses its keys
  ---
  duration_ms: 91.503367
  type: 'test'
  ...
# Subtest: refuses a browser write from the wrong origin
ok 90 - refuses a browser write from the wrong origin
  ---
  duration_ms: 90.603752
  type: 'test'
  ...
# Subtest: refuses a machine callback without its secret
ok 91 - refuses a machine callback without its secret
  ---
  duration_ms: 222.055632
  type: 'test'
  ...
# Subtest: a verifier the lead starts is pointed at the thread branch
ok 92 - a verifier the lead starts is pointed at the thread branch
  ---
  duration_ms: 408.072209
  type: 'test'
  ...
# Subtest: the chat reads the lead transcript through the machine service
ok 93 - the chat reads the lead transcript through the machine service
  ---
  duration_ms: 306.475192
  type: 'test'
  ...
# Subtest: Tool steps: Hide leaves the lead's tool calls out of the chat
ok 94 - Tool steps: Hide leaves the lead's tool calls out of the chat
  ---
  duration_ms: 386.362268
  type: 'test'
  ...
# Subtest: a verifier report from its transcript reaches the lead as its result
ok 95 - a verifier report from its transcript reaches the lead as its result
  ---
  duration_ms: 483.544928
  type: 'test'
  ...
# Subtest: a Codex verifier report comes from the notify payload when present, once
ok 96 - a Codex verifier report comes from the notify payload when present, once
  ---
  duration_ms: 546.363116
  type: 'test'
  ...
# Subtest: a mapper works in the thread worktree; a worker branches from the thread branch
ok 97 - a mapper works in the thread worktree; a worker branches from the thread branch
  ---
  duration_ms: 967.568755
  type: 'test'
  ...
# Subtest: models per role: leads, other agents, workers, aliases, and critical resolve through their provider cells
ok 98 - models per role: leads, other agents, workers, aliases, and critical resolve through their provider cells
  ---
  duration_ms: 3629.281294
  type: 'test'
  ...
# Subtest: models per role: Claude always gets a model and effort, and preferences reach the machine
ok 99 - models per role: Claude always gets a model and effort, and preferences reach the machine
  ---
  duration_ms: 962.82167
  type: 'test'
  ...
# Subtest: models per role: Claude family aliases do not become Codex tiers
ok 100 - models per role: Claude family aliases do not become Codex tiers
  ---
  duration_ms: 1351.741082
  type: 'test'
  ...
# Subtest: models per role: unknown tiers and unused provider cells are refused
ok 101 - models per role: unknown tiers and unused provider cells are refused
  ---
  duration_ms: 799.610795
  type: 'test'
  ...
# Subtest: no session starts while the machine service runs another commit
ok 102 - no session starts while the machine service runs another commit
  ---
  duration_ms: 758.674437
  type: 'test'
  ...
# Subtest: the Ready check covers the other family and uses account login status
ok 103 - the Ready check covers the other family and uses account login status
  ---
  duration_ms: 364.478905
  type: 'test'
  ...
# Subtest: projects.json records each thread project once and GET /projects lists them
ok 104 - projects.json records each thread project once and GET /projects lists them
  ---
  duration_ms: 815.569724
  type: 'test'
  ...
# Subtest: the sessions list passes unmanaged tmux sessions through as read-only
ok 105 - the sessions list passes unmanaged tmux sessions through as read-only
  ---
  duration_ms: 304.652566
  type: 'test'
  ...
# Subtest: serializes concurrent cards and de-duplicates a delivered card
ok 106 - serializes concurrent cards and de-duplicates a delivered card
  ---
  duration_ms: 357.452728
  type: 'test'
  ...
# Subtest: a failed event submit records its delivery id and leaves its queue for a later retry
ok 107 - a failed event submit records its delivery id and leaves its queue for a later retry
  ---
  duration_ms: 457.174929
  type: 'test'
  ...
# Subtest: a failed result-card submit is accepted, queued, and never rejected
ok 108 - a failed result-card submit is accepted, queued, and never rejected
  ---
  duration_ms: 710.793669
  type: 'test'
  ...
# Subtest: a browser message stays queued and reports delivery failure without failing its route
ok 109 - a browser message stays queued and reports delivery failure without failing its route
  ---
  duration_ms: 462.605475
  type: 'test'
  ...
# Subtest: a verifier report survives a failed submit and the queue timer retries it
ok 110 - a verifier report survives a failed submit and the queue timer retries it
  ---
  duration_ms: 696.947322
  type: 'test'
  ...
# Subtest: talking about an approval keeps it open for Needs you and Start building
ok 111 - talking about an approval keeps it open for Needs you and Start building
  ---
  duration_ms: 413.849959
  type: 'test'
  ...
# Subtest: successful submits record their destination, source, text, and time
ok 112 - successful submits record their destination, source, text, and time
  ---
  duration_ms: 357.798912
  type: 'test'
  ...
# Subtest: sent history keeps 500 entries and appends older entries beside the thread file
ok 113 - sent history keeps 500 entries and appends older entries beside the thread file
  ---
  duration_ms: 356.384419
  type: 'test'
  ...
# Subtest: restart context includes the latest twenty Collin and card messages
ok 114 - restart context includes the latest twenty Collin and card messages
  ---
  duration_ms: 691.806391
  type: 'test'
  ...
# Subtest: runs Codex preflight before a lead start and records its failure as a need
ok 115 - runs Codex preflight before a lead start and records its failure as a need
  ---
  duration_ms: 358.519243
  type: 'test'
  ...
# Subtest: terminal Enter marks its session busy before the next hook event
ok 116 - terminal Enter marks its session busy before the next hook event
  ---
  duration_ms: 414.144895
  type: 'test'
  ...
# Subtest: unreachable sessions are public and marked unreachable
ok 117 - unreachable sessions are public and marked unreachable
  ---
  duration_ms: 467.502256
  type: 'test'
  ...
# Subtest: a kept rebase makes a need and leaves the thread open
ok 118 - a kept rebase makes a need and leaves the thread open
  ---
  duration_ms: 374.134514
  type: 'test'
  ...
# Subtest: a second archive records the thread after a retained rebase worktree is removed
ok 119 - a second archive records the thread after a retained rebase worktree is removed
  ---
  duration_ms: 463.941667
  type: 'test'
  ...
# Subtest: serializes concurrent card and event arrivals without losing either
ok 120 - serializes concurrent card and event arrivals without losing either
  ---
  duration_ms: 681.773417
  type: 'test'
  ...
# Subtest: Features includes an opened stub but not an unopened one, and needs need no slug
ok 121 - Features includes an opened stub but not an unopened one, and needs need no slug
  ---
  duration_ms: 751.238112
  type: 'test'
  ...
# Subtest: stub commits persist and reach the opened lead context
ok 122 - stub commits persist and reach the opened lead context
  ---
  duration_ms: 590.23394
  type: 'test'
  ...
# Subtest: registers a diagram plan before persisting its card
ok 123 - registers a diagram plan before persisting its card
  ---
  duration_ms: 424.488786
  type: 'test'
  ...
# Subtest: a diagram card registers its graph for the real viewer iframe route
ok 124 - a diagram card registers its graph for the real viewer iframe route
  ---
  duration_ms: 363.250648
  type: 'test'
  ...
# Subtest: the real viewer keeps its boot commit when its clone moves before the first app request
ok 125 - the real viewer keeps its boot commit when its clone moves before the first app request
  ---
  duration_ms: 1254.895787
  type: 'test'
  ...
# Subtest: reachable Sessions responses do not expose tokens
ok 126 - reachable Sessions responses do not expose tokens
  ---
  duration_ms: 314.377517
  type: 'test'
  ...
# Subtest: a replacement sub-lead stops its predecessor worker, but a worker cannot stop a worker child
ok 127 - a replacement sub-lead stops its predecessor worker, but a worker cannot stop a worker child
  ---
  duration_ms: 997.011444
  type: 'test'
  ...
# Subtest: worker replacement reuses a dead worker worktree and branch only
ok 128 - worker replacement reuses a dead worker worktree and branch only
  ---
  duration_ms: 1065.122153
  type: 'test'
  ...
# Subtest: validates a resolve card and the targets it may close
ok 129 - validates a resolve card and the targets it may close
  ---
  duration_ms: 0.605581
  type: 'test'
  ...
# Subtest: a lead resolve closes its needs card and removes it from the Needs strip
ok 130 - a lead resolve closes its needs card and removes it from the Needs strip
  ---
  duration_ms: 444.306265
  type: 'test'
  ...
# Subtest: a resolve is refused for a system card, another kind, another thread and a missing card
ok 131 - a resolve is refused for a system card, another kind, another thread and a missing card
  ---
  duration_ms: 764.788201
  type: 'test'
  ...
# Subtest: a resolve retried with the same delivery id is a duplicate
ok 132 - a resolve retried with the same delivery id is a duplicate
  ---
  duration_ms: 361.515901
  type: 'test'
  ...
# Subtest: keep going and talk about it close a lead needs card and reach the lead
ok 133 - keep going and talk about it close a lead needs card and reach the lead
  ---
  duration_ms: 384.530984
  type: 'test'
  ...
# Subtest: dismiss closes a lead needs card as collin and refuses a system one
ok 134 - dismiss closes a lead needs card as collin and refuses a system one
  ---
  duration_ms: 422.745351
  type: 'test'
  ...
# Subtest: worker effort overrides and escalation ceilings reject before starting
ok 135 - worker effort overrides and escalation ceilings reject before starting
  ---
  duration_ms: 2270.011152
  type: 'test'
  ...
# Subtest: wc session start includes effort only when supplied
ok 136 - wc session start includes effort only when supplied
  ---
  duration_ms: 1.781366
  type: 'test'
  ...
# Subtest: restarting a failed lead answers its turn-failed card
ok 137 - restarting a failed lead answers its turn-failed card
  ---
  duration_ms: 562.461511
  type: 'test'
  ...
# Subtest: diagram formats and lead-only image cards validate and persist
ok 138 - diagram formats and lead-only image cards validate and persist
  ---
  duration_ms: 335.028948
  type: 'test'
  ...
# Subtest: uploads and files stream through the hub and enforce admission
ok 139 - uploads and files stream through the hub and enforce admission
  ---
  duration_ms: 1906.395924
  type: 'test'
  ...
# Subtest: a machine reset during an upload returns 409
ok 140 - a machine reset during an upload returns 409
  ---
  duration_ms: 1830.13952
  type: 'test'
  ...
# Subtest: archive keeps thread open on upload removal failure and archives after success
ok 141 - archive keeps thread open on upload removal failure and archives after success
  ---
  duration_ms: 284.780639
  type: 'test'
  ...
# Subtest: archived HTML route sends the static sandbox headers
ok 142 - archived HTML route sends the static sandbox headers
  ---
  duration_ms: 0.868716
  type: 'test'
  ...
# Subtest: "hub" names the installer-registered entry for this host's own service
ok 143 - "hub" names the installer-registered entry for this host's own service
  ---
  duration_ms: 15.619189
  type: 'test'
  ...
# Subtest: a lead waits when its machine passes the path check but cannot start it
ok 144 - a lead waits when its machine passes the path check but cannot start it
  ---
  duration_ms: 185.873243
  type: 'test'
  ...
# Subtest: a reachable machine that refuses a lead start records failure
ok 145 - a reachable machine that refuses a lead start records failure
  ---
  duration_ms: 565.934647
  type: 'test'
  ...
# --cli is ignored: the hub picks the provider
# Subtest: an unreachable machine leaves no thread and no projects.json entry
ok 146 - an unreachable machine leaves no thread and no projects.json entry
  ---
  duration_ms: 22.631468
  type: 'test'
  ...
# Subtest: wc.js passes worktree-remove through with the worker session, and requires a commit message
ok 147 - wc.js passes worktree-remove through with the worker session, and requires a commit message
  ---
  duration_ms: 1.160436
  type: 'test'
  ...
# Subtest: wc.js preserves git flags and the worker replacement option
ok 148 - wc.js preserves git flags and the worker replacement option
  ---
  duration_ms: 0.835353
  type: 'test'
  ...
# Subtest: a hub keeps the version captured at construction after its clone advances
ok 149 - a hub keeps the version captured at construction after its clone advances
  ---
  duration_ms: 72.165336
  type: 'test'
  ...
# Subtest: wc.js sends provider constraints and prints waiting and notice output
ok 150 - wc.js sends provider constraints and prints waiting and notice output
  ---
  duration_ms: 91.054647
  type: 'test'
  ...
# Subtest: GET /new-thread returns found repositories for the machine and passes folder_error on
ok 151 - GET /new-thread returns found repositories for the machine and passes folder_error on
  ---
  duration_ms: 310.881685
  type: 'test'
  ...
# Subtest: GET /new-thread asks for no folder when none is set
ok 152 - GET /new-thread asks for no folder when none is set
  ---
  duration_ms: 210.985739
  type: 'test'
  ...
# Subtest: GET /new-thread says an unreachable machine is not reachable and an old one needs updating
ok 153 - GET /new-thread says an unreachable machine is not reachable and an old one needs updating
  ---
  duration_ms: 286.120742
  type: 'test'
  ...
# Subtest: GET /new-thread lists hub first and folds the hub hostname entry into it
ok 154 - GET /new-thread lists hub first and folds the hub hostname entry into it
  ---
  duration_ms: 171.599135
  type: 'test'
  ...
# Subtest: GET /new-thread filters saved directories by machine
ok 155 - GET /new-thread filters saved directories by machine
  ---
  duration_ms: 206.74721
  type: 'test'
  ...
# Subtest: GET /new-thread previous comes from threads on that machine, newest first, hostname alias included
ok 156 - GET /new-thread previous comes from threads on that machine, newest first, hostname alias included
  ---
  duration_ms: 878.267776
  type: 'test'
  ...
# Subtest: saved directories: add, duplicate 409, remove, remove unknown 404
ok 157 - saved directories: add, duplicate 409, remove, remove unknown 404
  ---
  duration_ms: 319.852742
  type: 'test'
  ...
# Subtest: saving a directory is refused with the check reason, and 502 when the machine does not answer
ok 158 - saving a directory is refused with the check reason, and 502 when the machine does not answer
  ---
  duration_ms: 322.167832
  type: 'test'
  ...
# Subtest: default_project_folder is trimmed, cleared by empty, and must be absolute or start with ~
ok 159 - default_project_folder is trimmed, cleared by empty, and must be absolute or start with ~
  ---
  duration_ms: 601.440088
  type: 'test'
  ...
# Subtest: starting a thread on a path the machine refuses leaves no thread and no projects.json entry
ok 160 - starting a thread on a path the machine refuses leaves no thread and no projects.json entry
  ---
  duration_ms: 288.982341
  type: 'test'
  ...
# Subtest: starting a thread stores the path the machine expanded
ok 161 - starting a thread stores the path the machine expanded
  ---
  duration_ms: 573.904653
  type: 'test'
  ...
# Subtest: a template scope may name a saved directory path, and settings lists it as a project
ok 162 - a template scope may name a saved directory path, and settings lists it as a project
  ---
  duration_ms: 471.395147
  type: 'test'
  ...
# Subtest: saved directories refuse . and .. as names and treat a malformed escape as unknown
ok 163 - saved directories refuse . and .. as names and treat a malformed escape as unknown
  ---
  duration_ms: 326.323162
  type: 'test'
  ...
# Subtest: an app page without the remember cookie gets the sign-in page
ok 164 - an app page without the remember cookie gets the sign-in page
  ---
  duration_ms: 208.811519
  type: 'test'
  ...
# Subtest: the bookmark token signs a new browser in on an app page, and a wrong one does not
ok 165 - the bookmark token signs a new browser in on an app page, and a wrong one does not
  ---
  duration_ms: 181.168439
  type: 'test'
  ...
# Subtest: the document page is served behind the remember cookie like the other app pages
ok 166 - the document page is served behind the remember cookie like the other app pages
  ---
  duration_ms: 195.597705
  type: 'test'
  ...
# Subtest: the New thread page is served behind the remember cookie, with its assets
ok 167 - the New thread page is served behind the remember cookie, with its assets
  ---
  duration_ms: 163.88086
  type: 'test'
  ...
# Subtest: an unknown app page is not served
ok 168 - an unknown app page is not served
  ---
  duration_ms: 126.188335
  type: 'test'
  ...
# Subtest: asset names outside pages/ and vendor/, or climbing out, are refused
ok 169 - asset names outside pages/ and vendor/, or climbing out, are refused
  ---
  duration_ms: 145.78381
  type: 'test'
  ...
# Subtest: the existing page scripts are still served
ok 170 - the existing page scripts are still served
  ---
  duration_ms: 139.726582
  type: 'test'
  ...
# Subtest: app pages may frame this origin, for diagram cards
ok 171 - app pages may frame this origin, for diagram cards
  ---
  duration_ms: 1.171416
  type: 'test'
  ...
# Subtest: settings defaults, templates, prompt composition, counts, and validation
ok 172 - settings defaults, templates, prompt composition, counts, and validation
  ---
  duration_ms: 1476.416912
  type: 'test'
  ...
# Subtest: style saving, trailer delivery, chat stripping, and preview stay scoped to leads
ok 173 - style saving, trailer delivery, chat stripping, and preview stay scoped to leads
  ---
  duration_ms: 830.153992
  type: 'test'
  ...
# Subtest: settings updates serialize concurrent saves and report a missing template project
ok 174 - settings updates serialize concurrent saves and report a missing template project
  ---
  duration_ms: 396.480216
  type: 'test'
  ...
# Subtest: the role-layer cap refuses template and style saves without changing settings
ok 175 - the role-layer cap refuses template and style saves without changing settings
  ---
  duration_ms: 201.635244
  type: 'test'
  ...
# Subtest: preview has a 75-second machine timeout while ordinary calls retain five seconds
ok 176 - preview has a 75-second machine timeout while ordinary calls retain five seconds
  ---
  duration_ms: 11.546447
  type: 'test'
  ...
# Subtest: settings model and heads-up routes reject bad input and preserve the settings file mode
ok 177 - settings model and heads-up routes reject bad input and preserve the settings file mode
  ---
  duration_ms: 2337.628453
  type: 'test'
  ...
# Subtest: template scopes must be listed when added or changed, while removed-project templates remain editable
ok 178 - template scopes must be listed when added or changed, while removed-project templates remain editable
  ---
  duration_ms: 262.723344
  type: 'test'
  ...
# Subtest: escalation settings, sentences, and role layers
ok 179 - escalation settings, sentences, and role layers
  ---
  duration_ms: 345.500324
  type: 'test'
  ...
# warning: You appear to have cloned an empty repository.
# Subtest: an untracked new plan directory is the thread plan, not an existing one
ok 180 - an untracked new plan directory is the thread plan, not an existing one
  ---
  duration_ms: 138.268084
  type: 'test'
  ...
# warning: You appear to have cloned an empty repository.
# Subtest: a plan directory committed on the thread branch is found against its upstream
ok 181 - a plan directory committed on the thread branch is found against its upstream
  ---
  duration_ms: 144.581073
  type: 'test'
  ...
# warning: You appear to have cloned an empty repository.
# Preparing worktree (new branch 'wc/no-track')
# Subtest: finds a committed plan on a no-track worktree branch against origin/default
ok 182 - finds a committed plan on a no-track worktree branch against origin/default
  ---
  duration_ms: 190.784533
  type: 'test'
  ...
# warning: You appear to have cloned an empty repository.
# Subtest: finding the slug registers the plan directory once
ok 183 - finding the slug registers the plan directory once
  ---
  duration_ms: 144.38149
  type: 'test'
  ...
# Subtest: a failed queued operation reaches its caller and leaves the process running
ok 184 - a failed queued operation reaches its caller and leaves the process running
  ---
  duration_ms: 152.635341
  type: 'test'
  ...
# machine service listening on 127.0.0.1:45463
# Subtest: archive through the hub cancels a stalled upload to the real machine
ok 185 - archive through the hub cancels a stalled upload to the real machine
  ---
  duration_ms: 6393.091656
  type: 'test'
  ...
# Subtest: account normalization and balancing settings survive round trip
ok 186 - account normalization and balancing settings survive round trip
  ---
  duration_ms: 3.014312
  type: 'test'
  ...
# Subtest: effective windows, room and forecasts
ok 187 - effective windows, room and forecasts
  ---
  duration_ms: 0.859619
  type: 'test'
  ...
# Subtest: ranking and unknown transcript
ok 188 - ranking and unknown transcript
  ---
  duration_ms: 0.88645
  type: 'test'
  ...
# Subtest: Ready accepts a second signed-in account and old service status
ok 189 - Ready accepts a second signed-in account and old service status
  ---
  duration_ms: 1.075292
  type: 'test'
  ...
# Subtest: account and balancing routes and usage shape
ok 190 - account and balancing routes and usage shape
  ---
  duration_ms: 409.53663
  type: 'test'
  ...
# Subtest: normalization supplies defaults and all plan weights
ok 191 - normalization supplies defaults and all plan weights
  ---
  duration_ms: 1.325392
  type: 'test'
  ...
# Subtest: room boundaries, windows, forecast and margin
ok 192 - room boundaries, windows, forecast and margin
  ---
  duration_ms: 0.454121
  type: 'test'
  ...
# Subtest: rank chooses by reset, weighted room, live sessions and last choice and explains skips
ok 193 - rank chooses by reset, weighted room, live sessions and last choice and explains skips
  ---
  duration_ms: 35.684495
  type: 'test'
  ...
# Subtest: record serializes readings and chosen accounts
ok 194 - record serializes readings and chosen accounts
  ---
  duration_ms: 16.299422
  type: 'test'
  ...
# Subtest: Ready rejects paused accounts and preserves old Codex preflight
ok 195 - Ready rejects paused accounts and preserves old Codex preflight
  ---
  duration_ms: 2.354606
  type: 'test'
  ...
# Subtest: account route assigns unique slugs and resets weight on plan change
ok 196 - account route assigns unique slugs and resets weight on plan change
  ---
  duration_ms: 195.807147
  type: 'test'
  ...
# Subtest: usage endpoints expose machine state, sessions and alert weeks
ok 197 - usage endpoints expose machine state, sessions and alert weeks
  ---
  duration_ms: 212.059219
  type: 'test'
  ...
# Subtest: sign-in proxies forward the account, machine path and payload
ok 198 - sign-in proxies forward the account, machine path and payload
  ---
  duration_ms: 229.512775
  type: 'test'
  ...
# Subtest: removing an account leaves its live session intact and removes it from settings and usage
ok 199 - removing an account leaves its live session intact and removes it from settings and usage
  ---
  duration_ms: 238.632788
  type: 'test'
  ...
# Subtest: newer ordinary readings preserve a future limit until it expires
ok 200 - newer ordinary readings preserve a future limit until it expires
  ---
  duration_ms: 377.101787
  type: 'test'
  ...
# Subtest: removed account ids are retired and do not inherit usage or sessions
ok 201 - removed account ids are retired and do not inherit usage or sessions
  ---
  duration_ms: 350.036875
  type: 'test'
  ...
# Subtest: alerts are acknowledged per provider and local ISO week
ok 202 - alerts are acknowledged per provider and local ISO week
  ---
  duration_ms: 20.41673
  type: 'test'
  ...
# Subtest: the token lasts across a restart, rotates only explicitly, and whoami proves a nonce
ok 203 - the token lasts across a restart, rotates only explicitly, and whoami proves a nonce
  ---
  duration_ms: 1940.50842
  type: 'test'
  ...
# Subtest: a stale .server never blocks listen and a live server repairs a deleted record before whoami
ok 204 - a stale .server never blocks listen and a live server repairs a deleted record before whoami
  ---
  duration_ms: 98.151589
  type: 'test'
  ...
# Subtest: stop treats a refused connection as no viewer even when stale information remains
ok 205 - stop treats a refused connection as no viewer even when stale information remains
  ---
  duration_ms: 50.863318
  type: 'test'
  ...
# Subtest: serving origin is accepted for PUT and drives the bookmark URL
ok 206 - serving origin is accepted for PUT and drives the bookmark URL
  ---
  duration_ms: 169.554874
  type: 'test'
  ...
# Subtest: two simultaneous first starts end with one .token
ok 207 - two simultaneous first starts end with one .token
  ---
  duration_ms: 199.028104
  type: 'test'
  ...
# Subtest: simultaneous delayed listeners elect one server and print one token
ok 208 - simultaneous delayed listeners elect one server and print one token
  ---
  duration_ms: 702.334979
  type: 'test'
  ...
# Subtest: SIGKILL leaves stale .server and the next start listens immediately
ok 209 - SIGKILL leaves stale .server and the next start listens immediately
  ---
  duration_ms: 403.74992
  type: 'test'
  ...
# Subtest: a plain foreign listener makes --open refuse without signalling it
ok 210 - a plain foreign listener makes --open refuse without signalling it
  ---
  duration_ms: 2201.802954
  type: 'test'
  ...
# Subtest: a copied start id with a made-up pid and no proof is foreign
ok 211 - a copied start id with a made-up pid and no proof is foreign
  ---
  duration_ms: 105.090778
  type: 'test'
  ...
# Subtest: /whoami supplies pid and code, and proof only for a nonce
ok 212 - /whoami supplies pid and code, and proof only for a nonce
  ---
  duration_ms: 140.107903
  type: 'test'
  ...
# Subtest: stopping refuses a mismatched .server pid
ok 213 - stopping refuses a mismatched .server pid
  ---
  duration_ms: 225.878655
  type: 'test'
  ...
# Subtest: --stop exits 1 against a foreign listener
ok 214 - --stop exits 1 against a foreign listener
  ---
  duration_ms: 2177.616612
  type: 'test'
  ...
# Subtest: --stop waits five seconds then fails when the server ignores SIGTERM
ok 215 - --stop waits five seconds then fails when the server ignores SIGTERM
  ---
  duration_ms: 7057.804915
  type: 'test'
  ...
# Subtest: --stop --if-stale keeps current code and stops a changed server copy
ok 216 - --stop --if-stale keeps current code and stops a changed server copy
  ---
  duration_ms: 1772.424693
  type: 'test'
  ...
# Subtest: an older server is stopped only by --stop and every other command gives the upgrade message
ok 217 - an older server is stopped only by --stop and every other command gives the upgrade message
  ---
  duration_ms: 668.282393
  type: 'test'
  ...
# Subtest: a proof-valid pre-prefix holder is stopped only by stop and every other command reports the upgrade
ok 218 - a proof-valid pre-prefix holder is stopped only by stop and every other command reports the upgrade
  ---
  duration_ms: 731.553619
  type: 'test'
  ...
# Subtest: a no-proof pre-prefix holder stops only with its matching server start id and open refuses it
ok 219 - a no-proof pre-prefix holder stops only with its matching server start id and open refuses it
  ---
  duration_ms: 409.337186
  type: 'test'
  ...
# Subtest: a proof-valid pre-prefix holder without a pid is not ours and open does not signal it
ok 220 - a proof-valid pre-prefix holder without a pid is not ours and open does not signal it
  ---
  duration_ms: 161.443064
  type: 'test'
  ...
# Subtest: --service takes over an open server without changing port or token
ok 221 - --service takes over an open server without changing port or token
  ---
  duration_ms: 1761.54817
  type: 'test'
  ...
# Subtest: --service gives up after three takeovers
ok 222 - --service gives up after three takeovers
  ---
  duration_ms: 2078.068247
  type: 'test'
  ...
# Subtest: a post-bind .server rename failure rolls back listener and record
ok 223 - a post-bind .server rename failure rolls back listener and record
  ---
  duration_ms: 78.089629
  type: 'test'
  ...
# Subtest: --open waits a closing server out and succeeds
ok 224 - --open waits a closing server out and succeeds
  ---
  duration_ms: 1650.407948
  type: 'test'
  ...
# Subtest: only localhost and served origins write, and serve false prints localhost
ok 225 - only localhost and served origins write, and serve false prints localhost
  ---
  duration_ms: 157.995541
  type: 'test'
  ...
# Subtest: --url never listens and reports the running token after a timed-out rotation
ok 226 - --url never listens and reports the running token after a timed-out rotation
  ---
  duration_ms: 7231.157473
  type: 'test'
  ...
# Subtest: --rotate-token refuses an old-version holder and leaves it running
ok 227 - --rotate-token refuses an old-version holder and leaves it running
  ---
  duration_ms: 70.964793
  type: 'test'
  ...
# Subtest: --register-plan retries a silent holder until it registers through it
ok 228 - --register-plan retries a silent holder until it registers through it
  ---
  duration_ms: 688.11943
  type: 'test'
  ...
# Subtest: --rotate-token waits for shutdown and leaves .server removal to the server
ok 229 - --rotate-token waits for shutdown and leaves .server removal to the server
  ---
  duration_ms: 257.297527
  type: 'test'
  ...
# Subtest: --rotate-token prints the new prefixed bookmark for a current server
ok 230 - --rotate-token prints the new prefixed bookmark for a current server
  ---
  duration_ms: 1757.836317
  type: 'test'
  ...
# Subtest: shutdown releases the port before it removes only its own .server record
ok 231 - shutdown releases the port before it removes only its own .server record
  ---
  duration_ms: 144.200983
  type: 'test'
  ...
# Subtest: --stop leaves .server removal to the exiting server
ok 232 - --stop leaves .server removal to the exiting server
  ---
  duration_ms: 234.464912
  type: 'test'
  ...
# Subtest: a starter that loses the freed port registers through the new holder
ok 233 - a starter that loses the freed port registers through the new holder
  ---
  duration_ms: 2290.044522
  type: 'test'
  ...
# Subtest: frontmatter, headings, tables and lists parse as the document page expects
ok 234 - frontmatter, headings, tables and lists parse as the document page expects
  ---
  duration_ms: 5.016592
  type: 'test'
  ...
# Subtest: a semicolon key reaches the pane only as backslash-semicolon
ok 235 - a semicolon key reaches the pane only as backslash-semicolon
  ---
  duration_ms: 755.172804
  type: 'test'
  ...
# Subtest: the sessions response marks the hub entry whatever name it is registered under
ok 236 - the sessions response marks the hub entry whatever name it is registered under
  ---
  duration_ms: 281.702047
  type: 'test'
  ...
# Subtest: open, show, and register-plan use the server registration writer
ok 237 - open, show, and register-plan use the server registration writer
  ---
  duration_ms: 677.894481
  type: 'test'
  ...
# Subtest: register rejects unsigned, stale, foreign-origin, and out-of-scope paths
ok 238 - register rejects unsigned, stale, foreign-origin, and out-of-scope paths
  ---
  duration_ms: 213.26923
  type: 'test'
  ...
# Subtest: a refused POST /register leaves .registered and .plans byte-identical
ok 239 - a refused POST /register leaves .registered and .plans byte-identical
  ---
  duration_ms: 141.902655
  type: 'test'
  ...
# Subtest: commands reuse a proven server and register without exposing its token
ok 240 - commands reuse a proven server and register without exposing its token
  ---
  duration_ms: 337.668503
  type: 'test'
  ...
# Subtest: --register-plan is best effort and never starts a server
ok 241 - --register-plan is best effort and never starts a server
  ---
  duration_ms: 2134.445529
  type: 'test'
  ...
# Subtest: --open records the caller tmux session, while a missing tmux records null
ok 242 - --open records the caller tmux session, while a missing tmux records null
  ---
  duration_ms: 543.568448
  type: 'test'
  ...
# Subtest: a failing tmux lookup records a null session
ok 243 - a failing tmux lookup records a null session
  ---
  duration_ms: 385.073407
  type: 'test'
  ...
# Subtest: twenty concurrent opens all land in the running server registry
ok 244 - twenty concurrent opens all land in the running server registry
  ---
  duration_ms: 748.944127
  type: 'test'
  ...
# Subtest: simultaneous first opens register their own paths and a later plan
ok 245 - simultaneous first opens register their own paths and a later plan
  ---
  duration_ms: 2028.121694
  type: 'test'
  ...
# Subtest: a failed listener never changes either pre-existing list
ok 246 - a failed listener never changes either pre-existing list
  ---
  duration_ms: 2129.169427
  type: 'test'
  ...
# Subtest: a plan first graph creates its missing graphs directory and registers
ok 247 - a plan first graph creates its missing graphs directory and registers
  ---
  duration_ms: 138.701305
  type: 'test'
  ...
# Subtest: show signs watching without sending the token
ok 248 - show signs watching without sending the token
  ---
  duration_ms: 194.61507
  type: 'test'
  ...
# Subtest: a port thief after proof receives a signature but never the token
ok 249 - a port thief after proof receives a signature but never the token
  ---
  duration_ms: 3355.534496
  type: 'test'
  ...
# Subtest: show overwrites open session and harness metadata with its own environment
ok 250 - show overwrites open session and harness metadata with its own environment
  ---
  duration_ms: 336.748547
  type: 'test'
  ...
# Subtest: open and show print token-free prefixed graph URLs, while show opens the token link and url prints the bookmark
ok 251 - open and show print token-free prefixed graph URLs, while show opens the token link and url prints the bookmark
  ---
  duration_ms: 431.489264
  type: 'test'
  ...
# Subtest: the nearest codex process wins over inherited CLAUDECODE and a claude ancestor
ok 252 - the nearest codex process wins over inherited CLAUDECODE and a claude ancestor
  ---
  duration_ms: 207.845797
  type: 'test'
  ...
# Subtest: registration rejects every out-of-scope plan and graph path before open reaches a port
ok 253 - registration rejects every out-of-scope plan and graph path before open reaches a port
  ---
  duration_ms: 218.820998
  type: 'test'
  ...
# Subtest: a registered graph replaced by an external symlink is refused on GET and PUT
ok 254 - a registered graph replaced by an external symlink is refused on GET and PUT
  ---
  duration_ms: 115.431282
  type: 'test'
  ...
# Subtest: register-plan has a two-second no-server grace and remains zero for bad paths
ok 255 - register-plan has a two-second no-server grace and remains zero for bad paths
  ---
  duration_ms: 2158.077762
  type: 'test'
  ...
# Subtest: pruning uses the newer graph mtime and added, and the newest plan markdown mtime
ok 256 - pruning uses the newer graph mtime and added, and the newest plan markdown mtime
  ---
  duration_ms: 145.296956
  type: 'test'
  ...
# Subtest: /list groups and orders opened graphs, marks ended sessions, quotes attach commands, and skips absent children
ok 257 - /list groups and orders opened graphs, marks ended sessions, quotes attach commands, and skips absent children
  ---
  duration_ms: 320.096639
  type: 'test'
  ...
# Subtest: /plan lists Markdown at every depth in byte order and refuses an unregistered directory
ok 258 - /plan lists Markdown at every depth in byte order and refuses an unregistered directory
  ---
  duration_ms: 288.46076
  type: 'test'
  ...
# Subtest: /doc returns 404 for non-Markdown files, parent paths, and a symlink leading outside its plan
ok 259 - /doc returns 404 for non-Markdown files, parent paths, and a symlink leading outside its plan
  ---
  duration_ms: 312.353048
  type: 'test'
  ...
# Subtest: /wheelchair/docs and list have CSP while a graph page keeps the index page header-free
ok 260 - /wheelchair/docs and list have CSP while a graph page keeps the index page header-free
  ---
  duration_ms: 247.277829
  type: 'test'
  ...
# Subtest: an app page carries font-src self and the font route serves only the allowlist
ok 261 - an app page carries font-src self and the font route serves only the allowlist
  ---
  duration_ms: 148.112136
  type: 'test'
  ...
# Subtest: /assets/list.js needs no token and other asset names are 404
ok 262 - /assets/list.js needs no token and other asset names are 404
  ---
  duration_ms: 91.545889
  type: 'test'
  ...
# Subtest: every other route requires a token while /whoami remains available
ok 263 - every other route requires a token while /whoami remains available
  ---
  duration_ms: 104.984405
  type: 'test'
  ...
# Subtest: a page changed on disk is served changed without restarting the server
ok 264 - a page changed on disk is served changed without restarting the server
  ---
  duration_ms: 100.579686
  type: 'test'
  ...
# Subtest: list-build pruning writes only when it removes entries and never rewrites again within an hour
ok 265 - list-build pruning writes only when it removes entries and never rewrites again within an hour
  ---
  duration_ms: 159.372824
  type: 'test'
  ...
# Subtest: GET /wheelchair/?token redirects without the token and sets the remember cookie attributes
ok 266 - GET /wheelchair/?token redirects without the token and sets the remember cookie attributes
  ---
  duration_ms: 98.862873
  type: 'test'
  ...
# Subtest: a remember cookie reads the page, list, plan, document, and graph
ok 267 - a remember cookie reads the page, list, plan, document, and graph
  ---
  duration_ms: 215.07295
  type: 'test'
  ...
# Subtest: JSON reads accept token directly and never set a remember cookie
ok 268 - JSON reads accept token directly and never set a remember cookie
  ---
  duration_ms: 352.861874
  type: 'test'
  ...
# Subtest: a wrong page token redirects with a valid cookie, but otherwise gets the sign-in page
ok 269 - a wrong page token redirects with a valid cookie, but otherwise gets the sign-in page
  ---
  duration_ms: 170.769023
  type: 'test'
  ...
# Subtest: wrong cookies and cookies from before a rotation are refused
ok 270 - wrong cookies and cookies from before a rotation are refused
  ---
  duration_ms: 2097.228345
  type: 'test'
  ...
# Subtest: a remember cookie is not a token, header token, or registration key
ok 271 - a remember cookie is not a token, header token, or registration key
  ---
  duration_ms: 243.996225
  type: 'test'
  ...
# Subtest: PUT graph and view accept a remember cookie only from a permitted origin
ok 272 - PUT graph and view accept a remember cookie only from a permitted origin
  ---
  duration_ms: 226.279033
  type: 'test'
  ...
# Subtest: PUT /wheelchair/graph accepts a remember cookie only from a permitted origin
ok 273 - PUT /wheelchair/graph accepts a remember cookie only from a permitted origin
  ---
  duration_ms: 201.444278
  type: 'test'
  ...
# Subtest: root routes move to /wheelchair and /wheelchair gains its trailing slash
ok 274 - root routes move to /wheelchair and /wheelchair gains its trailing slash
  ---
  duration_ms: 149.731211
  type: 'test'
  ...
# Subtest: page responses renew the Lax cookie while JSON responses do not, and anonymous pages explain sign-in
ok 275 - page responses renew the Lax cookie while JSON responses do not, and anonymous pages explain sign-in
  ---
  duration_ms: 188.378939
  type: 'test'
  ...
# Subtest: an anonymous JSON route returns a JSON 401 error
ok 276 - an anonymous JSON route returns a JSON 401 error
  ---
  duration_ms: 150.674089
  type: 'test'
  ...
# Subtest: diagram readers restrict registered graph files and preserve forms and sandbox HTML
ok 277 - diagram readers restrict registered graph files and preserve forms and sandbox HTML
  ---
  duration_ms: 308.617442
  type: 'test'
  ...
# Subtest: legacy canonical bytes remain unchanged, while a run graph writes its explicit fields
ok 278 - legacy canonical bytes remain unchanged, while a run graph writes its explicit fields
  ---
  duration_ms: 374.742302
  type: 'test'
  ...
# Subtest: run validation refuses each new schema violation
ok 279 - run validation refuses each new schema violation
  ---
  duration_ms: 1424.85252
  type: 'test'
  ...
# Subtest: agent progress preserves ruled entries and the page may not change it
ok 280 - agent progress preserves ruled entries and the page may not change it
  ---
  duration_ms: 166.120887
  type: 'test'
  ...
# Subtest: run and plain chain layouts keep their respective axes and spacing
ok 281 - run and plain chain layouts keep their respective axes and spacing
  ---
  duration_ms: 375.970778
  type: 'test'
  ...
# Subtest: a task-only run update keeps every position, including a drag
ok 282 - a task-only run update keeps every position, including a drag
  ---
  duration_ms: 275.462019
  type: 'test'
  ...
# Subtest: a progress-only write keeps a dragged position, and an added edge lays the picture out again
ok 283 - a progress-only write keeps a dragged position, and an added edge lays the picture out again
  ---
  duration_ms: 262.426085
  type: 'test'
  ...
# Subtest: rollups, nesting, updated, and the list run path follow run-picture rules
ok 284 - rollups, nesting, updated, and the list run path follow run-picture rules
  ---
  duration_ms: 497.455471
  type: 'test'
  ...
# Subtest: run nesting and reserved names are refused on registered paths
ok 285 - run nesting and reserved names are refused on registered paths
  ---
  duration_ms: 535.944815
  type: 'test'
  ...
# Subtest: canonical round-trip canonicalizes byte-for-byte
ok 286 - canonical round-trip canonicalizes byte-for-byte
  ---
  duration_ms: 446.41824
  type: 'test'
  ...
# Subtest: explanation written through /graph is retained on disk in canonical order
ok 287 - explanation written through /graph is retained on disk in canonical order
  ---
  duration_ms: 167.569065
  type: 'test'
  ...
# Subtest: groups canonicalize member lists, order, and byte round-trip
ok 288 - groups canonicalize member lists, order, and byte round-trip
  ---
  duration_ms: 179.784464
  type: 'test'
  ...
# Subtest: visible groups round-trip without explanation references
ok 289 - visible groups round-trip without explanation references
  ---
  duration_ms: 159.583587
  type: 'test'
  ...
# Subtest: groups default on writes and reads of legacy disk files
ok 290 - groups default on writes and reads of legacy disk files
  ---
  duration_ms: 136.043166
  type: 'test'
  ...
# Subtest: groups refuse malformed claims and unmatched explanation references
ok 291 - groups refuse malformed claims and unmatched explanation references
  ---
  duration_ms: 189.027473
  type: 'test'
  ...
# Subtest: ordinary markdown links in explanations do not require groups
ok 292 - ordinary markdown links in explanations do not require groups
  ---
  duration_ms: 128.106394
  type: 'test'
  ...
# Subtest: explanation accepts only strings or null
ok 293 - explanation accepts only strings or null
  ---
  duration_ms: 108.604859
  type: 'test'
  ...
# Subtest: agent prose refuses positional claims in explanations and groups
ok 294 - agent prose refuses positional claims in explanations and groups
  ---
  duration_ms: 219.37467
  type: 'test'
  ...
# Subtest: quoted spans mask positional claims without masking apostrophes or stray delimiters
ok 295 - quoted spans mask positional claims without masking apostrophes or stray delimiters
  ---
  duration_ms: 392.132657
  type: 'test'
  ...
# Subtest: positional claims leave the downhill vocabulary, node text, and page reads alone
ok 296 - positional claims leave the downhill vocabulary, node text, and page reads alone
  ---
  duration_ms: 518.565922
  type: 'test'
  ...
# Subtest: self edges are refused after missing endpoints
ok 297 - self edges are refused after missing endpoints
  ---
  duration_ms: 188.743479
  type: 'test'
  ...
# Subtest: both write routes enforce their distinct authority
ok 298 - both write routes enforce their distinct authority
  ---
  duration_ms: 255.158515
  type: 'test'
  ...
# Subtest: /view cannot alter explanation
ok 299 - /view cannot alter explanation
  ---
  duration_ms: 208.931189
  type: 'test'
  ...
# Subtest: /view cannot alter groups and accepts an untouched deep clone
ok 300 - /view cannot alter groups and accepts an untouched deep clone
  ---
  duration_ms: 285.87475
  type: 'test'
  ...
# Subtest: optimistic concurrency returns and accepts the current hash, including create
ok 301 - optimistic concurrency returns and accepts the current hash, including create
  ---
  duration_ms: 575.024732
  type: 'test'
  ...
# Subtest: an agent create cannot pre-rule entries or claim a reset record
ok 302 - an agent create cannot pre-rule entries or claim a reset record
  ---
  duration_ms: 318.687757
  type: 'test'
  ...
# Subtest: node and edge kinds are closed sets while omitted kinds default
ok 303 - node and edge kinds are closed sets while omitted kinds default
  ---
  duration_ms: 384.515407
  type: 'test'
  ...
# Subtest: the global write lock serializes concurrent writes and retry retains both changes
ok 304 - the global write lock serializes concurrent writes and retry retains both changes
  ---
  duration_ms: 248.568325
  type: 'test'
  ...
# Subtest: agent preservation protects agreed and rejected entries
ok 305 - agent preservation protects agreed and rejected entries
  ---
  duration_ms: 198.163326
  type: 'test'
  ...
# Subtest: PUT /graph ignores every supplied position and lays every node out again
ok 306 - PUT /graph ignores every supplied position and lays every node out again
  ---
  duration_ms: 200.852844
  type: 'test'
  ...
# Subtest: a create is deterministic, keeps group-less layout intact, and permits matching group and node ids
ok 307 - a create is deterministic, keeps group-less layout intact, and permits matching group and node ids
  ---
  duration_ms: 669.992645
  type: 'test'
  ...
# Subtest: visible groups occupy units, preserve their rows, and leave every outsider clear
ok 308 - visible groups occupy units, preserve their rows, and leave every outsider clear
  ---
  duration_ms: 164.969498
  type: 'test'
  ...
# Subtest: a wide group’s real right edge clears the next disconnected component
ok 309 - a wide group’s real right edge clears the next disconnected component
  ---
  duration_ms: 223.023298
  type: 'test'
  ...
# Subtest: global variable rows align disconnected components and use a tall group’s real edge
ok 310 - global variable rows align disconnected components and use a tall group’s real edge
  ---
  duration_ms: 180.721712
  type: 'test'
  ...
# Subtest: the third pass keeps an arrow-less member’s middle first-pass slot
ok 311 - the third pass keeps an arrow-less member’s middle first-pass slot
  ---
  duration_ms: 218.514941
  type: 'test'
  ...
# Subtest: parallel arrows do not weight a third-pass median twice, and quotient loops still write
ok 312 - parallel arrows do not weight a third-pass median twice, and quotient loops still write
  ---
  duration_ms: 384.914762
  type: 'test'
  ...
# Subtest: the third pass deduplicates endpoint pairs before it counts external crossings
ok 313 - the third pass deduplicates endpoint pairs before it counts external crossings
  ---
  duration_ms: 182.516675
  type: 'test'
  ...
# Subtest: the third pass keeps the first pass’s crossing count on an internal counter-example
ok 314 - the third pass keeps the first pass’s crossing count on an internal counter-example
  ---
  duration_ms: 259.434115
  type: 'test'
  ...
# Subtest: the third pass keys a member on every neighbour, including members of its group
ok 315 - the third pass keys a member on every neighbour, including members of its group
  ---
  duration_ms: 196.584587
  type: 'test'
  ...
# Subtest: the third pass gives internal and external neighbours equal weight in its median
ok 316 - the third pass gives internal and external neighbours equal weight in its median
  ---
  duration_ms: 152.690296
  type: 'test'
  ...
# Subtest: the third pass freezes other groups before it walks either group
ok 317 - the third pass freezes other groups before it walks either group
  ---
  duration_ms: 199.387554
  type: 'test'
  ...
# Subtest: a bend point reserves its own pitch, so a multi-row arrow lays out unchanged
ok 318 - a bend point reserves its own pitch, so a multi-row arrow lays out unchanged
  ---
  duration_ms: 247.136499
  type: 'test'
  ...
# Subtest: a unit shorter than its row sits on the row line rather than centred in it
ok 319 - a unit shorter than its row sits on the row line rather than centred in it
  ---
  duration_ms: 150.345328
  type: 'test'
  ...
# Subtest: the third pass reads earlier group-mates live as it walks a row
ok 320 - the third pass reads earlier group-mates live as it walks a row
  ---
  duration_ms: 213.272746
  type: 'test'
  ...
# Subtest: the third pass leaves a group rectangle and member rows at their first-pass values
ok 321 - the third pass leaves a group rectangle and member rows at their first-pass values
  ---
  duration_ms: 429.311017
  type: 'test'
  ...
# Subtest: verdict reversal is page-only and agents reset agreed entries explicitly
ok 322 - verdict reversal is page-only and agents reset agreed entries explicitly
  ---
  duration_ms: 256.322818
  type: 'test'
  ...
# Subtest: bulk verdicts are additive and one reversal is permitted
ok 323 - bulk verdicts are additive and one reversal is permitted
  ---
  duration_ms: 183.610452
  type: 'test'
  ...
# Subtest: retargeting and dropping a container preserve verdict-bearing children
ok 324 - retargeting and dropping a container preserve verdict-bearing children
  ---
  duration_ms: 166.170602
  type: 'test'
  ...
# Subtest: container removal accepts proposed-only child and recursively finds grandchild verdicts
ok 325 - container removal accepts proposed-only child and recursively finds grandchild verdicts
  ---
  duration_ms: 345.848572
  type: 'test'
  ...
# Subtest: all containment retarget cases, cycles, deep acyclic writes, and missing children follow the contract
ok 326 - all containment retarget cases, cycles, deep acyclic writes, and missing children follow the contract
  ---
  duration_ms: 520.858318
  type: 'test'
  ...
# Subtest: retargeting away unregisters a derivable child and unreadable children block removal
ok 327 - retargeting away unregisters a derivable child and unreadable children block removal
  ---
  duration_ms: 261.501762
  type: 'test'
  ...
# Subtest: whoami is unauthenticated identity, never a mutation credential
ok 328 - whoami is unauthenticated identity, never a mutation credential
  ---
  duration_ms: 95.241677
  type: 'test'
  ...
# Subtest: --show opens a browser once, and never while a tab is already on that graph
ok 329 - --show opens a browser once, and never while a tab is already on that graph
  ---
  duration_ms: 1773.697776
  type: 'test'
  ...
# Subtest: two starts at the same instant leave one server, and the loser reuses it rather than dying
ok 330 - two starts at the same instant leave one server, and the loser reuses it rather than dying
  ---
  duration_ms: 4523.913633
  type: 'test'
  ...
# Subtest: listen-first startup reuses the port holder and ignores stale .server information
ok 331 - listen-first startup reuses the port holder and ignores stale .server information
  ---
  duration_ms: 1942.926873
  type: 'test'
  ...
# Subtest: the token is published atomically while independent ports can start
ok 332 - the token is published atomically while independent ports can start
  ---
  duration_ms: 222.040563
  type: 'test'
  ...
# Subtest: GET change detection exposes agent hashes and preserves the page write hash
ok 333 - GET change detection exposes agent hashes and preserves the page write hash
  ---
  duration_ms: 181.050623
  type: 'test'
  ...
# Subtest: a kill before rename leaves the committed graph as either whole version, never a partial write
ok 334 - a kill before rename leaves the committed graph as either whole version, never a partial write
  ---
  duration_ms: 6892.347707
  type: 'test'
  ...
# Subtest: registered paths are pruned by age at startup
ok 335 - registered paths are pruned by age at startup
  ---
  duration_ms: 86.772844
  type: 'test'
  ...
# Subtest: agent reset records are durable and page verdicts clear them only while changing origin
ok 336 - agent reset records are durable and page verdicts clear them only while changing origin
  ---
  duration_ms: 151.478031
  type: 'test'
  ...
# Subtest: malformed on-disk graphs refuse without repair
ok 337 - malformed on-disk graphs refuse without repair
  ---
  duration_ms: 458.085165
  type: 'test'
  ...
# Subtest: layout runs downhill: an arrow never points back up the page
ok 338 - layout runs downhill: an arrow never points back up the page
  ---
  duration_ms: 106.463411
  type: 'test'
  ...
# Subtest: layout places every component, including a disconnected two-cycle
ok 339 - layout places every component, including a disconnected two-cycle
  ---
  duration_ms: 132.606825
  type: 'test'
  ...
# Subtest: cache-root isolation never changes the live default cache
ok 340 - cache-root isolation never changes the live default cache
  ---
  duration_ms: 165.454929
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
# duration_ms 56715.304692

```

## Choices

none
