# Map: folder script keys and output

Checked against: `672764aeaa4a1170c7cd6d15af0cfb9673ced4e2` (origin/main). Files covered: `machine/lib/folder-tools.js`, `machine/lib/project-keys.js`, `machine/lib/project-tools.js`, `machine/lib/shared-keys-page.js`, `machine/lib/tool-bridge.js`, `machine/lib/tool-run.js`, `machine/lib/key-redact.js`, `machine/lib/mcp-stdio.js`, `viewer/app/tool-cli.js`, `machine/test/key-redact.test.js`, `machine/test/folder-tools-run.test.js`, `protocol/tools.md`.

```text
script declares keys -> bridge checks current definition and key store -> child process
  -> capture stdout and stderr -> trim cut edges -> replace plain keys -> result limits
  -> MCP success stdout or failure stderr -> agent
```

Folder validation accepts 1–20 unique valid, non-reserved key names for scripts and refuses keyed servers (`machine/lib/folder-tools.js:15`). The bridge re-reads the definition and selected store for every call; missing or unusable values refuse the call, while usable values enter the child environment and the redaction list (`machine/lib/tool-bridge.js:13`, `machine/lib/tool-bridge.js:18`). Usable values are 8–4096 ASCII letters, digits or `._~+/=-`; shared-key saves reject invalid values and project-key status marks them unusable (`machine/lib/project-keys.js:9`, `machine/lib/shared-keys-page.js:40`, `machine/lib/project-tools.js:164`).

The keyed runner buffers up to 2 MiB stdout and the last 64 KiB stderr as bytes; it waits for close, including after timeout or forced pipe closure (`machine/lib/tool-run.js:20`, `machine/lib/tool-run.js:26`, `machine/lib/tool-run.js:32`). On actual cut edges, redaction removes the adjacent run of usable key bytes, then marks all overlapping exact byte matches and replaces each marked run with `[key]` (`machine/lib/key-redact.js:4`). Only afterward does the runner take the first 1 MiB stdout and last 4 KiB stderr (`machine/lib/tool-run.js:35`). The bridge returns stdout on success, stderr on failure; MCP serializes the result as JSON (`machine/lib/tool-bridge.js:23`, `machine/lib/mcp-stdio.js:6`).

`wc.js tool run` calls the same runner without the `keys` argument, with its inherited environment; this selects the keyless path and does not redact (`viewer/app/tool-cli.js:116`, `machine/lib/tool-run.js:12`). The guide explicitly says escaped forms are not caught and forbids printing keys (`protocol/tools.md:70`). Tests currently assert escaped examples remain visible and exercise chunk splits, overlapping values, capture cuts, timeout, forced close and keyless output (`machine/test/key-redact.test.js:7`). Bridge tests cover store refresh and key binding (`machine/test/folder-tools-run.test.js:88`).

Not looked at: unrelated discovery and provider integration, server-tool output, live sandboxes, and other log or transcript sinks.
