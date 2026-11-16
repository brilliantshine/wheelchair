// Playwright tests for the static document page built against the JSON
// contract in docs/plans/remote-viewer/PLAN.md — no real server. Every request
// is intercepted with page.route on a fake origin; the pages themselves are
// read straight off disk, exactly as the real server would serve them.
'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ORIGIN = 'http://viewer.test';

function readFile(name) {
  return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
}

const DOC_HTML = readFile('doc.html');
const DOC_JS = readFile('doc.js');
const MARKDOWN_JS = readFile('pages/markdown.js');

function jsonBody(obj) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify(obj) };
}

// Registers the fixed page/script routes plus whatever dynamic handlers the
// test supplies for /plan and /doc.
async function mockRoutes(page, handlers) {
  await page.route(function (url) { return url.origin === ORIGIN; }, async function (route) {
    const req = route.request();
    const u = new URL(req.url());
    const p = u.pathname;

    if (p === '/wheelchair/docs') return route.fulfill({ status: 200, contentType: 'text/html', body: DOC_HTML });
    if (p === '/wheelchair/assets/pages/markdown.js') return route.fulfill({ status: 200, contentType: 'text/javascript', body: MARKDOWN_JS });
    if (p === '/wheelchair/assets/doc.js') return route.fulfill({ status: 200, contentType: 'text/javascript', body: DOC_JS });

    if (p === '/wheelchair/plan' && handlers.plan) return handlers.plan(route, u);
    if (p === '/wheelchair/doc' && handlers.doc) return handlers.doc(route, u);

    return route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
  });
}

// ---------------------------------------------------------------------------
// The document page
// ---------------------------------------------------------------------------

