# The graph format

A graph is what an agent draws when Collin asks how something works, or when a plan
proposes a flow worth seeing rather than just reading. This file is the only thing
either harness — the Claude skill and the Codex prompt — reads before that first write,
and it has to be enough on its own: get the schema wrong and the server refuses the
file; get the producer sequence wrong and nothing ever reaches a screen; get the
verdict rules wrong and an agent silently erases something Collin already ruled on.

## What a graph is, and isn't

Disposable. Each graph answers one question or carries one proposed flow inside a
plan, and it exists for the life of that plan or that question, not longer. Its job is
to hold node positions: Collin drags boxes around until the picture reads, and a graph
is what lets that arrangement survive past the turn it was drawn in. Nothing else needs
it to survive.

No agent reads a graph to learn how the system works, and none is written expecting to
still be true a month later. When a graph goes stale — the flow it describes has moved
on — it is discarded and redrawn from nothing, never patched back into truth. Treating
a graph as documentation is the mistake this rule heads off: a router is documentation;
a graph is a rearrangeable snapshot of one conversation.

A router — the durable per-directory `AGENTS.md`/`CLAUDE.md` that `protocol/routers.md`
defines — is a graph's preferred **input**, and never its output. Nothing in this
system generates a router from a graph. Drawing a graph from a router is a
**translation**, not an extraction, and translation is the expensive part of producing
one: a router is written for someone already standing inside that module, so its
compressions ("stays nonmetric", "recurrence stays symbolic") have to be unpacked for
someone who isn't. `protocol/diagrams.md` makes the identical argument about labels in
a Mermaid diagram, for the identical reason — a diagram, like a graph, exists for the
reader who is not already inside the code.

That is also why a node's `label` is plain-language behavior, never the router's or the
code's own vocabulary. "accept it as a real measurement, or refuse" is a label;
`AdmissionGate` is not, and neither is a router's own phrase for the same thing if that
phrase is a compression written for an insider. The source's precise wording — the
router's boundary phrasing, the docstring's exact term — goes in `note`, where a reader
who wants the original words can still find them.

## The schema

A graph is one JSON file:

```json
{
  "schema": 1,
  "title": "how a phrase about time becomes a date, or doesn't",
  "source": "router",
  "source_detail": "src/almanac/records/timeline/AGENTS.md",
  "nodes": [
    { "id": "gate", "label": "accept it as a real measurement, or refuse",
      "kind": "decision", "origin": "proposed", "was": null, "exclusive": true,
      "ref": "src/.../admission.py", "note": "Admission is a gate, not a coercion.",
      "graph": null, "x": 780, "y": 200 },
    { "id": "refuse", "label": "left as words — no number is invented", "kind": "note",
      "origin": "proposed", "was": null, "exclusive": false, "ref": null, "note": null,
      "graph": null, "x": 780, "y": 60 },
    { "id": "store", "label": "write it down, append-only", "kind": "step",
      "origin": "proposed", "was": null, "exclusive": false, "ref": "src/.../repository.py",
      "note": null, "graph": null, "x": 1020, "y": 200 },
    { "id": "time", "label": "work out when it happened", "kind": "step",
      "origin": "proposed", "was": null, "exclusive": false, "ref": "src/.../timeline/AGENTS.md",
      "note": null, "graph": "timeline", "x": 1260, "y": 200 }
  ],
  "edges": [
    { "id": "gate->store", "from": "gate", "to": "store", "label": "accepted",
      "kind": "data", "value": "an admitted temporal record", "inferred": false,
      "origin": "proposed", "was": null, "note": null },
    { "id": "gate->refuse", "from": "gate", "to": "refuse", "label": "refused",
      "kind": "sequence", "value": null, "inferred": false,
      "origin": "proposed", "was": null, "note": null }
  ]
}
```

Field by field:

- **`schema`** — always `1`. Anything else and the server refuses to serve the file
  (`unknown-schema`) rather than guess at an older shape.
