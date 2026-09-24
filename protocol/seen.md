# What the reader has seen

Two records. `docs/plans/<slug>/SEEN.md` says what the reader has been shown in a plan; a
second file, `~/.wheelchair/wording.md`, says what wording has landed badly with them. A
stage writes and reads the first as it works; a `UserPromptSubmit` hook carries the second,
plus a gap notice, into every turn on both harnesses, ordinary chat included. No model is
called for any of this, and neither record is ever added to an agent's standing
instructions (D19, D20, D21).

## The plan record — `docs/plans/<slug>/SEEN.md`

Created by whichever stage first appends to it, and committed with the plan. No
frontmatter, no state beyond the log itself. The body is an append-only log, one event per
line, of exactly three kinds:

```
<UTC ISO> new <4-hex id> <text>
<UTC ISO> shown <id>
<UTC ISO> turn
```

An id is four random hex characters, redrawn if it already appears in the file, so two
writers never have to agree on a counter. Every write is a single line appended with `>>`,
so two writers cannot lose each other's lines. Nothing already written is ever edited or
deleted — a correction is a new line, never a rewrite of an old one (D24).

Only stages write this file. The hook never reads or writes it (D30).

## What a stage writes

One `new` line per thing its turn's summary could lean on, appended the moment the unit of
hidden work that produced it finishes: each upheld or `user-decision` review finding once a
round is triaged, each accepted worker result, and each verification gap. A declined
finding or a clean round adds nothing, and neither does a map-build finding — the map is
shown to the reader before the idea is written, so there is nothing unseen to record (D33,
D41).

The line names the thing in words the reader would recognise — plain words, no coined
labels. It is evidence only, never drafted prose and never an instruction about how to
write the turn (D5).

## What a stage reads

Before composing any turn to the reader, the stage reads the plan's record and grounds each
unshown entry **that turn leans on** — nothing else. Entries the turn does not lean on stay
unshown; a turn with nothing to ground reads exactly as it does today (D31).

## End-of-turn order

Immediately before a stage turn's text, in this order: `shown` lines for the entries this
turn just explained, then the `turn` line. Nothing further is written to `SEEN.md` in that
turn (D54).

## The plan's clock

At the start of each turn to the reader, the stage reads the time of the latest `turn` line
in `SEEN.md`. Four hours or more before now is a gap for this plan, whatever happened
meanwhile in other sessions or other plans; a record with no `turn` line yet has no gap. The
turn's own `turn` line, written last per the order above, is what closes the clock for next
time (D48, D50, D54).

Only a turn written under a stage document counts — free chat after a stage has finished
writes no `turn` line. A stage ignores the hook's session gap line; that line serves
ordinary chat only, never a stage's own clock (D48, D52).

## After a gap

On a turn that finds a gap, every entry that turn leans on counts as not shown, including
ones shown before the gap: the stage explains them and appends `shown` for them again. An
entry the reader already ruled on — a `user-decision` finding — is referred to by its
outcome instead of being explained again. The reset applies to the first post-gap turn
only; it adds nothing else, and it does not extend to entries a later turn leans on. The
planning resume summary (`protocol/planning.md` Step 1) is unchanged by any of this — it is
already the re-grounding a resume needs (D56, D57).

The gap threshold is stated once, here, for every script and document that needs it:

gap-threshold: 4h

## The wording list — `~/.wheelchair/wording.md`

One file, outside any repository, shared by every project — the register changes how a
project the reader has never opened is written to, so it cannot live inside one (D10).
Three sections, always in this order, each entry one line — date, the phrase in double
quotes, what to do instead:

```
## Confirmed
- 2026-09-19 — "north star" — say what the goal is, plainly

## Proposed
- 2026-09-24 — "hidden work" — explain it before leaning on it

## Struck
- 2026-09-18 — "ledger" — not a dislike; that was a question about the design
```

Struck entries are kept, never deleted, so a rejection sticks (D15). Each phrase appears at
most once in the whole file, compared ignoring case and surrounding whitespace, so a verb
always names exactly one row (D29, D39).

Every write goes through `seen/wording.sh`, the only writer (D35). Its verbs, each taking
the phrase as the first operand:

- `suggest "<phrase>" "<instead>"` — adds a `## Proposed` row. Refuses when the phrase
  already appears in any section, including `## Struck` (D29, D35, D39).
