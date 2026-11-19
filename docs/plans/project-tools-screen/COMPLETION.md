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
| Launch: only Claude/Codex tool roles, only referenced non-reserved keys, outside argv/`session.command`/persisted data/logs | this run | `machine/service.js:628-635` (env file `session-env/<name>.json` mode 600, read and deleted by the Node launcher `machine/lib/env-launch.js`, no shell; Remediation 8); `machine/lib/project-keys.js:50` (`launchKeys`) | `machine/test/project-keys.test.js` / launch tests (Claude and Codex worker, reviewer and agy get none, value absent from tmux argv, `session.command`, `sessions.json`) |
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
- If tmux fails to start after the env file is written, the mode-600 JSON env file stays in `<stateDir>/session-env/` until removed.
- `projectIdentity` at session launch runs git without a timeout (launch, not the routes).
- The Settings section is built once per page load; returning to it from another section shows the last read until a project is picked again.
- No test asserts the env file's mode or that a key-store failure still starts the session (the code catches and logs it).
- Everything in the plan's Deferred table and Accepted Risks.

## Remediation rounds

### Remediation 1 (after verification attempt 1, commit 515a36f)

Gaps and briefs: `REMEDIATION-1.md`. Lead decision: fix all eight, defer none.

| Gap | Fix | Where | Test |
|---|---|---|---|
| 1 Kind change dropped read-only parts | Refused while any read-only row (incl. reserved-name env rows), read-only args/command/URL or unknown field exists | `viewer/pages/project-tools.js:448` | `app-project-tools.spec.js` kind-refusal test (four cases) |
| 2 Late key reply applied to another project | Reply dropped unless machine, path and read sequence still match | `viewer/pages/project-tools.js:613-618,728-733` | late-reply test (save path) |
| 3 `${...}` in command/args/URL editable | Shown read-only, kept as is | `viewer/pages/project-tools.js:90-92,431-443,531,541` | args read-only test |
| 4 Unknown fields hidden | Listed read-only on card and form | `viewer/pages/project-tools.js:313,439-440` | unknown-field test |
| 5 "set" next to "needs … not set" | "needs" warnings computed from current keys | `viewer/pages/project-tools.js:320-328` | key-warning test |
| 6 "shared with" only from baseline | Computed from the current draft, live in the editor | `viewer/pages/project-tools.js:290-300,401,410-412` | shared-with test |
| 7 Waiting PRs hidden when unreadable | Shown in tools mode always | `viewer/pages/project-tools.js:228-242` | unreadable + waiting test |
| 8 Temp worktree left after failed add | `finally` removes and prunes whenever the path was chosen | `machine/lib/project-tools.js:138-142` | failing post-checkout hook test |

Validation after remediation (sub-lead, on the merged branch):

```
$ bash machine/test/run.sh                      # pass 202, fail 0
$ node --test viewer/test/*.test.js             # pass 641, fail 0
$ npm --prefix viewer run test:browser -- app-project-tools.spec.js app-settings.spec.js   # 120 passed
```

### Remediation 2 (after verification attempt 2, commit 0cd19d1)

Gaps and briefs: `REMEDIATION-2.md`. Lead decision: fix all seven, defer none, with the fix shape given per gap.

| Gap | Fix | Where | Test |
|---|---|---|---|
| 1 "needs" warnings lost for read-only parts | Machine warnings are the source, shown while the key is unset; computed ones only added for draft keys the machine didn't name | `viewer/pages/project-tools.js` tool card warnings | `app-project-tools.spec.js` machine key warnings test |
| 2 Late replies on another project (whole family) | Every request (picker, read, post-save reloads, save, remove-key) tagged with machine, path and a generation bumped on every switch; stale replies dropped | `viewer/pages/project-tools.js` `tag()`/`fresh()`, `send`, `handle`, remove handler | one switch-mid-request test per kind |
| 3 Nested `${A:-${B}}` hold-back | Brace-matching parse collects every name at any depth; regex fallback for unbalanced input | `machine/lib/project-keys.js:14-30` | `project-keys.test.js` nested/unbalanced test |
| 4 `constructor` key broke Read | Null-prototype objects for name-keyed maps | `machine/lib/project-keys.js`, `machine/lib/project-tools.js` | `project-tools.test.js` special-names test |
| 5 `__proto__` header dropped | Null-prototype objects and own-property helpers in the page | `viewer/pages/project-tools.js` | `__proto__` header test |
| 6 `$` before a key | Refused | `viewer/pages/project-tools.js` `apply()` | `$` refused test |
| 7 Start over with tools | Machine refuses unless `tools` is `{}` | `machine/lib/project-tools.js:92` | `project-tools.test.js` |
| (found before re-verify) flaky phone test | Measure inside `evaluate` under `expect.poll` | `viewer/test/app-project-tools.spec.js:337` | — |

