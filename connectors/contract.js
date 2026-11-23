'use strict';
// Manifest schema: all values are JSON data. Regex fields are source strings;
// a regex needing flags has a separate <field>Flags string. Each manifest holds:
// cli, provider, label, displayName, optional shortName, typesRoleMessage,
// singleAccount, and boolean capabilities. install has command, binary, label,
// optional node, versionArgs, optional fallbackPath, pathRank and sensitivity.
// settings has modelPattern, modelPlaceholder, cliLabel, vendor, setupUrl,
// permissionMode, permissionChoices, accountWarning, modelHeadsUp, signInKind,
// reviewFamily, plans, weights, reportedPlans, oldPlanWeights, modelError,
// familyHint and accountPolicy. models has
// pins (slot -> { model, effort? }), format, efforts, hubPattern, slotAliases and
// effortError. placement has workerRank, leadDefault, seenByDefault,
// addOnMigration and appendWhenRequested. report.useHookText, stopWhenEnded,
// optional asideParentField, hook.payload and hook.sessionFromEnv, recoverRank
// and recoverFallback carry the remaining dispatch data. Nullable values mean
// the option does not apply; omitted fields are optional.
const REQUIRED = { machine: ['command', 'firstMessage', 'readyText', 'answerPrompts', 'findTranscript', 'loginEnv', 'seed', 'loginCommand', 'parseLogin', 'loginStatus'], hub: ['parseChat', 'readReport'] };
const members = { usageProbe: ['usageProbe'], usageEvents: ['usageFrom'], preflight: ['preflightCommand'], sandbox: ['sandboxed', 'sandboxWrap'], restartLoss: ['restartLossReason'], projectTools: ['projectToolReason', 'projectToolFileWarning'], recover: ['recognizePane'], spend: ['spend'], liveSwitch: ['usual'], aside: ['asideArgv'], versionCheck: ['checkVersion', 'versionStatus'], steps: ['readSteps'] };
const CAPABILITIES = Object.fromEntries(Object.entries(members).map(([name, machine]) => [name, { machine, hub: [] }]));
const OPTIONAL = { machine: ['prepare', 'sessionNameEnv', 'promptText', 'retryStartupEnter', 'onTurnEnded', 'loginCwd', 'loginPrompt', 'loginDone', 'codeNeedsPrompt', 'resolveCli', 'redact', 'stepVocabulary', 'stepsReady', 'bindTranscript', 'spoolWaiting', 'validTranscript', 'disableProjectServers', 'asideNewId', 'asideModel', 'asidePrepare', 'asideMessage', 'asideResult', 'asideProblem', 'stylePreviewArgv', 'recordLaunch', 'launchPath', 'launchContext', 'checkPiVersion', 'piVersionStatus', 'checkKimiVersion', 'kimiLaunchPath', 'kimiVersionStatus'], hub: [] };
function validate(manifest, half, mod) {
  const fail = member => { throw new Error(`${manifest.cli}: ${member}`); };
  for (const member of REQUIRED[half]) if (typeof mod[member] !== 'function') fail(member);
  if (half === 'machine' && (typeof mod.hookEvent === 'function') === (typeof mod.turnPoller === 'function')) fail('hookEvent/turnPoller');
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
  for (const f of ['stylePreview','wrapProjectTools','injectProjectKeys','joinPaneLines','hook.sessionFromEnv','report.useHookText','stopWhenEnded','install.sensitivity','placement.leadDefault','placement.seenByDefault','placement.addOnMigration','placement.appendWhenRequested']) check(f,bool,false);
  for (const f of ['shortName','asideParentField']) check(f,str,false);
  check('login.killTarget',v=>['pane','session','name'].includes(v),false);
  check('install.lookup',v=>['path','absolute','fallback'].includes(v));
  check('install.versionArgs',v=>v===null||(arr(v)&&v.every(str)),false);
  for (const f of ['install.label','install.node','install.fallbackPath','settings.modelPlaceholder','settings.cliLabel','settings.vendor','settings.setupUrl','settings.signInKind','settings.modelError','models.effortError']) check(f,str,false);
  for (const f of ['settings.permissionMode','settings.accountWarning','settings.familyHint','settings.accountPolicy']) check(f,v=>v===null||str(v),false);
  for (const f of ['settings.modelHeadsUp','settings.reviewFamily']) check(f,bool,false);
  for (const f of ['settings.permissionChoices','settings.plans']) check(f,arr,false);
  for (const f of ['settings.weights','settings.reportedPlans','settings.oldPlanWeights','models.slotAliases','report','hook']) check(f,obj,false);
  for (const f of ['install.pathRank','recoverRank']) check(f,v=>v===null||typeof v==='number',false);
  check('recoverFallback',bool,false);
  for (const [slot, pin] of Object.entries(m.models.pins)) if (!obj(pin) || !str(pin.model) || (pin.effort !== undefined && !str(pin.effort))) throw new Error(`${m.cli}: models.pins.${slot}`);
  check('hook.payload',v=>v==='stdin'||v==='last-arg', Boolean(m.hook));
}
function validateRegistry(manifests) { manifests.forEach(validateManifest); if (manifests.filter(m=>m.stylePreview).length>1) throw new Error('stylePreview'); if (manifests.filter(m=>m.capabilities.preflight).length>1) throw new Error('capabilities.preflight'); if (manifests.filter(m=>m.install.sensitivity).length>2) throw new Error('install.sensitivity'); }
module.exports = { REQUIRED, CAPABILITIES, OPTIONAL, validate, validateManifest, validateRegistry };
