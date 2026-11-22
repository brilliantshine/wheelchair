'use strict';

const PROVIDERS = { claude: { cli: 'claude', label: 'Claude', effort: true, preflight: false, typesRoleMessage: false, asideFork: true, singleAccount: false }, gpt: { cli: 'codex', label: 'GPT', effort: true, preflight: true, typesRoleMessage: true, asideFork: true, singleAccount: false }, gemini: { cli: 'agy', label: 'Antigravity', effort: true, preflight: false, typesRoleMessage: true, asideFork: false, singleAccount: true }, kimi: { cli: 'kimi', label: 'Kimi Code', effort: false, preflight: false, typesRoleMessage: true, asideFork: false, singleAccount: false }, openrouter: { cli: 'pi', label: 'OpenRouter', effort: true, preflight: false, typesRoleMessage: false, asideFork: true, singleAccount: false } };
const DISPLAY_NAMES = { claude: 'Claude Code', gpt: 'Codex', gemini: 'Antigravity', kimi: 'Kimi Code', openrouter: 'Pi (OpenRouter)' };
function providerOf(cli) { return Object.keys(PROVIDERS).find((key) => PROVIDERS[key].cli === cli); }
function cliOf(provider) { return PROVIDERS[provider]?.cli; }
module.exports = { PROVIDERS, DISPLAY_NAMES, providerOf, cliOf };
