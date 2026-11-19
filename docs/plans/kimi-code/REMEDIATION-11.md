# Remediation 11 — Kimi Code support

Verification attempt 11 at `f4da961`: `wc-01b8cb1bf051-verifier-21` (claude-opus-5-5) PASS; `wc-01b8cb1bf051-verifier-22` (gpt-6.2-sol) FAIL with 2 gaps.

## Gaps, verbatim (from `wc-01b8cb1bf051-verifier-22`)

1. GAP: Fatal-stop notification — Archiving before `pollDead` can erase a confirmed Kimi stop reason. In an isolated machine-to-hub run, the machine stopped the worker with "Couldn't find Kimi Code's log for this session." After Archive and `pollDead`, the hub had no reason, starter message, or card. `machine/service.js:922`, `viewer/app/threads.js:240`.
2. GAP: Read-only config parsing — A nested item in a valid multiline TOML array is mistaken for a table header. Moving the same array above the managed OAuth keys changed the fixture from signed in to signed out, contrary to the Spec's requirement to ignore multiline arrays and accept either key order. `machine/adapters/kimi.js:19`.

## Status

Both are in areas fixed twice or more before (fatal-stop notice: R3, P1, B1; config reader: T1, Z1). Sent to the lead.
