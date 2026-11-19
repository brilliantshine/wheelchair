'use strict';

// The Project tools section of Settings, against a real viewer server whose hub routes for the
// picker and /project-tools/* are stubbed in the page (page.route), recording request bodies.
const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { makeDir, startServer } = require('./helpers/server.js');
const { openPage } = require('./helpers/app-views-setup.js');

let context;
test.beforeAll(async () => {
  const state = await makeDir('app-project-tools-state-');
  await fs.writeFile(path.join(state, 'projects.json'), JSON.stringify([]));
  const server = await startServer({ stateDir: state });
  context = { state, server };
});
test.afterAll(async () => { await context.server.stop(); });

const SERVERS = () => ({
  db: { command: 'npx', args: ['-y', 'db-mcp'], env: { DB_TOKEN: '${DB_TOKEN}', MODE: 'ro' }, timeout: 5 },
  web: {
    type: 'http', url: 'https://x.example/mcp', extra: true,
    headers: { Authorization: 'Bearer ${API_KEY}', 'X-Weird': 'a ${A} b ${B}', 'X-Plain': '1' },
  },
});
const readBody = (over = {}) => ({
  mode: 'tools', notice: null, repo: 'o/n', default_branch: 'main',
  token: { project: '/p', baseline: { repo: 'o/n', source_state: 'ok', branch: 'main', mode: '100644', oid: 'abc' }, key_revision: 1 },
  source: { state: 'ok', reason: null, document: { other: 1, mcpServers: SERVERS() } },
  checks: {}, file_warnings: [], keys: ['API_KEY'],
  references: { DB_TOKEN: ['db'], API_KEY: ['web', 'other-tool'] },
  reserved: { exact: ['PATH'], prefixes: ['GIT_'] },
  waiting: [], waiting_error: null,
  ...over,
});

// Stubs the picker and /project-tools/*; `replies` queues [status, body] for save/remove-key.
async function stub(page, { read = readBody(), replies = [] } = {}) {
  const calls = { read: [], save: [], remove: [] };
  await page.route('**/wheelchair/api/new-thread*', (route) => route.fulfill({ json: {
    machine: 'hub', machines: ['hub', 'node-2'], default_folder: '/tmp', saved: [{ name: 'alpha', path: '/tmp/proj-alpha' }], found: [], previous: [] } }));
  await page.route('**/wheelchair/api/project-tools/*', async (route) => {
    const kind = new URL(route.request().url()).pathname.split('/').pop();
    const body = JSON.parse(route.request().postData() || '{}');
    if (kind === 'read') { calls.read.push(body); return route.fulfill({ json: typeof read === 'function' ? read(calls.read.length) : read }); }
    (kind === 'save' ? calls.save : calls.remove).push(body);
    const [status, json] = replies.shift() || [200, { outcome: 'saved', key_revision: 1, keys: ['API_KEY'], warnings: [] }];
    if (json === null) return route.abort();
    return route.fulfill({ status, json });
  });
  return calls;
}
async function open(page, opts) {
  const calls = await stub(page, opts);
  await openPage(page, context, '/app/settings#tools');
  await page.locator('#pt-project').selectOption('/tmp/proj-alpha');
  await expect(page.locator('.pt-keys')).toBeVisible();
  return calls;
}
const tool = (page, name) => page.locator(`.pt-tool[data-tool="${name}"]`);
const keyRow = (page, name) => page.locator(`.pt-key[data-key="${name}"]`);
const noSideScroll = async (page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
};

test.use({ viewport: { width: 1280, height: 900 } });

