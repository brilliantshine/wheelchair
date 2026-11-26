'use strict';
// Manifest schema: all values are JSON data. Regex fields are source strings;
// a regex needing flags has a separate <field>Flags string. Each manifest holds:
// cli, provider, label, displayName, optional shortName, typesRoleMessage,
// singleAccount, and boolean capabilities. install has command, binary, label,
// optional node, versionArgs, optional fallbackPath, pathRank and sensitivity.
// settings has required modelPattern, modelError, weights and plans (key/label pairs including unknown and keys present in weights), optional modelOptions (fixed pairs or listedKey, listedShape and includePins), modelPlaceholder, cliLabel, vendor, setupUrl,
// permissionMode (requires permissionName), permissionName, permissionChoices, accountWarning, modelHeadsUp, signInKind,
// reviewFamily, plans, weights, reportedPlans, oldPlanWeights, modelError,
// familyHint, accountPolicy and optional scoutHelper, monoModelNames and keyPrompt. models has
// pins (slot -> { model, effort? }), format, efforts, hubPattern, and optional slotAliases,
// effortError, familyCommand and bareTierSet. placement has workerRank, leadDefault, seenByDefault,
// addOnMigration and appendWhenRequested. report.useHookText, stopWhenEnded,
// optional asideParentField, hook.payload and hook.sessionFromEnv, recoverRank
// recoverFallback and usage.showWarning, usage.probeWhileLive and usage.tryEveryMachine and usage.defaultProblem carry the remaining dispatch data. Nullable values mean
// the option does not apply; omitted fields are optional.
const REQUIRED = { machine: ['command', 'firstMessage', 'readyText', 'answerPrompts', 'findTranscript', 'loginEnv', 'seed', 'loginCommand', 'parseLogin', 'loginStatus'], hub: ['parseChat', 'readReport'] };
const members = { usageProbe: ['usageProbe'], usageEvents: ['usageFrom'], preflight: ['preflightCommand'], sandbox: ['sandboxed', 'sandboxWrap'], restartLoss: ['restartLossReason'], projectTools: ['projectToolReason', 'projectToolFileWarning'], recover: ['recognizePane'], spend: ['spend'], liveSwitch: ['usual'], aside: ['asideArgv', 'asideResult', 'asideModel'], versionCheck: ['checkVersion', 'versionStatus'], steps: ['readSteps', 'stepsReady'] };
const CAPABILITIES = Object.fromEntries(Object.entries(members).map(([name, machine]) => [name, { machine, hub: [] }]));
// Keep aligned with codex/model.sh's PIN_MODEL, which reads and writes the shared pin file.
const PIN_MODEL = /^[a-z0-9][a-z0-9._/:-]*$/;
// Keep aligned with machine/service.js EFFORTS and viewer/app/sessions.js checkEffort.
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const OPTIONAL = { machine: ['prepare', 'shellToolsOnly', 'keyedToolsReason', 'sessionNameEnv', 'promptText', 'retryStartupEnter', 'onTurnEnded', 'loginCwd', 'loginPrompt', 'loginDone', 'codeNeedsPrompt', 'resolveCli', 'redact', 'stepVocabulary', 'bindTranscript', 'spoolWaiting', 'validTranscript', 'disableProjectServers', 'asideNewId', 'asidePrepare', 'asideMessage', 'asideProblem', 'stylePreviewArgv', 'recordLaunch', 'launchPath', 'launchContext', 'failureNote', 'beforeTurnEvent', 'loginResult', 'loginState', 'startupCheck', 'checkPiVersion', 'piVersionStatus', 'checkKimiVersion', 'kimiLaunchPath', 'kimiVersionStatus'], hub: [] };
function validate(manifest, half, mod) {
  const fail = member => { throw new Error(`${manifest.cli}: ${member}`); };
  if (half === 'machine' && 'provider' in mod) fail('provider');
  if (half === 'machine' && (manifest.stylePreview ? typeof mod.stylePreviewArgv !== 'function' : 'stylePreviewArgv' in mod)) fail('stylePreviewArgv');
  for (const member of REQUIRED[half]) if (typeof mod[member] !== 'function') fail(member);
  if (half === 'machine' && (typeof mod.hookEvent === 'function') === (typeof mod.turnPoller === 'function')) fail('hookEvent/turnPoller');
  if (half === 'machine' && typeof mod.hookEvent === 'function' && !['stdin', 'last-arg'].includes(manifest.hook?.payload)) fail('hook.payload');
  if (half === 'machine' && typeof mod.turnPoller === 'function' && manifest.hook !== undefined) fail('hook');
  if (half === 'machine') for (const member of ['bindTranscript', 'spoolWaiting', 'validTranscript']) if (typeof mod.turnPoller === 'function' ? typeof mod[member] !== 'function' : member in mod) fail(member);
  for (const [cap, halves] of Object.entries(CAPABILITIES)) for (const member of halves[half]) {
    if (manifest.capabilities[cap] ? (member === 'asideModel' ? !(mod[member] instanceof RegExp) : typeof mod[member] !== 'function') : member in mod) fail(member);
  }
}
function validateManifest(m) {
  function check(field, pred, required = true) { const value = field.split('.').reduce((o, k) => o?.[k], m); if ((required || value !== undefined) && !pred(value)) throw new Error(`${m?.cli || 'connector'}: ${field}`); }
  const str = v => typeof v === 'string', bool = v => typeof v === 'boolean', obj = v => !!v && typeof v === 'object' && !Array.isArray(v), arr = Array.isArray;
  for (const f of ['cli','provider','label','displayName','install.command','install.binary','settings.modelPattern','settings.modelError','models.format','models.hubPattern']) check(f,str);
  check('settings.modelError', v => str(v) && v.length > 0);
  for (const f of ['typesRoleMessage','singleAccount']) check(f,bool);
  for (const f of ['capabilities','install','settings','models','models.pins','placement','settings.weights']) check(f,obj);
  for (const cap of Object.keys(CAPABILITIES)) check(`capabilities.${cap}`,bool);
  check('settings.weights.unknown', v => typeof v === 'number' && Number.isFinite(v));
  check('settings.plans', v => arr(v) && v.every(pair => arr(pair) && pair.length === 2 && pair.every(s => str(s) && s.length > 0)) && v.some(([key]) => key === 'unknown') && v.every(([key]) => Object.hasOwn(m.settings.weights, key)));
  check('models.efforts',v=>arr(v)&&v.every((word, i) => str(word) && EFFORTS.indexOf(word) >= 0 && (i === 0 || EFFORTS.indexOf(word) > EFFORTS.indexOf(v[i - 1])))); check('placement.workerRank',v=>v===null||typeof v==='number');
  for (const f of ['stylePreview','wrapProjectTools','injectProjectKeys','joinPaneLines','hook.sessionFromEnv','report.useHookText','stopWhenEnded','install.sensitivity','placement.leadDefault','placement.seenByDefault','placement.addOnMigration','placement.appendWhenRequested','models.familyCommand','models.bareTierSet','usage.showWarning','usage.probeWhileLive','usage.tryEveryMachine','settings.monoModelNames','usage.defaultProblem']) check(f,bool,false);
  check('shortName',str,false);
  if (m.capabilities.aside) check('asideParentField',str); else if ('asideParentField' in m) throw new Error(`${m.cli}: asideParentField`);
  check('login.killTarget',v=>['pane','session','name'].includes(v),false);
  check('install.lookup',v=>['path','absolute','fallback'].includes(v));
  if (m.install.lookup === 'fallback') check('install.fallbackPath', v => str(v) && v.length > 0);
  check('install.versionArgs',v=>v===null||(arr(v)&&v.every(str)),false);
  for (const f of ['install.node','install.fallbackPath','settings.modelPlaceholder','settings.cliLabel','settings.vendor','settings.setupUrl','settings.signInKind','settings.modelError','models.effortError','settings.keyPrompt','settings.scoutHelper','settings.roleInstructionsName']) check(f,str,false);
  if (m.settings.signInKind === 'key') check('settings.keyPrompt', v => str(v) && v.length > 0);
  for (const f of ['settings.permissionMode','settings.accountWarning','settings.familyHint','settings.accountPolicy']) check(f,v=>v===null||str(v),false);
  if (m.settings.permissionMode) check('settings.permissionName', v => str(v) && v.length > 0);
  else if ('permissionName' in m.settings) throw new Error(`${m.cli}: settings.permissionName`);
  for (const f of ['settings.modelHeadsUp','settings.reviewFamily']) check(f,bool,false);
  check('settings.permissionChoices',arr,false);
  for (const f of ['settings.reportedPlans','settings.oldPlanWeights','models.slotAliases','report','hook']) check(f,obj,false);
  for (const f of ['install.pathRank','recoverRank']) check(f,v=>v===null||typeof v==='number',false);
  check('recoverFallback',bool,false);
  check('recoverRank',v=>typeof v==='number'||(!m.capabilities?.recover&&v===null),Boolean(m.capabilities?.recover));
  check('install.label',str);
  for (const field of ['models.format', 'models.hubPattern', 'settings.modelPattern']) check(field, v => v.startsWith('^') && v.endsWith('$'));
  for (const slot of ['light', 'standard', 'heavy', 'critical', 'lead']) check(`models.pins.${slot}`, obj);
  for (const slot of Object.keys(m.models.pins)) if (!['light', 'standard', 'heavy', 'critical', 'lead'].includes(slot)) throw new Error(`${m.cli}: models.pins.${slot}`);
  const modelFormat = new RegExp(m.models.format);
  for (const [slot, pin] of Object.entries(m.models.pins)) {
    const field = `models.pins.${slot}`;
    if (!obj(pin) || !str(pin.model) || (pin.effort !== undefined && !str(pin.effort))) throw new Error(`${m.cli}: ${field}`);
    if (pin.effort !== undefined && (!EFFORTS.includes(pin.effort) || !m.models.efforts.includes(pin.effort))) throw new Error(`${m.cli}: models.efforts`);
    if (pin.model !== 'none' && (!PIN_MODEL.test(pin.model) || !modelFormat.test(pin.model))) throw new Error(`${m.cli}: ${field}`);
  }
  check('settings.modelOptions', v => obj(v) && (arr(v.fixed) && v.fixed.every(pair => arr(pair) && pair.length === 2 && pair.every(str)) || str(v.listedKey) && ['strings','objects'].includes(v.listedShape) && typeof v.includePins === 'boolean'), false);
  check('hook.payload',v=>v==='stdin'||v==='last-arg', Boolean(m.hook));
}
function validateRegistry(manifests) { manifests.forEach(validateManifest); if (manifests.filter(m=>m.stylePreview).length>1) throw new Error('stylePreview'); if (manifests.filter(m=>m.capabilities.preflight).length>1) throw new Error('capabilities.preflight'); if (manifests.filter(m=>m.capabilities.spend).length>1) throw new Error('capabilities.spend'); if (manifests.filter(m=>m.install.sensitivity).length>2) throw new Error('install.sensitivity'); }
module.exports = { REQUIRED, CAPABILITIES, OPTIONAL, EFFORTS, validate, validateManifest, validateRegistry };
