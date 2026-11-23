# Map: local checkout handoff

Checked against `207c02f5e0b56cfbcc96046cca10a8df92002a9c` (origin/main and worktree HEAD). Detailed source flow: [local-checkout-handoff](../../maps/local-checkout-handoff.md).

```text
phone -> thread or done action -> authenticated hub -> thread's machine
  -> identify target checkout and branch -> inspect state -> apply chosen operation
```

The first two arrows are existing plumbing; checkout selection, inspection for an arbitrary target, and application are open design work. The selected `thread.project` is already a path on `thread.machine`, and may be Collin's checkout, but nothing labels it as his or associates a distinct checkout with the repository (`viewer/app/threads.js:20-25,57-64`; `viewer/app/routes.js:125-152,163-178`). The machine creates the thread branch as a linked worktree from the selected repo after fetching origin (`machine/service.js:460-496,530-542`). The branch may already be checked out in that linked worktree; a separate checkout cannot simply assume it can check out that same local branch.

The done card's action area is `viewer/pages/thread.js:831-859`; a card press reaches `viewer/app/routes.js:524-525` and normally queues a message to a live lead (`viewer/app/threads.js:374-390`). A direct hub operation can target `thread.machine` via the authenticated client (`viewer/app/machine-client.js:53-77,98-108`). Browser writes and machine requests have distinct authentication boundaries (`viewer/server.js:1292-1298,2104-2110`; `machine/service.js:403-420,1528-1532`). The existing hub-only handoff route writes Git refs in the selected project and fast-forwards recorded thread worktrees, not arbitrary user checkouts (`machine/service.js:1250-1287,1350-1365`).

Risks and decisions: preserve uncommitted and ignored files, distinguish detached or divergent branches and linked worktrees, confirm repository and target machine identity, account for concurrent changes between inspection and application, and report unreachable machines or failed Git operations. Existing project validation only checks for a `.git` entry (`machine/service.js:1198-1205,1223-1232`); existing worktree status also fetches (`machine/service.js:1408-1420`). The target machine may differ from the thread machine; current thread records supply only the latter (`viewer/app/threads.js:20-25`). Whether to switch the selected checkout, update a separate checkout, or use another strategy remains open.

The six prior maps named in the brief were compared with origin/main; each has covered-file changes since its recorded commit. This map rechecks the overlapping facts relevant to this feature rather than certifying the older maps' unrelated coverage.

## What I did not look at

The user's live machines and checkouts, all Git hooks and configuration, every API route and test, or platform-specific Git behavior. No tests were run for this documentation-only map.
