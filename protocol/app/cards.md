# Cards, markers and the commands that carry them

The card rules every card-posting role gets (lead, sub-lead, worker, mapper; the lead also
gets `cards-lead.md`). A **card** is a small JSON document a session posts; the app shows
some kinds to the user and uses the rest to move work between sessions. `<root>` is named in
your starting instructions.

## Posting a card

Write the JSON to a file, then run:

```bash
node <root>/viewer/app/card.js <kind> <json-file>
```

`card.js` checks the file against this document and posts it to the machine service on
your own machine. It succeeds once the card is safely on disk there, even if the app is
down; the card is delivered when the app comes back. An invalid card is refused with the
reason and nothing changes, so fix the file and run it again.

Rules for every card:

- The file holds one JSON object. `kind` must equal the kind on the command line.
- Fields marked required must be present and non-empty. A field not listed for the kind
  is refused.
- You never put a thread id, your own session name or a card id in a card. (A `message` names its recipient.) The app learns who you
  are from your session token and which thread you belong to from its own record, and it
  assigns every card its `id`.
- A card is accepted only for the thread your session belongs to.
- Text fields are plain sentences for a person, not codenames. A card the user sees is read
  on a phone, so write the short version.

## Which kinds exist

| Kind | Shown to the user | Emitted by | Pinned |
|---|---|---|---|
| `offer` | yes | lead | yes |
| `idea` | yes | lead | yes |
| `deferred` | yes | lead | yes |
| `question` | yes | lead | no |
| `approval` | yes | lead | yes |
| `progress` | yes | sub-lead, lead | yes |
| `needs` | yes | lead | no |
| `done` | yes | lead | no |
| `check` | yes | lead | no |
| `merged` | yes | app | no |
| `diagram` | yes | lead | no |
| `image` | yes | lead | no |
| `file` | yes | lead | no |
| `stub` | yes | lead | no |
| `sudo` | yes | lead | no |
| `title` | never | lead | no |
| `resolve` | never | lead | no |
| `retract` | never | lead | no |
| `message` | never | any session except reviewer and verifier | no |
| `result` | never | worker, mapper, sub-lead | no |

A pinned kind sits at the top of the thread, and posting a new card of that kind replaces
the old one in the pin (there is one offer, one idea list, one deferred list and one progress line per
thread). An approval unpins when Start building is accepted or it is retracted; a fresh
approval replaces an open pinned approval. The app also posts `needs` cards of its own (a session stuck at startup, a
permission prompt, "Sessions ended"); you never post those.

Sections for `progress`, `message` and `result` are below; all other kind sections are
in `cards-lead.md`.

## The shown kinds

### `progress`

