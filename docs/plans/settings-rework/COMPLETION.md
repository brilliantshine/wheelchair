---
slug: settings-rework
date: 2026-11-25
implemented-by: "T1, T2: standard (claude-sonnet-5-5); T3: light (gpt-6-luna)"
verified-by:
  - round: 1
    lane: claude-opus-5-5
    checks: "T1, T2 (claude-sonnet-5-5), T3 (gpt-6-luna)"
  - round: 1
    lane: gpt-6.2-sol
    checks: "T1, T2 (claude-sonnet-5-5), T3 (gpt-6-luna)"
  - round: 2
    lane: claude-opus-5-5
    checks: "Remediation 1 (claude-sonnet-5-5)"
  - round: 2
    lane: gpt-6.2-sol
    checks: "Remediation 1 (claude-sonnet-5-5)"
  - round: 3
    lane: claude-opus-5-5
    checks: "Remediation 2 (claude-sonnet-5-5)"
  - round: 3
    lane: gpt-6.2-sol
    checks: "Remediation 2 (claude-sonnet-5-5)"
  - round: 4
    lane: claude-opus-5-5
    checks: "Remediation 3 (gpt-6.2-sol)"
  - round: 4
    lane: gpt-6.2-sol
    checks: "Remediation 3 (gpt-6.2-sol)"
---

# Completion Report — Rework the Settings page

Written for a hostile reviewer: every claim checkable, no claim without evidence. Line numbers are at the commit this report is committed in. Worker reports: `docs/plans/settings-rework/reports/T1.md`, `T2.md`, `T3.md`.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 eight categories, order, contents | this run | `viewer/pages/settings.js:11` (CATEGORIES with block lists), `:2345` (BLOCKS), renderers `:614` (leads), `:626` (Threads), `:1895` (lead order box) | `viewer/test/app-settings.spec.js:47` (order), `:649` (each moved control in its category) |
| S1 lead order in Usage and balancing, own Save, shared draft, each Save refreshes only its keys | this run | `settings.js:1765` (saveBalancing), `:1895` (renderLeadOrder) | `app-settings.spec.js:871` (both Saves, both directions) |
| S1 reserve labels from `reserved_provider` in the Save response; re-read on opening Usage and balancing | this run | `settings.js:1765`, `:1786` (reserveTexts), `:1797` (readReserved), `:1428` (syncSection calls it) | `app-settings.spec.js:871`, `:897` |
| S2 sign-in only on account cards; Harnesses link carries the machine | this run | `settings.js:2227` (signinLink), `openSignin` with `atCards` | `app-settings.spec.js:828`; `viewer/test/app-harnesses.spec.js` (updated expectations) |
| S2 "Open Accounts" / "Add an account" when no card can sign in | this run | `settings.js:2222` (accountsLink), `harnessRow` | `app-harnesses.spec.js` (existing paused/no-account tests, retargeted) |
| S2 Harnesses reloads after sign-in, add, pause, resume, remove, restore default | this run | `settings.js:1421` (refreshStatus), called from closeSignin, `mutate`, `saveAdd` | `app-settings.spec.js:941`, `:978` |
| S2 detailed usage only in Usage; account card one-line reading | this run | `settings.js:1562` (usageLine); bar styles removed from `viewer/pages/settings.css` | `app-settings.spec.js:856` |
| S3 keys, unknown key → you, old-key aliases | this run | `settings.js:22` (ALIASES), `:2404` (parseHash) | `app-settings.spec.js:684` |
| S3 `#behavior/lessons/<role>` and `#templates/lessons/<role>`; lesson card links | this run | `settings.js:2404`; `viewer/pages/thread.js:1534`; `viewer/pages/assistant-popup.js:287` | `app-settings.spec.js:697`; `viewer/test/app-lessons.spec.js:389` |
| S3 no hash: desktop `#you`, phone list; nothing opens `#models` by default | this run | `settings.js:2404`, `:2413` (readHash), `:2383` (renderPhoneNav) | `app-settings.spec.js:709`, `:735` |
| S3 New Thread hint → `#threads` | this run | `viewer/pages/new.html:24` | `viewer/test/app-new-thread.spec.js:142` |
| S3 live links and texts renamed (onboarding card, "Settings → AI providers", README, protocol/sensitivity.md region and line 96, sensitivity fixture, tests, Harnesses internal links) | this run | `viewer/pages/threads.js:150`, `thread.js:1636`, `README.md:261`, `protocol/sensitivity.md:25`, `:96`, `sensitivity/test/run.sh:285`, `settings.js:2216` (linkReasons → `#usage`), `:2222` | `bash sensitivity/test/run.sh`; `app-harnesses.spec.js:698`; git grep below |
| S4 matches the four mockups | this run | `settings.js:11` (ledes/lines from the mockups), `:2383`; `settings.css:136-160` (phone), `:228` (diagram radios), `:317-319` (backdrops over a background) | screenshots posted beside the mockups (T1 report); verifier compares |
| S5 each block repaints only itself | this run | `settings.js:2359` (paint), `:2371` (renderCategory); every former `renderPanel()` call now `paint(<block>)` | `app-settings.spec.js:759`, `:770`, `:782` |
| S5 live work moves with its category (Harnesses polling, 30 s usage, Diagrams read/draw) | this run | `settings.js:1428` (syncSection: `providers`, `usage`), `:2366` (Diagrams on paint of its block) | `app-settings.spec.js:676`; `viewer/test/app-diagram-sensitivity.spec.js` |
| S5 background 10 s refresh page-wide; editor tied to You | this run (refresh pre-existing, `viewer/pages/background.js:68-105` untouched) | `settings.js:1936` (repaintBackground when `section === 'you'`), readHash discards on leaving You | `background-*.spec.js` |
| S5 open sign-in card keeps polling while away | this run (kept) | `openSignin` / `closeSignin` not tied to category changes | `viewer/test/app-accounts.spec.js` sign-in tests |
| S5 harness on/off rebuilds Accounts, waiting on an open account edit | this run | `settings.js:2190` (setHarness) | `app-settings.spec.js:913` |
| S5 Accounts refresh waits on an open edit | this run | `settings.js` accountsBusy / refreshUsage (`:1402`, `:1408`) | `app-settings.spec.js:759`, `:770` |
| S5 Enter-to-send in browser storage; servers unchanged | this run (kept) | `settings.js` enterRow (localStorage); `git diff main -- viewer/app` empty | `viewer/test/app-send-now.spec.js` |
| S7 phone list, "‹ Settings", 899px, layout-only crossing | this run | `settings.css:136`; `settings.js:24`, `:2383`, `:2413` | `app-settings.spec.js:709`, `:735` |
| S6 `app-assistant.spec.js`, `app-project-lead.spec.js` open `#leads` | this run | those specs | themselves |
| Check Once Built #1: Harnesses and the account card agree after sign-in | this run | `settings.js:1421` reads `/harnesses?fresh=1` first (hub drops its machine cache, `viewer/app/harnesses.js:14`), then `/usage`; late usage answers dropped (`refreshUsage`) | `app-settings.spec.js:941` |

