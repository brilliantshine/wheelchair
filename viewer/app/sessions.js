'use strict';

// Spec "Agents start and stop sessions", "Prompts mid-run", and Edge cases.
const crypto = require('node:crypto');
const { addCard } = require('./cards.js');
const quiet = require('./quiet.js');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { appError } = require('./state.js');
const { outOfDate } = require('./ready.js');
const settingsStore = require('./settings.js');
const usage = require('./usage.js');
const { choose, slotFor } = require('./balancer.js');
const { PROVIDERS, cliOf, providerOf } = require('./providers.js');

const execFileAsync = promisify(execFile);

// Spec "How the hub picks a session's model": model cells are per provider and role.
async function resolveModel(hub, cli, role, requestedTier = 'top') {
  if (!providerOf(cli)) throw appError(400, `unknown cli: ${cli}`);
  const slot = await slotFor(hub, role, requestedTier);
  const provider = providerOf(cli);
  try {
    const model = (await execFileAsync(path.join(hub.root, 'codex', 'model.sh'), [provider, slot])).stdout.trim();
    let effort;
    if (PROVIDERS[provider].effort) effort = (await execFileAsync(path.join(hub.root, 'codex', 'model.sh'), ['effort', provider, slot])).stdout.trim() || undefined;
    return { model, effort, slot };
  } catch (error) {
    if (error.code === 3) throw appError(400, `${provider} is not used at ${slot}; use the other CLI`);
    throw appError(400, (error.stderr || error.message).trim());
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
  const { token, unanswered_start: unanswered, ...value } = session;
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

// Spec §2: a requested worker effort, checked once the provider is known and before preflight.
function checkEffort(settings, role, cli, effort) {
  if (role !== 'worker' || effort === undefined) return;
  if (cli === 'codex' && effort === 'max') throw appError(400, "GPT's highest effort is xhigh");
  const efforts = ['low', 'medium', 'high', 'xhigh', 'max'];
  const ceiling = settings.escalation.max_effort;
  const max = cli === 'codex' && ceiling === 'max' ? 'xhigh' : ceiling;
  if (efforts.indexOf(effort) > efforts.indexOf(max)) throw appError(400, `effort ${effort} is above the highest effort in Settings (${max})`);
}

// A start creates a worktree and launches a CLI, which can take well over the usual 5 seconds.
// No answer is not a refusal: the machine may still be starting it. Asking again under the same
// name joins that start (machine/service.js start), so the session is recorded once, not
// marked failed while it runs and then started a second time by a retried request.
const START_TIMEOUT_MS = 60_000;
async function startOnMachine(hub, machine, body) {
  try {
    return await hub.call(machine, '/v1/sessions', 'POST', body, START_TIMEOUT_MS);
  } catch (error) {
    if (error.status) throw error;
    return hub.call(machine, '/v1/sessions', 'POST', body, START_TIMEOUT_MS);
  }
}

// Asked twice and still no answer, the machine may yet bring the session up. Keep what was
// sent, so a retry of the same attempt asks again under the same name and token (the machine
// answers with that session if it came up), and answer 503 so the caller's retry happens.
const UNANSWERED = 'the machine did not answer the start; run the same command again';
async function resumeUnanswered(hub, thread, session) {
  const pending = session.unanswered_start;
  let started;
  try {
    started = await startOnMachine(hub, thread.machine, pending.body);
  } catch (error) {
    session.error = error.message;
    if (error.status) delete session.unanswered_start;
    await hub.save(thread);
    throw error.status ? error : appError(503, UNANSWERED);
  }
  delete session.unanswered_start;
  delete session.error;
  const identity = { name: session.name, attempt_id: session.attempt_id, started_by: session.started_by, queue: session.queue || [] };
  Object.assign(session, started, identity, {
    token: pending.body.token,
    ready: started.status === 'ready',
    live: true,
    first_message: pending.first_message,
  });
  if (quiet.watched(session) && session.first_message) session.owes_reply = true;
  markIdleIfFresh(session);
  await hub.save(thread);
  return session;
}

async function startSession(hub, thread, input) {
  const role = input.role;
  if (!SESSION_ROLES.has(role)) throw appError(400, 'unknown role');
  // Spec §2: the highest tier in Settings is checked before a provider is chosen or a wait is queued.
  if (role === 'worker') {
    const maxTier = (await settingsStore.load(hub)).escalation.max_tier;
    const slot = await slotFor(hub, role, input.tier);
    if (settingsStore.WORK_TIERS.indexOf(slot) > settingsStore.WORK_TIERS.indexOf(maxTier)) throw appError(400, `tier ${slot} is above the highest tier in Settings (${maxTier})`);
  }
  let selection = await choose(hub, thread, role, input.tier, input);
  if (selection.wait) {
    const waiting = input._waiting || {
      name: input.name || newSessionName(thread, role), role, started_by: input.started_by || null,
      token: crypto.randomBytes(32).toString('hex'), attempt_id: input.attempt_id || null,
      queue: [], ready: false, live: true, created_at: new Date().toISOString(),
    };
    Object.assign(waiting, { status: 'waiting', waiting_until: selection.wait.until, waiting_reason: selection.wait.reason, waiting_provider: selection.wait.provider, pending_start: input._waiting ? waiting.pending_start : { ...input } });
    if (!input._waiting) thread.sessions.push(waiting);
    if (role === 'lead' && !thread.lead_name) await hub.saveWithLeadName(thread);
    else await hub.save(thread);
    return waiting;
  }
  let cli = cliOf(selection.provider);
  checkEffort(await settingsStore.load(hub), role, cli, input.effort);
  if (PROVIDERS[selection.provider].preflight) {
    const dir = selection.account.id === `default-${selection.provider}` ? null : `~/.wheelchair/accounts/${selection.account.id}`;
    try { await hub.call(thread.machine, '/v1/preflight', 'POST', { dir }); }
    catch (error) {
      const machineState = await usage.machineAccounts(hub);
      const configured = await hub.machines();
      const resolvedMachine = await hub.state.resolveMachine(configured, thread.machine);
      const machineName = Object.keys(configured).find((name) => configured[name] === resolvedMachine || configured[name].name === resolvedMachine?.name) || thread.machine;
      if (machineState[machineName]) machineState[machineName].accounts[selection.account.id] = false;
      selection = await choose(hub, thread, role, input.tier, input);
      if (selection.wait) {
        if (role === 'lead') { addCard(thread, { kind: 'needs', title: 'Codex preflight failed', body: `Codex preflight failed: ${error.body?.output || error.message}` }, { system: true }); await hub.save(thread); }
        throw appError(409, `Codex preflight failed: ${error.body?.output || error.message}`);
      }
      cli = cliOf(selection.provider);
      checkEffort(await settingsStore.load(hub), role, cli, input.effort);
      if (PROVIDERS[selection.provider].preflight) {
        const retryDir = selection.account.id === `default-${selection.provider}` ? null : `~/.wheelchair/accounts/${selection.account.id}`;
        try { await hub.call(thread.machine, '/v1/preflight', 'POST', { dir: retryDir }); }
        catch (retryError) { throw appError(409, `Codex preflight failed: ${retryError.body?.output || retryError.message}`); }
      }
    }
  }
  await usage.recordChosen(hub, selection.provider, selection.account.id);
  if (role === 'lead' && !thread.provider) { thread.provider = selection.provider; thread.cli = cli; }
  const resolved = await resolveModel(hub, cli, role, input.tier);
  const settings = await settingsStore.load(hub);
  const layers = settingsStore.roleLayers(settings, role, thread.project);
  // Spec "Machine service on the hub": no new sessions while that service runs another commit.
  // A service that can't be reached falls through to the start, which records the failure.
  const current = await hub.call(thread.machine, '/v1/status', 'GET').catch(() => null);
  if (current && await outOfDate(hub, current)) throw appError(409, 'machine service out of date');
  const token = input._waiting?.token || crypto.randomBytes(32).toString('hex');
  const session = input._waiting || {
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
    template_id: layers.template?.id || null,
    ...(role === 'lead' ? { style_version: settings.style_version } : {}),
  };
  if (!input._waiting) thread.sessions.push(session);
  Object.assign(session, { model: resolved.model, effort: input.effort || resolved.effort || null, status: 'starting', cli, provider: selection.provider, account: selection.account.id, template_id: layers.template?.id || null, ...(role === 'lead' ? { style_version: settings.style_version } : {}) });
  if (selection.note) session.note = selection.note;
  delete session.pending_start; delete session.waiting_until; delete session.waiting_reason; delete session.waiting_provider;
  if (role === 'lead' && !thread.lead_name) await hub.saveWithLeadName(thread);
  else await hub.save(thread);

  let started;
  const startBody = {
      role,
      cli,
      account: { id: selection.account.id, dir: selection.account.id === `default-${selection.provider}` ? null : `~/.wheelchair/accounts/${selection.account.id}` },
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
      model: resolved.model,
      ...((input.effort || resolved.effort) ? { effort: input.effort || resolved.effort } : {}),
      permission_mode: settings.permission_mode,
      codex_mode: settings.codex_mode,
      role_layers: layers.text,
      verify_ref: input.verify_ref,
      base: input.base,
      default_branch: thread.default_branch,
  };
  try {
    started = await startOnMachine(hub, thread.machine, startBody);
  } catch (error) {
    // Leave no session claiming to be "starting" forever: record why it never started.
    Object.assign(session, { status: 'failed', live: false, error: error.message });
    if (!error.status) {
      session.unanswered_start = { body: startBody, first_message: PROVIDERS[selection.provider].typesRoleMessage || Boolean(input.brief) };
      await hub.save(thread);
      throw appError(503, UNANSWERED);
    }
    await hub.save(thread);
    throw error;
  }
  const identity = { name: session.name, attempt_id: session.attempt_id, started_by: session.started_by, queue: session.queue };
  Object.assign(session, started, {
    ...identity,
    model: resolved.model, effort: input.effort || resolved.effort || null,
    token,
    provider: selection.provider,
    account: selection.account.id,
    queue: identity.queue || [],
    ready: started.status === 'ready',
    live: true,
    // The service types a first message itself (Codex's [wc:role] line, or a brief) once the
    // session is ready; without one, a ready session is idle and may take the queue at once.
    first_message: PROVIDERS[selection.provider].typesRoleMessage || Boolean(input.brief),
  });
  if (quiet.watched(session) && session.first_message) session.owes_reply = true;
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
  target.owes_reply = false; quiet.reset(thread, target);
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

async function enqueue(hub, thread, name, text, source = 'app', first = false, { save = true, deliver: deliverNow = true, quiet: quietTag, about } = {}) {
  const target = session(thread, name);
  target.queue ||= [];
  thread.queues ||= {};
  const message = { text, source, at: new Date().toISOString(), ...(quietTag ? { quiet: quietTag } : {}), ...(about ? { about } : {}) };
  // The thread list orders threads by when Collin last wrote in them, not by any activity.
  if (source === 'collin') thread.collin_at = message.at;
  if (first) target.queue.unshift(message);
  else target.queue.push(message);
  thread.queues[name] = target.queue;
  if (save) await hub.save(thread);
  if (deliverNow) await deliver(hub, thread, target);
  return target;
}

function canDeliver(target) {
  const held = target.permission_open || target.needs_open || (target.limited_until && Date.parse(target.limited_until) > Date.now());
  return Boolean(target.live && target.ready && target.turn_ended && !held && target.queue?.length);
}

async function deliver(hub, thread, target) {
  if (!canDeliver(target)) return false;
  const next = target.queue[0];
  let submitted = next.text;
  let deliveredStyleVersion;
  if (target.role === 'lead' && target.live) {
    const settings = await settingsStore.load(hub);
    const version = target.style_version ?? 0;
    if (version < settings.style_version) {
      submitted += `\n\n[wc:style]\nThis replaces any earlier writing style.\n${settingsStore.renderStyle(settings.style)}`;
      deliveredStyleVersion = settings.style_version;
    }
  }
  // Submission is the acknowledgement.  Do not discard a message or mark the session busy
  // until the machine accepted it; a transient service failure must leave it retryable.
  try {
    await hub.call(thread.machine, `/v1/sessions/${encodeURIComponent(target.name)}/submit`, 'POST', { text: submitted });
  } catch (error) {
    target.delivery_error = { text: error.message || String(error), at: new Date().toISOString() };
    await hub.save(thread);
    return false;
  }
  target.queue.shift();
  if (quiet.watched(target)) target.owes_reply = true;
  delete target.quiet_check_at;
  if (next.quiet === 'starter') { const about = thread.sessions.find(s => s.name === next.about); if (about) about.quiet_starter_at = new Date().toISOString(); }
  if (deliveredStyleVersion !== undefined) target.style_version = deliveredStyleVersion;
  target.turn_ended = false;
  delete target.delivery_error;
  thread.queues ||= {};
  thread.queues[target.name] = target.queue;
  thread.sent ||= [];
  thread.sent.push({ to: target.name, text: submitted, source: next.source, at: new Date().toISOString() });
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
  if (payload.reading) {
    await usage.record(hub, { ...payload.reading, machine: thread.machine });
  }
  const limit = type === 'limit-hit' ? payload.limited_until : payload.reading?.limited_until;
  const limitEnded = type === 'limit-hit' || Boolean(payload.reading?.limited_until);
  if (limit && Date.parse(limit) > Date.now()) {
    const readings = await usage.readings(hub);
    const prior = readings[target.account] || { account: target.account, machine: thread.machine, five_hour: null, week: null };
    await usage.record(hub, { ...prior, at: new Date(Math.max(Date.now(), Date.parse(prior.at) + 1 || 0)).toISOString(), limited_until: limit });
    target.limited_until = limit;
    target.turn_ended = true;
  } else if (limitEnded && limit && Date.parse(limit) <= Date.now()) {
    delete target.limited_until;
    target.turn_ended = true;
    if (target.live) await enqueue(hub, thread, target.name, 'Continue.', 'app', true, { save: false, deliver: false });
  }
  if (type === 'turn-failed') {
    target.turn_ended = true;
    if (target.started_by) {
      const starter = await enqueue(hub, thread, target.started_by, `[wc:from app] your session ${target.name}'s turn failed: ${payload.error}`, 'app', false, { save: false, deliver: false });
      deliveryTargets.add(starter.name);
    } else if (target.role === 'lead') {
      addCard(thread, { kind: 'needs', title: "The lead's turn failed", body: `${payload.error}. The lead is still running: reply in the thread to have it try again.` }, { system: true, session: target.name });
    }
  }
  if (type === 'ready') {
    target.ready = true;
    target.status = 'ready';
    markIdleIfFresh(target);
  }
  if (['turn-ended', 'turn_ended', 'turn ended'].includes(type)) {
    target.turn_ended = true;
    for (const key of ['cli_session_id', 'codex_thread_id']) if (payload[key]) target[key] = payload[key];
    if (target.role === 'lead') for (const card of thread.cards) if (card.kind === 'needs' && card.title === "The lead's turn failed" && !card.answered) card.answered = true;
    const reportTarget = limitEnded || Date.parse(target.limited_until) > Date.now() ? null : await deliverReport(hub, thread, target, payload);
    if (reportTarget) deliveryTargets.add(reportTarget.name);
    quiet.arm(hub, target);
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
    return { sessions: thread.sessions.map(publicSession), review_families: (await settingsStore.load(hub)).review_families };
  }
  if (payload.action === 'stop') return stopSession(hub, thread, caller, payload.name);
  if (payload.action === 'start' && payload.effort !== undefined && (caller.role !== 'sub-lead' || payload.role !== 'worker')) throw appError(400, 'effort can only be set for a worker');
  if (payload.action !== 'start' || !ALLOWED_START[caller.role]?.has(payload.role)) {
    throw appError(403, `${caller.role} may not start that session`);
  }
  // The provider is chosen at start; a GPT worker refuses max there (startSession).
  if (payload.effort !== undefined && !['low', 'medium', 'high', 'xhigh', 'max'].includes(payload.effort)) throw appError(400, 'effort must be one of low, medium, high, xhigh, max');
  if (!payload.attempt_id) throw appError(400, 'attempt_id is required');
  const sameAttempt = (item) => item.started_by === caller.name && item.attempt_id === payload.attempt_id;
  const duplicate = thread.sessions.find((item) => sameAttempt(item) && item.live);
  if (duplicate) return { session: publicSession(duplicate), duplicate: true };
  const unanswered = thread.sessions.find((item) => sameAttempt(item) && item.unanswered_start);
  if (unanswered) return { session: publicSession(await resumeUnanswered(hub, thread, unanswered)), duplicate: true };
  if (payload.role === 'sub-lead' && thread.sessions.some((item) => item.role === 'sub-lead' && item.live)) {
    throw appError(409, 'a live sub-lead already exists');
  }
  const started = await startSession(hub, thread, {
    role: payload.role,
    provider: payload.provider,
    not_provider: payload.not_provider,
    started_by: caller.name,
    attempt_id: payload.attempt_id,
    brief: payload.brief,
    tier: payload.tier,
    effort: payload.effort,
    // Spec "Branches and checkouts": the mapper, reviewers and the sub-lead run in the thread's
    // own worktree; a worker gets a branch cut from the thread's branch; a verifier checks the
    // thread's branch as it stands, commits not yet pushed included.
    ...(['mapper', 'reviewer', 'sub-lead'].includes(payload.role) ? { worktree: thread.worktree, branch: thread.branch } : {}),
    base: payload.role === 'worker' ? thread.branch : undefined,
    verify_ref: payload.role === 'verifier' ? thread.branch : undefined,
    ...(payload.role === 'worker' && payload.replaces ? await replacedWorker(hub, thread, payload.replaces) : {}),
  });
  return { session: publicSession(started), ...(started.note ? { note: started.note } : {}) };
}

// A replacement worker shares the old worker's worktree, so the old one must really be gone: the
// hub's own record can say "ended" while its tmux session still runs. Unknown counts as running.
async function replacedWorker(hub, thread, name) {
  const replaced = session(thread, name);
  if (replaced.role !== 'worker' || replaced.live) throw appError(400, 'replacement must be a dead worker in this thread');
  let listed;
  try {
    listed = await hub.call(thread.machine, '/v1/sessions', 'GET');
  } catch {
    throw appError(409, `cannot check whether ${name} is still running; try again`);
  }
  const running = (other) => {
    const entry = listed.find((item) => item.name === other);
    return Boolean(entry) && entry.running !== false;
  };
  if (running(name)) {
    throw appError(409, `${name} is still running in tmux; send it a message, or stop it with session stop before replacing it`);
  }
  // An earlier replacement of the same worker may already be working there.
  const occupant = thread.sessions.find((item) => (
    item.name !== name && item.role === 'worker' && item.worktree && item.worktree === replaced.worktree
    && (item.live || running(item.name))
  ));
  if (occupant) throw appError(409, `${occupant.name} is already working in that worktree`);
  return { worktree: replaced.worktree, branch: replaced.branch };
}

async function stopSession(hub, thread, caller, name) {
  const target = session(thread, name);
  const starter = target.started_by && thread.sessions.find((item) => item.name === target.started_by);
  const canResumeRole = ['lead', 'sub-lead'].includes(caller.role) && starter?.role === caller.role;
  const canStop = target.started_by === caller.name || canResumeRole || (
    caller.role === 'lead' && target.started_by && target.role !== 'lead'
  );
  if (!canStop) throw appError(403, 'only the starter may stop this session');
  if (target.status !== 'waiting') await hub.call(thread.machine, `/v1/sessions/${encodeURIComponent(target.name)}`, 'DELETE');
  target.live = false;
  target.status = 'stopped';
  quiet.reset(thread, target, true);
  await hub.save(thread);
  return { ok: true };
}

// tmux decides: a listed session with `running: true` is live even if recorded stopped (a failed
// kill records stopped too). Without `running` the machine could not check tmux, so only its record
// can say stopped.
function liveNames(listed) {
  return new Set(
    listed
      .filter((item) => item.running === true || (item.running === undefined && item.status !== 'stopped'))
      .map((item) => item.name),
  );
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
    const early = liveNames(listed);
    const missing = (thread, live) => thread.sessions.filter((item) => (
      item.live && item.status !== 'waiting' && !live.has(item.name)
    ));
    for (const listedThread of threads) {
      await hub.withThread(listedThread.id, async () => {
        const thread = await hub.thread(listedThread.id);
        let changed = false;
        for (const target of thread.sessions) {
          const remote = listed.find((item) => item.name === target.name);
          for (const key of ['cli_session_id', 'codex_thread_id']) if (remote?.[key] && remote[key] !== target[key]) { target[key] = remote[key]; changed = true; }
        }
        if (!missing(thread, early).length) {
          if (changed) await hub.save(thread);
          return;
        }
        // The early listing was taken before this thread's lock, and the wait for the lock can
        // be long; a session started meanwhile is absent from it. Ask again under the lock, where
        // no start for this thread can be in flight, and act only on that answer.
        let fresh;
        try {
          fresh = liveNames(await hub.call(machine, '/v1/sessions', 'GET'));
        } catch {
          if (changed) await hub.save(thread);
          return;
        }
        for (const target of missing(thread, fresh)) {
          target.live = false;
          target.status = 'ended';
          quiet.reset(thread, target, true);
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

async function retryWaiting(hub) {
  const waiting = (await hub.allThreads()).flatMap((t) => t.sessions.filter((s) => s.live && s.status === 'waiting').map((s) => ({ thread: t.id, name: s.name, at: s.created_at }))).sort((a, b) => a.at.localeCompare(b.at));
  for (const item of waiting) {
    await hub.withThread(item.thread, async () => {
      const thread = await hub.thread(item.thread);
      const target = thread.sessions.find((s) => s.name === item.name && s.live && s.status === 'waiting');
      if (target) await startSession(hub, thread, { ...target.pending_start, _waiting: target });
    }).catch(() => {});
  }
}
async function releaseLimits(hub) {
  for (const listed of await hub.allThreads()) await hub.withThread(listed.id, async () => {
    const thread = await hub.thread(listed.id);
    for (const target of thread.sessions) if (target.live && target.limited_until && Date.parse(target.limited_until) <= Date.now()) {
      delete target.limited_until;
      await enqueue(hub, thread, target.name, 'Continue.', 'app', true);
    }
  });
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
  retryWaiting,
  releaseLimits,
  publicSession,
  resolveModel,
  session,
  sessionRequest,
  startSession,
};
