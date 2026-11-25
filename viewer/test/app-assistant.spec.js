'use strict';
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

const fs = require('node:fs/promises');
const path = require('node:path');
const { api, card } = require('./helpers/app');

const setAssistant = (page, ctx, value) => api(ctx, '/settings/preferences', { method: 'PUT', body: { assistant: value } });
const status = async (ctx) => (await api(ctx, '/assistant')).body;
async function assistantId(page, ctx) {
  const body = await status(ctx);
  return body.on ? body.thread : null;
}

for (const [name, size] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]]) {
  test(`Threads list: the assistant row is first when on, absent when off (${name})`, async ({ page }) => {
    const ctx = await startWorld();
    try {
      await ctx.make({ cli: 'claude', title: 'Usage page' });
      await signIn(page, ctx);
      await page.setViewportSize(size);
      await page.goto(`${ctx.server.url}/app/threads`);
      await expect(page.locator('#list li.row')).toHaveCount(1);
      await expect(page.locator('.assistant-row')).toHaveCount(0);

      expect((await setAssistant(page, ctx, 'on')).status).toBe(200);
      const id = await assistantId(page, ctx);
      expect(id).toBeTruthy();
      await ctx.patch(id, (t) => { t.user_at = '2000-01-01T00:00:00.000Z'; });
      await page.goto(`${ctx.server.url}/app/threads`);
      const first = page.locator('#list > li').first();
      await expect(first).toHaveClass(/assistant-row/);
      await expect(first.locator('a.title')).toHaveText('Personal assistant');
      await expect(first.locator('a.title')).toHaveAttribute('href', `/wheelchair/app/thread?id=${id}`);
      await expect(first.getByRole('button')).toHaveCount(0);
      await expect(first).not.toContainText('Archive');
      await expect(page.locator('#list > li.group-label').first()).toBeVisible();
      await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/threads-${name}.png` : undefined });

      await setAssistant(page, ctx, 'off');
      await page.goto(`${ctx.server.url}/app/threads`);
      await expect(page.locator('#list li.row')).toHaveCount(1);
      await expect(page.locator('.assistant-row')).toHaveCount(0);
    } finally { await ctx.close(); }
  });
}

test('assistant thread page: no project controls, labels, seen marker', async ({ page }) => {
  const ctx = await startWorld();
  try {
    await setAssistant(page, ctx, 'on');
    await signIn(page, ctx);
    await setAssistant(page, ctx, 'on');
    const id = await assistantId(page, ctx);
    const at = '2026-03-04T05:06:07.000Z';
    const cardAt = '2026-03-04T05:07:07.000Z';
    await page.route('**/api/threads/*/chat', async (route) => {
      const response = await route.fetch(); const json = await response.json();
      json.items = [{ type: 'human', text: 'start a thread', at, by: 'assistant' }, { type: 'human', text: 'plain note', at: '2026-03-04T05:00:00.000Z' }, { type: 'assistant', text: 'Done.', at: '2026-03-04T05:06:00.000Z', id: 'm1' }];
      json.cards = [{ id: 'q1', kind: 'question', question: 'Which?', options: [], at: cardAt, answered: true, answered_by: 'assistant' }];
      await route.fulfill({ response, json });
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${ctx.server.url}/app/thread?id=${id}`);
    await expect(page.locator('#head h1')).toHaveText('Personal assistant');
    await expect(page.locator('.bubble.human', { hasText: 'start a thread' }).locator('.by-assistant')).toHaveText('From your assistant');
    await expect(page.locator('.by-assistant')).toHaveCount(1);
    await expect(page.locator('.answered-tag')).toContainText('by your assistant');
    for (const name of ['Archive', 'Export', 'Agents']) await expect(page.locator('#head').getByText(name, { exact: true })).toHaveCount(0);
    await expect(page.locator('#head .badge')).toHaveCount(0);
    await expect(page.locator('#head .meta')).toHaveText('Across your projects');
    await expect(page.locator('#copy')).toBeHidden();
    expect(await page.evaluate((key) => localStorage.getItem(key), 'wc-seen:' + id)).toBe(cardAt);
    await expect(page.locator('#attach')).toBeHidden();
    await expect(page.locator('.col-side')).toBeHidden();
    await expect(page.locator('#head').getByText('Open in terminal')).toHaveCount(0);
    await expect(page.locator('#msg')).toHaveAccessibleName('Message the assistant');
    await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/thread-desktop.png` : undefined });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/thread-phone.png` : undefined });
    await page.goto(`${ctx.server.url}/app/threads`);
    await expect(page.locator('.wc-asst-float')).toBeVisible();
    await expect(page.locator('.wc-asst-unread')).toBeHidden();
  } finally { await page.unrouteAll({ behavior: 'ignoreErrors' }); await ctx.close(); }
});

