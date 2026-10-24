const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
async function main(){
  const load=n=>import(pathToFileURL(path.join(__dirname,'public',n)).href);
  const [THREE,{createAgentModel},{createFlashStatusFX},{CHARACTER_DEFS}]=await Promise.all([load('vendor/three.module.js'),load('agent-model.js'),load('flash-status-fx.js'),load('abilities.js')]);
  let groups=0;const check=(label,fn)=>{fn();groups++;console.log('PASS: '+label);};
  const fx=createFlashStatusFX(THREE),models=[];
  const actor={id:'enemy',alive:true};actor.visual=createAgentModel(THREE,{character:'nope',bot:actor});models.push(actor.visual);
  const options={blindUntil:()=>12,reducedMotion:true};
  check('all15 character faces follow the real animated head, including crouch, yaw and airborne world offset',()=>{
    for(const character of Object.keys(CHARACTER_DEFS))for(const crouch of [0,1]){
      actor.visual.update(.1,{character,crouch,time:10,alive:true});
      actor.visual.group.position.set(7,3,-11);actor.visual.group.rotation.y=1.2;
      const hitFaces=actor.visual.meshes.length;
      fx.update([actor],10,options);assert.equal(fx.group.userData.activeActors,1);
      const expected=actor.visual.head.localToWorld(new THREE.Vector3(0,.025,character==='duck'?.48:.32));
      assert.ok(expected.distanceTo(fx.group.children[0].position)<1e-8);
      assert.equal(actor.visual.meshes.length,hitFaces);assert.equal(hitFaces,52);
    }
  });
  check('authoritative deadline, death, hidden spectator, viewer and LOS gates clear every puff immediately',()=>{
    for(const state of [{now:12},{alive:false},{shown:false},{viewerId:'enemy'},{visible:()=>false},{blindUntil:()=>0}]){
      actor.alive=state.alive!==false;actor.visual.group.visible=state.shown!==false;
      fx.update([actor],state.now??10,{...options,...state});
      assert.equal(fx.group.visible,false);assert.ok(fx.group.children.every(p=>!p.visible));
    }
    actor.alive=true;actor.visual.group.visible=true;fx.update([actor],10,options);fx.reset();assert.equal(fx.group.visible,false);
    fx.update([],10,options);assert.equal(fx.group.userData.activeActors,0);
  });
  check('yellow texture has a bright centre, soft alpha edge and normal depth; no ray hits or world light',()=>{
    fx.update([actor],10,options);
    const sprite=fx.group.children[0],t=sprite.material.map,a=(x,y)=>t.image.data[(y*64+x)*4+3];
    assert.ok(a(32,32)>240);assert.ok(a(42,32)>a(54,32));assert.equal(a(0,0),0);
    assert.equal(sprite.material.depthTest,true);assert.equal(sprite.material.depthWrite,false);
    const hits=[];for(const p of fx.group.children){p.raycast(null,hits);assert.equal(p.isLight,undefined);}assert.equal(hits.length,0);
  });
  check('reduced motion keeps the soft orb stable; normal mode drifts gently with a fixed30sprite capacity',()=>{
    fx.update([actor],10,options);const fixed=fx.group.children[0].position.clone();
    fx.update([actor],10.4,options);assert.ok(fixed.equals(fx.group.children[0].position));
    fx.update([actor],10.4,{...options,reducedMotion:false});assert.ok(fixed.distanceTo(fx.group.children[0].position)>0);
    const peers=Array.from({length:14},(_,i)=>({...actor,id:'actor'+i}));fx.update(peers,10,options);
    assert.equal(fx.group.userData.activeActors,10);assert.equal(fx.group.children.length,30);
  });
  check('reset and repeated disposal release the shared glow once and all30materials exactly once',()=>{
    const texture=fx.group.children[0].material.map;let textureDisposes=0,materialDisposes=0;
    texture.addEventListener('dispose',()=>textureDisposes++);
    for(const p of fx.group.children)p.material.addEventListener('dispose',()=>materialDisposes++);
    fx.dispose();fx.dispose();fx.update([actor],10,options);
    assert.equal(textureDisposes,1);assert.equal(materialDisposes,30);assert.equal(fx.group.visible,false);
  });
  for(const model of models)model.dispose();console.log(`FLASH STATUS: ${groups} groups;15characters; silent/no browser/network`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
