---
slug: diagram-sensitivity
---

# How this works today

How a picture currently reaches Collin's screen, and what decides whether one does.
Written before planning starts, extended as questions dig deeper.

## End to end

```
Collin types /graph <question>  (or /plan, mid-turn)
        ↓
harness loads a rendered wrapper (~/.claude/skills/graph/, ~/.codex/prompts/graph.md)
        ↓
the wrapper's one line points at protocol/graphs.md — the agent reads it
        ↓
start viewer/server.js detached, recover the URL from its log
        ↓
PUT /graph → validateGraph → canonical six-key JSON on disk
        ↓
--show opens a browser tab (silent no-op if one is already on that graph)
        ↓
the page polls GET /graph once a second → 48px topbar + SVG canvas

  ↓ Collin types anything that is not a slash command
nothing happens — no picture, and no protocol file is consulted at all
```

That last branch is what this change exists against.

## What happens

1. **A picture only ever starts from a slash command.** Seven exist; `skills/AGENTS.md:19-27`
   lists each with the single `protocol/` file it points at. `skills/graph/SKILL.md:6-8` is
   the whole Claude wrapper — read `protocol/graphs.md` and follow it — and
   `codex/prompts/graph.md:1` is the Codex twin, one line saying the same thing.
2. **`install.sh` renders those wrappers into both harnesses**, substituting the clone's real
   path for `{{WHEELCHAIR_ROOT}}` (`install.sh:17-19`). It writes to exactly two places,
   `~/.claude/skills/` and `~/.codex/prompts/` (`install.sh:15`), then installs the viewer's
   npm deps and Chromium.
3. **Inside a `/plan` turn, one rule can trigger a graph.** `protocol/planning.md` §"Drawing a
   flow" fires only *when a turn discusses a flow* — a proposed design, not a fact about
   existing code. Conditional, and the agent judges the condition.
4. **The agent writes the graph over HTTP.** `viewer/server.js:924-936` is the whole route
   table: `GET /`, `GET /graph`, `PUT /graph`, `PUT /view`, `GET /whoami`, `GET /watching`.
   `PUT /graph` lands in `handleGraphPut` (`viewer/server.js:685`).
5. **The graph format is closed at six top-level keys.** `validateGraph`
   (`viewer/server.js:108`) returns exactly `schema`, `title`, `source`, `source_detail`,
   `nodes`, `edges` (`viewer/server.js:207-210`), and its own comment states it
   **intentionally drops unknown keys** (`viewer/server.js:106`). `protocol/graphs.md`
   §"Key order and canonical form" fixes that order and requires the file be byte-canonical:
   re-serializing an already-canonical file must produce identical bytes.
6. **The page has one prose surface, and it is per-entry.** `renderDetail`
   (`viewer/index.html:783`) draws an SVG panel when exactly one item is selected
   (`viewer/index.html:978`), showing that entry's `ref`, `note`, `value`, and whether the
   payload was inferred (`viewer/index.html:789-793`). Nothing anywhere shows prose about the
   graph as a whole. The topbar holds a breadcrumb, the `source`/`source_detail` line, a
   two-swatch legend, and six buttons (`viewer/index.html:126-141`).
7. **The canvas already adapts to a taller topbar, in JS only.** `resizeCanvas`
   (`viewer/index.html:919-929`) measures the topbar and sets the SVG's pixel height and `top`
   from it. But `48px` is hardcoded twice in CSS — `svg#canvas` (`viewer/index.html:57`) and
   `#fatal { inset: 48px 0 0 0 }` (`viewer/index.html:41`).

## What matters for this change

**There is no always-on surface in this repo, and both harnesses have one outside it.**
Everything in `protocol/` is pull-only: it is read because a command named it. A setting that
changes behavior on an ordinary question has to be in context *before* Collin types. Both
harnesses do have such a file, and they are symmetric — `~/.claude/CLAUDE.md` and
`~/.codex/AGENTS.md`, each loaded every turn, each 44+ lines of prose rules today. Neither
mentions wheelchair, graphs, or diagrams (grepped: no hits). `install.sh` has never written to
either.

**A narration field added to the JSON without touching the server is silently swallowed.**
Not rejected — dropped, by `validateGraph`'s explicit unknown-key policy
(`viewer/server.js:106`). So this lands as a real format change: validation, canonical key
order, the page, and a rule about who owns narration. Nodes need Collin's verdict before an
agent may alter them (`protocol/graphs.md` §Verdicts); graph-level narration plausibly should
not, and that asymmetry has to be stated or the preservation contract gets murky.

**`high` sensitivity contradicts two rules already written down.**
`protocol/diagrams.md`: *"A diagram is redundant with its prose... A reader with no renderer
must get the whole picture without it"*, and *"A diagram is drawn when its document stops
changing, or it is not there."* "Prioritize a diagram over a big chunk of text" is the
opposite of the first; a diagram every planning turn is the opposite of the second. Graphs are
exempt by design — `protocol/graphs.md` §"What a graph is, and isn't" makes them disposable
and freely redrawn — which suggests the setting should govern graphs and in-conversation
pictures, and leave Mermaid-in-documents alone. That is a question for Collin, not a
default I should take.

## Problems found

**The always-on file this change would most naturally hang on already misroutes.**
`~/.claude/CLAUDE.md:44` and `~/.codex/AGENTS.md:44` both point the prose rules at
`/home/collin/Projects/personal/personal_agent_workflows/protocol/writing.md`. That directory
does not exist — the repo is now `wheelchair`. The one instruction loaded on every turn in
every project carries a dead path. Worth fixing regardless of what this plan decides, and it
is evidence about the mechanism: a rendered region is maintainable, a hand-copied path rots.

**Nothing tests the protocol documents**, by design (`protocol/AGENTS.md` §Tests: "None —
these are documents"). So the behavioral half of this change — an agent actually drawing more
pictures — has no seam to assert against, while the viewer half has two real suites:
`viewer/test/server.test.js` under `node --test`, and `viewer/test/browser.spec.js`, 17 tests
driving real headless Chromium through real pointer events (`viewer/test/browser.spec.js:1-7`).
The asymmetry will shape how "done" gets defined.

## Not checked

- The bulk-verdict and `PUT /view` paths in `viewer/server.js` beyond their route lines — I
  read the write path for `/graph`, not the page's own write route.
- Whether Codex reads `~/.codex/AGENTS.md` on every turn or only at session start. I confirmed
  the file exists and holds standing guidance; I did not verify the load semantics.
- `viewer/server.js` locking, the `.server` lockfile lifecycle, and the `--open`/`--show`
  race handling — read the protocol's description of them, not the implementation.
- `protocol/adopt.md`, `implementation.md`, `verification.md`, `plan-review.md`, `lanes.md`,
  `routers.md`, `spine.md`. I read the four that this change touches: `graphs.md`,
  `diagrams.md`, `planning.md`, `map.md`.
- Claude Code's hook mechanism as an alternative injection point. `~/.claude/settings.json`
  exists; I did not read what it configures.
