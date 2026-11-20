---
slug: openrouter-harness
date: 2026-11-20
implemented-by: "sub-lead (claude-opus-5-5): T1 dry run; standard (gpt-6.1-terra): T2, T3, T4, T5, T6, T9, T10, T8 attempt 1; standard (claude-sonnet-5-5): T7, T8 attempt 2"
verified-by:
  - round: 1
    lane: heavy (claude-opus-5-5) PASS; heavy (gpt-6.2-sol) FAIL
    checks: standard (gpt-6.1-terra, claude-sonnet-5-5)
  - round: 2
    lane: heavy (claude-opus-5-5) PASS; heavy (gpt-6.2-sol) FAIL
    checks: standard (gpt-6.1-terra, claude-sonnet-5-5)
  - round: 3
    lane: heavy (claude-opus-5-5) PASS; heavy (gpt-6.2-sol) FAIL
    checks: standard (gpt-6.1-terra, claude-sonnet-5-5)
  - round: 4
    lane: heavy (claude-opus-5-5) PASS; heavy (gpt-6.2-sol) FAIL, its one gap judged a rare path
    checks: standard (gpt-6.1-terra, claude-sonnet-5-5)
---

# Completion Report — OpenRouter models as wheelchair agents

Written for a hostile reviewer: every claim checkable, no claim without evidence.

```yaml
verified-by:
  - round: <n>
    lane: <verifier lane/model>
    checks: <the implementing lane it checked>
```

