'use strict';

// Theme rendering across the signed-in pages (docs/plans/theme-options, Spec §7.4): the saved
// theme applied by the real hub, readable contrast on the accent-coloured parts, and the things
// that stay dark (terminal, graph frames and their export, sign-in).
const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

const EMERALD = '#10b981';
const LIGHT_BG = 'rgb(246, 247, 249)';
const DARK_TERM = 'rgb(12, 14, 16)';
const FLOW = path.join(__dirname, 'fixtures/canonical.json');

let ctx;
test.beforeEach(async ({ page }) => {
  ctx = await startWorld();
  await page.addInitScript(installColorHelpers);
  await signIn(page, ctx);
});
test.afterEach(async ({ page }) => {
  // Firefox throws NS_BINDING_ABORTED when a polled route is mid-flight, so the page stops polling first.
  await page.goto('about:blank').catch(() => {});
  await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
  await ctx.close();
});

// Colour maths run in the page, so every number comes from what the browser computed.
function installColorHelpers() {
  const parse = (value) => {
    const text = String(value).trim();
    if (text.startsWith('#')) return [1, 3, 5].map((i) => parseInt(text.slice(i, i + 2), 16)).concat(1);
    const n = (text.match(/[\d.]+/g) || []).map(Number);
    return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1];
  };
  const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
  const luminance = (c) => {
    const [r, g, b] = c.slice(0, 3).map((v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const x = luminance(a); const y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // The colour actually behind an element: every background up the tree, composited.
  const behind = (node) => {
    const layers = [];
    for (let n = node; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] === 1) break;
    }
    return layers.reverse().reduce((under, top) => over(top, under), [255, 255, 255, 1]);
  };
  window.__color = { parse, over, ratio, behind, luminance };
}

// A polled re-render can detach the element mid-read (empty computed colour), so such a read is retried.
async function textContrast(locator) {
  let contrast;
  await expect.poll(async () => {
    contrast = await locator.evaluate((n) => {
      if (!n.isConnected) return null;
      const { parse, over, ratio, behind } = window.__color;
      const bg = behind(n);
      return ratio(over(parse(getComputedStyle(n).color), bg), bg);
    });
    return Number.isFinite(contrast);
  }).toBe(true);
  return contrast;
}
const cssVar = (page, name) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);
const rgbOf = (page, color) => page.evaluate((c) => { const [r, g, b] = window.__color.parse(c); return `rgb(${r}, ${g}, ${b})`; }, color);

async function setTheme(page, theme) {
  return page.evaluate(async (next) => {
    const url = '/wheelchair/api/settings/theme';
    const now = await (await fetch(url, { cache: 'no-store' })).json();
    const response = await fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ preset: 'default', mode: 'light', accent: null, ...next, revision: now.revision }) });
    if (!response.ok) throw new Error(`theme ${response.status} ${await response.text()}`);
    return response.json();
  }, theme);
}
// Waits until the page has painted the theme the hub holds now.
async function themed(page, saved) {
  await expect.poll(() => page.evaluate(() => window.wcTheme?.current().metadata?.revision)).toBe(saved.revision);
  await expect(page.locator('html')).toHaveAttribute('data-theme-mode', saved.mode);
}
async function open(page, route, saved) {
  await page.goto(`${ctx.server.url}${route}`);
  await themed(page, saved);
}

