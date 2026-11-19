# Map: agent provider flow

Checked against: `f3d3409471d4949874004f629b4c989cd15de0e4` (origin/main)
Files covered: `machine/adapters/`, `machine/service.js`, `machine/hook.sh`, `machine/lib/hook-post.js`, `machine/lib/aside-turns.js`, `machine/test/accounts.test.js`, `machine/test/fixtures/login/`, `viewer/app/providers.js`, `viewer/app/sessions.js`, `viewer/app/balancer.js`, `viewer/app/settings.js`, `viewer/app/ready.js`, `viewer/app/routes.js`, `viewer/app/chat.js`, `viewer/app/asides.js`, `viewer/app/usage.js`, `viewer/pages/settings.js`, `codex/model.sh`, `codex/preflight.sh`, `protocol/app/lead.md`, `protocol/app/sub-lead.md`, `protocol/app/reviewer.md`.

> Local-project paths rechecked against `4cfa20cd5aafa0418afabb829c9a4c73430a435f` in [local-project-runtime](local-project-runtime.md); other contents retain the historical checked-against commit above.

```text
Settings and account -> placement and model pin -> machine adapter -> tmux CLI
  -> initial prompt -> hook -> transcript copy -> chat and report
```

The hub maps `gemini` to `agy` with effort and first-message delivery, one account per machine and no aside fork (`viewer/app/providers.js:3`). Placement uses role, review policy, signed-in accounts and model slots (`viewer/app/balancer.js:27-62`); the session reads the model and optional effort and runs preflight only when the provider requests it (`viewer/app/sessions.js:106-108,242-244`).

The machine selects the adapter, prepares the account, writes a composed role prompt and worktree, then launches its command in tmux with the session token and pending first message (`machine/service.js:580-615`). Antigravity writes its Stop hook, trusted workspace settings and `agy` arguments, points its first message at the role file, and recognizes the ready pane (`machine/adapters/agy.js:10-35`). The shell hook reads stdin and gets the session name from its environment (`machine/hook.sh:26-36`). The adapter binds conversation and transcript only when the first Stop matches the role marker; errors become limit or failed events (`machine/adapters/agy.js:39-51`). The machine copies the source transcript (`machine/service.js:876-885,920-922`); chat parses Antigravity rows and selects last assistant text for reports (`viewer/app/chat.js:175-203,228-235`).

Sign-in starts the adapter in a tmux login, answers recognized onboarding steps, parses its URL and checks login status (`machine/service.js:1101-1144`; `machine/adapters/agy.js:54-65`). Ready checks service version and the thread's own CLI and an unpaused signed-in account (`viewer/app/ready.js:29-58`). Antigravity has no usage reading (`machine/adapters/agy.js:53`) and no headless aside fork (`viewer/app/providers.js:3`; `machine/lib/aside-turns.js:61`).

## What I did not look at

Live CLI behavior, credentials, real tmux screens, all error recovery paths, and providers outside the covered files.
