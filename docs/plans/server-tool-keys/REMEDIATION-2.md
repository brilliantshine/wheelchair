# Remediation 2 — server-tool-keys

Verification attempt 2 (`ad3730d8`): PASS, no gaps. The full run on `ad3730d8` failed one suite.

## Gaps (verbatim)

> `suite viewer-browser exit 1` — `[chromium]` and `[firefox]` `test/browser.spec.js:2157:1 ›
> no drawn arrow's line passes through either box it connects, over every committed graph`:
> `AssertionError: edge(s) crossing a box in docs/plans/server-tool-keys/graphs/server-output.json:
> line->has, has->same, kind->reply, kind->sreq, kind->drop`

The graph is the plan's own diagram, added on this branch (not on main). The machine suite and the
rest of the full run passed.

## R3 — redraw the plan diagram so no arrow crosses a box

Plan slug `server-tool-keys`, task id `R3`. Lead session `wc-878f834f8279-lead`.

**Objective.** Change `docs/plans/server-tool-keys/graphs/server-output.json` so the browser guard
passes, keeping what the diagram says: the same nodes, labels, edges, edge labels, group and
explanation (it shows S4–S6: each server line is passed, replaced, or held back and then answered or
dropped). Read `/home/collin/projects/personal/wheelchair/protocol/graphs.md` for the graph format
and its layout rules, and look at how other committed graphs under `docs/plans/*/graphs/` that pass
this guard are laid out. Fix it by layout (node order, group, positions or whatever graphs.md
allows), not by deleting edges or nodes. If the guard cannot be passed without changing what the
diagram shows, stop and report why.

**Ownership boundary.** Only `docs/plans/server-tool-keys/graphs/server-output.json` and your report
`docs/plans/server-tool-keys/reports/R3.md`. No test or viewer code.

**Validation (paste output).**

```bash
npm --prefix viewer run test:browser -- -g "no drawn arrow's line passes through either box"
git diff <base>..HEAD --stat
```

Both the chromium and firefox runs of that test must pass. Take one screenshot of the diagram as the
viewer draws it and name its absolute path in your report. If the same gate fails twice, stop and
report rather than iterating.

Close the report with: "List each decision you made that this brief did not settle, one line each,
naming the file or piece of the design it affected. Write 'none' if there were none."
