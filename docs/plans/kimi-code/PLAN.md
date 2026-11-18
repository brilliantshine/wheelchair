---
slug: kimi-code
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-18
---

# Kimi Code support

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

_None._

## Watch List

Things noticed that need looking into — not yet decisions for the user. Written down the
moment they're spotted so they can't be forgotten, surfaced to the user one line at a
time as they appear, and emptied before Stage 1 exits.

Each item ends up settled by the agent (noted in the Log), promoted to an Open Question,
promoted to a Constraint or Accepted Risk, or waved off by the user.

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode: thorough | Collin's pick | user |
| 2 | Kimi can run any role (lead, sub-lead, worker, reviewer, verifier, mapper) | Collin's pick; matches how Gemini was added | user |
| 3 | Kimi is signed in with a Kimi account login, not an API key | Collin's pick; Ready check mirrors the other CLIs | user |
| 4 | Provider id `kimi`, label "Kimi Code", binary `kimi` | Matches the registry pattern (`viewer/app/providers.js:3`) | defaulted |
| 5 | Each Kimi account gets its own `KIMI_CODE_HOME`, like `CLAUDE_CONFIG_DIR`/`CODEX_HOME` | Kimi documents `KIMI_CODE_HOME` as its data directory; keeps multi-account handling the same as Claude and Codex | defaulted |
| 6 | Turn end comes from Kimi's `Stop` hook, registered as a `[[hooks]]` rule in each account's `config.toml` | Kimi's documented hook; Antigravity does the same with its hooks file | defaulted |
| 7 | Permission modes: bypass maps to `--auto` ("Never Ask"), auto maps to `--yolo` ("Ask When Needed") | Closest documented equivalents | defaulted |
| 8 | ~~No effort choice for Kimi~~ superseded by 15 | Kimi documents no thinking/effort flag | defaulted |
| 9 | Asides and usage polling stay Claude/GPT only; Kimi is left out like Antigravity | Both are capability-limited today (MAP.md); IDEA does not ask for them | defaulted |
| 10 | `review_families` gains `kimi`; `both` keeps meaning "two different families" | Kimi counts as its own family (IDEA.md) | defaulted |
| 11 | Installer detects `kimi` and adds it to the service PATH; it no longer refuses a machine with none of Claude/Codex if Kimi or agy is present | MAP.md: `install.sh:40-48,368-371` | defaulted |
| 12 | Kimi was installed (user-level, 2.6.3, `~/.kimi-code`) and logged in on this machine; a real run's samples are in `samples/` | Collin picked "Install it here" (Q1) | user |
| 13 | Kimi login links are shown with `kimi.ai` in place of `kimi.com` | Collin: outside China use kimi.ai; the CLI printed kimi.com because its region file says `mainland-cn` | user |
| 14 | Login check: `kimi provider list --json` lists a provider whose key starts `managed:` and `$KIMI_CODE_HOME/credentials/kimi-code.json` exists | Kimi has no auth-status command; verified on a logged-in and an empty home | defaulted |
| 15 | Kimi gets effort: app efforts map low→low, medium→high, high→high, xhigh→max, max→max, set with `/effort <level>` typed before the role message | Kimi's models list `support_efforts = [low, high, max]`; the TUI has `/effort`, no CLI flag | defaulted |
| 16 | Model tiers: heavy `kimi-code/k3.1-pro`, standard `kimi-code/k3`, light `kimi-code/kimi-for-coding-highspeed` | From the logged-in account's model list | defaulted |

## Spec

Kimi Code is added as a fourth provider. Antigravity (`gemini`/`agy`) is the closest
pattern; MAP.md lists every hard-coded provider list with file:line, and **every one of
them gains Kimi** unless this Spec says otherwise. Facts below were observed on kimi 2.6.3
(`~/.kimi-code/bin/kimi`) on this machine; raw samples are in `samples/hooks.jsonl` and
`samples/wire.jsonl` (large entries trimmed).

### Identity

