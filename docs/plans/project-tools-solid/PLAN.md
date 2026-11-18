---
slug: project-tools-solid
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-18
---

# Make project tools solid

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

### Q2: Antigravity mechanism (pending research)
- **Context:** A workspace plugin at `<cwd>/.agents/plugins/<name>/` (`plugin.json` + `mcp_config.json`) loads servers with no HOME change (verified, model turn reached the tool). But leads and reviewers share one worktree, and reviewers must not get tools (local-projects Decision 4). A follow-up check for a per-session on/off switch is running. Fallback is a per-session fake HOME with a copied login token, which isolates conversation history and anything else under HOME.

## Watch List

Things noticed that need looking into — not yet decisions for the user. Written down the
moment they're spotted so they can't be forgotten, surfaced to the user one line at a
time as they appear, and emptied before Stage 1 exits.

Each item ends up settled by the agent (noted in the Log), promoted to an Open Question,
promoted to a Constraint or Accepted Risk, or waved off by the user.

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | Codex research | `http_headers` (literal), `env_http_headers` (header → env var), `bearer_token_env_var` all accepted as `-c` overrides; `bearer_token` makes Codex refuse its config; `type: "sse"` is silently treated as HTTP | no | Fold into Spec: map `Bearer ${NAME}` → `bearer_token_env_var`, exact `${NAME}` header → `env_http_headers`, literal → `http_headers`; skip sse and other `${}` |
| 2 | Codex research | Literal header values go into the stored argv; a literal `Authorization` or key header is likely a secret | no | Decide: skip literal secret-looking headers with a warning |
| 3 | Codex budget | 64 KiB budget counts UTF-16 units | no | Fold into Spec: `Buffer.byteLength` |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode thorough | Collin's pick; this thread is already the follow-up | user |
| 2 | Connection check: wheelchair itself connects to each project tool (MCP handshake + tool list), once per thread when a tools-getting agent first starts and again whenever `.mcp.json` changes; one result shared by every CLI | Collin's pick: catches bad tokens and URLs without slowing every agent start. No CLI offers a reliable check (research 2026-11-18) | user |
| 3 | Problems reach Collin as one system `needs` card per thread listing plain-language lines, closed by the hub when a later check or start leaves no lines (design carried from local-projects review rounds 1-3 / D4) | Already worked through three review rounds; system cards close themselves | defaulted |

## Spec

The settled design, grown as decisions land. Bar: a fresh agent with no conversation
history can implement from this section alone — behavior, boundaries, edge cases,
non-goals, and concrete validation commands.

A Mermaid diagram of the flow belongs here, added by Stage 2 at approval — not while the
Spec is still churning. See `protocol/diagrams.md`.

## Deferred

Optional; present only in the lighter modes.

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them.

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — <date>

**Lanes:** <family / model>; <family / model>; cross-family: <yes|no>.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most.

<!-- Round 2+: list what changed since the previous round; that list scopes the reviewers. -->

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

Reported severity is the reviewer's opinion; the lead verdict
(`upheld`/`downgraded`/`declined`/`accepted-risk`/`user-decision`) is what gates the
exit. Downgrades and declines cite evidence.

## Prior Work

Parts of the Spec already built before this plan reached Stage 3 — adopted from outside
with work already done, or left behind by an implementation run that died partway.

Stage 3 does not re-implement `pre-existing` items and does not touch their code. Stage 4
verifies them exactly as rigorously as everything else: this code has never been through
the gate, so skipping it would leave the least-trustworthy part of the change as the only
part nobody checked.

Ambiguous evidence means **not done**. A wrong "done" is a silent hole; a wrong "not done"
costs a worker one look.

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

`partial` items are implemented by Stage 3 — the brief names what exists so the worker
completes it instead of restarting it.

## Implementation Tasks

Filled by Stage 3. One row per worker brief.

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

Session id = the `thread_id` of a `codex exec` lane, so remediation can resume it.

## Log

Free-form running notes: deviations discovered mid-implementation, scope events,
anything a future session needs that fits nowhere above.
