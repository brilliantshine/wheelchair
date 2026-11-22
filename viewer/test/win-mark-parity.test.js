'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../pages/project-tools.js'), 'utf8');
const sandbox = { window: {}, document: {} };
vm.runInNewContext(source, sandbox);
const { windowsEligible, WINDOWS_URL } = sandbox.window.ProjectTools;

test('the page eligibility regex equals the machine one', (t) => {
  let machine;
  try { require.resolve('../../machine/lib/win-mark'); } catch { t.skip('machine/lib/win-mark.js not present yet'); return; }
  machine = require('../../machine/lib/win-mark').WINDOWS_URL;
  assert.equal(WINDOWS_URL.source, machine.source);
  assert.equal(WINDOWS_URL.flags, machine.flags);
});

test('the page eligibility function', () => {
  const yes = ['http://localhost', 'http://localhost:8080/mcp', 'http://127.0.0.1:1', 'http://127.0.0.1:65535/x?y#z',
    'HTTP://LOCALHOST:80', 'http://localhost/mcp', 'http://localhost?a=1', 'http://localhost#f', 'http://LocalHost:9000/a'];
  const no = ['https://localhost:8080', 'http://localhost:0', 'http://localhost:65536', 'http://localhost:123456', 'http://localhost.example.com',
    'http://localhost:80a', 'http:localhost:8080', 'http:\\\\localhost', 'http://user@localhost', 'http://[::1]:80', 'http://0.0.0.0:80',
    ' http://localhost', 'http://127.0.0.10', '', 'http://localhostx', 'http://localhost:/x'];
  for (const url of yes) assert.equal(windowsEligible('http', url), true, url);
  for (const url of no) assert.equal(windowsEligible('http', url), false, url);
  assert.equal(windowsEligible('sse', 'http://localhost:80'), false);
  assert.equal(windowsEligible(undefined, 'http://localhost:80'), false);
  assert.equal(windowsEligible('http', undefined), false);
});
