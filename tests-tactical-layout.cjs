const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

function inspectTacticalLayout(map,navigation,THREE,buildings){
  assert.equal(map.layout.version,3);
  assert.equal(buildings.length,10);
  const extra=map.colliders.slice(179),solids=extra.filter(c=>c.kind==='tactical'&&c.base===0),awnings=extra.filter(c=>c.kind==='tactical'&&c.base>0);
  assert.equal(solids.length,10,'Each new architectural footprint has one physical building');
  assert.equal(new Set(solids.map(c=>c.layoutId)).size,10);
  assert.equal(awnings.length,3,'All three projecting awnings also receive thin overhead support');
  assert.deepEqual(awnings.map(c=>c.layoutId).sort(),['a-cafe/awning','b-dining/awning','mid-newsstand/awning']);
  assert.equal(extra.length,13);assert.ok(extra.every(c=>c.kind==='tactical'));
  for(const awning of awnings){
    assert.ok(awning.base>3&&awning.height-awning.base<.23,'Awning support follows the thin roof, leaving the lower passage open');
    const x=(awning.minX+awning.maxX)/2,z=(awning.minZ+awning.maxZ)/2;
    assert.equal(map.collision.blocked(x,z,.1,0),false,'A thin frontage awning cannot become a tall invisible fence');
    assert.equal(map.collision.rayClear(x,awning.height+.1,z,x,awning.base-.1,z),false);
    assert.equal(map.collision.blocked(x,z,.1,awning.height),false,'The newly reachable awning retains a real upper landing face');
  }
  const group=map.world.getObjectByName('Tactical layout / additions');
  assert.ok(group?.userData.tacticalLayout,'The new architecture must remain separately auditable');
  group.updateWorldMatrix(true,true);
  let drawObjects=0,triangles=0;const geometries=new Set(),materials=new Set();
  group.traverse(mesh=>{if(!mesh.isMesh)return;drawObjects++;geometries.add(mesh.geometry);[].concat(mesh.material).forEach(m=>materials.add(m));triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3*(mesh.isInstancedMesh?mesh.count:1);});
  assert.ok(drawObjects>0&&drawObjects<=60,'Architectural detail must stay batched');
  assert.ok(triangles>100&&triangles<=50000,'Ten corridor buildings may not silently multiply the map triangle budget');
  for(const building of buildings){
    const collider=solids.find(c=>c.layoutId===building.id);
    for(const field of ['minX','maxX','minZ','maxZ','height'])assert.equal(collider[field],building[field],`${building.id} physical footprint matches its declared architecture`);
    const x=(collider.minX+collider.maxX)/2,z=(collider.minZ+collider.maxZ)/2;
    assert.equal(map.collision.blocked(x,z,.42,0),true,`${building.id} cannot be traversed`);
    assert.equal(map.collision.rayClear(collider.minX-1,1.7,z,collider.maxX+1,1.7,z),false,`${building.id} blocks head-height fire`);
    const ray=new THREE.Raycaster(new THREE.Vector3(collider.minX-1,1.7,z),new THREE.Vector3(1,0,0),0,collider.maxX-collider.minX+2);
    assert.ok(ray.intersectObject(group,true).some(hit=>hit.point.x>=collider.minX-.1&&hit.point.x<=collider.maxX+.1),`${building.id} has a visible wall where its collider blocks the route`);
    // Existing bus/deck canopies may overhang a new roof; they legitimately
    // prevent standing where there is less than1.7m of headroom.
    assert.ok(collider.height>0&&collider.height<6,'Architectural collision stops at the actual finite roof height');
  }
  const routes=[];
  function route(from,to,label,maxDistance=180){
    assert.ok(navigation.isWalkable(from.x,from.z),`${label}: actual start is clear without nearest() relocation`);
    assert.ok(navigation.isWalkable(to.x,to.z),`${label}: actual destination is clear without nearest() relocation`);
    const points=navigation.path(from.x,from.z,to.x,to.z);
    assert.ok(points.length,`${label}: path exists`);let previous=from,distance=0;
    for(const point of points){
      assert.ok(navigation.clearSegment(previous.x,previous.z,point.x,point.z),`${label}: smoothed route cannot clip an inside corner`);
      assert.ok(point.x>=map.bounds.minX+.42&&point.x<=map.bounds.maxX-.42&&point.z>=map.bounds.minZ+.42&&point.z<=map.bounds.maxZ-.42,`${label}: no shortcut beyond the arena`);
      distance+=Math.hypot(point.x-previous.x,point.z-previous.z);previous=point;
    }
    assert.ok(Math.hypot(previous.x-to.x,previous.z-to.z)<.01,`${label}: route reaches the actual endpoint`);
    assert.ok(distance<=maxDistance,`${label}: ${distance.toFixed(2)}m exceeds ${maxDistance}m`);
    return {distance,points};
  }
  for(const lane of map.lanes){
    assert.ok(lane.points.length>=7,'Each macro lane contains several architectural turns');let distance=0;
    for(let i=1;i<lane.points.length;i++)distance+=route(lane.points[i-1],lane.points[i],`${lane.id} corner${i}`,35).distance;
    const direct=Math.hypot(lane.points.at(-1).x-lane.points[0].x,lane.points.at(-1).z-lane.points[0].z);
    assert.ok(distance>direct*1.2&&distance<140,`${lane.id} is a winding but practical approach`);
    const shortest=route(lane.points[0],lane.points.at(-1),`${lane.id} shortest approach`,140);
    assert.ok(shortest.points.length>=3,`${lane.id} cannot skip every new turn in one straight smoothed line`);
    routes.push({id:lane.id,macroMeters:+distance.toFixed(2),shortestMeters:+shortest.distance.toFixed(2),walkSeconds:+(distance/5.4).toFixed(2)});
  }
  const connectors=map.layout.connectors;
  assert.deepEqual(connectors.map(c=>c.id).sort(),['defender-rotation','mid-a','mid-b']);
  for(const connector of connectors)for(let i=1;i<connector.points.length;i++)route(connector.points[i-1],connector.points[i],`${connector.id} segment${i}`,45);
  for(const site of map.sites){
    const entries=map.layout.entrances[site.id];assert.equal(entries.length,2,'Both sites retain two usable entrances');
    assert.ok(Math.hypot(entries[0].x-entries[1].x,entries[0].z-entries[1].z)>12,'Site entrances must be physically distinct');
    for(const entry of entries)for(const point of site.plantPositions)route(entry,point,`${entry.id}→${point.id}`,70);
    for(const spawn of [...map.teamSpawns.attack,...map.teamSpawns.defend])route(spawn,site,`spawn→${site.id}`,180);
  }
  const rotation=route(map.sites[0],map.sites[1],'site rotation',120);assert.ok(rotation.distance>85,'The new site rotation must actually pass around architecture');
  for(const check of map.layout.sightlineChecks.blocked){
    assert.equal(map.collision.rayClear(check.from.x,1.7,check.from.z,check.to.x,1.7,check.to.z),false,`${check.id}: the former long shooting lane is blocked`);
    assert.equal(navigation.clearSegment(check.from.x,check.from.z,check.to.x,check.to.z),false,`${check.id}: walking cannot bypass the same wall`);
  }
  for(const check of map.layout.sightlineChecks.clear){
    assert.equal(map.collision.rayClear(check.from.x,1.7,check.from.z,check.to.x,1.7,check.to.z),true,`${check.id}: the final approach/underpass keeps its real sight line`);
    assert.equal(map.collision.segmentClear(check.from.x,check.from.z,check.to.x,check.to.z,.4,0),true,`${check.id}: normal body width still fits`);
  }
  // Keep usable width through the two intentional choke cross-sections.
  for(const [label,a,b]of [['a-main',{x:-50.5,z:-5},{x:-43.5,z:-5}],['delivery-court',{x:68,z:24.5},{x:68,z:27.5}]])
    assert.equal(map.collision.segmentClear(a.x,a.z,b.x,b.z,.42,0),true,`${label}: passage width includes a full body clearance`);
  for(const landmark of map.landmarks){const target={x:landmark.travelX??landmark.x,z:landmark.travelZ??landmark.z};route(map.spawn,target,`landmark ${landmark.id}`,200);}
  return {drawObjects,triangles,geometries:geometries.size,materials:materials.size,routes,rotationMeters:+rotation.distance.toFixed(2)};
}

async function main(){
  const started=performance.now(),cpu=process.cpuUsage(),load=file=>import(pathToFileURL(path.join(__dirname,'public',file)).href);
  const [THREE,{createMap},{createNavigation},{TACTICAL_BUILDINGS}]=await Promise.all([load('vendor/three.module.js'),load('map.js'),load('navigation.js'),load('tactical-layout.js')]);
  const context=new Proxy({measureText:t=>({width:String(t).length*8})},{get:(target,key)=>target[key]||(()=>{})});
  global.document={createElement:()=>({width:0,height:0,getContext:()=>context})};
  const map=createMap(THREE,new THREE.Scene()),result=inspectTacticalLayout(map,createNavigation(map),THREE,TACTICAL_BUILDINGS),used=process.cpuUsage(cpu);
  console.log('PASS: physical/rendered corridor walls, three winding lanes, two exact entrances per site, connectors, rotation, blocked long rays and preserved underpasses');
  console.log(JSON.stringify({...result,wallMs:+(performance.now()-started).toFixed(1),cpuMs:(used.user+used.system)/1000}));
}
module.exports={inspectTacticalLayout};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
