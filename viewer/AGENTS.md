# `viewer/` — the graph viewer: a Node server and the browser pages it serves

Owned by [the repo root](../AGENTS.md). Started by an agent turn, never read as guidance.
The graph format and the drawing rules live in `protocol/graphs.md`; nothing here carries
its own copy of them except the few constants named below.

The organizing idea: **the server is the one place a graph is validated, laid out and
written, and an agent's write is held to a stricter contract than a person's.** Pages only
render and send edits; a rule that decides whether a graph is accepted belongs in
`server.js`, never in a page.

| File | Role |
|---|---|
| `server.js` | The whole server, with no runtime dependencies: routes, token and remember-cookie auth, graph validation, the layout pass, the app-hub glue, the agent-write contract, the lock and registry kept under the cache root. Its header comment is the route and error-code list |
| `app/state.js` | Hub-state paths, atomic JSON writes, and thread persistence. `allThreads()` and `threadSnapshot(id)` serve shared, deep-frozen records from a stat-checked cache; code that mutates or saves reads with `thread(id)` (or clones the one record). |
| `app/machine-client.js` | The authenticated client for machine-service routes, including JSON status and body pass-through. |
| `app/cards.js`, `card.js` | Hub card handling, including hidden `resolve` and `retract` cards, and the agent-side card validator/CLI. |
| `app/peers.js` | Same-machine peer and linked-thread discovery and lead summaries. |
| `app/sessions.js`, `wc.js` | Session policy, queues, lifecycle events, and the agent-side CLI (including `wc.js screen`, the invisible-screen commands). |
| `app/quiet.js` | The quiet-turn detector: who owes a report, the reminders to an agent and its starter, and the system `needs` card, run on the queue retry timer. |
| `app/auto-merge.js` | The opt-in auto-merge run after a `check` card is accepted: gates, GitHub readiness re-check, the exact-head REST merge, the attempt record per head and the "Not merged automatically" `needs` card. |
| `app/settings.js` | The Settings store (`settings.json` in the hub state dir), templates and writing style, the `role_layers` text sent at session start, and the style preview; models are read and written only through `codex/model.sh`. |
| `app/asides.js` | Aside records, prompts, turn lifecycle and graph handling. |
| `app/handoff.js` | Thread handoffs: the export file format and its validator, history text, the export points and quiet test, the frozen guard, export itself, the handed-off banner, Download again and the `handoffs/` start-up sweep. |
| `app/handoff-ops.js` | Handoff operations (Create, Advance, Undo): the saved operation record, pre-claim checks, claims, Retry and Cancel, and the cancelled-claim revoke list and sweep. |
| `app/handoff-import.js` | `POST /threads/import`: validation, repository, branch and stage checks, and the outcome table that opens, creates or advances a thread. |
| `app/documents.js` | Plan document eligibility, listing and live reads. |
| `app/remote-plan.js` | Remote document reads and background discovery cache. |
| `app/zip.js`, `app/html-download.js` | Stored ZIP creation and inert HTML download transformation. |
| `app/chat.js`, `threads.js`, `views.js` | Transcript assembly, thread lifecycle, and view data. |
| `app/routes.js`, `hub.js`, `API.md` | App HTTP dispatch, including Project tools forwarding, module composition, and the page-facing JSON contract. |
| `app/names.js`, `agents.js` | Lead name allocation and the public agent tree and machine reachability view. |
| `app/providers.js` | Hub provider names, CLI mappings and labels: Claude, GPT, Antigravity (`gemini`) Kimi Code (`kimi`), and OpenRouter (`openrouter`, CLI `pi`). |
| `app/harnesses.js` | Harness status, placement eligibility and first-run checklist. |
| `app/balancer.js` | Provider and account placement, constraints and waiting decisions. |
| `app/usage-poll.js` | Idle account usage polling and machine selection. |
| `app/usage.js` | Account usage persistence, machine sign-in state, forecasts and ranking. |
| `app/ready.js` | The Ready check before Start building: each machine reachable, on the hub's commit, and its CLIs logged in. |
| `index.html` | The graph page, at `/wheelchair/?path=<graph>`; `/wheelchair/` with no path redirects to the app's Threads page. Holds the second copy of the box and group size constants the server's layout reserves room for |
| `doc.html`, `doc.js` | The plan document page, read from a plan's `docs/plans/<slug>/`; its Markdown renderer is the shared `pages/markdown.js` |
| `pages/picture-export.js` | The picture page's PNG export: a graph cloned from the graph viewer's SVG (pan/zoom removed, bbox plus 24 px margin, computed styles inlined) and form drawers on a canvas, 2x capped at 8192 px, saved via a blob URL |
| `pages/file.html`, `file.js`, `file.css` | The sent-file preview page at `/wheelchair/app/file?thread=&file=`: Markdown through `renderMarkdown` (external links only), other text in a `<pre>`, "Too big to preview" past 2 MiB; `file.js` also exposes `window.WCFilePreview.previewable(name, size)` and `.href(thread, stored)` for the thread page |
| `pages/project-tools.js` | Settings' Project tools section: machine and project picker, tool list and form, keys list, save and remove-key calls, the Add MCP for Unity button, the Runs on Windows switch and its status line. |
| `pages/aside.js` | Thread-page aside selection, panel, marks and list. |
| `pages/` | The app's pages (threads, thread, doc, features, agents, settings, terminal), served at `/wheelchair/app/<page>` behind the remember cookie; page polls go through `window.wcPoller` (defined in `nav.js`), which pauses while the tab is hidden; their scripts and styles are public assets under `/wheelchair/assets/pages/`. `agents.html`/`agents.js` show the lead sidebar, agent tree, side panel and bottom terminal panel. `term-view.js` is the terminal view (xterm, View only / Typing switch, mouse-report filter, scrollback history) that both the Agents panel and `terminal.html`/`terminal.js` mount. `doc` opens a thread's MAP/IDEA/PLAN in the app (`doc.html`/`doc.js`/`doc.css`), and `markdown.js` is the Markdown renderer it shares with `doc.js` above, taking a link resolver |
| `vendor/` | Vendored browser libraries for the app pages (xterm.js), public assets under `/wheelchair/assets/vendor/`. The app's fonts are not here: `/wheelchair/assets/fonts/<name>.woff2` serves four allowlisted files from `node_modules/@fontsource` (`FONT_FILES` in `server.js`) |
| `signin.html` | What a browser with no remember cookie gets before it is signed in |
| `playwright.config.js` | The browser suite's two projects, Chromium and Firefox; `workers: 2` so concurrent runs do not saturate the machine |
| `test/` | The suites. See below |

