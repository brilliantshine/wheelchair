---
slug: app-accounts
date: 2026-11-15
implemented-by: "codex standard gpt-6.1-terra (T1, T2, T4, T5, T8), codex light gpt-6-luna (T3, T7), claude standard claude-sonnet-5-5 (T6, T9); sub-lead claude-opus-5-5"
verified-by:
  - round: 1
    lane: claude top (claude-opus-5-5) — PASS; codex top (gpt-6.1-sol) — FAIL
    checks: codex standard/light (T1-T5, T7, T8), claude standard (T6, T9)
  - round: 2
    lane: claude top — PASS; codex top — FAIL
    checks: R1 codex standard, R2 claude light
  - round: 3
    lane: claude top — FAIL; codex top — FAIL
    checks: R3 codex standard
  - round: 4
    lane: codex top — FAIL (claude top stopped, commit superseded)
    checks: R4 codex light, R5 codex standard
  - round: 5
    lane: claude top — PASS; codex top — PASS
    checks: R6 codex standard, on f559674
---

# Completion Report — Accounts, usage and balancing

Written for a hostile reviewer: every claim checkable, no claim without evidence.

Tree: branch `wc/28f52dc41426`, every task merged at `f7d36cc`. Worker reports: `docs/plans/app-accounts/reports/T1.md` … `T9.md`. Every worker choice is a `Choice:` line in PLAN.md's Log. Line numbers below were re-read on `f7d36cc`; several adapter and service members are long single lines, so one line can hold a whole member.

## Spec coverage

Origin is `this run` throughout except where marked. "this run (moved)" means logic that existed inline in `machine/service.js` on `main` and now lives behind an adapter. There is no Prior Work in PLAN.md; `pre-existing` marks two rows the Spec requires to stay unchanged.

