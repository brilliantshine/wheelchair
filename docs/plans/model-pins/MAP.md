---
slug: model-pins
---

# How this works today

How a GPT lane gets its model now, and what Codex offers that a pin could build on. Written
before planning starts.

## End to end

```
agent reads protocol/lanes.md → copies a model id from the text → codex exec -m <id> ...
                                                                    ↓ later, same lane
                                              codex exec resume <thread> -m <same id> ...

new model released → someone edits the ids in lanes.md, plan-review.md, verification.md → PR
```

## What happens

1. No script dispatches a lane. The agent running a stage reads `protocol/lanes.md` and writes
   the `codex exec` command itself, copying the model id from the tier list
   (`protocol/lanes.md:61-78`) and the example invocation (`:42`).
2. The ids are also written into `protocol/plan-review.md:35` and `protocol/verification.md:29`,
   `:35`, `:62`. `protocol/implementation.md` uses only the tier nicknames (Luna, Terra, Sol,
   Astra). So a new model means editing those files, and that is a PR. PR #20 on 2026-09-29 was
   exactly this.
3. A resumed lane repeats `-m` with the model it started on (`protocol/lanes.md:114-117`).
4. Before the first GPT dispatch of a session, the lead runs `codex/preflight.sh`
   (`protocol/lanes.md:50`, `:222`). It takes a lock, checks the login token, and prints one
   line. Its exit code is the dispatch rule: 0 means fan out, 1 means sequence the lanes, and 2
   means no GPT lane can log in (`codex/preflight.sh:17-19`). The bash part ends in
   `exec python3` (`:35`), so anything added has to go before that line or inside the Python.
5. `install.sh` already writes into `~/.codex` when Codex is present: the prompt wrappers
   (`install.sh:78-84`), and, through `seen/set.sh`, one hook entry in `hooks.json` plus a
   `writable_roots` line in `config.toml` (`seen/set.sh:264`). That writer already parses and
   edits TOML, and it refuses rather than guessing on a file it doesn't understand.

What Codex itself provides, checked on this machine on 2026-09-29 with Codex 0.159.0:

6. Codex keeps `~/.codex/models_cache.json` with `fetched_at` and a `models` list, where each
   entry has `slug`, `display_name`, `description` and `visibility` (`list` or `hide`). Codex
   refreshes it on its own. Two reads seven minutes apart gave two `fetched_at` values, and
   the second had gained `gpt-6.1-sol`.
7. Model ids mostly follow `gpt-<version>-<tier>`: `gpt-6-luna`, `gpt-6.1-sol`,
   `gpt-5.6-terra`. Not every generation has every tier (there is no `gpt-6-terra`), and some
   entries have no tier at all (`gpt-5.5`, `gpt-reserve`, `codex-auto-review`).
8. `codex exec -p <name>` layers `~/.codex/<name>.config.toml` over the normal config. A
   profile setting `model` and `model_reasoning_effort` took effect: the run reported
   `model: gpt-6-luna` and `reasoning effort: xhigh`. A `-m` or `-c` given on the same command
   line overrides the profile.
9. **`codex exec resume` doesn't take `-p`.** It exits 2 with a usage error. A resumed lane
   still has to name its model with `-m`.

Claude lanes, for comparison:

10. Claude lanes name a family alias, never a model id. From Claude Code the lead uses the
    Agent tool with `model: sonnet` for workers and the session's default model for reviewers.
    From Codex it runs `claude --model sonnet -p`, or a plain `claude -p` for reviews
    (`protocol/lanes.md:147-149`). The ladder is `sonnet → opus` (`:179`), and verification on a
    Claude-only machine uses Opus (`protocol/verification.md:36`).
11. `claude --help` describes `--model` as taking "an alias for the latest model (e.g. 'fable',
    'opus', or 'sonnet') or a model's full name". So the Claude side already moves to each new
    Sonnet or Opus on its own, with no PR and no heads-up. Nobody chose that for it.
12. The rules never name a Claude family newer than those two. `fable` is a live alias on this
    machine, and nothing in `protocol/` ever dispatches to it.

## What matters for this change

- The ids appear in four rule documents, and every one of them is read by an agent composing a
  command. Tier names alone in the rules would work, as long as something turns a tier into an
  id on each machine.
- The preflight already runs once, at the right moment, before the first GPT dispatch of every
  session. The heads-up fits there, but it can't change the exit codes, which are the dispatch
  rule.
- Codex's own model list is the only local source of which models exist, and Codex keeps it
  fresh.

## Problems found

- Profiles alone can't cover resume (point 9). Whatever maps a tier to a model has to be
  readable as a plain model id too, for `resume -m`.
- Picking "newer" from the cache can't just be a string comparison. `gpt-6.1-sol` has to beat
  `gpt-6-sol`, and a tier with no newer model (Terra) has to stay put.

## Not checked

- How often Codex refreshes the cache, and whether it exists at all on a machine where Codex
  has never been run.
- Whether a profile file can hold anything that conflicts with a lane's `-s` or `-C` flags.
- Codex versions older than 0.159.0.
