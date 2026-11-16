---
slug: lead-reserve-and-review-count
date: 2026-11-15
implemented-by: "worker Standard GPT gpt-6.1-terra x4 (T1, T2, T3 attempts 1-2); sub-lead claude-opus-5-5"
verified-by: []   # Stage 4 appends; Stage 3 leaves this empty.
---

# Completion Report — Reserve the lead's provider, and one-family review

Written for a hostile reviewer: every claim checkable, no claim without evidence. All
references are to the feature branch `wc/2fd7d426276c` at the commit named in the
sub-lead's result.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| §1 Reserved provider helper: lead order with `any` expanded to worker order, de-duplicated, first with an unpaused account signed in on the thread's machine, else `null`; exported | this run | `viewer/app/balancer.js:19-26` (`signedIn`, `reservedProvider`), `:97` export | `viewer/test/app-balancer.test.js:84-95` (incl. skip of a provider with no signed-in account, `:92`) |
| §1 Ordering: reserved provider moved to the end for non-lead roles when `save_for_leads` | this run | `viewer/app/balancer.js:36`, `:66` | `app-balancer.test.js:86-87` (lead order `['gpt','any']` → worker gets Claude); existing Claude-first cases unchanged |
| §1 Margin hold-back follows the reserved provider | this run | `viewer/app/balancer.js:61` | `app-balancer.test.js:88-90` (GPT below margin → worker and `--provider gpt` worker go to Claude); `:119`ff "margin skips Claude…" (default order, Claude reserved) |
| §1 Remove `saveForLeads` and its readers | this run | `viewer/app/providers.js:3`; `grep -rn saveForLeads viewer/` → no matches | grep |
| §1 Setting key `save_for_leads` in BALANCING, defaults (true), validBalancing | this run | `viewer/app/settings.js:25,27,209` | `app-usage.test.js:65-67` |
| §1 `normalize()` carries old `save_claude_for_leads` | this run | `viewer/app/settings.js:184` | `app-usage.test.js` "legacy reserve value is carried over from the saved settings file" (`:304`ff) and `app-usage.test.js:80` |
| §1 `PUT /settings/balancing` rejects the old key, returns `reserved_provider` | this run | `viewer/app/routes.js:183-185` | `app-usage.test.js:65-67` (400 `invalid save_claude_for_leads`; 200 with `save_for_leads:false`, `reserved_provider:'GPT'`) |
| §1 `GET /settings` `reserved_provider` (signed in on any machine) | this run | `viewer/app/routes.js:144-150`; `balancer.js:20` (`machineName == null` → any machine) | `app-usage.test.js:71`; `app-balancer.test.js:93-94` |
| §1 Settings row label / hint / `bal-save-lead` / aria-label; margin hint; "Held back when P runs short" | this run | `viewer/pages/settings.js:1138-1153` | `viewer/test/app-accounts.spec.js:255` "reserve labels follow the returned provider without reloading" (GPT, Claude after save, null → "the lead's provider") |
| §1 Page applies `reserved_provider` after any balancing save | this run | `viewer/pages/settings.js:1088` (in `saveBalancing`, used by Usage Save and lead-order Save) | `app-accounts.spec.js:255` (Usage save), `:285` (lead order save → "Save GPT for leads") |
| §1 `API.md` | this run | `viewer/app/API.md:35,38,87-92,102,104` | read |
| §2 Ready check: only the thread's own CLI | this run | `viewer/app/ready.js:39-42` | `viewer/test/app-hub.test.js:1025` (other CLI signed out → `{ok:true, missing:[]}`) |
| §2 Worker `--provider X`, X not signed in → normal order with note; X signed in → unchanged (400 for Not used; waits for room) | this run (not-signed-in branch); signed-in branch pre-existing, unchanged | `viewer/app/balancer.js:48`, `:79` | `app-balancer.test.js:73` (GPT-only: `--provider claude` → GPT, note `Could not use claude; using gpt.`); `:60` (GPT signed in, out of room → waits); `:266`ff "unused worker cell refuses a strict provider" |
| §2 `sub-lead.md` "Which family" | this run | `protocol/app/sub-lead.md:68-71` | `grep -n "signed out on that machine" protocol/app/sub-lead.md` → no match |
| §3 Setting `review_families` (default, normalize fallback, preferences PUT/400, GET, response) | this run | `viewer/app/settings.js:27,191,263`; `viewer/app/routes.js:231-233,257` | `app-usage.test.js:68-71`; `app-usage.test.js:81` (bad → `both`) |
| §3 Settings page "Reviewers and checkers" mode group, hints; reviewer/checker "Model tier" hints | this run | `viewer/pages/settings.js:366-370` | `app-accounts.spec.js:273` "review family choice saves and updates its hint" |
| §3 Session list returns `{ sessions, review_families }` | this run | `viewer/app/sessions.js:388` | `app-balancer.test.js:14-16` |
| §3 Hub enforcement: single family F ignores flags, candidates `[F]` regardless of `worker_order`, waits with `waiting_provider: F`; falls back with note when F not signed in or Not used; other roles unaffected | this run | `viewer/app/balancer.js:37-51`, `:80`, `:94` | `app-balancer.test.js:96-108`: `worker_order:['gpt']` + `claude` → reviewer on Claude; Claude full → `wait.provider === 'claude'`; Claude not signed in → GPT with note `Reviewers and checkers are set to Claude, but Claude is not available; using GPT.`; `gpt`: reviewer `--provider claude` and verifier `--not-provider gpt` → GPT |
| §3 `lead.md` step 5 (one reviewer, both lenses, one lane, `cross-family: no`; `both` unchanged) | this run | `protocol/app/lead.md:180-192` | read |
| §3 `lead.md` steps 1 and 9 (single family → no provider flag) | this run | `protocol/app/lead.md:102-106`, `:297-300` | read |
| §3 `sub-lead.md` verification step 3 | this run | `protocol/app/sub-lead.md:171-176` | read |
| §3 `reviewer.md` both lenses, label each finding | this run | `protocol/app/reviewer.md:3-6,26,53` | read |
| Validation: `app-accounts.spec.js` key list uses `save_for_leads` | this run | `viewer/test/app-accounts.spec.js:251` | browser suite |

