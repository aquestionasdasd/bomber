// Competitive circulation follows the existing station, decks and shop islands.
// These are architectural footprints, not invisible fences or temporary cover.
const rect = (minX,maxX,minZ,maxZ) => [[minX,minZ],[maxX,minZ],[maxX,maxZ],[minX,maxZ]];
const points = list => list.map(([x,z])=>({x,z}));
export const TACTICAL_BUILDINGS = [
  {id:'a-cafe',name:'喫茶店の増築棟',minX:-62,maxX:-46.5,minZ:29,maxZ:42,height:5.2,finish:'cafe'},
  {id:'a-waiting-return',name:'バス待合室',minX:-80,maxX:-56,minZ:-4,maxZ:3,height:3.8,finish:'waiting'},
  {id:'a-waiting-wing',name:'待合室の駅側ウィング',minX:-56.5,maxX:-51,minZ:-28,maxZ:-4,height:4.8,finish:'waiting'},
  {id:'a-frontage',name:'駅前の閉店店舗',minX:-43,maxX:-27,minZ:-12,maxZ:-8,height:4.2,finish:'cafe'},
  {id:'b-dining',name:'ミウィのダイニング棟',minX:43,maxX:64,minZ:30,maxZ:42,height:5.2,finish:'dining'},
  {id:'b-delivery-return',name:'配送管理室',minX:61,maxX:80,minZ:20,maxZ:24,height:4.2,finish:'service'},
  {id:'b-stockroom',name:'ミウィ店舗のストック室',minX:31,maxX:47.5,minZ:-28,maxZ:-15,height:4.6,finish:'service'},
  {id:'b-link-return',name:'柱廊の折り返し店舗',minX:23,maxX:31,minZ:-15,maxZ:-6,height:4.6,finish:'dining'},
  {id:'mid-newsstand',name:'駅前書店',minX:-17,maxX:4,minZ:33,maxZ:39,height:4.4,finish:'news'},
  {id:'mid-service-frontage',name:'案内広場のサービス窓口',minX:6,maxX:17,minZ:-4,maxZ:1,height:4.4,finish:'service'},
];
export const TACTICAL_PROP_MOVES = [
  {id:'a-entry-planter',kind:'planter',from:{x:-51,z:35},to:{x:-71,z:48}},
  {id:'bus-court-bench',kind:'bench',from:{x:-49,z:30.3},to:{x:-73,z:31}},
  {id:'a-link-planter',kind:'planter',from:{x:-49,z:-6},to:{x:-31,z:4}},
  {id:'b-delivery-crate',kind:'crate',from:{x:60,z:28},to:{x:75,z:42}},
  {id:'mid-entry-crate',kind:'crate',from:{x:-7.8,z:37},to:{x:-10,z:54}},
  {id:'b-entry-planter',kind:'planter',from:{x:17,z:-2},to:{x:70,z:51}},
];
export function createTacticalMetadata() {
  const lanes=[
    {id:'bus',name:'A / バス待合・喫茶中庭',points:points([[-48,53],[-66,47],[-66,26],[-51,22],[-46,7],[-46,-5],[-47,-20],[-38,-23]])},
    {id:'mid',name:'ミッド / 案内広場',points:points([[0,52],[10,44],[10,29],[12,24],[12,4.5],[-11,4.5],[-22,-1],[-24,-20]])},
    {id:'mewe',name:'B / 配送路・ミウィ中庭',points:points([[53,53],[68,47],[68,28],[56,27],[53,17],[53,3],[50,-4],[43,-7]])},
  ];
  const callouts=[
    ['a-site','A / 北口コンコース',-46,-27,-28,-13,-.1,2.7,-38,-17],
    ['b-site','B / ミウィ前広場',31,48,-15,1,-.1,2.7,43,-1],
    ['a-main','A メイン',-51,-43,-28,24,-.1,2.7,-47,8],
    ['a-court','喫茶中庭',-69,-43,3,29,-.1,2.7,-54,25],
    ['a-approach','バス通り入口',-79,-43,42,58,-.1,2.7,-61,52],
    ['bus-waiting','バス待合',-79,-58,-27,-4,-.1,2.7,-65,-13],
    ['a-link','A 連絡路',-27,-13.5,-27.5,7,-.1,2.7,-22,-5],
    ['b-delivery','配送折返し',43,80,24,30,-.1,2.7,57,27],
    ['b-court','ミウィ中庭',45,69,-7,20,-.1,2.7,56,9],
    ['b-approach','ミウィ通り入口',43,79,42,59,-.1,2.7,62,53],
    ['b-link','B 連絡路',17,38,-6,7,-.1,2.7,25,3],
    ['mid-turn','書店の角',4,17,25,44,-.1,2.7,10,35],
    ['mid-crossing','中央分岐',-17,23,1,7,-.1,2.7,0,4.5],
    ['rotation','駅前連絡通路',-66,47,-33,-28,-.1,2.7,17,-30],
    ['station','北口コンコース',-28,-13.5,-64,-33,-.1,5.1,-20.75,-45],
    ['west-stair','西連絡階段',-72,-67,-28,-10,-.1,3.3,-69.5,-19],
    ['east-stair','東連絡階段',70,75,-8,14,-.1,3.3,72.5,4],
    ['west-deck','2F / 北口デッキ',-72,15,-33,-28,2.7,5,-45,-30.5],
    ['east-deck','2F / ミウィデッキ',48,76,-19.3,-8,2.7,5,62,-11.5],
  ].map(([id,name,minX,maxX,minZ,maxZ,minY,maxY,x,z])=>({id,name,polygon:rect(minX,maxX,minZ,maxZ),minY,maxY,label:{x,z}}));
  const entrances={A:[{id:'a-main',x:-47,z:-20},{id:'a-link',x:-24,z:-20}],B:[{id:'b-main',x:50,z:-4},{id:'b-link',x:30,z:0}]};
  const connectors=[
    {id:'mid-a',name:'A 連絡路',points:points([[12,4.5],[-11,4.5],[-22,-1],[-24,-20],[-30,-20]])},
    {id:'mid-b',name:'B 連絡路',points:points([[12,4.5],[22,4.5],[30,0],[36,-2]])},
    {id:'defender-rotation',name:'駅前連絡通路',points:points([[-34,-31],[-11,-31],[18,-30.5],[20,-22],[19,-4],[22,4.5],[30,0]])},
  ];
  return {lanes,callouts,layout:{version:3,divider:{minX:-7,maxX:15,minZ:-28,maxZ:-3},siteEntries:{A:{x:-24,z:-16},B:{x:24,z:-2}},entrances,connectors,rotationEnds:[{x:8,z:-29.3},{x:4,z:4.5}],protectedPockets:[{site:'A',x:-35.6,z:-25.2,approach:{x:-35.6,z:-14}},{site:'B',x:39,z:-12,approach:{x:39,z:0}}],propMoves:TACTICAL_PROP_MOVES.map(move=>({...move,from:{...move.from},to:{...move.to}})),sightlineChecks:{blocked:[{id:'a-old-long',from:{x:-54.5,z:53},to:{x:-54.5,z:-15}},{id:'b-old-long',from:{x:53,z:53},to:{x:53,z:-5}},{id:'mid-old-long',from:{x:-11,z:52},to:{x:-11,z:-1}}],clear:[{id:'a-final',from:{x:-46,z:-5},to:{x:-47,z:-20}},{id:'b-final',from:{x:53,z:17},to:{x:50,z:-4}},{id:'west-underpass',from:{x:-50,z:-26},to:{x:-50,z:-32.4}},{id:'east-underpass',from:{x:68,z:-6},to:{x:68,z:-15.7}}]}}};
}
