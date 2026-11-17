---
slug: agents-activity
date: 2026-11-17
implemented-by: "standard: gpt-6.1-terra (medium) T1, T2, T3, T4, T5, T5b; light: gpt-6-luna T2b; standard: gpt-6.1-terra (high) T5c; sub-lead: claude-opus-5-5"
verified-by: []
---

# Completion Report — Agents screen: live activity, context ring, question path

Written for a hostile reviewer: every claim checkable, no claim without evidence.
Line numbers are against the feature branch `wc/eb5a9e5941a0` at the commit this report is
committed in. Prior Work was empty, so every row is `this run`.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| §1 step shape `{id, kind, label, key, started_at, ended_at, failed, clean}` | this run | `machine/adapters/claude.js:69` (Claude start/end), `machine/lib/codex-steps.js:52` (Codex), `viewer/app/sessions.js:54` (hub) | `machine/test/steps.test.js`, `machine/test/codex-steps.test.js`, `viewer/test/app-activity.test.js` |
| §1 classification table, both CLIs | this run | `machine/lib/steps.js:15` (`classify`) | `machine/test/steps.test.js` (table rows per CLI) |
| §1 labels (description, "Ran …" with `cd x &&` dropped, Read/Edited/Searched, apply_patch one vs N files, helpers, web, starter "Messaged <to>" / "Reported back", 80-char cut) | this run | `machine/lib/steps.js:4-5,15-41` | `machine/test/steps.test.js` |
| §1 "Failed: " prefix | this run | applied by the hub in `viewer/app/agents.js:14` (`activity`, `latest`) | `viewer/test/app-activity.test.js` "retention, parallel current, trail, failures and context" |
| §1/§9 no model call for labels | this run | no model call anywhere in `steps.js` / `codex-steps.js` | code read |
| §2 Claude: Pre/Post/PostFailure hooks, matcher `*`, `async: true` | this run | `machine/adapters/claude.js:60-61` | `machine/test/service.test.js:972` (exact settings deepEqual); live check below |
| §2 Claude: hookEvent mapping, receipt time, `is_interrupt` counts failed, no raw input leaves the machine | this run | `machine/adapters/claude.js:69-75` | `machine/test/steps.test.js:38-39`; live check below |
| §2 Codex: 2 s timer, `steps_offset`, complete lines only, skip unbound threads | this run | `machine/service.js:320` (timer), `machine/service.js:558-596` (`readCodexSteps`), bounded 8 MiB reads at `:574` | `machine/test/service.test.js:1254` and the T2b offset cases, `machine/test/codex-steps.test.js` |
| §2 Codex: polls never start steps; start/finish/yield/cut-short rules; `clean`; `failed` | this run | `machine/lib/codex-steps.js:38` (`outputInfo`, header-based after T2b), `:52-85` (`readLines`), yielded cut-short at `:71` | `machine/test/codex-steps.test.js` with real-rollout fixtures in `machine/test/fixtures/codex-steps/` (instant, wait, mixed, poll-chain, context) |
| §2 Codex: one step per script, kind/label/target from first `tools.<name>(`, " and more", "Ran a script" | this run | `machine/lib/codex-steps.js:15` (`scriptInfo`) | `machine/test/codex-steps.test.js` |
| §2 Codex turn end: flush reader before `turn-ended` | this run | `machine/service.js:892` | `machine/test/service.test.js:1254` "Codex rollout reads persist complete lines, serialize reads, and flush before turn end" |
| §2 Transport: step/context through hook → spool → drain → hub, `session`/`thread_id` added | this run | `machine/lib/hook-post.js:19` (array posting), `machine/service.js` `hook()` passthrough (unchanged `...rest`) | `machine/test/service.test.js` (passthrough + spool cases) |
| §3 Claude context: statusline 15 s `.context` throttle, rate-limit throttle unchanged, payload carries only due fields | this run | `machine/lib/statusline.js:17-28`, adapter `machine/adapters/claude.js:80` | `machine/test/service.test.js` / `accounts.test.js` statusline cases (`machine/test/steps.test.js`, `accounts.test.js`, `service.test.js`) |
| §3 Codex context from `token_count` | this run | `machine/lib/codex-steps.js:59` | `machine/test/codex-steps.test.js` (context fixture) |
| §3 Hub `session.context`, newer `at` wins | this run | `viewer/app/sessions.js:55` | `viewer/test/app-activity.test.js` |
| §4 step/context events don't touch turn/hold/delivery | this run | `viewer/app/sessions.js:495` | `viewer/test/app-activity.test.js` "events pair in either order … preserve turn and queue" |
| §4 retention: running + last 30 finished, 50-running cap | this run | `viewer/app/sessions.js:22` (`trimSteps`), cap in `activityEvent` | `viewer/test/app-activity.test.js` "retention …", "late starts … bounded running steps" |
| §4 order independence, `pending_ends` (≤50, 10 min), repeat start ignored | this run | `viewer/app/sessions.js:54-95` (pending at `:87`) | `viewer/test/app-activity.test.js` |
| §4 real end beats a closure; history exactly once | this run | `viewer/app/sessions.js` `activityEvent` end branch | `viewer/test/app-activity.test.js` "upgrade closure once" |
| §4 `session.turns` (last 20) and late-start rules | this run | `viewer/app/sessions.js:36` (`beginTurn`), start branch of `activityEvent` | `viewer/test/app-activity.test.js` "late starts …" |
| §4 close running steps at turn end / failure / limit / stop / disappear; `current` null when not live | this run | `viewer/app/sessions.js:45` (`endTurn`), calls at `:509` and following, `:663` (stop), `:724` (disappeared) | `viewer/test/app-activity.test.js` |
| §4 `step_counts` incl. thinking (≥5 s gaps) | this run | `viewer/app/sessions.js:33` (`countThinking`) | `viewer/test/app-activity.test.js` "thinking gaps …" |
| §4 history file per project (basename + 8 hex of SHA-256), clean steps only, prune at start and daily | this run | `viewer/app/step-history.js:9` (`file`), `:41` (`prune`), `viewer/app/hub.js:50-52` | `viewer/test/app-activity.test.js` "history median, isolation and pruning" |
| §4 API `context`, `activity {counts, trail, current, latest, normal}`; empty activity for step-less sessions | this run | `viewer/app/agents.js:14` (`activity`), `:129` (`normal`); raw `steps`/`pending_ends`/`turns`/`step_counts` stripped at `:77` | `viewer/test/app-activity.test.js`, `viewer/test/app-questions.test.js:59` (end-to-end `normal`) |
| §5 key definition | this run | `machine/lib/steps.js:10` (`keyFor`) | `machine/test/steps.test.js` |
| §5 `normal`: last five clean same-key rows in 30 days, median | this run | `viewer/app/step-history.js:34` | `viewer/test/app-activity.test.js` |
| §5 page wording table | this run | `viewer/pages/agents.js:32` (`normalPanel`) | `viewer/test/app-views.spec.js:175` ("That's expected.", "about 3 minutes the last two times", no-samples, longer-than-usual) |
| §6 card fields `asks`, `passes_on` (message), `passes_on` (question) | this run | `viewer/app/card.js:87,135` | `viewer/test/app-questions.test.js` |
| §6 `[question <id>]` tag in delivered text | this run | `viewer/app/cards.js:126` | `viewer/test/app-questions.test.js` |
| §6 `passes_on` refusal 422 | this run | `viewer/app/cards.js:62-63` (looks only in this thread's cards) | `viewer/test/app-questions.test.js` |
| §6 path, loop guard, node `question`, lead `question_paths` | this run | `viewer/app/agents.js:33` (`questionChain`), `:59` (`question` shape), `:73` (`question_paths`), `:76` | `viewer/test/app-questions.test.js` |
| §6 protocol text | this run | `protocol/app/worker.md:40`, `protocol/app/sub-lead.md:125`, `protocol/app/lead.md:295`, `protocol/app/cards.md:102,364,403` | `viewer/test/protocol-rules.test.js` still passes |
| §7 panel order: normal line / question trail, map, ring + key, Latest | this run | `viewer/pages/agents.js:45` (`activityPanel`), `:39` (`questionPanel`) | `viewer/test/app-views.spec.js:175`; desktop screenshot checked by the sub-lead |
| §7 map: six spots, starter label ("You" for a lead), widths 1–6px, counts ≥5, dotted trail, dashes, "now · m:ss" ticking | this run | `viewer/pages/agents.js:45-55`, timer `:104` (one interval, text-only updates), animation `viewer/pages/views.css` `.activity-flow` | `viewer/test/app-views.spec.js:175` |
| §7 reduced motion stops dashes, timer still ticks | this run | `viewer/pages/views.css:195` | `viewer/test/app-views.spec.js:175` (`emulateMedia`, `animation-name: none`, timer text changes) |
| §7 context ring colours, grey when null, title "Memory N% full" | this run | `viewer/pages/agents.js:52`, `viewer/pages/views.css` ring rules | `viewer/test/app-views.spec.js` (50/75/95, null) |
| §7 Latest: four rows, HH:MM, ●/✓/✕, "Nothing yet." | this run | `viewer/pages/agents.js:55` | `viewer/test/app-views.spec.js:175` |
| §7 tree amber path, skipped agent keeps edge, legend only when drawn | this run | desktop overlay `viewer/pages/agents.js:57` (`drawQuestionPaths`); phone list borders `:99` + `viewer/pages/views.css:176`; legend `views.css:214` | `viewer/test/app-views.spec.js:175` (desktop and phone); desktop and phone-tree screenshots checked by the sub-lead |
| §8 routers and contracts | this run | `machine/API.md`, `machine/AGENTS.md`, `viewer/app/API.md`, `viewer/AGENTS.md`, `protocol/app/cards.md` | diff (see Routers) |
| §9 validation commands | this run | — | Validation evidence below |
| §9 live check | this run (partial) | — | see Deviations and Validation evidence |

## Deviations from plan

1. **§9 live check done in two parts, not on the Agents screen.** The always-on viewer and machine services run the canonical clone's code, and the root AGENTS.md forbids `./install.sh` from a worktree, so this branch's code cannot drive the real Agents screen until it is merged. Instead:
   - Claude: a real `claude -p` (2.1.326, haiku) run with this branch's `machine/hook.sh` registered exactly as the adapter writes it (async Pre/Post/PostFailure, matcher `*`), spooling to a temp state dir. Every call produced a start and a matching end, with correct kinds, labels, keys and failure (output below).
   - Codex: `machine/lib/codex-steps.js` run read-only over a real rollout from `~/.codex/sessions` (output below).
   - Not done: the end-to-end latency bounds (steps on screen within 10 s, ring within 25 s). These need the merged code running in the services.
2. **Phone-width amber path colours a whole list border.** At phone width the tree's connector is the `.agents-children` left border, so the whole border is amber. That includes the stretch past siblings below the path (T5c; desktop draws exact connectors). Smaller than the design's precision; chosen over measuring an overlay, which was flaky in Firefox.
3. **Sub-minute typical durations** read "N seconds" (the Spec gives "about 3 minutes" only for minutes). Logged as a T5 choice.

Every other choice the workers made is logged in PLAN.md's Log, one line each.

## Routers

- `machine/AGENTS.md`: names `lib/steps.js` (shared classifier) and `lib/codex-steps.js` (rollout reader) and what each owns.
- `machine/API.md`: documents the `step` and `context` events the hooks and the Codex reader emit.
- `viewer/AGENTS.md`: file-table row for `app/step-history.js`.
- `viewer/app/API.md`: documents the `step`/`context` machine events, node `activity`, `context`, `question`, the lead's `question_paths`, and the new card fields.
- `protocol/app/cards.md`: `asks` / `passes_on` fields and the `[question <id>]` tag.

No ownership moved between directories.

## Validation evidence

All on the merged feature branch (commit 9b271dd plus this report), run sequentially, exit codes all 0.

`node --test viewer/test/*.test.js`
```
# tests 503
# pass 503
# fail 0
# cancelled 0
# skipped 0
```

`npm --prefix viewer run test:browser` (Chromium and Firefox)
```
  ✓  680 [firefox] › test/app-threads.spec.js:825:3 › working indicator › dots show under the chat and the list dot pulses while the lead is mid-turn (4.6s)

  8 skipped
  672 passed (3.0m)
```

`bash machine/test/run.sh`
```
# tests 131
# pass 131
# fail 0
```

`bash install/test/run.sh`
```
RESULT 187 passed, 0 failed
```

Live check, Claude Code 2.1.326 (`claude -p` with haiku in a temp project; hooks registered as the adapter writes them, pointing at this branch's `machine/hook.sh`; `WHEELCHAIR_STATE_DIR` a temp dir so events spooled). The spool held 6 events, shown in arrival order:
```
{"type":"step","phase":"start","step":{"id":"toolu_01GNbz99BNj8LWkcTtiXE5aG","kind":"files","label":"Read note.txt","key":"files:Read .","started_at":"2026-11-17T14:10:29.076Z"},"session":"live-test"}
{"type":"step","phase":"end","step":{"id":"toolu_01GNbz99BNj8LWkcTtiXE5aG","ended_at":"2026-11-17T14:10:29.183Z","failed":false,"clean":true},"session":"live-test"}
{"type":"step","phase":"start","step":{"id":"toolu_01EmD6Whg7C9KcMQ136Lv3x5","kind":"shell","label":"Wait two seconds","key":"shell:sleep 2","started_at":"2026-11-17T14:10:30.050Z"},"session":"live-test"}
{"type":"step","phase":"end","step":{"id":"toolu_01EmD6Whg7C9KcMQ136Lv3x5","ended_at":"2026-11-17T14:10:32.278Z","failed":false,"clean":true},"session":"live-test"}
{"type":"step","phase":"start","step":{"id":"toolu_01PcUwSNy87vszoJzuN5XbCz","kind":"shell","label":"Run the false command","key":"shell:false","started_at":"2026-11-17T14:10:32.897Z"},"session":"live-test"}
{"type":"step","phase":"end","step":{"id":"toolu_01PcUwSNy87vszoJzuN5XbCz","ended_at":"2026-11-17T14:10:33.015Z","failed":true,"clean":true},"session":"live-test"}
```
This confirms `async: true` hooks fire in 2.1.326, pairing by `tool_use_id`, receipt-time durations (the 2 s sleep measured 2.2 s), and failure.

Codex reader, read-only over the real rollout `~/.codex/sessions/2026/11/17/rollout-2026-11-17T04-53-49-01a1e992-….jsonl` (pre-T2b code; T2b changed only failure-text matching and the read path):
```
starts 13 ends 13 failed 1 unclean 4 context 16 last ctx {"percent":10,"at":"2026-11-17T12:55:54.154Z"}
{ shell: 13 }
shell | Ran cat /home/collin/projects/personal/wheelchair/protocol/app/verifier.md | shell:cat /home/collin/projects/personal/wheelchair/protocol/app/verifier.md
shell | Ran git rev-parse HEAD && git status --short && git show --stat 106be87 && cat … | shell:git rev-parse
shell | Ran a script and more | shell:script
```

Screenshots checked by the sub-lead: desktop panel and tree, phone panel, and phone tree (T5b and T5c, `AGENTS_SHOTS`).

## Known gaps / residual risks

- **End-to-end latency is unmeasured** until merge (Deviation 1).
- **Flaky test, not caused by this build:** `viewer/test/app-uploads-archive.test.js` "archive through the hub cancels a stalled upload" failed in 1 of 5 runs on T4's branch while other suites ran concurrently, and 0 of 3 on the feature branch. T4 touches no upload code. Under the same load, `app-quiet.test.js` once stalled for 20 minutes in a concurrent run, and it passes alone.
- **Event dedupe window:** the hub keeps the last 500 `delivery_id`s per thread. A busy thread can push more step events than that, so a very late spool redelivery may be processed twice. Repeat starts and second clean ends are ignored (§4), so the effect is nil for steps; a context reading would just be re-applied.
- **Thread file rewrites:** each step event saves the thread file (Decision 10 accepted this).
- **Question path stops at a repeated session name**, so a session relaying the same question twice shortens the drawn path (T4 choice).
- **A worker's `result` counts as answering a question** only when that worker was started by the asker (T4 choice).
- **Codex first turn** shows its steps only at turn end (Accepted Risk 1). A command left running when the agent moves on shows as finished then (Accepted Risk 4).
- **The 8 MiB no-newline window** is skipped, dropping that one oversized line (T2b).

## Remediation rounds
