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
| 6 | (Superseded by 10) A held-back reply is answered with an error whose `id` is copied byte for byte from the client's own matching request, never from the server's line | Closes the parent's round-3 findings (key in `id`, large `id` rounded): the client's own bytes hold no key and are never re-encoded | defaulted |
| 10 | Supersedes 6: the error reply copies the server reply's own `id` bytes when they hold no key; a reply whose `id` holds a key is dropped. No pending-request list | Simpler with the same result: the client never sends a key, so a key-bearing id matches no waiting request | review-round-1 |
| 11 | In-place replacement only changes string values; any change to names, numbers, structure or top-level `jsonrpc`/`id`/`method` holds the line back | A replaced method or name would mislead the client | review-round-1 |
| 12 | Keyed servers: 32 MiB line limit; client stdin end closes the server's stdin and waits up to 5 s for it to finish, flushing everything before exit | Bounded memory; no reply cut off at shutdown | review-round-1 |
| 13 | Replacement in place applies to every message kind; only what can't be cleaned is held back | One rule; the guide and tests follow it | review-round-2 |
| 14 | Big replies stay in this thread: the key checker is made memory-safe here rather than split off | Collin: keep it here | user |
| 15 | (Superseded by 16) The checker gets a memory budget beside its work budget: retained match records are counted, and running out is handled exactly like running out of work (script output shows `[not checked for keys]`; a server line is held back) | Same fallback the checker already has; ordinary large replies stay under it, only pathological ones fall back | review-round-3 |
| 16 | Supersedes 15: server lines are checked with a streaming JSON reader that undoes JSON escapes first; the escape-aware matcher runs only on escape-containing runs of at most 4 KiB, longer ones count as unchecked; in-place replacement only of raw matches inside string values. `key-spell.js` and `redactCapture` are unchanged | Bounds memory by design instead of by a budget; ordinary JSON escapes never form long runs; script tools untouched | review-round-4 |
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
- `wc.js tool check` on a keyed server runs the handshake without keys: the declared key names are removed from the environment it passes to the server. Its output stays as
  today (`<server name> tools: a, b` on success, the failure text on failure) with
  ` (checked without its keys)` added at the end of the success line, and on failure one more
  line: `it ran without its keys; that may be why`. `wc.js tool run` keeps refusing servers.

### S3. Starting the server

- `serverEntry` passes, for a keyed row only, `--state-dir <stateDir>`, `--key-store
  <project|shared>` and one `--key <NAME>` per declared key, like `bridgeEntry`. No value is
  ever in the MCP entry, its args or env.
- `machine/lib/tool-launch.js` reads these, revalidates tool.json as today, and before
  spawning:
  - (keyed only) if Node child-process debug output is on (`debuglog('child_process').enabled`, as in
    `runKeyedScript`, `machine/lib/tool-run.js`), it does not start: stderr
    `tool <name>: Node debug output for child processes is on; keyed tools won't run`, exit 1;
  - whenever the `--key` names or the tool's current `keys` are non-empty, and the two differ
    as sets (including a keyless entry whose tool has since gained keys, and a keyed entry
    whose tool has since lost them all), it does not start:
    stderr `tool <name>: its keys changed; they are used from the next agent start (a new
    session, a resume or an account switch)`, exit 1;
  - (keyed only) reads the store fresh (`readKeyStore` with `projectIdentity`, or `readSharedKeys`); a
    missing or unusable key: stderr the S2 needs-key text, exit 1; a read error: stderr its
    message, exit 1.
- The values go only into the spawned server's env (`toolEnv(...)` plus the keys), read once
  at start: a value changed or removed later reaches the server only when it next starts.
  Spawn and start errors print only the tool name, the program and the error code, never env.
- A keyless server (no `--key` names and no current `keys`) keeps today's behaviour exactly (direct pipes, inherited stderr, today's
  shutdown). S4–S7 apply only to keyed servers.

### S4. Server stdout: line handling

- The launcher reads the server's stdout and splits it at `\n`. Each complete line (bytes
  up to and including `\n`, `\r` kept as part of the line) is handled as soon as its newline
  arrives and written out before the next line; nothing waits on a timer or on more output.
  Order of lines is kept.
