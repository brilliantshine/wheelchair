# Remediation 4 — verification attempt 4 (commit cccad56)

Both verifiers FAIL; all Remediation 3 items confirmed. Four distinct gaps after merging one duplicate. Lead: fix all four, defer none. Gap 1 counts as the first fix attempt under Collin's clarified rule (Log 49); if it returns, it goes to the lead.

## Gaps (verbatim, merged)

1. (both) Reading/Keys (Log 49) — Renaming a tool in the form, without saving, removes its skip reason, its "needs <key>, not set on this machine" line and its "shared with" line. Meanwhile the other tool's card still says "shared with db" … `viewer/pages/project-tools.js:335` (`own(r.checks, name)` with the draft name) and `:357`.
2. Key confidentiality — A malformed key store exposes part of a stored value in the Read, Save and Remove replies … the machine forwards the raw JSON parser error. — `machine/lib/project-keys.js:49`, `machine/lib/project-tools.js:73`, `:91`, `:152`.
3. Editing an existing tool — Editing only a web tool's URL drops an existing `headers: {}` from the Save body. That also changes whether Codex skips the tool … `viewer/pages/project-tools.js:573–578`, `machine/adapters/codex.js:32`.
4. Reload after a stale Save — When Save returns 409 and the follow-up Read returns 504, the page hides the read error and says "The project was reloaded" while showing no tools … `:237–240`, `:700–703`. (The other verifier noted the same after an `opened` Save, `:678-680`.)

## Tasks

| Task | Gaps | Lane |
|---|---|---|
| R4-1 | 1, 3, 4 (page) | standard, `--provider claude` |
| R4-2 | 2 (machine) | standard, `--provider gpt` |

# Task R4-1 — page: baseline names across renames, untouched fields, failed reloads

Plan slug: project-tools-screen. Task id: R4-1. Gaps 1, 3 and 4 in `docs/plans/project-tools-screen/REMEDIATION-4.md`; Decision Log 49 in PLAN.md. File: `viewer/pages/project-tools.js` (read it whole first). Each fix is settled; implement it as written.

1. **Cards use the baseline name (Log 49).** Keep a map from each draft tool name to the baseline tool name it came from: set on read (identity for every source tool), carried across renames in `apply()`, removed when a tool is removed, and absent for tools added in the draft. On a card, look up `checks` (skip reasons, machine warnings, `keys` for "needs X" and "shared with") by the tool's baseline name. "shared with" lists the OTHER tools' current draft names (translate baseline names through the map), and omits any baseline tool the draft has removed. The editor's "shared with" hint uses the same translation. A draft tool with no baseline name shows no checks, as now.
3. **Untouched fields are sent exactly as read (general rule).** In `buildEntry`, every field the user didn't change keeps its original value exactly, including empty objects and arrays. Concretely: `env` / `headers` are rebuilt only when the form's rows differ from the rows parsed from the original entry (compare by name, mode, value, prefix and key name, and order); when they're equal, the original value is kept (`headers: {}` stays `{}`, a missing `env` stays missing). The same applies to `args` (unchanged lines → the original array as is), `command`, `url` and `type`: a field whose form value equals what was parsed from the original is left exactly as the original (including absent vs present). Only fields the user changed are replaced or removed.
4. **Failed reloads are shown.** When the reload after a Save (`opened`, `pr_failed`) or after a 409 fails, show the Save's own message (PR link, compare link, or the 409 reason) followed by "Couldn't reload the project: <reason>" and a "Reload" button that runs the read again. Never say "The project was reloaded" when it wasn't.

## Tests (append to `viewer/test/app-project-tools.spec.js`; one each)
- Baseline `db` (Codex skip reason, `checks.db.keys = ["DB_TOKEN"]`, unset) and `other` (`checks.other.keys = ["DB_TOKEN"]`): rename `db` to `db2` with "Keep changes": the `db2` card still shows the skip reason, "needs DB_TOKEN, not set on this machine" and "shared with other (DB_TOKEN)"; the `other` card says "shared with db2 (DB_TOKEN)". Remove `db2` (unsaved): `other` no longer lists it.
- A web tool `{ type: "http", url: "https://a", headers: {} }`: editing only the URL sends `headers: {}`. A command tool with no `env` and no `args`: editing only the command sends no `env` and no `args` keys. A tool whose args are unchanged but whose command changed keeps the args array exactly.
- 409 followed by a 504 read: the 409 reason, "Couldn't reload the project: …" and a Reload button show, and no "reloaded" wording. `opened` followed by a failed read: the PR link plus the reload error.

## Ownership boundary
`viewer/pages/project-tools.js`, `viewer/test/app-project-tools.spec.js`.

## Validation
Run twice; both must pass:
```
npm --prefix viewer run test:browser -- app-project-tools.spec.js app-settings.spec.js
```

# Task R4-2 — machine: key-store errors never carry stored content

Plan slug: project-tools-screen. Task id: R4-2. Gap 2 in `docs/plans/project-tools-screen/REMEDIATION-4.md`. The Spec says key values never reach the screen, the hub or logs.

## Change
- `machine/lib/project-keys.js` `readKeyStore` (~line 49) and `writeKeyStore`: never throw an error whose message or properties can contain file content. Catch every parse, shape and read error and throw a new `Error('the key store on this machine can\'t be read')` (for a write failure: `Error('the key store on this machine can\'t be written')`), with no `cause` attached. Keep `code` only if it is an fs error code such as `EACCES`, and don't include the path or content.
- `machine/lib/project-tools.js`: every place a key-store error reaches a reply (Read `notice` ~line 73, Save ~91, Remove ~152, the `failed` helpers) uses only that fixed message.
- `machine/service.js` session launch (the key injection added in T1, ~lines 620-640): the `console.error` for a key-store failure logs only the fixed message (no `error.message` from parsing).
- There is no lock or status route in this build (Deferred rows 2), so nothing else to scrub.

## Test (append to `machine/test/project-tools.test.js`)
Write a malformed key-store file for the project containing a recognisable value (e.g. `{"project":"…","revision":1,"keys":{"K":"SECRET-VALUE-123"` with the closing braces missing, and a second variant with valid JSON but a wrong shape such as `"keys": "SECRET-VALUE-123"`). Call Read, Save (key-only) and Remove, and start a Claude worker session whose `.mcp.json` references `K` (as the T1 launch tests do), capturing `console.error`. Assert `SECRET-VALUE-123` appears in no reply body (JSON-stringified) and in no captured log line, and that the replies carry the fixed message.

## Ownership boundary
`machine/lib/project-keys.js`, `machine/lib/project-tools.js`, `machine/service.js` (that one log line only), `machine/test/project-tools.test.js`.

## Validation
```
bash machine/test/run.sh
```
