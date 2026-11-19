# Chat transcripts: current flow

Checked against `899afb69395ed5dddc5828ae86bad1fd3e765947` (origin/main); covered source matches this worktree. See [chat transcript map](../../maps/chat-transcripts.md) for the detailed flow and test seams. The overlapping older thread-page, sessions and handoff maps have changed files since their recorded commits; their relevant transcript paths were rechecked in the new map, not their unrelated claims.

```text
page poll -> locked chat assembly -> machine full transcript -> parse -> response
                                      | failure or empty -> chat cache -> local path
                                      -> report read -> local path on failure or empty
```

A visible page polls every 2 seconds; each lead is fetched and parsed under the thread lock (`viewer/pages/thread.js:7`, `viewer/app/hub.js:250`, `viewer/app/chat.js:318`). The hub's machine/session text map has no eviction, stores only nonempty replies and supplies chat's fallback, but never supplies a stale report (`viewer/app/chat.js:271`, `viewer/app/sessions.js:428`). Pending chat requests can wait behind the lock, and a test requires mutations to wait through assembly (`viewer/test/app-handoff.test.js:373`).

The machine currently ignores a `known` query and returns legacy `{offset,data}`; its offset slice still follows a full kept-file read. For a bound source, each copy also rehashes the full kept file and rewrites the session registry, even when no complete new line was added (`machine/service.js:1204`, `machine/service.js:1228`, `machine/service.js:1929`). Kept transcripts survive source loss and archive; copies are serialized, and truncation, replacement and incomplete source lines have special handling (`machine/service.js:1193`, `machine/service.js:1208`, `machine/service.js:1211`, `machine/service.js:1230`). A conditional response needs to preserve legacy full replies and distinguish unavailable data from a confirmed unchanged copy; the current empty reply triggers fallback (`viewer/app/chat.js:283`).

The lighter-server follow-up notes describe ten-minute idle eviction, protecting pending chat reads, parsed reuse, and a proposed full/unchanged protocol as a starting design, not a decision for this plan (`docs/plans/lighter-server/PLAN.md:77`, `docs/plans/lighter-server/PLAN.md:568`). Its earlier continuity and delta proposals were superseded (`docs/plans/lighter-server/PLAN.md:51`, `docs/plans/lighter-server/PLAN.md:59`). The prior thread cache's stat/settle behavior is independent of transcript caching (`viewer/app/state.js:139`). Literal suffix stubs in handoff and aside tests require attention if the URL gains a query (`viewer/test/app-handoff.test.js:377`, `viewer/test/app-asides.test.js:133`).

## Not checked

CLI discovery internals, exhaustive parser semantics, and performance measurements for the new protocol.
