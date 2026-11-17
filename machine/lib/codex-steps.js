'use strict';
const { classify, truncate } = require('./steps');

// Read only literal arguments; never execute a rollout's script.
function literal(raw) {
  if (!raw) return null;
  try {
    if (raw[0] === '"') return JSON.parse(raw);
    if (raw[0] === "'") return raw.slice(1, -1).replace(/\\(['\\])/g, '$1').replace(/\\n/g, '\n');
    if (raw[0] === '`' && !raw.includes('${')) return raw.slice(1, -1).replace(/\\`/g, '`').replace(/\\n/g, '\n');
  } catch {}
  return null;
}
const stringPattern = `(?:"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|\x60(?:\\\\.|[^\x60\\\\])*\x60)`;
function scriptInfo(source, ctx) {
  const calls = [...source.matchAll(/\btools\.([\w]+)\s*\(/g)];
  if (!calls.length) return { poll: false, info: { kind: 'shell', label: 'Ran a script', key: 'shell:script' } };
  const poll = calls.every(m => ['wait', 'write_stdin'].includes(m[1]));
  const first = calls[0], rest = source.slice(first.index + first[0].length).trimStart();
  let target = literal(new RegExp(`^(${stringPattern})`).exec(rest)?.[1]);
  let field = null;
  const firstArgument = rest.split(/\)\s*[;,) ]/)[0];
  if (target === null && rest.startsWith('{')) {
    for (const key of ['cmd', 'command', 'path', 'file_path', 'query', 'url', 'prompt', 'message']) {
      const match = new RegExp(`\\b${key}\\s*:\\s*(${stringPattern})`).exec(firstArgument);
      if (match) { target = literal(match[1]); field = key; break; }
    }
  }
  let info;
  if (target === null) info = { kind: classify('codex', first[1], {}, ctx).kind, label: 'Ran a script', key: 'shell:script' };
  else {
    const input = first[1] === 'apply_patch' ? target : { [field || (['exec_command','shell'].includes(first[1]) ? 'command' : 'path')]: target };
    info = classify('codex', first[1], input, ctx);
  }
  if (new Set(calls.map(m => m[1])).size >= 2) info.label = truncate(info.label + ' and more');
  return { poll, info };
}
function outputInfo(output) {
  const parts = Array.isArray(output) ? output.map(x => x.text || '') : [typeof output === 'string' ? output : JSON.stringify(output || '')];
  const first = parts[0] || '';
  const runningHeader = first.startsWith('Script running with cell ID');
  const failedHeader = first.startsWith('Script failed') || first.startsWith('Script error');
  const finishedHeader = first.startsWith('Script completed') || failedHeader;
  const results = [];
  for (const part of parts) { try { const value = JSON.parse(part); if (value && typeof value === 'object') results.push(value); } catch {} }
  const exit = results.filter(x => typeof x.exit_code === 'number');
  const running = runningHeader || results.some(x => x.session_id != null && x.exit_code == null);
  const failed = failedHeader || exit.some(x => x.exit_code !== 0) || results.some(x => x.isError === true);
  const plainOutput = typeof output === 'string' && !finishedHeader && !runningHeader && results.length === 0;
  return { running, failed, pollFinish: !running && (exit.length > 0 || finishedHeader || plainOutput) };
}
function readLines(state, lines, ctx = {}) {
  state.open ||= {}; state.yielded ||= null;
  const events = [];
  const end = (id, at, clean, failed) => { events.push({ type: 'step', phase: 'end', step: { id, ended_at: at, failed: clean ? failed : null, clean } }); if (state.yielded === id) state.yielded = null; delete state.open[id]; };
  for (const line of lines) {
    let row; try { row = typeof line === 'string' ? JSON.parse(line) : line; } catch { continue; }
    const p = row?.payload || {}, at = row?.timestamp;
    if (row.type === 'event_msg' && p.type === 'token_count') {
      const total = p.info?.last_token_usage?.total_tokens, window = p.info?.model_context_window;
      if (Number.isFinite(total) && Number.isFinite(window) && window > 0) events.push({ type: 'context', context: { percent: Math.round(100 * total / window), at } });
    }
    if (row.type !== 'response_item') continue;
    if (p.type === 'custom_tool_call' || p.type === 'function_call') {
      if (!p.call_id) continue;
      let input = p.input ?? p.arguments ?? {}; if (typeof input === 'string' && p.type === 'function_call') { try { input = JSON.parse(input); } catch {} }
      const script = p.name === 'exec' ? scriptInfo(typeof input === 'string' ? input : '', ctx) : null;
      const poll = script ? script.poll : ['wait', 'write_stdin'].includes(p.name);
      state.open[p.call_id] = { poll };
      if (poll) continue;
      if (state.yielded) end(state.yielded, at, false, null);
      const info = script ? script.info : classify('codex', p.name, input, ctx);
      events.push({ type: 'step', phase: 'start', step: { id: p.call_id, ...info, started_at: at } });
    } else if (p.type === 'custom_tool_call_output' || p.type === 'function_call_output') {
      const entry = state.open[p.call_id]; if (!entry) continue;
      const result = outputInfo(p.output);
      delete state.open[p.call_id];
      if (entry.poll) { if (state.yielded && result.pollFinish) end(state.yielded, at, true, result.failed); }
      else if (result.running) state.yielded = p.call_id;
      else end(p.call_id, at, true, result.failed);
    }
  }
  return events;
}
module.exports = { readLines };
