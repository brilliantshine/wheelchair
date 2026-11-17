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
      const g = document.createElement('optgroup');
      g.label = label;
      for (const i of items) {
        if (seen.has(i.path)) continue;
        seen.add(i.path);
        g.appendChild(option(i.path, i.label));
      }
      if (g.children.length) projectEl.appendChild(g);
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
    if (!state || state.machine !== machineEl.value) return;
    clearErrors();
    try {
      await call('/settings/saved-dirs/' + encodeURIComponent(name) + '?machine=' + encodeURIComponent(state.machine),
        { method: 'DELETE' });
      await load(projectEl.value);
    } catch (e) {
      const li = [...$('saved-list').children].find((n) => n.dataset.name === name);
      if (!li) return;
      const line = el('div', 'row-error', 'Could not remove ' + name + ': ' + e.message);
      line.setAttribute('role', 'alert');
      li.appendChild(line);
    }
  }

  function clearErrors() {
    show($('add-error'), '');
    for (const n of $('saved-list').querySelectorAll('.row-error')) n.remove();
  }

  machineEl.addEventListener('change', () => {
    clearErrors();
    state = state && { ...state, machine: null };
    projectEl.textContent = '';
    $('saved-list').textContent = '';
    $('saved-empty').hidden = true;
    if (state) syncProject(0);
    else { projectEl.disabled = true; goEl.disabled = true; }
    load('');
  });
  projectEl.addEventListener('change', () => syncProject(projectEl.options.length));

  $('add-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!state || state.machine !== machineEl.value) return;
    const name = $('add-name').value.trim();
    const path = $('add-path').value.trim();
    const go = $('add-go');
    clearErrors();
    go.disabled = true;
    try {
      const res = await call('/settings/saved-dirs', json('POST', { name, path, machine: state.machine }));
      const added = (res.saved || []).find((s) => s.name === name);
      $('add-name').value = ''; $('add-path').value = '';
      await load(added ? added.path : '');
    } catch (e) { show($('add-error'), e.message); }
    go.disabled = false;
  });

  // Attachments, as in the thread composer: picked, pasted or dropped, at most 25 MB each.
  let attachments = [];
  let sending = false;
  const chips = $('attachments');
  function renderAttachments() {
    chips.textContent = '';
    attachments.forEach((file, i) => {
      const chip = el('span', 'attachment-chip');
      if (/^image\/(png|jpeg|gif|webp)$/.test(file.type)) {
        // A data: URL, since the page's content policy allows data: images and not blob: ones.
        const img = el('img', 'attachment-thumb'); img.alt = ''; chip.appendChild(img);
        const reader = new FileReader(); reader.onload = () => { img.src = reader.result; }; reader.readAsDataURL(file);
      }
      const size = file.size < 1024 ? file.size + ' B' : file.size < 1048576 ? (file.size / 1024).toFixed(1) + ' KB' : (file.size / 1048576).toFixed(1) + ' MB';
      chip.appendChild(el('span', '', file.name + ' · ' + size));
      const remove = el('button', 'attachment-remove', '×');
      remove.type = 'button'; remove.disabled = sending;
      remove.setAttribute('aria-label', 'Remove ' + file.name);
      remove.addEventListener('click', () => { if (sending) return; attachments.splice(i, 1); renderAttachments(); });
      chip.appendChild(remove); chips.appendChild(chip);
    });
  }
  function addFiles(files, pasted) {
    if (sending) return;
    const errors = [];
    for (let file of files) {
      if (pasted && file.type.startsWith('image/') && (!file.name || /^image\.[a-z0-9]+$/i.test(file.name))) {
        const d = new Date(); const pad = (n) => String(n).padStart(2, '0');
        const stamp = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
        const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' })[file.type] || file.type.slice(6).replace(/[^a-z0-9]/gi, '') || 'bin';
        file = new File([file], 'pasted-' + stamp + '.' + ext, { type: file.type });
      }
      if (file.size > 25 * 1024 * 1024) errors.push(file.name + ' is over 25 MB'); else attachments.push(file);
    }
    $('attachment-error').textContent = errors.join(' · '); renderAttachments();
  }
  const fileInput = $('attachment-input');
  const messageEl = $('nt-message');
  $('nt-attach').addEventListener('click', () => { if (!sending) fileInput.click(); });
  fileInput.addEventListener('change', () => { addFiles(fileInput.files, false); fileInput.value = ''; });
  messageEl.addEventListener('paste', (ev) => { if (ev.clipboardData && ev.clipboardData.files.length) { ev.preventDefault(); addFiles(ev.clipboardData.files, true); } });
  messageEl.addEventListener('dragover', (ev) => { if (ev.dataTransfer.types.includes('Files')) ev.preventDefault(); });
  messageEl.addEventListener('drop', (ev) => { if (ev.dataTransfer.files.length) { ev.preventDefault(); addFiles(ev.dataTransfer.files, false); } });

  // Uploads need the thread's id, so with attachments the thread starts first (named from the
  // message), the files go up, and the message carrying their paths follows.
  async function sendFirst(id, message, files) {
    const T = API + '/threads/' + encodeURIComponent(id);
    const paths = [];
    for (const file of files) {
      const res = await fetch(T + '/uploads?name=' + encodeURIComponent(file.name), { method: 'POST', headers: { 'content-type': file.type || 'application/octet-stream' }, body: file });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error('could not upload ' + file.name + ': ' + (out.detail || out.error || 'http ' + res.status));
      paths.push(out.path);
    }
    const text = [message, paths.map((path) => '[attached: ' + path + ']').join('\n')].filter(Boolean).join('\n\n');
    await call('/threads/' + encodeURIComponent(id) + '/messages', json('POST', { text }));
  }

  function setSending(on) {
    sending = on;
    $('nt-attach').disabled = on;
    renderAttachments();
  }

  $('new-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (goEl.disabled || sending) return;
    if (!state || state.machine !== machineEl.value) return;
    const body = { project: projectEl.value, machine: state.machine };
    const message = messageEl.value.trim();
    const files = attachments.slice();
    if (message && !files.length) body.message = message;
    if (message && files.length) body.title = message;
    goEl.disabled = true; setSending(true);
    let data;
    try {
      data = await call('/threads', json('POST', body));
    } catch (e) {
      show($('form-error'), 'Could not start the thread: ' + e.message);
      goEl.disabled = false; setSending(false);
      return;
    }
    const where = '/wheelchair/app/thread?id=' + encodeURIComponent(data.id);
    if (files.length) {
      try { await sendFirst(data.id, message, files); } catch (e) {
        // The thread exists, so Start stays off: pressing it again would start a second one.
        const banner = $('form-error');
        banner.textContent = 'The thread started, but the first message was not sent (' + e.message + '). ';
        const link = el('a', '', 'Open the thread'); link.href = where;
        banner.appendChild(link); banner.hidden = false;
        return;
      }
    }
    location.href = where;
  });

  load('');
})();
