# Map: faster verification

Checked against: `7b93c1ae6a0425c72abe043bedba4a3aea7aa62d` (origin/main). Covers `protocol/app/{verifier,sub-lead,lead,worker}.md`, `AGENTS.md`, `CONTRIBUTING.md`, `viewer/test/`, `viewer/playwright.config.js`, `viewer/package.json`, `machine/test/run.sh`, `test-support/`, suite entry points and `.github/workflows/macos.yml`. See also `docs/maps/test-temp-dirs.md` for isolation and cleanup.

```text
plan validation commands -> worker runs task checks -> sub-lead runs full validation
                                                     -> independent verifier runs commands
                                                     -> gap -> fix -> validate -> fresh verifier
                                                     -> pass -> push -> PR checks
                                                     -> base merge or repair -> fresh verifier -> push
```

## Verification flow

The lead puts concrete validation commands in the Spec (`protocol/app/lead.md:216`); the sub-lead gives each worker exact task commands, and the worker runs and reports them (`protocol/app/sub-lead.md:59-71`; `protocol/app/worker.md:25,36,84`). After all tasks and full validation pass, the sub-lead commits completion evidence and starts one or two independent verifiers; failures go through remediation, validation and a fresh verifier (`protocol/app/sub-lead.md:224-249,287-298`). The verifier reads every Spec item, runs its validation commands, checks intent and non-goals, and uses a detached throwaway worktree (`protocol/app/verifier.md:13-17,33-50`). The role does not itself prescribe a universal full suite or a comparison with main: commands come from the Spec and brief. A small fix gets a verifier before push; a conflict-free base merge also gets a fresh verifier under the repair rule (`protocol/app/lead.md:125-139,688-698`). An after-done fix and merged remote PR changes can require another check (`protocol/app/lead.md:490-508,682-687`). The separate steps-only verifier follows user-visible steps, not Spec validation (`protocol/app/verifier.md:59-75`; `protocol/app/lead.md:545-555`).

Root instructions list suite commands and require an unquoted viewer glob, isolated server and worktree installer fixtures (`AGENTS.md:54-74`). CONTRIBUTING asks for area checks and the full set before handing off a cross-cutting change (`CONTRIBUTING.md:73-94`). Therefore targeted verification would need to reconcile both the commands in existing plans and these rules; changing only a runner cannot override a verifier's obligation to execute a specified full command.

## Test selection and cost

Viewer Node uses `viewer/test/*.test.js`; Playwright uses `*.spec.js`, two projects and `workers: 2` (`viewer/package.json:6-8`; `viewer/playwright.config.js:9-19`). The tree has 81 Node test files and 38 browser spec files at this revision. Names offer hints, but not a complete dependency map: `app-harnesses.test.js` directly imports settings, hub, harnesses, usage and balancer and uses shared server helpers (`viewer/test/app-harnesses.test.js:4-7,83-87`); browser specs exercise a spawned server via shared helpers (`viewer/test/browser.spec.js:10-17`; `viewer/test/touch.spec.js:20-24`; `viewer/test/helpers/server.js:66-79`). The helper app itself starts a fake machine and server (`viewer/test/helpers/app.js:3-25`). A source-to-test map can seed from names and imports, but must account for transitive dependencies, HTTP-served pages, scripts, shared fixtures and cross-component integration; filename matching alone misses these. Configuration, shared helpers and protocol changes can affect many suites.

Machine's shell entry runs all `machine/test/*.test.js` (`machine/test/run.sh:1-3`). Root also lists sensitivity, codex and installer shell fixtures, sudo-helper Python and installer checks, test-support Node tests and hearth-only smoke checks (`AGENTS.md:56-64`); the installer must not be run from a worktree (`AGENTS.md:65-70`). Historical lighter-server results report full browser 10.5–11.2 minutes, two simultaneous runs 14.5 minutes each, and one new spec 12.5–14.1 seconds, on the then-current smaller suite (`docs/plans/lighter-server/COMPLETION.md:83-92`; `docs/plans/lighter-server/reports/T2.md:16-20`). These are historical, not current measurements; no current per-suite timings were found in the inspected records.

## Concurrency and flaky assertion

S7's two-worker per-run cap was Collin's decision for predictable load without a machine-wide queue; Node concurrency stayed at its default because browser runs saturated the machine (`docs/plans/lighter-server/PLAN.md:38-41,154-156`). A CLI `--workers` overrides the cap (`viewer/playwright.config.js:9-12`). `run-dir.js` records per-process owners and children for cleanup and stale-run sweeping, not admission control (`test-support/run-dir.js:48-65,88-105,119-127`); the smoke harness uses a private tmux directory and cleanup (`test-support/smoke/harness.js:103-108,194-196`). Neither mechanism coordinates a high-worker browser run with other test runners. A lock among cooperating runners alone cannot establish that unrelated or older runners are idle.

The reported test switches a harness off with one never-resolving machine request, one rejected request and one 409, and asserts the route returns 200 within 1000 ms, then sleeps 100 ms before asserting all three DELETEs were launched (`viewer/test/app-harnesses.test.js:298-319`). The route starts cancellations asynchronously and awaits settings description for the response (`viewer/app/routes.js:230-239`). Wall-clock scheduling, filesystem and other work can exceed either fixed deadline under load even when cancellation is correctly nonblocking; the never-resolving promise gives a direct behavioral distinction from waiting for that machine.

## CI

The sole checked-in workflow runs on pull requests and pushes to main on macOS, with Node 20, tmux and BSD tools. It runs sensitivity, codex, install fixtures and one machine test file, installs services with browser downloads skipped, and checks them (`.github/workflows/macos.yml:1-41`). It does not run the full viewer Node, Playwright or machine suite in that workflow.

## Not looked at

No full suite was run, and no current suite timings, coverage instrumentation, exhaustive source/test import graph, external CI configuration, live machine load or historical flake logs were inspected. The older `docs/maps/realism-review-verification.md` has changed covered files since its recorded commit and was not reused as evidence for this map.
