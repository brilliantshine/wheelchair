'use strict';

const { USABLE_KEY_CHAR } = require('./project-keys');

const PERCENT = 37;
const BACKSLASH = 92;
// A single three-layer spelling consumes at most 216 bytes.
const RING_SIZE = 256;
const RING_MASK = RING_SIZE - 1;
const MAX_SPELLING = 6 ** 3;
const BITSET_SLAB_SIZE = 256;
const usable = Uint8Array.from({ length: 256 }, (_, byte) =>
  Number(USABLE_KEY_CHAR.test(String.fromCharCode(byte))));
const escapeByte = byte => byte === PERCENT || byte === BACKSLASH;
const escapeLike = byte => usable[byte] || escapeByte(byte);

// Pack relative ends so ordinary bytes can reuse a single immutable pair.
const rawPairs = Array.from({ length: 256 }, (_, byte) => [65536 | byte]);
const noPairs = [];
const slashPairs = rawPairs.map((_, byte) => [65536 | BACKSLASH, (2 << 16) | byte]);
const percentPairs = rawPairs.map((_, byte) => [65536 | PERCENT, (3 << 16) | byte]);
const hex = new Int8Array(256).fill(-1);
for (const digits of ['0123456789abcdef', '0123456789ABCDEF']) {
  for (let i = 0; i < digits.length; i++) hex[digits.charCodeAt(i)] = i;
}

function spellings(buffer, spend) {
  const cache = Array.from({ length: 3 }, () =>
    Array.from({ length: RING_SIZE }, () => ({ position: -1, pairs: noPairs, scratch: [] })));

  function add(pairs, code, width) {
    const pair = (width << 16) | code;
    if (!pairs.includes(pair)) pairs.push(pair);
  }

  function digits(level, origin, pos, left, code, pairs) {
    for (const pair of at(level, pos)) {
      const digit = hex[pair & 65535];
      if (!(digit >= 0)) continue;
      const end = pos + (pair >>> 16);
      const next = (code << 4) | digit;
      if (left === 1) add(pairs, next, end - origin);
      else digits(level, origin, end, left - 1, next, pairs);
    }
  }

  function at(level, pos) {
    const byte = buffer[pos];
    if (byte === undefined) return noPairs;
    if (!level || !escapeByte(byte)) return rawPairs[byte];
    const entry = cache[level - 1][pos & RING_MASK];
    if (entry.position === pos) return entry.pairs;
    const nextByte = buffer[pos + 1];
    // These escapes consume only ordinary bytes and cannot introduce an
    // escape at the next layer. Use the same pairs at every depth.
    let simple;
    if (byte === BACKSLASH && nextByte !== undefined &&
        !escapeByte(nextByte) && nextByte !== 117 && nextByte !== 120) {
      simple = slashPairs[nextByte];
    } else if (byte === PERCENT && !escapeByte(nextByte) && !escapeByte(buffer[pos + 2])) {
      const high = hex[nextByte], low = hex[buffer[pos + 2]];
      if (!(high >= 0 && low >= 0)) simple = rawPairs[PERCENT];
      else {
        const decoded = (high << 4) | low;
        if (!escapeByte(decoded)) simple = percentPairs[decoded];
      }
    }
    if (simple) {
      entry.position = pos;
      entry.pairs = simple;
      spend(simple.length);
      return simple;
    }
    const pairs = entry.scratch;
    const inner = at(level - 1, pos);
    pairs.length = 0;
    for (const pair of inner) pairs.push(pair);
    for (const pair of inner) {
      const code = pair & 65535;
      const next = pos + (pair >>> 16);
      if (code === PERCENT) digits(level - 1, pos, next, 2, 0, pairs);
      if (code !== BACKSLASH) continue;
      for (const following of at(level - 1, next)) {
        const tail = following & 65535;
        const end = next + (following >>> 16);
        add(pairs, tail, end - pos);
        if (tail === 117) digits(level - 1, pos, end, 4, 0, pairs);
        if (tail === 120) digits(level - 1, pos, end, 2, 0, pairs);
      }
    }
    entry.position = pos;
    entry.pairs = pairs;
    spend(pairs.length);
    return pairs;
  }

  return at;
}

