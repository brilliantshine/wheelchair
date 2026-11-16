'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHarness } = require('./harness');

const selected = new Set();
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] !== '--only' || !process.argv[i + 1]) { console.error('usage: live.sh [--only slow-start|tiers|permission]'); process.exit(2); }
  for (const name of process.argv[++i].split(',')) {
    if (!['slow-start', 'tiers', 'permission'].includes(name)) { console.error(`unknown check: ${name}`); process.exit(2); }
    selected.add(name);
  }
}
if (!selected.size) ['slow-start', 'tiers', 'permission'].forEach(x => selected.add(x));
const rows = [];
function row(name, ok, detail) { rows.push({ name, ok, detail: String(detail).replace(/\s+/g, ' ') }); }
function files(dir) {
  let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return entries.flatMap(e => e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
function transcriptModel(h, provider, id) {
  assert(id, 'CLI session id missing');
  const base = provider === 'claude' ? path.join(h.env.CLAUDE_CONFIG_DIR || path.join(h.env.HOME, '.claude'), 'projects') : path.join(h.env.CODEX_HOME || path.join(h.env.HOME, '.codex'), 'sessions');
  const file = files(base).find(f => provider === 'claude' ? path.basename(f) === `${id}.jsonl` : path.basename(f).endsWith(`${id}.jsonl`));
  assert(file, `transcript for ${id} not found under ${base}`);
  const records = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return {}; } });
  const models = provider === 'claude' ? records.filter(r => r.type === 'assistant').map(r => r.message?.model) : records.filter(r => r.type === 'turn_context').map(r => r.payload?.model);
  const model = models.filter(Boolean).at(-1); assert(model, `model missing in ${file}`); return model;
}
(async () => {
  let h;
  try {
    h = await createHarness({ mode: 'live', slowOriginSeconds: 8 });
    const thread = async () => (await h.callHub('/api/threads')).threads.find(t => t.id === h.threadId);
    const session = async name => (await h.agent({ action: 'list' })).sessions.find(s => s.name === name);
    let attempt = 0;
    async function start(provider, tier, brief) {
      return h.agent({ action: 'start', role: 'worker', provider, tier, attempt_id: `live-${++attempt}`, brief });
    }
    async function stop(name) {
      await h.agent({ action: 'stop', name });
      const s = await session(name); assert(s && s.live === false && s.status === 'stopped', 'stopped session not retained');
    }
    async function tier(provider, tier, slow) {
      let result, name, startTime;
      try {
        const status = await h.callMachine('/v1/status');
        const account = status.accounts?.find(a => a.id === `default-${provider}`);
        if (account && !account.logged_in) throw new Error('skipped (not logged in)');
        startTime = Date.now();
        result = await start(provider, tier, 'Reply with the single word ok and stop.'); name = result.session.name;
        const elapsed = (Date.now() - startTime) / 1000;
        if (slow) row('slow-start', elapsed > 5 && h.counts[name] === 1 && !result.note && result.session.provider === provider, `request succeeded; ${elapsed.toFixed(2)} s; ${h.counts[name] || 0} start requests${result.note ? `; ${result.note}` : ''}`);
        if (result.note || result.session.provider !== provider) throw new Error(result.note || `provider ${result.session.provider}, requested ${provider}`);
        if (selected.has('tiers')) {
          const done = await h.waitFor(async () => { const s = await session(name); return s?.turn_ended && s; }, 180000);
          const expected = execFileSync('bash', [path.join(__dirname, '../../codex/model.sh'), provider, tier], { env: h.env, encoding: 'utf8' }).trim();
          const actual = await h.waitFor(() => { try { return transcriptModel(h, provider, provider === 'claude' ? done.cli_session_id : done.codex_thread_id); } catch { return null; } }, 10000);
          assert.equal(actual, expected, `transcript model ${actual}, pin ${expected}`);
          row(`${tier}/${provider}`, true, `model ${actual}`);
        }
      } catch (error) {
        if (slow && !rows.some(r => r.name === 'slow-start')) row('slow-start', false, error.message);
        if (selected.has('tiers')) row(`${tier}/${provider}`, false, /not logged in|not signed in/i.test(error.message) ? 'skipped (not logged in)'  : error.message);
      } finally {
        if (name) try { await stop(name); } catch (error) { row(`${tier}/${provider} stop`, false, error.message); }
      }
    }
    if (selected.has('slow-start') || selected.has('tiers')) {
      const pairs = selected.has('tiers') ? ['light', 'standard', 'heavy', 'critical'].flatMap(t => ['claude', 'gpt'].map(p => [p, t])) : [['claude', 'light']];
      for (const [p, t] of pairs) await tier(p, t, selected.has('slow-start') && p === 'claude' && t === 'light');
    }
    if (selected.has('permission')) {
      let name;
      try {
        const settings = await h.callHub('/api/settings'); assert.equal(settings.permission_mode, 'auto');
        const started = await start('claude', 'light', 'Run the shell command `touch smoke-ok` and then stop.'); name = started.session.name;
        assert(!started.note && started.session.provider === 'claude', started.note || 'wrong provider');
        const open = await h.waitFor(async () => { const t = await thread(); const s = t.sessions.find(x => x.name === name); const card = t.cards.find(c => c.id === s?.needs_card && c.kind === 'needs' && c.system && !c.answered); return s?.permission_open && card && { s, card }; }, 180000);
        const pane = h.tmux('capture-pane', '-pt', name).stdout;
        assert(/(?:Yes|Allow)/i.test(pane), 'approval option absent from pane');
        const sent = h.tmux('send-keys', '-t', name, 'Enter'); assert.equal(sent.status, 0, sent.stderr);
        await h.waitFor(async () => { const t = await thread(); const s = t.sessions.find(x => x.name === name); return !s.permission_open && t.cards.find(c => c.id === open.card.id)?.answered; }, 30000);
        await h.waitFor(() => fs.existsSync(path.join(open.s.worktree, 'smoke-ok')), 30000);
        row('permission', true, 'prompt opened, Enter approved, card answered, smoke-ok exists');
      } catch (error) { row('permission', false, error.message); }
      finally { if (name) try { await stop(name); } catch (error) { row('permission stop', false, error.message); } }
    }
  } catch (error) { row('setup', false, error.stack || error.message); }
  finally { if (h) try { const clean = await h.teardown(); if (!clean.privateTmuxGone || !clean.runFolderGone) row('cleanup', false, JSON.stringify(clean)); } catch (error) { row('cleanup', false, error.message); } }
  console.log('CHECK | RESULT | DETAIL');
  for (const r of rows) console.log(`${r.name} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.detail}`);
  process.exitCode = rows.some(r => !r.ok) ? 1 : 0;
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
