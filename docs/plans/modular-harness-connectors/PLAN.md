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

## Spec

A pure refactor. Every one of the five tools (Claude Code, Codex, Antigravity, Kimi Code,
Pi for OpenRouter) behaves exactly as before; the change is where code lives and how the
rest of the code asks about a tool. The current inventory of name-based branches, with
file:line, is `docs/maps/harness-connector-dispatch.md` ("Dispatch and capability
inventory"); every item listed there is in scope.

### S1. Layout

```
connectors/
  index.js            registry: CONNECTORS (ordered), byCli(cli), byProvider(id), list()
  README.md           the guide for writing a connector (S7)
  contract.js         required/optional members and capability names; validate(connector)
  <cli>/              one folder per tool: claude, codex, agy, kimi, pi
    manifest.js       plain data, safe to load anywhere (S2)
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
- Registry order is `claude, codex, agy, kimi, pi`, matching today's provider order
  `claude, gpt, gemini, kimi, openrouter` wherever order is visible (settings lists,
  default worker order, `codex/model.sh` output).

### S2. Manifest (data only)

Each `manifest.js` exports a plain object, no functions and no requires of other modules:

- `cli`, `provider`, `label`, `displayName` — today's values from `providers.js`.
- The existing flags: `effort`, `preflight`, `typesRoleMessage`, `asideFork`, `singleAccount`.
- `capabilities`: an object of booleans naming the optional features in S3, true only for
  the tools that have them today.
- `install`: today's recipe from `machine/lib/harness-recipes.js` and binary name and label
  from `machine/lib/harness-install.js`.
- `settings`: what `viewer/pages/settings.js` shows per tool today (model placeholder,
  effort choices, permission choices, account policy text, setup and install links).
- `models`: what `codex/model.sh` holds per provider today (default pins per tier, model
  name format, effort levels, discovery method name).

`connectors/index.js` also writes nothing at load; a small script `connectors/export.js`
prints the manifests as JSON for non-JS callers (S5).

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
| `usageProbe` | `usageProbe`, `usageFrom` | claude, codex, kimi |
| `spend` | `spend` | pi |
| `liveSwitch` | `usual` + switch support | claude, codex |
| `aside` | `asideArgv` | claude, codex, pi |
| `versionCheck` | `checkVersion` | kimi, pi |
| `steps` | `readSteps` (tool-call tailing / vocabulary from `machine/lib/steps.js`) | as today |
| `prepare`, `sessionNameEnv`, `promptText`, `retryStartupEnter`, `onTurnEnded`, `loginCwd`, `loginPrompt`, `loginDone`, `codeNeedsPrompt`, `resolveCli`, `redact` | same names | as today (`docs/maps/harness-connector-dispatch.md`, "Adapter boundary") |

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
   (`machine/service.js:805-806,839`), lost-session message after restart (`:563-568`,
   becomes a manifest `displayName` in one shared sentence), pane capture options (`:601`),
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

Wording users see stays byte-identical (error messages, labels, settings text).

### S5. Non-JS callers

- `machine/hook.sh` keeps its path and accepts the same arguments (Decision 10). It no
  longer branches by tool: it passes its tool argument, all arguments and stdin to
  `machine/lib/hook-post.js`, which calls the connector's `hookInput({ argv, stdin, env })`
  to get `{ session, payload }` (Codex: last argument; Antigravity: session from
  `WHEELCHAIR_SESSION_NAME` when absent). Unknown tools still exit 64; a missing token still
  exits 0 silently; spooling is unchanged. `hook.sh` must stay bash 3.2 compatible (macOS CI). `hookInput` becomes required for hook-driven tools.
- `codex/model.sh` gets its provider list, default pins, model formats and effort levels
  from `node connectors/export.js` (Decision 3). Discovery code that differs per provider
  stays in `model.sh`, selected by the manifest's `models.discovery` name, not the provider
  id. Its command-line interface and output are unchanged.
- `install.sh` detection, version checks and "harness found" lines read the recipes via
  `node connectors/export.js`. Node is already required (`install.sh` checks it first).
- `viewer/pages/settings.js` (browser) gets the tool list and `settings` details from the
  hub (Decision 2): add them to the response the page already loads its settings from (or a
  new read-only route if none fits), and delete the page's own copy (`:15-16`) and per-tool
  branches.

### S6. Tests

- Before moving any branch, add characterization tests for branches with no current test
  (coverage list: map, "Coverage and CI"). Each pins today's observable result per tool.
- `machine/test/adapters-loaded.test.js` iterates the registry instead of a fixed list.
- New `machine/test/connectors-contract.test.js` (the machine suite runs only `machine/test/*.test.js`): every registered
  connector passes `validate`; a fake connector missing a required member, or with a flag
  but no member, is rejected with a message naming it; `providers.js` exports equal a
  frozen snapshot of today's values.
- New name-check guard test: scans `machine/`, `viewer/app/`, `viewer/pages/`, `install.sh`,
  `codex/model.sh` (excluding tests and `connectors/`) for string literals equal to a tool's
  cli or provider id used in a comparison or list, and fails listing each hit. An explicit
  allowlist in the test may hold lines that are not about the tool (e.g. a model name or a
  URL containing the word), each with a one-line reason.
- Existing tests move with their code or keep working; none is deleted without its
  assertions moving.

### S7. The guide

`connectors/README.md`: what a connector folder contains, every required and optional
member with its signature and when it is called, every capability and what the app does
without it, how turn end works (hook vs poller), and a checklist for adding a tool (folder,
registry line, install recipe, settings details, model defaults, tests). Update
`machine/AGENTS.md`, `viewer/AGENTS.md`, `machine/API.md` and `viewer/app/API.md` where
they name adapter paths or list tools; `protocol/app/*.md` provider lists stay as they are
(they describe the user-facing names, which do not change).

### Non-goals

No new tool; no change to anything a user sees, any stored file format, the hub API's
existing fields, `only_ai` / `--provider` values, or the live smoke scope (Decision 11).

### Validation

```
cd machine && ./test/run.sh
cd viewer && npm test
bash install/test/run.sh
bash codex/test/run.sh
node connectors/export.js | python3 -m json.tool >/dev/null
grep -rnE "adapters/(index|claude|codex|agy|kimi|pi)" machine viewer codex install.sh  # expect no hits
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

**Lanes:** <family / model>; <family / model>; cross-family: <yes|no>.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most.

<!-- Round 2+: list what changed since the previous round; that list scopes the reviewers. -->

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

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
