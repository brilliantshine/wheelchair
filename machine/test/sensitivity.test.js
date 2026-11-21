'use strict';
// Keep service instances independent of the host's WSL and interop setup.
const noWsl = { procRoot: __dirname, etcRoot: __dirname, runRoot: __dirname };
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { MachineService } = require('../service');
const { makeTemp } = require('../../test-support/run-dir');

test('diagram sensitivity routes report, validate and serialize writes', async () => {
  const dir = await makeTemp('sensitivity-machine-');
  const secret = path.join(dir, 'secret'); const script = path.join(dir, 'writer');
  await fs.writeFile(secret, 'secret');
  await fs.writeFile(script, `#!/bin/sh
case "$1" in
 --json) echo '{"level":"ask","files":[{"harness":"claude","level":"ask"}]}' ;;
 --report) echo 'diagram-sensitivity: ask' ;;
 high) echo 'first error' >&2; echo 'writer refused' >&2; exit 1 ;;
 default) sleep 1; echo 'set default' ;;
 *) echo "set $1" ;;
esac
`, { mode: 0o755 });
  const service = new MachineService({ win: noWsl, stateDir: dir, sensitivityScript: script });
  service.config.secret_file = secret;
  const server = http.createServer((req, res) => service.handle(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const request = async (method, body, auth = true) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/v1/diagram-sensitivity`, { method, headers: { 'content-type': 'application/json', ...(auth ? { 'x-wheelchair-machine-secret': 'secret' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return [response.status, await response.json()];
  };
  try {
    assert.equal((await request('GET', null, false))[0], 401);
    assert.deepEqual(await request('GET'), [200, { level: 'ask', files: [{ harness: 'claude', level: 'ask' }], text: 'diagram-sensitivity: ask\n' }]);
    assert.equal((await request('POST', { level: 'bad' }))[0], 400);
    assert.deepEqual(await request('POST', { level: 'ask' }), [200, { level: 'ask', text: 'set ask\n' }]);
    assert.deepEqual(await request('POST', { level: 'high' }), [422, { error: 'writer refused' }]);
    const pending = request('POST', { level: 'default' });
    while (!service.sensitivityWriting) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal((await request('POST', { level: 'ask' }))[0], 409);
    assert.equal((await request('GET'))[0], 200);
    assert.equal((await pending)[0], 200);
    await fs.writeFile(script, '#!/bin/sh\necho report-failed >&2\nexit 1\n', { mode: 0o755 });
    assert.deepEqual(await request('GET'), [422, { error: 'report-failed' }]);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
