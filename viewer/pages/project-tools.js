'use strict';

// The "Project tools" section of the Settings page. Exposes window.ProjectTools.render(container).
// It talks to the hub's /project-tools routes (docs/plans/project-tools-screen/API.md) and keeps
// no copy of its own beyond the unsaved edits. Key values are only ever sent, never shown back.
(() => {
  const API = '/wheelchair/api';
  const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const LOST = 'Save may still be finishing; reload in a minute and check Waiting to merge before saving again.';
  const HEADER_NOTE = "Codex agents don't get tools with headers. Claude may read some credential-like names as empty in headers, so check the tool signs in.";
  const RESERVED_MSG = "can't be set here: it would change how the agent itself runs";
  const KNOWN_OUTCOMES = ['saved', 'opened', 'pr_failed', 'failed', 'refused', 'removed'];
  let reservedLists = { exact: [], prefixes: [] };
  function isReservedName(name) {
    const lower = name.toLowerCase();
    return (reservedLists.exact || []).some((e) => e.toLowerCase() === lower) || (reservedLists.prefixes || []).some((p) => name.startsWith(p));
  }

  function h(tag, props, ...kids) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else if (key in node && key !== 'list') node[key] = value;
      else node.setAttribute(key, value === true ? '' : value);
    }
    for (const kid of kids.flat(Infinity)) if (kid !== undefined && kid !== null && kid !== false) node.append(kid);
    return node;
  }
  const button = (text, onclick, extra) => h('button', { type: 'button', text, onclick, ...(extra || {}) });

  function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
  }
  // Names the user chooses (tools, settings, headers, keys) can be `__proto__` or `constructor`,
  // so objects keyed by them have no prototype and are written with defineProperty.
  const nullObj = () => Object.create(null);
  const setOwn = (o, k, v) => { Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true }); return o; };
  const own = (o, k) => (o && typeof o === 'object' && Object.hasOwn(o, k) ? o[k] : undefined);
  const copyObj = (o) => { const n = nullObj(); for (const [k, v] of Object.entries(o || {})) setOwn(n, k, v); return n; };
  const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

  async function post(route, body) {
    let res;
    try {
      res = await fetch(API + route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    } catch { return { status: 0, body: null }; }
    const parsed = await res.json().catch(() => null);
    return { status: res.status, body: parsed };
  }

  // ---- reading a raw entry into what the form can show ------------------------------------

  function classifyEnv(name, value) {
    if (typeof value !== 'string') return { ro: true, name, raw: value };
    const m = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(value);
    if (m && m[1] === name && isReservedName(name)) return { ro: true, env: true, name, raw: value };
    if (m && m[1] === name) return { name, mode: 'key', value: '', secret: '' };
    if (value.includes('${')) return { ro: true, name, raw: value };
    return { name, mode: 'plain', value, secret: '' };
  }
  function classifyHeader(name, value) {
    if (typeof value !== 'string') return { ro: true, name, raw: value };
    const m = /^([^$]*)\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(value);
    if (m && isReservedName(m[2])) return { ro: true, env: true, name, raw: value };
    if (m) return { name, mode: 'key', prefix: m[1], keyName: m[2], value: '', secret: '' };
    if (value.includes('${')) return { ro: true, name, raw: value };
    return { name, mode: 'plain', value, secret: '' };
  }
  const KNOWN_FIELDS = ['type', 'command', 'args', 'env', 'url', 'headers'];
  // null when the form can't represent the entry at all.
  function parseEntry(raw) {
    if (!isPlain(raw)) return null;
    let kind = null;
    if ((raw.type === undefined || raw.type === 'stdio') && typeof raw.command === 'string' && raw.url === undefined) kind = 'command';
    else if (raw.type === 'http' && typeof raw.url === 'string' && raw.command === undefined) kind = 'http';
    if (!kind) return null;
    const objOrNone = (v) => v === undefined || isPlain(v);
    if (kind === 'command') {
      if (!objOrNone(raw.env) || raw.headers !== undefined || (raw.args !== undefined && !Array.isArray(raw.args))) return null;
    } else if (!objOrNone(raw.headers) || raw.env !== undefined || raw.args !== undefined) return null;
    const args = Array.isArray(raw.args) ? raw.args : [];
    return {
      kind,
      command: kind === 'command' ? raw.command : '',
      url: kind === 'http' ? raw.url : '',
      args,
      argsRO: args.some((a) => typeof a !== 'string' || a === '' || a.includes('\n') || a.includes('\r') || a.includes('${')),
      commandRO: kind === 'command' && raw.command.includes('${'),
      urlRO: kind === 'http' && raw.url.includes('${'),
      extras: Object.entries(raw).filter(([k]) => !KNOWN_FIELDS.includes(k)),
      envRows: kind === 'command' ? Object.entries(raw.env || {}).map(([k, v]) => classifyEnv(k, v)) : [],
      hdrRows: kind === 'http' ? Object.entries(raw.headers || {}).map(([k, v]) => classifyHeader(k, v)) : [],
    };
  }
  const NEEDS_RE = /^needs ([A-Za-z_][A-Za-z0-9_]*), not set on this machine$/;
  function rowKeyName(row, kind) {
    if (row.ro || row.mode !== 'key') return null;
    return kind === 'env' ? row.name : row.keyName;
  }

  // ---- the section ------------------------------------------------------------------------

  function render(container) {
    const state = {
      picker: null, machine: '', path: '',
      read: null, token: null, keys: [], tools: {}, sourceTools: {},
      pending: nullObj(),     // key values typed in the tool form, by name
      busy: false, loading: false, loads: 0, readSeq: 0, pickSeq: 0, gen: 0,
    };
    let els = {};
    let formState = null;

    const status = h('div', { class: 'pt-status', role: 'status' });
    const view = h('div', { class: 'pt-view' });
    const machineSel = h('select', { 'aria-label': 'Machine', id: 'pt-machine' });
    const projectSel = h('select', { 'aria-label': 'Project', id: 'pt-project' });

    container.replaceChildren(
      h('div', { class: 'pt' },
        h('div', {},
          h('h1', { text: 'Project tools' }),
          h('p', { class: 'lede', text: "The tools (MCP servers) agents get in a project, kept in the project's .mcp.json on its default branch. Pick a project to see and change them." })),
        h('div', { class: 'pt-picker' },
          h('label', {}, h('span', { text: 'Machine' }), machineSel),
          h('label', {}, h('span', { text: 'Project' }), projectSel)),
        status, view));

    function setStatus(parts, bad) {
      status.className = 'pt-status' + (bad ? ' bad' : parts ? ' ok' : '');
      status.replaceChildren(...[].concat(parts || []).map((p) => (typeof p === 'string' ? h('p', { text: p }) : p)));
      if (parts) status.scrollIntoView?.({ block: 'nearest' });
    }

    // ---- loading lock ------------------------------------------------------------------
    // While the picker or a read is in flight nothing in the section can be used.

    function applyLock() {
      state.loading = state.loads > 0;
      machineSel.disabled = state.loading;
      projectSel.disabled = state.loading;
      if (state.loading) for (const el of view.querySelectorAll('button,input,select,textarea')) el.disabled = true;
    }
    function startLoad() { state.loads++; applyLock(); }
    function endLoad() { state.loads = Math.max(0, state.loads - 1); applyLock(); }

    // ---- picker -----------------------------------------------------------------------

    function fillProjects(data) {
      projectSel.replaceChildren(h('option', { value: '', text: 'Choose a project…' }));
      const seen = new Set();
      const group = (label, items) => {
        const g = h('optgroup', { label });
        for (const i of items) {
          if (seen.has(i.path)) continue;
          seen.add(i.path);
          g.append(h('option', { value: i.path, text: i.label }));
        }
        if (g.children.length) projectSel.append(g);
      };
      const base = (p) => String(p).split('/').filter(Boolean).pop() || String(p);
      group('Saved', (data.saved || []).map((s) => ({ path: s.path, label: s.name })));
      group('In ' + (data.default_folder || 'the default folder'), (data.found || []).map((f) => ({ path: f.path, label: f.name })));
      const prev = (data.previous || []).filter((p) => !seen.has(p));
      const clash = (p) => prev.filter((q) => base(q) === base(p)).length > 1;
      group('Used before', prev.map((p) => ({ path: p, label: clash(p) ? p : base(p) })));
    }

    async function loadPicker(machine) {
      const seq = ++state.pickSeq;
      state.path = '';
      state.machine = machine || 'hub';
      clearView();
      projectSel.replaceChildren(h('option', { value: '', text: 'Choose a project…' }));
      const t = tag();
      startLoad();
      let ended = false;
      const end = () => { if (!ended) { ended = true; endLoad(); } };
      try {
        const res = await fetch(API + '/new-thread?machine=' + encodeURIComponent(machine || 'hub'));
        const data = await res.json().catch(() => ({}));
        end();
        if (!res.ok) throw new Error(data.detail || data.error || 'http ' + res.status);
        if (seq !== state.pickSeq || !fresh(t)) return;
        state.picker = data;
        machineSel.replaceChildren(...(data.machines || ['hub']).map((m) => h('option', { value: m, text: m })));
        machineSel.value = data.machine || machine || 'hub';
        state.machine = machineSel.value;
        fillProjects(data);
      } catch (e) {
        end();
        if (seq !== state.pickSeq || !fresh(t)) return;
        setStatus('Could not load the project list: ' + e.message, true);
      }
    }
    machineSel.addEventListener('change', () => { setStatus(null); loadPicker(machineSel.value); });
    projectSel.addEventListener('change', () => {
      state.gen++;
      state.path = projectSel.value;
      setStatus(null);
      if (state.path) readProject(); else clearView();
    });

    const tag = () => ({ machine: state.machine, path: state.path, gen: state.gen });
    const fresh = (t) => t.machine === state.machine && t.path === state.path && t.gen === state.gen;

    function clearView() {
      state.readSeq++;
      state.gen++;
      state.read = null;
      view.replaceChildren();
      els = {};
      formState = null;
    }

    // ---- reading -----------------------------------------------------------------------

    async function readProject(keepStatus) {
      const seq = ++state.readSeq;
      const machine = state.machine;
      const path = state.path;
      const t = tag();
      view.replaceChildren(h('p', { class: 'hint', text: 'Reading the project…' }));
      startLoad();
      let res;
      try { res = await post('/project-tools/read', { machine, path }); } finally { endLoad(); }
      const { status: code, body } = res;
      if (seq !== state.readSeq || !fresh(t)) return;
      if (!body || !body.mode || code >= 400) {
        view.replaceChildren();
        setStatus("Couldn't read this project: " + ((body && (body.reason || body.error)) || (code ? 'http ' + code : 'the hub could not be reached')), true);
        return;
      }
      state.read = body;
      reservedLists = body.reserved || { exact: [], prefixes: [] };
      state.token = { ...body.token };
      state.keys = [...(body.keys || [])];
      state.sourceTools = isPlain(body.source?.document?.mcpServers) ? body.source.document.mcpServers : {};
      state.tools = structuredClone(state.sourceTools);
      state.pending = nullObj();
      if (!keepStatus) setStatus(null);
      buildView();
    }

    // ---- the view ----------------------------------------------------------------------

    function buildView() {
      const r = state.read;
      els = {};
      formState = null;
      const parts = [];
      const toolsMode = r.mode === 'tools';
      if (r.notice) parts.push(h('p', { class: 'pt-notice', text: r.notice }));
      if (toolsMode) {
        els.waiting = h('div', {});
        if (r.source?.state === 'unreadable') {
          parts.push(h('div', { class: 'pt-box' },
            h('p', { class: 'pt-notice', text: 'The tools file can\'t be read: ' + (r.source.reason || 'unknown reason') }),
            h('p', { class: 'hint', text: 'Tools can\'t be edited here until it is fixed in the file, or you start over with an empty list (this replaces whatever is there).' }),
            button('Start over', startOver, { class: 'danger' })), els.waiting);
        } else {
          for (const w of r.file_warnings || []) parts.push(h('p', { class: 'pt-warn', text: w }));
          els.tools = h('div', { class: 'pt-tools' });
          els.form = h('div', {});
          els.save = h('div', { class: 'pt-savebar' });
          parts.push(els.waiting,
            h('section', {}, h('h2', { text: 'Tools' }), els.tools, els.form, els.save));
        }
        paintWaiting();
      }
      els.keys = h('section', { class: 'pt-keys' });
      parts.push(els.keys);
      parts.push(h('div', { class: 'pt-notes' },
        h('p', { class: 'hint', text: "Antigravity agents don't get project tools." }),
        h('p', { class: 'hint', text: 'Keys are kept on this machine only, so another machine running this project needs its own keys entered.' })));
      view.replaceChildren(...parts);
      if (els.tools) { paintTools(); paintSave(); }
      paintKeys();
    }

    function paintWaiting() {
      const r = state.read;
      const kids = [];
      if (r.waiting_error) kids.push(h('p', { class: 'pt-warn', text: "couldn't check for waiting pull requests: " + r.waiting_error }));
      if (r.waiting?.length) {
        kids.push(h('h2', { text: 'Waiting to merge' }),
          h('ul', { class: 'pt-waiting' }, r.waiting.map((w) => h('li', {},
            h('a', { href: w.url, target: '_blank', rel: 'noopener', text: '#' + w.number + ' ' + (w.title || w.branch) })))),
          h('p', { class: 'hint', text: "Edits start from the default branch and don't include these." }));
      }
      els.waiting.replaceChildren(...kids);
    }

    function paintTools() {
      const names = Object.keys(state.tools);
      const kids = names.map((name) => toolCard(name));
      if (!names.length) kids.push(h('p', { class: 'hint', text: 'No tools yet.' }));
      kids.push(h('div', { class: 'actions' }, button('Add a tool', () => openForm(null), { id: 'pt-add', disabled: state.loading })));
      els.tools.replaceChildren(...kids);
    }

    function rowLine(row, kind) {
      if (row.ro) return h('li', { class: 'pt-ro' }, h('span', { class: 'mono', text: row.name }), ' ',
        h('span', { class: 'mono', text: typeof row.raw === 'string' ? row.raw : JSON.stringify(row.raw) }), ' ',
        h('span', { class: 'hint', text: row.env ? "(from the agent's own environment)" : '(edit in the file)' }));
      if (row.mode === 'key') {
        const key = rowKeyName(row, kind);
        const set = state.keys.includes(key);
        return h('li', {}, h('span', { class: 'mono', text: row.name }), ' ',
          row.prefix ? h('span', { class: 'mono', text: row.prefix + '‹key ' + key + '›' }) : h('span', { class: 'mono', text: '‹key ' + key + '›' }), ' ',
          h('span', { class: 'pt-chip ' + (set ? 'set' : 'unset'), text: set ? 'set' : 'not set' }));
      }
      return h('li', {}, h('span', { class: 'mono', text: row.name }), ' = ', h('span', { class: 'mono', text: row.value }));
    }

    // Tools other than `except` whose loaded checks name the key `key`.
    function toolsUsingKey(key, except) {
      const checks = state.read?.checks;
      if (!isPlain(checks)) return [];
      return Object.keys(checks).filter((n) => n !== except && (own(checks, n)?.keys || []).includes(key));
    }

    function toolCard(name) {
      const r = state.read;
      const raw = state.tools[name];
      const p = parseEntry(raw);
      const checks = own(r.checks, name) || {};
      const card = h('div', { class: 'pt-tool', 'data-tool': name });
      card.append(h('div', { class: 'pt-tool-head' }, h('h3', { text: name }),
        h('span', { class: 'pt-chip', text: p ? (p.kind === 'command' ? 'command' : 'web address') : 'edit in the file' })));
      if (!p) {
        card.append(h('p', { class: 'hint', text: "This entry's shape can't be shown here. Edit in the file." }));
      } else {
        for (const [k, v] of p.extras) card.append(h('p', { class: 'hint' }, h('span', { class: 'mono', text: k + ': ' + JSON.stringify(v) }), ' (edit in the file)'));
        card.append(h('p', { class: 'pt-runs mono', text: p.kind === 'command' ? [p.command, ...p.args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))].join(' ') : p.url }));
        const rows = p.kind === 'command' ? p.envRows : p.hdrRows;
        if (rows.length) {
          card.append(h('p', { class: 'hint', text: p.kind === 'command' ? 'Settings' : 'Headers' }),
            h('ul', { class: 'pt-rows' }, rows.map((row) => rowLine(row, p.kind === 'command' ? 'env' : 'hdr'))));
        }
      }
      for (const s of checks.skip || []) card.append(h('p', { class: 'pt-warn', text: s }));
      // The machine's own key warnings, except "needs" ones, which follow the key status here.
      for (const w of Array.isArray(checks.key_warnings) ? checks.key_warnings : []) {
        if (!NEEDS_RE.test(w)) card.append(h('p', { class: 'pt-warn', text: w }));
      }
      const myKeys = Array.isArray(checks.keys) ? checks.keys : [];
      for (const key of myKeys) {
        for (const other of toolsUsingKey(key, name)) card.append(h('p', { class: 'hint', text: 'shared with ' + other + ' (' + key + ')' }));
      }
      for (const key of myKeys) {
        if (!state.keys.includes(key)) card.append(h('p', { class: 'pt-warn', text: 'needs ' + key + ', not set on this machine' }));
      }
      const actions = h('div', { class: 'actions' });
      if (p) actions.append(button('Edit', () => openForm(name), { 'aria-label': 'Edit ' + name }));
      const confirmHost = h('div', { class: 'pt-confirm', hidden: true });
      const remove = button('Remove', () => {
        confirmHost.hidden = false;
        remove.hidden = true;
        confirmHost.replaceChildren(
          h('p', { text: 'Remove ' + name + '? It goes away when you Save.' }),
          h('div', { class: 'actions' },
            button('Yes, remove ' + name, () => { if (state.loading) return; delete state.tools[name]; paintTools(); paintSave(); }, { class: 'danger' }),
            button('Cancel', () => { confirmHost.hidden = true; remove.hidden = false; })));
      }, { 'aria-label': 'Remove ' + name });
      actions.append(remove);
      card.append(actions, confirmHost);
      return card;
    }

    // ---- tool form ---------------------------------------------------------------------

    function reservedProblem(name) {
      return isReservedName(name);
    }
    function keyNameProblem(name) {
      if (!KEY_RE.test(name)) return 'A key name uses letters, digits and _, and does not start with a digit.';
      if (reservedProblem(name)) return name + ' ' + RESERVED_MSG + '.';
      return '';
    }

    function openForm(origName) {
      if (state.loading) return;
      const raw = origName !== null ? own(state.tools, origName) || null : null;
      const p = raw ? parseEntry(raw) : null;
      if (raw && !p) return;
      const f = formState = {
        origName, raw, p, name: origName || '', kind: p ? p.kind : 'command',
        command: p?.command || '', url: p?.url || '', argsText: (p?.args || []).join('\n'), argsRO: !!p?.argsRO,
        commandRO: !!p?.commandRO, urlRO: !!p?.urlRO,
        envRows: p ? p.envRows : [], hdrRows: p ? p.hdrRows : [],
      };
      const err = h('p', { class: 'inline-err', role: 'alert' });
      const showErr = (m) => { err.textContent = m || ''; };

      const nameIn = h('input', { type: 'text', value: f.name, autocomplete: 'off', 'aria-label': 'Name' });
      nameIn.addEventListener('input', () => { f.name = nameIn.value; });
      const kindSel = h('select', { 'aria-label': 'Kind' },
        h('option', { value: 'command', text: 'Command' }), h('option', { value: 'http', text: 'Web address' }));
      kindSel.value = f.kind;
      const commandIn = h('input', { type: 'text', value: f.command, autocomplete: 'off', 'aria-label': 'Command', class: 'mono' });
      commandIn.addEventListener('input', () => { f.command = commandIn.value; });
      const argsIn = h('textarea', { rows: 3, 'aria-label': 'Arguments, one per line', class: 'mono', value: f.argsText });
      argsIn.addEventListener('input', () => { f.argsText = argsIn.value; });
      const urlIn = h('input', { type: 'text', value: f.url, autocomplete: 'off', 'aria-label': 'URL', class: 'mono' });
      urlIn.addEventListener('input', () => { f.url = urlIn.value; });

      const envHost = h('div', { class: 'pt-rowlist' });
      const hdrHost = h('div', { class: 'pt-rowlist' });
      const headerNote = h('p', { class: 'pt-warn', role: 'note', text: HEADER_NOTE, hidden: true });

      function rowEditor(row, rows, kind) {
        if (row.ro) {
          return h('div', { class: 'pt-row ro' },
            h('span', { class: 'mono', text: row.name + ' = ' + (typeof row.raw === 'string' ? row.raw : JSON.stringify(row.raw)) }),
            h('span', { class: 'hint', text: row.env ? "(from the agent's own environment)" : 'edit in the file (kept as is)' }));
        }
        const word = kind === 'env' ? 'Setting' : 'Header';
        const nameField = h('input', { type: 'text', value: row.name, autocomplete: 'off', 'aria-label': word + ' name', placeholder: 'Name' });
        const modeSel = h('select', { 'aria-label': word + ' kind' },
          h('option', { value: 'plain', text: 'Plain value' }), h('option', { value: 'key', text: 'Key' }));
        modeSel.value = row.mode;
        const valueField = h('input', { type: 'text', value: row.value, autocomplete: 'off', 'aria-label': word + ' value', placeholder: 'Value', class: 'mono' });
        const prefixField = h('input', { type: 'text', value: row.prefix || '', autocomplete: 'off', 'aria-label': 'Text before the key', placeholder: 'Text before the key, e.g. "Bearer "', class: 'mono' });
        const keyField = h('input', { type: 'text', value: row.keyName || '', autocomplete: 'off', 'aria-label': 'Key name', placeholder: 'Key name' });
        const secretField = h('input', { type: 'password', value: row.secret || '', autocomplete: 'off', 'aria-label': 'Value for the new key', placeholder: 'Value for this key (optional)' });
        const sharedHint = h('p', { class: 'hint pt-shared', hidden: true });
        const remove = button('Remove', () => { rows.splice(rows.indexOf(row), 1); paintRows(); }, { class: 'small', 'aria-label': 'Remove ' + word.toLowerCase() });
        const refresh = () => {
          const key = kind === 'env' ? row.name : row.keyName;
          const isKey = row.mode === 'key';
          valueField.hidden = isKey;
          prefixField.hidden = !(isKey && kind === 'hdr');
          keyField.hidden = !(isKey && kind === 'hdr');
          secretField.hidden = !(isKey && key && !state.keys.includes(key));
          const users = isKey && key && key.trim() ? toolsUsingKey(key.trim(), origName) : [];
          sharedHint.hidden = !users.length;
          sharedHint.textContent = users.length ? 'shared with ' + users.join(', ') : '';
        };
        nameField.addEventListener('input', () => { row.name = nameField.value; refresh(); });
        modeSel.addEventListener('change', () => { row.mode = modeSel.value; if (row.mode === 'key' && kind === 'hdr' && row.keyName === undefined) row.keyName = ''; refresh(); });
        valueField.addEventListener('input', () => { row.value = valueField.value; });
        prefixField.addEventListener('input', () => { row.prefix = prefixField.value; });
        keyField.addEventListener('input', () => { row.keyName = keyField.value; refresh(); });
        secretField.addEventListener('input', () => { row.secret = secretField.value; });
        refresh();
        return h('div', { class: 'pt-row' }, nameField, modeSel, valueField, prefixField, keyField, secretField, remove, sharedHint);
      }
      function paintRows() {
        envHost.replaceChildren(...f.envRows.map((row) => rowEditor(row, f.envRows, 'env')),
          button('Add a setting', () => { f.envRows.push({ name: '', mode: 'plain', value: '', secret: '' }); paintRows(); }, { class: 'small' }));
        hdrHost.replaceChildren(...f.hdrRows.map((row) => rowEditor(row, f.hdrRows, 'hdr')),
          button('Add a header', () => { f.hdrRows.push({ name: '', mode: 'plain', value: '', prefix: '', keyName: '', secret: '' }); paintRows(); }, { class: 'small' }));
        headerNote.hidden = !(f.kind === 'http' && f.hdrRows.length > 0);
      }

      const commandBox = h('div', { class: 'pt-fields' },
        f.commandRO
          ? h('div', {}, h('span', { class: 'hint', text: 'Command' }), h('p', { class: 'mono pt-ro', text: f.p.command }), h('p', { class: 'hint', text: 'edit in the file (kept as is)' }))
          : h('label', {}, h('span', { text: 'Command' }), commandIn),
        f.argsRO
          ? h('div', {}, h('span', { class: 'hint', text: 'Arguments' }), h('p', { class: 'mono pt-ro', text: JSON.stringify(f.p.args) }), h('p', { class: 'hint', text: 'edit in the file (kept as is)' }))
          : h('label', {}, h('span', { text: 'Arguments, one per line' }), argsIn),
        h('div', {}, h('span', { class: 'hint', text: 'Settings (environment)' }), envHost));
      const extrasBox = h('div', { class: 'pt-fields' }, (p?.extras || []).map(([k, v]) =>
        h('p', { class: 'hint' }, h('span', { class: 'mono', text: k + ': ' + JSON.stringify(v) }), ' edit in the file (kept as is)')));
      const httpBox = h('div', { class: 'pt-fields' },
        f.urlRO
          ? h('div', {}, h('span', { class: 'hint', text: 'URL' }), h('p', { class: 'mono pt-ro', text: f.p.url }), h('p', { class: 'hint', text: 'edit in the file (kept as is)' }))
          : h('label', {}, h('span', { text: 'URL' }), urlIn),
        h('div', {}, h('span', { class: 'hint', text: 'Headers' }), hdrHost, headerNote));
      const syncKind = () => { commandBox.hidden = f.kind !== 'command'; httpBox.hidden = f.kind !== 'http'; headerNote.hidden = !(f.kind === 'http' && f.hdrRows.length > 0); };
      kindSel.addEventListener('change', () => {
        const hasRo = !!p && (p.envRows.some((x) => x.ro) || p.hdrRows.some((x) => x.ro) || p.argsRO || p.commandRO || p.urlRO || p.extras.length > 0);
        if (p && hasRo && kindSel.value !== p.kind) {
          kindSel.value = f.kind;
          showErr("Can't change the kind: this tool has parts the form can't edit. Edit in the file.");
          return;
        }
        showErr('');
        f.kind = kindSel.value;
        syncKind();
      });

      function apply() {
        if (state.loading) return;
        showErr('');
        const name = f.name.trim();
        if (!name) return showErr('Give the tool a name.');
        if (name !== origName && Object.hasOwn(state.tools, name)) return showErr('There is already a tool called ' + name + '.');
        const rows = f.kind === 'command' ? f.envRows : f.hdrRows;
        const rk = f.kind === 'command' ? 'env' : 'hdr';
        if (f.kind === 'command' && !f.command.trim()) return showErr('Enter the command to run.');
        if (f.kind === 'http' && !f.url.trim()) return showErr('Enter the web address.');
        const seen = new Set(rows.filter((row) => row.ro).map((row) => row.name));
        for (const row of rows) {
          if (row.ro) continue;
          const nm = row.name.trim();
          if (!nm) return showErr('Every ' + (rk === 'env' ? 'setting' : 'header') + ' needs a name.');
          if (seen.has(nm)) return showErr(nm + ' is listed twice.');
          seen.add(nm);
          if (row.mode === 'key') {
            const key = (rk === 'env' ? nm : (row.keyName || '').trim());
            const bad = keyNameProblem(key);
            if (bad) return showErr(bad);
            if (rk === 'hdr' && (row.prefix || '').includes('$')) return showErr('The text before the key can\'t contain $.');
          } else if (row.value.includes('${')) return showErr('A plain value can\'t contain ${. Use a key instead.');
        }
        const entry = buildEntry(f, name);
        const pending = copyObj(state.pending);
        for (const row of rows) {
          const key = rowKeyName(row, rk);
          const secret = row.secret || '';
          const k = key && (rk === 'env' ? row.name.trim() : (row.keyName || '').trim());
          if (k && secret && !state.keys.includes(k)) setOwn(pending, k, secret);
        }
        state.pending = pending;
        if (origName !== null && origName !== name) {
          const next = nullObj();
          for (const [k, v] of Object.entries(state.tools)) setOwn(next, k === origName ? name : k, k === origName ? entry : v);
          state.tools = next;
        } else setOwn(state.tools, name, entry);
        formState = null;
        els.form.replaceChildren();
        paintTools(); paintSave();
      }

      paintRows(); syncKind();
      els.form.replaceChildren(h('form', { class: 'pt-form', 'aria-label': origName === null ? 'Add a tool' : 'Edit ' + origName, onsubmit: (ev) => { ev.preventDefault(); apply(); } },
        h('h3', { text: origName === null ? 'Add a tool' : 'Edit ' + origName }),
        h('label', {}, h('span', { text: 'Name' }), nameIn),
        h('label', {}, h('span', { text: 'Kind' }), kindSel),
        commandBox, httpBox, extrasBox, err,
        h('div', { class: 'actions' },
          h('button', { type: 'submit', class: 'primary', text: origName === null ? 'Add to the list' : 'Keep changes' }),
          button('Cancel', () => { formState = null; els.form.replaceChildren(); }))));
      nameIn.focus();
    }

    // Applies the form's fields onto the original raw entry: fields the form knows are replaced
    // or removed, every other field is kept.
    function buildEntry(f, name) {
      void name;
      const e = f.raw ? structuredClone(f.raw) : {};
      const rowsObj = (rows, kind) => {
        const out = nullObj();
        for (const row of rows) {
          if (row.ro) { setOwn(out, row.name, row.raw); continue; }
          const nm = row.name.trim();
          if (row.mode === 'key') setOwn(out, nm, kind === 'env' ? '${' + nm + '}' : (row.prefix || '') + '${' + (row.keyName || '').trim() + '}');
          else setOwn(out, nm, row.value);
        }
        return out;
      };
      if (f.kind === 'command') {
        delete e.url; delete e.headers;
        if (e.type !== undefined && e.type !== 'stdio') delete e.type;
        if (!f.commandRO) e.command = f.command.trim();
        if (!f.argsRO) {
          const args = f.argsText.split('\n').map((s) => s.replace(/\r$/, '')).filter((s) => s !== '');
          if (args.length) e.args = args; else delete e.args;
        }
        const env = rowsObj(f.envRows, 'env');
        if (Object.keys(env).length) e.env = env; else delete e.env;
      } else {
        delete e.command; delete e.args; delete e.env;
        e.type = 'http';
        if (!f.urlRO) e.url = f.url.trim();
        const headers = rowsObj(f.hdrRows, 'hdr');
        if (Object.keys(headers).length) e.headers = headers; else delete e.headers;
      }
      return e;
    }

    // ---- saving ------------------------------------------------------------------------

    const isDirty = () => !deepEqual(state.tools, state.sourceTools);

    function paintSave() {
      if (!els.save) return;
      const dirty = isDirty();
      const hasKeys = Object.values(state.pending).some(Boolean);
      const btn = button('Save', saveTools, { class: 'primary', id: 'pt-save', disabled: state.busy || state.loading || (!dirty && !hasKeys) });
      els.save.replaceChildren(btn, h('span', { class: 'hint', text: dirty ? 'Unsaved changes. Saving opens a pull request against the default branch.' : hasKeys ? 'Key values will be stored on this machine.' : 'No changes.' }));
    }

    function currentRefs(tools) {
      const names = new Set();
      for (const raw of Object.values(tools)) {
        const p = parseEntry(raw);
        if (!p) continue;
        for (const row of p.kind === 'command' ? p.envRows : p.hdrRows) {
          const k = rowKeyName(row, p.kind === 'command' ? 'env' : 'hdr');
          if (k) names.add(k);
        }
      }
      return names;
    }

    function setBusy(v) {
      state.busy = v;
      paintSave();
      for (const b of els.keys ? els.keys.querySelectorAll('button') : []) if (!b.closest('.pt-confirm') || v) b.disabled = v;
    }

    async function saveTools() {
      if (state.busy || state.loading) return;
      const dirty = isDirty();
      const refs = currentRefs(state.tools);
      const keys = nullObj();
      for (const [k, v] of Object.entries(state.pending)) if (v && refs.has(k)) setOwn(keys, k, v);
      if (!dirty && !Object.keys(keys).length) { setStatus('Nothing to save.'); return; }
      await send({ tools: dirty ? state.tools : null, keys });
    }
    async function startOver() {
      if (state.busy || state.loading) return;
      await send({ tools: {}, keys: {}, start_over: true });
    }
    async function setKey(name, value) {
      if (state.busy || state.loading) return false;
      return send({ tools: null, keys: setOwn(nullObj(), name, value) });
    }

    function applyKeys(body) {
      if (body && Number.isInteger(body.key_revision) && state.token) state.token.key_revision = body.key_revision;
      if (body && Array.isArray(body.keys)) {
        state.keys = body.keys.slice();
        for (const k of Object.keys(state.pending)) if (state.keys.includes(k)) delete state.pending[k];
      }
      if (els.tools) paintTools();
    }

    async function send(extra) {
      setBusy(true);
      setStatus('Saving…');
      let out;
      const c = tag();
      try {
        const { status: code, body } = await post('/project-tools/save', { machine: c.machine, path: c.path, token: state.token, ...extra });
        if (!fresh(c)) return false;
        out = await handle(code, body, c);
      } finally { setBusy(false); }
      return out;
    }

    function warningsList(w) {
      return Array.isArray(w) && w.length ? h('ul', { class: 'pt-warnings' }, w.map((x) => h('li', { text: String(x) }))) : null;
    }

    // Shows a save or remove reply. Returns true when the keys/tools were stored.
    async function handle(code, body, c) {
      const outcome = body && KNOWN_OUTCOMES.includes(body.outcome) ? body.outcome : null;
      if (!outcome) { setStatus(LOST, true); return false; }
      if (outcome === 'saved') {
        applyKeys(body);
        setStatus(['Saved', warningsList(body.warnings)].filter(Boolean));
        paintKeys(); paintSave();
        return true;
      }
      if (outcome === 'removed') {
        applyKeys(body);
        setStatus('Key removed');
        paintKeys(); paintSave();
        return true;
      }
      if (outcome === 'opened') {
        applyKeys(body);
        const link = h('a', { href: body.pr_url, target: '_blank', rel: 'noopener', text: body.pr_url });
        const parts = [h('p', {}, 'Pull request opened: ', link), h('p', { text: 'New threads get the change once it is merged.' }), warningsList(body.warnings)].filter(Boolean);
        await readProject(true);
        if (!fresh(c)) return false;
        setStatus(parts);
        return true;
      }
      if (outcome === 'pr_failed') {
        applyKeys(body);
        const parts = [h('p', { text: 'The change was pushed but the pull request could not be opened: ' + (body.error || 'unknown error') }),
          h('p', {}, 'Branch ' + body.branch + '. ', h('a', { href: body.compare_url, target: '_blank', rel: 'noopener', text: 'Open the pull request yourself' }))];
        await readProject(true);
        if (!fresh(c)) return false;
        setStatus(parts, true);
        return false;
      }
      if (outcome === 'failed') {
        applyKeys(body);
        paintKeys(); paintSave();
        setStatus('Could not save: ' + (body.error || 'unknown error'), true);
        return false;
      }
      // refused
      const reason = body.reason || 'refused';
      if (code === 409) {
        await readProject(true);
        if (!fresh(c)) return false;
        setStatus(reason + '. The project was reloaded; make your change again.', true);
      } else setStatus(reason, true);
      return false;
    }

    // ---- keys --------------------------------------------------------------------------

    function keyRowNames() {
      const set = new Set(state.keys);
      const refs = state.read?.token?.baseline ? Object.keys(state.read.references || {}) : [];
      return [...new Set([...state.keys, ...refs])].sort((a, b) => a.localeCompare(b)).map((n) => [n, set.has(n)]);
    }

    function keyUsage(name) {
      if (!state.read?.token?.baseline) return 'unknown';
      const users = own(state.read.references, name) || [];
      return users.length ? 'used by ' + users.join(', ') : 'not used on main';
    }

    function paintKeys() {
      if (!els.keys) return;
      const rows = keyRowNames();
      const list = h('div', { class: 'pt-keylist' }, rows.map(([name, isSet]) => keyRow(name, isSet)));
      const newName = h('input', { type: 'text', autocomplete: 'off', 'aria-label': 'New key name', placeholder: 'Key name' });
      const newValue = h('input', { type: 'password', autocomplete: 'off', 'aria-label': 'New key value', placeholder: 'Value' });
      const addErr = h('p', { class: 'inline-err', role: 'alert' });
      const add = button('Add a key', async () => {
        addErr.textContent = '';
        const name = newName.value.trim();
        const bad = keyNameProblem(name);
        if (bad) { addErr.textContent = bad; return; }
        if (!newValue.value) { addErr.textContent = 'Enter a value.'; return; }
        if (await setKey(name, newValue.value)) { newName.value = ''; newValue.value = ''; }
      }, { disabled: state.busy || state.loading });
      els.keys.replaceChildren(
        h('h2', { text: 'Keys on this machine' }),
        h('p', { class: 'hint', text: "Key values are stored on this machine and never shown again." }),
        rows.length ? list : h('p', { class: 'hint', text: 'No keys yet.' }),
        h('div', { class: 'pt-addkey' }, newName, newValue, add), addErr);
    }

    function keyRow(name, isSet) {
      const value = h('input', { type: 'password', autocomplete: 'off', 'aria-label': 'Value for ' + name, placeholder: isSet ? 'New value' : 'Value' });
      const err = h('p', { class: 'inline-err', role: 'alert' });
      const confirmHost = h('div', { class: 'pt-confirm', hidden: true });
      const setBtn = button(isSet ? 'Replace' : 'Set', async () => {
        err.textContent = '';
        if (!value.value) { err.textContent = 'Enter a value.'; return; }
        if (await setKey(name, value.value)) value.value = '';
      }, { 'aria-label': 'Set ' + name, disabled: state.busy || state.loading });
      const rm = isSet ? button('Remove', () => {
        const users = own(state.read?.references, name) || [];
        rm.hidden = true;
        confirmHost.hidden = false;
        confirmHost.replaceChildren(
          h('p', { text: 'Remove ' + name + '? ' + (state.read?.token?.baseline ? (users.length ? 'Tools on main using it: ' + users.join(', ') + '. ' : 'No tools on main use it. ') : '') + 'Waiting pull requests may need it too.' }),
          h('div', { class: 'actions' },
            button('Yes, remove ' + name, async () => {
              if (state.busy || state.loading) return;
              setBusy(true); setStatus('Removing…');
              const c = tag();
              try {
                const { status: code, body } = await post('/project-tools/remove-key', { machine: c.machine, path: c.path, token: state.token, name });
                if (!fresh(c)) return;
                await handle(code, body, c);
              } finally { setBusy(false); }
            }, { class: 'danger' }),
            button('Cancel', () => { confirmHost.hidden = true; rm.hidden = false; })));
      }, { 'aria-label': 'Remove ' + name, disabled: state.busy || state.loading }) : null;
      return h('div', { class: 'pt-key', 'data-key': name },
        h('div', { class: 'pt-key-head' }, h('span', { class: 'mono', text: name }),
          h('span', { class: 'pt-chip ' + (isSet ? 'set' : 'unset'), text: isSet ? 'set' : 'not set' }),
          h('span', { class: 'hint', text: keyUsage(name) })),
        h('div', { class: 'pt-key-ctl' }, value, setBtn, rm), err, confirmHost);
    }

    loadPicker('hub');
  }

  window.ProjectTools = { render };
})();