function keyState(bytes, spend) {
  const length = bytes.length;
  const words = (length >>> 5) + 1;
  const masks = new Array(256);
  const chars = [...new Set(bytes)];
  spend(length + words * chars.length);
  for (const c of chars) masks[c] = words === 1 ? 0 : new Uint32Array(words);
  for (let i = 0; i < length; i++) {
    const c = bytes[i];
    if (words === 1) masks[c] |= 1 << i;
    else masks[c][i >>> 5] |= 1 << (i & 31);
  }
  return {
    first: bytes[0], length, words, masks, chars,
    lastWord: length >>> 5, lastBit: 1 << (length & 31),
    ring: new Array(RING_SIZE), pending: 0, records: [], pool: [], completed: false,
    slab: null, slabOffset: 0, good: null,
  };
}

function newBitset(state) {
  const { words } = state;
  if (!state.slab || state.slabOffset === state.slab.length) {
    state.slab = new Uint32Array(words * BITSET_SLAB_SIZE);
    state.slabOffset = 0;
  }
  const offset = state.slabOffset;
  state.slabOffset += words;
  return state.slab.subarray(offset, offset + words);
}

function position(state, p, slots) {
  const slot = p & RING_MASK;
  let record = state.ring[slot];
  if (record) return record;
  record = state.pool.pop() || {
    state, p: 0, bits: 0, indices: state.words === 1 ? null : newBitset(state),
    next: null, char: 0, extra: null,
  };
  record.p = p;
  state.ring[slot] = record;
  slots[slot].push(record);
  state.pending++;
  return record;
}

// A forward record retains its taken edges until its key has no pending
// positions. At that point no future match can use these records.
function finishRecords(state, marks, spend) {
  const { records, words, lastWord, lastBit, masks, pool } = state;
  if (state.completed) {
    for (let i = records.length - 1; i >= 0; i--) {
      const record = records[i];
      const extra = record.extra;
      const edgeCount = record.next ? 1 + (extra ? extra.length / 2 : 0) : 0;
      spend(words * (1 + edgeCount));
      if (words === 1) {
        const bits = record.bits;
        let good = bits & lastBit;
        for (let e = 0; e < edgeCount; e++) {
          const next = e === 0 ? record.next : extra[(e - 1) * 2];
          const char = e === 0 ? record.char : extra[(e - 1) * 2 + 1];
          const matches = bits & masks[char] & (next.bits >>> 1);
          if (!matches) continue;
          good |= matches;
          marks[record.p]++;
          marks[next.p]--;
        }
        record.bits = good;
      } else {
        const bits = record.indices;
        const good = state.good;
        good.fill(0);
        good[lastWord] = bits[lastWord] & lastBit;
        for (let e = 0; e < edgeCount; e++) {
          const next = e === 0 ? record.next : extra[(e - 1) * 2];
          const char = e === 0 ? record.char : extra[(e - 1) * 2 + 1];
          const right = next.indices, mask = masks[char];
          let any = 0;
          for (let w = 0; w < words; w++) {
            const matches = bits[w] & mask[w] & ((right[w] >>> 1) | (w < lastWord ? right[w + 1] << 31 : 0));
            good[w] |= matches;
            any |= matches;
          }
          if (any) {
            marks[record.p]++;
            marks[next.p]--;
          }
        }
        bits.set(good);
      }
    }
  }
  spend(words * records.length);
  for (const record of records) {
    record.next = null;
    if (record.extra) record.extra.length = 0;
    if (words === 1) record.bits = 0;
    else record.indices.fill(0);
    pool.push(record);
  }
  records.length = 0;
  state.completed = false;
}

