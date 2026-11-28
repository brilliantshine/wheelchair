# Map: agent model preferences

Checked against `7254ef051d53ec6d15e03276a38cf43c48e4dcea` (origin/main and worktree HEAD). See [agent model settings and launch flow](../../maps/agent-model-settings.md) for the covered files and evidence.

```text
Models page -> provider tier and lead cells -> model pins
            -> other-agent tiers and escalation -> hub settings
new session -> role chooses slot -> provider and account -> pinned model and effort
```

The page currently separates provider-specific tier cells and lead/sub-lead model cells from Other agents' tier choices and escalation (`viewer/pages/settings.js:618`, `viewer/pages/settings.js:640`, `viewer/pages/settings.js:647`, `viewer/pages/settings.js:662`). Pins and preferences use different endpoints and stores (`viewer/app/routes.js:345`, `viewer/app/routes.js:381`, `codex/model.sh:45`, `viewer/app/settings.js:416`).

Lead and sub-lead slots are direct model choices; reviewer, verifier, mapper and designer select tiers, while scouts resolve a tier on the lead's selected provider into helper instructions (`viewer/app/balancer.js:12`, `viewer/app/sessions.js:368`, `viewer/app/settings.js:239`). Assistant and project lead sessions use the lead slot, with no separate model preference (`viewer/app/assistant.js:32`, `viewer/app/project-lead.js:92`, `viewer/app/balancer.js:12`). Escalation combines sub-lead instructions with enforced worker tier and effort ceilings (`viewer/app/settings.js:237`, `viewer/app/sessions.js:234`, `viewer/app/sessions.js:314`).

The preferences API documentation omits accepted `designer` and `project_leads` fields (`viewer/app/API.md:49`, `viewer/app/routes.js:420`, `viewer/app/routes.js:457`). Existing unit and browser coverage is indexed in the linked map.

Not checked: machine-side CLI argument construction, aside model dispatch, every viewer test, or a running installation.
