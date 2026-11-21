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
  `pi --provider openrouter --model <model> --mode json -p`, then `--fork <from>` for mode fork or
  `--session <from>` for mode resume, `--append-system-prompt <prompt>`, `--no-extensions`
  (no wheelchair hook bridge in an aside), `--thinking <effort>` when set, and for access
  `read-only` (the default) `--tools read,grep,find,ls`; for `full` no tool restriction. The
  message is passed on stdin or as the final argument, whichever Pi's `-p` supports
  (`cli.md`). Login env comes from `adapter.loginEnv(dir)` as for other providers.
- Output parsing (Pi JSON mode, `json.md`): the first record is the session header
  `{"type":"session","id":...}`; its `id` is the `conversation_id` (for fork, the new session;
  for resume, it must equal `from`). Success is judged from the settled outcome only: Pi retries
  rate limits and network errors itself (`json.md:38-48`), so an earlier errored assistant
  message followed by a successful retry is a success. The reply is the text of the last
  assistant `message_end`. Failure: non-zero exit, no assistant text after settling, or the
  last assistant message has `stopReason: "error"` → `state: failed` with Pi's error message,
  else stderr's last line. `limit` is true only when the run ends failed and that final error
  is an HTTP 402/429 or "credit" / "rate limit" text.
- Redaction: `reply`, `error` and any stderr text are passed through `adapters/pi.js`
  `redact` before the aside result is stored or returned, so an OpenRouter key never reaches
  hub state.
- Version gate: an OpenRouter aside on a machine whose Pi is refused by S4 (older than 1.5.2,
  or not installed) finishes at once as `state: failed` with S4's problem text. It is checked
  inside the runner, not at request validation, so the hub gets a terminal result and does not
  retry the dispatch.
- Asides fork and resume in the lead's worktree (`i.cwd`), the same directory as the lead's
  session, so Pi finds the session by id.
- Tests: machine tests with a fake `pi` on PATH emitting JSON-mode records for fork, resume,
  error, an error followed by a successful retry (success), a key in reply and stderr (redacted),
  an old Pi (terminal failure, no dispatch retry), read-only argv, and a spend scan over a lead
  file plus its fork counting copied entries once (pattern of existing aside tests); hub test that an OpenRouter lead
  allows an aside (update `viewer/test/app-asides.test.js` where it pins the refusal).
- Live check (costs money; keep it to one fork turn and one resume turn, model
  `deepseek/deepseek-v4.1-flash-1017`): extend `test-support/smoke/pi-live.js` or add a sibling,
  confirming fork produces a new id, resume keeps it, and the reply text comes back.

### S4. Pi version check

- Tested version: `1.5.2`. Older than 1.5.2 is refused; 1.5.2 up to any 1.5.x patch is
  tested; anything newer is untested but allowed (Decision 7).
- Spend from forks (S1's totals): Pi copies the lead's entries, cost records included, into a
  forked session file (`dist/core/session-manager.js:1409-1425`). The spend scan
  (`machine/adapters/pi.js:24-46`) counts each assistant entry once per account, keyed by entry
  `id` plus `timestamp`, so aside forks add only their own new turns. (Listed here because S3
  creates the forks.)
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
    the machine ends the session with `end_reason` "Pi exited before it was ready" plus the note,
    which the hub already shows in its "Session ended" card and to the starter
    (`viewer/app/sessions.js:773-789`). This exit reason applies on every Pi version; only the
    note depends on the version.
- Tests in `machine/test/pi.test.js` with a fake `pi --version` (pattern of
  `machine/test/kimi.test.js:175-235`): old → problem and start refused; 1.5.2 and 1.5.9 → clean;
  1.6.0 → warning, start allowed; probe failure → unknown-version warning; Pi pane gone before
  ready → session ended with "Pi exited before it was ready"; turn-failed text carries the note on
  an untested version only. Hub test that the warning reaches `/usage` and does not block Ready.

### S5. A report survives a brief failure reading the agent's log (every provider)

Today a failed transcript read becomes `''` (`viewer/app/chat.js:330-334`), `deliverReport`
returns without a report (`viewer/app/sessions.js:435`), and the turn and delivery ids are
already saved (`sessions.js:567-569,642-645`), so the report is never recovered.

- `chat.sessionTranscript` gets a strict mode for report readers: a failed or timed-out machine
  call throws; a transcript that is genuinely absent (machine answers with no data, or 404)
  returns `''`.
- `deliverReport`: when the read throws, or when the CLI is `pi`, the event carries an
  `entry_id`, and the read (empty or absent included) does not contain that entry (the machine's copy can lag or fail, `machine/service.js:1403-1407`),
  retry the read inline: up to 3 more attempts, 1 second apart, within the same event handling.
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
  produces no report and arms the quiet check; all attempts failing arms the quiet check.

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

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- Round 1: IDEA's Why says a report lost to a brief read failure is never recovered; in fact the quiet reminder asks the agent to repeat it. S5 still saves that extra turn and misleading nudge.