// A thread with a plan folder, a mockup card, a graph card, a question card, code in the chat and a lead mid-turn.
async function seedThread(page) {
  const made = await ctx.make({ cli: 'claude' });
  const worktree = path.join(ctx.state, 'worktree');
  const plan = path.join(worktree, 'docs/plans/dark');
  await fs.mkdir(path.join(plan, 'graphs'), { recursive: true });
  await fs.writeFile(path.join(plan, 'PLAN.md'), '# Theme plan\n\nRead [the idea](IDEA.md).\n');
  await fs.writeFile(path.join(plan, 'IDEA.md'), '# Idea\n');
  await fs.writeFile(path.join(plan, 'graphs/home.html'), '<body style="margin:0;background:#def"><h1>Mockup home</h1></body>');
  await fs.copyFile(FLOW, path.join(plan, 'graphs/flow.json'));
  await ctx.timedTranscript(made.id, [
    ['human', 'Please add themes.', '2026-01-01T10:00:00.000Z'],
    ['assistant', 'Like this:\n\n```\nnpm run theme\n```\n\nand `inline`.', '2026-01-01T10:01:00.000Z'],
  ]);
  await ctx.patch(made.id, (t) => {
    t.worktree = worktree; t.slug = 'dark'; t.lead_name = 'Juniper'; t.title = 'Theme thread';
    for (const s of t.sessions) if (s.role === 'lead') { s.live = true; s.ready = true; s.turn_ended = false; }
  });
  const mockup = await ctx.post(made.id, { kind: 'diagram', plan: 'dark', graph: 'home', title: 'Home mockup', format: 'mockup', width: 600, height: 400 });
  const graph = await ctx.post(made.id, { kind: 'diagram', plan: 'dark', graph: 'flow', title: 'Flow', format: 'graph' });
  await ctx.post(made.id, { kind: 'question', fits: 'Fits the idea.', question: 'Which palette?', why: 'Simplest.',
    options: [{ id: 'a', label: 'Light', consequence: 'Bright' }, { id: 'b', label: 'Dark', consequence: 'Calm' }], leaning: 'a' });
  // Marks one human line as sent by the assistant, as the hub does for a relayed instruction.
  await page.route(`**/api/threads/${made.id}/chat*`, async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    for (const item of data.items || []) if (item.type === 'human' && !item.card) item.by = 'assistant';
    await route.fulfill({ response, json: data });
  });
  return { made, plan, mockup, graph };
}

const AGENT_NODE = { name: 'wc-a-worker', role: 'worker', display_title: 'Build the feature', live: true, state: 'working', children: [],
  context: { percent: 40 }, activity: { counts: { files: 10, shell: 5 }, trail: ['files', 'shell', 'web'],
    current: { kind: 'web', label: 'Running tests', since: new Date().toISOString() },
    latest: [{ label: 'Step', at: new Date().toISOString(), state: 'running' }] } };
async function openAgents(page, saved) {
  const lead = { name: 'wc-a-lead', role: 'lead', display_title: 'A thread', live: true, state: 'working', children: [AGENT_NODE] };
  await page.route('**/api/agents', (route) => route.fulfill({ json: { leads: [{ thread_id: 'a', thread_title: 'A thread', lead_name: 'Alpha',
    project: 'project-a', stage: 'building', counts: { total: 2 }, session: lead, asides: [] }], machines: [] } }));
  await page.route('**/api/sessions/*/pane?*', (route) => route.fulfill({ json: { pane: 'Agent terminal ready' } }));
  await open(page, '/app/agents?lead=a&agent=wc-a-worker', saved);
  await expect(page.locator('.activity-trail')).toHaveCount(1);
}

test('a saved light theme with a custom accent applies to every signed-in page', async ({ page }) => {
  const { made, graph } = await seedThread(page);
  const saved = await setTheme(page, { accent: EMERALD });
  const pages = [
    ['/app/thread?id=' + made.id, '#head h1'],
    ['/app/threads', '#list li.row'],
    ['/app/new', '#new-form'],
    [`/app/picture?thread=${made.id}&card=${graph.id}`, 'iframe.picture-frame'],
    [`/app/doc?thread=${made.id}&file=PLAN.md`, '#content h1'],
  ];
  for (const [route, ready] of pages) {
    await open(page, route, saved);
    await expect(page.locator(ready).first()).toBeVisible();
    expect(await cssVar(page, '--accent'), route).toBe(EMERALD);
    await expect(page.locator('body'), route).toHaveCSS('background-color', LIGHT_BG);
    expect(await page.evaluate(() => getComputedStyle(document.body).colorScheme), route).toBe('light');
  }
  await open(page, `/app/picture?thread=${made.id}&card=${graph.id}`, saved);
  const frame = page.frameLocator('iframe.picture-frame');
  await expect(frame.locator('.node').first()).toBeVisible();
  expect(await frame.locator('body').evaluate((n) => window.__color.luminance(window.__color.parse(getComputedStyle(n).backgroundColor)))).toBeLessThan(0.05);
  await openAgents(page, saved);
  expect(await cssVar(page, '--accent')).toBe(EMERALD);
  await expect(page.locator('body')).toHaveCSS('background-color', LIGHT_BG);
});