| Spec item | Origin | Implemented at (file:line) | Validated by | Notes |
|---|---|---|---|---|
| §1 Machine registry keyed by `cli` | this run | machine/adapters/index.js:5 | machine/test/accounts.test.js:20 | |
| §1 `provider` | this run | machine/adapters/claude.js:8; machine/adapters/codex.js:8 | machine/test/service.test.js:715 | |
| §1 `loginEnv(dir)`, `{}` for a default | this run | claude.js:6; codex.js:6; machine/service.js:307 | machine/test/service.test.js:712, :804 | |
| §1 `command()` incl. Claude `statusLine` | this run (moved) | claude.js:16-21; codex.js:30; service.js:279-281 | machine/test/service.test.js:800-805 | full argv and settings object asserted for a default start |
| §1 `firstMessage()` | this run (moved) | claude.js:22; codex.js:31; service.js:309 | machine/test/service.test.js:652 | |
| §1 `readyText()` / `answerPrompts()` | this run (moved) | claude.js:23-24; codex.js:32; service.js:321, :333 | machine/test/service.test.js:199, :202 | |
| §1 `findTranscript(session, dir)` | this run (moved) | claude.js:25; codex.js:33; service.js:523 | machine/test/accounts.test.js:26; machine/test/service.test.js:820 | |
| §1 `hookEvent(raw)` | this run (moved) | claude.js:26; codex.js:34; machine/lib/hook-post.js:15-16 | machine/test/accounts.test.js:39-41 | Claude also returns an internal `usage-source` for status-line payloads |
| §1 `usageFrom()` | this run | claude.js:27; codex.js:35 | machine/test/accounts.test.js:32-35, :72-73 | |
| §1 `loginCommand()` | this run | claude.js:9; codex.js:9 | machine/test/service.test.js:763, :776 | |
| §1 `parseLogin()` | this run | claude.js:10-14; codex.js:10 | machine/test/accounts.test.js:51-56 | plus `loginPrompt` (claude.js:15) for the login-method menu |
| §1 `loginStatus(dir)` | this run (moved) | claude.js:28; codex.js:36; machine/adapters/common.js:16 | machine/test/service.test.js:769-770 | |
| §1 `seed(dir)` | this run | machine/adapters/common.js:9-15 | machine/test/accounts.test.js:21-23, :66-67 | |
| §1 Optional `onTurnEnded` (Codex rollout binding and scan) | this run | machine/adapters/codex.js:11-29; service.js:590-600 | machine/test/service.test.js:817-820 | not in the §1 table; see Deviations |
| §1 `hook.sh` one line per CLI, hands to `hook-post.js` → `hookEvent` | pre-existing (hook.sh) / this run (hook-post.js) | machine/hook.sh:16-28; machine/lib/hook-post.js:15-16 | machine/test/accounts.test.js:45-47 | |
| §1 Recovery reads persisted `session.cli` when present | this run | machine/service.js:184 | none | see Deviations: only unrecorded sessions are guessed |
| §1 CLI branches behind adapters / provider facts | this run | viewer/app/providers.js:3; viewer/app/sessions.js:20, :26, :80, :95, :175; viewer/app/ready.js:45, :54, :58; viewer/app/balancer.js:40, :45 | indirect (all session tests) | two named leftovers in Deviations |
| §1 Hub `providers.js`, `providerOf` / `cliOf` | this run | viewer/app/providers.js:3-5 | viewer/test/app-balancer.test.js:17-18 | |
| §1 `chat.js` parser map by `cli`; unknown `cli` → notice | this run | viewer/app/chat.js:142-171, :187-192, :208 | viewer/test/app-usage.test.js:43; viewer/test/app-chat.test.js:11, :114 | one parser per CLI |
| §2 `accounts` in settings `defaults()` / `normalize()` | this run | viewer/app/settings.js:26, :156-167 | viewer/test/app-usage.test.js:14-18 | |
| §2 Ids: built-ins, slug on add, unique | this run | viewer/app/routes.js:64-66 | viewer/test/app-usage.test.js:145 | |
| §2 Exactly one `default-<provider>`, renamable, pausable, not removable | this run | settings.js:159, :163; routes.js:78 | viewer/test/app-usage.test.js:60, :74-76 | |
| §2 Plans and weights (D10) | this run | settings.js:23 | viewer/test/app-usage.test.js:67-73 | |
| §2 Codex `plan_type` beside the chosen plan when they differ | this run | viewer/pages/settings.js:854-861, :870; codex.js:35 | viewer/test/app-accounts.spec.js:267-280 | |
| §2 Folder: default → usual folder, else `~/.wheelchair/accounts/<id>`; `account: {id, dir}` in the start request | this run | viewer/app/sessions.js:138; machine/service.js:34-42, :292-295 | machine/test/service.test.js:712-717; viewer/test/app-balancer.test.js:18 | |
| §2 Service never deletes an account folder | this run | machine/service.js (no rm, unlink or rmSync of account paths) | none | holds by absence |
| §2 `seed`: 0700, links, Codex `config.toml` if absent | this run | machine/adapters/common.js:10-13 | machine/test/accounts.test.js:22, :27, :66-67 | runs each start, idempotent |
| §2 `loginEnv` and `findTranscript(dir)` shipped together | this run | machine/service.js:307, :523 | machine/test/service.test.js:712, :820 | both in T1's one commit |
| §2 Session records gain `account` | this run | viewer/app/sessions.js:128, :169; machine/service.js:301 | viewer/test/app-balancer.test.js:12; machine/test/service.test.js:715 | |
| §2 `/v1/status` `accounts` | this run | machine/service.js:731-737 | machine/test/service.test.js:719 | |
| §2 Ready: any unpaused logged-in account; text names the provider | this run | viewer/app/ready.js:51-58 | viewer/test/app-usage.test.js:49, :134; viewer/test/app-hub.test.js:987, :993 | |
| §2 Account removed: dropped, sessions continue, folder stays | this run | viewer/app/routes.js:78 | viewer/test/app-usage.test.js:214-224 | |
| §2 Second Claude account warning | this run | viewer/pages/settings.js:681, :933, :944-947 | viewer/test/app-accounts.spec.js:157-180 | |
| §3 Per account and machine state, Sign in | this run | viewer/app/usage.js:99; viewer/pages/settings.js:873-875 | viewer/test/app-accounts.spec.js:97-101 | |
| §3 `POST /accounts/:id/signin` → `POST /v1/logins` | this run | viewer/app/routes.js:196; machine/service.js:778 | viewer/test/app-usage.test.js:198-202 | |
| §3 Service seeds and starts `wc-login-<id>` | this run | machine/service.js:697-704 | machine/test/service.test.js:762-763, :774-776 | |
| §3 `GET /v1/logins/:id` state | this run | machine/service.js:713-725, :781 | machine/test/service.test.js:764-770 | |
| §3 Login-method menu answered once | this run | claude.js:15; machine/service.js:~720 | machine/test/accounts.test.js (T7); machine/test/service.test.js (T7 test "Claude login menu is answered once…") | synthetic fixture; see risks |
| §3 `POST /v1/logins/:id/code` | this run | machine/service.js:784 | machine/test/service.test.js:767-768 | |
| §3 Hub proxies state, code, pane, keys | this run | viewer/app/routes.js:197-199 | viewer/test/app-usage.test.js:203-208 | |
| §3 Card polls every 2 s | this run | viewer/pages/settings.js:823 | viewer/test/app-accounts.spec.js:127-129 | |
| §3 Claude link and paste box | this run | viewer/pages/settings.js:799-800, :811 | viewer/test/app-accounts.spec.js:117-122 | |
| §3 Codex link and code with Copy | this run | viewer/pages/settings.js:802-808 | viewer/test/app-accounts.spec.js:141-144 | |
| §3 Done → green, closes after 2 s | this run | viewer/pages/settings.js:787-792 | viewer/test/app-accounts.spec.js:127-129 | |
| §3 Failed / no url in 30 s → fallback | this run | viewer/pages/settings.js:682, :776-783, :812, :820 | viewer/test/app-accounts.spec.js:148-155, :282-295 | |
| §3 Open terminal; terminal login mode | this run | viewer/pages/settings.js:767; viewer/pages/terminal.js:9-16; viewer/app/routes.js:199 | viewer/test/app-accounts.spec.js:124, :422-434 | |
| §3 Login sessions off the Sessions page and recovery | this run | machine/service.js:178, :728, :737 | machine/test/service.test.js:771-772 | |
| §4 Reading shape | this run | viewer/app/sessions.js:291; claude.js:27; codex.js:35 | machine/test/service.test.js:733 | |
| §4 Codex windows by `window_minutes`, Unix seconds | this run | codex.js:35 | machine/test/accounts.test.js:30-37, :71-74 | real rollout line, sanitized |
| §4 Codex `rate_limit_reached_type` → `limited_until` | this run | codex.js:35; machine/service.js:594-596 | machine/test/service.test.js:820 | |
| §4 Codex scans new rollout lines each turn end | this run | codex.js:11-29 | machine/test/service.test.js:817-820 | |
| §4 Claude `statusLine` in settings | this run | claude.js:20 | machine/test/service.test.js:803 | |
| §4 Status-line script prints and posts, spool fallback | this run | machine/statusline.sh:6; machine/lib/statusline.js:10-21 | machine/test/accounts.test.js:45-47; machine/test/service.test.js:748, :753 | |
| §4 At most once a minute per session | this run | machine/lib/statusline.js:18-19 | machine/test/service.test.js:749-752 | |
| §4 `StopFailure` in the hook list | this run | claude.js:20 | machine/test/service.test.js:803 | |
| §4 `StopFailure` rate_limit (or `error_type`) → `limit-hit` | this run | claude.js:26; machine/service.js:610 | machine/test/accounts.test.js:39-40; machine/test/service.test.js:734 | |
| §4 Other `StopFailure` → `turn-failed`, no report path | this run | claude.js:26; viewer/app/sessions.js:301-302 | viewer/test/app-balancer.test.js:155-158 | |
| §4 Turn-failed message to the starter | this run | viewer/app/sessions.js:303-305 | viewer/test/app-balancer.test.js:159 | |
| §4 Lead turn-failed `needs` card | this run | viewer/app/sessions.js:306-307 | viewer/test/app-balancer.test.js:21-24 | |
| §4 Card answered on next `turn-ended` or restart | this run | viewer/app/sessions.js:317; viewer/app/threads.js:131 | viewer/test/app-balancer.test.js:25-27; viewer/test/app-hub.test.js:1591-1599 | |
| §4 Exhausted-window rule | this run | machine/lib/limits.js:2-8 | machine/test/accounts.test.js:10-17 | |
| §4 Readings forwarded to the hub | this run | machine/service.js:598-599, :608 | machine/test/service.test.js:733, :753 | |
| §4 `usage.json`, one writer queue | this run | viewer/app/usage.js:39-44 | viewer/test/app-usage.test.js:114-126 | |
| §4 Expired window rule | this run | viewer/app/usage.js:10-18, :28 | viewer/test/app-usage.test.js:21, :32-33 | |
| §4 No reading → "no reading yet", has room | this run | viewer/app/usage.js:21; viewer/pages/settings.js:831, :879 | viewer/test/app-usage.test.js:86; viewer/test/app-accounts.spec.js:105 | |
| §5 `choose` before `resolveModel`; `cli` from `cliOf` | this run | viewer/app/sessions.js:67, :79, :104 | viewer/test/app-balancer.test.js:17 | |
| §5 Slot first; Not used ineligible; strict worker → 400 | this run | viewer/app/balancer.js:17-24, :31-34, :38 | viewer/test/app-hub.test.js:955-958; viewer/test/app-balancer.test.js:209-217 | |
| §5 `lead_order` default, edited on Leads | this run | settings.js:26; viewer/pages/settings.js:271, :1076-1083 | viewer/test/app-accounts.spec.js:239-251 | |
| §5 `worker_order` default | this run | settings.js:26 | viewer/test/app-balancer.test.js:17 | |
| §5 `within`, `leave`, `notify_below`, `save_claude_for_leads`, `margin` defaults | this run | settings.js:26 | viewer/test/app-usage.test.js:38, :111, :172; viewer/test/app-balancer.test.js:62 | margin 5 not asserted on its own |
| §5 Room | this run | viewer/app/usage.js:19-22 | viewer/test/app-usage.test.js:23-27, :84-86 | |
| §5 `within: soonest` / `spread` / `one` | this run | viewer/app/usage.js:80-84; viewer/app/sessions.js:102 | viewer/test/app-balancer.test.js:49-53; viewer/test/app-usage.test.js:102-106 | |
| §5 New lead: `lead_order`, `any`, records `thread.provider` | this run | viewer/app/balancer.js:29; viewer/app/sessions.js:103 | viewer/test/app-balancer.test.js:10, :68 | |
| §5 Restart and sub-lead pinned | this run | viewer/app/balancer.js:29 | viewer/test/app-balancer.test.js:64 | |
| §5 Old threads get `provider` from `cli` | this run | viewer/app/hub.js:69; viewer/app/balancer.js:28 | viewer/test/app-balancer.test.js:201-207 | |
| §5 Other roles use `worker_order` | this run | viewer/app/balancer.js:29, :43-47 | viewer/test/app-balancer.test.js:17 | |
| §5 Eligible providers | this run | viewer/app/balancer.js:37-42 | viewer/test/app-balancer.test.js:54-58 | |
| §5 Save Claude for leads | this run | viewer/app/balancer.js:45 | viewer/test/app-balancer.test.js:62-63 | |
| §5 Margin skips Claude for non-leads | this run | viewer/app/balancer.js:40, :44 | viewer/test/app-balancer.test.js:90-94 | |
| §5 Constraints only for worker/reviewer/verifier; exclusive | this run | viewer/app/balancer.js:21 | viewer/test/app-balancer.test.js:19-20, :77-78 | |
| §5 `--provider` counts as asking for Claude | this run | viewer/app/balancer.js:49 | none in isolation | covered by the `--provider claude` worker cases at :56, :92 |
| §5 `--provider` worker strict, margin exception | this run | viewer/app/balancer.js:49-50, :54-56 | viewer/test/app-balancer.test.js:56, :69, :92-93 | |
| §5 `--provider` reviewer/verifier preference | this run | viewer/app/balancer.js:54-56 | viewer/test/app-balancer.test.js:71-73 | |
| §5 `--not-provider` worker strict | this run | viewer/app/balancer.js:51-52 | viewer/test/app-balancer.test.js:70 | |
| §5 `--not-provider` reviewer/verifier preference | this run | viewer/app/balancer.js:53 | viewer/test/app-balancer.test.js:74-75, :86-88 | |
| §5 Waiting record, `pending_start`, same attempt | this run | viewer/app/sessions.js:68-78, :365-368 | viewer/test/app-balancer.test.js:108-111 | |
| §5 `wc.js` "waiting for room until" | this run | viewer/app/wc.js:135 | viewer/test/app-machines.test.js:131 | |
| §5 Retry each 60 s and on readings; promote in place | this run | viewer/app/hub.js:53, :98; viewer/app/sessions.js:111-130, :459-467 | viewer/test/app-balancer.test.js:118-124, :163-178 | the 60 s timer itself is not driven in a test |
| §5 Scan at hub startup | this run | viewer/app/hub.js:56 | viewer/test/app-balancer.test.js:237-248 | |
| §5 `pollDead` skips waiting; `stopSession` on waiting | this run | viewer/app/sessions.js:404, :434 | viewer/test/app-balancer.test.js:182-199 | |
| §5 Lead waiting line | this run | viewer/pages/thread.html:26; viewer/pages/thread.js:589-600, :623 | viewer/test/app-accounts.spec.js:393-417 | |
| §5 Limit hold | this run | viewer/app/sessions.js:240-242, :293-300 | viewer/test/app-balancer.test.js:138-147 | |
| §5 Release with `Continue.` | this run | viewer/app/sessions.js:469-476 | viewer/test/app-balancer.test.js:148-153 | |
| §5 Forecast C, U, L, F | this run | viewer/app/usage.js:23-27, :32 | viewer/test/app-usage.test.js:28-29, :91-92 | |
| §5 Forecast elapsed and pace | this run | viewer/app/usage.js:30-31 | viewer/test/app-usage.test.js:88 | |
| §5 Runs out, amber, P = 0 | this run | viewer/app/usage.js:33-34 | viewer/test/app-usage.test.js:29-30 | |
| §5 Margin test | this run | viewer/app/usage.js:36-38 | viewer/test/app-usage.test.js:89-90 | |
| §5 Worked check (50% at 84 h) | this run | viewer/app/usage.js:30-33 | viewer/test/app-usage.test.js:29 | |
| §5 All paused | this run | viewer/app/usage.js:34, :97; viewer/pages/settings.js:1018 | viewer/test/app-usage.test.js:31, :93; viewer/test/app-accounts.spec.js:204 | |
| §6 `accounts`, `usage` first in `SECTIONS` | this run | viewer/pages/settings.js:8, :1096-1099 | viewer/test/app-settings.spec.js:47 | |
| §6 Accounts by provider | this run | viewer/pages/settings.js:955-961 | viewer/test/app-accounts.spec.js:91-93 | |
| §6 Card: name, plan, weight | this run | viewer/pages/settings.js:869-870 | viewer/test/app-accounts.spec.js:95, :277 | |
| §6 Card: 5-hour and week, "as of" | this run | viewer/pages/settings.js:830-837, :876-879 | viewer/test/app-accounts.spec.js:102-104 | |
| §6 Card: "in use · N agents" | this run | viewer/pages/settings.js:872; viewer/app/usage.js:95 | viewer/test/app-accounts.spec.js:96; viewer/test/app-usage.test.js:171 | |
| §6 Card: Pause/Resume, Rename, Change plan, Remove | this run | viewer/pages/settings.js:904-907 | viewer/test/app-accounts.spec.js:106-107, :297-343 | Pause click not driven; Resume label checked |
| §6 Add account flow | this run | viewer/pages/settings.js:909-951 | viewer/test/app-accounts.spec.js:169-178, :182-192 | |
| §6 Usage bar | this run | viewer/pages/settings.js:1015-1029 | viewer/test/app-accounts.spec.js:200 | |
| §6 Amber line | this run | viewer/pages/settings.js:1020 | viewer/test/app-accounts.spec.js:201 | |
| §6 Below-notify line | this run | viewer/pages/settings.js:1021 | viewer/test/app-accounts.spec.js:202 | |
| §6 Account table with reasons | this run | viewer/pages/settings.js:1032-1046; viewer/app/usage.js:72-85 | viewer/test/app-accounts.spec.js:205-210; viewer/test/app-usage.test.js:107-111 | ranked for the hub machine; see Deviations |
| §6 Balancing settings | this run | viewer/pages/settings.js:1054-1064 | viewer/test/app-accounts.spec.js:222-237 | |
| §6 Nav dot | this run | viewer/pages/nav.js:61, :150-164; viewer/app/usage.js:103-104 | viewer/test/app-accounts.spec.js:375-386; viewer/test/app-usage.test.js:172-178 | |
| §6 Live data every 30 s | this run | viewer/pages/settings.js:712-731 | viewer/test/app-accounts.spec.js:345-370 | |
| §7 `GET /settings` adds accounts and §5 keys | this run | viewer/app/settings.js:227; viewer/app/routes.js:58 | viewer/test/app-usage.test.js:222 | |
| §7 `POST /settings/accounts` | this run | viewer/app/routes.js:60-71 | viewer/test/app-usage.test.js:56-58, :143-145 | |
| §7 `PUT /settings/accounts/:id` | this run | viewer/app/routes.js:72-88 | viewer/test/app-usage.test.js:59, :146-148 | |
| §7 `DELETE /settings/accounts/:id` | this run | viewer/app/routes.js:78 | viewer/test/app-usage.test.js:60, :221 | |
| §7 `PUT /settings/balancing` validation | this run | viewer/app/routes.js:91-94; viewer/app/settings.js:177-178 | viewer/test/app-usage.test.js:61 | |
| §7 `GET /usage` | this run | viewer/app/routes.js:48; viewer/app/usage.js:88-101 | viewer/test/app-usage.test.js:169-171 | |
| §7 Sign-in routes | this run | viewer/app/routes.js:190-200 | viewer/test/app-usage.test.js:182-210 | |
| §7 `provider`/`not_provider` end to end; `cli` ignored | this run | viewer/app/wc.js:85-86; machine/service.js:662; viewer/app/sessions.js:375-376 | viewer/test/app-machines.test.js:126-128; viewer/test/app-balancer.test.js:108-109 | the service leg forwards the whole body (unchanged code at service.js:662) |
| §8 CLI picker gone; `cli` not required | this run | viewer/pages/threads.html; viewer/app/threads.js:43 | viewer/test/app-accounts.spec.js:254-259; viewer/test/app-balancer.test.js:9 | |
| §8 `thread.provider`, `thread.cli` from it | this run | viewer/app/sessions.js:103 | viewer/test/app-balancer.test.js:10-11 | |
| §8 Stubs inherit nothing | this run | viewer/app/threads.js:71 | viewer/test/app-hub.test.js:501-517 | |
| §8 `--cli` ignored with notice | this run | viewer/app/wc.js:76-79 | viewer/test/app-machines.test.js:125, :129 | |
| §8 `--provider` / `--not-provider` | this run | viewer/app/wc.js:85-86 | viewer/test/app-machines.test.js:127-128 | |
| §8 `session list` shows provider and account | this run | viewer/app/sessions.js:128, :358-359 | none | fields in the listed JSON; no formatted column |
| §9 lead.md start command | this run | protocol/app/lead.md:46-47 | none (no protocol suite, by design) | |
| §9 lead.md reviewers | this run | protocol/app/lead.md:173-176 | none | |
| §9 lead.md fix verifiers | this run | protocol/app/lead.md:99-100, :279 | none | |
| §9 lead.md "note" sentence replaces `command -v` / one family | this run | protocol/app/lead.md:75-76, :176-177 | none | |
| §9 sub-lead.md start command | this run | protocol/app/sub-lead.md:73-75 | none | |
| §9 sub-lead.md "Which family" | this run | protocol/app/sub-lead.md:66-69 | none | |
| §9 sub-lead.md verifier rules | this run | protocol/app/sub-lead.md:151-156 | none | |
| §9 Turn-failed rule (both files) | this run | protocol/app/lead.md:317-322; protocol/app/sub-lead.md:94-99 | none | |
| §9 sub-lead.md remediation `--provider` | this run | protocol/app/sub-lead.md:163-164 | none | |
| §9 lead.md:89 "the project and the machine" | this run | protocol/app/lead.md:90 | none | |
| §9 cards.md unchanged | pre-existing | protocol/app/cards.md (no diff vs main) | `git diff main...HEAD -- protocol/app/cards.md` empty | |
| Edge: defaults only → today's folders; leads Claude, others GPT then Claude | this run | viewer/app/settings.js:26; viewer/app/sessions.js:138 | viewer/test/app-balancer.test.js:6-18 | |
| Edge: unreachable machine → unknown | this run | viewer/app/usage.js:60, :71, :99 | viewer/test/app-usage.test.js:171; viewer/test/app-machines.test.js:38-42 | |
| Edge: expired Codex login → preflight with account folder, retry next once | this run | viewer/app/sessions.js:80-100; machine/service.js:776 | viewer/test/app-balancer.test.js:220-235; viewer/test/app-hub.test.js:1217-1224; machine/test/service.test.js:755-756 | signed-out mark not persisted; see Deviations |
| Edge: preview and `model.sh` cache on defaults | this run | machine/service.js:777 (no `loginEnv`) | none | holds by absence |
| Edge: two machines | this run | viewer/app/balancer.js:25-27, :41; viewer/app/usage.js:68-74 | viewer/test/app-balancer.test.js:251-269 | |
| Edge: clock skew ignored | this run | — | — | nothing to implement |

