# Lead-only card kinds

These are the lead-only card kinds. Shared rules, posting and markers are in `cards.md`.

## The shown kinds

### `offer`

The "Take it into planning?" question.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `summary` | string | yes | One or two sentences: what you understood they want, in their words |

Buttons: "Take it into planning" and "Keep talking first". Their presses come back as
`[card <id>] picked: take it into planning` and `[card <id>] picked: keep talking first`.
The hub refuses a third offer, and also refuses a second unless the first was answered
"keep talking first" or was retracted (422, "the offer was already asked"). If they keep talking instead
of pressing, the app pins the offer and it is a feature as before.

### `idea`

"Your idea so far."

| Field | Type | Required | Meaning |
|---|---|---|---|
| `bullets` | array of `{id, text}` | yes | `id` is a short string you choose and keep stable (`b1`, `b2`); `text` is close to their own words. At least one bullet |

Each bullet has a remove button. A press comes back as `[card <id>] removed: <bullet text>`;
post the card again without that bullet. With more than three bullets the app folds the
card to show the newest two, so order them oldest first.

### `deferred`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `mode` | `two-part` \| `proof-of-concept` | yes | How the items are treated |
| `bullets` | array of `{id, text}` | yes | May be empty; ids and texts must each be unique within the card |
| `locked` | boolean | no | Hides remove buttons when true |

The heading is “Saved for the follow-up · N things” in two-part mode, with “These go into a new thread when this one is done.”; in proof-of-concept mode it is “Skipped for this proof of concept · N things”, with “These are accepted as risks; nothing will fix them later.” An empty list says “Nothing deferred yet”. Like idea, lists over three fold. A remove press arrives as `[card <id>] removed: <bullet text>` and does not mark the card answered.

The hub refuses `removed` on kinds other than idea or deferred, or when the text does not match a bullet (400). A locked deferred card refuses it (422); replaced and withdrawn cards refuse presses as usual.

### `question`

One decision for the user. Also used to confirm IDEA.md.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `fits` | string | yes | One plain sentence tying the question to the idea |
| `question` | string | yes | The question, in plain language |
| `options` | array of `{id, label, consequence}` | yes | Two to four. `label` is short (a button); `consequence` says what choosing it means for how the thing behaves or what work it creates |
| `leaning` | string | yes | The `id` of the option you would pick |
| `why` | string | yes | One line on why you lean that way |
| `progress` | string | no | For example "decision 4 of roughly 9" |
| `doc` | string | no | One of `MAP.md`, `IDEA.md` or `PLAN.md` |
| `passes_on` | string | no | The id of the question message this passes on |
| `about_thread` | string | no | For an overlap card: the other thread's id, 12 lowercase hex characters. Stored on the card, never shown |

A press comes back as `[card <id>] picked: <option label>`. Under the options the card has
a box for their own words; sending it closes the card and comes back as
`[card <id>] answered: <text>`. Treat it as their answer to the question: it may be a new
option, an option with a condition, or an objection. It needs no `resolve`. The user may
also type in the thread instead; that arrives as an ordinary message, and you answer it
like one. When `doc` is present, the card shows an "Open <doc>" link to that document's
in-app page.

### `approval`

"Plan approved, N objections", with the Ready result.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `objections` | array of `{id, finding, severity, reason}` | yes | Every finding a reviewer rated `blocking` or `major` that you declined or downgraded. `severity` is the reviewer's, `blocking` or `major`; `reason` is yours. May be empty. N on the card is the length of this list |
| `ready` | object `{ok, missing}` | yes | `ok` is true or false; `missing` is an array of plain-language strings naming exactly what is missing (empty when `ok` is true) |
| `warnings` | array of strings | no | Added by the machine, never by the lead: such as missing screen tools. Shown as information; never affects Start building. |

Each objection has a "Talk about this" button; a press comes back as
`[card <id>] talk about: <finding>`. Start building is enabled only when `ready.ok` is
true. The Re-check button is the app's: it reruns the check and updates the same card
itself, and nothing is typed to you. Pressing Start building makes the app rerun the check
first; if it changed, the card updates and nothing starts. When it holds, it comes back as
`[card <id>] start building`.

### `needs`

Something only the user can fix or decide, where a question card does not fit.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `title` | string | yes | One line |
| `body` | string | yes | What is wrong or stuck and what they can do about it |
| `items` | array of strings | no | A list that belongs with it, such as the recurring objections |

### `resolve`