- Provider id `kimi`, CLI `kimi`, label "Kimi Code". Registry entry in
  `viewer/app/providers.js`: `effort: true, preflight: false, typesRoleMessage: true,
  asideFork: false, singleAccount: false`. Adapter `machine/adapters/kimi.js`, registered
  under key `kimi` in `machine/adapters/index.js`.
- Kimi counts as its own family: `review_families` accepts `kimi` everywhere it accepts
  `gemini` (`viewer/app/settings.js:219`, `viewer/app/routes.js:299`, Settings page), and
  `both` keeps meaning "two different families". Default `worker_order` appends `kimi`
  last; existing saved settings get `kimi` appended through the existing
  `worker_order_seen` migration, never reordered.
- Labels wherever providers are named (thread pages, Settings, Agents screen) say
  "Kimi Code".

### Accounts and data directory

- Each account has its own data directory passed as `KIMI_CODE_HOME` (`loginEnv(dir)`
  returns `{ KIMI_CODE_HOME: dir }`, empty when `dir` is falsy). The usual home is
  `KIMI_CODE_HOME` or `~/.kimi-code`, via `c.home('KIMI_CODE_HOME', '.kimi-code')`.
- Multiple Kimi accounts are allowed (`singleAccount: false`). `seed()` follows the Claude
  and Codex pattern (writes `wheelchair-account.json`); it never copies credentials.
- A fresh account directory has no `config.toml` provider and no credentials until it is
  logged in.

### Launch

- argv: `kimi`, then `--auto` when `session.permission_mode === 'bypass'`, else `--yolo`;
  then `--model <input.model>` when set. No other flags. Working directory is the
  worktree (Kimi has no work-dir flag). Env adds `loginEnv(accountDir)`.
- **Folder trust.** First launch in a folder shows a "Trust this folder?" screen
  (`❯ Trust and continue` / `Exit`). The adapter pre-trusts the worktree so the screen
  never appears, by writing `$KIMI_CODE_HOME/workspace-trust/<workDirKey>` as
  `{"root": "<worktree>", "trustedAt": <ms>}`, if the worker can establish how
  `<workDirKey>` is derived (observed: `wd_kw_0baf6a4e533b` for a folder named `kw`).
  If it cannot, `answerPrompts` presses Enter on that screen instead (the first option is
  "Trust and continue"). Either way, nothing else on that screen is answered.
- **Ready text:** the pane shows the input box line `│ >` and the footer's `context:`
  line, and none of the trust screen's text.
- **Role message:** typed, like Antigravity (`typesRoleMessage: true`), with the same
  `[wc:role]` first message format as `agy.js` `firstMessage`.
- **Effort:** when `session.effort` is set and the chosen model supports efforts, the
  adapter types `/effort <level>` and Enter after ready and before the role message,
  mapping low→low, medium→high, high→high, xhigh→max, max→max. A model with no
  `support_efforts` in `kimi provider list --json` gets no `/effort`. If the command is
  rejected on screen, the session continues at the model's default effort (logged, not
  fatal).
- **Permission prompts:** with `--yolo` Kimi may ask; `promptText(pane)` detects Kimi's
  approval prompt so the app's existing permission card flow fires. The worker captures
  the real prompt text from a `--yolo` run that triggers one (for example a shell command)
  and records it in the report.

### Hooks and turn end

- `prepare()` (and account `seed`) ensures each Kimi home's `config.toml` contains
  wheelchair's hook rules, appended as TOML `[[hooks]]` entries:
  `event = "Stop"` and `event = "StopFailure"`, each with
  `command = "<root>/machine/hook.sh kimi"`. Kimi rejects unknown fields in a hook entry,
  so only `event`, `command` and optionally `timeout` are written. Rewriting is idempotent
  (no duplicate entries on repeat), keeps every other line of the file, keeps the file
  mode, and writes atomically (temp + rename). Hooks are global per home; there is no
  project-level hook file. A rule wheelchair wrote is recognised by its command path.
