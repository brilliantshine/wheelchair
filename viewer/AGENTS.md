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
| `app/state.js` | Hub-state paths, atomic JSON writes, and thread persistence. |
| `app/machine-client.js` | The authenticated client for every machine-service route. |
| `app/cards.js`, `card.js` | Hub card handling and the agent-side card validator/CLI. |
| `app/sessions.js`, `wc.js` | Session policy, queues, lifecycle events, and the agent-side CLI. |
| `app/settings.js` | The Settings store (`settings.json` in the hub state dir), templates and writing style, the `role_layers` text sent at session start, and the style preview; models are read and written only through `codex/model.sh`. |
| `app/chat.js`, `threads.js`, `views.js` | Transcript assembly, thread lifecycle, and view data. |
| `app/routes.js`, `hub.js`, `API.md` | App HTTP dispatch, module composition, and the page-facing JSON contract. |
| `app/names.js`, `agents.js` | Lead name allocation and the public agent tree and machine reachability view. |
| `app/providers.js` | Hub provider names, CLI mappings and labels. |
| `app/balancer.js` | Provider and account placement, constraints and waiting decisions. |
| `app/usage.js` | Account usage persistence, machine sign-in state, forecasts and ranking. |
| `app/ready.js` | The Ready check before Start building: each machine reachable, on the hub's commit, and its CLIs logged in. |
| `index.html` | The graph page. Holds the second copy of the box and group size constants the server's layout reserves room for |
| `list.html`, `list.js` | The list of open graphs and registered plans |
| `doc.html`, `doc.js` | The plan document page, read from a plan's `docs/plans/<slug>/`; its Markdown renderer is the shared `pages/markdown.js` |
| `pages/` | The app's pages (threads, thread, doc, features, sessions, settings, terminal), served at `/wheelchair/app/<page>` behind the remember cookie; their scripts and styles are public assets under `/wheelchair/assets/pages/`. `doc` opens a thread's MAP/IDEA/PLAN in the app (`doc.html`/`doc.js`/`doc.css`), and `markdown.js` is the Markdown renderer it shares with `doc.js` above, taking a link resolver |
| `vendor/` | Vendored browser libraries for the app pages (xterm.js), public assets under `/wheelchair/assets/vendor/`. The app's fonts are not here: `/wheelchair/assets/fonts/<name>.woff2` serves four allowlisted files from `node_modules/@fontsource` (`FONT_FILES` in `server.js`) |
| `signin.html` | What a browser with no remember cookie gets before it is signed in |
| `playwright.config.js` | The browser suite's two projects, Chromium and Firefox |
| `test/` | The suites. See below |

## Boundaries

- **A graph path is accepted only inside a plan's `graphs/` directory or the cache root.**
  `server.js` resolves symlinks before checking, so a path that merely looks like one of
  those is refused. A change to path handling is a change to what the server will write.
- **An agent's `PUT /graph` may not grant a verdict, drop or alter a rejected entry, claim a
  position, or clear a landed reset.** That contract sits in `checkAgentWrite`, not in
  `validateGraph`, which also runs on every read: refusing a committed graph there would
  make it unopenable.
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
| `test/` | The node and Playwright suites; `fixtures/` holds the graph files they open, `helpers/server.js` starts a server on a free port with its own cache root under `test/.tmp/`, and `hooks/` holds fault seams selected by an environment variable, used only by tests |

## Tests

```bash
node --test viewer/test/*.test.js     # unquoted glob, as the root router explains
npm --prefix viewer run test:browser  # Chromium and Firefox
```
