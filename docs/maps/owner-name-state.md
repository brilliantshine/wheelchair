# Map: owner identifiers in thread state and handoff

Checked against: `ea9506df5175d5c81a8303229d3c2dd4502fe678` (origin/main and worktree HEAD)
Files covered: `viewer/app/threads.js`, `viewer/app/sessions.js`, `viewer/app/state.js`, `viewer/app/handoff.js`, `viewer/app/handoff-import.js`, `viewer/app/handoff-ops.js`, `viewer/app/routes.js`, `viewer/app/asides.js`, `viewer/app/cards.js`, `viewer/app/agents.js`, `viewer/app/API.md`, `viewer/pages/thread.js`, `viewer/pages/threads.js`, `viewer/pages/agents.js`.

```text
user message or card press -> queue and timestamp -> thread JSON / sent JSONL
                                        -> lists and thread page
sent records + imported history -> version 1 handoff -> validate -> import -> display
```

Messages enter via initial thread, send route and aside (`viewer/app/threads.js:79`, `viewer/app/routes.js:531`, `viewer/app/asides.js:62`) with `source: 'collin'`. Enqueue stamps `collin_at` and saves queues (`viewer/app/sessions.js:469`); delivery stores source in bounded `sent` and spills older entries to JSONL (`viewer/app/sessions.js:528`). Restart context filters those sources (`viewer/app/threads.js:145`); send-now also matches them (`viewer/app/sessions.js:542`), as does the pending bubble (`viewer/pages/thread.js:436`, `viewer/pages/thread.js:504`). Card presses and dismissal update the timestamp and resolve cards under that identifier (`viewer/app/threads.js:325`, `viewer/app/threads.js:329`, `viewer/app/threads.js:402`, `viewer/app/threads.js:420`; `viewer/app/cards.js:39`); archive does too (`viewer/app/threads.js:244`). The thread page uses the resolved value for its label (`viewer/pages/thread.js:580`); the API documents it (`viewer/app/API.md:22`, `viewer/app/API.md:62`).

State defaults to the runtime home (`viewer/app/state.js:9`); thread JSON and append-only sent JSONL are siblings (`viewer/app/state.js:84`, `viewer/app/state.js:91`) and saves serialize the whole thread (`viewer/app/state.js:113`). Lists and agent views sort/display by the timestamp with created-at fallback (`viewer/pages/threads.js:38`, `viewer/pages/threads.js:74`, `viewer/pages/agents.js:139`, `viewer/app/agents.js:63`). A rename must account for existing queues, duplicate queue references, sent JSON and spilled JSONL, timestamps, resolved cards and any imported history, or retain readers for old values. Simply renaming writers makes old pending items and times invisible to these readers.

Handoff exports user messages and presses as `who: 'collin'` (`viewer/app/handoff.js:59`), copies prior imported history, and emits format version 1 (`viewer/app/handoff.js:71`). Its strict validator accepts only `collin`, `lead`, `app` (`viewer/app/handoff.js:18`, `viewer/app/handoff.js:29`); import validates before creating or advancing (`viewer/app/handoff-import.js:13`, `viewer/app/handoff-import.js:64`), and the page prints `who` literally (`viewer/pages/thread.js:231`). A new value under version 1 is rejected by old readers; compatibility requires an explicit read/write or version strategy in both directions.

Not checked: arbitrary externally edited state, every handoff operation failure path, and third-party consumers of the API or handoff files.
