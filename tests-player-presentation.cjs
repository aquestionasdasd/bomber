const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const {pathToFileURL}=require('node:url');
async function main(){
 const load=file=>import(pathToFileURL(path.join(__dirname,'public',file)).href);
 const [T,{createViewmodel,CHARACTER_HANDS},{CHARACTER_DEFS,getCharacterUltimate,ONNARA_SKILLS},{createCharacterSkillUI}]=await Promise.all([load('vendor/three.module.js'),load('viewmodel.js'),load('abilities.js'),load('character-skill-ui.js')]);
 let groups=0;const test=(name,fn)=>{fn();groups++;console.log('PASS: '+name);};
 test('all15 selected characters expose the actual named X and7pt in desktop/mobile/lobby',()=>{
  const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',setAttribute(){}});return nodes.get(id);};
  const ui=createCharacterSkillUI({document:{getElementById:get}}),html=fs.readFileSync(path.join(__dirname,'public/play.html'),'utf8');
  for(const id of Object.keys(CHARACTER_DEFS)){ui.updateSelection(id);const x=getCharacterUltimate(id);assert.ok(x.description.length>10);
   for(const prefix of ['character-skill','online-character-skill','mobile-character-skill']){for(const field of ['name','description','meta'])assert.ok(html.includes(`id="${prefix}-x-${field}"`));assert.equal(get(prefix+'-x-name').textContent,x.name);assert.equal(get(prefix+'-x-description').textContent,x.description);assert.equal(get(prefix+'-x-meta').textContent,'7 ULTポイント');}
   assert.ok(get('mobile-skill-summary').textContent.includes(x.name));
  }
  ui.updateSelection('duelist');assert.match(get('character-skill-x-description').textContent,/左クリックで1本/);assert.match(get('character-skill-x-description').textContent,/右クリックで残り最大5本/);
  ui.updateSelection('japan');assert.match(get('character-skill-x-description').textContent,/10HP/);
  ui.updateSelection('onnara');assert.match(get('character-skill-e-description').textContent,/13秒/);assert.equal(ONNARA_SKILLS.hoverDuration,13);
 });
 const [{createCharacterSkills},{createTeamAbilities},{createZoneAbilities},{createNopeDecoys}]=await Promise.all(['character-skills.js','team-abilities.js','zone-abilities.js','nope-decoys.js'].map(load));
 test('1000HP revived actors can cast all four skill families; invalid HP still rejects',()=>{
  const points=Array.from({length:30},(_,i)=>({x:i,y:0,z:0,yaw:0}));
  for(const hp of [1000,1000.01]){const actor={id:'revived',team:'blue',alive:true,hp,x:0,y:0,z:0};
   assert.equal(!!createCharacterSkills().cast('nope-bottle',actor,{x:0,y:0,z:-2},1,1),hp===1000);
   assert.equal(!!createTeamAbilities().castRecon(actor,1,1),hp===1000);
   assert.equal(!!createZoneAbilities().cast('frost',actor,{x:0,y:0,z:-2},1,1),hp===1000);
   assert.equal(createNopeDecoys().start(actor,points,1,1),hp===1000);
  }
 });
 const camera=new T.PerspectiveCamera(76,16/9,.05,500),v=createViewmodel(T,camera),gloves=[];v.group.traverse(o=>{if(o.isMesh&&o.material.name?.startsWith('Character hands'))gloves.push(o);});
 const geometry=gloves.map(o=>o.geometry),sleeves=[];v.group.traverse(o=>{if(o.isMesh&&!o.material.name?.startsWith('Character hands'))sleeves.push([o.material,o.material.color.getHex()]);});
 test('15 avatar hand palettes change only hands, without model/weapon/arm allocation',()=>{
  assert.equal(Object.keys(CHARACTER_HANDS).length,15);assert.ok(gloves.length>20);
  for(const id of Object.keys(CHARACTER_HANDS)){v.setCharacter(id);assert.equal(v.group.userData.handCharacter,id);
   for(const o of gloves)assert.equal('#'+o.material.color.getHexString(),CHARACTER_HANDS[id][o.material.name.endsWith('main')?0:1]);
   sleeves.forEach(([m,c])=>assert.equal(m.color.getHex(),c));assert.deepEqual(gloves.map(o=>o.geometry),geometry);
  }
 });
 test('SCOUT and ATLAS optical axis is genuinely open; ADS hides equipment and restores it',()=>{
  for(const id of ['scout','atlas']){v.setWeapon(id);const equipment=v.group.getObjectByName('Equipment / '+id);assert.ok(equipment);
   // Ray in authored sight coordinates, after neutralizing the equipment's pose.
   const target=equipment.clone();target.position.set(0,0,0);target.rotation.set(0,0,0);target.scale.set(1,1,1);target.updateMatrixWorld(true);
   const ray=new T.Raycaster(new T.Vector3(0,.16,.5),new T.Vector3(0,0,-1),0,2);assert.equal(ray.intersectObject(target,true).length,0,id+' sight is clear');
   v.update(.016,{aiming:true,scoped:true,character:'nope'});assert.equal(equipment.visible,false);
   v.update(.016,{aiming:false,scoped:false,character:'nope'});assert.equal(equipment.visible,true);
  }
 });
 v.dispose();console.log(`PASS: ${groups} player presentation groups; no browser/audio`);
}main().catch(e=>{console.error(e);process.exitCode=1;});