## Deviations from plan

- **Extra routes** (sub-lead choice, Log 2026-11-15): `GET /usage/alert` and `POST /usage/seen` back the nav dot (D12, §6), so the nav can check without calling every machine. They are additions; no Spec route changed.
- **`limited_until` is computed by the machine service**, not the hub (sub-lead choice): it holds each session's latest reading. §4 says the rule applies "from the session's latest reading"; the hub stores what the service sends.
- **Adapter gains an optional member** `onTurnEnded(session, event)` (Codex only, `machine/adapters/codex.js`), not in the §1 table. It holds Codex's thread binding and rollout scan, so `machine/service.js` has no per-CLI turn-end branch (§1 "every branch… moves behind these"). `codex.usageFrom` also returns `reached: true`, which the service turns into `limited_until`.
- **Codex default `logged_in` in `/v1/status`** now comes from `codex login status` (before: installed meant logged in and the preflight was the real check). With `accounts` present, the Ready check reads account rows and skips the preflight; an old status without `accounts` keeps today's preflight (§2 Ready; D11 keeps the preflight at session start).
- **Claude OAuth host**: `parseLogin` also accepts `claude.com`, which the real CLI prints (captured), besides `claude.ai` and `console.anthropic.com`.
- **Tier aliases**: `haiku`/`sonnet`/`opus` resolve to Light/Standard/Heavy for either provider, because the slot is resolved before the provider (§5 "slot is resolved from role and tier first").
- **Settings default section** stays Models (hash fallback unchanged) although Accounts and Usage are now first and second in `SECTIONS` (§6 asks for their position in the list, not the default).
- **Session recovery** (`machine/service.js:184`) still guesses the CLI from pane text. It runs only for a live `wc-*` tmux session missing from `sessions.json`, so there is no persisted `session.cli` to read; for every recorded session the persisted `cli` is used (§1 "when present").
- **Claude tier aliases on the model route** (`viewer/app/routes.js:98`): `haiku`/`sonnet`/`opus` are Claude's own names for its cells on `PUT /settings/models`, so that one line names Claude. It is the Models editor, not session placement.
- **Usage table reasons** are ranked for the hub's own machine (`viewer/app/usage.js:93`, `:98`): "skipped: signed out on <machine>" names that machine; an account signed out only on another machine shows as signed out in its per-machine row on the Accounts card, not in the Usage reason.
- **`seed`** runs on every start of a non-default account, not only the first; it is idempotent (never overwrites a link or `config.toml`; rewrites `wheelchair-account.json`).
- **Sign in** is also offered on a machine whose state is `unknown` (unreachable); pressing it then fails at the proxy with the machine's error.
- **Expired Codex login** marks the account signed out only in the hub's 15 s machine-status cache (`viewer/app/sessions.js:~88`), then retries once on the next account; it is not persisted.
- **Worker `--provider` on a Not used cell** is refused with 400 "<label> is not used at <slot>" rather than waiting (sub-lead choice, Log), matching today's refusal.
- **Remove** asks an inline "Remove <name>? Remove / Keep" first (not in the Spec).
- Every other worker choice is a Log line in PLAN.md (`Choice: T1…T7`).

