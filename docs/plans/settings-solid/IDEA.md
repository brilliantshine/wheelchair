---
slug: settings-solid
status: confirmed   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-26
---

# Make the Settings page solid

## What we're building

The clean-up pass after the Settings rework (pull request #193). It fixes the four
things that rework left over: controls that jump or lose focus when part of the page
refreshes, a phone picker that cuts off its text, and phone rows and boxes that came out
taller than the mockups.

## Why — the problem

- With a sign-in card open under AI providers, the usage numbers refresh every 30
  seconds and rebuild the part of the page holding the card. Collin can lose the cursor
  in the code box, or a "Send code" press can miss.
- When the usage bars first load, the Lead order buttons below them shift down, so a
  press can land on the wrong button.
- On a phone, the closed Technical terms picker under You cuts off the end of its
  selected option.
- On a phone, a few titles and hints wrap onto more lines than the mockups planned, and
  the Writing style box and Diagrams choices are about 12px taller. This comes from the
  app's real font. It may be fine; it has not been looked at on a real phone.

## What good looks like

- With a sign-in card open, Collin can type a code and press Send code while the usage
  numbers refresh, and nothing jumps, loses the cursor or drops the press.
- Whatever is under Collin's finger or has the cursor stays where it is when a part of
  the page above it refreshes, including the Lead order buttons when usage loads.
- On a 390px-wide phone, the closed Technical terms picker shows its whole selected
  option.
- The phone rows and boxes are either matched to the mockups or Collin has looked and
  said they are fine as they are.

## Not doing

- No new settings, categories or layout changes beyond these four items.
- No change to what the usage numbers show or how often they refresh.
- Desktop layout stays as it is, except the Threads folder hint if Collin wants it matched.

## Constraints

- The old Settings addresses (#harnesses, #accounts and so on) keep working.
- Follows the project's CONTRIBUTING.md.
