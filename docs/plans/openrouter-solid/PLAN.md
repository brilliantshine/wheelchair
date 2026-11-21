---
slug: openrouter-solid
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-20
---

# Make OpenRouter agents solid

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first. Map: `MAP.md`
and `docs/maps/openrouter-hardening.md`. Prior plan: `docs/plans/openrouter-harness/PLAN.md`.

## Open Questions

(none)

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Plan mode is proof-of-concept | User's pick | user |
| 2 | Spend per thread and per agent is out of scope | User removed it from the idea | user |
| 3 | Spend line on the usage view is in scope | User reported it as a bug (screenshot) | user |
| 4 | OpenRouter thinking levels map 1:1 to Pi's `--thinking` for the app's existing low, medium, high, xhigh, max; Pi's off and minimal are not offered | Keeps one set of levels across providers | defaulted |
| 5 | OpenRouter asides use Pi's `--fork` for the first turn and `--session` to resume, in non-interactive JSON mode, with read-only asides limited to Pi's read tools as reviewers are today | Mirrors Claude/Codex aside flow; reuses the existing reviewer tool allowlist | defaulted |
| 6 | A failed transcript read when a turn ends is retried and never treated as an empty report; only a transcript that is truly absent or has no reply counts as empty | Losing a report in normal use is always fixed | defaulted |
| 7 | Pi older than 1.5.2 is refused; newer versions run, Settings marks them untested, and a Pi start or turn failure on an untested version names the version as the likely cause | User picked run-with-warning over blocking | user |
| 8 | Keep side conversations in this plan and review again after round 3 | User's pick when the review budget stopped | user |

## Spec

Four OpenRouter (Pi) items plus one all-provider report fix. Evidence: `MAP.md`,
`docs/maps/openrouter-hardening.md`. Installed Pi is 1.5.2; its docs are in
`$(npm root -g)/@earendil-works/pi-coding-agent/docs/` (`json.md`, `cli.md`, `session-format.md`).

### S1. Spend line on the usage view

- `viewer/pages/settings.js:1391-1395` renders OpenRouter spend inside `.usage-left`, a fixed
  76px column (`viewer/pages/settings.css:190`), so it wraps a word or two per line.
- Give the spend text its own class rule: it takes the remaining width of the row
  (`flex: 1 1 auto; min-width: 0; text-align: left`), so the whole line
  ("<$0.01 today · <$0.01 last 7 days · <$0.01 last 30 days") sits on one line when the row is
  wide enough, and wraps only at phone widths. The name column must not squeeze "OpenRouter".
- Limit bars stay unchanged for other providers. OpenRouter never shows a limit bar or
  "no reading yet" when spend is present.
- Test: a browser test (in the suite run by `npm --prefix viewer run test:browser`)
  or a page test asserting the spend element does not have the 76px column rule and, at a
  1200px-wide viewport, renders on one line (its height equals one line box).

### S2. Thinking levels for OpenRouter agents

The app's levels low, medium, high, xhigh, max map 1:1 to Pi's `--thinking <level>`. Pi's
`off` and `minimal` are not offered. A blank setting passes no `--thinking` flag and leaves the
level to Pi (its saved session level on resume or fork, its configured default, or a model
suffix). Pi clamps an explicit level the model cannot do; wheelchair does not check capability.

Change every gate that drops effort for OpenRouter:
- `viewer/app/providers.js:3`: openrouter `effort: true` (drives `routes.js:263`,
  `sessions.js:107-108,206,350`; fix the stale comment at `sessions.js:349`).
- `viewer/app/routes.js:265`: validate openrouter effort like claude/gemini.
- `codex/model.sh:104` and `:441-442`: stop treating openrouter effort as malformed or
  rejected; kimi keeps its rule.
- `machine/service.js:780`: only kimi clears effort.
- `machine/adapters/pi.js` `command()`: append `--thinking <effort>` when the session has one.
- `viewer/pages/settings.js:16`: OpenRouter gets the effort select with the five levels.
- Tests: Settings round-trip of an OpenRouter effort pin (pattern of
  `viewer/test/app-kimi-settings.test.js`), `codex/test/run.sh` accepts it, a machine test that
  Pi argv carries `--thinking high` for effort high and none when unset.

