---
slug: agent-lessons
date: 2026-11-21
implemented-by: "T1 standard gpt-6.1-terra; T2 standard claude-sonnet-5-5; T3 standard claude-sonnet-5-5; T4 light gpt-6-luna; sub-lead claude-opus-5-5 (merge fixes)"
verified-by: []
---

# Completion Report — Agents save lessons learned

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 The bar | this run | protocol/app/lead.md:872, sub-lead.md:299, worker.md:85, mapper.md:75 | protocol-rules.test.js; reading |
| S2 Saver/target pairs, refusal text | this run | viewer/app/settings.js:176-178 (`applyLesson` allowed map); card.js:31 roles; cards.js:69-73 uses the session's real role | app-lessons.test.js "all saver and target pairs enforce the role matrix", "card schema and saver pairs" |
| S3 Storage, normalize, 12 cap, ids | this run | viewer/app/settings.js:38 defaults, :250 normalize (lessons loop), :176 applyLesson (id generation, cap) | app-lessons.test.js "normalization, cap, prompts and preview" |
| S4 `lesson` card: fields, add/replace/remove, repeat safety, markers, refusals, snapshot | this run | viewer/app/card.js:12, :31, :84-92, :212; viewer/app/cards.js:67-73; viewer/app/settings.js:176-206 | app-lessons.test.js "scope, repeat safety, replacement, removal and user ownership" |
| S4 Never queued; 503 text | this run | machine/service.js:2173-2174 | app-lessons.test.js "machine refuses an unconfirmed lesson without spooling it" |
| S5 Lessons block in roleLayers, placement, filters, markers, "you keep" blocks | this run | viewer/app/settings.js:162-174 (`lessonLine`, `lessonBlocks`), :212 | app-lessons.test.js prompts tests, "lead roleLayers keeps reviewer, verifier and mapper blocks" |
| S5 assertFits ignores lessons | this run | viewer/app/settings.js:242-246 | app-lessons.test.js oversized lessons check |
| S5 fullPrompt preview + caption | this run | viewer/app/settings.js:233-239; viewer/pages/settings.js:712 | app-lessons.test.js; app-lessons.spec.js "the preview caption names the AI and project markers" |
| S6 Thread notice, link, no buttons, not under Needs you | this run | viewer/pages/thread.js:1208-1225; viewer/pages/thread.css | app-lessons.spec.js "add, replace and remove notices, and the link opens the right entry" |
| S6 `#templates/lessons/<role>` hash | this run | viewer/pages/settings.js:1585-1598 | app-lessons.spec.js tests 1 and 5 |
| S7 Lessons learned entry, tag, style | this run | viewer/pages/settings.js:930; settings.css | app-lessons.spec.js test 1 |
| S7 Editor: warning, rows, markers, saved-from link, Remove confirm, Save of changed rows only, note | this run | viewer/pages/settings.js:836-915 | app-lessons.spec.js tests 2 and 3 |
| S7 `PUT /settings/lessons/<role>`; GET includes lessons | this run | viewer/app/routes.js:207-217; viewer/app/settings.js:361 | app-lessons.test.js "settings PUT merges edits and removals over HTTP" |
| S8 Protocol text | this run | protocol/app/cards.md:53, :102-132; lead.md:872; sub-lead.md:299; worker.md:85; mapper.md:75; reviewer.md:82; verifier.md:132 | viewer/test/protocol-rules.test.js |
| S9 Non-goals | this run | nothing built for them | n/a |
| S10 Validation | this run | viewer/test/app-lessons.test.js, viewer/test/app-lessons.spec.js | below |

## Deviations from plan

- S7 note reads "Changes apply to <role plural> started after you save." (e.g. "workers"), matching the existing template editor's note (viewer/pages/settings.js:792), which S7 says to follow ("like templates"), rather than the literal "agents".
- S10 third bullet (`card.js lesson` refusing a reviewer/verifier and a missing `why`): `card.js` takes no role on the command line; the role check runs in `validate()` with the session's real role at the hub (cards.js:66). The test calls `validate('lesson', card, 'reviewer'|'verifier')` and checks a missing `why` (app-lessons.test.js), not a CLI spawn.
- A lesson card that fails field validation at the hub returns 400 (S4 "field errors (400)"); other kinds keep 422.
- Settings removal is two-step and deferred to Save: "Really remove" strikes the row with Undo; nothing is sent until Save.

## Routers

None — this change moved no ownership and no router named a file it touched.

## Validation evidence

`cd viewer && npm test` (on the merged tip):

```
# tests 775
# pass 775
# fail 0
```

`cd viewer && npx playwright test test/app-settings.spec.js test/app-lessons.spec.js`:

```
[80/80] [firefox] › test/app-settings.spec.js:603:1 › models and preferences fits at 390px
  80 passed (39.7s)
```

Screenshots at 390px (T2): /tmp/claude-1000/-home-collin--local-state-wheelchair-worktrees-wheelchair-wc-7a7ad5f5b389-w3/1e5c3875-6d4b-4beb-b501-72f91d4dc792/scratchpad/lessons-editor.png, /tmp/claude-1000/-home-collin--local-state-wheelchair-worktrees-wheelchair-wc-7a7ad5f5b389-w3/1e5c3875-6d4b-4beb-b501-72f91d4dc792/scratchpad/thread-notice.png

## Known gaps / residual risks

- `applyLesson` runs inside the thread update (cards.js:69), so the settings queue is entered while the thread is held; no deadlock path found (settings never takes a thread lock).
- The Playwright spec does not assert that unchanged rows are left out of the PUT body (the code filters at viewer/pages/settings.js ~864).
- Accepted Risks in PLAN.md stand.

## Remediation rounds

### Remediation 1 (after verification attempt 1, GPT verifier FAIL)

Gaps and tasks: `REMEDIATION-1.md`. One gap (non-ISO `saved_at` kept by normalize) accepted as a rare path in PLAN.md Accepted Risks.

- Gap 2: viewer/app/cards.js:66-68 refuses reviewer/verifier lesson cards with 422 `a <role> may not save lessons for <target>s`.
- Gap 3: viewer/app/card.js:90 and settings.js:270 require `only_ai`/`provider` to be a string key.
- Gap 5: viewer/app/settings.js:168 preview of an all-projects template shows project-scoped lessons.
- Gap 10: app-lessons.test.js covers a Claude sub-lead saving a GPT-only worker lesson, hub refusal of reviewer/verifier, array `only_ai`, preview scope.
- Gaps 1, 6: protocol/app/lead.md:882-884, sub-lead.md:309-311, worker.md:95-97, mapper.md:85-87.
- Gap 9: protocol/app/cards.md:66 names `lesson`; 400 bullet at cards.md:132-133.
- Gap 7: viewer/pages/thread.js:1209-1222, thread.css:398-403 one-line notice; same-line assertion in app-lessons.spec.js.
- Gap 8: viewer/pages/settings.js:866-888 and the editor render lock fields while the PUT is pending; held-PUT test in app-lessons.spec.js.

Validation on the merged tip:

```
npm test: # tests 777  # pass 777  # fail 0
playwright app-settings + app-lessons: 82 passed (41.8s)
protocol-rules.test.js: # pass 36  # fail 0
```
