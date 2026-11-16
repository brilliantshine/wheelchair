---
slug: claude-reserve-per-role
date: 2026-11-16
implemented-by: "T1 standard, gpt-6.1-terra (asked for Claude; the hub placed it on GPT because Claude was below margin)"
verified-by: []
---

# Completion Report — Separate Claude reserve settings for workers and reviewers

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| `held_back` added to `BALANCING` | this run | `viewer/app/settings.js:25` | `viewer/test/app-usage.test.js:64-67` (PUT accepted and echoed) |
| Default all four `true` in `defaults()` | this run | `viewer/app/settings.js:27` | `viewer/test/app-usage.test.js:19-21` |
| Missing or invalid saved value loads as the default (existing per-key fallback) | this run (fallback pre-existing at `viewer/app/settings.js:183`) | `viewer/app/settings.js:183`, `:201-204` | `viewer/test/app-usage.test.js:19-21` (no key → all true; `{}` → default) |
| `validBalancing('held_back')`: plain object, exactly the four keys, each boolean | this run | `viewer/app/settings.js:201-204` | `viewer/test/app-usage.test.js:64` (missing key, extra key, non-boolean, array → 400) and `:65-67` (full object → 200) |
| `PUT /settings/balancing` accepts and echoes `held_back` with no route change | this run (route unchanged) | `viewer/app/routes.js` untouched | `viewer/test/app-usage.test.js:66-67` |
| Balancer: `margin[p]` requires `settings.held_back[role] === true` | this run | `viewer/app/balancer.js:40` | `viewer/test/app-balancer.test.js:90-99` |
| `save_claude_for_leads` only reorders; does not affect the reserve | this run (unchanged code at `viewer/app/balancer.js:43-46`) | `viewer/app/balancer.js:40` has no checkbox term | `viewer/test/app-balancer.test.js:91-92`: fixture sets `save_claude_for_leads: false`, all four roles still go to GPT below margin |
| All-true: worker, reviewer, verifier, mapper avoid Claude below margin | this run | `viewer/app/balancer.js:40` | `viewer/test/app-balancer.test.js:92` |
| Reviewer unticked: `{provider:'claude'}` reviewer gets Claude, no note | this run | `viewer/app/balancer.js:40` | `viewer/test/app-balancer.test.js:93-95` |
| Worker still ticked: `{provider:'claude'}` worker falls back to GPT with note | this run (fallback path pre-existing) | `viewer/app/balancer.js:40`, `:49-56` | `viewer/test/app-balancer.test.js:96-97` |
| Lead still gets Claude | pre-existing behaviour, retested | `viewer/app/balancer.js:40` (`!['lead','sub-lead'].includes(role)`) | `viewer/test/app-balancer.test.js:98` |
| Settings page: `held_back` in `ensureDraft()` key list (structuredClone) | this run | `viewer/pages/settings.js:1047` | `viewer/test/app-accounts.spec.js:228-237` |
| Settings page: `held_back` in Save's `saveBalancing` list | this run | `viewer/pages/settings.js:1124` | `viewer/test/app-accounts.spec.js:237` (exact key list) |
| Margin row relabelled "Keep for leads (%)" with the Spec hint, id `bal-margin` kept | this run | `viewer/pages/settings.js:1134` | `numField` derives id from key `margin`; existing spec fills `#bal-leave`, same helper |
| Four checkboxes under it, ids `bal-held-*`, `aria-label`s, toggle draft only | this run | `viewer/pages/settings.js:1135-1137` | `viewer/test/app-accounts.spec.js:228-229` (unticking sends no request), `:236` (`held_back.reviewer === false` sent on Save) |
| "Save Claude for leads" hint reworded | this run | `viewer/pages/settings.js:1132` | read in source |
| No side scroll at phone width | this run | — | `viewer/test/app-accounts.spec.js:238` `noSideScroll`, passed phone and desktop, Chromium and Firefox |
| API.md lists `held_back` with shape | this run | `viewer/app/API.md:77-78` | read in source |
| API.md session-start wording → "subject to the Claude reserve when `held_back.worker` is on" | this run | `viewer/app/API.md:91` | read in source |
| `protocol/app/sub-lead.md:68` wording | this run | `protocol/app/sub-lead.md:68` | read in source |
| `protocol/app/lead.md`: no change | this run (no change, per Spec) | — | `grep -n margin protocol/app/lead.md` finds no reserve wording |