## Deviations from plan

None in behaviour. Choices the workers made where the Spec was silent are logged in PLAN.md's Log (`Choice:` lines dated 2026-11-25).

## Routers

None — this change moved no ownership and no router named a file it touched.

## Validation evidence

On the merged feature branch after T2 (commit `e99ef729`, run by the sub-lead):

```
$ node --test viewer/test/app-settings.test.js viewer/test/app-harnesses.test.js viewer/test/app-usage.test.js viewer/test/app-lessons.test.js viewer/test/background.test.js viewer/test/app-diagram-sensitivity.test.js machine/test/name-guard.test.js
# pass 87
# fail 0
$ bash sensitivity/test/run.sh
RESULT 67 passed, 0 failed
$ npm --prefix viewer run test:browser -- browser.spec.js app-send-now.spec.js app-openrouter-spend.spec.js app-new-thread.spec.js app-assistant.spec.js app-project-lead.spec.js app-settings.spec.js app-harnesses.spec.js app-accounts.spec.js app-diagram-sensitivity.spec.js app-lessons.spec.js app-project-tools.spec.js app-hidden-tabs.spec.js background-editor.spec.js background-network.spec.js background-readiness.spec.js background-rendering.spec.js background-settings-surfaces.spec.js
  870 passed (9.9m)
```

