'use strict';

// Spec "Feature status" and "Views": Features and Sessions response data.
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const STATUS_GROUP = {
  planning: 'planning',
  'ready-for-review': 'review',
  approved: 'review',
  implementing: 'building',
  verifying: 'verifying',
  done: 'done',
};

async function features(hub) {
  const output = {
    idea: [],
    planning: [],
    review: [],
    building: [],
    verifying: [],
    done: [],
    needs: [],
  };
  // Read-only snapshot: no thread lock, so a thread busy starting a session (up to a minute)
  // does not hold up every page that asks for this list. A thread is locked only to record a
  // slug or status that changed, and then re-read under the lock so no concurrent write is lost.
  const threads = (await require('./assistant.js').visible(hub, await hub.allThreads())).filter((thread) => !thread.archived);
  const rows = await Promise.all(threads.map(async (listed) => {
    let thread = listed;
    const needs = [];
    addNeeds(needs, thread);
    if (!thread.assistant && !thread.target_pr && !thread.slug && thread.worktree && !await require('./remote-plan.js').isRemote(hub, thread)) {
      const names = await newPlanDirectories(thread.worktree, thread.default_branch || 'main');
      if (names.length === 1) { thread = structuredClone(thread); await recordSlug(hub, thread, names[0]); }
    }
    if (thread.assistant) return { needs };
    if (thread.stub && !thread.sessions.length) return { needs };
    if (!thread.slug) return { needs };
    const status = await currentStatus(hub, thread);
    const group = STATUS_GROUP[status] || 'idea';
    return { needs, group, row: { id: thread.id, project: thread.project, slug: thread.slug, status } };
  }));
  for (const { needs, group, row } of rows) {
    output.needs.push(...needs);
    if (row) output[group].push(row);
  }
  return output;
}

async function recordSlug(hub, snapshot, slug) {
  snapshot.slug = slug;
  await hub.withThread(snapshot.id, async () => {
    const thread = await hub.thread(snapshot.id);
    if (thread.target_pr) { delete snapshot.slug; return; }
    if (thread.slug) { snapshot.slug = thread.slug; return; }
    thread.slug = slug;
    await hub.save(thread);
    if (hub.registerPlan) await hub.registerPlan(path.join(thread.worktree, 'docs', 'plans', slug));
  });
}

