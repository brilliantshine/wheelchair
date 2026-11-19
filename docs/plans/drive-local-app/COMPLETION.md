---
slug: drive-local-app
date: 2026-11-18
implemented-by: "gpt standard / gpt-6.1-terra (T1a, T1c, T1d at effort xhigh); gpt light / gpt-6-luna (T2, T4, T1e, T1f); claude standard / claude-sonnet-5-5 (T3 attempt 1); claude light / claude-haiku-5-5 (T3 attempt 2, T3c); sub-lead: claude-opus-5-5"
verified-by: []
---

# Completion Report — Agents run, screenshot and drive the app they build

Written for a hostile reviewer: every claim checkable, no claim without evidence. Line
numbers are at the commit named in the verification brief. There is no Prior Work, so every
row's origin is `this run`.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| `wc.js screen <op>` posts `{op, args}` to `POST /v1/agent/screen` with the session token, plain `request()`, 200 body to stdout, non-2xx (never 503) to stderr as `wc: <body>` with exit 1 | this run | `viewer/app/wc.js:98-103` (`screenRequest`), `:172-173` (dispatch), existing error branch `:179-180` | `viewer/test/wc-screen.test.js` (per-op tests, `:82`, `:90`, `:118`) |
| Route `POST /v1/agent/screen`, session-token auth like `/v1/agent/git` | this run | `machine/service.js:1616` | `machine/test/screen.test.js:73`, `:85` |
| Reviewer refused 403 on every op; non-Linux 422 | this run | `machine/lib/screen.js:198-199` | `screen.test.js:85` |
| Statuses 400/403/409/422, never 503 | this run | `screen.js:12`, `:109`, `:111-112`, `:136`, `:138`, `:164`, `:182`, `:219`; `screen-args.js:7`; `screen-input.js:22-26` | `screen.test.js:85`, `:93`, `:138`; `screen-args.test.js` |
| `start [--size WxH]` default 1280x800, each side 200–2560, idempotent | this run | `screen-args.js:25` (`parseOp`); `screen.js:132-176` | `screen-args.test.js:7`; `screen.test.js:73`, `:85` |
| `run [--env K=V]... -- <cmd>`: `--` required, `env --` always, first word with `=` or `-` refused, `DISPLAY`/`XAUTHORITY`/`WHEELCHAIR_SESSION_TOKEN` refused | this run | `screen-args.js:25`; argv built at `screen.js:186-187` | `screen-args.test.js:25`; `screen.test.js:93`, `:105` |
| Command resolved before launch, `422 command not found` | this run | `screen.js:18-21`, `:182` | `screen.test.js:93` |
| Launch environment rebuilt from the session (as `startIn`), without the token, plus `DISPLAY`/`XAUTHORITY`; `--env` only inside `env` | this run | `machine/service.js:611-613` (`launchEnv`), `:624-626` (startIn uses it, tmux command unchanged); `screen.js:179-181`, `:186` | `screen.test.js:93`; existing `machine/test/service.test.js` unchanged and passing |
| Codex sandbox wrap for a non-`unrestricted` Codex session only | this run | `screen.js:187` | `screen.test.js:93` |
| App spawned detached, cwd worktree, log `app-<n>.log` | this run | `screen.js:185`, `:190-192` | `screen.test.js:93`, `:177`; live check |
| Auto-focus on `run`: baseline before launch, poll 250 ms up to 5 s, probes 1 s, phase ≤ 6 s, first new window, `focused` or null; focus failure still a successful `run` | this run | `screen.js:183`, `:194`; `screen-input.js:47-49`, `:115-131` | `screen-input.test.js:45`, `:46`; `screen.test.js:177`, `:228`; live check ("run chromium reports focused as its own window") |
| `shot [--window id]`, x11grab, 15 s, temp + rename, window crop clipped, 422 when gone/off screen | this run | `screen-input.js:50-69`; `screen.js:224` | `screen-input.test.js:38`; live check ("shot PNG exists, is non-empty and is a PNG") |
| Shot/app counters per session, never reused across `screen stop`/`start` and restart | this run | `screen.js:45-53` (`load`, counters from files), `:224` | `screen.test.js:146` |
| `windows`: viewable direct children of the root via `xwininfo`, untitled `""`, none `[]` | this run | `screen-args.js:87-105`; `screen-input.js:32-46` | `screen-args.test.js:49`; `screen-input.test.js:36`, `:37`; live check ("windows lists exactly the two top-level windows by id", "the second window has name \"\"") |
| `move`/`click`/`drag`, validated decimal integers, 10 s per op, mouseup always attempted | this run | `screen-args.js:8`, `:25`; `screen-input.js:70-84` | `screen-args.test.js:7`; `screen-input.test.js:39`; live check (click) |
| `type`: 1–400 chars printable ASCII + `\n`/`\t`, sent as one literal argv after `--`, timeout 10 s + 30 ms/char | this run | `screen-args.js:25`, `:86`; `screen-input.js:85-92` | `screen-args.test.js:43`; `screen-input.test.js:40`; live check ("type of 400 characters arrives whole") |
| `key`: fixed key list, modifiers once, ≤20 taps, `--hold` 50–5000 ms with ≤6 tokens incl. lone modifier, keydown in order / keyup reversed | this run | `screen-args.js:12-24`, `:25`; `screen-input.js:93-113` | `screen-args.test.js:31`; `screen-input.test.js:41` |
| Key op deadline (10 s + hold), cut-off tap released, releases in parallel at 500 ms each, failed release locks input until `screen stop` | this run | `screen-input.js:93-113`; lock at `screen.js:220`, `:230`, cleared by `reset` `:55` | `screen-input.test.js:42`, `:43`; `screen.test.js:202` |
| `focus <id>` | this run | `screen-input.js:114`; `screen.js:229` | `screen-input.test.js:44` |
| `stop` (graceful: SIGTERM, then SIGKILL + stop after 3 s) and `status` (apps `running`/`exited`) | this run | `screen.js:93-98`, `:213-218` | `screen.test.js:235`, `:177`, `:73`; live check (child and slice gone after stop) |
| Ops other than start/run/stop/status need a screen (`422 no screen; run wc.js screen start first`) | this run | `screen.js:219` | `screen.test.js:73` |
| One screen per session; per-session queue; state in `state.json` after every change | this run | `screen.js:40-44`, `:201-203` | `screen.test.js:73` |
| Who may call: record exists, not stopped, thread not archiving, tmux live (`null` → 422 "could not check"); tmux gone on start/run kills the slice and 409 | this run | `screen.js:107-114` | `screen.test.js:85`, `:211` |
| One systemd user slice per screen; names from state-dir hash, thread, session hash and generation; `--expand-environment=no` on systemd ≥254 | this run | `screen.js:13`, `:34`, `:38-39`, `:52`, `:119-123`, `:141` | `screen.test.js:93`, `:105`; live check (slice checks) |
| Generation fence: reserved in `state.json` (`starting`) before spawn; scope that registers after a teardown kills itself and 409 | this run | `screen.js:115-117`, `:124-131`, `:140-141`, `:161`, `:193` | `screen.test.js:155` |
| Xvfb with `-displayfd`, `-auth` cookie (mcookie + xauth, 0600), `-nolisten tcp`, 10 s start timeout; cookie under `:N` afterwards | this run | `screen.js:144-167` | `screen.test.js:73`; live check ("an X client without the cookie is refused") |
| Missing tools named (422); no `systemctl --user` → 422 | this run | `screen.js:10`, `:135-138` | `screen.test.js:138` |
| Immediate teardown on session stop (SIGKILL + `stop --no-block`, one 1 s deadline), before a verifier's worktree is removed | this run | `screen.js:59-67`; `machine/service.js:782` | `screen.test.js:195`, `:171` |
| Archive: one thread-slice kill + stop sharing 1 s, bumps every generation of the thread; screens dir removed exactly when uploads are, kept with them; removal failure logged | this run | `screen.js:68-72`; `machine/service.js:817`, `:878` | `screen.test.js:122`, `:185` |
| Sweep every 60 s: tears down screens whose tmux is confirmed gone, stops unheld screen slices (including an older generation), leaves `starting` screens | this run | `screen.js:99-106`; timer `machine/service.js:367-368`, cleared `:1634` | `screen.test.js:113`, `:155` |
| A screen whose Xvfb died is treated as no screen | this run | `screen.js:134`, `:208` | `screen.test.js:211` |
| Service restart: SIGKILL + stop on its own parent slice, every `state.json` marked no screen, counters kept; bounded so init cannot hang | this run | `screen.js:74-91`; `machine/service.js:366` | `screen.test.js:131`, `:219`, `:146` |
| Isolation: route acts only on the caller's own screen, no display/session argument | this run | `screen.js:37`, `:200-205` | `screen.test.js:73` |
| Session launch unchanged (no `DISPLAY` added) | this run | `machine/service.js:624-626` (same command text) | existing `service.test.js` passing |
| Rules: worker "Seeing a desktop app" | this run | `protocol/app/worker.md:39-41` | read |
| Rules: verifier live-app paragraph | this run | `protocol/app/verifier.md:68` | read |
| Rules: sub-lead passes screenshot paths on | this run | `protocol/app/sub-lead.md:174` | read |
| Rules: lead posts a screenshot with an `image` card | this run | `protocol/app/lead.md:762` | read |
| Docs: `machine/API.md` row; routers | this run | `machine/API.md:34`; `machine/AGENTS.md:14`; `viewer/AGENTS.md:18` | read |
| Validation: fake-tool tests in `bash machine/test/run.sh` | this run | `machine/test/screen.test.js`, `machine/test/screen-input.test.js`, `machine/test/screen-args.test.js` | evidence below |
| Validation: `viewer/test` test for `wc.js screen` | this run | `viewer/test/wc-screen.test.js` | evidence below |
| Validation: live check `machine/test/screen-live.sh` (SKIP with exit 0 when tools/user manager/Chromium missing) | this run | `machine/test/screen-live.sh`, `machine/test/screen-live.js` | evidence below |

