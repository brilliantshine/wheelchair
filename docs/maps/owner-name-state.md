# Map: owner identifiers in thread state and handoff

Checked against: `1ee9ad1487d2a3f8b6ceda7f73cf7218657f52c2` (origin/main); evidence below is from worktree HEAD `93da28f48e626a19d46cc8c24f0a788c4af7372d`. The only covered-file difference between these commits is `viewer/app/routes.js`; its owner-source line is unchanged.
Files covered: `viewer/app/state.js`, `sessions.js`, `threads.js`, `agents.js`, `asides.js`, `routes.js`, `cards.js`, `handoff.js`, `handoff-import.js`, `handoff-ops.js`, `API.md`; `viewer/pages/thread.js`, `threads.js`, `agents.js`.

```text
user message or card press -> queue and timestamp -> thread JSON -> delivery -> sent JSON / JSONL
                                                             -> restart context and pages
sent records + imported history -> v2 export -> validate v1 or v2 import -> stored history -> page / restart / export
```

New messages and card actions use `user` and stamp `user_at`; queues are mirrored in the session and thread. Thread reads normalize old owner labels in both queues, sent records, cards, pinned cards, imported history and interrupted handoff history. The append-only `sent.jsonl` overflow is unchanged.

Lists order by `user_at` with a creation-time fallback. Restart, pending bubbles and Send now use normalized records; ordinary saves persist the normalized form.

Handoff exports use version 2 and `who: user`. Import accepts version 1 with `who: collin`, converting it to `user`, and version 2 with `who: user`; older installs reject version 2 as an unknown format or version.

JSONL is appended here, but export and restart read `thread.sent`, not the spill, so the spill keeps whatever labels it was written with. Previously downloaded v1 files are not converted on disk; the v1 reader converts them on import.

Not checked: third-party consumers, arbitrary externally edited state, all handoff operation failure paths, or older releases beyond the validator shown here.
