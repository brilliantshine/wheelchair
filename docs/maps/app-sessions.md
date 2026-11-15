# Map: agent sessions and result delivery

Checked against: `7c380321f4556a08b63485203d613feeeae1f640` (origin/main)
Files covered: `viewer/app/sessions.js`, `viewer/app/cards.js`, `viewer/app/threads.js`, `viewer/app/state.js`, `viewer/app/providers.js`, `viewer/app/balancer.js`, `viewer/app/settings.js`, `machine/service.js`, `machine/hook.sh`, `machine/lib/hook-post.js`, `machine/adapters/claude.js`, `machine/adapters/codex.js`, `codex/model.sh`

## Flow

A thread is saved with an empty sessions array, then its lead starts (`viewer/app/threads.js:20-36`, `:63-74`). A lead may start mappers, reviewers, sub-leads and verifiers; a sub-lead may start workers and verifiers (`viewer/app/sessions.js:34-46`). The hub records the caller as `started_by` (`sessions.js:401-409`). Names are operational identifiers `wc-<thread-id>-<role>`, with `-2`, `-3` etc. chosen against all recorded sessions (`sessions.js:53-61`). Restart starts another lead in the same worktree, preserves older sessions and moves their queued messages to it (`viewer/app/threads.js:118-153`).

The hub chooses a provider/account and may instead record a pending, `waiting` start (`viewer/app/sessions.js:83-94`). It resolves the model and effort for the role's slot through `codex/model.sh`, then sends them to the machine (`sessions.js:18-27`, `:120-123`, `:153-168`). Worker effort can override the slot effort subject to a ceiling (`sessions.js:64-71`, `:167-168`). Pins live in `~/.wheelchair/models`, overridable by `WHEELCHAIR_MODELS` (`codex/model.sh:42`); both providers support configured effort (`viewer/app/providers.js:3`). The machine records effort and command argv, but **does not record a separate model field** in its new session object (`machine/service.js:301-308`); the adapters put model and effort in the command (`machine/adapters/claude.js:21`, `machine/adapters/codex.js:30`). The hub merges that machine object into its record (`viewer/app/sessions.js:182-201`), so a new session's model is only in `command`, not `session.model`. Effort may be absent when no explicit effort was selected.

Hub records are saved atomically per thread under `threads/<id>.json` (`viewer/app/state.js:41-47`, `:107-130`); machine sessions persist separately and are loaded on service startup (`machine/service.js:158-159`, `:315-316`). If the machine registry is missing a live tmux session, recovery reconstructs only limited fields from its operational name, pane and path, without token or parent (`machine/service.js:173-188`).

A child result card marks it finished and queues a result to `started_by` (`viewer/app/cards.js:79-93`). Reviewer/verifier turn end instead extracts the last assistant text, marks finished and queues a result (`viewer/app/sessions.js:205-228`, `:340-344`). CLI hooks reach the machine and are spooled if needed (`machine/hook.sh:6-30`, `machine/lib/hook-post.js:15-30`); machine forwards events to the hub (`machine/service.js:588-618`). The hub sets `turn_ended`; it delivers a queued message only when live, ready, idle and not held; successful submission clears that flag (`viewer/app/sessions.js:245-262`, `:278-297`, `:340-344`). This represents idle and message delivery, not a declared dependency on a particular child: `started_by` plus unfinished children can suggest outstanding work, but cannot prove the parent is waiting for one.

```text
thread -> lead -> child start -> started_by recorded -> child result -> starter queue
                                               turn-end -> idle -> queued message submitted
```

## What I did not look at

- Full provider balancing, usage and retry algorithms, or CLI hook payload parsing beyond their handoff.
- Machine archive, stopped-session retention, and session migrations beyond recovery above.
