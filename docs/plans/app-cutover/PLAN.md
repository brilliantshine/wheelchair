---
slug: app-cutover
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-15
---

# Remove the old terminal workflow

**Idea:** `IDEA.md`. **Map:** `MAP.md`.

## Open Questions

None.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D1 | `/graph` and `/diagram-sensitivity` are removed with the five stage commands; diagram sensitivity becomes a Settings control. Supersedes app-shell D42's keeping of both commands. | Collin: "graph should just be a thing native to the app, not in a command. diagram sensitivity should become a setting." | idea-change |
| D2 | The setting reaches every session on the machine, in the app and in a plain terminal, by writing each present CLI's global instructions as `sensitivity/set.sh` does now. | Collin picked "App and terminal" | user |
| D3 | `protocol/writing.md`, `lanes.md` and `map.md` are dropped without porting. | App roles reference none of them (MAP.md, "Sensitivity and retained app rules"); each app role states its own rules, and the app-settings proposal already drops the writing rules for all agents in favour of the lead's style | defaulted |
| D4 | Installed wrappers for the seven retired commands are removed when their text is the shape wheelchair renders (a pointer to `<some root>/protocol/<file>.md`), whichever checkout rendered them. Anything else under those names survives. | The `spine` check matches only this checkout's exact path (`install.sh:77-86`), which misses a moved clone; the rendered shape is distinctive enough | defaulted |
| D5 | `seen` cleanup: the installer removes hook handlers whose command is `<path>/seen/hook.sh <harness> ...` from Claude `settings.json` and Codex `hooks.json` (dropping a group only when emptied), the `Bash(<path>/seen/wording.sh:*)` permission, and the wording-directory write grant only when it equals wheelchair's own wording directory. Malformed files are reported and left untouched; install continues with a warning. The wording list on disk is left alone. | Ownership by path shape survives deleting `protocol/seen.md` (MAP.md notes the current check needs it); the directory grant has no marker, so only the exact wheelchair path is safe to remove; user data is not deleted | defaulted |
| D6 | The Settings control goes through the hub to the machine service, which runs `sensitivity/set.sh <level>` from its own clone. Refusals (two files at different levels, a malformed block, a Codex override) are shown on Settings in plain words. | The machine service owns per-machine state; the same route later reaches worker machines | defaulted |
| D7 | The dial's text says to move it on the app's Settings page, and its `ask` carve-out points at `protocol/app/lead.md` (Diagrams). `graphs.md` and `diagrams.md` lose their references to removed files and commands. | App-shell D42 retargets the dial; D1 removes the command it names | defaulted |
| D8 | `WHEELCHAIR_LANE=1` set by the machine service and asides stays. | Harmless once the hook is gone; removing it touches the app and is out of scope | defaulted |
| D9 | Graphs live in the thread, not in a tab: the right column lists every picture the thread has posted; a picture still shows inline in its card; clicking it (in the column or the card) opens it full size in the app, with a way back to the thread. No Graphs tab. | Collin: "on the right sidebar, show all the graphs that this thread uses. no graphs tab. graphs still open as they do within the thread and open fully when clicked and you can go back to the thread easily." | user |
| D10 | Full size is a new app page, `/wheelchair/app/picture?thread=<id>&card=<card id>`, opened in the same tab, with a Back to thread link like the document page. It covers all three formats (graph, form, html), so forms gain a full-size view too. | The graph viewer, raw form JSON and sandboxed HTML cannot each carry a back link; one app page can | defaulted |
| D11 | Phones, which have no right column, list the same pictures under the sticky header after MAP/IDEA/PLAN. | Same list wherever the thread is read | defaulted |
| D12 | Graphs a terminal agent draws keep working as today (the dial sends it to `protocol/graphs.md`, which writes under the cache root and opens the viewer); they are not listed in the app. | D9 scopes the app to the thread's graphs; terminal drawing must survive D2 | defaulted |
| D13 | The Settings control is a "Diagrams" section on the Models tab, after "Threads": three choices (ask, default, high) with one line each, showing the level the machine's files hold. | The app-settings redesign can move it; one control is all D1 needs | defaulted |
| D14 | D5 amended: the `~/.wheelchair` write grants stay. `seen/set.sh` granted `~/.wheelchair` (`seen/set.sh:49-52`), which also holds the model pins (`codex/model.sh`), so it is shared wheelchair state, not seen's alone, and may predate the hook. | Removing it could break other wheelchair writes; leaving a grant to wheelchair's own folder costs nothing | defaulted |

