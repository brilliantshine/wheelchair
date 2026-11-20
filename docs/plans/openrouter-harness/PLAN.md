---
slug: openrouter-harness
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-19
---

# OpenRouter models as wheelchair agents

**Idea:** `IDEA.md` — read it first. **Map:** `MAP.md`.

## Open Questions

_None._

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | Pi runs tools with no approval prompt | How other harnesses are launched | no | Settled: Decision 3 |
| 2 | Kimi limits model ids to one slash | OpenRouter id format | no | Settled: Decision 5 |
| 3 | Roles | Which roles may use the provider | no | Settled: Decision 4 |
| 4 | Key handling | Where the key lives and how it is checked | yes | Promoted to Q2 |
| 5 | Review families | OpenRouter can serve Claude or GPT models; cross-family review counts providers | no | Settled: Decision 6 |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Plan mode two-part | User's choice: build for day-to-day use first, harden in a follow-up | user |
| 2 | Build on Pi (`earendil-works/pi`, `@earendil-works/pi-coding-agent`), not OpenCode | Documented turn-end event, JSONL transcript chosen by `--session-id`, per-message usage, plain auth file; OpenCode's v2 transcript and turn-end are undocumented | user |
| 3 | Pi agents run without approval prompts, like Claude `auto`, Kimi and Antigravity today (`machine/adapters/claude.js:74`, `kimi.js:128`, `agy.js:67`). Always pass `--approve`. Reviewers get Pi's read-only tool set if Pi offers one (checked in the dry run); if not, same as Kimi, which ignores role | Matches existing providers; Codex's sandbox is the only stricter one | defaulted |
| 4 | The new provider may fill every role Kimi can (lead, sub-lead, mapper, worker, reviewer, verifier), governed by the same Settings orders | Consistency with Kimi (`viewer/app/balancer.js:29-50`) | defaulted |
| 5 | Model ids accept OpenRouter's `vendor/model` form with an optional `:variant` suffix (e.g. `:free`), up to 64 characters, in the hub, Settings page and `codex/model.sh` | That is OpenRouter's id format | defaulted |
| 6 | The provider is named `openrouter` and counts as its own family for cross-family review, whatever model it serves | Simplest; a mismatch only matters when it serves the same family as the other reviewer | defaulted |
| 7 | The key is entered in the app: Settings offers sign-in for OpenRouter like other providers, opening Pi's own login (`/login openrouter`) in the login pane; status reads only whether `auth.json` has an `openrouter` entry or `OPENROUTER_API_KEY` is set, never the key itself | User's choice; matches the other providers | user |
| 8 | Show OpenRouter spend in this first part, on the usage view | User's choice | user |
| 9 | Turn ends come through the existing hook path (`machine/hook.sh`), fired by a per-session Pi extension on `agent_settled`, not a log poller like Kimi's | Pi documents the event; the hook path is the simpler, proven route | defaulted |
| 10 | Default model for every slot is `openrouter/auto` (OpenRouter's own router); the user changes pins in Settings | Never goes stale; works with any key | defaulted |
| 11 | No effort/thinking setting and no side conversations (asides) on OpenRouter sessions in this part | Same as Kimi; hardening for the follow-up | defaulted |
| 12 | Spend is summed from the `cost` Pi records on each reply in its session logs, offline; no call to OpenRouter's API | No key handling beyond Pi's own; the dry run confirms the cost is recorded | defaulted |

## Spec

### Harness

The new provider runs the Pi coding agent (`pi`, from `earendil-works/pi`) with Pi's built-in
`openrouter` provider. Facts from Pi's docs (2026-11-19, unverified by a run; the first
build task confirms them with a dry run and records any difference in the Log):

- Launch: `pi [message]` in the session's working directory; `--provider`, `--model`,
  `--session-id <uuid>`, `--approve` (skips the project-trust prompt).
- Turn end: an extension (global `~/.pi/agent/extensions/`, or `-e <file>`) can listen for
  `agent_settled`.