test('accent labels, attribution and code blocks stay readable in light mode', async ({ page }) => {
  const { made } = await seedThread(page);
  const saved = await setTheme(page, { accent: EMERALD });
  await open(page, `/app/thread?id=${made.id}`, saved);

  const by = page.locator('.bubble.human .by-assistant').first();
  await expect(by).toBeVisible();
  await expect(by).toHaveCSS('color', await rgbOf(page, await cssVar(page, '--ink-2')));
  expect(await textContrast(by)).toBeGreaterThanOrEqual(4.5);

  const chip = page.locator('.lead-chip', { hasText: 'Juniper' }).first();
  await expect(chip).toHaveCSS('color', await rgbOf(page, await cssVar(page, '--accent-text')));
  expect(await textContrast(chip)).toBeGreaterThanOrEqual(4.5);

  const code = page.locator('#chat .md pre.md-code').first();
  const figure = await rgbOf(page, await cssVar(page, '--figure'));
  await expect(code).toHaveCSS('background-color', figure);
  expect(await textContrast(code.locator('code'))).toBeGreaterThanOrEqual(4.5);

  await openAgents(page, saved);
  const running = page.locator('.latest-running').first();
  await expect(running).toHaveCSS('color', await rgbOf(page, await cssVar(page, '--accent-text')));
  expect(await textContrast(running)).toBeGreaterThanOrEqual(4.5);
});

test('the assistant pop-up attribution and filled hover pairs stay readable', async ({ page }) => {
  await page.evaluate(async () => {
    const r = await fetch('/wheelchair/api/settings/preferences', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assistant: 'on' }) });
    if (!r.ok) throw new Error('preferences ' + r.status);
  });
  const status = await page.evaluate(async () => (await fetch('/wheelchair/api/assistant')).json());
  await ctx.timedTranscript(status.thread, [['human', 'Sent for you', '2026-01-01T10:00:00.000Z'], ['assistant', 'Done', '2026-01-01T10:01:00.000Z']]);
  await page.route(`**/api/threads/${status.thread}/chat*`, async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    for (const item of data.items || []) if (item.type === 'human' && !item.card) item.by = 'assistant';
    await route.fulfill({ response, json: data });
  });
  await ctx.make({ cli: 'claude' });

  for (const theme of [{ mode: 'light', preset: 'slate', accent: '#ffffff' }, { mode: 'dark', preset: 'slate', accent: '#ffffff' }, { mode: 'dark', accent: null }]) {
    const saved = await setTheme(page, theme);
    await open(page, '/app/threads', saved);
    await page.locator('.wc-asst-float').click();
    const tag = page.locator('.wc-asst-human .wc-asst-tag').first();
    await expect(tag).toBeVisible();
    expect(await textContrast(tag), JSON.stringify(theme)).toBeGreaterThanOrEqual(4.5);
  }

  for (const theme of [{ mode: 'dark', accent: '#ffffff' }, { mode: 'dark', accent: '#000000' }, { mode: 'light', accent: '#ffffff' }, { mode: 'light', accent: EMERALD }]) {
    const saved = await setTheme(page, theme);
    await open(page, '/app/threads', saved);
    const hoverBg = await rgbOf(page, await cssVar(page, '--accent-hover'));
    const hoverInk = await rgbOf(page, await cssVar(page, '--accent-hover-ink'));
    const check = async (locator, name) => {
      await locator.hover();
      const label = `${name} ${JSON.stringify(theme)}`;
      await expect(locator, label).toHaveCSS('background-color', hoverBg);
      await expect(locator, label).toHaveCSS('color', hoverInk);
      expect(await textContrast(locator), label).toBeGreaterThanOrEqual(4.5);
    };
    await page.evaluate(() => {
      const button = document.createElement('button');
      button.className = 'primary'; button.id = 'probe-primary'; button.textContent = 'Primary';
      document.querySelector('.col-main').prepend(button);
      document.querySelector('.shell').classList.remove('on-index');
    });
    await check(page.locator('#probe-primary'), 'primary button');
    await check(page.locator('#new-toggle'), 'new thread');
    await check(page.locator('.wc-asst-float'), 'floating button');
    await page.locator('.wc-asst-float').click();
    await page.getByRole('textbox', { name: 'Message the assistant' }).fill('hello');
    await expect(page.locator('.wc-asst-send')).toBeEnabled();
    await check(page.locator('.wc-asst-send'), 'pop-up send');
  }
});

