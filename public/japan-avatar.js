// Original polygon map sculpture, built from the supplied cork-board reference.
export function createJapanAvatar(THREE,{rig,upper,head,rightArm,leftArm,leftLeg,rightLeg,team='red'}){
 const group=new THREE.Group();group.name='しばくでジャパン / cork archipelago';rig.add(group);const gs=new Set(),ms=new Map(),frames=[];
 for(const[n,c,r]of[['cork','#b79970',.98],['edge','#72513a',.95],['white','#f8f3df',.8],['red','#c33327',.5],['hokkaido','#2489c1',.65],['tohoku','#1d9fca',.65],['kanto','#76bb64',.65],['chubu','#f0c335',.65],['kinki','#a6399b',.65],['chugoku','#dc4782',.65],['shikoku','#d86348',.65],['kyushu','#e77e35',.65],['dark','#203a45',.8],['team',team==='blue'?'#37bbc0':'#ed6b66',.6]])ms.set(n,new THREE.MeshStandardMaterial({color:c,roughness:r}));
 const grain=new Uint8Array(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4,v=205+((x*71+y*37+x*y*13)%49);grain[i]=v;grain[i+1]=v-8;grain[i+2]=v-16;grain[i+3]=255;}
 const corkTexture=new THREE.DataTexture(grain,64,64);corkTexture.wrapS=corkTexture.wrapT=THREE.RepeatWrapping;corkTexture.repeat.set(5,5);corkTexture.needsUpdate=true;ms.get('cork').map=corkTexture;
 function frame(s){const f=new THREE.Group();f.matrixAutoUpdate=false;group.add(f);frames.push([f,s]);return f;}
 function part(parent,n,g,pos,scale,material){gs.add(g);const o=new THREE.Mesh(g,ms.get(material));o.name='Japan / '+n;o.position.set(...pos);o.scale.set(...scale);o.castShadow=true;o.receiveShadow=true;o.raycast=()=>{};parent.add(o);return o;}
 const box=(p,n,v,s,m)=>part(p,n,new THREE.BoxGeometry(1,1,1),v,s,m),ball=(p,n,v,s,m)=>part(p,n,new THREE.SphereGeometry(1,16,10),v,s,m);
 function island(parent,name,points,offset,mat,depth=.026){const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();return part(parent,name,new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.006,bevelThickness:.004,bevelSegments:1,steps:1}),offset,[1,1,1],mat);}
 const body=frame(upper),crest=frame(head);
 island(body,'folded cork backing',[[-.43,.73],[-.45,1.31],[-.38,1.49],[-.13,1.43],[.22,1.55],[.43,1.34],[.40,.80],[.12,.69],[-.10,.76]],[0,0,-.09],'cork',.12);
 // Three narrow facets and a stitched border give the board a folded-map edge.
 const fold=box(body,'raised fold seam',[-.12,1.15,.038],[.012,.70,.018],'edge');fold.rotation.z=-.04;
 for(const side of[-1,1])for(let i=0;i<14;i++)ball(body,'cork edge pin',[side*.405,.81+i*.043,.041],[.004,.004,.003],'white');
 const off=[0,0,.047];
 island(body,'Tohoku blue coast',[[.24,1.48],[.30,1.43],[.28,1.35],[.22,1.28],[.19,1.20],[.12,1.18],[.09,1.24],[.16,1.31],[.18,1.40]],off,'tohoku');
 island(body,'Kanto green plain',[[.19,1.23],[.26,1.18],[.22,1.12],[.15,1.10],[.12,1.15],[.07,1.12],[.05,1.19]],off,'kanto');
 island(body,'Chubu golden mountains',[[.12,1.22],[.09,1.14],[.13,1.10],[.06,1.04],[-.05,1.04],[-.12,1.10],[-.06,1.18],[.02,1.17],[.06,1.24]],off,'chubu');
 island(body,'Kinki purple peninsula',[[-.07,1.10],[-.03,1.04],[-.09,1.00],[-.08,.94],[-.15,.97],[-.17,1.05],[-.21,1.06],[-.18,1.12]],off,'kinki');
 island(body,'Chugoku pink coast',[[-.18,1.11],[-.20,1.04],[-.28,1.01],[-.35,1.03],[-.37,1.09],[-.28,1.13]],off,'chugoku');
 island(body,'Shikoku coral island',[[-.20,1.00],[-.21,.94],[-.29,.93],[-.32,.96],[-.29,1.00]],off,'shikoku');
 island(body,'Kyushu orange island',[[-.36,1.04],[-.38,.98],[-.35,.94],[-.37,.88],[-.42,.90],[-.45,.98],[-.43,1.04]],off,'kyushu');
 ball(body,'Okinawa island',[-.43,.81,.075],[.014,.008,.01],'kyushu');
 // Raised white 日本 strokes are actual meshes, readable without canvas/fonts.
 for(const x of[-.14,-.04])box(body,'日本 日 vertical',[x,1.35,.10],[.015,.105,.018],'white');
 for(const y of[1.30,1.35,1.40])box(body,'日本 日 horizontal',[-.09,y,.10],[.115,.015,.018],'white');
 box(body,'日本 本 vertical',[.07,1.35,.10],[.015,.14,.018],'white');
 for(const[y,w]of[[1.38,.13],[1.31,.08]])box(body,'日本 本 cross',[.07,y,.10],[w,.015,.018],'white');
 for(const side of[-1,1]){const stroke=box(body,'日本 本 branch',[.07+side*.034,1.343,.10],[.014,.08,.018],'white');stroke.rotation.z=side*-.65;}
 // Hokkaido occupies the head volume, with a warm cork sun behind the island.
 ball(crest,'cork northern crest',[0,.0,-.01],[.245,.265,.13],'cork');
 island(crest,'Hokkaido blue silhouette',[[.04,.21],[-.01,.16],[-.005,.08],[-.04,.05],[-.07,.08],[-.12,.06],[-.15,.015],[-.16,-.015],[-.10,-.05],[-.14,-.105],[-.19,-.11],[-.19,-.16],[-.14,-.145],[-.10,-.16],[-.06,-.09],[.02,-.12],[.07,-.055],[.14,-.055],[.20,-.015],[.16,.01],[.11,.005],[.06,.065],[.06,.11]],[0,0,.12],'hokkaido');
 ball(body,'red sun insignia',[.33,1.04,.072],[.045,.045,.018],'red');
 box(body,'team rail',[0,.78,.07],[.26,.025,.025],'team');
 for(const[arm,leg]of[[rightArm,rightLeg],[leftArm,leftLeg]]){
  ball(frame(arm.upperArm),'cork arm',[0,0,0],[1,3,1],'edge');ball(frame(arm.forearm),'white map sleeve',[0,0,0],[1.08,3,1.08],'white');ball(frame(arm.palm),'map glove',[0,0,0],[.067,.045,.08],'cork');
  ball(frame(leg.thigh),'cork leg',[0,0,0],[1,3,1],'edge');ball(frame(leg.shin),'regional greave',[0,0,0],[1.12,3,1.12],'tohoku');ball(frame(leg.boot),'white boot',[0,-.05,.045],[.105,.065,.17],'white');
 }
 let disposed=false;function update(){if(disposed)return;for(const[f,s]of frames){s.updateMatrix();f.matrix.copy(s.matrix);f.matrixWorldNeedsUpdate=true;}}update();return{group,update,setVisible(v){group.visible=!!v;},dispose(){if(disposed)return;disposed=true;group.removeFromParent();gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());corkTexture.dispose();}};
}