## Routers

highways not installed (`command -v highways` finds nothing); routers not maintained by highways. The workers added the new files to the file tables by hand:
- `machine/AGENTS.md`: `adapters/`, `statusline.sh` and `lib/statusline.js`, `lib/limits.js`.
- `viewer/AGENTS.md`: `app/providers.js`, `app/balancer.js`, `app/usage.js`.
No ownership moved between directories. `viewer/app/API.md` and `machine/API.md` (route contracts) were updated for every route added or changed.

## Validation evidence

All run on the merged feature branch at `f7d36cc` (every task merged), one suite at a time, with `viewer/node_modules` symlinked to the clone's (Log, "Baseline").

```
$ bash sensitivity/test/run.sh   -> RESULT 64 passed, 0 failed   (exit 0)
$ bash seen/test/run.sh          -> RESULT 21 passed, 0 failed   (exit 0)
$ bash codex/test/run.sh         -> RESULT 72 passed, 0 failed   (exit 0)
$ bash install/test/run.sh       -> RESULT 90 passed, 0 failed   (exit 0)
$ bash machine/test/run.sh       -> # tests 79  # pass 79  # fail 0   (exit 0)
$ node --test viewer/test/*.test.js
not ok 185 - a starter that loses the freed port registers through the new holder
# tests 300
# pass 299
# fail 1
$ npm --prefix viewer run test:browser
  2 failed
    [chromium] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
    [firefox] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
  2 skipped
  504 passed (1.7m)
```

