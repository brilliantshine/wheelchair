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
| 14 | Supersedes 7: "waiting on" is the oldest unanswered `question`, `needs` or `approval` card, the same rule as the Needs you list | A pending Start building or a blocker is also something the thread waits on | review-round-1 |
| 15 | Supersedes 8 in part: an aside writes no files at all; a drawn graph comes back in its reply and the hub registers and saves it | A Codex aside runs read-only, and the viewer refuses unregistered graph writes (`viewer/server.js:1645`) | review-round-1 |

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
account, cli_id, slot, status, proc, pending, inflight, last_ask, number, closed_at,
outcome, sent_line, graph, notice}`.
- `status`, `proc`, `pending`, `inflight`, `last_ask`: see §6. `slot`: `standard` or
  `heavy`. `number`: 1 for the thread's first aside, and so on.
- `outcome`: `null`, `done` or `changed`. `sent_line`: the line sent on `changed`.
- `cli_id`: the aside's own saved conversation id (§6), so it can be resumed later.
- `/chat` returns `asides` (the records, without tokens) so the page can underline and list
  them. Archiving a thread stops aside sessions like any other.

### 4. The aside session (hub `sessions.js`, machine `service.js` and adapters)

- New role `aside` in `SESSION_ROLES`. It is never started by an agent: not in
  `ALLOWED_START` for any role; only the hub's own asides route starts it.
- **Provider, account, model.** The latest live lead's provider and account, bypassing the
  balancer (Decision 13). Model from `codex/model.sh <provider> standard`, or `heavy` for
  `draw`. A slot set to "Not used" in Settings (`model.sh` exits 3) is skipped: with
  `standard` not used the aside starts on `heavy`; with `heavy` not used it starts on
  `standard` (also for `draw`) and can't move up. With neither, the route returns 409
  "asides need a Standard or Heavy model for <provider> in Settings" and the panel says so.
  No live lead, or a lead whose conversation id is not yet known (Claude
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
  - `draw`: write no file. Reply with one sentence saying what the graph shows, then the
    graph's JSON (the schema in `<root>/protocol/graphs.md`) in one fenced block whose
    info string is `wc-graph`. Skip graphs.md's steps for files, the viewer and URLs.
  - **Stepping up:** if you are on the standard model and the question clearly needs
    deeper reasoning, reply with only `[wc:step-up] <one line why>` and nothing else.
  - **Changes my answer:** when asked for the summary line, reply with only that line:
    what Collin now wants the main thread to know, in his voice, one sentence.
- **Saving a drawn graph (hub).** When an aside turn ends, the hub looks in its last reply
  for a `wc-graph` block. If there is one, it registers
  `<cache-root>/<repo-key>/asides/<aside id>.json` the way a `diagram` card is registered
  (`hub.registerGraph`, as in `viewer/app/cards.js:50-55`), then saves the JSON through the
  viewer's own validated graph write, never by writing the file directly. Only after the
  save succeeds does the record get `graph: <path>`. A graph the write refuses leaves no
  `graph`, and the panel shows "Couldn't draw that: <reason>". A later `wc-graph` block
  replaces the graph.
- **Conversation ids reach the hub.** The hub copies a session's `cli_session_id` and
  `codex_thread_id` into its own session record from the machine's `/v1/sessions` listing
  (which it already polls, `viewer/app/sessions.js:445-460`) and from each turn-ended event.
  The machine includes `codex_thread_id` in each listed session (add it if absent). The
  asides route reads the lead's id from the hub's record; an aside's `cli_id` is set the
  same way once its own id is known.
- **Kept out of the main thread.** The app's own notices about an aside session (stuck at
  startup, permission needed, turn failed, sessions ended) are stored on the aside record
  as `notice` and shown in its panel, never posted as thread cards
  (`viewer/app/sessions.js:344-350` today posts them for any role). `/chat`'s `queued`
  count counts only lead sessions' queues (`viewer/app/chat.js:229`).
- **Messages to an aside** are always wrapped, so the panel can tell them apart. Each has
  a header line `[wc:aside <aside id> <kind>]`, where `<kind>` is `start-<action>` (the
  opening request), `ask` (anything Collin types in the panel) or `control` (the summary
  request in §7). The opening request is
  `[wc:aside <id> start-<action>]\n\n> <quote>\n\n<Collin's text, if any>`; the others are
  the header, a blank line, then the text. A message that starts a Codex session (fork or
  resume) is prefixed with `[wc:role] <aside role prompt>\n\n`.

