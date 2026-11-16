(function () {
  'use strict';
  const T = '/wheelchair/api/threads/' + encodeURIComponent(new URLSearchParams(location.search).get('id') || '');
  const panel = document.getElementById('aside-panel');
  const files = document.getElementById('files');
  const bar = document.createElement('div'); bar.className = 'aside-selection'; bar.hidden = true; document.body.appendChild(bar);
  let data, current = null, timer = null, selection = null, listOpen = false, notice = '', heavyBlocked = false, summaryAfter = null, draft = null, marksSig = '';
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const button = (text, cls, fn, disabled) => { const b = el('button', cls, text); b.type = 'button'; b.disabled = !!disabled; b.addEventListener('click', fn); return b; };
  async function request(path, body) {
    const res = await fetch(T + path, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const out = await res.json().catch(() => ({})); if (!res.ok) throw new Error(out.detail || out.error || 'http ' + res.status); return out;
  }
  const path = () => '/asides/' + encodeURIComponent(current.id);
  function waiting() { return (data.cards || []).find(c => ['question', 'needs', 'approval'].includes(c.kind) && !c.answered); }
  function closePanel(scroll) {
    const card = scroll && waiting(); current = null; clearInterval(timer); timer = null; panel.hidden = true; document.body.classList.remove('aside-open');
    files.hidden = !files.children.length; draft = null; summaryAfter = null; notice = ''; heavyBlocked = false;
    if (card) document.getElementById('card-' + card.id)?.scrollIntoView({ block: 'center' });
  }
  async function refresh() {
    if (!current || !current.id) return;
    const id = current.id;
    try { const next = await request('/asides/' + encodeURIComponent(id)); if (!current || current.id !== id) return;
      if (summaryAfter !== null) { const controls = (next.history || []).filter(h => h.kind === 'control'); if (controls.length > summaryAfter) { draft = controls[controls.length - 1].reply || ''; summaryAfter = null; } }
      if (JSON.stringify(next) !== JSON.stringify(current)) { current = next; renderPanel(); }
    } catch (e) { notice = e.message; renderPanel(); }
  }
  function openAside(a, focusInput = false) { current = a; notice = ''; heavyBlocked = false; draft = null; summaryAfter = null; listOpen = false; panel.hidden = false; files.hidden = true; document.body.classList.add('aside-open'); renderPanel(); if (focusInput) panel.querySelector('.aside-input')?.focus(); clearInterval(timer); if (a.id) { refresh(); timer = setInterval(refresh, 2000); } renderChip(); }
  async function create(anchor, action) {
    bar.hidden = true; window.getSelection()?.removeAllRanges();
    openAside({ anchor, action, history: [], status: 'open' }, action === 'ask');
    try { const a = await request('/asides', { ...anchor, action }); openAside(a, action === 'ask'); }
    catch (e) { notice = e.message; renderPanel(); }
  }
  async function act(suffix, body, after) { try { await request(path() + suffix, body); notice = ''; if (after) after(); else await refresh(); } catch (e) { notice = e.message; if (suffix === '/think-harder') heavyBlocked = true; renderPanel(); } }
  function renderPanel() {
    if (!current) return;
    const oldInput = panel.querySelector('.aside-input'); const oldValue = oldInput ? oldInput.value : '';
    const oldDraft = panel.querySelector('.aside-draft textarea');
    const focused = document.activeElement === oldInput ? 'input' : document.activeElement === oldDraft ? 'draft' : null;
    const selectionStart = focused ? document.activeElement.selectionStart : null, selectionEnd = focused ? document.activeElement.selectionEnd : null;
    panel.textContent = '';
    const top = el('div', 'aside-top'); const title = el('div', 'aside-title'); title.append(el('h2', '', 'Aside' + (current.number ? ' ' + current.number : '')), el('span', 'dim', "Doesn't change the main thread"));
    top.append(title, button('Back', 'small aside-back', () => closePanel(false)), button('×', 'small aside-close', () => closePanel(false))); top.lastChild.setAttribute('aria-label', 'Close aside'); panel.appendChild(top);
    const card = waiting();
    if (card) { const label = card.kind === 'approval' ? 'Start building' : (card.question || card.title || ''); const link = el('a', 'aside-wait', 'Waiting on: ' + (label.length > 60 ? label.slice(0, 57) + '…' : label)); link.href = '#card-' + card.id; link.addEventListener('click', e => { e.preventDefault(); closePanel(true); }); panel.appendChild(link); }
    else { const leads = (data.thread.sessions || []).filter(s => s.role === 'lead'); panel.appendChild(el('div', 'aside-wait dim', leads.length && leads[leads.length - 1].turn_ended === false ? 'The lead is working' : 'Nothing is waiting on you')); }
    const body = el('div', 'aside-body'); body.appendChild(el('blockquote', 'aside-quote', current.anchor?.quote || ''));
    for (const h of current.history || []) {
      if (h.kind === 'control') continue;
      if (h.kind === 'note') { body.appendChild(el('div', 'dim', h.text || '')); continue; }
      if (h.text) body.appendChild(el('div', 'bubble human aside-human', h.text));
      if (h.reply) { const reply = el('div', 'md aside-reply'); window.WCMarkdown.render(h.reply, reply); body.appendChild(reply); }
      if (h.graph) { const src = '/wheelchair/?path=' + encodeURIComponent(h.graph); const link = el('a', 'btn small', 'Open full screen'); link.href = src; link.target = '_blank'; link.rel = 'noopener'; body.appendChild(link); const frame = el('iframe', 'diagram'); frame.src = src; frame.title = 'Aside diagram'; body.appendChild(frame); }
      if (h.graph_error) body.appendChild(el('div', 'dim', h.graph_error));
    }
    if (current.turn) body.appendChild(el('div', 'dim', 'Thinking…'));
    if (current.failed) { body.appendChild(el('div', 'dim', typeof current.failed === 'string' ? current.failed : (current.failed.message || current.failed.error || 'The aside failed'))); body.appendChild(button('Retry', 'small', () => act('/retry', {}))); }
    if (notice) body.appendChild(el('div', 'card-error', notice));
    if (draft !== null) { const box = el('div', 'aside-draft'); const area = el('textarea'); area.value = draft; area.setAttribute('aria-label', 'Your changed answer'); area.addEventListener('input', () => { draft = area.value; }); box.append(area, button('Send', 'primary small', () => act('/close', { outcome: 'changed', line: area.value }, () => closePanel(false))), button('Cancel', 'small', () => { draft = null; renderPanel(); })); body.appendChild(box); }
    panel.appendChild(body);
    const footer = el('div', 'aside-footer'); const actions = el('div', 'aside-actions'); const archived = data.thread.archived;
    const enabled = current.id && current.status === 'open' && !current.turn && !current.failed && !archived;
    const destination = card ? ({ question: 'your question', needs: 'the blocker', approval: 'Start building' }[card.kind]) : 'the thread';
    actions.append(button('Done, back to ' + destination, 'primary small', () => act('/close', { outcome: 'done' }, () => closePanel(true)), !current.id || current.status !== 'open' || archived), button('This changes my answer', 'small', () => { summaryAfter = (current.history || []).filter(h => h.kind === 'control').length; act('/summary', {}); }, !enabled || !current.cli_id || summaryAfter !== null), button('Think harder', 'small', () => act('/think-harder', {}), !enabled || current.slot !== 'standard' || heavyBlocked || current.heavy_usable !== true || !(current.history || []).some(h => h.kind === 'start' || h.kind === 'ask'))); footer.appendChild(actions);
    const form = el('form', 'aside-form'); const input = el('textarea', 'aside-input'); input.placeholder = 'Ask more about this'; input.setAttribute('aria-label', 'Ask more about this'); input.value = oldValue; input.disabled = (!current.id && current.action !== 'ask') || archived; const send = el('button', 'primary small', 'Send'); send.type = 'submit'; send.disabled = !current.id || archived; form.append(input, send); form.addEventListener('submit', e => { e.preventDefault(); const text = input.value.trim(); if (text) act('/messages', { text }, () => { input.value = ''; refresh(); }); }); footer.append(form, el('span', 'dim', 'Closed asides stay on the underlined words, so you can reopen them later.')); panel.appendChild(footer); if (focused) { const target = focused === 'input' ? input : panel.querySelector('.aside-draft textarea'); if (target) { target.focus(); target.setSelectionRange(selectionStart, selectionEnd); } }
  }
  function renderChip() {
    const head = document.getElementById('head'); head.querySelector('.aside-chip-wrap')?.remove(); const asides = data.asides || []; if (!asides.length) return;
    const wrap = el('div', 'aside-chip-wrap'); wrap.appendChild(button(asides.length + ' asides' + (asides.some(a => a.status === 'open') ? ' open' : ''), 'small aside-chip', () => { listOpen = !listOpen; renderChip(); }));
    if (listOpen) { const list = el('div', 'aside-list'); for (const a of asides) { const label = 'Aside ' + a.number + ' · ' + (a.anchor.quote.length > 60 ? a.anchor.quote.slice(0, 57) + '…' : a.anchor.quote) + ' · ' + new Date(a.created_at).toLocaleString() + ' · ' + (a.status === 'open' ? 'Open' : a.outcome === 'changed' ? 'Changed my answer' : 'Done'); list.appendChild(button(label, 'aside-list-item', () => openAside(a))); } wrap.appendChild(list); } head.appendChild(wrap);
  }
  function markRange(bubble, start, end, id) {
    const walker = document.createTreeWalker(bubble, NodeFilter.SHOW_TEXT); const nodes = []; let pos = 0, n;
    while ((n = walker.nextNode())) { const from = Math.max(0, start - pos), to = Math.min(n.length, end - pos); if (from < to) nodes.push([n, from, to]); pos += n.length; }
    for (const [node, from, to] of nodes.reverse()) { const range = document.createRange(); range.setStart(node, from); range.setEnd(node, to); const mark = el('mark', 'aside-mark'); mark.dataset.aside = id; range.surroundContents(mark); }
  }
  function decorate() {
    document.querySelectorAll('#chat .aside-mark').forEach(m => m.replaceWith(...m.childNodes));
    document.querySelectorAll('#chat .lead-aside-head').forEach(n => n.remove());
    for (const bubble of document.querySelectorAll('#chat .bubble.assistant[data-message-id]')) { const head = el('span', 'lead-aside-head'); const shadow = head.attachShadow({ mode: 'open' }); const style = el('style'); style.textContent = ':host{position:absolute;right:0;top:0} button{font:inherit;font-size:11px;color:var(--ink-2);background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:4px 8px;cursor:pointer}'; shadow.append(style, button('Ask about this message', '', () => create({ message_id: bubble.dataset.messageId, start: 0, end: bubble.textContent.length, quote: bubble.textContent }, 'ask'))); bubble.prepend(head); }
    for (const a of data.asides || []) { const anchor = a.anchor; const bubble = Array.from(document.querySelectorAll('#chat .bubble.assistant[data-message-id]')).find(b => b.dataset.messageId === anchor.message_id); if (!bubble || !anchor.quote) continue; const text = bubble.textContent; let start = text.slice(anchor.start, anchor.end) === anchor.quote ? anchor.start : text.indexOf(anchor.quote); if (start >= 0) markRange(bubble, start, start + anchor.quote.length, a.id); }
    for (const bubble of document.querySelectorAll('#chat .bubble.human:not(.card)')) { if (bubble.querySelector('.aside-handoff')) continue; const match = bubble.textContent.match(/\(from aside (\d+) on: [\s\S]*\)$/); if (!match) continue; const a = (data.asides || []).find(x => x.number === Number(match[1])); if (!a) continue; const text = bubble.textContent; bubble.textContent = text.slice(0, match.index); const link = el('a', 'aside-handoff', match[0]); link.href = '#aside-' + a.number; link.addEventListener('click', e => { e.preventDefault(); openAside(a); }); bubble.appendChild(link); }
  }
  document.getElementById('chat').addEventListener('click', e => { const mark = e.target.closest('.aside-mark'); if (mark) { const a = (data.asides || []).find(x => x.id === mark.dataset.aside); if (a) openAside(a); } });
  function selected() {
    const s = window.getSelection(); if (!s || s.isCollapsed || !s.rangeCount) { bar.hidden = true; return; }
    const bubbleOf = n => (n.nodeType === 1 ? n : n.parentElement)?.closest('.bubble.assistant[data-message-id]'); const b = bubbleOf(s.anchorNode); if (!b || b !== bubbleOf(s.focusNode)) { bar.hidden = true; return; }
    const range = s.getRangeAt(0); const before = document.createRange(); before.selectNodeContents(b); before.setEnd(range.startContainer, range.startOffset); const start = before.toString().length; const quote = range.toString(); selection = { message_id: b.dataset.messageId, start, end: start + quote.length, quote }; bar.hidden = !quote;
    if (matchMedia('(pointer: fine)').matches) { const rect = range.getBoundingClientRect(); bar.style.position = 'absolute'; bar.style.left = Math.max(0, rect.left + scrollX) + 'px'; bar.style.top = Math.max(0, rect.top + scrollY - bar.offsetHeight - 6) + 'px'; } else { bar.style.position = 'fixed'; bar.style.left = '12px'; bar.style.top = 'auto'; bar.style.bottom = (document.getElementById('composer').offsetHeight + 8) + 'px'; }
  }
  for (const [label, action] of [['Ask about this', 'ask'], ['Say it simpler', 'simpler'], ['Draw it', 'draw']]) { const b = button(label, 'small', () => { if (selection) create(selection, action); }); b.addEventListener('mousedown', e => e.preventDefault()); bar.appendChild(b); }
  for (const event of ['selectionchange', 'mouseup', 'touchend']) document.addEventListener(event, selected);
  function panelChatSig(value) { if (!value) return ''; const card = (value.cards || []).find(c => ['question', 'needs', 'approval'].includes(c.kind) && !c.answered); const leads = (value.thread.sessions || []).filter(s => s.role === 'lead'); return JSON.stringify([card && [card.id, card.kind, card.question, card.title, card.answered], leads.at(-1)?.turn_ended, value.thread.archived]); }
  window.WCAside = { update(next, rebuilt) { const panelChanged = panelChatSig(data) !== panelChatSig(next); data = next; const sig = JSON.stringify(data.asides || []); if (rebuilt || sig !== marksSig) { decorate(); marksSig = sig; } renderChip(); if (current) { files.hidden = true; if (panelChanged) renderPanel(); } } };
})();
