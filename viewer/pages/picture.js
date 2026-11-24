(function () {
  'use strict';
  // The app's full-size picture page: one `diagram` card's picture, or one aside's saved graph,
  // drawn to fill the viewport with a way back to the thread.
  const API = '/wheelchair/api';
  const params = new URLSearchParams(location.search);
  const id = params.get('thread') || '';
  const cardId = params.get('card') || '';
  const asideId = params.get('aside') || '';
  const entry = params.get('entry') || '';
  const $ = (x) => document.getElementById(x);
  const messageEl = $('message'); const pictureEl = $('picture'); const titleEl = $('picture-title');
  if (id) $('back').href = '/wheelchair/app/thread?id=' + encodeURIComponent(id);
  document.title = 'Picture · wheelchair';

  function say(text) { pictureEl.textContent = ''; messageEl.hidden = false; messageEl.textContent = text; }
  function title(text) { titleEl.textContent = text; document.title = text + ' · wheelchair'; }
  const T = () => API + '/threads/' + encodeURIComponent(id);
  function frame(src, name, sandbox) {
    const f = document.createElement('iframe'); f.className = 'picture-frame'; f.src = src; f.title = name;
    if (sandbox) f.setAttribute('sandbox', '');
    pictureEl.appendChild(f);
  }
  async function fetchJson(url, what) {
    const res = await fetch(url);
    if (res.status === 404) throw new Error('This ' + what + ' was not found.');
    if (!res.ok) throw new Error('Could not load this ' + what + ' (status ' + res.status + ').');
    return res.json();
  }

  // The Download button: a PNG drawn in this page for graphs and forms, a plain link for HTML.
  const dlEl = $('download'); const noteEl = $('download-note');
  let busy = false;
  function note(text) { noteEl.hidden = !text; noteEl.textContent = text || ''; }
  function offerPng(name, make, failText) {
    dlEl.hidden = false; dlEl.href = '#'; dlEl.removeAttribute('download');
    dlEl.onclick = async (ev) => {
      ev.preventDefault();
      if (busy) return;
      busy = true; note('');
      try { await window.WCPictureExport.save(await make(), window.WCPictureExport.fileName(titleEl.textContent, name)); }
      catch (e) { note(failText || e.message || 'Could not make the PNG.'); }
      busy = false;
    };
  }
  function graphPng(name) {
    offerPng(name, () => {
      const f = pictureEl.querySelector('iframe.picture-frame');
      return window.WCPictureExport.graphCanvas(f && f.contentDocument);
    });
  }
  // The PNG uses the same fetched value the page drew (the cache entry draw filled), never a new fetch.
  function formPng(cache, key, name) {
    offerPng(name, async () => {
      let value;
      try { value = await cache.get(key); } catch (e) { throw new Error('Could not load this diagram (' + e.message + ').'); }
      return window.WCPictureExport.formCanvas(value);
    });
  }

  // The screenshot view: an image card's file at its natural pixel size, scrolling inside the picture area.
  function showImage(card, thread) {
    title(card.title || 'Screenshot');
    const kept = !thread.archived || (Array.isArray(thread.kept_files) && thread.kept_files.includes(card.file));
    if (!kept) return say('Image removed when the thread was archived');
    messageEl.hidden = true;
    const url = T() + '/files/' + encodeURIComponent(card.file);
    const img = document.createElement('img'); img.className = 'picture-shot'; img.src = url; img.alt = card.title || '';
    pictureEl.appendChild(img);
    dlEl.hidden = false; dlEl.href = url; dlEl.setAttribute('download', card.name || card.file);
  }

  async function showCard() {
    let chat;
    try { chat = await fetchJson(T() + '/chat', 'thread'); } catch (e) { return say(e.message); }
    if (params.get('view') === 'image') {
      const shot = (chat.cards || []).find((c) => c.id === cardId && c.kind === 'image' && c.file && !c.retracted_at);
      return shot ? showImage(shot, chat.thread) : say('This picture was not found in the thread.');
    }
    const card = (chat.cards || []).find((c) => c.id === cardId && (c.kind === 'diagram' || (c.kind === 'image' && c.mockup)));
    if (!card) return say('This picture was not found in the thread.');
    const thread = chat.thread;
    const ctx = { id: id, archived: !!thread.archived, worktree: thread.worktree };
    if (card.kind === 'image' || card.format === 'mockup') {
      const m = card.kind === 'image' ? card.mockup : card;
      if (card.kind === 'image' && !thread.slug) return say('Mockup not found.');
      title(card.kind === 'image' ? 'Mockup: ' + card.title : (card.title || card.graph));
      messageEl.hidden = true;
      const spec = { plan: card.kind === 'image' ? thread.slug : card.plan, graph: m.graph };
      const src = window.WCDiagram.source({ format: 'mockup', plan: spec.plan, graph: spec.graph }, ctx);
      const f = document.createElement('iframe'); f.className = 'picture-mockup'; f.src = src; f.title = titleEl.textContent; f.setAttribute('sandbox', '');
      f.style.width = m.width + 'px'; f.style.height = m.height + 'px';
      pictureEl.appendChild(f);
      const htmlEl = $('download-html'); htmlEl.hidden = false; htmlEl.href = src + '&download=1';
      offerPng(spec.graph, () => window.WCPictureExport.mockupCanvas(src, m.width, m.height),
        'This browser could not make a PNG of this mockup. Download HTML instead.');
      return;
    }
    title(card.title || card.graph);
    messageEl.hidden = true;
    const src = window.WCDiagram.source(card, ctx);
    if (card.format === 'form') { const cache = new Map(); window.WCDiagram.draw(card, pictureEl, ctx, cache); formPng(cache, card.id, card.graph); }
    else {
      frame(src, card.title || card.graph, card.format === 'html');
      if (card.format === 'html') { dlEl.hidden = false; dlEl.href = src + '&download=1'; }
      else graphPng(card.graph);
    }
  }

  async function showAside() {
    let aside;
    try { aside = await fetchJson(T() + '/asides/' + encodeURIComponent(asideId), 'aside'); } catch (e) { return say(e.message); }
    const quote = String((aside.anchor && aside.anchor.quote) || '');
    const item = /^\d+$/.test(entry) ? (aside.history || [])[Number(entry)] : null;
    if (!item || !item.graph) return say('This aside has no picture at that step.');
    title('Aside: ' + quote.slice(0, 40));
    messageEl.hidden = true;
    frame('/wheelchair/?path=' + encodeURIComponent(item.graph), 'Aside diagram', false);
    graphPng('aside');
  }

  if (!id) say('No thread was given.');
  else if (asideId) showAside();
  else if (cardId) showCard();
  else say('No picture was given.');
})();
