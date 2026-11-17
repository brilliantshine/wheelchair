'use strict';

// Terminal page (Spec "Views"): xterm.js over pane reads and raw tmux keys. Every key goes
// through as typed; this page never adds an Enter the user did not type.
(() => {
  const params = new URLSearchParams(location.search);
  // Login mode: ?login=<account id>&machine=<m> drives that sign-in's tmux pane through the
  // account routes; the Agents page never lists it.
  const login = params.get('login') || '';
  const loginMachine = params.get('machine') || '';
  const name = login ? `sign-in ${login} on ${loginMachine}` : (params.get('name') || '');
  const base = login
    ? `/wheelchair/api/accounts/${encodeURIComponent(login)}/signin/${encodeURIComponent(loginMachine)}`
    : `/wheelchair/api/sessions/${encodeURIComponent(name)}`;
  const status = document.getElementById('term-status');
  document.getElementById('term-name').textContent = name;
  async function leadName() {
    if (login || !name) return;
    try {
      const response = await fetch('/wheelchair/api/agents');
      const data = response.ok ? await response.json() : { leads: [] };
      let lead = (data.leads || []).find(item => item.session.name === name);
      if (!lead) {
        const threads = await fetch('/wheelchair/api/threads?view=list');
        if (threads.ok) lead = ((await threads.json()).threads || []).find(t => (t.sessions || []).some(s => s.role === 'lead' && s.name === name));
      }
      if (lead && lead.lead_name) document.getElementById('term-name').textContent = `${lead.lead_name} · ${name}`;
    } catch { /* retain session name */ }
  }
  leadName();

  const handle = window.TermView.mount(document.getElementById('term-container'), {
    base, paneField: login ? 'text' : 'pane', history: login ? 0 : 2000, label: name,
    onStatus(text, ok) { status.textContent = text; status.className = `v-badge ${ok ? 'ok' : 'bad'}`; },
  });
  document.querySelector('.term-bar').append(handle.switchEl);
  window.termView = handle;
})();
