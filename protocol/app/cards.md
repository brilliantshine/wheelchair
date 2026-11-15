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
| `stub` | yes | lead | no |
| `resolve` | never | lead | no |
| `message` | never | any session except reviewer and verifier | no |
| `result` | never | worker, mapper, sub-lead | no |

A pinned kind sits at the top of the thread, and posting a new card of that kind replaces
the old one in the pin (there is one offer, one idea list and one progress line per
thread). The app also posts `needs` cards of its own (a session stuck at startup, a
permission prompt, "Sessions ended"); you never post those.

## The shown kinds

### `offer`

The one "Take it into planning?" question, asked once per thread.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `summary` | string | yes | One or two sentences: what you understood he wants, in his words |

Button: "Take it into planning". A press comes back as
`[card <id>] picked: take it into planning`. If he keeps talking instead of pressing, the
app pins the offer and you never offer again.

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

A press comes back as `[card <id>] picked: <option label>`. Collin may instead type an
answer or an objection in the thread; that arrives as an ordinary message, and you answer
it like one.

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

The one pinned build line.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `done` | integer | yes | Tasks finished |
| `total` | integer | yes | Tasks in the build |
| `machines` | array of strings | yes | Which machines the workers are on |
| `choice_waiting` | boolean | yes | True turns the line amber with "choice for you", because a question card is waiting on him |

### `needs`

Something only Collin can fix or decide, where a question card does not fit.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `title` | string | yes | One line |
| `body` | string | yes | What is wrong or stuck and what he can do about it |
| `items` | array of strings | no | A list that belongs with it, such as the recurring objections |

### `resolve`

Closes a `needs` card you posted when the thing it asked for is settled. It is never shown
as a card of its own; its only effect is to mark the target answered, with your session name,
the note and the time. It is not stored in the thread.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `card` | string | yes | The id of the `needs` card to close (it is in the thread state you were given, or `[card <id>]` on a press) |
| `note` | string | yes | One line saying how it was resolved, shown on the dimmed card |

Rules: only a lead may post it. The target must be an open `needs` card in your own thread
that a lead posted, including one a previous lead posted. It is refused (422, with the
reason) for a card the app posted itself (stuck, permission, "Sessions ended": those close on
their own), for any other kind of card, for a card in another thread or one that does not
exist, and for a card already answered. Collin can also dismiss such a card himself, which
marks it the same way.

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

A boxes-and-arrows graph shown inside the thread.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `plan` | string | yes | The slug of the plan directory the graph lives in |
| `graph` | string | yes | The graph's file name under `docs/plans/<plan>/graphs/`, without `.json` |
| `title` | string | yes | One line saying what the picture answers |

The card embeds the graph page with a link to open it full screen. Write the graph first
(see `lead.md`, "Diagrams"); the card only points at it.

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

## The kinds never shown

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
| anything else | Collin's own words, typed in the app, the browser terminal or over `tmux attach` | his bubble, and your reply is shown |

The press forms, in full:

- `[card <id>] picked: <option label>` and `[card <id>] picked: take it into planning`
- `[card <id>] removed: <bullet text>`
- `[card <id>] talk about: <finding>`
- `[card <id>] start building`
- `[card <id>] start thread about: <text>`

Two consequences for a lead. Nothing you write in the reply to a `[wc:from ...]` message
reaches Collin, so when such a message means he must decide something, post a card. And a
message from Collin that arrives while you are mid-turn waits and is typed in when your
turn ends.

## The commands, in one place

```bash
node <root>/viewer/app/card.js <kind> <json-file>
node <root>/viewer/app/wc.js git <fetch|commit|merge|cherry-pick|revert|push|pr> ...
node <root>/viewer/app/wc.js session <start|stop|list> ...
```

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
