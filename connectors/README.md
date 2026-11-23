# `connectors/` — one folder per agent tool

A connector holds everything wheelchair knows about one agent CLI: how to start it, how to
tell when it is ready and when a turn has ended, how to read its transcript, how to log it
in, and the text and defaults the Settings page shows for it. Nothing outside this folder
may compare a tool name to a literal; the rest of the code asks the registry
(`connectors/index.js`) for a manifest, a capability flag or a member instead. This file is
the guide for adding or changing a connector. Every claim here is checked against
`connectors/contract.js`, so when the two disagree, `contract.js` wins; fix this file.

The five connectors are `claude`, `codex`, `agy` (Antigravity), `kimi` and `pi`. Folders are
named by CLI; the manifest carries the provider id (`claude`, `gpt`, `gemini`, `kimi`,
`openrouter`). Stored ids (settings, accounts, session records, `only_ai`, `--provider`) are
provider ids and never change.

## What is in the folder

| Path | What it is |
|---|---|
| `index.js` | The registry. `list()` returns every manifest in listing order (`claude, codex, agy, kimi, pi`); `manifest(cli)` and `byProvider(id)` find one; `machine(cli)` and `hub(cli)` load and validate that half the first time it is asked for. Adding a tool means adding its name to the `names` array here. It writes nothing at load. |
| `contract.js` | The required and optional members, the capability names, `validate(manifest, half, mod)` for a half, and `validateManifest` / `validateRegistry` for the manifests. Its header comment lists the manifest fields. |
| `common.js` | Helpers the machine halves share: login folder seeding, login status, config folder lookup, the output scrub. |
| `hub-common.js` | Transcript-parsing helpers the hub halves share. |
| `export.js` | Writes or checks `registry.json` (see below). |
| `registry.json` | Generated from the manifests and committed. For callers that are not JavaScript. |
| `<cli>/manifest.js` | Plain data, safe to load anywhere: no functions, no requires. |
| `<cli>/machine.js` | The machine half. Only the machine service, its libraries and tests load it. The hub never does. |
| `<cli>/hub.js` | The app half: chat parsing and report picking. Loaded only by the hub. |
| `<cli>/…` | Any helper the tool needs, such as `codex/steps.js`, or Pi's `extension.js` and `guard.js`. |

A `machine.js` may require `machine/lib/*` and `connectors/common.js`. Nothing in
`connectors/` may require anything under `viewer/`.

## How the app calls a connector

Callers never reach a half any other way than `connectors.machine(cli)` and
`connectors.hub(cli)`, and they decide what to do from the manifest:

1. A capability flag, for "does this tool support X" (`manifest.capabilities.liveSwitch`).
2. An optional member, for tool-specific behaviour, called only if it exists
   (`adapter.loginPrompt?.(pane)`).
3. A manifest field, for data such as labels, defaults and install recipes.

If you find yourself wanting a `cli === 'name'` test outside `connectors/`, add a capability,
an optional member or a manifest field with a plain name, and list it in `contract.js` and
here. `machine/test/name-guard.test.js` scans for such tests and fails on each hit; see "Adding a tool" for what it detects.

## Machine half (`machine.js`)

### Required members

`contract.js` (`REQUIRED.machine`) makes `validate` throw, naming the tool and member, when
any of these is missing or not a function. `command` and `seed` are the ones people forget.

