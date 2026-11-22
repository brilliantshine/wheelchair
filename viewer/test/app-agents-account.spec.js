'use strict';

// The Agents side panel names the account an agent is on and where it moved from, with /api/agents mocked.
const { test, expect } = require('@playwright/test');
const { closeViews, openPage, setupViews } = require('./helpers/app-views-setup.js');

let context;
test.beforeAll(async () => { context = await setupViews(); });
test.afterAll(async () => { await closeViews(context); });

const at = new Date(Date.UTC(2026, 10, 18, 9, 0)).toISOString();
const worker = (name, extra) => ({ name, role: 'worker', display_title: `worker ${name}`, live: true, state: 'working', created_at: at, children: [], ...extra });
const data = { leads: [{ thread_id: 'a', thread_title: 'A thread', lead_name: 'Alpha', project: 'p', stage: 'building', counts: { total: 5 }, rounds: { review: {} }, asides: [], session: { name: 'lead-a', role: 'lead', display_title: 'Lead', live: true, state: 'working', created_at: at, children: [
  worker('plain', { account_name: 'Work', moved_from: null }),
  worker('moved', { account_name: 'Home', moved_from: 'Work' }),
  worker('gone', { account_name: 'a removed account', moved_from: 'a removed account' }),
  worker('waiting', { account_name: null, moved_from: null }),
] } }], machines: [] };

test('side panel shows the account and the latest move', async ({ page }) => {
  await page.route('**/api/agents', route => route.fulfill({ json: data }));
  const side = page.locator('.agents-side');
  const pick = async (name) => { await openPage(page, context, `/app/agents?lead=a&agent=${name}`); await expect(side).toContainText(`worker ${name}`); };
  await pick('plain');
  await expect(side).toContainText('Account: Work');
  await expect(side).not.toContainText('moved from');
  await pick('moved');
  await expect(side).toContainText('Account: Home · moved from Work');
  await pick('gone');
  await expect(side).toContainText('Account: a removed account · moved from a removed account');
  await pick('waiting');
  await expect(side).not.toContainText('Account:');
});