## Boundaries

- **A graph path is accepted only inside a plan's `graphs/` directory or the cache root.**
  `server.js` resolves symlinks before checking, so a path that merely looks like one of
  those is refused. A change to path handling is a change to what the server will write.
- **An agent's `PUT /graph` may not claim a position in its prose.** That check sits in
  `checkAgentProse`, not in `validateGraph`, which also runs on every read: refusing a
  committed graph there would make it unopenable.
- **Layout constants exist twice and must change together.** `server.js` and `index.html`
  share no module, and both copy `protocol/graphs.md`. The browser suite is what catches
  them drifting, so a change to one side runs it.
- **Unknown keys are dropped by canonicalization.** A write carrying a field the running
  build predates returns `200` with the field gone. This is why the root router forbids
  checking the viewer against a server already running.
- **The pages carry no token.** The first visit's redirect sets the remember cookie, and
  `/wheelchair/assets/*` is served without one. Anything a page needs that is not public
  goes through an authenticated route.
- **The app hub owns app state and queue rules.** Browser pages may not infer session
  readiness, validate cards, or talk to a machine service directly. `server.js` applies
  the same cookie/origin boundary to browser app writes as graph writes; machine callbacks
  authenticate with their per-machine secret instead.

## Children without a router

| Directory | What it holds |
|---|---|
| `test/` | The node and Playwright suites; `fixtures/` holds the graph files they open, `helpers/server.js` starts a server on a free port with its own cache root, a folder from `test-support/run-dir.js` under system temp, and `hooks/` holds fault seams selected by an environment variable, used only by tests |

## Tests

```bash
node --test viewer/test/*.test.js     # unquoted glob, as the root router explains
npm --prefix viewer run test:browser  # Chromium and Firefox
```

Test temp folders come from `test-support/run-dir.js` (`makeTemp`/`makeTempSync`), which removes them when the test process ends; never allocate from `os.tmpdir()` directly in a test.