## Deviations from plan

1. **Auto-focus skips a window that vanished instead of ending the phase.** The Spec says "a
   failed or timed out probe ends it with `focused: null`". In practice Chromium creates and
   destroys short-lived top-level windows while starting, so `xwininfo -id` on one of them
   fails, and the live check saw Chromium's `run` return `focused: null` after 960 ms. A
   per-window probe that **fails without timing out** now skips that window, the same way
   `windows` already skips it; a timed-out probe or a failed root listing still ends the
   phase with `null`, so the 1 s probe and 6 s phase bounds hold. Narrowed in Remediation 1:
   only a failure whose stderr says the window is gone (`Bad Window`, `Bad Drawable`, `No such
   window`) is skipped; any other probe failure ends the phase with `null`. `machine/lib/screen-input.js:22-24`, `:32-45`;
   tests `screen-input.test.js:37`, `:46`. Logged in PLAN.md (T1f).
2. **Fake-tool test split.** The Spec lists all fake-tool cases under `bash machine/test/run.sh`;
   they are spread across three files by module (`screen.test.js` for the manager and route,
   `screen-input.test.js` for X tools, deadlines and auto-focus, `screen-args.test.js` for
   argument rules). All run under `bash machine/test/run.sh`.
3. **`screen stop` returns before the processes are dead.** Graceful teardown sends SIGTERM and
   schedules SIGKILL + `stop` 3 s later on a timer (`screen.js:93-97`); the Spec says "then after
   3 s" without saying whether the op waits. If the service closes inside those 3 s the timer is
   dropped (`stopTimers`), and the next startup's parent-slice kill is the backstop.

