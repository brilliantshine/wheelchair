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
| 7 | Supersedes 4: cut edges keep K4's trim and additionally drop only a stretch that is part of a cut-off spelling | 4 would drop key-free text and whole captures with no other separator | review-round-1 |
| 8 | A capture too costly to check (past a fixed work limit) is withheld whole, never passed unchecked | Pathological escape-heavy output must not hang the bridge or leak; ordinary output stays well under the limit | review-round-1 |

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

**Speed and the work limit.** A capture with no `%` and no `\` byte gives exactly today's
result by today's plain search. Otherwise the search counts its work, and if finding the
spellings in one capture would take more than a fixed limit, it stops and that whole
capture becomes `[output withheld: too much escape-like text to check for keys]` (with
`[output cut]` markers dropped). A capture is never passed on unchecked. The limit is set so
that cases (o) and (c) below finish within it. Pinned fixtures, each through
`redactCapture` with a timer on the test machine (random keys come from a fixed seed, using
only usable key characters):
- (o) ordinary JSON: 2 MiB of repeated `JSON.stringify` lines such as
  `{"msg":"line 1 says \"hi\"\n","path":"a\/b"}`, 5 random 32-character keys, each placed
  once as a two-layer spelling. Under 1 second, not withheld, all 5 replaced, everything else
  unchanged.
- (a) noise: 2 MiB of repeats of `%5C%25\\u00%2`, 5 random 4096-character keys. Under
  3 seconds; the result is unchanged or withheld.
- (b) late failures: 2 MiB of repeats of `%41`, 5 keys of 4095 `A`s followed by `1`, `2`,
  `3`, `4`, `5`. Under 3 seconds; the result is unchanged or withheld.
- (c) many keys: 2 MiB of the noise in (a) with 20 random 64-character keys, every 1000 bytes
  holding one three-layer spelling of one of them. Under 3 seconds, not withheld, all
  spellings replaced.

### E2. Cut edges

K4 step 1 (trim each cut edge back to the nearest separator) is kept as it is. Then, at each
cut edge, also remove the longest stretch at that edge that is part of a spelling cut off by
the edge:
- **Cut end:** the longest stretch ending at the trimmed end that is the beginning (not the
  whole) of a spelling of any of the tool's keys.
- **Cut start:** the longest stretch starting at the real start of the captured window that
  is the ending (not the whole) of a spelling of any of the tool's keys; the body starts at
  whichever of this point and K4's trimmed start is later.

Spellings contain only usable key characters, `%` and `\`, so after K4's trim this extra step
only ever removes something when the edge sits next to a `%` or `\`. This is the one place
key-free output can change: text at a cut edge that happens to look like the start or end of
an escaped key is dropped (for example a trailing lone `%`). If nothing is left, the capture
is dropped with `[output cut]` as today. Output of repeated `%41` with an unrelated key keeps
all but its last few bytes.

### E3. Order in `tool-run.js`

Unchanged: trim cut edges, then E1 on the whole capture, then the 1 MiB result cut and the
4 KiB stderr tail. stdout and stderr are each processed on their own.

### E4. The guide (`protocol/tools.md`)

Replace the sentence about what is caught (`protocol/tools.md:70`) so it says: keys printed
as-is or with common escapes (JSON or backslash escapes such as `\u002B`, `\x2B` or `\/`,
and percent-encoding such as `%2B`), up to three layers, are replaced with `[key]`; base64,
hashing, splitting and web-page codes such as `&#43;` are not caught, and deeper escaping
may not be. A backslash right before a key is hidden with it. Keep
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
  - the fixture `%2525252BABCDEFGHIJK` (four layers of `+`) with key `+ABCDEFGHIJK` is
    left unchanged (pins the limit for that case; three layers is the guarantee);
  - `dir\ABCDEFGHIJKL` gives `dir[key]` (the backslash rule swallows it, by design);
  - output with `%` and `\` but no key is unchanged; keyless runs unchanged;
  - `redactCapture` cut edges: with key `ABCDEFGHIJKL`, a cut end `safe text %41%42%` gives
    `safe text [output cut]`; a cut start `42%43DEFGHIJKL rest` gives `[output cut] rest`
    (exact output; nearby text kept); `%41` repeated with an unrelated key keeps all but the
    last few bytes; `progress 100%` at a cut end gives `progress 100[output cut]`;
  - `runScript` exact output: stdout over 2 MiB ending `… done %41%42%43` gives text ending
    `done [output cut]`; a stderr window over 64 KiB whose start lands inside
    `%41%42%43%44%45%46%47%48%49%4A%4B%4C` followed by ` tail` gives `[output cut] tail`;
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

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | IDEA "key-free output as today" vs E2 trimming more at cuts | upheld | E2 rewritten, exception stated (Decision 7) |
| intent | minor | No speed bound for ordinary JSON output | upheld | E1 case (o) |
| intent | minor | Backslash-any rule swallows a backslash before a key | upheld | Kept; test and guide line |
| mechanics | blocking | E2 drops whole key-free captures with no other separator | upheld | E2 rewritten (Decision 7) |
| mechanics | minor | "Deeper escaping not caught" is false at any start | upheld | E4 wording; pinned four-layer fixture |
| mechanics | minor | Speed fixtures unpinned; no late-failure case | upheld | E1 pinned fixtures (a)-(c), work limit (Decision 8) |
| mechanics | minor | Cut-edge tests could pass by dropping everything | upheld | Exact-output tests in Validation |

### Round 2 — 2026-11-26

**Lanes:** intent and mechanics; see start output.

**Changed since Round 1:** E1 speed rewritten (work limit and withholding, pinned fixtures (o), (a)-(c); Decision 8); E2 rewritten (K4 trim kept, plus removal of cut-off spelling pieces; Decision 7); E4 wording (three layers a guarantee, backslash before a key); Validation (pinned four-layer fixture, backslash case, exact cut-edge outputs for `redactCapture` and `runScript`).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
