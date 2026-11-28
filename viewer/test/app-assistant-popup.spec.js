'use strict';

// The assistant pop-up (viewer/pages/assistant-popup.js) against the real hub behind a real
// viewer server: the button's presence, the sheet and side panel, sending, "thinking…", the
// unread dot and the off state.
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

const OLD = '2026-01-01T10:00:00.000Z';
const NEW = '2026-01-01T11:00:00.000Z';

test.describe('assistant pop-up', () => {
  let ctx;
  test.beforeEach(async ({ page }) => { ctx = await startWorld(); await signIn(page, ctx); });
  test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: 'ignoreErrors' }); await ctx.close(); });

  const setting = (page, assistant) => page.evaluate(async (value) => {
    const res = await fetch('/wheelchair/api/settings/preferences', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assistant: value }) });
    if (!res.ok) throw new Error('preferences ' + res.status);
  }, assistant);
  const status = (page) => page.evaluate(async () => (await fetch('/wheelchair/api/assistant')).json());
  async function turnOn(page) {
    await setting(page, 'on');
    const s = await status(page);
    expect(s.on).toBe(true);
    return s.thread;
  }
  const projectPage = async (page) => {
    const made = await ctx.make({ cli: 'claude' });
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
  };
    // A reply only shows after a human line, so each seed starts with one (older than the replies).
  const seedAssistant = async (id, lines) => {
    await ctx.timedTranscript(id, [['human', 'hello', '2025-12-31T00:00:00.000Z'], ...lines]);
  };

  test('button shows on a project thread page, not on the assistant thread page; off adds nothing', async ({ page }) => {
    const id = await turnOn(page);
    await projectPage(page);
    await expect(page.locator('.wc-asst-float')).toBeVisible();
    await page.goto(`${ctx.server.url}/app/thread?id=${id}`);
    await expect(page.locator('#app-nav')).toBeVisible();
    await expect(page.locator('.col-list')).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.locator('.wc-asst-float')).toHaveCount(0);
    await page.goto(`${ctx.server.url}/app/threads`);
    await expect(page.locator('.wc-asst-float')).toBeVisible();
    await setting(page, 'off');
    await page.goto(`${ctx.server.url}/app/agents`);
    await expect(page.locator('#app-nav .seg')).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.locator('.wc-asst-float, .wc-asst-panel')).toHaveCount(0);
  });

  test('turning off removes an open panel without reloading', async ({ page }) => {
    await turnOn(page);
    await page.goto(`${ctx.server.url}/app/threads`);
    await page.locator('.wc-asst-float').click();
    await expect(page.locator('.wc-asst-panel')).toBeVisible();
    await setting(page, 'off');
    await expect(page.locator('.wc-asst-float, .wc-asst-panel')).toHaveCount(0, { timeout: 15000 });
  });

  test('turning on in an open tab and off and on again restores the button', async ({ page }) => {
    test.setTimeout(90000);
    await page.clock.install();
    await projectPage(page);
    await expect(page.locator('.wc-asst-float')).toHaveCount(0);
    await setting(page, 'on');
    await page.clock.fastForward(30000);
    await expect(page.locator('.wc-asst-float')).toBeVisible();
    await setting(page, 'off');
    await page.clock.fastForward(10000);
    await expect(page.locator('.wc-asst-float')).toHaveCount(0);
    await setting(page, 'on');
    await page.clock.fastForward(30000);
    await expect(page.locator('.wc-asst-float')).toBeVisible();
  });

  test('a new restart context line lights the unread dot', async ({ page }) => {
    const id = await turnOn(page);
    await seedAssistant(id, [['assistant', 'Old news', OLD]]);
    let restarted = false;
    await page.route(`**/api/threads/${id}/chat`, async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      if (restarted) data.items.push({ type: 'context', text: 'Assistant restarted · starting fresh', at: NEW });
      await route.fulfill({ response, json: data });
    });
    await page.goto(`${ctx.server.url}/app/threads`);
    await page.locator('.wc-asst-float').click();
    await expect(page.locator('.wc-asst-panel')).toContainText('Old news');
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('.wc-asst-unread')).toBeHidden();
    restarted = true;
    await expect(page.locator('.wc-asst-unread')).toBeVisible({ timeout: 15000 });
  });

  test('keeps a draft until the first chat response arrives', async ({ page }) => {
    const id = await turnOn(page);
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    let intercepted;
    const requested = new Promise((resolve) => { intercepted = resolve; });
    const errors = [];
    const messages = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith(`/threads/${id}/messages`)) messages.push(request);
    });
    await page.route(`**/api/threads/${id}/chat`, async (route) => {
      intercepted();
      await held;
      await route.continue();
    });
    try {
      await page.goto(`${ctx.server.url}/app/threads`);
      await requested;
      await page.locator('.wc-asst-float').click();
      const input = page.getByRole('textbox', { name: 'Message the assistant' });
      const send = page.getByRole('button', { name: 'Send' });
      await input.fill('A draft before loading');
      await expect(send).toBeDisabled();
      await input.press('Enter');
      await send.evaluate((button) => button.click());
      expect(errors).toEqual([]);
      expect(messages).toHaveLength(0);
      await expect(input).toHaveValue('A draft before loading');
      release();
      await expect(send).toBeEnabled();
      const sent = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith(`/threads/${id}/messages`));
      await send.click();
      expect((await sent).postDataJSON()).toEqual({ text: 'A draft before loading' });
    } finally {
      release();
    }
  });

  test('keeps a pending message when earlier transcript text matches', async ({ page }) => {
    const id = await turnOn(page);
    await seedAssistant(id, [['human', 'yes', OLD]]);
    await page.route('**/api/threads/*/messages', (route) => route.fulfill({ status: 200, json: { ok: true } }));
    await page.goto(`${ctx.server.url}/app/threads`);
    await page.locator('.wc-asst-float').click();
    const panel = page.locator('.wc-asst-panel');
    await expect(panel.locator('.wc-asst-human')).toHaveText(['hello', 'yes']);
    await panel.getByRole('textbox', { name: 'Message the assistant' }).fill('yes');
    await panel.getByRole('button', { name: 'Send' }).click();
    await expect(panel.locator('.wc-asst-human')).toHaveText(['hello', 'yes', 'yes']);
  });

  test('renders context, a press, and question consequences and sends an answer', async ({ page }) => {
    const id = await turnOn(page);
    await ctx.transcript(id);
    await ctx.patch(id, (t) => {
      t.cards.push({ id: 'popup-question', kind: 'question', question: 'Which path?', fits: 'Choose a path', why: 'A decision', options: [{ id: 'a', label: 'First', consequence: 'The first consequence' }, { id: 'b', label: 'Second', consequence: 'The second consequence' }], leaning: 'a', at: '2030-01-01T00:00:00.000Z' });
    });
    await page.goto(`${ctx.server.url}/app/threads`);
    await page.locator('.wc-asst-float').click();
    const panel = page.locator('.wc-asst-panel');
    await expect(panel.locator('.wc-asst-context')).toContainText('Lead restarted');
    await expect(panel.locator('.wc-asst-press')).toContainText('Picked Option B');
    const card = panel.locator('[data-card="popup-question"]');
    await expect(card).toContainText('The first consequence');
    await expect(card.getByRole('button', { name: 'Send answer' })).toBeDisabled();
    await card.getByRole('textbox', { name: 'Answer in your own words' }).fill('My own answer');
    const press = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith(`/threads/${id}/cards/popup-question/press`));
    await card.getByRole('button', { name: 'Send answer' }).click();
    expect((await press).postDataJSON()).toEqual({ action: 'answered', value: 'My own answer' });
  });

  test('system needs, file, image and lesson cards retain their content and actions', async ({ page }) => {
    const id = await turnOn(page);
    await seedAssistant(id, [['assistant', 'Cards follow', OLD]]);
    await ctx.patch(id, (t) => {
      t.cards.push(
        { id: 'sys-needs', kind: 'needs', system: true, session: 'wc-demo-lead', blocking: false, title: 'Needs attention', body: 'Review this', items: ['First detail'], at: '2030-01-01T01:00:00.000Z' },
        { id: 'file-card', kind: 'file', title: 'Notes', name: 'notes.txt', file: '123-notes.txt', size: 25, at: '2030-01-01T02:00:00.000Z' },
        { id: 'image-card', kind: 'image', title: 'Picture', file: '456-image.png', mockup: { graph: 'design', width: 390, height: 844 }, at: '2030-01-01T03:00:00.000Z' },
        { id: 'lesson-card', kind: 'lesson', action: 'add', for: 'worker', snapshot: { text: 'Use the log', provider: 'codex', project: '/tmp/project' }, why: 'It helps', at: '2030-01-01T04:00:00.000Z' }
      );
    });
    await page.goto(`${ctx.server.url}/app/threads`);
    await page.locator('.wc-asst-float').click();
    const panel = page.locator('.wc-asst-panel');
    const needs = panel.locator('[data-card="sys-needs"]');
    await expect(needs).toContainText('First detail');
    await expect(needs.getByRole('link', { name: 'Open terminal' })).toHaveAttribute('href', '/wheelchair/app/terminal?name=wc-demo-lead', { timeout: 15000 });
    const file = panel.locator('[data-card="file-card"]');
    await expect(file).toContainText('25 B');
    await expect(file.getByRole('link', { name: 'Preview' })).toHaveAttribute('href', `/wheelchair/app/file?thread=${id}&file=123-notes.txt`);
    await expect(file.getByRole('link', { name: 'Download' })).toHaveAttribute('href', `/wheelchair/api/threads/${id}/files/123-notes.txt`);
    const image = panel.locator('[data-card="image-card"]');
    await expect(image.locator('img')).toHaveAttribute('alt', 'Picture');
    await expect(image).toContainText('Mockup not found');
    await expect(panel.locator('[data-card="lesson-card"]')).toContainText('Use the log');
    await expect(panel.locator('[data-card="lesson-card"]')).toContainText('only in project');
    const dismissed = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith(`/threads/${id}/cards/sys-needs/dismiss`));
    await needs.getByRole('button', { name: 'Dismiss' }).click();
    await dismissed;
  });

  const NOT_USED = 'GPT is set to Not used for heavy in Settings → Models';
  const NO_LADDER = "No enabled provider in this role's provider ladder in Settings → Models";
  const waitFor = (id, reason) => ctx.patch(id, (t) => {
    Object.assign(t.sessions[0], { live: true, ready: false, status: 'waiting', waiting_until: '2099-01-01T00:00:00.000Z', waiting_reason: reason });
  });
  const stopWaiting = (id) => ctx.patch(id, (t) => {
    const s = t.sessions[0];
    delete s.status; delete s.waiting_until; delete s.waiting_reason;
  });

  for (const [name, viewport] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
    test.describe(`configuration wait on ${name}`, () => {
      test.use({ viewport });

      test('shows why the assistant cannot start above the composer, only while it waits on Settings → Models', async ({ page }) => {
        const id = await turnOn(page);
        await seedAssistant(id, [['assistant', 'Hi', OLD]]);
        await waitFor(id, NOT_USED);
        await page.goto(`${ctx.server.url}/app/threads`);
        await page.locator('.wc-asst-float').click();
        const panel = page.locator('.wc-asst-panel');
        const line = panel.locator('.wc-asst-wait');
        await expect(line).toBeVisible();
        await expect(line).toHaveText(NOT_USED + '.');
        const panelBox = await panel.boundingBox();
        const box = await line.boundingBox();
        const composer = await panel.locator('.wc-asst-compose').boundingBox();
        expect(box.y + box.height).toBeLessThanOrEqual(composer.y + 1);
        expect(box.x).toBeGreaterThanOrEqual(panelBox.x);
        expect(box.x + box.width).toBeLessThanOrEqual(panelBox.x + panelBox.width);
        expect(await line.evaluate((n) => n.scrollWidth - n.clientWidth)).toBeLessThanOrEqual(0);
        await waitFor(id, 'GPT is left out in Settings');
        await expect(line).toBeHidden();
        await waitFor(id, NO_LADDER);
        await expect(line).toHaveText(NO_LADDER + '.');
        await expect(line).toBeVisible();
        await stopWaiting(id);
        await expect(line).toBeHidden();
      });
    });
  }

  test('the configuration wait follows the project lead and Assistant switch', async ({ page }) => {
    const id = await turnOn(page);
    await seedAssistant(id, [['assistant', 'Hi', OLD]]);
    await page.evaluate(async () => {
      const res = await fetch('/wheelchair/api/settings/preferences', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ project_leads: 'on' }) });
      if (!res.ok) throw new Error('preferences ' + res.status);
    });
    await waitFor(id, NOT_USED);
    await projectPage(page);
    await page.locator('.wc-asst-float').click();
    const panel = page.locator('.wc-asst-panel');
    const line = panel.locator('.wc-asst-wait');
    const choices = panel.getByRole('group', { name: 'Conversation' }).getByRole('button');
    await expect(choices).toHaveCount(2);
    // The project lead opens first and was never started.
    await expect(choices.first()).toHaveAttribute('aria-pressed', 'true');
    await expect(line).toBeHidden();
    await choices.last().click();
    await expect(line).toHaveText(NOT_USED + '.');
    await choices.first().click();
    await expect(line).toBeHidden();
    await choices.last().click();
    await expect(line).toBeVisible();
  });

  test('the thread page shows a configuration wait as its own reason', async ({ page }) => {
    const made = await ctx.make({ cli: 'claude' });
    await waitFor(made.id, NOT_USED);
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    await expect(page.locator('#lead-wait')).toHaveText(NOT_USED + '.');
  });

  test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });
    async function clearComposer(page) {
      await expect.poll(async () => {
        const b = await page.locator('.wc-asst-float').boundingBox();
        const c = await page.locator('#composer').boundingBox();
        return b && c ? c.y - (b.y + b.height) : -1000;
      }).toBeGreaterThanOrEqual(0);
    }
    const lines = (count) => Array.from({ length: count }, (_, i) => ['human', 'Conversation ' + i, new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString()]);
    for (const [name, count] of [['short', 1], ['long', 30]]) {
      test(`closed button clears the ${name} project composer`, async ({ page }) => {
        await turnOn(page);
        const made = await ctx.make({ cli: 'claude' });
        await ctx.timedTranscript(made.id, lines(count));
        await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
        await expect(page.locator('#chat')).toContainText('Conversation 0');
        await clearComposer(page);
      });
    }
    test('button follows the composer as a short thread grows', async ({ page }) => {
      await turnOn(page);
      const made = await ctx.make({ cli: 'claude' });
      await ctx.timedTranscript(made.id, lines(1));
      await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
      await expect(page.locator('#chat')).toContainText('Conversation 0');
      await clearComposer(page);
      await ctx.timedTranscript(made.id, lines(30));
      await expect(page.locator('#chat')).toContainText('Conversation 29', { timeout: 15000 });
      await clearComposer(page);
    });

    test('opens as a sheet covering nearly the screen, with a close control', async ({ page }) => {
      const id = await turnOn(page);
      await seedAssistant(id, [['assistant', 'Hello from the assistant', OLD]]);
      await page.goto(`${ctx.server.url}/app/threads`);
      await page.locator('.wc-asst-float').click();
      const panel = page.locator('.wc-asst-panel');
      await expect(panel).toBeVisible();
      await expect(panel).toContainText('Hello from the assistant');
      const box = await panel.boundingBox();
      expect(box.width).toBeGreaterThan(390 - 24);
      expect(box.height).toBeGreaterThan(844 - 40);
      await expect(page.locator('.wc-asst-shade')).toBeVisible();
      await expect(page.getByRole('link', { name: /Open thread/ })).toHaveAttribute('href', `/wheelchair/app/thread?id=${id}`);
      await page.getByRole('button', { name: 'Close' }).click();
      await expect(panel).toBeHidden();
      await expect(page.locator('.wc-asst-float')).toBeVisible();
    });
  });

  test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('opens as a side panel and sends text to the assistant thread', async ({ page }) => {
      const id = await turnOn(page);
      await seedAssistant(id, [['assistant', 'Hello from the assistant', OLD]]);
      await page.goto(`${ctx.server.url}/app/threads`);
      await page.locator('.wc-asst-float').click();
      const panel = page.locator('.wc-asst-panel');
      const box = await panel.boundingBox();
      expect(box.width).toBeLessThan(500);
      expect(box.x + box.width).toBeGreaterThan(1280 - 40);
      await expect(page.locator('.wc-asst-shade')).toBeHidden();
      const sent = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith(`/api/threads/${id}/messages`));
      await page.getByRole('textbox', { name: 'Message the assistant' }).fill('where do things stand?');
      await page.getByRole('button', { name: 'Send' }).click();
      expect((await sent).postDataJSON()).toEqual({ text: 'where do things stand?' });
      await expect(panel.locator('.wc-asst-human', { hasText: 'where do things stand?' })).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Message the assistant' })).toHaveValue('');
    });

    test('shows thinking while the lead is mid-turn and not after', async ({ page }) => {
      const id = await turnOn(page);
      await seedAssistant(id, [['assistant', 'Hi', OLD]]);
      await ctx.patch(id, (t) => { Object.assign(t.sessions[0], { live: true, ready: true, turn_ended: true }); });
      await page.goto(`${ctx.server.url}/app/threads`);
      await page.locator('.wc-asst-float').click();
      await expect(page.locator('.wc-asst-panel')).toContainText('Hi');
      await expect(page.locator('.wc-asst-work')).toHaveCount(0);
      await ctx.patch(id, (t) => { t.sessions[0].turn_ended = false; });
      await expect(page.locator('.wc-asst-work')).toContainText('thinking');
      await ctx.patch(id, (t) => { t.sessions[0].turn_ended = true; });
      await expect(page.locator('.wc-asst-work')).toHaveCount(0);
    });

    test('unread dot appears for a newer item and clears on open', async ({ page }) => {
      const id = await turnOn(page);
      await seedAssistant(id, [['assistant', 'Old news', OLD], ['assistant', 'Newer news', NEW]]);
      await page.goto(`${ctx.server.url}/app/threads`);
      await page.evaluate(([key, at]) => localStorage.setItem(key, at), ['wc-seen:' + id, OLD]);
      await page.reload();
      await expect(page.locator('.wc-asst-unread')).toBeVisible();
      await page.locator('.wc-asst-float').click();
      await expect(page.locator('.wc-asst-panel')).toContainText('Newer news');
      expect(await page.evaluate((key) => localStorage.getItem(key), 'wc-seen:' + id)).toBe(NEW);
      await page.getByRole('button', { name: 'Close' }).click();
      await expect(page.locator('.wc-asst-unread')).toBeHidden();
      await page.reload();
      await expect(page.locator('.wc-asst-float')).toBeVisible();
      await page.waitForTimeout(1500);
      await expect(page.locator('.wc-asst-unread')).toBeHidden();
    });

    test('says the assistant is not running and offers Restart', async ({ page }) => {
      const id = await turnOn(page);
      await seedAssistant(id, [['assistant', 'Hi', OLD]]);
      await ctx.patch(id, (t) => { t.sessions = []; });
      await page.goto(`${ctx.server.url}/app/threads`);
      await page.locator('.wc-asst-float').click();
      await expect(page.locator('.wc-asst-stopped')).toContainText("The assistant isn't running");
      await expect(page.getByRole('button', { name: 'Restart' })).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Message the assistant' })).toBeDisabled();
      await page.getByRole('button', { name: 'Restart' }).click();
      await expect(page.getByRole('textbox', { name: 'Message the assistant' })).toBeEnabled();
    });
  });
});

