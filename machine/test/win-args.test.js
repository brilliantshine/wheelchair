'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseWinOp } = require('../lib/win-args');

test('parses every operation', () => {
  for (const op of ['info', 'sync', 'windows']) assert.deepEqual(parseWinOp(op, []), {});
  assert.deepEqual(parseWinOp('run', ['--timeout', '1', '--env', 'A=x=y', '--', 'app', 'a']), { timeout: 1, env: [['A', 'x=y']], program: 'app', argv: ['a'] });
  assert.deepEqual(parseWinOp('run', ['--', 'app']), { timeout: 540, env: [], program: 'app', argv: [] });
  assert.deepEqual(parseWinOp('start', ['--env', '_A=', '--', 'app']), { env: [['_A', '']], program: 'app', argv: [] });
  for (const op of ['status', 'stop']) { assert.deepEqual(parseWinOp(op, []), { id: null }); assert.deepEqual(parseWinOp(op, ['a']), { id: 'a' }); }
  assert.deepEqual(parseWinOp('shot', ['0xFF']), { handle: 255 });
  assert.deepEqual(parseWinOp('shot', ['10']), { handle: 10 });
  assert.deepEqual(parseWinOp('path', ['x']), { path: 'x' });
});

test('rejects invalid operations and arguments with 400', () => {
  const bad = [['unknown', []], ['info', ['x']], ['sync', ['x']], ['windows', ['x']], ['status', ['a', 'b']], ['stop', ['a', 'b']], ['path', []], ['path', ['']], ['shot', []], ['shot', ['-1']], ['shot', ['0x']], ['shot', ['9007199254740992']], ['run', []], ['run', ['--']], ['run', ['--', '']], ['run', ['app']], ['run', ['--timeout', '0', '--', 'a']], ['run', ['--timeout', '541', '--', 'a']], ['run', ['--timeout', '1.5', '--', 'a']], ['run', ['--timeout', '1', '--timeout', '2', '--', 'a']], ['start', ['--timeout', '1', '--', 'a']], ['run', ['--env', 'BAD', '--', 'a']], ['run', ['--env', '1A=x', '--', 'a']], ['run', ['--env', 'WHEELCHAIR_SESSION_TOKEN=x', '--', 'a']], ['run', ['--env']], ['run', [1]]];
  for (const [op, args] of bad) assert.throws(() => parseWinOp(op, args), error => error.status === 400 && !!error.message, `${op} ${args}`);
});
