# Map: review and verification progress

The full source-grounded flow and test pointers are in [app-review-progress.md](../../maps/app-review-progress.md), checked against `635c45f07991f31191f2ab1443b52b4ee76559d5`.

Review starts fresh reviewers and the lead triages their reports in rounds; round progress is deliberately silent, except decisions and the needs escalation, until approval (`protocol/app/lead.md:178-225`). Verification starts after the completed build is committed as `verifying`; failures can cycle through fixes and fresh verifiers, and a recurring gap eventually goes to the lead (`protocol/app/sub-lead.md:161-195`).

```text
reviewers -> reports -> lead triage -> revise and review again -> approval
completed build -> verification -> gaps -> remediation -> verification -> pass
```

The existing pinned progress card is restricted to build task counts and rendered as “Building”; it is replaced only by another progress card, so it can remain at the finished count during verification (`viewer/app/card.js:81-86`, `:119-139`; `viewer/app/cards.js:22-25`; `viewer/pages/thread.js:573-588`). Reviewer and verifier session records are available in chat, but live sessions do not describe triage or remediation and may be waiting or finished but not stopped (`viewer/app/chat.js:204-222`; `viewer/app/sessions.js:128-133`, `:257-271`, `:502-512`). The existing Features and Threads labels come from PLAN status: Review also includes approved, and Verifying spans remediation (`viewer/app/views.js:11-18`, `:98-118`; `viewer/pages/threads.js:97-100`; `protocol/app/sub-lead.md:185-195`).

## What I did not look at

Machine service event transport internals, browser suites beyond the cases cited in the area map, and proposals for this feature.
