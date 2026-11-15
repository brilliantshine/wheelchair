# Map: app sessions, delivery and transcripts

Checked against: `e440dec486680f4bce9b4be081a848b01ac0bde2` (origin/main)
Files covered: `viewer/app/sessions.js`, `viewer/app/balancer.js`, `viewer/app/threads.js`, `viewer/app/cards.js`, `viewer/app/card.js`, `viewer/app/routes.js`, `viewer/app/chat.js`, `machine/service.js`, `machine/adapters/claude.js`, `machine/adapters/codex.js`, `machine/hook.sh`, `machine/lib/hook-post.js`

## Flow

1. Creating a thread calls `startSession` for a lead (`viewer/app/threads.js:56-74`). The hub recognizes lead, sub-lead, mapper, worker, reviewer and verifier; a lead may start mapper, reviewer, sub-lead or verifier, and a sub-lead may start worker or verifier (`viewer/app/sessions.js:34-46`, `:380-387`). The balancer selects provider and account: the lead is pinned to its thread provider after its first selection, while other roles use the worker order; explicit provider constraints are restricted to worker, reviewer and verifier (`viewer/app/balancer.js:19-30`, `:43-58`). Start resolves model, mints a session token and sends account, worktree, prompt layers and modes to the machine (`viewer/app/sessions.js:120-171`).
2. Machine `start` persists the session, including a generated `cli_session_id` and account directory, and launches tmux with the token and provider's account environment (`machine/service.js:284-317`). `commandFor` delegates to adapters: Claude passes `--session-id` and system prompt, Codex starts a fresh `codex` with its notify hook and sends `[wc:role]` as its first message; neither command has resume or fork handling (`machine/service.js:278-281`, `machine/adapters/claude.js:16-24`, `machine/adapters/codex.js:30-32`). Readiness is scraped from each CLI's pane (`machine/service.js:320-356`, `machine/adapters/claude.js:24-25`, `machine/adapters/codex.js:32`).
3. The hub stores a per-session queue; delivery requires a live, ready, idle session with no permission, needs or rate-limit hold. It submits the first message to the machine and removes it only after acknowledgement (`viewer/app/sessions.js:245-290`). Turn-end hooks bind transcripts and release the queue (`machine/service.js:588-603`, `viewer/app/sessions.js:338-341`, `:367-374`). The machine copies transcript lines to its own session file and the hub reads them through the machine transcript route (`machine/service.js:480-528`, `viewer/app/chat.js:174-183`).
4. Claude finds a transcript by `cli_session_id` within the selected account's projects directory, or receives its path from a hook (`machine/adapters/claude.js:26-27`, `machine/service.js:591`). Codex binds `codex_thread_id` from a turn-end event only when its first input starts `[wc:role]` and the account's transcript can be found; it rejects events for a different ID (`machine/adapters/codex.js:11-21`, `:33`). Machine sessions are persisted to `sessions.json` (`machine/service.js:132-136`, `:315-316`, `:602`). The hub's start payload has no parent CLI ID or fork argument (`viewer/app/sessions.js:151-175`).

```
thread / authorized caller -> hub chooses provider + account + model -> machine starts CLI
    -> ready pane -> queue submits -> CLI turn-end hook -> transcript copy
    -> hub reads transcript -> page polls
```

## Boundaries

A session token authenticates the caller to machine agent routes for cards, git and session requests (`machine/service.js:196-214`, `:837-859`). The service supplies the caller identity; the hub checks the stored role for card kinds and session starts (`machine/service.js:843-847`, `:663`, `viewer/app/cards.js:38-48`, `viewer/app/card.js:21-34`, `:115-135`, `viewer/app/sessions.js:380-387`). A token belonging to a lead therefore has lead card and session-start authority regardless of what the copied conversation is instructed to do; an aside needs an independently checked role and permissions. A `message` card is queued as `[wc:from ...]`, whose whole reply is hidden from the main chat (`viewer/app/cards.js:79-85`, `viewer/app/chat.js:123-125`).

## What I did not look at

- Installed CLI fork syntax or behavior, fork transcript format, and whether a changed system prompt applies to a fork.
- Account migration, all machine restart/recovery cases, and full Git permissions or provider quota calculations.
