'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTempSync } = require('../../test-support/run-dir');
const input = require('../lib/screen-input');
const { typeTimeoutMs } = require('../lib/screen-args');
function setup(extra = {}) {
  const dir = makeTempSync('screen-input-'), bin = path.join(dir, 'bin'), log = path.join(dir, 'log'); fs.mkdirSync(bin);
  const script = `#!/bin/bash
line=$(basename "$0")
printf -v args '|%s' "$@"
printf '%s%s\\n' "$line" "$args" >> "$LOG"
if [[ "$STALL" == "$1:$2" || "$STALL" == "$1" ]]; then exec sleep 2; fi
if [[ "$FAIL" == "$1:$2" || "$FAIL" == "$1" || "$FAIL" == "$1:$3:$4" ]]; then printf 'first\\nlast error\\n' >&2; exit 1; fi
case "$(basename "$0"):$1" in
xwininfo:-root) printf '%s\\n' "\${ROOT:-0 children:}";;
xwininfo:-id) cat "$DATA/$2" 2>/dev/null || exit 1;;
xdotool:getwindowgeometry) printf '%s\\n' "\${GEOM:-X=0
Y=0
WIDTH=20
HEIGHT=20}";;
ffmpeg:*) printf PNG > "\${@: -1}";;
esac
`;
  for (const name of ['xdotool','xwininfo','ffmpeg']) fs.writeFileSync(path.join(bin,name),script,{mode:0o755});
  return { dir, log, ctx:{env:{...process.env, PATH:`${bin}:${process.env.PATH}`, DISPLAY:':7', LOG:log, DATA:dir, ...extra}}, lines:()=>fs.existsSync(log)?fs.readFileSync(log,'utf8').trim().split('\n'):[] };
}
function info(id, name = 'app', state = 'IsViewable') { return `xwininfo: Window id: 0x${id.toString(16)} ${name === null ? '(has no name)' : `"${name}"`}
  Absolute upper-left X: 1
  Absolute upper-left Y: 2
  Width: 30
  Height: 40
  Map State: ${state}\n`; }
