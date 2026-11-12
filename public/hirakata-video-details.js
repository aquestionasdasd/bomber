// Owner's six walking videos, 2026-10-27. Connections and visual vocabulary
// are observed; these compressed game dimensions are not a measured survey.
export const HIRAKATA_VIDEO_ROUTE=Object.freeze([
 {id:'west-stair',x:-58,z:46,y:0},
 {id:'west-landing',x:-58,z:24,y:5.02},
 {id:'west-gallery',x:-64,z:9,y:5.02},
 {id:'central-gate',x:-25,z:9,y:5.02},
 {id:'north-entry',x:-58,z:-24,y:5.02},
 {id:'deck-step',x:-73,z:-26,y:5.02},
 {id:'north-deck',x:-73,z:-36,y:6.1},
 {id:'park-stair',x:-96,z:-36,y:6.1},
 {id:'park',x:-96,z:-59,y:0},
 {id:'park-crossing',x:-84,z:-74,y:0},
 {id:'north-plaza',x:-20,z:-24,y:0},
 {id:'central-passage',x:-23,z:12,y:0},
 {id:'south-plaza',x:-23,z:30,y:0},
].map(p=>Object.freeze(p)));

export function addHirakataVideoDetails({T,M,part,solid,plane,sign,texture,breakable,colliders,ramps,cyl,crown}){
 // A continuous 1F floor inlay, painted in original vector strokes. Neither
 // people nor advertising frames from the private videos are redistributed.
 const floor=texture((c,w,h)=>{
  c.fillStyle='#b4b1a8';c.fillRect(0,0,w,h);
  for(let y=0;y<h;y+=64)for(let x=0;x<w;x+=64){c.strokeStyle='#96958e';c.lineWidth=1;c.strokeRect(x,y,64,64);}
  for(const [x,y,rx,ry,col]of[[60,280,410,190,'#796560'],[620,690,440,215,'#777e7b'],[120,1020,460,230,'#8a7069']]){
   c.beginPath();c.ellipse(x,y,rx,ry,-.2,0,Math.PI*2);c.strokeStyle=col;c.lineWidth=13;c.stroke();
  }
 },512,1280);
 plane(-20,.043,0,13.7,37.8,new T.MeshStandardMaterial({map:floor,roughness:.48}),-Math.PI/2);
 // The videos show a low, pale service ceiling rather than the former tall
 // dark void. The outer station roof stays above this collision-aligned soffit.
 solid(0,9.2,0,133.5,.2,37.5,'ivory','surface','video-concourse-ceiling');
 for(const x of[-54,-32,-10,12,34,56]){
  part(x,9.02,0,.23,.12,37.4,'ivory');
  for(const z of[-15,-5,5,15]){part(x,8.8,z,1.2,.2,.32,'metal');part(x,8.65,z,.35,.14,.35,'light');}
 }
 for(const z of[-16,-7,7,16]){part(0,8.82,z,133,.18,.18,'ivory');part(0,8.47,z,133,.09,.09,'metal');}
 for(const x of[-45,-5,26,50])for(const z of[-11,11]){
  // Wood sleeves have actual collision and a narrow dark display recess.
  solid(x,8.95,z,1.45,7.86,1.45,'wood','column','video-wood-column');
  part(x,6.75,z+.75,.62,2.7,.08,'dark');part(x,6.85,z+.8,.5,2.1,.035,'blue');
  for(let i=0;i<5;i++)part(x,6.1+i*.33,z+.83,.36,.065,.025,'light');
 }
 // Two freestanding low shop islands leave the gate approach and long west
 // gallery clear. Their height/footprint agree with collision and radar.
 for(const x of[3,38]){
  solid(x,5.62,8,4,1.2,2.6,'wood','cover','video-retail-island');
  part(x,6.25,8,4.15,.12,2.75,'white');
  for(let i=0;i<6;i++)part(x-1.5+i*.6,6.48,8,.38,.35,1.6,i%2?'cream':'red');
 }
 // Older western corridor: a narrower tiled strip, lower service canopy,
 // dark wall plinth and linear lights before entering the timber concourse.
 const tile=texture((c,w,h)=>{c.fillStyle='#b9b9af';c.fillRect(0,0,w,h);for(let i=0;i<16;i++){c.strokeStyle='#8f938d';c.strokeRect((i%4)*64,Math.floor(i/4)*64,64,64);}},256,256);
 M.videoTile=new T.MeshStandardMaterial({map:tile,roughness:.75});
 part(-63,5.035,0,7,.025,37.5,'videoTile');
 part(-64,8.65,0,5.5,.16,37.4,'ivory');
 for(const z of[-14,-7,0,7,14])part(-64,8.54,z,3.8,.07,.22,'light');
 part(-66.7,5.5,0,.15,.9,37.4,'dark');

 // New public loop: the original long stair joins the 5.02m concourse;
 // a separate short flight rises to a 6.10m deck, then descends to the park.
 // Rail gaps are deliberate joins, never invisible doorway collisions.
 function rail(x,z,w,d,y){
  part(x,y+1.08,z,w,.09,d,'white');part(x,y+.12,z,w,.09,d,'white');
  colliders.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,base:y,height:y+1.13,kind:'railing'});
  const along=w>d,len=along?w:d;
  for(let t=-len/2+.25;t<len/2;t+=.36)part(x+(along?t:0),y+.6,z+(along?0:t),.035,1.02,.035,'white');
 }
 function slab(x,z,w,d,y,id){solid(x,y-.13,z,w,.26,d,'ivory','surface',id);part(x,y+.014,z,w-.04,.025,d-.04,'videoTile');}
 slab(-68,-24,14,4,5.02,'video-west-balcony');
 rail(-68,-22,14,.09,5.02);rail(-66,-26,10,.09,5.02);rail(-75,-24,.09,4,5.02);
 slab(-73,-33,4,2,6.1,'video-north-landing');
 rail(-71,-33,.09,2,6.1);rail(-75,-33,.09,2,6.1);
 slab(-84.5,-36,27,4,6.1,'video-park-bridge');
 rail(-86.5,-34,23,.09,6.1);rail(-82.5,-38,23,.09,6.1);rail(-98,-36,.09,4,6.1);
 function stair(x,minZ,maxZ,base,height,direction,id,n){
  const r={minX:x-1.9,maxX:x+1.9,minZ,maxZ,base,height,direction,axis:'z'};ramps.push(r);
  for(let i=0;i<n;i++){
   const f=(i+.5)/n,z=minZ+(maxZ-minZ)*f,top=base+height*(direction<0?1-i/n:(i+1)/n);
   const c=solid(x,(base+top)/2,z,3.8,top-base,(maxZ-minZ)/n,'concrete','stairs',id);c.movementRamp=r;
   const y=base+height*(direction<0?1-f:f);
   for(const dx of[-2,2]){part(x+dx,y+1.08,z,.08,.09,(maxZ-minZ)/n,'white');part(x+dx,y+.57,z,.035,1.05,.035,'white');colliders.push({minX:x+dx-.04,maxX:x+dx+.04,minZ:z-(maxZ-minZ)/n/2,maxZ:z+(maxZ-minZ)/n/2,base:y,height:y+1.13,kind:'railing'});}
  }
 }
 stair(-73,-32,-26,5.02,1.08,-1,'video-deck-steps',6);
 stair(-96,-56,-38,0,6.1,1,'video-park-stairs',34);
 // Bridge supports avoid the ground west-main line x=-69 and street x=-84.
 for(const [x,z,top]of[[-73,-24,4.76],[-73,-35,5.84],[-90,-36,5.84],[-96,-36,5.84]])solid(x,top/2,z,.4,top,.4,'white','column');
 sign('公園 ← 北側デッキ','PARK / NORTH DECK',-80,7.8,-34.05,7,.75,{bg:'#e2e0d5',fg:'#36514e'});
 sign('中央改札 →','CENTRAL GATE',-64,6.8,-22.05,5,.7,{bg:'#345a65',fg:'#fff6de'});

 // Ground park replaces an unverified generic office plot. Paths remain
 // flush with terrain; the low hut stays a separate district building.
 const park=texture((c,w,h)=>{
  c.fillStyle='#a98273';c.fillRect(0,0,w,h);
  for(let y=0;y<h;y+=32)for(let x=0;x<w;x+=64){c.strokeStyle='#806a60';c.lineWidth=2;c.strokeRect(x+(y%64?32:0),y,64,32);}
  c.strokeStyle='#617e91';c.lineWidth=16;for(const y of[150,380]){c.beginPath();c.arc(260,y,175,0,Math.PI*2);c.stroke();}
 },512,512);
 plane(-100,.045,-57,22,28,new T.MeshStandardMaterial({map:park,roughness:.9}),-Math.PI/2);
 breakable('video-park-landscape',()=>{
  part(-104,.06,-51,9,.04,9,'leaf');
  for(const [x,z]of[[-108,-45],[-108,-58],[-90,-64],[-91,-47]]){
   solid(x,1.5,z,.32,3,.32,'wood','column');part(x,3.5,z,2.1,2.6,2.1,'leaf',0,crown);
  }
  for(const [x,z,w,d]of[[-110,-54,1,10],[-100,-70,19,1],[-89,-59,1,6]]){solid(x,.4,z,w,.8,d,'concrete','cover');part(x,.95,z,w,.4,d,'leaf');}
  for(const z of[-61,-46]){solid(-102,.42,z,4,.84,.65,'wood','cover');part(-102,.95,z+.3,4,.6,.12,'wood');}
  // Simple recognizable slide, swings and fabric shade, using shared geometry.
  solid(-106,1.8,-51,2,.15,2,'flower','cover');
  for(const x of[-106.8,-105.2])for(const z of[-51.8,-50.2])solid(x,.85,z,.1,1.7,.1,'white','column');
  for(const x of[-106.75,-105.25])part(x,2.2,-51,.08,.85,2,'flower');
  for(let i=0;i<8;i++){solid(-106,1.8-i*.19,-50+i*.38,1.2,.12,.5,'flower','cover');part(-106, i*.22,-52,.9,.05,.08,'white');}
  for(const x of[-102,-98]){solid(x,1.65,-47,.1,3.3,.1,'white','column');part(x,3.3,-47,.3,.15,3,'white');}
  part(-100,3.3,-47,4,.13,.13,'white');
  for(const x of[-101,-99]){part(x,2,-47,.03,2.3,.03,'metal');part(x,.8,-47,.8,.1,.55,'wood');}
  for(const x of[-109,-101])for(const z of[-55,-48])part(x,1.9,z,.09,3.8,.09,'white');
  const shade=new T.BufferGeometry();shade.setAttribute('position',new T.Float32BufferAttribute([-.5,0,-.5,0,.5,0,.5,0,-.5,.5,0,-.5,0,.5,0,.5,0,.5,.5,0,.5,0,.5,0,-.5,0,.5,-.5,0,.5,0,.5,0,-.5,0,-.5],3));shade.computeVertexNormals();
  M.videoFabric=M.cream.clone();M.videoFabric.side=T.DoubleSide;
  part(-105,3.8,-51.5,8,.7,7,'videoFabric',0,shade);
  solid(-91,2.7,-68,.22,5.4,.22,'metal','column');part(-91,4,-68,1.6,.2,1.6,'metal',0,crown);
 });
 return {source:'owner-walking-videos-20261027',route:HIRAKATA_VIDEO_ROUTE,levels:[0,5.02,6.1],park:{minX:-111,maxX:-89,minZ:-71,maxZ:-43},measured:false};
}

export function addHirakataGlassLandmark({part,solid,sign}){
 // Projecting, offset glass boxes and deep white reveals observed opposite
 // the south rotary. The physical stepped silhouette matches the rendering.
 for(const [i,w,d,dx]of[[0,32,10,0],[1,36,13,1],[2,31,11,-1],[3,36,14,1]]){
  const x=52+dx,y=i*5.8,z=76;
  solid(x,y+2.8,z,w,5.6,d,'glass2','building','video-tsite-'+i);
  part(x,y+.15,z,w+.4,.3,d+.4,'ivory');part(x,y+5.65,z,w+.4,.3,d+.4,'ivory');
  for(let xx=x-w/2;xx<=x+w/2;xx+=2.1)for(const s of[-1,1])part(xx,y+2.9,z+s*(d/2+.04),.09,5.5,.12,'white');
  for(const s of[-1,1])for(let zz=z-d/2;zz<z+d/2;zz+=2.1)part(x+s*(w/2+.04),y+2.9,zz,.12,5.5,.09,'white');
 }
 sign('枚方 T-SITE','HIRAKATA',52,3.5,70.85,20,1.4,{bg:'#233b3e',fg:'#f4f1dc',ry:Math.PI});
}
