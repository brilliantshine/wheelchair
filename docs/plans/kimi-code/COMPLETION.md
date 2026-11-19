---
slug: kimi-code
date: 2026-11-18
implemented-by: "standard gpt-6.1-terra (T1, T4, T5; T3 and T6 at xhigh after a guardrail), standard claude-sonnet-5-5 (T2, T8), light gpt-6-luna (T7); sub-lead claude-opus-5-5"
verified-by: []
---

# Completion Report — Kimi Code support

Written for a hostile reviewer: every claim checkable, no claim without evidence. Line
numbers are at commit `b805a5f` plus the sub-lead's doc fix in `machine/API.md:108`.
Origin is `this run` for every row: the plan had no Prior Work.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| Identity: provider `kimi`, label "Kimi Code", registry flags (`effort: false` per Decision 46), adapter registered as `kimi` | this run | `viewer/app/providers.js:3`; `machine/adapters/kimi.js:84-99`; `machine/adapters/index.js:5` | `viewer/test/app-kimi-settings.test.js:37`; `viewer/test/app-hub.test.js:1868` |
| `review_families` accepts `kimi`; `both` still means two families | this run | `viewer/app/settings.js:219`; `viewer/app/routes.js:300`; `viewer/pages/settings.js:546` | `app-kimi-settings.test.js:21,37`; `app-usage.test.js:71`; `app-accounts.spec.js:311` |
| Default `worker_order` appends `kimi`; `worker_order_seen` migration; legacy `['claude','gpt']` fallback unchanged | this run | `viewer/app/settings.js:207-208,213` | `app-kimi-settings.test.js:21` (legacy save, seen list without kimi) |
| Labels "Kimi Code" on thread pages, Settings, Agents screen | this run | `viewer/pages/thread.js:3`; `viewer/pages/threads.js:14`; `viewer/pages/settings.js:15,948` | `app-settings.spec.js:71,150` (no Agents-screen label test) |
| `PLANS.kimi = { unknown: 1 }`; saving a Kimi account works | this run | `viewer/app/settings.js:34`; `viewer/pages/settings.js:945` | `app-kimi-settings.test.js:21,37` |
| Executable: `resolveCli()` (PATH, else `~/.kimi-code/bin/kimi`) | this run | `machine/adapters/kimi.js:8-12` | `machine/test/kimi.test.js:113` |
| `cliStatus('kimi')` via `resolveCli`; `--version` cached by path + mtime | this run | `machine/service.js:1286-1292` | `kimi.test.js:38,139` |
| Version floor 2.6.3: per-CLI `problem`, Kimi accounts `logged_in: false`, no account problem | this run | `machine/service.js:1282,1290-1292` | `kimi.test.js:38,139,248` |
| `startNamed` refuses below the floor (and with no binary) | this run | `machine/service.js:586`; sign-in `:1217` | `kimi.test.js:139` (line 150), `:322` |
| Launch and login argv start with the absolute path, pane PATH without the kimi dir | this run | `machine/adapters/kimi.js:88,92` | `kimi.test.js:38,163` |
| Effective home absolute; `loginEnv` always returns it (service-only `KIMI_CODE_HOME` reaches both panes) | this run | `machine/adapters/kimi.js:7,86` | `kimi.test.js:113,163` |
| Several accounts; `seed()` writes `wheelchair-account.json`, copies no credentials; `prepare()` no-op | this run | `machine/adapters/kimi.js:87` | `kimi.test.js:154,248` |
| Config line reader: headers, quoted segments, `[[…]]` ignored, only `default_model` and managed oauth `key`/`oauth_host` (`support_efforts` no longer read, Decision 46) | this run | `machine/adapters/kimi.js:13-29` | `kimi.test.js:50,314` |
| Config file states: absent, unreadable, multi-line strings | this run | `machine/adapters/kimi.js:15-17` | `kimi.test.js:14,50` |
| `loginStatus`: `authenticated` from the oauth key's credentials file; any `*.json` when untrusted | this run | `machine/adapters/kimi.js:30-34` | `kimi.test.js:14,50,154,314` |
| Region from `oauth_host` (`auth.kimi.ai` global; else China problem); `region` file not read | this run | `machine/adapters/kimi.js:35-36` | `kimi.test.js:64` |
| Empty home: not authenticated, not logged in, no problem | this run | `machine/adapters/kimi.js:30-36` | `kimi.test.js:14` |
| Status entries carry optional `problem`; Kimi per-CLI row only for the floor | this run | `machine/service.js:1275-1283,1292` | `kimi.test.js:248` |
| Ready: per-CLI problem line; else first Settings-order account's `<name>: <problem>`; else "not logged in" | this run | `viewer/app/ready.js:49-51,60-68` | `app-kimi-settings.test.js:75` |
| Placement unchanged (only `logged_in` eligible) | this run | `viewer/app/usage.js:60-61` | `app-kimi-settings.test.js:94` (rank only) |
| Settings account row: per-machine `{ state: 'problem', text }`; Sign in button stays | this run | `viewer/app/usage.js:57-67,109`; `viewer/pages/settings.js:1152` | `app-kimi-settings.test.js:94`; `app-accounts.spec.js:103` |
| Sign-in command `[<abs kimi>, 'login', '--region', 'global']`, `loginPrompt` null | this run | `machine/adapters/kimi.js:88` | `kimi.test.js:113` |
| `parseLogin` → `{ url, code, wantsCode: false }` | this run | `machine/adapters/kimi.js:89` | `kimi.test.js:25` |
| Exact `=wc-login-<account>` targets (capture, kill, keys, code), prefix siblings and stale terminal | this run | `machine/service.js:1221,1232,1239,1631` | `kimi.test.js:128,214` |
| Completion only from `__wc_login_exit <n>`; exit 0 + authenticated → done, else failed; pane kept | this run | `machine/adapters/kimi.js:90`; `machine/service.js:1241-1245` | `kimi.test.js:31,93,295` |
| Kept per-attempt result; new sign-in clears it | this run | `machine/service.js:1221,1238,1243-1244` | `kimi.test.js:31,128,272` |
| No marker: alive/unknown → waiting; known gone → failed | this run | `machine/service.js:1244` | `kimi.test.js:93,295` |
| `loginState.logged_in` is `authenticated` (China-region home ends "Signed in.") | this run | `machine/service.js:1243-1245` | `kimi.test.js:272` (no browser test) |
| Launch argv: `--auto` for bypass else `--yolo`, `--model` when set, nothing else | this run | `machine/adapters/kimi.js:91-93`; `machine/service.js:566-567,617` | `kimi.test.js:72,163` |
| Permission-mode label "Claude, Antigravity and Kimi sessions / permission mode" | this run | `viewer/pages/settings.js:482,523` | none |
| Effort: none (Decision 46): no env, sessions stored and started with none, API and `model.sh` refuse one | this run | `machine/adapters/kimi.js:91-93`; `viewer/app/sessions.js:298-300`; `viewer/app/routes.js:248`; `codex/model.sh:99,392`; `viewer/pages/settings.js:16,434,507` | `kimi.test.js:72,163,289`; `app-hub.test.js:1868`; `app-kimi-settings.test.js:37`; `codex/test/run.sh:147-156`; `app-settings.spec.js:61`; live check 5 |
| Folder trust: `❯ Trust and continue` → Enter; `❯ Exit` → Up | this run | `machine/adapters/kimi.js:96` | `kimi.test.js:25,86`; live (T6 check 6, real screen) |
| Ready text: `│ >` + `context:`, no trust text | this run | `machine/adapters/kimi.js:95` | `kimi.test.js:86` |
| Role message: `[wc:role] Role:`, `Session: <name>`, then agy's text; service passes the allocated name to every adapter | this run | `machine/adapters/kimi.js:94`; `machine/service.js:619` | `kimi.test.js:25,72,281` |
| Permission prompts: `promptText` + pane scraper | this run | `machine/adapters/kimi.js:97`; `machine/service.js:828-830` | negative case only (`kimi.test.js:86`); live check 7 could not trigger a prompt |
| No Kimi hooks: `hook.sh` has no kimi case, `hookEvent` null | this run | `machine/adapters/kimi.js:98`; `machine/hook.sh` (no kimi) | none (absence) |
| Only `agents/main/wire.jsonl` read | this run | `machine/adapters/kimi.js:47-53` | `machine/test/kimi-turns.test.js:25`; live check 3 |
| Binding in `findTranscript` (mtime, protocol compat, `[wc:role]` + `Session:`), stores `kimi_session_id`, `source_transcript`, `kimi_log_id` | this run | `machine/adapters/kimi.js:43-83` | `kimi-turns.test.js:25,89` |
| One shared binding for chat and poller; opened-handle identity | this run | `machine/adapters/kimi.js:38,43-46`; `machine/service.js:658-668,1031` | `kimi-turns.test.js:25,79,89` |
| `pollKimiTurns` every 1 s, non-overlapping | this run | `machine/service.js:369-370,678-683,741` | `kimi-turns.test.js:34,100` (no explicit overlap test) |
| Fatal: unbound 120 s after ready | this run | `machine/service.js:689` | `kimi-turns.test.js:44` |
| Fatal: incompatible candidate carrying this session's marker; unrelated one ignored | this run | `machine/adapters/kimi.js:39-42,66-68` | `kimi-turns.test.js:44,63` |
| Fatal: bound log missing 30 s, shrunk, or replaced; copier identity on opened handle, no byte-zero restart | this run | `machine/service.js:693-716,998-1003` | `kimi-turns.test.js:63,79,121,137,144` |
| Input refused after fatal (`submit`, raw keys) | this run | `machine/service.js:852,863` | `kimi-turns.test.js:52,185` |
| Exact `=<name>` kill retried; stopped only after listing confirms absence | this run | `machine/service.js:650-656,684` | `kimi-turns.test.js:52` |
| Stop on `end_reason` → `202 { pending, end_reason }`; hub leaves session live | this run | `machine/service.js:868,1663`; `viewer/app/sessions.js:685` | `kimi-turns.test.js:185`; `viewer/test/app-kimi-hub.test.js:57` |
| Archive with a pending fatal stop keeps sessions and worktrees, replies `pending: true, pending_sessions`; hub keeps thread unarchived with a needs card | this run | `machine/service.js:911-916`; `viewer/app/threads.js:217-222` | `kimi-turns.test.js:185`; `viewer/test/app-kimi-archive.test.js:9` |
| Recovered Kimi panes: detected, `end_reason` "Lost track…", fatal stop | this run | `machine/service.js:396,398` | `kimi.test.js:105`; `kimi-turns.test.js:154` (real footers captured live) |
| `pollDead` takes `end_reason` from the confirming listing; starter message and lead's "Sessions ended" card show it | this run | `viewer/app/sessions.js:749,757,764-765` | `app-kimi-hub.test.js:57` |
| Reading after `kimi_offset`, complete lines, `turn.ended` with `agentId: 'main'` | this run | `machine/service.js:693,719-722` | `kimi-turns.test.js:34,100` |
| Exactly once: hand-off then persist offset and `kimi_last_turn`; turn 0; lowest first | this run | `machine/service.js:722-738` | `kimi-turns.test.js:34,100` |
| Spool-drain gate (poller never runs ahead of the hub) | this run | `machine/service.js:669-677,720,724,738` | `kimi-turns.test.js:70,167` |
| Hub per-session `last_turn_id` drops re-sent turn ends | this run | `viewer/app/sessions.js:514-516` | `app-kimi-hub.test.js:40` (turn-ended only) |
| Agent hook endpoint answers Kimi sessions `{ ignored: true }` | this run | `machine/service.js:1728` | `kimi-turns.test.js:185` (line 223) |
| Events: completed, cancelled (`interrupted`), failed (limit-hit / turn-failed from `error`), other reasons | this run | `machine/service.js:719-733` | `kimi-turns.test.js:34`; real failed row in `reports/T6.md` |
| Hub: interrupted turn releases, no report, no finish, no reminder; key lists unchanged | this run | `viewer/app/sessions.js:555-562` | `app-kimi-hub.test.js:40`; live check 4 |
| Report for a turn: hub passes `turn_id` | this run | `viewer/app/sessions.js:384`; `viewer/app/chat.js:289` | `app-kimi-hub.test.js:24`; live check 2 |
| `parseKimi` / `PARSERS.kimi` (turns, text by `stepUuid`, think hidden, tools, error notice, `<session>#<n>` ids) | this run | `viewer/app/chat.js:203-234,257` | `app-kimi-hub.test.js:12`; live check 1 |
| Kimi report function (requested turn, last text step, parts by `block`) | this run | `viewer/app/chat.js:236-255,289` | `app-kimi-hub.test.js:24` |
| Slashed model values for `kimi` only (routes, `model.sh` VALUE and reader, Settings "Other…") | this run | `viewer/app/routes.js:247`; `codex/model.sh:44,48,90`; `viewer/pages/settings.js:18,213` | `app-kimi-settings.test.js:37`; `codex/test/run.sh:121-146`; `app-settings.spec.js:69` |
| `model.sh` Kimi pins (light `kimi-code/kimi-for-coding` per Decision 45; standard `k3`; heavy/critical/lead `k3.1-pro`) | this run | `codex/model.sh:14,33-36,50-51,90` | `codex/test/run.sh:53-58,124-135`; `install/test/run.sh:275` |
| Alias missing from the account's model list still starts with `--model` | this run | `machine/adapters/kimi.js:92` | none |
| Installer detects kimi (PATH and `~/.kimi-code/bin`), adds it to the service PATH, installs with only Kimi or agy, models init for any provider | this run | `install.sh:43-52,76,113,376-379` | `install/test/run.sh:277-302` |
| Asides error names the lead's provider label | this run | `viewer/app/asides.js:40` | `app-asides.test.js:154` (Antigravity wording only) |
| Graph harness labels Kimi "other" (unchanged) | this run | `viewer/server.js:1336,1609,1644` (no kimi branch) | none |
| Docs: `protocol/app/lead.md`, `sub-lead.md` (flags, `review_families`, model lookup) | this run | `lead.md:59-60,117,261,427`; `sub-lead.md:113-114,125,224,228` | `viewer/test/protocol-rules.test.js` (35/35 at T5) |
| Docs: `machine/API.md`, `viewer/app/API.md`, `machine/AGENTS.md`, `viewer/AGENTS.md`, README | this run | `machine/API.md:14,29,108-112`; `viewer/app/API.md:13,42,44,128,138`; `machine/AGENTS.md:10`; `viewer/AGENTS.md:28`; `README.md:77,243` | none |
| Live checks 1–5 | this run | `test-support/smoke/kimi-live.js`; `docs/plans/kimi-code/reports/T6.md` | see Validation evidence |

