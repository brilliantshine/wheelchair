# T3c: live check cleanup stays on the test service

## What changed

- `machine/test/screen-live.js`
  - `base` is now computed before `ctx`, and `ctx.env` is created in the same statement as `ctx` (pointing `WHEELCHAIR_MACHINE_URL` at the isolated test service and `WHEELCHAIR_SESSION_TOKEN` at `live-token`). The later `ctx.env = ...` assignment is removed.
  - `client()` resolves at once with a failed result (`status: null`, an error message, nothing spawned) when `ctx` or `ctx.env` is missing.
  - `client()` builds the child env from `ctx.env` and sets `WHEELCHAIR_MACHINE_URL` and `WHEELCHAIR_SESSION_TOKEN` explicitly, with a comment explaining why.
  - `cleanup()` skips the `client(['stop'])` call when `ctx.env` is missing. The server close and the `cleanupSync()` backstop still run.

## Validation

Syntax check and the brief's gate, with `SCRATCH` set to the session scratchpad (outside the repo):

```
$ node --check machine/test/screen-live.js; echo "syntax exit $?"
syntax exit 0

$ pgrep -a Xvfb > "$SCRATCH/xb.txt"   # snapshot before the runs: empty, no Xvfb process listed

$ for i in 1 2; do LIVE_SHOT="$SCRATCH/live-$i.png" bash machine/test/screen-live.sh > "$SCRATCH/t3c-$i.log" 2>&1; echo "run $i exit $? $(grep '^live:' "$SCRATCH/t3c-$i.log")"; done
run 1 exit 0 live: 22 ok, 0 failed
run 2 exit 0 live: 22 ok, 0 failed

$ systemctl --user list-units --all 'wcscreen-*' --no-legend
(no output)

$ pgrep -a Xvfb | diff "$SCRATCH/xb.txt" - && echo "Xvfb set unchanged"
Xvfb set unchanged
```

Tail of run 2 (`$SCRATCH/t3c-2.log`):

```
ok - stop succeeds
ok - the env-clearing child is gone after stop (polled up to 10 s)
ok - after stop the screen slice is gone or its cgroup is empty (polled up to 10 s)
ok - no process from the screen survives stop (polled up to 10 s)
ok - no wcscreen unit of this test is left
live: 22 ok, 0 failed
```

Range diff from the brief, run before the commit existed (empty, because the change was still uncommitted):

```
$ git diff wc/940599e3df66...HEAD -- machine/test/screen-live.js
(no output)
```

Working-tree diff, the change under review:

```
$ git diff -- machine/test/screen-live.js
-    const child = spawn('node', [wc, 'screen', ...args], { env: ctx.env, stdio: ['ignore', 'pipe', 'pipe'] });
+    if (!ctx || !ctx.env) { resolve({ status: null, out: '', err: 'test service env not set; nothing spawned', body: null }); return; }
+    const env = { ...ctx.env, WHEELCHAIR_MACHINE_URL: ctx.env.WHEELCHAIR_MACHINE_URL, WHEELCHAIR_SESSION_TOKEN: ctx.env.WHEELCHAIR_SESSION_TOKEN };
+    const child = spawn('node', [wc, 'screen', ...args], { env, stdio: ['ignore', 'pipe', 'pipe'] });
-  try { await client(['stop'], 15000); } catch { /* backstop below */ }
+  if (ctx.env) { try { await client(['stop'], 15000); } catch { /* backstop below */ } }
-  ctx = { root, stateDir, service, server: service.server, slicePrefix, env: null };
   const base = `http://127.0.0.1:${listen}`;
+  ctx = { root, stateDir, service, server: service.server, slicePrefix, env: { ...process.env, WHEELCHAIR_MACHINE_URL: `${base}/v1/agent`, WHEELCHAIR_SESSION_TOKEN: 'live-token' } };
-  ctx.env = { ...process.env, WHEELCHAIR_MACHINE_URL: `${base}/v1/agent`, WHEELCHAIR_SESSION_TOKEN: 'live-token' };
```

## Not done

Nothing in the brief was left out. The new guards in `client()` and `cleanup()` are defensive: `ctx` is now created with `env` in the same statement, so no code path in the script reaches them with `ctx` set and `env` missing, and a setup throw before `ctx` exists makes `cleanup()` return early anyway. I did not exercise the guard paths with a dedicated test, because the brief's gate does not cover them.

## Choices

- `machine/test/screen-live.js`, `client()`: the child env is spread from `ctx.env` and then sets the two variables again explicitly. The brief asked for this, but `ctx.env` already holds both values, so the explicit assignment is redundant today. I kept it so a future change to `ctx.env` cannot drop them silently.
- `machine/test/screen-live.js`, `client()` guard: the early return uses the shape `{ status: null, out: '', err, body: null }`, matching the normal result shape, so callers that read `.status`, `.out`, `.err` or `.body` still work.
- `machine/test/screen-live.js`, `cleanup()`: only the `client(['stop'])` call is skipped. The server close and `cleanupSync()` still run, since they act on the test's own service and slices.
