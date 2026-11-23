---
slug: personal-assistant
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-23
---

# A personal assistant across all projects

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

**Map:** `MAP.md` and `docs/maps/personal-assistant-runtime.md`.

## Open Questions

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Plan mode is two-part. | Collin picked it. | user |
| 2 | The assistant acts for Collin, based on what Collin tells it to do. | Collin's answer to "act or only report". | user |
| 3 | Collin talks to it in a special pinned thread and a pop-up; both are the same conversation. | Collin's answer. | user |
| 4 | A per-project lead thread is split into its own follow-up thread (depends on this one). | Collin picked "Its own thread". | user |
| 5 | The assistant sees and acts across every machine the hub knows, not only one machine. | "All projects" means all; the hub already holds every thread record (MAP.md). | defaulted |
| 6 | Collin's instruction is the consent: the assistant needs no reach approval to message a lead in any project. The per-thread message limit still applies. | A reach card per project would defeat the point; the limit still guards against loops. | defaulted |
| 7 | The assistant runs on the hub machine on the lead model from Settings, in its own working folder outside any project. It never edits project code; work goes into threads. | Keeps it out of project worktrees; leads own code changes. | defaulted |
| 8 | Leads' questions stay in their own threads and under Needs you, as today; the assistant mentions them in its summaries. | Nothing changes for anyone not using the assistant (IDEA Constraints). | defaulted |
| 9 | When Collin's instruction leaves the project or machine unclear, the assistant asks in its chat before starting anything. | Avoids starting work in the wrong place. | defaulted |
| 10 | The assistant thread is never archived or listed under a project; it restarts like a lead, rebuilding its picture of all threads from the hub. | It is permanent and project-free. | defaulted |
| 11 | When told to, the assistant may do anything Collin can do with threads: start threads, message leads, answer leads' question cards, press Start building, restart leads, and archive threads. | Collin picked "Anything I can do". | user |
| 12 | Whatever the assistant does in a thread is visible there and marked as done by the assistant (its messages to a lead show as a bubble "From your assistant"; its card presses say "by your assistant"). | Collin must be able to see why a lead acted, without the assistant reporting it. | defaulted |
| 13 | The assistant acts on threads and projects only; changing Settings (models, accounts, project tools, auto-merge) is deferred to the follow-up. | Collin picked "Threads only, for now". | user |
| 14 | The assistant speaks only when Collin writes to it; telling Collin about changes on its own is deferred. | Collin picked "Later, not now". | user |
| 15 | Mockups agreed: mockup-threads, mockup-thread, mockup-popup, mockup-closed and mockup-thinking, each in -phone (390x844) and -desktop (1280x800) files under graphs/ (first and only version, commit face0aff). | Collin picked "Agree them". | user |
| 16 | The assistant is opt-in: a switch in Settings, off by default. While off there is no pinned thread, no pop-up and no assistant session. Turning it off later stops its session and hides both; its conversation is kept for when it is turned back on. | Collin: "the assistant will be an opt in, we won't force all users to have it" (new IDEA constraint). How it is switched on is defaulted. | user |

## Spec

The assistant is one extra thread, owned by the hub and tied to no project, whose lead runs
with the assistant's own rules (`protocol/app/assistant.md`) and may call a new set of
hub actions (`wc.js assistant ...`) that reach every thread on every machine. Collin talks
to it in a pinned row at the top of the Threads list and in a pop-up on every app page.
Everything else (project threads, leads, review, building) is unchanged.

### Mockups

Agreed (Decision 15). All under `docs/plans/personal-assistant/graphs/`; each `-phone` file is
390x844 and each `-desktop` file 1280x800 (the two files of a pair have the same HTML, which
responds to width).

| File pair | Screen / state |
|---|---|
| `mockup-threads-{phone,desktop}.html` | Threads list with the assistant row pinned above the projects, showing "needs you" and a last-message preview |
| `mockup-thread-{phone,desktop}.html` | The assistant thread page: a status summary grouped by project, and a "started a thread" reply with a link |
| `mockup-popup-{phone,desktop}.html` | Pop-up open over another page: near full-screen sheet on phone, side panel on desktop |
| `mockup-closed-{phone,desktop}.html` | Pop-up closed: floating button with an unread dot |
| `mockup-thinking-{phone,desktop}.html` | Pop-up while the assistant is working ("thinking…") |

### 1. Switching it on and off (opt-in)

- New setting `assistant` (`"off"` | `"on"`), default `"off"`, in the settings defaults
  (`viewer/app/settings.js`) and validated like the other two-value settings. Settings shows
  it as a "Personal assistant" on/off control with one line: "An assistant that sees all
  your threads and acts on what you tell it."
- **Turning on**: if no assistant thread record exists, the hub creates one (section 2) and
  starts its lead. If one exists, the hub starts a lead for it the way Restart does
  (`threads.restartLead`, which carries recent messages and cards), unless a live one exists.
