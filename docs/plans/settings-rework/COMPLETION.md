---
slug: settings-rework
date: 2026-11-25
implemented-by: "T1, T2: standard (claude-sonnet-5-5); T3: light (gpt-6-luna)"
verified-by: []
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
