const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

async function main() {
  const load = name => import(pathToFileURL(path.join(__dirname,'public',name)).href);
  const [THREE,{createCharacterPreview,createCharacterPicker},{createAgentModel},{CHARACTER_DEFS}] = await Promise.all([
    load('vendor/three.module.js'),load('character-preview.js'),load('agent-model.js'),load('abilities.js'),
  ]);
  function events(target={}) {
    const listeners=new Map();
    Object.assign(target,{addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);},emit(type,event={}){for(const fn of [...(listeners.get(type)||[])])fn(event);},listenerCount(){return [...listeners.values()].reduce((sum,set)=>sum+set.size,0);}});
    return target;
  }
  const view=events(),doc=events({hidden:false,defaultView:view}),canvas=events({getBoundingClientRect:()=>({width:280,height:400})});
  let rendererCount=0,renderCount=0,rendererDisposed=0,contextReleased=0,modelsCreated=0,modelsDisposed=0,observerDisposed=0;
  const frames=new Map(),liveModels=[];let sequence=0,lastCamera=null,lastSize=null,lastRatio=null;
  const preview=createCharacterPreview(THREE,{canvas,document:doc,reducedMotion:()=>false,pixelRatio:()=>3,
    rendererFactory(){rendererCount++;return {setClearColor(){},setPixelRatio(n){lastRatio=n;},setSize(w,h){lastSize=[w,h];},render(scene,camera){renderCount++;lastCamera=camera;},dispose(){rendererDisposed++;},forceContextLoss(){contextReleased++;}};},
    modelFactory(three,options){modelsCreated++;const m=createAgentModel(three,options),dispose=m.dispose;m.dispose=()=>{modelsDisposed++;dispose();};liveModels.push(m);return m;},
    requestFrame(fn){const id=++sequence;frames.set(id,fn);return id;},cancelFrame(id){frames.delete(id);},observeResize(){return()=>observerDisposed++;},
  });
  const tick=now=>{const pending=[...frames.values()];frames.clear();for(const fn of pending)fn(now);};
  assert.equal(rendererCount,0,'A closed picker must not allocate a WebGL context');
  preview.setCharacter('mend');assert.equal(modelsCreated,0,'Hidden selection is deferred');
  preview.setActive(true);assert.equal(rendererCount,1);assert.equal(modelsCreated,1);assert.equal(liveModels[0].group.userData.character,'mend');
  assert.equal(lastRatio,1.5,'High density screens have a bounded preview drawing buffer');assert.deepEqual(lastSize,[280,400]);
  tick(0);assert.equal(renderCount,1);assert.equal(frames.size,1);assert.equal(lastCamera.aspect,.7);
  preview.setCharacter('mend');assert.equal(modelsCreated,1,'An unchanged choice must reuse the actual model');
  preview.setCharacter('ember');assert.equal(modelsCreated,2);assert.equal(modelsDisposed,1);assert.equal(liveModels[1].group.userData.character,'ember');
  preview.setActive(false);assert.equal(frames.size,0,'Closing the menu cancels its pending frame');const frozen=renderCount;tick(1000);assert.equal(renderCount,frozen);
  preview.setCharacter('duelist');preview.setActive(true);tick(1100);assert.equal(rendererCount,1,'Selector/overlay changes share one context');
  doc.hidden=true;doc.emit('visibilitychange');assert.equal(frames.size,0);tick(1200);assert.equal(renderCount,frozen+1);
  doc.hidden=false;doc.emit('visibilitychange');tick(1300);assert.equal(renderCount,frozen+2);
  let prevented=false;canvas.emit('webglcontextlost',{preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(frames.size,0);
  canvas.emit('webglcontextrestored');tick(1400);assert.equal(renderCount,frozen+3,'Context restoration resumes without a second renderer');
  const beforeAtomic=modelsCreated;preview.setAppearance('mend','red');assert.equal(modelsCreated,beforeAtomic+1,'A character and team change builds only one model');assert.equal(liveModels.at(-1).group.userData.character,'mend');assert.equal(rendererCount,1);
  let grassTopProjection=0,framedCharacters=0;
  const visibleBounds=model=>{const box=new THREE.Box3();model.group.updateMatrixWorld(true);model.group.traverse(object=>{if(!object.isMesh)return;for(let parent=object;parent;parent=parent.parent)if(!parent.visible)return;box.expandByObject(object);});return box;};
  for(const id of Object.keys(CHARACTER_DEFS)){
    preview.setCharacter(id);tick(1450);const model=liveModels.at(-1);assert.equal(model.group.userData.character,id,'The renderer uses the real model for every choice');
    assert.ok(Math.abs(model.group.rotation.y-(id==='veil'||id==='car'?-.56:-.24))<=.09+1e-10,'The first animation frame retains the selected grass/car/grass and portrait view angles');
    preview.resize();const box=visibleBounds(model),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),tangent=Math.tan(THREE.MathUtils.degToRad(lastCamera.fov*.5)),distance=Math.max(size.y/(2*tangent),size.x/(2*tangent*lastCamera.aspect))*1.12+size.z*.35;
    if(id!=='veil'&&id!=='car')assert.ok(lastCamera.position.distanceTo(new THREE.Vector3(center.x,center.y+.035,center.z+distance))<1e-10,'The portrait characters retain their original camera framing');
    lastCamera.updateMatrixWorld(true);
    model.group.traverseVisible(mesh=>{if(!mesh.isMesh)return;const positions=mesh.geometry.getAttribute('position');for(let i=0;i<positions.count;i++){const p=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld).project(lastCamera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z>-1&&p.z<1,'The actual head, feet and held equipment fit inside the character picker');}});framedCharacters++;
    if(id==='veil'){
      let cube;model.group.traverse(object=>{if(object.isMesh&&object.name.includes('pebbled dirt cube'))cube=object;});assert.ok(cube,'The grass framing case uses the actual block mesh');cube.geometry.computeBoundingBox();const b=cube.geometry.boundingBox;
      assert.ok(cube.worldToLocal(lastCamera.position.clone()).y>b.max.y+.25,'The grass camera eye is clearly above its top surface');
      const projected=[new THREE.Vector3(b.min.x,b.max.y,b.min.z),new THREE.Vector3(b.max.x,b.max.y,b.min.z),new THREE.Vector3(b.max.x,b.max.y,b.max.z),new THREE.Vector3(b.min.x,b.max.y,b.max.z)].map(p=>p.applyMatrix4(cube.matrixWorld).project(lastCamera));
      const height=Math.max(...projected.map(p=>p.y))-Math.min(...projected.map(p=>p.y));grassTopProjection=Math.abs(projected.reduce((area,p,i)=>{const next=projected[(i+1)%4];return area+p.x*next.y-next.x*p.y;},0))/2;
      assert.ok(height>.04&&grassTopProjection>.003,'The green top occupies a visible projected area instead of becoming an edge-on line');
    }
  }
  preview.dispose();preview.dispose();assert.equal(frames.size,0);assert.equal(modelsDisposed,modelsCreated);assert.equal(rendererDisposed,1);assert.equal(contextReleased,1);assert.equal(observerDisposed,1);assert.equal(doc.listenerCount()+view.listenerCount()+canvas.listenerCount(),0);
  preview.setActive(true);tick(1500);assert.equal(rendererCount,1,'Disposed previews cannot recreate resources');
  console.log('PASS: real ten-character model lifecycle, visibility, bounded renderer, context restore and final resource ownership');
  console.log(JSON.stringify({framedCharacters,grassTopProjection:+grassTopProjection.toFixed(5),oldCameraFramingsPreserved:8}));

  const nodes=new Map(),documentView=events(),document=events({defaultView:documentView,getElementById:id=>nodes.get(id)});
  const node=id=>{const value=events({id,hidden:false,value:'',textContent:'',attributes:{},setAttribute(key,value){this.attributes[key]=value;},append(child){child.parentNode=this;}});nodes.set(id,value);return value;};
  const menu=node('menu'),overlay=node('online-overlay'),lobby=node('online-lobby');overlay.hidden=true;lobby.hidden=true;
  const mainHost=node('character-preview-stage'),onlineHost=node('online-character-preview-stage'),pickerCanvas=node('character-preview-canvas');pickerCanvas.tagName='CANVAS';
  node('agent-select').value='duelist';node('online-team').value='blue';
  for(const prefix of['character-preview','online-character-preview'])for(const suffix of['name','role','note'])node(`${prefix}-${suffix}`);
  const calls=[];let pickerControllers=0;
  const picker=createCharacterPicker(THREE,{document,previewFactory(){pickerControllers++;return {setActive:v=>calls.push(['active',v]),setAppearance:(id,team)=>{calls.push(['character',id]);calls.push(['team',team]);},dispose:()=>calls.push(['dispose'])};}});
  picker.sync();assert.equal(pickerCanvas.parentNode,mainHost);assert.equal(nodes.get('character-preview-name').textContent,CHARACTER_DEFS.duelist.label);
  for(const id of Object.keys(CHARACTER_DEFS)){nodes.get('agent-select').value=id;picker.sync();assert.equal(calls.filter(c=>c[0]==='character').at(-1)[1],id);assert.equal(nodes.get('online-character-preview-name').textContent,CHARACTER_DEFS[id].label);}
  overlay.hidden=false;picker.sync();assert.deepEqual(calls.at(-1),['active',false],'The online entry form hides the main picker');
  lobby.hidden=false;nodes.get('online-team').value='red';picker.sync();assert.equal(pickerCanvas.parentNode,onlineHost);assert.deepEqual(calls.at(-2),['team','red']);
  overlay.hidden=true;picker.sync();assert.equal(pickerCanvas.parentNode,mainHost);assert.equal(pickerControllers,1,'Both selectors move a single canvas/controller');
  menu.hidden=true;picker.sync();assert.deepEqual(calls.at(-1),['active',false]);
  documentView.emit('pagehide',{persisted:true});documentView.emit('pageshow');assert.equal(calls.filter(c=>c[0]==='dispose').length,0,'Back-forward cache pauses without destroying the picker');
  documentView.emit('pagehide',{persisted:false});picker.dispose();assert.equal(calls.filter(c=>c[0]==='dispose').length,1);assert.equal(documentView.listenerCount()+nodes.get('online-team').listenerCount(),0);
  const stub=createCharacterPicker(THREE,{document:{getElementById:()=>({})}});stub.sync();stub.dispose();
  console.log('PASS: both selector names, single-canvas handoff, lobby/team changes, hidden gameplay, bfcache and DOM-only fixtures');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