test('poll does not allow a second send while a message is in flight', async ({ page }) => {
  const ctx = await startWorld();
  let release;
  try {
    await signIn(page, ctx);
    await page.evaluate(() => fetch('/wheelchair/api/settings/preferences', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assistant: 'on' }) }));
    const id = await page.evaluate(async () => (await (await fetch('/wheelchair/api/assistant')).json()).thread);
    let count = 0, polls = 0;
    const held = new Promise((resolve) => { release = resolve; });
    await page.route(`**/api/threads/${id}/messages`, async (route) => { count++; await held; await route.fulfill({ json: { ok: true } }); });
    await page.route(`**/api/threads/${id}/chat`, async (route) => { polls++; await route.continue(); });
    await page.goto(`${ctx.server.url}/app/threads`);
    await page.locator('.wc-asst-float').click();
    const send = page.getByRole('button', { name: 'Send' });
    await page.getByRole('textbox', { name: 'Message the assistant' }).fill('Only once');
    await expect(send).toBeEnabled();
    await send.click();
    await expect.poll(() => count).toBe(1);
    const before = polls;
    await expect.poll(() => polls, { timeout: 15000 }).toBeGreaterThan(before);
    await expect(send).toBeDisabled();
    await send.evaluate((button) => button.click());
    expect(count).toBe(1);
  } finally { if (release) release(); await page.unrouteAll({ behavior: 'ignoreErrors' }); await ctx.close(); }
});

test('sending preserves a different draft typed while the request is in flight', async ({ page }) => {
  const ctx = await startWorld();
  let release;
  try {
    await signIn(page, ctx);
    await page.evaluate(() => fetch('/wheelchair/api/settings/preferences', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assistant: 'on' }) }));
    const id = await page.evaluate(async () => (await (await fetch('/wheelchair/api/assistant')).json()).thread);
    let received = false;
    const held = new Promise(resolve => { release = resolve; });
    await page.route(`**/api/threads/${id}/messages`, async route => { received = true; await held; await route.fulfill({ json: { ok: true } }); });
    await page.goto(`${ctx.server.url}/app/threads`);
    await page.locator('.wc-asst-float').click();
    const input = page.getByRole('textbox', { name: 'Message the assistant' });
    await input.fill('First message');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect.poll(() => received).toBe(true);
    await input.fill('Second draft');
    release();
    await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled();
    await expect(input).toHaveValue('Second draft');
  } finally { if (release) release(); await page.unrouteAll({ behavior: 'ignoreErrors' }); await ctx.close(); }
});
