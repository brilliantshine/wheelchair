# Remediation 3 — verification attempt 3 (commit 96feb07)

Claude verifier: PASS. GPT verifier: FAIL with 7 gaps. Two are families that survived two fix attempts (A, B); they went to Collin through the lead, and his answers are Decision Log 48 and 49. The lead decided gaps 1-5: fix all, defer none.

## Gaps (verbatim from the GPT verifier, grouped)

A. (surviving: attempt-1 gap 2, attempt-2 gap 2) Machine and project picker — After switching machines, the previous machine's projects remain selectable while the picker loads. Selecting one sends its path to the new machine and causes the new machine's picker response to be discarded … `viewer/pages/project-tools.js:165–191`.
B. (surviving: attempt-1 gap 5, attempt-2 gap 1) Key warnings — Removing an initially set key can leave its missing-key warning absent on a tool with a read-only reference. Editing away an unset reference can leave its old warning visible … `machine/lib/project-tools.js:25–27`, `viewer/pages/project-tools.js:338–353`.
1. Editing headers — Renaming an editable header to the name of a read-only header later in the list is accepted and silently discards the editable header … `viewer/pages/project-tools.js:493–499,543–550`.
2. Preserving arguments — Renaming a tool silently strips a trailing carriage return from an untouched argument … `viewer/pages/project-tools.js:96,557–559`.
3. Saving a first tool — In a project that ignores its local `.mcp.json` and has no tracked copy, Save cannot create the configuration PR … `git add` refused the ignored file. `machine/lib/project-tools.js:127–135`.
4. Shared keys — The card and editor omit "shared with" when the other tool uses the same key through a read-only setting … `viewer/pages/project-tools.js:303–312,428–437`. (Folded into B.)
5. Save and Remove reply contract — An unreadable key store produces a `failed` response without `key_revision` or `keys` … `machine/lib/project-tools.js:89,150`.

## Tasks

| Task | Gaps | Lane |
|---|---|---|
| R3-1 | A, B (page), 1, 2, 4 | standard, `--provider claude` |
| R3-2 | B (machine per-tool names), 3, 5 | standard, `--provider gpt` |

# Task R3-1 — page: lock while loading, key warnings from per-tool names, two editing gaps

Plan slug: project-tools-screen. Task id: R3-1. See `docs/plans/project-tools-screen/REMEDIATION-3.md`, and PLAN.md Decision Log 48 and 49 (Collin's answers A and B, already folded into the Spec's Reading and Keys sections). File: `viewer/pages/project-tools.js` (read it whole first). Each fix is settled; implement it as written.

A. **Lock while loading (Log 48).** Add `state.loading`. It is true from the moment a machine change starts the picker load (`GET /new-thread`), a project pick starts a Read, or `handle()` starts the reload after `opened`/`pr_failed`/409, until that request answers (success or failure). While loading: the machine and project selects are disabled; every button, input, select and textarea in the section's view is disabled; Save, key Set/Add/Remove, Start over, tool Add/Edit/Remove and form submit do nothing. On a machine change, clear the project select's options at once (only the "Choose a project…" placeholder remains) before the request starts, so the previous machine's projects can't be picked. Keep the existing `gen` tagging as is. When the load ends, repaint with controls enabled (respecting `state.busy` as now).

B. **Key warnings and "shared with" from per-tool names (Log 49).** The machine's read now gives each tool `checks[name].keys` (key names the tool references in the loaded baseline, read-only references included) and `checks[name].held_back` (names held back); `skip` and `key_warnings` stay. On the tool card:
   - render every machine `key_warnings` string EXCEPT those matching `needs <NAME>, not set on this machine` (those are now computed);
   - for each NAME in `checks[name].keys`, show "needs NAME, not set on this machine" while `!state.keys.includes(NAME)`. Nothing else adds or removes these lines: they follow the loaded baseline, not draft edits (remove the draft-computed "needs" lines added earlier and the `dataset.needs` channel).
   - "shared with": for each NAME in `checks[name].keys`, the other tools whose `checks[other].keys` include NAME: "shared with <other> (<NAME>)". In the editor, the hint under a key row lists the tools (other than the one being edited) whose `checks[*].keys` include the typed key name. Remove the draft-based `toolsUsingKey` computation.
   - A tool with no `checks` entry (added in the draft) shows no key warnings and no "shared with".
