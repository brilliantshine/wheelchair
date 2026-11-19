---
slug: project-tools-solid
date: 2026-11-18
implemented-by: "standard / gpt-6.1-terra (T1-T5), standard / claude-sonnet-5-5 (T6); sub-lead claude-opus-5-5"
verified-by: []
---

# Completion Report — Make project tools solid

Written for a hostile reviewer: every claim checkable, no claim without evidence. Line numbers are on the feature branch tip.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| §1 sse accepted with non-empty url | this run | machine/lib/project-mcp.js:42 | machine/test/project-mcp-reader.test.js |
| §1 http/sse headers must be an object of strings; invalid-entry text "not a valid stdio, http or sse entry" | this run | machine/lib/project-mcp.js:42,44 | project-mcp-reader.test.js; project-mcp.test.js:72 |
| §1 `hash` = SHA-256 of file bytes, null without a file | this run | machine/lib/project-mcp.js:12,19,34,46 | project-mcp-reader.test.js |
| §2 `${...}` rule (env same-key, header whole-value `${NAME}`, never expanded) | this run | machine/adapters/codex.js:76-98; machine/adapters/agy.js:42-51 | project-mcp-codex.test.js; project-mcp-agy.test.js |
| §3 sse skip, duplicate header skip | this run | machine/adapters/codex.js:72-73 | project-mcp-codex.test.js |
| §3 bearer_token_env_var / env_http_headers / http_headers / other `${` skip, tomlString, emit only when non-empty, never `bearer_token` | this run | machine/adapters/codex.js:84-102 | project-mcp-codex.test.js |
| §3 `systemd-run --description=wheelchair <name>` | this run | machine/service.js:731 | machine/test/project-tools-service.test.js |
| §3 `redactions` and `<redacted>` in `session.command`; tmux gets real argv | this run | machine/adapters/codex.js:123-125; machine/service.js:724-725 | project-mcp-codex.test.js; project-tools-service.test.js |
| §3 budget in UTF-8 bytes, whole drop, line names every dropped server | this run | machine/adapters/codex.js:29,119-121 | project-mcp-codex.test.js (non-ASCII case) |
| §3/§7 skip lines are `{names, text}`; log prints `text` | this run | machine/adapters/codex.js; machine/adapters/agy.js:54; machine/service.js:702 | project-mcp.test.js:72-74 |
| §4 plugin dir path, 0700 dirs, 0600 files, atomic writes, `--add-dir` | this run | machine/adapters/agy.js:58-67; machine/service.js:705-722 | project-mcp-agy.test.js; project-tools-service.test.js |
| §4 `command` returns files, writes nothing | this run | machine/adapters/agy.js:58-67 | project-mcp-agy.test.js |
| §4 translation, only transport fields read, `type: "http"` | this run | machine/adapters/agy.js:39-52 | project-mcp-agy.test.js (stray args/headers) |
| §4 variables: same-key env left out, other `${` skips, literals copied | this run | machine/adapters/agy.js:42-51 | project-mcp-agy.test.js |
| §4 skips: sse, bad name, duplicate header; all skipped → no dir/`--add-dir` | this run | machine/adapters/agy.js:37-41,59 | project-mcp-agy.test.js |
| §4 old "aren't supported on Antigravity yet" warning removed | this run | machine/adapters/agy.js | project-mcp.test.js:74; project-mcp-agy.test.js |
| §4 non-tool roles get no `--add-dir` | this run | machine/adapters/agy.js:34,59 | project-mcp-agy.test.js; project-tools-service.test.js (reviewer) |
| §4 `sweepAgyTools()`: synchronous, startingNames then liveTmux, null → nothing, 60 s rule, decode/name rule; called after stop, in start's finally, every 60 s | this run | machine/service.js:380,392-410,662,882 | project-tools-service.test.js |
| §5 `missingPrograms` (stat+X_OK, string joining, `/` vs PATH search, empty/relative entries → worktree, line text, `${` not checked) | this run | machine/lib/project-programs.js:6-36 | machine/test/project-programs.test.js |
| §5 PATH from `tmux show-environment -g PATH`, 2 s deadline, fallback to service PATH; only thread-worktree tool starts with servers | this run | machine/service.js:602-614,698-700 | machine/test/project-tools-state.test.js |
| §5 all-invalid file in thread worktree → `programs = []`, no PATH read | this run | machine/service.js:629-631,700 | project-tools-state.test.js |
| §6 thread-worktree test by realpath; failure never aborts | this run | machine/service.js:594-600 | project-tools-state.test.js |
| §6 state shape, load on first use, steps 1-4 in one synchronous block, recompute other CLIs' lines | this run | machine/service.js:616-648 | project-tools-state.test.js |
| §6 per-thread write chain, `.tmp` then rename, failed write logged, startup `.tmp` sweep | this run | machine/service.js:355-356,641-647 | project-tools-state.test.js |
| §6 retried start returns same `project_tools`; omitted from list/status | this run | machine/service.js:656-662,1263 | project-tools-state.test.js |
| §8 thread `project_tools` record; `applyProjectTools` in startSession (covers retryWaiting) and resumeUnanswered without re-locking; boot/seq/created_at rule; not left on session record | this run | viewer/app/sessions.js:151-170,243,251,389,404 | viewer/test/app-project-tools.test.js |
| §8 card reconcile (order, dedupe, identity, replace/update/close, 20-line cap) | this run | viewer/app/sessions.js:141-182 | app-project-tools.test.js |
| §8 `session list` `project_tools.problems` on the (newest) lead; `wc.js` compact field | this run | viewer/app/sessions.js:645-647; viewer/app/wc.js:98 | app-project-tools.test.js |
| Validation: README "Project MCP tools" rewritten | this run | README.md:168 | read |

