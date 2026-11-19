# Remediation 6 — verification attempt 6 (commit 9dce856)

Claude verifier: PASS. GPT verifier: FAIL with 3 gaps. A survived two fix attempts (R4, R5) and went to Collin; his answer is Decision Log 50, now in the Spec's Editing section. The lead decided gaps 1 and 2: fix both, defer none.

## Gaps (verbatim)

A. Editing an existing tool — Editing only the command silently renames a tool whose original name has surrounding spaces. At phone width, changing the command for `" legacy "` sent `"legacy"` in the Save payload. `viewer/pages/project-tools.js:530,563`
1. Removing a tool — Confirming removal leaves its editor active. Clicking **Keep changes** in that editor restored the removed tool to the Save payload. If the open edit was a rename, **Keep changes** silently discarded it. `viewer/pages/project-tools.js:402,563,573`
2. Reading tools and showing read-only entries — A valid HTTP tool that the form cannot edit displays only its name and "edit in the file." … a tool with a URL and `env: {}` passed the machine validator, but its card hid both its kind and URL. `viewer/pages/project-tools.js:89,368–379`

## Task

| Task | Gaps | Lane |
|---|---|---|
| R6-1 | A (plus a page-wide audit under Log 50), 1, 2 | standard, `--provider claude` |

# Task R6-1 — page: untouched data exactly as read (Log 50), removing a tool closes its editor, read-only cards show what they run

Plan slug: project-tools-screen. Task id: R6-1. Gaps in `docs/plans/project-tools-screen/REMEDIATION-6.md`; Decision Log 50 and the Spec's Editing section in PLAN.md (Collin's rule). File: `viewer/pages/project-tools.js` (read it whole first). Each fix is settled; implement it as written.

A. **Collin's rule (Log 50):** "Anything the user didn't edit (tool names, row names, values, whole fields, empty objects) is written back byte-for-byte in meaning as read, and only what the user edited is validated; an edited name with leading or trailing spaces is refused rather than trimmed."
   1. **Tool names.** The tool name is copied from the original name unless the user typed in the Name field (a `touched.name` flag, like the other fields). An untouched name (e.g. `" legacy "`) is kept exactly and is not validated. An edited or new tool name with leading or trailing whitespace is refused ("The name has a space at the start or end."); an empty edited name is refused as now. The duplicate-name check compares exact strings.
   2. **Audit.** Go through the whole file once for every place that normalises, trims, re-serialises, reorders, coerces or validates data the user didn't edit: tool names, row names and values, key names, the "text before the key", args, command, URL, type, unknown fields, the Keys list "Add a key" input, the rename path in `apply()`, and anything else you find. For each place, either make it follow the rule or confirm it only touches user-edited input. List every place you checked in the report, with line and outcome ("changed: …" or "ok: only edited input"). A name typed in the Keys list's "Add a key" field is user input: refuse leading or trailing spaces rather than trimming.
1. **Removing a tool closes its editor.** Confirming "Yes, remove <tool>" while that tool's editor is open closes the editor and discards its unsaved edits (`formState = null`, form cleared), so "Keep changes" can't restore or rename it.
2. **Read-only cards show what they run.** A tool the form can't edit still shows its kind (command or web address, when `command` or `url` is a string) and what it runs (command + args when they're strings, or the URL), from the raw entry, above "edit in the file".

## Tests (append to `viewer/test/app-project-tools.spec.js`; one each)
- A tool named `" legacy "`: editing only its command sends the entry under the key `" legacy "` with everything else deep-equal to the raw entry except the command. Renaming a tool to `"x "` is refused.
- "Add a key" with `"K "` is refused rather than trimmed.
- Open the editor for tool `a`, remove `a` (confirm), then the editor is gone; the Save body has no `a`. Same with a rename in progress: the removed tool doesn't come back under either name.
- A web tool `{ type: "http", url: "https://x", env: {} }` (not editable): its card shows "web address" and `https://x`.

## Ownership boundary
`viewer/pages/project-tools.js`, `viewer/test/app-project-tools.spec.js`.

## Validation
Run twice; both must pass:
```
npm --prefix viewer run test:browser -- app-project-tools.spec.js app-settings.spec.js
```

# Task R6-2 — page: two Log 50 leftovers in `buildEntry`

Plan slug: project-tools-screen. Task id: R6-2. Decision Log 50 and the Spec's Editing section in PLAN.md: anything the user didn't edit is written back exactly as read. File: `viewer/pages/project-tools.js`, function `buildEntry` (~lines 590-640).

1. **A touched field that ends equal to the original is copied from the original.** For each field the form rebuilds (`command`, `url`, `args`, `env`, `headers`): after building the new value from the form, if it deep-equals what `parseEntry` gave for the original entry (same rows/lines/strings, same presence), write the ORIGINAL raw value instead (keeping absent as absent, `{}` as `{}`, `[]` as `[]`). Only a field whose final value differs is replaced or removed. This covers "add a setting, then remove it" and "type in a field, then restore it".
2. **No trimming of command or URL.** Write `command` and `url` exactly as typed (remove `.trim()` at ~:621 and ~:632). Keep refusing an empty command/URL (check `value.trim() === ''` for emptiness only).

## Tests (append to `viewer/test/app-project-tools.spec.js`; one each)
- A command tool `{ command: "run", env: {}, args: [] }`: open the editor, add a setting, remove it, type in Arguments and clear it, change the command to `run2`, Save: the entry is `{ command: "run2", env: {}, args: [] }`.
- A web tool `{ type: "http", url: "https://a", headers: {} }`: change the URL to `" https://b "` → Save sends `url: " https://b "` (not trimmed) and `headers: {}`.
- Typing in the URL field and restoring the original text sends the entry unchanged (deep-equal to the raw entry).

## Ownership boundary
`viewer/pages/project-tools.js` (`buildEntry` and the two `.trim()` sites only), `viewer/test/app-project-tools.spec.js` (append only).

## Validation
Run twice; both must pass:
```
npm --prefix viewer run test:browser -- app-project-tools.spec.js app-settings.spec.js
```
