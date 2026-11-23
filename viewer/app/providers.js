'use strict';

const connectors = require('../../connectors');
const PROVIDERS = Object.fromEntries(connectors.list().map(m => [m.provider, { cli: m.cli, label: m.label, effort: m.models.efforts.length > 0, preflight: m.capabilities.preflight, typesRoleMessage: m.typesRoleMessage, asideFork: m.capabilities.aside, singleAccount: m.singleAccount }]));
const DISPLAY_NAMES = Object.fromEntries(connectors.list().map(m => [m.provider, m.displayName]));
function providerOf(cli) { return Object.keys(PROVIDERS).find((key) => PROVIDERS[key].cli === cli); }
function cliOf(provider) { return PROVIDERS[provider]?.cli; }
module.exports = { PROVIDERS, DISPLAY_NAMES, providerOf, cliOf };
