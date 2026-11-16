---
slug: sudo-cards
date: 2026-11-15
implemented-by: "standard gpt-6.1-terra (T1 helper, T2 installer, T3 machine); standard claude-sonnet-5-5 (T4 hub and page); light gpt-6-luna (T5 routers, T6 page fix); sub-lead claude-opus-5-5"
verified-by: []   # Stage 4 appends; Stage 3 leaves this empty.
---

# Completion Report — Run sudo commands from a card

Written for a hostile reviewer: every claim checkable, no claim without evidence. Line numbers
are at commit `660b8dc` plus this report's commit. Worker reports: `docs/plans/sudo-cards/reports/T1.md`–`T6.md`.

## Spec coverage

No Prior Work items; every row is `this run`.

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| Who may ask: only a lead posts `sudo`; hub and machine both refuse other roles | this run | `viewer/app/card.js:35` (roles), `viewer/app/cards.js:47` (hub validate with role); `machine/service.js:1025` | `viewer/test/app-sudo.test.js:107,141`; `machine/test/sudo.test.js:26` (worker → 403, helper not called) |
| Role docs: lead/sub-lead/worker/cards say so; lead.md "only when truly needed, smallest command, plain `does`/`why`" | this run | `protocol/app/cards.md:245`; `protocol/app/lead.md:320`; `protocol/app/sub-lead.md:93`; `protocol/app/worker.md:13` | read-through |
| Card fields `command` (≤4096 bytes, no NUL), `does`, `why`; agent may send only these | this run | `viewer/app/card.js:58-62`, `viewer/app/card.js:63-68` (machine-added fields, hub only) | `viewer/test/app-sudo.test.js:91,115` |
| Flow 2: machine registers with helper before spooling, adds `request_id`/`url`/`editable`; helper missing → non-zero with the install message | this run | `machine/service.js:1023-1032`; `machine/lib/sudo.js:50-56` | `machine/test/sudo.test.js:26` (forged fields overwritten; exact 503 text; helper 422 passed through) |
| Flow 3: card shows full command (monospace, wrapping), does, why, Open to run (new tab), Decline, Talk about it; no password field in hub pages | this run | `viewer/pages/thread.js:692-739`; CSS `viewer/pages/thread.css` | `viewer/test/app-sudo.spec.js:32,114` |
| Flow 4: states waiting/running/ran/declined/expired/failed; buttons only in waiting | this run | `viewer/pages/thread.js:710-736` | `viewer/test/app-sudo.spec.js:71` |
| Correlation: `request_id` only key, hub `request_id → card id` index in thread state | this run | `viewer/app/cards.js:79-87` | `viewer/test/app-sudo.test.js:126,164` |
| `POST /api/machine/sudo-outcome`, idempotent, unknown id 409 | this run | `viewer/app/routes.js:349`; `viewer/app/cards.js:175-186` | `viewer/test/app-sudo.test.js:176,191,220,238` |
| One state handler `applySudoState`: rank order, never back to waiting, one lead message on first terminal state in the same save | this run | `viewer/app/cards.js:133-162` (enqueue saves: `viewer/app/sessions.js:297-309`) | `viewer/test/app-sudo.test.js:191,220,238` |
| Machine request file `sudo-requests.json` 0600 atomic | this run | `machine/lib/sudo.js:21-31` | `machine/test/sudo.test.js:26` (mode check) |
| Poll every 2 s until terminal; saved terminal never replaced | this run | `machine/lib/sudo.js:66-75,86-96`; timer `machine/service.js:1063` | `machine/test/sudo.test.js:26` (saved `ran` vs later `expired`) |
| Save "accepted" before deleting spool file (immediate relay and drain) | this run | `machine/service.js:1042`, `machine/service.js:730` | `machine/test/sudo.test.js:26` (card spooled while hub 503, outcome withheld until drain) |
| Outcomes only after acceptance; retry on 5xx/409/no connection; newest state only; drop after terminal ack | this run | `machine/lib/sudo.js:97-113` | `machine/test/sudo.test.js:26` (409 twice, same delivery_id, then 200 → entry dropped) |
| Restart reloads and resumes; unknown id at helper answers `expired` | this run | `machine/service.js` `init` → `this.sudo.load()`; `sudo-helper/helper.py:279` | `machine/test/sudo.test.js:26` (second service instance on same state dir) |
| Decline: one synchronous call, 10 s overall, machine answers saved terminal first, saves helper terminal answer first (Decision 22); unreachable → error text, nothing saved; "Declining…" page-only | this run | `viewer/app/threads.js:245-264`; `viewer/app/machine-client.js:82-96`; `machine/service.js:1015-1019`; `machine/lib/sudo.js:77-84`; `viewer/pages/thread.js:718` | `viewer/test/app-sudo.test.js:264,281,295,307,332`; `viewer/test/app-sudo.spec.js:135`; `machine/test/sudo.test.js:26` |
| Helper: transitions atomic under one lock; cancel during password check wins | this run | `sudo-helper/helper.py:149-190`, `sudo-helper/helper.py:312-317` | `sudo-helper/test/test_helper.py:89` |
| Lead messages: `sudo ran: exit <n>` + output, `declined`, `sudo expired`, `sudo failed: <reason>`, `talk about: sudo request` (card stays waiting) | this run | `viewer/app/cards.js:152-159`; `viewer/app/threads.js:249-252` | `viewer/test/app-sudo.test.js:220,249` |
| Helper lives in `sudo-helper/`, runs only from installed root-owned copy | this run | `sudo-helper/AGENTS.md`; `sudo-helper/install.sh:38-41` | `sudo-helper/test/install-test.sh` |
| Install: guard, copy to `/usr/local/lib/wheelchair-sudo/` (0755/0644 root), config `user`/`url_base`, unit, enable, `tailscale serve --bg --https=8445 unix:…/page.sock`, idempotent, `--uninstall` | this run | `sudo-helper/install.sh:6,7,19-26,42,44-65` | `sudo-helper/test/install-test.sh` (files, modes, config, unit, shim call log, idempotence, uninstall, refusals, guard exit 3) |
| `./install.sh` never touches the helper, prints one-line hint when missing | this run | `install.sh:69-71` | `install/test/run.sh` "missing sudo helper prints install hint" |
| Sockets: `page.sock` 0600, `intake.sock` 0660 group = user's group | this run | `sudo-helper/helper.py:331-341` | not exercised by tests (tests bind their own sockets); read-through |
| Intake API `POST /requests` (128-bit hex id, url), `GET /requests/<id>`, `POST /requests/<id>/cancel` | this run | `sudo-helper/helper.py:291-300,267-285,302-318` | `sudo-helper/test/test_helper.py:66,89,103` |
| Page: fixed HTML, static JS/CSS from helper, shows command/does/why/user, password box `autocomplete=current-password`, Run → red Confirm for 5 s, mobile-first, unknown id outcome | this run | `sudo-helper/static/page.html:2`; `sudo-helper/static/page.js:31-41`; `sudo-helper/static/page.css` | `sudo-helper/test/test_helper.py:66` (no request data in HTML) |
| Run POST then poll status; show exit code and output | this run | `sudo-helper/static/page.js:43-54` (T6: keeps checking after a dropped POST, `:53`) | read-through; `node --check` |
| Rendering contract: `textContent` only, `/r/<id>/data` JSON | this run | `sudo-helper/static/page.js:12-25`; `sudo-helper/helper.py:280-284` | `sudo-helper/test/test_helper.py:66` (`</script><script>…` and `<img onerror>` round-trip as data; sink grep) |
| Headers: no-store, no-referrer, exact CSP, X-Frame-Options DENY | this run | `sudo-helper/helper.py:21,249-251` | `sudo-helper/test/test_helper.py:66` (CSP and Cache-Control asserted) |
| Running 1a: `runuser -u <user> -- sudo -S -k -v -p <sentinel>`, password written only after sentinel, fail closed without prompt | this run | `sudo-helper/helper.py:110-147,157,162-163` | `sudo-helper/test/test_helper.py:78` (NOPASSWD shim → failed, command not run) |
| Running 1b: `sudo -S -k -l -u root -p <sentinel> -- /bin/sh -c <command>`; not allowed → failed with the Spec's message | this run | `sudo-helper/helper.py:172,178-180` | `sudo-helper/test/test_helper.py:78` (denied shim) |
| Wrong password counts tries, third → failed | this run | `sudo-helper/helper.py:165-171` | `sudo-helper/test/test_helper.py:78` |
| Run 2: `/bin/sh -c` as root, stdin /dev/null, cwd /, env PATH/HOME/LANG only, new process group; syslog line per run | this run | `sudo-helper/helper.py:193,229` | `sudo-helper/test/test_helper.py:66` (ran) |
| Run 3: 10-minute limit, SIGTERM then SIGKILL after 10 s | this run | `sudo-helper/helper.py:196-210` | `sudo-helper/test/test_helper.py:98` |
| Run 4: first/last 32 KiB with `[… N bytes cut …]` | this run | `sudo-helper/helper.py:211-225` | `sudo-helper/test/test_helper.py:98` |
| Run 5 / password never stored, logged, echoed, returned | this run | `sudo-helper/helper.py:134,142,173,188,308-311` | every helper test's `tearDown` (`sudo-helper/test/test_helper.py:49-55`); machine and installer suites grep for the test password |
| `~` refused; `shlex` scan with `commenters=''`; unbalanced quotes refused; editable flag from owner/group/mode, missing path via nearest parent | this run | `sudo-helper/helper.py:51-87` | `sudo-helper/test/test_helper.py:103` |
| Editable warning on thread card and helper page | this run | `viewer/pages/thread.js:698`; `sudo-helper/static/page.html:2`, `page.js:15-21` | `viewer/test/app-sudo.spec.js:59` |
| "Open on another device" line under password box | this run | `sudo-helper/static/page.html:2` | read-through |
| All paths absolute and configurable only in the root-owned config | this run | `sudo-helper/helper.py:22,26-48` | `sudo-helper/test/test_helper.py:113` (unknown key refused) |
| Logging: method and path only, never bodies | this run | `sudo-helper/helper.py:241-242` | helper tests capture syslog and assert no password |
| Lifetime: memory only; waiting expires after 1 h; closed kept 24 h | this run | `sudo-helper/helper.py:96-102` | `sudo-helper/test/test_helper.py:89` |
| Routers: `sudo-helper/AGENTS.md`, root `AGENTS.md`, `machine/API.md`, `viewer/app/API.md` | this run | see Routers | read-through |

