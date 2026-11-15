# T1b — Restore model test coverage

## Changed

- `codex/test/run.sh`: restored the dropped reader, init, set, skip, numeric comparison,
  heads-up, cache edge-case, check-exit, and preflight assertions. Expectations use the
  current tier names, `gpt.<tier> = <model>` format, and provider-explicit switch command.
  Existing tests were left unchanged.

## Validation

`bash codex/test/run.sh`

```text
PASS new format reads a Claude model
PASS new format reads Claude effort
PASS new format reads a GPT model
PASS family reads Claude model family
PASS GPT effort is empty and successful
PASS legacy-only file reads as GPT
PASS legacy aliases resolve in files
PASS old command alias is accepted
PASS old provider slot alias writes successfully
PASS old alias writes the new name
PASS legacy first write rewrites every provider slot
PASS old reader rejects a GPT none cell
PASS provider reader rejects a Claude none cell
PASS family rejects a none cell
PASS set accepts Claude effort
PASS Claude family alias resolves effort
PASS set rejects effort for GPT
PASS set rejects effort with none
PASS family rejects a model without a known family
PASS init writes the shipped models file
PASS set and skip retain new rendering
PASS reset writes defaults and drops skips
PASS reset repairs a malformed file
PASS check text uses Heavy and the new switch form
PASS a none GPT tier is ignored by heads-up
PASS check JSON reports newer and all tierless models
PASS check JSON reports an available hand-set pin
PASS check JSON reports malformed files
PASS show JSON supplies models, effort, null cells, malformed and visible cache
PASS missing pins use Light default
PASS reader succeeds with missing pins
PASS unknown tier exits 2
PASS reader defaults a missing tier
PASS malformed pins reader returns shipped default
PASS malformed pins reader warns on stderr
PASS init leaves an existing pins file unchanged
PASS init reports a write failure
PASS set succeeds
PASS set creates the other default pins
PASS set removes skips for its selected model
PASS set rejects malformed pins
PASS set leaves malformed pins unchanged
PASS set rejects a bad tier
PASS set rejects a bad model
PASS skip succeeds
PASS skip adds its model
PASS skip does not duplicate a model
PASS skip rejects malformed pins
PASS skip leaves malformed pins unchanged
PASS skip rejects a bad model
PASS 6 equals 6.0 numerically
PASS 6.1 beats 6 numerically
PASS 6.10 beats 6.9 numerically
PASS normal heads-up uses the exact switch and skip form
PASS skip offers the next newest model
PASS a pinned no-tier model stays quiet
PASS a later pinned-family model is offered for that tier
PASS an unparseable pin uses its available-for line
PASS skipping the newest unparseable-pin candidate is quiet
PASS tierless models use three newest lines and the remainder line
PASS a missing cache prints no model lines
PASS a malformed cache prints no model lines
PASS a cache with an oversized integer prints no model lines
PASS a cache with an oversized integer keeps check successful
PASS a hidden-only cache prints no model lines
PASS malformed pins line prints even without a useful cache
PASS check is always successful
PASS preflight keeps exit 0 with a heads-up
PASS preflight keeps exit 1 with a heads-up
PASS preflight keeps exit 2 with a heads-up
RESULT 70 passed, 0 failed
```

`grep -c "^assert" codex/test/run.sh`

```text
71
```

Nothing remains undone.

## Choices

- `codex/test/run.sh`: the unparseable Heavy pin fixture uses `gpt-8.2-heavy`, since
  current behavior uses the tier name as its family fallback when the pinned model cannot
  be parsed.
- `codex/test/run.sh`: the preflight fixture provides a sibling `model.sh` symlink because
  `preflight.sh` invokes the model script relative to its own directory.