T3's stale-reference check (`git grep -nE "settings#(harnesses|templates)|Settings → Harnesses|Models, Diagrams|Models > Diagrams" -- viewer/pages/threads.js viewer/pages/thread.js viewer/pages/assistant-popup.js README.md protocol sensitivity`) printed nothing.

## Known gaps / residual risks

- After T1 merged, one run had `app-accounts.spec.js:262` "adding a GPT account does not warn" fail once in Firefox under load; it passed twice alone and in the full post-T2 run.
- T1's worker saw four `app-accounts.spec.js` "lead waiting line" tests fail just before local midnight (the thread page adds a weekday to the time); they passed in the sub-lead's runs and are not touched by this change.
- An account card with no machine readings shows a stray "0" (`accountCard`, `machines.length && …`); this predates the change and was not fixed.
- The generated harness-instruction block (`sensitivity/set.sh`) still says "(Models, Diagrams)" until Collin runs `./install.sh` or `sensitivity/set.sh` from the canonical clone after merge.

## Remediation rounds

### Remediation 1 — 2026-11-25

Verification attempt 1 (commit `6d7c4f03`) found six gaps that went to remediation (`REMEDIATION-1.md`); one rare path went to Accepted Risks and the mockup line wraps were deferred (PLAN.md Deferred row 1). Lane: claude standard (claude-sonnet-5-5). Report: `reports/R1.md`.

| Gap | Fix | Check |
|-----|-----|-------|
| S2: no 5-hour bar in Usage | `settings.js` accountTable: meter bars in "5-hour used" and "Week used" cells; `settings.css` `.meter` | `app-settings.spec.js:884` |
| S6: Add account flake (Firefox) | real bug: a Harnesses repaint above the screen moved Accounts' buttons mid-press; `settings.js` holdPlace keeps what is below in place | `app-settings.spec.js:907` |
| S6: surfaces check flake (Chromium) | the test measured a node detached by a repaint; `background-settings-surfaces.spec.js` measures in one in-page step | that spec |
| S5: Diagrams read while hidden / stale on opening You | `settings.js` syncDiagrams: read each time You becomes visible, never behind the phone list | `app-diagram-sensitivity.spec.js:55` |
| S3: old test name | `app-settings.spec.js:637` "Models fits at 390px" | — |
| S4: phone You preview panes and Visibility slider | `settings.css` `.pane`, Visibility short track | `app-settings.spec.js:623` |

Validation on the merged branch (sub-lead):

```
S6 node tests: # pass 87, # fail 0
bash sensitivity/test/run.sh: RESULT 67 passed, 0 failed
S6 browser list: exit 0, 878 passed (10.0m)
```

### Remediation 2 — 2026-11-25

Verification attempt 2 (commit `05eb9de3`): Claude verifier PASS, GPT verifier FAIL with three gaps sent to remediation (`REMEDIATION-2.md`); one rare path went to Accepted Risks. Full run on `05eb9de3`: every suite exit 0 except install, whose one failure ("real wheelchair directory is byte-identical after suite") fails the same way at the comparison commit `8440ad72` (running sessions write to `~/.wheelchair`). Lane: claude standard (claude-sonnet-5-5). Report: `reports/R2.md`.

| Gap | Fix | Check |
|-----|-----|-------|
| S6: first-load timeout (Chromium, one run) | none needed: load-only. The page awaits only `GET /settings` (`settings.js:2482`), as at `8440ad72`; under 48 busy loops on 2 cores the same test fails the same way on both trees (traces in R2 report) | — |
| S4: preview panes shorter than the mockup | `settings.css:128-130` pane text 14px/1.45, 14px paragraph margins, eyebrow 20.3px line; panes measure 176 and 115px, equal to the mockup rendered in the app's Inter font (196px is the mockup in a fallback font) | `app-settings.spec.js:638` |
| S5: Diagrams read while You hidden after a late save | `settings.js:146` youShown guards drawDiagram and loadDiagram | `app-diagram-sensitivity.spec.js:89` |

Validation on the merged branch (sub-lead):

```
S6 node tests: # pass 87, # fail 0
bash sensitivity/test/run.sh: RESULT 67 passed, 0 failed
S6 browser list: exit 0, 882 passed (9.9m)
```

### Remediation 3 — 2026-11-25

