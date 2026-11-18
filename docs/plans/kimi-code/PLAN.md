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
  completed turn. The machine's existing `cliStatus` already runs `kimi --version` (a
  bare semver). Below 2.6.3, the Kimi CLI status and every Kimi account entry report
  `logged_in: false` with `problem: "Kimi Code is older than 2.6.3; run kimi upgrade"`,
  and session start for a Kimi session on that machine is refused with the same
  sentence. The version is cached by the resolved binary path plus its mtime, so
  `kimi --version` (about 0.7 s) runs only when the binary changes, not on every status
  call.
- **How problems reach Ready.** Machine status entries (the per-CLI status and each
  `accounts[]` entry) may carry an optional `problem` string, which never names an
  account. The per-CLI row carries only machine-wide problems (the version floor); every
  per-home problem (China region, inline hooks) goes on that home's `accounts[]` entry,
  including the default home's, never on the per-CLI row. `viewer/app/ready.js` keeps
  its rule (some unpaused account of the thread's
  provider is logged in). When the rule fails: if the per-CLI status has a `problem`,
  that is the missing line; otherwise the first account, in Settings order, that is in
  Settings, unpaused, not retired, and whose status entry carries `problem`, gives the
  line `<account display name from Settings>: <problem>` (the name is resolved in the
  hub). With none, the usual "<label> is not logged in". Placement (`viewer/app/usage.js`) is
  unchanged: an entry with `logged_in: false` is not eligible. So with one global and one
  China-region Kimi account, sessions go to the global one and Ready passes.

### Reading a Kimi home's config

Status, login checks and launch never spawn the kimi CLI to learn about an account
(`kimi provider list --json` takes about a second per call, and the machine's status call
has a 3-second budget). `machine/adapters/kimi.js` has a small line reader for
`$KIMI_CODE_HOME/config.toml` (no TOML library; the machine has no dependencies):
- A table header is a line matching `^\s*\[([^\[\]]+)\]\s*(#.*)?$`; the header text is
  compared after trimming, with quoted segments kept exactly (for example
  `providers."managed:kimi-code".oauth`). `[[…]]` array-of-table headers start a table
  the reader ignores.
- Inside a table, a line `name = "string"` gives a string; `name = [ "a", "b" ]` on one
  line gives an array of strings. A value the reader cannot parse (multi-line array,
  other types) is ignored. `#` comments and blank lines are skipped.
- It extracts only: from table `providers."managed:kimi-code".oauth` the strings `key`
  and `oauth_host` (the `services.*.oauth` tables also have `key` and are ignored); from
  each table `models."<alias>"` the array `support_efforts` (absent for some models);
  and whether any line before the first table header matches
  `^\s*(hooks|"hooks"|'hooks')\s*=` (a top-level inline hooks assignment, bare or
  quoted key).