## Deviations from plan

- §8 does not say which lead entry gets `project_tools` when a thread holds several lead sessions (after a lead restart); the newest lead gets it.
- Codex header names are not scanned for `${` (they become literal TOML keys; nothing is expanded). §3 speaks only of values.

## Routers

- `machine/AGENTS.md`: added a row for the new `lib/project-programs.js`.
- `machine/API.md`: `POST /v1/sessions` documents the `project_tools` answer, `<redacted>` overrides and the Antigravity plugin dir; `GET /v1/sessions` notes `project_tools` is never listed.

## Validation evidence

Run on the feature branch after all merges:

```
$ bash machine/test/run.sh
# pass 190
# fail 0
$ node --test viewer/test/*.test.js
# pass 646
# fail 0
$ node --test test-support/test/*.test.js
# pass 9
# fail 0
$ bash install/test/run.sh
FAIL real wheelchair directory is byte-identical after suite
RESULT 186 passed, 1 failed
```

The one installer failure compares the real `~/.wheelchair` tree before and after the suite; this branch changes no installer file (`git diff main...HEAD --stat` touches no `install/` or `install.sh`), and live sessions on this machine write under `~/.wheelchair/accounts` while the suite runs. Treated as environment noise; the verifier should re-check.

Manual hearth checks (Antigravity stdio and http tool, Antigravity reviewer without tools, Codex bearer tool) are left for verification, as the brief asked.

## Known gaps / residual risks

- Not separately tested: removing one server while another remains on the cross-CLI recompute path (same code path as a fixed server, which is tested); the verifier-checkout reset test uses a distinct path rather than a real git branch.
- Codex budget-drop line text names servers inline; very many servers make a long line (the card caps at 20 lines, not line length).
- Accepted Risks in PLAN.md stand as written.

## Remediation rounds

### Remediation 1 (after verification attempt 1 on `23cfa5f`)

Attempt 1: Claude verifier PASS; GPT verifier FAIL with two gaps (`REMEDIATION-1.md`). Manual hearth checks passed under both verifiers.

| Gap | Fix | Implemented at | Validated by |
|-----|-----|----------------|--------------|
| §§3–4: an exact duplicate header key was lost by `JSON.parse`, so the server was enabled | The reader scans the raw text for `mcpServers.<name>.headers` objects with keys equal ignoring case and marks such http/sse entries with the `DUPLICATE_HEADERS` symbol; both adapters skip with "has the same header twice". A scan that overflows on extremely deep (valid) nesting gives up quietly; the file still reads | machine/lib/project-mcp.js (`duplicateHeaderServers`, `DUPLICATE_HEADERS`); machine/adapters/codex.js:73; machine/adapters/agy.js:41 | machine/test/project-mcp-reader.test.js (exact, case, escaped, other paths, 15,000-deep); project-mcp-codex.test.js; project-mcp-agy.test.js |
| §6: saved state with a wrong shape (`null`, `{}`) aborted the start or gave `seq: null` | `validProjectToolsState` checks the loaded shape; anything else is the empty state, as for a missing file | machine/service.js (`validProjectToolsState`, `updateProjectTools` loader) | machine/test/project-tools-state.test.js (null, {}, [], bad seq, malformed lines, valid state) |

Also hardened: the fake tmux in `project-tools-state.test.js` now drains stdin on `load-buffer` (the `tmux buffer failed` flake both verifiers saw once).

Known stricter-than-needed behaviour: a server whose `headers` key itself appears twice, or whose name repeats, is skipped if any occurrence has a duplicate header.

Validation after remediation (feature branch):

```
$ bash machine/test/run.sh     # run 1
# pass 195
# fail 0
$ bash machine/test/run.sh     # run 2
# pass 195
# fail 0
$ node --test viewer/test/*.test.js
# pass 646
# fail 0
$ node --test test-support/test/*.test.js
# pass 9
# fail 0
```
