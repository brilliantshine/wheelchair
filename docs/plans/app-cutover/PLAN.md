---
slug: app-cutover
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-15
---

# Remove the old terminal workflow

**Idea:** `IDEA.md`. **Map:** `MAP.md`.

## Open Questions

### Q1: What "graphs native to the app" means
- **Context:** Today `/graph` writes a graph and starts the viewer; the graph list
  (`viewer/list.html`, `/wheelchair/list`) is a separate page the app's nav
  (`viewer/pages/nav.js:38-43`) does not link. Thread graphs already show as `diagram`
  cards. The dial still reaches terminal sessions (picked: App and terminal), so terminal
  agents still draw graphs under `protocol/graphs.md`.
- **Options:** (a) a Graphs view in the app's nav listing every graph, thread and terminal
  alike, and terminal agents' links open there; (b) only remove the command, the list page
  stays as it is; (c) graphs only inside threads, terminal agents draw nothing.
- **Recommendation:** (a).

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

## Spec

To be written as decisions land.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