test('an ordinary thread shows archived_by, and no assistant label without by', async ({ page }) => {
  const ctx = await startWorld();
  try {
    const made = await ctx.make({ cli: 'claude' });
    await page.route('**/api/threads/*/chat', async (route) => {
      const response = await route.fetch(); const json = await response.json();
      json.thread.archived = true; json.thread.archived_by = 'assistant';
      json.items = [{ type: 'human', text: 'by you', at: '2026-03-04T05:00:00.000Z' }];
      await route.fulfill({ response, json });
    });
    await signIn(page, ctx); await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    await expect(page.locator('#head')).toContainText('Archived by your assistant');
    await expect(page.locator('.by-assistant')).toHaveCount(0);
    await expect(page.locator('#head').getByText('Agents', { exact: true })).toBeVisible();
  } finally { await page.unrouteAll({ behavior: 'ignoreErrors' }); await ctx.close(); }
});

test('Settings control turns the assistant on and off', async ({ page }) => {
  const ctx = await startWorld();
  try {
    await signIn(page, ctx);
    await page.goto(`${ctx.server.url}/app/settings`);
    const row = page.locator('#assistant-setting');
    await expect(row).toContainText('An assistant that sees all your threads and acts on what you tell it.');
    await expect(row.getByRole('radio', { name: 'Off' })).toHaveAttribute('aria-checked', 'true');
    await row.getByRole('radio', { name: 'On' }).click();
    await expect(row.getByRole('radio', { name: 'On' })).toHaveAttribute('aria-checked', 'true');
    expect((await status(ctx)).on).toBe(true);
    await row.getByRole('radio', { name: 'Off' }).click();
    await expect(row.getByRole('radio', { name: 'Off' })).toHaveAttribute('aria-checked', 'true');
    expect((await status(ctx)).on).toBe(false);
  } finally { await ctx.close(); }
});

async function seedAssistant(ctx, id, lines) {
  const file = path.join(ctx.state, 'threads', `${id}.json`);
  const t = JSON.parse(await fs.readFile(file, 'utf8'));
  const log = path.join(ctx.state, `${id}.jsonl`);
  const rows = [{ type: 'user', origin: { kind: 'human' }, message: { role: 'user', content: '[wc:role] x' } }];
  for (const [type, text, timestamp] of lines) {
    rows.push(type === 'human'
      ? { timestamp, type: 'user', origin: { kind: 'human' }, message: { role: 'user', content: text } }
      : { timestamp, type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] } });
  }
  await fs.writeFile(log, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  await ctx.patch(id, (x) => { x.sessions[0].transcript_path = log; x.sessions[0].cli = 'claude'; });
  return t.sessions[0];
}

