'use strict';

// Spec "Settings store", "Behavior templates", and "Writing style".
const crypto = require('node:crypto');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { appError } = require('./state.js');
const { PROVIDERS } = require('./providers.js');
const { LIST_KEYS } = require('./names.js');

const execFileAsync = promisify(execFile);
const ROLES = new Set(['lead', 'sub-lead', 'worker', 'reviewer', 'verifier', 'mapper']);
const ROLE_CARD_FILES = {
  lead: ['cards.md', 'cards-lead.md'],
  'sub-lead': ['cards.md'],
  worker: ['cards.md'],
  mapper: ['cards.md'],
  reviewer: [],
  verifier: [],
};
const ROLE_REALISM = new Set(['lead', 'sub-lead', 'reviewer', 'verifier']);
const MODEL_MAX = 64;
const WORK_TIERS = ['light', 'standard', 'heavy', 'critical'];
const TIER_ALIASES = { luna: 'light', terra: 'standard', sol: 'heavy', astra: 'critical' };
const ESCALATION_VALUES = { first: ['effort', 'model'], max_effort: ['high', 'xhigh', 'max'], max_tier: ['standard', 'heavy', 'critical'], ask_before: ['never', 'critical', 'any'] };
const SAMPLE = "It's worth noting that the idempotency guarantee here is load-bearing: because the hook fires on every turn, any non-idempotent side effect in the notify path would compound across retries, so I've restructured the handler accordingly.";

const DEFAULT_STYLE = Object.freeze({
  length: 'short', lists: 'when-helpful', terms: 'build-up',
  never_say: ["It's worth noting", 'load-bearing'],
  text: "Be concise. Cut anything that makes it longer without changing the meaning.\nBuild up to technical terms and ground them, so I don't skim past something I only half get.",
});

