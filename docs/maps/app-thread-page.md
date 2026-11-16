# Map: thread diagrams and message composer

Checked against: `635c45f07991f31191f2ab1443b52b4ee76559d5` (origin/main)
Files covered: `protocol/app/cards.md`, `viewer/app/card.js`, `viewer/app/cards.js`, `viewer/app/chat.js`, `viewer/app/routes.js`, `viewer/app/state.js`, `viewer/pages/thread.js`, `viewer/pages/thread.html`, `viewer/pages/thread.css`, `viewer/index.html`

## Flow

A lead posts a diagram card naming the plan, graph and title (`protocol/app/cards.md:184-195`). The hub registers a graph before storing its card (`viewer/app/cards.js:50-55,79`). The thread fetches chat and renders the diagram in an iframe, using the worktree for live graphs or the branch API for archived ones (`viewer/pages/thread.js:177-188,644-656,805`). The iframe's graph page fetches and renders the actual graph (`viewer/index.html:462-479`). The composer sends trimmed text to the thread message route (`viewer/pages/thread.js:847-865`; `viewer/app/routes.js:426-433`).

```text
lead -> diagram card -> register and store -> chat -> graph iframe
```

## What I did not look at

Other card behavior, transcript parsing, graph drawing internals and browser tests.
