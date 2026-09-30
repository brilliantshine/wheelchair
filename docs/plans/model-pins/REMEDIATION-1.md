# Remediation 1 — model-pins

Verification round 1, 2026-09-29. Both verifiers returned FAIL.

## Gaps, verbatim

Claude verifier (checking T1, built by Terra):

```
GAP: The rules — lanes.md invocations (D18) — lanes.md never says the resolved `MODEL` variable is what gets recorded; the only record rule is in implementation.md, for implementation lanes, so plan-review and verification records could resolve the model again at record time — `protocol/lanes.md:42-56` and `:112-123` say only "Record the thread id in the plan doc next to the task it ran"; `protocol/implementation.md:92-97` is the only place the variable is tied to the record
GAP: model.sh check "always 0" / "an unexpected cache prints no model lines" (D3) — `visible_models` catches only `json.JSONDecodeError`, so other JSON-load `ValueError`s (and `RecursionError`) crash `check` with a traceback and exit 1; the login check hides it, so severity is low — `codex/model.sh:134`; a cache holding a 5,000-digit integer gave `ValueError: Exceeds the limit (4300 digits)` and `[exit 1]`
```

GPT verifier (Sol, gpt-6.1-sol, checking T2, built by sonnet):

```
GAP: `model.sh check` must always exit 0 on an unexpected cache — a cache containing a 5,000-digit JSON integer raises an uncaught `ValueError` and exits 1 — reproduced with temporary fixtures; `codex/model.sh:133–135` omits this exception, and `:240–242` has no fallback guard.
```

## Tasks

Round 1, so the briefs are sharpened. Each fix is small, and both briefs name the exact
change, so each gets the cheapest tier its family has.

| # | Gap | Objective | Ownership | Lane | Validation |
|---|-----|-----------|-----------|------|------------|
| R1 | `check` exits 1 on an odd cache | `visible_models` also catches `ValueError` and `RecursionError`. The `check` branch of `main` wraps `heads_up` so any exception prints nothing and still exits 0. Add a test with a 5,000-digit integer in the cache | `codex/model.sh`, `codex/test/run.sh` | Luna (gpt-6-luna) | `bash codex/test/run.sh` |
| R2 | lanes.md doesn't tie the record to the variable | In `protocol/lanes.md`, next to "Record the thread id in the plan doc next to the task it ran", say that the record also names the tier and the `MODEL` value resolved before that call, for every stage's lanes, and point to `protocol/implementation.md` for the Lane-column form | `protocol/lanes.md` | Claude / sonnet | `grep -rniE "gpt-[0-9]" protocol/`, `bash seen/test/run.sh` |
