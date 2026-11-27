---
slug: server-tool-keys
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-27
---

# Keys for server tools

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here.

Parent: `docs/plans/tool-keys/PLAN.md` (merged in PR #200), which gave keys to folder script
tools and split server tools off (its Decision 15). Its Review Rounds rows marked "Moved to the
server-tools thread" are the starting findings this plan answers (S4–S6).

## Open Questions

None.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | Unopened stub "Make easy tools solid" lists a launcher drain race (stdout cut short at exit under load) | Same file this plan rewrites | no | S4 requires a full drain before exit; the stub keeps its own item (it may still need the test made reliable). Not an overlap: unopened stubs take additions only |

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode: thorough | Collin picked it | user |
| 2 | No designer | The only visible parts are status texts already drawn and agreed in the parent (needs-key status) | defaulted |
| 3 | Carry the parent's key rules unchanged: `keys` in tool.json, project tools use project keys and shared tools the shared keys (`toolKeyStore`), usable values 8–4096 characters of `[A-Za-z0-9._~+/=-]`, values only in the tool's own process, `check` never uses keys | Settled and built in the parent | defaulted |
| 4 | Keyed server tools connect wherever server tools connect today (Claude, Antigravity, unrestricted Codex); nowhere new | Server tools already don't connect on sandboxed Codex, Kimi or Pi, with their own warnings | defaulted |
| 5 | Server stdout is handled one complete line at a time, three outcomes: unchanged bytes; plain replacement when the result checks clean; otherwise held back (parent Decision 13) | Keeps ids and numbers byte-exact and never waits for more output | defaulted |
| 6 | A held-back reply is answered with an error whose `id` is copied byte for byte from the client's own matching request, never from the server's line | Closes the parent's round-3 findings (key in `id`, large `id` rounded): the client's own bytes hold no key and are never re-encoded | defaulted |
| 7 | A held-back request from the server to the client is answered on the server's stdin with an error, not dropped silently | Closes the parent's accepted risk of a server left waiting | defaulted |
| 8 | Server stderr is piped and redacted with the same capture redaction as script output (`redactCapture`), line by line, with cut marks for very long lines | Keys can't contain newlines (parent Decision 16), so the parent's multiline finding is moot | defaulted |
| 9 | Detection is the parent's rule (Decision 19): any plain or escaped spelling `key-spell.js` finds; a work-budget overrun counts as a key | One rule for scripts and servers | defaulted |

## Spec

### S1. Validation

- `validateToolJson` (`machine/lib/folder-tools.js`) accepts `keys` on `kind: "server"` with
  the same rules it applies to scripts (names, duplicates, count). The refusal
  `keys for server tools aren't supported yet` is removed from the code, tests and
  `protocol/tools.md`.

### S2. Discovery and status

- In `machine/service.js` session discovery, a keyed server row is treated like a keyed
  script row for key checks: its store is `row.key_store`; if any declared key is missing or
  unusable (`usableReason`) the server is not offered and the problems line is the same text
  scripts use: `tool <name> needs key <K>, not set on this machine` (or `needs keys A, B`;
  `shared tool` prefix for shared rows). A store read error becomes the problems line, as for
  scripts.
- Where server tools are not connected today (sandboxed Codex, Kimi, Pi), nothing changes:
  their existing "server tools …" warnings stay, and no extra key line is added.
- The Tools page (`viewer/pages/project-tools.js` via `machine/lib/project-tools.js`
  `decorate`) and `wc.js tool list` show keyed servers' key status exactly as for keyed
  scripts (set / needs key X, not set on this machine). `key_store` is already set for keyed
  rows of any kind; confirm it is shown for servers.
- `wc.js tool check` on a keyed server runs the handshake without keys and says so, using the
  existing wording for keyed scripts adapted: `ok (checked without its keys)` on success, and on
  failure adds `it ran without its keys; that may be why`. `wc.js tool run` keeps refusing
  servers.

### S3. Starting the server

- `serverEntry` passes, for a keyed row only, `--state-dir <stateDir>`, `--key-store
  <project|shared>` and one `--key <NAME>` per declared key, like `bridgeEntry`. No value is
  ever in the MCP entry, its args or env.
- `machine/lib/tool-launch.js` reads these, revalidates tool.json as today, and before
  spawning:
  - if the tool's current `keys` differ (as a set) from the `--key` names, it does not start:
    stderr `tool <name>: its keys changed; they are used from the next agent start (a new
    session, a resume or an account switch)`, exit 1;
  - reads the store fresh (`readKeyStore` with `projectIdentity`, or `readSharedKeys`); a
    missing or unusable key: stderr the S2 needs-key text, exit 1; a read error: stderr its
    message, exit 1;
- The values go only into the spawned server's env (`toolEnv(...)` plus the keys). Spawn
  and start errors print only the tool name, the program and the error code, never env.
- A keyless server keeps today's behaviour, except that S4–S6 piping applies only when the
  tool has keys; keyless servers keep direct pipes and inherited stderr.

### S4. Server stdout: line handling

- The launcher reads the server's stdout and splits it at `\n`. Each complete line (bytes
  up to and including `\n`, `\r` kept as part of the line) is handled as soon as its newline
  arrives and written out before the next line; nothing waits on a timer or on more output.
  Order of lines is kept.