- **`title`** — a plain sentence naming what the graph answers, shown at the top of the
  page. Must be a string; an agent's `PUT` that fails to supply one fails schema
  validation.
- **`source`** — one of `router`, `code-read`, `plan-proposal`. Shown on the page so a
  reader knows whether they're looking at something derived from a maintained document,
  from one agent's own pass over the code, or from a flow that doesn't exist yet. See
  "Where a graph's content comes from" below for how to pick.
- **`source_detail`** — a string naming where the content came from: the router's path
  when `source` is `router`, an account of what was read when it's `code-read`, or which
  plan question the proposal answers when it's `plan-proposal`. Nothing checks its
  shape the way `schema` and `source` are checked, but leaving it empty defeats the
  entire point of the `source` field — a "router" claim with nothing pointing at the
  router is unverifiable. Always fill it in.
- **`id`** (node and edge) — non-empty and unique within its own collection (nodes and
  edges are separate namespaces). Missing, empty, or duplicated draws `bad-id`. Ids are
  permanent once a verdict lands on them — see Verdicts below — so pick one you'd be
  fine seeing again in six months, not `n1`.
- **`label`** — plain-language behavior, per "What a graph is" above. The one field with
  **no default**. Omit it and the server refuses the whole write with `missing-label`,
  naming the offending id — a missing label is a refusal, never a silent repair.
- **`kind`** (node) — one of `file`, `module`, `step`, `decision`, `external`, `note`.
  It is metadata, rendered as a text tag on the box, and it drives no shape. The server
  checks every entry against that list and refuses anything else with `bad-kind`, naming
  the offending id — a typo here is a write-time failure, not just a worse tag. Omitting
  `kind` is not a typo: it still defaults to `note`, same as before.
- **`origin`** — one of `proposed`, `agreed`, `rejected`, checked against exactly that
  set (`bad-origin-value` otherwise). See Verdicts below; an agent never sends anything
  but `proposed` for content it is introducing.
- **`was`** — `null` on every entry except one an agent has just reset from `agreed`,
  where it is the string `"agreed"`. Also covered under Verdicts.
- **`exclusive`** (node only) — `true` means exactly one outgoing edge is taken, and the
  node renders as a fork: each outgoing edge labels itself `if <label>`, plus its
  payload where it has one. `false` (the default) means every outgoing edge fires.
  This is **declared, never inferred** — the same reasoning that makes an edge's
  default `kind` the weaker `sequence` rather than `data`: an agent that cannot tell
  which is true asserts the weaker claim, not the stronger one. A node with two
  outgoing edges and `exclusive` left `false` renders as "then both," not "then
  either" — get this backward and the picture is silently wrong, because nothing about
  the JSON's shape flags it.
- **`ref`** — a repo-relative path, no line number, `null` for a node with no single
  file behind it (a conceptual step, an external system). No line number for the same
  reason a router carries none: a line shifts on the next edit, and a graph that lies
  about where to look is worse than one that says nothing.
- **`note`** — the source's own precise wording: the router's exact phrasing, the
  docstring's exact term. This is where the vocabulary that doesn't belong in `label`
  goes, so the reader who wants it can still find it. `null` when there's nothing to
  quote.
- **`graph`** (node only) — names a **child graph**, or is `null`. The value is a bare
  name matching `^[a-z0-9_-]+$` — never a path, never `..` — and resolves to
  `<name>.json` in the **parent graph's own directory**. Anything else draws
  `container-bad-name`. The named file doesn't have to exist yet: proposing a container
  node for a child you haven't drawn is legal, and only the shape of the name is
  checked at this point. This is the only join between a name and a path anywhere in
  the format; every route the server exposes is keyed by full path, precisely because
  one server serves graphs from many repos and a bare name like `main` is ambiguous on
  its own. See "Containment across files" below for what a container node may and may
  not do.
