# Project tools: the contract between the tasks

Written by the sub-lead so the machine, hub and page tasks can be built in parallel. It
fills in shapes the Spec (PLAN.md) leaves open; where it and the Spec disagree, the Spec
wins and the task reports it.

## Shared rules (machine only; the viewer never copies them)

- Key name: `^[A-Za-z_][A-Za-z0-9_]*$`.
- Reserved names: the Spec's list (Keys section), plus every key of every adapter's
  `loginEnv('x')`. Exact process/loader names compare case-insensitively.
- An **eligible reference** is an env value exactly `${NAME}` (stdio entry) or `${NAME}`
  anywhere in a header value (http entry). A **held-back name** is any name referenced as
  `${NAME}` or `${NAME:-...}` in a command, an arg or a URL.
- A **key** is an eligible reference to a valid, non-reserved name.

## Machine HTTP routes (machine secret, like the other `/v1` routes)

All three are `POST` with a JSON body and answer JSON. `path` is the picked project path.

### `POST /v1/project-tools/read` — body `{ "path": "..." }`

`200`:

```json
{
  "mode": "tools | keys-only | unreachable",
  "notice": "null, or the keys-only / Couldn't reach GitHub sentence from the Spec",
  "repo": "owner/name or null",
  "default_branch": "main or null",
  "token": {
    "project": "<realpath of git common dir>",
    "baseline": null,
    "key_revision": 0
  },
  "source": {
    "state": "missing | ok | unreadable",
    "reason": "null, or why it is unreadable",
    "document": "the parsed .mcp.json object, or null when missing/unreadable"
  },
  "checks": {
    "<tool name>": { "skip": ["reason", "..."], "key_warnings": ["needs X, not set on this machine", "X is held back: also used in args"] }
  },
  "file_warnings": ["project tools skipped on Codex: .mcp.json is too large to pass on the command line"],
  "keys": ["STORED_NAME", "..."],
  "references": { "NAME": ["tool", "..."] },
  "reserved": { "exact": ["PATH", "..."], "prefixes": ["LD_", "..."] },
  "waiting": [{ "number": 12, "url": "https://github.com/...", "title": "...", "branch": "wc-tools/abc123def456" }],
  "waiting_error": "null, or the reason gh couldn't list them"
}
```

- `token.baseline` is `{ "repo", "source_state", "branch", "mode", "oid" }` in `tools` mode
  (`mode`/`oid` are `null` when `.mcp.json` is absent), and `null` in `keys-only` and
  `unreachable` modes. In those modes `source` is `null`, `checks` is `{}`,
  `file_warnings`/`waiting` are `[]` and `references` is `{}`.
- `references` lists every key (eligible, valid, non-reserved name) the source references,
  with the tools using it, including held-back ones.
- `keys` is always the full list of stored key names (never values).
- A path that is not a git checkout answers `400 { "outcome": "refused", "reason": "..." }`.

### `POST /v1/project-tools/save` — body `{ "path", "token", "tools", "keys", "start_over" }`

- `tools`: the whole new `mcpServers` object, or `null`. `keys`: `{ "NAME": "value" }`
  (may be `{}`). `start_over`: optional boolean.
- Replies, exactly the Spec's list:
  - `200 { "outcome": "saved", "key_revision", "keys", "warnings": [] }`
  - `200 { "outcome": "opened", "key_revision", "keys", "pr_url", "warnings": [] }`
  - `200 { "outcome": "pr_failed", "key_revision", "keys", "branch", "compare_url", "error" }`
  - `502 { "outcome": "failed", "key_revision", "keys", "error" }`
  - `409 { "outcome": "refused", "reason": "changed since you opened it" }`
  - `400 { "outcome": "refused", "reason": "..." }` (nothing to save, bad key name,
    reserved name, whole-file check failed, conflict created by this Save, unreadable
    source without `start_over`, `start_over` not allowed)
- `warnings`: per-entry skip reasons and the Codex size result for the candidate, as
  sentences naming the tool.
- `compare_url`: `https://github.com/<owner/name>/compare/<default branch>...<branch>?expand=1`.

### `POST /v1/project-tools/remove-key` — body `{ "path", "token", "name" }`

- `200 { "outcome": "removed", "key_revision", "keys" }`
- `409 { "outcome": "refused", "reason": "changed since you opened it" }`
- `400 { "outcome": "refused", "reason": "..." }` (bad name, not stored)
- `502 { "outcome": "failed", "key_revision", "keys", "error" }` (key-store write failed)

## Hub routes (browser; cookie or token auth; writes need a matching Origin)

| Browser route | Forwards to | Body adds |
|---|---|---|
| `POST /wheelchair/api/project-tools/read` | `/v1/project-tools/read` | `machine` |
| `POST /wheelchair/api/project-tools/save` | `/v1/project-tools/save` | `machine` |
| `POST /wheelchair/api/project-tools/remove-key` | `/v1/project-tools/remove-key` | `machine` |

The hub strips `machine`, calls that machine with a 120-second timeout, and passes the
machine's status and JSON body through unchanged whenever the machine answered JSON. If
the machine can't be reached, times out or answers without JSON, the hub answers
`504 { "error": "..." }` (no `outcome`), which the page treats as a lost reply. The hub
never stores or logs the body.

The page gets its machine and project choices from the existing New thread route
(`GET /wheelchair/api/new-thread?machine=<name>`, `viewer/app/routes.js:125-152`): saved,
found and previous paths.
