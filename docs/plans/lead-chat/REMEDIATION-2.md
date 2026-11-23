# Remediation 2 — lead-chat

Verification attempt 2 on 5728cab9. Claude verifier: PASS. GPT verifier: FAIL. Gap verbatim:

- GAP: Spec §§1 and 3 — A thread started without a first message has no stored title. `session leads --all-projects` omits its required `title` field, the Allow card leaves the target name blank, and Needs you says `Let this lead talk to undefined?` — Reproduced in the isolated app. `viewer/app/threads.js:69–73`, `viewer/app/peers.js:49`, `viewer/app/cards.js:140`, `viewer/pages/thread.js:721–722`.

Lead's ruling: fix, with one shared fallback name. Hardening. No rare paths.

## R2 — shared fallback thread name

1. `viewer/app/peers.js`: add and export
   `function threadName(thread) { return thread.title || thread.slug || String(thread.project || '').split('/').filter(Boolean).at(-1) || thread.id; }`
   — the same order the pages use (`viewer/pages/threads.js:39`: title, slug, project folder),
   with the thread id as a last resort.
2. `viewer/app/peers.js:49`: `title: threadName(thread)` instead of `title: thread.title`.
3. `viewer/app/cards.js:140`: use `peers.threadName(target)` for both `target_title` and the
   stored `title` (`Let this lead talk to <name>?`). `peers` is already required lazily in that
   block.
4. `viewer/app/cards.js:189`: `senderTitle: require('./peers.js').threadName(thread)` so the
   `[thread <id>: <name>]` marker never says `undefined`.
5. Tests:
   - `viewer/test/app-lead-list.test.js`: an untitled peer thread (no `title`) lists with a
     `title` equal to its slug or project folder, also under `--all-projects`.
   - `viewer/test/app-reach.test.js`: a reach card to an untitled target stores
     `target_title` = the fallback name, and its Needs you title has no `undefined`.
   - `viewer/test/app-lead-messages.test.js`: a message from an untitled sender thread is queued
     with `[thread <id>: <fallback name>]`.
No page change: the page reads `target_title`, which is now always set.
