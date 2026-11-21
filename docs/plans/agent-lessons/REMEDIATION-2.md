# Remediation 2 — agent-lessons

Verification attempt 2 on 50ecfe53: Claude verifier PASS; GPT verifier FAIL. Gaps verbatim:

1. S7 — A save that finishes after switching roles discards edits in the newly opened lesson editor. — At 390 px, I held a Worker save, switched to Reviewer, and typed a draft. When the Worker save finished, the Reviewer entry stayed selected but the Worker editor appeared. Reopening Reviewer showed the original text. `viewer/pages/settings.js:629`, `viewer/pages/settings.js:872`.
   — Rare path (race inside a local save's sub-second window); recorded in PLAN.md Accepted Risks, verification-2. Not remediated.
2. S7 — The source link shows a raw thread ID when the thread uses its default display title. — In Chromium, Settings showed `saved from 7f7af0038b10` and the linked thread displayed `project` as its heading. `viewer/pages/settings.js:842`, `viewer/pages/thread.js:140`.

## Tasks

- **Gap 2** (transcription, done by the sub-lead): `viewer/pages/settings.js` `loadLessonThreads` maps each thread to `title || slug || last project folder || id`, matching `viewer/app/peers.js:14` `threadName`. Test: `viewer/test/app-lessons.spec.js` asserts the link is not `saved from <id>` for an untitled thread.
