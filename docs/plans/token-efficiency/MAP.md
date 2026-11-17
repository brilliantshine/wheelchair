# Map: token efficiency

```text
Settings cells -> provider/account placement -> model + role prompt -> CLI session
                                                        -> code-reading delegation
                                                        -> worker result -> sub-lead checks diff
```

The detailed, source-cited flow is in `docs/maps/model-roles-scout.md`, checked against `450c3178442ed679f985589fdc3d9c38aca81010` (origin/main). Both leads and sub-leads currently resolve the same `lead` model slot and the sub-lead stays on the thread's provider (`viewer/app/balancer.js:11-14,49-50`). A separate setting crosses model file schema, resolution, Settings UI and API (`codex/model.sh:15-35,361-385`; `viewer/pages/settings.js:403-408`; `viewer/app/API.md:100-104`).

A scout could be a new app role, requiring changes to role authorization, placement and prompt/lifecycle paths, or a harness subagent. Claude, Codex and Antigravity document subagent model selection, and normal app launch arguments contain no explicit subagent disable; actual availability depends on harness configuration and policy, and was not tested live (`machine/adapters/claude.js:55-60`; `machine/adapters/codex.js:50-51`; `machine/adapters/agy.js:30-34`; see links and limits in the detailed map). A new app role is not currently startable by either lead (`viewer/app/sessions.js:35-47,461-470`).

The current protocol requires a sub-lead to read worker diffs and rerun validation, so accepting summaries alone changes that rule; restart recovery already reconciles PLAN tasks and reports against the tree and live sessions (`protocol/app/sub-lead.md:25-36,129-152`).

Not looked at: actual token savings, live harness behavior or inherited account settings, and every downstream new-role assumption.
