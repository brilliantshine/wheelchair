---
slug: project-tools-screen
date: 2026-11-18
implemented-by: "standard gpt-6.1-terra (T1, T2, T2b, T3); standard claude-sonnet-5-5 (T4); light claude-haiku-5-5 (T4b); sub-lead claude-opus-5-5"
verified-by: []
---

# Completion Report — A screen for a project's tools

Written for a hostile reviewer: every claim checkable, no claim without evidence.
The contract the tasks were built against is `docs/plans/project-tools-screen/API.md`; task reports are in `reports/`.

## Spec coverage

All rows are `this run` (the plan has no Prior Work).

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| "Project tools" section in Settings with machine and project picker (New thread choices) | this run | `viewer/pages/settings.js:8,1386-1390`; `viewer/pages/settings.html:10`; `viewer/pages/project-tools.js:154` (`loadPicker`, `GET /new-thread`) | `viewer/test/app-project-tools.spec.js`; `viewer/test/app-settings.spec.js` (six sections) |
| Works at phone width | this run | `viewer/pages/settings.css` (`/* Project tools */` block) | `app-project-tools.spec.js` 390x844 tests (no horizontal scroll) |
| Project identity = realpath of git common dir; alias and thread worktree share it | this run | `machine/lib/project-keys.js:29` (`projectIdentity`); used by `machine/lib/project-tools.js:36` and launch `machine/service.js:620-640` | `machine/test/project-tools.test.js` (alias + worktree share one key store through the routes); `machine/test/project-keys.test.js` |
| Reading: origin and push URL both github.com, same repo, else keys-only; validated URL; `insteadOf` honored | this run | `machine/lib/project-tools.js:15` (`repoName`), `:38` (`remote`: configured `remote.origin.url` / `pushurl` text, exactly one each) | `project-tools.test.js` keys-only, other-repo push URL, two push URLs, raw-URL-with-insteadOf tests |
| `gh` calls pass `--repo`, non-interactive | this run | `machine/lib/project-tools.js:34` (env `GH_PROMPT_DISABLED`, `GIT_TERMINAL_PROMPT`), `:79`, `:135` | `project-tools.test.js` (fake `gh` log) |
| Keys-only mode: notice, no tool list, keys list with usage unknown | this run | `machine/lib/project-tools.js:68-74`; page `viewer/pages/project-tools.js:190-245`, `:644` (`keyRowNames`, usage "unknown" without a baseline) | `project-tools.test.js` keys-only test; `app-project-tools.spec.js` keys-only test |
| Fetch default branch via `ls-remote --symref` into a private ref; `--no-write-fetch-head --no-tags`; ref deleted; checkout untouched | this run | `machine/lib/project-tools.js:57-66` (`fetched`) | `project-tools.test.js` "reading from remote default branch via a private ref with FETCH_HEAD and tags untouched" |
| Waiting tools PRs (`gh pr list ... --limit 1000`, same-repo, `wc-tools/`), shown as Waiting to merge | this run | `machine/lib/project-tools.js:79-81`; page `viewer/pages/project-tools.js` `paintWaiting` | `project-tools.test.js` "waiting tools PRs filtered..."; `app-project-tools.spec.js` waiting PRs test |
| `gh` failure still shows tools with "couldn't check for waiting pull requests" | this run | `machine/lib/project-tools.js:80`; page `paintWaiting` | `project-tools.test.js` same test ("gh failure still lists tools") |
| GitHub unreachable → "Couldn't reach GitHub: <reason>", keys list only | this run | `machine/lib/project-tools.js:84` | `project-tools.test.js` "offline fetch returns failed ...; Read falls back" |
| Read returns parsed source document; form edits a copy of raw entries | this run | `machine/lib/project-tools.js:77`; page `viewer/pages/project-tools.js:190` (`readProject`, `structuredClone`) | `app-project-tools.spec.js` edit tests |
| `.mcp.json` via `ls-tree`/`cat-file`; missing → empty; non-blob → unreadable with the Spec reason; reader's checks | this run | `machine/lib/project-tools.js:47-56` (`sourceAt`); `machine/lib/project-mcp.js:10` (`checkDocumentText`) | `project-tools.test.js` Start over / symlink tests |
| Unreadable file: reason, no editing, Start over (`start_over: true`, empty list); tool Save without it refused; Start over refused on readable | this run | `machine/lib/project-tools.js:100,105,110`; page `viewer/pages/project-tools.js:224-227` | `project-tools.test.js` "Start over replaces unreadable file and is refused on readable source", "Start over replaces a symlink with a regular file"; `app-project-tools.spec.js` unreadable test |
| Read token (project, tool baseline, key revision) | this run | `machine/lib/project-tools.js:72,77` | `project-tools.test.js` refusal tests |
| Form stays bound to its baseline; key replies rebuild the Keys list (stored ∪ baseline references) | this run | `viewer/pages/project-tools.js` `applyKeys`, `:644` (`keyRowNames`) | `app-project-tools.spec.js` "adding and removing keys rebuilds the Keys list while an unsaved tool edit stays" |
| Each tool: name, kind, what it runs, settings (plain values; keys set/not set) | this run | `viewer/pages/project-tools.js:284` (`toolCard`), `rowLine` | `app-project-tools.spec.js` key set/not set test |
| Skip reasons from the machine validator and Codex; Codex size result; exported validators | this run | `machine/lib/project-tools.js:19-32` (`checksFor`); `machine/lib/project-mcp.js:17` (`entryReason`); `machine/adapters/codex.js:29,43` (`codexEntryReason`, `codexOverrides`) | `machine/test/project-mcp.test.js`, `project-mcp-codex.test.js` (unchanged argv); `app-project-tools.spec.js` skip reasons test |
| Notes: Antigravity gets no project tools; keys are per machine | this run | `viewer/pages/project-tools.js:242-243` | `app-project-tools.spec.js` |
| Form fields (name, kind, command, args one per line, settings plain/key; URL, headers plain/key with text before the key) | this run | `viewer/pages/project-tools.js` `openForm`, `:489` (`buildEntry`) | `app-project-tools.spec.js` add/edit tests, `Bearer ${NAME}` |
| Header note shown on adding a header | this run | `viewer/pages/project-tools.js:10` (`HEADER_NOTE`), `paintRows` | `app-project-tools.spec.js` |
| Remove (a tool) asks for confirmation | this run | `viewer/pages/project-tools.js` `toolCard` (inline Yes/Cancel) | `app-project-tools.spec.js` remove test |
| Unknown fields and unrepresentable settings/headers/args kept verbatim, read-only; kind change refused while read-only parts exist; unrepresentable entries read-only | this run | `viewer/pages/project-tools.js:73` (`parseEntry`), `classifyEnv`/`classifyHeader`, `:425`, `:489` (`buildEntry`) | `app-project-tools.spec.js` "editing a URL keeps an unrepresentable header", unknown fields kept |
| Machine keeps other top-level fields | this run | `machine/lib/project-tools.js:111` (candidate `{ ...source.document, mcpServers }`) | `project-tools.test.js` |
| Duplicate tool name refused | this run | `viewer/pages/project-tools.js:437` | `app-project-tools.spec.js` |
| Keys by name per project; env `${NAME}` with setting name = key name; header `${NAME}`; "shared with" | this run | `machine/lib/project-keys.js:14` (`keyReferences`); page `toolCard` shared-with | `machine/test/project-keys.test.js`; `app-project-tools.spec.js` |
| Refs in command/args/URL are never keys; held back at Read (key warning) and launch; conflict refused only when this Save creates it | this run | `machine/lib/project-keys.js:14`; `machine/lib/project-tools.js:27` (held-back warning), `:112-119` (conflict); `machine/service.js:620-640` (launch log) | `project-keys.test.js`; `project-tools.test.js` "reserved names and conflicts created by edited tools are refused", "existing conflicts do not block editing unrelated fields"; launch test `${NAME:-x}` |
| Reserved-name refs left to the environment: not a key, no flag | this run | machine `keyReferences` excludes reserved; page `viewer/pages/project-tools.js:14` (`isReservedName`), `classifyEnv`/`classifyHeader` env rows | `project-keys.test.js`; `app-project-tools.spec.js` PATH env test (T4b) |
| "needs <name>, not set on this machine" key warning | this run | `machine/lib/project-tools.js:26` | `project-tools.test.js` |
| Key name regex; reserved list refused by form and machine | this run | `machine/lib/project-keys.js:11-12`; `machine/lib/project-tools.js` `validateName`; page `keyNameProblem` | `project-keys.test.js`; `project-tools.test.js` reserved-name test |
| Values browser → hub → machine; mode-600 store per project; hub never stores/logs; screen never receives values | this run | `machine/lib/project-keys.js:40-48` (`writeKeyStore`, temp + rename + `finally` unlink); `viewer/app/routes.js:65-75`; `viewer/app/machine-client.js:82` | `project-tools.test.js` "key store mode 600"; `viewer/test/app-project-tools.test.js` (value absent from hub state) |
| Launch: only Claude/Codex tool roles, only referenced non-reserved keys, outside argv/`session.command`/persisted data/logs | this run | `machine/service.js:620-640` (env file `session-env/<name>.sh` mode 600, `sh -c '. "$0" && rm -f -- "$0" && exec "$@"'`); `machine/lib/project-keys.js:50` (`launchKeys`) | `machine/test/project-keys.test.js` / launch tests (Claude and Codex worker, reviewer and agy get none, value absent from tmux argv, `session.command`, `sessions.json`) |
| Keys on this machine list: stored ∪ default-branch refs, usage, set/replace, Add a key, Remove with confirmation | this run | `viewer/pages/project-tools.js:656` (`paintKeys`), `keyRow` | `app-project-tools.spec.js` keys tests |
| Asking for a value when Save adds an unset key reference | this run | `viewer/pages/project-tools.js` `rowEditor` secret field, `:553` (`saveTools`) | `app-project-tools.spec.js` |
| Remove checks identity and key revision | this run | `machine/lib/project-tools.js:142-150` | `project-tools.test.js` "keys-only ... removal with revision checks", "changed key revision and project identity are refused" |
| Save: `tools` / `null`, equal object = no change; nothing to save refused | this run | `machine/lib/project-tools.js:94-101`; page `:553` | `project-tools.test.js` |
| One save or removal per project at a time | this run | `machine/service.js:1500-1512` | `project-tools.test.js` concurrent-saves lock test (through `service.handle`) |
| Step 1 refusals (identity, key revision; repo, branch, mode/oid on tool change; key-only doesn't fetch; unrelated commits pass) | this run | `machine/lib/project-tools.js:91,104-109` | `project-tools.test.js` "changed file refused, unrelated commit allowed, and key-only save never fetches", "changed repository is refused", changed default branch test |
| Step 2 whole-file check blocks; per-entry and size warnings | this run | `machine/lib/project-tools.js:111-120` | `project-tools.test.js` |
| Step 3 atomic key write with cleanup; `failed` with unchanged revision | this run | `machine/lib/project-keys.js:40-48`; `machine/lib/project-tools.js:103,121` | `project-tools.test.js` "a failed key write leaves no temporary file" |
| Steps 4-7: temp worktree commit, empty-lease push to `wc-tools/<12 hex>`, `gh pr create`, `pr_failed` with compare link, worktree removed | this run | `machine/lib/project-tools.js:122-138` | `project-tools.test.js` "temp-worktree commit, new-branch push and PR; two saves make two PRs", "push refuses an existing branch name", "pr_failed with compare link", PR URL last-line test |
| `failed` after keys stored (updated revision) vs before (unchanged) | this run | `machine/lib/project-tools.js:90,138,140` | `project-tools.test.js` "commit failure after keys stored...", "offline fetch returns failed with original key revision" |
| 60-second limit on every git/`gh` call; `commandAsync` timeout kills the child | this run | `machine/lib/project-tools.js:34`; `machine/service.js:87-102` | T1 timeout test (`sleep 30` killed) |
| Save runs to the end if the request drops | this run | `machine/service.js:1500-1512` (no abort on close) | `project-tools.test.js` "dropped Save still runs to the end" |
| Replies (`saved`, `opened`, `pr_failed`, `failed` 502, `removed`, `refused` 409/400) | this run | `machine/lib/project-tools.js` (as above) | `project-tools.test.js` |
| Hub forwarding: 120 s timeout, pass-through of JSON status and body, auth/origin | this run | `viewer/app/routes.js:65-75`; `viewer/app/machine-client.js:82` | `viewer/test/app-project-tools.test.js` |
| Lost reply → "Save may still be finishing..." message, never retries | this run | `viewer/pages/project-tools.js:9`, `:596` (`handle`) | `app-project-tools.spec.js` 504 test |
| Reply display (PR link + "new threads get it once merged", `pr_failed` compare link, `failed` error, `refused` reason, reload after PR) | this run | `viewer/pages/project-tools.js:596-640` | `app-project-tools.spec.js` |

## Deviations from plan

- The hub's 120-second limit is the machine client's existing socket timeout (idle, as `call()` uses), not an overall deadline. The Spec points at that same `machine-client.js:64` timeout argument.
- Key-only detection on Save compares a non-null `tools` to the baseline blob from the local object database instead of re-fetching (Spec: "an equal object is treated as null"; "A key-only Save does not fetch"). Same outcome, no network call.
- Unreadable key store: Read still answers (keys-only data, empty keys, the error in `notice`); Save and Remove answer `failed` without `key_revision`/`keys`. The Spec doesn't name this case.
- `readProjectMcp` gained `rawServers`; launch reads key references and held-back names from every entry, including ones the validator skips.

## Routers

- `machine/AGENTS.md`: rows for `lib/project-keys.js` (shared key rule, key store) and `lib/project-tools.js` (read/save/remove-key routes); `lib/project-mcp.js` row updated (exported validators).
- `machine/API.md`: the three `/v1/project-tools/*` routes.
- `viewer/AGENTS.md`: `app/machine-client.js` (pass-through) and `app/routes.js` (project-tools forwarding) rows updated; new row for `pages/project-tools.js`.

## Validation evidence

Run by the sub-lead on the feature branch (`wc/406595075040`) after the last merge:

```
$ bash machine/test/run.sh          (feature branch)
# tests 201
# pass 201
# fail 0

$ node --test viewer/test/*.test.js
# tests 641
# pass 641
# fail 0

$ npm --prefix viewer run test:browser
  2 failed
    [chromium] › test/app-threads.spec.js:340:5 › desktop › message box posts and shows queued
    [firefox] › test/app-threads.spec.js:538:5 › phone › approval: Start building enabled when Ready ...
  28 skipped
  842 passed (6.5m)

$ npm --prefix viewer run test:browser -- app-threads.spec.js     (re-run 1)
  1 failed  [firefox] › test/app-threads.spec.js:657:5 › desktop › plan links use the slug ...
  161 passed

$ npm --prefix viewer run test:browser -- app-threads.spec.js     (re-run 2)
  162 passed (2.7m)

$ npm --prefix viewer run test:browser -- app-project-tools.spec.js app-settings.spec.js
  100 passed (1.3m)
```

`app-threads.spec.js` isn't touched by this build (`git diff main...HEAD -- viewer/test/app-threads.spec.js` is empty); a different test failed on each run and the third run passed, so the failures are flaky and unrelated.

## Known gaps / residual risks

- Nested defaults `${A:-${B}}` in a command/args/URL hold back only `A`.
- If tmux fails to start after the env file is written, the mode-600 env file stays in `<stateDir>/session-env/` until removed.
- `projectIdentity` at session launch runs git without a timeout (launch, not the routes).
- The Settings section is built once per page load; returning to it from another section shows the last read until a project is picked again.
- No test asserts the env file's mode or that a key-store failure still starts the session (the code catches and logs it).
- Everything in the plan's Deferred table and Accepted Risks.

## Remediation rounds
