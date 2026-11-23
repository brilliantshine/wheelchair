(function () {
  'use strict';
  // The thread list (grouped by project), shared by the Threads page and the thread page.
  // `?new=1` is the old way into the New thread form and now goes to its own screen.
  const API = '/wheelchair/api';
  const listEl = document.getElementById('list');
  const emptyEl = document.getElementById('empty');
  const errorEl = document.getElementById('list-error');
  const archivedBox = document.getElementById('show-archived');
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

  function render() {
    const shown = threads.filter((t) => archivedBox.checked || !t.archived)
      .sort((a, b) => stamp(b) - stamp(a));
    listEl.textContent = '';
    emptyEl.hidden = shown.length > 0;
    if (onboarding) {
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
      const open = el('a', 'btn-link primary', 'Open Settings'); open.href = '/wheelchair/app/settings#harnesses';
      li.appendChild(open); listEl.appendChild(li);
    }
    for (const notice of notices) {
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
      const key = base(t.project);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    }
    for (const [name, members] of groups) {
      listEl.appendChild(el('li', 'group-label', name));
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
    if (cached && Array.isArray(cached.threads)) apply(cached.threads, cached.features || {});
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

  async function poll() {
    pollOnboarding();
    try {
      const [res, features] = await Promise.all([
        fetch(API + '/threads?view=list'),
        fetch(API + '/features').then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
      ]);
      if (!res.ok) throw new Error('http ' + res.status);
      const payload = await res.json();
      const list = payload.threads || []; notices = payload.revoke_notices || [];
      errorEl.hidden = true;
      apply(list, features);
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ threads: list, features })); } catch (e) { /* no cache */ }
    } catch (e) {
      errorEl.hidden = false;
      errorEl.textContent = 'Could not refresh threads.';
    }
  }

  archivedBox.addEventListener('change', render);
  if (new URLSearchParams(location.search).get('new')) location.replace('/wheelchair/app/new');

  poll();
  window.wcPoller(poll, 5000);
})();