| Member | Signature | When the service calls it |
|---|---|---|
| `command` | `command(input, session, worktree, context)` returns `{ argv, loaded, settingsPath?, settings?, mcpConfig? }` | Building the launch for a new or resumed session. `context` carries `stateDir`, `promptPath`, `rolePrompt`, `mcp`, `tools`, `accountDir`, `kimiExecutable`, `wsl`, `mount`, `replaceEntries` and `resume`. Values from `launchContext` reach `command` only through these keys. |
| `firstMessage` | `firstMessage(input, promptPath, name)` returns the text typed once the tool is ready | Session start; the result becomes the session's pending first message. |
| `readyText` | `readyText(session, pane)` returns a boolean | Each readiness poll of a starting session's tmux pane. |
| `answerPrompts` | `answerPrompts(session, pane)` returns `{ step, keys }` or `null` | While a session is starting, to answer first-run screens (theme, trust, terms) with keystrokes. |
| `findTranscript` | `async findTranscript(session, accountDir)` returns a file path or `null` | Binding a session to the tool's own transcript file, and re-checking it. |
| `loginEnv` | `loginEnv(dir)` returns an environment object | Any spawn that must use an account folder: launches, logins, usage probes, asides. `dir` may be empty for the usual account. |
| `seed` | `seed(dir, accountId)` | Creating or reusing an account folder; links the tool's instruction file and writes `wheelchair-account.json`. |
| `loginCommand` | `loginCommand()` returns the argv for the sign-in command | Starting a login in tmux. May throw "… is not installed". |
| `parseLogin` | `parseLogin(pane)` returns `{ url, code, wantsCode }` or `null` | Each poll of a login pane, to find the sign-in link or code. |
| `loginStatus` | `loginStatus(dir)` returns `{ logged_in }` | Status checks of an account and after a login finishes. |

Plus exactly one turn-end member: `hookEvent` or `turnPoller` (see "How a turn ends").

### Optional members with no capability flag

These are called only when present; they need no flag in the manifest.

