---
slug: arriving-cold
---

# How this works today

The current system, before any of this plan's changes. Written before planning starts and
extended as questions dig deeper.

## End to end

```
you type
   │
   ├── a stage command → wrapper points at one protocol/ file → agent reads it
   │                        │
   │                        ├── does the stage's work: lanes you never see
   │                        │      (2 reviewers × up to 3 rounds, workers, verifiers)
   │                        │
   │                        └── composes one turn under writing.md → sends → you read it
   │
   └── an ordinary turn → no wheelchair code runs
                             │
                             └── the only rule in the window is the rendered
                                 diagram-sensitivity region → answers → you read it

nothing on either path records what you were shown

  ── but both harnesses ship an unused hook engine that fires on every turn ──
      user_prompt_submit  (before the agent composes; can inject context)
      stop                (after the turn lands; gets the transcript path)
```

## What happens

1. **There are two kinds of turn, and only one of them runs any wheelchair code.** A stage
   turn — `/plan`, `/plan-review`, `/implement`, `/verify` — invokes a wrapper that is a
   pointer to exactly one `protocol/` file and nothing else (`skills/plan/SKILL.md`, and the
   rule that keeps it that way at `AGENTS.md`'s "A wrapper carries no content"). An ordinary
   conversation turn invokes nothing.

2. **One wheelchair rule reaches an ordinary turn, and the repo treats it as a deliberate
   one-off.** `protocol/sensitivity.md:20-49` is a delimited region that
   `sensitivity/set.sh` renders into each present harness's global instruction file, because
   the dial "has to be in effect *before* Collin types" (`protocol/sensitivity.md:8-12`). The
   root `AGENTS.md` names this the one thing that breaks the layout on purpose and says
   anything else wanting to live in a context window belongs in `protocol/`. Both harnesses
   are present here (`codex` and `claude` both resolve on `PATH`), and both installed copies
   read `diagram-sensitivity: high` (`~/.codex/AGENTS.md:67`, `~/.claude/CLAUDE.md:302`).

3. **Both harnesses also ship a hook engine, and wheelchair uses neither.** The Codex binary
   carries a `codex_hooks` crate with an engine, a dispatcher and a per-event module set
   (`hooks/src/engine/dispatcher.rs`, `hooks/src/events/stop.rs`, `.../user_prompt_submit.rs`,
   `.../pre_tool_use.rs`, `.../compact.rs`, `.../interrupt.rs`, all in `/usr/bin/codex`'s
   string table). Its event set is `pre_tool_use`, `permission_request`, `post_tool_use`,
   `pre_compact`, `post_compact`, `session_start`, `session_end`, `user_prompt_submit`,
   `subagent_start`, `subagent_stop`, plus `Stop` and `Interrupt`. Each hook is handed
   `session_id`, `turn_id`, `agent_type`, `transcript_path`, `hook_event_name`, `model` and
   `permission_mode`; a `user_prompt_submit` hook answers with
   `hookSpecificOutput.additionalContext`, and the shared output wire also carries
   `systemMessage`, `decision`, `stopReason` and `suppressOutput`. Config entries carry
   `matcher`, `hooks`, `command`, `timeoutSec` and `async`, and live in `hooks.json` —
   `~/.codex/hooks.json` for the user, `.codex/hooks` for a project, plus a plugin path.
   Claude Code's hook system uses the same event names and the same
   `hookSpecificOutput.additionalContext` channel. **Neither is configured on this machine:**
   `~/.codex/hooks.json` does not exist, and `~/.claude/settings.json` holds no `hooks` key.

   **Claude Code's side is verified end to end.** A project-scoped
   `.claude/settings.json` declaring a `UserPromptSubmit` command hook fired on a
   `claude -p` run; the hook received JSON on stdin carrying `session_id`,
   `transcript_path`, `cwd`, `prompt_id`, `permission_mode`, `hook_event_name` and
   `prompt` — the user's message text, so the check does not have to parse the transcript
   to know what was just asked — and the `hookSpecificOutput.additionalContext` it returned
   reached the model, which answered out of it. Project scope means no change to the user's
   global config was needed.

   **Codex's side is verified too, and an earlier reading in this map was wrong.** Codex
   hooks are documented at `https://learn.chatgpt.com/docs/hooks` (reached via
   `https://developers.openai.com/codex/hooks`). Config is JSON — `~/.codex/hooks.json` or
   `<repo>/.codex/hooks.json`, or inline `[hooks]` tables in either `config.toml` — in the
   same shape Claude Code uses. A user-level `UserPromptSubmit` hook fired on a headless
   `codex exec` run and its `additionalContext` reached the model, in a clean directory where
   the injected word appeared nowhere on disk. The hook received `session_id`, `turn_id`,
   `transcript_path`, `cwd`, `hook_event_name` and `model`. The test file was removed from
   the home directory afterwards.

   The earlier failure was **project scope**, not Codex: project-local hooks load only when
   the project `.codex/` layer is trusted, and `--dangerously-bypass-hook-trust` covers hook
   trust rather than layer trust. `struct HooksToml` in the binary is the inline-`config.toml`
   path, not a replacement for the JSON file.

   **The documentation warns that the transcript format is not a stable interface for
   hooks** and directs hooks at the wire-format schemas instead. Claude Code's reference
   carries the equivalent caution and points `Stop` hooks at `last_assistant_message`.

4. **A stage does rounds of work you never see.** Stage 2 launches two independent reviewers
   per round, each fresh-context and handed only the plan path, never the conversation
   (`protocol/plan-review.md:35-40`), and runs up to three triaged rounds before it must
   escalate (`:164`). What reaches you is a summary the lead composes after triage
   (`:147-150`). Stage 3 and Stage 4 have the same shape with worker and verifier lanes.

5. **Every lane the protocol knows about is blocking.** A GPT lane is `codex exec`, headless,
   captured through `-o` (`protocol/lanes.md:28-36`); a Claude lane is the Agent tool or
   `claude -p` (`:127-130`). Nothing in the protocol runs a lane that is not waited on. A
   hook is the first thing here that could run one off the turn's critical path — the config
   carries an `async` flag (item 3).

6. **Nothing records what you were shown.** `docs/plans/<slug>/` holds `MAP.md`, `IDEA.md`,
   `PLAN.md`, `COMPLETION.md`, `REMEDIATION-N.md` and `graphs/`. Every one of them is about
   the work. None is about the reader.

7. **The gap is currently closed with standing prose rules, in six places.**
   `protocol/planning.md:118` opens the question-writing section with "the user has not
   memorized this conversation and does not have the codebase in their head — write every
   turn for someone arriving cold." `protocol/writing.md:66-77` makes re-grounding every
   coined label on first use a standing rule, on the stated premise that "the reader arrives
   cold: days away, other work in between, none of it loaded." Five stage documents point
   user-facing text at that file: `protocol/map.md:48`, `protocol/adopt.md:76`,
   `protocol/plan-review.md:147`, `protocol/implementation.md:20-22`,
   `protocol/verification.md:103`.

8. **Those rules ask for a judgment that needs a fact nothing supplies.** The agent composing
   the turn holds its own context, in which the review rounds, the map build and the worker
   output are all equally present. It has no way to separate what it saw from what you saw,
   so "re-ground on first use" gets applied against its own sense of what is established.
   This is the failure the plan is about, and it is not a wording defect in any of the six
   rules above.

9. **Resume is defined by the session boundary, not by you.** `protocol/planning.md:25-27`
   defines the resume path — read the three documents, give a 2–3 sentence state summary,
   continue at the first open question — and it fires when a *new session* starts on an
   existing slug. A long gap inside one session is not a resume to any code here.

10. **Graph verdicts are the one place your state is already recorded, and they record it per
    entry.** Every node and edge carries `origin` — `proposed`, `agreed`, `rejected`
    (`protocol/graphs.md:571-577`) — and a reset writes `was: "agreed"` specifically because
    "the graph file is the state and the conversation is disposable," so a report living only
    in a turn leaves a resumed session unable to tell a fresh reset from something nobody has
    ever ruled on (`:582-586`). That is the closest existing precedent for what this plan
    needs, and it is scoped to one graph, not to a session.

## What matters for this change

- **The hook engine changes what is reachable.** `user_prompt_submit` fires on every turn in
  both harnesses, ordinary or stage, which means none of this has to be stage-only.
  `additionalContext` puts text into one turn without touching any standing instruction —
  the exact distinction between per-turn evidence and another prompt revision. And `Stop`
  runs after the turn lands and is handed `transcript_path`, so the record can be updated
  off the critical path rather than inside the turn.
- **That also removes the cost objection to auditing before a turn is written.** Because
  `user_prompt_submit` runs before the agent composes rather than after it drafts, the check
  is not a review of a draft and adds no mid-turn round-trip.
- **But it opens a third kind of reach outside the clone, and the existing one is careful.**
  `install.sh` today renders wrappers and one delimited region, and
  `protocol/sensitivity.md:85-89` gives that region a hard contract: duplicated or malformed
  markers refuse without touching anything, the write across present files is all-or-nothing,
  and content between the markers is this repo's and overwritten every run. Hooks live in
  `~/.claude/settings.json` and `~/.codex/hooks.json` — JSON files the user owns, with no
  marker convention and no analogue of that contract.
- **Per-plan state has a home; cross-plan state has none.** Everything under
  `docs/plans/<slug>/` is scoped to one feature in one repo, and the only thing in this
  repository that writes outside the clone is `sensitivity/set.sh`. A record of wording that
  has landed badly is neither per-plan nor per-repo.

## Problems found

- **The repo's copy of the dial's level is not the live level, and reading it will mislead
  you.** `protocol/sensitivity.md:23` says `default`; both installed copies say `high`. That
  is by design — the writer resolves the level from the present files, not from the repo
  (`protocol/sensitivity.md:72-83`) — but it means the region in the repo is a template whose
  level line is inert, and nothing says so at the point someone would read it. Worth knowing
  before this plan proposes writing a second thing into the same harness homes.

## Not checked

- **How project-scoped trust is granted on Codex.** User scope is verified; project scope
  was never made to work, and the documented precondition (a trusted `.codex/` layer) was not
  satisfied by the config override that was tried. Only matters if this feature ever wants
  project-scoped hooks, which nothing currently proposes.
- **The `Stop` event on either harness.** Only `UserPromptSubmit` was fired. `Stop` is
  documented on both and was not exercised, including whether its payload carries
  `last_assistant_message` and whether an `async` hook's completion is observable.
- Whether a `user_prompt_submit` hook's injected context is visible to the user, counted
  against the context window, or cached — on either harness. The Claude run confirmed the
  model *received* it; nothing beyond that was observed.
- `viewer/` — `server.js` and `index.html`. The feature does not obviously touch the viewer,
  but I have not confirmed that.
- `protocol/implementation.md` and `protocol/verification.md` beyond the lines pointing at
  `writing.md`; I have not read either stage's full loop. `protocol/adopt.md` likewise, and
  `protocol/spine.md`, `protocol/routers.md`, `protocol/diagrams.md` not at all.
- `sensitivity/set.sh` itself. Everything above about the writer comes from
  `protocol/sensitivity.md`, not from reading the script.
- `install.sh`, and the three fixture suites under `spine/test/`, `sensitivity/test/`,
  `install/test/`.
