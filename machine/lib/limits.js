'use strict';
function limitedUntil(reading, now = Date.now()) {
  const time = now instanceof Date ? now.getTime() : typeof now === 'string' ? Date.parse(now) : now;
  const windows = [reading?.five_hour, reading?.week].filter(w => w && Date.parse(w.resets_at) > time);
  const exhausted = windows.filter(w => w.used >= 95);
  const candidates = exhausted.length ? exhausted : windows;
  return new Date(candidates.length ? Math.min(...candidates.map(w => Date.parse(w.resets_at))) : time + 3600000).toISOString();
}
module.exports = { limitedUntil };
