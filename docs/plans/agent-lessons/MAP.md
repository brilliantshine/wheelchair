# Map: agent lessons

Checked against `adba2647ebd1d3edccd384dcb242fdb103a38a3a` (origin/main and worktree HEAD). Detailed current source pointers and boundaries: [agent-lessons-surfaces](../../maps/agent-lessons-surfaces.md).

```text
Agent learns -> lesson saved for project -> user lists, edits or removes it
  -> next agent start reads applicable lessons -> shared prompt -> provider CLI
```

The diagram describes the proposed flow; no shared lesson store was found in the targeted source search. Today the hub passes project-scoped role layers to the machine, which assembles and saves the role prompt before starting any of the five provider CLIs (`viewer/app/sessions.js:324`, `:358`; `machine/service.js:156`, `:781`). Claude and Pi receive the prompt file as a CLI argument; Codex, Antigravity and Kimi are told to read it in `[wc:role]` (`machine/adapters/claude.js:68`, `machine/adapters/pi.js:61`, `machine/adapters/codex.js:144`, `machine/adapters/agy.js:69`, `machine/adapters/kimi.js:168`). The prompt override bypasses layers, and running sessions already have a snapshot (`machine/service.js:158`, `:781`). Aside turns use a separate path (`machine/adapters/pi.js:64`).

The main design decisions are where project lessons live and how machines agree on project identity and access; how an agent saves a lesson, including reviewers and verifiers whose current rules prohibit posting cards (`viewer/app/card.js:28`, `machine/service.js:154`); and how edits reach future versus already-running sessions. Hub settings are local state with queued writes, while machine worktrees and account folders live on their own machines (`viewer/app/state.js:64`, `:241`; `machine/service.js:609`, `:66`). Settings templates and style provide editable-text examples; thread plan documents are read-only and limited to three filenames (`viewer/pages/settings.js:656`, `:937`, `:977`; `viewer/app/documents.js:9`). The phone reaches the viewer and hub, which calls machine services with their secrets (`viewer/server.js:1262`, `install.sh:296`, `viewer/app/machine-client.js:67`).

A proposed-lesson card would cross the validator, machine spool, hub role validation and thread renderer; card acceptance alone does not create a lessons store (`viewer/app/card.js:184`, `machine/service.js:2141`, `:2184`, `viewer/app/cards.js:56`, `viewer/pages/thread.js:827`).

Existing maps [agent-provider-flow](../../maps/agent-provider-flow.md), [model-roles-scout](../../maps/model-roles-scout.md), [app-cards-security](../../maps/app-cards-security.md), [thread-sidebar-files](../../maps/thread-sidebar-files.md), [viewer-app-pages](../../maps/viewer-app-pages.md), [local-project-runtime](../../maps/local-project-runtime.md), [app-sessions](../../maps/app-sessions.md) and [session-token-flow](../../maps/session-token-flow.md) have covered-file changes since their recorded commits; the focused map rechecks the relevant flow rather than certifying those historical maps in full.

Not looked at: provider-native memory internals and external CLI behavior; all historical plans and fixture transcripts; every aside and handoff/restart edge case; a complete audit of unrelated maps or every card action.
