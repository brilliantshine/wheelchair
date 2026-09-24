# Delegation lanes

How every stage in this workflow spawns a subagent. Stage docs reference this file
instead of repeating invocations.

**Use the Codex CLI headless for GPT lanes. Do not use async-subagents or raw `pi` for
this workflow** — even though global guidance prefers them for general delegation. This
workflow is deliberately built on `codex exec` so both harnesses drive the same binary
and lanes are inspectable with plain shell. That is an intentional override; don't
"correct" it back to the pi runtime.

## `WHEELCHAIR_LANE=1` on every lane

Every invocation below runs with `WHEELCHAIR_LANE=1` set in its environment. A headless
`codex exec` or `claude -p` call runs on the user's own login, so the user-level wheelchair
hook (`seen/hook.sh`, `protocol/seen.md`) fires inside it exactly as it would on an
ordinary message — unmarked, a lane's own turns would reset the reader's gap clock, spend a
one-time wording-change notice where nobody reads it, and carry the wording list into a
worker. Claude Code's own lanes — the in-process Agent tool — need no marker: they never
pass through a shell the hook could see, and the hook ignores them by their `agent_id`
instead.

## What "present" means

A family is present when its command resolves on `PATH`: `claude` or `codex`. Presence is
never inferred from a home directory existing: an installed tool may not have made one yet,
and an uninstalled one may have left one behind. Nothing is declared by hand. A stage already
running inside a harness may assume its own family is present; it only checks the other family.

`WHEELCHAIR_PRESENT` is a testing seam. When it is set, including to the empty string, it
replaces the `PATH` check with its comma-separated list of commands; production never sets it.

## GPT lane — `codex exec`

Blocking and headless. Long briefs go in a file and pipe through stdin. Capture the
final message with `-o` and the session id from the `--json` stream, so the lane can be
resumed later:

```bash
BRIEF=$(mktemp) OUT=$(mktemp) LOG=$(mktemp)
# ... write the brief to $BRIEF ...
WHEELCHAIR_LANE=1 codex exec -m gpt-5.6-sol -c model_reasoning_effort=high \
  -s read-only -C "$PWD" --json -o "$OUT" - < "$BRIEF" > "$LOG" 2>&1
RC=$?
TID=$(grep -m1 -o '"thread_id":"[^"]*"' "$LOG" | cut -d'"' -f4)
cat "$OUT"   # the report — parse this, not the event stream
```

`CODEX_HOME` stays unset: lanes share the user's ordinary codex login, and an existing user
setting remains theirs. Before the first GPT dispatch of a session, run the preflight — see
"Credentials — single account" below. The explicit
`-c model_reasoning_effort=high` belongs on every GPT lane.

`RC` and `TID` both matter: a non-zero `RC` means the lane died and `$OUT` may be empty
or truncated, and `TID` is the only handle for resuming it. Record the thread id in the
plan doc next to the task it ran.

- `-m` — three implementation tiers. Pick by **how much the lane has to decide**, not by
  how big the task looks:
  - `gpt-5.6-luna` — *transcription*. The brief names the files, the change, and the
    pattern to copy; the lane invents nothing. "Change these six call sites to the new
    signature." "Write tests for this function covering the cases listed." The test:
    could you have written the diff yourself and simply didn't want to type it?
    Second gate — **narrow context**. Luna's long-context recall collapses (41.3% MRCR
    against Sol's 91.5%), so a forty-file sweep is a Terra brief no matter how mechanical
    each individual edit is. Mechanical *and* small, or it moves up.
  - `gpt-5.6-terra` — *everything else*, and the default when the tier is arguable. Any
    brief where the lane picks the shape: where a thing lives, what an interface looks
    like, how to handle a case the plan didn't name.
  - `gpt-5.6-sol` — judgment lanes (planning, plan review, verification). It reaches
    implementation only as an escalation ("Escalate the model only on evidence" below).

  Reasoning effort **does** need a flag at dispatch. `~/.codex/config.toml` may set
  `model_reasoning_effort = "high"`, but a lane must not depend on that being true on a given
  machine — a missing setting falls back to the model's default while appearing to work.
  Passing the flag where the config already agrees costs nothing.
  Pass `-c model_reasoning_effort=high` on every lane. High is the floor, not
  the ceiling —
  `-c model_reasoning_effort=xhigh` is the escalation rung below a tier change, and 5.6
  `xhigh` is genuine wire-level xhigh (verified). Anything *below* high is a downgrade;
  don't pass one unless you mean it.
