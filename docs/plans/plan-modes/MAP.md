# Map: plan modes

Checked against worktree HEAD `2752b94b3185c92c751788a1c729cdb0f3ac8261`; fetched `origin/main` is `92c2db2211096a2360b7b93f7bb1623805f6209d`. Detailed flow and coverage: [plan-mode-flow](../../maps/plan-mode-flow.md). Relevant older maps changed since their recorded commits; this map relies on the rechecked paths instead.

```text
choose mode -> confirm idea -> plan and review -> approve -> build and verify -> done
                    |                 |                             |
             record scope     defer or accept risk       two-part: create follow-up thread
```

- Review covers the whole first Spec and accepted risks have a defined closure rule; IDEA is the intent and verification checks both the Spec and IDEA's success and non-goals (`protocol/app/reviewer.md:20`, `:34`, `:51`, `protocol/app/verifier.md:36`, `:46`). Two-part and proof-of-concept need the first part's scope and deferred work stated consistently across these documents and the reviewer/verifier briefs. Verification currently remediates every reported gap (`protocol/app/sub-lead.md:234`).
- The existing stub card creates a child immediately but starts no lead until opened; the child receives a summary and optional commits, then starts at step 1 (`viewer/app/cards.js:140`, `viewer/app/threads.js:91`, `:107`, `protocol/app/lead.md:378`). A developed follow-up needs an explicit way to find and carry its plan across the branch boundary, and a decision about parent dependency; a summary alone is the current handoff.
- Two new plan directories in one worktree prevent automatic slug discovery (`viewer/app/views.js:65`, `:99`). An additional document in one plan directory is also not exposed by the app document page, archived endpoint or question-card document field without changing their allowlists (`viewer/pages/doc.js:7`, `viewer/app/threads.js:12`, `viewer/app/card.js:88`).
- Global settings flow through defaults/normalization, preferences route, Settings page and session role layers (`viewer/app/settings.js:151`, `:193`, `viewer/app/routes.js:239`, `viewer/pages/settings.js:448`, `viewer/app/sessions.js:266`). A thread-specific choice needs storage and explicit delivery at creation, stub opening and restart (`viewer/app/threads.js:20`, `:57`, `:107`, `:122`). Card fields are strictly validated and rendered per kind (`viewer/app/card.js:71`, `:151`, `viewer/pages/thread.js:574`).
- Validation entry points: `node --test viewer/test/*.test.js` and `npm --prefix viewer run test:browser` (`viewer/AGENTS.md`, Tests). Focused suites cover cards and progress (`viewer/test/app-hub.test.js:26`), questions (`viewer/test/app-questions.test.js:16`), preferences and prompt composition (`viewer/test/app-settings.test.js:21`), thread creation (`viewer/test/app-new-thread.test.js:184`), slug detection (`viewer/test/app-slug.test.js:34`), and protocol consistency (`viewer/test/protocol-rules.test.js:38`); browser coverage includes `app-threads.spec.js`, `app-new-thread.spec.js`, `app-settings.spec.js`, and `app-doc.spec.js`.

Not checked: machine-side prompt assembly beyond the hub request, remote merge behavior beyond stub opening, and unrelated provider, security and graph flows. No tests were run for this documentation-only map.
