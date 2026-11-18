'use strict';

const PROVIDERS = { claude: { cli: 'claude', label: 'Claude', effort: true, preflight: false, typesRoleMessage: false, asideFork: true, singleAccount: false }, gpt: { cli: 'codex', label: 'GPT', effort: true, preflight: true, typesRoleMessage: true, asideFork: true, singleAccount: false }, gemini: { cli: 'agy', label: 'Antigravity', effort: true, preflight: false, typesRoleMessage: true, asideFork: false, singleAccount: true }, kimi: { cli: 'kimi', label: 'Kimi Code', effort: true, preflight: false, typesRoleMessage: true, asideFork: false, singleAccount: false } };
function providerOf(cli) { return Object.keys(PROVIDERS).find((key) => PROVIDERS[key].cli === cli); }
function cliOf(provider) { return PROVIDERS[provider]?.cli; }
module.exports = { PROVIDERS, providerOf, cliOf };