- `machine/hook.sh` dispatches `kimi` to the adapter's `hookEvent`.
- Stop payload (snake_case): `hook_event_name`, `session_id` (`session_<uuid>`), `cwd`,
  `client_type`, `session_title`, `turn_id`, `step`, `first_step_of_turn`,
  `finish_reason`, `usage`, `stop_hook_active`. There is **no transcript path**.
- `hookEvent(raw)`: `Stop` → `{ type: 'turn-ended', conversation_id: raw.session_id,
  cwd: raw.cwd, title: raw.session_title }`; `StopFailure` → `limit-hit` when its error
  text matches quota/rate-limit/429, else `turn-failed` with the error text (the worker
  records the real StopFailure field names; if it cannot trigger one, it reads them from
  Kimi's docs and says so). Anything else → `null`.
- `onTurnEnded(session, event)`: binds on the first turn whose `title` starts with
  `[wc:role]` and whose `cwd` is the session's worktree, storing `kimi_session_id`; later
  events with a different `session_id` are ignored (as `agy.js` does). The transcript is
  `$KIMI_CODE_HOME/sessions/*/<session_id>/agents/main/wire.jsonl`, found by glob under
  the session's account home and stored as `source_transcript`. Subagent files under
  `agents/<other>/` are not read.

### Transcript reading

- `viewer/app/chat.js` gets `parseKimi`, `PARSERS.kimi` and `ASSISTANT_CONTENT.kimi`.
  wire.jsonl is one JSON object per line with a `type`:
  - `turn.prompt` with `origin.kind === 'user'` starts a turn; its human text is the
    joined `input[].text` (type `text`), passed through `unwrap` as other parsers do.
  - `context.append_loop_event` with `event.type === 'content.part'` and
    `event.part.type === 'text'` is assistant text (`event.part.text`); consecutive text
    parts of the same `event.stepUuid` join into one reply. `part.type === 'think'` is
    not shown.
  - `event.type === 'tool.call'` is a tool step (name and arguments from the event);
    `event.type === 'tool.result'` with matching `toolCallId` fills its detail from
    `event.result.output`.
  - Everything else is ignored. Times come from each row's `time` (ms).
  - A file with none of these rows shows "Couldn't read this Kimi Code transcript".
- A reviewer's or verifier's report (last assistant message of the turn) is the joined
  text parts of the last step that has any text, in the last turn.
- Conversation id handling in `viewer/app/sessions.js:552,722` and
  `viewer/app/asides.js:41` gains Kimi using `kimi_session_id`.

### Login

- `loginCommand()` → `['kimi', 'login']`, run with `loginEnv(dir)`. It prints
  `Opening browser for Kimi device login: <url>` and
  `paste the URL above and enter code: <CODE>`, then `Logged in to managed:kimi-code.`
  on success (exit 0). No prompts need answering (`loginPrompt` → `null`).
- `parseLogin(pane)` returns `{ url, code, wantsCode: false }`, where `url` is the
  `https://www.kimi.com/code/authorize_device?user_code=…` link **rewritten to
  `https://www.kimi.ai/...`** (host `www.kimi.com` or `kimi.com` → `www.kimi.ai`), and
  `code` is the user code.
- `loginDone(pane)` is true once `Logged in to` appears.
- `loginStatus(dir)`: `kimi provider list --json` under `loginEnv(dir)` exits 0 and its
  `providers` has a key starting `managed:`, and `<dir or usual home>/credentials/kimi-code.json`
  exists. Otherwise not logged in. Observed: an empty home returns
  `{"providers":{},"models":{}}`.
- Ready check (`viewer/app/ready.js`) needs no Kimi-specific code beyond the adapter's
  status: it reports "Kimi Code isn't installed" or "Kimi Code isn't logged in" in the
  same wording pattern as the other CLIs.

### Models

- `codex/model.sh` gains the `kimi` provider with tier pins heavy `kimi-code/k3.1-pro`,
  standard `kimi-code/k3`, light `kimi-code/kimi-for-coding-highspeed`, and its usage text
  and parser accept `kimi`.
- Model options for Settings come from `kimi provider list --json`'s `models` keys
  (shown with `displayName`), falling back to the three pins when the CLI is missing or
  not logged in.

### Installer

- `install.sh` detects `kimi` on PATH and also at `~/.kimi-code/bin/kimi` (the official
  installer's location, which may only be on PATH through `.bashrc`), adds its directory
  to the service PATH, and no longer exits when Claude and Codex are both absent but Kimi
  or Antigravity is present. Model initialisation runs when any provider is present.
  `install/unseen.py` is unchanged.

### Not in this change

- Asides (`machine/lib/aside-turns.js`) and usage polling (`viewer/app/usage-poll.js`,
  `machine/service.js:1480`) stay Claude/GPT only; Kimi is excluded the way Antigravity
  is, and the UI hides them for Kimi sessions as it does for Antigravity.
- API-key sign-in, Kimi's `acp`/`web` modes, and Kimi subagent transcripts.
- The graph harness attribution list (`viewer/server.js:1336,…`) labels Kimi as "other".

### Docs

- `protocol/app/lead.md` and `protocol/app/sub-lead.md`: provider flag lists and
  `review_families` values gain `kimi`; the model lookup example in `sub-lead.md:125`
  names every provider. `machine/API.md`, `viewer/app/API.md`, `machine/AGENTS.md`,
  `viewer/AGENTS.md` and the README's provider list gain Kimi. Routers stay true.

### Tests

- Machine: a fake `kimi` CLI stub alongside the existing ones; adapter unit tests for
  argv, effort mapping, hook-config write (idempotent, preserves other TOML, mode kept),
  `hookEvent` on the sample Stop payload, transcript binding by `session_id` + `cwd`,
  `parseLogin` (including the kimi.ai rewrite) and `loginStatus` on logged-in and empty
  homes.
- Viewer: `parseKimi` on `samples/wire.jsonl` (one turn: human text, one Write tool step
  with its output, final reply "done", no thinking shown); last-assistant-text on the
  same; settings defaults, migration, `review_families: 'kimi'` accepted and validation
  message updated; accounts allow several Kimi accounts.
- Model pins and installer fixtures cover `kimi` (present-only-Kimi machine installs).
- **Live check** (needs the real CLI, which is installed and logged in here): start one
  worker session on Kimi through the app's machine service against a throwaway worktree,
  confirm it reaches ready, takes the role message, posts its `result` card, and that its
  chat renders. Record the session name and outcome in the report.

### Validation commands

```bash
bash machine/test/run.sh
bash codex/test/run.sh
bash install/test/run.sh
node --test viewer/test/*.test.js
npm --prefix viewer run test:browser
```

All pass. Never run `./install.sh` from the worktree.

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them.

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — <date>

**Lanes:** <family / model>; <family / model>; cross-family: <yes|no>.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most.

<!-- Round 2+: list what changed since the previous round; that list scopes the reviewers. -->

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

Reported severity is the reviewer's opinion; the lead verdict
(`upheld`/`downgraded`/`declined`/`accepted-risk`/`user-decision`) is what gates the
exit. Downgrades and declines cite evidence.

## Prior Work

Parts of the Spec already built before this plan reached Stage 3 — adopted from outside
with work already done, or left behind by an implementation run that died partway.

Stage 3 does not re-implement `pre-existing` items and does not touch their code. Stage 4
verifies them exactly as rigorously as everything else: this code has never been through
the gate, so skipping it would leave the least-trustworthy part of the change as the only
part nobody checked.

Ambiguous evidence means **not done**. A wrong "done" is a silent hole; a wrong "not done"
costs a worker one look.

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|
|           | pre-existing / partial | | high / low |

`partial` items are implemented by Stage 3 — the brief names what exists so the worker
completes it instead of restarting it.

## Implementation Tasks

Filled by Stage 3. One row per worker brief.

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

Session id = the `thread_id` of a `codex exec` lane, so remediation can resume it.

## Log

Free-form running notes: deviations discovered mid-implementation, scope events,
anything a future session needs that fits nowhere above.
