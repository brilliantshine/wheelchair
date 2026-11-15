# Remediation 3 — app-shell

Verification round 3 at commit d306315. Three verifiers: Opus (resumed), Sol (`gpt-6.1-sol`,
resumed thread `01a1dd51-d8d6-7942-9d49-0f7c06f2a8c3`) and a fresh Opus for the final round.
All three returned `VERDICT: FAIL`.

## Gaps, verbatim

### Opus (resumed)

```
GAP: Messages between sessions use the same queue; messages queued for a dead lead are delivered to the new one (remediation-2 regression) — a valid `result` or `message` card is refused and filed as rejected when delivery to its target fails, because the delivery now runs inside the card's transaction and rolls it back, so a target whose tmux died but which the hub hasn't marked ended gets no card and no queued message — `viewer/app/cards.js:71-79` (`hub.deliver(..., { save: false })` inside `updateThread`); demo6: worker `result` → `409 {"error":"tmux submit failed"}`, spool/rejected/cards gained the card, thread cards `[]`, sub-lead queue `[]`
```

### Sol (resumed)

```
GAP: Durable reviewer/verifier report delivery — failed submission persists finished=true and the queued report; retry then skips deliverReport, acknowledges the event, and leaves the idle starter’s queue undelivered — viewer/app/sessions.js:155,166,167,226,252; repeated HTTP reproduction: firstHTTP=503, retryHTTP=202, leadSubmits=[], pendingLeadQueue=1, verifierFinished=true, deliveryRecorded=true.
```

### Opus (fresh)

```
GAP: Lifecycle 6 / Views (approval card, Start building, Needs you strip) — pressing "Talk about this" marks the approval card answered, which permanently disables Start building on the page and drops the approval from Needs you, although the Spec says Start building is gated only by the Ready result and Needs you lists every approval whose Start building hasn't been pressed — `viewer/app/threads.js:219` sets `card.answered = true` for every press action; `viewer/pages/thread.js:258,328` disables Start building when answered; `viewer/app/views.js:98`; probe: needs before talk = [approval], after talk = [], `answered` true
GAP: Machine service — verifier worktree removed when the verifier stops — removal runs without `--force`, so a verifier that leaves untracked files keeps its worktree, and archive skips verifiers and then forgets the session, so it leaks permanently — `machine/service.js:383`, `:418`, `:456`; real-git check: `git worktree remove` on a worktree with an untracked file exits 128 "contains modified or untracked files"
GAP: Where the code lives — Routers: root AGENTS.md updated in the same change — the `viewer/` row and navigation note still describe the eight pre-app files (no `app/`, `pages/`, `vendor/`), and the Verification block omits `bash machine/test/run.sh` — `AGENTS.md:59`, `AGENTS.md:106-112`
GAP: What the thread shows — "the thread file still records every message the app types in, for the queue and for restarts" — delivered messages are removed from the queue and kept nowhere, and a restart's context carries only cards and pinned items — `viewer/app/sessions.js:203-207`, `viewer/app/threads.js:104-109`
```

## Lead triage

- **Both delivery gaps share one cause, and the cause is a brief defect.** Remediation 2's
  brief said to record a delivery id "only once the event has been fully applied", and the
  lane read "applied" as including the submit to the target. A queued message then became
  part of the operation that queued it. A dead target refused a valid card (Opus), and a
  report's retry found nothing left to do (Sol). The plan never says when a failed
  delivery is retried. This brief settles it: **a delivery failure never fails or undoes
  the operation that queued the message.** The message stays first in its queue, and a
  timer retries every queue. This is the Spec's queue as written, typed in when the target
  can take it.
- **Escalation.** Talking about this gap with the lane would mean starting from the wrong
  contract, so it goes to a fresh Terra at `xhigh` on a rewritten brief rather than a
  resume. The other four gaps are new and well-defined, so the same lane takes them.
- **The lead fixes the root router and the stale "Known gaps" lines in COMPLETION.md
  itself.** They are documentation only.
- **Not taken, as residual risks.** Each verifier raised these, and none counts as a gap:
  - an empty Enter in the terminal holds messages until a later turn ends;
  - a hub 500 on a relayed card can cause a duplicate after the agent resends;
  - permission-menu clearing has not been seen on a live run;
  - the 5-second hub-to-service timeout around a `git fetch`;
  - `projects.json` lists typed-in projects only.

  COMPLETION.md records them.

