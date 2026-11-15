# Map: the app's thread page and Threads list (messages, cards, presses, plan links)

Checked against: `c8ebeadbf0b733414c0c1682c027aa7c09b04d2a` (origin/main)
Files covered: `viewer/app/threads.js`, `viewer/app/cards.js`, `viewer/app/chat.js`,
`viewer/app/views.js`, `viewer/app/routes.js`, `viewer/pages/thread.js`,
`viewer/pages/thread.html`, `viewer/pages/threads.js`, `viewer/pages/nav.js`

## Flow

1. **A thread is made.** The New thread form posts `{project, cli, machine, message?}`
   (`viewer/pages/threads.js:173-179`; the same script runs on the thread page). `createThread` builds the record, takes `title`
   from the message's first line cut to 60 characters, starts the lead with an empty brief
   at tier `top`, and queues the message to it as an ordinary message
   (`viewer/app/threads.js:42-64`; unchanged). A lead can rename it later with a `title` card
   (`viewer/app/cards.js:66-70`).
2. **The plan slug is discovered, not declared.** Every `GET /threads/:id/chat` and
   `GET /features` runs `findSlug` (`viewer/app/chat.js:220`, `viewer/app/views.js:35`):
   the one directory under `docs/plans/` this worktree added becomes `thread.slug`, and the
   plan is registered with the server (`views.js:75-82`).
3. **The page polls.** `poll` fetches `GET /chat` every 2 s (`viewer/pages/thread.js:603-632`).
   The hub's `chat` reads the transcript of **every session with role `lead`, and only
   those**, and turns it into items (`viewer/app/chat.js:218-246`).
4. **Transcript to items.** `transcriptItems` walks the JSONL: a human line starts a turn,
   assistant text and tool calls become its replies (`chat.js:150-191`, `100-130`).
   `renderTurn` hides a turn whose human text starts `[wc:role]` or `[wc:from ` together
   with its replies, turns `[wc:context …]` into a context line, and turns `[card <id>] …`
   into a short bubble (`chat.js:132-148`). **An item is `{type, text, at}` and nothing
   else: no id, no offset into the transcript** (`chat.js:113`, `117`, `145-146`).
5. **The page renders.** `renderChat` empties `#chat` and rebuilds it whenever the items or
   cards change (`thread.js:249-297`, called from `render` via `sync`, `thread.js:592`).
   A lead message is `div.bubble.assistant.md`, its Markdown drawn by
   `window.WCMarkdown.render` (`thread.js:272-275`). Cards are interleaved by time; pinned
   kinds (offer, idea, progress) render at the top (`thread.js:571-580`).
6. **Collin types.** The composer posts `{text}` to `/threads/:id/messages`
   (`thread.js:615-630`); the hub queues it to the lead and delivers it when the lead's
   turn ends (`viewer/app/sessions.js:192-233`). Delivery is a bracketed paste through the
   machine service's `/submit` (`sessions.js:214`).
7. **Collin presses a button.** The page posts `{action, value}` to `/cards/:id/press`
   (`thread.js:299-311`). The hub marks the card answered, stores `answered_action` and
   `answered_value` (except an approval's "Talk about this"), and queues
   `[card <id>] <suffix>` to the live lead (`viewer/app/threads.js:198-235`; suffixes at
   `:220-226`). The card then shows "You picked …" (`thread.js:332-347`).

```
POST /threads -> createThread (title from message) -> lead started (tier top) -> message queued
GET /chat every 2s -> chat(): lead sessions only -> machine /transcript -> transcriptItems
     -> items {type,text,at} (no id) -> renderChat rebuilds #chat -> WCMarkdown per lead message
typed message -> POST /messages -> queue -> delivered at lead turn end (/submit paste)
press -> POST /cards/:id/press -> answered + answered_value -> "[card id] picked: X" queued
```

## Changed since the older check

- `viewer/pages/thread.js` (+63 lines) and `viewer/app/chat.js` (+22) changed after the older check. Their `file:NNN` numbers in this map are from the older commit and have shifted; the flow was not re-traced.
- `chat()` now drops tool items when Settings `tool_steps` is `hide`, and strips a trailing `[wc:style]` block from human text (`viewer/app/chat.js`, diff against `5742e2f`). Not traced further here.
- A stub badge shows only until a lead runs in it (`viewer/pages/threads.js:51-57`).

## Plan document links

- `fileLinks` links MAP.md, IDEA.md and PLAN.md to the in-app document page
  `/wheelchair/app/doc?thread=<id>&file=<F>.md` once a slug is known
  (`thread.js:146-153`). A `question` card with a `doc` field links the same way
  (`thread.js:404-408`). The page itself is in `docs/maps/viewer-serving.md`.

## Tests that cover these spots

- `viewer/test/app-threads.spec.js` (Playwright): list, every card kind and its press body,
  plan links.
- `viewer/test/app-hub.test.js`: press queues `[card …]`, archived documents, slug discovery.
- `viewer/test/app-chat.test.js`: transcript to items, a press becomes a short bubble.

## What I did not look at

- `viewer/app/card.js`'s validation code beyond kind lists and `truncateTitle`.
- `viewer/pages/thread.css`.
- `viewer/test/helpers/app-threads-world.js`, the fixture world the browser tests use.
- Whether Codex transcripts render card presses differently from Claude's.
- The line numbers the earlier version of this map gave for tests; re-check before relying
  on them.
