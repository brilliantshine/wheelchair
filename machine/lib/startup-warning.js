'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { STARTUP_TYPICAL, STARTUP_MARGIN } = require('../adapters/claude');

async function readBounded(file, limit, tail = false) {
  let handle;
  try {
    handle = await fs.open(file, 'r');
    const { size } = await handle.stat();
    const start = tail ? Math.max(0, size - limit) : 0;
    const buffer = Buffer.alloc(Math.min(size, limit));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
    let text = buffer.subarray(0, bytesRead).toString('utf8');
    if (start) text = text.slice(text.indexOf('\n') + 1);
    // A truncated final record is not a complete line.
    if (!tail && size > limit) text = text.slice(0, Math.max(0, text.lastIndexOf('\n') + 1));
    return text;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  } finally { if (handle) await handle.close(); }
}
function parse(line) { try { return JSON.parse(line); } catch { return null; } }
async function sample(stateDir, entry) {
  const text = await readBounded(path.join(stateDir, 'transcripts', entry.thread_id, `${entry.name}.jsonl`), 4 * 1024 * 1024);
  if (text === null) return null;
  for (const line of text.split('\n')) {
    const record = parse(line), message = record?.message, usage = message?.usage;
    if (record?.type !== 'assistant' || (Object.hasOwn(record, 'sessionId') && record.sessionId !== entry.cli_session_id) || typeof message?.model !== 'string' || !message.model || message.model === '<synthetic>' || !usage || typeof usage !== 'object') continue;
    const values = ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'].map(key => Object.hasOwn(usage, key) ? usage[key] : 0);
    if (values.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) continue;
    const sum = values.reduce((a, b) => a + b, 0);
    if (sum > 0 && Number.isFinite(sum)) return sum;
  }
  return null;
}
async function startupWarning(stateDir, cache) {
  const text = await readBounded(path.join(stateDir, 'session-ledger.jsonl'), 512 * 1024, true);
  if (text === null) return null;
  const entries = text.split('\n').map(parse).filter(e => e && !Object.hasOwn(e, 'kind') && e.provider === 'claude' && typeof e.cli_session_id === 'string' && typeof e.name === 'string' && typeof e.thread_id === 'string' && Object.hasOwn(STARTUP_TYPICAL, e.role));
  entries.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  const samples = { lead: [], reviewer: [] };
  for (const entry of entries.slice(0, 100)) {
    if (samples[entry.role].length === 5) continue;
    let value = cache.get(entry.cli_session_id);
    if (value === undefined) {
      value = await sample(stateDir, entry);
      if (value !== null) cache.set(entry.cli_session_id, value);
    }
    if (value !== null) samples[entry.role].push(value);
  }
  const format = value => (Math.round(value / 100) * 100).toLocaleString('en-US');
  const parts = [];
  for (const role of ['lead', 'reviewer']) {
    if (samples[role].length < 5) continue;
    const median = samples[role].sort((a, b) => b - a)[2], typical = STARTUP_TYPICAL[role];
    if (median > typical + STARTUP_MARGIN) parts.push(`${role} sessions now start about ${format(median - typical)} tokens bigger than usual (${format(median)} vs ${format(typical)})`);
  }
  return parts.length ? `Claude ${parts.join('; ')}. A new Claude Code tool may need turning off, or the usual size raising if our own instructions grew.` : null;
}
module.exports = { startupWarning };
