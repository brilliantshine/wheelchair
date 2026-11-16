'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { createHarness } = require('./harness');
(async () => {
  let h, failed = false;
  async function check(name, fn) {
    try { await fn(); console.log(`PASS ${name}`); }
    catch (error) { failed = true; console.log(`FAIL ${name}: ${error.message}`); }
  }
  try {
    h = await createHarness();
    await check('readiness through hub', async () => {
      const expected = execFileSync('claude', ['--version'], { env: h.env, encoding: 'utf8' }).trim();
      const result = await h.callHub('/api/agents');
      assert(result.machines.some(m => m.machine === 'harness' && m.reachable));
      await h.waitFor(() => h.statuses.length);
      assert.equal(h.statuses.at(-1).claude.installed, true);
      assert.equal(h.statuses.at(-1).claude.version, expected);
    });
    let session;
    await check('start', async () => {
      session = await h.callMachine('/v1/sessions', 'POST', { name: 'wc-smoke-lead', role: 'lead', cli: 'claude', thread_id: 'smoke', token: 'smoke-token', project_dir: h.paths.clone });
      assert.equal(session.branch, 'wc/smoke');
      assert.equal(execFileSync('git', ['-C', session.worktree, 'branch', '--show-current'], { env: h.env, encoding: 'utf8' }).trim(), 'wc/smoke');
      assert(h.tmux('list-sessions', '-F', '#S').stdout.split('\n').includes(session.name));
      assert((await h.callMachine('/v1/sessions')).some(s => s.name === session.name && s.running));
      assert.equal(session.command[0], 'claude');
    });
    await check('stop', async () => {
      assert(session, 'start failed');
      await h.callMachine(`/v1/sessions/${encodeURIComponent(session.name)}`, 'DELETE');
      assert(!h.tmux('list-sessions', '-F', '#S').stdout.split('\n').includes(session.name));
      assert(!(await h.callMachine('/v1/sessions')).some(s => s.name === session.name && s.running));
    });
  } catch (error) { failed = true; console.log(`FAIL setup: ${error.stack}`); }
  if (h) {
    try {
      const result = await h.teardown();
      await new Promise(resolve => setTimeout(resolve, 5000));
      assert(result.runFolderGone && !fs.existsSync(h.dir), `run folder remains: ${h.dir}`);
      assert(result.privateTmuxGone, 'private tmux server remains');
      assert.equal(result.leftoverProcesses, 0, 'run processes remain');
      console.log(`PASS clean: run folder absent after 5s: ${h.dir}; leftover processes: ${result.leftoverProcesses}; private tmux server gone`);
    } catch (error) { failed = true; console.log(`FAIL clean: ${error.message}`); }
  } else console.log('FAIL clean: setup did not complete');
  process.exitCode = failed ? 1 : 0;
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
