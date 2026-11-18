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
| 17 | Supersedes 13: log in with `kimi login --region global`; links are shown as printed, no rewriting | The region decides the sign-in server and the API address; rewriting the link alone would leave the account on the China region | review-round-1 |
| 18 | Supersedes 15: effort set per process with `KIMI_MODEL_THINKING_EFFORT`, never `/effort` | `/effort` saves the model and effort as the account default in `config.toml` | review-round-1 |
| 19 | Supersedes 16: Kimi pins cover all five required slots (critical and lead `kimi-code/k3.1-pro`); no live model list in Settings | `model.sh` needs every slot; a live list had no machine/account rule | review-round-1 |
| 20 | Kimi hooks carry the app session name (`sessionNameEnv`), bind by that name plus the transcript's `[wc:role]` prompt, and also handle `Interrupt` | Several sessions share one worktree; titles are asynchronous; Interrupt replaces Stop | review-round-1 |
| 21 | Minimum Kimi version 2.6.3, enforced by Ready and session start | 2.6.3 fixed Stop hooks not firing after each turn | review-round-1 |
| 22 | Folder trust answered by pressing Enter on the screen; nothing written into `workspace-trust/` | Its key format is internal | review-round-1 |

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
  `worker_order_seen` migration, never reordered. The legacy fallback for saved settings
  with no `worker_order_seen` (`viewer/app/settings.js:207`, `['claude', 'gpt']`) stays
  exactly as it is: it is not a provider list and must not gain `kimi` (or anything
  else), so older saved orders still receive both Antigravity and Kimi. Tests cover a
  legacy save (no `worker_order_seen`) and a current one (seen list without `kimi`).
- Labels wherever providers are named (thread pages, Settings, Agents screen) say
  "Kimi Code".
- **Minimum version 2.6.3.** Earlier releases could skip external Stop hooks after a
  completed turn. The machine's status for Kimi reports the installed version
  (`kimi --version`, a bare semver); below 2.6.3 the Ready check fails with
  "Kimi Code is older than 2.6.3; run `kimi upgrade`", and session start on that machine
  is refused with the same sentence.

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
  worktree (Kimi has no work-dir flag). Env adds `loginEnv(accountDir)`, and the
  adapter sets `sessionNameEnv: true` so `WHEELCHAIR_SESSION_NAME` is in the CLI's
  environment, which Kimi passes on to its hook commands.
- The `permission_mode` setting therefore governs Kimi too: its Settings label becomes
  "Claude and Kimi permission mode" (`viewer/pages/settings.js:481`), with no other change.
- **Folder trust.** First launch in a folder shows a "Trust this folder?" screen
  (`❯ Trust and continue` / `Exit`). `answerPrompts(pane)` presses Enter when the pane
  contains `Trust this folder?` and `Trust and continue` (the first, selected option),
  as `agy.js` handles its onboarding screens. Nothing is pre-written into Kimi's
  `workspace-trust/` directory (its key format is internal).
- **Ready text:** the pane shows the input box line `│ >` and the footer's `context:`
  line, and none of the trust screen's text.
- **Role message:** typed, like Antigravity (`typesRoleMessage: true`), with the same
  `[wc:role]` first message format as `agy.js` `firstMessage`.
