# Remediation 4 — project-tools-solid

Verification attempt 4 on `0e852e1`: Claude verifier PASS; GPT verifier FAIL with three gaps. Collin chose option A (fix all three, including a third and final attempt at the duplicate-header gap; if it survives, raise it again rather than loop).

## Gaps (verbatim)

1. GAP: §4 Antigravity cleanup — A live session can keep an ended session's private tool file past the 60-second grace period. In isolated tmux, `wc-name.part-worker` ended and `wc-name_part-worker` started. Both appeared under the same tmux name, and the sweep kept the ended session's file. [machine/service.js:403]
2. GAP: §§1, 3–4 duplicate headers — The reader carries duplicate-header findings from a superseded `mcpServers` object into the one it actually uses. With two `mcpServers` keys, the effective `web` entry had one header, but both adapters skipped it with "has the same header twice." [machine/lib/project-mcp.js:96]
3. GAP: §§7–8 card text — The card's Markdown renderer changes valid tool names. The actual renderer displayed `_tool_: its program can't be found` as "tool: its program can't be found," dropping both underscores. [viewer/pages/thread.js:787]

Gap 2 is the third attempt (after R1, R3). Gap 1 is the second (after R5). Gap 3 is new.

Not counted as gaps: machine fixture `fetch failed` (passed on rerun), viewer port collision and `app-quiet` "6 message clears debt" (known flaky), installer live `~/.wheelchair` comparison (passes with an isolated home).

## Tasks

### R7

Gap from verification attempt 4 (verbatim): "§§1, 3–4 duplicate headers — The reader carries duplicate-header findings from a superseded `mcpServers` object into the one it actually uses. With two `mcpServers` keys, the effective `web` entry had one header, but both adapters skipped it with "has the same header twice." [machine/lib/project-mcp.js:96]"

This is the third and final attempt at this gap; earlier attempts (R1, R3) made the scan exact and iterative. That part is right: keep the iterative scan (no recursion, no try/catch around it, still handles deep nesting within 32 KiB).

Ownership boundary: `machine/lib/project-mcp.js` (only `duplicateHeaderServers` and, if needed, its call site at ~line 96), `machine/test/project-mcp-reader.test.js`, your report `docs/plans/project-tools-solid/reports/R7.md`. Touch nothing else.

## The rule
JSON.parse keeps the LAST occurrence of a repeated key. A server is flagged as having duplicate headers only when the `headers` object JSON.parse actually kept for it has two keys equal case-insensitively. That `headers` object is: the last `headers` key inside the last occurrence of that server name inside the last `mcpServers` key of the root object. Duplicates found in any earlier (overwritten) occurrence — an earlier `mcpServers`, an earlier same-named server entry, or an earlier `headers` key — do not count. Equally, a duplicate inside the kept occurrence still counts even when earlier occurrences had none.

A suggested shape (not required): give each object frame an occurrence counter per key, so every `headers` object found has an identity (mcpServers occurrence index, server name, server occurrence index, headers occurrence index); record findings by identity; after the scan, keep only findings whose indices are the last for their key. Keys are compared exactly (case-sensitive) for "which occurrence is last", as JSON.parse does; only header names are compared case-insensitively.

## Tests (machine/test/project-mcp-reader.test.js), each through `readProjectMcp` on a real file
1. Two `mcpServers` keys: the first has `web` with duplicate headers, the second (kept) has `web` with one header → `web` not flagged (`entry[DUPLICATE_HEADERS]` absent).
2. Reverse: first clean, second (kept) duplicate → flagged.
3. A server name repeated inside one `mcpServers`: earlier copy duplicate, last clean → not flagged; and the reverse → flagged.
4. `headers` repeated inside one server: earlier duplicate, last clean → not flagged; reverse → flagged.
5. Case-insensitive duplicate (`Authorization` / `authorization`) in the kept copy → flagged.
6. All existing reader tests (including the deep-nesting ones) still pass unchanged.

## Validation
```
node --test machine/test/project-mcp-reader.test.js machine/test/project-mcp-codex.test.js machine/test/project-mcp-agy.test.js
bash machine/test/run.sh
```

## Rules for this task
- Plan slug `project-tools-solid`. The lead's session is `wc-b9ca1682b0fa-lead`; send it a `message` card if something this brief does not settle blocks you.
- Never run `./install.sh` and never start a viewer server by hand (tests start their own isolated servers). Never run `sudo`.
- Never delete files with `rm` (or any other delete) outside your own test temp folders.
- Your own `wc.js` and `card.js` calls are always allowed.
- Commit with `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit -m "<msg>" --paths <path>`, one path per call.
- Paste the full summary output (pass/fail counts) of every validation command into your report.
- If the same gate fails twice, stop and report rather than iterating.
- Close your report with: "List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none."

### R8

Gap from verification attempt 4 (verbatim): "§4 Antigravity cleanup — A live session can keep an ended session's private tool file past the 60-second grace period. In isolated tmux, `wc-name.part-worker` ended and `wc-name_part-worker` started. Both appeared under the same tmux name, and the sweep kept the ended session's file. [machine/service.js:403]"

Background: tmux rewrites `.` and `:` in session names to `_`, so two machine names can share one tmux name (never at once: tmux refuses a second session with the same name). R5 made the sweep keep a dir when its name OR its tmux spelling is live; that protects both dirs. The service sets each dir's mtime when it writes the file at start, so the live session's dir is the newest of those sharing its tmux name.

Ownership boundary: `machine/service.js` (only `sweepAgyTools`), `machine/test/project-tools-service.test.js`, your report `docs/plans/project-tools-solid/reports/R8.md`. Touch nothing else.

## Exactly what to build
In `sweepAgyTools`, keep it fully synchronous (no `await`; an existing test checks this), same 60 s grace rule, same removal path built only from directory entries, `startingNames` check unchanged (machine spelling).
1. First pass: decode every entry as now; for each valid `wc-` name compute `tmuxName = name.replace(/[.:]/g, '_')` and read its mtime with `lstatSync` (an entry that fails lstat is skipped this round, logged as now).
2. For each tmux name that is in `live`, the protected entry is the one with the newest mtime among the entries sharing that tmux name; on an exact mtime tie, prefer the entry whose decoded name equals the tmux name exactly. Only that one entry is kept because of liveness.
3. Every other entry follows the normal rule: kept if in `starting`, or younger than 60 s; otherwise removed.
4. Replace the R5 comment with one saying why (tmux rewrites `.` and `:` to `_`, so several dirs can map to one live tmux name; the live session wrote the newest).

## Tests (machine/test/project-tools-service.test.js), with `service.liveTmux` stubbed and dir mtimes set via `fs.utimesSync`
1. Live `wc-name_part-worker`; dirs for `wc-name.part-worker` (mtime 10 min ago) and `wc-name_part-worker` (mtime 5 min ago) → the dot dir is removed, the underscore dir kept.
2. Reverse ages: live `wc-name_part-worker`; dot dir 5 min ago, underscore dir 10 min ago → underscore removed, dot kept (the R5 case: a live dot-named session keeps its file).
3. A lone dot-named dir whose tmux spelling is live (old mtime) is kept (existing R5 test still passes).
4. A dir not live in any spelling, old mtime, is removed; one younger than 60 s is kept.
5. Equal mtimes on both → exact spelling kept, the other removed.

## Validation
```
node --test machine/test/project-tools-service.test.js
bash machine/test/run.sh
```

## Rules for this task
- Plan slug `project-tools-solid`. The lead's session is `wc-b9ca1682b0fa-lead`; send it a `message` card if something this brief does not settle blocks you.
- Never run `./install.sh` and never start a viewer server by hand (tests start their own isolated servers). Never run `sudo`.
- Never delete files with `rm` (or any other delete) outside your own test temp folders.
- Your own `wc.js` and `card.js` calls are always allowed.
- Commit with `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit -m "<msg>" --paths <path>`, one path per call.
- Paste the full summary output (pass/fail counts) of every validation command into your report.
- If the same gate fails twice, stop and report rather than iterating.
- Close your report with: "List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none."

### R9

Gap from verification attempt 4 (verbatim): "§§7–8 card text — The card's Markdown renderer changes valid tool names. The actual renderer displayed `_tool_: its program can't be found` as "tool: its program can't be found," dropping both underscores. [viewer/pages/thread.js:787]"