function windows(s) { s.ctx.env.ROOT='3 children:\n  0x1 "one"\n  0x2 (has no name)\n  0x3 "hidden"'; fs.writeFileSync(path.join(s.dir,'1'),info(1,'one')); fs.writeFileSync(path.join(s.dir,'2'),info(2,null)); fs.writeFileSync(path.join(s.dir,'3'),info(3,'hidden','IsUnMapped')); }
test('windows: viewable direct children, untitled, empty and vanished', async()=>{ const s=setup(); windows(s); assert.deepEqual(await input.listWindows(s.ctx),[{id:1,name:'one',x:1,y:2,width:30,height:40},{id:2,name:'',x:1,y:2,width:30,height:40}]); fs.unlinkSync(path.join(s.dir,'2')); assert.equal((await input.listWindows(s.ctx)).length,1); s.ctx.env.ROOT='0 children:'; assert.deepEqual(await input.listWindows(s.ctx),[]); });
test('shot: full screen, clipped window, off screen and ffmpeg errors',async()=>{const s=setup(), out=path.join(s.dir,'out.png'); assert.deepEqual(await input.shot(s.ctx,{size:{width:1280,height:800},window:null,outPath:out}),{path:out,width:1280,height:800}); assert.equal(fs.readFileSync(out,'utf8'),'PNG'); assert.match(s.lines()[0],/ffmpeg\|-loglevel\|error\|-y\|-f\|x11grab\|-video_size\|1280x800\|-i\|:7\|-frames:v\|1\|.*\.tmp-\d+\.png$/); s.ctx.env.GEOM='X=-5\nY=790\nWIDTH=21\nHEIGHT=20'; assert.deepEqual(await input.shot(s.ctx,{size:{width:1280,height:800},window:1,outPath:out}),{path:out,width:16,height:10}); assert.match(s.lines().at(-1),/16x10\|-i\|:7\+0,790/); s.ctx.env.GEOM='X=1300\nY=0\nWIDTH=20\nHEIGHT=20'; await assert.rejects(input.shot(s.ctx,{size:{width:1280,height:800},window:1,outPath:out}),{status:422}); s.ctx.env.FAIL='-loglevel'; await assert.rejects(input.shot(s.ctx,{size:{width:1280,height:800},window:null,outPath:out}),{status:422,message:'last error'}); });
test('pointer: exact move click drag and release on failure',async()=>{const s=setup(); await input.pointer(s.ctx,'move',{x:1,y:2}); await input.pointer(s.ctx,'click',{x:3,y:4,button:3,double:true}); await input.pointer(s.ctx,'drag',{x1:1,y1:2,x2:3,y2:4}); assert.deepEqual(s.lines(),['xdotool|mousemove|--|1|2','xdotool|mousemove|--|3|4','xdotool|click|--repeat|2|--|3','xdotool|mousemove|--|1|2','xdotool|mousedown|--|1','xdotool|mousemove|--|3|4','xdotool|mouseup|--|1']); s.ctx.env.FAIL='mousemove:3:4'; await assert.rejects(input.pointer(s.ctx,'drag',{x1:1,y1:2,x2:3,y2:4})); assert.equal(s.lines().at(-1),'xdotool|mouseup|--|1'); });
test('type: literal option and scaled timeout',async()=>{const s=setup(); await input.typeText(s.ctx,'--window'); assert.equal(s.lines()[0],'xdotool|type|--delay|20|--|--window'); assert.equal(typeTimeoutMs('abcd'),10120); });
test('keys: taps, hold order and failed keydown releases',async()=>{const s=setup(); await input.pressKeys(s.ctx,{hold:null,tokens:['a','ctrl+s']}); let t=Date.now(); await input.pressKeys(s.ctx,{hold:80,tokens:['ctrl','a']}); assert.ok(Date.now()-t>=70); assert.deepEqual(s.lines().slice(0,4),['xdotool|key|--|a','xdotool|key|--|ctrl+s','xdotool|keydown|--|ctrl','xdotool|keydown|--|a']); assert.deepEqual(new Set(s.lines().slice(4)),new Set(['xdotool|keyup|--|a','xdotool|keyup|--|ctrl'])); s.ctx.env.FAIL='keydown'; await assert.rejects(input.pressKeys(s.ctx,{hold:50,tokens:['a']}),{status:422}); assert.equal(s.lines().at(-1),'xdotool|keyup|--|a'); });
test('keys: deadline cuts tap, releases it, and stops further taps',async()=>{const s=setup({STALL:'key'}); await assert.rejects(input.pressKeys(s.ctx,{hold:null,tokens:['a','b']},{baseDeadlineMs:100}),{status:422}); assert.deepEqual(s.lines(),['xdotool|key|--|a','xdotool|keyup|--|a']); });
test('keys: failed and stalled releases lock input without starving others',async()=>{const s=setup({FAIL:'keyup'}); await assert.rejects(input.pressKeys(s.ctx,{hold:50,tokens:['a']}),{status:422,lockInput:true}); delete s.ctx.env.FAIL; s.ctx.env.STALL='keyup'; const t=Date.now(); await assert.rejects(input.pressKeys(s.ctx,{hold:50,tokens:['a','b']}),{status:422,lockInput:true}); assert.ok(Date.now()-t<1200); assert.ok(s.lines().includes('xdotool|keyup|--|a')); assert.ok(s.lines().includes('xdotool|keyup|--|b')); });
test('focus: exact argv and failure',async()=>{const s=setup(); await input.focusWindow(s.ctx,12); assert.equal(s.lines()[0],'xdotool|windowfocus|--|12'); s.ctx.env.FAIL='windowfocus'; await assert.rejects(input.focusWindow(s.ctx,12),{status:422}); });
test('autofocus: baseline, first new window, none, failure and stalled probe',async()=>{const s=setup(); windows(s); assert.deepEqual(await input.windowIds(s.ctx,{}),[1,2]); assert.deepEqual(await input.autoFocus(s.ctx,[1],{pollMs:10,waitMs:100}),{id:2,name:''}); assert.equal(await input.autoFocus(s.ctx,[1,2],{pollMs:10,waitMs:30}),null); s.ctx.env.FAIL='windowfocus'; assert.equal(await input.autoFocus(s.ctx,[1],{waitMs:100}),null); delete s.ctx.env.FAIL; s.ctx.env.STALL='-root'; const t=Date.now(); assert.equal(await input.autoFocus(s.ctx,[],{probeTimeoutMs:50,phaseMs:100,waitMs:100}),null); assert.ok(Date.now()-t<500); assert.equal(await input.autoFocus(s.ctx,null),null); });
test('runTool: timeout kills process',async()=>{const s=setup({STALL:'key'}); const r=await input.runTool('xdotool',['key','--','a'],{env:s.ctx.env,timeoutMs:50}); assert.equal(r.timedOut,true); assert.equal(r.ok,false); });
