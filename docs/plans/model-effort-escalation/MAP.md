# Map: model effort per slot, and escalation rules in Settings

Checked against `695931e84556a21d3c22729d21083992640dcc0e` (origin/main). Builds on
`docs/maps/app-sessions.md` (updated in this commit) and `app-thread-page.md` /
`viewer-serving.md` (not touched by this idea, reused as is).

## What exists today

Effort is **already half built**, for Claude only.

1. **Pins file.** `~/.wheelchair/models` holds `<provider>.<slot> = <model> [@effort]` for
   providers `claude`, `gpt` and slots `light, standard, heavy, critical, lead`
   (`codex/model.sh:14-15`, parser `:61-101`, writer `:122-129`). The parser rejects an
   effort on any GPT line and on a `none` cell (`:78`, `:81-84`); efforts are
   `low medium high xhigh max` (`:31`). `model.sh effort claude <slot>` prints it
   (`:320-324`); `set <provider> <slot> <model|none> [effort]` writes it (`:368-377`, GPT
   effort → usage error); `show --json` reads every cell (`:349-360`).
2. **Settings routes.** `PUT /settings/models {provider, slot, model|null, effort?}`
   (`viewer/app/routes.js:51-62`) rejects effort for GPT (`:57`), checks the value (`:58`) and
   shells out to `model.sh set` (`:59`). `GET /settings` returns `models` from
   `model.sh show --json` (`viewer/app/settings.js:185`, `207`).
3. **Settings page.** The Tiers table is one row per provider, one column per tier
   (`viewer/pages/settings.js:213-228`). `modelPicker` draws a model select plus, when
   `withEffort`, an effort select ("CLI default" or low…max) (`:95-158`). The Claude row
   passes `withEffort: true` (`:224`); the GPT row does not. The Leads section calls it with
   `withEffort: false` for **both** providers (`:270`), so a lead effort cannot be set in the
   UI even though the API and `model.sh` accept the `lead` slot. Other agents rows
   (reviewer, verifier, mapper) pick only a **tier**, not a model or effort
   (`:191-209`, `viewer/app/routes.js:49-52` of the preferences handler,
   default `reviewer: heavy, verifier: heavy, mapper: standard`, `settings.js:23`). Their
   effort is whatever that tier's Claude cell says.
4. **Starting a session.** `resolveModel` (`viewer/app/sessions.js:16-39`) picks a slot (lead
   and sub-lead → `lead`; reviewer/verifier/mapper → Other agents tier; worker → requested
   tier, `top` = heavy), asks `model.sh` for the model, and for Claude only also for the
   effort (`:33`). `startSession` passes `effort` only when set (`:129`). The machine service
   adds `--effort E` to the `claude` argv (`machine/service.js:277`) and ignores effort for
   Codex (`:287`; `startOptions` records it, `:65-73`). **Codex has no effort flag anywhere
   in `machine/`**, so an app Codex session runs at whatever `~/.codex/config.toml` says.
5. **Terminal (non-app) lanes.** `protocol/lanes.md` tells the lead to pass
   `-c model_reasoning_effort=high` on every GPT lane (`:43`, `:53`, `:93`) and `--effort`
   from `model.sh effort claude <tier>` on shell Claude lanes (`:164`). The Agent-tool path
   follows model family only and loses effort (`:165-168`). So terminal GPT effort is a fixed
   `high` typed by the lead; app GPT effort is unset; Claude effort is the pin in both.

```
Settings page --PUT /settings/models--> routes.js --model.sh set--> ~/.wheelchair/models
                                                                        |
wc.js session start --tier T --> sessions.js resolveModel --model.sh model / effort claude--+
                                      | {model, effort?}
                              machine service commandFor
                              claude: --model M --effort E     codex: -m M   (no effort)
```

## Escalation rules today

- **Where they live:** prose only.
  - `protocol/lanes.md:200-214`: ladder light → standard → heavy → critical, one rung at a
    time, bought only by a lane that already came back wrong; three moves in order, **rewrite
    brief → raise effort to `xhigh` → change tier**; every lane starts at `high`, so the
    effort rung is `high → xhigh`; record rung and reason next to the task.
  - `protocol/app/sub-lead.md:122-132`: the same ladder, but **only two moves** (rewrite the
    brief, then change tier). It never mentions an effort rung.
  - `protocol/implementation.md:183-187` and `protocol/verification.md:100-109`: the
    terminal-workflow versions; verification adds "nearly-right, missed an edge case →
    `xhigh` at the same tier; misread the task → next tier".
