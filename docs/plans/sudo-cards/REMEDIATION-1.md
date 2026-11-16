# Remediation 1 — sudo-cards

Verification attempt 1 at `0087751`. Claude verifier (`wc-306ee0793e11-verifier`): FAIL. GPT verifier (`wc-306ee0793e11-verifier-2`): pending at the time of writing; its gaps, if any, are appended below.

## Gap list (verbatim)

GAP: Page, "Run POST … polls … until done, then shows exit code and output" — if Collin mistypes his password once and then runs successfully, the helper page shows "Wrong password (2 tries left)" with the output, and the exit code never appears. — `sudo-helper/helper.py:170` sets `request['message'] = 'Wrong password'`. Nothing clears it later, and `helper.py:283-284` sends it back on every `/data` call whatever the state is. `sudo-helper/static/page.js:22` shows `data.message` in place of the state's own line (`'Exit code: ' + data.exit_code`, or the failure reason). I checked this with a probe that uses the suite's own fixture (one wrong try, then the right password). The run answered `{'state': 'ran', 'exit_code': 0, …}`, and `/r/<id>/data` then returned `{'state': 'ran', 'exit_code': 0, …, 'tries_left': 2, 'message': 'Wrong password'}`. The same thing happens on the third wrong try: the page says "Wrong password (0 tries left)" instead of the reason "wrong password 3 times". A typo followed by a good run is the normal case on a phone, and Collin would come away thinking the command didn't run. No test covers it, because `test_wrong_nopass_denied` only looks at `state`.

## Tasks

### R1-1 — the wrong-password message must not outlive the waiting state

Brief: see the R1-1 brief file (scratchpad); summary: in `sudo-helper/helper.py`, `/r/<id>/data` includes `message` only while `state == 'waiting'`, and `message` is removed from the request when the password check passes; in `sudo-helper/static/page.js`, the message line is shown only when `data.state === 'waiting'`; new test in `sudo-helper/test/test_helper.py` covering one wrong try then a good run (data has no `message`, has `exit_code` 0) and three wrong tries (data has no `message`, `reason` is `wrong password 3 times`). Lane: light, `--provider gpt` (T1 was built by GPT).

## GPT verifier (`wc-306ee0793e11-verifier-2`): FAIL — gap list (verbatim)

GAP: Helper page must show the outcome and exit code — a wrong-password message persists after a successful retry and overrides the result — shim reproduction returned `state=ran, exit_code=0`, but the page rendered “Wrong password (2 tries left)” (`sudo-helper/helper.py:170`, `sudo-helper/static/page.js:22`).
GAP: Helper page must poll until completion — if the Run connection drops during password checking, recovery can see `waiting` and stop polling permanently — reproduction left the password form visible with zero polling timers after the helper reached `ran` (`sudo-helper/static/page.js:25`, `:53–54`).

The first gap is the Claude verifier's gap, covered by R1-1. The second is new: R1-2.

### R1-2 — the page keeps polling while the password check is in progress

Runs after R1-1 merges (same files). `/r/<id>/data` reports `checking: true` while the helper is checking the password for that request; `page.js` treats waiting-and-checking like running: form hidden, status "Checking password…", reloads every second. Test in `test_helper.py` with the `slow` shim mode. Lane: light, `--provider gpt`.