function forward(buffer, states, at, spend, marks, tail) {
  const completeKeys = marks !== null;
  // A transition never wraps far enough to revisit a live slot.
  const slots = Array.from({ length: RING_SIZE }, () => []);
  const startKeys = rawPairs.map(() => []);
  let maxWords = 0;
  for (const state of states) maxWords = Math.max(maxWords, state.words);
  const shifted = new Uint32Array(maxWords);
  let limit = completeKeys ? buffer.length : 0, furthest = 0;
  for (const state of states) {
    if (completeKeys) {
      startKeys[state.first].push(state);
      if (state.words > 1) state.good = new Uint32Array(state.words);
    } else {
      if (state.length > 1) {
        const initial = position(state, 0, slots);
        setInitial(state, initial, 1, spend);
      }
      for (const c of state.chars) {
        for (const end of tail(3, c)) {
          const target = position(state, end, slots);
          shiftInto(state, state.masks[c], target, spend);
          if (end > limit) limit = end;
        }
      }
    }
  }

  for (let p = 0; p <= limit; p++) {
    const active = slots[p & RING_MASK];
    const byte = buffer[p];
    let pairs;
    if (completeKeys && escapeLike(byte)) {
      pairs = escapeByte(byte) ? at(3, p) : rawPairs[byte];
      for (const pair of pairs) {
        const starters = startKeys[pair & 65535];
        if (!starters) continue;
        for (const state of starters) {
          const record = position(state, p, slots);
          spend(1);
          if (state.words === 1) record.bits |= 1;
          else record.indices[0] |= 1;
        }
      }
    }
    if (!active.length) continue;
    pairs ||= escapeLike(byte) ? at(3, p) : noPairs;
    for (const record of active) {
      const { state } = record;
      const { words, masks, lastWord, lastBit } = state;
      if (completeKeys) state.records.push(record);
      spend(1);
      const reached = words === 1 ? record.bits & lastBit : record.indices[lastWord] & lastBit;
      if (reached) {
        if (completeKeys) state.completed = true;
        else furthest = p;
      }
      for (const pair of pairs) {
        const c = pair & 65535;
        const mask = masks[c];
        if (!mask) continue;
        const end = p + (pair >>> 16);
        let target;
        spend(words);
        if (words === 1) {
          const next = (record.bits & mask) << 1;
          if (!next) continue;
          target = position(state, end, slots);
          target.bits |= next;
        } else {
          let carry = 0, any = 0;
          const bits = record.indices;
          for (let w = 0; w < words; w++) {
            const match = bits[w] & mask[w];
            const next = (match << 1) | carry;
            carry = match >>> 31;
            shifted[w] = next;
            any |= next;
          }
          if (!any) continue;
          target = position(state, end, slots);
          for (let w = 0; w < words; w++) target.indices[w] |= shifted[w];
        }
        if (completeKeys) {
          if (record.next) (record.extra ||= []).push(target, c);
          else {
            record.next = target;
            record.char = c;
          }
        } else if (end > limit) limit = end;
      }
      state.ring[p & RING_MASK] = undefined;
      if (--state.pending === 0 && completeKeys) finishRecords(state, marks, spend);
      if (!completeKeys) {
        spend(words);
        if (words === 1) record.bits = 0;
        else record.indices.fill(0);
        state.pool.push(record);
      }
    }
    active.length = 0;
  }
  return furthest;
}

function setInitial(state, record, first, spend) {
  const { words, length } = state;
  spend(words);
  if (words === 1) {
    record.bits = ((1 << length) - 1) & (-1 << first);
    return;
  }
  record.indices.fill(0xffffffff);
  record.indices[0] &= -1 << first;
  record.indices[words - 1] = (1 << (length & 31)) - 1;
}

function shiftInto(state, mask, target, spend) {
  const { words } = state;
  spend(words);
  if (words === 1) {
    target.bits |= mask << 1;
    return;
  }
  let carry = 0;
  for (let w = 0; w < words; w++) {
    target.indices[w] |= (mask[w] << 1) | carry;
    carry = mask[w] >>> 31;
  }
}

const sequences = Array.from({ length: 128 }, (_, code) => {
  const lo = code.toString(16).padStart(2, '0');
  const result = [[code], [BACKSLASH, code]];
  for (const first of new Set([lo[0], lo[0].toUpperCase()])) {
    for (const second of new Set([lo[1], lo[1].toUpperCase()])) {
      const digits = [first.charCodeAt(0), second.charCodeAt(0)];
      result.push([PERCENT, ...digits], [BACKSLASH, 120, ...digits], [BACKSLASH, 117, 48, 48, ...digits]);
    }
  }
  return result;
});

// A cut can fall inside one piece of an escape or at a piece boundary.
function tails(at, spend) {
  const cache = Array.from({ length: 3 }, () => new Array(128));
  function tail(level, c) {
    if (!level) return noPairs;
    if (cache[level - 1][c]) return cache[level - 1][c];
    const ends = new Set();
    for (const seq of sequences[c]) {
      for (let i = 0; i < seq.length; i++) {
        let current = new Set(tail(level - 1, seq[i]));
        // A cut at a piece boundary must skip at least one piece.
        if (i + 1 < seq.length) current.add(0);
        for (let j = i + 1; current.size && j < seq.length; j++) {
          const next = new Set();
          for (const p of current) for (const pair of at(level - 1, p)) {
            if ((pair & 65535) === seq[j]) next.add(p + (pair >>> 16));
          }
          current = next;
        }
        spend(1 + current.size);
        for (const end of current) ends.add(end);
      }
    }
    const result = [...ends];
    cache[level - 1][c] = result;
    return result;
  }
  return tail;
}

