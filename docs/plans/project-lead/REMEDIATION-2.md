# Remediation 2 — project lead

Verification attempt 2 checked commit `9457fe87`. Claude verifier: FAIL (1 gap). GPT verifier: FAIL (5 gaps).

## Gap list (verbatim)

Claude verifier:
- GAP: S4 (other-project filtering, R1's PR-URL fix) — Another project's PR URL is matched as a substring, so it also erases the project's own content whenever that URL is a prefix of a local PR URL. This is the same "Approval" loss of a valid same-project question that attempt 1's gap 5 reported and R1 was meant to fix. — The match set now holds outside `pr_url`/`target_pr`/done-card URLs, and `containsOutside` uses `value.includes(part)` (`viewer/app/project-lead-actions.js:20`, `:30`).

GPT verifier:
- GAP: S3 — Claude project leads can load tracked project settings and MCP servers at launch — The isolated clone retained both configurations. The generated launch left project discovery enabled, and the startup handler accepts workspace trust. `machine/service.js:957,1161`, `connectors/claude/machine.js:78,84,94`.
- GAP: S4 — An approved PR URL from another project still appears in a project lead's `thread` response — Approval stores `target_pr` as an object with a `url` field. The filter and regression test cover only a string. The isolated API returned the outside URL with HTTP 200. `viewer/app/threads.js:381`, `viewer/app/project-lead-actions.js:20`, `viewer/test/project-lead.test.js:503`.
- GAP: S6 — The shared card instructions give project leads conflicting guidance about `message` cards — `protocol/app/cards.md:67` permits them for any session except reviewers and verifiers. The project lead role and machine allow-list exclude them at `protocol/app/project-lead.md:41` and `machine/service.js:2258`.
- GAP: Desktop Threads mockup — The pinned project lead preview cuts off "plan." with an ellipsis. The mockup displays the full preview on two lines. `viewer/pages/views.css:272`.
- GAP: Project lead thread mockups — Links in the full thread's reply render underlined at both sizes. The mockups show plain blue links.

## Disposition

- No rare paths.
- Deferred at the lead's answer: the preview and link-style gaps (D8, D9).
- PR URL prefix, object `target_pr`, cards.md wording: task R2a (hub, GPT, which built the filter).
- Project settings/MCP discovery at launch: task R2b (machine, GPT, which built the launch path).
- R2a and R2b own disjoint files and run in parallel.

## Task R2a

## Objective: verification-2 remediation, hub side (gaps 1, 3, 4)

Gaps, verbatim from the verifiers:

- GAP: S4 (other-project filtering, R1's PR-URL fix) — Another project's PR URL is matched as a substring, so it also erases the project's own content whenever that URL is a prefix of a local PR URL. [...] the outside thread is the same path on another machine with `pr_url …/wheelchair/pull/18`, and the local thread has `pr_url …/wheelchair/pull/186`. `thread` printed `RECENT []` and `PR undefined` [...] In `threads`, the local question "Should I rebase …/pull/186?" showed as `"waiting":[{"id":"q1","kind":"question","text":"Approval"}]`. (`viewer/app/project-lead-actions.js:20`, `:30`)
- GAP: S4 — An approved PR URL from another project still appears in a project lead's `thread` response — Approval stores `target_pr` as an object with a `url` field. The filter and regression test cover only a string. (`viewer/app/threads.js:381`, `viewer/app/project-lead-actions.js:20`, `viewer/test/project-lead.test.js:503`)
- GAP: S6 — The shared card instructions give project leads conflicting guidance about `message` cards — `protocol/app/cards.md:67` permits them for any session except reviewers and verifiers. The project lead role and machine allow-list exclude them.

Make exactly these changes:

1. **Whole-URL matching** in `viewer/app/project-lead-actions.js`. Keep the substring match
   (`containsOutside`, `:~30`) for ids, paths, session names and peer-log text as today. Match
   other projects' PR URLs separately, as whole URLs: a text contains an outside URL only when
   the URL occurs and the character after it is absent or is not part of a URL (not a letter,
   digit, `/`, `-`, `_`, `.` followed by a letter or digit, `?`, `#`, `=`, `&`, `%`). Write it as
   a small helper with a comment; compare after trimming a trailing `/` from both.
2. **Both `target_pr` forms**: the outside PR URL set takes `thread.pr_url`, `thread.target_pr`
   when it is an http(s) string, `thread.target_pr.url` when `target_pr` is an object, and
   `require('./handoff.js').donePr(thread)`; skip empty values.
3. **cards.md**: in `protocol/app/cards.md`, the `message` row's "Emitted by" cell becomes
   `any session except reviewer, verifier, the assistant and a project lead`. Nothing else in
   that file.

Tests in `viewer/test/project-lead.test.js` (small `test(...)` blocks; break each fix once,
watch it fail, restore):
- outside `pr_url …/pull/18` and local `pr_url …/pull/186`: `thread` keeps the local chat line
  naming `…/pull/186`, keeps the local thread's `pr_url`, and `threads` keeps the local
  question text naming `…/pull/186`; a local chat line naming `…/pull/18` exactly (and one with
  `…/pull/18.` at a sentence end) is left out;
- an outside thread whose `target_pr` is `{ url: '…/pull/77', number: 77 }`: a local chat line
  naming that URL is left out of `thread` `recent`, and the URL appears nowhere in the JSON of
  `thread` for a local thread.

## Ownership boundary

`viewer/app/project-lead-actions.js`, `viewer/test/project-lead.test.js`,
`protocol/app/cards.md` (that one cell), `docs/plans/project-lead/reports/R2a.md`.
Nothing else.

## Validation (one at a time; paste output tails)

```bash
node --check viewer/app/project-lead-actions.js viewer/test/project-lead.test.js
node --test viewer/test/project-lead.test.js
node --test viewer/test/assistant.test.js
node --test viewer/test/*.test.js
```
Do not run `install/test/run.sh` (its live-state check fails while other sessions run here).
`viewer/test/server.test.js`'s "global write lock" test is a known timing flake on main; if
it alone fails, re-run that file once and paste both results.

## Task R2b

## Objective: verification-2 remediation, machine side (gap 2)

Gap, verbatim from the verifier:

- GAP: S3 — Claude project leads can load tracked project settings and MCP servers at launch — The isolated clone retained both configurations. The generated launch left project discovery enabled, and the startup handler accepts workspace trust. `machine/service.js:957,1161`, `connectors/claude/machine.js:78,84,94`.

S3: a project lead "is launched without the project's tools (no project MCP servers or
project tool settings)". Today `prepareLaunch` (`machine/service.js:~957`) passes no MCP data
for a project lead, but Claude Code itself still discovers the clone's `.mcp.json` and
`.claude/settings.json` / `.claude/settings.local.json` in its working folder.

Make these changes:

1. **Claude** (`connectors/claude/machine.js` `command`): for a project lead session
   (`session.project_lead === true`; pass it through `context` if the adapter does not see the
   session field), launch with `--setting-sources user` (so only the user's own settings plus
   the explicit `--settings` file load; no project or local settings) and `--strict-mcp-config`
   (so no `.mcp.json` server loads; pass `--mcp-config` only if the adapter already needs it
   for wheelchair's own servers — say what you found). Check `claude --help` on this machine for
   the exact flag spellings, and paste the relevant lines in the report. Ordinary sessions
   and the assistant are unchanged.
2. **Other harnesses**: for each of `connectors/codex`, `connectors/agy`, `connectors/kimi`,
   `connectors/pi`, find whether the CLI discovers project-level settings or MCP servers from
   its working folder (e.g. Codex `.codex/config.toml` in the project, Antigravity / Kimi / Pi
   project config files). Where it does and the CLI has a flag or environment setting that turns
   it off, apply it for project lead sessions the same way. Where it does and nothing turns it
   off, do not invent one: list it in the report with the file:line evidence. Where it does not,
   say so with evidence.
3. **Workspace trust**: leave the trust step as is (the clone is wheelchair's own folder);
   say in the report whether, with item 1, the trust prompt still appears for a project lead.

Tests in `machine/test/project-lead.test.js` (break each once, watch it fail, restore):
- a Claude project lead's launch argv contains `--setting-sources user` and
  `--strict-mcp-config`, with a `.mcp.json` and `.claude/settings.json` committed in the
  project; an ordinary Claude lead session's argv in the same test does not;
- one test per other harness you changed, asserting its flag/env for a project lead only.

## Ownership boundary

`connectors/claude/machine.js`, `connectors/codex/machine.js`, `connectors/agy/`,
`connectors/kimi/`, `connectors/pi/` (only the launch command for project lead sessions),
`machine/service.js` (only to pass the project lead flag into the adapter context),
`machine/test/project-lead.test.js`, `docs/plans/project-lead/reports/R2b.md`. Nothing else.

## Validation (one at a time; paste output tails)

```bash
node --check connectors/claude/machine.js machine/service.js machine/test/project-lead.test.js
node --test machine/test/project-lead.test.js
bash machine/test/run.sh
```
Also run any test file under `machine/test/` or `viewer/test/` whose name contains the name of
a connector you changed. Do not run `install/test/run.sh`.

## Task R2c (added after R2b)

R2b found Kimi and Antigravity have no switch to stop workspace config discovery. The lead chose option A: sparse-checkout in the clone.

## Objective: keep harness config out of the project lead's clone (remediation 2, part c)

Kimi (`.kimi-code/mcp.json`, `.kimi-code/local.toml`) and Antigravity (`.agents/mcp_config.json`)
read workspace config from their working folder and have no switch to turn it off, so a
project lead on them could load the project's own MCP servers (S3 says it is launched without
them). The lead decided: keep those paths out of the clone's working tree with git
sparse-checkout, set by the machine at every refresh.

Make these changes:

1. **`machine/lib/project-lead.js` `refresh`**: before the `checkout --detach --force`, set
   non-cone sparse-checkout on the clone so these root-level paths are never in the working tree:
   `.kimi-code/`, `.agents/`, `.mcp.json`, `.claude/`, `.codex/`, `.pi/`. For example
   `git -C <clone> sparse-checkout set --no-cone '/*' '!/.kimi-code/' '!/.agents/' '!/.mcp.json' '!/.claude/' '!/.codex/' '!/.pi/'`
   (check the exact pattern syntax against `git help sparse-checkout` on this machine; paste the
   git version in your report). Keep it in one constant with a comment saying why. Run it on
   every refresh, so a clone created before this change gets it on its next refresh. Its failure
   fails the refresh (use `required`). After checkout, the existing `clean -fdx` stays.
2. **Robustness** (each with a test):
   - a clone created before this change (no sparse-checkout config) refreshes and ends with the
     paths absent;
   - a project that has none of those paths refreshes normally and its other files are all
     present;
   - excluded paths never block the detached checkout: a project that has `.claude/settings.json`
     and `.mcp.json` committed, and a clone where those files exist locally modified or
     untracked before the refresh, still refreshes to the right commit with them absent;
   - the excluded files stay readable with `git -C <clone> show HEAD:.mcp.json`.
3. **`protocol/app/project-lead.md`**: one sentence in the paragraph about reading the folder
   (around lines 24-29): your folder leaves out the project's harness config paths
   (`.claude/`, `.codex/`, `.pi/`, `.kimi-code/`, `.agents/`, `.mcp.json`); read them with
   `git show HEAD:<path>`.

## Ownership boundary

`machine/lib/project-lead.js`, `machine/test/project-lead.test.js`,
`protocol/app/project-lead.md` (that one sentence), `docs/plans/project-lead/reports/R2c.md`.
Nothing else.

## Validation (one at a time; paste output tails)

```bash
node --check machine/lib/project-lead.js machine/test/project-lead.test.js
node --test machine/test/project-lead.test.js
bash machine/test/run.sh
```
Break each new behaviour once (e.g. skip the sparse-checkout call), watch its test fail, restore.
Do not run `install/test/run.sh`.