The page renders a needs card's `body` with `prose()` (Markdown) and its `items` array as plain `<li>` text (viewer/pages/thread.js ~785-790). Collin approved this fix: the intro sentence stays as `body`; the problem lines move into `items`.

Ownership boundary: `viewer/app/sessions.js` (only `applyProjectTools` and its helpers near line 141-185), `viewer/test/app-project-tools.test.js`, your report `docs/plans/project-tools-solid/reports/R9.md`. Touch nothing else (in particular not viewer/pages/thread.js or viewer/app/cards.js).

## Exactly what to build
1. In `applyProjectTools`, the card becomes `{ kind: 'needs', title: PROJECT_TOOLS_TITLE, body: "Some project tools won't work for agents in this thread:", items }` where `items` is the first 20 line texts (no `• ` prefix; the list supplies bullets), plus `and N more` as a last item when there are more than 20.
2. The same-identity in-place update (same `card_names`) compares and updates both `body` and `items` (update `items` when it differs; body is constant but keep the comparison simple and correct).
3. Before changing, grep `viewer/app` for any other reader of this card's `body` (e.g. text sent to a session, notifications, `project_tools.problems`, session list). If one exists and would now lose the lines, report it rather than editing outside your boundary.
4. Update the tests in viewer/test/app-project-tools.test.js that assert on body bullets to assert on `items` instead (body equals the intro sentence exactly; items equal the line texts; the 20-line cap gives 21 items ending in `and 3 more`; in-place update changes `items`). Add one test: a line whose text is `_tool_: its program can't be found` appears in `items` byte-for-byte.

