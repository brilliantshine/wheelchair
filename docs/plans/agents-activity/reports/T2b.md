# T2b — Codex rollout reader fixes

## Changes

- `machine/service.js`: read rollout bytes from `steps_offset` using an open file handle and a maximum 8 MiB positional read; process complete lines, advance past a full newline-free chunk, restart offset and parser state after truncation, and close the handle in `finally`.
- `machine/lib/codex-steps.js`: derive status from the first output part's header and the specified JSON result fields; remove generic error text matching and recognize failed script headers. Plain string outputs without a header or JSON result finish without failure.
- `machine/test/codex-steps.test.js`: cover failed headers, `Error:` in normal output, running headers, and plain poll output.
- `machine/test/service.test.js`: cover appended records, duplicate-free subsequent reads, the bounded newline-free chunk, and truncated file replacement.

## Validation

Command: `bash machine/test/run.sh`

Pasted output (final TAP summary):

```text
1..131
# tests 131
# suites 0
# pass 131
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 27771.668648
```

Exit code: `0`

## Anything not done

None.

## Choices

`machine/service.js`: when a complete 8 MiB window has no newline, advance past it and discard that oversized partial line, as directed so the reader cannot stall.

`machine/lib/codex-steps.js`: treat a plain string output with no recognized header and no parsed JSON object as a finished poll, matching the brief's plain-output rule.
