'use strict';

// Lessons learned, in the browser: the Settings entry and editor (spec S7) and the thread
// notice with its link back to Settings (S6). State is seeded through the state directory.
const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

test.describe.configure({ mode: 'serial' });

const ROLES = ['lead', 'sub-lead', 'worker', 'reviewer', 'verifier', 'mapper'];
const WARNING = 'Agents keep this list up to date. Editing is not recommended; a lesson you edit is marked as yours and agents leave it alone.';
const api = (page, route) => page.evaluate(async (r) => (await fetch('/wheelchair/api' + r)).json(), route);
const noSideScroll = async (page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};

// A hash-only change would not reload the page, and the lessons were seeded after it loaded.
const openSettings = async (page, route) => { await page.goto('about:blank'); await page.goto(ctx.server.url + route); };

let ctx;
let made;
const seed = async (lessons, extra = {}) => {
  const file = path.join(ctx.state, 'settings.json');
  let current = {};
  try { current = JSON.parse(await fs.readFile(file, 'utf8')); } catch { /* none yet */ }
  const all = Object.fromEntries(ROLES.map((role) => [role, []]));
  Object.assign(all, lessons);
  await fs.writeFile(file, JSON.stringify({ ...current, lesson_history: {}, lesson_waiting: [], ...extra, lessons: all }));
};
const lesson = (id, text, extra = {}) => ({ id, text, saved_by: 'agent', saved_at: '2026-11-21T10:00:00.000Z', ...extra });

test.beforeAll(async () => { ctx = await startWorld(); made = await ctx.make({ cli: 'claude' }); });
test.afterAll(async () => { await ctx.close(); });
test.beforeEach(async ({ page }) => { await signIn(page, ctx); });

