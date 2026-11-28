'use strict';
const connectors = require('../../connectors');
const sandboxed = session => { const m = connectors.manifest(session.cli); return !!(m?.capabilities.sandbox && connectors.machine(m.cli).sandboxed(session)); };

function promptLines({ health, wsl, loaded, mcp, copy, cli, codexMode, version, unityExists }) {
  const lines = [];
  if (health?.ok === false) lines.push(`Windows bridge: not working on this machine (${health.reason}). Don't rely on \`wc.js win\` until the user fixes it.`);
  if (!wsl || !loaded.some(entry => entry.unity === true || (entry.windows && mcp?.servers?.[entry.name]?.args?.includes('mcp-for-unity')))) return lines;
  const project = copy || '<copy_windows from win info>';
  lines.push(copy ? `Unity: your project copy on Windows is \`${copy}\`.` : 'Unity: run `wc.js win info` to get your project copy\'s Windows path (`copy_windows`); if it is null, wait and run it again.');
  if (sandboxed({ cli, codex_mode: codexMode })) lines.push("You can't start Windows programs from this sandboxed session; ask whoever started you to have Unity opened on that path.");
  else if (version && unityExists) lines.push(`Open Unity on it yourself (\`wc.js win start -- "C:\\Program Files\\Unity\\Hub\\Editor\\${version}\\Editor\\Unity.exe" -projectPath "${project}"\`), never on another path.`);
  else lines.push(`Open Unity ${version || "the project's version"} on it yourself with \`wc.js win start -- "<Unity.exe>" -projectPath "${project}"\` (Unity is usually under \`C:\\Program Files\\Unity\\Hub\\Editor\`), never on another path.`);
  lines.push("Before any other Unity MCP call, list the connected Unity instances, select the one whose project path is your copy, and check the selection; if none matches, don't use the Unity tools until it appears. Never act on another instance.");
  return lines;
}

module.exports = { promptLines };