Closes a `needs` card you posted when the thing it asked for is settled, or your open
`question` card when the user answered it in chat. It is never shown as a card of its own; its
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
the card as answered by the user and reaches you as `[card <id>] keep going` or
`[card <id>] talk about: <card title>`. Your reply is shown, so always answer: say in a line
what you are doing next, or, for "talk about it", explain the problem plainly and post a
`question` card for the decision the user has to make. An older form, `[card <id>] dismissed`, gets
the same treatment: say what you will do now instead of going quiet.

### `done`

"Built and checked", or, for a fix in a done thread, what the fix changed.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `title` | string | yes | "Built and checked", or "Fixed: <what>" |
| `can_do` | array of strings | yes | What they can do now |
| `left_as_is` | array of strings | yes | What was deliberately not done. Each gets a "Start a thread about it" button. May be empty |
| `pr_url` | string | yes | The pull request, for the Review pull request link |
| `head` | string | yes | The full 40-character lowercase hex commit id pushed by the lead: the remote branch tip read after the push |
| `note` | string | no | Anything they must know, such as "this fix failed its check and was pushed at your request" |
| `verified` | boolean | no | `true` only when the lead holds a passing check of this exact change (lead.md, Making the pull request mergeable); omitted otherwise. The app auto-merges only when every done card in the thread has it |

The app accepts the card only when GitHub says this thread's pull request, at `head`, is merged or ready to merge; otherwise `card.js` fails with the reason. A `done` card is never queued, so "the app is unreachable" means try again.

A "Start a thread about it" press comes back as
`[card <id>] start thread about: <left_as_is text>`; you answer it with a `stub` card.

### `check`

Post after the current done card. One check per done head; a duplicate refusal means it was posted.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `head` | string | yes | Current done card's 40-character lowercase hex head |
| `update` | string | yes | How to get the merged change running; at most 300 characters |
| `steps` | array | yes | 1 to 6 steps |

Each step:

| Field | Type | Required | Meaning |
|---|---|---|---|
| `where` | `app` \| `machine` | yes | Where to follow it |
| `do` | string | yes | What to do; at most 300 characters |
| `see` | string | yes | What to see; at most 300 characters |
| `command` | string | no | Machine only; exact command with full paths, at most 1000 characters; may span lines |
| `agent` | `matched` \| `not-tried` \| `broken` | yes | Whether an agent saw the expected result, could not try it, or found it broken |
| `note` | string | unless matched | Why it was not tried or what broke; one line, at most 300 characters; forbidden when matched |

Shown as “Check it yourself”, the update, then numbered steps labeled “In the app” or
“On the machine”, with a command block and Copy, “You should see:”, and, where relevant,
“Not tried by an agent: <note>” or “An agent tried this and it didn't work: <note>”.
“Fix it now” and “Leave it” appear only for a broken step, until answered or superseded.

The hub refuses a missing current done, a head other than the latest current done, or a
second check for that head. Presses accept only `fix` and `leave`, only with a broken step,
a current head, an unanswered card and a live lead. They answer the card and send
`[card <id>] fix what the check found` or `[card <id>] leave it` to the lead.

### `merged`

The app posts this card when the thread's pull request is merged. It carries `kind`,
`title` and `pr_url`, along with the usual stored card fields. Archive (with confirmation)
and Keep it are handled by the app; nothing reaches the lead, and no session may post it.

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
the user when the lead posts it. Images are removed when the thread is archived.

### `file`

A document sent to the user.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `path` | string | yes | Absolute path to a regular file on the lead's machine, at most 25 MB |
| `title` | string | yes | One line: what the document is |

The machine copies the file at send time, so later edits to the source do not reach the user.
It shows in chat and in the sidebar's Sent to you section. Archiving the thread deletes it.

### `stub`

New work that belongs in its own thread.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `title` | string | yes | Short title of the stub thread |
| `summary` | string | yes | Context for the next lead: what was asked, what this thread already knows, links to its plan documents and pull request. Written so a lead that has seen none of this thread can start |
| `depends_on_parent` | boolean | yes | True when the work builds on this thread's unmerged work (an after-done fix always does) |
| `commits` | array of strings | no | For a fix that missed the merge: the fix's own commit ids, not merge commits, for the stub's lead to cherry-pick |

The app adds a stub thread to the list (same project, CLI and machine) and shows the card
in this thread with a "Go to it" button. No session starts until the user opens it.

### `sudo`

A command that needs root, for the user to run from their own device. Only a lead posts it: a worker
or sub-lead that needs root asks the lead with a `message`.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `command` | string | yes | The exact shell command, run with `/bin/sh -c`. At most 4096 bytes, no NUL, no `~` (write the full path). Write the real commands here, never a script you or another agent wrote or can edit |
| `does` | string | yes | Plain words: what it changes on the machine |
| `why` | string | yes | Why the task needs it |