All rows are origin `this run` (the plan has no Prior Work section). Line numbers are on `305d1e6a`. Base commit `dbb0a6b3`.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| Provider `openrouter`, label OpenRouter, CLI `pi`, registry flags (`effort/preflight/asideFork/singleAccount` false, `typesRoleMessage` false per D27) | this run | `viewer/app/providers.js:3` | `viewer/test/app-openrouter-settings.test.js:15` (source match); flags not asserted directly |
| `codex/model.sh` PROVIDERS, DEFAULTS, usage, pin parsing | this run | `codex/model.sh:14,38,55-56,95,104,441` | `codex/test/run.sh` OpenRouter block |
| `settings.js` PLANS `{unknown:1}`, review-family value | this run | `viewer/app/settings.js:35,220` | `viewer/test/app-openrouter-settings.test.js:15` |
| `routes.js` provider and `review_families` enums | this run | `viewer/app/routes.js:258,315` | `viewer/test/app-openrouter-settings.test.js:29`; messages in `viewer/test/app-settings.test.js` |
| Labels in pages, chat and usage | this run | `viewer/pages/settings.js:15,572,975`; `viewer/pages/threads.js:14`; `viewer/pages/thread.js:3`; `viewer/app/chat.js:295`; `viewer/app/usage.js:20,25,126` | `viewer/test/app-openrouter-settings.test.js:15`; `viewer/test/app-openrouter-usage.test.js:53`; browser specs `app-accounts.spec.js:321,499`, `app-settings.spec.js:150-155` |
| Machine adapter registry and CLI-name checks | this run | `machine/adapters/index.js:5`; `machine/service.js:660,744-745,754,1479` | `machine/test/service.test.js:981`; `machine/test/pi-turns.test.js:32` |
| `install.sh` detects `pi`, adds its dir to service PATH, never installs | this run | `install.sh:44,50,53,116,379-387` | `install/test/run.sh:291-326,433` |
| Docs and enums (API.md ×2, AGENTS.md, README, lead.md, sub-lead.md) | this run | `viewer/app/API.md`, `machine/API.md` (`GET /v1/spend`, Pi login), `viewer/AGENTS.md`, `machine/AGENTS.md`, `codex/AGENTS.md`, `README.md`, `protocol/app/lead.md`, `protocol/app/sub-lead.md` | docs; no test |
| Not auto-added to `lead_order`/`worker_order`; marked seen | this run | `viewer/app/settings.js:209` | `viewer/test/app-openrouter-settings.test.js:15`; `viewer/test/app-settings.test.js:335,337,361` |
| Explicit `--provider openrouter` places outside the order; others unchanged | this run | `viewer/app/balancer.js:58` | `viewer/test/app-balancer.test.js:445` |
| `review_families` fixed override still wins over a requested `openrouter` | this run (unchanged code path) | `viewer/app/balancer.js:38-47` | `viewer/test/app-balancer.test.js:445` (last assertion) |
| Roles as Kimi; own family | this run | `viewer/app/providers.js:3`; `viewer/pages/settings.js:457` | `viewer/test/app-balancer.test.js:445` |
| Model id grammar, 128 cap, `none` sentinel — `model.sh` | this run | `codex/model.sh:47-52` | `codex/test/run.sh` (128 ok, 129/no slash/two slashes/`a/b:`/`a/b::c` refused, `a/b:free` ok, `none` saved and reloaded) |
| Model id grammar — `routes.js` | this run | `viewer/app/routes.js:262` (`null` → `none` via `model.sh` at `:266`) | `viewer/test/app-openrouter-settings.test.js:29` |
| Model id grammar — Settings page | this run | `viewer/pages/settings.js:19,214` | `viewer/test/app-openrouter-settings.test.js:29` (regex via `vm`) |
| Defaults `openrouter/auto` for every slot | this run | `codex/model.sh:38` | `codex/test/run.sh` |
| Dry run facts and samples | this run | PLAN.md Log "T1 dry run"; `docs/plans/openrouter-harness/samples/` | Log; samples used by `viewer/test/app-openrouter-hub.test.js:22,47,58` |
| Adapter `command`: argv, per-session extension, `PI_CODING_AGENT_DIR` | this run | `machine/adapters/pi.js:13,47-54` | `machine/test/pi.test.js:9,45` |
| Reviewer read-only tools; role prompt by file (D27) | this run | `machine/adapters/pi.js:53` | `machine/test/pi.test.js:45` |
| `hook.sh` `pi` case through `hook-post.js` | this run | `machine/hook.sh:6,16`; `machine/lib/hook-post.js:15-16` | `machine/test/pi-turns.test.js:15,65` |
| Extension payload (`turn`, `entry_id` after last user entry or null, `aborted`, `stopReason`, error; no path) | this run | `machine/adapters/pi-extension.js:11-17` | `machine/test/pi-turns.test.js:15,32,98` |
| `hookEvent` mapping; never `limit-hit` | this run | `machine/adapters/pi.js:69-71` | `machine/test/pi-turns.test.js:5,76,85` |
| Error redaction before spool/forward | this run | `machine/adapters/pi.js:9,70` | `machine/test/pi-turns.test.js:5,65,76`; `viewer/test/app-openrouter-hub.test.js:96` |
| Transcript bound only by `findTranscript`; hook `transcript_path` ignored | this run | `machine/adapters/pi.js:58-61`; `machine/service.js:1358-1361` | `machine/test/pi.test.js:27`; `machine/test/pi-turns.test.js:89` |
| Missing transcript does not hold the event | this run | `machine/service.js:1358-1360` | `machine/test/pi-turns.test.js:113` |
| Tool events → `step` | this run | `machine/adapters/pi.js:63-68`; `machine/adapters/pi-extension.js:18-19` | `machine/test/pi-turns.test.js:5,32` |
| tmux `extended-keys` check-and-set, `respawn-pane` start | superseded by D24 | nothing built; Pi panes start like Kimi's | `machine/test/pi-turns.test.js:32`; live smoke lead chat |
| `readyText` / `answerPrompts` | this run | `machine/adapters/pi.js:56-57` | `machine/test/pi.test.js:9,58` |
| `loginStatus` from `auth.json` presence; env ignored; no key returned | this run | `machine/adapters/pi.js:43-46` | `machine/test/pi.test.js:22,68` |
| Login flow (D25: `pi auth login openrouter --api-key`) | this run, per D25 | `machine/adapters/pi.js:14-17`; `machine/service.js:1510-1517` | `machine/test/pi-login.test.js:4,12,18,48` |
| Settings paste field with no URL, "Paste your OpenRouter key" | this run | `viewer/pages/settings.js:1014,1016,1067,1111-1116` | `viewer/test/app-openrouter-signin.test.js:13,19,27` (helpers in `vm` and source checks; no DOM test) |
| `/code`: `paste-buffer -d`, `delete-buffer` on failure, exact target, Pi-only stale refusal | this run | `machine/service.js:1964-1977`; `machine/adapters/pi.js:15` | `machine/test/code-submit.test.js:4,16` |
| Pi login lifecycle on exact target; `work` leaves `work-2` alone | this run | `machine/service.js:1483,1494,1501` | `machine/test/pi-login.test.js:18` |
| Key-only `waiting` handled like URL waiting; 30 s timeout stops | this run | `viewer/pages/settings.js:1111-1116` | `viewer/test/app-openrouter-signin.test.js:27` (source check) |
| Machine restart: registry sessions carry on; unregistered Pi pane ended as lost | this run | `machine/service.js:488-495,891` | `machine/test/pi.test.js:34,77` |
| `usageFrom` null | this run | `machine/adapters/pi.js:57` | `machine/test/pi.test.js:64` |
| Hub Pi transcript parser | this run | `viewer/app/chat.js:244-270,295` | `viewer/test/app-openrouter-hub.test.js:22` |
| Report selector by `entry_id`; null → no report | this run | `viewer/app/chat.js` (`piReport`), `viewer/app/sessions.js:433-434` | `viewer/test/app-openrouter-hub.test.js:34,40,47,58,83` |
| Spend endpoint (D26 field path), today/7/30 days | this run | `machine/adapters/pi.js:18-41`; `machine/service.js:1924-1936` | `machine/test/pi-spend.test.js:4,15` |
| Usage view spend line, "no spend yet", "total may be incomplete", sum across machines | this run | `viewer/app/usage.js:80-93,126`; `viewer/pages/settings.js:1007-1013,1358-1363` | `viewer/test/app-openrouter-usage.test.js:26,35,48,64` |
| OpenRouter never out of room | this run | `viewer/app/usage.js:20,25` | `viewer/test/app-openrouter-usage.test.js:53` |
| Settings family note | this run | `viewer/pages/settings.js:457` | `viewer/test/app-openrouter-settings.test.js:15` |
| Pane redaction with `-J` (agent and login) | this run | `machine/service.js:528-530,1494-1502,1971` | `machine/test/pi.test.js:39`; `machine/test/pi-login.test.js:62` |
| Kept transcript redacted | this run | `machine/service.js:1230` | `machine/test/pi.test.js:27`; `machine/test/pi-turns.test.js:32` |
| Chat API redacts keys | this run | `viewer/app/chat.js` (`parsePi`) | `viewer/test/app-openrouter-hub.test.js:104` |
| Fake Pi full cycle through real `hook.sh` | this run | `machine/test/fixtures/fake-pi.js` | `machine/test/pi-turns.test.js:15,32` |
| Hub turn tests (completed, aborted, failed, abort-then-complete, watermark, replay, null-entry abort, rate limit, redacted failure, sample transcript to delivery) | this run | `viewer/app/sessions.js:433,613` | `viewer/test/app-openrouter-hub.test.js:40-104` |
| Live smoke | this run | `test-support/smoke/pi-live.js:63,70,77,81`; `test-support/smoke/harness.js` (`piAuthSource`) | `node test-support/smoke/pi-live.js` 4/4 (below) |

