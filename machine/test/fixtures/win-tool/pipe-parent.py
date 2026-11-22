import os, subprocess, sys, json, time
mode, node, proxy, server, ready, cache, record = sys.argv[1:]
r, w = os.pipe()
ir, iw = os.pipe()
env = dict(os.environ, RECORD=record, KEEP_LARGE='1', WRITE_ON_END='1')
holder = None
if mode in ('off', 'gone', 'pending', 'writing'):
    holder = subprocess.Popen(['sleep', '30'], pass_fds=(r, iw), stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.close(r)
p = subprocess.Popen([node, proxy, '--ready-file', ready, '--list-cache', cache, '--name', 'test', '--poll-ms', '10', '--probe-ms', '200', '--stop-ms', '100,100,100', '--', node, server], stdin=ir, stdout=w, env=env)
os.close(ir); os.close(w)
print(json.dumps({'proxy': p.pid, 'holder': holder.pid if holder else None}), flush=True)
if mode in ('gone', 'pending', 'writing'):
    if mode == 'pending': os.write(iw, b'{"method":"large","id":1}\n')
    time.sleep(0.8)
    os._exit(0)
if mode == 'pipe':
    sys.stdin.readline()
    os.close(r)
    print(json.dumps({'closed': time.time()}), flush=True)
    p.wait()
    print(json.dumps({'exit': p.returncode, 'time': time.time()}), flush=True)
else:
    sys.stdin.readline()
    p.terminate(); p.wait()
