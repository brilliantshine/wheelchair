# Map: OpenRouter harness

Checked against: `dbb0a6b32851e6923590895ca4dbca97bd613606` (origin/main and worktree HEAD). Detailed current-source map: [provider integration surfaces](../../maps/openrouter-provider-surfaces.md).

```text
provider settings + model pins + login -> placement -> machine adapter and CLI
  -> ready + role prompt -> turn completion + transcript -> chat and agent report
```

The provider identity, CLI identity and model selection are separate: the hub registry maps provider to CLI, the balancer selects an eligible account, and session start resolves a model pin before sending the machine a CLI start (`viewer/app/providers.js:3-6`; `viewer/app/balancer.js:48-81`; `viewer/app/sessions.js:100-111,290-324,349-361`). A new harness therefore needs decisions at both hub and machine boundaries; registering an adapter alone does not cover status, account login, model syntax, page lists or transcript rendering (`machine/service.js:1528-1538`; `viewer/app/routes.js:258-266,315`; `viewer/pages/settings.js:15,571`; `viewer/app/chat.js:265,314`).

Kimi is the closest recent example: its adapter launches and recognizes readiness, but its log binding, turn polling, recovery, status and login have explicit service code; it has no usage reading or project tools support (`machine/adapters/kimi.js:71-111,121-146`; `machine/service.js:400,488-490,867-952,1490-1500,1528-1581`). Its model IDs permit one slash only, a rule duplicated in the hub, settings page and pin script (`viewer/app/routes.js:262`; `viewer/pages/settings.js:213`; `codex/model.sh:47-48,90`). Whether those limits fit the chosen harness remains open.

Kimi's end-to-end addition included installer detection, account and model settings, session lifecycle, chat/report parsing, tests and live checks (`install.sh:43-52,376-379`; `viewer/test/app-kimi-settings.test.js:21-94`; `machine/test/kimi-turns.test.js:41-60`; `viewer/test/app-kimi-hub.test.js:12-48`; `test-support/smoke/kimi-live.js:40-81`). Its most repeated remediation involved permission screens, recovery and reliable log-to-turn delivery, with additional authentication, private-state and report issues (`docs/plans/kimi-code/REMEDIATION-3.md:11-18`; `docs/plans/kimi-code/REMEDIATION-6.md:7-14`; `docs/plans/kimi-code/REMEDIATION-2.md:7-20`; `docs/plans/kimi-code/REMEDIATION-8.md:7-19`).

Not checked: Pi or OpenCode documentation or behavior, live harness execution or credentials, and unrelated provider paths. The older [agent provider flow](../../maps/agent-provider-flow.md) and [provider placement](../../maps/app-provider-placement.md) maps cover files changed since their checked commit; current scoped paths are rechecked in the linked map above rather than relying on their historical claims.