- **File states.** Absent (`ENOENT`): nothing configured (not logged in, no efforts, no
  inline hooks); `prepare()` may create a fresh file holding only wheelchair's hooks.
  Exists but cannot be read (any other error): no facts are trusted, the home's status is
  `logged_in: false`, `authenticated: false`,
  `problem: "Kimi Code's config.toml can't be read"`; `prepare()` and `seed()` never
  write it; agent start on that home is refused with the same sentence.
  Contains a multi-line string delimiter (`"""` or `'''` anywhere): no facts are
  trusted for reading **or** editing (a header- or key-shaped line could sit inside a
  string): `logged_in: false`, `authenticated` from the credentials folder (see "Sign-in
  success versus being usable"), and the multi-line `problem` below; no edit; agent start refused. Tests cover a real OAuth table alongside a
  multi-line value containing a fake one (refused, not misread), and an unreadable
  file (left untouched, start refused).
Unit tests run it on a fixture copying the logged-in shape below (with dummy values),
including the `services.*.oauth` tables, a model with and one without
`support_efforts`, and on an empty home.

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

Kimi itself rewrites `config.toml` (keeping non-empty hook arrays as `[[hooks]]`), so
the reader must tolerate any key order within a table.

### Accounts and data directory

- Each account has its own data directory passed as `KIMI_CODE_HOME`. `loginEnv(dir)`
  **always** returns `{ KIMI_CODE_HOME: <effective home> }`: `dir` for a named account,
  and for the default account (`dir` falsy) the usual home, `c.home('KIMI_CODE_HOME',
  '.kimi-code')` as seen by the service, always made absolute with `path.resolve` (a
  relative override would otherwise resolve against the pane's working directory). That
  same absolute path is used for status, hook preparation, transcript lookup, launch and
  sign-in. So the service (status, hook preparation,
  transcript lookup) and every tmux pane (launch, sign-in) always use the same
  directory, even when the service's environment sets `KIMI_CODE_HOME` and the tmux
  server's does not. A test sets `KIMI_CODE_HOME` only in the service and checks both
  pane commands carry it.
- Multiple Kimi accounts are allowed (`singleAccount: false`). `seed()` follows the Claude
  and Codex pattern (writes `wheelchair-account.json`); it never copies credentials.
- A fresh account directory has no `config.toml` provider and no credentials until it is
  logged in.

### Launch

- **Executable path.** tmux panes inherit the tmux server's environment, not the
  service's PATH, so Kimi commands never rely on PATH inside a pane. The adapter resolves
  the executable once per call: `command -v kimi` in the service's PATH, else
  `~/.kimi-code/bin/kimi` if it exists and is executable (the official installer's
  location). The adapter exports this as `resolveCli()`, and `machine/service.js`'s
  `cliStatus('kimi')` uses it (instead of `command -v kimi`) for both the installed
  check and the cached `--version`, so Ready, launch and login always agree on whether
  and where Kimi is installed. Launch argv and `loginCommand()` both start with that
  absolute path. A test
  covers launch and login when the pane's PATH lacks the kimi directory.
- argv: `<resolved kimi>`, then `--auto` when `session.permission_mode === 'bypass'`, else `--yolo`;
  then `--model <input.model>` when set. No other flags. Working directory is the
  worktree (Kimi has no work-dir flag). Env adds `loginEnv(accountDir)`, and the
  adapter sets `sessionNameEnv: true` so `WHEELCHAIR_SESSION_NAME` is in the CLI's
  environment, which Kimi passes on to its hook commands.
- The `permission_mode` setting therefore governs Kimi too (it already governs Claude and
  Antigravity). Its visible row text becomes "Claude, Antigravity and Kimi sessions" and
  its accessible label "Claude, Antigravity and Kimi permission mode"
  (`viewer/pages/settings.js:481,522`), with no other change.
- **Folder trust.** First launch in a folder shows a "Trust this folder?" screen
  (`❯ Trust and continue` / `Exit`). `answerPrompts(session, pane)` (the existing
  contract, `machine/service.js:694`), when the pane contains `Trust this folder?`,
  returns `{ step: 'trust', keys: ['Enter'] }` if the selection marker is on the trust
  option (a line matching `❯\s*Trust and continue`), or `{ step: 'trust', keys: ['Up',
  'Enter'] }` if it is on `Exit` (`❯\s*Exit`), and `null` otherwise. Tests cover both
  selections,
  as `agy.js` handles its onboarding screens. Nothing is pre-written into Kimi's
  `workspace-trust/` directory (its key format is internal).
- **Ready text:** the pane shows the input box line `│ >` and the footer's `context:`
  line, and none of the trust screen's text.
- **Role message:** typed, like Antigravity (`typesRoleMessage: true`), with the same
  `[wc:role]` first message format as `agy.js` `firstMessage`.
- **Effort:** set per process through the launch environment, never through `/effort`
  (which saves the choice as the account's default model and effort in `config.toml`).
  When `session.effort` is set, the adapter maps low→low, medium→high, high→high,
  xhigh→max, max→max, and adds `KIMI_MODEL_THINKING_EFFORT=<level>` only when the
  launched model's `support_efforts` (read from the account home's `config.toml`) contains
  the mapped level. A model with no `support_efforts` (observed: the light pin
  `kimi-code/kimi-for-coding-highspeed`) gets no variable and runs at its default.
  Mechanism: `adapter.command(input, session, worktree, context)` may return an `env`
  object; `context` gains the session's account home (`accountDir`, null for the
  default). `machine/service.js` merges `built.env` into the `env …` prefix of the tmux
  command after `loginEnv(dir)`. `loginEnv` stays login-only. Other adapters return no
  `env` and are unaffected. The live check confirms the variable takes effect with the
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
  mode, and writes atomically (temp + rename). **Concurrent writes:** Kimi (for
  example a sign-in) may rewrite the file while wheelchair prepares it. Just before
  publishing, `prepare()` re-reads the file and compares it byte for byte with the
  snapshot it edited; if it changed, it starts over from the new content, up to three
  times, then gives up with
  `problem: "Kimi Code's config.toml kept changing; try again"` (no write, agent start
  refused until a later prepare succeeds). On the absent-file path it creates the file
  with an exclusive create (`fs.linkSync(temp, file)`, which fails if the file now
  exists) and on that failure starts over as an edit. Tests simulate a change between
  read and publish, and a file appearing on the absent path. Hooks are global per home; there is no
  project-level hook file. A wheelchair rule is a `[[hooks]]` table whose `command` is
  wheelchair's hook path and whose `event` is one of the three. It is left as is only if
  it has exactly `event`, `command` and optionally a `timeout` that is an integer from 1
  to 600 (Kimi's allowed range); one with any other field (such as a `matcher` that
  could suppress it) or an out-of-range or non-integer `timeout` is rewritten in place to
  the exact form (no `timeout`). A
  missing one is appended.
- **Configs wheelchair will not edit.** Two cases, besides the unreadable file in
  "Reading a Kimi home's config":
  - a multi-line string delimiter anywhere in the file:
    `problem: "Kimi Code's config.toml has multi-line strings wheelchair can't safely edit"`;
  - a top-level `hooks` assignment with `=` (bare or quoted key; `hooks = []` or an
    inline array, which a later `[[hooks]]` would make invalid TOML):
    `problem: "Kimi Code's config.toml sets hooks = …; change it to [[hooks]] tables"`.

  In both, the home's status is `logged_in: false` with that `problem`, so Ready names
  it. `seed()` and `prepare()` never throw: they leave the file untouched and return.
  Agent start (`startNamed`) re-reads the file and refuses to start a Kimi session on that
  home with the same sentence, so no session runs without wheelchair's hooks. Sign-in is
  not refused: `kimi login` runs as usual (it needs no hooks).
  Tests: agent start on a signed-in home with `hooks = []`, with `"hooks" = []`, and with
  a multi-line string is refused; sign-in on such a home proceeds, and wheelchair's own
  `seed()`/`prepare()` calls leave the file unchanged (asserted before the fake
  `kimi login` runs, since a real login writes the file itself).
- **Sign-in success versus being usable.** Kimi status entries also carry
  `authenticated`: true when the managed provider's credentials file exists (from the
  oauth `key`), or, when the config is not trusted for reading (multi-line strings),
  when any `*.json` file exists in `<home>/credentials/`. It ignores region and hooks
  problems. `machine/service.js` `loginState` decides sign-in success from
  `authenticated` when present, else `logged_in` (other CLIs unchanged): for Kimi,
  sign-in is `done` only when this attempt's exit marker is `__wc_login_exit 0` **and**
  `authenticated` is true; a nonzero exit is `failed` even if older credentials exist.
  The `logged_in` field `loginState` returns is `authenticated` for Kimi, so the Settings
  page (`viewer/pages/settings.js:1056`, which needs `state === 'done' && logged_in`)
  shows "Signed in." on a home with a China region, inline hooks or multi-line strings,
  and the account row then shows the problem (next bullet). `authenticated` is read only
  by the machine's `loginState`; it is not carried to the hub.
