---
slug: harness-install-solid
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-21
---

# Make agent installs solid

**Idea:** `IDEA.md` — read it first. **Map:** `MAP.md` and `docs/maps/onboarding-runtime.md`.
Follow-up to plan easy-onboarding (PR #155, `docs/plans/easy-onboarding/PLAN.md`, Deferred D1–D3).

## Open Questions

### Q1: Switching a harness's Use off while it is installing
- **Context:** Today switching Use off only stops the Settings poll; the install keeps running unseen and may finish later (`viewer/pages/settings.js:1725-1728`).
- **Options:** (a) switching off also cancels the install; (b) it leaves the install running, as now.
- **Recommendation:** (a): off means "I don't want this", and a hidden install nobody can see or cancel is surprising.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode: thorough | Collin picked it; this thread is itself the hardening follow-up | user |
| 2 | Cancel is one tap, no confirmation; a cancelled install shows "Install cancelled" (not an error) with Install offered again | Cancelling is harmless and re-installing is one tap; an "Install failed" alert for something the user did would mislead | defaulted |
| 3 | The 15-minute limit is enforced by the install job itself, so it holds with Settings closed and across machine-service restarts | IDEA: "stops on its own"; the job already outlives the service | defaulted |
| 4 | Failure explanations are computed on the machine from the install log and returned as a separate field; the raw tail is unchanged | Machine has the full log; UI stays a renderer | defaulted |
| 5 | Cancel and the time limit stop the whole install process group (SIGTERM, then SIGKILL after 5 s) | Script installers start curl/bash/npm children; killing only the leader would leave them running | defaulted |

## Spec

_Draft; finalised once Q1 is settled._

### Machine: install job (`machine/lib/harness-install.js`)

- The job runs its steps (node check, recipe, cleanup, sensitivity, CLI check) with async `spawn` awaited in order, not `spawnSync`, so its event loop stays free for the timer. Output still goes to the log exactly as today. Behaviour and exit codes of each step are unchanged.
- **Stop file.** `~/.wheelchair/installs/<p>.stop`, JSON `{reason: "cancelled" | "timeout", at: <ISO time>}`, mode 0600. Written before any kill. `start()` deletes any old stop file along with the old result.
- **Stopping** (shared helper `stopJob(p, reason)`): if `state(p).state !== 'running'` return false. Write the stop file, send SIGTERM to the process group `-pid`, then SIGKILL to `-pid` 5 s later if any member is still alive. Return true.
- **Time limit.** The job sets a timer for `WHEELCHAIR_INSTALL_LIMIT_MS` (default 900000 = 15 min) from its own start; on firing it writes the stop file with `timeout`, appends `The install took too long (over 15 minutes) and was stopped.` (minutes from the limit, rounded) to the log, and kills its group as above. The timer is cleared when the job finishes normally.
- **Result after a stop.** If the job is still able to write a result (e.g. it caught the signal) it writes nothing; the stop file decides. `state(p)`, when the PID is not live:
  - stop file `cancelled` → `{state: "cancelled", exit_code: null, explanation: null, ...}`.
  - stop file `timeout` → `{state: "failed", exit_code: null, explanation: "The install took too long (over 15 minutes) and was stopped. Try again; if it keeps happening, check this machine's network.", ...}`.
  - otherwise as today (result file, else "The install stopped before finishing.").
  - A stop file wins over a result file only when the stop file's `at` is not earlier than the job's `started_at` and no result `finished_at` precedes it (a job that finished just before the cancel keeps its real result).
- **Explanations (D3).** For `state: "failed"` from a result file or the dead-PID case, `explanation` is derived from the full log, first match wins:
  1. Disk full — `ENOSPC` or `No space left on device`: "The disk on this machine is full. Free up some space, then try again."
  2. npm folder not writable — `EACCES` or `EPERM` together with `npm` in the log: "npm isn't allowed to write to ~/.local on this machine (it may be owned by root). Fix that folder's owner, then try again."
  3. No network — any of `Could not resolve host`, `curl: (6)`, `curl: (7)`, `curl: (28)`, `ENOTFOUND`, `EAI_AGAIN`, `ECONNREFUSED`, `ETIMEDOUT`, `ECONNRESET`, `Network is unreachable`: "This machine couldn't reach the internet to download the installer. Check its network, then try again."
  - No match → `explanation: null`. Every GET response carries `explanation` (null when not failed).

### Machine: route (`machine/service.js`, `machine/API.md`)

- `DELETE /v1/harnesses/<p>/install` (hub auth): unknown provider 404; not running 409 `{error: "not installing"}`; else `stopJob(p, 'cancelled')` and 202 `{state: "cancelling"}`.
- API.md row updated: DELETE, the `cancelled` state, the `explanation` field.

### Hub (`viewer/app/routes.js`)

- The `/machines/<m>/harnesses/<p>/install` passthrough accepts DELETE as well as GET and POST, same validation and 502 on unreachable.

### Settings (`viewer/pages/settings.js`)

- Running row (not offline): a `Cancel` button (`aria-label "Cancel installing <name>"`) after "Installing…". Pressing it sends DELETE, then shows "Cancelling…" in place of the button; the existing GET poll carries on. A 409 just continues polling. A network error or 5xx shows the row error line "Couldn't cancel: <machine> isn't reachable." and keeps the Cancel button.
- Hidden while the row shows "Can't reach <machine>, retrying…".
- `cancelled` state: hint "Install cancelled" (not `role=alert`), the raw tail if any, and the `Install` button.
- `failed` state: when `explanation` is set, show it as a plain line (`class="h-explain"`) between "Install failed" and the raw tail.
- Job record keeps `explanation` alongside `state` and `tail`.

### Not doing

Removing files a cancelled install wrote; Cancel on the home checklist; explaining failures beyond the three listed; changing recipes.

### Validation

- `node --test machine/test/harness-install.test.js`: new cases with fake recipes — cancel a sleeping recipe (DELETE 202, then `cancelled`, the recipe's child `sleep` gone from the process table, Install works again); DELETE when idle → 409; `WHEELCHAIR_INSTALL_LIMIT_MS=500` with a sleeping recipe → `failed` with the timeout explanation and children gone; logs containing each pattern → matching explanation; unmatched failure → null.
- `node --test viewer/test/app-harnesses.test.js`: DELETE passthrough status/body and outage 502.
- `npm --prefix viewer run test:browser -- app-harnesses.spec.js`: Cancel button shows while running, sends DELETE, then "Install cancelled" with Install; explanation line shown above tail on failure; no Cancel while offline; phone and desktop sizes.
- Full: `bash machine/test/run.sh` and `npm --prefix viewer run test:browser`.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| A vendor installer that starts children in their own process group (setsid) survives Cancel/timeout | Not done by the current recipes' normal paths; rare per realism.md | planning |

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
