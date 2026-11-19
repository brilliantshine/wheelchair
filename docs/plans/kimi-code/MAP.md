# Kimi Code: current provider wiring

Checked against `f3d3409471d4949874004f629b4c989cd15de0e4` (origin/main); source in this worktree matches that commit in the covered code. See `docs/maps/agent-provider-flow.md` and `docs/maps/app-provider-placement.md` for the reusable flows.

```text
Settings models + accounts -> provider placement -> machine adapter -> kimi-like CLI
  -> role message + hook -> transcript binding and copy -> chat + agent report
```

Gemini means provider `gemini`, displayed as Antigravity and launched as `agy`, not the Gemini CLI (`viewer/app/providers.js:3`; `machine/adapters/agy.js:30-34`). Its adapter owns settings, readiness, hook translation, transcript binding and login; the hub separately owns model selection, accounts and presentation (`machine/adapters/agy.js:10-65`; `viewer/app/sessions.js:106-108`; `viewer/app/settings.js:34-37`). A Kimi integration needs its actual CLI contract established: this map does not infer that Kimi has Antigravity's hooks, login, account model or transcript format.

The installer currently detects only Claude and Codex, exits when neither is present and builds the service PATH from only those binaries (`install.sh:40-48,368-371`). Thus an `agy`-only machine cannot install through this script today. Model initialization is gated on Codex being present (`install.sh:107-111`); `codex/model.sh` nevertheless owns pins for all three providers (`codex/model.sh:14-31`). Codex preflight is a token-refresh path, called for providers flagged for preflight, not a generic login check (`viewer/app/providers.js:3`; `viewer/app/sessions.js:242-244`; `machine/service.js:1491`; `codex/AGENTS.md:5-17`). Ready checks the thread's CLI, installed status, and an unpaused signed-in account, not every provider (`viewer/app/ready.js:29-58`).

## Hard-coded provider and CLI lists

- Registry and launch: `viewer/app/providers.js:3`; `machine/adapters/index.js:5`; launch validation messages and recovery detection `machine/service.js:394,563,582`; explicit status fields `machine/service.js:1155-1162`; shell hook dispatch `machine/hook.sh:6,15-32`.
- Transcript and lifecycle: `viewer/app/chat.js:175-203,228-232`; conversation IDs `viewer/app/sessions.js:552,722` and `viewer/app/asides.js:41`; aside support is limited to Claude/GPT `machine/lib/aside-turns.js:61,95`; usage polling and probe accept Claude/GPT only `viewer/app/usage-poll.js:17,26`, `machine/service.js:1480`. These are capability restrictions as well as lists, so inclusion requires actual support.
- Settings: default worker order, account plan weights and migration fallback `viewer/app/settings.js:34-37,207-219`; model option sources `viewer/app/settings.js:271-279`; model and review validation `viewer/app/routes.js:243-249,299`; browser provider labels, effort choices, review options, plans and names `viewer/pages/settings.js:15-16,545,941-946`; single-account UI exclusions `viewer/pages/settings.js:1212,1245-1246`; thread labels `viewer/pages/thread.js:3`, `viewer/pages/threads.js:14`.
- Model pins: provider tuple, defaults, usage text and parser regex `codex/model.sh:14-31,40-41,80`. Installer presence and PATH lists `install.sh:40-48,128-130,368-371`; legacy hook cleanup is specifically Claude/Codex `install/unseen.py:10-11`.
- Protocol: provider flags and review-family instructions `protocol/app/lead.md:59-60,117,261,427`; `protocol/app/sub-lead.md:113-114,224-228`. The model lookup example omits Gemini (`protocol/app/sub-lead.md:125`). `protocol/app/AGENTS.md:3` lists role-prompt delivery. API descriptions also enumerate provider behavior `machine/API.md:10,21,92`; `viewer/app/API.md:148`.
- Graph harness attribution uses a separate Claude/Codex/other list, not the provider registry (`viewer/server.js:1336,1609,1644,1932`); assess whether Kimi needs a distinct graph harness label.

## Tests that enumerate providers

Machine fixtures and integration cover CLI stubs, default accounts, prompt delivery and Antigravity hooks/login (`machine/test/service.test.js:36,886,964,1268-1302`; `machine/test/accounts.test.js:77-129`). Model and installer fixtures assert exact pins and presence behavior (`codex/test/run.sh:47-52,89-113`; `install/test/run.sh:255-267,357-358`). Hub and browser fixtures assert exact default order, review choices, accounts and models (`viewer/test/app-settings.test.js:26-27,329-358`; `viewer/test/app-balancer.test.js:62-70`; `viewer/test/app-accounts.spec.js:33-34,110-112,298-301`; `viewer/test/app-settings.spec.js:120`). Aside and usage tests encode existing limitations (`machine/test/aside-turns.test.js:18-28`; `viewer/test/app-asides.test.js:151`; `machine/test/service.test.js:1302`); graph harness tests enumerate their separate list (`viewer/test/registration.test.js:81,246`).

## What I did not look at

Kimi's documentation, executable, authentication or live behavior; real credentials and tmux sessions; full browser behavior and every individual provider-specific test assertion. No implementation or test was run.
