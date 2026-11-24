# R3b — blocked

The popup remains a separate renderer, per the lead's permitted parity alternative; it is not yet fully equivalent to the thread renderer. [assistant-popup.js](../../../viewer/pages/assistant-popup.js) draws context, tool and peer lines, press bubbles, question consequences and free-text answers, needs actions, file and image cards, lesson text, queued messages and Send now (`viewer/pages/assistant-popup.js:94`, `:142`, `:208`). `viewer/pages/assistant-popup.css` styles the additional items. `viewer/pages/thread.js:1591` guards paste before load. `viewer/test/app-assistant-popup.spec.js:64` and `:84` cover context, press bubbles, consequence, free-text press, queued messages and Send now; the existing full-thread test also checks its sidebar.

Remaining parity gaps: pending-message reconciliation is based on matching text rather than the thread page's occurrence counts; it can discard a later identical message. Card rendering and behavior still differ: file preview and image/mockup presentation, question states and styling, and some system and resolved needs states are not identical. The popup does not share the thread renderer. These are material and this task is not done.

## Screenshots

- `/tmp/wc-r3b/popup-phone.png` vs `docs/plans/personal-assistant/graphs/mockup-popup-phone.html` and `/tmp/wc-r3b/mockup-popup-phone.png`.
- `/tmp/wc-r3b/popup-desktop.png` vs `docs/plans/personal-assistant/graphs/mockup-popup-desktop.html` and `/tmp/wc-r3b/mockup-popup-desktop.png`.
- `/tmp/wc-r3b/thinking-phone.png` vs `docs/plans/personal-assistant/graphs/mockup-thinking-phone.html` and `/tmp/wc-r3b/mockup-thinking-phone.png`.
- `/tmp/wc-r3b/thinking-desktop.png` vs `docs/plans/personal-assistant/graphs/mockup-thinking-desktop.html` and `/tmp/wc-r3b/mockup-thinking-desktop.png`.

The chrome matches in placement and size; the captured conversation intentionally has a question, consequences and context instead of the mockup's conversation. The card, answer layout, and focused composer differ; desktop background is the test fixture's thread index rather than the mockup's populated project thread.

## Validation

Initial embed attempt, before the lead rejected iframe/CSP changes: `cd viewer && npx playwright test test/app-assistant-popup.spec.js test/app-assistant.spec.js test/app-send-now.spec.js`:
```
exit 1
    Error Context: test-results/app-assistant-popup-assist-add13--running-and-offers-Restart-firefox/error-context.md

  10 failed
    [chromium] › test/app-assistant-popup.spec.js:79:5 › assistant pop-up › phone › opens as a sheet covering nearly the screen, with a close control 
    [chromium] › test/app-assistant-popup.spec.js:101:5 › assistant pop-up › desktop › opens as a side panel and sends text to the assistant thread 
    [chromium] › test/app-assistant-popup.spec.js:120:5 › assistant pop-up › desktop › shows thinking while the lead is mid-turn and not after 
    [chromium] › test/app-assistant-popup.spec.js:135:5 › assistant pop-up › desktop › unread dot appears for a newer item and clears on open 
    [chromium] › test/app-assistant-popup.spec.js:153:5 › assistant pop-up › desktop › says the assistant is not running and offers Restart 
    [firefox] › test/app-assistant-popup.spec.js:79:5 › assistant pop-up › phone › opens as a sheet covering nearly the screen, with a close control 
    [firefox] › test/app-assistant-popup.spec.js:101:5 › assistant pop-up › desktop › opens as a side panel and sends text to the assistant thread 
    [firefox] › test/app-assistant-popup.spec.js:120:5 › assistant pop-up › desktop › shows thinking while the lead is mid-turn and not after 
    [firefox] › test/app-assistant-popup.spec.js:135:5 › assistant pop-up › desktop › unread dot appears for a newer item and clears on open 
    [firefox] › test/app-assistant-popup.spec.js:153:5 › assistant pop-up › desktop › says the assistant is not running and offers Restart 
  34 passed (2.9m)
```
The frame could not load under the server's CSP. The embed changes were removed.

