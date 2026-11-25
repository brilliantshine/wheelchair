'use strict';

// Project leads in the browser (viewer/pages/): the pinned rows and path headings in the thread
// list, the lead's own thread page, the pop-up's two conversations and the Settings switch,
// against the real hub behind a real viewer server with the fake machine service.
const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');
const { api, card } = require('./helpers/app');

const SIZES = [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]];

let ctx;
test.beforeEach(async ({ page }) => { ctx = await startWorld(); await signIn(page, ctx); });
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: 'ignoreErrors' }); await ctx.close(); });

async function settings(value) {
  const res = await api(ctx, '/settings/preferences', { method: 'PUT', body: value });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
}
const make = (project, title) => ctx.make({ cli: 'claude', project, title });
const statusOf = async (threadId) => (await api(ctx, '/project-lead?thread=' + threadId)).body;
const assistantId = async () => (await api(ctx, '/assistant')).body.thread;
const records = async () => (await api(ctx, '/threads?view=list')).body.threads.filter((t) => t.project_lead);
async function leadFor(project, machine = 'hub') {
  const res = await api(ctx, '/project-leads', { method: 'POST', body: { machine, path: project } });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.thread;
}
// Gives a conversation thread a lead session (a copy of an ordinary one) and a transcript.
async function seed(id, from, lines, live = true) {
  const source = JSON.parse(await fs.readFile(path.join(ctx.state, 'threads', `${from}.json`), 'utf8')).sessions[0];
  const name = `wc-${id}-lead`;
  await ctx.patch(id, (t) => { t.sessions = [{ ...source, name, live }]; });
  await ctx.timedTranscript(id, [['human', 'hello', '2025-12-31T00:00:00.000Z'], ...lines]);
  return name;
}
const open = (page, route) => page.goto(`${ctx.server.url}/app/${route}`);
const thread = (page, id) => open(page, 'thread?id=' + id);
const switchTo = (page, name) => page.locator('.lead-switch').getByRole('button', { name, exact: true });
const posted = (page, id) => page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith(`/api/threads/${id}/messages`));

