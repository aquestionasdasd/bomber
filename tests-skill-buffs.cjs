const assert=require('node:assert/strict');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

async function main(){
  const started=performance.now(),cpu=process.cpuUsage();
  const abilityPath=path.join(__dirname,'public/abilities.js'),enginePath=path.join(__dirname,'public/character-skills.js');
  const abilities=await import(pathToFileURL(abilityPath).href),{createCharacterSkills}=await import(pathToFileURL(enginePath).href);
  const {DuelistKit,getCharacterSkill,CHARACTER_DEFS}=abilities;
  const {createCharacterSkillUI}=await import(pathToFileURL(path.join(__dirname,'public/character-skill-ui.js')).href);
  const person=(id='caster',team='blue',extra={})=>({id,team,x:0,y:0,z:0,yaw:0,hp:100,alive:true,grounded:true,...extra});
  const floor={reachable:()=>true,groundHeight:()=>0},point=(x=0,z=-5,y=.12)=>({x,y,z});
  const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);
  let groups=0;const test=(name,fn)=>{fn();groups++;console.log(`PASS: ${name}`);};
  function damage(engine,type,damage,radius){
    const owner=person(),target=person('enemy','red',{z:-5});
    const event=engine.cast(type,owner,point(),0,1);assert.ok(event);
    const hits=engine.update([target,person('friend','blue',{z:-5}),person('behind','red',{z:-5})],event.triggerAt,1,{reachable:(_,actor)=>actor.id!=='behind'});
    assert.equal(hits.length,1);assert.equal(hits[0].amount,damage);assert.equal(hits[0].targetId,'enemy');assert.equal(event.radius,radius);
    assert.deepEqual(engine.update([target],event.triggerAt+.01,1,floor),[],'Strong damage is still sampled exactly once');
  }
  function heal(engine){
    const owner=person(),patient=person('patient','blue',{hp:40,x:17});
    const event=engine.cast('mend-heal',owner,{...patient,targetId:patient.id},0,1);assert.ok(event);
    const effects=engine.update([owner,patient],0,1,floor);assert.equal(effects.length,1);assert.equal(effects[0].amount,60);assert.equal(Math.min(100,patient.hp+effects[0].amount),100);
  }
  function mitigation(engine){
    const owner=person();assert.ok(engine.cast('frost-unravel',owner,point(0,0,0),0,1));
    near(engine.mitigateSlow(owner,.45,1),.9175);assert.equal(engine.mitigateSlow(owner,1,1),1);
    assert.equal(engine.mitigateSlow({...owner,grounded:false},.45,1.1),.45);
    assert.equal(engine.mitigateSlow(owner,.45,1.2),.45,'Landing cannot revive the ended effect');
  }
  test('all seven kits buy affordable finite stock, duelist alone carries two lifts, and JSON cannot exceed per-character capacity',()=>{
    for(const character of Object.keys(CHARACTER_DEFS)){
      const kit=new DuelistKit({character});let coins=400;
      for(const key of ['c','q'])while(kit.buy(key,price=>{assert.equal(price,100);if(coins<price)return false;coins-=price;return true;})){}
      assert.equal(kit.smoke,2);assert.equal(kit.updraft,character==='duelist'?2:1);assert.equal(coins,character==='duelist'?0:100);
      const restored=new DuelistKit();restored.restore({...kit.snapshot(),smoke:999,updraft:999});assert.equal(restored.smoke,2);assert.equal(restored.updraft,character==='duelist'?2:1);
      assert.equal(CHARACTER_DEFS[character].ultimatePoints,7);
    }
  });
  test('NOPE90 and solder75 produce real one-shot enemy damage with cover and ally exclusions',()=>{damage(createCharacterSkills(),'nope-bottle',90,5.5);damage(createCharacterSkills(),'ember-solder',75,3.2);});
  test('actual HUD and mobile labels show one-kill recharge and both duelist lift charges',()=>{
    const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',attributes:{},setAttribute(name,value){this.attributes[name]=value;},classList:{toggle(){}},style:{setProperty(){}}});return nodes.get(id);};
    const ui=createCharacterSkillUI({document:{getElementById:get}}),kit=new DuelistKit();kit.updraft=2;
    assert.ok(kit.activate('e',0));assert.ok(kit.activate('e',.25));ui.updateHUD(kit,.5);
    assert.equal(get('ability-q-count').textContent,'2/2');assert.equal(get('ability-e-count').textContent,'0/1');
    assert.ok(get('mobile-scan').attributes['aria-label'].endsWith('0/1'));
    kit.awardKill();ui.updateHUD(kit,1);assert.equal(get('ability-e-count').textContent,'READY');
    for(const character of Object.keys(CHARACTER_DEFS).filter(id=>id!=='duelist')){const timed=new DuelistKit({character});assert.ok(timed.activate('e',0));ui.updateHUD(timed,1);assert.equal(get('ability-e-count').textContent,`${(character==='cap'?22:character==='duck'||character==='japan'?20:character==='nope'||character==='veil'?15:18)-1}s`);}
  });
  test('a long-range sunflower heal restores60HP and keeps the100HP cap',()=>heal(createCharacterSkills()));
  test('larger roots and outer frost annulus actually catch enemies beyond their old footprint, with walls and safe hole preserved',()=>{
    const root=createCharacterSkills(),owner=person();assert.ok(root.cast('veil-roots',owner,point(0,-10,0),0,1));
    const target=person('enemy','red',{x:1.5,z:-9});near(root.speedScale(target,1,floor),.45);
    assert.equal(root.speedScale(target,1,{...floor,reachable:()=>false}),1);
    const frost=createCharacterSkills();assert.ok(frost.cast('frost-stitch',owner,point(),0,1));
    near(frost.speedScale(person('enemy','red',{x:3.6,z:-5}),1,floor),.45);
    assert.equal(frost.speedScale(person('hole','red',{x:.8,z:-5}),1,floor),1);
  });
  test('frost cancels85percent of the strongest slowdown and terminates permanently on leaving the floor',()=>mitigation(createCharacterSkills()));
  test('IAGNU now detects the larger watch area for2.5s without tracking the target or sharing it with opponents',()=>{
    const engine=createCharacterSkills(),owner=person(),enemy=person('enemy','red',{x:4,z:-5});
    assert.ok(engine.cast('echo-tag',owner,point(),0,1));const hits=engine.update([owner,enemy],1.05,1,floor);assert.equal(hits.length,1);
    near(hits[0].endsAt-hits[0].detectedAt,2.5);enemy.x=25;
    assert.equal(engine.markers('blue',2)[0].x,4);assert.deepEqual(engine.snapshot('red').markers,[]);
    assert.deepEqual(engine.markers('blue',3.55),[]);
  });
  test('extended smoke timings, fast cooldowns and one-kill dash refill are authoritative after JSON transfer',()=>{
    const smoke=createCharacterSkills(),event=smoke.cast('duelist-comet',person(),point(0,-18,1.7),0,1);assert.ok(event);assert.equal(event.radius,2.8);near(event.endsAt,5.25);
    const guest=createCharacterSkills();assert.equal(guest.restore(JSON.parse(JSON.stringify(smoke.snapshot())),.3,1),true);assert.equal(guest.events(4.9).length,1);assert.equal(guest.events(5.25).length,0);
    const dash=new DuelistKit();assert.equal(dash.activate('e',0).readyAt,.25);assert.equal(dash.activate('e',.249),null);assert.equal(dash.activate('e',.25).distance,12);dash.awardKill();assert.equal(dash.dash,1);
    for(const character of ['nope','mend','echo','veil','ember','frost']){
      const kit=new DuelistKit({character}),effect=kit.activate('e',10),expected=['nope','veil'].includes(character)?15:18;
      assert.equal(effect.cooldown,expected);const restored=new DuelistKit();restored.restore(JSON.parse(JSON.stringify(kit.snapshot())));restored.tick(10+expected-.001);assert.equal(restored.dash,0);restored.tick(10+expected);assert.equal(restored.dash,1);
    }
    const shade=createCharacterSkills(),worker=person('worker','red');shade.cast('ember-shade',worker,point(0,0,0),0,1);shade.cast('nope-flash',person(),point(0,-5,1.7),0,1);
    const blind=shade.update([worker],.45,1,floor).find(effect=>effect.type==='blind');assert.ok(blind);near(blind.duration,.36);
  });
  // Replacing the actual loaded ability module in memory proves the effect
  // assertions reject the previous weak values, without editing product files.
  const source=fs.readFileSync(abilityPath,'utf8'),engineSource=fs.readFileSync(enginePath,'utf8');
  const variants=[['bottleDamage: 90','bottleDamage: 55',engine=>damage(engine,'nope-bottle',90,5.5)],['healAmount: 60','healAmount: 35',heal],['unravelSlowFraction: .15','unravelSlowFraction: .5',mitigation]];
  for(const [current,old,check]of variants){
    assert.ok(source.includes(current),`Expected mutation anchor ${current}`);
    const url='data:text/javascript;base64,'+Buffer.from(source.replace(current,old)).toString('base64');
    const code=engineSource.replace("'./abilities.js'",JSON.stringify(url)).replace("'./rules.js'",JSON.stringify(pathToFileURL(path.join(__dirname,'public/rules.js')).href));const altered=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
    assert.throws(()=>check(altered.createCharacterSkills()),assert.AssertionError,`${old} must fail the actual gameplay assertion`);
  }
  const used=process.cpuUsage(cpu);console.log(JSON.stringify({groups,negativeControls:3,wallMs:performance.now()-started,cpuMs:(used.user+used.system)/1000}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
