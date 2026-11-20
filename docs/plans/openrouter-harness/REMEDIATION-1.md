# Remediation 1 — openrouter-harness

Verification attempt 1 on `5a5f0742`. Claude verifier: PASS. GPT verifier: FAIL. Its gap list, verbatim:

> GAP: Pi readiness and first-turn delivery — Wheelchair marks Pi ready while it is still starting. Pi rejects the first Enter and leaves the message in its editor. In an isolated run with Pi 1.5.2, the lead was marked ready, the pane showed “Startup is still in progress,” and chat timed out waiting for a reply. This reproduces the first-message symptom in the completion report. — `machine/adapters/pi.js:56`, `machine/service.js:1016–1026`, [pane capture and run log](/tmp/wc-openrouter-verify.MSiTEh/pi-offline-retry.log)
>
> GAP: Keeping the key secret — Ordinary Pi tool-start events copy credentials from tool arguments into activity labels and keys. A synthetic credential sent through the standard `machine/hook.sh pi` path appeared in both spool fields and persisted in the hub thread state. — `machine/adapters/pi.js:63–67`, `viewer/app/sessions.js:65–83`, [spool probe](/tmp/wc-openrouter-verify.MSiTEh/probes.log:1), [hub probe](/tmp/wc-openrouter-verify.MSiTEh/hub-probe.log:2)
>
> GAP: Turn watermark — The adapter drops `turn_id` on failed turns, so the hub cannot deduplicate a replay with a new delivery ID. Replaying Pi’s turn-2 failure queued two notices to the starter and left the watermark unset. — `machine/adapters/pi.js:69–71`, `viewer/app/sessions.js:567–569`, [replay probe](/tmp/wc-openrouter-verify.MSiTEh/hub-probe.log:2)

