const assert=require('node:assert/strict'),run=require('./tests-mouse-low-latency.cjs');
(async()=>{
 for(const [name,from,to]of [
  ['duplicate compatibility movement',"if(mouseEventSource==='pointerrawupdate'&&locked&&document.pointerLockElement===canvas)return;",''],
  ['missing raw listener',"document.addEventListener('pointerrawupdate',event=>{","document.addEventListener('unused-pointerrawupdate',event=>{"],
  ['discarded coalesced flick',"look(event.movementX,event.movementY,mouseEventSource==='pointerrawupdate');","look(event.movementX,event.movementY);"]
 ]){let changed=false;await assert.rejects(run({mutate:s=>{assert.ok(s.includes(from));changed=true;return s.replace(from,to);}}),{name:'AssertionError'});assert.ok(changed);console.log('PASS detects '+name+' (memory only)');}
})().catch(e=>{console.error(e);process.exitCode=1;});
