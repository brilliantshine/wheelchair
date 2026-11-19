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
async function stub(page, { read = readBody(), replies = [], gate = null } = {}) {
  const calls = { read: [], save: [], remove: [] };
  await page.route('**/wheelchair/api/new-thread*', (route) => route.fulfill({ json: {
    machine: 'hub', machines: ['hub', 'node-2'], default_folder: '/tmp', saved: [{ name: 'alpha', path: '/tmp/proj-alpha' }, { name: 'beta', path: '/tmp/proj-beta' }], found: [], previous: [] } }));
  await page.route('**/wheelchair/api/project-tools/*', async (route) => {
    const kind = new URL(route.request().url()).pathname.split('/').pop();
    const body = JSON.parse(route.request().postData() || '{}');
    if (kind === 'read') {
      calls.read.push(body);
      const out = typeof read === 'function' ? await read(calls.read.length, body) : read;
      return Array.isArray(out) ? route.fulfill({ status: out[0], json: out[1] }) : route.fulfill({ json: out });
    }
    (kind === 'save' ? calls.save : calls.remove).push(body);
    if (gate) await gate;
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
    checks: { db: { skip: ['Codex: command too long'], keys: ['DB_TOKEN'], key_warnings: ['needs DB_TOKEN, not set on this machine'] } },
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
    await expect.poll(() => page.locator('#pt-save').evaluate((el) => { const r = el.getBoundingClientRect(); return r.x + r.width; })).toBeLessThanOrEqual(390);
  });
});

test("a reserved name referenced in a setting is read as the agent's own environment, not a key", async ({ page }) => {
  const calls = await open(page, { read: readBody({
    source: { state: 'ok', reason: null, document: { mcpServers: { app: { command: 'node', env: { PATH: '${PATH}', API_KEY: '${API_KEY}' } } } } },
    checks: {}, references: { API_KEY: ['app'] }, keys: ['API_KEY'],
  }) });
  await expect(tool(page, 'app').locator('li.pt-ro')).toContainText("(from the agent's own environment)");
  await expect(tool(page, 'app').locator('li.pt-ro .pt-chip')).toHaveCount(0);
  await expect(tool(page, 'app').locator('.pt-chip.set')).toHaveCount(1);   // API_KEY only
  await tool(page, 'app').getByRole('button', { name: 'Edit app' }).click();
  await page.getByLabel('Command', { exact: true }).fill('node2');
  await page.getByRole('button', { name: 'Keep changes' }).click();
  await expect(page.getByRole('alert').filter({ hasText: "can't be set here" })).toHaveCount(0);
  await page.locator('#pt-save').click();
  await expect(page.locator('.pt-status')).toHaveText('Saved');
  expect(calls.save).toHaveLength(1);
  expect(calls.save[0].tools.app).toEqual({ command: 'node2', env: { PATH: '${PATH}', API_KEY: '${API_KEY}' } });
});

test('an unsaved tool removal survives a Settings re-render', async ({ page }) => {
  const calls = await open(page);
  await tool(page, 'web').getByRole('button', { name: 'Remove web' }).click();
  await page.getByRole('button', { name: 'Yes, remove web' }).click();
  await expect(tool(page, 'web')).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new HashChangeEvent('hashchange')));
  await expect(tool(page, 'web')).toHaveCount(0);
  await expect(tool(page, 'db')).toBeVisible();
  await expect(page.locator('#pt-save')).toBeEnabled();
  expect(calls.read).toHaveLength(1);
});

const dbWith = (extra) => readBody({ source: { state: 'ok', reason: null, document: { mcpServers: { db: { command: 'npx', ...extra } } } }, keys: [], references: {}, checks: {} });
const KIND_MSG = "Can't change the kind: this tool has parts the form can't edit. Edit in the file.";

for (const [label, extra] of [
  ['a read-only setting', { env: { PATH: '${PATH}' } }],
  ['an argument with a newline', { args: ['a\nb'] }],
  ['an unknown field', { timeout: 5 }],
  ['a command with a variable', { command: '${BIN}' }],
]) {
  test(`changing kind is refused for ${label}`, async ({ page }) => {
    await open(page, { read: dbWith(extra) });
    await tool(page, 'db').getByRole('button', { name: 'Edit db' }).click();
    await page.getByLabel('Kind', { exact: true }).selectOption('http');
    await expect(page.getByRole('alert').filter({ hasText: KIND_MSG })).toBeVisible();
    await expect(page.getByLabel('Kind', { exact: true })).toHaveValue('command');
  });
}

