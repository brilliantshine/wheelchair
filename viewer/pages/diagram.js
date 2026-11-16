(function () {
  'use strict';
  // How a `diagram` card's picture is found and drawn, shared by the thread page (inline in the
  // card) and the picture page (full size). ctx is {id, archived, worktree}.
  const API = '/wheelchair/api';
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function source(card, ctx) {
    const T = API + '/threads/' + encodeURIComponent(ctx.id);
    if (card.format === 'form' || card.format === 'html') {
      const html = card.format === 'html';
      const file = card.graph + (html ? '.html' : '.json');
      if (ctx.archived) return T + (html ? '/diagram-html?file=' : '/graph?file=') + encodeURIComponent(file);
      const path = ctx.worktree + '/docs/plans/' + card.plan + '/graphs/' + file;
      return '/wheelchair/diagram-' + (html ? 'html' : 'form') + '?path=' + encodeURIComponent(path);
    }
    if (ctx.archived) {
      return '/wheelchair/?archive=' + encodeURIComponent(ctx.id) + '&file=' + encodeURIComponent(card.graph + '.json');
    }
    return '/wheelchair/?path=' + encodeURIComponent(ctx.worktree + '/docs/plans/' + card.plan + '/graphs/' + card.graph + '.json');
  }
  // The file a card draws, the key pictures are deduplicated by.
  function fileKey(card) { return card.plan + '/' + card.graph + (card.format === 'html' ? '.html' : '.json'); }
  function drawForm(value) {
    const str = (v) => typeof v === 'string';
    const optional = (v) => v === undefined || str(v);
    const items = (v) => Array.isArray(v) && v.every(str);
    if (!value || typeof value !== 'object' || !str(value.explanation)) throw new Error('Expected an explanation string');
    const out = el('div', 'diagram-form');
    out.appendChild(el('p', 'form-explanation', value.explanation));
    const body = el('div', 'form-body form-' + value.form);
    if (value.form === 'timeline') {
      if (!Array.isArray(value.events) || !value.events.length || !value.events.every((e) => e && str(e.when) && str(e.label) && optional(e.detail))) throw new Error('Invalid timeline events');
      for (const e of value.events) {
        const row = el('div', 'form-event'); row.append(el('div', 'form-when', e.when), el('strong', '', e.label));
        if (e.detail !== undefined) row.appendChild(el('div', 'form-detail', e.detail)); body.appendChild(row);
      }
    } else if (value.form === 'layers') {
      if (!Array.isArray(value.layers) || !value.layers.length || !value.layers.every((e) => e && str(e.label) && optional(e.detail))) throw new Error('Invalid layers');
      for (const e of value.layers) { const row = el('div', 'form-layer'); row.appendChild(el('strong', '', e.label)); if (e.detail !== undefined) row.appendChild(el('div', 'form-detail', e.detail)); body.appendChild(row); }
    } else if (value.form === 'before-after' || value.form === 'side-by-side') {
      const cols = value.form === 'before-after' ? [value.before, value.after] : value.columns;
      if (!Array.isArray(cols) || (value.form === 'side-by-side' && (cols.length < 2 || cols.length > 4)) || !cols.every((c) => c && items(c.items) && (value.form === 'side-by-side' ? str(c.title) : optional(c.title)))) throw new Error('Invalid columns');
      cols.forEach((c, i) => {
        if (i === 1 && value.form === 'before-after') body.appendChild(el('div', 'form-arrow', '↓'));
        const col = el('div', 'form-column'); col.appendChild(el('strong', '', c.title === undefined ? (i ? 'After' : 'Before') : c.title));
        const ul = el('ul'); c.items.forEach((item) => ul.appendChild(el('li', '', item))); col.appendChild(ul); body.appendChild(col);
      });
    } else throw new Error('Missing or unknown form');
    out.appendChild(body); return out;
  }
  // Draws a form picture into box; cache (a Map) shares one fetch per key across redraws.
  function formInto(box, src, cache, key) {
    const target = el('div', 'form-content'); box.appendChild(target);
    if (!cache.has(key)) {
      const promise = fetch(src).then(async (res) => {
        if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error || 'HTTP ' + res.status); }
        return res.json();
      });
      cache.set(key, promise);
    }
    cache.get(key).then((value) => { target.appendChild(drawForm(value)); }).catch((e) => {
      target.append(el('strong', '', 'This diagram could not be drawn'), el('div', 'form-detail', e.message));
    });
  }
  // The picture itself, as a card draws it: a form, or an iframe (html sandboxed).
  function draw(card, box, ctx, cache, frameClass) {
    const src = source(card, ctx);
    if (card.format === 'form') formInto(box, src, cache, card.id);
    else {
      const f = el('iframe', frameClass || 'diagram'); f.src = src; f.title = card.title;
      if (card.format === 'html') f.setAttribute('sandbox', '');
      box.appendChild(f);
    }
  }
  window.WCDiagram = { source, fileKey, drawForm, formInto, draw };
})();
