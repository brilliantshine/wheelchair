'use strict';

// Spec "Machine service on the hub": authenticated hub-to-service requests.
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const http = require('node:http');
const https = require('node:https');
const { appError } = require('./state.js');

function requestJson(urlText, method, headers = {}, body, timeout = 5000, strict = false) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlText);
    const payload = body === undefined ? '' : JSON.stringify(body);
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.request(
      url,
      {
        method,
        headers: {
          ...headers,
          ...(body === undefined
            ? {}
            : {
              'content-type': 'application/json',
              'content-length': Buffer.byteLength(payload),
            }),
        },
        timeout,
      },
      (response) => {
        response.setEncoding('utf8');
        let output = '';
        if (strict) response.on('aborted', () => reject(new Error('machine connection dropped')));
        response.on('data', (chunk) => { output += chunk; });
        response.on('end', () => {
          try {
            resolve({ status: response.statusCode, body: strict ? JSON.parse(output) : (output ? JSON.parse(output) : {}) });
          } catch {
            if (strict) return reject(new Error('machine returned invalid JSON'));
            resolve({ status: response.statusCode, body: { raw: output } });
          }
        });
      },
    );
    request.on('timeout', () => request.destroy(new Error('machine timeout')));
    request.on('error', reject);
    request.end(payload);
  });
}

class MachineClient {
  constructor(state) {
    this.state = state;
  }

  async secret(machine) {
    if (machine.secret) return machine.secret;
    if (!machine.secret_file) return '';
    return (await fs.readFile(machine.secret_file, 'utf8')).trim();
  }

  url(machine, suffix) {
    const host = machine.address || machine.host || '127.0.0.1';
    return `http://${host}:${machine.port || 7374}${suffix}`;
  }

  async call(machineName, suffix, method, body, timeout = 5000) {
    const machine = await this.state.machine(machineName);
    const secret = await this.secret(machine);
    const result = await requestJson(
      this.url(machine, suffix),
      method,
      { 'x-wheelchair-machine-secret': secret },
      body,
      timeout,
    );
    if (result.status < 200 || result.status >= 300) {
      throw appError(result.status || 502, result.body.error || 'machine refused request');
    }
    return result.body;
  }

  async tryCheckout(machineName, input) {
    let timer;
    try {
      return await Promise.race([
        this.call(machineName, '/v1/try', 'POST', input),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('machine timeout')), 5000); }),
      ]);
    } catch (error) {
      if (error.status) throw error;
      throw appError(502, `Can't reach ${machineName}.`);
    } finally { clearTimeout(timer); }
  }

  async passThrough(machineName, suffix, method, body, timeout = 5000) {
    const machine = await this.state.machine(machineName);
    const secret = await this.secret(machine);
    return requestJson(this.url(machine, suffix), method,
      { 'x-wheelchair-machine-secret': secret }, body, timeout, true);
  }

  // Spec "Decline": one synchronous call, ten seconds overall (not merely idle) before the hub
  // gives up. `sudoCancelTimeout` is a property so a test can shorten it.
  async sudoCancel(machineName, requestId) {
    const limit = this.sudoCancelTimeout || 10_000;
    let timer;
    const deadline = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('machine timeout')), limit);
    });
    try {
      return await Promise.race([
        this.call(machineName, `/v1/sudo/${encodeURIComponent(requestId)}/cancel`, 'POST', {}, limit),
        deadline,
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  // Handoff git actions can take longer than ordinary machine calls; bound the whole call.
  async handoff(machineName, input) {
    const limit = this.handoffTimeout || 120_000;
    let timer;
    const deadline = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("The machine didn't answer in time")), limit);
    });
    try {
      return await Promise.race([
        this.call(machineName, '/v1/handoff', 'POST', input, limit).catch((error) => {
          if (error.message === 'machine timeout') throw new Error("The machine didn't answer in time");
          throw error;
        }),
        deadline,
      ]);
    } finally { clearTimeout(timer); }
  }

  async stream(machineName, suffix, method, readable) {
    const machine = await this.state.machine(machineName);
    const secret = await this.secret(machine);
    const url = new URL(this.url(machine, suffix));
    const transport = url.protocol === 'https:' ? https : http;
    return new Promise((resolve, reject) => {
      const headers = { 'x-wheelchair-machine-secret': secret };
      if (readable?.headers?.['content-length']) headers['content-length'] = readable.headers['content-length'];
      if (readable?.headers?.['content-type']) headers['content-type'] = readable.headers['content-type'];
      const request = transport.request(url, { method, headers }, (response) => {
        resolve({ status: response.statusCode, headers: response.headers, body: response });
      });
      request.on('error', (error) => {
        error.machineConnection = true;
        reject(error);
      });
      if (readable) {
        readable.on('aborted', () => request.destroy());
        readable.on('error', (error) => request.destroy(error));
        readable.pipe(request);
      } else request.end();
    });
  }

  async authenticates(request) {
    const supplied = request.headers['x-wheelchair-machine-secret'];
    if (typeof supplied !== 'string') return false;
    for (const machine of Object.values(await this.state.machines())) {
      const expected = await this.secret(machine).catch(() => '');
      if (!expected || expected.length !== supplied.length) continue;
      if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) return true;
    }
    return false;
  }
}

module.exports = { MachineClient, requestJson };