for (const [name, size] of SIZES) {
  test(`thread list pins each project's lead above its threads, before and after it has a chat (${name})`, async ({ page }) => {
    const usage = await make('/tmp/work/wheelchair', 'Usage page');
    await make('/tmp/work/home', 'Kitchen dashboard');
    await page.setViewportSize(size);
    await settings({ project_leads: 'on' });
    await open(page, 'threads');
    const items = page.locator('#list > li');
    await expect(page.locator('.lead-row')).toHaveCount(2);
    await expect(items).toHaveText([/^home$/, /^home lead\s*Ask about this project$/, /Kitchen dashboard/, /^wheelchair$/, /^wheelchair lead\s*Ask about this project$/, /Usage page/]);
    await expect(page.locator('.lead-row .dotmark').first()).not.toHaveClass(/blue|amber/);

    const id = await leadFor('/tmp/work/wheelchair');
    const session = await seed(id, usage.id, [['assistant', 'The Usage page needs a decision on the plan.', '2026-01-01T00:00:00.000Z']]);
    const made = await card(ctx, id, session, { kind: 'question', fits: 'x', question: 'Which?', why: 'y', options: [{ id: 'a', label: 'A', consequence: 'c' }, { id: 'b', label: 'B', consequence: 'd' }], leaning: 'a' });
    expect(made.status, JSON.stringify(made.body)).toBe(202);
    await page.reload();
    const row = page.locator(`.lead-row[data-id="${id}"]`);
    await expect(row.locator('.assistant-preview')).toHaveText('The Usage page needs a decision on the plan.');
    await expect(row.locator('.badge.warn')).toHaveText('1 needs you');
    await expect(row.locator('a.title')).toHaveAttribute('href', `/wheelchair/app/thread?id=${id}`);
    // The record is its pinned row only: never an ordinary row, nor in Archived.
    await expect(page.locator(`#list li[data-id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('#list li.row:not(.lead-row)')).toHaveCount(2);
    await page.getByRole('button', { name: 'Archived' }).click();
    await expect(page.locator('#list li.row')).toHaveCount(0);
    await page.getByRole('button', { name: /Back to threads/ }).click();

    await settings({ project_leads: 'off' });
    await page.reload();
    await expect(page.locator('#list li.row')).toHaveCount(2);
    await expect(page.locator('.lead-row')).toHaveCount(0);
    await expect(page.locator(`#list li[data-id="${id}"]`)).toHaveCount(0);
  });
}

test('thread list groups by machine and exact path, and names same-named folders apart', async ({ page }) => {
  const first = await make('/home/ann/code/app', 'First');
  const alias = await make('/home/ann/code/app', 'Alias');
  const other = await make('/Users/bo/old/app', 'Older');
  const remote = await make('/home/ann/code/app', 'Remote');
  const entry = { name: 'local-host', address: '127.0.0.1', port: ctx.machine.port, secret: ctx.machine.secret };
  await fs.writeFile(path.join(ctx.state, 'machine.json'), JSON.stringify({ host: entry.address, port: entry.port }));
  await fs.writeFile(path.join(ctx.state, 'machines.json'), JSON.stringify({
    'local-host': entry,
    'other-host': { ...entry, name: 'other-host', address: 'localhost' },
  }));
  await ctx.patch(alias.id, (t) => { t.machine = 'local-host'; });
  await ctx.patch(remote.id, (t) => { t.machine = 'other-host'; t.archived = true; });
  const labels = page.locator('#list > li.group-label');
  // Off, and on one machine under two of its names: the paths tell the two folders apart.
  await open(page, 'threads');
  await expect(page.locator('#list li.row')).toHaveCount(3);
  // Polled: the page first draws the list it cached.
  const sorted = (locator) => async () => (await locator.allTextContents()).sort();
  await expect.poll(sorted(labels)).toEqual(['~/code/app', '~/old/app']);
  await expect(labels.first()).toHaveCSS('text-transform', 'none');

  await ctx.patch(remote.id, (t) => { t.archived = false; });
  await ctx.patch(other.id, (t) => { t.archived = true; });
  await settings({ project_leads: 'on' });
  await page.reload();
  await expect.poll(sorted(labels)).toEqual(['~/code/app · local-host', '~/code/app · other-host']);
  await expect.poll(sorted(page.locator('.lead-row a.title'))).toEqual(['~/code/app lead · local-host', '~/code/app lead · other-host']);
  // Both names of the local machine are in the one group.
  await expect(page.locator('#list > li.row:not(.lead-row)')).toHaveCount(3);
  await expect(page.locator(`#list > li[data-id="${first.id}"]`)).toHaveCount(1);
});

test('clicking an unstarted project lead row makes its record and opens its thread, starting nothing', async ({ page }) => {
  await make('/tmp/work/wheelchair', 'Usage page');
  await settings({ project_leads: 'on' });
  const started = ctx.machine.sessions.size;
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, 'threads');
  expect(await records()).toHaveLength(0);
  await page.locator('.lead-row a.title').click();
  await page.waitForURL(/\/app\/thread\?id=/);
  const [record] = await records();
  expect(new URL(page.url()).searchParams.get('id')).toBe(record.id);
  await expect(page.locator('#head h1')).toHaveText('wheelchair lead');
  await expect(page.locator('#head .meta')).toHaveText('wheelchair on hub');
  for (const label of ['Archive', 'Export', 'Agents']) await expect(page.locator('#head').getByText(label, { exact: true })).toHaveCount(0);
  await expect(page.locator('#msg')).toHaveAccessibleName('Message the project lead');
  await expect(page.locator('#msg')).toHaveAttribute('placeholder', 'Message the project lead');
  await expect(page.locator('#msg')).toBeEnabled();
  for (const hidden of ['#attach', '.col-side', '#copy', '#dead', '#composer .hint']) await expect(page.locator(hidden)).toBeHidden();
  await expect(page.locator('.lead-row.current')).toHaveCount(1);
  expect(ctx.machine.sessions.size).toBe(started);
});

test('the project lead page records what was seen under its own conversation', async ({ page }) => {
  const usage = await make('/tmp/work/wheelchair', 'Usage page');
  await settings({ assistant: 'on', project_leads: 'on' });
  const id = await leadFor('/tmp/work/wheelchair');
  const at = '2026-01-01T00:00:00.000Z';
  await seed(id, usage.id, [['assistant', 'Here is where things stand.', at]]);
  await thread(page, id);
  await expect(page.locator('.lead-by-name')).toHaveText('wheelchair lead');
  expect(await page.evaluate((key) => localStorage.getItem(key), 'wc-seen:' + id)).toBe(at);
  // Its own page offers the assistant only.
  await page.locator('.wc-asst-float').click();
  await expect(page.locator('.wc-asst-panel h1')).toHaveText('Assistant');
  await expect(page.locator('.lead-switch')).toBeHidden();
});

test('on a project thread page the pop-up opens its lead, with a switch to the assistant', async ({ page }) => {
  const usage = await make('/tmp/work/wheelchair', 'Usage page');
  await settings({ assistant: 'on', project_leads: 'on' });
  const assistant = await assistantId();
  await thread(page, usage.id);
  const float = page.locator('.wc-asst-float');
  await expect(float).toContainText('wheelchair lead');
  await page.waitForTimeout(1000);
  expect((await statusOf(usage.id)).thread).toBeNull();   // loading the button makes nothing
  await float.click();
  await expect.poll(async () => (await statusOf(usage.id)).thread).toBeTruthy();
  const lead = (await statusOf(usage.id)).thread;
  const panel = page.locator('.wc-asst-panel');
  await expect(panel.locator('h1')).toHaveText('wheelchair lead');
  await expect(switchTo(page, 'wheelchair lead')).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.getByRole('link', { name: /Open thread/ })).toHaveAttribute('href', `/wheelchair/app/thread?id=${lead}`);
  await expect(panel.locator('.wc-asst-stopped')).toBeHidden();   // never started is not stopped
  const input = panel.locator('.wc-asst-input');
  await input.fill('a draft for the project lead');
  await expect(panel.getByRole('button', { name: 'Send' })).toBeEnabled();

  await switchTo(page, 'Assistant').click();
  await expect(panel.locator('h1')).toHaveText('Assistant');
  await expect(input).toHaveAccessibleName('Message the assistant');
  await expect(input).toHaveValue('');
  await expect(panel.getByRole('link', { name: /Open thread/ })).toHaveAttribute('href', `/wheelchair/app/thread?id=${assistant}`);
  await input.fill('to the assistant');
  await expect(panel.getByRole('button', { name: 'Send' })).toBeEnabled();
  let sent = posted(page, assistant);
  await panel.getByRole('button', { name: 'Send' }).click();
  expect((await sent).postDataJSON()).toEqual({ text: 'to the assistant' });

  await switchTo(page, 'wheelchair lead').click();
  await expect(input).toHaveValue('a draft for the project lead');
  await page.route(`**/api/threads/${lead}/messages`, (route) => route.fulfill({ status: 202, json: { queued: true } }));
  sent = posted(page, lead);
  await panel.getByRole('button', { name: 'Send' }).click();
  expect((await sent).postDataJSON()).toEqual({ text: 'a draft for the project lead' });
  await expect(input).toHaveValue('');
  await expect(panel.locator('.wc-asst-human', { hasText: 'a draft for the project lead' })).toBeVisible();

  // Switched off while the panel is open: only the assistant is left.
  await settings({ project_leads: 'off' });
  await expect(panel.locator('h1')).toHaveText('Assistant', { timeout: 15000 });
  await expect(page.locator('.lead-switch')).toBeHidden();
});

