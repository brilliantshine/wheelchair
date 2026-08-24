# Delegation lanes

How every stage in this workflow spawns a subagent. Stage docs reference this file
instead of repeating invocations.

**Use the Codex CLI headless for GPT lanes. Do not use async-subagents or raw `pi` for
this workflow** — even though global guidance prefers them for general delegation. This
workflow is deliberately built on `codex exec` so both harnesses drive the same binary
and lanes are inspectable with plain shell. That is an intentional override; don't
"correct" it back to the pi runtime.

## GPT lane — `codex exec`

Blocking and headless. Long briefs go in a file and pipe through stdin. Capture the
final message with `-o` and the session id from the `--json` stream, so the lane can be
resumed later:

```bash
BRIEF=$(mktemp) OUT=$(mktemp) LOG=$(mktemp)
SLOT=~/.bravo/codex-auth-balancer/accounts/1
# ... write the brief to $BRIEF ...
CODEX_HOME="$SLOT" codex exec -m gpt-5.6-sol -c model_reasoning_effort=high \
  -s read-only -C "$PWD" --json -o "$OUT" - < "$BRIEF" > "$LOG" 2>&1
RC=$?
TID=$(grep -m1 -o '"thread_id":"[^"]*"' "$LOG" | cut -d'"' -f4)
cat "$OUT"   # the report — parse this, not the event stream
```

`CODEX_HOME` points at the **balancer's slot directory**, not at `~/.codex` and not at a copy
of either. See "Credentials" below — this is the only safe form on a single account, and the
explicit `-c model_reasoning_effort=high` is mandatory because of it.

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

  Reasoning effort **does** need a flag at dispatch. `model_reasoning_effort = "high"` lives
  in `~/.codex/config.toml`, and lanes run with `CODEX_HOME` pointed at the balancer's slot
  directory, which has no `config.toml` — so the global default is not read and a lane silently
  falls back to the model's own default while appearing to work. Pass
  `-c model_reasoning_effort=high` on every lane. High is the floor, not the ceiling —
  `-c model_reasoning_effort=xhigh` is the escalation rung below a tier change, and 5.6
  `xhigh` is genuine wire-level xhigh (verified). Anything *below* high is a downgrade;
  don't pass one unless you mean it.
- `-s` — `read-only` for plan reviewers, `workspace-write` for implementers and for
  verifiers that must run a test suite.
- `-C` — the target repo. Add `--skip-git-repo-check` only outside a git repo.
- `-o FILE` — the final message. Always read this file; never scrape stdout.
- `--json` emits JSONL events if you need to watch progress; the last message still
  comes from `-o`.

Run lanes in a **background** Bash call so a foreground timeout can't kill them.

**Continuation** — the remediation and closure-review path:

```bash
codex exec resume "$TID" -m "$MODEL" -o "$OUT2" "<follow-up>"
```

`-m` repeats the model the lane already ran — Terra for an implementation lane, Sol for a
reviewer or verifier. A resume is not the moment to change tier: escalating mid-thread
hands the bigger model a context full of the smaller one's dead ends. Escalate by starting
a fresh lane on a rewritten brief.

`resume` takes **no `-s` and no `-C`** — passing them is a usage error that exits 2. It
inherits the sandbox mode and working directory from the recorded session (verified: a
`workspace-write` lane resumes still able to write, in the same repo). `--last` picks
the newest session instead of an explicit id, but is unsafe once several lanes have run.

Start a fresh lane instead of resuming when the role changes or the contract materially
changed.

## Claude lane

From Claude Code: the Agent tool (`model: sonnet` for workers, default for reviewers).
From Codex: `claude --model sonnet -p "<brief>"`, or plain `claude -p` for review lanes.

UI/frontend implementation and taste-sensitive surfaces go here, never to a GPT lane.

Sonnet runs every Claude implementation lane, transcription work included; Opus reaches
one only as an escalation, by the same rule as Sol. The Claude side is two tiers, not
three — work that would go to Luna on a GPT lane stays on Sonnet here rather than dropping
to Haiku. The Luna tier is a codex-lane thing.

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
## Credentials

There is **one** ChatGPT account and its refresh token is single-use: spending it mints a
replacement and voids the one spent. A copy of a credential is therefore not a second
credential — it is a second claim on a one-shot ticket, and whichever copy refreshes first
leaves every other copy holding a stub.

- **Point `CODEX_HOME` at the balancer's slot directory** —
  `~/.bravo/codex-auth-balancer/accounts/<n>` — so any refresh happens in place, in the
  canonical file. This is what `bravo-pi-mono/docs/specs/codex-auth-balancer/design.md:34`
  prescribes for headless use.
- **Never copy an auth directory or an `auth.json`.** The balancer's own source calls the
  copied-credential path opt-in legacy and documents the failure: a child that rotates the
  refresh token leaves canonical holding a consumed one, which bricks on its next refresh. Its
  mitigation is failover to another slot. With one account there is nothing to fail over to.
- **Don't use `~/.codex` for lanes.** It is a separate store outside the balancer's sync, so its
  token is spent the moment the slot refreshes. Running `codex login` to fix it rotates the
  account away from the slot and breaks every Pi lane instead — the two stores ping-pong, one
  dead at a time.
- **Sequence GPT lanes; never run them concurrently against one slot.** The balancer takes a
  refresh lock on its own lease path, but a raw `codex exec` does not, so two lanes can race the
  single-use rotation — the failure that used to brick this setup weekly.
- If a token genuinely is revoked, recover headlessly: `CODEX_HOME=<slotDir> codex exec
  --skip-git-repo-check "say ok"` forces a refresh while the refresh token is still live
  (`codex login status` does not refresh), and only if that reports revoked,
  `CODEX_HOME=<slotDir> codex login --device-auth`. The browser flow runs `codex logout` first
  and cannot complete headlessly, so a failed attempt leaves the slot strictly worse off.
