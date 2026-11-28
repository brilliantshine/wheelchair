# Remediation 1 — server-tool-keys

Verification attempt 1 checked `681c2f8f`. The full run on `d0f06a58` checked the same code.

## Gaps (verbatim)

Verifier gap (judged a rare path, recorded in PLAN.md Accepted Risks, not remediated):

> GAP: S4 Shutdown (post-exit deadline) — Rare path: the 2-second post-exit deadline keeps counting while the server's stderr is paused for backpressure. When it runs out, the launcher destroys the server's stderr and the unread error output is lost. […] `machine/lib/server-relay.js:31` pauses the deadline only on the stdout block (`timerPause()`); `:35` (stderr block) never pauses it; `:22` then calls `child.stderr.destroy()`.

Full-run failure (normal use, remediated):

> `suite machine exit 1` — `not ok 541 - large clean replies and long escape runs stay bounded`
> (`machine/test/server-lines.test.js:65`, `assert.ok(Date.now() - start < 5000)`, test took 7025 ms
> under the full parallel run; the verifier saw 5549 ms under load and 4042 / 2979 ms alone.)

(The full run's `viewer-browser` failure came from a diagram commit of mine, `d0f06a58`, reverted in
`b6a6c770`; it is not a build gap.)

## R1 — make JSON string decoding fast for escape-heavy text

Plan slug `server-tool-keys`, task id `R1`. Lead session `wc-878f834f8279-lead`.

**Objective.** The 16 MiB escape-heavy reply (`'\\n\\"é'.repeat(2796203)` inside a result string)
takes about 1.6 s alone and over 5 s under load, because `string()` in `machine/lib/server-lines.js`
allocates a new Buffer for every escape (`:49` `Buffer.from(String.fromCodePoint(code))`, `:50`
`Buffer.from(SIMPLE_ESCAPES[e])`) and parses `\u` hex through `toString` and a regex (`:43`, `:45`).
Make decoding write bytes straight into `decoded`:

1. Replace `SIMPLE_ESCAPES` with a byte table (e.g. a `Uint8Array(128)` or object mapping the escape
   byte to the decoded byte: `"`→34, `\`→92, `/`→47, `b`→8, `f`→12, `n`→10, `r`→13, `t`→9) and write
   the byte with `decoded[used++] = …` (after ensuring `decoded` is allocated as `append` does today;
   split `append`'s allocation into an `ensure()` helper and call it).
2. Parse the four hex digits with a small function over the bytes (`0-9`, `a-f`, `A-F`; return -1 on
   any other byte) instead of `toString` + regex, for both the first and the low-surrogate `\u`.
3. Encode the code point to UTF-8 by hand into `decoded` (1–4 bytes). A lone surrogate (a high one
   without a valid low one, or a low one alone) is written as `EF BF BD`, which is what
   `Buffer.from(String.fromCodePoint(code))` produces today, so decoded text stays byte-identical.
4. Nothing else in the file changes. `key-spell.js` and `key-redact.js` must not change.

**Ownership boundary.** `machine/lib/server-lines.js`, `machine/test/server-lines.test.js`, report
`docs/plans/server-tool-keys/reports/R1.md`.

**Tests.** Add to `server-lines.test.js`: decoded text for `é`, `😀`, a lone
`\uD83D`, a lone `\uDE00`, every simple escape, and mixed runs equals
`Buffer.from(JSON.parse('"' + raw + '"'))` for valid input, and `EF BF BD` for the lone surrogates
(compare with the old behaviour: `Buffer.from(String.fromCodePoint(0xD83D))`). Keep the existing
5-second assertions as they are.

**Validation (paste output).**

```bash
node --test machine/test/server-lines.test.js
node -e "const {createLineChecker}=require('./machine/lib/server-lines');const c=createLineChecker({name:'d',values:['e3'+'x'.repeat(38),'n6'+'y'.repeat(38)]});const i=Buffer.from('{\"id\":1,\"result\":\"'+'\\\\n\\\\\"é'.repeat(2796203)+'\"}');const s=Date.now();console.log(c.line(i).out===i,Date.now()-s,'ms')"
node --test machine/test/folder-tools-launch.test.js
git diff <base>..HEAD --stat
```

The timing line must print `true` and well under 1000 ms (it was about 1560 ms). Paste the before
and after numbers. If the same gate fails twice, stop and report rather than iterating.

Close the report with: "List each decision you made that this brief did not settle, one line each,
naming the file or piece of the design it affected. Write 'none' if there were none."

## R2 — decode buffer cut short after a leading `\"` (found while accepting R1)

Gap (normal use, key exposure, always fixed): `ensure()` in `machine/lib/server-lines.js:30-38`
(added by T6) scans for the closing quote starting at `p`, which points at the byte *after* the
first backslash. When the first escape in a string is `\"`, the scan stops at that escaped quote, so
`decoded` is too small and `Buffer.copy` silently truncates the rest of the decoded text. Detection
then never sees the rest of the string. Sub-lead probe: `{"result":"a\"bcdefghijk"}` decodes to
`a"bc`; a reply whose text is `"` + 40 × `x` + ` ` + a fully percent-encoded 14-character key is
passed to the client unchanged (`out` is the original line, `note` null).

Plan slug `server-tool-keys`, task id `R2`. Lead session `wc-878f834f8279-lead`.

**Change.** In `ensure()`, start the scan at `start + 1` (the byte after the opening quote) instead
of `p`: `let closing = start + 1;`. Nothing else in `machine/lib/server-lines.js` changes.

**Tests** (add to `machine/test/server-lines.test.js`):
1. For each of `a\"bcdefghijk`, `\"abc`, `\"\"x\\y\n`, `x\"` + 1000 × `y`: the decoded text from
   `readLine`'s `visit` equals `Buffer.from(JSON.parse('"' + raw + '"'))`.
2. With key `Secret12345XYZ`: a line `{"jsonrpc":"2.0","id":1,"result":{"text":"\"` + 40 × `x` + ` `
   + the key percent-encoded byte by byte (`%53%65…`) + `"}}\n` is held back: `out` is the S5 error
   reply for id `1` (`…its reply contained one of its keys and was held back`), and `note` is
   `tool <name>: held back a reply that contained one of its keys`.
Confirm both fail before the change and pass after; say so in the report.

**Ownership boundary.** `machine/lib/server-lines.js`, `machine/test/server-lines.test.js`, report
`docs/plans/server-tool-keys/reports/R2.md`.

**Validation (paste output).**

```bash
node --test machine/test/server-lines.test.js
node --test machine/test/folder-tools-launch.test.js
git diff <base>..HEAD --stat
```

If the same gate fails twice, stop and report rather than iterating. Close the report with: "List
each decision you made that this brief did not settle, one line each, naming the file or piece of
the design it affected. Write 'none' if there were none."
