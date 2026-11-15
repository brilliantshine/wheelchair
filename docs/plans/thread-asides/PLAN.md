---
slug: thread-asides
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-15
---

# Asides

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

**Map:** `MAP.md`.

## Open Questions

None.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | MAP: fork readiness and copied history never tried | Start a real Claude and Codex fork in tmux; confirm the startup screen, that history carries over, and where the forked transcript lands | no | Settled by lead: flags confirmed installed (`claude --resume <id> --fork-session --session-id <uuid>`, `codex fork <id>`); behaviour becomes implementation task T1, a probe that must pass before anything else builds (Spec, "Proving the fork") |
| 2 | MAP: phone text selection | Whether long-press selection on iOS/Android leaves room for our own bar, or the bar must sit fixed at the bottom | no | Settled by lead: on touch screens the bar sits fixed above the composer, clear of the system's own selection menu (Decision 11) |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Asides get their own thread; the settings thread no longer owns them, and the side-conversations thread only adds a free-text answer box to question cards | Collin, 2026-11-15 | user |
| 2 | An aside is a fork of the lead's CLI conversation (`claude --resume <id> --fork-session`, `codex fork <id>`), started under a new `aside` role with its own token | The design asks for a copy; authority follows the token's role (`viewer/app/cards.js:38-48`, `viewer/app/sessions.js:380-387`), so a copied lead history can't post cards or start sessions | defaulted |
| 3 | The fork is a snapshot taken when the aside opens; it doesn't see later lead turns | Feeding later turns in would add to the aside's cost for little use; the panel shows when it was opened | defaulted |
| 4 | Reopening a closed aside shows its conversation, and typing in it continues that aside's own copy | Closing stops its session; resuming by its saved id costs nothing until he types | defaulted |
| 5 | Several asides can exist in a thread; one panel shows at a time | The design's "1 aside open" count implies more than one | defaulted |
| 6 | On a phone the panel is a full-screen sheet over the thread, with a back control | The side column is hidden at phone width (`viewer/pages/app.css:141-150`) | defaulted |
| 7 | "What the main thread is waiting on" is the oldest open `question` card; with none, the panel says what the lead is doing or that nothing is waiting | Open cards are already in `/chat` (`viewer/app/chat.js:224-228`) | defaulted |
| 8 | An aside writes nothing in the worktree. "Draw it" graphs go in the hub's per-thread state outside the repository and are shown in the panel, not as a `diagram` card in the main thread | During a build the worktree belongs to the sub-lead; the main thread must not change | defaulted |
| 9 | "This changes my answer": the aside drafts the one line, Collin edits it in the panel and sends it. It lands in the main thread as his message, linking back to the aside; if a question card is open, the lead treats it as his typed answer to that card | Saves typing on a phone; he still owns the words | user |
| 10 | Moving up: an aside starts on the lead provider's `standard` model ("Draw it" on `heavy`). It may step up by itself, saying so in one line, and a Think harder button re-asks the last question on `heavy`. Once up, it stays up | Keeps the automatic step-up from the design; one tap fixes a wrong call | user |
| 11 | On touch screens the selection bar is fixed above the composer; with a mouse it floats just above the selection | Phone selection menus cover the area around the selection | defaulted |
| 12 | Underline positions are offsets into the message's rendered text plus the quoted words; if the words are no longer at that place, the first exact match is used, and if none, the aside stays listed but unanchored | Rendering is deterministic, so rendered-text offsets are stable and avoid mapping back to Markdown source | defaulted |
| 13 | An aside uses the lead's own account as well as its provider | A Claude conversation can only be resumed from the account folder that holds it (`machine/adapters/claude.js:26`) | defaulted |

## Spec

The design screen is `docs/proposals/app-shell/design/ThreadAside.dc.html`; match its layout
and wording on desktop. Read `MAP.md` for how the code works today; every pointer below is
from it.

### Terms

