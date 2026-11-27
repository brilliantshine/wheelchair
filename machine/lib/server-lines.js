'use strict';
const { findSpellings, escapeLike } = require('./key-spell');
const { isUtf8 } = require('node:buffer');
const LINE_LIMIT = 32 * 1024 * 1024, LINE_BUDGET = 64000000;
const exhausted = Symbol('budget');

// Returns { wellFormed, members }; members maps top-level names to [start,end].
// visit({ start, end, name, text, top }) receives one decoded string Buffer at a time.
function readLine(buf, { prefix = false, visit = () => {} } = {}) {
  let p = 0, failed = false;
  const members = Object.create(null), stack = [];
  const ws = () => { while (p < buf.length && (buf[p] === 32 || buf[p] === 10 || buf[p] === 13 || buf[p] === 9)) p++; };
  function string(name, top) {
    const start = p++; let segment = p, decoded = null, used = 0;
    function append(part) { if (!decoded) decoded = Buffer.allocUnsafe(buf.length - start); part.copy(decoded, used); used += part.length; }
    while (p < buf.length) {
      const c = buf[p++];
      if (c === 34) {
        if (!isUtf8(buf.subarray(start + 1, p - 1))) return null;
        const tail = buf.subarray(segment, p - 1);
        if (decoded) append(tail);
        const text = decoded ? decoded.subarray(0, used) : tail;
        visit({ start, end: p, name, text, top });
        return text;
      }
      if (c < 32) return null;
      if (c !== 92) continue;
      append(buf.subarray(segment, p - 1));
      if (p >= buf.length) return null;
      const e = buf[p++], simple = { 34: '"', 92: '\\', 47: '/', 98: '\b', 102: '\f', 110: '\n', 114: '\r', 116: '\t' };
      if (e === 117) {
        if (p + 4 > buf.length || !/^[0-9a-fA-F]{4}$/.test(buf.toString('ascii', p, p + 4))) return null;
        let code = parseInt(buf.toString('ascii', p, p + 4), 16); p += 4;
        if (code >= 0xd800 && code <= 0xdbff && buf[p] === 92 && buf[p + 1] === 117 && p + 6 <= buf.length && /^[0-9a-fA-F]{4}$/.test(buf.toString('ascii', p + 2, p + 6))) {
          const low = parseInt(buf.toString('ascii', p + 2, p + 6), 16);
          if (low >= 0xdc00 && low <= 0xdfff) { code = 0x10000 + (code - 0xd800) * 1024 + low - 0xdc00; p += 6; }
        }
        append(Buffer.from(String.fromCodePoint(code)));
      } else if (simple[e] !== undefined) append(Buffer.from(simple[e]));
      else return null;
      segment = p;
    }
    return null;
  }
  function value(top) {
    ws(); const start = p, c = buf[p];
    if (c === 34) { if (string(false, top) === null) return false; }
    else if (c === 123 || c === 91) { p++; stack.push({ object: c === 123, state: 'first', start, top, key: null }); return true; }
    else {
      while (p < buf.length && ![32, 9, 10, 13, 44, 93, 125].includes(buf[p])) p++;
      const token = buf.toString('ascii', start, p);
      if (!/^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)$/.test(token)) return false;
    }
    if (top !== null && (!prefix || p < buf.length || c === 34)) members[top] = [start, p];
    return true;
  }
  ws(); if (!value(null)) failed = true;
  while (!failed && stack.length) {
    const f = stack[stack.length - 1]; ws();
    if (f.state === 'first' || f.state === 'next') {
      const close = f.object ? 125 : 93;
      if (f.state === 'first' && buf[p] === close) { p++; stack.pop(); if (f.top !== null) members[f.top] = [f.start, p]; continue; }
      if (f.object) {
        if (buf[p] !== 34) { failed = true; break; }
        const key = string(true, null); if (key === null) { failed = true; break; }
        const member = stack.length === 1 ? key.toString('utf8') : '';
        f.key = stack.length === 1 ? member : null;
        ws(); if (buf[p++] !== 58) { failed = true; break; }
      }
      f.state = 'after'; if (!value(f.key)) failed = true;
    } else if (buf[p] === 44) { p++; f.state = 'next'; }
    else if (buf[p] === (f.object ? 125 : 93)) { p++; stack.pop(); if (f.top !== null) members[f.top] = [f.start, p]; }
    else failed = true;
  }
  ws();
  return { wellFormed: !failed && !stack.length && p === buf.length, members: (buf.findIndex(b => ![32, 9, 10, 13].includes(b)) >= 0 && buf[buf.findIndex(b => ![32, 9, 10, 13].includes(b))] === 123) ? members : Object.create(null) };
}

