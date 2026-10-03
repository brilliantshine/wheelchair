# Known issues

Failures found and recorded but not yet fixed. Each entry says how to reproduce it and what is
already known, so an agent can be pointed straight at it.

## Viewer: "a starter that loses the freed port registers through the new holder" fails

Found 2026-10-03 while verifying the highways router-search work. It is not caused by that work:
it fails the same way on `main` at `a552802`, before any of it.

**Reproduce**

```bash
cd viewer
node --test --test-name-pattern="loses the freed port" test/lifecycle.test.js
```

It fails on every run (two runs on `a552802`, several on `highways-routers`); the rest of
`npm test` passes (132 of 133).

**What fails**

The test is at `viewer/test/lifecycle.test.js`, starting at the line declaring
`test('a starter that loses the freed port registers through the new holder', …)`. It starts
server A with the `hang-on-sigterm` test hook, sends it SIGTERM so A keeps the port without
answering, then starts C with `--open` and the `delay-listen-retry` hook, which writes `first`
to a marker file on its first listen attempt and `delayed` when it retries. After A is released
and a new holder B starts, the test expects C to have retried and registered through B.

The assertion that fails is the marker check after C exits:

```
assert.match(await fs.readFile(marker, 'utf8'), /delayed/, 'C retried after the silent holder')
actual: "first\n"
```

So C made its first listen attempt while A held the port, but never logged the delayed retry,
yet still exited 0 without printing "refused". Either C stopped retrying and registered some
other way, or the `delay-listen-retry` hook no longer writes `delayed` on the path C now takes.

**Where to look**

- The `delay-listen-retry` and `hang-on-sigterm` hooks under `viewer/test/hooks/`, and where
  `viewer/server.js` calls them.
- The listen-retry and "someone else holds the port" logic in `viewer/server.js` (the `--open`
  path that registers through a running server).
- `git log -- viewer/server.js viewer/test/lifecycle.test.js` for the change that last touched
  either.