test('the pickers are locked while a save is pending, and the reply lands on its own project', async ({ page }) => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const calls = await open(page, { gate, replies: [[200, { outcome: 'saved', key_revision: 99, keys: ['ALPHA_K'], warnings: [] }]] });
  await page.getByLabel('Value for API_KEY').fill('v');
  await page.getByRole('button', { name: 'Set API_KEY' }).click();
  await expect.poll(() => calls.save.length).toBe(1);
  await expect(page.locator('#pt-project')).toBeDisabled();
  await expect(page.locator('#pt-machine')).toBeDisabled();
  release();
  await expect(page.locator('.pt-status')).toHaveText('Saved');
  await expect(keyRow(page, 'ALPHA_K')).toBeVisible();
  await expect(page.locator('#pt-project')).toBeEnabled();
});

test('arguments with a variable are read-only and kept as sent', async ({ page }) => {
  const calls = await open(page, { read: dbWith({ args: ['--db', '${DB_URL}'] }) });
  await tool(page, 'db').getByRole('button', { name: 'Edit db' }).click();
  await expect(page.getByLabel('Arguments, one per line')).toHaveCount(0);
  await expect(page.getByText('edit in the file (kept as is)')).toBeVisible();
  await page.getByLabel('Name', { exact: true }).fill('db2');
  await page.getByRole('button', { name: 'Keep changes' }).click();
  await page.locator('#pt-save').click();
  await expect(page.locator('.pt-status')).toHaveText('Saved');
  expect(calls.save[0].tools.db2.args).toEqual(['--db', '${DB_URL}']);
});

test('an unknown field is shown on the card and in the form', async ({ page }) => {
  await open(page, { read: dbWith({ timeout: 5 }) });
  await expect(tool(page, 'db')).toContainText('timeout: 5');
  await expect(tool(page, 'db')).toContainText('edit in the file');
  await tool(page, 'db').getByRole('button', { name: 'Edit db' }).click();
  await expect(page.locator('.pt-form')).toContainText('timeout: 5');
  await expect(page.locator('.pt-form')).toContainText('edit in the file');
});

test('key warnings follow the current key status', async ({ page }) => {
  await open(page, { replies: [[200, { outcome: 'saved', key_revision: 2, keys: ['API_KEY', 'DB_TOKEN'], warnings: [] }]],
    read: readBody({ checks: { db: { keys: ['DB_TOKEN'], key_warnings: ['needs DB_TOKEN, not set on this machine', 'other warning'] } } }) });
  await expect(tool(page, 'db')).toContainText('needs DB_TOKEN, not set on this machine');
  await page.getByLabel('Value for DB_TOKEN').fill('s');
  await page.getByRole('button', { name: 'Set DB_TOKEN' }).click();
  await expect(tool(page, 'db').locator('.pt-chip.set')).toHaveText('set');
  await expect(tool(page, 'db')).not.toContainText('not set on this machine');
  await expect(tool(page, 'db')).toContainText('other warning');
});

test('shared with comes from the loaded checks, on cards and while typing in the editor', async ({ page }) => {
  const mcpServers = { one: { command: 'node', env: { SHARED_K: '${SHARED_K}' } }, two: { command: 'node', env: { ALIAS: '${SHARED_K}' } } };
  await open(page, { read: readBody({
    source: { state: 'ok', reason: null, document: { mcpServers } }, references: { SHARED_K: ['one', 'two'] }, keys: ['SHARED_K'],
    checks: { one: { keys: ['SHARED_K'] }, two: { keys: ['SHARED_K'] } },
  }) });
  await expect(tool(page, 'one')).toContainText('shared with two (SHARED_K)');
  await expect(tool(page, 'two')).toContainText('shared with one (SHARED_K)');
  await tool(page, 'one').getByRole('button', { name: 'Edit one' }).click();
  await page.getByLabel('Setting kind').selectOption('key');
  await expect(page.locator('.pt-shared')).toContainText('shared with two');
  await page.getByLabel('Setting name').fill('OTHER');
  await expect(page.locator('.pt-shared')).toBeHidden();
  await page.getByLabel('Setting name').fill('SHARED_K');
  await expect(page.locator('.pt-shared')).toContainText('shared with two');
});

