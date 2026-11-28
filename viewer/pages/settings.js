'use strict';

// The Settings page: eight categories (CATEGORIES), each a column of blocks that repaint on
// their own, so one block's save or timer never drops what is typed in another. Everything
// reads from and writes to the hub's /settings routes (viewer/app/API.md); the page keeps no
// copy of its own beyond the unsaved editor drafts.
(() => {
  const API = '/wheelchair/api';
  // key (the address), title, the phone list's line, the line under the title (Project tools
  // draws its own heading), and the blocks it holds in order.
  const CATEGORIES = [
    { key: 'you', title: 'You', line: 'Your name, writing style, diagrams and background', lede: 'Your name and preferences for how the app looks and communicates.', note: true, blocks: ['name', 'writing', 'diagrams', 'enter', 'background'] },
    { key: 'providers', title: 'AI providers', line: 'Harnesses and accounts', lede: 'The agent programs wheelchair runs and the logins they use.', blocks: ['harnesses', 'accounts'] },
    { key: 'usage', title: 'Usage and balancing', line: 'Usage and reserves', lede: 'What is left this week, and how agents share it.', blocks: ['usage', 'balancing'] },
    { key: 'models', title: 'Models', line: 'Agents, provider ladders, tiers and escalation', lede: 'Who runs what.', note: true, blocks: ['agents', 'ladders', 'tiers', 'escalation', 'assistants'] },
    { key: 'leads', title: 'Assistant and project leads', line: 'Personal assistant and project leads', lede: 'Turn on the assistants you can talk to across your work.', note: true, blocks: ['conversations'] },
    { key: 'threads', title: 'Threads', line: 'Display, merging, folders and permissions', lede: 'Display, merging, folders and permissions for your threads.', note: true, blocks: ['thread-view', 'permission', 'lead-names'] },
    { key: 'behavior', title: 'Agent behavior', line: 'Behavior templates and lessons learned', lede: 'How agents work, and what they have learned.', blocks: ['templates'] },
    { key: 'tools', title: 'Project tools', line: 'Tools and keys for your projects', lede: '', blocks: ['tools'] },
    { key: 'shared-tools', title: 'Shared tools', line: 'The project that holds tools for all your projects', lede: 'Choose the project that holds tools shared across your projects.', blocks: ['shared-tools'] },
  ];
  // Old addresses open the category that now holds what they named.
  const ALIASES = { harnesses: 'providers', accounts: 'providers', writing: 'you', background: 'you', templates: 'behavior' };
  const categoryOf = (key) => CATEGORIES.find((c) => c.key === key);
  const phone = window.matchMedia('(max-width: 899px)');
  const TIERS = [
    ['light', 'Light', 'Spelled-out changes, few files'],
    ['standard', 'Standard', 'Most building'],
    ['heavy', 'Heavy', 'Leading, planning, review, checking'],
    ['critical', 'Critical', "Can't afford to get wrong"],
  ];
  // The tool list comes from the connector manifests (/wheelchair/assets/tools.js).
  const TOOLS = window.WHEELCHAIR_TOOLS || [];
  const toolOf = (provider) => TOOLS.find((t) => t.provider === provider);
  const PROVIDERS = TOOLS.map((t) => [t.provider, t.label, t.settings.cliLabel]);
  const EFFORTS = Object.fromEntries(TOOLS.filter((t) => t.models.efforts.length).map((t) => [t.provider, t.models.efforts]));
  const NONE = '__none';
  const OTHER = '__other';
  const ROLES = [
    ['lead', 'Lead', 'Lead', 'leads', 'lead'],
    ['sub-lead', 'Sub-lead', 'Sub-lead', 'sub-leads', 'sub-lead'],
    ['worker', 'Worker', 'Workers', 'workers', 'worker'],
    ['reviewer', 'Reviewer', 'Reviewers', 'reviewers', 'reviewer'],
    ['verifier', 'Checker', 'Checker', 'checkers', 'checker'],
    ['mapper', 'Mapper', 'Mapper', 'mappers', 'mapper'],
    ['designer', 'Designer', 'Designer', 'designers', 'designer'],
  ];
  const roleInfo = (role) => ROLES.find((r) => r[0] === role) || ROLES[2];
  const SAVED = 'Saved, applies to new sessions';
  const NOT_REFRESHED = 'Saved; the list could not be refreshed';
  let modelSaves = 0; // saved model cells, so only the latest save's re-read is drawn
  const unreadCells = new Map(); // saved cells still waiting for that re-read

  let data = null;
  let section = null; // the open category's key; on a phone with no hash the list covers 'you'
  let atRoot = true;  // no hash
  let note = { text: '', bad: false };
  let selected = null; // a template id, or 'new'
  let draft = null;
  let confirming = false;
  let lessonEdit = null; // the open Lessons learned editor: { role, texts, removals, confirming }
  let lessonThreads = null; // thread id -> title, read when a Lessons editor opens
  let fullPrompt = null; // {text} | {error}
  let styleDraft = null;
  let preview = { running: false, after: null, error: '' };
  let styleNote = '';
  let diagram = null; // GET /settings/diagram-sensitivity, or null until read since You was shown
  let diagramReads = 0; // only the newest read's answer is kept
  let diagramShown = false;
  let folderDraft = null; // the typed Default project folder, kept across re-renders until saved
  let nameDraft = null; // the typed Your name, kept across re-renders until saved
  let tierTab = null; // the provider tab open in Tier models
  const openLadders = new Set(); // roles whose provider ladder disclosure is open
  const saves = {}; // per setting: { queue, ticket, pending, saved } for saves made one after another
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

  // Behind a phone's list or another category, Diagrams is neither read nor drawn.
  const youShown = () => section === 'you' && !(atRoot && phone.matches);

  function drawDiagram() {
    const box = document.getElementById('diagram-choices');
    if (!box || !youShown()) return;
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
    if (!youShown()) return; // a save can finish after You was left
    const read = ++diagramReads;
    let next;
    try { next = await api('/settings/diagram-sensitivity'); }
    catch (e) { next = { machines: { hub: { error: e.message } } }; }
    if (read !== diagramReads) return;
    diagram = next;
    drawDiagram();
  }

  // Diagrams is read each time You comes on screen: opened, or uncovered when a phone's list
  // is left or the window grows past it. Never while the list hides it.
  function syncDiagrams() {
    if (!data) return;
    const shown = youShown();
    if (shown && !diagramShown) { diagram = null; drawDiagram(); loadDiagram(); }
    diagramShown = shown;
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

  // A model's levels as its option lists them: [] takes no effort, null is unknown.
  function levelsOf(provider, model) {
    const entry = (data.model_options[provider] || []).find((o) => o.value === model);
    return entry && Array.isArray(entry.efforts) ? entry.efforts : null;
  }

  // The effort that goes with a newly chosen model. A member id of a level group
  // (`<base>-<level>`) carries its own, which the hub reads out of the id.
  function keptEffort(provider, model, effort) {
    const member = /^(.+)-(low|medium|high|xhigh|max)$/.exec(model || '');
    if (member && levelsOf(provider, member[1])?.length >= 2) return '';
    const levels = levelsOf(provider, model);
    return levels && !levels.includes(effort) ? '' : effort;
  }

  // Redraw one model cell in place: every other cell keeps what is typed or open in it.
  function redrawCell(provider, slot) {
    const host = document.querySelector(`[data-cell="tiers:${provider}:${slot}"]`);
    if (host) swapKeepingFocus(host, () => host.replaceWith(modelPicker(provider, slot)));
  }

  // A repaint replaces what had the keyboard focus; give it back to the same control.
  function swapKeepingFocus(host, swap) {
    const focused = document.activeElement;
    const key = focused && host.contains(focused) ? focused.closest('[data-focus]')?.dataset.focus : null;
    swap();
    if (key && !focused.isConnected) panel.querySelector(`[data-focus="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
  }
  function repaint(...names) {
    for (const name of names) {
      const host = blockHost(name);
      if (host) swapKeepingFocus(host, () => paint(name));
    }
  }
  const repaintPreviews = () => repaint('agents', 'assistants');

  // After a save the lists are read again, so the saved cell shows what the hub now holds.
  async function refreshModels(provider, slot) {
    const ticket = ++modelSaves;
    unreadCells.set(`${provider}:${slot}`, [provider, slot]);
    let fresh;
    try { fresh = await api('/settings'); } catch {
      if (ticket !== modelSaves) return;
      unreadCells.clear();
      const host = document.querySelector(`[data-cell="tiers:${provider}:${slot}"]`);
      if (host) host.append(h('p', { class: 'hint', role: 'status', text: NOT_REFRESHED }));
      return;
    }
    if (ticket !== modelSaves) return;
    data.models = fresh.models;
    data.model_options = fresh.model_options;
    data.legacy_lead_diffs = fresh.legacy_lead_diffs;
    // A save overtaken by a later one is drawn here too, by the later save's read.
    for (const saved of unreadCells.values()) redrawCell(...saved);
    unreadCells.clear();
    repaintPreviews();
  }

  // One tier's model and effort for a provider. A change saves at once; a refusal shows its
  // reason under the controls and puts them back.
  function modelPicker(provider, slot) {
    const cell = data.models[provider] && data.models[provider][slot];
    const current = cell ? cell.model : null;
    const effort = cell && cell.effort ? cell.effort : '';
    const wrap = h('div', { class: 'cell', 'data-cell': `tiers:${provider}:${slot}` });
    const controls = h('div', { class: 'model-controls' });
    wrap.append(controls);
    const label = `${PROVIDER_NAME[provider]} ${slot} model`;
    const select = h('select', { 'aria-label': label, 'data-focus': label, class: toolOf(provider).settings.monoModelNames ? 'mono' : '' },
      optionList(provider, current, { allowNone: true }).map((o) => h('option', { value: o.value, text: o.label })));
    select.value = current || NONE;
    controls.append(select);
    let pills = null;

    const checkPill = (value) => {
      for (const b of pills?.children || []) b.setAttribute('aria-checked', String(b.dataset.value === value));
    };

    async function commit(model, newEffort) {
      const body = { provider, slot, model };
      if (model && newEffort) body.effort = newEffort;
      let res;
      try {
        res = await api('/settings/models', { method: 'PUT', body });
      } catch (e) {
        select.value = current || NONE;
        checkPill(effort);
        wrap.querySelector('.other')?.remove();
        inlineErr(wrap, e.message);
        setNote('', false);
        return;
      }
      data.models = res.models;
      redrawCell(provider, slot);
      repaintPreviews();
      setNote(SAVED, false);
      await refreshModels(provider, slot);
    }

    select.addEventListener('change', () => {
      if (select.value === OTHER) { openOther(); return; }
      wrap.querySelector('.other')?.remove();
      const model = select.value === NONE ? null : select.value;
      commit(model, keptEffort(provider, model, effort));
    });

    function openOther() {
      if (wrap.querySelector('.other')) return;
      const input = h('input', { type: 'text', 'aria-label': `${label}, other`, placeholder: toolOf(provider).settings.modelPlaceholder, autocomplete: 'off', spellcheck: false });
      const use = h('button', { type: 'button', class: 'small', text: 'Use' });
      const row = h('div', { class: 'other' }, input, use);
      const go = () => {
        const value = input.value.trim();
        if (!new RegExp(toolOf(provider).settings.modelPattern).test(value)) {
          inlineErr(wrap, toolOf(provider).settings.modelError);
          return;
        }
        commit(value, keptEffort(provider, value, effort));
      };
      use.addEventListener('click', go);
      input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); go(); } });
      controls.after(row);
      input.focus();
    }

    if (EFFORTS[provider]) {
      const levels = levelsOf(provider, current);
      const choices = ['', ...(levels || EFFORTS[provider])];
      if (effort && !choices.includes(effort)) choices.push(effort);
      const disabled = !current || levels?.length === 0;
      const name = `${PROVIDER_NAME[provider]} ${slot} effort`;
      pills = h('div', { class: 'seg-radio effort', role: 'radiogroup', 'aria-label': name, 'aria-disabled': disabled ? 'true' : null },
        choices.map((value) => h('button', {
          type: 'button', role: 'radio', 'data-value': value, 'data-focus': `${name}:${value}`, text: value || 'CLI default',
          'aria-checked': String(effort === value), disabled,
          onclick: () => { if (value === effort) return; checkPill(value); commit(current, value); },
        })));
      controls.append(pills);
    }
    return wrap;
  }

  async function headsUpAction(body, host) {
    try {
      const res = await api('/settings/models/heads-up', { method: 'POST', body });
      data.models = res.models;
      data.heads_up = res.heads_up;
      repaint('tiers');
      repaintPreviews();
      // A switched tier can change the notice, or bring one where nothing differed before.
      await refreshDiffs(true);
    } catch (e) { inlineErr(host, e.message); }
  }

  function headsUpLine(item, tier) {
    const line = h('div', { class: 'hu', 'data-kind': item.kind });
    const actions = h('div', { class: 'hu-actions' });
    let text;
    let title = null;
    if (item.kind === 'malformed') {
      text = "The models file couldn't be read, so the shipped defaults are showing.";
      actions.append(h('button', { type: 'button', class: 'small', text: 'Reset to defaults', onclick: () => headsUpAction({ action: 'reset' }, line) }));
    } else if (item.kind === 'tierless') {
      text = `${item.model} is available but fits no tier.`;
      actions.append(h('button', { type: 'button', class: 'small', text: 'Skip', onclick: () => headsUpAction({ action: 'skip', model: item.model }, line) }));
    } else {
      title = item.kind === 'newer' ? 'Newer model' : 'New model';
      text = ` · ${item.model} is available for ${tier}.`;
      actions.append(
        h('button', { type: 'button', class: 'small primary', text: 'Switch', onclick: () => headsUpAction({ action: 'switch', tier: item.tier, model: item.model }, line) }),
        h('button', { type: 'button', class: 'small', text: 'Skip', onclick: () => headsUpAction({ action: 'skip', model: item.model }, line) }));
    }
    line.append(h('span', { class: 'msg' }, title && h('strong', { text: title }), text), actions);
    return line;
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

  // Enter to send in a thread's message box. Saved in this browser only, so a phone and a
  // computer can differ; unset, it is on unless the device is touch-first (thread.js reads it).
  function enterSendsNow() {
    let v = null; try { v = localStorage.getItem('enter-sends'); } catch (e) { /* default below */ }
    if (v === '1' || v === '0') return v === '1';
    return !(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }
  function enterRow() {
    const on = enterSendsNow();
    const group = h('div', { class: 'seg-radio', role: 'radiogroup', 'aria-label': 'Enter to send' },
      [[true, 'On'], [false, 'Off']].map(([value, text]) => h('button', {
        type: 'button', role: 'radio', 'aria-checked': String(on === value), text,
        onclick: () => {
          if (on === value) return;
          try { localStorage.setItem('enter-sends', value ? '1' : '0'); } catch (e) { setNote('This browser would not save it', true); return; }
          paint('enter');
          setNote('Saved for this browser', false);
        },
      })));
    return h('div', { class: 'row-line' },
      h('div', { class: 'what' }, h('span', { text: 'Enter to send' }), h('span', { class: 'hint', text: (on ? 'Enter sends a message; Shift+Enter starts a new line.' : 'Enter starts a new line; send with the button.') + ' Applies to this browser only.' })),
      group);
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

  // Your name: typed, then saved with the button. Blank means agents say "the user".
  function nameRow() {
    const saved = data.user_name || '';
    const input = h('input', { type: 'text', id: 'user-name', 'aria-label': 'Your name', placeholder: 'the user', autocomplete: 'off', maxLength: 80, value: nameDraft === null ? saved : nameDraft });
    const save = h('button', { type: 'button', text: 'Save' });
    const status = h('p', { class: 'note', role: 'status' });
    const host = h('div', { class: 'ctl wide' }, h('div', { class: 'folder' }, input, save), status);
    input.addEventListener('input', () => { nameDraft = input.value; status.textContent = ''; inlineErr(host, ''); });
    const go = async () => {
      save.disabled = true;
      inlineErr(host, '');
      status.textContent = '';
      try {
        const res = await api('/settings/preferences', { method: 'PUT', body: { user_name: input.value.trim() } });
        data.user_name = res.user_name || '';
        nameDraft = null;
        input.value = data.user_name;
        status.textContent = 'Saved';
      } catch (e) { inlineErr(host, e.message); }
      save.disabled = false;
    };
    save.addEventListener('click', go);
    input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); go(); } });
    return h('div', { class: 'row-line' },
      h('div', { class: 'what' }, h('span', { text: 'Your name' }), h('span', { class: 'hint', text: 'Agents call you by it. Blank means they say "the user". Agents started after you save use it.' })),
      host);
  }

  // A titled group of controls: the heading names what used to be a section or a group of one.
  // A heading that repeats its one control's label does not also name the section after it.
  const group = (cls, id, title, ...kids) => h('div', { class: cls },
    h('section', { 'aria-labelledby': ['name-heading', 'names-heading'].includes(id) ? null : id }, h('h2', { id, text: title }), ...kids));
  const rows = (...kids) => h('div', { class: 'box rows' }, ...kids);

  // One segmented choice; each saves its own key through the preferences route and repaints
  // the block it sits in.
  function modeGroup(block, key, label, choices, saved = SAVED) {
    const seg = h('div', { class: 'seg-radio', role: 'radiogroup', 'aria-label': label },
      choices.map(([value, text]) => h('button', {
        type: 'button', role: 'radio', 'aria-checked': String(data[key] === value), text, 'data-focus': `${key}:${value}`,
        onclick: async () => {
          if (data[key] === value) return;
          const row = seg.closest('.row-line');
          try {
            const res = await api('/settings/preferences', { method: 'PUT', body: { [key]: value } });
            data[key] = res[key];
            inlineErr(row, '');
            repaint(block);
            if (key === 'assistant' && res.assistant_error) inlineErr(document.getElementById('assistant-setting'), res.assistant_error);
            setNote(saved, false);
          } catch (e) { inlineErr(row, e.message); setNote('', false); }
        },
      })));
    return seg;
  }
  // The same segmented control, saving one key inside `escalation`.
  function escalationGroup(key, label, choices) {
    const seg = h('div', { class: 'seg-radio', role: 'radiogroup', 'aria-label': label },
      choices.map(([value, text]) => h('button', {
        type: 'button', role: 'radio', 'aria-checked': String(data.escalation[key] === value), text, 'data-focus': `escalation:${key}:${value}`,
        onclick: async () => {
          if (data.escalation[key] === value) return;
          const row = seg.closest('.row-line');
          try {
            const res = await api('/settings/preferences', { method: 'PUT', body: { escalation: { [key]: value } } });
            data.escalation = res.escalation;
            data.escalation_text = res.escalation_text;
            inlineErr(row, '');
            repaint('escalation');
            setNote(SAVED, false);
          } catch (e) { inlineErr(row, e.message); setNote('', false); }
        },
      })));
    return seg;
  }

  // ---------------------------------------------------------------- You

  const renderName = () => group('models', 'name-heading', 'Your name', rows(nameRow()));
  const renderDiagrams = () => group('models', 'diagrams', 'Diagrams', h('div', { class: 'box', id: 'diagram-choices' }));
  const renderEnter = () => group('models', 'enter-heading', 'Enter to send', rows(enterRow()));

  // ---------------------------------------------------------------- Models

  const AGENT_ROLES = [
    ['lead', 'Leads'], ['sub-lead', 'Sub-leads'], ['reviewer', 'Plan reviewers'], ['verifier', 'Checker'],
    ['mapper', 'Code mapping'], ['designer', 'Mockups'],
    ['scout', 'Scout', "Runs on the lead's or sub-lead's provider"],
    ['scout-heavy', 'Scout for bigger changes', "Runs on the sub-lead's provider"],
  ];
  const ASSISTANT_ROLES = [['assistant', 'Personal assistant'], ['project-lead', 'Project leads']];
  const LEAD_FAMILY = ['lead', 'sub-lead', 'assistant', 'project-lead'];
  const ROLE_TIERS = TIERS.map(([value, label]) => [value, label]);
  const TIER_NAME = Object.fromEntries(ROLE_TIERS);

  const modelsSection = (id, title, sub, ...kids) => h('div', { class: 'models m-block' },
    h('section', { 'aria-labelledby': id },
      h('div', { class: 'm-head' }, h('h2', { id, text: title }), sub && h('p', { text: sub })),
      ...kids));

  // Saves to one setting run one after another in the order made. The page shows each change at
  // once; a refused latest save puts back what the hub last accepted.
  function saveInOrder(key, { value, read, write, send, show, fail }) {
    const state = saves[key] || (saves[key] = { queue: Promise.resolve(), ticket: 0, pending: 0, saved: null });
    if (!state.pending) state.saved = structuredClone(read());
    const ticket = ++state.ticket;
    state.pending++;
    write(value);
    show();
    state.queue = state.queue.then(async () => {
      try {
        const res = await send(value);
        state.saved = value;
        state.pending--;
        if (ticket !== state.ticket) return;
        show(res);
        setNote(SAVED, false);
      } catch (e) {
        state.pending--;
        if (ticket === state.ticket) { write(state.saved); show(); }
        fail(e.message);
        setNote('', false);
      }
    });
  }

  const rowError = (row) => (message) => {
    const host = panel.querySelector(`[data-row="${row}"]`);
    if (host) inlineErr(host, message);
  };

  // The notice's rows follow the tiers; read them again while it is showing, or when forced.
  async function refreshDiffs(force) {
    if (!force && !data.legacy_lead_diffs?.length) return;
    try {
      const fresh = await api('/settings');
      data.legacy_lead_diffs = fresh.legacy_lead_diffs;
      repaint('agents');
    } catch { /* the notice stays as drawn */ }
  }

  function saveTier(role, tier) {
    saveInOrder('tier:' + role, {
      value: tier,
      read: () => data.other_agents[role],
      write: (v) => { data.other_agents = { ...data.other_agents, [role]: v }; },
      send: (v) => api('/settings/preferences', { method: 'PUT', body: { other_agents: { [role]: v } } }),
      show: (res) => { repaintPreviews(); if (res) refreshDiffs(); },
      fail: rowError(role),
    });
  }

  function saveRoleOrder(role, order) {
    saveInOrder('order:' + role, {
      value: order,
      read: () => data.provider_orders[role],
      write: (v) => { data.provider_orders = { ...data.provider_orders, [role]: v }; },
      send: (v) => api('/settings/preferences', { method: 'PUT', body: { provider_orders: { [role]: v } } }),
      show: () => repaintPreviews(),
      fail: rowError(role),
    });
  }

  function saveSharedOrder(key, order) {
    saveInOrder(key, {
      value: order,
      read: () => data[key],
      write: (v) => { data[key] = v; },
      send: (v) => api('/settings/balancing', { method: 'PUT', body: { [key]: v } }),
      show: (res) => {
        if (res) { reserveReads++; data.reserved_provider = res.reserved_provider; loadHarnesses(true); }
        repaint('ladders');
        repaintPreviews();
      },
      fail: rowError('ladder:' + key),
    });
  }

  const expandOrder = (entry) => (entry === 'lead' ? data.lead_order : entry === 'worker' ? data.worker_order : entry)
    .flatMap((p) => (p === 'any' ? data.worker_order : [p]));

  // The models a role would run on: its tier's model on every provider its ladder can reach.
  // Scouts have no ladder: they run on whichever provider their lead or sub-lead uses.
  function previewText(role) {
    const entry = data.provider_orders[role];
    const reach = entry ? [...new Set(expandOrder(entry))] : PROVIDERS.map(([p]) => p);
    const tier = data.other_agents[role];
    const parts = reach.filter((p) => PROVIDER_NAME[p] && harnessOn(p)).flatMap((p) => {
      const cell = data.models[p]?.[tier];
      return cell?.model ? [`${PROVIDER_NAME[p]}: ${cell.model}${cell.effort ? ` (${cell.effort})` : ''}`] : [];
    });
    return parts.join(' · ') || 'No provider set for this tier';
  }

  // The enabled providers of a saved order by name, 'any' as itself.
  const orderNames = (order) => order.filter((p) => p === 'any' || (PROVIDER_NAME[p] && harnessOn(p))).map((p) => (p === 'any' ? 'any' : PROVIDER_NAME[p]));

  function orderSummary(entry) {
    if (entry === 'lead') return 'Default: Lead';
    if (entry === 'worker') return 'Default: Worker';
    return 'Custom: ' + (orderNames(entry).join(' → ') || 'no provider switched on');
  }

  // A provider order as an editable list. Switched-off providers are hidden here; they keep their
  // order, and their index in the saved array unless a shorter list moves them up; 'any' ("then whatever's left") stays last.
  function ladderList({ order, name, allowAny, change, attr }) {
    const all = order.filter((p) => p !== 'any');
    const hasAny = order.includes('any');
    const real = all.filter((p) => PROVIDER_NAME[p] && harnessOn(p));
    const left = all.filter((p) => !real.includes(p));
    const missing = PROVIDERS.map(([p]) => p).filter((p) => harnessOn(p) && !real.includes(p));
    const commit = (list) => {
      const total = left.length + list.length;
      const out = new Array(total).fill(null);
      // Capping each at the room the later ones need keeps them in order at the end.
      left.forEach((p, k) => { out[Math.min(all.indexOf(p), total - left.length + k)] = p; });
      const visible = list.slice();
      for (let i = 0; i < total; i++) if (out[i] === null) out[i] = visible.shift();
      change(hasAny && allowAny ? [...out, 'any'] : out);
    };
    const move = (i, d) => { const next = real.slice(); const [item] = next.splice(i, 1); next.splice(i + d, 0, item); commit(next); };
    const button = (text, label, onclick, disabled) => h('button', { type: 'button', text, 'aria-label': label, 'data-focus': `${attr}:${label}`, disabled, onclick });
    return h('div', { class: 'ladder-list', role: 'group', 'aria-label': name, 'data-order': attr },
      h('ol', {}, real.map((p, i) => h('li', { 'data-provider': p },
        h('b', { 'aria-hidden': 'true', text: String(i + 1) }),
        h('span', { text: PROVIDER_NAME[p] }),
        h('div', { class: 'ladder-actions' },
          button('↑', `Move ${PROVIDER_NAME[p]} up`, () => move(i, -1), i === 0),
          button('↓', `Move ${PROVIDER_NAME[p]} down`, () => move(i, 1), i === real.length - 1),
          real.length > 1 && button('Remove', `Leave ${PROVIDER_NAME[p]} out`, () => commit(real.filter((x) => x !== p))))))),
      missing.length ? h('div', { class: 'ladder-add' }, missing.map((p) => h('button', {
        type: 'button', class: 'add-provider', text: `+ ${PROVIDER_NAME[p]}`, 'data-focus': `${attr}:add ${p}`, onclick: () => commit([...real, p]),
      }))) : null,
      allowAny && h('label', { class: 'tail' },
        h('input', { type: 'checkbox', checked: hasAny, 'data-focus': `${attr}:any`, onchange: (ev) => change(ev.target.checked ? [...all, 'any'] : all.slice()) }),
        h('span', { text: "then whatever's left" })));
  }

  // What a role's order starts from when Custom is first picked.
  function customStart(role) {
    const entry = data.provider_orders[role];
    if (LEAD_FAMILY.includes(role)) return (entry === 'lead' ? data.lead_order : data.worker_order).slice();
    return entry === 'worker' ? data.worker_order.slice() : [...new Set(expandOrder('lead'))];
  }

  function orderControl(role, title) {
    const entry = data.provider_orders[role];
    const mode = Array.isArray(entry) ? 'custom' : entry;
    const summary = orderSummary(entry);
    const modes = h('div', { class: 'seg-radio order-mode', role: 'radiogroup', 'aria-label': `${title} provider order` },
      [['lead', 'Default: Lead'], ['worker', 'Default: Worker'], ['custom', 'Custom']].map(([value, text]) => h('button', {
        type: 'button', role: 'radio', 'aria-checked': String(mode === value), text, 'data-focus': `mode:${role}:${value}`,
        onclick: () => { if (mode !== value) saveRoleOrder(role, value === 'custom' ? customStart(role) : value); },
      })));
    const shared = mode === 'lead' ? ['Lead ladder', data.lead_order] : ['Worker ladder', data.worker_order];
    const details = h('details', { class: 'm-order', open: openLadders.has(role) },
      h('summary', { 'aria-label': `${title} provider order: ${summary}`, 'data-focus': `summary:${role}` },
        h('span', { class: 'm-order-text', text: summary }), h('span', { class: 'caret', 'aria-hidden': 'true', text: '▾' })),
      h('div', { class: 'order-editor' },
        h('div', { class: 'order-label', text: 'Provider order' }),
        modes,
        mode === 'custom'
          ? ladderList({ order: entry, name: `${title} custom provider order`, allowAny: LEAD_FAMILY.includes(role), change: (next) => saveRoleOrder(role, next), attr: `role:${role}` })
          : h('p', { class: 'order-resolved', text: `Uses ${shared[0]}: ${orderNames(shared[1]).join(' → ') || 'no provider switched on'}` }),
        role === 'lead' && h('p', { class: 'order-applies', text: 'Applies to new threads' })));
    // One disclosure is open at a time, so their panels never cover each other.
    details.addEventListener('toggle', () => {
      if (!details.isConnected) return;
      if (!details.open) { openLadders.delete(role); return; }
      openLadders.add(role);
      for (const other of panel.querySelectorAll('details.m-order[open]')) if (other !== details) other.open = false;
    });
    details.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Escape' || !details.open) return;
      details.open = false;
      details.querySelector('summary').focus();
    });
    return details;
  }

  function roleRow([role, title, hint]) {
    const tier = data.other_agents[role];
    return h('div', { class: 'm-agent', 'data-row': role },
      h('div', { class: 'm-agent-main' },
        h('div', { class: 'm-id' },
          h('div', { class: 'm-role', text: title }),
          h('div', { class: 'm-preview', 'data-preview': role, text: previewText(role) })),
        h('div', { class: 'm-controls' },
          h('div', { class: 'seg-radio tier-switch', role: 'radiogroup', 'aria-label': `${title} tier` },
            ROLE_TIERS.map(([value, label]) => h('button', {
              type: 'button', role: 'radio', 'aria-checked': String(tier === value), text: label, 'data-focus': `tier:${role}:${value}`,
              onclick: () => { if (data.other_agents[role] !== value) saveTier(role, value); },
            }))),
          hint ? h('span', { class: 'order-note', text: hint }) : orderControl(role, title))));
  }

  function familyRow() {
    return h('div', { class: 'row-line m-family' },
      h('div', { class: 'what' }, h('span', { text: 'Reviewers and checkers' }), h('span', { class: 'hint', text: data.review_families === 'both' ? 'Plan reviewers from two different families; the checker from a family other than the builder\'s. With only one family signed in, one plan reviewer.' : `One plan reviewer and the checker, both on ${PROVIDER_NAME[data.review_families]}.` })),
      modeGroup('agents', 'review_families', 'Reviewers and checkers', [['both', 'Mix families'], ...TOOLS.filter((t) => t.settings.reviewFamily).map((t) => [t.provider, t.label])].filter(([v]) => v === 'both' || harnessOn(v))));
  }

  const modelText = (model, effort) => (model ? model + (effort ? ` (${effort})` : '') : 'Not used');

  // Shown once after the move to tiers: where a saved Lead or Sub-lead model differs from what
  // its role now runs on. Nothing is changed without a press.
  function legacyNotice() {
    const diffs = (data.legacy_lead_diffs || []).filter((d) => harnessOn(d.provider));
    if (!diffs.length) return null;
    const box = h('div', { class: 'm-legacy', role: 'region', 'aria-label': 'Earlier Lead models' });
    const send = async (button, run) => {
      button.disabled = true;
      try { await run(); } catch (e) { button.disabled = false; inlineErr(box, e.message); }
    };
    const use = (d) => async () => {
      const body = { provider: d.provider, slot: d.tier, model: d.legacy_model };
      if (d.legacy_effort) body.effort = d.legacy_effort;
      data.models = (await api('/settings/models', { method: 'PUT', body })).models;
      const fresh = await api('/settings');
      data.models = fresh.models;
      data.model_options = fresh.model_options;
      data.legacy_lead_diffs = fresh.legacy_lead_diffs;
      repaint('agents', 'tiers', 'assistants');
      setNote(SAVED, false);
    };
    const dismiss = async () => {
      await api('/settings/preferences', { method: 'PUT', body: { lead_tier_notice_dismissed: true } });
      data.legacy_lead_diffs = [];
      data.lead_tier_notice_dismissed = true;
      repaint('agents');
    };
    box.append(
      h('p', { class: 'm-legacy-title' }, h('strong', { text: 'Leads now use tiers.' }), ' These saved models differ from what the tier runs:'),
      h('ul', {}, diffs.map((d) => h('li', { 'data-provider': d.provider, 'data-role': d.role },
        h('span', { text: `${d.label} ${d.role} was ${modelText(d.legacy_model, d.legacy_effort)}; ${TIER_NAME[d.tier]} is ${modelText(d.tier_model, d.tier_effort)}` }),
        d.tier_model === null && d.legacy_model !== null && h('button', {
          type: 'button', class: 'small', text: `Use ${d.legacy_model} for ${TIER_NAME[d.tier]}`,
          onclick: (ev) => send(ev.currentTarget, use(d)),
        })))),
      h('button', { type: 'button', class: 'small m-dismiss', text: 'Dismiss', onclick: (ev) => send(ev.currentTarget, dismiss) }));
    return box;
  }

  function renderAgents() {
    const [lead, sub, reviewer, verifier, ...rest] = AGENT_ROLES;
    return modelsSection('agents', 'Agents', 'Choose a tier for each role. Models depend on the provider used.',
      legacyNotice(),
      h('div', { class: 'box m-box' }, [lead, sub, reviewer, verifier].map(roleRow), familyRow(), rest.map(roleRow)),
      h('p', { class: 'm-under', text: 'For threads in the app. Terminal commands keep their own rules.' }));
  }

  function renderAssistants() {
    return modelsSection('assistants', 'Assistants', 'Choose models for conversations outside a thread\'s build.',
      h('div', { class: 'box m-box' }, ASSISTANT_ROLES.map(roleRow)));
  }

  function renderLadders() {
    const column = (key, title, allowAny) => h('div', { class: 'ladder', 'data-row': 'ladder:' + key },
      h('h3', { text: title }),
      ladderList({ order: data[key], name: title, allowAny, change: (next) => saveSharedOrder(key, next), attr: key }));
    return modelsSection('ladders', 'Provider ladders', 'Shared provider orders. Workers always use the Worker ladder; Save for leads in Usage and balancing protects the top provider on the Lead ladder.',
      h('div', { class: 'box ladder-grid' }, column('lead_order', 'Lead ladder', true), column('worker_order', 'Worker ladder', false)));
  }

  function renderTiers() {
    const items = (data.heads_up || []).slice();
    if (data.models.malformed && !items.some((i) => i.kind === 'malformed')) items.unshift({ kind: 'malformed' });
    const lines = items.filter((i) => i.kind === 'malformed' || i.kind === 'tierless').map((i) => headsUpLine(i));
    const enabled = PROVIDERS.filter(([provider]) => harnessOn(provider));
    const title = (...kids) => modelsSection('tiers', 'Tier models', 'Choose the model and effort for each provider.', lines, ...kids);
    if (!enabled.length) {
      return title(h('p', { class: 'm-under' }, 'No provider is switched on. Turn one on under ', h('a', { href: '#providers', text: 'AI providers' }), '.'));
    }
    if (!enabled.some(([provider]) => provider === tierTab)) tierTab = enabled[0][0];
    const tool = toolOf(tierTab);
    const tabs = h('div', { class: 'm-tabs', role: 'tablist', 'aria-label': 'Provider' }, enabled.map(([provider, name]) => h('button', {
      type: 'button', role: 'tab', id: 'tier-tab-' + provider, 'aria-selected': String(provider === tierTab), 'aria-controls': 'tier-panel',
      'data-focus': 'tab:' + provider, text: name,
      onclick: () => { if (tierTab === provider) return; tierTab = provider; repaint('tiers'); },
    })));
    const tierRows = TIERS.map(([slot, label, description]) => h('div', { class: 'model-row', 'data-tier': slot },
      h('div', { class: 'tier-title' }, h('strong', { text: label }), h('span', { class: 'hint', text: description })),
      modelPicker(tierTab, slot),
      tool.settings.modelHeadsUp ? items.filter((i) => i.tier === slot && (i.kind === 'newer' || i.kind === 'available')).map((i) => headsUpLine(i, label)) : null));
    return title(
      h('div', { class: 'box m-box' }, tabs,
        h('div', { id: 'tier-panel', role: 'tabpanel', 'aria-labelledby': 'tier-tab-' + tierTab, 'data-provider': tierTab },
          tool.settings.familyHint && h('p', { class: 'm-family-hint hint', text: tool.settings.familyHint }),
          tierRows)),
      h('p', { class: 'm-under', text: '"Not used" prevents this provider from starting at that tier. CLI default leaves effort to the CLI.' }));
  }

  function renderEscalation() {
    const escRow = (title, key, choices) => h('div', { class: 'row-line' },
      h('div', { class: 'what' }, h('span', { text: title })),
      escalationGroup(key, title, choices));
    return modelsSection('escalation', 'Escalation', null,
      h('div', { class: 'box m-box' },
        h('div', { class: 'escalation-text' },
          String(data.escalation_text || '').split('\n').filter(Boolean).map((line) => h('p', { text: line }))),
        h('div', { class: 'esc-grid' },
          escRow('What steps up first', 'first', [['effort', 'Effort'], ['model', 'Model']]),
          escRow('Highest effort', 'max_effort', [['high', 'High'], ['xhigh', 'xhigh'], ['max', 'Max']]),
          escRow('Highest tier', 'max_tier', [['standard', 'Standard'], ['heavy', 'Heavy'], ['critical', 'Critical']]),
          escRow('Ask me before', 'ask_before', [['never', 'Never'], ['critical', 'Critical'], ['any', 'Any step up']]))),
      h('p', { class: 'm-under', text: 'Applies to builds started afterwards.' }));
  }

  // ---------------------------------------------------------------- Assistant and project leads

  function renderConversations() {
    const assistantRow = h('div', { class: 'row-line', id: 'assistant-setting' },
      h('div', { class: 'what' }, h('span', { text: 'Personal assistant' }), h('span', { class: 'hint', text: 'An assistant that sees all your threads and acts on what you tell it.' })),
      modeGroup('conversations', 'assistant', 'Personal assistant', [['off', 'Off'], ['on', 'On']], 'Saved'));
    const projectLeadsRow = h('div', { class: 'row-line', id: 'project-leads-setting' },
      h('div', { class: 'what' }, h('span', { text: 'Project leads' }), h('span', { class: 'hint', text: 'A lead for each project that knows its threads and its work. Starts when you first send it a message.' })),
      modeGroup('conversations', 'project_leads', 'Project leads', [['off', 'Off'], ['on', 'On']], 'Saved'));
    return group('models', 'conversations', 'Conversations', rows(assistantRow, projectLeadsRow));
  }

  // ---------------------------------------------------------------- Threads

  function renderThreadView() {
    const AUTO_MERGE_HINT = 'When on, a thread merges its own pull request once an agent has seen at least one Check it yourself step work and none broke. A thread where you chose to push something that failed its check, or a thread handed over from another machine, is never merged automatically. It applies to pull requests checked after it is turned on. It never merges past failing checks, conflicts or GitHub\'s rules.';
    return group('models', 'thread-view', 'Threads', rows(
      h('div', { class: 'row-line' },
        h('div', { class: 'what' }, h('span', { text: 'Tool steps' }), h('span', { class: 'hint', text: data.tool_steps === 'hide' ? 'Hidden: a thread shows only messages and cards.' : 'Commands and file reads show as folded lines between messages.' })),
        modeGroup('thread-view', 'tool_steps', 'Tool steps', [['show', 'Show'], ['hide', 'Hide']])),
      h('div', { class: 'row-line' },
        h('div', { class: 'what' }, h('span', { text: 'Merge pull requests when done' }), h('span', { class: 'hint', text: AUTO_MERGE_HINT })),
        modeGroup('thread-view', 'auto_merge', 'Merge pull requests when done', [['off', 'Off'], ['on', 'On']], 'Saved')),
      data.auto_merge === 'on' ? h('div', { class: 'row-line' },
        h('div', { class: 'what' }, h('span', { text: 'Delete the branch after merging' }), h('span', { class: 'hint', text: 'When a thread merges its own pull request, it also deletes that branch on GitHub. The thread keeps its own copy on this machine.' })),
        modeGroup('thread-view', 'auto_merge_delete_branch', 'Delete the branch after merging', [['off', 'Off'], ['on', 'On']], 'Saved')) : null,
      folderRow()));
  }

  function renderPermission() {
    const permissionNames = (mode) => {
      const names = TOOLS.filter((t) => t.settings.permissionMode === mode).map((t) => t.settings.permissionName);
      return names.length < 2 ? (names[0] || '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
    };
    const permissionChoices = (mode) => (TOOLS.find((t) => t.settings.permissionMode === mode) || { settings: {} }).settings.permissionChoices || [];
    const permissionModeName = permissionNames('permission_mode');
    const codexModeName = permissionNames('codex_mode');
    const claudeMode = modeGroup('permission', 'permission_mode', `${permissionModeName} permission mode`, permissionChoices('permission_mode'));
    const codexMode = modeGroup('permission', 'codex_mode', `${codexModeName} permission mode`, permissionChoices('codex_mode'));
    const asideMode = modeGroup('permission', 'aside_access', 'Aside access', [['read-only', 'Read-only'], ['full', 'Full']]);
    const asideHint = data.aside_access === 'full'
      ? 'Never asks, no sandbox: an aside can read anywhere, run commands and change files.'
      : 'Reads files in the thread\'s worktree only. Runs no commands.';
    const codexHint = data.codex_mode === 'unrestricted'
      ? 'Never asks, no sandbox: it can change anything on the machine. Reviewers stay read-only.'
      : 'Never asks: it can write only inside its worktree.';
    return group('models', 'perm', 'Permission mode', rows(
      h('div', { class: 'row-line' },
        h('div', { class: 'what' }, h('span', { text: `${permissionModeName} sessions` })),
        claudeMode),
      h('div', { class: 'row-line' },
        h('div', { class: 'what' }, h('span', { text: `${codexModeName} sessions` }), h('span', { class: 'hint', text: codexHint })),
        codexMode),
      h('div', { class: 'row-line' },
        h('div', { class: 'what' }, h('span', { text: 'Asides' }), h('span', { class: 'hint', text: asideHint })),
        asideMode)));
  }

  const renderLeadNames = () => group('models', 'names-heading', 'Lead names', rows(leadNamesRow()));

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
    if (isLessons(id)) { lessonEdit = { role: id.slice(8), texts: {}, removals: new Set(), confirming: null, history: new Set() }; draft = null; loadLessonThreads(); return; }
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
      paint('templates');
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
      paint('templates');
      setNote('Duplicated.', false);
    } catch (e) { inlineErr(errHost, e.message); }
  }

  async function deleteTemplate(errHost) {
    try {
      await api('/settings/templates/' + encodeURIComponent(draft.id), { method: 'DELETE' });
      await reload(false);
      select(data.templates[0] ? data.templates[0].id : 'new');
      paint('templates');
      setNote('Deleted.', false);
    } catch (e) { inlineErr(errHost, e.message); }
  }

  async function toggleInUse(errHost) {
    try {
      await api('/settings/templates/' + encodeURIComponent(draft.id), { method: 'PUT', body: { in_use: !draft.in_use } });
      await reload(true);
      paint('templates');
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
    const joinNames = names => names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
    const instructionsNames = joinNames(TOOLS.filter(t => t.settings.roleInstructionsName).map(t => t.settings.roleInstructionsName));
    const fileNames = joinNames(TOOLS.filter(t => t.typesRoleMessage).map(t => t.label));
    return h('div', { class: 'full-prompt-wrap' },
      h('pre', { id: 'full-prompt', class: 'full', text: fullPrompt.text }),
      h('span', { class: 'hint', id: 'full-prompt-caption', text: `${instructionsNames} gets this as its starting instructions; ${fileNames} sessions get it as a file, through a short first message that points to it. Lessons marked for one AI or one project reach only agents on that AI or in that project.` }));
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
      paint('templates');
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
    stuck.addEventListener('change', () => { sw.unsettled = stuck.value; paint('templates'); });
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
      h('div', { class: 'layer', id: 'layer-lessons' }, h('span', { class: 'n', text: '2' }),
        h('span', { class: 't' }, h('span', { text: `Lessons learned for ${role[3]}` }), h('span', { class: 'hint', text: `Saved by agents as they go, no Save needed. A lesson reaches ${role[3]} started after it is saved, only on the AI and in the project it is marked for, if any` })),
        h('span', { class: 'state', text: 'automatic' })),
      h('div', { class: 'layer mine' }, h('span', { class: 'n', text: '3' }),
        h('span', { class: 't' }, layerName, h('span', { class: 'hint', text: 'The switches above and your own words' })),
        h('span', { class: 'state', text: 'editing' })),
      h('div', { class: 'layer' }, h('span', { class: 'n', text: '4' }),
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
      : h('button', { type: 'button', class: 'danger', id: 'delete', text: 'Delete', onclick: () => { confirming = true; paint('templates'); } });

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

  // ---------------------------------------------------------------- Lessons learned (written by agents)

  const LESSON_PLURAL = { lead: 'leads', 'sub-lead': 'sub-leads', worker: 'workers', reviewer: 'reviewers', verifier: 'verifiers', mapper: 'mappers', designer: 'designers' };
  const isLessons = (id) => typeof id === 'string' && id.startsWith('lessons:');
  const lessonList = (role) => (data.lessons && data.lessons[role]) || [];

  async function loadLessonThreads() {
    try {
      const res = await api('/threads?view=list');
      lessonThreads = Object.fromEntries((res.threads || []).map((t) => [t.id, t.title || t.slug || String(t.project || '').split('/').filter(Boolean).pop() || t.id]));
      if (lessonEdit) paint('templates');
    } catch { lessonThreads = lessonThreads || {}; }
  }

  function lessonMarkers(item) {
    const marks = [];
    if (item.provider) marks.push('only on ' + ((PROVIDERS.find((p) => p[0] === item.provider) || [])[1] || item.provider));
    if (item.project) marks.push('only in ' + (item.project.split('/').filter(Boolean).pop() || item.project));
    if (item.saved_by === 'user') marks.push('edited by the user');
    return marks;
  }

  async function saveLessons(errHost) {
    const role = lessonEdit.role;
    const list = lessonList(role);
    const edits = [];
    for (const item of list) {
      if (lessonEdit.removals.has(item.id)) continue;
      const text = lessonEdit.texts[item.id];
      if (text === undefined || text === item.text) continue;
      if (!text.length || text.length > 300) { inlineErr(errHost, 'A lesson needs 1 to 300 characters.'); return; }
      edits.push({ id: item.id, text });
    }
    const removals = [...lessonEdit.removals];
    lessonEdit.saving = true;
    setLessonsBusy(true);
    try {
      await api('/settings/lessons/' + encodeURIComponent(role), { method: 'PUT', body: { edits, removals } });
      await reload(false);
      lessonEdit = { role, texts: {}, removals: new Set(), confirming: null, history: lessonEdit.history };
      setNote(SAVED, false);
      paint('templates');
    } catch (e) {
      lessonEdit.saving = false;
      setLessonsBusy(false);
      inlineErr(errHost, e.message);
    }
  }

  // While a save is in flight nothing can be typed, so no edit is lost.
  function setLessonsBusy(busy) {
    document.querySelectorAll('.lessons-edit .lesson-text, .lessons-edit .lesson-row button, #save-lessons').forEach((n) => {
      const row = n.closest('.lesson-row');
      n.disabled = busy || (n.matches('.lesson-text') && !!row && lessonEdit.removals.has(row.dataset.id));
    });
    // Idle again: the buttons the renderer disables by a rule get that rule back.
    if (!busy) { refreshRestore(); refreshAdd(); }
  }

  const STALE_MS = 90 * 24 * 3600 * 1000;
  const lessonStaleSince = (item) => Math.max(Date.parse(item.saved_at) || 0, Date.parse(item.kept_at) || 0);
  const lessonStale = (item) => Date.now() - lessonStaleSince(item) >= STALE_MS;
  const shortDate = (iso) => { const d = new Date(iso); return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : ''; };
  const lessonHistory = (role) => Object.entries(data.lesson_history || {}).filter(([, e]) => e.role === role);
  const lessonRemoved = (role) => lessonHistory(role).filter(([, e]) => e.removed && e.versions.length).sort((a, b) => Date.parse(b[1].removed.at) - Date.parse(a[1].removed.at));
  const lessonWaiting = (role) => (data.lesson_waiting || []).filter((w) => w.role === role);
  const lessonFull = (role) => lessonList(role).length >= 12;
  const lessonDirty = () => !!lessonEdit && (lessonEdit.removals.size > 0 || lessonList(lessonEdit.role).some((item) => lessonEdit.texts[item.id] !== undefined && lessonEdit.texts[item.id] !== item.text));

  // Every lessons route answers { lessons, history, waiting } for the role; take them in as they are.
  function applyLessonReply(role, res) {
    data.lessons = { ...(data.lessons || {}), [role]: res.lessons || [] };
    data.lesson_history = Object.fromEntries([...Object.entries(data.lesson_history || {}).filter(([, e]) => e.role !== role), ...Object.entries(res.history || {})]);
    data.lesson_waiting = [...(data.lesson_waiting || []).filter((w) => w.role !== role), ...(res.waiting || [])];
  }

  async function lessonAction(route, body, errHost) {
    const role = lessonEdit.role;
    inlineErr(errHost, '');
    const before = Object.fromEntries(lessonList(role).map((i) => [i.id, i.text]));
    try {
      const res = await api('/settings/lessons/' + encodeURIComponent(role) + '/' + route, { method: 'POST', body });
      applyLessonReply(role, res);
      const lost = keepLessonEdits(before);
      if (lost.length) {
        setNote('', false);
        paint('templates');
        showLessonLost(lost);
        return;
      }
      setNote(res.result === 'already' ? 'Already in your lessons' : SAVED, false);
      paint('templates');
    } catch (e) {
      if (e.status === 409) {
        await reload(false);
        const lost = keepLessonEdits(before);
        paint('templates');
        if (showLessonLost(lost, [e.message])) return;
      }
      inlineErr(errHost, e.message);
    }
  }

  // After a server reply, keep unsaved text (differing from what was shown before) and pending removals for lessons that still exist.
  // Returns the typed texts dropped because their lesson is gone.
  const lostSentences = (lost) => lost.map((t) => `An agent removed a lesson you were editing. Your unsaved text was: \u201c${t}\u201d`).join('\n');
  // Show dropped drafts (and any extra lines) in the re-rendered editor's error host; false when nothing was shown.
  function showLessonLost(lost, extra = []) {
    const host = document.querySelector('.lessons-edit .lesson-err');
    if (!host || (!lost.length && !extra.length)) return false;
    inlineErr(host, [...lostSentences(lost).split('\n').filter(Boolean), ...extra].join('\n'));
    host.querySelector('.inline-err').style.whiteSpace = 'pre-line';
    return true;
  }
  const shownLessonTexts = () => lessonEdit ? Object.fromEntries(lessonList(lessonEdit.role).map((i) => [i.id, i.text])) : null;
  function keepLessonEdits(before) {
    const ids = new Set(lessonList(lessonEdit.role).map((i) => i.id));
    const lost = Object.entries(lessonEdit.texts).filter(([id, t]) => !ids.has(id) && t !== before[id] && typeof t === 'string' && t !== '').map(([, t]) => t);
    lessonEdit.texts = Object.fromEntries(Object.entries(lessonEdit.texts).filter(([id, t]) => ids.has(id) && t !== before[id]));
    lessonEdit.removals = new Set([...lessonEdit.removals].filter((id) => ids.has(id)));
    return lost;
  }

  // Restore waits for the editor to be saved or undone; typing must not re-render, so toggle in place.
  function refreshRestore() {
    const dirty = lessonDirty();
    document.querySelectorAll('.lessons-edit .restore-lesson').forEach((b) => { b.disabled = dirty || !!lessonEdit.saving; });
    const hint = document.getElementById('restore-hint');
    if (hint) hint.hidden = !(dirty && document.querySelector('.lessons-edit .restore-lesson'));
  }

  // Add waits for room in a full role; same rule the waiting section renders with.
  function refreshAdd() {
    const full = lessonFull(lessonEdit.role);
    document.querySelectorAll('.lessons-edit .add-waiting').forEach((b) => { b.disabled = full || !!lessonEdit.saving; b.title = full ? 'Remove one first' : ''; });
  }

  function versionRows(id, entry, errHost, dirty) {
    const open = lessonEdit.history && lessonEdit.history.has(id);
    if (!open) return null;
    return h('ul', { class: 'lesson-versions' }, [...entry.versions].reverse().map((v) => h('li', { class: 'lesson-version', 'data-vid': v.vid },
      h('p', { class: 'lesson-version-text', text: v.text }),
      h('div', { class: 'lesson-foot' },
        h('span', { class: 'lesson-marks' },
          lessonMarkers({ ...v, saved_by: 'agent' }).map((m) => h('span', { class: 'lesson-mark', text: m })),
          h('span', { class: 'lesson-mark', text: `replaced by ${v.changed_by === 'user' ? 'you' : 'an agent'} ${shortDate(v.changed_at)}` })),
        h('button', { type: 'button', class: 'restore-lesson', text: 'Restore', disabled: dirty || !!lessonEdit.saving, onclick: () => lessonAction('restore', { id, vid: v.vid }, errHost) })))));
  }

  function historyToggle(id, n) {
    if (!n) return null;
    const open = lessonEdit.history && lessonEdit.history.has(id);
    return h('button', { type: 'button', class: 'history-toggle', 'aria-expanded': String(!!open), text: `History (${n})`, onclick: () => {
      lessonEdit.history = lessonEdit.history || new Set();
      if (open) lessonEdit.history.delete(id); else lessonEdit.history.add(id);
      paint('templates');
    } });
  }

  function renderRemoved(role, errHost, dirty) {
    const removed = lessonRemoved(role);
    if (!removed.length) return null;
    return h('section', { class: 'lesson-removed' },
      h('h3', { text: 'Removed' }),
      h('ul', { class: 'lesson-rows' }, removed.map(([id, entry]) => {
        const last = entry.versions[entry.versions.length - 1];
        return h('li', { class: 'lesson-row removed-row', 'data-id': id },
          h('p', { class: 'lesson-version-text', text: last.text }),
          h('div', { class: 'lesson-foot' },
            h('span', { class: 'lesson-marks' },
              lessonMarkers({ ...last, saved_by: 'agent' }).map((m) => h('span', { class: 'lesson-mark', text: m })),
              h('span', { class: 'lesson-mark', text: `removed by ${entry.removed.by === 'user' ? 'you' : 'an agent'} ${shortDate(entry.removed.at)}` })),
            h('span', { class: 'lesson-buttons' },
              historyToggle(id, entry.versions.length),
              h('button', { type: 'button', class: 'restore-lesson', text: 'Restore', disabled: dirty || !!lessonEdit.saving, onclick: () => lessonAction('restore', { id, vid: last.vid }, errHost) }))),
          versionRows(id, entry, errHost, dirty));
      })));
  }

  function renderWaiting(role, errHost) {
    const waiting = lessonWaiting(role);
    if (!waiting.length) return null;
    const full = lessonFull(role);
    return h('section', { class: 'lesson-waiting' },
      h('h3', { text: 'Waiting to add' }),
      full ? h('p', { class: 'hint', text: 'Remove one first' }) : null,
      h('ul', { class: 'lesson-rows' }, waiting.map((w) => h('li', { class: 'lesson-row waiting-row', 'data-wid': w.wid },
        h('p', { class: 'lesson-version-text', text: w.text }),
        h('div', { class: 'lesson-foot' },
          h('span', { class: 'lesson-marks' },
            lessonMarkers({ ...w, saved_by: 'agent' }).map((m) => h('span', { class: 'lesson-mark', text: m })),
            h('span', { class: 'lesson-mark', text: w.source === 'handoff' ? 'from a handoff' : 'from a file' })),
          h('span', { class: 'lesson-buttons' },
            h('button', { type: 'button', class: 'add-waiting', text: 'Add', title: full ? 'Remove one first' : '', disabled: full || !!lessonEdit.saving, onclick: () => lessonAction('waiting', { wid: w.wid, action: 'add' }, errHost) }),
            h('button', { type: 'button', class: 'discard-waiting', text: 'Discard', disabled: !!lessonEdit.saving, onclick: () => lessonAction('waiting', { wid: w.wid, action: 'discard' }, errHost) })))))));
  }

  async function exportLessons() {
    try {
      const res = await fetch(API + '/settings/lessons/export');
      if (!res.ok) throw new Error('Could not export the lessons.');
      const url = URL.createObjectURL(await res.blob());
      const a = h('a', { href: url, download: 'wheelchair-lessons.json' });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setNote(e.message, true); }
  }

  async function importLessons(file) {
    let lost = [];
    try {
      let res;
      try { res = await fetch(API + '/settings/lessons/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: await file.arrayBuffer() }); } catch { throw new Error('Could not reach the hub.'); }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || body.error || body.message || ('http ' + res.status));
      let text = `Added ${body.added}, skipped ${body.skipped} already here or removed or changed here, ${body.waiting} waiting for room`;
      if (body.invalid > 0) text += `, ${body.invalid} unreadable`;
      if (body.unknown_project > 0) text += `, ${body.unknown_project} for projects not on this machine (add the project, then import the file again)`;
      const before = shownLessonTexts();
      await reload(false);
      setNote(text, false);
      lost = before ? keepLessonEdits(before) : [];
    } catch (e) { setNote(e.message, true); }
    paint('templates');
    showLessonLost(lost);
  }

  function lessonsTools() {
    const input = h('input', { type: 'file', id: 'import-lessons-file', accept: '.json,application/json', hidden: true });
    input.addEventListener('change', () => { const f = input.files && input.files[0]; input.value = ''; if (f) importLessons(f); });
    return h('div', { class: 'lessons-tools' },
      h('button', { type: 'button', id: 'export-lessons', text: 'Export lessons', onclick: exportLessons }),
      h('button', { type: 'button', id: 'import-lessons', text: 'Import lessons', onclick: () => input.click() }),
      input);
  }

  function renderLessonEditor() {
    const role = lessonEdit.role;
    const plural = LESSON_PLURAL[role] || role + 's';
    const list = lessonList(role);
    const errHost = h('div', { class: 'lesson-err' });
    const dirty = lessonDirty();
    const rows = list.map((item) => {
      const entry = (data.lesson_history || {})[item.id];
      const removed = lessonEdit.removals.has(item.id);
      const value = lessonEdit.texts[item.id] !== undefined ? lessonEdit.texts[item.id] : item.text;
      const field = h('textarea', { class: 'lesson-text', rows: 2, maxLength: 300, value, disabled: removed || !!lessonEdit.saving, 'aria-label': 'Lesson text' });
      field.addEventListener('input', () => { lessonEdit.texts[item.id] = field.value; refreshRestore(); });
      const marks = lessonMarkers(item);
      const title = item.thread && lessonThreads && lessonThreads[item.thread];
      let remove;
      if (removed) remove = h('button', { type: 'button', class: 'undo-remove', text: 'Undo', disabled: !!lessonEdit.saving, onclick: () => { lessonEdit.removals.delete(item.id); paint('templates'); } });
      else if (lessonEdit.confirming === item.id) remove = h('button', { type: 'button', class: 'danger confirm-remove', text: 'Really remove', disabled: !!lessonEdit.saving, onclick: () => { lessonEdit.removals.add(item.id); lessonEdit.confirming = null; paint('templates'); } });
      else remove = h('button', { type: 'button', class: 'danger remove-lesson', text: 'Remove', disabled: !!lessonEdit.saving, onclick: () => { lessonEdit.confirming = item.id; paint('templates'); } });
      return h('li', { class: 'lesson-row' + (removed ? ' removed' : ''), 'data-id': item.id },
        field,
        h('div', { class: 'lesson-foot' },
          h('span', { class: 'lesson-marks' },
            marks.map((m) => h('span', { class: 'lesson-mark', text: m })),
            title ? h('a', { class: 'lesson-from', href: '/wheelchair/app/thread?id=' + encodeURIComponent(item.thread), text: 'saved from ' + title }) : null,
            removed ? h('span', { class: 'lesson-mark', text: 'will be removed when you save' }) : null),
          h('span', { class: 'lesson-buttons' }, entry ? historyToggle(item.id, entry.versions.length) : null, remove)),
        lessonStale(item) ? h('div', { class: 'lesson-stale' },
          h('span', { class: 'lesson-mark', text: 'Possibly out of date: not changed or kept since ' + shortDate(new Date(lessonStaleSince(item)).toISOString()) }),
          h('button', { type: 'button', class: 'keep-lesson', text: 'Keep', disabled: !!lessonEdit.saving, onclick: () => lessonAction('keep', { id: item.id }, errHost) })) : null,
        entry ? versionRows(item.id, entry, errHost, dirty) : null);
    });
    return h('div', { class: 'tpl-edit lessons-edit' },
      noteEl(),
      h('h2', { text: 'Lessons learned · ' + (roleInfo(role)[1]) }),
      h('p', { class: 'hint', id: 'lessons-live', text: `Agents save these as they go, and nothing waits for you. A lesson reaches ${plural} started after it is saved, only on the AI and in the project it is marked for, if any. Saving on this screen is only for your own edits and removals.` }),
      h('p', { class: 'hint lesson-warning', text: 'Agents keep this list up to date. Editing is not recommended; a lesson you edit is marked as yours and agents leave it alone.' }),
      list.length ? h('ul', { class: 'lesson-rows' }, rows) : h('p', { class: 'empty-note', text: `No lessons for ${plural} right now.` }),
      list.length ? h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'primary', id: 'save-lessons', text: 'Save', disabled: !!lessonEdit.saving, onclick: () => saveLessons(errHost) }),
        h('span', { class: 'grow', id: 'using', text: `Changes apply to ${plural} started after you save.` })) : h('p', { class: 'hint', id: 'using', text: `There is nothing to edit until an agent saves a lesson for ${plural}.` }),
      h('p', { class: 'hint', id: 'restore-hint', hidden: !(dirty && (list.some((i) => (data.lesson_history || {})[i.id]) || lessonRemoved(role).length)), text: 'Save or undo your changes first' }),
      renderRemoved(role, errHost, dirty),
      renderWaiting(role, errHost),
      errHost);
  }

  function renderTemplates() {
    if (selected === null) select(data.templates[0] ? data.templates[0].id : 'new');
    const list = h('nav', { class: 'tpl-list', 'aria-label': 'Templates' },
      h('h2', { text: 'Behavior templates' }),
      h('p', { class: 'hint', text: "How each kind of agent works, on top of wheelchair's own rules." }),
      h('button', { type: 'button', class: 'new', id: 'new-template', text: '+ New template', onclick: () => { select('new'); paint('templates'); } }),
      lessonsTools());
    for (const [role, label] of ROLES) {
      const items = data.templates.filter((t) => t.role === role);
      const lessons = lessonList(role);
      const waitingN = lessonWaiting(role).length;
      if (!items.length && !lessons.length && !lessonRemoved(role).length && !waitingN) continue;
      list.append(h('span', { class: 'group-label', text: label }));
      if (lessons.length || lessonRemoved(role).length || waitingN) {
        const staleN = lessons.filter(lessonStale).length;
        const id = 'lessons:' + role;
        list.append(h('button', {
          type: 'button', class: 'tpl-item tpl-lessons', 'data-lessons': role, 'aria-current': String(selected === id),
          onclick: () => { select(id); paint('templates'); },
        }, h('span', { class: 'nm', text: 'Lessons learned' }), h('span', { class: 'tag agent-tag', text: 'Written by agents · ' + lessons.length + (staleN ? ` · ${staleN} may be out of date` : '') + (waitingN ? ` · ${waitingN} waiting to add` : '') })));
      }
      for (const t of items) {
        const tags = [];
        if (t.in_use) tags.push(t.scope === 'all' ? 'in use' : 'in use here');
        if (t.scope_missing) tags.push('project no longer listed');
        list.append(h('button', {
          type: 'button', class: 'tpl-item', 'data-id': t.id, 'aria-current': String(selected === t.id),
          onclick: () => { select(t.id); paint('templates'); },
        }, h('span', { class: 'nm', text: t.name }), h('span', { class: 'tag', text: tags.join(' · ') })));
      }
    }
    return h('div', { class: 'tpl' }, list, lessonEdit && isLessons(selected) ? renderLessonEditor() : draft ? renderEditor() : h('p', { class: 'empty-note', text: 'No templates yet.' }));
  }

  // ---------------------------------------------------------------- Writing style

  const LENGTHS = [['short', 'Short'], ['balanced', 'Balanced'], ['thorough', 'Thorough']];
  const LISTS = [['prose', 'Mostly prose'], ['when-helpful', 'When it helps scanning'], ['always', 'Always']];
  const TERMS = [['build-up', 'Plain words first, build up if needed'], ['freely', 'Use freely'], ['avoid', 'Avoid entirely']];
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
        h('h2', { text: 'Writing style' }),
        h('p', { class: 'lede', text: 'How leads write to you. Only leads follow this: sub-leads, workers, reviewers and checkers never write to you, so they skip it and keep their full attention on the work.' }),
        h('div', { class: 'covers' }, h('span', { class: 'lbl', text: 'Covers:' }),
          ['Thread messages', 'Question cards', 'Plan approved and Done cards'].map((t) => h('span', { class: 'chip', text: t })))),
      h('section', { 'aria-labelledby': 'basics' },
        h('h2', { id: 'basics', text: 'Basics' }),
        h('div', { class: 'box rows' },
          row('Length', '', radios('Length', LENGTHS, 'length')),
          row('Lists and headings', '', radios('Lists and headings', LISTS, 'lists')),
          row('Technical terms', 'How the lead handles technical terms', h('div', { class: 'ctl wide' }, terms)))),
      h('section', { 'aria-labelledby': 'ban' },
        h('h2', { id: 'ban', text: 'Never say' }),
        h('div', { class: 'box ban' }, chips,
          h('span', { class: 'hint', text: 'This takes over from the old wording list, and only leads see it now.' }))),
      h('section', {},
        h('label', { class: 'own-words', for: 'style-text', text: 'In your own words' }),
        own,
        count),
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
            paint('writing');
          } catch (e) { styleNote = ''; saved.textContent = ''; inlineErr(errHost, e.message); }
        } }),
        h('span', { class: 'hint', text: 'Leads pick it up on their next message.' }),
        saved),
      errHost);
    queueMicrotask(paintPreview);
    return out;
  }

  // ---------------------------------------------------------------- Accounts, Usage, lead order

  const PLAN_OPTIONS = Object.fromEntries(TOOLS.map((t) => [t.provider, t.settings.plans]));
  const planLabel = (provider, plan) => ((PLAN_OPTIONS[provider] || []).find((p) => p[0] === plan) || [0, plan])[1];
  const PROVIDER_NAME = Object.fromEntries(TOOLS.map((t) => [t.provider, t.label]));
  const WITHIN = [['soonest', 'Soonest refill first'], ['spread', 'Spread evenly'], ['one', 'Stay on one account']];
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
  let balNote = '';           // the balancing box's report of its last Save
  let signCard = null;         // {account, machine, el, timers…} while a sign-in card is open
  let usageAsks = 0;           // only the newest usage request's answer is kept
  let reserveReads = 0;        // a Save outdates a reserved-provider read still on its way

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
  const usd = (n) => (n > 0 && n < 0.005 ? '<$0.01' : '$' + n.toFixed(2));
  const spendText = (sp) => {
    const none = !sp.today && !sp.last_7_days && !sp.last_30_days;
    const line = none && !sp.incomplete ? 'no spend yet' : `${usd(sp.today)} today · ${usd(sp.last_7_days)} last 7 days · ${usd(sp.last_30_days)} last 30 days`;
    return line + (sp.incomplete ? ' · total may be incomplete' : '');
  };
  // OpenRouter sign-in is key only: waiting, no link, and the machine wants the key pasted.
  const keyOnlySignin = (st) => st.state === 'waiting' && !st.url && st.wantsCode === true;
  const signinHint = (st, tool) => (st.url ? (st.wantsCode ? 'Open the link, sign in, then paste the code it shows.' : 'Open the link and sign in.') : (tool || TOOLS.find((t) => t.settings.signInKind === 'key')).settings.keyPrompt);
  const safeHref = (u) => (/^https?:\/\//i.test(String(u)) ? String(u) : '#');

  // A repaint of Accounts would drop what is being typed, so it waits while a form is open.
  function accountsBusy() {
    const focused = document.activeElement;
    const typing = focused && blockHost('accounts')?.contains(focused) && /^(INPUT|SELECT|TEXTAREA)$/.test(focused.tagName);
    return Boolean(editing || adding || typing);
  }

  async function refreshUsage() {
    const ask = ++usageAsks;
    let next = null; let failure = '';
    try { next = await api('/usage'); } catch (e) { failure = e.message; }
    if (ask !== usageAsks) return;
    if (next) usage = next;
    usageError = failure;
    paint('usage');
    if (!accountsBusy() && !(signCard && signCard.waiting && signCard.el.isConnected && blockHost('accounts')?.contains(signCard.el))) paint('accounts');
  }

  // After a sign-in or an account change. The hub keeps each machine's answer for 15 seconds;
  // the fresh harness read drops it, so it goes first and the usage read after it is current too.
  async function refreshStatus() {
    await loadHarnesses(true);
    await refreshUsage();
  }

  // Each category's live work runs only while it is open: Harnesses polling and the account
  // readings in AI providers, the readings in Usage and balancing.
  function syncSection() {
    if (section === 'providers') enterHarnesses(); else stopHarnesses();
    const live = section === 'providers' || section === 'usage';
    if (live && !usageTimer) usageTimer = window.wcPoller(refreshUsage, 30000);
    if (!live && usageTimer) { usageTimer.stop(); usageTimer = null; }
    if (live) refreshUsage();
    if (section === 'usage') {
      readReserved();
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
    refreshStatus();
  }

  // `atCards` opens the card with the provider's account cards (the Harnesses link), not at the
  // top of Accounts (a card's own Sign in).
  function openSignin(account, machine, atCards) {
    closeSignin();
    const terminal = `/wheelchair/app/terminal?login=${encodeURIComponent(account.id)}&machine=${encodeURIComponent(machine)}`;
    const status = h('p', { class: 'hint waiting', role: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), document.createTextNode('Starting sign-in on ' + machine + '…'));
    const actions = h('div', { class: 'actions signin-actions' });
    const codeBox = h('div', { class: 'signin-code' });
    const paste = h('textarea', { rows: 2, 'aria-label': 'Paste the code from the sign-in page', placeholder: 'Paste the code here' });
    const keyPrompt = ((toolOf(account.provider).settings.signInKind === 'key' ? toolOf(account.provider) : TOOLS.find((t) => t.settings.signInKind === 'key')) || { settings: { keyPrompt: '' } }).settings.keyPrompt;
    const keyInput = h('input', { type: 'password', class: 'ctl', autocomplete: 'off', 'aria-label': keyPrompt, placeholder: keyPrompt, hidden: true });
    const activeField = () => (keyInput.hidden ? paste : keyInput);
    const send = h('button', { type: 'button', class: 'primary small', text: 'Send code', onclick: async () => {
      const field = activeField();
      const code = field.value.trim();
      if (!code) return;
      try { await api(`/accounts/${encodeURIComponent(account.id)}/signin/${encodeURIComponent(machine)}/code`, { method: 'POST', body: { code } }); field.value = ''; status.textContent = 'Code sent.'; inlineErr(codeBox, ''); }
      catch (e) {
        inlineErr(codeBox, e.message);
        if (e.status === 409 && toolOf(account.provider).settings.signInKind === 'key') {
          field.value = '';
          if (!codeBox.querySelector(':scope > .restart')) codeBox.append(h('button', { type: 'button', class: 'small restart', text: 'Start again', onclick: () => openSignin(account, machine, atCards) }));
        }
      }
    } });
    const pasteLabel = h('label', { text: 'Paste the code' });
    const pasteWrap = h('div', { class: 'paste', hidden: true }, pasteLabel, paste, keyInput, send);
    const termLink = h('a', { class: 'small-link', href: terminal, target: '_blank', rel: 'noopener', text: 'Open terminal' });
    const closeBtn = h('button', { type: 'button', class: 'small', text: 'Close', onclick: closeSignin });
    const root = h('section', { class: 'box signin-card', 'aria-label': 'Sign in', 'data-account': account.id },
      h('div', { class: 'head-line' }, h('h2', { text: `Sign in ${account.name} on ${machine}` }), closeBtn),
      status, actions, codeBox, pasteWrap, h('div', { class: 'actions' }, termLink));
    const card = { account: account.id, provider: account.provider, machine, atCards: Boolean(atCards), el: root, waiting: true, started: Date.now(), poll: null, close: null, hadUrl: false, firstUrl: null };
    signCard = card;
    const hostEl = atCards ? providerGroup(account.provider)?.querySelector('.prov-signin') : document.getElementById('signin-host');
    if (hostEl) hostEl.replaceChildren(root);

    const fail = () => {
      card.waiting = false;
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
        card.waiting = false;
        root.classList.add('done');
        status.className = 'note'; status.textContent = 'Signed in.';
        actions.replaceChildren(); codeBox.replaceChildren(); pasteWrap.hidden = true;
        clearInterval(card.poll);
        card.close = setTimeout(closeSignin, 2000);
        return;
      }
      if (st.state === 'failed') return fail();
      const keyOnly = keyOnlySignin(st);
      if ((card.hadUrl || !(st.url || keyOnly)) && expired()) return fail();
      if (st.url || keyOnly) {
        if (!card.hadUrl) card.firstUrl = Date.now();
        card.hadUrl = true;
        status.className = 'hint'; status.textContent = signinHint(st, toolOf(account.provider));
        keyInput.hidden = !keyOnly; paste.hidden = keyOnly; pasteLabel.textContent = keyOnly ? keyPrompt : 'Paste the code';
        if (keyOnly) actions.replaceChildren();
        else if (toolOf(account.provider).settings.signInKind === 'link') {
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
        actions.replaceChildren(); codeBox.replaceChildren(); paste.value = ''; keyInput.value = ''; pasteWrap.hidden = true;
      }
    };
    (async () => {
      const base = `/accounts/${encodeURIComponent(account.id)}/signin/${encodeURIComponent(machine)}`;
      try {
        await api(`/accounts/${encodeURIComponent(account.id)}/signin`, { method: 'POST', body: { machine } });
      } catch (e) { card.waiting = false; status.className = 'inline-err'; status.textContent = e.message; return; }
      const tick = async () => {
        try { paint(await api(base)); } catch (e) { if (signCard === card && expired()) fail(); }
      };
      if (signCard !== card) return;
      card.poll = setInterval(tick, 2000);
      tick();
    })();
  }

  // ---- Accounts panel

  // One line on an account card; the bars and the per-account table are in Usage and balancing.
  function usageLine(reading) {
    const part = (label, w) => {
      if (!w) return null;
      const expired = w.resets_at && Date.parse(w.resets_at) <= Date.now();
      return `${label} ${pct(expired ? 0 : w.used)} used`;
    };
    const parts = reading ? [part('5-hour', reading.five_hour), part('week', reading.week)].filter(Boolean) : [];
    if (!parts.length) return 'no reading yet';
    return [...parts, reading.at && 'as of ' + when(reading.at)].filter(Boolean).join(' · ');
  }

  async function mutate(host, fn) {
    try { await fn(); } catch (e) { inlineErr(host, e.message); return false; }
    inlineErr(host, '');
    editing = null;
    data = await api('/settings');
    await refreshUsage();
    paint('accounts');
    refreshStatus();
    return true;
  }

  function planSelect(provider, value) {
    return h('select', { 'aria-label': 'Plan' }, (PLAN_OPTIONS[provider] || []).map(([v, l]) => h('option', { value: v, text: l, selected: v === value })));
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
        h('span', { class: 'mname', text: m }), h('span', { class: 'mstate ' + stateName(st), text: st && st.state === 'problem' ? st.text : (states[stateName(st)] || stateName(st)) }),
        st && st.warning && h('span', { class: 'mstate note', text: st.warning }),
        stateName(st) !== 'signed_in' && h('button', { type: 'button', class: 'small', text: 'Sign in', 'aria-label': `Sign in ${a.name} on ${m}`, onclick: () => openSignin(a, m) })))),
      h('p', { class: 'hint acct-usage', text: usageLine(a.reading) }));

    const edit = editing && editing.id === a.id ? editing.kind : null;
    if (edit === 'rename') {
      const name = h('input', { value: a.name, 'aria-label': 'Account name' });
      card.append(h('div', { class: 'actions' }, name,
        h('button', { type: 'button', class: 'primary small', text: 'Save', onclick: () => mutate(card, () => api('/settings/accounts/' + encodeURIComponent(a.id), { method: 'PUT', body: { name: name.value } })) }),
        h('button', { type: 'button', class: 'small', text: 'Cancel', onclick: () => { editing = null; paint('accounts'); } })));
    } else if (edit === 'plan') {
      const plan = planSelect(a.provider, a.plan);
      const weight = h('input', { type: 'number', min: '0.1', step: 'any', placeholder: 'weight (optional)', 'aria-label': 'Weight override' });
      card.append(h('div', { class: 'actions' }, plan, weight,
        h('button', { type: 'button', class: 'primary small', text: 'Save', onclick: () => {
          const body = { plan: plan.value };
          if (weight.value.trim() !== '') body.weight = Number(weight.value);
          return mutate(card, () => api('/settings/accounts/' + encodeURIComponent(a.id), { method: 'PUT', body }));
        } }),
        h('button', { type: 'button', class: 'small', text: 'Cancel', onclick: () => { editing = null; paint('accounts'); } })),
      h('span', { class: 'hint', text: 'Weight is how big this account is next to the others. Leave it blank to use the plan\'s.' }));
    } else if (edit === 'remove') {
      card.append(h('div', { class: 'actions' }, h('span', { text: isDefault ? `Remove the default login? Agents stop using this machine's own ${PROVIDER_NAME[a.provider]} login.` : `Remove ${a.name}?` }),
        h('button', { type: 'button', class: 'danger small', text: 'Remove', onclick: () => mutate(card, () => api('/settings/accounts/' + encodeURIComponent(a.id), { method: 'DELETE' })) }),
        h('button', { type: 'button', class: 'small', text: 'Keep', onclick: () => { editing = null; paint('accounts'); } })));
    } else {
      card.append(h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'small', text: a.paused ? 'Resume' : 'Pause', onclick: () => mutate(card, () => api('/settings/accounts/' + encodeURIComponent(a.id), { method: 'PUT', body: { paused: !a.paused } })) }),
        h('button', { type: 'button', class: 'small', text: 'Rename', onclick: () => { editing = { id: a.id, kind: 'rename' }; paint('accounts'); } }),
        h('button', { type: 'button', class: 'small', text: 'Change plan', onclick: () => { editing = { id: a.id, kind: 'plan' }; paint('accounts'); } }),
        h('button', { type: 'button', class: 'small', text: 'Remove', onclick: () => { editing = { id: a.id, kind: 'remove' }; paint('accounts'); } })));
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
      paint('accounts');
      refreshStatus();
    } catch (e) { adding.warn = false; paint('accounts'); inlineErr(document.querySelector('.add-form') || form, e.message); }
  }

  function addProviders() { return Object.entries(PROVIDER_NAME).filter(([v]) => !toolOf(v).singleAccount && harnessOn(v)); }

  function addButton(provider) {
    return h('div', { class: 'actions' }, h('button', {
      type: 'button', class: 'small add-account', text: 'Add account',
      onclick: () => { adding = { provider, name: '', plan: 'unknown', warn: false }; paint('accounts'); },
    }));
  }

  function addForm(offered) {
    if (!offered.length || !adding) return null;
    const form = h('form', { class: 'box add-form', onsubmit: (ev) => {
      ev.preventDefault();
      if (!adding.name.trim()) { inlineErr(form, 'Give the account a name.'); return; }
      const same = (data.accounts || []).filter((a) => a.provider === adding.provider).length;
      if (toolOf(adding.provider).settings.accountWarning && same >= 1 && !adding.warn) { adding.warn = true; paint('accounts'); return; }
      saveAdd(form);
    } });
    const provider = h('select', { id: 'add-provider', 'aria-label': 'Provider', onchange: () => { adding.provider = provider.value; adding.plan = 'unknown'; adding.warn = false; paint('accounts'); } },
      offered.map(([v, l]) => h('option', { value: v, text: l, selected: v === adding.provider })));
    const name = h('input', { id: 'add-name', value: adding.name, 'aria-label': 'Account name', placeholder: 'Name, e.g. Work', required: true, oninput: () => { adding.name = name.value; } });
    const plan = planSelect(adding.provider, adding.plan);
    plan.id = 'add-plan';
    plan.addEventListener('change', () => { adding.plan = plan.value; });
    form.append(h('h2', { text: 'Add account' }), h('div', { class: 'fields' }, provider, name, plan));
    if (adding.warn) {
      form.append(h('div', { class: 'hu', role: 'alert', id: 'claude-warning' }, h('span', { class: 'msg', text: toolOf(adding.provider).settings.accountWarning }),
        h('div', { class: 'hu-actions' },
          h('button', { type: 'button', class: 'primary small', id: 'add-anyway', text: 'Add anyway', onclick: () => saveAdd(form) }),
          h('button', { type: 'button', class: 'small', id: 'add-cancel', text: 'Cancel', onclick: () => { adding = null; paint('accounts'); } }))));
    } else {
      form.append(h('div', { class: 'actions' }, h('button', { type: 'submit', class: 'primary', text: 'Save' }),
        h('button', { type: 'button', text: 'Cancel', onclick: () => { adding = null; paint('accounts'); } })));
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
    const offered = addProviders();
    const canAdd = new Set(offered.map(([v]) => v));
    if (adding && !canAdd.has(adding.provider)) {
      if (offered.length) { adding.provider = offered[0][0]; adding.plan = 'unknown'; adding.warn = false; }
      else adding = null;
    }
    return h('div', { class: 'models accounts' },
      h('div', {}, h('h2', { text: 'Accounts' }),
        h('p', { class: 'lede', text: 'The logins agents run on. New sessions pick the account with the most room.' }),
        usageError && h('p', { class: 'inline-err', role: 'alert', text: 'Could not read usage: ' + usageError })),
      h('div', { id: 'signin-host' }, signCard && !signCard.atCards ? signCard.el : null),
      Object.entries(PROVIDER_NAME).filter(([provider]) => harnessOn(provider)).map(([provider, label]) => h('section', { class: 'prov-group', 'data-provider': provider, 'aria-label': label },
        h('h3', { text: label }),
        toolOf(provider).settings.accountPolicy && h('p', { class: 'hint', text: toolOf(provider).settings.accountPolicy }),
        h('div', { class: 'prov-signin' }, signCard && signCard.atCards && signCard.provider === provider ? signCard.el : null),
        accountRows(provider).filter((a) => !toolOf(provider).singleAccount || a.id === `default-${provider}`).map(accountCard),
        !(data.accounts || []).some((a) => a.id === `default-${provider}`) && restoreDefault(provider),
        canAdd.has(provider) && (adding && adding.provider === provider ? addForm(offered) : addButton(provider)))));
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
    for (const k of ['within', 'leave', 'notify_below', 'save_for_leads', 'margin', 'held_back']) balDraft[k] = structuredClone(data[k]);
  }

  // A Save sends only the balancing box's own keys (the provider orders live on Models) and
  // rebuilds it for the reserved provider's name.
  async function saveBalancing(keys, host) {
    try {
      const res = await api('/settings/balancing', { method: 'PUT', body: balancingBody(keys) });
      for (const k of keys) {
        data[k] = res[k] !== undefined ? res[k] : balDraft[k];
        balDraft[k] = structuredClone(data[k]);
      }
      reserveReads++;
      data.reserved_provider = res.reserved_provider;
      inlineErr(host, '');
      balNote = SAVED;
      paint('balancing');
      loadHarnesses(true);
    } catch (e) {
      inlineErr(host, e.message);
      balNote = '';
      const status = blockHost('balancing')?.querySelector('.note');
      if (status) status.textContent = '';
    }
  }
  // The words that name the hub's reserved provider.
  function reserveTexts() {
    const provider = data.reserved_provider || "the lead's provider";
    return {
      save: `Save ${provider} for leads`,
      margin: `When ${provider} is projected to have less than this left at refill, ticked roles go to another provider, or wait if there is none`,
      held: `Held back when ${provider} runs short`,
    };
  }

  // Opening Usage and balancing reads the reserved provider again (a harness may have been
  // switched elsewhere). Only the words change, in place, so nothing typed or focused moves.
  async function readReserved() {
    const read = ++reserveReads;
    let res;
    try { res = await api('/settings'); } catch { return; }
    if (read !== reserveReads) return;
    data.reserved_provider = res.reserved_provider;
    const box = document.getElementById('bal-save-lead');
    if (!box) return;
    const texts = reserveTexts();
    const rowOf = (id) => document.getElementById(id).closest('.row-line');
    box.setAttribute('aria-label', texts.save);
    rowOf('bal-save-lead').querySelector('.what span').textContent = texts.save;
    rowOf('bal-margin').querySelector('.hint').textContent = texts.margin;
    rowOf('bal-held-worker').querySelector('.what span').textContent = texts.held;
  }

  const boxNote = () => h('p', { class: 'note', role: 'status', text: balNote });

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
    if (f.spend) {
      return h('div', { class: 'usage-prov', 'data-provider': provider },
        h('div', { class: 'usage-toggle' },
          h('span', { class: 'usage-name usage-name-spend', text: f.label }),
          h('span', { class: 'usage-spend-text', text: spendText(f.spend) })));
    }
    return h('div', { class: 'usage-prov' + (f.amber ? ' amber' : ''), 'data-provider': provider },
      h('button', { type: 'button', class: 'usage-toggle', 'aria-expanded': String(open), onclick: () => { openProvider = open ? null : provider; paint('usage'); } },
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
      const used = (label, w, windowName) => {
        if (!w) return cell(label, '–');
        const n = gone(w) ? 0 : w.used;
        return h('td', { 'data-label': label },
          h('span', { class: 'meter', role: 'img', 'aria-label': `${pct(n)} of the ${windowName} window used` },
            h('span', { style: `width:${Math.min(100, Math.max(0, n))}%` })),
          ' ' + pct(n));
      };
      return h('tr', { class: a.next ? 'next' : '', 'data-account': a.id },
        h('th', { scope: 'row', 'data-label': 'Account' }, a.name, a.next && h('span', { class: 'v-badge ok', text: 'next' })),
        used('5-hour used', r.five_hour, '5-hour'),
        cell('5-hour resets', r.five_hour && r.five_hour.resets_at && !gone(r.five_hour) ? when(r.five_hour.resets_at) : '–'),
        used('Week used', r.week, 'week'),
        cell('Week resets', r.week && r.week.resets_at && !gone(r.week) ? when(r.week.resets_at) : '–'),
        h('td', { 'data-label': 'Why', class: 'why', text: a.reason || '' }));
    });
    return h('div', { class: 'box' }, h('table', { class: 'tiers usage-table' }, h('thead', {}, head), h('tbody', {}, rows)));
  }

  function renderUsage() {
    return h('div', { class: 'models usage' },
      h('div', {}, h('h2', { text: 'Usage' }),
        h('p', { class: 'lede', text: 'How much of this week is left, per provider.' }),
        usageError && h('p', { class: 'inline-err', role: 'alert', text: 'Could not read usage: ' + usageError })),
      h('section', { class: 'usage-bars', 'aria-label': 'Providers' },
        usage ? Object.entries(usage.providers).map(([p, f]) => providerBar(p, f)) : h('p', { class: 'v-empty waiting' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), document.createTextNode('Loading usage…'))));
  }

  function renderBalancing() {
    ensureDraft();
    const settingsBox = h('section', { class: 'balancing', 'aria-labelledby': 'bal' });
    const texts = reserveTexts();
    const reserveLabel = texts.save;
    const within = h('select', { id: 'bal-within', 'aria-label': 'Within a provider', onchange: (ev) => { balDraft.within = ev.target.value; } },
      WITHIN.map(([v, l]) => h('option', { value: v, text: l, selected: v === balDraft.within })));
    const save = h('button', { type: 'button', class: 'primary', id: 'bal-save', text: 'Save', onclick: () => saveBalancing(['within', 'leave', 'notify_below', 'save_for_leads', 'margin', 'held_back'], settingsBox) });
    settingsBox.append(
      h('h2', { id: 'bal', text: 'Balancing' }),
      h('div', { class: 'box rows' },
        h('div', { class: 'row-line' }, h('div', { class: 'what' }, h('span', { text: 'Within a provider' }), h('span', { class: 'hint', text: 'How to pick among its accounts' })), h('div', { class: 'ctl' }, within)),
        numField('leave', 'Leave for you (%)', 'An account under this much left stays free for you', 100),
        numField('notify_below', 'Warn me below (%)', 'Shows a dot on Settings when a provider drops under this', 100),
        h('div', { class: 'row-line' }, h('div', { class: 'what' }, h('span', { text: reserveLabel }), h('span', { class: 'hint', text: 'Sessions with no provider preference try other providers first. Does not hold anyone back; the ticks below do.' })),
          h('input', { type: 'checkbox', id: 'bal-save-lead', checked: !!balDraft.save_for_leads, 'aria-label': reserveLabel, onchange: (ev) => { balDraft.save_for_leads = ev.target.checked; } })),
        numField('margin', 'Keep for leads (%)', texts.margin, 100),
        h('div', { class: 'row-line' }, h('div', { class: 'what' }, h('span', { text: texts.held })),
          h('div', { class: 'ctl' }, [['worker', 'Workers'], ['reviewer', 'Reviewers'], ['verifier', 'Verifiers'], ['mapper', 'Mappers'], ['designer', 'Designers']].map(([role, label]) =>
            h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 'bal-held-' + role, checked: balDraft.held_back[role], 'aria-label': label, onchange: (ev) => { balDraft.held_back[role] = ev.target.checked; } }), h('span', { text: label })))))),
      h('div', { class: 'actions' }, save), boxNote());
    return h('div', { class: 'models balance' }, settingsBox);
  }

  // Background state belongs to a section visit, not to its replaceable DOM.
  let backgroundVisit = null;
  let backgroundGeneration = 0;
  const bg = window.wcBackground;
  function cancelBackgroundCandidate(v) {
    if (v.pendingImage) { v.pendingImage.src = ''; v.pendingImage = null; }
    if (v.pendingUrl) { URL.revokeObjectURL(v.pendingUrl); v.pendingUrl = null; }
  }
  function cancelBackgroundWork(v) {
    if (v.frame != null) { cancelAnimationFrame(v.frame); v.frame = null; }
    cancelBackgroundCandidate(v);
  }
  function discardBackground() {
    const visit = backgroundVisit;
    backgroundVisit = null; backgroundGeneration++;
    if (!visit) return;
    visit.op++;
    cancelBackgroundWork(visit);
    if (visit.token) bg.release(visit.token);
    if (visit.url) URL.revokeObjectURL(visit.url);
  }
  function ensureBackground() {
    if (!backgroundVisit) backgroundVisit = { generation: ++backgroundGeneration, dirty: false, op: 0, pending: false, saving: false, error: '', status: '', url: null };
    return backgroundVisit;
  }
  function beginBackground(v) {
    if (v.dirty) return;
    const m = bg.current().metadata;
    if (!m) return;
    v.dirty = true; v.revision = m.revision; v.imageId = m.image_id;
    v.opacity = m.opacity; v.image = null; v.token = bg.acquire();
  }
  function repaintBackground(v) {
    if (youShown() && backgroundVisit === v) paint('background');
  }
  function backgroundStateKey(state) {
    const m = state.metadata;
    // An unchanged poll must not replace a focused clean editor's controls.
    return JSON.stringify([m && [m.image_id, m.media_type, m.opacity, m.revision, m.image_url, m.missing_image], state.ready, state.available, state.error]);
  }
  async function selectBackground(v, file) {
    if (!file || v.saving) return;
    cancelBackgroundCandidate(v);
    const op = ++v.op; v.pending = true; v.error = ''; repaintBackground(v);
    let url;
    try {
      if (file.size > 25 * 1024 * 1024) { const error = new Error(); error.status = 413; throw error; }
      const original = new Uint8Array(await file.arrayBuffer());
      if (backgroundVisit !== v || op !== v.op) return;
      const normalized = window.wcBackgroundFormat.normalize(original);
      url = URL.createObjectURL(new Blob([normalized.bytes], { type: normalized.mediaType }));
      const image = new Image();
      v.pendingUrl = url; v.pendingImage = image;
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('Could not decode this image.')); image.src = url; });
      if (backgroundVisit !== v || op !== v.op) return;
      v.pendingUrl = null; v.pendingImage = null;
      beginBackground(v);
      if (!v.dirty) { const error = new Error(); error.status = 503; throw error; }
      const previous = v.url;
      v.url = url; url = null; v.image = image; v.file = original; v.mediaType = normalized.mediaType;
      v.filename = file.name; v.size = file.size; v.imageId = null; v.status = '';
      bg.publish(v.token, v.image, v.opacity);
      if (previous) URL.revokeObjectURL(previous);
    } catch (error) {
      if (backgroundVisit === v && op === v.op) v.error = error.status === 413 ? 'Choose an image no larger than 25 MiB.'
        : error.status === 415 ? 'Choose a PNG, JPG, WEBP, or GIF image.'
          : error.status === 503 ? 'Background settings are unavailable. Please try again.' : 'Could not open this image. Choose another file.';
    }
    finally {
      if (url) URL.revokeObjectURL(url);
      if (backgroundVisit === v && op === v.op) { v.pendingUrl = null; v.pendingImage = null; v.pending = false; repaintBackground(v); }
    }
  }
  async function saveBackground(v) {
    if (!v.dirty || v.pending || v.saving) return;
    v.saving = true; v.error = ''; v.status = ''; repaintBackground(v);
    try {
      let response;
      if (v.file) response = await fetch(API + '/settings/background/upload?revision=' + v.revision + '&opacity=' + v.opacity, { method: 'POST', headers: { 'content-type': v.mediaType }, body: v.file });
      else response = await fetch(API + '/settings/background', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision: v.revision, image_id: v.imageId, opacity: v.opacity }) });
      const body = await response.json().catch(() => ({}));
      if (response.status === 409) void bg.accept(body);
      if (!response.ok) { const e = new Error(response.status === 409 ? 'The background changed elsewhere. Choose Cancel to load the saved version.' : 'Could not save the background. Please try again.'); throw e; }
      void bg.accept(body);
      if (backgroundVisit !== v) return;
      discardBackground();
      const next = ensureBackground(); next.status = 'Saved'; repaintBackground(next);
    } catch (error) { if (backgroundVisit === v) { v.error = error.message || 'Could not save background.'; v.saving = false; repaintBackground(v); } }
  }
  // A draft differs from what is saved: a new file, another image, or another visibility.
  function backgroundChanged(v) {
    const m = bg.current().metadata;
    if (!v.dirty) return false;
    if (v.file || !m) return true;
    if ((v.imageId || null) !== (m.image_id || null)) return true;
    return !!v.imageId && v.opacity !== m.opacity; // visibility matters only with an image
  }
  function renderBackground() {
    const v = ensureBackground();
    const state = bg.current(), m = state.metadata;
    v.renderedState = backgroundStateKey(state);
    const opacity = v.dirty ? v.opacity : (m?.opacity ?? 35);
    const hasImage = v.dirty ? !!(v.image || v.imageId) : state.available;
    const input = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', disabled: v.saving || !m, 'aria-label': 'Choose background image', onchange: e => selectBackground(v, e.target.files[0]) });
    const slider = h('input', { type: 'range', min: '0', max: '100', step: '1', value: String(opacity), disabled: v.saving || !hasImage || (!v.dirty && !state.ready), 'aria-label': 'Visibility' });
    const value = h('span', { text: opacity + '%' });
    slider.addEventListener('input', () => {
      beginBackground(v); if (!v.dirty) return;
      v.opacity = Number(slider.value); v.status = ''; value.textContent = v.opacity + '%';
      if (v.frame != null) cancelAnimationFrame(v.frame);
      v.frame = requestAnimationFrame(() => {
        v.frame = null;
        if (backgroundVisit !== v || !v.dirty) return;
        if (v.image) bg.publish(v.token, v.image, v.opacity);
        else bg.publishSaved(v.token, v.opacity);
      });
      const save = document.getElementById('background-save'); if (save) save.disabled = v.pending || v.saving || !backgroundChanged(v);
      const cancel = document.getElementById('background-cancel'); if (cancel) cancel.disabled = false;
    });
    return h('div', { class: 'background-editor' },
      h('div', {}, h('h2', { text: 'Background Customization' }), h('p', { class: 'lede', text: 'Previews stay on this page. Save applies your background across devices.' })),
      h('div', { class: 'box' }, h('label', {}, 'Choose an image', input),
        v.filename && h('p', { class: 'hint', text: v.filename + ' · ' + (v.size / 1024 / 1024).toFixed(2) + ' MiB' }),
        h('label', {}, 'Visibility ', value, slider),
        h('div', { class: 'actions' },
          h('button', { id: 'background-save', type: 'button', class: 'primary', text: 'Save', disabled: !backgroundChanged(v) || v.pending || v.saving, onclick: () => saveBackground(v) }),
          h('button', { id: 'background-cancel', type: 'button', text: 'Cancel', disabled: !v.dirty || v.saving, onclick: () => { discardBackground(); bg.refresh(); repaintBackground(ensureBackground()); } }),
          h('button', { type: 'button', text: 'Remove background', disabled: v.saving || !m, onclick: () => {
            ++v.op; cancelBackgroundWork(v); v.pending = false; beginBackground(v); if (!v.dirty) return;
            const old = v.url; v.url = null; v.image = null; v.file = null; v.imageId = null; v.filename = ''; v.opacity = 35; v.error = ''; v.status = '';
            bg.publish(v.token, null, 35); if (old) URL.revokeObjectURL(old); repaintBackground(v);
          } })),
        (v.error || state.error) && h('p', { class: 'inline-err', role: 'alert', text: v.error || state.error }),
        h('p', { class: 'note', role: 'status', text: v.status || (v.pending ? 'Loading image…' : (!m ? 'Loading background…' : '')) })));
  }
  function syncBackground(state) {
    if (!bg || !data || !youShown()) return;
    const v = backgroundVisit;
    // The phone list can uncover an existing editor that missed a saved change or restore.
    if (!v || (!v.dirty && !v.pending && v.renderedState !== backgroundStateKey(state || bg.current()))) {
      paint('background');
    }
  }
  if (bg) {
    bg.subscribe(syncBackground);
    window.addEventListener('backgroundrestore', () => { discardBackground(); syncBackground(); });
    window.addEventListener('backgrounddispose', discardBackground);
  }

  // ---------------------------------------------------------------- Harnesses

  const HARNESSES = TOOLS.map((t) => [t.provider, t.displayName, t.settings.vendor, t.settings.setupUrl]);
  // A switch the hub does not report counts as on (an older hub, or a fresh read still on its way).
  function harnessOn(provider) { return !data || !data.harnesses || data.harnesses[provider] !== false; }

  // hz: the Harnesses section's own state. `jobs` holds the last install state per "machine/provider",
  // `polls` the running install pollers.
  const hz = { data: null, error: '', machine: null, seq: 0, jobs: {}, polls: {}, reachTimer: null, checked: null, confirmOff: null, rowErr: {}, active: false, pending: null };

  function harnessMachine() {
    const list = (hz.data && hz.data.machines) || [];
    if (!list.length) return null;
    if (!list.some((m) => m.name === hz.machine)) {
      const start = hz.data.can_start && hz.data.can_start.machine;
      hz.machine = (list.find((m) => m.name === start) || list.find((m) => m.reachable) || list[0]).name;
    }
    return list.find((m) => m.name === hz.machine);
  }

  function stopPoll(key) {
    const run = hz.polls[key];
    if (run) { run.stopped = true; clearTimeout(run.timer); delete hz.polls[key]; }
  }
  function stopHarnesses() {
    hz.active = false;
    for (const key of Object.keys(hz.polls)) stopPoll(key);
    clearTimeout(hz.reachTimer); hz.reachTimer = null;
    hz.checked = null;
  }
  function paintHarnesses() { paint('harnesses'); }

  function enterHarnesses() {
    stopHarnesses();
    hz.active = true;
    loadHarnesses(true);
  }

  async function loadHarnesses(fresh) {
    const seq = ++hz.seq;
    let res;
    try { res = await api('/harnesses' + (fresh ? '?fresh=1' : '')); } catch (e) {
      if (seq !== hz.seq) return;
      hz.pending = null;
      hz.error = e.message; paintHarnesses();
      if (hz.active) { clearTimeout(hz.reachTimer); hz.reachTimer = setTimeout(() => loadHarnesses(true), 5000); }
      return;
    }
    if (seq !== hz.seq) return;
    hz.pending = null;
    hz.data = res; hz.error = '';
    if (data && res.switches) data.harnesses = { ...(data.harnesses || {}), ...res.switches };
    const machine = harnessMachine();
    clearTimeout(hz.reachTimer); hz.reachTimer = null;
    if (!hz.active) return;
    paintHarnesses();
    if (machine && !machine.reachable) {
      hz.checked = null;
      hz.reachTimer = setTimeout(() => loadHarnesses(true), 5000);
    } else if (machine && hz.checked !== machine.name) {
      for (const key of Object.keys(hz.polls)) stopPoll(key);
      hz.checked = machine.name;
      for (const [provider] of HARNESSES) if (harnessOn(provider)) pollInstall(machine.name, provider, 'GET');
    }
  }

  // Poll one provider's install on one machine every 2 s until it is idle, failed or succeeded.
  // A 502, network error or no answer keeps polling and marks the row as unreachable meanwhile.
  function pollInstall(machine, provider, firstMethod) {
    const key = machine + '/' + provider;
    stopPoll(key);
    const run = { stopped: false, timer: null };
    hz.polls[key] = run;
    const url = API + `/machines/${encodeURIComponent(machine)}/harnesses/${encodeURIComponent(provider)}/install`;
    const finish = () => { stopPoll(key); };
    const again = () => { if (!run.stopped) run.timer = setTimeout(() => step('GET'), 2000); };
    async function step(method) {
      if (run.stopped) return;
      if (machine !== hz.machine) { finish(); return; }
      let res = null; let body = {};
      try {
        res = await fetch(url, { method, signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
        body = await res.json().catch(() => ({}));
      } catch { res = null; }
      if (run.stopped) return;
      if (machine !== hz.machine) { finish(); return; }
      if (!res || res.status >= 500) {
        hz.jobs[key] = { ...(hz.jobs[key] || { state: 'running', tail: '' }), offline: true };
        paintHarnesses(); return again();
      }
      if (res.status === 404 && method === 'POST') { finish(); delete hz.jobs[key]; loadHarnesses(true); return; }
      if (res.status === 404) { finish(); delete hz.jobs[key]; paintHarnesses(); return; }
      if (res.status === 409 && method === 'POST') {
        if (body.error === 'already installing') return step('GET');
        finish(); delete hz.jobs[key]; hz.rowErr[provider] = body.error || 'Couldn\'t start the install.'; paintHarnesses(); return;
      }
      if (!res.ok) { hz.jobs[key] = { state: 'failed', tail: body.error || ('http ' + res.status) }; finish(); paintHarnesses(); return; }
      const tail = body.output_tail || '';
      if (body.state === 'running') {
        const before = hz.jobs[key];
        hz.jobs[key] = { state: 'running', tail, confirmed: true, cancelling: !!(before && before.cancelling), cancelErr: before && before.cancelErr };
        paintHarnesses(); return again();
      }
      finish();
      if (body.state === 'failed') { hz.jobs[key] = { state: 'failed', tail, explanation: body.explanation || null }; paintHarnesses(); return; }
      if (body.state === 'cancelled') { hz.jobs[key] = { state: 'cancelled', tail, explanation: null }; paintHarnesses(); return; }
      delete hz.jobs[key];
      if (body.state === 'succeeded') refreshAfterInstall(machine, provider); else paintHarnesses();
    }
    step(firstMethod);
  }

  // Cancel a running install: DELETE through the hub; the poll already running reports the outcome.
  async function cancelInstall(machine, provider) {
    const key = machine + '/' + provider;
    const job = hz.jobs[key];
    if (!job || job.cancelling) return;
    job.cancelErr = undefined;
    job.cancelling = true; paintHarnesses();
    let res = null;
    try { res = await fetch(API + `/machines/${encodeURIComponent(machine)}/harnesses/${encodeURIComponent(provider)}/install`, { method: 'DELETE', signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined }); } catch { res = null; }
    const now = hz.jobs[key];
    if (!now || now.state !== 'running') return;
    if (res && (res.status === 202 || res.status === 409)) return;
    now.cancelling = false;
    now.cancelErr = (!res || res.status >= 500) ? `Couldn't cancel: ${machine} isn't reachable.` : `Couldn't cancel: update wheelchair on ${machine}.`;
    paintHarnesses();
  }

  // A just-installed CLI's version is read in the background on the machine, so the first
  // fresh status can say "installed" with no version yet. Re-fetch a few times, 2 s apart,
  // until the version shows, so the row fills in without reopening the section. A sign-in
  // card opened meanwhile stops the retries; closing it reads the status again anyway.
  async function refreshAfterInstall(machine, provider, tries = 4, first = true) {
    if (!first && signCard) return;
    await loadHarnesses(true);
    if (!hz.active || machine !== hz.machine || tries <= 1 || signCard) return;
    const m = ((hz.data && hz.data.machines) || []).find((entry) => entry.name === machine);
    const st = m && m.harnesses && m.harnesses[provider];
    if (st && st.installed && !st.version) setTimeout(() => refreshAfterInstall(machine, provider, tries - 1, false), 2000);
  }

  async function setHarness(provider, enabled) {
    hz.confirmOff = null; delete hz.rowErr[provider];
    try {
      const res = await api('/settings/harnesses/' + encodeURIComponent(provider), { method: 'PUT', body: { enabled } });
      if (data && res && res.harnesses) data.harnesses = res.harnesses;
      if (data && res && res.legacy_lead_diffs) data.legacy_lead_diffs = res.legacy_lead_diffs;
    } catch (e) { hz.rowErr[provider] = e.message; paintHarnesses(); return; }
    if (!enabled && signCard && signCard.provider === provider) closeSignin();
    // Accounts follows the switch at once, unless an account edit is open. An Add account form
    // left on a provider that is now off moves to one still offered, which needs the repaint.
    const chosen = adding && adding.provider;
    if (adding) { const first = addProviders()[0]; if (!first) adding = null; else if (!addProviders().some(([v]) => v === adding.provider)) { adding.provider = first[0]; adding.plan = 'unknown'; adding.warn = false; } }
    const moved = Boolean(chosen) && (!adding || adding.provider !== chosen);
    if (!editing && (moved || !accountsBusy())) paint('accounts');
    paintHarnesses();
    await loadHarnesses(true);
    const machine = harnessMachine();
    if (enabled && machine && machine.reachable) pollInstall(machine.name, provider, 'GET');
    else if (!enabled && machine) { stopPoll(machine.name + '/' + provider); delete hz.jobs[machine.name + '/' + provider]; paintHarnesses(); }
  }

  // The first account card of the provider that can sign in: neither retired nor paused.
  function signinAccount(provider) {
    const mine = ((data && data.accounts) || []).filter((a) => a.provider === provider && !((data.retired_accounts || []).includes(a.id)) && (!toolOf(provider).singleAccount || a.id === `default-${provider}`));
    return { usable: mine.find((a) => !a.paused) || null, any: mine.length > 0 };
  }

  function linkReasons(text) {
    return String(text).split(/(Lead ladder|Worker ladder|Leads provider order|Settings → Models)/).map((part, i) => (i % 2
      ? h('a', { href: '#models', text: part }) : part));
  }

  // Accounts is the block below Harnesses, so its links scroll there.
  const accountsLink = (text) => h('a', { href: '#providers', text, onclick: () => blockHost('accounts')?.scrollIntoView() });

  const providerGroup = (provider) => blockHost('accounts')?.querySelector(`.prov-group[data-provider="${provider}"]`);

  // Sign-in happens with the account cards: the link opens it there, for the machine shown here.
  const signinLink = (account, machine, name) => h('a', { class: 'btn-link primary', href: '#providers', text: 'Sign in', 'aria-label': `Sign in ${name}`, onclick: () => {
    openSignin(account, machine, true);
    providerGroup(account.provider)?.scrollIntoView();
  } });

  function harnessRow(info, machine) {
    const [provider, name, vendor, docs] = info;
    const st = (machine.harnesses || {})[provider] || { installed: false, version: null, signed_in: false, recipe: false };
    const on = harnessOn(provider);
    const job = hz.jobs[machine.name + '/' + provider];
    const stateText = st.signed_in ? 'Signed in' : st.installed ? 'Installed' + (st.version ? ' ' + st.version : '') : 'Not installed';
    const actions = h('div', { class: 'h-actions' });
    const extra = [];
    const install = (label) => h('button', { type: 'button', class: 'small primary', text: label, 'aria-label': `${label} ${name}`, onclick: () => {
      const target = hz.machine; // always the machine the picker shows
      if (!target || hz.pending) return;
      delete hz.rowErr[provider];
      hz.jobs[target + '/' + provider] = { state: 'running', tail: '' };
      pollInstall(target, provider, 'POST'); paintHarnesses();
    } });
    if (on) {
      if (job && job.state === 'running') {
        actions.append(h('span', { class: 'hint waiting' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }),
          document.createTextNode(job.offline ? `Can't reach ${machine.name}, retrying…` : 'Installing…')));
        if (job.confirmed && !job.offline) {
          if (job.cancelling) actions.append(h('span', { class: 'hint', text: 'Cancelling…' }));
          else actions.append(h('button', { type: 'button', class: 'small', text: 'Cancel', 'aria-label': `Cancel installing ${name}`, onclick: () => cancelInstall(machine.name, provider) }));
        }
        if (job.tail) extra.push(h('pre', { class: 'h-tail', tabindex: 0, text: job.tail }));
      } else if (job && job.state === 'failed' && st.recipe !== false) {
        actions.append(h('span', { class: 'inline-err', role: 'alert', text: 'Install failed' }));
        if (st.recipe !== null) actions.append(install('Try again'));
        if (job.explanation) extra.push(h('p', { class: 'h-explain', text: job.explanation }));
        if (job.tail) extra.push(h('pre', { class: 'h-tail', tabindex: 0, text: job.tail }));
      } else if (job && job.state === 'cancelled' && !st.installed) {
        actions.append(h('span', { class: 'hint', text: 'Install cancelled' }), install('Install'));
        if (job.tail) extra.push(h('pre', { class: 'h-tail', tabindex: 0, text: job.tail }));
      } else if (!st.installed) {
        if (st.recipe === false) actions.append(h('a', { class: 'btn-link', href: docs, target: '_blank', rel: 'noopener', text: `Install from ${vendor}'s site` }));
        else if (st.recipe === true) actions.append(install('Install'));
      } else if (!st.signed_in) {
        const { usable, any } = signinAccount(provider);
        if (usable) actions.append(signinLink(usable, machine.name, name));
        else if (any) actions.append(h('span', { class: 'hint', text: `All ${name} accounts are paused ` }), accountsLink('Open Accounts'));
        else actions.append(accountsLink('Add an account'));
      }
    }
    const confirming = hz.confirmOff === provider;
    const count = (hz.data.threads_using || {})[provider] || 0;
    const sw = h('label', { class: 'h-switch' },
      h('input', { type: 'checkbox', role: 'switch', checked: on, 'aria-label': `Use ${name}`, onchange: (ev) => {
        if (ev.target.checked) return setHarness(provider, true);
        ev.target.checked = true;
        if (count > 0) { hz.confirmOff = provider; paintHarnesses(); } else setHarness(provider, false);
      } }),
      h('span', { text: 'Use' }));
    const row = h('div', { class: 'h-row' + (on ? '' : ' off'), 'data-provider': provider },
      h('div', { class: 'h-head' },
        h('div', { class: 'h-name' }, h('strong', { text: name }), h('span', { class: 'hint h-state', text: stateText })),
        sw),
      actions,
      confirming && h('div', { class: 'actions h-confirm' },
        h('span', { text: `${count} ${count === 1 ? 'thread uses' : 'threads use'} ${name}. Their running agents keep going, but no new agent starts on it. Leave it out?` }),
        h('button', { type: 'button', class: 'danger small', text: 'Leave it out', onclick: () => setHarness(provider, false) }),
        h('button', { type: 'button', class: 'small', text: 'Keep', onclick: () => { hz.confirmOff = null; paintHarnesses(); } })),
      (hz.rowErr[provider] || (job && job.state === 'running' && job.cancelErr)) && h('p', { class: 'inline-err', role: 'alert', text: hz.rowErr[provider] || job.cancelErr }),
      extra);
    return row;
  }

  function renderHarnesses() {
    const head = h('div', {}, h('h2', { text: 'Harnesses' }),
      h('p', { class: 'lede', text: 'The agent programs wheelchair can run. Install and sign in to the ones you use, and leave out the rest.' }));
    if (!hz.data) {
      return h('div', { class: 'models harnesses' }, head, hz.error
        ? h('p', { class: 'inline-err', role: 'alert', text: 'Could not read harnesses: ' + hz.error })
        : h('p', { class: 'v-empty waiting' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), document.createTextNode('Loading harnesses…')));
    }
    const machines = hz.data.machines || [];
    const machine = harnessMachine();
    const parts = [head];
    if (machines.length > 1) {
      parts.push(h('label', { class: 'h-picker' }, h('span', { text: 'Machine' }),
        h('select', { 'aria-label': 'Machine', onchange: (ev) => {
          hz.machine = ev.target.value; hz.checked = null; hz.confirmOff = null; hz.pending = hz.machine;
          for (const key of Object.keys(hz.polls)) stopPoll(key);
          paintHarnesses();
          loadHarnesses(false);
        } }, machines.map((m) => h('option', { value: m.name, text: m.name, selected: m.name === hz.machine })))));
    }
    const cs = hz.data.can_start;
    if (cs && ((cs.lead && !cs.lead.ok) || (cs.worker && !cs.worker.ok))) {
      const reasons = [['lead', cs.lead], ['worker', cs.worker]].filter(([, r]) => r && !r.ok && r.reason).map(([, r]) => r.reason);
      parts.push(h('div', { class: 'h-notice', role: 'status' },
        h('strong', { text: `Agents can't start yet on ${cs.machine}:` }),
        [...new Set(reasons)].map((r) => h('p', {}, linkReasons(r)))));
    }
    if (!machine) parts.push(h('p', { class: 'v-empty', text: 'No machines are known yet.' }));
    else if (hz.pending === machine.name) {
      parts.push(h('p', { class: 'v-empty waiting', role: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), document.createTextNode(`Checking ${machine.name}…`)));
    } else if (!machine.reachable) {
      parts.push(h('p', { class: 'hint waiting h-offline', role: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), document.createTextNode(`Can't reach ${machine.name}, retrying…`)));
    } else {
      const old = HARNESSES.some(([p]) => ((machine.harnesses || {})[p] || {}).recipe === null);
      if (old) parts.push(h('p', { class: 'h-notice', role: 'status', text: 'This machine needs updating: re-run ./install.sh on it.' }));
      parts.push(h('div', { class: 'box h-rows' }, HARNESSES.map((info) => harnessRow(info, machine))));
    }
    return h('div', { class: 'models harnesses' }, parts);
  }

  // ---------------------------------------------------------------- shell

  let projectToolsHost = null;
  function renderProjectTools() {
    if (!projectToolsHost) { projectToolsHost = h('div', {}); window.ProjectTools.render(projectToolsHost); }
    return projectToolsHost;
  }

  let sharedProjects = null;
  let sharedLoading = false;
  async function loadSharedProjects() {
    if (sharedLoading || sharedProjects) return;
    sharedLoading = true;
    try {
      const entries = (data.saved_dirs || []).filter(entry => entry.path && entry.machine);
      const machines = new Set(entries.map(entry => entry.machine));
      sharedProjects = await Promise.all(entries.map(async entry => {
        const name = (entry.name || entry.path) + (machines.size > 1 ? ` (${entry.machine})` : '');
        try {
          const result = await api('/project-tools/read', { method: 'POST', body: { machine: entry.machine, path: entry.path, repo_only: true } });
          return { name, repo: result.repo };
        } catch { return { name, repo: null }; }
      }));
    } catch { sharedProjects = []; }
    sharedLoading = false;
    paint('shared-tools');
  }
  function renderSharedTools() {
    if (!sharedProjects) loadSharedProjects();
    const select = h('select', { id: 'shared-tools-project', 'aria-label': 'Shared tools project', disabled: !sharedProjects });
    select.append(h('option', { value: '', text: 'None' }));
    const seen = new Set();
    for (const item of sharedProjects || []) {
      if (item.repo) seen.add(item.repo.toLowerCase());
      select.append(h('option', { value: item.repo || '', disabled: !item.repo, text: item.repo ? item.name : item.name + ' (no GitHub origin)' }));
    }
    if (data.shared_tools_repo && !seen.has(data.shared_tools_repo.toLowerCase())) select.append(h('option', { value: data.shared_tools_repo, text: data.shared_tools_repo }));
    select.value = data.shared_tools_repo || '';
    const message = h('p', { class: 'hint', role: 'status' });
    select.addEventListener('change', async () => {
      select.disabled = true;
      try { const result = await api('/settings/preferences', { method: 'PUT', body: { shared_tools_repo: select.value || null } }); data.shared_tools_repo = result.shared_tools_repo; message.textContent = 'Saved'; readKeys(); }
      catch (error) { select.value = data.shared_tools_repo || ''; message.textContent = error.message; }
      finally { select.disabled = false; }
    });
    const machine = h('select', { id: 'shared-keys-machine', 'aria-label': 'Machine' });
    const keyHost = h('section', { class: 'pt-keys' });
    let revision = null, sequence = 0;
    async function readKeys() {
      const seq = ++sequence, selected = machine.value || 'hub';
      try {
        const result = await api('/shared-keys/read', { method: 'POST', body: { machine: selected } });
        if (seq !== sequence) return;
        revision = result.revision;
        paintKeys(result.keys || [], result.notes || []);
      } catch (error) { if (seq === sequence) keyHost.replaceChildren(h('p', { class: 'pt-warn', text: error.body?.reason || error.message })); }
    }
    async function change(action, payload, errorEl) {
      errorEl.textContent = '';
      try {
        const result = await api('/shared-keys/' + action, { method: 'POST', body: { machine: machine.value || 'hub', revision, ...payload } });
        revision = result.revision;
        await readKeys();
      } catch (error) {
        const reason = error.body?.reason || error.body?.error || error.message;
        if (error.status === 409) { await readKeys(); keyHost.prepend(h('p', { class: 'pt-warn', role: 'alert', text: reason })); }
        else errorEl.textContent = reason;
      }
    }
    function paintKeys(keys, notes) {
      const rows = keys.map(key => {
        const value = h('input', { type: 'password', autocomplete: 'off', 'aria-label': 'Value for ' + key.name, placeholder: key.stored ? 'New value' : 'Value' });
        const error = h('p', { class: 'inline-err', role: 'alert' });
        const set = h('button', { type: 'button', text: key.stored ? 'Replace' : 'Set', onclick: () => { if (!value.value) { error.textContent = 'Enter a value.'; return; } change('save', { keys: { [key.name]: value.value } }, error); } });
        const remove = key.stored && h('button', { type: 'button', text: 'Remove', onclick: () => change('remove', { name: key.name }, error) });
        return h('div', { class: 'pt-key', 'data-key': key.name },
          h('div', { class: 'pt-key-head' }, h('span', { class: 'mono', text: key.name }), h('span', { class: 'pt-chip ' + (key.stored ? 'set' : 'unset'), text: key.stored ? 'set' : 'not set' }), key.tools?.length && h('span', { class: 'hint', text: 'used by ' + key.tools.join(', ') })),
          key.stored && key.folder_usable === false && h('p', { class: 'pt-warn', text: "can't be used by folder tools: " + key.reason }),
          h('div', { class: 'pt-key-ctl' }, value, set, remove), error);
      });
      const name = h('input', { type: 'text', autocomplete: 'off', 'aria-label': 'New key name', placeholder: 'Key name' });
      const value = h('input', { type: 'password', autocomplete: 'off', 'aria-label': 'New key value', placeholder: 'Value' });
      const error = h('p', { class: 'inline-err', role: 'alert' });
      keyHost.replaceChildren(h('h2', { text: 'Shared keys on this machine' }),
        h('p', { class: 'hint', text: 'Key values are stored on this machine and never shown again. Other machines need their own keys entered.' }),
        h('div', { class: 'pt-keylist' }, rows),
        h('div', { class: 'pt-addkey' }, name, value, h('button', { type: 'button', text: 'Add a key', onclick: () => change('save', { keys: { [name.value]: value.value } }, error) })), error,
        ...notes.map(text => h('p', { class: 'hint', text })));
    }
    machine.addEventListener('change', readKeys);
    api('/new-thread?machine=hub').then(result => {
      machine.replaceChildren(...(result.machines || ['hub']).map(name => h('option', { value: name, text: name })));
      machine.value = result.machine || 'hub';
      return readKeys();
    }).catch(error => { keyHost.textContent = error.message; });
    return h('div', { class: 'pt pt-shared' },
      h('div', { class: 'pt-picker' }, h('label', {}, h('span', { text: 'Shared tools project' }), select)),
      h('p', { class: 'hint', text: 'To add or change a shared tool, ask in a thread in the shared tools project.' }), message,
      h('div', { class: 'pt-picker' }, h('label', {}, h('span', { text: 'Machine' }), machine)), keyHost);
  }

  const BLOCKS = {
    name: renderName, writing: renderWriting, diagrams: renderDiagrams, enter: renderEnter,
    background: () => (bg ? renderBackground() : null),
    harnesses: renderHarnesses, accounts: renderAccounts,
    usage: renderUsage, balancing: renderBalancing,
    agents: renderAgents, ladders: renderLadders, tiers: renderTiers, escalation: renderEscalation, assistants: renderAssistants,
    conversations: renderConversations,
    'thread-view': renderThreadView, permission: renderPermission, 'lead-names': renderLeadNames,
    templates: renderTemplates, tools: renderProjectTools, 'shared-tools': renderSharedTools,
  };
  const blockHost = (name) => panel.querySelector(`.block[data-block="${name}"]`);

  let pressed = null; let lastMouse = null;
  panel.addEventListener('pointerdown', (e) => { pressed = e.target; });
  window.addEventListener('pointerup', () => { pressed = null; });
  window.addEventListener('pointercancel', () => { pressed = null; });
  panel.addEventListener('pointermove', (e) => { lastMouse = e.pointerType === 'mouse' ? { x: e.clientX, y: e.clientY } : null; });
  panel.addEventListener('pointerleave', () => { lastMouse = null; });

  // Hold the pressed, focused, hovered or sign-in element in that order when it is
  // visible below the repainted host; otherwise use the next-block fallback.
  function holdPlace(host) {
    const top = document.getElementById('app-nav')?.getBoundingClientRect().bottom || 0;
    const inside = (el) => el instanceof Element && panel.contains(el) ? el : null;
    const candidates = [inside(pressed), inside(document.activeElement),
      inside(lastMouse ? document.elementFromPoint(lastMouse.x, lastMouse.y) : null), signCard?.el];
    for (const anchor of candidates) {
      if (!(anchor instanceof Element) || !anchor.isConnected || host.contains(anchor) ||
          !(host.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      const before = anchor.getBoundingClientRect();
      if (before.bottom > top && before.top < window.innerHeight) {
        return () => window.scrollBy(0, anchor.getBoundingClientRect().top - before.top);
      }
    }
    const next = host.nextElementSibling;
    if (!next || !window.scrollY || !host.childElementCount || host.getBoundingClientRect().bottom > top) return () => {};
    const was = next.getBoundingClientRect().top;
    return () => window.scrollBy(0, next.getBoundingClientRect().top - was);
  }

  // Rebuild only the named blocks, and only those in the open category: a block's save, timer
  // or picker never touches what another one holds.
  function paint(...names) {
    if (!data) return;
    for (const name of names) {
      const host = blockHost(name);
      if (!host) continue;
      const hold = holdPlace(host);
      const view = BLOCKS[name]();
      host.replaceChildren(...(view ? [view] : []));
      if (name === 'diagrams') drawDiagram();
      hold();
    }
  }

  // Build the open category from scratch: its heading, then one host per block.
  function renderCategory() {
    if (!data) return;
    const cat = categoryOf(section);
    panel.querySelector(':scope > .catview')?.remove();
    panel.append(h('div', { class: 'catview', 'data-category': cat.key },
      cat.lede && h('div', { class: 'cat-head' }, h('h1', { text: cat.title }), h('p', { class: 'lede', text: cat.lede }), cat.note && noteEl()),
      cat.blocks.map((name) => h('div', { class: 'block', 'data-block': name }))));
    paint(...cat.blocks);
  }

  // The phone's way in: the list of categories, and the way back to it. CSS shows them only
  // at 899px and narrower, so crossing that width rebuilds nothing.
  function renderPhoneNav() {
    panel.append(
      h('a', { class: 'back', href: '#', text: '‹  Settings' }),
      h('div', { class: 'cat-root' },
        h('h1', { text: 'Settings' }),
        h('p', { class: 'lede', text: 'Choose a category.' }),
        h('nav', { class: 'category-list', 'aria-label': 'Categories' }, CATEGORIES.map((c) => h('a', { class: 'cat-link', href: '#' + c.key, 'data-category': c.key },
          h('span', {}, h('strong', { text: c.title }), h('span', { class: 'hint', text: c.line })),
          h('span', { class: 'chev', 'aria-hidden': 'true', text: '›' }))))));
  }

  function renderSections() {
    document.getElementById('sections').replaceChildren(...CATEGORIES.map((c) => {
      const a = h('a', { href: '#' + c.key, text: c.title, 'data-section': c.key });
      if (c.key === section) a.setAttribute('aria-current', 'page');
      return a;
    }));
  }

  // Which category the hash names, and the lesson editor it may open. No hash is You, an old
  // key is the category that holds it now, and anything unknown is You. The address stays as typed.
  function parseHash() {
    const key = location.hash.replace(/^#/, '');
    const role = (/^(?:templates|behavior)\/lessons\/([a-z-]+)$/.exec(key) || [])[1];
    if (role && LESSON_PLURAL[role]) return { root: false, next: 'behavior', role };
    const named = Object.hasOwn(ALIASES, key) ? ALIASES[key] : key;
    return { root: key === '', next: categoryOf(named) ? named : 'you', role: null };
  }

  // Take in the hash; true when the open category has to be built again.
  function readHash() {
    const { root, next, role } = parseHash();
    // Going back to the list on a phone leaves the category, as picking another one does.
    const leaving = next !== section || (root && !atRoot && phone.matches);
    const moved = leaving || root !== atRoot;
    atRoot = root;
    document.querySelector('.settings').classList.toggle('at-root', root);
    if (leaving) {
      if (section === 'you') discardBackground();
      section = next;
      setNote('', false); styleNote = ''; balNote = '';
    }
    const lessons = role && selected !== 'lessons:' + role;
    if (lessons) select('lessons:' + role);
    if (moved && data) window.scrollTo(0, 0);
    return { leaving, lessons };
  }

  function syncYou() {
    syncDiagrams();
    syncBackground();
  }

  window.addEventListener('hashchange', () => {
    const { leaving, lessons } = readHash();
    renderSections();
    if (leaving) { renderCategory(); syncSection(); }
    else if (lessons) paint('templates');
    syncYou();
  });
  phone.addEventListener('change', syncYou);
  readHash();
  renderSections();

  (async () => {
    const error = document.getElementById('error');
    try {
      data = await api('/settings');
      document.getElementById('loading')?.remove();
      renderPhoneNav();
      renderCategory();
      syncSection();
      syncYou();
    } catch (e) {
      error.hidden = false;
      error.textContent = 'Could not load settings: ' + e.message;
      document.getElementById('loading')?.remove();
    }
  })();
})();
