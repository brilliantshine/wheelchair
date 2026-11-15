(function () {
  'use strict';
  // The app's plan document page: one of a thread's MAP.md, IDEA.md or PLAN.md, rendered in
  // the app. A live thread's file is read through the plan viewer's /doc route; an archived
  // thread's from its branch through the hub.
  const API = '/wheelchair/api';
  const FILES = ['MAP.md', 'IDEA.md', 'PLAN.md'];
  const params = new URLSearchParams(location.search);
  const id = params.get('thread') || '';
  const file = params.get('file') || '';

  const $ = (x) => document.getElementById(x);
  const messageEl = $('message'); const contentEl = $('content');
  $('doc-name').textContent = file;
  if (id) $('back').href = '/wheelchair/app/thread?id=' + encodeURIComponent(id);
  document.title = (file || 'Plan document') + ' · wheelchair';

  function say(text) {
    contentEl.textContent = '';
    messageEl.hidden = false;
    messageEl.textContent = text;
  }

  // Where a link in the document goes: MAP.md, IDEA.md and PLAN.md of this thread stay in the
  // app; any other relative link is plain text; http(s) opens in a new tab; other schemes are dead.
  function resolveLink(href) {
    if (!href) return null;
    if (/^https?:\/\//i.test(href)) return { href: href, external: true, newTab: true };
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href) || href.charAt(0) === '/') return null;
    const hash = href.indexOf('#');
    const clean = hash === -1 ? href : href.slice(0, hash);
    if (!clean) return null;
    const stack = [];
    for (const part of clean.split('/')) {
      if (part === '' || part === '.') continue;
      if (part === '..') { if (!stack.length) return null; stack.pop(); } else stack.push(part);
    }
    const name = stack.join('/');
    if (!FILES.includes(name)) return null;
    return { href: '/wheelchair/app/doc?thread=' + encodeURIComponent(id) + '&file=' + name, external: false };
  }

  async function load() {
    if (!id) return say('No thread was given.');
    if (!FILES.includes(file)) return say('“' + file + '” is not one of MAP.md, IDEA.md or PLAN.md.');
    const missing = 'No ' + file + ' in this thread yet';
    let thread;
    try {
      const res = await fetch(API + '/threads/' + encodeURIComponent(id) + '/chat');
      if (!res.ok) return say(res.status === 404 ? 'This thread was not found.' : 'Could not load this thread (status ' + res.status + ').');
      thread = (await res.json()).thread;
    } catch (e) { return say('Could not load this thread.'); }

    let raw;
    try {
      let res;
      if (thread.archived) {
        if (!thread.slug) return say(missing);
        res = await fetch(API + '/threads/' + encodeURIComponent(id) + '/doc?file=' + encodeURIComponent(file));
      } else {
        if (!thread.slug || !thread.worktree) return say(missing);
        const plan = thread.worktree + '/docs/plans/' + thread.slug;
        res = await fetch('/wheelchair/doc?plan=' + encodeURIComponent(plan) + '&file=' + encodeURIComponent(file));
      }
      if (res.status === 404 || res.status === 403) return say(missing);
      if (!res.ok) return say('Could not load ' + file + ' (status ' + res.status + ').');
      raw = thread.archived ? (await res.json()).content : await res.text();
    } catch (e) { return say('Could not load ' + file + '.'); }

    messageEl.hidden = true;
    contentEl.textContent = '';
    contentEl.appendChild(window.renderMarkdown(String(raw), resolveLink));
  }
  load();
})();
