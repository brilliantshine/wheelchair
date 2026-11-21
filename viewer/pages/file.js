(function () {
  'use strict';
  // The app's sent-file preview page, at ?thread=<id>&file=<stored name>: Markdown rendered, other
  // text shown as plain text. Also loadable on its own as window.WCFilePreview, which the thread
  // page asks "is this sent file previewable?"; the page code below runs only on the preview page.
  const API = '/wheelchair/api';
  const MAX = 2 * 1024 * 1024;
  const EXT = /\.(md|markdown|txt|log|csv|tsv|json|ya?ml|xml|ini|toml)$/i;
  const MARKDOWN = /\.(md|markdown)$/i;
  const previewable = (name, size) => EXT.test(String(name || '')) && Number.isFinite(Number(size)) && Number(size) >= 0 && Number(size) <= MAX;
  window.WCFilePreview = { previewable, MAX, href: (id, stored) => '/wheelchair/app/file?thread=' + encodeURIComponent(id) + '&file=' + encodeURIComponent(stored) };

  const $ = (x) => document.getElementById(x);
  const contentEl = $('content');
  if (!contentEl) return;
  const params = new URLSearchParams(location.search);
  const id = params.get('thread') || '';
  const file = params.get('file') || '';
  const name = file.replace(/^\d+-/, '');
  const messageEl = $('message'); const textEl = $('file-text');
  $('file-name').textContent = name;
  document.title = (name || 'File') + ' · wheelchair';
  if (id) $('back').href = '/wheelchair/app/thread?id=' + encodeURIComponent(id);
  const url = API + '/threads/' + encodeURIComponent(id) + '/files/' + encodeURIComponent(file);
  const dl = $('file-download');
  const valid = !!id && /^[0-9]+-[A-Za-z0-9._-]+$/.test(file);
  if (valid) { dl.href = url; dl.setAttribute('download', name); dl.hidden = false; }

  function say(text) { contentEl.textContent = ''; textEl.hidden = true; messageEl.hidden = false; messageEl.textContent = text; }
  function resolveLink(href) { return /^https?:\/\//i.test(href || '') ? { href, external: true, newTab: true } : null; }

  async function load() {
    if (!id) return say('No thread was given.');
    if (!valid) return say('No file was given.');
    if (!EXT.test(name)) return say('This kind of file cannot be previewed. Use Download.');
    let res;
    try { res = await fetch(url); } catch (e) { return say('Could not load this file.'); }
    if (res.status === 404) return say('This file was not found. It may have been removed.');
    if (!res.ok) return say('Could not load this file (status ' + res.status + ').');
    const length = Number(res.headers.get('content-length'));
    if (length > MAX) { try { res.body && res.body.cancel(); } catch (e) { /* closing the stream is best effort */ } return say('Too big to preview. Use Download.'); }
    let bytes;
    try { bytes = await res.arrayBuffer(); } catch (e) { return say('Could not load this file.'); }
    if (bytes.byteLength > MAX) return say('Too big to preview. Use Download.');
    const text = new TextDecoder('utf-8').decode(bytes);
    messageEl.hidden = true;
    if (MARKDOWN.test(name)) {
      textEl.hidden = true; contentEl.textContent = '';
      contentEl.appendChild(window.renderMarkdown(text, resolveLink));
    } else {
      contentEl.textContent = '';
      textEl.hidden = false; textEl.textContent = text;
    }
  }
  load();
})();
