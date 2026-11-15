'use strict';

// Spec "Settings store", "Behavior templates", and "Writing style".
const crypto = require('node:crypto');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { appError } = require('./state.js');

const execFileAsync = promisify(execFile);
const ROLES = new Set(['lead', 'sub-lead', 'worker', 'reviewer', 'verifier', 'mapper']);
const WORK_TIERS = ['light', 'standard', 'heavy', 'critical'];
const TIER_ALIASES = { luna: 'light', terra: 'standard', sol: 'heavy', astra: 'critical' };
const SAMPLE = "It's worth noting that the idempotency guarantee here is load-bearing: because the hook fires on every turn, any non-idempotent side effect in the notify path would compound across retries, so I've restructured the handler accordingly.";

const DEFAULT_STYLE = Object.freeze({
  length: 'short', lists: 'when-helpful', terms: 'build-up',
  never_say: ["It's worth noting", 'load-bearing'],
  text: "Be concise. Cut anything that makes it longer without changing the meaning.\nBuild up to technical terms and ground them, so I don't skim past something I only half get.",
});

function defaults() {
  return { permission_mode: 'auto', codex_mode: 'sandboxed', other_agents: { reviewer: 'heavy', verifier: 'heavy', mapper: 'standard' }, templates: [], style: structuredClone(DEFAULT_STYLE), style_version: 0 };
}

