// Original, gameplay-adapted indoor venue. Coordinates match layout study 02,
// translated around the arena origin; this is not a survey of the real TRC.
export const trcPoint=(x,z,y=0)=>({x:x-36,z:z-30,y});
export const trcRect=(x,z,w,d)=>({minX:x-36,minZ:z-30,maxX:x+w-36,maxZ:z+d-30});
export const contains=(r,x,z,pad=0)=>x>=r.minX-pad&&x<=r.maxX+pad&&z>=r.minZ-pad&&z<=r.maxZ+pad;
export const rectPolygon=r=>[[r.minX,r.minZ],[r.maxX,r.minZ],[r.maxX,r.maxZ],[r.minX,r.maxZ]];
export const TRC_FLOOR=[
 [24,51,24,7],[4,46,64,6],[32,34,8,19],[4,20,8,28],[8,20,8,10],[10,12,20,18],
 [14,27,6,21],[10,35,10,6],[18,33,13,5],[26,27,11,6],[27,27,18,10],[40,30,14,6],
 [44,12,24,18],[58,28,10,20],[48,29,6,13],[49,37,14,5],[12,7,49,6],[18,8,7,8],
 [54,8,7,8],[30,2,12,10],[38,24,4,10],
 // Stairwells and maintenance shafts are actual usable volumes.
 [12,8,4,8],[57,7,4,9],[54,5,7,3],[30,20,4,13],[36,20,7,13],[30,20,13,6],
 [33.8,27,2.2,8.9],[30.9,25.9,5.1,2.2],[65,31.9,6.1,2.2],[68.9,20,2.2,14],[64.9,19.9,6.2,2.2]
].map(r=>trcRect(...r));
export const TRC_DECKS=[
 {id:'a-heaven',r:[12,12,18,5],y:3.2},{id:'a-catwalk',r:[27,14,4,12],y:3.2},
 {id:'a-shaft',r:[27,21,7,4],y:3.2},{id:'bridge',r:[30,20,8,4],y:3.2},
 {id:'mid-tower',r:[36,20,7,6],y:3.2},{id:'b-deck',r:[50,12,18,5],y:3.6},
 {id:'b-tower',r:[62,14,6,12],y:3.6},{id:'b-stage',r:[46,23,7,5],y:1.2}
].map(v=>({...v,...trcRect(...v.r)}));
export const TRC_STAIRS=[
 {id:'S1',r:[12,8,4,8],height:3.2,direction:1},
 {id:'S2',r:[57,7,4,9],height:3.6,direction:1},
 {id:'S3',r:[38,25,3,8],height:3.2,direction:-1},
 {id:'S4',r:[48,27,4,3],height:1.2,direction:-1},
 {id:'S5',r:[52,25,3,3],height:1.2,direction:-1,axis:'x'}
].map(v=>({...v,...trcRect(...v.r),axis:v.axis||'z',base:0,steps:Math.ceil(v.height/.16)}));
export const TRC_LADDERS=[
 {id:'L1',...trcPoint(32,23),height:3.2,exit:trcPoint(30.4,23,3.2),hole:trcRect(31.1,22.1,1.8,1.8)},
 {id:'L2',...trcPoint(66,21),height:3.6,exit:trcPoint(64.4,21,3.6),hole:trcRect(65.1,20.1,1.8,1.8)}
];
export const TRC_DUCTS=[
 {id:'U1',rects:[[33.8,27,2.2,8.9],[30.9,25.9,5.1,2.2]],entry:trcPoint(34.9,35.6),ladder:'L1'},
 {id:'U2',rects:[[65,31.9,6.1,2.2],[68.9,20,2.2,14],[66.9,19.9,4.2,2.2]],entry:trcPoint(65.2,33),ladder:'L2'}
].map(v=>({...v,rects:v.rects.map(r=>trcRect(...r)),height:1.36}));
export const TRC_DOORS=[
 {id:'D1',...trcPoint(30,28.5),axis:'z',width:3,label:'A ショート'},
 {id:'D2',...trcPoint(51,30),axis:'x',width:6,label:'B 舞台裏'},
 {id:'D3',...trcPoint(35,22,3.2),axis:'z',width:4,label:'上層連絡橋'}
];
export const TRC_COVERS=[
 [12,17.5,3,3,'case'],[17,19,6,3,'container'],[20,22.8,5,2.5,'container'],
 [4,33,3,2,'case'],[9,42,3,2,'case'],[14,40,3,3,'container'],
 [50,17,4,3,'case'],[54,20,5,4.5,'container'],[63,24,3,2,'rack'],
 [60,42,3,2,'case'],[49,37,2.5,2.5,'case']
].map(([x,z,w,d,type],i)=>({...trcRect(x,z,w,d),id:'cover-'+i,type,height:type==='container'?2.65:type==='rack'?2.15:1.45}));
export const TRC_SCREENS=[
 [26,30,4,.28],[28.7,26.6,1.3,.28],[44,29.8,4,.4],[54,29.8,4,.4],
 [58,36,5,.24],[63,40,5,.24],[34.5,39,5.5,.3],[27,30.8,3,.3],
 [31,7,3,2],[39,11,3,2],
 // The D1 bulkhead seals the edge of the site around its doorway.
 [29.85,26, .3,1],[29.85,30,.3,1]
].map(r=>trcRect(...r));
export function stairHeight(r,x,z){
 const along=r.axis==='x'?x:z,min=r.axis==='x'?r.minX:r.minZ,max=r.axis==='x'?r.maxX:r.maxZ;
 const t=Math.max(0,Math.min(1,(along-min)/(max-min))),f=r.direction<0?1-t:t;
 return r.base+r.height*Math.min(r.steps,Math.ceil(Math.max(0,f-1e-7)*r.steps))/r.steps;
}
export function trcDuctAt(x,z,y=0){return y<1.4?TRC_DUCTS.find(d=>d.rects.some(r=>contains(r,x,z,.45))):null;}
export function trcDeckCut(x,z,y){
 return TRC_STAIRS.some(r=>r.height===y&&contains(r,x,z)&&stairHeight(r,x,z)<y-.01)||
   TRC_LADDERS.some(l=>l.height===y&&contains(l.hole,x,z));
}
