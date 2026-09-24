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

**Well-formed means exactly this.** The three headers each appear once, in the order above,
and every line after `## Confirmed` — in any of the three sections — is either blank or an
entry in the format above, and no two entries anywhere carry the same phrase (compared as
above). Free text above `## Confirmed` is allowed and ignored. Any other line inside a
section, or a repeated phrase, makes the whole file malformed: the hook then treats the list as
empty, and `seen/wording.sh` refuses every verb with exit 1, leaving the file unchanged
(Remediation 2).

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
leaning on it)? yes/no`. This line is not a question under `protocol/planning.md`'s
one-question rule (Step 4) — it is a one-line aside, and it always comes after the turn's
single question during planning, or after the turn's content in every other stage, as its
very last line. The reader's next reply runs `confirm` or `strike`. No answer
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

It exits 0 at once, with no output and no file touched, when `WHEELCHAIR_LANE` is set to a
non-empty value or its input carries an `agent_id`. The environment variable marks a headless lane —
`codex exec` and `claude -p` invocations from `protocol/lanes.md` — since those run on the
reader's own login and would otherwise trip this same hook; `agent_id` marks a Claude Code
subagent, which never passes through a shell the marker could reach (D47, D51).

On every other message it carries, capped at 2,000 characters total (D34):

- The confirmed wording list — `## Confirmed` from `~/.wheelchair/wording.md` — newest
  first, with a trailing count of any entries left out to fit the cap. In the degenerate case
  where not even the list's header line plus that count line fits under the cap (only
  possible with an installed path close to 2,000 characters long), the list is left out
  entirely.
- On the first message after a gap of four hours or more since this **session's** last
  message, one line giving how long it has been. This is a session clock, kept per session
  under `~/.cache/wheelchair/sessions/<session-id>` and overwritten on every message; it is
  unrelated to a plan's own clock above and never drives one (D48).
- A visible one-line notice, shown to the reader rather than to the model, the one time the
  confirmed list changes, on a harness that displays a `UserPromptSubmit` `systemMessage`
  (D43, D45).
  Checked live on 2026-09-24 (Claude Code 2.1.282, Codex CLI 0.156.0): both display it in
  their interactive windows, so `seen/set.sh` passes `notice` for both and grants D38's
  write access on both.

It returns nothing at all when there is no confirmed entry, no gap, and no change to
report. On Codex, the hook runs only after the reader approves it once in `/hooks`, and a
changed definition needs approving again — the installer writes a byte-identical entry on
every run so an approval survives a reinstall (D36).

## The installer's reach

`install.sh` calls `seen/set.sh` before `sensitivity/set.sh`, so this reach happens first
and the dial's own warn-not-fail step still runs last. For each harness found on `PATH`
(the presence rule `protocol/lanes.md` uses):

- **Claude Code** — `~/.claude/settings.json` gets one `UserPromptSubmit` group whose
  single handler is `{"type": "command", "command": "<root>/seen/hook.sh claude notice",
  "timeout": 2}`.
- **Codex** — `~/.codex/hooks.json` gets the same shape of group, with `codex notice` in
  place of `claude notice`.

Its own group is recognised by the script path its command starts with, arguments ignored
(D14, D52); a rerun rewrites that one group in place rather than adding another, and every
other hook, group and key in the file is left exactly where it is (D26).

Grants happen only on a harness recorded above as displaying the notice — both, per the
live check this document already records (D38, D43). On Claude Code, `seen/set.sh` adds
`Bash(<root>/seen/wording.sh:*)` to `permissions.allow` and the wording directory to
`sandbox.filesystem.allowWrite`. On Codex, it adds the wording directory to
`writable_roots` under `[sandbox_workspace_write]` in `~/.codex/config.toml` — adding the
table if absent, inserting a `writable_roots` line right under the table's header if the
table has none, or else adding to the one existing `writable_roots` line — and touches no
other byte of the file (D38, D42). Where this document says `~/.wheelchair`, the script
itself writes that path's resolved, absolute form (for example `/home/collin/.wheelchair`),
never the literal `~/.wheelchair` string, since neither the JSON nor the TOML it edits
expands a tilde. The directory itself is created only once every check below has passed,
never before — Codex's sandbox drops a writable root that doesn't exist yet.

It refuses — exit 1, nothing written, no directory created — on invalid JSON, a JSON root
that is not an object, a wrongly shaped `hooks`, event list, group, `permissions`, `allow`,
`sandbox`, `filesystem`, or `allowWrite`, TOML that does not parse, a `sandbox_workspace_write` that is not a plain
`[sandbox_workspace_write]` table (including the dotted `sandbox_workspace_write.writable_roots`
form), or a `writable_roots` that is not a one-line array; it needs Python 3.11 or newer. When it creates or changes the
Codex hook entry it prints `run /hooks in Codex once to approve the wheelchair hook` (D36);
a rerun with nothing left to change writes byte-identical output and prints nothing.
`install.sh` warns rather than failing the install if it refuses, the same contract
`sensitivity/set.sh`'s own writer already uses for the dial.

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
reaches that notice. A missing or malformed wording list or `SEEN.md` is treated as empty
rather than repaired. The hook's own two state files are the exceptions, because it rewrites
them anyway: the session clock file is overwritten on every message whether or not it parsed,
a missing `confirmed.last` is written silently with the current list (nothing to compare
against yet), and an unreadable one counts as empty — the current confirmed entries are
announced as added (on a harness that shows the notice) and the file is rewritten with them,
so a damaged copy heals instead of switching the notice off. With an empty list there is
nothing to announce, so an unreadable copy is left until the list next changes. This is the
most important property in this document — a turn this feature blocks or delays is a failure noticed every
time, while a turn it fails to improve is only today's behaviour.
