---
slug: chat-refresh-leftovers
date: 2026-11-22
implemented-by: "standard, gpt-6.1-terra (T1, T2); sub-lead claude-opus-5-5"
verified-by: []
---

# Completion Report — Chat refresh: three leftovers from the duplicate thread

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1.1 `sessionChatItems` exported; `chat()` uses it; `sessionTranscript` loses `keepLast`, strict and plain paths unchanged | this run | `viewer/app/chat.js:311-334` (sessionTranscript), `:336`, `:442`, `:471` | `viewer/test/app-chat.test.js:371` (plain path still returns `''` after failure) |
| S1.2 entry is exactly `{ gen, end, hash, parsedKey, parsed, lastRead, thread }`, no raw text; `hash` = sha256 of `data` | this run | `viewer/app/chat.js:352-356` | `viewer/test/app-chat.test.js:384` (key set asserted, no `text`) |
| S1.3 `parsedKey` formula unchanged | this run | `viewer/app/chat.js:340` | `viewer/test/app-chat.test.js:384` |
| S1.4 `known` sent only when entry has `gen` and same `parsedKey` | this run | `viewer/app/chat.js:344` | `viewer/test/app-chat.test.js:384` (parent title change → route without `known`) |
| S1.5 matching `unchanged` (entry re-read after await) returns cached parsed; mismatch → one full request | this run | `viewer/app/chat.js:346-350` | `viewer/test/app-chat.test.js:384` (`?known=g%3A4`), `:411` (entry deleted mid-call → exactly two routes) |
| S1.6 non-empty `data`: reuse parse on same hash+key, else `module.exports.transcriptItems`; store fresh entry | this run | `viewer/app/chat.js:351-358` | `viewer/test/app-chat.test.js:411` (gen-less identical replies parse once) |
| S1.7 failure/empty: return cached parsed whatever its key (Decision 3); else local file parse uncached, or `[]` | this run | `viewer/app/chat.js:359-364` | `viewer/test/app-chat.test.js:371`, `:384` (failure after key change returns old parsed), `:411` (empty reply, throw, no entry → `[]`) |
| S1.8 empty transcript + known parser contributes nothing; unknown CLI gets its notice | this run | `viewer/app/chat.js:363-364` | `viewer/test/app-chat.test.js:411` (`cli: 'unknown'` → "no transcript reader") |
| S1.9 cached `parsed` not mutated | this run | `viewer/app/chat.js:442` (`items.push(...)`) | read of diff |
| S1.10 pruning unchanged | this run (untouched) | `viewer/app/hub.js` `pruneTranscripts` unchanged | `viewer/test/app-chat.test.js` "idle transcript pruning protects queued and active chat operations" |
| S2.1-4 memory every call; synchronous reservation in `seenSaved`; write at most once per 60 s; failed write frees own reservation and rethrows | this run | `viewer/app/hub.js:43`, `:111-121`, `:170` | `viewer/test/app-hub.test.js:912` |
| S2 test update: disk `last_seen` ≤ response `last_seen` | this run | — | `viewer/test/app-hub.test.js:899` |
| S3.1 `sweepCopyHashes()` called from `copyTranscriptNow` | this run | `machine/service.js:1471`, `:1477` | `machine/test/service.test.js` busy-hashes tests |
| S3.2 unref'd 60 s `copyHashesTimer`, cleared on close | this run | `machine/service.js:471-472`, `:2459` | `machine/test/service.test.js:1847` (registered callback drops aged entry, keeps fresh; close clears timer) |
| S3.3 nothing else about copying changes | this run | diff of `machine/service.js` is 10 lines | read of diff |

## Deviations from plan

None. A `cli` change shares the `parsedKey` branch the `parent_title` test exercises; there is no separate `cli`-change test.

## Routers

None — this change moved no ownership and no router named a file it touched.

## Validation evidence

Mutation checks reported by workers (T1: adding `text`, disabling hash reuse, removing the full retry each failed a test; T2: zero throttle and removing the timer cleanup each failed a test) — see `reports/T1.md`, `reports/T2.md`.

Run by the sub-lead on the merged branch (`4bfd0d5d`):

```
$ node --test viewer/test/*.test.js
exit 0
# tests 898
# pass 898
# fail 0
```

```
$ bash machine/test/run.sh
exit 1
not ok 564 - interop off withholds marked tool and logs it for every CLI
not ok 646..681 (18 tests in machine/test/win.test.js)
# tests 681
# pass 661
# fail 19
# skipped 1
```

The 18 `win.test.js` failures are environmental: `wslpath failed: Error: spawnSync wslpath ENOENT` (this machine has no `wslpath`); `node --test machine/test/win.test.js` fails identically (16 fail / 5 pass) on the pre-build commit `95966e5f`. Test 564 failed with `tmux buffer failed` under suite load; `node --test machine/test/win-forward-service.test.js` then passed 12/12 three times in a row. None of these files or the code they exercise were touched. `node --test machine/test/service.test.js` passes 130/130 and `viewer/test/app-hub.test.js` 119/119, `viewer/test/app-chat.test.js` 27/27.

## Known gaps / residual risks

- Accepted Risks in PLAN.md: hub's own machine written twice a minute under two names; a copy finishing just after `stop` re-inserts a hash set until the sweep.
- `sweepCopyHashes` evicts by age only; a copy running longer than 10 minutes could lose its set mid-run and rebuild it next copy (unchanged from main's on-copy sweep).
- The machine suite cannot fully pass on this machine without `wslpath`; it also stalled in `win-tool-proxy.test.js` when two suites ran concurrently.

## Remediation rounds