- **`kind`** (edge) — `data` when something moves along the edge, `sequence` when it's
  only ordering. Default `sequence`, the weaker claim, for the same reason `exclusive`
  defaults to `false`: an agent that cannot tell which kind an edge is should not assert
  the stronger one. The server checks this set too — anything outside `data`/`sequence`
  draws the same `bad-kind` refusal as an out-of-set node `kind`.
- **`value`** (edge) — names what a `data` edge carries. `null` for a `sequence` edge or
  a `data` edge with nothing worth naming yet.
- **`inferred`** (edge) — `true` when `value` was reconstructed rather than read
  verbatim from the source. Once a person confirms what an edge carries, the entry
  responsible for that is `origin`, not `inferred` — this flag only ever describes
  whether the *agent* stated or guessed the payload.
- **`from` / `to`** (edge) — must each name a node's `id` present in the same file. A
  dangling reference draws `edge-missing-node`. **Edges connect siblings only**: a
  relationship that spans two levels of containment is drawn at whichever level both
  ends are actually visible, never by reaching an edge into a child graph.
- **`x` / `y`** (node) — integer pixel coordinates. See "On the wire" below — an agent
  never sends these.

Target size is **10–25 nodes**. Landing outside that range on the high end means the
question was too broad; split it into another file in the same directory rather than
crowding one graph past the point Collin can read it.

## Key order and canonical form

The file on disk is byte-canonical, always. Top-level keys, in this exact order:
`schema`, `title`, `source`, `source_detail`, `nodes`, `edges`. Node keys: `id`,
`label`, `kind`, `origin`, `was`, `exclusive`, `ref`, `note`, `graph`, `x`, `y`. Edge
keys: `id`, `from`, `to`, `label`, `kind`, `value`, `inferred`, `origin`, `was`, `note`.

**Every key is present on every entry**, `null` or `false` where it doesn't apply. An
omitted key and a null one would serialize identically otherwise, and byte-identity —
re-serializing an already-canonical file must produce the same bytes — needs one
answer, not two that happen to look alike.

Two-space indent, `nodes` and `edges` each sorted by `id`, one trailing newline, `x`/`y`
always integers (rounded half-up).

**This describes what lands on disk, not what you have to send.** The server
canonicalizes: your `PUT` body can have keys in any order, can omit anything that has a
default, and never needs sorting or reindenting. What you're required to get right is
the *shape* — the fields the server actually checks — not the formatting.

Defaults applied when canonicalizing a body that omits a key: node `kind` → `"note"`,
`origin` → `"proposed"`, `was` → `null`, `exclusive` → `false`, `ref`/`note`/`graph` →
`null`. Edge `kind` → `"sequence"`, `value` → `null`, `inferred` → `false`, `origin` →
`"proposed"`, `was` → `null`, `note` → `null`. **`label` has no default** — omit it and
the write is refused, not repaired.

Given that, the minimal legal node you can send is just `{"id": "gate", "label":
"accept it as a real measurement, or refuse"}` — everything else defaults. The same
goes for edges, plus `from`/`to`, which have no default because an edge to nowhere is
not a valid edge.

**On the wire, an agent omits `x` and `y` entirely** — not sends them as `null`, leaves
the keys out of the object. The every-key rule above governs the canonical file on
disk; it says nothing about what you send. The server keeps the position it already has
on disk for any id it recognizes, and lays out any id it doesn't by breadth-first
layering from whatever has no incoming edge. Positions are Collin's to set by dragging;
sending them at all would be asserting a value you have no authority over, even though
the server will simply discard whatever you send in favor of disk.

## Where a graph's content comes from