## Deviations from plan

- Decisions 24–27 (logged by the lead after the dry run) supersede the Spec's `extended-keys`/`respawn-pane` start, the TUI `/login openrouter` flow, the top-level `cost` field and the reviewer/prompt flags. Built as those decisions say.
- The live smoke isolates `HOME` as well as `PI_CODING_AGENT_DIR` (machine account discovery and spend resolve through HOME), and on any failed check writes a redacted diagnostics file outside the run folder (`PI_LIVE_DIAG_DIR` or the system temp dir), with a test-only `PI_LIVE_FORCE_FAIL=1` switch. Added at the lead's request after T8 attempt 1.
- Settings sign-in behaviour is tested through extracted helpers and source checks, not a DOM test (logged at T7).

## Routers

`viewer/AGENTS.md`, `machine/AGENTS.md` and `codex/AGENTS.md` each had one line updated to name OpenRouter/Pi (adapters row, provider lists, pin providers). No ownership moved between directories.

## Validation evidence

On `305d1e6a` (sub-lead, 2026-11-20):

```text
bash codex/test/run.sh                RESULT 147 passed, 0 failed
bash machine/test/run.sh              # tests 472  # pass 472  # fail 0
node --test viewer/test/*.test.js     # tests 723  # pass 723  # fail 0
bash install/test/run.sh              RESULT 206 passed, 0 failed
node --test test-support/test/*.test.js   # tests 9  # pass 9  # fail 0
```

Browser, on `fdc0c645` (T9 merged; T8 and T10 after it change no app code or browser spec):

```text
npm --prefix viewer run test:browser
  34 skipped
  1082 passed (11.5m)
exit 0
```

Live smoke, on `59bf42f9` (T8 tip, merged unchanged), model `deepseek/deepseek-v4.1-flash-1017`:

```text
lead chat | PASS | Pi lead ready and assistant text appears in chat
reviewer result | PASS | Pi reviewer result card has a summary and is delivered to the lead
spend | PASS | machine today $0.002100728; hub today $0.002100728
key isolation | PASS | no key marker in hub, cache and machine state files, chat, or logs
cleanup {"privateTmuxGone":true,"runFolderGone":true,"leftoverProcesses":0}
4 passed; 0 failed
```

## Known gaps / residual risks

