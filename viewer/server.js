/*
Routes (all responses use Cache-Control: no-store):
  GET  /?path&token       token query      -> viewer/index.html
  GET  /graph?path&token  token query      -> { hash, graph, children }
  PUT  /graph?path        X-Graph-Token + matching Origin -> { hash }
  PUT  /view?path         X-Graph-Token + matching Origin -> { hash }
  GET  /whoami            no authentication -> { start_id }.

Errors:
  400 bad-path, bad-body
  401 bad-token
  403 bad-origin, not-registered
  404 not-found, no-route
  409 stale (also returns hash)
  422 invalid-json (position), unknown-schema (schema), missing-label, bad-id, bad-kind (ids),
      edge-missing-node, group-bad-name, group-missing-node, explanation-missing-group,
      group-unreferenced, bad-origin-value, bad-was, container-bad-name,
      container-cycle, container-orphan, container-unreadable-child, preservation-rejected,
      preservation-agreed, agent-verdict, structural-difference (ids),
      bulk-not-additive
  500 internal
*/

'use strict';

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const DEFAULT_PORT = 7373;
const DAY = 24 * 60 * 60 * 1000;
const REGISTERED_MAX_AGE = 30 * DAY;
// A server that has claimed the lockfile but not yet bound is indistinguishable from an unrelated
// live process. These bound how long a second starter waits for it to answer before giving up.
// A page polls every second, so anything read inside this window means a tab is live on that graph.
const WATCHED_WINDOW_MS = 4000;
// How long --open waits for the graph to be written before giving up on showing it.
const LAUNCH_WAIT_MS = 15000;
const STARTUP_GRACE_ATTEMPTS = 20;
const STARTUP_GRACE_INTERVAL_MS = 100;
const ORIGINS = new Set(['proposed', 'agreed', 'rejected']);
const SOURCES = new Set(['router', 'code-read', 'plan-proposal']);
const NODE_KINDS = new Set(['file', 'module', 'step', 'decision', 'external', 'note']);
const EDGE_KINDS = new Set(['data', 'sequence']);
// Child graph names and group ids share one shape, and for the same reason both times:
// the name has to survive being written into a path or into a `[phrase](#id)` reference.
const BARE_NAME = /^[a-z0-9_-]+$/;
// The page carries this identical expression because the two files share no module. Its narrow
// target syntax keeps ordinary markdown links out of the graph-reference contract.
const GROUP_REFERENCE = /\[([^\[\]]+)\]\(#([a-z0-9_-]+)\)/g;

class ClientError extends Error {
  constructor(status, code, detail, extra = {}) {
    super(detail);
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.extra = extra;
  }
}

class InternalError extends Error {}

function fail(status, code, detail, extra) {
  throw new ClientError(status, code, detail, extra);
}

function hashBytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function orderedNode(node) {
  return {
    id: node.id, label: node.label, kind: node.kind, origin: node.origin,
    was: node.was, exclusive: node.exclusive, ref: node.ref, note: node.note,
    graph: node.graph, x: node.x, y: node.y,
  };
}

function orderedEdge(edge) {
  return {
    id: edge.id, from: edge.from, to: edge.to, label: edge.label,
    kind: edge.kind, value: edge.value, inferred: edge.inferred,
    origin: edge.origin, was: edge.was, note: edge.note,
  };
}

function orderedGroup(group) {
  return { id: group.id, nodes: [...new Set(group.nodes)].sort() };
}

function canonicalBytes(graph) {
  const result = {
    schema: graph.schema,
    title: graph.title,
    source: graph.source,
    source_detail: graph.source_detail,
    explanation: graph.explanation,
    groups: [...graph.groups].sort(compareId).map(orderedGroup),
    nodes: [...graph.nodes].sort(compareId).map(orderedNode),
    edges: [...graph.edges].sort(compareId).map(orderedEdge),
  };
  return Buffer.from(`${JSON.stringify(result, null, 2)}\n`);
}

function compareId(a, b) {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function rounded(value) {
  const number = Number(value ?? 0);
  return Math.round(Number.isFinite(number) ? number : 0);
}

// Canonicalization intentionally drops unknown keys.  checkOrigin is delayed by /view
// because its structural-identity check is contractually earlier.
function validateGraph(input, { checkOrigin = true } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    fail(400, 'bad-body', 'The request body must contain a graph object.');
  }
  if (input.schema !== 1) {
    fail(422, 'unknown-schema', 'The graph schema is not supported.', { schema: input.schema });
  }
  if (typeof input.title !== 'string' || typeof input.source !== 'string' ||
      !SOURCES.has(input.source) ||
      !(input.source_detail === null || typeof input.source_detail === 'string') ||
      !(input.explanation === undefined || input.explanation === null || typeof input.explanation === 'string') ||
      !(input.groups === undefined || Array.isArray(input.groups)) ||
      !Array.isArray(input.nodes) || !Array.isArray(input.edges)) {
    fail(422, 'unknown-schema', 'The graph does not have the schema 1 shape.', { schema: input.schema });
  }

  const nodeIds = new Set();
  const edgeIds = new Set();
  const nodes = input.nodes.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
        typeof raw.id !== 'string' || raw.id.length === 0 || nodeIds.has(raw.id)) {
      fail(422, 'bad-id', 'A node id is missing, empty, or duplicated.');
    }
    nodeIds.add(raw.id);
    if (!Object.prototype.hasOwnProperty.call(raw, 'label') || typeof raw.label !== 'string') {
      fail(422, 'missing-label', 'A node is missing its label.');
    }
    const node = {
      id: raw.id,
      label: raw.label,
      kind: raw.kind ?? 'note',
      origin: raw.origin ?? 'proposed',
      was: raw.was ?? null,
      exclusive: raw.exclusive ?? false,
      ref: raw.ref ?? null,
      note: raw.note ?? null,
      graph: raw.graph ?? null,
      x: rounded(raw.x),
      y: rounded(raw.y),
    };
    if (!NODE_KINDS.has(node.kind)) {
      fail(422, 'bad-kind', 'A node kind is outside the allowed set.', { ids: [node.id] });
    }
    if (checkOrigin && !ORIGINS.has(node.origin)) {
      fail(422, 'bad-origin-value', 'An origin is outside the allowed set.');
    }
    if (node.graph !== null && (typeof node.graph !== 'string' || !BARE_NAME.test(node.graph))) {
      fail(422, 'container-bad-name', 'A container graph name is not a bare valid name.');
    }
    return node;
  });
  const groupIds = new Set();
  const groups = (input.groups ?? []).map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
        typeof raw.id !== 'string' || raw.id.length === 0 || groupIds.has(raw.id)) {
      fail(422, 'bad-id', 'A group id is missing, empty, or duplicated.');
    }
    groupIds.add(raw.id);
    if (!BARE_NAME.test(raw.id)) {
      fail(422, 'group-bad-name', 'A group id must be a bare valid name.');
    }
    if (!Array.isArray(raw.nodes) || raw.nodes.length === 0 ||
        raw.nodes.some((id) => typeof id !== 'string' || !nodeIds.has(id))) {
      fail(422, 'group-missing-node', 'A group must name one or more nodes in this graph.');
    }
    return { id: raw.id, nodes: raw.nodes };
  });
  const edges = input.edges.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
        typeof raw.id !== 'string' || raw.id.length === 0 || edgeIds.has(raw.id)) {
      fail(422, 'bad-id', 'An edge id is missing, empty, or duplicated.');
    }
    edgeIds.add(raw.id);
    if (!Object.prototype.hasOwnProperty.call(raw, 'label') || typeof raw.label !== 'string') {
      fail(422, 'missing-label', 'An edge is missing its label.');
    }
    const edge = {
      id: raw.id,
      from: raw.from,
      to: raw.to,
      label: raw.label,
      kind: raw.kind ?? 'sequence',
      value: raw.value ?? null,
      inferred: raw.inferred ?? false,
      origin: raw.origin ?? 'proposed',
      was: raw.was ?? null,
      note: raw.note ?? null,
    };
    if (!EDGE_KINDS.has(edge.kind)) {
      fail(422, 'bad-kind', 'An edge kind is outside the allowed set.', { ids: [edge.id] });
    }
    if (checkOrigin && !ORIGINS.has(edge.origin)) {
      fail(422, 'bad-origin-value', 'An origin is outside the allowed set.');
    }
    return edge;
  });
  for (const edge of edges) {
    if (typeof edge.from !== 'string' || typeof edge.to !== 'string' ||
        !nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      fail(422, 'edge-missing-node', 'An edge names a node that is not present.');
    }
  }
  // A group exists only to make a specific passage of the account point at graph boxes. Check
  // both sides so neither a dangling link nor a silent, never-highlighted group reaches the page.
  const referencedGroups = new Set(Array.from((input.explanation ?? '').matchAll(GROUP_REFERENCE),
    (match) => match[2]));
  for (const id of referencedGroups) {
    if (!groupIds.has(id)) {
      fail(422, 'explanation-missing-group', 'The explanation references a group that is not present.');
    }
  }
  for (const group of groups) {
    if (!referencedGroups.has(group.id)) {
      fail(422, 'group-unreferenced', 'A group must be referenced by the explanation.');
    }
  }
  return {
    schema: 1, title: input.title, source: input.source,
    source_detail: input.source_detail, explanation: input.explanation ?? null, groups, nodes, edges,
  };
}

