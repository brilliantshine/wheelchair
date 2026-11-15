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
  for (const thread of await hub.allThreads()) {
    if (thread.stub || thread.archived) continue;
    await findSlug(hub, thread);
    if (!thread.slug) continue;
    const status = await currentStatus(hub, thread);
    const group = STATUS_GROUP[status] || 'idea';
    output[group].push({
      id: thread.id,
      project: thread.project,
      slug: thread.slug,
      status,
    });
    addNeeds(output.needs, thread);
  }
  return output;
}

// A thread's worktree is a full checkout, so docs/plans/ already holds every earlier plan. The
// thread's own plan is the one directory under docs/plans/ that this branch added or that is
// still untracked there (Spec "Branches and checkouts": the plan is written on the thread's branch).
async function newPlanDirectories(worktree) {
  const names = new Set();
  const take = (output) => {
    for (const line of output.split('\n')) {
      const match = line.match(/docs\/plans\/([^/]+)\//);
      if (match) names.add(match[1]);
    }
  };
  const base = await execFileAsync('git', ['-C', worktree, 'merge-base', 'HEAD', '@{upstream}'])
    .then((result) => result.stdout.trim())
    .catch(() => execFileAsync('git', ['-C', worktree, 'rev-parse', 'HEAD']).then((result) => result.stdout.trim()))
    .catch(() => null);
  if (base) {
    await execFileAsync('git', ['-C', worktree, 'diff', '--name-only', '--diff-filter=A', base, '--', 'docs/plans'])
      .then((result) => take(result.stdout)).catch(() => {});
  }
  await execFileAsync('git', ['-C', worktree, 'status', '--porcelain', '--untracked-files=all', '--', 'docs/plans'])
    .then((result) => take(result.stdout)).catch(() => {});
  return [...names];
}

async function findSlug(hub, thread) {
  if (thread.slug || !thread.worktree) return;
  const names = await newPlanDirectories(thread.worktree);
  if (names.length !== 1) return;
  thread.slug = names[0];
  await hub.save(thread);
  if (hub.registerPlan) await hub.registerPlan(path.join(thread.worktree, 'docs', 'plans', thread.slug));
}

async function currentStatus(hub, thread) {
  let status = thread.last_status;
  if (thread.worktree) {
    const file = path.join(thread.worktree, 'docs', 'plans', thread.slug, 'PLAN.md');
    const contents = await fs.readFile(file, 'utf8').catch(() => '');
    status = contents.match(/^status:\s*([^\s#]+)/m)?.[1] || status;
    thread.last_status = status;
    await hub.save(thread);
  }
  return status;
}

function addNeeds(needs, thread) {
  for (const card of thread.cards) {
    const open = !card.answered && ['question', 'needs', 'approval'].includes(card.kind);
    if (!open) continue;
    needs.push({
      thread_id: thread.id,
      card_id: card.id,
      kind: card.kind,
      title: card.title || card.question || 'Approval',
    });
  }
}

async function sessions(hub) {
  const groups = [];
  for (const [machine] of Object.entries(await hub.machines())) {
    try {
      const listed = await hub.call(machine, '/v1/sessions', 'GET');
      groups.push({
        machine,
        reachable: true,
        last_seen: hub.machineSeen(machine),
        // Other tmux sessions on the machine arrive as { name, managed: false }: listed, read-only.
        sessions: listed.map((item) => (item.managed === false ? { name: item.name, managed: false } : item)),
      });
    } catch {
      groups.push({ machine, reachable: false, last_seen: hub.machineSeen(machine), sessions: [] });
    }
  }
  return groups;
}

async function findSessionMachine(hub, name) {
  const groups = await sessions(hub);
  const group = groups.find((item) => item.sessions.some((session) => session.name === name));
  return group?.machine || null;
}

module.exports = { features, findSessionMachine, findSlug, newPlanDirectories, sessions };