- Transcript: `~/.pi/agent/sessions/--<cwd>--/<timestamp>_<uuid>.jsonl`; header line
  `type: session`, then `type: message` lines; assistant messages carry `usage` and `cost`.
- Credentials: `~/.pi/agent/auth.json` keyed by provider, or `OPENROUTER_API_KEY`.
- tmux needs `extended-keys` on for Pi's Enter handling.

### Identity

- Provider id `openrouter`, label `OpenRouter`, CLI id `pi`. Registry entry in
  `viewer/app/providers.js`: `effort: false, preflight: false, asideFork: false,
  singleAccount: false`, `typesRoleMessage` per the dry run (true unless Pi takes a system
  prompt file at launch).
- Add `openrouter` / `pi` everywhere providers are enumerated: `codex/model.sh` (PROVIDERS,
  DEFAULTS, usage text, pin parsing), `viewer/app/providers.js`, `viewer/app/settings.js`
  (PLANS `{ unknown: 1 }`, review-family values), `viewer/app/routes.js`,
  `viewer/pages/settings.js`, `viewer/pages/threads.js`, `viewer/pages/thread.js`,
  `viewer/app/chat.js`, `viewer/app/usage.js`, `machine/adapters/index.js`,
  `machine/service.js` (CLI name checks), `install.sh` (detect `pi` on PATH, add its directory
  to the service PATH; never install Pi), `viewer/app/API.md`, `machine/API.md`,
  `viewer/AGENTS.md`, `machine/AGENTS.md`, `README.md`, and the provider enums in
  `protocol/app/lead.md` and `protocol/app/sub-lead.md`. Settings normalization already
  appends a newly seen provider to the orders; keep that.
- Roles: every role Kimi can fill (Decision 4). Counts as its own family (Decision 6).

### Model ids

`openrouter` pins accept `^[a-z0-9][a-z0-9._-]{0,63}/[a-z0-9][a-z0-9._:-]{0,63}$` (OpenRouter's
`vendor/model[:variant]`), total at most 128 characters, enforced identically in
`codex/model.sh`, `viewer/app/routes.js` and `viewer/pages/settings.js`. Other providers'
rules are unchanged. Defaults: `openrouter/auto` for light, standard, heavy, critical and
lead.

### Dry run (first build task)

Before writing the adapter, install nothing; if `pi` is installed and an OpenRouter key is
present, run Pi once in a scratch directory under tmux and record in the plan's Log: the exact
launch flags for provider and model (does `--model openrouter/auto` with `--provider
openrouter` work), the ready-screen text, whether `--approve` removes the trust prompt,
whether `extended-keys` is needed, the extension API shape for `agent_settled` and tool events,
the transcript path and the assistant `usage`/`cost` fields for an OpenRouter reply, whether
Pi has a read-only tool set flag, whether it takes a system-prompt file, and what `/login
openrouter` shows (URL, key prompt, or both). If `pi` or a key is missing, record that and
build from the documented facts above; the live smoke (Validation) is then reported as not
run. Any fact that differs from this Spec is reported to the lead before building on it.

### Machine adapter `machine/adapters/pi.js`

Same contract as the others (`machine/adapters/index.js:2-4`):

- `command`: writes a per-session extension file under the machine state dir (like Claude's
  per-session settings file) and returns argv `pi --provider openrouter --model <pin>
  --session-id <cli_session_id> --approve -e <extension>` plus the role prompt per the dry run.
  Reviewers get Pi's read-only tool set when one exists. Account dirs use
  `PI_CODING_AGENT_DIR=<account dir>`; the default account uses `~/.pi/agent`.
