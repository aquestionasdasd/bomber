import {createCollisionIndex} from './collision.js';
import {createTrafficClock,createBusModels} from './bus-traffic.js';
import {addHirakataDistrict} from './hirakata-district.js';
import {addHirakataTactical,HIRAKATA_INDOOR_SITES} from './hirakata-tactical.js';
import {addHirakataSurvey} from './station-survey-details.js';

// Reconstructed from the city plaza plans and Keihan's 2026 station plan.
// The real NE–SW station is rotated into the game's east–west coordinates.
export function createHirakataMap(T,scene){
 const world=new T.Group();world.name='HIRAKATASHI / 南北駅前広場';scene.add(world);
 const bounds={minX:-112,maxX:112,minZ:-112,maxZ:112},colliders=[],mapShapes=[],ramps=[],batches=new Map();
 const geo=new T.BoxGeometry(1,1,1),cyl=new T.CylinderGeometry(1,1,1,12),crown=new T.IcosahedronGeometry(1,1);
 const M={},colors={silver:'#bac2c5',ivory:'#e3e0d4',white:'#eeeae2',concrete:'#a6a9a5',stone:'#aaa99f',dark:'#283036',glass:'#274453',glass2:'#476575',black:'#18232b',metal:'#69777b',road:'#4d5355',yellow:'#e6c350',red:'#ba2441',blue:'#3276a8',wood:'#a18a64',soil:'#655e48',leaf:'#4c7650',flower:'#df6170',cream:'#d4c6a5',warm:'#f4dfad'};
 for(const[k,color]of Object.entries(colors))M[k]=new T.MeshStandardMaterial({color,roughness:k==='glass'?.24:.8,metalness:k==='silver'?.42:.05});
 M.light=new T.MeshStandardMaterial({color:'#fff5df',emissive:'#fff1c7',emissiveIntensity:.8});
 const pos=new T.Vector3(),scale=new T.Vector3(),q=new T.Quaternion(),matrix=new T.Matrix4();
 function part(x,y,z,w,h,d,m='silver',ry=0,g=geo){const key=m+g.uuid;if(!batches.has(key))batches.set(key,{m:M[m],g,entries:[]});pos.set(x,y,z);scale.set(w,h,d);q.setFromEuler(new T.Euler(0,ry,0));batches.get(key).entries.push(matrix.compose(pos,q,scale).clone());}
 const rect=(x,z,w,d)=>[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]];
 function solid(x,y,z,w,h,d,m='silver',kind='building',id){part(x,y,z,w,h,d,m);const c={minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,base:Math.max(0,y-h/2),height:y+h/2,kind};if(id)c.surfaceId=id;colliders.push(c);mapShapes.push({polygon:rect(x,z,w,d),color:kind==='surface'?'#84999e':'#586c77',kind:kind==='surface'?'overhead':kind,base:c.base,height:c.height});return c;}
 function plane(x,y,z,w,h,mat,rx=0,ry=0){const o=new T.Mesh(new T.PlaneGeometry(w,h),mat);o.position.set(x,y,z);o.rotation.set(rx,ry,0);o.receiveShadow=true;world.add(o);return o;}
 function texture(draw,w=1024,h=256){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}
 function sign(text,sub,x,y,z,w,h,{bg='#eeeae2',fg='#253b47',ry=0}={}){const map=texture((c,cw,ch)=>{c.fillStyle=bg;c.fillRect(0,0,cw,ch);c.fillStyle=fg;c.textAlign='center';c.textBaseline='middle';c.font='bold 78px "Meiryo",sans-serif';c.fillText(text,cw/2,sub?ch*.39:ch*.52,cw*.95);if(sub){c.font='34px "Segoe UI",sans-serif';c.fillText(sub,cw/2,ch*.79,cw*.94);}});return plane(x,y,z,w,h,new T.MeshBasicMaterial({map,side:T.FrontSide}),0,ry);}
 const paving=texture((c,w,h)=>{c.fillStyle='#a2a6a2';c.fillRect(0,0,w,h);for(let r=0;r<8;r++)for(let s=0;s<8;s++){const v=166+(r*19+s*31)%18;c.fillStyle=`rgb(${v},${v+1},${v-4})`;c.fillRect(s*64+1,r*64+1,62,62);}},512,512);paving.wrapS=paving.wrapT=T.RepeatWrapping;paving.repeat.set(40,40);
 plane(0,-.015,0,224,224,new T.MeshStandardMaterial({map:paving,roughness:.95}),-Math.PI/2);
 // Road surfaces are flat and traversable; only the actual islands are solid.
 function ellipse(cx,cz,rx,rz,m,y=.015){const o=new T.Mesh(new T.CircleGeometry(1,96),M[m]);o.rotation.x=-Math.PI/2;o.scale.set(rx,rz,1);o.position.set(cx,y,cz);o.receiveShadow=true;world.add(o);mapShapes.push({polygon:Array.from({length:72},(_,i)=>{const a=i*Math.PI*2/72;return[cx+rx*Math.cos(a),cz+rz*Math.sin(a)];}),kind:'road',color:m==='road'?'#3c505c':m==='leaf'?'#4e715b':'#7a8782'});return o;}
 function curb(cx,cz,rx,rz,green=false){ellipse(cx,cz,rx,rz,'ivory',.035);ellipse(cx,cz,rx-.4,rz-.4,green?'leaf':'stone',.05);for(let i=0;i<72;i++){const a=i*Math.PI*2/72,x=cx+rx*Math.cos(a),z=cz+rz*Math.sin(a);part(x,.12,z,.7,.22,.26,'concrete',-a);}}
 ellipse(0,49,56,24,'road');curb(0,49,40,8,true);
 ellipse(29,-49,36.5,21,'road');curb(29,-49,23.5,7.5,false);
 ellipse(-43,-49,23,19,'road');curb(-43,-49,10,6,true);
 // Loop lanes, parking bays and a tactile pedestrian network.
 for(const[cx,cz,rx,rz]of[[0,49,49,17],[29,-49,30,14],[-43,-49,17,12]])for(let i=0;i<52;i++){const a=i*Math.PI*2/52,dx=-rx*Math.sin(a),dz=rz*Math.cos(a);part(cx+rx*Math.cos(a),.027,cz+rz*Math.sin(a),.14,.016,1.15,'white',Math.atan2(dx,dz));}
 for(let x=-23;x<25;x+=4.6){part(x,.064,49,2.2,.018,.12,'white');part(x,.064,55,2.2,.018,.12,'white');}
 for(let x=13;x<48;x+=5.1){part(x,.065,-49,.13,.018,9,'white');part(x+2.4,.065,-44.5,4.8,.018,.13,'white');}
 for(const z of[-27,27]){part(0,.035,z,132,.025,.42,'yellow');for(let x=-28;x<-12;x+=.8)part(x,.038,z, .5,.03,1.1,'yellow');}
 part(-20,.035,0,.45,.025,54,'yellow');part(-24,.036,0,.45,.025,38,'yellow');
 for(const z of[-31,31])for(let x=-28;x<-12;x+=1)part(x,.031,z,.6,.02,3,'white');

 // Ground floor shops leave a broad WEST free passage and a separate EAST road.
 const shops=[[-66,-27,'京阪百貨店'],[-13,33,'駅ナカ'],[47,66,'京阪電車']];
 for(const[a,b,name]of shops)for(const s of[-1,1]){if(s<0&&b<=33)continue;const x=(a+b)/2,z=s*11,w=b-a;solid(x,2.35,z,w,4.7,14,'cream');
  const face=s*18.04;part(x,2,face,w-.6,2.5,.08,'glass');part(x,3.65,face,w,.6,.2,name==='京阪百貨店'?'red':'dark');for(let xx=a+.8;xx<b;xx+=3.1){part(xx,1.9,face+s*.06,.12,2.7,.14,'metal');part(xx,.55,face+s*.1,2.5,.12,.5,'concrete');}sign(name,name==='京阪百貨店'?'KEIHAN DEPARTMENT STORE':'HIRAKATASHI STATION',x,3.65,face+s*.13,Math.min(w-1,12),.7,{bg:name==='京阪百貨店'?'#8e263c':'#283036',fg:'#f7eee1',ry:s<0?Math.PI:0});
 }
 // Shopfronts facing inside the through passage. Doors are visibly closed.
 // The cross-gallery and MID side doors are physically and visibly open.
 // Shop windows and lit fascias line the indoor passage rather than blank walls.
 for(const side of[-1,1])for(const z of[7,13]){
  const x=side<0?-26.94:-13.06,ry=side<0?Math.PI/2:-Math.PI/2;
  part(x,1.75,z,.08,2.65,5.1,'glass2');for(const dz of[-2.5,0,2.5])part(x-side*.03,1.75,z+dz,.1,2.8,.09,'silver');
  part(x-side*.06,3.32,z,.16,.65,5.7,side<0?'wood':'dark');
  sign(side<0?'京阪百貨店':z<0?'駅の案内所':'ひらかた  駅ナカ',side<0?'FOOD & DAILY':'HIRAKATA STATION',x-side*.16,3.32,z,5.4,.58,{bg:side<0?'#9b805c':'#293d44',fg:'#fff0d2',ry});
  for(let i=0;i<5;i++)part(x-side*.1,.9,z-1.9+i*.92,.16,.65,.56,['cream','warm','red','white','wood'][i]);
 }
 for(const z of[-13,-5,5,13]){part(-20,2.35,z,.6,4.7,.6,'concrete',0,cyl);colliders.push({minX:-20.6,maxX:-19.4,minZ:z-.6,maxZ:z+.6,base:0,height:4.7,kind:'column'});for(const x of[-20.32,-19.68])sign('枚方市駅','NORTH ↑  SOUTH ↓',x,1.9,z,1.1,1.5,{bg:'#537b88',fg:'#fff5db',ry:x<-20? -Math.PI/2:Math.PI/2});}
 for(const z of[-13,-5,5,13])for(const s of[-1,1])sign('ひらかた','STATION MAP',-20,1.9,z+s*.61,1.05,1.5,{bg:'#719596',fg:'#fff7cb',ry:s<0?Math.PI:0});
 // Tiled passage ceiling, recessed lighting, ducts and hanging wayfinding.
 solid(0,4.9,0,134,.24,38,'concrete','surface','hirakata-concourse');
 for(let x=-25.5;x<-13;x+=2.5)for(let z=-17;z<=17;z+=2.5){part(x,4.75,z,2.44,.035,2.44,'ivory');if((Math.round(z*2)%5)===1)part(x,4.71,z,1.6,.045,.75,'light');}
 for(const z of[-16,0,16]){part(-20,4.2,z,11,.09,.1,'metal');sign(z===0?'南口 ← 自由通路 → 北口':z<0?'北口 バスのりば →':'← 南口 バス・タクシー','Central passage · 1F',-20,3.95,z,8,.9,{bg:'#354a50',fg:'#fff4d8',ry:z<0?Math.PI:0});}
 // North vending machines sit beyond the new A/B side doors, preserving their clear approach.
 for(const[x,z]of[[-25.8,-16.5],[-25.8,9],[-14.2,-16.5],[-14.2,10]]){solid(x,.9,z,.65,1.8,1.1,'white','cover');part(x,.95,z+.57,.5,1.25,.025,'blue');for(let r=0;r<4;r++)for(let c=0;c<3;c++)part(x-.16+c*.16,.55+r*.27,z+.6,.1,.18,.03,r%2?'red':'warm');}
 // 2F central/east concourses: wood flooring, dark ceiling and ticket gates.
 const woodTex=texture((c,w,h)=>{c.fillStyle='#a18b69';c.fillRect(0,0,w,h);for(let r=0;r<16;r++){c.fillStyle=r%3?'#ad9876':'#947c59';c.fillRect(1,r*16+1,w-2,14);}},512,256);woodTex.wrapS=woodTex.wrapT=T.RepeatWrapping;woodTex.repeat.set(15,4);
 plane(0,5.025,0,133.8,37.8,new T.MeshStandardMaterial({map:woodTex,roughness:.86}),-Math.PI/2);
 solid(0,13.15,0,135,.3,39,'silver','surface','hirakata-roof');
 // Front glazed grid above the real ground openings; both faces have depth.
 for(const s of[-1,1]){const z=s*19.05;solid(0,8.8,z,134,7.1,.3,'glass','building');
  // Upper pedestrian entries at ±58 are cut out of a lower wall, not fake doors.
  colliders.pop();mapShapes.pop();for(const[a,b]of[[-67,-61],[-55,55],[61,67]]){const w=b-a;colliders.push({minX:a,maxX:b,minZ:z-.15,maxZ:z+.15,base:5.02,height:10.8,kind:'glazing'});}colliders.push({minX:-67,maxX:67,minZ:z-.15,maxZ:z+.15,base:10.8,height:12.35,kind:'glazing'});
  // Remove the visual lower glass in door gaps by overlaying actual separate bays.
  const last=batches.get('glass'+geo.uuid).entries;last.pop();for(const[a,b]of[[-67,-61],[-55,55],[61,67]])part((a+b)/2,7.91,z,b-a,5.78,.3,'glass');part(0,11.58,z,134,1.56,.3,'glass');
  for(let x=-66;x<=66;x+=3){if(Math.abs(Math.abs(x)-58)<3)continue;part(x,8.7,z+s*.2,.15,7.25,.24,'silver');}for(let y=5.18;y<12.5;y+=1.2)part(0,y,z+s*.21,134,.1,.28,'silver');
  part(0,12.7,z+s*.1,135,.62,.55,'silver');part(0,5.1,z+s*.3,135,.32,.8,'concrete');
  // Corrugated silver fascia and the landmark station name.
  solid(-4,15.5,z-s*.75,105,4.6,.5,'silver');for(let y=13.3;y<=17.7;y+=.12)part(-4,y,z-s*.46,104,.025,.04,'white');
  sign('KEIHAN  京阪電車 枚方市駅','Keihan Railway Hirakatashi Station',-4,15.6,z+s*.31,54,3.5,{bg:'#cbd0ce',fg:s>0?'#3b535a':'#3564a2',ry:s<0?Math.PI:0});
  for(const x of[-30,16,40]){part(x,2.3,s*20.4,.48,4.6,.48,'white');part(x,4.5,s*21.3,8,.18,3.5,'ivory');}
 }
 // Department-store banners, hand drawn typography, not redistributed photos.
 for(let i=0;i<3;i++){const x=29+i*2.3;sign(i===0?'京阪百貨店':i===1?'季節の彩り':'枚方市駅','KEIHAN · HIRAKATA',x,9,19.4,2,6.2,{bg:['#a52742','#f3e4cb','#497a68'][i],fg:'#fff2de'});}
 for(const x of[-67,67])solid(x,9,0,.35,8,38,'silver');
 for(const x of[-45,-5,26,50])for(const z of[-11,11]){part(x,9,z,.6,7.9,.6,'dark');part(x,12.9,z,22,.1,.15,'light');}
 for(let i=0;i<7;i++){const x=-31+i*1.9;solid(x,5.58,2, .65,1.1,2.8,'metal','cover');part(x,6.17,2,.68,.06,1.4,'blue');}sign('中央改札口','Central Gate · 2F',-25,8,3.5,12,1,{bg:'#202d32',fg:'#fff0da'});
 for(const[x,name]of[[-48,'無印良品'],[2,'ひらかた  駅ナカ'],[46,'東改札口 → 枚方モール']]){solid(x,7,-12,18,3.9,8,'dark');sign(name,'2F CONCOURSE',x,8,-7.9,16,1.1,{bg:'#422e29',fg:'#f1e3cc'});}
 // Decks with real slab support, two-level circulation and collision-aligned steps.
 function rail(x,z,w,d){part(x,6.13,z,w,.09,d,'white');part(x,5.2,z,w,.07,d,'white');colliders.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,base:5.02,height:6.18,kind:'railing'});}
 function deck(x,z,w,d,id,ends=true){solid(x,4.89,z,w,.26,d,'ivory','surface',id);for(let xx=x-w/2+.4;xx<x+w/2;xx+=6)part(xx,2.35,z,.42,4.7,.42,'white',0,cyl);if(ends){rail(x,z-d/2,w,.09);rail(x,z+d/2,w,.09);}for(let xx=x-w/2+.2;xx<x+w/2;xx+=.38){part(xx,5.61,z-d/2,.035,1.1,.04,'metal');part(xx,5.61,z+d/2,.035,1.1,.04,'metal');}}
 for(const s of[-1,1])for(const x of[-58,58]){
  deck(x,s*24,6,10,`deck-${s}-${x}`,false);
  // Rail openings at station and stair ends; long side rails leave the route open.
  // Ends remain physically and visually open.
  rail(x-3,s*24,.09,10);rail(x+3,s*24,.09,10);
  const minZ=s>0?29:-45,maxZ=s>0?45:-29,n=28;
  for(let i=0;i<n;i++){const f=(i+.5)/n,z=minZ+(maxZ-minZ)*f,h=s>0?5.02*(1-i/n):5.02*((i+1)/n);solid(x,h/2,z,5.8,h,(maxZ-minZ)/n,'concrete','stairs');}
  ramps.push({minX:x-2.9,maxX:x+2.9,minZ,maxZ,axis:'z',direction:s>0?-1:1,base:0,height:5.02});
  // Visible rail height follows the stair slope; per-step colliders share it.
  for(let i=0;i<28;i++){const f=(i+.5)/28,z=minZ+16*f,y=5.02*(s>0?1-f:f);for(const dx of[-3,3]){part(x+dx,y+1.1,z,.08,.08,16/28,'white');part(x+dx,y+.55,z,.045,1.1,.045,'white');colliders.push({minX:x+dx-.04,maxX:x+dx+.04,minZ:z-8/28,maxZ:z+8/28,base:y,height:y+1.14,kind:'railing'});}}
 }
 // South deck extends toward the shopping blocks, with openings to both stairs.
 deck(-38,29,34,4,'south-west-pedestrian');deck(39,29,32,4,'south-east-pedestrian');
 // Bus stop roofs, curbside furniture, timetable poles and safety rail breaks.
 function stop(x,z,number,north=false){solid(x,3.25,z,9,.2,3.4,'white','surface',`stop-${north?'N':'S'}-${number}`);for(const dx of[-3.6,3.6])solid(x+dx,1.6,z,.14,3.2,.14,'dark','cover');solid(x, .5,z,4,.7,.55,'wood','cover');part(x,1.4,z+.1,4,.65,.14,'metal');part(x-3,1.45,z+1.3,.12,2.9,.12,'dark');sign(number+'  京阪バス',north?'北口 NORTH':'南口 SOUTH',x-3,2.3,z+1.39,1.5,.85,{bg:'#ede8da',fg:'#28434c',ry:north?Math.PI:0});sign('時刻表','KEIHAN BUS',x-3,1.45,z+1.4,.65,.8,{bg:'#eee8d5',fg:'#31434a'});}
 for(const[x,num]of[[-39,'1'],[-7,'2'],[18,'3'],[44,'4']])stop(x,23,num);
 for(const[x,num]of[[3,'1'],[20,'2'],[40,'3'],[64,'4']])stop(x,-27,num,true);
 for(const z of[-39,-58])stop(67,z,z===-39?'5':'6',true);
 function planter(x,z,w=4,d=1.6){solid(x,.42,z,w,.84,d,'concrete','cover');part(x,.86,z,w-.3,.15,d-.3,'soil');for(let i=0;i<Math.ceil(w*2);i++){part(x-w*.42+i*.45,1.04,z,.35,.38,.5,i%3?'leaf':'flower',0,crown);}}
 for(const[x,z,w,d]of[[-33,49,8,3],[0,49,12,3],[30,49,8,3],[-42,-49,10,4],[-8,-30,5,1.5],[-43,-28,5,1.5],[-36,28,4,1.5],[9,28,4,1.5],[-73,5,3,5],[74,9,3,5]])planter(x,z,w,d);
 for(const[x,z]of[[-40,49],[35,49],[-45,-49]]){part(x,2.2,z,.32,4.4,.32,'wood',0,cyl);part(x,4.4,z,2.4,2.1,2.4,'leaf',0,crown);}
 // Parked taxis on the southern island create recognisable, low cover.
 for(let i=0;i<7;i++){const x=-19+i*6.1,z=52.6;solid(x,.68,z,2,1.25,4.2,'black','cover');part(x,1.47,z-.15,1.7,.75,2.2,'glass');part(x,1.9,z-.1,.6,.15,.3,'white');for(const dx of[-1,1])for(const dz of[-1.3,1.3])part(x+dx,.38,z+dz,.25,.65,.7,'dark');part(x,.8,z+2.13,1.6,.25,.04,'white');}
 sign('タクシーのりば','TAXI',-5,2.4,58,7,1,{bg:'#eee8d5',fg:'#344954'});
 // Perimeter context: station hill east/north, department store west, T-SITE south.
 for(const[x,z,w,d,h,name]of[[-76,-65,10,24,19,'サンプラザ'],[70,-73,21,12,43,'STATION HILL HIRAKATA'],[-66,75,23,12,18,'ひらかた サンプラザ'],[52,76,36,10,25,'枚方 T-SITE'],[-76,17,10,40,18,'京阪百貨店']]){solid(x,h/2,z,w,h,d,'ivory');for(let y=3;y<h-1;y+=3)for(let xx=x-w/2+1;xx<x+w/2-.5;xx+=2.5){part(xx,y,z-d/2-.04,1.7,1.75,.08,'glass2');part(xx,y,z+d/2+.04,1.7,1.75,.08,'glass');}sign(name,'HIRAKATASHI',x,Math.min(h-2,9),z+(z>0?-1:1)*(d/2+.1),w*.9,1.5,{ry:z>0?Math.PI:0});}
 // Street lamps, bins and road-side warning boards. No invisible perimeter walls.
 for(const[x,z]of[[-68,61],[-15,70],[28,71],[67,60],[-68,-35],[-13,-69],[18,-72],[64,-66]]){part(x,3.2,z,.11,6.4,.11,'metal');part(x+.6,6.4,z,1.3,.12,.15,'metal');part(x+1.1,6.35,z,.6,.06,.4,'light');}
 for(const[x,z,ry]of[[-18,31,0],[-18,-32,Math.PI],[42,31,0],[55,-31,Math.PI]])sign('車両に注意','BUS LANE · 横断注意',x,1.3,z,2.8,.8,{bg:'#f0ce58',fg:'#4c3030',ry});
 const tactical=addHirakataTactical({part,solid,sign});
 const surveyDetails=addHirakataSurvey({part,sign});
 // Station interiors receive local warm fill; no extra shadow maps or audio.
 for(const[x,z]of[[8,-11],[-46,-11],[-20,0]]){const light=new T.PointLight('#ffead1',16,31,1);light.position.set(x,3.9,z);light.name='Station interior / warm ceiling fill';world.add(light);}
 const districtBuildings=addHirakataDistrict({part,solid,sign,mapShapes});
 for(const b of batches.values()){const mesh=new T.InstancedMesh(b.g,b.m,b.entries.length);b.entries.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=mesh.receiveShadow=true;mesh.userData.solid=true;world.add(mesh);}
 const traffic=createTrafficClock(),busModels=createBusModels(T,world,traffic);busModels.update(0);
 const sites=HIRAKATA_INDOOR_SITES.map(({id,name,x,z,polygon,plantPositions})=>({id,name,x,z,radius:7,polygon:polygon.map(p=>[...p]),plantPositions:plantPositions.map(p=>({...p}))}));
 const teamSpawns={attack:Array.from({length:5},(_,i)=>({x:-10+i*5,z:73})),defend:Array.from({length:5},(_,i)=>({x:-12+i*6,z:-74}))};
 const points=a=>a.map(([x,z])=>({x,z}));
 const lanes=[{id:'bus',name:'Bメイン / 百貨店西',points:points([[-67,68],[-70,32],[-70,0],[-69,-11],[-61,-11],[-46,-11.5]])},{id:'mid',name:'MID / 南北自由通路',points:points([[-20,68],[-23,30],[-23,15],[-20,-10],[-10,-10],[-9,-15],[1,-15],[14,-11.5]])},{id:'mewe',name:'Aメイン / 東側高架下',points:points([[65,68],[65,30],[40,23],[40,-11],[30,-11],[14,-11.5]])}];
 const regions=[['south','南口ロータリー',-58,58,30,72],['north-bus','北口バスロータリー',-7,69,-71,-32],['north-car','北口一般車',-68,-18,-69,-33],['passage','MID / 南北自由通路',-27,-13,-20,20],['underpass','高架下車道',33,47,-20,20],['west','百貨店西連絡路',-81,-67,-30,32],['central','駅ナカ横通路',-66,66,-4,4],['a-site',sites[0].name,-12,33,-18,-4],['b-site',sites[1].name,-66,-27,-18,-4],['north-street','新町 / 医大方面',-88,86,-92,-79],['east-street','岡東 / モール東通り',78,90,-80,81],['south-street','南口 / 商業街連絡路',-85,87,79,91],['west-street','岡本町 / 西路地',-90,-78,-79,79]];
 const callouts=regions.map(([id,name,a,b,c,d])=>({id,name,polygon:rect((a+b)/2,(c+d)/2,b-a,d-c),minY:-.1,maxY:4.7,label:{x:(a+b)/2,z:(c+d)/2}}));callouts.unshift({id:'upper',name:'2F / 改札コンコース',polygon:rect(0,0,134,38),minY:4.8,maxY:13});
 for(const c of callouts){const labels={'a-site':{x:14,z:-23,text:'A 東ホール'},'b-site':{x:-46,z:-23,text:'B 西ホール'},passage:{x:-20,z:12,text:'MID'},central:{x:8,z:2,text:'横連絡'},underpass:{x:40,z:12,text:'東メイン'},west:{x:-74,z:12,text:'西メイン'}};if(labels[c.id])c.label=labels[c.id];}
 return{id:'hirakata',name:'枚方市駅',shortName:'HIRAKATASHI',world,bounds,colliders,collision:createCollisionIndex(colliders),mapShapes,ramps,sites,teamSpawns,lanes,callouts,zones:regions.map(([,name,a,b,c,d])=>({name,x:(a+b)/2,z:(c+d)/2,radius:Math.max(b-a,d-c)/2})),landmarks:[{id:'north',name:'南北自由通路',x:-23,z:12,yaw:0},{id:'south',name:'南口広場',x:-3,z:70,yaw:0},{id:'a-hall',name:'A / 駅ナカ東ホール',x:30,z:-11,yaw:Math.PI/2},{id:'b-hall',name:'B / 百貨店西ホール',x:-62,z:-11,yaw:-Math.PI/2},{id:'mid',name:'MID / 横挟み分岐',x:-20,z:-10,yaw:Math.PI/2},{id:'north-bus',name:'北口バスのりば',x:48,z:-23,yaw:0},{id:'north-car',name:'北口西広場',x:-43,z:-23,yaw:0},{id:'east',name:'東側高架下',x:40,z:0,yaw:0},{id:'upper',name:'2F 中央改札',x:-22,z:9,y:5.02,yaw:0},{id:'district-north',name:'新町・医大方面',x:-84,z:-84,yaw:-.8},{id:'district-east',name:'モール東通り',x:84,z:-53,yaw:0},{id:'district-south',name:'南口 商業街',x:27,z:84,yaw:Math.PI},{id:'district-west',name:'岡本町 西路地',x:-84,z:37,yaw:Math.PI}],spawn:{x:0,z:73,yaw:0},enemySpawns:teamSpawns.defend,spawnYaw:{attack:0,defend:Math.PI},buyAreas:{attack:{x:0,z:73,radius:12},defend:{x:0,z:-74,radius:12}},combatBounds:{minX:-82,maxX:82,minZ:-82,maxZ:82},rangeArea:{spawn:{x:-23,z:14,yaw:0},targets:[{x:-23,z:-10},{x:-23,z:-17},{x:-17,z:-12},{x:-17,z:-17}]},menuCamera:{position:[-43,15,67],target:[0,6,8]},origin:{lat:34.815,lon:135.649},districtBuildings,tactical,surveyDetails,traffic,busModels,stats:{mode:'arena',width:224,depth:224,area:50176,combatWidth:164,combatDepth:164,buildings:31,districtBuildings:districtBuildings.length,sites:2,routes:3,collisionShapes:colliders.length,renderBatches:batches.size,trafficBuses:4},layout:{version:3,entrances:Object.fromEntries(tactical.rooms.map(r=>[r.id,[{id:'main',...r.main},{id:'mid',...r.flank},{id:'defend',...r.back}]])),siteEntries:{A:{x:30,z:-11},B:{x:-62,z:-11}},connectors:tactical.flanks,protectedPockets:tactical.covers,rotationEnds:[{x:-20,z:-10},{x:40,z:-11},{x:-69,z:-11}]}};
}
