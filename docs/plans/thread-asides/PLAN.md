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
| 16 | Supersedes 2 and 4 on mechanism: an aside is not a session. Each message runs as one headless CLI turn (fork for the first, resume after), with no tmux, token or stop | Rounds 2-5 kept finding races in starting, stopping and restarting long-lived aside sessions; one-shot turns have none of that state, and with no token an aside can't post cards or use git | review-round-5 |
| 17 | Supersedes 3: the copy is made at the aside's first turn, from the lead conversation recorded when the aside was opened. It may include lead turns from between opening and the first message; it never sees later ones | Forking needs a message to run; recording the parent at opening keeps a lead restart from losing context | review-round-5 |

## Spec

The design screen is `docs/proposals/app-shell/design/ThreadAside.dc.html`; match its layout
and wording on desktop. Read `MAP.md` for how the code works today; every pointer below is
from it.

### Terms

- **Aside:** a side conversation about part of one lead message, held in a panel beside the
  thread. Each aside has a record in the hub (§3); each message to it runs as one headless
  CLI turn (§4).
- **Fork:** a new CLI conversation that starts with a copy of an existing one's history
  (`claude -p --resume <id> --fork-session`, `codex exec fork <id>`). The parent
  conversation is not changed.
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
  quote. Creating the aside records the lead's conversation id (§3, `fork_parent`).
- For `ask`, the panel's input takes focus and the `start` message is made when Collin
  sends what he types. In general: a message typed into an aside whose `history`,
  `pending` and running `turn.message` hold no `start` message becomes the `start` message (quote and action included);
  every later one is `ask`. For `simpler` and `draw` the `start` message is queued at once.

### 3. The aside record (hub, `viewer/app/threads.js` / `state.js`)

The thread record gains `asides: []`, each:
`{id, number, anchor: {message_id, start, end, quote}, action, created_at, provider,
account, fork_parent, cli_id, slot, status, pending, turn, history, failed, closed_at,
outcome, sent_line}`.
- `number`: 1 for the thread's first aside, and so on.
- `fork_parent`: the lead's conversation id when the aside was created (Claude
  `cli_session_id`, Codex `codex_thread_id`).
- `cli_id`: the aside's own conversation id, set from its first successful turn.
- `slot`: `standard` or `heavy`. `status`: `open` or `closed`.
- `pending`: messages not yet run, each `{kind, text}`, `kind` one of `start`, `ask`,
  `control`. `turn`: the turn running now, `{id, state, message}`, or null; the message
  lives there, not in `pending`, while it runs. `failed`: the failure notice of the
  last turn, or null.