## Deviations from plan

- §3 fallback note uses provider labels: "Reviewers and checkers are set to Claude, but
  Claude is not available; using GPT." The Spec writes `F`/`Y` without saying key or
  label; the sub-lead chose labels in the T1 brief (logged in PLAN.md). The §2 worker note
  keeps provider keys (`Could not use claude; using gpt.`) to match the existing note.
- `reviewer.md`: the finding line now always carries `LENS: mechanics|intent`, including
  for a single-lens reviewer (T2's choice, logged). No code parses the app reviewer's line.
- Spec Validation asks for "Claude signed in but out of room: still waits"; the test that
  covers the signed-in-but-full strict-worker wait uses GPT (`app-balancer.test.js:58-60`).
  The code path (`balancer.js:48` only drops a provider that is not signed in) is
  provider-agnostic.

## Routers

highways not installed (`command -v highways` finds nothing); routers not maintained. No
ownership moved; `viewer/app/API.md` (the route contract) was updated for every changed route.

## Validation evidence

Run on the feature branch after all three merges (HEAD `2f733ad`):

`node --test viewer/test/*.test.js`
```
not ok 258 - a starter that loses the freed port registers through the new holder
not ok 272 - a plan first graph creates its missing graphs directory and registers
# tests 379
# pass 377
# fail 2
```
- 258 is recorded in `docs/known-issues.md:6`; it fails identically on the feature base
  before any viewer change (3/3 runs on each).
- 272 failed with `server exited before ready (1): Refused to use a port held by a process
  it cannot identify.` (environmental port collision); re-run alone it passes 3/3:
  `node --test --test-name-pattern="a plan first graph creates" viewer/test/registration.test.js` → `# pass 1 # fail 0` ×3.

`npm --prefix viewer run test:browser`
```
  2 failed
    [chromium] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
    [firefox] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
  2 skipped
  580 passed (2.2m)
```
- Recorded in `docs/known-issues.md:57`; it also fails on the feature base before T3
  (base run: 6 failed = this test ×2 plus the old balancing test ×4 that T3 fixes).

`bash machine/test/run.sh`
```
# tests 96
# pass 96
# fail 0
```

`bash install/test/run.sh`
```
PASS real Codex config is byte-identical after suite
PASS real wheelchair directory is byte-identical after suite
RESULT 90 passed, 0 failed
```

## Known gaps / residual risks

- When the hub has no machine account state for the thread's machine (e.g. the machine
  service unreachable), nothing counts as signed in: the reserve resolves to `null` (no
  reordering) and a worker's `--provider` is dropped with a note. Placement itself already
  requires a signed-in account, so this changes only which note or wait appears.
- The protocol edits change the rules for sessions started after merge; sessions already
  running in this thread keep the old text.
- The T3 attempt 1 worktree (`wc-2fd7d426276c-w3`) is left in place: its commit was
  cherry-picked (as `f997021`), so the service refuses to remove it as unmerged. No files
  were deleted.

## Remediation rounds

None yet.
