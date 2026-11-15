(function () {
  'use strict';
  const API = '/wheelchair/api';
  const id = new URLSearchParams(location.search).get('id') || '';
  const T = API + '/threads/' + encodeURIComponent(id);
  const POLL_MS = 2000;
  const PINNED_KINDS = ['offer', 'idea', 'progress'];
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
  let pending = [];          // messages posted but not yet seen in the transcript
  let sigs = {};
  let ideaOpen = false;
  // Whether the pinned strip is folded to one line. A per-viewer convenience, so it lives in
  // this browser only; storage that throws (private window, blocked site data) just means open.
  const PINS_KEY = 'wheelchair.pinsFolded';
  let pinsFolded = false;
  try { pinsFolded = localStorage.getItem(PINS_KEY) === '1'; } catch (e) { /* stays open */ }
  let archiveAsk = false;
  let accountNames = null;   // account id -> name, from /settings; null until fetched
  const cardErrors = {};
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
    block.appendChild(el('h1', '', t.title || slug() || base(t.project)));
    const where = slug() ? base(t.project) + ' / ' + slug() : base(t.project);
    block.appendChild(el('div', 'meta', [
      where, lead ? 'lead' : '', t.provider === 'gpt' ? 'GPT' : t.provider === 'claude' ? 'Claude' : t.cli, lead && lead.model, t.machine, lead && 'tmux ' + lead.name,
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
    const sessions = el('a', 'btn small', 'Sessions'); sessions.href = '/wheelchair/app/sessions';
    line.appendChild(sessions);
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
  function diagramSource(card) {
    if (thread().archived) {
      return '/wheelchair/?archive=' + encodeURIComponent(id) + '&file=' + encodeURIComponent(card.graph + '.json');
    }
    return '/wheelchair/?path=' + encodeURIComponent(thread().worktree + '/docs/plans/' + card.plan + '/graphs/' + card.graph + '.json');
  }
  function renderFiles() {
    filesEl.textContent = '';
    // Phones have no right column, so the plan files sit under the sticky header instead.
    headFilesEl.textContent = '';
    fileLinks(headFilesEl, 'btn small');
    headFilesEl.hidden = !headFilesEl.children.length;
    const list = el('div', 'file-list');
    fileLinks(list, 'file');
    const pictures = data.cards.filter((c) => c.kind === 'diagram');
    if (pictures.length) {
      list.appendChild(el('span', 'file dim', 'graphs/ \u00b7 ' + pictures.length + (pictures.length === 1 ? ' picture' : ' pictures')));
      for (const c of pictures) {
        const a = el('a', 'file graph', c.title || c.graph); a.href = diagramSource(c); a.target = '_blank'; a.rel = 'noopener';
        list.appendChild(a);
      }
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
        const lead = el('div', 'bubble assistant md');
        window.WCMarkdown.render(it.text, lead);
        chatEl.appendChild(lead);
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
  // What a pressed question or offer shows as its pick: the offer's mapped label, else the value itself.
  function pickedLabel(card) {
    if (card.kind === 'offer') {
      const hit = OFFER_CHOICES.find((c) => c[0] === card.answered_value);
      if (hit) return hit[1];
    }
    return String(card.answered_value);
  }
  function answeredTag(card) {
    if (!card.answered) return null;
    const tag = el('div', 'answered-tag');
    let label = ' Answered';
    if (card.kind === 'needs' && card.resolved_by) {
      label = ' ' + (card.resolved_note || (card.resolved_by === 'collin' ? 'Dismissed' : 'Resolved'));
      tag.classList.add('resolved');
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
    const off = card.answered || thread().archived;
    if (card.answered) box.classList.add('is-answered');
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
      case 'idea': {
        const all = card.bullets || [];
        head(box, 'Your idea so far · ' + all.length + (all.length === 1 ? ' thing' : ' things') + " you've said", 'blue');
        box.appendChild(el('div', 'hint', 'Your words, not the idea doc. Planning writes the doc from these.'));
        const fold = all.length > 3 && !ideaOpen;
        const shown = fold ? all.slice(-2) : all;
        if (fold) box.appendChild(el('div', 'dim fold-note', (all.length - 2) + ' earlier points folded'));
        for (const b of shown) {
          const row = el('div', 'bullet'); row.dataset.bullet = b.id;
          row.appendChild(el('span', 'bullet-text', b.text));
          const rm = button('×', 'x', () => press(card, 'removed', b.text), thread().archived);
          rm.setAttribute('aria-label', 'Remove'); rm.title = 'Remove';
          row.appendChild(rm);
          box.appendChild(row);
        }
        if (all.length > 3) {
          const a = el('div', 'actions');
          a.appendChild(button(ideaOpen ? 'Fold' : 'Show all ' + all.length, 'link', () => {
            ideaOpen = !ideaOpen; sigs.pinned = null; render();
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
          row.appendChild(button('Talk about this', 'small', () => press(card, 'talk', o.finding), thread().archived));
          box.appendChild(row);
        });
        const ready = card.ready || {};
        const r = el('div', 'ready-box');
        const a = el('div', 'actions');
        const sb = button('Start building', 'go', () => press(card, 'start-building'), off || !ready.ok);
        sb.id = 'start-building';
        a.appendChild(sb);
        if (!ready.ok) a.appendChild(button('Re-check', '', () => press(card, 'recheck'), thread().archived));
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
        box.appendChild(r);
        break;
      }
      case 'progress': {
        box.classList.toggle('amber', Boolean(card.choice_waiting));
        box.appendChild(el('span', 'dotmark blue'));
        box.appendChild(el('strong', 'progress-label', 'Building'));
        const total = Math.max(0, Number(card.total) || 0);
        const done = Math.max(0, Math.min(total, Number(card.done) || 0));
        if (total && total <= 24) {
          const bar = el('div', 'segs');
          for (let i = 0; i < total; i += 1) bar.appendChild(el('span', i < done ? 'on' : ''));
          box.appendChild(bar);
        }
        box.appendChild(el('span', 'progress-text', card.done + ' of ' + card.total + ' tasks done'
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
      case 'diagram': {
        const bar = el('div', 'diagram-bar');
        bar.appendChild(el('h3', '', card.title));
        const src = diagramSource(card);
        const link = el('a', 'btn small', 'Open full screen'); link.href = src; link.target = '_blank'; link.rel = 'noopener';
        bar.appendChild(link);
        box.appendChild(bar);
        // An archived thread's worktree is gone: the graph page draws the committed JSON the hub reads from the branch, read-only.
        if (thread().archived) box.appendChild(el('p', 'dim diagram-note', 'Diagram kept on branch ' + (thread().branch || '')));
        const f = el('iframe', 'diagram'); f.src = src; f.title = card.title;
        box.appendChild(f);
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
      default:
        return null;
    }
    if (['offer', 'question', 'approval'].includes(card.kind) || (card.kind === 'needs' && card.resolved_by)) {
      const t = answeredTag(card); if (t) box.appendChild(t);
    }
    if (cardErrors[card.id]) box.appendChild(el('div', 'card-error', 'Could not send: ' + cardErrors[card.id]));
    return box;
  }

  // One short label per pin, for the folded strip.
  function pinLabel(card) {
    if (card.kind === 'offer') return card.answered ? 'Planning offer' : 'Planning offer: needs you';
    if (card.kind === 'idea') {
      const n = (card.bullets || []).length;
      return 'Your idea · ' + n + (n === 1 ? ' thing' : ' things');
    }
    if (card.kind === 'progress') {
      return 'Building ' + card.done + ' of ' + card.total + (card.choice_waiting ? ': choice for you' : '');
    }
    return card.kind;
  }

  function renderPinned() {
    pinnedEl.textContent = '';
    const order = { offer: 0, idea: 1, progress: 2 };
    const pins = data.pinned.filter((c) => c.kind in order).sort((a, b) => order[a.kind] - order[b.kind])
      .map((p) => data.cards.find((c) => c.id === p.id) || p);
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
      const provider = [lead.waiting_provider, lead.provider, thread().provider].find((p) => p === 'claude' || p === 'gpt');
      if (!provider) return 'Waiting for room, about ' + clock(lead.waiting_until);
      const label = provider === 'gpt' ? 'GPT' : 'Claude';
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

  function render() {
    if (!data) return;
    const t = thread();
    document.title = (t.title || slug() || base(t.project)) + ' - thread';
    sync('head', [t.title, t.stub, t.archived, t.worktree, t.branch, t.slug, slug(), archiveAsk, t.pr_url, t.cli, t.machine, t.sessions.map((x) => [x.name, x.live, x.model, x.role])], renderHead);
    sync('files', [t.worktree, slug(), t.archived, data.cards.filter((c) => c.kind === 'diagram')], renderFiles);
    sync('stub', [t.stub, t.sessions.length, t.depends_on_parent, t.ready, t.context, t.parent_pr_url], renderStub);
    sync('wait', [waitingLine(), accountNames], renderWait);
    sync('dead', [t.sessions.map((s) => [s.name, s.live]), t.archived], renderDead);
    sync('pinned', [data.pinned, data.cards.map((c) => [c.answered, c.answered_value]), ideaOpen, pinsFolded, cardErrors], renderPinned);
    const nearBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 80;
    let changed = false;
    sync('chat', [data.items, pending, slug(), data.cards.filter((c) => !PINNED_KINDS.includes(c.kind)), cardErrors], () => { renderChat(); changed = true; });
    const workingEl = $('working');
    const working = leadWorking() && !t.archived;
    if (workingEl.hidden === working) { workingEl.hidden = !working; if (working && nearBottom) changed = true; }
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
  loadAccountNames();
  setInterval(poll, POLL_MS);
})();
