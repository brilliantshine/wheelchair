# R1-a — no held notice for an already merged pull request

## Changes

- `viewer/app/auto-merge.js`: held attempts now add a notice and record its card id only when the thread has no `merged` card for the done pull request. The held attempt record still includes its timestamp, outcome and reason.
- `viewer/test/app-auto-merge.test.js`: added coverage for a held gate with an existing merged card, including no auto-merge notice and no GitHub calls.

## Validation

`cd viewer && node --test test/app-auto-merge.test.js`

```text
exit 0
# tests 13
# pass 13
# fail 0
```

`cd viewer && node --test test/*.test.js`

```text
exit 1
# tests 793
# pass 792
# fail 1
not ok 436 - 6 message clears debt
location: viewer/test/app-quiet.test.js:38:1
failure: Expected values to be strictly equal: 1 !== 0
# duration_ms 88893.130233
```

The suite also logged `auto-merge: TypeError: hub.withThread is not a function` from `app-check-card.test.js`, which supplies a hub stub without `withThread`; its tests passed. I did not rerun the full suite after its failure.

## Could not do

The full viewer suite did not pass because of the `app-quiet.test.js` failure recorded above.

## Choices

none
