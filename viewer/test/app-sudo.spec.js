'use strict';

// Sudo cards on the thread page (docs/plans/sudo-cards, "The sudo card"): the command in full,
// the three controls while waiting, every outcome state, the editable-file warning, and
// everything set as text, driven at phone width and desktop width against a real viewer server.
const { test, expect } = require('@playwright/test');
const { api, machinePost } = require('./helpers/app.js');
const { startWorld, signIn } = require('./helpers/app-threads-world');

const rid = (n) => String(n).repeat(32).slice(0, 32);
const sudo = (n, extra = {}) => ({
  kind: 'sudo',
  command: 'systemctl restart nginx',
  does: 'Restarts the web server.',
  why: 'The config changed.',
  request_id: rid(n),
  url: `https://host.example.ts.net:8445/r/${rid(n)}`,
  editable: [],
  ...extra,
});
const outcome = (ctx, n, body) => machinePost(ctx, '/machine/sudo-outcome', { request_id: rid(n), delivery_id: `d-${n}-${body.state}`, ...body });
const cardOf = (page, text) => page.locator('.card-sudo', { hasText: text });

for (const [label, size] of [['phone', { width: 375, height: 800 }], ['desktop', { width: 1280, height: 800 }]]) {
  test.describe(`sudo cards, ${label}`, () => {
    test.use({ viewport: size });
    let ctx;
    test.beforeEach(async ({ page }) => { ctx = await startWorld(); await signIn(page, ctx); });
    test.afterEach(async () => { await ctx.close(); });
    const open = (page, id) => page.goto(`${ctx.server.url}/app/thread?id=${id}`);

    test('a long command is shown in full, wrapped, with three controls and no password field', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      const long = `/usr/bin/tee /etc/${'a'.repeat(900)}/conf < /dev/null && echo ${'word '.repeat(150)}end`;
      await ctx.post(made.id, sudo(1, { command: long }));
      await open(page, made.id);
      const card = page.locator('.card-sudo');
      await expect(card).toHaveAttribute('data-state', 'waiting');
      expect(await card.locator('.sudo-command').evaluate((n) => n.textContent)).toBe(long);
      const fits = await card.locator('.sudo-command').evaluate((n) => ({
        wraps: n.scrollWidth <= n.clientWidth + 1, family: getComputedStyle(n).fontFamily, white: getComputedStyle(n).whiteSpace,
      }));
      expect(fits.wraps).toBe(true);
      expect(fits.family).toMatch(/mono|Menlo|Consolas/i);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
      await expect(card).toContainText('Restarts the web server.');
      await expect(card).toContainText('The config changed.');
      const open_ = card.getByRole('link', { name: 'Open to run' });
      await expect(open_).toHaveAttribute('href', `https://host.example.ts.net:8445/r/${rid(1)}`);
      await expect(open_).toHaveAttribute('target', '_blank');
      await expect(open_).toHaveAttribute('rel', 'noopener noreferrer');
      await expect(card.getByRole('button', { name: 'Decline' })).toBeVisible();
      await expect(card.getByRole('button', { name: 'Talk about it' })).toBeVisible();
      await expect(card.locator('input, textarea')).toHaveCount(0);
      await expect(page.locator('input[type=password]')).toHaveCount(0);
      await expect(card.locator('.sudo-editable')).toHaveCount(0);
    });

    test('the editable-file warning sits above the command', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      await ctx.post(made.id, sudo(2, { command: 'sh /home/c/run.sh', editable: ['/home/c/run.sh', '/home/c'] }));
      await open(page, made.id);
      const card = page.locator('.card-sudo');
      const warning = card.locator('.sudo-editable');
      await expect(warning).toContainText('An agent could change these files before this runs:');
      await expect(warning.locator('li')).toHaveText(['/home/c/run.sh', '/home/c']);
      const [warn, command] = await Promise.all([warning.boundingBox(), card.locator('.sudo-command').boundingBox()]);
      expect(warn.y + warn.height).toBeLessThanOrEqual(command.y + 1);
    });

    test('every outcome state shows its result and drops the buttons', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      for (const n of [3, 4, 5, 6, 7, 8]) await ctx.post(made.id, sudo(n, { command: `echo case-${n}` }));
      await outcome(ctx, 3, { state: 'running' });
      await outcome(ctx, 4, { state: 'ran', exit_code: 0, output: 'all good\nsecond line', truncated: true });
      await outcome(ctx, 5, { state: 'ran', exit_code: 2, output: 'it broke' });
      await outcome(ctx, 6, { state: 'declined' });
      await outcome(ctx, 7, { state: 'expired' });
      await outcome(ctx, 8, { state: 'failed', reason: 'wrong password 3 times' });
      await open(page, made.id);
      const gone = async (card) => {
        await expect(card.getByRole('button', { name: 'Decline' })).toHaveCount(0);
        await expect(card.getByRole('link', { name: 'Open to run' })).toHaveCount(0);
      };

      const running = cardOf(page, 'case-3');
      await expect(running).toHaveAttribute('data-state', 'running');
      await expect(running).toContainText('Running…');
      await gone(running);

      const ran = cardOf(page, 'case-4');
      await expect(ran).toHaveAttribute('data-state', 'ran');
      await expect(ran).toContainText('Ran: exit 0');
      expect(await ran.locator('.sudo-output').evaluate((n) => n.textContent)).toBe('all good\nsecond line');
      expect(await ran.locator('.sudo-output').evaluate((n) => getComputedStyle(n).fontFamily)).toMatch(/mono|Menlo|Consolas/i);
      await expect(ran).toContainText('Output cut');
      await gone(ran);

      const bad = cardOf(page, 'case-5');
      await expect(bad).toContainText('Ran: exit 2');
      await expect(bad).toContainText('it broke');
      await expect(bad.locator('.sudo-cut')).toHaveCount(0);

      const declined = cardOf(page, 'case-6');
      await expect(declined).toContainText('Declined');
      await gone(declined);
      await expect(cardOf(page, 'case-7')).toContainText('Expired');
      const failed = cardOf(page, 'case-8');
      await expect(failed).toContainText('Failed: wrong password 3 times');
      await gone(failed);
      for (const n of [3, 4, 5, 6, 7, 8]) await expect(cardOf(page, `case-${n}`).getByRole('button', { name: 'Talk about it' })).toHaveCount(0);
    });

    test('HTML in the command, text fields and output is shown as text', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      const img = '<img src=x onerror="window.__pwned = 1">';
      await ctx.post(made.id, sudo(9, {
        command: `echo ${img}</script><script>window.__pwned = 2</script>`,
        does: `<b>${img}</b>`,
        why: `<i>why</i> ${img}`,
        editable: [`/tmp/${img}`],
      }));
      await outcome(ctx, 9, { state: 'ran', exit_code: 0, output: `${img}\n<script>window.__pwned = 3</script>` });
      await open(page, made.id);
      const card = page.locator('.card-sudo');
      await expect(card).toContainText('Ran: exit 0');
      expect(await card.locator('.sudo-command').evaluate((n) => n.textContent)).toBe(`echo ${img}</script><script>window.__pwned = 2</script>`);
      expect(await card.locator('.sudo-output').evaluate((n) => n.textContent)).toBe(`${img}\n<script>window.__pwned = 3</script>`);
      await expect(card.locator('img, script, b, i')).toHaveCount(0);
      await expect(card).toContainText('<b><img src=x');
      await expect(card).toContainText('<i>why</i>');
      expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
    });

    test('Decline reads Declining… while pending, then shows the error beside unchanged buttons', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      await ctx.post(made.id, sudo(1));
      await open(page, made.id);
      const card = page.locator('.card-sudo');
      await expect(card.getByRole('button', { name: 'Decline' })).toBeVisible();
      // The fake machine has no sudo route, so the hub's call to it fails; hold the press open first.
      await page.route('**/cards/*/press', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 800));
        await route.continue();
      });
      await card.getByRole('button', { name: 'Decline' }).click();
      await expect(card.getByRole('button', { name: 'Declining…' })).toBeDisabled();
      await expect(card.locator('.card-error')).toContainText("Couldn't reach hub to decline. Try again.");
      await expect(card.getByRole('button', { name: 'Decline' })).toBeEnabled();
      await expect(card.getByRole('button', { name: 'Talk about it' })).toBeEnabled();
      await expect(card.getByRole('link', { name: 'Open to run' })).toBeVisible();
      await expect(card).toHaveAttribute('data-state', 'waiting');
    });

    test('Talk about it leaves the card waiting with its buttons', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      await ctx.post(made.id, sudo(1));
      await open(page, made.id);
      const card = page.locator('.card-sudo');
      await card.getByRole('button', { name: 'Talk about it' }).click();
      // The lead is told, once per press; the bubble itself comes from the lead's transcript.
      await expect.poll(async () => {
        const listed = (await api(ctx, '/threads')).body.threads.find((item) => item.id === made.id);
        const sent = (ctx.machine.sessions.get(made.sessions[0].name)?.submits || []);
        return [...sent, ...(listed.queues?.[made.sessions[0].name] || []).map((m) => m.text)].filter((t) => t.endsWith('talk about: sudo request')).length;
      }).toBe(1);
      await expect(card).toHaveAttribute('data-state', 'waiting');
      await expect(card).not.toHaveClass(/is-answered/);
      await expect(card.getByRole('button', { name: 'Decline' })).toBeVisible();
      await expect(card.getByRole('button', { name: 'Talk about it' })).toBeVisible();
    });
  });
}
