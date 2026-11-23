'use strict';
const fs = require('node:fs');
const script = url => `t=$(mktemp) && curl -fsSL ${url} -o "$t" && bash "$t"; r=$?; rm -f "$t"; exit $r`;
const recipes = Object.fromEntries(require('../../connectors').list().map(m => [m.provider, { command: m.install.command, ...(m.install.node ? { node: m.install.node } : {}) }]));
const providers = Object.keys(recipes);
function loadRecipes() {
  if (!process.env.WHEELCHAIR_HARNESS_RECIPES) return recipes;
  const override = JSON.parse(fs.readFileSync(process.env.WHEELCHAIR_HARNESS_RECIPES, 'utf8'));
  return Object.fromEntries(providers.filter(p => typeof override[p] === 'string').map(p => [p, { ...recipes[p], command: override[p] }]));
}
module.exports = { providers, loadRecipes, script };
