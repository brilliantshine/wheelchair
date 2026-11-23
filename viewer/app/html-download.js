'use strict';

const prefix = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'">`;
function htmlDownload(input) {
  let html = Buffer.isBuffer(input) ? input.toString('utf8') : String(input);
  html = html.replace(/<meta\b[^>]*>/gi, (tag) => /\bhttp-equiv\s*=\s*(?:"\s*refresh\s*"|'\s*refresh\s*'|refresh(?=\s|\/?>))/i.test(tag) ? '' : tag);
  const leading = html.match(/^(?:\uFEFF|\s|<!--[\s\S]*?-->)*<!doctype\b[^>]*>/i);
  const at = leading ? leading[0].length : 0;
  return Buffer.from(html.slice(0, at) + prefix + html.slice(at), 'utf8');
}
module.exports = { htmlDownload };
