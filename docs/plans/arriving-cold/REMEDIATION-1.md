# Remediation 1 — arriving-cold

Verification round 1, 2026-09-24. Two verifiers, one per implementing family: Claude (default
reviewer model) checked the GPT lane's scripts; `gpt-5.6-sol` checked the Claude lane's prose.
Both returned `VERDICT: FAIL`.

## Gaps, verbatim

From the Claude verifier (checks terra):

```
GAP: The hook (D30, "never reads anything inside a repository") / Failing open ("exits 0 on every path it controls") — `seen/hook.sh:7` (and `seen/wording.sh:2`, `seen/set.sh:26`) runs `python3 -` without `-I`/`-P`, so Python loads modules from the hook's working directory (the project); a repository's `json.py`/`datetime.py`/`re.py`/`tempfile.py`/`random.py`/`shutil.py` runs on every prompt, and one that raises makes the hook exit 1 with a traceback, because the imports at lines 8–14 are outside the `try` at 187 — Evidence: a fixture repo with `json.py` writing a marker file produced `PWNED` after one hook call; a raising `json.py` gave "RuntimeError: boom / exit 1"; the "cwd repository canary" test plants only a `SEEN.md`, so it can't catch this, and the `seen/AGENTS.md` claim "never reads anything inside a repository" is false.
```

Also reported as minor (not gaps), adopted below because each is cheap: a corrupt
`confirmed.last` disables the notice permanently; editing only an entry's "instead" text gives
a notice naming nothing; `set.sh` needs Python 3.11 for `tomllib`; the SEEN template carries
literal events.

From the GPT verifier (checks sonnet):

```
GAP: Malformed wording-list handling — the hook injects valid-looking rows from a partially malformed register instead of treating the entire file as empty — `seen/hook.sh:37-53`; reproduced with a valid Confirmed row plus malformed text, contrary to `PLAN.md:335-337`
GAP: Validation suite — the documented `bash seen/test/run.sh` fails inside normal verification lanes because `WHEELCHAIR_LANE=1` leaks into ordinary-hook fixtures — `seen/test/hook_test.sh:15`; observed six failures, while `env -u WHEELCHAIR_LANE bash seen/test/run.sh` passes
GAP: Canonical installer prose — `protocol/seen.md` does not preserve the Spec’s concrete installer contract and falsely delegates exact files/refusals to a router that does not contain them — `PLAN.md:291-329,347-348`; `protocol/seen.md:164-170`; `seen/AGENTS.md:9-29`
GAP: SEEN template — the purported skeleton contains four literal historical events, so using it creates fabricated reader history and an immediate stale clock — `protocol/templates/SEEN.md:8-11`; contradicted by `protocol/seen.md:12-25`
GAP: Suggest-and-answer flow — the prose can require two questions in one planning turn and gives no ordering rule to resolve the conflict — `protocol/seen.md:117-123` requires a final yes/no prompt while `protocol/planning.md:99-107` requires exactly one planning question
GAP: README layout — it says the hook carries both the plan record and wording list even though the hook must never read the plan record; the same block also omits the new hook work from its `install.sh` description and omits `seen/` from the router list — `README.md:65-67,94-97`; contradicted by `protocol/seen.md:27,132-136`
```

## Tasks

Round 1 sharpens the briefs; no tier change. Scripts go to the GPT family that built them,
prose to the Claude family. The original worktrees are gone, so both are fresh lanes rather than
resumes; they own disjoint files and run in separate checkouts.

| # | Objective | Ownership boundary | Lane | Validation |
|---|-----------|--------------------|------|------------|
| R1-1 | Run Python isolated in all three scripts (`python3 -I -`) so nothing in the working directory or `PYTHON*` environment is imported; move the hook's imports inside its fail-open wrapper; treat a wording file whose three headers are not each present exactly once, in order, as empty (the rule `wording.sh` already applies); treat a corrupt `confirmed.last` as empty rather than as a permanent stop; name a changed entry `changed "<phrase>"` in the notice; `set.sh` fails with a one-line message naming Python 3.11 when `tomllib` is missing, instead of a traceback. Tests: plant `json.py`, `datetime.py` and a raising `re.py` in the hook's and `wording.sh`'s working directory and assert no marker file, no output change and exit 0; every hook fixture runs with `WHEELCHAIR_LANE` unset (`env -u`); a partly malformed file yields nothing; a corrupt `confirmed.last` self-heals; an instead-only edit names the phrase | `seen/hook.sh`, `seen/wording.sh`, `seen/set.sh`, `seen/test/hook_test.sh`, `seen/test/wording_test.sh`, `seen/test/set_test.sh` | GPT / gpt-5.6-terra | `WHEELCHAIR_LANE=1 bash seen/test/run.sh` and `bash seen/test/run.sh`, both exit 0 |
| R1-2 | `protocol/seen.md` states the installer contract concretely (files per harness, the group and its `"timeout": 2`, matching on script path, coexistence, the grants and when they apply, directory creation after checks, every refusal, the `/hooks` line, warn-not-fail from `install.sh`) instead of delegating; states that the wording yes/no line is not a question under `planning.md`'s one-question rule and always comes after the turn's single question, as its last line; `seen/AGENTS.md` loses the delegation and its "never reads" line is made true by R1-1; `protocol/templates/SEEN.md` carries its example only inside the comment, with an empty body; `README.md` stops saying the hook carries the plan record, names the `seen/set.sh` step in its `install.sh` description, and lists `seen/` among routers | `protocol/seen.md`, `protocol/templates/SEEN.md`, `seen/AGENTS.md`, `README.md` | Claude / sonnet | `grep` checks in the brief; lead reads the diff |
