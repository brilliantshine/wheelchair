# Live checks: recorded runs

Run by the sub-lead on hearth with `bash test-support/smoke/live.sh` (real logins, isolated hub, machine service and tmux server). This is the "seen on a live run" evidence for Spec "2. Live checks".

## Run 3: final code, passing (commit 0c08e45; code identical to verified 3a749c0; D10)

The pull request's live evidence. Run on the final harness (remediations 1 to 3).

```
CHECK | RESULT | DETAIL
slow-start | PASS | request succeeded; 10.36 s; 1 start requests
light/claude | PASS | model claude-haiku-5-5
light/gpt | PASS | model gpt-6-luna
standard/claude | PASS | model claude-sonnet-5-5
standard/gpt | PASS | model gpt-6.1-terra
heavy/claude | PASS | model claude-opus-5-5
heavy/gpt | PASS | model gpt-6.1-sol
critical/claude | PASS | model claude-fable-5-2
critical/gpt | PASS | model gpt-6-astra
permission | PASS | prompt opened, Enter approved, card answered, smoke-ok exists

real	2m16.447s
user	0m33.193s
sys	0m13.099s
exit=0
```

## Run 2: passing (commit b09e538, with D10)

```
CHECK | RESULT | DETAIL
slow-start | PASS | request succeeded; 12.93 s; 1 start requests
light/claude | PASS | model claude-haiku-5-5
light/gpt | PASS | model gpt-6-luna
standard/claude | PASS | model claude-sonnet-5-5
standard/gpt | PASS | model gpt-6.1-terra
heavy/claude | PASS | model claude-opus-5-5
heavy/gpt | PASS | model gpt-6.1-sol
critical/claude | PASS | model claude-fable-5-2
critical/gpt | PASS | model gpt-6-astra
permission | PASS | prompt opened, Enter approved, card answered, smoke-ok exists

real	2m49.696s
user	0m41.150s
sys	0m15.939s
exit=0
```

Each model is read from the CLI's own transcript and matches `codex/model.sh <provider> <tier>`.

## Run 1: failing (commit before T3b), kept for the record

```
CHECK | RESULT | DETAIL
slow-start | PASS | request succeeded; 10.08 s; 1 start requests
light/claude | PASS | model claude-haiku-5-5
light/gpt | FAIL | Timed out waiting for condition
standard/claude | FAIL | Could not use claude; using gpt.
standard/gpt | FAIL | Timed out waiting for condition
heavy/claude | FAIL | provider undefined, requested claude
heavy/gpt | FAIL | provider undefined, requested gpt
critical/claude | FAIL | provider undefined, requested claude
critical/gpt | FAIL | provider undefined, requested gpt
permission | FAIL | wrong provider

real	1m38.219s
user	0m18.635s
sys	0m7.581s
exit=1
```

Causes are in PLAN.md's Log for 2026-11-15. The script read the Codex thread id too early, and every start's fetch was slowed, which froze the machine service past the hub's 3 s status timeout. Collin's usage protections also moved Claude workers to GPT. Fixed by T3b and D10.
