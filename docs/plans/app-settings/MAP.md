# MAP: app settings and thread asides

Checked against: `5742e2f990d2f99c82aa82b01403ee772a6bf502` (origin/main)
Built from: `docs/maps/app-sessions.md` (new), `docs/maps/app-thread-page.md` and
`docs/maps/viewer-serving.md` (both re-checked and updated to this commit). Detail and
every pointer for the claims below are in those maps; this file names what matters for
this change.

## How it works today, end to end

1. A thread starts its lead at tier `top` with an empty brief
   (`viewer/app/threads.js:57`). Other sessions are started by an agent's
   `wc.js session start … --tier T` through the machine service to the hub
   (`viewer/app/sessions.js:288-326`).
2. The hub turns the tier into a model: Claude `top` = no `--model` (CLI default), else the
   alias `haiku|sonnet|opus`; Codex `top` = `sol`, and `luna|terra|sol` are looked up in
   `codex/model.sh`'s pins file `~/.wheelchair/models` (`sessions.js:16-35`).
3. The hub sends the machine service `{role, cli, model, brief, token, worktree}`
   (`sessions.js:110-128`). The service builds a fixed command line: Claude with
   `--permission-mode auto` and `--append-system-prompt "Read protocol/app/<role>.md"`;
   Codex with `-a never` and the same line as a first `[wc:role]` message
   (`machine/service.js:242-262`, `283-286`). It runs it in tmux with
   `WHEELCHAIR_LANE=1` and the session token (`service.js:278`, `287-291`).
4. Each CLI uses the one login its config directory holds. Nothing picks a directory: the
   service passes none, and it looks for transcripts in `$CLAUDE_CONFIG_DIR` /
   `$CODEX_HOME` from its own environment (`service.js:278`, `583`, `591`).
5. The thread page polls `/chat` every 2 s. The hub reads the transcripts of the `lead`
   sessions only, turns them into `{type, text, at}` items, and the page rebuilds the whole
   chat on each change, drawing each lead message with `WCMarkdown`
   (`viewer/app/chat.js:150-246`, `viewer/pages/thread.js:249-297`).
6. A typed message or a card press is queued to the lead and pasted in when its turn ends
   (`viewer/app/sessions.js:192-233`, `viewer/app/threads.js:198-235`).

```
thread / wc.js session start --tier T
   -> hub resolveModel (hard-coded tiers; codex/model.sh pins)
   -> machine commandFor (fixed permission mode; role prompt = one "Read <role>.md" line)
   -> tmux (WHEELCHAIR_LANE=1; CLI's default login dir)
   -> transcript copy -> hub /chat (lead sessions only) -> thread page (rebuilt every change)
```

## What matters for this change

**Settings has nowhere to live yet.** No settings file in the hub's state directory
(`viewer/app/state.js:45-46` has machines and projects only), no `settings` API route
(`viewer/app/routes.js:27-44`), no page. A page is a name in `APP_PAGES`
(`viewer/server.js:1830`), a file in `viewer/pages/`, and a row in the nav's list of three
(`viewer/pages/nav.js:38-42`).

**Tiers and models.**
- The hub's tier names are hard-coded per CLI (`sessions.js:16-19`); the Codex names are
  also the keys of the pins file (`codex/model.sh:25`). A Light/Standard/Heavy/Critical
  table per provider replaces both lookups, or maps onto them.
- **Wrong today:** Astra is pinned in `model.sh` and on the ladder in
  `protocol/app/sub-lead.md:119`, but the hub refuses `--tier astra` (`sessions.js:17`,
  `27-29`). "Critical" has no working path in the app yet.
- **Not enforced today:** "leads run on Opus 5.5". A Claude `top` session passes no
  `--model` (`sessions.js:24`).
- The tier names appear in code, tests, the pins file format, seven protocol files and the
  designs; the full list is in `docs/maps/app-sessions.md`, "Every place the tier names …".
  Renaming in the app only touches `sessions.js`, `API.md` and tests; renaming in
  `protocol/` touches `lanes.md`, `sub-lead.md`, `lead.md`, `implementation.md`,
  `verification.md`, `plan-review.md` and the COMPLETION template.

**Permission mode** is fixed in the command line, and **Claude's readiness depends on
it**: the service waits for the pane to say `auto mode on` (`service.js:254`, `298`). A
setting that changes the mode must change the ready test too, or every Claude session goes
`stuck` after 30 s.

**Accounts.** One login per CLI per machine, implicitly. Per-account login folders mean
the service must set `CLAUDE_CONFIG_DIR` / `CODEX_HOME` per session in the tmux `env`
prefix (`service.js:278`) **and** look up transcripts in that session's folder rather
than its own environment (`service.js:583`, `591`). Codex's preflight refresh and the
heads-up already honour `CODEX_HOME` (`codex/preflight.sh:26`, `codex/model.sh:31-33`),
but run once with the service's environment (`service.js:681`). Login status is per CLI,
not per account (`service.js:663-673`), and the Ready check reads only that
(`viewer/app/ready.js:26-54`).

**Usage.** Nothing reads usage or limits anywhere. The machine's `/v1/status` reports
only installed, logged in and version per CLI. Balancing has no data source to start from.
The model heads-up that the acceptance follow-up wanted on a Settings page is already in
the `/v1/preflight` response body but the hub discards it (`ready.js:17-24`).

**Behavior templates and the writing style.** There is a ready slot: the service accepts
`role_prompt` and uses it in place of the "Read <role>.md" line for both CLIs
(`service.js:245`, `283-286`), but the hub never sends one (`sessions.js:110-128`). The hub
could compose built-in pointer + template (+ style for a lead) into it, or append them to
the brief. App agents get no writing rules today: the wording hook skips every app session
because of `WHEELCHAIR_LANE=1` (`seen/hook.sh:166-167`). "Changes apply to agents started
after saving" matches how this works: the prompt is fixed at start.

**Asides.**
- **No message has an identity.** A chat item is `{type, text, at}` (`chat.js:113`); the
  page rebuilds `#chat` from scratch on every change (`thread.js:251`). Underlines that
  survive and can be reopened need a stable id per lead message and a stored anchor
  (offsets into the Markdown source, or into the rendered text), re-applied after each
  rebuild.
- **Forking is possible in the CLIs but absent from the service.** `claude --resume <id>
  --fork-session` and `codex fork <id>` exist in the installed versions; the service keeps
  each lead's `cli_session_id` / `codex_thread_id` (`service.js:274`, `571`). But
  `commandFor` has no resume path, Codex readiness and transcript binding key on a first
  `[wc:role]` message a fork never gets (`service.js:284-286`, `570`), and there is no
  aside role (`sessions.js:38-45`).
- **A fork believes it is the lead.** Its history holds `lead.md`, and with a session
  token it could post cards or start sessions in the thread. The hub would need to refuse
  those by role.
- Keeping it out of the main thread is free: the chat reads only `lead` sessions
  (`chat.js:222`). Sending it messages can reuse the per-session queue and delivery
  (`sessions.js:192-233`).
- "What the main thread is waiting on" is derivable from the thread's open `question`
  cards (`answered: false`), which `/chat` already returns.

## What I did not look at

- The six `.dc.html` design files, beyond which tier names they contain.
- Whether `claude --resume` must run in the original working directory, where either CLI's
  fork writes its transcript, and whether a fork can be told a different system prompt.
- Each CLI's own usage command or output (none is called today).
- `viewer/app/hub.js`, `views.js` `sessions()`, and the Sessions page.
- `viewer/app/card.js` validation, and whether cards are already refused by role for
  reviewers and verifiers.
- The machine service's stop, archive and git routes.
