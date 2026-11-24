(function () {
  'use strict';
  // The assistant pop-up: a floating button on every app page (nav.js loads this only when the
  // assistant is on), opening the assistant thread's conversation in a sheet (under 900px) or a
  // side panel. It reads the same chat route and posts to the same messages, restart and card
  // press routes as the thread page. thread.js's renderer is bound to that page's DOM, so the
  // item kinds are drawn here in a simpler form; the Markdown renderer (md.js) is shared.
  const API = '/wheelchair/api';
  const SEEN_KEY = 'wc-assistant-seen';
  const status = window.__wcAssistant;
  if (!status || !status.on || !status.thread) return;
  const id = status.thread;
  const T = API + '/threads/' + encodeURIComponent(id);
  const THREAD_URL = '/wheelchair/app/thread?id=' + encodeURIComponent(id);
  if (location.pathname === '/wheelchair/app/thread' && new URLSearchParams(location.search).get('id') === id) return;

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function getSeen() { try { return localStorage.getItem(SEEN_KEY) || ''; } catch (e) { return ''; } }
  function setSeen(at) {
    try { if (at && at > getSeen()) localStorage.setItem(SEEN_KEY, at); } catch (e) { /* this page only */ }
  }
  const time = (s) => { const t = Date.parse(s); return Number.isFinite(t) ? t : 0; };

  // ---- the button ----
  const button = el('button', 'wc-asst-float', '');
  button.type = 'button';
  button.setAttribute('aria-label', 'Assistant');
  button.append(el('span', '', '✦  Assistant'));
  const dot = el('span', 'wc-asst-unread'); dot.hidden = true; button.append(dot);

  // ---- the panel ----
  const shade = el('div', 'wc-asst-shade'); shade.hidden = true;
  const panel = el('section', 'wc-asst-panel'); panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Assistant');
  const head = el('div', 'wc-asst-head');
  const title = el('div', 'wc-asst-title');
  title.append(el('h1', '', 'Assistant'), el('div', 'wc-asst-meta', 'Same conversation as your assistant thread'));
  const full = el('a', '', 'Open thread ↗'); full.href = THREAD_URL;
  const close = el('button', 'wc-asst-close', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Close');
  head.append(title, full, close);
  const stopped = el('div', 'wc-asst-stopped'); stopped.hidden = true;
  const chat = el('div', 'wc-asst-chat');
  const convo = el('div', 'wc-asst-convo');
  chat.append(convo);
  const errorEl = el('div', 'wc-asst-error'); errorEl.hidden = true; errorEl.setAttribute('role', 'alert');
  const form = el('form', 'wc-asst-compose');
  const box = el('div', 'wc-asst-box');
  const input = el('textarea', 'wc-asst-input'); input.rows = 1; input.placeholder = 'Message the assistant';
  input.setAttribute('aria-label', 'Message the assistant');
  const send = el('button', 'wc-asst-send', '➜'); send.type = 'submit'; send.setAttribute('aria-label', 'Send');
  box.append(input, send); form.append(box);
  panel.append(head, stopped, chat, errorEl, form);
  document.body.append(button, shade, panel);

  let data = null, isOpen = false, poller = null, busy = false, sig = '', pending = [], newest = '';
  const showError = (m) => { errorEl.textContent = m || ''; errorEl.hidden = !m; };

  function leadsOf(d) { return ((d && d.thread && d.thread.sessions) || []).filter((s) => s.role === 'lead'); }
  const liveLead = (d) => leadsOf(d).some((s) => s.live);
  const working = (d) => leadsOf(d).some((s) => s.live && s.ready && s.turn_ended === false);

  // The newest thing the user did not write: assistant text and cards.
  function newestAt(d) {
    let best = '';
    for (const i of d.items || []) if (i.type === 'assistant' && i.at > best) best = i.at;
    for (const c of d.cards || []) { const at = c.at || c.created_at || ''; if (at > best) best = at; }
    return best;
  }
  function newestAny(d) {
    let best = newestAt(d);
    for (const i of d.items || []) if (i.type === 'human' && i.at > best) best = i.at;
    return best;
  }
  function syncDot() {
    dot.hidden = !(data && newest && newest > getSeen());
    button.setAttribute('aria-label', dot.hidden ? 'Assistant' : 'Assistant, new message');
  }

  async function post(path, body) {
    const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.detail || out.error || 'http ' + res.status);
    return out;
  }

  // ---- drawing ----
  function md(text, into) {
    if (window.WCMarkdown) window.WCMarkdown.render(text, into); else into.textContent = text;
  }
  function draw(d) {
    convo.textContent = '';
    const entries = [];
    for (const i of d.items || []) if (i.type === 'human' || i.type === 'assistant') entries.push({ at: i.at, item: i });
    for (const c of d.cards || []) entries.push({ at: c.at || c.created_at || '', card: c });
    entries.sort((a, b) => time(a.at) - time(b.at));
    const humans = new Set((d.items || []).filter((i) => i.type === 'human').map((i) => i.text));
    pending = pending.filter((p) => !humans.has(p));
    for (const e of entries) {
      if (e.item && e.item.type === 'human') {
        if (e.item.card) continue;
        convo.append(el('div', 'wc-asst-human', e.item.text));
      } else if (e.item) {
        const by = el('div', 'wc-asst-by'); by.append(el('span', 'wc-asst-avatar', 'A'), document.createTextNode(' Assistant'));
        const ans = el('div', 'wc-asst-answer'); md(e.item.text, ans);
        convo.append(by, ans);
      } else convo.append(drawCard(e.card));
    }
    for (const p of pending) convo.append(el('div', 'wc-asst-human', p));
    if (working(d)) {
      const w = el('div', 'wc-asst-work'); w.append(el('span', 'wc-asst-spin'), document.createTextNode(' Assistant is thinking…'));
      w.setAttribute('role', 'status');
      convo.append(w);
    }
  }
  const cardErrors = {};
  function drawCard(card) {
    if (card.retracted_at || card.replaced) return document.createDocumentFragment();
    const box = el('div', 'wc-asst-card wc-asst-card-' + card.kind);
    box.dataset.card = card.id;
    const eyebrow = (t) => box.append(el('small', '', t));
    if (card.kind === 'question') {
      eyebrow(card.answered ? 'QUESTION · ANSWERED' : 'QUESTION');
      box.append(el('h3', '', card.question || ''));
      for (const o of card.options || []) {
        const b = el('button', 'wc-asst-opt', o.label); b.type = 'button'; b.disabled = !!card.answered;
        b.addEventListener('click', () => press(card, 'picked', o.label));
        box.append(b);
      }
      if (!card.answered) {
        const a = el('a', '', 'Answer in your own words →'); a.href = THREAD_URL; box.append(el('p', '')); box.lastChild.append(a);
      }
    } else if (card.kind === 'needs') {
      eyebrow('NEEDS YOU');
      box.append(el('h3', '', card.title || ''));
      if (card.body) box.append(el('p', '', card.body));
      if (!card.answered) { const p = el('p', ''), a = el('a', '', 'See it in the thread →'); a.href = THREAD_URL; p.append(a); box.append(p); }
    } else {
      eyebrow(String(card.kind || 'card').toUpperCase());
      const text = card.title || card.summary || card.body || card.note || '';
      if (text) box.append(el('h3', '', text));
      const p = el('p', ''), a = el('a', '', 'Open in the thread →'); a.href = THREAD_URL; p.append(a); box.append(p);
    }
    if (cardErrors[card.id]) box.append(el('p', 'wc-asst-error-text', 'Could not send: ' + cardErrors[card.id]));
    return box;
  }
  async function press(card, action, value) {
    try { await post(T + '/cards/' + encodeURIComponent(card.id) + '/press', { action, value }); delete cardErrors[card.id]; card.answered = true; }
    catch (e) { cardErrors[card.id] = e.message; }
    sig = ''; await poll();
  }

  function render() {
    if (!data) return;
    const live = liveLead(data);
    stopped.textContent = '';
    stopped.hidden = live;
    if (!live) {
      stopped.append(el('p', '', "The assistant isn't running"));
      const r = el('button', 'primary', 'Restart'); r.type = 'button';
      r.addEventListener('click', async () => {
        r.disabled = true; showError('');
        try { await post(T + '/restart'); await poll(); } catch (e) { showError('Restart failed: ' + e.message); r.disabled = false; }
      });
      stopped.append(r);
    }
    input.disabled = !live; send.disabled = !live;
    const next = JSON.stringify([data.items, data.cards, working(data), pending, cardErrors, live]);
    if (next === sig) return;
    sig = next;
    const near = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 80;
    draw(data);
    if (near || !isOpen) chat.scrollTop = chat.scrollHeight;
  }

  async function poll() {
    if (busy) return; busy = true;
    try {
      const res = await fetch(T + '/chat');
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.detail || out.error || 'http ' + res.status);
      data = out; newest = newestAt(out);
      if (isOpen) { setSeen(newestAny(out)); showError(''); }
      syncDot();
      if (isOpen) render();
    } catch (e) { if (isOpen) showError('Could not load the assistant: ' + e.message); }
    finally { busy = false; }
  }
  function startPolling() { if (poller) poller.stop(); poller = window.wcPoller(poll, isOpen ? 2000 : 10000); }

  function open() {
    isOpen = true; panel.hidden = false; button.hidden = true;
    shade.hidden = false;
    if (data) { setSeen(newestAny(data)); syncDot(); sig = ''; render(); chat.scrollTop = chat.scrollHeight; }
    poll(); startPolling(); input.focus();
  }
  function shut() {
    isOpen = false; panel.hidden = true; shade.hidden = true; button.hidden = false;
    startPolling(); button.focus();
  }
  button.addEventListener('click', open);
  close.addEventListener('click', shut);
  shade.addEventListener('click', shut);
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && isOpen) shut(); });

  function enterSends() {
    let v = null; try { v = localStorage.getItem('enter-sends'); } catch (e) { /* default below */ }
    if (v === '1' || v === '0') return v === '1';
    return !(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }
  input.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' || ev.shiftKey || ev.isComposing || ev.keyCode === 229 || !enterSends()) return;
    ev.preventDefault(); form.requestSubmit();
  });
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const text = input.value.trim();
    if (!text || send.disabled) return;
    send.disabled = true;
    try {
      await post(T + '/messages', { text });
      input.value = ''; pending.push(text); sig = ''; showError('');
      await poll(); render();
    } catch (e) { showError('Message not sent: ' + e.message); }
    finally { send.disabled = !(data && liveLead(data)); }
  });

  poll(); startPolling();
})();
