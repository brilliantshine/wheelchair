'use strict';

// Features view (Spec "Views", "Feature status"): the Needs you cards, the stage columns, and
// the projects and machines in the sidebar. Only what the API gives is shown.
(() => {
  const API = '/wheelchair/api';
  const STAGES = [
    ['idea', 'Idea'],
    ['planning', 'Planning'],
    ['review', 'Review'],
    ['building', 'Building'],
    ['verifying', 'Verifying'],
    ['done', 'Done'],
  ];
  const KIND = { question: 'Question', needs: 'Needs you', approval: 'Plan approved' };
  const DONE_SHOWN = 3;

  let state = { features: {}, threads: [], projects: [], machines: [] };
  let filter = '';        // a project's folder name, or '' for all
  let doneOpen = false;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function base(p) { return String(p || '').split('/').filter(Boolean).pop() || String(p || ''); }

  function threadHref(id, cardId) {
    const root = `/wheelchair/app/thread?id=${encodeURIComponent(id)}`;
    return cardId ? `${root}#card-${encodeURIComponent(cardId)}` : root;
  }

  // thread id -> { project, title, stage }
  function index() {
    const byId = {};
    for (const t of state.threads) byId[t.id] = { project: base(t.project), title: t.title || t.slug || '', slug: t.slug || '' };
    for (const [key] of STAGES) {
      for (const f of state.features[key] || []) {
        byId[f.id] = { ...(byId[f.id] || {}), project: base(f.project), slug: f.slug, stage: key };
      }
    }
    return byId;
  }
  const stageName = (key) => (STAGES.find((s) => s[0] === key) || [])[1] || '';
  const keep = (project) => !filter || project === filter;

  function renderSideProjects(byId) {
    const root = document.getElementById('side-projects');
    root.replaceChildren();
    const names = new Map(); // folder name -> { active, needs }
    const touch = (name) => { if (!names.has(name)) names.set(name, { active: 0, needs: 0 }); return names.get(name); };
    for (const path of state.projects) touch(base(path));
    for (const [key] of STAGES) {
      for (const f of state.features[key] || []) { const row = touch(base(f.project)); if (key !== 'done') row.active += 1; }
    }
    for (const n of state.features.needs || []) {
      const info = byId[n.thread_id];
      if (info && info.project) touch(info.project).needs += 1;
    }
    let activeTotal = 0;
    for (const row of names.values()) activeTotal += row.active;
    const row = (label, name, right, rightWarn) => {
      const b = el('button', `side-row${filter === name ? ' on' : ''}`);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(filter === name));
      b.append(el('span', 'side-name', label), el('span', `side-count${rightWarn ? ' warn' : ''}`, right));
      b.addEventListener('click', () => { filter = name; refreshView(); });
      return b;
    };
    root.append(row('All projects', '', `${activeTotal} active`));
    for (const [name, v] of names) {
      const right = v.needs ? `${v.active} · ${v.needs} ${v.needs === 1 ? 'needs' : 'need'} you` : String(v.active);
      root.append(row(name, name, right, v.needs > 0));
    }
  }

  function renderSideMachines() {
    const root = document.getElementById('side-machines');
    root.replaceChildren();
    for (const group of state.machines) {
      const row = el('a', `side-row machine${group.reachable ? '' : ' down'}`);
      row.href = '/wheelchair/app/sessions';
      row.append(el('span', `dotmark ${group.reachable ? 'green' : ''}`), el('span', 'side-name', group.machine));
      if (group.hub) row.append(el('span', 'pill', 'hub'));
      else {
        const n = (group.sessions || []).filter((s) => s.managed !== false).length;
        row.append(el('span', 'side-count', group.reachable ? `${n} ${n === 1 ? 'session' : 'sessions'}` : 'unreachable'));
      }
      root.append(row);
    }
  }

  function renderNeeds(byId) {
    const all = state.features.needs || [];
    const needs = all.filter((item) => { const info = byId[item.thread_id]; return keep(info ? info.project : ''); });
    const list = document.getElementById('needs-list');
    list.replaceChildren();
    for (const item of needs) {
      const info = byId[item.thread_id] || {};
      const row = el('li', 'need');
      row.dataset.kind = item.kind;
      const link = el('a', 'v-link', '');
      link.href = threadHref(item.thread_id, item.card_id);
      const eyebrow = [KIND[item.kind] || item.kind, stageName(info.stage)].filter(Boolean).join(' · ');
      link.append(el('span', 'eyebrow warn', eyebrow), el('span', 'need-title', item.title));
      const where = [info.project, info.slug].filter(Boolean).join(' / ');
      if (where) link.append(el('span', 'need-meta', where));
      row.append(link);
      list.append(row);
    }
    document.getElementById('needs').hidden = needs.length === 0;
    document.getElementById('needs-sub').textContent = needs.length === 1
      ? '1 thing is waiting.' : `${needs.length} things are waiting.`;
  }

  function featureCard(feature, key, byId, waiting) {
    const row = el('li', 'v-card feature');
    const info = byId[feature.id] || {};
    const link = el('a', 'v-link', '');
    link.href = threadHref(feature.id);
    link.append(el('span', 'feature-title', info.title || feature.slug));
    link.append(el('span', 'feature-meta', `${base(feature.project)} / ${feature.slug}`));
    if (waiting[feature.id]) link.append(el('span', 'feature-state warn', 'Waiting on you'));
    else link.append(el('span', 'feature-state', feature.status || key));
    row.append(link);
    return row;
  }

  function renderGroups(byId) {
    const root = document.getElementById('groups');
    root.replaceChildren();
    const waiting = {};
    for (const n of state.features.needs || []) waiting[n.thread_id] = true;
    let total = 0;
    for (const [key, title] of STAGES) {
      const items = (state.features[key] || []).filter((f) => keep(base(f.project)));
      total += items.length;
      const group = el('section', `v-group${items.length ? '' : ' empty'}`);
      group.dataset.stage = key;
      const head = el('div', 'stage-head');
      head.append(el('h3', '', title), el('span', 'stage-count', String(items.length)));
      group.append(head);
      const list = el('ul', 'v-list');
      const collapsed = key === 'done' && !doneOpen && items.length > DONE_SHOWN;
      for (const feature of collapsed ? items.slice(0, DONE_SHOWN) : items) list.append(featureCard(feature, key, byId, waiting));
      group.append(list);
      if (key === 'done' && items.length > DONE_SHOWN) {
        const more = el('button', 'link show-all', doneOpen ? 'Show fewer' : `Show all ${items.length}`);
        more.type = 'button';
        more.addEventListener('click', () => { doneOpen = !doneOpen; refreshView(); });
        group.append(more);
      }
      root.append(group);
    }
    document.getElementById('empty').hidden = total > 0;
  }

  function refreshView() {
    const byId = index();
    renderSideProjects(byId);
    renderSideMachines();
    renderNeeds(byId);
    renderGroups(byId);
  }

  async function json(path) {
    const response = await fetch(`${API}${path}`);
    if (!response.ok) throw new Error(`${path.slice(1)} ${response.status}`);
    return response.json();
  }

  async function refresh() {
    const error = document.getElementById('error');
    try {
      const [features, threads, projects, machines] = await Promise.all([
        json('/features'),
        json('/threads').catch(() => ({})),
        json('/projects').catch(() => ({})),
        json('/sessions').catch(() => []),
      ]);
      state = {
        features,
        threads: threads.threads || [],
        projects: projects.projects || [],
        machines: Array.isArray(machines) ? machines : [],
      };
      refreshView();
      error.hidden = true;
    } catch (failure) {
      error.textContent = `Could not load features: ${failure.message}`;
      error.hidden = false;
    }
  }

  refresh();
  setInterval(refresh, 5000);
})();
