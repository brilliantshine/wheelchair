# R2-a — make the auto-merge tests independent of machine load

## Changes

- `viewer/test/app-auto-merge.test.js`: increased the shared retry and merge timeouts to 20 ms and 5000 ms respectively; extended the UNKNOWN outcome iteration to a 1500 ms wait with 50 ms polling and restored its temporary values; set the merge timeout case to 300 ms with a five-second stub process and restored the default afterward. Other timing overrides restore the new defaults.

## Validation

- `cd viewer && node --test test/app-auto-merge.test.js`
  ```text
  # tests 13
  # pass 13
  # fail 0
  # duration_ms 2215.68142
  ```
- `cd viewer && for i in 1 2 3 4 5; do node --test test/app-auto-merge.test.js 2>&1 | grep -E '^# (pass|fail)'; done`
  ```text
  # pass 13
  # fail 0
  # pass 13
  # fail 0
  # pass 13
  # fail 0
  # pass 13
  # fail 0
  # pass 13
  # fail 0
  ```
- `cd viewer && node --test test/*.test.js`
  ```text
  # tests 793
  # pass 793
  # fail 0
  # duration_ms 96273.271587
  ```

## Could not do

None.

## Choices

none