## Routers

- `machine/AGENTS.md`: new row for `lib/screen.js` (screens, slices, launch, teardown) naming
  `test/screen-live.sh`; Remediation 1 added rows for `lib/screen-input.js` and
  `lib/screen-args.js` (`machine/AGENTS.md:15-16`).
- `viewer/AGENTS.md`: the `wc.js` row names `wc.js screen`.
- `machine/API.md`: route row for `POST /v1/agent/screen`.

## Validation evidence

Run by the sub-lead on hearth, 2026-11-18. The suites ran at `d1b7ee4`. The only non-plan change after that is `machine/test/screen-live.js` (T3c: cleanup env), which neither suite runs. The live check ran on the T3c tip `ba6a089`, which is the commit sent for verification apart from this report and PLAN.md.

```text
$ bash machine/test/run.sh          # at d1b7ee4
machine exit 0
# tests 205
# pass 205
# fail 0

$ node --test viewer/test/*.test.js # at d1b7ee4, load average ~33
viewer exit 0
# tests 653
# pass 653
# fail 0
```

Repeat runs of the new focused tests (sub-lead, while accepting each task):

```text
node --test machine/test/screen.test.js        5 runs after T1e: 19 pass, 0 fail each
node --test machine/test/screen-input.test.js  3 runs after T1f: 12 pass, 0 fail each
node --test viewer/test/wc-screen.test.js viewer/test/wc-cli.test.js  5 runs: 21 pass, 0 fail each
```