| Member | Signature | Purpose |
|---|---|---|
| `prepare` | `prepare(dir)` | Extra account-folder or config setup after `seed`, before launch or login (Antigravity merges its Stop hook into its config here). |
| `sessionNameEnv` | boolean | Set `WHEELCHAIR_SESSION_NAME` in the launch environment, for hooks that take the session from it. |
| `promptText` | `promptText(pane)` returns boolean | Watch a ready pane for a permission prompt the tool has no hook for; the service then posts a `prompt` event. |
| `retryStartupEnter` | boolean | Retry an Enter press while a session is starting (Pi). |
| `onTurnEnded` | `async onTurnEnded(session, event)` returns `{ ignored?, reading?, … }` | Tool-specific work when a `turn-ended` event arrives; `ignored: true` drops the event (Codex binds its thread id here). |
| `beforeTurnEvent` | `async beforeTurnEvent(service, session, event)` returns the event | Runs before a turn event is handled; may copy the transcript or rewrite the event (Pi). |
| `loginCwd` | `loginCwd(stateDir)` returns a folder | Where the login pane starts. |
| `loginPrompt` | `loginPrompt(pane)` returns keys or `null` | Answer a prompt inside a login pane. |
| `loginDone` | `loginDone(pane)` returns boolean | Recognise a finished login from the pane. |
| `loginResult` | `loginResult(record)` | A login outcome known without reading the pane. |
| `loginState` | `loginState(record, pane, captured, { liveTmux, account, kill })` | Replace the generic login state logic (Kimi and Pi). |
| `codeNeedsPrompt` | boolean | A login code is typed after checking the pane for the prompt (Pi). |
| `resolveCli` | `resolveCli()` returns an executable path or `null` | Find the executable; the service refuses to start a login or session when it is missing. |
| `redact` | `redact(value)` | The tool's own redaction of transcript lines, events and aside output (Pi). The shared output scrub in `common.js` applies to every tool regardless. |
| `stylePreviewArgv` | `stylePreviewArgv(model)` returns argv | The tool that runs the writing-style preview. Only the manifest with `stylePreview: true` (one at most) needs it. |
| `disableProjectServers` | `disableProjectServers(built, dropped)` | Record project tools that were dropped into the built launch settings. |
| `launchContext` | `async launchContext(service)` returns an object | Values merged into launch context; only the keys listed for `command` are copied to it (including Kimi's executable). |
| `launchPath` | `launchPath(service)` | Kimi's resolution of its launch executable and version. |
| `recordLaunch` | `recordLaunch(session, status)` | Store the version check result on the session at launch (Pi). |
| `startupCheck` | `startupCheck(session)` returns a reason or `null` | Why a session that never became ready ended, so the stop reason says more than "exited". |
| `failureNote` | `failureNote(session)` returns text | Extra note on a "stuck" event and failed-turn messages (Pi version warning). |
| `bindTranscript`, `spoolWaiting`, `validTranscript` | called with the service as `this` for the first two | Poll-based binding of a session to its log and checking it is still the same file (Kimi). |
| `stepVocabulary` | object | Tool names grouped by kind (`card`, `agents`, `web`, `files`, plus `fileSubstring` and `shellDescription`) used to classify tool calls into steps. |
| `asideNewId`, `asideModel`, `asidePrepare`, `asideMessage`, `asideResult`, `asideProblem` | see "Aside members" | Extra parts of an aside turn. |
| `checkPiVersion`, `piVersionStatus`, `checkKimiVersion`, `kimiLaunchPath`, `kimiVersionStatus` | tool-specific helpers | Named in `OPTIONAL.machine` because the service reaches them through the `versionCheck` and launch members; they are the tool's own business. |

### Capabilities and their members

A capability is a boolean in `manifest.capabilities`. `validate` checks both directions (and for `aside`, the RegExp type of `asideModel`): a
flag set to true needs every listed member to be a function, and a flag set to false must
have none of them. The registry validation also limits `preflight` to one tool.

| Capability | Members | What it enables | Without it |
|---|---|---|---|
| `usageProbe` | `usageProbe(dir, options)` returns a parsed usage reading | `POST /v1/usage` and the hub's usage polling run the tool's own usage query. The manifest `usage.probeWhileLive`, `usage.tryEveryMachine` and `usage.defaultProblem` tune how polling treats it. | The app never polls the tool's usage; the account shows no reading. |
| `usageEvents` | `usageFrom(raw)` returns `{ at, five_hour, week }` or `null` | Usage carried in hook or statusline payloads becomes a reading on the event. | Usage in that tool's events is ignored. |
| `preflight` | `preflightCommand(dir)` returns `{ file, args, env }` | `POST /v1/preflight` runs it; the hub's Ready check and balancer call it. At most one connector may have it (today Codex). | No preflight; the hub does not call it for that tool. |
| `sandbox` | `sandboxed(session)`, `sandboxWrap(command)` | Sessions that run sandboxed get screen commands wrapped, Windows launches denied, and the matching status text. | Sessions are treated as unsandboxed. |
| `restartLoss` | `restartLossReason()` returns the end-reason text | A session adopted from tmux after a machine restart gets this reason. The manifest `stopWhenEnded` flag goes with it: an ended session of the tool is stopped on the next poll. | Adopted sessions get no reason. |
| `projectTools` | `projectToolReason(name, entry)`, `projectToolFileWarning(servers)` | Project-tool checks ask the connector why an entry is skipped or whether the whole file is too large. `lib/project-tools.js` asks every connector with this flag. | Project tools are never skipped for this tool. |
| `recover` | `recognizePane(text)` returns boolean | After a machine restart the service identifies adopted tmux panes by asking connectors in manifest `recoverRank` order; the first match sets the session's `cli`. A pane matching none gets the tool with `recoverFallback: true`. | The tool's panes are not recognised and fall to the fallback tool. |
| `spend` | `spend(dir, now)` | `GET /v1/spend` reports offline spend (Pi reads OpenRouter usage logs). | No spend report. |
| `liveSwitch` | `usual()` | A running session can be switched to another account (`POST /v1/sessions/:name/switch`); `usual()` names the folder copied from. | A switch request for the tool is refused. |
| `aside` | `asideArgv(input, context)` returns argv; `asideResult(input, result)`; `asideModel`, a RegExp (not a function) | The tool can run headless aside turns. All three are required, and `validate` rejects an `asideModel` that is not a RegExp. Also set manifest `asideParentField` (the session field holding the conversation id to fork from, for example `cli_session_id`). | The app never offers asides for the tool. |
| `versionCheck` | `checkVersion(service, executable)`, `versionStatus(service, login)` | The service checks the installed version at launch and in status, and the hub shows the result. | No version gating. |
| `steps` | `readSteps(state, lines, ctx)` returns step events; `stepsReady(session)` returns boolean | Both are required. The service calls `stepsReady` before polling and reading steps to check whether tailing may start (Codex needs its thread id). The service tails the tool's transcript for tool-call steps (Codex). Hook-driven step events (Claude) do not need this flag. | The tool shows no steps from tailing. |

#### Aside members

An aside turn is a headless one-off run (`machine/lib/aside-turns.js`). With the `aside`
capability a tool also supplies: `asideModel`, a RegExp the requested model must match;
`asideNewId` (true when a fork needs a fresh session id); `asideResult(input, result)` to
turn the child's output into `{ state, reply, conversation_id, limit }` or a failure;
and optionally `asidePrepare(runChild, onSpawn)`, `asideMessage(input, prompt, message)` and
`asideProblem(problem, cli)`. Replies, stderr and failures pass through the tool's `redact`
when it has one.

### How a turn ends

The service must learn when a turn finishes. A machine half provides exactly one of:

- **`hookEvent(raw)`** for tools that run a command at the end of a turn. Return one event
  object, an array of them, or `null` to ignore the payload. Types the service understands
  include `turn-ended` (with `transcript_path`), `turn-failed`, `limit-hit`, `prompt`,
  `step`, `usage-source` and `context`.
- **`turnPoller(cli)`** for tools with no hook. The service calls it (with the service as
  `this`) on a timer. Kimi reads its wire log and posts events itself. It requires
  `bindTranscript`, `spoolWaiting` and `validTranscript`; hook-driven tools must not export them.

`validate` throws `hookEvent/turnPoller` unless there is exactly one. Two more rules follow:
a half with `hookEvent` requires the manifest's `hook.payload` (`stdin` or `last-arg`), and a
`turnPoller` tool must have no `hook` field at all.

The hook path is the same for every hook-driven tool. The tool's own config (or a launch
settings file) runs `machine/hook.sh <cli> <session>`. `hook.sh` needs `WHEELCHAIR_SESSION_TOKEN`
(it exits 0 without one) and execs `machine/lib/hook-in.js` with its arguments. `hook-in.js`
loads only the manifest and follows the manifest `hook` field:

