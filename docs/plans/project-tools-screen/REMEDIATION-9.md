# Remediation 9: verification attempt 9 (commit 0bf6b62)

The Claude verifier passed. The GPT verifier failed with 1 gap.

The lead ruled on it under Decision Log 52:
- Gap 1 is fixed under rule (b): silent corruption that a normal Save pushes to git.
- Five hardening candidates were deferred as Deferred rows 9-13.

## Gap (verbatim)

1. Reading and Saving (Decision Log 50) — The hub decodes each HTTP chunk separately, corrupting UTF-8 characters split across chunks. In an isolated end-to-end test, I changed only a tool's command. Save returned `opened`, and the pushed `.mcp.json` contained `GREETING: "Ol��"` where the source had `GREETING: "Olá"`. — `viewer/app/machine-client.js:33`

## Task

| Task | Gap | Lane |
|---|---|---|
| R9-1 | 1 | light, `--provider gpt` (hub; GPT built it) |

# Task R9-1: hub. Decode machine replies as UTF-8 across chunk boundaries

Plan slug: project-tools-screen. Task id: R9-1.

## Change (exactly this)

In `viewer/app/machine-client.js`, in `requestJson`'s response callback (~line 30), add `response.setEncoding('utf8');` as the first statement, before `let output = '';`. With this, Node's string decoder holds back a partial multi-byte character until the rest arrives.

Nothing else in that file changes.

## Test (append one test to `viewer/test/app-project-tools.test.js`)

Name it `machine replies keep multi-byte characters split across chunks`.

1. Start a local `http.createServer` on port 0. Its handler:
   - takes the bytes `Buffer.from(JSON.stringify({ GREETING: 'Olá' }))`;
   - finds the index of the first byte of `á` (`0xC3`);
   - calls `response.writeHead(200, { 'content-type': 'application/json' })`;
   - writes the bytes up to and including `0xC3`;
   - waits 50 ms;
   - writes the rest and ends.
2. Call `requestJson('http://127.0.0.1:<port>/x', 'POST', {}, {}, 5000, true)` from `require('../app/machine-client')`.
3. Assert `body.GREETING === 'Olá'`.
4. Close the server.

Confirm the test fails without the one-line change and passes with it. Paste both outputs in your report. To show the failure, revert the line locally, run the test, then restore the line. Never commit the reverted state.

## Ownership boundary

- `viewer/app/machine-client.js`: one line
- `viewer/test/app-project-tools.test.js`: append only

## Validation

```
node --test viewer/test/app-project-tools.test.js
node --test viewer/test/*.test.js
```

The second command has a glob that must stay unquoted.
