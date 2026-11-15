# Retire the slash-command workflow

Nov 14, 2026 · split out of `docs/plans/app-shell/` (decision D44)

## What this is

Once the app (slice 1, `docs/plans/app-shell/`) is verified and done, the app becomes the
only way to drive a feature. This feature removes the old terminal workflow. Start it as a
thread in the app and point the lead at this file.

## What to remove, in one change

- The stage wrappers `skills/{plan,adopt,plan-review,implement,verify}` and
  `codex/prompts/{plan,adopt,plan-review,implement,verify}.md`, and the copies
  `install.sh` rendered into each harness (the installer removes them, the same way it
  already removes the old `spine` wrapper).
- The old stage protocol files
  `protocol/{planning,adopt,plan-review,implementation,verification,lanes,map,writing,seen}.md`,
  after checking that `protocol/app/` already carries anything still needed.
- `seen/`, plus the hook entries and write grants `seen/set.sh` installed.
- The routers' rows for all of the above.

## What to keep

`/graph`, `/diagram-sensitivity`, `sensitivity/`, `protocol/graphs.md`,
`protocol/diagrams.md` and `codex/model.sh`. The dial's rendered text is retargeted from
`protocol/planning.md` to `protocol/app/lead.md` and the diagram card rules (D42 in the
app-shell plan).

## Checks

`./install.sh && ./install.sh` leaves `git status --porcelain` empty. `install/test/run.sh`
gains cases proving the removed wrappers and the `seen/` hook entries are gone from a
harness home that had them.
