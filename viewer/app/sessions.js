'use strict';

// Spec "Agents start and stop sessions", "Prompts mid-run", and Edge cases.
const crypto = require('node:crypto');
const { addCard } = require('./cards.js');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { appError } = require('./state.js');
const { outOfDate } = require('./ready.js');

const execFileAsync = promisify(execFile);

// Spec "Models per role": a tier names a model per CLI. `top` is Claude's default model (no
// --model) and GPT Sol.
const TIERS = {
  codex: ['luna', 'terra', 'sol'],
  claude: ['haiku', 'sonnet', 'opus'],
};

async function resolveModel(hub, cli, tier = 'top') {
  if (!TIERS[cli]) throw appError(400, `unknown cli: ${cli}`);
  if (tier === 'top') {
    if (cli === 'claude') return undefined;
    tier = 'sol';
  }
  if (!TIERS[cli].includes(tier)) {
    throw appError(400, `tier "${tier}" does not fit ${cli}; use ${[...TIERS[cli], 'top'].join(', ')}`);
  }
  if (cli === 'claude') return tier;
  try {
    return (await execFileAsync(path.join(hub.root, 'codex', 'model.sh'), [tier])).stdout.trim();
  } catch (error) {
    throw appError(400, `no model pinned for ${tier}: ${(error.stderr || error.message).trim()}`);
  }
}

const SESSION_ROLES = new Set([
  'lead',
  'sub-lead',
  'mapper',
  'worker',
  'reviewer',
  'verifier',
]);

const ALLOWED_START = {
  lead: new Set(['mapper', 'reviewer', 'sub-lead', 'verifier']),
  'sub-lead': new Set(['worker', 'verifier']),
};

function publicSession(session) {
  const { token, ...value } = session;
  return value;
}

function newSessionName(thread, role) {
  const base = `wc-${thread.id}-${role}`;
  let name = base;
  let sequence = 1;
  while (thread.sessions.some((session) => session.name === name)) {
    sequence += 1;
    name = `${base}-${sequence}`;
  }
  return name;
}

async function startSession(hub, thread, input) {
  const role = input.role;
  if (!SESSION_ROLES.has(role)) throw appError(400, 'unknown role');
  const cli = input.cli || thread.cli;
  if (cli === 'codex') {
    try {
      await hub.call(thread.machine, '/v1/preflight', 'POST', {});
    } catch (error) {
      const detail = error.body?.output || error.message;
      if (role === 'lead') {
        addCard(thread, { kind: 'needs', title: 'Codex preflight failed', body: `Codex preflight failed: ${detail}` }, { system: true });
        await hub.save(thread);
      }
      throw appError(409, `Codex preflight failed: ${detail}`);
    }
  }
  const model = await resolveModel(hub, cli, input.tier);
  // Spec "Machine service on the hub": no new sessions while that service runs another commit.
  // A service that can't be reached falls through to the start, which records the failure.
  const current = await hub.call(thread.machine, '/v1/status', 'GET').catch(() => null);
  if (current && await outOfDate(hub, current)) throw appError(409, 'machine service out of date');
  const token = crypto.randomBytes(32).toString('hex');
  const session = {
    name: input.name || newSessionName(thread, role),
    role,
    started_by: input.started_by || null,
    token,
    cli,
    attempt_id: input.attempt_id || null,
    status: 'starting',
    queue: [],
    ready: false,
    live: true,
    created_at: new Date().toISOString(),
  };
  thread.sessions.push(session);
  await hub.save(thread);

  let started;
  try {
    started = await hub.call(thread.machine, '/v1/sessions', 'POST', {
      role,
      cli,
      thread_id: thread.id,
      token,
      name: session.name,
      attempt_id: session.attempt_id,
      started_by: session.started_by,
      project_dir: thread.project,
      project: require('node:path').basename(thread.project),
      worktree: input.worktree,
      branch: input.branch,
      brief: input.brief || '',
      model,
      verify_ref: input.verify_ref,
      base: input.base,
      default_branch: thread.default_branch,
    });
  } catch (error) {
    // Leave no session claiming to be "starting" forever: record why it never started.
    Object.assign(session, { status: 'failed', live: false, error: error.message });
    await hub.save(thread);
    throw error;
  }
  Object.assign(session, started, {
    token,
    started_by: session.started_by,
    queue: session.queue || [],
    ready: started.status === 'ready',
    live: true,
    // The service types a first message itself (Codex's [wc:role] line, or a brief) once the
    // session is ready; without one, a ready session is idle and may take the queue at once.
    first_message: session.cli === 'codex' || Boolean(input.brief),
  });
  markIdleIfFresh(session);
  if (!thread.worktree && started.worktree) {
    thread.worktree = started.worktree;
    thread.branch = `wc/${thread.id}`;
  }
  if (started.default_branch) thread.default_branch = started.default_branch;
  await hub.save(thread);
  return session;
}

