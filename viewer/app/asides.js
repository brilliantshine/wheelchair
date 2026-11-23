'use strict';
const connectors = require('../../connectors');

const crypto = require('node:crypto');
const path = require('node:path');
const { appError } = require('./state.js');
const settings = require('./settings.js');
const { PROVIDERS, providerOf } = require('./providers.js');

const now = () => new Date().toISOString();
const brief = (aside) => {
  const { history, ...rest } = aside;
  const graphs = [];
  (history || []).forEach((h, entry) => { if (h && h.graph) graphs.push({ entry, path: h.graph }); });
  return { ...rest, graphs };
};
const find = (thread, id) => { const aside = (thread.asides || []).find((a) => a.id === id); if (!aside) throw appError(404, 'aside not found'); return aside; };
async function model(hub, provider, slot) {
  try {
    const name = (await settings.modelCommand(hub, [provider, slot])).stdout.trim();
    const effort = (await settings.modelCommand(hub, ['effort', provider, slot])).stdout.trim();
    return { model: name, effort: effort || undefined };
  } catch (error) { if (error.code === 3) return null; throw error; }
}
function close(aside, outcome = 'done') {
  Object.assign(aside, { status: 'closed', pending: [], failed: null, closed_at: now(), outcome });
}
function prompt(aside, message) {
  let value;
  if (message.kind === 'start') value = `[wc:aside start ${aside.action} slot=${aside.slot}]\n\n${aside.anchor.quote.split('\n').map((line) => `> ${line}`).join('\n')}\n\n${message.text}`;
  else if (message.kind === 'ask') value = `[wc:aside ask slot=${aside.slot}]\n\n${message.text}`;
  else value = `[wc:aside control slot=${aside.slot}]\n\nWrite the one line for the main thread.`;
  return message.no_step_up ? `${value}\n\nAnswer now; stepping up isn't available.` : value;
}
async function create(hub, thread, input) {
  if (!input || typeof input.message_id !== 'string' || !Number.isInteger(input.start) || !Number.isInteger(input.end) || input.start < 0 || input.start >= input.end || typeof input.quote !== 'string' || !input.quote.trim() || !['ask', 'simpler', 'draw'].includes(input.action)) throw appError(400, 'invalid aside');
  const chat = await require('./chat.js').chat(hub, thread.id);
  if (!chat.items.some((item) => item.type === 'assistant' && item.id === input.message_id)) throw appError(400, 'message not found');
  const lead = [...thread.sessions].reverse().find((item) => item.role === 'lead' && item.live);
  const provider = lead?.provider || providerOf(lead?.cli);
  if (PROVIDERS[provider]?.asideFork === false) throw appError(400, `Side conversations aren't available on ${PROVIDERS[provider].label} sessions yet`);
  const parent = lead?.[connectors.byProvider(provider)?.asideParentField];
  if (!lead || !parent) throw appError(409, "the lead isn't ready yet");
  const standard = await model(hub, provider, 'standard'), heavy = await model(hub, provider, 'heavy');
  if (!standard && !heavy) throw appError(409, `asides need a Standard or Heavy model for ${provider} in Settings`);
  const slot = input.action === 'draw' ? (heavy ? 'heavy' : 'standard') : (standard ? 'standard' : 'heavy');
  const aside = { id: crypto.randomUUID(), number: (thread.asides || []).length + 1, anchor: { message_id: input.message_id, start: input.start, end: input.end, quote: input.quote }, action: input.action, created_at: now(), provider, account: lead.account, account_dir: lead.account_dir ?? null, fork_parent: parent, cli_id: null, slot, status: 'open', pending: input.action === 'ask' ? [] : [{ kind: 'start', text: '' }], turn: null, history: [], failed: null, closed_at: null, outcome: null, sent_line: null };
  (thread.asides ||= []).push(aside); await hub.save(thread); return aside;
}
async function change(hub, thread, aside, action, input) {
  if (action === 'messages') {
    if (typeof input.text !== 'string' || !input.text.trim()) throw appError(400, 'text is required');
    const started = [...aside.history, ...aside.pending, ...(aside.turn ? [aside.turn.message] : [])].some((m) => m.kind === 'start');
    Object.assign(aside, { status: 'open', closed_at: null, outcome: null, sent_line: null });
    aside.pending.push({ kind: started ? 'ask' : 'start', text: input.text });
  } else if (action === 'close') {
    if (!['done', 'changed'].includes(input.outcome)) throw appError(400, 'invalid outcome');
    if (input.outcome === 'changed') {
      if (typeof input.line !== 'string' || !input.line.trim()) throw appError(400, 'line is required');
      const lead = [...thread.sessions].reverse().find((s) => s.role === 'lead' && s.live);
      if (!lead) throw appError(409, 'no live lead');
      const quote = aside.anchor.quote.length > 80 ? `${aside.anchor.quote.slice(0, 80)}…` : aside.anchor.quote;
      await hub.enqueue(thread, lead.name, `${input.line}\n\n(from aside ${aside.number} on: "${quote}")`, 'user');
      aside.sent_line = input.line;
    }
    close(aside, input.outcome);
  } else if (action === 'retry') {
    if (!aside.failed) throw appError(409, 'nothing to retry'); aside.failed = null;
  } else if (action === 'think-harder') {
    const last = [...aside.history].reverse().find((m) => ['start', 'ask'].includes(m.kind));
    if (aside.status !== 'open' || aside.slot !== 'standard' || aside.turn || aside.failed || !last || !await model(hub, aside.provider, 'heavy')) throw appError(409, 'cannot think harder');
    aside.slot = 'heavy'; aside.pending.push({ kind: last.kind, text: last.text });
  } else if (action === 'summary') {
    if (aside.status !== 'open' || !aside.cli_id || aside.turn || aside.failed) throw appError(409, 'cannot summarize yet');
    aside.pending.push({ kind: 'control', text: '' });
  } else throw appError(404, 'route not found');
  await hub.save(thread);
}
async function graph(hub, thread, aside, reply) {
  const match = /```wc-graph[ \t]*\r?\n([\s\S]*?)```/.exec(reply);
  if (!match) return { reply, graph: null, graph_error: null };
  const text = (reply.slice(0, match.index) + reply.slice(match.index + match[0].length)).trim();
  try {
    const repo = path.resolve(thread.project);
    const key = `${path.basename(repo)}-${crypto.createHash('sha256').update(repo).digest('hex').slice(0, 8)}`;
    const graphPath = path.join(hub.graphCacheRoot, key, 'asides', `${aside.id}-${aside.history.length}.json`);
    await hub.saveGraph(graphPath, JSON.parse(match[1]));
    return { reply: text, graph: graphPath, graph_error: null };
  } catch (error) { return { reply: text, graph: null, graph_error: `Couldn't draw that: ${error.message}` }; }
}
async function claim(hub, id) {
  return hub.withThread(id, async () => {
    const thread = await hub.thread(id), items = [];
    if (thread.archived) return items;
    for (const aside of thread.asides || []) {
      if (!aside.turn && aside.status === 'open' && aside.pending.length && !aside.failed) {
        const resolved = await model(hub, aside.provider, aside.slot);
        if (!resolved) { aside.failed = 'the model is off in Settings'; await hub.save(thread); continue; }
        aside.turn = { id: crypto.randomUUID(), state: 'dispatching', message: aside.pending.shift(), model: resolved.model, effort: resolved.effort || null }; await hub.save(thread);
      }
      if (!aside.turn) continue;
      const turn = aside.turn;
      let body;
      if (turn.state === 'dispatching') {
        if (!turn.model) {
          const resolved = await model(hub, aside.provider, aside.slot);
          if (!resolved) { aside.failed = 'the model is off in Settings'; aside.pending.unshift(turn.message); aside.turn = null; await hub.save(thread); continue; }
          Object.assign(turn, { model: resolved.model, effort: resolved.effort || null }); await hub.save(thread);
        }
        const saved = await settings.load(hub);
        const style = settings.renderStyle(saved.style);
        body = { turn_id: turn.id, provider: aside.provider, account_dir: Object.hasOwn(aside, 'account_dir') ? aside.account_dir : (aside.account === `default-${aside.provider}` ? null : `~/.wheelchair/accounts/${aside.account}`), cwd: thread.worktree, model: turn.model, ...(turn.effort ? { effort: turn.effort } : {}), mode: aside.cli_id ? 'resume' : 'fork', from: aside.cli_id || aside.fork_parent, new_id: turn.id, prompt: prompt(aside, turn.message), access: saved.aside_access === 'full' ? 'full' : 'read-only', ...(style ? { style } : {}) };
      }
      items.push({ asideId: aside.id, turnId: turn.id, state: turn.state, machine: thread.machine, body });
    }
    return items;
  });
}
async function call(hub, id, item) {
  const base = `/v1/aside-turns/${encodeURIComponent(item.turnId)}`;
  try { return await hub.call(item.machine, base, 'GET'); }
  catch (error) {
    if (error.status !== 404) return null;
    if (item.state === 'running') return { state: 'failed', error: 'the machine lost this turn' };
    const held = await hub.withThread(id, async () => {
      const thread = await hub.thread(id);
      const aside = (thread.asides || []).find((a) => a.id === item.asideId);
      return !thread.archived && aside?.turn?.id === item.turnId && aside.turn.state === 'dispatching';
    });
    if (!held) return null;
    try { await hub.call(item.machine, '/v1/aside-turns', 'POST', item.body); return { state: 'running' }; }
    catch { return null; }
  }
}
async function applyResult(hub, thread, aside, result) {
  const turn = aside.turn;
  const message = turn.message;
  if (result.state === 'ok') {
    if (!aside.cli_id) aside.cli_id = result.conversation_id;
    let reply = String(result.reply || '');
    const marker = /^\s*\[wc:step-up\]\s*([^\n]*)\s*$/.exec(reply);
    if (message.kind !== 'control' && marker) {
      if (message.no_step_up) { result = { state: 'failed', error: "The aside couldn't answer" }; }
      else {
        const heavy = await model(hub, aside.provider, 'heavy');
        if (aside.status === 'open' && aside.slot === 'standard' && heavy) { aside.history.push({ kind: 'note', text: `Thinking harder: ${marker[1]}`, at: now() }); aside.slot = 'heavy'; aside.pending.unshift(message); }
        else { if (!heavy) aside.history.push({ kind: 'note', text: "Can't think harder: the stronger model is off in Settings", at: now() }); if (aside.status === 'open') aside.pending.unshift({ ...message, no_step_up: true }); else aside.history.push({ kind: message.kind, text: message.text, reply, model: turn.model || null, at: now(), graph: null, graph_error: null }); }
      }
    } else {
      if (message.kind === 'control') reply = reply.replace(/^\s*\[wc:step-up\]\s*/, '');
      const drawn = await graph(hub, thread, aside, reply);
      aside.history.push({ kind: message.kind, text: message.text, ...drawn, model: turn.model || null, at: now() });
    }
  }
  if (result.state === 'failed') {
    const notice = result.limit ? 'Hit the usage limit' : (result.error || 'The aside failed');
    if (aside.status === 'closed') { aside.history.push({ kind: 'note', text: notice, at: now() }, { kind: message.kind, text: message.text, reply: null, model: turn.model || null, at: now(), graph: null, graph_error: null }); }
    else { aside.pending.unshift(message); aside.failed = notice; }
  }
  aside.turn = null; await hub.save(thread);
}
async function pass(hub, id) {
  const items = await claim(hub, id);
  for (const item of items) item.result = await call(hub, id, item);
  const { acks, cancels, again } = await hub.withThread(id, async () => {
    const thread = await hub.thread(id), acks = [], cancels = [];
    let changed = false;
    for (const item of items) {
      const aside = (thread.asides || []).find((a) => a.id === item.asideId);
      if (!item.result) continue;
      if (thread.archived || !aside?.turn || aside.turn.id !== item.turnId) {
        if (item.result.state === 'running') cancels.push({ machine: item.machine, turnId: item.turnId });
        continue;
      }
      if (item.result.state === 'running') {
        if (aside.turn.state === 'dispatching') { aside.turn.state = 'running'; await hub.save(thread); }
      } else {
        await applyResult(hub, thread, aside, item.result);
        acks.push({ machine: item.machine, turnId: item.turnId }); changed = true;
      }
    }
    return { acks, cancels, again: changed && !thread.archived && (thread.asides || []).some((a) => a.status === 'open' && a.pending.length && !a.failed && !a.turn) };
  });
  for (const cancel of cancels) {
    const base = `/v1/aside-turns/${encodeURIComponent(cancel.turnId)}`;
    await hub.call(cancel.machine, base, 'DELETE').catch(() => {});
  }
  for (const ack of acks) await hub.call(ack.machine, `/v1/aside-turns/${encodeURIComponent(ack.turnId)}/ack`, 'POST').catch(() => {});
  return again;
}
const pumps = new Map();
function pump(hub, id, { fromTimer = false } = {}) {
  const existing = pumps.get(id);
  if (existing) { if (!fromTimer) existing.again = true; return fromTimer ? Promise.resolve() : existing.promise; }
  const entry = { again: false };
  entry.promise = (async () => {
    do {
      entry.again = false;
      while (await pass(hub, id)) { /* drain newly runnable messages */ }
    } while (entry.again);
  })().finally(() => { if (pumps.get(id) === entry) pumps.delete(id); });
  pumps.set(id, entry);
  return entry.promise;
}
function needsPump(thread) { return !thread.archived && (thread.asides || []).some((aside) => aside.turn || (aside.status === 'open' && aside.pending?.length && aside.failed == null)); }
const cancelSweeps = new Set();
async function sweepCancels(hub, id) {
  if (cancelSweeps.has(id)) return;
  cancelSweeps.add(id);
  try {
    const { machine, pending } = await hub.withThread(id, async () => {
      const thread = await hub.thread(id);
      return { machine: thread.machine, pending: [...(thread.pending_cancels || [])] };
    });
    if (!pending.length) return;
    const confirmed = [];
    for (const turnId of pending) {
      try { await hub.call(machine, `/v1/aside-turns/${encodeURIComponent(turnId)}`, 'DELETE'); }
      catch (error) { if (error.status !== 404) continue; }
      confirmed.push(turnId);
    }
    if (!confirmed.length) return;
    await hub.withThread(id, async () => {
      const thread = await hub.thread(id);
      thread.pending_cancels = (thread.pending_cancels || []).filter((turnId) => !confirmed.includes(turnId));
      await hub.save(thread);
    });
  } finally { cancelSweeps.delete(id); }
}
module.exports = { brief, change, close, create, find, model, needsPump, pump, sweepCancels };
