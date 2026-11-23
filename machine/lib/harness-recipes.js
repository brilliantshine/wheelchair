'use strict';
const fs = require('node:fs');
const script = url => `t=$(mktemp) && curl -fsSL ${url} -o "$t" && bash "$t"; r=$?; rm -f "$t"; exit $r`;
const recipes = {
  // https://docs.claude.com/en/docs/claude-code/setup
  claude: { command: script('https://claude.ai/install.sh') },
  // https://github.com/openai/codex
  gpt: { command: 'npm install -g --prefix "$HOME/.local" @openai/codex@latest', node: '16.0.0' },
  // https://antigravity.google/cli
  gemini: { command: script('https://antigravity.google/cli/install.sh') },
  // https://code.kimi.com
  kimi: { command: script('https://code.kimi.com/kimi-code/install.sh') },
  // https://www.npmjs.com/package/@earendil-works/pi-coding-agent
  openrouter: { command: 'npm install -g --prefix "$HOME/.local" @earendil-works/pi-coding-agent@latest', node: '22.19.0' },
};
const providers = Object.keys(recipes);
function loadRecipes() {
  if (!process.env.WHEELCHAIR_HARNESS_RECIPES) return recipes;
  const override = JSON.parse(fs.readFileSync(process.env.WHEELCHAIR_HARNESS_RECIPES, 'utf8'));
  return Object.fromEntries(providers.filter(p => typeof override[p] === 'string').map(p => [p, { ...recipes[p], command: override[p] }]));
}
module.exports = { providers, loadRecipes, script };
