(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.wcBackgroundFormat = api;
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  const LIMIT = 25 * 1024 * 1024;
  function fail(status, message) { const e = new Error(message); e.status = status; throw e; }
  function normalize(bytes, mediaType) {
    if (!(bytes instanceof Uint8Array)) fail(422, 'Invalid image bytes');
    if (bytes.length > LIMIT) fail(413, 'Image exceeds 25 MiB');
    const b = bytes, str = (i, n) => String.fromCharCode(...b.subarray(i, i + n));
    const be = i => (b[i] * 0x1000000 + (b[i+1] << 16) + (b[i+2] << 8) + b[i+3]);
    const le = i => b[i] + b[i+1] * 256 + b[i+2] * 65536 + b[i+3] * 16777216;
    let type, out = b;
    if (b.length >= 8 && str(0, 8) === '\x89PNG\r\n\x1a\n') {
      type = 'image/png'; let p = 8, header = false, payload = false, end = false;
      while (p + 12 <= b.length) { const n = be(p), tag = str(p+4, 4); if (n > b.length - p - 12) break; if (!header) { if (tag !== 'IHDR' || n !== 13 || !be(p+8) || !be(p+12)) break; header = true; } if (tag === 'IDAT' && n) payload = true; p += n + 12; if (tag === 'IEND' && n === 0) { end = true; break; } }
      if (!header || !payload || !end) fail(422, 'Invalid PNG container');
    } else if (b.length >= 2 && b[0] === 255 && b[1] === 216) {
      type = 'image/jpeg'; let p = 2, frame = false, scan = false, end = false;
      while (p < b.length) { if (b[p++] !== 255) { if (scan) continue; break; } while (b[p] === 255) p++; const m = b[p++]; if (m === 217) { end = true; break; } if (scan && (m === 0 || (m >= 208 && m <= 215))) continue; if (m === 1 || (m >= 208 && m <= 215)) continue; if (p + 2 > b.length) break; const n = b[p]*256+b[p+1]; if (n < 2 || p+n > b.length) break; if ((m >= 192 && m <= 207) && ![196,200,204].includes(m) && n >= 8) frame = true; if (m === 218 && n >= 6) scan = true; p += n; }
      if (!frame || !scan || !end) fail(422, 'Invalid JPEG container');
    } else if (b.length >= 12 && str(0,4) === 'RIFF' && str(8,4) === 'WEBP') {
      type = 'image/webp'; const end = le(4)+8; let p = 12, payload = false;
      if (end !== b.length) fail(422, 'Invalid WEBP container');
      while (p+8 <= end) { const tag = str(p,4), n = le(p+4); if (n > end-p-8) fail(422, 'Invalid WEBP chunk'); if (['VP8 ', 'VP8L', 'ANMF'].includes(tag) && n >= 5) payload = true; p += 8+n+(n%2); }
      if (p !== end || !payload) fail(422, 'Invalid WEBP container');
    } else if (b.length >= 6 && (str(0,6) === 'GIF87a' || str(0,6) === 'GIF89a')) {
      type = 'image/gif'; if (b.length < 13 || !(b[6] || b[7]) || !(b[8] || b[9])) fail(422, 'Invalid GIF header');
      const headerEnd = 13 + ((b[10] & 128) ? 3 * (1 << ((b[10] & 7)+1)) : 0);
      let p = headerEnd, frames = 0, trailer = false; const loops = [];
      const need = n => { if (p+n > b.length) fail(422, 'Truncated GIF'); };
      const blocks = () => { let data = 0; while (true) { need(1); const n = b[p++]; if (!n) return data; need(n); p += n; data += n; } };
      while (p < b.length) { const start = p, kind = b[p++]; if (kind === 0x3b) { trailer = true; break; }
        if (kind === 0x21) { need(1); const label = b[p++]; need(1); const n = b[p++]; need(n); const id = str(p,n); p += n; blocks(); if (label === 0xff && n === 11 && (id === 'NETSCAPE2.0' || id === 'ANIMEXTS1.0')) loops.push([start,p]); }
        else if (kind === 0x2c) { need(9); const packed = b[p+8]; if (!(b[p+4] || b[p+5]) || !(b[p+6] || b[p+7])) fail(422, 'Invalid GIF dimensions'); p += 9; if (packed & 128) { const n = 3 * (1 << ((packed & 7)+1)); need(n); p += n; } need(1); p++; if (!blocks()) fail(422, 'Empty GIF image'); frames++; }
        else fail(422, 'Invalid GIF block');
      }
      if (!trailer || !frames) fail(422, 'Incomplete GIF');
      if (frames > 1) { const ext = Uint8Array.from([33,255,11,...Array.from('NETSCAPE2.0', c => c.charCodeAt(0)),3,1,0,0,0]); const parts = [b.subarray(0,headerEnd), ext]; let pos = headerEnd; for (const [a,z] of loops) { parts.push(b.subarray(pos,a)); pos=z; } parts.push(b.subarray(pos)); out = new Uint8Array(parts.reduce((n,x)=>n+x.length,0)); let offset=0; for (const x of parts) { out.set(x,offset); offset+=x.length; } out[4]=57; }
    } else fail(415, 'Unsupported image type');
    if (mediaType !== undefined && mediaType !== type) fail(415, 'Image type does not match content');
    return { bytes: out, mediaType: type };
  }
  return { normalize };
});
