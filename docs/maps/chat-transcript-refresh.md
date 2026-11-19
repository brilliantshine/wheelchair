# Map: chat transcript refresh

Checked against: `899afb69395ed5dddc5828ae86bad1fd3e765947` (origin/main)
Files covered: `viewer/pages/thread.js`, `viewer/pages/nav.js`, `viewer/app/routes.js`, `viewer/app/hub.js`, `viewer/app/chat.js`, `viewer/app/sessions.js`, `viewer/app/asides.js`, `viewer/app/machine-client.js`, `viewer/app/ready.js`, `machine/service.js`, `machine/API.md`, `viewer/test/app-chat.test.js`, `viewer/test/app-handoff.test.js`, `viewer/test/app-asides.test.js`, `viewer/test/helpers/app-machine.js`, `machine/test/service.test.js`, `machine/test/kimi-turns.test.js`

## Flow

```text
visible thread page -> chat route -> thread lock -> each lead transcript -> machine copy -> kept file
                                      |                              <- whole data <-
                                      -> parse and assemble -> page renders
```

The page polls immediately and every 2 seconds, skips overlapping requests, and renders the returned chat; hidden tabs skip ticks and poll on becoming visible (`viewer/pages/thread.js:7`, `viewer/pages/thread.js:1146-1160`, `viewer/pages/thread.js:1227-1229`, `viewer/pages/nav.js:3-14`). The route calls `hub.chat`, which holds the thread lock through chat assembly and export state; handoff status refresh runs after the lock (`viewer/app/routes.js:518-519`, `viewer/app/hub.js:250-264`). Chat reads a snapshot, saves a discovered slug if necessary, sequentially fetches and parses every lead session, then joins settings, parent, cards and queues (`viewer/app/chat.js:318-351`). Aside creation also calls the same assembler to validate an assistant message (`viewer/app/asides.js:34-37`).

`sessionTranscript` requests the machine route without an offset. It caches only nonempty whole data under machine/session; chat uses the last copy on failure or empty response, while report delivery does not use that stale fallback and may instead read a recorded local path (`viewer/app/chat.js:271-287`, `viewer/app/sessions.js:428-435`). The cache is an unbounded Map and chat parses again on every call, including identical text (`viewer/app/chat.js:278-285`, `viewer/app/chat.js:325-329`). The lighter-server plan explicitly moved the memory and parse work to this follow-up, superseding its earlier 64 MB decision (`docs/plans/lighter-server/PLAN.md:77`, `docs/plans/lighter-server/PLAN.md:87`, `docs/plans/lighter-server/PLAN.md:138`).

The client sends a machine secret, accumulates and parses JSON, defaults to a 5-second socket timeout, and throws on non-2xx; `hub.call` also records machine seen (`viewer/app/machine-client.js:10-47`, `viewer/app/machine-client.js:62-80`, `viewer/app/hub.js:144-147`). Transcript calls do not negotiate versions: they expect `data`. Separately, readiness compares the machine status commit with the hub boot commit, but that gate is not part of the chat call (`viewer/app/chat.js:278-287`, `viewer/app/ready.js:11-15`, `viewer/app/ready.js:29-38`, `viewer/app/hub.js:20-25`, `machine/service.js:251`, `machine/service.js:1491`).

The authenticated machine route accepts `offset` and returns `{offset, data}`; both live and forgotten archived sessions read the whole kept file before byte slicing (`machine/service.js:1917-1919`, `machine/service.js:1929`, `machine/service.js:1228-1245`, `machine/API.md:20`). For live sessions it discovers a source when needed and serializes copies per session; hooks can invoke the same copier (`machine/service.js:1193-1202`, `machine/service.js:1238-1242`, `machine/service.js:1304-1307`). For ordinary sources a changed path, inode or shrink resets the source offset; Kimi validates the opened file's device/inode and size and refuses ended sessions (`machine/service.js:1204-1210`). Only complete newline-terminated records advance the offset. The copier reads the full kept file at `transcripts/<thread>/<session>.jsonl`, hashes each existing and incoming line for deduplication, appends new lines, updates source state and persists the entire registry even with no additions (`machine/service.js:1211-1226`, `machine/service.js:488`). Source absence leaves the kept copy readable (`machine/service.js:1239-1245`).

## Tests and change boundaries

The lock test blocks a transcript call and verifies a handoff mutation waits (`viewer/test/app-handoff.test.js:373-381`). Both that test and aside tests use literal `endsWith('/transcript')` matchers; the fake HTTP machine matches the pathname suffix (`viewer/test/app-handoff.test.js:377`, `viewer/test/app-asides.test.js:133`, `viewer/test/helpers/app-machine.js:125`). Chat tests cover stale chat fallback versus report reads (`viewer/test/app-chat.test.js:362-370`). Machine tests cover source shrink, partial lines, overlapping copies, missing sources, archived copies and discovery before a hook (`machine/test/service.test.js:259-260`, `machine/test/service.test.js:412-436`, `machine/test/service.test.js:554-564`, `machine/test/service.test.js:598-606`); Kimi tests cover replacement, opened-file swaps and concurrent binding/polling (`machine/test/kimi-turns.test.js:124-135`, `machine/test/kimi-turns.test.js:189-196`, `machine/test/kimi-turns.test.js:260-266`).

## Not checked

Every parser rule and test assertion, external clients outside this repository, live performance, and unrelated claims in the historical maps.