- **Effort:** set per process through the launch environment, never through `/effort`
  (which saves the choice as the account's default model and effort in `config.toml`).
  When `session.effort` is set, the adapter adds `KIMI_MODEL_THINKING_EFFORT=<level>`
  to the launch env, mapping low→low, medium→high, high→high, xhigh→max, max→max, but
  only when the launched model's `supportEfforts` (camelCase, from
  `kimi provider list --json` run under the account's `KIMI_CODE_HOME` at launch) is a
  non-empty array containing the mapped level. Otherwise no variable is set and Kimi
  uses the model's default. The live check confirms the variable takes effect with the
  managed provider (the TUI footer reads `thinking: <level>`); if it does not, the worker
  removes it, leaves effort at the model default, and says so in its report. Nothing in
  this change writes `default_model` or `[thinking]` in any `config.toml`.
- **Permission prompts:** with `--yolo` Kimi may ask; `promptText(pane)` detects Kimi's
  approval prompt so the app's existing permission card flow fires. The worker captures
  the real prompt text from a `--yolo` run that triggers one (for example a shell command)
  and records it in the report.

### Hooks and turn end

- `prepare()` (and account `seed`) ensures each Kimi home's `config.toml` contains
  wheelchair's hook rules, appended as TOML `[[hooks]]` entries for `event = "Stop"`,
  `event = "StopFailure"` and `event = "Interrupt"`, each with
  `command = "<root>/machine/hook.sh kimi"`. Kimi rejects unknown fields in a hook entry,
  so only `event`, `command` and optionally `timeout` are written. Rewriting is idempotent
  (no duplicate entries on repeat), keeps every other line of the file, keeps the file
  mode, and writes atomically (temp + rename). Hooks are global per home; there is no
  project-level hook file. A rule wheelchair wrote is recognised by its command path.
- `machine/hook.sh` gets a `kimi` case like `agy`: session name from
  `WHEELCHAIR_SESSION_NAME`, exit 0 when absent (a Kimi run Collin started himself),
  payload from stdin, and the same durable spool path, so a Stop that arrives while the
  machine service is down is replayed when it returns. A test covers that replay.
- Stop payload (snake_case): `hook_event_name`, `session_id` (`session_<uuid>`), `cwd`,
  `client_type`, `session_title`, `turn_id`, `step`, `first_step_of_turn`,
  `finish_reason`, `usage`, `stop_hook_active`. There is **no transcript path**.
- `hookEvent(raw)`:
  - `Stop` → `{ type: 'turn-ended', conversation_id: raw.session_id }`.
  - `StopFailure` → `limit-hit` when its error text matches
    `quota|rate.?limit|429`, else `turn-failed` with the error text. The worker reads the
    real StopFailure and Interrupt field names from Kimi's hook event reference
    (https://moonshotai.github.io/kimi-code/en/customization/hooks#event-reference) and the
    binary, and records them in its report.
  - `Interrupt` (an operator pressed Esc or Ctrl-C) → `{ type: 'turn-ended',
    conversation_id: raw.session_id, interrupted: true }`. It releases the turn exactly as
    a Stop does: queued messages are delivered and any permission hold clears. For a
    reviewer or verifier, an interrupted turn delivers no report; the existing
    "turn ended with no report" reminder path applies.
  - Anything else → `null`.
- `onTurnEnded(session, event)`: the session name in the hook already identifies the app
  session (several sessions share one worktree, so `cwd` cannot). On the first event
  with a `conversation_id`, the adapter finds
  `$KIMI_CODE_HOME/sessions/*/<session_id>/agents/main/wire.jsonl` under the session's
  account home and binds it only if that file's first `turn.prompt` with
  `origin.kind === 'user'` has text starting `[wc:role]`. On bind it stores
  `kimi_session_id` and `source_transcript`. If the file is missing or does not match,
  the event is ignored but the turn is still released (never held). Later events with a
  different `session_id` are ignored. Session titles are not used. Subagent files under
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

- `loginCommand()` → `['kimi', 'login', '--region', 'global']`, run with
  `loginEnv(dir)`. `--region global` signs in through kimi.ai and points the account at
  `https://api.kimi.ai/coding/v1` (the default, `mainland-cn`, uses kimi.com; Collin is
  outside China). It prints `Opening browser for Kimi device login: <url>` and
  `paste the URL above and enter code: <CODE>`, then `Logged in to managed:kimi-code.`
  on success (exit 0). No prompts need answering (`loginPrompt` → `null`).
- `parseLogin(pane)` returns `{ url, code, wantsCode: false }` with the link and user
  code exactly as printed (no rewriting).
- `loginDone(pane)` is true once `Logged in to` appears.
- `loginStatus(dir)`: `kimi provider list --json` under `loginEnv(dir)` exits 0 and its
  `providers` has a key starting `managed:`, and `<dir or usual home>/credentials/kimi-code.json`
  exists. Otherwise not logged in. Observed: an empty home returns
  `{"providers":{},"models":{}}`. An account whose `$KIMI_CODE_HOME/region` file is not
  `global` is reported as logged in but with the Ready line "Kimi Code account <name> is
  signed in to the China region; log it in again" (`ok: false`).
- Ready check (`viewer/app/ready.js`) needs no Kimi-specific code beyond the adapter's
  status: it reports "Kimi Code isn't installed" or "Kimi Code isn't logged in" in the
  same wording pattern as the other CLIs.

### Models

- Kimi model ids are aliases with one `/` (`kimi-code/k3`). The model value check becomes
  `^[a-z0-9][a-z0-9._-]{0,63}(/[a-z0-9][a-z0-9._-]{0,63})?$` for provider `kimi` only, in
  `viewer/app/routes.js:247`, `codex/model.sh`'s `VALUE` check and its pin-file reader
  regex (`codex/model.sh:80`); other providers keep today's pattern. A test sets a Kimi
  pin through the Settings API, reloads it through `model.sh show --json`, and gets the
  same value back.
- `codex/model.sh` gains `kimi` in `PROVIDERS`, its usage text and the reader's provider
  alternation, with defaults for every required slot: light
  `kimi-code/kimi-for-coding-highspeed`, standard `kimi-code/k3`, heavy
  `kimi-code/k3.1-pro`, critical `kimi-code/k3.1-pro`, lead `kimi-code/k3.1-pro`
  (sub-lead inherits lead, as for the other providers). `show --json` succeeds with Kimi
  present.
- Settings shows Kimi's model per slot the way it shows Antigravity's (`options()` in
  `viewer/app/settings.js:271-279` is unchanged: no live model list for Kimi). Effort
  choices for Kimi slots are the app's usual five; the API accepts them for `kimi` as it
  does for `gemini` (`viewer/app/routes.js:249`).
- An account whose model list lacks the pinned alias: the session starts with
  `--model <alias>` anyway and Kimi's own error shows in the session, as for the other CLIs.

### Installer

- `install.sh` detects `kimi` on PATH and also at `~/.kimi-code/bin/kimi` (the official
  installer's location, which may only be on PATH through `.bashrc`), adds its directory
  to the service PATH, and no longer exits when Claude and Codex are both absent but Kimi
  or Antigravity is present. Model initialisation runs when any provider is present.
  `install/unseen.py` is unchanged.

### Not in this change

- Asides (`machine/lib/aside-turns.js`) and usage polling (`viewer/app/usage-poll.js`,
  `machine/service.js:1480`) stay Claude/GPT only. The asides API error at
  `viewer/app/asides.js:40` names the lead's provider label ("Side conversations aren't
  available on Kimi Code sessions yet") instead of always saying Antigravity. No new
  browser guard is added; the page behaves for Kimi exactly as for Antigravity.
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
- Viewer: `parseKimi` unit test on `samples/wire.jsonl` at parser level (one turn:
  human text, one Write tool step with its output, final reply "done", no thinking);
  last-assistant-text on the same file returns "done"; settings defaults, legacy and
  current `worker_order_seen` migration, `review_families: 'kimi'` accepted and the
  validation message updated; accounts allow several Kimi accounts; Kimi model alias
  save-and-reload.
- Model pins and installer fixtures cover `kimi` (present-only-Kimi machine installs).
- **Live checks** (need the real CLI, installed and logged in here; record session names
  and outcomes in the report):
  1. A Kimi **lead** session through the app's machine service in a throwaway thread:
     it reaches ready, takes the role message, and an ordinary user message's turn shows
     in thread chat (role messages are hidden by design).
  2. A Kimi **reviewer** started by that lead: its final text reaches the lead as its
     `result` through the hub.
  3. An effort-setting launch shows the expected `thinking:` level in the footer.

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

### Round 1 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most.

<!-- Round 2+: list what changed since the previous round; that list scopes the reviewers. -->

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | Login must use `--region global`, not a link rewrite | upheld | Verified `kimi login --help`; Spec Login rewritten, Decision 17 |
| intent | major | `/effort` persists to the shared config | upheld | Effort via `KIMI_MODEL_THINKING_EFFORT`; Decision 18 |
| intent | major | Live model list has no machine/account rule | upheld | Dropped; pins only, Decision 19 |
| intent | minor | Folder trust offered two paths | upheld | Enter on the trust screen; Decision 22 |
| mechanics | blocking | Model aliases with `/` fail validation | upheld | Verified `routes.js:247`, `model.sh:38,80`; widened for `kimi` only, with save-and-reload test |
| mechanics | blocking | Pins miss `critical` and `lead` | upheld | Verified `model.sh:15`; all five slots specified |
| mechanics | blocking | Hook has no session name; spool needs it | upheld | Verified `hook.sh:26`, `service.js:613`; `sessionNameEnv: true`, spool replay test |
| mechanics | blocking | Field is `supportEfforts`, not `support_efforts` | upheld | Verified locally; Spec uses `supportEfforts` |
| mechanics | major | `/effort` async, confirm screen, persists | upheld | Same fix as intent finding 2 |
| mechanics | major | Binding on session title is fragile | upheld | Bind by session name + transcript `[wc:role]`; turn always released |
| mechanics | major | Interrupt replaces Stop | upheld | Interrupt hook releases the turn; no report for an interrupted review |
| mechanics | major | No minimum version | upheld | 2.6.3 floor in Ready and start; Decision 21 |
| mechanics | major | Legacy `worker_order_seen` fallback | upheld | Verified `settings.js:207`; fallback kept, both cases tested |
| mechanics | major | Model discovery has no machine/account rule | upheld | Same fix as intent finding 3 |
| mechanics | major | Transcript checks impossible through the viewer as written | upheld | Verified `chat.js:125`; parser-level test plus live lead and reviewer checks |
| mechanics | minor | "Claude permission mode" also governs Kimi | upheld | Label becomes "Claude and Kimi permission mode" |
| mechanics | minor | No aside browser guard to copy | downgraded | Already minor; API error names the provider label, no browser guard (same as Antigravity) |

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
