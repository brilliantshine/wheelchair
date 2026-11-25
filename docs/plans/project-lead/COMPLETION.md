---
slug: project-lead
date: 2026-11-24
implemented-by: "standard gpt-6.1-terra (T2, T3, T6, T8, T9), heavy gpt-6.2-sol (T1 attempt 3), standard claude-sonnet-5-5 (T4, T5), light gpt-6-luna (T7, T10); sub-lead claude-opus-5-5"
verified-by: []
---

# Completion Report — A project lead pinned in each project

Written for a hostile reviewer: every claim checkable, no claim without evidence. Base:
`main` at `7746cbc2`. Every row is `this run`: the plan has no Prior Work.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 Setting `project_leads`, default off, Settings row | this run | `viewer/app/settings.js:329`; `viewer/app/routes.js:391-393`; `viewer/pages/settings.js:562-564` | `viewer/test/project-lead.test.js` "project status is read-only…"; `viewer/test/app-project-lead.spec.js` "the Settings switch turns project leads on and off" |
| S1 Record created idempotently on first open or message | this run | `viewer/app/project-lead.js:45-61`; `viewer/app/routes.js:106-108` | `viewer/test/project-lead.test.js` "concurrent opens share a record across the hub alias and hostname…"; `viewer/test/app-project-lead.spec.js` "clicking an unstarted project lead row makes its record…" |
| S1 Start on use: queued before start, 202 + `start_error`, order kept, moved to next lead | this run | `viewer/app/project-lead.js:81-111`; `viewer/app/routes.js:735-739` | `viewer/test/project-lead.test.js` "opening a project lead starts it only on the first message", "failed starts retain queued messages in order…", "concurrent first sends start only one lead…", "a dead lead restarts on a message and turn ends deliver queued messages"; `viewer/test/app-project-lead.spec.js` "a message to a project lead with no live lead clears the draft in both composers and shows a start failure" |
| S1 Off: stop, hide, refuse, no starts, stop retried while off | this run | `viewer/app/project-lead.js:113-158,161`; `viewer/app/project-lead-actions.js:8`; `viewer/app/hub.js:115` | `viewer/test/project-lead.test.js` "off stops sessions, hides records, and guards direct thread routes", "off refuses messages and failed stops retry on machine contact only while off", "every project lead action is refused when the setting is off" |
| S1 Never archived, handed off or exported | this run | `viewer/app/threads.js:215`; `viewer/app/handoff.js:126,143-144` | `viewer/test/project-lead.test.js` "off stops sessions, hides records…" (archive and export refusals) |
| S2 Pop-up opens the project lead on a project thread page, with the switch; record made on panel open only | this run | `viewer/pages/assistant-popup.js:340-346`; `viewer/pages/nav.js:182-184` | `viewer/test/app-project-lead.spec.js` "on a project thread page the pop-up opens its lead, with a switch to the assistant" |
| S2 Assistant elsewhere (lead's own page, archived-only project); one-setting cases; never on own page | this run | `viewer/pages/nav.js:182-188`; `viewer/app/project-lead.js:69`; `viewer/pages/assistant-popup.js:132` | `viewer/test/app-project-lead.spec.js` "the pop-up opens the assistant on pages with no project lead", "with one setting on the pop-up offers that one with no switch", "the project lead page records what was seen under its own conversation"; `viewer/test/project-lead.test.js` "project status is read-only…" |
| S2 Seen state and previews per conversation id | this run | `viewer/pages/assistant-popup.js:23-25`; `viewer/pages/threads.js:97,243-249`; `viewer/pages/thread.js` `rememberSeen` | `viewer/test/app-project-lead.spec.js` "the unread dot is kept for each conversation" |
| S3 Runs on the project's machine with `prompt_role: project-lead`; prompt from `project-lead.md` + card files; layers only name, style, scout | this run | `viewer/app/sessions.js:345,389-400`; `viewer/app/settings.js:224-230`; `machine/service.js:208,214,804-806` | `viewer/test/project-lead.test.js` "project lead start forces the sandbox and includes only the project role layers"; `machine/test/project-lead.test.js` "project lead clone refreshes, contains local branches, and enforces its agent fence" (prompt line, no realism/repo-law) |
| S3 Folder: separate `git clone` under `worktrees/<folder>/project-lead-<id>` | this run | `machine/lib/project-lead.js:6-10,41`; `machine/service.js:421-429` | `machine/test/project-lead.test.js` "project lead clone refreshes…", "start reuses and cleans clone and blocks pushing", "start rejects unborn project and forbidden fields and root path" |
| S3 Refresh steps 1-3, default tip order, no-tip failure | this run | `machine/lib/project-lead.js:14-31` | `machine/test/project-lead.test.js` "refresh selects local defaults and current branch…", "refresh keeps the fetched upstream tip during an origin outage", "default tip falls back to main/master/topic", "upstream default wins over a different local default", "origin HEAD chooses trunk over local main", "start survives unreachable origin and missing remote default", "remote lacking the default branch uses the local default" |
| S3 `wc.js project-lead refresh` | this run | `viewer/app/wc.js:196-206`; `viewer/app/project-lead-actions.js:61-66`; `machine/service.js:2186-2190` | `viewer/test/project-lead.test.js` refresh assertions in "project lead actions enforce project scope…" and the CLI retry test; `machine/test/project-lead.test.js` refresh route in "project lead clone refreshes…" |
| S3 Locked down: machine allow-list, hooks allowed, `file`/`image` only from the clone, push blocked | this run | `machine/service.js:2252-2266,2338-2343`; `viewer/app/sessions.js:746`; `machine/lib/project-lead.js:17` | `machine/test/project-lead.test.js` "project lead clone refreshes…", "project lead relay and agent fence use the authenticated session", "start reuses and cleans clone and blocks pushing"; `viewer/test/project-lead.test.js` "project lead sessions cannot use the machine session relay or receive cross-thread cards" |
| S3 No project tools; Codex always sandboxed; account switch keeps the launch | this run | `machine/service.js:855,894,933,957-959`; `connectors/codex/machine.js:123,160` | `machine/test/project-lead.test.js` "project lead records sandboxed Codex mode", "account switch relaunches in the clone without project tools"; `viewer/test/project-lead.test.js` "account switching keeps the project lead identity" |
| S3 Fresh starts, "Project lead restarted · starting fresh" | this run | `viewer/app/threads.js:142-146,195-202`; `connectors/hub-common.js:109` | `viewer/test/project-lead.test.js` "restart drops old card messages and renders the project lead fresh-context line" |
| S4 Caller check and 403 texts | this run | `viewer/app/project-lead-actions.js:8-12` | `viewer/test/project-lead.test.js` "project lead actions enforce project scope…", "every project lead action is refused when the setting is off" |
| S4 Scope by resolved machine + exact path; out-of-project, self, assistant and project-lead targets refused | this run | `viewer/app/project-lead-actions.js:14-20,48-50` | `viewer/test/project-lead.test.js` "project lead actions enforce project scope…", "the same path on another registered machine is outside the project", "another project lead is refused as a target of every targeted action" |
| S4 `start` in its own project and machine | this run | `viewer/app/project-lead-actions.js:54`; `viewer/app/assistant-actions.js:37` | `viewer/test/project-lead.test.js` "project lead actions enforce project scope…" |
| S4 `press` refuses `sudo`, `reach`, `permit` | this run | `viewer/app/project-lead-actions.js:55-58` | `viewer/test/project-lead.test.js` "project lead actions enforce project scope…" |
| S4 Other projects' content left out; `reach`/`permit` as plain text | this run | `viewer/app/project-lead-actions.js:17-44` | `viewer/test/project-lead.test.js` "project lead actions enforce project scope…", "closed reach and permit cards are absent from waiting and cards", "cross-thread messages and recent chat omit other project identifiers and titles", "short other-project titles do not redact same-project text", "same-project text mentioning its project path remains in recent chat" |
| S4 Inbound cross-thread `message`/`reach` to a project lead refused | this run | `viewer/app/cards.js:229`; `viewer/app/peers.js:24`; `viewer/app/project-lead.js:164-165` | `viewer/test/project-lead.test.js` "project lead sessions cannot use the machine session relay or receive cross-thread cards" |
| S4 `[wc:assistant]` marker and attribution | this run | `viewer/app/assistant-actions.js:58,80` (shared runner); `viewer/app/threads.js:346` | `viewer/test/project-lead.test.js` "project lead actions enforce project scope…" (start marker); message/press attribution through the shared runner covered by `viewer/test/assistant.test.js` |
| S4 Assistant refuses project lead targets and leaves them out of `threads` | this run | `viewer/app/assistant-actions.js:16-19` | `viewer/test/assistant.test.js` "assistant actions exclude and refuse project lead threads" |
| S5 Grouping by resolved machine + exact path, always; same-name headings show path (+ machine) | this run | `viewer/app/routes.js:550-569` (`machine_key`); `viewer/pages/threads.js:48,174-189` | `viewer/test/app-project-lead.spec.js` "thread list groups by machine and exact path, and names same-named folders apart"; `viewer/test/project-lead.test.js` "concurrent opens share a record across the hub alias and hostname…" |
| S5 Pinned project lead row, both states | this run | `viewer/pages/threads.js:92-105,180-194` | `viewer/test/app-project-lead.spec.js` "thread list pins each project's lead above its threads, before and after it has a chat" (phone and desktop) |
| S5 Project lead thread page as the assistant's, head meta "<folder> on <machine>" | this run | `viewer/pages/thread.js:209-210,260,270,289,301,1715` | `viewer/test/app-project-lead.spec.js` "clicking an unstarted project lead row makes its record and opens its thread…" (head and meta) |
| S5 Left out of features, `session leads`, overlap checks (`session leads` is the overlap source), auto-merge and PR pollers; Needs you counts | this run | `viewer/app/views.js:34,39,43`; `viewer/app/peers.js:48`; `viewer/app/auto-merge.js:25`; `viewer/app/threads.js:513`; `viewer/app/hub.js` `acceptCard` done gate | `viewer/test/project-lead.test.js` "features and peer discovery exclude project leads but Needs you keeps their open questions", "auto-merge ignores an otherwise eligible project lead record", "the merged-PR poller calls GitHub only for ordinary threads" |
| S6 Role file `protocol/app/project-lead.md` | this run | `protocol/app/project-lead.md:1-79` | No suite (protocol prose); reviewed against S6 in `reports/T4.md`; the machine test asserts the prompt is built from it |
| S7 `assistant.md` and routers | this run | `protocol/app/assistant.md:49,57-58`; `protocol/app/lead.md:23`; `protocol/app/cards.md:214`; `protocol/AGENTS.md:14`; `protocol/app/AGENTS.md:3,12,22-23`; `viewer/AGENTS.md:34-36,53`; `machine/AGENTS.md:15` | Docs; checked by reading |
| Mockups (10 screens) | this run | `viewer/pages/{threads,thread,assistant-popup,settings,nav}.js`, `assistant-popup.css`, `app.css`, `views.css` | Screenshots posted beside each mockup; differences listed under Deviations |

## Deviations from plan

- Inbound refusal text says "a project lead takes messages only from <Settings user name>"
  (falls back to "the user"), not a hard-coded "Collin" (`viewer/app/project-lead.js:164-165`).
- Self and other-project-lead targets of a project lead's actions are refused with "that thread
  is in another project; ask your assistant" (S4 names no text for these).
- Beyond S3: the clone's push URL is set to an invalid value on every refresh so a mistaken
  `git push` from the clone fails (`machine/lib/project-lead.js:17`); refresh cleans with
  `git clean -fdx`; the project-folder fetch has a 60 s timeout.
- Pages against the mockups: names keep the folder's own case ("wheelchair lead"); the head
  meta uses the stored machine name ("wheelchair on hub"); previews are one line; the pop-up
  button also appears on Threads, Settings and a project lead's own page (S2 says the
  assistant opens there); Settings hint uses the mockup's wording.