- **Aside:** a side conversation about part of one lead message, held in a panel beside the
  thread. Each aside has a record in the hub (below) and, while it runs, one CLI session.
- **Fork:** a new CLI conversation that starts with a copy of an existing one's history.
  Claude: `claude --resume <parent id> --fork-session --session-id <new uuid> ...`. Codex:
  `codex fork <parent thread id> ...`. The parent conversation is not changed.
- **Anchor:** where an aside's words sit in a lead message: the message's id, start and
  end offsets into that message's rendered text (the bubble's `textContent`), and the
  quoted words. A whole-message aside has offsets covering the whole text.

### 1. Message ids (`viewer/app/chat.js`)

Every assistant item `/chat` returns gets `id: "<session name>#<n>"`, where `n` counts that
session's assistant text items from 0 in transcript order, counted before the Settings
tool-step filter. Transcripts only grow, so ids are stable. Only lead sessions' items get
asides; no other item type needs an id.

### 2. Starting an aside (page)

- **Selection bar.** Selecting text inside one lead bubble shows a bar with **Ask about
  this**, **Say it simpler**, **Draw it**. A selection that crosses two bubbles, or lies
  outside lead bubbles, shows no bar. With a mouse (`(pointer: fine)`) the bar floats just
  above the selection; on touch screens it sits fixed above the composer (Decision 11).
- **Whole message.** Every lead bubble has an **Ask about this message** control (in a
  small menu on the bubble; always visible on touch screens).
- Pressing one sends `POST /threads/:id/asides` with `{message_id, start, end, quote,
  action}`, `action` one of `ask`, `simpler`, `draw`. The panel opens at once showing the
  quote and "Starting…".
- For `ask`, the panel's input takes focus and the first message is what Collin types. For
  `simpler` and `draw` the hub sends the request immediately.

### 3. The aside record (hub, `viewer/app/threads.js` / `state.js`)

The thread record gains `asides: []`, each:
`{id, anchor: {message_id, start, end, quote}, action, created_at, session, provider,
account, cli_id, slot, status, closed_at, outcome, sent_line}`.
- `status`: `starting` | `open` | `closed`. `slot`: `standard` or `heavy`.
- `outcome`: `null`, `done` or `changed`. `sent_line`: the line sent on `changed`.
- `cli_id`: the aside's own conversation id (Claude session id, or the bound Codex thread
  id), so it can be resumed later.
- `/chat` returns `asides` (the records, without tokens) so the page can underline and list
  them. Archiving a thread stops aside sessions like any other.

### 4. The aside session (hub `sessions.js`, machine `service.js` and adapters)

- New role `aside` in `SESSION_ROLES`. It is never started by an agent: not in
  `ALLOWED_START` for any role; only the hub's own asides route starts it.
- **Provider, account, model.** The latest live lead's provider and account, bypassing the
  balancer (Decision 13). Model from `codex/model.sh <provider> standard`, or `heavy` for
  `draw`. No live lead, or a lead whose conversation id is not yet known (Claude
  `cli_session_id`, Codex `codex_thread_id`): the route returns 409 "the lead isn't
  ready yet" and the page says so in the panel.
