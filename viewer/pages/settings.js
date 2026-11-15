'use strict';

// The Settings page: Models and preferences, Behavior templates, Writing style. Everything
// reads from and writes to the hub's /settings routes (viewer/app/API.md); the page keeps no
// copy of its own beyond the unsaved editor drafts.
(() => {
  const API = '/wheelchair/api';
  const SECTIONS = [['models', 'Models and preferences'], ['templates', 'Behavior templates'], ['writing', 'Writing style']];
  const TIERS = [
    ['light', 'Light', 'Spelled-out changes, few files'],
    ['standard', 'Standard', 'Most building'],
    ['heavy', 'Heavy', 'Leading, planning, review, checking'],
    ['critical', 'Critical', "Can't afford to get wrong"],
  ];
  const PROVIDERS = [['claude', 'Claude', 'Claude Code'], ['gpt', 'GPT', 'Codex']];
  const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
  const MODEL_VALUE = /^[a-z0-9][a-z0-9._-]*$/;
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
    if (!res.ok) throw new Error(body.detail || body.error || body.message || ('http ' + res.status));
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
    const label = `${provider === 'claude' ? 'Claude' : 'GPT'} ${slot} model`;
    const select = h('select', { 'aria-label': label, class: provider === 'claude' ? '' : 'mono' },
      optionList(provider, current, { allowNone }).map((o) => h('option', { value: o.value, text: o.label })));
    select.value = current || NONE;
    wrap.append(select);
    let effortSelect = null;

    async function commit(model, newEffort) {
      const body = { provider, slot, model };
      if (provider === 'claude' && model && newEffort) body.effort = newEffort;
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
        if (!MODEL_VALUE.test(value)) {
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
      effortSelect = h('select', { class: 'effort', 'aria-label': `Claude ${slot} effort` },
        h('option', { value: '', text: 'CLI default' }),
        EFFORTS.map((e) => h('option', { value: e, text: e })));
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
        const td = h('td', { 'data-label': label }, modelPicker(provider, slot, { allowNone: true, withEffort: provider === 'claude' }));
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
    const claudeMode = modeGroup('permission_mode', 'Claude permission mode', [['auto', 'Auto'], ['bypass', 'Bypass']]);
    const codexMode = modeGroup('codex_mode', 'Codex permission mode', [['sandboxed', 'Sandboxed'], ['unrestricted', 'Unrestricted']]);
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
        h('span', { class: 'hint', text: '"Not used" means that provider can\'t be started at that tier. Claude\'s effort is how hard it thinks; "CLI default" leaves it to the CLI.' })),
      h('section', { 'aria-labelledby': 'leads' },
        h('h2', { id: 'leads', text: 'Leads' }),
        h('div', { class: 'box rows' },
          PROVIDERS.map(([provider, name]) => h('div', { class: 'row-line' },
            h('div', { class: 'what' }, h('span', { text: 'Leads and sub-leads run on' }), h('span', { class: 'hint', text: `${name} model` })),
            h('div', { class: 'ctl wide' }, modelPicker(provider, 'lead', { allowNone: false, withEffort: false })))))),
      h('section', { 'aria-labelledby': 'perm' },
        h('h2', { id: 'perm', text: 'Permission mode' }),
        h('div', { class: 'box rows' },
          h('div', { class: 'row-line' },
            h('div', { class: 'what' }, h('span', { text: 'Claude sessions' })),
            claudeMode),
          h('div', { class: 'row-line' },
            h('div', { class: 'what' }, h('span', { text: 'Codex sessions' }), h('span', { class: 'hint', text: codexHint })),
            codexMode))),
      h('section', { 'aria-labelledby': 'thread-view' },
        h('h2', { id: 'thread-view', text: 'Threads' }),
        h('div', { class: 'box rows' },
          h('div', { class: 'row-line' },
            h('div', { class: 'what' }, h('span', { text: 'Tool steps' }), h('span', { class: 'hint', text: data.tool_steps === 'hide' ? 'Hidden: a thread shows only messages and cards.' : 'Commands and file reads show as folded lines between messages.' })),
            modeGroup('tool_steps', 'Tool steps', [['show', 'Show'], ['hide', 'Hide']])))),
      h('section', { 'aria-labelledby': 'others' },
        h('h2', { id: 'others', text: 'Other agents' }),
        h('div', { class: 'box rows' },
          otherAgentRow('reviewer', 'Plan reviewers', 'Two providers when both are installed'),
          otherAgentRow('verifier', 'Checker', 'Not the provider that built it'),
          otherAgentRow('mapper', 'Code mapping', 'Maps how the existing code works before planning')),
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
    box.replaceWith(promptBox());
  }

  function promptBox() {
    if (!fullPrompt) return h('div', { id: 'full-prompt', hidden: true });
    if (fullPrompt.error) return h('p', { id: 'full-prompt', class: 'inline-err', role: 'alert', text: fullPrompt.error });
    return h('pre', { id: 'full-prompt', class: 'full', text: fullPrompt.text });
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

  // ---------------------------------------------------------------- shell

  function renderSections() {
    const nav = document.getElementById('sections');
    nav.replaceChildren(...SECTIONS.map(([key, label]) => {
      const a = h('a', { href: '#' + key, text: label, 'data-section': key });
      if (key === section) a.setAttribute('aria-current', 'page');
      return a;
    }));
  }

  function renderPanel() {
    if (!data) return;
    const view = section === 'templates' ? renderTemplates() : section === 'writing' ? renderWriting() : renderModels();
    const keep = document.getElementById('error');
    panel.replaceChildren(keep, view);
    renderSections();
  }

  function readHash() {
    const key = location.hash.replace(/^#/, '');
    const next = SECTIONS.some(([k]) => k === key) ? key : 'models';
    if (next !== section) { section = next; setNote('', false); styleNote = ''; }
  }

  window.addEventListener('hashchange', () => { readHash(); renderPanel(); });
  readHash();
  renderSections();

  (async () => {
    const error = document.getElementById('error');
    try {
      data = await api('/settings');
      document.getElementById('loading')?.remove();
      renderPanel();
    } catch (e) {
      error.hidden = false;
      error.textContent = 'Could not load settings: ' + e.message;
      document.getElementById('loading')?.remove();
    }
  })();
})();