- The extension, on `agent_settled`, runs `machine/hook.sh pi <session name>` with a JSON
  payload naming the event and the transcript path; `hookEvent` maps it to
  `{ type: 'turn-ended', transcript_path }` (aborted maps to the same turn-ended with the
  outcome noted, as Claude's Stop does). If Pi's API offers tool start/end events, map them to
  `step` events as Claude does; otherwise send none.
- tmux: if the dry run shows Pi needs `extended-keys`, the machine turns it on for Pi sessions
  without changing behaviour for other CLIs.
- `readyText`/`answerPrompts`: from the dry run's screens. There are no per-tool approval
  prompts.
- `findTranscript`: the `*_<cli_session_id>.jsonl` file under the account's
  `sessions/` tree.
- `loginStatus(dir)`: signed in when the account's `auth.json` has an `openrouter` entry or
  `OPENROUTER_API_KEY` is set in the service environment. It reads `auth.json` only to test
  for the key's presence and returns booleans and fixed problem strings, never the key.
- `loginCommand`/`parseLogin`/`loginPrompt`: open Pi and drive `/login openrouter` in the
  existing login pane flow, exposing whatever Pi presents: a URL to open and/or a prompt to
  paste a key (the existing `wantsCode` path).
- Machine restart: recovery recognises a Pi pane (`machine/service.js:488`) and carries on
  with hook-delivered turn ends.
- `usageFrom` returns null (no rate windows).

### Hub

- `viewer/app/chat.js`: a Pi transcript parser showing user and assistant text and tool calls
  like the other parsers, and a report selector that returns the final assistant text of the
  turn that ended (reviewer and verifier results).
- Spend: a machine endpoint (documented in `machine/API.md`) returns, per OpenRouter account,
  the sum of `cost.total` over assistant messages in that account's Pi session files for today
  (machine local time), the last 7 days and the last 30 days, in US dollars, read offline.
  The hub's usage view shows these three figures on the OpenRouter provider card in place of
  the percentage bars, e.g. "$0.42 today · $3.10 this week · $11.80 this month", with
  "no spend yet" when zero. Missing or unparseable cost fields count as zero. OpenRouter
  accounts never count as out of room.

### Keeping the key secret

The key never appears in machine or hub logs, state files, thread files, cards, chat items or
API responses. Text pasted into the login pane is sent to tmux only. Pane captures returned
for the login screen redact anything matching `sk-or-[A-Za-z0-9_-]+`.

### Not in this part

Asides, effort/thinking, Pi version checks, OpenRouter's own usage API, an installer for Pi,
and everything in Deferred.

### Validation

```bash
bash machine/test/run.sh            # includes new machine/test/pi*.test.js
node --test viewer/test/*.test.js   # includes new viewer/test/app-openrouter-*.test.js
bash codex/test/run.sh              # openrouter pins, defaults, id rule
bash install/test/run.sh            # pi detection fixtures
node test-support/smoke/pi-live.js  # live, only with pi and a key; costs a few cents
```

Tests must cover: adapter argv and extension file; hook payload to turn-ended; transcript
binding by session id; chat parsing and report selection from a sample Pi transcript (saved
under `docs/plans/openrouter-harness/samples/`); login status present/absent without the key
in any output; login pane redaction; model id rule in all three places; spend sums over a
sample transcript set including missing cost fields; Settings showing OpenRouter; and a fake
Pi CLI driving a full start → ready → turn-ended → report cycle in the machine tests.
The live smoke starts a Pi session through the machine service, waits for one turn end, and
checks that the chat shows the reply, the report is delivered and spend is non-zero.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| 1 | Side conversations on OpenRouter-led threads | Asides are optional; the app already says they aren't available | planning | `viewer/app/asides.js:40`; Pi has `--fork`-style session options to check |
| 2 | Thinking/effort levels for OpenRouter agents | Agents run fine at the model's default | planning | Pi `--thinking`; `providers.js` `effort` flag |
| 3 | Pi version check and a clear message when Pi changes its screens or log format | Needed only when Pi updates break something | planning | Kimi's `checkKimiVersion` in `machine/service.js` is the model |
| 4 | Spend on the Agents screen per thread and per agent | The usage view total covers day-to-day needs | planning | Sum per session file by `cli_session_id` |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-19

**Lanes:** intent lens and mechanics lens, families recorded at start; cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
