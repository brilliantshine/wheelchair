---
slug: diagram-sensitivity
status: confirmed
created: 2026-08-25
---

# Answer with a picture, not just paragraphs

The north star. Written before any design questions, confirmed by Collin, then held stable
while PLAN.md churns.

## What we're building

A dial that controls how readily an agent answers with a picture instead of prose alone,
set by one command and remembered afterwards. Three positions: only when asked, put one in
front of me when it helps, and lead with the picture wherever there's a shape to show.

Plus a written explanation inside the graph viewer — a few sentences from the agent saying
what this picture shows and what to look at — so the boxes and arrows aren't left to speak
for themselves.

## Why — the problem

**A picture only appears today if you go and ask for one.** There is one command that draws
a graph, and one rule inside planning that draws one when a turn happens to be proposing a
new flow. Everything else — every ordinary "how does this work", every planning question
about a choice between two shapes — comes back as paragraphs. So the default answer to a
question about a shape is a wall of text, and the burden of turning it back into a shape
falls on the reader.

**Planning is where this costs the most.** A planning turn asks you to choose between
options whose whole difference is structural: what talks to what, what happens in which
order, where a thing lives. That is precisely what prose is worst at, and precisely where a
picture per turn would pay for itself.

**And when a picture does arrive, it arrives silent.** The viewer shows boxes, arrows, and a
one-line title. Anything the agent wanted to say about the picture — what it's arguing, which
part is the interesting part, what it deliberately left out — has nowhere to go except back
into the paragraphs the picture was supposed to replace.

## What good looks like

Things observable from outside, no mechanics:

- You ask an ordinary question about how something works — no slash command — and a picture
  opens, unprompted, when the answer has a shape.
- Every planning question arrives with a picture of the thing being decided, not just a
  description of it.
- The viewer carries a short written explanation alongside the graph: what it shows, what
  to look at, what it leaves out. Readable before you've clicked anything.
- One command moves the dial, and the next turn behaves differently. Turning it all the way
  down restores today's behavior exactly: nothing appears unless you ask.
- It behaves identically driven from Claude Code and from the Codex CLI.
- At the top setting, an answer leads with the picture and the writing tightens around it —
  but the words still carry the whole answer, said shorter. A turn is read in places no viewer
  runs, so the picture is always redundant with the prose, never a substitute for part of it.

## Not doing

- **Not changing how diagrams work inside documents.** `MAP.md`, `PLAN.md`, `COMPLETION.md`
  and the router files keep the rules they have — which kind of diagram each gets, and that a
  diagram is only drawn once a document has stopped changing. The dial governs what happens
  in a conversation turn and in the viewer, nothing else. *This is the one line here worth
  arguing with; see the note below.*
- **Not a picture for every message.** A question with no shape in it gets no picture at any
  setting. The dial changes how eagerly a shape is drawn, never whether one is invented.
- **Not inferring the setting from behavior.** No learning what you seem to want. You set it,
  it stays set, and you can see what it is.
- **Not a new kind of picture.** This uses the graph viewer that already exists. No new rendering
  surface, no new tool, and nothing new in the body of a reply.
- **Not making a graph durable.** A graph is still disposable — redrawn from nothing when it
  goes stale, never patched back into truth, and never documentation. The written explanation
  is part of the picture, not a record that outlives it.
- **Not a review gate.** More pictures does not mean more approving. The dial is about what
  gets shown, never about what needs your sign-off before an agent continues.

## Constraints

- **Both harnesses, same behavior.** Claude Code and the Codex CLI run the same rules
  through wrappers that carry no content of their own. A dial that only works in one of them
  is a broken dial.
- **The dial has to be in effect before you type.** A setting that changes what happens on an
  ordinary question cannot wait to be looked up by a command, because on an ordinary question
  no command runs. That puts it on a surface this repo does not currently own.
- **A person's verdicts on a graph are never overwritten.** The existing contract stands
  whatever the dial says: an agent proposes, only a person approves or strikes, a struck
  entry is permanent, and an approved one can only be superseded visibly.
- **Moving the dial must not mean editing a file by hand**, and must not require re-running
  the installer.
- **Turning it down has to be a real off.** At the lowest setting the behavior is today's,
  not a quieter version of the new one.

---

**The line to argue with:** the first non-goal. I am proposing the dial governs conversation
turns and the viewer, and leaves document diagrams alone — because a graph is already defined
as disposable and freely redrawn, so drawing one every turn breaks nothing, whereas the
document rules exist specifically to stop a stale picture being committed mid-churn. If what
you actually want is a Mermaid diagram landing in `PLAN.md` on every planning turn too, that
is a different and larger change, and it contradicts a rule currently written down. Say so
now rather than at question four.
