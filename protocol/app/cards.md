# Cards, markers and the commands that carry them

The one file every role reads for how to talk to the app. A **card** is a small JSON
document a session posts; the app shows some kinds to Collin and uses the rest to move
work between sessions. `<root>` below is the wheelchair clone: the role file you were
pointed at lives at `<root>/protocol/app/<role>.md`.

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
- Text fields are plain sentences for a person, not codenames. A card Collin sees is read
  on a phone, so write the short version.

## Which kinds exist

| Kind | Shown to Collin | Emitted by | Pinned |
|---|---|---|---|
| `offer` | yes | lead | yes |
| `idea` | yes | lead | yes |
| `question` | yes | lead | no |
| `approval` | yes | lead | no |
| `progress` | yes | sub-lead, lead | yes |
| `needs` | yes | lead | no |
| `done` | yes | lead | no |
| `diagram` | yes | lead | no |
| `image` | yes | lead | no |
| `stub` | yes | lead | no |
| `sudo` | yes | lead | no |
| `title` | never | lead | no |
| `resolve` | never | lead | no |
| `message` | never | any session except reviewer and verifier | no |
| `result` | never | worker, mapper, sub-lead | no |

A pinned kind sits at the top of the thread, and posting a new card of that kind replaces
the old one in the pin (there is one offer, one idea list and one progress line per
thread). The app also posts `needs` cards of its own (a session stuck at startup, a
permission prompt, "Sessions ended"); you never post those.

## The shown kinds

### `offer`

The "Take it into planning?" question.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `summary` | string | yes | One or two sentences: what you understood he wants, in his words |

Buttons: "Take it into planning" and "Keep talking first". Their presses come back as
`[card <id>] picked: take it into planning` and `[card <id>] picked: keep talking first`.
The hub refuses a third offer, and also refuses a second unless the first was answered
"keep talking first" (422, "the offer was already asked"). If he keeps talking instead
of pressing, the app pins the offer and it is a feature as before.

### `idea`

"Your idea so far."

| Field | Type | Required | Meaning |
|---|---|---|---|
| `bullets` | array of `{id, text}` | yes | `id` is a short string you choose and keep stable (`b1`, `b2`); `text` is close to his own words. At least one bullet |

Each bullet has a remove button. A press comes back as `[card <id>] removed: <bullet text>`;
post the card again without that bullet. With more than three bullets the app folds the
card to show the newest two, so order them oldest first.

### `question`

One decision for Collin. Also used to confirm IDEA.md.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `fits` | string | yes | One plain sentence tying the question to the idea |
| `question` | string | yes | The question, in plain language |
| `options` | array of `{id, label, consequence}` | yes | Two to four. `label` is short (a button); `consequence` says what choosing it means for how the thing behaves or what work it creates |
| `leaning` | string | yes | The `id` of the option you would pick |
| `why` | string | yes | One line on why you lean that way |
| `progress` | string | no | For example "decision 4 of roughly 9" |
| `doc` | string | no | One of `MAP.md`, `IDEA.md` or `PLAN.md` |

A press comes back as `[card <id>] picked: <option label>`. Under the options the card has
a box for his own words; sending it closes the card and comes back as
`[card <id>] answered: <text>`. Treat it as his answer to the question: it may be a new
option, an option with a condition, or an objection. It needs no `resolve`. Collin may
also type in the thread instead; that arrives as an ordinary message, and you answer it
like one. When `doc` is present, the card shows an "Open <doc>" link to that document's
in-app page.

### `approval`

"Plan approved, N objections", with the Ready result.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `objections` | array of `{id, finding, severity, reason}` | yes | Every finding a reviewer rated `blocking` or `major` that you declined or downgraded. `severity` is the reviewer's, `blocking` or `major`; `reason` is yours. May be empty. N on the card is the length of this list |
| `ready` | object `{ok, missing}` | yes | `ok` is true or false; `missing` is an array of plain-language strings naming exactly what is missing (empty when `ok` is true) |

Each objection has a "Talk about this" button; a press comes back as
`[card <id>] talk about: <finding>`. Start building is enabled only when `ready.ok` is
true. The Re-check button is the app's: it reruns the check and updates the same card
itself, and nothing is typed to you. Pressing Start building makes the app rerun the check
first; if it changed, the card updates and nothing starts. When it holds, it comes back as
`[card <id>] start building`.

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

### `needs`

Something only Collin can fix or decide, where a question card does not fit.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `title` | string | yes | One line |
| `body` | string | yes | What is wrong or stuck and what he can do about it |
| `items` | array of strings | no | A list that belongs with it, such as the recurring objections |