### S3. Side conversations on OpenRouter-led threads

Same behaviour as Claude/GPT asides (`viewer/app/asides.js`, `machine/lib/aside-turns.js`):
first turn forks the lead's Pi session, later turns resume the fork.

- Hub: `providers.js` openrouter `asideFork: true`; `asides.js:41` parent map gives openrouter
  the lead's `cli_session_id` (the Pi session id the machine created, `machine/adapters/pi.js:59`).
- Machine validation (`aside-turns.js:58-71`): accept provider `openrouter`; for it accept the
  OpenRouter model grammar (`vendor/model[:variant]`, as `viewer/pages/settings.js:19`).
  Replace the claude/gpt fallback at `aside-turns.js:95` with an explicit provider→adapter map
  (claude→claude, gpt→codex, openrouter→pi), so no provider silently runs another CLI.
- `machine/adapters/pi.js` gets `asideArgv(i, { prompt })`:
  `pi --provider openrouter --model <model> --mode json -p`, then `--fork <from> --session-id <new_id>` for mode fork
  (the hub supplies `new_id` for OpenRouter forks, as it does for Claude, `aside-turns.js:64`) or
  `--session <from>` for mode resume, `--append-system-prompt <prompt>`, `--no-extensions`
  (no wheelchair hook bridge or MCP in an aside; explicit `-e` paths still load), `--thinking <effort>` when set, and an explicit `--tools` on every
  turn, fork and resume alike, because Pi restores a session's saved tool selection when `--tools`
  is omitted: `read-only` (the default) → `--tools read,grep,find,ls`; `full` → `--tools
  read,bash,edit,write,grep,find,ls`. Switching access between turns therefore takes effect on the
  next turn.
- Read-only boundary: Settings promises read-only asides read only the worktree
  (`viewer/pages/settings.js:538-541`), and Pi's read tools accept any path. A read-only aside also
  loads a small static wheelchair Pi extension (`-e`, one file under `machine/adapters/`,
  checking against the handler's `ctx.cwd`, which is the worktree since the aside is spawned with
  `cwd: i.cwd`) whose `tool_call` handler blocks (`{ block: true, reason }`) any
  read/grep/find/ls call whose path argument resolves, the way Pi itself resolves it, to a file
  or directory that falls outside both the worktree and wheelchair's own
  `protocol/` directory (the aside prompt tells it to read `protocol/app/aside.md`,
  `machine/lib/aside-turns.js:98`). A call with no path uses the worktree.
  "The way Pi resolves it": first Pi's `resolveToCwd` rules (`~` expansion, leading `@` stripped,
  unicode spaces normalized, relative to `ctx.cwd`; Pi `dist/core/tools/path-utils.js:42`), then,
  for `read`, every alternate name `resolveReadPath` may try (`path-utils.js:45-70`). Each
  candidate that exists is checked by `realpath`; one that does not exist is checked by the
  `realpath` of its nearest existing parent. The call is blocked if any candidate falls outside the
  allowed directories. Use Pi's exported functions if the installed package exports them;
  otherwise mirror that logic in the extension. Full access loads no such extension. The
  message is passed on stdin or as the final argument, whichever Pi's `-p` supports
  (`cli.md`). Login env comes from `adapter.loginEnv(dir)` as for other providers.
