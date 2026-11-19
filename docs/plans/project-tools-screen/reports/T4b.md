# T4b — page: reserved-name references and section kept across re-renders

## What changed

- `viewer/pages/project-tools.js`
  - Added `reservedLists` and `isReservedName(name)` after `KNOWN_OUTCOMES`. `readProject` sets `reservedLists` from `body.reserved` right after `state.read = body`.
  - `reservedProblem(name)` now returns `isReservedName(name)`.
  - `classifyEnv`: a value exactly `${name}` with a reserved `name` becomes `{ ro: true, env: true, name, raw }`, not a key row.
  - `classifyHeader`: a `${NAME}` whose `NAME` is reserved becomes `{ ro: true, env: true, name, raw }`, not a key row.
  - `rowLine` and `rowEditor`'s `row.ro` branch show "(from the agent's own environment)" when `row.env` is set; other read-only rows keep their old hints.
  - The kind-change refusal ignores `env` rows (`x.ro && !x.env`). `buildEntry` is unchanged, so these rows are still kept verbatim.
- `viewer/pages/settings.js` (Change 2 only): `renderProjectTools()` now builds the Project tools host once (`projectToolsHost`) and reuses it on every `renderPanel()`.
- `viewer/test/app-project-tools.spec.js`: appended two tests.
  - "a reserved name referenced in a setting is read as the agent's own environment, not a key": a `PATH: "${PATH}"` row shows the hint with no chip, and saving an edit to the command sends `PATH: "${PATH}"` unchanged with no error.
  - "an unsaved tool removal survives a Settings re-render": a removal survives `hashchange`, Save stays enabled, and there is no re-read.

## Validation

Command: `npm --prefix viewer run test:browser -- app-project-tools.spec.js app-settings.spec.js`
Log: `/tmp/claude-1000/-home-collin--local-state-wheelchair-worktrees-wheelchair-wc-406595075040-w5/4a43a413-bc2b-4747-b624-e63ab6df00e6/scratchpad/t4b.log`

```
exit 0
  ✓   94 [firefox] › test/app-settings.spec.js:409:1 › a later dropdown choice wins over a slow upload save (1.9s)
  ✓   95 [firefox] › test/app-settings.spec.js:426:1 › a slow upload does not undo a list picked after switching sections (3.7s)
  ✓   96 [firefox] › test/app-settings.spec.js:457:1 › picking Custom while another list saves keeps Custom and its file picker (1.5s)
  ✓   97 [firefox] › test/app-settings.spec.js:484:1 › Custom picked again during a slow upload and another save stays Custom (1.6s)
  ✓   98 [firefox] › test/app-settings.spec.js:508:1 › a failed save of another list keeps a later pick of Custom (1.0s)
  ✓   99 [firefox] › test/app-settings.spec.js:528:1 › only the newest uploaded file is saved (4.4s)
  ✓  100 [firefox] › test/app-settings.spec.js:550:1 › models and preferences fits at 390px (856ms)

  100 passed (1.4m)
```

The two new tests are in the run: `app-project-tools.spec.js:342` (reserved-name environment) and `:360` (re-render), both ✓ on Chromium and Firefox. The output above is the tail of the log (`tail -n 80`); the summary line is `100 passed`, with no failures.

## Not done

Nothing in the brief was left undone. I did not start a viewer server by hand; the suite starts its own through `helpers/server.js`.

## Choices

- `viewer/pages/project-tools.js` `rowEditor`: the read-only hint is the brief's exact text "(from the agent's own environment)", with parentheses. The existing non-env text in that branch is "edit in the file (kept as is)" without parentheses, so the two wordings differ in form.
- `viewer/pages/project-tools.js` `classifyHeader`: the reserved check runs only when the header value matches the `^([^$]*)\$\{NAME\}$` form, so a header such as `"Bearer ${PATH}"` gets the env read-only row. Mixed values with other `${` text still fall through to the existing read-only path.
- `viewer/pages/project-tools.js`: `reservedLists` is module state inside the IIFE, so it is shared across `render()` calls. It is overwritten on each read, as the brief specified.
- `viewer/test/app-project-tools.spec.js`: the new environment test uses a tool named `app` (command `node`) and asserts `calls.save[0].tools.app` deep-equals the saved entry, rather than checking only the PATH field.
