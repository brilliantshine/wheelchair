# Map: OpenRouter hardening

Checked against: `b53f4f24313cc6e46ee58e24b18e02bcc9c5283d` (origin/main). Detailed current-source evidence and test pointers: [OpenRouter hardening and report delivery](../../maps/openrouter-hardening.md).

```text
lead session -> aside fork -> resume -> history
settings -> effort -> Pi launch -> transcript and hook -> report
Pi session files -> account totals -> usage
                 -> session attribution -> Agents screen
```

1. Asides are blocked for OpenRouter at the provider gate; the hub lacks its parent-ID mapping, and the machine accepts only Claude/GPT, their model grammar and output formats (`viewer/app/providers.js:3`; `viewer/app/asides.js:34-46,90-111`; `machine/lib/aside-turns.js:58-71,94-130`). Installed Pi 1.5.2 advertises `--fork`, `--session`, `--session-id`, print and JSON modes, but their combined behavior was not exercised (`/home/collin/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/cli/args.js:299-305,318`).
2. Effort is rejected or dropped at several boundaries, not just the provider flag: model pins, Settings/API, hub session selection, machine start and Pi argv (`codex/model.sh:97-106,440-449`; `viewer/app/routes.js:263-266`; `viewer/app/sessions.js:100-109,349-350`; `machine/service.js:779-780`; `machine/adapters/pi.js:53-59`). Pi advertises off/minimal as well as the app's low through max (`/home/collin/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/cli/args.js:318`; `viewer/app/sessions.js:203-211`).
3. Kimi checks `--version` asynchronously with executable/mtime caching, exposes a problem through machine status and usage account state, and blocks start on that problem (`machine/service.js:768-772,1588-1599,1601-1643`; `viewer/app/usage.js:60-72,126`; `viewer/pages/settings.js:1232`). Pi currently only checks installation and relies on specific screen and hook fields (`machine/service.js:771,1636-1637`; `machine/adapters/pi.js:22-23,62-84`).
4. Usage spend is an offline account-wide scan of OpenRouter assistant cost records, summed across machines with an incomplete flag on failed machine requests (`machine/adapters/pi.js:24-46`; `machine/service.js:1969-1979`; `viewer/app/usage.js:80-92`). Sessions have machine-generated IDs used to find Pi files; the Agents tree is built from thread sessions and currently has no computed spend (`machine/service.js:801-804,869`; `machine/adapters/pi.js:70-72`; `viewer/app/sessions.js:611,817`; `viewer/app/agents.js:62-77,125-142`; `viewer/pages/agents.js:151-195,246`). Thread totals must account for earlier leads excluded from the visible tree (`viewer/app/agents.js:64-68`).
5. A transient machine transcript read failure is swallowed and becomes empty for reports; the turn watermark and delivery ID are saved after the empty report, so replay is deduplicated (`viewer/app/chat.js:301-334`; `viewer/app/sessions.js:428-435,555-569,607-615,640-648`). Pi's copy failure can also be logged before forwarding its event (`machine/service.js:1403-1407`); Pi selects the exact assistant entry ID, whereas other providers have their own selectors (`viewer/app/chat.js:268-271,343-350`). Recovery must distinguish failure from an actually absent or empty transcript without using stale chat text as a report (`viewer/app/chat.js:304-307,330-334`).

Prior decisions explicitly deferred these five items and chose offline Pi costs and hook-based turn completion; accepted risks include duplicate Pi failed events without a turn ID and inherited `PI_CODING_AGENT_DIR` (`docs/plans/openrouter-harness/PLAN.md:41-44,302-324`). Existing older maps were compared to origin/main and their covered files changed; the linked scoped map rechecks the relevant paths rather than treating those older claims as current.

Not checked: live Pi fork/resume and JSON output, model-specific thinking support, large-log performance, every provider's failure modes, or credentials and real spend.