function entryWithoutPosition(entry, isNode) {
  const clone = { ...entry };
  if (isNode) {
    delete clone.x;
    delete clone.y;
  }
  return JSON.stringify(isNode ? orderedNode({ ...clone, x: 0, y: 0 }) : orderedEdge(clone),
    isNode ? ['id', 'label', 'kind', 'origin', 'was', 'exclusive', 'ref', 'note', 'graph'] :
      ['id', 'from', 'to', 'label', 'kind', 'value', 'inferred', 'origin', 'was', 'note']);
}

function sameExceptPosition(left, right, isNode) {
  if (isNode) {
    const a = { ...left }; const b = { ...right };
    delete a.x; delete a.y; delete b.x; delete b.y;
    return JSON.stringify(orderedNode({ ...a, x: 0, y: 0 })) ===
      JSON.stringify(orderedNode({ ...b, x: 0, y: 0 }));
  }
  return JSON.stringify(orderedEdge(left)) === JSON.stringify(orderedEdge(right));
}

function parseJson(bytes) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    const match = /position (\d+)/.exec(error.message);
    fail(422, 'invalid-json', 'The graph file contains invalid JSON.',
      { position: match ? Number(match[1]) : 0 });
  }
}

async function readRaw(graphPath) {
  try {
    const bytes = await fsp.readFile(graphPath);
    return { exists: true, bytes, hash: hashBytes(bytes) };
  } catch (error) {
    if (error.code === 'ENOENT') return { exists: false, bytes: null, hash: '' };
    throw error;
  }
}

function parseDisk(raw) {
  return validateGraph(parseJson(raw.bytes));
}

function childPath(parentPath, name) {
  return path.join(path.dirname(parentPath), `${name}.json`);
}

async function graphFromFile(graphPath) {
  const raw = await readRaw(graphPath);
  if (!raw.exists) return null;
  return parseDisk(raw);
}

function mapById(entries) {
  return new Map(entries.map((entry) => [entry.id, entry]));
}