Live check, 2 runs at `ba6a089` (plus 4 earlier runs at `8bc5daf`, all 22 ok). The set of Xvfb processes was the same before and after, and `systemctl --user list-units --all 'wcscreen-*'` printed nothing:

```text
$ bash machine/test/screen-live.sh   # run 1
machine service listening on 127.0.0.1:34105
# state dir /tmp/wheelchair-test-run-1382464-XGk7Hd/wheelchair-screen-live-H4akFU/state; slice prefix wcscreen-af6277575d5b
ok - start succeeds
ok - run chromium succeeds
ok - run chromium reports focused as its own window
ok - run xmessage succeeds
ok - run xmessage reports focused as its own window, not the first
ok - xdotool clears the xmessage window name
ok - windows lists exactly the two top-level windows by id
ok - the second window has name ""
ok - xmessage argument with $HOME arrived unexpanded
ok - click on the button changes the first window title
ok - type of 400 characters arrives whole
ok - shot PNG exists, is non-empty and is a PNG
screenshot: /tmp/claude-1000/-home-collin--local-state-wheelchair-worktrees-wheelchair-wc-940599e3df66/6bafc310-b65d-46f4-83f4-bd164f805df4/scratchpad/live3-1.png
ok - an X client without the cookie is refused
ok - the same client with the cookie is accepted
ok - run of the env-clearing child launcher succeeds
ok - the env-clearing child is alive before stop
ok - the screen slice has a readable cgroup with processes before stop
ok - stop succeeds
ok - the env-clearing child is gone after stop (polled up to 10 s)
ok - after stop the screen slice is gone or its cgroup is empty (polled up to 10 s)
ok - no process from the screen survives stop (polled up to 10 s)
ok - no wcscreen unit of this test is left
live: 22 ok, 0 failed
run 1 exit 0 live: 22 ok, 0 failed
run 2 exit 0 live: 22 ok, 0 failed
Xvfb set unchanged
```

Screenshot from that run (Chromium test page after the click and the 400 typed characters; xmessage is under it, as there is no window manager): `/tmp/claude-1000/-home-collin--local-state-wheelchair-worktrees-wheelchair-wc-940599e3df66/6bafc310-b65d-46f4-83f4-bd164f805df4/scratchpad/live3-1.png`

Earlier, at `8bc5daf` before the auto-focus fix (T1f), one of two live runs failed: Chromium's `run` returned `focused: null` after 960 ms (Deviation 1). No failure has been seen since the fix.

## Known gaps / residual risks

- Accepted Risks in PLAN.md stand (3D on software rendering, run racing archive, stray state dir
  after archive, deliberate cookie reads).
- (Resolved in Remediation 1) The machine router now names `lib/screen-input.js` and `lib/screen-args.js`.
- `viewer/test/*.test.js` is load-sensitive on hearth: on the feature branch before any screen
  code, under load averages of 28–78, `app-settings.test.js:329` (EADDRINUSE) and
  `app-uploads-archive.test.js:65` failed intermittently and the suite once stalled past 400 s.
  The final run below was clean.
- Viewer tests that start a real `MachineService` now run its screen startup cleanup, which
  calls the real `systemctl --user kill/stop` on `wcscreen-<hash of that test's temp state
  dir>.slice` (a unit that does not exist). Harmless by design (the hash), but those tests are
  not fully hermetic.
