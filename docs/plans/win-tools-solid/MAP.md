# Map: hardening Windows tools

Checked against `c797033d53bcd9e4ddbf95cf2b52debba0d74de4` (origin/main; relevant code matches this worktree). See [go-between](../../maps/windows-stdio-gobetween.md) and [copy lifecycle](../../maps/windows-bridge-runtime.md) for flow, evidence and tests.

```text
launch -> readying -> proxy starts tool -> session ends -> wait for writers -> final sync
             | restart                  | crash or handoff          | archive / sweep
             -> recover readying        -> copy-wide writer gate -> retry or reconcile
```

- Existing: the stand-in handshake, bounded held calls, list cache, readiness publication and direct-child shutdown are built (`machine/lib/win-tool-proxy.js:47-66,74-95,97-160`; `machine/lib/win.js:121-153,155-164`). Missing: restart loses in-memory readying and tokens; startup only reconstructs live tool-role sessions whose copy already exists, so it cannot re-ready a stranded proxy or reliably identify loaded Windows tools (`machine/lib/win.js:28-33,397-417`). The historical parent proposed durable launch flags before tmux and recovery of non-ready wrapped sessions (`5950541c^:docs/plans/windows-bridge-solid/PLAN.md:194-211`).
- Existing: stop tasks and archive pending cover bridge app cleanup, readying and sync (`machine/lib/win.js:279-294,319-334`). Missing: no writer registry, copy-wide gate, or sweep check for stop tasks; a crashed session or direct handoff kill can leave tools writing while sweep or archive reconciles (`machine/lib/win.js:319-334,361-370`; `machine/service.js:2020-2033`). The historical parent proposes a gate for all sessions sharing the copy, stale-pid cleanup and archive pending, with verifier copies excluded (`5950541c^:docs/plans/windows-bridge-solid/PLAN.md:217-236`).
- Existing: the proxy closes the immediate child's stdin and escalates signals (`machine/lib/win-tool-proxy.js:53-64`). Missing: Windows Job Object descendant tracking, per-proxy files and a stop wait; those were explicitly moved by D9 to this follow-up (`docs/plans/win-tool-gobetween/PLAN.md:40,350-353`). The last design has named jobs, start acknowledgement, a 12-second stop budget and 15-second directory wait (`9d5a5511:docs/plans/win-tool-gobetween/PLAN.md:206-256`). Its cancellation-after-tmux and proxy-crash risks moved with that design (`docs/plans/win-tool-gobetween/PLAN.md:355-361`).
- Idle read-end-only closure remains deferred: stdout error/close is handled, but tests cause a subsequent write; the plan records that Node emits neither event while idle (`machine/lib/win-tool-proxy.js:33-41`; `machine/test/win-tool-proxy.test.js:115-122`; `docs/plans/win-tool-gobetween/PLAN.md:352`). D11 routes realistic hardening findings to the follow-up (`docs/plans/win-tool-gobetween/PLAN.md:42`). The prior live checks for Antigravity re-listing, Codex initialization latency and call timeout remain listed, not established here (`docs/plans/win-tool-gobetween/PLAN.md:363-369`).

Not checked: live WSL, provider behavior, or independent reproduction of the idle pipe finding; the historical designs are proposals, not evidence of implementation.
