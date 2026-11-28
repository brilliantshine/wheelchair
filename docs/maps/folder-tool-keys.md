# Map: folder script keys and output

Checked against: `0cfa47421c626c2c34d2f895c4230791cd3856d2` (origin/main). Files covered: `machine/lib/folder-tools.js`, `machine/lib/project-keys.js`, `machine/lib/shared-keys.js`, `machine/lib/shared-keys-page.js`, `machine/lib/tool-bridge.js`, `machine/lib/tool-run.js`, `machine/lib/key-redact.js`, `machine/lib/key-spell.js`, `machine/lib/mcp-stdio.js`, `viewer/app/tool-cli.js`, `machine/test/key-redact.test.js`, `machine/test/folder-tools-run.test.js`, `protocol/tools.md`.

```text
script declaration -> discovery and store choice -> bridge call reads current store
  -> child with keys -> bounded capture -> redact -> MCP result
```

Validation accepts 1–20 unique non-reserved key names, but rejects server keys (`machine/lib/folder-tools.js:15`). Shared tools and the shared project's own tools select the shared store; others use the project store (`machine/lib/folder-tools.js:80`). At each bridge call, the definition and key names must still match, then missing or unusable values refuse the call; usable values enter the child environment and redaction list (`machine/lib/tool-bridge.js:13`, `machine/lib/tool-bridge.js:18`). Values must be 8–4096 ASCII letters, digits or `._~+/=-` (`machine/lib/project-keys.js:9`). Project identity uses the Git common directory, hashed to a machine-local file; shared keys use `shared-keys/keys.json`; both stores write private files (`machine/lib/project-keys.js:49`, `machine/lib/project-keys.js:55`, `machine/lib/project-keys.js:66`, `machine/lib/shared-keys.js:6`, `machine/lib/shared-keys.js:17`).

The keyed runner refuses Node child-process debug logging, captures stdout and stderr, handles timeout, cancellation and forced pipe closure, then redacts before output limits (`machine/lib/tool-run.js:17`, `machine/lib/tool-run.js:26`, `machine/lib/tool-run.js:35`). Redaction marks overlaps and up to three layers of common escapes, including JSON Unicode and escaped slash, and withholds unchecked escape-like runs if its work budget runs out (`machine/lib/key-redact.js:53`, `machine/lib/key-spell.js:470`, `machine/test/key-redact.test.js:42`, `protocol/tools.md:70`). It is a capture helper, not a streaming MCP filter. Kimi and Pi can request keyed script runs from the machine; other local `wc.js tool run` calls run without folder-tool keys (`viewer/app/tool-cli.js:141`, `viewer/app/tool-cli.js:158`).

Not looked at: unrelated discovery, provider internals, server output, other log or transcript sinks.