Both remaining failures are on `main` before this feature. Checked on a fresh clone of `main` at `6a98115` (with `viewer/node_modules` symlinked):

```
$ node --test --test-name-pattern="loses the freed port" viewer/test/lifecycle.test.js
not ok 1 - a starter that loses the freed port registers through the new holder
  error: 'C retried after the silent holder'
$ npx --prefix viewer playwright test --config viewer/playwright.config.js -g "no drawn arrow"
  2 failed
    [chromium] › viewer/test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
    [firefox] › viewer/test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
```

The branch changes no `docs/plans/*/graphs/*.json` relative to `main` (`git diff --name-only main...HEAD | grep graphs` is empty), so the arrow test's input is the same as on main.

Flaky under parallel suites, passing alone (3/3): `server.test.js` "the global write lock serializes concurrent writes and retry retains both changes"; "the real viewer keeps its boot commit…". Neither failed in the sequential run above.

`./install.sh` was not run: this is a worktree, and it refuses there (AGENTS.md "Verification"); `install/test/run.sh` covers the installer.

## Known gaps / residual risks

- **Claude login-method menu**: if `claude auth login` shows a "Select login method" menu, the service answers Enter (the first option, the subscription). The real capture went straight to the OAuth link, so this is tested only against a synthetic fixture written from Claude Code's documented screen (`machine/test/fixtures/login/claude-menu.txt`, T7). If the real menu's wording or order differs, the card times out to "Couldn't read the sign-in screen" and Open terminal, which still works.
- **Sign-in screens are screen text**: `parseLogin` reads the CLIs' output (captured from Claude Code and Codex v0.169.0). A CLI update that rewords the screen breaks the card, not the terminal fallback.
- **No live run**: the always-on hub and machine services run the canonical clone, so nothing here was exercised against real Claude or Codex logins, real rate-limit readings or a real limit hit. Readings are tested from a sanitized real Codex rollout line and the documented Claude status-line shape.
- **A fresh account folder's first-run screens** (W1) were not run live; the service already answers Claude's trust prompt and the folder is seeded with `CLAUDE.md`/`AGENTS.md` links and Codex's `config.toml`.
- **`/v1/status` spawns one login check per account** (`claude auth status` / `codex login status`, synchronous, up to 15 s each). The hub caches it 15 s, but many accounts on one machine make each status call slower.
- **Unreachable machine → waiting**, by the Spec's room rule: a thread on a machine that is down gets a waiting lead (retried every 60 s) instead of a failed start.
- **Not driven by a test**: the 60 s retry timer itself (its body, `retryWaiting`, is tested); the margin default of 5 on its own; the Pause click (Resume label checked); "`--provider` counts as asking for Claude" in isolation; `session list` showing `provider`/`account` (they are fields of the listed record); "never deletes an account folder" and "preview and `model.sh` cache stay on the defaults" (both hold by the absence of such code); the §9 protocol edits (no protocol suite exists, by design).
- **Ready check while the lead waits**: `viewer/app/ready.js:44` iterates `thread.cli`, which is unset until a waiting lead is promoted. The Ready check runs at plan approval, when the lead has long been running, so this is not reached in the workflow; a check run against a thread whose lead never started would list "undefined is not installed".
- **Two failures already on main** remain in the suites (above), outside this feature.