Validation after remediation (sub-lead, on the merged branch):

```
$ bash machine/test/run.sh                       # pass 204, fail 0
$ node --test viewer/test/*.test.js              # pass 641 (one flaky failure on a first run, passed on re-run)
$ npm --prefix viewer run test:browser -- app-settings.spec.js app-project-tools.spec.js --repeat-each 3
  1 failed  [firefox] app-settings.spec.js:61 (table cell; not changed by this build; different Settings tests fail run to run)
  379 passed
```

### Remediation 3 (after verification attempt 3, commit 96feb07)

Attempt 3: the claude verifier passed; the gpt verifier failed. Two gap families had survived two fix attempts (A: stale state across a switch; B: key warnings vs the current key state). They went to Collin, whose answers are Decision Log 48 and 49, folded into the Spec's Reading and Keys sections. The lead decided gaps 1-5: fix all, defer none. Details are in `REMEDIATION-3.md`.

| Gap | Fix | Where | Test |
|---|---|---|---|
| A Stale switch (Log 48) | A load counter locks the picker and section while the picker list, a Read, or a post-save reload is in flight; the project list is cleared at once on a machine change; handlers refuse while locked | `viewer/pages/project-tools.js:146-153,177-210,232` | lock test; stale-guard tests (forced changes) |
| B Key warnings (Log 49) | The machine returns per-tool `keys`/`held_back`; the page shows "needs X" from `checks[name].keys` against the current keys; "shared with" from the same names | `machine/lib/project-tools.js:29-31`; `viewer/pages/project-tools.js:325-361,444` | `project-tools.test.js` per-tool names; browser key-warning test |
| 1 Header renamed onto a read-only header | Refused as a duplicate | `viewer/pages/project-tools.js:503` | header rename test |
| 2 `\r` in args | Args read-only | `viewer/pages/project-tools.js:96` | `\r` args test |
| 3 Ignored `.mcp.json` | `git add -f` | `machine/lib/project-tools.js:132` | ignored-file save test |
| 4 Shared with via read-only setting | Folded into B | as B | B test |
| 5 `failed` replies without revision/keys | Every `failed` path carries them (0/[] if the store is unreadable) | `machine/lib/project-tools.js:91,152` | unreadable-store test |

Validation after remediation (sub-lead): `bash machine/test/run.sh` pass 207 fail 0; `node --test viewer/test/*.test.js` pass 641 fail 0; `npm --prefix viewer run test:browser -- app-project-tools.spec.js app-settings.spec.js` 144 passed, twice.

### Remediation 4 (after verification attempt 4, commit cccad56)

Both verifiers failed with 4 distinct gaps; all Remediation 3 items were confirmed. Lead: fix all four, defer none. Details are in `REMEDIATION-4.md`.

| Gap | Fix | Where | Test |
|---|---|---|---|
| 1 A draft rename lost baseline checks (Log 49) | Draft tool → baseline name map; cards and "shared with" look up checks by baseline name and show current draft names | `viewer/pages/project-tools.js:250-251,343-352,394,467-469,549-559` | rename/remove test |
| 2 Key-store errors could quote stored values | Fixed messages for every key-store error, in replies and the launch log | `machine/lib/project-keys.js:48-68`; `machine/lib/project-tools.js:73,91,106,124,152,157`; `machine/service.js:637` | malformed / wrong-shape store test (Read, Save, Remove, launch) |
| 3 `headers: {}` dropped on a URL edit | Every untouched field is sent exactly as read on same-kind edits | `viewer/pages/project-tools.js:592-620` | untouched-fields test |
| 4 Failed post-save reload hidden | Save message + "Couldn't reload the project: <reason>" + Reload button | `viewer/pages/project-tools.js:260-269,719,725,737` | 409+504 and opened+failed-read tests |

