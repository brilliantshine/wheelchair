'use strict';

// Sessions view (Spec "Views"): every session on every machine, grouped by machine.
(() => {
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function attachCommand(machine, name, isHub) {
    return isHub ? `tmux attach -t ${name}` : `ssh ${machine} -t tmux attach -t ${name}`;
  }

  async function copy(text, button) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = el('textarea');
      area.value = text;
      document.body.append(area);
      area.select();
      try { document.execCommand('copy'); } catch { /* the command stays visible to copy by hand */ }
      area.remove();
    }
    button.textContent = 'Copied';
    setTimeout(() => { button.textContent = 'Copy'; }, 1500);
  }

  // A tmux session the app did not start: named, never typed into (the terminal page and the
  // keys route refuse it too).
  function unmanagedRow(machine, session) {
    const row = el('li', 'v-card session unmanaged');
    row.dataset.session = session.name;
    row.append(el('span', 'v-label', session.name));
    row.append(el('span', 'v-badge role', 'unmanaged'));
    row.append(el('span', 'v-badge', 'read-only'));
    return row;
  }

  function sessionRow(machine, session, isHub) {
    if (session.managed === false) return unmanagedRow(machine, session);
    const running = session.running !== false && session.status !== 'stopped';
    const row = el('li', 'v-card session');
    row.dataset.session = session.name;
    const head = el('div', 'session-head');
    head.append(el('span', `dotmark ${running ? 'blue' : ''}`));
    const who = el('div', 'who');
    const terminal = el('a', 'v-link session-name', session.name);
    terminal.href = `/wheelchair/app/terminal?name=${encodeURIComponent(session.name)}`;
    who.append(terminal);
    // Spec "Views": each session shows the thread or feature it belongs to.
    const title = session.thread_id && (titles[session.thread_id] || session.thread_id);
    if (title) who.append(el('span', 'session-thread', title));
    who.append(el('span', 'session-sub', [machine, session.cli, session.model].filter(Boolean).join(' \u00b7 ')));
    head.append(who);
    head.append(el('span', 'v-badge role', session.role || 'session'));
    head.append(el('span', `v-badge ${running ? 'ok' : 'bad'}`, running ? 'running' : 'stopped'));
    row.append(head);

    const body = el('div', 'session-body');
    const attach = el('div', 'v-attach');
    const command = attachCommand(machine, session.name, isHub);
    attach.append(el('code', 'attach', command));
    const button = el('button', '', 'Copy');
    button.type = 'button';
    button.addEventListener('click', () => copy(command, button));
    attach.append(button);
    body.append(attach);
    row.append(body);

    const foot = el('div', 'session-foot');
    const open = el('a', 'btn', 'Open terminal');
    open.href = terminal.href;
    foot.append(open);
    if (session.thread_id) {
      const thread = el('a', 'btn', 'Open thread');
      thread.href = `/wheelchair/app/thread?id=${encodeURIComponent(session.thread_id)}`;
      foot.append(thread);
    }
    row.append(foot);
    return row;
  }

  function seenText(group) {
    const when = group.last_seen ? new Date(group.last_seen) : null;
    return when && !Number.isNaN(when.getTime()) ? `last seen ${when.toLocaleString()}` : 'last seen: never';
  }

  function render(groups) {
    const root = document.getElementById('machines');
    root.replaceChildren();
    for (const group of groups) {
      const section = el('section', `v-machine${group.reachable ? '' : ' unreachable'}`);
      section.dataset.machine = group.machine;
      const header = el('header');
      header.append(el('span', `dotmark ${group.reachable ? 'green' : ''}`));
      header.append(el('span', 'machine-name', group.machine));
      if (group.hub) header.append(el('span', 'v-badge', 'hub'));
      header.append(el('span', `v-badge ${group.reachable ? 'ok' : 'bad'}`,
        group.reachable ? 'reachable' : 'unreachable'));
      if (!group.reachable) header.append(el('span', 'v-badge seen', seenText(group)));
      section.append(header);
      const list = el('ul', 'v-list');
      for (const session of group.sessions || []) list.append(sessionRow(group.machine, session, group.hub === true));
      if (group.reachable && !(group.sessions || []).length) {
        list.append(el('li', 'v-empty', 'No sessions.'));
      }
      section.append(list);
      root.append(section);
    }
    document.getElementById('empty').hidden = groups.length > 0;
  }

  let titles = {};
  async function loadTitles() {
    try {
      const response = await fetch('/wheelchair/api/threads');
      if (!response.ok) return;
      const body = await response.json();
      titles = Object.fromEntries((body.threads || []).map((thread) => [thread.id, thread.title || thread.slug || thread.id]));
    } catch { /* titles are a nicety; the thread id still shows */ }
  }

  async function refresh() {
    const error = document.getElementById('error');
    try {
      await loadTitles();
      const response = await fetch('/wheelchair/api/sessions');
      if (!response.ok) throw new Error(`sessions ${response.status}`);
      render(await response.json());
      error.hidden = true;
    } catch (failure) {
      error.textContent = `Could not load sessions: ${failure.message}`;
      error.hidden = false;
    }
  }

  refresh();
  setInterval(refresh, 5000);
})();
