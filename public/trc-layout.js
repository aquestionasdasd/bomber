// Tactical revision 02. One drawing metre is one game metre; north is CT.
export const trcDepth=z=>z;
export const trcPoint=(x,z,y=0)=>({x:x-55,z:z-70,y});
export const trcRect=(x,z,w,d)=>({minX:x-55,maxX:x+w-55,minZ:z-70,maxZ:z+d-70});
export const TRC_BOUNDS={minX:-55,maxX:55,minZ:-70,maxZ:70};
export const contains=(r,x,z,pad=0)=>x>=r.minX-pad&&x<=r.maxX+pad&&z>=r.minZ-pad&&z<=r.maxZ+pad;
export const rectPolygon=r=>[[r.minX,r.minZ],[r.maxX,r.minZ],[r.maxX,r.maxZ],[r.minX,r.maxZ]];
const rooms=(list,base=0)=>list.map(([id,name,r,ceiling,finish='floor'])=>({id,name,r,base,ceiling,finish,...trcRect(...r)}));
export const TRC_GROUND_ROOMS=rooms([
 ['ct-spawn','CT 控室',[48,2,14,12],4.4,'tile'],['ct-entry','CT 受付',[49,10,12,9],4.4,'tile'],['ct-hall','CT スタッフ通路',[19,14,74,8],4.4],
 ['ct-a','A 管理入口',[34,21,6,10],9.2],['ct-b','B 管理入口',[93,20,7,13],7.6],['ct-stage','舞台裏連絡',[84,19,6,8],4.8],
 ['a','A 展示ホール',[8,29,33,28],9.2],['a-main','A メイン',[13,56,20,12],4.8],['a-neck','A 連絡',[19,66,7,11],4.8],['a-foyer','A 前室',[10,75,21,15],5.4],
 ['a-short','A ショート',[40,45,10,14],6.8,'rubber'],['a-stair','A 階段下',[43,52,7,12],6.8,'rubber'],
 ['maintenance','設備通路',[5,65,8,13],3.6],['duct','A ダクト',[6,58,4,7],1.36,'steel'],['shaft','A はしご室',[6,56,4,3],6.8,'steel'],
 ['cross-a','西横連絡',[30,79,16,7],4.4],['mid','下MID 受付コンコース',[44,73,21,15],5.4,'tile'],['cross-b','東横連絡',[64,82,19,7],4.4],
 ['mid-stair','MID 中央階段',[52,64,10,11],6.8,'rubber'],['lobby','正面ロビー',[43,91,25,21],6.4,'tile'],['lobby-link','受付連絡',[49,86,12,7],4.4],
 ['b','B ライブホール',[71,31,33,28],7.6,'wood'],['backstage','B 舞台裏',[72,20,16,12],4.8],['b-main','B メイン',[78,58,18,9],4.8],['inspection','検品室',[81,65,19,16],5.8],
 ['b-elbow','B エルボー',[63,46,9,22],6.8,'rubber'],['ct-west','西管理通路',[2,16,20,6],4.4],['ct-west-turn','西管理階段前',[2,21,4,20],6.8],['ct-stair','A 管理階段',[2,40,4,12],6.8],
 ['ct-mid','CT 前室',[49,21,14,13],4.8],['ct-mid-turn','MID 管理連絡',[55,32,8,7],6.8],['ct-mid-stair','MID 管理階段',[52,37,10,12],6.8]
]);
export const TRC_UPPER_ROOMS=rooms([
 ['a-control','A 制御室',[2,49,14,11],6.8,'rubber'],['a-heaven','A 側面ヘブン',[10,40,7,12],6.8,'rubber'],
 ['a-gallery','A 管理回廊',[15,54,31,6],6.8,'rubber'],['upper-mid','上MID',[44,48,20,19],6.8,'tile'],
 ['upper-a-stair','A 上階階段室',[43,52,7,10],6.8,'rubber'],['b-service','B サービス',[63,51,15,8],6.8,'rubber'],
 ['upper-b-stair','B 上階階段室',[65,56,6,10],6.8,'rubber'],['upper-mid-stair','MID 上階階段室',[52,64,10,10],6.8,'rubber'],
 ['upper-ct-a','A 管理階段上',[2,40,4,12],6.8,'rubber'],['upper-ct-mid','MID 管理階段上',[52,37,10,12],6.8,'rubber']
],3.2);
export const TRC_BASEMENT_ROOMS=rooms([
 ['b-underground','B 地下搬入路',[91,37,6,45],-.24,'rubber'],['b-under-turn','地下荷捌き',[81,37,16,6],-.24],
 ['b-under-back','舞台裏地下',[81,26,6,14],-.24],['b-under-link','舞台裏階段下',[75,26,12,8],-.24],
 ['b-under-yard-stair','搬入ヤード階段',[91,79,6,11],5.8],['b-under-stage-stair','舞台裏階段',[75,23,6,8],4.8]
],-3.2);
export const TRC_ROOMS=[...TRC_GROUND_ROOMS,...TRC_UPPER_ROOMS,...TRC_BASEMENT_ROOMS];
export const TRC_OUTDOORS=rooms([
 ['plaza','屋外前庭',[3,111,104,26],0,'paving'],['long','A ロング',[3,86,15,29],0,'paving'],['yard','搬入ヤード',[81,81,26,32],0,'paving']
]);
export const TRC_FLOOR=[...TRC_GROUND_ROOMS,...TRC_OUTDOORS];
export const TRC_PORTALS=[
 [12,89,8,2,0,3.6],[49,111,13,2,0,3.8],[88,80,7,2,0,3.6],[80,82,4,7,0,3.6],
 [91,89.5,6,1,0,3.6],[16.5,42,1,6,3.2,5.8]
].map(([x,z,w,d,base,top])=>({...trcRect(x,z,w,d),base,top}));
export const TRC_WALLS=[
 [13,56.84,9.75,.32,0,2.96],[29.25,56.84,3.75,.32,0,2.96],
 [78,58.84,1.75,.32,0,7.6],[86.25,58.84,9.75,.32,0,7.6],[79.75,58.84,6.5,.32,3.4,7.6],
 [13,61.84,6,.32,0,4.8],[28,65.84,5,.32,0,4.8],[86,60.84,10,.32,0,4.8],[95,76.84,5,.32,0,5.8],
 [19,70.84,3.4,.32,0,4.8],
 [57,78.84,8,.32,0,5.4],[44,83.84,5,.32,0,5.4],
 [40.84,45,.32,4,0,9.2],[40.84,54,.32,5,0,9.2],[40.84,49,.32,5,3.1,9.2],
 [63,50.84,5,.32,0,6.8],[70.84,46,.32,.5,0,7.6],[70.84,51.5,.32,7.5,0,7.6],[70.84,46.5,.32,5,2.9,7.6],
 [72,30.84,7,.32,0,7.6],[84,30.84,4,.32,0,7.6],[79,30.84,5,.32,2.9,7.6],
 [55,24.84,8,.32,0,4.8],[49,30.84,6,.32,0,4.8],
 [12,48.84,5,.32,3.2,6.8],[50,58.84,7,.32,3.2,6.8],[36.84,54,.32,3,3.2,6.8],
 [15.84,54,.32,.5,3.2,6.8],[15.84,59.5,.32,.5,3.2,6.8],[15.84,54.5,.32,5,6.1,6.8],
 [91,58.84,3,.32,-3.2,-.24],
 [38,115,22,4,0,3.2],[6,101,4,6,0,2.7]
].map(([x,z,w,d,base,height],i)=>({...trcRect(x,z,w,d),base,height,id:'partition-'+i}));
export const TRC_STAIRS=[
 {id:'S1',r:[52,64,10,11],base:0,height:3.2,direction:-1},
 {id:'S2',r:[44,52,6,10],base:0,height:3.2,direction:-1},
 {id:'S3',r:[65,56,6,10],base:0,height:3.2,direction:-1},
 {id:'S4',r:[2,40,4,12],base:0,height:3.2,direction:1},
 {id:'S5',r:[91,79,6,11],base:-3.2,height:3.2,direction:1},
 {id:'S6',r:[75,23,6,8],base:-3.2,height:3.2,direction:-1},
 {id:'S7',r:[52,37,10,12],base:0,height:3.2,direction:1},
 {id:'stage',r:[87,35,4,3],base:0,height:1.2,direction:-1}
].map(v=>({...v,...trcRect(...v.r),axis:'z',steps:Math.ceil(v.height/.16)}));
export const TRC_LADDERS=[{id:'L1',...trcPoint(9,58),height:3.2,exit:trcPoint(10.3,57.5,3.2),hole:trcRect(8.1,57.1,1.8,1.8)}];
export const TRC_DECKS=[...TRC_UPPER_ROOMS.map(v=>({...v,y:3.2})),{id:'b-stage',name:'B 試聴ステージ',r:[85,32,16,4],y:1.2,...trcRect(85,32,16,4)}];
export const TRC_DUCTS=[{id:'U1',rects:[trcRect(6,58,4,7)],entry:trcPoint(9,66),ladder:'L1',height:1.36}];
export const TRC_DOORS=[
 {id:'D1',...trcPoint(16,57,3.2),axis:'z',width:5,label:'A 制御室'},
 {id:'D2',...trcPoint(81.5,31),axis:'x',width:5,label:'B 舞台裏'},
 {id:'D3',...trcPoint(71,49),axis:'z',width:5,label:'B エルボー'}
];
export const TRC_COVERS=[
 [15,37,8,4,'container'],[29,48,7,3,'container'],[78,39,8,4,'container'],[94,49,7,4,'container'],
 [83,71,7,3,'container'],[48,96,6,3,'case'],[94,99,8,5,'container'],[48,50,5,3,'case',3.2],
 [91,46,2,4,'case',-3.2]
].map(([x,z,w,d,type,base=0],i)=>({...trcRect(x,z,w,d),id:'cover-'+i,type,base,height:base+(type==='container'?2.7:1.45)}));
export const TRC_SCREENS=[[35,33,4,.32],[100,43,.32,4]].map(r=>trcRect(...r));
export const TRC_SITES=[
 {id:'A',name:'A / 展示ホール',r:[13,35,25,18],center:[26,43],points:[[26,43],[15,47],[35,37],[26,51]]},
 {id:'B',name:'B / ライブホール',r:[73,37,29,17],center:[88,46],points:[[88,46],[75,48],[98,39],[88,52]]}
];
export const TRC_DROPS=[{id:'heaven-drop',from:trcPoint(16.3,45,3.2),to:trcPoint(19,45,0)}];
export function stairHeight(r,x,z){const along=r.axis==='x'?x:z,min=r.axis==='x'?r.minX:r.minZ,max=r.axis==='x'?r.maxX:r.maxZ,t=Math.max(0,Math.min(1,(along-min)/(max-min))),f=r.direction<0?1-t:t;return r.base+r.height*Math.min(r.steps,Math.ceil(Math.max(0,f-1e-7)*r.steps))/r.steps;}
export function trcDuctAt(x,z,y=0){return y>=-.1&&y<1.4?TRC_DUCTS.find(d=>d.rects.some(r=>contains(r,x,z,.45))):null;}
export function trcDeckCut(x,z,y){return TRC_STAIRS.some(r=>Math.abs(r.base+r.height-y)<.01&&contains(r,x,z)&&stairHeight(r,x,z)<y-.01)||TRC_LADDERS.some(l=>l.height===y&&contains(l.hole,x,z));}
