'use strict';
(() => {
  const palette = window.wcThemePalette, key = 'wc-theme-v1', endpoint = '/wheelchair/api/settings/theme';
  const media = window.matchMedia('(prefers-color-scheme: light)');
  const listeners = new Set();
  let metadata = null, acceptedRevision = -1, ready = false, error = '', owner = null, draft = null, painted = '', inflight = null;
  const valid = value => value && typeof value === 'object' && !Array.isArray(value) && ['dark','light','system'].includes(value.mode) && palette.PRESETS.some(p => p.id === value.preset) && (value.accent === null || (typeof value.accent === 'string' && /^#[0-9a-f]{6}$/.test(value.accent))) && Number.isSafeInteger(value.revision) && value.revision >= 0;
  const state = () => ({ metadata: metadata && { ...metadata }, ready, error });
  const notify = () => listeners.forEach(fn => fn(state()));
  function apply(value) {
    if (!value) return;
    const resolved = palette.resolveTheme(value, media.matches), signature = JSON.stringify([resolved.resolvedMode, resolved.preset, resolved.vars]);
    if (signature === painted) return;
    painted = signature;
    const root = document.documentElement;
    for (const [name, val] of Object.entries(resolved.vars)) root.style.setProperty(name, val);
    root.dataset.themeMode = resolved.resolvedMode; root.dataset.themePreset = resolved.preset; root.style.colorScheme = resolved.resolvedMode;
    window.dispatchEvent(new CustomEvent('wc-theme-change', { detail: resolved }));
  }
  function acceptMetadata(next, source) {
    if (!valid(next) || next.revision < acceptedRevision) return;
    if (next.revision === acceptedRevision && metadata && ['mode','preset','accent'].every(k => next[k] === metadata[k])) return;
    metadata = { mode: next.mode, preset: next.preset, accent: next.accent, revision: next.revision }; acceptedRevision = metadata.revision;
    if (source !== 'storage') { try { localStorage.setItem(key, JSON.stringify(metadata)); } catch {} }
    if (!owner) apply(metadata); notify();
  }
  try { const cached = JSON.parse(localStorage.getItem(key)); if (valid(cached)) acceptMetadata(cached, 'storage'); } catch {}
  async function refresh() {
    if (inflight) return inflight;
    inflight = (async () => {
      try { const response = await fetch(endpoint, { credentials: 'same-origin', cache: 'no-store' }); if (!response.ok) throw new Error('Could not load theme settings'); const value = await response.json(); if (!valid(value)) throw new Error('Could not load theme settings'); error = ''; acceptMetadata(value, 'get'); }
      catch (_) { error = 'Could not load theme settings'; }
      finally { ready = true; inflight = null; notify(); }
    })();
    return inflight;
  }
  window.wcTheme = { current: state, subscribe(fn) { listeners.add(fn); fn(state()); return () => listeners.delete(fn); }, acquire() { owner = {}; draft = null; return owner; }, preview(token, value) { if (token !== owner || !owner) return; draft = value; apply(draft); }, release(token) { if (token !== owner || !owner) return; owner = null; draft = null; apply(metadata); }, refresh, applySaved(value) { acceptMetadata(value, 'save'); } };
  media.addEventListener('change', () => { const active = owner ? draft : metadata; if (active?.mode === 'system') apply(active); });
  window.addEventListener('storage', event => { if (event.key === key) { try { acceptMetadata(JSON.parse(event.newValue), 'storage'); } catch {} } });
  window.addEventListener('focus', refresh); window.addEventListener('pageshow', refresh);
  // Deferred navigation scripts install the shared poller before DOMContentLoaded.
  function startPolling() {
    if (window.wcPoller) window.wcPoller(refresh, 10000);
    else {
      setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 10000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startPolling, { once: true });
  else startPolling();
  refresh();
})();
