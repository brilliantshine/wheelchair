'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHarness } = require('./harness');

const auth = '/home/collin/.pi/agent/auth.json';
if (spawnSync('sh', ['-c', 'command -v pi'], { stdio: 'ignore' }).status !== 0) {
  console.log('SKIP | pi is not on PATH');
} else {
  let available = false;
  try { const value = JSON.parse(fs.readFileSync(auth, 'utf8')); available = !!value && Object.hasOwn(value, 'openrouter'); } catch {}
  if (!available) console.log('SKIP | Pi auth.json has no readable openrouter entry');
  else run().catch(() => { console.error('setup | FAIL | unexpected error'); process.exitCode = 1; });
}

async function run() {
  const checks = [], chats = [];
  let h;
  const safe = value => String(value).replace(/sk-or-[A-Za-z0-9_-]+/g, '[redacted]');
  const row = (name, ok, detail) => { checks.push(ok); console.log(`${name} | ${ok ? 'PASS' : 'FAIL'} | ${safe(detail)}`); };
  const check = async (name, fn) => { try { await fn(); } catch (error) { row(name, false, error.message); } };
  const scan = dir => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      const file = path.join(dir, entry.name);
      return entry.isDirectory() ? scan(file) : entry.isFile() && fs.readFileSync(file).includes('sk-or-') ? [file] : [];
    });
  };
  try {
    const model = 'deepseek/deepseek-v4.1-flash-1017';
    h = await createHarness({ mode: 'live', piAuthSource: auth, modelPins: ['lead', 'light', 'standard', 'heavy', 'critical'].map(tier => `openrouter.${tier} = ${model}`).join('\n') + '\n', hubSettings: { lead_order: ['openrouter'], worker_order: ['openrouter'], review_families: 'both', held_back: { worker: false, reviewer: false, verifier: false, mapper: false }, margin: 0, leave: 0 } });
    const thread = await h.callHub('/api/threads', 'POST', { project: h.paths.clone, machine: 'harness', cli: 'pi', title: 'Pi live check' });
    const id = thread.id, lead = thread.sessions.find(s => s.role === 'lead').name;
    const getThread = async () => (await h.callHub('/api/threads')).threads.find(t => t.id === id);
    const chat = async () => { const value = await h.callHub(`/api/threads/${id}/chat`); chats.push(JSON.stringify(value)); return value; };
    await check('lead chat', async () => {
      try { await h.waitFor(async () => (await h.callMachine('/v1/sessions')).some(s => s.name === lead && s.cli === 'pi' && s.status === 'ready'), 120000); } catch { throw new Error('lead did not become ready'); }
      await h.callHub(`/api/threads/${id}/messages`, 'POST', { text: 'Reply in one line: hello.' });
      try { await h.waitFor(async () => (await chat()).items.some(item => item.type === 'assistant' && item.id?.startsWith(`${lead}#`) && item.text?.trim()), 120000); } catch { const view = await chat(); throw new Error(`lead chat missing assistant text; items ${JSON.stringify(view.items.map(item => ({ type: item.type, id: item.id, hasText: !!item.text })))}`); }
      row('lead chat', true, 'Pi lead ready and assistant text appears in chat');
    });
    await check('reviewer result', async () => {
      const response = await fetch(`http://127.0.0.1:${h.ports.hub}/wheelchair/api/machine/session`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-wheelchair-machine-secret': 'harness-machine-secret' }, body: JSON.stringify({ calling_session: lead, action: 'start', role: 'reviewer', provider: 'openrouter', attempt_id: 'pi-live-review', brief: 'Reply in one line: review complete.' }) });
      const started = await response.json(); assert(response.ok, `reviewer start returned ${response.status}`);
      const reviewer = started.session.name;
      await h.waitFor(async () => { const t = await getThread(); return t.cards.some(c => c.kind === 'result' && c.session === reviewer && c.summary?.trim()) && (t.sent.some(s => s.source === 'result' && s.text?.includes(reviewer)) || t.sessions.find(s => s.name === lead)?.queue?.some(s => s.source === 'result' && s.text?.includes(reviewer))); }, 180000);
      row('reviewer result', true, 'Pi reviewer result card has a summary and reaches the lead');
    });
    await check('spend', async () => {
      const result = await h.waitFor(async () => { const machine = await h.callMachine('/v1/spend'); const account = machine.accounts.find(a => a.account === 'default-openrouter'); const usage = await h.callHub('/api/usage'); const spend = usage.providers.openrouter.spend; return account?.today > 0 && spend?.today > 0 && !spend.incomplete && { account, spend }; }, 30000);
      row('spend', true, `machine today $${result.account.today}; hub today $${result.spend.today}`);
    });
    await check('key isolation', async () => {
      await chat();
      const leaks = [...scan(h.paths.hubState), ...scan(path.join(h.paths.machineState, 'transcripts'))];
      assert.equal(leaks.length, 0, 'key marker found in hub files or kept transcripts');
      assert(!chats.some(value => value.includes('sk-or-')), 'key marker found in chat responses');
      assert(!h.logs().some(value => value.includes('sk-or-')), 'key marker found in machine or hub logs');
      row('key isolation', true, 'no key marker in hub files, chat, kept transcripts, or logs');
    });
  } catch (error) { row('setup', false, error.message); }
  finally { if (h) { const cleanup = await h.teardown(); console.log(`cleanup ${JSON.stringify(cleanup)}`); } }
  console.log(`${checks.filter(Boolean).length} passed; ${checks.filter(x => !x).length} failed`);
  if (checks.some(x => !x)) process.exitCode = 1;
}