test('an unreadable source still shows waiting pull requests', async ({ page }) => {
  await open(page, { read: readBody({
    source: { state: 'unreadable', reason: 'broken', document: null }, keys: [], references: {},
    waiting: [{ number: 5, url: 'https://github.com/o/n/pull/5', title: 'Old change', branch: 'b' }],
  }) });
  await expect(page.locator('.pt-waiting a')).toHaveAttribute('href', 'https://github.com/o/n/pull/5');
  await expect(page.getByRole('button', { name: 'Start over' })).toBeVisible();
});

async function openBare(page, opts) {
  const calls = await stub(page, opts);
  await openPage(page, context, '/app/settings#tools');
  await expect(page.locator('#pt-project')).toBeVisible();
  return calls;
}
const betaRead = () => readBody({ keys: ['BETA_K'], references: {}, token: { project: '/b', baseline: null, key_revision: 7 }, mode: 'keys-only', source: null });

test('machine key warnings show for read-only tools and rows, and follow the key status', async ({ page }) => {
  const tools = {
    ro: { command: 'run', env: { K1: '${K1}' }, headers: { a: 'b' } },
    multi: { type: 'http', url: 'https://m.example/mcp', headers: { 'X-M': 'a ${A} b ${B}' } },
    al: { command: 'node', env: { ALIAS: '${TOKEN}' } },
  };
  await open(page, {
    replies: [[200, { outcome: 'saved', key_revision: 2, keys: ['K1'], warnings: [] }]],
    read: readBody({
      source: { state: 'ok', reason: null, document: { mcpServers: tools } }, keys: [], references: { K1: ['ro'] },
      checks: {
        ro: { keys: ['K1'], key_warnings: ['needs K1, not set on this machine'] },
        multi: { keys: ['A', 'B'], key_warnings: ['needs A, not set on this machine', 'needs B, not set on this machine'] },
        al: { keys: ['TOKEN'], key_warnings: ['needs TOKEN, not set on this machine'] },
      },
    }),
  });
  await expect(tool(page, 'ro')).toContainText('needs K1, not set on this machine');
  await expect(tool(page, 'multi')).toContainText('needs A, not set on this machine');
  await expect(tool(page, 'multi')).toContainText('needs B, not set on this machine');
  await expect(tool(page, 'al')).toContainText('needs TOKEN, not set on this machine');
  await page.getByLabel('Value for K1').fill('s');
  await page.getByRole('button', { name: 'Set K1' }).click();
  await expect(keyRow(page, 'K1').locator('.pt-chip.set')).toBeVisible();
  await expect(tool(page, 'ro')).not.toContainText('needs K1');
  await expect(tool(page, 'multi')).toContainText('needs A, not set on this machine');
  await expect(tool(page, 'al')).toContainText('needs TOKEN, not set on this machine');
});

test('the machine picker is locked while the project list loads', async ({ page }) => {
  let release;
  const gate = new Promise((r) => { release = r; });
  await openBare(page, {});
  await page.route('**/wheelchair/api/new-thread*', async (route) => {
    await gate;
    return route.fulfill({ json: { machine: 'node-2', machines: ['hub', 'node-2'], default_folder: '/tmp', saved: [{ name: 'gamma', path: '/tmp/proj-gamma' }], found: [], previous: [] } });
  });
  await page.locator('#pt-machine').selectOption('node-2');
  await expect(page.locator('#pt-machine')).toBeDisabled();
  await expect(page.locator('#pt-project')).toBeDisabled();
  release();
  await expect(page.locator('#pt-project option[value="/tmp/proj-gamma"]')).toHaveCount(1);
  await expect(page.locator('#pt-machine')).toBeEnabled();
});