## Spec

### 1. What goes

Source files removed (`git rm`):

- `skills/{plan,adopt,plan-review,implement,verify,graph,diagram-sensitivity}/`
- `codex/prompts/{plan,adopt,plan-review,implement,verify,graph,diagram-sensitivity}.md`
  (the directory is then empty and goes too)
- `protocol/{planning,adopt,plan-review,implementation,verification,lanes,map,writing,seen}.md`
- `protocol/templates/SEEN.md`
- `seen/` entirely (scripts, router, tests)
- `skills/AGENTS.md` and `codex/AGENTS.md`'s wrapper-convention text, rewritten for what
  is left (see 6). If `skills/` is empty after removal, the directory and its router go,
  and `install.sh` stops rendering skills.

Kept: `protocol/graphs.md`, `protocol/diagrams.md`, `protocol/sensitivity.md`,
`sensitivity/`, `codex/model.sh`, `codex/preflight.sh`, `protocol/app/`,
`protocol/templates/{IDEA,PLAN}.md`, the graph viewer (`viewer/index.html`, `list.html`).
`docs/plans/`, `docs/proposals/` and `docs/maps/` are history and are not edited, except
this plan.

### 2. The installer removes what it rendered before (D4, D5)

`install.sh`, for each present harness, before rendering anything:

