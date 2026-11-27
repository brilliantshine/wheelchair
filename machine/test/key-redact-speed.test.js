'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { redactCapture } = require('../lib/key-redact');

const size = 2 * 1024 * 1024;
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._~+/=-';
const noise = String.raw`%5C%25\\u00%2`;
const jsonLine = JSON.stringify({ msg: 'line 1 says "hi"\n', path: 'a/b' }) + '\n';

function generator(seed) {
  function random() {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
  }
  function keys(count, length) {
    return Array.from({ length: count }, () =>
      Array.from({ length }, () => alphabet[random() % alphabet.length]).join(''));
  }
  function spell(value, layers) {
    for (let i = 0; i < layers; i++) {
      value = Array.from(value, c => random() % 4
        ? '\\' + c : '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    }
    return value;
  }
  return { random, keys, spell };
}

function repeated(pattern, length) {
  return pattern.repeat(Math.ceil(length / pattern.length)).slice(0, length);
}

function jsonLines(length) {
  // Reserve a full final line so the capture contains only complete JSON lines.
  const count = Math.floor((length - 11) / jsonLine.length);
  const remaining = length - count * jsonLine.length;
  return jsonLine.repeat(count) + JSON.stringify({ msg: 'x'.repeat(remaining - 11) }) + '\n';
}

function timed(name, input, keys, cuts, expected, limit) {
  const buffer = Buffer.from(input);
  const start = performance.now();
  const output = redactCapture(buffer, keys, cuts).toString();
  const elapsed = performance.now() - start;
  console.log(`${name} redaction: ${elapsed.toFixed(1)} ms`);
  // Keep failure diagnostics small on multi-megabyte fixtures.
  const options = Array.isArray(expected) ? expected : [expected];
  if (!options.includes(output)) assert.fail(`${name} output differs at byte ${firstDifference(output, options[0])}`);
  assert.ok(elapsed < limit, `${name} took ${elapsed.toFixed(1)} ms (limit ${limit} ms)`);
}

function firstDifference(actual, expected) {
  let p = 0;
  while (p < actual.length && actual[p] === expected[p]) p++;
  return p;
}

test('(o) ordinary JSON with two-layer spellings', () => {
  const { keys, spell } = generator(0x1cc43e71);
  const values = keys(5, 32);
  const spellings = values.map(value => spell(value, 2) + '\n');
  const json = jsonLines(size - spellings.join('').length);
  timed('(o)', json + spellings.join(''), values, {},
    json + '[key]\n'.repeat(values.length), 1000);
});

test('(a) escape-heavy noise', () => {
  const input = repeated(noise, size);
  const { keys } = generator(0xa98225ca);
  timed('(a)', input, keys(5, 4096), {}, [input, '[not checked for keys]'], 3000);
});

test('(b) repeated late failures', () => {
  const input = repeated('%41', size);
  const keys = Array.from({ length: 5 }, (_, i) => 'A'.repeat(4095) + (i + 1));
  timed('(b)', input, keys, {}, [input, '[not checked for keys]'], 3000);
});

test('(c) noise with 20 keys and three-layer spellings', () => {
  const { random, keys, spell } = generator(0x4d99212e);
  const values = keys(20, 64);
  const source = [], expected = [];
  for (let p = 0; p < size; p += 1000) {
    const width = Math.min(size - p, 1000);
    const spelling = width === 1000 ? spell(values[random() % values.length], 3) : '';
    assert.ok(spelling.length < width);
    // End the noise at a repeat boundary before placing the spelling.
    const padding = width - spelling.length;
    const pad = noise.repeat(Math.ceil(padding / noise.length)).slice(-padding);
    source.push(pad + spelling);
    expected.push(pad + (spelling ? '[key]' : ''));
  }
  timed('(c)', source.join(''), values, {}, expected.join(''), 3000);
});

test('(d) JSON with three-layer spellings and both cut edges', () => {
  const { random, keys, spell } = generator(0x4d99212e);
  const values = keys(20, 64);
  const json = jsonLines(size);
  const source = [], expected = [];
  let p = 0;
  while (p < json.length) {
    const newline = json.indexOf('\n', p + 1000);
    const end = newline === -1 ? json.length : newline + 1;
    const chunk = json.slice(p, end);
    source.push(chunk);
    expected.push(chunk);
    if (newline !== -1) {
      source.push(spell(values[random() % values.length], 3) + '\n');
      expected.push('[key]\n');
    }
    p = end;
  }
  const first = spell(values[0], 3).slice(-40);
  const last = spell(values[1], 3).slice(0, 40);
  assert.match(first, /[%\\]/);
  assert.match(last, /[%\\]/);
  timed('(d)', first + ' ' + source.join('') + ' ' + last, values,
    { cutStart: true, cutEnd: true }, '[output cut] ' + expected.join('') + ' [output cut]', 3000);
});
