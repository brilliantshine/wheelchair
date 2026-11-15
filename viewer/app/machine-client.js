'use strict';

// Spec "Machine service on the hub": authenticated hub-to-service requests.
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const http = require('node:http');
const https = require('node:https');
const { appError } = require('./state.js');

function requestJson(urlText, method, headers = {}, body, timeout = 5000) {
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
        let output = '';
        response.on('data', (chunk) => { output += chunk; });
        response.on('end', () => {
          try {
            resolve({ status: response.statusCode, body: output ? JSON.parse(output) : {} });
          } catch {
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
      request.on('error', reject);
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