test('Threads list: assistant row counts its open question, shows the first reply line, fetches the preview once', async ({ page }) => {
  const ctx = await startWorld();
  try {
    await ctx.make({ cli: 'claude', title: 'Usage page' });
    await setAssistant(page, ctx, 'on');
    const id = await assistantId(page, ctx);
    const session = await seedAssistant(ctx, id, [
      ['human', 'what is going on?', '2026-03-04T05:00:00.000Z'],
      ['assistant', 'old reply', '2026-03-04T05:01:00.000Z'],
      ['human', 'and now?', '2026-03-04T05:02:00.000Z'],
      ['assistant', '\n## **Waiting** on [snake_case](https://example.com) and #12 long long long long long long long long long long long long long long long long long long long long long long long long long \nsecond line', '2026-03-04T05:03:00.000Z'],
    ]);
    const made = await card(ctx, id, session.name, { kind: 'question', fits: 'x', question: 'Which thread?', why: 'y', options: [{ id: 'a', label: 'A', consequence: 'c' }, { id: 'b', label: 'B', consequence: 'd' }], leaning: 'a' });
    expect(made.status, JSON.stringify(made.body)).toBe(202);
    // The pop-up also reads this chat, so count only the fetches that threads.js itself makes.
    await page.addInitScript(() => {
      const real = window.fetch; window.__previewFetches = 0;
      window.fetch = function (url, ...rest) {
        if (String(url).endsWith('/chat') && /threads\.js/.test(new Error().stack || '')) window.__previewFetches += 1;
        return real.call(this, url, ...rest);
      };
    });
    await signIn(page, ctx);
    await page.goto(`${ctx.server.url}/app/threads`);
    const row = page.locator('.assistant-row');
    await expect(row.locator('.badge.warn')).toHaveText('1 needs you');
    await expect(row.locator('.assistant-preview')).toContainText('Waiting on snake_case and #12');
    expect(await row.locator('.assistant-preview').evaluate((el) => { const s = getComputedStyle(el); return s.whiteSpace === 'nowrap' && s.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth; })).toBe(true);
    // The cached list paints with the cached preview on the next load.
    await page.route('**/api/threads/*/chat', (route) => route.abort());
    await page.reload();
    await expect(row.locator('.assistant-preview')).toContainText('Waiting on snake_case and #12');
    await page.unroute('**/api/threads/*/chat');
    await page.reload();
    await expect(row.locator('.assistant-preview')).toContainText('Waiting on snake_case and #12');
    await page.waitForTimeout(11000); // two or more 5 s polls
    expect(await page.evaluate(() => window.__previewFetches)).toBe(1);
  } finally { await page.unrouteAll({ behavior: 'ignoreErrors' }); await ctx.close(); }
});

