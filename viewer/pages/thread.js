(function () {
  'use strict';
  const API = '/wheelchair/api';
  const id = new URLSearchParams(location.search).get('id') || '';
  const T = API + '/threads/' + encodeURIComponent(id);
  const POLL_MS = 2000;
  const PINNED_KINDS = ['offer', 'idea', 'progress'];

  const $ = (x) => document.getElementById(x);
  const errorEl = $('error'); const headEl = $('head'); const stubEl = $('stub-open');
  const deadEl = $('dead'); const docEl = $('docview'); const pinnedEl = $('pinned');
  const chatEl = $('chat'); const queuedNote = $('queued-note');
  const msgEl = $('msg'); const sendBtn = $('send');

  let data = null;
  let pending = [];          // messages posted but not yet seen in the transcript
  let sigs = {};
  let ideaOpen = false;
  let archiveAsk = false;
  const cardErrors = {};

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
  function liveLead() { return leads().some((s) => s.live); }

  // ---- head ----
  function renderHead() {
    const t = thread();
    headEl.textContent = '';
    const back = el('a', 'dim', '< Threads'); back.href = '/wheelchair/app/threads';
    headEl.appendChild(back);
    headEl.appendChild(el('h1', '', t.title || slug() || base(t.project)));
    headEl.appendChild(el('div', 'meta',
      [base(t.project), t.cli, t.machine, t.branch].filter(Boolean).join(' · ')));
    const line = el('div', 'line');
    if (t.stub) line.appendChild(el('span', 'badge', 'stub'));
    if (t.pr_url) line.appendChild(prLink(t.pr_url, 'btn'));
    if (t.archived) line.appendChild(el('span', 'badge', 'archived'));
    const s = slug();
    if (s && (planDir() || t.archived)) {
      for (const f of ['MAP', 'IDEA', 'PLAN']) {
        if (t.archived) {
          line.appendChild(button(f, '', () => showArchivedDoc(f + '.md')));
        } else {
          const a = el('a', 'btn', f);
          a.href = '/wheelchair/docs?plan=' + encodeURIComponent(planDir()) + '&file=' + f + '.md';
          line.appendChild(a);
        }
      }
    }
    if (!t.archived && !(t.stub && !t.sessions.length)) {
      if (!archiveAsk) {
        line.appendChild(button('Archive', 'danger', () => { archiveAsk = true; sigs.head = null; renderHead(); }));
      } else {
        line.appendChild(el('span', 'dim', 'Stops its sessions and removes the worktree.'));
        line.appendChild(button('Confirm archive', 'danger', doArchive));
        line.appendChild(button('Cancel', '', () => { archiveAsk = false; sigs.head = null; renderHead(); }));
      }
    } else if (!t.archived && t.stub) {
      if (!archiveAsk) line.appendChild(button('Archive', 'danger', () => { archiveAsk = true; sigs.head = null; renderHead(); }));
      else {
        line.appendChild(button('Confirm archive', 'danger', doArchive));
        line.appendChild(button('Cancel', '', () => { archiveAsk = false; sigs.head = null; renderHead(); }));
      }
    }
    headEl.appendChild(line);
  }
  async function doArchive() {
    try { await post(T + '/archive'); archiveAsk = false; sigs.head = null; await poll(); }
    catch (e) { showError('Archive failed: ' + e.message); }
  }
  async function showArchivedDoc(file) {
    docEl.hidden = false; docEl.textContent = 'Loading ' + file + '…';
    try {
      const res = await fetch(T + '/doc?file=' + encodeURIComponent(slug() ? file : file));
      const out = await res.json();
      if (!res.ok) throw new Error(out.detail || out.error || 'http ' + res.status);
      docEl.textContent = '';
      docEl.appendChild(el('h3', '', file));
      docEl.appendChild(el('pre', '', out.content));
      docEl.appendChild(button('Close', '', () => { docEl.hidden = true; }));
    } catch (e) { docEl.textContent = 'Could not read ' + file + ': ' + e.message; }
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
    const dead = !t.archived && leads().length > 0 && !liveLead();
    deadEl.hidden = !dead;
    if (!dead) return;
    deadEl.textContent = '';
    deadEl.appendChild(el('p', '', 'The lead has stopped.'));
    deadEl.appendChild(button('Restart lead', 'primary', async () => {
      try { await post(T + '/restart'); await poll(); } catch (e) { showError('Restart failed: ' + e.message); }
    }));
  }

  // ---- chat ----
  function renderChat() {
    const items = data.items;
    chatEl.textContent = '';
    const humans = items.filter((i) => i.type === 'human' && !i.card).map((i) => i.text);
    pending = pending.filter((p) => {
      const at = humans.indexOf(p.text);
      if (at >= 0) { humans.splice(at, 1); return false; }
      return true;
    });
    const cards = data.cards.filter((c) => !PINNED_KINDS.includes(c.kind));
    let next = 0;
    const cardsBefore = (when) => {
      while (next < cards.length) {
        const cardAt = Date.parse(cards[next].at);
        if (when !== undefined && !(cardAt < when)) break;
        const n = renderCard(cards[next++]); if (n) chatEl.appendChild(n);
      }
    };
    for (const it of items) {
      cardsBefore(Date.parse(it.at));
      if (it.type === 'human') {
        const b = el('div', 'bubble human' + (it.card ? ' card' : ''), it.text);
        chatEl.appendChild(b);
      } else if (it.type === 'assistant') {
        chatEl.appendChild(el('div', 'bubble assistant', it.text));
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
    for (const p of pending) {
      const b = el('div', 'bubble human pending', p.text);
      b.appendChild(el('span', 'tag', 'queued'));
      chatEl.appendChild(b);
    }
  }

  // ---- cards ----
  async function press(card, action, value, node) {
    try {
      await post(T + '/cards/' + encodeURIComponent(card.id) + '/press',
        value === undefined ? { action } : { action, value });
      delete cardErrors[card.id];
      card.answered = true;
      await poll(true);
    } catch (e) {
      cardErrors[card.id] = e.message;
      sigs.chat = null; sigs.pinned = null;
      render();
    }
  }
  function answeredTag(card) { return card.answered ? el('div', 'answered-tag', 'Answered') : null; }

  function renderCard(card) {
    const box = el('div', 'card card-' + card.kind);
    box.id = 'card-' + card.id; box.dataset.card = card.id; box.dataset.kind = card.kind;
    const off = card.answered || thread().archived;
    switch (card.kind) {
      case 'offer': {
        box.appendChild(el('h3', '', 'Take it into planning?'));
        box.appendChild(el('p', '', card.summary));
        const a = el('div', 'actions');
        a.appendChild(button('Take it into planning', 'primary',
          () => press(card, 'picked', 'take it into planning'), off));
        box.appendChild(a);
        break;
      }
      case 'idea': {
        box.appendChild(el('h3', '', 'Your idea so far'));
        const all = card.bullets || [];
        const fold = all.length > 3 && !ideaOpen;
        const shown = fold ? all.slice(-2) : all;
        if (fold) box.appendChild(el('div', 'dim fold-note', (all.length - 2) + ' earlier points folded'));
        for (const b of shown) {
          const row = el('div', 'bullet'); row.dataset.bullet = b.id;
          row.appendChild(el('span', '', b.text));
          row.appendChild(button('Remove', '', () => press(card, 'removed', b.text), thread().archived));
          box.appendChild(row);
        }
        if (all.length > 3) {
          const a = el('div', 'actions');
          a.appendChild(button(ideaOpen ? 'Fold' : 'Show all ' + all.length, '', () => {
            ideaOpen = !ideaOpen; sigs.pinned = null; render();
          }));
          box.appendChild(a);
        }
        break;
      }
      case 'question': {
        if (card.progress) box.appendChild(el('div', 'fits', card.progress));
        box.appendChild(el('div', 'fits', card.fits));
        box.appendChild(el('h3', '', card.question));
        for (const o of card.options || []) {
          const lean = o.id === card.leaning;
          const b = button('', 'opt' + (lean ? ' lean' : ''), () => press(card, 'picked', o.label), off);
          b.dataset.option = o.id;
          b.appendChild(document.createTextNode(o.label));
          if (lean) b.appendChild(el('span', 'lean-tag', 'leaning'));
          b.appendChild(el('span', 'cons', o.consequence));
          box.appendChild(b);
        }
        box.appendChild(el('div', 'fits', 'Why the lean: ' + card.why));
        break;
      }
      case 'approval': {
        const objs = card.objections || [];
        box.appendChild(el('h3', '', 'Plan approved, ' + objs.length + (objs.length === 1 ? ' objection' : ' objections')));
        for (const o of objs) {
          const row = el('div', 'obj');
          row.appendChild(el('div', 'dim', o.severity + ' finding'));
          row.appendChild(el('div', '', '"' + o.finding + '"'));
          row.appendChild(el('div', '', 'Why I disagreed: ' + o.reason));
          row.appendChild(button('Talk about this', '', () => press(card, 'talk', o.finding), thread().archived));
          box.appendChild(row);
        }
        const ready = card.ready || {};
        const r = el('div', 'obj');
        if (ready.ok) r.appendChild(el('div', 'ready-ok', 'Ready'));
        else {
          r.appendChild(el('div', 'ready-no', 'Not ready yet'));
          const ul = el('ul'); for (const m of ready.missing || []) ul.appendChild(el('li', '', m));
          r.appendChild(ul);
        }
        const a = el('div', 'actions');
        if (!ready.ok) a.appendChild(button('Re-check', '', () => press(card, 'recheck'), thread().archived));
        const sb = button('Start building', 'primary', () => press(card, 'start-building'), off || !ready.ok);
        sb.id = 'start-building';
        a.appendChild(sb);
        r.appendChild(a);
        box.appendChild(r);
        break;
      }
      case 'progress': {
        box.classList.toggle('amber', Boolean(card.choice_waiting));
        box.appendChild(el('div', '', card.done + ' of ' + card.total + ' tasks done'
          + ((card.machines || []).length ? ' · ' + card.machines.join(', ') : '')));
        if (card.choice_waiting) box.appendChild(el('div', 'ready-no', 'choice for you'));
        break;
      }
      case 'needs': {
        box.classList.add('amber');
        box.appendChild(el('h3', '', card.title));
        box.appendChild(el('p', '', card.body));
        if ((card.items || []).length) {
          const ul = el('ul'); for (const i of card.items) ul.appendChild(el('li', '', i)); box.appendChild(ul);
        }
        // A session-level card (stuck, permission) goes straight to that session's terminal.
        if (card.system && card.session && !card.answered) {
          const a = el('a', 'btn primary', 'Open terminal');
          a.href = '/wheelchair/app/terminal?name=' + encodeURIComponent(card.session);
          const actions = el('div', 'actions'); actions.appendChild(a); box.appendChild(actions);
        }
        break;
      }
      case 'done': {
        box.appendChild(el('h3', '', card.title));
        if (card.note) box.appendChild(el('p', 'dim', card.note));
        box.appendChild(el('div', 'dim', 'What you can do now'));
        const ul = el('ul'); for (const c of card.can_do || []) ul.appendChild(el('li', '', c)); box.appendChild(ul);
        if ((card.left_as_is || []).length) {
          box.appendChild(el('div', 'dim', 'Left as is'));
          for (const l of card.left_as_is) {
            const row = el('div', 'bullet'); row.appendChild(el('span', '', l));
            row.appendChild(button('Start a thread about it', '', () => press(card, 'start-thread', l), thread().archived));
            box.appendChild(row);
          }
        }
        const a = el('div', 'actions');
        const link = el('a', 'btn primary', 'Review pull request');
        link.href = safeUrl(card.pr_url); link.target = '_blank'; link.rel = 'noopener';
        a.appendChild(link); box.appendChild(a);
        break;
      }
      case 'diagram': {
        box.appendChild(el('h3', '', card.title));
        if (thread().archived) {
          // The worktree is gone, so the graph page can't open it; the committed JSON is read from the branch.
          box.appendChild(el('p', 'dim', 'Diagram kept on branch ' + (thread().branch || '')));
          const a = el('div', 'actions');
          const link = el('a', 'btn', 'Open diagram (read-only JSON)');
          link.href = T + '/graph?file=' + encodeURIComponent(card.graph + '.json');
          link.target = '_blank'; link.rel = 'noopener';
          a.appendChild(link); box.appendChild(a);
          break;
        }
        const wt = thread().worktree;
        const path = wt + '/docs/plans/' + card.plan + '/graphs/' + card.graph + '.json';
        const src = '/wheelchair/?path=' + encodeURIComponent(path);
        const f = el('iframe', 'diagram'); f.src = src; f.title = card.title;
        box.appendChild(f);
        const a = el('div', 'actions');
        const link = el('a', 'btn', 'Open full screen'); link.href = src; link.target = '_blank'; link.rel = 'noopener';
        a.appendChild(link); box.appendChild(a);
        break;
      }
      case 'stub': {
        box.appendChild(el('h3', '', card.title));
        box.appendChild(el('p', '', card.summary));
        const a = el('div', 'actions');
        const link = el('a', 'btn primary', 'Go to it');
        link.href = '/wheelchair/app/thread?id=' + encodeURIComponent(card.thread_id || '');
        a.appendChild(link); box.appendChild(a);
        break;
      }
      default:
        return null;
    }
    if (['offer', 'question', 'approval'].includes(card.kind)) {
      const t = answeredTag(card); if (t) box.appendChild(t);
    }
    if (cardErrors[card.id]) box.appendChild(el('div', 'card-error', 'Could not send: ' + cardErrors[card.id]));
    return box;
  }

  function renderPinned() {
    pinnedEl.textContent = '';
    const order = { offer: 0, idea: 1, progress: 2 };
    const pins = data.pinned.filter((c) => c.kind in order).sort((a, b) => order[a.kind] - order[b.kind]);
    for (const p of pins) {
      const live = data.cards.find((c) => c.id === p.id) || p;
      const n = renderCard(live); if (n) pinnedEl.appendChild(n);
    }
  }

  function render() {
    if (!data) return;
    const t = thread();
    document.title = (t.title || slug() || base(t.project)) + ' - thread';
    sync('head', [t.title, t.stub, t.archived, t.worktree, t.branch, t.slug, slug(), archiveAsk, t.pr_url], renderHead);
    sync('stub', [t.stub, t.sessions.length, t.depends_on_parent, t.ready, t.context, t.parent_pr_url], renderStub);
    sync('dead', [t.sessions.map((s) => [s.name, s.live]), t.archived], renderDead);
    sync('pinned', [data.pinned, data.cards.map((c) => c.answered), ideaOpen, cardErrors], renderPinned);
    const nearBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 80;
    let changed = false;
    sync('chat', [data.items, pending, data.cards.filter((c) => !PINNED_KINDS.includes(c.kind)), cardErrors], () => { renderChat(); changed = true; });
    if (changed && nearBottom) window.scrollTo(0, document.body.scrollHeight);
    const queuedTotal = Math.max(data.queued, pending.length);
    queuedNote.hidden = queuedTotal === 0;
    queuedNote.textContent = queuedTotal + ' queued: waiting for the lead to finish its turn';
    const canSend = liveLead() && !t.archived;
    msgEl.disabled = !canSend; sendBtn.disabled = !canSend;
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
      render();
    } catch (e) { showError('Could not load the thread: ' + e.message); }
    finally { busy = false; }
  }

  $('composer').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const text = msgEl.value.trim();
    if (!text) return;
    sendBtn.disabled = true;
    try {
      await post(T + '/messages', { text });
      pending.push({ text });
      msgEl.value = '';
      sigs.chat = null;
      await poll();
      render();
    } catch (e) { showError('Message not sent: ' + e.message); }
    sendBtn.disabled = false;
  });

  poll();
  setInterval(poll, POLL_MS);
})();
