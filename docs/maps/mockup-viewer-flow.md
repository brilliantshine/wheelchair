# Map: mockup cards, pictures and feedback

Checked against: `25f34a4572c4beb9032f16f818b6502cc59f62bd` (origin/main).
Files covered: `viewer/pages/thread.js`, `viewer/pages/thread.css`, `viewer/pages/diagram.js`, `viewer/pages/picture.js`, `viewer/pages/picture.css`, `viewer/pages/picture-export.js`, `viewer/pages/nav.js`, `viewer/app/routes.js`, `viewer/app/threads.js`, `viewer/app/sessions.js`, `protocol/app/designer.md`, `protocol/app/lead.md`, `viewer/test/app-mockups.spec.js`, `viewer/test/app-picture-download.spec.js`, `viewer/test/app-diagrams-uploads.spec.js`.

```text
chat poll -> signature changes -> rebuild cards -> create and fit mockup iframes -> restore bottom if near it
card open -> picture page -> sandboxed true-size mockup -> HTML download
card press -> hub validates action -> lead queue -> machine submits after turn
lead feedback -> designer message -> revised version -> result -> lead posts mockup
```

## Thread and likely reload cause

The visible tab polls chat every two seconds; a hidden tab pauses and refreshes on return (`viewer/pages/thread.js:8,1495-1506,1598`; `viewer/pages/nav.js:3-14`). The signature includes all items, cards, pins and other state; unchanged signatures avoid chat redraws, while active text selection defers most redraws (`viewer/pages/thread.js:1467-1476`). On a change, `renderChat` clears the entire chat and reconstructs all cards in time order (`viewer/pages/thread.js:603-605,622-637`). Both diagram and Built/Mockup cards create new mockup frames when rebuilt (`viewer/pages/thread.js:1205-1212,1215-1234`; `viewer/pages/diagram.js:72-78,90-97`).

**Most likely cause of the reported flash/reload and jumping:** every new card changes `data.cards` in the chat signature, which destroys and recreates every existing iframe and reloads its source. This also removes the existing scroll anchor; the only explicit restoration scrolls to the new bottom if the page was within 80px of the bottom before the rebuild (`viewer/pages/thread.js:605,630,1467,1472-1476,1484`). There is no explicit position restoration for a reader higher up in this path. Each fresh mockup begins inside a detached card, so the initial fit can see zero width and return; its `ResizeObserver` later scales to `min(1, box width / design width)` and sets height, changing layout after insertion (`viewer/pages/diagram.js:79-86`; `viewer/pages/thread.css:349-351`). This is a source-based diagnosis, not a live reproduction or proof of every observed scroll; browser anchoring and asynchronous iframe/image loading may affect the visible result.

## Picture and export

The mockup source is the registered worktree HTML or the archived thread HTML route (`viewer/pages/diagram.js:12-19`). A full-size mockup uses a fixed-dimension empty-sandbox iframe inside an overflow-auto picture body, and its Download link requests HTML (`viewer/pages/picture.js:61-79`; `viewer/pages/picture.css:8,12`). The iframe sandbox and HTML response CSP both restrict content; the latter includes `sandbox`, disallows scripts and network content, and allows inline styles and data images/fonts (`viewer/pages/picture.js:75`; `viewer/app/routes.js:21-22`). Parent access to the mockup document is consequently not the same as graph export's iframe document access; PNG needs a rendering approach compatible with this boundary.

Graph export obtains the iframe document, clones and styles SVG, removes its view transform and draws it to a canvas; form export draws the fetched form value. Both save canvas PNG via a blob URL (`viewer/pages/picture.js:35-58,83-88`; `viewer/pages/picture-export.js:20-30,35-76`). The Built link currently opens the raw file URL in a new tab, and its inline image links there too; it does not use the picture page (`viewer/pages/thread.js:1217-1227`). The picture page selects only diagrams or image cards with a mockup and treats the latter as the mockup, so there is no Built image case yet (`viewer/pages/picture.js:61-75`).

## Feedback and session delivery

The page posts `{action,value}` to the card press route (`viewer/pages/thread.js:794-810`; `viewer/app/routes.js:695-696`). The hub checks the card, accepts a fixed set of press actions, marks most answered, and queues a `[card id]` message to the latest live lead, not a designer (`viewer/app/threads.js:324-329,401-426,439-440`). Composer messages also go to the latest live lead (`viewer/app/routes.js:682-690`). A direct designer comment therefore needs an explicit recipient and delivery contract; merely reusing the existing press or message route targets the lead and may mark the card answered. A queue is saved and delivered only when the target is live, ready, turn-ended and not held; machine submission must succeed before dequeue (`viewer/app/sessions.js:498-510,514-545`). A finished designer is reopened specifically for a session message from its starter (`viewer/app/sessions.js:547-548`), which matters for any direct-user delivery design.

The designer writes versioned static HTML at specified dimensions, renders and inspects it, then waits for lead revision messages (`protocol/app/designer.md:25-41`). The lead posts results as mockup cards, passes the user's words verbatim, and stops the designer after agreement; after building starts design changes go to a dependent stub (`protocol/app/lead.md:830-843,855-861`).

## Existing browser coverage

`viewer/test/app-mockups.spec.js:33-54,61-99,123-130` checks inline fit, true-size scrolling, the pair and stacking; its full-size test expects no automatic download, not PNG export. `viewer/test/app-picture-download.spec.js:60-70,114-130,133-139` exercises graph and form PNGs and displayed-version behavior. `viewer/test/app-diagrams-uploads.spec.js:31-45,79-89` covers HTML isolation and image/archive updates. These referenced tests do not establish scroll stability during a new card, coordinate comments, Built true-size phone behavior, or mockup PNG output.

## What I did not look at

Live reproduction, browser-specific scroll anchoring, screenshot/rasterization libraries or implementations, all card validation and transcript parsing paths, and remote deployment behavior. No application tests were run for this documentation-only map.