// Agent preservation is deliberately outside HTTP handling: this is the format contract.
// Everything an agent's PUT /graph is forbidden to do, in one place:
//   - it may not grant itself a verdict (agent-verdict),
//   - it must preserve every rejected entry verbatim and every agreed entry either verbatim or
//     reset to proposed with was: "agreed" (preservation-rejected, preservation-agreed),
//   - it may write `was` only as part of a reset, and may never clear a landed one (bad-was).
// Removing an entry already reset to proposed is allowed: that is the second of the two visible
// steps a superseded flow takes, instead of vanishing in one.
function checkAgentWrite(current, incoming) {
  for (const [oldEntries, newEntries, isNode] of [
    [current.nodes, incoming.nodes, true], [current.edges, incoming.edges, false],
  ]) {
    const oldById = mapById(oldEntries);
    const newById = mapById(newEntries);
    for (const entry of newEntries) {
      const old = oldById.get(entry.id);
      if (!old || old.origin === 'proposed') {
        if (entry.origin !== 'proposed') {
          fail(422, 'agent-verdict', 'An agent may not set a verdict on a new or proposed entry.',
            { ids: [entry.id] });
        }
      }
    }
    for (const old of oldEntries) {
      const entry = newById.get(old.id);
      if (old.origin === 'rejected' && (!entry || !sameExceptPosition(old, entry, isNode))) {
        fail(422, 'preservation-rejected', 'A rejected entry must be preserved unchanged.',
          { ids: [old.id] });
      }
      if (old.origin === 'agreed') {
        const reset = entry && entry.origin === 'proposed' && entry.was === 'agreed';
        if (!entry || (!sameExceptPosition(old, entry, isNode) && !reset)) {
          fail(422, 'preservation-agreed', 'An agreed entry must be preserved or reset.',
            { ids: [old.id] });
        }
      }
    }
    for (const entry of newEntries) {
      const old = oldById.get(entry.id);
      const resetNow = old && old.origin === 'agreed' && entry.origin === 'proposed';
      const landedReset = old && old.origin === 'proposed' && old.was === 'agreed';
      if (entry.was === null) {
        if (landedReset) {
          fail(422, 'bad-was', 'An agent may not clear a landed reset record.', { ids: [entry.id] });
        }
      } else if (!(entry.was === 'agreed' && (resetNow || landedReset))) {
        fail(422, 'bad-was', 'An agent wrote a was value it is not allowed to write.', { ids: [entry.id] });
      }
    }
  }
}

async function hasContainmentCycle(rootPath, incoming) {
  const visiting = new Set();
  const seen = new Set();
  async function walk(filePath) {
    if (visiting.has(filePath)) return true;
    if (seen.has(filePath)) return false;
    seen.add(filePath); visiting.add(filePath);
    const graph = filePath === rootPath ? incoming : await graphFromFile(filePath);
    if (graph) {
      for (const node of graph.nodes) {
        if (node.graph && await walk(childPath(filePath, node.graph))) return true;
      }
    }
    visiting.delete(filePath);
    return false;
  }
  return walk(rootPath);
}

async function subtreeHasVerdict(rootPath) {
  const seen = new Set();
  async function walk(filePath) {
    if (seen.has(filePath)) return false;
    seen.add(filePath);
    const raw = await readRaw(filePath);
    if (!raw.exists) return false;
    let graph;
    try {
      graph = parseDisk(raw);
    } catch {
      // A child that will not parse cannot be shown to hold no verdicts, and this walk exists to
      // stop verdict loss. Surface the corruption where it matters rather than orphaning the file.
      fail(422, 'container-unreadable-child',
        `The child graph ${filePath} does not parse, so its verdicts cannot be checked.`);
    }
    if ([...graph.nodes, ...graph.edges].some((entry) =>
      entry.origin === 'agreed' || entry.origin === 'rejected')) return true;
    for (const node of graph.nodes) {
      if (node.graph && await walk(childPath(filePath, node.graph))) return true;
    }
    return false;
  }
  return walk(rootPath);
}

async function checkOrphans(graphPath, current, incoming) {
  const nextById = mapById(incoming.nodes);
  for (const oldNode of current.nodes) {
    if (!oldNode.graph) continue;
    const next = nextById.get(oldNode.id);
    if (!next || next.graph !== oldNode.graph) {
      if (await subtreeHasVerdict(childPath(graphPath, oldNode.graph))) {
        fail(422, 'container-orphan', 'Removing or retargeting this container would orphan a verdict.',
          { ids: [oldNode.id] });
      }
    }
  }
}

// The first render is the one Collin reads before he has dragged anything, so the layout is worth
// more than a grid: it is a small Sugiyama pass. Break cycles so every edge can point down, put
// each node one row below its deepest parent, order each row so arrows cross as little as they
// can, then pull each box toward the middle of what it connects to. Disconnected pieces are laid
// out on their own and set side by side, because stacking them reads as a flow that isn't there.
// Held against the page's tallest possible box, which is 116 at its five-line label cap
// (NODE_LABEL_MAX_LINES in viewer/index.html). The two files share no module, so nothing
// structural stops one of these numbers moving without the other; the browser suite measures a
// real five-line box against a real layout and is what actually catches it.
const LAYER_GAP = 140;
const NODE_PITCH = 260;
// A bend point is not drawn — the viewer draws every edge as one straight line — but reserving it
// a slot keeps a row from closing over the diagonal that has to pass through it.
const BEND_PITCH = 160;
const COMPONENT_GAP = 200;

function layout(graph) {
  const ids = graph.nodes.map((node) => node.id).sort();
  if (!ids.length) return new Map();
  const known = new Set(ids);
  // Sorted and deduplicated, and self edges dropped: the same graph has to lay out the same way
  // however its arrays happen to be ordered, and a self edge constrains nothing.
  const pairs = [...new Set(graph.edges
    .filter((edge) => edge.from !== edge.to && known.has(edge.from) && known.has(edge.to))
    .map((edge) => JSON.stringify([edge.from, edge.to])))].sort().map((key) => JSON.parse(key));

  const acyclic = breakCycles(ids, pairs);
  const layer = layerByLongestPath(ids, acyclic);
  const positions = new Map();
  let cursor = 0;
  for (const group of components(ids, pairs)) {
    const top = Math.min(...group.map((id) => layer.get(id)));
    const local = new Map(group.map((id) => [id, layer.get(id) - top]));
    const placed = placeComponent(group, local, acyclic.filter(([from]) => local.has(from)));
    let min = Infinity, max = -Infinity;
    for (const point of placed.values()) { min = Math.min(min, point.x); max = Math.max(max, point.x); }
    for (const [id, point] of placed) positions.set(id, { x: point.x - min + cursor, y: point.y });
    cursor += max - min + NODE_PITCH + COMPONENT_GAP;
  }
  return positions;
}

