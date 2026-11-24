# The realism bar

How likely a problem must be before it is chased. It applies in every plan mode.

- **Normal use**: a healthy machine, ordinary actions by the user and the agents, and input
  the real tool or service produces. A plain restart, a killed or crashed session, a closed
  browser tab, a network drop and two threads running at once are normal use. Problems in
  normal use are fixed.
- **Rare path**: needs two unlikely things together, or something that does not happen in
  ordinary running. Examples: a crash or restart that also loses or corrupts state files;
  a race inside a sub-second window between two actors; files swapped or edited
  mid-operation; tampering by a local user or agent; malformed input the source never
  writes; unusual screen layouts or versions the tool does not ship.
- **Always fixed, however rare**: secret or token leaks, permission or sandbox bypass,
  building the wrong thing, anything a Spec validation command checks, silent loss of
  the user's work in normal use, breaking the project's CONTRIBUTING.md in this change.
- **Unsure**: report it as normal use and say why it might be rare. The judge decides: the
  lead for review findings and for its own verifiers; the sub-lead for build verification.
- **Pulled-back items**: a finding or gap about an item the user pulled back from Deferred is
  never a rare path. It is fixed, or the user is asked, as `lead.md` says.
- **What happens to a rare path**: it is reported once and recorded in the plan's Accepted
  Risks without asking the user. It is never fixed in this thread, never moved to Deferred
  and never raised again.
- **Small consequences are minor**: a normal-use finding whose worst outcome is an extra
  prompt to the user, a repeated message, or wording a careful reader reconciles the obvious
  way is `minor` (`reviewer.md`): fixed, but it never blocks a clean review round.
- **Check once built**: a finding about how code not yet written might behave ("this could
  race if the poller is written like X"), where the Spec is clear and correct and only the
  built code can show whether the problem exists. A Spec that is wrong, contradictory or
  leaves a worker needing to ask is not this; it is a normal finding. It is recorded in the
  plan's Check Once Built section and checked by the verifiers against the real build.
