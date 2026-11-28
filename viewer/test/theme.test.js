'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const palette = require('../pages/theme-palette');
const { startServer } = require('./helpers/server');
const edges = ['#000000','#696969','#6f6f6f','#777777','#8a8a8a','#8d8d8d','#8f8f8f','#ffffff','#ffff00','#ff0000','#00ff00','#5b9dd9','#d6a53b'];
test('parse colors and contrast inks', () => {
  assert.equal(palette.parseHexColor(' AbC '), '#aabbcc'); assert.equal(palette.parseHexColor('#A1B2C3'), '#a1b2c3');
  for (const bad of ['', '#abcd', 'xyz', null, 12]) assert.equal(palette.parseHexColor(bad), null);
  for (const color of edges) assert.ok(palette.contrast(color, palette.pickContrastInk(color)) >= 4.5);
});
test('palette contrast matrix', () => {
  for (const preset of palette.PRESETS) for (const mode of ['dark','light']) for (const accent of edges) {
    const v = palette.resolveTheme({ preset: preset.id, mode, accent }, false).vars;
    const check = (fg, bg, floor = 4.5) => assert.ok(palette.contrast(v[fg],v[bg]) >= floor, `${preset.id} ${mode} ${accent} ${fg} on ${bg}: ${palette.contrast(v[fg],v[bg])}`);
    for (const fg of ['--ink','--ink-2','--dim']) for (const bg of ['--bg','--panel','--panel-2']) check(fg,bg);
    check('--ink','--term-bg'); check('--bad-text','--figure'); check('--good-ink','--good');
    for (const fg of ['--ink','--dim','--good-text','--warn','--bad-text']) for (const bg of ['--bg','--panel','--panel-2','--accent-soft']) check(fg,bg);
    check('--accent-ink','--accent'); check('--accent-hover-ink','--accent-hover');
    for (const fg of ['--accent-text','--accent-hi']) for (const bg of ['--bg','--panel','--panel-2','--accent-soft','--accent-chip','--human']) check(fg,bg);
    for (const fg of ['--ink','--ink-2']) check(fg,'--human');
    for (const bg of ['--bg','--panel','--panel-2','--panel-3','--figure','--line-2','--accent-soft']) check('--accent-vis',bg,3);
  }
});
test('default dark tokens and spinner colors', () => {
  const v=palette.resolveTheme({mode:'dark',preset:'default',accent:null},false).vars;
  const expected={'--accent':'#5b9dd9','--accent-ink':'#0e1114','--accent-hover':'#a9cdf0','--accent-hover-ink':'#0e1114','--accent-vis':'#5b9dd9','--accent-soft':'#1a2230','--accent-line':'#3a5778','--accent-text':'#7fb4e6','--accent-hi':'#a9cdf0','--accent-chip':'#1f2b3a','--human':'#23303f'};
  for (const [k,value] of Object.entries(expected)) assert.equal(v[k],value);
  for (const k of ['--spinner-svg','--spinner-svg-reduced']) for (const c of [v['--ink'],v['--idle'],v['--accent-vis']]) assert.ok(v[k].includes(c.replace('#','%23')));
});
test('theme API saves, conflicts, validates and preserves settings', async () => {
  const ctx=await startServer(), file=path.join(ctx.stateDir,'settings.json');
  async function call(method='GET', body) { const url=new URL(`${ctx.url}/api/settings/theme`); if(method==='GET') url.searchParams.set('token',ctx.token); return fetch(url,{method,headers:{'x-graph-token':ctx.token,origin:new URL(ctx.url).origin,'content-type':'application/json'},body}); }
  try {
    let r=await call(), initial=await r.json(); assert.deepEqual(initial,{mode:'dark',preset:'default',accent:null,revision:0}); assert.equal(r.headers.get('cache-control'),'no-store');
    await fs.writeFile(file,JSON.stringify({theme:{bad:true}})); r=await call(); assert.deepEqual(await r.json(),initial);
    r=await call('PUT',JSON.stringify({mode:'light',preset:'forest',accent:'#ABCDEF',revision:0})); assert.equal(r.status,200); const saved=await r.json(); assert.deepEqual(saved,{mode:'light',preset:'forest',accent:'#abcdef',revision:1});
    const before=await fs.readFile(file,'utf8'); r=await call('PUT',JSON.stringify(saved)); assert.deepEqual(await r.json(),saved); assert.equal(await fs.readFile(file,'utf8'),before);
    r=await call('PUT',JSON.stringify({...saved,revision:0})); assert.equal(r.status,409); assert.deepEqual(await r.json(),{error:'Theme changed elsewhere',...saved});
    for (const bad of [{...saved,mode:'blue'},{...saved,accent:'#fff'},{...saved,revision:-1},[]]) { r=await call('PUT',JSON.stringify(bad)); assert.equal(r.status,400); assert.ok((await r.json()).error); }
    r=await call('PUT',' '.repeat(4097)); assert.equal(r.status,413); assert.deepEqual(await r.json(),{error:'Request body too large'});
    const settings=require('../app/settings'); let stored=JSON.parse(before); await settings.update({state:{updateSettings: async change => { stored=await change(stored); }}}, value => { value.user_name='Test'; }); assert.deepEqual(stored.theme,saved); assert.equal(stored.user_name,'Test');
    await fs.writeFile(file,'{broken'); for (const method of ['GET','PUT']) { r=await call(method,method==='PUT'?JSON.stringify(saved):undefined); assert.equal(r.status,500); assert.deepEqual(await r.json(),{error:'Could not read settings.json'}); assert.equal(await fs.readFile(file,'utf8'),'{broken'); }
  } finally { await ctx.stop(); }
});
