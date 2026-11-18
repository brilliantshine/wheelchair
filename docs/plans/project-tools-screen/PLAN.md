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
- The machine runs `git fetch origin`, then looks for an open tools PR:
  `gh pr list --head wc-tools --base <default branch> --state open` (default branch found as
  in `machine/service.js:529-542`). If one exists the source ref is `origin/wc-tools` and the
  section says "Changes waiting to merge" with the link; otherwise the source ref is
  `origin/<default branch>`. Collin's working checkout is never read or touched.
- The file is read from the source ref with `git ls-tree` / `git cat-file`. Missing: empty
  list. An entry that is not a regular blob (symlink, submodule, tree): treated as unreadable
  with reason "not a regular file". Otherwise the same checks as `machine/lib/project-mcp.js`
  (size, JSON, `mcpServers`) apply, with the same reasons.
- Unreadable file: the section shows the reason, offers no editing, and offers "Start over"
  (an empty tool list, saved as below, writing a regular file in place of whatever was there).
- The read returns the source ref name and its commit sha; the screen sends both back on Save.
- Each tool shows its name, kind (command or web address), what it runs, and its settings
  (env names; plain values shown, keys shown as "set" or "not set" on this machine).
- Each tool shows any reason it would be skipped, by the machine's validator or by Codex.
  The Codex per-entry reasons now live inline in `command()` (`machine/adapters/codex.js:63-75`);
  extract them into an exported function used by both `command()` and this screen. Likewise
  export the per-entry validator from `machine/lib/project-mcp.js` (today only `readProjectMcp`
  and `TOOL_ROLES` are exported, line 44). The viewer gets results from the machine, never
  its own copy of the rules.
- Notes on the section: Antigravity agents don't get project tools; keys are kept on this
  machine only, so another machine running this project needs its own keys entered.

### Editing
- Add / edit form fields: name; kind (command or web address); for command: command,
  arguments (one per line), settings (name + value, each value marked plain or key); for web
  address: URL and headers (name + value, plain or key).
- Remove asks for confirmation.
- Fields the form doesn't know, and entries it can't represent, are kept as they were and
  shown read-only with "edit in the file".
- A tool name already used is refused.

### Keys
- Keys belong to the project (identity above), by name. A key is written in `.mcp.json` as
  `${NAME}` (env value or header value); for env entries the setting name equals the key name
  so Codex passthrough works (`machine/adapters/codex.js:84-92`). Two tools using the same key
  name share one value; the form shows "shared with <other tool>" next to it.
- Key names must match `^[A-Za-z_][A-Za-z0-9_]*$` and are refused, by both form and machine
  API, if they are one of: `PATH`, `HOME`, `USER`, `LOGNAME`, `SHELL`, `TERM`, `TMPDIR`, `PWD`,
  `LANG`, `TZ`; or start with `LC_`, `WHEELCHAIR_`, `CLAUDE_`, `CODEX_`, `ANTHROPIC_`,
  `OPENAI_`, `GEMINI_`, `GOOGLE_`, `XDG_`, `TMUX`, `SSH_`, `DBUS_`; or are any name an adapter's
  `loginEnv` sets.
- Values go browser -> hub -> machine and are stored in a mode-600 file per project under the
  machine's state directory. The hub forwards them and never stores or logs them. The screen
  never receives values back, only set/not set.
- At every session start for a tool role, the machine adds the project's keys to the session
  environment without putting values in argv, `session.command`, persisted session data or
  logs (for example a launcher that reads the file). Non-tool roles don't get them.
- Keys are never deleted automatically. A key referenced by neither the default branch nor an
  open tools PR is listed as "not used" with a Remove button (confirmed).

### Saving
- Save sends: the new tool list, key changes (set or remove, by name), and the source ref and
  sha from Reading.
- No tool-list change and no key changes: refused, "nothing to save".
- Key changes only: stored on the machine immediately, no PR; apply to sessions started after.
- Tool-list change (with or without key changes): key changes are stored first, then:
  1. Fetch. If the source ref's current sha differs from the one sent, or the source ref
     changed kind (a tools PR merged, closed or appeared), refuse with "changed since you
     opened it" and the screen reloads. Nothing is written.
  2. Serialize the candidate (2-space JSON, trailing newline) and run the reader's checks on
     it. A whole-file failure (over 32 KiB, invalid) blocks Save with the reason. Per-entry
     skip reasons, from the machine or Codex, and the Codex "too large for the command line"
     result (`machine/adapters/codex.js:98-101`) are shown as warnings and do not block, for
     edited and untouched entries alike.
  3. In a temporary worktree (never Collin's checkout) at the source sha, replace `.mcp.json`
     with a regular file holding the candidate and commit "Update project tools".
  4. Push to `wc-tools`: with an open tools PR, a normal push (it fast-forwards from the
     checked sha); without one, the branch is recreated from the default-branch sha and pushed
     with `--force-with-lease=wc-tools:<sha origin had, or empty>`, replacing any leftover
     branch from a merged or closed PR or a failed earlier attempt.
  5. Without an open tools PR, open one with `gh pr create --head wc-tools --base <default
     branch>`. If that fails, the error is shown; the next Save or reload finds the branch
     with no PR and a later Save recreates and retries, so no second branch is ever made.
  6. Remove the temporary worktree.
- The section shows the PR link and that new threads get the change once it is merged.
- Errors (push rejected, no `gh` login, PR creation failed) are shown in plain words; keys
  already stored stay stored.

### Not doing
Running or testing a tool; changing which roles or CLIs get tools; changing running threads;
account-level tools; merging the PR.

### Validation
- `bash machine/test/run.sh`: new tests for reading from the remote branch, the temp-worktree
  commit and PR (fake git remote and fake `gh`), key store mode 600, keys reaching the session
  environment and absent from argv, `session.command` and persisted sessions; reserved key
  names refused; stale-sha Save refused; leftover `wc-tools` branch recreated and PR retried;
  symlinked `.mcp.json` read as unreadable and replaced by Start over; key-only save opens no PR;
  a checkout alias and a thread worktree resolve to the same key store.
- `node --test viewer/test/*.test.js`: hub routes forward keys without storing them; auth and
  origin checks on the new write routes.
- `npm --prefix viewer run test:browser`: add, edit, remove, key set/not set, skipped-entry
  reason and PR link at phone width.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

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

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

Watch List items 1-6 (Antigravity note, Codex flags, project identity, unknown fields, key values in argv, second save) were settled as Decision Log 4-9.
