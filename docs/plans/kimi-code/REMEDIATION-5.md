# Remediation 5 — Kimi Code support

Verification attempt 5 at `031756a`: `wc-01b8cb1bf051-verifier-9` (claude-opus-5-5) PASS; `wc-01b8cb1bf051-verifier-10` (gpt-6.2-sol) FAIL with 3 gaps, none a repeat of an earlier gap.

## Gaps, verbatim (from `wc-01b8cb1bf051-verifier-10`)

1. GAP: Machine-only Kimi log binding — Retrying an unanswered start after the machine binds the Kimi log saves `kimi_session_id` and `source_transcript` in the hub and returns them to the starter. An isolated retry reproduced both — `machine/service.js:576`, `viewer/app/sessions.js:200`.
2. GAP: Fatal Stop and archive — A confirmed fatal Stop leaves a Kimi verifier's throwaway checkout on disk. Archiving then removes the session record while leaving the checkout registered. An isolated Git worktree reproduced both outcomes — `machine/service.js:652`, `machine/service.js:873`, `machine/service.js:926`.
3. GAP: Account region detection — The TOML reader treats `#` inside a quoted OAuth URL as a comment. A valid scratch config with `oauth_host = "https://auth.kimi.ai/#device"` was authenticated but reported as signed into China and made ineligible for placement — `machine/adapters/kimi.js:23`, `machine/adapters/kimi.js:35`.

## Task

| Task | Gaps | Provider (built by) | Files |
|------|------|---------------------|-------|
| Z1 | 1, 2, 3 | gpt (T1, T3) | `machine/service.js`, `machine/adapters/kimi.js`, `machine/test/kimi*.test.js` |

Z1 summary: (1) the machine never returns its Kimi-only fields (`kimi_session_id`, `source_transcript`, `kimi_log_id`, `kimi_offset`, `kimi_last_turn`, `kimi_missing_since`) outside the machine: one helper strips them from every session record the HTTP API returns (start, including the retried-start path, and `/v1/sessions`); (2) `stopFatal`, once absence is confirmed, removes a verifier's created worktree exactly as `stop()` does, so a fatal Stop and an archive leave no registered checkout; (3) the config reader strips a trailing `#` comment only outside a quoted string.