Triage (lead's per-gap answers, 2026-11-20): gap 1 fix; gap 2 fix (always fixed: a secret leak); gap 3 a rare path, recorded in PLAN.md Accepted Risks (`verification-1`), not remediated.

Cause of gap 1, from Pi 1.5.2's source (`dist/utils/tools-manager.js:316-334`, `dist/modes/interactive/interactive-mode.js:2643-2646`): when `fd` (or `rg`) is not on PATH, Pi prints `<Name> not found. Downloading...` during startup, then `<Name> installed to <path>` or `Failed to download <Name>: …`. An Enter pressed before startup finishes puts the text back in the editor and shows `Startup is still in progress`. An Enter on an empty editor does nothing (`text.trim()` empty → return). The sub-lead's earlier runs had `fd` on PATH, which is why they never hit it.

## Task R1-1 — Pi waits for startup; key redaction in every Pi event

One task, GPT (built `pi.js`), Standard tier. The brief is below as sent.

---

# Task R1-1 — Fix two verification gaps in the Pi adapter (plan `openrouter-harness`)

Read `docs/plans/openrouter-harness/REMEDIATION-1.md` (this file) above this brief first: it has the gap text and Pi's exact strings.

## Objective

**Gap 1, readiness.**

1. In `machine/adapters/pi.js` `readyText(session, pane)`: also return false while the pane shows a startup download that has not finished. For every line matching `^\s*(\S+) not found\. Downloading\.\.\.\s*$`, with captured name N, the pane must also contain, **after** that line, a line containing `N installed to ` or `Failed to download N:`. If any download line has no such later line, not ready. Keep every existing condition.
2. Fallback, Pi only: after `submit` (both the first message at ready, `machine/service.js` `checkReady`, and every hub `/submit`) has pasted and pressed Enter, start a follow-up that is **not awaited** (submit still returns as it does today). It checks the pane every 500 ms for up to 60 s. Each time the pane (plain capture, as `this.pane(name)`) shows the text `Startup is still in progress` **and** does not show Pi's busy border (`/Working\s*[─-]/`, the same test `readyText` uses), it sends one `Enter` with `send-keys -t <name> Enter`, at most once per second. It stops as soon as the busy border appears, the session ends or is stopped, or 60 s pass. It never pastes again. Gate it with an adapter flag `retryStartupEnter: true` set only in `pi.js`; other CLIs are untouched. One follow-up per session at a time: a new submit restarts the window rather than adding a second loop.

**Gap 2, redaction.** In `pi.js` `hookEvent`, every string in every event returned (step start and end, turn-ended, turn-failed), at any depth, passes through the existing `redact` (`sk-or-[A-Za-z0-9_-]+` → `[redacted key]`). Apply it to the final returned object (a small recursive helper over strings, arrays and plain objects), so labels, keys, details and error text are all covered.

## Tests (required)

- `machine/test/fixtures/fake-pi.js`: add an opt-in mode by env, `FAKE_PI_DOWNLOAD_MS=<ms>`. In that mode the fake prints `fd not found. Downloading...` before its ready screen, then after `<ms>` prints `fd installed to /tmp/fake/fd`. Any input line received before that is not processed: the fake prints `Startup is still in progress` and keeps the line as pending. After the download finishes, an empty input line (a bare Enter) processes the pending line as a normal turn. Without the env var the fake behaves exactly as today.
- `machine/test/pi.test.js`: `readyText` false with a download line and no completion line; true once `fd installed to …` follows; true when `Failed to download fd: fetch failed` follows; false when the completion line comes **before** a second, unfinished download line (`rg`).
- `machine/test/pi-turns.test.js`: a full service lifecycle with `FAKE_PI_DOWNLOAD_MS` set (copy the existing lifecycle test at `:32`), where the first message is queued at start (`first_message`/brief). The turn completes and a `turn-ended` event is forwarded. Then a second variant where readiness is forced early (stub `readyText` to return true from the start), to prove the Enter fallback alone delivers the pending message.
- `machine/test/pi-turns.test.js`: a `tool_execution_start` hook with `args: { command: 'echo sk-or-v1-0000synthetic0000' }` through the real `machine/hook.sh pi` path: the spooled event JSON contains no `sk-or-` and contains `[redacted key]`. Also a direct `hookEvent` check for `turn-ended` and `turn-failed` objects with a synthetic key in any string field.

## Ownership boundary

- `machine/adapters/pi.js`, `machine/service.js` (only `submit`, `checkReady` and a new Pi follow-up helper beside them), `machine/test/pi.test.js`, `machine/test/pi-turns.test.js`, `machine/test/fixtures/fake-pi.js`
- Your report `docs/plans/openrouter-harness/reports/R1-1.md`

## Validation

```bash
bash machine/test/run.sh
node --test viewer/test/*.test.js
```

Both must pass in full (glob unquoted). If a pre-existing, unrelated machine test fails once (seen before: `service.test.js` EADDRINUSE, `project-tools-service.test.js` "tmux buffer failed"), re-run the suite once and paste both results. Paste the `# tests / # pass / # fail` lines and the names of the tests you added. Make no live model calls.

## Rules

- The lead's session is `wc-0679c9caaa67-lead-2`. A question this brief does not settle goes to the lead as a `message` card with `asks: true`.
- Stay inside your ownership boundary. If you must change a file outside it, stop and ask the lead.
- Never delete files with `rm` (or any other way). If something must be removed, ask the lead.
- Never run `./install.sh`. Never start a viewer server by hand.
- Never read, print or copy `/home/collin/.pi/agent/auth.json` or any OpenRouter key. Synthetic keys only (`sk-or-v1-0000synthetic0000`).
- Commit with `wc.js git commit --paths <comma-separated paths> -m "..."`. Your own `wc.js` and `card.js` calls are always allowed.
- Write your report to `docs/plans/openrouter-harness/reports/R1-1.md` and commit it, pasting the actual output of every validation command and listing the files you changed.
- End the report with a section **Choices**: list each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.
- Then post your `result` card with task id **R1-1**.
- If the same gate fails twice, stop and report rather than iterating.
