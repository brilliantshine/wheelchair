# Account switchover map

```text
account settings + machine sign-in + usage -> choose account -> preflight -> tmux session
                                                                      |
                                   limit event -> hold until reset -> Continue
                                   transcript -> machine copy
```

The detailed current flow and source pointers are in [account-switchover-runtime](../../maps/account-switchover-runtime.md). Placement selects an account before start; waiting starts are retried, but an already running limited session stays on its original account and receives `Continue.` after reset (`viewer/app/sessions.js:264-290`, `:593-608`, `:873-893`).

Claude reports `rate_limit` through StopFailure; Codex's adapter only translates completed-turn notifications and extracts reached limits from transcript usage, so the two do not expose the same failure signal (`machine/adapters/claude.js:94-96`; `machine/adapters/codex.js:114-131`, `:149-151`). Other turn failures notify the starter or the user (`viewer/app/sessions.js:610-619`). Startup stuck and quiet detection are separate mechanisms (`machine/service.js:1141-1152`; `viewer/app/quiet.js:3-7`, `:32-56`).

CLI state is account-directory scoped, and the machine's transcript copy is separate from those directories. Ordinary launches do not resume; Claude's aside does use `--resume`, but cross-account portability is unproven (`machine/adapters/claude.js:5-6`, `:49`, `:73`, `:86`; `machine/adapters/codex.js:5-6`, `:133-149`; `machine/service.js:1387-1423`). GPT replacement also needs the selected account's locked preflight (`viewer/app/sessions.js:292-314`; `codex/preflight.sh:21-33`).

Not looked at: live CLI behavior, cross-account resume compatibility, all provider error forms, or complete test coverage.