- The live check needs a machine with Xvfb, xauth, mcookie, ffmpeg, xdotool, xwininfo,
  xmessage, a systemd user manager and Playwright's Chromium; elsewhere it prints `SKIP:` and
  exits 0.

## Remediation rounds

Appended by Stage 4 loops; never erase earlier content.

### Remediation 1 (after verification attempt 1 at `2bce723`)

Gaps and tasks: `docs/plans/drive-local-app/REMEDIATION-1.md`. The lead deferred gap 6 (app pid/pgid in `state.json`, PLAN.md Deferred row 6). Four other findings were not counted, with the lead's agreement.

| Gap | Fix | Where | Test |
|---|---|---|---|
| 1. One window lists none (`1 child:`) | `parseRootChildren` matches `N child(ren)?:` | `machine/lib/screen-args.js:89` | `machine/test/screen-args.test.js:61-69` |
| 2. Archive deleted the screens dir when it kept uploads | `removeThreadDir` only after uploads were removed | `machine/service.js:876` | `machine/test/screen.test.js:195-201` |
| 3. Baseline scan outside the 6 s auto-focus phase | `windowIds` deadline and `autoFocus` `startedAt` share one phase from before the baseline | `machine/lib/screen-input.js:46-48`, `:115-117`; `machine/lib/screen.js:183`, `:194` | `screen-input.test.js` (deadline and startedAt tests) |
| 4. Any non-timeout probe failure skipped | Skip only stderr `Bad ?Window`/`Bad ?Drawable`/`No such window`; any other failure ends the phase with null | `machine/lib/screen-input.js:24`, `:39` | `screen-input.test.js` (vanished-window and unexpected-error tests) |
| 5. Router missing two files | Rows added | `machine/AGENTS.md:15-16` | read |

Validation at `53f56f8` (load average about 47–53):

```text
$ bash machine/test/run.sh
machine exit 0
# tests 209
# pass 209
# fail 0

$ node --test viewer/test/*.test.js
viewer exit 1
# tests 653
# pass 651
# fail 2
not ok 347 - 6 message clears debt
not ok 413 - archive through the hub cancels a stalled upload to the real machine

$ node --test viewer/test/app-quiet.test.js viewer/test/app-uploads-archive.test.js   # rerun
exit 0
# pass 21
# fail 0
```

Both viewer failures are load-sensitive tests that predate this feature. `app-uploads-archive.test.js:65` failed the same way on the feature branch before any screen code (PLAN.md Log), and `app-quiet.test.js:38` never reaches the screen route. Both passed on rerun.

Live check, 3 runs on R3's branch plus 1 run at `53f56f8`, all `22 ok, 0 failed`. No `wcscreen-*` unit was left and the Xvfb set was unchanged. The run at `53f56f8`:

```text
ok - start succeeds
ok - run chromium succeeds
ok - run chromium reports focused as its own window
ok - run xmessage succeeds
ok - run xmessage reports focused as its own window, not the first
ok - xdotool clears the xmessage window name
ok - windows lists exactly the two top-level windows by id
ok - the second window has name ""
ok - xmessage argument with $HOME arrived unexpanded
ok - click on the button changes the first window title
ok - type of 400 characters arrives whole
ok - shot PNG exists, is non-empty and is a PNG
screenshot: /tmp/claude-1000/-home-collin--local-state-wheelchair-worktrees-wheelchair-wc-940599e3df66/6bafc310-b65d-46f4-83f4-bd164f805df4/scratchpad/live5.png
ok - an X client without the cookie is refused
ok - the same client with the cookie is accepted
ok - run of the env-clearing child launcher succeeds
ok - the env-clearing child is alive before stop
ok - the screen slice has a readable cgroup with processes before stop
ok - stop succeeds
ok - the env-clearing child is gone after stop (polled up to 10 s)
ok - after stop the screen slice is gone or its cgroup is empty (polled up to 10 s)
ok - no process from the screen survives stop (polled up to 10 s)
ok - no wcscreen unit of this test is left
live: 22 ok, 0 failed
```
