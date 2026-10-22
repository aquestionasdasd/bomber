// Cinematic, non-colliding destruction. The map is never moved or modified.
// Coordinates follow the station facade in map.js: x -60.75..20.75, z -33.
export function createStationDetonation(THREE){
  const DURATION=6,FIRE_COUNT=32,SMOKE_COUNT=32,DEBRIS_COUNT=48,SPARK_COUNT=144;
  const STATION={x:-20.75,z:-32},group=new THREE.Group();group.name='HASHIMOTO / station chain detonation';group.visible=false;
  const geometries=new Set(),materials=new Set(),textures=new Set(),instanced=[];
  const keepGeometry=g=>(geometries.add(g),g),keepMaterial=m=>(materials.add(m),m),keepTexture=t=>(textures.add(t),t);
  let started=false,disposed=false,startTime=0,originX=0,originZ=0;
  const temp=new THREE.Object3D(),color=new THREE.Color();
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),finite=(v,f=0)=>Number.isFinite(v)?v:f;
  const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
  function cloudTexture(fire){
    const n=128,data=new Uint8Array(n*n*4);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const u=(x+.5)/n*2-1,v=(y+.5)/n*2-1,r=Math.hypot(u,v);
      const turbulence=Math.sin(u*12+Math.sin(v*9)*1.3)*.12+Math.sin(v*19+u*9)*.065+Math.sin(u*31-v*23)*.025;
      const edge=clamp((1-r+turbulence)*3),p=(y*n+x)*4;
      const pores=.76+.15*Math.sin(u*17+Math.cos(v*11)*2)+.09*Math.sin(v*29-u*19);
      if(fire){const hot=clamp((.8-r+turbulence)*1.55);data[p]=255;data[p+1]=Math.round(76+179*hot);data[p+2]=Math.round(13+198*hot*hot);data[p+3]=Math.round(255*edge*clamp(pores+.1));}
      else{const grain=clamp(.62+pores*.28);data[p]=Math.round(169*grain);data[p+1]=Math.round(173*grain);data[p+2]=Math.round(170*grain);data[p+3]=Math.round(255*edge*pores*.86);}
    }
    const texture=keepTexture(new THREE.DataTexture(data,n,n));texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
  }
  const fireTexture=cloudTexture(true),smokeTexture=cloudTexture(false);
  const vertexShader=`
    attribute float aOpacity;
    attribute float aAngle;
    attribute vec3 aTint;
    varying vec2 vUv;
    varying float vOpacity;
    varying float vPhase;
    varying vec3 vTint;
    void main(){
      vUv=uv;vOpacity=aOpacity;vTint=aTint;vPhase=aAngle;
      vec4 center=modelViewMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0);
      vec2 scale=vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));
      float c=cos(aAngle),s=sin(aAngle);
      vec2 p=mat2(c,-s,s,c)*position.xy;
      center.xy+=p*scale;
      gl_Position=projectionMatrix*center;
    }`;
  const fragmentShader=`
    uniform sampler2D uMap;
    uniform float uAge;
    varying vec2 vUv;
    varying float vOpacity;
    varying float vPhase;
    varying vec3 vTint;
    void main(){
      vec4 cloud=texture2D(uMap,vUv);
      #ifdef FIRE_CLOUD
        float folds=0.82+0.18*sin((vUv.x+vUv.y)*25.0+sin(vUv.y*18.0-uAge*2.0+vPhase)*2.0);
        cloud.g*=folds;cloud.b*=folds*folds;cloud.a*=0.88+0.12*folds;
      #endif
      float alpha=cloud.a*vOpacity;
      if(alpha<0.004)discard;
      gl_FragColor=vec4(cloud.rgb*vTint,alpha);
      #include <colorspace_fragment>
    }`;
  function cosmetic(object){object.castShadow=false;object.receiveShadow=false;object.frustumCulled=false;object.userData.solid=false;object.raycast=()=>{};return object;}
  function billboardBatch(count,texture,fire){
    const geometry=keepGeometry(new THREE.PlaneGeometry(1,1));
    const opacity=new THREE.InstancedBufferAttribute(new Float32Array(count),1).setUsage(THREE.DynamicDrawUsage);
    const angle=new THREE.InstancedBufferAttribute(new Float32Array(count),1).setUsage(THREE.DynamicDrawUsage);
    const tint=new THREE.InstancedBufferAttribute(new Float32Array(count*3),3).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aOpacity',opacity);geometry.setAttribute('aAngle',angle);geometry.setAttribute('aTint',tint);
    const material=keepMaterial(new THREE.ShaderMaterial({uniforms:{uMap:{value:texture},uAge:{value:0}},defines:fire?{FIRE_CLOUD:1}:{},vertexShader,fragmentShader,transparent:true,depthWrite:false,depthTest:true,toneMapped:false,blending:THREE.NormalBlending}));
    const mesh=cosmetic(new THREE.InstancedMesh(geometry,material,count));mesh.name=fire?'Thirty-two fireball and facade flame lobes':'Thirty-two rising soot clouds';mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.count=0;mesh.renderOrder=fire?11:12;group.add(mesh);instanced.push(mesh);return {mesh,opacity,angle,tint};
  }
  const fire=billboardBatch(FIRE_COUNT,fireTexture,true),smoke=billboardBatch(SMOKE_COUNT,smokeTexture,false);
  const debrisGeometry=keepGeometry(new THREE.BoxGeometry(1,1,1));
  const debrisMaterial=keepMaterial(new THREE.MeshStandardMaterial({color:'#a2aaa4',roughness:.84,metalness:.12,transparent:true,depthWrite:true}));
  const debris=cosmetic(new THREE.InstancedMesh(debrisGeometry,debrisMaterial,DEBRIS_COUNT));debris.name='Forty-eight station facade and roof fragments';debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);debris.count=0;group.add(debris);instanced.push(debris);
  const sparkGeometry=keepGeometry(new THREE.BufferGeometry()),sparkPositions=new Float32Array(SPARK_COUNT*3);
  sparkGeometry.setAttribute('position',new THREE.BufferAttribute(sparkPositions,3).setUsage(THREE.DynamicDrawUsage));sparkGeometry.setDrawRange(0,0);
  const sparkMaterial=keepMaterial(new THREE.PointsMaterial({color:'#ffbc64',size:.38,sizeAttenuation:true,transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));
  const sparks=cosmetic(new THREE.Points(sparkGeometry,sparkMaterial));sparks.name='One hundred forty-four incandescent embers';sparks.renderOrder=13;group.add(sparks);
  const waveGeometry=keepGeometry(new THREE.RingGeometry(.966,1,96));
  const waves=Array.from({length:2},(_,i)=>{const material=keepMaterial(new THREE.MeshBasicMaterial({color:i?'#efbd80':'#ffdfa2',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false}));material.forceSinglePass=true;const mesh=cosmetic(new THREE.Mesh(waveGeometry,material));mesh.rotation.x=-Math.PI/2;mesh.visible=false;mesh.name=i?'Station-wide pressure front':'Initial ground pressure front';group.add(mesh);return mesh;});
  const fireData=Array.from({length:FIRE_COUNT},()=>({})),smokeData=Array.from({length:SMOKE_COUNT},()=>({})),debrisData=Array.from({length:DEBRIS_COUNT},()=>({})),sparkData=Array.from({length:SPARK_COUNT},()=>({}));
  function start({x=0,z=0,time=0,seed=1}={}){
    if(disposed)return;originX=finite(x);originZ=finite(z);startTime=finite(time);seed=finite(seed,1)>>>0;
    let state=seed;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    for(let i=0;i<FIRE_COUNT;i++){
      const p=fireData[i],hero=i>0&&i<8,chain=i>=8&&i<24,column=i>=24;
      p.x=i===0?originX:hero?STATION.x+(random()-.5)*20:chain?-58.5+(i-8)*5:STATION.x+(random()-.5)*69;
      p.z=i===0?originZ:STATION.z+1.6+(random()-.5)*4;p.y=i===0?1.5:hero?10+random()*6:2+random()*6;
      p.birth=i===0?0:hero?.12+random()*.35:chain?.1+Math.abs(p.x-originX)*.006+random()*.12:.32+random()*.65;
      p.life=i===0?1.6:hero?2.55+random()*.3:1.9+random()*.55;p.size=i===1?56:i===0?29:hero?36+random()*15:column?18+random()*8:13+random()*10;
      p.aspect=column?1.7:hero?.9+random()*.25:1.1+random()*.5;p.rise=hero?9+random()*9:column?21+random()*13:8+random()*13;
      p.dx=(random()-.5)*5;p.dz=(random()-.5)*3;p.angle=(random()-.5)*Math.PI*2;p.spin=(random()-.5)*.25;
    }
    for(let i=0;i<SMOKE_COUNT;i++){
      const p=smokeData[i],central=i<10;p.x=central?STATION.x+(random()-.5)*27:-59+random()*79;p.z=STATION.z+2+(random()-.5)*12;
      p.y=central?15+random()*10:6+random()*14;p.birth=.45+random()*1.2;p.life=DURATION-p.birth;
      p.size=central?28+random()*16:15+random()*20;p.rise=18+random()*23;p.dx=3+random()*12;p.dz=-2+random()*9;p.angle=random()*6.28;p.spin=(random()-.5)*.2;
    }
    for(let i=0;i<DEBRIS_COUNT;i++){
      const p=debrisData[i],a=random()*Math.PI*2,speed=8+random()*22;
      p.x=-59+random()*79;p.z=STATION.z+(random()-.5)*3;p.y=3+random()*10;p.birth=.12+Math.abs(p.x-originX)*.005+random()*.35;
      p.vx=Math.sin(a)*speed;p.vz=Math.cos(a)*speed;p.vy=12+random()*20;
      p.w=i<12?1.7+random()*2.2:.3+random()*1.1;p.h=.12+random()*.28;p.d=i<12?1.5+random()*2.6:.4+random()*1.4;
      p.rx=random()*6.28;p.ry=random()*6.28;p.rz=random()*6.28;p.spin=(random()-.5)*5;
      p.impact=(p.vy+Math.sqrt(p.vy*p.vy+28*(p.y-p.h/2)))/14;
      color.set(i%5===0?'#4b686d':i%3===0?'#7e8d8e':'#c2c3b4');debris.setColorAt(i,color);
    }
    if(debris.instanceColor)debris.instanceColor.needsUpdate=true;
    for(let i=0;i<SPARK_COUNT;i++){
      const p=sparkData[i],a=random()*Math.PI*2,speed=9+random()*27,station=i%3!==0;
      p.x=station?-57+random()*75:originX;p.z=station?STATION.z+3:originZ;p.y=station?2+random()*9:1;
      p.birth=station?.18+random()*.8:random()*.1;p.life=.65+random()*1.5;p.vx=Math.sin(a)*speed;p.vz=Math.cos(a)*speed;p.vy=7+random()*27;
    }
    started=true;group.visible=false;group.userData.event={x:originX,z:originZ,time:startTime,seed,station:{...STATION}};
    group.userData.duration=DURATION;group.userData.limits={fire:FIRE_COUNT,smoke:SMOKE_COUNT,debris:DEBRIS_COUNT,sparks:SPARK_COUNT};
  }
  function hide(){group.visible=false;fire.mesh.count=0;smoke.mesh.count=0;debris.count=0;sparkGeometry.setDrawRange(0,0);for(const wave of waves)wave.visible=false;}
  function update(time,{reducedMotion=false}={}){
    const age=finite(time,startTime)-startTime;
    if(disposed||!started||age<0||age>=DURATION){hide();return {active:false,flash:0,shake:0};}
    group.visible=true;group.userData.age=age;const motion=reducedMotion?.3:1;fire.mesh.material.uniforms.uAge.value=age;smoke.mesh.material.uniforms.uAge.value=age;
    fire.mesh.count=FIRE_COUNT;smoke.mesh.count=SMOKE_COUNT;
    for(let i=0;i<FIRE_COUNT;i++){
      const p=fireData[i],t=age-p.birth,life=clamp(t/p.life),alive=t>=0&&t<p.life;
      const size=alive?p.size*smooth(0,.18,life)*(1-.12*smooth(.5,1,life)):0;
      temp.position.set(p.x+p.dx*life*motion,p.y+p.rise*life*motion,p.z+p.dz*life*motion);temp.scale.set(size,size*p.aspect,1);temp.rotation.set(0,0,0);temp.updateMatrix();fire.mesh.setMatrixAt(i,temp.matrix);
      fire.opacity.setX(i,alive?(1-smooth(.55,1,life))*(reducedMotion?.42:.85):0);fire.angle.setX(i,p.angle+p.spin*Math.max(0,t)*motion);fire.tint.setXYZ(i,1.06,.92-.33*life,.75-.4*life);
    }
    for(let i=0;i<SMOKE_COUNT;i++){
      const p=smokeData[i],t=age-p.birth,life=clamp(t/p.life),alive=t>=0&&t<p.life;
      const size=alive?p.size*(.3+.7*smooth(0,.38,life)):0;
      temp.position.set(p.x+p.dx*life*motion,p.y+p.rise*life*motion,p.z+p.dz*life*motion);temp.scale.set(size,size*(1.08+life*.26),1);temp.updateMatrix();smoke.mesh.setMatrixAt(i,temp.matrix);
      smoke.opacity.setX(i,alive?smooth(0,.12,life)*(1-smooth(.75,1,life))*(reducedMotion?.36:.77):0);smoke.angle.setX(i,p.angle+p.spin*Math.max(0,t)*motion);
      const shade=.08+life*.11;smoke.tint.setXYZ(i,shade*.95,shade,shade*.96);
    }
    for(const batch of[fire,smoke]){batch.mesh.instanceMatrix.needsUpdate=true;batch.opacity.needsUpdate=true;batch.angle.needsUpdate=true;batch.tint.needsUpdate=true;}
    debris.visible=!reducedMotion;debris.count=reducedMotion?0:DEBRIS_COUNT;debrisMaterial.opacity=1-smooth(4.7,DURATION,age);
    if(!reducedMotion)for(let i=0;i<DEBRIS_COUNT;i++){
      const p=debrisData[i],t=age-p.birth,alive=t>=0,flight=Math.min(Math.max(0,t),p.impact),settled=Math.max(0,t-p.impact);
      temp.position.set(p.x+p.vx*flight+p.vx*.12*settled,Math.max(p.h/2,p.y+p.vy*flight-7*flight*flight),p.z+p.vz*flight+p.vz*.12*settled);
      temp.rotation.set(p.rx+p.spin*flight,p.ry+p.spin*.6*flight,p.rz+p.spin*.8*flight);temp.scale.set(alive?p.w:0,alive?p.h:0,alive?p.d:0);temp.updateMatrix();debris.setMatrixAt(i,temp.matrix);
    }
    debris.instanceMatrix.needsUpdate=true;sparks.visible=!reducedMotion;sparkGeometry.setDrawRange(0,reducedMotion?0:SPARK_COUNT);
    if(!reducedMotion)for(let i=0;i<SPARK_COUNT;i++){
      const p=sparkData[i],t=age-p.birth,alive=t>=0&&t<p.life,index=i*3;
      sparkPositions[index]=alive?p.x+p.vx*t:0;sparkPositions[index+1]=alive?Math.max(.05,p.y+p.vy*t-9*t*t):-10000;sparkPositions[index+2]=alive?p.z+p.vz*t:0;
    }
    sparkGeometry.attributes.position.needsUpdate=true;sparkMaterial.opacity=(1-smooth(1.5,3,age))*.95;
    for(let i=0;i<2;i++){
      const wave=waves[i],t=age-(i?.3:0),duration=i?1.25:1.05,life=clamp(t/duration),r=2+(i?81:60)*(1-(1-life)**2);
      wave.visible=!reducedMotion&&t>=0&&t<duration;wave.position.set(i?STATION.x:originX,.055+i*.035,i?STATION.z:originZ);wave.scale.setScalar(r);wave.material.opacity=(1-life)**2*(i?.36:.58);
    }
    const flash=reducedMotion?0:age<.12?.76*(1-age/.12)**2:0;
    const shake=reducedMotion?0:Math.exp(-age*1.7)*smooth(0,.025,age)*(.7+.3*Math.sin(age*17)**2);
    return {active:true,flash,shake};
  }
  function reset(){started=false;hide();group.userData.age=0;delete group.userData.event;}
  function dispose(){if(disposed)return;reset();disposed=true;group.removeFromParent();for(const mesh of instanced)mesh.dispose();for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();for(const texture of textures)texture.dispose();geometries.clear();materials.clear();textures.clear();group.clear();}
  return {group,start,update,reset,dispose};
}
