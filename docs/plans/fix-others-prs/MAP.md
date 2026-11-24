# Map: fix someone else's pull request

```text
New thread -> own worktree -> inspect and fix target PR -> approve push -> target PR head
                                                               -> done gate -> check -> auto-merge
```

The existing flow and evidence are mapped in [existing-pr-workflow](../../maps/existing-pr-workflow.md), checked against `25f34a4572c4beb9032f16f818b6502cc59f62bd` (origin/main).

- Ordinary thread creation starts a new `wc/<thread-id>` at the default branch; the special origin remote checkout is a handoff path constrained to a `wc/` branch and SHA, not a new-thread PR selector (`viewer/pages/new.js:229-241`, `viewer/app/threads.js:59-83`, `machine/service.js:668-713`). Target PR identity, head repository, branch and starting commit need a path through creation or later setup.
- The lead protocol forbids another thread's branch and repeatedly assumes the own branch for pushes, reconciliation and finishing; `wc.js git pr` creates a PR. The machine passes push, fetch and PR arguments through without branch/refspec checks, so approval and target restrictions are not enforced there today (`protocol/app/lead.md:482-516`, `protocol/app/lead.md:632-739`, `viewer/app/wc.js:49-68`, `machine/service.js:1588-1613`).
- Done currently rejects a PR with a head branch different from the recorded thread branch, even at the correct SHA. PR links are derived from done/import, and `session leads` is limited to same-machine peers (`viewer/app/pr-gate.js:8-12`, `viewer/app/chat.js:144-153`, `viewer/app/peers.js:42-63`). Consider how target identity survives restart and is presented before done.
- `verified` and auto-merge deserve explicit treatment for pre-existing collaborator commits: the flag's current rule checks the verifier's commit against the done head, while auto-merge trusts all of this thread's done flags and can merge and optionally delete the actual fork head branch (`protocol/app/lead.md:654-665`, `viewer/app/auto-merge.js:19-43`, `viewer/app/auto-merge.js:64-67`, `viewer/app/auto-merge.js:82-96`). The gate checks branch name, base and SHA, not head repository identity (`viewer/app/pr-gate.js:8-12`, `viewer/app/pr-gate.js:31-43`).
- Fork PRs require finding and pushing to the actual head repository; the existing auto-merge query finds that repository, but these PR paths do not query `maintainerCanModify` (`viewer/app/auto-merge.js:57-67`, `viewer/app/pr-gate.js:31-43`). A normal non-force push can still be rejected for permissions or a moved head; current recovery assumes origin's own thread branch (`protocol/app/lead.md:728-735`).

Not looked at: live PR #173, its permissions or credentials, full handoff lifecycle, and tests outside the mapped paths.