// Reviewers and verifiers never post cards: the last assistant message of their turn is their
// report, delivered to the session that started them as their result (Spec "Cards").
async function deliverReport(hub, thread, target, payload) {
  if (!['reviewer', 'verifier'].includes(target.role) || !target.started_by || target.finished) return;
  const chat = require('./chat.js');
  let text = String(payload['last-assistant-message'] || payload.payload?.last_assistant_message || '').trim();
  if (!text) text = chat.lastAssistantText(target.cli, await chat.sessionTranscript(hub, thread, target));
  if (!text) return;
  const commit = text.match(/^COMMIT:\s*([0-9a-f]{7,40})/m)?.[1];
  addCard(
    thread,
    { kind: 'result', task: target.role, outcome: 'done', summary: text, ...(commit ? { commit } : {}) },
    { session: target.name },
  );
  target.finished = true;
  return enqueue(
    hub,
    thread,
    target.started_by,
    `[wc:from ${target.name}] result: ${text}`,
    'result',
    false,
    { save: false, deliver: false },
  );
}

// A session that has just become ready, with no first message of its own, has had no turn
// to end, so no turn-ended event will ever arrive to release its queue.
function markIdleIfFresh(target) {
  if (target.ready && target.turn_ended === undefined && target.first_message === false) {
    target.turn_ended = true;
  }
}

function session(thread, name) {
  const found = thread.sessions.find((item) => item.name === name);
  if (!found) throw appError(404, 'session not found in thread');
  return found;
}

async function enqueue(hub, thread, name, text, source = 'app', first = false, { save = true, deliver: deliverNow = true } = {}) {
  const target = session(thread, name);
  target.queue ||= [];
  thread.queues ||= {};
  const message = { text, source, at: new Date().toISOString() };
  if (first) target.queue.unshift(message);
  else target.queue.push(message);
  thread.queues[name] = target.queue;
  if (save) await hub.save(thread);
  if (deliverNow) await deliver(hub, thread, target);
  return target;
}

function canDeliver(target) {
  const held = target.permission_open || target.needs_open;
  return Boolean(target.live && target.ready && target.turn_ended && !held && target.queue?.length);
}

async function deliver(hub, thread, target) {
  if (!canDeliver(target)) return false;
  const next = target.queue[0];
  // Submission is the acknowledgement.  Do not discard a message or mark the session busy
  // until the machine accepted it; a transient service failure must leave it retryable.
  try {
    await hub.call(thread.machine, `/v1/sessions/${encodeURIComponent(target.name)}/submit`, 'POST', { text: next.text });
  } catch (error) {
    target.delivery_error = { text: error.message || String(error), at: new Date().toISOString() };
    await hub.save(thread);
    return false;
  }
  target.queue.shift();
  target.turn_ended = false;
  delete target.delivery_error;
  thread.queues ||= {};
  thread.queues[target.name] = target.queue;
  thread.sent ||= [];
  thread.sent.push({ to: target.name, text: next.text, source: next.source, at: new Date().toISOString() });
  const trimmed = thread.sent.splice(0, Math.max(0, thread.sent.length - 500));
  await hub.appendSent(thread, trimmed);
  await hub.save(thread);
  return true;
}

async function event(hub, payload) {
  const thread = await hub.thread(payload.thread_id);
  thread.delivered_ids ||= [];
  if (payload.delivery_id && thread.delivered_ids.includes(payload.delivery_id)) {
    return { ok: true, duplicate: true };
  }
  const target = session(thread, payload.session);
  const deliveryTargets = new Set();
  const type = payload.type;
  if (type === 'ready') {
    target.ready = true;
    target.status = 'ready';
    markIdleIfFresh(target);
  }
  if (['turn-ended', 'turn_ended', 'turn ended'].includes(type)) {
    target.turn_ended = true;
    const reportTarget = await deliverReport(hub, thread, target, payload);
    if (reportTarget) deliveryTargets.add(reportTarget.name);
  }
  const permission = type === 'prompt' && payload.notification_type === 'permission_prompt';
  if (type === 'stuck' || permission) {
    target.needs_open = true;
    target.permission_open = permission;
    const title = type === 'stuck' ? 'Session stuck at startup' : 'Permission needed';
    const body = `${target.name} needs attention before messages can continue.`;
    target.needs_card = addCard(
      thread,
      { kind: 'needs', title, body },
      { system: true, session: target.name },
    ).id;
  }
  // Claude says when it asks for permission but not when the prompt goes; a turn that ends
  // means the prompt was answered, so it clears the hold and the card too.
  const turnEnded = ['turn-ended', 'turn_ended', 'turn ended'].includes(type);
  if (['ready', 'prompt-cleared', 'permission-cleared'].includes(type) || (turnEnded && target.permission_open)) {
    target.permission_open = false;
    if (target.needs_open) {
      target.needs_open = false;
      const card = thread.cards.find((item) => item.id === target.needs_card);
      if (card) card.answered = true;
    }
  }
  // The event and its delivery id become durable before any submit is attempted. A failed
  // submit is retried by the queue timer rather than asking the sender to replay the event.
  if (payload.delivery_id) {
    thread.delivered_ids = [...thread.delivered_ids, payload.delivery_id].slice(-500);
  }
  await hub.save(thread);
  deliveryTargets.add(target.name);
  for (const name of deliveryTargets) await deliver(hub, thread, session(thread, name));
  return { ok: true };
}