test.describe('Settings', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('the entry and tag appear only when lessons exist; the address opens an empty entry', async ({ page }) => {
    await seed({});
    await openSettings(page, '/app/settings#templates');
    await expect(page.locator('.tpl-list h1')).toBeVisible();
    await expect(page.locator('.tpl-lessons')).toHaveCount(0);
    await expect(page.getByText('Written by agents')).toHaveCount(0);
    await openSettings(page, '/app/settings#templates/lessons/worker');
    await expect(page.locator('.lessons-edit')).toContainText('No lessons for workers right now.');
    await expect(page.locator('.lesson-warning')).toHaveText(WARNING);

    await seed({ worker: [lesson('L000001', 'Run the lint first.', { provider: 'gpt', project: '/tmp/proj-alpha', thread: made.id }), lesson('L000002', 'Keep commits small.', { saved_by: 'user' })], reviewer: [lesson('L00000b', 'Read the diff twice.')] });
    await openSettings(page, '/app/settings#templates');
    const entries = page.locator('.tpl-lessons');
    await expect(entries).toHaveCount(2);
    await expect(entries.filter({ hasText: 'Written by agents · 2' })).toHaveCount(1);
    await expect(entries.filter({ hasText: 'Written by agents · 1' })).toHaveCount(1);
    // Placed first in its group: the next element after the group label.
    await expect(page.locator('.tpl-list .group-label', { hasText: 'Worker' }).locator('+ .tpl-item')).toHaveClass(/tpl-lessons/);
    await expect(page.locator('#duplicate, #toggle-use')).toHaveCount(0);
  });

  test('the editor shows the warning, markers and the thread link; edits and removals save', async ({ page }) => {
    await seed({ worker: [lesson('L000001', 'Run the lint first.', { provider: 'gpt', project: '/tmp/proj-alpha', thread: made.id }), lesson('L000002', 'Keep commits small.', { saved_by: 'user' }), lesson('L000003', 'Delete me.')] });
    await openSettings(page, '/app/settings#templates/lessons/worker');
    await expect(page.locator('.lesson-warning')).toHaveText(WARNING);
    await expect(page.locator('#using')).toHaveText('Changes apply to workers started after you save.');
    const first = page.locator('.lesson-row[data-id="L000001"]');
    await expect(first).toContainText('only on GPT');
    await expect(first).toContainText('only in proj-alpha');
    await expect(first.locator('.lesson-from')).toHaveText(/^saved from /);
    // A thread with no title of its own shows its display name, as the thread page does, not its id.
    await expect(first.locator('.lesson-from')).not.toHaveText('saved from ' + made.id);
    await expect(page.locator('.lesson-row[data-id="L000002"]')).toContainText('edited by the user');
    await expect(page.locator('.lesson-row[data-id="L000003"] .lesson-from')).toHaveCount(0);

    await first.locator('textarea').fill('Run the linter before every push.');
    const third = page.locator('.lesson-row[data-id="L000003"]');
    await third.getByRole('button', { name: 'Remove' }).click();
    await expect(third.getByRole('button', { name: 'Really remove' })).toBeVisible();
    await third.getByRole('button', { name: 'Really remove' }).click();
    await page.locator('#save-lessons').click();
    await expect(page.locator('.lessons-edit > .lesson-rows > .lesson-row')).toHaveCount(2);
    const saved = (await api(page, '/settings')).lessons.worker;
    expect(saved.map((l) => l.id)).toEqual(['L000001', 'L000002']);
    expect(saved[0]).toMatchObject({ text: 'Run the linter before every push.', saved_by: 'user', provider: 'gpt' });
    expect(saved[1].text).toBe('Keep commits small.');
  });

  test('the fields are locked while a save is in flight', async ({ page }) => {
    await seed({ worker: [lesson('L0000e1', 'One.')] });
    await openSettings(page, '/app/settings#templates/lessons/worker');
    const field = page.locator('.lesson-row[data-id="L0000e1"] textarea');
    await field.fill('One, changed.');
    let release;
    const held = new Promise((r) => { release = r; });
    await page.route('**/settings/lessons/worker', async (route) => { await held; await route.continue(); });
    await page.locator('#save-lessons').click();
    await expect(field).toBeDisabled();
    await expect(page.locator('#save-lessons')).toBeDisabled();
    await expect(page.locator('.lesson-row button')).toBeDisabled();
    release();
    await expect(page.locator('#save-lessons')).toBeEnabled();
    await expect(field).toHaveValue('One, changed.');
    expect((await api(page, '/settings')).lessons.worker[0].text).toBe('One, changed.');
  });

  test('a lesson an agent removed meanwhile shows the 409 text', async ({ page }) => {
    await seed({ worker: [lesson('L0000c1', 'One.'), lesson('L0000c2', 'Two.')] });
    await openSettings(page, '/app/settings#templates/lessons/worker');
    await page.locator('.lesson-row[data-id="L0000c1"] textarea').fill('One, changed.');
    await seed({ worker: [lesson('L0000c2', 'Two.')] });
    await page.locator('#save-lessons').click();
    await expect(page.locator('.inline-err')).toHaveText('an agent removed a lesson you edited; reload to see the current list');
  });

  test('the preview caption names the AI and project markers', async ({ page }) => {
    await seed({});
    await openSettings(page, '/app/settings#templates');
    await page.locator('#new-template').click();
    await page.locator('#see-full').click();
    await expect(page.locator('#full-prompt-caption')).toContainText('Lessons marked for one AI or one project reach only agents on that AI or in that project.');
  });

  const version = (vid, text, extra = {}) => ({ vid, text, saved_by: 'agent', saved_at: '2026-10-01T10:00:00.000Z', changed_at: '2026-11-01T10:00:00.000Z', changed_by: 'user', ...extra });
  const ago = (days) => new Date(Date.now() - days * 86400000).toISOString();

  test('History toggle lists versions and Restore brings one back; disabled with unsaved edits', async ({ page }) => {
    await seed({ worker: [lesson('L0000b1', 'Newest wording.')] }, { lesson_history: { L0000b1: { role: 'worker', versions: [version('v1', 'Oldest wording.', { provider: 'gpt', project: '/tmp/proj-alpha', changed_by: 'agent' }), version('v2', 'Middle wording.', { saved_by: 'user' })] } } });
    await openSettings(page, '/app/settings#templates/lessons/worker');
    const row = page.locator('.lesson-row[data-id="L0000b1"]');
    await row.getByRole('button', { name: 'History (2)' }).click();
    const versions = row.locator('.lesson-version');
    await expect(versions).toHaveCount(2);
    await expect(versions.nth(0)).toContainText('Middle wording.');
    await expect(versions.nth(0)).toContainText('replaced by you 2026-11-01');
    await expect(versions.nth(1)).toContainText('only on GPT');
    await expect(versions.nth(1)).toContainText('only in proj-alpha');
    await expect(versions.nth(1)).toContainText('replaced by an agent 2026-11-01');
    await row.locator('textarea').fill('Unsaved.');
    await expect(versions.nth(1).getByRole('button', { name: 'Restore' })).toBeDisabled();
    await expect(page.locator('#restore-hint')).toBeVisible();
    await row.locator('textarea').fill('Newest wording.');
    await expect(versions.nth(1).getByRole('button', { name: 'Restore' })).toBeEnabled();
    await versions.nth(1).getByRole('button', { name: 'Restore' }).click();
    await expect(row.locator('textarea')).toHaveValue('Oldest wording.');
    const saved = (await api(page, '/settings')).lessons.worker[0];
    expect(saved).toMatchObject({ id: 'L0000b1', text: 'Oldest wording.', saved_by: 'user', provider: 'gpt' });
  });

  test('Keep and Discard keep unsaved typed text; a Restore that answers 409 reloads and shows the sentence', async ({ page }) => {
    const waiting = { role: 'worker', text: 'Queued.', saved_by: 'agent', saved_at: ago(1), source: 'file', received_at: ago(0), wid: 'wk' };
    await seed({ worker: [lesson('L0000f1', 'Fresh.'), lesson('L0000f2', 'Stale.', { saved_at: ago(120) })] }, { lesson_waiting: [waiting] });
    await openSettings(page, '/app/settings#templates/lessons/worker');
    const fresh = page.locator('.lesson-row[data-id="L0000f1"] textarea');
    await fresh.fill('Typed, not saved.');
    await page.locator('.lesson-row[data-id="L0000f2"]').getByRole('button', { name: 'Keep' }).click();
    await expect(page.locator('.lesson-row[data-id="L0000f2"] .keep-lesson')).toHaveCount(0);
    await expect(fresh).toHaveValue('Typed, not saved.');
    await page.locator('.lesson-waiting .lesson-row').getByRole('button', { name: 'Discard' }).click();
    await expect(page.locator('.lesson-waiting')).toHaveCount(0);
    await expect(fresh).toHaveValue('Typed, not saved.');
    await page.locator('#save-lessons').click();
    await expect.poll(async () => (await api(page, '/settings')).lessons.worker[0].text).toBe('Typed, not saved.');
  });

  test('a Restore that answers 409 reloads the editor and shows the sentence', async ({ page }) => {
    await seed({ worker: [lesson('L0000f3', 'Newest.')] }, { lesson_history: { L0000f3: { role: 'worker', versions: [version('gone', 'Older wording.')] } } });
    await openSettings(page, '/app/settings#templates/lessons/worker');
    const row = page.locator('.lesson-row[data-id="L0000f3"]');
    await row.getByRole('button', { name: 'History (1)' }).click();
    await seed({ worker: [lesson('L0000f3', 'Newest.')] });
    await row.locator('.lesson-version').getByRole('button', { name: 'Restore' }).click();
    await expect(page.locator('.lessons-edit .inline-err')).toBeVisible();
    await expect(page.locator('.lessons-edit .inline-err')).not.toBeEmpty();
    await expect(page.locator('.lesson-version')).toHaveCount(0);
  });

  test('a draft whose lesson an agent removed is shown back, not lost behind a Saved note', async ({ page }) => {
    await seed({ worker: [lesson('L0000a5', 'Lesson A.'), lesson('L0000a6', 'Lesson B.', { saved_at: ago(120) })] });
    await openSettings(page, '/app/settings#templates/lessons/worker');
    await page.locator('.lesson-row[data-id="L0000a5"] textarea').fill('My draft for A.');
    await seed({ worker: [lesson('L0000a6', 'Lesson B.', { saved_at: ago(120) })] });
    await page.locator('.lesson-row[data-id="L0000a6"]').getByRole('button', { name: 'Keep' }).click();
    await expect(page.locator('.lessons-edit .lesson-err')).toContainText('An agent removed a lesson you were editing. Your unsaved text was: \u201cMy draft for A.\u201d');
    await expect(page.locator('.note[data-for="section"]')).not.toHaveText('Saved');
  });

  test('Removed Restore names the newest version shown; a changed history answers 409', async ({ page }) => {
    const removed = { at: '2026-11-10T10:00:00.000Z', by: 'agent' };
    await seed({}, { lesson_history: { L0000a7: { role: 'worker', versions: [version('old', 'Old wording.'), version('shown', 'Shown wording.')], removed } } });
    await openSettings(page, '/app/settings#templates/lessons/worker');
    await expect(page.locator('.lesson-removed')).toContainText('Shown wording.');
    await seed({}, { lesson_history: { L0000a7: { role: 'worker', versions: [version('old', 'Old wording.'), version('newer', 'Newer wording.')], removed } } });
    await page.locator('.lesson-removed').getByRole('button', { name: 'Restore' }).click();
    await expect(page.locator('.lessons-edit .inline-err')).toBeVisible();
    expect((await api(page, '/settings')).lessons.worker).toEqual([]);
  });

  test('History says who replaced a version, not who saved it', async ({ page }) => {
    await seed({ worker: [lesson('L0000a8', 'Now.')] }, { lesson_history: { L0000a8: { role: 'worker', versions: [version('v1', 'Then.', { saved_by: 'agent', changed_by: 'user' })] } } });
    await openSettings(page, '/app/settings#templates/lessons/worker');
    await page.locator('.lesson-row[data-id="L0000a8"]').getByRole('button', { name: 'History (1)' }).click();
    await expect(page.locator('.lesson-version')).toContainText('replaced by you 2026-11-01');
  });

  test('the Templates lessons name stays on one line, desktop and phone', async ({ page }) => {
    await seed({ worker: [lesson('L0000a1', 'Old one.', { saved_at: ago(120) })] }, { lesson_waiting: [{ role: 'worker', text: 'Queued.', saved_by: 'agent', saved_at: ago(1), source: 'file', received_at: ago(0), wid: 'wg' }] });
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await openSettings(page, '/app/settings#templates');
      const nm = page.locator('.tpl-lessons .nm');
      await expect(nm).toHaveText('Lessons learned');
      await expect(page.locator('.tpl-lessons')).toContainText('1 may be out of date');
      const box = await nm.boundingBox();
      const line = await nm.evaluate((n) => parseFloat(getComputedStyle(n).lineHeight) || n.getBoundingClientRect().height);
      expect(box.height).toBeLessThanOrEqual(line + 2);
      await noSideScroll(page);
      if (process.env.LESSON_SHOTS) await page.screenshot({ path: path.join(process.env.LESSON_SHOTS, `templates-list-${width}.png`) });
    }
  });

  test('Removed section lists removed lessons and Restore puts one back', async ({ page }) => {
    await seed({ worker: [lesson('L0000d0', 'Still here.')] }, { lesson_history: { L0000d0: { role: 'worker', versions: [] }, L0000d1: { role: 'worker', versions: [version('b', 'Gone early.')], removed: { at: '2026-11-02T10:00:00.000Z', by: 'agent' } }, L0000d2: { role: 'worker', versions: [version('c', 'Gone late.')], removed: { at: '2026-11-10T10:00:00.000Z', by: 'user' } } } });
    await openSettings(page, '/app/settings#templates/lessons/worker');
    const removed = page.locator('.lesson-removed .lesson-row');
    await expect(removed).toHaveCount(2);
    await expect(removed.nth(0)).toContainText('Gone late.');
    await expect(removed.nth(0)).toContainText('removed by you 2026-11-10');
    await expect(removed.nth(1)).toContainText('removed by an agent 2026-11-02');
    await removed.nth(0).getByRole('button', { name: 'History (1)' }).click();
    await expect(removed.nth(0).locator('.lesson-version')).toHaveCount(1);
    await removed.nth(0).getByRole('button', { name: 'Restore' }).first().click();
    await expect(page.locator('.lesson-rows').first().locator('.lesson-row')).toHaveCount(2);
    await expect(page.locator('.lesson-removed .lesson-row')).toHaveCount(1);
    expect((await api(page, '/settings')).lessons.worker.map((l) => l.text)).toEqual(['Still here.', 'Gone late.']);
  });

  test('a restore into a full role shows the server sentence', async ({ page }) => {
    const twelve = Array.from({ length: 12 }, (_, i) => lesson('L0002' + i.toString(16).padStart(2, '0'), 'Full ' + i));
    await seed({ worker: twelve }, { lesson_history: { L000299: { role: 'worker', versions: [version('a1', 'Gone.')], removed: { at: '2026-11-10T10:00:00.000Z', by: 'agent' } } } });
    await openSettings(page, '/app/settings#templates/lessons/worker');
    await page.locator('.lesson-removed').getByRole('button', { name: 'Restore' }).click();
    await expect(page.locator('.inline-err')).toHaveText('Worker lessons are full (12): remove one before restoring');
  });

  test('a stale row shows the mark and Keep clears it; the list item counts', async ({ page }) => {
    await seed({ worker: [lesson('L0000c1', 'Old one.', { saved_at: ago(120) }), lesson('L0000c2', 'Fresh one.', { saved_at: ago(120), kept_at: ago(5) }), lesson('L0000c3', 'Also old.', { saved_at: ago(100) })] }, { lesson_waiting: [{ role: 'worker', text: 'Queued.', saved_by: 'agent', saved_at: ago(1), source: 'file', received_at: ago(0), wid: 'w1' }] });
    await openSettings(page, '/app/settings#templates');
    await expect(page.locator('.tpl-lessons')).toContainText('Written by agents · 3 · 2 may be out of date · 1 waiting to add');
    await page.locator('.tpl-lessons').click();
    const row = page.locator('.lesson-row[data-id="L0000c1"]');
    await expect(row).toContainText('Possibly out of date: not changed or kept since ' + ago(120).slice(0, 10));
    await expect(page.locator('.lesson-row[data-id="L0000c2"] .keep-lesson')).toHaveCount(0);
    await row.getByRole('button', { name: 'Keep' }).click();
    await expect(row.locator('.keep-lesson')).toHaveCount(0);
    await expect(page.locator('.tpl-lessons')).toContainText('1 may be out of date');
    expect((await api(page, '/settings')).lessons.worker[0].kept_at).toBeTruthy();
  });

  test('a role with only waiting lessons still has an entry; Add and Discard work', async ({ page }) => {
    const waiting = (wid, text) => ({ role: 'reviewer', text, saved_by: 'agent', saved_at: ago(1), source: 'handoff', received_at: ago(0), wid });
    await seed({ reviewer: [lesson('L0000e0', 'Have it.')] }, { lesson_waiting: [waiting('wa', 'Add me.'), waiting('wb', 'Drop me.'), waiting('wc', 'Have it.')] });
    await openSettings(page, '/app/settings#templates/lessons/reviewer');
    const rows = page.locator('.lesson-waiting .lesson-row');
    await expect(rows).toHaveCount(3);
    await rows.filter({ hasText: 'Drop me.' }).getByRole('button', { name: 'Discard' }).click();
    await expect(rows).toHaveCount(2);
    await rows.filter({ hasText: 'Have it.' }).getByRole('button', { name: 'Add' }).click();
    await expect(page.locator('.note')).toHaveText('Already in your lessons');
    await expect(rows).toHaveCount(1);
    await rows.getByRole('button', { name: 'Add' }).click();
    await expect(page.locator('.lesson-waiting')).toHaveCount(0);
    expect((await api(page, '/settings')).lessons.reviewer.map((l) => l.text)).toEqual(['Have it.', 'Add me.']);
  });

  test('Add is disabled while the role is full', async ({ page }) => {
    const twelve = Array.from({ length: 12 }, (_, i) => lesson('L0001' + i.toString(16).padStart(2, '0'), 'Full ' + i));
    await seed({ mapper: twelve }, { lesson_waiting: [{ role: 'mapper', text: 'Queued.', saved_by: 'agent', saved_at: ago(1), source: 'file', received_at: ago(0), wid: 'wf' }] });
    await openSettings(page, '/app/settings#templates/lessons/mapper');
    await expect(page.locator('.lesson-waiting .add-waiting')).toBeDisabled();
    await expect(page.locator('.lesson-waiting')).toContainText('Remove one first');
  });

  test('Export downloads the file and Import shows the counts', async ({ page }, info) => {
    await seed({ worker: [lesson('L0000f1', 'Export me.'), lesson('L0000f2', 'Scoped.', { project: '/tmp/not-on-this-machine' })] });
    await openSettings(page, '/app/settings#templates');
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#export-lessons').click()]);
    expect(download.suggestedFilename()).toBe('wheelchair-lessons.json');
    const file = info.outputPath('wheelchair-lessons.json');
    await download.saveAs(file);
    const exported = JSON.parse(await fs.readFile(file, 'utf8'));
    expect(exported.format).toBe('wheelchair-lessons');
    expect(exported.lessons.worker).toHaveLength(2);
    // Same file back in: one lesson is already here; the other is for a project this machine does not know.
    await page.locator('#import-lessons-file').setInputFiles(file);
    await expect(page.locator('.note')).toHaveText('Added 0, skipped 1 already here or removed or changed here, 0 waiting for room, 1 for projects not on this machine (add the project, then import the file again)');
    // A fresh role set plus one unreadable and one for an unknown project.
    const other = info.outputPath('other.json');
    await fs.writeFile(other, JSON.stringify({ format: 'wheelchair-lessons', version: 1, exported_at: new Date().toISOString(), lessons: { reviewer: [{ text: 'New one.', saved_by: 'agent', saved_at: ago(1) }, { text: '', saved_by: 'agent', saved_at: ago(1) }, { text: 'Elsewhere.', project: '/tmp/never-here', saved_by: 'agent', saved_at: ago(1) }] } }));
    await page.locator('#import-lessons-file').setInputFiles(other);
    await expect(page.locator('.note')).toHaveText('Added 1, skipped 0 already here or removed or changed here, 0 waiting for room, 1 unreadable, 1 for projects not on this machine (add the project, then import the file again)');
    expect((await api(page, '/settings')).lessons.reviewer.map((l) => l.text)).toEqual(['New one.']);
    const bad = info.outputPath('bad.json');
    await fs.writeFile(bad, '{"nope":1}');
    await page.locator('#import-lessons-file').setInputFiles(bad);
    await expect(page.locator('.note')).toHaveText("This isn't a wheelchair lessons file");
  });

  test('the history editor, removed, stale and waiting together (screenshot)', async ({ page }) => {
    await seed({ worker: [lesson('L0000a1', 'Run the lint first.', { saved_at: ago(150) }), lesson('L0000a2', 'Keep commits small.')] }, {
      lesson_history: { L0000a1: { role: 'worker', versions: [version('g', 'Lint before pushing.', { provider: 'gpt' })] }, L0000a3: { role: 'worker', versions: [version('h', 'Retired advice.')], removed: { at: ago(3), by: 'agent' } } },
      lesson_waiting: [{ role: 'worker', text: 'From a file.', saved_by: 'agent', saved_at: ago(1), source: 'file', received_at: ago(0), wid: 'ws' }],
    });
    await openSettings(page, '/app/settings#templates/lessons/worker');
    await page.locator('.lesson-row[data-id="L0000a1"]').getByRole('button', { name: 'History (1)' }).click();
    await expect(page.locator('.lesson-removed')).toBeVisible();
    await expect(page.locator('.lesson-waiting')).toBeVisible();
    if (process.env.LESSON_SHOTS) await page.screenshot({ path: path.join(process.env.LESSON_SHOTS, 'lessons-history.png'), fullPage: true });
  });
});