| Field | Meaning |
|---|---|
| `hook.payload` | `stdin` reads stdin to the end; `last-arg` takes the last argument and never reads stdin (a Codex-style notify). Required for a hook-driven tool. |
| `hook.sessionFromEnv` | If true, a missing session argument falls back to `WHEELCHAIR_SESSION_NAME`, and with neither the hook exits 0. Defaults to false. |

It then posts through `machine/lib/hook-post.js`, which runs the connector's `hookEvent`. `hook.sh` exits 0 without a token before invoking `hook-in.js`. Without a session it exits 0 when `sessionFromEnv` is true and 1 otherwise. A tool without a manifest or without a `hook` field exits 64. A poller tool has no `hook` field. `hook.sh` keeps its path and
arguments because account folders and tool config files of running sessions point at it, and
it must stay bash 3.2 compatible.

## Hub half (`hub.js`)

| Member | Signature | When the hub calls it |
|---|---|---|
| `parseChat` | `parseChat(raw, thread, sessionName)` returns chat items | Rendering a session's transcript in a thread. Turns the tool's transcript text into the shared item shape; `connectors/hub-common.js` has the helpers. |
| `readReport` | `readReport(raw, payload)` returns `{ text, settled }` | Picking reviewer or verifier report text on delivery, and when the hub renders a thread. `settled: false` means the transcript has not caught up with the hook yet (Pi, when the entry named by `payload.entry_id` is absent); the delivery loop retries on its usual schedule and stops on the first settled read. |

