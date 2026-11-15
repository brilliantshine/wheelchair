'use strict';

// Spec "State": the hub composes focused modules and owns no transient app state.
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { DEFAULT_STATE, State } = require('./state.js');
const { MachineClient } = require('./machine-client.js');
const cards = require('./cards.js');
const chat = require('./chat.js');
const sessions = require('./sessions.js');
const threads = require('./threads.js');
const views = require('./views.js');
const { handle } = require('./routes.js');

class Hub {
  constructor({ stateDir = DEFAULT_STATE, root, codeVersion, registerPlan = null, registerGraph = null, graphCacheRoot = null, saveGraph = null, queueRetryInterval } = {}) {
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
    this.threadLocks = new Map();
    const configuredRetry = Number(queueRetryInterval ?? process.env.WHEELCHAIR_QUEUE_RETRY_MS ?? 5_000);
    this.queueRetryInterval = Number.isFinite(configuredRetry) && configuredRetry > 0 ? configuredRetry : 5_000;
  }

  async init() {
    await this.state.init();
    for (const [name, machine] of Object.entries(await this.state.machines())) {
      if (machine.last_seen) this.lastSeen.set(name, machine.last_seen);
    }
    this.asideTimer = setInterval(() => this.allThreads().then((threads) => Promise.all(threads.filter((t) => (t.asides || []).some((a) => a.turn)).map((t) => require('./asides.js').pump(this, t.id)))).catch(() => {}), 2000);
    this.asideTimer.unref();
    this.pollTimer = setInterval(() => this.pollDead().catch(() => {}), 10_000);
    this.pollTimer.unref();
    // A transient tmux/service failure leaves the message at the front of its queue. Retry
    // independently of the hook or card that originally queued it.
    this.queueRetryTimer = setInterval(() => this.retryQueues().catch(() => {}), this.queueRetryInterval);
    this.queueRetryTimer.unref();
    // Spec: a waiting stub shows ready within ten minutes of the merge; a minute keeps the
    // wait short for someone watching, at one gh call per waiting stub.
    this.waitTimer = setInterval(() => Promise.all([this.pollWaiting(), sessions.retryWaiting(this), sessions.releaseLimits(this)]).catch(() => {}), 60_000);
    this.waitTimer.unref();
    await this.pollWaiting();
    await sessions.retryWaiting(this);
  }

  machines() { return this.state.machines(); }
  projects() { return this.state.projects(); }
  machineSeen(name) { return this.lastSeen.get(name) || null; }
  async markMachineSeen(name, at = new Date().toISOString()) {
    this.lastSeen.set(name, at);
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
  allThreads() { return this.state.allThreads(); }
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
  deliver(thread, name, options) { return sessions.deliver(this, thread, sessions.session(thread, name), options); }
  appendSent(thread, entries) { return this.state.appendSent(thread.id, entries); }
  async event(payload) { const result = await this.withThread(payload.thread_id, () => sessions.event(this, payload)); if (payload.reading && !result.duplicate) await sessions.retryWaiting(this); return result; }
  async sessionRequest(payload) {
    const thread = await threads.threadBySession(this, payload.calling_session);
    return this.withThread(thread.id, () => sessions.sessionRequest(this, payload));
  }
  pollDead() { return sessions.pollDead(this); }
  retryQueues() { return sessions.retryQueues(this); }
  acceptCard(payload) { return this.withThread(payload.thread_id, () => cards.acceptCard(this, payload)); }
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
  chat(id) { return this.withThread(id, () => chat.chat(this, id)); }
  features() { return views.features(this); }
  sessions() { return views.sessions(this); }
  findSessionMachine(name) { return views.findSessionMachine(this, name); }
}

module.exports = { DEFAULT_STATE, Hub, handle, transcriptItems: chat.transcriptItems };