test.describe('thread notice', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  const base = (extra) => ({ id: 'n' + Math.random().toString(36).slice(2, 8), kind: 'lesson', session: 'x', created_at: new Date().toISOString(), why: 'it saved a rerun', lesson: 'L0000a1', ...extra });

  test('add, replace and remove notices, and the link opens the right entry', async ({ page }) => {
    await seed({ reviewer: [lesson('L0000a1', 'Read the diff twice.')] });
    await ctx.patch(made.id, (t) => {
      t.cards.push(base({ action: 'add', for: 'reviewer', text: 'Read the diff twice.', snapshot: { text: 'Read the diff twice.', provider: 'claude', project: '/tmp/proj-alpha' } }));
      t.cards.push(base({ action: 'replace', for: 'sub-lead', snapshot: { text: 'Split big parts.' } }));
      t.cards.push(base({ action: 'remove', for: 'verifier', snapshot: { text: 'Old advice.' } }));
    });
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    const notices = page.locator('.card-lesson');
    await expect(notices).toHaveCount(3);
    await expect(notices.nth(0)).toContainText('Saved a lesson for reviewers: Read the diff twice.');
    await expect(notices.nth(0)).toContainText('it saved a rerun');
    await expect(notices.nth(0)).toContainText('only on Claude');
    await expect(notices.nth(0)).toContainText('only in proj-alpha');
    await expect(notices.nth(1)).toContainText('Updated a lesson for sub-leads: Split big parts.');
    await expect(notices.nth(2)).toContainText('Removed a lesson for verifiers: Old advice.');
    await expect(notices.locator('button')).toHaveCount(0);
    const textBox = await notices.nth(2).locator('.lesson-text').boundingBox();
    const linkBox = await notices.nth(2).locator('.lesson-link').boundingBox();
    expect(Math.abs(textBox.y - linkBox.y)).toBeLessThan(4);
    await expect(page.locator('.card-needs')).toHaveCount(0);
    await expect.poll(async () => (await api(page, '/features')).needs.length).toBe(0);
    await notices.nth(0).getByRole('link', { name: 'Open in Settings' }).click();
    await expect(page).toHaveURL(/\/app\/settings#templates\/lessons\/reviewer$/);
    await expect(page.locator('.lessons-edit h2')).toContainText('Reviewer');
    await expect(page.locator('.lesson-row textarea')).toHaveValue('Read the diff twice.');
    await expect(page.locator('.tpl-lessons[aria-current="true"]')).toContainText('Written by agents · 1');
  });
});

test.describe('phone width', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('the editor and the notice do not scroll sideways', async ({ page }) => {
    const long = 'A long lesson '.repeat(18).trim();
    await seed({ worker: [lesson('L0000d1', long, { provider: 'gpt', project: '/tmp/proj-alpha', thread: made.id }), lesson('L0000d2', 'x'.repeat(120))] });
    await openSettings(page, '/app/settings#templates/lessons/worker');
    await expect(page.locator('.lesson-row')).toHaveCount(2);
    await noSideScroll(page);
    if (process.env.LESSON_SHOTS) await page.screenshot({ path: path.join(process.env.LESSON_SHOTS, 'lessons-editor.png') });
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    await expect(page.locator('.card-lesson').first()).toBeVisible();
    await noSideScroll(page);
    if (process.env.LESSON_SHOTS) await page.screenshot({ path: path.join(process.env.LESSON_SHOTS, 'thread-notice.png') });
  });
});