test.describe('document page', function () {
  const PLAN_DIR = '/abs/repo/docs/plans/remote-viewer';

  function planFixture(files) {
    return { dir: PLAN_DIR, slug: 'remote-viewer', files: files };
  }

  test('default file order: PLAN.md first', async function ({ page }) {
    await mockRoutes(page, {
      plan: function (route) { return route.fulfill(jsonBody(planFixture(['IDEA.md', 'MAP.md', 'PLAN.md']))); },
      doc: function (route, u) {
        const file = u.searchParams.get('file');
        return route.fulfill({ status: 200, contentType: 'text/markdown', body: '# ' + file });
      }
    });
    await page.goto(ORIGIN + '/wheelchair/docs?plan=' + encodeURIComponent(PLAN_DIR));
    await expect(page.locator('#content h1')).toHaveText('PLAN.md');
    await expect(page.locator('nav#files a.current')).toHaveText('PLAN.md');
  });

  test('default file order: IDEA.md when there is no PLAN.md', async function ({ page }) {
    await mockRoutes(page, {
      plan: function (route) { return route.fulfill(jsonBody(planFixture(['IDEA.md', 'MAP.md']))); },
      doc: function (route, u) {
        const file = u.searchParams.get('file');
        return route.fulfill({ status: 200, contentType: 'text/markdown', body: '# ' + file });
      }
    });
    await page.goto(ORIGIN + '/wheelchair/docs?plan=' + encodeURIComponent(PLAN_DIR));
    await expect(page.locator('#content h1')).toHaveText('IDEA.md');
  });

  test('default file order: first entry of files when neither PLAN.md nor IDEA.md exists', async function ({ page }) {
    await mockRoutes(page, {
      plan: function (route) { return route.fulfill(jsonBody(planFixture(['MAP.md', 'notes/a.md']))); },
      doc: function (route, u) {
        const file = u.searchParams.get('file');
        return route.fulfill({ status: 200, contentType: 'text/markdown', body: '# ' + file });
      }
    });
    await page.goto(ORIGIN + '/wheelchair/docs?plan=' + encodeURIComponent(PLAN_DIR));
    await expect(page.locator('#content h1')).toHaveText('MAP.md');
  });

  test('no documents', async function ({ page }) {
    await mockRoutes(page, {
      plan: function (route) { return route.fulfill(jsonBody(planFixture([]))); }
    });
    await page.goto(ORIGIN + '/wheelchair/docs?plan=' + encodeURIComponent(PLAN_DIR));
    await expect(page.locator('#content')).toHaveText('no documents');
  });

  test('a missing file is 404 and shows "not found"', async function ({ page }) {
    await mockRoutes(page, {
      plan: function (route) { return route.fulfill(jsonBody(planFixture(['PLAN.md']))); },
      doc: function (route) { return route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' }); }
    });
    await page.goto(ORIGIN + '/wheelchair/docs?plan=' + encodeURIComponent(PLAN_DIR) + '&file=GONE.md');
    await expect(page.locator('#content')).toHaveText('not found');
  });

  test('frontmatter renders as a key/value block', async function ({ page }) {
    const md = [
      '---',
      'slug: remote-viewer',
      'status: approved   # comment stripped',
      '---',
      '# Title'
    ].join('\n');
    await mockRoutes(page, {
      plan: function (route) { return route.fulfill(jsonBody(planFixture(['PLAN.md']))); },
      doc: function (route) { return route.fulfill({ status: 200, contentType: 'text/markdown', body: md }); }
    });
    await page.goto(ORIGIN + '/wheelchair/docs?plan=' + encodeURIComponent(PLAN_DIR));

    const rows = page.locator('#frontmatter .row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).locator('.key')).toHaveText('slug');
    await expect(rows.nth(0)).toContainText('remote-viewer');
    await expect(rows.nth(1).locator('.key')).toHaveText('status');
    await expect(rows.nth(1)).toContainText('approved');
    // The trailing comment must not survive.
    await expect(rows.nth(1)).not.toContainText('comment stripped');
  });

  test('every listed Markdown feature renders', async function ({ page }) {
    const md = [
      '# Heading one',
      '',
      '## Heading two',
      '',
      'A paragraph with **bold**, *italic*, `inline code` and a '
        + '[link](https://example.com/x).',
      '',
      '- top one',
      '  - nested one',
      '  - nested two',
      '- top two',
      '',
      '1. first',
      '2. second',
      '',
      '| A | B |',
      '| --- | --- |',
      '| a1 | b1 |',
      '| a2 | b2 |',
      '',
      '```mermaid',
      'flowchart TD',
      '  X --> Y',
      '```',
      '',
      '```js',
      'const x = 1;',
      '```'
    ].join('\n');
    await mockRoutes(page, {
      plan: function (route) { return route.fulfill(jsonBody(planFixture(['PLAN.md']))); },
      doc: function (route) { return route.fulfill({ status: 200, contentType: 'text/markdown', body: md }); }
    });
    await page.goto(ORIGIN + '/wheelchair/docs?plan=' + encodeURIComponent(PLAN_DIR));

    await expect(page.locator('#content h1')).toHaveText('Heading one');
    await expect(page.locator('#content h2')).toHaveText('Heading two');
    await expect(page.locator('#content p strong')).toHaveText('bold');
    await expect(page.locator('#content p em')).toHaveText('italic');
    await expect(page.locator('#content p code')).toHaveText('inline code');
    const link = page.locator('#content p a');
    await expect(link).toHaveText('link');
    await expect(link).toHaveAttribute('href', 'https://example.com/x');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');

    // Nested bullet list.
    const topItems = page.locator('#content > ul > li');
    await expect(topItems).toHaveCount(2);
    await expect(topItems.nth(0).locator('> ul > li')).toHaveCount(2);

    // Numbered list.
    await expect(page.locator('#content > ol > li')).toHaveCount(2);

    // Table.
    await expect(page.locator('#content table th')).toHaveCount(2);
    await expect(page.locator('#content table tbody tr')).toHaveCount(2);
    await expect(page.locator('#content table tbody tr').first().locator('td').first()).toHaveText('a1');

    // Mermaid shows as code, not a diagram.
    const codeBlocks = page.locator('#content pre code');
    await expect(codeBlocks).toHaveCount(2);
    await expect(codeBlocks.nth(0)).toContainText('flowchart TD');
    await expect(codeBlocks.nth(1)).toContainText('const x = 1;');
  });

  test('a same-plan link resolves relative to its own document and opens in the page', async function ({ page }) {
    await mockRoutes(page, {
      plan: function (route) { return route.fulfill(jsonBody(planFixture(['PLAN.md', 'notes/a.md', 'notes/b.md']))); },
      doc: function (route, u) {
        const file = u.searchParams.get('file');
        if (file === 'notes/a.md') return route.fulfill({ status: 200, contentType: 'text/markdown', body: '[go](b.md)' });
        if (file === 'notes/b.md') return route.fulfill({ status: 200, contentType: 'text/markdown', body: '# arrived at b' });
        return route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
      }
    });
    await page.goto(ORIGIN + '/wheelchair/docs?plan=' + encodeURIComponent(PLAN_DIR) + '&file=' + encodeURIComponent('notes/a.md'));

    const link = page.locator('#content a');
    await expect(link).toHaveText('go');
    const href = await link.getAttribute('href');
    expect(href).toBe('/wheelchair/docs?plan=' + encodeURIComponent(PLAN_DIR) + '&file=' + encodeURIComponent('notes/b.md'));

    await link.click();
    await expect(page.locator('#content h1')).toHaveText('arrived at b');
    expect(new URL(page.url()).searchParams.get('file')).toBe('notes/b.md');
  });

  test('a `..` escape, a javascript: link and raw HTML are all shown as text, nothing executes', async function ({ page }) {
    const md = [
      '[escape](../../../etc/passwd.md)',
      '',
      '[js](javascript:window.__pwned = true)',
      '',
      '<script>window.__pwned = true;</script>',
      '',
      '<img src="x" onerror="window.__pwned = true">'
    ].join('\n');
    await mockRoutes(page, {
      plan: function (route) { return route.fulfill(jsonBody(planFixture(['PLAN.md']))); },
      doc: function (route) { return route.fulfill({ status: 200, contentType: 'text/markdown', body: md }); }
    });
    await page.goto(ORIGIN + '/wheelchair/docs?plan=' + encodeURIComponent(PLAN_DIR));

    // Neither dangerous "link" produced an anchor.
    await expect(page.locator('#content a')).toHaveCount(0);
    await expect(page.locator('#content')).toContainText('escape');
    await expect(page.locator('#content')).toContainText('js');

    // Raw HTML shows as literal text.
    await expect(page.locator('#content')).toContainText('<script>');
    await expect(page.locator('#content')).toContainText('onerror');
    await expect(page.locator('#content script')).toHaveCount(0);
    await expect(page.locator('#content img')).toHaveCount(0);

    // And nothing ran.
    const pwned = await page.evaluate(function () { return window.__pwned; });
    expect(pwned).toBeUndefined();
  });

  test('a wide table scrolls sideways inside its own box, not the page', async function ({ page }) {
    await page.setViewportSize({ width: 390, height: 800 });
    const cols = ['Column one', 'Column two', 'Column three', 'Column four', 'Column five', 'Column six'];
    const md = '| ' + cols.join(' | ') + ' |\n'
      + '| ' + cols.map(function () { return '---'; }).join(' | ') + ' |\n'
      + '| ' + cols.map(function (c) { return c + ' value that is fairly long'; }).join(' | ') + ' |\n';
    await mockRoutes(page, {
      plan: function (route) { return route.fulfill(jsonBody(planFixture(['PLAN.md']))); },
      doc: function (route) { return route.fulfill({ status: 200, contentType: 'text/markdown', body: md }); }
    });
    await page.goto(ORIGIN + '/wheelchair/docs?plan=' + encodeURIComponent(PLAN_DIR));

    const wrap = page.locator('#content .table-wrap');
    await expect(wrap).toHaveCount(1);
    const overflowsInBox = await wrap.evaluate(function (node) { return node.scrollWidth > node.clientWidth; });
    expect(overflowsInBox).toBe(true);

    const pageOverflow = await page.evaluate(function () {
      return document.documentElement.scrollWidth - document.documentElement.clientWidth;
    });
    expect(pageOverflow).toBeLessThanOrEqual(1);
  });

  test('no horizontal page scroll at 390px wide', async function ({ page }) {
    await page.setViewportSize({ width: 390, height: 800 });
    await mockRoutes(page, {
      plan: function (route) { return route.fulfill(jsonBody(planFixture(['PLAN.md', 'notes/a-fairly-long-file-name-that-could-wrap.md']))); },
      doc: function (route) { return route.fulfill({ status: 200, contentType: 'text/markdown', body: '# A heading\n\nSome ordinary paragraph text.' }); }
    });
    await page.goto(ORIGIN + '/wheelchair/docs?plan=' + encodeURIComponent(PLAN_DIR));
    await expect(page.locator('#content h1')).toHaveText('A heading');

    const overflow = await page.evaluate(function () {
      return document.documentElement.scrollWidth - document.documentElement.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
