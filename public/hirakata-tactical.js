// Original arena circulation inside the researched station envelope.
// Doors, baffles and site furniture share visible and physical geometry.
export const HIRAKATA_INDOOR_SITES=Object.freeze([
 {id:'A',name:'A / 駅ナカ東ホール',x:14,z:-11.5,room:[-13,33,-18,-4],main:{x:36,z:-11},flank:{x:-10,z:-10},back:{x:24,z:-21},color:'blue',
  polygon:[[7,-16.5],[21,-16.5],[21,-6],[7,-6]],plantPositions:[{id:'A-cover',label:'展示台裏',style:'cover',x:13,z:-12.5},{id:'A-open',label:'東ホール中央',style:'open',x:18,z:-10}]},
 {id:'B',name:'B / 百貨店西ホール',x:-46,z:-11.5,room:[-66,-27,-18,-4],main:{x:-69,z:-11},flank:{x:-30,z:-10},back:{x:-56,z:-21},color:'yellow',
  polygon:[[-53,-16.5],[-39,-16.5],[-39,-6],[-53,-6]],plantPositions:[{id:'B-cover',label:'案内台裏',style:'cover',x:-47,z:-12.5},{id:'B-open',label:'西ホール中央',style:'open',x:-43,z:-10}]},
]);

export function addHirakataTactical({part,solid,sign}){
 const rooms=[],covers=[];
 function zWall(id,z,a,b){if(b-a<=0)return;solid((a+b)/2,2.35,z,b-a,4.7,.34,'cream','wall',id);part((a+b)/2,.24,z,b-a,.2,.38,'dark');}
 function xWall(id,x,a,b){if(b-a<=0)return;solid(x,2.35,(a+b)/2,.34,4.7,b-a,'cream','wall',id);part(x,.24,(a+b)/2,.38,.2,b-a,'dark');}
 function doorway(id,x,z,w,d,color){solid(x,3.95,z,w,1.5,d,'cream','surface',id+'-lintel');part(x,3.1,z,w,.16,d+.12,color);}
 function cover(id,x,z,w,d,h,m){solid(x,h/2,z,w,h,d,m,'cover',id);part(x,h+.035,z,w+.06,.07,d+.06,'silver');covers.push({id,x,z,w,d,h});}
 for(const s of HIRAKATA_INDOOR_SITES){
  const[a,b,c,d]=s.room,west=s.id==='B',backX=s.back.x;
  zWall(s.id+'-south',d,a,b);
  zWall(s.id+'-north-west',c,a,backX-3);zWall(s.id+'-north-east',c,backX+3,b);
  doorway(s.id+'-back',backX,c,6,.34,s.color);
  for(const x of[a,b]){xWall(s.id+'-side-north-'+x,x,c,-14);xWall(s.id+'-side-south-'+x,x,-7,d);doorway(s.id+'-side-'+x,x,-10.5,.34,7,s.color);}
  // Facade glazing stays on wall panels, never across an open tactical door.
  for(const[aa,bb]of[[a,backX-3],[backX+3,b]])if(bb-aa>2){for(const face of[-1,1]){part((aa+bb)/2,1.9,c+face*.19,bb-aa-.7,2.3,.06,'glass2');for(let x=aa+.8;x<bb;x+=2.8)part(x,1.9,c+face*.24,.09,2.45,.1,'metal');}}
  for(let x=a+1.6;x<b-1;x+=3.1)part(x,4.72,-11,1.3,.045,.6,'light');
  part((a+b)/2,.04,-4.3,b-a-.8,.025,.18,s.color);
  sign(s.name,west?'WEST HALL / B':'EAST HALL / A',(a+b)/2,3.7,-18.22,Math.min(16,b-a-2),.8,{bg:west?'#936a39':'#315f75',fg:'#fff1d6',ry:Math.PI});
  sign(s.id,west?'WEST HALL':'EAST HALL',s.x,2.7,-4.2,3.3,1.7,{bg:west?'#936a39':'#315f75',fg:'#fff1d6',ry:Math.PI});
  sign(west?'百貨店西ホール':'駅ナカ東ホール','MID ←  南北自由通路',west?b-.21:a+.21,2.4,-15.4,4,.85,{bg:'#354a50',fg:'#fff1d6',ry:west?-Math.PI/2:Math.PI/2});
  // A painted boundary, not an invisible interaction radius.
  const p=s.polygon;for(let i=0;i<p.length;i++){const u=p[i],v=p[(i+1)%p.length];part((u[0]+v[0])/2,.065,(u[1]+v[1])/2,Math.abs(v[0]-u[0])||.12,.025,Math.abs(v[1]-u[1])||.12,s.color);}
  const bx=west?-33:-5;
  cover(s.id+'-flank-baffle',bx,-9,1,6,3.75,'dark');
  part(bx,2,-8.9,1.04,1.3,.14,'wood');
  sign(west?'B →':'← A','MID FLANK / 回り込み',bx+(west?.54:-.54),2.35,-9,4.3,.95,{bg:west?'#936a39':'#315f75',fg:'#fff1d6',ry:west?Math.PI/2:-Math.PI/2});
  cover(s.id+'-desk',s.x,-7.5,5.8,1.2,1.35,'wood');
  for(const dx of[-1.6,1.6])part(s.x+dx,1.5,-7.5,.7,.25,.25,'black');
  cover(s.id+'-column',west?-52:21.8,-12,1.4,1.4,4.7,'concrete');
  cover(s.id+'-case',west?-57:26,-14.6,3,2,2.3,'metal');
  for(let y=.35;y<2.3;y+=.55)part(west?-57:26,y,-13.57,2.6,.055,.045,s.color);
  rooms.push({id:s.id,bounds:{minX:a,maxX:b,minZ:c,maxZ:d},main:s.main,flank:s.flank,back:s.back});
 }
 // Offset screens make the transverse gallery a route with turns rather than
 // an uninterrupted 130m firing line. Each keeps at least a 2.5m passage.
 cover('gallery-west-screen',-3,-1.5,.8,4.6,3.6,'cream');
 cover('gallery-east-screen',19,1.5,.8,4.6,3.6,'cream');
 cover('mid-information',-24,-1.5,2.1,2.1,2.65,'metal');
 cover('mid-bench',-16.5,7,2.6,1.8,1.15,'wood');
 sign('MID / 南北自由通路','← B 西ホール     A 東ホール →',-20,3.8,8,11,.85,{bg:'#354a50',fg:'#fff4d8'});
 sign('← B    MID    A →','NORTH EXIT / KEIHAN',-20,3.8,-9,11,.85,{bg:'#354a50',fg:'#fff4d8',ry:Math.PI});
 return{rooms,covers,mid:{x:-20,z:-10},flanks:[{id:'mid-a',points:[[-20,-10],[-10,-10],[-8,-15],[1,-15],[14,-12.5]]},{id:'mid-b',points:[[-20,-10],[-30,-10],[-30,-15],[-38,-15],[-47,-12.5]]}]};
}
