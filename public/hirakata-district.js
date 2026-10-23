// Photo/official-area-plan reconstruction, compressed into the game's rotated
// coordinates. Generic blocks are deliberately not labelled as surveyed shops.
export const HIRAKATA_DISTRICT_BUILDINGS = Object.freeze([
 ['medical',-101,-96,18,22,42,'関西医大方面','white'],
 ['annex',-71,-100,26,14,24,'新町 医療街','silver'],
 ['north-shops',-36,-100,24,14,12,'北口 商店街','cream'],
 ['clinic',-7,-99,18,16,18,'北口 クリニック街','ivory'],
 ['woven',24,-99,28,16,16,'北口 商業街区','cream'],
 ['tower',64,-100,22,18,72,'STATION HILL','silver'],
 ['mall-east',99,-74,20,30,30,'枚方モール方面','ivory'],
 ['east-shops',99,-37,20,20,18,'駅東 店舗街','cream'],
 ['east-office',99,-3,20,26,30,'岡東 オフィス街','silver'],
 ['parking',99,32,20,24,16,'駅東 駐車場','concrete'],
 ['east-retail',99,68,20,24,12,'岡東 商店街','ivory'],
 ['south-hotel',91,99,32,18,32,'南口 ホテル街','cream'],
 ['south-office',54,101,30,14,18,'岡東 南街区','white'],
 ['south-gallery',-4,100,30,16,13,'南口 ショッピング街','cream'],
 ['sunplaza',-48,100,26,16,20,'ひらかた サンプラザ方面','ivory'],
 ['vioro',-97,94,24,28,24,'ビオルネ方面','cream'],
 ['west-retail',-99,55,22,24,16,'岡本町 商店街','ivory'],
 ['west-home',-99,18,22,26,22,'岡本町 住宅街','cream'],
 ['west-shops',-99,-20,22,24,13,'駅西 路地街','white'],
 ['west-office',-100,-57,20,26,26,'新町 オフィス街','silver'],
].map(([id,x,z,w,d,h,name,material])=>Object.freeze({id,x,z,w,d,h,name,material})));

export function addHirakataDistrict({part,solid,sign,mapShapes,breakable=(id,build)=>build()}) {
 const rect=(x,z,w,d)=>[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]];
 // Flat paving and road paint have no invisible raised collisions. Four broad
 // streets join the old plaza through real gaps; side alleys join them twice.
 for(const[x,z,w,d]of[[-84,0,8,176],[84,0,8,176],[0,-84,176,8],[0,84,176,8]]){
  part(x,.008,z,w,.012,d,'road');
  mapShapes.push({polygon:rect(x,z,w,d),kind:'road',color:'#3c505c'});
  const vertical=d>w;for(let t=-78;t<=78;t+=7)part(vertical?x:t,.02,vertical?t:z,vertical?.14:2.4,.012,vertical?2.4:.14,'white');
 }
 for(const[x,z,w,d]of[[-73,-84,16,3],[0,-84,16,3],[79,-84,10,3],[-84,-39,3,10],[-84,37,3,10],[84,-53,3,10],[84,51,3,10],[-29,84,12,3],[28,84,12,3]]){
  const vertical=d>w;for(let t=-3;t<=3;t++)part(x+(vertical?0:t*.9),.026,z+(vertical?t*.9:0),vertical?2.9:.5,.012,vertical?.5:2.9,'white');
 }
 for(const b of HIRAKATA_DISTRICT_BUILDINGS){
  const {x,z,w,d,h,name,material,id}=b;
  solid(x,h/2,z,w,h,d,material,'building','district-'+id);
  // Shared box instances for all four facades: no new draw call per window.
  for(let y=3;y<h-1;y+=3.2){
   for(let xx=x-w/2+1.8;xx<x+w/2-1;xx+=3.1)for(const s of[-1,1])part(xx,y,z+s*(d/2+.035),2,1.65,.05,'glass2');
   for(let zz=z-d/2+1.8;zz<z+d/2-1;zz+=3.1)for(const s of[-1,1])part(x+s*(w/2+.035),y,zz,.05,1.65,2,'glass');
   part(x,y+1.35,z,w+.12,.12,d+.12,material);
  }
  part(x,h+.22,z,w+.35,.44,d+.35,'concrete');
  part(x,h+.9,z,w*.3,1.2,d*.28,'metal');
  // Face the shopping frontage towards the station, including the side streets.
  const side=Math.abs(x)>85&&Math.abs(z)<90,face=side?Math.sign(x):-Math.sign(z);
  const fx=side?x-face*(w/2+.12):x,fz=side?z:z+face*(d/2+.12),ry=side?-face*Math.PI/2:face<0?Math.PI:0;
  sign(name,'HIRAKATASHI · 駅周辺',fx,4.1,fz,Math.min(side?d-1:w-1,19),1.25,{bg:id==='medical'?'#e6eeea':'#364c53',fg:id==='medical'?'#386569':'#fff1d6',ry});
  if(side){
   part(fx,3.05,z,.9,.18,d-1,'dark');for(let zz=z-d/2+2;zz<z+d/2-1;zz+=4)part(fx,1.35,zz,.07,2.4,2.8,'glass2');
  }else{
   part(x,3.05,fz,w-1,.18,.9,'dark');for(let xx=x-w/2+2;xx<x+w/2-1;xx+=4)part(xx,1.35,fz,2.8,2.4,.07,'glass2');
  }
 }
 // Recognisable north-east twin skyline; hospital cross at the north-west edge.
 part(-101,36,-84.93,1.2,5,.08,'red');part(-101,36,-84.9,4,1.2,.08,'red');
 // Low street furniture marks intersections without filling the walking line.
 for(const[x,z]of[[-79,-82],[-79,39],[79,-52],[79,51],[-27,79],[27,-79]])breakable('district-furniture-'+x+'-'+z,()=>{
  solid(x,.45,z,3,.9,1.3,'concrete','cover');part(x,.94,z,2.7,.15,1,'leaf');
  part(x+2.8,3,z,.1,6,.1,'metal');part(x+3.2,6,z,.9,.12,.35,'light');
 });
 return HIRAKATA_DISTRICT_BUILDINGS;
}
