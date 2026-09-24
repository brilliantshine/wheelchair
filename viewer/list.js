(function () {
  'use strict';

  const POLL_MS = 5000;

  const errorBanner = document.getElementById('error-banner');
  const emptyEl = document.getElementById('empty');
  const sessionsSection = document.getElementById('sessions-section');
  const sessionsEl = document.getElementById('sessions');
  const plansSection = document.getElementById('plans-section');
  const plansWrap = document.getElementById('plans-wrap');

  const HARNESS_LABEL = { claude: 'Claude', codex: 'Codex', other: 'other' };

  // Every URL below lives under /wheelchair and carries no token — the cookie set on the
  // first-visit redirect authenticates every request from here on.
  function graphUrl(path) {
    return '/wheelchair/?path=' + encodeURIComponent(path);
  }

  function planUrl(dir) {
    return '/wheelchair/docs?plan=' + encodeURIComponent(dir);
  }

  function el(tag, attrs) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const key in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, key)) continue;
        if (key === 'class') node.className = attrs[key];
        else if (key === 'text') node.textContent = attrs[key];
        else node.setAttribute(key, attrs[key]);
      }
    }
    return node;
  }

  function formatAge(ms) {
    if (typeof ms !== 'number' || !isFinite(ms)) return '';
    const diff = Math.max(0, Date.now() - ms);
    const s = Math.floor(diff / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    const d = Math.floor(h / 24);
    return d + 'd ago';
  }

  function renderGraphItem(graph) {
    const li = el('li');
    const a = el('a', { href: graphUrl(graph.path) });
    a.appendChild(el('span', { class: 'title', text: graph.title || graph.path }));
    a.appendChild(el('span', { class: 'harness', text: HARNESS_LABEL[graph.harness] || 'other' }));
    a.appendChild(el('span', { class: 'age', text: formatAge(graph.modified) }));
    li.appendChild(a);
    return li;
  }

  function renderSession(session) {
    const section = el('section', { class: 'group' });
    const header = el('header');
    header.appendChild(el('span', {
      class: 'name',
      text: session.name === null || session.name === undefined ? 'not in tmux' : session.name
    }));
    if (!session.running) {
      header.appendChild(el('span', { class: 'badge ended', text: 'ended' }));
    } else if (session.attach) {
      header.appendChild(el('code', { text: session.attach }));
    }
    section.appendChild(header);
    const ul = el('ul', { class: 'graph-list' });
    const graphs = session.graphs || [];
    for (let i = 0; i < graphs.length; i++) ul.appendChild(renderGraphItem(graphs[i]));
    section.appendChild(ul);
    return section;
  }

  function renderPlansTable(plans) {
    const table = el('table', { class: 'plans' });
    const thead = el('thead');
    const headRow = el('tr');
    const headings = ['Slug', 'Repo', 'Status', 'Session'];
    for (let i = 0; i < headings.length; i++) headRow.appendChild(el('th', { text: headings[i] }));
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = el('tbody');
    for (let i = 0; i < plans.length; i++) {
      const p = plans[i];
      const tr = el('tr');
      const slugTd = el('td');
      const link = el('a', { href: planUrl(p.dir), text: p.slug });
      slugTd.appendChild(link);
      tr.appendChild(slugTd);
      tr.appendChild(el('td', { text: p.repo }));
      tr.appendChild(el('td', { text: p.status === null || p.status === undefined ? 'no PLAN.md' : p.status }));
      tr.appendChild(el('td', { text: p.session === null || p.session === undefined ? 'not in tmux' : p.session }));
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return table;
  }

  function render(data) {
    const sessions = (data && data.sessions) || [];
    const plans = (data && data.plans) || [];
    const hasSessions = sessions.length > 0;
    const hasPlans = plans.length > 0;

    sessionsSection.hidden = !hasSessions;
    plansSection.hidden = !hasPlans;
    emptyEl.hidden = hasSessions || hasPlans;

    sessionsEl.textContent = '';
    if (hasSessions) {
      for (let i = 0; i < sessions.length; i++) sessionsEl.appendChild(renderSession(sessions[i]));
    }

    plansWrap.textContent = '';
    if (hasPlans) plansWrap.appendChild(renderPlansTable(plans));
  }

  let lastGood = null;

  async function poll() {
    try {
      const res = await fetch('/wheelchair/list');
      if (!res.ok) throw new Error('http ' + res.status);
      const data = await res.json();
      lastGood = data;
      errorBanner.hidden = true;
      errorBanner.textContent = '';
      render(data);
    } catch (err) {
      errorBanner.hidden = false;
      errorBanner.textContent = 'Could not refresh the list — showing the last known state.';
      if (lastGood) render(lastGood);
    }
  }

  poll();
  setInterval(poll, POLL_MS);
})();