- `-s` — `read-only` for plan reviewers, `workspace-write` for implementers and for
  verifiers that must run a test suite.

  **`workspace-write` alone cannot bind a localhost port**, so add
  `-c sandbox_workspace_write.network_access=true` to any lane that runs a suite. Every server
  test in `viewer/` starts a real server, and a headless browser starts one too, so without
  this the suite dies on `listen EPERM: operation not permitted 127.0.0.1` — or, for Chromium,
  on `sandbox_host_linux.cc ... Operation not permitted` before a single test body runs.
  Verified both ways on one repo: the same brief failed that way without the flag and ran the
  full suite with it. The failure names the sandbox rather than the code, but a lane that hits
  it reports *no* validation, so its "completed" is a claim with nothing behind it — re-run the
  suite yourself before believing either the pass or the failure.
- `-C` — the target repo. Add `--skip-git-repo-check` only outside a git repo.
- `-o FILE` — the final message. Always read this file; never scrape stdout.
- `--json` emits JSONL events if you need to watch progress; the last message still
  comes from `-o`.

Run lanes in a **background** Bash call so a foreground timeout can't kill them.

**Continuation** — the remediation and closure-review path:

```bash
WHEELCHAIR_LANE=1 codex exec resume "$TID" -m "$MODEL" -c model_reasoning_effort=high \
  -c sandbox_workspace_write.network_access=true \
  -o "$OUT2" "<follow-up>"
```

The network flag is in that line because a resume drops it (below) and because remediation and
closure review are the resumes that run suites. It is inert on a lane that isn't writing.

`-m` repeats the model the lane already ran — Terra for an implementation lane, Sol for a
reviewer or verifier. A resume is not the moment to change tier: escalating mid-thread
hands the bigger model a context full of the smaller one's dead ends. Escalate by starting
a fresh lane on a rewritten brief.

`resume` takes **no `-s` and no `-C`** — passing them is a usage error that exits 2. It
inherits the sandbox mode and working directory from the recorded session (verified: a
`workspace-write` lane resumes still able to write, in the same repo). `--last` picks
the newest session instead of an explicit id, but is unsafe once several lanes have run.

**It does not inherit `-c` overrides, though — repeat every one of them on the resume.** The
sandbox *mode* carries; the config that tunes it does not. Verified for
`sandbox_workspace_write.network_access` on one thread: three resumes without it failed to bind
a localhost port, and the same thread with it repeated bound immediately. Whether
`model_reasoning_effort` behaves the same way was not tested and is hard to observe from
outside — which is the reason to repeat it rather than find out. The continuation block above
already does, and that is the safe default for any `-c` flag: state it again, since a dropped
one fails silently in both directions.

This is the quiet one, because a resumed lane that has lost its network access still produces a
confident report — it simply has no test run behind it. A closure review is exactly where that
matters, since the whole question is whether remediation held.

Start a fresh lane instead of resuming when the role changes or the contract materially
changed.

## Claude lane

From Claude Code: the Agent tool (`model: sonnet` for workers, default for reviewers).
From Codex: `WHEELCHAIR_LANE=1 claude --model sonnet -p "<brief>"`, or plain
`WHEELCHAIR_LANE=1 claude -p` for review lanes.

For UI/frontend implementation and taste-sensitive surfaces, see
`protocol/implementation.md`; it owns the placement rule.

Sonnet runs every Claude implementation lane, transcription work included; Opus reaches
one only as an escalation, by the same rule as Sol. The Claude side is two tiers, not
three — work that would go to Luna on a GPT lane stays on Sonnet here rather than dropping
to Haiku. The Luna tier is a codex-lane thing.

## When a lane returns nothing

Dispatch reports a dead lane when `codex exec` exits non-zero, when its `-o` file is empty, or
when a Claude agent returns no report. Report which lane died and what it said. This file owns
that detection and report because they are part of dispatching; the stage documents own what
their stages do next. Do not look here for rules about findings, verdicts, rounds, retries, or
fallbacks.

A lane that reports it is not authenticated is different: the tool stated its own condition;
it is not an inference from a dead lane. On the GPT side, that includes `no Codex credentials
were found`, `Run codex login`, and `token could not be refreshed. Please log out and sign in
again`. Claude has no equivalent quotable string, so the rule remains family-neutral. The stage
documents, not this one, say what follows from an authentication report.