test('the pickers are locked while a read is pending', async ({ page }) => {
  let release;
  const gate = new Promise((r) => { release = r; });
  await openBare(page, { read: async () => { await gate; return readBody(); } });
  await page.locator('#pt-project').selectOption('/tmp/proj-alpha');
  await expect(page.locator('#pt-project')).toBeDisabled();
  release();
  await expect(tool(page, 'db')).toBeVisible();
  await expect(page.locator('#pt-project')).toBeEnabled();
});

test('the pickers are locked during the reload after opened', async ({ page }) => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const calls = await open(page, {
    replies: [[200, { outcome: 'opened', key_revision: 1, keys: ['API_KEY'], pr_url: 'https://github.com/o/n/pull/77', warnings: [] }]],
    read: async (n) => { if (n === 2) { await gate; } return readBody(); },
  });
  await tool(page, 'web').getByRole('button', { name: 'Edit web' }).click();
  await page.getByLabel('URL', { exact: true }).fill('https://y.example/mcp');
  await page.getByRole('button', { name: 'Keep changes' }).click();
  await page.locator('#pt-save').click();
  await expect.poll(() => calls.read.length).toBe(2);
  await expect(page.locator('#pt-project')).toBeDisabled();
  release();
  await expect(page.locator('.pt-status a')).toHaveAttribute('href', 'https://github.com/o/n/pull/77');
});

test('the pickers are locked while a remove-key reply is pending', async ({ page }) => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const calls = await open(page, { gate, replies: [[200, { outcome: 'removed', key_revision: 5, keys: [] }]] });
  await keyRow(page, 'API_KEY').getByRole('button', { name: 'Remove API_KEY' }).click();
  await page.getByRole('button', { name: 'Yes, remove API_KEY' }).click();
  await expect.poll(() => calls.remove.length).toBe(1);
  await expect(page.locator('#pt-project')).toBeDisabled();
  release();
  await expect(page.locator('.pt-status')).toHaveText('Key removed');
  await expect(page.locator('#pt-project')).toBeEnabled();
});

test('a __proto__ header survives an edit of its tool URL', async ({ page }) => {
  const mcpServers = JSON.parse('{"web":{"type":"http","url":"https://x.example/mcp","headers":{"__proto__":"v","a":"b"}}}');
  const calls = await open(page, { read: readBody({ source: { state: 'ok', reason: null, document: { mcpServers } }, keys: [], references: {} }) });
  await tool(page, 'web').getByRole('button', { name: 'Edit web' }).click();
  await page.getByLabel('URL', { exact: true }).fill('https://y.example/mcp');
  await page.getByRole('button', { name: 'Keep changes' }).click();
  await page.locator('#pt-save').click();
  await expect(page.locator('.pt-status')).toHaveText('Saved');
  const headers = calls.save[0].tools.web.headers;
  expect(Object.hasOwn(headers, '__proto__')).toBe(true);
  expect(headers.a).toBe('b');
  expect(Object.getOwnPropertyDescriptor(headers, '__proto__').value).toBe('v');
  expect(calls.save[0].tools.web.url).toBe('https://y.example/mcp');
});

test('a tool and a key named constructor render and save', async ({ page }) => {
  const mcpServers = JSON.parse('{"constructor":{"command":"x","env":{"constructor":"${constructor}"}}}');
  const calls = await open(page, {
    read: readBody({ source: { state: 'ok', reason: null, document: { mcpServers } }, keys: [], references: { constructor: ['constructor'] }, checks: { constructor: { keys: ['constructor'] } } }),
    replies: [[200, { outcome: 'saved', key_revision: 2, keys: ['constructor'], warnings: [] }], [200, { outcome: 'saved', key_revision: 3, keys: ['constructor'], warnings: [] }]],
  });
  await expect(tool(page, 'constructor')).toContainText('needs constructor, not set on this machine');
  await expect(keyRow(page, 'constructor')).toContainText('used by constructor');
  await page.getByLabel('Value for constructor').fill('s');
  await page.getByRole('button', { name: 'Set constructor' }).click();
  await expect(keyRow(page, 'constructor').locator('.pt-chip.set')).toBeVisible();
  expect(Object.keys(calls.save[0].keys)).toEqual(['constructor']);
  await tool(page, 'constructor').getByRole('button', { name: 'Edit constructor' }).click();
  await page.getByLabel('Command', { exact: true }).fill('y');
  await page.getByRole('button', { name: 'Keep changes' }).click();
  await page.locator('#pt-save').click();
  await expect(page.locator('.pt-status')).toHaveText('Saved');
  expect(calls.save[1].tools.constructor.command).toBe('y');
  expect(calls.save[1].tools.constructor.env.constructor).toBe('${constructor}');
});

