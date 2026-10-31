import{URCHIN_TIDE,tideBasis}from'./urchin-tide.js';
// Bounded visual-only pools. Every world sample obeys normal depth and the
// viewer's existing smoke/ray test; nothing adds an enemy outline or map marker.
export function createUrchinTideFX(T){
 const group=new T.Group(),hand=new T.Group();group.name='深潮 / wave and bubbles';hand.name='深潮 / condensed seawater';
 const sphere=new T.SphereGeometry(1,10,6),box=new T.BoxGeometry(1,1,1),pose=new T.Object3D();
 const water=new T.MeshBasicMaterial({color:'#42c9ef',transparent:true,opacity:.55,depthTest:true,depthWrite:false}),foam=new T.MeshBasicMaterial({color:'#b5f6ff',transparent:true,opacity:.72,depthTest:true,depthWrite:false}),dark=new T.MeshBasicMaterial({color:'#12688d',transparent:true,opacity:.65,depthTest:true,depthWrite:false}),wire=new T.MeshBasicMaterial({color:'#60d9ed',wireframe:true,transparent:true,opacity:.35,depthTest:true,depthWrite:false});
 const bubbles=new T.InstancedMesh(sphere,water,URCHIN_TIDE.maxBubbles*3);bubbles.frustumCulled=false;group.add(bubbles);
 const splashes=new T.InstancedMesh(sphere,foam,80);splashes.frustumCulled=false;group.add(splashes);
 const preview=new T.Mesh(box,wire);group.add(preview);preview.visible=false;
 const palm=new T.Mesh(sphere,dark);palm.scale.set(.055,.025,.06);palm.position.set(0,-.065,.02);hand.add(palm);
 const orb=new T.Mesh(sphere,water);orb.scale.setScalar(.09);hand.add(orb);
 for(let i=0;i<7;i++){const drop=new T.Mesh(sphere,foam);drop.scale.setScalar(.011);hand.add(drop);}hand.position.set(.24,-.17,-.6);
 const items=new Map(),history=new Map(),trails=[];let lastTime=-Infinity;
 const inert=o=>{o.raycast=()=>{};o.userData.solid=false;};group.traverse(inert);hand.traverse(inert);
 const vec=p=>new T.Vector3(p.x,p.y,p.z),axis=new T.Vector3(0,0,1);
 function linePose(o,e,length){const b=tideBasis(e);if(!b)return;o.position.set((e.fromX+e.x)/2,(e.fromY+e.y)/2,(e.fromZ+e.z)/2);o.quaternion.setFromUnitVectors(axis,vec(b.f));o.scale.set(URCHIN_TIDE.width,URCHIN_TIDE.height,length);}
 function update(events,marks,actors,now,{viewer,aiming=null,pulls=[],visible=()=>false,wallClear=()=>true,reducedMotion=false,showHand=false}={}){
  if(now<lastTime)reset();lastTime=now;const seen=new Set();let splashCount=0,tiles=0;
  const casting=events.find(e=>e.type==='urchin-gloom'&&e.sourceId===viewer?.id&&now<e.triggerAt);
  hand.visible=showHand&&!!(aiming||casting);if(hand.visible){const age=casting?now-casting.startedAt:0,scale=casting?1-.35*Math.sin(Math.PI*age/URCHIN_TIDE.telegraph):1;orb.scale.setScalar(.09*scale*(age>=URCHIN_TIDE.glowAt?1.25:1));for(let i=2;i<hand.children.length;i++){const a=i*2.4+(reducedMotion?0:now*1.4),r=.14*(casting?Math.max(.2,1-age/URCHIN_TIDE.telegraph):1);hand.children[i].position.set(Math.cos(a)*r,Math.sin(a)*r*.7,Math.sin(a*1.6)*.06);}}
  preview.visible=!!aiming;if(aiming)linePose(preview,aiming,URCHIN_TIDE.range);
  for(const e of events){if(e.type!=='urchin-gloom')continue;const b=tideBasis(e);if(!b)continue;seen.add(e.id);let item=items.get(e.id);
   if(!item){const root=new T.Group(),wave=new T.InstancedMesh(box,water,16),rim=new T.InstancedMesh(sphere,foam,16),ball=new T.Mesh(sphere,dark);root.add(wave,rim,ball);root.traverse(inert);wave.frustumCulled=rim.frustumCulled=false;group.add(root);item={root,wave,rim,ball,walls:[]};items.set(e.id,item);
    // Geometry only. Remember one contact per contiguous solid interval.
    let blocked=false;for(let d=.25;d<=b.length;d+=.25){const point=t=>({x:e.fromX+b.f.x*t,y:e.fromY+b.f.y*t,z:e.fromZ+b.f.z*t}),a=point(d-.25),p=point(d),hit=!wallClear(a,p);if(hit&&!blocked)item.walls.push({d,p:a});blocked=hit;}
   }
   const age=now-e.triggerAt,d=Math.max(0,Math.min(b.length,age*URCHIN_TIDE.speed)),center={x:e.fromX+b.f.x*d,y:e.fromY+b.f.y*d,z:e.fromZ+b.f.z*d};
   item.root.position.set(0,0,0);item.ball.visible=age<0&&visible({x:e.fromX,y:e.fromY,z:e.fromZ});item.ball.position.set(e.fromX,e.fromY,e.fromZ);item.ball.scale.setScalar(.12+.1*Math.max(0,(now-e.startedAt)/URCHIN_TIDE.telegraph));
   let count=0;if(age>=0&&age<e.flight)for(let x=0;x<4;x++)for(let y=0;y<4;y++){const side=(x-1.5),height=(y-1.5)*URCHIN_TIDE.height/4,p={x:center.x+b.r.x*side+b.u.x*height,y:center.y+b.r.y*side+b.u.y*height,z:center.z+b.r.z*side+b.u.z*height};if(!visible(p))continue;
    pose.position.set(p.x,p.y,p.z);pose.quaternion.setFromUnitVectors(axis,vec(b.f));pose.scale.set(1,URCHIN_TIDE.height/4,.2);pose.updateMatrix();item.wave.setMatrixAt(count,pose.matrix);
    pose.position.addScaledVector(vec(b.f),-.08);pose.scale.set(.09,.05,.09);pose.updateMatrix();item.rim.setMatrixAt(count++,pose.matrix);
   }item.wave.count=item.rim.count=count;tiles+=count;item.wave.instanceMatrix.needsUpdate=item.rim.instanceMatrix.needsUpdate=true;
   for(const w of item.walls){const at=e.triggerAt+w.d/URCHIN_TIDE.speed,t=now-at;if(t<0||t>.22||!visible(w.p))continue;for(let i=0;i<4&&splashCount<80;i++){pose.position.set(w.p.x+Math.cos(i*1.7)*t,w.p.y+t*(1+i*.2),w.p.z+Math.sin(i*1.7)*t);pose.quaternion.identity();pose.scale.setScalar(.035*(1-t/.24));pose.updateMatrix();splashes.setMatrixAt(splashCount++,pose.matrix);}}
  }
  for(const[id,item]of items)if(!seen.has(id)){item.root.removeFromParent();item.wave.dispose();item.rim.dispose();items.delete(id);}
  for(const p of pulls)if(visible(p))for(let i=0;i<2&&splashCount<80;i++){pose.position.set(p.x+Math.sin(i*3+now*5)*.1,p.y+.07,p.z+Math.cos(i*3+now*5)*.1);pose.quaternion.identity();pose.scale.set(.045,.012,.045);pose.updateMatrix();splashes.setMatrixAt(splashCount++,pose.matrix);}
  const marked=new Map(marks.filter(m=>m.team===viewer?.team&&m.endsAt>now).map(m=>[m.id,m]));
  for(const a of actors){const mark=marked.get(a.id);if(!mark||!a.alive)continue;const previous=history.get(a.id),distance=previous?Math.hypot(a.x-previous.x,a.z-previous.z):0,dt=previous?now-previous.at:0;
   const moving=previous&&previous.mark===mark.startedAt&&dt>0&&distance<=URCHIN_TIDE.teleportDistance&&distance/dt>=URCHIN_TIDE.bubbleSpeed,moved=moving?(previous.distance||0)+distance:0;
   if(moving&&moved>=URCHIN_TIDE.bubbleDistance){
    let next=Math.max(previous.next,now-URCHIN_TIDE.bubbleLife),emitted=false;for(;next<=now+1e-8;next+=URCHIN_TIDE.bubbleInterval){const t=Math.max(0,Math.min(1,(next-previous.at)/dt));trails.push({x:previous.x+(a.x-previous.x)*t,y:previous.y+((a.y||0)-previous.y)*t+.1,z:previous.z+(a.z-previous.z)*t,at:next,team:mark.team});emitted=true;}history.set(a.id,{x:a.x,y:a.y||0,z:a.z,at:now,next,distance:emitted?0:moved,mark:mark.startedAt});
   }else history.set(a.id,{x:a.x,y:a.y||0,z:a.z,at:now,next:Math.max(previous?.next??now,now),distance:moved,mark:mark.startedAt});
  }for(const id of history.keys())if(!marked.has(id))history.delete(id);
  for(let i=trails.length-1;i>=0;i--)if(now-trails[i].at>=URCHIN_TIDE.bubbleLife)trails.splice(i,1);if(trails.length>URCHIN_TIDE.maxBubbles)trails.splice(0,trails.length-URCHIN_TIDE.maxBubbles);
  let count=0;for(const p of trails){if(p.team!==viewer?.team)continue;const age=now-p.at;for(let i=0;i<3;i++){const q={x:p.x+Math.cos(i*2.1)*.065,y:p.y+age*.35+i*.025,z:p.z+Math.sin(i*2.1)*.065};if(!visible(q))continue;pose.position.set(q.x,q.y,q.z);pose.quaternion.identity();pose.scale.setScalar((.024+i*.006)*(1-age/URCHIN_TIDE.bubbleLife));pose.updateMatrix();bubbles.setMatrixAt(count++,pose.matrix);}}
  bubbles.count=count;bubbles.instanceMatrix.needsUpdate=true;splashes.count=splashCount;splashes.instanceMatrix.needsUpdate=true;
  group.userData.bubbles=count;group.userData.trails=trails.length;group.userData.waveTiles=tiles;group.userData.wallSplashes=splashCount;
 }
 function reset(){for(const i of items.values()){i.root.removeFromParent();i.wave.dispose();i.rim.dispose();}items.clear();history.clear();trails.length=0;bubbles.count=splashes.count=0;preview.visible=hand.visible=false;lastTime=-Infinity;}
 return{group,hand,update,reset,dispose(){reset();group.removeFromParent();hand.removeFromParent();bubbles.dispose();splashes.dispose();for(const r of[sphere,box,water,foam,dark,wire])r.dispose();}};
}
