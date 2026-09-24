---
slug: remember-me
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-09-23
---

# The viewer remembers a device after its first visit

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

None. Every question is settled; see the Decision Log.

## Watch List

Things noticed that need looking into — not yet decisions for the user. Written down the
moment they're spotted so they can't be forgotten, surfaced to the user one line at a
time as they appear, and emptied before Stage 1 exits.

Each item ends up settled by the agent (noted in the Log), promoted to an Open Question,
promoted to a Constraint or Accepted Risk, or waved off by the user.

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | mapping | Whether `tailscale serve --set-path /wheelchair` strips the prefix before proxying. The design in Decision Log #2 is meant to work either way; it still needs a check on hearth. | yes | settled — blocking hearth check in Validation (Decision Log #13) |
| 2 | mapping | Whether Chromium and Firefox store a cookie from `http://127.0.0.1:<port>`, and whether they accept `Secure` there. This is the address agents print on a laptop that isn't serving. | yes | settled — checked on hearth with Playwright 1.62.1: both store `Secure` and plain cookies set on a `303` from `http://127.0.0.1`, send them under `/wheelchair`, and not to `/other`. Decision Log #7 |
| 3 | mapping | Whether `tailscale serve` passes `Set-Cookie` and `Cookie` through unchanged. | yes | settled — blocking hearth check in Validation (Decision Log #13) |
| 4 | queue | Whether a URL the browser was redirected away from ends up in its history (Chromium and Firefox). The idea says the token leaves the history after the first visit. | yes | settled — Accepted Risks: the first-visit URL itself may be kept, which is what IDEA's "after that first visit" allows |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | The viewer moves under `/wheelchair/`, leaving the root of the address free for a hub or another service. While nothing else is at the root, root requests redirect to the same place under `/wheelchair/` | Collin wants the root kept for a hub later. A cookie scoped to `/wheelchair` never reaches other paths on the same host, which a port-per-service layout couldn't guarantee | idea-change |
| 2 | The viewer answers every route under `/wheelchair/` itself: `/wheelchair/`, `/wheelchair/list`, `/wheelchair/assets/list.js`, and so on. `tailscale serve` maps `/wheelchair` to `http://127.0.0.1:<port>/wheelchair`, so a request lands correctly whether Tailscale strips the mount prefix or not. The same prefix applies on every machine, serving or not | One layout everywhere; Tailscale's prefix handling couldn't be checked without `sudo` (Watch List #1) | defaulted |
| 3 | The first visit with `?token=…` is answered by a redirect to the same address without `token`, and that redirect response sets the cookie. The page never sees the token in its address | The token never renders in a page or its address bar. A page-side history rewrite would leave it in the address bar at least once | defaulted |
| 4 | Reads accept either the cookie or `?token=`. Writes from the page (`PUT /graph`, `PUT /view`) accept either the cookie or the `X-Graph-Token` header, and keep today's `Origin` check. The cookie is `SameSite=Strict`. Agents' signed routes are unchanged | Agent links and old bookmarks keep working (IDEA). `SameSite=Strict` plus the `Origin` check stops another site from writing through a remembered browser | defaulted |
| 5 | The cookie holds a value derived from the token, not the token: hex HMAC-SHA256 keyed by the running server's token over the fixed label `wheelchair-remember-v1`. The server accepts a cookie only if it equals that value for the token it is running with | Rotation still invalidates every remembered device in one step, and a copied cookie can't sign an agent's registration or be pasted as `?token=` | user |
| 6 | The cookie lasts as long as browsers allow, `Max-Age=34560000` (400 days), and is set again on every page response to a request that authenticated, by cookie or by token | Nothing should ask for the token again until it is rotated (IDEA); rotation is the deliberate lock-out | user |
| 7 | The cookie is always `Secure`, on every machine | Checked on hearth: both browsers keep a `Secure` cookie from `http://127.0.0.1` (Watch List #2), so one attribute set works for served and local addresses alike | defaulted |
| 8 | The pages stop carrying the token. `index.html`, `list.js` and `doc.js` build every URL under `/wheelchair/` with no `token` and rely on the cookie; writes are same-origin `fetch` calls that send the cookie. A page still sends `X-Graph-Token` only if it was somehow opened with `?token=` and no redirect happened | After the first-visit redirect (#3) the page never knows the token, which is the point | defaulted |
| 9 | Every URL the commands print is under `/wheelchair/`: graph URLs `<base>/wheelchair/?path=…&token=…`, the bookmark `<base>/wheelchair/?token=…` | The first visit through any of them sets the cookie and drops the token (#3) | defaulted |
| 10 | Every old root route answers `308` to the same path and query under `/wheelchair`, including `/whoami` and the API routes, with a JSON body `{"error": "moved", "location": "<new path>"}`. Nothing at the root is served directly | IDEA: the viewer answers only under `/wheelchair/` apart from the redirect. A client following outdated instructions gets a non-200 with the new path in it, not silent success | defaulted |
| 11 | The commands identify a holder through `/wheelchair/whoami`. If that answers `308` or `404`, they ask `/whoami` at the root, which is how a viewer running code from before this change answers; such a holder has no `proof` and is handled as today's older-version rule says (remote-viewer #85) | Keeps the install-time upgrade path working across this change | defaulted |
| 12 | Serving setup maps both `/wheelchair` → `http://127.0.0.1:<port>/wheelchair` and `/` → `http://127.0.0.1:<port>`, so the root redirect reaches old bookmarks. The installer checks `tailscale serve status` for the `/wheelchair` mapping and, if it is missing, prints and offers the one `sudo` command, as today (remote-viewer #9). `--no-serve` prints the commands that remove both. When Collin later puts something else at the root, he replaces the `/` mapping himself and the viewer needs no change | The root mapping is the only thing keeping old links alive, and it is Collin's to reassign | defaulted |
| 13 | Blocking checks on hearth after setup: `curl -s https://hearth.taileb4e52.ts.net/wheelchair/whoami` returns the viewer's JSON (prefix handling, Watch List #1), and on the phone in Firefox the token link lands on `/wheelchair/` with no token in the address, a reload of `/wheelchair/` works, and an edit saves (cookies through `tailscale serve`, Watch List #3) | These can only be observed through the real `tailscale serve` | defaulted |

## Spec

The settled design, grown as decisions land. Bar: a fresh agent with no conversation
history can implement from this section alone — behavior, boundaries, edge cases,
non-goals, and concrete validation commands.

A Mermaid diagram of the flow belongs here, added by Stage 2 at approval — not while the
Spec is still churning. See `protocol/diagrams.md`.

### Where the viewer lives

Every route moves under the prefix `/wheelchair` on every machine, serving or not (Decision
Log #1, #2). The server serves `/wheelchair/` (list page, or the graph viewer with `path`),
`/wheelchair/list`, `/wheelchair/plan`, `/wheelchair/doc`, `/wheelchair/docs`,
`/wheelchair/graph` (GET and PUT), `/wheelchair/view`, `/wheelchair/register`,
`/wheelchair/watching`, `/wheelchair/whoami` and `/wheelchair/assets/list.js` and
`/wheelchair/assets/doc.js`, each behaving exactly as its root route does today apart from
authentication (below). `/wheelchair` without the trailing slash redirects to
`/wheelchair/`.

Every request to a path outside `/wheelchair` answers `308` with `Location` set to
`/wheelchair` plus the original path and query, and a JSON body
`{"error": "moved", "location": "<that location>"}`. Nothing is served at the root
(Decision Log #10). The pages' `<script src>` and every URL they build use the prefix.

Serving setup maps `/wheelchair` → `http://127.0.0.1:<port>/wheelchair` and keeps `/` →
`http://127.0.0.1:<port>` for the redirect (Decision Log #12). Mapping the prefix to the
same prefix means the request lands correctly whether `tailscale serve` strips the mount
path or not (Decision Log #2).

### The first visit and after

A read request (`GET` on a page or read route) carrying a valid `?token=` is answered with a
`303` to the same path and query with `token` removed, and that response sets the cookie
(Decision Log #3). Later requests carry the cookie. The cookie is
`wheelchair_remember=<value>; Path=/wheelchair; HttpOnly; Secure; SameSite=Strict;
Max-Age=34560000` (Decision Log #4, #6, #7). It is set again on every page response to a
request that authenticated, by cookie or by token, so it renews on every visit.

The cookie's value is the hex HMAC-SHA256, keyed by the running server's token, of the fixed
label `wheelchair-remember-v1` (Decision Log #5). The server accepts a cookie only when it
equals that value for the token it is running with, compared in constant time. A rotation
changes the token and so invalidates every cookie at once. The cookie is never accepted as
`?token=`, as `X-Graph-Token`, or as the key for a signed route.

### Authentication per route

- Page and read routes (`/wheelchair/`, `/list`, `/plan`, `/doc`, `/docs`, `GET /graph`, and
  unknown routes under the prefix): a valid cookie, or a valid `?token=`, which also gets
  the redirect above. Otherwise `401`, as today.
- `PUT /wheelchair/graph` and `PUT /wheelchair/view`: a valid cookie or a valid
  `X-Graph-Token`, and in both cases today's `Origin` check (`http://127.0.0.1:<port>` or
  the served origin) (Decision Log #4).
- `POST /wheelchair/register` and `GET /wheelchair/watching`: signed exactly as today; a
  cookie is ignored.
- `/wheelchair/whoami` and `/wheelchair/assets/*.js`: no authentication, as today.

### The pages

`index.html`, `list.js` and `doc.js` build every URL under `/wheelchair/` with no `token`
parameter, and rely on the cookie (Decision Log #8). Writes are same-origin `fetch` calls,
which send the cookie. A page sends `X-Graph-Token` only when its own address carries
`?token=`, which the redirect prevents in normal use. The CSP on `list.html` and
`doc.html` is unchanged except for the prefixed script paths.

### The commands

Every printed URL is under `/wheelchair/`: `--open`/`--show` print
`<base>/wheelchair/?path=…&token=…`, and `--url` prints `<base>/wheelchair/?token=…`,
where `<base>` is the served origin or `http://127.0.0.1:<port>` (Decision Log #9). All
their requests to the server use the prefixed routes. To identify a holder they call
`/wheelchair/whoami`; if that answers `308` or `404`, they ask `/whoami` at the root, which
is how a viewer running code from before this change answers. Such a holder has no `proof`
and is treated by the older-version rule of remote-viewer Decision Log #85 (Decision Log
#11).

### The installer

Serving setup offers the `sudo` command that adds the prefix mapping,
`sudo tailscale serve --bg --set-path /wheelchair http://127.0.0.1:7373/wheelchair`, when
`tailscale serve status` doesn't already show it, and keeps offering the root mapping as
today. It never runs `sudo` silently (remote-viewer Decision Log #9). `--no-serve` prints
the commands that remove both mappings. The bookmark it prints comes from `--url`, so it is
the prefixed one (Decision Log #12).

### Documents

`protocol/graphs.md`: every URL and `curl` example moves under `/wheelchair/`, including
the `PUT` to `http://127.0.0.1:${PORT}/wheelchair/graph` and its `Origin`. It also documents
the `308` an old root path now gets. `README.md`: the address is
`https://hearth.taileb4e52.ts.net/wheelchair/`, the token link is needed once per device, and
the root is free for other services. `AGENTS.md`'s citations are updated where lines move.

### Not in this change

Per-device forgetting or a device list (Q1's third option, declined in Decision Log #5), a
hub at the root, and any change to agent authentication (IDEA, Not doing).

### Validation

```bash
node --test viewer/test/*.test.js
npm --prefix viewer run test:browser
bash install/test/run.sh
bash sensitivity/test/run.sh
bash spine/test/run.sh
./install.sh && ./install.sh               # idempotent; git status --porcelain stays empty
```

Every existing suite is updated for the prefix: the test helpers wait for
`http://127.0.0.1:<port>/wheelchair/` URLs, and the route tests use prefixed routes.

New unit cases: a `GET /wheelchair/?token=<valid>` answers `303` to the address without
`token` and sets the cookie with exactly the attributes above; a request with that cookie
and no token gets the page, the list, a plan, a document and a graph; a cookie from before
a rotation is refused `401` after it; a cookie for the right value is refused as `?token=`,
as `X-Graph-Token` and as a registration key; a wrong cookie with no token is `401`; `PUT
/wheelchair/graph` and `/view` accept the cookie with a good `Origin`, and refuse it with a
foreign one `403`; every root path, including `/whoami`, `/graph` and `/list`, answers `308`
with the prefixed `Location` and the JSON body; `/wheelchair` redirects to `/wheelchair/`;
the page response renews the cookie; the commands print prefixed URLs; a holder answering
only root `/whoami` without `proof` is treated by the older-version rule.

New browser cases, in both projects: opening the `?token=` URL lands on `/wheelchair/` with
no `token` in `page.url()`; reloading `/wheelchair/` in the same context shows the list; a
fresh context opening `/wheelchair/` gets no list; from the list, a graph and a plan
document open, and a drag saves, with no `token` in any request URL (checked by recording
requests); an old root bookmark `/?token=…` ends on `/wheelchair/` with the cookie set.

Installer fixture cases: serving setup offers the `/wheelchair` mapping command when status
lacks it and not when present; `--no-serve` prints both removal commands; the bookmark
printed is prefixed.

Blocking, on hearth, after `./install.sh --serve` and the new `sudo tailscale serve` step
(Decision Log #13):
- `curl -s https://hearth.taileb4e52.ts.net/wheelchair/whoami` returns the viewer's JSON;
- on the phone in Firefox, the new bookmark lands on `/wheelchair/` with no token in the
  address;
- typing `https://hearth.taileb4e52.ts.net/wheelchair/` later shows the list;
- an edit saves;
- the old bookmark still ends up on the list;
- repeat on a laptop.

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them.

| Risk | Why accepted | Round |
|------|--------------|-------|
| The first-visit URL, which carries the token, may be kept in a browser's history as the redirect source | Browsers differ on whether they record a redirect's source, and the token must arrive in some URL once. IDEA only requires it to be gone *after* the first visit | — |
| A client following outdated instructions against a root route gets a `308` rather than working | Every route moves; the `308` body names the new path, and `protocol/graphs.md` is updated in the same change | — |

## Review Rounds

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

Filled by Stage 3. One row per worker brief.

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- 2026-09-23: IDEA confirmed with the `/wheelchair/` layout (Decision Log #1).
- 2026-09-23: Planning finished. No graphs were drawn for this plan, so there are no
  `rejected` entries to account for. Status set to ready-for-review.

