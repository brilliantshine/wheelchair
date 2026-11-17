# Agents screen

Nov 17, 2026 · Collin Zhong

A second addendum to [proposal.md](proposal.md), after [settings-and-asides.md](settings-and-asides.md),
settled while redesigning the Agents screen on 2026-11-17. Where it disagrees with either,
this file is newer and wins.

## What's wrong with the screen today

- Agents are shown as a nested list, so it's hard to see who started whom.
- Names are raw session names, and nothing says what an agent is actually working on.
- Each session shows a tmux command to attach, which the Open terminal button already does.
- The terminal opens as a separate page, so you lose the tree to look at one agent.
- During long stretches where an agent is just working, there is no sign of what it's doing.

## Layout

- **Leads in a left sidebar.** Each lead shows its name, a **project tag** (wheelchair,
  beat-edit, tetris-ai…), the feature it's on, and its stage and agent count ("Building ·
  6 agents"). Finished leads fold into "Finished today" at the bottom, also with tags.
- **Clicking a lead shows its agents as a real tree**: lead at the top, then mapper,
  sub-lead and asides, then the sub-lead's workers and checker. The heading repeats the
  lead's name, feature and project tag, with a one-line count ("6 agents · 2 working · 2
  waiting on another agent · 1 not started · 1 finished").
- Each box says, in words, what that agent is doing ("Notice when a session dies",
  "Running the browser tests"), not its session name. Titles come from the agent's brief;
  finished boxes use its result summary.
- Finished and not-started agents have dashed borders.
- No tmux commands anywhere on this screen.

## Questions go up the tree

- **Only a lead can show "Needs you."** A worker or sub-lead with a question asks the agent
  above it. That agent answers if it can and passes the question up only if it can't.
- While waiting, an agent shows a hollow dot and "Waiting on the sub-lead" (or whoever).
- When a question has gone all the way up to Collin, the path it took is drawn in amber
  from the agent that asked to the lead, so it's clear where it started.

## The selected agent

Clicking a box opens a panel on the right:

- Role, title, model, node, and how long it's been working.
- **A one-line answer to "is this normal?"**, e.g. "Quiet for 2m 14s. That's expected.
  It's running the attach tests, which took about 3 minutes the last two times." If the
  agent is waiting on someone, this box shows where its question went instead, with a
  link to it.
- **An activity map**, loosely based on [lot-map](https://github.com/alexeyw/lot-map):
  - The agent in the middle; six spots around it at the same distance: Files, Shell,
    Thinking, Helpers, Web, and the agent that started it.
  - Lines get thicker the more a spot is used, with a count under busy spots.
  - A dotted line traces its last few moves.
  - **What it's doing now:** short dashes drift slowly along the line to that spot, with
    the elapsed time under it ("now · 2:14"). Chosen over a dot travelling along the line,
    a breathing spot, a filling ring, and no motion (see `AgentsNowOptions` on the canvas).
  - A ring around the middle shows how full the agent's context is; amber at 70%, red at 90%.
  - Respect reduced motion: no drifting dashes when the OS asks for less motion.
- **Latest:** the last four steps with a time and ✓ done, ✕ failed, or ● running.
- Buttons: Open terminal, Read its brief.

## Terminal inside the screen

- Open terminal opens a **panel along the bottom** of the Agents screen, under the tree and
  the side panel, instead of a separate page. Bottom, not the right sidebar, because the
  sidebar is about 380px wide, around 45 characters, and output would wrap badly.
- The panel has a drag handle for height, **Full screen**, **Pop out** (today's separate
  page), and close.
- **A switch for typing, starting at View only.** In view only the page sends nothing at
  all to tmux: scrolling just moves through the history already in the browser. This is to
  stop scrolling from dumping stray characters into sessions, which happens today.
- With typing on, the switch, the panel's edge and the cursor turn amber, and a line says
  keys and pastes go straight to that agent.
- It goes back to view only when the panel closes or another agent is selected.

## Data this needs

| Shown | Comes from | Exists today? |
| --- | --- | --- |
| Tree, roles, who started whom | session records (`started_by`, `role`) | Yes |
| Box titles, Read its brief | the brief given at start, the result summary | Yes |
| Waiting on another agent | `waiting_on` when a turn ends | Yes |
| Project tag | the lead's project | Needs adding to the lead record |
| Question path up the tree | where each question was asked and passed on | No |
| Activity map, Latest, "now · 2:14" | an event per tool call (kind, target, start, end, failed) | No: the turn-end hook only reports once a turn ends. Claude and Codex can both run a hook per tool call. |
| "That's expected" line | how long similar steps took before | No: falls out of the tool-call history |
| Context ring | the session's context use | Check what each CLI reports |

## Screens

On the Wheelchair App design canvas, row "Agents: who's working on what". Sources are in
[`design/`](design/):

- `AgentsTree.dc.html`: leads sidebar and tree, a worker waiting on a question.
- `AgentsActivity.dc.html`: a worker in a long quiet stretch, with the activity map.
- `AgentsNowOptions.dc.html`: the four ways of showing what's happening now (A chosen).
- `AgentsTerminal.dc.html`, `AgentsTerminalTyping.dc.html`: the bottom terminal, view only
  and typing on.