### `resolve`

Closes a `needs` card you posted when the thing it asked for is settled, or your open
`question` card when Collin answered it in chat. It is never shown as a card of its own; its
only effect is to mark the target answered, with your session name, the note and the time.
It is not stored in the thread.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `card` | string | yes | The id of the `needs` or `question` card to close (it is in the thread state you were given, or `[card <id>]` on a press) |
| `note` | string | yes | One line saying how it was resolved, shown on the dimmed card |

Rules: only a lead may post it. The target must be an open `needs` card in your own thread
that a lead posted, including one a previous lead posted, or an open `question` card in that
thread. A resolved question shows "Answered in chat" and the note. It is refused (422, with
the reason) for a `needs` card the app posted itself (stuck, permission, "Sessions ended":
those close on their own), for any other kind of card, for a card in another thread or one
that does not exist, and for a card already answered.

An open lead `needs` card has two buttons, "Keep going" and "Talk about it". Either one closes
the card as answered by Collin and reaches you as `[card <id>] keep going` or
`[card <id>] talk about: <card title>`. Your reply is shown, so always answer: say in a line
what you are doing next, or, for "talk about it", explain the problem plainly and post a
`question` card for the decision he has to make. An older form, `[card <id>] dismissed`, gets
the same treatment: say what you will do now instead of going quiet.

### `done`

"Built and checked", or, for a fix in a done thread, what the fix changed.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `title` | string | yes | "Built and checked", or "Fixed: <what>" |
| `can_do` | array of strings | yes | What he can do now |
| `left_as_is` | array of strings | yes | What was deliberately not done. Each gets a "Start a thread about it" button. May be empty |
| `pr_url` | string | yes | The pull request, for the Review pull request link |
| `note` | string | no | Anything he must know, such as "this fix failed its check and was pushed at your request" |

A "Start a thread about it" press comes back as
`[card <id>] start thread about: <left_as_is text>`; you answer it with a `stub` card.

### `diagram`

A picture shown inside the thread.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `plan` | string | yes | The slug of the plan directory the picture lives in |
| `graph` | string | yes | The file name under `docs/plans/<plan>/graphs/`, without its extension |
| `title` | string | yes | One line saying what the picture answers |
| `format` | string | no | `graph` (default), `form` or `html` |

`graph` and `form` load `graphs/<graph>.json`; `html` loads `graphs/<graph>.html`.
Write the file first (see `lead.md`, "Diagrams"); the card only points at it. The card's
link reads "Open full size", for every format including forms. It opens the app's picture
page, which has a Back to thread link.

A `form` file has a top-level `form` and a required string `explanation`, shown above the
picture. Strings are shown as text, never as HTML.

| `form` | Shape | Drawn as |
|---|---|---|
| `timeline` | `events: [{when, label, detail?}]`, 1+ items, in order | A vertical line with one marker per event; `when` small above `label`, `detail` muted below |
| `before-after` | `before: {title?, items: [string]}`, `after: {title?, items: [string]}` | Two columns, headed "Before"/"After" unless `title` is given; on a narrow card, Before stacked over After with a ↓ between |
| `layers` | `layers: [{label, detail?}]`, 1+ items, top layer first | Full-width stacked bands, top first |
| `side-by-side` | `columns: [{title, items: [string]}]`, 2–4 items | Equal columns; on a narrow card, stacked in order |

HTML is self-contained and static: HTML, inline `<style>` and inline SVG. Scripts never
run, and nothing loads from the network.

Pick a timeline for an order of events, before and after for a change, layers for a stack,
side by side for a comparison of 2–4 things, boxes and arrows for connections, and HTML
only when none fits.

### `image`

An image shown inside the thread.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `path` | string | yes | Absolute path to a PNG, JPEG, GIF or WebP on the lead's machine, at most 25 MB |
| `title` | string | yes | One line |

The machine copies the file into the thread's uploads folder, so the original may be
deleted afterwards. Only the lead posts it: a screenshot another session took reaches
Collin when the lead posts it. Images are removed when the thread is archived.

### `stub`

New work that belongs in its own thread.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `title` | string | yes | Short title of the stub thread |
| `summary` | string | yes | Context for the next lead: what was asked, what this thread already knows, links to its plan documents and pull request. Written so a lead that has seen none of this thread can start |
| `depends_on_parent` | boolean | yes | True when the work builds on this thread's unmerged work (an after-done fix always does) |
| `commits` | array of strings | no | For a fix that missed the merge: the fix's own commit ids, not merge commits, for the stub's lead to cherry-pick |