You send those three fields and nothing else; `request_id`, `url`, `editable` or `state` in your
file is refused. The machine service registers the request with its own root-owned sudo helper
first and adds `request_id`, `url` (the helper's private page) and `editable` (files named in the
command that an agent could change before it runs; the card warns the user about them). If the
helper is not installed, `card.js` exits non-zero with `machine refused card (503)` and
`sudo helper not installed on <machine>; the user installs it once with: sudo <root>/sudo-helper/install.sh`:
tell the user that in a reply and in a `needs` card. A helper refusal comes back as a `422`
with its sentence (for example `Write the full path; ~ would mean /root here`).

The card shows the command in full, `does` and `why`, and three controls while it is waiting:
**Open to run** (the user's password goes only into the helper's page, never the app), **Decline**
and **Talk about it**. Its states are `waiting`, `running`, `ran` (exit code and output, with a
note when the output was cut), `declined`, `expired` and `failed` (with the reason). The user
decides each time; do not ask twice for the same thing.

What reaches you, once per card (the output follows `ran` on the next lines):

- `[card <id>] sudo ran: exit <n>`
- `[card <id>] declined`
- `[card <id>] sudo expired`
- `[card <id>] sudo failed: <reason>`
- `[card <id>] talk about: sudo request`: the user wants to discuss it. Nothing ran and the card
  stays waiting; answer in a line and keep going.

The password is never in any of these.

### `reach`

Asks the user to let this thread's lead talk to the lead of a thread in another project. Only a lead posts it.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `thread` | string | yes | The other thread's id, from `session leads --all-projects`; a thread id, like `about_thread` on a `question` |
| `why` | string | yes | One line, in the user's terms, on why the leads should talk |

The user sees "Let this thread's lead talk to the lead of **<thread title>** (<last path segment of its project>)?", the `why`, and two buttons, **Allow** and **Don't allow**. One answer only; a second press is refused `card is already answered`. An open `reach` card counts in "Needs you". Only one `reach` card may be open per thread (`a reach request is already open`).

The hub refuses it at post time (422): `no such thread`, `that is this thread`, `that thread is on another machine`, `that thread is archived`, `that thread was handed off`, `already in your project; no OK needed`, `already allowed`, `a reach request is already open`.

What reaches you, once per card:

- `[card <id>] picked: allow`: the link exists; message that lead.
- `[card <id>] picked: don't allow`: drop it and say so in a line.
- `[card <id>] allow failed: <reason>`: the other thread went away before the press (reasons as above); nothing is linked. Drop it and say so in a line.

The link lasts until either thread is archived and works both ways: the other lead can message you back without a card of its own.

## The kinds never shown

### `retract`

Withdraws an open card that no longer applies. Unlike `resolve`, which records that the user
answered in chat, `retract` says the card is no longer relevant. It is never stored as a
card of its own.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `card` | string | yes | The target card's id: the one `card.js` printed when you posted it, or from the restart context |
| `note` | string | yes | One line saying why it was withdrawn |

Only a lead may retract, and any lead of the thread may retract an earlier lead's card.
The hub checks these refusals in order (422):

1. `no such card in this thread`: missing, in another thread, or replaced.
2. `only a question, offer, approval, needs, sudo, deferred or reach card can be retracted`.
3. `a system needs card closes itself`.
4. `card is already answered`: including a previous retraction, resolution or press; sudo
   cards are checked by state instead.

A sudo card can be retracted only while waiting; otherwise it is refused with
`the sudo request is already <state>`. The hub cancels its helper request before marking
it withdrawn. If the machine cannot be reached or returns an invalid status, the refusal
is `couldn't reach <machine> to cancel the sudo request; try again`. If cancellation finds
it already running or finished, the refusal gives that state and the outcome arrives as
usual. A successful sudo retraction sends no message to the lead. A cancelled request shows "Declined" on the helper page and cannot be run.

The target is marked answered with `retracted_at`, `retracted_by` and `retracted_note`;
it stays in the conversation, dimmed with "Withdrawn · <note>", stops waiting on the user,
and leaves the pin if pinned. Any later press is refused with `this card was withdrawn`.
Post a fresh card when it is needed again.

### `title`

Renames the thread. It is not stored and may be posted again when the name needs to change.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `title` | string | yes | The short thread name; it is trimmed and cut to 80 characters |

