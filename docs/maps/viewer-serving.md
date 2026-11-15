# Map: serving embedded graphs and app API

Checked against: `7c380321f4556a08b63485203d613feeeae1f640` (origin/main)
Files covered: `viewer/server.js`, `viewer/app/routes.js`, `viewer/app/threads.js`, `viewer/index.html`

## Flow

1. The server requires browser read or write authentication for non-machine app API routes, and checks a machine secret on machine callbacks (`viewer/server.js:2210-2223`; `viewer/app/routes.js:297-301`). App pages require the remember cookie and send `APP_PAGE_CSP` (`viewer/server.js:1867-1881`).
2. The app CSP adds `frame-src 'self'` to a policy whose `default-src` is none and `connect-src` is self (`viewer/server.js:47,1830-1832`). The live graph page checks the graph path and registration; the archived graph page uses an archive query. Both serve `index.html` without a CSP response header in these branches (`viewer/server.js:1912-1936`).
3. The graph page fetches live graph data or archived data (`viewer/index.html:462-479`). The archived API permits a plain JSON filename under the plan's `graphs/` on the thread branch and uses `git show`, with a 2 MiB output buffer (`viewer/app/routes.js:340-341`; `viewer/app/threads.js:195-208`).

```text
app page -> same-origin iframe -> graph page -> live graph API or archived branch graph API
```

## What I did not look at

Graph validation and layout, other viewer pages, asset routes, cookie implementation, browser tests and external reverse proxies. This focused map replaces the older broad map because its covered files changed; the prior version remains in git history.
