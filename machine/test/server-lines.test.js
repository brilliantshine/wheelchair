'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { detect, readLine, createLineChecker } = require('../lib/server-lines');
const key = 'secret123';
const checker = createLineChecker({ name: 'demo', values: [key] });
const line = s => checker.line(Buffer.from(s));
test('clean bytes and raw value replacement', () => {
  const raw = Buffer.from(' { "id" : 9007199254740993, "result":1.0 }\r\n');
  assert.equal(checker.line(raw).out, raw);
  assert.equal(line('{"id":1,"result":"secret123"}\n').out.toString(), '{"id":1,"result":"[key]"}\n');
  assert.equal(line('{"id":1,"result":"secret123secret123"}').out.toString(), '{"id":1,"result":"[key][key]"}');
  assert.equal(line('{"method":"note","params":"secret123"}').out.toString(), '{"method":"note","params":"[key]"}');
});
test('escaped key and names are held with exact reply id', () => {
  for (const id of ['9007199254740993', '"odd id"']) {
    for (const body of ['"secret123":1', '"result":"\\u0073ecret123"']) {
      const r = line(`{"id":${id},${body},"result":0}\n`);
      assert.match(r.out.toString(), new RegExp(`"id":${id}`));
      assert.match(r.note, /held back a reply/);
    }
  }
  assert.equal(line('{"id":"secret123","result":0}').out, null);
  assert.equal(line('{"method":"n","secret123":0}').out, null);
});
test('server requests return their own id and redact parameters', () => {
  const c = createLineChecker({ name: 'demo', values: ['roots/list'] });
  const r = c.line(Buffer.from('{"method":"roots/list","id":7}'));
  assert.equal(r.out, null); assert.match(r.toServer.toString(), /"id":7/);
  assert.equal(c.line(Buffer.from('{"method":"ok","id":7,"params":"roots/list"}')).out.toString(), '{"method":"ok","id":7,"params":"[key]"}');
  const escaped = c.line(Buffer.from('{"id":7,"result":"roots\\/list"}'));
  assert.match(escaped.note, /contained one of its keys/);
});
test('escaped runs, budget and prefix classification', () => {
  assert.equal(detect(Buffer.from('"%73ecret123"'), [key]), 'key');
  assert.equal(detect(Buffer.from('"%41'.padEnd(5000, 'A') + '"'), [key]), 'unchecked');
  assert.equal(detect(Buffer.from('"%73ecret123"'), [key], 0), 'unchecked');
  const overlap = createLineChecker({ name: 'demo', values: ['1secret123'] }).line(Buffer.from('{"id":1,"result":"\\u0031secret123"}'));
  assert.match(overlap.note, /contained one of its keys/);
  const over = checker.oversized(Buffer.from('{"id":9007199254740993,"result":"unfinished'));
  assert.match(over.out.toString(), /"id":9007199254740993/);
  assert.equal(checker.oversized(Buffer.from('{"result":"unfinished')).out, null);
  const request = checker.oversized(Buffer.from('{"id":1,"method":"ok","params":"unfinished'));
  assert.match(request.toServer.toString(), /request was over 32 MiB/);
});
test('reader reports decoded string ranges and complete members', () => {
  const tokens = [], buf = Buffer.from('{"id":"\\uD83D\\uDE00","result":1}');
  const result = readLine(buf, { visit: t => tokens.push({ ...t, text: t.text.toString() }) });
  assert.equal(result.wellFormed, true); assert.equal(tokens[1].text, '😀');
  assert.equal(buf.subarray(...result.members.id).toString(), '"\\uD83D\\uDE00"');
  assert.equal(readLine(Buffer.from('{"id":1,"result":'), { prefix: true }).members.id[0], 6);
  assert.equal(readLine(Buffer.from('{"id":1'), { prefix: true }).members.id, undefined);
});
test('large clean replies and long escape runs stay bounded', () => {
  const c = createLineChecker({ name: 'demo', values: ['e3' + 'x'.repeat(38), 'n6' + 'y'.repeat(38)] });
  for (const payload of ['A'.repeat(8 * 1024 * 1024), 'A'.repeat(4 * 1024 * 1024) + '\\/' + 'A'.repeat(4 * 1024 * 1024), '\\n\\"é'.repeat(2796203)]) {
    const input = Buffer.from('{"id":1,"result":"' + payload + '"}');
    const start = Date.now(); assert.equal(c.line(input).out, input); assert.ok(Date.now() - start < 5000);
  }
  const values = Array.from({ length: 20 }, (_, i) => 'A' + String(i).padStart(3, '0') + 'B'.repeat(4092));
  for (const escape of ['%41', '\\\\u0041']) {
    const input = Buffer.from('{"id":1,"result":"' + 'A'.repeat(1024 * 1024) + escape + '"}');
    const before = process.memoryUsage();
    assert.equal(detect(input, values), 'unchecked');
    const after = process.memoryUsage();
    assert.ok(after.heapUsed + after.arrayBuffers - before.heapUsed - before.arrayBuffers < 200 * 1024 * 1024);
  }
});
test('large repeated URLs and pretty printed content pass unchanged', () => {
  const values = ['a'.repeat(40), 'b'.repeat(40), 'c'.repeat(40), 'd'.repeat(8), 'e'.repeat(8), 'f'.repeat(8)];
  const c = createLineChecker({ name: 'demo', values });
  for (const [payload, limit] of [
    ['{"id":1,"result":"' + ('https://example.org/path%20name' + 'x'.repeat(28) + ' ').repeat(200000) + 'A'.repeat(5 * 1024 * 1024) + '"}', 10000],
    ['{"id":1,"result":{"content":[' + ('\n {"text":"Hello there, friend"},'.repeat(130000)) + '{}]}}', 5000],
  ]) {
    const input = Buffer.from(payload), start = Date.now();
    assert.equal(c.line(input).out, input); assert.ok(Date.now() - start < limit);
  }
});
test('budget exhaustion uses fresh checks for exact reply id', () => {
  const c = createLineChecker({ name: 'demo', values: ['A'.repeat(40)] });
  const stretch = ('%41' + 'A'.repeat(38) + ' ').repeat(780000);
  let input = Buffer.from('{"id":9007199254740993,"result":"' + stretch + '"}');
  let start = Date.now(), result = c.line(input);
  assert.ok(Date.now() - start < 15000); assert.match(result.note, /could not be checked/);
  assert.match(result.out.toString(), /"id":9007199254740993/);
  input = Buffer.from('{"id":"' + stretch + '","result":1}');
  start = Date.now(); result = c.line(input);
  assert.ok(Date.now() - start < 15000); assert.equal(result.out, null);
  input = Buffer.from('{"id":3,"method":"test","params":"' + stretch + '"}');
  result = c.line(input); assert.match(result.toServer.toString(), /request could not be checked for keys/);
});
test('many tokens with one echoed key can be replaced without excessive memory', () => {
  const input = Buffer.from('{"id":1,"result":[' + '0,'.repeat(16 * 1024 * 1024 - 20) + '"secret123"]}');
  const before = process.memoryUsage(), result = checker.line(input), after = process.memoryUsage();
  assert.ok(result.out.includes(Buffer.from('[key]'))); assert.equal(result.out.includes(Buffer.from(key)), false);
  assert.ok(after.heapUsed + after.arrayBuffers - before.heapUsed - before.arrayBuffers < input.length * 5);
});
test('escaped keys remain found across batches', () => {
  const filler = ('%20xxxxxxxx ').repeat(90000);
  for (const payload of ['%73ecret123 ' + filler, filler + '%73ecret123']) {
    const input = Buffer.from('{"id":1,"result":"' + payload + '"}');
    const r = checker.line(input); assert.notEqual(r.note, null); assert.equal(r.out.includes(Buffer.from('secret123')), false);
  }
});
test('large batches with many long keys stay within memory budget', () => {
  const values = Array.from({ length: 20 }, (_, i) => 'A' + String(i).padStart(3, '0') + 'B'.repeat(4092));
  const input = Buffer.from('{"id":1,"result":"' + ('%41' + 'C'.repeat(4093) + ' ').repeat(250) + '"}');
  const before = process.memoryUsage(); const result = detect(input, values); const after = process.memoryUsage();
  assert.ok(['clean', 'unchecked'].includes(result));
  assert.ok(after.heapUsed + after.arrayBuffers - before.heapUsed - before.arrayBuffers < 150 * 1024 * 1024);
});
