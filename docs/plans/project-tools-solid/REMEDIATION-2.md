# Remediation 2 — project-tools-solid

Verification attempt 2 on `f37b1b8`: Claude verifier PASS; GPT verifier FAIL with two gaps (no duplicates). Manual checks carried forward from attempt 1 by both.

## Gaps (verbatim)

1. GAP: §§3–4, duplicate HTTP headers — A valid 18,133-byte `.mcp.json` with a deeply nested ignored field before `mcpServers` stops the duplicate scan early. In an isolated fixture, both Codex and Antigravity enabled a server with two `X-Fixture` keys and returned zero warnings. The same server was skipped by both adapters when the ignored field was absent.
2. GAP: §8, initial thread state — A new thread has no `project_tools` record until a machine returns a snapshot. With the isolated hub's machine stub returning a successful start without a snapshot, `POST /threads` returned 201 and both the response and saved thread lacked the required default record. The lead's session list correctly showed `problems: []`.

Gap 1 is the same gap as remediation 1's gap 1 (second fix attempt). Its cause is the sub-lead's own catch added at R1 acceptance, which made a stack overflow give up silently.

## Tasks

### R3

# Task R3 (remediation 2) — duplicate-header scan must never stop early

Gap from verification attempt 2 (verbatim): "§§3–4, duplicate HTTP headers — A valid 18,133-byte `.mcp.json` with a deeply nested ignored field before `mcpServers` stops the duplicate scan early. In an isolated fixture, both Codex and Antigravity enabled a server with two `X-Fixture` keys and returned zero warnings. The same server was skipped by both adapters when the ignored field was absent."

Cause: `duplicateHeaderServers(text)` in `machine/lib/project-mcp.js` is a recursive-descent scanner; deep nesting overflows the call stack, and a `try { value([]) } catch {}` added afterwards makes it give up silently, so later `headers` objects are never scanned. This is the second fix attempt for this gap; it must be closed for any valid file up to the reader's 32 KiB limit.

Ownership boundary: `machine/lib/project-mcp.js` (only `duplicateHeaderServers`), `machine/test/project-mcp-reader.test.js`, your report (`docs/plans/project-tools-solid/reports/R3.md`). Touch nothing else.

## Exactly what to build
- Rewrite `duplicateHeaderServers(text)` as an **iterative** scanner with an explicit stack (an array of frames), no recursion and no try/catch that swallows errors. Same contract: returns a `Set` of server names; for every object found at key path `mcpServers` → `<server name>` → `headers` (each occurrence separately), its keys are decoded with `JSON.parse` of the string token and, if two are equal after `toLowerCase()`, the server name is added. Array elements do not count as object keys (a frame for an array carries no key). Everything else is ignored.
- The text has already passed `JSON.parse`, so it is valid JSON; the scanner may assume that, but must terminate on any valid input (every loop iteration advances the index).
- Memory is bounded by the file (≤ 32 KiB), so a stack of up to ~32K frames is fine. Avoid copying the whole key path per frame (store the key on the frame and the depth; check the path by looking at the bottom three frames).
- Keep the exports and the `DUPLICATE_HEADERS` marking in `readProjectMcp` unchanged.

## Tests (reader test file)
- Replace the existing "deeply nested valid JSON still reads" test with: a file with a 15,000-deep nested array field placed **before** `mcpServers`, and an http server with two exact `X-Fixture` keys → the file reads (`mcp` not null) and that server is marked with `DUPLICATE_HEADERS`; same with 15,000-deep nested **objects** before `mcpServers`; same with the deep field **after** `mcpServers`.
- A file near 32 KiB with nesting as deep as fits still reads and marks correctly.
- Keep every existing reader test passing (exact, case, escaped `X`, env and other-path negatives).

## Validation
```
node --test machine/test/project-mcp-reader.test.js machine/test/project-mcp-codex.test.js machine/test/project-mcp-agy.test.js
bash machine/test/run.sh
```

### R4

# Task R4 (remediation 2) — new threads carry the default project_tools record

Gap from verification attempt 2 (verbatim): "§8, initial thread state — A new thread has no `project_tools` record until a machine returns a snapshot. With the isolated hub's machine stub returning a successful start without a snapshot, `POST /threads` returned 201 and both the response and saved thread lacked the required default record. The lead's session list correctly showed `problems: []`."

Spec §8: "Thread record gains `project_tools = { boot: null, seq: 0, created_at: null, state: null, card: null, card_names: [] }`."

Ownership boundary: `viewer/app/threads.js` (only `emptyThread`), `viewer/test/app-project-tools.test.js`, your report (`docs/plans/project-tools-solid/reports/R4.md`). Touch nothing else.

## Exactly what to build
- In `viewer/app/threads.js` `emptyThread(input)` (around line 20), add the field `project_tools: { boot: null, seq: 0, created_at: null, state: null, card: null, card_names: [] }` to the returned object, next to the other default fields.
- Keep the lazy creation in `viewer/app/sessions.js` `applyProjectTools` as is (old saved threads have no record).
- Test in `viewer/test/app-project-tools.test.js`: creating a thread through the hub's normal thread-creation path (look at how `viewer/test/app-thread-list.test.js` or `app-machines.test.js` create threads with a fake machine) with a machine start answer that has no `project_tools` gives a thread whose response and saved record both carry exactly that default object.

## Validation
```
node --test viewer/test/app-project-tools.test.js
node --test viewer/test/*.test.js
```
(leave the glob unquoted)
