const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main(){
 const base=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8'),cut=base.indexOf('  const local = harness();');assert.ok(cut>0);
 const prefix=base.slice(0,cut).replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')","module.mutateGameSource(fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8'))");
 async function make(enabled){const mod=new Module(path.join(__dirname,'mouse-trace-harness.cjs'),module);mod.filename=path.join(__dirname,'mouse-trace-harness.cjs');mod.paths=module.paths;
  mod.mutateGameSource=s=>enabled?s.replace("typeof location!=='undefined'&&new URLSearchParams(location.search).has('inputTrace')",'true'):s;
  mod._compile(prefix+'\n return {harness};\n}\nmodule.exports=main;',mod.filename);const {harness}=await mod.exports();const h=harness();h.reset();h.run('locked=false;document.pointerLockElement=null;resetMouseLook();match.phase="buy"');return h;}
 const normal=await make(false),traced=await make(true);let groups=0;
 const test=(name,fn)=>{fn();groups++;console.log('PASS: '+name)};
 function move(h,i){h.sandbox.e={clientX:400+i%180,clientY:300+Math.sin(i)*20,movementX:1,movementY:Math.cos(i)*20,timeStamp:1000+i*8};h.run('observeMouseLook({...e,target:canvas})');}
 test('default browser session has no input recording or diagnostic DOM writes',()=>{move(normal,0);move(normal,1);normal.run('flushMouseInputTrace()');assert.equal(normal.run('mouseInputTrace'),null);assert.equal(normal.elements.get('mouse-input-diagnostics')?.textContent||'','')});
 test('opt-in observer preserves actual pitch/yaw exactly and does not write the DOM per event',()=>{
  for(let i=2;i<100;i++){move(normal,i);move(traced,i)}
  // Align the initial event streams before comparing both observers.
  normal.run('player.yaw=0;player.pitch=0;resetMouseLook()');traced.run('player.yaw=0;player.pitch=0;resetMouseLook();clearMouseInputTrace()');
  for(let i=0;i<100;i++){move(normal,i);move(traced,i)}
  assert.deepEqual(JSON.parse(normal.run('JSON.stringify([player.yaw,player.pitch])')),JSON.parse(traced.run('JSON.stringify([player.yaw,player.pitch])')));
  assert.equal(traced.elements.get('mouse-input-diagnostics')?.textContent||'','');
 });
 test('pause freezes a chronological finite ring including raw deltas, lock and resulting pitch',()=>{
  for(let i=100;i<2200;i++)move(traced,i);
  traced.run('pauseGame()');const report=JSON.parse(traced.elements.get('mouse-input-diagnostics').textContent);
  assert.equal(report.rows.length,2048);assert.equal(report.rows[0][0],1000+152*8);assert.equal(report.rows.at(-1)[0],1000+2199*8);
  assert.equal(report.columns.length,18);assert.ok(report.rows.every(row=>row.every(n=>n===null||Number.isFinite(n))));
  const frozen=traced.elements.get('mouse-input-diagnostics').textContent;move(traced,2300);assert.equal(traced.elements.get('mouse-input-diagnostics').textContent,frozen);
  assert.equal(report.rows.at(-1)[9],traced.run('player.pitch'));assert.equal(report.rows.at(-1)[5],0);
 });
 test('new match and menu clear diagnostic samples without persistence or network payload changes',()=>{
  traced.run('startGame()');assert.equal(traced.run('mouseInputTrace.size'),0);assert.equal(traced.elements.get('mouse-input-diagnostics').textContent,'');
  traced.run('mode="play"');move(traced,0);traced.run('backMenu()');assert.equal(traced.run('mouseInputTrace.size'),0);assert.equal(traced.elements.get('mouse-input-diagnostics').textContent,'');
  const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8'),start=source.indexOf('function clearMouseInputTrace'),end=source.indexOf('function look(',start);
  assert.doesNotMatch(source.slice(start,end),/fetch\(|localStorage|online\.send|console\./);
  assert.match(fs.readFileSync(path.join(__dirname,'public/play.html'),'utf8'),/id="mouse-input-diagnostics" hidden aria-hidden="true"/);
 });
 console.log(`PASS: ${groups} local-only diagnostic groups; no audio`);return groups;
}
module.exports=main;if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
