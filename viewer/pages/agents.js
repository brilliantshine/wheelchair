'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const button = (text, fn, cls = '') => { const b = el('button', cls, text); b.type = 'button'; b.onclick = fn; return b; };
  let data = { leads: [], machines: [] }, threads = [], term = null, termName = null, folded = true, showFinished = false, pathObserver = null, redrawPaths = null;
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
  function nodes(node) { return node ? [node, ...(node.children || []).flatMap(nodes)] : []; }
  function status(node) { return ({ working: 'Working', waiting: node.waiting_on?.label || 'Waiting', 'not-started': 'Not started', finished: 'Finished', idle: 'Idle', 'needs-you': 'Needs you' })[node.state] || 'Idle'; }
  function duration(node) { let start, end = Date.now(), word; if (node.state === 'finished') { start = node.created_at; end = Date.parse(node.ended_at); word = 'Ran'; } else if (node.state === 'working') { start = node.turn_started_at || node.created_at; word = 'Working for'; } else { start = node.turn_ended_at; word = 'Idle for'; } const t = Date.parse(start); if (!Number.isFinite(t) || !Number.isFinite(end)) return ''; const mins = Math.max(0, Math.floor((end - t) / 60000)); return `${word} ${mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`}`; }
  function agentCount(n) { return `${n} ${n === 1 ? 'agent' : 'agents'}`; }
  function counts(lead) { const c = lead.counts || {}; const parts = [agentCount(c.total || 0)]; for (const [k, label] of [['working','working'], ['waiting', lead.session?.state === 'needs-you' ? 'waiting on another agent or you' : 'waiting on another agent'], ['not_started','not started'], ['finished','finished'], ['idle','idle']]) if (c[k]) parts.push(`${c[k]} ${label}`); return parts.join(' · '); }
  const svgNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs = {}, text) { const n = document.createElementNS(svgNS, tag); for (const [k,v] of Object.entries(attrs)) n.setAttribute(k, v); if (text !== undefined) n.textContent = text; return n; }
  function clock(at) { const d = new Date(at); return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
  function seconds(since) { const t = Date.parse(since); return Number.isFinite(t) ? Math.max(0, Math.floor((Date.now()-t)/1000)) : 0; }
  function elapsed(n) { return n >= 3600 ? `${Math.floor(n/3600)}h ${String(Math.floor(n%3600/60)).padStart(2,'0')}m` : n < 60 ? `${n}s` : `${Math.floor(n/60)}m ${String(n%60).padStart(2,'0')}s`; }
  function timer(n) { return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`; }
  function normalPanel(activity) {
    const current = activity.current; if (!current) return null;
    const n = seconds(current.since), normal = activity.normal, box = el('div','agents-insight');
    if (!normal?.samples?.length) box.append(el('strong','',`Busy for ${elapsed(n)}. Nothing earlier to compare it with.`));
    else { const long = n * 1000 > 1.5 * normal.typical_ms, minutes = Math.max(1, Math.round(normal.typical_ms / 60000)); const count = normal.samples.length, label = current.label || 'Working'; const times = count === 1 ? 'last time' : `the last ${['','one','two','three','four','five'][count] || count} times`; const typical = normal.typical_ms < 60000 ? `${Math.round(normal.typical_ms / 1000)} seconds` : `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`; box.append(el('strong','',`Quiet for ${elapsed(n)}. ${long ? 'Longer than usual.' : "That's expected."}`), el('span',long ? 'agents-long' : '',`It's ${label.charAt(0).toLowerCase()+label.slice(1)}, which took about ${typical} ${times}.`)); }
    return box;
  }
  function questionPanel(q, lead, all, asker) {
    const box = el('div','agents-insight agents-question'); const find = name => all.find(n => n.name === name); const describe = name => name === lead.session.name ? (lead.lead_name || 'Lead') : (find(name)?.role ? `the ${find(name).role}` : name);
    box.append(el('strong','',`Asked ${describe(q.to)} at ${clock(q.asked_at)}`));
    for (let i = 0; i < (q.trail || []).length; i++) { const hop = q.trail[i]; const to = q.trail[i+1]?.who || lead.session.name; if (hop.who === asker || hop.who === lead.session.name || i === 0) continue; box.append(el('span','',`${describe(hop.who).replace(/^./, c => c.toUpperCase())} passed it to ${describe(to)}: ${hop.text}`)); }
    if (q.card_id) { box.append(el('span','',`${lead.lead_name || 'Lead'} is asking you in the thread`)); const a = el('a','','Go to the question'); a.href = `/wheelchair/app/thread?id=${encodeURIComponent(lead.thread_id)}#card-${encodeURIComponent(q.card_id)}`; box.append(a); } return box;
  }
  function activityPanel(node, lead, all) {
    const activity = node.activity || {}, counts = activity.counts || {}, current = activity.current;
    const insight = node.question ? questionPanel(node.question, lead, all, node.name) : normalPanel(activity); const fragment = document.createDocumentFragment();
    const figure = el('figure','agents-activity'); const map = svg('svg',{viewBox:'0 0 320 275',role:'img','aria-label':'Activity map'}); const parent = all.find(n => (n.children || []).includes(node)); const starter = node === lead.session ? 'You' : (parent?.role || 'Lead').replace(/^./, c => c.toUpperCase());
    const spots = [{kind:'starter',label:starter,x:160,y:27,tx:160,ty:11,anchor:'middle'}, {kind:'files',label:'Files',x:242,y:75,tx:258,ty:71,anchor:'start'}, {kind:'shell',label:'Shell',x:242,y:170,tx:258,ty:166,anchor:'start'}, {kind:'web',label:'Web',x:160,y:217,tx:160,ty:242,anchor:'middle'}, {kind:'helpers',label:'Helpers',x:78,y:170,tx:62,ty:166,anchor:'end'}, {kind:'thinking',label:'Thinking',x:78,y:75,tx:62,ty:71,anchor:'end'}]; const max = Math.max(0,...spots.map(s => Number(counts[s.kind]) || 0));
    for (const spot of spots) { const width = 1 + (max ? 5 * (Number(counts[spot.kind]) || 0)/max : 0); map.append(svg('line',{x1:160,y1:122,x2:spot.x,y2:spot.y,'stroke-width':width,class:'activity-line','data-kind':spot.kind})); if (current?.kind === spot.kind) map.append(svg('line',{x1:160,y1:122,x2:spot.x,y2:spot.y,'stroke-width':Math.max(2,width),class:'activity-flow',style:`animation-delay:-${Date.now() % 8000}ms`})); }
    const trail = (activity.trail || []).map(k => spots.find(s => s.kind === k)).filter(Boolean); if (trail.length > 1) map.append(svg('polyline',{points:trail.map(s => `${s.x},${s.y}`).join(' '),class:'activity-trail'}));
    const ringGroup = svg('g',{class:'activity-ring-group'}), percent = node.context?.percent; ringGroup.append(svg('circle',{cx:160,cy:122,r:30,class:'activity-ring-base'})); if (typeof percent === 'number') { ringGroup.append(svg('title',{},`Memory ${Math.round(percent)}% full`)); ringGroup.append(svg('circle',{cx:160,cy:122,r:30,pathLength:100,'stroke-dasharray':`${Math.max(0,Math.min(100,percent))} 100`,transform:'rotate(-90 160 122)',class:`activity-ring ${percent >= 90 ? 'high' : percent >= 70 ? 'warn' : ''}`})); } map.append(ringGroup);
    map.append(svg('circle',{cx:160,cy:122,r:18,class:'activity-center'}),svg('text',{x:160,y:126,'text-anchor':'middle',class:'activity-center-text'},node.role || 'Agent'));
    for (const spot of spots) { map.append(svg('circle',{cx:spot.x,cy:spot.y,r:10,class:`activity-spot${current?.kind === spot.kind ? ' current' : ''}`})); map.append(svg('text',{x:spot.tx,y:spot.ty,'text-anchor':spot.anchor,class:'activity-label'},spot.label)); if ((Number(counts[spot.kind]) || 0) >= 5) map.append(svg('text',{x:spot.tx,y:spot.ty+12,'text-anchor':spot.anchor,class:'activity-count'},String(counts[spot.kind]))); if (current?.kind === spot.kind) { const now = svg('text',{x:spot.tx,y:spot.ty+((Number(counts[spot.kind]) || 0)>=5 ? 24 : 12),'text-anchor':spot.anchor,class:'activity-now','data-since':current.since},`now · ${timer(seconds(current.since))}`); map.append(now); } }
    figure.append(map,el('figcaption','',`Thicker line: used more · Ring around the middle: how full its memory is${typeof percent === 'number' ? ` (${percent}%)` : ''} · Dotted line: its last few moves`)); fragment.append(figure); if (insight) fragment.append(insight); const latest = el('div','agents-latest'); latest.append(el('strong','','Latest')); if (!(activity.latest || []).length) latest.append(el('p','agents-muted','Nothing yet.')); else for (const item of activity.latest.slice(0,4)) { const row = el('div','agents-latest-row'); row.append(el('span',`latest-${item.state}`,({running:'●',done:'✓',failed:'✕'})[item.state] || ''),el('time','',clock(item.at)),el('span','',item.label)); latest.append(row); } fragment.append(latest); return fragment;
  }
  function drawQuestionPaths(tree, paths, parentByName) {
    if (!tree.isConnected) return;
    tree.querySelector('.agents-path-overlay')?.remove();
    const overlay = svg('svg',{class:'agents-path-overlay','aria-hidden':'true'}); tree.firstElementChild.append(overlay); const base = tree.firstElementChild.getBoundingClientRect(); overlay.setAttribute('width',base.width); overlay.setAttribute('height',base.height); const drawn = new Set();
    const boxes = new Map([...tree.querySelectorAll('[data-session]')].map(e => [e.dataset.session,e]));
    for (const path of paths) for (let i=0; i<path.length-1; i++) {
      const hops = []; let child = path[i];
      while (child && child !== path[i+1]) { const parent = parentByName.get(child); if (!parent) break; hops.push([child,parent]); child = parent; }
      if (child !== path[i+1]) continue;
      for (const [child,parent] of hops) { const key = `${child}|${parent}`; if (drawn.has(key)) continue; const box = boxes.get(child), parentBox = boxes.get(parent); if (!box || !parentBox) continue; const a = box.getBoundingClientRect(), b = parentBox.getBoundingClientRect(); let d;
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
    const kept = { agent: oldSide?.dataset.agent, side: oldSide?.scrollTop || 0, page: scrollY };
    root.replaceChildren(); banners.replaceChildren();
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
    // Finished agents are folded out of the tree unless asked for; one that still has a running agent under it, or is the selected one, stays.
    const kidsOf = node => [...(node.children || []), ...(node === lead.session ? (lead.asides || []) : [])];
    const keeps = node => node.state !== 'finished' || node.name === selected?.name || kidsOf(node).some(keeps);
    const hidden = nodes(lead.session).concat(lead.asides || []).filter(n => n !== lead.session && !keeps(n)).length;
    if (hidden || showFinished) main.append(button(showFinished ? 'Hide finished agents' : `Show ${hidden} finished ${hidden === 1 ? 'agent' : 'agents'}`, () => { showFinished = !showFinished; render(); }, 'agents-finished-toggle'));
    const tree = el('div','agents-tree');
    const parents = new Map(); for (const n of nodes(lead.session)) for (const c of n.children || []) parents.set(c.name, n.name); const paths = []; for (const path of lead.question_paths || []) if (Array.isArray(path)) for (let i = 0; i < path.length - 1; i++) { let ancestor = parents.get(path[i]); while (ancestor && ancestor !== path[i+1]) ancestor = parents.get(ancestor); if (ancestor) paths.push([path[i], path[i+1]]); } const pathNames = new Set(paths.flat()); const pathChildren = new Set(); for (const [start, end] of paths) for (let child = start; child && child !== end; child = parents.get(child)) pathChildren.add(child);
    function branch(node, aside = false) { const wrap = el('div','agents-branch'); const card = aside ? el('div','agents-box') : button('', () => go(lead.thread_id,node.name), `agents-box${selected?.name === node.name ? ' selected' : ''}`); card.classList.add(`state-${node.state || 'idle'}`); if (!aside && pathNames.has(node.name)) card.classList.add('question-path'); if (!aside) card.dataset.session = node.name; card.append(el('div','agents-role',aside ? 'Side conversation' : node.role || 'agent'),el('strong','agents-box-title',node.display_title || node.role || 'Agent')); const st = el('div','agents-status'); st.append(el('span','agents-dot'),document.createTextNode(status(node))); card.append(st); wrap.append(card); const children = kidsOf(node).filter(c => showFinished || keeps(c)); if (children.length) { const list = el('div','agents-children'); if (children.some(c => pathChildren.has(c.name))) list.classList.add('question-path-line'); children.forEach(c => list.append(branch(c,c.kind === 'aside'))); wrap.append(list); } return wrap; }
    const content = branch(lead.session);
    const toolbar = el('div', 'agents-toolbar'), label = el('span', 'agents-zoom');
    let controls;
    for (const [text, name, action] of [['−','Zoom out',() => controls.step(1/1.25)], ['+','Zoom in',() => controls.step(1.25)], ['Fit','Fit',() => controls.fit()], ['100%','Full size',() => controls.full()]]) { const b = button(text, action); b.setAttribute('aria-label',name); toolbar.append(b); if (name === 'Zoom out') toolbar.append(label); }
    const sizer = el('div','agents-sizer'); sizer.append(content); tree.append(sizer); main.append(toolbar,tree); if (paths.length) { main.append(el('div','agents-path-legend','Where a question went')); redrawPaths = () => drawQuestionPaths(tree, paths, parents); requestAnimationFrame(redrawPaths); pathObserver = new ResizeObserver(redrawPaths); pathObserver.observe(sizer); pathObserver.observe(main); } root.append(main);
    if (!phone()) controls = treeView(tree, main, lead.thread_id, content, sizer, label);
    const side = el('aside','agents-side'); if (selected) { side.append(button(`‹ ${lead.lead_name || 'Lead'}`, () => go(lead.thread_id), 'agents-back'),el('div','agents-role',selected.role || 'agent'),el('h2','',selected.display_title || selected.role || 'Agent'),el('p','agents-muted',[selected.model,selected.effort].filter(Boolean).join(' · ')),el('p','agents-muted',lead.machine || ''),el('p','agents-muted',duration(selected)),el('p','agents-side-status',status(selected))); if (selected.result_summary) side.append(el('h3','agents-report-head','Report'),el('p','agents-report',selected.result_summary)); if (selected.live) side.append(button('Open terminal', () => openTerm(selected), 'primary')); if (selected.has_brief) side.append(button('Read its brief', async () => { try { const res = await fetch(`/wheelchair/api/sessions/${encodeURIComponent(selected.name)}/brief`); if (!res.ok) throw new Error(`HTTP ${res.status}`); $('brief-text').textContent = (await res.json()).brief; } catch (e) { $('brief-text').textContent = `Could not load brief: ${e.message}`; } $('brief-dialog').showModal(); })); side.append(activityPanel(selected, lead, nodes(lead.session))); } else side.append(el('p','agents-muted','Select an agent to see details.')); root.append(side);
    if (selected) { side.dataset.agent = selected.name; if (kept.agent === selected.name) { side.scrollTop = kept.side; scrollTo(scrollX, kept.page); } }
  }
  async function refresh() { try { const [a,t] = await Promise.all([fetch('/wheelchair/api/agents'),fetch('/wheelchair/api/threads?view=list')]); if (!a.ok) throw new Error(`agents ${a.status}`); data = await a.json(); threads = t.ok ? (await t.json()).threads || [] : []; if (active.size) pending = true; else render(); $('error').hidden = true; } catch (e) { $('error').textContent = `Could not load agents: ${e.message}`; $('error').hidden = false; } }
  refresh(); setInterval(refresh,5000); setInterval(() => { for (const n of document.querySelectorAll('.activity-now')) n.textContent = `now · ${timer(seconds(n.dataset.since))}`; },1000);
})();
