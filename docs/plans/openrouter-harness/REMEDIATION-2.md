# Remediation 2 — openrouter-harness

Verification attempt 2 on `cbbaa212`. Claude verifier: PASS. GPT verifier: FAIL. Its gap list, verbatim:

> GAP: Keeping the key secret — A stopped Claude worker or login record can capture a live Pi pane with a matching name prefix. Redaction follows the requested record’s CLI, so both older endpoints returned HTTP 200 with an unredacted synthetic key. — [Agent capture](machine/service.js:526), [agent probe](/tmp/wc-openrouter-v4.hBiR2l/pane-redaction-probe.log:2), [login probe](/tmp/wc-openrouter-v4.hBiR2l/combined-login-probe.log:4)
>
> GAP: Stale sign-in submission (Decision 25) — After real Pi accepted Ctrl+C and exited, the old prompt remained visible in scrollback. `/code` returned HTTP 200 and the inactive pane echoed the synthetic key. The spec requires HTTP 409. — [Prompt parser](machine/adapters/pi.js:22), [real Pi probe](/tmp/wc-openrouter-v4.hBiR2l/combined-login-probe.log:1)
>
> GAP: Default Pi directory (Decision 25) — Pi inherits `PI_CODING_AGENT_DIR` for the default account, but Wheelchair reads credentials and sessions from `~/.pi/agent`. The isolated probes reproduced a failed sign-in after the credential was saved, a missing transcript, and zero spend despite a recorded charge. — [Directory resolution](machine/adapters/pi.js:8), [sign-in probe](/tmp/wc-openrouter-v4.hBiR2l/account-probe.log:1), [transcript and spend probe](/tmp/wc-openrouter-v4.hBiR2l/custom-dir-spend.log:1)
>
> GAP: Sign-in completion (Decision 25) — If the login pane dies before submission, a previously saved credential makes the new attempt report `done`. The isolated probe killed a fresh pane at the key prompt and reproduced the false success. — [Completion check](machine/service.js:1529), [probe](/tmp/wc-openrouter-v4.hBiR2l/account-probe.log:3)
>
> GAP: Provider placement — A machine with a saved OpenRouter credential and no Pi executable still advertises the account as eligible. The hub selected OpenRouter with Claude available, then worker startup failed with `Pi is not installed`. — [Machine status](machine/service.js:1562), [placement probe](/tmp/wc-openrouter-v4.hBiR2l/placement-probe.log:4)

Triage: gaps 3, 4 and 5 are rare paths, recorded in PLAN.md Accepted Risks (`verification-2`). Gaps 1 and 2 are secret leaks, always fixed; lead agreed 2026-11-20 and logged Decision 28. Neither gap is a survivor of attempt 1.

## Task R2-1 — Exact pane targets with redaction everywhere; refuse a stale sign-in paste

One task, GPT, Standard tier. The brief is below as sent.

---

# Task R2-1 — Close two key leaks in machine pane capture and Pi sign-in (plan `openrouter-harness`)

Read `docs/plans/openrouter-harness/REMEDIATION-2.md` (this file) above the brief, and Decision 28 in `PLAN.md`.

## Objective

**Gap 1: pane captures (Decision 28).** In `machine/service.js`:

- `pane(name, color, history)` (agent pane, about `:526-531`): capture with the exact target `=${name}:` for **every** CLI, instead of `-t name`. Return the output through `adapters.pi.redact(...)` for **every** CLI, not only Pi. Keep `-J` for Pi only and every other flag unchanged.
- `loginPane(account)` and `loginState(account)` (about `:1511-1530`): use the exact target `=wc-login-${account}:` for every CLI (today Claude, Codex and Antigravity use the bare prefix name), and redact every capture whatever `record.cli` is.
- Leave other `capture-pane` calls (the restart recovery at about `:485`, the `/code` prompt check) as they are unless they use a prefix target for a named session; if they do, make them exact too and list them in the report.

**Gap 2: stale sign-in paste.**

