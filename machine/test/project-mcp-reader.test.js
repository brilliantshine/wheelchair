'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { makeTempSync } = require('../../test-support/run-dir');
const { readProjectMcp } = require('../lib/project-mcp');

test('reader accepts sse, validates headers and hashes file bytes', async () => {
  const dir = makeTempSync();
  const bytes = Buffer.from(JSON.stringify({ mcpServers: { stream: { type: 'sse', url: 'https://example.test', headers: { Key: 'value' } }, bad: { type: 'http', url: 'x', headers: { Key: 1 } }, array: { type: 'sse', url: 'x', headers: [] } } }));
  fs.writeFileSync(path.join(dir, '.mcp.json'), bytes);
  const result = await readProjectMcp(dir);
  assert.deepEqual(Object.keys(result.mcp.servers), ['stream']);
  assert.deepEqual(result.warnings, ['bad', 'array'].map(name => ({ names: [name], text: `${name}: skipped: not a valid stdio, http or sse entry` })));
  assert.equal(result.hash, crypto.createHash('sha256').update(bytes).digest('hex'));
  fs.writeFileSync(path.join(dir, '.mcp.json'), '{');
  const invalid = await readProjectMcp(dir);
  assert.equal(invalid.hash, crypto.createHash('sha256').update('{').digest('hex'));
  assert.deepEqual(invalid.warnings, [{ names: [], text: '.mcp.json could not be read: "invalid JSON"' }]);
});

test('missing file has null hash', async () => {
  assert.deepEqual(await readProjectMcp(makeTempSync()), { mcp: null, warnings: [], hash: null });
});

test('marks duplicate header keys in kept header objects without marking other paths', async () => {
  const { DUPLICATE_HEADERS } = require('../lib/project-mcp');
  const dir = makeTempSync();
  fs.writeFileSync(path.join(dir, '.mcp.json'), String.raw`{
    "mcpServers": {
      "exact": {"type":"http", "url":"x", "headers":{"X-Fixture":"1", "X-Fixture":"2"}},
      "case": {"type":"sse", "url":"x", "headers":{"Authorization":"1", "authorization":"2"}},
      "escaped": {"type":"http", "url":"x", "headers":{"X":"1", "\u0058":"2"}},
      "repeated": {"type":"http", "url":"x", "headers":{"a":"1", "a":"2"}, "headers":{"b":"3"}},
      "clean": {"type":"http", "url":"x", "headers":{"X":"1"}, "env":{"z":"1", "z":"2"}},
      "local": {"command":"x", "headers":{"a":"1", "a":"2"}}
    },
    "other": {"mcpServers":{"clean":{"headers":{"a":"1", "a":"2"}}}}
  }`);
  const { mcp, warnings } = await readProjectMcp(dir);
  assert.deepEqual(warnings, []);
  for (const name of ['exact', 'case', 'escaped']) {
    const entry = mcp.servers[name];
    assert.equal(entry[DUPLICATE_HEADERS], true, name);
    assert.deepEqual(Object.keys(entry), Object.keys(JSON.parse(JSON.stringify(entry))));
    assert.ok(!JSON.stringify(entry).includes('duplicate headers'));
  }
  for (const name of ['repeated', 'clean', 'local']) assert.equal(mcp.servers[name][DUPLICATE_HEADERS], undefined, name);
});

test('only duplicate headers in the last occurrence at each level count', async () => {
  const { DUPLICATE_HEADERS } = require('../lib/project-mcp');
  const dir = makeTempSync();
  const clean = '"headers":{"Authorization":"1"}';
  const duplicate = '"headers":{"Authorization":"1","authorization":"2"}';
  const server = headers => `{"type":"http","url":"x",${headers}}`;
  for (const [label, text, expected] of [
    ['mcpServers overwritten', `{"mcpServers":{"web":${server(duplicate)}},"mcpServers":{"web":${server(clean)}}}`, undefined],
    ['mcpServers kept', `{"mcpServers":{"web":${server(clean)}},"mcpServers":{"web":${server(duplicate)}}}`, true],
    ['server overwritten', `{"mcpServers":{"web":${server(duplicate)},"web":${server(clean)}}}`, undefined],
    ['server kept', `{"mcpServers":{"web":${server(clean)},"web":${server(duplicate)}}}`, true],
    ['headers overwritten', `{"mcpServers":{"web":${server(`${duplicate},${clean}`)}}}`, undefined],
    ['headers kept', `{"mcpServers":{"web":${server(`${clean},${duplicate}`)}}}`, true],
  ]) {
    fs.writeFileSync(path.join(dir, '.mcp.json'), text);
    const result = await readProjectMcp(dir);
    assert.equal(result.mcp.servers.web[DUPLICATE_HEADERS], expected, label);
  }
});

test('deep nesting before or after servers does not stop duplicate detection', async () => {
  const { DUPLICATE_HEADERS } = require('../lib/project-mcp');
  const dir = makeTempSync('reader-deep-');
  const server = '"mcpServers":{"a":{"type":"http","url":"x","headers":{"X-Fixture":"1","X-Fixture":"2"}}}';
  const arrays = '['.repeat(15000) + ']'.repeat(15000);
  const objectDepth = Math.floor((32768 - Buffer.byteLength(`{"deep":0,${server}}`)) / 5);
  const objects = '{"":'.repeat(objectDepth) + '0' + '}'.repeat(objectDepth);
  const arrayDepth = Math.floor((32768 - Buffer.byteLength(`{"deep":,${server}}`)) / 2);
  const maxArrays = '['.repeat(arrayDepth) + ']'.repeat(arrayDepth);
  for (const [label, text] of [
    ['arrays before', `{"deep":${arrays},${server}}`],
    ['objects before', `{"deep":${objects},${server}}`],
    ['arrays after', `{${server},"deep":${arrays}}`],
    ['objects after', `{${server},"deep":${objects}}`],
    ['maximum arrays before', `{"deep":${maxArrays},${server}}`],
  ]) {
    fs.writeFileSync(path.join(dir, '.mcp.json'), text);
    const result = await readProjectMcp(dir);
    assert.ok(result.mcp, `${label}: ${JSON.stringify(result.warnings)}`);
    assert.equal(result.mcp.servers.a[DUPLICATE_HEADERS], true, label);
  }
});

test('omits Windows programs outside WSL without warnings', async () => {
  const { hasWindowsProgram } = require('../lib/project-mcp');
  const dir = makeTempSync();
  fs.writeFileSync(path.join(dir, '.mcp.json'), JSON.stringify({ mcpServers: { win: { command: '/mnt/c/Windows/cmd.EXE' }, cmd: { command: '/mnt/c/tool.cmd' }, web: { type: 'http', url: 'x' } } }));
  const normal = await readProjectMcp(dir);
  assert.equal(hasWindowsProgram(normal.mcp), true);
  const result = await readProjectMcp(dir, { wsl: false });
  assert.deepEqual(Object.keys(result.mcp.servers), ['cmd', 'web']);
  assert.deepEqual(result.warnings, []);
  assert.equal(hasWindowsProgram(result.mcp), false);
  assert.equal(hasWindowsProgram(null), false);
});
