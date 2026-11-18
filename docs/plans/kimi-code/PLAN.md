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
| 23 | Supersedes 14: Kimi account facts (login, region, efforts) come from reading `config.toml`, never from spawning the CLI; region from `oauth_host`, credentials file from the oauth `key` | `provider list` costs ~1s per call; the `region` file stays `mainland-cn` after a global login; the global credential file name is scoped | review-round-2 |
| 24 | Machine status entries may carry `problem`; Ready shows it; placement skips entries not logged in | Version floor and China region must reach Ready and placement without new hub rules | review-round-2 |
| 25 | Turn ends that are interrupted or unverified release the turn but deliver no report | A partial reviewer report must not be published; an unbound turn must not hold the queue | review-round-2 |
| 26 | A Kimi account is ineligible when the CLI is missing; a home with inline `hooks =` refuses session start; failure events get the bound-session check; an interrupted review gets no "no report" reminder | Review round 3 gaps | review-round-3 |
| 27 | Keep all hardening in this plan (stay thorough) and review again | Collin, after three rounds without a clean one | user |
| 28 | Kimi account plans: `{ unknown: 1 }` only | No published Kimi plan ratios; per-account weight still adjustable | defaulted |
| 29 | Supersedes part of 26: Kimi accounts no longer special-case a missing CLI | Same as every other CLI; Ready already reports a missing CLI first | review-round-4 |
| 30 | Kimi commands use the resolved absolute executable path, never PATH inside tmux | tmux panes inherit the server environment, which lacks the service PATH | review-round-4 |
| 31 | Kimi status separates `authenticated` (sign-in worked) from `logged_in` (eligible for agents); `loginEnv` always passes the effective `KIMI_CODE_HOME`; `cliStatus('kimi')` uses the adapter's resolver | Review round 5 gaps | review-round-5 |
| 32 | Kimi sign-in succeeds only on this attempt's success and `authenticated`; account problems are shown on the Settings account row; the Kimi home path is absolute; files with multi-line strings are not edited | Review round 6 gaps | review-round-6 |
| 33 | Kimi sign-in completes only from the wrapper's exit marker; account problems are per machine; unreadable or multi-line-string configs are neither read nor edited | Review round 7 gaps | review-round-7 |
| 34 | Only the main agent's Stop ends a turn; hook prep guards against concurrent writes; sign-in results are kept per attempt; folder trust checks which option is selected | Review round 8 gaps | review-round-8 |
| 35 | Turn ends are read from the main agent's own log (`agents/main/wire.jsonl` `turn.ended` rows), polled by the machine service; no Kimi hooks and no edits to Kimi's `config.toml`. Supersedes 6, 20, 21 (version floor was for hooks), 25 (`unverified`), and the hook-config parts of 26, 32, 34 | Collin picked "Read Kimi's log" after round 9: hook signals cannot tell the main agent from subagents, and editing a file Kimi rewrites can't be made safe | user |
| 36 | Log binding by a `Session: <name>` line in Kimi's role message; turn ends handled once per `turnId` with a persisted offset; protocol major-version guard | Needed by Decision 35 | defaulted |

## Spec

Kimi Code is added as a fourth provider. Antigravity (`gemini`/`agy`) is the closest
pattern; MAP.md lists every hard-coded provider list with file:line, and **every one of
them gains Kimi** unless this Spec says otherwise. Facts below were observed on kimi 2.6.3
(`~/.kimi-code/bin/kimi`) on this machine; a real session log is in `samples/wire.jsonl`
(large entries trimmed). `samples/hooks.jsonl` is kept for reference only: **this design
uses no Kimi hooks** and never edits Kimi's `config.toml`.

### Identity

- Provider id `kimi`, CLI `kimi`, label "Kimi Code". Registry entry in
  `viewer/app/providers.js`: `effort: true, preflight: false, typesRoleMessage: true,
  asideFork: false, singleAccount: false`. Adapter `machine/adapters/kimi.js`, registered
  under key `kimi` in `machine/adapters/index.js`.
- Kimi counts as its own family: `review_families` accepts `kimi` everywhere it accepts
  `gemini` (`viewer/app/settings.js:219`, `viewer/app/routes.js:299`, Settings page), and
  `both` keeps meaning "two different families".
- Default `worker_order` appends `kimi` last; existing saved settings get `kimi` appended
  through the existing `worker_order_seen` migration, never reordered. The legacy
  fallback for saved settings with no `worker_order_seen` (`viewer/app/settings.js:207`,
  `['claude', 'gpt']`) stays exactly as it is (it is not a provider list), so older saved
  orders still receive both Antigravity and Kimi. Tests cover a legacy save (no
  `worker_order_seen`) and a current one (seen list without `kimi`).
- Labels wherever providers are named (thread pages, Settings, Agents screen) say
  "Kimi Code".
- **Account plans.** `PLANS.kimi = { unknown: 1 }` in `viewer/app/settings.js:34`; Kimi
  accounts weigh equally unless Collin sets a per-account weight. Every lookup of
  `PLANS[provider]` works for `kimi`, and saving settings with a Kimi account succeeds
  (tested).

### Executable

