# Remediation 1 — lead-chat

Verification attempt 1 on b341883a. Claude verifier: PASS. GPT verifier: FAIL. Gaps verbatim:

- GAP: §3 handoff history — An answered `reach` entry loses the identity of the thread the user allowed or declined. An isolated export produced `We may overlap.\nallow` for a request naming `Rewrite reports`. — `viewer/app/handoff.js:38`
- GAP: §3 `reach` fields — The validator accepts a multiline `why` despite the one-line requirement. An isolated call with `First line\nSecond line` returned `ok: true`. — `viewer/app/card.js:103`
- GAP: §2 Validation — The committed test checks the transcript parser directly and skips the receiving thread’s chat view. A separate verifier check through `hub.chat` confirmed that the cross-thread message and reply are hidden while an ordinary turn stays visible. — `viewer/test/app-lead-messages.test.js:50`

Lead's ruling: fix all three; nothing deferred. Gaps 1 and 2 are hardening, gap 3 is must-fix (a Spec Validation item). No rare paths.

## R1 — one task for all three gaps

1. `viewer/app/handoff.js:38`, the `reach` case of the history text: add a first line naming the
   other thread, `Talk to <target_title> (<last path segment of target_project>)`, before the why
   and the answer. Keep the existing `allow failed: <reason>` / answer / `withdrawn` last line.
   Add an assertion in `viewer/test/app-reach.test.js` that an answered reach card's exported
   history names the target title.
2. `viewer/app/card.js:103`: `reach.why` must be one line: a non-empty string with no `\n` or
   `\r`. Define a small validator beside `text` (e.g. `line`) and use it only for `reach.why`;
   do not change the shared `why` used by other kinds (`card.js:68`). Add a test in
   `viewer/test/app-reach.test.js` that `why: 'First line\nSecond line'` is refused and a
   one-line why is accepted.
3. `viewer/test/app-lead-messages.test.js`: add a test that goes through the receiving
   thread's chat view (`hub.chat(<target thread id>)`, `viewer/app/hub.js:280`, as the verifier
   did) — set up a receiving lead whose transcript holds an ordinary user turn plus the
   delivered cross-thread message and its reply, then assert the cross-thread message and the
   reply are absent from the chat result while the ordinary turn is present. Look at how
   existing tests drive `hub.chat` (grep `viewer/test` for `.chat(`) and copy that setup. Keep the
   existing transcript-parser assertion.

No production change for gap 3: `viewer/app/chat.js` is not touched.
