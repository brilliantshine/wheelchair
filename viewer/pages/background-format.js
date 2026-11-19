(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.wcBackgroundFormat = api;
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  const LIMIT = 25 * 1024 * 1024;
  function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
  function invalid(type) { fail(422, `Invalid ${type} container`); }
  function text(b, p, n) { return String.fromCharCode(...b.subarray(p, p + n)); }
  function be16(b, p) { return b[p] * 256 + b[p + 1]; }
  function be32(b, p) { return b[p] * 0x1000000 + b[p + 1] * 65536 + b[p + 2] * 256 + b[p + 3]; }
  function le32(b, p) { return b[p] + b[p + 1] * 256 + b[p + 2] * 65536 + b[p + 3] * 0x1000000; }

  function png(b) {
    let p = 8, header = false, payload = false, end = false;
    while (p + 12 <= b.length) {
      const n = be32(b, p), tag = text(b, p + 4, 4);
      if (n > b.length - p - 12) break;
      if (!header) {
        if (tag !== 'IHDR' || n !== 13 || !be32(b, p + 8) || !be32(b, p + 12)) break;
        header = true;
      }
      if (tag === 'IDAT' && n) payload = true;
      p += n + 12;
      if (tag === 'IEND' && n === 0) { end = true; break; }
    }
    if (!header || !payload || !end || p !== b.length) invalid('PNG');
  }

  function jpeg(b) {
    let p = 2, frame = false, scan = false, scanBytes = 0, end = false;
    while (p < b.length) {
      if (scan && b[p] !== 0xff) { p++; scanBytes++; continue; }
      if (b[p++] !== 0xff) break;
      while (p < b.length && b[p] === 0xff) p++;
      if (p >= b.length) break;
      const marker = b[p++];
      if (scan && marker === 0) { scanBytes++; continue; }
      if (marker === 0xd9) { end = true; break; }
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (p + 2 > b.length) break;
      const n = be16(b, p);
      if (n < 2 || n > b.length - p) break;
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        if (n < 11 || !be16(b, p + 3) || !be16(b, p + 5) || !b[p + 7] || n !== 8 + 3 * b[p + 7]) break;
        frame = true;
      }
      if (marker === 0xda) {
        if (!frame || n < 8 || !b[p + 2] || n !== 6 + 2 * b[p + 2]) break;
        scan = true;
      }
      p += n;
    }
    if (!frame || !scan || !scanBytes || !end || p !== b.length) invalid('JPEG');
  }

  function webp(b, frameOnly = false) {
    const end = le32(b, 4) + 8;
    if (end !== b.length) invalid('WEBP');
    let p = 12, payload = false;
    while (p + 8 <= end) {
      const tag = text(b, p, 4), n = le32(b, p + 4), data = p + 8;
      if (n > end - data || data + n + (n % 2) > end) invalid('WEBP');
      if (tag === 'VP8 ') {
        const partition = (b[data] + b[data + 1] * 256 + b[data + 2] * 65536) >>> 5;
        const width = (b[data + 6] + b[data + 7] * 256) & 0x3fff;
        const height = (b[data + 8] + b[data + 9] * 256) & 0x3fff;
        if (n < 11 || (b[data] & 1) || text(b, data + 3, 3) !== '\x9d\x01\x2a' || !width || !height || !partition || partition > n - 10) invalid('WEBP');
        payload = true;
      } else if (tag === 'VP8L') {
        if (n < 6 || b[data] !== 0x2f || (b[data + 4] & 0xe0)) invalid('WEBP');
        payload = true;
      } else if (tag === 'VP8X') {
        if (n !== 10 || (b[data] & 0xc1) || b[data + 1] || b[data + 2] || b[data + 3]) invalid('WEBP');
      } else if (tag === 'ANMF') {
        if (frameOnly) invalid('WEBP');
        // A frame header is followed by a complete, padded VP8/VP8L chunk.
        if (n < 24) invalid('WEBP');
        const frame = new Uint8Array(n - 16 + 12);
        frame.set([82, 73, 70, 70], 0);
        const size = frame.length - 8;
        frame.set([size & 255, (size >>> 8) & 255, (size >>> 16) & 255, (size >>> 24) & 255, 87, 69, 66, 80], 4);
        frame.set(b.subarray(data + 16, data + n), 12);
        webp(frame, true);
        payload = true;
      }
      p = data + n + (n % 2);
    }
    if (p !== end || !payload) invalid('WEBP');
  }

  function gif(b) {
    if (b.length < 13 || !(b[6] || b[7]) || !(b[8] || b[9])) invalid('GIF');
    const headerEnd = 13 + ((b[10] & 128) ? 3 * (1 << ((b[10] & 7) + 1)) : 0);
    if (headerEnd > b.length) invalid('GIF');
    let p = headerEnd, frames = 0, trailer = false;
    const loops = [];
    function need(n) { if (n > b.length - p) invalid('GIF'); }
    function blocks() {
      let total = 0;
      while (true) {
        need(1);
        const n = b[p++];
        if (!n) return total;
        need(n); p += n; total += n;
      }
    }
    while (p < b.length) {
      const start = p, kind = b[p++];
      if (kind === 0x3b) { trailer = true; break; }
      if (kind === 0x21) {
        need(1);
        const label = b[p++];
        if (label === 0xff || label === 0xf9 || label === 0x01) {
          need(1);
          const n = b[p++];
          if ((label === 0xff && n !== 11) || (label === 0xf9 && n !== 4) || (label === 0x01 && n !== 12)) invalid('GIF');
          need(n);
          const id = text(b, p, n);
          p += n;
          blocks();
          if (label === 0xff && (id === 'NETSCAPE2.0' || id === 'ANIMEXTS1.0')) loops.push([start, p]);
        } else {
          blocks();
        }
      } else if (kind === 0x2c) {
        need(9);
        const packed = b[p + 8];
        if (!(b[p + 4] || b[p + 5]) || !(b[p + 6] || b[p + 7])) invalid('GIF');
        p += 9;
        if (packed & 128) { const n = 3 * (1 << ((packed & 7) + 1)); need(n); p += n; }
        need(1);
        if (b[p] < 2 || b[p] > 8) invalid('GIF');
        p++;
        if (!blocks()) invalid('GIF');
        frames++;
      } else invalid('GIF');
    }
    if (!trailer || !frames || p !== b.length) invalid('GIF');
    if (frames === 1) return b;
    const ext = Uint8Array.from([33, 255, 11, ...Array.from('NETSCAPE2.0', c => c.charCodeAt(0)), 3, 1, 0, 0, 0]);
    const parts = [b.subarray(0, headerEnd), ext];
    let pos = headerEnd;
    for (const [start, end] of loops) { parts.push(b.subarray(pos, start)); pos = end; }
    parts.push(b.subarray(pos));
    const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
    let offset = 0;
    for (const part of parts) { out.set(part, offset); offset += part.length; }
    out[4] = 57;
    return out;
  }

  function normalize(bytes, mediaType) {
    if (!(bytes instanceof Uint8Array)) fail(422, 'Invalid image bytes');
    if (bytes.length > LIMIT) fail(413, 'Image exceeds 25 MiB');
    let type, out = bytes;
    if (bytes.length >= 8 && text(bytes, 0, 8) === '\x89PNG\r\n\x1a\n') { type = 'image/png'; png(bytes); }
    else if (bytes.length >= 2 && bytes[0] === 255 && bytes[1] === 216) { type = 'image/jpeg'; jpeg(bytes); }
    else if (bytes.length >= 12 && text(bytes, 0, 4) === 'RIFF' && text(bytes, 8, 4) === 'WEBP') { type = 'image/webp'; webp(bytes); }
    else if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(text(bytes, 0, 6))) { type = 'image/gif'; out = gif(bytes); }
    else fail(415, 'Unsupported image type');
    if (mediaType !== undefined && mediaType !== type) fail(415, 'Image type does not match content');
    return { bytes: out, mediaType: type };
  }
  return { normalize };
});