async function sessionRequest(hub, payload) {
  const thread = await hub.threadBySession(payload.calling_session);
  const caller = session(thread, payload.calling_session);
  if (payload.action === 'list') {
    return { sessions: thread.sessions.map(publicSession) };
  }
  if (payload.action === 'stop') return stopSession(hub, thread, caller, payload.name);
  if (payload.action !== 'start' || !ALLOWED_START[caller.role]?.has(payload.role)) {
    throw appError(403, `${caller.role} may not start that session`);
  }
  if (!payload.attempt_id) throw appError(400, 'attempt_id is required');
  const duplicate = thread.sessions.find((item) => (
    item.started_by === caller.name && item.attempt_id === payload.attempt_id && item.live
  ));
  if (duplicate) return { session: publicSession(duplicate), duplicate: true };
  if (payload.role === 'sub-lead' && thread.sessions.some((item) => item.role === 'sub-lead' && item.live)) {
    throw appError(409, 'a live sub-lead already exists');
  }
  const started = await startSession(hub, thread, {
    role: payload.role,
    cli: payload.cli,
    started_by: caller.name,
    attempt_id: payload.attempt_id,
    brief: payload.brief,
    tier: payload.tier,
    // Spec "Branches and checkouts": the mapper, reviewers and the sub-lead run in the thread's
    // own worktree; a worker gets a branch cut from the thread's branch; a verifier checks the
    // thread's branch as it stands, commits not yet pushed included.
    ...(['mapper', 'reviewer', 'sub-lead'].includes(payload.role) ? { worktree: thread.worktree, branch: thread.branch } : {}),
    base: payload.role === 'worker' ? thread.branch : undefined,
    verify_ref: payload.role === 'verifier' ? thread.branch : undefined,
    ...(payload.role === 'worker' && payload.replaces ? (() => {
      const replaced = session(thread, payload.replaces);
      if (replaced.role !== 'worker' || replaced.live) throw appError(400, 'replacement must be a dead worker in this thread');
      return { worktree: replaced.worktree, branch: replaced.branch };
    })() : {}),
  });
  return { session: publicSession(started) };
}

async function stopSession(hub, thread, caller, name) {
  const target = session(thread, name);
  const starter = target.started_by && thread.sessions.find((item) => item.name === target.started_by);
  const canResumeRole = ['lead', 'sub-lead'].includes(caller.role) && starter?.role === caller.role;
  const canStop = target.started_by === caller.name || canResumeRole || (
    caller.role === 'lead' && target.started_by && target.role !== 'lead'
  );
  if (!canStop) throw appError(403, 'only the starter may stop this session');
  await hub.call(thread.machine, `/v1/sessions/${encodeURIComponent(target.name)}`, 'DELETE');
  target.live = false;
  target.status = 'stopped';
  await hub.save(thread);
  return { ok: true };
}

async function pollDead(hub) {
  const byMachine = new Map();
  for (const thread of await hub.allThreads()) {
    if (thread.archived) continue;
    if (!byMachine.has(thread.machine)) byMachine.set(thread.machine, []);
    byMachine.get(thread.machine).push(thread);
  }
  for (const [machine, threads] of byMachine) {
    let listed;
    try {
      listed = await hub.call(machine, '/v1/sessions', 'GET');
    } catch {
      continue;
    }
    const live = new Set(
      listed
        .filter((item) => item.running !== false && item.status !== 'stopped')
        .map((item) => item.name),
    );
    for (const listedThread of threads) {
      await hub.withThread(listedThread.id, async () => {
        const thread = await hub.thread(listedThread.id);
        let changed = false;
        for (const target of thread.sessions.filter((item) => item.live && !live.has(item.name))) {
          target.live = false;
          target.status = 'ended';
          changed = true;
          if (target.started_by) {
            const text = `[wc:from app] your session ${target.name} ended`;
            await enqueue(hub, thread, target.started_by, text, 'app');
          } else if (target.role === 'lead') {
            addCard(
              thread,
              {
                kind: 'needs',
                title: 'Sessions ended',
                body: 'The lead session ended. Restart it to continue.',
              },
              { system: true },
            );
          }
        }
        if (changed) await hub.save(thread);
      });
    }
  }
}

// Retry only queues that could have accepted a message now. Each thread gets its existing
// lock, and one bad machine must not stop the timer from reaching another thread.
async function retryQueues(hub) {
  const threads = await hub.allThreads();
  await Promise.all(threads.filter((thread) => !thread.archived).map(async (listedThread) => {
    try {
      await hub.withThread(listedThread.id, async () => {
        const thread = await hub.thread(listedThread.id);
        for (const target of thread.sessions) {
          if (canDeliver(target)) await deliver(hub, thread, target);
        }
      });
    } catch {
      // The next interval retries this queue; timer failures never escape the hub.
    }
  }));
}

module.exports = {
  ALLOWED_START,
  SESSION_ROLES,
  deliver,
  enqueue,
  event,
  pollDead,
  retryQueues,
  publicSession,
  resolveModel,
  session,
  sessionRequest,
  startSession,
};
