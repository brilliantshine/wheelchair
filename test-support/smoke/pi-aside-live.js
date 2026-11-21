'use strict';
// Live, paid check: deliberately excluded from the test runners.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { AsideTurns } = require('../../machine/lib/aside-turns');
const pi = require('../../machine/adapters/pi');
const auth = path.join(process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), '.pi/agent'), 'auth.json');
let available = !!process.env.OPENROUTER_API_KEY;
try { available ||= !!JSON.parse(fs.readFileSync(auth, 'utf8')).openrouter; } catch {}
if (spawnSync('sh', ['-c', 'command -v pi'], { stdio: 'ignore' }).status !== 0) console.log('SKIP | pi is not on PATH');
else if (!available) console.log('SKIP | no OpenRouter key available');
else run().catch(error => { console.error('FAIL | ' + pi.redact(error.message)); process.exitCode = 1; });
async function run() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-aside-live-')), cwd = path.join(dir, 'work'), account = path.join(dir, 'account');
  fs.mkdirSync(cwd); fs.mkdirSync(account); if (fs.existsSync(auth)) fs.copyFileSync(auth,path.join(account,'auth.json'));
  const parent = crypto.randomUUID(), fork = crypto.randomUUID(), timestamp = new Date().toISOString(), ms = Date.now();
  const folder = path.join(account,'sessions','--'+cwd.replace(/^[/\\]/,'').replace(/[/\\:]/g,'-')+'--'); fs.mkdirSync(folder,{recursive:true});
  const lines = [
    {type:'session',version:3,id:parent,timestamp,cwd},
    {type:'message',id:'a1b2c3d4',parentId:null,timestamp,message:{role:'user',content:'Say hello.',timestamp:ms}},
    {type:'message',id:'b2c3d4e5',parentId:'a1b2c3d4',timestamp,message:{role:'assistant',content:[{type:'text',text:'Hello.'}],api:'openai-completions',provider:'openrouter',model:'deepseek/deepseek-v4.1-flash-1017',usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:'stop',timestamp:ms}}
  ];
  fs.writeFileSync(path.join(folder,`${timestamp.replace(/:/g,'-')}_${parent}.jsonl`),lines.map(JSON.stringify).join('\n')+'\n');
  const store = new AsideTurns(dir,async (file,data)=>fs.promises.writeFile(file,data),x=>x);
  const turn = async (mode,from,prompt) => { const turn_id=crypto.randomUUID(); await store.start({turn_id,provider:'openrouter',mode,from,new_id:fork,cwd,model:'deepseek/deepseek-v4.1-flash-1017',prompt,account_dir:account}); while(store.get(turn_id).state==='running') await new Promise(r=>setTimeout(r,100)); const result=store.result(store.get(turn_id)); if(result.state!=='ok'||result.conversation_id!==fork||!result.reply) throw Error(result.error||'missing id or reply'); };
  await turn('fork',parent,'Say hello in one word.'); console.log('fork | PASS | new id and reply');
  await turn('resume',fork,'Say goodbye in one word.'); console.log('resume | PASS | same id and reply');
}
