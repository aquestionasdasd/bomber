// Approved layout 04. Diagram coordinates become metres; the approach alone
// grows 1.8 times, while sites and defence retain their broad floor plans.
export const trcDepth=z=>z+.8*Math.max(0,Math.min(45,z-46));
export const trcPoint=(x,z,y=0)=>({x:x-55,z:trcDepth(z)-70,y});
export const trcRect=(x,z,w,d)=>({minX:x-55,maxX:x+w-55,minZ:trcDepth(z)-70,maxZ:trcDepth(z+d)-70});
export const TRC_BOUNDS={minX:-55,maxX:55,minZ:-70,maxZ:70};
export const contains=(r,x,z,pad=0)=>x>=r.minX-pad&&x<=r.maxX+pad&&z>=r.minZ-pad&&z<=r.maxZ+pad;
export const rectPolygon=r=>[[r.minX,r.minZ],[r.maxX,r.minZ],[r.maxX,r.maxZ],[r.minX,r.maxZ]];
export const TRC_ROOMS=[
 ['a','A 展示ホール',[13,20,27,26],9.2,'floor'],['b','B 試聴ホール',[68,20,31,26],7.6,'wood'],
 ['a-main','A 前室',[15,46,19,15],4.8,'floor'],['cargo','荷捌き室',[76,46,23,20],5.8,'floor'],
 ['lobby','エントランスロビー',[39,59,29,18],6.4,'tile'],['mid','MID 中央連絡',[42,43,15,16],4.2,'rubber'],
 ['a-short','A 接続室',[36,32.5,10.5,7],4.2,'rubber'],['a-link','A 接続通路',[39.5,36,7,11.5],4.2,'rubber'],
 ['b-link','B 接続通路',[57.5,32.5,7,19],4.2,'rubber'],['b-short','B 接続室',[61,32.5,10,7],4.2,'rubber'],
 ['cross','MID 横断',[49,44.5,12,7],4.2,'rubber'],
 ['ct-a','A 管理通路',[28,10,19,8],6.4,'floor'],['ct-a-entry','A 階段室',[28,14,8,10],6.4,'floor'],
 ['ct-mid','管理受付',[43,5,19,9],4.4,'tile'],['ct-b','B 管理通路',[58,10,27,8],4.4,'floor'],['ct-b-entry','B 管理入口',[77,14,8,10],4.4,'floor'],
 ['maintenance','保守室',[3,43,9,13],3.6,'floor'],['prep','上階準備室',[3,25,10,11],6.6,'rubber'],
 ['prep-link','準備室連絡',[11,23,5,8],6.6,'rubber'],['chase','ダクト機械区画',[4,33,2.4,14.6],2.1,'floor']
].map(([id,name,r,ceiling,finish])=>({id,name,r,ceiling,finish,...trcRect(...r)}));
export const TRC_OUTDOORS=[
 ['plaza','屋外前庭',[8,77,97,21]],['long','A ロング / 屋外',[4,54,19,25]],
 ['yard','搬入ヤード',[73,69,32,17]],['yard-entry','搬入口',[81,65,6,6]]
].map(([id,name,r])=>({id,name,r,...trcRect(...r)}));
export const TRC_FLOOR=[...TRC_ROOMS,...TRC_OUTDOORS];
export const TRC_PORTALS=[[48,76,8,2,0,3.6],[18,60,6,2,0,3.6],[81,65,6,2,0,3.4],[6.8,55,4,2,0,2.7]]
 .map(([x,z,w,d,base,top])=>({...trcRect(x,z,w,d),base,top}));