## Validation
```
node --test viewer/test/app-project-tools.test.js
node --test viewer/test/*.test.js
```
(leave the glob unquoted; known flaky unrelated tests: app-quiet "6 message clears debt", app-uploads-archive "stalled upload", port collisions — re-run those alone and paste both runs)

## Rules for this task
- Plan slug `project-tools-solid`. The lead's session is `wc-b9ca1682b0fa-lead`; send it a `message` card if something this brief does not settle blocks you.
- Never run `./install.sh` and never start a viewer server by hand (tests start their own isolated servers). Never run `sudo`.
- Never delete files with `rm` (or any other delete) outside your own test temp folders.
- Your own `wc.js` and `card.js` calls are always allowed.
- Commit with `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit -m "<msg>" --paths <path>`, one path per call.
- Paste the full summary output (pass/fail counts) of every validation command into your report.
- If the same gate fails twice, stop and report rather than iterating.
- Close your report with: "List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none."

### R8, attempt 2 (replaces the R8 brief above)

Gap from verification attempt 4 (verbatim): "§4 Antigravity cleanup — A live session can keep an ended session's private tool file past the 60-second grace period. In isolated tmux, `wc-name.part-worker` ended and `wc-name_part-worker` started. Both appeared under the same tmux name, and the sweep kept the ended session's file. [machine/service.js:403]"

Background: tmux rewrites `.` and `:` in session names to `_`, so two machine names can share one tmux name (never at once: tmux refuses a second session with the same name). The current code (base of your branch) keeps a dir when its machine name OR its tmux spelling is live, which protects both dirs.

Why not "newest mtime": a start that tmux refuses still writes its dir with a fresh mtime (`startIn` writes the tool files before `tmux new-session`, and `this.sessions[name]` is set only after tmux succeeds, machine/service.js ~743), so the newest dir is not always the live one. Use the machine's session records instead.

Ownership boundary: `machine/service.js` (only `sweepAgyTools`), `machine/test/project-tools-service.test.js`, your report `docs/plans/project-tools-solid/reports/R8.md`. Touch nothing else.

