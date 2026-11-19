# Remediation 10 — Kimi Code support

Verification attempt 10 at `0f8b93f`: `wc-01b8cb1bf051-verifier-19` (claude-opus-5-5) PASS; `wc-01b8cb1bf051-verifier-20` (gpt-6.2-sol) FAIL with 2 gaps.

## Gaps, verbatim (from `wc-01b8cb1bf051-verifier-20`)

1. GAP: Minimum Kimi version at launch — Replacing the executable while the final `--version` check is running can still launch a version below the floor. An isolated start recorded 2.6.3 for both checks and then ran the replacement, 2.6.2. `machine/service.js:1313`.
2. GAP: Unreadable transcript notice — A log containing only metadata and thinking events renders an empty chat. The Spec requires "Couldn't read this Kimi Code transcript" when no supported rows are present. `viewer/app/chat.js:211`.

## Status

Gap 1 is the version-at-launch gap again after V1: sent to the lead. Gap 2 is new and small.

Gap 2 fixed by N1.
Gap 1 settled by Collin (Decision 55): Accepted Risk.
