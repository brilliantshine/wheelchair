---
slug: sudo-cards
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-15
---

# Run sudo commands from a card

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

### Q1: How strong does "the agent never sees the password" have to be?
- **Context:** Agents run as Collin's Linux user with permission checks off, and the hub,
  the machine service and the page code all live in a clone that user owns
  (MAP.md; `install.sh:306-345`). Any agent can edit that code, or read the memory of a
  process running as the same user. Passing the password only through memory stops
  accidental leaks (disk, logs, thread, terminal), but not an agent that sets out to grab it.
- **Options:** (a) In-memory pass-through in the existing hub and machine service. Stops
  every accidental leak, not a hostile agent. (b) A small separate helper running as its own
  Linux user, with root-owned code agents can't edit, that serves the password box and runs
  sudo itself. Installing it takes one sudo run. Holds even against a hostile agent.
- **Recommendation:** (b). "Completely isolated" is only true with (b).

### Q2: Who may ask for a sudo run?
- **Context:** Workers and sub-leads only talk to the lead; only the lead posts shown cards.
- **Options:** lead only, other sessions relaying through it; or any session posts directly.
- **Recommendation:** lead only, so every request reaches Collin in one voice.

### Q3: What exactly is "double-click to confirm"?
- **Context:** A literal double-click is unreliable on a phone.
- **Options:** literal double-tap; or press Run, then a "Confirm: run as root" button appears
  and must be pressed within a few seconds.
- **Recommendation:** the two-step press.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | Hub-to-machine traffic is plain HTTP over Tailscale (MAP.md) | Whether the password crosses a network hop unencrypted outside Tailscale | no | |
| 2 | sudo caches authentication per terminal | Each run must invalidate the cache (`sudo -k`) so nothing stays unlocked | no | |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | The command runs non-interactively, stdin closed after the password, with a time limit (default 10 minutes) | IDEA.md rules out interactive commands; a hung command must not hang forever | defaulted |
| 2 | The agent gets the exit code and output (stdout and stderr, capped in size); the card shows the same result to Collin | IDEA.md: the agent learns whether it worked | defaulted |
| 3 | "Talk about it" sends the lead a message that Collin wants to discuss the request; nothing runs and the card stays open | IDEA.md | defaulted |
| 4 | The command is fixed when the card is posted; the run uses the stored text byte for byte and the card shows it in full, unabridged | IDEA.md: what runs is exactly what is shown | defaulted |

## Spec

(grows as decisions land)

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
