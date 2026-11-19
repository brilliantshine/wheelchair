# Remediation 1 — verification attempt 1 (commit 515a36f)

Both verifiers (claude-opus-5-5, gpt-6.2-sol) reported FAIL. Gaps after merging duplicates, as reported to the lead; the lead chose to fix all eight and defer none.

## Gaps (verbatim from the verifiers, merged)

1. (both) Editing — "Changing a tool's kind is refused ('edit in the file') while the entry has any read-only setting or header" — The page skips that check for settings or headers that reference a reserved name. So if a tool has a setting like `PATH: "${PATH}"` or a header like `Bearer ${GITHUB_TOKEN}`, it can be switched between command and web address, and Save silently drops that row. — `viewer/pages/project-tools.js:422` checks `x.ro && !x.env` … `buildEntry` then deletes `e.env` … (`:503`, `:513`). / Read-only settings and arguments — Changing a tool's kind can drop a read-only environment setting or arguments containing a newline … `:422` excludes reserved-name rows and ignores `argsRO`, then `:513` deletes the old fields.
2. Project identity and form baseline — A delayed key save can overwrite the key names and revision displayed for a different project. At 390 × 844, I saved a key on Alpha, switched to Beta, and saw Alpha's key appear on Beta when the reply arrived — `viewer/pages/project-tools.js:571` and `:580` apply the reply to the current view.
3. References in command, args or URL — Existing substitutions remain editable. The phone-width probe confirmed that the arguments field accepted edits with a substitution already present — `viewer/pages/project-tools.js:359`, `:361`, and `:363`.
4. Unknown fields — The form preserves unknown fields in the saved entry but hides them. A tool with `timeout: 5` showed neither the field nor the "edit in the file" hint — `viewer/pages/project-tools.js:475` and `:491`.
5. Key status after writes — A tool can show both "set" and "needs DB_TOKEN, not set on this machine" after a successful save … `viewer/pages/project-tools.js:313` renders the original warning while `:571` updates the key status.
6. Shared keys — The editor omits "shared with" while entering or changing a key name. The tool card computes sharing from the loaded baseline, so two tools added in the same draft can share a name without any visible indication — `viewer/pages/project-tools.js:301` and `:370`.
7. Waiting pull requests — An unreadable `.mcp.json` hides the waiting PR links and any PR lookup error … `viewer/pages/project-tools.js:222`.
8. Saving step 7 — A failed checkout hook can leave a registered temporary worktree. In a scratch Git repository, Save returned `failed` and one temporary worktree remained — `machine/lib/project-tools.js:126` marks the worktree for cleanup only after `git worktree add` succeeds.

## Tasks

| Task | Gaps | Owner files | Lane |
|---|---|---|---|
| R1-1 | 1-7 | `viewer/pages/project-tools.js`, `viewer/pages/settings.css` (append), `viewer/test/app-project-tools.spec.js` | standard, `--provider claude` (built by claude) |
| R1-2 | 8 | `machine/lib/project-tools.js`, `machine/test/project-tools.test.js` | light, `--provider gpt` (built by gpt) |

The full briefs are below.

# Task R1-1 — page: fix seven verification gaps in the Project tools section