tmux panes inherit the tmux server's environment, not the service's PATH, so no Kimi
command relies on PATH inside a pane. The adapter exports `resolveCli()`: `command -v
kimi` in the service's PATH, else `~/.kimi-code/bin/kimi` if it exists and is executable
(the official installer's location), else none. `machine/service.js` `cliStatus('kimi')`
uses `resolveCli()` (instead of `command -v kimi`) for the installed check and for
`--version`, which is cached by resolved path plus the binary's mtime (`kimi --version`
takes about 0.7 s). Launch argv and `loginCommand()` both start with the resolved
absolute path. A test covers launch and login when the pane's PATH lacks the kimi
directory.

### Accounts and data directory

- Each account has its own data directory, passed as `KIMI_CODE_HOME`. The **effective
  home** is `dir` for a named account, and for the default account the service's
  `KIMI_CODE_HOME` or `~/.kimi-code` (`c.home('KIMI_CODE_HOME', '.kimi-code')`), always
  made absolute with `path.resolve`. `loginEnv(dir)` **always** returns
  `{ KIMI_CODE_HOME: <effective home> }`, so the service (status, transcript lookup) and
  every tmux pane (launch, sign-in) use the same directory even when only the service's
  environment sets `KIMI_CODE_HOME`. A test sets it only in the service and checks both
  pane commands carry it.
- Multiple Kimi accounts are allowed (`singleAccount: false`). `seed()` follows the Claude
  and Codex pattern (writes `wheelchair-account.json`) and never copies credentials.
  `prepare()` does nothing for Kimi.

### Reading a Kimi home's config (read-only)

Status, sign-in checks and launch never spawn the kimi CLI to learn about an account
(`kimi provider list --json` takes about a second per call; machine status has a
3-second budget), and **nothing in this change writes any Kimi `config.toml`**.
`machine/adapters/kimi.js` has a small line reader for `<effective home>/config.toml`
(no TOML library; the machine has no dependencies):

- A table header is a line matching `^\s*\[([^\[\]]+)\]\s*(#.*)?$`, compared after
  trimming with quoted segments kept exactly (for example
  `providers."managed:kimi-code".oauth`). `[[…]]` headers start a table the reader
  ignores.
- Inside a table, `name = "string"` gives a string and `name = [ "a", "b" ]` on one line
  gives an array of strings. Anything else (multi-line arrays, other types) is ignored, as
  are `#` comments and blank lines. Key order within a table does not matter (Kimi
  rewrites this file itself).
- It extracts only: from table `providers."managed:kimi-code".oauth` the strings `key`
  and `oauth_host` (the `services.*.oauth` tables also have `key` and are ignored); from
  each table `models."<alias>"` the array `support_efforts` (absent for some models).
- **File states.**
  - Absent (`ENOENT`): nothing configured (not signed in, no efforts).
  - Exists but cannot be read (any other error): not trusted; status
    `logged_in: false` with `problem: "Kimi Code's config.toml can't be read"`.
  - Contains a multi-line string delimiter (`"""` or `'''` anywhere), so a header- or
    key-shaped line could sit inside a string: not trusted; status `logged_in: false`
    with `problem: "Kimi Code's config.toml has multi-line strings wheelchair can't read"`.
- Unit tests: a fixture with the logged-in shape below (dummy values) including the
  `services.*.oauth` table and a model with and one without `support_efforts`; an empty
  home; an unreadable file; a multi-line string containing a fake OAuth table next to a
  real one (reported as the problem, not misread).

Observed shape after `kimi login --region global`:

```toml
default_model = "kimi-code/kimi-for-coding"

[providers."managed:kimi-code"]
type = "kimi"
api_key = ""
base_url = "https://api.kimi.ai/coding/v1"

[providers."managed:kimi-code".oauth]
storage = "file"
key = "oauth/kimi-code-env-0e4f99c69cc27850"
oauth_host = "https://auth.kimi.ai"

[models."kimi-code/k3"]
provider = "managed:kimi-code"
model = "k3"
support_efforts = [ "low", "high", "max" ]
default_effort = "high"

[services.moonshot_search.oauth]
storage = "file"
key = "oauth/kimi-code"
```

### Account status, Ready and Settings

- `loginStatus(dir)` (no CLI spawn) returns `{ logged_in, authenticated, problem? }`:
  - `authenticated`: the managed provider's oauth `key` is present and
    `<home>/credentials/<key without the leading "oauth/">.json` exists (observed:
    `credentials/kimi-code-env-0e4f99c69cc27850.json`; the name is never hard-coded).
    When the config is not trusted (unreadable or multi-line strings), `authenticated` is
    true if any `*.json` file exists in `<home>/credentials/`.
  - Region: global when `oauth_host`'s host is `auth.kimi.ai`; anything else, or no
    `oauth_host` (Kimi then treats the account as mainland China), is China. The
    `<home>/region` file is **not** read: it stays `mainland-cn` after a global login.
  - `logged_in` (eligible to run agents): `authenticated`, config trusted, and region
    global. A China-region account has
    `problem: "signed in to Kimi's China region; log in again"`.
  - An empty home: not authenticated, not logged in, no problem.
