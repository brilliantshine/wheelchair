'use strict';
const { appError } = require('./state.js');
const documents = require('./documents.js');
const caches = new WeakMap();
function state(hub) { if (!caches.has(hub)) caches.set(hub, { files: new Map(), attempts: new Map(), flight: new Set() }); return caches.get(hub); }
async function isRemote(hub, thread) {
  if (!thread.machine || thread.machine === 'hub') return false;
  const registry = await hub.state.machines();
  const remote = await hub.state.resolveMachine(registry, thread.machine);
  const local = await hub.state.resolveMachine(registry, 'hub');
  return !(remote && local && remote === local);
}
function cached(hub, thread) { return state(hub).files.get(thread.id) || []; }
async function call(hub, thread, action, extra = {}) {
  const input = { thread_id: thread.id, project: thread.project, default_branch: thread.default_branch || 'main', action, ...extra };
  let timer;
  try { return await Promise.race([hub.client.call(thread.machine, '/v1/plan-files', 'POST', input, 10000), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('machine timeout')), 10000); })]); }
  finally { clearTimeout(timer); }
}
async function read(hub, thread, file) {
  try { return (await call(hub, thread, 'read', { slug: thread.slug, file })).content; }
  catch (error) { if (error.status === 400 || error.status === 404) throw appError(404, 'document not found'); throw appError(502, `Couldn't reach ${thread.machine}`); }
}
function refresh(hub, snapshot) {
  if (snapshot.target_pr) return;
  const s = state(hub), now = Date.now();
  if (s.flight.has(snapshot.id) || (s.attempts.has(snapshot.id) && now - s.attempts.get(snapshot.id) < 30000)) return;
  s.flight.add(snapshot.id); s.attempts.set(snapshot.id, now);
  (async () => {
    if (!await isRemote(hub, snapshot)) return;
    let slug = snapshot.slug;
    if (!slug) slug = (await call(hub, snapshot, 'discover')).slug;
    if (!documents.validSlug(slug)) return;
    const result = await call(hub, snapshot, 'list', { slug });
    await hub.withThread(snapshot.id, async () => {
      const current = await hub.thread(snapshot.id);
      if (current.target_pr || current.machine !== snapshot.machine || current.project !== snapshot.project || current.slug !== snapshot.slug || current.default_branch !== snapshot.default_branch) return;
      let changed = false;
      if (!current.slug) { current.slug = slug; changed = true; }
      if (result.status != null && current.last_status !== result.status) { current.last_status = result.status; changed = true; }
      if (changed) await hub.save(current);
      state(hub).files.set(snapshot.id, Array.isArray(result.files) ? result.files.filter((f) => documents.FILES.includes(f)) : []);
    });
  })().catch(() => {}).finally(() => s.flight.delete(snapshot.id));
}
module.exports = { isRemote, cached, call, read, refresh };
