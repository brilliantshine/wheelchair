'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHarness } = require('./harness');

const auth = path.join(os.homedir(), '.pi', 'agent', 'auth.json');
if (spawnSync('sh', ['-c', 'command -v pi'], { stdio: 'ignore' }).status !== 0) {
  console.log('SKIP | pi is not on PATH');
} else {
  let available = false;
  try { const value = JSON.parse(fs.readFileSync(auth, 'utf8')); available = !!value && Object.hasOwn(value, 'openrouter'); } catch {}
  if (!available) console.log('SKIP | Pi auth.json has no readable openrouter entry');
  else run().catch(() => { console.error('setup | FAIL | unexpected error'); process.exitCode = 1; });
}

async function run() {
  const checks = [], chats = [], rows = [];
  let h;
  const safe = value => String(value).replace(/sk-or-[A-Za-z0-9_-]+/g, '[redacted]');
  const row = (name, ok, detail) => { checks.push(ok); const line = `${name} | ${ok ? 'PASS' : 'FAIL'} | ${safe(detail)}`; rows.push(line); console.log(line); };
  const forceFail = process.env.PI_LIVE_FORCE_FAIL === '1';
  const check = async (name, fn) => { try { await fn(); } catch (error) { row(name, false, error.message); } };
  const scan = (dir, skip = []) => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      const file = path.join(dir, entry.name);
      if (entry.name === '.git' || skip.includes(file)) return [];
      return entry.isDirectory() ? scan(file, skip) : entry.isFile() && fs.readFileSync(file).includes('sk-or-') ? [file] : [];
    });
  };
  const diagnostics = async () => {
    const out = [];
    const section = async (name, fn) => { out.push(`=== ${name}`); try { const text = await fn(); out.push(...String(text).split('\n')); } catch (error) { out.push(`section failed: ${error.message}`); } };
    await section('checks', () => rows.join('\n'));
    await section('panes', () => {
      const names = (h.tmux('list-sessions', '-F', '#{session_name}').stdout || '').split('\n').filter(Boolean);
      return names.map(name => `--- ${name}\n${h.tmux('capture-pane', '-p', '-J', '-S', '-200', '-t', `=${name}:`).stdout || ''}`).join('\n');
    });
    await section('machine sessions', async () => JSON.stringify((await h.callMachine('/v1/sessions')).map(({ token, ...rest }) => rest)));
    await section('hub thread', async () => {
      const t = await getThread();
      return JSON.stringify({ sessions: t.sessions.map(({ name, role, ready, live, turn_ended, queue, delivery_error }) => ({ name, role, ready, live, turn_ended, queue, delivery_error })), cards: t.cards.map(c => ({ kind: c.kind, session: c.session })) });
    });
    await section('logs', () => h.logs().map((log, index) => `--- log ${index}\n${String(log).split('\n').slice(-300).join('\n')}`).join('\n'));
    try {
      const file = path.join(process.env.PI_LIVE_DIAG_DIR || os.tmpdir(), `pi-live-failure-${new Date().toISOString().replace(/:/g, '-')}.txt`);
      fs.writeFileSync(file, out.map(safe).join('\n') + '\n', { mode: 0o600 });
      fs.chmodSync(file, 0o600);
      console.log(`diagnostics | ${file}`);
    } catch {}
  };
  let getThread;
  try {
    const model = 'deepseek/deepseek-v4.1-flash-1017';
    h = await createHarness({ mode: 'live', piAuthSource: auth, modelPins: ['lead', 'light', 'standard', 'heavy', 'critical'].map(tier => `openrouter.${tier} = ${model}`).join('\n') + '\n', hubSettings: { lead_order: ['openrouter'], worker_order: ['openrouter'], review_families: 'both', held_back: { worker: false, reviewer: false, verifier: false, mapper: false }, margin: 0, leave: 0 } });
    const thread = await h.callHub('/api/threads', 'POST', { project: h.paths.clone, machine: 'harness', cli: 'pi', title: 'Pi live check' });
    const id = thread.id, lead = thread.sessions.find(s => s.role === 'lead').name;
    getThread = async () => (await h.callHub('/api/threads')).threads.find(t => t.id === id);
    const chat = async () => { const value = await h.callHub(`/api/threads/${id}/chat`); chats.push(JSON.stringify(value)); return value; };
    await check('lead chat', async () => {
      try { await h.waitFor(async () => (await h.callMachine('/v1/sessions')).some(s => s.name === lead && s.cli === 'pi' && s.status === 'ready'), 120000); } catch { throw new Error('lead did not become ready'); }
      await h.callHub(`/api/threads/${id}/messages`, 'POST', { text: 'Reply in one line: hello.' });
      try { await h.waitFor(async () => (await chat()).items.some(item => item.type === 'assistant' && item.id?.startsWith(`${lead}#`) && item.text?.trim()), 120000); } catch { const view = await chat(); throw new Error(`lead chat missing assistant text; items ${JSON.stringify(view.items.map(item => ({ type: item.type, id: item.id, hasText: !!item.text })))}`); }
      row('lead chat', true, 'Pi lead ready and assistant text appears in chat');
    });
    if (forceFail) row('forced', false, 'PI_LIVE_FORCE_FAIL set');
    if (!forceFail) await check('reviewer result', async () => {
      const response = await fetch(`http://127.0.0.1:${h.ports.hub}/wheelchair/api/machine/session`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-wheelchair-machine-secret': 'harness-machine-secret' }, body: JSON.stringify({ calling_session: lead, action: 'start', role: 'reviewer', provider: 'openrouter', attempt_id: 'pi-live-review', brief: 'Reply in one line: review complete.' }) });
      const started = await response.json(); assert(response.ok, `reviewer start returned ${response.status}`);
      const reviewer = started.session.name;
      await h.waitFor(async () => { const t = await getThread(); return t.cards.some(c => c.kind === 'result' && c.session === reviewer && c.summary?.trim()) && (t.sent?.some(s => s.source === 'result' && s.text?.includes(reviewer))); }, 180000);
      row('reviewer result', true, 'Pi reviewer result card has a summary and is delivered to the lead');
    });
    if (!forceFail) await check('spend', async () => {
      const result = await h.waitFor(async () => { const machine = await h.callMachine('/v1/spend'); const account = machine.accounts.find(a => a.account === 'default-openrouter'); const usage = await h.callHub('/api/usage'); const spend = usage.providers.openrouter.spend; return account?.today > 0 && spend?.today > 0 && !spend.incomplete && { account, spend }; }, 30000);
      row('spend', true, `machine today $${result.account.today}; hub today $${result.spend.today}`);
    });
    await check('key isolation', async () => {
      await chat();
      const skip = [path.join(h.paths.home, '.pi', 'agent')];
      const leaks = [h.paths.hubState, h.paths.hubCache, h.paths.machineState].flatMap(dir => scan(dir, skip));
      assert.equal(leaks.length, 0, 'key marker found in hub, cache or machine state files');
      assert(!chats.some(value => value.includes('sk-or-')), 'key marker found in chat responses');
      assert(!h.logs().some(value => value.includes('sk-or-')), 'key marker found in machine or hub logs');
      row('key isolation', true, 'no key marker in hub, cache and machine state files, chat, or logs');
    });
  } catch (error) { row('setup', false, error.message); }
  finally { if (h) { if (checks.some(x => !x)) await diagnostics().catch(() => {}); const cleanup = await h.teardown(); console.log(`cleanup ${JSON.stringify(cleanup)}`); } }
  console.log(`${checks.filter(Boolean).length} passed; ${checks.filter(x => !x).length} failed`);
  if (checks.some(x => !x)) process.exitCode = 1;
}