test('assistant page composer says Message the assistant and has no plan hint; other threads keep theirs', async ({ page }) => {
  const ctx = await startWorld();
  try {
    const other = await ctx.make({ cli: 'claude', title: 'Usage page' });
    await setAssistant(page, ctx, 'on');
    const id = await assistantId(page, ctx);
    await seedAssistant(ctx, id, [['human', 'hi', '2026-03-04T05:00:00.000Z'], ['assistant', 'Hello.', '2026-03-04T05:01:00.000Z']]);
    await signIn(page, ctx);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${ctx.server.url}/app/thread?id=${id}`);
    await expect(page.locator('#msg')).toHaveAttribute('placeholder', 'Message the assistant');
    await expect(page.locator('#composer .hint')).toBeHidden();
    await page.goto(`${ctx.server.url}/app/thread?id=${other.id}`);
    await expect(page.locator('#msg')).toHaveAttribute('placeholder', 'Message the lead');
    await expect(page.locator('#composer .hint')).toBeVisible();
    await expect(page.locator('#attach')).toBeVisible();
    await expect(page.locator('.col-side')).toBeVisible();
    await expect(page.locator('#head').getByText('Open in terminal')).toBeVisible();
    await expect(page.locator('#msg')).toHaveAccessibleName('Message the lead');
  } finally { await ctx.close(); }
});


test('assistant queued messages and card presses render and reconcile after Send now', async ({ page }) => {
  const ctx = await startWorld();
  try {
    const made = await ctx.make({ cli: 'claude' });
    const file = path.join(ctx.state, made.id + '.jsonl');
    await fs.writeFile(file, '');
    const messages = ['[wc:assistant] hello lead', '[wc:assistant] [card c1] picked: Option B'];
    await ctx.patch(made.id, (t) => {
      Object.assign(t.sessions[0], { transcript_path: file, cli: 'claude', ready: true, turn_ended: false, queue: messages.map((text, i) => ({ text, source: 'user', at: new Date(Date.now() + i).toISOString() })) });
      t.queues = { [t.sessions[0].name]: t.sessions[0].queue };
    });
    await signIn(page, ctx);
    await page.goto(ctx.server.url + '/app/thread?id=' + made.id);
    await expect(page.locator('#chat .pending')).toHaveCount(2);
    await expect(page.locator('#chat .pending').first()).toContainText('From your assistant');
    await expect(page.locator('#chat .pending').first()).toContainText('hello lead');
    await expect(page.locator('#chat .pending').last()).toContainText('Your assistant: Picked Option B');
    await expect(page.locator('#chat')).not.toContainText('[wc:assistant]');
    for (const message of messages) {
      await page.locator('.send-now').first().click();
      await fs.appendFile(file, JSON.stringify({ type: 'user', timestamp: new Date().toISOString(), origin: { kind: 'human' }, message: { role: 'user', content: message } }) + '\n');
    }
    await expect(page.locator('#chat .pending')).toHaveCount(0);
    await expect(page.locator('#chat .human')).toHaveCount(2);
  } finally { await ctx.close(); }
});

test('assistant with no sessions offers restart', async ({ page }) => {
  const ctx = await startWorld();
  try {
    await setAssistant(page, ctx, 'on');
    const id = await assistantId(page, ctx);
    await ctx.patch(id, (t) => { t.sessions = []; });
    await signIn(page, ctx);
    await page.goto(`${ctx.server.url}/app/thread?id=${id}`);
    await expect(page.getByRole('button', { name: 'Restart lead' })).toBeVisible();
  } finally { await ctx.close(); }
});

test('answered Check card attributes the assistant', async ({ page }) => {
  const ctx = await startWorld();
  try {
    const made = await ctx.make({ cli: 'claude' });
    await ctx.patch(made.id, (t) => { t.cards.push({ id: 'check-assistant', kind: 'check', update: 'Check this', steps: [], answered: true, answered_by: 'assistant', at: '2030-01-01T00:00:00.000Z' }); });
    await signIn(page, ctx);
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    await expect(page.locator('.card', { hasText: 'Check this' })).toContainText('by your assistant');
  } finally { await ctx.close(); }
});

test('failed assistant start shows saved On and allows turning Off', async ({ page }) => {
  const ctx = await startWorld();
  try {
    await api(ctx, '/settings/balancing', { method: 'PUT', body: { lead_order: ['gpt'] } });
    ctx.machine.preflightOk = false;
    await signIn(page, ctx);
    await page.goto(`${ctx.server.url}/app/settings`);
    const row = page.locator('#assistant-setting');
    await expect(row.getByRole('radio', { name: 'Off' })).toHaveAttribute('aria-checked', 'true');
    await row.getByRole('radio', { name: 'On' }).click();
    await expect(row.getByRole('radio', { name: 'On' })).toHaveAttribute('aria-checked', 'true');
    await expect(row.locator('.inline-err')).not.toBeEmpty();
    const request = page.waitForRequest(r => r.method() === 'PUT' && r.url().endsWith('/settings/preferences') && r.postDataJSON().assistant === 'off');
    await row.getByRole('radio', { name: 'Off' }).click();
    await request;
    await expect(row.getByRole('radio', { name: 'Off' })).toHaveAttribute('aria-checked', 'true');
    expect((await status(ctx)).on).toBe(false);
  } finally { await ctx.close(); }
});

test('assistant alone suppresses the empty threads message', async ({ page }) => {
  const ctx = await startWorld();
  try {
    await signIn(page, ctx);
    await page.goto(`${ctx.server.url}/app/threads`);
    await expect(page.getByText('No threads yet.')).toBeVisible();
    await setAssistant(page, ctx, 'on');
    await page.reload();
    await expect(page.locator('.assistant-row')).toBeVisible();
    await expect(page.getByText('No threads yet.')).toBeHidden();
  } finally { await ctx.close(); }
});
