'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { zip } = require('../app/zip.js');
test('stored ZIP has names and bytes readable by Python', () => {
  const bytes = zip([{ name: 'plan/MAP.md', data: Buffer.from('hello') }, { name: 'plan/PLAN.md', data: Buffer.from([0, 255]) }]);
  const output = execFileSync('python3', ['-c', 'import sys,zipfile,io,json; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); print(json.dumps({n:list(z.read(n)) for n in z.namelist()}))'], { input: bytes });
  assert.deepEqual(JSON.parse(output), { 'plan/MAP.md': [104,101,108,108,111], 'plan/PLAN.md': [0,255] });
});
