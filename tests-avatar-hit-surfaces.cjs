const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main(){
  const base=fs.readFileSync(path.join(__dirname,'tests-nope-decoy-game.cjs'),'utf8');
  const loaded=new Module(__filename,module);loaded.filename=__filename;loaded.paths=module.paths;
  loaded._compile(base.slice(0,base.indexOf('  const local = harness();'))+'\nreturn {harness};\n}\nmodule.exports=main;',__filename);
  const {harness}=await loaded.exports(),h=harness();let groups=0;
  const check=(label,fn)=>{fn();groups++;console.log('PASS: '+label);};
  function setup(character='car',crouch=0){h.reset();h.clearWalls();h.sandbox.char=character;h.sandbox.duck=crouch;h.run(`
    mode='play';match.phase='live';inventory.primary='vandal';equip('vandal',true);
    makeBot({x:0,z:-6},0,'red',{id:'enemy',team:'red',kit:new DuelistKit({character:char})});
    var enemy=bots[0];enemy.armor=0;enemy.crouch=duck;enemy.group.rotation.y=Math.PI;
    enemy.visual.update(0,{character:char,crouch:duck,time:elapsed,alive:true,weapon:'classic'});botsGroup.updateMatrixWorld(true);
  `);}
  function cast(x,y,old=false){h.sandbox.sample={x,y,old};return h.run(`(()=>{
    const ray=new THREE.Raycaster(new THREE.Vector3(sample.x,sample.y,0),new THREE.Vector3(0,0,-1),0,20),hits=[];
    if(sample.old){for(const mesh of enemy.meshes)THREE.Mesh.prototype.raycast.call(mesh,ray,hits);hits.sort((a,b)=>a.distance-b.distance);}
    else hits.push(...ray.intersectObject(enemy.group,true));
    return hits[0]||null;
  })()`);}
  const ids=['duelist','mend','ember','echo','frost','veil','nope','duck','cat','car','nobi','japan','cap','urchin','onnara'];
  let extensions=[],headSamples=0,headProbes=[];
  check('15 visible heads, crouch follows copied animation frames; invisible old helmets cannot raycast',()=>{
    for(const id of ids)for(const crouch of [0,1]){
      setup(id,crouch);
      assert.equal(h.run(`enemy.meshes.filter(m=>m.userData.head).flatMap(m=>new THREE.Raycaster(new THREE.Vector3(0,1.65-duck*.55,0),new THREE.Vector3(0,0,-1),0,20).intersectObject(m)).length`),0,id);
      let found=false;
      for(let y=1.55-crouch*.55;y<2.3-crouch*.55&&!found;y+=.045)for(let x=-.55;x<=.55;x+=.055){const hit=cast(x,y);if(hit&&(hit.hitZone||hit.object.userData.hitZone)==='head'){found=true;headSamples++;headProbes.push({id,crouch,x,y});break;}}
      assert.ok(found,id+' visible head '+crouch);
    }
  });
  check('visible extensions outside all 52 legacy surfaces receive torso damage',()=>{
    for(const id of ids){setup(id);let found;
      for(let y=.12;y<1.46&&!found;y+=.07)for(let x=-.85;x<=.85;x+=.045){
        const hit=cast(x,y);if(hit?.object.userData.hitZone==='body'&&!cast(x,y,true)){found={x,y};break;}
      }
      if(!found)continue;
      extensions.push({id,...found});h.sandbox.probe=found;
      h.run(`player.x=probe.x;player.y=probe.y-1.7;player.z=0;player.yaw=0;player.pitch=0;lastShot=-10;shotSequence=0;renderedRecoil=0;shoot()`);
      assert.equal(h.run('enemy.hp'),60,id+' body raw40');assert.equal(h.run('totalKills'),0);
    }
    assert.ok(extensions.length>=10,'broad sample of independent exteriors');
  });
  check('actual visible head deals head damage; former helmet empty-space does not',()=>{
    setup('echo');let head,empty;
    for(let y=1.47;y<1.91;y+=.025)for(let x=-.24;x<=.24;x+=.025){const hit=cast(x,y),old=cast(x,y,true);if(hit?.object.userData.head)head||={x,y};if(old?.object.userData.head&&!hit)empty||={x,y};}
    assert.ok(head&&empty,'letter geometry has visible gold and empty spaces');
    h.sandbox.probe=empty;h.run(`player.x=probe.x;player.y=probe.y-1.7;player.z=0;player.yaw=0;player.pitch=0;lastShot=-10;shotSequence=0;renderedRecoil=0;shoot()`);assert.equal(h.run('enemy.hp'),100);
    h.sandbox.probe=head;h.run(`player.x=probe.x;player.y=probe.y-1.7;player.z=0;player.yaw=0;player.pitch=0;lastShot=-10;shotSequence=0;renderedRecoil=0;shoot()`);assert.equal(h.run('enemy.alive'),false);
  });
  check('wall, nearer ally, genuine miss and shotgun per-cartridge authority remain intact',()=>{
    const p=extensions.find(x=>x.id==='car');assert.ok(p);
    setup('car');h.wall({z:-2});h.sandbox.probe=p;h.run(`player.x=probe.x;player.y=probe.y-1.7;player.z=0;player.yaw=0;player.pitch=0;lastShot=-10;shotSequence=0;renderedRecoil=0;shoot()`);assert.equal(h.run('enemy.hp'),100);
    setup('car');h.sandbox.probe=p;h.run(`makeBot({x:0,z:-3},1,'blue',{id:'ally',team:'blue',kit:new DuelistKit({character:'car'})});botsGroup.updateMatrixWorld(true);player.x=probe.x;player.y=probe.y-1.7;player.z=0;player.yaw=0;player.pitch=0;lastShot=-10;shotSequence=0;renderedRecoil=0;shoot()`);assert.equal(h.run('enemy.hp'),100);assert.equal(h.run('bots[1].hp'),100);
    setup('car');h.run(`fireArsenal(player,new THREE.Vector3(2,1.1,0),new THREE.Vector3(0,0,-1),WEAPONS.pump,true)`);assert.equal(h.run('enemy.hp'),100);
    h.run(`inventory.primary='pump';equip('pump',true);fireArsenal(player,new THREE.Vector3(0,1.15,0),new THREE.Vector3(0,0,-1),WEAPONS.pump,true)`);assert.equal(h.run('totalKills'),1);
  });
  check('guest visual prediction does not mutate HP; host validates the same extension and deduplicates action',()=>{
    const p=extensions.find(x=>x.id==='car');setup('car');h.sandbox.probe=p;
    h.run(`onlinePlaying=true;online={host:false};fireArsenal(player,new THREE.Vector3(probe.x,probe.y,0),new THREE.Vector3(0,0,-1),WEAPONS.vandal,true,{visualOnly:true})`);assert.equal(h.run('enemy.hp'),100);
    // JSON crosses a distinct saved-game world; no shared actors or THREE state.
    const packet=JSON.stringify({type:'fire',yaw:0,pitch:0,ads:true});const host=harness();host.reset();host.sandbox.probe=p;host.sandbox.action=JSON.parse(packet);
    host.run(`player.x=50;makeBot({x:probe.x,z:0,y:probe.y-1.7},0,'blue',{id:'remote',team:'blue',kit:new DuelistKit({character:'nope'})});var remote=bots[0];Object.assign(remote,{remoteId:'guest',netWeapon:'vandal',netAmmo:25,netReserve:50,netReload:0,lastNetShot:-10});makeBot({x:0,z:-6},1,'red',{id:'victim',team:'red',kit:new DuelistKit({character:'car'})});var victim=bots[1];applyRemoteAction(remote,action,elapsed);applyRemoteAction(remote,action,elapsed)`);
    assert.equal(host.run('victim.hp'),60);assert.equal(host.run('remote.netAmmo'),24);host.run('clearBots()');
  });
  check('local player uses the same visible head and extensions, with former torso/leg volume preserved',()=>{
    setup('car');h.run(`clearBots();player.kit=new DuelistKit({character:'car'});player.yaw=0;`);
    const p=extensions.find(x=>x.id==='car');h.sandbox.probe=p;
    const hit=h.run(`playerShotHit(new THREE.Raycaster(new THREE.Vector3(probe.x,probe.y,6),new THREE.Vector3(0,0,-1),0,20))`);assert.ok(hit);assert.equal(hit.object.userData.hitZone,'body');
    for(const id of ids){h.sandbox.char=id;assert.ok(h.run(`player.kit=new DuelistKit({character:char});playerShotHit(new THREE.Raycaster(new THREE.Vector3(0,.5,-4),new THREE.Vector3(0,0,1),0,20))`),id+' old body gap');}
    for(const probe of headProbes){h.sandbox.headProbe=probe;assert.equal(h.run(`player.kit=new DuelistKit({character:headProbe.id});player.crouch=headProbe.crouch;shotZone(playerShotHit(new THREE.Raycaster(new THREE.Vector3(headProbe.x,headProbe.y,6),new THREE.Vector3(0,0,-1),0,20)))`),'head',probe.id+' local head '+probe.crouch);}
    h.run('clearBots()');assert.equal(h.run('playerShotModel'),null);
  });
  check('new sniper ballistic path also assigns torso damage to a visible chassis extension',()=>{
    setup('car');const p=extensions.find(x=>x.id==='car');assert.equal(cast(p.x,p.y)?.object.userData.hitZone,'body');h.sandbox.probe=p;
    h.run(`inventory.primary='scout';equip('scout',true);fireArsenal(player,new THREE.Vector3(probe.x,probe.y,0),new THREE.Vector3(0,0,-1),WEAPONS.scout,true)`);assert.equal(h.run('enemy.hp'),10);
  });
  check('switching, slide, death and weapon changes cannot revive a hidden head or a stale avatar',()=>{
    setup('cat');h.run(`enemy.visual.update(.1,{character:'duck',sliding:true,moving:true,alive:true,weapon:'atlas'});enemy.group.updateMatrixWorld(true)`);
    for(const x of [-.15,0,.15])assert.equal(cast(x,1.8)?.object.userData.head||false,false,'slide old standing head');
    h.run(`enemy.alive=false;enemy.visual.update(.1,{alive:false});clearBots()`);assert.equal(h.run('bots.length'),0);
  });
  check('local work and moving poses advance once per frame rather than freezing at the first shot',()=>{
    setup('cat');h.run(`player.kit=new DuelistKit({character:'cat'});updatePlayerShotModel(.1);var standingHead=playerShotModel.head.getWorldPosition(new THREE.Vector3()).y;player.planting=true;for(let i=0;i<10;i++)updatePlayerShotModel(.1);var workingHead=playerShotModel.head.getWorldPosition(new THREE.Vector3()).y;`);
    assert.ok(h.run('standingHead-workingHead>.18'),'work pose lowers the actual head');
    h.run(`player.planting=false;player.vx=4;for(let i=0;i<10;i++){elapsed+=.1;updatePlayerShotModel(.1);}var poseA=playerShotModel.legL.children[0].matrixWorld.clone();elapsed+=.2;updatePlayerShotModel(.1)`);
    assert.ok(h.run('poseA.elements.some((n,i)=>Math.abs(n-playerShotModel.legL.children[0].matrixWorld.elements[i])>1e-4)'),'moving leg pose advances');h.run('clearBots()');
  });
  console.log(JSON.stringify({groups,characters:ids.length,headSamples,extensionCharacters:extensions.map(e=>e.id),audioPlayback:false}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