- **Showing a problem on the account.** The problem is per machine, like sign-in state.
  `viewer/app/usage.js:57` keeps its boolean `accounts[id]` map untouched (placement and
  usage polling read it by truthiness). The per-machine value built at `usage.js:99`
  gains a third form: `{ state: 'problem', text: <problem> }` beside `'signed_in'` and
  `'signed_out'`, used when the machine's status entry for that account has
  `logged_in: false` and a `problem`. The Settings account row
  (`viewer/pages/settings.js:1141-1150`) shows that machine's sentence in place of
  "signed out"; its Sign in button stays (signing in again fixes the China-region case).
  Tests: one Kimi account on two machines, signed in on one and with a problem on the
  other, shows each machine's row correctly and placement uses the signed-in machine; a
  browser test where the machine reports a Kimi account with `logged_in: false` and a
  `problem` shows the sentence; sign-in on a China-region, an inline-hooks and a
  multi-line-string home each ends with "Signed in."; a cancelled re-login (nonzero
  exit) on a home with old credentials ends as failed. Tests cover: a fresh file, a file with other
  `[[hooks]]` rules, a rerun (no duplicates), and the `hooks = []` refusal.
- `machine/hook.sh` gets a `kimi` case: session name **only** from
  `WHEELCHAIR_SESSION_NAME` (the hook rule passes no second argument, so do not copy
  `agy`'s `${2:-…}`), exit 0 when absent (a Kimi run Collin started himself),
  payload from stdin, and the same durable spool path, so a Stop that arrives while the
  machine service is down is replayed when it returns. A test covers that replay.
- Stop payload (snake_case): `hook_event_name`, `session_id` (`session_<uuid>`), `cwd`,
  `client_type`, `session_title`, `turn_id`, `step`, `first_step_of_turn`,
  `finish_reason`, `usage`, `stop_hook_active`. There is **no transcript path**.
- `hookEvent(raw)`:
  - `Stop` → `{ type: 'turn-ended', conversation_id: raw.session_id }`, but only for
    the **main agent**. Kimi runs Stop hooks for its built-in subagents too, with the
    same `session_id`. So before forwarding a Stop, the adapter checks the bound main
    transcript (`agents/main/wire.jsonl`): if it has a `tool.call` loop event with no
    later `tool.result` of the same `toolCallId` (the main agent is still waiting on a
    tool, such as a subagent), the Stop is ignored (`{ ignored: true }`); otherwise it
    is forwarded. If the payload itself names the agent (the worker checks the 2.6.3
    payload for an agent id during the live check), a non-main agent id is ignored
    directly. The live check runs one Kimi turn that uses a subagent and confirms exactly
    one turn end reaches the hub. Unit test: a transcript with an open `tool.call` makes
    a Stop ignored.
  - `StopFailure` → `limit-hit` when its error text matches
    `quota|rate.?limit|429`, else `turn-failed` with the error text; both carry
    `conversation_id: raw.session_id`. Before a Kimi `limit-hit` or `turn-failed` reaches
    the hub, `machine/service.js` applies the same bound-session check as for turn ends:
    a session already bound to a different `kimi_session_id` gets `{ ignored: true }`. The worker reads the
    real StopFailure and Interrupt field names from Kimi's hook event reference
    (https://moonshotai.github.io/kimi-code/en/customization/hooks#event-reference) and the
    binary, and records them in its report.
  - `Interrupt` (an operator pressed Esc or Ctrl-C) → `{ type: 'turn-ended',
    conversation_id: raw.session_id, interrupted: true }`. It releases the turn exactly as
    a Stop does: queued messages are delivered and any permission hold clears.
  - Anything else → `null`.
- `onTurnEnded(session, event)`: the session name in the hook already identifies the app
  session (several sessions share one worktree, so `cwd` cannot). Outcomes:
  - **Not yet bound:** find `$KIMI_CODE_HOME/sessions/*/<session_id>/agents/main/wire.jsonl`
    under the session's account home. If its first `turn.prompt` with
    `origin.kind === 'user'` has text starting `[wc:role]`, bind: store `kimi_session_id`
    and `source_transcript`, return `{}`. Otherwise (file missing or no match) return
    `{ unverified: true }`: the turn end is still forwarded to the hub, never dropped.
  - **Bound, same `session_id`:** `{}`.
  - **Bound, different `session_id`:** `{ ignored: true }` (a stray Kimi run; as `agy.js`).
  `machine/service.js` forwards `unverified` (and `interrupted`) on the turn-ended event
  to the hub, including on spool replay. Session titles are not used. Subagent files
  under `agents/<other>/` are not read.
- **Hub handling** (`viewer/app/sessions.js`, turn-ended path): when the event has
  `interrupted` or `unverified`, the hub releases the turn (queued messages, permission
  hold) but **skips report extraction** (`deliverReport`) and does not mark a reviewer or
  verifier finished. For `unverified` the existing "turn ended with no report" reminder
  applies (`quiet.arm`). For `interrupted` the hub does not arm that reminder: Collin
  stopped the turn on purpose. A test covers each flag with a reviewer session.

### Transcript reading

- `viewer/app/chat.js` gets `parseKimi` and `PARSERS.kimi` (the report path is
  below; no `ASSISTANT_CONTENT.kimi`).
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
- A reviewer's or verifier's report: Kimi gets its own report function in `chat.js`
  (not a one-row `ASSISTANT_CONTENT` entry, since one reply spans several rows). A step
  is identified by the `event.uuid` of its `step.begin`/`step.end` events; a
  `content.part` belongs to the step whose `uuid` equals the part's `event.stepUuid`. In
  the last turn, it takes the last step that has any text parts and joins **all** of them
  in order (by `event.block`) with no separator. On the sample this yields "done". `lastAssistantText('kimi', raw)` dispatches to
  it. A test uses a fixture whose final step has two text parts and expects both.
- Conversation id handling in `viewer/app/sessions.js:552,722` and
  `viewer/app/asides.js:41` gains Kimi using `kimi_session_id`.

### Login

- `loginCommand()` → `['<resolved kimi>', 'login', '--region', 'global']`, run with
  `loginEnv(dir)`. `--region global` signs in through kimi.ai and points the account at
  `https://api.kimi.ai/coding/v1` (the default, `mainland-cn`, uses kimi.com; Collin is
  outside China). It prints `Opening browser for Kimi device login: <url>` and
  `paste the URL above and enter code: <CODE>`, then `Logged in to managed:kimi-code.`
  on success (exit 0). No prompts need answering (`loginPrompt` → `null`).
- `parseLogin(pane)` returns `{ url, code, wantsCode: false }` with the link and user
  code exactly as printed (no rewriting).
- `loginDone(pane)` returns false for Kimi: completion comes only from the wrapper's
  exit marker (`__wc_login_exit <n>`), which stays on the pane (the wrapper sleeps after
  it) so repeated polls see the same result. Exit 0 and `authenticated` → `done`; any
  other code → `failed`. The pane is not killed on success by the Kimi path. The first
  terminal result seen (`done` or `failed`) is kept on the login record and returned on
  every later poll of that attempt, even after the pane is gone; starting a new sign-in
  for the account clears it. With no marker yet: a failed pane capture while the
  `wc-login-<account>` tmux session still exists is `waiting` (transient; keep
  polling); if the tmux session no longer exists and no result was kept, `failed`.
  Tests: repeated polls after a successful login all return `done`, including after the
  pane is killed; a cancelled login (nonzero exit) on a home with old credentials returns
  `failed`; a capture failure with the session alive returns `waiting`.
- `loginStatus(dir)` (no CLI spawn; see "Reading a Kimi home's config"):
  - logged in when the managed provider's oauth `key` is present and
    `<home>/credentials/<key with the leading "oauth/" removed>.json` exists. Observed
    after a global login: `key = "oauth/kimi-code-env-0e4f99c69cc27850"`,
    `oauth_host = "https://auth.kimi.ai"`, and that credentials file present. The file
    name is never hard-coded.
  - region: global when `oauth_host`'s host is `auth.kimi.ai`; anything else, or no
    `oauth_host` (Kimi then treats the account as mainland China), is China. The
    `$KIMI_CODE_HOME/region` file is **not** read: it is a weaker installer marker and
    stays `mainland-cn` after a global login.
  - a China-region account reports `logged_in: false` with
    `problem: "signed in to Kimi's China region; log in again"`.
  - an empty home has no `[providers…]` table: not logged in, no problem.
- Ready check: no Kimi-specific code beyond the `problem` rule above; missing CLI shows
  "kimi is not installed" as for other CLIs.

### Models

- **Account plans.** `PLANS.kimi = { unknown: 1 }` in `viewer/app/settings.js:34`;
  Kimi accounts weigh equally unless Collin sets a per-account weight. Every place that
  looks up `PLANS[provider]` works for `kimi`, and saving settings with a Kimi account
  succeeds (tested).
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
- The Settings page's model value check (`MODEL_VALUE`, `viewer/pages/settings.js:17`,
  used by the "Other…" field) accepts the same one-`/` form for Kimi slots only. A browser
  test saves a slashed Kimi alias through "Other…", reloads the page, and sees it.
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
  argv and the launch `env` (effort set for a model with `support_efforts`, unset for one
  without), the config line reader, the hook-config cases listed under Hooks, `hookEvent`
  on the sample Stop payload and on an `Interrupt`, binding: two app sessions sharing one
  worktree each bind their own Kimi session by app session name and the transcript's
  `[wc:role]` prompt, an unmatched transcript gives `unverified`, a different id after
  binding is ignored; `parseLogin` returns the device URL unchanged; `loginStatus` on a
  global home, a China-region home (`problem` set) and an empty home; the version floor
  (status `problem` and refused start); spool replay of a Stop while the service is down.
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
| A top-level hooks key written with TOML escapes (for example `"ho\u006fks" = []`) is not detected, and appending `[[hooks]]` would make that file invalid | Nobody writes keys that way; Kimi itself rewrites `config.toml` with hook arrays as `[[hooks]]` tables | 5 |
| Placement can pick a Kimi account on a machine where the `kimi` binary was removed after login | Same for every CLI today; Ready reports the missing CLI | 4 |
| Another Stop hook Collin adds could block Kimi's turn end after wheelchair's hook has already reported it | Wheelchair adds no blocking hooks; Claude Code's Stop hooks behave the same and the app treats them the same way | 3 |
| A delayed or replayed Stop could deliver a report from a later turn, since the report is the last assistant text in the transcript | Same behavior as Claude, Codex and Antigravity today (`viewer/app/chat.js` `lastAssistantText`); reviewers and verifiers run one turn | 2 |

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

- Review budget reached after round 6; Collin pressed Keep going (round 7, budget reset).

Free-form running notes: deviations discovered mid-implementation, scope events,
anything a future session needs that fits nowhere above.
