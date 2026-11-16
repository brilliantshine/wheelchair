---
slug: antigravity-cli
date: 2026-11-16
implemented-by: "standard, gpt-6.1-terra (T0, T0b, T1, T2, T3, T4, T5, T6, T9, R1-1, R1-2, R2-1 a1; R2-1 a2 at effort high); light, gpt-6-luna (T7, T8). Sub-lead: claude-opus-5-5."
verified-by: []   # Stage 4 appends; Stage 3 leaves this empty.
---

# Completion Report — Antigravity CLI as a third agent provider

Written for a hostile reviewer: every claim checkable, no claim without evidence. Line
numbers are at the commit this report is committed in. The Log in PLAN.md records every
task's acceptance, the worker choices, and the lead's answers that changed the Spec; reports
are in `docs/plans/antigravity-cli/reports/T0.md` … `T8.md`.

## Spec coverage

Every item is `this run`; Prior Work was empty.

### Task 0 (live check)

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| `agy` signed in once, Collin pasting the code through the lead | this run | `agy models` lists models (output below) | `reports/T0.md` §1 |
| 1. Login screens (menu, link + code, good code, bad code) | this run | `machine/test/fixtures/agy/login-menu.txt`, `login-link-joined.txt`, `login-link-wrapped.txt`, `login-success.txt`, `login-bad.txt` | `reports/T0.md` §1 |
| 2. Credential location, DBUS unset or set | this run | file `~/.gemini/antigravity-cli/antigravity-oauth-token`; DBUS irrelevant | `reports/T0.md` §2 |
| 3. Account isolation (Decision 9) | this run | No variable isolates; fell back to one account per machine | `reports/T0.md` §3 |
| 4. `agy models` signed in and out | this run | `models-signed-in.txt`, `models-signed-out.txt` (exit 1, "Please sign in") | `reports/T0.md` §4 |
| 5. `--settings` hooks (Decision 16) or the global file; idle screen; Stop stdin; transcript | this run | `--settings` refuses `hooks`; global file works; `stop.json`, `stop-role.json`, `stop-tools.json`, `stop-second.json`, `idle.txt`, `transcript.jsonl`, `transcript-tools.jsonl` | `reports/T0.md` §5, `reports/T0b.md` §2-4 |
| 6. Permission prompt; plan mode for reviewers | this run | `permission-prompt.txt` (`--mode accept-edits`), `plan-mode.txt`, `plan-skip.txt` | `reports/T0b.md` §5-6; see Deviations |
| 7. `-p --conversation` against a live interactive conversation | this run | Same conversation id comes back, so there's no fork → `asideFork: false` (`aside.json`, `after-aside.txt`) | `reports/T0.md` §7 |
| 8. Rate limit | this run | Not provoked (recorded) | `reports/T0.md` §8 |
| Findings in `reports/T0.md` | this run | `reports/T0.md`, `reports/T0b.md` | — |