- `machine/adapters/pi.js` `parseLogin(pane)`: report `wantsCode` only when the **last non-empty line** of the pane, trimmed, is exactly `Enter OpenRouter API key:`, and the pane does not contain `Saved API key for OpenRouter` or `__wc_login_exit`. Remove the last-five-lines window.
- `machine/service.js` `/code` (about `:1990`): for an adapter with `codeNeedsPrompt`, also refuse with the same 409 ("the sign-in screen has moved on; start again") when the fresh capture contains `__wc_login_exit`. Nothing may be sent to tmux (no `load-buffer`, `paste-buffer` or `send-keys`) on any refusal.

## Tests (required)

- `machine/test/pi.test.js` (or a new `machine/test/pane-target.test.js`), on a **private tmux server** like `machine/test/pi-login.test.js:18` does (copy its socket setup): create a live session `wc-x-worker-2` whose pane prints `sk-or-v1-0000synthetic0000`; register a **stopped** Claude session record named `wc-x-worker` (no tmux session) in the service; `GET` its pane through the service's pane path (as the HTTP route at about `:2031` does, or `service.pane('wc-x-worker')`) must not return the live pane's text: either it fails (409) or returns no `sk-or-` and not the sibling's content. Same for login: a live `wc-login-work-2` pane printing the synthetic key, a Claude login record for `work` with no pane: `loginPane('work')` and `loginState('work')` return neither the key nor the sibling's text.
- A redaction check for a non-Pi agent pane: a live Claude session whose pane prints the synthetic key returns `[redacted key]` from `pane()`.
- Cancel then paste, real tmux with the fake Pi login used in `machine/test/pi-login.test.js:18` (extend the fake if needed so it exits on Ctrl+C / SIGINT like real Pi): start the Pi sign-in, wait for `wantsCode`, send `C-c` through the service's `/keys` path, wait for the `__wc_login_exit` marker, then submit a code through `/code`: HTTP 409 with the message above, and afterwards the pane does not contain the submitted text and `tmux list-buffers` shows no wheelchair buffer.
- `parseLogin` unit cases: prompt as last line → wantsCode; prompt followed by `^C` → null; prompt followed by the exit marker → null; prompt followed by a shell prompt line → null.
- The existing tests must still pass; update an existing expectation only where it asserted the old prefix target string, and list each one in the report.

## Ownership boundary

- `machine/service.js` (only `pane`, `loginPane`, `loginState`, the `/code` handler and any other named-session `capture-pane` call), `machine/adapters/pi.js` (`parseLogin` only)
- `machine/test/` files: `pi.test.js`, `pi-login.test.js`, `code-submit.test.js`, a new `pane-target.test.js`, `fixtures/fake-pi*` (login part), and any existing test that asserted a prefix pane target
- Your report `docs/plans/openrouter-harness/reports/R2-1.md`

## Validation

```bash
bash machine/test/run.sh
node --test viewer/test/*.test.js
```

Both must pass in full (glob unquoted). If a pre-existing, unrelated test fails once (seen before: machine `service.test.js` EADDRINUSE, `project-tools-service.test.js` "tmux buffer failed"; viewer `app-quiet.test.js` "6 message clears debt"), re-run that suite once and paste both results. Paste `# tests / # pass / # fail` and the names of the tests you added. Prove the new pane test discriminates: temporarily restore the old `-t name` target in `pane()`, run your test, paste that it fails, then restore (`git diff` must show only your intended change). Make no live model calls.

## Rules

- The lead's session is `wc-0679c9caaa67-lead-2`. A question this brief does not settle goes to the lead as a `message` card with `asks: true`.
- Stay inside your ownership boundary. If you must change a file outside it, stop and ask the lead.
- Never delete files with `rm` (or any other way). If something must be removed, ask the lead.
- Never run `./install.sh`. Never start a viewer server by hand. Use only private tmux servers (`-L`/`-S` sockets or `TMUX_TMPDIR`) in tests; never touch the user's default tmux server.
- Never read, print or copy `/home/collin/.pi/agent/auth.json` or any key. Synthetic keys only (`sk-or-v1-0000synthetic0000`).
- Commit with `wc.js git commit --paths <comma-separated paths> -m "..."`. Your own `wc.js` and `card.js` calls are always allowed.
- Write your report to `docs/plans/openrouter-harness/reports/R2-1.md` and commit it, pasting the actual output of every validation command and listing the files you changed.
- End the report with a section **Choices**: list each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.
- Then post your `result` card with task id **R2-1**.
- If the same gate fails twice, stop and report rather than iterating.
