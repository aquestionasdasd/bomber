const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {pathToFileURL} = require('node:url');

async function main() {
  const started = performance.now(), cpu = process.cpuUsage();
  const load = file => import(pathToFileURL(path.join(__dirname, 'public', file)).href);
  const {resolveMapCallout, drawMapShapes, getMapCalloutLabels} = await load('map-callouts.js');
  let groups = 0;
  const pass = message => { groups++; console.log(`PASS ${message}`); };
  const square = (x, z, w, d = w) => [[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2]];
  const regions = {callouts: [{name:'large court',polygon:square(0,0,20)},{name:'small entrance',polygon:square(0,0,4)}],zones:[{name:'legacy lane',x:0,z:0,radius:30}]};
  assert.equal(resolveMapCallout(regions,{x:0,z:0}).name,'small entrance');
  assert.equal(resolveMapCallout(regions,{x:2,z:2}).name,'small entrance','An exact shared edge has a stable inclusive callout');
  assert.equal(resolveMapCallout(regions,{x:2.001,z:2}).name,'large court');
  assert.equal(resolveMapCallout(regions,{x:21,z:0}).name,'legacy lane');
  assert.equal(resolveMapCallout(regions,{x:31,z:0}),null);
  assert.equal(resolveMapCallout({callouts:[{name:'L court',polygon:[[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]]}]},{x:.5,z:3}).name,'L court');
  assert.equal(resolveMapCallout({callouts:[{name:'L court',polygon:[[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]]}]},{x:3,z:3}),null,'Concave court recesses do not inherit the wrong region');
  pass('small polygons precede broad lanes, inclusive borders and concave pockets');

  const floors = {callouts:[{name:'ground passage',polygon:square(0,0,10),minY:-.1,maxY:2.9},{name:'upper deck',polygon:square(0,0,10),minY:3,maxY:5}],zones:[{name:'outer lane',x:0,z:0,radius:20,maxY:2.9}]};
  for(const y of [0,1.2,2.9]) assert.equal(resolveMapCallout(floors,{x:0,y,z:0}).name,'ground passage');
  for(const y of [3,3.2,5]) assert.equal(resolveMapCallout(floors,{x:0,y,z:0}).name,'upper deck');
  assert.equal(resolveMapCallout(floors,{x:0,y:6,z:0}),null);
  assert.equal(resolveMapCallout(floors,{x:0,y:NaN,z:0}),null);
  assert.equal(resolveMapCallout(floors,{x:Infinity,z:0}),null);
  assert.equal(resolveMapCallout({zones:[{name:'invalid',x:0,z:0,radius:10,polygon:[]}]},{x:0,z:0}),null,'A malformed polygon cannot silently widen to a circle');
  pass('ground and raised deck names honor actor foot height without invalid fallback');

  function context() {
    const calls = [], stack = [];
    let state = {fillStyle:'',strokeStyle:'',lineWidth:1,dash:[]},points=[];
    const target = {calls,
      save(){stack.push({...state,dash:[...state.dash]});},restore(){state=stack.pop()||state;},
      beginPath(){points=[];},moveTo(x,y){points.push([x,y]);},lineTo(x,y){points.push([x,y]);},closePath(){calls.push({op:'closePath'});},
      setLineDash(dash){state.dash=[...dash];calls.push({op:'dash',dash:[...dash]});},
      fill(){calls.push({op:'fill',...state,points:points.map(p=>[...p])});},
      stroke(){calls.push({op:'stroke',...state,points:points.map(p=>[...p])});},
      arc(...args){calls.push({op:'arc',args,...state});},
      translate(...args){calls.push({op:'translate',args});},rotate(...args){calls.push({op:'rotate',args});},
      fillText(...args){calls.push({op:'fillText',args,...state});},strokeText(...args){calls.push({op:'strokeText',args,...state});},
    };
    return new Proxy(target,{get(t,key){return key in t?t[key]:key in state?state[key]:(...args)=>calls.push({op:key,args});},set(t,key,value){state[key]=value;return true;}});
  }
  const bounds = {minX:-82,maxX:82,minZ:-82,maxZ:82}, options = {bounds,px:x=>x*2,pz:z=>z*3,scale:2};
  const angled = {kind:'wall',color:'#123456',polygon:[[1,2],[5,3],[4,7],[0,6]]};
  const roof = {kind:'overhead',polygon:square(0,0,12)};
  const ctx = context();drawMapShapes(ctx,[roof,angled],options);
  const fills=ctx.calls.filter(call=>call.op==='fill'),strokes=ctx.calls.filter(call=>call.op==='stroke');
  assert.equal(fills.length,1);assert.equal(fills[0].fillStyle,angled.color);
  assert.deepEqual(fills[0].points,angled.polygon.map(([x,z])=>[x*2,z*3]),'A rotated wall uses the true polygon rather than its wider AABB');
  assert.equal(strokes.length,1);assert.deepEqual(strokes[0].dash,[3,2]);
  assert.deepEqual(strokes[0].points,roof.polygon.map(([x,z])=>[x*2,z*3]));
  assert.ok(ctx.calls.indexOf(fills[0])<ctx.calls.indexOf(strokes[0]),'An outlined roof cannot paint over ground walls');
  pass('solid polygons stay exact and overhead roofs are transparent dashed outlines');

  const edge = context();drawMapShapes(edge,[{x:0,z:0,w:4,d:2},{points:[[0,0],[3,4]],width:.5},{kind:'wall',polygon:square(200,200,4)},{polygon:[[0,0],[NaN,1],[1,1]]},{x:0,z:0,w:NaN,d:2}],{...options,large:true});
  assert.equal(edge.calls.filter(call=>call.op==='fill').length,1);
  assert.equal(edge.calls.filter(call=>call.op==='stroke').length,1);
  assert.ok(edge.calls.flatMap(call=>call.points||[]).every(point=>point.every(Number.isFinite)));
  pass('legacy rectangles and route strokes remain supported; invalid/off-map shapes are skipped');

  const metadata={landmarks:[{id:'warp',name:'warp only',x:9,z:9}],callouts:[{name:'HUD pocket',polygon:square(0,0,4),label:{x:1,z:2,text:'A 前室',align:'right'}},{name:'HUD only',polygon:square(9,9,2)}]};
  const before=JSON.stringify(metadata);
  assert.deepEqual(getMapCalloutLabels(metadata),[{name:'A 前室',x:1,z:2,align:'right'}]);
  assert.equal(JSON.stringify(metadata),before,'Presentation never appends callouts to the practice warp list');
  assert.deepEqual(getMapCalloutLabels({landmarks:metadata.landmarks}),[{name:'warp only',x:9,z:9,align:'left'}]);
  pass('large-map labels are independent from practice travel destinations');

  const source=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8');
  const begin=source.indexOf('function drawMinimap('),end=source.indexOf('\nfunction enemyRimFor(',begin);
  assert.ok(begin>=0&&end>begin);
  const renderContext=context(),target={width:720,height:720,getContext:()=>renderContext};
  const map={bounds,mapShapes:[roof,angled],sites:[],callouts:metadata.callouts,landmarks:metadata.landmarks};
  const actor={x:0,y:0,z:0,yaw:0,alive:false,team:'red'},watched={x:5,y:3.2,z:6,alive:true,team:'red',group:{rotation:{y:.5}}};
  const markerTeams=[];
  const sandbox={map,player:actor,spectatedBot:watched,target,elapsed:4,bots:[{alive:true,team:'blue',x:10,z:10,spottedUntil:0},{alive:true,team:'red',x:12,z:12},{alive:true,team:'blue',x:14,z:14,spottedUntil:5}],teamAbilities:{markers:team=>{markerTeams.push(team);return[];}},ordinarySkills:{markers:team=>{markerTeams.push(team);return[];}},IAGNU_SKILLS:{tagRevealDuration:1.25},match:null,scanTime:0,clamp:(value,min,max)=>Math.min(max,Math.max(min,value)),resolveMapCallout,drawMapShapes,getMapCalloutLabels};
  vm.createContext(sandbox);vm.runInContext(`${source.slice(begin,end)}\ndrawMinimap(target,true);`,sandbox);
  const scale=640/164,px=x=>40+(x+82)*scale;
  const arcs=renderContext.calls.filter(call=>call.op==='arc');
  assert.equal(arcs.length,2,'The minimap still omits an unspotted enemy');
  assert.ok(!arcs.some(call=>call.args[0]===px(10)));
  assert.deepEqual(markerTeams,['red','red'],'Both tactical marker streams keep the player-team visibility boundary');
  const translation=renderContext.calls.find(call=>call.op==='translate');
  assert.ok(Math.abs(translation.args[0]-px(5))<1e-9&&Math.abs(translation.args[1]-px(6))<1e-9,'The map arrow follows the spectated teammate rather than the corpse');
  assert.equal(renderContext.calls.find(call=>call.op==='rotate').args[0],-(.5+Math.PI));
  assert.ok(renderContext.calls.some(call=>call.op==='fillText'&&call.args[0].includes('破線：頭上の屋根')));
  assert.ok(renderContext.calls.some(call=>call.op==='fillText'&&call.args[0]==='A 前室'));
  assert.ok(!renderContext.calls.some(call=>call.op==='fillText'&&call.args[0]==='warp only'));
  assert.match(source,/const zone=resolveMapCallout\(map,!player\.alive&&spectatedBot\?spectatedBot:player\)/);
  pass('actual game minimap preserves enemy/ping visibility, spectator pose and roof legend');

  const helperSource=fs.readFileSync(path.join(__dirname,'public/map-callouts.js'),'utf8');
  const mutations=[
    ['smallest region','size < smallest','best === null',mutant=>assert.equal(mutant.resolveMapCallout(regions,{x:0,z:0}).name,'small entrance')],
    ['height boundary','!area?.name || !containsHeight(area, y) || !validPolygon(area.polygon)','!area?.name || !validPolygon(area.polygon)',mutant=>assert.equal(mutant.resolveMapCallout(floors,{x:0,y:3.2,z:0}).name,'upper deck')],
    ['transparent roof',"shape.kind === 'overhead'",'false',mutant=>{const probe=context();mutant.drawMapShapes(probe,[roof,angled],options);assert.equal(probe.calls.filter(call=>call.op==='fill').length,1);}],
  ];
  for(const [name,original,replacement,verify]of mutations){
    assert.ok(helperSource.includes(original),`${name} mutation anchor exists`);
    const mutant=await import(`data:text/javascript;base64,${Buffer.from(helperSource.replace(original,replacement)).toString('base64')}`);
    assert.throws(()=>verify(mutant),assert.AssertionError,`${name} regression must fail when its protection is removed`);
  }
  assert.equal(fs.readFileSync(path.join(__dirname,'public/map-callouts.js'),'utf8'),helperSource,'Negative controls run only in memory');
  pass('three in-memory negative controls detect region, height and roof regressions');

  const [{createMap},THREE]=await Promise.all([load('map.js'),load('vendor/three.module.js')]);
  global.document={createElement:()=>({getContext:()=>new Proxy({measureText:text=>({width:String(text).length*8})},{get:(object,key)=>object[key]||(()=>{})})})};
  const realMap=createMap(THREE,new THREE.Group());
  assert.deepEqual(realMap.landmarks.map(point=>[point.id,point.x,point.z,point.yaw]),[['north',-23,-11,0],['south',0,64,0],['mewe',43,-7,-.55],['aeon',-65,-45,undefined],['bus',-55,28,undefined],['mid',-9.5,4,undefined],['deck',72.5,17,0]]);
  assert.equal(realMap.layout.version,3);
  for(const [side,names]of Object.entries({A:{'a-main':'a-main','a-link':'a-link'},B:{'b-main':'b-court','b-link':'b-link'}})){
    for(const entrance of realMap.layout.entrances[side]) assert.equal(resolveMapCallout(realMap,{...entrance,y:0})?.id,names[entrance.id],`${entrance.id} has a precise name at the actual entrance`);
    assert.equal(resolveMapCallout(realMap,{...realMap.layout.siteEntries[side],y:0})?.id,`${side.toLowerCase()}-link`,'Existing link entry coordinates also receive the precise new name');
  }
  assert.equal(resolveMapCallout(realMap,{x:-45,y:0,z:-30.5})?.id,'rotation');
  assert.equal(resolveMapCallout(realMap,{x:-45,y:3.2,z:-30.5})?.id,'west-deck');
  assert.equal(resolveMapCallout(realMap,{x:62,y:3.2,z:-11.5})?.id,'east-deck');
  assert.equal(resolveMapCallout(realMap,{x:-20.75,y:0,z:-48})?.id,'station');
  for(const site of realMap.sites) assert.ok(resolveMapCallout(realMap,{x:site.x,y:0,z:site.z})?.name.includes(site.id),'The planted court retains its site identity');
  const {TACTICAL_BUILDINGS}=await load('tactical-layout.js');
  for(const building of TACTICAL_BUILDINGS){
    const shapes=realMap.mapShapes.filter(shape=>shape.layoutId===building.id);
    assert.equal(shapes.length,1,`${building.id} appears once on the radar`);
    const shape=shapes[0];
    assert.equal(shape.kind,'tactical');assert.equal(shape.base,0);assert.equal(shape.height,building.height);
    assert.deepEqual(shape.polygon,[[building.minX,building.minZ],[building.maxX,building.minZ],[building.maxX,building.maxZ],[building.minX,building.maxZ]],`${building.id} has its actual solid footprint, not a navigation approximation`);
  }
  const actualContext=context();drawMapShapes(actualContext,realMap.mapShapes,{bounds:realMap.bounds,px:x=>x,pz:z=>z,scale:1,large:true});
  const overhead=realMap.mapShapes.filter(shape=>shape.kind==='overhead');
  assert.ok(overhead.length>0);
  assert.equal(actualContext.calls.filter(call=>call.op==='stroke'&&call.dash.length).length,overhead.length);
  pass('live arena entrances, stacked callouts, exact new walls and seven unchanged warps');

  const used=process.cpuUsage(cpu);console.log(`TOTAL ${groups} groups PASS wall=${(performance.now()-started).toFixed(3)}ms cpu=${((used.user+used.system)/1000).toFixed(3)}ms (offline canvas/VM only; no browser or audio)`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
