# Remediation 1 — lean-sessions

Verification attempt 1 (commit `75c75e4`, verifier on claude-opus-5-5) returned FAIL with one gap.

## Gap list (verbatim)

GAP: Starting instructions carry the rules — briefs (Spec: "`lead.md` (…) and `sub-lead.md` (worker and verifier briefs) say instead: the session's role rules are already in its starting instructions, so a brief never tells it to read its role file") — `sub-lead.md` deletes the role-file pointer from the worker brief list (`protocol/app/sub-lead.md:52`) and from the verifier brief (`:223`). It never adds the replacement sentence. `grep -n "role rules\|starting instructions" protocol/app/sub-lead.md` finds only `:7`, and that line is about `<root>`. `lead.md:80` does carry the sentence, so the lead's briefs are covered.

## Tasks

### R1-1 — say in `sub-lead.md` that briefs never tell a session to read its role file

Brief file: written to the sub-lead's scratch directory as `R1-1.md`; content below.

## Exact edits

1. `protocol/app/sub-lead.md`, the "Every brief carries:" list (~line 52). Change the first
   bullet from
   `- the plan slug and task id, and the lead's` … `worker can message it;`
   so it begins: `- the plan slug and task id (the worker's role rules are already in its
   starting instructions, so a brief never tells it to read its role file), and the lead's`
   — keep the rest of the bullet as is, rewrapped to ~90 columns.
2. `protocol/app/sub-lead.md`, verification step 3 (~line 223): change
   `Its brief gives it the PLAN.md and COMPLETION.md` to
   `Its brief gives it the PLAN.md and COMPLETION.md paths (its role rules are already in its
   starting instructions, so the brief never tells it to read its role file)` and remove the
   now-duplicated word `paths,` at the start of the next line so the sentence reads
   `… role file), and says nothing of this conversation.`
3. `protocol/app/cards.md:3`: replace "The one file every role reads for how to talk to the
   app." with "The card rules every card-posting role gets (lead, sub-lead, worker, mapper;
   the lead also gets `cards-lead.md`)." Change nothing else in that file.
4. `viewer/test/protocol-rules.test.js`: add one test that `sub-lead.md` contains
   `starting instructions, so a brief never tells it to read its role file` and
   `starting instructions, so the brief never tells it to read its role file`.

## Ownership boundary

Only `protocol/app/sub-lead.md`, `protocol/app/cards.md` (line 3 only),
`viewer/test/protocol-rules.test.js`, and `docs/plans/lean-sessions/reports/R1-1.md`.
Never delete files with `rm` outside your own scratch directory.

## Validation

Run `node --test viewer/test/protocol-rules.test.js > <log> 2>&1; echo "exit $?"; tail -n 20 <log>`
(log in a scratch directory) and paste the exit line and tail. Also paste
`grep -n "starting instructions" protocol/app/sub-lead.md`.

If the same gate fails twice, stop and report rather than iterating.

## Deliverable

Commit with exact paths (`wc.js git commit --paths ... --message ...`), report at
`docs/plans/lean-sessions/reports/R1-1.md`, then a `result` card (`task` `R1-1`).

List each decision you made that this brief did not settle, one line each, naming the
file or piece of the design it affected. Write 'none' if there were none.
