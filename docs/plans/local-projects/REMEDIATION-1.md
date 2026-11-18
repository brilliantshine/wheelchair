# Remediation 1 — local-projects

Verification attempt 1 on b4b7761: VERDICT FAIL, one gap. Lead's answer: must-fix, not deferrable.

## Gaps (verbatim)

> GAP: Spec "Codex" / Validation "Manual: each calls the tool once" — must-fix — A Codex worker in the default sandboxed mode sees the project tool but can't call it. Its argv has -a never (machine/adapters/codex.js:53), and Codex then refuses every MCP tool call. Evidence: a real Codex 0.169.0 worker started with the adapter's argv. /mcp showed project_verifytool: connected (1 tool), but the call failed with Failed project_verifytool.secret_word └ Error: MCP tool call requires approval, but approval policy is never. The server's call log stayed empty for that session. sandboxed is the default (machine/service.js:151, viewer/app/settings.js:37), so every new Codex thread is affected. That breaks IDEA.md's "Any new thread … on Claude Code or Codex, has agents that can see and call that tool". I tried a fix: adding -c mcp_servers.project_<name>.default_tools_approval_mode="approve" to the same argv. With that, the call succeeded (• Called project_verifytool.secret_word └ the secret word is marmalade-42) and the server logged CALLED secret_word env=passed-through lit=literal-ok. The unit tests can't catch this. project-mcp-codex.test.js:23 should also assert the new key.

## Tasks

### T3

## Objective (exact change; invent nothing)

1. In `machine/adapters/codex.js` `command`, right before the existing line
   `add('enabled', 'true');` (around line 82), add:
   `add('default_tools_approval_mode', '"approve"');`
   This applies to both stdio and http servers, so each server's overrides end with
   `....default_tools_approval_mode="approve"` and then `....enabled=true`.
2. In `machine/test/project-mcp-codex.test.js`, in every expected override list (test
   'translates stdio and http servers in order', both assertions, and any other test that
   lists a server's full overrides), insert
   `'mcp_servers.project_<name>.default_tools_approval_mode="approve"'` right before that
   server's `'mcp_servers.project_<name>.enabled=true'`.
3. In `README.md`, section "Project MCP tools", append one sentence to the second
   paragraph: "On Codex, project tools are pre-approved, so agents can call them without an approval prompt."

## Ownership boundary

`machine/adapters/codex.js`, `machine/test/project-mcp-codex.test.js`, `README.md` (that
one sentence), `docs/plans/local-projects/reports/T3.md`. Nothing else.

## Validation (run all, paste output tails in the report)

```bash
node --test machine/test/project-mcp-codex.test.js
bash machine/test/run.sh
```

If the same gate fails twice, stop and report rather than iterating.

## Rules

- Do not run `rm` or delete files.
- Commit with `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit -m "<msg>" --paths <path>`
  (one `--paths` per file). Your own `wc.js` and `card.js` calls are always allowed.
- Write your report to `docs/plans/local-projects/reports/T3.md`, with pasted command
  output and the files changed, and commit it. Then post a `result` card with `task` `T3`.
- Questions go to the lead (`wc-21cc83a58882-lead`) as a `message` with `asks: true`.
- List each decision you made that this brief did not settle, one line each, naming the
  file or piece of the design it affected. Write 'none' if there were none.
