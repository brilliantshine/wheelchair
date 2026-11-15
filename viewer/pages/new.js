(function () {
  'use strict';
  // The New thread screen: pick a machine and a project, start a thread, and keep the saved
  // directories for that machine. Everything comes from GET /new-thread?machine= (viewer/app/API.md).
  const API = '/wheelchair/api';
  const $ = (id) => document.getElementById(id);
  const machineEl = $('nt-machine');
  const projectEl = $('nt-project');
  const goEl = $('nt-go');
  let state = null;       // the last /new-thread answer
  let loadSeq = 0;

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function base(p) { return String(p || '').split('/').filter(Boolean).pop() || String(p || ''); }
  function show(node, text) { node.hidden = !text; node.textContent = text || ''; }

  async function call(route, init) {
    const res = await fetch(API + route, init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || data.error || data.message || 'http ' + res.status);
    return data;
  }
  const json = (method, body) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  function option(path, label) {
    const o = el('option', '', label);
    o.value = path;
    return o;
  }

  // Saved, then found in the default folder, then used before; each path once.
  function fillProjects(keep) {
    projectEl.textContent = '';
    const seen = new Set();
    const group = (label, items) => {
      const fresh = items.filter((i) => !seen.has(i.path));
      if (!fresh.length) return;
      const g = document.createElement('optgroup');
      g.label = label;
      for (const i of fresh) { seen.add(i.path); g.appendChild(option(i.path, i.label)); }
      projectEl.appendChild(g);
    };
    group('Saved', state.saved.map((s) => ({ path: s.path, label: s.name })));
    group('In ' + state.default_folder, state.found.map((f) => ({ path: f.path, label: f.name })));
    const prev = state.previous.filter((p) => !seen.has(p));
    const clash = (p) => prev.filter((q) => base(q) === base(p)).length > 1;
    group('Used before', prev.map((p) => ({ path: p, label: clash(p) ? p : base(p) })));
    if (keep && seen.has(keep)) projectEl.value = keep;
    else if (seen.size) projectEl.selectedIndex = 0;
    syncProject(seen.size);
  }

  function syncProject(count) {
    const empty = count === 0;
    projectEl.disabled = empty;
    goEl.disabled = empty;
    $('nt-empty').hidden = !empty;
    const path = empty ? '' : projectEl.value;
    show($('nt-path'), path);
    show($('nt-note'), state.default_folder ? 'Only git repositories in ' + state.default_folder + ' are listed.' : '');
    show($('nt-found-error'), state.found_error || '');
    $('nt-no-folder').hidden = !!state.default_folder;
  }

  function fillSaved() {
    const list = $('saved-list');
    list.textContent = '';
    $('saved-empty').hidden = state.saved.length > 0;
    for (const s of state.saved) {
      const li = el('li');
      li.dataset.name = s.name;
      const what = el('div', 'what');
      what.append(el('span', '', s.name), el('span', 'p', s.path));
      const rm = el('button', '', 'Remove');
      rm.type = 'button';
      rm.setAttribute('aria-label', 'Remove ' + s.name);
      rm.addEventListener('click', () => removeSaved(s.name));
      li.append(what, rm);
      list.appendChild(li);
    }
  }

  function fillMachines() {
    const current = state.machine;
    machineEl.textContent = '';
    for (const m of state.machines) machineEl.appendChild(option(m, m));
    machineEl.value = current;
  }

  async function load(keep) {
    const seq = ++loadSeq;
    const machine = machineEl.value || 'hub';
    try {
      const data = await call('/new-thread?machine=' + encodeURIComponent(machine));
      if (seq !== loadSeq) return;
      state = { saved: [], found: [], previous: [], machines: ['hub'], ...data };
      fillMachines(); fillProjects(keep); fillSaved();
      show($('form-error'), '');
    } catch (e) {
      if (seq !== loadSeq) return;
      show($('form-error'), 'Could not load this screen: ' + e.message);
    }
  }

  async function removeSaved(name) {
    show($('saved-error'), '');
    try {
      await call('/settings/saved-dirs/' + encodeURIComponent(name) + '?machine=' + encodeURIComponent(machineEl.value),
        { method: 'DELETE' });
      await load(projectEl.value);
    } catch (e) { show($('saved-error'), 'Could not remove ' + name + ': ' + e.message); }
  }

  machineEl.addEventListener('change', () => { show($('saved-error'), ''); load(''); });
  projectEl.addEventListener('change', () => syncProject(projectEl.options.length));

  $('add-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const name = $('add-name').value.trim();
    const path = $('add-path').value.trim();
    const go = $('add-go');
    show($('saved-error'), '');
    go.disabled = true;
    try {
      await call('/settings/saved-dirs', json('POST', { name, path, machine: machineEl.value }));
      const res = await call('/new-thread?machine=' + encodeURIComponent(machineEl.value));
      state = { saved: [], found: [], previous: [], machines: ['hub'], ...res };
      const added = state.saved.find((s) => s.name === name);
      fillMachines(); fillProjects(added ? added.path : ''); fillSaved();
      $('add-name').value = ''; $('add-path').value = '';
    } catch (e) { show($('saved-error'), e.message); }
    go.disabled = false;
  });

  $('new-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (goEl.disabled) return;
    const body = { project: projectEl.value, cli: $('nt-cli').value, machine: machineEl.value || 'hub' };
    const message = $('nt-message').value.trim();
    if (message) body.message = message;
    goEl.disabled = true;
    try {
      const data = await call('/threads', json('POST', body));
      location.href = '/wheelchair/app/thread?id=' + encodeURIComponent(data.id);
    } catch (e) {
      show($('form-error'), 'Could not start the thread: ' + e.message);
      goEl.disabled = false;
    }
  });

  load('');
})();