- **Turning off**: the hub stops every live session of the assistant thread and keeps the
  record. While off: the Threads list shows no assistant row, no page shows the pop-up
  button, `GET`/`POST` routes for the assistant thread answer 404 "the assistant is off",
  and every `wc.js assistant` action is refused with "the assistant is off".
- A fresh install, or an existing install after updating, starts with it off and shows
  nothing new except the Settings control.

### 2. The assistant thread

- A thread record created with `emptyThread` plus `assistant: true`, `project: null`,
  `title: "Personal assistant"`, and `machine` set to the machine the hub itself runs on
  (the local machine entry the hub already uses for its own machine). There is at most one
  record with `assistant: true`; creating it is idempotent.
- It is never archived (the archive route and action refuse it with "the assistant can't be
  archived"), never handed off or exported, is not a stub, and has no branch, plan or pull
  request.
- **Its folder**: its lead runs in a plain folder `<machine state dir>/assistant` (not a git
  worktree). The hub's lead start passes `assistant: true` instead of `project_dir`; the
  machine service, on a start with `assistant: true` and no `worktree`, creates that folder
  if missing (`mkdir -p`) and uses it as the worktree, with no branch. Every hub path that
  reads `thread.project` for a lead start or account switch (`viewer/app/sessions.js:377-378`,
  `:645` today) handles the assistant thread without throwing (no `project`/`project_dir`
  sent for it).
- **Its lead**: the session's role is `lead` (so chat delivery, queues, restart, quiet
  notices, account switches and model placement work as for any thread), on the lead model
  from Settings. The start tells the machine `prompt_role: "assistant"`; the machine then
  builds the prompt from `protocol/app/assistant.md`, `cards.md` and `cards-lead.md`
  instead of `lead.md`, with the same hub role layers a lead gets (user name, writing
  style, lead templates and lessons). No other role may be started in the assistant thread:
  `session start` from its lead is refused with "the assistant starts threads, not helpers".
- **Lists**: it is left out of project grouping, the features page, `session leads` results
  for other leads, overlap checks and the auto-merge and PR pollers. Its open `question` and
  `needs` cards count under Needs you like any thread's.
- **Thread page**: `/thread/<assistant id>` works as for any thread (chat, cards, composer,
  Restart when no lead is live), with title "Personal assistant", no project, branch, plan,
  PR, Agents-tree or archive controls (`mockup-thread-*`).

### 3. What the assistant can see and do: `wc.js assistant`

A new command group `node <root>/viewer/app/wc.js assistant <action> ...`, carried like
`wc.js session` (wc.js, then the machine service's agent endpoint, then a hub route, then a
hub function). The hub accepts it only when the calling session is the live lead of the
assistant thread and the setting is on; anyone else gets 403 "only the personal assistant
may do that". Every action prints one JSON line; failures exit 0 with `{"ok":false,"error"}`
as `wc.js git` does, except "hub unavailable", which follows the existing retry rule.