test('the pop-up opens the assistant on pages with no project lead', async ({ page }) => {
  const usage = await make('/tmp/work/wheelchair', 'Usage page');
  const old = await make('/tmp/work/gone', 'Archived work');
  await ctx.patch(old.id, (t) => { t.archived = true; });
  await settings({ assistant: 'on', project_leads: 'on' });
  const own = await leadFor('/tmp/work/wheelchair');
  const before = (await records()).length;
  // The control: this same world does offer a lead on a live project's page.
  await thread(page, usage.id);
  await expect(page.locator('.wc-asst-float')).toContainText('wheelchair lead');
  for (const route of ['thread?id=' + own, 'thread?id=' + old.id, 'threads']) {
    await open(page, route);
    await page.locator('.wc-asst-float').click();
    await expect(page.locator('.wc-asst-panel h1')).toHaveText('Assistant');
    await expect(page.locator('.lead-switch')).toBeHidden();
  }
  expect(await records()).toHaveLength(before);
});

test('with one setting on the pop-up offers that one with no switch', async ({ page }) => {
  const usage = await make('/tmp/work/wheelchair', 'Usage page');
  await settings({ assistant: 'on' });
  await thread(page, usage.id);
  await expect(page.locator('.wc-asst-float')).toContainText('Assistant');
  await page.locator('.wc-asst-float').click();
  await expect(page.locator('.wc-asst-panel h1')).toHaveText('Assistant');
  await expect(page.locator('.lead-switch')).toBeHidden();

  await settings({ assistant: 'off', project_leads: 'on' });
  await thread(page, usage.id);
  await expect(page.locator('.wc-asst-float')).toContainText('wheelchair lead');
  await page.locator('.wc-asst-float').click();
  await expect(page.locator('.wc-asst-panel h1')).toHaveText('wheelchair lead');
  await expect(page.locator('.lead-switch')).toBeHidden();
  for (const route of ['threads', 'agents']) {
    const asked = page.waitForResponse((r) => r.url().endsWith('/api/assistant'));
    await open(page, route);
    await asked;
    await page.waitForTimeout(1000);
    await expect(page.locator('.wc-asst-float, .wc-asst-panel')).toHaveCount(0);
  }
});

