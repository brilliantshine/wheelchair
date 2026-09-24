/*
Routes (all responses use Cache-Control: no-store):
  GET  /?token            token query      -> viewer/list.html
  GET  /?path&token       token query      -> viewer/index.html
  GET  /list?token        token query      -> { sessions, plans }
  GET  /plan?dir&token    token query      -> { dir, slug, files }
  GET  /docs?plan&token   token query      -> viewer/doc.html
  GET  /doc?plan&file&token token query    -> raw Markdown
  GET  /assets/list.js, /assets/doc.js     -> page scripts (no token)
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
      edge-missing-node, self-edge (ids), group-bad-name, group-missing-node, group-bad-shape (ids),
      group-missing-label (ids), group-missing-note (ids), group-hidden-text (ids),
      group-overlap (ids), explanation-missing-group, group-unreferenced, bad-origin-value,
      bad-was, container-bad-name, positional-claim,
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
const REGISTRY_PRUNE_INTERVAL_MS = 60 * 60 * 1000;
const REGISTER_SIGNATURE_WINDOW_MS = 60 * 1000;
const PAGE_CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
// A page polls every second, so anything read inside this window means a tab is live on that graph.
const WATCHED_WINDOW_MS = 4000;
// How long --open waits for the graph to be written before giving up on showing it.
const LAUNCH_WAIT_MS = 15000;
const STARTUP_GRACE_ATTEMPTS = 20;
const STARTUP_GRACE_INTERVAL_MS = 100;
const STOP_WAIT_MS = 5000;
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
const POSITIONAL_CLAIMS = [
  /\b(?:on|to|down|up|along) the (?:left|right)\b/i,
  /\bat the (?:top|bottom)\b/i,
  /\bthe (?:leftmost|rightmost|topmost|bottommost)\b/i,
  /\bdown the (?:middle|centre|center)\b/i,
  /\bthe (?:left|right|top|bottom|upper|lower|middle)(?:most)?[- ]?(?:hand )?(?:branch|arm|arms|box|boxes|node|nodes|column|cluster|group|half|side|path|row|one|ones|two|three|route)\b/i,
  /\bthe (?:\w+ )?(?:box|boxes|node|nodes|group|step|steps|arrow|arrows|answers?|options?) (?:above|below|beside)\b/i,
  /\bthe row (?:above|below)\b/i,
  /\b(?:above|below|beside|underneath) (?:it|them|that|these|those)\b/i,
  /\b(?:sits|sit|sitting|hangs|hang|hanging|runs|run|running|stands|stand|lands|land) (?:just )?(?:at|on|in|down|up)? ?the (?:top|bottom|left|right|middle|centre|center)\b/i,
  /\b(?:sits|sit|sitting|hangs|hang|hanging|stands|stand) (?:just )?(?:above|below|beside|under|underneath|next to)\b/i,
  /\bside by side\b/i,
  /\bthe same (?:row|column)\b/i,
  /\blisted (?:under|below|above) it\b/i,
];

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
  return {
    id: group.id, label: group.label, note: group.note, visible: group.visible,
    nodes: [...new Set(group.nodes)].sort(),
  };
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
    // `undefined`, not `??`: an omitted `visible` defaults to false, but an explicit null is a
    // non-boolean and is refused below. This is the one key in the schema where the two differ,
    // and deliberately — `label` and `note` carry null as a real value (required, on an invisible
    // group), so a group entry already distinguishes them, and a drawn-or-not flag that quietly
    // accepted a null would be the silent failure this server refuses everywhere else.
    const visible = raw.visible === undefined ? false : raw.visible;
    const label = raw.label ?? null;
    const note = raw.note ?? null;
    if (typeof visible !== 'boolean' ||
        !(label === null || typeof label === 'string') ||
        !(note === null || typeof note === 'string')) {
      fail(422, 'group-bad-shape', 'A group visible flag must be a boolean and its label and note strings or null.', { ids: [raw.id] });
    }
    if (visible) {
      if (label === null || label.length === 0) {
        fail(422, 'group-missing-label', 'A visible group must carry a label.', { ids: [raw.id] });
      }
      if (note === null || note.length === 0) {
        fail(422, 'group-missing-note', 'A visible group must carry a note.', { ids: [raw.id] });
      }
    } else if (label !== null || note !== null) {
      fail(422, 'group-hidden-text', 'An invisible group may not carry a label or a note.', { ids: [raw.id] });
    }
    return { id: raw.id, label, note, visible, nodes: raw.nodes };
  });
  // Two drawn regions sharing a box is the ambiguous membership the visible group exists to
  // remove; it also settles nesting, since a nested group shares every one of its members.
  // Invisible groups are unconstrained, exactly as they are today.
  const visibleMemberOwner = new Map();
  for (const group of [...groups].sort(compareId)) {
    if (!group.visible) continue;
    for (const nodeId of [...new Set(group.nodes)].sort()) {
      const owner = visibleMemberOwner.get(nodeId);
      if (owner !== undefined) {
        fail(422, 'group-overlap', 'Two visible groups name the same node.', { ids: [owner, group.id] });
      }
      visibleMemberOwner.set(nodeId, group.id);
    }
  }
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
    if (edge.from === edge.to) {
      fail(422, 'self-edge', 'An edge may not connect a node back to itself.', { ids: [edge.id] });
    }
  }
  // A group exists only to make a specific passage of the account point at graph boxes. Check
  // dangling links, and require invisible groups to be referenced because they have no other way
  // to be seen.
  const referencedGroups = new Set(Array.from((input.explanation ?? '').matchAll(GROUP_REFERENCE),
    (match) => match[2]));
  for (const id of referencedGroups) {
    if (!groupIds.has(id)) {
      fail(422, 'explanation-missing-group', 'The explanation references a group that is not present.');
    }
  }
  for (const group of groups) {
    if (group.visible) continue;
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

// Text an agent quotes is exempt, so a graph about this rule can quote the phrase the rule
// forbids. Three delimiters only: the backtick and the straight double quote, each pairing with
// itself, and the typographic pair. Not the apostrophe in either spelling — U+2019 is the
// typographic apostrophe, so both forms are indistinguishable from a possessive, and exempting
// what sits between any two of them would exempt most sentences. An unpaired delimiter masks
// nothing and the scan resumes at the next character: masking to the end of the string instead
// would let one stray quote exempt the rest of an explanation, a whole-check bypass reachable by
// a typo. The mask preserves length rather than deleting, which is what lets a match offset index
// the original text, so the refusal can quote what the agent actually wrote — and it means a
// phrase can never match *across* a quoted span, so quoting interrupts a phrase consistently
// instead of the answer depending on whether the quote happened to sit between two spaces.
function maskQuotedSpans(text) {
  const masked = text.split('');
  for (let index = 0; index < text.length;) {
    const opener = text[index];
    const closer = opener === '`' || opener === '"' ? opener : opener === '“' ? '”' : null;
    if (!closer) { index += 1; continue; }
    const end = text.indexOf(closer, index + 1);
    if (end < 0) { index += 1; continue; }
    for (let maskedIndex = index; maskedIndex <= end; maskedIndex += 1) masked[maskedIndex] = '\0';
    index = end + 1;
  }
  return masked.join('');
}

function positionalClaim(text) {
  const masked = maskQuotedSpans(text);
  for (const pattern of POSITIONAL_CLAIMS) {
    const match = pattern.exec(masked);
    if (match) return match;
  }
  return null;
}

// An agent has no idea where anything is: it is forbidden from sending x/y and the layout runs
// after the write, so a sentence claiming a position is not a vague reference but an invented one.
// The list is a reflex-catcher rather than a proof — it reads the account and a group's own name
// and sentence, never a node's or an edge's, because measured over every committed graph those
// two fields cost more false catches than they caught real claims.
function checkAgentProse(incoming) {
  const check = (text, ids) => {
    if (typeof text !== 'string' || text.length === 0) return;
    const match = positionalClaim(text);
    if (!match) return;
    const phrase = text.slice(match.index, match.index + match[0].length);
    fail(422, 'positional-claim', `The agent account makes the positional claim ${JSON.stringify(phrase)}.`,
      ids ? { ids } : undefined);
  };
  check(incoming.explanation);
  for (const group of [...incoming.groups].sort(compareId)) {
    check(group.label, [group.id]);
    check(group.note, [group.id]);
  }
}

// Agent preservation is deliberately outside HTTP handling: this is the format contract.
// Everything an agent's PUT /graph is forbidden to do, in one place:
//   - it may not grant itself a verdict (agent-verdict),
//   - it must preserve every rejected entry verbatim and every agreed entry either verbatim or
//     reset to proposed with was: "agreed" (preservation-rejected, preservation-agreed),
//   - it may write `was` only as part of a reset, and may never clear a landed one (bad-was),
//   - it may not claim where anything sits (positional-claim, above).
// Removing an entry already reset to proposed is allowed: that is the second of the two visible
// steps a superseded flow takes, instead of vanishing in one.
//
// The prose check belongs here and never in validateGraph, which parseDisk runs on every read:
// nine committed graphs already carry a position word, and refusing them there would make them
// unopenable, undraggable and unusable as containment parents.
function checkAgentWrite(current, incoming) {
  checkAgentProse(incoming);
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

async function hasContainmentCycle(rootPath, incoming, config) {
  const visiting = new Set();
  const seen = new Set();
  async function walk(filePath) {
    if (visiting.has(filePath)) return true;
    if (seen.has(filePath)) return false;
    seen.add(filePath); visiting.add(filePath);
    const safePath = filePath === rootPath ? rootPath : await validGraphPath(config, filePath);
    const graph = safePath === rootPath ? incoming : await graphFromFile(safePath);
    if (graph) {
      for (const node of graph.nodes) {
        if (node.graph && await walk(childPath(safePath, node.graph))) return true;
      }
    }
    visiting.delete(filePath);
    return false;
  }
  return walk(rootPath);
}

async function subtreeHasVerdict(rootPath, config) {
  const seen = new Set();
  async function walk(filePath) {
    if (seen.has(filePath)) return false;
    seen.add(filePath);
    const safePath = await validGraphPath(config, filePath);
    const raw = await readRaw(safePath);
    if (!raw.exists) return false;
    let graph;
    try {
      graph = parseDisk(raw);
    } catch {
      // A child that will not parse cannot be shown to hold no verdicts, and this walk exists to
      // stop verdict loss. Surface the corruption where it matters rather than orphaning the file.
      fail(422, 'container-unreadable-child',
        `The child graph ${safePath} does not parse, so its verdicts cannot be checked.`);
    }
    if ([...graph.nodes, ...graph.edges].some((entry) =>
      entry.origin === 'agreed' || entry.origin === 'rejected')) return true;
    for (const node of graph.nodes) {
      if (node.graph && await walk(childPath(safePath, node.graph))) return true;
    }
    return false;
  }
  return walk(rootPath);
}

async function checkOrphans(graphPath, current, incoming, config) {
  const nextById = mapById(incoming.nodes);
  for (const oldNode of current.nodes) {
    if (!oldNode.graph) continue;
    const next = nextById.get(oldNode.id);
    if (!next || next.graph !== oldNode.graph) {
      if (await subtreeHasVerdict(childPath(graphPath, oldNode.graph), config)) {
        fail(422, 'container-orphan', 'Removing or retargeting this container would orphan a verdict.',
          { ids: [oldNode.id] });
      }
    }
  }
}

// The first render is the one Collin reads before he has dragged anything, so the layout is worth
// more than a grid: it is a small Sugiyama pass over units, whose rows grow for the tallest thing
// standing on them. A drawn group first lays out its members, then takes one slot among the other
// units, then lets those members reorder within their settled rows by the arrows that cross its
// boundary. The server reserves 116 for a box's tallest possible page height (NODE_LABEL_MAX_LINES
// in viewer/index.html); the two files share no module, so the browser suite measures a real
// five-line box against a real layout and is what actually catches their constants drifting.
const LAYER_GAP = 140;
const NODE_PITCH = 260;
// Copied from protocol/graphs.md; viewer/index.html holds the other copy of the first two.
const GROUP_PAD = 24;      // clearance on the left, right and bottom
const GROUP_HEADER = 38;   // extra clearance above, holding the name and the note line
const GROUP_NODE_W = 200;
const GROUP_NODE_H = 116;
// A bend point is not drawn — the viewer draws every edge as one straight line — but reserving it
// a slot keeps a row from closing over the diagonal that has to pass through it.
const BEND_PITCH = 160;
const COMPONENT_GAP = 200;
const UNIT_GUTTER = NODE_PITCH - GROUP_NODE_W;
const ROW_CLEARANCE = LAYER_GAP - GROUP_NODE_H;

function layout(graph, sizeOf = () => ({ w: GROUP_NODE_W, h: GROUP_NODE_H }), separateComponents = true) {
  const ids = graph.nodes.map((node) => node.id).sort();
  if (!ids.length) return { positions: new Map(), order: [], links: new Map() };
  // Sorted and deduplicated so the same graph lays out the same way however its arrays happen to
  // be ordered.
  const pairs = [...new Set(graph.edges
    .map((edge) => JSON.stringify([edge.from, edge.to])))].sort().map((key) => JSON.parse(key));

  const acyclic = breakCycles(ids, pairs);
  const layer = layerByLongestPath(ids, acyclic);
  const parts = components(ids, pairs).map((group) => {
    const top = Math.min(...group.map((id) => layer.get(id)));
    return { group, local: new Map(group.map((id) => [id, layer.get(id) - top])) };
  });
  const heights = [];
  for (const { group, local } of parts) for (const id of group) {
    const row = local.get(id);
    heights[row] = Math.max(heights[row] || 0, sizeOf(id).h);
  }
  const origins = [0];
  for (let row = 1; row < heights.length; row += 1) origins[row] = origins[row - 1] + heights[row - 1] + ROW_CLEARANCE;
  const positions = new Map();
  const order = Array.from({ length: origins.length }, () => []);
  const links = new Map();
  let cursor = 0;
  for (const { group, local } of parts) {
    const placed = placeComponent(group, local, acyclic.filter(([from, to]) => local.has(from) && local.has(to)), sizeOf, origins);
    let min = Infinity, right = -Infinity;
    for (const [id, point] of placed.positions) {
      min = Math.min(min, point.x); right = Math.max(right, point.x + sizeOf(id).w);
    }
    for (const [id, point] of placed.positions) positions.set(id, { x: point.x - min + cursor, y: point.y });
    placed.order.forEach((row, index) => order[index].push(...row));
    for (const [id, link] of placed.links) links.set(id, link);
    cursor += right - min + UNIT_GUTTER + (separateComponents ? COMPONENT_GAP : 0);
  }
  return { positions, order, links };
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

function placeComponent(group, layerOf, edges, sizeOf, origins) {
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
  for (const row of rows) for (const id of row) pitch.set(id, boxes.has(id) ? sizeOf(id).w + UNIT_GUTTER : BEND_PITCH);
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
  return {
    positions: new Map(group.map((id) => [id, { x: Math.round(x.get(id)), y: origins[layerOf.get(id)] }])),
    order,
    links,
  };
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

function canonicalGroupNodes(group) { return [...new Set(group.nodes)].sort(); }

function groupRect(group, nodes) {
  const members = canonicalGroupNodes(group).map((id) => nodes.get(id));
  const minX = Math.min(...members.map((node) => node.x));
  const maxX = Math.max(...members.map((node) => node.x + GROUP_NODE_W));
  const minY = Math.min(...members.map((node) => node.y));
  const maxY = Math.max(...members.map((node) => node.y + GROUP_NODE_H));
  return {
    x: minX - GROUP_PAD,
    y: minY - GROUP_PAD - GROUP_HEADER,
    w: maxX - minX + 2 * GROUP_PAD,
    h: maxY - minY + 2 * GROUP_PAD + GROUP_HEADER,
  };
}

function positionGraph(incoming) {
  const nodes = mapById(incoming.nodes);
  const visible = incoming.groups.filter((group) => group.visible).sort(compareId);
  const grouped = new Set(visible.flatMap(canonicalGroupNodes));
  const inner = new Map();
  for (const group of visible) {
    const members = canonicalGroupNodes(group); const memberSet = new Set(members);
    const placed = layout({ nodes: members.map((id) => ({ id })),
      edges: incoming.edges.filter((edge) => memberSet.has(edge.from) && memberSet.has(edge.to)) },
    () => ({ w: GROUP_NODE_W, h: GROUP_NODE_H }), false);
    const relative = new Map(members.map((id) => [id, { id, ...placed.positions.get(id) }]));
    inner.set(group.id, { ...placed, rect: groupRect(group, relative) });
  }

  const unitOf = new Map();
  for (const group of visible) for (const id of canonicalGroupNodes(group)) unitOf.set(id, `group:${group.id}`);
  for (const node of incoming.nodes) if (!unitOf.has(node.id)) unitOf.set(node.id, `node:${node.id}`);
  const sizes = new Map();
  for (const group of visible) sizes.set(`group:${group.id}`, inner.get(group.id).rect);
  for (const node of incoming.nodes) if (!grouped.has(node.id)) sizes.set(`node:${node.id}`, { w: GROUP_NODE_W, h: GROUP_NODE_H });
  const pairs = [...new Set(incoming.edges.map((edge) => JSON.stringify([unitOf.get(edge.from), unitOf.get(edge.to)])))].map((key) => JSON.parse(key))
    .filter(([from, to]) => from !== to).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const outer = layout({ nodes: [...sizes.keys()].sort().map((id) => ({ id })),
    edges: pairs.map(([from, to]) => ({ from, to })) }, (id) => sizes.get(id), true);
  for (const group of visible) {
    const data = inner.get(group.id); const at = outer.positions.get(`group:${group.id}`);
    for (const id of canonicalGroupNodes(group)) {
      const point = data.positions.get(id);
      Object.assign(nodes.get(id), { x: Math.round(at.x + point.x - data.rect.x), y: Math.round(at.y + point.y - data.rect.y) });
    }
  }
  for (const node of incoming.nodes) if (!grouped.has(node.id)) Object.assign(node, outer.positions.get(`node:${node.id}`));
  reorderGroupedRows(incoming, visible, inner, nodes);
}

function reorderGroupedRows(incoming, visible, inner, nodes) {
  const snapshot = new Map(incoming.nodes.map((node) => [node.id, node.x + GROUP_NODE_W / 2]));
  const pairs = [...new Set(incoming.edges.map((edge) => JSON.stringify([edge.from, edge.to])))].sort().map(JSON.parse);
  for (const group of visible) {
    const data = inner.get(group.id); const members = new Set(canonicalGroupNodes(group));
    const centre = (id) => members.has(id) ? nodes.get(id).x + GROUP_NODE_W / 2 : snapshot.get(id);
    const externalCrossings = (order) => order.reduce((total, row) => {
      const landings = [];
      for (const id of row) {
        if (!members.has(id)) continue;
        for (const [from, to] of pairs) {
          const other = from === id ? to : to === id ? from : null;
          if (other && !members.has(other)) landings.push(snapshot.get(other));
        }
      }
      for (let i = 0; i < landings.length; i += 1) for (let j = i + 1; j < landings.length; j += 1) {
        if (landings[i] > landings[j]) total += 1;
      }
      return total;
    }, 0);
    for (let rowIndex = 0; rowIndex < data.order.length; rowIndex += 1) {
      const row = data.order[rowIndex];
      const was = new Map(row.map((id, index) => [id, index]));
      const movable = row.filter((id) => members.has(id) && pairs.some(([from, to]) => from === id || to === id));
      if (movable.length < 2) continue;
      const key = new Map(movable.map((id) => {
        const near = pairs.flatMap(([from, to]) => from === id ? [centre(to)] : to === id ? [centre(from)] : []).sort((a, b) => a - b);
        return [id, median(near)];
      }));
      const proposedMembers = movable.slice().sort((left, right) => key.get(left) - key.get(right) || was.get(left) - was.get(right));
      const candidate = data.order.map((item) => item.slice()); let next = 0;
      candidate[rowIndex] = row.map((id) => movable.includes(id) ? proposedMembers[next++] : id);
      if (crossings(candidate, data.links) + externalCrossings(candidate) > crossings(data.order, data.links) + externalCrossings(data.order)) continue;
      const slots = movable.map((id) => nodes.get(id).x);
      proposedMembers.forEach((id, index) => { nodes.get(id).x = slots[index]; });
      data.order = candidate;
    }
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
    browser: process.env.WHEELCHAIR_NO_BROWSER !== '1', service: false, rotateToken: false,
    url: false, ifStale: false, registerPlan: null };
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
    } else if (arg === '--if-stale') {
      options.ifStale = true;
    } else if (arg === '--service') {
      options.service = true;
      options.browser = false;
    } else if (arg === '--rotate-token') {
      options.rotateToken = true;
    } else if (arg === '--url') {
      options.url = true;
    } else if (arg === '--register-plan') {
      if (!argv[index + 1]) throw new Error('Missing --register-plan value.');
      options.registerPlan = path.resolve(argv[++index]);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (options.cacheRoot === null) options.cacheRoot = path.join(os.homedir(), '.cache', 'agent-graphs');
  return options;
}

function lockPath(config) { return path.join(config.cacheRoot, '.server'); }
function tokenPath(config) { return path.join(config.cacheRoot, '.token'); }
function servingPath(config) { return path.join(config.cacheRoot, '.serving'); }
function registeredPath(config) { return path.join(config.cacheRoot, '.registered'); }
function plansPath(config) { return path.join(config.cacheRoot, '.plans'); }

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
  return loadRegistry(registeredPath(config));
}

async function loadPlans(config) { return loadRegistry(plansPath(config)); }

async function loadRegistry(filePath) {
  try {
    const parsed = JSON.parse(await fsp.readFile(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return {};
    throw error;
  }
}

async function saveRegistered(config, entries) {
  return saveRegistry(config, registeredPath(config), entries);
}

async function savePlans(config, entries) { return saveRegistry(config, plansPath(config), entries); }

async function saveRegistry(config, filePath, entries) {
  const ordered = {};
  for (const key of Object.keys(entries).sort()) ordered[key] = entries[key];
  await fsp.mkdir(config.cacheRoot, { recursive: true, mode: 0o700 });
  await atomicWrite(filePath, Buffer.from(`${JSON.stringify(ordered, null, 2)}\n`), 0o600);
}

async function newestPlanMtime(planPath) {
  let newest = 0;
  async function walk(directory) {
    let entries;
    try { entries = await fsp.readdir(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(candidate);
      else if (entry.isFile() && entry.name.endsWith('.md')) {
        try { newest = Math.max(newest, (await fsp.stat(candidate)).mtimeMs); } catch { /* raced removal */ }
      }
    }
  }
  await walk(planPath); return newest;
}