## Deviations from plan

- The machine's cancel route is `POST /v1/sudo/<request_id>/cancel` (the Spec writes `/sudo/<request_id>/cancel`): every machine route lives under `/v1`. Recorded in the plan Log.
- Test-only seams not named in the Spec: `WHEELCHAIR_SUDO_INTAKE` (machine's intake socket path), `WHEELCHAIR_SUDO_POLL_MS` (poll interval), `WHEELCHAIR_SUDO_TEST_ROOT` (installer and the `./install.sh` hint check paths; also skips the EUID check and `chown`).
- The helper's config has extra keys beyond `user`/`url_base` (`socket_dir`, `runuser`, `sudo`, `sh`, `static_dir`, timing and `max_tries`), all defaulted; the Spec says paths are "configurable only in the root-owned config", which this is.
- The page's Run POST stays open until the command finishes (T1 choice); the page polls status meanwhile and, after T6, keeps checking if the POST drops.
- All 22 worker choices are in the PLAN.md Log as `Choice:` lines.

## Routers

- `sudo-helper/AGENTS.md` (new): file/role table, runs only from the installed copy, how it is installed and tested.
- Root `AGENTS.md`: `sudo-helper/` in the Executable row and the "Where to go" table; a paragraph naming the helper as the third reach outside the clone and the only one that runs as root; `install.sh` row mentions the hint; `.gitignore` row mentions `__pycache__/`; two Verification lines.
- `CONTRIBUTING.md`: the same two validation lines.
- `machine/AGENTS.md`: row for `lib/sudo.js`. `machine/API.md`: the cancel route, sudo handling on `/v1/agent/cards`, the request file.
- `viewer/app/API.md`: `sudo-outcome` and the sudo presses.
- `protocol/app/cards.md` (sudo kind), `lead.md`, `sub-lead.md`, `worker.md` as in Spec coverage.

## Validation evidence

Run by the sub-lead on the feature branch at `660b8dc` after every merge (the viewer's npm dependencies installed in this worktree with `npm --prefix viewer ci`; without them the font-route test fails because fonts are served from `node_modules`).

```
$ python3 -m unittest discover -s sudo-helper/test -v
test_cancel_race_and_expiry ... ok
test_config ... ok
test_run_and_headers_rendering ... ok
test_scan_and_refusals ... ok
test_timeout_and_truncation ... ok
test_wrong_nopass_denied ... ok
Ran 6 tests in 5.378s
OK

$ bash sudo-helper/test/install-test.sh
PASS helper installer, idempotence, uninstall and refusals

$ bash machine/test/run.sh
# tests 98
# pass 98
# fail 0

$ node --test viewer/test/*.test.js
not ok 283 - a starter that loses the freed port registers through the new holder
# tests 404
# pass 403
# fail 1

$ npm --prefix viewer run test:browser
  2 skipped
  610 passed (2.2m)

$ bash install/test/run.sh
FAIL real wheelchair directory is byte-identical after suite
RESULT 90 passed, 1 failed

$ bash sensitivity/test/run.sh   -> RESULT 64 passed, 0 failed
$ bash seen/test/run.sh          -> RESULT 21 passed, 0 failed
$ bash codex/test/run.sh         -> RESULT 78 passed, 0 failed
$ node --test test-support/test/*.test.js -> # pass 6, # fail 0
```

The two failures are pre-existing and unrelated, each reproduced on the feature branch before the change that would have touched it:
- `viewer/test/lifecycle.test.js` "a starter that loses the freed port registers through the new holder": fails identically at `d5717bc` (before T4's merge), and in T4's own baseline run.
- `install/test/run.sh` "real wheelchair directory is byte-identical after suite": fails identically at `286e32e` (before T2's merge); the always-on hub writes `$HOME/.wheelchair/accounts` while the suite runs.

`./install.sh` was not run: this is a worktree, and it refuses.

## Known gaps / residual risks

- **Nothing here ran against real `sudo`, `runuser`, `systemctl` or `tailscale`.** In particular, `sudo -S -k -v -p <sentinel>` and `sudo -S -k -l -u root -p <sentinel> -- /bin/sh -c …` are exercised only through shims; that `-k` combines with `-v` and `-l` this way on Debian 13's sudo, and that the `-p` prompt is written to stderr under `-S`, are assumptions. First real install should run one harmless card (e.g. `command: id`) and one wrong-password try.
- The sockets' modes and the intake socket's group are set in `main()` and not exercised by the tests (tests bind their own sockets in-process).
- The Run POST is held open for the whole command (up to 10 minutes) through `tailscale serve`; T6 makes the page recover if it drops, but the proxy's timeout behaviour is untested.
- The helper page shows "No such request" for both an unknown id and an expired request (the intake shape answers `expired` for both).
- If no lead session exists at all when a terminal outcome arrives, the card is updated but no message is queued (T4 choice).
- Accepted risks from the plan stand unchanged (lookalike page, same-user browser, intake socket bypass of lead-only, tailnet URL visibility, clone tampering before install).
- The T1 worker worktree (`wc-306ee0793e11-w1`) is left in place: untracked `__pycache__` from a test run made `git worktree remove` refuse, and the build forbids `rm`. It is merged and safe to remove with `--force`.

## Remediation rounds

Appended by Stage 4 loops; never erase earlier content.
