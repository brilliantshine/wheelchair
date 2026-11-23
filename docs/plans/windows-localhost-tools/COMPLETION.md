---
slug: windows-localhost-tools
date: 2026-11-21
implemented-by: "standard workers — gpt-6.1-terra (T1, T2, T3a, T3b, T4; T3a/T3b/T4-attempt-2 at effort xhigh), claude-sonnet-5-5 (T5, T6, T7); sub-lead claude-opus-5-5"
verified-by:
  - round: 1
    lane: claude-opus-5-5
    checks: gpt-6.1-terra and claude-sonnet-5-5 workers
  - round: 1
    lane: gpt-6.2-sol
    checks: gpt-6.1-terra and claude-sonnet-5-5 workers
  - round: 2
    lane: claude-opus-5-5
    checks: gpt-6.1-terra and claude-sonnet-5-5 workers
  - round: 2
    lane: gpt-6.2-sol
    checks: gpt-6.1-terra and claude-sonnet-5-5 workers
  - round: 3
    lane: claude-opus-5-5
    checks: gpt-6.1-terra and claude-sonnet-5-5 workers
  - round: 3
    lane: gpt-6.2-sol
    checks: gpt-6.1-terra and claude-sonnet-5-5 workers
---

# Completion Report — Windows localhost tools from WSL

Written for a hostile reviewer: every claim checkable, no claim without evidence. Line
numbers are at commit `2281d593` (the feature branch tip when this was written) unless
stated.

## Spec coverage