- `protocol/app/lead.md:23` and `protocol/app/cards.md:214` now say `[wc:assistant]` comes from
  the assistant or a project lead (made true by Decision 10).

## Routers

- `protocol/AGENTS.md`: row for `app/project-lead.md`.
- `protocol/app/AGENTS.md`: row for `project-lead.md`; project lead added to the readers of
  `cards.md` and `cards-lead.md`; sentence that it gets only those three files.
- `viewer/AGENTS.md`: rows for `app/project-lead.js` and `app/project-lead-actions.js`; the
  `app/assistant.js` row names the shared `special` check; the `pages/assistant-popup.js` row
  describes the per-conversation seen key and the project lead side.
- `machine/AGENTS.md`: row for `lib/project-lead.js`.

## Validation evidence

Run on commit `b5987ac8` (feature branch after every task merged).

```
$ node --test viewer/test/project-lead.test.js
# tests 26
# pass 26
# fail 0

$ node --test viewer/test/assistant.test.js
# tests 19
# pass 19
# fail 0

$ bash machine/test/run.sh
# tests 754
# pass 752
# fail 0
# skipped 2

$ npm --prefix viewer run test:browser -- app-project-lead.spec.js app-assistant.spec.js app-assistant-popup.spec.js app-assistant-phone.spec.js
  94 passed (1.6m)

$ node --test viewer/test/*.test.js
# tests 1009
# pass 1008
# fail 1
not ok 924 - the global write lock serializes concurrent writes and retry retains both changes

$ node --test viewer/test/server.test.js   # three re-runs of the one failing file
# pass 49 # fail 1
# pass 50 # fail 0
# pass 50 # fail 0
```