test('a $ in the text before a key is refused', async ({ page }) => {
  const calls = await open(page, {});
  await page.locator('#pt-add').click();
  await page.getByLabel('Name', { exact: true }).fill('hh');
  await page.getByLabel('Kind', { exact: true }).selectOption('http');
  await page.getByLabel('URL', { exact: true }).fill('https://h.example/mcp');
  await page.getByRole('button', { name: 'Add a header' }).click();
  await page.getByLabel('Header name').fill('Authorization');
  await page.getByLabel('Header kind').selectOption('key');
  await page.getByLabel('Text before the key').fill('Bearer $');
  await page.getByLabel('Key name', { exact: true }).fill('NEW_K');
  await page.getByRole('button', { name: 'Add to the list' }).click();
  await expect(page.getByRole('alert').filter({ hasText: "The text before the key can't contain $." })).toBeVisible();
  expect(calls.save).toHaveLength(0);
});

const NEEDS_TOKEN = 'needs TOKEN, not set on this machine';

test('loading locks the section: machine change, project pick and the reload after opened', async ({ page }) => {
  let releasePicker; let releaseRead; let releaseSave;
  const pickerGate = new Promise((r) => { releasePicker = r; });
  const readGate = new Promise((r) => { releaseRead = r; });
  const saveGate = new Promise((r) => { releaseSave = r; });
  let releaseReload;
  const reloadGate = new Promise((r) => { releaseReload = r; });
  let reads = 0;
  await openBare(page, { replies: [[200, { outcome: 'opened', key_revision: 1, keys: ['API_KEY'], pr_url: 'https://github.com/o/n/pull/1', warnings: [] }]], gate: saveGate,
    read: async () => { reads++; if (reads === 1) await readGate; if (reads === 2) await reloadGate; return readBody(); } });
  await page.route('**/wheelchair/api/new-thread*', async (route) => {
    if (new URL(route.request().url()).searchParams.get('machine') === 'node-2') await pickerGate;
    return route.fulfill({ json: { machine: new URL(route.request().url()).searchParams.get('machine'), machines: ['hub', 'node-2'], default_folder: '/tmp', saved: [{ name: 'alpha', path: '/tmp/proj-alpha' }], found: [], previous: [] } });
  });
  await page.locator('#pt-machine').selectOption('node-2');
  await expect(page.locator('#pt-project option')).toHaveCount(1);
  await expect(page.locator('#pt-machine')).toBeDisabled();
  await expect(page.locator('#pt-project')).toBeDisabled();
  releasePicker();
  await expect(page.locator('#pt-project option[value="/tmp/proj-alpha"]')).toHaveCount(1);
  await expect(page.locator('#pt-project')).toBeEnabled();
  await expect(page.locator('#pt-machine')).toBeEnabled();
  // a project pick locks until the read answers
  await page.locator('#pt-project').selectOption('/tmp/proj-alpha');
  await expect(page.locator('#pt-project')).toBeDisabled();
  await expect(page.locator('.pt-view button:enabled')).toHaveCount(0);
  releaseRead();
  await expect(page.locator('.pt-keys')).toBeVisible();
  await expect(page.locator('#pt-project')).toBeEnabled();
  // after an opened Save the section is locked until the reload answers
  await tool(page, 'web').getByRole('button', { name: 'Edit web' }).click();
  await page.getByLabel('URL', { exact: true }).fill('https://y.example/mcp');
  await page.getByRole('button', { name: 'Keep changes' }).click();
  await page.locator('#pt-save').click();
  releaseSave();
  await expect(page.locator('.pt-view button:enabled')).toHaveCount(0);
  await expect(page.locator('#pt-project')).toBeDisabled();
  await expect(page.locator('#pt-machine')).toBeDisabled();
  releaseReload();
  await expect(page.locator('#pt-project')).toBeEnabled();
});