test('shows tools, key status, skip reasons, key warnings, waiting pull requests and notes', async ({ page }) => {
  await open(page, { read: readBody({
    checks: { db: { skip: ['Codex: command too long'], key_warnings: ['needs DB_TOKEN, not set on this machine'] } },
    file_warnings: ['project tools skipped on Codex: .mcp.json is too large to pass on the command line'],
    waiting: [{ number: 12, url: 'https://github.com/o/n/pull/12', title: 'Add search', branch: 'wc-tools/abc' }],
    waiting_error: null,
  }) });
  await expect(page.locator('#sections a[aria-current="page"]')).toHaveText('Project tools');
  await expect(tool(page, 'db')).toContainText('npx -y db-mcp');
  await expect(tool(page, 'db')).toContainText('command');
  await expect(tool(page, 'db')).toContainText('MODE = ro');
  await expect(tool(page, 'db').locator('.pt-chip.unset')).toHaveText('not set');
  await expect(tool(page, 'db')).toContainText('Codex: command too long');
  await expect(tool(page, 'db')).toContainText('needs DB_TOKEN, not set on this machine');
  await expect(tool(page, 'web')).toContainText('https://x.example/mcp');
  await expect(tool(page, 'web')).toContainText('web address');
  await expect(tool(page, 'web').locator('.pt-chip.set')).toHaveText('set');
  await expect(tool(page, 'web')).toContainText('shared with other-tool');
  await expect(tool(page, 'web')).toContainText('edit in the file');
  await expect(page.locator('.pt-warn').first()).toContainText('too large');
  await expect(page.locator('.pt-waiting a')).toHaveAttribute('href', 'https://github.com/o/n/pull/12');
  await expect(page.getByText('Waiting to merge')).toBeVisible();
  await expect(page.getByText("don't include these")).toBeVisible();
  await expect(page.getByText("Antigravity agents don't get project tools")).toBeVisible();
  await expect(page.getByText('another machine running this project needs its own keys')).toBeVisible();
  await expect(keyRow(page, 'API_KEY')).toContainText('used by web, other-tool');
  await expect(keyRow(page, 'DB_TOKEN')).toContainText('not set');
});

test('waiting_error is shown as a sentence', async ({ page }) => {
  await open(page, { read: readBody({ waiting_error: 'gh is not logged in' }) });
  await expect(page.getByText("couldn't check for waiting pull requests: gh is not logged in")).toBeVisible();
});

test('editing a URL keeps an unrepresentable header and unknown fields verbatim, then shows the PR link', async ({ page }) => {
  const calls = await open(page, { replies: [[200, { outcome: 'opened', key_revision: 1, keys: ['API_KEY'], pr_url: 'https://github.com/o/n/pull/99', warnings: ['web: something to know'] }]] });
  await tool(page, 'web').getByRole('button', { name: 'Edit web' }).click();
  await expect(page.getByText('X-Weird = a ${A} b ${B}')).toBeVisible();
  await page.getByLabel('URL', { exact: true }).fill('https://y.example/mcp');
  await page.getByRole('button', { name: 'Keep changes' }).click();
  await expect(page.getByText('Unsaved changes')).toBeVisible();
  await page.locator('#pt-save').click();
  await expect(page.locator('.pt-status a')).toHaveAttribute('href', 'https://github.com/o/n/pull/99');
  await expect(page.locator('.pt-status')).toContainText('New threads get the change once it is merged');
  await expect(page.locator('.pt-status')).toContainText('web: something to know');
  expect(calls.save).toHaveLength(1);
  const sent = calls.save[0];
  expect(sent.machine).toBe('hub');
  expect(sent.path).toBe('/tmp/proj-alpha');
  expect(sent.token.key_revision).toBe(1);
  expect(sent.keys).toEqual({});
  const want = SERVERS();
  want.web.url = 'https://y.example/mcp';
  expect(sent.tools).toEqual(want);
  expect(sent.tools.web.headers['X-Weird']).toBe('a ${A} b ${B}');
  expect(sent.tools.web.extra).toBe(true);
  expect(calls.read).toHaveLength(2);   // reloaded after opened
});

test('an unchanged form sends tools null, and changing kind is refused with a read-only header', async ({ page }) => {
  const calls = await open(page, { replies: [[400, { outcome: 'refused', reason: 'nothing to save' }]] });
  await tool(page, 'web').getByRole('button', { name: 'Edit web' }).click();
  await page.getByLabel('Kind', { exact: true }).selectOption('command');
  await expect(page.getByRole('alert').filter({ hasText: "Can't change the kind" })).toBeVisible();
  await expect(page.getByLabel('Kind', { exact: true })).toHaveValue('http');
  await page.getByRole('button', { name: 'Keep changes' }).click();
  await expect(page.locator('#pt-save')).toBeDisabled();
  expect(calls.save).toHaveLength(0);
});

