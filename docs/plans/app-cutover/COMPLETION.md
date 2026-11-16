---
slug: app-cutover
date: 2026-11-15
implemented-by: "T1, T2: codex standard (gpt-6.1-terra); T3, T4, T5: claude standard (claude-sonnet-5-5); sub-lead: claude-opus-5-5"
verified-by: []
---

# Completion Report — Remove the old terminal workflow

Written for a hostile reviewer: every claim checkable, no claim without evidence. Nothing here
is pre-existing: the plan has no Prior Work section, so every row is `this run`.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| §1 `skills/` removed entirely (7 wrappers + router) | this run | `git ls-files skills` is empty (T1 commit `69b4f1a`) | `git ls-files skills codex/prompts seen` prints nothing |
| §1 `codex/prompts/` removed; `codex/AGENTS.md` kept for model.sh, preflight.sh, test/ with wrapper text gone | this run | `codex/AGENTS.md:1-30` | §5 grep 1 (no hits in codex/) |
| §1 `protocol/{planning,adopt,plan-review,implementation,verification,lanes,map,writing,seen}.md` and `protocol/templates/SEEN.md` removed | this run | T5 commit `349a454` | `ls protocol/` ; §5 grep 1 |
| §1 `seen/` removed entirely | this run | T1 commit `69b4f1a` | `git ls-files seen` empty |
| §1 install.sh stops rendering skills and prompts; keeps `codex/model.sh init` | this run | `install.sh:75-96` (no render loop; `model.sh init` at `:91`) | `install/test/run.sh:236-245` (claude_only, codex_only: no retired wrappers; pins created) |
| §1 root AGENTS.md loses the Harness adapter row and the wrapper rule | this run | `AGENTS.md:26-36` | read |
| §1 Kept files (graphs.md, diagrams.md, sensitivity.md, sensitivity/, model.sh, preflight.sh, protocol/app/, IDEA/PLAN/MAP/COMPLETION templates, viewer) | this run (untouched or edited, not removed) | `ls protocol/templates` → COMPLETION.md IDEA.md MAP.md PLAN.md | read |
| §2 Retired wrappers: 8 names → protocol files; any absolute root; foreign file kept; different protocol file kept; symlink only if it points into a wheelchair checkout; prints `removed old wrapper:` | this run | `install.sh:59-89` (`remove_retired` `:61`, lists `:75-76`) | `install/test/run.sh:255-287` (per-name this-clone and other-root removed both harnesses; foreign and different-file kept; `wrapper_links` symlink case) |
| §2 Seen hook: `install/unseen.py`, stdlib, NOTICE values and command shape copied from seen/set.sh; ownership test (this root, checkout holding protocol/seen.md or protocol/app/lead.md, or under app worktrees) | this run | `install/unseen.py:10` (NOTICE), `:23-31` (`is_wheelchair_script`), `:34-42` (exact 3-token command) | `install/test/run.sh:289-314` (seen_removed), `:315-320` (seen_foreign kept) |
| §2 Claude settings.json: handlers, emptied groups, emptied UserPromptSubmit/hooks dropped; wording permission dropped; lists kept as `[]` | this run | `install/unseen.py:45-91` | `install/test/run.sh:308-312` (parsed JSON otherwise equal) |
| §2 Write grants kept (D14); config.toml untouched | this run | `install/unseen.py` never opens config.toml or `sandbox`/`writable_roots` | `install/test/run.sh:313` (config.toml byte-identical); `:308` (allowWrite kept) |
| §2 Codex hooks.json: same handler and group rule | this run | `install/unseen.py:125-128` | `install/test/run.sh:292-312` |
| §2 Missing file skipped; malformed file untouched with a warning, install continues; no write when nothing to remove; temp file + rename | this run | `install/unseen.py:94-121`; `install.sh:113` (`|| echo` warning) | `install/test/run.sh:321-325` (seen_malformed), `:334-342` (second run changes no file) |
| §2 `seen/set.sh` call gone; prints `seen hook: removed` / `nothing to remove` | this run | `install.sh:110-113`; `install/unseen.py:130` | `install/test/run.sh:314`, `:341` |
| §2 Wording list on disk not deleted | this run | unseen.py never touches `~/.wheelchair` | `install/test/run.sh:572` (real `~/.wheelchair` guard) |
| §3 sensitivity.md: region "Move the dial on the wheelchair app's Settings page (Models, Diagrams)"; `ask` carve-out → `protocol/app/lead.md` (Diagrams); intro reworded; "Moving the dial" section; `/graph` bullet gone | this run | `protocol/sensitivity.md:4`, `:25`, `:32-33`, `:94-98` | `sensitivity/test/run.sh` (66 pass) |
| §3 lead.md Diagrams gains proposed-flow trigger (plan dir exists; every level incl. ask; arrangement choices only above ask, own file) | this run | `protocol/app/lead.md:404-415` | read; `viewer/test/protocol-rules.test.js` (15 pass) |
| §3 sensitivity tests updated | this run | `sensitivity/test/run.sh` (probes reworded; `--json` cases) | 66 pass |
| §3 Machine `GET /v1/diagram-sensitivity` and `POST` (400, 422 last stderr line, 409, 30 s timeout), hub auth; `--json` added to `set.sh --report` | this run | `machine/service.js:1013-1035`; `sensitivity/set.sh:42`; `machine/API.md:26-27` | `machine/test/sensitivity.test.js:10-45` (401, report, 400, set, 422, 409, report failure 422) |
| §3 Hub `GET /settings/diagram-sensitivity` and `POST` (parallel, 5 s each, "did not answer", 200/502 map, 400), separate from `GET /settings`, stores nothing | this run | `viewer/app/diagram-sensitivity.js:1-51`; `viewer/app/routes.js:151-154`; `viewer/app/API.md:49-50` | `viewer/test/app-diagram-sensitivity.test.js:49,66,78,93` |
| §3 Settings "Diagrams" section after Threads on Models; three choices with the Spec's lines; D16 selection and per-machine note; save at once, success note, 502 per-machine lines, re-pick retries, re-read after | this run | `viewer/pages/settings.js:91-140`, `:433`; `viewer/pages/settings.css` | `viewer/test/app-diagram-sensitivity.spec.js:39,52,68,75,85` (both browsers) |
| §3 `api()` attaches parsed failure body | this run | `viewer/pages/settings.js:69` | spec `:85` (502 lines come from the body) |
| §4 Right column: pictures deduplicated by plan + graph + .html/.json, latest card wins, same-tab picture-page links | this run | `viewer/pages/thread.js:178-205`; `viewer/pages/diagram.js:27` (`fileKey`) | `viewer/test/app-pictures.spec.js:29` |
| §4 Diagram card keeps inline picture; "Open full size" for all three formats, same tab | this run | `viewer/pages/thread.js:621-627` | `viewer/test/app-pictures.spec.js:48`; `viewer/test/app-threads.spec.js` (updated assertions) |
| §4 Aside graphs: `brief` gains `graphs:[{entry,path}]`; listed after cards as "Aside: <40 chars>"; aside panel link "Open full size" to picture page; signature includes them | this run | `viewer/app/asides.js:9-14`; `viewer/pages/thread.js:187-193`, `:818`; `viewer/pages/aside.js:57`; `viewer/app/API.md:87` | `viewer/test/app-asides.test.js:494`; `viewer/test/app-pictures.spec.js:56` |
| §4 Phones: header strip lists the same picture links after plan files | this run | `viewer/pages/thread.js:196-198` | `viewer/test/app-pictures.spec.js:92` |
| §4 Picture page `?thread&card` and `?thread&aside&entry`; Back to thread; same rendering as the card (shared script); unknown → message + back link; `picture` in APP_PAGES | this run | `viewer/pages/picture.html`, `viewer/pages/picture.js:1-59`, `viewer/pages/diagram.js:1-81`; `viewer/server.js:1700` | `viewer/test/app-pages.test.js:100`; `viewer/test/app-pictures.spec.js:29,78` |
| §5 References reworded: cards.md, protocol/app/AGENTS.md, AGENTS.md, protocol/AGENTS.md, codex/AGENTS.md, graphs.md, diagrams.md, templates/PLAN.md, README.md, CONTRIBUTING.md, known-issues.md, install.sh header and output | this run | `protocol/app/cards.md:218-220`; `protocol/app/AGENTS.md:24-26`; `protocol/graphs.md:3-8`; `install.sh:1-3` | §5 grep 1 and 2 below |
| §6 Routers true after the change | this run | see Routers | read |
| §7 install tests: wrapper-landed helpers gone; no-retired-wrapper asserts; inverted foreign mention; all retired names; seen_removed; malformed; both_idempotent | this run | `install/test/run.sh:48` (`no_retired_wrappers`), `:236-342` | 124 pass |
| §7 machine, viewer node and browser tests for both routes and the picture page | this run | rows above | output below |