function fail(message) { throw appError(400, message); }
function object(value, name) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${name} must be an object`); return value; }
function text(value, name, maximum) { if (typeof value !== 'string') fail(`${name} must be text`); if (value.length > maximum) fail(`${name} is too long (maximum ${maximum} characters)`); return value; }

function tier(value, name = 'tier', allowTop = false) {
  const normalized = TIER_ALIASES[value] || value;
  if ((allowTop && normalized === 'top') || WORK_TIERS.includes(normalized)) return normalized;
  fail(`${name} must be one of ${[...WORK_TIERS, ...(allowTop ? ['top'] : [])].join(', ')}`);
}

function validateStyle(value) {
  const style = object(value, 'style');
  const result = {
    length: style.length, lists: style.lists, terms: style.terms,
    never_say: style.never_say, text: style.text,
  };
  if (!['short', 'balanced', 'thorough'].includes(result.length)) fail('style.length is invalid');
  if (!['prose', 'when-helpful', 'always'].includes(result.lists)) fail('style.lists is invalid');
  if (!['build-up', 'freely', 'avoid'].includes(result.terms)) fail('style.terms is invalid');
  if (!Array.isArray(result.never_say) || result.never_say.some((item) => typeof item !== 'string' || !item.trim())) fail('style.never_say must be a list of phrases');
  text(result.text, 'style.text', 2000);
  return result;
}

function validateSwitches(value, role) {
  if (value === undefined) return {};
  const switches = object(value, 'switches');
  const result = {};
  for (const key of ['save_every_step', 'full_tests_before_done']) {
    if (switches[key] !== undefined) {
      if (typeof switches[key] !== 'boolean') fail(`switches.${key} must be true or false`);
      result[key] = switches[key];
    }
  }
  if (switches.packages !== undefined) {
    if (!['ask', 'go', 'never'].includes(switches.packages)) fail('switches.packages is invalid');
    result.packages = switches.packages;
  }
  if (switches.unsettled !== undefined) {
    if (role !== 'worker') fail('switches.unsettled is only available to workers');
    if (!['ask', 'decide'].includes(switches.unsettled)) fail('switches.unsettled is invalid');
    result.unsettled = switches.unsettled;
  }
  if (switches.file_limit !== undefined) {
    if (!Number.isInteger(switches.file_limit) || switches.file_limit < 1) fail('switches.file_limit must be a positive integer');
    result.file_limit = switches.file_limit;
  }
  return result;
}

function validateTemplate(value, { updating = false } = {}) {
  const input = object(value, 'template');
  const role = input.role;
  if (!ROLES.has(role)) fail('template.role is invalid');
  const scope = input.scope;
  if (scope !== 'all' && (typeof scope !== 'string' || !scope.trim())) fail('template.scope must be all or a project path');
  const result = {
    name: text(input.name, 'template.name', 200), role, scope,
    switches: validateSwitches(input.switches, role), text: text(input.text, 'template.text', 4000),
  };
  if (updating && input.in_use !== undefined) {
    if (typeof input.in_use !== 'boolean') fail('template.in_use must be true or false');
    result.in_use = input.in_use;
  }
  return result;
}

function switchSentences(switches) {
  const sentences = [];
  if (switches.save_every_step === true) sentences.push('Save your work after every step.');
  if (switches.save_every_step === false) sentences.push('Do not make an extra save after every step.');
  if (switches.full_tests_before_done === true) sentences.push('Run the whole test suite before reporting done.');
  if (switches.full_tests_before_done === false) sentences.push('Run the tests that fit the change before reporting done.');
  if (switches.packages === 'ask') sentences.push('Before installing a new package, ask whoever started you.');
  if (switches.packages === 'go') sentences.push('You may install a new package when the work needs it.');
  if (switches.packages === 'never') sentences.push('Do not install new packages.');
  if (switches.unsettled === 'ask') sentences.push('When the brief leaves something unsettled, ask the lead.');
  if (switches.unsettled === 'decide') sentences.push('When the brief leaves something unsettled, choose the best option, record the question, options, and pick in Choices as decided under the template, not asked, then keep going.');
  if (switches.file_limit) sentences.push(`Stop and ask before changing more than ${switches.file_limit} files.`);
  return sentences;
}

function renderStyle(style) {
  const length = { short: 'Be concise and cut anything that does not change the meaning.', balanced: 'Use enough detail to make the result easy to follow.', thorough: 'Explain the important reasoning and detail completely.' }[style.length];
  const lists = { prose: 'Prefer prose over lists and headings.', 'when-helpful': 'Use lists and headings when they help scanning.', always: 'Use lists and headings to organize the response.' }[style.lists];
  const terms = { 'build-up': 'Build up to technical terms and ground them before relying on them.', freely: 'Use technical terms freely.', avoid: 'Avoid technical terms where plain language works.' }[style.terms];
  const never = style.never_say.length ? `Never say: ${style.never_say.map((phrase) => `“${phrase}”`).join(', ')}.` : '';
  return [length, lists, terms, never, style.text].filter(Boolean).join('\n');
}

function templateFor(settings, role, project) {
  const candidates = settings.templates.filter((template) => template.role === role && template.in_use);
  return candidates.find((template) => template.scope === project) || candidates.find((template) => template.scope === 'all') || null;
}

function roleLayers(settings, role, project) {
  const template = templateFor(settings, role, project);
  const deciding = role === 'worker' && template?.switches.unsettled === 'decide';
  const lines = [deciding
    ? 'Nothing below overrides the built-in rules above, except where your template says to decide unsettled questions yourself.'
    : 'Nothing below overrides the built-in rules above.'];
  if (template) {
    lines.push('', `Collin’s behavior template for this ${role}: ${template.name}`, ...switchSentences(template.switches));
    if (template.text) lines.push(template.text);
    lines.push('Where the template and the brief you are given disagree, the brief wins.');
  }
  if (role === 'lead') lines.push('', 'Collin’s writing style for everything he reads (thread replies and the text of cards):', renderStyle(settings.style));
  return { text: lines.join('\n'), template };
}

function fullPrompt(hub, settings, role, project) {
  if (!ROLES.has(role)) fail('role is invalid');
  const pointer = `Read ${path.join(hub.root, 'protocol', 'app', `${role}.md`)} before responding. It is wheelchair's built-in rules for your role.`;
  return `${pointer}\n\n${roleLayers(settings, role, project).text}`;
}

function assertFits(settings) {
  const projects = new Set([undefined]);
  for (const template of settings.templates) if (template.scope !== 'all') projects.add(template.scope);
  for (const role of ROLES) for (const project of projects) {
    if (roleLayers(settings, role, project).text.length > 12000) fail('the composed role instructions exceed 12000 characters');
  }
}