function detect(buf, values, budget = LINE_BUDGET) {
  const needles = values.filter(Boolean).map(v => Buffer.from(v));
  if (!needles.length) return 'clean';
  let key = needles.some(n => buf.includes(n)), unchecked = false, work = 0, batch = Buffer.allocUnsafe(1024 * 1024), size = 0;
  const shortest = Math.min(...needles.map(n => n.length));
  const spend = n => { work += n; if (work > budget) throw exhausted; };
  function flush() {
    if (!size) return;
    if (unchecked) { size = 0; return; }
    try { if (findSpellings(batch.subarray(0, size), values, false, false, spend).marked.some(Boolean)) key = true; }
    catch (e) { if (e !== exhausted) throw e; unchecked = true; }
    size = 0;
  }
  function piece(b) {
    if (needles.some(n => b.includes(n))) key = true;
    if (!b.includes(37) && !b.includes(92)) return;
    for (let p = 0; p < b.length;) {
      if (!escapeLike(b[p])) { p++; continue; }
      const start = p; let escaped = false;
      while (p < b.length && escapeLike(b[p])) { if (b[p] === 37 || b[p] === 92) escaped = true; p++; }
      const length = p - start;
      if (!escaped || length < shortest) continue;
      if (length > 4096) { unchecked = true; continue; }
      if (size + length + (size ? 1 : 0) > 1024 * 1024) flush();
      if (size) batch[size++] = 10;
      b.copy(batch, size, start, p); size += length;
    }
  }
  // Validate before visiting: malformed input is one raw piece, not partial tokens.
  const parsed = readLine(buf);
  if (!parsed.wellFormed) piece(buf);
  else {
    let last = 0;
    readLine(buf, { visit: t => { if (t.start > last) piece(buf.subarray(last, t.start)); piece(t.text); last = t.end; } });
    if (last < buf.length) piece(buf.subarray(last));
  }
  flush(); return unchecked ? 'unchecked' : key ? 'key' : 'clean';
}

function createLineChecker({ name, values }) {
  const needles = values.filter(Boolean).map(v => Buffer.from(v));
  function held(buf, parsed, reason, oversized) {
    const m = parsed.members, has = k => Object.prototype.hasOwnProperty.call(m, k);
    const kind = oversized ? (has('method') && has('id') ? 'request' : has('id') ? 'reply' : 'message') :
      (has('id') && (has('result') || has('error')) ? 'reply' : has('method') && has('id') ? 'request' : 'message');
    const why = reason === 'key' ? 'contained one of its keys' : reason === 'unchecked' ? 'could not be checked for keys' : 'was over 32 MiB';
    const note = `tool ${name}: held back a ${kind} that ${why}`;
    let out = null, toServer = null;
    if (kind !== 'message') {
      const id = buf.subarray(...m.id);
      if (kind === 'request') {
        const text = reason === 'key' ? "contained one of this tool's keys" : why;
        toServer = Buffer.concat([Buffer.from('{"jsonrpc":"2.0","id":'), id, Buffer.from(`,"error":{"code":-32603,"message":${JSON.stringify('held back by wheelchair: the request ' + text)}}}\n`)]);
      } else if (detect(id, values) === 'clean') {
        const text = `tool ${name}: its reply ${why} and was held back`;
        const reply = Buffer.concat([Buffer.from('{"jsonrpc":"2.0","id":'), id, Buffer.from(`,"error":{"code":-32603,"message":${JSON.stringify(text)}}}\n`)]);
        if (detect(reply, values) === 'clean') out = reply;
      }
    }
    return { out, toServer, note };
  }
  return {
    line(buf) {
      const result = detect(buf, values);
      if (result === 'clean') return { out: buf, toServer: null, note: null };
      const parsed = readLine(buf), marked = new Uint8Array(buf.length);
      let found = false, start = -1, end = -1;
      const positions = needles.map(n => buf.indexOf(n));
      function mark() { if (start < 0) return; marked.fill(1, start, end); marked[start] = 2; found = true; }
      for (;;) {
        let which = -1;
        for (let i = 0; i < positions.length; i++) if (positions[i] !== -1 && (which < 0 || positions[i] < positions[which])) which = i;
        if (which < 0) break;
        const p = positions[which], next = p + needles[which].length;
        positions[which] = buf.indexOf(needles[which], p + 1);
        if (p >= end) { mark(); start = p; end = next; } else end = Math.max(end, next);
      }
      mark();
      if (parsed.wellFormed && found) {
        let last = 0, valid = true;
        const any = (a, b) => marked.subarray(a, b).some(Boolean);
        readLine(buf, { visit: t => {
          if (any(last, t.start + 1)) valid = false;
          if (t.name || ['jsonrpc', 'id', 'method'].includes(t.top)) {
            if (any(t.start, t.end)) valid = false;
          } else {
            if (marked[t.end - 1]) valid = false;
            for (let p = t.start + 1; p < t.end - 1;) {
              if (buf[p] !== 92) { p++; continue; }
              const end = p + (buf[p + 1] === 117 ? 6 : 2);
              if (any(p, end)) valid = false;
              p = end;
            }
          }
          last = t.end;
        } });
        if (any(last, buf.length)) valid = false;
        if (valid) {
          let length = 0;
          for (let p = 0; p < buf.length;) {
            if (!marked[p]) { length++; p++; continue; }
            length += 5; p++; while (p < buf.length && marked[p] === 1) p++;
          }
          const out = Buffer.allocUnsafe(length); let at = 0;
          for (let p = 0; p < buf.length;) {
            const start = p, replaced = marked[p];
            p++; while (p < buf.length && (replaced ? marked[p] === 1 : marked[p] === 0)) p++;
            if (replaced) { out.write('[key]', at); at += 5; }
            else { buf.copy(out, at, start, p); at += p - start; }
          }
          if (detect(out, values) === 'clean') return { out, toServer: null, note: null };
        }
      }
      return held(buf, parsed.wellFormed ? parsed : { members: {} }, result, false);
    },
    oversized(buf) { return held(buf, readLine(buf, { prefix: true }), 'oversized', true); },
  };
}
module.exports = { LINE_LIMIT, LINE_BUDGET, detect, readLine, createLineChecker };
