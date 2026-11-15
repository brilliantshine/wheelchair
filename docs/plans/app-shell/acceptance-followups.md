# Follow-ups found during the acceptance run

Raised on 2026-11-14 while running the acceptance checks on hearth against the throwaway
repo `wc-sandbox`. None of these blocks the run. Bugs that did block it were fixed in place
and are listed in COMPLETION.md.

## Raised by Collin

- **Markdown in chat.** Bubbles show raw Markdown. `viewer/doc.js` has a DOM-building
  renderer that could be shared.
- **Answer in his own words; side conversations.** See
  `docs/proposals/app-side-conversations/proposal.md`.
- **Archive is at the top of the thread.** On a long thread he scrolls all the way up to
  archive. A compact header that stays under the nav, or Archive on the Threads list.
- **Threads without a title.** The first fix thread shows as "wc-sandbox", its project
  name. A thread should take its title from the first message, or the lead should name it.
- **The idea question should carry the idea.** Confirming IDEA.md means scrolling up to the
  header links. The question card should show or link IDEA.md itself.
- **Plan documents open in the old viewer.** The links go to the pre-app document page.
  They should open inside the app, with its nav and a way back to the thread.

- **A question in plain chat looks like a stall.** The priorities lead asked what "within
  each group" meant in an ordinary reply, then waited 20 minutes. Nothing showed under
  "Needs you" and Collin thought it had stalled. Anything a lead waits on him for should
  be a card.

## Seen while watching

- **Escape doesn't end a turn for the hub.** Interrupting a Claude session fires no Stop
  hook, so the hub keeps holding that session's messages until something else ends a turn.
- **A lead doesn't learn that its pull request merged.** It still described PR #3 as open
  after Collin merged it, and marked the tags stub as depending on it.
- **A checker left running.** The first verifier in the "All done!" stub thread was never
  stopped after its result arrived.
- **Old sessions keep stale environment.** Sessions started before a fix keep the old
  environment (machine address, prompt suggestions) until restarted.
- **"Sessions ended" cards stay in the history**, one per dead lead, marked answered.
- **A dead plan in the viewer's list.** Archiving removes the worktree, but the viewer's
  plan registry still points into it.
- **The fake machine let real bugs through.** Most of the bugs found in this run lived where
  the hub's fakes assumed a behaviour the real CLI, git or systemd didn't have: PATH under
  systemd, `gh -C`, Codex's notify `type`, a 500 being retried, transcripts after archive. A
  smoke suite that runs the real service with a real `claude --version` and a real git repo
  would have caught most of them.
