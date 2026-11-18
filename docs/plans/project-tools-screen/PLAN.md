---
slug: project-tools-screen
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-18
---

# A screen for a project's tools

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

**Map:** `MAP.md` and `docs/maps/project-tools.md`.

## Open Questions

None.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is thorough | Collin picked it | user |
| 2 | Save delivers changes as a pull request against the project's default branch; Collin merges it | Reviewable, works with protected branches | user |
| 3 | Keys are typed on the screen, stored on the project's machine outside the repo, given to agents at start; the screen shows only whether a key is set | Phone-friendly, never reaches git | user |
| 4 | The screen is a "Project tools" section in Settings with a machine and project picker like New thread; no new project page | No project page exists; Settings already has the picker pattern (`viewer/pages/settings.js`, `viewer/app/routes.js:125-178`) | defaulted |
| 5 | The screen notes that Antigravity agents don't get project tools | Matches `machine/adapters/agy.js:30-32`; changing that is out of scope | defaulted |
| 6 | Each entry shows the same validation the machine and Codex adapter apply, with the reason it would be skipped | IDEA: skipped entries are flagged on screen | defaulted |
| 7 | Unknown fields and entries the form can't edit are kept byte-for-byte in meaning and shown read-only | File stays usable by Claude Code outside wheelchair | defaulted |
| 8 | Key values never appear in argv, `session.command`, persisted session data, hub storage or logs | Map: launch env is in tmux argv and sessions persist the command | defaulted |
| 9 | While a tools PR from the screen is open, the screen edits on top of it and Save adds a commit to that PR | Avoids two conflicting tools PRs | defaulted |
| 10 | Keys are never deleted automatically; unused keys are listed with a Remove button | A key removed at Save would break the default branch, older threads and unmerged or failed PRs | review-round-1 |
| 11 | Same key name across tools shares one value, shown on the form | Matches Codex same-name passthrough; simplest | review-round-1 |
| 12 | Tools PRs use one fixed branch `wc-tools`; open PR found with `gh pr list --head wc-tools` | No lookup ambiguity; retries reuse it | review-round-1 |
| 13 | Save carries the read sha and is refused if the source moved | Prevents a stale editor undoing another save | review-round-1 |
| 14 | Project identity is the realpath of the git common dir | Shared by checkout aliases and thread worktrees | review-round-1 |
| 15 | Checks run before any key is written; Save only sets keys; removal only via rechecked Remove | No half-applied or stale writes | review-round-2 |
| 16 | Reserved key names narrowed to process, loader, wheelchair and the CLIs' own login/config names | Wide prefixes blocked ordinary tools; exact collisions still break launch | review-round-2 |
| 17 | Sessions get only the keys their `.mcp.json` references, and only on Claude/Codex tool roles | Less exposure, same outcome | review-round-2 |
| 18 | `wc-tools` ownership proven by a commit trailer; lease uses the sha seen at read | Never overwrite a foreign branch or a concurrent save | review-round-2 |
| 19 | Launch reader rejects a symlinked `.mcp.json` too | Settings and launch agree | review-round-2 |
| 20 | Supersedes 19: launch is unchanged; only Settings refuses a symlinked file | Claude reads the file itself, so rejecting it in the reader doesn't stop launch (`machine/adapters/claude.js:69-74`) | review-round-3 |
| 21 | Managed keys only in env values and header values; refs elsewhere never injected | Keeps key values out of tool argv via Claude's expansion | review-round-3 |
| 22 | Default branch resolved live with `ls-remote --symref`; machine commands bounded at 60 s | Renames and hung git/gh | review-round-3 |
| 23 | Supersedes 9, 12 and 18: every Save opens its own PR on a new `wc-tools/<id>` branch; edits start from the default branch; waiting tools PRs are listed | Shared-branch design drew new gaps in all three rounds | user |

## Spec

### What it is
A "Project tools" section on the Settings page (`viewer/pages/settings.*`). Collin picks a
machine and a project (same choices as New thread: saved directories, found repos and past
thread paths for that machine, `viewer/app/routes.js:125-178`). The section then shows the
project's tools and lets him add, change and remove them. Works at phone width.

### Project identity
- A project is identified on its machine by the real path of its git common directory
  (`git rev-parse --git-common-dir`, resolved with realpath). The project checkout and every
  thread worktree made from it (`machine/service.js:535-538`) resolve to the same value, so
  symlinked or aliased picker paths, Save, key status and session launch all use one identity.