// A thread's worktree is a full checkout, so docs/plans/ already holds every earlier plan. The
// thread's own plan is the one directory under docs/plans/ that this branch created: files added
// since the merge base, or new files in the worktree, under a directory the merge base does not
// have (Spec "Branches and checkouts": the plan is written on the thread's branch). Editing or
// adding a file in an earlier plan's directory never claims that plan.
async function newPlanDirectories(worktree, defaultBranch = 'main') {
  const names = new Set();
  const take = (output) => {
    for (const line of output.split('\n')) {
      const match = line.match(/docs\/plans\/([^/]+)\//);
      if (match) names.add(match[1]);
    }
  };
  const base = await execFileAsync('git', ['-C', worktree, 'merge-base', 'HEAD', `origin/${defaultBranch}`])
    .then((result) => result.stdout.trim())
    .catch(() => execFileAsync('git', ['-C', worktree, 'rev-parse', 'HEAD']).then((result) => result.stdout.trim()))
    .catch(() => null);
  if (base) {
    await execFileAsync('git', ['-C', worktree, 'diff', '--name-only', '--diff-filter=A', base, '--', 'docs/plans'])
      .then((result) => take(result.stdout)).catch(() => {});
  }
  await execFileAsync('git', ['-C', worktree, 'status', '--porcelain', '--untracked-files=all', '--', 'docs/plans'])
    .then((result) => take(result.stdout)).catch(() => {});
  if (!base || !names.size) return [...names];
  const existing = await execFileAsync('git', ['-C', worktree, 'ls-tree', '--name-only', base, 'docs/plans/'])
    .then((result) => new Set(result.stdout.split('\n').map((line) => line.trim().split('/').pop()).filter(Boolean)))
    .catch(() => null);
  if (!existing) return [];
  return [...names].filter((name) => !existing.has(name));
}

// Archiving usually removes the worktree, and then git checks only fail; skipping them keeps
// the thread list, which every page polls, from spawning git for each one on every poll. A
// worktree the archive failed to remove is still searched.
async function discoverSlug(thread, hub) {
  if (thread.assistant || thread.target_pr || thread.slug || !thread.worktree) return null;
  if (hub && await require('./remote-plan.js').isRemote(hub, thread)) return null;
  if (thread.archived && await fs.stat(thread.worktree).then(() => false, (error) => error.code === 'ENOENT' || error.code === 'ENOTDIR')) return null;
  const names = await newPlanDirectories(thread.worktree, thread.default_branch || 'main');
  return names.length === 1 ? names[0] : null;
}

async function findSlug(hub, thread) {
  const slug = await discoverSlug(thread, hub);
  if (!slug) return;
  thread.slug = slug;
  await hub.save(thread);
  if (hub.registerPlan) await hub.registerPlan(path.join(thread.worktree, 'docs', 'plans', thread.slug));
}

async function readStatus(thread) {
  const file = path.join(thread.worktree, 'docs', 'plans', thread.slug, 'PLAN.md');
  const contents = await fs.readFile(file, 'utf8').catch(() => '');
  return contents.match(/^status:\s*([^\s#]+)/m)?.[1] || thread.last_status;
}

// PLAN.md is the truth; last_status is the thread's cached copy. A change seen in the snapshot
// is recorded under the lock from a fresh read of both, so an older read never overwrites a newer
// one and an unchanged status is never saved.
async function currentStatus(hub, snapshot) {
  if (!snapshot.worktree) return snapshot.last_status;
  const status = await readStatus(snapshot);
  if (status === snapshot.last_status) return status;
  return hub.withThread(snapshot.id, async () => {
    const thread = await hub.thread(snapshot.id);
    const fresh = await readStatus({ ...thread, slug: thread.slug || snapshot.slug });
    if (fresh !== thread.last_status) {
      thread.last_status = fresh;
      await hub.save(thread);
    }
    return fresh;
  });
}

function addNeeds(needs, thread) {
  for (const card of thread.cards) {
    const open = !card.replaced && !card.answered && ['question', 'needs', 'approval', 'merged', 'reach', 'permit'].includes(card.kind);
    if (!open) continue;
    needs.push({
      thread_id: thread.id,
      card_id: card.id,
      kind: card.kind,
      title: card.kind === 'permit' ? `Push to #${card.pr_number}?` : card.title || card.question || 'Approval',
    });
  }
}

async function sessions(hub) {
  const groups = [];
  const allThreads = await hub.allThreads();
  const visibleThreads = await require('./assistant.js').visible(hub, allThreads);
  const hiddenSessions = new Set(allThreads.filter((t) => !visibleThreads.some((v) => v.id === t.id)).flatMap((t) => t.sessions.map((s) => s.name)));
  const registry = await hub.machines();
  const hubEntry = await hub.state.resolveMachine(registry, 'hub');
  for (const [machine] of Object.entries(registry)) {
    const isHub = !!hubEntry && registry[machine] === hubEntry;
    try {
      const listed = await hub.call(machine, '/v1/sessions', 'GET');
      groups.push({
        machine,
        hub: isHub,
        reachable: true,
        last_seen: hub.machineSeen(machine),
        // Other tmux sessions on the machine arrive as { name, managed: false }: listed, read-only.
        sessions: listed.filter((item) => !hiddenSessions.has(item.name)).map((item) => {
          if (item.managed === false) return { name: item.name, managed: false };
          const { token, ...publicItem } = item;
          return publicItem;
        }),
      });
    } catch {
      const recorded = visibleThreads.flatMap((thread) => (
        (thread.machine === machine || (isHub && thread.machine === 'hub'))
          ? thread.sessions.filter((session) => session.live).map((session) => {
            const { token, ...publicSession } = session;
            return { ...publicSession, state: 'unreachable' };
          })
          : []
      ));
      groups.push({ machine, hub: isHub, reachable: false, last_seen: hub.machineSeen(machine), sessions: recorded });
    }
  }
  return groups;
}

async function findSessionMachine(hub, name) {
  const groups = await sessions(hub);
  const group = groups.find((item) => item.sessions.some((session) => session.name === name));
  return group?.machine || null;
}

module.exports = { readStatus, currentStatus, STATUS_GROUP, addNeeds, features, findSessionMachine, findSlug, discoverSlug, newPlanDirectories, sessions };