- T8 attempt 1 (a sandboxed GPT worker) saw the Pi lead's first message not submitted in both of its live runs. Not reproduced in 5 diagnostic runs and 3 full smoke runs from Claude sessions (including `TERM=dumb` and no locale). Cause unknown; the smoke now keeps a redacted pane capture and logs if it happens again.
- A one-off Chromium timeout in `viewer/test/app-send-now.spec.js:84` (pre-existing spec from main) in T9's run; not reproduced in isolation (5/5) or in full runs on the base and feature commits.
- Machine suite has occasional load flakes in pre-existing tests (`service.test.js` EADDRINUSE, `project-tools-service.test.js` "tmux buffer failed") seen in T10's runs; clean in the sub-lead's three runs.
- Weak tests: provider registry flags not asserted directly; Settings sign-in has no DOM test; `usageFrom` test guards a constant.
- Accepted Risks and Deferred in PLAN.md stand as listed there.

## Remediation rounds

### Remediation 1 (verification attempt 1 on `5a5f0742`)

Verifiers: Claude PASS; GPT FAIL with 3 gaps (verbatim in `REMEDIATION-1.md`). Gap 3 (no `turn_id` on Pi `turn-failed`) judged a rare path and recorded in PLAN.md Accepted Risks (`verification-1`). Gaps 1 and 2 fixed by task R1-1 (standard, gpt-6.1-terra; three attempts, the third at effort xhigh), merged at `d8344314`.

| Gap | Fix (file:line on `d2e7c783`) | Validated by |
|-----|-------------------------------|--------------|
| 1. Pi marked ready while it downloads `fd`/`rg` at startup; its first Enter rejected ("Startup is still in progress"), so the first message stayed in the editor. This was T8 attempt 1's symptom (the sub-lead's runs had `fd` on PATH) | `machine/adapters/pi.js` `readyText` (not ready while a `<N> not found. Downloading...` line has no later `<N> installed to` / `Failed to download <N>:` line); `machine/service.js` `retryPiStartupEnter` and its call in `submit` (Pi-only `retryStartupEnter` flag: re-sends Enter, never re-pastes, at most once a second for up to 60 s while the rejection shows and Pi is not busy) | `machine/test/pi.test.js` "Pi waits for every startup download to complete"; `machine/test/pi-turns.test.js` "Pi startup download delivers queued first message after readiness" and "... with early readiness and Enter retry" (fake Pi download mode; the second fails with the re-send disabled); live smoke with no `fd` on PATH, below |
| 2. Pi step events carried tool arguments (and so any `sk-or-` text) unredacted into the spool and hub thread | `machine/adapters/pi.js` `redactEvent` applied to every object `hookEvent` returns | `machine/test/pi-turns.test.js` "Pi redacts every returned turn string and offline tool event" (synthetic key through the real `machine/hook.sh pi` path) |

Validation on `d2e7c783`:

```text
bash codex/test/run.sh                RESULT 147 passed, 0 failed
bash machine/test/run.sh              # tests 476  # pass 476  # fail 0
node --test viewer/test/*.test.js     # tests 723  # pass 723  # fail 0
bash install/test/run.sh              RESULT 206 passed, 0 failed
node --test test-support/test/*.test.js   # pass 9  # fail 0
PATH without ~/.kimi-code/bin (no fd): node test-support/smoke/pi-live.js
lead chat | PASS | Pi lead ready and assistant text appears in chat
reviewer result | PASS | Pi reviewer result card has a summary and is delivered to the lead
spend | PASS | machine today $0.003332832; hub today $0.003332832
key isolation | PASS | no key marker in hub, cache and machine state files, chat, or logs
4 passed; 0 failed
```

The browser suite was not re-run: R1-1 changed only machine code and machine tests.

Residual: the installer suite's "real wheelchair directory is byte-identical after suite" check fails when the live hub writes the real state folder during the run (environmental; a verifier saw 205/206 with the inherited HOME, 206/206 isolated).

### Remediation 2 (verification attempt 2 on `cbbaa212`)

Verifiers: Claude PASS; GPT FAIL with 5 gaps (verbatim in `REMEDIATION-2.md`). Gaps 3–5 judged rare paths and recorded in PLAN.md Accepted Risks (`verification-2`). Gaps 1 and 2 (secret leaks) fixed by task R2-1 (standard, gpt-6.1-terra; two attempts, the second at effort xhigh), merged at `c8f3c28d`; Decision 28 (lead) logged for exact pane targets on every CLI.