Plan slug: project-tools-screen. Task id: R1-1. Gaps are in `docs/plans/project-tools-screen/REMEDIATION-1.md` (gaps 1-7, with the verifiers' evidence). The file is `viewer/pages/project-tools.js` (read it whole first). Each fix below is settled; implement it as written.

1. **Kind change never drops read-only parts.** In `openForm`'s kind `change` handler (~line 420), refuse the change ("Can't change the kind: this tool has parts the form can't edit. Edit in the file.") when the entry has ANY of: a read-only setting/header row (`x.ro`, including `env` rows — drop the `&& !x.env`), read-only arguments (`argsRO`), a read-only command or URL (fix 3), or unknown fields (fix 4).
2. **Late replies never land on another project.** In `send()` and in the key Remove handler, capture `{ machine: state.machine, path: state.path, seq: state.readSeq }` before the request. When the reply arrives, if `state.machine`, `state.path` or `state.readSeq` differ from the captured values, drop the reply entirely (don't apply keys, token, or status) and only clear busy. Note that `handle()` for `opened`/`pr_failed`/409 calls `readProject` itself; that is after the check, so it's fine.
3. **`${...}` in command, args or URL is read-only.** In `parseEntry`, mark `commandRO` when the command contains `${` (any `${NAME}` or `${NAME:-x}`), `argsRO` also when any arg contains `${`, and `urlRO` when the URL contains `${`. In the form, a read-only command/URL is shown as text with "edit in the file (kept as is)" instead of an input (same style as the read-only arguments), and `buildEntry` keeps the original value (doesn't overwrite `e.command` / `e.url` when read-only).
4. **Unknown fields are shown.** Any field of the raw entry other than `type`, `command`, `args`, `env`, `url`, `headers` is listed read-only on the tool card and in the form as `name: <JSON value>` with "edit in the file" (they're already kept by `buildEntry`; don't change that).
5. **Key warnings follow current key status.** On the tool card, don't render the machine's "needs <NAME>, not set on this machine" warnings as given. Instead, for each key the tool (as currently in `state.tools`) references (`rowKeyName` over its rows), render "needs <NAME>, not set on this machine" when `!state.keys.includes(NAME)`. Keep every other machine key warning (held back) as given.
6. **"shared with" follows the current draft.** Compute sharing from `state.tools` (all tools' key rows via `parseEntry` + `rowKeyName`), not from `r.references`: on the card, "shared with <other tool> (<NAME>)". In the editor, under each key row show "shared with <tools>" for the current key name (other tools in `state.tools`, excluding the one being edited), updating as the name is typed.
7. **Waiting PRs show when the file is unreadable.** In `buildView`, render the waiting-PR block (`paintWaiting`, including `waiting_error`) in tools mode whether the source is readable or not.

## Tests (append to `viewer/test/app-project-tools.spec.js`, following its stubs; one test each)
- tool with env `PATH: "${PATH}"`: changing kind is refused with the message; also a tool with a newline arg; also a tool with an unknown field.
- late reply: stub the save route to wait (e.g. resolve after a request from the test), switch project, then release; the Beta Keys list and the outgoing token on Beta's next save keep Beta's values.
- args `["--db", "${DB_URL}"]`: arguments shown read-only; editing the tool's name/other fields sends args unchanged.
- unknown `timeout: 5`: shown on the card and in the form as read-only.
- after setting a key the tool shows "set" and no "needs … not set" warning.
- two tools added in one draft with the same key name: both cards show "shared with"; the editor shows it while typing.
- unreadable source with a waiting PR: the link and Start over both show.

## Ownership boundary
`viewer/pages/project-tools.js`, `viewer/pages/settings.css` (append only), `viewer/test/app-project-tools.spec.js`.

## Validation
```
npm --prefix viewer run test:browser -- app-project-tools.spec.js app-settings.spec.js
```

# Task R1-2 — machine: always clean up the temporary worktree

Plan slug: project-tools-screen. Task id: R1-2. Gap 8 in `docs/plans/project-tools-screen/REMEDIATION-1.md`.

## Change (`machine/lib/project-tools.js`, Save step 4-7 block, ~lines 122-138)
Today `added = true` is set only after `git worktree add` succeeds, so a failed add that left a registered/partial worktree is never removed. Change the `finally` so that whenever `worktree` has been chosen (the path is set), it runs `git -C <project> worktree remove --force <worktree>` and then `git -C <project> worktree prune`, ignoring their results (both via the existing `git(...)` helper, which carries the 60 s timeout). Remove the `added` flag. Nothing else changes.

## Test (append to `machine/test/project-tools.test.js`)
A save where `git worktree add` fails after registering the worktree: install a failing `post-checkout` hook in the project clone (`.git/hooks/post-checkout` exiting 1) so the add returns non-zero; assert the reply is `failed` (502) and `git -C <clone> worktree list --porcelain` lists only the main checkout afterwards.

## Ownership boundary
`machine/lib/project-tools.js` (that block only), `machine/test/project-tools.test.js` (append only).

## Validation
```
bash machine/test/run.sh
```
