---
slug: drive-local-app
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-18
---

# Agents run, screenshot and drive the app they build

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows. **Map:** `MAP.md`.

## Open Questions

### Q1: System tools with a one-time root install, or wheelchair's own input code?
- **Context:** hearth already has Xvfb (the invisible screen) and ffmpeg (can capture it),
  but not xdotool (sends mouse and keys); installing it needs root (`apt install xdotool`).
  `libxtst6` is installed, so a hand-written X11 client in Node could send input without root.
- **Options:** (a) depend on Xvfb, ffmpeg and xdotool, installed once through a sudo card,
  and report clearly when one is missing; (b) write a small X11 input client into wheelchair
  so nothing new needs root.
- **Recommendation:** (a). Proven tools, little code; the one-time install is cheap.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode two-part | Collin's pick | user |
| 2 | Works for any window the same way: launch, capture, mouse and keys; no app-specific setup | Collin's pick ("Any window") | user |
| 3 | The app runs on an invisible screen per agent, on the thread's machine (hearth) | Collin's pick ("Invisible screen") | user |
| 4 | Agents reach it as a command-line tool, not an MCP server | Every agent CLI can run a command and read an image file (Claude, Codex and Antigravity alike); MCP would leave Antigravity out (MAP.md) | defaulted |
| 5 | A screen is created on first use by a session and torn down when that session stops | Nothing runs when unused; sessions never share a screen | defaulted |
| 6 | Screenshots stay as files the agent reads; they reach the thread only when the lead posts an image card | Reuses the existing image card; no flood of pictures in the thread | defaulted |
| 7 | The agent chooses the launch command for the project; no per-project launch config | Matches "without app-specific setup" in IDEA.md | defaulted |
| 8 | Linux only in this part; macOS is out of this thread | IDEA.md constraints: runs on hearth | defaulted |

## Spec

(Grows as decisions land.)

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| Heavy 3D may be slow or fail on the invisible screen (software rendering, no graphics card) | Accepted in IDEA.md constraints | planning |

## Review Rounds

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
