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

  const composer = document.getElementById('composer');
  function positionButton() {
    if (composer && window.innerWidth < 900) {
      button.style.bottom = Math.max(92, window.innerHeight - composer.getBoundingClientRect().top + 12) + 'px';
    } else button.style.removeProperty('bottom');
  }
  let positionFrame = 0;
  function schedulePosition() {
    if (!positionFrame) positionFrame = requestAnimationFrame(() => { positionFrame = 0; positionButton(); });
  }
  window.addEventListener('resize', schedulePosition);
  window.addEventListener('scroll', schedulePosition, true);
  const composerObserver = composer && window.ResizeObserver ? new ResizeObserver(schedulePosition) : null;
  if (composerObserver) composerObserver.observe(composer);
  const chatContainer = document.getElementById('chat');
  const chatObserver = chatContainer ? new MutationObserver(schedulePosition) : null;
  if (chatObserver) chatObserver.observe(chatContainer, { childList: true, subtree: true, characterData: true });
  schedulePosition();

  let data = null, isOpen = false, poller = null, busy = false, sig = '', pending = [], newest = '';
  const showError = (m) => { errorEl.textContent = m || ''; errorEl.hidden = !m; };

  function leadsOf(d) { return ((d && d.thread && d.thread.sessions) || []).filter((s) => s.role === 'lead'); }
  const liveLead = (d) => leadsOf(d).some((s) => s.live);
  const working = (d) => leadsOf(d).some((s) => s.live && s.ready && s.turn_ended === false);

  // The newest thing the user did not write: assistant text, context and cards.
  function newestAt(d) {
    let best = '';
    for (const i of d.items || []) if ((i.type === 'assistant' || i.type === 'context') && i.at > best) best = i.at;
    for (const c of d.cards || []) { const at = c.at || c.created_at || ''; if (at > best) best = at; }
    return best;
  }
  function newestAny(d) {
    let best = newestAt(d);
    for (const i of d.items || []) if (i.at > best) best = i.at;
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
    const humanCounts = new Map();
    for (const i of d.items || []) if (i.type === 'human') humanCounts.set(i.text, (humanCounts.get(i.text) || 0) + 1);
    pending = pending.filter((p, index) => {
      if ((humanCounts.get(p.text) || 0) <= p.seen) return true;
      for (const later of pending.slice(index + 1)) if (later.text === p.text) later.seen++;
      return false;
    });
    for (const e of entries) {
      if (e.item && e.item.type === 'human') {
        const lines = String(e.item.text || '').split('\n'); const files = [];
        if (!e.item.card) while (lines.length) { const m = /^\[attached: (.+)\]$/.exec(lines[lines.length - 1]); if (!m) { if (files.length && !lines[lines.length - 1].trim()) { lines.pop(); continue; } break; } files.unshift(m[1]); lines.pop(); }
        const bubble = el('div', 'wc-asst-human' + (e.item.card ? ' wc-asst-press' : ''), e.item.card ? e.item.text : lines.join('\n').trim());
        if (e.item.by === 'assistant') bubble.prepend(el('span', 'wc-asst-tag', 'From your assistant')); if (bubble.textContent) convo.append(bubble);
        for (const path of files) { const name = path.split('/').pop(); const label = name.replace(/^[0-9]+-/, ''); const valid = /^[0-9]+-[A-Za-z0-9._-]+$/.test(name) && !d.thread.archived;
          const link = el(valid ? 'a' : 'span', 'wc-asst-file', valid && /\.(png|jpe?g|gif|webp)$/i.test(name) ? undefined : label); if (valid) { link.href = T + '/files/' + encodeURIComponent(name); link.target = '_blank'; link.rel = 'noopener'; if (/\.(png|jpe?g|gif|webp)$/i.test(name)) { const img = el('img', 'wc-asst-image'); img.src = link.href; img.alt = label; img.loading = 'lazy'; link.append(img); } else link.setAttribute('download', label); } convo.append(link); }

      } else if (e.item && e.item.type === 'assistant') {
        const by = el('div', 'wc-asst-by'); by.append(el('span', 'wc-asst-avatar', 'A'), document.createTextNode(' Assistant'));
        const ans = el('div', 'wc-asst-answer'); md(e.item.text, ans);
        convo.append(by, ans);
      } else if (e.item && e.item.type === 'context') {
        const context = el('div', 'wc-asst-context');
        if (e.item.context === 'stub') { const details = el('details'); details.append(el('summary', '', e.item.text), el('div', '', (d.thread.title ? d.thread.title + ': ' : '') + (d.thread.context || ''))); context.append(details); }
        else context.textContent = e.item.text; convo.append(context);
      } else if (e.item && e.item.type === 'tool') {
        const tool = el('details', 'wc-asst-tool'); tool.append(el('summary', '', e.item.text), el('pre', '', e.item.detail || 'No details recorded.')); convo.append(tool);
      } else if (e.item && e.item.type === 'peer') {
        const line = el('div', 'wc-asst-context'); const link = el('a', '', e.item.title || 'another thread'); link.href = '/wheelchair/app/thread?id=' + encodeURIComponent(e.item.thread);
        line.append(document.createTextNode(e.item.limit ? 'Message limit reached with ' : 'Talked with '), link); if (!e.item.limit) line.append(document.createTextNode(' · ' + e.item.count + (e.item.count === 1 ? ' message' : ' messages'))); convo.append(line);
      } else if (e.card) convo.append(drawCard(e.card));
    }
    for (const p of pending) convo.append(el('div', 'wc-asst-human', p.text));
    if (working(d)) {
      const w = el('div', 'wc-asst-work'); w.append(el('span', 'wc-asst-spin'), document.createTextNode(' Assistant is thinking…'));
      w.setAttribute('role', 'status');
      convo.append(w);
    }
  }
  const cardErrors = {}, drafts = {}, pressing = {};
  let answerFocus = null; const answerCaret = {};
  function drawCard(card) {
    const box = el('div', 'wc-asst-card wc-asst-card-' + card.kind);
    box.dataset.card = card.id;
    const eyebrow = (t) => box.append(el('small', '', t));
    if (card.kind === 'question') {
      eyebrow(card.progress || 'Question');
      box.append(el('h3', '', card.question || ''));
      if (card.fits) box.append(el('p', '', card.fits));
      if (card.doc && data.thread.slug) { const a = el('a', '', 'Open ' + card.doc); a.href = '/wheelchair/app/doc?thread=' + encodeURIComponent(id) + '&file=' + encodeURIComponent(card.doc); box.append(a); }
      let optionIndex = 0;
      for (const o of card.options || []) {
        const b = el('button', 'wc-asst-opt'); b.type = 'button'; b.disabled = !!card.answered || !!card.retracted_at;
        const label = el('span', '', String.fromCharCode(65 + optionIndex++ % 26) + ' · ' + o.label + (o.id === card.leaning ? ' · leaning' : '')); const consequence = el('span', 'wc-asst-consequence'); window.WCMarkdown.inline(o.consequence || '', consequence); b.append(label, consequence);
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
      if (card.answered && !card.retracted_at) { const label = card.resolved_by ? 'Answered in chat' + (card.resolved_note ? ' · ' + card.resolved_note : '') : card.answered_action === 'answered' ? 'You answered: ' + card.answered_value : card.answered_value != null ? 'You picked ' + card.answered_value : 'Answered'; box.append(el('p', '', label + (card.answered_by === 'assistant' ? ' · by your assistant' : ''))); }
    } else if (card.kind === 'needs') {
      eyebrow('NEEDS YOU');
      box.append(el('h3', '', card.title || ''));
      if (card.body) { const body = el('div'); md(card.body, body); box.append(body); }
      if ((card.items || []).length) { const list = el('ul'); for (const item of card.items) list.append(el('li', '', item)); box.append(list); }
      if (card.resolved_by) box.append(el('p', '', card.resolved_note || (card.resolved_by === 'user' ? 'Dismissed' : 'Resolved')));
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
    } else if (card.kind === 'file' || card.kind === 'image') {
      box.append(el('h3', '', card.title || ''));
      const available = !data.thread.archived || (data.thread.kept_files || []).includes(card.file);
      const url = T + '/files/' + encodeURIComponent(card.file);
      if (card.kind === 'file') {
        const n = card.size; const size = !(n >= 0) ? '' : n < 1024 ? n + ' B' : n < 1000 * 1024 ? Math.round(n / 1024) + ' KB' : (n / 1024 / 1024).toFixed(1) + ' MB';
        box.append(el('p', '', [card.name || card.file, size].filter(Boolean).join(' · ')));
        if (!available) box.append(el('p', '', 'Removed when the thread was archived'));
        else {
          const name = card.name || card.file; const size = Number(card.size);
          if (/\.(md|markdown|txt|log|csv|tsv|json|ya?ml|xml|ini|toml)$/i.test(name) && Number.isFinite(size) && size >= 0 && size <= 2 * 1024 * 1024) {
            const preview = el('a', '', 'Preview'); preview.href = '/wheelchair/app/file?thread=' + encodeURIComponent(id) + '&file=' + encodeURIComponent(card.file); box.append(preview);
          }
          const download = el('a', '', 'Download'); download.href = url; download.setAttribute('download', name); box.append(download);
        }
      } else {
        if (card.mockup) box.append(el('div', '', 'Built'));
        if (!available) box.append(el('p', '', 'Image removed when the thread was archived'));
        else { const a = el('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; const img = el('img', 'wc-asst-image'); img.src = url; img.alt = card.title || ''; a.append(img); box.append(a);
          if (card.mockup) { const full = el('a', '', 'Open full size'); full.href = url; full.target = '_blank'; full.rel = 'noopener'; box.append(full); }
        }
        if (card.mockup) { box.append(el('div', '', 'Mockup')); if (!data.thread.slug) box.append(el('p', '', 'Mockup not found')); }
      }
    } else if (card.kind === 'lesson') {
      const snap = card.snapshot || {}; const verb = card.action === 'remove' ? 'Removed a lesson for ' : card.action === 'replace' ? 'Updated a lesson for ' : 'Saved a lesson for ';
      const roles = { lead: 'leads', 'sub-lead': 'sub-leads', worker: 'workers', reviewer: 'reviewers', verifier: 'verifiers', mapper: 'mappers', designer: 'designers' };
      box.append(el('p', '', verb + (roles[card.for] || card.for + 's') + ': ' + (snap.text || ''))); if (card.why) box.append(el('p', '', card.why));
      if (snap.provider) { const provider = (window.WHEELCHAIR_TOOLS || []).find((t) => t.provider === snap.provider); box.append(el('p', '', 'only on ' + (provider ? provider.label : snap.provider))); } if (snap.project) box.append(el('p', '', 'only in ' + String(snap.project).split('/').filter(Boolean).pop()));
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
    if (pressing[card.id]) return;
    pressing[card.id] = true;
    const once = card.kind === 'question';
    if (once) { card.answered = true; sig = ''; render(); }
    try { await post(T + '/cards/' + encodeURIComponent(card.id) + '/press', value === undefined ? { action } : { action, value }); delete cardErrors[card.id]; }
    catch (e) { if (once && !/already answered/.test(e.message)) card.answered = false; cardErrors[card.id] = e.message; }
    finally { delete pressing[card.id]; }
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
    const next = JSON.stringify([data.items, data.cards, working(data), pending, cardErrors, live, leadsOf(data)]);
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
        document.removeEventListener('keydown', onKeydown);
        window.removeEventListener('resize', schedulePosition);
        window.removeEventListener('scroll', schedulePosition, true);
        if (composerObserver) composerObserver.disconnect();
        if (chatObserver) chatObserver.disconnect();
        if (positionFrame) cancelAnimationFrame(positionFrame);
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
  function onKeydown(ev) { if (ev.key === 'Escape' && isOpen) shut(); }
  document.addEventListener('keydown', onKeydown);

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
      const seen = (data.items || []).filter((i) => i.type === 'human' && i.text === text).length;
      await post(T + '/messages', { text });
      input.value = ''; pending.push({ text, seen }); sig = ''; showError('');
      await poll(); render();
    } catch (e) { showError('Message not sent: ' + e.message); }
    finally { send.disabled = !(data && liveLead(data)); }
  });

  poll(); startPolling();
})();