- `confirm "<phrase>"` / `strike "<phrase>"` — moves that phrase's `## Proposed` row to
  `## Confirmed` or `## Struck`. Refuses when the phrase is not in `## Proposed`.
- `remove "<phrase>"` — moves a `## Confirmed` row to `## Struck`, so it cannot be
  suggested again.

The script creates the file with its three headers if absent, serialises writers with
`flock` on `~/.wheelchair/.lock` — never on the file being replaced, since the rename that
publishes a write swaps the inode out from under a lock held on it — and replaces the file
by temp-file-and-rename (D35, D39).

**How an entry gets there.** When the reader pushes back on wording during a stage turn —
asks what a word means, asks for something simpler — the stage runs `suggest` and, only if
the script accepted it, ends that turn with **one short line**, always last, never more than
one sentence, for example: `Add "hidden work" to your wording list (explain it before
leaning on it)? yes/no`. The reader's next reply runs `confirm` or `strike`. No answer
leaves the entry in `## Proposed`, and it is never asked about again. At most one such line
per turn. Ordinary chat outside a stage makes no suggestions — it only carries the
confirmed list, via the hook. Removing a confirmed entry is a plain request in any
conversation, handled with `remove` (D28).

Only `## Confirmed` is carried into turns, and only by the hook, together with the path of
`seen/wording.sh` so any agent asked to remove an entry knows what to run (D21).

## The hook

One `UserPromptSubmit` hook, `seen/hook.sh`, the same script on both harnesses, installed at
user scope and invoked as `hook.sh <harness> notice|no-notice`. It runs no model and no git,
and it never reads anything inside a repository — a user-level hook fires in every
repository it is pointed at, trusted or not, so nothing it reads may be attacker-controlled
(D21, D22, D30).

It exits 0 at once, with no output and no file touched, when `WHEELCHAIR_LANE` is set (any
value) or its input carries an `agent_id`. The environment variable marks a headless lane —
`codex exec` and `claude -p` invocations from `protocol/lanes.md` — since those run on the
reader's own login and would otherwise trip this same hook; `agent_id` marks a Claude Code
subagent, which never passes through a shell the marker could reach (D47, D51).

On every other message it carries, capped at 2,000 characters total (D34):

- The confirmed wording list — `## Confirmed` from `~/.wheelchair/wording.md` — newest
  first, with a trailing count of any entries left out to fit the cap.
- On the first message after a gap of four hours or more since this **session's** last
  message, one line giving how long it has been. This is a session clock, kept per session
  under `~/.cache/wheelchair/sessions/<session-id>` and overwritten on every message; it is
  unrelated to a plan's own clock above and never drives one (D48).
- A visible one-line notice, shown to the reader rather than to the model, the one time the
  confirmed list changes, on a harness that displays a `UserPromptSubmit` `systemMessage`
  (D43, D45).

It returns nothing at all when there is no confirmed entry, no gap, and no change to
report. On Codex, the hook runs only after the reader approves it once in `/hooks`, and a
changed definition needs approving again — the installer writes a byte-identical entry on
every run so an approval survives a reinstall (D36).

## The installer's reach

`install.sh` calls `seen/set.sh`, which writes each present harness's hook entry and grants
the wording script write access to `~/.wheelchair/`, following the same own-entries-only,
refuse-rather-than-repair contract `sensitivity/set.sh` already uses for the dial (D26, D36,
D38, D42, D43). `seen/AGENTS.md` is the router for exactly which files it touches and what
it refuses on.

## Test seams

Two, set only by the fixture suites and never in production, the same convention
`WHEELCHAIR_PRESENT` already uses in `protocol/lanes.md`:

- `WHEELCHAIR_WORDING` — replaces the wording file's path.
- `WHEELCHAIR_STATE` — replaces `~/.cache/wheelchair`.

(D46)

## Failing open

Every path here fails open. A hook that exits non-zero, times out, or returns unparseable
output lets the turn proceed with nothing injected — the harness may print its own one-line
notice on a non-zero exit, so the hook exits 0 on every path it controls and only a timeout
reaches that notice. A missing or malformed wording list, `confirmed.last`, or `SEEN.md` is
treated as empty rather than repaired. The one exception is the session clock file: the hook
overwrites it on every message regardless of whether it parsed. This is the most important
property in this document — a turn this feature blocks or delays is a failure noticed every
time, while a turn it fails to improve is only today's behaviour.
