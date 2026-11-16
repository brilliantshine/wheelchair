#!/usr/bin/env python3
import argparse
import grp
import json
import os
import pwd
import re
import secrets
import selectors
import shlex
import signal
import socketserver
import stat
import subprocess
import syslog
import threading
import time
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlsplit

CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'"
DEFAULTS = dict(socket_dir='/run/wheelchair-sudo', runuser='/usr/sbin/runuser', sudo='/usr/bin/sudo', sh='/bin/sh', static_dir=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static'), run_timeout='600', kill_grace='10', waiting_ttl='3600', closed_ttl='86400', max_tries='3')
TERMINAL = {'ran', 'declined', 'expired', 'failed'}


def config(path):
    values = dict(DEFAULTS)
    with open(path, encoding='utf-8') as source:
        lines = source.readlines()
    for line in lines:
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        key, sep, value = line.partition('=')
        key, value = key.strip(), value.strip()
        if not sep or key not in set(DEFAULTS) | {'user', 'url_base'}:
            raise ValueError('Invalid config key: ' + key)
        values[key] = value
    if not values.get('user') or not values.get('url_base'):
        raise ValueError('user and url_base are required')
    for key in ('run_timeout', 'kill_grace', 'waiting_ttl', 'closed_ttl'):
        values[key] = float(values[key])
        if values[key] <= 0:
            raise ValueError(key + ' must be positive')
    values['max_tries'] = int(values['max_tries'])
    if values['max_tries'] < 1:
        raise ValueError('max_tries must be positive')
    return values


def writable(st, uid, groups):
    if uid == 0:
        return True
    return bool(st.st_mode & (stat.S_IWUSR if st.st_uid == uid else stat.S_IWGRP if st.st_gid in groups else stat.S_IWOTH))


def editable(command, user):
    lexer = shlex.shlex(command, posix=True, punctuation_chars=True)
    lexer.commenters = ''
    lexer.whitespace_split = True
    try:
        words = list(lexer)
    except ValueError:
        raise ValueError('The command has unbalanced quotes')
    if any(w.startswith('~') for w in words):
        raise ValueError('Write the full path; ~ would mean /root here')
    account = pwd.getpwnam(user)
    groups = set(os.getgrouplist(user, account.pw_gid))
    result = []
    for word in words:
        if not (word.startswith('/') or word.startswith('./')):
            continue
        path = os.path.abspath(os.path.join('/', word))
        while True:
            try:
                st = os.stat(path)
                if writable(st, account.pw_uid, groups):
                    if word not in result:
                        result.append(word)
                    break
            except (FileNotFoundError, NotADirectoryError):
                pass
            parent = os.path.dirname(path)
            if parent == path:
                break
            path = parent
    return result


class State:
    def __init__(self, cfg):
        self.cfg = cfg
        self.lock = threading.Lock()
        self.requests = {}

    def clean(self):
        now = time.monotonic()
        for key, request in list(self.requests.items()):
            if request['state'] == 'waiting' and now - request['created'] >= self.cfg['waiting_ttl']:
                request.update(state='expired', closed=now)
            elif request['state'] in TERMINAL and now - request['closed'] >= self.cfg['closed_ttl']:
                del self.requests[key]

    def status(self, request):
        return {k: request[k] for k in ('state', 'exit_code', 'output', 'truncated', 'reason') if k in request}

    def close(self, request, state, **fields):
        request.update(state=state, closed=time.monotonic(), **fields)

    def check(self, args, password, require_prompt):
        sentinel = 'wheelchair-' + secrets.token_hex(24)
        proc = subprocess.Popen([self.cfg['runuser'], '-u', self.cfg['user'], '--', self.cfg['sudo'], '-S', '-k'] + args(sentinel), stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        selector = selectors.DefaultSelector()
        selector.register(proc.stderr, selectors.EVENT_READ)
        seen = False
        buffer = b''
        deadline = time.monotonic() + self.cfg['run_timeout']
        try:
            while time.monotonic() < deadline:
                events = selector.select(min(.1, max(0, deadline - time.monotonic())))
                if events:
                    chunk = os.read(proc.stderr.fileno(), 4096)
                    if not chunk:
                        break
                    buffer = (buffer + chunk)[-8192:]
                    if not seen and sentinel.encode() in buffer:
                        seen = True
                        try:
                            proc.stdin.write(password.encode() + b'\n')
                            proc.stdin.flush()
                        except BrokenPipeError:
                            pass
                        finally:
                            password = None
                            proc.stdin.close()
                elif proc.poll() is not None:
                    break
            if proc.poll() is None:
                proc.kill()
            code = proc.wait()
        finally:
            password = None
            selector.close()
            if not proc.stdin.closed:
                proc.stdin.close()
            proc.stderr.close()
        return seen, code

    def run(self, rid, password):
        with self.lock:
            self.clean()
            request = self.requests.get(rid)
            if not request or request['state'] != 'waiting' or request.get('checking'):
                return
            request['checking'] = True
        try:
            prompted, code = self.check(lambda s: ['-v', '-p', s], password, True)
            with self.lock:
                self.clean()
                if request['state'] != 'waiting':
                    return
                if not prompted:
                    self.close(request, 'failed', reason="sudo on this machine asks for no password, so a sudo card can't check one")
                    return
                if code != 0:
                    request['tries_left'] -= 1
                    if not request['tries_left']:
                        request.pop('message', None)
                        self.close(request, 'failed', reason='wrong password ' + str(self.cfg['max_tries']) + ' times')
                    else:
                        request['message'] = 'Wrong password'
                    return
                request.pop('message', None)
            _, code = self.check(lambda s: ['-l', '-u', 'root', '-p', s, '--', self.cfg['sh'], '-c', request['command']], password, False)
            password = None
            with self.lock:
                self.clean()
                if request['state'] != 'waiting':
                    return
                if code != 0:
                    self.close(request, 'failed', reason="Your sudo rules don't allow running a shell as root")
                    return
                request['state'] = 'running'
            self.execute(rid, request)
        except Exception:
            with self.lock:
                if request['state'] in ('waiting', 'running'):
                    self.close(request, 'failed', reason='Could not run the command')
        finally:
            password = None
            with self.lock:
                request['checking'] = False

    def execute(self, rid, request):
        proc = subprocess.Popen([self.cfg['sh'], '-c', request['command']], stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, cwd='/', env={'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'HOME': '/root', 'LANG': 'C.UTF-8'}, start_new_session=True)
        first, last, total = bytearray(), bytearray(), 0
        timed_out = False
        def terminate():
            nonlocal timed_out
            timed_out = True
            try:
                os.killpg(proc.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            time.sleep(self.cfg['kill_grace'])
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        timer = threading.Timer(self.cfg['run_timeout'], terminate)
        timer.daemon = True
        timer.start()
        while True:
            chunk = proc.stdout.read(8192)
            if not chunk:
                break
            total += len(chunk)
            take = min(len(chunk), 32768 - len(first))
            first.extend(chunk[:take])
            last.extend(chunk[take:])
            if len(last) > 32768:
                del last[:-32768]
        proc.stdout.close()
        code = proc.wait()
        timer.cancel()
        cut = max(0, total - len(first) - len(last))
        output = bytes(first) + (('\n[… %d bytes cut …]\n' % cut).encode() if cut else b'') + bytes(last)
        if timed_out:
            output += b'\nCommand timed out.\n'
        output = output.decode('utf-8', errors='replace')
        syslog.syslog('user=%s request_id=%s command=%s exit_code=%s' % (self.cfg['user'], rid, request['command'].replace('\n', '\\n'), code))
        with self.lock:
            self.close(request, 'ran', exit_code=code, output=output, truncated=bool(cut))


class Server(socketserver.ThreadingUnixStreamServer):
    daemon_threads = True
    allow_reuse_address = True


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    def log_message(self, fmt, *args):
        syslog.syslog('%s %s' % (self.command, urlsplit(self.path).path))
    def reply(self, status, body, content='application/json'):
        if not isinstance(body, bytes):
            body = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', content)
        self.send_header('Content-Length', str(len(body)))
        if self.server.page:
            for k, v in [('Cache-Control', 'no-store'), ('Referrer-Policy', 'no-referrer'), ('Content-Security-Policy', CSP), ('X-Frame-Options', 'DENY')]:
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)
    def body(self):
        size = int(self.headers.get('Content-Length', '0'))
        if size < 0 or size > 65536:
            raise ValueError('Invalid body')
        return self.rfile.read(size)
    def do_GET(self):
        path = urlsplit(self.path).path
        state = self.server.state
        if self.server.page and path in ('/static/page.js', '/static/page.css'):
            name = path.rsplit('/', 1)[-1]
            with open(os.path.join(state.cfg['static_dir'], name), 'rb') as f:
                self.reply(200, f.read(), 'text/javascript; charset=utf-8' if name.endswith('.js') else 'text/css; charset=utf-8')
            return
        match = re.fullmatch(r'/r/([0-9a-f]{32})(?:/(data|status))?', path) if self.server.page else re.fullmatch(r'/requests/([0-9a-f]{32})', path)
        if not match:
            self.reply(404, {'error': 'Not found'})
            return
        rid = match.group(1)
        if self.server.page and not match.group(2):
            with open(os.path.join(state.cfg['static_dir'], 'page.html'), 'rb') as f:
                self.reply(200, f.read(), 'text/html; charset=utf-8')
            return
        with state.lock:
            state.clean()
            request = state.requests.get(rid)
            data = state.status(request) if request else {'state': 'expired'}
            if request and self.server.page and match.group(2) == 'data':
                data.update({k: request[k] for k in ('command', 'does', 'why', 'editable', 'tries_left')})
                data['user'] = state.cfg['user']
                if 'message' in request and request['state'] == 'waiting':
                    data['message'] = request['message']
        self.reply(200, data)
    def do_POST(self):
        state = self.server.state
        path = urlsplit(self.path).path
        try:
            raw = self.body()
            if not self.server.page and path == '/requests':
                data = json.loads(raw)
                if not isinstance(data, dict) or any(not isinstance(data.get(k), str) or not data[k].strip() for k in ('command', 'does', 'why')) or len(data['command'].encode()) > 4096 or '\0' in data['command']:
                    raise ValueError('Provide a valid command, does and why')
                paths = editable(data['command'], state.cfg['user'])
                rid = secrets.token_hex(16)
                with state.lock:
                    state.clean()
                    state.requests[rid] = dict(command=data['command'], does=data['does'], why=data['why'], editable=paths, state='waiting', tries_left=state.cfg['max_tries'], created=time.monotonic())
                self.reply(201, {'request_id': rid, 'url': state.cfg['url_base'].rstrip('/') + '/r/' + rid, 'editable': paths})
                return
            match = re.fullmatch(r'/r/([0-9a-f]{32})/run', path) if self.server.page else re.fullmatch(r'/requests/([0-9a-f]{32})/cancel', path)
            if not match:
                self.reply(404, {'error': 'Not found'})
                return
            rid = match.group(1)
            if self.server.page:
                form = parse_qs(raw.decode('utf-8'), keep_blank_values=True)
                raw = None
                state.run(rid, form.pop('password', [''])[0])
                form = None
            with state.lock:
                state.clean()
                request = state.requests.get(rid)
                if request and not self.server.page and request['state'] == 'waiting':
                    state.close(request, 'declined')
                result = state.status(request) if request else {'state': 'expired'}
            self.reply(200, result)
        except (ValueError, UnicodeError, json.JSONDecodeError) as exc:
            self.reply(422, {'error': str(exc) if str(exc) in ('The command has unbalanced quotes', 'Write the full path; ~ would mean /root here') else 'Invalid request'})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', required=True)
    cfg = config(parser.parse_args().config)
    account = pwd.getpwnam(cfg['user'])
    os.makedirs(cfg['socket_dir'], mode=0o755, exist_ok=True)
    state = State(cfg)
    servers = []
    for name, mode, page in [('page.sock', 0o600, True), ('intake.sock', 0o660, False)]:
        path = os.path.join(cfg['socket_dir'], name)
        if os.path.lexists(path):
            if not stat.S_ISSOCK(os.lstat(path).st_mode):
                raise RuntimeError('Refusing to replace non-socket: ' + path)
            os.unlink(path)
        server = Server(path, Handler)
        server.state, server.page = state, page
        os.chmod(path, mode)
        if not page:
            os.chown(path, -1, account.pw_gid)
        servers.append(server)
    threading.Thread(target=servers[0].serve_forever, daemon=True).start()
    servers[1].serve_forever()

if __name__ == '__main__':
    main()
