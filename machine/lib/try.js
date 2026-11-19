'use strict';
const path = require('node:path');

class TryService {
  constructor({ stateDir, root, projects }) { this.stateDir = stateDir; this.root = root; this.projects = projects; }
  async handle(input) {
    const invalid = message => { throw Object.assign(new Error(message), { status: 422 }); };
    if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Invalid request.');
    if (!['status', 'try', 'back', 'dismiss', 'forget'].includes(input.action)) invalid('Invalid action.');
    if (typeof input.thread_id !== 'string' || !/^[0-9a-f]{12}$/.test(input.thread_id)) invalid('Invalid thread ID.');
    if (typeof input.project !== 'string' || !path.isAbsolute(input.project)) invalid('Invalid project.');
    const checked = await this.projects(new URLSearchParams({ check: input.project }));
    if (!checked.checked.ok) invalid('Invalid project.');
    if (['back', 'dismiss', 'forget'].includes(input.action) && (typeof input.version !== 'string' || !input.version)) invalid('Version is required.');
    if (input.action === 'forget' ? typeof input.kept !== 'string' || !input.kept : Object.hasOwn(input, 'kept')) invalid('Invalid kept ref.');
    const status = await this.status(input);
    return input.action === 'status' ? status : { accepted: false, reason: 'Not built yet', status };
  }
  async status() {
    return { version: null, state: 'none', active_thread_id: null, active_commit: null, target_available: false, newest: false, refused: null, earlier_branch: null, files: [], files_count: 0, index_lock: null, last: null, kept: [] };
  }
}
module.exports = { TryService };
