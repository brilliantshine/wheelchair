#!/usr/bin/env python3
# Polls a pull request using its URL, pushed commit, and window start time.
import json, os, subprocess, sys, time
url, pushed, window_start = sys.argv[1], sys.argv[2], int(sys.argv[3])
started = time.monotonic()
stopped = False
while True:
    remaining = 600 - (time.monotonic() - started)
    if remaining <= 0:
        break
    try:
        result = subprocess.run([os.environ.get('WC_GH') or 'gh', 'pr', 'view', url, '--json',
            'state,mergeStateStatus,headRefOid,statusCheckRollup'],
            capture_output=True, text=True, timeout=remaining)
    except (OSError, subprocess.TimeoutExpired):
        result = None
    if result and result.returncode == 0:
        try:
            pr = json.loads(result.stdout)
            checks = pr.get('statusCheckRollup') or []
            def failed(c):
                return (c.get('__typename') == 'CheckRun' and c.get('status') == 'COMPLETED'
                        and c.get('conclusion') not in ('SUCCESS', 'NEUTRAL', 'SKIPPED')) or (c.get('__typename') == 'StatusContext' and c.get('state') in ('FAILURE', 'ERROR'))
            def pending(c):
                return (c.get('__typename') == 'CheckRun' and c.get('status') != 'COMPLETED') or (c.get('__typename') == 'StatusContext' and c.get('state') in ('PENDING', 'EXPECTED'))
            state = pr['mergeStateStatus']
            ready = state in ('CLEAN', 'HAS_HOOKS') or (state == 'BLOCKED' and not any(failed(c) or pending(c) for c in checks))
            stop_reason = ('closed or merged' if pr['state'] != 'OPEN' else
                           'head changed' if pr['headRefOid'] != pushed else
                           'conflicts' if state == 'DIRTY' else
                           'behind' if state == 'BEHIND' else
                           'check failed' if any(failed(c) for c in checks) else
                           'ready' if ready and (checks or time.time() - window_start >= 300) else None)
            print(result.stdout, flush=True)
            if stop_reason:
                print(f'STOP: {stop_reason}', flush=True)
                stopped = True
                break
        except (ValueError, KeyError, TypeError):
            pass
    remaining = 600 - (time.monotonic() - started)
    if remaining <= 0:
        break
    time.sleep(min(60, remaining))
    if time.monotonic() - started >= 600:
        break

if not stopped:
    print('STOP: time limit', flush=True)
