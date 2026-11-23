# Remediation 2 — design-in-threads

Verification attempt 2 at c2f699df. Claude verifier: PASS. GPT verifier: FAIL. Gap list verbatim:

GAP: Design changes during review — Reopening planning leaves the old reviewers live, and the restart rules tell the lead to restart their round while "Agree the mockups" is still open — `protocol/app/lead.md:845` and `protocol/app/lead.md:913`. An isolated fixture confirmed that an old reviewer's result still reaches the lead while the plan is in `planning`.
GAP: Built and Mockup stacking — Chromium still shows two columns on a 598.5 px card, below the Spec's 599 px cutoff — `viewer/pages/thread.css:359` tests for an inner width of at most 563.98 px, but the measured inner width was 564.5 px.

Judgment: the stacking gap is a rare path (Accepted Risks, verification-2). The lead confirmed fixing the reviewers gap as proposed.

## R3

## The gap

`protocol/app/lead.md` (Mockups section, ~845-851) lets the lead reopen planning for a design change during review: it sets `status: planning` and re-adds "Agree the mockups", but does not stop the review round's live reviewers, so their results still reach the lead in planning. And the restart rule (~911-913, "If reviewers are still running in any mode, stop them, ... then restart the round under the same number with fresh reviewers") would restart a review round while "Agree the mockups" is open.

## Exact edits (in `protocol/app/lead.md` only)

1. In the paragraph starting "If the user requests a design change during review or after approval", after the sentence ending "re-add "Agree the mockups"," (before "then start a fresh designer"), make it say that the lead also stops any live reviewers of the current round and discards their reports; that round does not count. Suggested wording, adjusted to fit the sentence: "stop any live reviewers of the current round and discard their reports (that round does not count),".
2. In the restart paragraph ("If reviewers are still running in any mode, stop them, ... restart the round under the same number with fresh reviewers."), add: "If `status:` is `planning` (a design change reopened it), stop them and discard their reports, but do not restart the round; review starts again once the mockups are agreed." Place it right after the sentence about restarting the round.

Keep straight ASCII quotes and wrap lines to the file's width (about 92 characters, like the surrounding lines). Change nothing else.

Lane: gpt light (the provider that built the protocol, T4/T5).
