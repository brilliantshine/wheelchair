'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { effectivePaths, assertIsolated } = require('../smoke/harness');

test('effective process paths and isolation gate reflect argv and child HOME', () => {
  const dir = '/tmp/harness-test';
  const env = { HOME: '/home/example' };
  const hubArgv = ['viewer/server.js', '--port', '12345', '--cache-root', `${dir}/cache`, '--state-dir', `${dir}/hub`];
  const machineArgv = ['machine/service.js', '--stateDir', `${dir}/machine`, '--port', '12346'];
  const resolve = (hub = hubArgv, machine = machineArgv) => effectivePaths({ hubArgv: hub, machineArgv: machine, env });
  const actual = resolve();
  assert.deepEqual(actual, { paths: { hubState: `${dir}/hub`, hubCache: `${dir}/cache`, machineState: `${dir}/machine`, spool: `${dir}/machine/spool`, worktrees: `${dir}/machine/worktrees`, settings: `${dir}/machine/settings` }, ports: { hub: 12345, machine: 12346 } });
  assert.doesNotThrow(() => assertIsolated(actual.paths, actual.ports, dir));
  const drop = (argv, flag) => argv.filter((_, index) => index !== argv.indexOf(flag) && index !== argv.indexOf(flag) + 1);
  for (const [result, key, expected] of [
    [resolve(drop(hubArgv, '--state-dir')), 'hubState', path.join(env.HOME, '.local/state/wheelchair')],
    [resolve(drop(hubArgv, '--cache-root')), 'hubCache', path.join(env.HOME, '.cache/agent-graphs')],
    [resolve(hubArgv, drop(machineArgv, '--stateDir')), 'machineState', path.join(env.HOME, '.local/state/wheelchair')],
  ]) {
    assert.equal(result.paths[key], expected);
    assert.throws(() => assertIsolated(result.paths, result.ports, dir), /unsafe path/);
  }
  assert.throws(() => assertIsolated(actual.paths, { ...actual.ports, machine: 7374 }, dir), /unsafe port: 7374/);
});