## Deviations from plan

None in behaviour. Two notes:

- The new checkbox labels use `class: 'check'`, which `viewer/pages/settings.css:199` styles only under `.order`, so in the Balancing box they render with default label styling. Cosmetic only; the phone-width no-side-scroll check passes.
- The worker's report (`reports/T1.md`) pastes full TAP and Playwright output, about 4,800 lines.

## Routers

highways not installed; routers not maintained. (No ownership moved; every file touched was already named by its router.)

## Validation evidence

The worker ran both suites at the same time and against a worktree without `node_modules` at first, so its own runs failed on port collisions and a missing font. It reported `blocked`. The sub-lead re-ran both suites one after the other in the worker's worktree (with `npm ci` done), at commit `86fe894`, the code merged here unchanged (`2cc27f2`).

`node --test viewer/test/*.test.js`:

```text
    ok 9 - margin skips Claude for workers but not leads
ok 186 - account normalization and balancing settings survive round trip
ok 190 - account and balancing routes and usage shape
not ok 233 - a starter that loses the freed port registers through the new holder
# tests 349
# pass 348
# fail 1
```

The one failure is the recorded known issue `docs/known-issues.md:6`. It fails the same way on the feature branch before this change. Re-run on the merged feature branch without `node_modules`: 347/349, the same known issue plus `an app page carries font-src self and the font route serves only the allowlist`, which needs the font package from `node_modules` and passes where they are installed (above).

`npm --prefix viewer run test:browser`:

```text
  ✓  264 [firefox] › test/app-accounts.spec.js:222:5 › phone › balancing saves, and a 400 shows inline
  ✓  371 [firefox] › test/app-accounts.spec.js:222:5 › desktop › balancing saves, and a 400 shows inline
  4 failed
    [chromium] › test/app-threads.spec.js:197:5 › phone › an archived diagram opens a child graph from the branch, with a way back, read-only
    [chromium] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
    [firefox] › test/browser.spec.js:1043:1 › a 409 mid-approve is survived by re-reading and re-applying the verdict
    [firefox] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
  2 skipped
  572 passed (5.8m)
```

Re-run of the four failing tests plus all of `app-accounts.spec.js`:

```text
  2 failed
    [chromium] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
    [firefox] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
  76 passed (37.9s)
```

The 409 and archived-diagram tests are flaky and passed on re-run. The arrow test is the recorded known issue `docs/known-issues.md:53`. This change touches no graph file and no graph-drawing code.

## Known gaps / residual risks

- Both required commands still exit non-zero, because of the two known issues above. Neither is related to this change.
- The checkbox styling note under Deviations.
- `settings.held_back[role]` for a role outside the four (only leads and sub-leads reach `choose`, and they short-circuit earlier in the same expression) evaluates `undefined === true`, which is false, so it fails safe toward Claude.

## Remediation rounds

### Remediation 1 — 2026-11-16

Verification attempt 1 (GPT gpt-6.1-sol, commit `6e3d4e5`): FAIL. It found no implementation defect. Both gaps came from the environment: its worktree had no `viewer/node_modules` (the brief said not to install them), and the lifecycle test is the known issue `docs/known-issues.md:6`. See `REMEDIATION-1.md`. No code changed. Attempt 2 is a fresh verifier allowed to run `npm --prefix viewer ci`, told to check any failure against the pre-change base `99a6a3a` and `docs/known-issues.md`.