test('adding and removing keys rebuilds the Keys list while an unsaved tool edit stays', async ({ page }) => {
  const calls = await open(page, { replies: [
    [200, { outcome: 'saved', key_revision: 2, keys: ['API_KEY', 'DB_TOKEN'], warnings: [] }],
    [200, { outcome: 'saved', key_revision: 3, keys: ['API_KEY', 'DB_TOKEN', 'NEWK'], warnings: [] }],
    [200, { outcome: 'removed', key_revision: 4, keys: ['DB_TOKEN', 'NEWK'] }],
    [200, { outcome: 'removed', key_revision: 5, keys: ['DB_TOKEN'] }],
  ] });
  // an unsaved tool edit
  await tool(page, 'web').getByRole('button', { name: 'Edit web' }).click();
  await page.getByLabel('URL', { exact: true }).fill('https://z.example/mcp');
  await page.getByRole('button', { name: 'Keep changes' }).click();
  await expect(tool(page, 'web')).toContainText('https://z.example/mcp');

  await page.getByLabel('Value for DB_TOKEN').fill('s3cret');
  await page.getByRole('button', { name: 'Set DB_TOKEN' }).click();
  await expect(page.locator('.pt-status')).toHaveText('Saved');
  expect(calls.save[0]).toMatchObject({ tools: null, keys: { DB_TOKEN: 's3cret' } });
  await expect(keyRow(page, 'DB_TOKEN').locator('.pt-chip')).toHaveText('set');
  await expect(tool(page, 'db').locator('.pt-chip.set')).toHaveText('set');

  await page.getByLabel('New key name').fill('NEWK');
  await page.getByLabel('New key value').fill('v');
  await page.getByRole('button', { name: 'Add a key' }).click();
  await expect(keyRow(page, 'NEWK')).toContainText('not used on main');
  expect(calls.save[1].token.key_revision).toBe(2);   // the revision from the first reply
  expect(calls.save[1].tools).toBeNull();
  await expect(page.getByLabel('New key value')).toHaveValue('');

  // remove a key the baseline references: stays as not set; confirmation names its tools
  await keyRow(page, 'API_KEY').getByRole('button', { name: 'Remove API_KEY' }).click();
  await expect(keyRow(page, 'API_KEY')).toContainText('Tools on main using it: web, other-tool');
  await expect(keyRow(page, 'API_KEY')).toContainText('Waiting pull requests may need it too');
  await page.getByRole('button', { name: 'Yes, remove API_KEY' }).click();
  await expect(keyRow(page, 'API_KEY').locator('.pt-chip')).toHaveText('not set');
  expect(calls.remove[0]).toMatchObject({ name: 'API_KEY', machine: 'hub' });
  expect(calls.remove[0].token.key_revision).toBe(3);

  // remove an unused key: disappears
  await keyRow(page, 'NEWK').getByRole('button', { name: 'Remove NEWK' }).click();
  await page.getByRole('button', { name: 'Yes, remove NEWK' }).click();
  await expect(keyRow(page, 'NEWK')).toHaveCount(0);

  // the unsaved edit and the baseline are still there
  await expect(tool(page, 'web')).toContainText('https://z.example/mcp');
  await expect(page.locator('#pt-save')).toBeEnabled();
  expect(calls.read).toHaveLength(1);
});

