'use strict';

(() => {
  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function attachCommand(machine, name, isHub) {
    return isHub ? `tmux attach -t ${name}` : `ssh ${machine} -t tmux attach -t ${name}`;
  }
  async function copy(text, button) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const area = el('textarea'); area.value = text; document.body.append(area); area.select();
      try { document.execCommand('copy'); } catch { /* command remains visible */ }
      area.remove();
    }
    button.textContent = 'Copied';
    setTimeout(() => { button.textContent = 'Copy'; }, 1500);
  }
  const closed = new Set();
  let highlighted = false;
  function render(data, threads) {
    const root = document.getElementById('agents');
    const banners = document.getElementById('unreachable');
    root.replaceChildren(); banners.replaceChildren();
    for (const machine of data.machines || []) {
      if (machine.reachable) continue;
      const date = machine.last_seen && new Date(machine.last_seen);
      const seen = date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : 'never';
      banners.append(el('p', 'agent-unreachable', `${machine.machine} unreachable, last seen ${seen}`));
    }
    const timestamps = new Map(threads.map(t => [t.id, t.collin_at || t.created_at || '']));
    const leads = [...(data.leads || [])].sort((a, b) => String(timestamps.get(b.thread_id) || '').localeCompare(String(timestamps.get(a.thread_id) || '')));
    for (const lead of leads) {
      const group = el('section', 'agent-group'); group.id = `lead-${lead.thread_id}`;
      const machine = (data.machines || []).find(m => lead.machine === 'hub' ? m.hub : m.machine === lead.machine);
      const machineName = machine ? machine.machine : lead.machine;
      const names = new Map();
      function collect(node) { names.set(node.name, node); for (const child of node.children || []) collect(child); }
      collect(lead.session);
      const marked = new Set();
      function mark(node) { for (const name of node.waiting_on || []) marked.add(name); for (const child of node.children || []) mark(child); }
      mark(lead.session);
      function card(node, isLead, depth) {
        const wrapper = el('div', 'agent-node');
        const row = el('div', `v-card session agent-card${node.live ? '' : ' ended'}${marked.has(node.name) ? ' awaited' : ''}`);
        row.dataset.session = node.name;
        const head = el('div', 'session-head');
        const who = el('div', 'who');
        who.append(el('span', 'session-name', isLead ? (lead.lead_name || 'lead') : (node.role || 'agent')));
        if (!isLead) who.append(el('span', 'session-sub', node.name));
        if (isLead && node.live && lead.thread_title) who.append(el('span', 'session-thread', lead.thread_title));
        if (node.live) who.append(el('span', 'session-sub', [machineName, node.cli || 'CLI unknown', node.model || 'model unknown', node.effort || 'default effort'].join(' · ')));
        head.append(who);
        if (isLead) head.append(el('span', 'v-badge role', 'lead'));
        const status = !node.live ? 'ended' : node.status === 'waiting' ? 'waiting for capacity' : node.status === 'starting' ? 'starting' : 'running';
        head.append(el('span', 'v-badge', status));
        row.append(head);
        if (node.live) {
          if ((node.waiting_on || []).length) {
            const roles = [...new Set(node.waiting_on.map(name => names.get(name)?.role || name))];
            row.append(el('div', 'agent-waiting', `Waiting on: ${roles.join(', ')}`));
          }
          if (node.status === 'waiting') {
            const date = node.waiting_until && new Date(node.waiting_until);
            row.append(el('div', 'agent-waiting', `Waiting for capacity until ${date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : 'unknown'}`));
          } else {
            const body = el('div', 'session-body'); const attach = el('div', 'v-attach');
            const command = attachCommand(machineName, node.name, machine?.hub === true);
            attach.append(el('code', 'attach', command)); const button = el('button', '', 'Copy'); button.type = 'button'; button.addEventListener('click', () => copy(command, button)); attach.append(button); body.append(attach); row.append(body);
          }
          const foot = el('div', 'session-foot');
          if (node.status !== 'waiting') { const terminal = el('a', 'btn', 'Open terminal'); terminal.href = `/wheelchair/app/terminal?name=${encodeURIComponent(node.name)}`; foot.append(terminal); }
          if (isLead) { const thread = el('a', 'btn', 'Open thread'); thread.href = `/wheelchair/app/thread?id=${encodeURIComponent(lead.thread_id)}`; foot.append(thread); }
          if (foot.childNodes.length) row.append(foot);
        }
        wrapper.append(row);
        if ((node.children || []).length) {
          const fold = el('details', 'agent-fold'); fold.open = !closed.has(node.name);
          fold.addEventListener('toggle', () => { if (fold.open) closed.delete(node.name); else closed.add(node.name); });
          fold.append(el('summary', '', `${node.children.length} ${node.children.length === 1 ? 'agent' : 'agents'}`));
          const children = el('div', `agent-children${depth >= 2 ? ' capped' : ''}`);
          for (const child of node.children) children.append(card(child, false, depth + 1));
          fold.append(children); wrapper.append(fold);
        }
        return wrapper;
      }
      group.append(card(lead.session, true, 0)); root.append(group);
    }
    document.getElementById('empty').hidden = leads.length > 0;
    if (!highlighted && location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) { highlighted = true; target.scrollIntoView(); target.classList.add('highlight'); setTimeout(() => target.classList.remove('highlight'), 3000); }
    }
  }
  async function refresh() {
    try {
      const [response, threadResponse] = await Promise.all([fetch('/wheelchair/api/agents'), fetch('/wheelchair/api/threads?view=list')]);
      if (!response.ok) throw new Error(`agents ${response.status}`);
      const threads = threadResponse.ok ? (await threadResponse.json()).threads || [] : [];
      render(await response.json(), threads); document.getElementById('error').hidden = true;
    } catch (failure) { const error = document.getElementById('error'); error.textContent = `Could not load agents: ${failure.message}`; error.hidden = false; }
  }
  refresh(); setInterval(refresh, 5000);
})();
