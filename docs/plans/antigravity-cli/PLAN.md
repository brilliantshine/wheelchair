---
slug: antigravity-cli
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-16
---

# Antigravity CLI as a third agent provider

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

None open.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | Docs say credentials live in a shared app dir and the OS keyring | Whether two Antigravity accounts can be kept apart on one machine | no | Settled: live check decides; fallback is one account per machine (Decision 9) |
| 2 | `protocol/app/lead.md:82-83` says Ready checks both families; `viewer/app/ready.js:39-56` checks only the thread's CLI | Stale line | no | Settled: fix the line (Spec, Protocol) |
| 3 | `agy` self-updates in the background on every run | Formats can change under us | no | Settled: parsers fail loudly (Spec, Failure handling) |

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Provider key `gemini`, CLI `agy`, shown as "Antigravity" | Provider keys name the model family (`claude`, `gpt`), CLIs name the binary | defaulted |
| 2 | Sign-in reuses the Settings sign-in card's link + pasted-code path that Claude uses | `agy` remote login is link then pasted code, same direction as Claude (`viewer/pages/settings.js:908-981`) | defaulted |
| 3 | With three families, cross-family review keeps two lanes; "the other family" means any family other than the first lane's, taken in role order | Keeps review cost the same; `both` generalises to "two or more families usable" | defaulted |
| 4 | No usage meter for Antigravity unless `agy` exposes limit windows; a rate-limit failure still marks the account limited | Limit windows are undocumented (MAP.md) | defaulted |
| 5 | Asides on Antigravity sessions use `agy -p --conversation` resume if it can fork; otherwise asides are unavailable on those sessions with a plain message | Headless resume is documented, fork is not | defaulted |
| 6 | `agy` 1.5.9 installed on this machine at `/home/collin/.local/bin/agy` via Google's installer (no root needed); the build starts with a live check task that captures real login, transcript and hook output as fixtures | Docs leave these unspecified | user |
| 7 | Antigravity can run every role; it is appended last to `worker_order` (and so to the lead order's `any`); saved orders missing it get it appended at load | Only picks up work when Claude and Codex are busy or limited; reorderable in Settings | user |
| 8 | Role instructions reach `agy` as a typed first message starting `[wc:role]`, like Codex (`typesRoleMessage: true`) | `agy` has no documented append-system-prompt flag | defaulted |
| 9 | Account isolation: the live check looks for a variable that moves only `agy`'s config and credentials (candidates seen in the binary: `ANTIGRAVITY_CONFIG_REL_DIR`, `ANTIGRAVITY_EXECUTABLE_DATA_DIR`). If none works without changing `HOME`, Antigravity supports only the machine's default account and Settings says so instead of offering "Add account" | Changing `HOME` for a session would break its git, gh and ssh setup | defaulted |
| 10 | Turn end comes from `agy`'s `Stop` hook; the hook file is written per account (`<config>/config/hooks.json`, merged, never overwritten) and calls `machine/hook.sh agy`, which takes the session name from `WHEELCHAIR_SESSION_NAME` in the session's environment | Hooks are global per config dir, not per session; the hook already exits 0 when no session token is set, so Collin's own `agy` runs are unaffected | defaulted |
| 11 | Model pins for `gemini` start from the live check's `agy models` list; until pinned, a slot is "not used" (`model.sh` exit 3), so nothing lands on Antigravity by accident | Models are only listed after sign-in | defaulted |
| 12 | `review_families` keeps the stored value `both` (shown as "Mix families") and gains `gemini` as a single-family choice | Saved settings stay valid | defaulted |

## Spec

### What changes, in one paragraph

Antigravity becomes a third provider: key `gemini`, CLI `agy`, label "Antigravity". It
is wired through the same seams as Claude and Codex: the provider registry, Settings,
placement, model pins, the machine adapter, the hook bridge, the transcript parser,
asides, the Ready check, and the workflow protocol's `--provider` values. Sign-in uses the
existing Settings sign-in card (link + pasted code).

### Task 0: live check first (blocks every other task)

`agy` 1.5.9 is installed at `/home/collin/.local/bin/agy`, not yet signed in. Before any
parser is written, one task signs it in (Collin pastes the code once, through a `message`
to the lead, who posts a card) and records real output under
`machine/test/fixtures/agy/` (secrets, tokens and emails replaced):

1. The login screens: the method menu, the link + code prompt, the screen after a good
   code, the screen after a bad code.
2. Where credentials land with `DBUS_SESSION_BUS_ADDRESS` unset (the machine service has
   no desktop keyring), and that a session started later by the service is signed in.
3. Account isolation (Decision 9): try each candidate variable, check that a second
   signed-out config dir stays signed out and the first stays signed in.
4. `agy models` output, signed in and signed out (exit code and text).
5. An interactive run in tmux with a `Stop` hook configured: the idle-prompt screen
   (ready text), the hook's stdin JSON, and the transcript file at `transcriptPath`.
6. A permission prompt screen under `--mode auto`, and confirmation that `--mode plan`
   cannot edit files (for reviewers).
7. `agy -p --conversation <id> --output-format json` resuming a conversation, and
   whether it forks or appends.
8. A rate-limit or quota error, if one can be provoked cheaply; otherwise record that it
   wasn't.

Findings go in a short `reports/T0.md`. If a finding contradicts this Spec, the sub-lead
asks the lead before building on it.

Login screen already seen on this machine (`agy` with a fresh HOME, pane joined with
`capture-pane -J`):

```text
 Welcome to the Antigravity CLI. You are currently not signed in.
 Select login method:
 > 1. Google OAuth
   2. Use a Google Cloud project
   ↑/↓ Navigate · enter Select
```
then, after Enter:
```text
 Your browser should open automatically. If not:
 https://accounts.google.com/o/oauth2/auth?access_type=offline&client_id=…&redirect_uri=https%3A%2F%2Fantigravity.google%2Foauth-callback&response_type=code&scope=…&state=…
 If you aren't automatically redirected, paste the authorization code below:
 authorization code...
```
The URL wraps across lines in an unjoined capture. There is no `agy login` or `auth
status` subcommand: sign-in happens inside the interactive CLI, which stays running
after it succeeds.

### Hub (viewer/app)

- `providers.js`: add `gemini: { cli: 'agy', label: 'Antigravity', effort: true,
  preflight: false, typesRoleMessage: true }`.
- `settings.js`: `PLANS.gemini = { unknown: 1, pro: 1, ultra: 4 }`; defaults gain account
  `default-gemini`; `worker_order` default `['gpt', 'claude', 'gemini']`; at load, any
  provider missing from a saved `worker_order` or `lead_order` (before a trailing `any`) is
  appended (Decision 7). `review_families` accepts `both | claude | gpt | gemini`.
- `balancer.js`: no logic change beyond accepting `gemini` in constraints; check that the
  `both`/single-family branch and `--not-provider` pick work for three families
  (excluding one provider leaves two; the first available in order wins).
- `sessions.js`: effort for `gemini` uses `agy`'s set (`low…max`); propagate the bound
  conversation id (new session field `agy_conversation_id`) the way `codex_thread_id` is.
- `ready.js`: unchanged logic; it already checks the thread's own CLI. Status must carry
  `agy` (below).
- `routes.js`: accept `gemini` wherever provider, effort and review-family values are
  validated (`routes.js:193-210,240-242,337-344`).
- `chat.js`: an `agy` transcript parser from the Task 0 fixture, producing the same
  message shape as the others. Unknown row types are skipped; a file with no row it can
  read shows "Couldn't read this Antigravity transcript" instead of an empty chat.
- `asides.js`: parent id for `agy` sessions is `agy_conversation_id`.

### Pages (viewer/pages)

- `settings.js`: Antigravity appears wherever Claude and GPT do (provider lists, model and
  effort pins, role orders, review families as "Mix families / Claude / GPT /
  Antigravity", accounts). Its sign-in card is the existing one: link, then a code box.
  If Decision 9 fell back to one account, the Antigravity accounts section shows only the
  default account and says "Antigravity supports one account per machine".
- `threads.js` and `thread.js`: label `gemini` as "Antigravity" and offer `agy` where a
  thread's CLI is chosen.

### Machine (machine/)

New `machine/adapters/agy.js`, registered in `adapters/index.js` as `agy`:

- `provider: 'gemini'`; `loginEnv(dir)` per Decision 9 (empty for the default account).
- `seed(dir, id)`: common seed (links `AGENTS.md`? only if Task 0 shows `agy` reads an
  instruction file from its config dir; otherwise none) and writes the account's
  `hooks.json` (Decision 10). The default account's hook file at
  `~/.gemini/config/hooks.json` is merged under one key, `wheelchair`, on every session
  start; other keys are left untouched.
- `command`: `agy` + model (`--model`), effort (`--effort`), access: reviewer `--mode
  plan`; otherwise `--dangerously-skip-permissions` when `permission_mode` is `bypass`,
  else `--mode auto`. The machine adds `WHEELCHAIR_SESSION_NAME=<name>` to every
  session's env line (`service.js:490`).
- `firstMessage`: Codex's form, `[wc:role] <role prompt>

<brief>`.
- `readyText`/`answerPrompts`: from Task 0's idle and permission screens. A permission
  prompt seen in the pane is reported as a `prompt` event so the app's permission card
  appears.
- `onTurnEnded`: bind the first conversation whose `lastUserInput` starts with
  `[wc:role]` (as Codex does), store `agy_conversation_id` and `source_transcript` from
  `transcriptPath`; ignore other conversations.
- `hookEvent`: `Stop` with `terminationReason` `model_stop` → `turn-ended`; `error` whose
  text Task 0 identifies as quota or rate limit → `limit-hit`; other `error` →
  `turn-failed`; `max_steps_exceeded` → `turn-ended`.
- `usageFrom`: returns null (Decision 4).
- `loginCommand`: `['agy']`. `loginPrompt(pane)`: Enter once when the pane shows "Select
  login method" with "Google OAuth" selected. `parseLogin(pane)`: join wrapped lines, take
  the `https://accounts.google.com/` URL, `wantsCode` when the pane says "paste the
  authorization code". New optional `loginDone(pane)`: true once the signed-in idle screen
  shows; `loginState` (`service.js:924`) then kills `wc-login-<account>` and reports from
  `loginStatus`, since `agy` never exits on its own.
- `loginStatus(dir)`: `agy models` with `loginEnv(dir)`; signed in when it exits 0 and
  does not print "Please sign in".
- `asideArgv`: `agy -p --output-format json --conversation <from> --model … [--effort …]`,
  plus `--mode plan` for read-only asides and `--dangerously-skip-permissions` for full
  access. If Task 0 shows `--conversation` appends rather than forks, `aside-turns.js`
  refuses fork-mode asides for `agy` with "Side conversations aren't available on
  Antigravity sessions yet" (Decision 5).
- `service.js`: `status()` adds `agy: cliStatus('agy', …)`; the launch error text and
  recovery's CLI inference include `agy` (`service.js:443-444,462-463,940-954,1049`).
- `hook.sh`: new case `agy`: payload from stdin; session name from argument 2, else
  `WHEELCHAIR_SESSION_NAME`. `lib/hook-post.js` passes it to the `agy` adapter.

### Model pins (codex/model.sh)

`PROVIDERS` gains `gemini`; pin lines `gemini.<slot> = <model> [@effort]` with efforts
`low…max`; `DEFAULTS.gemini` from Task 0's `agy models` (Decision 11): light, standard,
heavy, critical and lead each get the model Task 0 names, written into the Log. GPT's
model discovery and effort ceiling are untouched. Usage text and `check`/`show --json`
include `gemini`.

### Protocol

- `lead.md`, `sub-lead.md`: `--provider`/`--not-provider` take `claude|gpt|gemini`;
  `review_families` reads "`both` (mix families) or one of `claude`, `gpt`, `gemini`";
  the stale Ready sentence (`lead.md:82-83`) says Ready checks the thread's own CLI.
- `machine/API.md`, `viewer/app/API.md`: document `agy` in status, logins and hooks.
- Routers (`machine/AGENTS.md`, `viewer/AGENTS.md`) list the new adapter and fixtures.

### Failure handling

- `agy` missing: status `installed: false`; Ready names "agy is not installed";
  placement skips Gemini (no signed-in account).
- Login screen not recognised within the existing login timeout: the sign-in card shows
  the existing failure state and the pane link (`/v1/logins/<id>/pane`) so Collin sees
  what `agy` printed.
- Transcript or hook payload not matching the fixtures (after a self-update): the turn
  still ends if `Stop` fired; the chat shows the "Couldn't read" line; nothing crashes.

### Not doing

Installing or updating `agy`; API-key or Google Cloud project sign-in (menu option 2);
a usage meter; changing Claude or Codex behaviour.

### Validation

```bash
bash machine/test/run.sh            # adds agy adapter tests: parseLogin on the fixture (wrapped and joined), loginPrompt, loginDone, hookEvent for each terminationReason, onTurnEnded binding
bash codex/test/run.sh              # gemini pins parse, defaults, effort set, exit 3 for unpinned slots
node --test viewer/test/*.test.js   # providers, settings normalize (append missing provider; review_families gemini), balancer with three families and --not-provider, chat agy parser on the fixture
npm --prefix viewer run test:browser  # Settings shows Antigravity, sign-in card link + code
bash install/test/run.sh
```
Live (Task 0 machine): sign in an Antigravity account from Settings on a phone-width
browser, start a worker with `--provider gemini`, see its turns in the thread and its
turn end noticed; open an aside on it.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-16

**Lanes:** intent (pending); mechanics (pending); cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- 2026-11-16: installed agy 1.5.9 (`~/.local/bin`, PATH line appended to `~/.profile`). Help shows `-p`, `--output-format stream-json`, `--conversation`, `--dangerously-skip-permissions`, `--mode`, `--model`, `--effort`, `models` and `acp` subcommands.