test('the unread dot is kept for each conversation', async ({ page }) => {
  const usage = await make('/tmp/work/wheelchair', 'Usage page');
  await settings({ project_leads: 'on' });
  const id = await leadFor('/tmp/work/wheelchair');
  const at = '2026-01-01T10:00:00.000Z';
  await seed(id, usage.id, [['assistant', 'News from the project', at]]);
  await thread(page, usage.id);
  // Having seen something newer elsewhere does not count here.
  await page.evaluate(() => { localStorage.setItem('wc-assistant-seen', '2030-01-01T00:00:00.000Z'); localStorage.setItem('wc-seen:someone-else', '2030-01-01T00:00:00.000Z'); });
  await page.reload();
  await expect(page.locator('.wc-asst-unread')).toBeVisible();
  await page.locator('.wc-asst-float').click();
  await expect(page.locator('.wc-asst-panel')).toContainText('News from the project');
  expect(await page.evaluate((key) => localStorage.getItem(key), 'wc-seen:' + id)).toBe(at);
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.wc-asst-unread')).toBeHidden();
});

test('the Settings switch turns project leads on and off', async ({ page }) => {
  await open(page, 'settings');
  const row = page.locator('#project-leads-setting');
  await expect(row).toContainText('A lead for each project that knows its threads and its work.');
  const value = async () => (await api(ctx, '/settings')).body.project_leads;
  await expect(row.getByRole('radio', { name: 'Off' })).toHaveAttribute('aria-checked', 'true');
  await row.getByRole('radio', { name: 'On' }).click();
  await expect(row.getByRole('radio', { name: 'On' })).toHaveAttribute('aria-checked', 'true');
  expect(await value()).toBe('on');
  await page.reload();
  await expect(row.getByRole('radio', { name: 'On' })).toHaveAttribute('aria-checked', 'true');
  await row.getByRole('radio', { name: 'Off' }).click();
  await expect(row.getByRole('radio', { name: 'Off' })).toHaveAttribute('aria-checked', 'true');
  expect(await value()).toBe('off');
});

test('a message to a project lead with no live lead clears the draft in both composers and shows a start failure', async ({ page }) => {
  const usage = await make('/tmp/work/wheelchair', 'Usage page');
  await settings({ project_leads: 'on' });
  const id = await leadFor('/tmp/work/wheelchair');
  ctx.machine.startOk = false;

  await thread(page, id);
  await page.locator('#msg').fill('from the thread page');
  await page.locator('#send').click();
  await expect(page.locator('#msg')).toHaveValue('');
  await expect(page.locator('#dead')).toContainText('start refused');
  await expect(page.locator('#dead').getByRole('button', { name: 'Restart lead' })).toBeVisible();
  await expect(page.locator('#msg')).toBeEnabled();

  await thread(page, usage.id);
  await page.locator('.wc-asst-float').click();
  const panel = page.locator('.wc-asst-panel');
  await panel.locator('.wc-asst-input').fill('from the pop-up');
  await panel.getByRole('button', { name: 'Send' }).click();
  await expect(panel.locator('.wc-asst-input')).toHaveValue('');
  await expect(panel.locator('.wc-asst-stopped')).toContainText('start refused');
  await expect(panel.getByRole('button', { name: 'Restart' })).toBeVisible();
});

// The same handling with the hub's answer stubbed, so the pages are checked before it can give it.
test('a queued answer with a start error clears the draft and shows Restart in both composers', async ({ page }) => {
  const usage = await make('/tmp/work/wheelchair', 'Usage page');
  await settings({ project_leads: 'on' });
  const id = await leadFor('/tmp/work/wheelchair');
  let count = 0;
  await page.route(`**/api/threads/${id}/messages`, (route) => { count++; return route.fulfill({ status: 202, json: { queued: true, start_error: 'start refused' } }); });

  await thread(page, id);
  await expect(page.locator('#dead')).toBeHidden();
  await page.locator('#msg').fill('from the thread page');
  await page.locator('#send').click();
  await expect(page.locator('#dead')).toContainText('start refused');
  await expect(page.locator('#dead').getByRole('button', { name: 'Restart lead' })).toBeVisible();
  await expect(page.locator('#msg')).toHaveValue('');
  await expect(page.locator('#msg')).toBeEnabled();
  await expect(page.locator('.bubble.human.pending')).toContainText('from the thread page');

  await thread(page, usage.id);
  await page.locator('.wc-asst-float').click();
  const panel = page.locator('.wc-asst-panel');
  await panel.locator('.wc-asst-input').fill('from the pop-up');
  await panel.getByRole('button', { name: 'Send' }).click();
  await expect(panel.locator('.wc-asst-stopped')).toContainText('start refused');
  await expect(panel.getByRole('button', { name: 'Restart' })).toBeVisible();
  await expect(panel.locator('.wc-asst-input')).toHaveValue('');
  await expect(panel.locator('.wc-asst-input')).toBeEnabled();
  expect(count).toBe(2);
});
