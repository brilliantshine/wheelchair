(function () {
  'use strict';
  const API = '/wheelchair/api';
  const listEl = document.getElementById('list');
  const emptyEl = document.getElementById('empty');
  const errorEl = document.getElementById('error');
  const archivedBox = document.getElementById('show-archived');
  const form = document.getElementById('new-form');
  let threads = [];
  let titles = {};
  let known = [];

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
  function stamp(t) { return Date.parse(t.updated_at || t.created_at) || 0; }
  function nameOf(t) { return t.title || t.slug || base(t.project); }

  function render() {
    const shown = threads.filter((t) => archivedBox.checked || !t.archived)
      .sort((a, b) => stamp(b) - stamp(a));
    listEl.textContent = '';
    emptyEl.hidden = shown.length > 0;
    for (const t of shown) {
      const li = el('li', 'card');
      li.dataset.id = t.id;
      const a = el('a', 'row-link');
      a.href = '/wheelchair/app/thread?id=' + encodeURIComponent(t.id);
      const top = el('div', 'top');
      top.appendChild(el('span', 'title', nameOf(t)));
      if (t.stub) {
        top.appendChild(el('span', 'badge', 'stub'));
        if (t.ready) top.appendChild(el('span', 'badge good', 'ready'));
        else if (t.depends_on_parent && !t.ready && !(t.sessions || []).length) {
          top.appendChild(el('span', 'badge warn', 'waiting for ' + (titles[t.parent] || t.parent_title || t.parent)));
        }
      }
      if (t.archived) top.appendChild(el('span', 'badge', 'archived'));
      a.appendChild(top);
      a.appendChild(el('div', 'sub',
        [base(t.project), t.cli, t.machine, ago(t.updated_at || t.created_at)].filter(Boolean).join(' · ')));
      li.appendChild(a);
      listEl.appendChild(li);
    }
  }

  function fillDatalists() {
    const projects = new Set(known); const machines = new Set(['hub']);
    for (const t of threads) { projects.add(t.project); machines.add(t.machine); }
    const fill = (id, set) => {
      const dl = document.getElementById(id); dl.textContent = '';
      for (const v of set) { const o = document.createElement('option'); o.value = v; dl.appendChild(o); }
    };
    fill('nt-projects', projects); fill('nt-machines', machines);
  }

  async function poll() {
    try {
      const res = await fetch(API + '/threads');
      if (!res.ok) throw new Error('http ' + res.status);
      threads = (await res.json()).threads || [];
      // projects.json: the repos the app lists; the field stays free text.
      const listed = await fetch(API + '/projects').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
      known = listed.projects || [];
      titles = {};
      for (const t of threads) titles[t.id] = nameOf(t);
      errorEl.hidden = true;
      render(); fillDatalists();
    } catch (e) {
      errorEl.hidden = false;
      errorEl.textContent = 'Could not refresh threads.';
    }
  }

  archivedBox.addEventListener('change', render);
  document.getElementById('new-toggle').addEventListener('click', () => { form.hidden = !form.hidden; });
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const body = {
      project: document.getElementById('nt-project').value.trim(),
      cli: document.getElementById('nt-cli').value,
      machine: document.getElementById('nt-machine').value.trim() || 'hub',
    };
    const message = document.getElementById('nt-message').value.trim();
    if (message) body.message = message;
    const go = document.getElementById('nt-go');
    go.disabled = true;
    try {
      const res = await fetch(API + '/threads', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.error || 'http ' + res.status);
      location.href = '/wheelchair/app/thread?id=' + encodeURIComponent(data.id);
    } catch (e) {
      errorEl.hidden = false;
      errorEl.textContent = 'Could not start the thread: ' + e.message;
      go.disabled = false;
    }
  });

  poll();
  setInterval(poll, 5000);
})();
