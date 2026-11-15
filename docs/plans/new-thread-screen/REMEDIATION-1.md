# Remediation 1 — new-thread-screen

Verification attempt 1 (Codex verifier, `gpt-6.1-sol`) on `26d926ad1651ae73073c8a0f23c6b609b605c671`: FAIL.

## Gap list (verbatim)

```
GAP: Machine-scoped project selection — switching machines leaves the previous project selectable and Start enabled while loading — Chromium reproduction delayed `/new-thread?machine=other`; Start posted `{"project":"/srv/repo","cli":"claude","machine":"other"}` using hub’s saved project (`viewer/pages/new.js:95`, `:119`, `:143`).
GAP: Dropdown without duplicate paths — saving `/srv/repo` as “first” and “second” produces two options with that same value — reproduced in Chromium; filtering happens before paths enter `seen`, allowing duplicates within a group (`viewer/pages/new.js:41`, `:45`).
GAP: Saved-directory removal — an accepted name `..` cannot be removed through the screen because URL normalization removes the path segment — reproduced: Save returned 201; Remove showed “Could not remove ..: route not found” and retained the entry (`viewer/app/routes.js:92`, `viewer/pages/new.js:113`).
GAP: Errors beside the saved-directory row — Remove errors appear in a shared banner above Add instead of beside the affected row — `viewer/pages/new.html:35` places the banner outside the saved list; `viewer/pages/new.js:116` sends removal errors there.
```

## Tasks

All four touch `viewer/pages/new.js`, so they run as one worker session (R1), same family
that built them (Claude), Standard tier. The brief settles each fix so the worker picks
nothing.

| # | Gap | Fix |
|---|-----|-----|
| R1a | Machine switch keeps the old project | On Machine change, before fetching: empty the Project dropdown, disable it and Start. `load` re-enables them from the new answer. Start posts `machine: state.machine` (the machine the dropdown was filled for), not `machineEl.value`. |
| R1b | Duplicate paths within a group | `group()` filters and marks `seen` in one pass, so a path is added once across and within groups; the first entry (by the order the hub returns) wins. |
| R1c | `..` saved but not removable | `POST /settings/saved-dirs` refuses a trimmed name of `.` or `..` with `400 "name can't be . or .."`. `DELETE` turns a malformed percent-escape into `404` (closes the residual risk in COMPLETION.md). |
| R1d | Remove errors not beside the row | A Remove error shows in an error line inside that saved entry's `<li>`; an Add error shows in a line directly under the Add row. The shared `#saved-error` banner goes. |

Brief: the sub-lead's scratch file `remediate1.md` (its content is the table above plus
ownership and validation), started as `wc-1a4f2c3d8d4c-worker-*` attempt `r1-a1`.