All rows are `this run`; the plan has no Prior Work section (it builds on main `87923e58`,
Windows bridge solid, which is the base, not prior work for this Spec).

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| Terms: shared eligibility rule (regex, `http` only, port 1–65535, default 80) and origin text | this run | `machine/lib/win-mark.js:2-9`; page copy `viewer/pages/project-tools.js:13-20` | `machine/test/win-mark.test.js`; `viewer/test/win-mark-parity.test.js` (asserts the page regex equals the machine one; runs now that both are merged) |
| Terms: "On WSL" = `detected.kernel` | this run | `machine/service.js:856`, `:863`, `:2128`, `:271` | `machine/test/win-forward-service.test.js` "interop off withholds…", "off WSL loads original tool…" |
| §1 `mcp.windows` (eligible, list order, de-duplicated) and warnings only on kernel | this run | `machine/lib/project-mcp.js:121-142` | `machine/test/project-mcp-reader.test.js` "Windows marks validate, deduplicate, and warn only on WSL kernel" |
| §1 malformed `wheelchair` → one warning; `{}` / other keys → none; unknown names silent | this run | `machine/lib/project-mcp.js:122-131` | same test |
| §2 step 1 gate: kernel, `TOOL_ROLES`, CLI claude/codex/agy; forwarded = `mcp.windows ∩ mcp.servers` | this run | `machine/service.js:863-864` | `win-forward-service.test.js` "reviewer, mapper, Kimi and Pi do not request forwards or Claude config" |
| §2 step 2 get forward per tool; failure → withheld | this run | `machine/service.js:866-880` | "interop off withholds marked tool and logs it for every CLI" |
| §2 step 3 textual URL rewrite, withhold on no match, config built once | this run | `machine/lib/win-mark.js:10-13`; `machine/service.js:870-875`, `:883` | `win-mark.test.js` (`${PROJECT}?a=b#c` case); "marked Claude tool is rewritten once…" (counts `commandFor` calls) |
| §3 shared `replaceEntries` contract: own keys, Map or null-prototype, `null` omits | this run | `machine/adapters/common.js:24`; `codex.js:55-57`, `:144`; `agy.js:35-38`; `claude.js:63-79` | `machine/test/replace-entries.test.js` (3 CLIs × replaced/withheld/untouched, `__proto__`, `constructor`, Map) |
| §3 Windows classification from the original entry | this run | `machine/adapters/common.js` `loadedTools` (unchanged, called with original `mcp`); `codex.js:83` | `replace-entries.test.js` "Codex uses original Windows classification…", "Claude preserves original Windows classification…" |
| §3 Claude: `disabledMcpjsonServers` + per-session `--mcp-config` at `<stateDir>/settings/<name>.mcp.json`, 0600 atomic, removed at stop, swept after 60 s | this run | `machine/adapters/claude.js:63-79`; `machine/service.js:889`, `:1238`, `:478-492` | "marked Claude tool is rewritten once, written privately and removed at stop"; "MCP sweep preserves live, starting and young files and removes stale files" |
| §3 withheld log line and `loaded` omits withheld | this run | `machine/service.js:878`; `claude.js:79`, `codex.js:144`, `agy.js` | "interop off withholds…" (log line and absence of the original URL in argv, settings and agy files) |
| §4 forward table, concurrent gets share one creation, `unrecorded` state and retry, relay readiness on every get | this run | `machine/lib/win-forward.js:122-141`; readiness `machine/lib/win.js:23` | `machine/test/win-forward.test.js` "shared forward and serialized concurrent records; retry a failed record" |
| §4 per-connection relay: pre-`OK` 64 KiB buffer, header parse (512 B), `OK`/`REFUSED`/12 s timeout/start failure, one outcome per connection, judged on `close`, errors stay local | this run | `machine/lib/win-forward.js:55-121` | `win-forward.test.js` tests at lines 59-111 (pre-OK bytes, refusal, FIN/reset before OK, timeout/no header/long header/failed start, immediate OK/REFUSED, upload failure stays local, last bytes, buffering pause, backpressure, stand-in stdin closure) |
| §4 relay script: 5 s dial, refusal reasons, owner of the exact connection, `wslrelay` refused, fail closed, `connect`/`check` modes, raw stdout | this run | `machine/lib/win-relay.ps1:1-100` | `machine/test/win-relay-live.test.js` (real `powershell.exe`, 12/12, below) |
| §4 status check: one `check` relay, 10 s cap, records nothing | this run | `machine/lib/win-forward.js:142-175` | `win-forward.test.js` "check uses check mode, reports headers and timeout without records or forwards" |
| §5 record `win/forwards.json` 0600 atomic, serialized writes | this run | `machine/lib/win-forward.js:27-40` | "shared forward and serialized…" (mode 0600 asserted) |
| §5 restart: restore unless tmux lists no `wc-` session; stale forwards; restore regardless of relay readiness | this run | `machine/lib/win-forward.js:184-194`; `machine/lib/win.js:344` | `win-forward.test.js` "restart restores while unavailable…", "restart without wheelchair tmux empties record…"; `win-forward-service.test.js` "startup restores recorded ports even with interop off…", "startup with no live wheelchair tmux session clears the forward record" |
| §6 `POST /v1/project-tools/windows-status` (hub-authorized; eligible only; `unavailable`/`reachable`/`unreachable`; `note`; `last`; off WSL `{wsl:false}`) | this run | `machine/service.js:2123-2145`; `machine/lib/win-forward.js:176-183` | `win-forward-service.test.js` "status route checks only eligible tools without creating forwards", "windows status validates input, reports unavailable, thrown and timed-out checks and off WSL" |
| §6 viewer pass-through | this run | `viewer/app/routes.js:68` | `viewer/test/app-project-tools.test.js` (windows-status pass-through) |
| §6 page status line, states, note, last refusal, check time, Check again | this run | `viewer/pages/project-tools.js:500-530` | `viewer/test/app-project-tools.spec.js` status-state tests |
| §6 status store: guard + type + url, epoch, pending-request match, 500 ms debounce batching, failed request, every render reads it | this run | `viewer/pages/project-tools.js:423-499` | `app-project-tools.spec.js` `timing:` tests (T6, T7: held requests, A→B→A, Keep before debounce, rename/kind/Unity poll/same-project reload while pending, same-name rows batched, two-key batching, network abort, save clears) |
| §7 read reply `wsl` (kernel) and `windows` | this run | `machine/lib/project-tools.js:36`, `:76`, `:82`; `machine/service.js:271` | `machine/test/project-tools.test.js` "Windows marks read and save…"; `win-forward-service.test.js` "project tools read route reports kernel WSL state" |
| §7 save `windows`: absent keeps, `[]` clears, empty `wheelchair` removed, other keys kept, unchanged shortcut compares both | this run | `machine/lib/project-tools.js:97-120` | `project-tools.test.js` "Windows marks read and save independently while preserving document keys" |
| §7 page switch (WSL + eligible), help text, dirty on switch, rename/delete update, hidden marks kept, key-only save sends no `windows` | this run | `viewer/pages/project-tools.js:535-555` and save/dirty code | `app-project-tools.spec.js` switch tests |
| Validation: live relay test | this run | `machine/test/win-relay-live.test.js` | run below, 12/12, no skips |
| Check Once Built C1 (Claude, Codex, Antigravity) | this run | — | Claude and Codex passed live (below). **Antigravity not tried**: `agy` is not installed on this machine; covered only by `replace-entries.test.js` and `win-forward-service.test.js` "Codex and Antigravity receive private URLs" |
| Check Once Built C2 | this run | — | live, below |
| Check Once Built C3 (mirrored networking) | — | — | **Not tried**: this machine runs default networking and the build must not change WSL settings |
| Check Once Built C4, C5 | this run | relay uses `netstat.exe -ano` (`win-relay.ps1:32-42`) | C5: first `Get-NetTCPConnection` lookup 1,139 ms vs `netstat` 20 ms (T3b report); relay start to `OK` 540–930 ms; `check` start to exit 565–837 ms; both well inside the 12 s header limit and 10 s status cap |