## Rules that apply to every lane

- **Never two write-lanes in one checkout.** Concurrent writers sweep each other's
  in-progress files even with disjoint scopes. Parallelize only across separate git
  worktrees; otherwise sequence.
- **Escalate the model only on evidence.** The ladder is `luna → terra → sol` on the GPT
  side and `sonnet → opus` on the Claude side, one rung at a time, and a rung is bought
  only by a lane that **already came back wrong** — it ignored the brief's ownership
  boundary or validation commands, claimed a completion the diff contradicts, or hit the
  fails-twice guardrail. "This task looks hard" is not evidence. A task you *expect* to be
  hard just starts at Terra; that is a tier choice at dispatch, not an escalation.

  Three moves, in this order: **rewrite the brief → raise effort to `xhigh` → change
  tier.** Rewriting is first because a lane that failed against a vague success bar fails
  the same way with more reasoning behind it, only harder and at 2–3x the cost. The tier
  change is last because it is the rung that actually spends the single account's quota.
  Every lane is dispatched at `high` by the mandatory flag above, so the effort rung is
  `high → xhigh` and it exists only once the brief is already tight. Escalate in a fresh lane on the rewritten brief rather
  than resuming — a resume hands the next rung a context full of the last one's dead ends.
  Record the rung and the reason next to the task in the plan doc.
- **A finished lane is a claim, not a fact.** Re-run its validation and read the diff
  yourself. Sol fabricates completions at a documented rate and nothing establishes Terra
  or Luna is better — demand pasted command output in every deliverable and check the
  claimed file state. The cheaper the tier, the more literally this applies: a Luna brief
  that turned out to need a decision is exactly where you get confident, wrong work.
- **Tighten the brief before anything else.** Sol games vague success bars, and reasoning
  it harder games them harder at higher cost — which is why every lane is dispatched at
  `high` and the brief, not the effort dial, is the lever.
- **A GPT lane grinds; it does not course-correct.** Put a fails-twice guardrail in every
  implement brief: *"if the same gate fails twice, stop and report rather than
  iterating."* Your review loop is its only course correction.
- **Judge GPT output by evidence, not prose.** Sol reads polished regardless of depth —
  parse the `SEVERITY`/`GAP` lines and the pasted evidence, ignore the fluency.

## Credentials — single account

There is **one** ChatGPT account, its refresh token is single-use — spending it mints a
replacement and voids the one spent — and `codex exec` takes no lock on `auth.json`. codex
refreshes only when a request comes back 401 after the access token expires (verified against
the retired balancer's design notes: access tokens live ~10 days and codex has no proactive
refresh). So the race is not "two lanes at once"; it is "two lanes at once **while the token
is expired**" — both spend the same refresh token, the loser writes back a dead credential,
and the account bricks. A copy of a credential is not a second credential — it is a second
claim on a one-shot ticket — so per-lane copies of `auth.json` make this worse, never better.

Concurrency is safe exactly when no lane can cross the expiry boundary mid-run. The preflight
makes that true at dispatch:

```bash
<wheelchair-root>/codex/preflight.sh
```

Under a lock it reads the token's remaining life; with more than the margin left (24h by
default — it only needs to exceed the longest lane) it does nothing, otherwise it performs the
refresh itself, one process, persisted atomically before the lock releases. Run it **before
the first GPT dispatch of a session and before any parallel fan-out**. Its exit code is the
dispatch rule:

- `0` — fan out freely.
- `1` — transient refresh failure (network, 5xx). **Sequence GPT lanes this session**; the
  token may expire mid-session and sequencing is the only thing that makes a mid-run refresh
  single-spender.
- `2` — the refresh token itself was rejected. No lane will authenticate; stop and report.
  Recovery is `codex login --device-auth` headlessly, or the browser flow at a desk. (The
  browser flow runs `codex logout` first and cannot complete over SSH, so a failed attempt
  leaves things strictly worse off.)

Never copy `auth.json` or an auth directory to give a lane "its own" credential, and never run
`codex login` while lanes are in flight — both are second claims on the one-shot ticket.

The preflight's own refresh exchange (near-expiry branch) is ported from the retired
balancer's `codex-oauth.ts` but has not yet been exercised against a live near-expiry token;
its fresh-token, missing-auth, and rejected-token branches are verified.
