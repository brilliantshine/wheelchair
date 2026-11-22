# Map: auto merge pull requests

Checked against `249d3a8ba14731806c3f2d40a25596b9294e6999` (origin/main). The current source flow and evidence are in [auto-merge-flow](../../maps/auto-merge-flow.md); older [done-card](../../maps/done-card.md) and [pr-finishing](../../maps/pr-finishing.md) maps have changed covered files and retain historical claims outside the rechecked paths.

```text
Settings -> save preference -> deliver policy to lead
verified PR -> readiness and exact head -> lead requests merge -> done -> check
                                                        -> hub detects merged -> merged card
```

The existing preference store normalizes an explicit list, exposes explicit route fields and renders page controls; the preference also needs a deliberate delivery path and a decision about changes for already-running leads (`viewer/app/settings.js:37-39,222-240,298-307`; `viewer/app/routes.js:286-343`; `viewer/app/sessions.js:318-324,512-528`). Diagram sensitivity writes machine-global harness files, while writing style is versioned and reaches a live lead on its next message; neither currently carries this preference (`viewer/app/diagram-sensitivity.js:3-4,26-48`; `viewer/app/sessions.js:517-522`).

The protocol currently says never merge, including the planned done path; small fixes and open-PR after-done fixes also reach the same readiness procedure (`protocol/app/lead.md:124-140,457-467,485-509,625-647`). `BLOCKED` with no failed or pending checks passes the current readiness gate even when review is outstanding; a merge attempt can therefore fail despite a valid done card (`protocol/app/lead.md:639-645`; `viewer/app/pr-gate.js:24-28`). Define merge failure, retry, changed-head and restart behavior together with the existing recovery paths (`protocol/app/lead.md:647-716`).

There is no `wc.js` PR-merge command: machine service executes `gh pr create` for `pr`, and local `git merge` for `merge` (`viewer/app/wc.js:49-68`; `machine/service.js:1535-1560`). A new session-authorized machine operation follows the existing worktree boundary; the hub instead uses its own `gh` for the done gate and merged polling, so credentials and availability may differ (`machine/service.js:1541-1547,2257`; `viewer/app/pr-gate.js:31-43`; `viewer/app/threads.js:458-478`). Binding the action to the intended PR and head and deciding merge method are new design work.

Already-merged done cards are supported: the hub checks the PR head, the lead verifies ancestry if the merge raced a push, and check-card update text omits merging (`viewer/app/pr-gate.js:8-14`; `protocol/app/lead.md:653-661,531-545`). After a merge, user-reported problems and broken check steps lead to dependent stubs, not in-place fixes (`protocol/app/lead.md:485-512,580-587`). The merged card is app-generated from a done/imported PR URL on a periodic sweep (`viewer/app/handoff.js:109-110`; `viewer/app/threads.js:454-481`; `viewer/app/hub.js:93-102`).

Not checked: GitHub branch protection, real credentials, deployment timing and the complete test suite.
