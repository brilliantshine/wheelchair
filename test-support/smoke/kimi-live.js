'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createHarness } = require('./harness');
const nonce = () => `NONCE-${crypto.randomBytes(6).toString('hex')}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  let h, captureTimer; const checks = [], captures = new Map(), names = new Set();
  const row = (name, ok, detail) => { checks.push({ name, ok }); console.log(`${name} | ${ok ? 'PASS' : 'FAIL'} | ${detail}`); };
  const selected = process.env.KIMI_LIVE_CHECKS?.split(',');
  const check = async (name, fn) => { if (selected && !selected.includes(name[0])) { console.log(`${name} | SKIP | not selected`); return; } try { await fn(); } catch (e) { row(name, false, e.stack); } };
  try {
    h = await createHarness({ mode: 'live', recordEvents: true, modelPins: 'kimi.lead = kimi-code/k3.1-pro\nkimi.standard = kimi-code/k3\nkimi.light = kimi-code/kimi-for-coding\nkimi.heavy = kimi-code/k3.1-pro\n', hubSettings: { lead_order: ['kimi'], worker_order: ['kimi'], held_back: { worker: false, reviewer: false, verifier: false, mapper: false }, margin: 0, leave: 0 } });
    captureTimer = setInterval(() => {
      const list = h.tmux('list-sessions', '-F', '#{session_name}');
      for (const name of list.stdout.trim().split('\n').filter(Boolean)) {
        names.add(name); const pane = h.tmux('capture-pane', '-pt', `=${name}:0.0`).stdout;
        if (pane) { const frames = captures.get(name) || []; if (!frames.includes(pane)) frames.push(pane); captures.set(name, frames); }
      }
    }, 50);
    const machine = async name => {
      const listed = (await h.callMachine('/v1/sessions')).find(s => s.name === name);
      let stored = {};
      try { stored = JSON.parse(fs.readFileSync(path.join(h.paths.machineState, 'sessions.json'), 'utf8'))[name] || {}; } catch {}
      return listed && { ...listed, source_transcript: stored.source_transcript, kimi_last_turn: stored.kimi_last_turn, kimi_session_id: stored.kimi_session_id };
    };
    const waitBound = name => h.waitFor(async () => { const s = await machine(name); return s?.status === 'ready' && s.source_transcript && s; }, 120000);
    const wire = file => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
    const prompt = async (name, marker) => h.waitFor(async () => { const s = await machine(name); if (!s?.source_transcript) return false; const found = wire(s.source_transcript).find(x => x.agentId === 'main' && x.type === 'turn.prompt' && x.origin?.kind === 'user' && JSON.stringify(x.input).includes(marker)); return found && { s, found }; }, 120000);
    const ended = async (name, marker, timeout = 120000) => { const { s, found } = await prompt(name, marker); const end = await h.waitFor(() => wire(s.source_transcript).find(x => x.agentId === 'main' && x.type === 'turn.ended' && x.turnId === found.turnId), timeout); await h.waitFor(() => h.events.some(x => x.session === name && x.type === 'turn-ended' && x.turn_id === found.turnId), 30000); return { s, found, end }; };
    const eventFor = (name, turn) => h.events.filter(x => x.session === name && x.type === 'turn-ended' && x.turn_id === turn);
    const start = async (role, attempt_id, brief, extra = {}) => { const result = await h.agent({ action: 'start', role, provider: 'kimi', attempt_id, brief, ...extra }); names.add(result.session.name); console.log(`started ${role}=${result.session.name}`); return result.session.name; };
    const thread = await h.callHub('/api/threads', 'POST', { project: h.paths.clone, machine: 'harness', cli: 'kimi', title: 'Kimi live check' });
    const id = thread.id, lead = thread.sessions.find(s => s.role === 'lead').name; names.add(lead); console.log(`thread=${id} lead=${lead}`);
    const getThread = async () => (await h.callHub('/api/threads')).threads.find(t => t.id === id);
    await waitBound(lead);
    await h.waitFor(async () => (await machine(lead)).kimi_last_turn !== undefined, 120000);
    await check('3 subagent turn', async () => {
      const marker = nonce(), eventStart = h.events.length; await h.callHub(`/api/threads/${id}/messages`, 'POST', { text: `Use your Agent tool to delegate a tiny task to a subagent: ask it to return OK. After it finishes, reply exactly ${marker}.` });
      const { s, found, end } = await ended(lead, marker, 180000); await sleep(2500);
      const rows = wire(s.source_transcript), endIndex = rows.findIndex(x => x.agentId === 'main' && x.type === 'turn.ended' && x.turnId === found.turnId);
      assert.equal(end.reason, 'completed'); assert(rows.slice(0, endIndex).some(x => x.agentId === 'main' && x.type === 'context.append_loop_event' && x.event?.type === 'content.part' && x.event.part?.type === 'text' && x.event.part.text.includes(marker)), 'no main reply before end');
      const dir = path.dirname(path.dirname(s.source_transcript)); const others = fs.readdirSync(dir).filter(x => x !== 'main'); assert(others.length, 'no subagent logs');
      const sub = others.map(x => ({ agent: x, file: path.join(dir, x, 'wire.jsonl') })).filter(x => fs.existsSync(x.file)); assert(sub.length, 'no subagent wire');
      const ends = eventFor(lead, found.turnId); const allEnds = h.events.slice(eventStart).filter(x => x.session === lead && x.type === 'turn-ended'); assert.equal(ends.length, 1); assert.equal(allEnds.length, 1); assert(ends[0].received_at >= end.time);
      const subEnds = sub.flatMap(x => wire(x.file).filter(r => r.agentId === x.agent && r.type === 'turn.ended')); assert(subEnds.length, 'subagent did not finish');
      row('3 subagent turn', true, JSON.stringify({ session: lead, nonce: marker, turn_id: found.turnId, end, hub_events_since_prompt: allEnds, subagent_logs: sub.map(x => x.file), subagent_wire_ends: subEnds }));
    });
    await check('4 interrupted reviewer', async () => {
      const marker = nonce(); const response = await fetch(`http://127.0.0.1:${h.ports.hub}/wheelchair/api/machine/session`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-wheelchair-machine-secret': 'harness-machine-secret' }, body: JSON.stringify({ calling_session: lead, action: 'start', role: 'reviewer', provider: 'kimi', attempt_id: 'cancel-review', brief: `Review this long question, thinking in detail before reporting: derive and examine many alternative proofs of the infinitude of primes. Include ${marker} in the report.` }) }); const started = await response.json(); assert(response.ok, JSON.stringify(started)); const reviewer = started.session.name; names.add(reviewer); console.log(`started reviewer=${reviewer}`);
      const { s, found } = await prompt(reviewer, marker); await h.callMachine(`/v1/sessions/${encodeURIComponent(reviewer)}/keys`, 'POST', { keys: 'Escape' });
      const done = await ended(reviewer, marker, 60000); await sleep(3000);
      const t = await getThread(), target = t.sessions.find(x => x.name === reviewer); const sent = t.sent.filter(x => x.source === 'result' && x.text?.includes(reviewer)); const cards = t.cards.filter(x => x.kind === 'result' && x.session === reviewer);
      assert.equal(done.end.reason, 'cancelled'); assert.equal(target.last_turn_id, found.turnId); assert.equal(target.turn_ended, true); assert.equal(target.quiet_check_at, undefined); assert.equal(sent.length, 0); assert.equal(cards.length, 0);
      row('4 interrupted reviewer', true, JSON.stringify({ session: reviewer, nonce: marker, turn_id: found.turnId, end: done.end, hub_events: eventFor(reviewer, found.turnId), turn_ended: target.turn_ended, queue: target.queue, quiet_check_at: target.quiet_check_at ?? null, sent, cards, source: s.source_transcript }));
    });
    await check('5 pinned light model', async () => {
      const marker = nonce(); const worker = await start('worker', 'pinned-light', `Reply exactly ${marker}.`, { tier: 'light' }); await waitBound(worker);
      const pane = await h.waitFor(() => (captures.get(worker) || []).find(x => /^\s*(?:Ask When Needed|Never Ask).*\bthinking\b/im.test(x) && /context:/.test(x)), 30000); const done = await ended(worker, marker);
      const footer = pane.split('\n').find(x => /^\s*(?:Ask When Needed|Never Ask).*\bthinking\b/i.test(x));
      assert.match(footer, /\bK2\.8 Preview\s+thinking\b/i); assert.equal((await machine(worker)).effort, null);
      row('5 pinned light model', true, JSON.stringify({ session: worker, turn_id: done.found.turnId, footer, effort: (await machine(worker)).effort }));
    });
    await check('6 folder trust', async () => {
      const entry = [...captures].flatMap(([name, frames]) => frames.map(pane => ({ name, pane }))).find(x => x.pane.includes('Trust this folder?'));
      assert(entry, 'trust screen not captured'); console.log(`TRUST PANE ${entry.name}\n${entry.pane}`); const adapter = require('../../machine/adapters/kimi'); assert(adapter.answerPrompts({}, entry.pane)); const s = await machine(entry.name); assert.equal(s.status, 'ready'); row('6 folder trust', true, JSON.stringify({ session: entry.name, answer: adapter.answerPrompts({}, entry.pane), status: s.status }));
    });
    await check('7 approval prompt', async () => {
      await h.callHub('/api/settings/preferences', 'PUT', { permission_mode: 'auto' });
      const instructions = ['Run this exact shell command: touch /tmp/wheelchair-kimi-live-approval-check. Then reply with', 'Run this exact shell command: git push origin HEAD. Then reply with'];
      let found;
      for (let i = 0; i < instructions.length && !found; i++) {
        const marker = nonce(), worker = await start('worker', `approval-${i}`, `${instructions[i]} ${marker}.`, { tier: 'standard' }); await waitBound(worker);
        const end = Date.now() + 30000;
        while (Date.now() < end) { const s = await machine(worker); const frames = captures.get(worker) || []; const pane = frames.find(x => require('../../machine/adapters/kimi').promptText(x)); if (pane) { found = { worker, marker, pane, prompt_open: s.prompt_open }; break; } const rows = wire(s.source_transcript); if (rows.some(x => x.agentId === 'main' && x.type === 'turn.ended' && x.turnId === rows.find(y => y.agentId === 'main' && y.type === 'turn.prompt' && y.origin?.kind === 'user' && JSON.stringify(y.input).includes(marker))?.turnId)) break; await sleep(100); }
        if (!found) console.log(`approval try ${i + 1}: no prompt observed session=${worker}`);
      }
      if (!found) { row('7 approval prompt', false, 'No approval prompt observed; promptText unchanged'); return; }
      console.log(`APPROVAL PANE ${found.worker}\n${found.pane}`); assert(require('../../machine/adapters/kimi').promptText(found.pane), 'promptText does not match captured pane'); await h.waitFor(async () => (await machine(found.worker)).prompt_open, 10000); row('7 approval prompt', true, JSON.stringify(found));
    });
  } catch (e) { row('setup', false, e.stack); }
  finally { if (captureTimer) clearInterval(captureTimer); if (h) { console.log(`sessions started ${JSON.stringify([...names])}`); const clean = await h.teardown(); console.log(`cleanup ${JSON.stringify(clean)}`); } }
  console.log(`${checks.filter(x => x.ok).length} passed; ${checks.filter(x => !x.ok).length} failed`); process.exitCode = checks.some(x => !x.ok) ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
