# Explaining how the existing code works

Planning decisions are only as good as the user's picture of the current system. Before
asking someone to choose, show them what they're choosing about.

Output goes in `docs/plans/<slug>/MAP.md` and gets extended as planning uncovers more.

## Flow first, parts later

Start with **what happens, in order, end to end**. Things happening, not things existing.

Good: "A request comes in on `/ingest`. It gets checked for a valid API key. If that
passes, it goes on a queue. A worker picks it up and writes to the database."

Bad: "The ingest service owns the request lifecycle and is composed of a validator, a
queue adapter, and a persistence layer."

The second one tells you nothing you can act on. Nobody can make a decision from it.

Only go into structure — what owns what, how a module is laid out — when a specific
question needs it, and only for the part that question touches.

## The diagram

Plain text, read top to bottom, in the same order as the flow. It gets read in a
terminal, so no mermaid — this is the one document that stays plain-text on purpose.
Everywhere else, `diagrams.md` governs.

```
request → check API key → queue → worker → database
              ↓ fail
          400 back to caller
```

Boxes and arrows only. If it needs a legend, it's too complicated — split it.

## Rules

- **Ground every specific claim.** Name the file and line. A claim with no pointer is a
  guess, and the user can't tell your guesses from what you read.
- **Never state what you didn't check.** Say "I didn't look at how retries work" instead
  of inferring it. A short honest map beats a complete-looking invented one.
- **Say when something is wrong.** If the code is broken, confusing, contradicts its own
  docs, or the user's idea won't work against it, say so plainly and show the evidence.
  Do not soften it and do not work around it silently.
- **Follow the prose rules.** Jargon, filler, AI tells, and everything else about how the
  words themselves read:
  `writing.md`, beside this file.

## Length

First pass: short. The end-to-end flow, the diagram, and the two or three things that
matter for this change. Assume the reader holds only the main points.

Detail arrives later, per question, when it's needed to decide something.

## Scale it down

For a change touching one obvious spot, the map is three lines in the conversation, not a
document. Don't produce ceremony for a small patch.
