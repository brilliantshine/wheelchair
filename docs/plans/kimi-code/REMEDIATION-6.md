# Remediation 6 — Kimi Code support

Verification attempt 6 at `3ee4fae`: `wc-01b8cb1bf051-verifier-12` (claude-opus-5-5) PASS; `wc-01b8cb1bf051-verifier-11` (gpt-6.2-sol) FAIL with 4 gaps.

## Gaps, verbatim (from `wc-01b8cb1bf051-verifier-11`)

1. GAP: Permission prompts — Kimi 2.6.3 prefixes the approval title and selected choice with `▶`. The matcher rejects both forms, leaving the agent waiting without a permission card — replaying the installed renderer's `▶ Run this command?` and `▶ 1. Approve once` through readiness polling emitted zero prompt events (`machine/adapters/kimi.js:112–121`, `machine/service.js:838–840`).
2. GAP: Recovered Kimi panes — A pane at an approval prompt is recovered as Claude because the approval panel replaces the input box. The session stays running without the required stop reason — replaying the approval panel with the Kimi footer left the session `ready` with no `end_reason` (`machine/service.js:393–405`).
3. GAP: Machine-only log binding — After a transcript copy, a retried start and `/v1/sessions` still expose the original Kimi log path and session ID inside `transcript_source.path` — an isolated bind, copy, and retry returned that field in both responses (`machine/service.js:77–80`, `:1026–1028`, `:1281`).
4. GAP: Live checks — The checked-in smoke script waits on `source_transcript` and `kimi_last_turn` from `/v1/sessions`, which removes both. Even the pinned-model check cannot reach its assertion — replaying the script against the listing for an already-bound lead failed during setup (`test-support/smoke/kimi-live.js:23–34`).

## Surviving gap

- **Permission-prompt detection** (R1, Q1, A1; Decision 50 accepted its false positive): now a false negative on the real `▶`-prefixed panel. Sent to the lead.

Gaps 2–4 are remediable (at most one earlier fix each); asked the lead whether to proceed with them meanwhile.
