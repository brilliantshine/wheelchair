'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHarness } = require('./harness');

const options = {
  '--only': { values: ['slow-start', 'tiers', 'permission'], selected: new Set() },
  '--provider': { values: ['claude', 'gpt'], selected: new Set() },
  '--tier': { values: ['light', 'standard', 'heavy', 'critical'], selected: new Set() },
};
for (let i = 2; i < process.argv.length; i++) {
  const option = options[process.argv[i]];
  if (!option || !process.argv[i + 1] || process.argv[i + 1].startsWith('--')) {
    console.error('usage: live.sh [--only slow-start|tiers|permission] [--provider claude|gpt] [--tier light|standard|heavy|critical]'); process.exit(2);
  }
  for (const value of process.argv[++i].split(',')) {
    if (!option.values.includes(value)) { console.error(`unknown ${process.argv[i - 1].slice(2)}: ${value}`); process.exit(2); }
    option.selected.add(value);
  }
}
for (const option of Object.values(options)) if (!option.selected.size) option.values.forEach(x => option.selected.add(x));
const selected = options['--only'].selected;
const UNPROTECTED = { held_back: { worker: false, reviewer: true, verifier: true, mapper: true }, margin: 0, leave: 0 };
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
    // the user's choice (PLAN.md D10): this private hub alone turns off the usage protections, so each
    // requested provider and tier is honoured even when his accounts are below their reserve.
    // His real Settings are never touched: the harness hub has its own state folder.
    h = await createHarness({ mode: 'live', slowOriginSeconds: 8, hubSettings: UNPROTECTED });
    const seeded = await h.callHub('/api/settings');
    assert(seeded.held_back.worker === false && seeded.margin === 0 && seeded.leave === 0, `harness hub settings not seeded: ${JSON.stringify({ held_back: seeded.held_back, margin: seeded.margin, leave: seeded.leave })}`);
    h.setOriginSlow(false);
    const thread = async () => (await h.callHub('/api/threads')).threads.find(t => t.id === h.threadId);
    const session = async name => (await h.agent({ action: 'list' })).sessions.find(s => s.name === name);
    let attempt = 0;
    async function start(provider, tier, brief) {
      return h.agent({ action: 'start', role: 'worker', provider, tier, attempt_id: `live-${++attempt}`, brief });
    }
    async function stop(name) {
      await h.agent({ action: 'stop', name });
      const s = await session(name); assert(s && s.live === false && s.status === 'stopped', `stop ended as ${JSON.stringify(s ?? null)}`);
    }
    function checkWaiting(s) {
      if (s.status === 'waiting') throw new Error(`held by the hub: ${s.waiting_reason} (until ${s.waiting_until})`);
    }
    async function tier(provider, tier, slow) {
      let result, name, startTime;
      try {
        const status = await h.callMachine('/v1/status');
        const account = status.accounts?.find(a => a.id === `default-${provider}`);
        if (account && !account.logged_in) throw new Error('skipped (not logged in)');
        startTime = Date.now();
        let elapsed;
        if (slow) h.setOriginSlow(true);
        try {
          result = await start(provider, tier, 'Reply with the single word ok and stop.');
          elapsed = (Date.now() - startTime) / 1000;
          name = result.session.name;
        } finally {
          if (slow) {
            h.setOriginSlow(false);
            // Let the 15-second machine-status cache expire (viewer/app/usage.js:49-50).
            await new Promise(resolve => setTimeout(resolve, 16000));
          }
        }
        if (slow) row('slow-start', elapsed > 5 && h.counts[name] === 1 && !result.note && result.session.provider === provider, `request succeeded; ${elapsed.toFixed(2)} s; ${h.counts[name] || 0} start requests${result.note ? `; ${result.note}` : ''}`);
        checkWaiting(result.session);
        if (result.note || result.session.provider !== provider) throw new Error(result.note || `provider ${result.session.provider}, requested ${provider}`);
        if (selected.has('tiers')) {
          const idField = provider === 'claude' ? 'cli_session_id' : 'codex_thread_id';
          let last;
          let done;
          try {
            done = await h.waitFor(async () => { last = await session(name); return last?.turn_ended && last[idField] && last; }, 180000);
          } catch (error) {
            if (error.message !== 'Timed out waiting for condition') throw error;
            throw new Error(last?.turn_ended ? `no ${idField} after turn end` : 'turn did not end');
          }
          const expected = execFileSync('bash', [path.join(__dirname, '../../codex/model.sh'), provider, tier], { env: h.env, encoding: 'utf8' }).trim();
          let transcriptError;
          let actual;
          try {
            actual = await h.waitFor(() => { try { return transcriptModel(h, provider, done[idField]); } catch (error) { transcriptError = error; return null; } }, 10000);
          } catch (error) {
            if (error.message !== 'Timed out waiting for condition') throw error;
            throw new Error(`transcript timed out: ${transcriptError?.message}`);
          }
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
      const pairs = selected.has('tiers') ? options['--tier'].values.filter(t => options['--tier'].selected.has(t)).flatMap(t => options['--provider'].values.filter(p => options['--provider'].selected.has(p)).map(p => [p, t])) : [['claude', 'light']];
      for (const [index, [p, t]] of pairs.entries()) await tier(p, t, selected.has('slow-start') && index === 0);
    }
    if (selected.has('permission')) {
      let name;
      try {
        const settings = await h.callHub('/api/settings'); assert.equal(settings.permission_mode, 'auto');
        const started = await start('claude', 'light', 'Run the shell command `touch smoke-ok` and then stop.'); name = started.session.name;
        checkWaiting(started.session);
        assert(!started.note && started.session.provider === 'claude', started.note || `provider ${started.session.provider}, requested claude`);
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
