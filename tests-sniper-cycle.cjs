const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
async function main(){
  // Real saved game and weapon meshes; renderer, timers and audio are inert.
  const base=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8');
  const prefix=base.slice(0,base.indexOf('  const local = harness();'));
  const loaded=new Module(__filename,module);loaded.filename=__filename;loaded.paths=module.paths;
  loaded._compile(prefix+'\nreturn {harness};\n}\nmodule.exports=main;',__filename);
  const {harness}=await loaded.exports(),h=harness();let count=0;
  const check=(name,fn)=>{fn();count++;console.log('PASS: '+name);};
  function setup(id='scout'){
    h.reset();h.clearWalls();h.sandbox.sniperId=id;
    h.run(`inventory.primary=sniperId;equip(sniperId,true);mode='play';match.phase='live';
      makeBot({x:60,z:60},0,'red',{id:'far',team:'red',secondary:'classic',kit:new DuelistKit({character:'nope'})});
      bots[0].rangeTarget=true;bots[0].fire=999;bots[0].reactionUntil=999;
      aiming=true;updatePlay(.016);`);
  }
  check('both snipers leave scope on a real shot and retain the full firing interval',()=>{
    for(const id of ['scout','atlas']){
      setup(id);assert.equal(h.elements.get('sniper-scope').hidden,false);
      const ammo=h.run('player.ammo');h.run('shoot();updateFirstPersonEquipment(0);renderWithDetonation(0)');
      assert.equal(h.elements.get('sniper-scope').hidden,true,id+' must unscope');
      assert.equal(h.run('gun.visible'),true,id+' must show bolt action');
      assert.equal(h.run('player.ammo'),ammo-1);h.run('shoot()');assert.equal(h.run('player.ammo'),ammo-1);
    }
  });
  check('20/60/144Hz scope, countdown and real shot gate become ready together',()=>{
    for(const id of ['scout','atlas']) for(const hz of [20,60,144]){
      setup(id);h.run('shoot()');const at=h.run('lastShot'),interval=h.run('weapon().interval');
      let previous=0;
      for(let n=0;n<Math.ceil(interval*hz)-1;n++){
        h.run(`updatePlay(${1/hz})`);
        assert.equal(h.elements.get('sniper-scope').hidden,true,`${id}/${hz}`);
        const value=Number(h.elements.get('sniper-cycle').attributes['aria-valuenow']);assert.ok(value>=previous);previous=value;
      }
      h.sandbox.readyAt=at+interval;
      h.run('elapsed=readyAt-1e-5;updateHUD();shoot()');assert.equal(h.run('player.ammo'),4);
      assert.equal(h.elements.get('sniper-cycle').hidden,false);
      assert.match(h.elements.get('sniper-cycle-label').textContent,/0\.1秒/);
      h.run('elapsed=readyAt;updatePlay(0)');assert.equal(h.elements.get('sniper-cycle').hidden,true);
      assert.equal(h.elements.get('sniper-scope').hidden,false);
      h.run('shoot()');assert.equal(h.run('player.ammo'),3);
    }
  });
  check('release cancels rescope; hip shots cycle too; other guns retain ADS',()=>{
    setup();h.run('shoot();aiming=false;elapsed+=1.1;updatePlay(0)');
    assert.equal(h.elements.get('sniper-scope').hidden,true);assert.equal(h.run('gun.visible'),true);
    setup('atlas');h.run('aiming=false;shoot();updatePlay(.2)');assert.equal(h.elements.get('sniper-cycle').hidden,false);
    setup('vandal');h.run('shoot();updatePlay(.02)');assert.equal(h.elements.get('sniper-cycle').hidden,true);
    assert.equal(h.run('aiming'),true);assert.equal(h.run('sniperCycleRemaining()'),0);
  });
  check('reload, equip, death and next round cannot leak a bolt pose or old countdown',()=>{
    setup();h.run('shoot();reload();updatePlay(.1)');assert.equal(h.elements.get('sniper-cycle').hidden,true);
    h.run('updateFirstPersonEquipment(.1)');assert.equal(h.run(`gun.getObjectByName('Equipment / scout').children[1].rotation.z`),0);
    setup();h.run(`shoot();equip('classic');updateHUD()`);assert.equal(h.elements.get('sniper-cycle').hidden,true);
    h.run(`equip('scout');updateHUD()`);assert.equal(h.run('sniperCycleRemaining()'),0);
    setup();h.run('shoot();player.alive=false;updateHUD()');assert.equal(h.elements.get('sniper-cycle').hidden,true);
    h.run('spawnRound();updateHUD()');assert.equal(h.run('sniperCycleRemaining()'),0);
    setup();h.run('player.ammo=0;shoot();updateHUD()');assert.equal(h.run('sniperCycleRemaining()'),0);
  });
  check('guest shot keeps scoped accuracy in its original packet and only predicts ammo',()=>{
    setup('atlas');h.run(`makeBot({x:0,z:-6},1,'red',{id:'target',team:'red',secondary:'classic'});
      onlinePlaying=true;online={host:false,session:{memberId:'guest'},room:{code:'TEST'}};
      netHasSnapshot=true;shoot();updateFirstPersonEquipment(0);renderWithDetonation(0)`);
    assert.equal(h.run(`netActions.filter(a=>a.type==='fire').length`),1);
    assert.equal(h.run(`netActions.find(a=>a.type==='fire').ads`),true);
    assert.equal(h.run('bots[1].hp'),100);assert.equal(h.run('totalKills'),0);assert.equal(h.run('player.ammo'),4);
    assert.equal(h.elements.get('sniper-scope').hidden,true);assert.equal(h.run('gun.visible'),true);
  });
  check('countdown follows an actual NOBI impairment rather than a second fixed timer',()=>{
    setup();h.run(`makeBot({x:0,z:-4},1,'red',{id:'brake',team:'red',secondary:'classic',kit:new DuelistKit({character:'nobi'})});
      ordinarySkills.cast('nobi-brake',ordinaryActorView(bots[1]),{x:0,y:0,z:0,targetId:player.id},elapsed,match.round);shoot();
      elapsed=lastShot+1.1;updateHUD();shoot()`);
    assert.equal(h.run('player.ammo'),4);assert.equal(h.elements.get('sniper-cycle').hidden,false);
    assert.ok(Math.abs(h.run('sniperCycleRemaining()')-.66)<1e-7);
    h.run('elapsed=lastShot+1.76;updatePlay(0);shoot()');assert.equal(h.run('player.ammo'),3);
  });
  check('real bolt and right hand move, return to grip and do not disturb support hand',()=>{
    for(const id of ['scout','atlas']){
      setup(id);h.sandbox.modelId=id;
      const hand=()=>h.run(`gun.getObjectByName('Viewmodel / '+modelId).children[1].children[4].position.toArray()`);
      const left=()=>h.run(`gun.getObjectByName('Viewmodel / '+modelId).children[2].children[4].position.toArray()`);
      const rest=[...hand()],support=[...left()];h.run('shoot();elapsed=lastShot+weapon().interval*.48;updateFirstPersonEquipment(.1)');
      assert.ok(h.run(`gun.getObjectByName('Equipment / '+modelId).children[1].position.z`)>.075);
      assert.ok(h.run(`gun.getObjectByName('Equipment / '+modelId).children[1].rotation.z`)<-.2);
      assert.ok(Math.hypot(...hand().map((n,i)=>n-rest[i]))>.04);assert.deepEqual([...left()],support);
      h.run('elapsed=lastShot+weapon().interval;aiming=false;updateFirstPersonEquipment(.1)');
      assert.deepEqual([...hand()],rest);assert.equal(h.run(`gun.getObjectByName('Equipment / '+modelId).children[1].rotation.z`),0);
    }
  });
  check('renderer cannot re-hide the cycling weapon; waiting for a rejected shot never restarts it',()=>{
    setup();h.run('shoot();elapsed+=.3;updateFirstPersonEquipment(.1);renderWithDetonation(0)');
    const remaining=h.run('sniperCycleRemaining()');h.run('shoot();updateHUD();renderWithDetonation(0)');
    assert.equal(h.run('sniperCycleRemaining()'),remaining);assert.equal(h.run('gun.visible'),true);
    h.run("mode='pause';clearCombatInput()");assert.equal(h.elements.get('sniper-cycle').hidden,true);
    h.run("mode='play';updateHUD()");assert.equal(h.elements.get('sniper-cycle').hidden,false);
  });
  console.log(`Sniper cycle: ${count} groups PASS`);
}
main().catch(e=>{console.error(e);process.exitCode=1});
