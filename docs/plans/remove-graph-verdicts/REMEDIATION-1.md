# Remediation 1

Verification attempt 1 on commit 458dff769854575b98f167d85d7cc2e7baa4181f: two verifiers (claude-opus-5-5, gpt-6.1-sol), both FAIL.

## Gaps, verbatim

From the GPT verifier (wc-d1880dd5eb13-verifier-2):

> GAP: Rules and docs — verdict-dependent instructions remain: preserve “Collin’s rulings” before updates and give each choice “one ruling” — protocol/implementation.md:146 and :202; README.md:106 still advertises graph rulings.
> GAP: Validation — browser suite remains red: `npm --prefix viewer run test:browser -- --workers=4` produced 576 passed, 2 skipped, 2 failed — browser.spec.js:2133 fails in both engines because the path match at :2177 returns null. COMPLETION.md identifies this as pre-existing.

From the Claude verifier (wc-d1880dd5eb13-verifier):

> GAP: Rules and docs, "Remove or rewrite every passage that depends on verdicts" — `README.md` still says the viewer works on a phone "including dragging boxes and rulings". There are no rulings any more. The line sits outside the "Pictures" section, so it was missed. — `README.md:106` "Everything, including dragging boxes and rulings, works on a phone." (the same line was at `README.md:110` before the change)

## Tasks

One task, R1, routed to GPT (the provider that built the docs and browser tests), Light tier: the brief names every line and the exact replacement.

- **R1.** Objective: reword `protocol/implementation.md:146` (read-back reason becomes the current hash, not rulings) and `:202` (drop "and one ruling"), `README.md:106` (drop "and rulings"); make `viewer/test/browser.spec.js:2133` skip run pictures, whose curved wires the straight-line check does not model. Ownership: those three files, those lines only. Validation: ruling grep empty; the geometry test passes in both engines; full browser suite passes.

The geometry test failure predates this plan (fails identically on the pre-change commit), but IDEA.md's "the test suites pass" makes it in scope.
