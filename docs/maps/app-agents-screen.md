# Map: Agents screen and session signals

Checked against: `dd85af5f2d49c4fc6440a1c450aeaefebdc5ed5f` (origin/main)
Files covered: `viewer/app/agents.js`, `viewer/app/routes.js`, `viewer/app/sessions.js`, `viewer/app/cards.js`, `viewer/pages/agents.html`, `viewer/pages/agents.js`, `viewer/pages/term-view.js`, `viewer/app/API.md`

```text
thread sessions + cards -> agents tree and state -> Agents API -> five-second poll
                                                            -> selected agent panel
                                                            -> terminal pane
```

The hub builds one tree per unarchived thread from `started_by`; the newest lead represents earlier leads, missing parents and cycles fall back to it, and finished nodes remain (`viewer/app/agents.js:14-33`). On turn end it infers waiting from the latest message to a starter and lack of a later reply, or from live unfinished children; this is not an explicit question chain (`viewer/app/agents.js:40-53`). The API supplies public session fields, title, state, waiting, asides and counts (`viewer/app/agents.js:23,52-60`; `viewer/app/API.md:158`; `viewer/app/routes.js:64`).

The page polls agents and thread-list endpoints every five seconds; selection is in URL parameters, `branch` draws the tree, and the selected side panel renders status, duration, model, terminal and brief (`viewer/pages/agents.js:18-22,25-54`). Its bottom terminal mounts shared `TermView`, can retarget, resize, expand and pop out (`viewer/pages/agents.js:7-16,37-38`; `viewer/pages/agents.html:14-19`). The current panel has no activity history or context ring (`viewer/pages/agents.js:51`).

Message cards record sender and recipient, queue text prefixed with sender, and results go to `started_by` (`viewer/app/cards.js:11-20,115-133`). Queue delivery records `to`, `source`, text and time in bounded sent history (`viewer/app/sessions.js:327-336,348-385`). A question posted by a lead has a card author but no structured link to prior messages (`viewer/app/cards.js:11-20,115-116`; `viewer/app/card.js:1-150`).

What I did not look at: visual CSS details, every card kind, or every terminal interaction.