### Reading
- The machine resolves the GitHub repository (`owner/name`) from `git remote get-url origin`
  in the project; a non-GitHub origin shows "pull requests need a GitHub origin" and allows
  only key changes. Every `gh` call passes `--repo <owner/name>` and runs non-interactively.
- The machine fetches the current default branch (resolved as below) with an explicit
  refspec, and reads `.mcp.json` from it. That is the **source**; Collin's working checkout is
  never read or touched. The default branch is the current remote default, from
  `git ls-remote --symref origin HEAD`, not the cached `origin/HEAD`; if it differs from the
  cached one the machine updates it with `git remote set-head origin --auto` so new threads
  (`machine/service.js:529-542`) start from the same branch.
- It lists waiting tools PRs: `gh pr list --repo R --base <default branch> --state open
  --json number,url,title,headRefName,isCrossRepository`, keeping same-repository PRs whose
  head branch starts with `wc-tools/`. The section shows them as "Waiting to merge" with
  links, and says edits start from main and don't include them.
- If `gh` fails (not installed, no login, network), the section still shows the tools from
  the default branch, with "couldn't check for waiting pull requests: <reason>"; tool changes
  and key removal are disabled until a reload succeeds; setting keys still works.
- The file is read from the source with `git ls-tree` / `git cat-file`. Missing: empty
  list. An entry that is not a regular blob (symlink, submodule, tree) is unreadable, reason
  "not a regular file; edit it by hand or Start over". Session launch is unchanged and may
  still follow a symlink (Accepted Risks). Otherwise the same checks as `machine/lib/project-mcp.js` apply, with
  the same reasons.
- Unreadable file: the section shows the reason, offers no editing, and offers "Start over"
  (an empty tool list, saved as below, writing a regular file in place of whatever was there).
- The read returns a **read token**: the default branch name and sha read, and the key
  store's revision (a counter the machine bumps on every key write). The screen sends it back
  unchanged on Save and Remove.
- Each tool shows its name, kind (command or web address), what it runs, and its settings
  (env names; plain values shown, key values shown as "set" or "not set" on this machine).
- Each tool shows any reason it would be skipped, by the machine's validator or by Codex,
  and the section shows the Codex "too large for the command line" result
  (`machine/adapters/codex.js:98-101`) when the whole file trips it. The Codex per-entry
  reasons live inline in `command()` today (`machine/adapters/codex.js:63-75`); extract them
  and the aggregate size check into exported functions used by both `command()` and this
  screen. Export the per-entry validator from `machine/lib/project-mcp.js` too (only
  `readProjectMcp` and `TOOL_ROLES` are exported today, line 44). The viewer gets results
  from the machine, never its own copy of the rules.
- Notes on the section: Antigravity agents don't get project tools; keys are kept on this
  machine only, so another machine running this project needs its own keys entered.

### Editing
- Add / edit form fields: name; kind (command or web address); for command: command,
  arguments (one per line), settings (name + value, each value marked plain or key); for web
  address: URL and headers (name + value, plain or key). Adding a header shows "Codex agents
  don't get tools with headers" on the form right away.
- Remove (a tool) asks for confirmation.
- Fields the form doesn't know, and entries it can't represent, are kept as they were and
  shown read-only with "edit in the file".
- A tool name already used is refused.

### Keys
- Keys belong to the project (identity above), by name. A key is written in `.mcp.json` as
  `${NAME}` (env value or header value); for env entries the setting name equals the key name
  so Codex passthrough works (`machine/adapters/codex.js:84-92`). Two tools using the same key
  name share one value; the form shows "shared with <other tool>".
- Keys live only in two places: an env value exactly `${NAME}` and a header value containing
  `${NAME}`. A `${NAME}` anywhere else (command, args, URL) is not a managed key and is never
  injected, so a key value can't reach a tool's own argv through Claude's expansion; such a
  reference is shown read-only. A key name used both in an eligible place and elsewhere is
  refused on Save ("<name> is also used in <field>") and flagged on Read.
- A hand-written reference in an eligible place to a non-reserved name is a key: set or not
  set, settable. A reference to a reserved name is left to the session's normal environment:
  not a key, no flag.
- A key shown "not set" on this machine is also listed among the tool's skip reasons
  ("needs <name>, not set on this machine").
