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
  function offerPng(name, make) {
    dlEl.hidden = false; dlEl.href = '#'; dlEl.removeAttribute('download');
    dlEl.onclick = async (ev) => {
      ev.preventDefault();
      if (busy) return;
      busy = true; note('');
      try { await window.WCPictureExport.save(await make(), window.WCPictureExport.fileName(titleEl.textContent, name)); }
      catch (e) { note(e.message || 'Could not make the PNG.'); }
      busy = false;
    };
  }
  function graphPng(name) {
    offerPng(name, () => {
      const f = pictureEl.querySelector('iframe.picture-frame');
      return window.WCPictureExport.graphCanvas(f && f.contentDocument);
    });
  }
  function formPng(src, name) {
    offerPng(name, async () => {
      const res = await fetch(src);
      if (!res.ok) throw new Error('Could not load this diagram (status ' + res.status + ').');
      return window.WCPictureExport.formCanvas(await res.json());
    });
  }

  async function showCard() {
    let chat;
    try { chat = await fetchJson(T() + '/chat', 'thread'); } catch (e) { return say(e.message); }
    const card = (chat.cards || []).find((c) => c.id === cardId && c.kind === 'diagram');
    if (!card) return say('This picture was not found in the thread.');
    title(card.title || card.graph);
    const thread = chat.thread;
    messageEl.hidden = true;
    const ctx = { id: id, archived: !!thread.archived, worktree: thread.worktree };
    const src = window.WCDiagram.source(card, ctx);
    if (card.format === 'form') { window.WCDiagram.draw(card, pictureEl, ctx, new Map()); formPng(src, card.graph); }
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
