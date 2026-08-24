# Writing for a human

Rules for anything a person reads: turn text in a session, status reports, remediation
summaries, drafted replies to coworkers. Documents have their own templates and rules;
lane briefs are contracts between agents and are exempt. This file governs messages.

The failure it exists against: output sized by what the agent did instead of what the
reader needs — fluent, structured, long, and useless to the person reading it.

## Size it by the reader, not by the work

Before writing, answer: what does this person need to know or decide? Write that, cut
the rest. Background they already have, mechanics that don't change the decision, and
their own proposal restated back to them all go.

A reply to a coworker's question is a few sentences: the answer, the tradeoff they're
deciding, the ask. Not a section-per-topic briefing.

Bad (a real draft):

> **Stores:** you're right — done. The producer only scans history to figure out each
> store's first sale date, so it can say "sales are down partly because 3 stores are
> still ramping." The registry's opened date answers that directly, and reading the
> registry is the exact surface you kept on atlas-api…
> *[two more bold sections and a bolded **Question:**]*

Good (what was actually sent):

> Storyteller explains some sales moves with lines like "3 stores are still ramping," so
> it needs store age — you were right, no engine work needed. Item age covers one edge
> case: is an item with zero sales last period genuinely new, or returning after a gap.
> A call for you: with a fixed lookback (say 12 months), an item gone longer than that
> gets labeled "new" when it comes back. Accept that? If yes, both sections come off the
> blocked list with zero engine work.

Same decision, a third of the words. What got cut: mechanism the reader didn't need to
decide, and restatements of the reader's own suggestion.

## Re-ground every label

Shorthand coined during the work — R1, D4, B5, "the audit", "the ledger question" — is a
pointer into a document, not vocabulary the reader shares. The reader arrives cold: days
away, other work in between, none of it loaded.

Expand each label on first use in every message: "R1 (the ruling that producers may not
read raw sales data)". Bare after that, within the same message. The same goes for
earlier decisions — never "as we decided in Q3"; say what was decided, in a clause.

If expanding every label makes the message unwieldy, the message covers too much. Split
it or cut it. Labels belong in the docs, where they're anchored. Messages stand alone.

## Stay above the code

The reader works at structure and behavior. Report what part of the system does what —
"the producer that explains store ramp-up", not `compute_store_maturity()` — and what
changed about the behavior, not which functions were touched.

Drop to code only when the point needs it, and then ground it completely: which area,
what that code does, why it matters to this message. "composition.py still builds both
clients" assumes the reader knows what composition.py is, what the clients are, and why
building both is a problem — say all three or stay above it.

`file:line` on specific claims stays mandatory — that's evidence, not explanation. The
sentence around it must work for someone who never opens the file.

## No unexplained jargon

If the repo has its own name for a thing, use it and define it in a few words on first
use. Don't import vocabulary from outside the codebase, and don't reach for abstract
metaphor nouns — substrate, surface, primitive, north star, flywheel — when a concrete
word exists.

## AI tells

Scan and rewrite before sending. Then self-audit: what here reads machine-written, and
what can the reader not act on?

Shape:

- A bold label and colon restating the line ("**Performance:** performance improved…").
  Convert to prose. A bold lead-in ending in a period, followed by genuinely new detail,
  is fine.
- Bolding every noun. Title case headings. Decorative emojis.
- Forced threes and intro-body-conclusion scaffolding. Use the natural number and shape.

Words:

- Filler that announces instead of saying: "it's important to note", "the key insight
  is", "in order to". If deleting it changes nothing, delete it.
- AI vocabulary: delve, crucial, robust, comprehensive, leverage, utilize, streamline,
  landscape, interplay, pivotal, showcase, testament, underscore. Use the plain word.
- Fancy ways to say "is": "serves as", "stands as", "boasts". Say is or has.
- "Not just X, but Y." State the point.
- Hedge stacks: "could potentially possibly" is "may".
- An adverb propping a weak verb: "significantly improves" becomes the measured delta.

Substance:

- Chatbot residue: "I hope this helps", "Let me know if", "Great question". Delete.
- Feelings where mechanisms belong: "gives us confidence" names a feeling; "the suite
  fails if X regresses" names a mechanism. A sentence that could appear unchanged in
  another project's report says nothing about this one — cut it.
- A neutral pro/con list with no position. Recommend, with the one-line why.
- Passive voice hiding the actor: "queries are validated" becomes "the compiler
  validates queries". Passive is fine only when the actor genuinely doesn't matter.

Not imported from the style guides this distills: the em-dash ban. These docs use them;
the tell is the density of the patterns above, not punctuation.