test('add a tool, edit one keeping unknown fields, remove one with a confirmation', async ({ page }) => {
  const calls = await open(page);
  // reserved key name, duplicate name, header warning
  await page.locator('#pt-add').click();
  await page.getByLabel('Name', { exact: true }).fill('db');
  await page.getByLabel('Command', { exact: true }).fill('node');
  await page.getByRole('button', { name: 'Add to the list' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'already a tool called db' })).toBeVisible();
  await page.getByLabel('Name', { exact: true }).fill('fresh');
  await page.getByRole('button', { name: 'Add a setting' }).click();
  await page.getByLabel('Setting name').fill('PATH');
  await page.getByLabel('Setting kind').selectOption('key');
  await page.getByRole('button', { name: 'Add to the list' }).click();
  await expect(page.getByRole('alert').filter({ hasText: "can't be set here: it would change how the agent itself runs" })).toBeVisible();
  await page.getByLabel('Setting name').fill('FRESH_KEY');
  await page.getByLabel('Arguments, one per line').fill('one\ntwo\n');
  await page.getByLabel('Value for the new key').fill('v1');
  await page.getByRole('button', { name: 'Add to the list' }).click();
  await expect(tool(page, 'fresh')).toContainText('node one two');
  await expect(tool(page, 'fresh').locator('.pt-chip.unset')).toHaveText('not set');

  // header warning shows at once on a web-address form
  await page.locator('#pt-add').click();
  await page.getByLabel('Kind', { exact: true }).selectOption('http');
  await expect(page.getByText("Codex agents don't get tools with headers")).toBeHidden();
  await page.getByRole('button', { name: 'Add a header' }).click();
  await expect(page.getByText("Codex agents don't get tools with headers. Claude may read some credential-like names as empty in headers, so check the tool signs in.")).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  // edit db: args and a plain setting; the unknown `timeout` field and the key setting stay
  await tool(page, 'db').getByRole('button', { name: 'Edit db' }).click();
  await page.getByLabel('Arguments, one per line').fill('-y\nother-mcp');
  await page.getByRole('button', { name: 'Keep changes' }).click();

  // remove web, with a confirmation
  await tool(page, 'web').getByRole('button', { name: 'Remove web' }).click();
  await expect(tool(page, 'web')).toContainText('Remove web?');
  await tool(page, 'web').getByRole('button', { name: 'Cancel' }).click();
  await expect(tool(page, 'web')).toBeVisible();
  await tool(page, 'web').getByRole('button', { name: 'Remove web' }).click();
  await page.getByRole('button', { name: 'Yes, remove web' }).click();
  await expect(tool(page, 'web')).toHaveCount(0);

  await page.locator('#pt-save').click();
  await expect(page.locator('.pt-status')).toHaveText('Saved');
  expect(calls.save[0].tools).toEqual({
    db: { command: 'npx', args: ['-y', 'other-mcp'], env: { DB_TOKEN: '${DB_TOKEN}', MODE: 'ro' }, timeout: 5 },
    fresh: { command: 'node', args: ['one', 'two'], env: { FRESH_KEY: '${FRESH_KEY}' } },
  });
  expect(calls.save[0].keys).toEqual({ FRESH_KEY: 'v1' });
});

test('a header with a key keeps its text before the key', async ({ page }) => {
  const calls = await open(page);
  await page.locator('#pt-add').click();
  await page.getByLabel('Name', { exact: true }).fill('api');
  await page.getByLabel('Kind', { exact: true }).selectOption('http');
  await page.getByLabel('URL', { exact: true }).fill('https://a.example/mcp');
  await page.getByRole('button', { name: 'Add a header' }).click();
  await page.getByLabel('Header name').fill('Authorization');
  await page.getByLabel('Header kind').selectOption('key');
  await page.getByLabel('Text before the key').fill('Bearer ');
  await page.getByLabel('Key name', { exact: true }).fill('API_KEY');
  await page.getByRole('button', { name: 'Add to the list' }).click();
  await page.locator('#pt-save').click();
  await expect(page.locator('.pt-status')).toHaveText('Saved');
  expect(calls.save[0].tools.api).toEqual({ type: 'http', url: 'https://a.example/mcp', headers: { Authorization: 'Bearer ${API_KEY}' } });
  expect(calls.save[0].keys).toEqual({});
});

for (const [label, reply, check] of [
  ['pr_failed', [200, { outcome: 'pr_failed', key_revision: 1, keys: ['API_KEY'], branch: 'wc-tools/abc123', compare_url: 'https://github.com/o/n/compare/main...wc-tools/abc123?expand=1', error: 'gh: rate limited' }],
    async (page) => {
      await expect(page.locator('.pt-status')).toContainText('gh: rate limited');
      await expect(page.locator('.pt-status')).toContainText('wc-tools/abc123');
      await expect(page.locator('.pt-status a')).toHaveAttribute('href', /compare\/main\.\.\.wc-tools\/abc123/);
    }],
  ['failed', [502, { outcome: 'failed', key_revision: 2, keys: ['API_KEY', 'NEWK'], error: 'could not push' }],
    async (page) => { await expect(page.locator('.pt-status')).toContainText('could not push'); await expect(keyRow(page, 'NEWK')).toBeVisible(); }],
  ['refused 400', [400, { outcome: 'refused', reason: 'whole-file check failed' }],
    async (page) => { await expect(page.locator('.pt-status')).toHaveText('whole-file check failed'); }],
  ['refused 409', [409, { outcome: 'refused', reason: 'changed since you opened it' }],
    async (page, calls) => { await expect(page.locator('.pt-status')).toContainText('changed since you opened it'); await expect.poll(() => calls.read.length).toBe(2); }],
  ['504', [504, { error: 'hub timeout' }],
    async (page, calls) => { await expect(page.locator('.pt-status')).toHaveText('Save may still be finishing; reload in a minute and check Waiting to merge before saving again.'); expect(calls.save).toHaveLength(1); }],
  ['no outcome', [200, { hello: 1 }],
    async (page) => { await expect(page.locator('.pt-status')).toContainText('Save may still be finishing'); }],
  ['dropped connection', [200, null],
    async (page) => { await expect(page.locator('.pt-status')).toContainText('Save may still be finishing'); }],
]) {
  test(`reply: ${label}`, async ({ page }) => {
    const calls = await open(page, { replies: [reply] });
    await tool(page, 'db').getByRole('button', { name: 'Remove db' }).click();
    await page.getByRole('button', { name: 'Yes, remove db' }).click();
    await page.locator('#pt-save').click();
    await check(page, calls);
    await page.waitForTimeout(150);
    expect(calls.save).toHaveLength(1);   // never retried
  });
}

