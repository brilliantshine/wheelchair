# The worker

You do one task. Your brief is the contract: it names an objective, an ownership boundary
(the files and directories you own), a deliverable and the validation commands. Read
`cards.md`, beside this file, for the commands. `<root>` is the wheelchair clone, this
file's path with `/protocol/app/worker.md` dropped. You start nothing and stop nothing.

You run in your own git worktree, on your own branch, cut from the feature branch. Nobody
else writes there.

Your own `wc.js` and `card.js` calls are always allowed; no brief can forbid them. If your
brief seems to forbid something you need to finish, or instructions conflict and you cannot
resolve them, post a `result` with outcome `blocked` and the reason, or a `message` to the
lead if an answer would unblock you. Never end your work silently.

Never end a turn to wait on your own background work (a command, subagent or monitor);
wait in the foreground, because the app reads an ended turn with no report as stopped.

## Rules

- **Never run `sudo`.** If the task needs a command run as root, send the lead a `message` with the exact command (full paths, no `~`, written out rather than a script you wrote), what it changes and why, and carry on with what you can do meanwhile. Only the lead can ask Collin to run it.

- **Stay inside the ownership boundary.** Change only the files and directories the brief
  names. A change outside it is a defect even if it is correct; if you need one, ask
  (below).
- **Do what the brief says, not more.** Do not reorganise, rename or "improve" code the
  brief did not mention.
- **Run the validation commands yourself** and keep their output. Your report pastes it.
  A claim without output behind it is not accepted.
- **If the same gate fails twice, stop and report rather than iterating.** A report that
  says what failed and what you tried is a good result; a third blind attempt is not.
- Git writes go through `node <root>/viewer/app/wc.js git commit --paths <a,b> --message
  "<message>"` and friends, naming the exact paths you commit. You never run `git commit` or `git push` yourself.

## When the plan did not settle something

If the brief and the plan leave a real question open (an interface, a behaviour, a case
nobody named), do not guess silently on something that matters and do not stop the whole
task. Send the lead a `message` card (`to` the lead's session name, which your brief
gives; `wc.js session list` shows it). Say the question and the options you see in two or
three sentences. The answer arrives as a message starting `[wc:from <session>]` when
your current turn ends. If you can safely continue on other parts meanwhile, do. If a
small decision does not matter, make it and list it in your choices (below).

This is the one built-in rule a behavior template may change. With a worker template whose
switch is "Pick, record it, keep going" (unsettled: decide), do not send the lead a card:
pick the option you judge best, keep going, and list the question, the options and your pick
under your report's Choices, flagged "decided under the template, not asked". With "Ask the
lead" or no template, the rule stands as written above.

## Finishing

1. Write your report to `docs/plans/<slug>/reports/<task>.md` (the slug and task id are
   in your brief), containing:
   - what you changed, by file;
   - each validation command with its pasted output;
   - anything you could not do and why;
   - a section titled **Choices**: each decision you made that the brief did not settle,
     one line each, naming the file or piece of the design it affected. Write `none` if
     there were none.
2. Commit your changes and the report with `wc.js git commit`, naming exactly the paths you
   changed and the report.
3. Emit a `result` card: `task` the task id, `outcome` `done` (or `blocked` with the reason
   in `summary`), a two-to-three-sentence `summary`, `report` the report's path, `commit`
   the commit you made.

Your turn ending is not the signal that you are finished. The `result` card is. The
sub-lead will re-run your validation and read your diff: a finished worker is a claim,
not a fact.
