---
slug: realism-bar
status: confirmed   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-19
---

# A realism bar for plan review and verification

## What we're building

A bar for how realistic a finding must be before plan review or build verification
chases it, in every plan mode including thorough. Findings that would break normal use
are fixed as today. Findings that only bite on rare failure paths are recorded as
accepted risks, without a fix and without a question to Collin, and are not raised again.

## Why — the problem

In the Kimi Code thread, plan review ran 15 rounds and verification 12+ attempts. One
reviewer family kept finding new, ever-rarer failure paths: restarts that also lose state
files, files swapped in a sub-second window, malformed input the CLI never writes,
unusual screen layouts, races between two pollers. Each was real but unlikely. In
thorough mode every gap surviving two fixes became a "fix it or live with it" card, so
Collin answered a long run of near-identical cards. Mid-build he decided: only fix what
breaks normal use; record rare paths as accepted risks without asking. Today that bar
exists only for the lighter modes' Deferred list, not as a rule for reviewers,
verifiers, the lead or the sub-lead.

## What good looks like

- Reviewers and verifiers know what "realistic" means and say when a finding is a rare
  path rather than normal use.
- Rare-path findings land in the plan's Accepted Risks, logged, with no question card
  to Collin, and later rounds do not raise them again.
- A thorough plan still gets full review of everything that affects normal use; rounds
  end once only rare-path findings remain.
- A plan-review finding that can only be settled once the code exists ("this could race
  if it's built like X") does not loop plan review: it is noted for the verifiers to check
  against the real build.
- Collin is asked only when it is genuinely unclear whether something is normal use, or
  when a fix is required and cannot be made.

## Not doing

- Not lowering the bar for security: leaks, wrong builds and anything a Spec validation
  command checks are always fixed.
- Not changing what the lighter modes defer, beyond sharing the same definition and
  sending rare paths to accepted risks instead of the follow-up list.
- Not adding settings or a dial for the bar in the app.

## Constraints

- Protocol documents first; any change to how the app parses reviewer or verifier output
  must keep working with existing report formats.
- Must work across all reviewer and verifier families (Claude, GPT, Gemini, Kimi).