async function pathMtime(filePath) {
  try { return (await fsp.stat(filePath)).mtimeMs; } catch { return 0; }
}

async function pruneRegistry(config, filePath, entries, mtime) {
  const cutoff = Date.now() - REGISTERED_MAX_AGE;
  let removed = false;
  for (const [key, value] of Object.entries(entries)) {
    const fresh = Math.max(Number(value?.added) || 0, await mtime(key));
    if (!value || fresh < cutoff) { delete entries[key]; removed = true; }
  }
  if (removed) await saveRegistry(config, filePath, entries);
  return { entries, removed };
}

// Task 3 calls this while building /list.  It is deliberately stateful so a five-second poll
// cannot turn registry retention into a five-second pair of rewrites.
async function pruneRegistries(config, state, { force = false } = {}) {
  if (!force && state.lastRegistryPrune && Date.now() - state.lastRegistryPrune < REGISTRY_PRUNE_INTERVAL_MS) return;
  const graphs = await loadRegistered(config); const plans = await loadPlans(config);
  await pruneRegistry(config, registeredPath(config), graphs, pathMtime);
  await pruneRegistry(config, plansPath(config), plans, newestPlanMtime);
  state.lastRegistryPrune = Date.now();
}

async function registerPath(config, graphPath, opened, session = null, harness = 'other') {
  const entries = await loadRegistered(config);
  const prior = entries[graphPath];
  entries[graphPath] = { added: Date.now(), opened: Boolean(prior?.opened || opened), session, harness };
  await saveRegistered(config, entries);
}