- Output parsing (Pi JSON mode, `json.md`): the first record is the session header
  `{"type":"session","id":...}`; `conversation_id` is `new_id` for fork and `from` for resume, as
  for Claude (`aside-turns.js:125`); a missing header, or a header id that differs
  (fork: must equal `new_id` and differ from `from`; resume: must equal `from`), is a failure, so a
  bad id is never saved as the aside's `cli_id` (`viewer/app/asides.js:138`). Success is judged from the settled outcome only: Pi retries
  rate limits and network errors itself (`json.md:38-48`), so an earlier errored assistant
  message followed by a successful retry is a success. The reply is the text of the last
  assistant `message_end`. Failure: non-zero exit, no assistant text after settling, or the
  last assistant message has `stopReason` `"error"` or `"aborted"` (a partial reply from an
  aborted run is never accepted, even with exit 0) → `state: failed` with Pi's error message,
  else stderr's last line. `limit` is true only when the run ends failed and that final error
  is an HTTP 402/429 or "credit" / "rate limit" text.
- Redaction: `reply`, `error` and any stderr text are passed through `adapters/pi.js`
  `redact` before the aside result is stored or returned, so an OpenRouter key never reaches
  hub state.
- Version tie: the machine records the Pi version a session launched with (from the
  S4 probe at launch) and S4's failure notes use that recorded version, not the current one.
- Version gate: an OpenRouter aside on a machine whose Pi is refused by S4 (older than 1.5.2,
  or not installed) finishes at once as `state: failed` with S4's problem text. It is checked
  inside the runner, not at request validation, so the hub gets a terminal result and does not
  retry the dispatch.
