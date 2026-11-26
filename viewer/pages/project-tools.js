'use strict';

// The "Project tools" section of the Settings page. Exposes window.ProjectTools.render(container).
// It talks to the hub's /project-tools routes (docs/plans/project-tools-screen/API.md) and keeps
// no copy of its own beyond the unsaved edits. Key values are only ever sent, never shown back.
(() => {
  const API = '/wheelchair/api';
  const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const LOST = 'Save may still be finishing; reload in a minute and check Waiting to merge before saving again.';
  const HEADER_NOTE = "Codex takes a header only when it is plain text, ${NAME} or Bearer ${NAME}. Claude may read some credential-like names as empty in headers, so check the tool signs in.";
  const RESERVED_MSG = "can't be set here: it would change how the agent itself runs";
  // The shared "Marked tool" rule (machine/lib/win-mark.js WINDOWS_URL carries the same pattern).
  const WINDOWS_URL = /^http:\/\/(localhost|127\.0\.0\.1)(:(\d{1,5}))?(?=[\/?#]|$)/i;
  function windowsEligible(type, url) {
    if (type !== 'http' || typeof url !== 'string') return false;
    const m = WINDOWS_URL.exec(url);
    if (!m) return false;
    const port = m[3] === undefined ? 80 : Number(m[3]);
    return port >= 1 && port <= 65535;
  }
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

  // True when a single-line input could not show the string exactly: a C0 control character or DEL.
  function unshowable(s) { return /[\u0000-\u001f\u007f]/.test(s); }
  // Display only: a read-only string a single line can't show exactly is shown in its JSON form.
  const showText = (s) => (typeof s === 'string' && !unshowable(s) ? s : JSON.stringify(s));
  function classifyEnv(name, value) {
    if (typeof value !== 'string' || unshowable(name) || unshowable(value)) return { ro: true, name, raw: value };
    const m = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(value);
    if (m && m[1] === name && isReservedName(name)) return { ro: true, env: true, name, raw: value };
    if (m && m[1] === name) return { name, mode: 'key', value: '', secret: '' };
    if (value.includes('${')) return { ro: true, name, raw: value };
    return { name, mode: 'plain', value, secret: '' };
  }
  function classifyHeader(name, value) {
    if (typeof value !== 'string' || unshowable(name) || unshowable(value)) return { ro: true, name, raw: value };
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
      argsRO: args.some((a) => typeof a !== 'string' || a === '' || unshowable(a) || a.includes('${')),
      commandRO: kind === 'command' && (raw.command.includes('${') || unshowable(raw.command)),
      urlRO: kind === 'http' && (raw.url.includes('${') || unshowable(raw.url)),
      extras: Object.entries(raw).filter(([k]) => !KNOWN_FIELDS.includes(k)),
      envRows: kind === 'command' ? Object.entries(raw.env || {}).map(([k, v]) => ({ ...classifyEnv(k, v), rawName: k, rawValue: v, dirty: false })) : [],
      hdrRows: kind === 'http' ? Object.entries(raw.headers || {}).map(([k, v]) => ({ ...classifyHeader(k, v), rawName: k, rawValue: v, dirty: false })) : [],
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
      read: null, token: null, keys: [], tools: {}, sourceTools: {}, windows: new Set(), sourceWindows: [],
      baseName: nullObj(),    // draft tool name -> the baseline tool name it came from
      pending: nullObj(),     // key values typed in the tool form, by name
      busy: false, loading: false, loads: 0, readSeq: 0, pickSeq: 0, gen: 0,
    };
    let els = {};
    let formState = null;
    let unityMessage = '';
    let unityPollTimer = null;
    let unitySeq = 0;
    const wsl = () => state.read?.wsl === true;

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

    // Every control that starts a request is made with lockBtn: disabled while loading or busy,
    // and its handler refuses too.
    const locked = () => state.loading || state.busy;
    function lockBtn(text, onclick, extra) {
      return button(text, (ev) => { if (locked()) return; return onclick(ev); }, { ...(extra || {}), 'data-lock': '', disabled: locked() || !!extra?.disabled });
    }
    function applyLock() {
      state.loading = state.loads > 0;
      machineSel.disabled = locked();
      projectSel.disabled = locked();
      if (state.loading) for (const el of view.querySelectorAll('button,input,select,textarea')) el.disabled = true;
      if (locked()) for (const el of container.querySelectorAll('[data-lock]')) el.disabled = true;
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
    machineSel.addEventListener('change', () => { if (locked()) { machineSel.value = state.machine; return; } setStatus(null); loadPicker(machineSel.value); });
    projectSel.addEventListener('change', () => {
      if (locked()) { projectSel.value = state.path; return; }
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
      if (seq !== state.readSeq || !fresh(t)) return { ok: false, stale: true };
      if (!body || !body.mode || code >= 400) {
        view.replaceChildren();
        const why = (body && (body.reason || body.error)) || (code ? 'http ' + code : 'the hub could not be reached');
        if (!keepStatus) setStatus("Couldn't read this project: " + why, true);
        return { ok: false, reason: why };
      }
      state.read = body;
      reservedLists = body.reserved || { exact: [], prefixes: [] };
      state.token = { ...body.token };
      state.keys = [...(body.keys || [])];
      state.sourceTools = isPlain(body.source?.document?.mcpServers) ? body.source.document.mcpServers : {};
      state.tools = structuredClone(state.sourceTools);
      state.sourceWindows = (Array.isArray(body.windows) ? body.windows : []).filter((n) => typeof n === 'string' && Object.hasOwn(state.sourceTools, n));
      state.windows = new Set(state.sourceWindows);
      resetStore();
      state.baseName = nullObj();
      for (const n of Object.keys(state.sourceTools)) setOwn(state.baseName, n, n);
      state.pending = nullObj();
      if (!keepStatus) setStatus(null);
      buildView();
      return { ok: true };
    }

    // Reloads after a save or a 409 and shows the save's own message; a failed reload is said
    // plainly, with a button that runs the read again. Returns false when the view moved on.
    async function reloadThenShow(okParts, failParts, bad, c) {
      const res = await readProject(true);
      if (res.stale || !fresh(c)) return false;
      if (res.ok) setStatus(okParts, bad);
      else {
        setStatus([...failParts, h('p', { text: "Couldn't reload the project: " + res.reason }),
          lockBtn('Reload', () => { reloadThenShow(okParts, failParts, bad, tag()); })], true);
      }
      return true;
    }

    // ---- the view ----------------------------------------------------------------------

    function buildView() {
      const r = state.read;
      els = {};
      formState = null;
      const parts = [];
      const toolsMode = r.mode === 'tools';
      if (r.notice) parts.push(h('p', { class: 'pt-notice', text: r.notice }));
      const folders = r.folder_tools || { rows: [], notes: [] };
      els.folders = h('div', { class: 'pt-tools' });
      function folderCards() { return (state.read.folder_tools?.rows || []).map(row => h('div', { class: 'pt-tool' },
        h('div', { class: 'pt-tool-head' }, h('h3', { text: row.name }),
          row.kind && h('span', { class: 'pt-chip', text: row.kind }),
          h('span', { class: 'pt-chip', text: row.source === 'project' ? 'this project' : 'shared' })),
        !row.key_missing && h('p', { class: row.status === 'ok' && row.kind === 'script' ? 'pt-folder-good' : 'pt-warn', text: row.status === 'ok' ? (row.kind === 'server' ? "server tools don't work on Kimi, Pi or sandboxed Codex" : 'Working') : row.reason }),
        row.note && h('p', { class: 'hint', text: row.note }),
        (row.key_lines || []).map(line => h('p', { class: row.key_missing ? 'pt-warn' : 'hint', text: line })))); }
      els.paintFolders = () => { const cards = folderCards(); els.folders.replaceChildren(...(state.read.folder_tools?.notes || []).map(text => h('p', { class: 'hint', text })), ...(cards.length ? cards : [h('p', { class: 'hint', text: 'No folder tools yet. Ask in a thread to make one for this project or the shared tools project.' })])); };
      parts.push(h('section', { class: 'pt-folder-tools' }, h('h2', { text: 'Folder tools' }),
        h('p', { class: 'hint', text: 'To add or change a folder tool, ask in a thread.' }),
        els.folders));
      els.paintFolders();

      if (toolsMode) {
        els.waiting = h('div', {});
        if (r.source?.state === 'unreadable') {
          parts.push(h('div', { class: 'pt-box' },
            h('p', { class: 'pt-notice', text: 'The tools file can\'t be read: ' + (r.source.reason || 'unknown reason') }),
            h('p', { class: 'hint', text: 'Tools can\'t be edited here until it is fixed in the file, or you start over with an empty list (this replaces whatever is there).' }),
            lockBtn('Start over', startOver, { class: 'danger' })), els.waiting);
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
        h('p', { class: 'hint', text: "Antigravity agents don't get tools that use ${...}, except an env value exactly ${KEY} for that key, and don't get sse tools." }),
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
      kids.push(h('div', { class: 'actions' }, button('Add a tool', () => openForm(null), { id: 'pt-add', disabled: state.loading }), lockBtn('Add MCP for Unity', addUnity)));
      kids.push(h('p', { class: 'hint' }, 'Add the MCP for Unity package to your Unity project and commit it, so every Windows copy has it. In Unity, open Window > MCP for Unity and set the transport to Stdio (once per Windows user). Each agent opens Unity on its own copy and picks that Editor. ', h('a', { href: 'https://coplaydev.github.io/unity-mcp/getting-started/install', target: '_blank', rel: 'noopener', text: 'MCP for Unity installation' })));
      kids.push(h('p', { role: 'status', text: unityMessage }));
      els.tools.replaceChildren(...kids);
    }

    async function addUnity() {
      if (state.busy || state.loading) return;
      const seq = ++unitySeq;
      if (unityPollTimer) clearTimeout(unityPollTimer);
      unityPollTimer = null;
      const c = tag();
      setBusy(true);
      let result;
      try { result = await post('/project-tools/unity-prep', { machine: c.machine, path: c.path }); }
      finally { setBusy(false); }
      if (seq !== unitySeq) return;
      if (!fresh(c)) return;
      const body = result.body;
      if (!body?.command) { unityMessage = body?.message || 'Could not prepare MCP for Unity.'; paintTools(); return; }
      let name = 'unity', n = 2;
      while (Object.hasOwn(state.tools, name)) name = 'unity-' + n++;
      setOwn(state.tools, name, { command: body.command, args: ['--from', 'mcpforunityserver', 'mcp-for-unity', '--transport', 'stdio'] });
      paintSave();
      async function update(fetchState) {
        if (seq !== unitySeq || !fresh(c)) return;
        unityMessage = fetchState?.state === 'ready' ? 'Ready' : fetchState?.state === 'failed' ? "Couldn't fetch it: " + fetchState.reason + '; the first agent will fetch it instead' : fetchState ? 'Getting MCP for Unity ready on Windows…' : '';
        paintTools();
        if (fetchState?.state === 'running') unityPollTimer = setTimeout(async () => {
          if (seq !== unitySeq || !fresh(c)) return;
          const next = await post('/project-tools/unity-prep', { machine: c.machine, path: c.path, poll: true });
          if (seq === unitySeq && fresh(c)) update(next.body?.fetch || { state: 'failed', reason: next.body?.message || 'request failed' });
        }, 3000);
      }
      update(body.fetch);
    }

    const keyChip = (key) => {
      const set = state.keys.includes(key);
      return [h('span', { class: 'mono', text: '‹key ' + key + '›' }), ' ', h('span', { class: 'pt-chip ' + (set ? 'set' : 'unset'), text: set ? 'set' : 'not set' })];
    };
    function rowLine(row, kind, toolKeys) {
      if (row.ro) {
        const names = typeof row.raw === 'string' ? [...new Set([...row.raw.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]))].filter((n) => (toolKeys || []).includes(n)) : [];
        return h('li', { class: 'pt-ro' }, h('span', { class: 'mono', text: showText(row.name) }), ' ',
          h('span', { class: 'mono', text: showText(row.raw) }), ' ',
          names.map((n) => [keyChip(n), ' ']),
          h('span', { class: 'hint', text: row.env ? "(from the agent's own environment)" : '(edit in the file)' }));
      }
      if (row.mode === 'key') {
        const key = rowKeyName(row, kind);
        const set = state.keys.includes(key);
        return h('li', {}, h('span', { class: 'mono', text: row.name }), ' ',
          row.prefix ? h('span', { class: 'mono', text: row.prefix + '‹key ' + key + '›' }) : h('span', { class: 'mono', text: '‹key ' + key + '›' }), ' ',
          h('span', { class: 'pt-chip ' + (set ? 'set' : 'unset'), text: set ? 'set' : 'not set' }));
      }
      return h('li', {}, h('span', { class: 'mono', text: row.name }), ' = ', h('span', { class: 'mono', text: row.value }));
    }

    // The loaded checks of a draft tool, found by the baseline name it came from.
    function checksFor(name) {
      const base = own(state.baseName, name);
      return base === undefined ? {} : own(state.read?.checks, base) || {};
    }
    // Draft tools other than `except` whose baseline checks name the key `key`.
    function toolsUsingKey(key, except) {
      const checks = state.read?.checks;
      if (!isPlain(checks)) return [];
      return Object.keys(state.tools).filter((n) => n !== except && (checksFor(n).keys || []).includes(key));
    }

    // ---- Runs on Windows: the status store ---------------------------------------------
    // Results live here, keyed by the page guard plus the entry's current type and url, so every
    // render reads the same answer. A reply is stored only if the guard and epoch still hold and
    // its request is still the pending one for its key.
    const store = { guard: '', epoch: 0, results: new Map(), pending: new Map(), due: new Set(), timer: null };
    const lines = new Set();
    const guardId = () => JSON.stringify([state.machine, state.path, state.gen]);
    function resetStore() {
      store.epoch++;
      store.results.clear(); store.pending.clear(); store.due.clear();
      clearTimeout(store.timer); store.timer = null;
      store.guard = guardId();
    }
    function checkGuard() { if (store.guard !== guardId()) resetStore(); }
    const storeKey = (type, url) => JSON.stringify([type, url]);
    const parseKey = (key) => JSON.parse(key);

    // Values of every entry (and the open form) that currently shows a line.
    function neededKeys() {
      const out = new Map();
      if (!wsl() || !state.read) return out;
      for (const [name, raw] of Object.entries(state.tools)) {
        if (isPlain(raw) && state.windows.has(name) && windowsEligible(raw.type, raw.url)) out.set(storeKey(raw.type, raw.url), name);
      }
      for (const ln of lines) {
        if (!ln.el.isConnected) continue;
        const v = ln.vals();
        if (v) out.set(storeKey(v.type, v.url), v.name);
      }
      return out;
    }
    function scheduleCheck(key, now) {
      store.due.add(key);
      clearTimeout(store.timer);
      store.timer = null;
      if (now) flushChecks(); else store.timer = setTimeout(flushChecks, 500);
    }
    async function flushChecks() {
      store.timer = null;
      checkGuard();
      const needed = neededKeys();
      const keys = [...store.due].filter((k) => needed.has(k) && !store.results.has(k) && !store.pending.has(k));
      store.due.clear();
      if (!keys.length) { repaintLines(); return; }
      if (!state.token) return;   // leave the keys unscheduled: a repaint would schedule them again, forever
      const t = tag();
      const epoch = store.epoch;
      const req = {};
      const ids = new Map();
      for (const k of keys) store.pending.set(k, req);
      const tools = keys.map((k, i) => {
        const [type, url] = parseKey(k);
        ids.set(String(i), k);
        return { id: String(i), name: needed.get(k), type, url };
      });
      const { status: code, body } = await post('/project-tools/windows-status', { machine: t.machine, path: t.path, token: state.token, tools });
      if (!fresh(t) || store.epoch !== epoch) return;
      const bad = !body || code >= 400 || !isPlain(body.status);
      const why = bad ? (body && (body.reason || body.error)) || (code ? 'http ' + code : 'the hub could not be reached') : '';
      const at = Date.now();
      for (const [id, k] of ids) {
        if (store.pending.get(k) !== req) continue;
        store.pending.delete(k);
        const r = bad ? null : own(body.status, id);
        if (isPlain(r) && ['reachable', 'unreachable', 'unavailable'].includes(r.state)) store.results.set(k, { ...r, at });
        else store.results.set(k, { state: 'error', error: bad ? why : 'no answer for this tool', at });
      }
      repaintLines();
    }
    function ago(ms) {
      const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
      if (s < 60) return 'just now';
      const m = Math.round(s / 60);
      if (m < 60) return m + ' min ago';
      const hr = Math.round(m / 60);
      return hr < 48 ? hr + ' h ago' : Math.round(hr / 24) + ' days ago';
    }
    function lineKids(type, url, name) {
      checkGuard();
      const key = storeKey(type, url);
      const res = store.results.get(key);
      if (!res) {
        if (!store.pending.has(key) && !store.due.has(key)) scheduleCheck(key, false);
        return [h('p', { class: 'hint', text: 'Checking…' })];
      }
      const text = res.state === 'reachable' ? 'Reachable on Windows'
        : res.state === 'unreachable' ? 'Not reachable: ' + (res.reason || 'unknown reason')
          : res.state === 'unavailable' ? 'Not available: ' + (res.reason || 'unknown reason')
            : "Couldn't check: " + res.error;
      const kids = [h('p', { class: res.state === 'reachable' ? 'hint' : 'pt-warn', text })];
      if (res.note) kids.push(h('p', { class: 'hint', text: res.note }));
      if (isPlain(res.last) && res.last.reason) {
        const when = new Date(res.last.at).getTime();
        kids.push(h('p', { class: 'hint', text: 'Last connection refused: ' + res.last.reason + (Number.isFinite(when) ? ', ' + ago(when) : '') }));
      }
      kids.push(h('p', { class: 'hint' }, 'checked ' + ago(res.at) + ' ',
        button('Check again', () => {
          checkGuard();
          store.results.delete(key); store.pending.delete(key);
          repaintLines();
          scheduleCheck(key, true);
        }, { class: 'small', 'aria-label': 'Check ' + name + ' again' })));
      return kids;
    }
    function repaintLines() {
      for (const ln of [...lines]) {
        if (!ln.el.isConnected) { lines.delete(ln); continue; }
        ln.paint();
      }
    }

    // The switch and its status line. `vals()` gives the current {name,type,url} (possibly unsaved).
    function winControl(vals, isOn, setOn) {
      const el = h('div', { class: 'pt-win' });
      const ln = { el, vals: () => null, paint: () => {} };
      const box = h('input', { type: 'checkbox', 'aria-label': 'Runs on Windows' });
      const statusEl = h('div', { class: 'pt-win-status', role: 'status' });
      ln.paint = () => {
        const v = vals();
        const shown = wsl() && windowsEligible(v.type, v.url);
        el.hidden = !shown;
        box.checked = isOn();
        const on = shown && box.checked;
        ln.vals = () => (on ? v : null);
        statusEl.replaceChildren(...(on ? lineKids(v.type, v.url, v.name) : []));
      };
      box.addEventListener('change', () => { setOn(box.checked); ln.paint(); });
      el.append(h('label', { class: 'check', style: 'display:flex;flex-direction:row;align-items:center;gap:8px;font-size:13px;color:inherit' }, box, h('span', { text: 'Runs on Windows' })),
        h('p', { class: 'hint', text: "Turn on if this tool's server runs on Windows. Agents here reach it through wheelchair." }), statusEl);
      lines.add(ln);
      ln.paint();
      return { el, paint: ln.paint };
    }

    function toolCard(name) {
      const r = state.read;
      const raw = state.tools[name];
      const p = parseEntry(raw);
      const checks = checksFor(name);
      const card = h('div', { class: 'pt-tool', 'data-tool': name });
      const editable = !!p && !unshowable(name);
      const myKeys = Array.isArray(checks.keys) ? checks.keys : [];
      const asText = (x) => (typeof x === 'string' ? showText(x) : JSON.stringify(x));
      let chip;
      if (editable) chip = p.kind === 'command' ? 'command' : 'web address';
      else if (!isPlain(raw)) chip = 'edit in the file';
      else if (raw.type === 'http') chip = 'web address';
      else if (raw.type === undefined || raw.type === 'stdio') chip = 'command';
      else chip = asText(raw.type);
      card.append(h('div', { class: 'pt-tool-head' }, h('h3', { text: showText(name) }), h('span', { class: 'pt-chip', text: chip })));
      if (editable) {
        for (const [k, x] of p.extras) card.append(h('p', { class: 'hint' }, h('span', { class: 'mono', text: k + ': ' + JSON.stringify(x) }), ' (edit in the file)'));
        card.append(h('p', { class: 'pt-runs mono', text: p.kind === 'command' ? [showText(p.command), ...p.args.map((x) => showText(x))].join(' ') : showText(p.url) }));
        const rows = p.kind === 'command' ? p.envRows : p.hdrRows;
        if (rows.length) {
          card.append(h('p', { class: 'hint', text: p.kind === 'command' ? 'Settings' : 'Headers' }),
            h('ul', { class: 'pt-rows' }, rows.map((row) => rowLine(row, p.kind === 'command' ? 'env' : 'hdr', myKeys))));
        }
      } else {
        const fields = isPlain(raw) ? Object.entries(raw).map(([k, x]) => showText(k) + ': ' + asText(x)) : [JSON.stringify(raw)];
        card.append(h('div', { class: 'pt-fields-ro' }, fields.map((line) => h('p', { class: 'mono pt-field', text: line }))));
        for (const key of myKeys) card.append(h('p', {}, keyChip(key)));
        card.append(h('p', { class: 'hint', text: "The form can't edit this tool. Edit in the file." }));
      }
      if (isPlain(raw)) {
        card.append(winControl(() => ({ name, type: raw.type, url: raw.url }),
          () => state.windows.has(name),
          (on) => { if (on) state.windows.add(name); else state.windows.delete(name); paintSave(); repaintLines(); }).el);
      }
      for (const s of checks.skip || []) card.append(h('p', { class: 'pt-warn', text: s }));
      // The machine's own key warnings, except "needs" ones, which follow the key status here.
      for (const w of Array.isArray(checks.key_warnings) ? checks.key_warnings : []) {
        if (!NEEDS_RE.test(w)) card.append(h('p', { class: 'pt-warn', text: w }));
      }
      for (const key of myKeys) {
        for (const other of toolsUsingKey(key, name)) card.append(h('p', { class: 'hint', text: 'shared with ' + other + ' (' + key + ')' }));
      }
      for (const key of myKeys) {
        if (!state.keys.includes(key)) card.append(h('p', { class: 'pt-warn', text: 'needs ' + key + ', not set on this machine' }));
      }
      const actions = h('div', { class: 'actions' });
      if (editable) actions.append(button('Edit', () => openForm(name), { 'aria-label': 'Edit ' + name }));
      const confirmHost = h('div', { class: 'pt-confirm', hidden: true });
      const remove = button('Remove', () => {
        confirmHost.hidden = false;
        remove.hidden = true;
        confirmHost.replaceChildren(
          h('p', { text: 'Remove ' + name + '? It goes away when you Save.' }),
          h('div', { class: 'actions' },
            button('Yes, remove ' + name, () => { if (state.loading) return; delete state.tools[name]; delete state.baseName[name]; state.windows.delete(name); if (formState && formState.origName === name) { formState = null; els.form.replaceChildren(); } paintTools(); paintSave(); }, { class: 'danger' }),
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
      if (raw && (!p || unshowable(origName))) return;
      const f = formState = {
        origName, raw, p, refreshers: [], touched: { name: false, command: false, url: false, args: false }, rowsTouched: { env: false, hdr: false }, name: origName || '', kind: p ? p.kind : 'command',
        command: p?.command || '', url: p?.url || '', argsText: (p?.args || []).join('\n'), argsRO: !!p?.argsRO,
        commandRO: !!p?.commandRO, urlRO: !!p?.urlRO,
        envRows: p ? p.envRows : [], hdrRows: p ? p.hdrRows : [],
        winOn: origName !== null && state.windows.has(origName), winTouched: false,
      };
      const err = h('p', { class: 'inline-err', role: 'alert' });
      const showErr = (m) => { err.textContent = m || ''; };

      const nameIn = h('input', { type: 'text', value: f.name, autocomplete: 'off', 'aria-label': 'Name' });
      nameIn.addEventListener('input', () => { f.name = nameIn.value; f.touched.name = true; });
      const kindSel = h('select', { 'aria-label': 'Kind' },
        h('option', { value: 'command', text: 'Command' }), h('option', { value: 'http', text: 'Web address' }));
      kindSel.value = f.kind;
      const commandIn = h('input', { type: 'text', value: f.command, autocomplete: 'off', 'aria-label': 'Command', class: 'mono' });
      commandIn.addEventListener('input', () => { f.command = commandIn.value; f.touched.command = true; });
      const argsIn = h('textarea', { rows: 3, 'aria-label': 'Arguments, one per line', class: 'mono', value: f.argsText });
      argsIn.addEventListener('input', () => { f.argsText = argsIn.value; f.touched.args = true; });
      const urlIn = h('input', { type: 'text', value: f.url, autocomplete: 'off', 'aria-label': 'URL', class: 'mono' });
      urlIn.addEventListener('input', () => { f.url = urlIn.value; f.touched.url = true; });

      const envHost = h('div', { class: 'pt-rowlist' });
      const hdrHost = h('div', { class: 'pt-rowlist' });
      const headerNote = h('p', { class: 'pt-warn', role: 'note', text: HEADER_NOTE, hidden: true });

      function rowEditor(row, rows, kind) {
        if (row.ro) {
          return h('div', { class: 'pt-row ro' },
            h('span', { class: 'mono', text: showText(row.name) + ' = ' + showText(row.raw) }),
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
        const remove = button('Remove', () => { rows.splice(rows.indexOf(row), 1); f.rowsTouched[kind] = true; paintRows(); }, { class: 'small', 'aria-label': 'Remove ' + word.toLowerCase() });
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
        const touch = () => { row.dirty = true; f.rowsTouched[kind] = true; };
        nameField.addEventListener('input', () => { touch(); row.nameTouched = true; row.name = nameField.value; refresh(); });
        modeSel.addEventListener('change', () => { touch(); row.mode = modeSel.value; if (row.mode === 'key' && kind === 'hdr' && row.keyName === undefined) row.keyName = ''; refresh(); });
        valueField.addEventListener('input', () => { touch(); row.value = valueField.value; });
        prefixField.addEventListener('input', () => { touch(); row.prefix = prefixField.value; });
        keyField.addEventListener('input', () => { touch(); row.keyName = keyField.value; refresh(); });
        secretField.addEventListener('input', () => { row.secret = secretField.value; });
        refresh();
        f.refreshers.push(refresh);
        return h('div', { class: 'pt-row' }, nameField, modeSel, valueField, prefixField, keyField, secretField, remove, sharedHint);
      }
      function paintRows() {
        f.refreshers.length = 0;
        envHost.replaceChildren(...f.envRows.map((row) => rowEditor(row, f.envRows, 'env')),
          button('Add a setting', () => { f.envRows.push({ name: '', mode: 'plain', value: '', secret: '' }); f.rowsTouched.env = true; paintRows(); }, { class: 'small' }));
        hdrHost.replaceChildren(...f.hdrRows.map((row) => rowEditor(row, f.hdrRows, 'hdr')),
          button('Add a header', () => { f.hdrRows.push({ name: '', mode: 'plain', value: '', prefix: '', keyName: '', secret: '' }); f.rowsTouched.hdr = true; paintRows(); }, { class: 'small' }));
        headerNote.hidden = !(f.kind === 'http' && f.hdrRows.length > 0);
      }

      const commandBox = h('div', { class: 'pt-fields' },
        f.commandRO
          ? h('div', {}, h('span', { class: 'hint', text: 'Command' }), h('p', { class: 'mono pt-ro', text: showText(f.p.command) }), h('p', { class: 'hint', text: 'edit in the file (kept as is)' }))
          : h('label', {}, h('span', { text: 'Command' }), commandIn),
        f.argsRO
          ? h('div', {}, h('span', { class: 'hint', text: 'Arguments' }), h('p', { class: 'mono pt-ro', text: JSON.stringify(f.p.args) }), h('p', { class: 'hint', text: 'edit in the file (kept as is)' }))
          : h('label', {}, h('span', { text: 'Arguments, one per line' }), argsIn),
        h('div', {}, h('span', { class: 'hint', text: 'Settings (environment)' }), envHost));
      const extrasBox = h('div', { class: 'pt-fields' }, (p?.extras || []).map(([k, v]) =>
        h('p', { class: 'hint' }, h('span', { class: 'mono', text: k + ': ' + JSON.stringify(v) }), ' edit in the file (kept as is)')));
      const httpBox = h('div', { class: 'pt-fields' },
        f.urlRO
          ? h('div', {}, h('span', { class: 'hint', text: 'URL' }), h('p', { class: 'mono pt-ro', text: showText(f.p.url) }), h('p', { class: 'hint', text: 'edit in the file (kept as is)' }))
          : h('label', {}, h('span', { text: 'URL' }), urlIn),
        h('div', {}, h('span', { class: 'hint', text: 'Headers' }), hdrHost, headerNote));
      const formVals = () => ({ name: origName !== null && !f.touched.name ? origName : f.name, type: f.kind === 'http' ? 'http' : 'stdio', url: f.kind === 'http' ? (f.urlRO ? f.p.url : f.url) : '' });
      const formWinOn = () => f.winTouched ? f.winOn : origName !== null && state.windows.has(origName);
      const win = winControl(formVals, formWinOn, (on) => { f.winOn = on; f.winTouched = true; });
      const syncKind = () => { commandBox.hidden = f.kind !== 'command'; httpBox.hidden = f.kind !== 'http'; headerNote.hidden = !(f.kind === 'http' && f.hdrRows.length > 0); win.paint(); };
      urlIn.addEventListener('input', () => win.paint());
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
        // An untouched name is kept exactly as read and not validated; an edited one is refused, not trimmed.
        const name = origName !== null && !f.touched.name ? origName : f.name;
        if (origName === null || f.touched.name) {
          if (!name.trim()) return showErr('Give the tool a name.');
          if (name !== name.trim()) return showErr('The name has a space at the start or end.');
        }
        if (name !== origName && Object.hasOwn(state.tools, name)) return showErr('There is already a tool called ' + name + '.');
        const rows = f.kind === 'command' ? f.envRows : f.hdrRows;
        const rk = f.kind === 'command' ? 'env' : 'hdr';
        const kindNew = !f.p || f.p.kind !== f.kind;
        if (f.kind === 'command' && !f.commandRO && (kindNew || f.touched.command) && !f.command.trim()) return showErr('Enter the command to run.');
        if (f.kind === 'http' && !f.urlRO && (kindNew || f.touched.url) && !f.url.trim()) return showErr('Enter the web address.');
        const seen = new Set(rows.filter((row) => row.ro).map((row) => row.name));
        const isFresh = (row) => row.dirty || row.rawName === undefined;
        for (const row of rows) if (!row.ro && !isFresh(row)) seen.add(row.rawName);
        for (const row of rows) {
          if (row.ro || !isFresh(row)) continue;
          const nm = row.name;
          if (row.nameTouched || row.rawName === undefined) {
            if (!nm.trim()) return showErr('Every ' + (rk === 'env' ? 'setting' : 'header') + ' needs a name.');
            if (nm !== nm.trim()) return showErr(nm + ' has a space at the start or end.');
          }
          if (seen.has(nm)) return showErr(nm + ' is listed twice.');
          seen.add(nm);
          if (row.mode === 'key') {
            const key = (rk === 'env' ? nm : (row.keyName || ''));
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
          const k = key && (rk === 'env' ? row.name : (row.keyName || ''));
          if (k && secret && !state.keys.includes(k)) setOwn(pending, k, secret);
        }
        state.pending = pending;
        // The mark follows a rename; it changes only where the switch is shown.
        const hadMark = origName !== null && state.windows.has(origName);
        const markNow = wsl() && windowsEligible(entry.type, entry.url) ? formWinOn() : hadMark;
        if (origName !== null) state.windows.delete(origName);
        if (markNow) state.windows.add(name); else state.windows.delete(name);
        if (origName !== null && origName !== name) {
          const next = nullObj();
          const nextBase = nullObj();
          for (const [k, v] of Object.entries(state.tools)) {
            setOwn(next, k === origName ? name : k, k === origName ? entry : v);
            const b = own(state.baseName, k);
            if (b !== undefined) setOwn(nextBase, k === origName ? name : k, b);
          }
          state.tools = next;
          state.baseName = nextBase;
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
        commandBox, httpBox, win.el, extrasBox, err,
        h('div', { class: 'actions' },
          h('button', { type: 'submit', class: 'primary', text: origName === null ? 'Add to the list' : 'Keep changes' }),
          button('Cancel', () => { formState = null; els.form.replaceChildren(); }))));
      nameIn.focus();
    }

    // Applies the form's fields onto the original raw entry: fields and rows the user didn't touch
    // are copied as read; touched fields, dirty rows and new rows are built from the form.
    function buildEntry(f, name) {
      void name;
      const e = f.raw ? structuredClone(f.raw) : {};
      const rowsObj = (rows, kind) => {
        const out = nullObj();
        for (const row of rows) {
          if (row.ro) { setOwn(out, row.rawName, row.rawValue); continue; }
          if (row.rawName !== undefined && !row.dirty) { setOwn(out, row.rawName, row.rawValue); continue; }
          if (row.mode === 'key') setOwn(out, row.name, kind === 'env' ? '${' + row.name + '}' : (row.prefix || '') + '${' + (row.keyName || '') + '}');
          else setOwn(out, row.name, row.value);
        }
        return out;
      };
      const kindChanged = !f.p || f.p.kind !== f.kind;
      // A field that ends equal to the original (an empty list or object counts as absent) is
      // written back as read.
      const restore = (field, emptyOk) => {
        if (kindChanged || !f.raw) return;
        const had = Object.prototype.hasOwnProperty.call(f.raw, field);
        const has = Object.prototype.hasOwnProperty.call(e, field);
        const empty = (v) => v === undefined || (Array.isArray(v) ? v.length === 0 : isPlain(v) && Object.keys(v).length === 0);
        const same = emptyOk && empty(had ? f.raw[field] : undefined) && empty(has ? e[field] : undefined)
          ? true : had === has && (!had || deepEqual(e[field], f.raw[field]));
        if (!same) return;
        if (had) e[field] = structuredClone(f.raw[field]); else delete e[field];
      };
      if (f.kind === 'command') {
        if (kindChanged) {
          delete e.url; delete e.headers;
          if (e.type !== undefined && e.type !== 'stdio') delete e.type;
        }
        if (!f.commandRO && (kindChanged || f.touched.command)) e.command = f.command;
        if (!f.argsRO && (kindChanged || f.touched.args)) {
          const args = f.argsText.split('\n').map((s) => s.replace(/\r$/, '')).filter((s) => s !== '');
          if (args.length) e.args = args; else delete e.args;
        }
        if (kindChanged || f.rowsTouched.env) {
          const env = rowsObj(f.envRows, 'env');
          if (Object.keys(env).length) e.env = env; else delete e.env;
        }
        restore('command', false); restore('args', true); restore('env', true);
      } else {
        if (kindChanged) { delete e.command; delete e.args; delete e.env; e.type = 'http'; }
        if (!f.urlRO && (kindChanged || f.touched.url)) e.url = f.url;
        if (kindChanged || f.rowsTouched.hdr) {
          const headers = rowsObj(f.hdrRows, 'hdr');
          if (Object.keys(headers).length) e.headers = headers; else delete e.headers;
        }
        restore('url', false); restore('headers', true);
      }
      return e;
    }

    // ---- saving ------------------------------------------------------------------------

    const marksOf = () => Object.keys(state.tools).filter((n) => state.windows.has(n));
    const isDirty = () => !deepEqual(state.tools, state.sourceTools) ||
      !deepEqual([...marksOf()].sort(), [...state.sourceWindows].sort());

    function paintSave() {
      if (!els.save) return;
      const dirty = isDirty();
      const hasKeys = Object.values(state.pending).some(Boolean);
      const btn = lockBtn('Save', saveTools, { class: 'primary', id: 'pt-save', disabled: !dirty && !hasKeys });
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
      applyLock();
      if (!v && !state.loading) for (const b of container.querySelectorAll('[data-lock]')) b.disabled = false;
      paintSave();
    }

    async function saveTools() {
      if (state.busy || state.loading) return;
      const dirty = isDirty();
      const refs = currentRefs(state.tools);
      const keys = nullObj();
      for (const [k, v] of Object.entries(state.pending)) if (v && refs.has(k)) setOwn(keys, k, v);
      if (!dirty && !Object.keys(keys).length) { setStatus('Nothing to save.'); return; }
      await send(dirty ? { tools: state.tools, windows: marksOf(), keys } : { tools: null, keys });
    }
    async function startOver() {
      if (state.busy || state.loading) return;
      await send({ tools: {}, windows: [], keys: {}, start_over: true });
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
      for (const fn of formState?.refreshers || []) fn();
    }

    async function refreshKeyStatus(c) {
      let status, body;
      try { ({ status, body } = await post('/project-tools/key-status', { machine: c.machine, path: c.path })); }
      catch { return; }
      if (!fresh(c) || status !== 200 || !body || !Number.isInteger(body.key_revision) || !Array.isArray(body.keys) || !Array.isArray(body.key_info) || !Array.isArray(body.folder_tools?.rows)) return;
      if (state.token) state.token.key_revision = body.key_revision;
      state.keys = (body.keys || []).slice();
      state.read.key_info = body.key_info || [];
      const incoming = body.folder_tools?.rows || [];
      for (const row of state.read.folder_tools?.rows || []) {
        const updated = incoming.find(r => r.name === row.name && r.source === row.source);
        if (updated) for (const field of ['keys', 'key_store', 'key_lines', 'key_missing']) {
          if (Object.hasOwn(updated, field)) row[field] = updated[field]; else delete row[field];
        }
      }
      els.paintFolders?.();
      if (els.tools) paintTools();
      for (const fn of formState?.refreshers || []) fn();
    }

    async function send(extra) {
      setBusy(true);
      setStatus('Saving…');
      let out;
      const c = tag();
      try {
        const { status: code, body } = await post('/project-tools/save', { machine: c.machine, path: c.path, token: state.token, ...extra });
        if (!fresh(c)) return false;
        out = await handle(code, body, c, extra.tools === null, Object.keys(extra.keys || {}));
      } finally { setBusy(false); }
      return out;
    }

    function warningsList(w) {
      return Array.isArray(w) && w.length ? h('ul', { class: 'pt-warnings' }, w.map((x) => h('li', { text: String(x) }))) : null;
    }

    // Shows a save or remove reply. Returns true when the keys/tools were stored.
    async function handle(code, body, c, keyOnly = true, writtenKeys = []) {
      const outcome = body && KNOWN_OUTCOMES.includes(body.outcome) ? body.outcome : null;
      if (!outcome) { setStatus(LOST, true); return false; }
      if (outcome === 'saved') {
        const pending = keyOnly ? copyObj(state.pending) : null;
        applyKeys(body);
        if (pending) for (const [name, value] of Object.entries(pending)) if (!writtenKeys.includes(name)) setOwn(state.pending, name, value);
        if (keyOnly) await refreshKeyStatus(c);
        setStatus(['Saved', warningsList(body.warnings)].filter(Boolean));
        paintKeys(); paintSave();
        return true;
      }
      if (outcome === 'removed') {
        const pending = copyObj(state.pending);
        applyKeys(body);
        for (const [name, value] of Object.entries(pending)) setOwn(state.pending, name, value);
        await refreshKeyStatus(c);
        setStatus('Key removed');
        paintKeys(); paintSave();
        return true;
      }
      if (outcome === 'opened') {
        applyKeys(body);
        const link = h('a', { href: body.pr_url, target: '_blank', rel: 'noopener', text: body.pr_url });
        const parts = [h('p', {}, 'Pull request opened: ', link), h('p', { text: 'New threads get the change once it is merged.' }), warningsList(body.warnings)].filter(Boolean);
        return reloadThenShow(parts, parts, false, c);
      }
      if (outcome === 'pr_failed') {
        applyKeys(body);
        const parts = [h('p', { text: 'The change was pushed but the pull request could not be opened: ' + (body.error || 'unknown error') }),
          h('p', {}, 'Branch ' + body.branch + '. ', h('a', { href: body.compare_url, target: '_blank', rel: 'noopener', text: 'Open the pull request yourself' }))];
        await reloadThenShow(parts, parts, true, c);
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
      if (code === 409 && keyOnly) {
        await refreshKeyStatus(c);
        setStatus('changed elsewhere; key status refreshed — try again', true);
      } else if (code === 409) {
        await reloadThenShow([reason + '. The project was reloaded; make your change again.'], [reason + '.'], true, c);
      } else setStatus(reason, true);
      return false;
    }

    // ---- keys --------------------------------------------------------------------------

    function keyRowNames() {
      const set = new Set(state.keys);
      const refs = state.read?.token?.baseline ? Object.keys(state.read.references || {}) : [];
      return [...new Set([...state.keys, ...refs, ...(state.read?.key_info || []).map(k => k.name)])].sort((a, b) => a.localeCompare(b)).map((n) => [n, set.has(n)]);
    }

    function keyUsage(name) {
      const users = [...new Set([...(own(state.read.references, name) || []), ...((state.read.key_info || []).find(k => k.name === name)?.tools || [])])];
      return users.length ? 'used by ' + users.join(', ') : state.read?.token?.baseline ? 'not used on main' : 'unknown';
    }

    function paintKeys() {
      if (!els.keys) return;
      const rows = keyRowNames();
      const list = h('div', { class: 'pt-keylist' }, rows.map(([name, isSet]) => keyRow(name, isSet)));
      const newName = h('input', { type: 'text', autocomplete: 'off', 'aria-label': 'New key name', placeholder: 'Key name' });
      const newValue = h('input', { type: 'password', autocomplete: 'off', 'aria-label': 'New key value', placeholder: 'Value' });
      const addErr = h('p', { class: 'inline-err', role: 'alert' });
      const add = lockBtn('Add a key', async () => {
        addErr.textContent = '';
        const name = newName.value;
        const bad = name !== name.trim() ? 'The name has a space at the start or end.' : keyNameProblem(name);
        if (bad) { addErr.textContent = bad; return; }
        if (!newValue.value) { addErr.textContent = 'Enter a value.'; return; }
        if (await setKey(name, newValue.value)) { newName.value = ''; newValue.value = ''; }
      });
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
      const setBtn = lockBtn(isSet ? 'Replace' : 'Set', async () => {
        err.textContent = '';
        if (!value.value) { err.textContent = 'Enter a value.'; return; }
        if (await setKey(name, value.value)) value.value = '';
      }, { 'aria-label': 'Set ' + name });
      const rm = isSet ? lockBtn('Remove', () => {
        const users = [...new Set([...(own(state.read?.references, name) || []), ...((state.read?.key_info || []).find(k => k.name === name)?.tools || [])])];
        rm.hidden = true;
        confirmHost.hidden = false;
        confirmHost.replaceChildren(
          h('p', { text: 'Remove ' + name + '? ' + (users.length ? (state.read?.token?.baseline ? 'Tools on main using it: ' : 'Tools using it: ') + users.join(', ') + '. ' : state.read?.token?.baseline ? 'No tools on main use it. ' : '') + 'Waiting pull requests may need it too.' }),
          h('div', { class: 'actions' },
            lockBtn('Yes, remove ' + name, async () => {
              setBusy(true); setStatus('Removing…');
              const c = tag();
              try {
                const { status: code, body } = await post('/project-tools/remove-key', { machine: c.machine, path: c.path, token: state.token, name });
                if (!fresh(c)) return;
                await handle(code, body, c);
              } finally { setBusy(false); }
            }, { class: 'danger' }),
            button('Cancel', () => { confirmHost.hidden = true; rm.hidden = false; })));
      }, { 'aria-label': 'Remove ' + name }) : null;
      return h('div', { class: 'pt-key', 'data-key': name },
        h('div', { class: 'pt-key-head' }, h('span', { class: 'mono', text: name }),
          h('span', { class: 'pt-chip ' + (isSet ? 'set' : 'unset'), text: isSet ? 'set' : 'not set' }),
          h('span', { class: 'hint', text: keyUsage(name) })),
        (state.read?.key_info || []).find(k => k.name === name && k.stored && k.folder_usable === false) && h('p', { class: 'pt-warn', text: "can't be used by folder tools: " + (state.read.key_info.find(k => k.name === name).reason || '') }),
        h('div', { class: 'pt-key-ctl' }, value, setBtn, rm), err, confirmHost);
    }

    loadPicker('hub');
  }

  window.ProjectTools = { render, windowsEligible, WINDOWS_URL };
})();