Validation after remediation (sub-lead): `bash machine/test/run.sh` pass 208 fail 0; `node --test viewer/test/*.test.js` pass 641 fail 0; `npm --prefix viewer run test:browser -- app-project-tools.spec.js app-settings.spec.js` 152 passed, twice.

### Verification attempt 5 (commit 1e162e0): declined gap

- `pushInsteadOf` can send pushes to another repository than the configured URL text that Read validated (`machine/lib/project-tools.js:40-47`). Declined by the lead: covered by the round-8 Accepted Risk on git `insteadOf` rewriting; `pushInsteadOf` is the same mechanism in Collin's own git config. Gaps 2-4 are in `REMEDIATION-5.md`.

### Remediation 5 (after verification attempt 5, commit 1e162e0)

Gap 1 was declined (above). Gaps 2-4 were fixed in R5-1; R5-2 added the exact regression test for gap 2. Details are in `REMEDIATION-5.md`.

| Gap | Fix | Where | Test |
|---|---|---|---|
| 2 An untouched sibling header was renamed (trimmed) | Structural: rows and fields the user didn't touch are copied from the raw entry (dirty/touched flags); edited row names with leading or trailing spaces are refused | `viewer/pages/project-tools.js:100-101,543,599-624` | deep-equal one-field-edit test; ' X-Legacy ' sibling test (R5-2); trailing-space test |
| 3 The value prompt stayed hidden after a key removal | The open editor's key rows refresh on every key-list change | `viewer/pages/project-tools.js:489,689` | key-removed-while-editing test |
| 4 Reload enabled during its own read | One `lockBtn` helper for every request control; selects locked with `locked()` | `viewer/pages/project-tools.js:155-156,212-214,274,294,640,773-804` | Reload-disabled test |

The five earlier stale-reply tests became lock assertions: a user can no longer switch mid-request, so the reply-tag drop is backstop code.

Validation after remediation (sub-lead): `bash machine/test/run.sh` pass 208 fail 0; `node --test viewer/test/*.test.js` pass 641 fail 0; `npm --prefix viewer run test:browser -- --project=chromium` 452 passed; Project tools browser spec 100 passed.

### Remediation 6 (after verification attempt 6, commit 9dce856)

Attempt 6: the claude verifier passed; the gpt verifier failed with 3 gaps. A (a tool name trimmed on an unrelated edit) survived two fixes and went to Collin; his answer is Decision Log 50, now in the Spec's Editing section. The lead decided gaps 1 and 2: fix both. Details are in `REMEDIATION-6.md`.

| Gap | Fix | Where | Test |
|---|---|---|---|
| A Untouched data altered (Log 50) | Tool names copied unless edited; edited tool and row names and "Add a key" names with leading or trailing spaces refused, not trimmed; page-wide audit (report R6-1); R6-2: a touched field that ends equal to the original is written as the original, and command/URL are no longer trimmed | `viewer/pages/project-tools.js:529-559,618-650,785` | " legacy " test; "x " and "K " refusal tests; env/args round-trip and untrimmed-URL tests |
| 1 A removed tool's editor stayed live | Removing a tool closes its open editor and discards its edits | `viewer/pages/project-tools.js:404` | remove-while-editing test (also mid-rename) |
| 2 Read-only cards hid kind and what they run | Kind and command+args or URL shown from the raw entry | `viewer/pages/project-tools.js:368-372` | read-only web tool test |

Validation after remediation (sub-lead): `bash machine/test/run.sh` pass 208 fail 0; `node --test viewer/test/*.test.js` pass 641 fail 0; `npm --prefix viewer run test:browser -- app-project-tools.spec.js app-settings.spec.js` 176 passed, twice.

### Remediation 7 (after verification attempt 7, commit db0f8df)

Attempt 7: the claude verifier passed; the gpt verifier failed with 3 gaps. Lead: fix all three in one task. Details are in `REMEDIATION-7.md`.

| Gap | Fix | Where | Test |
|---|---|---|---|
| 1 A newline in a setting value flattened, and a kind change dropped it | One `unshowable` rule (C0 controls and DEL) makes setting/header names and values, command, URL, args and the tool name read-only and blocks kind changes; R7-2 shows such values in escaped form | `viewer/pages/project-tools.js:63-65,73,98-100,389,445,536` | newline setting, tab header, `\u0007` command, `\n` tool name, escaped display tests |
| 2 Compare link not URL-encoded | Branch names encoded, `/` kept | `machine/lib/project-tools.js:14,140` | `release#2026` compare-link test |
| 3 Read-only cards hid headers, key status, unknown fields | One card renderer (`toolCard` via `viewEntry` and `rowLine`) for editable and read-only tools | `viewer/pages/project-tools.js:108-123,356-368,382` | read-only web tool card test |