## Deviations from plan

- **Owner lookup uses `netstat.exe -ano`**, not `Get-NetTCPConnection`, as C5 permits (measured above).
- **Extra withheld reason** `invalid Windows tool address` when the rewrite rule no longer matches at start (`machine/service.js:871-874`). §3 lists three reasons; this case is withheld as §2 step 3 requires, with its own log text.
- **Status store cleared on every successful read**, not only after a save reread (`viewer/pages/project-tools.js`, T5 choice). Results are re-checked after a reload; nothing stale is shown.
- **Marks naming tools that are not in `mcpServers` are dropped by the page on read**, so the next save that sends `windows` removes them (T5 choice). §7 only says renames and deletes update the list.
- **Claude's `.mcp.json` file** is removed in the normal `stop()` path; a stop that ends early through the fatal-end path, or a start that fails after writing it, leaves it for the 60 s sweep (`machine/service.js:977-980` fatal-end path, `:1238` normal removal, `:478-492` sweep).
- All other choices are logged one per line in `PLAN.md` Log.

## Routers

- `machine/AGENTS.md`: new rows for `lib/win-mark.js`, `lib/win-forward.js`, `lib/win-relay.ps1`; `lib/project-mcp.js` row now names the `wheelchair.windows` marks.
- `viewer/AGENTS.md`: `pages/project-tools.js` row now names the Runs on Windows switch and its status line.

## Validation evidence

All at `2281d593` on WSL2 (default networking, interop on).

`node --test machine/test/*.test.js` — exit 1, only pre-existing failures:

```text
ℹ tests 637
ℹ pass 633
ℹ fail 4
ℹ skipped 0
test at machine/test/aside-turns.test.js:152:1
test at machine/test/kimi.test.js:166:1
test at machine/test/plan-files.test.js:21:1
test at machine/test/plan-files.test.js:36:1
```

`bash machine/test/run.sh` — exit 1, same 637/633/4.

`node --test viewer/test/*.test.js` — exit 1, only pre-existing failures:

```text
ℹ tests 784
ℹ pass 782
ℹ fail 2
ℹ skipped 0
test at viewer/test/app-slug.test.js:43:1
test at viewer/test/app-slug.test.js:65:1
```

**These six failures are pre-existing.** The same six fail on `5619e1fd` (the commit before the
build started), run from a `git archive` copy:

```text
ℹ pass 46
ℹ fail 6
test at machine/test/aside-turns.test.js:152:1
test at machine/test/kimi.test.js:166:1
test at machine/test/plan-files.test.js:21:1
test at machine/test/plan-files.test.js:36:1
test at viewer/test/app-slug.test.js:43:1
test at viewer/test/app-slug.test.js:65:1
```