test('keyboard focus rings on the composer, answer box and mockup comment box stay visible', async ({ page }) => {
  const { made } = await seedThread(page);
  for (const accent of ['#8a8a8a', '#ffffff']) {
    const saved = await setTheme(page, { accent });
    await open(page, `/app/thread?id=${made.id}`, saved);
    await page.getByRole('button', { name: 'Comment on a spot' }).click();
    await page.locator('.spot-layer').evaluate((n) => n.scrollIntoView({ block: 'center' }));
    await page.locator('.spot-layer').click({ position: { x: 40, y: 40 } });
    const vis = await rgbOf(page, await cssVar(page, '--accent-vis'));
    for (const selector of ['#composer textarea', '.own-words textarea', '.spot-box .spot-text']) {
      const box = page.locator(selector).first();
      await box.focus();
      const label = `${selector} ${accent}`;
      await expect(box, label).toHaveCSS('outline-style', 'solid');
      await expect(box, label).toHaveCSS('outline-width', '2px');
      await expect(box, label).toHaveCSS('outline-color', vis);
      expect(await box.evaluate((n) => {
        const { parse, ratio, behind } = window.__color;
        return ratio(parse(getComputedStyle(n).outlineColor), behind(n.parentElement));
      }), label).toBeGreaterThanOrEqual(3);
    }
    // The comment box sits on the figure surface, the hardest one for a mid grey.
    await expect(page.locator('.card-diagram .spot-box')).toHaveCSS('background-color', await rgbOf(page, await cssVar(page, '--figure')));
  }
});

test('the working dot, activity outline and trail stay visible with white and black accents', async ({ page }) => {
  const { made } = await seedThread(page);
  for (const accent of ['#ffffff', '#000000', '#696969']) {
    const saved = await setTheme(page, { accent });
    await open(page, '/app/threads', saved);
    const dot = page.locator(`#list li[data-id="${made.id}"] .dotmark.working:not(.amber):not(.green)`);
    // The seeded question card turns the dot amber; the plain working dot is what the accent colours.
    await page.locator(`#list li[data-id="${made.id}"] .dotmark`).first().evaluate((n) => { n.className = 'dotmark working'; });
    await expect(dot).toHaveCount(1);
    expect(await dot.evaluate((n) => {
      const { parse, ratio, behind } = window.__color;
      return ratio(parse(getComputedStyle(n).backgroundColor), behind(n.parentElement));
    }), `dot ${accent}`).toBeGreaterThanOrEqual(3);

    await openAgents(page, saved);
    const panel = await cssVar(page, '--panel-3');
    for (const surface of ['--panel-3', '--accent-soft']) {
      const under = await cssVar(page, surface);
      await expect.poll(() => page.locator('.agents-entry.selected').evaluate((n, color) => {
        if (!n.isConnected) return null;
        const { parse, ratio } = window.__color;
        return ratio(parse(getComputedStyle(n).borderTopColor), parse(color));
      }, under), `selected entry border on ${surface} ${accent}`).toBeGreaterThanOrEqual(3);
    }
    const outline = await page.locator('.activity-spot.current').evaluate((n, under) => {
      const { parse, ratio } = window.__color;
      const style = getComputedStyle(n);
      return { stroke: ratio(parse(style.stroke), parse(under)), fill: ratio(parse(style.stroke), parse(style.fill)) };
    }, panel);
    expect(outline.stroke, `outline ${accent}`).toBeGreaterThanOrEqual(3);
    expect(outline.fill, `outline on its fill ${accent}`).toBeGreaterThanOrEqual(3);
    const trail = await page.locator('.activity-trail').evaluate((n, under) => {
      const { parse, over, ratio } = window.__color;
      const style = getComputedStyle(n);
      const stroke = parse(style.stroke); stroke[3] = Number(style.strokeOpacity);
      return ratio(over(stroke, parse(under)), parse(under));
    }, panel);
    expect(trail, `trail ${accent}`).toBeGreaterThanOrEqual(3);
  }
});

