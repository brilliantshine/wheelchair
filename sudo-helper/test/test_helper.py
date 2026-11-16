import http.client
import importlib.util
import json
import os
import pathlib
import pwd
import socket
import tempfile
import threading
import time
import unittest
from unittest import mock

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('helper', ROOT / 'helper.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
PASSWORD = 'hunter2-TESTPW-9f3a'

class Connection(http.client.HTTPConnection):
    def __init__(self, path):
        super().__init__('localhost', timeout=5)
        self.path = str(path)
    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX)
        self.sock.connect(self.path)

class HelperTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.cfg = dict(helper.DEFAULTS, user=pwd.getpwuid(os.getuid()).pw_name, url_base='https://example.test', runuser=str(ROOT / 'test/shims/runuser'), sudo=str(ROOT / 'test/shims/sudo'), sh='/bin/sh', static_dir=str(ROOT / 'static'), run_timeout=.4, kill_grace=.1, waiting_ttl=2., closed_ttl=2., max_tries=3)
        self.state = helper.State(self.cfg)
        self.servers = []
        self.logs = []
        self.patcher = mock.patch.object(helper.syslog, 'syslog', side_effect=self.logs.append)
        self.patcher.start()
        for page in (True, False):
            path = pathlib.Path(self.temp.name) / ('page' if page else 'intake')
            server = helper.Server(str(path), helper.Handler)
            server.state, server.page = self.state, page
            threading.Thread(target=server.serve_forever, daemon=True).start()
            self.servers.append(server)
        self.bodies = []
    def tearDown(self):
        for server in self.servers:
            server.shutdown(); server.server_close()
        self.patcher.stop()
        self.assertNotIn(PASSWORD, repr(self.logs) + repr(self.bodies))
        for path in pathlib.Path(self.temp.name).rglob('*'):
            if path.is_file(): self.assertNotIn(PASSWORD.encode(), path.read_bytes())
        self.temp.cleanup()
    def call(self, page, method, path, body=b''):
        conn = Connection(self.servers[0 if page else 1].server_address)
        conn.request(method, path, body)
        response = conn.getresponse(); raw = response.read(); headers = dict(response.getheaders()); status = response.status
        conn.close(); self.bodies.append(raw)
        return status, raw, headers
    def create(self, command='printf hello', does='does', why='why'):
        status, raw, _ = self.call(False, 'POST', '/requests', json.dumps(dict(command=command, does=does, why=why)))
        self.assertEqual(status, 201, raw)
        return json.loads(raw)['request_id']
    def status(self, rid):
        return json.loads(self.call(False, 'GET', '/requests/' + rid)[1])
    def run_request(self, rid, password=PASSWORD):
        return json.loads(self.call(True, 'POST', '/r/' + rid + '/run', 'password=' + password)[1])
    def test_run_and_headers_rendering(self):
        malicious = '</script><script>alert(1)</script><img src=x onerror=alert(1)>'
        rid = self.create('printf %s ' + shquote(malicious), malicious, malicious)
        code, html, headers = self.call(True, 'GET', '/r/' + rid)
        self.assertEqual(code, 200); self.assertNotIn(malicious.encode(), html)
        self.assertEqual(headers['Content-Security-Policy'], helper.CSP)
        self.assertEqual(headers['Cache-Control'], 'no-store')
        data = json.loads(self.call(True, 'GET', '/r/' + rid + '/data')[1]); self.assertEqual(data['does'], malicious)
        result = self.run_request(rid); self.assertEqual(result['state'], 'ran'); self.assertEqual(result['output'], malicious)
        self.assertEqual(json.loads(self.call(True, 'GET', '/r/' + rid + '/data')[1])['output'], malicious)
        script = (ROOT / 'static/page.js').read_text()
        for sink in ('innerHTML', 'insertAdjacentHTML', 'document.write', 'eval('): self.assertNotIn(sink, script)
    def test_wrong_nopass_denied(self):
        rid = self.create()
        for n in (2, 1, 0):
            result = self.run_request(rid, 'wrong')
            self.assertEqual(result['state'], 'waiting' if n else 'failed')
        with mock.patch.dict(os.environ, SHIM_MODE='nopass'):
            marker = pathlib.Path(self.temp.name) / 'executed'
            rid = self.create('cat > ' + str(marker)); result = self.run_request(rid)
            self.assertEqual(result['state'], 'failed'); self.assertFalse(marker.exists())
        with mock.patch.dict(os.environ, SHIM_MODE='denied'):
            rid = self.create(); self.assertEqual(self.run_request(rid)['state'], 'failed')
    def test_wrong_then_right_and_three_wrong_data(self):
        rid = self.create()
        self.run_request(rid, 'wrong')
        data = json.loads(self.call(True, 'GET', '/r/' + rid + '/data')[1])
        self.assertEqual(data['message'], 'Wrong password')
        self.assertEqual(data['tries_left'], 2)
        self.run_request(rid)
        data = json.loads(self.call(True, 'GET', '/r/' + rid + '/data')[1])
        self.assertEqual(data['state'], 'ran')
        self.assertEqual(data['exit_code'], 0)
        self.assertNotIn('message', data)

        rid = self.create()
        for _ in range(3):
            self.run_request(rid, 'wrong')
        data = json.loads(self.call(True, 'GET', '/r/' + rid + '/data')[1])
        self.assertEqual(data['state'], 'failed')
        self.assertEqual(data['reason'], 'wrong password 3 times')
        self.assertNotIn('message', data)
    def test_cancel_race_and_expiry(self):
        with mock.patch.dict(os.environ, SHIM_MODE='slow'):
            rid = self.create(); thread = threading.Thread(target=self.run_request, args=(rid,)); thread.start(); time.sleep(.1)
            result = json.loads(self.call(False, 'POST', '/requests/' + rid + '/cancel')[1]); thread.join()
            self.assertEqual(result['state'], 'declined'); self.assertEqual(self.status(rid)['state'], 'declined')
        rid = self.create(); self.state.requests[rid]['created'] -= 3
        self.assertEqual(self.status(rid)['state'], 'expired')
        self.state.requests[rid]['closed'] -= 3
        self.assertEqual(self.status(rid)['state'], 'expired'); self.assertNotIn(rid, self.state.requests)
    def test_timeout_and_truncation(self):
        rid = self.create('sleep 3'); result = self.run_request(rid)
        self.assertEqual(result['state'], 'ran'); self.assertIn('timed out', result['output'])
        rid = self.create('head -c 100000 /dev/zero | tr "\\0" x'); result = self.run_request(rid)
        self.assertTrue(result['truncated']); self.assertIn('34464 bytes cut', result['output'])
    def test_scan_and_refusals(self):
        file = pathlib.Path(self.temp.name) / 'file'; file.write_text('x')
        user = self.cfg['user']
        self.assertIn(str(file), helper.editable('cat ' + str(file), user))
        self.assertIn(str(file / 'missing'), helper.editable('cat ' + str(file / 'missing'), user))
        self.assertIn('./tmp', helper.editable('cat ./tmp', user))
        if os.getuid() != 0: self.assertNotIn('/bin/sh', helper.editable('/bin/sh', user))
        for command, message in [('cat ~/x', 'Write the full path; ~ would mean /root here'), ("echo 'bad", 'The command has unbalanced quotes')]:
            status, raw, _ = self.call(False, 'POST', '/requests', json.dumps(dict(command=command, does='x', why='x')))
            self.assertEqual(status, 422); self.assertEqual(json.loads(raw)['error'], message)
    def test_config(self):
        path = pathlib.Path(self.temp.name) / 'config'; path.write_text('user=x\nurl_base=https://example.test\nunknown=x\n')
        with self.assertRaises(ValueError): helper.config(path)

def shquote(value):
    import shlex
    return shlex.quote(value)
