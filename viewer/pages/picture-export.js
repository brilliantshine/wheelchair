(function () {
  'use strict';
  // PNG export for the picture page: a graph is cloned out of the graph viewer's SVG, a form is
  // drawn onto a canvas from its JSON. Both are 2x, capped at 8192 px a side, saved via a blob URL.
  const MAX = 8192;
  const MARGIN = 24;
  const STYLES = ['fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-width', 'stroke-dasharray', 'opacity',
    'visibility', 'text-transform', 'letter-spacing', 'font-style', 'filter', 'font-family', 'font-size', 'font-weight',
    'text-anchor', 'dominant-baseline'];

  // The scale an export of w x h CSS pixels is drawn at: 2, or less so neither side passes MAX.
  function scaleFor(w, h) { return Math.min(2, MAX / w, MAX / h); }
  function pageBackground() {
    return getComputedStyle(document.body).backgroundColor || '#14161a';
  }
  function fileName(title, fallback) {
    const clean = (s) => String(s || '').replace(/ /g, '-').replace(/[^A-Za-z0-9._-]/g, '').slice(0, 80);
    return (clean(title) || clean(fallback) || 'picture') + '.png';
  }
  function save(canvas, name) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('The picture could not be saved as PNG.'));
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name; a.style.display = 'none';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        resolve(blob);
      }, 'image/png');
    });
  }

  // ---- graph ----
  function graphSvg(doc) {
    const svg = doc && doc.getElementById('canvas');
    if (!svg) return null;
    const groups = Array.from(svg.children).filter((c) => c.tagName.toLowerCase() === 'g');
    const root = groups[groups.length - 1];
    return root && root.childElementCount ? { svg, root } : null;
  }
  function graphCanvas(doc) {
    const found = graphSvg(doc);
    if (!found) throw new Error('The picture is not ready yet.');
    const { svg, root } = found;
    const box = root.getBBox();
    const view = doc.defaultView;
    const live = Array.from(svg.querySelectorAll('*'));
    const clone = svg.cloneNode(true);
    const copies = Array.from(clone.querySelectorAll('*'));
    live.forEach((src, i) => {
      const cs = view.getComputedStyle(src);
      for (const p of STYLES) copies[i].style.setProperty(p, cs.getPropertyValue(p));
    });
    for (const m of clone.querySelectorAll('text.label-metric')) m.remove();
    const cloneGroups = Array.from(clone.children).filter((c) => c.tagName.toLowerCase() === 'g');
    cloneGroups[cloneGroups.length - 1].removeAttribute('transform');
    const w = Math.ceil(box.width + 2 * MARGIN); const h = Math.ceil(box.height + 2 * MARGIN);
    clone.removeAttribute('style'); clone.removeAttribute('data-zoom'); clone.removeAttribute('id');
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('viewBox', [box.x - MARGIN, box.y - MARGIN, box.width + 2 * MARGIN, box.height + 2 * MARGIN].join(' '));
    clone.setAttribute('width', String(w)); clone.setAttribute('height', String(h));
    const text = new XMLSerializer().serializeToString(clone);
    const k = scaleFor(w, h);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * k)); canvas.height = Math.max(1, Math.round(h * k));
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = canvas.getContext('2d');
        c.fillStyle = pageBackground(); c.fillRect(0, 0, canvas.width, canvas.height);
        c.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas);
      };
      img.onerror = () => reject(new Error('The graph could not be drawn to an image.'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
    });
  }

  // ---- forms ----
  const W = 900; const PAD = 24; const GAP = 14; const LH = 1.4;
  function palette() {
    const s = getComputedStyle(document.documentElement);
    const v = (n, d) => s.getPropertyValue(n).trim() || d;
    return { bg: pageBackground(), ink: v('--ink', '#e6e8ec'), ink2: v('--ink-2', '#c5cad3'), dim: v('--dim', '#8b929e'),
      line: v('--line', '#2a2f38'), panel: v('--panel', '#1c1f25') };
  }
  // Lines of text that fit maxW, breaking at spaces and, for a word wider than the line, anywhere.
  function wrap(c, str, maxW) {
    const lines = [];
    for (const para of String(str).split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const trial = line ? line + ' ' + word : word;
        if (c.measureText(trial).width <= maxW) { line = trial; continue; }
        if (line) lines.push(line);
        line = '';
        let rest = word;
        while (c.measureText(rest).width > maxW && rest.length > 1) {
          let n = rest.length - 1;
          while (n > 1 && c.measureText(rest.slice(0, n)).width > maxW) n--;
          lines.push(rest.slice(0, n)); rest = rest.slice(n);
        }
        line = rest;
      }
      lines.push(line);
    }
    return lines;
  }
  // Draws (when draw is true) or only measures a block of wrapped text; returns the y below it.
  function block(c, draw, str, x, y, maxW, size, weight, color) {
    c.font = weight + ' ' + size + 'px system-ui, sans-serif';
    c.fillStyle = color; c.textBaseline = 'top';
    const step = Math.round(size * LH);
    for (const l of wrap(c, str, maxW)) { if (draw) c.fillText(l, x, y); y += step; }
    return y;
  }
  function box(c, draw, x, y, w, h, p) {
    if (!draw) return;
    c.fillStyle = p.panel; c.strokeStyle = p.line; c.lineWidth = 1;
    c.fillRect(x, y, w, h); c.strokeRect(x + .5, y + .5, w - 1, h - 1);
  }
  // A titled card whose body lines are the given strings; returns its height.
  function card(c, draw, p, x, y, w, head, headColor, lines, bullet) {
    const inner = w - 24;
    let yy = y + 12;
    const measure = (d) => {
      let q = y + 12;
      if (head !== undefined) q = block(c, d, head, x + 12, q, inner, 14, 700, headColor || p.ink);
      for (const l of lines) q = block(c, d, bullet ? '• ' + l : l, x + 12, q + 2, inner, 13, 400, p.ink2);
      return q + 12 - y;
    };
    const h = measure(false);
    box(c, draw, x, y, w, h, p);
    if (draw) measure(true);
    return h;
  }
  // The whole form, in the on-screen reading order (diagram.js drawForm). Returns its height.
  function layout(c, draw, value, p) {
    let y = PAD;
    y = block(c, draw, value.explanation, PAD, y, W - 2 * PAD, 14, 400, p.ink) + GAP;
    const full = W - 2 * PAD;
    if (value.form === 'timeline') {
      for (const e of value.events) {
        y += cardWithWhen(c, draw, p, PAD, y, full, e, e.detail !== undefined ? [e.detail] : []) + GAP;
      }
    } else if (value.form === 'layers') {
      for (const e of value.layers) y += card(c, draw, p, PAD, y, full, e.label, p.ink, e.detail !== undefined ? [e.detail] : [], false) + GAP;
    } else if (value.form === 'before-after') {
      const cols = [value.before, value.after];
      cols.forEach((col, i) => {
        if (i === 1) { c.font = '700 20px system-ui, sans-serif'; c.fillStyle = p.dim; c.textBaseline = 'top'; if (draw) c.fillText('↓', W / 2 - 6, y); y += 28; }
        y += card(c, draw, p, PAD, y, full, col.title === undefined ? (i ? 'After' : 'Before') : col.title, p.ink, col.items, true) + GAP;
      });
    } else {
      const cols = value.columns; const cw = (full - GAP * (cols.length - 1)) / cols.length;
      const hs = cols.map((col) => card(c, false, p, 0, 0, cw, col.title, p.ink, col.items, true));
      const hMax = Math.max(...hs);
      cols.forEach((col, i) => {
        const x = PAD + i * (cw + GAP);
        box(c, draw, x, y, cw, hMax, p);
        if (draw) card(c, true, p, x, y, cw, col.title, p.ink, col.items, true);
      });
      y += hMax + GAP;
    }
    return y - GAP + PAD;
  }
  function cardWithWhen(c, draw, p, x, y, w, e, lines) {
    const inner = w - 24;
    const run = (d) => {
      let q = block(c, d, e.when, x + 12, y + 12, inner, 12, 400, p.dim);
      q = block(c, d, e.label, x + 12, q, inner, 14, 700, p.ink);
      for (const l of lines) q = block(c, d, l, x + 12, q + 2, inner, 13, 400, p.ink2);
      return q + 12 - y;
    };
    const h = run(false);
    box(c, draw, x, y, w, h, p);
    if (draw) run(true);
    return h;
  }
  function formCanvas(value) {
    const p = palette();
    const probe = document.createElement('canvas').getContext('2d');
    const h = Math.ceil(layout(probe, false, value, p));
    const k = scaleFor(W, h);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(W * k)); canvas.height = Math.max(1, Math.round(h * k));
    const c = canvas.getContext('2d');
    c.scale(canvas.width / W, canvas.height / h);
    c.fillStyle = p.bg; c.fillRect(0, 0, W, h);
    layout(c, true, value, p);
    return canvas;
  }

  window.WCPictureExport = { fileName, save, graphCanvas, formCanvas, scaleFor };
})();
