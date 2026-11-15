---
slug: app-shell
status: confirmed
created: 2026-11-14
---

# Wheelchair as an app on a server

Lines marked *(inferred)* are my reading of the proposal rather than its words. Correct any of them.

## What we're building

Wheelchair becomes an app that runs on one of Collin's servers instead of inside whatever terminal he happens to be in. He talks to a lead agent in a chat thread in the browser, from any device on the tailnet, and the lead carries an idea from first description through to a reviewed pull request, asking him only for the decisions that are really his. Every agent runs as a normal interactive session he can open and watch, and the building work can be spread across several of his machines.

## Why: the problem

- Today the workflow only exists inside a terminal session he started, and only lives as long as that session does. When he's away at school, checking in means attaching over SSH or Parsec and reading raw output.
- The agents doing the building run headless, so nobody can open them and read what they're doing while they work.
- He has several servers, but a run only uses the machine it was started on.
- The workflow reports every step (review rounds, per-round summaries, worker progress), and almost none of it helps him decide anything.
- The rules for making agent messages easier to read haven't cut how often he has to ask for clarification.
- The graphs help with some questions, but they get cluttered, and complex answers are still slow to understand.
- There's no easy way to hand an agent a screenshot from another device.

## What good looks like

- From a phone or a laptop on the tailnet, he opens one address and sees three views: features by stage with a "Needs you" strip, chat threads with leads, and every agent session on every machine.
- He describes what he wants in plain words. A small fix just gets done. Anything bigger gets a single "Take it into planning?" offer.
- He hears from the workflow only when it needs a decision from him, or when a feature is approved or done.
- He can open any agent's live terminal in the browser and type into it, or attach to it from a real terminal.
- Restarting or updating the app leaves every running agent alone.
- Complicated answers come back as a picture inside the thread, drawn in a form that suits the question.
- He can paste or drop a screenshot into a thread, and the agent can see it.
- All of it works on a phone.
- *(inferred)* He can step away mid-feature, come back days later on a different device, and see where things stand without asking.
- Once the first slice works, the app is the only way to drive a feature. A terminal is for watching or typing into a session directly.

## Not doing

- Moving a running worker to another machine when its machine goes to sleep. It's a later feature of its own.
- Merging finished work automatically. A feature ends in a pull request that Collin reviews.
- The current communication rules: the writing rules, the SEEN.md record, the wording list, and the gap notice.
- Showing review or verification rounds, step counts, or per-round summaries.
- Slash commands inside the app.
- *(inferred)* Access from outside the tailnet in the first version. The proposal lists this as an open question, but its constraints say "reachable only over Tailscale."
- Keeping the slash-command workflow once the app works.

## Constraints

- Works with `claude` alone or `codex` alone. Having both unlocks cross-family review, as it does today.
- Reachable only over Tailscale, the same as the remote viewer today.
- Usable on a phone.
- Runs on Debian on the hub machine. Node is already required for the viewer.
- Uses each CLI's own login on each machine, with no new accounts.
- *(inferred)* Agent sessions live in tmux on each machine, so they keep running whether or not the app is up.
