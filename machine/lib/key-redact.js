'use strict';
const { USABLE_KEY_CHAR } = require('./project-keys');
const marker = Buffer.from('[output cut]');
function redactCapture(buffer, values, { cutStart = false, cutEnd = false } = {}) {
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
module.exports = { redactCapture };
