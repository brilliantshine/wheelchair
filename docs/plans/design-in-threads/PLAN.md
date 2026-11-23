---
slug: design-in-threads
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-22
---

# Design work inside a thread

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

**Map:** `MAP.md` and `docs/maps/thread-visual-design.md`.

## Open Questions

Ordered by leverage; discussed one at a time.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Plan mode two-part | Collin's pick: core flow first, hardening in a follow-up thread | user |
| 2 | No dedicated Claude Design import path; the build-follows-the-mockup part folds into the screenshot check | Collin: B can go if making designs here and seeing them early are good | user |
| 3 | The agreed mockup is a file in `docs/plans/<slug>/` that the Spec points to; workers build against the file, and a visible difference from it is a gap the verifier reports | Prose paraphrase of a design is where the 20-30% loss happens | defaulted |
| 4 | User feedback on mockups is given in chat (no tap-to-comment on the picture) | Simplest; tap-to-comment is hardening | defaulted |
| 5 | A new design agent role drafts and revises mockups; the lead starts it during planning, briefs it, and posts what it makes | Collin's pick: mockups get a focused agent and the lead stays free to talk | user |
| 6 | Mockup frame size depends on what is being worked on: "it should depend on what you're working on" (Collin usually views wheelchair in a laptop browser) | Collin's answer; a phone app gets a phone-sized frame, a desktop web page a desktop-sized one | user |
| 7 | Mockups show live (the HTML page itself, not a rendered picture), scaled to fit the viewer's screen; "Open full size" shows it instead of downloading | Works on every machine without a headless browser; Collin did not object to live, only to a fixed phone shape | defaulted |
| 8 | During the build, a screenshot of each finished visible task is posted to the thread as it lands, next to its mockup, by the sub-lead directly | Collin's pick: see it take shape and steer early | user |
| 9 | Workers compare their screenshot with the mockup and fix differences before reporting | Catch drift per task, not only at the end | review-round-1 |
| 10 | "Agree the mockups" is an Open Question while a designer runs, so review waits for agreement | Planning gate must not close on unagreed mockups | review-round-1 |
| 11 | Mockup changes asked during the build are applied right after it as an after-done fix in the same open pull request | The sub-lead owns the worktree during the build | review-round-1 |

## Spec

Bar: a fresh agent with no conversation history can implement from this section alone.
A Mermaid diagram of the flow is added at approval.

### Overview

Three pieces:

1. **Mockups during planning.** A new `designer` agent, started by the lead, drafts static
   HTML mockups of the screens a feature changes. The lead shows each version in the thread
   as a new `mockup` diagram format, framed at the size of the device being designed for and
   scaled to fit. Collin asks for changes in chat; the lead relays them; the designer revises.
2. **The agreed mockups are the source of truth.** The Spec of a plan with visible work lists
   each agreed mockup file. Workers build to match it, and verifiers compare the build with it.
3. **Screenshots during the build.** Workers screenshot each finished visible task at the
   mockup's size; the sub-lead posts each one as an `image` card, shown beside its mockup.

### Mockup files

- A mockup is one self-contained static HTML file at
  `docs/plans/<slug>/graphs/mockup-<name>.html`: HTML, inline `<style>`, inline SVG and
  `data:` images only, no scripts, nothing loaded from the network (the existing HTML diagram
  rules and the server's existing CSP and empty sandbox apply unchanged:
  `viewer/server.js:1690-1694`, `viewer/pages/diagram.js:70-77`).
