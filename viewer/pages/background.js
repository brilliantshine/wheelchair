'use strict';
// Shared appearance controller. ready resolves after the first metadata attempt; subscribe
// observes {metadata, ready, available, error}; acquire/publish/release use an opaque, exclusive
// preview token. publishSaved uses the saved image captured when ownership was acquired.
(() => {
  if (window.self !== window.top) return;
  const endpoint = '/wheelchair/api/settings/background';
  let metadata = null, displayed = null, owner = null, layer = null;
  let inflight = null, request = null, timer = null, serial = 0, disposed = false, loading = false, loadingUrl = null, cancelLoad = null, error = '';
  const listeners = new Set();
  const state = () => ({ metadata, ready: !loading, available: !!(metadata?.image_url && !metadata.missing_image && displayed?.url === metadata.image_url), error });
  const notify = () => listeners.forEach(fn => fn(state()));
  function paint(image, opacity) {
    if (!image) {
      layer?.remove(); layer = null;
      document.documentElement.classList.remove('background-active');
      return;
    }
    if (!layer) {
      layer = document.createElement('div'); layer.className = 'background-layer';
      layer.setAttribute('aria-hidden', 'true'); document.body.prepend(layer);
    }
    if (layer.firstChild !== image) layer.replaceChildren(image);
    layer.style.opacity = String(opacity / 100);
    document.documentElement.classList.add('background-active');
  }
  function restore() { paint(displayed?.image || null, displayed?.opacity ?? 35); }
  function load(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const finish = (result) => {
        clearTimeout(timeout); image.onload = null; image.onerror = null;
        if (cancelLoad === cancel) cancelLoad = null;
        if (result) resolve(image); else { image.src = ''; reject(new Error('Could not load image')); }
      };
      const cancel = () => finish(false);
      const timeout = setTimeout(cancel, 60000);
      cancelLoad = cancel;
      image.onload = () => finish(true);
      image.onerror = cancel;
      image.src = url;
    });
  }
  async function accept(next) {
    if (!next || !Number.isSafeInteger(next.revision) || (metadata && next.revision < metadata.revision)) return;
    metadata = next;
    error = next.missing_image ? 'The saved background image is unavailable. Remove it or choose another image.' : '';
    if (loading && loadingUrl === next.image_url && !next.missing_image) { notify(); return; }
    const ticket = ++serial;
    cancelLoad?.();
    if (!next.image_url || next.missing_image) {
      loading = false; loadingUrl = null; displayed = null; if (!owner) restore(); notify(); return;
    }
    if (displayed?.url === next.image_url) {
      loading = false; loadingUrl = null; displayed.opacity = next.opacity; if (!owner) restore(); notify(); return;
    }
    loading = true; loadingUrl = next.image_url; notify();
    try {
      const image = await load(next.image_url);
      if (ticket !== serial || disposed) return;
      displayed = { image, url: next.image_url, opacity: metadata.opacity };
      if (!owner) restore();
    } catch (_) {
      if (ticket === serial && !disposed) error = 'Could not load the saved background image. It will be tried again.';
    }
    finally { if (ticket === serial) { loading = false; loadingUrl = null; notify(); } }
  }
  function schedule() {
    clearTimeout(timer);
    if (!disposed && !document.hidden) timer = setTimeout(refresh, 10000);
  }
  async function refresh() {
    if (disposed || document.hidden || inflight) return inflight;
    const controller = new AbortController(); request = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    inflight = (async () => {
      try {
        const response = await fetch(endpoint, { signal: controller.signal });
        if (!response.ok) throw new Error('Background unavailable');
        const value = await response.json(); if (!controller.signal.aborted && !disposed) void accept(value);
      } catch (_) {
        if (!disposed) { error = 'Could not load background settings. Please try again.'; notify(); }
      }
      finally { clearTimeout(timeout); request = null; inflight = null; schedule(); }
    })();
    return inflight;
  }
  const controller = {
    ready: null,
    subscribe(fn) { listeners.add(fn); fn(state()); return () => listeners.delete(fn); },
    current: state,
    acquire() { owner = { image: displayed?.image || null }; return owner; },
    publish(token, image, opacity) { if (owner === token) paint(image, opacity); },
    release(token) { if (owner !== token) return; owner = null; restore(); },
    publishSaved(token, opacity) { if (owner === token) paint(token.image, opacity); },
    accept, refresh,
  };
  window.wcBackground = controller;
  controller.ready = refresh();
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else refresh(); });
  window.addEventListener('focus', refresh);
  window.addEventListener('pageshow', () => { owner = null; restore(); window.dispatchEvent(new Event('backgroundrestore')); refresh(); });
  window.addEventListener('pagehide', event => {
    clearTimeout(timer);
    if (!event.persisted) { disposed = true; serial++; request?.abort(); cancelLoad?.(); owner = null; layer?.remove(); displayed = null; window.dispatchEvent(new Event('backgrounddispose')); }
  });
})();