- Key names must match `^[A-Za-z_][A-Za-z0-9_]*$`. Reserved names, refused by form and machine
  API and shown as "can't be set here: it would change how the agent itself runs":
  - process and loader: `PATH`, `HOME`, `USER`, `LOGNAME`, `SHELL`, `TERM`, `TMPDIR`, `PWD`,
    `LANG`, `TZ`, `NODE_OPTIONS`, `NODE_PATH`, `NODE_EXTRA_CA_CERTS`, `PYTHONPATH`,
    `PYTHONHOME`, `SSL_CERT_FILE`, `SSL_CERT_DIR`, `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`
    (any case); prefixes `LD_`, `DYLD_`, `LC_`, `XDG_`, `TMUX`, `SSH_`, `DBUS_`, `GIT_`, `GH_`; exact
    `GITHUB_TOKEN` (they change which account the agent's own `gh` and git use);
  - wheelchair: prefix `WHEELCHAIR_`;
  - the CLIs' own login and config: prefixes `CLAUDE_`, `CODEX_`, `ANTHROPIC_`; exact
    `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_ORG_ID`, `OPENAI_PROJECT_ID`; and any name an
    adapter's `loginEnv` sets.
- Values go browser -> hub -> machine and are stored in a mode-600 file per project under the
  machine's state directory. The hub forwards them and never stores or logs them. The screen
  never receives values back.
- At session start, only lead, sub-lead, worker and verifier sessions on Claude or Codex get
  keys, and only the keys that session's worktree `.mcp.json` references and that are not
  reserved. They are added to the session environment without putting values in argv,
  `session.command`, persisted session data or logs (for example a launcher that reads the
  file).
- Save can only set keys. A key is removed only through Remove on a key listed "not used"
  (referenced by neither the default branch nor any waiting tools PR's `.mcp.json`). On Remove
  the machine fetches, re-lists waiting tools PRs and rechecks; if any of that can't be
  checked, the key is now referenced, or the key-store revision differs from the read token,
  removal is refused.

### Saving
- Save sends the new tool list, keys to set (by name), and the read token.
- No tool-list change and no keys set: refused, "nothing to save".
- One save or removal per project at a time on the machine (a lock); a second waits.
- Order, with nothing written until step 3:
  1. Fetch the default branch. Refuse with "changed since you opened it" (the screen
     reloads) if its name or sha, or the key-store revision, differs from the read token.
  2. If the tool list changed: serialize the candidate (2-space JSON, trailing newline) and run
     the reader's checks on it. A whole-file failure blocks Save with the reason. Per-entry
     skip reasons and the Codex size result are warnings and don't block, for edited and
     untouched entries alike.
  3. Store the keys being set. If the tool list didn't change, stop here: no PR.
  4. In a temporary worktree (never Collin's checkout) at the default-branch sha from the read
     token, replace `.mcp.json` with a regular file holding the candidate and commit "Update
     project tools".
  5. Push to a new branch `wc-tools/<12 random hex>` with
     `--force-with-lease=refs/heads/<branch>:` (empty: the push fails if the branch exists, so
     it never overwrites anything).
  6. Run `gh pr create --repo R --head <branch> --base <default branch> --title "Update
     project tools" --body "Saved from the wheelchair app's Project tools screen."`. If that
     fails, the screen shows the error, the branch name and GitHub's compare link so Collin can
     open the PR himself; nothing retries it.
  7. Remove the temporary worktree.
- Every Save makes its own branch and PR; two saves never share anything. Two waiting PRs may
  conflict with each other; GitHub shows that and Collin closes one.
- The section shows the PR link and that new threads get the change once it is merged.
- Errors (push rejected, no `gh` login, PR creation failed) are shown in plain words; keys
  stored in step 3 stay stored.
- Every git and `gh` command these routes run has a 60-second limit on the machine (kill the
  child on expiry; `commandAsync` at `machine/service.js:87-99` has none today, so add an
  optional timeout); the lock and temporary worktree are released in a `finally`, whatever
  happens.
- Deadlines: the hub calls the new read, save and remove routes with a 120-second timeout
  (`viewer/app/machine-client.js:64` takes a timeout argument; the default is 5 seconds). If
  Save times out or the connection drops, the screen says "Save may still be finishing" and
  reloads instead of retrying; a retry opens a second PR if the first landed, which
  the reload's "Waiting to merge" list shows.

### Not doing
Running or testing a tool; changing which roles or CLIs get tools; changing running threads;
account-level tools; merging the PR.

### Validation
- `bash machine/test/run.sh`: new tests for reading from the remote branch, the temp-worktree
  commit and PR (fake git remote and fake `gh`), key store mode 600, keys reaching the session
  environment and absent from argv, `session.command` and persisted sessions; reserved key
  names refused; stale-sha Save refused; waiting tools PRs listed and filtered by `wc-tools/` prefix;
  symlinked `.mcp.json` read as unreadable and replaced by Start over; key-only save opens no PR;
  PR-create failure shows the compare link;
  a checkout alias and a thread worktree resolve to the same key store; stale Save writes no keys; Remove refused when the key became
  referenced; push refuses an existing branch name; two saves make two PRs; only referenced,
  non-reserved keys reach Claude/Codex tool roles; gh failure still lists tools.
- `node --test viewer/test/*.test.js`: hub routes forward keys without storing them; auth and
  origin checks on the new write routes.
- `npm --prefix viewer run test:browser`: add, edit, remove, key set/not set, skipped-entry
  reason and PR link at phone width.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| A tool that needs a reserved name (for example `OPENAI_API_KEY`) can't get its key from the screen; the screen says why | Setting it would change the CLI's own login or runtime; renaming needs adapter support outside this feature | 2 |
| Settings refuses a symlinked `.mcp.json` while session launch may still follow it | Rare; making launch refuse it needs Claude-side suppression outside this feature | 3 |

## Review Rounds

### Round 1 — 2026-11-18

**Lanes:** intent — claude / claude-opus-5-5; mechanics — gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Deleting unused keys on Save breaks the active config before merge | upheld | Keys never auto-deleted; unused listed (Log 10) |
| intent | minor | Same key name in two tools silently shares a value | upheld | Shared by design, shown on form (Log 11) |
| intent | minor | Keys are per machine; screen doesn't say so | upheld | Note added in Reading |
| intent | minor | Random branch name makes PR discovery undefined | upheld | Fixed `wc-tools` branch (Log 12) |
| intent | minor | Codex rules aren't a callable function yet | upheld | Spec says extract and export them |
| mechanics | blocking | Key deletion on Save breaks pending/closed PRs and older threads | upheld | Same as intent finding 1 (Log 10) |
| mechanics | blocking | Duplicate key names across tools | downgraded to major: undefined choice, not a wrong build | Log 11 |
| mechanics | blocking | Key names can collide with launch env (PATH, WHEELCHAIR_*) | upheld | Reserved names list in Keys |
| mechanics | blocking | Stale editor can undo another save | upheld | Save carries ref + sha, refused if moved (Log 13) |
| mechanics | major | PR discovery and retry undefined | upheld | Saving steps 4-5 |
| mechanics | major | Which validation results block Save | upheld | Saving step 2 |
| mechanics | major | Key store keyed by an aliasable path | upheld | Project identity (Log 14) |
| mechanics | major | Symlinked or non-regular `.mcp.json` | upheld | Reading via ls-tree; Saving step 3 writes a regular file |
| mechanics | major | Key-only vs tool change vs no-op undefined | upheld | Saving first three bullets |

### Round 2 — 2026-11-18

**Lanes:** intent — claude / claude-opus-5-5; mechanics — gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 1:** new "Project identity" section; Reading rewritten (fixed `wc-tools`
PR lookup, `git ls-tree` read, non-regular entries, ref + sha returned, exported validators,
per-machine keys note); Keys rewritten (shared names, reserved names, no auto-delete, unused
keys listed); Saving rewritten as numbered steps (no-op / key-only / tool change, stale-sha
refusal, which checks block, force-with-lease recreate, PR retry); Validation extended.
Decision Log 10-14.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Reserved prefixes block common tools; hand-written `${X}` undefined | upheld | List narrowed (Log 16); hand-written refs are keys; residue in Accepted Risks |
| intent | minor | Keys stored before stale check | upheld | Saving order (Log 15) |
| intent | minor | Two ways to remove keys | upheld | Save only sets (Log 15) |
| intent | minor | All keys reach every session, incl. Antigravity | upheld | Log 17 |
| intent | minor | Viewing needs `gh` | upheld | Reading gh-failure fallback |
| mechanics | blocking | Stale combined Save still writes keys | upheld | Log 15 |
| mechanics | blocking | Remove uses stale "not used" | upheld | Remove rechecks on machine |
| mechanics | blocking | `wc-tools` may be default or foreign branch | upheld | Log 18, Saving step 5 |
| mechanics | blocking | Concurrent saves race between push and PR | upheld | Lease on read-token sha + per-project lock |
| mechanics | blocking | NODE_OPTIONS / LD_PRELOAD not reserved | upheld | Reserved list (Log 16) |
| mechanics | major | Symlink: Settings and launch disagree | upheld | Log 19 |
| mechanics | major | `gh` repo targeting and non-interactive PR | upheld | `--repo`, `--json`, title/body |
| mechanics | major | Read omits Codex size check | upheld | Reading shows it |
| mechanics | major | 5-second hub timeout | upheld | 120 s deadline and reload-not-retry |

### Round 3 — 2026-11-18

**Lanes:** intent — claude / claude-opus-5-5; mechanics — gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 2:** Reading (GitHub repo pinning, `gh` flags and failure fallback,
read token, Codex size check); new "Launch reader change" (symlink rejected at launch);
Keys (hand-written refs, narrowed reserved list, only referenced keys to Claude/Codex tool
roles, Save sets only, rechecked Remove); Saving (per-project lock, checks before key writes,
trailer ownership of `wc-tools`, lease from read token, non-interactive PR create, 120 s
deadline and reload-not-retry); Validation; Accepted Risks row 1; Decision Log 15-19.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Keyed web tools never reach Codex; form silent | upheld | Form note on adding a header |
| intent | minor | GH_TOKEN / GITHUB_TOKEN not reserved | upheld | Added to reserved list |
| intent | minor | `${HOME}` refs flagged though they work | upheld | Reserved-name refs aren't keys, no flag |
| intent | minor | Foreign-branch refusal is a dead end | upheld | Shared branch removed (Log 23) |
| intent | minor | Unset key not shown as a skip reason | upheld | Listed as a skip reason |
| mechanics | blocking | RE-RAISE: open-PR path and empty range bypass ownership | upheld | Shared branch removed (Log 23) |
| mechanics | blocking | RE-RAISE: race between push and PR creation | upheld | Shared branch removed (Log 23) |
| mechanics | blocking | Stale tracking ref after branch deletion | upheld | Shared branch removed (Log 23) |
| mechanics | blocking | Key-only Save with `gh` unavailable contradicts | upheld | `unknown` PR state in token |
| mechanics | major | Key-only replay after timeout | downgraded to minor: replays Collin's own earlier value | Key-store revision in token |
| mechanics | blocking | RE-RAISE: symlink reject doesn't stop Claude | downgraded to major, accepted-risk | Log 20; Accepted Risks |
| mechanics | blocking | `${NAME}` in args puts values in tool argv | downgraded to major: needs a rule, not a wrong build | Log 21 |
| mechanics | major | Cached `origin/HEAD` after rename | upheld | Log 22 |
| mechanics | major | Hung git/gh holds the project lock | upheld | Log 22 |

### Round 4 — 2026-11-18

**Lanes:** intent — pending; mechanics — pending; cross-family: pending.

**Changed since Round 3:** the shared `wc-tools` branch is gone (Log 23): Reading now reads
only the default branch and lists waiting `wc-tools/*` PRs; read token is default branch +
sha + key-store revision; Saving steps 1 and 4-6 rewritten (new branch per Save, push refuses
existing names, PR-create failure shows a compare link); Remove rechecks against all waiting
tools PRs. Also from round 3 triage: managed keys only in env and header values (Log 21);
reserved-name refs aren't keys; unset keys are skip reasons; `GH_`/`GITHUB_TOKEN` reserved;
header note for Codex; launch reader change dropped (Log 20, Accepted Risks); live default
branch and 60 s command limits (Log 22).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

Round 3 was the third round without a clean result since Collin's last decision; budget stop. The `wc-tools` shared-branch design (Log 9, 12, 18) drew findings in all three rounds. Put to Collin; he chose one PR per save (Log 23). Budget reset.

Watch List items 1-6 (Antigravity note, Codex flags, project identity, unknown fields, key values in argv, second save) were settled as Decision Log 4-9.