// Depth-first in id order; an edge that closes back onto the stack is a cycle's back edge, and it
// is turned around rather than dropped, so a cycle still pulls its two ends near each other.
function breakCycles(ids, pairs) {
  const outgoing = new Map(ids.map((id) => [id, []]));
  for (const [from, to] of pairs) outgoing.get(from).push(to);
  const state = new Map(ids.map((id) => [id, 'unseen']));
  const back = new Set();
  for (const root of ids) {
    if (state.get(root) !== 'unseen') continue;
    state.set(root, 'open');
    const stack = [{ id: root, next: 0 }];
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const targets = outgoing.get(frame.id);
      if (frame.next >= targets.length) { state.set(frame.id, 'done'); stack.pop(); continue; }
      const to = targets[frame.next++];
      if (state.get(to) === 'open') { back.add(JSON.stringify([frame.id, to])); continue; }
      if (state.get(to) === 'unseen') { state.set(to, 'open'); stack.push({ id: to, next: 0 }); }
    }
  }
  // Deduplicated again after turning edges around: a two-cycle's two edges become the same edge
  // once one of them is reversed, and counting it twice would weight it twice in every median.
  return [...new Set(pairs
    .map(([from, to]) => back.has(JSON.stringify([from, to])) ? [to, from] : [from, to])
    .map((pair) => JSON.stringify(pair)))].map((key) => JSON.parse(key));
}

// One row below the deepest parent, never the first row a search happens to reach it on: that is
// what makes every arrow point downward, which is most of what "readable" means here.
function layerByLongestPath(ids, edges) {
  const preds = new Map(ids.map((id) => [id, []]));
  const succs = new Map(ids.map((id) => [id, []]));
  for (const [from, to] of edges) { preds.get(to).push(from); succs.get(from).push(to); }
  const remaining = new Map(ids.map((id) => [id, preds.get(id).length]));
  const layer = new Map();
  let ready = ids.filter((id) => remaining.get(id) === 0);
  while (ready.length) {
    const next = [];
    for (const id of ready) layer.set(id, Math.max(0, ...preds.get(id).map((from) => layer.get(from) + 1)));
    for (const id of ready) {
      for (const to of succs.get(id)) {
        remaining.set(to, remaining.get(to) - 1);
        if (remaining.get(to) === 0) next.push(to);
      }
    }
    ready = next.sort();
  }
  // Nothing should be left — the edge set is acyclic by here — but a node the walk never reached
  // still needs a row rather than an undefined one.
  for (const id of ids) if (!layer.has(id)) layer.set(id, 0);
  return layer;
}