test('the timeline connector stays visible with a white accent in light mode', async ({ page }) => {
  const { made, plan } = await seedThread(page);
  await fs.writeFile(path.join(plan, 'graphs/steps.json'), JSON.stringify({ form: 'timeline', explanation: 'Two steps.',
    events: [{ when: 'Today', label: 'Start' }, { when: 'Next', label: 'Finish' }] }));
  await ctx.post(made.id, { kind: 'diagram', plan: 'dark', graph: 'steps', title: 'Steps', format: 'form' });
  const saved = await setTheme(page, { accent: '#ffffff' });
  await open(page, `/app/thread?id=${made.id}`, saved);
  const event = page.locator('.form-event').first();
  await expect(event).toBeVisible();
  await expect(event).toHaveCSS('border-left-style', 'solid');
  // Both --panel and the surface really behind the line (the diagram card's own).
  const [panelRatio, cardRatio] = await event.evaluate((n, panel) => {
    const { parse, over, ratio, behind } = window.__color;
    return [parse(panel), behind(n)].map((under) => ratio(over(parse(getComputedStyle(n).borderLeftColor), under), under));
  }, await cssVar(page, '--panel'));
  expect(panelRatio, 'against --panel').toBeGreaterThanOrEqual(3);
  expect(cardRatio, 'against the card surface').toBeGreaterThanOrEqual(3);
});

test('a hovered recommended answer keeps a visible border with a white accent in light mode', async ({ page }) => {
  const { made } = await seedThread(page);
  const saved = await setTheme(page, { accent: '#ffffff' });
  await open(page, `/app/thread?id=${made.id}`, saved);
  const option = page.locator('.opt.lean').first();
  await expect(option).toBeEnabled();
  const surfaces = [await cssVar(page, '--panel'), await cssVar(page, '--accent-soft')];
  // Hover and read in one poll: a re-render can replace the button and drop the hover.
  await expect.poll(async () => {
    await option.hover();
    return option.evaluate((n, [panel, soft]) => {
      if (!n.isConnected || !n.matches(':hover')) return null;
      const { parse, over, ratio } = window.__color;
      const base = parse(panel);
      const border = parse(getComputedStyle(n).borderTopColor);
      return Math.min(...[base, over(parse(soft), base)].map((under) => ratio(over(border, under), under)));
    }, surfaces);
  }).toBeGreaterThanOrEqual(3);
});

test('the spinner takes the visible accent', async ({ page }) => {
  const { made } = await seedThread(page);
  const saved = await setTheme(page, { accent: '#ffffff' });
  await open(page, `/app/thread?id=${made.id}`, saved);
  const vis = await cssVar(page, '--accent-vis');
  expect(vis).not.toBe('#ffffff');
  const encoded = '%23' + vis.slice(1);
  expect(await cssVar(page, '--spinner-svg')).toContain(encoded);
  const spinner = page.locator('#working .spinner');
  await expect(spinner).toBeVisible();
  expect(await spinner.evaluate((n) => getComputedStyle(n).backgroundImage)).toContain(encoded);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await spinner.evaluate((n) => getComputedStyle(n).backgroundImage);
  expect(reduced).toContain(encoded);
  expect(reduced).toContain('spin 4s');
});

