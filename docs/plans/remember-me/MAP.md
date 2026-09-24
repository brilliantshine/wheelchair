# How the viewer checks who you are today

## End to end

The viewer has one secret, the lasting token in `<cache-root>/.token`. It is created once
and changes only on `--rotate-token` (remote-viewer Decision Log #14, #15). Every way in is
a check against it.

A person gets in by opening a URL that carries it: the bookmark from `--url`
(`https://hearth.taileb4e52.ts.net/?token=…`), or the graph URL an agent prints
(`viewerUrl`, `viewer/server.js:1710-1713`, which puts `&token=…` in every URL it builds).

On the server, every page and read route calls `requireGetToken`, which compares the
`token` query parameter with the running server's token and answers `401 bad-token` on a
mismatch (`viewer/server.js:1228-1232`). That covers `GET /` (the list page, or the graph
viewer when a `path` is given; `handleRoot`, `:1618`), `/graph` (`:1422`), `/list`
(`:1577`), `/plan` (`:1586`), `/doc` (`:1592`) and `/docs` (`:1605`). An unknown route also
checks the token before answering `404`, so a stranger learns nothing about which routes
exist (`:1890`). The only routes without the token are `/whoami` and the two `/assets/`
scripts (`handleAsset`, `:1610`).

Writes are checked differently. `PUT /graph` and `PUT /view`, which the graph page sends
when you drag a box or mark an entry, need the token in an `X-Graph-Token` header, and the
`Origin` must be `http://127.0.0.1:<port>` or the served origin (`requirePutAuth`,
`:1234-1241`). `POST /register` and `GET /watching`, which only the agents' commands send,
are signed with the token rather than carrying it (`requireSignedAuth`, `:1253`).

In the browser, each page reads the token out of its own address bar once and puts it back
into every URL it builds:

- `viewer/index.html:286` reads it, and `:382` and `:388` build graph and child-graph URLs
  with it. `:448` sends it as `X-Graph-Token` on writes.
- `viewer/list.js:7` reads it, and `:18-27` add it to every graph and plan link and to the
  `/list` poll (`:134`).
- `viewer/doc.js:7` reads it, and `:11-28` add it to the back link, the file links, and the
  `/plan` and `/doc` fetches.

Nothing stores it. There is no cookie, `localStorage` or `sessionStorage` anywhere in
`viewer/`, and no page removes it from the address bar. It stays in the URL of every page
you visit, and so in the browser's history.

```
bookmark or agent URL, ?token=…
        ↓
GET /?token=…  →  requireGetToken  →  401 if wrong
        ↓
page reads token from location.search
        ↓
every link and fetch carries ?token=…      writes carry X-Graph-Token + Origin
```

## How the address reaches the viewer

`tailscale serve` on hearth answers `https://hearth.taileb4e52.ts.net` on the standard HTTPS
port and forwards `/` to `http://127.0.0.1:7373` (checked: `tailscale serve status` prints
`|-- / proxy http://127.0.0.1:7373`). The viewer itself still listens on `127.0.0.1` only.
So every request the viewer sees comes from `127.0.0.1`, whether it came from a phone on the
tailnet or a command on hearth. The viewer can't tell those apart by address, which is why
the token exists at all (remote-viewer Decision Log #14).

A browser keeps cookies per host name. It sends a cookie set by
`hearth.taileb4e52.ts.net` to every port and every path on that name. That is the fact
behind the first question: anything else later served on that name would receive the
viewer's cookie too.

## Not checked

- Whether Chromium and Firefox accept a `Secure` cookie from `http://127.0.0.1:<port>`, the
  address an agent's URL uses on a machine that isn't serving. Both treat localhost as a
  secure context in some respects, but I haven't tested cookie handling there.
- Whether `tailscale serve` passes a `Set-Cookie` response header and a `Cookie` request
  header through unchanged. I expect it does, since it passed `Origin` through (the phone
  write worked), but that's not the same header.
- Whether this tailnet can use Tailscale's per-service names (`<name>.<tailnet>.ts.net`).
