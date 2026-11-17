'use strict';

// The Threads list and the thread page (docs/plans/app-shell, "Views"), driven in a browser at
// phone width and desktop width against a real viewer server and the fake machine service.
const fs = require('node:fs/promises');
const path = require('node:path');
const { makeTemp } = require('../../test-support/run-dir');
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

    test('the header labels an Antigravity thread', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      await ctx.patch(made.id, (x) => { x.provider = 'gemini'; x.cli = 'agy'; });
      await open(page, made.id);
      await expect(page.locator('#head')).toContainText('Antigravity');
    });

    test('the nav stays at the top of a long thread', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      await open(page, made.id);
      await expect(page.locator('#app-nav a', { hasText: 'Agents' })).toBeVisible();
      await page.evaluate(() => {
        const tall = document.createElement('div'); tall.style.height = '5000px'; document.body.appendChild(tall);
        window.scrollTo(0, 4000);
      });
      const box = await page.locator('#app-nav').boundingBox();
      expect(Math.abs(box.y)).toBeLessThan(2);
      await noSideScroll(page);
    });

    test('list: last written-in first (agent activity does not reorder), stubs marked, archived behind a filter', async ({ page }) => {
      const old = await ctx.make({ cli: 'claude' });
      const fresh = await ctx.make({ cli: 'claude' });
      const parent = await ctx.make({ cli: 'claude' });
      const waiting = await ctx.make({ cli: 'claude' });
      const ready = await ctx.make({ cli: 'claude' });
      const gone = await ctx.make({ cli: 'claude' });
      const opened = await ctx.make({ cli: 'claude' });
      const t = (n) => new Date(Date.now() - n * 60000).toISOString();
      await ctx.patch(old.id, (x) => { x.title = 'Old one'; x.collin_at = t(50); x.updated_at = t(0); });
      await ctx.patch(fresh.id, (x) => { x.title = 'Fresh one'; x.collin_at = t(1); });
      // A long parent name: its "waiting for" badge must wrap under the stub's title, not squeeze it.
      await ctx.patch(parent.id, (x) => { x.title = 'Parent work with a long name that fills the row'; x.collin_at = t(40); });
      await ctx.patch(waiting.id, (x) => {
        x.title = 'Waiting stub'; x.collin_at = t(10); x.stub = true; x.sessions = [];
        x.parent = parent.id; x.waiting_on_parent = true; x.depends_on_parent = true;
      });
      await ctx.patch(ready.id, (x) => {
        x.title = 'Ready stub'; x.collin_at = t(20); x.stub = true; x.sessions = []; x.ready = true;
      });
      await ctx.patch(gone.id, (x) => { x.title = 'Gone one'; x.collin_at = t(5); x.archived = true; });
      // A stub someone opened: a lead runs in it, so it is no longer marked a stub.
      await ctx.patch(opened.id, (x) => {
        x.title = 'Opened stub'; x.collin_at = t(30); x.stub = true; x.ready = true;
        x.parent = parent.id; x.depends_on_parent = true;
      });

      await page.goto(`${ctx.server.url}/app/threads`);
      const titles = () => page.locator('#list li .title').allTextContents();
      await expect.poll(titles).toEqual(['Fresh one', 'Waiting stub', 'Ready stub', 'Opened stub',
        'Parent work with a long name that fills the row', 'Old one']);
      const wl = page.locator('#list li', { hasText: 'Waiting stub' });
      await expect(wl).toContainText('stub');
      await expect(wl).toContainText('waiting for Parent work');
      // At every row width the title keeps a readable width: the badges wrap below it instead.
      const narrowest = await wl.evaluate((li) => {
        const top = li.querySelector('.top'); const title = top.querySelector('.title');
        let least = Infinity;
        for (let w = 160; w <= 520; w += 8) {
          top.style.width = w + 'px';
          least = Math.min(least, title.getBoundingClientRect().width);
        }
        top.style.width = '';
        return least;
      });
      expect(narrowest).toBeGreaterThan(90);
      await expect(page.locator('#list li', { hasText: 'Opened stub' }).locator('.badge')).toHaveCount(0);
      await expect(page.locator('#list li', { hasText: 'Ready stub' })).toContainText('ready');
      await expect(page.locator('#list li', { hasText: 'Gone one' })).toHaveCount(0);
      await page.locator('#show-archived').check();
      await expect.poll(titles).toEqual(
        ['Fresh one', 'Gone one', 'Waiting stub', 'Ready stub', 'Opened stub',
          'Parent work with a long name that fills the row', 'Old one']);
      await expect(page.locator('#list li', { hasText: 'Gone one' })).toContainText('archived');
      await expect(page.locator('#app-nav a[aria-current="page"]')).toHaveText('Threads');
      await noSideScroll(page);
    });

    test('lead chips follow the newest lead and link to Agents', async ({ page }) => {
      const live = await ctx.make({ cli: 'claude' });
      const ended = await ctx.make({ cli: 'claude' });
      await ctx.patch(live.id, (t) => {
        t.title = 'Live lead';
        t.sessions[0].created_at = '2026-01-01T00:00:00Z';
        t.sessions[0].live = true;
      });
      await ctx.patch(ended.id, (t) => {
        t.title = 'Ended lead';
        t.sessions[0].created_at = '2026-01-01T00:00:00Z';
        t.sessions[0].live = true;
        t.sessions.push({ ...t.sessions[0], name: 'newer-lead', created_at: '2026-02-01T00:00:00Z', live: false });
      });
      await ctx.post(live.id, { kind: 'stub', title: 'Unopened chip stub', summary: 'Later.', depends_on_parent: false });
      const stored = await (await fetch(`${ctx.server.url}/api/threads?token=${ctx.server.token}`)).json();
      const liveName = stored.threads.find((t) => t.id === live.id).lead_name;
      const endedName = stored.threads.find((t) => t.id === ended.id).lead_name;
      expect(liveName).toBeTruthy(); expect(endedName).toBeTruthy();
      await page.setViewportSize({ width: 360, height: 844 });
      await page.goto(`${ctx.server.url}/app/threads`);
      const liveRow = page.locator(`#list li[data-id="${live.id}"]`);
      const endedRow = page.locator(`#list li[data-id="${ended.id}"]`);
      const chip = liveRow.locator('a.lead-chip');
      await expect(chip).toHaveText(liveName);
      await expect(chip).toHaveAttribute('href', `/wheelchair/app/agents#lead-${live.id}`);
      await expect(endedRow.locator('span.lead-chip')).toHaveText(endedName);
      await expect(endedRow.locator('a.lead-chip')).toHaveCount(0);
      await expect(page.locator('#list li', { hasText: 'Unopened chip stub' }).locator('.lead-chip')).toHaveCount(0);
      await expect(page.locator('#list a a')).toHaveCount(0);
      await noSideScroll(page);
      await open(page, live.id);
      await expect(page.locator('#head a.lead-chip')).toHaveText(liveName);
      await expect(page.locator('#head a.lead-chip')).toHaveAttribute('href', `/wheelchair/app/agents#lead-${live.id}`);
      await expect(page.locator('#head a', { hasText: 'Agents' })).toHaveAttribute('href', `/wheelchair/app/agents#lead-${live.id}`);
      await noSideScroll(page);
      await open(page, ended.id);
      await expect(page.locator('#head span.lead-chip')).toHaveText(endedName);
      await page.goto(`${ctx.server.url}/app/threads`);
      await page.route('**/wheelchair/app/agents', (route) => route.fulfill({ status: 200, body: 'Agents' }));
      await page.locator(`#list li[data-id="${live.id}"] a.lead-chip`).click();
      await expect(page).toHaveURL(new RegExp(`/wheelchair/app/agents#lead-${live.id}$`));
    });

    test('list: ?new=1 goes to the New thread screen', async ({ page }) => {
      await page.goto(`${ctx.server.url}/app/threads?new=1`);
      await expect(page).toHaveURL(/\/app\/new$/);
      await expect(page.locator('#nt-project')).toBeVisible();
    });

    test('list: new thread posts and opens the thread', async ({ page }) => {
      await page.goto(`${ctx.server.url}/app/threads`);
      await page.evaluate(() => fetch('/wheelchair/api/settings/preferences', {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ default_project_folder: '/tmp' }),
      }));
      ctx.machine.projects = { found: [{ name: 'project', path: '/tmp/project' }] };
      await page.locator('#new-toggle').click();
      await expect(page).toHaveURL(/\/app\/new$/);
      await expect(page.locator('#nt-project option[value="/tmp/project"]')).toHaveCount(1);
      await page.locator('#nt-project').selectOption('/tmp/project');
      await expect(page.locator('#nt-cli')).toHaveCount(0);
      await page.locator('#nt-machine').selectOption('hub');
      const request = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/api/threads'));
      await page.locator('#nt-go').click();
      expect((await request).postDataJSON()).toMatchObject({ project: '/tmp/project', machine: 'hub' });
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
      const repo = await makeTemp('wc-archived-');
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
      await expect(card.locator('a')).toHaveAttribute('href', /\/app\/picture\?thread=.*&card=/);
      await expect(card.locator('iframe.diagram')).toHaveAttribute('src', /archive=.*&file=flow\.json$/);
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
      const repo = await makeTemp('wc-archived-child-');
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

    test('send now hands a queued message to a busy lead', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      const at = new Date().toISOString();
      await ctx.patch(made.id, (t) => {
        Object.assign(t.sessions[0], { ready: true, turn_ended: false, queue: [{ text: 'do this now', source: 'collin', at }] });
        t.queues = { [t.sessions[0].name]: t.sessions[0].queue };
      });
      await open(page, made.id);
      const bubble = page.locator('#chat .bubble.pending', { hasText: 'do this now' });
      await expect(bubble).toContainText('queued');
      const request = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith(`/threads/${made.id}/send-now`));
      await bubble.locator('button.send-now').click();
      expect((await request).postDataJSON()).toEqual({ at });
      await expect(bubble).toHaveCount(0);
      expect(ctx.machine.sessions.get(made.sessions[0].name).submits).toEqual(['do this now']);
      await noSideScroll(page);
    });

    test('queued bubbles keep the queue order across tabs', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      await ctx.patch(made.id, (t) => { Object.assign(t.sessions[0], { ready: true, turn_ended: false }); });
      await open(page, made.id);
      for (const text of ['A one', 'B two']) {
        await page.locator('#msg').fill(text);
        await page.locator('#send').click();
        await expect(page.locator('#chat .bubble.pending', { hasText: text })).toHaveCount(1);
      }
      // C arrives from another tab, so this page has no pending bubble for it.
      await ctx.patch(made.id, (t) => { t.sessions[0].queue.push({ text: 'C three', source: 'collin', at: new Date().toISOString() }); t.queues = { [t.sessions[0].name]: t.sessions[0].queue }; });
      await expect(page.locator('#chat .bubble.pending')).toHaveCount(3);
      const order = await page.locator('#chat .bubble.pending').evaluateAll((els) => els.map((e) => e.firstChild.textContent));
      expect(order).toEqual(['A one', 'B two', 'C three']);
    });

    test('progress stages render and remain pinned through remediation', async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 800 });
      const made = await ctx.make({ cli: 'claude' });
      const base = { kind: 'progress', machines: [], choice_waiting: false };
      await ctx.post(made.id, { ...base, done: 2, total: 5 });
      await open(page, made.id);
      const pin = page.locator('#pinned');
      const progress = pin.locator('.card-progress');
      await expect(progress).toContainText('Building');
      await expect(progress).toContainText('tasks done');
      const review = { ...base, stage: 'review', pass: 2, phase: 'fixing', found: 5, fixed: 3, choice_waiting: true };
      await ctx.post(made.id, review);
      await expect(progress).toContainText('Reviewing plan');
      await expect(progress).toContainText('pass 2 · 5 found, 3 resolved');
      await expect(progress.locator('.segs')).toHaveCount(0);
      await expect(progress).toHaveClass(/amber/);
      expect(await pin.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      await pin.locator('.pin-toggle').click();
      await expect(pin).toContainText('Reviewing plan · pass 2 · 5 found, 3 resolved');
      await expect(pin).not.toContainText('undefined');
      await pin.locator('.pin-toggle').click();
      await ctx.post(made.id, { ...base, stage: 'verify', pass: 1, phase: 'clean' });
      await expect(progress).toContainText('Verified');
      const fixing = { ...base, stage: 'verify', pass: 2, phase: 'fixing', found: 2, fixed: 0 };
      await ctx.post(made.id, fixing);
      await expect(progress).toContainText('2 gaps, 0 fixed');
      await ctx.post(made.id, { ...fixing, fixed: 1 });
      await expect(progress).toContainText('Verifying');
      await expect(progress).toContainText('2 gaps, 1 fixed');
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
      await expect(page.locator('.card-diagram a', { hasText: 'Open full size' })).toHaveAttribute('href', /\/app\/picture\?thread=.*&card=/);
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
      const order = () => page.locator('#chat > :not(.lead-by)').evaluateAll((nodes) => nodes.map((n) => n.id || n.textContent));
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
        await expect(page.locator('#files a', { hasText: f })).toHaveAttribute(
          'href', `/wheelchair/app/doc?thread=${made.id}&file=${f}.md`);
      }
    });

    test('S1: a thread created with a message is titled from it in the list', async ({ page }) => {
      await ctx.make({ cli: 'claude', message: 'Add a dark mode to the settings page' });
      await page.goto(`${ctx.server.url}/app/threads`);
      await expect(page.locator('#list li .title')).toHaveText(['Add a dark mode to the settings page']);
      await expect(page.locator('#list li .title')).not.toHaveText('project');
    });

    const QUESTION = {
      kind: 'question', fits: 'Fits the idea.', question: 'Is IDEA.md right?', why: 'Simplest.',
      options: [{ id: 'a', label: 'Yes, that is it', consequence: 'Plan next.' },
                { id: 'b', label: 'Not quite', consequence: 'Revise it.' }],
      leaning: 'a',
    };

    test('S2: a question with doc links to the in-app page; one without has no link', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      await ctx.patch(made.id, (x) => { x.slug = 'dark'; x.worktree = '/tmp/wt-dark'; });
      const withDoc = await ctx.post(made.id, { ...QUESTION, doc: 'IDEA.md' });
      const without = await ctx.post(made.id, { ...QUESTION, question: 'Another one?' });
      await open(page, made.id);
      const link = page.locator(`#card-${withDoc.id} a`, { hasText: 'Open IDEA.md' });
      await expect(link).toHaveAttribute('href', `/wheelchair/app/doc?thread=${made.id}&file=IDEA.md`);
      await expect(page.locator(`#card-${without.id}`)).toContainText('Another one?');
      await expect(page.locator(`#card-${without.id} a`)).toHaveCount(0);
    });

    test('S2: the link appears when the slug becomes known, without a reload', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      const q = await ctx.post(made.id, { ...QUESTION, doc: 'IDEA.md' });
      await open(page, made.id);
      await expect(page.locator(`#card-${q.id}`)).toContainText('Is IDEA.md right?');
      await expect(page.locator(`#card-${q.id} a`)).toHaveCount(0);
      await ctx.patch(made.id, (x) => { x.slug = 'dark'; x.worktree = '/tmp/wt-dark'; });
      await expect(page.locator(`#card-${q.id} a`, { hasText: 'Open IDEA.md' })).toHaveAttribute(
        'href', `/wheelchair/app/doc?thread=${made.id}&file=IDEA.md`);
    });

    test('withdrawn cards leave pins and show disabled controls in the conversation', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      const q = await ctx.post(made.id, QUESTION);
      const offer = await ctx.post(made.id, { kind: 'offer', summary: 'A feature.' });
      const approval = await ctx.post(made.id, { kind: 'approval', ready: { ok: false, missing: ['x'] },
        objections: [{ id: 'o', finding: 'A concern', severity: 'major', reason: 'Discussed' }] });
      await ctx.patch(made.id, (x) => { x.pinned.approval = x.cards.find((c) => c.id === approval.id); });
      await open(page, made.id);
      await expect(page.locator(`#pinned #card-${approval.id}`)).toBeVisible();
      await page.locator('#pinned .pin-toggle').click();
      await expect(page.locator('#pinned .pin-bar')).toContainText('Plan approved: needs you');
      await page.locator('#pinned .pin-toggle').click();
      await ctx.patch(made.id, (x) => {
        for (const id of [q.id, offer.id, approval.id]) {
          const c = x.cards.find((card) => card.id === id);
          Object.assign(c, { answered: true, retracted_at: new Date().toISOString(), retracted_by: 'lead', retracted_note: 'No longer needed' });
        }
        delete x.pinned.offer; delete x.pinned.approval;
      });
      for (const id of [q.id, offer.id, approval.id]) {
        const card = page.locator(`#chat #card-${id}`);
        await expect(card.locator('.answered-tag')).toContainText('Withdrawn · No longer needed');
        expect(await card.evaluate((n) => Number(getComputedStyle(n).opacity))).toBe(0.6);
        await expect(card.locator('button:enabled, textarea:enabled')).toHaveCount(0);
      }
      await expect(page.locator(`#pinned #card-${approval.id}`)).toHaveCount(0);
    });

    test('S4: pressing an option says what was picked and marks it', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      const q = await ctx.post(made.id, QUESTION);
      await open(page, made.id);
      const card = page.locator(`#card-${q.id}`);
      await card.locator('button.opt', { hasText: 'Not quite' }).click();
      await expect(card.locator('.answered-tag')).toHaveText(/You picked Not quite/);
      await expect(card.locator('.answered-tag')).not.toContainText('Answered');
      await expect(card.locator('button.opt.picked')).toHaveCount(1);
      await expect(card.locator('button.opt.picked')).toContainText('Not quite');
      await expect(card.locator('button.opt.picked svg')).toHaveCount(1);
      await expect(card.locator('button.opt:not(.picked) svg')).toHaveCount(0);
      await expect(card.locator('button.opt').first()).toBeDisabled();
    });

    test('S4: a double tap sends one press, and a card answered elsewhere shows answered with no error', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      const q = await ctx.post(made.id, QUESTION);
      const stale = await ctx.post(made.id, { ...QUESTION, question: 'Answered in another tab?' });
      await open(page, made.id);
      const presses = [];
      page.on('request', (r) => { if (r.url().includes(`/cards/${q.id}/press`)) presses.push(r); });
      const card = page.locator(`#card-${q.id}`);
      await card.locator('button.opt', { hasText: 'Not quite' }).dblclick();
      await expect(card.locator('.answered-tag')).toHaveText(/You picked Not quite/);
      expect(presses).toHaveLength(1);

      const other = page.locator(`#card-${stale.id}`);
      await expect(other.locator('button.opt').first()).toBeEnabled();
      await ctx.patch(made.id, (x) => {
        const c = x.cards.find((c) => c.id === stale.id);
        c.answered = true; c.answered_action = 'picked'; c.answered_value = 'Not quite';
      });
      const res = page.waitForResponse((r) => r.url().includes(`/cards/${stale.id}/press`));
      await other.locator('button.opt').first().click();
      expect((await res).status()).toBe(422);
      await expect(other.locator('.answered-tag')).toHaveText(/You picked Not quite/);
      await expect(other.locator('button.opt').first()).toBeDisabled();
      await expect(other).not.toContainText('already answered');
    });

    test('S4: an answer in his own words is sent, closes the card and is shown', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      const q = await ctx.post(made.id, QUESTION);
      await open(page, made.id);
      const card = page.locator(`#card-${q.id}`);
      const send = card.locator('.own-words button');
      await expect(send).toBeDisabled();
      await card.locator('.own-words textarea').fill('Yes, but keep the old name');
      const req = page.waitForRequest((r) => r.url().includes(`/cards/${q.id}/press`));
      await send.click();
      expect((await req).postDataJSON()).toEqual({ action: 'answered', value: 'Yes, but keep the old name' });
      await expect(card.locator('.answered-tag')).toHaveText(/You answered: Yes, but keep the old name/);
      await expect(card.locator('.own-words')).toHaveCount(0);
      await expect(card.locator('button.opt.picked')).toHaveCount(0);
      await expect(card.locator('button.opt').first()).toBeDisabled();
    });

    test('S4: a redraw while typing keeps the draft, focus and caret', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      const q = await ctx.post(made.id, QUESTION);
      await open(page, made.id);
      const box = page.locator(`#card-${q.id} .own-words textarea`);
      await box.fill('keep the old name please');
      await box.evaluate((n) => { n.setSelectionRange(4, 9, 'backward'); n.dispatchEvent(new KeyboardEvent('keyup')); });
      const before = await box.elementHandle();
      await ctx.post(made.id, { ...QUESTION, question: 'Another one?' });
      await expect.poll(() => before.evaluate((n) => n.isConnected)).toBe(false);
      await expect(box).toBeFocused();
      await expect(box).toHaveValue('keep the old name please');
      expect(await box.evaluate((n) => [n.selectionStart, n.selectionEnd, n.selectionDirection])).toEqual([4, 9, 'backward']);
    });

    test('S4: an answered card with no stored value keeps the generic tag; an unmatched value is shown bare', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      const old = await ctx.post(made.id, QUESTION);
      const odd = await ctx.post(made.id, { ...QUESTION, question: 'Odd one?' });
      await ctx.patch(made.id, (x) => {
        x.cards.find((c) => c.id === old.id).answered = true;
        const c = x.cards.find((c) => c.id === odd.id);
        c.answered = true; c.answered_action = 'picked'; c.answered_value = 'something else';
      });
      await open(page, made.id);
      await expect(page.locator(`#card-${old.id} .answered-tag`)).toHaveText(/Answered/);
      await expect(page.locator(`#card-${odd.id} .answered-tag`)).toHaveText(/You picked something else/);
      await expect(page.locator(`#card-${odd.id} button.opt.picked`)).toHaveCount(0);
    });

    test('S4: a question the lead resolved shows Answered in chat and the note, dimmed', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      const q = await ctx.post(made.id, QUESTION);
      await ctx.post(made.id, { kind: 'resolve', card: q.id, note: 'He wants the dark one.' });
      await open(page, made.id);
      const card = page.locator(`#card-${q.id}`);
      await expect(card.locator('.answered-tag')).toContainText('Answered in chat');
      await expect(card.locator('.answered-tag')).toContainText('He wants the dark one.');
      await expect(card.locator('button.opt').first()).toBeDisabled();
      await expect(card.locator('button.opt.picked')).toHaveCount(0);
      expect(await card.evaluate((n) => Number(getComputedStyle(n).opacity))).toBeLessThan(1);
    });

    test('S5: the offer has two buttons; Keep talking first presses its value and says so', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      const off = await ctx.post(made.id, { kind: 'offer', summary: 'You want dark mode.' });
      await open(page, made.id);
      const card = page.locator('#pinned .card-offer');
      await expect(card.getByRole('button', { name: 'Take it into planning' })).toBeEnabled();
      const keep = card.getByRole('button', { name: 'Keep talking first' });
      const req = page.waitForRequest((r) => r.url().endsWith(`/cards/${off.id}/press`));
      await keep.click();
      expect((await req).postDataJSON()).toEqual({ action: 'picked', value: 'keep talking first' });
      await expect(card.locator('.answered-tag')).toHaveText(/You picked Keep talking first/);
      await expect(card.getByRole('button', { name: 'Take it into planning' })).toBeDisabled();
      await expect(card.getByRole('button', { name: 'Keep talking first' })).toBeDisabled();
      await expect(card.locator('button.picked')).toHaveText(/Keep talking first/);
    });

    test('S4: a pressed offer marks Take it into planning', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      await ctx.post(made.id, { kind: 'offer', summary: 'You want dark mode.' });
      await open(page, made.id);
      const card = page.locator('#pinned .card-offer');
      await card.getByRole('button', { name: 'Take it into planning' }).click();
      await expect(card.locator('.answered-tag')).toHaveText(/You picked Take it into planning/);
      await expect(card.locator('button.picked')).toHaveText(/Take it into planning/);
    });

    test('pinned cards stay under the header in a long thread and fold to one line', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      const start = Date.parse('2030-01-01T00:00:00.000Z');
      await ctx.timedTranscript(made.id, Array.from({ length: 60 }, (_, i) =>
        [i % 2 ? 'assistant' : 'human', 'line ' + i + ' ' + 'words '.repeat(20), new Date(start + i * 60000).toISOString()]));
      await ctx.post(made.id, { kind: 'idea', bullets: [{ id: 'b1', text: 'dark mode' }] });
      await open(page, made.id);
      const pinned = page.locator('#pinned');
      await expect(pinned.locator('.card-idea')).toContainText('dark mode');
      await expect(page.locator('#chat .bubble', { hasText: 'line 59' })).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      // Scrolled to the bottom, the strip still sits just below the header, in view.
      await expect.poll(async () => {
        const head = await page.locator('#head').boundingBox();
        const pin = await pinned.boundingBox();
        return Math.abs(pin.y - (head.y + head.height)) <= 1 && pin.y >= 0;
      }).toBe(true);
      // Hide folds it to a one-line summary; the choice survives a reload.
      await pinned.getByRole('button', { name: 'Hide' }).click();
      await expect(pinned.locator('.card-idea')).toHaveCount(0);
      await expect(pinned.locator('.pin-bar')).toContainText('Your idea · 1 thing');
      await page.reload();
      await expect(pinned.locator('.pin-bar')).toContainText('Your idea · 1 thing');
      await expect(pinned.locator('.card-idea')).toHaveCount(0);
      await pinned.getByRole('button', { name: 'Show' }).click();
      await expect(pinned.locator('.card-idea')).toContainText('dark mode');
      await noSideScroll(page);
    });

    test('plan document links open the in-app document page', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      await ctx.patch(made.id, (x) => { x.slug = 'dark'; x.worktree = '/tmp/wt-dark'; });
      await open(page, made.id);
      const plan = page.locator('#files a', { hasText: 'PLAN' });
      await expect(plan).toHaveAttribute('href', `/wheelchair/app/doc?thread=${made.id}&file=PLAN.md`);
      await expect(page.locator('#files a', { hasText: 'MAP' })).toHaveCount(1);
      await expect(page.locator('#files a', { hasText: 'IDEA' })).toHaveCount(1);
    });
  });
}

test.describe('working indicator', () => {
  let ctx;
  test.beforeEach(async ({ page }) => { ctx = await startWorld(); await signIn(page, ctx); });
  test.afterEach(async () => { await ctx.close(); });

  test('dots show under the chat and the list dot pulses while the lead is mid-turn', async ({ page }) => {
    const made = await ctx.make({ cli: 'claude' });
    const setTurn = (ended) => ctx.patch(made.id, (x) => {
      for (const s of x.sessions) if (s.role === 'lead') { s.live = true; s.ready = true; s.turn_ended = ended; }
    });
    await setTurn(false);
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    await expect(page.locator('#working')).toBeVisible();
    await expect(page.locator('#working-label')).toHaveText(/ is working$/);
    await ctx.patch(made.id, (x) => { x.lead_name = 'Juniper'; });
    await expect(page.locator('#working-label')).toHaveText('Juniper is working');
    await expect(page.locator(`#list li[data-id="${made.id}"] .dotmark.working`)).toHaveCount(1);
    await setTurn(true);
    await expect(page.locator('#working')).toBeHidden({ timeout: 10000 });
  });
});
