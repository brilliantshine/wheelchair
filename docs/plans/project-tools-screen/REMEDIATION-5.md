# Remediation 5 — verification attempt 5 (commit 1e162e0)

Claude verifier: PASS. GPT verifier: FAIL with 4 gaps. Lead: decline gap 1 (round-8 Accepted Risk); fix 2, 3 and 4 in one page task, with the fix shapes below.

## Gaps (verbatim)

1. DECLINED. Reading and Saving — Remote validation reads raw Git config and misses a `pushInsteadOf` rule that changes the push repository … `machine/lib/project-tools.js:40–47`. Reason: covered by the round-8 Accepted Risk "Git `insteadOf` rewriting can send fetch and push somewhere other than the URL text that was validated"; `pushInsteadOf` is the same mechanism in Collin's own git config.
2. Editing and preserving existing settings — Editing one header silently renames an untouched sibling header. The browser sent `X-Legacy` in the Save body for a header originally named ` X-Legacy ` — `viewer/pages/project-tools.js:582–589`.
3. Keys — A newly added key reference can be saved without ever prompting for a value. If the key was set when the reference was added and is removed while the editor is open, the optional value field remains hidden after the removal succeeds — `viewer/pages/project-tools.js:460–476,673–680`.
4. Reading, Decision Log 48 — The Reload button remains enabled during its own pending Read … `viewer/pages/project-tools.js:147–151,260–266`.

## Task

| Task | Gaps | Lane |
|---|---|---|
| R5-1 | 2, 3, 4 (page) | standard, `--provider claude` |

# Task R5-1 — page: untouched rows copied from the raw entry, value prompt after key changes, one lock for every request

Plan slug: project-tools-screen. Task id: R5-1. Gaps 2, 3 and 4 in `docs/plans/project-tools-screen/REMEDIATION-5.md`; Decision Log 48 in PLAN.md. File: `viewer/pages/project-tools.js` (read it whole first). Each fix is settled by the lead; implement it as written.

2. **Untouched rows are copied, never rebuilt (structural).** Each setting/header row parsed from the original entry keeps a reference to its original raw name and value, plus a `dirty` flag set by any input in that row (name, mode, value, prefix, key name). In `buildEntry`, a row that isn't dirty contributes `rawName: rawValue` exactly as read; only dirty rows and newly added rows are built from the form. The same holds per field (`command`, `url`, `args`, `type`): a field the user didn't touch is copied from the raw entry (track touched, rather than comparing displayed values). Order is kept as in the original, with new rows appended. For edited and new rows, refuse a name with leading or trailing whitespace ("<name> has a space at the start or end.") instead of trimming. Remove the trim-and-compare logic that this replaces.
3. **The open editor follows key-list changes.** After every reply that changes `state.keys` (Set, Add, Remove, Save), refresh the open editor's key rows so the optional value field shows for any key name that is now unset (and hides for one now set), keeping what the user typed.
4. **One lock helper for every request.** Every control that starts a request (picker selects, Save, Start over, key Set/Add/Remove and its confirm, the Reload button from the failed-reload block, and any future one) is created or wired through one helper that disables it while `state.loading` or `state.busy` and refuses in its handler too. The Reload button must be disabled during its own pending read.

## Tests (append to `viewer/test/app-project-tools.spec.js`; one each)
- For a web tool with headers `{" X-Legacy ": "a", "Authorization": "Bearer ${TOK}", "Weird": 5}` plus unknown field `timeout: 5`, and for a command tool with env, args and an unknown field: edit ONE field (the URL, then the command) and assert the Save body's entry deep-equals the raw entry except that one field.
- An edited header name with a trailing space is refused.
- With the editor open on a new key reference to a set key, remove that key from the Keys list: the editor's value field appears.
- Gate the read stub, trigger a failed reload, click Reload: while the read is pending, the Reload button is disabled.

## Ownership boundary
`viewer/pages/project-tools.js`, `viewer/test/app-project-tools.spec.js`.

## Validation
Run twice; both must pass:
```
npm --prefix viewer run test:browser -- app-project-tools.spec.js app-settings.spec.js
```
