# Remediation 2 — local-checkout-handoff

Verification attempt 2 on `e856552c`: Claude verifier PASS, GPT verifier FAIL with four gaps. The lead's per-gap answer fixes H1 and H4; H2 and H3 are deferred as PLAN.md D14 and D15.

## Gaps to fix (verbatim from the GPT verifier report)

- **H1**: "Spec §6, plain-language errors — Normal use. When a connection drops during a write and stays down through the Status re-read, the panel displays raw browser text. Chromium showed `Failed to fetch` and Firefox showed `NetworkError when attempting to fetch resource.` — `viewer/pages/thread.js:344`, `:366–368`."
- **H4**: "Spec, machine validation with a linked thread worktree — Normal-use coverage gap. The automated Try and Back fixture creates `wc/<id>` in the user checkout itself. Its only linked checkout tests the return branch being checked out elsewhere. An isolated phone-size run through the hub and machine passed Try and Back with `wc/<id>` checked out in a linked worktree. — `machine/test/try.test.js:86–96`, `:342–346`."

## Tasks

| Task | Gap | Files | Lane |
|------|-----|-------|------|
| R2a | H4 | `machine/test/try.test.js` only | light, gpt (built the machine side) |
| R2b | H1 | `viewer/pages/thread.js`, `viewer/test/app-try.spec.js` | light, claude (built the panel) |

### R2a — machine test fixture

1. In `tryFixture()` (`machine/test/try.test.js`), after the `wc/0123456789ab` commit and `git('switch', 'main')`, add the agent's linked worktree: `git('worktree', 'add', path.join(root, 'agent'), 'wc/0123456789ab')`. Return `agent` (that path) from the fixture, plus a helper `agentGit(...args)` that runs git with `-C agent`. The worktree lives in the fixture's temp `root`, outside `repo`, like a real agent copy under `<stateDir>/worktrees`, but not under the `TryService`'s `stateDir`, so the "agent's copy" folder check does not refuse `repo`.
2. Any existing test that now fails because the branch is checked out in the linked worktree must make its thread-branch commits in the agent worktree (`f.agentGit('commit', ...)` after writing files under `f.agent`) instead of switching `repo` to `wc/...`. Behaviour assertions stay the same. Change nothing in `machine/lib/try.js`. If a test can only pass by changing product code, stop and report it.
3. Fixtures that build their own second thread branch (for example `wc/<another id>`) may keep doing that in `repo`. Only the fixture's main thread branch moves to the linked worktree.

### R2b — panel network errors

1. In `viewer/pages/thread.js`, add one helper, for example `copyErrorText(e)`, returning "Can't reach the hub." when `e` is a `TypeError` (what `fetch` throws on a network failure in every browser), else `e.message`. Use it in both catch blocks: `copyLoad` and `copyWrite`, replacing the `'Failed to fetch'` comparison.
2. Test in `viewer/test/app-try.spec.js`: abort both the POST and the following GET for `/try` (`route.abort('failed')`). The error line reads exactly "Can't reach the hub." in Chromium and Firefox. Also a load-only failure (GET aborted on page load) shows the same sentence.
