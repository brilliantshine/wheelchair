# Map: app thread page

Checked against: `e440dec486680f4bce9b4be081a848b01ac0bde2` (origin/main)
Files covered: `viewer/app/chat.js`, `viewer/app/threads.js`, `viewer/app/cards.js`, `viewer/app/routes.js`, `viewer/pages/thread.js`, `viewer/pages/thread.html`, `viewer/pages/thread.css`, `viewer/pages/app.css`, `viewer/pages/md.js`

## Flow

1. The page polls `/threads/:id/chat` every two seconds (`viewer/pages/thread.js:4-6`, `:680-711`). The hub reads every lead session's transcript, parses Claude and Codex rows into turns, hides `[wc:role]` and `[wc:from ...]` turns and their replies, filters tool steps according to Settings, and returns items and non-replaced cards (`viewer/app/chat.js:94-171`, `:202-230`). Assistant items contain `type`, `text`, and `at`, with no message ID or transcript offset (`viewer/app/chat.js:94-99`, `:106-115`).
2. On changed items or cards, `renderChat` clears `#chat`, interleaves non-pinned cards by timestamp, and creates a Markdown-rendered assistant bubble for each reply (`viewer/pages/thread.js:255-281`, `:658-671`). The renderer constructs DOM nodes, including nested inline formatting and links, from the Markdown (`viewer/pages/md.js:4-11`, `:39-77`, `:87`). The page's `#chat` is inside `.col-main`, and its current right-hand aside is for files (`viewer/pages/thread.html:20-30`, `:45-48`).
3. A question card carries an ID and `answered` flag from the hub (`viewer/app/cards.js:11-20`); chat returns non-replaced cards (`viewer/app/chat.js:224-228`). The page displays the question, options and answer state (`viewer/pages/thread.js:325-337`, `:394-419`). A press marks the card answered and queues a marked message to the latest live lead (`viewer/app/threads.js:212-257`).
4. The composer posts ordinary text to `/messages`; the hub chooses the latest live lead and enqueues it as `collin` (`viewer/pages/thread.js:693-705`, `viewer/app/routes.js:343-350`).

```
poll /chat -> read lead transcripts -> parse turns -> items and cards
    -> rebuild #chat -> Markdown DOM and question cards
composer / card press -> lead queue -> lead transcript -> next poll
```

At widths up to 899px, the thread hides both list and files columns; the header exposes plan files, chat padding shrinks, and the composer changes layout (`viewer/pages/app.css:141-150`, `viewer/pages/thread.js:167-172`, `viewer/pages/thread.css:200-222`). No existing aside panel or selection toolbar is present in the thread markup (`viewer/pages/thread.html:20-48`). A selection attached only to current DOM nodes would be lost when chat is rebuilt; rendered selections can span nested Markdown nodes (`viewer/pages/thread.js:255-257`, `viewer/pages/md.js:39-77`).

## What I did not look at

- Browser selection behavior across platforms, exact CSS layout measurements, and automated browser tests.
- Other app pages, archived graph serving and the full Markdown grammar.
