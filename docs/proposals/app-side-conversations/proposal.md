# Answering in your own words, and side conversations

Raised by Collin during the app-shell acceptance run (2026-11-14), for after slice 1.

## What he asked for

1. **Answer a card in his own words.** Today a `question` card can only be answered by
   pressing one of its options. He wants a way to type his own answer instead, when none
   of the options fits or he wants to add a condition.
2. **Chat more about something without cluttering the thread.** A clarification about one
   card or one point shouldn't take the whole thread down a side quest. The main thread
   should stay readable as the record of decisions; the back-and-forth that led to one
   lives somewhere attached to it.

## What exists now

- `question` cards: options only (`protocol/app/cards.md`).
- `approval` cards: a "Talk about this" button per objection, which sends
  `[card <id>] talk about: <finding>` into the main thread, so the discussion lands
  in the main chat.

## Open questions for planning

- Where a side conversation lives: folded under its card in the same thread, or a short
  child thread like a stub that reports one line back when closed.
- Who answers it: the same lead (cheap, has context, but its turns interleave with the
  main work) or a separate session given the card and the plan (keeps the lead's context
  clean).
- How the outcome returns: the side conversation should end with one line in the main
  thread ("decided: …") that the lead treats like a card answer.
- Whether "answer in my own words" is just a text box on every card that sends
  `[card <id>] answered: <text>`, or the first message of a side conversation.
