// Tactical revision 04: a split forecourt and blind, side-entry main approaches.
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
 ['a','A 展示ホール',[8,29,33,28],9.2],['a-vestibule','A 横入り前室',[24,56,12,13],5.4],
 ['a-main','A メイン',[16.4,62.5,7.6,23.5],5.4],['a-bend','A 折り返し',[13,80,23,10],5.4],
 ['a-foyer','A 前室',[24,86,12,10],5.4],['a-entry-turn','A 入場連絡',[10,87,26,12],5.4],['a-entry','A 入場口',[10,91,14,21],5.4],
 ['a-short','A ショート',[40,45,10,14],6.8,'rubber'],['a-stair','A 階段下',[43,52,7,12],6.8,'rubber'],
 ['maintenance','設備通路',[5,65,12,11],3.6],['duct','A ダクト',[6,58,4,7],1.36,'steel'],['shaft','A はしご室',[6,56,4,3],6.8,'steel'],
 ['mid','下MID 受付コンコース',[45,73,20,27],5.4,'tile'],
 ['mid-stair','MID 中央階段',[52,64,10,11],6.8,'rubber'],['lobby','正面ロビー',[45,97,20,10],5.4,'tile'],['lobby-entry','正面入口',[50,105,10,8],5.4,'tile'],
 ['a-mid','A MID連絡',[33,87,13,10],5.4],['b-mid','B MID連絡',[64,97,14,10],5.4],
 ['b','B ライブホール',[71,31,33,28],7.6,'wood'],['backstage','B 舞台裏',[72,20,16,12],4.8],
 ['b-vestibule','B 横入り前室',[87.8,58,12.2,11],5.4],['b-main','B メイン',[77,62.5,10.8,19.5],5.4],
 ['b-upper-turn','B 折り返し',[77,77,23,11],5.4],['b-side','B 搬入連絡',[89,87,11,10],5.4],
 ['b-foyer','B 前室',[77,92,23,11],5.4],['b-entry-turn','B 入場連絡',[77,96,23,12],5.4],['b-entry','B 入場口',[88,98,12,15],5.4],
 ['b-elbow','B エルボー',[63,46,9,22],6.8,'rubber'],['a-heaven-stair','A ヘブン階段',[11,60,5,13],6.8],
 ['ct-mid','CT 前室',[49,21,14,13],4.8],['ct-mid-turn','MID 管理連絡',[55,32,8,7],6.8],['ct-mid-stair','MID 管理階段',[52,37,10,12],6.8]
]);
export const TRC_UPPER_ROOMS=rooms([
 ['a-control','A 制御室',[2,49,14,11],6.8,'rubber'],['a-heaven','A 側面ヘブン',[10,40,7,12],6.8,'rubber'],
 ['a-gallery','A ヘブン踊り場',[10,59,7,3],6.8,'rubber'],['upper-mid','上MID',[44,48,20,19],6.8,'tile'],
 ['upper-a-stair','A 上階階段室',[43,52,7,10],6.8,'rubber'],['b-service','B 階段踊り場',[63,51,8,8],6.8,'rubber'],
 ['upper-b-stair','B 上階階段室',[65,56,6,10],6.8,'rubber'],['upper-mid-stair','MID 上階階段室',[52,64,10,10],6.8,'rubber'],
 ['upper-heaven-stair','A ヘブン階段上',[11,60,5,13],6.8,'rubber'],['upper-ct-mid','MID 管理階段上',[52,37,10,12],6.8,'rubber']
],3.2);
export const TRC_BASEMENT_ROOMS=rooms([
 ['b-underground','B 地下搬入路',[101,34,6,60],-.24,'rubber'],['b-under-turn','地下荷捌き',[72,34,35,6],-.24],
 ['b-under-link','舞台裏階段下',[72,26,6,14],-.24],
 ['b-under-yard-stair','搬入ヤード階段',[101,91,6,11],5.4],['b-under-stage-stair','舞台裏階段',[72,23,5,8],4.8]
],-3.2);
export const TRC_ROOMS=[...TRC_GROUND_ROOMS,...TRC_UPPER_ROOMS,...TRC_BASEMENT_ROOMS];
export const TRC_OUTDOORS=rooms([
 ['plaza','屋外前庭',[3,111,104,27],0,'paving'],['yard','地下搬入ヤード',[100,102,8,11],0,'paving']
]);
export const TRC_FLOOR=[...TRC_GROUND_ROOMS,...TRC_OUTDOORS];
export const TRC_PORTALS=[
 [12,111,10,2,0,3.6],[51,112,8,2,0,3.8],[89,112,10,2,0,3.6],
 [101,101.5,6,1,0,3.6],[16.5,42,1,6,3.2,5.8]
].map(([x,z,w,d,base,top])=>({...trcRect(x,z,w,d),base,top}));
export const TRC_WALLS=[
 [13,56.6,11,.8,0,5.4],[30.5,56.6,5.5,.8,0,5.4],[24,56.6,6.5,.8,3.4,5.4],
 [77,58.6,14,.8,0,7.6],[97.5,58.6,2.5,.8,0,7.6],[91,58.6,6.5,.8,3.4,7.6],
 // Solid returns join the shell; no empty pocket remains behind the vestibule.
 [23.2,69,12.8,11,0,5.4],[23.2,56.6,.8,5.9,0,5.4],[23.2,62.5,.8,6.5,3.4,5.4],
 [87,69,13,8,0,5.4],[87,58.6,.8,3.9,0,5.4],[87,62.5,.8,6.5,3.4,5.4],[77,88,12,4,0,5.4],
 [57,78.84,8,.32,0,5.4],
 // S1/S2 shutter openings are 6 m wide with sealed jambs and headers.
 [39.84,87,.32,2,0,5.4],[39.84,95,.32,2,0,5.4],[39.84,89,.32,6,2.9,5.4],
 [69.84,97,.32,2,0,5.4],[69.84,105,.32,2,0,5.4],[69.84,99,.32,6,2.9,5.4],
 [40.84,45,.32,4,0,9.2],[40.84,54,.32,5,0,9.2],[40.84,49,.32,5,3.1,9.2],
 [63,50.84,5,.32,0,6.8],[70.84,46,.32,.5,0,7.6],[70.84,51.5,.32,7.5,0,7.6],[70.84,46.5,.32,5,2.9,7.6],
 [72,30.84,7,.32,0,7.6],[84,30.84,4,.32,0,7.6],[79,30.84,5,.32,2.9,7.6],
 [55,24.84,8,.32,0,4.8],[49,30.84,6,.32,0,4.8],
 [12,48.84,5,.32,3.2,6.8],[50,58.84,7,.32,3.2,6.8],
 [2,59.84,8,.32,3.2,6.8],[15,59.84,2,.32,3.2,6.8],[10,59.84,5,.32,6.1,6.8],
 [101,58.84,3,.32,-3.2,-.24],
 // Stair wells have distinct entrances; their sides are not extra doorways.
 [100.84,91,.32,11,0,5.4],[106.84,91,.32,11,0,5.4],[101,90.84,6,.32,0,5.4],
 [71.84,23,.32,8,0,4.8],[76.84,23,.32,8,0,4.8],[72,30.84,5,.32,0,4.8],
 // Close the four reported ledges/side openings without closing the landings.
 [71,56,1,10,0,6.8], // B elbow: slit outside the east stair stringer.
 [16,52,1,7,3.2,6.8], // A control room: exposed strip on the plinth.
 [8,40,2,9,3.2,9.2], // A heaven: western plinth ledge, outside the room.
 [51.84,64,.32,11,0,6.8],[61.84,64,.32,11,0,6.8], // MID stair cheeks.
].map(([x,z,w,d,base,height],i)=>({...trcRect(x,z,w,d),base,height,id:'partition-'+i}));
export const TRC_RECEPTION={polygon:[[36,116],[74,116],[74,122],[65,122],[61,129],[49,129],[45,122],[36,122]].map(([x,z])=>[x-55,z-70]),base:0,height:4.2};
export const TRC_STAIRS=[
 {id:'S1',r:[52,64,10,11],base:0,height:3.2,direction:-1},
 {id:'S2',r:[44,52,6,10],base:0,height:3.2,direction:-1},
 {id:'S3',r:[65,56,6,10],base:0,height:3.2,direction:-1},
 {id:'S4',r:[11,61,5,11],base:0,height:3.2,direction:-1},
 {id:'S5',r:[101,91,6,11],base:-3.2,height:3.2,direction:1},
 {id:'S6',r:[72,23,5,8],base:-3.2,height:3.2,direction:-1},
 {id:'S7',r:[52,37,10,12],base:0,height:3.2,direction:1},
 {id:'stage',r:[87,35,4,3],base:0,height:1.2,direction:-1}
].map(v=>({...v,...trcRect(...v.r),axis:'z',steps:Math.ceil(v.height/.16)}));
export const TRC_LADDERS=[{id:'L1',...trcPoint(9,58),height:3.2,exit:trcPoint(10.3,57.5,3.2),hole:trcRect(8.1,57.1,1.8,1.8)}];
export const TRC_DECKS=[...TRC_UPPER_ROOMS.map(v=>({...v,y:3.2})),{id:'b-stage',name:'B 試聴ステージ',r:[85,32,16,4],y:1.2,...trcRect(85,32,16,4)}];
// Close the accidental crawl-around space under the side heaven as architecture.
export const TRC_PLINTHS=[[8,40,9,14],[10,54,7,6]].map((r,i)=>({...trcRect(...r),base:0,height:3.2,id:'heaven-base-'+i}));
export const TRC_DUCTS=[{id:'U1',rects:[trcRect(6,58,4,7)],entry:trcPoint(9,66),ladder:'L1',height:1.36}];
export const TRC_DOORS=[
 {id:'D1',...trcPoint(12.5,60,3.2),axis:'x',width:5,label:'A 制御室'},
 {id:'D2',...trcPoint(81.5,31),axis:'x',width:5,label:'B 舞台裏'},
 {id:'D3',...trcPoint(71,49),axis:'z',width:5,label:'B エルボー'},
 {id:'D4',...trcPoint(40,92),axis:'z',width:6,label:'S1 / A → MID'},
 {id:'D5',...trcPoint(70,102),axis:'z',width:6,label:'S2 / B → MID'}
];
export const TRC_COVERS=[
 [17,37,8,4,'container'],[29,48,7,3,'container'],[78,39,8,4,'container'],[94,49,7,4,'container'],
 [48,50,5,3,'case',3.2],[101,46,2,4,'case',-3.2]
].map(([x,z,w,d,type,base=0],i)=>({...trcRect(x,z,w,d),id:'cover-'+i,type,base,height:base+(type==='container'?2.7:1.45)}));
export const TRC_SCREENS=[[35,33,6,.32],[100,43,4,.32]].map(r=>trcRect(...r));
export const TRC_SITES=[
 {id:'A',name:'A / 展示ホール',r:[13,35,25,18],center:[26,43],points:[[26,43],[19,47],[35,37],[26,51]]},
 {id:'B',name:'B / ライブホール',r:[73,37,29,17],center:[88,46],points:[[88,46],[75,48],[98,39],[88,52]]}
];
export const TRC_DROPS=[{id:'heaven-drop',from:trcPoint(16.3,45,3.2),to:trcPoint(19,45,0)}];
export function stairHeight(r,x,z){const along=r.axis==='x'?x:z,min=r.axis==='x'?r.minX:r.minZ,max=r.axis==='x'?r.maxX:r.maxZ,t=Math.max(0,Math.min(1,(along-min)/(max-min))),f=r.direction<0?1-t:t;return r.base+r.height*Math.min(r.steps,Math.ceil(Math.max(0,f-1e-7)*r.steps))/r.steps;}
export function trcDuctAt(x,z,y=0){return y>=-.1&&y<1.4?TRC_DUCTS.find(d=>d.rects.some(r=>contains(r,x,z,.45))):null;}
export function trcDeckCut(x,z,y){return TRC_STAIRS.some(r=>Math.abs(r.base+r.height-y)<.01&&contains(r,x,z)&&stairHeight(r,x,z)<y-.01)||TRC_LADDERS.some(l=>l.height===y&&contains(l.hole,x,z));}
