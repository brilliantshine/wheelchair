---
slug: editable-node-graphs
status: confirmed   # draft | confirmed
created: 2026-08-22
---

> **Redacted for publication.** Repository and directory names in this document are stand-ins:
> the reference repo appears as `almanac`, and one employer's repositories as `atlas-*`,
> `beacon` and `dev-tooling` under `~/src/work`. Absolute paths were rewritten to `~/src/...`.
> This includes names inside pasted command output and `file:line` citations, so a path here is
> a redaction rather than a result. Every observation, count and verdict is otherwise unchanged.

# Diagrams agents draw and Collin can redraw

**Scope note (2026-08-22):** the router-document half of this idea moved to its own plan,
`docs/plans/router-spine/`, after review found the two halves share no mechanism. Routers are
still the preferred input to a graph and this plan depends on that one for the format of
`viewer/`'s own router, but everything about producing and maintaining routers lives there now.

## What we're building

Two things.

**Diagrams in the documents agents already write**, so a plan or an explanation arrives with
a picture in it instead of prose alone.

**A small graph you can open in a browser and judge.** When you ask how a feature works,
or when a plan proposes how something should flow, the agent writes that picture to a file. You
rearrange it so it reads, and you approve or strike whatever is wrong — in bulk, not one box at a
time. The next agent to pick up the work reads your verdicts rather than only its own proposal.

**Scope change, 2026-08-23:** the first version does not let you add or rename anything. You answer
with approvals and rejections, and explain anything else in prose. Authoring can arrive later if it
turns out to be wanted; being unable to *answer* was the gap, and a verdict is an answer.

## Why — the problem

Everything this workflow produces is prose. A plan is fifteen questions and a growing spec
in a markdown file, and understanding the shape of a design means reading all of it and
holding it in your head. You are a visual thinker and that is the wrong medium for you.

The half no tool currently gives you is the return trip. You can be shown a diagram, but you
cannot answer with one. When a proposed flow is wrong you have to translate the correction
into sentences and hope the agent rebuilds what you pictured. Moving a box and adding one
next to it says the same thing in two seconds.

What makes a drawn picture trustworthy is where it came from. A picture derived from a
seven-thousand-node graph is a guess; one derived from a document a person wrote and keeps true
is a summary. The sibling plan builds those documents; this one reads them.

They already contain the diagrams, in embryo. almanac's timeline router has a section
called Pipeline order whose entire content is `language.py → interpretation.py → admission.py →
repository.py → solver.py → explain.py`, followed by a table giving each file one line. The
picture is written; it just is not drawable, and nothing carries a person's corrections back
out of it.

## What good looks like

You ask how a feature works and inside a minute you are looking at ten to twenty-five boxes
with labeled arrows, each box telling you where it came from, instead of reading four
paragraphs.

During planning a proposed flow shows up as a picture you can open. You rearrange it so it reads and
strike the parts that are wrong. What you struck lands in the plan — usually folded straight into the
spec with a line saying so, and as the next question when striking it left something genuinely open.

Your layout survives. You come back the following day and everything is where you left it —
no agent has helpfully re-laid-out your work.

An agent reading the file can tell which parts you ruled on and which parts it proposed
itself, without inferring it from where things sit on the canvas.

Someone reading the plan in a terminal, with no browser, still gets a complete picture from
the prose. The diagram adds; it never carries meaning nothing else carries.

## Not doing

Not letting you author. No adding nodes, no adding connections, no renaming, no editing what a
connection carries. The first version is a verdict surface: rearrange, approve, reject. Anything you
want to say beyond that, you say in prose — which you were going to do anyway, and which needs no
schema.

Not producing or maintaining router documents. That is `docs/plans/router-spine/`.

Not rendering the whole graphify graph. No seven-thousand-node canvas — that artifact exists
and you have already judged it unreadable.

Not replacing the plain-text diagram in MAP.md. That one is read in a terminal and the
protocol bans Mermaid there on purpose.

Not building a drawing tool. No freehand, no colors, no fonts, nothing beyond boxes and
arrows. If you want to sketch, you have paper.

Not a Zed extension. Zed cannot host a panel like this, so it opens in a browser and that is
the end of the question.

Not multi-user anything — no sharing, no live cursors, no server anyone else connects to.

Diagrams are welcome in any document — there is no cap and no earn-its-place test. A reader
who does not want one skips it. What is out of scope is a diagram nobody keeps true: how
often a picture is regenerated in a document that changes every turn is a design decision,
not a licence to leave stale pictures lying around.

## Constraints

The routers are the spine and graphify is a supplement, not the other way round. graphify must
never be the source for "where does X live" or "what owns Y". It earns its place on blast
radius, distance between two far-apart concepts, and community structure, and every result is a
lead to verify in source.

Most repos have no routers today, so most graphs will be drawn from a direct read of the code
and have to say so.

Zed extensions can provide languages, debuggers, themes, icon themes, snippets, and MCP
servers. They cannot provide UI panels or webviews, so nothing here renders inside your
editor.

Plan artifacts live in the repo you are planning against, while the thing that opens them
installs once and has to be available everywhere. `install.sh` only knows how to create
symlinks today.

This repo has no code in it today. The sibling plan lands first and brings it under git, so this
one is not the first executable thing here — but there is still no review gate, since nothing in
this repo has ever been through one.

A single graphify query can reach hundreds of nodes, so anything drawn from it narrows first
and then cites what it kept.

The graph file has to survive being written by an agent, edited by a person, and read back by
a different agent that was present for neither.
