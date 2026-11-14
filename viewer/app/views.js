'use strict';

// Spec "Feature status" and "Views": Features and Sessions response data.
const fs = require('node:fs/promises');
const path = require('node:path');

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

async function findSlug(hub, thread) {
  if (thread.slug || !thread.worktree) return;
  const plansPath = path.join(thread.worktree, 'docs', 'plans');
  const plans = await fs.readdir(plansPath, { withFileTypes: true }).catch(() => []);
  const plan = plans.find((item) => item.isDirectory());
  if (!plan) return;
  thread.slug = plan.name;
  await hub.save(thread);
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
        sessions: listed,
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

module.exports = { features, findSessionMachine, findSlug, sessions };