### 5. The panel

- Desktop: a right-hand panel beside the chat, replacing the files column while open (the
  files list returns on close). Phone (≤899px): a full-screen sheet over the thread with a
  back control (Decision 6).
- Top: "Aside", a close control, the quote, and the **waiting-on line**: the oldest card
  still waiting on Collin, using the same rule as the "Needs you" list
  (`viewer/app/views.js:96-107`: an unanswered `question`, `needs` or `approval` card).
  It reads "Waiting on: <the card's title or question, shortened>" ("Start building" for
  an approval) and links to that card in the thread. With none, "The lead is working" if
  its last turn hasn't ended, else "Nothing is waiting on you".
- Body: only the aside's own turns. `chat.js` exports a function returning an aside's
  items. It parses the transcript into turns as for the lead, without `renderTurn`'s hiding.
  It drops every turn before the first whose human text has a line exactly equal to
  `[wc:aside <this aside's id> start-<action>]` (the id is unique, so a lead turn that only
  mentions the marker never matches). From there, each turn's header decides: `start-*`
  shows Collin's text after the quote (if any) and the replies; `ask` shows the text after
  the header and the replies; `control` turns are hidden with their replies; any text before
  the header (a Codex `[wc:role]` prefix) is never shown. Rendered with the same Markdown
  renderer and tool-step setting as the main chat. The copied lead history before it is never shown. A `[wc:step-up]` reply shows as one
  muted line, "Thinking harder: <why>". Once the record has `graph`, the graph is embedded like a
  `diagram` card (`viewer/pages/thread.js:161-165`) with `?path=` to that file, and the
  `wc-graph` block itself is not shown as text. Notices on the record show as muted lines.
- Input: "Ask more about this" and Send. Sending goes to `POST
  /threads/:id/asides/:aside/messages`, which adds it to the aside's own `pending` list
  (§6), not to a session queue.
- Footer: **Think harder** (shown only when §6 allows it), **Done, back to …** and **This changes
  my answer**. "…" is a short name for the waiting-on card ("Done, back to your question",
  "Done, back to Start building"), or "the thread" when nothing is waiting.
- The page polls `GET /threads/:id/asides/:aside` while the panel is open, at the same
  2-second rate as `/chat`.

### 6. Aside lifecycle and moving up (Decision 10)

One set of rules owns every start and stop of an aside's session, so close, reopen, step-up,
Think harder, failures and the idle timeout can't race each other.

- **Record fields.** `status` (`open` | `closed`) is what Collin sees. `proc` (`none` |
  `starting` | `running` | `stopping`) is what the process is doing. `pending` is the
  aside's list of messages not yet delivered, each `{kind, text}`. `inflight` is the message
  delivered and not yet answered. `last_ask` is the last `start-*` or `ask` message the
  session finished a turn on. Aside sessions don't use the hub's per-session queue.