async function registerPlanPath(config, planPath, session, harness) {
  const entries = await loadPlans(config);
  entries[planPath] = { added: Date.now(), session, harness };
  await savePlans(config, entries);
}

async function ensureRegistered(config, graphPath) {
  const entries = await loadRegistered(config);
  if (Object.prototype.hasOwnProperty.call(entries, graphPath)) return true;
  const name = path.basename(graphPath, '.json');
  for (const candidate of Object.keys(entries)) {
    if (path.dirname(candidate) !== path.dirname(graphPath)) continue;
    try {
      const raw = await readRaw(await validGraphPath(config, candidate));
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

function inside(directory, candidate) {
  const relative = path.relative(directory, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function isPlanGraphsDirectory(directory) {
  const plan = path.dirname(directory);
  return path.basename(directory) === 'graphs' && BARE_NAME.test(path.basename(plan)) &&
    path.basename(path.dirname(plan)) === 'plans' && path.basename(path.dirname(path.dirname(plan))) === 'docs';
}

async function validGraphPath(config, value, { createParent = false } = {}) {
  const lexical = validPath(value);
  let actual;
  try { actual = await fsp.realpath(lexical); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    let parent;
    try {
      if (createParent && inside(path.resolve(config.cacheRoot), lexical)) {
        await fsp.mkdir(path.dirname(lexical), { recursive: true });
      }
      const lexicalParent = path.dirname(lexical);
      if (createParent && isPlanGraphsDirectory(lexicalParent)) {
        const plan = await validPlanPath(path.dirname(lexicalParent));
        await fsp.mkdir(path.join(plan, 'graphs'), { recursive: true });
        parent = await fsp.realpath(path.join(plan, 'graphs'));
      } else {
        parent = await fsp.realpath(lexicalParent);
      }
    }
    catch { fail(400, 'bad-path', 'The graph path has no real parent directory.'); }
    actual = path.join(parent, path.basename(lexical));
  }
  let cache;
  try { cache = await fsp.realpath(config.cacheRoot); }
  catch { cache = path.resolve(config.cacheRoot); }
  const parent = path.dirname(actual);
  if (!inside(cache, actual) && !isPlanGraphsDirectory(parent)) {
    fail(400, 'bad-path', 'The graph path is outside a plan graphs directory or the cache root.');
  }
  return actual;
}

async function validPlanPath(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) fail(400, 'bad-path', 'The plan path must be absolute.');
  let actual;
  try {
    const stat = await fsp.stat(value);
    if (!stat.isDirectory()) fail(400, 'bad-path', 'The plan path must be a directory.');
    actual = await fsp.realpath(value);
  } catch (error) {
    if (error instanceof ClientError) throw error;
    fail(400, 'bad-path', 'The plan path must be an existing directory.');
  }
  if (!BARE_NAME.test(path.basename(actual)) || path.basename(path.dirname(actual)) !== 'plans' ||
      path.basename(path.dirname(path.dirname(actual))) !== 'docs') {
    fail(400, 'bad-path', 'The plan path must be under docs/plans.');
  }
  return actual;
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

function sendFile(response, status, bytes, contentType, extraHeaders = {}) {
  response.writeHead(status, { 'content-type': contentType, 'cache-control': 'no-store', ...extraHeaders });
  response.end(bytes);
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
  if (request.headers.origin !== `http://127.0.0.1:${state.port}` && request.headers.origin !== state.servedOrigin) {
    fail(403, 'bad-origin', 'The request origin does not match this viewer.');
  }
}

function requireOrigin(request, state) {
  if (request.headers.origin !== `http://127.0.0.1:${state.port}` && request.headers.origin !== state.servedOrigin) {
    fail(403, 'bad-origin', 'The request origin does not match this viewer.');
  }
}

function signatureMatches(signature, token, signed) {
  return tokenMatches(signature, crypto.createHmac('sha256', token).update(signed).digest('hex'));
}

function requireSignedAuth(request, state, signed) {
  const timestamp = request.headers['x-graph-timestamp'];
  const numeric = typeof timestamp === 'string' && /^\d+$/.test(timestamp) ? Number(timestamp) : NaN;
  if (!Number.isSafeInteger(numeric) || Math.abs(Date.now() - numeric) > REGISTER_SIGNATURE_WINDOW_MS ||
      !signatureMatches(request.headers['x-graph-signature'], state.lock.token, signed)) {
    fail(401, 'bad-signature', 'The registration signature is missing, invalid, or expired.');
  }
  requireOrigin(request, state);
}

async function rawRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function registrationBody(request, state) {
  const bytes = await rawRequestBody(request);
  const timestamp = request.headers['x-graph-timestamp'];
  requireSignedAuth(request, state, Buffer.concat([Buffer.from(`${timestamp}\n`), bytes]));
  let body;
  try { body = JSON.parse(bytes.toString('utf8')); } catch { fail(400, 'bad-body', 'The request body is not JSON.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      !['graph', 'plan'].includes(body.kind) || typeof body.path !== 'string' ||
      !(body.session === null || typeof body.session === 'string') ||
      !['claude', 'codex', 'other'].includes(body.harness) ||
      (body.kind === 'graph' && typeof body.opened !== 'boolean')) {
    fail(400, 'bad-body', 'The registration body has the wrong shape.');
  }
  return body;
}

async function handleRegister(request, response, state) {
  const body = await registrationBody(request, state);
  await withMutex(async () => {
    if (body.kind === 'graph') {
      const graphPath = await validGraphPath(state.config, body.path);
      await registerPath(state.config, graphPath, body.opened, body.session, body.harness);
    } else {
      const planPath = await validPlanPath(body.path);
      await registerPlanPath(state.config, planPath, body.session, body.harness);
    }
  });
  sendJson(response, 200, { ok: true });
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
  const graphPath = await validGraphPath(state.config, url.searchParams.get('path'));
  const body = await requestBody(request);
  const result = await withMutex(async () => {
    if (!await ensureRegistered(state.config, graphPath)) fail(403, 'not-registered', 'This graph path is not registered.');
    const raw = await readRaw(graphPath);
    if (body.hash !== raw.hash) fail(409, 'stale', 'The graph changed since it was read.', { hash: raw.hash });
    const incoming = validateGraph(body.graph);
    const current = raw.exists ? parseDisk(raw) : null;
    checkAgentWrite(current || { nodes: [], edges: [] }, incoming);
    if (current) {
      if (await hasContainmentCycle(graphPath, incoming, state.config)) {
        fail(422, 'container-cycle', 'The write would create a containment cycle.');
      }
      await checkOrphans(graphPath, current, incoming, state.config);
    } else {
      if (await hasContainmentCycle(graphPath, incoming, state.config)) {
        fail(422, 'container-cycle', 'The write would create a containment cycle.');
      }
    }
    positionGraph(incoming);
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
  const graphPath = await validGraphPath(state.config, url.searchParams.get('path'));
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
  const graphPath = await validGraphPath(state.config, url.searchParams.get('path'));
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
    const child = await validGraphPath(state.config, childPath(graphPath, name));
    children[name] = (await readRaw(child)).exists;
  }
  sendJson(response, 200, { hash: raw.hash, graph, children });
}

async function registeredPlanPath(config, value) {
  let actual;
  try {
    if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error('not an absolute path');
    const info = await fsp.stat(value);
    if (!info.isDirectory()) throw new Error('not a directory');
    actual = await fsp.realpath(value);
  } catch {
    fail(403, 'not-registered', 'This plan directory is not registered.');
  }
  const plans = await loadPlans(config);
  if (!Object.prototype.hasOwnProperty.call(plans, actual)) {
    fail(403, 'not-registered', 'This plan directory is not registered.');
  }
  // A registry left behind by a manually edited file must not broaden what this reader can
  // reach. Normal registration has already made this check, but it is intentionally repeated
  // for every document read.
  try { return await validPlanPath(actual); }
  catch { fail(403, 'not-registered', 'This plan directory is not registered.'); }
}

function byteCompare(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

async function planFiles(planPath) {
  const files = [];
  async function walk(directory) {
    let entries;
    try { entries = await fsp.readdir(directory, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(candidate);
      else if (entry.isFile() && entry.name.endsWith('.md')) files.push(path.relative(planPath, candidate));
    }
  }
  await walk(planPath);
  return files.sort(byteCompare);
}

async function documentPath(planPath, file) {
  if (typeof file !== 'string' || file.length === 0 || path.isAbsolute(file) || !file.endsWith('.md') ||
      file.split(/[\\/]+/).includes('..')) {
    fail(404, 'not-found', 'The document file does not exist.');
  }
  const lexical = path.resolve(planPath, file);
  if (!inside(planPath, lexical)) fail(404, 'not-found', 'The document file does not exist.');
  let actual;
  try {
    actual = await fsp.realpath(lexical);
    const info = await fsp.stat(actual);
    if (!info.isFile() || !actual.endsWith('.md') || !inside(planPath, actual)) {
      fail(404, 'not-found', 'The document file does not exist.');
    }
  } catch (error) {
    if (error instanceof ClientError) throw error;
    fail(404, 'not-found', 'The document file does not exist.');
  }
  return actual;
}

async function tmuxSessions() {
  return new Promise((resolve) => {
    let output = '';
    let child;
    try { child = spawn('tmux', ['list-sessions', '-F', '#S'], { stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch { resolve(new Set()); return; }
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.once('error', () => resolve(new Set()));
    child.once('close', (code) => {
      if (code !== 0) { resolve(new Set()); return; }
      resolve(new Set(output.split(/\r?\n/).filter(Boolean)));
    });
  });
}

function attachCommand(name) {
  return `tmux attach -t '${name.replace(/'/g, "'\\''")}'`;
}

async function graphGroups(config) {
  const entries = await loadRegistered(config);
  const groups = new Map();
  for (const [registeredPath, entry] of Object.entries(entries)) {
    if (!entry?.opened) continue;
    let graphPath;
    let info;
    try {
      graphPath = await validGraphPath(config, registeredPath);
      info = await fsp.stat(graphPath);
      if (!info.isFile()) continue;
    } catch { continue; }
    let title = path.basename(graphPath);
    try {
      const graph = JSON.parse(await fsp.readFile(graphPath, 'utf8'));
      if (typeof graph?.title === 'string') title = graph.title;
    } catch { /* an unreadable graph still belongs in the list by its file name */ }
    const session = typeof entry.session === 'string' ? entry.session : null;
    const graph = { path: graphPath, title, harness: ['claude', 'codex', 'other'].includes(entry.harness) ? entry.harness : 'other', modified: info.mtimeMs };
    if (!groups.has(session)) groups.set(session, []);
    groups.get(session).push(graph);
  }
  const running = await tmuxSessions();
  return [...groups.entries()].map(([name, graphs]) => {
    graphs.sort((left, right) => right.modified - left.modified || byteCompare(left.path, right.path));
    const alive = name !== null && running.has(name);
    return { name, running: alive, attach: alive ? attachCommand(name) : null, graphs };
  }).sort((left, right) => right.graphs[0].modified - left.graphs[0].modified ||
    byteCompare(left.name === null ? '' : left.name, right.name === null ? '' : right.name));
}

async function planSummaries(config) {
  const entries = await loadPlans(config);
  const plans = [];
  for (const [registeredPath, entry] of Object.entries(entries)) {
    let planPath;
    try { planPath = await validPlanPath(registeredPath); }
    catch { continue; }
    let status = null;
    try {
      const bytes = await fsp.readFile(path.join(planPath, 'PLAN.md'), 'utf8');
      const frontmatter = bytes.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      const line = frontmatter?.[1].match(/^status:\s*(.*)$/m);
      if (line) status = line[1].replace(/\s*#.*$/, '').trim();
    } catch { /* A plan without PLAN.md reports null status. */ }
    plans.push({ dir: planPath, slug: path.basename(planPath),
      repo: path.basename(path.dirname(path.dirname(path.dirname(planPath)))), status,
      session: typeof entry?.session === 'string' ? entry.session : null,
      harness: ['claude', 'codex', 'other'].includes(entry?.harness) ? entry.harness : 'other',
      added: Number(entry?.added) || 0 });
  }
  return plans.sort((left, right) => right.added - left.added || byteCompare(left.dir, right.dir));
}

async function handleList(response, url, state) {
  requireGetToken(url, state);
  const body = await withMutex(async () => {
    await pruneRegistries(state.config, state);
    return { sessions: await graphGroups(state.config), plans: await planSummaries(state.config) };
  });
  sendJson(response, 200, body);
}

async function handlePlan(response, url, state) {
  requireGetToken(url, state);
  const planPath = await registeredPlanPath(state.config, url.searchParams.get('dir'));
  sendJson(response, 200, { dir: planPath, slug: path.basename(planPath), files: await planFiles(planPath) });
}

async function handleDoc(response, url, state) {
  requireGetToken(url, state);
  const planPath = await registeredPlanPath(state.config, url.searchParams.get('plan'));
  const filePath = await documentPath(planPath, url.searchParams.get('file'));
  try { sendFile(response, 200, await fsp.readFile(filePath), 'text/markdown; charset=utf-8'); }
  catch { fail(404, 'not-found', 'The document file does not exist.'); }
}

async function servePage(response, name, csp = false) {
  const html = await fsp.readFile(path.join(__dirname, name));
  sendFile(response, 200, html, 'text/html; charset=utf-8', csp ? { 'content-security-policy': PAGE_CSP } : {});
}

async function handleDocs(response, url, state) {
  requireGetToken(url, state);
  await registeredPlanPath(state.config, url.searchParams.get('plan'));
  await servePage(response, 'doc.html', true);
}

async function handleAsset(response, url) {
  const name = url.pathname.slice('/assets/'.length);
  if (!['list.js', 'doc.js'].includes(name)) fail(404, 'no-route', 'The requested route does not exist.');
  const script = await fsp.readFile(path.join(__dirname, name));
  sendFile(response, 200, script, 'text/javascript; charset=utf-8');
}

async function handleRoot(response, url, state) {
  requireGetToken(url, state);
  if (!url.searchParams.has('path')) {
    await servePage(response, 'list.html', true);
    return;
  }
  const graphPath = await validGraphPath(state.config, url.searchParams.get('path'));
  const allowed = await withMutex(() => ensureRegistered(state.config, graphPath));
  if (!allowed) fail(403, 'not-registered', 'This graph path is not registered.');
  await servePage(response, 'index.html');
}

function whoami(port, nonce) {
  return new Promise((resolve, reject) => {
    const suffix = nonce ? `?nonce=${encodeURIComponent(nonce)}` : '';
    const request = http.get({ host: '127.0.0.1', port, path: `/whoami${suffix}`, timeout: 500 }, (response) => {
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

// The old lock claim used this exact hard-link publication pattern.  A token needs the
// same single-winner property, but .server is deliberately only information now.
function claimToken(config, token) {
  const target = tokenPath(config);
  const temp = temporaryPath(target);
  let descriptor;
  let linking = false;
  try {
    descriptor = fs.openSync(temp, 'wx', 0o600);
    fs.writeFileSync(descriptor, `${token}\n`);
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

async function readToken(config) {
  try {
    const token = (await fsp.readFile(tokenPath(config), 'utf8')).trim();
    return /^[0-9a-f]{64}$/.test(token) ? token : null;
  } catch { return null; }
}

async function ensureToken(config) {
  let token = await readToken(config);
  if (token) return token;
  const candidate = crypto.randomBytes(32).toString('hex');
  if (claimToken(config, candidate)) return candidate;
  token = await readToken(config);
  if (!token) throw new Error('Could not create the viewer token.');
  return token;
}

async function servedOrigin(config) {
  try {
    const value = JSON.parse(await fsp.readFile(servingPath(config), 'utf8'));
    return value && value.serve === true && typeof value.origin === 'string' && /^https:\/\//.test(value.origin)
      ? value.origin.replace(/\/$/, '') : null;
  } catch { return null; }
}

async function viewerUrl(lock, openPath, config) {
  const base = await servedOrigin(config) || `http://127.0.0.1:${lock.port}`;
  return openPath ? `${base}/?path=${encodeURIComponent(openPath)}&token=${lock.token}` : base;
}

async function sessionLabel() {
  if (!process.env.TMUX) return null;
  return new Promise((resolve) => {
    const child = spawn('tmux', ['display-message', '-p', '-t', process.env.TMUX_PANE || '', '#S'],
      { stdio: ['ignore', 'pipe', 'ignore'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.on('error', () => resolve(null));
    child.on('exit', (code) => resolve(code === 0 && output.trim() ? output.trim() : null));
  });
}

async function harnessLabel() {
  try {
    await fsp.access('/proc');
  } catch {
    return process.env.CLAUDECODE === '1' ? 'claude' : 'other';
  }
  let pid = process.pid;
  const seen = new Set();
  while (Number.isInteger(pid) && pid > 1 && !seen.has(pid)) {
    seen.add(pid);
    try {
      const name = (await fsp.readFile(`/proc/${pid}/comm`, 'utf8')).trim();
      if (name === 'claude' || name === 'codex') return name;
      const stat = await fsp.readFile(`/proc/${pid}/stat`, 'utf8');
      const tail = stat.slice(stat.lastIndexOf(')') + 1).trim().split(/\s+/);
      pid = Number(tail[1]); // state is field 3; ppid (field 4) is the next field.
    } catch { break; }
  }
  return 'other';
}

async function registrationMetadata() {
  const [session, harness] = await Promise.all([sessionLabel(), harnessLabel()]);
  return { session, harness };
}

function proofFor(nonce, token) {
  return crypto.createHmac('sha256', token).update(nonce).digest('hex');
}

function proofMatches(proof, nonce, token) {
  return typeof proof === 'string' && tokenMatches(proof, proofFor(nonce, token));
}

async function identifyHolder(config, { retrySilent = true, allowOlderStop = false } = {}) {
  const deadline = Date.now() + (retrySilent ? STARTUP_GRACE_ATTEMPTS * STARTUP_GRACE_INTERVAL_MS : 0);
  let sawSilent = false;
  for (;;) {
    const nonce = crypto.randomBytes(16).toString('hex');
    try {
      const identity = await whoami(config.port, nonce);
      const lock = await readLock(config); // after /whoami: the holder has had a chance to repair it.
      const diskToken = await readToken(config);
      const candidates = [...new Set([lock && lock.token, diskToken].filter(Boolean))];
      const matchingToken = candidates.find((token) => proofMatches(identity.proof, nonce, token));
      if (matchingToken && lock && lock.start_id === identity.start_id &&
          Number.isInteger(identity.pid) && lock.pid === identity.pid) {
        return { kind: 'ours', identity, lock, token: matchingToken };
      }
      if (allowOlderStop && identity && identity.proof === undefined && lock &&
          identity.start_id === lock.start_id && Number.isInteger(lock.pid)) {
        return { kind: 'older', identity, lock, token: lock.token };
      }
      if (identity && identity.proof === undefined && typeof identity.start_id === 'string') return { kind: 'older-foreign' };
      return { kind: 'foreign' };
    } catch (error) {
      if (error && error.code === 'ECONNREFUSED') return { kind: 'none' };
      sawSilent = true;
      if (!retrySilent || Date.now() >= deadline) return { kind: sawSilent ? 'foreign' : 'none' };
      await new Promise((resolve) => setTimeout(resolve, STARTUP_GRACE_INTERVAL_MS));
    }
  }
}

async function waitForPidExit(pid) {
  const deadline = Date.now() + STOP_WAIT_MS;
  while (Date.now() < deadline) {
    try { process.kill(pid, 0); } catch (error) { if (error.code === 'ESRCH') return true; }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  try { process.kill(pid, 0); return false; } catch (error) { return error.code === 'ESRCH'; }
}

async function stopServer(config, { ifStale = false, allowOlderStop = false } = {}) {
  const holder = await identifyHolder(config, { retrySilent: true, allowOlderStop });
  if (holder.kind === 'none') { console.log('No viewer running.'); return { stopped: false, none: true }; }
  if (holder.kind === 'older-foreign') {
    console.error('a viewer from an older version is running; run ./install.sh'); process.exitCode = 1; return { failed: true };
  }
  if (holder.kind !== 'ours' && holder.kind !== 'older') {
    console.error('Refused to stop a process it cannot identify.'); process.exitCode = 1; return { failed: true };
  }
  if (ifStale && holder.kind === 'ours' && holder.identity.code === await currentCode()) {
    console.log('Viewer is current.'); return { stopped: false, current: true };
  }
  const pid = holder.lock.pid;
  try { process.kill(pid, 'SIGTERM'); } catch (error) {
    if (error.code === 'ESRCH') return { stopped: true };
    throw error;
  }
  if (!(await waitForPidExit(pid))) {
    console.error('Viewer did not exit within 5 seconds.'); process.exitCode = 1; return { failed: true };
  }
  console.log('Server stopped.'); return { stopped: true };
}

async function writeServerRecord(config, lock) {
  const target = lockPath(config); const temp = temporaryPath(target);
  await fsp.writeFile(temp, `${JSON.stringify(lock, null, 2)}\n`, { mode: 0o600 });
  await fsp.rename(temp, target);
}

async function removeOwnServerRecord(config, startId) {
  const current = await readLock(config);
  if (current && current.start_id === startId) await fsp.unlink(lockPath(config)).catch(() => {});
}

async function currentCode() {
  return hashBytes(await fsp.readFile(__filename)).slice(0, 12);
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
  });
}

// This stays inside the start mutex and after listen: a losing starter therefore never writes a
// registry, and an early /register waits until the starter's prune and own entry are complete.
async function afterListenStartup(state) {
  await pruneRegistries(state.config, state, { force: true });
  if (state.ownRegistration) {
    const { path: graphPath, opened, session, harness } = state.ownRegistration;
    await registerPath(state.config, graphPath, opened, session, harness);
  }
}

async function startServer(config) {
  await fsp.mkdir(config.cacheRoot, { recursive: true, mode: 0o700 });
  const token = await ensureToken(config);
  const lock = { pid: process.pid, port: config.port, token, start_id: crypto.randomBytes(16).toString('hex') };
  const state = { config, lock, port: config.port, server: null, watched: new Map(), code: await currentCode(),
    servedOrigin: await servedOrigin(config), closing: false, lastRegistryPrune: 0,
    ownRegistration: config.open ? { path: config.open, opened: true, ...(await registrationMetadata()) } : null };
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://127.0.0.1:${state.port}`);
      if (request.method === 'GET' && url.pathname === '/whoami') {
        const recorded = await readLock(config);
        if (!recorded || recorded.start_id !== state.lock.start_id) await writeServerRecord(config, state.lock);
        const body = { start_id: state.lock.start_id, pid: process.pid, code: state.code };
        const nonce = url.searchParams.get('nonce');
        if (nonce) body.proof = proofFor(nonce, state.lock.token);
        sendJson(response, 200, body); return;
      }
      if (request.method === 'GET' && url.pathname.startsWith('/assets/')) { await handleAsset(response, url); return; }
      if (request.method === 'GET' && url.pathname === '/') { await handleRoot(response, url, state); return; }
      if (request.method === 'GET' && url.pathname === '/list') { await handleList(response, url, state); return; }
      if (request.method === 'GET' && url.pathname === '/plan') { await handlePlan(response, url, state); return; }
      if (request.method === 'GET' && url.pathname === '/docs') { await handleDocs(response, url, state); return; }
      if (request.method === 'GET' && url.pathname === '/doc') { await handleDoc(response, url, state); return; }
      if (request.method === 'GET' && url.pathname === '/watching') {
        const timestamp = request.headers['x-graph-timestamp'];
        requireSignedAuth(request, state, `${timestamp}\n${request.url}`);
        const watchedPath = await validGraphPath(state.config, url.searchParams.get('path'));
        const seen = state.watched.get(watchedPath) || 0;
        sendJson(response, 200, { watched: Date.now() - seen < WATCHED_WINDOW_MS }); return;
      }
      if (request.method === 'POST' && url.pathname === '/register') { await handleRegister(request, response, state); return; }
      if (request.method === 'GET' && url.pathname === '/graph') { await handleGetGraph(response, url, state); return; }
      if (request.method === 'PUT' && url.pathname === '/graph') { await handleGraphPut(request, response, url, state); return; }
      if (request.method === 'PUT' && url.pathname === '/view') { await handleViewPut(request, response, url, state); return; }
      requireGetToken(url, state);
      fail(404, 'no-route', 'The requested route does not exist.');
    } catch (error) { sendError(response, error); }
  });
  state.server = server;
  try {
    await withMutex(async () => {
      await listen(server, config.port);
      await writeServerRecord(config, lock);
      await afterListenStartup(state);
    });
  } catch (error) {
    await new Promise((resolve) => server.close(() => resolve()));
    await removeOwnServerRecord(config, lock.start_id);
    throw error;
  }
  const close = () => {
    if (state.closing) return; state.closing = true;
    server.close(async () => { await removeOwnServerRecord(config, lock.start_id); });
  };
  server.on('error', async (error) => {
    if (!state.closing) { state.closing = true; server.close(async () => { await removeOwnServerRecord(config, lock.start_id); }); }
    console.error(error.message); process.exitCode = 1;
  });
  process.once('SIGTERM', close); process.once('SIGINT', close);
  return { reused: false, lock };
}

// Test hooks may replace this through globalThis; production intentionally has no service delay.
async function afterServiceStop() {
  if (typeof globalThis.__wheelchairAfterServiceStop === 'function') {
    await globalThis.__wheelchairAfterServiceStop();
  }
}

// Ask the running server whether a page is already polling this graph. A redraw should not stack
// up browser windows — an open tab picks the new version up on its own poll within a second.
function signedHeaders(token, signed) {
  const timestamp = String(Date.now());
  return { 'x-graph-timestamp': timestamp,
    'x-graph-signature': crypto.createHmac('sha256', token).update(`${timestamp}\n`).update(signed).digest('hex') };
}

async function signedRegistration(holder, registration) {
  const bytes = Buffer.from(JSON.stringify(registration));
  const headers = { ...signedHeaders(holder.token, bytes), 'content-type': 'application/json', origin: `http://127.0.0.1:${holder.lock.port}` };
  const result = await new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port: holder.lock.port, path: '/register', method: 'POST', headers, timeout: 1500 },
      (response) => { let text = ''; response.on('data', (c) => { text += c; }); response.on('end', () => resolve({ status: response.statusCode, text })); });
    request.on('timeout', () => request.destroy(new Error('registration timeout'))); request.on('error', reject);
    request.end(bytes);
  });
  if (result.status !== 200) throw new Error(`Viewer registration failed (${result.status}): ${result.text}`);
}

async function alreadyWatched(holder, graphPath) {
  try {
    const requestPath = `/watching?path=${encodeURIComponent(graphPath)}`;
    const body = await new Promise((resolve, reject) => {
      const request = http.get(
        { host: '127.0.0.1', port: holder.lock.port, path: requestPath, headers: { ...signedHeaders(holder.token, requestPath), origin: `http://127.0.0.1:${holder.lock.port}` }, timeout: 1500 },
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
  if (config.stop) { await stopServer(config, { ifStale: config.ifStale, allowOlderStop: true }); return; }
  if (config.rotateToken) {
    await fsp.mkdir(config.cacheRoot, { recursive: true, mode: 0o700 });
    const token = crypto.randomBytes(32).toString('hex'); const temp = temporaryPath(tokenPath(config));
    await fsp.writeFile(temp, `${token}\n`, { mode: 0o600 }); await fsp.rename(temp, tokenPath(config));
    const result = await stopServer(config);
    const url = await viewerUrl({ port: config.port, token }, null, config);
    console.log(`${url}/?token=${token}`);
    if (result.failed) console.error('The server must be restarted to use the new token.');
    return;
  }
  if (config.url) {
    await fsp.mkdir(config.cacheRoot, { recursive: true, mode: 0o700 });
    let token = await ensureToken(config);
    const holder = await identifyHolder(config, { retrySilent: false });
    if (holder.kind === 'ours') {
      token = holder.lock.token;
      const onDisk = await readToken(config);
      if (onDisk && onDisk !== token) console.error('Warning: token rotation is waiting for the server to restart.');
    }
    const base = await viewerUrl({ port: config.port, token }, null, config);
    console.log(`${base}/?token=${token}`);
    return;
  }
  if (config.registerPlan) {
    try {
      config.registerPlan = await validPlanPath(config.registerPlan);
      const deadline = Date.now() + STARTUP_GRACE_ATTEMPTS * STARTUP_GRACE_INTERVAL_MS;
      let holder;
      do {
        holder = await identifyHolder(config, { retrySilent: true });
        if (holder.kind !== 'none') break;
        if (Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, STARTUP_GRACE_INTERVAL_MS));
      } while (Date.now() < deadline);
      if (holder?.kind === 'ours') {
        await signedRegistration(holder, { kind: 'plan', path: config.registerPlan, ...(await registrationMetadata()) });
      } else if (holder && holder.kind !== 'none') {
        console.error(holder.kind === 'older-foreign' ? 'Warning: a viewer from an older version is running; run ./install.sh' : 'Warning: viewer registration was refused.');
      }
    } catch (error) {
      console.error(`Warning: ${error.message}`);
    }
    return;
  }
  if (config.open) {
    config.open = await validGraphPath(config, config.open, { createParent: true });
  }
  let result;
  let takeovers = 0;
  let closingRetryDeadline = 0;
  for (;;) {
    try { result = await startServer(config); break; }
    catch (error) {
      if (error.code !== 'EADDRINUSE') throw error;
      const holder = await identifyHolder(config, { retrySilent: true });
      if (holder.kind === 'none') {
        if (!closingRetryDeadline) closingRetryDeadline = Date.now() + STARTUP_GRACE_ATTEMPTS * STARTUP_GRACE_INTERVAL_MS;
        if (Date.now() < closingRetryDeadline) {
          await new Promise((resolve) => setTimeout(resolve, STARTUP_GRACE_INTERVAL_MS));
          continue;
        }
        throw new Error('Refused to use a port held by a process it cannot identify.');
      }
      if (holder.kind === 'ours') {
        if (!config.service) { result = { reused: true, lock: holder.lock, registrationToken: holder.token }; break; }
        if (takeovers >= 3) throw new Error('Viewer service gave up after three takeovers.');
        takeovers += 1;
        const stopped = await stopServer(config);
        if (stopped.failed) throw new Error('Viewer service could not stop the existing viewer.');
        await afterServiceStop();
        continue;
      }
      if (holder.kind === 'older-foreign') throw new Error('a viewer from an older version is running; run ./install.sh');
      throw new Error('Refused to use a port held by a process it cannot identify.');
    }
  }
  if (result.reused && config.open) {
    try {
      await signedRegistration({ lock: result.lock, token: result.registrationToken },
        { kind: 'graph', path: config.open, opened: true, ...(await registrationMetadata()) });
    } catch (error) { throw new Error(error.message); }
  }
  const url = await viewerUrl(result.lock, config.open, config);
  console.log(url);
  if (config.show && config.browser && !(await alreadyWatched({ lock: result.lock, token: result.registrationToken || result.lock.token }, config.open))) {
    launchBrowser(url);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
