# Remediation 1 — remember-me

Verification round 1, 2026-09-24. Two verifiers, one per implementing family, both
cross-family:

- Claude (default reviewer model) checked the GPT-built work (tasks 1 and 3).
- gpt-5.6-sol (thread `01a0d23f-f136-7d33-a21d-ac2b95c25d74`) checked the Claude-built work
  (tasks 2 and 4).

Both returned `VERDICT: FAIL`.

## Gaps, verbatim

From the Claude verifier:

```
GAP: Validation, unit case "`PUT /wheelchair/graph` and `/view` accept the cookie with a good `Origin`, and refuse it with a foreign one `403`": nothing tests `PUT /wheelchair/graph` with the cookie, although the test is named for both routes and COMPLETION.md cites it for "PUTs with the unchanged `Origin` check". The code does handle the cookie correctly. — `viewer/test/routes.test.js`, test "PUT graph and view accept a remember cookie only from a permitted origin", sends only `PUT /view?path=…`, once with the good origin and once with a foreign one. The drag case in `pages.spec.js` also saves through `PUT /view` only. My own probe, on a free port with a cache root under `viewer/test/.tmp/`, sent `PUT /wheelchair/graph` with the cookie: the good origin got past authentication (`400`, because my probe body was invalid) and a foreign origin got `403`. Also related: the case "a JSON route answers `401` JSON" asserts only the status. `(await raw(ctx, '/list')).status === 401` never checks the body or content type, though the server does send JSON.
GAP: COMPLETION.md Routers section, "signin.html stays covered by the row's 'the list and document pages' wording … No other router names a changed file": the root router is now stale. — `AGENTS.md:51` lists every file in the `viewer/` row by name (`index.html`, `list.html`, `list.js`, `doc.html`, `doc.js`, `server.js`, `playwright.config.js`) and leaves out the new `viewer/signin.html`. The sign-in page is neither the list page nor the document page. `AGENTS.md:69-70` still says "`viewer/` is real JavaScript, but it is seven files — the graph page, the list and document pages and their scripts, the server, and its Playwright config". There are now eight: `ls viewer/*.html viewer/*.js` shows `signin.html` as well.
```

From the GPT verifier:

```
GAP: Holder identification (#15) — the fallback does not apply the normal proof check because a proof-valid response with no `pid` is accepted as ours — evidence: `viewer/server.js:1832-1834`
GAP: Required unit validation — the cookie/Origin test claims to cover both PUT routes but exercises only `/view`, leaving `/graph` untested — evidence: `PLAN.md:253-255`; `viewer/test/routes.test.js:281-289`
GAP: Routers — the root router’s explicit `viewer/` inventory omits the new `signin.html`; the completion claim that “list and document pages” covers a distinct sign-in page is false — evidence: `AGENTS.md:51`; `COMPLETION.md:74-79`
GAP: Blocking-check record — COMPLETION.md says the `/wheelchair` mapping and several phone checks were completed, but later still claims the mapping and all blocking checks are outstanding — evidence: `COMPLETION.md:56`, `:60-67`, `:108-119`
```

The lead checked each one. `viewer/server.js:1832-1834` accepts
`!Number.isInteger(identity.pid)`, where remote-viewer's rule (Decision Log #73, #75, code
before this change) required the pid to be present and to equal `.server`'s. The PUT test
sends only `/view`. `AGENTS.md:51` and `:69-70` omit `signin.html`. COMPLETION.md's coverage
row and its Known gaps disagree.

## Tasks

### R1-1 — server identity check and tests (GPT / gpt-5.6-terra, resuming task 1's thread `01a0d208-a37f-7413-9ae3-b568d39f8cf2`)

- **Objective:** in `identifyHolder`, a proof-valid holder counts as ours only when
  `/whoami` reports an integer `pid` equal to `.server`'s, as before this change. Tests, each
  its own `test(...)`: `PUT /wheelchair/graph` with the cookie and a good `Origin` gets past
  authentication (a valid write succeeds), and with a foreign `Origin` is `403`; a JSON route
  without a cookie or token answers `401` with `content-type: application/json` and a body
  carrying an `error` field; a holder whose `/whoami` carries a valid `proof` but no `pid` is
  not treated as ours (`--open` refuses and signals nothing).
- **Ownership boundary:** `viewer/server.js`, `viewer/test/*.test.js`,
  `viewer/test/hooks/*`.
- **Validation:** `node --test viewer/test/*.test.js`; `npm --prefix viewer run test:browser`.

### R1-2 — router and completion record (lead)

- `AGENTS.md:51` names `signin.html` in the `viewer/` row, and `:69-70` counts eight files,
  including the sign-in page.
- COMPLETION.md's Routers section says what changed. Its deviations and Known gaps agree with
  the coverage row about which hearth checks are done.
