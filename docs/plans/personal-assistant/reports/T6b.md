# T6b — Finish the assistant's pages

## Built
- `viewer/pages/thread.js:1500`: placeholder is "Message the assistant" on the assistant thread; other threads keep "Message the lead".
- `viewer/pages/thread.css:456`: `body.assistant-thread #composer .hint { display: none; }` hides the plan hint on the assistant page only.
- `viewer/pages/threads.js` (`previewLine`, `loadPreview`, `poll`): the preview is no longer awaited; `poll()` renders via `apply(...)` first, then fires `loadPreview`, which runs on load and at most once per 60 s per page (also guarded against overlap), re-renders only when the text changed, and is stored in `sessionStorage` (`wheelchair.assistantPreview`) so the first paint from the cached list already shows it.
- Preview text: first non-empty line of the latest assistant reply; strips only leading `#`+space headings, `>`, `- `/`* `/`1. ` markers and `**`/backtick marks; cut at 90 characters. `snake_case` and `#12` stay.
- `viewer/test/app-assistant.spec.js`: two new tests. (1) Row shows "1 needs you" from a real hub `question` card (this proves `/features` counts the assistant's cards; no boundary problem), preview "Waiting on snake_case and #12" from a reply whose first line is `## **Waiting** on \`snake_case\` and #12` (older reply and second line differ), preview survives a reload with the chat request aborted (cached), and only 1 `/chat` fetch from `threads.js` over two reloads... plus 11 s (two or more polls). The fetch is counted in-page by stack because the pop-up also reads that chat. (2) Composer placeholder and hidden hint on the assistant page; "Message the lead" and visible hint on another thread.
- Mutation check: replaced the 60 s guard with `false`; the preview-count test failed (Expected 1, Received 3); restored.

## Validation
```
npx playwright test test/app-assistant.spec.js test/app-assistant-popup.spec.js
exit 0 — 26 passed (47.4s)

npm --prefix viewer run test:browser
1452 passed, 34 skipped, 0 failed (19.9m)
```
The `node --test` suite was not run (not asked).

## Screenshots (temporary spec `viewer/test/tmp-shots.spec.js`, NOT committed, left in the worktree for you to remove)
Built / mockup, in /tmp/claude-1000/-home-collin--local-state-wheelchair-worktrees-wheelchair-wc-eec6963c41b4-w9/68ef937a-1d46-42d7-be72-a3fb8563a289/scratchpad:
- built-threads-phone.png / mockup-threads-phone.png (390x844)
- built-threads-desktop.png / mockup-threads-desktop.png (1280x800)
- built-thread-phone.png / mockup-thread-phone.png (390x844)
- built-thread-desktop.png / mockup-thread-desktop.png (1280x800)

Remaining visible differences (mostly outside my boundary or seed data):
- Header: built shows a hub chip with "0 workers online", an Agents count and the floating "Assistant" pop-up button; the mockup is a simplified header. Not mine.
- Threads list: the built list shows my seeded single "Usage page" thread under "Project" (mockup has Wheelchair/Home groups, and a pinned row title "Assistant" with "One thing needs your input."; built title is "Personal assistant" per T6 and the real preview text).
- Assistant thread page: the built page has "Open in terminal" in the head, a right-hand collapse rail/aside area and a larger composer with an attach button; the mockup has none. The seeded conversation is the real question card, not the mockup's lists with links. The "Open in terminal" button on the assistant page is in `thread.js`'s head code; I left it since the brief did not mention it.
- Built desktop assistant page scrolls to the last item, so the top bubble is partly hidden behind the head.

## Choices
- Preview store: a separate sessionStorage key rather than inside the cached list payload (`threads.js`).
- Preview re-render only when text changed (`threads.js`).
- Hid the hint with CSS on the `assistant-thread` body class rather than in JS (`thread.css`); `thread.html` is outside the boundary.
- Left the visually hidden label "Message the lead" for the composer unchanged (`thread.html`, outside boundary).
