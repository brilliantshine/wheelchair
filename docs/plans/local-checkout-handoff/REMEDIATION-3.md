# Remediation 3 — local-checkout-handoff

Verification attempt 3 on `e77eb32f`: both verifiers FAIL. The lead's per-gap answer fixes J1 and J2; J3 is deferred as PLAN.md D16. Keep both fixes small.

## Gaps to fix (verbatim from the verifier reports)

- **J1** (Claude): "Spec §6 (Errors / `last` shown by Status) with IDEA "the app tells him plainly what it did" — A successful Try stores the reason "Your copy is showing this thread." (`machine/lib/try.js:244`). The panel prints `last.reason` on every thread page of the folder, whatever state the copy is in (`viewer/pages/thread.js:266`). So the panel often says something false. … After Try A and then Try B, Status from A's page gave `state: "trying-other"` and `last.reason: "Your copy is showing this thread."` … After a hand switch (`stale`) and after Dismiss (`state: "none"`), `last.reason` still said "Your copy is showing this thread.""
- **J2** (GPT): "Spec §6, files in the way — Normal use. Try and Switch back show only "Aborting" when the destination tracks a file at the same path as an ignored directory. Git named `cache` and preserved `cache/save` in both reproductions. Both parsers look only for "would be overwritten by checkout" and miss Git's directory diagnostic. — `machine/lib/try.js:249`, `machine/lib/try.js:342`."

## Tasks

| Task | Gap | Files | Lane |
|------|-----|-------|------|
| R3a | J2 | `machine/lib/try.js`, `machine/test/try.test.js` | light, gpt (built the machine side) |
| R3b | J1 | `viewer/pages/thread.js`, `viewer/test/app-try.spec.js` | light, claude (built the panel) |

### R3a — "in the way" parsing (J2)

1. In `machine/lib/try.js`, replace the two copies of the "would be overwritten" parser (in `performTry` and `performBack`, at the `nothing-moved` branch) with one helper, `wayPaths(stderr)`. It collects the indented path lines that follow **any** git `error:` line ending in `:`. That covers "…would be overwritten by checkout:", "…would be removed by checkout:" and "Updating the following directories would lose untracked files in them:". The path list is capped at 50, with "and N more" added to the sentence when there are more.
2. The reason for nothing-moved becomes: paths found → `These files in your copy are in the way: <paths>`; else killed → `Git took too long.`; else → `Git did not switch your copy: <the first "error:" line without its "error: " prefix>`, or `Git did not switch your copy.` when git printed no `error:` line. A bare `Aborting` must never be the reason.
3. Test, named after the gap: on a first Try, the thread tracks a file `cache` and the copy has an ignored directory `cache/` holding `cache/save`. Outcome nothing-moved, the reason names `cache`, `cache/save` is intact and HEAD unmoved. Do the same on Back: the original branch tracks `cache`, the thread removes it, and an ignored `cache/save` is created while trying. Plus a unit test of `wayPaths` with an "Aborting"-only stderr, giving the plain fallback.

### R3b — `last` worded as what happened (J1)

1. In `viewer/pages/thread.js` `copyLines`, the line for `last` must read true on any thread page and in any state. When `last.outcome` is `success` or `warning`, the page writes its own first sentence instead of the machine's success text:
   - `op: "try"`: "Switched your copy to this thread." when `last.thread_id` is this page's thread id, else "Switched your copy to another thread.";
   - `op: "back"`: "Switched your copy back.";
   - for `warning`, add the machine's `last.reason` after that sentence (it carries git's warning or the file list's lead-in).
   For `nothing-moved`, `refused` and `interrupted`, keep showing `last.reason` as now. Files and `appeared` lists are unchanged.
2. Tests in `viewer/test/app-try.spec.js`: (a) Status with `state: "trying-other"` and `last {op: "try", outcome: "success", thread_id: <another id>, reason: "Your copy is showing this thread."}` shows "Switched your copy to another thread." and does **not** show "Your copy is showing this thread."; (b) the same `last` with `thread_id` equal to the page's thread shows "Switched your copy to this thread." in state `none` (after Dismiss); (c) a Back success shows "Switched your copy back."
