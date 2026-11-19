'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { OPS, parseOp, isKeyToken, typeTimeoutMs, parseRootChildren, parseWindowInfo } = require('../lib/screen-args');
const bad = (op, args) => assert.throws(() => parseOp(op, args), e => e.status === 400);

test('operation shapes and basic validation', () => {
  assert.deepEqual(OPS, ['start','run','shot','windows','move','click','drag','type','key','focus','stop','status']);
  assert.deepEqual(parseOp('start', []), {size:{width:1280,height:800}});
  assert.deepEqual(parseOp('start', ['--size','200x2560']), {size:{width:200,height:2560}});
  for (const size of ['2561x800','199x800','abcx10']) bad('start', ['--size',size]);
  assert.deepEqual(parseOp('shot', []), {window:null});
  assert.deepEqual(parseOp('shot', ['--window','123']), {window:123});
  for (const op of ['windows','stop','status']) { assert.deepEqual(parseOp(op, []), {}); bad(op, ['extra']); }
  assert.deepEqual(parseOp('move', ['0','123']), {x:0,y:123});
  assert.deepEqual(parseOp('click', ['2','3','--double','--button','right']), {x:2,y:3,button:3,double:true});
  assert.deepEqual(parseOp('click', ['2','3']), {x:2,y:3,button:1,double:false});
  assert.deepEqual(parseOp('drag', ['1','2','3','4']), {x1:1,y1:2,x2:3,y2:4});
  assert.deepEqual(parseOp('focus', ['42']), {window:42});
  for (const x of ['-1','1.5','0x10',' 1','12345678']) bad('move', [x,'1']);
  bad('focus', ['12345678901']); bad('click', ['1','2','--double','--double']);
  bad('unknown', []); bad('move', '1'); bad('move', ['1', 2]);
});

test('run separates literal environment and command', () => {
  assert.deepEqual(parseOp('run', ['--env','A=$HOME=x','--env','B=','--','app','--flag']), {env:[['A','$HOME=x'],['B','']],command:['app','--flag']});
  assert.deepEqual(parseOp('run', ['--','--help']), {env:[],command:['--help']});
  for (const a of [['--','-'],['--','A=b'],['app'],['--'],['--',''], ...['DISPLAY=x','XAUTHORITY=x','WHEELCHAIR_SESSION_TOKEN=x','1A=x'].map(x => ['--env',x,'--','app'])]) bad('run', a);
});

test('fixed key grammar and limits', () => {
  const keys = [...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', ...Array.from({length:12}, (_, i) => `F${i+1}`), 'Return','Escape','Tab','space','BackSpace','Delete','Insert','Home','End','Page_Up','Page_Down','Up','Down','Left','Right','minus','equal','comma','period','slash','semicolon','apostrophe','bracketleft','bracketright','backslash','grave'];
  for (const key of keys) assert.equal(isKeyToken(key, {}), true, key);
  for (const key of ['ctrl+shift+s','super+alt+F12']) assert.deepEqual(parseOp('key', [key]), {hold:null,tokens:[key]});
  for (const key of ['exec','EXEC','windowkill','ctrl+','ctrl+ctrl+a','Ctrl+a','+a','shift']) bad('key', [key]);
  assert.equal(parseOp('key', Array(20).fill('a')).tokens.length, 20);
  bad('key', Array(21).fill('a'));
  assert.deepEqual(parseOp('key', ['--hold','100','shift','Right']), {hold:100,tokens:['shift','Right']});
  bad('key', ['--hold','100',...Array(7).fill('a')]);
  bad('key', ['--hold','49','a']); bad('key', ['--hold','5001','a']);
});

test('text is literal and limited', () => {
  for (const text of ['é','\x07','\r','', 'a'.repeat(401)]) bad('type', [text]);
  for (const text of ['hello\n\tworld', 'a'.repeat(400), '--window']) assert.deepEqual(parseOp('type', [text]), {text});
  assert.equal(typeTimeoutMs('abc'), 10090);
});

test('xwininfo root children and window details', () => {
  const root = `
xwininfo: Window id: 0x50d (the root window) (has no name)

  Root window id: 0x50d (the root window) (has no name)
  Parent window id: 0x0 (none)
     3 children:
     0x400001 "Hello": ("app" "App")  640x480+10+20  +10+20
     0x600001 (has no name): ()  200x100+0+0  +0+0
     0x800002 "Other": ("other" "Other")  10x10+1+1  +1+1
`;
  assert.deepEqual(parseRootChildren(root), [0x400001,0x600001,0x800002]);
  const oneChild = `
xwininfo: Window id: 0x39f (the root window) (has no name)

  Root window id: 0x39f (the root window) (has no name)
  Parent window id: 0x0 (none)
     1 child:
     0x200001 "xmessage": ("xmessage" "Xmessage")  184x68+0+0  +0+0
`;
  assert.deepEqual(parseRootChildren(oneChild), [0x200001]);
  assert.deepEqual(parseRootChildren('xwininfo: Window id: 0x50d\n     0 children.\n'), []);
  assert.deepEqual(parseRootChildren('no output'), []);
  const info = `
xwininfo: Window id: 0x400001 "A \"quoted\" title"

  Absolute upper-left X:  -10
  Absolute upper-left Y:  20
  Relative upper-left X:  10
  Relative upper-left Y:  20
  Width: 640
  Height: 480
  Depth: 24
  Map State: IsViewable
`;
  assert.deepEqual(parseWindowInfo(info), {id:0x400001,name:'A "quoted" title',x:-10,y:20,width:640,height:480,viewable:true});
  const unnamed = `
xwininfo: Window id: 0x600001 (has no name)

  Absolute upper-left X:  0
  Absolute upper-left Y:  1
  Width: 200
  Height: 100
  Map State: IsUnMapped
`;
  assert.deepEqual(parseWindowInfo(unnamed), {id:0x600001,name:'',x:0,y:1,width:200,height:100,viewable:false});
});