function prefixes(buffer, at, spend) {
  const n = buffer.length;
  const cache = Array.from({ length: 3 }, () => new Uint8Array(MAX_SPELLING * 128));
  function prefix(level, c, p) {
    if (!level || !escapeByte(buffer[p]) || n - p >= 6 ** level) return false;
    const index = (n - p) * 128 + c;
    const table = cache[level - 1];
    if (table[index]) return table[index] === 2;
    spend(1);
    for (const seq of sequences[c]) {
      let positions = new Set([p]);
      for (const piece of seq) {
        if (!positions.size) break;
        const next = new Set();
        for (const pos of positions) {
          if (pos === n || prefix(level - 1, piece, pos)) {
            table[index] = 2;
            return true;
          }
          for (const pair of at(level - 1, pos)) {
            if ((pair & 65535) === piece) next.add(pos + (pair >>> 16));
          }
        }
        positions = next;
      }
    }
    table[index] = 1;
    return false;
  }
  return prefix;
}

// Work back from the real end using whole characters and proper prefixes.
function cutEndPosition(buffer, states, at, spend) {
  const n = buffer.length;
  const prefix = prefixes(buffer, at, spend);
  let earliest = n;
  for (const state of states) {
    const { words, masks, chars, lastWord } = state;
    const ring = new Array(RING_SIZE);
    const pool = [];
    const seed = { indices: words === 1 ? null : new Uint32Array(words) };
    setInitial(state, seed, 0, spend);
    ring[n & RING_MASK] = words === 1 ? seed.bits : seed.indices;
    let last = n;
    for (let p = n - 1; p >= 0 && escapeLike(buffer[p]); p--) {
      if (n - p >= MAX_SPELLING && last - p > MAX_SPELLING) break;
      spend(words);
      const slot = p & RING_MASK;
      const old = ring[slot];
      if (words > 1 && old) pool.push(old);
      const good = words === 1 ? null : pool.pop() || new Uint32Array(words);
      let bits = 0;
      if (good) good.fill(0);
      if (n - p < MAX_SPELLING && escapeByte(buffer[p])) {
        for (const c of chars) {
          if (!prefix(3, c, p)) continue;
          const mask = masks[c];
          spend(words);
          if (good) for (let w = 0; w < words; w++) good[w] |= mask[w];
          else bits |= mask;
        }
      }
      for (const pair of at(3, p)) {
        const mask = masks[pair & 65535];
        const end = p + (pair >>> 16);
        const right = ring[end & RING_MASK];
        if (!mask || !right) continue;
        spend(words);
        if (good) {
          for (let w = 0; w < words; w++) good[w] |= mask[w] & ((right[w] >>> 1) | (w < lastWord ? right[w + 1] << 31 : 0));
        } else bits |= mask & (right >>> 1);
      }
      if (good) {
        if (good.some(Boolean)) {
          last = p;
          if (good[0] & 1) earliest = Math.min(earliest, p);
          ring[slot] = good;
        } else {
          pool.push(good);
          ring[slot] = undefined;
        }
      } else {
        if (bits) last = p;
        if (bits & 1) earliest = Math.min(earliest, p);
        ring[slot] = bits;
      }
    }
  }
  return earliest;
}

function findSpellings(buffer, values, cutStart, cutEnd, spend) {
  // Charge the capture once, including bytes revisited by either edge search.
  spend(buffer.length);
  const at = spellings(buffer, spend);
  const states = values.filter(value => value.length).map(value => keyState(Buffer.from(value), spend));
  const marks = new Int32Array(buffer.length + 1);
  forward(buffer, states, at, spend, marks);
  const start = cutStart && escapeLike(buffer[0]) ? forward(buffer, states, at, spend, null, tails(at, spend)) : 0;
  const end = cutEnd ? cutEndPosition(buffer, states, at, spend) : buffer.length;
  const marked = new Uint8Array(buffer.length);
  let depth = 0;
  for (let p = 0; p < buffer.length; p++) {
    depth += marks[p];
    if (depth) marked[p] = 1;
  }
  return { marked, start, end };
}

module.exports = { findSpellings, usable, escapeByte, escapeLike };
