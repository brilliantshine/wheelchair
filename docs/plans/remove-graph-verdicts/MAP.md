# Map: remove graph verdicts

The current graph flow and exact source references are in `docs/maps/graph-verdicts.md`; embedded serving and cards are in `docs/maps/viewer-serving.md` and `docs/maps/app-thread-page.md`.

```text
agent -> PUT /graph -> preservation and subtree checks -> graph file
                                                           |
person -> select entries -> approve or reject -> PUT /view -> graph file
                                                           |
planning and implementation -> read verdicts -> decisions and follow-up work
```

Agents cannot grant verdicts or remove rejected entries, and must reset agreed entries before removing them; the server also protects verdicts in child graphs (`viewer/server.js:523-565,586-627`). Browser selection and approval are separate from dragging positions: the same /view route supports both and retries stale writes (`viewer/index.html:498-565,832-872`). Run progress fields are exempt from verdict preservation but still restricted on browser writes (`viewer/server.js:371-383,1500-1512`).

Removing the fields reaches beyond the server and colors: planning's rejected-entry gate, the approved Spec diagram, the older implementation stage's rejected-choice follow-ups and the app lead's graph-page instruction all depend on the verdict model (`protocol/planning.md:87-98,206-211`; `protocol/diagrams.md:84-90`; `protocol/implementation.md:219-229`; `protocol/app/lead.md:364-371`). Browser groups, selection, drag, run status and unrelated HTTP Origin authentication also have independent uses (`viewer/index.html:803-864,135-151,2434-2445`; `viewer/server.js:1422-1434`).

All 37 current plan graph JSON files carry the fields, with 77 agreed and 20 rejected entries. A normalizer that stops recognizing them would drop them on the next canonical write; archived graphs load raw branch JSON and the current page uses origin to select arrow markers (`viewer/server.js:134-160,398-403`; `viewer/app/threads.js:216-229`; `viewer/index.html:1334-1339,1679`). Server, run and browser tests cover the contract as well as use the fields in ordinary fixtures (`viewer/test/server.test.js:509-517,571-584,806-900,1093-1100`; `viewer/test/run.test.js:64-76,130`; `viewer/test/browser.spec.js:439-620,1040-1076,1419-1508,1803-1843`).

## What I did not look at

Individual historical plan intent, external clones or graphs outside the plan JSON glob, every fixture's purpose, and live browser behavior. No tests were run; this is a source and data map.