Recorded in `source`, in this order of preference: a router covering the feature, if
one exists. Failing that, a direct read of the code, marked `code-read`. Graphify —
the whole-repo knowledge graph — is never itself a `source` value; it earns a role only
for what a router can't answer at all: blast radius, distance between two far-apart
concepts, community structure. Every graphify result has to be confirmed against the
actual source before it becomes a node, and once confirmed it's recorded as `code-read`
like any other direct read — graphify is a way of finding candidates, never a way of
skipping the read. A missing router changes the label on the graph, not whether the
answer is trustworthy: a graph is disposable by design, so a direct read is exactly as
trustworthy as this format needs.

`plan-proposal` is different in kind, not just in confidence: it's a flow that doesn't
exist in the code yet, proposed inside a plan's discussion. Nothing to read, nothing to
confirm — that's what the value says on its face.

## Where graph files live

A plan's graphs are committed: `docs/plans/<slug>/graphs/<name>.json`. A question's are
not: `<cache-root>/<repo-key>/<slug>/<name>.json`, where `<cache-root>` defaults to
`~/.cache/agent-graphs`. That default is a directory, not a single file, because a
question graph needs somewhere to put a child graph opened from a container node.

A plan's `graphs/` directory has no fixed entry filename — a plan with one flow might
hold only `graphs/checkout.json`, and a plan with two independent flows just holds two
files side by side, neither referenced by the other's `graph` field: two flows are two
pictures, not one nested under the other. A question is different: its entry graph is
always named `main.json` — `<slug>/main.json` — because a question, unlike a plan, has
no other name for its own top-level file to be found by.

A plan's slug already exists — it's the plan's own. A question has none yet, so `/graph`
derives one from the question text: lowercase it, collapse every run of
non-alphanumeric characters to a single hyphen, trim leading and trailing hyphens,
truncate to 40 characters, then trim a trailing hyphen the truncation may have left.
"How does the timeline admission gate decide what to keep?" becomes
`how-does-the-timeline-admission-gate-dec`. `planning.md` asks only for "a
short kebab-case slug" for a plan; this is the concrete rule for a question, stated here
because the question path never goes through `planning.md` at all.

`<repo-key>` is the repo's directory basename plus a hyphen plus the first eight hex
characters of a SHA-256 hash of the absolute repo path — a repo called `orchard` at
`~/src/orchard` becomes something like `orchard-3f2a91c0`. The hash is there because two worktrees of the same
repo share a basename; without it, a question asked from one worktree could collide with
one asked from another.

If a question's slug already names an existing file, and that file holds only
`proposed` entries, overwrite it — question graphs are disposable, and a rerun of a
similar-sounding question is not required to reuse anything. If it holds any `agreed` or
`rejected` entry, the write fails exactly like any other write that would drop a
verdict; pick a different slug rather than fighting the refusal.

## Writing a graph

This is the part nothing else states, so it's stated here as commands, not description.
You are reading this file at an absolute path — `<root>/protocol/graphs.md` — so you already
know where this workflow is checked out. The commands below use `$WHEELCHAIR` for that root; set it
from the path you read this file at, dropping the trailing `/protocol/graphs.md`:

```bash
WHEELCHAIR=<the root you resolved>       # the directory holding protocol/, viewer/ and spine/
```

Everything below assumes you are writing a fresh graph.

**1. Start the server detached, then read the URL back out of its output.** The first
`--open` against a cache root *is* the server: it binds the port and sits there handling
requests, so the command that started it never returns. Every later `--open` against
that same cache root instead finds a server already running, prints the identical shape
of URL, and exits in a tenth of a second. Nothing about the command line tells you in
advance which of those two this call is going to be, so never run it in the foreground
and wait for it to finish — background it unconditionally and recover the URL from its
output instead. The same recipe below completes either way:

```bash
LOG=$(mktemp)
node "$WHEELCHAIR/viewer/server.js" \
  --open "$PWD/docs/plans/some-plan/graphs/checkout.json" \
  > "$LOG" 2>&1 < /dev/null &
disown 2>/dev/null || true

for _ in $(seq 1 100); do
  grep -q '^http' "$LOG" && break
  sleep 0.1
done
URL=$(grep '^http' "$LOG") || { echo "server never printed a URL:"; cat "$LOG"; exit 1; }
echo "$URL"
```