## Deviations from plan

- **Decision 45 (verification):** light pin is `kimi-code/kimi-for-coding`, not `kimi-for-coding-highspeed`, which Collin's subscription refuses (live: `provider.auth_error`, 403).
- **Decision 46 (verification):** Kimi has no effort. `KIMI_MODEL_THINKING_EFFORT` had no effect live (k3 showed `thinking: high` with `low` and `max`; `kimi-for-coding` showed `max` for both), so the env, the `support_efforts` reading and the Settings effort column for Kimi were removed; `effort: false` in the registry. Live check 5 became "the pinned model shows in the footer".
- **Recovered-pane detection** (`machine/service.js:396`) requires, beyond the Spec's `│ >` and `context:`, a footer line with `Ask When Needed` or `Never Ask` and the word `thinking` (with or without a level), so a Claude pane with an input box and a `context:` line is never claimed. Based on real footers captured live.
- **Archive with a pending fatal stop:** the Spec's "reporting the thread as not yet archived" is concretely `200 { pending: true, pending_sessions, stopped, committed: [], removed: [], kept }` with no `uploads_removed`; the hub keeps the thread unarchived, leaves sessions to `pollDead`, and posts a needs card "Archive waiting for a session to stop" (task T7).
- **"Sessions ended" card:** the reason is added where the card is actually created, `viewer/app/sessions.js:757-765`, not `threads.js:174-177` (which only clears cards).
- **Sign-in with no binary** is refused "Kimi Code is not installed", and `startNamed` refuses a Kimi start with no binary with the same sentence (beyond the Spec's version check).
- Worker choices outside the brief are logged one per line in PLAN.md's Log ("Choice: …").

## Routers

- `machine/AGENTS.md:10`: the adapters row names `kimi.js` beside the other adapters.
- `viewer/AGENTS.md:28`: the provider list names Kimi Code.
- `codex/AGENTS.md`: `model.sh` pins list Kimi.
- `protocol/app/AGENTS.md:3`: Kimi gets the composed role file, like GPT and Antigravity.
No ownership moved between directories.

## Validation evidence

Run by the sub-lead on the merged feature branch at `b805a5f`, before the one-line doc fix in `machine/API.md:108`:

`bash machine/test/run.sh` (exit 0)
```
# tests 193
# pass 193
# fail 0
```
`bash codex/test/run.sh` (exit 0)
```
RESULT 123 passed, 0 failed
```
`bash install/test/run.sh` (exit 0)
```
RESULT 192 passed, 0 failed
```
`node --test viewer/test/*.test.js` (exit 0)
```
# tests 643
# pass 643
# fail 0
```
`npm --prefix viewer run test:browser` (exit 0)
```
  28 skipped
  774 passed (3.3m)
```
`node --test test-support/test/*.test.js` (exit 0)
```
# tests 9
# pass 9
# fail 0
```

Live checks with the real kimi 2.6.3, through an isolated hub and machine service started from this branch (`test-support/smoke/kimi-live.js`; full output in `reports/T6.md`; every run ended `cleanup {"privateTmuxGone":true,"runFolderGone":true,"leftoverProcesses":0}`):

1. Kimi lead reaches ready, binds its log, an ordinary turn shows in chat — PASS (`wc-e8f4ad55e715-lead`).
2. Kimi reviewer's final text reaches the lead as its `result` — PASS (`wc-e8f4ad55e715-reviewer`, `KIMI_REVIEW_OK`).
3. A turn using a subagent ends exactly once at the hub, after the main reply — PASS (`wc-966df05df99c-lead`, turn 1, nonce-matched; subagent wrote its own turn end, none reached the hub).
4. Esc mid-turn on a reviewer releases it with no report — PASS (`wc-9e3883b8a3a8-reviewer`, `reason: cancelled`, `interrupted: true`, no result, `quiet_check_at: null`; the run's summary is "2 passed; 1 failed" for checks 4, 6, 7, but check 4's own row is missing from the pasted output).
5. Effort — the variable had no effect → Decision 46; footers show the pinned model (`K3`).
Also: folder trust screen matches `answerPrompts` (PASS); real ready footers captured for recovery (PASS); approval prompt not triggered in three tries (unverified).

## Known gaps / residual risks

- **Permission prompt detection is unverified.** `promptText` (`machine/adapters/kimi.js:97`) matches a guessed phrase `(tool|command) approval required`; no real Kimi approval prompt could be triggered with `--yolo`. If Kimi asks for approval with other text, the app will not raise a permission card and the session will wait.
- **Installer guard is environmental:** "real wheelchair directory is byte-identical after suite" fails whenever live Codex sessions write `~/.wheelchair/accounts/work1` during the suite (seen several times during the build; passed in the final run).
- **Flaky viewer tests:** one unnamed failure in four runs earlier, and `viewer/test/app-uploads-archive.test.js:72`, `app-pages.test.js:17` and `server.test.js:850` failed once each in T6's runs (port collisions, passed on re-run).
- **Live script check 5** (`test-support/smoke/kimi-live.js`) still asserts `thinking: low/max`, now stale under Decision 46.
- **Thin tests:** permission-mode label; Kimi asides error text; hub `last_turn_id` for `turn-failed`/`limit-hit` and events without `turn_id`; placement asserted by rank, not the balancer's pick; browser "Signed in." on a China-region home; non-overlapping poll ticks; the interrupted test's no-reminder assertion may hold vacuously.
- **Kimi effort at session start:** a Kimi start naming an effort above the Settings ceiling is still refused by `checkEffort` before the effort is dropped.
- **Handoff callers** of `stopManagedSession` continue when a Kimi stop is pending, leaving that session live.
- **Accepted Risks** in PLAN.md stand unchanged.
- Leftover worker worktrees not removed by the service (unmerged or dirty): `wc-01b8cb1bf051-w1`, `-w6`, `-w7`, `-w9`, `-w10`.

## Remediation rounds

Appended by Stage 4 loops; never erase earlier content.

### Remediation 1 — 2026-11-18

Verification attempt 1 (`8b5af87`): both verifiers FAIL, 9 distinct gaps (`REMEDIATION-1.md`). Fixes, each by the provider that built the part:

| Gap | Fix | Fixed at | Test |
|-----|-----|----------|------|
| 1. `kimi --version` ran inside `/v1/status`, a slow binary stalled status for every provider | Async version check (path + mtime cache, 5 s timeout, started at service start); status reports "Checking Kimi Code's version" until it lands; start awaits it | `machine/service.js:362,584,1285-1316` | `machine/test/kimi.test.js:155,371`; `viewer/test/app-uploads-archive.test.js` five clean runs (R1) |
| 2. Approval prompt detector was a guess | Titles from Kimi's shipped `headerFor` (`Run this command?`, `Write this file?`, `Apply these edits?`, `Stop this task?`, `Approve <tool>?`), each only with an `Approve once` option | `machine/adapters/kimi.js:97` | `machine/test/kimi.test.js:355` |
| 3. Recovered Kimi pane mentioning Codex classified as Codex | Kimi checked first with anchored footer lines | `machine/service.js:397` | `machine/test/kimi.test.js:105,359`; `kimi-turns.test.js:154` |
| 4. Kimi effort refused above the ceiling; machine stored a direct-start effort | Hub skips `checkEffort` for providers without effort; machine forces Kimi effort to null | `viewer/app/sessions.js:160`; `machine/service.js:595` | `viewer/test/app-hub.test.js:1868-1890`; `machine/test/kimi.test.js:366` |
| 5. Duplicate turn ends in one read handed off twice | Skip ids at or below the last handed off within the batch | `machine/service.js:725-739` | `machine/test/kimi-turns.test.js:243` |
| 6. `2.6.3-rc.1` passed the floor | Semver precedence (prerelease of 2.6.3 below the floor) | `machine/service.js:1313-1314` | `machine/test/kimi.test.js:139` |
| 7. No starter card for a fatal stop | `pollDead` adds a "Session ended" needs card when `end_reason` is set | `viewer/app/sessions.js:760-762` | `viewer/test/app-kimi-hub.test.js:71-89` |
| 8. `authenticated` leaked into `/v1/status` | Removed from status account entries (kept for `loginState`) | `machine/service.js:1285` | `machine/test/kimi.test.js:275,291` |
| 9. Live check 5 still tested effort | Check 5 asserts the footer names the pinned light model (`K2.8 Preview`) and no effort | `test-support/smoke/kimi-live.js:55-60` | live run by the sub-lead: `5 pinned light model \| PASS`, `1 passed; 0 failed` |

Validation on the merged branch at `8bbc334`:

```
bash machine/test/run.sh            # tests 198, pass 198, fail 0
bash codex/test/run.sh              # RESULT 123 passed, 0 failed
bash install/test/run.sh            # RESULT 192 passed, 0 failed
node --test viewer/test/*.test.js   # tests 644, pass 644, fail 0
npm --prefix viewer run test:browser   # 28 skipped, 774 passed (3.2m)
node --test test-support/test/*.test.js   # tests 9, pass 9, fail 0
```

Residual after remediation 1: the approval titles come from Kimi's shipped code, not a captured live prompt; a failed or timed-out version check is cached until the binary changes or the service restarts.

### Remediation 2 — 2026-11-18

Verification attempt 2 (`de31e26`): Claude verifier PASS; GPT verifier FAIL with 5 gaps (`REMEDIATION-2.md`).

| Gap | Fix | Fixed at | Test |
|-----|-----|----------|------|
| 1. Offset could pass an unhandled turn when the spool drained mid-batch | Offset saved only when every turn in the batch was handed off and the spool is not waiting | `machine/service.js:725-742` | `machine/test/kimi-turns.test.js:97` |
| 2. Starter not told of a Kimi limit-hit | Settled by the plan: Decision 47 (shared limit-hit handling unchanged); Spec flowchart reworded | `docs/plans/kimi-code/PLAN.md` Decision 47, Spec flowchart | n/a (no code change) |
| 3. Plan-review approval screen not detected | `promptText` also matches `Ready to build with this plan?` with an `Approve` choice line | `machine/adapters/kimi.js:104` | `machine/test/kimi.test.js:357` |
| 4. `2.6.3foo` / `2.6.3.0` passed the floor | Whole-token version parse from the first line, optional name and `version` word | `machine/service.js:1313-1316` | `machine/test/kimi.test.js` (version floor cases) |
| 5. `min_protocol_version` `1.5.1` / malformed accepted | Dotted-integer parse; min ≤ 1.5 component-wise; malformed incompatible | `machine/adapters/kimi.js:63-72` | `machine/test/kimi-turns.test.js` (protocol cases) |

Validation on the merged branch at `1ed4d45`:

```
bash machine/test/run.sh            # tests 200, pass 200, fail 0
bash codex/test/run.sh              # RESULT 123 passed, 0 failed
bash install/test/run.sh            # RESULT 191 passed, 1 failed — only "real wheelchair directory is byte-identical after suite" (live Codex account files under ~/.wheelchair/accounts/ written during the run)
node --test viewer/test/*.test.js   # tests 644, pass 644, fail 0
npm --prefix viewer run test:browser   # 28 skipped, 774 passed (3.4m)
node --test test-support/test/*.test.js   # tests 9, pass 9, fail 0
```
