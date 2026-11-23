# Remediation 1 — design-in-threads

Verification attempt 1 at 484dfcac. Claude verifier: PASS. GPT verifier: FAIL. Gap list verbatim (GPT verifier):

GAP: Mockup Open full size — Both entry points gave a 390 × 844 mockup a 388 × 842 viewport. The fixture switched to its narrower layout — the border consumes two pixels per dimension under the global `border-box` rule.
GAP: Built Open full size — On a 390 px phone viewport, a 1440 × 900 screenshot opened at 390 × 243. It reached true size after a second tap on the image — the link opens Chromium's raw image viewer.
GAP: Built and Mockup stacking — A 623 px card still stacks. The CSS queries the 589 px inner area, so it stacks above the Spec's 599 px card-width cutoff.
GAP: Designer revisions — After the first result, Agents shows the designer as finished during an active revision. A plain status message clears the outstanding reply, and ending the turn without a revised mockup produces no nudge.
GAP: Mockup diagram file check — Rare path: the CLI checks file type and size without verifying that the resolved file stays inside the named plan's `graphs/` directory.

Judgment: the last is a rare path (Accepted Risks, verification-1). Built Open full size deferred as D3 at the lead's answer. Remediated: full-size border and stacking width (R1), designer revisions (R2).

## R1

A verifier found two gaps in the mockup display (Spec "The `mockup` diagram format" and "`image` cards beside a mockup", in `docs/plans/design-in-threads/PLAN.md`):

1. **Full size is 2px too small.** On the picture page, a 390×844 mockup's iframe gets a 388×842 viewport: `.picture-body .picture-mockup` (`viewer/pages/picture.css:12`) has a 1px border, and the global `box-sizing: border-box` rule makes the border eat into the set width/height. Fix: add `box-sizing: content-box;` to that rule so the iframe's inner viewport is exactly `width` × `height`. Check the thread's `iframe.mockup-frame` (`viewer/pages/thread.css`, it has `border: 0`) also gets exactly `width` × `height` inside — it should already.
2. **Built and Mockup stack too early.** The Spec stacks them when the *card* is under 599px wide. The query `@container (max-width: 599px)` on `.image-pair` (`viewer/pages/thread.css:351-360`) measures the card's inner area, which is the card width minus its padding (16px each side) and border (1.5px each side, `thread.css:120`), so a 623px card stacks. Fix: change that one query (only the `.image-halves` one, not the form one below it) to `@container (max-width: 563.98px)` with a short comment that it is 599px card width minus 35px of card padding and border.

Tests, in `viewer/test/app-mockups.spec.js`: (a) on the picture page, assert the mockup iframe's `clientWidth`/`clientHeight` are exactly 390/844 (fails before fix 1); (b) set a viewport so the image card is between 600 and 640px wide and assert Built and Mockup are side by side, and one where the card is under 599px and they stack (find the viewport width that gives such a card; measure the card's `getBoundingClientRect().width` in the test and assert it is in range so the test means what it says). Break each fix once, watch the test fail, restore.

Lane: claude standard (the provider that built T2).

## R2

## The gap

The `designer` role (Spec "The `designer` role" in `docs/plans/design-in-threads/PLAN.md`; rules in `protocol/app/designer.md`) reports each set of mockups with a `result`, then waits; the lead sends revision requests as `message`s, each answered by new files and a new `result`, until the lead stops it. Today, a `result` sets `session.finished = true` (`viewer/app/cards.js:239`). After that:
- the Agents page shows the designer as `finished` while it works on a revision (`viewer/app/agents.js:120`);
- a plain status `message` from it clears its outstanding reply, because a finished agent's any message counts as a reply (`viewer/app/cards.js:225`), so a designer that ends a revision turn without a new `result` gets no quiet-session nudge (`viewer/app/quiet.js`).

A verifier reproduced it: revision delivered → `{owes_reply:true, finished:true}`; Agents state "finished"; designer ends the turn with a status message only → `{owes_reply:false, nudges:0}`.

## The fix (designer only; leave other roles' behaviour unchanged)

When a message from a designer's starter is delivered to a live designer session that is `finished` (the delivery path in `viewer/app/sessions.js` around :530-541, where `owes_reply` is set on delivery — confirm the exact spot and that it can tell the message came from `target.started_by`, e.g. from the queued item's source/text `[wc:from <starter>]`), set `target.finished = false` there, so:
- the Agents page shows it `working`/`idle` again, not `finished`;
- its next plain status message does not clear `owes_reply` (only a `result` or an `asks: true` message does, as for any unfinished agent), so the quiet watch nudges it if it ends a turn owing a reply;
- its next `result` sets `finished = true` again as today.
A message from anyone other than its starter does not reopen it. Stopping the designer works as today.

## Tests (new, in a new file `viewer/test/app-designer-revision.test.js` or beside the existing quiet/agents tests)

Each must fail when the behaviour breaks (seed a state different from the result; break the code once, watch it fail, restore):
- after a designer's `result` and then a delivered message from its starter: `finished` is false and its Agents node state is not `finished`;
- then a plain status message from the designer leaves `owes_reply` true; a `result` clears it and sets `finished` true;
- a mapper (or worker) in the same situation keeps today's behaviour (still `finished` after a follow-up message) — to show the change is designer-only.
Look at how `viewer/test/app-quiet.test.js` and `app-agents.test.js` build their worlds and reuse their helpers.

Lane: gpt standard (the provider that built T3).