test('the standalone document page takes the theme, its links and error banner included', async ({ page }) => {
  const { made, plan } = await seedThread(page);
  // Reading the chat registers the plan with the isolated server.
  expect((await page.request.get(`${ctx.server.url}/api/threads/${made.id}/chat?token=${ctx.server.token}`)).ok()).toBeTruthy();
  const saved = await setTheme(page, { accent: EMERALD });
  const url = `/docs?plan=${encodeURIComponent(plan)}`;
  await open(page, `${url}&file=PLAN.md`, saved);
  await expect(page.locator('body')).toHaveCSS('background-color', LIGHT_BG);
  expect(await page.evaluate(() => getComputedStyle(document.body).colorScheme)).toBe('light');
  const link = page.locator('#content a');
  await expect(link).toHaveCSS('color', await rgbOf(page, await cssVar(page, '--accent-text')));
  expect(await textContrast(link)).toBeGreaterThanOrEqual(4.5);
  await link.hover();
  await expect(link).toHaveCSS('color', await rgbOf(page, await cssVar(page, '--accent-hi')));

  await page.route('**/wheelchair/doc?*', (route) => route.fulfill({ status: 500, body: 'broken' }));
  await open(page, `${url}&file=IDEA.md`, saved);
  const banner = page.locator('#error-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toHaveCSS('background-color', await rgbOf(page, await cssVar(page, '--bad-bg')));
  await expect(banner).toHaveCSS('border-top-color', await rgbOf(page, await cssVar(page, '--bad')));
  await expect(banner).toHaveCSS('color', await rgbOf(page, await cssVar(page, '--bad-text')));
  expect(await textContrast(banner)).toBeGreaterThanOrEqual(4.5);
});

test('the terminal stays dark with a readable typing cursor in light mode', async ({ page }) => {
  await page.addInitScript(() => {
    // Keeps a handle on the xterm instances so the theme they were given can be read back.
    let Real;
    window.__terms = [];
    Object.defineProperty(window, 'Terminal', { configurable: true,
      get: () => Real && class extends Real { constructor(options) { super(options); window.__terms.push(this); } },
      set: (value) => { Real = value; } });
  });
  const saved = await setTheme(page, { accent: EMERALD });
  await openAgents(page, saved);
  await page.getByRole('button', { name: 'Open terminal' }).click();
  const host = page.locator('#agents-terminal .tv-host');
  await expect(host).toHaveCSS('background-color', DARK_TERM);
  await expect(host).toHaveCSS('color', 'rgb(230, 232, 236)');
  expect(await host.evaluate((n) => getComputedStyle(n).colorScheme)).toBe('dark');
  await expect(host.locator('.xterm-viewport')).toHaveCSS('background-color', DARK_TERM);
  await page.getByRole('button', { name: 'View only' }).click();
  await expect(page.getByRole('button', { name: 'Typing' })).toBeVisible();
  expect(await cssVar(page, '--warn')).not.toBe('#d9a441');
  expect(await page.evaluate(() => window.__terms.at(-1).options.theme)).toEqual({ background: '#0c0e10', foreground: '#e6e8ec', cursor: '#d9a441' });
  await page.getByRole('button', { name: 'Typing' }).click();
  expect(await page.evaluate(() => window.__terms.at(-1).options.theme.cursor)).toBe('#e6e8ec');
});

// signin.html carries no stylesheet, so its default is the browser's own; the theme must not reach it.
test('sign-in keeps its default look', async ({ page, browser }) => {
  await setTheme(page, { accent: EMERALD });
  const context = await browser.newContext();
  try {
    const stranger = await context.newPage();
    await stranger.addInitScript(() => localStorage.setItem('wc-theme-v1', JSON.stringify({ mode: 'light', preset: 'default', accent: '#10b981', revision: 99 })));
    const response = await stranger.goto(`${ctx.server.url}/app/threads`);
    expect(response.status()).toBe(401);
    expect(await stranger.evaluate(() => ({ mode: document.documentElement.dataset.themeMode || null,
      style: document.documentElement.getAttribute('style'), scripts: document.scripts.length,
      body: getComputedStyle(document.body).backgroundColor, controller: !!window.wcTheme })))
      .toEqual({ mode: null, style: null, scripts: 0, body: 'rgba(0, 0, 0, 0)', controller: false });
  } finally {
    await context.close();
  }
});

test('a reload in light mode is light before the body exists', async ({ page }) => {
  const saved = await setTheme(page, { accent: EMERALD });
  await page.addInitScript(() => {
    new MutationObserver((_, observer) => {
      if (!document.body) return;
      observer.disconnect();
      window.__firstPaint = { mode: document.documentElement.dataset.themeMode || null, bg: document.documentElement.style.getPropertyValue('--bg') };
    }).observe(document, { childList: true, subtree: true });
  });
  await open(page, '/app/threads', saved);
  // With the hub silent, only the cached pre-paint script can colour the page.
  await page.route('**/api/settings/theme', () => {});
  for (const route of ['/app/threads', '/app/new', '/app/agents', '/app/features', '/app/terminal?name=x',
    '/app/thread?id=x', '/app/doc?thread=x&file=PLAN.md', '/app/file?thread=x&file=y', '/app/picture?thread=x&card=y']) {
    await page.goto(`${ctx.server.url}${route}`, { waitUntil: 'domcontentloaded' });
    expect(await page.evaluate(() => window.__firstPaint), route).toEqual({ mode: 'light', bg: '#f6f7f9' });
  }
});

test('with a background picture in light mode the content surfaces stay opaque', async ({ page }) => {
  const { made } = await seedThread(page);
  const saved = await setTheme(page, { accent: EMERALD });
  await page.goto(`${ctx.server.url}/app/settings#you`);
  await expect.poll(() => page.evaluate(() => window.wcBackground.current().metadata !== null)).toBe(true);
  await page.getByLabel('Choose background image').setInputFiles(path.join(__dirname, 'fixtures/background-browser/quadrants.png'));
  const editor = page.locator('.background-editor');
  await expect(page.locator('.background-layer img')).toHaveCount(1);
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(editor.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  await open(page, `/app/thread?id=${made.id}`, saved);
  await expect(page.locator('.background-layer img')).toHaveCount(1);
  const bg = await rgbOf(page, await cssVar(page, '--bg'));
  expect(bg).toBe(LIGHT_BG);
  for (const selector of ['.thread-head', '.bubble.assistant', '#composer', '.col-list', '.col-side']) {
    await expect(page.locator(selector).first(), selector).toHaveCSS('background-color', bg);
  }
  const panel = await rgbOf(page, await cssVar(page, '--panel'));
  await expect(page.locator('.card-question').first()).toHaveCSS('background-color', panel);
});

test('a graph exported from a light Picture page keeps the dark canvas of its frame', async ({ page }) => {
  const { made, graph } = await seedThread(page);
  const saved = await setTheme(page, { accent: EMERALD });
  await open(page, `/app/picture?thread=${made.id}&card=${graph.id}`, saved);
  await expect(page.locator('body')).toHaveCSS('background-color', LIGHT_BG);
  const frame = page.frameLocator('iframe.picture-frame');
  await expect(frame.locator('.node').first()).toBeVisible();
  const frameBg = await frame.locator('html').evaluate((n) => window.__color.parse(getComputedStyle(n).getPropertyValue('--bg').trim()).slice(0, 3));
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#download').click()]);
  const bytes = await fs.readFile(await download.path());
  // The page's CSP blocks fetching a data: URL, so the PNG is decoded from bytes.
  const corner = await page.evaluate(async (b64) => {
    const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([raw], { type: 'image/png' }));
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const g = canvas.getContext('2d'); g.drawImage(bitmap, 0, 0);
    return Array.from(g.getImageData(0, 0, 1, 1).data).slice(0, 3);
  }, bytes.toString('base64'));
  expect(corner).toEqual(frameBg);
  expect(Math.max(...corner)).toBeLessThan(64);
});