test('key warnings and shared with follow the loaded checks, not draft edits', async ({ page }) => {
  const mcpServers = { a: { command: 'x', env: { TOKEN: '${TOKEN}' } }, b: { command: 'y', env: { ALIAS: '${TOKEN}' } } };
  await open(page, {
    replies: [[200, { outcome: 'removed', key_revision: 2, keys: [] }], [200, { outcome: 'saved', key_revision: 3, keys: ['TOKEN'], warnings: [] }]],
    read: readBody({ source: { state: 'ok', reason: null, document: { mcpServers } }, keys: ['TOKEN'], references: { TOKEN: ['a', 'b'] },
      checks: { a: { keys: ['TOKEN'], held_back: [], skip: [], key_warnings: [] }, b: { keys: ['TOKEN'], held_back: [], skip: [], key_warnings: [] } } }),
  });
  for (const n of ['a', 'b']) await expect(tool(page, n)).not.toContainText('needs');
  await expect(tool(page, 'a')).toContainText('shared with b (TOKEN)');
  await expect(tool(page, 'b')).toContainText('shared with a (TOKEN)');
  await keyRow(page, 'TOKEN').getByRole('button', { name: 'Remove TOKEN' }).click();
  await page.getByRole('button', { name: 'Yes, remove TOKEN' }).click();
  for (const n of ['a', 'b']) await expect(tool(page, n)).toContainText(NEEDS_TOKEN);
  // an unsaved edit that drops a's TOKEN setting changes nothing
  await tool(page, 'a').getByRole('button', { name: 'Edit a' }).click();
  await page.getByRole('button', { name: 'Remove setting' }).click();
  await page.getByRole('button', { name: 'Keep changes' }).click();
  for (const n of ['a', 'b']) await expect(tool(page, n)).toContainText(NEEDS_TOKEN);
  await expect(tool(page, 'a')).toContainText('shared with b (TOKEN)');
  await page.getByLabel('Value for TOKEN').fill('s');
  await page.getByRole('button', { name: 'Set TOKEN' }).click();
  for (const n of ['a', 'b']) await expect(tool(page, n)).not.toContainText('needs');
  await expect(tool(page, 'b')).toContainText('shared with a (TOKEN)');
});

