# Map: Google model levels

Checked against `2c18acc4395e598567438702fb79ae3afa156bbd` (origin/main and worktree HEAD). Detailed flow, file coverage, tests and unchecked items: [Google model discovery and dispatch](../../maps/google-model-levels.md).

```text
agy models -> one-hour cache -> listed IDs and pinned IDs -> Settings
Settings pins -> model plus effort -> worker resolution -> agy --model and --effort
                              -> scout instructions
```

Today the cache holds each discovered ID separately (`codex/model.sh:277`, `codex/model.sh:290`), and Settings adds exact pinned IDs back to the options (`viewer/app/settings.js:440`). Shipped pins already include level suffixes but no separate effort (`connectors/agy/manifest.js:73`). Worker effort overrides the pin's effort without changing the model passed to agy (`viewer/app/sessions.js:390`, `connectors/agy/machine.js:74`). Scout instructions independently use the raw pinned model (`viewer/app/sessions.js:119`, `viewer/app/settings.js:239`). A base-model scheme must account for these paths, existing pins, CLI default, non-level models, and the accepted `max` effort; the live CLI's handling and available IDs were not checked.

Escalation is prescribed in generated role instructions and uses fresh worker starts; the hub enforces explicit worker effort and tier ceilings (`viewer/app/settings.js:154`, `protocol/app/sub-lead.md:202`, `viewer/app/sessions.js:228`, `viewer/app/sessions.js:310`). Gemini asides are disabled, while generic aside and heavy-model resolution still read pins separately (`connectors/agy/manifest.js:19`, `viewer/app/asides.js:18`). See the detailed map for onboarding, usage, ready checks and targeted validation.

## Not checked

Live agy behavior, actual cache or user pins, and model availability; see the detailed map's unchecked list.
