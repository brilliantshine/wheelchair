# Remediation 2 — google-model-levels

Verification attempt 2 checked commit 732be642 (verifiers: claude-opus-5-5 and gpt-6.2-sol). Full run on 732be642: all suites exit 0.

## Gap list (verbatim, merged)

- (gpt verifier) GAP: S3.5 and remediation G2 — Saving a second cell can erase a new `Other…` draft in the first cell while its earlier refresh is pending — `viewer/pages/settings.js:232–248` redraws every cell awaiting a refresh. In Chromium, I held the GPT Light refresh, typed a new Light draft, and saved GPT Lead. The Lead refresh erased the Light draft. The same edits preserved it at the comparison commit.
  - Judged a rare path (a new draft typed and another cell saved inside a pending re-read's one-to-two-second window); recorded in PLAN.md Accepted Risks, round verification-2.
- (gpt verifier) GAP: S3.4 — A successful PUT still performs the 30-second catalog refresh before the page re-reads Settings — `viewer/app/routes.js:362` calls `show --json`, which refreshes at `codex/model.sh:572`. A PUT against a complete two-minute-old catalog returned 200, invoked fake `agy models` once, and replaced the catalog without a GET.
  - Judged not a gap: S3.4's no-refresh rule is for the read that normalizes and checks the effort (it uses `model.sh levels`, no refresh); S3.5 keeps the PUT response unchanged, and that response has always come from `show --json`. The page's re-read that follows then reuses the fresh list, so a save costs no extra `agy models` run. Logged in PLAN.md.
- (both verifiers, merged) GAP: test isolation, G4's second appearance — viewer tests that reach `codex/model.sh` through in-process hubs or direct spawns still run the PATH `agy`; `viewer/test/app-usage.test.js` writes under `$HOME/.wheelchair`; also `viewer/test/app-balancer.test.js:6,81` and `viewer/test/app-project-tools-card.test.js:9`. Full text in the R3 brief below.

## Tasks

### R3 — test isolation (claude, standard)

Task: R3 (remediation 2, gap G4 second fix) — no viewer test may run whatever `agy` is on PATH, or read or write the real ~/.wheelchair, through any path.

Gap, verbatim from the verifier (attempt 2, commit 732be642): "Brief's test-isolation rule (tests use fakes, never the real agy, never touch the real `~/.wheelchair/agy-models.json`), and G4's intent — three viewer test files outside the Spec list still run whatever `agy` is first on PATH, and one of them writes into `$HOME/.wheelchair`. This branch introduced it: every gemini pin read now goes through `agy_models()` (`codex/model.sh:331-388`). On main, only `show --json` called it. The tests run `model.sh gemini heavy` through an in-process Hub, whose `modelCommand` passes on `process.env` (`viewer/app/settings.js:433-434`). There is no `startServer`, so R2's helper defaults (`viewer/test/helpers/server.js:75-80`) never apply. — `viewer/test/app-usage.test.js`: 1 call with `WHEELCHAIR_MODELS` unset, from `python3 … codex/model.sh gemini heavy`. It wrote `<scratch HOME>/.wheelchair/agy-models.json.failed`. `viewer/test/app-balancer.test.js`: 1 call. `WHEELCHAIR_MODELS` points to a temp dir (`:6`) but `WHEELCHAIR_AGY` is not set. `viewer/test/app-project-tools-card.test.js`: 1 call. Same pattern (`:9`). `app-harnesses.test.js` makes 2 calls [on main] and 1 on this branch." The other verifier separately saw `viewer/test/app-balancer.test.js:6,81` run `agy models`.

The first fix (R2) only covered servers started through viewer/test/helpers/server.js and pages.spec.js. This is the second attempt at this gap, so be complete rather than file-by-file:
1. Find every way a viewer test reaches codex/model.sh: in-process hubs (whatever helper or inline setup builds them, e.g. viewer/test/helpers/app.js, app-machine.js, app-views-setup.js, app-threads-world.js, or a test's own setup), direct execFile/spawn of model.sh, and servers. Make each one run with `WHEELCHAIR_AGY` set to '' (or to a fake) and `WHEELCHAIR_MODELS` pointing inside a temp directory, unless that test deliberately sets its own. Prefer the shared helpers; where a test builds its hub inline, set the two variables in that test's setup (on process.env before the hub is created, restored after, if that is the file's pattern). Do not change production code (viewer/app/, codex/) for this. Include app-harnesses.test.js even though its call is older than this branch.
2. Prove it across everything, not a sample. Make a scratch HOME (mktemp -d) and a logging fake `agy` script placed first on PATH that appends one line per call to a log file. With HOME set to the scratch HOME and that PATH, run the whole viewer Node suite (`node --test viewer/test/*.test.js`, unquoted glob) and the whole browser suite (`npm --prefix viewer run test:browser`) once on the base commit (before your change) and once after. Paste for each: the agy call-log line count with the calling command lines (the fake can log `$PPID`'s command line or argv), and `find <scratch HOME>/.wheelchair -type f` output. After the fix: zero agy calls and no files under the scratch HOME's .wheelchair that model.sh writes (agy-models.json, agy-models.json.failed, models). These two suite runs are a proof run under a scratch HOME, not your validation gate; if a test fails in them for a reason unrelated to your change, paste it and carry on.
3. Never run any of this against the real HOME.

Ownership boundary: viewer/test/ (helpers and test files, only the env/setup lines needed for this). Nothing outside viewer/test/.

Validation commands:
- node --test viewer/test/app-usage.test.js viewer/test/app-balancer.test.js viewer/test/app-project-tools-card.test.js viewer/test/app-harnesses.test.js
- node --test viewer/test/model-options.test.js viewer/test/app-settings.test.js viewer/test/app-hub.test.js viewer/test/worker-effort-membership.test.js
- the scratch-HOME proof above (before and after)
