'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHarness } = require('./harness');
(async () => {
  let h; const rows = [];
  const row = (name, ok, detail) => { rows.push({name, ok, detail}); console.log(`${name} | ${ok ? 'PASS' : 'FAIL'} | ${detail}`); };
  try {
    h = await createHarness({mode:'live', hubSettings:{lead_order:['kimi'], worker_order:['kimi'], held_back:{worker:false,reviewer:false,verifier:false,mapper:false}, margin:0, leave:0}});
    const thread = await h.callHub('/api/threads', 'POST', {project:h.paths.clone, machine:'harness', cli:'kimi', title:'Kimi live check'});
    const id = thread.id, lead = thread.sessions.find(s => s.role === 'lead').name;
    console.log(`thread=${id} lead=${lead}`);
    const getThread = async () => (await h.callHub('/api/threads')).threads.find(t => t.id === id);
    const machine = async n => (await h.callMachine('/v1/sessions')).find(s => s.name === n);
    try {
      const ready = await h.waitFor(async () => {const s=await machine(lead); return s?.status === 'ready' && s.source_transcript && s;}, 120000);
      console.log(`ready=${JSON.stringify({status:ready.status,source_transcript:ready.source_transcript})}`);
      const pane = h.tmux('capture-pane','-pt',lead).stdout; console.log(`READY PANE\n${pane}`);
      await h.waitFor(async () => (await machine(lead))?.kimi_last_turn !== undefined, 120000);
      const prior = (await machine(lead)).kimi_last_turn;
      await h.callHub(`/api/threads/${id}/messages`,'POST',{text:'Reply exactly: KIMI_LIVE_OK'});
      await h.waitFor(async()=> {const s=await machine(lead); return s?.kimi_last_turn > prior && s;},120000);
      const chat=await h.callHub(`/api/threads/${id}/chat`); console.log(`CHAT ${JSON.stringify(chat)}`);
      assert(JSON.stringify(chat).includes('KIMI_LIVE_OK'));
      row('1 lead chat',true,lead);
    } catch(e) { row('1 lead chat',false,e.stack); console.log(`PANE\n${h.tmux('capture-pane','-pt',lead).stdout}`); }
    let reviewer;
    try {
      const response = await fetch(`http://127.0.0.1:${h.ports.hub}/wheelchair/api/machine/session`, {method:'POST',headers:{'content-type':'application/json','x-wheelchair-machine-secret':'harness-machine-secret'},body:JSON.stringify({calling_session:lead,action:'start',role:'reviewer',provider:'kimi',attempt_id:'kimi-review',brief:'Review only this request. Reply with the single sentence KIMI_REVIEW_OK.'})});
      const started=await response.json(); assert(response.ok,JSON.stringify(started)); reviewer=started.session.name; console.log(`reviewer=${reviewer}`);
      const result=await h.waitFor(async()=>{const t=await getThread(); return t.cards.find(c=>c.kind==='result' && c.session===reviewer) || t.sent?.find(x=>x.source==='result' && x.text?.includes('KIMI_REVIEW_OK'));},180000);
      row('2 reviewer result',true,JSON.stringify(result));
    } catch(e){row('2 reviewer result',false,e.stack);}
    try {
      const before=(await machine(lead)).kimi_last_turn;
      await h.callHub(`/api/threads/${id}/messages`,'POST',{text:'Use your Task tool to delegate a tiny task to a subagent: ask it to return the word OK. After it finishes, reply MAIN_SUBAGENT_DONE.'});
      const done=await h.waitFor(async()=>{const s=await machine(lead); return s?.kimi_last_turn > before && s;},180000);
      const wire=fs.readFileSync(done.source_transcript,'utf8').split('\n').filter(Boolean).map(JSON.parse);
      const rowsForTurn=wire.filter(x=>String(x.turnId ?? x.event?.turnId)===String(done.kimi_last_turn));
      assert(rowsForTurn.some(x=>/Task|Agent/.test(x.event?.name || '')),'no subagent tool call');
      assert.equal(rowsForTurn.filter(x=>x.type==='turn.ended').length,1);
      assert(JSON.stringify(rowsForTurn).includes('MAIN_SUBAGENT_DONE'));
      row('3 subagent turn',true,`turn=${done.kimi_last_turn} end=${JSON.stringify(rowsForTurn.filter(x=>x.type==='turn.ended'))}`);
    } catch(e){row('3 subagent turn',false,e.stack);}
    try {
      const before=(await machine(lead)).kimi_last_turn;
      await h.callHub(`/api/threads/${id}/messages`,'POST',{text:'Think carefully for a long time about the nature of mathematics, then give a detailed essay.'});
      await h.waitFor(async()=>{const s=await machine(lead); const rows=fs.readFileSync(s.source_transcript,'utf8'); return rows.includes('nature of mathematics');},30000);
      await h.callMachine(`/v1/sessions/${encodeURIComponent(lead)}/keys`,'POST',{keys:'Escape'});
      const done=await h.waitFor(async()=>{const s=await machine(lead); return s?.kimi_last_turn > before && s;},60000);
      const ends=fs.readFileSync(done.source_transcript,'utf8').split('\n').filter(Boolean).map(JSON.parse).filter(x=>x.type==='turn.ended' && x.turnId===done.kimi_last_turn);
      assert.equal(ends[0]?.reason,'cancelled'); row('4 interrupt',true,JSON.stringify(ends));
    } catch(e){row('4 interrupt',false,e.stack);}
    let worker;
    try {
      const start=await h.agent({action:'start',role:'worker',provider:'kimi',tier:'light',effort:'low',attempt_id:'kimi-low',brief:'Run the shell command `touch smoke-ok`, then reply done.'}); worker=start.session.name; console.log(`effort worker=${worker}`);
      let captures=[]; const poll=setInterval(()=>{const pane=h.tmux('capture-pane','-pt',worker); if(pane.status===0 && pane.stdout && !captures.includes(pane.stdout)) captures.push(pane.stdout);},100);
      try {
        await h.waitFor(()=>captures.some(x=>/thinking:\s*low/i.test(x)),60000);
        row('5 effort footer',true, captures.find(x=>/thinking:\s*low/i.test(x)).split('\n').find(x=>/thinking:\s*low/i.test(x)).trim());
        await h.waitFor(()=>captures.some(x=>/approval|allow|permission/i.test(x)),60000);
        const pane=captures.find(x=>/approval|allow|permission/i.test(x)); console.log(`APPROVAL PANE\n${pane}`);
        const adapter=require('../../machine/adapters/kimi'); assert(adapter.promptText(pane)); row('approval prompt',true,'promptText matched captured pane');
      } finally {clearInterval(poll);}
      const trust=captures.find(x=>x.includes('Trust this folder?')); console.log(`TRUST PANE\n${trust || 'not captured'}`);
    } catch(e){row('effort or approval',false,e.stack);}

  } catch(e) {row('setup',false,e.stack);}
  finally {if(h) {const clean=await h.teardown(); console.log(`cleanup ${JSON.stringify(clean)}`);}}
  console.log(`${rows.filter(r=>r.ok).length} passed; ${rows.filter(r=>!r.ok).length} failed`);
  process.exitCode=rows.some(r=>!r.ok)?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
