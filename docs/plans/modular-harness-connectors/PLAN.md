---
slug: modular-harness-connectors
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-22
---

# Make harness connectors modular

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

**Map:** `MAP.md` and `docs/maps/harness-connector-dispatch.md` (current inventory of every
name-based branch, with file:line).

## Open Questions

_None._

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is thorough | Chosen on the mode card | user |
| 2 | The settings page gets the tool list and per-tool details from the hub instead of its own copy (`viewer/pages/settings.js:15-16`) | A second hand-kept list is exactly what this refactor removes | defaulted |
| 3 | `codex/model.sh` reads its provider list and default pins from the same registry data (via a generated or shared JSON file), not its own tuple (`codex/model.sh:14-38`) | Same reason; bash/python cannot import the JS table directly | defaulted |
| 4 | A connector must provide: launch, ready detection, first message, turn-end detection, transcript binding and chat parsing, login and login status. Everything else (usage probe, spend, live account switch, aside turns, effort levels, preflight, version check, startup diagnostics) is optional and declared; the app treats an undeclared optional feature as "not supported" the way it does today for tools that lack it | Lets a new tool be added minimally without silently missing required pieces | defaulted |
| 5 | A conformance test loads every connector and registry entry and fails on a missing required piece or an undeclared capability being used | In IDEA.md's "What good looks like" | defaulted |
| 6 | Behaviour is pinned before moving code: existing tests stay green, and each of the five tools gets characterization tests for the branches being moved where none exist | IDEA.md constraint: no behaviour change | defaulted |
| 7 | One pull request; no new tool added | Thread scope; IDEA.md Not doing | defaulted |
| 8 | One folder per tool: `connectors/<cli>/` holds both halves (machine and app), its install recipe, settings-page details and model defaults | Adding a tool really is one connector | user |
| 9 | Folders are named by CLI (`claude`, `codex`, `agy`, `kimi`, `pi`); the manifest carries the provider id (`claude`, `gpt`, `gemini`, `kimi`, `openrouter`). Stored ids (settings, accounts, session records, `only_ai`, `--provider`) do not change | Saved state and running sessions must keep working (IDEA.md constraint) | defaulted |
| 10 | `machine/hook.sh` keeps its path and its `<cli> <session>` arguments; CLI-specific payload reading moves into each connector's machine part, called from a generic hook path | Account homes of running sessions and CLI settings files already point at that path | defaulted |
| 11 | Live smoke tests (`test-support/smoke/`) stay limited to Claude and GPT; they only read the tool list from the registry where they list names | Making live smoke generic is new work, not cleanup | defaulted |
| 12 | Supersedes 11: the Kimi and Pi smoke scripts exist and import adapter paths; they are updated to the new connector paths. `live.sh`'s Claude/GPT scope is unchanged | 11's premise was wrong | review-round-1 |
| 13 | Registry data for non-JS callers (`codex/model.sh`, `install.sh`) is a committed generated file `connectors/registry.json`, kept in sync by a test, instead of calling `node` at run time | The hub runs `model.sh` without the login PATH, so a bare `node` call can fail | review-round-1 |
| 14 | Each tool's model-discovery code moves into `connectors/<cli>/models.py`, loaded by `model.sh` by file path | Otherwise a new tool with a new discovery method still edits `model.sh` | review-round-1 |
| 15 | The hub loads only `manifest.js` and `hub.js`; `machine.js` is loaded only by the machine service, its libs and tests | Today the hub never loads machine code | review-round-1 |

## Spec

