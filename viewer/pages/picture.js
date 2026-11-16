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

  async function showCard() {
    let chat;
    try { chat = await fetchJson(T() + '/chat', 'thread'); } catch (e) { return say(e.message); }
    const card = (chat.cards || []).find((c) => c.id === cardId && c.kind === 'diagram');
    if (!card) return say('This picture was not found in the thread.');
    title(card.title || card.graph);
    const thread = chat.thread;
    messageEl.hidden = true;
    const ctx = { id: id, archived: !!thread.archived, worktree: thread.worktree };
    if (card.format === 'form') window.WCDiagram.draw(card, pictureEl, ctx, new Map());
    else frame(window.WCDiagram.source(card, ctx), card.title || card.graph, card.format === 'html');
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
  }

  if (!id) say('No thread was given.');
  else if (asideId) showAside();
  else if (cardId) showCard();
  else say('No picture was given.');
})();
