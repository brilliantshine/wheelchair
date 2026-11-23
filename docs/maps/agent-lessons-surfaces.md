# Map: agent lessons

Checked against: `c9c6451819f00556a5d875d42f6a8e462f3eb22a` (origin/main; covered files match this worktree).
Files covered: `viewer/app/settings.js`, `viewer/app/state.js`, `viewer/app/routes.js`, `viewer/app/cards.js`, `viewer/app/card.js`, `viewer/app/sessions.js`, `machine/service.js`, `viewer/pages/settings.js`, `viewer/pages/thread.js`, `viewer/test/app-lessons.test.js`, `viewer/test/app-lessons.spec.js`, `install.sh`, `install/`.

```text
agent lesson card -> machine synchronous relay -> hub validates -> settings.json
user edits in Settings -> validated edits and removals -> settings.json
settings.json -> role and scope filter -> session layers -> machine prompt
lesson card snapshot -> thread notice -> Settings
```

The card CLI validates action and role; the machine synchronously relays lesson cards and returns 503 instead of spooling when the hub cannot confirm them (`viewer/app/card.js:84`, `:214`; `machine/service.js:2245`, `:2249`). The hub checks the session role and calls `applyLesson`; a changed lesson produces a thread notice with a snapshot, while an identical retry produces no new notice (`viewer/app/cards.js:56`, `:69`, `:72`).

The hub keeps lessons by role in `settings.json`, under the hub state directory, with serialized atomic read-modify-write (`viewer/app/state.js:9`, `:70`, `:241`; `viewer/app/settings.js:340`). A lesson has a globally unique `L` plus six hex digits, text, optional provider and project path, saver, optional thread, and save time; normalization drops invalid or duplicate IDs, unknown fields, and entries over 12 per role (`viewer/app/settings.js:282`, `:285`, `:288`). Agents add, replace, or remove, with duplicate-add detection, an access matrix, and protection for user-edited lessons; replace and remove overwrite or delete the current record (`viewer/app/settings.js:191`, `:203`, `:204`, `:207`, `:210`, `:213`). No prior versions, reconfirmation date, or referenced-rule metadata survive that normalization (`viewer/app/settings.js:282`, `:288`).

Settings sends text edits and removal IDs; it checks edited IDs still exist, marks edits user-owned, and deletes removals (`viewer/pages/settings.js:859`, `:874`; `viewer/app/routes.js:224`, `:229`). Its Undo button only cancels a pending removal before Save (`viewer/pages/settings.js:894`, `:907`). The thread notice renders the saved snapshot and links to that role's Settings page (`viewer/pages/thread.js:1257`).

At session start the hub selects lessons for the role whose provider and exact project path match, then puts them before the user template; leads also see all lessons they maintain for reviewer, verifier and mapper, and sub-leads see all worker lessons (`viewer/app/settings.js:181`, `:186`, `:221`; `viewer/app/sessions.js:326`, `:379`). The machine appends layers to the composed role prompt, except when `role_prompt` overrides composition (`machine/service.js:195`, `:204`). This is a start-time snapshot, not a live update.

The node tests cover validation, authorization, retry/deduplication, scope filtering, limits, editing conflicts and unavailable relay (`viewer/test/app-lessons.test.js:20`, `:54`, `:91`, `:147`, `:177`); browser tests cover editor and notice flows (`viewer/test/app-lessons.spec.js:42`, `:64`, `:129`). The inspected installer and `install/` contain no hub `settings.json` export, import or backup path; the settings files named by installer fixtures are harness settings (`install/test/run.sh:231`, `:407`).

Not looked at: provider-native memory, all installer dependencies outside `install.sh` and `install/`, or other external backup tools.
