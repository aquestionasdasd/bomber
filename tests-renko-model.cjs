const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
async function main(){
  const load=name=>import(pathToFileURL(path.join(__dirname,'public',name)).href);
  const [T,{createAgentModel},{CHARACTER_DEFS,normalizeCharacter},{mountRenkoPreview}]=await Promise.all([load('vendor/three.module.js'),load('agent-model.js'),load('abilities.js'),load('renko-preview.js')]);
  let groups=0;const check=(name,fn)=>{fn();groups++;console.log('PASS: '+name);};
  const a=createAgentModel(T,{character:'renko',team:'blue',bot:{id:'renko-blue'}}),b=createAgentModel(T,{character:'renko',team:'red',bot:{id:'renko-red'}});
  const root=model=>model.group.getObjectByName('Renko avatar / 蓮子'),meshes=model=>{const out=[];root(model).traverse(x=>{if(x.isMesh)out.push(x);});return out;};
  const assets=meshes(a),geometries=new Set(assets.map(x=>x.geometry)),materials=new Set(assets.map(x=>x.material)),textures=new Set(assets.map(x=>x.material.map).filter(Boolean));
  check('reference features are independent visible geometry with spiral eye and badge textures',()=>{
    const names=assets.map(x=>x.name).join('|');
    for(const feature of ['yellow cat ears','silver ear piercings','yellow spiral eyes','silver goggle frame','yellow goggle lens','straight yellow fringe','oversized padded blue jacket','raised padded collar','front pocket flap','yellow circular cat badge','blue tapered trousers','dark blue boots'])assert.ok(names.includes(feature),feature);
    assert.equal(textures.size,2);const face=assets.find(x=>x.material.name==='Renko finish / face').material.map;
    assert.equal(face.image.width,512);assert.ok(face.image.data.some(x=>x>200));assert.equal(a.group.userData.character,'renko');
    assert.equal(a.meshes.length,52,'legacy rig proxies retained');
    assert.ok(assets.length<=55);for(const g of geometries)for(const x of g.getAttribute('position').array)assert.ok(Number.isFinite(x));
  });
  check('head/limbs follow actual stand crouch walk work slide death and victory rig without changing world transform',()=>{
    const head=root(a).getObjectByName('Renko avatar frame / head'),p=new T.Vector3(),q=new T.Vector3();
    a.group.position.set(12,0,-5);a.group.rotation.y=.4;
    a.update(.1,{character:'renko',alive:true});a.group.updateMatrixWorld(true);const standing=head.getWorldPosition(p).y;
    a.update(.1,{character:'renko',crouch:1,alive:true});a.group.updateMatrixWorld(true);assert.ok(head.getWorldPosition(q).y<standing-.5);
    for(const state of [{moving:true,time:.7},{planting:true,time:1},{defusing:true,time:2},{sliding:true},{alive:false},{alive:true,dancing:true,danceTime:1.3}]){
      a.update(.1,{character:'renko',alive:true,weapon:'vandal',...state});a.group.updateMatrixWorld(true);
      const expected=a.head.matrixWorld.elements,actual=head.matrixWorld.elements;for(let i=0;i<16;i++)assert.ok(Math.abs(expected[i]-actual[i])<1e-9);
      assert.deepEqual(a.group.position.toArray(),[12,0,-5]);assert.equal(a.group.rotation.y,.4);
      root(a).traverse(node=>{for(const x of node.matrixWorld.elements)assert.ok(Number.isFinite(x));});
    }
    for(let i=0;i<10;i++)a.update(.1,{character:'renko',alive:true,crouch:0});a.group.updateMatrixWorld(true);assert.ok(Math.abs(head.getWorldPosition(q).y-standing)<.002,'normal pose returns after existing movement/work blending settles');
  });
  check('cosmetic switches reuse cached resources, hide correctly and preserve original characters',()=>{
    const blue=assets.find(x=>x.material.name==='Renko finish / team blue'),red=meshes(b).find(x=>x.material.name==='Renko finish / team red');assert.ok(blue&&red);assert.notEqual(blue.material,red.material);
    for(let i=0;i<20;i++){a.update(0,{character:i%2?'renko':'frost',alive:true});assert.equal(root(a).visible,i%2===1);}
    assert.equal(meshes(a)[0].geometry,assets[0].geometry);assert.equal(meshes(b)[0].geometry,assets[0].geometry);
  });
  check('skills remain explicitly pending; no new playable identity or network fields',()=>{
    assert.equal(Object.keys(CHARACTER_DEFS).length,15);assert.equal(CHARACTER_DEFS.renko,undefined);assert.equal(normalizeCharacter('renko'),'duelist');
    const page=fs.readFileSync(path.join(__dirname,'public/renko-preview.html'),'utf8'),script=fs.readFileSync(path.join(__dirname,'public/renko-preview.js'),'utf8');
    assert.match(page,/スキル準備中/);assert.doesNotMatch(script,/AudioContext|new Audio\(|localStorage|fetch\(/);assert.match(fs.readFileSync(path.join(__dirname,'public/play.html'),'utf8'),/href="renko-preview.html"/);
  });
  check('shared geometry/material/texture ownership survives another model and releases once after last owner',()=>{
    const counts=new Map();for(const x of [...geometries,...materials,...textures])x.addEventListener('dispose',()=>counts.set(x,(counts.get(x)||0)+1));
    a.dispose();a.dispose();assert.equal(counts.size,0);b.update(.1,{character:'renko',alive:true});b.dispose();b.dispose();
    for(const x of [...geometries,...materials,...textures])assert.equal(counts.get(x),1);
    const c=createAgentModel(T,{character:'renko'});assert.notEqual(meshes(c)[0].geometry,assets[0].geometry);c.dispose();
  });
  function events(value={}){const handlers=new Map();return Object.assign(value,{addEventListener(k,f){if(!handlers.has(k))handlers.set(k,new Set());handlers.get(k).add(f);},removeEventListener(k,f){handlers.get(k)?.delete(f);},emit(k,event={}){for(const f of handlers.get(k)||[])f(event);},count(){return [...handlers.values()].reduce((n,set)=>n+set.size,0);}});}
  check('preview controls change actual rig and bfcache pauses/resumes; final unload removes handlers',()=>{
    const buttons=['stand','crouch','dance'].map(pose=>events({dataset:{pose},attributes:{},setAttribute(k,v){this.attributes[k]=v;}})),views=['full','face'].map(view=>events({dataset:{view},setAttribute(){}})),view=events(),canvas={},error={hidden:true};
    const doc={defaultView:view,querySelectorAll:s=>s==='[data-pose]'?buttons:views,getElementById:id=>id==='renko-model'?canvas:error};
    let config,disposed=0,active=[];const ui=mountRenkoPreview({document:doc,previewFactory(T,options){config=options;return{setActive:x=>active.push(x),dispose(){disposed++;}};}}),model=config.modelFactory(T,{team:'blue'});
    buttons[1].emit('click',{currentTarget:buttons[1]});model.update(.1,{alive:true});model.group.updateMatrixWorld(true);assert.equal(model.group.userData.character,'renko');assert.ok(model.head.getWorldPosition(new T.Vector3()).y<1.2);assert.equal(buttons[1].attributes['aria-pressed'],'true');
    buttons[2].emit('click',{currentTarget:buttons[2]});model.update(.1,{alive:true,time:1,danceTime:1});assert.equal(buttons[1].attributes['aria-pressed'],'false');assert.equal(buttons[2].attributes['aria-pressed'],'true');
    view.emit('pagehide',{persisted:true});assert.equal(active.at(-1),false);view.emit('pageshow');assert.equal(active.at(-1),true);config.onError();assert.equal(error.hidden,false);
    view.emit('pagehide',{persisted:false});ui.dispose();assert.equal(disposed,1);assert.equal(view.count()+[...buttons,...views].reduce((n,x)=>n+x.count(),0),0);model.dispose();
  });
  console.log(JSON.stringify({groups,renkoMeshes:assets.length,triangles:[...geometries].reduce((n,g)=>n+g.getAttribute('position').count/3,0),sharedGeometries:geometries.size,sharedMaterials:materials.size,textures:textures.size,playableCharacters:15,audioPlayback:false}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
