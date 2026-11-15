# Remediation 1 — app-accounts

Verification round 1 on `ed2ec6c`: the Claude verifier passed; the Codex verifier failed with the three gaps below (verbatim). The Claude verifier's two minor findings that change behaviour are fixed alongside (R1 item 4, R2).

## Gap list (verbatim, Codex verifier)

GAP: §5 limit recovery — A rate-limited Codex verifier can publish partial text as a completed result, setting `finished` and suppressing its eventual report — `machine/service.js:598` emits usage then forwards `turn-ended`; `viewer/app/sessions.js:318` calls the unguarded report path at `:190`. Isolated reproduction produced `finished: true` and an `outcome: done` card containing "Verification still underway."

GAP: §5 account held until reset — A newer ordinary usage reading erases an account's future `limited_until`, allowing new sessions before reset — `viewer/app/usage.js:44` replaces the entire reading. Reproducing limit-hit followed by ordinary usage returned `has_room: true` while the original session remained limited.

GAP: §2 account isolation and removal — Removing and re-adding the same name reuses the retained account ID and login folder, inheriting the old account's login, usage and running-session association — `viewer/app/routes.js:66` checks uniqueness only against current accounts; `viewer/app/sessions.js:138` derives the folder from that ID. Reproduction returned `personal` for both accounts and showed the new account signed in with one inherited live session.

## Minor findings fixed alongside (Claude verifier)

- A promoted waiting record never gets `template_id` or `style_version` (`viewer/app/sessions.js:111-130`); for a lead the writing style could be appended to its first message although it already has it.
- The waiting line names "Claude" for a new thread's waiting lead when no provider is chosen yet (`viewer/pages/thread.js:592`), wrong under a GPT-first lead order.

## Tasks

### R1 — hub fixes (GPT, the family that built T2/T5)
1. A turn that ends while the session has a future `limited_until` (set by a `limit-hit`, or by a `usage` reading with a future `limited_until` that arrived before the `turn-ended`) does not run the report path: no result card, `finished` stays unset. The report is delivered on the first turn end after the hold is released (`Continue.`). Test: a verifier gets a `usage` event with a future `limited_until`, then `turn-ended` with partial text → no result card, `finished` unset; after release and another `turn-ended` with the real text → one result card with that text.
2. `usage.record`: a newer reading keeps the stored reading's `limited_until` when that is still in the future and the new reading carries none (a newer reading's own future `limited_until` replaces it). Test: limit-hit, then an ordinary newer reading → account still has no room until the time passes; after it passes → room.
3. Account ids are never reused: `DELETE /settings/accounts/:id` records the id in a retired list in `settings.json` (kept by `normalize()`), and `POST /settings/accounts` makes the new id unique against current and retired ids (and is never a `default-*` id). Test: add "Personal", remove it, add "Personal" again → a different id (e.g. `personal-2`), the new account has no reading and no live sessions.
4. Promoting a waiting record sets `template_id` (from the role layers, as a fresh start does) and, for a lead, `style_version` from the current settings, so the first delivery does not append the style again. Test: a waiting lead promoted → `style_version` equals settings' and its first delivered message has no `[wc:style]` block.
5. A waiting record carries `waiting_provider`: the one provider the wait is pinned to (restart, sub-lead, strict worker `--provider`), else for a new lead the first provider in `lead_order` (not `any`), else null. Documented in `viewer/app/API.md`. Test: a new lead waiting under `lead_order: ['gpt','any']` has `waiting_provider: 'gpt'`.

### R2 — waiting line text (Claude, the family that built T6)
`viewer/pages/thread.js` `waitingLine()`: for a waiting lead, the label comes from `lead.waiting_provider`, else `lead.provider`, else `thread.provider`, mapped Claude/GPT; when none is set: "Waiting for room, about <time>". Browser test for a waiting lead with `waiting_provider: 'gpt'` → "Waiting for GPT to refill, about …", and with none → "Waiting for room, about …".
