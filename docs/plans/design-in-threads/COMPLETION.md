---
slug: design-in-threads
date: 2026-11-23
implemented-by: "gpt standard / gpt-6.1-terra (T1, T3, T4); gpt light / gpt-6-luna (T5); claude standard / claude-sonnet-5-5 (T2); sub-lead claude-opus-5-5 (small follow-up edits, logged in PLAN.md)"
verified-by: []   # Stage 4 appends; Stage 3 leaves this empty.
---

# Completion Report — Design work inside a thread

Written for a hostile reviewer: every claim checkable, no claim without evidence.
Line numbers are at commit `d064ee6c` (plus this report's commit).

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| Mockup files: one static HTML file per screen/state/size at `graphs/mockup-<name>.html`, 200–2560, at most 2 MiB, new versions as new files | this run | rules: `protocol/app/designer.md:25-35`, `protocol/app/cards-lead.md:189-192`; size limits enforced by the card checks below | `viewer/test/app-mockup-cards.test.js` |
| `card.js` checks a mockup diagram's file exists under the plan's `graphs/` and is ≤ 2 MiB before posting | this run | `viewer/app/card.js:322-330` | `app-mockup-cards.test.js:29` ("CLI checks mockup files before asking for a token") |
| Hub checks `image.mockup` against the thread's plan (slug discovered without a nested save, set in the same update, plan registered; refused when no plan) | this run | `viewer/app/cards.js:92-108` | `app-mockup-cards.test.js:40` (discovers and stores the slug, refuses an over-2 MiB file, 5 s timeout guards against a deadlock) |
| `diagram` `format: "mockup"` with `width`/`height` 200–2560, required for mockup, refused for other formats | this run | `viewer/app/card.js:169,218` | `app-mockup-cards.test.js:13` |
| Mockup in the thread: iframe at true size, scaled to card width (never above 1), box height = height × scale, rescales on resize, thin border at the screen edge | this run | `viewer/pages/diagram.js:70-90`, `viewer/pages/thread.css:349-350` | `viewer/test/app-mockups.spec.js:33` (phone 390 and laptop 1280 widths, Chromium and Firefox) |
| "Open full size" draws the mockup at true size in a scrolling container, never downloads in its place; Download link kept | this run | `viewer/pages/picture.js:64-80`, `viewer/pages/picture.css:12` | `app-mockups.spec.js:61` |
| Archived threads load mockup files like `html` | this run | `viewer/pages/diagram.js:14-20` (same `diagram-html` sources) | shared code path with `html`; existing archived-html tests in `app-diagrams-uploads.spec.js` |
| `image` with `mockup`: Built and Mockup halves, side by side, stacked under 599px (Built first), each with Open full size; picture page accepts `?card=<image id>` | this run | `viewer/pages/thread.js:1215-1236`, `viewer/pages/thread.css:351-360`, `viewer/pages/picture.js:64-80` | `app-mockups.spec.js:79,102,110,123` |
| `image` posted by `lead` and `sub-lead` only | this run | `viewer/app/card.js` roles (`image: ['lead', 'sub-lead']`) | `app-mockup-cards.test.js:13` (sub-lead accepted; worker and designer refused) |
| Archive keeps `image`/`file` uploads posted by sub-leads | this run | `viewer/app/threads.js:219-220` | `viewer/test/app-kept-files.test.js:7` |
| Image section moved to `cards.md`; kind table `lead, sub-lead`; sub-lead may post `image` | this run | `protocol/app/cards.md:57,112-127`; `protocol/app/sub-lead.md:5-6` | `viewer/test/protocol-rules.test.js` (kind sections per file; "sub-lead posts screenshots as image cards") |
| `designer` role plumbing: session role, lead-only start, thread worktree/branch, Other agents tier, role card files, quiet watch, Settings and Agents pages, lesson lists, machine role cards; no provider flags | this run | `viewer/app/sessions.js:131,138,766-769`; `viewer/app/balancer.js:14`; `viewer/app/settings.js:13,19,55,188,194,281`; `viewer/app/routes.js:403`; `viewer/app/quiet.js:3`; `viewer/pages/settings.js:29,616,844,1767`; `viewer/pages/agents.js:57`; `viewer/pages/thread.js:3`; `machine/service.js:195`; `viewer/app/card.js` (designer may post `message`/`result`; lessons may be saved for it) | `viewer/test/app-balancer.test.js:30-41,110` (lead starts it in the thread worktree; sub-lead refused 403; provider flags refused); `machine/test/service.test.js:872-885` (prompt has `designer.md` and `cards.md`, no `realism.md`); `viewer/test/app-settings.test.js:29-33` (default `standard`, held back, older files migrated); `app-lessons.test.js:168` |
| Designer rules (`protocol/app/designer.md`): brief contents, writes only `mockup-*.html`, never overwrites, matches the project's look, self-check with headless Chromium or says none, `result` task `mockups`, waits for revisions, never talks to the user, saves no lessons | this run | `protocol/app/designer.md` (whole file; Mockups at :25) | `protocol-rules.test.js` (own commands, blocked not silent, foreground waiting, pointer fallback with `cards.md`, no `realism.md`) |
| Lead rules: when to start a designer, posting one mockup card per file, verbatim feedback with attachments, "Agree the mockups" gate, changes during review/after approval (retract approval, back to `planning`), changes after Start building (stub at once), designer dies, lead restart, recording under "Mockups" | this run | `protocol/app/lead.md:62,69-75,89-91,830-858,869-888,983,993` | read against the Spec (no test suite for protocol prose beyond `protocol-rules.test.js`) |
| PLAN template: visible work lists agreed mockups under "Mockups" | this run | `protocol/templates/PLAN.md:46` | — |
| Worker: build to match the owned parts, screenshot at the mockup size, render and compare, fallback, list paths; visible work with no mockup still reports a screenshot | this run | `protocol/app/worker.md:51-62` | — |
| Sub-lead: briefs name mockups and owned parts; unexplained difference is a send-back; post one `image` card per screenshot before merging, titled with task and parts; no relay to the lead | this run | `protocol/app/sub-lead.md:5-6,62,180-185,253` | `protocol-rules.test.js` |
| Verifier: each Spec mockup is a Spec item; gap bar; names screenshot paths; no capture path is not a gap, named after the verdict | this run | `protocol/app/verifier.md:52-57` | — |
| Router updated for the new role file | this run | `protocol/app/AGENTS.md:13,20` | — |

## Deviations from plan

- **Verifier screenshots** (Spec: the sub-lead's relay sentence is "replaced by the posting rule"): the sub-lead also posts verifier-reported screenshots as `image` cards (`protocol/app/sub-lead.md:253`), so they still reach the thread. Logged as a Choice in PLAN.md.
- **Side by side on a laptop**: thread cards are about 535px wide in a 1280px window, so the Spec's "under 599px card width they stack" means Built and Mockup stack on a typical laptop and sit side by side only in windows wider than about 1700px. Built as specified; logged as a Choice.
- **Verifier mockup rule placement**: it sits under "How to check", so steps-only checks (the after-done check for the user) do not compare mockups. The Spec is silent on steps-only.
- `held_back` validation in `PUT /settings/balancing` now requires the `designer` key along with the other four (the Settings page always sends all five; older saved files are migrated, `viewer/app/settings.js:281`).

## Routers

`protocol/app/AGENTS.md` lists `designer.md` and adds designer to the `cards.md` readers (:13, :20). `viewer/app/API.md` documents the `mockup` format, `image.mockup`, image cards from sub-leads, the archive keep rule, and designer in the Other agents and `held_back` sentences. No other ownership moved.

## Validation evidence

At `d064ee6c`, in the feature worktree:

```text
$ node --test viewer/test/*.test.js; echo "exit $?"
# tests 911
# pass 911
# fail 0
exit 0

$ npm --prefix viewer run test:browser; echo "exit $?"
  34 skipped
  1420 passed (17.5m)
exit 0

$ bash machine/test/run.sh; echo "exit $?"
not ok 654 - existing copy remains waiting until a post-start reconcile completes
not ok 655 - failed readying becomes ready after a later successful sync
not ok 671 .. 684, 687, 689  (Windows bridge copy tests)
# pass 669
# fail 18
exit 1
```

The 18 machine failures are all `wslpath failed: Error: spawnSync wslpath ENOENT` (`machine/test/win.test.js` 16, `machine/test/win-tool-ready.test.js` 2): this Linux machine has no `wslpath`. The same 18 fail on the feature branch before any of this build's code was merged (run at `2ec70022`, before the designer role was merged), and every other machine test passes. No machine file this build changed (`machine/service.js:195` and role lists in tests) is involved.

A first full machine run hung at the Windows bridge proxy tests while the browser suite ran alongside it; its leftover processes held a test server. After stopping them, the run above completed. Every machine test file also passes on its own except the two `wslpath` files.

Focused: `npm --prefix viewer run test:browser -- app-mockups.spec.js app-pictures.spec.js app-diagrams-uploads.spec.js` → 34 passed. `node --test viewer/test/protocol-rules.test.js` → 44 pass, 0 fail.

## Known gaps / residual risks

- Untested refusal paths in the hub's `image.mockup` check: thread with no plan (422), missing file, symlink outside `graphs/` (`viewer/app/cards.js:94-106`). The code paths exist; the over-2 MiB and discovered-slug paths are tested.
- The CLI's mockup check (`viewer/app/card.js:322-330`) does not reject `..` in `plan`/`graph`; the hub's checks and the server's existing containment check still apply.
- Mockups on threads whose worktree is on another machine do not load (same as every diagram card today; Spec "Not in this thread").
- The full viewer node suite has timing tests that occasionally fail under load (`server.test.js:579`, "register-plan has a two-second no-server grace"); they passed on rerun and are not in files this build changed.
- Some new protocol lines are longer than the files' usual wrap width (cosmetic).
- The machine test mocks' card permission tables do not list designer; no test posts a designer card through them.

## Remediation rounds

### Remediation 1

Verification attempt 1 at `484dfcac`: Claude verifier PASS; GPT verifier FAIL with 5 gaps (`REMEDIATION-1.md`). One rare path went to Accepted Risks (CLI mockup check containment); "Built Open full size" was deferred as D3 at the lead's answer. Fixed:

| Gap | Fix (file:line) | Lane | Validated by |
|-----|-----------------|------|--------------|
| Full-size mockup viewport 2px short | `viewer/pages/picture.css:12` (`box-sizing: content-box`) | claude standard / claude-sonnet-5-5 (R1) | `viewer/test/app-mockups.spec.js` (iframe `clientWidth`/`clientHeight` exactly 390/844) |
| Built and Mockup stacked at a 623px card | `viewer/pages/thread.css:358-359` (query 563.98px inner = 599px card) | claude standard / claude-sonnet-5-5 (R1) | `app-mockups.spec.js` (card measured 600-640px side by side; under 599px stacked) |
| Revising designer shown finished and not nudged | `viewer/app/sessions.js:540` (a starter's message delivered to a finished designer reopens it) | gpt standard / gpt-6.1-terra (R2) | `viewer/test/app-designer-revision.test.js` (designer reopens, status keeps reply debt, result finishes; other senders and mappers unchanged) |

Validation after remediation (feature branch at `cefd4240`):

```text
$ node --test viewer/test/*.test.js
# pass 913
# fail 1        (server.test.js "global write lock serializes concurrent writes": timing; file rerun alone twice, 50/50 pass)

$ node --test --test-concurrency=4 machine/test/*.test.js     (same files as bash machine/test/run.sh)
# pass 669
# fail 18       (the same 18 wslpath ENOENT tests as before; a run at default concurrency hung in win-tool-proxy, as both verifiers also saw)

$ npm --prefix viewer run test:browser -- app-mockups.spec.js app-pictures.spec.js app-diagrams-uploads.spec.js
36 passed

$ npm --prefix viewer run test:browser
34 skipped, 22 did not run, 1398 passed, 2 failed (chromium app-lessons.spec.js:42 locator timeout; chromium app-send-now.spec.js:84 30 s timeout; the 22 are the rest of the serial app-lessons describe)
$ npm --prefix viewer run test:browser -- app-lessons.spec.js app-send-now.spec.js     (twice)
58 passed
58 passed
```

### Remediation 2

Verification attempt 2 at `c2f699df`: Claude verifier PASS; GPT verifier FAIL with 2 gaps (`REMEDIATION-2.md`). The stacking cutoff band (598-599px card) is a rare path in Accepted Risks (verification-2). Fixed:

| Gap | Fix (file:line) | Lane | Validated by |
|-----|-----------------|------|--------------|
| Reopening planning for a design change left the review round's reviewers live, and the restart rule would restart a round in planning | `protocol/app/lead.md:847-850` (stop live reviewers, discard reports, round does not count), `protocol/app/lead.md:918-920` (no round restart while `status:` is planning) | gpt light / gpt-6-luna (R3) | `node --test viewer/test/protocol-rules.test.js` → 44 pass, 0 fail; read against the gap |

Only `protocol/app/lead.md` changed since attempt 2's commit, so the code suites' results from attempt 2 stand.