function normalize(saved) {
  if (!saved) return defaults();
  const base = defaults();
  return {
    permission_mode: saved.permission_mode === 'bypass' ? 'bypass' : 'auto',
    codex_mode: saved.codex_mode === 'unrestricted' ? 'unrestricted' : 'sandboxed',
    other_agents: { ...base.other_agents, ...(saved.other_agents || {}) },
    templates: Array.isArray(saved.templates) ? saved.templates : [],
    style: saved.style ? validateStyle(saved.style) : base.style,
    style_version: Number.isInteger(saved.style_version) && saved.style_version >= 0 ? saved.style_version : 0,
  };
}

async function load(hub) {
  return normalize(await hub.state.settings(null));
}

async function save(hub, settings) { assertFits(settings); await hub.state.saveSettings(settings); return settings; }

// Keep normalization, validation, and the write in State's one read-modify-write queue.
// A rejected change never reaches atomicWrite, so the prior settings file remains intact.
async function update(hub, change) {
  return hub.state.updateSettings(async (saved) => {
    const value = normalize(saved);
    await change(value);
    assertFits(value);
    return value;
  });
}

async function modelCommand(hub, args) {
  return execFileAsync(path.join(hub.root, 'codex', 'model.sh'), args, { encoding: 'utf8' });
}

async function models(hub) { return JSON.parse((await modelCommand(hub, ['show', '--json'])).stdout); }
async function headsUp(hub) { return JSON.parse((await modelCommand(hub, ['check', '--json'])).stdout); }

function options(models) {
  const claude = [
    ['haiku', 'Latest Haiku'], ['sonnet', 'Latest Sonnet'], ['opus', 'Latest Opus'], ['fable', 'Latest Fable'],
    ['claude-haiku-5-5', 'claude-haiku-5-5'], ['claude-sonnet-5-5', 'claude-sonnet-5-5'], ['claude-opus-5-5', 'claude-opus-5-5'], ['claude-fable-5-2', 'claude-fable-5-2'],
  ].map(([value, label]) => ({ value, label }));
  const visible = Array.isArray(models.visible) ? models.visible : [];
  const current = Object.values(models.gpt || {}).map((cell) => cell?.model).filter(Boolean);
  const gpt = [...new Set([...visible, ...current])].map((value) => ({ value, label: value }));
  return { claude, gpt };
}

async function describe(hub) {
  const settings = await load(hub);
  const [modelValues, heads, projects, threads] = await Promise.all([models(hub), headsUp(hub), hub.projects(), hub.allThreads()]);
  const active = new Set(threads.flatMap((thread) => thread.sessions.filter((session) => session.live).map((session) => session.template_id)).filter(Boolean));
  const templateCounts = new Map();
  for (const thread of threads) for (const session of thread.sessions) if (session.live && session.template_id) templateCounts.set(session.template_id, (templateCounts.get(session.template_id) || 0) + 1);
  const projectSet = new Set(projects);
  const templates = settings.templates.map((template) => ({ ...template, live_sessions: templateCounts.get(template.id) || 0, scope_missing: template.scope !== 'all' && !projectSet.has(template.scope) }));
  return { models: modelValues, model_options: options(modelValues), heads_up: heads, permission_mode: settings.permission_mode, codex_mode: settings.codex_mode, other_agents: settings.other_agents, templates, in_use: templates.filter((template) => template.in_use).map((template) => template.id), style: settings.style, style_version: settings.style_version, projects };
}

async function preview(hub, style) {
  const valid = validateStyle(style);
  const rendered = renderStyle(valid);
  let model = 'claude-haiku-5-5';
  try { model = (await modelCommand(hub, ['claude', 'light'])).stdout.trim() || model; } catch { /* none uses the fixed fallback */ }
  const prompt = `Rewrite the following message under these writing instructions. Output only the rewritten message.\n\n${rendered}\n\nMessage:\n${SAMPLE}`;
  try {
    const result = await hub.call('hub', '/v1/preview', 'POST', { prompt, model }, 75000);
    return { before: SAMPLE, after: result.text };
  } catch (error) { throw appError(502, `Preview failed: ${error.message}`); }
}

module.exports = { DEFAULT_STYLE, ROLES, SAMPLE, TIER_ALIASES, WORK_TIERS, assertFits, defaults, describe, fullPrompt, headsUp, load, modelCommand, models, normalize, options, preview, renderStyle, roleLayers, save, switchSentences, templateFor, tier, update, validateStyle, validateTemplate };
