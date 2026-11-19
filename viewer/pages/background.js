'use strict';
// Shared appearance controller. ready resolves after the first metadata attempt; subscribe
// observes {metadata, ready}; acquire/publish/release use an opaque, exclusive preview token.
(() => {
  if (window.self !== window.top) return;
  const endpoint = '/wheelchair/api/settings/background';
  let metadata = null, displayed = null, owner = null, layer = null;
  let inflight = null, timer = null, serial = 0, disposed = false, loading = false, loadingUrl = null;
  const listeners = new Set();
  const notify = () => listeners.forEach(fn => fn({ metadata, ready: !loading }));
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
      const timeout = setTimeout(() => { image.src = ''; reject(new Error('Image timed out')); }, 60000);
      image.onload = () => { clearTimeout(timeout); resolve(image); };
      image.onerror = () => { clearTimeout(timeout); reject(new Error('Could not load image')); };
      image.src = url;
    });
  }
  async function accept(next) {
    if (!next || !Number.isSafeInteger(next.revision) || (metadata && next.revision < metadata.revision)) return;
    metadata = next;
    if (loading && loadingUrl === next.image_url && !next.missing_image) { notify(); return; }
    const ticket = ++serial;
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
    } catch (_) { /* retain the last successfully displayed image and retry on refresh */ }
    finally { if (ticket === serial) { loading = false; loadingUrl = null; notify(); } }
  }
  function schedule() {
    clearTimeout(timer);
    if (!disposed && !document.hidden) timer = setTimeout(refresh, 10000);
  }
  async function refresh() {
    if (disposed || document.hidden || inflight) return inflight;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    inflight = (async () => {
      try {
        const response = await fetch(endpoint, { signal: controller.signal });
        if (response.ok) { const value = await response.json(); if (!controller.signal.aborted && !disposed) void accept(value); }
      } catch (_) { /* appearance must never block the page */ }
      finally { clearTimeout(timeout); inflight = null; schedule(); }
    })();
    return inflight;
  }
  const controller = {
    ready: null,
    subscribe(fn) { listeners.add(fn); fn({ metadata, ready: !loading }); return () => listeners.delete(fn); },
    current() { return { metadata, ready: !loading }; },
    acquire() { owner = {}; return owner; },
    publish(token, image, opacity) { if (owner === token) paint(image, opacity); },
    release(token) { if (owner !== token) return; owner = null; restore(); },
    publishSaved(token, opacity) { if (owner === token) paint(displayed?.image || null, opacity); },
    accept, refresh,
  };
  window.wcBackground = controller;
  controller.ready = refresh();
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else refresh(); });
  window.addEventListener('focus', refresh);
  window.addEventListener('pageshow', event => { if (event.persisted) { owner = null; restore(); window.dispatchEvent(new Event('backgroundrestore')); } refresh(); });
  window.addEventListener('pagehide', event => { clearTimeout(timer); if (!event.persisted) { disposed = true; serial++; owner = null; layer?.remove(); } });
})();