## Remediation rounds

### Remediation 1 — 2026-11-15

Round 1 on `ed2ec6c`: Claude verifier PASS; Codex verifier FAIL with three gaps. Gap list verbatim and tasks in `REMEDIATION-1.md`. Fixed on branch at `58be76c`:

| Gap | Fix (file:line) | Test |
|---|---|---|
| §5 limit recovery: a limited Codex verifier published partial text as its result | `viewer/app/sessions.js` turn-ended branch: no `deliverReport` while the session's `limited_until` is in the future; the report goes out on the first turn end after release | `viewer/test/app-balancer.test.js` (R1: limited verifier gets no result card, `finished` unset; after release one card with the real text) |
| §5 account held until reset: a newer reading erased `limited_until` | `viewer/app/usage.js:44` `record` keeps a stored future `limited_until` when the newer reading has none | `viewer/test/app-usage.test.js` (R1: limit-hit then a newer reading → still no room until the time passes) |
| §2 account isolation: removing and re-adding a name reused the id and folder | `viewer/app/routes.js` DELETE records the id in `retired_accounts`; POST makes ids unique against current and retired ids; `viewer/app/settings.js` keeps `retired_accounts` in `defaults()`/`normalize()` | `viewer/test/app-usage.test.js` (R1: add, remove, re-add "Personal" → a new id, no reading, no live sessions) |
| Minor (Claude verifier): promoted waiting record lacked `template_id` / `style_version` | `viewer/app/sessions.js` promotion sets both | `viewer/test/app-balancer.test.js` (R1: promoted lead's first delivery has no `[wc:style]`) |
| Minor (Claude verifier): waiting line named "Claude" with no provider chosen | `viewer/app/balancer.js` waiting records carry `waiting_provider`; `viewer/pages/thread.js` `waitingLine()` reads it, else the lead's or thread's provider, else "Waiting for room, about …" | `viewer/test/app-balancer.test.js` (R1: `waiting_provider: 'gpt'` under a GPT-first lead order); `viewer/test/app-accounts.spec.js` (R2: both wordings) |

Lanes: R1 codex standard (gpt-6.1-terra), R2 claude light (claude-haiku-5-5), each the family that built the code it fixed.

Validation at `58be76c`, sequential:

```
$ bash sensitivity/test/run.sh -> RESULT 64 passed, 0 failed
$ bash seen/test/run.sh        -> RESULT 21 passed, 0 failed
$ bash codex/test/run.sh       -> RESULT 72 passed, 0 failed
$ bash install/test/run.sh     -> RESULT 90 passed, 0 failed
$ bash machine/test/run.sh     -> # pass 79  # fail 0
$ node --test viewer/test/*.test.js
not ok 189 - a starter that loses the freed port registers through the new holder
# tests 304
# pass 303
# fail 1
$ npm --prefix viewer run test:browser
  2 failed
    [chromium] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
    [firefox] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
  2 skipped
  508 passed (1.7m)
```

The two failures are the same ones on `main` (above). Round 1's Claude verifier also saw `registration.test.js` "registration rejects every out-of-scope plan and graph path before open reaches a port" fail once in a full run and pass 3/3 alone; it did not fail here. This branch does not touch that file.

### Remediation 2 — 2026-11-15

Round 2 on `1047177`: Claude verifier PASS; Codex verifier FAIL with three gaps. Gap list verbatim and the task in `REMEDIATION-2.md`. Fixed on branch at `9f070d2`:

| Gap | Fix (file:line) | Test |
|---|---|---|
| §5 limit recovery through the spool path (second fix of round 1's gap) | `machine/service.js:590-599`: a Codex turn end's reading is attached to the forwarded `turn-ended` event as `reading` (no separate `usage` event), identical live and when drained from the spool; `viewer/app/sessions.js` `event()` applies any `payload.reading` (record, `limited_until`) before the turn-ended branch decides the report path | `machine/test/service.test.js` (R3: reached-limit rollout → one `turn-ended` carrying `reading.limited_until`, live and from the spool); `viewer/test/app-balancer.test.js` (R3: limited verifier turn end → no result card; after release → one) |
| §6 dot dedup keyed on the earliest reset | `viewer/app/usage.js` `weekKey`, `alert`, `seen`: seen per provider per ISO week of the hub's local time | `viewer/test/app-usage.test.js` (R3: two accounts below, seen, pause the earliest-reset one → no dot; next week → dot) |
| §6 dot never shown with an unknown reset | same: alerting no longer requires `first_refill` | `viewer/test/app-usage.test.js` (R3: `below_notify` with `first_refill: null` → dot; after seen → none) |

Lane: R3 codex standard (gpt-6.1-terra), the family that built this code. Deviation added: the nav dot's "once per week" is the calendar (ISO) week of the hub's local time, not the provider's refill week.

Residual risk added from round 2's Claude verifier: model options in the Models editor are still hard-coded per provider (`viewer/app/settings.js:208-216`), so a third CLI would edit that file too (its model rows are out of scope, D2).

Validation at `9f070d2`, sequential:

```
$ bash sensitivity/test/run.sh -> RESULT 64 passed, 0 failed
$ bash seen/test/run.sh        -> RESULT 21 passed, 0 failed
$ bash codex/test/run.sh       -> RESULT 72 passed, 0 failed
$ bash install/test/run.sh     -> RESULT 90 passed, 0 failed
$ bash machine/test/run.sh     -> # pass 80  # fail 0
$ node --test viewer/test/*.test.js
not ok 190 - a starter that loses the freed port registers through the new holder
# tests 305
# pass 304
# fail 1
$ npm --prefix viewer run test:browser
  2 failed
    [chromium] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
    [firefox] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
  2 skipped
  508 passed (1.8m)
```

The two failures are the same ones on `main` (above).

### Remediation 3 — 2026-11-15

Round 3 on `4dc3170`: both verifiers FAIL. Codex verifier: (1) a spooled Codex limit reading was lost on a failed delivery (replay advanced `usage_offset` without persisting the enriched event); (2) a reading carried on `turn-ended` did not retry waiting starts. Claude verifier: gap (2) only. Gap (1) had then survived two fixes; per sub-lead.md it went to the lead as a plan defect, and Collin chose to fix it (D17). Fixed on branch at `da2dc16`:

| Gap | Fix (file:line) | Test |
|---|---|---|
| §5 limit recovery, failed delivery during spool replay (third fix, D17) | `machine/service.js` spool drain: an event not yet `prepared` is enriched once by `hook()` and the spool file is atomically rewritten with the enriched event (`prepared: true`, same `delivery_id`) before the first post; a prepared file is posted as stored without re-running `hook()`; the live path spools the forwarded event already `prepared`; the `prepared` field is stripped from the body sent to the hub. `usage_offset` therefore advances once per event | `machine/test/service.test.js` "Codex <live/offline> retries the same prepared reading" (hub 503 then 200: two identical bodies with `reading`, no `prepared`, spool empty after) |
| §5 retry waiting on every new reading | `viewer/app/hub.js:98`: `retryWaiting` runs for any non-duplicate event carrying `payload.reading` | `viewer/test/app-balancer.test.js` "a turn-ended reading promotes the same waiting worker and keeps its token" |

Lanes: R4 codex light (gpt-6-luna), R5 codex standard (gpt-6.1-terra).

Validation at `da2dc16`, sequential:

```
$ bash sensitivity/test/run.sh -> RESULT 64 passed, 0 failed
$ bash seen/test/run.sh        -> RESULT 21 passed, 0 failed
$ bash codex/test/run.sh       -> RESULT 72 passed, 0 failed
$ bash install/test/run.sh     -> RESULT 90 passed, 0 failed
$ bash machine/test/run.sh     -> # pass 82  # fail 0
$ node --test viewer/test/*.test.js
not ok 191 - a starter that loses the freed port registers through the new holder
# tests 306
# pass 305
# fail 1
$ npm --prefix viewer run test:browser
  3 failed
    [chromium] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
    [firefox] › test/app-threads.spec.js:327:5 › phone › approval: Start building enabled when Ready and presses; offer press
    [firefox] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
  2 skipped
  507 passed (2.9m)
$ npx --prefix viewer playwright test --config viewer/playwright.config.js viewer/test/app-threads.spec.js:327 --project=firefox   (x3)
  2 passed (3.8s)
  2 passed (3.8s)
  2 passed (3.8s)
```

The arrow and lifecycle failures are on `main` (above). `app-threads.spec.js:327` in Firefox is flaky under the full run: it passes 3/3 alone, passed in rounds 1–3, and no file under `viewer/pages/` or that spec changed since `4dc3170`.

Known issue outside this feature, seen during round 3: a verifier that ends a turn while its suites run in the background has that message taken as its report and is marked finished (the report-on-first-turn-end rule predates this feature). Round 4's verifier briefs ask for foreground runs.

### Remediation 4 — 2026-11-15

Round 4 on `51657bb`: Codex verifier FAIL. A prepared Codex limit event delivered after its `limited_until` had passed was treated as an ordinary turn end (`viewer/app/sessions.js:294` acted only on a future limit), so the partial text became the verifier's result, no `Continue.` was sent, and the real report was dropped. The gap's fourth path; sent to the lead, who chose a rule about the turn instead of the clock (D18, under Collin's D17 decision). The round 4 Claude verifier was stopped before reporting because the commit it checked was superseded. Fixed on branch at `df19cdf`:

| Gap | Fix (file:line) | Test |
|---|---|---|
| §5 limit recovery, late delivery (D18) | `viewer/app/sessions.js` `event()`: `limitEnded` is a `limit-hit` or any event whose `reading` carries `limited_until`; a limit-ended turn never runs the report path; a past `limited_until` on arrival queues `Continue.` at the front and delivers it, with no hold stored; a future one holds as before | `viewer/test/app-balancer.test.js` "<reviewer/verifier/worker>: <live/late/spooled retry> limit-ended delivery" (no result card for the partial text, `Continue.` submitted, one result card with the real report after; duplicate `delivery_id` handled once), plus the control case where a plain turn end still reports |

Lane: R6 codex standard (gpt-6.1-terra).

Validation at `df19cdf`, sequential:

```
$ bash sensitivity/test/run.sh -> RESULT 64 passed, 0 failed
$ bash seen/test/run.sh        -> RESULT 21 passed, 0 failed
$ bash codex/test/run.sh       -> RESULT 72 passed, 0 failed
$ bash install/test/run.sh     -> RESULT 90 passed, 0 failed
$ bash machine/test/run.sh     -> # pass 82  # fail 0
$ node --test viewer/test/*.test.js
not ok 206 - a starter that loses the freed port registers through the new holder
# tests 321
# pass 320
# fail 1
$ npm --prefix viewer run test:browser
  2 failed
    [chromium] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
    [firefox] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
  2 skipped
  508 passed (1.5m)
```

The two failures are the same ones on `main` (above).

### Round 5 — 2026-11-15

Both verifiers PASS on `f559674` (Claude and Codex, top tier). Observations they raised that the Spec does not cover, left as residual risks:
- A promoted waiting session whose machine start then fails is marked `failed` silently: `retryWaiting` swallows the error and `pollDead` only watches live sessions, so the starter is not told (a direct start returns the error).
- The thread page's waiting line maps only `claude` and `gpt` to labels (`viewer/pages/thread.js:594-596`), like the Models editor's options: a third CLI edits these too.
- Flaky under the full browser run, passing alone: Firefox `app-settings.spec.js:61` (3/3 alone, file 28/28).