- Machine status entries (the per-CLI row and each `accounts[]` entry) may carry an
  optional `problem` string, which never names an account. For Kimi the per-CLI row never
  carries one; all Kimi problems are per home, on that home's `accounts[]` entry
  (including the default home's).
- `viewer/app/ready.js` keeps its rule (some unpaused account of the thread's provider is
  logged in). When it fails and the CLI is installed: the first account in Settings order
  that is in Settings, unpaused and not retired, and whose status entry has a `problem`,
  gives the line `<account display name from Settings>: <problem>` (name resolved in the
  hub); with none, the usual "<label> is not logged in". Placement (`viewer/app/usage.js`)
  is unchanged: only `logged_in` entries are eligible, so with one global and one
  China-region account, sessions go to the global one and Ready passes.
- **Problem on the Settings account row.** Problems are per machine, like sign-in state.
  `viewer/app/usage.js:57` keeps its boolean `accounts[id]` map untouched (placement and
  usage polling read it by truthiness). The per-machine value built at `usage.js:99`
  gains a third form, `{ state: 'problem', text: <problem> }`, beside `'signed_in'` and
  `'signed_out'`, used when the machine's entry has `logged_in: false` and a `problem`.
  The account row (`viewer/pages/settings.js:1141-1150`) shows that machine's sentence in
  place of "signed out"; its Sign in button stays. `authenticated` stays on the machine
  (read only by `loginState`). Tests: one Kimi account on two machines, signed in on one
  and with a problem on the other, shows each row correctly and placement uses the
  signed-in machine; a browser test shows the problem sentence.

### Sign-in

- `loginCommand()` → `['<resolved kimi>', 'login', '--region', 'global']`, run with
  `loginEnv(dir)`. `--region global` signs in through kimi.ai and points the account at
  `https://api.kimi.ai/coding/v1` (the default region uses kimi.com; Collin is outside
  China). It prints `Opening browser for Kimi device login: <url>` and
  `paste the URL above and enter code: <CODE>`, then `Logged in to managed:kimi-code.`
  and exits 0 on success. `loginPrompt` → `null`.
- `parseLogin(pane)` returns `{ url, code, wantsCode: false }`, the link and code
  exactly as printed.
- **Completion** (Kimi path of `machine/service.js` `loginState`; other CLIs unchanged):
  - Kimi tmux targets use exact-match form (`=wc-login-<account>`) for capture, kill and
    has-session, so accounts whose ids share a prefix never touch each other's pane
    (tested with ids `team` and `team-backup`).
  - `loginDone` returns false for Kimi; completion comes only from the wrapper's exit
    marker `__wc_login_exit <n>`, which stays on the pane (the wrapper sleeps after it).
    Exit 0 and `authenticated` → `done`; exit 0 and not `authenticated` → `failed`;
    nonzero → `failed` (even when older credentials exist). The pane is not killed on
    success.
  - The first terminal result is kept on the login record and returned on every later
    poll of that attempt, even after the pane is gone; starting a new sign-in clears it.
  - With no marker yet: if the capture fails and the session's existence is unknown
    (tmux could not be listed) or the session still exists, `waiting`; if the session is
    known to be gone and no result was kept, `failed`.
  - The `logged_in` field `loginState` returns is `authenticated` for Kimi, so the
    Settings page (`viewer/pages/settings.js:1056`, which needs `state === 'done' &&
    logged_in`) shows "Signed in." even on a China-region or untrusted-config home; the
    account row then shows the problem.
  - Tests: repeated polls after success all return `done`, including after the pane is
    killed; a cancelled login on a home with old credentials returns `failed`; exit 0
    without credentials returns `failed`; a capture failure with the session alive or
    unknown returns `waiting`; sign-in on a China-region home ends with "Signed in.".

### Launch

- argv: `<resolved kimi>`, then `--auto` when `session.permission_mode === 'bypass'`,
  else `--yolo`; then `--model <input.model>` when set. No other flags. Working directory
  is the worktree. Env adds `loginEnv(accountDir)` and, for effort, the launch `env`
  below.
- The `permission_mode` setting already governs Claude and Antigravity and now Kimi: its
  visible row text becomes "Claude, Antigravity and Kimi sessions" and its accessible
  label "Claude, Antigravity and Kimi permission mode" (`viewer/pages/settings.js:481,522`).
- **Effort:** per process, never through `/effort` (which saves the choice as the
  account's default model and effort). When `session.effort` is set, the adapter maps
  low→low, medium→high, high→high, xhigh→max, max→max and sets
  `KIMI_MODEL_THINKING_EFFORT=<level>` only when the launched model's `support_efforts`
  (from the config reader) contains the mapped level; otherwise no variable (observed:
  the light pin `kimi-code/kimi-for-coding-highspeed` has none). Mechanism:
  `adapter.command(input, session, worktree, context)` may return an `env` object;
  `context` gains the session's account home (`accountDir`, null for the default), and
  `machine/service.js` merges `built.env` into the tmux command's `env …` prefix after
  `loginEnv`. Other adapters return no `env`. The live check confirms the footer shows
  `thinking: <level>`; if the variable has no effect, the worker removes it, leaves effort
  at the model default, and says so in its report.
- **Folder trust.** First launch in a folder shows "Trust this folder?" with options
  `Trust and continue` and `Exit`, the selected one marked `❯`. `answerPrompts(session,
  pane)` (existing contract, `machine/service.js:694`): with `❯` on `Trust and continue`
  (`❯\s*Trust and continue`) → `{ step: 'trust', keys: ['Enter'] }`; with `❯` on `Exit`
  → `{ step: 'trust-select', keys: ['Up'] }` only, so the next readiness poll recaptures
  the pane and sends Enter only once the trust option is shown selected; otherwise
  `null`. Tests cover both selections. Nothing is written into Kimi's
  `workspace-trust/`.
- **Ready text:** the pane shows the input box line `│ >` and the footer's `context:`
  line, and none of the trust screen's text.
- **Role message:** typed (`typesRoleMessage: true`). Kimi's `firstMessage` is
  Antigravity's format with one extra line right after the first:
  `[wc:role] Role: <role>` then `Session: <session name>`, then the rest as in `agy.js`.
  The session line is how the app finds this session's log (below).
- **Permission prompts:** with `--yolo` Kimi may ask; `promptText(pane)` detects Kimi's
  approval prompt so the existing permission card flow fires. The worker captures the
  real prompt text from a `--yolo` run that triggers one and records it in the report.

### Turn ends: read from Kimi's log

No hooks: `machine/hook.sh` gets no `kimi` case and the adapter has no `hookEvent`
behaviour beyond returning `null`. Instead the machine service reads each Kimi session's
main log, the way it already polls Codex rollouts (`pollCodexSteps`,
`machine/service.js:367`).

- **The log.** `<effective home>/sessions/<workDirKey>/<kimiSessionId>/agents/main/wire.jsonl`,
  one JSON object per line with a `type`. Subagents write their own files under
  `agents/<other>/`, which are never read, so subagent activity cannot end a turn.
- **Binding.** A new timer, `pollKimiTurns`, every 1 s. For each live Kimi session not yet
  bound, it lists `<effective home>/sessions/*/*/agents/main/wire.jsonl` files modified at
  or after the session's `created_at`, and binds to the one whose first `turn.prompt`
  row with `origin.kind === 'user'` has text starting `[wc:role]` and containing the line
  `Session: <session name>`. On bind it stores `kimi_session_id` (the `<kimiSessionId>`
  directory name) and `source_transcript` (the file path), persisted with the session. If
  no file is bound 120 s after the role message was typed, the service emits one
  `turn-failed` with error "Couldn't find Kimi Code's log for this session" (the existing
  failed-turn handling then applies).
- **Reading.** For a bound session, the timer reads only bytes after the persisted offset
  (`kimi_offset`, complete lines only) and looks for rows
  `{"type":"turn.ended","agentId":"main","turnId":<n>,"reason":<r>,…}` (observed
  `reason: "completed"`). A row whose `agentId` is not `main` is ignored. Each `turnId`
  is acted on once: the highest handled `turnId` (`kimi_last_turn`) is persisted with the
  offset, so a service restart catches up on turns that ended while it was down, once,
  and never repeats one.
- **Events.** For each new `turn.ended`, the service calls its existing `hook(session,
  event)` path (so copying, spooling when the hub is down, and forwarding stay exactly as
  for other CLIs) with `transcript_path` set to the bound file and:
  - `reason: "completed"` → `{ type: 'turn-ended', conversation_id: kimi_session_id,
    turn_id: n }`;
  - `reason: "cancelled"` (Collin pressed Esc or Ctrl-C) → the same with
    `interrupted: true`;
  - `reason: "failed"` → `limit-hit` when the failure text matches
    `quota|rate.?limit|429`, else `turn-failed` with that text. The failure text comes
    from the `turn.ended` row or the nearest preceding error row in the same turn; the
    worker triggers or finds a real failed turn (or reads Kimi's wire format in the
    binary), records the field names in the report, and tests against that shape.
  - Any other `reason` → `turn-ended` with `interrupted: true` (releases the turn, no
    report), logged.
- **Format guard.** The log's first row is `{"type":"metadata","protocol_version":"1.5",…}`.
  If the bound file's `protocol_version` major is not `1`, the service emits one
  `turn-failed` "Kimi Code's log format changed (protocol <v>); update wheelchair" and
  stops reading that session.
- **Hub handling** (`viewer/app/sessions.js`, turn-ended path): an `interrupted`
  turn end releases the turn (queued messages, permission hold) but skips report
  extraction (`deliverReport`), does not mark a reviewer or verifier finished, and does
  not arm the "turn ended with no report" reminder (`quiet.arm`). The conversation id key
  list at `viewer/app/sessions.js:552` and `viewer/app/asides.js:41` gains
  `kimi_session_id`.
- **Report for a turn.** A turn end carries `turn_id`; the hub passes it to the Kimi
  report function, which reads only that turn (see Transcript reading).
- Tests (fake `kimi` and a fake sessions folder): two app sessions in one worktree each
  bind their own log by the `Session:` line; a subagent file under `agents/<other>/`
  never produces a turn end; `completed`, `cancelled` and `failed` rows produce the three
  event kinds; a restart with a persisted offset emits a missed turn once and nothing
  twice; a hub outage spools the event and delivers it later; no bind in 120 s emits the
  failure; a `protocol_version` of `2.0` emits the format failure.

### Transcript reading

- `viewer/app/chat.js` gets `parseKimi` and `PARSERS.kimi`:
  - `turn.prompt` with `origin.kind === 'user'` starts a turn; its human text is the
    joined `input[].text` (type `text`), passed through `unwrap` as other parsers do.
  - `context.append_loop_event` with `event.type === 'content.part'` and
    `event.part.type === 'text'` is assistant text (`event.part.text`); parts with the
    same `event.stepUuid` join into one reply. `part.type === 'think'` is not shown.
  - `event.type === 'tool.call'` is a tool step (name and arguments from the event);
    `event.type === 'tool.result'` with the same `toolCallId` fills its detail from
    `event.result.output`.
  - Everything else is ignored. Times come from each row's `time` (ms).
  - A file with none of these rows shows "Couldn't read this Kimi Code transcript".
- **Report function** (Kimi only; no `ASSISTANT_CONTENT.kimi`, since one reply spans
  several rows). Given a `turn_id` (else the last turn), it takes that turn's rows: those
  between its `turn.prompt` (`turnId`) and its `turn.ended`. A step is identified by the
  `event.uuid` of its `step.begin`/`step.end` rows; a `content.part` belongs to the step
  whose `uuid` equals the part's `event.stepUuid`. It takes the last step in the turn that
  has text parts and joins all of them in order of `event.block`, with no separator.
  `lastAssistantText('kimi', raw, turnId)` dispatches to it. Tests: on the sample it
  returns "done"; a fixture whose final step has two text parts returns both; a fixture
  with a later turn already present returns the requested turn's text.

### Models

- Kimi model ids are aliases with one `/` (`kimi-code/k3`). For provider `kimi` only, the
  model value check becomes `^[a-z0-9][a-z0-9._-]{0,63}(/[a-z0-9][a-z0-9._-]{0,63})?$` in
  `viewer/app/routes.js:247`, in `codex/model.sh`'s `VALUE` check and pin-file reader
  regex (`codex/model.sh:38,80`), and in the Settings page's `MODEL_VALUE`
  (`viewer/pages/settings.js:17`, used by the "Other…" field). Other providers keep
  today's pattern. Tests: a Kimi pin set through the Settings API reloads unchanged via
  `model.sh show --json`; a browser test saves a slashed Kimi alias through "Other…",
  reloads, and sees it.
- `codex/model.sh` gains `kimi` in `PROVIDERS`, its usage text and the reader's provider
  alternation, with defaults for every required slot: light
  `kimi-code/kimi-for-coding-highspeed`, standard `kimi-code/k3`, heavy
  `kimi-code/k3.1-pro`, critical `kimi-code/k3.1-pro`, lead `kimi-code/k3.1-pro`
  (sub-lead inherits lead). `show --json` succeeds with Kimi present.
- Settings shows Kimi's model per slot as it does Antigravity's (`options()` in
  `viewer/app/settings.js:271-279` unchanged: no live model list). Kimi slots get the
  app's usual five efforts; the API accepts them for `kimi` as for `gemini`
  (`viewer/app/routes.js:249`).
- An account whose model list lacks the pinned alias: the session starts with
  `--model <alias>` anyway and Kimi's own error shows, as for other CLIs.

### Installer

- `install.sh` detects `kimi` on PATH and at `~/.kimi-code/bin/kimi`, adds its directory
  to the service PATH, and no longer exits when Claude and Codex are both absent but Kimi
  or Antigravity is present. Model initialisation runs when any provider is present.
  `install/unseen.py` is unchanged.

### Not in this change

- Kimi hooks and any edit to Kimi's `config.toml`.
- Asides (`machine/lib/aside-turns.js`) and usage polling (`viewer/app/usage-poll.js`,
  `machine/service.js:1480`) stay Claude/GPT only. The asides API error at
  `viewer/app/asides.js:40` names the lead's provider label ("Side conversations aren't
  available on Kimi Code sessions yet") instead of always saying Antigravity; no new
  browser guard.
- API-key sign-in, Kimi's `acp`/`web` modes, and Kimi subagent transcripts.
- The graph harness attribution list (`viewer/server.js:1336,…`) labels Kimi as "other".

### Docs

- `protocol/app/lead.md` and `protocol/app/sub-lead.md`: provider flag lists and
  `review_families` values gain `kimi`; the model lookup example in `sub-lead.md:125`
  names every provider. `machine/API.md`, `viewer/app/API.md`, `machine/AGENTS.md`,
  `viewer/AGENTS.md` and the README's provider list gain Kimi. Routers stay true.

### Tests (summary)

Each section above names its tests. In addition: viewer `parseKimi` on
`samples/wire.jsonl` (one turn: human text, one Write tool step with its output, final
reply "done", no thinking); settings defaults and `review_families: 'kimi'` with the
updated validation message; several Kimi accounts allowed; model pins and installer
fixtures cover `kimi` (a Kimi-only machine installs).

**Live checks** (real CLI, installed and logged in here; record session names and
outcomes in the report):
1. A Kimi **lead** session through the app's machine service in a throwaway thread: it
   reaches ready, takes the role message, binds its log, and an ordinary user message's
   turn shows in thread chat (role messages are hidden by design).
2. A Kimi **reviewer** started by that lead: its final text reaches the lead as its
   `result` through the hub.
3. A Kimi turn that uses a subagent ends exactly once at the hub, after the main agent's
   reply.
4. Pressing Esc mid-turn releases the session with no report delivered.
5. An effort-setting launch shows the expected `thinking:` level in the footer.

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
| Placement can pick a Kimi account on a machine where the `kimi` binary was removed after login | Same for every CLI today; Ready reports the missing CLI | 4 |

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
| mechanics | blocking | Field is `supportEfforts`, not `support_efforts` | upheld | Verified locally; Spec uses `supportEfforts` (round 3 note: the Spec now reads `support_efforts`, the snake_case key in `config.toml`; camelCase is only the CLI JSON) |
| mechanics | major | `/effort` async, confirm screen, persists | upheld | Same fix as intent finding 2 |
| mechanics | major | Binding on session title is fragile | upheld | Bind by session name + transcript `[wc:role]`; turn always released |
| mechanics | major | Interrupt replaces Stop | upheld | Interrupt hook releases the turn; no report for an interrupted review |
| mechanics | major | No minimum version | upheld | 2.6.3 floor in Ready and start; Decision 21 |
| mechanics | major | Legacy `worker_order_seen` fallback | upheld | Verified `settings.js:207`; fallback kept, both cases tested |
| mechanics | major | Model discovery has no machine/account rule | upheld | Same fix as intent finding 3 |
| mechanics | major | Transcript checks impossible through the viewer as written | upheld | Verified `chat.js:125`; parser-level test plus live lead and reviewer checks |
| mechanics | minor | "Claude permission mode" also governs Kimi | upheld | Label becomes "Claude and Kimi permission mode" |
| mechanics | minor | No aside browser guard to copy | upheld | API error names the provider label, no browser guard (same as Antigravity) |

Reported severity is the reviewer's opinion; the lead verdict
(`upheld`/`downgraded`/`declined`/`accepted-risk`/`user-decision`) is what gates the
exit. Downgrades and declines cite evidence.

### Round 2 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 1:** login via `--region global` (no link rewrite) plus a China-region Ready line; effort via `KIMI_MODEL_THINKING_EFFORT` gated on `supportEfforts`; hooks gain `Interrupt`, `sessionNameEnv`, spool replay, binding by session name plus transcript `[wc:role]`; minimum version 2.6.3; folder trust by Enter; model aliases with `/` and five-slot pins, no live model list; legacy `worker_order_seen` fallback kept; permission-mode label; asides error wording; tests and live checks rewritten.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | China check reads the weak `region` file | upheld | Verified: file says `mainland-cn`, `oauth_host` is `auth.kimi.ai`; region from `oauth_host`, Decision 23 |
| intent | blocking | Credentials file name is not always `kimi-code.json` | upheld | Verified `kimi-code-env-….json`; name from oauth `key` |
| intent | major | Tests still describe the round 1 design | upheld | Machine test list rewritten |
| intent | minor | Tests missing for Interrupt, null efforts, version floor, China region | upheld | Added to the Machine test list |
| intent | minor | hook.sh should not copy `${2:-…}` | upheld | Spec says session name only from env |
| mechanics | blocking | Scoped credential file and region marker | upheld | Same fix as intent finding 1 and 2 |
| mechanics | blocking | Ready ignores version and region | upheld | Verified `ready.js:42-58`; `problem` field, Decision 24 |
| mechanics | blocking | Settings "Other…" field rejects `/` | upheld | Verified `settings.js:17`; widened for Kimi with browser test |
| mechanics | blocking | Unverified binding drops the turn end | upheld | `unverified` forwarded; hub releases without report, Decision 25 |
| mechanics | blocking | Interrupt can publish a partial report | upheld | Hub skips report extraction on `interrupted` |
| mechanics | blocking | `[[hooks]]` after `hooks = []` is invalid TOML | upheld | Refuse to edit, report `problem`; owned rule = event + command |
| mechanics | major | Effort needs a launch-only env input | upheld | `command()` may return `env`; `accountDir` in context |
| mechanics | major | Status probes too slow for the 3s budget | upheld | Verified `service.js:1153`; config line reader, no CLI spawn |
| mechanics | major | Report extraction ignores turn id | accepted-risk | Matches every existing CLI; reviewers run one turn |
| mechanics | minor | Test list asks for superseded rewrite and cwd binding | upheld | Same fix as intent finding 3 |

### Round 3 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 2:** new "Reading a Kimi home's config" section (no CLI spawn; region from `oauth_host`, credentials from oauth `key`); optional `problem` on machine status entries and how Ready and placement use it; version floor via `problem`; effort through a launch-only `env` from `command()` with `accountDir` in context; hook-config merge rules and `hooks =` refusal; hook.sh reads the session name only from env; binding outcomes (`unverified`, `ignored`) and hub handling of `interrupted`/`unverified`; Settings "Other…" field accepts a slashed Kimi alias; machine test list rewritten; one Accepted Risk.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | "Reading a Kimi home's config" section missing | upheld | Lost in a round 2 edit; restored with a parsing contract and the observed config shape |
| intent | minor | Decision 23 does not say it supersedes 14 | upheld | Marked |
| intent | minor | Round 1 record says `supportEfforts` | upheld | Note appended to that row |
| intent | minor | Interrupted reviewer gets the "no report" nudge | upheld | No reminder armed on `interrupted` |
| mechanics | major | Missing parsing contract for the config reader | upheld | Same fix as intent finding 1 |
| mechanics | blocking | Stop is a proposed end other Stop hooks may block | accepted-risk | No other Kimi hooks are configured; same behavior as Claude Code Stop hooks; Accepted Risks |
| mechanics | blocking | Report extractor keeps only the last row | upheld | Verified `chat.js:228`; Kimi report function joins all text parts of the step, multipart test |
| mechanics | blocking | Missing binary leaves accounts eligible | upheld | Accounts report `problem: kimi is not installed` |
| mechanics | blocking | `hooks =` refusal not enforced at start | upheld | `startNamed` refuses, tested |
| mechanics | major | Ready problem precedence and display names | upheld | Settings-order rule; names resolved in the hub |
| mechanics | major | StopFailure skips the bound-session check | upheld | Carries `conversation_id`; check applied before forwarding |

### Round 4 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 3:** restored "Reading a Kimi home's config" with a parsing contract and the observed config shape; accounts ineligible when `kimi` is missing; `startNamed` refuses a home with inline `hooks =`; Ready problem precedence (Settings order, names resolved in the hub, `problem` never names an account; China-region text changed); StopFailure carries `conversation_id` and gets the bound-session check; no "no report" reminder after an interrupt; Kimi report function joins all text parts of the final step; Decision 23 marked as superseding 14; one more Accepted Risk.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | No Kimi account plan entry; `PLANS[kimi]` lookups throw | upheld | Verified `settings.js:34`; `PLANS.kimi = { unknown: 1 }`, Decision 28 |
| intent | minor | `ASSISTANT_CONTENT.kimi` contradicts the report function | upheld | Removed |
| intent | minor | Missing-CLI rule is Kimi-only | upheld | Rule dropped; Accepted Risk, Decision 29 |
| intent | minor | `kimi --version` costs 0.7 s per status | upheld | Cached by binary path and mtime |
| mechanics | blocking | Steps are keyed by `event.uuid`, not `stepUuid` | upheld | Verified sample line 21; Spec joins `stepUuid` to `uuid` |
| mechanics | blocking | Quoted `"hooks" = []` missed | upheld | Reader matches bare and quoted keys; tested |
| mechanics | blocking | Existing wheelchair rule with a `matcher` kept | upheld | Owned rules rewritten to exact form |
| mechanics | blocking | tmux panes lack the service PATH | upheld | Verified `service.js:613,1110`; absolute executable path, Decision 30 |
| mechanics | major | Per-CLI row could carry per-home problems | upheld | Per-CLI row carries machine-wide problems only |
| mechanics | major | Inline-hooks refusal would break sign-in | upheld | `seed`/`prepare` never throw; only agent start refuses; tests for both |

### Round 5 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 4:** `PLANS.kimi`; report function keyed by step `uuid` (no `ASSISTANT_CONTENT.kimi`); missing-CLI special case dropped (Accepted Risk); version cached by binary path and mtime; quoted `"hooks" =` detection; owned hook rules rewritten to exact form; absolute kimi executable path for launch and login; per-CLI status row carries only machine-wide problems; inline-hooks refusal at agent start only, sign-in proceeds.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Ready and launch disagree on where kimi is | upheld | `cliStatus('kimi')` uses the adapter's `resolveCli()` |
| mechanics | blocking | Sign-in reported failed on a home with inline hooks | upheld | Verified `service.js:1124-1135`; `authenticated` field drives sign-in success |
| mechanics | blocking | Default account home can differ between service and panes | upheld | Verified `loginEnv(null)` passes nothing; effective home always passed |
| mechanics | blocking | Escaped TOML keys evade the hooks detector | accepted-risk | Contrived; Kimi writes `[[hooks]]` itself; Accepted Risks |
| mechanics | major | Status uses `command -v`, not the fallback | upheld | Same fix as intent finding |
| mechanics | minor | Permission label omits Antigravity | upheld | Label names all three, visible and accessible |

### Round 6 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 5:** `cliStatus('kimi')` uses the adapter's `resolveCli()`; `loginEnv` always passes the effective `KIMI_CODE_HOME` (default account included); Kimi status entries add `authenticated`, which `loginState` uses for sign-in success; permission-mode label names Claude, Antigravity and Kimi; one more Accepted Risk.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | blocking | `loginState` still returns `logged_in` = eligible, so the page never says "Signed in." | upheld | Verified `settings.js:1056`; Kimi `loginState` returns `logged_in: authenticated` |
| intent | major | No way to show an account's problem in Settings | upheld | Verified `usage.js:57,99`; `problem` carried to the account row |
| intent | minor | Permission label pattern | upheld | Visible "… sessions", accessible "… permission mode" |
| intent | minor | No test for the `authenticated` split | upheld | Tests added |
| mechanics | blocking | Cancelled re-login reports success from old credentials | upheld | Verified `service.js:1124`; success needs this attempt's success marker |
| mechanics | blocking | Relative `KIMI_CODE_HOME` resolves differently in panes | upheld | Verified `common.js:17`; path made absolute |
| mechanics | major | Problem invisible after sign-in | upheld | Same fix as intent finding 2 |
| mechanics | major | Header-shaped text inside multi-line strings | upheld | Files with multi-line strings are not edited; reported as a problem |
| mechanics | minor | Unchanged-file assertion scope | upheld | Scoped to wheelchair's own calls |

### Round 7 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 6:** Kimi sign-in success needs this attempt's success marker plus `authenticated`, and `loginState` returns `logged_in: authenticated` for Kimi; `usage.js` carries `problem`/`authenticated` to the Settings account row, which shows the problem sentence; effective Kimi home made absolute; config files with multi-line strings are not edited (reported as a problem); permission label wording; sign-in test scoping and new tests.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Problem must be per machine, not per account | upheld | Verified `usage.js:57,99`; third per-machine form, boolean map untouched |
| intent | minor | `authenticated` carried to the hub but unused | upheld | Kept machine-side only |
| mechanics | blocking | `loginDone` kills the pane, losing the marker | upheld | Verified `service.js:1111-1135`; Kimi completes from the exit marker only |
| mechanics | major | `problem` must be keyed by machine | upheld | Same fix as intent finding 1, two-machine test |
| mechanics | blocking | Multi-line strings can fool config reads | upheld | Such files are not read or edited |
| mechanics | blocking | Unreadable config could be replaced | upheld | Only `ENOENT` creates a file; unreadable refuses start |
| mechanics | blocking | `answerPrompts` signature | upheld | Verified `service.js:694`; `(session, pane)` returning `{ step: 'trust', keys: ['Enter'] }` |

### Round 8 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 7:** account problems are a third per-machine form in `usage.js` (boolean map untouched; `authenticated` stays on the machine); Kimi sign-in completes only from the wrapper's exit marker, pane kept; config file states (absent, unreadable, multi-line strings) and what each does to reads, edits and start; `answerPrompts(session, pane)` contract for folder trust; new tests.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Multi-line config sign-in reported failed | upheld | `authenticated` from the credentials folder in that case |
| intent | minor | Refusal text sat under the account-row bullet | upheld | Regrouped into three bullets |
| mechanics | blocking | Subagent Stop can end the main turn | upheld | Stop ignored while the main transcript has an open tool call; live check with a subagent |
| mechanics | blocking | Owned rule with `timeout = 0` kept | upheld | Timeout must be 1–600 or the rule is rewritten |
| mechanics | blocking | Concurrent Kimi write lost by rename | upheld | Re-read and compare before publishing; exclusive create on the absent path |
| mechanics | major | Missing exit marker ambiguous | upheld | Kept result per attempt; `waiting` on transient capture failure |
| mechanics | major | Enter could hit `Exit` | upheld | Selection-marker check; Up+Enter when `Exit` selected |

### Round 9 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 8:** multi-line-string homes sign in successfully (`authenticated` from the credentials folder); refusal and sign-in rules regrouped into "Configs wheelchair will not edit", "Sign-in success versus being usable" and "Showing a problem on the account"; Stop forwarded only for the main agent (open tool call check); owned hook `timeout` range; concurrent-write guard in `prepare()`; sign-in result kept per attempt and transient capture failures; folder-trust selection check.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Subagents also send Interrupt and StopFailure | upheld | Resolved by Decision 35 (log-based turn ends) |
| intent | major | Subagent guard needs the transcript before binding; check is in `hookEvent` | upheld | Resolved by Decision 35 (log-based turn ends) |
| intent | minor | Agent-id branch can never fire on 2.6.3 | upheld | Resolved by Decision 35 |
| intent | minor | Subagent live check not in the numbered list | upheld | Resolved by Decision 35 |
| intent | minor | Replayed subagent Stop passes the check | upheld | Resolved by Decision 35 |
| mechanics | blocking | Open tool call cannot identify a Stop's source | upheld | Resolved by Decision 35 (log-based turn ends) |
| mechanics | blocking | Which stage resolves the transcript and drops events | upheld | Resolved by Decision 35 |
| mechanics | blocking | Concurrent Kimi writes can still drop wheelchair's hooks | upheld | Resolved by Decision 35 (no config edits) |
| mechanics | major | tmux prefix matching on login session names | upheld | Exact-match targets, tested |
| mechanics | major | Login states with unknown liveness / exit 0 but not authenticated | upheld | `waiting` when unknown; exit 0 unauthenticated is `failed` |
| mechanics | major | Up and Enter sent separately on the trust screen | upheld | Up only; Enter on a later poll once trust is shown selected |

### Round 10 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 9:** the Spec was rewritten around reading turn ends from Kimi's main log (Decision 35): no hooks, no `config.toml` edits, binding by a `Session:` line, `pollKimiTurns`, once-per-`turnId` with persisted offset, protocol guard, report by `turn_id`. Sign-in: exact tmux targets, missing-marker states. Folder trust: Up then Enter on a later poll. Three Accepted Risks removed. **Scope: the whole Spec in depth** (it was rewritten).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

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

- After round 9, Collin chose "Read Kimi's log". Spec rewritten in full; three hook-related Accepted Risks removed as no longer applicable (the report now uses the turn id).

- Review budget reached again after round 9 (rounds 7–9 since Collin's last Keep going). Recurring source: hook-based turn-end detection and editing Kimi's config.toml. Proposed redesign: turn end read from the main transcript's `turn.ended` events, hooks only as a wake-up.

- Review budget reached after round 6; Collin pressed Keep going (round 7, budget reset).

Free-form running notes: deviations discovered mid-implementation, scope events,
anything a future session needs that fits nowhere above.
