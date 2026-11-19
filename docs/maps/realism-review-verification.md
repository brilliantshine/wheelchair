# Map: review and verification risk handling

Checked against: `3abf9df2694e434f6879e147a2338ca9882d5219` (origin/main). Files covered: `protocol/app/reviewer.md`, `protocol/app/lead.md`, `protocol/app/sub-lead.md`, `protocol/app/verifier.md`, `protocol/app/worker.md`, `protocol/templates/PLAN.md`, `viewer/app/agents.js`, `viewer/app/card.js`.

```text
IDEA + PLAN -> review lenses -> severity findings -> lead triage -> clean round -> approval
                                                     -> revise / risk / question -> next round
build + validation -> verifier checks Spec -> PASS -> done
                                         -> GAP -> classify in lighter mode -> defer or remediate -> re-verify
                                                                  -> same gap survives two fixes -> Collin
```

Reviewers check source through mechanics and intent lenses; severity measures the consequence for a worker: wrong or impossible implementation is blocking, a required stop to ask is major, everything else minor. Their exact report uses `SEVERITY` and `LENS` lines; settled declined or accepted risks are re-raised only with contrary evidence (`protocol/app/reviewer.md:20-70`). Lead triage records every finding as upheld, downgraded, declined, accepted-risk or user-decision; accepted risks move to PLAN, genuine forks become questions. A clean round has no upheld blocking or major finding and no open user-decision; three unclean triaged rounds since Collin's last decision trigger a needs card (`protocol/app/lead.md:285-324`).

Thorough mode retains the full plan; two-part and proof-of-concept move hardening, defined as work not needed for normal use, to Deferred. In lighter review, a needed Deferred item returns to Spec; other hardening moves to Deferred and does not prevent a clean round (`protocol/app/lead.md:209-230,272-278`). Switching to thorough moves all Deferred rows into Spec; pulled-back items cannot be deferred again (`protocol/app/lead.md:216-223,235-239`). PLAN's Deferred is lighter-mode only, whereas Accepted Risks records real issues consciously left unfixed and Review Rounds records finding and verdict (`protocol/templates/PLAN.md:53-88`).

The verifier treats Deferred as out of scope, checks every Spec item, intent and non-goals, and reports evidence-backed GAP lines on failure; BLOCKED is not a gap (`protocol/app/verifier.md:31-50,93-117`). In lighter mode the sub-lead sends deduplicated gaps to the lead labeled hardening or must-fix; failing Spec validation commands and pulled-back items cannot be deferred. Deferred gaps do not count toward the two-attempt rule; an all-deferred re-check is available once, with a subsequent all-hardening case requiring Collin's choice (`protocol/app/sub-lead.md:243-259`; `protocol/app/lead.md:384-392`). Otherwise remediation records verbatim gaps and one task per gap in REMEDIATION-N, validates and re-verifies; a gap surviving two fix attempts stops work and goes to Collin, including before other must-fix gaps proceed (`protocol/app/sub-lead.md:261-278`; `protocol/app/lead.md:380-388`). A worker asks the lead when the brief and plan leave a real question open (`protocol/app/worker.md:45-55`).

The viewer does parse reviewer report lines for the Agents display (`viewer/app/agents.js:114-120`), and card validation constrains approval objection severities to blocking or major and Deferred card modes to the two lighter modes (`viewer/app/card.js:80-85,101-108`). These are concrete dependencies if report or card formats change; they do not establish an enforcement gate for the proposed realism bar.

## Not looked at

No live workflow was run. This focused map does not audit every viewer or machine parser, all exceptional small-fix and restart flows, or historical runs. Older overlapping maps were compared against origin/main and changed; their broader claims were not revalidated here.
