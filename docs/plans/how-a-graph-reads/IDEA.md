---
slug: how-a-graph-reads
status: confirmed
created: 2026-08-31
---

# A graph that reads without a legend, and a sentence that never guesses where anything is

## What we're building

Two changes to how a drawn graph lands on the reader. First, the sentence an agent writes
about its own picture stops describing where things sit and starts naming what they are —
enforced at the write, not just asked for in prose. Second, the first render puts arrows
where the eye expects them: a step forward leaves the bottom of a box and arrives at the top
of the next, and the sides are kept for the connections that are not a step forward.

## Why — the problem

An agent has no idea where anything is. It is forbidden from sending coordinates, the server
lays the picture out after the write, and Collin then drags boxes wherever he likes — so
"the node on the right" is not a vague reference, it is invented. Nine of the eleven graph
explanations that predate this plan contain one, including a committed file that says "the greyed
box on the right" in a graph with no groups at all. The format already diagnosed this and
prescribed the wrong cure: it tells the agent to keep the position word and wrap it in a
clickable reference, which makes the boxes findable while leaving the false claim in the
sentence. Nothing checks either way.

Separately, the first render is good enough to read but still fights the eye. Every arrow is
a straight line between two box centres, clipped wherever it happens to leave the rectangle,
so about one arrow in nine exits through the left or right face of a box that has a perfectly
good bottom edge — and a taller box makes it worse, not better. And where a decision's outcomes land on
different rows, nothing marks them as alternatives rather than as the next step in a chain.

## What good looks like

- Collin can read any explanation panel and act on every noun in it without looking at the
  canvas to work out what was meant.
- An agent that writes a positional claim gets told so at the write, in the same way it gets
  told about a dangling group reference today. The failure is not silent and does not reach
  Collin.
- On a fresh graph, an arrow that carries the flow forward leaves the bottom edge of its box
  and lands on the top edge of the next one. An arrow that is not carrying the flow forward —
  a loop back, a link between two boxes on the same row — takes the sides wherever the sides
  are clean, and the top and bottom the other way round where they are not, so it never reads
  as a step forward and never draws a line through a box. Where a pair of boxes points both
  ways, the forward arrow of that pair is still a forward arrow and still leaves the bottom;
  it is the one pointing back that moves aside. (Amended after the fact to match Decision 34:
  the original bullet promised the sides unconditionally, which round 6 established draws
  through a box on any three-cycle.)
- A decision's outcomes read as a branch rather than as the next step in a chain, because
  its arrows visibly fan out from one edge of the box.
- The committed graphs in this repo still open, still hold Collin's positions and verdicts,
  and read better than they do today.

## Not doing

- **No elbows, no routing.** An arrow stays one straight line; only where it meets each box
  changes. Bent arrows would mean rewriting edge labels, leader lines and hit testing, and
  they are not what makes these pictures hard to read.
- **An arrow from a box back into itself is refused, not drawn.** Today it is accepted and
  then silently discarded, and its words land on the box's own text. A repetition belongs in
  the box's label — "loops until done" — so the fix is a refusal that says so, not the
  format's only bent arrow.
- **Not touching what the dial decides.** Whether a picture gets drawn at all is
  `protocol/sensitivity.md`'s question and stays exactly as it is.
- **Not touching verdicts, preservation, or containment.** Nothing here changes what an
  agent may overwrite or how a child graph is reached.
- **Not re-laying-out graphs Collin has already arranged.** A position on disk stays a
  position on disk.
- **Not banning groups or references.** The mechanism for pointing a phrase at a set of
  boxes is right and stays; what changes is what the phrase is allowed to say.

## Constraints

- **Every arrow points down the page.** Stated in `protocol/graphs.md` and held by a test
  named for it (`viewer/test/server.test.js:1098`). This change does not touch layering at all, so the
  rule is a constraint to preserve rather than a trade to settle.
- **An agent never sends a position.** Whatever the explanation is allowed to say has to be
  sayable by something that has never seen the layout.
- **`viewer/server.js` and `viewer/index.html` share no module.** Any geometry both need is
  a number written down in `protocol/graphs.md` and copied by hand into each, and the tests
  are the only thing holding the two copies together.
- **A refusal blocks the whole write.** The server has no way to accept a graph and complain
  about one sentence, so anything enforced this way has to be worth failing a write over.
