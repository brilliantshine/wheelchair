# Map: thread diagrams and message composer

Checked against: `635c45f07991f31191f2ab1443b52b4ee76559d5` (origin/main)
Files covered: `protocol/app/cards.md`, `viewer/app/card.js`, `viewer/app/cards.js`, `viewer/app/chat.js`, `viewer/app/routes.js`, `viewer/app/state.js`, `viewer/pages/thread.js`, `viewer/pages/thread.html`, `viewer/pages/thread.css`, `viewer/index.html`

> The covered files changed after the checked-against commit. The lighter-server paths were rechecked against `e4117bdcacf06f2a3c73dd22d8af8d8086cb00e3`; see [lighter-server/MAP.md](../plans/lighter-server/MAP.md). Other claims below retain their historical checked-against commit.

## Flow

A lead posts a diagram card naming the plan, graph and title (`protocol/app/cards.md:184-195`). The hub registers a graph before storing its card (`viewer/app/cards.js:50-55,79`). The thread fetches chat and renders the diagram in an iframe, using the worktree for live graphs or the branch API for archived ones (`viewer/pages/thread.js:177-188,644-656,805`). The iframe's graph page fetches and renders the actual graph (`viewer/index.html:462-479`). The composer sends trimmed text to the thread message route (`viewer/pages/thread.js:847-865`; `viewer/app/routes.js:426-433`).

```text
lead -> diagram card -> register and store -> chat -> graph iframe
```

## What I did not look at

Other card behavior, transcript parsing, graph drawing internals and browser tests.

> Agents-screen recheck at `3065046af16a1f6b2822d308b5c32431ca39a449`: the overlapping session, page and card paths were checked in [app-agents-screen.md](app-agents-screen.md). The rest of this older map was not rechecked.

> Transcript-related paths rechecked at `899afb69395ed5dddc5828ae86bad1fd3e765947`; see [chat transcript refresh](chat-transcript-refresh.md). Other claims above retain their stated historical checks.