export const TRC_WALLS=[
 [13,45.8,11,.4,0,9.2],[30,45.8,10,.4,0,9.2],[24,45.8,6,.4,3.4,9.2],
 [68,45.8,18,.4,0,7.6],[92,45.8,7,.4,0,7.6],[86,45.8,6,.4,3.4,7.6],
 [42,58.8,4,.4,0,4.2],[53,58.8,4,.4,0,4.2],[46,58.8,7,.4,3.2,4.2],
 [17,49,.4,8,0,4.8],[17,56.8,6,.4,0,4.8],
 [90.8,50,.4,5,0,5.8],[80,54.8,11,.4,0,5.8],
 [47,61.8,11,.4,0,6.4],[46.8,62,.4,3,0,6.4],
 [29,80,4,6,0,2.8],[76,82.8,6,.4,0,3.2],[81.8,83,.4,5,0,3.2],[44,80.8,12,.5,0,3.2],
 // One bounded heaven window replaces the wraparound gallery and mid tower.
 [14,25.8,7,.4,3.2,6.5],[29,25.8,8,.4,3.2,6.5],[21,25.8,8,.4,3.2,4.0],[21,25.8,8,.4,6,6.5],
 [12.8,23,.4,3,0,3.2],[12.8,26,.4,5,0,6.6]
].map(([x,z,w,d,base,height])=>({...trcRect(x,z,w,d),base,height}));
export const TRC_DECKS=[
 {id:'a-heaven',r:[14,21,23,5],y:3.2},{id:'a-prep',r:[3,25,10,11],y:3.2},
 {id:'a-prep-link',r:[11,23,5,8],y:3.2},{id:'b-stage',r:[72,21,20,4],y:1.2}
].map(v=>({...v,...trcRect(...v.r)}));
export const TRC_STAIRS=[{id:'S1',r:[30,13,4,8],height:3.2,direction:1},{id:'S2',r:[79,25,4,3],height:1.2,direction:-1}]
 .map(v=>({...v,...trcRect(...v.r),axis:'z',base:0,steps:Math.ceil(v.height/.16)}));
export const TRC_LADDERS=[{id:'L1',...trcPoint(9,30),height:3.2,exit:trcPoint(10.4,30,3.2),hole:trcRect(8.1,29.1,1.8,1.8)}];
export const TRC_DUCTS=[{id:'U1',rects:[trcRect(4,33,2.4,14.6)],entry:trcPoint(5.2,48.5),ladder:'L1',height:1.36,
 openings:[trcRect(3.8,32.8,2.8,.4),trcRect(3.8,47.4,2.8,.4)]}];
export const TRC_DOORS=[
 {id:'D1',...trcPoint(27,46),axis:'x',width:6,label:'A ホール'},
 {id:'D2',...trcPoint(84,66),axis:'x',width:6,label:'搬入口'},
 {id:'D3',...trcPoint(13,24.5,3.2),axis:'z',width:3,label:'上階準備室'}
];
export const TRC_COVERS=[
 [17,32,8,4,'container'],[29,37,7,4,'container'],[73,30,8,4,'container'],[86,37,8,4,'container'],
 [17,40,2.5,2,'case'],[94,28,2,2,'rack'],[5,70,4,2,'case'],[96,77,4,2,'container'],[62,73,3,1.5,'case']
].map(([x,z,w,d,type],i)=>({...trcRect(x,z,w,d),id:'cover-'+i,type,height:type==='container'?2.7:type==='rack'?2.15:1.45}));
export const TRC_SCREENS=[[34,29,4,.3],[69,40,.3,4]].map(r=>trcRect(...r));
export const TRC_SITES=[
 {id:'A',name:'A / 展示ホール',r:[14,27,25,18],center:[27,35],points:[[27,35],[16,38],[33,28],[37,43]]},
 {id:'B',name:'B / 試聴ホール',r:[69,28,29,17],center:[84,35],points:[[84,35],[71,37],[96,33],[84,43]]}
];
export function stairHeight(r,x,z){const along=r.axis==='x'?x:z,min=r.axis==='x'?r.minX:r.minZ,max=r.axis==='x'?r.maxX:r.maxZ,t=Math.max(0,Math.min(1,(along-min)/(max-min))),f=r.direction<0?1-t:t;return r.base+r.height*Math.min(r.steps,Math.ceil(Math.max(0,f-1e-7)*r.steps))/r.steps;}
export function trcDuctAt(x,z,y=0){return y<1.4?TRC_DUCTS.find(d=>d.rects.some(r=>contains(r,x,z,.45))):null;}
export function trcDeckCut(x,z,y){return TRC_STAIRS.some(r=>r.height===y&&contains(r,x,z)&&stairHeight(r,x,z)<y-.01)||TRC_LADDERS.some(l=>l.height===y&&contains(l.hole,x,z));}