It accepts a path whose file doesn't exist yet, and creates the parent directory for you
either way. The line it prints carries the port and the token:

```
http://127.0.0.1:7373/?path=%2Fhome%2Fcollin%2F...%2Fcheckout.json&token=9f3a...
```

Print that URL to Collin. You still need the token and port again for the `PUT` below;
either parse them back out of that URL, or read them from the lockfile directly:

```bash
node -e "const c = JSON.parse(require('fs').readFileSync(process.env.HOME + '/.cache/agent-graphs/.server')); console.log(c.token, c.port)"
```

That file (`<cache-root>/.server`) is JSON with four keys: `pid`, `port`, `token`,
`start_id`. Only `token` and `port` matter here.

**2. `PUT` the graph.** `hash` is mandatory on every write. Send `""` when you believe
the file doesn't exist yet — the server accepts an empty hash only when the file is
genuinely absent, so this is safe exactly once, on a real create:

```bash
PORT=7373
TOKEN=9f3a...   # from step 1
GRAPH_PATH="$PWD/docs/plans/some-plan/graphs/checkout.json"   # the plan lives in the repo you are working in
PATH_ENC=$(node -e "console.log(encodeURIComponent(process.argv[1]))" "$GRAPH_PATH")

curl -sS -X PUT "http://127.0.0.1:${PORT}/graph?path=${PATH_ENC}" \
  -H "X-Graph-Token: ${TOKEN}" \
  -H "Origin: http://127.0.0.1:${PORT}" \
  -H "Content-Type: application/json" \
  --data-binary '{"hash": "", "graph": {"schema": 1, "title": "...", "source": "code-read", "source_detail": "...", "nodes": [...], "edges": [...]}}'
```

`Origin` must equal the server's own address exactly — not omitted, not
`localhost`. A successful write responds `{"hash": "<new>"}`; keep that hash if you
intend to write this same file again in the same turn.

**3. Show it.** The graph exists now, so put it in front of Collin rather than leaving him to
click a URL out of your turn:

```bash
node "$WHEELCHAIR/viewer/server.js" --show "$GRAPH_PATH"
```

This is a separate step from `--open` and the order matters: `--open` runs *before* the graph is
written, so opening a browser there would show an empty page. `--show` runs after the write.

It opens nothing when a tab is already on that graph — the server knows, because a live page polls
it every second — so redrawing the same graph turn after turn will not stack up windows. The open
tab picks up your new version on its own poll. Still print the URL in your turn; the browser is a
convenience, not the record.

`--no-browser`, or `WHEELCHAIR_NO_BROWSER=1` in the environment, suppresses the launch for a
headless box or an SSH session. The launch is best-effort either way: a machine with no handler
prints the URL and carries on, and never fails a write that already succeeded.

