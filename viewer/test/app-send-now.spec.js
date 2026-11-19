'use strict';

// Send now and the composer's pending bubbles, across the races between the send reply, the
// chat poll and the lead's transcript.
const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

const row = (text) => JSON.stringify({ type: 'attachment', timestamp: new Date().toISOString(), attachment: { type: 'queued_command', prompt: text, commandMode: 'prompt', origin: { kind: 'human' } } }) + '\n';
let ctx;
test.beforeEach(async ({ page }) => { ctx = await startWorld(); await signIn(page, ctx); });
test.afterEach(async () => { await ctx.close(); });
async function open(page, text, copies = 1, source = 'user') {
  const made = await ctx.make({ cli: 'claude' });
  const file = path.join(ctx.state, made.id + '.jsonl');
  await fs.writeFile(file, '');
  await ctx.patch(made.id, (t) => {
    Object.assign(t.sessions[0], { transcript_path: file, cli: 'claude', ready: true, turn_ended: false, queue: Array.from({ length: copies }, (_, i) => ({ text, source, at: new Date(Date.now() + i).toISOString() })) });
    t.queues = { [t.sessions[0].name]: t.sessions[0].queue };
  });
  await page.goto(ctx.server.url + '/app/thread?id=' + made.id);
  await expect(page.locator('.send-now')).toHaveCount(copies);
  return { file, made };
}
test('a rejected machine submission leaves exactly one queued bubble', async ({ page }) => {
  await open(page, 'retry me');
  ctx.machine.submitOk = false;
  const response = page.waitForResponse((r) => r.url().endsWith('/send-now'));
  await page.locator('.send-now').click();
  expect(await (await response).json()).toEqual({ sent: false });
  await expect(page.locator('.send-now')).toHaveText('Send now');
  await expect(page.locator('#chat .pending .tag')).toHaveText(['queued'], { timeout: 1500 });
});
test('a chat poll ahead of the send response does not leave a duplicate', async ({ page }) => {
  const { file } = await open(page, 'arrived quickly');
  await page.route('**/send-now', async (route) => {
    const response = await route.fetch();
    expect(await response.json()).toEqual({ sent: true });
    await fs.appendFile(file, row('arrived quickly'));
    await expect(page.locator('#chat .human:not(.pending)')).toHaveText('arrived quickly');
    await route.fulfill({ response });
  });
  await page.locator('.send-now').click();
  await page.waitForResponse((r) => r.url().endsWith('/send-now'));
  await expect(page.locator('#chat .human')).toHaveCount(1, { timeout: 4500 });
});
test('a later identical send remains visible while only the earlier send is in the transcript', async ({ page }) => {
  const { file } = await open(page, 'same', 2);
  await page.locator('.send-now').first().click();
  await expect(page.locator('#chat .pending .tag')).toHaveText(['sent', 'queued']);
  await page.locator('.send-now').click();
  await expect(page.locator('#chat .pending .tag')).toHaveText(['sent', 'sent']);
  await fs.appendFile(file, row('same'));
  await expect(page.locator('#chat .pending .tag')).toHaveText(['sent']);
  await page.waitForResponse((r) => r.url().endsWith('/chat'));
  await expect(page.locator('#chat .pending .tag')).toHaveText(['sent']);
});
test('a regular composer send already shown by a poll does not get a queued duplicate', async ({ page }) => {
  const { file, made } = await open(page, '', 0);
  await ctx.patch(made.id, (t) => { t.sessions[0].turn_ended = true; });
  await page.route('**/messages', async (route) => {
    const response = await route.fetch();
    expect(response.status()).toBe(202);
    expect(ctx.machine.sessions.get(made.sessions[0].name).submits).toEqual(['regular fast prompt']);
    await fs.appendFile(file, JSON.stringify({type: 'user', origin: {kind: 'human'}, timestamp: new Date().toISOString(), message: {role: 'user', content: 'regular fast prompt'}}) + '\n');
    await expect(page.locator('#chat .human:not(.pending)')).toHaveText('regular fast prompt');
    await route.fulfill({ response });
  });
  await page.locator('#msg').fill('regular fast prompt');
  await page.locator('#send').click();
  await expect(page.locator('#msg')).toHaveValue('');
  await expect(page.locator('#chat .human')).toHaveCount(1, { timeout: 4500 });
  await expect(page.locator('#queued-note')).toBeHidden();
});

test('an old queued message remains pending and can be sent now', async ({ page }) => {
  const { made } = await open(page, 'old queued message', 1, 'collin');
  await page.locator('.send-now').click();
  await expect(page.locator('#chat .pending .tag')).toHaveText(['sent']);
  expect(ctx.machine.sessions.get(made.sessions[0].name).submits).toContain('old queued message');
});
