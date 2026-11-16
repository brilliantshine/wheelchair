(function () {
  'use strict';

  // ---- URL / params ---------------------------------------------------------

  const params = new URLSearchParams(location.search);
  const planDir = params.get('plan') || '';
  const requestedFile = params.get('file') || '';

  // Every URL below lives under /wheelchair and carries no token — the cookie set on the
  // first-visit redirect authenticates every request from here on.
  function listUrl() {
    return '/wheelchair/app/threads';
  }

  function docHref(file) {
    return '/wheelchair/docs?plan=' + encodeURIComponent(planDir) + '&file=' + encodeURIComponent(file);
  }

  function docFetchUrl(file) {
    return '/wheelchair/doc?plan=' + encodeURIComponent(planDir) + '&file=' + encodeURIComponent(file);
  }

  function planFetchUrl() {
    return '/wheelchair/plan?dir=' + encodeURIComponent(planDir);
  }

  // ---- DOM handles ------------------------------------------------------------

  const backLink = document.getElementById('back-link');
  const titleEl = document.getElementById('doc-title');
  const fileListEl = document.getElementById('file-list');
  const errorBanner = document.getElementById('error-banner');
  const contentEl = document.getElementById('content');

  backLink.href = listUrl();

  function el(tag, attrs) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const key in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, key)) continue;
        if (key === 'class') node.className = attrs[key];
        else if (key === 'text') node.textContent = attrs[key];
        else node.setAttribute(key, attrs[key]);
      }
    }
    return node;
  }

  function showError(msg) {
    errorBanner.hidden = false;
    errorBanner.textContent = msg;
  }

  function clearError() {
    errorBanner.hidden = true;
    errorBanner.textContent = '';
  }

  // ---- link resolution ---------------------------------------------------------

  function dirname(file) {
    const idx = file.lastIndexOf('/');
    return idx === -1 ? '' : file.slice(0, idx);
  }

  function resolveRelativePath(baseDir, target) {
    const stack = baseDir === '' ? [] : baseDir.split('/');
    const parts = target.split('/');
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === '' || part === '.') continue;
      if (part === '..') {
        if (stack.length === 0) return null;
        stack.pop();
      } else {
        stack.push(part);
      }
    }
    return stack.join('/');
  }

  function resolveLink(href, currentFile) {
    if (!href) return null;
    if (/^https?:\/\//i.test(href)) return { href: href, external: true };
    // Any other URL scheme (javascript:, data:, mailto:, ...) is never a live link.
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) return null;
    if (href.charAt(0) === '/') return null; // not a relative path within the plan

    const hashIdx = href.indexOf('#');
    const clean = hashIdx === -1 ? href : href.slice(0, hashIdx);
    if (!clean) return null;

    const baseDir = dirname(currentFile);
    const resolved = resolveRelativePath(baseDir, clean);
    if (resolved === null || !resolved.endsWith('.md')) return null;

    return {
      href: docHref(resolved),
      external: false
    };
  }

  // ---- file list / navigation ---------------------------------------------------

  function pickDefaultFile(files) {
    if (files.indexOf('PLAN.md') !== -1) return 'PLAN.md';
    if (files.indexOf('IDEA.md') !== -1) return 'IDEA.md';
    if (files.length) return files[0]; // already byte-ordered by the server
    return null;
  }

  function renderFileList(files, current) {
    fileListEl.textContent = '';
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const li = document.createElement('li');
      const a = el('a', { href: docHref(f), text: f });
      if (f === current) a.className = 'current';
      li.appendChild(a);
      fileListEl.appendChild(li);
    }
  }

  // ---- loading ---------------------------------------------------------------

  function renderDoc(raw, file) {
    contentEl.textContent = '';
    contentEl.appendChild(window.renderMarkdown(raw, function (href) { return resolveLink(href, file); }));
  }

  async function loadDoc(file) {
    clearError();
    contentEl.textContent = '';
    try {
      const res = await fetch(docFetchUrl(file));
      if (res.status === 404) {
        contentEl.appendChild(el('p', { text: 'not found' }));
        return;
      }
      if (!res.ok) {
        showError('Could not load this document (status ' + res.status + ').');
        return;
      }
      const text = await res.text();
      renderDoc(text, file);
    } catch (err) {
      showError('Could not load this document.');
    }
  }

  async function loadPlan() {
    let planData;
    try {
      const res = await fetch(planFetchUrl());
      if (!res.ok) {
        showError('Could not load this plan (status ' + res.status + ').');
        return;
      }
      planData = await res.json();
    } catch (err) {
      showError('Could not load this plan.');
      return;
    }

    const files = (planData && planData.files) || [];
    titleEl.textContent = (planData && planData.slug) || planDir;

    if (!files.length) {
      renderFileList(files, null);
      contentEl.textContent = '';
      contentEl.appendChild(el('p', { id: 'empty-doc', text: 'no documents' }));
      return;
    }

    const file = requestedFile || pickDefaultFile(files);
    renderFileList(files, file);
    if (file) await loadDoc(file);
  }

  loadPlan();
})();
