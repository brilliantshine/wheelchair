'use strict';

const { spawn } = require('child_process');
const fs = require('fs').promises;
const { parseRootChildren, parseWindowInfo, typeTimeoutMs, parseOp } = require('./screen-args');

function runTool(cmd, argv, { env, timeoutMs }) {
  return new Promise(resolve => {
    let child, stdout = '', stderr = '', timedOut = false, done = false, timer;
    const finish = code => { if (done) return; done = true; clearTimeout(timer); resolve({ ok: code === 0 && !timedOut, code, stdout, stderr, timedOut }); };
    try {
      child = spawn(cmd, argv, { env, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', data => { stdout += data; });
      child.stderr.on('data', data => { stderr += data; });
      child.on('error', err => { stderr += err.message; finish(null); });
      child.on('exit', code => { if (timedOut) finish(code); });
      child.on('close', finish);
      timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); child.stdout.destroy(); child.stderr.destroy(); finish(null); }, Math.max(0, timeoutMs));
    } catch (err) { stderr += err.message; finish(null); }
  });
}
function failure(cmd, result) {
  const line = result.stderr.split(/\r?\n/).filter(s => s.trim()).pop();
  return Object.assign(new Error(result.timedOut ? `${cmd} timed out` : line || `${cmd} exited ${result.code}`), { status: 422, timedOut: result.timedOut, stderr: result.stderr });
}
function invalid(err) { return Object.assign(new Error(err.message), { status: 422 }); }
async function call(ctx, cmd, args, timeoutMs) {
  const result = await runTool(cmd, args.map(String), { env: ctx.env, timeoutMs });
  if (!result.ok) throw failure(cmd, result);
  return result.stdout;
}
async function windows(ctx, timeout, strict, deadline = Infinity) {
  const remaining = () => Math.min(timeout, Math.max(0, deadline - Date.now()));
  const root = await call(ctx, 'xwininfo', ['-root', '-children'], remaining());
  let ids; try { ids = parseRootChildren(root); } catch (err) { throw invalid(err); }
  const found = [];
  for (const id of ids) {
    let output;
    try { output = await call(ctx, 'xwininfo', ['-id', id], remaining()); }
    catch (err) { if (strict && (err.timedOut || !/Bad ?Window|Bad ?Drawable|No such window/i.test(err.stderr || ''))) throw err; continue; }
    let info; try { info = parseWindowInfo(output); } catch (err) { throw invalid(err); }
    if (info.viewable) { const { viewable, ...item } = info; found.push(item); }
  }
  return found;
}
async function listWindows(ctx, { probeTimeoutMs = 10000 } = {}) { return windows(ctx, probeTimeoutMs, false); }
async function windowIds(ctx, { probeTimeoutMs = 1000, deadline = Infinity } = {}) {
  try { const found = await windows(ctx, probeTimeoutMs, true, deadline); return Date.now() >= deadline ? null : found.map(w => w.id); } catch { return null; }
}
async function shot(ctx, { size, window, outPath }) {
  let { width, height } = size, x = 0, y = 0;
  if (window != null) {
    let output;
    try { output = await call(ctx, 'xdotool', ['getwindowgeometry', '--shell', window], 10000); } catch { throw invalid(new Error(`window ${window} is gone or off screen`)); }
    const fields = Object.fromEntries(output.split(/\r?\n/).map(line => line.split('=')));
    const nums = ['X', 'Y', 'WIDTH', 'HEIGHT'].map(k => /^-?\d+$/.test(fields[k] || '') ? Number(fields[k]) : NaN);
    const [wx, wy, ww, wh] = nums;
    x = Math.max(0, wx); y = Math.max(0, wy);
    width = Math.min(size.width, wx + ww) - x; height = Math.min(size.height, wy + wh) - y;
    if (!nums.every(Number.isFinite) || width <= 0 || height <= 0) throw invalid(new Error(`window ${window} is gone or off screen`));
  }
  const tmp = `${outPath}.tmp-${process.pid}.png`;
  try {
    await call(ctx, 'ffmpeg', ['-loglevel', 'error', '-y', '-f', 'x11grab', '-video_size', `${width}x${height}`, '-i', ctx.env.DISPLAY + (window != null ? `+${x},${y}` : ''), '-frames:v', '1', tmp], 15000);
    await fs.rename(tmp, outPath);
  } catch (err) { await fs.unlink(tmp).catch(() => {}); throw err.status === 422 ? err : invalid(err); }
  return { path: outPath, width, height };
}
// baseDeadlineMs and mouseupReserveMs are test hooks; production uses a 10 second base and 1 second reserve.
async function pointer(ctx, op, p, { baseDeadlineMs = 10000, mouseupReserveMs = 1000 } = {}) {
  const end = Date.now() + baseDeadlineMs;
  const run = args => call(ctx, 'xdotool', args, Math.max(0, end - Date.now()));
  if (op === 'move') await run(['mousemove', '--', p.x, p.y]);
  else if (op === 'click') { await run(['mousemove', '--', p.x, p.y]); await run(['click', ...(p.double ? ['--repeat', '2'] : []), '--', p.button]); }
  else if (op === 'drag') {
    const dragRun = args => call(ctx, 'xdotool', args, Math.max(0, end - mouseupReserveMs - Date.now()));
    await dragRun(['mousemove', '--', p.x1, p.y1]);
    let error;
    try { await dragRun(['mousedown', '--', 1]); await dragRun(['mousemove', '--', p.x2, p.y2]); } catch (err) { error = err; }
    try { await call(ctx, 'xdotool', ['mouseup', '--', 1], Math.max(0, end - Date.now())); } catch (err) { error ||= err; }
    if (error) throw error;
  } else throw invalid(new Error('invalid pointer operation'));
  return { ok: true };
}
// onTimeout is a test hook for observing the timeout passed to the tool.
async function typeText(ctx, text, { onTimeout } = {}) {
  try { parseOp('type', [text]); } catch (err) { throw invalid(err); }
  const timeout = typeTimeoutMs(text);
  if (onTimeout) onTimeout(timeout);
  await call(ctx, 'xdotool', ['type', '--delay', 20, '--', text], timeout);
  return { ok: true };
}
// baseDeadlineMs and onRelease are test hooks for the deadline and release start order.
async function pressKeys(ctx, { hold, tokens }, { baseDeadlineMs = 10000, onRelease } = {}) {
  try { parseOp('key', hold === null ? tokens : ['--hold', String(hold), ...tokens]); } catch (err) { throw invalid(err); }
  const end = Date.now() + baseDeadlineMs + (hold || 0), down = [];
  let error;
  for (const token of tokens) {
    const remaining = end - Date.now();
    if (remaining <= 0) { error = invalid(new Error('xdotool timed out')); break; }
    const result = await runTool('xdotool', [hold === null ? 'key' : 'keydown', '--', token], { env: ctx.env, timeoutMs: remaining });
    if (hold !== null || result.timedOut) down.push(token);
    if (!result.ok) { error = failure('xdotool', result); break; }
  }
  if (!error && hold !== null) {
    const wait = Math.min(hold, Math.max(0, end - Date.now()));
    await new Promise(resolve => setTimeout(resolve, wait));
    if (wait < hold) error = invalid(new Error('xdotool timed out'));
  }
  const releases = await Promise.all(down.reverse().map(token => { if (onRelease) onRelease(token); return runTool('xdotool', ['keyup', '--', token], { env: ctx.env, timeoutMs: 500 }); }));
  if (releases.some(r => !r.ok)) throw Object.assign(new Error('keys may still be held; run wc.js screen stop'), { status: 422, lockInput: true });
  if (error) throw error;
  return { ok: true };
}
async function focusWindow(ctx, id) { await call(ctx, 'xdotool', ['windowfocus', '--', id], 10000); return { ok: true }; }
async function autoFocus(ctx, baseline, { pollMs = 250, waitMs = 5000, probeTimeoutMs = 1000, phaseMs = 6000, startedAt = Date.now() } = {}) {
  if (!Array.isArray(baseline)) return null;
  const start = Date.now(), deadline = startedAt + phaseMs, old = new Set(baseline);
  try {
    do {
      if (Date.now() >= deadline) return null;
      const found = await windows(ctx, probeTimeoutMs, true, deadline);
      if (Date.now() >= deadline) return null;
      const item = found.find(w => !old.has(w.id));
      if (item) { await call(ctx, 'xdotool', ['windowfocus', '--', item.id], Math.min(probeTimeoutMs, Math.max(0, deadline - Date.now()))); return Date.now() < deadline ? { id: item.id, name: item.name } : null; }
      const delay = Math.min(pollMs, start + waitMs - Date.now(), deadline - Date.now());
      if (delay <= 0) return null;
      await new Promise(resolve => setTimeout(resolve, delay));
    } while (Date.now() < start + waitMs);
  } catch { return null; }
  return null;
}
module.exports = { runTool, listWindows, shot, pointer, typeText, pressKeys, focusWindow, windowIds, autoFocus };
