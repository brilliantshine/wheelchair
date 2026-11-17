# Map: plan handoffs

```text
thread record + cards + plan branch -> clean boundary -> export
export + pushed branch -> new thread/worktree -> restored state -> lead context
```

The current path and evidence are in `docs/maps/thread-handoffs.md`. Hub thread JSON contains identity, project/machine, sessions, cards and pins; plan artifacts live in the worktree, while uploads live outside it (`viewer/app/state.js:41-48`, `viewer/app/threads.js:20-38`, `viewer/app/sessions.js:357-362`, `viewer/app/routes.js:69-85`). A handoff therefore needs a deliberate selection of portable state and cannot assume attachments travel with the branch.

Normal creation starts a fresh lead on `wc/<new-id>` from origin's default branch. The machine accepts a base ref, but that is not exposed by new-thread creation; its `-b` checkout creates a new local branch (`viewer/app/threads.js:57-80`, `machine/service.js:441-470`). Restart supplies slug, non-replaced cards, pins and recent human/card messages to a new lead in the existing worktree; stub startup supplies only its summary and optional commits (`viewer/app/threads.js:107-157`). Reusing restart needs a way to build a new worktree from the exported remote branch and reconcile the new identity with stored links and queues.

PLAN status is a gate, not proof of a quiet thread: lead and sub-lead write different transitions, and child sessions are stopped after their reports (`protocol/app/lead.md:443-455`, `protocol/app/lead.md:156-159`, `protocol/app/lead.md:233-238`, `protocol/app/sub-lead.md:168`, `protocol/app/sub-lead.md:224-228`, `protocol/app/lead.md:306-315`). In particular `approved` precedes the approval card and Start building; `verifying` precedes verifier starts (`protocol/app/lead.md:265-276`, `protocol/app/sub-lead.md:214-227`). A clean boundary must account for live sessions and pending work as well as status.

The thread page already uploads attachments and can serve them, but the inspected routes provide no thread export endpoint (`viewer/pages/thread.js:1007-1021`, `viewer/app/routes.js:41`, `viewer/app/routes.js:442-464`). Archive may make local WIP commits, removes uploads and clean worktrees, and does not push those commits (`machine/service.js:740-792`); exported branch availability must be established independently.

## Not checked

No import/export implementation exists in the inspected paths; provider placement internals, all routes, and remote-machine failure cases were not exhaustively checked.