- Outcomes for a line, checked in order:
  1. **Unchanged.** `findSpellings` (via the same entry as `redactCapture`, no cut edges)
     finds no key and does not run out of budget: the original bytes are written.
  2. **Replaced.** Otherwise compute `redactCapture(line)`. It is written only if all hold:
     it contains no `[not checked for keys]` marker; it parses as JSON; running detection on
     it again finds nothing; and, when the original line is a JSON object with a top-level
     `id` member, the raw text of that `id` value (S5's scanner) is byte-identical in both.
  3. **Held back.** Otherwise, by what the original line is (S5's scanner on the original):
     - an object with `id` and `result` or `error` (a reply): S5;
     - an object with `method` and `id` (a request from the server): S6;
     - anything else (a notification, a batch array, non-JSON): dropped.
     Each held-back line also writes one stderr line (S7 path):
     `tool <name>: held back a <reply|request|message> that contained one of its keys`.
- When the server's stdout ends, a final line without `\n` is handled the same way (without
  adding a newline). The launcher exits only after every stdout and stderr byte it accepted is
  handled and its own stdout and stderr have flushed (`write` callbacks / `drain`), so no
  output is cut at exit. When the client's stdin ends, the launcher keeps today's behaviour
  (kill the server group, exit).

### S5. Held-back replies keep request/reply matching

- The launcher passes the client's stdin bytes to the server unchanged and immediately. On
  the side it assembles client lines and, for each line that is a JSON object with `method`
  and a top-level `id`, records the `id` value's raw text in a pending list (at most 10,000;
  the oldest is dropped when full).
- A **raw-value scanner** finds a top-level member of a JSON object and returns its value's
  exact source text, without converting numbers or decoding strings (a small hand-written
  scanner; `JSON.parse` must not be used to obtain ids). The same scanner tells reply from
  request from other (S4.3).
- For a reply (passed on in S4.1/S4.2, or held back), its `id` raw text is matched against
  the pending list: first by exact text; else by equal value, where strings compare by their
  decoded content and numbers by exact decimal value (`1`, `1.0`, `1e0` equal; no
  floating-point conversion). A match is removed from the list.
- A held-back reply that matches writes, in its place:
  `{"jsonrpc":"2.0","id":<the request's recorded raw id text>,"error":{"code":-32603,"message":"tool <name>: its reply contained one of its keys and was held back"}}\n`.
  One with no match is dropped (only the stderr line).

### S6. Held-back requests from the server

- For a held-back server request, the launcher writes to the server's stdin
  `{"jsonrpc":"2.0","id":<the server line's raw id text>,"error":{"code":-32603,"message":"held back by wheelchair: the request contained one of this tool's keys"}}\n`.
  (That id goes back to the server, which already knows it.)
- It never splits a client line: if a client line is part-way through being passed on, the
  injected line is queued and written right after the client's next `\n`.

### S7. Server stderr

- For a keyed server, stderr is piped (not inherited) and written to the launcher's stderr a
  complete line at a time through `redactCapture`. A run of more than 64 KiB with no newline is
  handled in 64 KiB pieces using `redactCapture`'s `cutEnd` on a piece and `cutStart` on the
  next, as script output capture does. The launcher's own messages (S3, S4) never contain a
  value.

### S8. Guide

- `protocol/tools.md`: the server-keys refusal line is replaced with: server tools may list
  `keys`; values arrive as environment variables of the server process only; replies and error
  output are checked for keys (same spellings as scripts); a reply that can't be cleaned is
  replaced by an error reply to the same request, a request from the server gets an error, and
  other messages are dropped; `check` runs without keys; same availability as other server
  tools. Keep "Never print or log a key in any form."

### Non-goals

- No change to key storage, editors, Settings, or keyless servers.
- No keys for HTTP (`url`) servers, and no new harness gets server tools.
- No protection against base64, hashing, splitting or other transforms (parent's limit).

### Validation

- S1: `node --test machine/test/folder-tools.test.js` (keyed server accepted; old refusal gone).
- S2: `node --test machine/test/folder-tools-run.test.js viewer/test/wc-tool.test.js machine/test/project-tools.test.js` — keyed server with missing key not offered with the needs-key line; set key offered; `check` wording; list status.
- S3–S7: `node --test machine/test/folder-tools-launch.test.js machine/test/key-redact.test.js` with a fake keyed server covering at least: keys reach the server env and not argv/MCP entry; keys-changed and missing-key refusals; keyless lines byte-identical (odd spacing, `1.0`, `9007199254740993`); a key echoed in a result string replaced with `[key]`; a key echoed as `\u`-escaped and `\/` forms replaced or held back, never passed; a key in a property name or in the reply's `id` held back and answered with the request's own raw `id` (including `9007199254740993` and a string id); a held-back unmatched reply dropped; a server request carrying a key answered on the server's stdin with its id, not interleaved inside a client line; a notification carrying a key dropped; a client that waits for each reply before sending the next request completes (no stall); stderr key replaced, including across a 64 KiB cut; 1,000,000 bytes of stdout fully delivered before exit; keyless server unchanged (stderr inherited).
- S8: `grep -n -i "aren't supported yet" protocol/tools.md` finds nothing; `grep -n -i "never print or log a key" protocol/tools.md` finds the rule; read the rendered guide (CONTRIBUTING.md).

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| A key transformed (base64, hashing, split across fields) is not found | Parent's stated limit (its Decision 19) | planning |
| A held-back batch array is dropped, so a client that sent a batch may wait | Rare path: current MCP has no batches and the harnesses don't send them | planning |
| An agent that reads the key store files on disk can find values | Same OS user; parent IDEA Not doing | planning |

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

### Round 1 — 2026-11-27

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- 2026-11-27: Other leads looked at after PLAN.md was created and again before review: no live thread overlaps.