After the direct rendering changes, the same targeted command:
```
exit 0
  ✓  43 [firefox] › test/app-assistant.spec.js:177:1 › assistant page composer says Message the assistant and has no plan hint; other threads keep theirs (3.3s)
  ✓  45 [firefox] › test/app-assistant.spec.js:200:1 › assistant queued messages and card presses render and reconcile after Send now (1.7s)
  ✓  44 [firefox] › test/app-send-now.spec.js:48:1 › a later identical send remains visible while only the earlier send is in the transcript (6.0s)
  ✓  46 [firefox] › test/app-send-now.spec.js:59:1 › a regular composer send already shown by a poll does not get a queued duplicate (3.8s)
  ✓  47 [firefox] › test/app-send-now.spec.js:77:1 › an old queued message remains pending and can be sent now (1.3s)
  ✓  48 [firefox] › test/app-send-now.spec.js:84:1 › Enter sends, Shift+Enter starts a new line, and the switch turns Enter-to-send off (3.1s)

  48 passed (1.3m)
```
The option-consequence mutation and queue-rendering mutation each failed their new test as intended; the implementation was restored:
```
    Error Context: test-results/app-assistant-popup-assist-30ba6-quences-and-sends-an-answer-chromium/error-context.md

  1 failed
    [chromium] › test/app-assistant-popup.spec.js:63:3 › assistant pop-up › renders context, a press, and question consequences and sends an answer 
    Error Context: test-results/app-assistant-popup-assist-fa65f-essages-and-offers-Send-now-chromium/error-context.md

  1 failed
    [chromium] › test/app-assistant-popup.spec.js:84:3 › assistant pop-up › shows queued messages and offers Send now 
```

`npm --prefix viewer run test:browser` was started twice and neither run produced an exit status or summary: the process disappeared while polling its execution session. The first stopped after the following output:
```
  ✓   304 [chromium] › test/app-project-tools.spec.js:200:1 › add a tool, edit one keeping unknown fields, remove one with a confirmation (773ms)
  ✓   305 [chromium] › test/app-project-tools.spec.js:252:1 › a header with a key keeps its text before the key (428ms)
  ✓   306 [chromium] › test/app-project-tools.spec.js:290:3 › reply: pr_failed (499ms)
  ✓   299 [chromium] › test/app-harnesses.spec.js:251:5 › desktop › a Cancel that fails after a poll tick still says why (3.6s)
  ✓   307 [chromium] › test/app-project-tools.spec.js:290:3 › reply: failed (542ms)
```
The second stopped after:
```
  ✓    23 [chromium] › test/app-agents-decks.spec.js:118:5 › phone › deck face is opaque and the two outlines sit offset down and right behind it (321ms)
  ✓    24 [chromium] › test/app-agents-decks.spec.js:130:5 › phone › popover stays inside the viewport for a deck near the bottom (384ms)
  ✓    21 [chromium] › test/app-accounts.spec.js:312:5 › phone › balancing saves, and a 400 shows inline (2.1s)
  ✓    26 [chromium] › test/app-accounts.spec.js:331:5 › phone › reserve labels follow the returned provider without reloading (1.1s)
  ✓    27 [chromium] › test/app-accounts.spec.js:350:5 › phone › review family choice saves and updates its hint (720ms)
```
Both interrupted runs are incomplete, not passing validations. The rule to stop after the same gate fails twice prevents another retry here. Logs are `/tmp/wc-r3b/browser.log` and `/tmp/wc-r3b/browser-final.log`.

## Choices

- `viewer/pages/assistant-popup.js`: used the lead's parity alternative rather than extracting the thread page's stateful renderer.
- `viewer/pages/assistant-popup.js`: added Send now for queued user messages and preserved drafts when cards redraw; reconciliation remains incomplete as described above.
