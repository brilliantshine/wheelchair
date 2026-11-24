# Remediation 3 — faster-verification

Verification attempt 3 on 70d11cdb: Claude verifier FAIL, GPT verifier FAIL. The picker-miss gap survived two fix attempts (R1, R3) and went to Collin, who chose "Map known cases, accept the rest" (PLAN.md D15).

## Gaps (verbatim, merged)

- GAP (GPT): S1 rule 3 — Changes to `viewer/server.js` omit tests that launch it — A scratch change selected only `viewer/test/server.test.js`, omitting `viewer/test/routes.test.js:24` and `viewer/test/pages.spec.js:85`, which both spawn that file.
- GAP (GPT): S1 rules 3–5 — Changes to a Machine fixture omit its Viewer reader — Removing `machine/test/fixtures/agy/transcript-tools.jsonl` in a scratch commit selected only the Machine suite. The omitted `viewer/test/app-chat.test.js:17` then failed with `ENOENT`.
- GAP (GPT): S1 rules 3–6 — Viewer page changes omit Machine's name guard — A scratch change to `viewer/pages/settings.js` selected both Viewer suites. The omitted `machine/test/name-guard.test.js:143` passed on the checked commit and failed on the scratch change, naming the changed line.
- GAP (Claude): S1 rule 3 — `machine/test/name-guard.test.js` reads every source file under `machine/`, `viewer/app/`, `viewer/pages/`, plus `viewer/server.js`, `install.sh` and `codex/model.sh`, with its own directory walk (`machine/test/name-guard.test.js:144-146`). No map entry covers it.
- GAP (Claude): S1 rule 3 — `viewer/server.js` is started by path, not imported: `viewer/test/helpers/server.js:72`. 23 Node test files and 9 browser specs use that helper. Because `server.test.js` matches by name, the fallback never runs.
- GAP (Claude): S1 rule 3 / rule 4 — Fixtures under `machine/test/` are read by a viewer test (`viewer/test/app-chat.test.js:17,37`), but rule 4 sends them to the machine suite only.
- GAP (GPT): S5.6 — The small-fix instructions can reach the push while the full run is pending — `protocol/app/lead.md:159–163`.

## Tasks

| Task | Gap | Lane |
|---|---|---|
| R5 | The six picker cases: additive map entries for name-guard and `machine/test/fixtures/**`, `viewer/server.js` to both viewer suites, an `additive` flag in `pick-tests.js`, real-tree and fixture tests | sub-lead |
| R6 | S5.6: `lead.md` small-fix push waits for the full run | sub-lead |

Further misses of the same kind are the verification-3 Accepted Risk, not gaps.
