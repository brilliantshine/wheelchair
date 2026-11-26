---
slug: escaped-keys
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-26
---

# Hide keys printed in escaped form

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first.
**Map:** `MAP.md`. **Parent plan:** `docs/plans/tool-keys/PLAN.md` (K4; Decisions 17, 19, 20, 23; Review Rounds 4-7).

## Open Questions

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Escape forms caught: `\uXXXX` (hex any case), `\xXX`, a backslash before any character (covers `\/` and `\\`), and `%XX` (hex any case). HTML entities (`&#43;`) and other forms are not caught; the guide says so | Collin's limit in the parent (Decision 20): JSON/backslash and percent escapes | defaulted |
| 2 | Layers: each key character may be spelled as itself or by one of those escapes, and each character of that spelling may in turn be escaped, up to three layers deep, mixed in any order | Covers `%252B`, `\\u002B`, `%5Cu002B`; Collin's three-layer limit | defaulted |
| 3 | Matching runs per key, looking for a spelling starting at every position, never by decoding the whole stream first | Whole-stream decoding misses a key after a stray `%` (parent round 7, `progress=100%41CD%2BEFGH`) | defaulted |
| 4 | At a cut edge, trimming also passes over `%` and `\` (not only usable key characters), so no piece of an escaped key survives at a cut | `%` and `\` are separators today, so an escaped fragment can survive a cut (MAP.md) | defaulted |
| 5 | An escaped key is replaced with `[key]` like a plain one; the rest of the output is kept (the parent's withhold-the-stream design is dropped) | Collin: just that part | user |
| 6 | A capture with no `%` or `\` byte takes today's plain-only path; matching must stay fast enough for a 2 MiB capture (time limits in E1) | Escaped spellings always contain one of these; keeps ordinary output as fast as today | defaulted |

## Spec

Builds on the merged K4 of `docs/plans/tool-keys/PLAN.md`. Only keyed script tools change
(`runKeyedScript` in `machine/lib/tool-run.js`); `runKeylessScript`, server tools and key
storage are untouched.

### E1. Escaped spellings (`machine/lib/key-redact.js`)

**Escapes of one character.** For an ASCII character `c` with code `p`, its escapes are:
- `\u` followed by `p` as 4 hex digits (`\u002B`);
- `\x` followed by `p` as 2 hex digits (`\x2B`);
- `\` followed by `c` itself (`\/`, `\\`, `\+`);
- `%` followed by `p` as 2 hex digits (`%2B`).

Hex letters may be upper or lower case, independently per digit. The `u` and `x` are lower
case only.

**Layers.** `spell0(c)` is just `c`. `spellN(c)` (N = 1, 2, 3) is every string made by
picking `c` itself or one of its escapes `e`, then writing each character of that choice as
any string in `spell(N-1)` of that character. So `spellN(c)` contains `spell(N-1)(c)`.
Examples of `spell3('+')`: `+`, `%2B`, `%252B`, `%25252B`, `\u002B`, `\\u002B`,
`%5Cu002B`, `\u005Cu002B`, `%5C%5Cu002B`, `\x25\x32B`.

**A key's spellings.** For a key value `k1 k2 … kL`, a spelling is `s1 s2 … sL` with each
`si` in `spell3(ki)`. The plain value is one of them. Nothing may stand between the `si`.

**Finding and replacing.** `redactCapture` finds every spelling of every one of the tool's
key values that starts at any byte of the trimmed capture, including spellings that overlap
each other, overlap plain keys, or begin inside text that looks like another escape (for
`41CD+EFGH`, `progress=100%41CD%2BEFGH` has the spelling `41CD%2BEFGH`, which must be
found). It must never work by decoding the capture first. Every byte of every spelling found
is marked, and each run of marked bytes becomes one `[key]`, exactly as plain keys do today.
Unmarked bytes are passed through unchanged.

**Speed.** A capture with no `%` and no `\` byte gives exactly today's result by today's
plain search. Otherwise the search may not backtrack without limit. On the test machine
`redactCapture` finishes within 3 seconds for each of: (a) 2 MiB made of repeats of
`%5C%25\\u00%2` with 5 key values of 4096 characters each; (b) 2 MiB of the same text with
20 key values of 64 characters each, where every 1000 bytes hold one 3-layer spelling of one
of the keys (and all of those are replaced).

### E2. Cut edges

K4 step 1 is unchanged except what counts as a separator: a byte that is not a usable key
character (`A-Za-z0-9._~+/=-`) **and** is not `%` or `\`. So trimming a cut edge also passes
over `%` and `\`. A cut start still drops the run and one separator byte; an edge with no
separator still drops the whole capture with `[output cut]`. Because every spelling uses
only usable characters, `%` and `\`, no piece of a spelling survives at a cut.

### E3. Order in `tool-run.js`

Unchanged: trim cut edges, then E1 on the whole capture, then the 1 MiB result cut and the
4 KiB stderr tail. stdout and stderr are each processed on their own.

### E4. The guide (`protocol/tools.md`)

Replace the sentence about what is caught (`protocol/tools.md:70`) so it says: keys printed
as-is or with common escapes (JSON or backslash escapes such as `\u002B`, `\x2B` or `\/`,
and percent-encoding such as `%2B`), up to three layers, are replaced with `[key]`; base64,
hashing, splitting, web-page codes such as `&#43;` and deeper escaping are not caught. Keep
"Never print or log a key in any form." Drop "(escaped forms not yet)".

### Not doing (this plan)

As IDEA.md, plus: `\U`, `\u{…}`, octal escapes and HTML entities are not escapes here.

### Validation

- `node --test machine/test/key-redact.test.js machine/test/folder-tools-run.test.js`, with
  `machine/test/key-redact.test.js` changed and extended to show, for key `ABCDEFGHIJKL`
  and others:
  - the old expectation that `%41…` and `\u0041…` stay visible now expects `[key]`;
  - each escape form alone; mixed upper/lower hex; `\/` in a key containing `/`;
  - two and three layers, mixed in different orders (examples from E1);
  - the `progress=100%41CD%2BEFGH` case with key `41CD+EFGH`;
  - a spelling glued to other text on both sides keeps that text;
  - overlapping plain and escaped spellings become one `[key]`;
  - four layers (`%2525252B` for `+`) is not caught (pins the limit);
  - output with `%` and `\` but no key is unchanged; keyless runs unchanged;
  - a cut end ending in `… %41%42%` and a cut start beginning mid-spelling leave no part of
    the spelling;
  - the speed cases in E1, run through `redactCapture` with a timer;
  - one end-to-end `runScript` case: a script prints a key with `JSON.stringify` of an
    escaped string and with `encodeURIComponent` of a URL holding the key, and neither
    reaches `text` or `stderr`.
- E4: `grep -n -i "never print or log a key" protocol/tools.md` finds the rule;
  `grep -n "not yet" protocol/tools.md` finds nothing about escaped forms; read the rendered
  guide.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-26

**Lanes:** intent and mechanics; cross-family: pending.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
