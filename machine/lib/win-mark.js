'use strict';
const WINDOWS_URL = /^http:\/\/(localhost|127\.0\.0\.1)(:(\d{1,5}))?(?=[\/?#]|$)/i;
function windowsTarget(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry) || entry.type !== 'http' || typeof entry.url !== 'string') return null;
  const match = WINDOWS_URL.exec(entry.url);
  if (!match) return null;
  const port = match[3] === undefined ? 80 : Number(match[3]);
  return port >= 1 && port <= 65535 ? { origin: match[0], port } : null;
}
function rewriteUrl(url, privatePort) {
  const target = windowsTarget({ type: 'http', url });
  return target ? 'http://127.0.0.1:' + privatePort + url.slice(target.origin.length) : null;
}
module.exports = { WINDOWS_URL, windowsTarget, rewriteUrl };