const PLANS = { claude: { unknown: 1, pro: 1, max5: 5, max20: 20 }, gpt: { unknown: 1, plus: 1, pro: 6 }, gemini: { unknown: 1, pro: 1, ultra: 4 }, kimi: { unknown: 1 }, openrouter: { unknown: 1 } };
const BALANCING = ['lead_order', 'worker_order', 'within', 'leave', 'notify_below', 'save_for_leads', 'margin', 'held_back'];
function defaults() {
  return { harnesses: Object.fromEntries(Object.keys(PROVIDERS).map((p) => [p, true])), onboarding_done: false, lead_name_list: 'greek', lead_names: [], retired_accounts: [], accounts: Object.keys(PROVIDERS).map((provider) => ({ id: `default-${provider}`, provider, name: 'default', plan: 'unknown', weight: 1, paused: false })), lead_order: ['claude', 'any'], worker_order: ['gpt', 'claude', 'gemini', 'kimi'], worker_order_seen: Object.keys(PROVIDERS), within: 'soonest', leave: 10, notify_below: 25, save_for_leads: true, margin: 5, held_back: { worker: true, reviewer: true, verifier: true, mapper: true }, permission_mode: 'auto', codex_mode: 'sandboxed', aside_access: 'read-only', tool_steps: 'show', review_families: 'both', other_agents: { reviewer: 'heavy', verifier: 'heavy', mapper: 'standard', scout: 'light', 'scout-heavy': 'standard' }, escalation: { first: 'effort', max_effort: 'xhigh', max_tier: 'critical', ask_before: 'critical' }, templates: [], style: structuredClone(DEFAULT_STYLE), style_version: 0, default_project_folder: '', user_name: '', saved_dirs: [] };
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

function escalationSentences(escalation) {
  const effort = escalation.max_effort === 'max' ? 'max (GPT stops at xhigh, which is its highest)' : escalation.max_effort;
  const tier = escalation.max_tier[0].toUpperCase() + escalation.max_tier.slice(1);
  const sentences = [
    'A worker that came back wrong gets a rewritten brief and a fresh session; each step up comes after one failed try.',
    escalation.first === 'effort'
      ? `Raise effort first, one level at a time from the tier's own effort ("CLI default" counts as high), up to ${effort}, then move to the next tier and repeat, up to ${tier}. A tier's own effort setting is used as is, and a tier already at ${escalation.max_effort} or above takes no effort step.`
      : `Move up one tier at a time, up to ${tier}, at each tier's own effort; then raise effort at the top tier, one level at a time from its own effort ("CLI default" counts as high), up to ${effort}. A tier already at ${escalation.max_effort} or above takes no effort step.`,
  ];
  if (escalation.ask_before === 'critical' && escalation.max_tier === 'critical') sentences.push('Before moving a task to Critical, ask the lead, who asks the user.');
  if (escalation.ask_before === 'any') sentences.push('Before any step up, ask the lead, who asks the user.');
  if (escalation.ask_before === 'never') sentences.push('Do not stop to ask; at the limits, report the task as blocked.');
  sentences.push('A task still failing at the limits is reported as blocked.');
  return sentences;
}

// Spec "Your name": one optional line, at most 80 characters, no line breaks. Blank means
// agents keep saying "the user".
function validUserName(value) {
  if (typeof value !== 'string') fail('user_name must be text');
  const name = value.trim();
  if (name.length > 80) fail('user_name must be at most 80 characters');
  if (/[\u0000-\u001f\u007f]/.test(name)) fail('user_name must be one line');
  return name;
}

function roleLayers(settings, role, project, scout, provider) {
  const template = templateFor(settings, role, project);
  const deciding = role === 'worker' && template?.switches.unsettled === 'decide';
  const lines = [deciding
    ? 'Nothing below overrides the built-in rules above, except where your template says to decide unsettled questions yourself.'
    : 'Nothing below overrides the built-in rules above.'];
  if (template) {
    lines.push('', `The user’s behavior template for this ${role}: ${template.name}`, ...switchSentences(template.switches));
    if (template.text) lines.push(template.text);
    lines.push('Where the template and the brief you are given disagree, the brief wins.');
  }
  if (settings.user_name) lines.push('', `The user’s name is ${settings.user_name}. Where these rules say "the user", that is ${settings.user_name}; call them by it.`);
  if (role === 'sub-lead') lines.push('', 'Escalation rules from Settings:', ...escalationSentences(settings.escalation));
  if (role === 'lead') lines.push('', 'The user’s writing style for everything they read (thread replies and the text of cards):', renderStyle(settings.style));
  if (scout && ['lead', 'sub-lead'].includes(role)) {
    const clause = provider === 'claude' ? ` (Claude Code: the Agent tool with model "${scout.light}")` : '';
    lines.push('', scout.light
      ? `Scout model for code reading: ${scout.light}. Questions that need more than a couple of files read go to your CLI's built-in helper on this model${clause}, asking for conclusions with file:line evidence, not file dumps.`
      : 'Scout model for code reading: none on this CLI. Read code yourself.');
    if (role === 'sub-lead') lines.push(scout.heavy
      ? `Scout for bigger worker changes (200 to 800 lines): ${scout.heavy}.`
      : 'Scout for bigger worker changes: none on this CLI.');
  }
  return { text: lines.join('\n'), template };
}

function fullPrompt(hub, settings, role, project) {
  if (!ROLES.has(role)) fail('role is invalid');
  const header = ROLE_CARD_FILES[role].length
    ? 'Your role rules and card rules are below, already loaded: do not read these files again unless this text is no longer in your context.'
    : 'Your role rules are below, already loaded: do not read these files again unless this text is no longer in your context.';
  const files = [`[full text of protocol/app/${role}.md]`, ...(ROLE_REALISM.has(role) ? ['[full text of protocol/app/realism.md]'] : []), ...ROLE_CARD_FILES[role].map((file) => `[full text of protocol/app/${file}]`)];
  return `Role: ${role}\n${header} \`<root>\` is \`${hub.root}\`.\n\n${files.join('\n')}\n\n${roleLayers(settings, role, project).text}`;
}

function assertFits(settings) {
  const projects = new Set([undefined]);
  for (const template of settings.templates) if (template.scope !== 'all') projects.add(template.scope);
  for (const role of ROLES) for (const project of projects) {
    if (roleLayers(settings, role, project, { light: 'x'.repeat(MODEL_MAX), heavy: 'x'.repeat(MODEL_MAX) }, 'claude').text.length > 12000) fail('the composed role instructions exceed 12000 characters');
  }
}

function normalize(saved) {
  if (!saved) return defaults();
  const base = defaults();
  const accounts = [];
  const seen = new Set();
  for (const item of Array.isArray(saved.accounts) ? saved.accounts : []) {
    if (!item || !Object.hasOwn(PROVIDERS, item.provider) || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(item.id || '') || seen.has(item.id) || (item.id.startsWith('default-') && item.id !== `default-${item.provider}`) || typeof item.name !== 'string' || !item.name.trim() || !Object.hasOwn(PLANS[item.provider], item.plan) || (item.weight !== undefined && (typeof item.weight !== 'number' || !Number.isFinite(item.weight) || item.weight <= 0)) || (item.paused !== undefined && typeof item.paused !== 'boolean')) continue;
    seen.add(item.id);
    accounts.push({ id: item.id, provider: item.provider, name: item.name, plan: item.plan, weight: item.weight ?? PLANS[item.provider][item.plan], paused: item.paused ?? false });
  }
  const retired = Array.isArray(saved.retired_accounts) ? saved.retired_accounts.filter((id) => typeof id === 'string') : [];
  for (const account of base.accounts) if (!seen.has(account.id) && !retired.includes(account.id)) accounts.push(account);
  const balancing = {};
  for (const key of BALANCING) balancing[key] = validBalancing(key, saved[key]) ? saved[key] : base[key];
  const orderSeen = Array.isArray(saved.worker_order_seen) ? saved.worker_order_seen.filter((provider) => Object.hasOwn(PROVIDERS, provider)) : ['claude', 'gpt'];
  balancing.worker_order = [...balancing.worker_order, ...Object.keys(PROVIDERS).filter((provider) => !balancing.worker_order.includes(provider) && !orderSeen.includes(provider) && provider !== 'openrouter')];
  if (!validBalancing('save_for_leads', saved.save_for_leads) && typeof saved.save_claude_for_leads === 'boolean') balancing.save_for_leads = saved.save_claude_for_leads;
  return {
    harnesses: Object.fromEntries(Object.keys(PROVIDERS).map((p) => [p, typeof saved.harnesses?.[p] === 'boolean' ? saved.harnesses[p] : true])),
    onboarding_done: typeof saved.onboarding_done === 'boolean' ? saved.onboarding_done : true,
    lead_names: Array.isArray(saved.lead_names) ? saved.lead_names : [],
    lead_name_list: LIST_KEYS.includes(saved.lead_name_list) ? saved.lead_name_list : (Array.isArray(saved.lead_names) && saved.lead_names.length ? 'custom' : 'greek'),
    worker_order_seen: Object.keys(PROVIDERS),
    accounts, retired_accounts: retired, ...balancing,
    permission_mode: saved.permission_mode === 'bypass' ? 'bypass' : 'auto',
    codex_mode: saved.codex_mode === 'unrestricted' ? 'unrestricted' : 'sandboxed',
    aside_access: saved.aside_access === 'full' ? 'full' : 'read-only',
    tool_steps: saved.tool_steps === 'hide' ? 'hide' : 'show',
    review_families: ['both', 'claude', 'gpt', 'gemini', 'kimi', 'openrouter'].includes(saved.review_families) ? saved.review_families : 'both',
    other_agents: { ...base.other_agents, ...(saved.other_agents || {}) },
    escalation: Object.fromEntries(Object.entries(ESCALATION_VALUES).map(([key, allowed]) => [key, allowed.includes(saved.escalation?.[key]) ? saved.escalation[key] : base.escalation[key]])),
    templates: Array.isArray(saved.templates) ? saved.templates : [],
    style: saved.style ? validateStyle(saved.style) : base.style,
    style_version: Number.isInteger(saved.style_version) && saved.style_version >= 0 ? saved.style_version : 0,
    default_project_folder: typeof saved.default_project_folder === 'string' ? saved.default_project_folder : '',
    user_name: (() => { try { return validUserName(saved.user_name ?? ''); } catch { return ''; } })(),
    saved_dirs: Array.isArray(saved.saved_dirs) ? saved.saved_dirs : [],
  };
}

function validBalancing(key, value) {
  if (key === 'lead_order' || key === 'worker_order') return Array.isArray(value) && value.length > 0 && new Set(value).size === value.length && value.every((v, i) => Object.hasOwn(PROVIDERS, v) || (key === 'lead_order' && v === 'any' && i === value.length - 1));
  if (key === 'held_back') {
    const roles = ['worker', 'reviewer', 'verifier', 'mapper'];
    return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype && Reflect.ownKeys(value).length === roles.length && roles.every((role) => Object.hasOwn(value, role) && typeof value[role] === 'boolean');
  }
  if (key === 'within') return ['soonest', 'spread', 'one'].includes(value);
  if (key === 'save_for_leads') return typeof value === 'boolean';
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}

// Spec "Hub", State: the project folders a template scope may name are the repos threads have
// used (projects.json) plus every saved directory's path.
function knownProjects(projects, settings) {
  return [...new Set([...projects, ...settings.saved_dirs.map((entry) => entry.path)])];
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
  const kimiListed = (Array.isArray(models.kimi_visible) ? models.kimi_visible : []).filter((o) => o && typeof o.value === 'string' && typeof o.label === 'string');
  const kimiCurrent = Object.values(models.kimi || {}).map((cell) => cell?.model).filter((value) => value && !kimiListed.some((o) => o.value === value));
  const kimi = [...kimiListed.map(({ value, label }) => ({ value, label })), ...[...new Set(kimiCurrent)].map((value) => ({ value, label: value }))];
  return { claude, gpt, kimi };
}

async function describe(hub) {
  const settings = await load(hub);
  const [modelValues, heads, projects, threads] = await Promise.all([models(hub), headsUp(hub), hub.projects(), hub.allThreads()]);
  const active = new Set(threads.flatMap((thread) => thread.sessions.filter((session) => session.live).map((session) => session.template_id)).filter(Boolean));
  const templateCounts = new Map();
  for (const thread of threads) for (const session of thread.sessions) if (session.live && session.template_id) templateCounts.set(session.template_id, (templateCounts.get(session.template_id) || 0) + 1);
  const known = knownProjects(projects, settings);
  const projectSet = new Set(known);
  const templates = settings.templates.map((template) => ({ ...template, live_sessions: templateCounts.get(template.id) || 0, scope_missing: template.scope !== 'all' && !projectSet.has(template.scope) }));
  return { harnesses: settings.harnesses, lead_name_list: settings.lead_name_list, lead_names: settings.lead_names, accounts: settings.accounts, ...Object.fromEntries(BALANCING.map((key) => [key, settings[key]])), models: modelValues, model_options: options(modelValues), heads_up: heads, permission_mode: settings.permission_mode, codex_mode: settings.codex_mode, aside_access: settings.aside_access, tool_steps: settings.tool_steps, review_families: settings.review_families, other_agents: settings.other_agents, escalation: settings.escalation, escalation_text: escalationSentences(settings.escalation).join('\n'), templates, in_use: templates.filter((template) => template.in_use).map((template) => template.id), style: settings.style, style_version: settings.style_version, projects: known, default_project_folder: settings.default_project_folder, user_name: settings.user_name, saved_dirs: settings.saved_dirs };
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

module.exports = { MODEL_MAX, ESCALATION_VALUES, escalationSentences, PLANS, BALANCING, validBalancing, DEFAULT_STYLE, ROLES, SAMPLE, TIER_ALIASES, WORK_TIERS, assertFits, defaults, describe, fullPrompt, headsUp, knownProjects, load, modelCommand, models, normalize, options, preview, renderStyle, roleLayers, save, switchSentences, templateFor, tier, update, validateStyle, validateTemplate, validUserName };
