(function () {
  'use strict';
  // The thread list (grouped by project), shared by the Threads page and the thread page.
  // `?new=1` is the old way into the New thread form and now goes to its own screen.
  const API = '/wheelchair/api';
  const listEl = document.getElementById('list');
  const emptyEl = document.getElementById('empty');
  const errorEl = document.getElementById('list-error');
  const archivedBtn = document.getElementById('show-archived');
  // Archived is a separate view (only archived threads), kept for this tab so opening one keeps it.
  const ARCHIVED_KEY = 'wheelchair.showArchived';
  let showArchived = false;
  try { showArchived = sessionStorage.getItem(ARCHIVED_KEY) === '1'; } catch (e) { /* off */ }
  const currentId = new URLSearchParams(location.search).get('id') || '';
  const STAGE = {
    idea: 'Idea', planning: 'Planning', review: 'Review', building: 'Building', verifying: 'Verifying', done: 'Done',
  };
  const QUICK_STAGE = { building: 'Building', verifying: 'Verifying', verified: 'Verified' };
  const PROVIDER_LABEL = Object.fromEntries((window.WHEELCHAIR_TOOLS || []).map((t) => [t.provider, t.label]));
  let threads = [];
  let notices = [];
  let titles = {};
  let stages = {};   // thread id -> stage label, from the features data
  let waiting = {};  // thread id -> number of open cards that need you
  let onboarding = null; // GET /onboarding when show is true, else null
  let leadsOn = false;   // GET /project-lead says project leads are on

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
  // Your last message in the thread; agent activity does not move it. Older threads fall back to creation.
  function stamp(t) { return Date.parse(t.user_at || t.created_at) || 0; }
  function nameOf(t) { return t.title || t.slug || base(t.project); }
  // A project is one machine (resolved by the hub) plus one exact folder path.
  const projectKey = (t) => JSON.stringify([t.machine_key || t.machine, t.project]);
  const shortHome = (p) => String(p || '').replace(/^\/(?:home|Users)\/[^/]+(?=\/|$)/, '~');

  function row(t) {
    const li = el('li', 'row' + (t.id === currentId ? ' current' : ''));
    li.dataset.id = t.id;
    const top = el('div', 'top');
    // A small fix has no plan and so no plan stage: its done card marks it Done, and until then
    // its pinned progress line says Building, Verifying or Verified.
    const stage = stages[t.id] || (t.done_card ? 'Done' : QUICK_STAGE[t.progress_stage]);
    const working = !t.archived && (t.sessions || []).some((s) => s.role === 'lead' && s.live && s.ready && s.turn_ended === false);
    const dot = el('span', 'dotmark ' + (waiting[t.id] ? 'amber' : stage === 'Done' ? 'green' : stage ? 'blue' : '') + (working ? ' working' : ''));
    if (working) dot.title = 'Working';
    top.appendChild(dot);
    const a = el('a', 'row-link title', nameOf(t));
    a.href = '/wheelchair/app/thread?id=' + encodeURIComponent(t.id);
    if (t.id === currentId) a.setAttribute('aria-current', 'page');
    top.appendChild(a);
    if (t.lead_name) {
      const newest = (t.sessions || []).filter((s) => s.role === 'lead')
        .reduce((a, b) => !a || (b.created_at || '') > (a.created_at || '') ? b : a, null);
      const chip = el(newest && newest.live ? 'a' : 'span', 'lead-chip', t.lead_name);
      if (newest && newest.live) chip.href = '/wheelchair/app/agents?lead=' + encodeURIComponent(t.id);
      top.appendChild(chip);
    }
    // A stub is only a stub until it is opened: once a lead runs in it, it is ordinary work.
    if (t.stub && !(t.sessions || []).length) {
      top.appendChild(el('span', 'badge', 'stub'));
      if (t.ready) top.appendChild(el('span', 'badge good', 'ready'));
      else if (t.depends_on_parent) {
        top.appendChild(el('span', 'badge warn', 'waiting for ' + (titles[t.parent] || t.parent_title || t.parent)));
      }
    }
    if (t.handed_off) top.appendChild(el('span', 'badge', 'handed off'));
    if (t.archived) top.appendChild(el('span', 'badge', 'archived'));
    li.appendChild(top);
    li.appendChild(el('div', 'sub', [
      stage, waiting[t.id] ? 'needs you' : '', PROVIDER_LABEL[t.provider] || t.cli, t.machine, ago(t.user_at || t.created_at),
    ].filter(Boolean).join(' · ')));
    return li;
  }

  // A pinned conversation row (the assistant's, or a project lead's): never archivable, with a line
  // of its latest reply. A project lead with no record yet has no thread to link to.
  function conversationRow(t, cls, label, empty) {
    const li = el('li', 'row ' + cls + (t && t.id === currentId ? ' current' : ''));
    if (t) li.dataset.id = t.id;
    const top = el('div', 'top');
    const n = (t && waiting[t.id]) || 0;
    const preview = t ? previewOf(t.id).text : '';
    // A project lead's dot stays grey until it has something to say.
    const colour = n ? 'amber' : cls === 'assistant-row' || preview ? 'blue' : '';
    top.appendChild(el('span', 'dotmark ' + colour));
    const a = el('a', 'row-link title', label);
    a.href = t ? '/wheelchair/app/thread?id=' + encodeURIComponent(t.id) : '#';
    if (t && t.id === currentId) a.setAttribute('aria-current', 'page');
    top.appendChild(a);
    if (n) top.appendChild(el('span', 'badge warn', n + ' needs you'));
    li.appendChild(top);
    li.appendChild(el('div', 'sub assistant-preview', preview || empty));
    return li;
  }

  let opening = false;
  // Opening an unstarted project lead makes its record (which starts nothing), then goes to it.
  async function openProjectLead(machine, path) {
    if (opening) return;
    opening = true;
    try {
      const res = await fetch(API + '/project-leads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ machine, path }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.detail || out.error || 'http ' + res.status);
      location.assign('/wheelchair/app/thread?id=' + encodeURIComponent(out.thread));
    } catch (e) { errorEl.hidden = false; errorEl.textContent = 'Could not open the project lead: ' + e.message; }
    finally { opening = false; }
  }

  function render() {
    const assistant = threads.find((t) => t.assistant);
    const shown = threads.filter((t) => !t.assistant && !t.project_lead && !!t.archived === showArchived)
      .sort((a, b) => stamp(b) - stamp(a));
    archivedBtn.setAttribute('aria-pressed', String(showArchived));
    archivedBtn.textContent = showArchived ? '\u2190 Back to threads' : 'Archived';
    listEl.textContent = '';
    emptyEl.textContent = showArchived ? 'No archived threads.' : 'No threads yet.';
    emptyEl.hidden = shown.length > 0 || (!!assistant && !showArchived);
    if (showArchived) listEl.appendChild(el('li', 'group-label', 'Archived'));
    if (assistant && !showArchived) listEl.appendChild(conversationRow(assistant, 'assistant-row', 'Personal assistant', 'Ask it about your threads.'));
    if (onboarding && !showArchived) {
      const li = el('li', 'card onboarding'); li.id = 'onboarding';
      li.appendChild(el('h3', '', 'Set up an agent'));
      const steps = el('ul', 'ob-steps');
      for (const step of onboarding.steps || []) {
        const item = el('li', 'ob-step' + (step.done ? ' done' : ''));
        item.dataset.step = step.id;
        item.appendChild(el('span', 'ob-tick', step.done ? '\u2713' : '\u25CB'));
        const text = el('span', 'ob-text'); text.appendChild(el('span', '', step.label));
        if (step.id === 'start' && !step.done && step.reason) text.appendChild(el('span', 'ob-reason dim', step.reason));
        item.appendChild(text); steps.appendChild(item);
      }
      li.appendChild(steps);
      li.appendChild(el('p', 'dim', "Leave out the ones you don't use."));
      const open = el('a', 'btn-link primary', 'Open Settings'); open.href = '/wheelchair/app/settings#providers';
      li.appendChild(open); listEl.appendChild(li);
    }
    for (const notice of showArchived ? [] : notices) {
      const li = el('li', 'card amber'); li.appendChild(el('p', '', notice.text));
      const dismiss = el('button', 'small', 'Dismiss'); dismiss.type = 'button';
      dismiss.addEventListener('click', async () => {
        dismiss.disabled = true;
        try {
          const res = await fetch(API + '/handoff-revokes/dismiss', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ thread_id: notice.thread_id, sha: notice.sha }) });
          const out = await res.json().catch(() => ({})); if (!res.ok) throw new Error(out.detail || out.error || 'http ' + res.status);
          notices = notices.filter((n) => n.thread_id !== notice.thread_id || n.sha !== notice.sha); render();
        } catch (e) { errorEl.hidden = false; errorEl.textContent = e.message; dismiss.disabled = false; }
      });
      li.appendChild(dismiss); listEl.appendChild(li);
    }
    // Groups by project, the project you last wrote in first; most recently written-in first inside each.
    const groups = new Map();
    for (const t of shown) {
      const key = projectKey(t);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    }
    // Two shown groups with one folder name are told apart by path, and by machine when those differ.
    const sameName = new Map();
    for (const [first] of groups.values()) {
      const name = base(first.project);
      if (!sameName.has(name)) sameName.set(name, []);
      sameName.get(name).push(first);
    }
    const leads = new Map(threads.filter((t) => t.project_lead).map((t) => [projectKey(t), t]));
    for (const [key, members] of groups) {
      const first = members[0];
      const twins = sameName.get(base(first.project));
      const shared = twins.length > 1;
      const where = shared ? shortHome(first.project) : base(first.project);
      const machines = new Set(twins.map((t) => t.machine_key || t.machine));
      const suffix = shared && machines.size > 1 ? ' \u00b7 ' + (first.machine_key || first.machine) : '';
      // A path keeps its own case: the uppercase heading style would hide the difference.
      listEl.appendChild(el('li', 'group-label' + (shared ? ' path' : ''), where + suffix));
      // The hub resolves no machine for a project on a removed one, and then it has no lead.
      if (leadsOn && !showArchived && first.machine_key) {
        const record = leads.get(key);
        const li = conversationRow(record, 'lead-row', where + ' lead' + suffix, 'Ask about this project');
        if (!record) li.querySelector('a').addEventListener('click', (ev) => { ev.preventDefault(); openProjectLead(first.machine, first.project); });
        listEl.appendChild(li);
      }
      for (const t of members) listEl.appendChild(row(t));
    }
  }

  // The last list this tab saw, drawn at once on the next page load so switching threads
  // never shows an empty sidebar while the fresh list is fetched. Storage may throw; then skip it.
  const CACHE_KEY = 'wheelchair.threadList';
  function apply(list, features) {
    threads = list;
    stages = {}; waiting = {};
    for (const key of Object.keys(STAGE)) for (const f of features[key] || []) stages[f.id] = STAGE[key];
    for (const n of features.needs || []) waiting[n.thread_id] = (waiting[n.thread_id] || 0) + 1;
    titles = {};
    for (const t of threads) titles[t.id] = nameOf(t);
    render();
  }
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
    if (cached && Array.isArray(cached.threads)) { leadsOn = !!cached.leadsOn; apply(cached.threads, cached.features || {}); }
  } catch (e) { /* draw on the first fetch instead */ }

  async function pollOnboarding() {
    try {
      const res = await fetch(API + '/onboarding');
      if (!res.ok) throw new Error('http ' + res.status);
      const body = await res.json();
      onboarding = body && body.show && Array.isArray(body.steps) && body.steps.length ? body : null;
    } catch (e) { onboarding = null; }
    render();
  }

  // One line from the assistant's newest reply: its first non-empty line, minus leading Markdown block
  // markers and emphasis marks, cut at 90 characters.
  const previewStyle = document.createElement('link');
  previewStyle.rel = 'stylesheet'; previewStyle.href = '/wheelchair/assets/pages/views.css';
  document.head.appendChild(previewStyle);
  function previewLine(text) {
    const line = String(text).split('\n').map((x) => x.trim()).find(Boolean) || '';
    const plain = line.replace(/^(?:#{1,6}\s+|>\s*|[-*]\s+|\d+\.\s+)+/, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\*\*|`/g, '').trim();
    return plain.length > 90 ? plain.slice(0, 89) + '\u2026' : plain;
  }

  // Fetched on load and then at most once a minute, never awaited by the list; a failure keeps the last one.
  // Cached per conversation: the assistant's and each project lead's.
  const previews = {};
  const previewKey = (threadId) => 'wheelchair.preview:' + threadId;
  function previewOf(threadId) {
    if (!previews[threadId]) {
      let text = '';
      try { text = sessionStorage.getItem(previewKey(threadId)) || ''; } catch (e) { /* none yet */ }
      previews[threadId] = { text, at: 0, busy: false };
    }
    return previews[threadId];
  }
  async function loadPreview(threadId) {
    const entry = previewOf(threadId);
    if (entry.busy || Date.now() - entry.at < 60000) return;
    entry.busy = true; entry.at = Date.now();
    try {
      const res = await fetch(API + '/threads/' + encodeURIComponent(threadId) + '/chat');
      if (!res.ok) return;
      const body = await res.json();
      const last = (body.items || []).filter((i) => i.type === 'assistant' && i.text).pop();
      const next = last ? previewLine(last.text) : '';
      try { sessionStorage.setItem(previewKey(threadId), next); } catch (e) { /* no cache */ }
      if (next !== entry.text) { entry.text = next; render(); }
    } catch (e) { /* keep the last preview */ } finally { entry.busy = false; }
  }

  async function poll() {
    pollOnboarding();
    try {
      const [res, features, projectLeads] = await Promise.all([
        fetch(API + '/threads?view=list'),
        fetch(API + '/features').then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
        fetch(API + '/project-lead').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (!res.ok) throw new Error('http ' + res.status);
      const payload = await res.json();
      const list = payload.threads || []; notices = payload.revoke_notices || [];
      errorEl.hidden = true;
      if (projectLeads) leadsOn = projectLeads.on === true;
      apply(list, features);
      for (const t of list) if (t.assistant || (leadsOn && t.project_lead)) loadPreview(t.id);
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ threads: list, features, leadsOn })); } catch (e) { /* no cache */ }
    } catch (e) {
      errorEl.hidden = false;
      errorEl.textContent = 'Could not refresh threads.';
    }
  }

  archivedBtn.addEventListener('click', () => {
    showArchived = !showArchived;
    try { sessionStorage.setItem(ARCHIVED_KEY, showArchived ? '1' : '0'); } catch (e) { /* this page only */ }
    render();
  });
  if (new URLSearchParams(location.search).get('new')) location.replace('/wheelchair/app/new');

  poll();
  window.wcPoller(poll, 5000);
})();
