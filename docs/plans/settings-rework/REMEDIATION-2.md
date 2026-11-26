# Remediation 2 — settings-rework

Verification attempt 2 checked commit `05eb9de3`. Claude verifier (`wc-d14474dffb25-verifier-3`): PASS. GPT verifier (`wc-d14474dffb25-verifier-4`): FAIL. Its reserve-label race went to Accepted Risks (rare path). The lead's answers: fix all three below (PLAN.md Log, 2026-11-25).

## Gaps (verbatim, GPT verifier)

- GAP: S6 — The Spec browser command failed in Chromium because the default Settings page was still showing "Loading settings…" after the five-second assertion window — `viewer/test/app-settings.spec.js:44`. The targeted Chromium rerun passed all 56 tests in that file. The comparison commit passed all 36 tests in its version of the file.
- GAP: S4 phone You — The Writing style preview panes are visibly shorter than the mockup — the built panes measured 149 px and 88 px against 196 px and 115 px in the mockup. The pane paragraphs use 13 px text and zero margins. `viewer/pages/settings.css:128–131`.
- GAP: S5, remediation R4 — A Diagrams save that finishes after returning to the phone category list triggers a new read while You is hidden — the GET count rose from one to two with the list still visible, then rose to three when You reopened. `viewer/pages/settings.js:178–189`.

## Tasks

One brief, one worker (claude standard, the provider that built the page), in this order.

### S1 — first-load timeout (S6)
Objective: find whether anything the rework added delays the first paint of `/app/settings` (no hash, desktop) past `GET /settings`: e.g. awaiting another request before `renderCategory`, a Harnesses/usage/Diagrams read that blocks, an exception swallowed before `#loading` is removed, or heavier first render. Fix a real cause in the page. If there is none, show it with evidence (timings of the first load under parallel load on this branch and at `8440ad72` via `git archive` into scratch; the failing test's trace). No timeout padding, no retries.

### S2 — preview panes as tall as the mockup (S4)
Objective: in `docs/plans/settings-rework/graphs/mockup-phone-you.html` at 390px, the Writing style before/after panes' text size, line height and paragraph spacing match the mockup's CSS, so the panes are the mockup's height for the same text (within a few px). Only the panes change.

### S3 — no Diagrams read while You is hidden (S5)
Objective: a Diagrams save that finishes after You stopped being visible (back to the phone list, or another category) neither reads nor draws Diagrams; the next time You is shown it reads as now. Browser check: hold the save's answer, go back to the list, release it, the read count does not rise until You is opened.
