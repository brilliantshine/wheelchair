# Map: serving and navigating app pages

Checked against: `7c380321f4556a08b63485203d613feeeae1f640` (origin/main)
Files covered: `viewer/server.js`, `viewer/pages/nav.js`, `viewer/pages/terminal.html`, `viewer/pages/sessions.html`

## Flow

The server allows app page names through `APP_PAGES`, currently including `sessions` and `terminal` (`viewer/server.js:1830`, `:1867-1885`). Sessions and terminal load their scripts and the shared navigation (`viewer/pages/sessions.html:7-11`, `viewer/pages/terminal.html:7-11`). The shared nav has a fixed Sessions link and fetches session data to display its count (`viewer/pages/nav.js:38-41`, `:108-122`). Terminal identifies Sessions as the current nav page and links back to it (`viewer/pages/terminal.html:11-14`).

```text
app URL -> server page allowlist -> page HTML -> shared nav and page script
```

## What I did not look at

- Non-app viewer routes, asset auth, document pages, CSS and their tests.

> Agents-screen recheck at `3065046af16a1f6b2822d308b5c32431ca39a449`: the overlapping session, page and card paths were checked in [app-agents-screen.md](app-agents-screen.md). The rest of this older map was not rechecked.

> Mockup-polish overlap rechecked at `25f34a4572c4beb9032f16f818b6502cc59f62bd`: see [mockup viewer flow](mockup-viewer-flow.md). Other claims retain their historical checked-against commit.
