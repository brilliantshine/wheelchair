'use strict';
const { LINE_LIMIT, createLineChecker } = require('./server-lines');
const { redactCapture } = require('./key-redact');
const { escapeLike } = require('./key-spell');

function relay({ child, name, values, kill, stdin, stdout, stderr, observe = () => {}, exit = code => process.exit(code) }) {
  const checker = createLineChecker({ name, values });
  let done = false, inputEnded = false, inputGone = false, partial = false, blockedIn = false, injections = [];
  let outGone = false, errGone = false, outBlocked = false, errBlocked = false;
  let outEnded = false, errEnded = false, exited = false, exitCode = 1, hardTimer, stopTimer, postTimer, goneTimer;
  let stopLeft = 5000, postLeft = 2000, stopAt, postAt, stopped = false, outWrites = 0, errWrites = 0;
  let chunks = [], length = 0, oversized = false, pendingOut = null;
  let errBuffer = Buffer.alloc(0), errCut = false, pendingErr = null;
  const finish = code => { if (done) return; done = true; clearTimeout(hardTimer); clearTimeout(stopTimer); clearTimeout(postTimer); clearTimeout(goneTimer); kill(); exit(code); };
  function timerPause() {
    if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; stopLeft -= Date.now() - stopAt; }
    if (postTimer) { clearTimeout(postTimer); postTimer = null; postLeft -= Date.now() - postAt; }
  }
  function timerResume() {
    if (outBlocked || done) return;
    if (inputEnded && !exited && !stopTimer && !stopped) { stopAt = Date.now(); stopTimer = setTimeout(() => { stopTimer = null; stopped = true; kill(); }, Math.max(0, stopLeft)); }
    if (exited && !(outEnded && errEnded) && !postTimer) { postAt = Date.now(); postTimer = setTimeout(() => { postTimer = null; kill(); child.stdout.destroy(); child.stderr.destroy(); endOut(); endErr(); }, Math.max(0, postLeft)); }
  }
  function check() {
    if (done) return;
    if (outGone) { if (errGone || (!errBlocked && errEnded && !errWrites)) finish(1); return; }
    if (exited && outEnded && errEnded && !outBlocked && !errBlocked && !pendingOut && !pendingErr && !outWrites && !errWrites && !errBuffer.length) finish(exitCode);
  }
  function writeOut(buf) {
    if (!buf || outGone) return;
    outWrites++; if (!stdout.write(buf, () => { outWrites--; check(); })) { outBlocked = true; child.stdout.pause(); timerPause(); }
  }
  function writeErr(buf) {
    if (!buf || errGone) return;
    errWrites++; if (!stderr.write(buf, () => { errWrites--; check(); })) { errBlocked = true; child.stderr.pause(); }
  }
  function putInput(buf) {
    if (inputGone || !buf?.length) return;
    if (!child.stdin.write(buf)) { blockedIn = true; stdin.pause(); }
  }
  function flushInjections() { if (!partial && !inputGone) { for (const line of injections) putInput(line); injections = []; } }
  function inject(buf) { if (!buf || inputGone) return; injections.push(buf); flushInjections(); }
  function result(r) { writeOut(r.out); inject(r.toServer); if (r.note) writeErr(Buffer.from(r.note + '\n')); }
  function line() {
    const buf = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks, length);
    chunks = []; length = 0;
    result(oversized ? checker.oversized(buf) : checker.line(buf)); oversized = false;
  }
  function consumeOut(buf) {
    let pos = 0;
    while (pos < buf.length && !outBlocked && !outGone) {
      const nl = buf.indexOf(10, pos), end = nl < 0 ? buf.length : nl + 1, part = buf.subarray(pos, end);
      if (!oversized) {
        const room = LINE_LIMIT - length;
        if (part.length > room) { if (room) { chunks.push(part.subarray(0, room)); length += room; } oversized = true; }
        else { chunks.push(part); length += part.length; }
      }
      observe(length);
      pos = end;
      if (nl >= 0) line();
    }
    pendingOut = pos < buf.length && !outGone ? buf.subarray(pos) : null;
  }
  function endOut() { if (outEnded) return; outEnded = true; if (length || oversized) line(); timerResume(); check(); }
  function emitErr(buf, cutEnd = false) { writeErr(redactCapture(buf, values, { cutStart: errCut, cutEnd })); errCut = cutEnd; }
  function consumeErr(buf, final = false) {
    errBuffer = Buffer.concat([errBuffer, buf]);
    while (!errBlocked && !errGone && errBuffer.length) {
      const nl = errBuffer.indexOf(10);
      if (nl >= 0 && nl < 4096) { emitErr(errBuffer.subarray(0, nl + 1)); errBuffer = errBuffer.subarray(nl + 1); continue; }
      if (errBuffer.length < 4096 && !final) break;
      if (final && errBuffer.length <= 4096) { emitErr(errBuffer); errBuffer = Buffer.alloc(0); break; }
      let edge = 4096; while (edge && escapeLike(errBuffer[edge - 1])) edge--;
      if (!edge && errBuffer.length === 4096 && !final) break;
      if (!edge && errBuffer.length > 4096 && !escapeLike(errBuffer[4096])) edge = 4096;
      if (!edge) { emitErr(errBuffer.subarray(0, 4096), true); errBuffer = errBuffer.subarray(4096); }
      else { emitErr(errBuffer.subarray(0, edge)); errBuffer = errBuffer.subarray(edge); }
    }
  }
  function endErr() { if (errEnded) return; errEnded = true; consumeErr(Buffer.alloc(0), true); timerResume(); check(); }
  child.stdout.on('data', consumeOut); child.stdout.on('end', endOut);
  child.stderr.on('data', b => consumeErr(b)); child.stderr.on('end', endErr);
  stdout.on('drain', () => { outBlocked = false; if (pendingOut) { const b = pendingOut; pendingOut = null; consumeOut(b); } if (!outBlocked && !outEnded) child.stdout.resume(); timerResume(); check(); });
  stderr.on('drain', () => { errBlocked = false; consumeErr(Buffer.alloc(0), errEnded); if (!errBlocked && !errEnded) child.stderr.resume(); check(); });
  function destinationGone(which) {
    if (which === 'out') { if (outGone) return; outGone = true; outBlocked = false; pendingOut = null; child.stdout.resume(); timerResume(); kill(); goneTimer = setTimeout(() => finish(1), 2000); }
    else { if (errGone) return; errGone = true; errBlocked = false; errBuffer = Buffer.alloc(0); child.stderr.resume(); }
    check();
  }
  stdout.on('error', () => destinationGone('out')); stdout.on('close', () => destinationGone('out'));
  stderr.on('error', () => destinationGone('err')); stderr.on('close', () => destinationGone('err'));
  function lostInput() { if (inputGone) return; inputGone = true; injections = []; blockedIn = false; stdin.resume(); }
  child.stdin.on('error', lostInput); child.stdin.on('close', lostInput);
  child.stdin.on('drain', () => { blockedIn = false; stdin.resume(); });
  stdin.on('data', buf => {
    if (inputGone) return;
    let pos = 0;
    while (pos < buf.length) {
      const nl = buf.indexOf(10, pos), end = nl < 0 ? buf.length : nl + 1;
      putInput(buf.subarray(pos, end)); partial = nl < 0;
      if (!partial) flushInjections(); pos = end;
    }
  });
  stdin.on('end', () => { inputEnded = true; partial = false; flushInjections(); if (!inputGone) child.stdin.end(); hardTimer = setTimeout(() => { kill(); finish(1); }, 60000); timerResume(); });
  child.on('exit', (code, signal) => { exited = true; exitCode = signal ? 1 : code ?? 1; if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; } timerResume(); check(); });
}
module.exports = { relay };
