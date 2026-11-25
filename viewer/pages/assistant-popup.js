(function () {
  'use strict';
  // The conversation pop-up: a floating button on every app page (nav.js says which conversations
  // this page offers: the assistant, and on a project thread's page that project's lead), opening
  // one of them in a sheet (under 900px) or a side panel, with a switch when there are two. It
  // reads the same chat route and posts to the same messages, restart and card press routes as the
  // thread page, including context and card answers.
  const API = '/wheelchair/api';
  if (window.WCPopup) return;
  const OFF = { assistant: 'the assistant is off', lead: 'project leads are off' };
  const conversations = {};   // 'lead' and 'assistant': those offered on this page
  let cur = null;             // the one shown and sent to
  let picked = false;         // the user used the switch
  let gone = false;

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  // Seen state is per conversation; the thread page writes the same keys.
  function getSeen(c) { try { return localStorage.getItem('wc-seen:' + c.thread) || ''; } catch (e) { return ''; } }
  function setSeen(c, at) {
    try { if (at && at > getSeen(c)) localStorage.setItem('wc-seen:' + c.thread, at); } catch (e) { /* this page only */ }
  }
  const nameOf = (c) => (c.kind === 'lead' ? c.project.name + ' lead' : 'Assistant');
  const threadApi = (c) => API + '/threads/' + encodeURIComponent(c.thread);
  const threadUrl = (c) => '/wheelchair/app/thread?id=' + encodeURIComponent(c.thread);
  const time = (s) => { const t = Date.parse(s); return Number.isFinite(t) ? t : 0; };

  // ---- the button ----
  const button = el('button', 'wc-asst-float', '');
  button.type = 'button';
  const buttonText = el('span', 'wc-asst-label');
  button.append(buttonText);
  const dot = el('span', 'wc-asst-unread'); dot.hidden = true; button.append(dot);

  // ---- the panel ----
  const shade = el('div', 'wc-asst-shade'); shade.hidden = true;
  const panel = el('section', 'wc-asst-panel'); panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  const head = el('div', 'wc-asst-head');
  const title = el('div', 'wc-asst-title');
  const heading = el('h1'), meta = el('div', 'wc-asst-meta');
  title.append(heading, meta);
  const full = el('a', '', 'Open thread ↗');
  const close = el('button', 'wc-asst-close', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Close');
  head.append(title, full, close);
  const switcher = el('div', 'lead-switch'); switcher.hidden = true;
  switcher.setAttribute('role', 'group'); switcher.setAttribute('aria-label', 'Conversation');
  const choices = {};
  for (const kind of ['lead', 'assistant']) {
    const choice = el('button'); choice.type = 'button';
    choice.addEventListener('click', () => { picked = true; if (conversations[kind] !== cur) show(conversations[kind]); });
    choices[kind] = choice; switcher.append(choice);
  }
  const stopped = el('div', 'wc-asst-stopped'); stopped.hidden = true;
  const chat = el('div', 'wc-asst-chat');
  const convo = el('div', 'wc-asst-convo');
  chat.append(convo);
  const errorEl = el('div', 'wc-asst-error'); errorEl.hidden = true; errorEl.setAttribute('role', 'alert');
  const form = el('form', 'wc-asst-compose');
  const box = el('div', 'wc-asst-box');
  const input = el('textarea', 'wc-asst-input'); input.rows = 1;
  const send = el('button', 'wc-asst-send', '➜'); send.type = 'submit'; send.disabled = true; send.setAttribute('aria-label', 'Send');
  box.append(input, send); form.append(box);
  panel.append(head, switcher, stopped, chat, errorEl, form);
  document.body.append(button, shade, panel);

  const composer = document.getElementById('composer');
  const jump = document.getElementById('jump-bottom');
  function positionButton() {
    if (composer && window.innerWidth < 900) {
      const target = jump && !jump.hidden && jump.getClientRects().length ? jump : composer;
      button.style.bottom = Math.max(92, window.innerHeight - target.getBoundingClientRect().top + 12) + 'px';
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
  if (jump) new MutationObserver(schedulePosition).observe(jump, { attributes: true, attributeFilter: ['hidden', 'class'] });
  schedulePosition();

  let isOpen = false, poller = null, sig = '';
  // The error shows only while its conversation does; it is kept for switching back.
  function showError(c, m) {
    c.error = m || '';
    if (c !== cur) return;
    errorEl.textContent = c.error; errorEl.hidden = !c.error;
  }

  function leadsOf(d) { return ((d && d.thread && d.thread.sessions) || []).filter((s) => s.role === 'lead'); }
  const liveLead = (d) => leadsOf(d).some((s) => s.live);
  const working = (d) => leadsOf(d).some((s) => s.live && s.ready && s.turn_ended === false);

  // The newest thing the user did not write: the lead's text, context and cards.
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
    dot.hidden = !(cur.data && cur.newest && cur.newest > getSeen(cur));
    button.setAttribute('aria-label', dot.hidden ? nameOf(cur) : nameOf(cur) + ', new message');
  }

  // Everything that names the shown conversation.
  function paintChrome() {
    const name = nameOf(cur);
    const label = cur.kind === 'lead' ? 'Message the project lead' : 'Message the assistant';
    buttonText.textContent = '✦\u00a0 ' + name;
    heading.textContent = name;
    meta.textContent = 'Same conversation as your ' + (cur.kind === 'lead' ? 'project lead' : 'assistant') + ' thread';
    panel.setAttribute('aria-label', name);
    full.hidden = !cur.thread; if (cur.thread) full.href = threadUrl(cur);
    input.placeholder = label; input.setAttribute('aria-label', label);
    switcher.hidden = !(conversations.lead && conversations.assistant);
    for (const kind of ['lead', 'assistant']) {
      if (conversations[kind]) choices[kind].textContent = nameOf(conversations[kind]);
      choices[kind].setAttribute('aria-pressed', String(cur.kind === kind));
    }
    syncDot();
  }

  // Changes only which conversation is shown and sent to; each keeps its own draft.
  function show(c) {
    if (cur) cur.draft = input.value;
    cur = c; input.value = c.draft; sig = ''; convo.textContent = '';
    showError(c, c.error);
    paintChrome();
    render();
    if (isOpen) { if (c.data) { setSeen(c, newestAny(c.data)); syncDot(); } chat.scrollTop = chat.scrollHeight; }
    poll();
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
  function draw(c) {
    const d = c.data;
    convo.textContent = '';
    const entries = [];
    for (const i of d.items || []) entries.push({ at: i.at, item: i });
    for (const c of d.cards || []) entries.push({ at: c.at || c.created_at || '', card: c });
    entries.sort((a, b) => time(a.at) - time(b.at));
    const humanCounts = new Map();
    for (const i of d.items || []) if (i.type === 'human') humanCounts.set(i.text, (humanCounts.get(i.text) || 0) + 1);
    c.pending = c.pending.filter((p, index) => {
      if ((humanCounts.get(p.text) || 0) <= p.seen) return true;
      for (const later of c.pending.slice(index + 1)) if (later.text === p.text) later.seen++;
      return false;
    });
    for (const e of entries) {
      if (e.item && e.item.type === 'human') {
        const lines = String(e.item.text || '').split('\n'); const files = [];
        if (!e.item.card) while (lines.length) { const m = /^\[attached: (.+)\]$/.exec(lines[lines.length - 1]); if (!m) { if (files.length && !lines[lines.length - 1].trim()) { lines.pop(); continue; } break; } files.unshift(m[1]); lines.pop(); }
        const bubble = el('div', 'wc-asst-human' + (e.item.card ? ' wc-asst-press' : ''), e.item.card ? e.item.text : lines.join('\n').trim());
        if (e.item.by === 'assistant') bubble.prepend(el('span', 'wc-asst-tag', 'From your assistant')); if (bubble.textContent) convo.append(bubble);
        for (const path of files) { const name = path.split('/').pop(); const label = name.replace(/^[0-9]+-/, ''); const valid = /^[0-9]+-[A-Za-z0-9._-]+$/.test(name) && !d.thread.archived;
          const link = el(valid ? 'a' : 'span', 'wc-asst-file', valid && /\.(png|jpe?g|gif|webp)$/i.test(name) ? undefined : label); if (valid) { link.href = threadApi(c) + '/files/' + encodeURIComponent(name); link.target = '_blank'; link.rel = 'noopener'; if (/\.(png|jpe?g|gif|webp)$/i.test(name)) { const img = el('img', 'wc-asst-image'); img.src = link.href; img.alt = label; img.loading = 'lazy'; link.append(img); } else link.setAttribute('download', label); } convo.append(link); }

      } else if (e.item && e.item.type === 'assistant') {
        const by = el('div', 'wc-asst-by'); by.append(el('span', 'wc-asst-avatar', c.kind === 'lead' ? 'L' : 'A'), document.createTextNode(' ' + nameOf(c)));
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
      } else if (e.card) convo.append(drawCard(c, e.card));
    }
    for (const p of c.pending) convo.append(el('div', 'wc-asst-human', p.text));
    if (working(d)) {
      const w = el('div', 'wc-asst-work'); w.append(el('span', 'wc-asst-spin'), document.createTextNode(' ' + nameOf(c) + ' is thinking…'));
      w.setAttribute('role', 'status');
      convo.append(w);
    }
  }
  const cardErrors = {}, drafts = {}, pressing = {};
  let answerFocus = null; const answerCaret = {};
  function drawCard(c, card) {
    const data = c.data, T = threadApi(c);
    const box = el('div', 'wc-asst-card wc-asst-card-' + card.kind);
    box.dataset.card = card.id;
    const eyebrow = (t) => box.append(el('small', '', t));
    if (card.kind === 'question') {
      eyebrow(card.progress || 'Question');
      box.append(el('h3', '', card.question || ''));
      if (card.fits) box.append(el('p', '', card.fits));
      if (card.doc && data.thread.slug) { const a = el('a', '', 'Open ' + card.doc); a.href = '/wheelchair/app/doc?thread=' + encodeURIComponent(c.thread) + '&file=' + encodeURIComponent(card.doc); box.append(a); }
      let optionIndex = 0;
      for (const o of card.options || []) {
        const b = el('button', 'wc-asst-opt'); b.type = 'button'; b.disabled = !!card.answered || !!card.retracted_at;
        const label = el('span', '', String.fromCharCode(65 + optionIndex++ % 26) + ' · ' + o.label + (o.id === card.leaning ? ' · leaning' : '')); const consequence = el('span', 'wc-asst-consequence'); window.WCMarkdown.inline(o.consequence || '', consequence); b.append(label, consequence);
        b.addEventListener('click', () => press(c, card, 'picked', o.label));
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
        sendAnswer.addEventListener('click', () => { sendAnswer.disabled = true; press(c, card, 'answered', answer.value.trim()); });
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
          catch (e) { cardErrors[card.id] = e.message; } sig = ''; await poll(c);
        }); box.append(dismiss); }
      }
      if (!card.answered && !card.system) {
        const keep = el('button', '', 'Keep going'); keep.type = 'button'; keep.addEventListener('click', () => press(c, card, 'keep-going'));
        const talk = el('button', '', 'Talk about it'); talk.type = 'button'; talk.addEventListener('click', () => press(c, card, 'talk', card.title)); box.append(keep, talk);
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
            const preview = el('a', '', 'Preview'); preview.href = '/wheelchair/app/file?thread=' + encodeURIComponent(c.thread) + '&file=' + encodeURIComponent(card.file); box.append(preview);
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
      const p = el('p', ''), a = el('a', '', 'Open in the thread →'); a.href = threadUrl(c); p.append(a); box.append(p);
    }
    if (card.retracted_at) box.append(el('p', '', 'Withdrawn · ' + (card.retracted_note || '')));
    if (cardErrors[card.id]) box.append(el('p', 'wc-asst-error-text', 'Could not send: ' + cardErrors[card.id]));
    return box;
  }
  async function press(c, card, action, value) {
    if (pressing[card.id]) return;
    pressing[card.id] = true;
    const once = card.kind === 'question';
    if (once) { card.answered = true; sig = ''; render(); }
    try { await post(threadApi(c) + '/cards/' + encodeURIComponent(card.id) + '/press', value === undefined ? { action } : { action, value }); delete cardErrors[card.id]; }
    catch (e) { if (once && !/already answered/.test(e.message)) card.answered = false; cardErrors[card.id] = e.message; }
    finally { delete pressing[card.id]; }
    sig = ''; await poll(c);
  }

  function render() {
    const c = cur;
    stopped.textContent = '';
    if (!c.data) { stopped.hidden = true; input.disabled = false; send.disabled = true; return; }
    const live = liveLead(c.data);
    if (live) c.startError = '';
    // A project lead starts when written to, so one never started is not "stopped".
    const dead = !live && (c.kind !== 'lead' || leadsOf(c.data).length > 0 || !!c.startError);
    stopped.hidden = !dead;
    if (dead) {
      const what = el('p', '', c.kind === 'lead' ? "The project lead isn't running" : "The assistant isn't running");
      if (c.startError) what.append(el('span', 'wc-asst-start-error', 'Could not start the lead: ' + c.startError));
      stopped.append(what);
      const r = el('button', 'primary', 'Restart'); r.type = 'button';
      r.addEventListener('click', async () => {
        r.disabled = true; showError(c, '');
        try { await post(threadApi(c) + '/restart'); await poll(c); } catch (e) { showError(c, 'Restart failed: ' + e.message); r.disabled = false; }
      });
      stopped.append(r);
    }
    const canSend = c.kind === 'lead' || live;
    input.disabled = !canSend; send.disabled = !canSend || c.sending;
    const next = JSON.stringify([c.data.items, c.data.cards, working(c.data), c.pending, cardErrors, live, leadsOf(c.data)]);
    if (next === sig) return;
    sig = next;
    const near = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 80;
    draw(c);
    if (near || !isOpen) chat.scrollTop = chat.scrollHeight;
  }

  // Opening the panel on a project lead with no record makes it; that starts nothing.
  async function ensure(c) {
    if (c.ensuring) return;
    c.ensuring = true;
    try {
      const out = await post(API + '/project-leads', { machine: c.project.machine, path: c.project.path });
      c.thread = out.thread; c.ensuring = false;
      if (gone || conversations[c.kind] !== c) return;
      showError(c, '');
      if (c === cur) paintChrome();
      await poll(c);
    } catch (e) {
      c.ensuring = false;
      if (gone || conversations[c.kind] !== c) return;
      if (e.message === OFF.lead) drop(c.kind); else showError(c, 'Could not open the project lead: ' + e.message);
    }
  }

  async function poll(which) {
    const c = which && which.kind ? which : cur;
    if (gone || !c) return;
    if (!c.thread) { if (isOpen && c === cur) await ensure(c); return; }
    if (c.busy) return; c.busy = true;
    try {
      const res = await fetch(threadApi(c) + '/chat');
      const out = await res.json().catch(() => ({}));
      if (gone || conversations[c.kind] !== c) return;
      if (res.status === 404 && (out.detail || out.error) === OFF[c.kind]) { drop(c.kind); return; }
      if (!res.ok) throw new Error(out.detail || out.error || 'http ' + res.status);
      c.data = out; c.newest = newestAt(out);
      if (isOpen && c === cur) { setSeen(c, newestAny(out)); showError(c, ''); }
      if (c === cur) { syncDot(); if (isOpen) render(); }
    } catch (e) { if (isOpen && !gone) showError(c, 'Could not load the ' + (c.kind === 'lead' ? 'project lead' : 'assistant') + ': ' + e.message); }
    finally { c.busy = false; }
  }
  function startPolling() { if (poller) poller.stop(); poller = window.wcPoller(poll, isOpen ? 2000 : 10000); }

  function open() {
    isOpen = true; panel.hidden = false; button.hidden = true;
    shade.hidden = false;
    if (cur.data) { setSeen(cur, newestAny(cur.data)); syncDot(); sig = ''; render(); chat.scrollTop = chat.scrollHeight; }
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
    const c = cur;
    const draft = input.value;
    const text = draft.trim();
    if (!text || send.disabled) return;
    c.sending = true; send.disabled = true;
    try {
      const seen = (c.data.items || []).filter((i) => i.type === 'human' && i.text === text).length;
      const out = await post(threadApi(c) + '/messages', { text });
      // Queued even when the lead failed to start, so the draft goes either way.
      if (c !== cur) { if (c.draft === draft) c.draft = ''; } else if (input.value === draft) input.value = '';
      c.pending.push({ text, seen }); c.startError = out.start_error || ''; sig = ''; showError(c, '');
      await poll(c);
    } catch (e) { showError(c, 'Message not sent: ' + e.message); }
    finally { c.sending = false; if (!gone) render(); }
  });

  function destroy() {
    gone = true;
    if (poller) poller.stop();
    button.remove(); shade.remove(); panel.remove();
    document.removeEventListener('keydown', onKeydown);
    window.removeEventListener('resize', schedulePosition);
    window.removeEventListener('scroll', schedulePosition, true);
    if (composerObserver) composerObserver.disconnect();
    if (chatObserver) chatObserver.disconnect();
    if (positionFrame) cancelAnimationFrame(positionFrame);
    isOpen = false;
    window.WCPopup = null;
  }
  function drop(kind) {
    delete conversations[kind];
    const other = conversations.lead || conversations.assistant;
    if (!other) destroy(); else if (cur.kind === kind) show(other); else paintChrome();
  }

  // `offered` is nav.js's reading: { lead?: { thread, project }, assistant?: { thread } }.
  function update(offered) {
    for (const kind of ['lead', 'assistant']) {
      const next = offered[kind];
      if (!next) { delete conversations[kind]; continue; }
      const c = conversations[kind] || (conversations[kind] = { kind, thread: null, project: null, data: null, newest: '', pending: [], draft: '', error: '', startError: '', sending: false, busy: false, ensuring: false });
      c.project = next.project || null;
      if (next.thread) c.thread = next.thread;
    }
    const first = conversations.lead || conversations.assistant;
    if (!first) { destroy(); return; }
    // The project lead is the default; an open panel or the user's own pick is never switched away.
    if (!cur || conversations[cur.kind] !== cur || (cur !== first && !picked && !isOpen)) show(first);
    else paintChrome();
  }

  window.WCPopup = { update };
  update(window.__wcPopup || {});
  if (!gone) startPolling();
})();
