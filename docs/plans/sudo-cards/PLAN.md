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

### Q4: How does Collin know he is typing into the real password box?
- **Context:** Q1 assumes a hostile agent. Such an agent can edit the thread page and show a
  lookalike password box. The real box lives on the helper's own address, which agents can't change.
- **Options:** (a) the thread card only links out to the helper's page, and Collin checks the
  address; (b) as (a), plus a secret word Collin picks at install, which only the helper knows
  and shows above the real box; (c) accept the risk.
- **Recommendation:** (b). On a phone the address bar is easy to miss; a missing word is not.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | Hub-to-machine traffic is plain HTTP over Tailscale (MAP.md) | Whether the password crosses a network hop unencrypted outside Tailscale | no | |
| 3 | Running as Collin needs root: sudo checks the invoking user's password | Defaulted in Spec: the helper verifies Collin's password via PAM itself before running as root | no | settled, Decision 6 |
| 2 | sudo caches authentication per terminal | Each run must invalidate the cache (`sudo -k`) so nothing stays unlocked | no | |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | The command runs non-interactively, stdin closed after the password, with a time limit (default 10 minutes) | IDEA.md rules out interactive commands; a hung command must not hang forever | defaulted |
| 2 | The agent gets the exit code and output (stdout and stderr, capped in size); the card shows the same result to Collin | IDEA.md: the agent learns whether it worked | defaulted |
| 3 | "Talk about it" sends the lead a message that Collin wants to discuss the request; nothing runs and the card stays open | IDEA.md | defaulted |
| 5 | Isolation must hold against a hostile agent: a separate helper, running under an identity agents can't control, with root-owned code agents can't edit, serves the password box and runs the command; the password never passes through the hub, the machine service or any page they serve | Collin picked "safe from a hostile agent" | user |
| 6 | The helper runs as a root system service (installed once with sudo), checks Collin's password against his account via PAM and that he may use sudo, then runs the command as root. It is reachable only through Tailscale HTTPS on its own port | sudo authenticates the invoking user, so a separate unprivileged user can't use Collin's password; PAM keeps the check as strict as sudo's | defaulted |
| 7 | Only a lead may post a sudo request; other sessions ask the lead with a `message`, and the lead decides whether to bring it to Collin. The hub refuses the card from any other role | Collin picked "only the lead" | user |
| 8 | Confirm is two presses: Run, then a red "Confirm: run as root" button replaces it for 5 seconds; letting it lapse returns to Run. This lives on the helper's page, beside the password box | Collin picked "press, then confirm" | user |
| 4 | The command is fixed when the card is posted; the run uses the stored text byte for byte and the card shows it in full, unabridged | IDEA.md: what runs is exactly what is shown | defaulted |

## Spec

### Who may ask

- Only a lead posts a sudo request card. The hub refuses it from any other role. Workers and
  sub-leads ask the lead by `message`; the role files (`protocol/app/*.md`, `cards.md`) say so.

### What Collin sees

- **In the thread:** a sudo card showing the command in full, what it does and why the lead
  needs it, with three buttons: "Open to run" (a link to the helper's page for this request),
  Decline, and Talk about it. No password field is ever in the thread page.
- **On the helper's page:** the same command and reason (from the helper's own copy), a
  password box, and Run. Pressing Run turns it into a red "Confirm: run as root" button for 5
  seconds; pressing that sends the password and runs. Letting it lapse returns to Run.
- After the run, both the helper page and the thread card show exit code and output.

### Isolation boundary

- A separate **sudo helper**: root system service, code installed root-owned outside the clone
  (for example `/usr/local/lib/wheelchair-sudo/`), not editable by Collin's user. Installed once
  by a command Collin runs with sudo.
- The helper serves the password page itself, on its own Tailscale HTTPS port. The hub, the machine
  service and every page they serve never receive, relay or render the password.
- The hub hands the helper only the request (command, reason, which thread). The helper keeps the
  command text from that moment and runs exactly it.
- The helper checks the password with PAM against Collin's account and his sudo rights, runs the
  command as root, keeps nothing (no disk, no log line with the password), and reports exit code
  and output back to the hub.

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
