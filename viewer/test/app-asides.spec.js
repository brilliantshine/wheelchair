'use strict';
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

test('selection, aside links, rebuilding and finishing', async ({ page }) => {
  const ctx = await startWorld();
  try {
    const made = await ctx.make({ cli: 'claude' });
    const now = new Date().toISOString();
    await ctx.timedTranscript(made.id, [['human', 'Hello', now], ['assistant', 'First **important words** here.', now], ['assistant', 'Second message.', now], ['human', 'I agree (from aside 1 on: "important words")', now]]);
    await ctx.patch(made.id, t => { t.cards.push({ id: 'q1', kind: 'question', question: 'Which option?', options: [], at: now, answered: false }); });
    let aside = null, posted, closed, rebuild = false, answered = false, archived = false;
    await page.route('**/api/threads/*/chat', async route => { const response = await route.fetch(); const json = await response.json(); json.asides = aside ? [aside] : []; json.thread.archived = archived; if (answered) json.cards.find(c => c.id === 'q1').answered = true; if (rebuild) json.items.push({ type: 'human', text: 'New message', at: now }); await route.fulfill({ response, json }); });
    await page.route('**/api/threads/*/asides**', async route => {
      const req = route.request(); const url = new URL(req.url());
      if (req.method() === 'POST' && url.pathname.endsWith('/asides')) { posted = req.postDataJSON(); aside = { id: 'a1', number: 1, anchor: { message_id: posted.message_id, start: posted.start, end: posted.end, quote: posted.quote }, created_at: now, status: 'open', slot: 'standard', cli_id: 'cli', history: [], turn: null, failed: null, heavy_usable: false }; await route.fulfill({ status: 201, json: aside }); }
      else if (url.pathname.endsWith('/close')) { closed = req.postDataJSON(); aside.status = 'closed'; aside.outcome = closed.outcome; await route.fulfill({ json: { ok: true } }); }
      else await route.fulfill({ json: aside });
    });
    await signIn(page, ctx); await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    const bubbles = page.locator('.bubble.assistant[data-message-id]'); await expect(bubbles).toHaveCount(2);
    await page.evaluate(() => { const bs = document.querySelectorAll('.bubble.assistant'); const r = document.createRange(); r.setStart(bs[0].querySelector('p').firstChild, 0); r.setEnd(bs[1].querySelector('p').firstChild, 3); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new Event('selectionchange')); });
    await expect(page.locator('.aside-selection')).toBeHidden();
    await page.evaluate(() => { const b = document.querySelector('.bubble.assistant'); const node = b.querySelector('strong').firstChild; const r = document.createRange(); r.selectNodeContents(node); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new Event('selectionchange')); });
    await expect(page.locator('.aside-selection')).toBeVisible(); await page.getByRole('button', { name: 'Ask about this', exact: true }).click();
    await expect.poll(() => posted).toEqual({ message_id: await bubbles.first().getAttribute('data-message-id'), start: 6, end: 21, quote: 'important words', action: 'ask' });
    await expect(page.getByLabel('Ask more about this')).toBeFocused();
    aside.history.push({ kind: 'ask', text: 'why', reply: 'answer' });
    await expect(page.locator('#aside-panel')).toContainText('answer', { timeout: 7000 }); await expect(page.getByLabel('Ask more about this')).toBeFocused();
    await expect(page.getByRole('button', { name: 'Think harder' })).toBeDisabled();
    await expect(page.locator('#aside-panel')).toContainText('important words'); await expect(page.locator('#aside-panel')).toContainText('Waiting on: Which option?');
    answered = true; await expect(page.locator('#aside-panel')).not.toContainText('Waiting on: Which option?', { timeout: 7000 });
    await expect(page.locator('#aside-panel .aside-wait')).toHaveText(/Nothing is waiting on you|The lead is working/);
    answered = false; await expect(page.locator('#aside-panel')).toContainText('Waiting on: Which option?', { timeout: 7000 });
    archived = true;
    await expect(page.getByLabel('Ask more about this')).toBeDisabled({ timeout: 7000 });
    await expect(page.locator('#aside-panel').getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
    archived = false; await expect(page.getByLabel('Ask more about this')).toBeEnabled({ timeout: 7000 });
    await page.getByRole('button', { name: 'Close aside' }).click(); rebuild = true;
    await expect(page.locator('.aside-mark')).toHaveText('important words', { timeout: 7000 }); await page.locator('.aside-mark').click(); await expect(page.locator('#aside-panel')).toBeVisible();
    await page.getByRole('button', { name: 'Done, back to your question' }).click(); await expect.poll(() => closed).toEqual({ outcome: 'done' });
    await page.setViewportSize({ width: 390, height: 844 }); await page.locator('.aside-handoff').click(); await expect(page.locator('#aside-panel')).toBeVisible(); await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeVisible();
    const box = await page.locator('.col-side').boundingBox(); expect(box.width).toBe(390); expect(box.height).toBe(844);
  } finally { await page.unrouteAll({ behavior: 'ignoreErrors' }); await ctx.close(); }
});

