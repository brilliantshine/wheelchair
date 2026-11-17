'use strict';

// Round-1 remediation R3: the terminal's semicolon against a real tmux (private socket only), and
// the `hub: true` mark on the sessions response when the installer registered the hub by hostname.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { api } = require('./helpers/app.js');
const { makeDir, startServer } = require('./helpers/server.js');
const { startMachine } = require('./helpers/app-machine.js');

const hasTmux = spawnSync('tmux', ['-V']).status === 0;

// The machine service hands the page's key to `tmux send-keys -t <name> <key>` as one argv word
// (machine/service.js raw()), so this does the same on a private server.
test('a semicolon key reaches the pane only as backslash-semicolon', { skip: !hasTmux }, async () => {
  const socket = `wc-r3-${process.pid}`;
  const tmux = (...args) => spawnSync('tmux', ['-L', socket, ...args], { encoding: 'utf8' });
  try {
    assert.equal(tmux('new-session', '-d', '-s', 'probe', '-x', '80', '-y', '10', 'cat').status, 0);
    // The page's key for ';' (viewer/pages/term-view.js) is the two-character string \;
    const pageKey = await (async () => {
      const source = await fs.readFile(path.join(__dirname, '..', 'pages', 'term-view.js'), 'utf8');
      const line = source.split('\n').find((text) => text.includes("char === ';'"));
      return Function(`const char = ';'; ${line.trim().replace(/^if \(char === ';'\) /, '')}`)();
    })();
    assert.equal(pageKey, '\\;');
    for (const key of ['a', pageKey, 'b']) assert.equal(tmux('send-keys', '-t', 'probe', key).status, 0);
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.match(tmux('capture-pane', '-p', '-t', 'probe').stdout, /^a;b$/m);
    // The old key, a bare ';', is tmux's command separator and types nothing.
    tmux('send-keys', '-t', 'probe', 'Enter');
    tmux('send-keys', '-t', 'probe', ';');
    tmux('send-keys', '-t', 'probe', 'c');
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.doesNotMatch(tmux('capture-pane', '-p', '-t', 'probe').stdout, /^;c$/m);
  } finally {
    tmux('kill-server');
  }
});

test('the sessions response marks the hub entry whatever name it is registered under', async () => {
  const machine = await startMachine();
  const other = await startMachine();
  const state = await makeDir('app-hubflag-');
  const entry = (name, m) => ({ name, address: '127.0.0.1', port: m.port, secret: m.secret });
  await fs.writeFile(path.join(state, 'machines.json'), JSON.stringify({
    hearth: entry('hearth', machine), 'node-2': entry('node-2', other),
  }));
  await fs.writeFile(path.join(state, 'machine.json'), JSON.stringify({ host: '127.0.0.1', port: machine.port }));
  const server = await startServer({ stateDir: state });
  try {
    const result = await api({ server }, '/sessions');
    assert.equal(result.status, 200);
    const byName = Object.fromEntries(result.body.map((group) => [group.machine, group]));
    assert.equal(byName.hearth.hub, true);
    assert.equal(byName['node-2'].hub, false);
  } finally {
    await server.stop(); await machine.stop(); await other.stop();
  }
});
