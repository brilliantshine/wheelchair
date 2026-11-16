# Map: thread asides

Checked against `e440dec486680f4bce9b4be081a848b01ac0bde2` (origin/main). The shared maps are `docs/maps/app-thread-page.md` and `docs/maps/app-sessions.md`.

## Flow today

1. The page polls the hub; the hub reads only lead transcripts and emits assistant items without stable IDs or source offsets (`viewer/pages/thread.js:680-711`, `viewer/app/chat.js:94-115`, `:202-209`). When items or cards change, the page clears the chat and rebuilds Markdown DOM (`viewer/pages/thread.js:255-281`, `:670`; `viewer/pages/md.js:39-77`). The current page has a main chat and files column; the latter is hidden at phone width (`viewer/pages/thread.html:20-48`, `viewer/pages/app.css:141-150`).
2. Starting a session selects a provider and account, resolves a model, and sends the machine a token and startup settings (`viewer/app/sessions.js:83-95`, `:120-171`). Machine adapters start new Claude or Codex conversations; there is no fork/resume command path (`machine/service.js:278-281`, `machine/adapters/claude.js:16-23`, `machine/adapters/codex.js:30-31`). The machine persists Claude's `cli_session_id`; Codex's `codex_thread_id` is bound from the first turn-end only if its first input starts `[wc:role]` and its transcript exists (`machine/service.js:301-316`, `machine/adapters/codex.js:11-20`). Readiness checks assume their present startup screens (`machine/adapters/claude.js:24`, `machine/adapters/codex.js:32`).
3. Session queues submit to the machine when ready and idle; turn-end hooks release them, and the hub reads machine transcript copies (`viewer/app/sessions.js:245-290`, `:338-341`, `:367-374`, `machine/service.js:513-528`, `:588-603`, `viewer/app/chat.js:174-183`). Browser `/messages` always targets the latest live lead, with ordinary `collin` text (`viewer/app/routes.js:343-350`). Open question cards are available in `/chat` as non-replaced cards with `kind`, `id` and `answered`; presses and resolve set `answered` (`viewer/app/chat.js:224-228`, `viewer/app/cards.js:11-20`, `:31-35`, `viewer/app/threads.js:247-256`).

```
lead transcript -> parsed items -> rebuilt Markdown bubbles
                         |
                 question cards -> answer / lead queue
session start -> provider + account -> fresh CLI -> queue -> transcript -> page
```

## What matters for asides

- Persistent highlights need an identity and anchor beyond the current assistant item and disposable DOM; Markdown produces nested nodes, and rebuilding chat discards node-bound state (`viewer/app/chat.js:94-115`, `viewer/pages/thread.js:255-257`, `viewer/pages/md.js:39-77`). A selection toolbar can attach to lead bubbles and a panel alongside main chat, but phone layout needs its own treatment because `.col-side` is hidden (`viewer/pages/thread.html:20-48`, `viewer/pages/app.css:141-150`).
- A fork needs the parent's conversation ID **and account location**: the selected account controls CLI home and transcript lookup (`machine/service.js:292-307`, `machine/adapters/claude.js:26`, `machine/adapters/codex.js:33`). Current balancer keeps lead/sub-lead on the thread provider but selects accounts independently; other roles follow worker order, and a provider constraint is rejected for unlisted roles (`viewer/app/balancer.js:19-30`, `:35-41`). There is no `aside` role, transcript view, parent ID in the hub start payload, or fork-specific binding (`viewer/app/sessions.js:34-46`, `:151-175`, `viewer/app/chat.js:202-209`, `machine/adapters/codex.js:11-20`). Fork readiness and copied-history display must be verified with actual CLIs; the old Settings map's assertion that a fork never gets `[wc:role]` is not established by this code.
- A copied lead history can contain lead instructions, but authority follows the token's recorded session role: machine routes authenticate it and hub checks that role for cards and session starts (`machine/service.js:837-859`, `viewer/app/cards.js:38-48`, `viewer/app/card.js:21-34`, `:115-135`, `viewer/app/sessions.js:380-387`). Reusing a lead token grants lead authority. Inter-session `message` cards arrive as `[wc:from ...]`, and main chat hides that turn and its reply (`viewer/app/cards.js:79-85`, `viewer/app/chat.js:123-125`); the existing Collin message route yields visible ordinary text (`viewer/app/routes.js:343-350`, `viewer/app/chat.js:135-139`).
- For “Draw it”, the lead protocol writes a graph under the graph rules and posts a `diagram` card (`protocol/app/lead.md:342-349`); that card is currently lead-only (`viewer/app/card.js:21-29`). Hub acceptance registers the plan and graph (`viewer/app/cards.js:50-55`); the page embeds its graph URL in an iframe and offers full screen (`viewer/pages/thread.js:161-165`, `:535-545`). An aside-specific diagram cannot simply post the existing card without changing its role and display boundaries.

## What I did not look at

- Real CLI fork flags, forked transcripts, readiness screens, cross-account portability, or system-prompt replacement in a fork.
- Mobile browser selection behavior, accessibility details, and the mechanics of reliably mapping rendered selections back to source.
- Question-card free-text work, Settings implementation, and graph editor internals.