## Tasks

| Task | Owns | Lane | Gaps |
|---|---|---|---|
| R6 | `viewer/app/`, `machine/service.js` (verifier removal only), their tests | GPT / Terra, `xhigh`, fresh | delivery never undoes its operation plus a retry timer, Talk about this, verifier worktree removal, sent messages recorded |
| lead | `AGENTS.md`, `COMPLETION.md` | lead | root router, stale known gaps |

### R6 — delivery, approval press, verifier cleanup, sent log (GPT / Terra, xhigh)

Each item needs a test that fails before its fix. Use the real hub routes and the real
service wherever possible.

1. **A delivery failure never fails the operation that queued it.**
   - `sessions.deliver` catches a failed submit. The message stays first in the queue, the
     session stays not-busy, and the error goes on the session as `delivery_error` (text
     and time), cleared on the next successful submit. Then `deliver` returns `false`.
   - Callers (`enqueue`, `event`, `acceptCard`, `deliverReport`, the browser message
     route) never roll back or throw because of a delivery.
   - Undo remediation 2's in-transaction delivery in `viewer/app/cards.js`. The card and
     its queued message commit together, then delivery is tried after the commit.
   - Record a delivery id (event or card) in the same commit as the state change it
     belongs to.

   Tests:
   - A `result` card to a target whose submit fails is stored (202), its message queued,
     and nothing goes to `rejected/`.
   - Sol's case: a verifier's turn-end whose report submit to the idle lead fails returns
     202. The report sits in the lead's queue and is delivered by the retry below.
2. **Queues are retried.** Add a hub timer every 5 s, beside `pollDead` (`hub.js:43`),
   that runs `deliver` under `hub.withThread` for every live, ready, turn-ended,
   not-held session with a non-empty queue in every unarchived thread. It never throws.
   Test: after one failed submit, a later successful submit empties the queue, with the
   timer interval shortened through an option or an environment variable.
3. **"Talk about this" leaves the approval open.** In `viewer/app/threads.js:219`, a
   `talk` press on an `approval` card doesn't mark it answered: Start building stays
   enabled and the approval stays in Needs you. Every other press, Start building
   included, marks the card answered as today. Test through the routes: after a talk
   press the card has `answered: false` and is still in the Needs strip, and a later
   Start building press works.
4. **A verifier's worktree is always removed.** A verifier's worktree is a detached
   throwaway (Spec). Remove it with `git worktree remove --force` when the verifier stops
   (`machine/service.js:383`), so untracked files left by a test run don't keep it. Do
   this only for `role === 'verifier' && created_worktree`. Test with real git: a verifier
   worktree holding an untracked file is gone after stop.
5. **The thread file records what was typed in.**
   - Each successful submit appends `{ to, text, source, at }` to `thread.sent`.
   - The thread file keeps the last 500 entries. When it trims, the trimmed entries go to
     `threads/<id>.sent.jsonl` beside the thread file; nothing is dropped.
   - `restartLead`'s `[wc:context restart]` state gains `recent_messages`: the last 20
     `sent` entries whose source is `collin` or `card`, so a restarted lead sees what
     Collin said and pressed.

   Tests cover the record, the trim to the side file, and the restart context.

Ownership: `viewer/app/`, `machine/service.js` (item 4 only), `machine/API.md` if a route
changes, `viewer/app/API.md`, `viewer/test/app-*.test.js`, `viewer/test/helpers/`,
`machine/test/`.

Validation: `bash machine/test/run.sh`, `node --test viewer/test/*.test.js` (known: "a
starter that loses the freed port registers through the new holder"; "global write lock"
intermittent), `npm --prefix viewer run test:browser` (known: "no drawn arrow", Chromium
and Firefox). Paste the counts. Don't run `./install.sh`, don't touch the live services,
`wc-*` tmux sessions or `~/.local/state/wheelchair/`, never start a viewer on the default
port, never call the real `systemd-run`, never delete files (moving trimmed entries to the
side file is appending, not deleting). Leave changes uncommitted; the lead commits. If the
same gate fails twice, stop and report rather than iterating.

Deliverable: a report with the pasted test output, each gap mapped to its fix and test,
and: "List each decision you made that this brief did not settle, one line each, naming
the file or piece of the design it affected. Write 'none' if there were none."