- **Who reads them:** the sub-lead reads `sub-lead.md` as its role file (`settings.js:138`
  pointer); `lanes.md` is read by terminal-workflow leads.
- **Does code enforce or record escalation?** No. `grep -i escalat` over `viewer/` and
  `machine/` finds no JavaScript (only protocol and docs). The tier is whatever the sub-lead
  passes to `wc.js session start --tier` (`viewer/app/wc.js:77-90`); the hub only checks it is
  a valid tier. The record is a note the sub-lead writes in PLAN.md.

### Things that do not line up

- **The app sub-lead cannot do the `xhigh` rung even if told to.** `wc.js session start`
  accepts `--role --cli --tier --brief-file --attempt --replaces` and nothing for effort
  (`viewer/app/wc.js:77-90`); effort comes only from the slot's pin. `sub-lead.md`
  consistently drops the effort rung that `lanes.md:207` has.
- **Claude default effort is "CLI default".** Every shipped default is `None`
  (`codex/model.sh:17-28`), so the `high` floor the lanes doc assumes holds for GPT lanes
  typed by hand and for no Claude or app lane.
- **Lead effort is hidden in the UI** (`settings.js:270`) while the store, API and
  `sessions.js:33` all support it.

## How Settings content reaches agents (the path for escalation rules)

`settings.json` (hub state, `viewer/app/state.js:47`, `176-193`) holds `templates`, `style`,
`other_agents` and the permission modes (`settings.js:23`). At each start the hub builds
`role_layers` (`settings.js:121-134`): a no-override line, then the in-use **behavior
template** for that role (project scope beats `all`, `:116-119`; switch sentences `:93-106`;
free text up to 4000 characters `:84`), then "the brief wins", then, for leads only, the
writing style (`:132`). `startSession` sends it as `role_layers` (`sessions.js:132`), and
`composeRolePrompt` appends it after the pointer line (`machine/service.js:57-63`): Claude via
`--append-system-prompt` (`:277`), Codex in the first `[wc:role]` message (`:310-314`). The
composed text is capped at 12000 characters (`settings.js:146`). `GET /settings/prompt?role=`
returns the full text (`routes.js:99-103`).

A template for role `sub-lead` is already valid (`ROLES`, `settings.js:11`; Settings page
lists it, `viewer/pages/settings.js:21-22`). So escalation rules typed as a sub-lead template
**would already reach a sub-lead today**, as free text with a precedence line saying the
built-in rules win where they disagree. A *structured* rule set (for example "after one failure
raise effort to X") is a new field: it needs validation, a sentence renderer next to
`switchSentences`, and a route; sessions in flight keep the layers they started with.

## Constraints for the idea

- Built-in rules still win over template text (`settings.js:124-125`), so a Settings rule that
  contradicts `sub-lead.md` loses unless the protocol file is changed too.
- Showing the rules read-only needs only the existing `/settings/prompt` or a new read of the
  protocol text; making them editable means they move from `protocol/` into `settings.json`.
- GPT effort needs three changes in different places: `model.sh` parser and writer
  (`:78`, `:372`), the PUT route (`routes.js:57`), and a codex argv flag in
  `machine/service.js:287`. The flag is `-c model_reasoning_effort=<e>` per `lanes.md:43`;
  I did not test it against the installed Codex.
- Efforts are shared across the two providers only partly: `max` is in the allowed list
  (`model.sh:31`), but I did not check which efforts each Claude model accepts.

## What I did not look at

- `viewer/test/app-settings.test.js`, `app-settings.spec.js`, `codex/test/run.sh` (what they
  pin about effort); 27 lines mention effort across the suites.
- Whether Claude's `--effort` flag accepts `xhigh` and `max` on every model, or what the
  installed CLI does with an unsupported one.
- The Codex CLI's actual handling of `-c model_reasoning_effort` or its valid values.
- The settings page's CSS and mobile layout for adding a second control per cell.
- The Agent-tool lane path in practice (only the protocol text).
- `machine/service.js` readiness, transcripts and stop routes after the +84-line change.
