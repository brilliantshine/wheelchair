'use strict';
const { USABLE_KEY_CHAR } = require('./project-keys');
const { findSpellings, usable: usableBytes, escapeByte, escapeLike } = require('./key-spell');
const marker = Buffer.from('[output cut]');
const keyMarker = Buffer.from('[key]'), uncheckedMarker = Buffer.from('[not checked for keys]');
const DEFAULT_WORK_BUDGET = 64000000;
const exhausted = Symbol('work budget exhausted');
function plainCapture(buffer, values, { cutStart = false, cutEnd = false } = {}) {
  let start = 0, end = buffer.length;
  const usable = byte => USABLE_KEY_CHAR.test(String.fromCharCode(byte));
  if (cutStart) { while (start < end && usable(buffer[start])) start++; if (start < end) start++; }
  if (cutEnd) { while (end > start && usable(buffer[end - 1])) end--; }
  const body = buffer.subarray(start, end), marked = new Uint8Array(body.length);
  for (const value of values) {
    const needle = Buffer.from(value);
    if (!needle.length) continue;
    for (let at = body.indexOf(needle); at !== -1; at = body.indexOf(needle, at + 1)) marked.fill(1, at, at + needle.length);
  }
  const parts = cutStart ? [marker] : [];
  for (let i = 0; i < body.length;) {
    const markedRun = marked[i], begin = i++;
    while (i < body.length && marked[i] === markedRun) i++;
    parts.push(markedRun ? Buffer.from('[key]') : body.subarray(begin, i));
  }
  if (cutEnd) parts.push(marker);
  return Buffer.concat(parts);
}
function markUnchecked(buffer, values) {
  const marked = new Uint8Array(buffer.length);
  for (const value of values) {
    const needle = Buffer.from(value);
    if (!needle.length) continue;
    for (let at = buffer.indexOf(needle); at !== -1; at = buffer.indexOf(needle, at + 1)) {
      marked.fill(1, at, at + needle.length);
    }
  }
  for (let p = 0; p < buffer.length;) {
    if (!escapeLike(buffer[p])) {
      p++;
      continue;
    }
    const begin = p;
    let escaped = false;
    while (p < buffer.length && escapeLike(buffer[p])) {
      if (escapeByte(buffer[p])) escaped = true;
      p++;
    }
    if (escaped) marked.fill(2, begin, p);
  }
  return marked;
}

function redactCapture(buffer, values, { cutStart = false, cutEnd = false, workBudget = DEFAULT_WORK_BUDGET } = {}) {
  if (!values.length || (!buffer.includes(37) && !buffer.includes(92))) {
    return plainCapture(buffer, values, { cutStart, cutEnd });
  }
  const n = buffer.length;
  if (cutStart && cutEnd && buffer.every(escapeLike)) return Buffer.concat([marker, marker]);

  let start = 0, end = n;
  if (cutStart) {
    while (start < n && usableBytes[buffer[start]]) start++;
    if (start < n) start++;
  }
  if (cutEnd) while (end > 0 && usableBytes[buffer[end - 1]]) end--;

  let marked, work = 0;
  const spend = amount => {
    work += amount;
    if (work > workBudget) throw exhausted;
  };
  try {
    const found = findSpellings(buffer, values, cutStart, cutEnd, spend);
    marked = found.marked;
    start = Math.max(start, found.start);
    end = Math.min(end, found.end);
  } catch (error) {
    if (error !== exhausted) throw error;
    marked = markUnchecked(buffer, values);
  }

  const parts = cutStart ? [marker] : [];
  for (let p = start; p < end;) {
    const begin = p;
    const isMarked = marked[p] !== 0;
    let unchecked = false;
    while (p < end && (marked[p] !== 0) === isMarked) {
      if (marked[p] === 2) unchecked = true;
      p++;
    }
    parts.push(isMarked ? (unchecked ? uncheckedMarker : keyMarker) : buffer.subarray(begin, p));
  }
  if (cutEnd) parts.push(marker);
  return Buffer.concat(parts);
}
module.exports = { redactCapture };
