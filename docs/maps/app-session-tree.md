# Map: session turns and results

Checked against: `be198998f46768a07d03019a25d1d4fd6890bf71` (origin/main)
Files covered: `viewer/app/sessions.js`, `viewer/app/cards.js`, `viewer/app/card.js`, `viewer/app/agents.js`, `machine/service.js`, `machine/hook.sh`, `machine/lib/hook-post.js`, `machine/adapters/claude.js`, `machine/adapters/codex.js`

> Lead-chat paths rechecked against `1ee9ad1487d2a3f8b6ceda7f73cf7218657f52c2`; see [lead-chat/MAP.md](../plans/lead-chat/MAP.md). Other claims retain their historical checked commit.

## Flow

A session start records `started_by`, passes its brief to the machine and records whether a first message will be typed (`viewer/app/sessions.js:174-185,196-210,233-247`). When ready, the machine submits `pending_initial`; Codex includes the role prompt and brief, Claude the brief (`machine/service.js:445-447,478-488`; `machine/adapters/codex.js:32`; `machine/adapters/claude.js:24`).

A CLI turn end is translated by its adapter, posted using the session token or spooled, and relayed by the machine to the hub (`machine/adapters/claude.js:28`; `machine/adapters/codex.js:35`; `machine/hook.sh:16-30`; `machine/lib/hook-post.js:15-30`; `machine/service.js:703-727,738-768`). The hub marks `turn_ended`, saves and attempts queued deliveries (`viewer/app/sessions.js:392-397,422-430`). For reviewer/verifier only, it extracts the last assistant text from the payload or transcript, creates a result, marks finished and queues it to the starter; absent text or a limit hold prevents that result (`viewer/app/sessions.js:257-280,392-397`).

A worker, mapper or sub-lead posts a result card; the hub stores it, marks the session finished and queues its summary to `started_by`. A message card instead queues its text to the named session (`viewer/app/card.js:23-38,114-120`; `viewer/app/cards.js:79-95`). Neither ordinary worker turn end nor `waiting_on` itself declares the task finished (`viewer/app/sessions.js:392-397`; `viewer/app/agents.js:11-14`).

```text
start with brief -> machine types first message -> turn -> turn-end hook -> hub records idle
                                                    | result card -> starter queue
                                                    | reviewer/verifier report -> starter queue
```

## What I did not look at

Provider selection details, worktree lifecycle, or transcript parsing internals.

> Risk-flow recheck at `635c45f07991f31191f2ab1443b52b4ee76559d5`: see [app-risks.md](app-risks.md).

> Agents-screen recheck at `3065046af16a1f6b2822d308b5c32431ca39a449`: the overlapping session, page and card paths were checked in [app-agents-screen.md](app-agents-screen.md). The rest of this older map was not rechecked.
