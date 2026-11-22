# Remediation 1 — overlap-questions-solid

## Gap list (verbatim, verification attempt 1, gpt-6.2-sol)

GAP: Spec item 5 — A peer dropping shared work while a card is open can trigger repeated re-asks after Collin answers. If Collin leaves the work with that peer knowing it has paused, the next planning look still sees that the peer “no longer does it.” The rule checks that condition at every look without requiring a change after the latest answer was acted on, so the same news can keep reopening the question and stall planning — `protocol/app/lead.md:762`, `protocol/app/lead.md:784`, `docs/plans/overlap-questions-solid/IDEA.md` (“What good looks like”).

Judgment: normal use (a peer pausing while a card is open is ordinary), so it is fixed.

## R1-1 (light, claude)

Plan slug: overlap-questions-solid. Task: R1-1. Lead session: wc-213e51e374d6-lead.

Objective: make the re-ask in the "New overlap" bullet of protocol/app/lead.md compare against the state the answer was given in, so news the answer already knew never re-asks.

Ownership boundary: protocol/app/lead.md ("New overlap" bullet only), viewer/test/protocol-rules.test.js (the test named 'lead.md Overlap questions covers any project, earlier chat, finished check and re-ask' only), docs/plans/overlap-questions-solid/reports/R1-1.md.

Exact changes in protocol/app/lead.md (each old string occurs once):
1. Replace
   `names the shared work it was about; older ones naming none are not checked`
   with
   `names the shared work it was about and whether that thread was doing it then; older ones naming none are not checked`
2. Replace
   `re-ask only if the answer left the shared work to that thread and it no longer does it, or the answer kept the shared work in this plan and that thread has newly taken it on`
   with
   `re-ask only if that has since changed in a way that undoes the answer: the answer left the shared work to that thread and it has stopped doing it, or the answer kept the shared work in this plan and that thread has taken it on`

Test change: in that test's phrase list add `'whether that thread was doing it then'`.

Validation (paste output tails in the report):
  node --test viewer/test/protocol-rules.test.js
  (cd viewer && npm test)

Commit with `wc.js git commit --paths <exact paths>`. Report at docs/plans/overlap-questions-solid/reports/R1-1.md with the pasted output.

List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.
