(function () {
  'use strict';
  // The assistant pop-up: a floating button on every app page (nav.js loads this only when the
  // assistant is on), opening the assistant thread's conversation in a sheet (under 900px) or a
  // side panel. It reads the same chat route and posts to the same messages, restart and card
  // press routes as the thread page, including context and card answers.
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
    for (const i of d.items || []) entries.push({ at: i.at, item: i });
    for (const c of d.cards || []) entries.push({ at: c.at || c.created_at || '', card: c });
    entries.sort((a, b) => time(a.at) - time(b.at));
    const humans = new Set((d.items || []).filter((i) => i.type === 'human').map((i) => i.text));
    pending = pending.filter((p) => !humans.has(p));
    for (const e of entries) {
      if (e.item && e.item.type === 'human') {
        convo.append(el('div', 'wc-asst-human' + (e.item.card ? ' wc-asst-press' : ''), e.item.text));
      } else if (e.item && e.item.type === 'assistant') {
        const by = el('div', 'wc-asst-by'); by.append(el('span', 'wc-asst-avatar', 'A'), document.createTextNode(' Assistant'));
        const ans = el('div', 'wc-asst-answer'); md(e.item.text, ans);
        convo.append(by, ans);
      } else if (e.item && e.item.type === 'context') {
        convo.append(el('div', 'wc-asst-context', e.item.text));
      } else if (e.item && e.item.type === 'tool') {
        const tool = el('details', 'wc-asst-tool'); tool.append(el('summary', '', e.item.text), el('pre', '', e.item.detail || 'No details recorded.')); convo.append(tool);
      } else if (e.item && e.item.type === 'peer') {
        const line = el('div', 'wc-asst-context'); const link = el('a', '', e.item.title || 'another thread'); link.href = '/wheelchair/app/thread?id=' + encodeURIComponent(e.item.thread);
        line.append(document.createTextNode(e.item.limit ? 'Message limit reached with ' : 'Talked with '), link); if (!e.item.limit) line.append(document.createTextNode(' · ' + e.item.count + (e.item.count === 1 ? ' message' : ' messages'))); convo.append(line);
      } else if (e.card) convo.append(drawCard(e.card));
    }
    const lead = leadsOf(d).filter((s) => s.live).pop();
    const queue = (lead && lead.queue || []).filter((q) => q.source === 'user');
    for (const p of pending) if (!queue.some((q) => q.text === p)) convo.append(el('div', 'wc-asst-human', p));
    for (const q of queue) {
      const b = el('div', 'wc-asst-human wc-asst-pending', q.text); b.append(el('span', 'wc-asst-tag', 'queued'));
      if (lead.live && lead.ready && !lead.permission_open && !lead.needs_open && !(lead.limited_until && Date.parse(lead.limited_until) > Date.now())) {
        const sendNow = el('button', '', 'Send now'); sendNow.type = 'button'; sendNow.disabled = !!sendingNow[q.at];
        sendNow.addEventListener('click', async () => { sendingNow[q.at] = true; sendNow.disabled = true; try {
          const out = await post(T + '/send-now', { at: q.at });
          if (!out.sent) throw new Error('It will go when the lead finishes its turn.');
          if (!pending.includes(q.text)) pending.push(q.text); showError('');
        } catch (e) { showError('Could not send it now: ' + e.message); } finally { delete sendingNow[q.at]; sig = ''; await poll(); } });
        b.append(sendNow);
      }
      convo.append(b);
    }
    if (working(d)) {
      const w = el('div', 'wc-asst-work'); w.append(el('span', 'wc-asst-spin'), document.createTextNode(' Assistant is thinking…'));
      w.setAttribute('role', 'status');
      convo.append(w);
    }
  }
  const cardErrors = {}, drafts = {}, sendingNow = {};
  let answerFocus = null; const answerCaret = {};
  function drawCard(card) {
    if (card.replaced) return document.createDocumentFragment();
    const box = el('div', 'wc-asst-card wc-asst-card-' + card.kind);
    box.dataset.card = card.id;
    const eyebrow = (t) => box.append(el('small', '', t));
    if (card.kind === 'question') {
      eyebrow(card.answered ? 'QUESTION · ANSWERED' : 'QUESTION');
      box.append(el('h3', '', card.question || ''));
      if (card.fits) box.append(el('p', '', card.fits));
      for (const o of card.options || []) {
        const b = el('button', 'wc-asst-opt'); b.type = 'button'; b.disabled = !!card.answered || !!card.retracted_at;
        b.append(el('span', '', o.label + (o.id === card.leaning ? ' · leaning' : '')), el('span', 'wc-asst-consequence', o.consequence || ''));
        b.addEventListener('click', () => press(card, 'picked', o.label));
        box.append(b);
      }
      if (card.why) box.append(el('p', '', 'Why the lean: ' + card.why));
      if (!card.answered && !card.retracted_at) {
        const row = el('div', 'wc-asst-own-words');
        const answer = el('textarea'); answer.placeholder = 'Or answer in your own words'; answer.setAttribute('aria-label', 'Answer in your own words');
        answer.value = drafts[card.id] || '';
        const sendAnswer = el('button', '', 'Send answer'); sendAnswer.type = 'button'; sendAnswer.disabled = !answer.value.trim();
        answer.addEventListener('input', () => { drafts[card.id] = answer.value; sendAnswer.disabled = !answer.value.trim(); });
        answer.addEventListener('focus', () => { answerFocus = card.id; });
        answer.addEventListener('blur', () => setTimeout(() => { if (answer.isConnected && answerFocus === card.id) answerFocus = null; }, 0));
        const keepCaret = () => { answerCaret[card.id] = [answer.selectionStart, answer.selectionEnd, answer.selectionDirection]; };
        for (const event of ['input', 'keyup', 'mouseup', 'select']) answer.addEventListener(event, keepCaret);
        if (answerFocus === card.id) requestAnimationFrame(() => { if (!answer.isConnected) return; answer.focus(); const [a, b, direction] = answerCaret[card.id] || [answer.value.length, answer.value.length, 'none']; answer.setSelectionRange(a, b, direction); });
        sendAnswer.addEventListener('click', () => { sendAnswer.disabled = true; press(card, 'answered', answer.value.trim()); });
        row.append(answer, sendAnswer); box.append(row);
      }
      if (card.answered) box.append(el('p', '', card.resolved_by ? 'Answered in chat' + (card.resolved_note ? ' · ' + card.resolved_note : '') : card.answered_action === 'answered' ? 'You answered: ' + card.answered_value : 'You picked ' + (card.answered_value || '')));
    } else if (card.kind === 'needs') {
      eyebrow('NEEDS YOU');
      box.append(el('h3', '', card.title || ''));
      if (card.body) box.append(el('p', '', card.body));
      if (card.system && !card.answered) {
        if (card.session) { const a = el('a', '', 'Open terminal'); a.href = '/wheelchair/app/terminal?name=' + encodeURIComponent(card.session); box.append(a); }
        if (!card.blocking || card.auto_merge) { const dismiss = el('button', '', 'Dismiss'); dismiss.type = 'button'; dismiss.addEventListener('click', async () => {
          dismiss.disabled = true; try { await post(T + '/cards/' + encodeURIComponent(card.id) + '/dismiss', {}); delete cardErrors[card.id]; }
          catch (e) { cardErrors[card.id] = e.message; } sig = ''; await poll();
        }); box.append(dismiss); }
      }
      if (!card.answered && !card.system) {
        const keep = el('button', '', 'Keep going'); keep.type = 'button'; keep.addEventListener('click', () => press(card, 'keep-going'));
        const talk = el('button', '', 'Talk about it'); talk.type = 'button'; talk.addEventListener('click', () => press(card, 'talk', card.title)); box.append(keep, talk);
      }
    } else if (card.kind === 'file') {
      box.append(el('h3', '', card.title || ''), el('p', '', card.name || card.file || ''));
      const a = el('a', '', 'Download'); a.href = T + '/files/' + encodeURIComponent(card.file); a.setAttribute('download', card.name || card.file); box.append(a);
    } else if (card.kind === 'image') {
      box.append(el('h3', '', card.title || '')); const a = el('a'); a.href = T + '/files/' + encodeURIComponent(card.file); a.target = '_blank'; a.rel = 'noopener';
      const img = el('img', 'wc-asst-image'); img.src = a.href; img.alt = card.title || ''; a.append(img); box.append(a);
    } else if (card.kind === 'lesson') {
      const snap = card.snapshot || {}; const verb = card.action === 'remove' ? 'Removed a lesson for ' : card.action === 'replace' ? 'Updated a lesson for ' : 'Saved a lesson for ';
      box.append(el('p', '', verb + (card.for || '') + 's: ' + (snap.text || ''))); if (card.why) box.append(el('p', '', card.why));
      const a = el('a', '', 'Open in Settings'); a.href = '/wheelchair/app/settings#templates/lessons/' + encodeURIComponent(card.for); box.append(a);
    } else {
      eyebrow(String(card.kind || 'card').toUpperCase());
      const text = card.title || card.summary || card.body || card.note || '';
      if (text) box.append(el('h3', '', text));
      const p = el('p', ''), a = el('a', '', 'Open in the thread →'); a.href = THREAD_URL; p.append(a); box.append(p);
    }
    if (card.retracted_at) box.append(el('p', '', 'Withdrawn · ' + (card.retracted_note || '')));
    if (cardErrors[card.id]) box.append(el('p', 'wc-asst-error-text', 'Could not send: ' + cardErrors[card.id]));
    return box;
  }
  async function press(card, action, value) {
    try { await post(T + '/cards/' + encodeURIComponent(card.id) + '/press', value === undefined ? { action } : { action, value }); delete cardErrors[card.id]; card.answered = true; }
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
    const next = JSON.stringify([data.items, data.cards, working(data), pending, cardErrors, sendingNow, live, leadsOf(data)]);
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
      if (res.status === 404 && (out.detail || out.error) === 'the assistant is off') {
        if (poller) poller.stop();
        button.remove(); shade.remove(); panel.remove();
        isOpen = false;
        return;
      }
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