Optional manifest `report.useHookText` (default true) says whether the reviewer/verifier delivery loop first takes the
report text from the hook payload; Pi sets it false. The hub never loads `machine.js`; code
the hub needs must be in the manifest or `hub.js`. There are no optional hub members
(`OPTIONAL.hub` and every capability's `hub` list are empty).

## The manifest (`manifest.js`)

A plain object, all values JSON. Regex fields are source strings, with a separate
`<field>Flags` string when flags are needed. A value of `null` means the option does not
apply. `validateManifest` in `contract.js` checks the types and throws `<cli>: <field>`.
"Required" means validation fails without it; "defaulted" means the field may be omitted and
the type is checked only when present. Unless a default is stated below, an omitted field is `undefined`. Readers apply the defaults named in this section; a minimal connector with every optional field omitted still loads the Settings page, routes and assets (`viewer/test/minimal-manifest.test.js`).

### Identity

| Field | Type | Required? |
|---|---|---|
| `cli` | string, the CLI and folder name | required |
| `provider` | string, the stored provider id | required |
| `label` | string, short name used on pages | required |
| `displayName` | string, full name used in prose | required |
| `shortName` | string, machine-message name when it differs from `displayName` | defaulted: `displayName` |
| `typesRoleMessage` | boolean | required |
| `singleAccount` | boolean | required |
| `capabilities` | object with a boolean for every capability name | required |

### Install (`install`)

| Field | Type | Required? |
|---|---|---|
| `install.command` | string, the shell recipe the install job runs | required |
| `install.binary` | string, the executable name | required |
| `install.lookup` | `path`, `absolute` or `fallback`: how the install job finds the binary afterwards | required |
| `install.label` | string, the name in the install job's Node-version message | required |
| `install.node` | string, minimum Node version the recipe needs | defaulted: no Node prerequisite |
| `install.versionArgs` | array of strings, or `null` to skip the version check | defaulted: `undefined` (passed to the version command) |
| `install.fallbackPath` | string, where the installer looks when the CLI is not on PATH | required and non-empty when `install.lookup` is `fallback`; otherwise defaulted: empty string in `install.sh` and `undefined` in the install job |
| `install.pathRank` | number or `null`, order the installer prepends CLI folders to the service PATH | defaulted: `null` ordering (last) |
| `install.sensitivity` | boolean, see the checklist | defaulted (false) |

### Settings page (`settings`)

`settings.modelPattern` (string), `settings.weights` (object with numeric `unknown`) and `settings.plans` are required. `settings.plans` is an array of `[key, label]` pairs of non-empty strings; it must include `unknown`, and every key must exist in `settings.weights`. Everything else is defaulted: `modelPlaceholder`,
`cliLabel`, `vendor`, `setupUrl`, `signInKind`, `modelError` (strings); `permissionMode`,
`accountWarning`, `familyHint`, `accountPolicy` (string or `null`); `permissionChoices`
(array of `[value, label]`); `reportedPlans`, `oldPlanWeights` (objects);
`modelHeadsUp`, `reviewFamily`, `scoutAgentTool`, `monoModelNames` (booleans); `keyPrompt`
(string); `modelOptions` (object). `modelPattern` is the browser's own model-name check and
differs from `models.format` and `models.hubPattern` on purpose, so each place keeps rejecting
what it does today. `monoModelNames` controls monospace styling for model selectors; `keyPrompt`
supplies the API-key sign-in hint, input label and placeholder.

`settings.modelOptions` says which models the Settings page offers in the model selector for
the tool. It has one of two shapes:

- `{ fixed: [[value, label], ...] }`: a fixed list of string pairs.
- `{ listedKey, listedShape, includePins }`: the choices come from the list the settings
  store holds under `listedKey`; `listedShape` is `strings` (a list of model ids) or
  `objects` (a list of model records); `includePins` (boolean, required) adds the tool's
  `models.pins` models to that list.

A tool with no `modelOptions` gets an empty list from the settings data; the Settings page
then shows only the slot's current model plus the "Not used" and "Other…" entries. Add it
whenever the tool has choices to show.

Defaults when a field is omitted (as implemented in `viewer/app/settings.js`, `viewer/app/routes.js`
and `viewer/pages/settings.js`): boolean fields are false; `permissionChoices` is `[]` where
used; `models.slotAliases` is `{}`; `models.effortError` is `effort is invalid`; an absent
`weights`, `reportedPlans` or `oldPlanWeights` table gives the tool no entry in that table
(it does not break the settings store); an absent `plans` list gives the tool no plan control
on the Settings page; an absent `scoutAgentTool` means the tool is not the scout provider
(there is no special scout lookup); `keyPrompt` can fall back to the key-sign-in tool's prompt
(or an empty string if no such tool exists). Other omitted values are `undefined` with no
general fallback.

### Models (`models`)

| Field | Type | Required? |
|---|---|---|
| `models.pins` | object: slot to `{ model, effort? }`, the default model per slot | required |
| `models.format` | string regex that `codex/model.sh` validates pins with | required |
| `models.hubPattern` | string regex the hub checks model names with | required |
| `models.efforts` | array of strings, may be empty (empty means the tool has no effort levels) | required |
| `models.slotAliases` | object, alias to slot (Claude's `haiku`, `sonnet`, `opus`) | defaulted: `{}` (no aliases) |
| `models.effortError` | string, the hub's error text for a bad effort | defaulted: `effort is invalid` |
| `models.familyCommand` | boolean, the tool uses `model.sh family` | defaulted: false in boolean checks |
| `models.bareTierSet` | boolean, the tool takes bare tier commands in `model.sh` | defaulted: false in boolean checks |

### Placement (`placement`)

| Field | Type | Meaning |
|---|---|---|
| `placement.workerRank` | number or `null`, required | Position in the fresh-settings default worker order; `null` leaves the tool out of it. |
| `placement.leadDefault` | boolean, defaulted: false in boolean checks | The tool named first in the fresh lead order. |
| `placement.seenByDefault` | boolean, defaulted: false in boolean checks | Counts as already seen when saved settings have no `worker_order_seen`. |
| `placement.addOnMigration` | boolean, defaulted: false in boolean checks | When false, the migration does not append the tool to a saved worker order. |
| `placement.appendWhenRequested` | boolean, defaulted: false in boolean checks | The balancer appends the tool when a worker explicitly requests it and it is not in the order. |

### Behaviour flags and the rest

| Field | Type | Meaning |
|---|---|---|
| `stylePreview` | boolean | This tool runs the style preview. At most one manifest. |
| `wrapProjectTools` | boolean | Launch wraps Windows project tools for WSL sessions. |
| `injectProjectKeys` | boolean | Stored project keys are injected into tool-role launches. |
| `joinPaneLines` | boolean | Pane capture joins wrapped lines (`-J`). |
| `report.useHookText`, `stopWhenEnded` | boolean | See above and `restartLoss`. |
| `asideParentField` | string | Required with the `aside` capability; forbidden without it. |
| `hook.payload`, `hook.sessionFromEnv` | see "How a turn ends" | |
| `login.killTarget` | `pane`, `session` or `name` | What the service kills to end a login. |
| `recoverRank` | number | Match order for the `recover` capability. Required (a number) when `capabilities.recover` is true, because the restart-recovery sort in `machine/service.js` uses it; otherwise optional (a number or `null`). |
| `recoverFallback` | boolean | The tool new adopted panes fall back to. |
| `usage.showWarning`, `usage.probeWhileLive`, `usage.tryEveryMachine`, `usage.defaultProblem` | boolean | How the hub treats usage for the tool. |

## `registry.json` and the browser

`node connectors/export.js` writes `connectors/registry.json` from the manifests
(`{ "tools": [...] }`); `node connectors/export.js --check` exits 1 when it is stale. It is
committed because the readers are not JavaScript and the hub runs `codex/model.sh` without the
login PATH, so a bare `node` call could fail:

- `codex/model.sh` reads the tool list, default pins, model formats and effort levels from it
  (with Python's `json`). `WHEELCHAIR_REGISTRY` points it at another file for tests.
- `install.sh` reads detection, fallback paths, PATH order and the `present` list for
  `install/unseen.py` from it.

Browser pages cannot call the registry, so the hub serves `/wheelchair/assets/tools.js`
(`viewer/server.js`, `toolsAsset`). It sets `window.WHEELCHAIR_TOOLS` to the manifests with
the `install` field removed; the settings, threads and thread pages load it with a `<script>`
tag before their own script.

## Adding a tool

1. Create `connectors/<cli>/` with `manifest.js`, `machine.js` and `hub.js`. Start from the
   closest existing tool. Fill every required manifest field and every required member, and
   declare each capability you provide with its members.
2. Add the folder name to `names` in `connectors/index.js`. The order is only a listing
   order, never placement policy.
3. Fill `install` (recipe, binary, lookup, `versionArgs`, `fallbackPath` and `pathRank` as needed).
4. Fill `settings` (model pattern and placeholder, permission choices, account text, required
   `plans` and `weights`, sign-in kind, setup link). `plans` must include `unknown` and every
   plan key must exist in `weights`. If the tool has model choices on the Settings page, add
   `settings.modelOptions`. If the tool recovers adopted panes, give it a `recoverRank`; every
   tool needs `install.label`.
5. Fill `models` (default pins per slot, formats, efforts). If the tool can list its own
   models, add a discovery function to `codex/model.sh`; that script keeps all per-tool
   model code (Decision 16 of the connector plan) and allowlists those lines in the name-check
   guard as `model-script`.
6. Fill `placement`, deciding where the tool sits in the default worker order and the
   migration and request rules.
7. If the tool has a global instructions file the diagram-sensitivity block should reach, set
   `install.sensitivity: true`, teach `sensitivity/set.sh` about the file, and extend the
   `install/unseen.py` call in the install job. That call passes the Claude and Codex home
   folders by hand (`machine/lib/harness-install.js`). `set.sh`'s disagreement check and
   messages and the install job's "other tool" copy assume at most two such tools, so a third
   means changing both; `validateRegistry` fails when more than two manifests set the flag.
8. Run `node connectors/export.js` and commit the new `registry.json`.
9. Tests: `machine/test/connectors-contract.test.js` loads both halves of every registered
   connector and checks the manifests, so a missing member or a wrong type fails by name.
   `machine/test/name-guard.test.js` scans machine source, viewer app and page source, `viewer/server.js`, `install.sh`, and `codex/model.sh` for tool-name dispatch patterns outside `connectors/` (excluding tests). It scans whole files, so a comparison, `case`, call argument, ternary or `||`/`&&` operand, array element, object key (including shorthand) or `connectors.<id>` access is caught even when it spans several lines; comments and non-code text are masked first. Exact quoted IDs are checked at their literal positions, including shell case patterns, tests and for lists, Python membership and JavaScript backticks. The detector is pinned by a table of positive and negative snippets in that test (`detector recognizes name checks across lines`): change the detector only with a snippet in the table. It is a heuristic: escaped ids, computed values and ambiguous regex/division syntax can evade it, and unusual syntax can give a false hit. For a hit that is not tool dispatch, add an entry to the `allow` list in that test: `{ file, pattern, tag, reason }`, where `file` is the repository path, `pattern` is a regular expression tested against the hit's source line, `tag` is `not-tool` (also established: `compat`, `legacy`, `model-script`), and `reason` says why. Prefer moving the behaviour into the manifest over allowlisting.
   `machine/test/adapters-loaded.test.js` walks the registry. Add characterization tests
   for the tool's behaviour next to the machine and hub tests that cover the other tools. Run
   the suites listed in the root `AGENTS.md`, including `bash codex/test/run.sh` for
   `model.sh` and `bash install/test/run.sh` for `install.sh`.

Behaviour that no existing member or field explains is not a reason to put a name check
outside `connectors/`: add a capability or optional member, list it in `contract.js`, and
document it here.

Connector halves must not require another connector folder. Shared step vocabularies live in `common.js` as `stepVocabularies.claudeStyle` and `stepVocabularies.codexStyle`.

Machine halves must not export `provider`; the manifest is the source of provider identity.