Verification attempt 3 (commit `cb54ddb3`): Claude verifier PASS; GPT verifier FAIL; the starter's full run found a regression (Firefox `app-accounts.spec.js:179`, a lost second "Send code" press: 4/120 on the branch, 0/180 at `8440ad72`). One rare path went to Accepted Risks. The Technical terms picker gap was deferred by the lead (Deferred row 2: 309px label vs 306px text room at 13px in Inter). Lanes: standard gpt-6.1-terra (blocked), standard xhigh gpt-6.1-terra (blocked), heavy gpt-6.2-sol (done); the hub routed each to GPT. Report: `reports/R3.md`.

| Gap | Fix | Check |
|-----|-----|-------|
| Lost press when a block above an open sign-in card repaints (second fix for repaint-moved presses; first was Remediation 1's `holdPlace`) | `settings.js` holdPlace anchors on an on-screen sign-in card whatever the scroll position | `app-settings.spec.js` lost-press test (holds the Harnesses answer through the press); Firefox repeat 120/120 |
| Background refresh rebuilt the hidden You editor behind the phone list | `settings.js` syncBackground: repaint only while You is shown; bring the editor up to date when You is shown again | `app-settings.spec.js` hidden-editor test |

Validation on the merged branch (sub-lead):

```
S6 node tests: # pass 87, # fail 0
bash sensitivity/test/run.sh: RESULT 67 passed, 0 failed
S6 browser list --project=chromium: 443 passed (4.7m)
S6 browser list --project=firefox: 443 passed (8.1m)
app-accounts.spec.js --project=firefox -g "failed key on an OpenRouter" --repeat-each=60 --workers=8: 120 passed
```

### Verification attempt 4 and finish — 2026-11-25

Attempt 4 (commit `86b4a241`): Claude verifier PASS; GPT verifier FAIL with two gaps. Both were deferred: the phone You heights as Deferred row 3 (lead), and the sign-in card losing focus or a press when Accounts repaints as Deferred row 4, at Collin's choice (pre-existing at `8440ad72`). The final full run then showed this branch's lead-order Save test losing a click when the usage bars loaded above it. Row 4 was widened to the general case (a block repaint above a control can move it mid-press), and F1 (light, gpt-6-luna) made that test mock `/usage` and wait for the bars before clicking (`viewer/test/app-settings.spec.js:1062`, `:1067`; 80/80 repeated). PLAN.md Log: "Deferred and finished at the user's choice".

Deferred to follow-ups (PLAN.md Deferred): 1 mockup line wraps from the app's font; 2 Technical terms picker cut by a few pixels at 390px; 3 phone You text box and Diagrams stack about 12px taller than the mockup; 4 block repaints above a control can move or replace it mid-press, including an open sign-in card on Accounts' refresh.

Rare paths accepted during verification (PLAN.md Accepted Risks): 3 (verification-1, -2, -3).

Final full run on `908dd868` (`bash test-support/full-run.sh`), `summary.txt`:

```
commit 908dd868265918f0b477a78e3036b76db29cbae4
suite viewer-browser exit 0
suite viewer-node exit 0
suite machine exit 0
suite test-support exit 0
suite sensitivity exit 0
suite codex exit 0
suite install exit 1
suite sudo-helper exit 0
```

Failures confirmed on main (same test, same error at the comparison commit `8440ad72`), which do not fail the gate:
- install: "real wheelchair directory is byte-identical after suite" (`install/test/run.sh:705`). It hashes the live `~/.wheelchair`, which running sessions write to; run from a `git archive` of `8440ad72` it failed the same way (212 passed, 1 failed). `install/` is unchanged on this branch.
- viewer-node, in an earlier run on `f35b7793`: `viewer/test/server.test.js:579` "the global write lock serializes concurrent writes and retry retains both changes". `viewer/server.js` is identical to `8440ad72`, where the test failed 3 of 16 runs. It passed in the final run.

Other one-off failures in earlier full runs were in files this branch does not touch and passed on rerun: test servers refused a port held by another process (`app-spot-comment.spec.js:409`, `app-agents-decks.spec.js:23`), `app-agents-decks.spec.js:247` (200/200 on both trees when repeated), `app-permit.spec.js:26`, `app-quiet.test.js:41`, `machine/test/switch-http.test.js:112`.

The generated harness-instruction block still says "(Models, Diagrams)" until Collin runs `./install.sh` or `sensitivity/set.sh` from the canonical clone after merge.