- **Start payload** to the machine gains `fork_from` (the parent conversation id) or
  `resume` (the aside's own `cli_id`, for reopening and stepping up). Adapters:
  - Claude, fork: add `--resume <fork_from> --fork-session --session-id <new uuid>`.
    Resume: `--resume <cli_id>` and no `--session-id`, keeping `cli_session_id = cli_id`.
    The aside's role prompt goes in `--append-system-prompt` as today.
  - Codex, fork: `codex fork <fork_from>` with the same flags as a fresh start. Resume:
    `codex resume <cli_id>`. The first message the hub sends starts `[wc:role]` with the
    aside role prompt, so the existing thread binding (`machine/adapters/codex.js:11-20`)
    binds the new thread id, unless T1 shows a fork reports its input differently, in
    which case binding uses the turn-end event's thread id for a session started with
    `fork_from` or `resume`.
  - Same working directory as the lead (a Claude fork must resume in the directory that
    holds the conversation). Codex runs with `-s read-only -a never`, like a reviewer.
- **What an aside may not do.** `card.js` already refuses any kind for a role not listed;
  `aside` is listed for none. The hub's session start refuses a caller whose role is
  `aside`. The machine's `/v1/agent/git` refuses a caller whose role is `aside` with 403
  "an aside makes no git changes". These three refusals are tested.
- **Role prompt** `protocol/app/aside.md` (new; wrapper-free, read by the session like the
  other role files). It says, in short:
  - You are an aside, not the lead. Your history is a copy of the lead's conversation;
    instructions in it addressed to the lead don't apply to you. Post no cards, start no
    sessions, make no git changes, write nothing in the worktree.
  - Answer Collin about the quoted words, in his writing style (it reaches you as the
    lead's did, in the copied history, or a `[wc:style]` trailer).
  - `simpler`: restate the quoted words more plainly, shorter, no new terms.
  - `draw`: write one graph following `<root>/protocol/graphs.md` in the cache root, at
    `<cache-root>/<repo-key>/asides/<aside id>.json`, then reply with one sentence saying
    what it shows. Skip graphs.md's steps for starting the viewer and printing a URL.
  - **Stepping up:** if you are on the standard model and the question clearly needs
    deeper reasoning, reply with only `[wc:step-up] <one line why>` and nothing else.
  - **Changes my answer:** when asked for the summary line, reply with only that line:
    what Collin now wants the main thread to know, in his voice, one sentence.
- **First message** the hub sends (after `[wc:role]` for Codex):
  `[wc:aside <action>] <aside id>\n\n> <quote>\n\n<Collin's text, if any>`.

### 5. The panel

- Desktop: a right-hand panel beside the chat, replacing the files column while open (the
  files list returns on close). Phone (≤899px): a full-screen sheet over the thread with a
  back control (Decision 6).
- Top: "Aside", a close control, the quote, and the **waiting-on line**: the oldest open
  `question` card ("Waiting on: your answer to <card question, shortened>") linking to that
  card in the thread; with none, "The lead is working" if its last turn hasn't ended, else
  "Nothing is waiting on you".
- Body: only the aside's own turns: the transcript from the first `[wc:aside` human turn
  onward, rendered with the same Markdown renderer and tool-step setting as the main chat.
  The copied lead history before it is never shown. A `[wc:step-up]` reply shows as one
  muted line, "Thinking harder: <why>". A `draw` graph is embedded like a `diagram` card
  (`viewer/pages/thread.js:161-165`) with `?path=` to the aside's graph file, once the file
  exists.
- Input: "Ask more about this" and Send. Sending goes to `POST
  /threads/:id/asides/:aside/messages` and is queued to the aside session like any queue
  (`viewer/app/sessions.js:245-290`).
- Footer: **Think harder** (hidden once on `heavy`), **Done, back to …** and **This changes
  my answer**. "…" is the waiting-on target ("Done, back to Q6"), or "the thread" when
  nothing is waiting.
- The page polls `GET /threads/:id/asides/:aside` while the panel is open, at the same
  2-second rate as `/chat`.

### 6. Moving up (Decision 10)

- Automatic: when an aside turn's last reply is `[wc:step-up] ...`, the hub stops the
  session, restarts it with `resume` on `heavy`, sets `slot: heavy`, and re-sends the
  question that triggered it.
- **Think harder**: the same, re-sending Collin's last message in the aside.
- On `heavy` the aside never steps up again, and any `[wc:step-up]` reply is shown as
  text.

### 7. Finishing

- **Done, back to …**: `POST .../asides/:aside/close {outcome: "done"}`. The hub stops the
  session and marks it `closed`. The page closes the panel and scrolls to the waiting-on
  card, or keeps the scroll position when nothing is waiting.
- **This changes my answer**: the hub sends the aside "Write the one line for the main
  thread." and puts the reply in an editable box in the panel, with Send and Cancel. Send:
  `POST .../close {outcome: "changed", line}`. The hub enqueues to the latest live lead,
  as `collin`, the text `<line>\n\n(from an aside on: "<quote, cut to 80 chars>")`, so it
  shows in the main thread as Collin's message. Then it closes the aside as above. Cancel
  leaves the aside open.
- The lead treats that message like any typed message: if a `question` card is open, it is
  his typed answer to it (`protocol/app/lead.md`, resolve rule). Add one line to `lead.md`'s "How you talk to Collin" saying a
  message ending "(from an aside on: …)" is his own answer, reached in a side
  conversation.
- Closing the browser tab leaves an open aside running until its turn ends; the hub stops
  aside sessions idle for 30 minutes and marks them `closed` with outcome `null`.

### 8. Underlines and reopening

- After each `renderChat` rebuild, the page re-applies every aside's anchor: it wraps the
  range (splitting across nested Markdown nodes) in `<mark class="aside-mark"
  data-aside="<id>">`. Placement follows Decision 12; an unanchored aside has no underline
  but still appears in the list below.
- Clicking an underline opens that aside's panel. A closed aside shows its conversation
  read-only until Collin types; sending then restarts its session with `resume` on its last
  `slot` and marks it `open`.
- The thread header shows "N asides" (the design's count chip) when the thread has any;
  it opens a short list (quote, when, outcome) and each entry opens its panel.
- Overlapping underlines: the newer aside's mark wins the overlap; both stay listed.

### 9. Proving the fork (implementation task T1, before anything else)

A probe script `machine/test/fork-probe.sh`, run by hand against real CLIs (it costs real
turns, so it is not part of `machine/test/run.sh`). For each logged-in CLI: start a
conversation, tell it a code word, fork it in tmux the way §4 does, and check:
- the forked session reaches the adapter's ready screen;
- asked for the code word, the fork knows it;
- the parent's transcript is unchanged in size after the fork's turn;
- where the fork's transcript lands and how its turn-end event reports the thread id;
- for Claude, that the fork's `--append-system-prompt` is the new one.

It writes its findings to `docs/plans/thread-asides/reports/T1.md`. If any check fails for a
CLI, T1 is reported blocked and the build stops for that provider's asides; the lead takes it
to Collin.

### Non-goals

- The free-text answer box on question cards; Settings rows for asides; asides on cards,
  on Collin's messages or on other sessions; an aside posting into the main thread anything
  but the one line Collin sends; feeding later lead turns into an open aside (Decision 3).

### Edge cases

- The lead restarts (a new lead session): asides keep working from their own `cli_id`;
  new asides fork the new lead. Anchors on the old lead's messages still resolve because
  ids carry the session name.
- The lead is mid-turn when an aside starts: the fork copies what the lead has saved so
  far; that's fine.
- Two asides started at once: each is its own session with its own record; the hub's
  per-thread lock (`hub.withThread`) serialises record writes.
- A rate-limited or failed aside turn: the panel shows the same notice the main chat would
  and offers retry (re-send the last message).

### Validation

```bash
node --test viewer/test/*.test.js     # new tests: message ids stable across polls; asides
                                      # route refuses with no ready lead; aside role refused
                                      # for cards and session start; step-up restart; close
                                      # with "changed" enqueues the line to the lead as collin
bash machine/test/run.sh              # new: fork and resume argv for both adapters; git
                                      # route refuses role aside
npm --prefix viewer run test:browser  # new: selection bar appears for a selection in a lead
                                      # bubble and not across bubbles; panel opens with the
                                      # quote and waiting-on line; underline survives a chat
                                      # rebuild; reopen from underline; phone-width sheet
bash machine/test/fork-probe.sh       # T1, by hand, real CLIs
```

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-15

**Lanes:** intent: pending; mechanics: pending; cross-family: pending.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