- **Retired wrappers.** The retired list is `spine plan adopt plan-review implement verify
  graph diagram-sensitivity`. For each name: a Claude `skills/<name>/SKILL.md` or a Codex
  `prompts/<name>.md` is removed (the skill's whole directory, or the prompt file) when its
  text contains a line naming `<some absolute path>/protocol/<file>.md`, where `<file>` is
  that wrapper's protocol file: spine→spine, plan→planning, adopt→adopt,
  plan-review→plan-review, implement→implementation, verify→verification,
  graph→graphs, diagram-sensitivity→sensitivity. Any root path matches (a moved or other
  clone). A same-named file without that line is left alone. Each removal prints
  `removed old wrapper: <path>`. A symlink at that path is removed only if it points into a
  wheelchair checkout (target path ends in `/skills/<name>` or `/codex/prompts/<name>.md`).
- **The seen hook**, by a small script `install/unseen.py` (Python 3, stdlib only), run
  with the Claude home and Codex home of present harnesses:
  - Claude `settings.json`: in `hooks.UserPromptSubmit`, drop each handler whose `command`,
    split shell-style, has a first word ending in `/seen/hook.sh`; drop a group whose
    `hooks` list becomes empty; drop `UserPromptSubmit` if it becomes empty, and `hooks` if
    that becomes empty. In `permissions.allow`, drop entries matching
    `Bash(<path>/seen/wording.sh:*)`. Emptied lists stay as `[]`; containers are never
    dropped except the hook ones above.
  - Write grants for `~/.wheelchair` (Claude `sandbox.filesystem.allowWrite`, Codex
    `writable_roots`) are **kept** (D14).
  - Codex `hooks.json`: the same handler and group rule.
  - A file that is missing is skipped. A file that does not parse, or a TOML shape the
    script cannot edit safely, is left untouched with a warning naming it; the install
    continues. Nothing changes when there is nothing to remove, so a second run writes no
    file (mtime unchanged).
  - Other keys, hooks and formatting in JSON are preserved (rewritten with the same indent
    `seen/set.sh` used); writes go through a temporary file and rename.
  - The wording list on disk is not deleted.
- The call to `seen/set.sh` and its `seen hook:` lines are removed. A line
  `seen hook: removed` or `seen hook: nothing to remove` is printed instead.
- The router and README text about the seen hook and the `seen/set.sh` write grant go.

### 3. The dial (D2, D6, D7, D13)

`protocol/sensitivity.md` region text changes:

- "Move the dial with `/diagram-sensitivity <level>`" becomes "Move the dial on the
  wheelchair app's Settings page (Models, Diagrams)".
- The `ask` carve-out: "a thread lead drawing a proposed flow, as
  `{{WHEELCHAIR_ROOT}}/protocol/app/lead.md` (Diagrams) has it".
- The rest of the file: "The command" section is replaced by "Moving the dial" describing
  the Settings control and that it runs `sensitivity/set.sh <level>`; the `/graph` bullet
  under "What the dial does not govern" goes. The level line, writer's contract and
  examples stay.
- `sensitivity/test/run.sh` probes that named `protocol/planning.md` are updated to the new
  text.

Route, end to end:

```
Settings (Models > Diagrams) --GET /settings--> hub --GET /v1/diagram-sensitivity--> machine
   pick a level --POST /settings/diagram-sensitivity {level}--> hub --POST /v1/diagram-sensitivity--> machine runs sensitivity/set.sh <level>
```

- Machine service, two new hub-only routes (same auth as other hub routes), documented in
  `machine/API.md`:
  - `GET /v1/diagram-sensitivity` runs `<its clone>/sensitivity/set.sh --report`, and
    returns `200 {level, files:[{harness, level|null}], text}` where `level` is the agreed
    level or null when files disagree or none holds a block.
  - `POST /v1/diagram-sensitivity {level}` (`ask|default|high`, else `400`) runs
    `sensitivity/set.sh <level>` with a 30 s timeout. Exit 0: `200 {level, text}`. Non-zero:
    `422 {error: <its last non-empty stderr line>}`. Never runs two at once (a second request
    while one runs gets `409`).
  - If parsing `--report` output is fragile, add a `--json` flag to `set.sh --report`
    instead; the writer's contract is otherwise unchanged.
- Hub: `GET /settings` gains `diagram_sensitivity: {machines: {<machine>: {level, files} |
  {error}}}`; `POST /settings/diagram-sensitivity {level}` forwards to every configured
  machine, returns `{machines: {<machine>: {level} | {error}}}`, `200` if all succeeded,
  `207`-style `200 {partial:true}` is not used: return `502` with the per-machine map when
  any failed. Documented in `viewer/app/API.md`. The hub stores nothing; the machines'
  files are the truth.
- Settings page: a "Diagrams" section after "Threads" on the Models tab. Three radio
  choices with one line each: ask "Only when you ask, or a lead draws a proposed flow";
  default "When the arrangement is the answer"; high "Whenever there is a shape". The
  current level is selected; when files disagree, none is selected and a note says which
  CLI holds which level. Choosing one saves at once and shows the existing section note
  (`setNote`) "Applies from each agent's next session". An error shows the machine's reason
  in plain words via `setNote(..., true)`.

### 4. Graphs in the thread (D9-D12)

- The right column's "This thread's files" list keeps its pictures entry (already there,
  `viewer/pages/thread.js:198-206`), one per `diagram` card, now deduplicated by
  `plan`+`graph` (latest card's title wins), and each link goes to the picture page in the
  same tab (no `target=_blank`).
- The `diagram` card keeps its inline picture. Its "Open full screen" link becomes "Open
  full size", goes to the picture page in the same tab, and is shown for all three formats
  (forms included).
- Phones: `headFilesEl` (the header strip) lists the same picture links after the plan
  files.
- New app page `viewer/pages/picture.html` + `picture.js` (`picture` added to `APP_PAGES`,
  `viewer/server.js:1700`), modelled on `doc.html`/`doc.js`: `?thread=<id>&card=<card id>`;
  a header with a Back to thread link (`/wheelchair/app/thread?id=<id>`) and the card's
  title; the body fills the viewport with the picture, drawn the way the card draws it
  (graph and html in an iframe using the same `diagramSource` URL, html sandboxed; form
  rendered by the same code as the card, moved to a shared script both pages load). It
  reads the card from the thread's chat (`GET /threads/:id/chat`). Archived threads work as
  the card does today. Unknown card or thread: a plain message and the back link.
- Browser back also returns to the thread (same-tab navigation).

### 5. Text that names removed things

Every reference outside `docs/plans/`, `docs/proposals/` and `docs/maps/` to a removed file
or command is removed or reworded (MAP.md "References to resolve" lists them):
`AGENTS.md` (root; Executable row loses `seen/`, the "second reach" paragraph goes, the
Where-to-go rows for `seen/` and `skills/`/`codex/` updated, verification commands lose
`seen/test/run.sh`), `protocol/AGENTS.md`, `skills/AGENTS.md`, `codex/AGENTS.md`,
`protocol/graphs.md` (its three triggers become two: a thread lead's diagram, and an
ordinary turn under the dial; lanes/planning/implementation references go),
`protocol/diagrams.md` (`map.md` references point at `protocol/app/mapper.md` or go),
`protocol/templates/PLAN.md:70`, `README.md` (teaches the app, not commands),
`CONTRIBUTING.md`, `docs/known-issues.md` (a lane issue whose code is gone is deleted;
otherwise reworded). `install.sh`'s header comment and output lines.

Check: `git grep -nE 'protocol/(planning|adopt|plan-review|implementation|verification|lanes|map|writing|seen)\.md|seen/(hook|set|wording)\.sh|/(plan|adopt|plan-review|implement|verify|graph|diagram-sensitivity)\b' -- ':!docs/plans' ':!docs/proposals' ':!docs/maps'`
returns only deliberate mentions in `install.sh`, `install/unseen.py`, `install/test/` and
this list's retired-name table; each remaining hit is justified in the completion report.

### 6. Routers

`AGENTS.md` (root), `protocol/AGENTS.md`, `codex/AGENTS.md`, `skills/AGENTS.md` (or its
removal), `install/` row (adds `unseen.py`) and `sensitivity/AGENTS.md` (the writer is now
also run by the machine service) say what is true after the change.

### 7. Tests

- `install/test/run.sh`: the `spine_*` cases generalise to every retired name, with:
  a seeded wrapper from this clone and one from another absolute root both removed (both
  harnesses); a same-named foreign file kept; a file mentioning a different protocol file
  kept. A `seen_removed` case seeds Claude `settings.json` with a seen handler, an unrelated
  handler in the same group, an unrelated group, the wording permission, an unrelated
  permission and the `~/.wheelchair` write grant, plus Codex `hooks.json` likewise and a
  `config.toml` with the grant; after install only the seen handlers and permission are
  gone, parsed JSON is otherwise equal, the grants remain and `config.toml` is
  byte-identical. A malformed `settings.json` is left byte-identical and install exits 0 with
  a warning. `both_idempotent` drops the seen-hook assertion and adds: no
  `UserPromptSubmit` seen handler, no retired wrapper, and the second run changes no file.
- `sensitivity/test/run.sh` updated for the new region text and passes.
- `machine/test/run.sh` gains cases for both routes: report, set, bad level 400, writer
  refusal 422, concurrent 409 — using a fake `sensitivity/set.sh` via the suite's existing
  root/fixture seam (add one if none).
- `node --test viewer/test/*.test.js` gains hub route tests (forward, partial failure
  502) and a picture-page server test (page served, unknown card).
- `npm --prefix viewer run test:browser` gains: Settings Diagrams section selects and saves;
  thread right column lists deduplicated pictures, clicking opens the picture page in the
  same tab, Back to thread returns; phone width lists pictures under the header.

### Validation commands

```bash
bash sensitivity/test/run.sh
bash codex/test/run.sh
bash install/test/run.sh
bash machine/test/run.sh
node --test test-support/test/*.test.js
node --test viewer/test/*.test.js
npm --prefix viewer run test:browser
git grep (section 5)
```

`./install.sh && ./install.sh` with `git status --porcelain` empty is run by Collin from
the canonical clone after merge (it refuses in a worktree); `install/test/run.sh`'s
idempotence case is the in-worktree proof.

### Non-goals

- No change to sessions, cards, leads or review flow.
- No redesign of Settings beyond the one section.
- No Graphs tab; terminal-drawn graphs are not listed in the app.
- `WHEELCHAIR_LANE=1` stays.
- Old plans, proposals and maps are not edited.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-15

**Lanes:** Claude (intent); GPT (mechanics); cross-family: yes.

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