A pure refactor. Every one of the five tools (Claude Code, Codex, Antigravity, Kimi Code,
Pi for OpenRouter) behaves exactly as before; the change is where code lives and how the
rest of the code asks about a tool. The current inventory of name-based branches, with
file:line, is `docs/maps/harness-connector-dispatch.md` ("Dispatch and capability
inventory"). That inventory is a starting list, not complete: the guard test (S6) is the
definitive list, and every hit it reports is in scope and gets one of the S4 treatments.
Known items missing from the inventory are named in S4.

### S1. Layout

```
connectors/
  index.js            registry: list() of manifests (ordered), byCli(cli), byProvider(id);
                      machine(cli) and hub(cli) require that half on first use
  README.md           the guide for writing a connector (S7)
  contract.js         required/optional members and capability names; validate(connector)
  <cli>/              one folder per tool: claude, codex, agy, kimi, pi
    manifest.js       plain data, safe to load anywhere (S2)
    models.py         this tool's model discovery for codex/model.sh (S5)
  registry.json       generated from the manifests by export.js, committed (S5)
  export.js           writes registry.json; --check exits 1 if it is stale
    machine.js        the machine half (today's machine/adapters/<cli>.js, plus moved branches)
    hub.js            the app half (chat parsing, report picking, usage display, model rules)
    (helpers)         anything else the tool needs (e.g. pi/extension.js, pi/guard.js)
```

- `connectors/` sits at the repository root. `machine/` and `viewer/app/` require it by
  relative path; every machine runs from a full clone (`install.sh:439`), so no packaging
  changes. `connectors/` must not require anything under `viewer/`; a connector's
  `machine.js` may require `machine/lib/*` and `machine/adapters/common.js` helpers.
- `machine/adapters/` is removed except `common.js`, which moves to `connectors/common.js`
  (`machine/lib` callers updated). `machine/adapters/index.js` is deleted; its callers use
  `connectors/index.js` (`byCli(cli).machine`).
- `viewer/app/providers.js` keeps its exports (`PROVIDERS`, `DISPLAY_NAMES`, `providerOf`,
  `cliOf`) with identical values, now built from the manifests, so existing importers and
  `card.js` validation are unchanged.
- Registry order is `claude, codex, agy, kimi, pi`, so `Object.keys(PROVIDERS)` stays
  `claude, gpt, gemini, kimi, openrouter` (settings lists, `codex/model.sh` output). Registry
  order is a listing order only, never placement policy: see `placement` in S2.
- Loading: the hub (`viewer/app/`) uses only `list()`, manifests and `hub(cli)`; it never
  calls `machine(cli)`. The machine service calls `machine(cli)`. Validation of a half runs
  when that half is first loaded, and the contract test (S6) loads and validates both halves
  of every connector.

### S2. Manifest (data only)

Each `manifest.js` exports a plain object, no functions and no requires of other modules:

- `cli`, `provider`, `label`, `displayName` — today's values from `providers.js`.
- The existing flags `effort`, `typesRoleMessage`, `singleAccount`. `asideFork` and
  `preflight` are not stored separately: `providers.js` derives them from
  `capabilities.aside` and `capabilities.preflight`, so each fact is written once.
- `capabilities`: an object of booleans naming the optional features in S3, true only for
  the tools that have them today.
- `install`: today's recipe from `machine/lib/harness-recipes.js` and binary name and label
  from `machine/lib/harness-install.js`.
- `settings`: what `viewer/pages/settings.js` shows per tool today (model placeholder,
  effort choices, permission choices, account policy text, setup and install links).
- `models`: what `codex/model.sh` holds per provider today (default pins per tier, model
  name format, effort levels).
- `placement`: the policy data the hub uses today, giving exactly today's results:
  rank in the fresh-settings default `worker_order` (`viewer/app/settings.js:54`, which
  today puts GPT before Claude), whether the tool counts as already seen when saved
  settings have no `worker_order_seen` (today Claude and GPT, `settings.js:280`), and
  `auto: false` for a tool that is never added to automatic placement and is only appended
  when explicitly requested (today OpenRouter, `settings.js:281`, `viewer/app/balancer.js:97`).
  The settings migration logic itself is unchanged.
- `shortName`: the name used in machine messages where it differs from `displayName`
  (today Pi: "Pi"), so machine wording stays byte-identical.
- `asideParentField`: the session field holding the conversation id an aside forks from
  (`viewer/app/asides.js:41`; today `cli_session_id`, `codex_thread_id`, `cli_session_id`,
  `agy_conversation_id`).

`connectors/index.js` writes nothing at load.

### S3. Contract and capabilities

Required machine members (every tool has these today): `command`, `firstMessage`,
`readyText`, `answerPrompts`, `findTranscript`, `loginEnv`, `seed`, `loginCommand`,
`parseLogin`, `loginStatus`, plus turn-end detection by exactly one of `hookEvent`
(hook-driven) or `turnPoller` (log-polled, today only Kimi).

Required hub members: `parseChat` (today's per-CLI parser in `viewer/app/chat.js`) and
`pickReport` (today's per-CLI last-report selection, `viewer/app/chat.js:270-299,369-375`,
`viewer/app/sessions.js:435-450`).

Optional members, each paired with a capability flag of the same meaning:

| Capability | Members | Today |
|---|---|---|
| `usageProbe` | `usageProbe` (the machine usage endpoint, `machine/service.js:2282-2286`) | claude, codex, kimi |
| `usageEvents` | `usageFrom` (usage carried in hook payloads, `machine/service.js:1641`); without it the service ignores usage in that tool's events | claude, codex |
| `preflight` | the Codex preflight (`codex/preflight.sh`, `viewer/app/balancer.js:59`, Ready check) | codex |
| `sandbox` | `sandboxed(session)`: true when the session's tools run sandboxed (today Codex with `codex_mode !== 'unrestricted'`). Drives screen command wrapping (`machine/lib/screen.js:223`, via a `sandboxWrap(command)` member), Windows launch denial and status (`machine/lib/win.js:436,452,459`, `machine/lib/win-prompt.js:9`), for both new and recovered sessions | codex |
| `restartLoss` | `restartLoss(session)`: after a machine restart, returns `{ reason, stopNow }` for a session that cannot be re-attached; `reason` is today's exact text and `stopNow` today's timing (Pi: "Lost track of this Pi session after a machine restart; restart it", stopped at once, `machine/service.js:563,568,1097`; Kimi: "Lost track of this Kimi Code session after a machine restart; restart it", ended on its polling path, `:564,1102`) | kimi, pi |
| `spend` | `spend` | pi |
| `liveSwitch` | `usual` + switch support | claude, codex |
| `aside` | `asideArgv`, plus manifest `asideParentField` (`machine/lib/aside-turns.js:61-147`, `viewer/app/asides.js:41`) | claude, codex, pi |
| `versionCheck` | `checkVersion` | kimi, pi |
| `steps` | `readSteps` (tool-call tailing / vocabulary from `machine/lib/steps.js`) | as today |
| `prepare`, `sessionNameEnv`, `promptText`, `retryStartupEnter`, `onTurnEnded`, `loginCwd`, `loginPrompt`, `loginDone`, `codeNeedsPrompt`, `resolveCli`, `redact` (this tool's transcript and event redaction only, see S4) | same names | as today (`docs/maps/harness-connector-dispatch.md`, "Adapter boundary") |

Required hook-driven member: `hookInput` (S5).

`contract.js` exports `validate(connector)`: it throws, naming the tool and member, when a
required member is missing, when a capability flag is true without its members, or when a
member exists without its flag. The registry validates every connector at load.

### S4. Replacing name checks

Outside `connectors/`, no source file may compare a cli or provider value to a tool name
literal or hold a hand-written list of tool names. Each such branch in the inventory
becomes one of:

1. A capability check (`connector.capabilities.liveSwitch`), for "does this tool support X"
   — e.g. `machine/service.js:870` live switch, `:2282-2286` usage probe,
   `viewer/app/usage-poll.js:17,26`, `viewer/app/sessions.js:627`.
2. A call to an optional member, for tool-specific behaviour — e.g. version gate
   (`machine/service.js:805-806,839`), lost-session message after restart (`:563-568,1097,1102`,
   becomes the `restartLoss` capability in S3), pane capture options (`:601`),
   transcript reading and identity checks (`:1478-1489`, `:1554`), Kimi polling
   (`:1076-1162`, `:2443`), Codex step tailing (`:1167`), Claude settings/MCP handling
   (`:940-1003`), login differences (`:1740-1794`), Pi completion and spend (`:1618-1627`,
   `:2268-2293`).
3. A manifest field, for data — labels, defaults, install recipes, settings details,
   model pins, reviewer choices (`viewer/app/routes.js:313-331,378`,
   `viewer/app/settings.js:36-40,54,238,280-282,323,430-440`, `viewer/app/usage.js`,
   `viewer/app/balancer.js:59,97`, `viewer/app/ready.js:29-68`).

Where today's behaviour differs between tools in a way no existing name explains, the
implementer adds a capability or optional member with a plain name and lists it in
`contract.js` and the guide, rather than keeping the name check.

Known branches missing from the map's inventory: browser pages `viewer/pages/threads.js:15`
and `viewer/pages/thread.js:4` (`PROVIDER_LABEL`), `viewer/app/asides.js:41`,
`machine/lib/aside-turns.js:61-147`, the Codex sandbox checks (`sandbox` capability),
`machine/lib/statusline.js` (S5), and `test-support/smoke/` (S6).

**Shared output scrub stays shared.** Pane capture and sign-in output are scrubbed of
OpenRouter keys for every tool today (`machine/service.js:603,1757,1763`). That scrub moves
to one shared function (in `connectors/common.js`, using the Pi connector's key pattern)
applied to all panes and login output regardless of tool; it is not an optional per-tool
member. Only transcript lines and Pi events use the Pi connector's own `redact`
(`:1489,1618-1622`, `machine/lib/aside-turns.js:80,97`).

Wording users see stays byte-identical (error messages, labels, settings text).

### S5. Non-JS callers

- `machine/hook.sh` keeps its path and accepts the same arguments (Decision 10). It no
  longer branches by tool: it execs a new `machine/lib/hook-in.js` with its tool argument
  and all its arguments, leaving stdin unread. `hook-in.js` calls the connector's
  `hookInput({ argv, env, readStdin })` to get `{ session, payload }`; `readStdin()` reads
  stdin to EOF and is called only by tools that use stdin (Claude, Pi, Antigravity). Codex
  takes its payload from the last argument and never reads stdin, so a notify with stdin
  left open posts at once. Antigravity takes the session from `WHEELCHAIR_SESSION_NAME`
  when the argument is absent and exits 0 when neither is set. `hook-in.js` then posts
  through `hook-post.js` exactly as today.
- `machine/lib/hook-post.js` keeps its current command line (`<state> <token> <kind>
  <session>`, payload on stdin) because `machine/lib/statusline.js:28` calls it directly
  for running Claude sessions; the statusline path is unchanged. Unknown tools still exit 64; a missing token still
  exits 0 silently; spooling is unchanged. `hook.sh` must stay bash 3.2 compatible (macOS CI). `hookInput` becomes required for hook-driven tools.
- `connectors/registry.json` is generated by `node connectors/export.js` from the
  manifests and committed; `node connectors/export.js --check` fails when it is stale, and
  the contract test runs that check (Decision 13).
- `codex/model.sh` reads its provider list, default pins, model formats and effort levels
  from `connectors/registry.json` with Python's `json`, never by running `node`. Each
  tool's model discovery (today inline, e.g. `kimi_models` at `codex/model.sh:240-270`)
  moves to `connectors/<cli>/models.py` exposing `discover()` with the same return value;
  `model.sh` loads it by file path with `importlib.util.spec_from_file_location` (it runs
  under `python3 -I`, so not via `sys.path`). A tool without `models.py` has no discovery.
  The command-line interface and output of `model.sh` are unchanged.
- `install.sh` detection, version checks and "harness found" lines read the recipes from
  `connectors/registry.json` (via `python3`, already required). `hook.sh` and install
  scripts stay bash 3.2 compatible.
- Browser pages get the tool list, labels and `settings` details from the hub (Decision
  2): add a `tools` array (manifest data minus `install` and `models`) to the response the
  settings page already loads, and serve the same array to the threads and thread pages
  through whatever route they already load their data from. Delete the pages' own copies
  (`viewer/pages/settings.js:15-16`, `threads.js:15`, `thread.js:4`) and per-tool branches.
  Labels shown stay identical (`thread.js` and `threads.js` show "OpenRouter", the
  `label` field).

### S6. Tests

- Before moving any branch, add characterization tests for branches with no current test
  (coverage list: map, "Coverage and CI"). Each pins today's observable result per tool.
- `machine/test/adapters-loaded.test.js` iterates the registry instead of a fixed list.
- `test-support/smoke/kimi-live.js`, `pi-aside-live.js` and `pi-guard.js` require the new
  connector paths; `live.sh` scope is unchanged (Decision 12).
- New `machine/test/connectors-contract.test.js` (the machine suite runs only `machine/test/*.test.js`): every registered
  connector passes `validate` for both halves; every folder under `connectors/` that has a
  `manifest.js` is registered and every registry entry has a folder; `cli` and `provider`
  ids are unique; `export.js --check` passes; a fake connector missing a required member, or with a flag
  but no member, is rejected with a message naming it; `providers.js` exports equal a
  frozen snapshot of today's values.
- New name-check guard test: scans `machine/`, `viewer/app/`, `viewer/pages/`, `install.sh`,
  `codex/model.sh` and `test-support/` except `test-support/smoke/` (excluding test files and
  `connectors/`) for string literals equal to a tool's
  cli or provider id used in a comparison or list, and fails listing each hit. An explicit
  allowlist in the test may hold lines that are not about the tool (e.g. a model name or a
  URL containing the word), each with a one-line reason.
- Existing tests move with their code or keep working; none is deleted without its
  assertions moving.

### S7. The guide

`connectors/README.md`: what a connector folder contains, every required and optional
member with its signature and when it is called, every capability and what the app does
without it, how turn end works (hook vs poller), and a checklist for adding a tool (folder,
registry line, install recipe, settings details, model defaults and `models.py`,
placement data, regenerating `registry.json`, tests). Update
`machine/AGENTS.md`, `viewer/AGENTS.md`, `machine/API.md` and `viewer/app/API.md` where
they name adapter paths or list tools; `protocol/app/*.md` provider lists stay as they are
(they describe the user-facing names, which do not change).

### Non-goals

No new tool; no change to anything a user sees, any stored file format, the hub API's
existing fields, `only_ai` / `--provider` values, or the live smoke scope (Decision 11).

### Validation

```
bash machine/test/run.sh          # from the repository root; hook fixtures resolve paths from cwd
(cd viewer && npm test && npm run test:browser)
bash install/test/run.sh
bash codex/test/run.sh
node connectors/export.js --check
grep -rnE "adapters/(index|claude|codex|agy|kimi|pi)" machine viewer codex install.sh test-support  # expect no hits
```

All must pass with no test deleted. Additionally `node -e "console.log(JSON.stringify(require('./viewer/app/providers')))"` prints
the same output on `main` and on this branch.

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them. Rare paths per `protocol/app/realism.md` land here in every mode, with round
`review-round-N`, `verification-N` or `lead-check`.

| Risk | Why accepted | Round |
|------|--------------|-------|

## Check Once Built

Review findings only the built code can settle, per `protocol/app/realism.md`. Verifiers
check each row against the build; a listed row is settled for later review rounds and
stays as review history.

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

### Round 1 — 2026-11-22

**Lanes:** intent — claude / claude-opus-5-5; mechanics — gpt / gpt-6.2-sol; cross-family: yes.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most.

<!-- Round 2+: list what changed since the previous round; that list scopes the reviewers. -->

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | blocking | Registry order used as default worker order changes placement; OpenRouter must stay out of automatic placement | upheld | S1 order is listing only; S2 `placement` data reproduces `settings.js:54,280-281`, `balancer.js:97` |
| mechanics | blocking | Lost-session message via `displayName` breaks byte-identical text; Pi stop timing differs from Kimi | upheld (major; same as intent finding) | S3 `restartLoss` capability with exact text and timing; S2 `shortName` |
| intent | major | Same lost-session `displayName` contradiction | upheld | merged with the row above |
| mechanics | blocking | Validation `cd machine && ./test/run.sh` breaks hook fixtures that resolve from cwd (`service.test.js:248`) | upheld | Validation runs `bash machine/test/run.sh` from the repository root |
| mechanics | major | Statusline calls `hook-post.js` directly (`statusline.js:28`) | upheld | S5: `hook-post.js` command line unchanged; new dispatch lives in `hook-in.js` |
| mechanics | major | Buffering stdin would stall Codex notify | upheld | S5: `readStdin()` called only by stdin tools; Codex never reads it |
| mechanics | major | Pane/login scrub of OpenRouter keys applies to every tool; per-connector `redact` would leak | upheld | S4: shared output scrub stays shared |
| mechanics | major | `node` call from `model.sh` fails without login PATH in the hub | upheld | Decision 13: committed `registry.json`, read with Python |
| mechanics | major | Codex sandbox checks missing from inventory and capabilities | upheld | S3 `sandbox` capability |
| intent | minor | Same Codex sandbox gap | upheld | merged with the row above |
| mechanics | major | Kimi/Pi smoke scripts import removed adapter paths | upheld | Decision 12; S6 smoke path updates; validation grep covers `test-support` |
| intent | major | Same smoke-script gap; Decision 11 premise wrong | upheld | merged with the row above |
| mechanics | minor | `usageProbe`/`usageFrom` coupled though called independently | upheld | S3 split into `usageProbe` and `usageEvents` |
| mechanics | minor | Contract test misses unregistered folders and duplicate ids | upheld | S6 both-direction and uniqueness checks |
| mechanics | minor | Browser suite missing from validation | upheld | Validation adds `npm run test:browser` |
| intent | minor | `threads.js`, `thread.js` label tables and `asides.js` parent-field map not covered | upheld | S5 `tools` array for all pages; S2 `asideParentField` |
| intent | minor | Model discovery stays in `model.sh`, so new tools still edit it | upheld | Decision 14: `connectors/<cli>/models.py` |
| intent | minor | `asideFork`/`preflight` duplicate capability flags | upheld | S2: derived from capabilities |
| intent | minor | Hub would load every `machine.js` | upheld | Decision 15; S1 lazy halves |

Reported severity is the reviewer's opinion; the lead verdict
(`upheld`/`downgraded`/`declined`/`accepted-risk`/`check-once-built`/`user-decision`) is what gates the
exit. Downgrades and declines cite evidence.

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

Free-form running notes: deviations discovered mid-implementation, scope events,
anything a future session needs that fits nowhere above.
