# Map: escaped keys

Checked against: `672764aeaa4a1170c7cd6d15af0cfb9673ced4e2` (origin/main and this worktree). See [folder script keys and output](../../maps/folder-tool-keys.md) for the source flow and its boundaries. The older [project tools map](../../maps/project-tools.md) has changed covered files since its recorded commit and was not relied on.

```text
keyed MCP call -> buffer child stdout and stderr -> trim capture cuts
  -> replace exact keys -> cut result -> return success stdout or failure stderr
```

The current separator is any byte outside `A-Za-z0-9._~+/=-` (`machine/lib/project-keys.js:9`, `machine/lib/key-redact.js:6`). Thus `%` and `\` are separators even though escaped key spellings use them: trimming before checking can leave an escaped fragment at a capture or forced-close edge (`machine/lib/key-redact.js:7`, `machine/lib/tool-run.js:32`). A matcher working only on the already-trimmed body cannot detect a spelling whose beginning or end was discarded. The 1 MiB and 4 KiB result cuts happen after redaction, so escaped detection must also precede those cuts (`machine/lib/tool-run.js:37`). There is no space in a usable key, although URLSearchParams uses `+` for space; `+` itself is an allowed key character (`machine/lib/project-keys.js:9`).

The old review explored per-character spellings, nested encodings, withholding, mixed text and finding matches at any start; it also found timeout/forced-close and both stderr edges matter (`docs/plans/tool-keys/PLAN.md:43`, `docs/plans/tool-keys/PLAN.md:445`, `docs/plans/tool-keys/PLAN.md:463`, `docs/plans/tool-keys/PLAN.md:480`). Decision 23 split escaped detection out; K4 currently promises only plain-key redaction (`docs/plans/tool-keys/PLAN.md:49`, `docs/plans/tool-keys/PLAN.md:153`). Existing tests deliberately expect `%41` and `\\u0041` spellings to remain visible (`machine/test/key-redact.test.js:14`), and the author guide states the same limitation (`protocol/tools.md:70`).

Targeted checks: `node --test machine/test/key-redact.test.js machine/test/folder-tools-run.test.js` (`docs/plans/tool-keys/PLAN.md:300`); key validation coverage is in `node --test machine/test/project-keys.test.js machine/test/shared-keys.test.js` (`machine/test/project-keys.test.js:124`, `docs/plans/tool-keys/PLAN.md:597`). For changed paths use `node test-support/pick-tests.js --base <commit>`; the repo law requires area checks and a full set for cross-cutting work, while the role rules place the full run before each push (`CONTRIBUTING.md:73`, `AGENTS.md:78`). Review guide prose as rendered; protocol documents have no test suite (`CONTRIBUTING.md:92`).

Not looked at: performance of a proposed matcher, all possible escape grammars, third-party encoders, server-tool output, live sandbox enforcement, or other log and transcript sinks.
