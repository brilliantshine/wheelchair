# Map: Agents screen

Checked against: `dd85af5f2d49c4fc6440a1c450aeaefebdc5ed5f` (origin/main)
Files covered: `viewer/pages/agents.html`, `viewer/pages/agents.js`, `viewer/pages/views.css`, `viewer/test/app-views.spec.js`, `viewer/test/helpers/app-views-setup.js`, `viewer/test/app-agents.test.js`, `viewer/playwright.config.js`, `viewer/package.json`

```text
agents and threads responses -> choose lead and agent from URL -> build sidebar, tree and details
                                                        -> select box -> update URL -> rebuild
                                                        -> five-second refresh -> rebuild
                                                        -> open terminal -> fixed bottom panel
```

The page fetches agents and thread timestamps together on load and every five seconds; `render()` replaces the entire `#agents` subtree, builds the sidebar, main tree and side panel again, but the terminal and brief dialog live outside that subtree (`viewer/pages/agents.js:25-26,28-29,40-54`; `viewer/pages/agents.html:14-20`). A legacy hash becomes `?lead=`, an unavailable requested lead falls back to the first live lead, and `?agent=` selects a node; `go()` pushes URL history and redraws, while browser back invokes render (`viewer/pages/agents.js:18-20,32-39`). A redraw therefore creates a new scroll container; the code does not save or restore its scroll position (`viewer/pages/agents.js:25-26,46-50`).

`branch()` recursively draws 190px button boxes and their children; open asides are non-button boxes appended to the lead's children. Selecting a session invokes `go()`, and live selection changes retarget an open terminal while non-live selection closes it (`viewer/pages/agents.js:37-38,48-51`; `viewer/pages/views.css:134-135`). Desktop uses a three-column grid; main has `overflow:auto`, while the tree has its own horizontal overflow, centers a narrow root and uses non-shrinking branches and connector borders (`viewer/pages/views.css:115,128,132-135,146-149`). The fixed terminal covers the bottom of the main and side columns; its separate pointer-capture resize handle stores height, and full screen is toggled independently (`viewer/pages/views.css:155-157`; `viewer/pages/agents.js:9-16`). Below 900px URL classes switch among lead list, tree and detail views; the tree becomes an indented list and the terminal fills the screen (`viewer/pages/views.css:165-180`).

The browser suite loops desktop and phone viewports; it intercepts `/api/agents` with nested fixtures, checks wide scrolling and narrow centering, phone selection, status and URL selection across refresh, and terminal behavior (`viewer/test/app-views.spec.js:8-19,57-172`). Its setup starts a real isolated server and fake machines, seeds threads and gets the remember cookie (`viewer/test/helpers/app-views-setup.js:68-81,91-97`). Node tests assert the server-side tree's states, hierarchy, waits, aside data and secret filtering, rather than DOM interaction (`viewer/test/app-agents.test.js:20-44,52-103`). `npm --prefix viewer run test:browser` runs Playwright's `*.spec.js` in Chromium and Firefox (`viewer/package.json:8`; `viewer/playwright.config.js:8-16`).

> The covered files changed after the checked-against commit. The lighter-server paths were rechecked against `e4117bdcacf06f2a3c73dd22d8af8d8086cb00e3`; see [lighter-server/MAP.md](../plans/lighter-server/MAP.md). Other claims below retain their historical checked-against commit.

## Session signals and messages

From the agents-activity mapping pass, checked against the same commit. Line numbers predate that feature's own changes.

The page polls agents and thread-list endpoints every five seconds; selection is in URL parameters, `branch` draws the tree, and the selected side panel renders status, duration, model, terminal and brief (`viewer/pages/agents.js:18-22,25-54`). Its bottom terminal mounts shared `TermView`, can retarget, resize, expand and pop out (`viewer/pages/agents.js:7-16,37-38`; `viewer/pages/agents.html:14-19`). The current panel has no activity history or context ring (`viewer/pages/agents.js:51`).

Message cards record sender and recipient, queue text prefixed with sender, and results go to `started_by` (`viewer/app/cards.js:11-20,115-133`). Queue delivery records `to`, `source`, text and time in bounded sent history (`viewer/app/sessions.js:327-336,348-385`). A question posted by a lead has a card author but no structured link to prior messages (`viewer/app/cards.js:11-20,115-116`; `viewer/app/card.js:1-150`).

## What I did not look at

I did not run the browser suite or reproduce the overflow, audit every Agents API and terminal path, or recheck the old map's machine hooks, messaging and provider details. This focused map replaces that older broader map; those topics need a fresh check.
