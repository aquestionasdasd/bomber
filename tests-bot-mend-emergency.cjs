const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto');
async function main({mutate=s=>s,measure=false,only=()=>true}={}){
 const template=fs.readFileSync(path.join(__dirname,'tests-bot-mend-heal.cjs'),'utf8'),cut=template.indexOf(' if(baseline)');assert.ok(cut>0);
 const m=new Module(path.join(__dirname,'mend-emergency-harness.cjs'),module);m.filename=path.join(__dirname,'mend-emergency-harness.cjs');m.paths=module.paths;
 m._compile(template.slice(0,cut)+'\nreturn {h,setup,ally,event};\n}\nmodule.exports=main;',m.filename);
 const {h,setup:baseSetup,ally,event}=await m.exports({mutate});let groups=0;
 h.run('var emergencyOriginalActivate=activateAbility,emergencyOriginalBlind=ordinarySkills.blindUntil');
 function setup({key='c',target='self',points=0}={}){
  baseSetup(10);h.run('ordinarySkills.blindUntil=emergencyOriginalBlind');h.sandbox.scenario={key,target,points};
  h.run(`elapsed=0;worker.hp=100;worker.kit.smoke=scenario.key==='c'?1:0;worker.kit.updraft=scenario.key==='q'?1:0;worker.kit.ultPoints=scenario.points;
   var eAttempts=0,eCasts=0,firstHealAt=null,observedHP=0;
   activateAbility=function(a,k,o){if(a===worker&&k==='e')eAttempts++;const e=emergencyOriginalActivate(a,k,o);if(a===worker&&k==='e'&&e){eCasts++;if(firstHealAt===null)firstHealAt=elapsed;}return e;};
   updateBots.tactics.update=()=>({siteId:'A',defuserId:null,roles:new Map([[worker.id,{goal:{x:worker.x,z:worker.z},role:'guard',siteId:'A',urgent:true}]])});
  `);
  if(target==='ally')ally(100,5);
 }
 function step(dt=1/60){h.sandbox.stepDT=dt;const before=h.run("scenario.target==='ally'?friend.hp:worker.hp");h.run('updatePlay(stepDT)');const after=h.run("scenario.target==='ally'?friend.hp:worker.hp");if(after>before){h.sandbox.hpGain=after-before;h.run('observedHP+=hpGain');}}
 function run(seconds=3,hz=60){for(let i=0;i<Math.ceil(seconds*hz);i++)step(1/hz);return state();}
 const state=()=>JSON.parse(h.run("JSON.stringify({eAttempts,eCasts,firstHealAt,observedHP,hp:scenario.target==='ally'?friend.hp:worker.hp,points:worker.kit.ultPoints,stock:worker.kit.dash,signatureAt:worker.kit.nextSignatureAt,sharedAt:worker.nextSkillAt,healRetry:worker.nextMendHealAt,elapsed,events:ordinarySkills.events(elapsed).map(e=>e.type)})"));
 function prepare(cfg={},hz=60){setup(cfg);step(1/hz);const expected=cfg.key==='q'?'mend-pollen':'mend-seeds';assert.ok(state().events.includes(expected),expected);h.run("if(scenario.target==='ally')friend.hp=40;else worker.hp=40");}
 const test=(n,fn)=>{if(!only(n))return;fn();groups++;console.log('PASS: '+n);};
 if(measure){const rows=[];for(const key of ['c','q'])for(const target of ['self','ally'])for(const hz of [20,60,144]){prepare({key,target},hz);const s=run(3,hz);rows.push({key,target,hz,injuredAt:1/hz,...s});}return{kind:'Controlled real C/Q then injury; actual updatePlay once per frame, HP gains after real assignment only; no ordinary win-rate or damage-prevention claim.',sourceSha256:crypto.createHash('sha256').update(mutate(fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8'))).digest('hex'),rows};}
 test('C and Q shared wait no longer delay real self and ally E healing at 20 60 144Hz',()=>{for(const key of ['c','q'])for(const target of ['self','ally'])for(const hz of [20,60,144]){prepare({key,target},hz);const s=run(1,hz);assert.equal(s.hp,100);assert.equal(s.observedHP,60);assert.equal(s.eCasts,1);assert.ok(s.firstHealAt<=.6);assert.equal(s.stock,0);assert.ok(s.signatureAt>=s.firstHealAt+17.99);}});
 test('urgent E keeps seven X points and C Q cannot cast on the same frame',()=>{setup({points:7});h.run('worker.hp=40;worker.nextSkillAt=0');step();assert.ok(event());assert.equal(state().points,7);assert.equal(h.run('worker.kit.smoke'),1);assert.equal(h.run('worker.kit.updraft'),0);assert.ok(!state().events.includes('mend-seeds'));});
 test('shared C Q wait is still enforced when no healing is needed',()=>{setup();h.run('worker.nextSkillAt=2');run(.7);assert.equal(h.run('worker.kit.smoke'),1);assert.equal(state().eCasts,0);});
 test('full20event refusal rolls back E and bounds independent retries',()=>{setup();h.run("worker.hp=40;worker.nextSkillAt=99;for(let i=0;i<20;i++)ordinarySkills.cast('nope-bottle',{...ordinaryActorView(player),id:'full'+i,x:70,z:70},{x:70,y:.12,z:70},elapsed,match.round)");assert.equal(h.run('ordinarySkills.events(elapsed).length'),20);const before=h.run('JSON.stringify(worker.kit.snapshot())');step();assert.equal(state().eAttempts,1);assert.equal(state().eCasts,0);assert.equal(h.run('JSON.stringify(worker.kit.snapshot())'),before);run(.3);assert.equal(state().eAttempts,1);h.run('ordinarySkills.reset()');run(.3);assert.equal(state().eCasts,1);assert.equal(state().hp,100);});
 test('cooldown stock work sight phase host and blindness remain authoritative',()=>{
  for(const code of ['worker.kit.dash=0;worker.kit.nextSignatureAt=18',"worker.remoteId='friend'",'netHostPaused=true',"match.phase='buy'",'worker.alive=false;worker.hp=0','ordinarySkills.blindUntil=()=>100',"onlinePlaying=true;online={host:false,session:{memberId:'friend'}}"]){setup();h.run('worker.hp=40;worker.nextSkillAt=99');h.run(code);step();assert.equal(state().eCasts,0,code);assert.equal(h.run('worker.kit.dash'),code.startsWith('worker.kit.dash=0')?0:1,code);}
  setup({target:'ally'});h.run('friend.hp=40;friend.x=18.1;worker.nextSkillAt=99');step();assert.equal(state().eCasts,0);
  setup({target:'ally'});h.run('friend.hp=40;worker.nextSkillAt=99');h.wall({x:2.5,z:0,width:1,depth:6,height:4});step();assert.equal(state().eCasts,0);
  setup();h.run("worker.hp=40;worker.nextSkillAt=99;match.spike.status='planted';match.spike.x=0;match.spike.z=0;match.spike.site='A';worker.team=match.defenderTeam;player.team=match.attackerTeam;updateBots.tactics.update=()=>({siteId:'A',defuserId:worker.id,roles:new Map([[worker.id,{goal:{x:0,z:0},role:'defuse',siteId:'A',urgent:true}]])})");step();assert.ok(h.run('worker.defusing'));assert.equal(state().eCasts,0);
 });
 test('round menu cleanup clears only the local emergency retry and no cooldown bypass occurs',()=>{setup();h.run('worker.hp=40;worker.nextSkillAt=99');step();h.run('worker.hp=40');run(3);assert.equal(state().eCasts,1);assert.equal(state().hp,40);h.run('resetOrdinarySkills()');assert.equal(h.run('worker.nextMendHealAt'),0);h.run('worker.nextMendHealAt=99;backMenu()');assert.equal(h.run('worker.nextMendHealAt'),0);});
 console.log(`PASS: ${groups} actual full-frame MEND emergency groups; no audio`);return groups;
}
module.exports=main;if(require.main===module)main({measure:process.argv.includes('--measure')}).then(r=>{if(typeof r==='object')console.log(JSON.stringify(r))}).catch(e=>{console.error(e);process.exitCode=1});
