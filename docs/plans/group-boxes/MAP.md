---
slug: group-boxes
---

# How this works today

The graph format, the server that validates and writes it, and the page that draws it —
as they stand before this plan. Written against `protocol/graphs.md`, `viewer/server.js`
and `viewer/index.html` at commit `b3a7799`.

## End to end

```
agent reads protocol/graphs.md
   → starts viewer/server.js --open <path>      (registers the path as writable)
   → PUT /graph  {hash, graph}
        → validateGraph: shape, ids, kinds, groups, edges, verdicts
        → checkAgentWrite: preservation contract
        → first write only: layout() assigns x/y      ↓ later writes: keep disk x/y
        → canonicalBytes → atomic rename to disk
   → --show opens (or reuses) a browser tab
        → GET /graph  → page renders nodes, then edges, then labels
        → Collin drags a box, or approves/rejects a selection
        → PUT /view  → checkViewChanges refuses anything but position + verdict
```

## What happens

1. **The file is a flat list of nodes and edges plus three region-ish extras.** Top-level
   keys in fixed order: `schema`, `title`, `source`, `source_detail`, `explanation`,
   `groups`, `nodes`, `edges` (`viewer/server.js:94`). Every key is present on every
   entry, `null` where it doesn't apply, so re-serializing a canonical file is
   byte-identical.

2. **`groups` already exists, and it is invisible.** A group is `{id, nodes}` and nothing
   else (`viewer/server.js:92`). Its only job is to let a phrase in `explanation` point at
   a set of boxes: `[the left branch](#left-branch)`, matched by one regular expression
   duplicated in both files (`viewer/server.js:54`, `viewer/index.html:225`). Hovering the
   phrase dims everything outside the set; clicking it selects the set
   (`viewer/index.html:497`, `:509`). Nothing about a group is drawn on the canvas when
   nobody is hovering a phrase.

3. **The server enforces that a group is never silent, in both directions.** A phrase
   pointing at a group that isn't in `groups` is refused `explanation-missing-group`; a
   group in `groups` that no phrase points at is refused `group-unreferenced`
   (`viewer/server.js:226-236`). A group must name at least one node, and every id must be
   a node in this same file — `group-missing-node` (`:181`). So today a group cannot exist
   without prose pointing at it.

4. **Groups sit outside the verdict system entirely.** Nodes and edges carry
   `origin` (`proposed`/`agreed`/`rejected`) and `was`, and the preservation contract
   refuses a write that drops or alters a ruled entry (`viewer/server.js:checkAgentWrite`).
   Groups have neither field. `protocol/graphs.md:114` states the reason: a group is the
   agent's own claim about its own picture, rewritten freely on every redraw, because an
   approved region goes stale the moment the boxes move underneath it.

5. **The browser may not touch a group.** `checkViewChanges` compares the canonicalized
   `groups` of current and incoming and refuses `structural-difference` if they differ
   (`viewer/server.js:907-914`) — alongside `title`, `source`, `source_detail` and
   `explanation`. The page's only writes are node positions and verdicts.

6. **Containment is a separate mechanism, and it is per-node and cross-file.** A node's
   `graph` field names a child file in the parent's own directory (`protocol/graphs.md`
   schema section; `viewer/server.js:childPath`). The box gets an `open ›` badge in its
   top-right corner, and clicking it navigates (`viewer/index.html:948-966`). Edges connect
   siblings only. Preservation extends recursively across the boundary: a container node
   whose subtree holds any verdict cannot be removed or retargeted — `container-orphan`
   (`viewer/server.js:400-411`).

7. **Layout knows only nodes and edges.** `layout()` is a small Sugiyama pass — break
   cycles, layer by longest path, order rows to reduce crossings, pull each box toward its
   neighbours' median, then set disconnected components side by side
   (`viewer/server.js:429-452`). It runs **only on the first write** of a file; every later
   write keeps whatever positions are on disk (`retainDiskPositions`, called at
   `viewer/server.js:944`). Nothing in it has any concept of a region that should stay
   together.

8. **The page draws in three fixed passes and has no background layer.** `render()`
   clears the SVG, appends marker defs and a hidden text element used to measure label
   widths, then one transformed `<g>` root: every node, then every edge, then a single
   label layer appended last so no edge line can paint over a label
   (`viewer/index.html:1335-1401`). A box is 200 wide, its height a function of how many
   lines its label wrapped to, capped at five (`:212`, `:218`, `nodeHeight` at `:767`).

9. **Dragging moves nodes and nothing else.** `startNodeDrag` collects the selection's node
   ids, moves each by the pointer delta, and on release rounds and `PUT /view`s the new
   positions (`viewer/index.html:1417`, `:1470`). Box-select tests the marquee against each
   node's rect (`finishMarquee` at `:1501`). Fit-to-view takes the bounding box of the
   nodes only (`:591`).

10. **The Spec's Mermaid diagram shows the top level only.** `protocol/diagrams.md:78` says
    to draw the top level and mark which nodes hold a child underneath — a graph's
    containment is flattened away in the Spec, and groups appear in it not at all.

## What matters for this change

The word `groups` is taken, by something that is nearly the same data and deliberately the
opposite in every other respect: it has no name a reader sees, no description, carries no
verdict, is refused if the prose doesn't reference it, and never appears on the canvas
unless hovered. A visible titled region is the same `{id, nodes}` plus a label — so this is
either an extension of that field or a second field sitting next to it, and that choice
decides most of the rest.

Layout is the second load-bearing fact. It runs once, on the first write, and knows nothing
about regions. A group box that is drawn from the bounding box of its members costs the
layout nothing and can look ridiculous the moment two members are dragged apart; a group
that constrains layout means changing the one algorithm that has so far only ever had to
place independent boxes.

Third: whether a group is Collin's to rule on. Nodes and edges carry verdicts and are
protected; groups explicitly are not, and `protocol/graphs.md:114` argues that on purpose.
A group with a name and a description is a claim about the system in a way an unnamed
highlight set is not, which is the argument for reversing that — and it would pull groups
into the preservation contract, `checkViewChanges`, and the browser's approve/reject
gestures all at once.

## Problems found

Nothing broken. One thing to be aware of rather than fixed: the group-reference regular
expression is written out twice, once in each file, on purpose because the two share no
module (`viewer/server.js:54`, `viewer/index.html:225`). Anything this change adds to the
group contract that both files must agree on inherits that same duplication.

## Not checked

- The browser suite (`viewer/test/browser.spec.js`) and the server suite
  (`viewer/test/server.test.js`) beyond confirming they exist — I have not read which
  group behaviours are already asserted, so I don't yet know what a change here breaks.
- `skills/graph/` and `codex/prompts/graph.md` — I assumed from the wrapper convention in
  `AGENTS.md` that they are one-line pointers to `protocol/graphs.md` and carry no rules of
  their own, but did not open them.
- CSS. I read the group-dim rules (`viewer/index.html:165`) but not the stylesheet as a
  whole, so I can't yet say what visual vocabulary is free for a region boundary.
- Anything about how `/spine` or the other protocol documents reference graphs.
