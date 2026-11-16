# Map: Antigravity CLI

Checked against: `20074341b6b1be157c09f8d248d3965645feece9` (origin/main). See [agent-provider-flow](../../maps/agent-provider-flow.md) for the traced implementation and covered files. Existing placement and session maps changed since their recorded commits; this map uses current source instead.

```text
Settings sign-in -> account and machine status -> provider placement -> model pin
    -> tmux adapter -> hooks and transcript -> chat, usage and next turn
```

The registry, model store, machine adapter, login UI, transcript parser and lifecycle bridge all participate; adding one registry entry alone does not make a provider runnable (`viewer/app/providers.js:3`; `codex/model.sh:14,75`; `machine/adapters/index.js:5`; `viewer/app/chat.js:172`; `machine/hook.sh:16-26`). Current flow, evidence and sign-in details are in the linked map.

## Two-provider blast radius

These are the hard-coded production and protocol sites found by searching provider names and inspecting the requested paths. Provider-specific code can be intentional; each site needs an explicit decision, not necessarily the same change.

- Registry and placement: `viewer/app/providers.js:3-5`; defaults, account records, provider orders and review-family normalization in `viewer/app/settings.js:25-27,171-208`; constraint and single-family/`both` semantics in `viewer/app/balancer.js:27-80`; model, GPT effort ceiling and preflight handling in `viewer/app/sessions.js:19-30,65-71,141-162`; thread-CLI readiness and legacy Codex preflight fallback in `viewer/app/ready.js:18-56`.
- Validation and UI: `viewer/app/routes.js:193-210,240-242,337-344` hard-codes provider effort and review choices; `viewer/pages/settings.js:15-16,170,221,383-447,839-843,908-981,1092-1108` has provider list, labels, model/effort, permission, review and account controls. Provider-specific display also appears in `viewer/pages/thread.js:140,788-790` and `viewer/pages/threads.js:14`.
- Machine and hooks: registry and adapters `machine/adapters/index.js:5`, `machine/adapters/claude.js:5-31`, `machine/adapters/codex.js:5-38`, `machine/adapters/common.js:9-17`; Claude/Codex-only hook input `machine/hook.sh:16-26`; status returns named `claude` and `codex`, recovery infers one of two, and preflight is Codex-specific (`machine/service.js:303-309,940-954,1049`). Launch errors also name only two (`machine/service.js:443-444,462-463`); Claude-only style preview is at `machine/service.js:956-969`. Claude statusline handling is in `machine/statusline.sh` and `machine/lib/statusline.js`.
- Transcript and aside: parser registry and extractors `viewer/app/chat.js:172-199`; Claude-vs-Codex parent ID `viewer/app/asides.js:38-39`; explicit provider validation, adapter selection, fork and result parsing `machine/lib/aside-turns.js:38-41,72-107`. Session ID propagation names only `cli_session_id` and `codex_thread_id` (`viewer/app/sessions.js:401,561`).
- Pins and preflight: `codex/model.sh:14-26,34-36,75-84,223-265,307-378` fixes providers, pin grammar, effort and GPT model-discovery behavior; `codex/preflight.sh` owns Codex refresh specifically (`codex/AGENTS.md:12-20`).
- Workflow: provider flag syntax and family comparisons in `protocol/app/lead.md:52-53,107-110,185-195,317-319`; worker/verifier policy in `protocol/app/sub-lead.md:82-102,192-199,215`. `both` currently means two review lanes; with three families, its meaning and selection of the other family require a decision. `protocol/app/reviewer.md:3` means two review *lenses*, not two providers. The Ready statement in `protocol/app/lead.md:82-83` contradicts current `viewer/app/ready.js:39-56`.
- Contracts and tests: `machine/API.md`, `viewer/app/API.md`, `machine/test/accounts.test.js:49-56`, `machine/test/fixtures/login/`, `codex/test/run.sh`, and `viewer/test/app-balancer.test.js`, `viewer/test/app-usage.test.js`, `viewer/test/app-accounts.spec.js` describe or exercise the existing providers and need corresponding review. The named code list is scoped to the searched machine, viewer, codex and protocol trees; it is not a claim that every repository test or document was inspected.

## Public Antigravity evidence

- Google's documented CLI command is `agy`. On remote SSH it prints an authorization URL; the user signs in in a browser and pastes the resulting authorization code into the CLI. That is the reverse direction from Codex's displayed device code. The docs describe local shared credentials and OS keyring; they do not establish isolated per-account directories or a device-code flow. [Google authentication documentation](https://antigravity.google/docs/install?tab=cli).
- `agy -p` runs one non-interactive prompt; `--output-format stream-json` emits NDJSON events including results and usage. `--input-format stream-json` paired with that output supports multiple turns, and `--conversation` resumes by ID. Authentication must already be available for no-terminal runs. [Google headless documentation](https://antigravity.google/docs/cli/headless/).
- Google documents workspace `.agents/hooks.json` and global `~/.gemini/config/hooks.json` for CLI hooks and identifies `~/.gemini/antigravity-cli` as its app data directory; hook payload examples include `transcriptPath` ending in `transcript.jsonl`. The precise CLI transcript row schema, hook event coverage needed for turn end and permission prompts, login status command, rate-limit windows, account isolation, and how to force SSH-style login from the machine service remain unverified. [Google hooks documentation](https://antigravity.google/docs/hooks).

## What I did not look at

No software was installed or run, no real sign-in was attempted, and no authenticated transcript or live hook payload was captured. Exhaustive repository-wide test and documentation behavior outside the cited scope was not inspected.
