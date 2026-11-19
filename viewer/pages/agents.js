'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const button = (text, fn, cls = '') => { const b = el('button', cls, text); b.type = 'button'; b.onclick = fn; return b; };
  let data = { leads: [], machines: [] }, threads = [], term = null, termName = null, folded = true, showFinished = false, pathObserver = null, redrawPaths = null, pop = null, infoOpen = false, redrawPop = null, popKeep = null, placePopNow = null, deckNow = [];
  window.addEventListener('resize', () => redrawPaths?.());
  const panel = $('agents-terminal');
  const phone = () => matchMedia('(max-width: 899px)').matches;
  let view = null, active = new Map(), pending = false, gesture = null;
  function terminalSpace() { document.documentElement.style.setProperty('--agents-terminal-height', !panel.hidden && !panel.classList.contains('full') ? `${panel.getBoundingClientRect().height}px` : '0px'); }
  new ResizeObserver(terminalSpace).observe(panel);
  new MutationObserver(terminalSpace).observe(panel, { attributes: true, attributeFilter: ['hidden', 'class'] });
  const end = e => { if (!active.has(e.pointerId)) return; active.delete(e.pointerId); if (!active.size) { document.querySelector('.agents-tree')?.classList.remove('dragging'); const g = gesture; setTimeout(() => { if (gesture === g) gesture = null; if (pending && !active.size) { pending=false; render(); } }, 0); } };
  window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
  function treeView(tree, main, lead, content, sizer, label) {
    let zoom = view?.lead === lead ? view.zoom : 1;
    const measure = () => { sizer.style.width = `${content.offsetWidth * zoom}px`; sizer.style.height = `${content.offsetHeight * zoom}px`; content.style.transform = `scale(${zoom})`; label.textContent = `${Math.round(zoom * 100)}%`; };
    const save = () => { view = { lead, zoom, left: tree.scrollLeft, top: tree.scrollTop, mainTop: main.scrollTop }; };
    const setZoom = (next, x, y) => { const old = zoom, oldOffset = Math.max(0, (tree.clientWidth - content.offsetWidth * old) / 2); const padTop = parseFloat(getComputedStyle(tree).paddingTop) || 0; const tx = (tree.scrollLeft + x - oldOffset) / old, ty = (tree.scrollTop + y - padTop) / old; zoom = Math.max(.2, Math.min(2, next)); measure(); const offset = Math.max(0, (tree.clientWidth - content.offsetWidth * zoom) / 2); tree.scrollLeft = tx * zoom + offset - x; tree.scrollTop = ty * zoom + padTop - y; save(); };
    const full = () => { zoom = 1; measure(); tree.scrollTop = 0; const box = content.querySelector('.agents-box'); tree.scrollLeft = Math.max(0, (box.getBoundingClientRect().left - content.getBoundingClientRect().left) + box.offsetWidth / 2 - tree.clientWidth / 2); save(); };
    const fit = () => { zoom = Math.max(.2, Math.min(1, (tree.clientWidth - 16) / content.offsetWidth, (tree.clientHeight - 16) / content.offsetHeight)); measure(); tree.scrollTop = 0; tree.scrollLeft = Math.max(0, (content.offsetWidth * zoom - tree.clientWidth) / 2); save(); };
    measure();
    if (view?.lead === lead) { tree.scrollLeft = view.left; tree.scrollTop = view.top; main.scrollTop = view.mainTop; } else full();
    tree.addEventListener('scroll', save); main.addEventListener('scroll', save);
    tree.addEventListener('wheel', e => { if (phone() || !e.ctrlKey) return; e.preventDefault(); const r = tree.getBoundingClientRect(); setZoom(zoom * Math.exp(-e.deltaY * .01), e.clientX-r.left, e.clientY-r.top); }, { passive: false });
    tree.addEventListener('pointerdown', e => { if (phone() || (e.pointerType === 'mouse' && e.button !== 0)) return; active.set(e.pointerId, { x:e.clientX, y:e.clientY }); if (active.size === 1) gesture = { x:e.clientX, y:e.clientY, left:tree.scrollLeft, top:tree.scrollTop, dragged:false, pinch:false }; else if (active.size === 2) { gesture.pinch = gesture.dragged = true; const [a,b] = [...active.values()]; gesture.distance = Math.hypot(a.x-b.x,a.y-b.y); } });
    tree.addEventListener('pointermove', e => { if (!active.has(e.pointerId) || !gesture) return; active.set(e.pointerId, { x:e.clientX, y:e.clientY }); if (gesture.pinch && active.size >= 2) { const [a,b] = [...active.values()], distance = Math.hypot(a.x-b.x,a.y-b.y), r = tree.getBoundingClientRect(); if (gesture.distance) setZoom(zoom * distance / gesture.distance, (a.x+b.x)/2-r.left, (a.y+b.y)/2-r.top); gesture.distance = distance; } else if (!gesture.pinch) { const dx=e.clientX-gesture.x, dy=e.clientY-gesture.y; if (!gesture.dragged && Math.hypot(dx,dy)>5) { gesture.dragged=true; tree.setPointerCapture(e.pointerId); tree.classList.add('dragging'); } if (gesture.dragged) { tree.scrollLeft=gesture.left-dx; tree.scrollTop=gesture.top-dy; } } });
    tree.addEventListener('click', e => { if (gesture?.dragged) { e.preventDefault(); e.stopPropagation(); } }, true);
    return { step: factor => setZoom(zoom * factor, tree.clientWidth/2, tree.clientHeight/2), fit, full };
  }
  function options(node) { return { base: `/wheelchair/api/sessions/${encodeURIComponent(node.name)}`, paneField: 'pane', history: 2000, label: node.display_title || node.role, onStatus: (text) => { $('agents-terminal-status').textContent = text; } }; }
  function closeTerm() { if (term) term.destroy(); term = null; termName = null; window.agentsTermView = null; panel.hidden = true; panel.classList.remove('full'); requestAnimationFrame(() => redrawPaths?.()); }
  function openTerm(node) { closeTerm(); panel.hidden = false; $('agents-terminal-title').textContent = node.display_title || node.role; term = window.TermView.mount($('agents-terminal-view'), options(node)); window.agentsTermView = term; termName = node.name; $('agents-terminal-switch').replaceChildren(term.switchEl); requestAnimationFrame(() => redrawPaths?.()); }
  $('agents-close').onclick = closeTerm;
  $('agents-full').onclick = () => panel.classList.toggle('full');
  $('agents-pop').onclick = () => { if (termName) window.open(`/wheelchair/app/terminal?name=${encodeURIComponent(termName)}`, '_blank'); closeTerm(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel.classList.contains('full')) panel.classList.remove('full'); requestAnimationFrame(() => redrawPaths?.()); });
  try { const h = Number(localStorage.getItem('agents-terminal-height')); if (h >= 150) panel.style.height = `${h}px`; } catch (_) {}
  $('agents-resize').onpointerdown = e => { const y = e.clientY, h = panel.getBoundingClientRect().height; e.target.setPointerCapture(e.pointerId); e.target.onpointermove = ev => { panel.style.height = `${Math.max(150, Math.min(innerHeight - 100, h + y - ev.clientY))}px`; }; e.target.onpointerup = ev => { e.target.onpointermove = null; try { localStorage.setItem('agents-terminal-height', String(parseInt(panel.style.height, 10))); } catch (_) {} }; };
  $('brief-close').onclick = () => $('brief-dialog').close();
  function go(lead, agent) { pending = false; const u = new URL(location.href); u.hash = ''; if (lead) u.searchParams.set('lead', lead); else u.searchParams.delete('lead'); if (agent) u.searchParams.set('agent', agent); else u.searchParams.delete('agent'); history.pushState(null, '', u); render(); }
  window.addEventListener('popstate', render);
  window.addEventListener('scroll', e => { if (e.target?.closest?.('.deck-pop')) return; placePopNow?.(); }, true); window.addEventListener('resize', () => placePopNow?.());
  document.addEventListener('click', e => {
    const inside = sel => e.composedPath().some(n => n.matches?.(sel));
    if (pop && !inside('.deck-pop, .agents-deck')) { pop = null; redrawPop?.(); }
    if (infoOpen && !inside('.agents-info, .agents-info-btn')) { infoOpen = false; const box = document.querySelector('.agents-info'); if (box) box.hidden = true; document.querySelector('.agents-info-btn')?.setAttribute('aria-expanded', 'false'); }
  });
  document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (pop) { pop = null; redrawPop?.(); } if (infoOpen) { infoOpen = false; const box = document.querySelector('.agents-info'); if (box) box.hidden = true; document.querySelector('.agents-info-btn')?.setAttribute('aria-expanded', 'false'); } });
  function nodes(node) { return node ? [node, ...(node.children || []).flatMap(nodes)] : []; }
  function status(node) { return ({ working: 'Working', waiting: node.waiting_on?.label || 'Waiting', 'not-started': 'Not started', finished: 'Finished', idle: 'Idle', 'needs-you': 'Needs you' })[node.state] || 'Idle'; }
  function duration(node) { let start, end = Date.now(), word; if (node.state === 'finished') { start = node.created_at; end = Date.parse(node.ended_at); word = 'Ran'; } else if (node.state === 'working') { start = node.turn_started_at || node.created_at; word = 'Working for'; } else { start = node.turn_ended_at; word = 'Idle for'; } const t = Date.parse(start); if (!Number.isFinite(t) || !Number.isFinite(end)) return ''; const mins = Math.max(0, Math.floor((end - t) / 60000)); return `${word} ${mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`}`; }
  function agentCount(n) { return `${n} ${n === 1 ? 'agent' : 'agents'}`; }
  function counts(lead) { const c = lead.counts || {}; const parts = [agentCount(c.total || 0)]; for (const [k, label] of [['working','working'], ['waiting', lead.session?.state === 'needs-you' ? 'waiting on another agent or you' : 'waiting on another agent'], ['not_started','not started'], ['finished','finished'], ['idle','idle']]) if (c[k]) parts.push(`${c[k]} ${label}`); return parts.join(' · '); }
  const svgNS = 'http://www.w3.org/2000/svg';
  function roleShort(role) { const short = { lead: 'L', 'sub-lead': 'SL', worker: 'W', mapper: 'M', verifier: 'V', reviewer: 'R' }; return Object.hasOwn(short, role) ? short[role] : (typeof role === 'string' && role ? role[0].toUpperCase() : 'A'); }
  function svg(tag, attrs = {}, text) { const n = document.createElementNS(svgNS, tag); for (const [k,v] of Object.entries(attrs)) n.setAttribute(k, v); if (text !== undefined) n.textContent = text; return n; }
  function clock(at) { const d = new Date(at); return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
  function seconds(since) { const t = Date.parse(since); return Number.isFinite(t) ? Math.max(0, Math.floor((Date.now()-t)/1000)) : 0; }
  function timer(n) { return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`; }
  function questionPanel(q, lead, all, asker) {
    const box = el('div','agents-insight agents-question'); const find = name => all.find(n => n.name === name); const describe = name => name === lead.session.name ? (lead.lead_name || 'Lead') : (find(name)?.role ? `the ${find(name).role}` : name);
    box.append(el('strong','',`Asked ${describe(q.to)} at ${clock(q.asked_at)}`));
    for (let i = 0; i < (q.trail || []).length; i++) { const hop = q.trail[i]; const to = q.trail[i+1]?.who || lead.session.name; if (hop.who === asker || hop.who === lead.session.name || i === 0) continue; box.append(el('span','',`${describe(hop.who).replace(/^./, c => c.toUpperCase())} passed it to ${describe(to)}: ${hop.text}`)); }
    if (q.card_id) { box.append(el('span','',`${lead.lead_name || 'Lead'} is asking you in the thread`)); const a = el('a','','Go to the question'); a.href = `/wheelchair/app/thread?id=${encodeURIComponent(lead.thread_id)}#card-${encodeURIComponent(q.card_id)}`; box.append(a); } return box;
  }
  function activityPanel(node, lead, all) {
    const activity = node.activity || {}, counts = activity.counts || {}, current = activity.current;
    const insight = node.question ? questionPanel(node.question, lead, all, node.name) : null; const fragment = document.createDocumentFragment();
    const figure = el('figure','agents-activity'); const map = svg('svg',{viewBox:'0 0 320 275',role:'img','aria-label':'Activity map'}); const parent = all.find(n => (n.children || []).includes(node)); const starter = node === lead.session ? 'You' : (parent?.role || 'Lead').replace(/^./, c => c.toUpperCase());
    const spots = [{kind:'starter',label:starter,x:160,y:27,tx:160,ty:11,anchor:'middle'}, {kind:'files',label:'Files',x:242,y:75,tx:258,ty:71,anchor:'start'}, {kind:'shell',label:'Shell',x:242,y:170,tx:258,ty:166,anchor:'start'}, {kind:'web',label:'Web',x:160,y:217,tx:160,ty:242,anchor:'middle'}, {kind:'helpers',label:'Helpers',x:78,y:170,tx:62,ty:166,anchor:'end'}, {kind:'thinking',label:'Thinking',x:78,y:75,tx:62,ty:71,anchor:'end'}]; const max = Math.max(0,...spots.map(s => Number(counts[s.kind]) || 0));
    for (const spot of spots) { const width = 1 + (max ? 5 * (Number(counts[spot.kind]) || 0)/max : 0); map.append(svg('line',{x1:160,y1:122,x2:spot.x,y2:spot.y,'stroke-width':width,class:'activity-line','data-kind':spot.kind})); if (current?.kind === spot.kind) map.append(svg('line',{x1:160,y1:122,x2:spot.x,y2:spot.y,'stroke-width':Math.max(2,width),class:'activity-flow',style:`animation-delay:-${Date.now() % 8000}ms`})); }
    const trail = (activity.trail || []).map(k => spots.find(s => s.kind === k)).filter(Boolean); if (trail.length > 1) map.append(svg('polyline',{points:trail.map(s => `${s.x},${s.y}`).join(' '),class:'activity-trail'}));
    const ringGroup = svg('g',{class:'activity-ring-group'}), percent = node.context?.percent; ringGroup.append(svg('circle',{cx:160,cy:122,r:30,class:'activity-ring-base'})); if (typeof percent === 'number') { ringGroup.append(svg('title',{},`Memory ${Math.round(percent)}% full`)); ringGroup.append(svg('circle',{cx:160,cy:122,r:30,pathLength:100,'stroke-dasharray':`${Math.max(0,Math.min(100,percent))} 100`,transform:'rotate(-90 160 122)',class:`activity-ring ${percent >= 90 ? 'high' : percent >= 70 ? 'warn' : ''}`})); } map.append(ringGroup);
    map.append(svg('circle',{cx:160,cy:122,r:18,class:'activity-center'}),svg('text',{x:160,y:126,'text-anchor':'middle',class:'activity-center-text'},roleShort(node.role)));
    for (const spot of spots) { map.append(svg('circle',{cx:spot.x,cy:spot.y,r:10,class:`activity-spot${current?.kind === spot.kind ? ' current' : ''}`})); map.append(svg('text',{x:spot.tx,y:spot.ty,'text-anchor':spot.anchor,class:'activity-label'},spot.label)); if ((Number(counts[spot.kind]) || 0) >= 5) map.append(svg('text',{x:spot.tx,y:spot.ty+12,'text-anchor':spot.anchor,class:'activity-count'},String(counts[spot.kind]))); if (current?.kind === spot.kind) { const now = svg('text',{x:spot.tx,y:spot.ty+((Number(counts[spot.kind]) || 0)>=5 ? 24 : 12),'text-anchor':spot.anchor,class:'activity-now','data-since':current.since},`now · ${timer(seconds(current.since))}`); map.append(now); } }
    figure.append(map,el('figcaption','',`Thicker line: used more · Ring around the middle: how full its memory is${typeof percent === 'number' ? ` (${percent}%)` : ''} · Dotted line: its last few moves`)); fragment.append(figure); if (insight) fragment.append(insight); const latest = el('div','agents-latest'); latest.append(el('strong','','Latest')); if (!(activity.latest || []).length) latest.append(el('p','agents-muted','Nothing yet.')); else for (const item of activity.latest.slice(0,4)) { const row = el('div','agents-latest-row'); row.append(el('span',`latest-${item.state}`,({running:'●',done:'✓',failed:'✕'})[item.state] || ''),el('time','',clock(item.at)),el('span','',item.label)); latest.append(row); } fragment.append(latest); return fragment;
  }

  const SQUARE = n => n >= 5 ? '#d9645a' : n >= 3 ? '#e0904a' : n >= 1 ? '#d9c45a' : '#4ea87b', GREY = '#6b7280';
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const finishedAt = n => n.finished_at || n.ended_at || '';
  const roundOf = n => Number.isInteger(n.round) && n.round >= 1 ? n.round : null;
  const memberRounds = members => [...new Set(members.map(roundOf).filter(r => r !== null))].sort((a, b) => a - b);
  function square(found, cls = '') { const q = el('span', `agents-sq ${cls}`.trim()); q.style.background = found === undefined ? GREY : SQUARE(found); return q; }
  function squares(lead, rounds, size) {
    const entries = lead.rounds?.review || {}; const row = el('span', 'agents-squares'); row.setAttribute('role', 'img');
    const counted = rounds.map(r => entries[String(r)]?.found).filter(f => Number.isInteger(f));
    row.setAttribute('aria-label', counted.length >= 2 ? `${rounds.length} rounds; objections went from ${counted[0]} to ${counted[counted.length - 1]}` : `${rounds.length} rounds`);
    for (const r of rounds) row.append(square(entries[String(r)]?.found));
    return row;
  }
  function deckTitle(lead, members) {
    const newest = members[members.length - 1];
    if (newest.role === 'reviewer') { const rounds = memberRounds(members); if (rounds.length) { const clean = lead.rounds?.review?.[String(rounds[rounds.length - 1])]?.clean === true; return `Plan review · ${plural(rounds.length, 'round', 'rounds')}${clean ? ', last round clean' : ''}`; } }
    return newest.display_title || newest.role || 'Agent';
  }
  function roundText(lead, r, members) {
    const entry = lead.rounds?.review?.[String(r)]; if (!entry) return 'not counted';
    const found = Number(entry.found) || 0; let text;
    if (found === 0) text = 'no objections';
    else { const total = members.reduce((t, m) => t + (m.report?.findings || 0), 0), first = members.map(m => m.report?.first).find(Boolean); text = found === 1 && total === 1 && first ? `1 objection: ${first}` : plural(found, 'objection', 'objections'); }
    return entry.clean && found > 0 ? `${text} · round clean` : text;
  }

  function infoButton() { const b = button('?', () => { infoOpen = !infoOpen; const box = document.querySelector('.agents-info'); if (box) box.hidden = !infoOpen; b.setAttribute('aria-expanded', String(infoOpen)); }, 'agents-info-btn'); b.setAttribute('aria-label', 'How to read this tree'); b.setAttribute('aria-expanded', String(infoOpen)); return b; }
  function infoPopout() {
    const box = el('div', 'agents-info'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'How to read this tree'); box.hidden = !infoOpen;
    const head = el('div', 'agents-pop-head'); head.append(el('strong', '', 'How to read this tree'), button('✕', () => { infoOpen = false; box.hidden = true; document.querySelector('.agents-info-btn')?.setAttribute('aria-expanded', 'false'); }, 'agents-pop-close')); head.lastChild.setAttribute('aria-label', 'Close');
    const key = el('div', 'agents-key'); for (const [c, t] of [[SQUARE(5), '5+'], [SQUARE(3), '3–4'], [SQUARE(1), '1–2'], [SQUARE(0), 'none'], [GREY, 'not counted']]) { const k = el('span', 'agents-key-item'); const q = el('span', 'agents-sq'); q.style.background = c; k.append(q, t); key.append(k); }
    const example = (label, seq) => { const row = el('div', 'agents-example'); const sq = el('span', 'agents-squares'); for (const n of seq) sq.append(square(n)); row.append(el('span', '', label), sq); return row; };
    box.append(head, el('p', '', 'Stacked cards are finished agents with the same role and parent. Click one to see them all.'), el('p', '', 'Squares are rounds of review, colored by how many objections each round found:'), key, example('Settling down', [6, 6, 6, 4, 4, 2, 2, 2, 0]), example('Going in circles', [4, 6, 4, 6, 4, 6, 4, 6, 4]));
    return box;
  }
  function drawQuestionPaths(tree, paths, parentByName) {
    if (!tree.isConnected) return;
    tree.querySelector('.agents-path-overlay')?.remove();
    const overlay = svg('svg',{class:'agents-path-overlay','aria-hidden':'true'}); tree.firstElementChild.append(overlay); const base = tree.firstElementChild.getBoundingClientRect(); overlay.setAttribute('width',base.width); overlay.setAttribute('height',base.height); const drawn = new Set();
    const boxes = new Map(); for (const e of tree.querySelectorAll('[data-session]')) { boxes.set(e.dataset.session,e); for (const m of (e.dataset.members || '').split(' ')) if (m) boxes.set(m,e); }
    for (const path of paths) for (let i=0; i<path.length-1; i++) {
      const hops = []; let child = path[i];
      while (child && child !== path[i+1]) { const parent = parentByName.get(child); if (!parent) break; hops.push([child,parent]); child = parent; }
      if (child !== path[i+1]) continue;
      for (const [child,parent] of hops) { const key = `${boxes.get(child)?.dataset.session}|${boxes.get(parent)?.dataset.session}`; if (drawn.has(key)) continue; const box = boxes.get(child), parentBox = boxes.get(parent); if (!box || !parentBox || box === parentBox) continue; const a = box.getBoundingClientRect(), b = parentBox.getBoundingClientRect(); let d;
        if (matchMedia('(max-width: 899px)').matches) { const list = box.parentElement.parentElement.getBoundingClientRect(); const x = list.left-base.left; d = `M ${x} ${list.top-base.top} V ${a.bottom-base.top}`; }
        else { const x1 = a.left+a.width/2-base.left, x2 = b.left+b.width/2-base.left, y1 = a.top-base.top, y2 = b.bottom-base.top, mid = (y1+y2)/2; d = `M ${x1} ${y1} V ${mid} H ${x2} V ${y2}`; }
        overlay.append(svg('path',{d})); drawn.add(key);
      }
    }
  }
  function render() {
    pathObserver?.disconnect(); pathObserver = null; redrawPaths = null;
    const root = $('agents'), banners = $('unreachable'), oldSide = root.querySelector('.agents-side');
    // A refresh re-renders the whole page; keep the reader where they were if they are still on the same agent.
    const kept = { agent: oldSide?.dataset.agent, side: oldSide?.scrollTop || 0, page: scrollY, toggle: document.activeElement?.classList.contains('agents-finished-toggle') };
    root.replaceChildren(); banners.replaceChildren(); { const o = document.querySelector('.deck-pop'); if (o) { popKeep = { member: o.dataset.member, top: o.scrollTop }; o.remove(); } }
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
    function entry(l) { const b = button('', () => go(l.thread_id), `agents-entry${lead === l ? ' selected' : ''}`); const top = el('div','agents-entry-top'); top.append(el('strong','',l.lead_name || 'Lead'), el('span','agents-tag',l.project || '')); b.append(top, el('div','agents-entry-title',l.thread_title || ''), el('div','agents-muted',`${({idea:'Idea',planning:'Planning',review:'Review',building:'Building',verifying:'Verifying',done:'Done'})[String(l.stage).toLowerCase()] || l.stage || 'Idea'} · ${agentCount(l.counts?.total || 0)}`)); if (l.session?.state === 'needs-you') b.append(el('div','agents-needs','Needs you')); return b; }
    live.forEach(l => sidebar.append(entry(l)));
    const details = el('details','agents-finished'); details.open = !folded; const summary = el('summary','',`Finished today (${finished.length})`); details.append(summary); finished.forEach(l => details.append(entry(l))); details.ontoggle = () => { folded = !details.open; }; sidebar.append(details); root.append(sidebar);
    $('empty').hidden = live.length + finished.length > 0;
    if (!lead) return;
    const main = el('section','agents-main'); main.append(button('‹ Leads', () => go(null), 'agents-back'));
    const heading = el('div','agents-heading'); heading.append(el('h2','',lead.lead_name || 'Lead'),el('span','agents-tag',lead.project || '')); main.append(heading,el('div','agents-thread',lead.thread_title || ''),el('p','agents-count',counts(lead)));
    let toggle = null;
    // Finished agents are folded out of the tree unless asked for; one that still has a running agent under it, or is the selected one, stays.
    const kidsOf = node => [...(node.children || []), ...(node === lead.session ? (lead.asides || []) : [])];
    const keeps = node => node.state !== 'finished' || node.name === selected?.name || kidsOf(node).some(keeps);
    const hidden = nodes(lead.session).concat(lead.asides || []).filter(n => n !== lead.session && !keeps(n)).length;
    const bar = el('div','agents-finished-bar'); main.append(bar);
    if (hidden || showFinished) bar.append(toggle = button(showFinished ? 'Hide finished agents' : `Show ${hidden} finished ${hidden === 1 ? 'agent' : 'agents'}`, () => { showFinished = !showFinished; view = null; render(); document.querySelector('.agents-finished-toggle')?.focus(); }, 'agents-finished-toggle'));
    bar.append(infoButton(), infoPopout());
    // A kept agent's ancestors are kept too, so a path whose asker shows is drawn whole.
    const shown = new Set(nodes(lead.session).filter(n => n === lead.session || showFinished || keeps(n)).map(n => n.name));
    const tree = el('div','agents-tree');
    const parents = new Map(); for (const n of nodes(lead.session)) for (const c of n.children || []) parents.set(c.name, n.name); const paths = []; for (const path of lead.question_paths || []) if (Array.isArray(path)) for (let i = 0; i < path.length - 1; i++) { let ancestor = parents.get(path[i]); while (ancestor && ancestor !== path[i+1]) ancestor = parents.get(ancestor); if (ancestor && shown.has(path[0])) paths.push([path[i], path[i+1]]); } const pathNames = new Set(paths.flat()); const pathChildren = new Set(); for (const [start, end] of paths) for (let child = start; child && child !== end; child = parents.get(child)) pathChildren.add(child);
    const kidsShown = node => kidsOf(node).filter(c => showFinished || keeps(c));
    const byCreated = (a, b) => (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0);
    // Finished siblings of one role stack into a deck at the newest member's place; the deck is the parent of its members' children.
    function arrange(list) {
      if (!showFinished) return list.map(node => ({ node }));
      const deckable = n => n.state === 'finished' && n.kind !== 'aside', groups = new Map();
      for (const n of list) if (deckable(n)) groups.set(n.role, [...(groups.get(n.role) || []), n]);
      const out = [];
      for (const n of list) { const g = deckable(n) ? groups.get(n.role) : null; if (!g || g.length < 2) out.push({ node: n }); else if (n === g[g.length - 1]) out.push({ deck: true, members: g, kids: g.flatMap(m => kidsOf(m)).sort(byCreated) }); }
      return out;
    }
    const itemNames = item => item.deck ? item.members.map(m => m.name) : [item.node.name];
    function deckCard(item) {
      const members = item.members, newest = members[members.length - 1], card = button('', () => { pop = pop && members.some(m => m.name === pop.member) ? null : { member: newest.name, round: null, all: false }; redrawPop(); }, `agents-box agents-deck state-finished${members.some(m => m.name === selected?.name) ? ' selected' : ''}`);
      card.dataset.session = newest.name; card.dataset.members = members.map(m => m.name).join(' '); card.setAttribute('aria-expanded', 'false'); if (members.some(m => pathNames.has(m.name))) card.classList.add('question-path');
      const head = el('div', 'agents-deck-head'); const full = deckTitle(lead, members), title = el('strong', 'agents-box-title', full); title.title = full; card.setAttribute('aria-label', `${newest.role || 'agent'} ×${members.length}: ${full}`); head.append(el('div', 'agents-role', newest.role || 'agent'), el('span', 'agents-deck-count', `×${members.length}`)); card.append(head, title);
      if (newest.role === 'reviewer') { const rounds = memberRounds(members); if (rounds.length) card.append(squares(lead, rounds)); }
      const latest = members.map(finishedAt).filter(t => Number.isFinite(Date.parse(t))).sort((a, b) => Date.parse(b) - Date.parse(a))[0];
      const st = el('div', 'agents-status'); st.append(el('span', 'agents-dot'), document.createTextNode(latest ? `Finished ${clock(latest)}` : 'Finished')); card.append(st);
      deckNow.push({ members, card }); return card;
    }
    function branch(item) {
      const aside = !item.deck && item.node.kind === 'aside', node = item.node; const wrap = el('div', item.deck ? 'agents-branch agents-deck-branch' : 'agents-branch'); let card;
      if (item.deck) card = deckCard(item);
      else { card = aside ? el('div','agents-box') : button('', () => go(lead.thread_id,node.name), `agents-box${selected?.name === node.name ? ' selected' : ''}`); card.classList.add(`state-${node.state || 'idle'}`); if (!aside && pathNames.has(node.name)) card.classList.add('question-path'); if (!aside) card.dataset.session = node.name; card.append(el('div','agents-role',aside ? 'Side conversation' : node.role || 'agent'),el('strong','agents-box-title',node.display_title || node.role || 'Agent')); const st = el('div','agents-status'); st.append(el('span','agents-dot'),document.createTextNode(status(node))); card.append(st); }
      wrap.append(card); const children = arrange(item.deck ? item.kids : kidsShown(node)); if (children.length) { const list = el('div','agents-children'); if (children.some(c => itemNames(c).some(n => pathChildren.has(n)))) list.classList.add('question-path-line'); children.forEach(c => list.append(branch(c))); wrap.append(list); } return wrap; }
    deckNow = []; const content = branch({ node: lead.session });
    const toolbar = el('div', 'agents-toolbar'), label = el('span', 'agents-zoom');
    let controls;
    for (const [text, name, action] of [['−','Zoom out',() => controls.step(1/1.25)], ['+','Zoom in',() => controls.step(1.25)], ['Fit','Fit',() => controls.fit()], ['100%','Full size',() => controls.full()]]) { const b = button(text, action); b.setAttribute('aria-label',name); toolbar.append(b); if (name === 'Zoom out') toolbar.append(label); }
    const sizer = el('div','agents-sizer'); sizer.append(content); tree.append(sizer); main.append(toolbar,tree); if (paths.length) { main.append(el('div','agents-path-legend','Where a question went')); redrawPaths = () => drawQuestionPaths(tree, paths, parents); requestAnimationFrame(redrawPaths); pathObserver = new ResizeObserver(redrawPaths); pathObserver.observe(sizer); pathObserver.observe(main); } root.append(main);
    if (kept.toggle) toggle?.focus({ preventScroll: true });
    if (!phone()) controls = treeView(tree, main, lead.thread_id, content, sizer, label);

    redrawPop = () => {
      const old = document.querySelector('.deck-pop'), prev = old ? { member: old.dataset.member, top: old.scrollTop } : popKeep; popKeep = null; old?.remove();
      const hit = pop && deckNow.find(d => d.members.some(m => m.name === pop.member)); if (!hit) pop = null;
      for (const d of deckNow) d.card.setAttribute('aria-expanded', String(d === hit)); if (!hit) return;
      const members = hit.members, newest = members[members.length - 1], box = el('div', 'deck-pop'); box.setAttribute('role', 'dialog'); box.dataset.member = pop.member;
      const reviewer = newest.role === 'reviewer', rounds = reviewer ? memberRounds(members) : [];
      const agentRow = m => { const b = button('', () => { pop = null; go(lead.thread_id, m.name); }, 'deck-agent'); b.dataset.agent = m.name; b.append(el('span', 'deck-agent-title', m.display_title || m.role || 'Agent'), el('span', 'agents-muted', finishedAt(m) ? `Finished ${clock(finishedAt(m))}` : 'Finished')); return b; };
      const newestFirst = list => [...list].reverse(), CUT = 5;
      const head = el('div', 'agents-pop-head'); const x = button('✕', () => { pop = null; redrawPop(); }, 'agents-pop-close'); x.setAttribute('aria-label', 'Close');
      if (rounds.length) {
        box.setAttribute('aria-label', `${members.length} reviewers by round`); head.append(el('strong', '', `Plan review · ${plural(members.length, 'reviewer', 'reviewers')}`), x);
        box.append(head, el('p', 'agents-muted', 'Grouped by round, newest first. Open a round to see its reviewers.'));
        const order = newestFirst(rounds); if (pop.round !== null && pop.round !== 'other') { const at = order.indexOf(pop.round); if (at < 0) pop.round = null; else if (at >= CUT) pop.all = true; }
        const list = el('ul', 'deck-rows'); const shownRounds = pop.all ? order : order.slice(0, CUT);
        const roundRow = (key, sq, name, text, ms) => { const li = el('li', 'deck-round'); const b = button('', () => { pop.round = pop.round === key ? null : key; redrawPop(); }, 'deck-round-btn'); b.dataset.round = String(key); b.setAttribute('aria-expanded', String(pop.round === key)); b.append(sq, el('span', 'deck-round-name', name), el('span', 'deck-round-text', text), el('span', 'agents-muted', pop.round === key ? '⌄' : '›')); li.append(b); if (pop.round === key) { const inner = el('div', 'deck-agents'); newestFirst(ms).forEach(m => inner.append(agentRow(m))); li.append(inner); } return li; };
        for (const r of shownRounds) { const ms = members.filter(m => roundOf(m) === r); list.append(roundRow(r, square(lead.rounds?.review?.[String(r)]?.found), `Round ${r}`, `${plural(ms.length, 'reviewer', 'reviewers')} · ${roundText(lead, r, ms)}`, ms)); }
        const other = members.filter(m => roundOf(m) === null); if (other.length) list.append(roundRow('other', el('span', 'agents-sq none'), 'Other', plural(other.length, 'agent', 'agents'), other));
        box.append(list); if (!pop.all && order.length > CUT) box.append(button(`Show all ${order.length} rounds`, () => { pop.all = true; redrawPop(); }, 'deck-more'));
      } else {
        box.setAttribute('aria-label', `${members.length} ${newest.role || 'agent'}s`); head.append(el('strong', '', `${deckTitle(lead, members)}`), x);
        box.append(head); const order = newestFirst(members); const list = el('div', 'deck-agents'); (pop.all ? order : order.slice(0, CUT)).forEach(m => list.append(agentRow(m))); box.append(list);
        if (!pop.all && order.length > CUT) box.append(button(`Show all ${order.length} agents`, () => { pop.all = true; redrawPop(); }, 'deck-more'));
      }
      document.body.append(box); placePop(); if (prev && prev.member === pop.member && prev.top) box.scrollTop = prev.top;
    };
    const placePop = () => {
      const box = document.querySelector('.deck-pop'), hit = box && deckNow.find(d => d.members.some(m => m.name === pop?.member)); if (!hit) return;
      const r = hit.card.getBoundingClientRect(), w = Math.min(360, innerWidth - 16), M = 8, GAP = 6;
      box.style.width = `${w}px`; box.style.left = `${Math.max(M, Math.min(r.left, innerWidth - w - M))}px`;
      const saved = box.scrollTop, h = box.scrollHeight + (box.offsetHeight - box.clientHeight), below = innerHeight - M - (r.bottom + GAP), above = r.top - GAP - M;
      let top, room;
      if (h <= below) { top = r.bottom + GAP; room = below; }
      else if (h <= above) { top = r.top - GAP - h; room = above; }
      else if (below >= above) { top = r.bottom + GAP; room = below; }
      else { top = M; room = above; }
      room = Math.max(40, room); box.style.maxHeight = `${room}px`;
      if (h > room) top = below >= above ? r.bottom + GAP : r.top - GAP - room;
      box.style.top = `${Math.max(M, Math.min(top, innerHeight - M - Math.min(h, room)))}px`; box.scrollTop = saved;
    };
    placePopNow = placePop; redrawPop();
    const side = el('aside','agents-side'); if (selected) { side.append(button(`‹ ${lead.lead_name || 'Lead'}`, () => go(lead.thread_id), 'agents-back'),el('div','agents-role',selected.role || 'agent'),el('h2','',selected.display_title || selected.role || 'Agent'),el('p','agents-muted',[selected.model,selected.effort].filter(Boolean).join(' · ')),el('p','agents-muted',lead.machine || ''),el('p','agents-muted',duration(selected)),el('p','agents-side-status',status(selected))); if (selected.result_summary) side.append(el('h3','agents-report-head','Report'),el('p','agents-report',selected.result_summary)); if (selected.live) side.append(button('Open terminal', () => openTerm(selected), 'primary')); if (selected.has_brief) side.append(button('Read its brief', async () => { try { const res = await fetch(`/wheelchair/api/sessions/${encodeURIComponent(selected.name)}/brief`); if (!res.ok) throw new Error(`HTTP ${res.status}`); $('brief-text').textContent = (await res.json()).brief; } catch (e) { $('brief-text').textContent = `Could not load brief: ${e.message}`; } $('brief-dialog').showModal(); })); side.append(activityPanel(selected, lead, nodes(lead.session))); } else side.append(el('p','agents-muted','Select an agent to see details.')); root.append(side);
    if (selected) { side.dataset.agent = selected.name; if (kept.agent === selected.name) { side.scrollTop = kept.side; scrollTo(scrollX, kept.page); } }
  }
  async function refresh() { try { const [a,t] = await Promise.all([fetch('/wheelchair/api/agents'),fetch('/wheelchair/api/threads?view=list')]); if (!a.ok) throw new Error(`agents ${a.status}`); data = await a.json(); threads = t.ok ? (await t.json()).threads || [] : []; if (active.size) pending = true; else render(); $('error').hidden = true; } catch (e) { $('error').textContent = `Could not load agents: ${e.message}`; $('error').hidden = false; } }
  refresh(); setInterval(refresh,5000); setInterval(() => { for (const n of document.querySelectorAll('.activity-now')) n.textContent = `now · ${timer(seconds(n.dataset.since))}`; },1000);
})();