- Each file shows one screen in one state, laid out for one device size (`width` x `height`
  CSS pixels, each from 200 to 2560, the screen tool's capture limit: `machine/lib/screen-args.js:31`). The lead picks the size from what the thread builds: for example 390x844 for a
  phone screen, 1440x900 for a desktop web page, the app's window size for a desktop app.
  Several states or sizes are several files.
- A mockup file is at most 2 MiB (the archived-file read limit, `viewer/app/threads.js:295`).
  `card.js` checks the file exists under the plan's `graphs/` and refuses a `mockup` card or
  `image.mockup` whose file is larger, before posting.
- A new version of a mockup is written as a new file (`mockup-<name>-v2.html`, ...), never
  over an old one, so older cards in the thread still show what they showed.

### The `mockup` diagram format

- `diagram` cards gain `format: "mockup"`, which loads `graphs/<graph>.html` like `html`,
  and two fields: `width` and `height`, integers from 200 to 2560, required when `format`
  is `mockup` and refused for any other format (`viewer/app/card.js` validation;
  `protocol/app/cards-lead.md` diagram section).
- **In the thread:** the card draws a sandboxed iframe sized exactly `width` x `height`,
  scaled with a CSS transform to the card's content width (never scaled up past 1), inside a
  box whose height is `height` x scale, so the whole screen is visible with no inner
  scrolling. It rescales when the card width changes. A thin border marks the screen edge.
- **"Open full size"** (`viewer/pages/picture.js`) draws the same sandboxed iframe at its
  true `width` x `height` inside the page's scrolling container (scrolling both ways when the
  window is smaller), never downloads it in place of showing it. A separate Download link
  for the HTML file may stay. Plain `html` cards keep today's behaviour.
- Archived threads load the file the same way `html` cards do today
  (`viewer/pages/diagram.js:12-24`).

### `image` cards beside a mockup

- `image` cards gain an optional `mockup` object `{plan, graph, width, height}` naming a
  mockup file with the same rules as a mockup diagram card. When present, the card shows the
  screenshot and the mockup side by side, labelled "Built" and "Mockup", each scaled to half
  the card width; under 599px card width they stack, Built first. Each half has its own
  "Open full size": the screenshot opens as an image at true size; the mockup opens the
  picture page, which accepts an `image` card with `mockup` (`?card=<id>`) and draws the
  mockup exactly as for a mockup diagram card. Without `mockup`, image
  cards behave as today.
