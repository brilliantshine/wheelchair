'use strict';

// Spec "State": the hub composes focused modules and owns no transient app state.
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { DEFAULT_STATE, State, appError } = require('./state.js');
const { validate } = require('./card.js');
const { MachineClient } = require('./machine-client.js');
const cards = require('./cards.js');
const chat = require('./chat.js');
const sessions = require('./sessions.js');
const threads = require('./threads.js');
const views = require('./views.js');
const handoff = require('./handoff.js');
const { handle } = require('./routes.js');

class Hub {
  constructor({ stateDir = DEFAULT_STATE, root, codeVersion, registerPlan = null, registerGraph = null, graphCacheRoot = null, saveGraph = null, queueRetryInterval, quietGraceMs, quietEscalateMs, usagePollInterval, now = Date.now, transcriptSweepInterval = 60_000 } = {}) {
    this.usagePollInterval = usagePollInterval;
    this.root = root || path.resolve(__dirname, '..', '..');
    // The server supplies the commit it read at its own boot.  Direct Hub tests still read
    // their supplied root once, but a pull under a running viewer never changes this value.
    if (codeVersion !== undefined) this.codeVersion = codeVersion;
    else {
      try { this.codeVersion = execFileSync('git', ['-C', this.root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { this.codeVersion = ''; }
    }
    // Given by viewer/server.js so a thread's plan joins the viewer's plan registry and its
    // MAP/IDEA/PLAN links open in the existing document page.
    this.registerPlan = registerPlan;
    // Graphs have their own registry: registering the containing plan does not authorize an
    // iframe to fetch the graph itself.
    this.registerGraph = registerGraph;
    this.graphCacheRoot = graphCacheRoot;
    this.saveGraph = saveGraph;
    this.state = new State(stateDir);
    this.client = new MachineClient(this.state);
    this.stateDir = this.state.dir;
    this.threadsDir = this.state.threadsDir;
    this.lastSeen = new Map();
    this.now = now;
    this.machineSeenWrites = new Map();
    this.transcriptCache = new Map();
    this.transcriptSweepInterval = transcriptSweepInterval;
    this.threadLocks = new Map();
    this.runningHandoffOps = new Set();
    this.uploadsInFlight = new Map();
    this.handoffStatus = new Map();
    this.handoffStatusAt = new Map();
    this.handoffInspect = new Map();
    this.nameQueue = Promise.resolve();
    const configuredRetry = Number(queueRetryInterval ?? process.env.WHEELCHAIR_QUEUE_RETRY_MS ?? 5_000);
    this.queueRetryInterval = Number.isFinite(configuredRetry) && configuredRetry > 0 ? configuredRetry : 5_000;
    const grace = Number(quietGraceMs ?? process.env.WHEELCHAIR_QUIET_GRACE_MS ?? 30_000);
    const escalate = Number(quietEscalateMs ?? process.env.WHEELCHAIR_QUIET_ESCALATE_MS ?? 600_000);
    this.quietGraceMs = Number.isFinite(grace) && grace > 0 ? grace : 30_000;
    this.quietEscalateMs = Number.isFinite(escalate) && escalate > 0 ? escalate : 600_000;
  }

  async init() {
    await this.state.init();
    await handoff.sweepFiles(this);
    for (const listed of await this.allThreads()) {
      const thread = structuredClone(listed);
      let changed = false;
      if (thread.imported) for (const session of thread.sessions || []) {
        if (session.role === 'lead' && session.live && session.status === 'starting' && !Object.hasOwn(session, 'first_message')) {
          session.live = false; session.status = 'ended'; session.ended_at = new Date().toISOString(); changed = true;
        }
      }
      if (changed) await this.save(thread);
    }
    if (this.registerPlan) for (const thread of await this.allThreads()) {
      if (!thread.archived && thread.slug && thread.worktree) {
        try { await this.registerPlan(path.join(thread.worktree, 'docs', 'plans', thread.slug)); }
        catch (error) { console.error('Could not register plan:', error); }
      }
    }
    require('./handoff-ops.js').startSweep(this);
    for (const [name, machine] of Object.entries(await this.state.machines())) {
      if (machine.last_seen) this.lastSeen.set(name, machine.last_seen);
    }
    const existing = (await this.allThreads()).filter((t) => !t.archived && !t.lead_name && t.sessions?.some((s) => s.role === 'lead')).sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
    for (const thread of existing) await this.saveWithLeadName(structuredClone(thread));
    this.transcriptTimer = setInterval(() => this.sweepTranscripts(), this.transcriptSweepInterval);
    this.transcriptTimer.unref();
    this.asideTimer = setInterval(() => this.allThreads().then((threads) => Promise.all([...threads.filter(require('./asides.js').needsPump).map((t) => require('./asides.js').pump(this, t.id, { fromTimer: true })), ...threads.filter((t) => t.pending_cancels?.length).map((t) => require('./asides.js').sweepCancels(this, t.id))])).catch(() => {}), 2000);
    this.asideTimer.unref();
    this.pollTimer = setInterval(() => this.pollDead().catch(() => {}), 10_000);
    this.pollTimer.unref();
    // A transient tmux/service failure leaves the message at the front of its queue. Retry
    // independently of the hook or card that originally queued it.
    this.queueRetryTimer = setInterval(() => this.retryQueues().then(() => require('./quiet.js').checkQuiet(this)).catch(() => {}), this.queueRetryInterval);
    this.queueRetryTimer.unref();
    // Spec: a waiting stub shows ready within ten minutes of the merge; a minute keeps the
    // wait short for someone watching, at one gh call per waiting stub.
    this.waitTimer = setInterval(() => Promise.all([this.pollWaiting(), this.pollMerged(), sessions.retryWaiting(this), sessions.releaseLimits(this)]).catch(() => {}), 60_000);
    this.waitTimer.unref();
    this.usageTimer = setInterval(() => this.pollIdle().catch(() => {}), this.usagePollInterval ?? 60_000);
    this.usageTimer.unref();
    this.usageStartTimer = setTimeout(() => this.pollIdle().catch(() => {}), 30_000);
    this.usageStartTimer.unref();
    await this.allThreads().then((threads) => Promise.all(threads.filter((t) => t.pending_cancels?.length).map((t) => require('./asides.js').sweepCancels(this, t.id)))).catch(() => {});
    this.pollMerged().catch(() => {});
    await this.pollWaiting();
    await sessions.retryWaiting(this);
  }

  sweepTranscripts() {
    const cutoff = this.now() - 600_000;
    for (const [key, entry] of this.transcriptCache) {
      if (entry.lastRead < cutoff && !this.threadLocks.has(entry.threadId)) this.transcriptCache.delete(key);
    }
  }
  stop() { clearInterval(this.transcriptTimer); }
  machines() { return this.state.machines(); }
  projects() { return this.state.projects(); }
  machineSeen(name) { return this.lastSeen.get(name) || null; }
  async markMachineSeen(name, at = new Date(this.now()).toISOString()) {
    this.lastSeen.set(name, at);
    const now = this.now();
    const last = this.machineSeenWrites.get(name);
    if (last !== undefined && now - last < 60_000) return at;
    this.machineSeenWrites.set(name, now);
    await this.state.markMachineSeen(name, at);
    return at;
  }
  machine(name) { return this.state.machine(name); }
  threadPath(id) { return this.state.threadPath(id); }
  async thread(id) { const thread = await this.state.thread(id); if (!thread.provider && thread.cli && thread.sessions?.length) { thread.provider = require('./providers.js').providerOf(thread.cli); await this.state.save(thread); } return thread; }
  save(thread) { return this.state.save(thread); }
  updateThread(id, operation) { return this.state.updateThread(id, operation); }
  // State's queue makes a single write atomic. This separate lock covers the read, remote
  // call, mutation and save that make up one thread operation; nested save() calls remain safe.
  withThread(id, operation) {
    const previous = this.threadLocks.get(id) || Promise.resolve();
    const work = previous.catch(() => {}).then(operation);
    // The chain swallows a refused operation's error; the caller still gets it from `work`.
    const retained = work.catch(() => {}).finally(() => {
      if (this.threadLocks.get(id) === retained) this.threadLocks.delete(id);
    });
    this.threadLocks.set(id, retained);
    return work;
  }
  saveWithLeadName(thread) {
    const work = this.nameQueue.catch(() => {}).then(async () => {
      if (!thread.lead_name) {
        const { chooseName, namesFor } = require('./names.js');
        thread.lead_name = chooseName(await this.allThreads(), namesFor(await require('./settings.js').load(this)));
      }
      await this.save(thread);
    });
    this.nameQueue = work.catch(() => {});
    return work;
  }
  allThreads() { return this.state.allThreads(); }
  threadSnapshot(id) { return this.state.threadSnapshot(id); }
  async readSnapshot(id) {
    const thread = await this.threadSnapshot(id);
    return !thread.provider && thread.cli && thread.sessions?.length ? this.thread(id) : thread;
  }
  async call(machine, ...args) {
    const result = await this.client.call(machine, ...args);
    await this.markMachineSeen(machine);
    return result;
  }
  authenticatesMachine(request) { return this.client.authenticates(request); }
  session(thread, name) { return sessions.session(thread, name); }
  startSession(thread, input) { return sessions.startSession(this, thread, input); }
  enqueue(thread, name, text, source, first) {
    return sessions.enqueue(this, thread, name, text, source, first);
  }
  sendNow(id, at) { return this.withThread(id, async () => { const thread = await this.thread(id); handoff.refuseFrozen(this, thread); return sessions.sendNow(this, thread, String(at || '')); }); }
  deliver(thread, name, options) { return sessions.deliver(this, thread, sessions.session(thread, name), options); }
  appendSent(thread, entries) { return this.state.appendSent(thread.id, entries); }
  async event(payload) { const result = await this.withThread(payload.thread_id, () => sessions.event(this, payload)); if (payload.reading && !result.duplicate) await sessions.retryWaiting(this); return result; }
  async sessionRequest(payload) {
    const thread = await threads.threadBySession(this, payload.calling_session);
    return this.withThread(thread.id, () => sessions.sessionRequest(this, payload));
  }
  // One poll at a time: an overlapping poll would act on a listing older than the one before it.
  pollDead() {
    if (!this.polling) this.polling = sessions.pollDead(this).finally(() => { this.polling = null; });
    return this.polling;
  }
  pollIdle() {
    if (!this.usagePolling) this.usagePolling = require('./usage-poll.js').pollIdle(this).finally(() => { this.usagePolling = null; });
    return this.usagePolling;
  }
  retryQueues() { return sessions.retryQueues(this); }
  async acceptCard(payload) {
    if (payload.kind === 'done') {
      const thread = await this.state.thread(payload.thread_id);
      const session = this.session(thread, payload.session);
      const { session: ignoredSession, thread_id: ignoredThread, delivery_id: ignoredDelivery, ...input } = payload;
      const checked = validate('done', input, session.role, { machine: true });
      if (checked.ok) {
        const result = await require('./pr-gate.js').checkPr(thread, checked.card);
        if (!result.ok) throw appError(422, result.reason);
      }
    }
    return this.withThread(payload.thread_id, () => cards.acceptCard(this, payload));
  }
  createThread(input) { return threads.createThread(this, input); }
  threadBySession(name) { return threads.threadBySession(this, name); }
  createStub(parent, card) { return threads.createStub(this, parent, card); }
  openStub(id, input) { return this.withThread(id, () => threads.openStub(this, id, input)); }
  restartLead(id) { return this.withThread(id, () => threads.restartLead(this, id)); }
  archive(id) { return this.withThread(id, () => threads.archive(this, id)); }
  archivedDocument(id, file) { return threads.archivedDocument(this, id, file); }
  dismiss(id, cardId) { return this.withThread(id, () => threads.dismiss(this, id, cardId)); }
  press(id, cardId, input) { return this.withThread(id, () => threads.press(this, id, cardId, input)); }
  pollWaiting() { return threads.pollWaiting(this); }
  pollMerged() {
    if (this.mergePolling) return Promise.resolve();
    this.mergePolling = threads.pollMerged(this).finally(() => { this.mergePolling = null; });
    return this.mergePolling;
  }
  runHandoffOperation(id, options) { return require('./handoff-ops.js').runOperation(this, id, options); }
  createLocked(input) { return require('./handoff-ops.js').createLocked(this, input); }
  advanceLocked(thread, file) { return require('./handoff-ops.js').advanceLocked(this, thread, file); }
  runLocked(thread, reimport) { return require('./handoff-ops.js').runLocked(this, thread, reimport); }
  startHandoffCreate(input) { return require('./handoff-ops.js').startCreate(this, input); }
  startHandoffAdvance(thread, file) { return require('./handoff-ops.js').startAdvance(this, thread, file); }
  undoHandoff(id) { return require('./handoff-ops.js').undo(this, id); }
  cancelHandoff(id) { return require('./handoff-ops.js').cancel(this, id); }
  importHandoff(bytes, machine, project) { return require('./handoff-import.js').importHandoff(this, bytes, machine, project); }
  exportThread(id) { return handoff.exportThread(this, id); }
  async handoffBanner(id) {
    for (;;) {
      const snapshot = await this.withThread(id, async () => {
        const thread = await this.thread(id);
        if (!thread.handed_off) throw require('./state.js').appError(404, 'thread has not been handed off');
        if (thread.handoff_op?.kind === 'undo') return { cached: { state: 'undo-unfinished', at: thread.handed_off.at, last_error: thread.handoff_op.last_error, can_cancel: !thread.handoff_op.claim_landed } };
        const cached = this.handoffInspect.get(id);
        if (cached && cached.head === thread.handed_off.head && cached.at === thread.handed_off.at && Date.now() - cached.time < 60_000) return { cached: cached.value };
        return { thread };
      });
      if (snapshot.cached) return snapshot.cached;
      const value = await handoff.banner(this, snapshot.thread);
      const current = await this.withThread(id, async () => {
        const thread = await this.thread(id);
        if (!thread.handed_off) throw require('./state.js').appError(404, 'thread has not been handed off');
        if (thread.handed_off.head !== snapshot.thread.handed_off.head || thread.handed_off.at !== snapshot.thread.handed_off.at) return false;
        this.handoffInspect.set(id, { head: thread.handed_off.head, at: thread.handed_off.at, time: Date.now(), value });
        return true;
      });
      if (current) return value;
    }
  }
  handoffFile(id) { return this.withThread(id, async () => { const thread = await this.thread(id); return { bytes: await handoff.savedFile(this, thread), filename: handoff.handoffFileName(thread.title) }; }); }
  frozen(thread) { return handoff.frozen(this, thread); }
  quietReason(thread) { return handoff.quietReason(this, thread); }
  exportReason(thread, status, options) { return handoff.exportReason(this, thread, status, options); }
  async refreshHandoffStatus(snapshot) {
    try {
      const status = await this.client.handoff(snapshot.machine, {
        action: 'status', thread_id: snapshot.id, project: snapshot.project,
        worktree: snapshot.worktree, slug: snapshot.slug,
      });
      if (status.result === 'failed') return;
      await this.withThread(snapshot.id, async () => {
        const current = await this.thread(snapshot.id);
        if (!current.archived && !current.handed_off && ['machine', 'project', 'worktree', 'slug'].every((key) => current[key] === snapshot[key])) this.handoffStatus.set(snapshot.id, status);
      });
    } catch { /* Keep the last successful status until the next refresh. */ }
  }
  async chat(id) {
    // Chat can save a discovered slug, so assemble it under the thread lock.
    const snapshot = await this.withThread(id, async () => {
      const result = await chat.chat(this, id);
      const thread = await this.readSnapshot(id);
      const last = this.handoffStatusAt.get(id);
      const refresh = !thread.archived && !thread.handed_off && thread.worktree && thread.slug && (last === undefined || Date.now() - last >= 60_000);
      if (refresh) this.handoffStatusAt.set(id, Date.now());
      const reason = this.exportReason(thread, this.handoffStatus.get(id));
      result.thread.export = { ok: !reason, reason };
      result.thread.handoff_op = thread.handoff_op ? { kind: thread.handoff_op.kind, last_error: thread.handoff_op.last_error, can_cancel: !thread.handoff_op.claim_landed } : null;
      return { result, thread, refresh };
    });
    if (snapshot.refresh) this.refreshHandoffStatus(snapshot.thread).catch(() => {});
    return snapshot.result;
  }
  features() { return views.features(this); }
  sessions() { return views.sessions(this); }
  findSessionMachine(name) { return views.findSessionMachine(this, name); }
}

module.exports = { DEFAULT_STATE, Hub, handle, transcriptItems: chat.transcriptItems };