1. **Header rename onto a read-only header (gap 1).** In `apply()`, the duplicate-name check must include read-only rows' names: refuse "<name> is listed twice." when an editable setting or header is named the same as any other row, read-only or not (exact string match).
2. **Arguments with `\r` are read-only (gap 2).** In `parseEntry`, `argsRO` is also true when any argument contains `\r`.

## Tests (append to `viewer/test/app-project-tools.spec.js`; one each)
- A: switching machine clears the project list immediately and disables the selects and Save until the picker answers (gate the stub); picking a project disables actions until the read answers; after an `opened` Save the section is disabled until the reload answers.
- B: tools `a` (env `TOKEN: "${TOKEN}"`) and `b` (env `ALIAS: "${TOKEN}"`, read-only) with `checks.a.keys = ["TOKEN"]`, `checks.b.keys = ["TOKEN"]`, TOKEN stored: no "needs"; remove TOKEN → both show "needs TOKEN, not set on this machine"; set it → both lines go; both cards show "shared with" the other. Editing `a` to drop its TOKEN setting (unsaved) doesn't change the warnings.
- 1: renaming an editable header to a read-only header's name is refused and the Save body keeps both.
- 2: args `["left\rright","last\r"]` are read-only and a tool rename sends them unchanged.

## Ownership boundary
`viewer/pages/project-tools.js`, `viewer/test/app-project-tools.spec.js`.

## Validation
Run twice; both must pass:
```
npm --prefix viewer run test:browser -- app-project-tools.spec.js app-settings.spec.js
```

# Task R3-2 — machine: per-tool key names, ignored `.mcp.json`, complete `failed` replies

Plan slug: project-tools-screen. Task id: R3-2. See `docs/plans/project-tools-screen/REMEDIATION-3.md` and PLAN.md Decision Log 49 (Collin's answer B).

1. **Per-tool key names (Log 49).** In `checksFor` (`machine/lib/project-tools.js`, ~line 19), add to each tool's check two arrays: `keys`, the sorted unique key names this tool references in eligible places (exactly the names whose `references[name]` includes this tool, so read-only references such as `ALIAS: "${TOKEN}"` or a header with two `${...}` are included), and `held_back`, the sorted unique names in `heldBack` with a record for this tool. Keep `skip` and `key_warnings` exactly as now. Shape per tool: `{ skip, key_warnings, keys, held_back }`. Use null-prototype objects as the rest of the file does. Update `docs/plans/project-tools-screen/API.md` (the `checks` example and a one-line note) to match.
2. **Ignored `.mcp.json` (gap 3).** In Save step 4, stage the file with `git add -f -- .mcp.json` in the temporary worktree.
3. **Complete `failed` replies (gap 5).** Every `failed` reply from `save` and `removeKey` carries `key_revision` and `keys`: the last known store values, or `0` and `[]` when the store couldn't be read at all (`machine/lib/project-tools.js` ~lines 89 and 150, and any other `failed` path).

## Tests (append; one each)
- `machine/test/project-tools.test.js`: read of a source with tools `a` (env `TOKEN: "${TOKEN}"`), `b` (env `ALIAS: "${TOKEN}"`), `c` (header `X: "${H1}${H2}"`), `d` (args `["${TOKEN}"]` plus env `TOKEN: "${TOKEN}"`): `checks.a.keys` = `["TOKEN"]`, `checks.b.keys` = `["TOKEN"]`, `checks.c.keys` = `["H1","H2"]`, `checks.d.held_back` = `["TOKEN"]`.
- a clone whose `.gitignore` (committed on the default branch) ignores `.mcp.json` with no tracked copy: Save of one tool replies `opened` and the pushed branch has `.mcp.json`.
- an unreadable key store (invalid JSON in the store file): Save and Remove reply 502 `failed` with `key_revision: 0` and `keys: []`.

## Ownership boundary
`machine/lib/project-tools.js`, `machine/test/project-tools.test.js`, `docs/plans/project-tools-screen/API.md`.

## Validation
```
bash machine/test/run.sh
```
