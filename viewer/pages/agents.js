'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const button = (text, fn, cls = '') => { const b = el('button', cls, text); b.type = 'button'; b.onclick = fn; return b; };
  let data = { leads: [], machines: [] }, threads = [], term = null, termName = null, folded = true;
  const panel = $('agents-terminal');
  function options(node) { return { base: `/wheelchair/api/sessions/${encodeURIComponent(node.name)}`, paneField: 'pane', history: 2000, label: node.display_title || node.role, onStatus: (text) => { $('agents-terminal-status').textContent = text; } }; }
  function closeTerm() { if (term) term.destroy(); term = null; termName = null; window.agentsTermView = null; panel.hidden = true; panel.classList.remove('full'); }
  function openTerm(node) { closeTerm(); panel.hidden = false; $('agents-terminal-title').textContent = node.display_title || node.role; term = window.TermView.mount($('agents-terminal-view'), options(node)); window.agentsTermView = term; termName = node.name; $('agents-terminal-switch').replaceChildren(term.switchEl); }
  $('agents-close').onclick = closeTerm;
  $('agents-full').onclick = () => panel.classList.toggle('full');
  $('agents-pop').onclick = () => { if (termName) window.open(`/wheelchair/app/terminal?name=${encodeURIComponent(termName)}`, '_blank'); closeTerm(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel.classList.contains('full')) panel.classList.remove('full'); });
  try { const h = Number(localStorage.getItem('agents-terminal-height')); if (h >= 150) panel.style.height = `${h}px`; } catch (_) {}
  $('agents-resize').onpointerdown = e => { const y = e.clientY, h = panel.getBoundingClientRect().height; e.target.setPointerCapture(e.pointerId); e.target.onpointermove = ev => { panel.style.height = `${Math.max(150, Math.min(innerHeight - 100, h + y - ev.clientY))}px`; }; e.target.onpointerup = ev => { e.target.onpointermove = null; try { localStorage.setItem('agents-terminal-height', String(parseInt(panel.style.height, 10))); } catch (_) {} }; };
  $('brief-close').onclick = () => $('brief-dialog').close();
  function go(lead, agent) { const u = new URL(location.href); u.hash = ''; if (lead) u.searchParams.set('lead', lead); else u.searchParams.delete('lead'); if (agent) u.searchParams.set('agent', agent); else u.searchParams.delete('agent'); history.pushState(null, '', u); render(); }
  window.addEventListener('popstate', render);
  function nodes(node) { return node ? [node, ...(node.children || []).flatMap(nodes)] : []; }
  function status(node) { return ({ working: 'Working', waiting: node.waiting_on?.label || 'Waiting', 'not-started': 'Not started', finished: 'Finished', idle: 'Idle', 'needs-you': 'Needs you' })[node.state] || 'Idle'; }
  function duration(node) { let start, end = Date.now(), word; if (node.state === 'finished') { start = node.created_at; end = Date.parse(node.ended_at); word = 'Ran'; } else if (node.state === 'working') { start = node.turn_started_at || node.created_at; word = 'Working for'; } else { start = node.turn_ended_at; word = 'Idle for'; } const t = Date.parse(start); if (!Number.isFinite(t) || !Number.isFinite(end)) return ''; const mins = Math.max(0, Math.floor((end - t) / 60000)); return `${word} ${mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`}`; }
  function counts(lead) { const c = lead.counts || {}; const parts = [`${c.total || 0} agents`]; for (const [k, label] of [['working','working'], ['waiting', lead.session?.state === 'needs-you' ? 'waiting on another agent or you' : 'waiting on another agent'], ['not_started','not started'], ['finished','finished'], ['idle','idle']]) if (c[k]) parts.push(`${c[k]} ${label}`); return parts.join(' · '); }
  function render() {
    const root = $('agents'), banners = $('unreachable'); root.replaceChildren(); banners.replaceChildren();
    for (const m of data.machines || []) if (!m.reachable) { const d = new Date(m.last_seen); banners.append(el('p', 'agent-unreachable', `${m.machine} unreachable, last seen ${m.last_seen && !isNaN(d) ? d.toLocaleString() : 'never'}`)); }
    const timestamps = new Map(threads.map(t => [t.id, t.collin_at || t.created_at || '']));
    const leads = [...(data.leads || [])].sort((a,b) => String(timestamps.get(b.thread_id) || '').localeCompare(String(timestamps.get(a.thread_id) || '')));
    const live = leads.filter(l => !l.finished), midnight = new Date(); midnight.setHours(0,0,0,0);
    const finished = leads.filter(l => l.finished && Date.parse(l.finished_at) >= midnight.getTime());
    let u = new URL(location.href), requested = u.searchParams.get('lead');
    if (u.hash.startsWith('#lead-')) { try { requested = decodeURIComponent(u.hash.slice(6)); } catch (_) {} u.hash = ''; if (requested) u.searchParams.set('lead', requested); history.replaceState(null, '', u); }
    let lead = [...live, ...finished].find(l => l.thread_id === requested);
    if (requested && !lead) { lead = live[0]; u.searchParams.delete('agent'); if (lead) u.searchParams.set('lead', lead.thread_id); else u.searchParams.delete('lead'); history.replaceState(null, '', u); requested = lead?.thread_id; }
    if (!lead && !requested) lead = live[0];
    const selected = lead && nodes(lead.session).find(n => n.name === u.searchParams.get('agent'));
    if (term && (!selected || selected.name !== termName)) { if (selected?.live) { term.retarget(options(selected)); termName = selected.name; $('agents-terminal-title').textContent = selected.display_title || selected.role; } else closeTerm(); }
    root.className = `agents-layout${requested ? ' has-lead' : ''}${selected ? ' has-agent' : ''}`;
    const sidebar = el('aside','agents-sidebar'); sidebar.append(el('h1','','Agents'));
    function entry(l) { const b = button('', () => go(l.thread_id), `agents-entry${lead === l ? ' selected' : ''}`); const top = el('div','agents-entry-top'); top.append(el('strong','',l.lead_name || 'Lead'), el('span','agents-tag',l.project || '')); b.append(top, el('div','agents-entry-title',l.thread_title || ''), el('div','agents-muted',`${({idea:'Idea',planning:'Planning',review:'Review',building:'Building',verifying:'Verifying',done:'Done'})[String(l.stage).toLowerCase()] || l.stage || 'Idea'} · ${l.counts?.total || 0} agents`)); if (l.session?.state === 'needs-you') b.append(el('div','agents-needs','Needs you')); return b; }
    live.forEach(l => sidebar.append(entry(l)));
    const details = el('details','agents-finished'); details.open = !folded; const summary = el('summary','',`Finished today (${finished.length})`); details.append(summary); finished.forEach(l => details.append(entry(l))); details.ontoggle = () => { folded = !details.open; }; sidebar.append(details); root.append(sidebar);
    $('empty').hidden = live.length + finished.length > 0;
    if (!lead) return;
    const main = el('section','agents-main'); main.append(button('‹ Leads', () => go(null), 'agents-back'));
    const heading = el('div','agents-heading'); heading.append(el('h2','',lead.lead_name || 'Lead'),el('span','agents-tag',lead.project || '')); main.append(heading,el('div','agents-thread',lead.thread_title || ''),el('p','agents-count',counts(lead)));
    const tree = el('div','agents-tree');
    function branch(node, aside = false) { const wrap = el('div','agents-branch'); const card = aside ? el('div','agents-box') : button('', () => go(lead.thread_id,node.name), `agents-box${selected?.name === node.name ? ' selected' : ''}`); card.classList.add(`state-${node.state || 'idle'}`); if (!aside) card.dataset.session = node.name; card.append(el('div','agents-role',aside ? 'Side conversation' : node.role || 'agent'),el('strong','agents-box-title',node.display_title || node.role || 'Agent')); const st = el('div','agents-status'); st.append(el('span','agents-dot'),document.createTextNode(status(node))); card.append(st); wrap.append(card); const children = [...(node.children || []), ...(node === lead.session ? (lead.asides || []) : [])]; if (children.length) { const list = el('div','agents-children'); children.forEach(c => list.append(branch(c,c.kind === 'aside'))); wrap.append(list); } return wrap; }
    tree.append(branch(lead.session)); main.append(tree); root.append(main);
    const side = el('aside','agents-side'); if (selected) { side.append(button(`‹ ${lead.lead_name || 'Lead'}`, () => go(lead.thread_id), 'agents-back'),el('div','agents-role',selected.role || 'agent'),el('h2','',selected.display_title || selected.role || 'Agent'),el('p','agents-muted',[selected.model,selected.effort].filter(Boolean).join(' · ')),el('p','agents-muted',lead.machine || ''),el('p','agents-muted',duration(selected)),el('p','agents-side-status',status(selected))); if (selected.live) side.append(button('Open terminal', () => openTerm(selected), 'primary')); if (selected.has_brief) side.append(button('Read its brief', async () => { try { const res = await fetch(`/wheelchair/api/sessions/${encodeURIComponent(selected.name)}/brief`); if (!res.ok) throw new Error(`HTTP ${res.status}`); $('brief-text').textContent = (await res.json()).brief; } catch (e) { $('brief-text').textContent = `Could not load brief: ${e.message}`; } $('brief-dialog').showModal(); })); } else side.append(el('p','agents-muted','Select an agent to see details.')); root.append(side);
  }
  async function refresh() { try { const [a,t] = await Promise.all([fetch('/wheelchair/api/agents'),fetch('/wheelchair/api/threads?view=list')]); if (!a.ok) throw new Error(`agents ${a.status}`); data = await a.json(); threads = t.ok ? (await t.json()).threads || [] : []; render(); $('error').hidden = true; } catch (e) { $('error').textContent = `Could not load agents: ${e.message}`; $('error').hidden = false; } }
  refresh(); setInterval(refresh,5000);
})();