test('renaming an editable header to a read-only header name is refused', async ({ page }) => {
  const mcpServers = { web: { type: 'http', url: 'https://x.example/mcp', headers: { A: 'plain', Z: 'a ${P} b ${Q}' } } };
  const calls = await open(page, { read: readBody({ source: { state: 'ok', reason: null, document: { mcpServers } }, keys: [], references: {}, checks: {} }) });
  await tool(page, 'web').getByRole('button', { name: 'Edit web' }).click();
  await page.getByLabel('Header name').fill('Z');
  await page.getByRole('button', { name: 'Keep changes' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Z is listed twice.' })).toBeVisible();
  await page.getByLabel('Header name').fill('A');
  await page.getByLabel('URL', { exact: true }).fill('https://y.example/mcp');
  await page.getByRole('button', { name: 'Keep changes' }).click();
  await page.locator('#pt-save').click();
  await expect(page.locator('.pt-status')).toHaveText('Saved');
  expect(calls.save[0].tools.web.headers).toEqual({ A: 'plain', Z: 'a ${P} b ${Q}' });
});

test('arguments with a carriage return are read-only and kept on a rename', async ({ page }) => {
  const args = ['left\rright', 'last\r'];
  const calls = await open(page, { read: dbWith({ args }) });
  await tool(page, 'db').getByRole('button', { name: 'Edit db' }).click();
  await expect(page.getByLabel('Arguments, one per line')).toHaveCount(0);
  await page.getByLabel('Name', { exact: true }).fill('db2');
  await page.getByRole('button', { name: 'Keep changes' }).click();
  await page.locator('#pt-save').click();
  await expect(page.locator('.pt-status')).toHaveText('Saved');
  expect(calls.save[0].tools.db2.args).toEqual(args);
});

test('cards use the baseline name across a rename and a removal', async ({ page }) => {
  const mcpServers = { db: { command: 'node', env: { DB_TOKEN: '${DB_TOKEN}' } }, other: { command: 'node', env: { X: '${DB_TOKEN}' } } };
  await open(page, { read: readBody({
    source: { state: 'ok', reason: null, document: { mcpServers } }, keys: [], references: {},
    checks: { db: { skip: ['Codex: skipped db'], keys: ['DB_TOKEN'] }, other: { keys: ['DB_TOKEN'] } },
  }) });
  await tool(page, 'db').getByRole('button', { name: 'Edit db' }).click();
  await page.getByLabel('Name', { exact: true }).fill('db2');
  await page.getByRole('button', { name: 'Keep changes' }).click();
  await expect(tool(page, 'db2')).toContainText('Codex: skipped db');
  await expect(tool(page, 'db2')).toContainText('needs DB_TOKEN, not set on this machine');
  await expect(tool(page, 'db2')).toContainText('shared with other (DB_TOKEN)');
  await expect(tool(page, 'other')).toContainText('shared with db2 (DB_TOKEN)');
  await tool(page, 'db2').getByRole('button', { name: 'Remove db2' }).click();
  await page.getByRole('button', { name: 'Yes, remove db2' }).click();
  await expect(tool(page, 'other')).not.toContainText('shared with');
});

test('fields the user did not change are sent exactly as read', async ({ page }) => {
  const mcpServers = {
    w: { type: 'http', url: 'https://a', headers: {} },
    c: { command: 'old' },
    d: { command: 'old', args: ['x', 'y'] },
  };
  const calls = await open(page, { read: readBody({ source: { state: 'ok', reason: null, document: { mcpServers } }, keys: [], references: {}, checks: {} }) });
  await tool(page, 'w').getByRole('button', { name: 'Edit w' }).click();
  await page.getByLabel('URL', { exact: true }).fill('https://b');
  await page.getByRole('button', { name: 'Keep changes' }).click();
  await tool(page, 'c').getByRole('button', { name: 'Edit c' }).click();
  await page.getByLabel('Command', { exact: true }).fill('new');
  await page.getByRole('button', { name: 'Keep changes' }).click();
  await tool(page, 'd').getByRole('button', { name: 'Edit d' }).click();
  await page.getByLabel('Command', { exact: true }).fill('new');
  await page.getByRole('button', { name: 'Keep changes' }).click();
  await page.locator('#pt-save').click();
  await expect(page.locator('.pt-status')).toContainText('Saved');
  const sent = calls.save[0].tools;
  expect(sent.w).toEqual({ type: 'http', url: 'https://b', headers: {} });
  expect(sent.c).toEqual({ command: 'new' });
  expect(Object.keys(sent.c)).toEqual(['command']);
  expect(sent.d).toEqual({ command: 'new', args: ['x', 'y'] });
});

test('a failed reload after a 409 is shown with a Reload button', async ({ page }) => {
  const calls = await open(page, {
    read: (n) => (n === 1 ? readBody() : [504, { error: 'hub timeout' }]),
    replies: [[409, { outcome: 'refused', reason: 'changed since you opened it' }]],
  });
  await tool(page, 'db').getByRole('button', { name: 'Remove db' }).click();
  await page.getByRole('button', { name: 'Yes, remove db' }).click();
  await page.locator('#pt-save').click();
  const st = page.locator('.pt-status');
  await expect(st).toContainText('changed since you opened it');
  await expect(st).toContainText("Couldn't reload the project: hub timeout");
  await expect(st.getByRole('button', { name: 'Reload' })).toBeVisible();
  await expect(st).not.toContainText('reloaded');
  expect(calls.read).toHaveLength(2);
});

test('a failed reload after opened shows the pull request link and the reload error', async ({ page }) => {
  await open(page, {
    read: (n) => (n === 1 ? readBody() : [504, { error: 'hub timeout' }]),
    replies: [[200, { outcome: 'opened', key_revision: 1, keys: ['API_KEY'], pr_url: 'https://github.com/o/n/pull/7', warnings: [] }]],
  });
  await tool(page, 'db').getByRole('button', { name: 'Remove db' }).click();
  await page.getByRole('button', { name: 'Yes, remove db' }).click();
  await page.locator('#pt-save').click();
  const st = page.locator('.pt-status');
  await expect(st.locator('a')).toHaveAttribute('href', 'https://github.com/o/n/pull/7');
  await expect(st).toContainText("Couldn't reload the project: hub timeout");
  await expect(st.getByRole('button', { name: 'Reload' })).toBeVisible();
});

test('editing one field sends the raw entry with only that field changed', async ({ page }) => {
  const mcpServers = {
    w: { type: 'http', url: 'https://a', headers: { ' X-Legacy ': 'a', Authorization: 'Bearer ${TOK}', Weird: 5 }, timeout: 5 },
    c: { command: 'old', args: ['x', 'y'], env: { ' E ': 'v', K: '${K}', N: 3 }, retries: 2 },
  };
  const calls = await open(page, { read: readBody({ source: { state: 'ok', reason: null, document: { mcpServers } }, keys: [], references: {}, checks: {} }) });
  await tool(page, 'w').getByRole('button', { name: 'Edit w' }).click();
  await page.getByLabel('URL', { exact: true }).fill('https://b');
  await page.getByRole('button', { name: 'Keep changes' }).click();
  await tool(page, 'c').getByRole('button', { name: 'Edit c' }).click();
  await page.getByLabel('Command', { exact: true }).fill('new');
  await page.getByRole('button', { name: 'Keep changes' }).click();
  await page.locator('#pt-save').click();
  await expect(page.locator('.pt-status')).toContainText('Saved');
  const sent = calls.save[0].tools;
  expect(sent.w).toEqual({ ...mcpServers.w, url: 'https://b' });
  expect(Object.keys(sent.w.headers)).toEqual([' X-Legacy ', 'Authorization', 'Weird']);
  expect(sent.c).toEqual({ ...mcpServers.c, command: 'new' });
});

test('an edited header name with a space at the end is refused', async ({ page }) => {
  await open(page, { read: readBody({ source: { state: 'ok', reason: null, document: { mcpServers: { w: { type: 'http', url: 'https://a', headers: { 'X-A': '1' } } } } }, keys: [], references: {}, checks: {} }) });
  await tool(page, 'w').getByRole('button', { name: 'Edit w' }).click();
  await page.getByLabel('Header name').fill('X-A ');
  await page.getByRole('button', { name: 'Keep changes' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'has a space at the start or end' })).toBeVisible();
});

test('the open editor shows the value field when a key is removed from the Keys list', async ({ page }) => {
  await open(page, { replies: [[200, { outcome: 'removed', key_revision: 2, keys: [] }]] });
  await page.getByRole('button', { name: 'Add a tool' }).click();
  await page.getByRole('button', { name: 'Add a setting' }).click();
  await page.getByLabel('Setting name').fill('API_KEY');
  await page.getByLabel('Setting kind').selectOption('key');
  await expect(page.getByLabel('Value for the new key')).toBeHidden();
  await keyRow(page, 'API_KEY').getByRole('button', { name: 'Remove API_KEY' }).click();
  await page.getByRole('button', { name: 'Yes, remove API_KEY' }).click();
  await expect(keyRow(page, 'API_KEY').locator('.pt-chip')).toHaveText('not set');
  await expect(page.getByLabel('Value for the new key')).toBeVisible();
});

test('the Reload button is disabled while its own read is pending', async ({ page }) => {
  let release;
  const gate = new Promise((r) => { release = r; });
  await open(page, {
    read: async (n) => { if (n === 3) await gate; return n === 2 ? [504, { error: 'hub timeout' }] : readBody(); },
    replies: [[409, { outcome: 'refused', reason: 'changed since you opened it' }]],
  });
  await tool(page, 'db').getByRole('button', { name: 'Remove db' }).click();
  await page.getByRole('button', { name: 'Yes, remove db' }).click();
  await page.locator('#pt-save').click();
  const reload = page.locator('.pt-status').getByRole('button', { name: 'Reload' });
  await expect(reload).toBeEnabled();
  await reload.click();
  await expect(reload).toBeDisabled();
  release();
  await expect(page.locator('.pt-status')).toContainText('The project was reloaded');
});
