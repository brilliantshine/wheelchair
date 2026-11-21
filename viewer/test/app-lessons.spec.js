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
const seed = async (lessons) => {
  const file = path.join(ctx.state, 'settings.json');
  let current = {};
  try { current = JSON.parse(await fs.readFile(file, 'utf8')); } catch { /* none yet */ }
  const all = Object.fromEntries(ROLES.map((role) => [role, []]));
  Object.assign(all, lessons);
  await fs.writeFile(file, JSON.stringify({ ...current, lessons: all }));
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
    await expect(page.locator('.lesson-row[data-id="L000002"]')).toContainText('edited by the user');
    await expect(page.locator('.lesson-row[data-id="L000003"] .lesson-from')).toHaveCount(0);

    await first.locator('textarea').fill('Run the linter before every push.');
    const third = page.locator('.lesson-row[data-id="L000003"]');
    await third.getByRole('button', { name: 'Remove' }).click();
    await expect(third.getByRole('button', { name: 'Really remove' })).toBeVisible();
    await third.getByRole('button', { name: 'Really remove' }).click();
    await page.locator('#save-lessons').click();
    await expect(page.locator('.lesson-row')).toHaveCount(2);
    const saved = (await api(page, '/settings')).lessons.worker;
    expect(saved.map((l) => l.id)).toEqual(['L000001', 'L000002']);
    expect(saved[0]).toMatchObject({ text: 'Run the linter before every push.', saved_by: 'user', provider: 'gpt' });
    expect(saved[1].text).toBe('Keep commits small.');
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
