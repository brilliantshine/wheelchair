# Remediation 7 — Kimi Code support

Verification attempt 7 at `6b30111`: `wc-01b8cb1bf051-verifier-13` (claude-opus-5-5) PASS; `wc-01b8cb1bf051-verifier-14` (gpt-6.2-sol) FAIL with 3 gaps.

## Gaps, verbatim (from `wc-01b8cb1bf051-verifier-14`)

1. GAP: Kimi approval detection — Valid write panels with a full preview and plan-review panels with custom choices leave the agent waiting without a permission card. The 15-line cutoff drops the write title, and the plan matcher requires a choice beginning with `Approve`. Replaying both layouts through readiness polling emitted zero permission events. The short command control emitted one — `machine/adapters/kimi.js:112–121`, `machine/service.js:838–840`.
2. GAP: Machine-only Kimi log binding — Turn events still send the original wire-log path and embedded Kimi session ID to the hub. An isolated HTTP receiver captured both in `transcript_path` on `POST /api/machine/events` — `machine/service.js:735`, `:1093–1094`, `:1137–1141`.
3. GAP: Live approval validation — The required live approval capture remains incomplete. The smoke sampler ignores the renderer's `▶ 1. Approve once` line. Replaying the short command panel made the production matcher return `true` and the sampler return `false` — `test-support/smoke/kimi-live.js:70–80`, `docs/plans/kimi-code/reports/T6.md:11`.

## Status

All three sent to the lead: gap 1 is the approval-detection gap surviving again; gap 2 conflicts with the Spec ("Events": the service calls `hook()` with `transcript_path` set to the bound file); gap 3 concerns a live check the lead earlier allowed to be recorded as unverified.