- Spend from forks (the usage view's OpenRouter totals, `machine/adapters/pi.js` `spend()`): Pi copies the lead's entries, cost records included, into a
  forked session file (`dist/core/session-manager.js:1409-1425`). The spend scan
  (`machine/adapters/pi.js:24-46`) counts each assistant entry once per account, keyed by entry
  `id` plus `timestamp`, so aside forks add only their own new turns.
- Asides fork and resume in the lead's worktree (`i.cwd`), the same directory as the lead's
  session, so Pi finds the session by id.
- Tests: machine tests with a fake `pi` on PATH emitting JSON-mode records for fork, resume,
  error, an error followed by a successful retry (success), a key in reply and stderr (redacted),
  an old Pi (terminal failure, no dispatch retry), read-only argv, and a spend scan over a lead
  file plus its fork counting copied entries once, a read-only aside whose read of a path outside
  the worktree (including the account's `auth.json`) is blocked, run against Pi's real resolver
  with harmless fixtures: `../` escapes, `~/...`, an `@`-prefixed path, a symlink inside the
  worktree pointing outside, and a read of `protocol/app/aside.md` that is allowed, and resume argv carrying
  `--tools` for both access settings (pattern of existing aside tests); hub test that an OpenRouter lead
  allows an aside (update `viewer/test/app-asides.test.js` where it pins the refusal).
- Live check (costs money; keep it to one fork turn and one resume turn, model
  `deepseek/deepseek-v4.1-flash-1017`): extend `test-support/smoke/pi-live.js` or add a sibling,
  confirming fork produces a new id, resume keeps it, and the reply text comes back.

### S4. Pi version check

- Tested version: `1.5.2`. Older than 1.5.2 is refused; 1.5.2 up to any 1.5.x patch is
  tested; anything newer is untested but allowed (Decision 7).
- Machine: probe `pi --version` cached by executable and mtime, exactly as
  `checkKimiVersion` (`machine/service.js:1601-1619`), warmed at startup. A failed or
  unparseable probe counts as unknown (warning), not refused.
- `cliStatus('pi')` (`service.js:1636`) returns `version`, plus `problem`
  ("Pi 1.5.2 or newer is needed (found X)") when older, or `warning`
  ("Pi X is newer than the version wheelchair was tested with (1.5.2). If OpenRouter agents fail,
  this may be why.") when untested, or ("Pi's version couldn't be read. If OpenRouter agents
  fail, this may be why.") when unknown. A problem blocks OpenRouter starts like Kimi's
  (`service.js:772`) and marks OpenRouter accounts signed out; a warning blocks nothing.
- Hub: `viewer/app/usage.js` `machineAccounts` passes the Pi problem the same way as Kimi's
  (`usage.js:59-72,126`) and the warning as its own non-blocking field; `viewer/app/ready.js`
  must not block on the warning.
- Settings shows the problem or warning in plain words on each OpenRouter account's machine
  line (where `settings.js:1232` shows Kimi's problem); the warning is styled as a note,
  not an error.
- On an untested or unknown version, these messages end with a note: " Pi X is newer than the
  version wheelchair was tested with (1.5.2); that may be the cause." (unknown: " Pi's version
  couldn't be read; that may be the cause."):
  - a Pi session's `turn-failed` error;
  - a Pi session that never reaches its ready screen: the `stuck` event after 30s
    (`machine/service.js:1053-1057`) carries the note, and when Pi's pane is gone before ready,
    the machine ends the session with `end_reason` "Pi exited before it was ready" plus the note.
    The reason is set wherever the machine first finds a not-yet-ready Pi session's pane gone
    (the readiness check and the session list/status path alike) and persisted before any
    response reports the session as not running, so the hub never sees it ended without the reason;
    which the hub already shows in its "Session ended" card and to the starter
    (`viewer/app/sessions.js:773-789`). This exit reason applies on every Pi version; only the
    note depends on the version.
  - The hub's "Session stuck at startup" card (`viewer/app/sessions.js:618-621`) is built from a
    fixed string today; it appends the `stuck` event's `note` field when present. Hub test
    asserts the card text includes the note.
- Tests in `machine/test/pi.test.js` with a fake `pi --version` (pattern of
  `machine/test/kimi.test.js:175-235`): old → problem and start refused; 1.5.2 and 1.5.9 → clean;
  1.6.0 → warning, start allowed; probe failure → unknown-version warning; Pi pane gone before
  ready → session ended with "Pi exited before it was ready"; turn-failed text carries the note on
  an untested version only. Hub test that the warning reaches `/usage` and does not block Ready.

### S5. A report survives a brief failure reading the agent's log (every provider)

Today a failed transcript read becomes `''` (`viewer/app/chat.js:330-334`), `deliverReport`
returns without a report (`viewer/app/sessions.js:435`), and the turn and delivery ids are
already saved (`sessions.js:567-569,642-645`), so the report is never recovered.

- `chat.sessionTranscript` gets a strict mode for report readers: the first machine call may use up to
  3 seconds and each retry call up to 1 second, and a wall-clock deadline of 4 seconds from the first read is checked before every
  call and every gap; no call or gap starts after the deadline and a call never runs past it (its
  timeout is min(its cap, time left)). The bound covers transcript recovery only, not the rest of
  the event's handling (lock wait, saving state, queue delivery), which is unchanged. Its requests use the strict HTTP path
  (`viewer/app/machine-client.js:33`), so a connection dropped after headers rejects instead of
  hanging. A failed, timed-out or dropped call throws; a transcript that is genuinely absent (machine answers with no data, or 404)
  returns `''`.
- `deliverReport`: when the read throws, or when the CLI is `pi`, the event carries an
  `entry_id`, and the read (empty or absent included) does not contain that entry (the machine's copy can lag or fail, `machine/service.js:1403-1407`),
  retry the read inline: up to 3 more attempts, 500ms apart, within the same event handling and
  the 4-second budget.
  A text found inline in the hook payload (non-Pi) is used at once, as today.
- If every attempt fails, behave as today for a missing report: no result, and `quiet.arm`
  reminds the agent to repeat its report (`viewer/app/quiet.js:8-9`). That reminder is the
  recovery path; nothing is persisted and no timer is added.
- For non-Pi sessions, a genuinely absent or empty transcript behaves as today (no retries).
  For Pi with an `entry_id`, the entry rule above wins: an empty first read is retried. A delivered report is
  never delivered twice (`target.finished` guard stays).
- Tests in `viewer/test/` (pattern of `app-chat.test.js:362-375`): a reviewer whose first
  transcript read fails and second succeeds gets exactly one result delivered; a Pi verifier
  whose first read is empty and whose entry appears on a later read gets its report; an absent transcript makes one read only,
  produces no report and arms the quiet check; all attempts failing arms the quiet check; a first read that times out
  followed by a successful one delivers once; a connection dropped after headers fails that
  attempt and is retried; the recovery itself never exceeds 4 seconds (measured around
  the report read with a fake clock or a slow fake machine).

### Non-goals

Spend per thread/agent; any limit display for OpenRouter; supporting older Pi; Pi's off/minimal
thinking levels; aside support for Kimi or Antigravity.

### Validation

```bash
bash codex/test/run.sh
bash machine/test/run.sh
node --test viewer/test/*.test.js
npm --prefix viewer run test:browser
bash install/test/run.sh
```
Plus the live aside check in S3 (one fork, one resume, deepseek/deepseek-v4.1-flash-1017).

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| A custom OpenRouter model pin ending in a Pi thinking-level suffix (e.g. `:high`) combined with a thinking level in Settings may send a different model id than with the setting blank | Rare path: OpenRouter's own variants (`:free`, `:nitro`, ...) are not thinking-level names, so it needs a deliberately odd pin plus a level | review-round-2 |

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|
| 1 | S5's per-call caps hold against a response that keeps sending small chunks past the cap (the strict client's timeout is a socket inactivity timeout, `viewer/app/machine-client.js:15-46`), not just a silent one | review-round-4 |

## Review Rounds

### Round 1 — 2026-11-20

**Lanes:** intent (claude); mechanics (other family); cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | S5 over-built: the quiet reminder already recovers the report; persisted pending + 2-minute timer not needed | upheld | S5 now retries inline (3 attempts, 1s apart) then falls to the quiet reminder; IDEA's "never recovered" overstates: today recovery costs an extra agent turn (noted in Log) |
| intent | minor | Pi missing-entry rule would delay the quiet reminder ~2 minutes | upheld | Resolved by the same change: at most ~3s delay |
| mechanics | blocking | Aside forks copy cost records; spend counts them twice | upheld | S4 spend scan dedupes by entry id + timestamp |
| mechanics | blocking | Pi auto-retry: an early error would fail a reply that later succeeded | upheld (major: worker would have to ask) | S3 judges the settled outcome; fixture added |
| mechanics | blocking | Aside reply and stderr not redacted | upheld | S3 redacts reply, error, stderr |
| mechanics | blocking | Aside bypasses the old-Pi gate; refused dispatch retried forever | upheld (major) | S3 version gate inside runner, terminal failed result |
| mechanics | major | No visible path for Pi exiting before ready | upheld | S4: stuck event and "Pi exited before it was ready" end_reason carry the note |
| mechanics | minor | Unknown version worded as "newer" | upheld | S4 separate unknown wording |
| mechanics | blocking | S5 pending record vs queued input | declined | Reviewed a superseded S5: after the intent finding S5 retries inline (~3s) with no pending record, so no later turn can interleave |
| mechanics | major | Pi empty first read: absent vs missing entry conflict | upheld | S5: for Pi with entry_id the entry rule wins; test added |
| mechanics | minor | Blank thinking is not "model default" | upheld | S2 wording: left to Pi |

### Round 2 — 2026-11-20

**Lanes:** intent (claude); mechanics (other family); cross-family: yes.

**Changed since Round 1:**
- S2: blank thinking leaves the level to Pi.
- S3: success judged from the settled outcome; redaction of reply/error/stderr; version gate inside the aside runner as a terminal failure.
- S4: spend scan dedupes forked entries; unknown-version wording; stuck event and "Pi exited before it was ready" end reason carry the version note.
- S5: inline retries (3 attempts, 1s apart) then the existing quiet reminder; no persisted pending state; for Pi with an entry_id, an empty read is retried.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Use hub-supplied new_id with --fork/--session-id like Claude | upheld | S3 adopts it |
| intent | minor | Strict read timeouts could hold the lock ~40s | upheld | S5 strict reads use a 2s timeout |
| intent | minor | Fork spend dedupe sits under S4 | upheld | Moved to S3, source named |
| mechanics | blocking | Thinking suffix on a custom model id changes the model when --thinking is set | accepted-risk | Rare path (see Accepted Risks) |
| mechanics | blocking | Aborted partial reply or missing/bad fork id accepted | upheld | S3 rejects aborted and checks header ids |
| mechanics | blocking | Stuck card ignores the version note | upheld (major) | S4 hub appends the note; test |
| mechanics | major | Exit reason may land after the hub sees the session ended | upheld | S4 sets and persists reason wherever first detected |
| mechanics | blocking | Strict reads could hang on a dropped connection | upheld (major) | S5 uses the strict HTTP path; test |
| mechanics | major | Retry budget can exceed the machine's 5s event deadline | upheld | S5 shared 4s budget, 500ms gaps; test |

### Round 3 — 2026-11-20

**Lanes:** intent (claude); mechanics (other family); cross-family: yes.

**Changed since Round 2:**
- S3: hub-supplied `new_id` with `--fork --session-id`; header id checks; aborted replies rejected; fork spend dedupe moved here from S4.
- S4: stuck card shows the version note; "Pi exited before it was ready" reason set and persisted wherever first detected.
- S5: strict reads on the strict HTTP path, one 4-second budget, 500ms gaps.
- Accepted Risks: thinking-suffix model pin.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | blocking | Read-only Pi asides can read outside the worktree (account files) | upheld | S3 path-boundary extension blocks out-of-worktree reads; test |
| mechanics | blocking | Full access not restored on resume | upheld | S3 passes explicit --tools every turn |
| mechanics | blocking | First request can eat the whole budget | upheld (major) | S5 1s per call, 4s wall-clock deadline |
| mechanics | major | What the 5s bound covers | upheld (minor) | S5 bounds recovery only; rest unchanged |
| mechanics | minor | Version note should use the launch version | upheld | S3/S4 record launch version |

### Round 4 — 2026-11-20

**Lanes:** intent (claude); mechanics (other family); cross-family: yes.

**Changed since Round 3:**
- S3: explicit `--tools` on every aside turn; read-only path-boundary extension blocking reads outside the worktree; launch-version tie for notes.
- S5: 1s per call, 4s wall-clock deadline on recovery only.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | Boundary blocks the aside's own rules file | upheld | S3 allows wheelchair's protocol/ directory too |
| intent | minor | 1s cap can fail a large transcript that works today | upheld | S5 first call up to 3s, retries 1s |
| intent | minor | Aside launch version is unused | upheld | Version tie for sessions only |
| intent | minor | Boundary extension needn't be written per turn | upheld | One static file using ctx.cwd |
| mechanics | blocking | Guard must check the file Pi will actually open | upheld | S3 resolves like Pi (resolveToCwd + read variants), realpath each; fixture tests |
| mechanics | major | Pi auto-loads out-of-worktree context files | declined | The aside forks the lead's session, which already holds whatever context Pi loaded for the lead; nothing new is exposed, and those files are instructions, not secrets |
| mechanics | major | Guard blocks the aside rules / graph schema | upheld | Already resolved by the intent fix: wheelchair's protocol/ is allowed (covers aside.md and graphs.md) |
| mechanics | major | Where the aside's launch-version note appears | declined | Superseded: the version tie now covers sessions only; aside failures show Pi's error or S4's problem text |
| mechanics | minor | Chunked slow response vs per-call cap | check-once-built | Check Once Built #1 |

### Round 5 — 2026-11-20

**Lanes:** intent (claude); mechanics (other family); cross-family: yes.

**Changed since Round 4:**
- S3: boundary allows wheelchair's `protocol/`; one static extension using `ctx.cwd`; resolves paths the way Pi does (resolveToCwd + read variants) and realpaths each candidate; fixture tests.
- S3/S4: launch-version tie for sessions only.
- S5: first call up to 3s, retries up to 1s, 4s deadline.
- New Check Once Built row 1.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- Round 1: IDEA's Why says a report lost to a brief read failure is never recovered; in fact the quiet reminder asks the agent to repeat it. S5 still saves that extra turn and misleading nudge.
