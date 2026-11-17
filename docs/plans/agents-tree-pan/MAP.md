# Map: panning the Agents tree

```text
five-second fetch -> rebuild tree -> drag or click -> URL selection -> rebuild tree
                         |                             |
                   desktop overflow              terminal overlays bottom
                         |
                   phone indented list
```

The current tree is a recursive DOM flex layout, not the graph viewer's SVG: each session is a button and clicking calls `go()`, which changes `?lead=` / `?agent=` and rebuilds the page; asides are non-selectable boxes (`viewer/pages/agents.js:18-20,25-26,48-50`). The same rebuild happens every five seconds and replaces the scroll element, so any pan or zoom state and an in-progress gesture must account for both refresh and selection redraw (`viewer/pages/agents.js:25-26,53-54`). See [the Agents screen map](../../maps/app-agents-screen.md).

Desktop already scrolls a wide tree horizontally inside `.agents-tree`, while `.agents-main` also has `overflow:auto`; the tree is centered when narrow. The fixed bottom terminal overlays the tree and side panel, and can be resized or made full screen (`viewer/pages/views.css:115,128,132-135,155-157`; `viewer/pages/agents.js:11-16`). Under 900px the tree is an indented list and the URL selects which full-screen level is visible (`viewer/pages/views.css:165-180`). The merged redesign explicitly requires the selectable boxes, polling without losing selection or terminal, phone list, and bottom panel; remediation made wide trees scroll instead of clipping (`docs/plans/agents-screen-redesign/PLAN.md:156-184,322,348`).

The graph viewer has a separate SVG implementation: background mouse alt/middle drag or touch drag captures the pointer and updates translation, while node selection uses a movement threshold and pointer-up because capture can retarget clicks; wheel zoom preserves the point under the pointer (`viewer/index.html:2225-2246,2271-2274,2292-2309,2362-2379`). Its fit calculation operates on graph geometry (`viewer/index.html:805-842`). The picture page embeds that viewer in an iframe for graphs and otherwise uses a scrollable body (`viewer/pages/picture.js:20-22,40-52`; `viewer/pages/picture.css:8-9`). The Agents terminal resize is a smaller pointer-capture example (`viewer/pages/agents.js:15-16`). These are patterns to examine, not a shared pan module for the DOM tree.

Browser tests in `viewer/test/app-views.spec.js` mock the nested agents response over an isolated real server; the wide-tree test manipulates `scrollLeft` directly and checks both edges and narrow centering, while the selection test waits through redraw and checks the terminal (`viewer/test/app-views.spec.js:57-89,107-155`; `viewer/test/helpers/app-views-setup.js:68-81,91-97`). Phone selection is covered separately (`viewer/test/app-views.spec.js:92-105`). Node tests exercise server tree construction (`viewer/test/app-agents.test.js:20-44,99-103`); Playwright runs both Chromium and Firefox (`viewer/playwright.config.js:8-16`). A drag test would need actual pointer gestures in addition to the existing direct-scroll assertion.

## What I did not look at

I did not run tests or reproduce the problem in a browser, inspect every graph gesture edge case, or audit unrelated API and terminal internals.
