# Map: serving embedded graphs and app API

Checked against: `635c45f07991f31191f2ab1443b52b4ee76559d5` (origin/main)
Files covered: `viewer/server.js`, `viewer/app/routes.js`, `viewer/app/threads.js`, `viewer/index.html`

## Flow

The server authenticates app API reads and writes (`viewer/server.js:2257-2258`). App pages use a CSP permitting same-origin frames (`viewer/server.js:1859-1861,1898-1911`). A live graph page reads its graph through GET /graph, while an archived page reads the thread's branch through the app API (`viewer/index.html:462-479`; `viewer/app/routes.js:423-424`; `viewer/app/threads.js:216-229`).

```text
app page -> graph iframe -> live graph API or archived branch graph API
```

## What I did not look at

Other viewer pages, asset authentication, layout and reverse proxies.
