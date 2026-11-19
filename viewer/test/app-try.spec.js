'use strict';
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

test.use({ viewport: { width: 390, height: 844 } });
let ctx;
test.beforeEach(async ({ page }) => { ctx = await startWorld(); await signIn(page, ctx); });
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: 'ignoreErrors' }); await ctx.close(); });

const S = (changes = {}) => ({
  version: 'v1', state: 'none', active_thread_id: null, active_thread_title: null, active_commit: null,
  target_available: true, newest: false, refused: null, earlier_branch: null, files: [], files_count: 0,
  index_lock: null, last: null, kept: [], ...changes,
});

// A fake /try: `fake.status` is what GET answers; `fake.write(body)` answers a POST.
async function setup(page, status, extra = {}) {
  const made = await ctx.make({ cli: 'claude' });
  const fake = { status, gets: 0, posts: [], write: null, getFail: null };
  await page.route('**/api/threads/*/try', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      fake.gets += 1;
      if (fake.getFail) return route.fulfill({ status: 502, json: { error: fake.getFail } });
      return route.fulfill({ json: fake.status });
    }
    const body = JSON.parse(req.postData() || '{}'); fake.posts.push(body);
    const answer = fake.write ? await fake.write(body) : { status: 200, json: { ok: true, status: fake.status } };
    return route.fulfill(answer);
  });
  if (extra.archived) {
    await page.route('**/api/threads/*/chat', async (route) => {
      const response = await route.fetch(); const data = await response.json();
      data.thread.archived = true; await route.fulfill({ response, json: data });
    });
  }
  await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
  return fake;
}
const panel = (page) => page.locator('#copy');
const noOverflow = async (page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.evaluate(() => { const p = document.getElementById('copy'); return p.scrollWidth <= p.clientWidth; })).toBe(true);
};

test('shows status sentences and Try confirmation names folder and machine', async ({ page }) => {
  const fake = await setup(page, S());
  await expect(panel(page)).toContainText('Your copy');
  await panel(page).getByRole('button', { name: 'Try it in my copy' }).click();
  await expect(panel(page)).toContainText('/tmp/project');
  await expect(panel(page)).toContainText('hub');
  await expect(panel(page)).toContainText('Close any app using the folder');
  await expect(panel(page)).toContainText('merged work so far');
  await panel(page).getByRole('button', { name: 'Cancel' }).click();
  expect(fake.posts).toEqual([]);
  fake.status = S({ state: 'trying-other', active_thread_title: 'Other work' });
  await panel(page).getByRole('button', { name: 'Refresh' }).click();
  await expect(panel(page)).toContainText('Your copy is showing another thread: Other work.');
  fake.status = S({ state: 'trying-this', active_commit: 'abcdef0123456789', newest: true });
  await panel(page).getByRole('button', { name: 'Refresh' }).click();
  await expect(panel(page)).toContainText("this thread's merged work as of abcdef0.");
  await expect(panel(page).getByRole('button', { name: 'Get newest' })).toBeVisible();
  await expect(panel(page).getByRole('button', { name: 'Switch back' })).toBeVisible();
  await noOverflow(page);
});

test('does not re-read on the page poll timer', async ({ page }) => {
  const fake = await setup(page, S());
  await expect(panel(page)).toContainText('Your copy');
  const before = fake.gets;
  await page.waitForTimeout(5000);
  expect(fake.gets).toBe(before);
});

test('kept list with Delete sends version and ref after confirmation', async ({ page }) => {
  const fake = await setup(page, S({ kept: [
    { ref: 'refs/wheelchair/kept/a/b', label: 'commits made while trying thread x', at: '2026-01-02T00:00:00Z', missing: true, old_identity: false },
    { ref: 'refs/wheelchair/kept/a/c', label: 'where your copy was before trying thread y', at: '2026-01-03T00:00:00Z', missing: false, old_identity: true },
  ] }));
  await expect(panel(page)).toContainText('commits made while trying thread x');
  await expect(panel(page)).toContainText('missing');
  await expect(panel(page)).toContainText('in the copy that used to be here');
  await panel(page).getByRole('button', { name: 'Delete' }).first().click();
  await expect(panel(page)).toContainText('Delete this saved commit?');
  expect(fake.posts).toEqual([]);
  await panel(page).getByRole('button', { name: 'Confirm delete' }).click();
  await expect.poll(() => fake.posts.length).toBe(1);
  expect(fake.posts[0]).toEqual({ action: 'forget', version: 'v1', kept: 'refs/wheelchair/kept/a/b' });
});

test('Switch back works from an archived thread and Try is hidden there', async ({ page }) => {
  const fake = await setup(page, S({ state: 'trying-other', active_thread_title: 'Other' }), { archived: true });
  await expect(panel(page)).toContainText('another thread: Other');
  await expect(panel(page).getByRole('button', { name: 'Try it in my copy' })).toHaveCount(0);
  await panel(page).getByRole('button', { name: 'Switch back' }).click();
  await expect(panel(page)).toContainText('Close any app using the folder');
  await panel(page).getByRole('button', { name: 'Confirm' }).click();
  await expect.poll(() => fake.posts.length).toBe(1);
  expect(fake.posts[0]).toEqual({ action: 'back', version: 'v1' });
});