### Hub (viewer/app)

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| `providers.js` `gemini` entry; `asideFork` on all three | this run | `viewer/app/providers.js:3` (also `singleAccount`) | `viewer/test/app-settings.test.js`, `app-asides.test.js` |
| `PLANS.gemini` | this run | `viewer/app/settings.js:24` | `app-settings.test.js` |
| Default account `default-gemini` | this run | `viewer/app/settings.js:27` (from `Object.keys(PROVIDERS)`) | `app-settings.test.js` |
| `worker_order` default `['gpt','claude','gemini']`; missing providers appended at load only if never seen (Decision 19, superseding 14's migration); `lead_order` not migrated | this run (T2, T9) | `viewer/app/settings.js:27`, `:184-185`, `:189` | `app-settings.test.js` (old file gets `gemini` once; a removal survives save and reload) |
| `review_families` accepts `gemini` | this run | `viewer/app/settings.js:195`, `viewer/app/routes.js:242` | `app-settings.test.js`, `app-usage.test.js` |
| `balancer.js` works for three families and `--not-provider` | this run (no code change needed) | `viewer/app/balancer.js` unchanged | `viewer/test/app-balancer.test.js` (three-family cases) |
| `sessions.js` gemini effort `low…max`; `agy_conversation_id` propagated | this run | `viewer/app/sessions.js:66-73` (only codex capped), `:401`, `:561` | `app-settings.test.js` (effort `max` accepted) |
| `ready.js` unchanged; status carries `agy` | this run | `viewer/app/ready.js` unchanged; `machine/service.js:952` | machine `service.test.js` (status has `agy`) |
| `routes.js` accepts `gemini` for provider, effort, review family | this run | `viewer/app/routes.js:194`, `:200`, `:242`; one-account refusal `:161` | `app-settings.test.js`, `app-usage.test.js` |
| `chat.js` `agy` transcript parser; "Couldn't read this Antigravity transcript" | this run | `viewer/app/chat.js:172-199`, `:200`, `:60` | `viewer/test/app-chat.test.js` |
| `asides.js` refusal in `create` before the parent/409 checks; parent map by provider | this run | `viewer/app/asides.js:40-41` | `viewer/test/app-asides.test.js` (400 with no `agy_conversation_id` set) |
| `ASSISTANT_CONTENT.agy`; `lastAssistantText('agy', fixture)` | this run | `viewer/app/chat.js:229` | `app-chat.test.js` |

### Pages (viewer/pages)

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| Antigravity wherever Claude and GPT appear (tiers, model/effort pins, lead models) | this run | `viewer/pages/settings.js:15-16` and label lookups | `viewer/test/app-settings.spec.js` |
| Role orders | this run | generic over `PROVIDER_NAME`, `viewer/pages/settings.js:1146-1163` | `app-settings.spec.js` |
| Review families "Mix families / Claude / GPT / Antigravity" | this run | `viewer/pages/settings.js:446-447` | `app-settings.spec.js` |
| Accounts; sign-in card link + code box | this run | `viewer/pages/settings.js:964` (primary link button), paste box generic | `viewer/test/app-accounts.spec.js` |
| One account per machine: only the default account shown, with the line | this run | `viewer/pages/settings.js:1128-1129`; Add account omits Antigravity `:1102` | `app-accounts.spec.js` |
| `threads.js`, `thread.js` label `gemini` | this run | `viewer/pages/thread.js:3`, `:140`, `:788-790`; `viewer/pages/threads.js:14` | `viewer/test/app-threads.spec.js` |
| Offer `agy` where a thread's CLI is chosen | this run (nothing to change) | no page picks a thread's CLI; it follows the lead order, which offers Antigravity | `reports/T5.md` |
| Permission-mode row covers Antigravity sessions | this run | `viewer/pages/settings.js:424` | `app-settings.spec.js` |

### Machine (machine/)

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| `adapters/agy.js` registered as `agy`; `provider: 'gemini'`; `loginEnv` empty | this run | `machine/adapters/agy.js:8`, `machine/adapters/index.js:5` | `machine/test/accounts.test.js` |
| `seed` | this run | `machine/adapters/agy.js:58` (no-op: only the default account exists) | — |
| Hooks, primary `--settings` path | not built | Task 0: `--settings` refuses a `hooks` key | `reports/T0.md` §5 |
| Hooks, fallback (Decision 10): `prepare()` for every account, merge key `wheelchair`, unreadable file left alone with "Couldn't update Antigravity's hooks file" | this run | `machine/adapters/agy.js:9-28`; called at `machine/service.js:469`, `:914` | `accounts.test.js` (create, merge, unparseable); `service.test.js` (temp HOME) |
| `WHEELCHAIR_SESSION_NAME` on `agy` sessions' env line | this run | `machine/service.js:491` | `service.test.js` |
| `command`: model, effort, access flags | this run | `machine/adapters/agy.js:29-32` (also `--settings` with `trustedWorkspaces`) | `accounts.test.js`; see Deviations (reviewers) |
| `firstMessage` Codex form | this run | `machine/adapters/agy.js:33` | `accounts.test.js` |
| `readyText`/`answerPrompts` | this run | `machine/adapters/agy.js:34-35` | `accounts.test.js` on `idle.txt`, `permission-prompt.txt`, `trust-prompt.txt`, `login-success.txt` |
| `promptText` and `pollReadiness` watching ready sessions | this run | `machine/adapters/agy.js:36`; `machine/service.js:552-555` | `service.test.js` |
| `onTurnEnded` binds the first `[wc:role]` conversation | this run | `machine/adapters/agy.js:44-51` | `accounts.test.js` |
| `hookEvent` mapping | this run | `machine/adapters/agy.js:38-43` | `accounts.test.js` (each reason) |
| `usageFrom` null | this run | `machine/adapters/agy.js:52` | — |
| `loginCommand`, `loginPrompt`, `parseLogin`, `loginDone`; `loginState` kills the login | this run (T4; fixed in Remediation 1) | `machine/adapters/agy.js:54-64`; `machine/service.js:919-920`, `:939-949` | `accounts.test.js`, `service.test.js` |
| `loginStatus` via `agy models` | this run | `machine/adapters/agy.js:57` | `accounts.test.js` |
| `asideArgv` and `aside-turns.js` gemini branch | not built (conditional) | Task 0 found no fork, so not built (Spec: "Built only when Task 0 finds `--conversation` forks") | `reports/T0.md` §7 |
| `service.js` status `agy`, launch errors, recovery inference | this run | `machine/service.js:952`, `:444`, `:463`, `:309` | `service.test.js` |
| `hook.sh` `agy` case; name from arg 2 or `WHEELCHAIR_SESSION_NAME`; `session` check moved into claude/codex cases | this run | `machine/hook.sh:15-31` | `service.test.js` |
| `lib/hook-post.js` passes it to the `agy` adapter | this run (no change needed) | `machine/lib/hook-post.js` looks adapters up by kind | `service.test.js` |

### Model pins, protocol, docs

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| `PROVIDERS` gains `gemini`; pin lines; efforts `low…max`; `DEFAULTS.gemini` (Decision 13, lead-approved mapping) | this run | `codex/model.sh:14`, `:28-32`, `:80`, `:89`, `:383` | `codex/test/run.sh` (13 gemini cases) |
| Usage text, `show --json` include `gemini` (`check --json` stays GPT-only) | this run | `codex/model.sh:40-41` | `codex/test/run.sh`; see Deviations |
| `lead.md`, `sub-lead.md` provider values; `review_families`; Ready sentence | this run | `protocol/app/lead.md:52-53`, `:83`, `:110`, `:194`, `:319`; `protocol/app/sub-lead.md:90-91` | `viewer/test/protocol-rules.test.js` |
| `sub-lead.md` verifier rule (Decision 18) | this run | `protocol/app/sub-lead.md:192-200` | `protocol-rules.test.js` |
| `machine/API.md`, `viewer/app/API.md` | this run | `machine/API.md:11`, `:28`, `:48`; `viewer/app/API.md:37`, `:39`, `:115`, `:125` | `reports/T6.md` |
| Routers list the adapter and fixtures | this run | `machine/AGENTS.md:10`, `:15`, `:18`; `codex/AGENTS.md:13` | — |

### Tests that only this build's own planning artifacts broke

| Item | Origin | Implemented at | Validated by |
|------|--------|----------------|--------------|
| Graph-arrow browser test skips `form` pictures (this plan committed the repo's first one, `graphs/sign-in.json`) | this run (T7) | `viewer/test/browser.spec.js:2139-2147` | full browser suite |
| Installer test expects the `gemini` pin lines | this run (T8) | `install/test/run.sh:247` | `bash install/test/run.sh` |

## Deviations from plan

All were taken on the Spec's own fallbacks or approved by the lead (PLAN.md Log, 2026-11-16):

1. **Hooks**: the `--settings` primary path (Decision 16) doesn't work. `agy` refuses a `hooks` key, so Decision 10's global-file fallback is built, with `WHEELCHAIR_SESSION_NAME`. This writes a `wheelchair` key into Collin's own `~/.gemini/config/hooks.json`. His own `agy` runs call `hook.sh`, which exits 0 without a session token.
2. **Asides**: `--conversation` reuses the conversation, so `asideFork: false`. Asides on Antigravity sessions are refused with 400 "Side conversations aren't available on Antigravity sessions yet". No `asideArgv` and no `aside-turns.js` change.
3. **Accounts**: no isolation variable works, so Antigravity has one account per machine (`singleAccount`). The hub refuses a second account, and Settings shows only the default with "Antigravity supports one account per machine".
4. **Turn end**: a normal Stop's `terminationReason` is `NO_TOOL_CALL`, not `model_stop`. Every reason except `error` (or a non-empty `error`) ends the turn.
5. **Reviewers**: not `--mode plan`. In plan mode `agy` turns any request into an implementation-plan artifact and asks for plan review, and without the skip flag it prompts even for `ls`. Under the lead's rule, reviewers get the same flags as other roles. See residual risks.
6. **Workspace trust** (not in the Spec): each session's `--settings` file carries `trustedWorkspaces: [worktree]`. Without it the trust screen would block every new worktree, and the service's generic Down+Enter answer would pick "No, exit".
7. **Decision 19 (lead, during the build)**: settings store `worker_order_seen`, so the load-time append adds only providers a saved order has never seen. Antigravity is added once to older files, and a provider removed in Settings stays removed. This replaces Decision 14's "append every missing provider".
8. `check --json` in `model.sh` stays a GPT-only array. My T1 brief asked for a `gemini` key, which was wrong; the lead corrected it.

## Routers

- `machine/AGENTS.md`: the adapters row names `agy.js`; `hook.sh` covers Antigravity payloads; `test/` notes `fixtures/agy/` as live captures from `agy` 1.5.9.
- `codex/AGENTS.md`: `model.sh` reads and writes Gemini cells too.
- `viewer/AGENTS.md`: no row became false; unchanged.
- `README.md`: the CLI requirement lists `agy`.

## Validation evidence

Run on the merged feature branch, from the worktree root. The block below is from `4050559` (all tasks but T9). After T9 merged, the two suites it can affect were re-run:

```text
$ node --test viewer/test/*.test.js
not ok 316 - a starter that loses the freed port registers through the new holder
# tests 448
# pass 447
# fail 1

$ npm --prefix viewer run test:browser
  2 skipped
  620 passed (2.6m)
```

Full run at `4050559`:

```text
$ bash machine/test/run.sh
# tests 109
# pass 109
# fail 0
exit 0

$ bash codex/test/run.sh
RESULT 91 passed, 0 failed

$ bash install/test/run.sh
RESULT 180 passed, 0 failed

$ bash sensitivity/test/run.sh
RESULT 67 passed, 0 failed

$ node --test viewer/test/*.test.js
not ok 315 - a starter that loses the freed port registers through the new holder
not ok 402 - the global write lock serializes concurrent writes and retry retains both changes
# tests 447
# pass 445
# fail 2
exit 1. Both failures are pre-existing, named under Known gaps: the lifecycle one fails every run; the write-lock one is the flaky one (this run the font-route test passed)

$ npm --prefix viewer run test:browser
  2 skipped
  620 passed (2.6m)
exit 0

$ python3 -m unittest discover -s sudo-helper/test
Ran 9 tests in 8.850s

OK

$ node --test test-support/test/*.test.js
# tests 9
# pass 9
# fail 0
```

Not run: `./install.sh` (canonical clone only; refused from a worktree, so `install/test/run.sh` covers it), and `test-support/smoke/*.sh` (hearth live smoke, costs model turns). Fixture-level redaction check: `grep -rIiE 'ya29\.|1//0|refresh_token|access_token|@gmail\.com' machine/test/fixtures/agy/` prints nothing.


## Known gaps / residual risks

- **Verification attempt 1 is same-family.** Every builder ran on GPT, and the verifier was started with `--not-provider gpt`, but the hub placed it on GPT too (`gpt-6.1-sol`; note "Could not avoid gpt; using gpt.") because Claude had no room. The lead accepted that. No other model family has checked this build.
- **Reviewers and verifiers on `agy` are not read-only.** They run with the same flags as builders (Deviation 5). A reviewer placed on Antigravity could edit files; nothing but its brief stops it.
- **Permission prompts under `--mode auto`**: in T0, auto mode ran `curl` and `chmod 777` without asking. The prompt detector is built from the real `accept-edits` screen, so a prompt is caught if one appears, but which commands make auto mode ask is unknown.
- **No rate-limit format observed.** `limit-hit` relies on a regex over the Stop `error` text (`quota|rate.?limit|resource.?exhausted|429`), with no usage meter (Decision 4).
- **`agy` self-updates.** The parsers fail soft: unknown rows are skipped, and an unreadable transcript shows the "Couldn't read" line.
- **Not live-checked yet**: signing in from Settings on a phone, an `agy`-led thread end to end, and a `--provider gemini` worker's `result`. The Spec's Live paragraph is for the verifier, or Collin, on hearth.
- **Pre-existing test failures**, untouched by this build: `viewer/test/lifecycle.test.js` "a starter that loses the freed port registers through the new holder", `viewer/test/routes.test.js` "an app page carries font-src self…" (inter-400 font 404); `viewer/test/server.test.js` "the global write lock serializes concurrent writes…" is flaky (about 1 run in 3).

## Remediation rounds

Appended by Stage 4 loops; never erase earlier content.

### Remediation 1

**Verification attempt 1** (gpt-6.1-sol, commit f64fbe7): FAIL, one gap (`REMEDIATION-1.md`). Antigravity sign-in reported done at `agy`'s first colour-scheme screen and killed the login, so first-run setup was left unfinished and a later session could stick.

- **R1-1** (standard, gpt-6.1-terra): blocked. A copied signed-in HOME didn't reproduce the first-run screens, and nothing was built (`reports/R1-1.md`). The sub-lead deleted the copy, which held a token.
- **R1-2** (standard, gpt-6.1-terra): a fresh sign-in in an empty scratch HOME, with Collin's code via the lead, captured the real first-run screens: `machine/test/fixtures/agy/onboard-1-theme.txt`, `onboard-2-data.txt`, `onboard-3-trust.txt`. Fix:
  - `loginPrompt` answers each screen once, as named steps: theme → default; data use → **interaction-data sharing unticked**, then Done; trust → yes (`machine/adapters/agy.js:56-62`).
  - `loginState` sends each step's keys once (`machine/service.js:944-949`); Claude's plain-array prompt is unchanged.
  - `loginDone` is true only at the idle prompt with no first-run screen showing (`machine/adapters/agy.js:64`). This is the lead's safety net for any uncaptured screen.
  - `readyText` is false on every first-run screen (`:35`).
  - The `agy` login runs in its own 0700 folder, `<stateDir>/agy-login` (`:55`, `machine/service.js:919-920`).
  - Restarting `agy` after a completed first run showed no first-run screen (`reports/R1-2.md`).
- **Validation after merging R1-2:** `bash machine/test/run.sh` → `# tests 109`, `# pass 109`, `# fail 0`. Real `~/.gemini` checksums are unchanged before and after.
- **Residual:** the R1-2 scratch HOME `/tmp/r2-agy-tegTUEUu/home` holds a second Antigravity OAuth token, left for Collin to delete as the lead asked. The first-run choices are Google's defaults except data sharing, which is turned off.

### Remediation 2

**Verification attempt 2** (gpt-6.1-sol, commit d4a2146): FAIL, one new gap (`REMEDIATION-2.md`). The Settings sign-in card's 30-second no-link timeout also fired after the code was pasted. That stopped the polls that drive `agy`'s first-run screens, so a normal-length sign-in failed.

- **R2-1 attempt 1** (standard, gpt-6.1-terra, effort medium): correct `settings.js` change, but its new browser test raced the card's 2-second auto-close and hit the fails-twice guardrail.
- **R2-1 attempt 2** (standard, gpt-6.1-terra, effort **high**, one escalation step; rewritten brief) applied the reviewed change and wrote stable tests:
  - The 30-second limit applies only before the first link; after it, a 10-minute finish limit counts from the first link (`viewer/pages/settings.js:848`, `:951`).
  - A link-less poll after the first link shows "Finishing sign-in on <machine>…" and keeps polling (`:983`).
  - Tests: `viewer/test/app-accounts.spec.js` "Antigravity keeps polling while finishing a slow sign-in" (success is proved by the card closing itself) and "Antigravity sign-in gives up after the finish limit".
- **Validation after merging:**
  - `npx playwright test test/app-accounts.spec.js --repeat-each 2` → 172 passed (sub-lead re-run).
  - `npm --prefix viewer run test:browser` → 624 passed, 2 skipped.
  - `node --test viewer/test/*.test.js` → 447/448; the one failure is the pre-existing lifecycle test.
  - `bash machine/test/run.sh` → 109/109.