- `history`: the aside's conversation as shown in the panel, each `{kind, text, reply,
  model, at, graph}`; `control` entries are kept but not shown.
- `outcome`: `null`, `done` or `changed`. `sent_line`: the line sent on `changed`.
- `/chat` returns the asides (all fields but `history`) so the page can underline and
  list them.

### 4. How an aside runs (machine `service.js`, hub)

An aside is not a session. Each message Collin sends it is **one headless CLI turn**: the
machine runs the CLI once in print mode, it answers, and the process exits. There is no
tmux window, readiness screen, session token, session queue or stop. That is why an
aside can't post cards, start sessions or use git: it has no token for the routes that do
those things (`machine/service.js:837-859`), and nothing about it is in `thread.sessions`,
so the main chat, the queued count and the app's session notices never see it.

- **Machine route** `POST /v1/aside-turns` (hub auth), modelled on `preview`
  (`machine/service.js:749-770`): input `{turn_id, provider, account_dir, cwd, model,
  effort, mode: "fork" | "resume", from, new_id, prompt}`. It starts the process and answers
  202 at once. The POST is idempotent on `turn_id`: a second POST with an id the machine
  already knows returns that turn's state and starts nothing. `GET /v1/aside-turns/:turn_id` returns `{state: "running" | "ok" |
  "failed", reply, conversation_id, error, limit}`. `DELETE` kills a running turn. A turn
  still running after 15 minutes is killed and reported `failed` ("took too long"). The
  machine writes each turn to its state directory (beside `sessions.json`) when it accepts
  the POST, before spawning, and keeps it until the hub acknowledges the result (at most 30 days, see Accepted Risks)
  (`POST /v1/aside-turns/:turn_id/ack`, sent after the hub has saved it), so a 404 means
  the machine never accepted that `turn_id`. The CLI is spawned in its own process group,
  and the turn records its pid and process start time. The service runs with
  `KillMode=process` (`install.sh:336`), so children outlive a service restart: on start,
  for each turn still `running`, the machine kills that process group if the pid still
  belongs to the same process (start time matches), confirms it is gone, and only then
  marks the turn `failed` ("the machine restarted").
- **Commands.** Environment: the account's login environment (`adapters.*.loginEnv`) and
  `WHEELCHAIR_LANE=1`, nothing else of ours. Working directory: the thread's worktree.
  - Claude: `claude -p --output-format json --model <model> [--effort <e>]
    --permission-mode dontAsk --tools Read,Grep,Glob --strict-mcp-config
    --append-system-prompt <aside prompt>` (`--tools` limits which built-in tools exist at
    all, and `--strict-mcp-config` with no `--mcp-config` loads no MCP servers, so no
    permission grant from any settings file, such as the wording script's, can reach a
    writing tool), plus `--resume <from> --fork-session --session-id <new_id>` (fork) or
    `--resume <from>` (resume). The prompt goes on stdin. `reply` is the JSON's `result`;
    `conversation_id` is `new_id` (fork) or `from`.
  - Codex: `codex exec fork <from> -` (fork) or `codex exec resume <from> -` (resume), with
    `-s read-only --json -m <model>`, one `-c mcp_servers.<name>.enabled=false` for every server `codex mcp list --json` lists
    under that account's environment (an empty table doesn't disable configured servers) and the effort config
    as today. The prompt goes on
    stdin, preceded on a fork by `<aside prompt>\n\n`. `reply` is the last agent message
    and `conversation_id` the thread id, both from the `--json` events.
  - `limit` is true when the CLI reports a usage limit (Claude's `rate_limit` error, Codex's
    `rate_limit_reached_type`), so the panel can say so.
- **Aside prompt** `protocol/app/aside.md` (new): the role file the `--append-system-prompt`
  and Codex preamble point at ("Read `<root>/protocol/app/aside.md` …"). It says:
  - You are an aside, not the lead. Your history is a copy of the lead's conversation;
    instructions in it addressed to the lead don't apply. You can read files; you can't
    change anything, and you post no cards.
  - Each message starts with a header `[wc:aside <kind>]`. `start` messages quote the words
    Collin highlighted and name the action. Answer in Collin's writing style, from the
    copied history.
  - `simpler`: restate the quoted words more plainly and shorter, no new terms.
  - `draw`: one sentence saying what the graph shows, then the graph's JSON (the schema in
    `<root>/protocol/graphs.md`) in one fenced block with info string `wc-graph`. No files.
  - Step up: only when the header says `slot=standard`, and the question clearly needs
    deeper reasoning: reply with only `[wc:step-up] <one line why>`. Never for a `control`
    message, never on `slot=heavy`.
  - `control` "Write the one line for the main thread.": reply with only that line: what
    Collin now wants the main thread to know, in his voice, one sentence.
- **Prompts the hub sends.** Every header carries the slot the turn runs on, `slot=standard`
  or `slot=heavy`, after the kind. `start`: `[wc:aside start <action>]\n\n> <quote>\n\n<Collin's
  text, if any>`. `ask`: `[wc:aside ask]\n\n<text>`. `control`: `[wc:aside control]\n\n
  Write the one line for the main thread.`
- **Provider, account, model.** From the latest live lead: its provider and account
  (Decision 13), bypassing the balancer. Model from `codex/model.sh <provider> <slot>`,
  `slot` starting at `standard` (`heavy` for `draw`). A slot set to "Not used" (`model.sh`
  exits 3) is skipped: with `standard` not used the aside starts on `heavy`; with `heavy`
  not used it stays on `standard` and can't move up. With neither, creating the aside
  returns 409 "asides need a Standard or Heavy model for <provider> in Settings". No live
  lead, or a lead whose conversation id isn't known yet: 409 "the lead isn't ready yet".
  Either message shows in the panel.
- **Conversation ids reach the hub.** The hub copies the lead's `cli_session_id` and
  `codex_thread_id` into its session record from the machine's `/v1/sessions` listing
  (already polled, `viewer/app/sessions.js:445-460`) and from turn-ended events. The machine
  includes `codex_thread_id` in each listed session (add it if absent).

### 5. Running turns (hub)

One rule, run after every change to an aside and on each poll:

- If the thread isn't archived, no `turn` is running and `pending` isn't empty and `failed`
  is null, the hub moves the first `pending` message into `turn: {id: <new uuid>, state:
  "dispatching", message}` on the record, saves it, and only then POSTs it. If the POST's answer is lost or the
  hub restarts, the hub re-POSTs the same `turn_id` on its next pass (the machine never
  starts it twice); a 404 on a `dispatching` turn means it never started, so it is POSTed
  again. The turn is started with `mode: "resume", from: cli_id` when `cli_id`
  is set, else `mode: "fork", from: fork_parent, new_id: <new uuid>`. So the aside always
  copies the lead's conversation as it was opened from, even if a new lead has taken over
  since.
- The hub polls `GET /v1/aside-turns/:turn_id` every 2 seconds while a turn runs.
- **ok**: `turn.message` goes into `history` with its reply and `turn` clears; `cli_id` is
  set if empty; then the reply is handled:
  - `[wc:step-up] <why>` on a `start` or `ask` message, with `slot` `standard` and `heavy`
    usable, and the aside `open`: `history` gets the line "Thinking harder: <why>", `slot`
    becomes `heavy`, and the same message goes back to the front of `pending`. Otherwise the
    marker isn't followed: if `heavy` isn't usable, `history` gets "Can't think harder: the
    stronger model is off in Settings"; then (and in every other ineligible case) the same
    message is run once more with the line "Answer now; stepping up isn't available." added.
    A second marker makes the turn `failed` ("The aside couldn't answer"). For a `control`
    message the marker is dropped and any remaining text is the draft.
  - A `wc-graph` block: saved as in §6.
  - A `control` reply: the draft line in the panel's edit box (§7).
- **failed**: `turn.message` goes back to the front of `pending` and `turn` clears, and `failed` holds the notice ("Hit the
  usage limit", "took too long", the CLI's last error line). Nothing runs until Collin
  presses Retry, which clears `failed`. So Retry always repeats the message that failed.
- **Closing** (`status: closed`) clears `pending` and `failed`; a running turn is left to
  finish and its reply goes into `history`. A turn that fails after closing adds its notice
  to `history` (with `turn.message`, so the question isn't lost) and sets nothing else. A closed aside never starts a turn.
- **Reopening**: Collin types in a closed aside: `status: open`, the message goes into
  `pending`, and the rule above runs it.
- **Think harder** is enabled when the aside is `open`, `slot` is `standard`, `heavy` is
  usable, no turn is running, `failed` is null and `history` holds at least one `start` or `ask` entry. It sets `slot: heavy` and puts the last `start` or `ask`
  message in `history` back into `pending`.
- **Archiving** the thread closes every aside (as above) and `DELETE`s any running turn
  before the worktree goes. After that every aside route that changes something (create,
  messages, close, retry, Think harder) returns 409 "this thread is archived"; `GET` of an
  aside still works, so the panel shows its history read-only.

### 6. Saving a drawn graph (hub)

When a reply holds a `wc-graph` block, the hub registers
`<cache-root>/<repo-key>/asides/<aside id>-<n>.json` (`n` the reply's index in `history`) the way a `diagram` card is registered
(`hub.registerGraph`, as in `viewer/app/cards.js:50-55`), creates its parent directory
(`fs.mkdir`, recursive; the hub runs inside the viewer server, `viewer/server.js:2213`), and
saves the JSON through the
viewer's own validated graph write, never by writing the file directly. Only after the save
succeeds does that `history` entry get `graph: <path>`. A refused graph puts "Couldn't draw
that: <reason>" in the entry instead. Each drawing stays with the reply that made it. The
block itself is not shown as text. Registrations expire (`viewer/server.js:1216-1223`), so
each time the hub serves an aside record it registers that aside's graph paths again.

### 7. The panel

- Desktop: a right-hand panel beside the chat, replacing the files column while open (the
  files list returns on close). Phone (≤899px): a full-screen sheet over the thread with a
  back control (Decision 6).
- Top: "Aside <number>", a close control, the quote, and the **waiting-on line**: the
  oldest card still waiting on Collin, by the "Needs you" rule (`viewer/app/views.js:96-107`:
  an unanswered `question`, `needs` or `approval` card). It reads "Waiting on: <the card's
  title or question, shortened>" ("Start building" for an approval) and links to that card.
  With none: "The lead is working" if the lead's last turn hasn't ended, else "Nothing is
  waiting on you".
- Body: `history` except `control` entries: Collin's text (for `start`, only what he typed,
  since the quote is at the top), then the reply rendered with the main chat's Markdown
  renderer; "Thinking…" while a turn runs; the `failed` notice with Retry; each entry's graph, once
  set, embedded like a `diagram` card (`viewer/pages/thread.js:161-165`).
- Input: "Ask more about this" and Send: `POST /threads/:id/asides/:aside/messages`, which
  adds an `ask` message to `pending` (and reopens a closed aside).
- Footer: **Think harder** (when §5 allows it), **Done, back to …** and **This changes my
  answer**. "…" is a short name for the waiting-on card ("Done, back to your question",
  "Done, back to Start building"), or "the thread".
- The page polls `GET /threads/:id/asides/:aside` (the full record) every 2 seconds while
  the panel is open.

### 8. Finishing

- **Done, back to …**: `POST .../asides/:aside/close {outcome: "done"}`: closed as in §5.
  The page closes the panel and scrolls to the waiting-on card, or keeps its scroll
  position when nothing is waiting.
- **This changes my answer**: enabled when the aside is `open`, `cli_id` is set, no turn
  is running and `failed` is null. It adds a `control` message to `pending`; its reply fills an editable box in
  the panel with Send and Cancel. Send: `POST .../close {outcome: "changed", line}`. The hub
  enqueues to the latest live lead, as `collin`, `<line>\n\n(from aside <number> on:
  "<quote, cut to 80 chars>")`, so it shows in the main thread as Collin's message, then
  closes the aside. The page turns a trailing "(from aside <n> on: …)" in a human item into
  a link opening aside `<n>`. Cancel leaves the aside open.
- The lead treats that message like any typed message: if a `question` card is open, it is
  his typed answer to it (`protocol/app/lead.md`, resolve rule). Add one line to `lead.md`'s
  "How you talk to Collin": a message ending "(from aside <n> on: …)" is his own answer,
  reached in a side conversation.
- An aside stays open until Collin finishes it; there is no idle timeout (nothing runs
  between turns). Closing the panel without Done or the browser tab leaves it open.

### 9. Underlines and reopening

- After each `renderChat` rebuild, the page re-applies every aside's anchor: it wraps the
  range (splitting across nested Markdown nodes) in `<mark class="aside-mark"
  data-aside="<id>">`. Placement follows Decision 12; an unanchored aside has no underline
  but is still listed.
- Clicking an underline opens that aside's panel, open or closed. A closed aside shows its
  history; typing reopens it (§5).
- The thread header shows "N asides" (the design's count chip) when there are any; it opens
  a short list (number, quote, when, outcome) and each entry opens its panel.
- Overlapping underlines: the newer aside's mark wins the overlap; both stay listed.

### 10. Proving the commands (implementation task T1, before anything else)

A probe script `machine/test/aside-probe.sh`, run by hand against real CLIs (it costs real
turns, so it is not part of `machine/test/run.sh`). For each logged-in CLI: start an
interactive conversation as the app starts a lead, tell it a code word, then run §4's fork
command and a resume of the fork, and check:
- the fork knows the code word, and the resume knows the fork's earlier answer;
- the parent conversation's transcript is unchanged by both;
- forking works while the parent's interactive session is still open;
- the reply and conversation id come out of the output as §4 says;
- Claude: `--append-system-prompt` and `--tools` apply; with a settings file that grants
  Bash and Write, a write attempt still fails because the tool doesn't exist;
- Claude: with an MCP server configured in user settings and its tools granted, none of its
  tools is available;
- Codex: the read-only sandbox refuses a write, and with a configured MCP server, the
  disabling flags leave none of its tools available.

Findings go to `docs/plans/thread-asides/reports/T1.md`. If a check fails for a CLI, T1 is
reported blocked and the build stops for that provider's asides; the lead takes it to
Collin.

### Non-goals

- The free-text answer box on question cards; Settings rows for asides; asides on cards,
  on Collin's messages or on other sessions; an aside posting into the main thread anything
  but the one line Collin sends; feeding later lead turns into an aside after its first
  turn; tool steps in the panel; counting aside turns in the Usage screens.

### Edge cases

- The lead restarts: asides keep using their own `cli_id`, and one with no `cli_id` yet
  forks `fork_parent`. Anchors on the old lead's messages still resolve, because ids carry
  the session name.
- The lead is mid-turn when an aside's first turn forks it: the fork copies what the lead
  has saved so far.
- Two asides at once: separate records and turns; `hub.withThread` serialises record
  writes.
- A `draw` whose reply has no `wc-graph` block: the reply shows as text.

### Validation

```bash
node --test viewer/test/*.test.js     # new, with a fake machine: message ids stable across
                                      # polls; 409s for no ready lead and no usable model;
                                      # first turn forks fork_parent, later turns resume
                                      # cli_id; a failed turn waits for Retry and repeats the
                                      # same message; step-up re-runs the same message on
                                      # heavy, never for control; closing mid-turn keeps the
                                      # reply and starts nothing more; reopen runs the typed
                                      # message only; close with "changed" enqueues the line
                                      # to the lead as collin; wc-graph saved and registered
bash machine/test/run.sh              # new, with fake CLIs: fork and resume argv for both
                                      # CLIs; reply and id parsing; timeout; duplicate POST
                                      # starts nothing; on restart a running turn's process
                                      # group is killed before it is marked failed; acked
                                      # turns are dropped
npm --prefix viewer run test:browser  # new: selection bar for a selection in one lead bubble
                                      # and not across bubbles; panel with quote and
                                      # waiting-on line; underline survives a chat rebuild;
                                      # reopen from underline; phone-width sheet; the
                                      # "(from aside n on: …)" link
bash machine/test/aside-probe.sh      # T1, by hand, real CLIs
```

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| The machine keeps unacknowledged aside turns for 30 days, then drops them; a hub gone that long could re-run one turn after a 404 | A hub down for a month has bigger problems; the cost is one repeated answer | 8 |

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
| intent (gpt) | major | An `ask` aside forks only when Collin types, so a lead restart in between loses context | upheld | §6: every aside forks at once, and reforks use `fork_parent` |
| intent (gpt) | major | Retry resends the last successful question, not the one that failed | upheld | §6 "A failed turn": the failed message stays first in `pending`; Retry delivers it |
| intent (gpt) | major | A step-up reply to the summary request abandons the handoff | upheld | §4 role prompt: never step up on it; §6 step-up excludes `control`; edge case keeps the draft |
| mechanics (gpt) | major | Step-up replays the previous question, or nothing on a first turn | upheld | Superseded by Decision 16; §5 re-runs the same message |
| mechanics (gpt) | major | Failed turns have no transition for `inflight` | upheld | §5: the message stays first in `pending` with `failed` until Retry |
| mechanics (gpt) | major | A crash during a deferred stop is never recovered | upheld | Decision 16: no stops exist |
| mechanics (gpt) | major | Reopening during a step-up stop reuses the standard process | upheld | Decision 16: each turn picks its model at start |
| mechanics (gpt) | major | A fresh refork loses the panel's display boundary | upheld | Decision 16: the panel shows the record's `history`, not a transcript |
| mechanics (gpt) | major | Codex startup has two delivery owners | upheld | Decision 16: no interactive startup |
| mechanics (gpt) | major | The rate-limit "Continue." path bypasses the aside lifecycle | upheld | Decision 16: asides aren't sessions; a limit is a failed turn with Retry |

Round 5 verdict: the long-lived session design was the source of every lifecycle finding since round 2. Replaced by headless one-shot turns (Decision 16); §3-§10 rewritten.

### Round 6 — 2026-11-15

**Lanes:** intent: pending; mechanics: pending.

**Changed since Round 5:** the Spec from §3 on is rewritten. An aside is no longer a session: each message is one headless CLI turn (fork, then resume) run by a new machine route (§4), driven by one hub rule (§5); the panel shows the record's `history` (§7). Decisions 16 and 17. Everything in §3-§10 is in scope in depth.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent (gpt) | minor | The 30-minute idle close is pointless with headless turns and blocks "This changes my answer" | upheld | §8: no idle timeout |
| intent (gpt) | minor | A later drawing replaces earlier ones | upheld | §6: one graph per reply, kept on its `history` entry |
| mechanics (gpt) | blocking | The first typed message's kind is contradictory, so a fork could miss the quote | upheld | §2: the first message is always `start` |
| mechanics (gpt) | blocking | `--allowedTools` grants rather than restricts, so inherited grants could allow writes | upheld | Checked `claude --help` (`--tools` limits the set); §4 uses `--tools`; T1 tests with a granting settings file |
| mechanics (gpt) | major | Closing after a failure leaves `failed` set, so Retry runs the wrong message | upheld | §5: closing clears `failed`; late failures only add a notice |
| mechanics (gpt) | major | Think harder enabled with nothing to replay | upheld | §5: needs a `start` or `ask` entry |
| mechanics (gpt) | major | Lost POST or hub restart can strand or double a turn | upheld | §4/§5: `turn` saved before POST; POST idempotent on `turn_id` |
| mechanics (gpt) | major | Archive doesn't stop asides | upheld | §5: archive closes all, kills turns, routes return 409 |
| mechanics (gpt) | major | The aside can't know its slot; ineligible markers lose the answer | upheld | §4: slot in every header; §5: one re-run without step-up, then failed |
| mechanics (gpt) | major | Graph parent directory never created | upheld | §6: hub creates it before saving |
| mechanics (gpt) | major | Graph registrations expire | upheld | Checked `viewer/server.js:1216-1223`; §6: re-registered whenever the record is served |

### Round 7 — 2026-11-15

Collin chose "Keep going" again; the budget is reset.

**Lanes:** intent: pending; mechanics: pending.

**Changed since Round 6:**
- §2: the first message typed into an aside is always `start`.
- §4: Claude limited with `--tools`; POST idempotent on `turn_id`; slot in every prompt header; step-up only on `slot=standard`.
- §5: `turn` saved before dispatch and re-POSTed after a lost answer; ineligible step-up re-runs once then fails; closing clears `failed`; Think harder needs history; archive closes asides and refuses routes.
- §6: one graph per reply, parent directory created, registration refreshed when served.
- §8: no idle timeout.
- §10: the probe tests `--tools` against a granting settings file.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent (gpt) | major | Archive refuses the history GET, so archived asides can't be read | upheld | §5: only changing routes are refused; GET still works |
| mechanics (gpt) | major | Closing a running turn loses its message | upheld | §3/§5: the message lives in `turn` while it runs |
| mechanics (gpt) | major | A 404 after a machine restart doesn't prove the turn never ran | upheld | §4: turns persisted on accept; running ones failed on machine start; 404 means never accepted |
| mechanics (gpt) | major | Archived history can't be loaded | upheld | Same as the intent finding, already fixed |
| mechanics (gpt) | major | RE-RAISE: MCP tools escape `--tools` | upheld | Checked `claude --help` (`--strict-mcp-config`); §4 adds it, Codex gets `mcp_servers={}`; T1 tests both |

### Round 8 — 2026-11-15

**Lanes:** intent: pending; mechanics: pending.

**Changed since Round 7:**
- §5: archive refuses only changing routes; GET still works.
- §3/§5: a running turn holds its message (`turn.message`).
- §4: machine persists turns on accept; restart fails running ones; 404 means never accepted.
- §4: no MCP tools for either CLI (`--strict-mcp-config`, `mcp_servers={}`); §10 tests it.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent (gpt) | — | No findings | — | — |
| mechanics (gpt) | major | RE-RAISE: `mcp_servers={}` doesn't disable Codex MCP servers | upheld | Reviewer ran `codex mcp list` with it; §4 disables each listed server |
| mechanics (gpt) | major | RE-RAISE: 24-hour retention breaks "404 means never accepted" | upheld | §4: kept until the hub acknowledges; 30-day cap is an Accepted Risk |
| mechanics (gpt) | major | Orphaned CLI processes survive a service restart | upheld | Checked `install.sh:336` (`KillMode=process`); §4 kills the process group before failing the turn |
| mechanics (gpt) | major | RE-RAISE: the first-message test misses the running message | upheld | §2 includes `turn.message` |
| mechanics (gpt) | major | Think harder and the summary are enabled while a failure waits for Retry | upheld | §5/§8: both need `failed` null |

### Round 9 — 2026-11-15

**Lanes:** intent: pending; mechanics: pending.

**Changed since Round 8:**
- §2: the first-message test includes the running message.
- §4: Codex MCP servers disabled one by one; turns kept until acknowledged; orphaned processes killed on machine start.
- §5/§8: Think harder and This changes my answer need no pending failure.
- Accepted Risks: 30-day cap on unacknowledged turns.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
