# Map: owner-name identifiers

Checked against origin/main `1ee9ad1487d2a3f8b6ceda7f73cf7218657f52c2`; worktree HEAD is `93da28f48e626a19d46cc8c24f0a788c4af7372d`. See `docs/maps/owner-name-state.md` and `docs/maps/owner-name-identifiers-inventory.md` for the traced surfaces and inventory.

```text
message / card action -> queue + timestamp -> thread JSON -> sent JSONL
                                      -> pages / restart / handoff export
old export -> v1 validation -> imported history -> page / restart / next export
```

D1: Existing state uses `collin_at`, message source and card attribution `collin`; queue entries occur in two places and sent records spill from JSON to JSONL (`viewer/app/sessions.js:475`, `viewer/app/sessions.js:480`, `viewer/app/sessions.js:528`, `viewer/app/threads.js:422`). Readers include send-now, pending bubbles, ordering and restart's explicit `asUser` relabel (`viewer/app/sessions.js:542`, `viewer/pages/thread.js:436`, `viewer/pages/threads.js:38`, `viewer/app/threads.js:138`). A local migration or dual readers must cover existing data as well as new writes; already downloaded exports require a separate compatibility path.

The v1 handoff validator accepts only `collin`, `lead`, `app` for history; old installs reject a new value with 422 invalid history, and reject a new version (`viewer/app/handoff.js:19`, `viewer/app/handoff.js:28`, `viewer/app/handoff-import.js:13`). Keeping the old v1 wire value while translating internally preserves that older reader; accepting old v1 files preserves import in the other direction. Existing imported history is copied into later exports (`viewer/app/handoff.js:59`), so the translation boundary must include it.

D2 and D3: Runtime comments and hand-written tests are inventoried separately from captured transcripts in `docs/maps/owner-name-identifiers-inventory.md`. The older maps `docs/maps/owner-name-prompts.md` and `docs/maps/thread-handoffs.md` cover broader prior work; their covered files changed since their checked commits, so their old line references are not relied on here.

Not checked: third-party consumers, installed state or downloaded handoffs, all handoff failure paths, and protocol prose outside runtime scope.
