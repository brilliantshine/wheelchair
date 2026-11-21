# Remediation 3 — openrouter-harness

Verification attempt 3 on `78da748e`. Claude verifier: PASS. GPT verifier: FAIL. Its gap list, verbatim:

> GAP: Keeping the key secret — An OpenRouter key accidentally submitted as a message in a Pi-led thread is saved verbatim and returned in the chat API’s thread object. An isolated probe confirmed both with a synthetic key. — [Probe output](/tmp/wc-0679-verify3.aLXlzQ/probe.log:3), [message storage](viewer/app/sessions.js:475), [chat response](viewer/app/chat.js:393)
>
> GAP: Existing-provider sign-in behavior — Settings clears the pasted code and displays “Start again” on any submission 409. I reproduced this with Claude and a generic `tmux submit failed` response. Before this build, the form displayed the error and kept the code available for retry. — [Probe output](/tmp/wc-0679-verify3.aLXlzQ/existing-signin-probe.log:1), [Settings error handler](viewer/pages/settings.js:1074)

Triage (lead's answers, 2026-11-20): gap 1 accepted as a rare path, recorded in PLAN.md Accepted Risks (`verification-3`): the user's own text in their own thread, never put there by wheelchair, the same for every provider today, and redacting user messages would change the other providers. Gap 2 fixed below. Neither gap survives an earlier attempt.

## Task R3-1 — Start again only for OpenRouter sign-ins

One task, Claude (interface work; T7 was Claude), Standard tier. The brief is below as sent.

---

# Task R3-1 — Keep the old sign-in error behaviour for non-OpenRouter providers (plan `openrouter-harness`)

## Objective

In `viewer/pages/settings.js`, the sign-in view's `send` handler (inside `openSignin(account, machine)`, about `:1069-1078`) does this on a failed code submission:

```js
catch (e) {
  inlineErr(codeBox, e.message);
  if (e.status === 409) { field.value = ''; codeBox.append(h('button', { ..., text: 'Start again', onclick: () => openSignin(account, machine) })); }
}
```

Before this build (base `dbb0a6b3`, `viewer/pages/settings.js:1059`) it was `catch (e) { inlineErr(codeBox, e.message); }`: the error showed and the pasted code stayed for another try. That change reached every provider, which the plan's idea rules out ("Replacing or changing how the existing four providers work").

Change it so the clear-the-field and **Start again** path runs only when the account's provider is `openrouter` (use the provider field the `account` object already carries; check how the rest of `openSignin` or the accounts list reads it). For every other provider a failure only shows the error and keeps the field's value, exactly as before the build. Avoid adding a second **Start again** button if one is already shown (a second 409 on an OpenRouter account). Leave the success path as it is.

## Tests (required)

- A browser test in `viewer/test/app-accounts.spec.js`, next to the existing sign-in test (around `:146-161`, which mocks `/accounts/<id>/signin/<machine>/code`; copy its mock setup), in both projects as that file already runs:
  1. a **Claude** account in `waiting` with a URL and `wantsCode`: the code route answers `409` with `{ "error": "tmux submit failed" }`: after **Send code**, the error text shows, the textarea still holds the pasted code, and there is no **Start again** button;
  2. an **OpenRouter** account in key-only `waiting` (no URL, `wantsCode: true`; see T7's `app-openrouter-signin.test.js` for the state shape): the code route answers `409` with "the sign-in screen has moved on; start again": the key field is cleared and one **Start again** button shows; pressing **Send code** again with a new value and another 409 still shows exactly one **Start again**.
- If `viewer/test/app-openrouter-signin.test.js:27` asserts the old unconditional 409 source text, update that assertion to the new condition and say so in the report.

## Ownership boundary

- `viewer/pages/settings.js` (only the `send` handler in `openSignin`)
- `viewer/test/app-accounts.spec.js`, `viewer/test/app-openrouter-signin.test.js`
- Your report `docs/plans/openrouter-harness/reports/R3-1.md`

## Validation

```bash
node --test viewer/test/*.test.js
cd viewer && npx playwright test test/app-accounts.spec.js test/app-settings.spec.js --reporter=line
npm --prefix viewer run test:browser
```

The full browser run takes about 12 minutes; start it with a long timeout or in the background and wait for it in the foreground. Paste the summary lines of each. One known pre-existing flake: `app-send-now.spec.js:84` (Chromium, Enter-to-send timeout); if only that fails, re-run that one spec 3 times and paste the result. Prove the new test discriminates: temporarily restore the unconditional 409 handling, run your new Claude test, paste that it fails, then restore (`git diff` shows only your intended change).

## Rules

- The lead's session is `wc-0679c9caaa67-lead-2`. A question this brief does not settle goes to the lead as a `message` card with `asks: true`.
- Stay inside your ownership boundary. If you must change a file outside it, stop and ask the lead.
- Never delete files with `rm` (or any other way). If something must be removed, ask the lead.
- Never run `./install.sh`. Never start a viewer server by hand; tests start their own isolated servers.
- Never read, print or copy `/home/collin/.pi/agent/auth.json` or any key. Synthetic keys only.
- Commit with `wc.js git commit --paths <comma-separated paths> -m "..."`. Your own `wc.js` and `card.js` calls are always allowed.
- Write your report to `docs/plans/openrouter-harness/reports/R3-1.md` and commit it, pasting the actual output of every validation command and listing the files you changed.
- End the report with a section **Choices**: list each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.
- Then post your `result` card with task id **R3-1**.
- If the same gate fails twice, stop and report rather than iterating.
