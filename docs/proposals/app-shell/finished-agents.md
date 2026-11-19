# Finished agents on the Agents screen

Nov 18, 2026 · Collin Zhong

An addendum to [agents-screen.md](agents-screen.md). A lead can end up with dozens of
finished agents (Nova on Kimi Code support: 57 agents, 54 finished, mostly plan
reviewers). Laid out side by side, they push the tree far off screen. This is how the tree
handles them while "Hide finished agents" is off.

## Decks

- Finished agents with the **same role and the same parent** stack into one card: role, a
  count (`×40`), a one-line title, and when the last one finished.
- The card is drawn as a deck: two offset outlines behind it.
- A single finished agent stays a normal box.
- Agents that are working or waiting never go into a deck.

## Rounds: reviewers and verifiers

Reviewers and verifiers work in rounds, so their decks also show **one square per round**,
oldest to newest, wrapping onto a second line if needed. Each square is colored by how many
objections (reviewers) or problems found (verifiers) that round had:

| Count | Color |
| --- | --- |
| 5 or more | red `#d9645a` |
| 3–4 | orange `#e0904a` |
| 1–2 | yellow `#d9c45a` |
| none | green `#4ea87b` |

The point is to show whether review is converging: a fade from red to green is settling
down; a row stuck in orange and red is going in circles, and that lead needs a look.

The title says the outcome, e.g. "Plan review · 20 rounds, then approved" or "Checked parts
1–4 · 3 rounds". Give the squares an accessible label such as "20 rounds; objections fell
from 7 to 0".

## Opening a deck

- Clicking a deck opens a popover anchored under it.
- Reviewer and verifier decks list **rounds**, newest first: a colored square, "Round 18", and
  "2 reviewers · 1 objection: usage command differs on Kimi" (the objection text when
  there's one, the count when there are more). Show the latest few, then "Show all 20
  rounds".
- Opening a round lists its agents, which can be selected like any box (the right-hand
  panel then shows that agent).
- Other decks (workers, asides) list their agents newest first.

## Info popout

A `?` button next to "Hide finished agents" opens "How to read this tree": one line on
stacked cards, the color key, and two example rows ("Settling down", "Going in circles").

## Data this needs

| Shown | Needs |
| --- | --- |
| Decks | role and parent, which exist already |
| Squares, rounds list | each reviewer and verifier's **round number**, and the **number of objections or problems** it raised, plus the first one's text |
| "then approved" / "passed" | the outcome of the last round |

## Screen

`design/AgentsFinishedDecks.dc.html`, on the Wheelchair App design canvas in the Agents row.
It's a Design canvas artboard, so it renders on the canvas, not as a plain web page.