| Gap | Fix (on `0e934ff5`) | Validated by |
|-----|---------------------|--------------|
| 1. A stopped session's agent or login pane request prefix-matched a live sibling (`wc-x-worker` → `wc-x-worker-2`), and redaction followed the stopped record's CLI | `machine/service.js` `pane()`, `loginPane()`, `loginState()`: exact `=name:` targets for every CLI and `sk-or-` redaction on every capture (Decision 28); `machine/API.md` agent pane row and login section updated | `machine/test/pane-target.test.js` (private tmux server: stopped `wc-x-worker` record beside a live `wc-x-worker-2` showing a synthetic key; the same for `wc-login-work`/`wc-login-work-2`; a live Claude pane redacted). Fails with the old `-t name` target |
| 2. After Pi's sign-in exited, the old prompt still sat in parseLogin's five-line window, so `/code` returned 200 and the key reached the leftover pane | `machine/adapters/pi.js` `parseLogin` (prompt must be the last non-empty line; null on Saved or `__wc_login_exit`); `machine/service.js` `/code` refuses on the exit marker before any tmux write | `machine/test/pi-login.test.js`: raw-mode fake Pi, cancel with `C-c` through `/keys`, then `/code` → 409, key absent from the pane, no tmux buffer; "Pi login prompt must be the last nonempty line". Fails with `parseLogin` reverted |

Validation on `0e934ff5`:

```text
bash codex/test/run.sh                RESULT 147 passed, 0 failed
bash machine/test/run.sh              # tests 478  # pass 478  # fail 0
node --test viewer/test/*.test.js     # tests 723  # pass 723  # fail 0
bash install/test/run.sh              RESULT 206 passed, 0 failed
node --test test-support/test/*.test.js   # pass 9  # fail 0
PATH without ~/.kimi-code/bin (no fd): node test-support/smoke/pi-live.js
lead chat | PASS | Pi lead ready and assistant text appears in chat
reviewer result | PASS | Pi reviewer result card has a summary and is delivered to the lead
spend | PASS | machine today $0.000564708; hub today $0.000564708
key isolation | PASS | no key marker in hub, cache and machine state files, chat, or logs
4 passed; 0 failed
```

The browser suite was not re-run: R2-1 changed only machine code, machine tests and `machine/API.md`.

Residual, pre-existing on the base `dbb0a6b3` and not part of these gaps: `stop()` (`kill-session -t name`), `raw()` (`send-keys -t name`) and Claude/Codex/Antigravity `startLogin`'s kill still use prefix targets; on a record whose tmux session is gone they could reach a `-2` sibling. The restart-recovery capture keeps `-t name` because its names come from tmux's own session list.

### Remediation 3 (verification attempt 3 on `78da748e`)

Verifiers: Claude PASS; GPT FAIL with 2 gaps (verbatim in `REMEDIATION-3.md`). Gap 1 (a key the user pastes as a chat message is stored verbatim) accepted by the lead as a rare path, recorded in PLAN.md Accepted Risks (`verification-3`). Gap 2 fixed by task R3-1 (standard, claude-sonnet-5-5, one attempt), merged at `81cb7d4c`.

| Gap | Fix | Validated by |
|-----|-----|--------------|
| 2. Settings cleared the pasted code and showed Start again on any 409 from code submission, for every provider (a change to the existing providers, from T7) | `viewer/pages/settings.js` `openSignin` `send` handler: the clear-and-Start-again path runs only for `account.provider === 'openrouter'`, with at most one Start again; other providers show the error and keep the code, as on `dbb0a6b3:viewer/pages/settings.js:1059` | `viewer/test/app-accounts.spec.js`: Claude 409 keeps the code with no Start again (fails under the old handler in all 4 projects); OpenRouter 409 clears the key with exactly one Start again after two 409s; `viewer/test/app-openrouter-signin.test.js:27` source check updated |

Validation on the R3-1 branch (`81cb7d4c`; the merge into the feature branch was a fast-forward):

```text
node --test viewer/test/*.test.js     # tests 723  # pass 723  # fail 0
npm --prefix viewer run test:browser
  34 skipped
  1090 passed (11.0m)
exit 0
```

Machine, codex, installer and test-support code is unchanged since `0e934ff5` (their results are under Remediation 2).

### Verification attempt 4 (on `5739ec0c`)

Claude verifier PASS with no gaps. GPT verifier FAIL with one gap (Settings' Start again replaced by the generic failure message on the next poll after a cancelled Pi sign-in and a stale paste), judged a rare path and recorded in PLAN.md Accepted Risks (`verification-4`). No gaps remain: verification passed on `5739ec0c`. Both verifiers re-ran every suite; the GPT verifier's full browser run passed 1090, 34 skipped; each live smoke run passed 4/4.

Rare paths accepted during verification: 6 (`verification-1`: 1, `verification-2`: 3, `verification-3`: 1, `verification-4`: 1).