The app adds a stub thread to the list (same project, CLI and machine) and shows the card
in this thread with a "Go to it" button. No session starts until Collin opens it.

### `sudo`

A command that needs root, for Collin to run from his own device. Only a lead posts it: a worker
or sub-lead that needs root asks the lead with a `message`.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `command` | string | yes | The exact shell command, run with `/bin/sh -c`. At most 4096 bytes, no NUL, no `~` (write the full path). Write the real commands here, never a script you or another agent wrote or can edit |
| `does` | string | yes | Plain words: what it changes on the machine |
| `why` | string | yes | Why the task needs it |

You send those three fields and nothing else; `request_id`, `url`, `editable` or `state` in your
file is refused. The machine service registers the request with its own root-owned sudo helper
first and adds `request_id`, `url` (the helper's private page) and `editable` (files named in the
command that an agent could change before it runs; the card warns Collin about them). If the
helper is not installed, `card.js` exits non-zero with `machine refused card (503)` and
`sudo helper not installed on <machine>; Collin installs it once with: sudo <root>/sudo-helper/install.sh`:
tell Collin that in a reply and in a `needs` card. A helper refusal comes back as a `422`
with its sentence (for example `Write the full path; ~ would mean /root here`).

The card shows the command in full, `does` and `why`, and three controls while it is waiting:
**Open to run** (Collin's password goes only into the helper's page, never the app), **Decline**
and **Talk about it**. Its states are `waiting`, `running`, `ran` (exit code and output, with a
note when the output was cut), `declined`, `expired` and `failed` (with the reason). Collin
decides each time; do not ask twice for the same thing.

What reaches you, once per card (the output follows `ran` on the next lines):

- `[card <id>] sudo ran: exit <n>`
- `[card <id>] declined`
- `[card <id>] sudo expired`
- `[card <id>] sudo failed: <reason>`
- `[card <id>] talk about: sudo request`: Collin wants to discuss it. Nothing ran and the card
  stays waiting; answer in a line and keep going.

The password is never in any of these.

## The kinds never shown

### `title`

Renames the thread. It is not stored and may be posted again when the name needs to change.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `title` | string | yes | The short thread name; it is trimmed and cut to 80 characters |

### `message`

To another session in the same thread.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `to` | string | yes | The session's name, `wc-<thread-id>-<role>[-<n>]`. `wc.js session list` shows the names |
| `text` | string | yes | The message |

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
app uses to hide traffic Collin did not write:

| Starts with | Meaning | Thread shows |
|---|---|---|
| `[wc:role]` | Your role instruction (Codex sessions get it as their first message) | hidden, and your reply to it |
| `[wc:from <session>]` | Another session's `message`, or a `result` delivered to you | hidden, and your reply to it |
| `[wc:context stub]` | Context for a lead that starts a stub thread: the stub's summary | hidden, your reply **shown**, with "Started from <parent thread>" in its place |
| `[wc:context restart]` | Context for a lead that replaces a dead one: the plan and the cards so far | hidden, your reply **shown**, with "Lead restarted" in its place |
| `[card <id>] ...` | Collin pressed a button on card `<id>` | a short bubble from him ("Picked B"), and your reply is shown |
| a final `[wc:style]` block, after a blank line at the END of a message | Collin's writing style, delivered to a lead, replacing any earlier style | stripped from Collin's bubble |
| anything else | Collin's own words, typed in the app, the browser terminal or over `tmux attach` | his bubble, and your reply is shown |

An uploaded file arrives in Collin's message as a line `[attached: <absolute path>]`;
the lead can open that path.

The press forms, in full:

- `[card <id>] picked: <option label>`, `[card <id>] picked: take it into planning` and `[card <id>] picked: keep talking first`
- `[card <id>] answered: <text>`, his own words in a question card's box
- `[card <id>] removed: <bullet text>`
- `[card <id>] talk about: <finding>`
- `[card <id>] start building`
- `[card <id>] start thread about: <text>`
- `[card <id>] keep going` and `[card <id>] talk about: <needs card title>`, on your `needs` card
- `[card <id>] sudo ran: exit <n>`, `declined`, `sudo expired`, `sudo failed: <reason>` and `talk about: sudo request`, on your `sudo` card

Two consequences for a lead. Nothing you write in the reply to a `[wc:from ...]` message
reaches Collin, so when such a message means he must decide something, post a card. And a
message from Collin that arrives while you are mid-turn waits and is typed in when your
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
  A restart, or a re-verify, is a new attempt with a new id.
