# Map: thread handoffs

Checked against: `c9c6451819f00556a5d875d42f6a8e462f3eb22a` (origin/main; covered files match this worktree).
Files covered: `viewer/app/handoff.js`, `viewer/app/handoff-import.js`, `viewer/app/handoff-ops.js`, `viewer/app/routes.js`, `viewer/pages/new.js`, `viewer/pages/thread.js`, `machine/service.js`.

```text
quiet eligible thread -> build JSON -> push branch -> freeze and download
file + selected project -> validate and inspect branch -> open, create or advance
create or advance -> claim branch -> carry history into thread -> restart lead
```

Export checks quiet state, clean worktree, stage and repository, builds and validates JSON, pushes the thread branch, saves the file and marks the source handed off (`viewer/app/handoff.js:125`, `:136`, `:149`, `:153`, `:158`, `:161`). The file is version 2 with thread identity, GitHub repository, branch, head, stage, optional PR URL and bounded text history; version 1 is also accepted (`viewer/app/handoff.js:12`, `:18`, `:28`, `:58`, `:73`). It contains no settings or lessons. Lesson cards are also omitted from history: `historyText` has no lesson case and returns null, and the validator's history kinds exclude lesson (`viewer/app/handoff.js:5`, `:35`, `:49`, `:65`). The strict top-level key validation rejects an added lessons field unless the format validator changes (`viewer/app/handoff.js:7`, `:18`).

The New page posts a selected file with machine and project (`viewer/pages/new.js:262`); import validates it and compares the selected project's GitHub repository, remote branch and stage (`viewer/app/handoff-import.js:8`, `:13`, `:34`). Existing same, older or diverged branches open without applying the file; eligible newer files advance a quiet thread, and absent threads are created (`viewer/app/handoff-import.js:43`, `:49`, `:61`). The saved retryable operation carries stage, export time, history and PR URL, claims and updates the branch, stores imported history, retracts old cards on advance, and restarts the lead (`viewer/app/handoff-ops.js:15`, `:93`, `:102`, `:118`; `viewer/app/handoff-import.js:74`). It does not merge settings. Import's chosen project path can differ from the exporting machine's path (`viewer/app/handoff-import.js:9`, `:24`), relevant to project-scoped lessons.

Not looked at: every machine claim/revoke failure branch, browser presentation beyond file selection, or unrelated thread restart and archive flows.