test('archiving makes all aside controls read-only and hides creation controls', async ({ page }) => {
  const ctx = await startWorld();
  try {
    const made = await ctx.make({ cli: 'claude' });
    const now = new Date().toISOString();
    await ctx.timedTranscript(made.id, [['human', 'Hello', now], ['assistant', 'Words to discuss.', now]]);
    let archived = false;
    const aside = { id: 'a1', number: 1, anchor: { message_id: '', start: 0, end: 5, quote: 'Words' }, created_at: now, status: 'open', slot: 'standard', cli_id: 'cli', heavy_usable: true, history: [{ kind: 'ask', text: 'why', reply: 'answer' }], turn: null, failed: null };
    await page.route('**/api/threads/*/chat', async route => {
      const response = await route.fetch(); const json = await response.json();
      aside.anchor.message_id = json.items.find(item => item.role === 'assistant' || item.type === 'assistant')?.message_id || aside.anchor.message_id;
      json.asides = [aside]; json.thread.archived = archived; await route.fulfill({ response, json });
    });
    await page.route('**/api/threads/*/asides**', async route => {
      if (route.request().url().endsWith('/summary')) aside.history.push({ kind: 'control', reply: 'Changed answer' });
      await route.fulfill({ json: aside });
    });
    await signIn(page, ctx); await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    await page.getByRole('button', { name: /1 asides/ }).click();
    await page.getByRole('button', { name: /Aside 1 ·/ }).click();
    const panel = page.locator('#aside-panel');
    for (const name of ['Think harder', 'Done, back to the thread', 'This changes my answer']) await expect(panel.getByRole('button', { name })).toBeEnabled();
    await panel.getByRole('button', { name: 'This changes my answer' }).click();
    await expect(panel.getByLabel('Your changed answer')).toHaveValue('Changed answer');
    archived = true;
    await expect(panel.getByLabel('Ask more about this')).toBeDisabled({ timeout: 7000 });
    await expect(panel.locator('.aside-form button')).toBeDisabled();
    await expect(panel.getByLabel('Your changed answer')).toBeDisabled();
    await expect(panel.locator('.aside-draft').getByRole('button', { name: 'Send' })).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    for (const name of ['Think harder', 'Done, back to the thread', 'This changes my answer']) await expect(panel.getByRole('button', { name })).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Close aside' })).toBeEnabled();
    aside.failed = 'Failed';
    await expect(panel.getByRole('button', { name: 'Retry' })).toBeDisabled({ timeout: 7000 });
    await page.evaluate(() => { const node = document.querySelector('.bubble.assistant p').firstChild; const range = document.createRange(); range.selectNodeContents(node); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); document.dispatchEvent(new Event('selectionchange')); });
    await expect(page.locator('.aside-selection')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Ask about this message' })).toHaveCount(0);
  } finally { await page.unrouteAll({ behavior: 'ignoreErrors' }); await ctx.close(); }
});
