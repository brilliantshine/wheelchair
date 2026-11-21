# Map: machine usage and Kimi accounts

Checked against: `dbdc97c540f8c9226a3d0762bdd6fe9b548b9ecf` (origin/main)
Files covered: `machine/service.js`, `machine/adapters/claude.js`, `machine/adapters/codex.js`, `machine/adapters/kimi.js`, `machine/adapters/common.js`, `machine/lib/usage-probe.js`, `machine/lib/limits.js`, `docs/plans/kimi-code/PLAN.md`

```text
live CLI event -> adapter parser -> account reading -> hub event
idle probe request -> account validation -> adapter probe -> account reading -> hub
machine status -> default and registered account homes -> Kimi config and credential-file check
```

Claude translates rate-limit hooks to `usage-source`, and its parser produces five-hour and week windows; Codex reads complete transcript lines on turn end and parses rate-limit windows (`machine/adapters/claude.js:95-103`, `machine/adapters/codex.js:105-121`, `machine/adapters/codex.js:141`). The machine attaches the session account, persists its last reading and forwards the event; turn-end readings marked reached acquire `limited_until`, and limit-hit uses the last reading (`machine/service.js:1351-1385`). `limitedUntil` chooses the earliest future reset among windows at least 95% used, or among all future windows, or one hour from now (`machine/lib/limits.js:2-7`).

Hub-authorized POST `/v1/usage` accepts only `claude` or `codex`, validates account and default/non-default directory, calls `usageProbe`, attaches account and time, and returns a reading or 502 (`machine/service.js:1907-1921`). Claude runs its `/usage` command and parses its text; Codex runs app-server and requests rate limits. Their probe runner spawns the CLI, parses output and enforces a timeout (`machine/adapters/claude.js:32-43`, `machine/adapters/claude.js:51-54`, `machine/adapters/codex.js:9-20`, `machine/adapters/codex.js:95-101`, `machine/lib/usage-probe.js:4-37`). Kimi's adapter has `usageFrom()` returning null and no `usageProbe` (`machine/adapters/kimi.js:120-146`).

Status checks every default adapter home and scans `~/.wheelchair/accounts` for directories with matching registered `wheelchair-account.json` IDs and known CLIs, then calls each adapter's login status (`machine/service.js:1527-1538`). Non-default account paths must exactly match `~/.wheelchair/accounts/<id>` (`machine/service.js:62-69`); Kimi resolves the supplied directory or `KIMI_CODE_HOME`/`~/.kimi-code`, and sets that home for sessions (`machine/adapters/kimi.js:7`, `machine/adapters/kimi.js:120-124`, `machine/adapters/common.js:17`). Its config reader extracts the managed provider's OAuth key and host, rejects unreadable or multiline-string config, and its login check tests the corresponding credential file's existence without reading its contents. Only `auth.kimi.ai` is accepted as global; another host with credentials reports China region (`machine/adapters/kimi.js:13-17`, `machine/adapters/kimi.js:36-59`). Decision 23 superseded decision 14's CLI-based check; decision 9 excluded Kimi polling (`docs/plans/kimi-code/PLAN.md:46`, `docs/plans/kimi-code/PLAN.md:51`, `docs/plans/kimi-code/PLAN.md:60`).

Not looked at: all hook transports, CLI internals beyond the separately noted lock observation in the feature map, and individual tests.
