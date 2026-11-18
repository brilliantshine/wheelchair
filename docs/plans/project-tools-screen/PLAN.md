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

## Spec

### What it is
A "Project tools" section on the Settings page (`viewer/pages/settings.*`). Collin picks a
machine and a project (same choices as New thread: saved directories, found repos and past
thread paths for that machine, `viewer/app/routes.js:125-178`). The section then shows the
project's tools and lets him add, change and remove them. Works at phone width.

### Reading
- The machine reads `.mcp.json` from `origin/<default branch>` (default branch found as in
  `machine/service.js:529-542`) after a `git fetch`, never from the working checkout, which
  is not touched. If an open tools PR from this screen exists (see Saving), it reads from
  that PR's branch instead and the section says "Changes waiting to merge" with the link.
- Missing file: empty list. Unreadable or invalid file: the section shows the same reason
  `machine/lib/project-mcp.js` would give and offers no editing until fixed by hand or by
  "Start over" (replace with an empty list, which still goes through Saving).
- Each tool shows its name, kind (command or web address), what it runs (command and
  arguments, or URL), and its settings (env names; values shown for plain values, "set" or
  "not set" for keys).
- Each tool shows any reason it would be skipped: by the machine's validator, or by Codex
  (headers, unsupported `${...}`, name characters, as in `machine/adapters/codex.js:58-102`).
  Reuse those functions rather than copying their rules.
- A note on the section says Antigravity agents don't get project tools.

### Editing
- Add / edit form fields: name; kind (command or web address); for command: command,
  arguments (one per line), settings (name + value, each value marked plain or key); for web
  address: URL and headers (name + value, plain or key).
- Remove asks for confirmation.
- Fields the form doesn't know, and entries it can't represent, are kept as they were and
  shown read-only with "edit in the file".
- A name already used is refused. Validation runs before Save with the same rules as Reading.

### Keys
- A key value is written in `.mcp.json` as `${NAME}` (env value or header value); for env
  entries the variable name equals the setting name so Codex passthrough works
  (`machine/adapters/codex.js:84-92`).
- Values are sent from the browser through the hub to the machine and stored in a mode-600
  file per project under the machine's state directory (keyed by the repo path). The hub
  forwards them and never stores or logs them. The screen never receives values back, only
  set/not set.
- At every session start for a tool role, the machine adds that project's keys to the
  session's environment without putting values in argv, `session.command`, persisted session
  data or logs (for example a launcher that reads the file). Non-tool roles don't get them.
- A key no tool references any more is deleted from the store on Save.
- Changing a key alone is saved on the machine immediately and needs no PR; it applies to
  sessions started afterwards.

### Saving
- Save sends the full new tool list. The machine, in a temporary worktree (never Collin's
  checkout), writes `.mcp.json` (2-space JSON, trailing newline), commits "Update project
  tools", pushes a branch `wc-tools/<short id>`, and opens a pull request against the default
  branch with `gh`. If a tools PR from this screen is open, it commits on that branch instead
  and the PR updates. The temporary worktree is removed afterwards.
- The section shows the PR link and that new threads get the change once it is merged.
- Errors (push rejected, no `gh` login, PR creation failed) are shown in plain words; keys
  already saved stay saved.
- Saving is refused if the list didn't change.

### Not doing
Running or testing a tool; changing which roles or CLIs get tools; changing running threads;
account-level tools; merging the PR.

### Validation
- `bash machine/test/run.sh`: new tests for reading from the remote branch, the temp-worktree
  commit and PR (fake git remote and fake `gh`), key store mode 600, keys reaching the session
  environment and absent from argv, `session.command` and persisted sessions.
- `node --test viewer/test/*.test.js`: hub routes forward keys without storing them; auth and
  origin checks on the new write routes.
- `npm --prefix viewer run test:browser`: add, edit, remove, key set/not set, skipped-entry
  reason and PR link at phone width.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-18

**Lanes:** intent — claude / claude-opus-5-5; mechanics — see session list; cross-family: yes.

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

Watch List items 1-6 (Antigravity note, Codex flags, project identity, unknown fields, key values in argv, second save) were settled as Decision Log 4-9.