| Action | What it does |
|---|---|
| `projects` | Every project the hub knows, with its machines: `{projects:[{path,name,machines:[...]}]}` |
| `threads [--archived]` | Every non-archived thread on every machine except the assistant thread (with `--archived`, archived ones too): `id, title, project, machine, stage, plan_status, progress (last progress card fields), lead_live, pr_url, updated_at, waiting` where `waiting` lists open `question`/`needs`/`approval`/`check`/`reach`/`sudo` cards as `{id, kind, text}` (`text` is the question, title or first line) |
| `thread <id>` | Same fields plus `cards` (every open card in full) and `recent` (the last 30 chat items: the user's bubbles, lead replies and context lines, as the thread page shows them) |
| `start --project <path> --machine <name> --message-file <f> [--title <t>]` | Creates a thread exactly as the browser's `POST /threads` does (same project check), with the file's text as its first user message prefixed as in section 4. Prints `{ok, thread, url}` |
| `message <thread> --text-file <f>` | Queues the text for that thread's latest live lead, prefixed as in section 4. Refused with "that thread has no live lead; restart it first" when none is live, and for archived threads. Counts toward the existing 20-messages-per-thread-per-hour limit, keyed on the assistant thread |
| `press <thread> <card> --action <action> [--value <text>]` | Presses a card button exactly as the browser route does (`hub.press`, same checks and refusals), recording `answered_by: "assistant"` on the card |
| `restart <thread>` | As the browser's Restart (`hub.restartLead`) |
| `archive <thread>` | As the browser's Archive (`hub.archive`) |

`<thread>` is a thread id. The assistant thread itself is refused as a target of every
action.

### 4. Everything it does shows where it happened

- A message it sends to a lead, and a new thread's first message, are delivered to that lead
  as `[wc:assistant] <text>`. In the transcript renderer (`connectors/hub-common.js`
  `renderTurn`) such a turn becomes a visible human bubble labelled "From your assistant",
  and the lead's reply is shown, as for the user's own words.
- A press it makes is delivered to the lead as the usual `[card <id>] ...` text, and the
  bubble reads "Your assistant: <the usual short text>" (e.g. "Your assistant: Picked B").
  The answered card shows "by your assistant". The card gets `answered_by: "assistant"`; a
  press by Collin leaves the field absent.
- Restart and archive look as they do today.

### 5. The pop-up

- `viewer/pages/nav.js` (loaded on every app page) adds a floating round button at the
  bottom right when the setting is on, on every page except the assistant thread page
  itself (`mockup-closed-*`). Pages that do not load `nav.js` today do not get it.
- Tapping it opens a panel showing the assistant conversation (same chat items and cards as
  the thread page, read from the same chat route, polled the same way) and a text box that
  posts to the same messages route. Width under 900px: a sheet covering nearly the whole
  screen with a close control; 900px and over: a panel on the right side of the window
  (`mockup-popup-*`). A link opens the full assistant thread page.
- While the assistant's lead is mid-turn the panel shows "thinking…" (`mockup-thinking-*`),
  using the same busy signal the thread page uses.
- **Unread dot**: shown on the closed button when the conversation has an item newer than
  the last one seen in the pop-up or on the assistant thread page, tracked per browser in
  `localStorage`.
- When the assistant has no live lead the panel says "The assistant isn't running" with
  the Restart action.

### 6. The pinned row

`viewer/pages/threads.js` renders the assistant thread as the first row of the list, above
every project group and outside any group, when the setting is on: title "Personal
assistant", a one-line preview of its latest reply, and its Needs you count
(`mockup-threads-*`). It cannot be archived from the list.

### 7. The assistant's rules: `protocol/app/assistant.md`

A new role file, with these rules:
- It acts for Collin on what Collin tells it, using only `wc.js assistant`, `card.js` and
  read-only commands. It never edits files in any project and never runs git writes.
- For "where do things stand?" it calls `threads` (and `thread` for detail) and answers
  grouped by project, naming what is waiting on Collin first, each with a link
  `/wheelchair/thread/<id>`.
- To start work it needs a project and machine; when Collin's words leave either unclear,
  it asks in its chat (a `question` card when there are options) before acting.
- When Collin asks it to do something to a thread, it does it with the matching action and
  replies with what it did and a link. It does not act beyond what Collin asked, and does
  not answer a lead's question unless Collin told it the answer.
- It does not change Settings (Deferred 1) and speaks only in reply to Collin (Deferred 2).
- Card kinds it may post: `title`, `question`, `needs`, `resolve`, `retract`, `file`,
  `image`, `diagram` (the hub's existing lead permissions; it has no plan, so
  `offer`, `idea`, `deferred`, `approval`, `progress`, `done`, `check`, `stub`, `sudo` and
  `reach` are refused for the assistant thread with "the assistant doesn't post <kind>").
- `lead.md` gains one line in its markers handling: a message starting `[wc:assistant]` is
  Collin's instruction passed on by the assistant; treat it as Collin's own words. `cards.md`'s
  marker table gains the row.

### Boundaries and non-goals

- No change for anyone with the setting off (Constraint in IDEA.md).
- No Settings changes by the assistant, no unprompted updates (Deferred).
- No per-project lead (its own thread).
- The assistant does not see aside conversations or agent terminals.

### Validation

New tests, all in the existing suites:
- `viewer/test/assistant.test.js`: setting default off; turning on creates exactly one
  assistant thread and starts its lead with `prompt_role: "assistant"` and no
  `project_dir`; turning off stops it, keeps the record, and the routes answer 404; archive
  refused; `wc.js assistant` actions refused for a normal lead (403) and when off; `threads`
  lists threads from two machines and excludes the assistant thread; `start` creates a
  thread with a `[wc:assistant]` first message; `message` refused with no live lead;
  `press` records `answered_by: "assistant"`; `session start` from the assistant refused;
  the assistant thread is absent from features, project groups and other leads'
  `session leads`.
- Transcript renderer test: a `[wc:assistant]` turn renders as a "From your assistant"
  bubble; an assistant press renders "Your assistant: …".
- `machine/test`: a start with `assistant: true` creates `<state>/assistant` and runs there
  with the assistant prompt files.
- Browser test (`viewer/test/browser`): with the setting on, the Threads list's first row is
  the assistant; the pop-up button shows on a project thread page and not on the assistant
  page; it opens as a sheet at 390px wide and a side panel at 1280px; sending text posts to
  the assistant thread. With the setting off, neither the row nor the button appears.

Commands:

```bash
node --test viewer/test/*.test.js
bash machine/test/run.sh
npm --prefix viewer run test:browser
```

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| 1 | The assistant changes Settings for Collin (models, accounts, project tools, auto-merge) | Settings changes are rare; threads are the everyday work | planning | Each Settings screen needs its own action for the assistant; reuse whatever action route this thread builds for thread actions |
| 2 | The assistant tells Collin on its own when a thread finishes, gets stuck or starts waiting on Collin | Needs you already flags what is waiting; ask-and-act comes first | planning | Needs a background trigger from hub thread events to the assistant session; mind model cost of waking it |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-23

**Lanes:** intent — claude / claude-opus-5-5; mechanics — gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