## Deviations from plan

- `install/test/run.sh`: the guard that the real `~/.wheelchair` is byte-identical after the
  suite now skips `accounts/*/tmp/` (`install/test/run.sh:26-29`). Live Codex sessions (the
  build's own workers) write scratch files there during a run, which failed the guard for a
  reason unrelated to the installer. Everything else in `~/.wheelchair` stays guarded.
- `sensitivity/set.sh --report --json` was added (the Spec allowed it). The machine's GET runs
  both `--json` and the plain `--report` to fill `text`.
- No other deviations.

## Routers

- `AGENTS.md` (root): the four-kinds table is three (Harness adapter row gone); the seen
  "second reach" paragraph and the wrapper rule are gone; `skills/` and `seen/` rows gone;
  `codex/` row names model.sh, preflight.sh, test/; `install/` row adds `unseen.py`;
  `install.sh` row describes removal instead of rendering; verification list drops
  `seen/test/run.sh`.
- `protocol/AGENTS.md`: says the old stage files and SEEN.md template are gone (`:19`).
- `codex/AGENTS.md`: the GPT model pins and Codex login only.
- `protocol/app/AGENTS.md`: the wording hook is gone; leads follow the Settings style.
- `sensitivity/AGENTS.md`: the writer is also run by the machine service's routes (`:5`).
- `machine/API.md`, `viewer/app/API.md`: the new routes and `brief`'s `graphs`.

## Validation evidence

Run on the integrated feature branch (after all five merges and the API.md integration):

```
$ bash sensitivity/test/run.sh        → RESULT 66 passed, 0 failed (exit 0)
$ bash codex/test/run.sh              → RESULT 78 passed, 0 failed (exit 0)
$ bash install/test/run.sh            → RESULT 124 passed, 0 failed (exit 0)
$ bash machine/test/run.sh            → # pass 104  # fail 0 (exit 0)
$ node --test test-support/test/*.test.js → # pass 9  # fail 0 (exit 0)
$ node --test viewer/test/*.test.js   → # pass 438  # fail 1
    not ok 309 - a starter that loses the freed port registers through the new holder
$ npm --prefix viewer run test:browser → 617 passed, 9 failed, 2 skipped
    8 × app-accounts.spec.js "lead waiting line" (chromium + firefox)
    1 × [firefox] browser.spec.js:230 edge label background width
```

The failures are not this change's:

```
# lifecycle on the main clone (657f3a2), without this branch:
$ node --test viewer/test/lifecycle.test.js
not ok 31 - a starter that loses the freed port registers through the new holder
# pass 30  # fail 1

# app-accounts "lead waiting line" on the main clone:
$ npx playwright test test/app-accounts.spec.js -g "lead waiting line"
  8 failed  2 passed   (expect(locator).toHaveText … date text)

# edge-label width, re-run on this branch:
$ npx playwright test test/browser.spec.js --project=firefox -g "edge label background"
  1 passed
```

Spec §5 check 1 (gating):

```
$ git grep -nE 'protocol/(planning|…|seen)\.md|seen/(hook|set|wording)\.sh|wording hook|skills/|codex/prompts' -- ':!docs/plans' ':!docs/proposals' ':!docs/maps'
install.sh:81,82,86                 — retired-wrapper removal (deliberate)
install/test/run.sh:51,263,270,276,282,283,285,287,296,299,317 — fixtures and asserts for removal (deliberate)
protocol/app/AGENTS.md:25           — "The per-turn wording hook is gone." (states removal)
```

`install/unseen.py` matches `/seen/` only through a regex and suffix, so it has no hit for this
pattern; it is the removal script by design.

Spec §5 check 2 (advisory, markdown): the only hits are kept HTTP routes —
`protocol/graphs.md:771`, `:819` and `viewer/AGENTS.md:44` (`PUT /graph`).

`./install.sh && ./install.sh` with `git status --porcelain` empty is for Collin to run from the
canonical clone after merge; `install/test/run.sh`'s `both_idempotent` case is the in-worktree
proof.

## Known gaps / residual risks

- Accepted risk (plan): a seen hook entry from a wheelchair clone deleted from outside the
  app's worktrees folder is not removed.
- `install/unseen.py:18` keeps an unused `canonical_group` copied from seen/set.sh, as a
  record of the command shape.
- A picture page for an aside graph in an archived thread points the viewer at the
  graph's original path, which may be gone with the worktree; the Spec does not cover
  archived aside graphs.
- The idempotence case starts from an empty home. A second run over a seeded seen hook is
  not tested separately; unseen.py writes only when `clean()` reports a change
  (`install/unseen.py:104`).
- The browser and node viewer suites need `viewer/node_modules`; worktrees have none, so
  they were run through a symlink to the main clone's (untracked).

## Remediation rounds

### Remediation 1 — 2026-11-15

Attempt 1 at `70f4b99`: Claude verifier PASS, GPT verifier FAIL with two gaps
(`REMEDIATION-1.md`). Both fixed on GPT standard (gpt-6.1-terra), the provider that built them.

| Gap | Fix | Validated by |
|-----|-----|--------------|
| §3: `--json` reported a shared level while one present file had no block, so Settings selected it | `sensitivity/set.sh:128-129` (a present file without a valid block sets `disagree`, so `level` is null); `protocol/sensitivity.md:89` no longer says "after the wrappers" | `sensitivity/test/run.sh` new case (Claude `ask`, Codex no block → `level:null`); 67 passed |
| §2: retired-wrapper match accepted a relative path | `install.sh:66` requires the path's leading `/` at line start or after whitespace, a backtick, a quote or `(` | `install/test/run.sh` relative-path wrapper kept and quoted absolute path removed, both harnesses; 156 passed |

The residual-risk line about relative paths above was removed: that gap is fixed.

Re-run on the merged branch:

```
$ bash sensitivity/test/run.sh  → RESULT 67 passed, 0 failed
$ bash install/test/run.sh      → RESULT 156 passed, 0 failed
$ bash machine/test/run.sh      → # pass 104  # fail 0
$ bash codex/test/run.sh        → RESULT 78 passed, 0 failed
```

The viewer suites were not re-run: neither fix touches `viewer/`.

### Remediation 2 — 2026-11-16

Attempt 2 at `9a60588`: Claude verifier PASS, GPT verifier FAIL with one gap
(`REMEDIATION-2.md`): a wrapper rendered from a checkout path containing a space survived.
A new case in the same check as Remediation 1's second gap, not that gap surviving its fix.

| Item | Fix | Validated by |
|------|-----|--------------|
| §2 gap: spaces in the checkout path | `install.sh:66` matches the line shape wheelchair rendered: `^Read`, optional backtick, an absolute path (spaces allowed), `/protocol/<file>.md`, then a backtick, whitespace or end of line (D4) | `install/test/run.sh` `spaced` and `spaced_quoted` removed for both harnesses, `mid_line` kept, `current` and `quoted` use the real Codex and Claude shapes; 180 passed (GPT standard, gpt-6.1-terra) |
| Claude verifier's note: a failed hub start hung the node suite | `viewer/test/app-diagram-sensitivity.test.js:42-49` starts the hub inside the `try`; `finally` stops the hub if started and every fake machine | file alone 4/4 (Claude light, claude-haiku-5-5) |

Re-run on the merged branch:

```
$ bash sensitivity/test/run.sh  → RESULT 67 passed, 0 failed
$ bash codex/test/run.sh        → RESULT 78 passed, 0 failed
$ bash install/test/run.sh      → RESULT 180 passed, 0 failed
$ bash machine/test/run.sh      → # pass 104  # fail 0
$ node --test test-support/test/*.test.js → # pass 9  # fail 0
$ node --test viewer/test/*.test.js → # pass 437  # fail 2
    not ok - a starter that loses the freed port registers through the new holder   (also fails on main)
    not ok - the global write lock serializes concurrent writes and retry retains both changes
$ node --test viewer/test/server.test.js → # pass 49  # fail 0   (the second failure does not repeat alone)
```

The browser suite was not re-run: no browser-facing file changed since attempt 2, where the
Claude verifier ran it at 626 passed, 0 failed.
