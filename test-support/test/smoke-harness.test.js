'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { effectivePaths, assertIsolated, runProcesses, waitForRunProcesses } = require('../smoke/harness');

test('run process wait stops when empty and escalates within its deadlines', () => {
  let time = 0, present = true;
  const signals = [];
  const proc = {
    readdirSync: () => present ? ['123'] : [],
    statSync: () => ({ uid: process.getuid() }),
    readFileSync: () => 'HOME=/run/home\0',
    readlinkSync: () => '/elsewhere',
  };
  const options = { proc, now: () => time, sleep: ms => { time += ms; }, kill: (pid, signal) => signals.push([pid, signal]), timeouts: [200, 100, 100] };
  assert.equal(waitForRunProcesses('/run', { home: '/run/home' }, { ...options, sleep: ms => { time += ms; present = false; } }), 0);
  assert.deepEqual(signals, []);
  time = 0; present = true;
  assert.equal(waitForRunProcesses('/run', { home: '/run/home' }, options), 1);
  assert.equal(time, 400);
  assert.deepEqual(signals, [[123, 'SIGTERM'], [123, 'SIGKILL']]);
});

test('run process matcher restricts uid, exact environment and directory boundaries', () => {
  const entries = {
    1: { env: 'HOME=/run/home\0', cwd: '/elsewhere' },
    2: { env: 'TMUX_TMPDIR=/run/tmux\0', cwd: '/elsewhere' },
    3: { env: '', cwd: '/run/subdir' },
    4: { env: 'HOME=/run/home-other\0', cwd: '/run-other' },
    5: { env: 'HOME=/run/home\0', cwd: '/run', uid: process.getuid() + 1 },
    6: { env: 'HOME=/real/home\0', cwd: '/elsewhere' },
    7: { unreadable: true },
  };
  const fake = {
    readdirSync: () => [...Object.keys(entries), 'self'],
    statSync: p => { const e = entries[p.split('/')[2]]; if (e.unreadable) throw Error(); return { uid: e.uid ?? process.getuid() }; },
    readFileSync: p => entries[p.split('/')[2]].env,
    readlinkSync: p => entries[p.split('/')[2]].cwd,
  };
  assert.deepEqual(runProcesses('/run', { home: '/run/home', tmux: '/run/tmux' }, fake), [1, 2, 3]);
  assert.deepEqual(runProcesses('/run', { tmux: '/run/tmux' }, fake), [2, 3]);
});

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