Causes, from their messages: the Pi aside returns `failed`; `Kimi Code is not installed`;
`listen EADDRINUSE 127.0.0.1:7374` (the machine's real service holds that port); the two
`app-slug` plan-discovery cases.

`npm --prefix viewer run test:browser` — exit 0, Chromium and Firefox:

```text
  34 skipped
  1212 passed (11.4m)
browser exit 0
```

`node --test machine/test/win-relay-live.test.js` — exit 0, real `powershell.exe`, no skips:

```text
OK latency 127.0.0.1: 903 ms
  ✔ 127.0.0.1 listener passes data (1645.650503ms)
OK latency 0.0.0.0: 648 ms
  ✔ 0.0.0.0 listener passes data (1208.361849ms)
OK latency ::: 604 ms
  ✔ :: listener passes data (1163.8264ms)
  ✔ no listener is refused (3116.992331ms)
  ✔ Linux localhostForwarding is refused (793.569687ms)
  ✔ 16 MiB in each direction arrives intact (1248.712256ms)
Stalled Windows sender: 786432 bytes reported
  ✔ stalled stdout bounds Windows sends (5505.029997ms)
  ✔ last bytes before Windows close arrive (1220.151651ms)
Check start to exit: 582 ms
  ✔ check prints one line and exits (984.632043ms)
  ✔ stdin close ends connect relay (1183.657486ms)
  ✔ 40 assorted ports all start and print a header (9622.872667ms)
✔ Windows relay live (27695.788412ms)
ℹ tests 12
ℹ pass 12
ℹ fail 0
ℹ skipped 0
```

**C1 and C2, live (sub-lead).** A minimal streamable-HTTP MCP server ran under Windows
`node.exe` on `127.0.0.1:<tool port>`, returning a one-off marker from a `secret_word` tool.
A Linux harness created a forward with the real `machine/lib/win-forward.js` and the real
`spawnPs` from `machine/lib/win-env.js`, then ran `claude -p` with a `--mcp-config` file and
`codex exec` with `-c mcp_servers.wintool.url=...`, both pointing at
`http://127.0.0.1:<private port>/mcp` with a custom `x-secret` header. This drives the forward
and relay end to end with the real CLIs; the service's own start path (building
`replaceEntries`, the Claude file) is covered by `win-forward-service.test.js`, not by this
run. Output:

```text
tool port 47260 marker pineapple-dytj3d
private port 41995 record {"forwards":[{"tool_port":47260,"private_port":41995}]}
direct POST via forward: 200 {"jsonrpc":"2.0","id":1,"result":{"tools":[{"name":"secret_word",... 680 ms
status check: {"ok":true} {}
CLAUDE exit 0 out: pineapple-dytj3d
CLAUDE got marker: true
CODEX exit 0 out tail: pineapple-dytj3d
CODEX got marker: true
C2 attempt 0: {"error":"ECONNRESET"}
C2 attempt 1: {"error":"ECONNRESET"}
C2 attempt 2: {"error":"ECONNRESET"}
C2 status: {"ok":false,"reason":"port 47260 on Windows leads back to Linux"} last: {"last":{"reason":"port 47260 on Windows leads back to Linux","at":"2026-11-22T03:22:51.357Z"}} linux listener connections: 4 bytes: 0
Windows server restarted: true
after Windows restart: 200 {"jsonrpc":"2.0","id":3,"result":{"tools":[{"name":"secret_word",... last: {}
```

What the Windows server logged (counts):

```text
      2 CALL secret_word
      1 REQ GET /mcp host=127.0.0.1:41995 auth=S3CRET
      9 REQ POST /mcp host=127.0.0.1:41995 auth=S3CRET
```

C2 procedure: the Windows server was stopped and a Node listener was bound on the same tool
port in WSL (reachable from Windows through localhostForwarding). Three requests through the
private port were each closed without a reply, the status check and `last` reported
`port <n> on Windows leads back to Linux`, and the Linux listener received **0 bytes**. After
the Windows server started again, the same private port worked and `last` was cleared.

