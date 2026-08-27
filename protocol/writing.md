# Writing for a human

Rules for anything a person reads: turn text in a session, status reports, remediation
summaries, drafted replies to coworkers. Documents have their own templates and rules;
lane briefs are contracts between agents and are exempt. This file governs messages.

The failure it exists against: output sized by what the agent did instead of what the
reader needs — fluent, structured, long, and useless to the person reading it.

## Answer the question, hold the rest

An answer can be correct, relevant, and still unreadable, because everything the reader
will eventually need arrived at once. A two-part question comes back covering eight
things. Every addition passes "does the reader need this?" on its own — they do eventually
need the fragility, the sequencing, the thing worth fixing while you are already in there.
They fail collectively, by burying the two answers that were asked for.

So the test is not whether an item is worth saying. It is whether it was asked for.

- Answer what was asked, completely. Withholding never applies to the answer itself:
  "want me to explain?" in place of an explanation is worse than any verbosity. And this
  governs what gets said, never how much work gets done.
- Everything else gets one line naming it, and the reader pulls it if they want it:
  "there's a fragility in where the state ends up living — want it?" One line, not a
  paragraph with an offer attached.
- Where the held item genuinely does not parse until the answer lands, say that and wait.
  Not "do you understand?" every turn, which is condescending and slow — only where the
  dependency is real.
- When the reader summarizes back in their own words and they are right, say so and add
  only the one correction that changes what they would do. Three corrections after "yes,
  exactly" contradicts the yes, and re-deriving their summary spends the turn on what they
  already had.

This section decides what belongs in the message. The next one decides how much of what is
left to write.

## Size it by the reader, not by the work

Before writing, answer: what does this person need to know or decide? Write that, cut
the rest. Background they already have, mechanics that don't change the decision, and
their own proposal restated back to them all go.

A reply to a coworker's question is a few sentences: the answer, the tradeoff they're
deciding, the ask. Not a section-per-topic briefing.

Bad:

> **Suites:** you're right — done. The report generator only scans run history to work
> out each suite's first green build, so it can say "coverage is down partly because 3
> suites are still stabilizing." The build metadata's added-at date answers that
> directly, and reading build metadata is the exact surface you kept on the collector…
> *[two more bold sections and a bolded **Question:**]*

Good:

> The report explains some coverage moves with lines like "3 suites are still
> stabilizing," so it needs suite age — you were right, no collector work needed. Test
> age covers one edge case: is a suite with zero runs last period genuinely new, or
> dormant and back. A call for you: with a fixed lookback (say 90 days), a suite dormant
> longer than that gets labeled "new" when it returns. Accept that? If yes, both sections
> come off the blocked list with zero collector work.

Same decision, a third of the words. What got cut: mechanism the reader didn't need to
decide, and restatements of the reader's own suggestion.

## Re-ground every label

Shorthand coined during the work — R1, D4, B5, "the audit", "the ledger question" — is a
pointer into a document, not vocabulary the reader shares. The reader arrives cold: days
away, other work in between, none of it loaded.

Expand each label on first use in every message: "R1 (the ruling that a report may not
read raw run history)". Bare after that, within the same message. The same goes for
earlier decisions — never "as we decided in Q3"; say what was decided, in a clause.

If expanding every label makes the message unwieldy, the message covers too much. Split
it or cut it. Labels belong in the docs, where they're anchored. Messages stand alone.

## Stay above the code

The reader works at structure and behavior. Report what part of the system does what —
"the report section that explains suite stabilization", not `compute_suite_maturity()` —
and what changed about the behavior, not which functions were touched.

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

- A bold label opening a section, colon or period either way. A bolded lead reads as
  orderly, which is what makes it dangerous: it makes adding a topic feel free, so a
  two-part question comes back as a five-topic briefing. Bold a phrase inside a sentence
  that would otherwise be missed, never a topic header. Write prose. A message with enough
  separate topics to need headers covers too much — cut it or split it.
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