test('keys-only mode shows the notice and only the keys list', async ({ page }) => {
  await open(page, { read: readBody({
    mode: 'keys-only', notice: "Tools can't be shown or edited here: pull requests need a GitHub origin",
    token: { project: '/p', baseline: null, key_revision: 4 }, source: null, checks: {}, references: {}, keys: ['A_KEY'],
  }) });
  await expect(page.getByText("Tools can't be shown or edited here")).toBeVisible();
  await expect(page.locator('.pt-tool')).toHaveCount(0);
  await expect(page.locator('#pt-add')).toHaveCount(0);
  await expect(keyRow(page, 'A_KEY')).toContainText('unknown');
});

test('unreadable source shows the reason and Start over sends start_over', async ({ page }) => {
  const calls = await open(page, { read: readBody({
    source: { state: 'unreadable', reason: 'not a regular file; edit it by hand or Start over', document: null },
    keys: ['K'], references: {},
  }), replies: [[200, { outcome: 'opened', key_revision: 1, keys: ['K'], pr_url: 'https://github.com/o/n/pull/1', warnings: [] }]] });
  await expect(page.getByText('not a regular file; edit it by hand or Start over')).toBeVisible();
  await expect(page.locator('#pt-add')).toHaveCount(0);
  await expect(keyRow(page, 'K')).toBeVisible();
  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(page.locator('.pt-status a')).toBeVisible();
  expect(calls.save[0]).toMatchObject({ tools: {}, start_over: true });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('no sideways scroll and the main flow works', async ({ page }) => {
    const calls = await open(page, { read: readBody({
      checks: { db: { skip: ['A very long reason that has to wrap on a narrow screen, for sure and certainly'], key_warnings: ['needs DB_TOKEN_WITH_A_VERY_LONG_NAME_INDEED, not set on this machine'] } },
      waiting: [{ number: 12, url: 'https://github.com/o/n/pull/12', title: 'A long pull request title that goes on and on', branch: 'wc-tools/abc' }],
    }) });
    await noSideScroll(page);
    await tool(page, 'web').getByRole('button', { name: 'Edit web' }).click();
    await page.getByRole('button', { name: 'Add a header' }).click();
    await page.getByLabel('Header kind').last().selectOption('key');
    await noSideScroll(page);
    await page.getByLabel('URL', { exact: true }).fill('https://narrow.example/mcp/with/a/really/long/path/that/keeps/going/and/going/and/going');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await tool(page, 'web').getByRole('button', { name: 'Edit web' }).click();
    await page.getByLabel('URL', { exact: true }).fill('https://narrow.example/mcp/with/a/really/long/path/that/keeps/going/and/going/and/going');
    await page.getByRole('button', { name: 'Keep changes' }).click();
    await noSideScroll(page);
    await page.locator('#pt-save').click();
    await expect(page.locator('.pt-status')).toHaveText('Saved');
    await page.getByLabel('Value for DB_TOKEN').fill('s3cret');
    await page.getByRole('button', { name: 'Set DB_TOKEN' }).click();
    await expect.poll(() => calls.save.length).toBe(2);
    await noSideScroll(page);
    const box = await page.locator('#pt-save').boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  });
});
