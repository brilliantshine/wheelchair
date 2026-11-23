'use strict';
const REQUIRED = { machine: ['command', 'firstMessage', 'readyText', 'answerPrompts', 'findTranscript', 'loginEnv', 'seed', 'loginCommand', 'parseLogin', 'loginStatus'], hub: ['parseChat', 'readReport'] };
const members = { usageProbe: ['usageProbe'], usageEvents: ['usageFrom'], preflight: ['preflightCommand'], sandbox: ['sandboxed', 'sandboxWrap'], restartLoss: ['restartLossReason'], projectTools: ['projectToolReason', 'projectToolFileWarning'], recover: ['recognizePane'], spend: ['spend'], liveSwitch: ['usual'], aside: ['asideArgv'], versionCheck: ['checkVersion'], steps: ['readSteps'] };
const CAPABILITIES = Object.fromEntries(Object.entries(members).map(([name, machine]) => [name, { machine, hub: [] }]));
const OPTIONAL = { machine: ['prepare', 'sessionNameEnv', 'promptText', 'retryStartupEnter', 'onTurnEnded', 'loginCwd', 'loginPrompt', 'loginDone', 'codeNeedsPrompt', 'resolveCli', 'redact'], hub: [] };
function validate(manifest, half, mod) {
  const fail = member => { throw new Error(`${manifest.cli}: ${member}`); };
  for (const member of REQUIRED[half]) if (typeof mod[member] !== 'function') fail(member);
  if (half === 'machine' && typeof mod.hookEvent !== 'function' && typeof mod.turnPoller !== 'function') fail('hookEvent/turnPoller');
  for (const [cap, halves] of Object.entries(CAPABILITIES)) for (const member of halves[half]) {
    if (manifest.capabilities[cap] ? typeof mod[member] !== 'function' : member in mod) fail(member);
  }
}
function validateManifest(m) {
  function check(field, pred, required = true) { const value = field.split('.').reduce((o, k) => o?.[k], m); if ((required || value !== undefined) && !pred(value)) throw new Error(`${m?.cli || 'connector'}: ${field}`); }
  const str = v => typeof v === 'string', bool = v => typeof v === 'boolean', obj = v => !!v && typeof v === 'object' && !Array.isArray(v), arr = Array.isArray;
  for (const f of ['cli','provider','label','displayName','install.command','install.binary','settings.modelPattern','models.format','models.hubPattern']) check(f,str);
  for (const f of ['typesRoleMessage','singleAccount']) check(f,bool);
  for (const f of ['capabilities','install','settings','models','models.pins','placement']) check(f,obj);
  for (const cap of Object.keys(CAPABILITIES)) check(`capabilities.${cap}`,bool);
  check('models.efforts',v=>arr(v)&&v.every(str)); check('placement.workerRank',v=>v===null||typeof v==='number');
  for (const f of ['hook.sessionFromEnv','report.useHookText','stopWhenEnded','install.sensitivity','placement.leadDefault','placement.seenByDefault','placement.addOnMigration','placement.appendWhenRequested']) check(f,bool,false);
  for (const f of ['shortName','asideParentField']) check(f,str,false);
  check('install.versionArgs',v=>v===null||(arr(v)&&v.every(str)),false);
  check('hook.payload',v=>v==='stdin'||v==='last-arg', Boolean(m.hook));
}
function validateRegistry(manifests) { manifests.forEach(validateManifest); if (manifests.filter(m=>m.capabilities.preflight).length>1) throw new Error('capabilities.preflight'); if (manifests.filter(m=>m.install.sensitivity).length>2) throw new Error('install.sensitivity'); }
module.exports = { REQUIRED, CAPABILITIES, OPTIONAL, validate, validateManifest, validateRegistry };
