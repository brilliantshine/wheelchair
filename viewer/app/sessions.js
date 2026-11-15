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
  await enqueue(hub, thread, target.started_by, `[wc:from ${target.name}] result: ${text}`, 'result');
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

async function enqueue(hub, thread, name, text, source = 'app', first = false) {
  const target = session(thread, name);
  target.queue ||= [];
  const message = { text, source, at: new Date().toISOString() };
  if (first) target.queue.unshift(message);
  else target.queue.push(message);
  thread.queues[name] = target.queue;
  await hub.save(thread);
  await deliver(hub, thread, target);
}

async function deliver(hub, thread, target) {
  const held = target.permission_open || target.needs_open;
  if (!target.live || !target.ready || !target.turn_ended || held || !target.queue?.length) {
    return false;
  }
  const next = target.queue.shift();
  target.turn_ended = false;
  thread.queues[target.name] = target.queue;
  await hub.save(thread);
  await hub.call(
    thread.machine,
    `/v1/sessions/${encodeURIComponent(target.name)}/submit`,
    'POST',
    { text: next.text },
  );
  return true;
}

async function event(hub, payload) {
  const thread = await hub.thread(payload.thread_id);
  const target = session(thread, payload.session);
  const type = payload.type;
  if (type === 'ready') {
    target.ready = true;
    target.status = 'ready';
    markIdleIfFresh(target);
  }
  if (['turn-ended', 'turn_ended', 'turn ended'].includes(type)) {
    target.turn_ended = true;
    await deliverReport(hub, thread, target, payload);
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
  await hub.save(thread);
  await deliver(hub, thread, target);
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
  });
  return { session: publicSession(started) };
}

async function stopSession(hub, thread, caller, name) {
  const target = session(thread, name);
  const canStop = target.started_by === caller.name || (
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
    for (const thread of threads) {
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
    }
  }
}

module.exports = {
  ALLOWED_START,
  SESSION_ROLES,
  deliver,
  enqueue,
  event,
  pollDead,
  publicSession,
  resolveModel,
  session,
  sessionRequest,
  startSession,
};
