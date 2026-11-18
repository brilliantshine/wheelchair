# Map: finished agent decks

Checked against: `207c02f5e0b56cfbcc96046cca10a8df92002a9c` (origin/main). Detail and test entry points: [finished agent tree](../../maps/finished-agent-tree.md), [review records](../../maps/agent-review-records.md).

```text
saved sessions and cards -> Agents API parent tree -> hide/show filter -> boxes -> selected details
                         -> per-session reports
round progress and plan/remediation records -> round-level counts and outcomes
```

The API attaches session nodes by `started_by` and includes finished nodes; the page filters them by default and recursively draws boxes and connectors. Selected finished nodes and their ancestors remain visible; selection is a URL parameter and opens the existing details panel (`viewer/app/agents.js:79-110`; `viewer/pages/agents.js:42-44,105,117-134`). Same role and displayed parent are available for grouping, but a stopped/dead session is also classified finished and may have no result or end time (`viewer/app/agents.js:80-87,106-110`; `viewer/app/sessions.js:373-387,676-679`). Only open asides reach this tree, so a finished-aside deck needs another source (`viewer/app/agents.js:115`).

The session result card associates the complete raw reviewer/verifier report with its session, but no structured pass number or count. Progress cards and PLAN Review Rounds give round-level information without session IDs; remediation files give deduplicated failed-attempt gaps, not a complete successful-attempt or per-verifier record. Attempt IDs identify individual starts and retries, not rounds. A round-to-session association and the proposal's precise per-session counts, first objection and last-round outcome therefore cannot be reliably recovered from the existing structured records alone (`viewer/app/sessions.js:373-397,604-622`; `protocol/templates/PLAN.md:69-88`; `protocol/app/lead.md:277-305`; `protocol/app/sub-lead.md:236-240,264-274`). In particular, progress `found` counts triaged review findings or distinct verifier gaps, not necessarily raw reports (`protocol/app/lead.md:300-305`; `protocol/app/sub-lead.md:264-267`).

The Node tree tests and desktop/phone Playwright cases cover the current hierarchy, toggle, selection, connectors and panel (`viewer/test/app-agents.test.js:35-121`; `viewer/test/app-views.spec.js:258-340`).

## What I did not look at

Historical feature data, transcript retention, and every exceptional review workflow; the linked maps identify further limits.
