'use strict';

const PROVIDERS = { claude: { cli: 'claude', label: 'Claude' }, gpt: { cli: 'codex', label: 'GPT' } };
function providerOf(cli) { return Object.keys(PROVIDERS).find((key) => PROVIDERS[key].cli === cli); }
function cliOf(provider) { return PROVIDERS[provider]?.cli; }
module.exports = { PROVIDERS, providerOf, cliOf };
