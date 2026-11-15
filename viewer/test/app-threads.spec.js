'use strict';

// The Threads list and the thread page (docs/plans/app-shell, "Views"), driven in a browser at
// phone width and desktop width against a real viewer server and the fake machine service.
const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

const SIZES = [
  ['phone', { width: 390, height: 844 }],
  ['desktop', { width: 1280, height: 800 }],
];

async function noSideScroll(page) {
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(wide).toBe(false);
}

for (const [label, size] of SIZES) {
  test.describe(label, () => {
    test.use({ viewport: size });
    let ctx;
    test.beforeEach(async ({ page }) => { ctx = await startWorld(); await signIn(page, ctx); });
    test.afterEach(async () => { await ctx.close(); });

    const open = (page, id) => page.goto(`${ctx.server.url}/app/thread?id=${id}`);

    test('the nav stays at the top of a long thread', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      await open(page, made.id);
      await expect(page.locator('#app-nav a', { hasText: 'Sessions' })).toBeVisible();
      await page.evaluate(() => {
        const tall = document.createElement('div'); tall.style.height = '5000px'; document.body.appendChild(tall);
        window.scrollTo(0, 4000);
      });
      const box = await page.locator('#app-nav').boundingBox();
      expect(Math.abs(box.y)).toBeLessThan(2);
      await noSideScroll(page);
    });

    test('list: newest first, stubs marked, archived behind a filter', async ({ page }) => {
      const old = await ctx.make({ cli: 'claude' });
      const fresh = await ctx.make({ cli: 'claude' });
      const parent = await ctx.make({ cli: 'claude' });
      const waiting = await ctx.make({ cli: 'claude' });
      const ready = await ctx.make({ cli: 'claude' });
      const gone = await ctx.make({ cli: 'claude' });
      const t = (n) => new Date(Date.now() - n * 60000).toISOString();
      await ctx.patch(old.id, (x) => { x.title = 'Old one'; x.updated_at = t(50); });
      await ctx.patch(fresh.id, (x) => { x.title = 'Fresh one'; x.updated_at = t(1); });
      await ctx.patch(parent.id, (x) => { x.title = 'Parent work'; x.updated_at = t(40); });
      await ctx.patch(waiting.id, (x) => {
        x.title = 'Waiting stub'; x.updated_at = t(10); x.stub = true; x.sessions = [];
        x.parent = parent.id; x.waiting_on_parent = true; x.depends_on_parent = true;
      });
      await ctx.patch(ready.id, (x) => {
        x.title = 'Ready stub'; x.updated_at = t(20); x.stub = true; x.sessions = []; x.ready = true;
      });
      await ctx.patch(gone.id, (x) => { x.title = 'Gone one'; x.updated_at = t(5); x.archived = true; });

      await page.goto(`${ctx.server.url}/app/threads`);
      const titles = () => page.locator('#list li .title').allTextContents();
      await expect.poll(titles).toEqual(['Fresh one', 'Waiting stub', 'Ready stub', 'Parent work', 'Old one']);
      const wl = page.locator('#list li', { hasText: 'Waiting stub' });
      await expect(wl).toContainText('stub');
      await expect(wl).toContainText('waiting for Parent work');
      await expect(page.locator('#list li', { hasText: 'Ready stub' })).toContainText('ready');
      await expect(page.locator('#list li', { hasText: 'Gone one' })).toHaveCount(0);
      await page.locator('#show-archived').check();
      await expect.poll(titles).toEqual(
        ['Fresh one', 'Gone one', 'Waiting stub', 'Ready stub', 'Parent work', 'Old one']);
      await expect(page.locator('#list li', { hasText: 'Gone one' })).toContainText('archived');
      await expect(page.locator('#app-nav a[aria-current="page"]')).toHaveText('Threads');
      await noSideScroll(page);
    });

    test('list: new thread posts and opens the thread', async ({ page }) => {
      await page.goto(`${ctx.server.url}/app/threads`);
      await page.locator('#new-toggle').click();
      await page.locator('#nt-project').fill('/tmp/project');
      await page.locator('#nt-cli').selectOption('claude');
      await page.locator('#nt-machine').fill('hub');
      const request = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/api/threads'));
      await page.locator('#nt-go').click();
      expect((await request).postDataJSON()).toMatchObject({ project: '/tmp/project', cli: 'claude', machine: 'hub' });
      await expect(page).toHaveURL(/\/app\/thread\?id=[0-9a-f]+/);
      await noSideScroll(page);
    });

    test('chat: bubbles, tool line, context lines, hidden worker turn', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      await ctx.transcript(made.id);
      await open(page, made.id);
      const chat = page.locator('#chat');
      await expect(chat.locator('.bubble.human', { hasText: 'Please add a dark mode.' })).toBeVisible();
      await expect(chat.locator('.bubble.assistant', { hasText: 'Looking at it now.' })).toBeVisible();
      await expect(chat.locator('details.tool summary')).toHaveText('Read');
      await expect(chat.locator('.bubble.human.card')).toHaveText(/Picked Option B/);
      await expect(chat.locator('.ctx')).toHaveText('Lead restarted');
      await expect(chat.locator('.bubble.assistant', { hasText: 'Back at work.' })).toBeVisible();
      const text = await chat.innerText();
      expect(text).not.toContain('HIDDEN-WORKER-REPLY');
      expect(text).not.toContain('ROLE-REPLY-HIDDEN');
      expect(text).not.toContain('wc:from');
      await noSideScroll(page);
    });

    test('a tool line expands to its input and result, as text', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      const file = path.join(ctx.state, `${made.id}-tools.jsonl`);
      const rows = [
        { type: 'user', origin: { kind: 'human' }, message: { role: 'user', content: 'Check it.' } },
        { type: 'assistant', message: { role: 'assistant', content: [
          { type: 'tool_use', id: 'tu1', name: 'Bash', input: { command: 'echo <b>hi</b>' } }] } },
        { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu1', content: 'RESULT-<i>OK</i>' }] } },
      ];
      await fs.writeFile(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
      await ctx.patch(made.id, (t) => { t.sessions[0].transcript_path = file; t.sessions[0].cli = 'claude'; });
      await open(page, made.id);
      const tool = page.locator('#chat details.tool');
      await expect(tool.locator('summary')).toHaveText('Bash');
      await tool.locator('summary').click();
      await expect(tool.locator('pre.tool-detail')).toContainText('echo <b>hi</b>');
      await expect(tool.locator('pre.tool-detail')).toContainText('RESULT-<i>OK</i>');
      await expect(tool.locator('b, i')).toHaveCount(0);
    });

    test('an archived thread draws a diagram read from its branch, read-only', async ({ page }) => {
      const repo = await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'wc-archived-'));
      const git = (...args) => require('node:child_process').execFileSync('git', ['-C', repo, ...args], { stdio: 'pipe' });
      git('init', '-q', '-b', 'wc/gone');
      git('config', 'user.email', 't@example.com'); git('config', 'user.name', 't');
      await fs.mkdir(path.join(repo, 'docs/plans/dark/graphs'), { recursive: true });
      const graph = JSON.parse(await fs.readFile(path.join(__dirname, 'fixtures/canonical.json'), 'utf8'));
      const file = path.join(repo, 'docs/plans/dark/graphs/flow.json');
      await fs.writeFile(file, JSON.stringify(graph));
      git('add', '-A'); git('commit', '-q', '-m', 'graph');
      const before = await fs.readFile(file, 'utf8');

      const made = await ctx.make({ cli: 'claude' });
      await ctx.post(made.id, { kind: 'diagram', plan: 'dark', graph: 'flow', title: 'How it flows' });
      await ctx.patch(made.id, (t) => { t.archived = true; t.branch = 'wc/gone'; t.slug = 'dark'; t.project = repo; });
      await open(page, made.id);
      const card = page.locator('.card-diagram');
      await expect(card).toContainText('Diagram kept on branch wc/gone');
      await expect(card.locator('a')).toHaveAttribute('href', /archive=.*&file=flow\.json$/);
      const frame = page.frameLocator('.card-diagram iframe.diagram');
      const box = frame.locator('svg#canvas g.node[data-id="decide"] rect.node-box');
      await expect(box).toBeVisible();
      // Dragging a box and pressing a verdict key change nothing on disk and send no write.
      const writes = [];
      page.on('request', (r) => { if (r.method() === 'PUT') writes.push(r.url()); });
      const at = await box.boundingBox();
      await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
      await page.mouse.down(); await page.mouse.move(at.x + 60, at.y + 60, { steps: 4 }); await page.mouse.up();
      await page.waitForTimeout(400);
      expect(writes).toEqual([]);
      expect(await fs.readFile(file, 'utf8')).toBe(before);
      expect(git('show', 'wc/gone:docs/plans/dark/graphs/flow.json').toString()).toBe(before);
    });

    test('an archived diagram opens a child graph from the branch, with a way back, read-only', async ({ page }) => {
      const repo = await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'wc-archived-child-'));
      const git = (...args) => require('node:child_process').execFileSync('git', ['-C', repo, ...args], { stdio: 'pipe' });
      git('init', '-q', '-b', 'wc/gone');
      git('config', 'user.email', 't@example.com'); git('config', 'user.name', 't');
      const dir = path.join(repo, 'docs/plans/dark/graphs');
      await fs.mkdir(dir, { recursive: true });
      for (const [from, to] of [['parent', 'flow'], ['child', 'child']]) {
        const g = JSON.parse(await fs.readFile(path.join(__dirname, `fixtures/${from}.json`), 'utf8'));
        await fs.writeFile(path.join(dir, `${to}.json`), JSON.stringify({ groups: [], ...g }));
      }
      git('add', '-A'); git('commit', '-q', '-m', 'graphs');
      const before = git('show', 'wc/gone:docs/plans/dark/graphs/child.json').toString();

      const made = await ctx.make({ cli: 'claude' });
      await ctx.post(made.id, { kind: 'diagram', plan: 'dark', graph: 'flow', title: 'How it flows' });
      await ctx.patch(made.id, (t) => { t.archived = true; t.branch = 'wc/gone'; t.slug = 'dark'; t.project = repo; });
      await open(page, made.id);
      const frame = page.frameLocator('.card-diagram iframe.diagram');
      await expect(frame.locator('svg#canvas g.node[data-id="child-box"]')).toBeVisible();

      const writes = [];
      const graphReqs = [];
      page.on('request', (r) => {
        if (r.method() === 'PUT') writes.push(r.url());
        if (/\/graph\?file=/.test(r.url())) graphReqs.push(decodeURIComponent(r.url().split('file=')[1]));
      });
      await frame.locator('svg#canvas g.node[data-id="child-box"] .open-child').first().dispatchEvent('pointerup');
      await expect(frame.locator('svg#canvas g.node[data-id="grand-box"]')).toBeVisible();
      await expect(frame.locator('svg#canvas g.node[data-id="child-box"]')).toHaveCount(0);
      expect(graphReqs).toContain('child.json');

      const crumbs = frame.locator('#breadcrumb .crumb');
      await expect(crumbs).toHaveCount(2);
      await crumbs.first().click();
      await expect(frame.locator('svg#canvas g.node[data-id="child-box"]')).toBeVisible();
      await page.waitForTimeout(400);
      expect(writes).toEqual([]);
      expect(git('show', 'wc/gone:docs/plans/dark/graphs/child.json').toString()).toBe(before);
    });

    test('message box posts and shows queued', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      await open(page, made.id);
      await page.locator('#msg').fill('hello there');
      const request = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith(`/threads/${made.id}/messages`));
      await page.locator('#send').click();
      expect((await request).postDataJSON()).toEqual({ text: 'hello there' });
      await expect(page.locator('#chat .bubble.pending')).toContainText('queued');
      await expect(page.locator('#queued-note')).toContainText('queued');
      await expect(page.locator('#msg')).toHaveValue('');
    });

    test('cards: every kind renders and presses call the press route', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      const id = made.id;
      await ctx.post(id, { kind: 'offer', summary: 'You want dark mode.' });
      await ctx.post(id, { kind: 'progress', done: 2, total: 5, machines: ['hub'], choice_waiting: true });
      const q = await ctx.post(id, {
        kind: 'question', fits: 'Fits the idea.', question: 'Which palette?', why: 'Simplest.',
        options: [{ id: 'a', label: 'Light', consequence: 'One theme.' },
                  { id: 'b', label: 'Dark', consequence: 'Two themes.' }],
        leaning: 'b', progress: 'decision 2 of 5',
      });
      const ap = await ctx.post(id, {
        kind: 'approval', ready: { ok: false, missing: ['Codex is signed out'] },
        objections: [{ id: 'o1', finding: 'Moves lose work', severity: 'major', reason: 'Commits happen each step.' }],
      });
      await ctx.post(id, { kind: 'needs', title: 'Sign in', body: 'Codex is signed out.', items: ['beelink'] });
      const dn = await ctx.post(id, {
        kind: 'done', title: 'Built and checked', can_do: ['Use it'], left_as_is: ['Resize terminal'],
        pr_url: 'https://github.com/x/y/pull/1',
      });
      await ctx.post(id, { kind: 'diagram', plan: 'dark', graph: 'flow', title: 'How it flows' });
      await ctx.post(id, { kind: 'stub', title: 'Resize fix', summary: 'Terminal resize.', depends_on_parent: true });
      const ideaCard = await ctx.post(id, { kind: 'idea', bullets: [{ id: 'b1', text: 'dark mode' }] });
      await open(page, id);

      // offer, pinned at the top
      await expect(page.locator('#pinned .card-offer')).toContainText('You want dark mode.');
      // progress amber
      const prog = page.locator('#pinned .card-progress');
      await expect(prog).toContainText('2 of 5');
      await expect(prog).toContainText('choice for you');
      await expect(prog).toHaveClass(/amber/);
      // question with the leaning option marked
      const qc = page.locator('.card-question');
      await expect(qc).toContainText('Which palette?');
      await expect(qc.locator('.opt.lean')).toContainText('Dark');
      await expect(qc.locator('.opt.lean')).toContainText('leaning');
      await expect(qc.locator('.opt')).toHaveCount(2);
      // needs, done, diagram, stub
      await expect(page.locator('.card-needs')).toContainText('Codex is signed out.');
      // An agent's needs card has no terminal link; a session-level one from the hub does.
      await expect(page.locator('.card-needs a', { hasText: 'Open terminal' })).toHaveCount(0);
      await ctx.patch(id, (x) => { x.cards.push({ kind: 'needs', title: 'Permission needed', body: 'x', id: 'perm-1',
        session: 'wc-x-lead', system: true, answered: false, at: new Date().toISOString() }); });
      await expect(page.locator('#card-perm-1 a', { hasText: 'Open terminal' }))
        .toHaveAttribute('href', '/wheelchair/app/terminal?name=wc-x-lead');
      const done = page.locator('.card-done');
      await expect(done.getByRole('link', { name: 'Review pull request' }))
        .toHaveAttribute('href', 'https://github.com/x/y/pull/1');
      await expect(page.locator('.card-stub')).toContainText('Resize fix');
      await expect(page.locator('.card-stub a', { hasText: 'Go to it' })).toHaveAttribute('href', /thread\?id=[0-9a-f]+/);
      const frame = page.locator('.card-diagram iframe.diagram');
      await expect(frame).toHaveCount(1);
      await expect(frame).toHaveAttribute('src', /^\/wheelchair\/\?path=.*flow\.json/);
      await expect(page.locator('.card-diagram a', { hasText: 'Open full screen' })).toHaveAttribute('href', /path=/);
      // Start building disabled until Ready
      await expect(page.locator('#start-building')).toBeDisabled();
      await expect(page.locator('.card-approval')).toContainText('Codex is signed out');
      await noSideScroll(page);

      const pressTo = (cardId) => page.waitForRequest((r) =>
        r.method() === 'POST' && r.url().endsWith(`/threads/${id}/cards/${cardId}/press`));

      let req = pressTo(q.id);
      await qc.locator('.opt', { hasText: 'Light' }).click();
      expect((await req).postDataJSON()).toEqual({ action: 'picked', value: 'Light' });
      await expect(qc.locator('.opt').first()).toBeDisabled();
      await expect(qc.locator('.answered-tag')).toBeVisible();

      req = pressTo(ap.id);
      await page.getByRole('button', { name: 'Talk about this' }).click();
      expect((await req).postDataJSON()).toEqual({ action: 'talk', value: 'Moves lose work' });

      req = pressTo(dn.id);
      await page.locator('.card-done .bullet', { hasText: 'Resize terminal' })
        .getByRole('button', { name: 'Start a thread about it' }).click();
      expect((await req).postDataJSON()).toEqual({ action: 'start-thread', value: 'Resize terminal' });

      // Every can_do entry offers it too, with the same press form.
      req = pressTo(dn.id);
      await page.locator('.card-done .bullet', { hasText: 'Use it' })
        .getByRole('button', { name: 'Start a thread about it' }).click();
      expect((await req).postDataJSON()).toEqual({ action: 'start-thread', value: 'Use it' });

      req = pressTo(ideaCard.id);
      await page.locator('.card-idea').getByRole('button', { name: 'Remove' }).click();
      expect((await req).postDataJSON()).toEqual({ action: 'removed', value: 'dark mode' });
    });

    test('approval: Start building enabled when Ready and presses; offer press', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      const ap = await ctx.post(made.id, { kind: 'approval', ready: { ok: true, missing: [] }, objections: [] });
      const off = await ctx.post(made.id, { kind: 'offer', summary: 'Plan it?' });
      await open(page, made.id);
      await expect(page.locator('.card-approval')).toContainText('Plan approved, 0 objections');
      const btn = page.locator('#start-building');
      await expect(btn).toBeEnabled();
      let req = page.waitForRequest((r) => r.url().endsWith(`/cards/${ap.id}/press`));
      await btn.click();
      expect((await req).postDataJSON()).toEqual({ action: 'start-building' });
      req = page.waitForRequest((r) => r.url().endsWith(`/cards/${off.id}/press`));
      await page.getByRole('button', { name: 'Take it into planning' }).click();
      expect((await req).postDataJSON()).toEqual({ action: 'picked', value: 'take it into planning' });
    });

    test('approval: Re-check button shows while not Ready', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      const ap = await ctx.post(made.id, { kind: 'approval', ready: { ok: false, missing: ['x'] }, objections: [] });
      await open(page, made.id);
      const req = page.waitForRequest((r) => r.url().endsWith(`/cards/${ap.id}/press`));
      await page.getByRole('button', { name: 'Re-check' }).click();
      expect((await req).postDataJSON()).toEqual({ action: 'recheck' });
    });

    test('idea fold: newest two past three, expandable', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      const bullets = ['one', 'two', 'three', 'four'].map((text, i) => ({ id: `b${i}`, text }));
      await ctx.post(made.id, { kind: 'idea', bullets });
      await open(page, made.id);
      const rows = page.locator('.card-idea .bullet');
      await expect(rows).toHaveCount(2);
      await expect(rows).toHaveText([/three/, /four/]);
      await page.getByRole('button', { name: 'Show all 4' }).click();
      await expect(rows).toHaveCount(4);
      await page.getByRole('button', { name: 'Fold' }).click();
      await expect(rows).toHaveCount(2);
      // three bullets are not folded
      const other = await ctx.make({ cli: 'claude' });
      await ctx.post(other.id, { kind: 'idea', bullets: bullets.slice(0, 3) });
      await open(page, other.id);
      await expect(page.locator('.card-idea .bullet')).toHaveCount(3);
    });

    test('stub: a dependent stub waits by itself; start now anyway opens the lead', async ({ page }) => {
      const parent = await ctx.make({ cli: 'claude' });
      await ctx.patch(parent.id, (x) => { x.title = 'Parent'; });
      await ctx.post(parent.id, { kind: 'stub', title: 'Fix it', summary: 'Do the fix.', depends_on_parent: true });
      const threads = (await (await fetch(`${ctx.server.url}/api/threads?token=${ctx.server.token}`)).json()).threads;
      const stub = threads.find((x) => x.stub);
      await open(page, stub.id);
      await expect(page.locator('#stub-open')).toContainText('Do the fix.');
      await expect(page.locator('#stub-open')).toContainText('has not merged yet');
      await expect(page.getByRole('button', { name: 'Open and start' })).toHaveCount(0);
      // No pull request on the parent yet: just the thread link.
      await expect(page.locator('#stub-open a', { hasText: 'Pull request' })).toHaveCount(0);
      await ctx.post(parent.id, { kind: 'done', title: 'Built', can_do: ['x'], left_as_is: [], pr_url: 'https://github.com/o/r/pull/7' });
      await expect(page.locator('#stub-open')).toContainText('Builds on Parent, Pull request #7 (not merged yet)');
      await expect(page.locator('#stub-open a', { hasText: 'Pull request #7' })).toHaveAttribute('href', 'https://github.com/o/r/pull/7');
      await open(page, parent.id);
      await expect(page.locator('#head a', { hasText: 'Pull request #7' })).toHaveAttribute('href', 'https://github.com/o/r/pull/7');
      await open(page, stub.id);
      await page.getByRole('button', { name: 'Start now anyway' }).click();
      await expect(page.locator('#stub-open')).toBeHidden();
      await expect(page.locator('#msg')).toBeEnabled();
      await noSideScroll(page);
    });

    test('dead lead offers Restart; archive asks to confirm', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      await ctx.patch(made.id, (x) => { x.sessions[0].live = false; });
      await open(page, made.id);
      await expect(page.locator('#dead')).toContainText('The lead has stopped');
      await expect(page.locator('#msg')).toBeDisabled();
      const req = page.waitForRequest((r) => r.url().endsWith(`/threads/${made.id}/restart`));
      await page.getByRole('button', { name: 'Restart lead' }).click();
      await req;
      await expect(page.locator('#dead')).toBeHidden();

      await page.getByRole('button', { name: 'Archive', exact: true }).click();
      const archive = page.waitForRequest((r) => r.url().endsWith(`/threads/${made.id}/archive`));
      await page.getByRole('button', { name: 'Confirm archive' }).click();
      await archive;
      await expect(page.locator('#head .badge', { hasText: 'archived' })).toBeVisible();
      await expect(page.locator('#msg')).toBeDisabled();
    });

    test('cards sit between chat items by time and carry a linkable id', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      await ctx.timedTranscript(made.id, [
        ['human', 'first message', '2030-01-01T00:00:00.000Z'],
        ['assistant', 'later reply', '2030-01-01T02:00:00.000Z'],
      ]);
      const needs = await ctx.post(made.id, { kind: 'needs', title: 'Sign in', body: 'Codex is signed out.' });
      await ctx.patch(made.id, (x) => {
        x.cards.find((c) => c.id === needs.id).at = '2030-01-01T01:00:00.000Z';
      });
      await open(page, made.id);
      const order = () => page.locator('#chat > *').evaluateAll((nodes) => nodes.map((n) => n.id || n.textContent));
      await expect.poll(order).toEqual(['first message', `card-${needs.id}`, 'later reply']);
      await expect(page.locator(`#card-${needs.id}`)).toHaveClass(/card-needs/);
      await page.goto(`${ctx.server.url}/app/thread?id=${made.id}#card-${needs.id}`);
      await expect(page.locator(`#card-${needs.id}`)).toBeVisible();
    });

    test('plan links use the slug the API returns, not a diagram card plan', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      await ctx.post(made.id, { kind: 'diagram', plan: 'other-plan', graph: 'flow', title: 'Flow' });
      await ctx.patch(made.id, (x) => { x.slug = 'dark'; x.worktree = '/tmp/wt-dark'; });
      await open(page, made.id);
      for (const f of ['MAP', 'IDEA', 'PLAN']) {
        await expect(page.locator('#head a', { hasText: f })).toHaveAttribute(
          'href', new RegExp(`plan=.*wt-dark%2Fdocs%2Fplans%2Fdark&file=${f}\\.md$`));
      }
    });

    test('plan document links go through the existing document page', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      await ctx.patch(made.id, (x) => { x.slug = 'dark'; x.worktree = '/tmp/wt-dark'; });
      await open(page, made.id);
      const plan = page.locator('#head a', { hasText: 'PLAN' });
      await expect(plan).toHaveAttribute('href', /^\/wheelchair\/docs\?plan=.*dark&file=PLAN\.md$/);
      await expect(page.locator('#head a', { hasText: 'MAP' })).toHaveCount(1);
      await expect(page.locator('#head a', { hasText: 'IDEA' })).toHaveCount(1);
    });
  });
}