The one viewer failure is `viewer/test/server.test.js:579` (the graph server's global write
lock). This branch does not touch `viewer/server.js` or `viewer/test/server.test.js`; re-running
the file passed 2 of 3 times, so it is an existing timing flake, not this change.

`bash install/test/run.sh` was run by several workers and failed only its "real wheelchair
directory is byte-identical after suite" check, because live sessions on this machine write to
`~/.wheelchair` while it runs. The full run (`test-support/full-run.sh`) covers the committed
tip separately.

## Known gaps / residual risks

- Accepted Risks 1-3 in PLAN.md stand (shell writes on Claude, linked worktrees, lost start
  reply + Off).
- Other-project content filtering is by identifiers and quoted peer text (thread ids, session
  names, titles, paths, `peer_log` text, ignoring strings under 8 characters). Text in a
  same-project item that names another project in other words is not caught. An outside path
  that is a prefix of the caller's own path is not hidden.
- No test checks that the composed prompt includes `cards.md` and `cards-lead.md` (the machine
  test checks the role file, project line and the absence of realism/repo-law).
- No test covers the 60 s fetch timeout itself.
- The project lead message/press attribution goes through the assistant's shared runner and
  renderer; there is no project-lead-specific attribution test.
- The pop-up's old global `wc-assistant-seen` value is not migrated: the assistant's unread dot
  may light once after the update.
- Deferred D1-D3 remain deferred.

## Remediation rounds

(none yet)
