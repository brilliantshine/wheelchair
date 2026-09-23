(function () {
  'use strict';

  // ---- URL / params ---------------------------------------------------------

  const params = new URLSearchParams(location.search);
  const token = params.get('token') || '';
  const planDir = params.get('plan') || '';
  const requestedFile = params.get('file') || '';

  function tokenParam() {
    return 'token=' + encodeURIComponent(token);
  }

  function listUrl() {
    return '/?' + tokenParam();
  }

  function docHref(file) {
    return '/docs?plan=' + encodeURIComponent(planDir) + '&file=' + encodeURIComponent(file) + '&' + tokenParam();
  }

  function docFetchUrl(file) {
    return '/doc?plan=' + encodeURIComponent(planDir) + '&file=' + encodeURIComponent(file) + '&' + tokenParam();
  }

  function planFetchUrl() {
    return '/plan?dir=' + encodeURIComponent(planDir) + '&' + tokenParam();
  }

  // ---- DOM handles ------------------------------------------------------------

  const backLink = document.getElementById('back-link');
  const titleEl = document.getElementById('doc-title');
  const fileListEl = document.getElementById('file-list');
  const errorBanner = document.getElementById('error-banner');
  const frontmatterEl = document.getElementById('frontmatter');
  const contentEl = document.getElementById('content');

  backLink.href = listUrl();

  function el(tag, attrs) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const key in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, key)) continue;
        if (key === 'class') node.className = attrs[key];
        else if (key === 'text') node.textContent = attrs[key];
        else node.setAttribute(key, attrs[key]);
      }
    }
    return node;
  }

  function showError(msg) {
    errorBanner.hidden = false;
    errorBanner.textContent = msg;
  }

  function clearError() {
    errorBanner.hidden = true;
    errorBanner.textContent = '';
  }

  // ---- Markdown parsing -------------------------------------------------------
  //
  // A small hand-rolled parser covering exactly what the workflow's documents use:
  // YAML-ish frontmatter, ATX headings, paragraphs, bullet/numbered lists (nested
  // by indentation), GitHub-style pipe tables, fenced and inline code, bold,
  // italic and links. No dependency, and the renderer below never assigns to
  // innerHTML — every bit of document text reaches the DOM through textContent.

  function isBlank(line) {
    return line.trim() === '';
  }

  function leadingSpaces(line) {
    const m = line.match(/^( *)/);
    return m[1].length;
  }

  function matchListItem(line) {
    const m = line.match(/^( *)([-*+]|\d+[.)])[ \t]+(.*)$/);
    if (!m) return null;
    const contentStart = line.length - m[3].length;
    return { indent: m[1].length, ordered: /^\d/.test(m[2]), content: m[3], contentStart };
  }

  function isFence(line) {
    return line.match(/^( *)(`{3,}|~{3,})(.*)$/);
  }

  function isTableSeparator(line) {
    const trimmed = line.trim();
    if (!trimmed) return false;
    return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/.test(trimmed) && trimmed.indexOf('-') !== -1;
  }

  function splitTableRow(line) {
    let trimmed = line.trim();
    if (trimmed.charAt(0) === '|') trimmed = trimmed.slice(1);
    if (trimmed.charAt(trimmed.length - 1) === '|') trimmed = trimmed.slice(0, -1);
    return trimmed.split('|').map(function (c) { return c.trim(); });
  }

  function parseList(lines, startIdx, indent) {
    const items = [];
    let ordered = false;
    let sawFirst = false;
    let i = startIdx;

    while (i < lines.length) {
      if (isBlank(lines[i])) {
        let j = i;
        while (j < lines.length && isBlank(lines[j])) j++;
        if (j >= lines.length) { i = j; break; }
        const peek = matchListItem(lines[j]);
        // A blank line followed by a different marker type (bullet vs. numbered)
        // starts a new list, not a continuation of this one.
        if (!peek || peek.indent < indent || (sawFirst && peek.ordered !== ordered)) { i = j; break; }
        i = j;
        continue;
      }

      const info = matchListItem(lines[i]);
      if (!info || info.indent < indent) break;
      if (info.indent > indent) break; // consumed by a nested call instead
      if (sawFirst && info.ordered !== ordered) break; // marker type changed: new list

      if (!sawFirst) { ordered = info.ordered; sawFirst = true; }

      let text = info.content.trim();
      i++;
      const children = [];

      while (i < lines.length) {
        if (isBlank(lines[i])) {
          let j = i;
          while (j < lines.length && isBlank(lines[j])) j++;
          if (j >= lines.length) { i = j; break; }
          const peek = matchListItem(lines[j]);
          if (peek && peek.indent > indent) { i = j; continue; }
          if (!peek && leadingSpaces(lines[j]) > indent) { i = j; continue; }
          break;
        }
        const inner = matchListItem(lines[i]);
        if (inner && inner.indent > indent) {
          const res = parseList(lines, i, inner.indent);
          children.push(res.node);
          i = res.next;
          continue;
        }
        if (!inner && leadingSpaces(lines[i]) > indent) {
          text += ' ' + lines[i].trim();
          i++;
          continue;
        }
        break;
      }

      items.push({ text: text, children: children });
    }

    return { node: { type: 'list', ordered: ordered, items: items }, next: i };
  }

  function parseBlocks(lines) {
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
      if (isBlank(lines[i])) { i++; continue; }
      const line = lines[i];

      const fence = isFence(line);
      if (fence) {
        const fenceChar = fence[2].charAt(0);
        const fenceLen = fence[2].length;
        const lang = fence[3].trim();
        const closeRe = new RegExp('^ *' + (fenceChar === '`' ? '`' : '~') + '{' + fenceLen + ',} *$');
        const codeLines = [];
        i++;
        while (i < lines.length && !closeRe.test(lines[i])) { codeLines.push(lines[i]); i++; }
        if (i < lines.length) i++; // consume closing fence
        blocks.push({ type: 'code', lang: lang, text: codeLines.join('\n') });
        continue;
      }

      const heading = line.match(/^(#{1,6})[ \t]+(.*)$/);
      if (heading) {
        blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].replace(/\s+#+\s*$/, '') });
        i++;
        continue;
      }

      if (line.indexOf('|') !== -1 && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
        const header = splitTableRow(line);
        i += 2;
        const rows = [];
        while (i < lines.length && !isBlank(lines[i]) && lines[i].indexOf('|') !== -1) {
          rows.push(splitTableRow(lines[i]));
          i++;
        }
        blocks.push({ type: 'table', header: header, rows: rows });
        continue;
      }

      const listInfo = matchListItem(line);
      if (listInfo) {
        const res = parseList(lines, i, listInfo.indent);
        blocks.push(res.node);
        i = res.next;
        continue;
      }

      const paraLines = [];
      while (i < lines.length && !isBlank(lines[i]) && !isFence(lines[i]) &&
             !/^#{1,6}[ \t]+/.test(lines[i]) && !matchListItem(lines[i]) &&
             !(lines[i].indexOf('|') !== -1 && i + 1 < lines.length && isTableSeparator(lines[i + 1]))) {
        paraLines.push(lines[i].trim());
        i++;
      }
      blocks.push({ type: 'paragraph', text: paraLines.join(' ') });
    }

    return blocks;
  }

  function parseFrontmatter(lines) {
    if (lines[0] !== '---') return { frontmatter: null, bodyStart: 0 };
    let end = -1;
    for (let j = 1; j < lines.length; j++) {
      if (lines[j] === '---') { end = j; break; }
    }
    if (end === -1) return { frontmatter: null, bodyStart: 0 };
    const pairs = [];
    for (let j = 1; j < end; j++) {
      const line = lines[j];
      if (isBlank(line)) continue;
      const m = line.match(/^([^\s:][^:]*):[ \t]?(.*)$/);
      if (!m) continue;
      let value = m[2];
      value = value.replace(/\s+#.*$/, '').trim();
      pairs.push([m[1].trim(), value]);
    }
    return { frontmatter: pairs, bodyStart: end + 1 };
  }

  function parseMarkdown(raw) {
    const lines = raw.replace(/\r\n/g, '\n').split('\n');
    const fm = parseFrontmatter(lines);
    const bodyLines = lines.slice(fm.bodyStart);
    const blocks = parseBlocks(bodyLines);
    return { frontmatter: fm.frontmatter, blocks: blocks };
  }

  // ---- link resolution ---------------------------------------------------------

  function dirname(file) {
    const idx = file.lastIndexOf('/');
    return idx === -1 ? '' : file.slice(0, idx);
  }

  function resolveRelativePath(baseDir, target) {
    const stack = baseDir === '' ? [] : baseDir.split('/');
    const parts = target.split('/');
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === '' || part === '.') continue;
      if (part === '..') {
        if (stack.length === 0) return null;
        stack.pop();
      } else {
        stack.push(part);
      }
    }
    return stack.join('/');
  }

  function resolveLink(href, ctx) {
    if (!href) return null;
    if (/^https?:\/\//i.test(href)) return { href: href, external: true };
    // Any other URL scheme (javascript:, data:, mailto:, ...) is never a live link.
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) return null;
    if (href.charAt(0) === '/') return null; // not a relative path within the plan

    const hashIdx = href.indexOf('#');
    const clean = hashIdx === -1 ? href : href.slice(0, hashIdx);
    if (!clean) return null;

    const baseDir = dirname(ctx.currentFile);
    const resolved = resolveRelativePath(baseDir, clean);
    if (resolved === null || !resolved.endsWith('.md')) return null;

    return {
      href: docHref(resolved),
      external: false
    };
  }

  // ---- inline rendering ---------------------------------------------------------

  const INLINE_RE = /`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|\[([^\]]*)\]\(([^)]*)\)/g;

  function appendLink(container, linkText, href, ctx) {
    const resolved = resolveLink(href, ctx);
    if (!resolved) {
      container.appendChild(document.createTextNode(linkText));
      return;
    }
    const a = document.createElement('a');
    a.href = resolved.href;
    if (resolved.external) a.setAttribute('rel', 'noopener noreferrer');
    a.textContent = linkText;
    container.appendChild(a);
  }

  function renderInline(text, container, ctx) {
    INLINE_RE.lastIndex = 0;
    let lastIndex = 0;
    let m;
    while ((m = INLINE_RE.exec(text)) !== null) {
      if (m.index > lastIndex) container.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
      if (m[1] !== undefined) {
        const code = document.createElement('code');
        code.textContent = m[1];
        container.appendChild(code);
      } else if (m[2] !== undefined || m[3] !== undefined) {
        const strong = document.createElement('strong');
        strong.textContent = m[2] !== undefined ? m[2] : m[3];
        container.appendChild(strong);
      } else if (m[4] !== undefined || m[5] !== undefined) {
        const em = document.createElement('em');
        em.textContent = m[4] !== undefined ? m[4] : m[5];
        container.appendChild(em);
      } else if (m[6] !== undefined) {
        appendLink(container, m[6], m[7], ctx);
      }
      lastIndex = INLINE_RE.lastIndex;
      if (m[0].length === 0) INLINE_RE.lastIndex++; // guard against zero-length matches
    }
    if (lastIndex < text.length) container.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  // ---- block rendering ---------------------------------------------------------

  function renderListItems(items, list, ctx) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const li = document.createElement('li');
      renderInline(item.text, li, ctx);
      for (let j = 0; j < item.children.length; j++) renderBlock(item.children[j], li, ctx);
      list.appendChild(li);
    }
  }

  function renderBlock(block, container, ctx) {
    if (block.type === 'heading') {
      const h = document.createElement('h' + Math.min(Math.max(block.level, 1), 6));
      renderInline(block.text, h, ctx);
      container.appendChild(h);
    } else if (block.type === 'paragraph') {
      if (!block.text.trim()) return;
      const p = document.createElement('p');
      renderInline(block.text, p, ctx);
      container.appendChild(p);
    } else if (block.type === 'code') {
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      if (block.lang) code.setAttribute('data-lang', block.lang);
      code.textContent = block.text;
      pre.appendChild(code);
      container.appendChild(pre);
    } else if (block.type === 'list') {
      const list = document.createElement(block.ordered ? 'ol' : 'ul');
      renderListItems(block.items, list, ctx);
      container.appendChild(list);
    } else if (block.type === 'table') {
      const wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      const table = document.createElement('table');
      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      for (let i = 0; i < block.header.length; i++) {
        const th = document.createElement('th');
        renderInline(block.header[i], th, ctx);
        headRow.appendChild(th);
      }
      thead.appendChild(headRow);
      table.appendChild(thead);
      const tbody = document.createElement('tbody');
      for (let r = 0; r < block.rows.length; r++) {
        const tr = document.createElement('tr');
        const row = block.rows[r];
        for (let c = 0; c < row.length; c++) {
          const td = document.createElement('td');
          renderInline(row[c], td, ctx);
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      wrap.appendChild(table);
      container.appendChild(wrap);
    }
  }

  function renderMarkdown(raw, file) {
    const parsed = parseMarkdown(raw);
    const ctx = { planDir: planDir, currentFile: file, token: token };

    frontmatterEl.textContent = '';
    if (parsed.frontmatter && parsed.frontmatter.length) {
      frontmatterEl.hidden = false;
      for (let i = 0; i < parsed.frontmatter.length; i++) {
        const row = document.createElement('div');
        row.className = 'row';
        const key = document.createElement('span');
        key.className = 'key';
        key.textContent = parsed.frontmatter[i][0];
        const val = document.createElement('span');
        val.textContent = parsed.frontmatter[i][1];
        row.appendChild(key);
        row.appendChild(val);
        frontmatterEl.appendChild(row);
      }
    } else {
      frontmatterEl.hidden = true;
    }

    contentEl.textContent = '';
    for (let i = 0; i < parsed.blocks.length; i++) renderBlock(parsed.blocks[i], contentEl, ctx);
  }

  // ---- file list / navigation ---------------------------------------------------

  function pickDefaultFile(files) {
    if (files.indexOf('PLAN.md') !== -1) return 'PLAN.md';
    if (files.indexOf('IDEA.md') !== -1) return 'IDEA.md';
    if (files.length) return files[0]; // already byte-ordered by the server
    return null;
  }

  function renderFileList(files, current) {
    fileListEl.textContent = '';
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const li = document.createElement('li');
      const a = el('a', { href: docHref(f), text: f });
      if (f === current) a.className = 'current';
      li.appendChild(a);
      fileListEl.appendChild(li);
    }
  }

  // ---- loading ---------------------------------------------------------------

  async function loadDoc(file) {
    clearError();
    contentEl.textContent = '';
    frontmatterEl.hidden = true;
    try {
      const res = await fetch(docFetchUrl(file));
      if (res.status === 404) {
        contentEl.appendChild(el('p', { text: 'not found' }));
        return;
      }
      if (!res.ok) {
        showError('Could not load this document (status ' + res.status + ').');
        return;
      }
      const text = await res.text();
      renderMarkdown(text, file);
    } catch (err) {
      showError('Could not load this document.');
    }
  }

  async function loadPlan() {
    let planData;
    try {
      const res = await fetch(planFetchUrl());
      if (!res.ok) {
        showError('Could not load this plan (status ' + res.status + ').');
        return;
      }
      planData = await res.json();
    } catch (err) {
      showError('Could not load this plan.');
      return;
    }

    const files = (planData && planData.files) || [];
    titleEl.textContent = (planData && planData.slug) || planDir;

    if (!files.length) {
      renderFileList(files, null);
      contentEl.textContent = '';
      contentEl.appendChild(el('p', { id: 'empty-doc', text: 'no documents' }));
      return;
    }

    const file = requestedFile || pickDefaultFile(files);
    renderFileList(files, file);
    if (file) await loadDoc(file);
  }

  loadPlan();
})();
