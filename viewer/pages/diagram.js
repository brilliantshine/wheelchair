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
    if (card.format === 'form' || card.format === 'html' || card.format === 'mockup') {
      const html = card.format !== 'form';
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
  function fileKey(card) { return card.plan + '/' + card.graph + (card.format === 'html' || card.format === 'mockup' ? '.html' : '.json'); }
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
  // A mockup: the screen's HTML in an iframe at its true width x height, scaled down (never up) to fit
  // the box's width, so the whole screen shows with no inner scrolling. spec is {plan, graph, width, height, title}.
  function mockup(spec, box, ctx) {
    const src = source({ format: 'mockup', plan: spec.plan, graph: spec.graph }, ctx);
    const frame = el('div', 'mockup-box');
    frame.style.aspectRatio = spec.width + ' / ' + spec.height; // final height from the first paint
    frame.style.maxWidth = spec.width + 'px'; // the border marks the screen's own edge, not the card's
    const f = el('iframe', 'mockup-frame'); f.src = src; f.title = spec.title || spec.graph; f.setAttribute('sandbox', '');
    f.style.width = spec.width + 'px'; f.style.height = spec.height + 'px'; f.scrolling = 'no';
    frame.appendChild(f); box.appendChild(frame);
    const fit = () => {
      const s = Math.min(1, frame.clientWidth / spec.width);
      if (!(s > 0)) return;
      f.style.transform = 'scale(' + s + ')';
    };
    fit();
    if (typeof ResizeObserver === 'function') new ResizeObserver(fit).observe(frame);
    return frame;
  }
  // ---- Comment on a spot (mockups only) ----
  // The text a spot comment is sent as. `plan` and `graph` name the mockup's file, which carries its version.
  function spotText(spec, x, y, comment) {
    return 'Comment on mockup "' + spec.title + '" (docs/plans/' + spec.plan + '/graphs/' + spec.graph + '.html, ' + spec.width + 'x' + spec.height
      + ') at x=' + x + ', y=' + y + ': ' + comment;
  }
  // Open drafts live here, outside any card's DOM: key (card id + mockup file) -> {x, y, text, pending, error, paint}.
  // A redrawn card binds its new node to the same draft, so a replaced node shows it intact.
  const drafts = new Map();
  // Adds the comment layer, pin and box to a drawn mockup. `host` is the element holding the mockup (position:relative),
  // `after` the element the box goes under. opts: {key, send(text) -> Promise, canSend() -> bool, onSent(), inset}.
  // Returns the "Comment on a spot" button for the caller to place beside Open full size.
  function spot(host, after, spec, opts) {
    let d = drafts.get(opts.key);
    const btn = el('button', 'btn small spot-btn', 'Comment on a spot'); btn.type = 'button';
    btn.style.visibility = opts.canSend() ? '' : 'hidden';
    const layer = el('div', 'spot-layer'); layer.hidden = true; if (opts.inset) layer.classList.add('inset');
    const pin = el('div', 'spot-pin'); pin.hidden = true; layer.appendChild(pin);
    host.appendChild(layer);
    const panel = el('div', 'spot-box'); panel.hidden = true;
    const hint = el('p', 'dim spot-hint', 'Tap the spot on the mockup.');
    const text = el('textarea', 'spot-text'); text.rows = 3; text.placeholder = 'Your comment on this spot'; text.setAttribute('aria-label', 'Comment on this spot');
    const row = el('div', 'actions');
    const send = el('button', 'btn small primary', 'Send'); send.type = 'button';
    const cancel = el('button', 'btn small', 'Cancel'); cancel.type = 'button';
    const err = el('span', 'spot-error'); err.setAttribute('role', 'alert');
    row.append(send, cancel, err);
    panel.append(hint, text, row);
    after.after(panel);
    function paint() {
      const on = !!(d && d.active);
      layer.hidden = !on; panel.hidden = !on;
      if (!on) { pin.hidden = true; return; }
      const placed = d.x !== null;
      pin.hidden = !placed;
      if (placed) { pin.style.left = (d.x / spec.width * 100) + '%'; pin.style.top = (d.y / spec.height * 100) + '%'; }
      hint.hidden = placed; text.hidden = !placed; send.hidden = !placed;
      if (text.value !== d.text) text.value = d.text;
      text.disabled = send.disabled = cancel.disabled = d.pending;
      if (!d.pending && !d.text.trim()) send.disabled = true;
      layer.classList.toggle('pending', d.pending);
      err.textContent = d.error || '';
    }
    if (d) d.paint = paint;
    btn.addEventListener('click', () => {
      if (d && d.active) return;
      d = { active: true, x: null, y: null, text: '', pending: false, error: '', paint }; drafts.set(opts.key, d); paint();
    });
    layer.addEventListener('click', (ev) => {
      if (!d || d.pending) return;
      const r = layer.getBoundingClientRect();
      const s = Math.min(1, r.width / spec.width);
      if (!(s > 0)) return;
      const clamp = (v, max) => Math.max(0, Math.min(max - 1, Math.round(v)));
      d.x = clamp((ev.clientX - r.left) / s, spec.width); d.y = clamp((ev.clientY - r.top) / s, spec.height); d.error = '';
      paint();
      if (panel.scrollIntoView) panel.scrollIntoView({ block: 'nearest' });
    });
    text.addEventListener('input', () => { if (!d) return; d.text = text.value; send.disabled = d.pending || !d.text.trim(); });
    cancel.addEventListener('click', () => { if (!d || d.pending) return; drafts.delete(opts.key); d.active = false; paint(); });
    send.addEventListener('click', async () => {
      const mine = d; const comment = mine && mine.text.trim();
      if (!mine || mine.pending || !comment || mine.x === null) return;
      mine.pending = true; mine.error = ''; mine.paint();
      try {
        await opts.send(spotText(spec, mine.x, mine.y, comment));
        drafts.delete(opts.key); mine.active = false; mine.pending = false; mine.paint();
        if (opts.onSent) opts.onSent();
      } catch (e) { mine.pending = false; mine.error = 'Comment not sent: ' + (e && e.message ? e.message : String(e)); mine.paint(); }
    });
    paint();
    return btn;
  }
  // The picture itself, as a card draws it: a form, or an iframe (html sandboxed).
  function draw(card, box, ctx, cache, frameClass) {
    const src = source(card, ctx);
    if (card.format === 'form') formInto(box, src, cache, card.id);
    else if (card.format === 'mockup') mockup({ plan: card.plan, graph: card.graph, width: card.width, height: card.height, title: card.title }, box, ctx);
    else {
      const f = el('iframe', frameClass || 'diagram'); f.src = src; f.title = card.title;
      if (card.format === 'html') f.setAttribute('sandbox', '');
      box.appendChild(f);
    }
  }
  window.WCDiagram = { source, fileKey, mockup, spot, drawForm, formInto, draw };
})();
