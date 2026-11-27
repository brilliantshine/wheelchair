---
slug: new-thread-stubs
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-27
---

# Save an idea as a stub from the New thread screen

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

(none)

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode: thorough | Collin's pick | user |
| 2 | No designer: the visible change is one button and a hint on an existing form | Trivial visible part; follows the form's existing button style | defaulted |
| 3 | Saving a stub needs a non-empty message; the save button is disabled otherwise | An empty stub has nothing for its lead to start from | defaulted |
| 4 | The stub's title is the message's first line cut to 60 characters, as Start does; its context is the full message | Same naming as threads started now | defaulted |
| 5 | The stub has no parent, `depends_on_parent: false`, no commits; it opens straight away with the existing Open button | Nothing to wait on | defaulted |
| 6 | A parentless stub's transcript marker reads "Started from a saved idea" instead of "Started from parent thread"; parent-only text on its page is not shown | IDEA: nothing may claim another thread made it | defaulted |
| 7 | Other leads may add to it (`adds_to`) like any unopened stub | Same rules as other unopened stubs; additions are what stubs are for | defaulted |
| 8 | Button label "Save for later", beside Start; after saving, the browser goes to the stub's page | Plain words; the stub page already shows the context and Open | defaulted |
| 9 | A saved stub keeps attached files: they upload when it is saved and their `[attached: path]` lines join its saved context | Ideas parked from a phone often come with a screenshot | user |

## Spec

### S1. Hub: create a stub from the New thread screen
- `POST /threads` (`viewer/app/routes.js`, `handleThreads`) accepts `stub: true`. `createThread` (`viewer/app/threads.js:60`) then does everything it does today (project check on the machine, save, `addProject`) **except start a lead or queue a message**.
- With `stub: true`, `message` must be a string that is non-empty after trimming; otherwise 400 `a stub needs a message`. `title` is ignored for stubs.
- The saved thread has `stub: true`, `title` = first line of the message cut to 60 characters (same `truncateTitle` call as today), `context` = the full trimmed message, `parent: null`, no `parent_title`, `depends_on_parent: false`, `commits: []`, `sessions: []`. Response 201 with the thread, as today.
- Without `stub: true`, `POST /threads` behaves exactly as today.

### S2. Hub: files for an unopened stub
- An **unopened stub** is a thread with `stub: true`, no sessions, not archived, not frozen (`handoff.refuseFrozen`).
- The upload route (`routes.js` `upload`, ~line 160) also accepts an unopened stub, not only a thread with a live lead. Other threads keep the current 409.
- New route `POST /threads/<id>/stub-attachments` with body `{ paths: [string, ...] }` (1 or more non-empty strings, else 400). Under `hub.withThread`, for an unopened stub only (else 409 `this thread is not an unopened stub`), it appends to `context` a blank line then one `[attached: <path>]` line per path, saves, and returns 200 with `{ context }`. Appending (not replacing) keeps any addition another lead made meanwhile.
- Opening the stub (`openStub`) is unchanged: its lead receives `[wc:context stub] <context>`, so the attached lines reach it like any `[attached: ...]` line in a user message.
- Archiving an unopened stub that has uploads removes or keeps them exactly as archiving any other thread does (no file left orphaned on the machine because the stub had no sessions or worktree).

### S3. New thread screen
- `viewer/pages/new.html`: a second button **Save for later** (`id="nt-save"`) in `.new-actions`, between Start and Import a handoff, with the existing button styling. Update the hint below the message to add one sentence: "Save for later keeps the message as a stub in the thread list; no agent starts until you open it."
- `viewer/pages/new.js`: Save for later is disabled whenever Start is disabled, and also when the trimmed message is empty, and while sending. It updates as the message is typed.
- Pressing it posts `/threads` with `{ project, machine, stub: true, message }`. With no attachments, on success the browser goes to `/wheelchair/app/thread?id=<id>`.
- With attachments: after the stub is created, upload each file with the existing upload loop, then post the collected paths to `/threads/<id>/stub-attachments`, then go to the stub's page. If an upload or that post fails, both buttons stay disabled (no second stub) and the error banner reads "The stub was saved, but the files were not added (<reason>). Attach them after opening it: " followed by an "Open the thread" link, like Start's banner.
- A failed create shows "Could not save the stub: <reason>" and re-enables the buttons.
- Start keeps its current behaviour.

### S4. Showing a parentless stub
- The transcript marker for `[wc:context stub]` (`connectors/hub-common.js:97`, and any other copy of this text such as `viewer/pages/thread.js` or `viewer/app/chat.js`) reads `Started from <parent_title>` when the thread has a parent, and `Started from a saved idea` when it has none (no `parent`). The "parent thread" fallback stays only for a thread that has a `parent` but no `parent_title`.
- The thread list and unopened-stub page need no other change: with no parent they show no parent link and no waiting text (`viewer/pages/thread.js:637`), and the Open and start button opens it. Confirm this in tests.
- These stubs appear in `session leads` as candidate stubs (`takes_additions: true`, `waits_on_parent: false`) and accept `adds_to` additions, like other unopened stubs; no change needed beyond confirming it in a test.

### S5. Protocol
- `protocol/app/cards.md`, the `[wc:context stub]` row: "with "Started from <parent thread>" in its place" becomes "with "Started from <parent thread>", or "Started from a saved idea" for a stub saved from the New thread screen, in its place".
- `protocol/app/lead.md`, the paragraph "If you are the lead of a stub…" (around line 926): add one sentence: "A stub saved from the New thread screen has no parent: its summary is Collin's own message, so treat it as their first message (step 1 applies, including the title card)." Write "the user" instead of a name, matching the file's style.

### S6. Tests
- `viewer/test/app-hub.test.js` (or a new `viewer/test/app-new-stub.test.js`): stub creation saves the fields in S1 and starts no session; empty or whitespace message gives 400; upload to an unopened stub is accepted and to an opened or archived one refused; `stub-attachments` appends lines, refuses non-stubs, opened stubs and bad bodies; opening the stub queues `[wc:context stub]` with message and attached lines; the stub is listed by `session leads` with `takes_additions: true` and accepts an `adds_to` addition.
- `viewer/test/app-chat.test.js`: the marker reads "Started from a saved idea" for a parentless stub and still names the parent for a child stub.
- `viewer/test/app-new-thread.spec.js`: Save for later disabled with empty message; saves and lands on the stub page showing the message and Open and start, with no lead started; with an attachment, uploads then posts `stub-attachments` before navigating; a failed upload shows the banner and leaves both buttons disabled.

### Validation
```bash
node --test viewer/test/app-hub.test.js viewer/test/app-chat.test.js viewer/test/app-new-thread.test.js viewer/test/app-uploads-archive.test.js viewer/test/app-lead-list.test.js
npm --prefix viewer run test:browser -- test/app-new-thread.spec.js test/app-threads.spec.js
node test-support/pick-tests.js --base <comparison commit>   # and run the commands it prints
```
(plus any new test file added under S6.)

### Non-goals
- Editing a stub's text after it is saved; changing stubs posted by leads; changing Start; the assistant creating stubs this way.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-27

**Lanes:** claude / opus (intent); gpt (mechanics); cross-family: yes.

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
