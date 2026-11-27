# Map: folder server launch

Checked against: `0cfa47421c626c2c34d2f895c4230791cd3856d2` (origin/main). Files covered: `machine/lib/folder-tools.js`, `machine/lib/tool-launch.js`, `machine/lib/mcp-stdio.js`, `machine/service.js`, `viewer/app/tool-cli.js`, `viewer/pages/project-tools.js`, `protocol/tools.md`, `machine/test/folder-tools.test.js`, `machine/test/folder-tools-run.test.js`, `machine/test/folder-tools-launch.test.js`, `viewer/test/wc-tool.test.js`.

```text
tool.json -> discovery and validation -> launcher MCP entry -> harness starts launcher
  -> launcher revalidates -> detached server -> stdin and stdout pipes
                                             -> inherited stderr
```

Discovery records validator failures as invalid rows and problem lines; the server-key refusal is `keys for server tools aren't supported yet` (`machine/lib/folder-tools.js:15`, `machine/lib/folder-tools.js:42`, `machine/lib/folder-tools.js:63`). Tools Settings displays the row reason, session discovery reports it as a problem, and `wc.js tool list` and `check` print it (`viewer/pages/project-tools.js:310`, `machine/service.js:1002`, `viewer/app/tool-cli.js:100`, `viewer/app/tool-cli.js:118`). The guide repeats it (`protocol/tools.md:62`); starting instructions discuss available scripts and keys rather than embedding this refusal (`machine/service.js:1126`, `protocol/tools.md:102`).

A server entry passes only project and tool directories to `tool-launch.js` (`machine/lib/folder-tools.js:79`). The launcher reads and revalidates the current file, resolves the program, spawns it detached with `toolEnv`, pipes stdin and stdout, inherits stderr, and kills its process group on exit, signal or stdin close (`machine/lib/tool-launch.js:7`, `machine/lib/tool-launch.js:19`, `machine/lib/tool-launch.js:24`, `machine/lib/tool-launch.js:27`). There is currently no interception or key loading in that path. The separate `check` handshake directly spawns the server, reads newline-delimited JSON and uses ids 1 and 2 (`viewer/app/tool-cli.js:118`, `machine/lib/mcp-stdio.js:23`).

Existing tests cover the refusal at validation, launcher, session and CLI boundaries, plus launcher process-group cleanup (`machine/test/folder-tools.test.js:82`, `machine/test/folder-tools-run.test.js:33`, `machine/test/folder-tools-run.test.js:160`, `machine/test/folder-tools-launch.test.js:579`, `viewer/test/wc-tool.test.js:95`). Run `node --test machine/test/folder-tools.test.js machine/test/folder-tools-run.test.js machine/test/folder-tools-launch.test.js machine/test/project-keys.test.js machine/test/shared-keys.test.js machine/test/key-redact.test.js viewer/test/wc-tool.test.js`; use `node test-support/pick-tests.js --base <commit>` for changed coverage and `bash test-support/full-run.sh <log-dir>` before a push (`CONTRIBUTING.md:53`).

Not looked at: actual harness vendor processes, arbitrary server implementations, network or other output sinks.
