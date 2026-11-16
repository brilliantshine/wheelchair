'use strict';

const PROVIDERS = { claude: { cli: 'claude', label: 'Claude', effort: true, preflight: false, typesRoleMessage: false }, gpt: { cli: 'codex', label: 'GPT', effort: true, preflight: true, typesRoleMessage: true } };
function providerOf(cli) { return Object.keys(PROVIDERS).find((key) => PROVIDERS[key].cli === cli); }
function cliOf(provider) { return PROVIDERS[provider]?.cli; }
module.exports = { PROVIDERS, providerOf, cliOf };