- `image` cards may now be posted by `lead` and `sub-lead` (`viewer/app/card.js:42`;
  `protocol/app/cards.md` kind table; `cards-lead.md` image section moves the "only the
  lead" sentence). The machine's copy-into-uploads step is unchanged.
- Archiving keeps `image` and `file` uploads posted by sub-leads as well as leads (the keep
  list in `viewer/app/threads.js:219-220` today keeps only lead-authored ones), so both
  halves of a comparison still load in an archived thread.
- The `image` card section moves from `protocol/app/cards-lead.md` to the shared
  `protocol/app/cards.md` (which the sub-lead receives), and the kind table lists
  `lead, sub-lead` as emitters. `protocol/app/sub-lead.md:5-7` ("never post cards meant for
  the user except the `progress` line") gains `image` as the second exception, and its
  screenshot relay sentence (`sub-lead.md:179`, "pass them on to the lead") is replaced by
  the posting rule in "Build and verify rules".

### The `designer` role

Plumbing (a new role alongside `mapper`; evidence from the scout):
`viewer/app/sessions.js:127-139` (`SESSION_ROLES`, and the lead's `ALLOWED_START`; not the
sub-lead's), `viewer/app/sessions.js:765-768` (shares the thread worktree and branch, like
the mapper), `viewer/app/balancer.js:14` and `viewer/app/settings.js:13-23,54` (an Other
agents tier and role card files: `cards.md`, no `realism.md`), `viewer/app/routes.js:403`,
`viewer/pages/settings.js:28,614` (label "Designer", Other agents row),
`viewer/pages/agents.js:57` (short label), `viewer/app/quiet.js:3` (watched like a mapper),
`machine/service.js:195-203` (`ROLE_CARDS` gets `cards.md`; prompt from
`protocol/app/designer.md`), `viewer/app/card.js:50-51,86` and `viewer/app/cards.js:67`
(may post `message` and `result`; lessons may be saved *for* it by a lead, it saves none),
`viewer/pages/settings.js:842,1765`, `viewer/pages/thread.js:3`, `viewer/app/settings.js:187,193`
(lesson role lists), `protocol/app/AGENTS.md`, and the tests that enumerate roles
(`viewer/test/protocol-rules.test.js`, `app-lessons.*`, `app-settings.test.js`,
`app-balancer.test.js`, `app-harnesses.test.js`, `app-sudo.test.js`, `app-switch.test.js`,
`machine/test/service.test.js`, `switch-http.test.js`, `pi.test.js`). The screen tool
already allows every role but reviewers (`machine/lib/screen.js:261`); no change.

Rules, in a new `protocol/app/designer.md`:

- Its brief names the slug, the screens and states to draw, each one's device size, what the
  user has said they want, and paths to read (IDEA.md, the project's existing screens or
  styles where they exist, so mockups match the real app's look).
- It writes and commits (with `wc.js git commit`, exact paths) only
  `docs/plans/<slug>/graphs/mockup-*.html`, never overwriting an earlier version.
- Where the project already has a look (styles, components, screenshots), the mockup uses
  it: same colours, type, spacing and components. It may read the project's code to get them.
- Before reporting, it looks at its own work when it can: renders each file at its size to a
  PNG with the machine's headless Chromium (Playwright, as the viewer's browser tests use)
  and checks it with its image-reading tool. If no browser is available it says so in its
  result and carries on.
- It reports each set of versions with a `result` (task `mockups`) listing every file, its
  screen/state and its `width`x`height`, then waits: the lead may send revision requests as
  `message`s, each answered by a new version and a new `result`. It never talks to the user
  and posts no shown cards.

### Lead rules (`protocol/app/lead.md`, `cards-lead.md`)

- **When:** in a feature (not a small fix) whose idea changes something people see, the lead
  starts one designer once IDEA.md is confirmed, alongside asking design questions. It may
  skip it when the visible part is trivial, saying so in a line.
- **Showing:** for each `result`, the lead posts one `mockup` diagram card per file.
  Collin's feedback is passed to the designer as a `message` quoting his words verbatim,
  with the paths of any files he attached (`[attached: <path>]`), not a paraphrase.
- **Gate:** when the lead starts a designer it adds an Open Question "Agree the mockups" to
  PLAN.md, so status stays `planning` (the existing gate: Open Questions empty) until Collin
  agrees them. It is settled by a Decision naming the agreed files; the lead then stops the
  designer. If the lead skips the designer, it logs that as a `defaulted` Decision instead.
- **Changes during review** (status `ready-for-review`, before approval): the lead starts a
  fresh designer briefed with the current files and Collin's words; the new version, once
  Collin agrees it, is a Spec change listed in the next round's "Changed since" list.
- **Changes after Start building:** the mockups are fixed like the rest of the Spec while
  the sub-lead owns the worktree. A change Collin asks for after seeing a build screenshot is
  answered in a line ("I'll apply it right after the build, in the same pull request"); once
  the sub-lead stops and `done` is posted, the lead makes it as an after-done fix (step 9 of
  `lead.md`: the pull request is still open, so it is fixed in place and verified). If it
  needs parallel work, step 9's stub rule applies.
- **Restart:** a restarted lead stops any live designer (its results would go to the dead
  lead) and, if the "Agree the mockups" question is still open, starts a fresh one briefed
  with the newest mockup files and any of Collin's feedback in the restart context's recent
  messages not yet reflected in a file.
- **Recording:** agreed mockups are listed in the Spec under a "Mockups" heading: one row per
  file with its path, the screen/state it shows and its size. Choosing which version is
  agreed is a Decision Log entry. After approval, changing a mockup is a Spec change (the plan
  returns to review).
- The template `protocol/templates/PLAN.md` Spec guidance gains one line: a plan with visible
  work lists its agreed mockups there instead of describing the look in prose.

### Build and verify rules

- **Worker** (`protocol/app/worker.md`): a task whose brief names a mockup builds to match it
  (layout, content, hierarchy, colours, type, spacing). When the task finishes, it
  screenshots the built screen at the mockup's `width` x `height`: a web page with headless
  Chromium (an isolated server per the project's rules); a desktop app or game with its
  invisible screen (`wc.js screen`). It then looks at its screenshot beside the mockup (rendering the mockup at its size with
  headless Chromium, or opening the HTML's own render) and fixes any difference by the
  verifier's bar below before reporting. It lists each screenshot path with the mockup it
  matches in its report, and any difference it chose to leave, with why. A task with visible work but no mockup still reports a screenshot. If it
  cannot take one, it says why; this does not block the task.
- **Sub-lead** (`protocol/app/sub-lead.md`): briefs name the mockup files and sizes from the
  Spec's Mockups list for each task that touches those screens. When a worker's `result`
  arrives with screenshots, the sub-lead posts one `image` card per screenshot right away
  (with `mockup` set when the report names one), before merging or verifying. When it
  checks the task, a difference the worker left without a good reason is a reason to send
  the task back, like any other mismatch with the brief. It does not relay screenshots to
  the lead.
- **Verifier** (`protocol/app/verifier.md`): each Spec mockup is a Spec item. The verifier
  screenshots the built screen at the mockup's size and compares the two. A difference a user
  would notice (missing or extra element, wrong order or grouping, wrong text, clearly
  different colour, size or spacing) is a gap; anti-aliasing, font rendering and sub-pixel
  differences are not. It names the screenshot paths it compared. Where no capture path
  exists (for example a desktop app on a machine without the screen tool), the comparison is
  reported as could not try, not as a gap.

### Not in this thread

- Importing from Claude Design or other tools; clickable prototypes (IDEA.md, Not doing).
- Tap-to-comment on a mockup (Decision 4).
- Mockups and other diagram files for threads whose worktree is on another machine: a
  limitation of every diagram card today, tracked by the unopened thread "Pictures from
  threads on another computer".

### Validation

```bash
node --test viewer/test/*.test.js
bash machine/test/run.sh
npm --prefix viewer run test:browser
```

New tests at minimum: `card.js` accepts a `mockup` diagram with `width`/`height` and refuses
them on other formats or out of range; accepts `image.mockup` and an `image` from a sub-lead,
refuses `image` from a worker; refuses a mockup file over 2 MiB; archiving keeps a
sub-lead's image upload; a lead may start a `designer`, a sub-lead may not; the designer
gets `cards.md` and `designer.md` in its prompt and an Other agents tier; a browser test that
a 390x844 mockup card shows the whole screen without inner scrolling at phone and laptop
widths, that "Open full size" shows (not downloads) a mockup, and that an `image` with
`mockup` shows both side by side on a wide card and stacked on a narrow one.

## Deferred

Optional; present only in the lighter modes.

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| D1 | Tap on a mockup to leave a comment on that spot | Chat feedback works for normal use | planning | Decision 4; comments would need to reach the designer as messages |
| D2 | Download a mockup as a PNG from "Open full size" | Viewing works without it; needs a browser-side render of the iframe | planning | `viewer/pages/picture.js` offers PNG for graphs and forms today |

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them. Rare paths per `protocol/app/realism.md` land here in every mode, with round
`review-round-N`, `verification-N` or `lead-check`.

| Risk | Why accepted | Round |
|------|--------------|-------|

## Check Once Built

Review findings only the built code can settle, per `protocol/app/realism.md`. Verifiers
check each row against the build; a listed row is settled for later review rounds and
stays as review history.

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

### Round 1 — 2026-11-22

**Lanes:** claude / claude-opus-5-5 (intent); gpt / gpt-6.2-sol (mechanics); cross-family: yes.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most.

<!-- Round 2+: list what changed since the previous round; that list scopes the reviewers. -->

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | No one compares a task's screenshot with its mockup during the build | upheld | Worker compares and fixes before reporting; sub-lead sends back unexplained differences |
| intent | minor | Lead paraphrases feedback; attachments not passed to designer | upheld | Pass words verbatim plus attachment paths |
| intent | minor | Half-width comparison too small; no full size for the mockup half | upheld | Each half gets Open full size; picture page accepts image+mockup |
| mechanics | blocking | Mockups fail for threads on a remote machine | declined | Same for every existing diagram card (`viewer/server.js:1673` reads the hub's own disk); tracked by the unopened thread "Pictures from threads on another computer"; noted under Not in this thread |
| mechanics | major | Archive drops sub-lead screenshots | downgraded (minor) | Real but only affects archived history; keep list now includes sub-lead uploads |
| mechanics | major | Live HTML has no size cap, archived read caps at 2 MiB | downgraded (minor) | Only large embedded images, only after archive; 2 MiB checked by card.js at post time |
| mechanics | major | Planning gate can close while mockups are unagreed | upheld | "Agree the mockups" Open Question holds status at planning; review-time changes go into the next round |
| mechanics | major | No path for mockup changes after Start building | upheld | Fixed during the build; applied as an after-done fix in the same open PR |
| mechanics | major | Allowed sizes exceed screen capture limit; no Windows capture | downgraded (minor) | Range now 200-2560; no capture path is could-not-try, not a gap |
| mechanics | major | Restarted lead and surviving designer | downgraded (minor) | Worst case is resent feedback; restart stops the designer and starts a fresh one |
| mechanics | major | Designer waits forever on an OpenRouter-only machine | declined | Pre-existing for every Other-agents role (mapper, reviewer, verifier) via `worker_order` (`viewer/app/balancer.js:88`); not introduced here |
| mechanics | minor | Image section lives in cards-lead.md, sub-lead may only post progress | upheld | Moved to cards.md; sub-lead exception updated |

Reported severity is the reviewer's opinion; the lead verdict
(`upheld`/`downgraded`/`declined`/`accepted-risk`/`check-once-built`/`user-decision`) is what gates the
exit. Downgrades and declines cite evidence.

### Round 2 — 2026-11-22

**Lanes:** claude / claude-opus-5-5 (intent); gpt / gpt-6.2-sol (mechanics); cross-family: yes.

**Changed since Round 1:** worker self-check against the mockup and sub-lead send-back (Build and verify rules); verbatim feedback and attachments, the "Agree the mockups" gate, changes during review, changes after Start building, designer on lead restart (Lead rules); size range 200-2560 and 2 MiB file limit checked by card.js (Mockup files, mockup format); full size for each half and picture page accepting image cards, archive keeping sub-lead uploads, image section moved to cards.md and sub-lead exception (image cards); could-not-try when no capture path (verifier); remote-machine limitation noted (Not in this thread).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

Parts of the Spec already built before this plan reached Stage 3 — adopted from outside
with work already done, or left behind by an implementation run that died partway.

Stage 3 does not re-implement `pre-existing` items and does not touch their code. Stage 4
verifies them exactly as rigorously as everything else: this code has never been through
the gate, so skipping it would leave the least-trustworthy part of the change as the only
part nobody checked.

Ambiguous evidence means **not done**. A wrong "done" is a silent hole; a wrong "not done"
costs a worker one look.

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|
|           | pre-existing / partial | | high / low |

`partial` items are implemented by Stage 3 — the brief names what exists so the worker
completes it instead of restarting it.

## Implementation Tasks

Filled by Stage 3. One row per worker brief.

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

Session id = the `thread_id` of a `codex exec` lane, so remediation can resume it.

## Log

Free-form running notes: deviations discovered mid-implementation, scope events,
anything a future session needs that fits nowhere above.
