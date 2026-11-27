---
slug: new-thread-stubs
date: 2026-11-27
implemented-by: "T1 hub: standard gpt-6.1-terra (attempt 2 at xhigh effort); T2 page: standard gpt-6.1-terra (Claude requested, hub routed to gpt); T3 protocol: light gpt-6-luna"
verified-by: []
---

# Completion Report — Save an idea as a stub from the New thread screen

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 `POST /threads` `stub:true`: no lead, no message; project check, save, addProject kept | this run | `viewer/app/threads.js:66-85` | `viewer/test/app-new-stub.test.js:35` (no machine session) |
| S1 `files` integer ≥0; message or files required, 400 `a stub needs a message` | this run | `viewer/app/threads.js:67-70` | `app-new-stub.test.js:22` |
| S1 saved fields (title from first line / given title, context, `saving_files`, `parent:null`, `depends_on_parent:false`, `commits:[]`, `sessions:[]`) | this run | `viewer/app/threads.js:77-83` | `app-new-stub.test.js:35`, `:51` |
| S1 without `stub` unchanged | this run (unchanged path) | `viewer/app/threads.js:78`, `:86` onward | existing `app-hub.test.js` "derives an opening title…"; full node suite |
| S2 unopened-stub definition | this run | `viewer/app/threads.js:121` (`isUnopenedStub`) | `app-new-stub.test.js:59`, `:68`, `:104` |
| S2 uploads accepted for an unopened stub; live lead as before; else 409 | this run | `viewer/app/routes.js:167` | `app-new-stub.test.js:59`, `:68`; `app-uploads-archive.test.js` existing live-lead cases |
| S2 `POST /threads/:id/stub-attachments` (validation, 409, append rule, `done`) | this run | `viewer/app/routes.js:777-790` | `app-new-stub.test.js:79`, `:91`, `:104` |
| S2 `openStub` clears `saving_files`; parentless message prefix; child unchanged | this run | `viewer/app/threads.js:13`, `:134`, `:137` | `app-new-stub.test.js:117`; child: `app-hub.test.js` "creates an unstarted stub and opens it after a role turn ends" |
| S2 restart `stub_summary` prefix for parentless; child unchanged | this run | `viewer/app/threads.js:165` | `app-new-stub.test.js:128`; child: `app-hub.test.js:2220` |
| S2 archiving an unopened stub removes its uploads | this run (test only; archive path already handled sessionless threads) | archive path in `viewer/app/threads.js` (unchanged) | `viewer/test/app-uploads-archive.test.js:162` |
| S3 Save for later button and hint | this run | `viewer/pages/new.html:32-33` | `viewer/test/app-new-thread.spec.js:263` |
| S3 enable rule | this run | `viewer/pages/new.js:205-206` | `app-new-thread.spec.js:263` |
| S3 create body, no-file navigation | this run | `viewer/pages/new.js:271-284` | `app-new-thread.spec.js:277` |
| S3 per-file upload then path post, then `done`; banners; buttons stay off | this run | `viewer/pages/new.js:217-229`, `:286-306` | `app-new-thread.spec.js:295`, `:313`, `:326`, `:343` |
| S3 failed create text and re-enable | this run | `viewer/pages/new.js:280` | `app-new-thread.spec.js:359` |
| S3 Start unchanged | this run (shared `uploadFile` refactor) | `viewer/pages/new.js:217-229` | existing Start attachment cases in `app-new-thread.spec.js` |
| S4 marker "Started from a saved idea" / parent title / "parent thread" | this run | `connectors/hub-common.js:97`; parse cache key `viewer/app/chat.js:49` | `viewer/test/app-chat.test.js:123`, `:525` |
| S4 interrupted-save warning on the stub page | this run | `viewer/pages/thread.js:650` | `app-new-thread.spec.js:326` |
| S4 `saving_files` in list and thread responses | this run (falls out of existing spread) | `viewer/app/routes.js:594` | `app-new-stub.test.js:35` |
| S4 no parent link or waiting text for a parentless stub | pre-existing behaviour, confirmed | `viewer/pages/thread.js:637` | `app-new-thread.spec.js:277`, screenshot below |
| S4 `session leads` candidate and `adds_to` | pre-existing behaviour, confirmed | `viewer/app/peers.js:44`, `viewer/app/cards.js:250` | `app-new-stub.test.js:145`, `:91` |
| S5 cards.md row | this run | `protocol/app/cards.md:210` | protocol check below |
| S5 lead.md sentences | this run | `protocol/app/lead.md:926-933` | protocol check below |
| S5 API.md rows | this run | `viewer/app/API.md:12`, `:25`, `:179` | read |
| S6 tests | this run | files above | validation below |

## Deviations from plan

- `app-threads.spec.js` got no new case: the interrupted-save line and the stub page after Save for later are covered in `app-new-thread.spec.js:277` and `:326` (S6 placed them there).
- The child-stub open message and child restart value are covered by existing `app-hub.test.js` tests rather than new ones.
- `stub-attachments` rejects whitespace-only paths as well as empty ones (Log).

## Routers

None — this change moved no ownership and no router named a file it touched in a way that became false.

## Validation evidence

Sub-lead re-runs on the merged branches:

```
node --test viewer/test/app-new-stub.test.js viewer/test/app-hub.test.js viewer/test/app-chat.test.js viewer/test/app-new-thread.test.js viewer/test/app-uploads-archive.test.js viewer/test/app-lead-list.test.js
# tests 178
# pass 178
# fail 0

npm --prefix viewer run test:browser -- test/app-new-thread.spec.js test/app-threads.spec.js
  194 passed (2.9m)
```

Worker reports (`reports/T1.md`, `reports/T2.md`): `node --test viewer/test/*.test.js` 1057/1057 pass; T1 mutation checks failed the intended tests for the message rule, the `done` rule, and the open and restart prefixes.

Protocol check: the hub test `app-new-stub.test.js:117` asserts the parentless opening message

```
[wc:context stub] (saved from the New thread screen)
First line
Full message

[attached: /a]
```

Read against `lead.md:926-933`: the summary after the marker starts with `(saved from the New thread screen)`, so a lead knows there is no parent and that the lines after it (the message and its `[attached: ...]` lines) are the user's own first message; an `adds_to` addition is appended as a later "Added from" paragraph (`app-new-stub.test.js:91`), which the sentence excludes. The restart `stub_summary` starts with the same line (`app-new-stub.test.js:128`), which the second sentence covers. The cards.md row names the new "Started from a saved idea" marker, matching `connectors/hub-common.js:97`.

Screenshots (posted to the thread): `/tmp/wc-t2-new-phone.png`, `/tmp/wc-t2-new-desktop.png`, `/tmp/wc-t2-stub.png`.

The full run (`test-support/full-run.sh`) for the verified commit is pasted below once it finishes.

## Known gaps / residual risks

- T2's own mutation check was coarse (Save forced disabled); each S6 browser bullet has its own test.
- Accepted Risks in PLAN.md stand as reviewed.

## Remediation rounds
