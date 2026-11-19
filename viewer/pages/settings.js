'use strict';

// The Settings page: Models and preferences, Behavior templates, Writing style. Everything
// reads from and writes to the hub's /settings routes (viewer/app/API.md); the page keeps no
// copy of its own beyond the unsaved editor drafts.
(() => {
  const API = '/wheelchair/api';
  const SECTIONS = [['accounts', 'Accounts'], ['usage', 'Usage'], ['models', 'Models and preferences'], ['templates', 'Behavior templates'], ['writing', 'Writing style'], ['tools', 'Project tools']];
  const TIERS = [
    ['light', 'Light', 'Spelled-out changes, few files'],
    ['standard', 'Standard', 'Most building'],
    ['heavy', 'Heavy', 'Leading, planning, review, checking'],
    ['critical', 'Critical', "Can't afford to get wrong"],
  ];
  const PROVIDERS = [['claude', 'Claude', 'Claude Code'], ['gpt', 'GPT', 'Codex'], ['gemini', 'Antigravity', 'Antigravity CLI'], ['kimi', 'Kimi Code', 'Kimi CLI']];
  const EFFORTS = { claude: ['low', 'medium', 'high', 'xhigh', 'max'], gpt: ['low', 'medium', 'high', 'xhigh'], gemini: ['low', 'medium', 'high', 'xhigh', 'max'] };
  const MODEL_VALUE = /^[a-z0-9][a-z0-9._-]*$/;
  const KIMI_MODEL_VALUE = /^[a-z0-9][a-z0-9._-]{0,63}(\/[a-z0-9][a-z0-9._-]{0,63})?$/;
  const NONE = '__none';
  const OTHER = '__other';
  const ROLES = [
    ['lead', 'Lead', 'Lead', 'leads', 'lead'],
    ['sub-lead', 'Sub-lead', 'Sub-lead', 'sub-leads', 'sub-lead'],
    ['worker', 'Worker', 'Workers', 'workers', 'worker'],
    ['reviewer', 'Reviewer', 'Reviewers', 'reviewers', 'reviewer'],
    ['verifier', 'Checker', 'Checker', 'checkers', 'checker'],
    ['mapper', 'Mapper', 'Mapper', 'mappers', 'mapper'],
  ];
  const roleInfo = (role) => ROLES.find((r) => r[0] === role) || ROLES[2];
  const SAVED = 'Saved, applies to new sessions';

  let data = null;
  let section = 'models';
  let note = { text: '', bad: false };
  let selected = null; // a template id, or 'new'
  let draft = null;
  let confirming = false;
  let fullPrompt = null; // {text} | {error}
  let styleDraft = null;
  let preview = { running: false, after: null, error: '' };
  let styleNote = '';
  let diagram = null; // GET /settings/diagram-sensitivity, or null until read for this visit
  let diagramLoading = false;
  let folderDraft = null; // the typed Default project folder, kept across re-renders until saved
  // Lead name saves, kept across re-renders: they run one after another in the order made,
  // `choice` is the list last picked in the dropdown, which a save's answer never undoes, and
  // `reads` counts file picks so only the newest file is saved.
  const leadSaves = { queue: Promise.resolve(), latest: 0, choice: null, reads: 0 };
  const panel = document.getElementById('panel');

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

  async function api(route, options = {}) {
    const init = { method: options.method || 'GET', headers: {} };
    if (options.body !== undefined) { init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(options.body); }
    let res;
    try { res = await fetch(API + route, init); } catch { throw new Error('Could not reach the hub.'); }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const failure = new Error(body.detail || body.error || body.message || ('http ' + res.status));
      failure.status = res.status;
      failure.body = body;
      throw failure;
    }
    return body;
  }

  function setNote(text, bad) {
    note = { text: text || '', bad: !!bad };
    for (const el of document.querySelectorAll('.note[data-for="section"]')) {
      el.textContent = note.text;
      el.classList.toggle('bad', note.bad);
    }
  }
  const noteEl = () => h('p', { class: 'note' + (note.bad ? ' bad' : ''), 'data-for': 'section', role: 'status', text: note.text });

  function inlineErr(host, message) {
    let err = host.querySelector(':scope > .inline-err');
    if (!message) { if (err) err.remove(); return; }
    if (!err) { err = h('p', { class: 'inline-err', role: 'alert' }); host.append(err); }
    err.textContent = message;
  }

  // ---------------------------------------------------------------- Diagrams

  const DIAGRAM_CHOICES = [
    ['ask', 'Ask', 'Only when you ask, or a lead draws a proposed flow'],
    ['default', 'Default', 'When the arrangement is the answer'],
    ['high', 'High', 'Whenever there is a shape'],
  ];

  // A level is selected only when every machine answered and each machine's level is non-null
  // and the same. Otherwise `lines` says what each machine holds.
  function diagramView() {
    const machines = diagram && diagram.machines ? diagram.machines : {};
    const names = Object.keys(machines);
    const shown = (level) => (level || 'none');
    const lines = names.map((name) => {
      const m = machines[name];
      if (m.error) return `${name}: ${m.error}`;
      if (m.level) return `${name}: ${m.level}`;
      const files = (m.files || []).map((f) => `${f.harness} ${shown(f.level)}`).join(', ');
      return `${name}: its CLIs' files disagree (${files})`;
    });
    const levels = names.map((name) => machines[name].level);
    const agreed = names.length && levels.every((l) => l && l === levels[0]) ? levels[0] : null;
    return { agreed, lines };
  }

  function drawDiagram() {
    const box = document.getElementById('diagram-choices');
    if (!box) return;
    if (!diagram) { box.replaceChildren(h('span', { class: 'hint', text: 'Reading each machine\u2026' })); return; }
    const { agreed, lines } = diagramView();
    box.replaceChildren(
      h('div', { class: 'diagram-radios', role: 'radiogroup', 'aria-label': 'Diagram sensitivity' },
        DIAGRAM_CHOICES.map(([value, name, line]) => h('button', {
          type: 'button', class: 'choice', role: 'radio', 'aria-checked': String(agreed === value),
          onclick: () => saveDiagram(value),
        }, h('span', { class: 'choice-name', text: name }), h('span', { class: 'hint', text: line })))),
      ...(agreed ? [] : [h('p', { class: 'note diagram-lines', role: 'status' }, lines.map((line, i) => [i ? h('br') : null, line]))]));
  }

  async function loadDiagram() {
    diagramLoading = true;
    try { diagram = await api('/settings/diagram-sensitivity'); }
    catch (e) { diagram = { machines: { hub: { error: e.message } } }; }
    diagramLoading = false;
    drawDiagram();
  }

  async function saveDiagram(level) {
    let failure = null;
    try {
      await api('/settings/diagram-sensitivity', { method: 'POST', body: { level } });
      setNote("Applies from each agent's next session", false);
    } catch (e) {
      const machines = e.body && e.body.machines;
      const failed = machines ? Object.entries(machines).filter(([, m]) => m.error).map(([name, m]) => `${name}: ${m.error}`) : [];
      failure = failed.length ? failed.join('\n') : e.message;
      setNote(failure, true);
    }
    await loadDiagram();
  }

  // ---------------------------------------------------------------- Models and preferences

  function optionList(provider, current, { allowNone }) {
    const list = (data.model_options[provider] || []).map((o) => ({ value: o.value, label: o.label }));
    if (current && !list.some((o) => o.value === current)) list.push({ value: current, label: current });
    if (allowNone) list.push({ value: NONE, label: 'Not used' });
    list.push({ value: OTHER, label: 'Other…' });
    return list;
  }

  // One model picker for a provider and slot. A change saves at once; a refusal shows its
  // reason under the control and puts the control back.
  function modelPicker(provider, slot, { allowNone, withEffort }) {
    const cell = data.models[provider] && data.models[provider][slot];
    const current = cell ? cell.model : null;
    const effort = cell && cell.effort ? cell.effort : '';
    const wrap = h('div', { class: 'cell' });
    const label = `${PROVIDER_NAME[provider]} ${slot} model`;
    const select = h('select', { 'aria-label': label, class: provider === 'claude' ? '' : 'mono' },
      optionList(provider, current, { allowNone }).map((o) => h('option', { value: o.value, text: o.label })));
    select.value = current || NONE;
    wrap.append(select);
    let effortSelect = null;

    async function commit(model, newEffort) {
      const body = { provider, slot, model };
      if (model && newEffort) body.effort = newEffort;
      try {
        const res = await api('/settings/models', { method: 'PUT', body });
        data.models = res.models;
        inlineErr(wrap, '');
        renderPanel();
        setNote(SAVED, false);
      } catch (e) {
        select.value = current || NONE;
        if (effortSelect) effortSelect.value = effort;
        wrap.querySelector('.other')?.remove();
        inlineErr(wrap, e.message);
        setNote('', false);
      }
    }

    select.addEventListener('change', () => {
      if (select.value === OTHER) { openOther(); return; }
      wrap.querySelector('.other')?.remove();
      commit(select.value === NONE ? null : select.value, effort);
    });

    function openOther() {
      if (wrap.querySelector('.other')) return;
      const input = h('input', { type: 'text', 'aria-label': `${label}, other`, placeholder: 'model-name', autocomplete: 'off', spellcheck: false });
      const use = h('button', { type: 'button', class: 'small', text: 'Use' });
      const row = h('div', { class: 'other' }, input, use);
      const go = () => {
        const value = input.value.trim();
        if (!(provider === 'kimi' ? KIMI_MODEL_VALUE : MODEL_VALUE).test(value)) {
          inlineErr(wrap, 'Use lowercase letters, digits, dots, dashes and underscores, starting with a letter or digit.');
          return;
        }
        commit(value, effort);
      };
      use.addEventListener('click', go);
      input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); go(); } });
      select.after(row);
      input.focus();
    }

    if (withEffort) {
      effortSelect = h('select', { class: 'effort', 'aria-label': `${PROVIDER_NAME[provider]} ${slot} effort` },
        h('option', { value: '', text: 'CLI default' }),
        EFFORTS[provider].map((e) => h('option', { value: e, text: e })));
      effortSelect.value = effort;
      effortSelect.disabled = !current;
      effortSelect.addEventListener('change', () => commit(current, effortSelect.value));
      wrap.append(effortSelect);
    }
    return wrap;
  }

  async function headsUpAction(body, host) {
    try {
      const res = await api('/settings/models/heads-up', { method: 'POST', body });
      data.models = res.models;
      data.heads_up = res.heads_up;
      renderPanel();
    } catch (e) { inlineErr(host, e.message); }
  }

  function headsUpLine(item) {
    const line = h('div', { class: 'hu', 'data-kind': item.kind });
    const actions = h('div', { class: 'hu-actions' });
    let text;
    if (item.kind === 'malformed') {
      text = "The models file couldn't be read, so the shipped defaults are showing.";
      actions.append(h('button', { type: 'button', class: 'small', text: 'Reset to defaults', onclick: () => headsUpAction({ action: 'reset' }, line) }));
    } else if (item.kind === 'tierless') {
      text = `${item.model} is available but fits no tier.`;
      actions.append(h('button', { type: 'button', class: 'small', text: 'Skip', onclick: () => headsUpAction({ action: 'skip', model: item.model }, line) }));
    } else {
      text = `${item.kind === 'newer' ? 'Newer model' : 'New model'}: ${item.model}`;
      actions.append(
        h('button', { type: 'button', class: 'small primary', text: 'Switch', onclick: () => headsUpAction({ action: 'switch', tier: item.tier, model: item.model }, line) }),
        h('button', { type: 'button', class: 'small', text: 'Skip', onclick: () => headsUpAction({ action: 'skip', model: item.model }, line) }));
    }
    line.append(h('span', { class: 'msg', text: text }), actions);
    return line;
  }

  function otherAgentRow(key, title, hint) {
    const select = h('select', { 'aria-label': title },
      TIERS.map(([value, label]) => h('option', { value, text: label })));
    select.value = data.other_agents[key];
    select.addEventListener('change', async () => {
      const row = select.closest('.row-line');
      try {
        const res = await api('/settings/preferences', { method: 'PUT', body: { other_agents: { [key]: select.value } } });
        data.other_agents = res.other_agents;
        inlineErr(row, '');
        setNote(SAVED, false);
      } catch (e) {
        select.value = data.other_agents[key];
        inlineErr(row, e.message);
        setNote('', false);
      }
    });
    return h('div', { class: 'row-line' },
      h('div', { class: 'what' }, h('span', { text: title }), h('span', { class: 'hint', text: hint })),
      h('div', { class: 'ctl' }, select));
  }

  // Lead names: a built-in list, or a custom one uploaded as a text file (one name per
  // line, or comma separated). Choosing Custom saves only once a file has names in it.
  const NAME_LISTS = [['greek', 'Greek letters'], ['nato', 'NATO alphabet'], ['stars', 'Star names'], ['people', 'Popular first names'], ['custom', 'Custom list']];
  // Splits an uploaded file into names: one per line or comma separated, with CSV quoting
  // ("Grace, Jr." stays one name, and "" inside quotes is a literal quote).
  function nameFields(text) {
    const fields = [];
    let field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') quoted = false;
        else field += c;
      } else if (c === '"' && !field.trim()) { field = ''; quoted = true; }
      else if (c === ',' || c === '\n' || c === '\r') { fields.push(field); field = ''; }
      else field += c;
    }
    fields.push(field);
    return fields;
  }

  function leadNamesRow() {
    const select = h('select', { id: 'lead-names', 'aria-label': 'Lead names' }, NAME_LISTS.map(([value, label]) => h('option', { value, text: label })));
    select.value = leadSaves.choice || data.lead_name_list || 'greek';
    const file = h('input', { type: 'file', id: 'lead-names-file', 'aria-label': 'Upload lead names', accept: '.txt,.csv,text/plain,text/csv' });
    const status = h('p', { class: 'note', role: 'status' });
    const custom = h('div', { class: 'lead-names-custom' }, file, status);
    const host = h('div', { class: 'ctl wide' }, select, custom);
    select.addEventListener('change', () => {
      leadSaves.choice = select.value;
      showLeadNames();
      if (select.value === 'custom' && !(data.lead_names || []).length) return;
      saveLeadNames({ lead_name_list: select.value });
    });
    file.addEventListener('change', async () => {
      const chosen = file.files && file.files[0];
      if (!chosen) return;
      const read = ++leadSaves.reads;
      const text = await chosen.text();
      file.value = '';
      if (read !== leadSaves.reads || (leadSaves.choice || data.lead_name_list) !== 'custom') return;
      const seen = new Set(), names = [];
      for (const raw of nameFields(text)) {
        const name = raw.trim();
        if (name && !seen.has(name.toLowerCase())) { seen.add(name.toLowerCase()); names.push(name); }
      }
      if (!names.length) { leadNamesError('That file has no names in it.'); return; }
      if (await saveLeadNames({ lead_names: names, lead_name_list: 'custom' })) { const note = document.querySelector('.lead-names-custom .note'); if (note) note.textContent = `Saved. ${leadNamesSummary()}`; }
    });
    custom.hidden = select.value !== 'custom'; status.textContent = leadNamesSummary();
    return h('div', { class: 'row-line' }, h('div', { class: 'what' }, h('label', { for: 'lead-names', text: 'Lead names' }), h('span', { class: 'hint', text: 'New leads only.' })), host);
  }

  function leadNamesSummary() {
    const names = data.lead_names || [];
    if (!names.length) return 'Upload a text file with one name per line.';
    const shown = names.slice(0, 5).join(', ');
    return `${names.length} name${names.length === 1 ? '' : 's'}: ${shown}${names.length > 5 ? ', …' : ''}`;
  }

  // The row may have been drawn again since a save started, so these find it in the page.
  function showLeadNames() {
    const select = document.getElementById('lead-names');
    if (!select) return;
    select.value = leadSaves.choice || data.lead_name_list || 'greek';
    const custom = document.querySelector('.lead-names-custom');
    custom.hidden = select.value !== 'custom';
    custom.querySelector('.note').textContent = leadNamesSummary();
  }
  function leadNamesError(message) {
    const host = document.getElementById('lead-names')?.closest('.ctl');
    if (host) inlineErr(host, message);
  }

  function saveLeadNames(body) {
    const ticket = ++leadSaves.latest;
    leadNamesError('');
    const run = leadSaves.queue.then(async () => {
      let ok = true;
      try {
        const result = await api('/settings/preferences', { method: 'PUT', body });
        data.lead_name_list = result.lead_name_list; data.lead_names = result.lead_names;
      } catch (error) {
        ok = false;
        if (ticket === leadSaves.latest) leadNamesError(error.message);
      }
      if (ticket !== leadSaves.latest) return false;
      settleLeadChoice(ok);
      return ok;
    });
    leadSaves.queue = run;
    return run;
  }

  // Once the newest save is answered, line the saved list up with the dropdown: a pick of
  // Custom made while names were still missing is saved now that names exist, or kept
  // waiting for a file; a failed pick of another list falls back to the saved one.
  function settleLeadChoice(ok) {
    const choice = leadSaves.choice;
    if (choice === 'custom' && choice !== data.lead_name_list) {
      if ((data.lead_names || []).length && ok) { saveLeadNames({ lead_name_list: 'custom' }); return; }
    } else leadSaves.choice = null;
    showLeadNames();
  }

  // The Default project folder: typed, then saved with the button. A refusal shows under the
  // input and the typed value stays.
  function folderRow() {
    const saved = data.default_project_folder || '';
    const input = h('input', { type: 'text', id: 'default-folder', 'aria-label': 'Default project folder', placeholder: '~/projects', autocomplete: 'off', spellcheck: false, value: folderDraft === null ? saved : folderDraft });
    const save = h('button', { type: 'button', text: 'Save' });
    const status = h('p', { class: 'note', role: 'status' });
    const host = h('div', { class: 'ctl wide' }, h('div', { class: 'folder' }, input, save), status);
    input.addEventListener('input', () => { folderDraft = input.value; status.textContent = ''; inlineErr(host, ''); });
    const go = async () => {
      save.disabled = true;
      inlineErr(host, '');
      status.textContent = '';
      try {
        const res = await api('/settings/preferences', { method: 'PUT', body: { default_project_folder: input.value.trim() } });
        data.default_project_folder = res.default_project_folder || '';
        folderDraft = null;
        input.value = data.default_project_folder;
        status.textContent = 'Saved';
      } catch (e) { inlineErr(host, e.message); }
      save.disabled = false;
    };
    save.addEventListener('click', go);
    input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); go(); } });
    return h('div', { class: 'row-line' },
      h('div', { class: 'what' }, h('span', { text: 'Default project folder' }), h('span', { class: 'hint', text: "Each git repository inside it can be picked when starting a thread. ~ is each machine's home folder." })),
      host);
  }

  function renderModels() {
    const items = (data.heads_up || []).slice();
    if (data.models.malformed && !items.some((i) => i.kind === 'malformed')) items.unshift({ kind: 'malformed' });
    const lines = items.filter((i) => i.kind === 'malformed' || i.kind === 'tierless').map(headsUpLine);
    const tierItems = (tier) => items.filter((i) => i.tier === tier && (i.kind === 'newer' || i.kind === 'available'));

    const head = h('tr', {}, h('th', { scope: 'col', text: 'Provider' }),
      TIERS.map(([, label, desc]) => h('th', { scope: 'col' }, h('span', { class: 'tier-name', text: label }), h('span', { class: 'tier-desc', text: desc }))));
    const body = PROVIDERS.map(([provider, name, cli]) => h('tr', { class: provider === 'gpt' ? 'gpt' : '', 'data-provider': provider },
      h('th', { scope: 'row' }, h('span', { class: 'prov', text: name }), h('span', { class: 'prov-sub', text: cli })),
      TIERS.map(([slot, label]) => {
        const td = h('td', { 'data-label': label }, modelPicker(provider, slot, { allowNone: true, withEffort: Boolean(EFFORTS[provider]) }));
        if (provider === 'gpt') for (const item of tierItems(slot)) td.append(headsUpLine(item));
        return td;
      })));
    const table = h('table', { class: 'tiers' }, h('thead', {}, head), h('tbody', {}, body));

    // One segmented choice per CLI; each saves its own key through the preferences route.
    const modeGroup = (key, label, choices) => {
      const group = h('div', { class: 'seg-radio', role: 'radiogroup', 'aria-label': label },
        choices.map(([value, text]) => h('button', {
          type: 'button', role: 'radio', 'aria-checked': String(data[key] === value), text,
          onclick: async () => {
            if (data[key] === value) return;
            const row = group.closest('.row-line');
            try {
              const res = await api('/settings/preferences', { method: 'PUT', body: { [key]: value } });
              data[key] = res[key];
              inlineErr(row, '');
              renderPanel();
              setNote(SAVED, false);
            } catch (e) { inlineErr(row, e.message); setNote('', false); }
          },
        })));
      return group;
    };
    // The same segmented control, saving one key inside `escalation`.
    const escalationGroup = (key, label, choices) => {
      const group = h('div', { class: 'seg-radio', role: 'radiogroup', 'aria-label': label },
        choices.map(([value, text]) => h('button', {
          type: 'button', role: 'radio', 'aria-checked': String(data.escalation[key] === value), text,
          onclick: async () => {
            if (data.escalation[key] === value) return;
            const row = group.closest('.row-line');
            try {
              const res = await api('/settings/preferences', { method: 'PUT', body: { escalation: { [key]: value } } });
              data.escalation = res.escalation;
              data.escalation_text = res.escalation_text;
              inlineErr(row, '');
              renderPanel();
              setNote(SAVED, false);
            } catch (e) { inlineErr(row, e.message); setNote('', false); }
          },
        })));
      return group;
    };
    const escRow = (title, key, choices) => h('div', { class: 'row-line' },
      h('div', { class: 'what' }, h('span', { text: title })),
      escalationGroup(key, title, choices));
    const claudeMode = modeGroup('permission_mode', 'Claude, Antigravity and Kimi permission mode', [['auto', 'Auto'], ['bypass', 'Bypass']]);
    const codexMode = modeGroup('codex_mode', 'Codex permission mode', [['sandboxed', 'Sandboxed'], ['unrestricted', 'Unrestricted']]);
    const asideMode = modeGroup('aside_access', 'Aside access', [['read-only', 'Read-only'], ['full', 'Full']]);
    const asideHint = data.aside_access === 'full'
      ? 'Never asks, no sandbox: an aside can read anywhere, run commands and change files.'
      : 'Reads files in the thread\'s worktree only. Runs no commands.';
    const codexHint = data.codex_mode === 'unrestricted'
      ? 'Never asks, no sandbox: it can change anything on the machine. Reviewers stay read-only.'
      : 'Never asks: it can write only inside its worktree.';

    return h('div', { class: 'models' },
      h('div', {},
        h('h1', { text: 'Models and preferences' }),
        h('p', { class: 'lede', text: 'Who runs what.' }),
        noteEl()),
      h('section', { 'aria-labelledby': 'tiers' },
        h('h2', { id: 'tiers', text: 'Tiers' }),
        lines,
        h('div', { class: 'box' }, table),
        h('span', { class: 'hint', text: '"Not used" means that provider can\'t be started at that tier. Effort is how hard the model thinks; "CLI default" leaves it to the CLI.' })),
      h('section', { 'aria-labelledby': 'leads' },
        h('h2', { id: 'leads', text: 'Leads' }),
        h('div', { class: 'box rows' },
          PROVIDERS.flatMap(([provider, name]) => [['lead', 'Leads run on'], ['sub-lead', 'Sub-leads run on']].map(([slot, title]) => h('div', { class: 'row-line' },
            h('div', { class: 'what' }, h('span', { text: title }), h('span', { class: 'hint', text: `${name} model` })),
            h('div', { class: 'ctl wide' }, modelPicker(provider, slot, { allowNone: false, withEffort: Boolean(EFFORTS[provider]) })))))
          .concat([leadOrderRow(), leadNamesRow()]))),
      h('section', { 'aria-labelledby': 'escalation' },
        h('h2', { id: 'escalation', text: 'Escalation' }),
        h('div', { class: 'escalation-text' },
          String(data.escalation_text || '').split('\n').filter(Boolean).map((line) => h('p', { text: line }))),
        h('div', { class: 'box rows' },
          escRow('What steps up first', 'first', [['effort', 'Effort'], ['model', 'Model']]),
          escRow('Highest effort', 'max_effort', [['high', 'High'], ['xhigh', 'xhigh'], ['max', 'Max']]),
          escRow('Highest tier', 'max_tier', [['standard', 'Standard'], ['heavy', 'Heavy'], ['critical', 'Critical']]),
          escRow('Ask me before', 'ask_before', [['never', 'Never'], ['critical', 'Critical'], ['any', 'Any step up']])),
        h('span', { class: 'hint', text: 'The build follows these when a worker comes back wrong. Applies to builds started afterwards.' })),
      h('section', { 'aria-labelledby': 'perm' },
        h('h2', { id: 'perm', text: 'Permission mode' }),
        h('div', { class: 'box rows' },
          h('div', { class: 'row-line' },
            h('div', { class: 'what' }, h('span', { text: 'Claude, Antigravity and Kimi sessions' })),
            claudeMode),
          h('div', { class: 'row-line' },
            h('div', { class: 'what' }, h('span', { text: 'Codex sessions' }), h('span', { class: 'hint', text: codexHint })),
            codexMode),
          h('div', { class: 'row-line' },
            h('div', { class: 'what' }, h('span', { text: 'Asides' }), h('span', { class: 'hint', text: asideHint })),
            asideMode))),
      h('section', { 'aria-labelledby': 'thread-view' },
        h('h2', { id: 'thread-view', text: 'Threads' }),
        h('div', { class: 'box rows' },
          h('div', { class: 'row-line' },
            h('div', { class: 'what' }, h('span', { text: 'Tool steps' }), h('span', { class: 'hint', text: data.tool_steps === 'hide' ? 'Hidden: a thread shows only messages and cards.' : 'Commands and file reads show as folded lines between messages.' })),
            modeGroup('tool_steps', 'Tool steps', [['show', 'Show'], ['hide', 'Hide']])),
          folderRow())),
      h('section', { 'aria-labelledby': 'diagrams' },
        h('h2', { id: 'diagrams', text: 'Diagrams' }),
        h('div', { class: 'box', id: 'diagram-choices' })),
      h('section', { 'aria-labelledby': 'others' },
        h('h2', { id: 'others', text: 'Other agents' }),
        h('div', { class: 'box rows' },
          h('div', { class: 'row-line' },
            h('div', { class: 'what' }, h('span', { text: 'Reviewers and checkers' }), h('span', { class: 'hint', text: data.review_families === 'both' ? 'Plan reviewers from two different families; the checker from a family other than the builder\'s.' : `One plan reviewer and the checker, both on ${PROVIDER_NAME[data.review_families]}.` })),
            modeGroup('review_families', 'Reviewers and checkers', [['both', 'Mix families'], ['claude', 'Claude'], ['gpt', 'GPT'], ['gemini', 'Antigravity'], ['kimi', 'Kimi Code']])),
          otherAgentRow('reviewer', 'Plan reviewers', 'Model tier for plan reviewers'),
          otherAgentRow('verifier', 'Checker', 'Model tier for the checker'),
          otherAgentRow('mapper', 'Code mapping', 'Maps how the existing code works before planning'),
          otherAgentRow('scout', 'Scout', 'Reads code for leads and sub-leads and reports back'),
          otherAgentRow('scout-heavy', 'Scout for bigger changes', 'Checks worker changes of 200 to 800 lines for the sub-lead')),
        h('span', { class: 'hint', text: 'For threads in the app. Terminal commands keep their own rules.' })));
  }

  // ---------------------------------------------------------------- Behavior templates

  function projectLabel(path) {
    const base = path.split('/').filter(Boolean).pop() || path;
    const clash = data.projects.filter((p) => (p.split('/').filter(Boolean).pop() || p) === base).length > 1;
    return (clash ? path : base) + ' only';
  }

  function blankDraft() {
    return { id: null, name: '', role: 'worker', scope: 'all', switches: { save_every_step: false, full_tests_before_done: false, packages: 'ask', unsettled: 'ask' }, text: '', in_use: false, live_sessions: 0 };
  }

  function select(id) {
    selected = id;
    confirming = false;
    fullPrompt = null;
    const found = data.templates.find((t) => t.id === id);
    draft = found ? structuredClone(found) : blankDraft();
    if (found && !draft.switches) draft.switches = {};
  }

  function templateBody() {
    const s = draft.switches || {};
    const switches = {};
    if (typeof s.save_every_step === 'boolean') switches.save_every_step = s.save_every_step;
    if (typeof s.full_tests_before_done === 'boolean') switches.full_tests_before_done = s.full_tests_before_done;
    if (s.packages) switches.packages = s.packages;
    if (draft.role === 'worker' && s.unsettled) switches.unsettled = s.unsettled;
    if (Number.isInteger(s.file_limit) && s.file_limit >= 1) switches.file_limit = s.file_limit;
    return { name: draft.name.trim(), role: draft.role, scope: draft.scope, switches, text: draft.text };
  }

  async function reload(keep) {
    data = await api('/settings');
    if (keep) {
      const fresh = data.templates.find((t) => t.id === selected);
      if (fresh && draft) { draft.in_use = fresh.in_use; draft.live_sessions = fresh.live_sessions; }
    }
  }

  async function saveTemplate(errHost) {
    const body = templateBody();
    if (!body.name) { inlineErr(errHost, 'Give the template a name.'); return; }
    try {
      let saved;
      if (draft.id) saved = await api('/settings/templates/' + encodeURIComponent(draft.id), { method: 'PUT', body });
      else saved = await api('/settings/templates', { method: 'POST', body });
      await reload(false);
      select(saved.id);
      renderPanel();
      setNote('Saved. Changes apply to agents started after you save.', false);
    } catch (e) { inlineErr(errHost, e.message); setNote('', false); }
  }

  async function duplicateTemplate(errHost) {
    const body = templateBody();
    body.name = (body.name || 'Untitled') + ' copy';
    try {
      const saved = await api('/settings/templates', { method: 'POST', body });
      await reload(false);
      select(saved.id);
      renderPanel();
      setNote('Duplicated.', false);
    } catch (e) { inlineErr(errHost, e.message); }
  }

  async function deleteTemplate(errHost) {
    try {
      await api('/settings/templates/' + encodeURIComponent(draft.id), { method: 'DELETE' });
      await reload(false);
      select(data.templates[0] ? data.templates[0].id : 'new');
      renderPanel();
      setNote('Deleted.', false);
    } catch (e) { inlineErr(errHost, e.message); }
  }

  async function toggleInUse(errHost) {
    try {
      await api('/settings/templates/' + encodeURIComponent(draft.id), { method: 'PUT', body: { in_use: !draft.in_use } });
      await reload(true);
      renderPanel();
      setNote(draft.in_use ? 'In use for new sessions.' : 'No longer in use.', false);
    } catch (e) { inlineErr(errHost, e.message); }
  }

  async function seeInFull(box) {
    const params = new URLSearchParams({ role: draft.role });
    if (draft.scope !== 'all') params.set('project', draft.scope);
    try { fullPrompt = { text: (await api('/settings/prompt?' + params)).text }; }
    catch (e) { fullPrompt = { error: e.message }; }
    (box.closest('.full-prompt-wrap') || box).replaceWith(promptBox());
  }

  function promptBox() {
    if (!fullPrompt) return h('div', { id: 'full-prompt', hidden: true });
    if (fullPrompt.error) return h('p', { id: 'full-prompt', class: 'inline-err', role: 'alert', text: fullPrompt.error });
    return h('div', { class: 'full-prompt-wrap' },
      h('pre', { id: 'full-prompt', class: 'full', text: fullPrompt.text }),
      h('span', { class: 'hint', id: 'full-prompt-caption', text: 'Claude gets this as its starting instructions; GPT, Antigravity and Kimi Code sessions get it as a file, through a short first message that points to it.' }));
  }

  function switchRow(title, hint, control) {
    return h('div', { class: 'row-line' },
      h('div', { class: 'what' }, h('span', { text: title }), h('span', { class: 'hint', text: hint })),
      control);
  }

  function renderEditor() {
    const role = roleInfo(draft.role);
    const worker = draft.role === 'worker';
    const errHost = h('div', {});
    const sw = draft.switches;

    const name = h('input', { id: 'tname', type: 'text', value: draft.name, maxLength: 200, placeholder: 'Name this template' });
    const roleSel = h('select', { id: 'trole' }, ROLES.map(([value, , plural]) => h('option', { value, text: plural })));
    roleSel.value = draft.role;
    roleSel.addEventListener('change', () => {
      draft.role = roleSel.value;
      if (draft.role !== 'worker') delete draft.switches.unsettled;
      else if (!draft.switches.unsettled) draft.switches.unsettled = 'ask';
      fullPrompt = null;
      renderPanel();
    });
    const scopeOptions = [h('option', { value: 'all', text: 'All projects' }),
      data.projects.map((p) => h('option', { value: p, text: projectLabel(p), title: p }))];
    const missing = draft.scope !== 'all' && !data.projects.includes(draft.scope);
    if (missing) scopeOptions.push(h('option', { value: draft.scope, text: `${draft.scope} (project no longer listed)` }));
    const scope = h('select', { id: 'tscope' }, scopeOptions);
    scope.value = draft.scope;
    scope.addEventListener('change', () => { draft.scope = scope.value; fullPrompt = null; });

    const every = h('input', { type: 'checkbox', 'aria-label': 'Saves after every step', checked: sw.save_every_step === true });
    every.addEventListener('change', () => { sw.save_every_step = every.checked; });
    const tests = h('input', { type: 'checkbox', 'aria-label': 'Runs the whole test suite', checked: sw.full_tests_before_done === true });
    tests.addEventListener('change', () => { sw.full_tests_before_done = tests.checked; });
    const pkg = h('select', { id: 'tpackages' },
      [['ask', 'Ask the lead first'], ['go', 'Go ahead'], ['never', 'Never']].map(([v, l]) => h('option', { value: v, text: l })));
    pkg.value = sw.packages || 'ask';
    pkg.addEventListener('change', () => { sw.packages = pkg.value; });
    const stuck = h('select', { id: 'tunsettled' },
      [['ask', 'Ask the lead'], ['decide', 'Pick, record it, keep going']].map(([v, l]) => h('option', { value: v, text: l })));
    stuck.value = sw.unsettled || 'ask';
    stuck.addEventListener('change', () => { sw.unsettled = stuck.value; renderPanel(); });
    const files = h('input', { id: 'tfiles', type: 'number', min: 1, step: 1, value: sw.file_limit ? String(sw.file_limit) : '', placeholder: 'No limit' });
    files.addEventListener('input', () => {
      const n = parseInt(files.value, 10);
      if (n >= 1) sw.file_limit = n; else delete sw.file_limit;
    });

    const extra = h('textarea', { id: 'textra', rows: 5, maxLength: 4000, value: draft.text });
    const count = h('span', { class: 'count', text: `${draft.text.length} / 4000` });
    extra.addEventListener('input', () => { draft.text = extra.value; count.textContent = `${extra.value.length} / 4000`; });

    const layerName = h('span', { id: 'layer-name', text: `This template · ${draft.name || 'Untitled'}` });
    name.addEventListener('input', () => { draft.name = name.value; layerName.textContent = `This template · ${name.value || 'Untitled'}`; });

    const layer1Caption = worker
      ? 'Built in: stay inside the files you own, report what you changed'
      : "Built in, can't be turned off: the rules for this role";
    const layers = h('div', { class: 'layers' },
      h('div', { class: 'layer' }, h('span', { class: 'n', text: '1' }),
        h('span', { class: 't' }, h('span', { text: `Wheelchair's ${role[4]} rules` }), h('span', { class: 'hint', text: layer1Caption })),
        h('span', { class: 'state', text: 'fixed' })),
      h('div', { class: 'layer mine' }, h('span', { class: 'n', text: '2' }),
        h('span', { class: 't' }, layerName, h('span', { class: 'hint', text: 'The switches above and your own words' })),
        h('span', { class: 'state', text: 'editing' })),
      h('div', { class: 'layer' }, h('span', { class: 'n', text: '3' }),
        h('span', { class: 't' },
          h('span', { text: worker ? "The part's brief" : 'The brief' }),
          h('span', { class: 'hint', text: worker ? 'Written by the sub-lead for each part: what to change and which files' : 'What it is asked to do each time it starts' })),
        h('span', { class: 'state', text: 'per task' })));

    const fullHost = promptBox();
    const fullLink = h('button', { type: 'button', class: 'link', id: 'see-full', text: 'See it in full', onclick: () => seeInFull(document.getElementById('full-prompt')) });

    const using = draft.live_sessions || 0;
    const usingText = draft.id
      ? `${using === 0 ? 'No' : using} ${using === 1 ? role[4] : role[3]} ${using === 1 ? 'is' : 'are'} using this now. Changes apply to ${role[3]} started after you save.`
      : `Changes apply to ${role[3]} started after you save.`;

    const del = confirming
      ? h('button', { type: 'button', class: 'danger', id: 'confirm-delete', text: 'Really delete', onclick: () => deleteTemplate(errHost) })
      : h('button', { type: 'button', class: 'danger', id: 'delete', text: 'Delete', onclick: () => { confirming = true; renderPanel(); } });

    return h('div', { class: 'tpl-edit' },
      noteEl(),
      h('div', { class: 'tpl-top' },
        h('div', { class: 'f name' }, h('label', { for: 'tname', text: 'Name' }), name),
        h('div', { class: 'f' }, h('label', { for: 'trole', text: 'For' }), roleSel),
        h('div', { class: 'f' }, h('label', { for: 'tscope', text: 'Used in' }), scope)),
      missing ? h('p', { class: 'hint missing', text: 'This project is no longer listed. The template stays, but nothing new uses it until you pick another.' }) : null,
      h('section', { 'aria-labelledby': 'sw' },
        h('h2', { id: 'sw', text: 'How it works' }),
        h('div', { class: 'box rows' },
          switchRow('Saves its work after every step', `Needed if ${role[4] === 'worker' ? 'a worker' : 'an agent'} may move to another node later`, every),
          switchRow('Runs the whole test suite before reporting done', 'Slower, but less comes back for fixes', tests),
          switchRow('Installing packages', 'What it does when it needs something new', h('div', { class: 'ctl' }, pkg)),
          worker ? switchRow("When the brief doesn't settle something", 'Matches the open question in the proposal', h('div', { class: 'ctl' }, stuck)) : null,
          switchRow('Stop and ask past this many files', 'A part that grows bigger than planned comes back to the sub-lead', h('div', { class: 'ctl' }, files)))),
      h('section', {},
        h('div', { class: 'head-line' }, h('label', { for: 'textra', text: 'In your own words' }), count),
        h('span', { class: 'hint', text: "Anything the switches don't cover. Written to the agent as is." }),
        extra),
      h('section', { 'aria-labelledby': 'told' },
        h('div', { class: 'head-line' }, h('h2', { id: 'told', text: `What a ${role[4]} is told, top to bottom` }), fullLink),
        layers,
        fullHost,
        h('span', { class: 'hint', id: 'layer-footer' },
          'Where they disagree, the lower layer wins. Nothing overrides layer 1.',
          worker ? " …except this template's 'Pick, record it, keep going'" : null)),
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'primary', id: 'save-template', text: 'Save', onclick: () => saveTemplate(errHost) }),
        draft.id ? h('button', { type: 'button', id: 'toggle-use', text: draft.in_use ? 'Stop using' : 'Mark in use', onclick: () => toggleInUse(errHost) }) : null,
        draft.id ? h('button', { type: 'button', id: 'duplicate', text: 'Duplicate', onclick: () => duplicateTemplate(errHost) }) : null,
        draft.id ? del : null,
        h('span', { class: 'grow', id: 'using', text: usingText })),
      errHost);
  }

  function renderTemplates() {
    if (selected === null) select(data.templates[0] ? data.templates[0].id : 'new');
    const list = h('nav', { class: 'tpl-list', 'aria-label': 'Templates' },
      h('h1', { text: 'Behavior templates' }),
      h('p', { class: 'hint', text: "How each kind of agent works, on top of wheelchair's own rules." }),
      h('button', { type: 'button', class: 'new', id: 'new-template', text: '+ New template', onclick: () => { select('new'); renderPanel(); } }));
    for (const [role, label] of ROLES) {
      const items = data.templates.filter((t) => t.role === role);
      if (!items.length) continue;
      list.append(h('span', { class: 'group-label', text: label }));
      for (const t of items) {
        const tags = [];
        if (t.in_use) tags.push(t.scope === 'all' ? 'in use' : 'in use here');
        if (t.scope_missing) tags.push('project no longer listed');
        list.append(h('button', {
          type: 'button', class: 'tpl-item', 'data-id': t.id, 'aria-current': String(selected === t.id),
          onclick: () => { select(t.id); renderPanel(); },
        }, h('span', { class: 'nm', text: t.name }), h('span', { class: 'tag', text: tags.join(' · ') })));
      }
    }
    return h('div', { class: 'tpl' }, list, draft ? renderEditor() : h('p', { class: 'empty-note', text: 'No templates yet.' }));
  }

  // ---------------------------------------------------------------- Writing style

  const LENGTHS = [['short', 'Short'], ['balanced', 'Balanced'], ['thorough', 'Thorough']];
  const LISTS = [['prose', 'Mostly prose'], ['when-helpful', 'When it helps scanning'], ['always', 'Always']];
  const TERMS = [['build-up', "Build up to them, unless we've used them before"], ['freely', 'Use freely'], ['avoid', 'Avoid entirely']];
  const SAMPLE = "It's worth noting that the idempotency guarantee here is load-bearing: because the hook fires on every turn, any non-idempotent side effect in the notify path would compound across retries, so I've restructured the handler accordingly.";
  let pending = null; // the never-say input, for a phrase typed but not yet added
  let withPane = null;
  let previewBtn = null;
  let previewErr = null;

  function paintPreview() {
    if (previewBtn) {
      previewBtn.disabled = preview.running;
      previewBtn.setAttribute('aria-busy', String(preview.running));
      previewBtn.replaceChildren(...(preview.running
        ? [h('span', { class: 'spinner', 'aria-hidden': 'true' }), document.createTextNode(' Previewing…')]
        : [document.createTextNode('Preview')]));
    }
    if (withPane) {
      withPane.textContent = preview.after === null ? 'Press Preview to see the same message under this style.' : preview.after;
      withPane.className = preview.after === null ? 'empty' : '';
    }
    if (previewErr) { previewErr.textContent = preview.error; previewErr.hidden = !preview.error; }
  }

  function currentStyle() {
    const phrases = styleDraft.never_say.slice();
    const extra = pending ? pending.value.trim() : '';
    if (extra && !phrases.includes(extra)) phrases.push(extra);
    return { length: styleDraft.length, lists: styleDraft.lists, terms: styleDraft.terms, never_say: phrases, text: styleDraft.text };
  }

  async function runPreview() {
    if (preview.running) return;
    preview = { running: true, after: preview.after, error: '' };
    paintPreview();
    try {
      const res = await api('/settings/style/preview', { method: 'POST', body: currentStyle() });
      preview = { running: false, after: res.after, error: '' };
    } catch (e) {
      preview = { running: false, after: preview.after, error: e.message };
    }
    paintPreview();
  }

  function radios(label, options, key) {
    const group = h('div', { class: 'seg-radio', role: 'radiogroup', 'aria-label': label },
      options.map(([value, text]) => h('button', {
        type: 'button', role: 'radio', 'aria-checked': String(styleDraft[key] === value), text,
        onclick: () => {
          styleDraft[key] = value;
          for (const b of group.children) b.setAttribute('aria-checked', String(b.textContent === text));
        },
      })));
    return group;
  }

  function renderWriting() {
    if (!styleDraft) styleDraft = structuredClone(data.style);
    const errHost = h('div', {});
    const terms = h('select', { 'aria-label': 'Technical terms' }, TERMS.map(([v, l]) => h('option', { value: v, text: l })));
    terms.value = styleDraft.terms;
    terms.addEventListener('change', () => { styleDraft.terms = terms.value; });

    const chips = h('div', { class: 'chips', id: 'never-say' });
    function paintChips() {
      chips.replaceChildren(
        ...styleDraft.never_say.map((phrase, i) => h('span', { class: 'chip' }, `"${phrase}"`,
          h('button', { type: 'button', 'aria-label': `Remove ${phrase}`, text: '×', onclick: () => { styleDraft.never_say.splice(i, 1); paintChips(); } }))),
        pending);
    }
    pending = h('input', { type: 'text', 'aria-label': 'Add a phrase', placeholder: 'Add a phrase…', autocomplete: 'off' });
    pending.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      const value = pending.value.trim();
      if (value && !styleDraft.never_say.includes(value)) styleDraft.never_say.push(value);
      pending.value = '';
      paintChips();
      pending.focus();
    });
    paintChips();

    const own = h('textarea', { id: 'style-text', rows: 4, maxLength: 2000, value: styleDraft.text });
    const count = h('span', { class: 'count hint', text: `${styleDraft.text.length} / 2000` });
    own.addEventListener('input', () => { styleDraft.text = own.value; count.textContent = `${own.value.length} / 2000`; });

    withPane = h('p', { id: 'with-style' });
    previewBtn = h('button', { type: 'button', id: 'preview', onclick: runPreview });
    previewErr = h('p', { class: 'inline-err', id: 'preview-error', role: 'alert' });

    const saved = h('p', { class: 'note', id: 'style-saved', role: 'status', text: styleNote });
    const row = (title, hint, control) => h('div', { class: 'row-line' },
      h('div', { class: 'what' }, h('span', { text: title }), hint ? h('span', { class: 'hint', text: hint }) : null), control);

    const out = h('div', { class: 'writing' },
      h('div', {},
        h('h1', { text: 'Writing style' }),
        h('p', { class: 'lede', text: 'How leads write to you. Only leads follow this: sub-leads, workers, reviewers and checkers never write to you, so they skip it and keep their full attention on the work.' }),
        h('div', { class: 'covers' }, h('span', { class: 'lbl', text: 'Covers:' }),
          ['Thread messages', 'Question cards', 'Plan approved and Done cards'].map((t) => h('span', { class: 'chip', text: t })))),
      h('section', { 'aria-labelledby': 'basics' },
        h('h2', { id: 'basics', text: 'Basics' }),
        h('div', { class: 'box rows' },
          row('Length', '', radios('Length', LENGTHS, 'length')),
          row('Lists and headings', '', radios('Lists and headings', LISTS, 'lists')),
          row('Technical terms', 'Whether the lead can assume you know a term', h('div', { class: 'ctl wide' }, terms)))),
      h('section', { 'aria-labelledby': 'ban' },
        h('h2', { id: 'ban', text: 'Never say' }),
        chips,
        h('span', { class: 'hint', text: 'This takes over from the old wording list, and only leads see it now.' })),
      h('section', {},
        h('div', { class: 'head-line' }, h('label', { for: 'style-text', text: 'In your own words' }), count),
        own),
      h('section', { 'aria-labelledby': 'prev' },
        h('h2', { id: 'prev', text: 'Same message, before and after' }),
        h('div', { class: 'compare' },
          h('div', { class: 'pane' }, h('span', { class: 'eyebrow', text: 'Without your style' }), h('p', { id: 'without-style', text: SAMPLE })),
          h('div', { class: 'pane with' }, h('span', { class: 'eyebrow', text: 'With your style' }), withPane)),
        previewErr,
        h('div', { class: 'actions' }, previewBtn,
          h('span', { class: 'hint', text: 'Preview rewrites the message under the style above, saved or not. It saves nothing.' }))),
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'primary', id: 'save-style', text: 'Save', onclick: async () => {
          try {
            const res = await api('/settings/style', { method: 'PUT', body: currentStyle() });
            data.style = res.style;
            data.style_version = res.style_version;
            styleDraft = structuredClone(res.style);
            styleNote = 'Saved';
            inlineErr(errHost, '');
            renderPanel();
          } catch (e) { styleNote = ''; saved.textContent = ''; inlineErr(errHost, e.message); }
        } }),
        h('span', { class: 'hint', text: 'Leads pick it up on their next message.' }),
        saved),
      errHost);
    queueMicrotask(paintPreview);
    return out;
  }

  // ---------------------------------------------------------------- Accounts, Usage, lead order

  const PLAN_OPTIONS = {
    claude: [['unknown', 'Not sure'], ['pro', 'Pro'], ['max5', 'Max 5x'], ['max20', 'Max 20x']],
    gpt: [['unknown', 'Not sure'], ['plus', 'Plus'], ['pro', 'Pro']],
    gemini: [['unknown', 'Not sure'], ['pro', 'AI Pro'], ['ultra', 'AI Ultra']],
    kimi: [['unknown', 'Not sure']],
  };
  const planLabel = (provider, plan) => ((PLAN_OPTIONS[provider] || []).find((p) => p[0] === plan) || [0, plan])[1];
  const PROVIDER_NAME = { claude: 'Claude', gpt: 'GPT', gemini: 'Antigravity', kimi: 'Kimi Code' };
  const WITHIN = [['soonest', 'Soonest refill first'], ['spread', 'Spread evenly'], ['one', 'Stay on one account']];
  const CLAUDE_TERMS = "Anthropic's terms say plan limits assume ordinary, individual use. Several Claude accounts behind one setup may get flagged.";
  const SIGNIN_WAIT_MS = 30000;
  const SIGNIN_FINISH_MS = 10 * 60 * 1000;

  let usage = null;            // GET /usage, or null until the first answer
  let usageError = '';
  let usageTimer = null;
  let editing = null;          // {id, kind: 'rename'|'plan'|'remove'}
  let adding = null;           // {provider, name, plan, warn} while the Add account form is open
  let justAdded = null;        // an account id whose Sign in buttons are offered
  let openProvider = null;     // the provider whose account table is open on Usage
  let balDraft = null;         // unsaved balancing edits
  let balNote = { text: '', bad: false };
  let signCard = null;         // {account, machine, el, timers…} while a sign-in card is open

  const when = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    return d.toDateString() === new Date().toDateString() ? time : d.toLocaleDateString([], { weekday: 'short' }) + ' ' + time;
  };
  function dayPart(iso) {
    const d = new Date(iso);
    const hour = d.getHours();
    const part = hour < 5 ? 'night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
    return d.toLocaleDateString([], { weekday: 'long' }) + ' ' + part;
  }
  const dayTime = (iso) => new Date(iso).toLocaleDateString([], { weekday: 'long' }) + ' '
    + new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const pct = (n) => Math.round(n) + '%';
  const safeHref = (u) => (/^https?:\/\//i.test(String(u)) ? String(u) : '#');

  async function refreshUsage() {
    try {
      usage = await api('/usage');
      usageError = '';
    } catch (e) { usageError = e.message; }
    // A repaint would drop what is being typed, so it waits while a form is open.
    const typing = document.activeElement && panel.contains(document.activeElement) && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (!editing && !adding && !typing && (section === 'accounts' || section === 'usage')) renderPanel();
  }

  // The timer runs only while Accounts or Usage is shown.
  function syncSection() {
    const live = section === 'accounts' || section === 'usage';
    if (live && !usageTimer) usageTimer = window.wcPoller(refreshUsage, 30000);
    if (!live && usageTimer) { usageTimer.stop(); usageTimer = null; }
    if (live) refreshUsage();
    if (section === 'usage') {
      fetch(API + '/usage/seen', { method: 'POST' }).then(() => window.dispatchEvent(new CustomEvent('wc-usage-seen'))).catch(() => {});
    }
  }

  const accountRows = (provider) => {
    const live = usage && usage.providers && usage.providers[provider];
    if (live) return live.accounts;
    return (data.accounts || []).filter((a) => a.provider === provider).map((a) => ({ ...a, machines: {}, reading: null, live_sessions: 0 }));
  };
  const machineNames = () => {
    const names = new Set();
    for (const p of Object.values((usage && usage.providers) || {})) for (const a of p.accounts) for (const m of Object.keys(a.machines || {})) names.add(m);
    return [...names];
  };

  // ---- the sign-in card

  function closeSignin() {
    if (!signCard) return;
    clearInterval(signCard.poll); clearTimeout(signCard.close);
    signCard.el.remove();
    signCard = null;
    refreshUsage();
  }

  function openSignin(account, machine) {
    closeSignin();
    const terminal = `/wheelchair/app/terminal?login=${encodeURIComponent(account.id)}&machine=${encodeURIComponent(machine)}`;
    const status = h('p', { class: 'hint waiting', role: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), document.createTextNode('Starting sign-in on ' + machine + '…'));
    const actions = h('div', { class: 'actions signin-actions' });
    const codeBox = h('div', { class: 'signin-code' });
    const paste = h('textarea', { rows: 2, 'aria-label': 'Paste the code from the sign-in page', placeholder: 'Paste the code here' });
    const send = h('button', { type: 'button', class: 'primary small', text: 'Send code', onclick: async () => {
      const code = paste.value.trim();
      if (!code) return;
      try { await api(`/accounts/${encodeURIComponent(account.id)}/signin/${encodeURIComponent(machine)}/code`, { method: 'POST', body: { code } }); paste.value = ''; status.textContent = 'Code sent.'; } catch (e) { inlineErr(codeBox, e.message); }
    } });
    const pasteWrap = h('div', { class: 'paste', hidden: true }, h('label', { text: 'Paste the code' }), paste, send);
    const termLink = h('a', { class: 'small-link', href: terminal, target: '_blank', rel: 'noopener', text: 'Open terminal' });
    const closeBtn = h('button', { type: 'button', class: 'small', text: 'Close', onclick: closeSignin });
    const root = h('section', { class: 'box signin-card', 'aria-label': 'Sign in', 'data-account': account.id },
      h('div', { class: 'head-line' }, h('h2', { text: `Sign in ${account.name} on ${machine}` }), closeBtn),
      status, actions, codeBox, pasteWrap, h('div', { class: 'actions' }, termLink));
    const card = { account: account.id, machine, el: root, started: Date.now(), poll: null, close: null, hadUrl: false, firstUrl: null };
    signCard = card;
    const hostEl = document.getElementById('signin-host');
    if (hostEl) hostEl.replaceChildren(root);

    const fail = () => {
      status.className = 'inline-err';
      status.textContent = "Couldn't read the sign-in screen";
      actions.replaceChildren(h('a', { class: 'btn-link', href: terminal, target: '_blank', rel: 'noopener', text: 'Open terminal' }));
      codeBox.replaceChildren();
      pasteWrap.hidden = true;
      clearInterval(card.poll);
    };
    const expired = () => card.hadUrl ? Date.now() - card.firstUrl > SIGNIN_FINISH_MS : Date.now() - card.started > SIGNIN_WAIT_MS;
    const paint = (st) => {
      if (signCard !== card) return;
      if (st.state === 'done' && st.logged_in) {
        root.classList.add('done');
        status.className = 'note'; status.textContent = 'Signed in.';
        actions.replaceChildren(); codeBox.replaceChildren(); pasteWrap.hidden = true;
        clearInterval(card.poll);
        card.close = setTimeout(closeSignin, 2000);
        return;
      }
      if (st.state === 'failed') return fail();
      if ((card.hadUrl || !st.url) && expired()) return fail();
      if (st.url) {
        if (!card.hadUrl) card.firstUrl = Date.now();
        card.hadUrl = true;
        status.className = 'hint'; status.textContent = st.wantsCode ? 'Open the link, sign in, then paste the code it shows.' : 'Open the link and sign in.';
        if (account.provider === 'claude' || account.provider === 'gemini') {
          actions.replaceChildren(h('a', { class: 'btn-link primary', href: safeHref(st.url), target: '_blank', rel: 'noopener', text: 'Open sign-in link' }));
        } else {
          actions.replaceChildren(h('a', { class: 'btn-link', href: safeHref(st.url), target: '_blank', rel: 'noopener', text: st.url }));
        }
        if (st.code) {
          codeBox.replaceChildren(h('div', { class: 'device-code', text: st.code }),
            h('button', { type: 'button', class: 'small', text: 'Copy', onclick: (ev) => {
              const done = () => { ev.target.textContent = 'Copied'; };
              if (navigator.clipboard) navigator.clipboard.writeText(st.code).then(done, () => {}); else done();
            } }));
        }
        pasteWrap.hidden = !st.wantsCode;
      } else if (card.hadUrl) {
        status.className = 'hint waiting';
        status.replaceChildren(h('span', { class: 'spinner', 'aria-hidden': 'true' }), document.createTextNode('Finishing sign-in on ' + machine + '…'));
        actions.replaceChildren(); codeBox.replaceChildren(); paste.value = ''; pasteWrap.hidden = true;
      }
    };
    (async () => {
      const base = `/accounts/${encodeURIComponent(account.id)}/signin/${encodeURIComponent(machine)}`;
      try {
        await api(`/accounts/${encodeURIComponent(account.id)}/signin`, { method: 'POST', body: { machine } });
      } catch (e) { status.className = 'inline-err'; status.textContent = e.message; return; }
      const tick = async () => {
        try { paint(await api(base)); } catch (e) { if (signCard === card && expired()) fail(); }
      };
      if (signCard !== card) return;
      card.poll = setInterval(tick, 2000);
      tick();
    })();
  }

  // ---- Accounts panel

  function windowLine(label, w, at) {
    if (!w) return h('div', { class: 'win' }, h('span', { class: 'k', text: label }), h('span', { class: 'v dim', text: 'no reading yet' }));
    const expired = w.resets_at && Date.parse(w.resets_at) <= Date.now();
    const used = expired ? 0 : w.used;
    return h('div', { class: 'win' }, h('span', { class: 'k', text: label }),
      h('span', { class: 'meter' }, h('span', { style: `width:${Math.min(100, Math.max(0, used))}%` })),
      h('span', { class: 'v', text: `${pct(used)} used` + (w.resets_at && !expired ? `, resets ${when(w.resets_at)}` : '') }));
  }

  async function mutate(host, fn) {
    try { await fn(); } catch (e) { inlineErr(host, e.message); return false; }
    inlineErr(host, '');
    editing = null;
    data = await api('/settings');
    await refreshUsage();
    renderPanel();
    return true;
  }

  function planSelect(provider, value) {
    return h('select', { 'aria-label': 'Plan' }, PLAN_OPTIONS[provider].map(([v, l]) => h('option', { value: v, text: l, selected: v === value })));
  }

  // The plan the CLI itself reported, shown beside the chosen one when they differ.
  function reportedPlan(a) {
    const reported = a.reading && a.reading.plan_type;
    if (!reported) return '';
    const r = String(reported).trim().toLowerCase();
    const chosen = [String(a.plan).toLowerCase(), String(planLabel(a.provider, a.plan)).toLowerCase()];
    return a.plan !== 'unknown' && chosen.includes(r) ? '' : ` · reported: ${reported}`;
  }

  function accountCard(a) {
    const isDefault = a.id === `default-${a.provider}`;
    const card = h('div', { class: 'acct', 'data-account': a.id });
    const machines = Object.entries(a.machines || {});
    const states = { signed_in: 'signed in', signed_out: 'signed out', unknown: 'unknown' };
    const stateName = (st) => (st && typeof st === 'object' ? st.state : st);
    card.append(
      h('div', { class: 'acct-head' },
        h('strong', { class: 'acct-name', text: a.name }),
        h('span', { class: 'v-badge', text: `${planLabel(a.provider, a.plan)}${reportedPlan(a)} · weight ${a.weight}` }),
        a.paused && h('span', { class: 'v-badge', text: 'paused' }),
        h('span', { class: 'in-use' + (a.live_sessions ? ' on' : ''), text: a.live_sessions ? `in use · ${a.live_sessions} ${a.live_sessions === 1 ? 'agent' : 'agents'}` : 'idle' })),
      machines.length && h('ul', { class: 'machines' }, machines.map(([m, st]) => h('li', { 'data-machine': m, 'data-state': stateName(st) },
        h('span', { class: 'mname', text: m }), h('span', { class: 'mstate ' + stateName(st), text: st && st.state === 'problem' ? st.text : (states[st] || st) }),
        stateName(st) !== 'signed_in' && h('button', { type: 'button', class: 'small', text: 'Sign in', 'aria-label': `Sign in ${a.name} on ${m}`, onclick: () => openSignin(a, m) })))),
      h('div', { class: 'wins' },
        windowLine('5-hour window', a.reading && a.reading.five_hour),
        windowLine('This week', a.reading && a.reading.week),
        h('span', { class: 'hint', text: a.reading && a.reading.at ? 'as of ' + when(a.reading.at) : 'no reading yet' })));

    const edit = editing && editing.id === a.id ? editing.kind : null;
    if (edit === 'rename') {
      const name = h('input', { value: a.name, 'aria-label': 'Account name' });
      card.append(h('div', { class: 'actions' }, name,
        h('button', { type: 'button', class: 'primary small', text: 'Save', onclick: () => mutate(card, () => api('/settings/accounts/' + encodeURIComponent(a.id), { method: 'PUT', body: { name: name.value } })) }),
        h('button', { type: 'button', class: 'small', text: 'Cancel', onclick: () => { editing = null; renderPanel(); } })));
    } else if (edit === 'plan') {
      const plan = planSelect(a.provider, a.plan);
      const weight = h('input', { type: 'number', min: '0.1', step: 'any', placeholder: 'weight (optional)', 'aria-label': 'Weight override' });
      card.append(h('div', { class: 'actions' }, plan, weight,
        h('button', { type: 'button', class: 'primary small', text: 'Save', onclick: () => {
          const body = { plan: plan.value };
          if (weight.value.trim() !== '') body.weight = Number(weight.value);
          return mutate(card, () => api('/settings/accounts/' + encodeURIComponent(a.id), { method: 'PUT', body }));
        } }),
        h('button', { type: 'button', class: 'small', text: 'Cancel', onclick: () => { editing = null; renderPanel(); } })),
      h('span', { class: 'hint', text: 'Weight is how big this account is next to the others. Leave it blank to use the plan\'s.' }));
    } else if (edit === 'remove') {
      card.append(h('div', { class: 'actions' }, h('span', { text: isDefault ? `Remove the default login? Agents stop using this machine's own ${PROVIDER_NAME[a.provider]} login.` : `Remove ${a.name}?` }),
        h('button', { type: 'button', class: 'danger small', text: 'Remove', onclick: () => mutate(card, () => api('/settings/accounts/' + encodeURIComponent(a.id), { method: 'DELETE' })) }),
        h('button', { type: 'button', class: 'small', text: 'Keep', onclick: () => { editing = null; renderPanel(); } })));
    } else {
      card.append(h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'small', text: a.paused ? 'Resume' : 'Pause', onclick: () => mutate(card, () => api('/settings/accounts/' + encodeURIComponent(a.id), { method: 'PUT', body: { paused: !a.paused } })) }),
        h('button', { type: 'button', class: 'small', text: 'Rename', onclick: () => { editing = { id: a.id, kind: 'rename' }; renderPanel(); } }),
        h('button', { type: 'button', class: 'small', text: 'Change plan', onclick: () => { editing = { id: a.id, kind: 'plan' }; renderPanel(); } }),
        h('button', { type: 'button', class: 'small', text: 'Remove', onclick: () => { editing = { id: a.id, kind: 'remove' }; renderPanel(); } })));
    }
    if (justAdded === a.id) {
      card.append(h('div', { class: 'actions just-added' }, h('span', { text: 'Added. Sign in on:' }),
        machineNames().map((m) => h('button', { type: 'button', class: 'primary small', text: m, 'aria-label': `Sign in ${a.name} on ${m}`, onclick: () => openSignin(a, m) }))));
    }
    return card;
  }

  async function saveAdd(form) {
    try {
      const made = await api('/settings/accounts', { method: 'POST', body: { provider: adding.provider, name: adding.name.trim(), plan: adding.plan } });
      justAdded = made.id;
      adding = null;
      data = await api('/settings');
      await refreshUsage();
      renderPanel();
    } catch (e) { adding.warn = false; renderPanel(); inlineErr(document.querySelector('.add-form') || form, e.message); }
  }

  function addForm() {
    if (!adding) return h('button', { type: 'button', id: 'add-account', class: 'small', text: 'Add account', onclick: () => { adding = { provider: 'claude', name: '', plan: 'unknown', warn: false }; renderPanel(); } });
    const form = h('form', { class: 'box add-form', onsubmit: (ev) => {
      ev.preventDefault();
      if (!adding.name.trim()) { inlineErr(form, 'Give the account a name.'); return; }
      const claudes = (data.accounts || []).filter((a) => a.provider === 'claude').length;
      if (adding.provider === 'claude' && claudes >= 1 && !adding.warn) { adding.warn = true; renderPanel(); return; }
      saveAdd(form);
    } });
    const provider = h('select', { id: 'add-provider', 'aria-label': 'Provider', onchange: () => { adding.provider = provider.value; adding.plan = 'unknown'; adding.warn = false; renderPanel(); } },
      Object.entries(PROVIDER_NAME).filter(([v]) => v !== 'gemini').map(([v, l]) => h('option', { value: v, text: l, selected: v === adding.provider })));
    const name = h('input', { id: 'add-name', value: adding.name, 'aria-label': 'Account name', placeholder: 'Name, e.g. Work', required: true, oninput: () => { adding.name = name.value; } });
    const plan = planSelect(adding.provider, adding.plan);
    plan.id = 'add-plan';
    plan.addEventListener('change', () => { adding.plan = plan.value; });
    form.append(h('h2', { text: 'Add account' }), h('div', { class: 'fields' }, provider, name, plan));
    if (adding.warn) {
      form.append(h('div', { class: 'hu', role: 'alert', id: 'claude-warning' }, h('span', { class: 'msg', text: CLAUDE_TERMS }),
        h('div', { class: 'hu-actions' },
          h('button', { type: 'button', class: 'primary small', id: 'add-anyway', text: 'Add anyway', onclick: () => saveAdd(form) }),
          h('button', { type: 'button', class: 'small', id: 'add-cancel', text: 'Cancel', onclick: () => { adding = null; renderPanel(); } }))));
    } else {
      form.append(h('div', { class: 'actions' }, h('button', { type: 'submit', class: 'primary', text: 'Save' }),
        h('button', { type: 'button', text: 'Cancel', onclick: () => { adding = null; renderPanel(); } })));
    }
    return form;
  }

  // A removed default account can be brought back; it is the CLI's own login on each machine.
  function restoreDefault(provider) {
    const row = h('div', { class: 'actions restore-default' });
    row.append(h('button', { type: 'button', class: 'small', text: 'Add back the default login', onclick: () => mutate(row, () => api(`/settings/accounts/default-${provider}/restore`, { method: 'POST' })) }));
    return row;
  }

  function renderAccounts() {
    return h('div', { class: 'models accounts' },
      h('div', {}, h('h1', { text: 'Accounts' }),
        h('p', { class: 'lede', text: 'The logins agents run on. New sessions pick the account with the most room.' }),
        usageError && h('p', { class: 'inline-err', role: 'alert', text: 'Could not read usage: ' + usageError })),
      h('div', { id: 'signin-host' }, signCard ? signCard.el : null),
      Object.entries(PROVIDER_NAME).map(([provider, label]) => h('section', { class: 'prov-group', 'data-provider': provider, 'aria-label': label },
        h('h2', { text: label }),
        provider === 'gemini' && h('p', { class: 'hint', text: 'Antigravity supports one account per machine' }),
        accountRows(provider).filter((a) => provider !== 'gemini' || a.id === 'default-gemini').map(accountCard),
        !(data.accounts || []).some((a) => a.id === `default-${provider}`) && restoreDefault(provider))),
      addForm());
  }

  // ---- Usage panel

  function balancingBody(keys) {
    const body = {};
    for (const k of keys) body[k] = balDraft[k];
    return body;
  }
  function ensureDraft() {
    if (balDraft) return;
    balDraft = {};
    for (const k of ['lead_order', 'worker_order', 'within', 'leave', 'notify_below', 'save_for_leads', 'margin', 'held_back']) balDraft[k] = structuredClone(data[k]);
  }

  // An order editor: the providers in order, up/down to move; leads may end in "then whatever's left".
  function orderEditor(key, label) {
    ensureDraft();
    const real = balDraft[key].filter((p) => p !== 'any');
    const hasAny = balDraft[key].includes('any');
    const missing = Object.keys(PROVIDER_NAME).filter((p) => !real.includes(p));
    const commit = (list) => { balDraft[key] = hasAny && key === 'lead_order' ? [...list, 'any'] : list; renderPanel(); };
    const move = (i, d) => { const next = real.slice(); const [item] = next.splice(i, 1); next.splice(i + d, 0, item); commit(next); };
    return h('div', { class: 'order', 'data-order': key, role: 'group', 'aria-label': label },
      h('ol', {}, real.map((p, i) => h('li', {}, h('span', { text: PROVIDER_NAME[p] }),
        h('button', { type: 'button', class: 'small', text: '↑', 'aria-label': `Move ${PROVIDER_NAME[p]} up`, disabled: i === 0, onclick: () => move(i, -1) }),
        h('button', { type: 'button', class: 'small', text: '↓', 'aria-label': `Move ${PROVIDER_NAME[p]} down`, disabled: i === real.length - 1, onclick: () => move(i, 1) }),
        real.length > 1 && h('button', { type: 'button', class: 'small', text: 'Remove', 'aria-label': `Leave ${PROVIDER_NAME[p]} out`, onclick: () => commit(real.filter((x) => x !== p)) })))),
      missing.map((p) => h('button', { type: 'button', class: 'small', text: `+ ${PROVIDER_NAME[p]}`, onclick: () => commit([...real, p]) })),
      key === 'lead_order' && h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: hasAny, onchange: (ev) => { balDraft[key] = ev.target.checked ? [...real, 'any'] : real; renderPanel(); } }),
        h('span', { text: "then whatever's left" })));
  }

  async function saveBalancing(keys, host) {
    try {
      const res = await api('/settings/balancing', { method: 'PUT', body: balancingBody(keys) });
      for (const k of keys) data[k] = res[k] !== undefined ? res[k] : balDraft[k];
      data.reserved_provider = res.reserved_provider;
      balDraft = null;
      inlineErr(host, '');
      renderPanel();
      setNote(SAVED, false);
    } catch (e) { inlineErr(host, e.message); setNote('', false); }
  }

  const numField = (key, label, hint, max) => h('div', { class: 'row-line' },
    h('div', { class: 'what' }, h('span', { text: label }), h('span', { class: 'hint', text: hint })),
    h('input', { type: 'number', class: 'ctl num', id: 'bal-' + key, min: '0', max: String(max), value: String(balDraft[key]), 'aria-label': label,
      oninput: (ev) => { balDraft[key] = ev.target.value === '' ? '' : Number(ev.target.value); } }));

  function providerBar(provider, f) {
    const left = f.left;
    const lines = [];
    if (f.all_paused) lines.push(h('p', { class: 'usage-line', text: (f.accounts || []).length ? 'All accounts paused' : 'No accounts added' }));
    else if (left === null) lines.push(h('p', { class: 'usage-line dim', text: 'no reading yet' }));
    if (f.amber && f.runs_out_at) lines.push(h('p', { class: 'usage-line amber', text: `Runs out ${dayPart(f.runs_out_at)}, before the first refill ${f.first_refill ? dayTime(f.first_refill) : ''}`.trim() }));
    if (f.below_notify) lines.push(h('p', { class: 'usage-line amber', text: 'Under your notify line for this week.' }));
    const open = openProvider === provider;
    return h('div', { class: 'usage-prov' + (f.amber ? ' amber' : ''), 'data-provider': provider },
      h('button', { type: 'button', class: 'usage-toggle', 'aria-expanded': String(open), onclick: () => { openProvider = open ? null : provider; renderPanel(); } },
        h('span', { class: 'usage-name', text: f.label }),
        h('span', { class: 'bar', role: 'img', 'aria-label': left === null ? 'no reading' : pct(left * 100) + ' of the week left' },
          h('span', { style: `width:${left === null ? 0 : Math.round(Math.min(1, Math.max(0, left)) * 100)}%` })),
        h('span', { class: 'usage-left', text: left === null ? '–' : pct(left * 100) + ' left' })),
      lines, open && accountTable(f));
  }

  function accountTable(f) {
    const head = h('tr', {}, ['Account', '5-hour used', '5-hour resets', 'Week used', 'Week resets', 'Why'].map((t) => h('th', { scope: 'col', text: t })));
    const rows = f.accounts.map((a) => {
      const r = a.reading || {};
      const cell = (label, text) => h('td', { 'data-label': label, text });
      const gone = (w) => !w || (w.resets_at && Date.parse(w.resets_at) <= Date.now());
      return h('tr', { class: a.next ? 'next' : '', 'data-account': a.id },
        h('th', { scope: 'row', 'data-label': 'Account' }, a.name, a.next && h('span', { class: 'v-badge ok', text: 'next' })),
        cell('5-hour used', r.five_hour ? pct(gone(r.five_hour) ? 0 : r.five_hour.used) : '–'),
        cell('5-hour resets', r.five_hour && r.five_hour.resets_at && !gone(r.five_hour) ? when(r.five_hour.resets_at) : '–'),
        cell('Week used', r.week ? pct(gone(r.week) ? 0 : r.week.used) : '–'),
        cell('Week resets', r.week && r.week.resets_at && !gone(r.week) ? when(r.week.resets_at) : '–'),
        h('td', { 'data-label': 'Why', class: 'why', text: a.reason || '' }));
    });
    return h('div', { class: 'box' }, h('table', { class: 'tiers usage-table' }, h('thead', {}, head), h('tbody', {}, rows)));
  }

  function renderUsage() {
    ensureDraft();
    const settingsBox = h('section', { class: 'balancing', 'aria-labelledby': 'bal' });
    const provider = data.reserved_provider || "the lead's provider";
    const reserveLabel = `Save ${provider} for leads`;
    const within = h('select', { id: 'bal-within', 'aria-label': 'Within a provider', onchange: (ev) => { balDraft.within = ev.target.value; } },
      WITHIN.map(([v, l]) => h('option', { value: v, text: l, selected: v === balDraft.within })));
    const save = h('button', { type: 'button', class: 'primary', id: 'bal-save', text: 'Save', onclick: () => saveBalancing(['worker_order', 'within', 'leave', 'notify_below', 'save_for_leads', 'margin', 'held_back'], settingsBox) });
    settingsBox.append(
      h('h2', { id: 'bal', text: 'Balancing' }),
      h('div', { class: 'box rows' },
        h('div', { class: 'row-line' }, h('div', { class: 'what' }, h('span', { text: 'Workers try first' }), h('span', { class: 'hint', text: 'Which provider new workers start on' })), orderEditor('worker_order', 'Worker order')),
        h('div', { class: 'row-line' }, h('div', { class: 'what' }, h('span', { text: 'Within a provider' }), h('span', { class: 'hint', text: 'How to pick among its accounts' })), h('div', { class: 'ctl' }, within)),
        numField('leave', 'Leave for you (%)', 'An account under this much left stays free for you', 100),
        numField('notify_below', 'Warn me below (%)', 'Shows a dot on Settings when a provider drops under this', 100),
        h('div', { class: 'row-line' }, h('div', { class: 'what' }, h('span', { text: reserveLabel }), h('span', { class: 'hint', text: 'Sessions with no provider preference try other providers first. Does not hold anyone back; the ticks below do.' })),
          h('input', { type: 'checkbox', id: 'bal-save-lead', checked: !!balDraft.save_for_leads, 'aria-label': reserveLabel, onchange: (ev) => { balDraft.save_for_leads = ev.target.checked; } })),
        numField('margin', 'Keep for leads (%)', `When ${provider} is projected to have less than this left at refill, ticked roles go to another provider, or wait if there is none`, 100),
        h('div', { class: 'row-line' }, h('div', { class: 'what' }, h('span', { text: `Held back when ${provider} runs short` })),
          h('div', { class: 'ctl' }, [['worker', 'Workers'], ['reviewer', 'Reviewers'], ['verifier', 'Verifiers'], ['mapper', 'Mappers']].map(([role, label]) =>
            h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 'bal-held-' + role, checked: balDraft.held_back[role], 'aria-label': label, onchange: (ev) => { balDraft.held_back[role] = ev.target.checked; } }), h('span', { text: label })))))),
      h('div', { class: 'actions' }, save), noteEl());
    return h('div', { class: 'models usage' },
      h('div', {}, h('h1', { text: 'Usage' }),
        h('p', { class: 'lede', text: 'How much of this week is left, per provider.' }),
        usageError && h('p', { class: 'inline-err', role: 'alert', text: 'Could not read usage: ' + usageError })),
      h('section', { class: 'usage-bars', 'aria-label': 'Providers' },
        usage ? Object.entries(usage.providers).map(([p, f]) => providerBar(p, f)) : h('p', { class: 'v-empty waiting' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), document.createTextNode('Loading usage…'))),
      settingsBox);
  }

  // The lead order editor on the Models panel, under the lead model pickers.
  function leadOrderRow() {
    ensureDraft();
    const row = h('div', { class: 'row-line lead-order' },
      h('div', { class: 'what' }, h('span', { text: 'Leads try' }), h('span', { class: 'hint', text: 'Which provider a new lead starts on, in order' })),
      orderEditor('lead_order', 'Lead order'),
      h('button', { type: 'button', class: 'primary small', id: 'lead-order-save', text: 'Save', onclick: () => saveBalancing(['lead_order'], row) }));
    return row;
  }

  // ---------------------------------------------------------------- shell

  function renderSections() {
    const nav = document.getElementById('sections');
    nav.replaceChildren(...SECTIONS.map(([key, label]) => {
      const a = h('a', { href: '#' + key, text: label, 'data-section': key });
      if (key === section) a.setAttribute('aria-current', 'page');
      return a;
    }));
  }

  let projectToolsHost = null;
  function renderProjectTools() {
    if (!projectToolsHost) { projectToolsHost = h('div', {}); window.ProjectTools.render(projectToolsHost); }
    return projectToolsHost;
  }

  function renderPanel() {
    if (!data) return;
    const view = section === 'tools' ? renderProjectTools()
      : section === 'templates' ? renderTemplates() : section === 'writing' ? renderWriting()
      : section === 'accounts' ? renderAccounts() : section === 'usage' ? renderUsage() : renderModels();
    const keep = document.getElementById('error');
    panel.replaceChildren(keep, view);
    renderSections();
    if (section === 'models') { if (!diagram && !diagramLoading) loadDiagram(); drawDiagram(); }
  }

  function readHash() {
    const key = location.hash.replace(/^#/, '');
    const next = SECTIONS.some(([k]) => k === key) ? key : 'models';
    if (next !== section) { section = next; setNote('', false); styleNote = ''; diagram = null; }
  }

  window.addEventListener('hashchange', () => { readHash(); renderPanel(); syncSection(); });
  readHash();
  renderSections();

  (async () => {
    const error = document.getElementById('error');
    try {
      data = await api('/settings');
      document.getElementById('loading')?.remove();
      renderPanel();
      syncSection();
    } catch (e) {
      error.hidden = false;
      error.textContent = 'Could not load settings: ' + e.message;
      document.getElementById('loading')?.remove();
    }
  })();
})();
