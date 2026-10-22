const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {normalizedLegacyColliders}=require('./tests-tactical-legacy.cjs');

async function main() {
  const load = file => import(pathToFileURL(path.join(__dirname, 'public', file)).href);
  const [{SITE_AREAS,isInsideSite,getSitePlantPosition},THREE,{createMap},{createNavigation}] = await Promise.all([
    load('site-areas.js'),load('vendor/three.module.js'),load('map.js'),load('navigation.js'),
  ]);
  const context2d = new Proxy({measureText:text=>({width:String(text).length*8})},{get:(target,key)=>target[key]||(()=>{})});
  global.document = {createElement:()=>({getContext:()=>context2d})};
  const map = createMap(THREE,new THREE.Scene());
  const navigation = createNavigation(map);
  assert.deepEqual(map.bounds,{minX:-82,maxX:82,minZ:-82,maxZ:82});
  const legacyColliders=normalizedLegacyColliders(map.colliders),arenaColliders=legacyColliders.slice(0,62);
  const railColliders=map.colliders.filter(collider=>collider.kind==='railing');
  const surfaces=map.colliders.filter(collider=>collider.kind==='surface');
  assert.equal(arenaColliders.length,62,'The layout retains one service building and one meaningful cover per site');
  assert.equal(railColliders.length,87,'Four segmented stair handrails and seven deck handrails prevent walking off their guarded edges');
  assert.deepEqual(legacyColliders.slice(0,62),arenaColliders,'Only the six approved props move; all original collision retains its order');
  assert.deepEqual(map.colliders.slice(62,149),railColliders,'Landing supports do not reorder or replace the handrails');
  assert.equal(createHash('sha256').update(JSON.stringify(railColliders)).digest('hex'),
    'e3778031958951695436040ea1e6a826febdb4303f08cdea9f2ff1b478cead12',
    'All 87 handrail bounds retain their exact physical dimensions');
  assert.equal(createHash('sha256').update(JSON.stringify(arenaColliders)).digest('hex'),
    '2f1540d46ea80f52346b34fd07452fccbc8bb8551daa207c2d342db937a056be',
    'All 62 old arena solids retain their exact dimensions after validating only six declared translations');
  for(const rail of railColliders){
    assert.ok(rail.base>.95,'Rail bounds must leave the lower space open');
    assert.ok(rail.height-rail.base<.245,'Only the slim upper handrail is physical');
  }
  assert.equal(surfaces.length,30,'Every audited reachable canopy and low stone bench has an explicit support');
  assert.equal(new Set(surfaces.map(surface=>surface.surfaceId)).size,surfaces.length);
  for(const surface of surfaces){assert.ok(surface.base>=0&&surface.base<surface.height);assert.ok(surface.height-surface.base<=.7+1e-8,'Surface bounds follow the thin actual slab, rather than closing the space below');}
  for(const [id,x,z,top,base]of[
    ['mewe-canopy-cap',68,-17,3.45,3.35],['bus-shelter-cap',-58,0,4.49,4.37],
    ['station-west-canopy-cap',-45,-30.5,5.92,5.82],['station-east-canopy-cap',4,-30.5,5.92,5.82],
    ['south-stone--34-cap',-34,66,.79,.67],['south-stone--27-cap',-27,66,.79,.67],['south-stone--20-cap',-20,66,.79,.67],
    ['west-retail-front-canopy',-30,43,3.725,3.475],['west-retail-side-canopy',-43.3,25,3.725,3.475],
    ['west-retail-small-canopy-15',-44.9,15,2.89,2.71],['west-retail-small-canopy-35',-44.9,35,2.89,2.71],
    ['east-retail-side-canopy',44,25,3.62,3.38],['information-roof-cap',6.5,14,4.425,4.275],
    ['staff-roof-cap',29,-44,5.4,5.2],['divider-roof-cap',0,-15,6.96,6.84],['station-portal-cap',-20.75,-32,4.45,4.36],
  ]){
    const surface=surfaces.find(surface=>surface.surfaceId===id);
    assert.ok(surface&&map.collision.overlaps(surface,x,z,0),`${id} covers the audited landing position`);
    assert.equal(surface.height,top);assert.equal(surface.base,base);
    assert.equal(map.collision.blocked(x,z,.1,top),false,`${id} permits standing on its real upper face`);
    assert.equal(map.collision.rayClear(x,top+.05,z,x,base-.05,z),false,`${id} has a real thin solid span`);
  }
  const sill=surfaces.find(surface=>surface.surfaceId==='mewe-deck-threshold');
  assert.equal(sill.height,3.325);assert.equal(sill.base,3.25);
  assert.ok(Math.abs(sill.minZ+14.07)<1e-8&&Math.abs(sill.maxZ+13.37)<1e-8);
  assert.ok(sill.height-3.2<.22&&3.45-sill.height<.22,'The deck-to-canopy connection uses two valid ankle-height rises');
  assert.equal(map.collision.segmentClear(-50,-26,-50,-32.4,.34,0),true,'Ground movement still passes beneath the west deck and handrail');
  assert.equal(map.collision.segmentClear(68,-6,68,-15.7,.34,0),true,'Ground movement still passes beneath the east deck and handrail');
  assert.equal(map.collision.rayClear(-50,1.7,-26,-50,1.7,-32.4),true,'West ground-level sight is not replaced by an invisible tall wall');
  assert.equal(map.collision.rayClear(68,1.7,-6,68,1.7,-15.7),true,'East ground-level sight is not replaced by an invisible tall wall');
  const originalColliders=arenaColliders.filter(collider=>!collider.layoutRole);
  assert.equal(originalColliders.length,59,'All existing collision remains in place');
  assert.equal(createHash('sha256').update(JSON.stringify(originalColliders)).digest('hex'),
    '72c7202614e1c496e9e14be0b0ed990e5a3749253d55aa93f3c6a39a37bbbf3a',
    'Existing physical geometry must remain identical around the three additions');
  assert.equal(map.lanes.length,3);
  const defenderYaw=map.spawnYaw.defend,forward={x:-Math.sin(defenderYaw),z:-Math.cos(defenderYaw)};
  const initialDistance=5.4*2,concourseEntry={x:-20.75,z:-64};
  const defenderStarts=[];
  for(const [index,spawn]of map.teamSpawns.defend.entries()){
    const firstStep={x:spawn.x+forward.x*initialDistance,z:spawn.z+forward.z*initialDistance};
    assert.ok(map.collision.segmentClear(spawn.x,spawn.z,firstStep.x,firstStep.z,.34,0),`Defender${index} can walk forward for two seconds without running into the station wall`);
    assert.ok(navigation.isWalkable(firstStep.x,firstStep.z));
    const route=navigation.path(firstStep.x,firstStep.z,concourseEntry.x,concourseEntry.z);
    assert.ok(route.length,`Defender${index} must reach the rear concourse after its initial move`);
    let previous=firstStep,distance=initialDistance;
    for(const step of route){assert.ok(navigation.clearSegment(previous.x,previous.z,step.x,step.z));distance+=Math.hypot(step.x-previous.x,step.z-previous.z);previous=step;}
    assert.ok(Math.hypot(previous.x-concourseEntry.x,previous.z-concourseEntry.z)<.01);
    assert.ok(distance<40,'The initial facing must lead into the nearby rear service passage');
    defenderStarts.push({index,firstStep:{x:+firstStep.x.toFixed(2),z:+firstStep.z.toFixed(2)},distance:+distance.toFixed(2)});
  }
  const centerSpawn=map.teamSpawns.defend[0],entryDistance=Math.hypot(concourseEntry.x-centerSpawn.x,concourseEntry.z-centerSpawn.z);
  assert.ok((forward.x*(concourseEntry.x-centerSpawn.x)+forward.z*(concourseEntry.z-centerSpawn.z))/entryDistance>.99999,'The central defender faces the rear concourse opening');
  assert.ok(map.collision.segmentClear(centerSpawn.x,centerSpawn.z,concourseEntry.x,concourseEntry.z,.34,0),'The central defender can walk directly to the rear opening');

  const [a,b] = map.sites;
  assert.equal(a.id,'A');assert.equal(b.id,'B');
  for(const site of map.sites){
    assert.equal(site.radius,7,'The old radius remains available for callouts');
    assert.deepEqual(site.polygon,SITE_AREAS[site.id].polygon);
    assert.deepEqual(site.plantPositions,SITE_AREAS[site.id].plantPositions);
    assert.equal(site.polygon.length,4,'Both planted areas have a deliberate rectangular boundary');
    assert.equal(site.plantPositions.length,3);
    assert.equal(new Set(site.plantPositions.map(point=>point.id)).size,3);
    assert.deepEqual(site.plantPositions.map(point=>point.style).sort(),['cover','deep','open']);
    assert.ok(isInsideSite(site,site.x,site.z),'The original landmark center stays valid');
    for(const corner of site.polygon){assert.ok(isInsideSite(site,...corner),'Boundary corners are included');assert.equal(isInsideSite(site,...corner,{margin:.1}),false,'A positive margin insets the boundary');}
    assert.equal(isInsideSite(site,NaN,site.z),false);
    assert.equal(isInsideSite(site,site.x,Infinity),false);
    assert.equal(isInsideSite(site,site.x,site.z,{margin:-1}),false);
  }
  assert.ok(isInsideSite(a,-45.6,-27.6),'A may be planted near the station-side corner outside the old circle');
  assert.ok(Math.hypot(-45.6-a.x,-27.6-a.z)>a.radius);
  assert.ok(isInsideSite(b,31.6,.4),'B has a valid forecourt corner outside the old circle');
  assert.ok(Math.hypot(31.6-b.x,.4-b.z)>b.radius);
  assert.equal(isInsideSite(a,-38,-28.01),false,'A excludes points past the painted station edge');
  assert.equal(isInsideSite(b,48.01,-7),false,'B excludes the deck side even inside the old circle');
  assert.equal(isInsideSite(a,-46.0001,-20),false);
  assert.equal(isInsideSite(b,40,1.0001),false);
  assert.ok(isInsideSite(a,-45.5,-20,{margin:.5}));
  assert.equal(isInsideSite(a,-45.51,-20,{margin:.5}),false);
  const legacy = {id:'fixture',x:0,z:0,radius:2};
  assert.ok(isInsideSite(legacy,2,0));assert.equal(isInsideSite(legacy,2.01,0),false);
  assert.equal(isInsideSite({...legacy,polygon:[]},0,0),false,'Invalid polygons cannot silently use a broader circle');
  assert.equal(isInsideSite(null,0,0),false);
  const concave = {polygon:[[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]]};
  assert.ok(isInsideSite(concave,.5,3));assert.equal(isInsideSite(concave,3,3),false);

  const spawns = [map.spawn,...map.teamSpawns.attack,...map.teamSpawns.defend];
  let checkedRoutes = 0;
  for(const site of map.sites){
    for(const point of site.plantPositions){
      assert.ok(isInsideSite(site,point.x,point.z,{margin:.5}),`${point.id} has room inside the paint`);
      assert.equal(map.collision.blocked(point.x,point.z,.5,0),false,`${point.id} is clear at ground level`);
      assert.ok(navigation.isWalkable(point.x,point.z));
      const preferred = getSitePlantPosition(site,0,65,{preferredId:point.id,collision:map.collision});
      assert.equal(preferred.id,point.id,'An actor retains its selected plant location');
      preferred.x += 1;
      assert.equal(site.plantPositions.find(p=>p.id===point.id).x,point.x,'Selection returns a copy');
      for(const spawn of spawns){
        const route = navigation.path(spawn.x,spawn.z,point.x,point.z);
        assert.ok(route.length,`${point.id} must be reachable from every team spawn`);
        let previous = spawn,distance = 0;
        for(const step of route){
          assert.ok(navigation.clearSegment(previous.x,previous.z,step.x,step.z),`${point.id} route cannot cut through cover`);
          distance += Math.hypot(step.x-previous.x,step.z-previous.z);previous=step;
        }
        assert.ok(Math.hypot(previous.x-point.x,previous.z-point.z)<.01);
        assert.ok(distance<220,`${point.id} stays within arena walking distance`);
        checkedRoutes++;
      }
    }
    const first = site.plantPositions[0],last = site.plantPositions[2];
    assert.equal(getSitePlantPosition(site,last.x,last.z,{collision:map.collision}).id,last.id,'An uncommitted actor can select its nearest candidate');
    const occupied = {blocked:(x,z)=>Math.hypot(x-first.x,z-first.z)<.1};
    assert.notEqual(getSitePlantPosition(site,first.x,first.z,{preferredId:first.id,collision:occupied}).id,first.id,'A blocked candidate must be replaced');
    assert.equal(getSitePlantPosition(site,0,0,{collision:{blocked:()=>true}}),null,'Fully blocked candidates cannot fall back into unsafe cover');
  }
  assert.equal(getSitePlantPosition(null,0,0),null);
  assert.equal(getSitePlantPosition(a,0,0,{clearance:NaN}),null);
  assert.deepEqual(getSitePlantPosition(legacy,3,0),{id:'fixture-center',label:'設置位置',style:'open',x:0,z:0});
  assert.equal(map.collision.rayClear(-43,1,-9,-43,1,-18.6),false,'A cover candidate must actually sit behind the existing tall crate');
  assert.equal(map.collision.rayClear(34,1,4,34,1,-7.6),false,'B cover candidate must actually sit behind the existing tall crate');
  assert.equal(map.collision.rayClear(-36.5,1,-14,-36.5,1,-19.5),true,'A open candidate stays exposed after the new frontage turn');
  assert.equal(map.collision.rayClear(-36.5,1,-5,-36.5,1,-19.5),false,'The new frontage intentionally breaks the former long forecourt line');
  assert.equal(map.collision.rayClear(53,1,-2,42.5,1,-.8),true,'B open candidate retains its avenue line');

  assert.equal(map.layout?.version,3);
  const divider=map.colliders.find(collider=>collider.layoutRole==='central-divider');
  assert.ok(divider&&divider.height>=6,'A fabricated service building must actually divide the open plaza');
  assert.equal(map.collision.rayClear(a.x,1.7,a.z,b.x,1.7,b.z),false,'The two site centers cannot have an unbroken shooting line');
  const entryA=map.layout.siteEntries.A,entryB=map.layout.siteEntries.B;
  assert.ok(navigation.isWalkable(entryA.x,entryA.z));assert.ok(navigation.isWalkable(entryB.x,entryB.z));
  assert.ok(entryA.x<divider.minX&&entryB.x>divider.maxX,'A and B entries must use different sides of the service building');
  assert.equal(map.collision.rayClear(entryA.x,1.7,entryA.z,entryB.x,1.7,entryB.z),false,'Entry routes cannot directly shoot across the middle');
  for(const point of map.layout.rotationEnds)assert.ok(navigation.isWalkable(point.x,point.z),'Both ends of the service building retain a route around it');
  for(const pocket of map.layout.protectedPockets){
    const site=map.sites.find(site=>site.id===pocket.site);
    assert.ok(isInsideSite(site,pocket.x,pocket.z,{margin:.5}));assert.ok(navigation.isWalkable(pocket.x,pocket.z));
    assert.equal(map.collision.rayClear(pocket.approach.x,1.7,pocket.approach.z,pocket.x,1.7,pocket.z),false,`${pocket.site} has a new head-height protected planting pocket`);
    assert.ok(navigation.path(map.spawn.x,map.spawn.z,pocket.x,pocket.z).length);
  }
  let previous=a,rotationDistance=0;const rotation=navigation.path(a.x,a.z,b.x,b.z);
  assert.ok(rotation.length);
  for(const point of rotation){assert.ok(navigation.clearSegment(previous.x,previous.z,point.x,point.z));rotationDistance+=Math.hypot(point.x-previous.x,point.z-previous.z);previous=point;}
  const directDistance=Math.hypot(a.x-b.x,a.z-b.z);
  assert.ok(rotationDistance>directDistance*1.08&&rotationDistance<120,'A rotation must route around meaningful geometry while remaining practical');

  const markings = [];
  map.world.traverse(mesh=>{if(mesh.name.includes('painted planting perimeter'))markings.push(mesh);});
  assert.equal(markings.length,2);
  for(const mesh of markings){assert.equal(mesh.userData.solid,false);assert.equal(mesh.castShadow,false);assert.equal(mesh.material.depthWrite,false);}
  console.log(`PASS: polygon bounds, legacy support, six plant positions, ${checkedRoutes} unobstructed routes, distinct site entries, protected pockets, ${rotationDistance.toFixed(1)}m rotation, original62 solids preserved apart from six approved prop translations, ${railColliders.length} unchanged narrow handrail bounds, and ${surfaces.length} visible landing supports including the lowered portal roof`);
  console.log(JSON.stringify({defenderYaw,initialWalkMeters:initialDistance,defenderStarts}));
}

main().catch(error=>{console.error(error);process.exitCode=1;});