Validation after remediation (sub-lead): `bash machine/test/run.sh` pass 209 fail 0; `node --test viewer/test/*.test.js` pass 641 fail 0; Project tools and Settings browser tests 186 passed twice (R7-1) and 188 passed (R7-2). The Chromium full suite fails only on the clock-dependent `app-accounts.spec.js` "lead waiting line" tests (they fail within 3 hours of midnight and do so on the pre-build merge base).

## Remediation 8

Attempt 8: the claude verifier passed; the gpt verifier failed with 4 gaps. Gap 1 was new, and the lead chose the fix. Gaps 2-4 were the read-only card display family, which survived R6 and R7. Collin picked "Show every field as written" (Decision Log 51, now in the Spec's Reading section). Details are in `REMEDIATION-8.md`.

| Gap | Fix | Where | Test |
|---|---|---|---|
| 1 A shell special key name (`OPTIND`) broke the launcher, which printed the value | Node launcher reads the mode-600 JSON env file, deletes it and execs the CLI, with no shell. Its own errors are fixed messages. The shell's special names are reserved | `machine/lib/env-launch.js`; `machine/service.js:628-635`; `machine/lib/project-keys.js:9` | `machine/test/project-keys.test.js:41,73,84,98` (session launch, OPTIND/IFS with a hostile value, invalid JSON and missing CLI, forced ENOEXEC); `isReserved` cases |
| 2 An http tool with an extra `command` was labelled command | Cards the form can't edit take their kind from `type` only; `viewEntry` deleted | `viewer/pages/project-tools.js:374-402` | `app-project-tools.spec.js:989` |
| 3 A read-only header `Bearer ${TOKEN} trailing` hid TOKEN's status | Read-only rows show a set or not set chip for each referenced name in the tool's machine `checks.keys` | `viewer/pages/project-tools.js:344-351` | `app-project-tools.spec.js:1006` |
| 4 `{"type":"custom","timeout":5000}` hid both fields | Every raw field shown in file order as `name: value` text, plus a key line from `checks.keys` (Log 51) | `viewer/pages/project-tools.js:400` | `app-project-tools.spec.js:998,1018,1025` |

Validation after remediation (sub-lead), on the merged branch unless noted:
- `bash machine/test/run.sh`: pass 212, fail 0.
- `node --test viewer/test/*.test.js`: pass 641, fail 0.
- `npm --prefix viewer run test:browser -- --project=chromium`: 471 passed, 14 skipped.
- `npm --prefix viewer run test:browser -- app-project-tools.spec.js app-settings.spec.js`: 198 passed, on the R8-2 branch.

Accepted residuals (lead):
- Node's `process.execve` aborts on a late exec failure, such as a corrupt executable or a race after the up-front checks, instead of printing the fixed message. The abort prints the error code and a stack trace with no values; `project-keys.test.js:98` keeps that checked.
- The Node 20 spawn fallback is untested here, because this machine runs Node 22.

Lanes: R8-1 standard / gpt-6.1-terra (worker-22); R8-2 standard / claude-sonnet-5-5 (worker-23).

## Remediation 9

Attempt 9: the claude verifier passed; the gpt verifier failed with 1 gap. The lead applied Decision Log 52 (Collin: "Stop chasing rare cases; decide what is realistic"): gap 1 is fixed under rule (b), and five hardening candidates became Deferred rows 9-13 (source verification). Details are in `REMEDIATION-9.md`.

| Gap | Fix | Where | Test |
|---|---|---|---|
| 1 The hub decoded each reply chunk separately, so a UTF-8 character split across chunks was garbled and an ordinary Save pushed `Ol��` | `response.setEncoding('utf8')` before the data listener in `requestJson` | `viewer/app/machine-client.js:31` | `viewer/test/app-project-tools.test.js:85` (`á` split after `0xC3`; fails without the line) |

Validation after remediation (sub-lead): `node --test viewer/test/*.test.js` pass 642 fail 0; `bash machine/test/run.sh` pass 212 fail 0 (Remediation 8, machine unchanged since). Lane: R9-1 light / gpt-6-luna (worker-24).

