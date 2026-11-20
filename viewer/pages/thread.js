(function () {
  'use strict';
  const PROVIDER_LABEL = { claude: 'Claude', gpt: 'GPT', gemini: 'Antigravity', kimi: 'Kimi Code' };
  const API = '/wheelchair/api';
  const id = new URLSearchParams(location.search).get('id') || '';
  const T = API + '/threads/' + encodeURIComponent(id);
  const POLL_MS = 2000;
  const PINNED_KINDS = ['offer', 'idea', 'deferred', 'approval', 'progress'];
  // The offer's buttons press these fixed values; one map renders the buttons and marks the picked one.
  const OFFER_CHOICES = [
    ['take it into planning', 'Take it into planning', 'primary small'],
    ['keep talking first', 'Keep talking first', 'small'],
  ];

  const $ = (x) => document.getElementById(x);
  const errorEl = $('error'); const headEl = $('head'); const stubEl = $('stub-open');
  const deadEl = $('dead'); const pinnedEl = $('pinned'); const waitEl = $('lead-wait');
  const filesEl = $('files'); const headFilesEl = $('head-files'); const chatEl = $('chat'); const queuedNote = $('queued-note');
  const msgEl = $('msg'); const sendBtn = $('send');

  let data = null;
  let seenCutoff;            // the import cutoff the chat last drew with (undefined before the first draw)
  let pending = [];          // messages posted but not yet seen in the transcript
  let sigs = {};
  let ideaOpen = false;
  let deferredOpen = false;
  // Whether the pinned strip is folded to one line. A per-viewer convenience, so it lives in
  // this browser only; storage that throws (private window, blocked site data) just means open.
  const PINS_KEY = 'wheelchair.pinsFolded';
  let pinsFolded = false;
  try { pinsFolded = localStorage.getItem(PINS_KEY) === '1'; } catch (e) { /* stays open */ }
  let archiveAsk = false;
  let exportAsk = false;
  let handoffState = null;
  let handoffKey = null;
  const mergedArchiveAsk = {};
  let accountNames = null;   // account id -> name, from /settings; null until fetched
  const cardErrors = {};
  const sendingNow = {};     // queued message `at` -> true while its Send now call runs
  const declining = {};      // card id -> true while a sudo Decline call is pending
  const formCache = new Map();
  let attachments = [];
  let uploading = false;
  let answerFocus = null;    // card id whose own-words box has focus
  const answerDrafts = {};
  const answerCaret = {};    // card id -> [selectionStart, selectionEnd, selectionDirection] in that box    // card id -> text typed into a question card's own-words box

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function button(label, cls, onclick, disabled) {
    const b = el('button', cls || '', label);
    b.type = 'button';
    if (disabled) b.disabled = true;
    if (onclick) b.addEventListener('click', onclick);
    return b;
  }
  const SVG = 'http://www.w3.org/2000/svg';
  // A fixed-path line icon, built as nodes.
  function icon(d, size) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('width', String(size || 14)); svg.setAttribute('height', String(size || 14));
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2.2');
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    for (const part of d.split('|')) {
      const p = document.createElementNS(SVG, 'path'); p.setAttribute('d', part); svg.appendChild(p);
    }
    return svg;
  }
  const ICON = {
    check: 'M5 12.5l4.5 4.5L19 7.5',
    pin: 'M9 4h6l-1 6 3 3H7l3-3-1-6z|M12 13v7',
    pr: 'M6 3v12|M18 9v12|M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M15 6h-3a3 3 0 0 0-3 3',
  };
  // Markdown into a container, the lead's text and card body text alike.
  function prose(cls, text) {
    const n = el('div', 'md ' + (cls || ''));
    window.WCMarkdown.render(text, n);
    return n;
  }
  function base(p) { return String(p || '').split('/').filter(Boolean).pop() || String(p || ''); }
  function showError(msg) { errorEl.hidden = !msg; errorEl.textContent = msg || ''; }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u)) ? String(u) : '#'; }

  async function post(path, body) {
    const res = await fetch(path, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.detail || out.error || 'http ' + res.status);
    return out;
  }

  function sync(key, value, fn) {
    const sig = JSON.stringify(value);
    if (sigs[key] === sig) return;
    sigs[key] = sig;
    fn();
  }

  // ---- derived thread facts ----
  function thread() { return data.thread; }
  function slug() {
    const t = thread();
    if (data.slug || t.slug) return data.slug || t.slug;
    const d = data.cards.find((c) => c.kind === 'diagram');
    return d ? d.plan : '';
  }
  function planDir() {
    const t = thread(); const s = slug();
    return t.worktree && s ? t.worktree + '/docs/plans/' + s : '';
  }
  function leads() { return thread().sessions.filter((s) => s.role === 'lead'); }
  function frozen() { return !!(thread().handed_off || thread().handoff_op); }
  function liveLead() { return leads().some((s) => s.live); }
  // Mid-turn: a delivered message the lead has not finished answering.
  function leadWorking() { return leads().some((s) => s.live && s.ready && s.turn_ended === false); }

  // ---- head ----
  function leadSession() {
    const all = leads();
    return all.find((x) => x.live) || all[all.length - 1] || null;
  }
  function renderHead() {
    const t = thread();
    const lead = leadSession();
    headEl.textContent = '';
    const back = el('a', 'back', '\u2039');
    back.href = '/wheelchair/app/threads'; back.setAttribute('aria-label', 'Back to threads');
    headEl.appendChild(back);
    const block = el('div', 'title-block');
    const titleLine = el('div', 'thread-title-line');
    titleLine.appendChild(el('h1', '', t.title || slug() || base(t.project)));
    if (t.lead_name) {
      const newest = leads().reduce((a, b) => !a || (b.created_at || '') > (a.created_at || '') ? b : a, null);
      const chip = el(newest && newest.live ? 'a' : 'span', 'lead-chip', t.lead_name);
      if (newest && newest.live) chip.href = '/wheelchair/app/agents?lead=' + encodeURIComponent(id);
      titleLine.appendChild(chip);
    }
    block.appendChild(titleLine);
    const where = slug() ? base(t.project) + ' / ' + slug() : base(t.project);
    block.appendChild(el('div', 'meta', [
      where, lead ? 'lead' : '', PROVIDER_LABEL[t.provider] || t.cli, lead && lead.model, t.machine, lead && 'tmux ' + lead.name,
    ].filter(Boolean).join(' \u00b7 ')));
    headEl.appendChild(block);

    const line = el('div', 'head-actions' + (archiveAsk ? ' asking' : ''));
    if (t.stub && !t.sessions.length) line.appendChild(el('span', 'badge', 'stub'));
    if (t.archived) line.appendChild(el('span', 'badge', 'archived'));
    if (t.pr_url) { const pr = prLink(t.pr_url, 'btn small'); pr.prepend(icon(ICON.pr, 13)); line.appendChild(pr); }
    if (lead && !t.archived) {
      const term = el('a', 'btn small', 'Open in terminal');
      term.href = '/wheelchair/app/terminal?name=' + encodeURIComponent(lead.name);
      line.appendChild(term);
    }
    const agents = el('a', 'btn small', 'Agents'); agents.href = '/wheelchair/app/agents?lead=' + encodeURIComponent(id);
    line.appendChild(agents);
    {
      const wrap = el('div', 'export-action');
      if (exportAsk) {
        wrap.append(el('span', 'dim', 'Export and hand off? This thread stops taking work here.'), button('Confirm', 'primary small', async () => { try { await download(T + '/export', 'POST'); exportAsk = false; await poll(); } catch (e) { exportAsk = false; renderHead(); showError(e.message); } }), button('Cancel', 'small', () => { exportAsk = false; renderHead(); }));
      } else {
        const exportButton = button('Export', 'small', () => { exportAsk = true; renderHead(); }, !(t.export && t.export.ok) || t.archived || frozen());
        if (exportButton.disabled && t.export && t.export.reason) exportButton.title = t.export.reason;
        wrap.appendChild(exportButton);
      }
      line.appendChild(wrap);
    }
    const stubless = t.stub && !t.sessions.length;
    if (!t.archived) {
      if (!archiveAsk) {
        line.appendChild(button('Archive', 'danger small archive', () => { archiveAsk = true; sigs.head = null; renderHead(); }));
      } else {
        if (!stubless) line.appendChild(el('span', 'dim confirm-note archive', 'Stops its sessions and removes the worktree.'));
        line.appendChild(button('Confirm archive', 'danger small archive', doArchive));
        line.appendChild(button('Cancel', 'small archive', () => { archiveAsk = false; sigs.head = null; renderHead(); }));
      }
    }
    headEl.appendChild(line);
    const reason = $('export-reason');
    reason.textContent = t.export && t.export.reason || '';
    reason.hidden = !!(t.archived || frozen() || !t.export || t.export.ok || !t.export.reason);
  }

  async function download(url, method) {
    const res = await fetch(url, { method: method || 'GET' });
    if (!res.ok) { const out = await res.json().catch(() => ({})); throw new Error(out.detail || out.error || 'http ' + res.status); }
    const disposition = res.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="([^"\r\n]+)"/i);
    const urlObject = URL.createObjectURL(await res.blob());
    const a = el('a'); a.href = urlObject; a.download = match ? match[1] : 'handoff.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(urlObject), 1000);
  }
  async function handoffAction(action) {
    try {
      const result = await post(T + '/' + action);
      if (action === 'cancel-handoff' && result.outcome === 'cancelled' && thread().handoff_op && thread().handoff_op.kind === 'create') { location.href = '/wheelchair/app/threads'; return; }
      handoffKey = null; await poll();
    } catch (e) { showError(e.message); }
  }
  function renderHandoff() {
    const t = thread(); const banner = $('handoff'); const retry = $('handoff-retry');
    banner.hidden = !t.handed_off || !handoffState || handoffState.state === 'undo-unfinished' || !!t.handoff_op;
    banner.textContent = '';
    if (!banner.hidden) {
      const state = handoffState.state;
      const date = (value) => value ? new Date(value).toLocaleString() : '';
      const message = state === 'moved' ? 'Picked up elsewhere on ' + date(handoffState.picked_up_at) + '. Import a newer file to continue here.' : state === 'own-cancelled' ? 'An earlier cancelled import or undo is still being taken back; try again in a few minutes' : 'Handed off ' + date(handoffState.at) + '. Import a newer file to continue here, or undo.';
      banner.appendChild(el('p', '', message));
      if (state !== 'moved') banner.appendChild(button('Undo hand-off', 'small', () => handoffAction('undo-handoff')));
    }
    if (t.handed_off && (!handoffState || handoffState.state !== 'undo-unfinished') && !t.handoff_op) banner.appendChild(button('Download the file again', 'small', async () => { try { await download(T + '/handoff-file'); } catch (e) { showError(e.message); } }));
    retry.hidden = !t.handoff_op; retry.textContent = '';
    if (t.handoff_op) {
      const op = t.handoff_op;
      retry.appendChild(el('p', '', op.kind === 'undo' ? "The undo didn't finish." : "The import didn't finish."));
      if (op.last_error) retry.appendChild(el('p', '', op.last_error));
      retry.appendChild(button('Retry', 'primary small', () => handoffAction('retry-handoff')));
      if (op.can_cancel) retry.appendChild(button('Cancel', 'small', () => { if (window.confirm('Cancel this handoff?')) handoffAction('cancel-handoff'); }));
      if (t.handed_off) retry.appendChild(button('Download the file again', 'small', async () => { try { await download(T + '/handoff-file'); } catch (e) { showError(e.message); } }));
    }
    composerEl.hidden = !!t.handoff_op;
    const before = $('before-handoff'); before.hidden = !t.imported;
    const history = $('handoff-history'); history.textContent = '';
    if (t.imported) for (const entry of t.imported.history || []) history.appendChild(el('p', '', [entry.at, entry.who === 'collin' ? 'You' : entry.who, entry.text].filter(Boolean).join(' · ')));
  }

  // ---- the right column: this thread's files ----
  function fileLinks(into, cls) {
    const t = thread(); const s = slug();
    if (!(s && (planDir() || t.archived))) return;
    for (const f of ['MAP', 'IDEA', 'PLAN']) {
      const a = el('a', cls, f + '.md');
      a.href = '/wheelchair/app/doc?thread=' + encodeURIComponent(id) + '&file=' + f + '.md';
      into.appendChild(a);
    }
  }
  const pictureHref = (card) => '/wheelchair/app/picture?thread=' + encodeURIComponent(id) + '&card=' + encodeURIComponent(card.id);
  const asideTitle = (a) => 'Aside: ' + String((a.anchor && a.anchor.quote) || '').slice(0, 40);
  // One entry per picture file (the latest card for it wins), then one per saved aside graph.
  function pictureList() {
    const byFile = new Map();
    for (const c of data.cards) if (c.kind === 'diagram') { byFile.delete(window.WCDiagram.fileKey(c)); byFile.set(window.WCDiagram.fileKey(c), c); }
    const out = [...byFile.values()].map((c) => ({ title: c.title || c.graph, href: pictureHref(c) }));
    for (const a of data.asides || []) {
      for (const g of a.graphs || []) {
        out.push({ title: asideTitle(a), href: '/wheelchair/app/picture?thread=' + encodeURIComponent(id) + '&aside=' + encodeURIComponent(a.id) + '&entry=' + g.entry });
      }
    }
    return out;
  }
  function renderFiles() {
    filesEl.textContent = '';
    // Phones have no right column, so the plan files sit under the sticky header instead.
    headFilesEl.textContent = '';
    fileLinks(headFilesEl, 'btn small');
    const pictures = pictureList();
    for (const p of pictures) { const a = el('a', 'btn small', p.title); a.href = p.href; headFilesEl.appendChild(a); }
    headFilesEl.hidden = !headFilesEl.children.length;
    const list = el('div', 'file-list');
    fileLinks(list, 'file');
    if (pictures.length) {
      list.appendChild(el('span', 'file dim', 'graphs/ \u00b7 ' + pictures.length + (pictures.length === 1 ? ' picture' : ' pictures')));
      for (const p of pictures) { const a = el('a', 'file graph', p.title); a.href = p.href; list.appendChild(a); }
    }
    filesEl.hidden = !list.children.length;
    if (filesEl.hidden) return;
    filesEl.appendChild(el('h3', '', "This thread's files"));
    filesEl.appendChild(list);
  }
  async function doArchive() {
    try { await post(T + '/archive'); archiveAsk = false; sigs.head = null; await poll(); }
    catch (e) { showError('Archive failed: ' + e.message); }
  }

  // ---- stub opening, dead lead ----
  function prLink(url, cls) {
    const number = (String(url).match(/\/pull\/(\d+)/) || [])[1];
    const a = el('a', cls || '', number ? 'Pull request #' + number : 'Pull request');
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    return a;
  }

  function renderStub() {
    const t = thread();
    const unopened = t.stub && !t.sessions.length && !t.archived;
    stubEl.hidden = !unopened;
    if (!unopened) return;
    stubEl.textContent = '';
    stubEl.appendChild(el('h3', '', 'This thread has not started'));
    stubEl.appendChild(el('p', '', t.context || ''));
    const parent = t.parent_title || t.parent;
    if (parent) {
      // What this stub builds on: the parent thread and, when it has one, its pull request.
      const p = el('p', 'dim', (t.depends_on_parent ? 'Builds on ' : 'From '));
      const a = el('a', '', parent);
      a.href = '/wheelchair/app/thread?id=' + encodeURIComponent(t.parent); p.appendChild(a);
      if (t.parent_pr_url) {
        p.appendChild(document.createTextNode(', '));
        p.appendChild(prLink(t.parent_pr_url));
        if (t.depends_on_parent) p.appendChild(document.createTextNode(t.ready ? ' (merged)' : ' (not merged yet)'));
      }
      stubEl.appendChild(p);
    }
    const actions = el('div', 'actions');
    // Leaving a dependent stub alone is waiting: the hub watches the parent's pull request and
    // marks the stub ready when it merges, so the only choice to offer is starting early.
    if (t.depends_on_parent && !t.ready) {
      stubEl.appendChild(el('p', 'warn',
        'This builds on ' + parent + ', which has not merged yet. It will show ready here once it does.'));
      actions.appendChild(button('Start now anyway', 'primary', () => openStub(true)));
    } else {
      if (t.ready) stubEl.appendChild(el('p', 'ready-ok', 'Ready: ' + parent + ' has merged.'));
      actions.appendChild(button('Open and start', 'primary', () => openStub(t.ready)));
    }
    stubEl.appendChild(actions);
  }
  async function openStub(startNow) {
    try {
      await post(T + '/open', startNow ? { start_now: true } : {});
      sigs.stub = null;
      await poll();
    } catch (e) { showError('Could not open: ' + e.message); }
  }
  function renderDead() {
    const t = thread();
    const dead = !t.archived && !frozen() && (leads().length > 0 || t.imported) && !liveLead();
    deadEl.hidden = !dead;
    if (!dead) return;
    deadEl.textContent = '';
    deadEl.appendChild(el('p', '', 'The lead has stopped.'));
    deadEl.appendChild(button('Restart lead', 'primary', async () => {
      try { await post(T + '/restart'); await poll(); } catch (e) { showError('Restart failed: ' + e.message); }
    }));
  }

  // ---- chat ----
  function sinceImport(time) {
    if (!thread().imported) return true;
    const when = Date.parse(time); const cutoff = Date.parse(thread().imported.at);
    return !Number.isFinite(when) || !Number.isFinite(cutoff) || when >= cutoff;
  }
  // Every card shows in the conversation at its time, pinned or not. While the pins are open, a
  // pinned card's copy here drops its element ids, so links and lookups land on the pinned copy.
  function pinnedIds() { return new Set(data.pinned.map((c) => c.id)); }
  // Ids stay unique: a chat copy holds them only while its card is not drawn in the pins (pins
  // folded, or the card unpinned before the chat redrew). Runs after every render, because the
  // pins and the chat redraw separately (the chat waits while text in it is selected).
  function placeIds() {
    for (const node of chatEl.querySelectorAll('[data-chat-id]')) {
      const inPins = pinnedEl.querySelector('#' + CSS.escape(node.dataset.chatId));
      if (inPins && node.id) node.removeAttribute('id');
      else if (!inPins && !node.id) node.id = node.dataset.chatId;
    }
  }

  function renderChat() {
    const items = data.items.filter((i) => sinceImport(i.at));
    chatEl.textContent = '';
    // An import that moves the cutoff makes every bubble sent before it moot (Advance needs an
    // empty queue), so this tab's pending bubbles are dropped then, transcript or not; after
    // that, only messages since the import can match one.
    const cutoffNow = thread().imported ? thread().imported.at : null;
    if (seenCutoff !== undefined && seenCutoff !== cutoffNow) pending = [];
    seenCutoff = cutoffNow;
    // A pending bubble goes once the transcript has more of its words than just before it was
    // sent, so an earlier message with the same words never stands in for it. The row that
    // clears one is its own: later bubbles with the same words count it as already seen.
    const counts = new Map();
    for (const i of items) if (i.type === 'human' && !i.card) counts.set(i.text, (counts.get(i.text) || 0) + 1);
    pending = pending.filter((p, index) => {
      if ((counts.get(p.text) || 0) <= (p.seen || 0)) return true;
      for (const later of pending.slice(index + 1)) if (later.text === p.text) later.seen = (later.seen || 0) + 1;
      return false;
    });
    const cards = data.cards.filter((c) => sinceImport(c.created_at || c.at));
    const pinned = pinnedIds();
    let next = 0;
    const cardsBefore = (when) => {
      while (next < cards.length) {
        const cardAt = Date.parse(cards[next].at);
        if (when !== undefined && !(cardAt < when)) break;
        const card = cards[next++];
        const n = renderCard(card);
        if (!n) continue;
        // A pinned card's chat copy keeps its ids aside; placeIds() decides which copy holds them.
        if (pinned.has(card.id)) for (const node of [n, ...n.querySelectorAll('[id]')]) { node.dataset.chatId = node.id; node.removeAttribute('id'); }
        const prev = chatEl.lastElementChild;
        if (!(prev && prev.classList.contains('assistant'))) chatEl.appendChild(leadBy());
        chatEl.appendChild(n);
      }
    };
    // Who wrote the next message: the lead's first letter in a circle, then its name.
    // A sibling, not inside the bubble: asides measure offsets in the bubble's text.
    const leadBy = () => {
      const name = thread().lead_name || 'Lead';
      const row = el('div', 'lead-by');
      row.append(el('span', 'lead-avatar', Array.from(name)[0].toUpperCase()), el('span', 'lead-by-name', name));
      return row;
    };
    for (const it of items) {
      cardsBefore(Date.parse(it.at));
      if (it.type === 'human') {
        const parts = splitAttached(it.card ? '' : it.text);
        if (it.card || parts.text) chatEl.appendChild(el('div', 'bubble human' + (it.card ? ' card' : ''), it.card ? it.text : parts.text));
        if (parts.files.length) chatEl.appendChild(attachedRow(parts.files));
      } else if (it.type === 'assistant') {
        const lead = el('div', 'bubble assistant md');
        if (it.id) lead.dataset.messageId = it.id;
        window.WCMarkdown.render(it.text, lead);
        chatEl.append(leadBy(), lead);
      } else if (it.type === 'tool') {
        const d = el('details', 'tool'); d.appendChild(el('summary', '', it.text));
        d.appendChild(el('pre', 'tool-detail', it.detail || 'No details recorded.'));
        chatEl.appendChild(d);
      } else if (it.type === 'context') {
        const c = el('div', 'ctx');
        if (it.context === 'stub') {
          const d = el('details'); d.appendChild(el('summary', '', it.text));
          d.appendChild(el('div', '', (thread().title ? thread().title + ': ' : '') + (thread().context || '')));
          c.appendChild(d);
        } else c.textContent = it.text;
        chatEl.appendChild(c);
      }
    }
    cardsBefore();
    // Pair each pending bubble with Collin's message still in the lead's queue, so it can be
    // sent now. One queued before this page loaded has no pending bubble and gets its own.
    const lead = leadSession();
    const waiting = ((lead && lead.queue) || []).filter((q) => q.source === 'collin');
    // Pending ones already delivered (not queued) come first; the queue then shows in its own
    // order, whichever tab each message was sent from.
    const left = waiting.slice();
    const delivered = pending.filter((p) => {
      if (p.sent) return true;
      const at = left.findIndex((q) => q.text === p.text);
      if (at < 0) return true;
      left.splice(at, 1);
      return false;
    });
    const shown = [...delivered.map((p) => ({ text: p.text, queued: null, sent: p.sent })), ...waiting.map((q) => ({ text: q.text, queued: q }))];
    const canSendNow = lead && lead.live && lead.ready && !lead.permission_open && !lead.needs_open
      && !(lead.limited_until && Date.parse(lead.limited_until) > Date.now()) && !thread().archived;
    for (const p of shown) {
      const parts = splitAttached(p.text);
      const b = el('div', 'bubble human pending', parts.text);
      b.appendChild(el('span', 'tag', p.sent ? 'sent' : 'queued'));
      if (p.queued && canSendNow) {
        const at = p.queued.at;
        b.appendChild(button(sendingNow[at] ? 'Sending…' : 'Send now', 'send-now', () => sendNow(at), Boolean(sendingNow[at])));
      }
      chatEl.appendChild(b);
      if (parts.files.length) chatEl.appendChild(attachedRow(parts.files, true));
    }
  }

  // A message's trailing `[attached: <path>]` lines become files shown under its bubble.
  function splitAttached(text) {
    const lines = String(text || '').split('\n');
    const files = [];
    while (lines.length) {
      const m = /^\[attached: (.+)\]$/.exec(lines[lines.length - 1]);
      if (!m) { if (files.length && !lines[lines.length - 1].trim()) { lines.pop(); continue; } break; }
      files.unshift(m[1]); lines.pop();
    }
    return { text: lines.join('\n').trim(), files };
  }
  // Images as previews, anything else as a chip; each opens the upload. An archived thread's
  // uploads are gone, so nothing is fetched and each shows only its name.
  function attachedRow(paths, pending) {
    const row = el('div', 'sent-attachments' + (pending ? ' pending' : ''));
    for (const full of paths) {
      const file = full.split('/').pop();
      const name = file.replace(/^[0-9]+-/, '');
      const servable = /^[0-9]+-[A-Za-z0-9._-]+$/.test(file) && !thread().archived;
      const url = T + '/files/' + encodeURIComponent(file);
      if (servable && /\.(png|jpe?g|gif|webp)$/i.test(file)) {
        const a = el('a', 'sent-image'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.title = name;
        const img = el('img'); img.src = url; img.alt = name; img.loading = 'lazy'; a.appendChild(img); row.appendChild(a);
      } else {
        const chip = el(servable ? 'a' : 'span', 'sent-file', name);
        if (servable) { chip.href = url; chip.target = '_blank'; chip.rel = 'noopener'; chip.setAttribute('download', name); }
        row.appendChild(chip);
      }
    }
    return row;
  }

  // How many times the transcript (since any import) already shows these words from Collin.
  function humanCount(text) {
    return data.items.filter((i) => sinceImport(i.at) && i.type === 'human' && !i.card && i.text === text).length;
  }

  // Hand one queued message to the lead mid-turn instead of waiting for the turn to end.
  async function sendNow(at) {
    sendingNow[at] = true; sigs.chat = null; render();
    const lead = leadSession();
    const item = ((lead && lead.queue) || []).find((q) => q.source === 'collin' && q.at === at);
    const seen = item ? humanCount(item.text) : 0;   // counted before sending: the reply may lag the transcript
    try {
      const out = await post(T + '/send-now', { at });
      // Not handed over: it stays first in the queue and goes when the turn ends.
      if (!out || !out.sent) { showError('Could not send it now; it will go when the lead finishes its turn.'); return; }
      showError('');
      // Keep its bubble, marked sent, until the transcript shows it. This tab's own bubble for
      // it, if any, becomes that bubble; otherwise a new one is added.
      if (item) {
        const mine = pending.find((p) => !p.sent && p.text === item.text);
        if (mine) mine.sent = true;
        else pending.push({ text: item.text, seen, sent: true });
      }
    }
    catch (e) { showError('Could not send it now: ' + e.message); }
    finally { delete sendingNow[at]; sigs.chat = null; await poll(); }
  }

  // ---- cards ----
  // A sudo card's Decline and Talk about it. The card never becomes `answered` here: Decline
  // changes it only when the hub reports the helper's answer, and Talk about it leaves it open.
  async function sudoPress(card, action, value) {
    if (action === 'decline') declining[card.id] = true;
    delete cardErrors[card.id];
    sigs.chat = null; render();
    try {
      await post(T + '/cards/' + encodeURIComponent(card.id) + '/press',
        value === undefined ? { action } : { action, value });
      delete declining[card.id];
      await poll(true);
    } catch (e) {
      delete declining[card.id];
      cardErrors[card.id] = e.message;
    }
    sigs.chat = null; render();
  }
  // One press at a time per card: a question or offer greys out the moment it is tapped, so a
  // double tap sends nothing twice. A card answered elsewhere (another tab) just shows as answered.
  const pressing = {};
  const copied = {};         // check card step key -> true for ~2s after a successful Copy
  async function press(card, action, value, node) {
    if (pressing[card.id]) return;
    const once = card.kind === 'question' || card.kind === 'offer' || card.kind === 'reach';
    if (once) { pressing[card.id] = true; card.answered = true; sigs.chat = null; sigs.pinned = null; render(); }
    try {
      await post(T + '/cards/' + encodeURIComponent(card.id) + '/press',
        value === undefined ? { action } : { action, value });
      delete cardErrors[card.id];
      if (!(card.kind === 'deferred' && action === 'removed')) card.answered = true;
    } catch (e) {
      if (once && /already answered/.test(e.message)) card.answered = true;
      else { if (once) card.answered = false; cardErrors[card.id] = e.message; }
    } finally {
      delete pressing[card.id];
    }
    sigs.chat = null; sigs.pinned = null;
    await poll(true);
    render();
  }
  // What a pressed question or offer shows as its pick: the offer's mapped label, else the value itself.
  function pickedLabel(card) {
    if (card.kind === 'offer') {
      const hit = OFFER_CHOICES.find((c) => c[0] === card.answered_value);
      if (hit) return hit[1];
    }
    return String(card.answered_value);
  }
  function answeredTag(card) {
    if (!card.answered && !card.retracted_at) return null;
    const tag = el('div', 'answered-tag');
    let label = ' Answered';
    if (card.retracted_at) {
      label = ' Withdrawn \u00b7 ' + card.retracted_note;
      tag.classList.add('resolved');
    } else if (card.kind === 'merged' || (card.kind === 'needs' && card.resolved_by)) {
      label = ' ' + (card.resolved_note || (card.resolved_by === 'collin' ? 'Dismissed' : 'Resolved'));
      tag.classList.add('resolved');
    } else if (card.kind === 'reach' && card.allow_failed) {
      label = ' Allow failed: ' + card.allow_failed;
      tag.classList.add('resolved');
    } else if (card.kind === 'reach' && card.answered_value != null) {
      label = ' You picked ' + (card.answered_value === 'allow' ? 'Allow' : "Don't allow");
    } else if (card.kind === 'question' && card.resolved_by) {
      label = ' Answered in chat' + (card.resolved_note ? ' \u00b7 ' + card.resolved_note : '');
      tag.classList.add('resolved');
    } else if (card.kind === 'question' && card.answered_action === 'answered') {
      label = ' You answered: ' + card.answered_value;
    } else if ((card.kind === 'question' || card.kind === 'offer') && card.answered_value != null) {
      label = ' You picked ' + pickedLabel(card);
    }
    tag.append(icon(ICON.check, 12), document.createTextNode(label));
    return tag;
  }
  // The box under a question's options: Collin's own answer, sent as `[card <id>] answered: <text>`.
  function ownWords(card) {
    const wrap = el('div', 'own-words');
    const ta = el('textarea');
    ta.rows = 2; ta.placeholder = 'Or answer in your own words';
    ta.setAttribute('aria-label', 'Answer in your own words');
    ta.value = answerDrafts[card.id] || '';
    const send = button('Send answer', 'small', () => {
      const text = ta.value.trim();
      if (!text) return;
      send.disabled = true;
      press(card, 'answered', text).then(() => { if (card.answered) delete answerDrafts[card.id]; });
    }, !ta.value.trim());
    ta.addEventListener('input', () => { answerDrafts[card.id] = ta.value; send.disabled = !ta.value.trim(); });
    // A poll that redraws the chat replaces this box; keep the caret where Collin was typing.
    ta.addEventListener('focus', () => { answerFocus = card.id; });
    ta.addEventListener('blur', () => setTimeout(() => { if (ta.isConnected && answerFocus === card.id) answerFocus = null; }, 0));
    const keepCaret = () => { answerCaret[card.id] = [ta.selectionStart, ta.selectionEnd, ta.selectionDirection]; };
    for (const ev of ['input', 'keyup', 'mouseup', 'select']) ta.addEventListener(ev, keepCaret);
    if (answerFocus === card.id) requestAnimationFrame(() => {
      if (!ta.isConnected) return;
      ta.focus();
      const [start, end, dir] = answerCaret[card.id] || [ta.value.length, ta.value.length, 'none'];
      ta.setSelectionRange(start, end, dir);
    });
    wrap.append(ta, send);
    return wrap;
  }
  function head(box, eyebrow, tone, title) {
    if (eyebrow) box.appendChild(el('div', 'eyebrow ' + (tone || ''), eyebrow));
    if (title) box.appendChild(el('h3', '', title));
  }
  function seal() { const s = el('span', 'seal'); s.appendChild(icon(ICON.check, 14)); return s; }

  function renderCard(card) {
    const box = el('div', 'card card-' + card.kind);
    box.id = 'card-' + card.id; box.dataset.card = card.id; box.dataset.kind = card.kind;
    const off = card.answered || card.retracted_at || thread().archived || frozen();
    if (card.answered) box.classList.add('is-answered');
    if (card.retracted_at) box.classList.add('is-retracted');
    if (card.kind === 'question' && card.resolved_by) box.classList.add('is-resolved');
    switch (card.kind) {
      case 'offer': {
        const pin = el('span', 'pin'); pin.appendChild(icon(ICON.pin, 14));
        const text = el('div', 'offer-text');
        text.appendChild(el('h3', '', 'This looks like a feature'));
        text.appendChild(prose('', card.summary));
        const a = el('div', 'actions');
        for (const [value, label, cls] of OFFER_CHOICES) {
          const b = button(label, cls + (card.answered && card.answered_value === value ? ' picked' : ''),
            () => press(card, 'picked', value), off);
          if (b.classList.contains('picked')) b.prepend(icon(ICON.check, 12), document.createTextNode(' '));
          a.appendChild(b);
        }
        box.append(pin, text, a);
        break;
      }
      case 'idea':
      case 'deferred': {
        const deferred = card.kind === 'deferred';
        const all = card.bullets || [];
        const label = card.mode === 'two-part' ? 'Saved for the follow-up' : 'Skipped for this proof of concept';
        head(box, deferred ? label + ' · ' + all.length + (all.length === 1 ? ' thing' : ' things') : 'Your idea so far · ' + all.length + (all.length === 1 ? ' thing' : ' things') + " you've said", 'blue');
        box.appendChild(el('div', 'hint', deferred ? (card.mode === 'two-part' ? 'These go into a new thread when this one is done.' : 'These are accepted as risks; nothing will fix them later.') : 'Your words, not the idea doc. Planning writes the doc from these.'));
        if (deferred && !all.length) box.appendChild(el('div', 'dim', 'Nothing deferred yet'));
        const open = deferred ? deferredOpen : ideaOpen;
        const fold = all.length > 3 && !open;
        const shown = fold ? all.slice(-2) : all;
        if (fold) box.appendChild(el('div', 'dim fold-note', (all.length - 2) + ' earlier points folded'));
        for (const b of shown) {
          const row = el('div', 'bullet'); row.dataset.bullet = b.id;
          row.appendChild(el('span', 'bullet-text', b.text));
          if (!deferred || !(card.locked || thread().archived || card.retracted_at)) {
            const rm = button('×', 'x', () => press(card, 'removed', b.text), thread().archived);
            rm.setAttribute('aria-label', deferred ? 'Pull back in' : 'Remove'); rm.title = deferred ? 'Pull back in' : 'Remove';
            row.appendChild(rm);
          }
          box.appendChild(row);
        }
        if (all.length > 3) {
          const a = el('div', 'actions');
          a.appendChild(button(open ? 'Fold' : 'Show all ' + all.length, 'link', () => {
            if (deferred) deferredOpen = !deferredOpen;
            else ideaOpen = !ideaOpen;
            sigs.pinned = null; render();
          }));
          box.appendChild(a);
        }
        break;
      }
      case 'question': {
        head(box, card.progress || 'Question', card.answered ? '' : 'warn');
        box.appendChild(el('h3', '', card.question));
        if (card.fits) box.appendChild(el('div', 'fits', card.fits));
        if (card.doc && slug()) {
          const doc = el('a', 'doc-link', 'Open ' + card.doc);
          doc.href = '/wheelchair/app/doc?thread=' + encodeURIComponent(id) + '&file=' + encodeURIComponent(card.doc);
          box.appendChild(doc);
        }
        let n = 0;
        for (const o of card.options || []) {
          const lean = o.id === card.leaning;
          const picked = card.answered && card.answered_action !== 'answered' && card.answered_value != null && o.label === card.answered_value;
          const b = button('', 'opt' + (lean ? ' lean' : '') + (picked ? ' picked' : ''), () => press(card, 'picked', o.label), off);
          b.dataset.option = o.id;
          const line = el('span', 'opt-line');
          if (picked) { line.appendChild(icon(ICON.check, 12)); line.appendChild(document.createTextNode(' ')); }
          line.appendChild(el('span', 'opt-key', String.fromCharCode(65 + (n++ % 26)) + ' · '));
          line.appendChild(document.createTextNode(o.label));
          if (lean) line.appendChild(el('span', 'lean-tag', '· leaning'));
          b.appendChild(line);
          const cons = el('span', 'cons'); window.WCMarkdown.inline(o.consequence, cons);
          b.appendChild(cons);
          box.appendChild(b);
        }
        if (card.why) box.appendChild(el('div', 'fits', 'Why the lean: ' + card.why));
        if (!off) box.appendChild(ownWords(card));
        break;
      }
      case 'reach': {
        head(box, 'Talk to another thread', card.answered ? '' : 'warn');
        const h = el('h3', '');
        const seg = String(card.target_project || '').split('/').filter(Boolean).pop() || '';
        h.append(document.createTextNode("Let this thread's lead talk to the lead of "),
          el('strong', '', card.target_title || ''), document.createTextNode(' (' + seg + ')?'));
        box.appendChild(h);
        if (card.why) box.appendChild(el('div', 'fits', card.why));
        const a = el('div', 'actions');
        for (const [value, label] of [['allow', 'Allow'], ["don't allow", "Don't allow"]]) {
          const pk = card.answered && card.answered_value === value && !card.allow_failed;
          const b = button(label, (pk ? 'picked' : ''), () => press(card, 'picked', value), off);
          b.dataset.option = value;
          if (pk) b.prepend(icon(ICON.check, 12), document.createTextNode(' '));
          a.appendChild(b);
        }
        box.appendChild(a);
        break;
      }
      case 'approval': {
        const objs = card.objections || [];
        const top = el('div', 'approval-head');
        top.appendChild(seal());
        top.appendChild(el('h3', '', 'Plan approved, ' + objs.length + (objs.length === 1 ? ' objection' : ' objections')));
        box.appendChild(top);
        if (objs.length) {
          box.appendChild(el('p', 'approval-note',
            "The reviewers raised these as serious and I disagreed. Here's each one and why. Talk any of them through before building starts."));
        }
        objs.forEach((o, i) => {
          const row = el('div', 'obj');
          row.appendChild(el('div', 'eyebrow', (i + 1) + ' · ' + o.severity + ' finding'));
          row.appendChild(el('div', 'finding', '"' + o.finding + '"'));
          const why = el('div', 'why'); why.append(el('span', 'dim', 'Why I disagreed: '), document.createTextNode(o.reason));
          row.appendChild(why);
          row.appendChild(button('Talk about this', 'small', () => press(card, 'talk', o.finding), card.retracted_at || thread().archived));
          box.appendChild(row);
        });
        const ready = card.ready || {};
        const r = el('div', 'ready-box');
        const a = el('div', 'actions');
        const sb = button('Start building', 'go', () => press(card, 'start-building'), off || !ready.ok);
        sb.id = 'start-building';
        a.appendChild(sb);
        if (!ready.ok) a.appendChild(button('Re-check', '', () => press(card, 'recheck'), card.retracted_at || thread().archived));
        a.appendChild(el('span', 'dim', 'Nothing is built until you press start.'));
        r.appendChild(a);
        const status = el('div', 'ready-status ' + (ready.ok ? 'ok' : 'no'));
        status.appendChild(el('span', 'dotmark ' + (ready.ok ? 'green' : 'amber')));
        const words = el('div', 'ready-words');
        if (ready.ok) words.appendChild(el('div', 'ready-ok', 'Ready'));
        else {
          words.appendChild(el('div', 'ready-no', 'Not ready yet'));
          const ul = el('ul'); for (const m of ready.missing || []) ul.appendChild(el('li', '', m));
          words.appendChild(ul);
        }
        status.appendChild(words);
        r.appendChild(status);
        if (Array.isArray(card.warnings) && card.warnings.length) {
          const notice = el('div', 'ready-status no approval-warnings');
          notice.appendChild(el('span', 'dotmark amber'));
          const warningWords = el('div');
          warningWords.appendChild(el('div', 'ready-no', 'Heads-up'));
          const list = el('ul');
          for (const warning of card.warnings) list.appendChild(el('li', '', warning));
          warningWords.appendChild(list);
          notice.appendChild(warningWords);
          r.appendChild(notice);
        }
        box.appendChild(r);
        break;
      }
      case 'progress': {
        box.classList.toggle('amber', Boolean(card.choice_waiting));
        box.appendChild(el('span', 'dotmark blue'));
        const staged = card.stage === 'review' || card.stage === 'verify';
        const words = staged ? progressWords(card) : null;
        box.appendChild(el('strong', 'progress-label', staged ? words.label : 'Building'));
        const total = Math.max(0, Number(card.total) || 0);
        const done = Math.max(0, Math.min(total, Number(card.done) || 0));
        if (!staged && total && total <= 24) {
          const bar = el('div', 'segs');
          for (let i = 0; i < total; i += 1) bar.appendChild(el('span', i < done ? 'on' : ''));
          box.appendChild(bar);
        }
        box.appendChild(el('span', 'progress-text', staged ? words.text : card.done + ' of ' + card.total + ' tasks done'
          + ((card.machines || []).length ? ' · ' + card.machines.join(', ') : '')));
        box.appendChild(el('span', 'grow'));
        if (card.choice_waiting) box.appendChild(el('span', 'ready-no choice-pill', 'choice for you'));
        break;
      }
      case 'needs': {
        box.classList.add('amber');
        head(box, 'Needs you', 'warn', card.title);
        box.appendChild(prose('', card.body));
        if ((card.items || []).length) {
          const ul = el('ul'); for (const i of card.items) ul.appendChild(el('li', '', i)); box.appendChild(ul);
        }
        // A session-level card (stuck, permission) goes straight to that session's terminal.
        if (card.system && card.session && !card.answered) {
          const a = el('a', 'btn primary', 'Open terminal');
          a.href = '/wheelchair/app/terminal?name=' + encodeURIComponent(card.session);
          const actions = el('div', 'actions'); actions.appendChild(a); box.appendChild(actions);
        }
        // A card a lead posted stays until it is settled. Collin answers it with either
        // button, and the lead always replies, so nothing closes silently.
        if (!card.system && !card.answered) {
          const actions = el('div', 'actions');
          actions.appendChild(button('Keep going', 'primary', () => press(card, 'keep-going'), thread().archived));
          actions.appendChild(button('Talk about it', '', () => press(card, 'talk', card.title), thread().archived));
          box.appendChild(actions);
        }
        break;
      }
      case 'merged': {
        head(box, '', '', card.title);
        const actions = el('div', 'actions');
        const link = el('a', 'btn go', 'Review pull request');
        link.prepend(icon(ICON.pr, 15));
        link.href = safeUrl(card.pr_url); link.target = '_blank'; link.rel = 'noopener';
        actions.appendChild(link);
        if (!off) {
          if (mergedArchiveAsk[card.id]) {
            actions.appendChild(el('span', 'dim confirm-note', 'Stops its sessions and removes the worktree.'));
            actions.appendChild(button('Confirm archive', 'danger small', doArchive));
            actions.appendChild(button('Cancel', 'small', () => {
              delete mergedArchiveAsk[card.id]; sigs.chat = null; render();
            }));
          } else {
            actions.appendChild(button('Archive', 'danger small', () => {
              mergedArchiveAsk[card.id] = true; sigs.chat = null; render();
            }));
            actions.appendChild(button('Keep it', 'small', () => press(card, 'keep')));
          }
        }
        box.appendChild(actions);
        break;
      }
      case 'done': {
        const top = el('div', 'approval-head');
        top.appendChild(seal());
        top.appendChild(el('h3', '', card.title));
        box.appendChild(top);
        const inset = el('div', 'done-body');
        if (card.note) inset.appendChild(prose('dim', card.note));
        inset.appendChild(el('div', 'eyebrow', 'What you can do now'));
        for (const c of card.can_do || []) {
          const row = el('div', 'bullet'); row.appendChild(el('span', 'bullet-text', c));
          row.appendChild(button('Start a thread about it', 'link', () => press(card, 'start-thread', c), thread().archived));
          inset.appendChild(row);
        }
        if ((card.left_as_is || []).length) {
          const left = el('div', 'left-as-is');
          left.appendChild(el('div', 'eyebrow', 'Left as is · ' + card.left_as_is.length + (card.left_as_is.length === 1 ? ' thing' : ' things')));
          for (const l of card.left_as_is) {
            const row = el('div', 'bullet'); row.appendChild(el('span', 'bullet-text', l));
            row.appendChild(button('Start a thread about it', 'link', () => press(card, 'start-thread', l), thread().archived));
            left.appendChild(row);
          }
          inset.appendChild(left);
        }
        const a = el('div', 'actions');
        const link = el('a', 'btn go', 'Review pull request');
        link.prepend(icon(ICON.pr, 15));
        link.href = safeUrl(card.pr_url); link.target = '_blank'; link.rel = 'noopener';
        a.appendChild(link); inset.appendChild(a);
        box.appendChild(inset);
        break;
      }
      case 'check': {
        box.appendChild(el('h3', '', 'Check it yourself'));
        box.appendChild(el('div', 'check-update', card.update));
        const steps = card.steps || [];
        const ol = el('ol', 'check-steps');
        steps.forEach((s, i) => {
          const li = el('li', 'check-step');
          li.appendChild(el('span', 'check-where', s.where === 'machine' ? 'On the machine' : 'In the app'));
          li.appendChild(el('div', 'check-do', s.do));
          if (s.command) {
            const wrap = el('div', 'check-cmd');
            wrap.appendChild(el('pre', 'check-pre', s.command));
            const clip = typeof navigator !== 'undefined' && navigator.clipboard;
            if (clip && typeof clip.writeText === 'function') {
              const key = card.id + ':' + i;
              wrap.appendChild(button(copied[key] ? 'Copied' : 'Copy', 'small', async () => {
                try { await navigator.clipboard.writeText(s.command); } catch (e) { return; }
                copied[key] = true; sigs.chat = null; render();
                setTimeout(() => { delete copied[key]; sigs.chat = null; render(); }, 2000);
              }));
            }
            li.appendChild(wrap);
          }
          const see = el('div', 'check-see');
          see.appendChild(el('span', 'check-see-label', 'You should see:'));
          see.appendChild(document.createTextNode(' ' + s.see));
          li.appendChild(see);
          if (s.agent === 'not-tried') li.appendChild(el('div', 'dim check-note', 'Not tried by an agent: ' + s.note));
          else if (s.agent === 'broken') li.appendChild(el('div', 'check-note check-broken', "An agent tried this and it didn't work: " + s.note));
          ol.appendChild(li);
        });
        box.appendChild(ol);
        // Same rule as the hub's currentDone: not retracted, and strictly after the import cutoff.
        const cutoff = thread().imported && thread().imported.at;
        const curDone = [...data.cards].reverse().find((c) => c.kind === 'done' && !c.retracted_at
          && (!cutoff || Date.parse(c.created_at || c.at) > Date.parse(cutoff)));
        if (steps.some((s) => s.agent === 'broken') && !off && curDone && curDone.head === card.head) {
          const a = el('div', 'actions');
          a.appendChild(button('Fix it now', 'primary', () => press(card, 'fix')));
          a.appendChild(button('Leave it', '', () => press(card, 'leave')));
          box.appendChild(a);
        }
        break;
      }
      case 'diagram': {
        const bar = el('div', 'diagram-bar');
        bar.appendChild(el('h3', '', card.title));
        const link = el('a', 'btn small', 'Open full size'); link.href = pictureHref(card); bar.appendChild(link);
        box.appendChild(bar);
        // An archived thread's worktree is gone: the graph page draws the committed JSON the hub reads from the branch, read-only.
        if (thread().archived) box.appendChild(el('p', 'dim diagram-note', 'Diagram kept on branch ' + (thread().branch || '')));
        window.WCDiagram.draw(card, box, { id: id, archived: thread().archived, worktree: thread().worktree }, formCache);
        break;
      }
      case 'image': {
        box.appendChild(el('h3', '', card.title));
        if (thread().archived) box.appendChild(el('p', 'dim', 'Image removed when the thread was archived'));
        else { const url = T + '/files/' + encodeURIComponent(card.file); const a = el('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; const img = el('img', 'card-image'); img.src = url; img.alt = card.title; a.appendChild(img); box.appendChild(a); }
        break;
      }
      case 'stub': {
        head(box, 'Another thread', '', card.title);
        box.appendChild(prose('', card.summary));
        const a = el('div', 'actions');
        const link = el('a', 'btn primary', 'Go to it');
        link.href = '/wheelchair/app/thread?id=' + encodeURIComponent(card.thread_id || '');
        a.appendChild(link); box.appendChild(a);
        break;
      }
      case 'sudo': {
        const state = card.state || 'waiting';
        box.dataset.state = state;
        head(box, 'Run a command as root', state === 'waiting' ? 'warn' : '');
        if ((card.editable || []).length) {
          const warn = el('div', 'sudo-editable');
          warn.appendChild(el('p', '', 'An agent could change these files before this runs:'));
          const ul = el('ul');
          for (const f of card.editable) ul.appendChild(el('li', '', f));
          warn.appendChild(ul); box.appendChild(warn);
        }
        box.appendChild(el('pre', 'sudo-command', card.command));
        const facts = el('div', 'sudo-facts');
        facts.appendChild(el('div', 'eyebrow', 'What it does'));
        facts.appendChild(el('p', '', card.does));
        facts.appendChild(el('div', 'eyebrow', 'Why'));
        facts.appendChild(el('p', '', card.why));
        box.appendChild(facts);
        if (card.retracted_at) {
          // The withdrawal tag below replaces the sudo state and its controls.
        } else if (state === 'waiting') {
          const actions = el('div', 'actions');
          if (/^https:\/\//.test(String(card.url))) {
            const open = el('a', 'btn primary', 'Open to run');
            open.href = card.url; open.target = '_blank'; open.rel = 'noopener noreferrer';
            actions.appendChild(open);
          }
          const pending = Boolean(declining[card.id]);
          actions.appendChild(button(pending ? 'Declining…' : 'Decline', 'danger', () => sudoPress(card, 'decline'), pending || thread().archived));
          actions.appendChild(button('Talk about it', '', () => sudoPress(card, 'talk', 'sudo request'), pending || thread().archived));
          box.appendChild(actions);
        } else if (state === 'running') {
          box.appendChild(el('p', 'sudo-outcome', 'Running…'));
        } else {
          const result = el('div', 'sudo-result sudo-' + state);
          if (state === 'ran') {
            result.appendChild(el('p', 'sudo-outcome' + (card.exit_code === 0 ? '' : ' bad'), 'Ran: exit ' + card.exit_code));
            if (card.output) result.appendChild(el('pre', 'sudo-output', card.output));
            if (card.truncated) result.appendChild(el('p', 'dim sudo-cut', 'Output cut'));
          } else if (state === 'declined') {
            result.appendChild(el('p', 'sudo-outcome', 'Declined'));
          } else if (state === 'expired') {
            result.appendChild(el('p', 'sudo-outcome', 'Expired'));
          } else {
            result.appendChild(el('p', 'sudo-outcome bad', 'Failed: ' + (card.reason || 'no reason given')));
          }
          box.appendChild(result);
        }
        break;
      }
      default:
        return null;
    }
    if (card.retracted_at || ['offer', 'question', 'reach', 'approval'].includes(card.kind) || card.kind === 'merged' || (card.kind === 'needs' && card.resolved_by)) {
      const t = answeredTag(card); if (t) box.appendChild(t);
    }
    if (cardErrors[card.id]) box.appendChild(el('div', 'card-error', (card.kind === 'sudo' ? '' : 'Could not send: ') + cardErrors[card.id]));
    if (frozen()) box.querySelectorAll('button, input, textarea, select').forEach((n) => { n.disabled = true; });
    return box;
  }

  function progressWords(card) {
    const review = card.stage === 'review';
    const label = review ? (card.phase === 'clean' ? 'Plan reviewed' : 'Reviewing plan')
      : (card.phase === 'clean' ? 'Verified' : 'Verifying');
    let text = (review ? 'pass ' : 'attempt ') + card.pass + ' · ';
    if (card.phase === 'checking') text += review ? 'reviewers reading' : 'checking';
    else if (card.phase === 'fixing') text += review
      ? card.found + ' found, ' + card.fixed + ' resolved'
      : card.found + ' gaps, ' + card.fixed + ' fixed';
    else text += 'passed' + (review && card.found !== undefined ? ', ' + card.found + ' resolved' : '');
    if (!review && (card.machines || []).length) text += ' · ' + card.machines.join(', ');
    return { label, text };
  }

  // One short label per pin, for the folded strip.
  function pinLabel(card) {
    if (card.kind === 'offer') return card.answered ? 'Planning offer' : 'Planning offer: needs you';
    if (card.kind === 'approval') return card.answered ? 'Plan approved' : 'Plan approved: needs you';
    if (card.kind === 'deferred') return (card.mode === 'two-part' ? 'Saved for the follow-up' : 'Skipped for this proof of concept') + ' · ' + (card.bullets || []).length + ((card.bullets || []).length === 1 ? ' thing' : ' things');
    if (card.kind === 'idea') {
      const n = (card.bullets || []).length;
      return 'Your idea · ' + n + (n === 1 ? ' thing' : ' things');
    }
    if (card.kind === 'progress') {
      if (card.stage === 'review' || card.stage === 'verify') {
        const words = progressWords(card);
        return words.label + ' · ' + words.text + (card.choice_waiting ? ': choice for you' : '');
      }
      return 'Building ' + card.done + ' of ' + card.total + (card.choice_waiting ? ': choice for you' : '');
    }
    return card.kind;
  }

  function renderPinned() {
    pinnedEl.textContent = '';
    const order = Object.fromEntries(PINNED_KINDS.map((kind, i) => [kind, i]));
    const pins = data.pinned.map((p) => data.cards.find((c) => c.id === p.id) || p)
      .filter((c) => c.kind in order && sinceImport(c.created_at || c.at)).sort((a, b) => order[a.kind] - order[b.kind]);
    pinnedEl.classList.toggle('folded', pinsFolded);
    if (!pins.length) return;
    const bar = el('div', 'pin-bar');
    const label = el('span', 'pin-bar-label');
    label.appendChild(icon(ICON.pin, 12));
    label.appendChild(document.createTextNode(pinsFolded ? ' ' + pins.map(pinLabel).join(' · ') : ' Pinned'));
    const toggle = button(pinsFolded ? 'Show' : 'Hide', 'link pin-toggle', () => {
      pinsFolded = !pinsFolded;
      try { localStorage.setItem(PINS_KEY, pinsFolded ? '1' : '0'); } catch (e) { /* this page only */ }
      sigs.pinned = null; render();
    });
    toggle.setAttribute('aria-expanded', String(!pinsFolded));
    bar.append(label, toggle);
    pinnedEl.appendChild(bar);
    if (pinsFolded) return;
    const list = el('div', 'pin-list');
    for (const live of pins) { const n = renderCard(live); if (n) list.appendChild(n); }
    pinnedEl.appendChild(list);
  }

  // The pinned strip sticks just under the thread header, whose height changes as it wraps;
  // the strip's own height and the composer's tell scrolling (a #card- link) where the open
  // middle of the screen is, so a card is never scrolled in underneath either.
  const composerEl = $('composer');
  function syncStickyHeights() {
    const root = document.documentElement.style;
    root.setProperty('--head-h', headEl.offsetHeight + 'px');
    root.setProperty('--pins-h', pinnedEl.offsetHeight + 'px');
    root.setProperty('--composer-h', composerEl.offsetHeight + 'px');
  }
  syncStickyHeights();
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(syncStickyHeights);
    for (const n of [headEl, pinnedEl, composerEl]) ro.observe(n);
  } else window.addEventListener('resize', syncStickyHeights);

  // One line above the pinned cards while the live lead is waiting for room or rate-limited.
  function clock(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toDateString() === new Date().toDateString() ? time : d.toLocaleDateString([], { weekday: 'short' }) + ' ' + time;
  }
  function waitingLine() {
    const lead = leads().filter((s) => s.live || s.status === 'waiting').pop();
    if (!lead) return '';
    if (lead.status === 'waiting' && lead.waiting_until) {
      // The provider the wait is pinned to, else the lead's, else the thread's; none set → room.
      const provider = [lead.waiting_provider, lead.provider, thread().provider].find((p) => PROVIDER_LABEL[p]);
      if (!provider) return 'Waiting for room, about ' + clock(lead.waiting_until);
      const label = PROVIDER_LABEL[provider];
      return 'Waiting for ' + label + ' to refill, about ' + clock(lead.waiting_until);
    }
    if (lead.live && lead.limited_until && Date.parse(lead.limited_until) > Date.now()) {
      return 'Waiting for ' + ((accountNames && accountNames[lead.account]) || lead.account || 'the account') + ' to refill, about ' + clock(lead.limited_until);
    }
    return '';
  }
  async function loadAccountNames() {
    try {
      const res = await fetch(API + '/settings');
      if (!res.ok) return;
      const out = await res.json();
      accountNames = Object.fromEntries((out.accounts || []).map((a) => [a.id, a.name]));
      sigs.wait = null; render();
    } catch (e) { accountNames = {}; }
  }
  function renderWait() {
    const text = waitingLine();
    waitEl.hidden = !text;
    waitEl.textContent = text;
  }

  function selectingInChat() {
    const sel = window.getSelection();
    return Boolean(sel && !sel.isCollapsed && sel.rangeCount && chatEl.contains(sel.anchorNode));
  }
  document.addEventListener('selectionchange', () => { if (data && !selectingInChat()) render(); });

  function render() {
    if (!data) return;
    const t = thread();
    renderHandoff();
    document.title = (t.title || slug() || base(t.project)) + ' - thread';
    sync('head', [t.title, t.lead_name, t.stub, t.archived, t.worktree, t.branch, t.slug, slug(), archiveAsk, exportAsk, t.export, t.handed_off, t.handoff_op, t.pr_url, t.cli, t.machine, t.sessions.map((x) => [x.name, x.live, x.model, x.role, x.created_at])], renderHead);
    sync('files', [t.worktree, slug(), t.archived, data.cards.filter((c) => c.kind === 'diagram'), (data.asides || []).map((a) => [a.id, a.anchor && a.anchor.quote, a.graphs])], renderFiles);
    sync('stub', [t.stub, t.sessions.length, t.depends_on_parent, t.ready, t.context, t.parent_pr_url], renderStub);
    sync('wait', [waitingLine(), accountNames], renderWait);
    sync('dead', [t.sessions.map((s) => [s.name, s.live]), t.archived, t.handed_off, t.handoff_op, t.imported], renderDead);
    sync('pinned', [data.pinned, data.cards.map((c) => [c.answered, c.answered_value, c.retracted_at]), ideaOpen, deferredOpen, pinsFolded, cardErrors, t.handed_off, t.handoff_op, t.imported], renderPinned);
    const nearBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 80;
    let changed = false;
    const leadNow = leadSession();
    // Text selected in the chat (for an aside) would vanish with a redraw, so the redraw waits
    // until the selection is gone; the selectionchange listener above calls render() then.
    const chatSig = JSON.stringify([data.items, pending, leadNow && [leadNow.queue, leadNow.ready, leadNow.permission_open, leadNow.needs_open, leadNow.limited_until], sendingNow, slug(), t.archived, t.handed_off, t.handoff_op, t.imported, data.cards, data.pinned.map((c) => c.id), pinsFolded, ideaOpen, deferredOpen, cardErrors, declining]);
    // An import moving the cutoff (or a hand-off starting) must not wait for the selection:
    // what came before the import has to leave the chat at once.
    const cutoff = JSON.stringify([t.imported && t.imported.at, Boolean(t.handed_off)]);
    if (sigs.chat !== chatSig && (!selectingInChat() || sigs.chatCutoff !== cutoff)) { sigs.chat = chatSig; sigs.chatCutoff = cutoff; renderChat(); changed = true; }
    const workingEl = $('working');
    const working = leadWorking() && !t.archived;
    const workingText = (t.lead_name || 'The lead') + ' is working';
    if ($('working-label').textContent !== workingText) { $('working-label').textContent = workingText; workingEl.setAttribute('aria-label', workingText); }
    if (workingEl.hidden === working) { workingEl.hidden = !working; if (working && nearBottom) changed = true; }
    placeIds();
    if (window.WCAside) window.WCAside.update(data, changed);
    if (changed && nearBottom) window.scrollTo(0, document.body.scrollHeight);
    const queuedTotal = Math.max(data.queued, pending.filter((p) => !p.sent).length);
    queuedNote.hidden = queuedTotal === 0;
    queuedNote.textContent = queuedTotal + ' queued: waiting for the lead to finish its turn';
    const canSend = liveLead() && !t.archived && !frozen();
    msgEl.disabled = !canSend || uploading; sendBtn.disabled = !canSend || uploading; $('attach').disabled = !canSend || uploading;
    msgEl.placeholder = canSend ? 'Message the lead' : (t.archived ? 'Archived' : 'No live lead');
  }

  let busy = false;
  async function poll() {
    if (busy) return; busy = true;
    try {
      const res = await fetch(T + '/chat');
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.detail || out.error || 'http ' + res.status);
      data = out; showError('');
      const key = out.thread.handed_off && JSON.stringify(out.thread.handed_off);
      if (key && key !== handoffKey) {
        try { const response = await fetch(T + '/handoff'); const state = await response.json(); if (!response.ok) throw new Error(state.detail || state.error || 'http ' + response.status); handoffState = state; handoffKey = key; } catch (e) { handoffState = { state: 'inspect-failed', at: out.thread.handed_off.at }; handoffKey = key; }
      } else if (!key) { handoffState = null; handoffKey = null; }
      render();
    } catch (e) { showError('Could not load the thread: ' + e.message); }
    finally { busy = false; }
  }

  const fileInput = $('attachment-input');
  const chips = $('attachments');
  const attachmentError = $('attachment-error');
  function renderAttachments() {
    chips.textContent = '';
    attachments.forEach((file, i) => {
      const chip = el('span', 'attachment-chip');
      if (/^image\/(png|jpeg|gif|webp)$/.test(file.type)) {
        // A data: URL, since the page's content policy allows data: images and not blob: ones.
        const img = el('img', 'attachment-thumb'); img.alt = ''; chip.appendChild(img);
        const reader = new FileReader(); reader.onload = () => { img.src = reader.result; }; reader.readAsDataURL(file);
      }
      const size = file.size < 1024 ? file.size + ' B' : file.size < 1048576 ? (file.size / 1024).toFixed(1) + ' KB' : (file.size / 1048576).toFixed(1) + ' MB';
      chip.appendChild(el('span', '', file.name + ' · ' + size));
      const remove = button('×', 'attachment-remove', () => { if (uploading) return; attachments.splice(i, 1); renderAttachments(); });
      remove.disabled = uploading;
      remove.setAttribute('aria-label', 'Remove ' + file.name); chip.appendChild(remove); chips.appendChild(chip);
    });
  }
  function addFiles(files, pasted) {
    if (uploading) return;
    const errors = [];
    for (let file of files) {
      if (pasted && file.type.startsWith('image/') && (!file.name || /^image\.[a-z0-9]+$/i.test(file.name))) {
        const d = new Date(); const pad = (n) => String(n).padStart(2, '0');
        const stamp = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
        const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' })[file.type] || file.type.slice(6).replace(/[^a-z0-9]/gi, '') || 'bin';
        file = new File([file], 'pasted-' + stamp + '.' + ext, { type: file.type });
      }
      if (file.size > 25 * 1024 * 1024) errors.push(file.name + ' is over 25 MB'); else attachments.push(file);
    }
    attachmentError.textContent = errors.join(' · '); renderAttachments();
  }
  $('attach').addEventListener('click', () => { if (!uploading) fileInput.click(); });
  fileInput.addEventListener('change', () => { addFiles(fileInput.files, false); fileInput.value = ''; });
  msgEl.addEventListener('paste', (ev) => { if (ev.clipboardData && ev.clipboardData.files.length) { ev.preventDefault(); addFiles(ev.clipboardData.files, true); } });
  composerEl.addEventListener('dragover', (ev) => { if (ev.dataTransfer.types.includes('Files')) ev.preventDefault(); });
  composerEl.addEventListener('drop', (ev) => { if (ev.dataTransfer.files.length) { ev.preventDefault(); addFiles(ev.dataTransfer.files, false); } });
  composerEl.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const text = msgEl.value.trim();
    if (uploading || (!text && !attachments.length)) return;
    const sending = attachments.slice();
    uploading = true; renderAttachments(); render();
    try {
      const paths = [];
      for (const file of sending) {
        let res;
        try {
          res = await fetch(T + '/uploads?name=' + encodeURIComponent(file.name), { method: 'POST', headers: { 'content-type': file.type || 'application/octet-stream' }, body: file });
          const out = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(out.detail || out.error || 'http ' + res.status);
          paths.push(out.path);
        } catch (e) { throw new Error('Upload failed: ' + e.message); }
      }
      const message = [text, paths.map((path) => '[attached: ' + path + ']').join('\n')].filter(Boolean).join('\n\n');
      const seen = humanCount(message);   // counted before sending: the reply may lag the transcript
      await post(T + '/messages', { text: message });
      pending.push({ text: message, seen }); msgEl.value = ''; attachments = attachments.filter((file) => !sending.includes(file)); attachmentError.textContent = ''; renderAttachments();
      sigs.chat = null; await poll(); render();
    } catch (e) { showError(e.message.startsWith('Upload failed:') ? e.message : 'Message not sent: ' + e.message); }
    finally { uploading = false; renderAttachments(); render(); }
  });

  poll();
  loadAccountNames();
  window.wcPoller(poll, POLL_MS);
})();