The one pinned progress line.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `stage` | `build` \| `review` \| `verify` | no | Absent means `build` |
| `done`, `total` | integer | `build` only | Tasks finished and tasks in the build; `0 <= done <= total` |
| `machines` | array of strings | yes, every stage | Machines in use; may be empty for `review` |
| `choice_waiting` | boolean | yes, every stage | True turns the line amber with "choice for you" |
| `pass` | integer >= 1 | `review`, `verify` | Review round or verification attempt number (`REMEDIATION-N.md`'s N + 1 for a re-verify); forbidden for `build` |
| `phase` | `checking` \| `fixing` \| `clean` | `review`, `verify` | Checking is running reviewers or verifiers; fixing is triage and Spec fixes or remediation; clean means the review round met lead.md's clean test or verification passed. Forbidden for `build` |
| `found`, `fixed` | integer | `fixing`; optional together for review `clean` | This pass only: `0 <= fixed <= found`; fixing requires `found >= 1`; clean requires `fixed == found`. Forbidden otherwise |

`done` and `total` are forbidden for `review` and `verify`; `found` and `fixed` are
forbidden with `checking` and verify `clean`. Review `clean` carries both counts or neither.

| Stage / phase | Label | Text |
|---|---|---|
| `build` / absent | Building | Unchanged: segments + "D of T tasks done · machines" |
| `review` / `checking` | Reviewing plan | "pass N · reviewers reading" |
| `review` / `fixing` | Reviewing plan | "pass N · F found, X resolved" |
| `review` / `clean` | Plan reviewed | "pass N · passed", or "pass N · passed, F resolved" when counts are present |
| `verify` / `checking` | Verifying | "attempt N · checking" |
| `verify` / `fixing` | Verifying | "attempt N · F gaps, X fixed" |
| `verify` / `clean` | Verified | "attempt N · passed" |

Review and verify have no segment bar; verify appends machines when non-empty. The folded
label joins the label and text with " · ", adding ": choice for you" when waiting; the
build folded label remains "Building D of T". Text wraps at phone widths.

## The kinds never shown

### `message`

To another session in the same thread.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `to` | string | yes | The session's name, `wc-<thread-id>-<role>[-<n>]`. `wc.js session list` shows the names |
| `text` | string | yes | The message |
| `asks` | boolean | no | True when this message needs an answer |
| `passes_on` | string | no | The id of the question message this passes on |

The app types it into that session when its turn ends, as one message starting
`[wc:from <your session name>]`. The thread hides it and the receiver's whole reply.
A worker's question to the lead, a sub-lead's report of a surviving gap and the app's
"your session died" notices all travel this way.

### `result`

A finished task, carrying its report. The app delivers it to the session that started you. Only a `result` marks a task finished: a turn
ending never does.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `task` | string | yes | The task id from your brief (`T3`); `map` for a mapping session; `build` for a sub-lead |
| `outcome` | string | yes | `done` or `blocked` |
| `summary` | string | yes | Two or three sentences |
| `report` | string | no | Path of the report file in the repository, when you wrote one |
| `commit` | string | no | The commit the result is about, when there is one |

Reviewers and verifiers never run `card.js`. Their report is the last assistant message of
their turn; the app reads it from the transcript when the turn ends and delivers it to the
session that started them as their `result`.

## What reaches a session, and the markers

The app types everything into a session as a message. A message starts with a marker the
app uses to hide traffic the user did not write:

| Starts with | Meaning | Thread shows |
|---|---|---|
| `[wc:role]` | Your role instruction (Codex sessions get it as their first message) | hidden, and your reply to it |
| `[wc:from <session>]` | Another session's `message`, or a `result` delivered to you | hidden, and your reply to it |
| `[wc:context stub]` | Context for a lead that starts a stub thread: the stub's summary | hidden, your reply **shown**, with "Started from <parent thread>" in its place |
| `[wc:context restart]` | Context for a lead that replaces a dead one: the plan and the cards so far | hidden, your reply **shown**, with "Lead restarted" in its place |
| `[wc:context import]` | Context for a lead continuing an imported thread | hidden, your reply **shown**, with "Imported from a handoff" in its place |
| `[card <id>] ...` | The user pressed a button on card `<id>` | a short bubble from them ("Picked B"), and your reply is shown |
| a final `[wc:style]` block, after a blank line at the END of a message | The user's writing style, delivered to a lead, replacing any earlier style | stripped from the user's bubble |
| anything else | The user's own words, typed in the app, the browser terminal or over `tmux attach` | their bubble, and your reply is shown |

A question message includes `[question <id>]` after its `[wc:from <session>]` marker. Use that id as `passes_on` when passing the question on. The id must name an asking message in the same thread.

An uploaded file arrives in the user's message as a line `[attached: <absolute path>]`;
the lead can open that path.

The press forms, in full:

- `[card <id>] picked: <option label>`, `[card <id>] picked: take it into planning` and `[card <id>] picked: keep talking first`
- `[card <id>] answered: <text>`, their own words in a question card's box
- `[card <id>] removed: <bullet text>`
- `[card <id>] talk about: <finding>`
- `[card <id>] fix what the check found` and `[card <id>] leave it`
- `[card <id>] start building`
- `[card <id>] start thread about: <text>`
- `[card <id>] keep going` and `[card <id>] talk about: <needs card title>`, on your `needs` card
- `[card <id>] sudo ran: exit <n>`, `declined`, `sudo expired`, `sudo failed: <reason>` and `talk about: sudo request`, on your `sudo` card

Two consequences for a lead. Nothing you write in the reply to a `[wc:from ...]` message
reaches the user, so when such a message means they must decide something, post a card. And a
message from the user that arrives while you are mid-turn waits and is typed in when your
turn ends.

An app `[wc:from app]` reminder means your turn ended without the card your starter is
waiting for; for a reviewer or verifier it means the last turn ended with no report.

## The commands, in one place

```bash
node <root>/viewer/app/card.js <kind> <json-file>
node <root>/viewer/app/wc.js git <fetch|commit|merge|cherry-pick|revert|push|pr> ...
node <root>/viewer/app/wc.js session <start|stop|list> ...
```

A session's own `wc.js` and `card.js` calls go to its own machine service (default port
7374), are always allowed, and no brief can forbid them.

- `wc.js git` asks your machine's service to run the git write in **your own worktree and
  nowhere else**. No role runs a git write directly (Codex's sandbox keeps `.git`
  read-only); reading git (`git diff`, `git log`, `git status`, `gh pr view`) stays direct.
  `commit` takes the exact paths to commit and refuses a commit without them, so one
  session never sweeps in another's half-written files. A sub-lead's `merge` may take a
  worker's branch.
- `wc.js session` starts, stops and lists sessions through the hub. Who may start or stop
  what is in `lead.md` and `sub-lead.md`; anything else is refused with the reason. When the
  hub is down it retries for up to 90 seconds and then exits non-zero with "hub
  unavailable". Wait a minute and run the same command again; never work around it.
  `start` takes `--attempt <id>`, chosen once per intended session and reused when you
  re-run the same command after "hub unavailable", so a retry never starts a session twice.
  `start` takes `--title "<a few words>"`: what the agent does, in the user's terms,
  shown on its box on the Agents screen.
  A restart, or a re-verify, is a new attempt with a new id.
