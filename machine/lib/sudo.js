'use strict';

const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');

const terminal = state => ['ran', 'declined', 'expired', 'failed'].includes(state);

class SudoRequests {
  constructor(service, atomicWrite, readJson, requestJson) {
    this.service = service;
    this.atomicWrite = atomicWrite;
    this.readJson = readJson;
    this.requestJson = requestJson;
    this.file = path.join(service.stateDir, 'sudo-requests.json');
    this.socket = service.options.sudoIntake || process.env.WHEELCHAIR_SUDO_INTAKE || '/run/wheelchair-sudo/intake.sock';
    this.entries = {};
    this.lock = Promise.resolve();
  }
  async load() { this.entries = await this.readJson(this.file, {}); }
  change(fn) {
    const operation = this.lock.then(async () => {
      const draft = structuredClone(this.entries);
      const result = fn(draft);
      await this.atomicWrite(this.file, `${JSON.stringify(draft)}\n`, 0o600);
      this.entries = draft;
      return result;
    });
    this.lock = operation.catch(() => {});
    return operation;
  }
  intake(method, pathname, payload) {
    return new Promise((resolve, reject) => {
      const data = payload === undefined ? '' : JSON.stringify(payload);
      const req = http.request({ socketPath: this.socket, path: pathname, method, timeout: 5000,
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } }, res => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(body || '{}') }); }
          catch { reject(new Error('invalid helper response')); }
        });
        res.on('error', reject);
      });
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', reject);
      req.end(data);
    });
  }
  async register(input) {
    const result = await this.intake('POST', '/requests', { command: input.command, does: input.does, why: input.why });
    if (result.status !== 201) throw Object.assign(new Error(result.body.error || 'sudo helper refused request'), { status: result.status });
    const { request_id, url, editable } = result.body;
    await this.change(entries => { entries[request_id] = { accepted: false, result: { state: 'waiting' }, acknowledged: null }; });
    return { request_id, url, editable };
  }
  async accepted(payload) {
    if (payload.kind !== 'sudo') return;
    await this.change(entries => { if (entries[payload.request_id]) entries[payload.request_id].accepted = true; });
  }
  async dropped(payload) {
    if (payload.kind !== 'sudo') return;
    await this.change(entries => { delete entries[payload.request_id]; });
    this.service.log(`sudo request ${payload.request_id} dropped after card rejection`);
  }
  async saveResult(id, result) {
    return this.change(entries => {
      const entry = entries[id];
      if (!entry) return null;
      if (!terminal(entry.result.state)) {
        // A delayed waiting response must not regress a running request.
        if (!(entry.result.state === 'running' && result.state === 'waiting')) entry.result = result;
      }
      return { ...entry.result };
    });
  }
  async cancel(id) {
    await this.lock;
    const entry = this.entries[id];
    if (!entry) throw Object.assign(new Error('not found'), { status: 404 });
    if (terminal(entry.result.state)) return entry.result;
    const result = await this.intake('POST', `/requests/${id}/cancel`);
    if (result.status !== 200) throw Object.assign(new Error(result.body.error || 'sudo helper refused cancel'), { status: result.status });
    return await this.saveResult(id, result.body) || result.body;
  }
  async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      for (const id of Object.keys(this.entries)) {
        let entry = this.entries[id];
        if (!entry) continue;
        if (!terminal(entry.result.state)) {
          try {
            const result = await this.intake('GET', `/requests/${id}`);
            if (result.status === 200) await this.saveResult(id, result.body);
          } catch { /* retry on next tick */ }
        }
        entry = this.entries[id];
        if (!entry || !entry.accepted || !this.service.config.hub_url || entry.result.state === 'waiting' || entry.acknowledged === entry.result.state) continue;
        const result = { ...entry.result };
        const delivery_id = crypto.createHash('sha256').update(`${id}:${result.state}`).digest('hex');
        try {
          const response = await this.requestJson(`${this.service.config.hub_url.replace(/\/$/, '')}/api/machine/sudo-outcome`, 'POST',
            { 'x-wheelchair-machine-secret': await this.service.secret() }, { request_id: id, ...result, delivery_id });
          if (response.status >= 200 && response.status < 300) await this.change(entries => {
            const current = entries[id];
            if (!current || current.result.state !== result.state) return;
            if (terminal(result.state)) delete entries[id];
            else current.acknowledged = result.state;
          });
        } catch { /* retry on next tick */ }
      }
    } finally { this.ticking = false; }
  }
}
module.exports = { SudoRequests };
