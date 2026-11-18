# Remediation 4 — self-check-steps

Verification attempt 4 on `5e693f8dc80d40c2fe201465debabec43ea8e98f`: claude verifier PASS;
gpt verifier FAIL with two gaps.

## Gaps, verbatim

GAP: Check-card update instructions — The renderer changes a valid command path. At 390 px, Chromium and Firefox both displayed `/opt/_release_/bin` as `/opt/release/bin` because the update text was parsed as Markdown. [Renderer](viewer/pages/thread.js:839) · [Browser probe](/tmp/wc-verifier-10.vzGAgPHA/probe-literal.log)
GAP: Queued Fix it now — The lead can treat a superseded press as current. An isolated hub accepted a press for version A, recorded Done and a check card for version B, then delivered the press for A. The lead rule looks for a Done after the latest check card, so it misses the version change and directs the lead to use B’s notes for A’s press. [Lead rule](protocol/app/lead.md:515) · [Queue probe](/tmp/wc-verifier-10.vzGAgPHA/probe-queued-gated.log)

## Status

- The queued-press gap is the same gap as attempt 2's "Fix it now after a newer Done" and
  attempt 3's "Fix it now for the current head", surviving two fix attempts (R5, R6). Per the
  two-attempt rule it is a plan defect: sent to the lead, no third attempt.
- The update-rendering gap is new (first attempt). Held until the lead answers.