- **A saved conversation.** `cli_id` is set only once a turn of that session has ended and
  its transcript has been found (Claude: the Stop hook's path; Codex: the bound thread). A
  generated `cli_session_id` alone (`machine/service.js:304`) doesn't count.
- **Delivering.** When `status` is `open`, `proc` is `running`, the session is ready and
  `inflight` is empty, the hub delivers the first `pending` message and moves it to
  `inflight`. At turn end the reply is handled (graph, step-up, summary) and `inflight`
  clears, becoming `last_ask` unless it was `control`.
- **Starting.** When `status` is `open`, `proc` is `none` and `pending` isn't empty, the hub
  starts a session on the record's `slot`: with `resume` when `cli_id` is set, else as a
  fresh fork of the current lead (§4). `proc` goes `starting`, then `running` when ready.
- **Stopping.** Done, a step-up, Think harder and the 30-minute idle timeout only ask for a
  stop: `proc` becomes `stopping`. The hub stops the process only once it is idle: its turn
  ended, failed or hit a limit; or it is ready with nothing in flight; or it never became
  ready (stuck at startup). So a stop never cuts off an answer. The machine's stop must
  confirm the tmux session is gone, and returns an error otherwise (today it ignores a
  failed kill, `machine/service.js:400-405`); the hub retries on its next poll. Only a
  confirmed stop sets `proc: none`, so a resume never overlaps the old process.
- **Unexpected death.** If the machine listing shows the session gone while `proc` is
  `starting` or `running`, or a start is refused: `inflight` goes back to the front of
  `pending`, `proc` becomes `none`, and the panel shows a notice. An open aside then starts
  again by the rule above, once. If that one dies too, it stops trying and the notice gets a
  Retry button, which allows one more start.
- **Done.** `status: closed`, `pending` cleared, stop requested. A closed aside never starts
  a session by itself. An answer already in flight finishes, and is there on reopening.
- **Reopening.** Collin types in a closed aside: `status: open`, the message goes into
  `pending`. If `proc` is still `stopping` and the stop hasn't been sent to the machine, the
  stop is cancelled and the live session takes the message; otherwise the start rule runs
  once `proc` is `none`. Nothing is replayed.
- **Stepping up, automatically.** At turn end, if the reply is `[wc:step-up] ...`, `status`
  is `open`, `slot` is `standard` and `heavy` is usable: the panel shows "Thinking harder:
  <why>", `slot` becomes `heavy`, `last_ask` goes to the front of `pending`, and a stop is
  requested. The start rule then resumes the conversation on `heavy`. In any other case the
  reply shows as text, and if `heavy` isn't usable, as "Can't think harder: the stronger
  model is off in Settings".
- **Think harder** is shown only when `status` is `open`, `slot` is `standard`, `heavy` is
  usable, `cli_id` is set and nothing is in flight. It does the same as a step-up.
- On `heavy` the aside stays on `heavy`.

### 7. Finishing

- **Done, back to …**: `POST .../asides/:aside/close {outcome: "done"}`. The hub closes it
  as in §6. The page closes the panel and scrolls to the waiting-on
  card, or keeps the scroll position when nothing is waiting.
- **This changes my answer** is enabled when `status` is `open`, `cli_id` is set and nothing
  is in flight. The hub adds a `control` message, "Write the one line for the main
  thread.", to `pending` and puts the reply in an editable box in the panel, with Send and Cancel. Send:
  `POST .../close {outcome: "changed", line}`. The hub enqueues to the latest live lead,
  as `collin`, the text `<line>\n\n(from aside <n> on: "<quote, cut to 80 chars>")`, where `<n>`
  is the aside's number in the thread (1, 2, …, stored on the record as `number`), so it
  shows in the main thread as Collin's message. The page turns a trailing
  "(from aside <n> on: …)" in a human item into a link that opens aside `<n>`. Then it
  closes the aside as in §6. Cancel
  leaves the aside open.
- The lead treats that message like any typed message: if a `question` card is open, it is
  his typed answer to it (`protocol/app/lead.md`, resolve rule). Add one line to `lead.md`'s "How you talk to Collin" saying a
  message ending "(from aside <n> on: …)" is his own answer, reached in a side
  conversation.
- Closing the browser tab changes nothing; an aside idle for 30 minutes is closed as in §6
  with outcome `null`.

### 8. Underlines and reopening

- After each `renderChat` rebuild, the page re-applies every aside's anchor: it wraps the
  range (splitting across nested Markdown nodes) in `<mark class="aside-mark"
  data-aside="<id>">`. Placement follows Decision 12; an unanchored aside has no underline
  but still appears in the list below.
- Clicking an underline opens that aside's panel. A closed aside shows its conversation
  until Collin types, which reopens it (§6).
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
- A rate-limited or failed aside turn: the panel shows the notice and a Retry button, which
  puts `last_ask` back in `pending`.

### Validation

```bash
node --test viewer/test/*.test.js     # new tests: message ids stable across polls; asides
                                      # route refuses with no ready lead; aside role refused
                                      # for cards and session start; close with "changed"
                                      # enqueues the line to the lead as collin; §6 lifecycle
                                      # with a fake machine: Done mid-turn lets the turn finish
                                      # then stops; step-up after Done does nothing; reopen
                                      # while stopping reuses the session; step-up replays
                                      # last_ask then pending in order; death re-queues
                                      # inflight and restarts once; no resume without a
                                      # saved cli_id; "Not used" slots
bash machine/test/run.sh              # new: fork and resume argv for both adapters; git
                                      # route refuses role aside; stop reports an error when
                                      # the tmux session survives
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

**Lanes:** intent: gpt; mechanics: gpt; cross-family: no (the hub could not start a Claude reviewer).

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent (gpt) | blocking | Waiting-on line counts only question cards, so a pending approval or needs card shows "Nothing is waiting" | upheld | Checked `viewer/app/views.js:96-107`; waiting-on now uses the Needs you rule (Decision 14) |
| mechanics (gpt) | blocking | Draw it never registers its graph, so writes and the iframe get 403 not-registered | upheld | Checked `protocol/graphs.md:488-500`, `viewer/app/cards.js:50-55`; the hub registers and saves the graph (Decision 15) |
| mechanics (gpt) | major | A read-only Codex aside can't write the graph file | upheld | Graph returned in the reply instead (Decision 15) |
| mechanics (gpt) | major | Late-bound Codex ids never reach the hub's records | upheld | Checked `machine/adapters/codex.js:11-20`; Spec now copies ids from the session listing and turn-ended events |
| mechanics (gpt) | major | Close or Think harder before the first Codex turn ends leaves nothing to resume | upheld | Spec: Think harder waits for the id; early close stops at turn end; no-id reopen forks afresh |
| mechanics (gpt) | major | Codex's combined `[wc:role]` turn is hidden by the parser, so the panel would be empty | upheld | Checked `viewer/app/chat.js:123`; aside items come from their own filter |
| mechanics (gpt) | major | App notices and queue counts for aside sessions leak into the main thread | upheld | Checked `viewer/app/sessions.js:344-350`, `viewer/app/chat.js:229`; notices go to the aside record, `queued` counts leads only |

### Round 2 — 2026-11-15

**Lanes:** intent: pending; mechanics: pending.

**Changed since Round 1:**
- Waiting-on line uses the Needs you rule: question, needs and approval cards (§5, Decision 14).
- Draw it: the aside writes no file; the graph comes back in a `wc-graph` block and the hub registers and saves it (§4, §5, Decision 15).
- Conversation ids copied into the hub's records from the session listing and turn-ended events (§4).
- Behaviour before an aside's first turn ends: Think harder disabled, early close, reopening with no id (§4).
- The panel's own transcript filter, which works for Codex's combined first turn (§5).
- Aside notices and queue counts kept out of the main thread (§4).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics (gpt) | blocking | Substring cutoff on `[wc:aside ` can expose copied lead history when an earlier lead turn mentions the marker | upheld | Checked §5; the cutoff now matches this aside's exact envelope header line |
| mechanics (gpt) | major | Step-up restart strands messages queued on the stopped session | upheld | Checked `viewer/app/sessions.js:245-260`; queued messages move to the replacement, after the re-sent question |
| intent (gpt) | major | Early-close rule closes "This changes my answer" before Collin can edit and send the line | upheld | Checked Decision 9 and §7; This changes my answer is now disabled until the first turn ends, so only Done can close early |

### Round 3 — 2026-11-15

**Lanes:** intent: pending; mechanics: pending.

**Changed since Round 2:**
- This changes my answer is disabled until an aside's first turn ends; only Done can close early (§4).
- The panel's transcript cutoff matches this aside's exact envelope header line (§5).
- Messages queued on an aside move to its replacement session on step-up, Think harder and reopening (§6).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics (gpt) | major | Think harder could send a queued question twice | upheld | §6: replay only the last delivered message; queued ones follow once |
| mechanics (gpt) | major | Reopening would replay an answered question | upheld | Same as the intent finding above, already fixed |
| mechanics (gpt) | major | Early close then quick reopen could run two processes on one conversation | upheld | §4: reopening during a pending stop cancels it and reuses the live session; `resume` only after a real stop |
| intent (gpt) | minor | Reopening would replay an already-answered question | upheld | §6: reopening moves the queue but re-sends nothing |

### Round 4 — 2026-11-15

Collin chose "Keep going" after three rounds; the budget is reset.

**Lanes:** intent: pending; mechanics: pending.

**Changed since Round 3:**
- Reopening moves queued messages but re-sends nothing (§6).
- Think harder re-sends only the last delivered message; queued ones follow once (§6).
- Reopening during a pending deferred stop cancels it and reuses the live session; `resume` only after a real stop (§4).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent (gpt) | major | Early close and automatic step-up conflict at the same turn end | upheld | §6: closing wins; a closed aside never restarts |
| intent (gpt) | major | After Cancel, Think harder would replay the summary request | upheld | §6: messages are marked Collin's or control; replays use Collin's only |
| intent (gpt) | major | No outcome when Standard or Heavy is "Not used" in Settings | upheld | Checked `viewer/app/sessions.js:28` (exit 3 is a supported "not used"); §4 skips unused slots, §6 shows "Can't think harder" without restarting |
| intent (gpt) | minor | The handoff message has no link back to the aside (Decision 9) | upheld | §7: the message names the aside by number, and the page links it |
| mechanics (gpt) | major | An allocated Claude id is mistaken for a saved conversation after an early close | upheld | Checked `machine/service.js:304`; §6: `cli_id` only after a turn ends with a transcript |
| mechanics (gpt) | major | Deferred close never completes for a session awaiting its first message or after a failed turn | upheld | §6: stops wait for any idle state, including failed turns and stuck startups |
| mechanics (gpt) | major | Close and step-up conflict at the same turn end | upheld | Same as the intent finding; §6 step-up requires `status: open` |
| mechanics (gpt) | major | Closing mid-follow-up kills an in-flight answer | upheld | §6: stops never cut off a turn |
| mechanics (gpt) | major | Machine stop reports success when the tmux kill fails | upheld | Checked `machine/service.js:400-405`; §6 requires a confirmed stop before any resume |
| mechanics (gpt) | major | No recovery when an aside session dies or a restart fails | upheld | §6 "Unexpected death": re-queue, one automatic restart, then Retry |
| mechanics (gpt) | major | The handoff message can't identify which aside it came from | upheld | §7: numbered asides |
| mechanics (gpt) | minor | Codex restarts would show `[wc:role]` text in the panel | upheld | §4/§5: every message has a header; text before it is never shown |

Recurring theme across rounds 2-4: the aside session's lifecycle was specified as scattered rules. Round 4's fix replaces them with one lifecycle section (§6).

### Round 5 — 2026-11-15

**Lanes:** intent: pending; mechanics: pending.

**Changed since Round 4:**
- §6 rewritten as one lifecycle: `status`/`proc`/`pending`/`inflight`/`last_ask`, saved-conversation rule, stops that wait for idle and are confirmed, death recovery, closing wins, reopening, step-up and Think harder.
- §4: every message to an aside has a header line; the "Before the first turn ends" rules are folded into §6.
- §5: the panel filter uses the headers; Think harder shown per §6.
- §4: "Not used" model slots.
- §7: numbered asides for the link back; summary request goes through `pending`.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