## Exactly what to build
Keep `sweepAgyTools` fully synchronous (no `await`; an existing test checks this), the same 60 s grace rule, the same removal path built only from directory entries, the `startingNames` check unchanged (machine spelling), and the early return when `liveTmux()` is null.
1. Decode every entry as now. For each valid `wc-` name compute `tmuxName = name.replace(/[.:]/g, '_')`.
2. Group entries by `tmuxName`. For each group whose `tmuxName` is in `live`, choose exactly ONE protected entry:
   - among the group's entries whose decoded name has a record in `this.sessions` (any status other than `'stopped'`), the one whose record's `created_at` is newest (compare `Date.parse`); on a tie, the entry whose name equals `tmuxName` exactly, else the lexicographically smallest name;
   - if no entry in the group has such a record (for example the record was lost and the session re-adopted from tmux under the tmux spelling), the entry whose name equals `tmuxName` exactly, if there is one; otherwise the entry with the newest mtime (tie: lexicographically smallest name).
3. Every other entry follows the normal rule: kept if its name is in `starting`, or if its mtime is younger than 60 s (read with `lstatSync` as now; an lstat failure is logged and the entry left alone this round); otherwise removed. Invalid or non-`wc-` names behave as before.
4. Replace the R5 comment with one saying why (tmux rewrites `.` and `:` to `_`, so several dirs can map to one live tmux name; the machine's own record says which session is running; a refused start has no record).

## Tests (machine/test/project-tools-service.test.js), one `test(...)` per item, with `service.liveTmux` stubbed, `service.sessions` set directly, and dir mtimes set via `fs.utimesSync` to 10 minutes ago unless stated
1. Live tmux `wc-name_part-worker`; dirs for `wc-name.part-worker` and `wc-name_part-worker`; records: `wc-name.part-worker` status `'stopped'`, `wc-name_part-worker` status `'ready'` → dot dir removed, underscore dir kept.
2. Reverse: records `wc-name.part-worker` `'ready'`, `wc-name_part-worker` `'stopped'` → underscore removed, dot kept.
3. Refused start: record only for `wc-name_part-worker` (`'ready'`, dir 10 min old); a `wc-name.part-worker` dir with mtime now and NO record → underscore dir kept; the dot dir kept only because it is under 60 s; after setting the dot dir's mtime to 10 min ago and sweeping again, the dot dir is removed and the underscore dir still kept.
4. Both records non-stopped (an ended session the service did not notice): the newer `created_at` wins, the other is removed.
5. No records at all: the exact-spelling dir is kept, the other removed; a lone dot-named dir with no record whose tmux spelling is live is kept (the existing R5 assertion stays true).
6. A dir not live in any spelling, old mtime, is removed; one younger than 60 s is kept; `liveTmux` returning null removes nothing.

## Validation
```
node --test machine/test/project-tools-service.test.js
bash machine/test/run.sh
```
Your report must paste both commands' summary counts, and its Choices section must list every choice you made, including how you structured the code and any test you merged or changed.

## Rules for this task
- Plan slug `project-tools-solid`. The lead's session is `wc-b9ca1682b0fa-lead`; send it a `message` card if something this brief does not settle blocks you.
- Never run `./install.sh` and never start a viewer server by hand (tests start their own isolated servers). Never run `sudo`.
- Never delete files with `rm` (or any other delete) outside your own test temp folders.
- Your own `wc.js` and `card.js` calls are always allowed.
- Commit with `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit -m "<msg>" --paths <path>`, one path per call.
- Paste the full summary output (pass/fail counts) of every validation command into your report.
- If the same gate fails twice, stop and report rather than iterating.
- Close your report with: "List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none."

### R10 (follow-up to R9)

R9 moved the "Project tools problem" card's lines from `body` into the needs card's `items` list. The handoff history text for a needs card reads only `title` and `body`, so those lines would now be dropped from an exported handoff.

Ownership boundary: `viewer/app/handoff.js` (only the `case 'needs'` line in `historyText`), `viewer/test/app-handoff.test.js` (only the case table in the test "history renders shown cards and skips hidden and progress cards"), your report `docs/plans/project-tools-solid/reports/R10.md`. Touch nothing else.

## Exactly what to change
1. `viewer/app/handoff.js`, in `historyText`: change `case 'needs': return lines(card.title, card.body);` to `case 'needs': return lines(card.title, card.body, card.items || []);` (the `lines` helper already flattens arrays, as the `done` case does with `card.can_do || []`).
2. `viewer/test/app-handoff.test.js` around line 28: keep the existing `[{ kind: 'needs', title: 'N', body: 'B' }, ['N', 'B']]` row and add `[{ kind: 'needs', title: 'N', body: 'B', items: ['_tool_: x', 'and 3 more'] }, ['N', 'B', '_tool_: x', 'and 3 more']],` in the same table (match how the table compares rows to text; read the loop below the table first).

## Validation
```
node --test viewer/test/app-handoff.test.js viewer/test/app-project-tools.test.js
node --test viewer/test/*.test.js
```
(leave the glob unquoted; known flaky unrelated tests: app-quiet "6 message clears debt", app-uploads-archive "stalled upload", port collisions — re-run those alone and paste both runs)

## Rules for this task
- Plan slug `project-tools-solid`. The lead's session is `wc-b9ca1682b0fa-lead`; send it a `message` card if something this brief does not settle blocks you.
- Never run `./install.sh` and never start a viewer server by hand (tests start their own isolated servers). Never run `sudo`.
- Never delete files with `rm` (or any other delete) outside your own test temp folders.
- Your own `wc.js` and `card.js` calls are always allowed.
- Commit with `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit -m "<msg>" --paths <path>`, one path per call.
- Paste the full summary output (pass/fail counts) of every validation command into your report.
- If the same gate fails twice, stop and report rather than iterating.
- Close your report with: "List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none."

## After verification attempt 5

### R11

Gap (verification attempt 5): the machine suite rewrites the live Antigravity Stop hook. `machine/test/project-tools-state.test.js` "cross-CLI recomputation honors hashes and thread checkout ownership" starts an `agy` session; Antigravity's prepare (`machine/adapters/agy.js:12`) writes `path.join(os.homedir(), '.gemini', 'config', 'hooks.json')`, and the fixture never changes HOME, so the real `~/.gemini/config/hooks.json` gets pointed at the test's worktree.

Ownership boundary: `machine/test/project-tools-state.test.js` (only the `fixture` function), your report `docs/plans/project-tools-solid/reports/R11.md`. Touch nothing else.

## Exactly what to change (in `fixture`, machine/test/project-tools-state.test.js ~lines 10-27)
1. After the existing `await fsp.mkdir(worker);`, create a home: `const home = path.join(root, 'home'); await fsp.mkdir(home);`
2. Add `HOME: process.env.HOME` to the `old` object (so the existing `t.after` restore loop puts it back), and set `process.env.HOME = home;` on the same line where `PATH`, `TOOLS_PATH`, `TOOLS_CALLS` are set.
Pattern already in the tree: `machine/test/service.test.js:887` ("keep it off the real home").

## Validation
Run exactly this and paste all output (the two hashes must be identical; do not touch the real file in any other way):
```
sha256sum ~/.gemini/config/hooks.json
node --test machine/test/project-tools-state.test.js
sha256sum ~/.gemini/config/hooks.json
bash machine/test/run.sh
sha256sum ~/.gemini/config/hooks.json
```

## Rules for this task
- Plan slug `project-tools-solid`. The lead's session is `wc-b9ca1682b0fa-lead`; send it a `message` card if something this brief does not settle blocks you.
- Never run `./install.sh` and never start a viewer server by hand (tests start their own isolated servers). Never run `sudo`.
- Never delete files with `rm` (or any other delete) outside your own test temp folders.
- Your own `wc.js` and `card.js` calls are always allowed.
- Commit with `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit -m "<msg>" --paths <path>`, one path per call.
- Paste the full summary output (pass/fail counts) of every validation command into your report.
- If the same gate fails twice, stop and report rather than iterating.
- Close your report with: "List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none."
