(function () {
  'use strict';
  // The thread list (grouped by project), shared by the Threads page and the thread page.
  // `?new=1` is the old way into the New thread form and now goes to its own screen.
  const API = '/wheelchair/api';
  const listEl = document.getElementById('list');
  const emptyEl = document.getElementById('empty');
  const errorEl = document.getElementById('list-error');
  const archivedBox = document.getElementById('show-archived');
  const currentId = new URLSearchParams(location.search).get('id') || '';
  const STAGE = {
    idea: 'Idea', planning: 'Planning', review: 'Review', building: 'Building', verifying: 'Verifying', done: 'Done',
  };
  const PROVIDER_LABEL = { claude: 'Claude', gpt: 'GPT' };
  let threads = [];
  let titles = {};
  let stages = {};   // thread id -> stage label, from the features data
  let waiting = {};  // thread id -> number of open cards that need you

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function base(p) { return String(p || '').split('/').filter(Boolean).pop() || String(p || ''); }
  function ago(iso) {
    const t = Date.parse(iso);
    if (!isFinite(t)) return '';
    const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }
  // Your last message in the thread; agent activity does not move it. Older threads fall back to creation.
  function stamp(t) { return Date.parse(t.collin_at || t.created_at) || 0; }
  function nameOf(t) { return t.title || t.slug || base(t.project); }

  function row(t) {
    const li = el('li', 'row' + (t.id === currentId ? ' current' : ''));
    li.dataset.id = t.id;
    const a = el('a', 'row-link');
    a.href = '/wheelchair/app/thread?id=' + encodeURIComponent(t.id);
    if (t.id === currentId) a.setAttribute('aria-current', 'page');
    const top = el('div', 'top');
    const stage = stages[t.id];
    const working = !t.archived && (t.sessions || []).some((s) => s.role === 'lead' && s.live && s.ready && s.turn_ended === false);
    const dot = el('span', 'dotmark ' + (waiting[t.id] ? 'amber' : stage === 'Done' ? 'green' : stage ? 'blue' : '') + (working ? ' working' : ''));
    if (working) dot.title = 'Working';
    top.appendChild(dot);
    top.appendChild(el('span', 'title', nameOf(t)));
    // A stub is only a stub until it is opened: once a lead runs in it, it is ordinary work.
    if (t.stub && !(t.sessions || []).length) {
      top.appendChild(el('span', 'badge', 'stub'));
      if (t.ready) top.appendChild(el('span', 'badge good', 'ready'));
      else if (t.depends_on_parent) {
        top.appendChild(el('span', 'badge warn', 'waiting for ' + (titles[t.parent] || t.parent_title || t.parent)));
      }
    }
    if (t.archived) top.appendChild(el('span', 'badge', 'archived'));
    a.appendChild(top);
    a.appendChild(el('div', 'sub', [
      stage, waiting[t.id] ? 'needs you' : '', PROVIDER_LABEL[t.provider] || t.cli, t.machine, ago(t.collin_at || t.created_at),
    ].filter(Boolean).join(' · ')));
    li.appendChild(a);
    return li;
  }

  function render() {
    const shown = threads.filter((t) => archivedBox.checked || !t.archived)
      .sort((a, b) => stamp(b) - stamp(a));
    listEl.textContent = '';
    emptyEl.hidden = shown.length > 0;
    // Groups by project, the project you last wrote in first; most recently written-in first inside each.
    const groups = new Map();
    for (const t of shown) {
      const key = base(t.project);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    }
    for (const [name, members] of groups) {
      listEl.appendChild(el('li', 'group-label', name));
      for (const t of members) listEl.appendChild(row(t));
    }
  }

  async function poll() {
    try {
      const res = await fetch(API + '/threads');
      if (!res.ok) throw new Error('http ' + res.status);
      threads = (await res.json()).threads || [];
      const features = await fetch(API + '/features').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
      stages = {}; waiting = {};
      for (const key of Object.keys(STAGE)) for (const f of features[key] || []) stages[f.id] = STAGE[key];
      for (const n of features.needs || []) waiting[n.thread_id] = (waiting[n.thread_id] || 0) + 1;
      titles = {};
      for (const t of threads) titles[t.id] = nameOf(t);
      errorEl.hidden = true;
      render();
    } catch (e) {
      errorEl.hidden = false;
      errorEl.textContent = 'Could not refresh threads.';
    }
  }

  archivedBox.addEventListener('change', render);
  if (new URLSearchParams(location.search).get('new')) location.replace('/wheelchair/app/new');

  poll();
  setInterval(poll, 5000);
})();
