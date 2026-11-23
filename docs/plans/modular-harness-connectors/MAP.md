---
slug: modular-harness-connectors
---

# How this works today

## End to end

```text
settings and model pins -> placement -> machine adapter -> CLI
  -> hook or Kimi poll -> event and transcript copy -> hub report and chat
```

## What happens

1. Provider flags and the provider-to-CLI mapping are declared in `viewer/app/providers.js:3-6`; placement and model pin lookup choose the account and model (`viewer/app/balancer.js:42-118`; `viewer/app/sessions.js:100-119`).
2. Machine selects a statically registered adapter, prepares its account, starts its command, waits for its ready pane and delivers its first message (`machine/adapters/index.js:2-5`; `machine/service.js:803-812,1037-1045`).
3. Claude, Codex, Antigravity and Pi report hooks; Kimi polls its wire log. Machine copies the source transcript and hub chat parses it with a CLI-specific parser (`machine/hook.sh:15-33`; `machine/adapters/pi-extension.js:11-16`; `machine/service.js:1097-1162,1478-1489`; `viewer/app/chat.js:156-267,301-304`).

## What matters for this change

The current adapter comment is incomplete: service also calls optional preparation, login, prompting, turn and probe functions, while switch, polling, status and redaction still branch by name (`machine/adapters/index.js:2-5`; `machine/service.js:812,870,1097-1162,1624,1747,1783-1788,2282-2286`). The detailed current inventory, parser behavior and coverage are in [harness-connector-dispatch](../../maps/harness-connector-dispatch.md).

The hub and browser each have provider-specific policy and duplicated provider lists, and model pins maintain a separate provider list (`viewer/app/providers.js:3`; `viewer/pages/settings.js:15-16`; `codex/model.sh:14-38`). A machine adapter and hub registry entry alone do not add a working connector under the current design.

## Problems found

The existing `machine-usage-kimi` map says Kimi has no usage probe, but the current adapter exports one and the usage endpoint and hub poller include Kimi (`machine/adapters/kimi.js:158-160`; `machine/service.js:2282-2286`; `viewer/app/usage-poll.js:17-26`). All eight named existing maps have changed covered files relative to their recorded commits and cannot be trusted unchanged. Their unrelated covered areas have not been fully rechecked.

## Not checked

Full line-by-line inventory across the entire repository, all assertions and CI configuration, live CLI behavior, and non-connector changes in the earlier maps. See the detailed map's limitations.
