'use strict';

// Seeds an app-server world for the Threads / thread page browser suite: the real hub behind a
// real viewer server, one fake machine service, thread files and transcript copies on disk.
const fs = require('node:fs/promises');
const path = require('node:path');
const { card, close, setup, thread } = require('./app.js');

function rows(list) { return list.map((r) => JSON.stringify(r)).join('\n') + '\n'; }
function human(text) {
  return { type: 'user', origin: { kind: 'human' }, message: { role: 'user', content: text } };
}
function reply(...parts) {
  return { type: 'assistant', message: { role: 'assistant', content: parts } };
}
const say = (text) => ({ type: 'text', text });

const TRANSCRIPT = rows([
  human('[wc:role] lead instructions'),
  reply(say('ROLE-REPLY-HIDDEN')),
  human('Please add a dark mode.'),
  reply(say('Looking at it now.'), { type: 'tool_use', name: 'Read', input: {} }),
  human('[wc:from wc-x-worker] result: done'),
  reply(say('HIDDEN-WORKER-REPLY')),
  human('[card c1] picked: Option B'),
  reply(say('Good, going with B.')),
  human('[wc:context restart] saved state'),
  reply(say('Back at work.')),
]);

async function patch(ctx, id, fn) {
  const file = path.join(ctx.state, 'threads', `${id}.json`);
  const value = JSON.parse(await fs.readFile(file, 'utf8'));
  fn(value);
  await fs.writeFile(file, JSON.stringify(value));
}

async function post(ctx, id, value) {
  const made = await card(ctx, id, ctx.lead(id).name, value);
  if (made.status !== 202) throw new Error(`card refused: ${JSON.stringify(made.body)}`);
  return made.body;
}

async function startWorld() {
  const ctx = await setup();
  const leads = {};
  ctx.lead = (id) => leads[id];
  ctx.make = async (input) => {
    const made = await thread(ctx, { project: '/tmp/project', ...input });
    leads[made.id] = made.sessions[0];
    return made;
  };
  ctx.post = (id, value) => post(ctx, id, value);
  ctx.patch = (id, fn) => patch(ctx, id, fn);
  ctx.close = () => close(ctx);
  ctx.transcript = async (id) => {
    const file = path.join(ctx.state, `${id}.jsonl`);
    await fs.writeFile(file, TRANSCRIPT);
    await patch(ctx, id, (t) => { t.sessions[0].transcript_path = file; t.sessions[0].cli = 'claude'; });
  };
  // A transcript whose lines carry the given ISO times: [[type, text, iso], ...] with type human|assistant.
  ctx.timedTranscript = async (id, lines) => {
    const file = path.join(ctx.state, `${id}.jsonl`);
    const all = [human('[wc:role] lead instructions'), reply(say('ROLE-REPLY-HIDDEN'))];
    for (const [type, text, timestamp] of lines) {
      all.push({ ...(type === 'human' ? human(text) : reply(say(text))), timestamp });
    }
    await fs.writeFile(file, rows(all));
    await patch(ctx, id, (t) => { t.sessions[0].transcript_path = file; t.sessions[0].cli = 'claude'; });
  };
  return ctx;
}

// A Playwright page that has signed in (remember cookie set by the token redirect).
async function signIn(page, ctx) {
  await page.goto(`${ctx.server.url}/?token=${ctx.server.token}`);
}

module.exports = { startWorld, signIn, TRANSCRIPT };