function components(ids, pairs) {
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (id) => {
    while (parent.get(id) !== id) { parent.set(id, parent.get(parent.get(id))); id = parent.get(id); }
    return id;
  };
  for (const [from, to] of pairs) {
    const left = find(from), right = find(to);
    if (left !== right) parent.set(left, right);
  }
  const groups = new Map();
  for (const id of ids) {
    const root = find(id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(id);
  }
  return [...groups.values()].sort((left, right) => left[0] < right[0] ? -1 : 1);
}

function placeComponent(group, layerOf, edges) {
  const depth = Math.max(...group.map((id) => layerOf.get(id))) + 1;
  const rows = Array.from({ length: depth }, () => []);
  const boxes = new Set(group);
  for (const id of group) rows[layerOf.get(id)].push(id);

  // An edge spanning more than one row gets a bend point on each row it crosses, so the rows in
  // between order themselves around the diagonal instead of parking a box on top of it.
  const links = new Map();
  const cell = (id) => {
    if (!links.has(id)) links.set(id, { up: [], down: [] });
    return links.get(id);
  };
  for (const [from, to] of edges) {
    let previous = from;
    for (let row = layerOf.get(from) + 1; row < layerOf.get(to); row += 1) {
      const bend = JSON.stringify([from, to, row]);
      rows[row].push(bend);
      cell(previous).down.push(bend);
      cell(bend).up.push(previous);
      previous = bend;
    }
    cell(previous).down.push(to);
    cell(to).up.push(previous);
  }
  for (const row of rows) for (const id of row) cell(id);

  // Sweep down then up, each row reordered to the median of where its neighbours in the row it
  // just came from sit. Keep the best ordering seen, not the last: a sweep can undo its own gain.
  let order = rows.map((row) => row.slice());
  let best = order.map((row) => row.slice());
  let fewest = crossings(order, links);
  for (let pass = 0; pass < 8; pass += 1) {
    const down = pass % 2 === 0;
    const walk = down ? order.map((_, i) => i).slice(1) : order.map((_, i) => i).slice(0, -1).reverse();
    for (const index of walk) {
      const rank = new Map(order[down ? index - 1 : index + 1].map((id, at) => [id, at]));
      const was = new Map(order[index].map((id, at) => [id, at]));
      const key = new Map(order[index].map((id, at) => {
        const near = neighbours(links, id, down ? 'up' : 'down', rank);
        return [id, near.length ? median(near) : at];
      }));
      order[index] = order[index].slice()
        .sort((left, right) => key.get(left) - key.get(right) || was.get(left) - was.get(right));
    }
    const count = crossings(order, links);
    if (count < fewest) { fewest = count; best = order.map((row) => row.slice()); }
  }
  order = best;

  // Columns last: each box slides toward the middle of what it connects to, and the row is packed
  // back apart afterwards. A bend point reads both of its sides at once, since what it stands for
  // is the straight line between them.
  const pitch = new Map();
  for (const row of rows) for (const id of row) pitch.set(id, boxes.has(id) ? NODE_PITCH : BEND_PITCH);
  const x = new Map();
  for (const row of order) {
    let at = 0;
    for (const id of row) { x.set(id, at); at += pitch.get(id); }
  }
  for (let pass = 0; pass < 6; pass += 1) {
    const down = pass % 2 === 0;
    const walk = down ? order.map((_, i) => i) : order.map((_, i) => i).reverse();
    for (const index of walk) {
      const wanted = order[index].map((id) => {
        const sides = boxes.has(id) ? [down ? 'up' : 'down'] : ['up', 'down'];
        const near = sides.flatMap((side) => neighbours(links, id, side, x)).sort((a, b) => a - b);
        return near.length ? median(near) : x.get(id);
      });
      const packed = pack(wanted, order[index].map((id) => pitch.get(id)));
      order[index].forEach((id, at) => x.set(id, packed[at]));
    }
  }
  return new Map(group.map((id) => [id, { x: Math.round(x.get(id)), y: layerOf.get(id) * LAYER_GAP }]));
}

function neighbours(links, id, side, of) {
  return links.get(id)[side].map((other) => of.get(other))
    .filter((value) => value !== undefined).sort((left, right) => left - right);
}

function median(sorted) {
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Pool adjacent violators: the placement closest to what each box wanted that still keeps the
// row in its chosen order with every neighbouring pair at least a pitch apart. Anything greedier
// drags a whole row sideways to satisfy its leftmost member.
function pack(wanted, pitches) {
  const offset = [0];
  for (let i = 1; i < wanted.length; i += 1) offset.push(offset[i - 1] + pitches[i - 1]);
  const blocks = [];
  for (let i = 0; i < wanted.length; i += 1) {
    let block = { sum: wanted[i] - offset[i], count: 1 };
    while (blocks.length) {
      const previous = blocks[blocks.length - 1];
      if (previous.sum / previous.count <= block.sum / block.count) break;
      blocks.pop();
      block = { sum: previous.sum + block.sum, count: previous.count + block.count };
    }
    blocks.push(block);
  }
  const placed = [];
  for (const block of blocks) {
    for (let i = 0; i < block.count; i += 1) placed.push(block.sum / block.count);
  }
  return placed.map((value, i) => value + offset[i]);
}

function crossings(order, links) {
  let total = 0;
  for (let index = 0; index + 1 < order.length; index += 1) {
    const rank = new Map(order[index + 1].map((id, at) => [id, at]));
    const landings = [];
    for (const id of order[index]) {
      for (const to of links.get(id).down) if (rank.has(to)) landings.push(rank.get(to));
    }
    for (let i = 0; i < landings.length; i += 1) {
      for (let j = i + 1; j < landings.length; j += 1) if (landings[i] > landings[j]) total += 1;
    }
  }
  return total;
}

function retainDiskPositions(current, incoming) {
  const oldById = mapById(current.nodes);
  const positions = layout(incoming);
  for (const node of incoming.nodes) {
    const old = oldById.get(node.id);
    const position = old ? { x: old.x, y: old.y } : positions.get(node.id);
    node.x = position.x;
    node.y = position.y;
  }
}

let mutex = Promise.resolve();
function withMutex(work) {
  const next = mutex.then(work, work);
  mutex = next.catch(() => {});
  return next;
}

function configFromArgs(argv) {
  const options = { port: DEFAULT_PORT, cacheRoot: null, open: null, stop: false, show: false,
    browser: process.env.WHEELCHAIR_NO_BROWSER !== '1' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--port') {
      const port = Number(argv[++index]);
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid --port.');
      options.port = port;
    } else if (arg === '--cache-root') {
      if (!argv[index + 1]) throw new Error('Missing --cache-root value.');
      options.cacheRoot = path.resolve(argv[++index]);
    } else if (arg === '--open') {
      if (!argv[index + 1]) throw new Error('Missing --open value.');
      options.open = path.resolve(argv[++index]);
    } else if (arg === '--show') {
      if (!argv[index + 1]) throw new Error('Missing --show value.');
      options.open = path.resolve(argv[++index]);
      options.show = true;
    } else if (arg === '--no-browser') {
      options.browser = false;
    } else if (arg === '--stop') {
      options.stop = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (options.cacheRoot === null) options.cacheRoot = path.join(os.homedir(), '.cache', 'agent-graphs');
  return options;
}

function lockPath(config) { return path.join(config.cacheRoot, '.server'); }
function registeredPath(config) { return path.join(config.cacheRoot, '.registered'); }

function temporaryPath(filePath) {
  return path.join(path.dirname(filePath),
    `.${path.basename(filePath)}.${crypto.randomBytes(4).toString('hex')}.tmp`);
}

// Only ever call this under the global write mutex, and only for a graph file. See the call sites.
async function sweepStaleTemps(filePath) {
  const directory = path.dirname(filePath);
  const prefix = `.${path.basename(filePath)}.`;
  let names;
  try { names = await fsp.readdir(directory); }
  catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  await Promise.all(names.filter((name) => {
    const nonce = name.slice(prefix.length, -'.tmp'.length);
    return name.startsWith(prefix) && name.endsWith('.tmp') && /^[0-9a-f]{8}$/.test(nonce);
  }).map(async (name) => {
    try { await fsp.unlink(path.join(directory, name)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }));
}

// Cache-root files (.server, .registered) hold a credential and pass 0o600. Graph files are
// ordinary repo files that get committed, so they take the ordinary mode: an agent write should
// not silently re-permission a file the person also edits and diffs.
async function atomicWrite(filePath, bytes, mode = 0o644) {
    const temp = temporaryPath(filePath);
  let handle;
  try {
    handle = await fsp.open(temp, 'w', mode);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = null;
    await fsp.rename(temp, filePath);
    await fsp.chmod(filePath, mode);
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await fsp.unlink(temp).catch(() => {});
    throw error;
  }
}

async function loadRegistered(config) {
  try {
    const parsed = JSON.parse(await fsp.readFile(registeredPath(config), 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return {};
    throw error;
  }
}

async function saveRegistered(config, entries) {
  const ordered = {};
  for (const key of Object.keys(entries).sort()) ordered[key] = entries[key];
  await fsp.mkdir(config.cacheRoot, { recursive: true, mode: 0o700 });
  await atomicWrite(registeredPath(config), Buffer.from(`${JSON.stringify(ordered, null, 2)}\n`), 0o600);
}

async function pruneRegistered(config) {
  const entries = await loadRegistered(config);
  const cutoff = Date.now() - REGISTERED_MAX_AGE;
  for (const [key, value] of Object.entries(entries)) {
    if (!value || typeof value.added !== 'number' || value.added < cutoff) delete entries[key];
  }
  await saveRegistered(config, entries);
  return entries;
}

async function registerPath(config, graphPath, opened) {
  const entries = await loadRegistered(config);
  const prior = entries[graphPath];
  entries[graphPath] = { added: Date.now(), opened: Boolean(prior?.opened || opened) };
  await saveRegistered(config, entries);
}

async function ensureRegistered(config, graphPath) {
  const entries = await loadRegistered(config);
  if (Object.prototype.hasOwnProperty.call(entries, graphPath)) return true;
  const name = path.basename(graphPath, '.json');
  for (const candidate of Object.keys(entries)) {
    if (path.dirname(candidate) !== path.dirname(graphPath)) continue;
    try {
      const raw = await readRaw(candidate);
      if (raw.exists && parseDisk(raw).nodes.some((node) => node.graph === name)) {
        entries[graphPath] = { added: Date.now(), opened: false };
        await saveRegistered(config, entries);
        return true;
      }
    } catch {
      // A broken registered parent cannot derive a new writable child.
    }
  }
  return false;
}

async function unregisterDroppedSubtrees(config, droppedPaths) {
  const entries = await loadRegistered(config);
  const queue = [...new Set(droppedPaths)];
  while (queue.length) {
    const graphPath = queue.shift();
    if (!Object.prototype.hasOwnProperty.call(entries, graphPath) || entries[graphPath].opened) continue;
    let namedElsewhere = false;
    for (const other of Object.keys(entries)) {
      if (other === graphPath || path.dirname(other) !== path.dirname(graphPath)) continue;
      try {
        const raw = await readRaw(other);
        if (raw.exists && parseDisk(raw).nodes.some((node) => node.graph === path.basename(graphPath, '.json'))) {
          namedElsewhere = true; break;
        }
      } catch { /* broken graphs do not retain a descendant */ }
    }
    if (namedElsewhere) continue;
    const children = [];
    try {
      const raw = await readRaw(graphPath);
      if (raw.exists) children.push(...parseDisk(raw).nodes.filter((node) => node.graph)
        .map((node) => childPath(graphPath, node.graph)));
    } catch { /* no readable children to propagate */ }
    delete entries[graphPath];
    queue.push(...children);
  }
  await saveRegistered(config, entries);
}

function validPath(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || path.extname(value) !== '.json') {
    fail(400, 'bad-path', 'The path must be an absolute .json path.');
  }
  return path.resolve(value);
}

function tokenMatches(candidate, token) {
  if (typeof candidate !== 'string') return false;
  const expected = Buffer.from(token, 'utf8');
  const supplied = Buffer.from(candidate, 'utf8');
  return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

function sendError(response, error) {
  if (error instanceof ClientError) {
    sendJson(response, error.status, { error: error.code, detail: error.detail, ...error.extra });
  } else if (error instanceof InternalError) {
    sendJson(response, 500, { error: 'internal', detail: error.message });
  } else {
    sendJson(response, 500, { error: 'internal', detail: 'The server encountered an internal error.' });
  }
}

function requireGetToken(url, state) {
  if (!tokenMatches(url.searchParams.get('token'), state.lock.token)) {
    fail(401, 'bad-token', 'The graph token is missing or invalid.');
  }
}

function requirePutAuth(request, state) {
  if (!tokenMatches(request.headers['x-graph-token'], state.lock.token)) {
    fail(401, 'bad-token', 'The graph token is missing or invalid.');
  }
  if (request.headers.origin !== `http://127.0.0.1:${state.port}`) {
    fail(403, 'bad-origin', 'The request origin does not match this viewer.');
  }
}

async function requestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { fail(400, 'bad-body', 'The request body is not JSON.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.hash !== 'string' ||
      !body.graph || typeof body.graph !== 'object' || Array.isArray(body.graph)) {
    fail(400, 'bad-body', 'The request body needs a hash string and graph object.');
  }
  return body;
}

function structuralDifference(current, incoming) {
  const ids = [];
  for (const [oldEntries, newEntries, fields] of [
    [current.nodes, incoming.nodes, ['label', 'kind', 'exclusive', 'ref', 'note', 'graph']],
    [current.edges, incoming.edges, ['from', 'to', 'label', 'kind', 'value', 'inferred', 'note']],
  ]) {
    const oldById = mapById(oldEntries); const newById = mapById(newEntries);
    for (const id of new Set([...oldById.keys(), ...newById.keys()])) {
      const before = oldById.get(id); const after = newById.get(id);
      if (!before || !after || fields.some((field) => before[field] !== after[field])) ids.push(id);
    }
  }
  return ids;
}

function checkViewChanges(current, incoming) {
  const bad = structuralDifference(current, incoming);
  // The page deep-clones its graph before sending it back, so array identity would reject every
  // drag. Compare the canonical representation instead, which also ignores harmless member repeats.
  const sameGroups = JSON.stringify([...current.groups].sort(compareId).map(orderedGroup)) ===
    JSON.stringify([...incoming.groups].sort(compareId).map(orderedGroup));
  if (bad.length || current.schema !== incoming.schema || current.title !== incoming.title ||
      current.source !== incoming.source || current.source_detail !== incoming.source_detail ||
      current.explanation !== incoming.explanation || !sameGroups) {
    fail(422, 'structural-difference', 'The page changed graph structure.', { ids: bad });
  }
  let reversals = 0;
  for (const [oldEntries, newEntries] of [[current.nodes, incoming.nodes], [current.edges, incoming.edges]]) {
    const oldById = mapById(oldEntries);
    for (const entry of newEntries) {
      const old = oldById.get(entry.id);
      if (!ORIGINS.has(entry.origin)) fail(422, 'bad-origin-value', 'An origin is outside the allowed set.');
      const clearsWas = old.was !== null && entry.was === null;
      const keepsWas = entry.was === old.was;
      if (!(keepsWas || (clearsWas && entry.origin !== old.origin))) {
        fail(422, 'bad-was', 'The page may only clear was while changing origin.', { ids: [entry.id] });
      }
      if (entry.origin !== old.origin && old.origin !== 'proposed') reversals += 1;
    }
  }
  if (reversals > 1) fail(422, 'bulk-not-additive', 'A bulk verdict may reverse at most one existing verdict.');
}

async function handleGraphPut(request, response, url, state) {
  requirePutAuth(request, state);
  const graphPath = validPath(url.searchParams.get('path'));
  const body = await requestBody(request);
  const result = await withMutex(async () => {
    if (!await ensureRegistered(state.config, graphPath)) fail(403, 'not-registered', 'This graph path is not registered.');
    const raw = await readRaw(graphPath);
    if (body.hash !== raw.hash) fail(409, 'stale', 'The graph changed since it was read.', { hash: raw.hash });
    const incoming = validateGraph(body.graph);
    const current = raw.exists ? parseDisk(raw) : null;
    checkAgentWrite(current || { nodes: [], edges: [] }, incoming);
    if (current) {
      if (await hasContainmentCycle(graphPath, incoming)) {
        fail(422, 'container-cycle', 'The write would create a containment cycle.');
      }
      await checkOrphans(graphPath, current, incoming);
      retainDiskPositions(current, incoming);
    } else {
      if (await hasContainmentCycle(graphPath, incoming)) {
        fail(422, 'container-cycle', 'The write would create a containment cycle.');
      }
      const positions = layout(incoming);
      for (const node of incoming.nodes) {
        const position = positions.get(node.id);
        if (!position) {
          throw new InternalError(`Layout did not assign a position to node ${node.id}.`);
        }
        Object.assign(node, position);
      }
    }
    const bytes = canonicalBytes(incoming);
    // Swept here and not inside atomicWrite: this is the only write path the global mutex
    // serializes, so a matching sibling can only be an interrupted earlier write. `.registered`
    // is also written by a separate short-lived `--open` process holding no lock, and sweeping
    // there deleted that process's live temp and killed it on rename. It is also the only path
    // that matters — a graph lives in a committed directory, the cache root does not.
    await sweepStaleTemps(graphPath);
    await atomicWrite(graphPath, bytes);
    if (current) {
      const nextById = mapById(incoming.nodes);
      const dropped = current.nodes.filter((node) => node.graph && (!nextById.get(node.id) || nextById.get(node.id).graph !== node.graph))
        .map((node) => childPath(graphPath, node.graph));
      await unregisterDroppedSubtrees(state.config, dropped);
    }
    return { hash: hashBytes(bytes) };
  });
  sendJson(response, 200, result);
}

async function handleViewPut(request, response, url, state) {
  requirePutAuth(request, state);
  const graphPath = validPath(url.searchParams.get('path'));
  const body = await requestBody(request);
  const result = await withMutex(async () => {
    if (!await ensureRegistered(state.config, graphPath)) fail(403, 'not-registered', 'This graph path is not registered.');
    const raw = await readRaw(graphPath);
    if (!raw.exists) fail(404, 'not-found', 'The graph file does not exist.');
    if (body.hash !== raw.hash) fail(409, 'stale', 'The graph changed since it was read.', { hash: raw.hash });
    const current = parseDisk(raw);
    const incoming = validateGraph(body.graph, { checkOrigin: false });
    checkViewChanges(current, incoming);
    const bytes = canonicalBytes(incoming);
    // Swept here and not inside atomicWrite: this is the only write path the global mutex
    // serializes, so a matching sibling can only be an interrupted earlier write. `.registered`
    // is also written by a separate short-lived `--open` process holding no lock, and sweeping
    // there deleted that process's live temp and killed it on rename. It is also the only path
    // that matters — a graph lives in a committed directory, the cache root does not.
    await sweepStaleTemps(graphPath);
    await atomicWrite(graphPath, bytes);
    return { hash: hashBytes(bytes) };
  });
  sendJson(response, 200, result);
}

async function handleGetGraph(response, url, state) {
  requireGetToken(url, state);
  const graphPath = validPath(url.searchParams.get('path'));
  // The page polls this route once a second, so a recent read means a tab is already showing this
  // graph. That is what stops a redraw from stacking up browser windows: an open tab picks the new
  // version up on its own poll, and needs no help.
  state.watched.set(graphPath, Date.now());
  const allowed = await withMutex(() => ensureRegistered(state.config, graphPath));
  if (!allowed) fail(403, 'not-registered', 'This graph path is not registered.');
  const raw = await readRaw(graphPath);
  if (!raw.exists) fail(404, 'not-found', 'The graph file does not exist.');
  const graph = parseDisk(raw);
  const children = {};
  for (const name of new Set(graph.nodes.map((node) => node.graph).filter(Boolean))) {
    children[name] = (await readRaw(childPath(graphPath, name))).exists;
  }
  sendJson(response, 200, { hash: raw.hash, graph, children });
}

async function handleRoot(response, url, state) {
  requireGetToken(url, state);
  const graphPath = validPath(url.searchParams.get('path'));
  const allowed = await withMutex(() => ensureRegistered(state.config, graphPath));
  if (!allowed) fail(403, 'not-registered', 'This graph path is not registered.');
  try {
    const html = await fsp.readFile(path.join(__dirname, 'index.html'));
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end(html);
  } catch (error) {
    throw error;
  }
}

function whoami(port) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: '127.0.0.1', port, path: '/whoami', timeout: 500 }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (error) { reject(error); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('whoami timeout')));
    request.on('error', reject);
  });
}

function validLock(value) {
  return value && Number.isInteger(value.pid) && Number.isInteger(value.port) &&
    typeof value.token === 'string' && typeof value.start_id === 'string';
}

function claimLock(config, lock) {
  const target = lockPath(config);
  const temp = temporaryPath(target);
  let descriptor;
  let linking = false;
  try {
    descriptor = fs.openSync(temp, 'wx', 0o600);
    fs.writeFileSync(descriptor, `${JSON.stringify(lock, null, 2)}\n`);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    linking = true;
    fs.linkSync(temp, target);
    return true;
  } catch (error) {
    if (linking && error.code === 'EEXIST') return false;
    throw error;
  } finally {
    if (descriptor !== undefined && descriptor !== null) {
      try { fs.closeSync(descriptor); } catch { /* preserve the original write error */ }
    }
    try { fs.unlinkSync(temp); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

async function readLock(config) {
  try {
    const lock = JSON.parse(await fsp.readFile(lockPath(config), 'utf8'));
    return validLock(lock) ? lock : null;
  } catch { return null; }
}

async function existingServer(config) {
  let lock;
  try { lock = JSON.parse(await fsp.readFile(lockPath(config), 'utf8')); } catch { return { kind: 'corrupt' }; }
  if (!validLock(lock)) return { kind: 'corrupt' };
  try {
    const identity = await whoami(lock.port);
    if (identity.start_id === lock.start_id) return { kind: 'reuse', lock };
    return { kind: 'foreign', lock };
  } catch {
    try { process.kill(lock.pid, 0); }
    catch (error) {
      if (error.code === 'ESRCH') return { kind: 'stale', lock };
      return { kind: 'foreign', lock };
    }
    // The pid is alive and /whoami is silent. That is a live foreign process — or our own kind of
    // server in the window between claiming the lockfile and binding the port, which contains a
    // full read-and-write of the registered set and is milliseconds wide. Two starts at the same
    // instant land in it, and treating the loser's view as foreign killed it outright: the
    // documented producer sequence then reports that no URL was printed and exits. Give the holder
    // that window to answer before calling it foreign. A genuinely unrelated process stays silent
    // through it and still gets refused, one round of polling later.
    for (let attempt = 0; attempt < STARTUP_GRACE_ATTEMPTS; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, STARTUP_GRACE_INTERVAL_MS));
      try { process.kill(lock.pid, 0); } catch { return { kind: 'stale', lock }; }
      try {
        const identity = await whoami(lock.port);
        return identity.start_id === lock.start_id ? { kind: 'reuse', lock } : { kind: 'foreign', lock };
      } catch { /* still starting, or genuinely not ours */ }
    }
    return { kind: 'foreign', lock };
  }
}

function viewerUrl(lock, openPath) {
  const base = `http://127.0.0.1:${lock.port}`;
  return openPath ? `${base}/?path=${encodeURIComponent(openPath)}&token=${lock.token}` : base;
}

async function stopServer(config) {
  let lock;
  try { lock = JSON.parse(await fsp.readFile(lockPath(config), 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') { console.log('No server lockfile.'); return; }
    console.log('No usable server lockfile.'); return;
  }
  if (!validLock(lock)) { console.log('No usable server lockfile.'); return; }
  try {
    const identity = await whoami(lock.port);
    if (identity.start_id !== lock.start_id) throw new Error('start id mismatch');
    process.kill(lock.pid, 'SIGTERM');
    await fsp.unlink(lockPath(config)).catch(() => {});
    console.log('Server stopped.');
  } catch {
    console.error('Refused to stop a server not identified by this lockfile.');
    process.exitCode = 1;
  }
}

async function startServer(config) {
  await fsp.mkdir(config.cacheRoot, { recursive: true, mode: 0o700 });
  for (;;) {
    const lock = {
      pid: process.pid, port: config.port,
      token: crypto.randomBytes(32).toString('hex'),
      start_id: crypto.randomBytes(16).toString('hex'),
    };
    const claimed = claimLock(config, lock);
    if (!claimed) {
      const known = await existingServer(config);
      if (known.kind === 'reuse') return { reused: true, lock: known.lock };
      if (known.kind === 'foreign') throw new Error('Refused to adopt a lockfile owned by another live process.');
      await fsp.unlink(lockPath(config)).catch(() => {});
      continue;
    }
    await pruneRegistered(config);
    const state = { config, lock, port: config.port, server: null, watched: new Map() };
    const server = http.createServer(async (request, response) => {
      try {
        const url = new URL(request.url, `http://127.0.0.1:${state.port}`);
        if (request.method === 'GET' && url.pathname === '/whoami') {
          sendJson(response, 200, { start_id: state.lock.start_id }); return;
        }
        if (request.method === 'GET' && url.pathname === '/') { await handleRoot(response, url, state); return; }
        if (request.method === 'GET' && url.pathname === '/watching') {
          requireGetToken(url, state);
          const seen = state.watched.get(validPath(url.searchParams.get('path'))) || 0;
          sendJson(response, 200, { watched: Date.now() - seen < WATCHED_WINDOW_MS }); return;
        }
        if (request.method === 'GET' && url.pathname === '/graph') { await handleGetGraph(response, url, state); return; }
        if (request.method === 'PUT' && url.pathname === '/graph') { await handleGraphPut(request, response, url, state); return; }
        if (request.method === 'PUT' && url.pathname === '/view') { await handleViewPut(request, response, url, state); return; }
        fail(404, 'no-route', 'The requested route does not exist.');
      } catch (error) { sendError(response, error); }
    });
    state.server = server;
    server.on('error', async (error) => {
      await fsp.unlink(lockPath(config)).catch(() => {});
      console.error(error.message);
      process.exitCode = 1;
    });
    const close = async () => {
      await fsp.unlink(lockPath(config)).catch(() => {});
      server.close();
    };
    process.once('SIGTERM', close);
    process.once('SIGINT', close);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(config.port, '127.0.0.1', resolve);
    });
    return { reused: false, lock };
  }
}

// Ask the running server whether a page is already polling this graph. A redraw should not stack
// up browser windows — an open tab picks the new version up on its own poll within a second.
async function alreadyWatched(lock, graphPath) {
  try {
    const body = await new Promise((resolve, reject) => {
      const request = http.get(
        { host: '127.0.0.1', port: lock.port, path: `/watching?path=${encodeURIComponent(graphPath)}&token=${lock.token}`, timeout: 1500 },
        (response) => { let text = ''; response.on('data', (c) => { text += c; }); response.on('end', () => resolve(text)); });
      request.on('timeout', () => request.destroy(new Error('timeout')));
      request.on('error', reject);
    });
    return JSON.parse(body).watched === true;
  } catch { return false; }
}

// Best effort by design: a headless box, an SSH session or a machine with no handler should print
// the URL and carry on, never fail the write that just succeeded.
function launchBrowser(url) {
  const opener = process.env.WHEELCHAIR_BROWSER
    || (process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open');
  try {
    const child = spawn(opener, [url], { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
    return true;
  } catch { return false; }
}

async function main() {
  const config = configFromArgs(process.argv.slice(2));
  if (config.stop) { await stopServer(config); return; }
  if (config.open) {
    if (path.extname(config.open) !== '.json') throw new Error('--open must name a .json file.');
    await fsp.mkdir(path.dirname(config.open), { recursive: true });
    await registerPath(config, config.open, true);
  }
  const result = await startServer(config);
  const url = viewerUrl(result.lock, config.open);
  console.log(url);
  if (config.show && config.browser && !(await alreadyWatched(result.lock, config.open))) {
    launchBrowser(url);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
