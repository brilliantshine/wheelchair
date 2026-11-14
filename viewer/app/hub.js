'use strict';

// Spec "State": the hub composes focused modules and owns no transient app state.
const { DEFAULT_STATE, State } = require('./state.js');
const { MachineClient } = require('./machine-client.js');
const cards = require('./cards.js');
const chat = require('./chat.js');
const sessions = require('./sessions.js');
const threads = require('./threads.js');
const views = require('./views.js');
const { handle } = require('./routes.js');

class Hub {
  constructor({ stateDir = DEFAULT_STATE, root } = {}) {
    this.root = root;
    this.state = new State(stateDir);
    this.client = new MachineClient(this.state);
    this.stateDir = this.state.dir;
    this.threadsDir = this.state.threadsDir;
  }

  async init() {
    await this.state.init();
    this.pollTimer = setInterval(() => this.pollDead().catch(() => {}), 10_000);
    this.pollTimer.unref();
    this.waitTimer = setInterval(() => this.pollWaiting().catch(() => {}), 600_000);
    this.waitTimer.unref();
    await this.pollWaiting();
  }

  machines() { return this.state.machines(); }
  machine(name) { return this.state.machine(name); }
  threadPath(id) { return this.state.threadPath(id); }
  thread(id) { return this.state.thread(id); }
  save(thread) { return this.state.save(thread); }
  allThreads() { return this.state.allThreads(); }
  call(...args) { return this.client.call(...args); }
  authenticatesMachine(request) { return this.client.authenticates(request); }
  session(thread, name) { return sessions.session(thread, name); }
  startSession(thread, input) { return sessions.startSession(this, thread, input); }
  enqueue(thread, name, text, source, first) {
    return sessions.enqueue(this, thread, name, text, source, first);
  }
  event(payload) { return sessions.event(this, payload); }
  sessionRequest(payload) { return sessions.sessionRequest(this, payload); }
  pollDead() { return sessions.pollDead(this); }
  acceptCard(payload) { return cards.acceptCard(this, payload); }
  createThread(input) { return threads.createThread(this, input); }
  threadBySession(name) { return threads.threadBySession(this, name); }
  createStub(parent, card) { return threads.createStub(this, parent, card); }
  openStub(id, input) { return threads.openStub(this, id, input); }
  restartLead(id) { return threads.restartLead(this, id); }
  archive(id) { return threads.archive(this, id); }
  archivedDocument(id, file) { return threads.archivedDocument(this, id, file); }
  press(id, cardId, input) { return threads.press(this, id, cardId, input); }
  pollWaiting() { return threads.pollWaiting(this); }
  chat(id) { return chat.chat(this, id); }
  features() { return views.features(this); }
  sessions() { return views.sessions(this); }
}

module.exports = { DEFAULT_STATE, Hub, handle, transcriptItems: chat.transcriptItems };