- **JSON reader.** A small hand-written streaming reader (not `JSON.parse`) walks a line once,
  token by token, without keeping a token list. It reports whether the line is one
  well-formed JSON value; for a top-level object, which members it has and the exact source
  bytes of the `jsonrpc`, `id` and `method` values; and, for each string token (names and
  values), its byte range, whether it is a property name or a value, and its exactly decoded
  text (JSON escapes undone). It holds at most one decoded string at a time.
- **Detection** of a line, against every key value of the tool:
  - **Raw search:** a plain byte search of the whole line for each value.
  - **Pieces:** if the line is well-formed JSON, each string token's decoded text and each
    other token's bytes; otherwise the whole line as one piece. In each piece, a plain search
    for each value, and for every maximal run of escape-like bytes (`escapeLike` in
    `key-spell.js`: key characters, `%`, `\`) that contains a `%` or `\` and is at least as long
    as the shortest key value (a shorter run can't hold a spelling): if the run is at most
    4 KiB, the matcher on that run alone (no cut edges); if longer, the line is **unchecked**.
  - **One work budget per line:** 64,000,000 units, counted across every run of the line, each
    run charged its matcher work plus 2,000 units for setup. Running out makes the line
    unchecked. The key tables are built once per line and reused for every run: `key-spell.js`
    gains an additive export that takes prebuilt key states and a shared `spend`, leaving
    `findSpellings` and `redactCapture` as they are for script output.
  - Every byte of any spelling the parent's rule covers is escape-like, so a spelling always
    lies inside one such run; undoing JSON escapes first means ordinary JSON escapes (`\n`,
    `\"`, `\/`, `é`) never form long runs. Memory for detection is the line, one decoded
    string and the matcher's work on at most 4 KiB at a time.
- **Backpressure.** When a write to the launcher's stdout returns `false`, the launcher pauses
  reading the server's stdout until `drain`; so at most one handled line waits in the write
  queue besides the line being read (itself at most 32 MiB). The same for stderr.
  - The result is **clean** (nothing found, nothing unchecked), or not.
- Outcomes for a line, checked in order, for every kind of line alike (replies, server
  requests, notifications):
  1. **Unchanged.** Detection is clean: the original bytes are written.
  2. **Replaced.** All of these must hold, else outcome 3: the line is well-formed JSON;
     there is at least one raw-search match; every raw-search match lies wholly
     inside the bytes of a string *value* token, not inside a property name, not inside the
     top-level `jsonrpc`, `id` or `method` value, and not overlapping a backslash escape
     sequence. Each such match (overlapping matches merged) is replaced in a single copy pass
     with `[key]`; and detection run again on the result is clean. Because `[key]` has no quote or
     backslash and only string value contents change, the structure, names, numbers, ids and
     methods are unchanged. Write the result.
  3. **Held back.** Otherwise, by the original line's top-level members:
     - `id` and `result` or `error` (a reply): S5;
     - `method` and `id` (a request from the server): S6;
     - anything else (a notification, a batch array, not well-formed): dropped.
     Each held-back line also writes one stderr line through S7:
     `tool <name>: held back a <reply|request|message> that contained one of its keys`
     (or `that could not be checked for keys` when unchecked).
- `redactCapture` and `key-spell.js` are not changed; script output is unaffected.
- **Size limit.** The launcher holds at most 32 MiB of one line's input. When a line passes 32 MiB without a newline, the rest
  up to the next `\n` is discarded unread and the line is held back using only the bytes held:
  the reader reads them in order as a prefix of a top-level object, and a member counts
  only if its value token ended inside the prefix. With a complete `method` and `id` it is a
  server request (S6); else with a complete `id` it is a reply (S5); else it is dropped. The
  stderr line says `held back a … that was over 32 MiB`.
- **Shutdown.**
  - Client stdin ends: the launcher ends the server's stdin and keeps relaying. When the
    server's stdout and stderr have ended and the server has exited, it handles any final line
    without `\n` the same way (without adding a newline), waits for its own stdout and stderr
    writes to flush, and exits with the server's code (1 on a signal). If the server has not
    exited 5 seconds after stdin ended, the launcher kills its process group as today and then
    exits the same way.
  - Server exits first: the same flush, then exit with its code.
  - After the server process exits, the launcher waits at most 2 seconds more for its stdout
    and stderr to end (a child of the server may hold them open); then it kills the group,
    handles what it already holds, flushes and exits, like `runKeyedScript`'s post-exit
    deadline.
  - A signal to the launcher (SIGINT, SIGTERM, SIGHUP): kill the group and exit, as today; no
    flush promise.

### S5. Held-back replies

- A held-back reply gets an error reply in its place only when the original reply's `id`
  value (its exact source text from the reader, or from the prefix for the size limit) itself contains no key under detection:
  `{"jsonrpc":"2.0","id":<that exact id text>,"error":{"code":-32603,"message":"tool <name>: its reply contained one of its keys and was held back"}}\n`
  (or `…its reply was over 32 MiB and was held back` for the size limit).
  The id bytes are copied, never re-encoded, so large numbers and odd spellings survive.
- A reply whose `id` text contains a key is dropped: the client never sent a key (it doesn't
  know any), so no request is waiting on that id.
- Before any generated line is written, detection runs on it; if it finds a key the line is
  not written.

### S6. Held-back requests from the server

- For a held-back server request, the launcher writes to the server's stdin
  `{"jsonrpc":"2.0","id":<the server line's exact id text>,"error":{"code":-32603,"message":"held back by wheelchair: the request contained one of this tool's keys"}}\n`.
  (That id goes back to the server, which already knows it.)
- The launcher passes the client's stdin bytes to the server unchanged and immediately, and
  tracks only whether a client line is part-way through. An injected line is never written
  inside a client line: it is queued and written right after the client's next `\n` (or at
  once if none is part-way). After client stdin ends, a queued line is written before the
  server's stdin is ended.

