(function () {
  'use strict';
  // A small Markdown renderer for chat. Agent text is untrusted, so every node is built with
  // createElement and textContent; nothing here ever assigns innerHTML. Supported: paragraphs,
  // headings (as bold lines), **bold**, *italic*, `code`, fenced code blocks, [links](url),
  // and bullet and numbered lists. Anything else stays as literal text.

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  // Only http(s) and relative links become anchors. A scheme-less string is relative, but control
  // characters are stripped by the URL parser (java<tab>script:), and a backslash can turn into
  // a slash, so neither is allowed through.
  function safeHref(url) {
    const u = String(url);
    // eslint-disable-next-line no-control-regex
    if (/[\u0000- \u007f\\]/.test(u)) return null;
    if (/^https?:\/\/[^/]/i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return null;
    if (u.startsWith('//')) return null;
    return u;
  }

  const INLINE_SOURCE = [
    '`([^`\\n]+)`',                                   // 1 code
    '\\*\\*(?=\\S)(.+?)(?<=\\S)\\*\\*',               // 2 bold
    '(?<![*\\w])\\*(?=[^\\s*])([^*\\n]+?)(?<=[^\\s*])\\*(?![*\\w])', // 3 italic
    '(?<![\\w_])_(?=[^\\s_])([^_\\n]+?)(?<=[^\\s_])_(?![\\w_])',      // 4 italic
    '\\[([^\\]\\n]+)\\]\\(([^)\\s]+)\\)',            // 5 link text, 6 href
  ].join('|');

  function inline(text, parent, depth) {
    const s = String(text == null ? '' : text);
    const level = depth || 0;
    let last = 0;
    // One regex per call: the recursion below must not share a lastIndex.
    const pattern = new RegExp(INLINE_SOURCE, 'g');
    let m;
    while ((m = pattern.exec(s))) {
      if (m.index > last) parent.appendChild(document.createTextNode(s.slice(last, m.index)));
      last = m.index + m[0].length;
      if (m[1] !== undefined) {
        parent.appendChild(el('code', '', m[1]));
      } else if (m[2] !== undefined) {
        const b = el('strong'); if (level < 4) inline(m[2], b, level + 1); else b.textContent = m[2];
        parent.appendChild(b);
      } else if (m[3] !== undefined || m[4] !== undefined) {
        const i = el('em'); const body = m[3] !== undefined ? m[3] : m[4];
        if (level < 4) inline(body, i, level + 1); else i.textContent = body;
        parent.appendChild(i);
      } else {
        const href = safeHref(m[6]);
        if (href === null) {
          parent.appendChild(document.createTextNode(m[5]));
        } else {
          const a = el('a');
          a.href = href;
          a.rel = 'noopener';
          if (/^https?:/i.test(href)) a.target = '_blank';
          if (level < 4) inline(m[5], a, level + 1); else a.textContent = m[5];
          parent.appendChild(a);
        }
      }
    }
    if (last < s.length) parent.appendChild(document.createTextNode(s.slice(last)));
    return parent;
  }

  // Lines of one paragraph keep their breaks.
  function lines(text, parent) {
    const parts = text.split('\n');
    parts.forEach((part, i) => {
      if (i) parent.appendChild(document.createElement('br'));
      inline(part, parent);
    });
    return parent;
  }

  const FENCE = /^\s{0,3}```+\s*([\w+-]*)\s*$/;
  const ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
  const HEADING = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/;

  function render(text, parent) {
    const rows = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
    let i = 0;
    while (i < rows.length) {
      const row = rows[i];
      if (!row.trim()) { i += 1; continue; }

      const fence = row.match(FENCE);
      if (fence) {
        const body = [];
        i += 1;
        while (i < rows.length && !FENCE.test(rows[i])) { body.push(rows[i]); i += 1; }
        i += 1; // the closing fence, or the end of an unclosed one
        const pre = el('pre', 'md-code');
        const code = el('code', '', body.join('\n'));
        if (fence[1]) code.dataset.lang = fence[1];
        pre.appendChild(code);
        parent.appendChild(pre);
        continue;
      }

      const item = row.match(ITEM);
      if (item) {
        const ordered = /\d/.test(item[2]);
        const list = el(ordered ? 'ol' : 'ul', 'md-list');
        const entries = [];
        while (i < rows.length) {
          const next = rows[i].match(ITEM);
          if (next && /\d/.test(next[2]) === ordered) {
            entries.push({ li: list.appendChild(el('li')), text: [next[3]] });
            i += 1;
          } else if (entries.length && rows[i].trim() && /^\s+\S/.test(rows[i]) && !next) {
            entries[entries.length - 1].text.push(rows[i].trim());
            i += 1;
          } else break;
        }
        for (const entry of entries) lines(entry.text.join('\n'), entry.li);
        parent.appendChild(list);
        continue;
      }

      const heading = row.match(HEADING);
      if (heading) {
        const p = el('p', 'md-head');
        const strong = el('strong');
        inline(heading[1], strong);
        p.appendChild(strong);
        parent.appendChild(p);
        i += 1;
        continue;
      }

      const para = [];
      while (i < rows.length && rows[i].trim() && !FENCE.test(rows[i]) && !ITEM.test(rows[i]) && !HEADING.test(rows[i])) {
        para.push(rows[i]);
        i += 1;
      }
      parent.appendChild(lines(para.join('\n'), el('p')));
    }
    return parent;
  }

  window.WCMarkdown = { render, inline: (text, parent) => inline(text, parent, 0), safeHref };
})();
