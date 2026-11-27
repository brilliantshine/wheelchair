# Map: install real-home check

Checked against `0b5e05cfaeba93db1884f93737609b861a6a5145` (origin/main). Detailed source inventory: `docs/maps/install-real-home.md`.

```text
real HOME before -> isolated fixture cases -> real HOME comparison -> Darwin and other cases -> result
                      live sessions and Settings can change the same real HOME
```

The inline tree snapshot also protects three fixture refusal cases and two idempotence checks, so any narrower real-home policy must preserve those full-tree comparisons (`install/test/run.sh:27-49,251-272,463-469,680-698`). The final real-home and five harness-file checks precede Darwin, screen and sudo cases (`install/test/run.sh:700-801`). Account seeding, switching and preflight can write account paths while the suite runs; model discovery and CLI installs can create, delete or change wheelchair-owned files outside accounts (`connectors/common.js:9-14`; `machine/service.js:922-935`; `codex/preflight.sh:26-33,103-117`; `codex/model.sh:290-324`; `machine/lib/harness-install.js:39-49,128-133`).

Prior decisions choose wheelchair-owned account paths rather than a version-sensitive AI-tool skip list and split this work from S9 (`docs/plans/load-flaky-tests/PLAN.md:31-37`). Reviews found that a creation/deletion check still fails on live first creation of the agy cache and install PID/result, and that changing the shared helper can weaken fixture checks (`docs/plans/load-flaky-tests/PLAN.md:278,285,290,302-309,328-329`). The removed S9 at `754cf54f2907326474c6b0e2455b96ce30c98a21^:docs/plans/load-flaky-tests/PLAN.md` proposed a separate helper test and path reporting, and recorded live account creation and in-place metadata rewrite as accepted risks; it was removed, not implemented.

No separate tree-state test exists in `install/test/`; `AGENTS.md:78-85` specifies targeted tests and a full run per pushed commit. Not checked: live account contents, tool internals, or every external writer and override; see the detailed map's limits.
