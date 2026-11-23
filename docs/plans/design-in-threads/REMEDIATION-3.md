# Remediation 3 — design-in-threads

Verification attempt 3 at c87fe479. Claude verifier: PASS. GPT verifier: FAIL. Gap verbatim:

GAP: Changes during review or after approval — A restarted lead can show Start building while "Agree the mockups" is still open. The lighter-mode restart rule directs the lead to post a fresh approval from `planning`, despite the mockup rule keeping approval closed. An isolated fixture confirmed that the hub pinned the fresh approval and queued Start building when pressed. (protocol/app/lead.md:905)

Judgment: normal use (a lead restart); the lead confirmed the proposed fix. A different rule from attempt 2's reviewer gap (same reopen-to-planning move).

## R4

## The gap

`protocol/app/lead.md` ~905-910 (the lead-restart paragraph starting "Before `Build accepted:`, reconcile the pin with IDEA.md") says: "In a lighter mode or after a change, if approved and the Log has `Build accepted:` after the last plan change, lock the pin and start the sub-lead if none is live. Otherwise retract any open approval, ignore presses on approvals you did not post, and post a fresh approval with a fresh Ready check." When a design change has returned the plan to `status: planning` (or it is in `ready-for-review` after the mockups were re-agreed), "Otherwise" sends a restarted lead to post a fresh approval, so Start building can be pressed while the mockups are unagreed or the change is unreviewed.

## Exact edit (in `protocol/app/lead.md` only)

Replace "Otherwise retract any open approval, ignore presses on approvals you did not post, and post a fresh approval with a fresh Ready check." with:

"Otherwise retract any open approval and ignore presses on approvals you did not post; if `status:` is `approved`, post a fresh approval with a fresh Ready check, and while it is `planning` or `ready-for-review` (as after a design change reopened it) post none."

Keep the rest of the paragraph unchanged. Re-wrap only the lines this touches to the file's width (about 92 characters), straight ASCII quotes. Change nothing else.

Lane: gpt light (the provider that built the protocol).
