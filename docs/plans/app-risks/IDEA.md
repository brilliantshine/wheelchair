---
slug: app-risks
status: draft   # draft | confirmed
created: 2026-11-15
---

# Close the app's remaining risks

## What we're building

Checks that run the app against the real tools it depends on, plus fixes for the known
risks they and the earlier acceptance run point at. Each fix comes with a test that fails
before it.

1. **A smoke suite against the real thing.** On hearth, run the real machine service
   with a real `claude --version`, a real git repo and real tmux, with the real hub talking
   to it. It never touches the live services, the same way the existing suites don't.
2. **Model tiers in a live build.** Start one worker on each tier and check the model the
   CLI actually ran, not just the model the app asked for.
3. **Permission prompt clearing on a live run.** Raise a real permission prompt, answer
   it, and see the app's card clear.
4. **Duplicate cards.** When the hub answers a relayed card with an error and the agent
   sends it again, the card shows up once, not twice.
5. **Slow session starts.** A start whose `git fetch` is slow still succeeds. The 5-second
   limit no longer applies to starts (they now get 60 seconds and one retry), so this
   becomes a test that proves it, with no fix expected.

## Why — the problem

Most bugs in the acceptance run lived where the test fakes assumed behaviour the real
CLI, git or tmux didn't have. Model tiers and permission prompt clearing have never been
seen working live. A duplicate card is a real bug: the hub keeps a card it already
accepted, then accepts the resend as new.

## What good looks like

- One command runs the smoke suite on hearth. It passes, and the live hub and machine
  service carry on untouched.
- A recorded live build shows each tier's worker running the expected model.
- A recorded live run shows a permission prompt appearing and its card clearing.
- Resending a card after a hub error leaves one card in the thread.
- Each fix has a test that failed before it and passes after.

## Not doing

- `projects.json` and the project picker (D4). The picker already lists the git repos in
  the configured projects folder, plus saved folders and earlier threads. Only repos
  outside that folder are missing, and nothing shows that matters.
- Raising the 5-second limit on the other hub-to-service calls (status, message submit).
  They do no slow work.
- The screen fixes, which stay in the paper-cuts thread.

## Constraints

- The smoke suite runs on hearth and never touches the live hub, machine service, their
  ports, state folders or the user's own CLI config.
- It uses a real `claude --version` only, never a real model turn, so it costs nothing.
- The live checks (tiers, permission prompt) are run once and recorded. They are not an
  automated suite.
