# Remediation 1 — agent-lessons

Verification attempt 1 on 77f8bdb4: Claude verifier PASS; GPT verifier FAIL. Gaps verbatim (GPT verifier):

1. S1 — All four saver roles tell agents to replace or remove a lesson before adding, even when the new lesson covers a different point. S1 makes replacement or removal conditional on an existing lesson covering the point or being wrong. — `protocol/app/lead.md:882`, `sub-lead.md:309`, `worker.md:95`, `mapper.md:85`
2. S2 — The hub refuses validly formed cards from reviewers and verifiers with HTTP 400 and `<role> may not post lesson`. The spec requires HTTP 422 and `a <saver> may not save lessons for <target>s` for disallowed pairs. — `viewer/app/card.js:241`, `viewer/app/cards.js:66`, `viewer/app/settings.js:178`
3. S3/S4 — `only_ai: ["gpt"]` passes card validation, is stored as an array, and survives normalization. The resulting lesson never reaches GPT agents because the prompt filter compares the array to a string. — `viewer/app/card.js:90`, `viewer/app/settings.js:168`, `:191`, `:270`
4. S3 — Rare path: normalization preserves non-ISO timestamps such as `"2020"`. — accepted (PLAN.md Accepted Risks, verification-1); not remediated.
5. S5 — The preview for an all-projects template omits project-scoped lessons. — `viewer/pages/settings.js:700`, `viewer/app/settings.js:168`
6. S5 — The instructions protect user-edited lessons but omit the route for raising a lesson the agent thinks is wrong (lead raises it with the user; sub-lead, worker, mapper message the lead). — the four role files
7. S6 — The notice always puts the reason, markers and Settings link on a separate line, even when the whole notice fits on one line. — `viewer/pages/thread.js:1212`, `:1216`, `viewer/pages/thread.css:398`
8. S7 — An edit typed during a pending save disappears when the save returns. — `viewer/pages/settings.js:868`, `:870`, `:886`
9. S8 — The shared card guide sends agents to `cards-lead.md` for the lesson section it contains, and its lesson refusals omit the HTTP 400 field-error case. — `protocol/app/cards.md:66`, `:102`, `:122`
10. S10 — The test for an explicit `only_ai` scope gives the saving session no provider, so it never exercises a saver on one AI naming another AI; the saver matrix test omits reviewers and verifiers at the hub. — `viewer/test/app-lessons.test.js:15`, `:34`, `:142`

## Tasks

- **R1** (gpt, standard; builder of the backend): gaps 2, 3, 5, 10.
- **R2** (claude, standard; builder of the UI and protocol text): gaps 1, 6, 7, 8, 9.
