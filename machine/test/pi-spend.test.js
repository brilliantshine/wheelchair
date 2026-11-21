'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const pi = require('../adapters/pi'), { MachineService } = require('../service'), { makeTempSync } = require('../../test-support/run-dir');
test('Pi spend counts samples, local day boundaries, numeric strings and excludes invalid rows', async () => {
  const dir = makeTempSync('pi-spend-'), folder = path.join(dir, 'sessions', 'nested'); fs.mkdirSync(folder, { recursive: true });
  const now = new Date(2026, 10, 20, 12), row = (date, cost, provider = 'openrouter') => JSON.stringify({ type: 'message', timestamp: date.toISOString(), message: { role: 'assistant', provider, usage: cost === undefined ? {} : { cost: { total: cost } } } });
  const samples = path.join(__dirname, '../../docs/plans/openrouter-harness/samples');
  for (const file of fs.readdirSync(samples).filter(n => /^pi-session-.*\.jsonl$/.test(n))) fs.copyFileSync(path.join(samples, file), path.join(folder, file));
  fs.writeFileSync(path.join(folder, 'synthetic.jsonl'), [row(new Date(2026,10,20,1), 1), row(new Date(2026,10,20,2), '0.5'), row(new Date(2026,10,19,23,59,59,999), 2), row(new Date(2026,10,14), 3), row(new Date(2026,10,13), 4), row(new Date(2026,9,22), 5), row(new Date(2026,9,21), 6), row(new Date(2026,10,20,1), 90, 'other'), row(new Date(2026,10,20,1), undefined), row(new Date(2026,10,20,1), 'bad'), row(new Date(2026,10,20,1), 'Infinity'), row(new Date(2026,10,20,13), 99), 'broken'].join('\n'));
  // Samples predate this fixed clock; compute their independent contribution to each bucket.
  let sample = { today: 0, last_7_days: 0, last_30_days: 0 };
  for (const file of fs.readdirSync(samples).filter(n => /^pi-session-.*\.jsonl$/.test(n))) for (const line of fs.readFileSync(path.join(samples,file),'utf8').split('\n')) { try { const r=JSON.parse(line), t=Date.parse(r.timestamp), c=r.message?.usage?.cost?.total; if (r.type !== 'message' || r.message?.role !== 'assistant' || r.message?.provider !== 'openrouter' || !Number.isFinite(c) || t > +now) continue; for (const [key,days] of [['today',1],['last_7_days',7],['last_30_days',30]]) if (t >= +new Date(2026,10,21-days)) sample[key]+=c; } catch {} }
  const got = await pi.spend(dir, now); for (const [key, value] of Object.entries({today:1.5,last_7_days:6.5,last_30_days:15.5})) assert.ok(Math.abs(got[key] - sample[key] - value) < 1e-9);
});
test('spend route requires hub authorization and lists Pi accounts including signed out', async () => {
  const root = makeTempSync('pi-spend-route-'), old = process.env.HOME; process.env.HOME = root;
  const accountRoot = path.join(root,'.wheelchair/accounts'); for (const [id,cli] of [['work','pi'],['other','claude']]) { const dir=path.join(accountRoot,id); fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(path.join(dir,'wheelchair-account.json'),JSON.stringify({id,cli})); }
  const machine = new MachineService({stateDir:root}); machine.status = () => { throw Error('status must not run'); }; machine.authorize = async req => { if (req.headers.authorization !== 'hub') throw Object.assign(new Error('unauthorized'),{status:401}); };
  const server = http.createServer((req,res)=>machine.handle(req,res)); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try { const url=`http://127.0.0.1:${server.address().port}/v1/spend`; assert.equal((await fetch(url)).status,401); const res=await fetch(url,{headers:{authorization:'hub'}}); assert.equal(res.status,200); assert.deepEqual(await res.json(),{accounts:[{account:'default-openrouter',today:0,last_7_days:0,last_30_days:0},{account:'work',today:0,last_7_days:0,last_30_days:0}]}); }
  finally { await new Promise(resolve=>server.close(resolve)); process.env.HOME=old; }
});
