# R3b — report

The lead clarified parity as the content and actions of the assistant thread's supported chat items and cards; the popup may omit queued messages and Send now, and styling need not match. The popup remains a separate renderer. `viewer/pages/assistant-popup.js:94` draws human, assistant, context, tool and peer items, including card press bubbles and attachments. `viewer/pages/assistant-popup.js:135` draws questions, needs (including system terminal and dismiss actions), files with preview and download, images, and lessons; `:223` sends card actions. The popup no longer lists the queue or offers Send now. `viewer/pages/thread.js:1591` guards a paste before the first thread load. `viewer/AGENTS.md:48` describes the popup's expanded role.

`viewer/test/app-assistant-popup.spec.js:64` covers the context, press, consequence and free-text answer; `:84` covers system needs, file, image and lesson content and the dismiss request. The ordinary thread's existing test checks header and sidebar. Tests intentionally broke when the consequence and preview actions were removed, then passed after restoration.

## Screenshots

- `/tmp/wc-r3b/popup-phone.png` compared with `docs/plans/personal-assistant/graphs/mockup-popup-phone.html` (`/tmp/wc-r3b/mockup-popup-phone.png`).
- `/tmp/wc-r3b/popup-desktop.png` compared with `docs/plans/personal-assistant/graphs/mockup-popup-desktop.html` (`/tmp/wc-r3b/mockup-popup-desktop.png`).
- `/tmp/wc-r3b/thinking-phone.png` compared with `docs/plans/personal-assistant/graphs/mockup-thinking-phone.html` (`/tmp/wc-r3b/mockup-thinking-phone.png`).
- `/tmp/wc-r3b/thinking-desktop.png` compared with `docs/plans/personal-assistant/graphs/mockup-thinking-desktop.html` (`/tmp/wc-r3b/mockup-thinking-desktop.png`).

The panel's size and chrome follow the mockups. The screenshots deliberately use a context line and a question with consequences, unlike the mockup conversation; the card styling, answer layout, composer focus and desktop background fixture differ.

## Validation

`cd viewer && npx playwright test test/app-assistant-popup.spec.js test/app-assistant.spec.js test/app-send-now.spec.js` after the card changes, before the last small attachment/label changes:
```
exit 0
  ✓  44 [firefox] › test/app-assistant.spec.js:200:1 › assistant queued messages and card presses render and reconcile after Send now (2.2s)
  ✓  43 [firefox] › test/app-send-now.spec.js:35:1 › a chat poll ahead of the send response does not leave a duplicate (5.8s)
  ✓  45 [firefox] › test/app-send-now.spec.js:48:1 › a later identical send remains visible while only the earlier send is in the transcript (6.3s)
  ✓  46 [firefox] › test/app-send-now.spec.js:59:1 › a regular composer send already shown by a poll does not get a queued duplicate (4.8s)
  ✓  47 [firefox] › test/app-send-now.spec.js:77:1 › an old queued message remains pending and can be sent now (4.9s)
  ✓  48 [firefox] › test/app-send-now.spec.js:84:1 › Enter sends, Shift+Enter starts a new line, and the switch turns Enter-to-send off (4.7s)

  48 passed (2.7m)
```
`cd viewer && npx playwright test test/app-assistant-popup.spec.js` after those changes:
```
exit 0
  ✓  15 [firefox] › test/app-assistant-popup.spec.js:152:5 › assistant pop-up › desktop › opens as a side panel and sends text to the assistant thread (3.4s)
  ✓  16 [chromium] › test/app-assistant-popup.spec.js:184:5 › assistant pop-up › desktop › unread dot appears for a newer item and clears on open (4.5s)
  ✓  18 [chromium] › test/app-assistant-popup.spec.js:202:5 › assistant pop-up › desktop › says the assistant is not running and offers Restart (2.6s)
  ✓  17 [firefox] › test/app-assistant-popup.spec.js:170:5 › assistant pop-up › desktop › shows thinking while the lead is mid-turn and not after (7.3s)
  ✓  19 [firefox] › test/app-assistant-popup.spec.js:184:5 › assistant pop-up › desktop › unread dot appears for a newer item and clears on open (4.9s)
  ✓  20 [firefox] › test/app-assistant-popup.spec.js:202:5 › assistant pop-up › desktop › says the assistant is not running and offers Restart (5.2s)

  20 passed (53.3s)
```
Mutation checks (removing option consequences and removing file Preview, respectively), restored after each:
```
    Error Context: test-results/app-assistant-popup-assist-30ba6-quences-and-sends-an-answer-chromium/error-context.md

  1 failed
    [chromium] › test/app-assistant-popup.spec.js:63:3 › assistant pop-up › renders context, a press, and question consequences and sends an answer 
    Error Context: test-results/app-assistant-popup-assist-cda5b-n-their-content-and-actions-chromium/error-context.md

  1 failed
    [chromium] › test/app-assistant-popup.spec.js:84:3 › assistant pop-up › system needs, file, image and lesson cards retain their content and actions 
```
Screenshot capture:
```
exit 0

```

Earlier `npm --prefix viewer run test:browser` attempts ended early without an exit status or summary when the process disappeared while its execution session was polled. Both attempts were incomplete, not passing checks; the task's rule to stop after the same gate fails twice prevents another retry here. The first ended with:
```
  ✓   304 [chromium] › test/app-project-tools.spec.js:200:1 › add a tool, edit one keeping unknown fields, remove one with a confirmation (773ms)
  ✓   305 [chromium] › test/app-project-tools.spec.js:252:1 › a header with a key keeps its text before the key (428ms)
  ✓   306 [chromium] › test/app-project-tools.spec.js:290:3 › reply: pr_failed (499ms)
  ✓   299 [chromium] › test/app-harnesses.spec.js:251:5 › desktop › a Cancel that fails after a poll tick still says why (3.6s)
  ✓   307 [chromium] › test/app-project-tools.spec.js:290:3 › reply: failed (542ms)
```
The second ended with:
```
  ✓    23 [chromium] › test/app-agents-decks.spec.js:118:5 › phone › deck face is opaque and the two outlines sit offset down and right behind it (321ms)
  ✓    24 [chromium] › test/app-agents-decks.spec.js:130:5 › phone › popover stays inside the viewport for a deck near the bottom (384ms)
  ✓    21 [chromium] › test/app-accounts.spec.js:312:5 › phone › balancing saves, and a 400 shows inline (2.1s)
  ✓    26 [chromium] › test/app-accounts.spec.js:331:5 › phone › reserve labels follow the returned provider without reloading (1.1s)
  ✓    27 [chromium] › test/app-accounts.spec.js:350:5 › phone › review family choice saves and updates its hint (720ms)
```
The full suite remains unverified; logs are `/tmp/wc-r3b/browser.log` and `/tmp/wc-r3b/browser-final.log`. The earlier iframe experiment was removed after the lead directed no iframe or CSP change; its initial targeted run failed 10 and passed 34 under the restrictive CSP.

## Choices

- `viewer/pages/assistant-popup.js`: used the lead's parity alternative instead of extracting the thread renderer, and omitted the queued-message list as permitted.
- `viewer/pages/assistant-popup.js`: for image mockups on the assistant's projectless thread, displays the thread page's “Mockup not found” state.