test('Switching shows while waiting, polls while busy, then shows last', async ({ page }) => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const fake = await setup(page, S());
  fake.write = async () => { await gate; fake.status = S({ state: 'busy' }); return { status: 200, json: { accepted: true, status: fake.status } }; };
  await panel(page).getByRole('button', { name: 'Try it in my copy' }).click();
  await panel(page).getByRole('button', { name: 'Confirm' }).click();
  await expect(panel(page)).toContainText('Switching…');
  await expect(panel(page).getByRole('button', { name: 'Refresh' })).toBeDisabled();
  release();
  await expect(panel(page)).toContainText('Switching…');
  expect(fake.posts[0]).toEqual({ action: 'try' });
  fake.status = S({ state: 'trying-this', active_commit: '1234567890', last: { op: 'try', thread_id: 'x', at: 'now', outcome: 'warning', reason: 'It switched, but these files have changes.', files: ['a.txt', 'b.txt'], files_count: 5 } });
  await expect(panel(page)).toContainText('It switched, but these files have changes.', { timeout: 8000 });
  await expect(panel(page)).toContainText('and 3 more');
  await expect(panel(page)).not.toContainText('Switching…');
});

test('Back success lists files that appeared', async ({ page }) => {
  await setup(page, S({ last: { op: 'back', thread_id: 'x', at: 'now', outcome: 'success', reason: 'Switched back.', appeared: ['z.bin'], appeared_count: 1 } }));
  await expect(panel(page)).toContainText('These files appeared after switching back');
  await expect(panel(page)).toContainText('z.bin');
});

test('errors: refusal reason, machine unreachable, with a re-read', async ({ page }) => {
  const fake = await setup(page, S());
  fake.write = async () => ({ status: 200, json: { accepted: false, reason: 'Your copy changed since this page loaded.', status: fake.status } });
  await panel(page).getByRole('button', { name: 'Try it in my copy' }).click();
  await panel(page).getByRole('button', { name: 'Confirm' }).click();
  await expect(panel(page).locator('.card-error')).toHaveText('Your copy changed since this page loaded.');
  const gets = fake.gets;
  fake.write = async () => ({ status: 502, json: { error: "Can't reach hub." } });
  await panel(page).getByRole('button', { name: 'Try it in my copy' }).click();
  await panel(page).getByRole('button', { name: 'Confirm' }).click();
  await expect(panel(page).locator('.card-error')).toHaveText("Can't reach hub.");
  await expect.poll(() => fake.gets).toBeGreaterThan(gets);
  await expect(panel(page).getByRole('button', { name: 'Try it in my copy' })).toBeEnabled();
});

test('a refused write shows the reason and re-reads Status once', async ({ page }) => {
  const fake = await setup(page, S());
  fake.write = async () => ({ status: 200, json: { accepted: false, reason: 'Your copy changed since this page loaded.', status: fake.status } });
  await panel(page).getByRole('button', { name: 'Try it in my copy' }).click();
  const gets = fake.gets;
  await panel(page).getByRole('button', { name: 'Confirm' }).click();
  await expect(panel(page).locator('.card-error')).toHaveText('Your copy changed since this page loaded.');
  await expect.poll(() => fake.gets).toBe(gets + 1);
  await page.waitForTimeout(500);
  expect(fake.gets).toBe(gets + 1);
  await expect(panel(page).locator('.card-error')).toHaveText('Your copy changed since this page loaded.');
});

test('refused is shown instead of Try; Done and Dismiss send the version', async ({ page }) => {
  const fake = await setup(page, S({ refused: 'This folder runs wheelchair itself; switching it would swap the running app for untested code.' }));
  await expect(panel(page)).toContainText('This folder runs wheelchair itself');
  await expect(panel(page).getByRole('button', { name: 'Try it in my copy' })).toHaveCount(0);
  fake.status = S({ state: 'interrupted', files: ['a', 'b'], files_count: 2, earlier_branch: 'main', index_lock: '/tmp/project/.git/index.lock' });
  await panel(page).getByRole('button', { name: 'Refresh' }).click();
  await expect(panel(page)).toContainText('A switch was interrupted.');
  await expect(panel(page)).toContainText('main');
  await expect(panel(page)).toContainText('Git left a lock file: /tmp/project/.git/index.lock');
  await panel(page).getByRole('button', { name: 'Done' }).click();
  await expect.poll(() => fake.posts.length).toBe(1);
  expect(fake.posts[0]).toEqual({ action: 'dismiss', version: 'v1' });
  fake.status = S({ state: 'stale' });
  await panel(page).getByRole('button', { name: 'Refresh' }).click();
  await panel(page).getByRole('button', { name: 'Dismiss' }).click();
  await expect.poll(() => fake.posts.length).toBe(2);
});

test('nothing overflows at phone width with long paths', async ({ page }) => {
  const long = '/very/long/' + 'directory/'.repeat(12) + 'file.txt';
  await setup(page, S({ state: 'interrupted', files: [long, long], files_count: 90, earlier_branch: 'feature/' + 'x'.repeat(80), index_lock: '/tmp/' + 'y'.repeat(120) + '/.git/index.lock',
    kept: [{ ref: 'refs/wheelchair/kept/' + 'h'.repeat(70) + '/abcd1234', label: 'commits made while trying thread', at: '2026-01-02T00:00:00Z', missing: false, old_identity: false }] }));
  await expect(panel(page)).toContainText('and 88 more');
  await noOverflow(page);
});
