'use strict';

// The app pages' routing (docs/plans/app-shell, "Views"): viewer/pages/<page>.html behind the
// remember cookie, and narrow public asset names under pages/ and vendor/.
const assert = require('node:assert/strict');
const test = require('node:test');

const { withServer } = require('./helpers/server');

test('an app page without the remember cookie gets the sign-in page', async () => {
  await withServer({}, async (ctx) => {
    const response = await fetch(`${ctx.url}/app/threads`);
    assert.equal(response.status, 401);
  });
});

test('the bookmark token signs a new browser in on an app page, and a wrong one does not', async () => {
  await withServer({}, async (ctx) => {
    const signin = await fetch(`${ctx.url}/app/threads?token=${ctx.token}&id=t1`, { redirect: 'manual' });
    assert.equal(signin.status, 303);
    assert.equal(signin.headers.get('location'), '/wheelchair/app/threads?id=t1');
    const cookie = signin.headers.get('set-cookie').split(';')[0];
    const page = await fetch(`${ctx.url}/app/threads?id=t1`, { headers: { cookie } });
    assert.equal(page.status, 200);
    const wrong = await fetch(`${ctx.url}/app/threads?token=nope`, { redirect: 'manual' });
    assert.equal(wrong.status, 401);
  });
});

test('the document page is served behind the remember cookie like the other app pages', async () => {
  await withServer({}, async (ctx) => {
    const bare = await fetch(`${ctx.url}/app/doc?thread=t1&file=PLAN.md`);
    assert.equal(bare.status, 401);
    const signin = await fetch(`${ctx.url}/app/doc?token=${ctx.token}&thread=t1&file=PLAN.md`, { redirect: 'manual' });
    assert.equal(signin.status, 303);
    assert.equal(signin.headers.get('location'), '/wheelchair/app/doc?thread=t1&file=PLAN.md');
    const cookie = signin.headers.get('set-cookie').split(';')[0];
    const page = await fetch(`${ctx.url}/app/doc?thread=t1&file=PLAN.md`, { headers: { cookie } });
    assert.equal(page.status, 200);
    for (const asset of ['pages/doc.js', 'pages/doc.css', 'pages/markdown.js']) {
      assert.equal((await fetch(`${ctx.url}/assets/${asset}`)).status, 200, asset);
    }
  });
});

test('the New thread page is served behind the remember cookie, with its assets', async () => {
  await withServer({}, async (ctx) => {
    assert.equal((await fetch(`${ctx.url}/app/new`)).status, 401);
    const signin = await fetch(`${ctx.url}/app/new?token=${ctx.token}`, { redirect: 'manual' });
    assert.equal(signin.status, 303);
    const cookie = signin.headers.get('set-cookie').split(';')[0];
    const page = await fetch(`${ctx.url}/app/new`, { headers: { cookie } });
    assert.equal(page.status, 200);
    assert.match(await page.text(), /id="nt-project"/);
    for (const asset of ['pages/new.js', 'pages/new.css']) {
      assert.equal((await fetch(`${ctx.url}/assets/${asset}`)).status, 200, asset);
    }
  });
});

test('an unknown app page is not served', async () => {
  await withServer({}, async (ctx) => {
    const response = await fetch(`${ctx.url}/app/server`);
    assert.equal(response.status, 404);
  });
});

test('asset names outside pages/ and vendor/, or climbing out, are refused', async () => {
  await withServer({}, async (ctx) => {
    for (const name of ['server.js', 'pages/../server.js', 'vendor/x.html', 'pages/Thread.js']) {
      const response = await fetch(`${ctx.url}/assets/${name}`);
      assert.equal(response.status, 404, name);
    }
  });
});

test('the existing page scripts are still served', async () => {
  await withServer({}, async (ctx) => {
    const response = await fetch(`${ctx.url}/assets/list.js`);
    assert.equal(response.status, 200);
  });
});

test('app pages may frame this origin, for diagram cards', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(source, /APP_PAGE_CSP = `\$\{PAGE_CSP\}; frame-src 'self'`/);
  assert.match(source, /'content-security-policy': APP_PAGE_CSP/);
});
