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
| 9 | Supersedes 8: past the budget only escape-like runs become `[not checked for keys]`, not the whole capture; one budget covers all searching | Keeps Collin's Decision 5 (just that part) and bounds the cut-edge search too | review-round-2 |
| 10 | Spellings and cut-off pieces are found on the capture as captured, then combined | Trimming first hid the rest of a key that overlapped a cut-off piece | review-round-2 |
| 11 | Both edges cut and the capture one escape-like run: dropped whole | A spelling can be longer than the stderr window | review-round-2 |

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
key values that starts at any byte of the whole capture as captured (before any cut-edge trimming, E3), including spellings that overlap
each other, overlap plain keys, or begin inside text that looks like another escape (for
`41CD+EFGH`, `progress=100%41CD%2BEFGH` has the spelling `41CD%2BEFGH`, which must be
found). It must never work by decoding the capture first. Every byte of every spelling found
is marked, and each run of marked bytes becomes one `[key]`, exactly as plain keys do today.
Unmarked bytes are passed through unchanged.

**Speed and the work limit.** A capture with no `%` and no `\` byte gives exactly today's
result by today's plain search. Otherwise all searching for one capture (complete spellings
here and cut-off pieces in E2) shares one work budget, counted by the implementation and
fixed so that cases (o), (c) and (d) below finish within it. If the budget runs out, the
search stops and the **fallback** applies to that capture: plain keys are still replaced as
today and K4's cut-edge trim still applies; then every run of bytes made only of usable key
characters, `%` and `\` that contains at least one `%` or `\` becomes
`[not checked for keys]`. Every escaped spelling lies inside one such run, so nothing
unchecked gets through, and the rest of the output is kept. A capture is never passed on
unchecked.

Pinned fixtures, each through `redactCapture` with a timer on the test machine (random
keys come from a fixed seed, using only usable key characters):
- (o) ordinary JSON: 2 MiB of repeated `JSON.stringify` lines such as
  `{"msg":"line 1 says \"hi\"\n","path":"a\/b"}`, 5 random 32-character keys, each placed
  once as a two-layer spelling. Under 1 second, no fallback, all 5 replaced, everything else
  unchanged.
- (a) noise: 2 MiB of repeats of `%5C%25\\u00%2`, 5 random 4096-character keys. Under
  3 seconds; the result is unchanged or the fallback.
- (b) late failures: 2 MiB of repeats of `%41`, 5 keys of 4095 `A`s followed by `1`, `2`,
  `3`, `4`, `5`. Under 3 seconds; the result is unchanged or the fallback.
- (c) many keys: 2 MiB of the noise in (a) with 20 random 64-character keys, every 1000 bytes
  holding one three-layer spelling of one of them. Under 3 seconds, no fallback, all
  spellings replaced.
- (d) cut edges: (c)'s capture with both `cutStart` and `cutEnd` set. Under 3 seconds, no
  fallback.

### E2. Cut edges

At a cut edge, `redactCapture` removes (and shows as `[output cut]`):
- what K4 step 1 removes today (back to the nearest separator), and
- **cut end:** the longest stretch ending at the real end of the capture that is the
  beginning (not the whole) of a spelling of any of the tool's keys;
- **cut start:** the longest stretch starting at the real start that is the ending (not the
  whole) of a spelling of any of the tool's keys;
- **both edges cut** and the capture made only of usable key characters, `%` and `\`: the
  whole capture (it may be the middle of one long spelling, which can exceed the 64 KiB
  stderr window).

Each edge removes the larger of its stretches. Spellings contain only usable key characters,
`%` and `\`, so beyond K4's trim this only ever removes text next to a `%` or `\`. If nothing
is left, the capture is dropped with `[output cut]` as today. Output of repeated `%41` with an
unrelated key keeps all but its last few bytes.

Key-free output changes in only two places: text at a cut edge that looks like the start or
end of an escaped key (for example a trailing lone `%`), and the fallback in E1.

### E3. Order in `redactCapture`

1. Search the capture as captured: complete spellings (E1) and cut-off pieces (E2), within
   one budget.
2. Build the result: removed edges become `[output cut]`; in what remains, each run of bytes
   inside any complete spelling becomes `[key]`. A spelling that overlaps a removed edge
   still marks its remaining part, so with keys `ABCDEFGH` and `EFGHIJKLM`, a cut start
   `42%43DEFGHIJKLM rest` gives `[output cut][key] rest`.
3. Unchanged in `tool-run.js`: then the 1 MiB result cut and the 4 KiB stderr tail. stdout
   and stderr are each processed on their own.

### E4. The guide (`protocol/tools.md`)

Replace the sentence about what is caught (`protocol/tools.md:70`) so it says: keys printed
as-is or with common escapes (JSON or backslash escapes such as `\u002B`, `\x2B` or `\/`,
and percent-encoding such as `%2B`), up to three layers, are replaced with `[key]`; base64,
hashing, splitting and web-page codes such as `&#43;` are not caught, and deeper escaping
may not be. A backslash right before a key is hidden with it. Text at a cut edge that looks like part of an escaped key is dropped, and very escape-heavy output can show `[not checked for keys]` in place of its escape-like stretches. Keep
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
  - the two-key overlap case in E3 step 2;
  - both edges cut on a capture made only of a spelling's middle: `[output cut]`;
  - the fallback: forcing a tiny budget (a test-only option), `ok %41%42 then ABCDEFGHIJKL`
    gives `ok [not checked for keys] then [key]`;
  - `runScript` exact output: stdout over 2 MiB ending `… done %41%42%43` gives text ending
    `done [output cut]`; stderr of `'x'.repeat(100)`, the 36-byte spelling
    `%41%42%43%44%45%46%47%48%49%4A%4B%4C`, a space, `'y'.repeat(65500)` and ` tail` (so the
    64 KiB window starts inside the spelling) gives exactly `'y'.repeat(4091) + ' tail'`;
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

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 1:** E1 speed rewritten (work limit and withholding, pinned fixtures (o), (a)-(c); Decision 8); E2 rewritten (K4 trim kept, plus removal of cut-off spelling pieces; Decision 7); E4 wording (three layers a guarantee, backslash before a key); Validation (pinned four-layer fixture, backslash case, exact cut-edge outputs for `redactCapture` and `runScript`).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Whole-capture withholding reverses Decision 5 | upheld | Fallback replaces only escape-like runs (Decision 9) |
| intent | minor | E2 "one place" contradicts E1's limit | upheld | E2: two places named |
| intent | minor | Guide silent on cut-edge drops and fallback | upheld | E4 sentence |
| mechanics | blocking | Trimming first hides the rest of an overlapping key | upheld | E3 order (Decision 10); test |
| mechanics | blocking | Window inside one long spelling, both edges cut | upheld | Leak, always fixed (realism.md): E2 both-cut rule (Decision 11) |
| mechanics | blocking | stderr runner fixture cannot give the stated output | downgraded: major | Fixture error, not design; fixture rewritten |
| mechanics | major | Work limit does not cover the cut-edge search | upheld | One budget (Decision 9); fixture (d) |

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