**Every node and edge you introduce must carry `origin: "proposed"`** (or omit it,
since that's the default). The server checks this on every write — any id that's new,
or that was `proposed` on disk, must arrive `proposed` — and refuses with
`agent-verdict` otherwise. An agent proposes; only a person, dragging in the browser,
promotes something to `agreed` or `rejected`.

**A `409` response means disk moved since the hash you sent.** Its body carries the
current hash. `GET` the graph again (see below), recompute whatever change you were
making against that fresh copy, and `PUT` again with the hash it just gave you. Never
retry by resending the same stale body with a corrected hash — the graph itself may
need to change too, if the entries you were touching moved underneath you.

Rewriting an existing graph — not creating one — is otherwise the same `PUT`, with two
constraints described fully under Verdicts below: every `rejected` entry must reappear
byte-identical (aside from position), and every `agreed` entry must reappear
byte-identical or be reset to `proposed` with `was: "agreed"`.

**Writing a child graph needs no separate `--open`.** Once a node's `graph` field names
a child inside a parent that's already registered, the child's own path becomes
writable the moment anything asks for it — the server derives this from the parent
file itself, by walking every registered graph's nodes for a `graph` value matching the
requested file's name. `PUT` straight to `<the parent's directory>/<name>.json`, with
`hash: ""` if you're creating that child for the first time.

## Reading a graph back

```bash
curl -sS "http://127.0.0.1:${PORT}/graph?path=${PATH_ENC}&token=${TOKEN}"
```

returns `{"hash": "...", "graph": {...}, "children": {"timeline": true}}`. `children`
maps every non-null `graph` value found in the file to whether that child's file
currently exists — it's computed for the page's benefit and is never itself written to
disk.

**Whichever producer wrote a graph reads it back before its next turn on the same
subject.** For a plan, that's the re-read `protocol/planning.md` requires before
composing each question. For a question, `/graph` records the file it wrote, and the
next turn on that question reads it first. This rule lives here, not in
`planning.md`, because the question path never goes through `planning.md` at all —
stating it only in the planning stage document would leave the question path with no
read-back rule whatsoever.

## Verdicts and the preservation contract

Every node and edge carries `origin`, one of three values:

| Value | Meaning |
|---|---|
| `proposed` | An agent drew it; nobody has ruled on it |
| `agreed` | Collin confirmed it |
| `rejected` | Collin struck it |

**`agreed` is a verdict at a point in time, not a lock.** An agent may alter an entry
Collin approved when the flow it describes has genuinely changed — doing so resets that
entry's `origin` to `proposed` and sets `was: "agreed"` on it, and the turn that made
the change names every entry it reset and why. The `was` field is what makes the reset
durable: the graph file is the state and the conversation is disposable, so a report
that lives only in the turn leaves a session that resumes later with no way to tell a
freshly reset entry from one nobody has ever ruled on. A person ruling on it again — in
the browser — clears `was` back to `null`.

Without this, a graph freezes solid. Bulk-approving everything on screen is the normal
gesture, so after one select-all every entry is `agreed`; with no reset path, a flow
that gets superseded ten questions later could be neither corrected nor removed, and the
picture would just go quietly wrong with no way back.

**`rejected` is absolute.** An agent may never alter a rejected entry, never delete one,
and never reuse its id for a new proposal — "previously rejected" is decided by **id**,
never by resemblance, because ids are stable from creation and a genuinely different
proposal earns a genuinely different id. A rejected entry stays in the file, rendered
struck through on the page, forever: deleting it gives the next agent no record, and the
same thing gets proposed again next turn.

**An `agreed` entry may be removed only after its reset has landed** — that is, only once
it already carries `origin: "proposed", was: "agreed"` on disk. Trying to drop an
`agreed` entry outright, without that intermediate step ever having landed, is refused
(`preservation-agreed`); trying to alter it without resetting it is refused the same way.
Trying to drop or alter a `rejected` entry is refused as `preservation-rejected`. This
makes a superseded flow disappear in two visible writes rather than one invisible one —
the reset is a fact Collin (or the next agent) can see before the entry is finally gone.

None of this touches `proposed` entries: an agent may add, change, or remove those
freely, since nobody has ruled on them yet.

## Containment across files

A node's `graph` field names a child, and everything above about preservation extends
across that boundary: an agent may not remove a container node whose child holds any
`agreed` or `rejected` entry **anywhere in its subtree** — not just directly inside the
child, but in any graph reachable from it — nor retarget that node's `graph` field away
from that child to something else or to `null`. A one-level check would let removing a
container silently orphan a grandchild's verdicts; the check is recursive precisely so
that can't happen.

The exception is `null` → a name: always allowed, because there's no old subtree to
orphan when there wasn't one before. Likewise, a container currently naming a **missing**
child — the file that `graph` points at doesn't exist — may be retargeted freely, since
pointing away from a file that isn't there orphans nothing.

## Depth and cycles

**Traversal — the re-read before each question, the exit-gate walk, this format's own
read-back — is depth-bounded at 5 and reports rather than recurses if it hits that
bound.** A hand-edited graph file can contain a containment cycle the server's own
write-time check never saw, since nothing stops someone editing JSON by hand; a
traversal that didn't stop somewhere would spin forever on that file. Five is generous
for anything this format is meant to hold — a graph nesting five levels deep is already
past what 10–25-node files should need.

**The server refuses a cycle at write, but does not refuse depth.** Containment carries
no back-reference — a child file has no idea which parent or parents name it — and more
than one parent may legally name the same child, so a write to a graph in the middle of
a tree cannot know its own depth from any root; there is no root it can walk up to. It
can, however, detect that accepting this write would make itself reachable from itself,
and that it refuses unconditionally. A write that legitimately nests seven files deep is
accepted; a write that would close a loop is not, regardless of depth.

## What the server refuses

Every non-2xx response is `{"error": "<code>", "detail": "<one sentence>"}`, plus `ids`
when the refusal names particular entries. These are the codes a `PUT /graph` can
actually hit, in the rough order the server checks them:

| Status | Code | When |
|---|---|---|
| 400 | `bad-path` | `path` is missing, relative, or doesn't end in `.json` |
| 400 | `bad-body` | the body isn't JSON, or has no `graph` object or no `hash` string |
| 401 | `bad-token` | the token is missing or wrong |
| 403 | `bad-origin` | `Origin` is missing or doesn't match the server's address |
| 403 | `not-registered` | this path isn't in the writable set and isn't derivable from a graph that is |
| 409 | `stale` | the hash you sent doesn't match what's on disk; the body carries the current one |
| 422 | `unknown-schema` | `schema` isn't `1` |
| 422 | `missing-label` | a node or edge has no `label` |
| 422 | `bad-kind` | a node's `kind` is outside `file`/`module`/`step`/`decision`/`external`/`note`, or an edge's is outside `data`/`sequence`. A missing `kind` is not this — it defaults instead |
| 422 | `bad-id` | an id is missing, empty, or duplicated |
| 422 | `edge-missing-node` | an edge names a `from`/`to` id that isn't in this file |
| 422 | `bad-origin-value` | an `origin` outside `proposed`/`agreed`/`rejected` |
| 422 | `container-bad-name` | a `graph` value that isn't `null` and isn't `^[a-z0-9_-]+$` |
| 422 | `agent-verdict` | you set `agreed`/`rejected` on an entry that's new or was `proposed` on disk |
| 422 | `preservation-rejected` | a `rejected` entry was dropped, altered, or its id reused |
| 422 | `preservation-agreed` | an `agreed` entry was dropped without a landed reset, or altered without resetting |
| 422 | `bad-was` | `was` carries a value this write isn't allowed to set |
| 422 | `container-cycle` | this write would make some file reachable from itself through `graph` fields |
| 422 | `container-orphan` | removing or retargeting a container would strand a subtree holding a verdict |
| 422 | `container-unreadable-child` | that subtree walk hit a child file that doesn't parse, so it can't be shown to hold no verdicts. Repair the child by hand; the server never repairs one |
| 500 | `internal` | anything unhandled |

Four codes exist that a `PUT /graph` will never produce: `not-found` and `no-route`
belong to reads and to unknown routes (this route can create, so a missing file is
never an error here); `structural-difference` and `bulk-not-additive` police the page's
own write route, `PUT /view`, which no agent ever calls. `invalid-json` is a serving
refusal — it fires when a `GET` finds a file on disk that some hand-edit broke — and
matters to the read-back rule above, not to writing: if your read-back hits it, the
file is corrupt independent of anything you wrote, and no `PUT` will fix it. Report it
rather than trying to repair it.
