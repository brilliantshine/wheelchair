# Map: lessons hardening

Checked against: `c9c6451819f00556a5d875d42f6a8e462f3eb22a` (origin/main; relevant files match this worktree). See [agent lessons](../../maps/agent-lessons-surfaces.md) and [thread handoffs](../../maps/thread-handoffs.md).

```text
agent card or Settings edit -> current lesson in hub settings -> filtered start prompt
                                      -> Settings editor and thread notice
thread handoff -> pushed branch + history JSON -> import claim -> restarted lead
```

- History and restore need a durable path through both mutation sites: agent replace/remove and Settings edit/remove currently discard old records (`viewer/app/settings.js:191`, `:204`, `:213`; `viewer/app/routes.js:224`, `:230`). The existing Undo is only before Save (`viewer/pages/settings.js:907`); notice snapshots are partial and are stored on individual threads, not a complete version history (`viewer/app/settings.js:219`; `viewer/app/cards.js:72`).
- Staleness cannot currently be inferred from a reconfirmation or rule reference: normalized records only preserve the listed current fields, including `saved_at`, which changes on an edit or replacement (`viewer/app/settings.js:213`, `:282`, `:288`; `viewer/app/routes.js:230`). Rule-change detection needs a reference and comparison source. Normalization must preserve any added metadata (`viewer/app/settings.js:284`).
- Handoff JSON carries neither lessons nor lesson notices; its strict schema rejects extra top-level fields (`viewer/app/handoff.js:5`, `:18`, `:49`, `:73`). Import persists a retryable operation and may return `opened` without applying anything, so merge timing and idempotency matter (`viewer/app/handoff-import.js:26`, `:49`; `viewer/app/handoff-ops.js:15`, `:102`). Lesson IDs are unique across roles within an installation, but random six-hex IDs do not establish cross-install identity (`viewer/app/settings.js:211`, `:283`). Project scope uses an exact path, while import selects a destination path (`viewer/app/settings.js:183`; `viewer/app/handoff-import.js:9`).
- Lessons live in the hub's `settings.json`, not the pushed thread branch (`viewer/app/state.js:70`; `viewer/app/handoff.js:153`). The inspected installer has no hub settings backup or migration path; the maps describe the inspected boundaries and tests (`install/test/run.sh:231`; `viewer/test/app-lessons.test.js:147`; `viewer/test/app-lessons.spec.js:64`).

Not looked at: third-party backup mechanisms, provider-native memory, or all handoff failure and recovery branches.
