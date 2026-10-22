// Approved Cycle41 translations are the only changes permitted to the old arena.
const assert=require('node:assert/strict');
const MOVES=[
  {id:'a-entry-planter',index:33,dx:-20,dz:13,before:{minX:-53.5,maxX:-48.5,minZ:33.6,maxZ:36.4,height:1.24,base:0,kind:'planter'}},
  {id:'bus-court-bench',index:50,dx:-24,dz:31-30.3,before:{minX:-51,maxX:-47,minZ:29.775000000000002,maxZ:30.825,height:.96,base:0,kind:'bench'}},
  {id:'a-link-planter',index:34,dx:18,dz:10,before:{minX:-51.5,maxX:-46.5,minZ:-7.5,maxZ:-4.5,height:1.24,base:0,kind:'planter'}},
  {id:'b-delivery-crate',index:49,dx:15,dz:14,before:{minX:58.085884887701525,maxX:61.914115112298475,minZ:26.36095099140156,maxZ:29.63904900859844,height:1.7,base:0,kind:'crate',polygon:[[58.32562896960904,26.36095099140156],[61.914115112298475,26.648643889690582],[61.67437103039096,29.63904900859844],[58.085884887701525,29.351356110309418]]}},
  {id:'mid-entry-crate',index:46,dx:-2.2,dz:17,before:{minX:-9.604585254518,maxX:-5.995414745482001,minZ:35.53113851584802,maxZ:38.46886148415198,height:1.7,base:0,kind:'crate',polygon:[[-9.604585254518,35.671101185501236],[-6.107384881204577,35.53113851584802],[-5.995414745482001,38.328898814498764],[-9.492615118795424,38.46886148415198]]}},
  {id:'b-entry-planter',index:36,dx:53,dz:53,before:{minX:15,maxX:19,minZ:-5,maxZ:1,height:1.24,base:0,kind:'planter'}},
];
const clone=value=>JSON.parse(JSON.stringify(value));
function equalStructure(actual,expected,label){
  if(typeof expected==='number'){assert.ok(typeof actual==='number'&&Math.abs(actual-expected)<1e-9,`${label}: ${actual} != ${expected}`);return;}
  if(expected&&typeof expected==='object'){
    assert.deepEqual(Object.keys(actual).sort(),Object.keys(expected).sort(),`${label}: collider fields may not change`);
    for(const key of Object.keys(expected))equalStructure(actual[key],expected[key],`${label}.${key}`);
    return;
  }
  assert.equal(actual,expected,label);
}
function normalizedLegacyColliders(colliders){
  assert.ok(colliders.length>=189,'The ten new buildings append after the179 old physical shapes');
  const legacy=colliders.slice(0,179).map(clone);
  for(const move of MOVES){
    const translated=clone(move.before);
    for(const key of ['minX','maxX'])translated[key]+=move.dx;
    for(const key of ['minZ','maxZ'])translated[key]+=move.dz;
    if(translated.polygon)translated.polygon=translated.polygon.map(([x,z])=>[x+move.dx,z+move.dz]);
    equalStructure(legacy[move.index],translated,move.id);
    legacy[move.index]=clone(move.before);
  }
  return legacy;
}
function legacyInstanceTranslations(mesh,seen){
  const translations=new Map();
  for(const item of mesh.userData.legacyPropMoves||[]){
    const approved=MOVES.find(move=>move.id===item.id);
    assert.ok(approved,`Unknown old-world move ${item.id}`);
    assert.equal(item.dx,approved.dx);assert.equal(item.dz,approved.dz);
    assert.ok(Number.isSafeInteger(item.start)&&item.start>=0&&Number.isSafeInteger(item.count)&&item.count>0&&item.start+item.count<=mesh.count);
    assert.ok(Array.isArray(item.originalPositions)||ArrayBuffer.isView(item.originalPositions),'Exact old Float32 positions must be retained, rather than reconstructed by subtraction');
    assert.equal(item.originalPositions.length,item.count);
    seen.add(item.id);
    for(let offset=0;offset<item.count;offset++){
      const index=item.start+offset,old=Array.from(item.originalPositions[offset]);
      assert.equal(old.length,3);
      assert.equal(translations.has(index),false,'Two prop records cannot normalize the same instance');
      assert.ok(old.every(Number.isFinite));
      const matrix=mesh.instanceMatrix.array.subarray(index*16,(index+1)*16);
      assert.ok(Math.abs(matrix[12]-Math.fround(old[0]+item.dx))<1e-5&&Math.abs(matrix[14]-Math.fround(old[2]+item.dz))<1e-5,'Moved rendered props must use their declared physical translation');
      assert.equal(matrix[13],old[1],'Prop movement may not alter elevation');
      translations.set(index,old);
    }
  }
  return translations;
}
module.exports={MOVES,normalizedLegacyColliders,legacyInstanceTranslations};
