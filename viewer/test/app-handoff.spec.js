'use strict';
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

test.use({ viewport: { width: 390, height: 844 } });
let ctx;
test.beforeEach(async ({ page }) => { ctx = await startWorld(); await signIn(page, ctx); });
test.afterEach(async () => { await ctx.close(); });

async function thread(page, changes = {}) {
  const made = await ctx.make({ cli: 'claude' });
  await page.route('**/api/threads/*/chat', async (route) => {
    const response = await route.fetch(); const data = await response.json();
    Object.assign(data.thread, changes); await route.fulfill({ response, json: data });
  });
  return made.id;
}

test('export reason, confirmation and filename', async ({ page }) => {
  const id = await thread(page, { export: { ok: false, reason: 'Still busy.' } });
  await page.goto(`${ctx.server.url}/app/thread?id=${id}`);
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeDisabled();
  await expect(page.locator('#head')).toContainText('Still busy.');
  await page.unroute('**/api/threads/*/chat');
  await page.route('**/api/threads/*/chat', async (route) => { const response = await route.fetch(); const data = await response.json(); data.thread.export = { ok: true }; await route.fulfill({ response, json: data }); });
  await page.route('**/api/threads/*/export', (route) => route.fulfill({ contentType: 'application/json', headers: { 'content-disposition': 'attachment; filename="work.json"' }, body: '{}' }));
  await page.reload(); await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.locator('#head')).toContainText('Export and hand off?');
  const download = page.waitForEvent('download'); const refreshed = page.waitForResponse((response) => response.url().endsWith('/chat'));
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('work.json'); await refreshed;
});

test('banner states, undo, download and retry', async ({ page }) => {
  const id = await thread(page, { handed_off: { at: '2026-01-01T00:00:00Z', head: 'a', stage: 'idea' } });
  let state = 'unchanged';
  await page.route('**/api/threads/*/handoff', (route) => route.fulfill({ json: { state, at: '2026-01-01T00:00:00Z', picked_up_at: '2026-01-02T00:00:00Z' } }));
  await page.route('**/api/threads/*/handoff-file', (route) => route.fulfill({ headers: { 'content-disposition': 'attachment; filename="again.json"' }, body: '{}' }));
  await page.route('**/api/threads/*/undo-handoff', (route) => route.fulfill({ status: 409, json: { error: 'Cannot undo.' } }));
  await page.goto(`${ctx.server.url}/app/thread?id=${id}`);
  await expect(page.locator('#handoff')).toContainText('Handed off');
  await page.getByRole('button', { name: 'Undo hand-off' }).click(); await expect(page.locator('#error')).toHaveText('Cannot undo.');
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download the file again' }).click(); expect((await download).suggestedFilename()).toBe('again.json');
  for (const [next, text, undo] of [['moved', 'Picked up elsewhere', false], ['own-cancelled', 'earlier cancelled import', true], ['inspect-failed', 'Handed off', true]]) {
    state = next; await page.reload(); await expect(page.locator('#handoff')).toContainText(text); await expect(page.getByRole('button', { name: 'Undo hand-off' })).toHaveCount(undo ? 1 : 0);
  }
  await page.unroute('**/api/threads/*/chat');
  await page.route('**/api/threads/*/chat', async (route) => { const response = await route.fetch(); const data = await response.json(); Object.assign(data.thread, { handoff_op: { kind: 'undo', last_error: 'Try later.', can_cancel: true } }); await route.fulfill({ response, json: data }); });
  await page.route('**/api/threads/*/retry-handoff', (route) => route.fulfill({ status: 409, json: { error: 'Retry failed.' } }));
  await page.route('**/api/threads/*/cancel-handoff', (route) => route.fulfill({ status: 409, json: { error: 'Cancel failed.' } }));
  await page.reload(); await expect(page.locator('#handoff-retry')).toContainText("The undo didn't finish."); await expect(page.locator('#handoff-retry')).toContainText('Try later.');
  await page.getByRole('button', { name: 'Retry', exact: true }).click(); await expect(page.locator('#error')).toHaveText('Retry failed.');
  page.once('dialog', (dialog) => dialog.accept()); await page.locator('#handoff-retry').getByRole('button', { name: 'Cancel' }).click(); await expect(page.locator('#error')).toHaveText('Cancel failed.');
});

test('imported history is collapsed and plain text', async ({ page }) => {
  const id = await thread(page, { imported: { at: '2026-01-01T00:00:00Z', history: [{ at: '2025-01-01', who: 'lead', text: '<b>hello</b>' }] } });
  await page.goto(`${ctx.server.url}/app/thread?id=${id}`);
  const history = page.locator('#before-handoff'); await expect(history).not.toHaveAttribute('open'); await history.locator('summary').click();
  await expect(history).toContainText('<b>hello</b>'); await expect(history.locator('b, button')).toHaveCount(0);
});

test('import opened and created use selected project and raw file', async ({ page }) => {
  await page.route('**/api/new-thread?*', (route) => route.fulfill({ json: { machine: 'hub', machines: ['hub'], default_folder: '', saved: [{ name: 'alpha', path: '/alpha' }], found: [], previous: [] } }));
  let outcome = 'opened'; let body;
  await page.route('**/api/threads/import?*', (route) => { body = route.request().postData(); return route.fulfill({ json: { outcome, id: 'abc', note: 'Already here.' } }); });
  await page.goto(`${ctx.server.url}/app/new`); await expect(page.locator('#nt-import')).toBeEnabled();
  await page.locator('#handoff-file').setInputFiles({ name: 'work.json', mimeType: 'application/json', buffer: Buffer.from('{"x":1}') });
  await expect(page.locator('#import-result')).toContainText('Already here.'); await expect(page.getByRole('link', { name: 'Open the thread' })).toHaveAttribute('href', /id=abc/); expect(body).toBe('{"x":1}');
  outcome = 'created'; await page.locator('#handoff-file').setInputFiles({ name: 'work.json', mimeType: 'application/json', buffer: Buffer.from('{}') }); await expect(page).toHaveURL(/id=abc/);
});

test('list shows handoff and dismisses notice', async ({ page }) => {
  const made = await ctx.make({ cli: 'claude' });
  await page.route('**/api/threads?view=list', async (route) => { const response = await route.fetch(); const data = await response.json(); data.threads.find((t) => t.id === made.id).handed_off = {}; data.revoke_notices = [{ thread_id: made.id, sha: 'abc', text: 'Notice.' }]; await route.fulfill({ response, json: data }); });
  await page.route('**/api/handoff-revokes/dismiss', (route) => route.fulfill({ json: { ok: true } }));
  await page.goto(`${ctx.server.url}/app/threads`); await expect(page.locator(`[data-id="${made.id}"]`)).toContainText('handed off');
  const req = page.waitForRequest('**/api/handoff-revokes/dismiss'); await page.getByRole('button', { name: 'Dismiss' }).click(); expect((await req).postDataJSON()).toEqual({ thread_id: made.id, sha: 'abc' }); await expect(page.getByText('Notice.')).toHaveCount(0);
});