### S7. Server stderr

- For a keyed server, stderr is piped (not inherited) and written to the launcher's stderr a
  complete line at a time through `redactCapture`, in pieces of at most 4 KiB (so its memory stays small): a line longer than that is
  handled in 4 KiB pieces. At each piece edge, the trailing run of escape-like bytes is carried
  over to the start of the next piece instead of being cut, so ordinary long lines stay whole;
  only when that run alone passes 4 KiB is the piece cut with `redactCapture`'s `cutEnd` on it
  and `cutStart` on the next, as script output capture does. The launcher's own messages (S3–S6) never contain a
  value.

### S8. Guide

- `protocol/tools.md`: the server-keys refusal line is replaced with: server tools may list
  `keys`; values arrive as environment variables of the server process only, read when it
  starts; replies and error output are checked for keys (same spellings as scripts); only text
  inside a message can be replaced, and a reply that can't be cleaned that way (or is over 32 MiB)
  is usually replaced by an error reply to the same request (it is dropped instead when its
  `id` itself holds a key, or, for an oversized reply, when its `id` comes after the cut); a request from the server that can't be
  cleaned gets an error; other messages that can't be cleaned are dropped; `check` runs without keys; same availability as
  other server tools.
- The key lifecycle paragraph ("A replaced value applies from the next call; a removed key
  makes the next call fail without running") is reworded so it says that holds for script
  tools, while a server tool gets a replaced or removed value only at its next start (the next
  agent start).
- The statements that values are added "at each call" and that Kimi and Pi "run keyed tools"
  are qualified as applying to script tools.
- Echoed keys are replaced with `[key]` only when they appear as written; a key that the server's JSON writes with escapes (for example `/` as `\/`) makes the message held back instead.
- The Keys section's opening sentence ("Script tools can declare `keys`") says script and server tools.
- The `NODE_DEBUG` sentence covers keyed server tools too. Keep "Never print or log a key in
  any form."

### Non-goals

- No change to key storage, editors, Settings, or keyless servers.
- No keys for HTTP (`url`) servers, and no new harness gets server tools.
- No protection against base64, hashing, splitting or other transforms (parent's limit).

### Validation

- S1: `node --test machine/test/folder-tools.test.js` (keyed server accepted; old refusal gone).
- S2: `node --test machine/test/folder-tools-run.test.js viewer/test/wc-tool.test.js machine/test/project-tools.test.js` — keyed server with missing key not offered with the needs-key line; set key offered; `check` keeps the server name and tool list and adds the note; list status.
- S3–S7: `node --test machine/test/folder-tools-launch.test.js machine/test/key-redact.test.js` with a fake keyed server covering at least: keys reach the server env and not argv/MCP entry; `NODE_DEBUG=child_process` refusal with no value on stderr; keys-changed and missing-key refusals; `check` with a declared key already set in the caller's environment does not pass it to the server; keyless lines byte-identical (odd spacing, `1.0`, `9007199254740993`); a key echoed in a result string replaced with `[key]`; a key echoed in `\u`-escaped and `\/` forms replaced or held back, never passed; a key in a property name held back and answered with the reply's own `id` bytes (including `9007199254740993` and a string id); a key in the reply's `id` dropped; a server request whose `method` is the key (`roots/list` as the key value) held back and answered on the server's stdin, never reaching the client; a server request carrying a key answered on the server's stdin and not inside a client line; a notification with a key in a string value passed with `[key]`, and one with a key in a property name dropped; a server request with a key in a string param passed with `[key]`; a client that waits for each reply before sending the next request completes (no stall); a 1 MiB string value that is a run of `A` with one `%41` (and one with `\\u0041`) held back as unchecked, with the launcher's heap growth under 200 MiB, for 20 declared keys of 4096 characters starting with `A`; an 8 MiB JSON reply carrying base64 image data (one written with `\/`) and a 16 MiB JSON reply of escape-heavy text (`\n`, `\"`, `\u00e9`), each passed unchanged within 5 seconds; a 16 MiB reply with 200,000 separated short `%20` URLs passed or held back as unchecked within 10 seconds, never longer; both with two keys absent from them and with two absent keys sharing their prefixes (`e3…`, `n6…`); a key spelled as `\u0041…` with no raw match held back, never passed unchanged; a key matched raw but overlapping an escape (`\u0041` followed by the rest of a key starting `1`) held back, not replaced; a 32 MiB reply of many small tokens with one echoed key replaced without heap growth beyond a few times the line; a line over 32 MiB discarded, with held input never above 32 MiB, with an error reply when its `id` came before the cut, and dropped when it came after; client stdin closed while a reply is still being written, and the reply arrives whole; a server that exits while a child keeps its stdout open: the launcher exits within about 2 seconds with what it had delivered; a keyless entry whose tool gained a key, and a keyed entry whose tool lost all keys, both refused as changed; stderr key replaced, including one straddling a 4 KiB piece edge, and a 20 KiB stderr line of ordinary words passed whole; a client that stops reading while the server sends five 20 MiB replies, with the launcher's heap staying under 150 MiB until it reads again; 1,000,000 bytes of stdout fully delivered before exit; keyless server unchanged (stderr inherited).
- Name guard: `node --test machine/test/name-guard.test.js`.
- S8: `grep -n -i "aren't supported yet" protocol/tools.md` finds nothing; `grep -n -i "never print or log a key" protocol/tools.md` finds the rule; read the rendered guide (CONTRIBUTING.md).

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| A key transformed (base64, hashing, split across fields) is not found | Parent's stated limit (its Decision 19) | planning |
| A held-back batch array is dropped, so a client that sent a batch may wait | Rare path: current MCP has no batches and the harnesses don't send them | planning |
| An agent that reads the key store files on disk can find values | Same OS user; parent IDEA Not doing | planning |
| A keyed server's error output without newlines shows up only at a newline or every 4 KiB | Rare path: servers that write unterminated error output | review-round-1 |
| An oversized reply whose `id` comes after its first 32 MiB is dropped, so the client waits | Rare path: needs a reply over 32 MiB with its id at the end | review-round-2 |
| After client stdin ends, a server request that needs holding back gets no answer, and a client that ends mid-line can lose a queued injected line | Rare path: shutdown plus a key-bearing server request at the same time | review-round-2 |
| A key whose value spells part of the generated error text suppresses that error reply | Rare path: real key values are random, not English words | review-round-2 |
| An oversized server request whose `method` is past the cut is taken for a reply and gets a client-facing error | Rare path: needs a server request over the size limit with `method` last | review-round-3 |
| When the server exits and a child of it keeps stdout or stderr open past the 2-second deadline, a key cut at that edge could pass in part | Rare path: needs a lingering child plus a key straddling the forced cut | review-round-4 |
| Another AI's "server tools don't work" warning on the Tools page can leave out a server held back for a missing key until that AI next starts | Worst case one name missing from a warning line | review-round-4 |
| A long escape-heavy run (over 4 KiB of key characters with a `%` or `\` after undoing JSON escapes) holds the message back, e.g. a very long percent-encoded URL | Safe failure; ordinary JSON escapes are undone first | review-round-4 |
| A server whose JSON writer escapes `/` (as PHP does by default) gets an error reply instead of `[key]` whenever it echoes a key containing `/` | Safe failure; replacing inside escapes would reopen the structure risks; the guide says so | review-round-5 |
| A text value that is itself JSON with `\/` escapes and holds a base64 blob over 4 KiB is held back as unchecked | Rare path: nested JSON written by a `/`-escaping encoder carrying a large blob | review-round-5 |
| A client that itself sends an id spelling a key gets no reply when the server echoes it | Rare path: the client would have to guess a key | review-round-1 |

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

### Round 1 — 2026-11-27

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Pending-request matching in S5 is more than needed | upheld | S5 rewritten: copy the reply's own clean id, drop a key-bearing one (Decision 10) |
| intent | minor | Guide says replaced/removed keys apply next call; servers read keys at start | upheld | S3, S8 lifecycle wording |
| intent | minor | `check` wording would replace the server name and tool list | upheld | S2: note appended to existing output |
| intent | minor | Rare path: unterminated stderr delayed | accepted-risk | Accepted Risks |
| mechanics | blocking | `NODE_DEBUG` makes spawn print the env | upheld | S3: same refusal as keyed scripts |
| mechanics | blocking | Replacement can change `method` or names while staying valid JSON | upheld | S4.2 token comparison (Decision 11) |
| mechanics | blocking | Rare path: client id spelling a key reflected back | accepted-risk | Accepted Risks; S5 also drops key-bearing ids and checks generated lines |
| mechanics | major | Exit on client stdin end can cut accepted output | upheld | S4 Shutdown (Decision 12) |
| mechanics | major | Unbounded line buffering | upheld | S4 Size limit (Decision 12) |
| mechanics | minor | Guide lifecycle text wrong for servers | upheld | S8 |
| mechanics | minor | `name-guard` test missing from Validation | upheld | Added |

### Round 2 — 2026-11-27

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 1:** S2 (`check` note appended to existing output), S3 (`NODE_DEBUG` refusal; keys read once at start), S4 (lossless tokenizer; replacement only of string values; 32 MiB line limit; shutdown and flush), S5 (rewritten: copy the reply's own clean id, drop key-bearing ids, check generated lines), S6 (client-line tracking moved here), S8 (lifecycle and `NODE_DEBUG` wording), Validation (new cases, name guard), Decisions 10–12, Accepted Risks.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Guide "other messages are dropped" reads as all messages | upheld | S8 wording |
| intent | minor | Decision 6 not marked superseded | upheld | Marked |
| mechanics | blocking | 32 MiB limit vs detector working memory | downgraded (minor) | Ambiguous wording, not a defect: S4 says the limit is on held input and memory scales about 6x |
| mechanics | blocking | Oversized-line id needs prefix parsing | upheld | S4 Size limit: prefix rule; rest accepted as rare |
| mechanics | blocking | Replacement vs dropping for notifications and server requests inconsistent | upheld | S4: outcomes 1–2 apply to all; guide and tests follow (Decision 13) |
| mechanics | major | Shutdown hangs on a descendant holding pipes | upheld | S4: 2 s post-exit deadline |
| mechanics | major | Key-set comparison direction | upheld | S3: compare when either set is non-empty |
| mechanics | major | Other AIs' warnings lose a server held back for a missing key | downgraded (minor) | Worst case a name missing from a warning line; fixed in S2 |
| mechanics | major | Rare path: EOF during drain with held server request | accepted-risk | Accepted Risks |
| mechanics | major | Rare path: key spelling the generated error text | accepted-risk | Accepted Risks |

### Round 3 — 2026-11-27

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 2:** S2 (other AIs' warnings keep held-back servers), S3 (key-set comparison when either set is non-empty), S4 (outcomes apply to every message; size-limit prefix rule and memory wording; 2 s post-exit deadline), S5 (prefix id), S8 (wording), Validation, Decisions 6 (marked superseded) and 13, Accepted Risks.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Guide promises an error reply in every case | upheld | S8 names the two drop cases |
| mechanics | blocking | Escape-aware matcher's memory can blow up on large lines below 32 MiB | upheld | Split offered; Collin kept it here (Decision 14). S4 Memory budget (Decision 15) |
| mechanics | blocking | Rare path: oversized server request with `method` past the cut taken for a reply | accepted-risk | Accepted Risks |
| mechanics | minor | Warning refresh with missing-key servers can upset supported adapters' launch budget | upheld | S2: unfiltered list only for adapters that report servers unsupported |
| mechanics | minor | Guide's "at each call" and Kimi/Pi statements imply server support | upheld | S8 qualifiers |

### Round 4 — 2026-11-27

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 3:** Decision 14 (Collin kept big replies here) and 15; S4 Memory (match-record budget in `findSpellings`, used by scripts and servers); S2 warning refresh lists; S8 wording (drop cases, script-only statements); Validation (memory and big-reply cases); Accepted Risks.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | blocking | Record budget lets heap pass 300 MiB | upheld | Budget dropped; S4 detection bounds memory by design (Decision 16) |
| mechanics | major | `redactCapture` replacement keeps a view per run | upheld | Servers no longer use `redactCapture`; single copy pass |
| mechanics | major | 16 MiB escape-heavy reply can exhaust work with prefix-sharing keys | upheld | JSON escapes undone first; matcher only on short runs; test with prefix-sharing keys |
| mechanics | blocking | Rare path: forced cut after the post-exit deadline | accepted-risk | Accepted Risks |
| mechanics | minor | Warning refresh needs more call-site changes | accepted-risk | S2 sentence removed; Accepted Risks |
| mechanics | minor | `check` passes a declared key already in the environment | upheld | S2: names removed from the handshake env |
| intent | major | 4,000,000 records can't meet the 300 MiB test | upheld | Same fix as mechanics 1 |
| intent | minor | Tokenizer keeps full token lists | upheld | Streaming reader, no token list |
| intent | minor | Guide's opening sentence says script tools only | upheld | S8 |

### Round 5 — 2026-11-27

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 4:** S4 rewritten (streaming JSON reader; detection on decoded strings and short escape runs; replacement rule; memory budget removed, script tools untouched), S2 (`check` env; refresh sentence removed), S7 (4 KiB stderr pieces), S8 (opening sentence), Validation, Decisions 15–16, Accepted Risks.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | blocking | Mixed raw spelling (`\u0041%42…` for a key containing `u0041`) missed | declined | The client decodes JSON before anything reads it; it sees `A%42CDEFGH`, which S4 checks, and that does not spell the key. Raw literal matches are still searched |
| mechanics | major | No line-wide work bound; per-run setup cost | upheld | S4: one budget per line, setup charged, short runs skipped, key tables built once |
| mechanics | major | Check once built: backpressure with a paused client | upheld | S4 Backpressure; test added |
| intent | major | Outcome 2 trivially true with no raw match | upheld | S4.2: needs at least one raw match and a clean re-check |
| intent | minor | Total time per line unbounded | upheld | Same fix as mechanics 2 |
| intent | minor | 4 KiB stderr pieces cut ordinary words | upheld | S7: carry the trailing run over |
| intent | minor | Accepted Risk says 64 KiB | upheld | Fixed |
| intent | minor | `\/`-escaping encoders lose `[key]` replacement | accepted-risk | Accepted Risks; guide (S8) |
| intent | minor | Rare path: nested JSON with `\/` and a big blob | accepted-risk | Accepted Risks |
| intent | minor | Default work budget not exported | upheld | S4 states the line budget and the new export |

### Round 6 — 2026-11-27

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 5:** S4 (outcome 2 conditions; one work budget per line with setup cost, short runs skipped, shared key tables via a new `key-spell.js` export; backpressure), S7 (carry-over at piece edges), S8 (escaped echoes held back), Validation, Accepted Risks.

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
