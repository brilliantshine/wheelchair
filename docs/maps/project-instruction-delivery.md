# Map: project instruction delivery

Checked against: `74f97719b6fe61f44570daee804f939d7565b96d` (origin/main). Files covered: `machine/service.js`, `machine/lib/aside-turns.js`, `connectors/common.js`, `connectors/{claude,codex,agy,kimi,pi}/machine.js`, `viewer/app/sessions.js`, `protocol/app/{AGENTS,lead,sub-lead,worker,reviewer,verifier,mapper,designer,aside,cards}.md`, `CONTRIBUTING.md`.

```text
hub chooses role and layers -> machine composes role file -> creates target worktree
  -> provider launches in worktree -> role instructions reach agent -> agent works
  -> verifier checks build -> verdict and evidence
```

The hub passes `thread.project`, role, brief and settings-derived layers (`viewer/app/sessions.js:334,368-387`). The machine composes the role, `realism.md` for lead/sub-lead/reviewer/verifier, card rules for card-posting roles and layers; an explicit `role_prompt` replaces those normal parts (`machine/service.js:198-211`). It writes a per-session prompt before creating the worktree (`machine/service.js:816-825`); tmux starts in that worktree (`machine/service.js:843-846`). Mapper/designer/reviewer/sub-lead share the thread worktree, worker gets a branch, verifier a detached checkout of the thread branch (`viewer/app/sessions.js:775-780`, `machine/service.js:704-709`). Thus composition or the post-worktree launch path could add a project-file pointer; embedding the actual file must account for when the worktree exists and which checkout is authoritative.

Claude passes the prompt file with `--append-system-prompt-file` (`connectors/claude/machine.js:84-86`); Pi/OpenRouter uses `--append-system-prompt` with the path (`connectors/pi/machine.js:130-141`). Codex, Antigravity and Kimi get a first message directing them to read the composed file (`connectors/codex/machine.js:157-172`, `connectors/agy/machine.js:72-74`, `connectors/kimi/machine.js:308-311`). `protocol/app/AGENTS.md:3` omits OpenRouter's delivery. Aside turns instead point at `aside.md`, run at the supplied cwd, and use provider-specific arguments (`machine/lib/aside-turns.js:97-107,117-122`; `protocol/app/aside.md:3-13`).

The launcher sets cwd to the target worktree, but the inspected composition does not read project AGENTS.md, CLAUDE.md or CONTRIBUTING.md (`machine/service.js:200-211,821-825,843-846`). Account seeding links global Claude CLAUDE.md and Codex/Kimi AGENTS.md, not a project file (`connectors/common.js:9-14`, `connectors/claude/machine.js:116`, `connectors/codex/machine.js:178`, `connectors/kimi/machine.js:296`). Native CLI discovery is therefore outside this code's demonstrated guarantees; verifier steps-only explicitly consults project AGENTS/CLAUDE for safe startup (`protocol/app/verifier.md:64-70`). The checked app role files do not name CONTRIBUTING.md or direct general router reading; the lead and sub-lead scouts require helpers for code questions over a couple of files, with direct reading when no scout is configured (`protocol/app/lead.md:170-177`, `protocol/app/sub-lead.md:84-91`); mapper requires source-grounded maps (`protocol/app/mapper.md:31-39,48-61`).

No prompt-specific size cap appears in composition or its start field validation (`machine/service.js:200-220`); request JSON is buffered (`machine/service.js:242-250`). The Codex 64 KiB limit is for shell-quoted project MCP overrides, not role prompt files (`connectors/codex/machine.js:25-30,97-101`). Actual CLI context and file-reading limits were not checked.

Verifier checks each Spec item or reported problem, validation, intent and non-goals; steps-only substitutes a narrower remit (`protocol/app/verifier.md:33-50,59-70`). It reports `COMMIT`, `VERDICT` and evidence-backed `GAP` lines, or `BLOCKED`; steps-only uses STEP lines (`protocol/app/verifier.md:96-102,104-136`). Sub-lead merges and judges GAPs (`protocol/app/sub-lead.md:243-261`). Reviewer checks plan mechanics and intent, not the built work, and emits severity/lens/evidence lines (`protocol/app/reviewer.md:20-39,73-85`).

Not checked: CLI source or live native instruction discovery, provider context limits, all other repository instructions, or behavior outside the cited startup and verification paths.