## Known gaps / residual risks

- **C2 nuance, for the verifier to judge:** the Linux listener did receive 4 TCP connections
  carrying no bytes. They are the relay's own dials (one per refused request plus the status
  check): by D13 the relay connects first and then identifies the owner of that exact
  connection, refusing it before any client byte is sent. No headers or other request bytes
  reached the Linux program.
- **Simultaneous bulk both ways stalls (T3b finding).** With a Windows echo server and 16 MiB
  written while reading, a `connect` relay stalled after about 1.2–1.4 MB each way; the cause
  was not found. Sequential 16 MiB each way passes. MCP over HTTP sends a request and then
  reads the reply on that connection, so this needs large uploads and downloads at the same
  time on one connection.
- **Antigravity live (C1) not tried**: `agy` is not installed here. **C3 (mirrored networking)
  not tried**: this machine uses default networking and the build does not change WSL settings.
- **Live relay test under heavy load:** one full-suite run of `node --test machine/test/*.test.js`
  had the live 16 MiB case fail while browser test runs were loading the machine; it passed in
  every later run (three full-suite runs and every run on its own).
- **WSL interop quirk:** on this machine `powershell.exe` refuses to start for some long
  single-line command texts (`Invalid argument`, content-dependent). All shipped PowerShell is
  multi-line; the live test's 40-port sweep starts the relay on every port tried.
- **Claude `.mcp.json` leftovers** after a fatal stop or a failed start are removed by the 60 s
  sweep, not at once (see Deviations).
- Accepted Risks in `PLAN.md` stand as written.

## Remediation rounds

### Remediation 1 (after verification attempt 1 on `f3136ca1`)

- **Gaps fixed:** COMPLETION.md and the `viewer/AGENTS.md` router row were not in the verified commit (multi-path `--paths` written with spaces). Both committed at `05f14a7a`; see `REMEDIATION-1.md`.
- **Rare paths recorded in PLAN.md Accepted Risks (verification-1):** simultaneous bulk both ways stalls (both verifiers); more than 100 tools in one status request gets a 400; private port equal to the tool port with the Windows server down dials its own listener once before refusing.
- **Verifier evidence carried forward:** both verifiers re-ran C1 (Claude and Codex) and C2 live with the same results as above, and saw only the six pre-existing Node failures. The gpt verifier's full browser run had one Chromium message-composer failure that passed all three isolated retries; the claude verifier's run was cut off by its time cap with all 1055 finished tests passing.
- No code changed in this remediation, so the validation evidence above stands.

### Remediation 2 (after verification attempt 2 on `af3e6d5c`)

- **Gap fixed (R2-1):** an open Edit form wrote back the switch value captured when it opened, undoing a card-switch change. Fix in `viewer/pages/project-tools.js` (T8): the form follows the tool's live mark until its own switch is touched (`formWinOn()`, `winTouched`), and Keep changes writes that. New browser tests in `viewer/test/app-project-tools.spec.js`: card off then Keep (sends `windows: []`), card on then Keep (sends `["loc"]`), touching the form switch after a card change wins, Cancel keeps the card's value.
- **Rare path recorded in Accepted Risks (verification-2):** duplicate names in `wheelchair.windows` enable Save before any edit.
- **Validation after the fix:** `npm --prefix viewer run test:browser -- app-project-tools` → `200 passed (1.5m)`; `node --test viewer/test/app-project-tools.test.js viewer/test/win-mark-parity.test.js` → all pass. Only the page and its spec changed; the machine, live relay and C1/C2 evidence above stands (re-confirmed by both attempt-2 verifiers, and the claude verifier also ran C1/C2 through the service's real start path).

### Verification 3 (on `8734b7be`)

claude-opus-5-5 PASS; gpt-6.2-sol reported one rare path only (a malformed-header marked entry gets a misleading warning), recorded in PLAN.md Accepted Risks (verification-3). Both re-ran the suites (only the six pre-existing Node failures; full browser 1220 passed in the claude run, 1219 + one pre-existing Chromium composer timeout in the gpt run), the live relay test (12/12), and C1/C2 live with Claude and Codex.
