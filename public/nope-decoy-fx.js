import { acquireNopeDecoyAsset } from './nope-avatar.js';

const MAX_DECOYS=50,MAX_SCAN=200;
const REQUIRED=['id','type','team','sourceId','round','x','y','z','startedAt','endsAt'];
const CONTROL=/[\u0000-\u001f\u007f]/;
const coordinate=value=>Number.isFinite(value)&&Math.abs(value)<=1000;
const identifier=value=>typeof value==='string'&&value.length>0&&value.length<=128&&!CONTROL.test(value);
function validEvent(event,now){
  if(!event||typeof event!=='object'||Array.isArray(event)
    ||!REQUIRED.every(key=>Object.hasOwn(event,key))
    ||event.type!=='nope-decoy'||!identifier(event.id)||!identifier(event.sourceId)
    ||(event.team!=='red'&&event.team!=='blue')||!Number.isSafeInteger(event.round)||event.round<1
    ||!coordinate(event.x)||!coordinate(event.y)||!coordinate(event.z)
    ||!Number.isFinite(event.startedAt)||event.startedAt<0||!Number.isFinite(event.endsAt)||event.endsAt<0
    ||event.endsAt<=event.startedAt||(Object.hasOwn(event,'yaw')&&!Number.isFinite(event.yaw)))return false;
  return now>=event.startedAt&&now<event.endsAt;
}

// Cosmetic only: host-owned analytic hit tests and navigation never inspect
// these meshes. Absolute detached events also reconstruct cleanly on a rejoin.
export function createNopeDecoyFX(THREE){
  const asset=acquireNopeDecoyAsset(THREE),group=new THREE.Group(),batches=[];
  group.name='NOPE / full body decoys';group.visible=false;
  const transform=new THREE.Object3D(),leg=new THREE.Object3D(),result=new THREE.Matrix4(),pivot=new THREE.Matrix4().makeTranslation(0,-.8,0),seen=new Set();let disposed=false;
  for(const part of asset.parts){
    const mesh=new THREE.InstancedMesh(part.geometry,part.material,MAX_DECOYS);
    mesh.name=`NOPE decoy / ${part.finish}${part.motion!=='body'?' '+part.motion:''}${part.team?` ${part.team}`:''}`;mesh.count=0;mesh.visible=false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;
    mesh.castShadow=false;mesh.receiveShadow=false;mesh.raycast=()=>{};
    mesh.userData.solid=false;mesh.userData.character='nope';mesh.userData.decoy=true;
    group.add(mesh);batches.push({mesh,team:part.team,motion:part.motion});
  }
  group.userData.capacity=MAX_DECOYS;group.userData.activeEvents=0;
  function reset(){
    seen.clear();for(const {mesh}of batches){mesh.count=0;mesh.visible=false;}group.visible=false;group.userData.activeEvents=0;
  }
  function update(events,now,{viewer=null}={}){
    if(disposed)return;reset();
    if(!Number.isFinite(now)||now<0||!Array.isArray(events))return;
    for(let index=0;index<Math.min(events.length,MAX_SCAN);index++){
      const event=events[index];if(!validEvent(event,now)||seen.has(event.id))continue;
      seen.add(event.id);
      const yaw=Object.hasOwn(event,'yaw')?event.yaw:viewer&&coordinate(viewer.x)&&coordinate(viewer.z)?Math.atan2(viewer.x-event.x,viewer.z-event.z):0;
      // Translation is already derived by host-clock event views. Limb motion is cosmetic.
      transform.position.set(event.x,event.y,event.z);transform.rotation.set(0,yaw,0);transform.scale.set(1,1,1);transform.updateMatrix();
      for(const {mesh,team,motion}of batches){if(team&&team!==event.team)continue;
        if(motion!=='body'&&event.walking===true&&Number.isFinite(event.walkPhase)){const angle=Math.sin(event.walkPhase*4)*(motion==='legL'?1:-1)*.35;leg.position.set(0,.8,0);leg.rotation.set(angle,0,0);leg.updateMatrix();result.multiplyMatrices(transform.matrix,leg.matrix).multiply(pivot);mesh.setMatrixAt(mesh.count++,result);}
        else mesh.setMatrixAt(mesh.count++,transform.matrix);}
      if(seen.size===MAX_DECOYS)break;
    }
    for(const {mesh}of batches){mesh.visible=mesh.count>0;if(mesh.visible)mesh.instanceMatrix.needsUpdate=true;}
    group.userData.activeEvents=seen.size;group.visible=seen.size>0;
  }
  function dispose(){
    if(disposed)return;disposed=true;reset();group.removeFromParent();
    for(const {mesh}of batches)mesh.dispose();asset.dispose();
  }
  return {group,update,reset,dispose};
}
