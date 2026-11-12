const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const source=fs.readFileSync(path.join(__dirname,'tests-online.cjs'),'utf8'),anchor='      const cameraPool=createCharacterSkills();';
if(!source.includes(anchor))throw Error('Bounded transport fixture missing');
const addition=String.raw`
      const rootPool=createCharacterSkills(),rootActors=Array.from({length:10},(_,i)=>({...player,id:'owner'.padEnd(62,'o')+String(i).padStart(2,'0'),team:i?'red':'blue',x:-22+i/20,y:0,z:33,hp:100,alive:true,grounded:true}));
      for(let i=0;i<20;i++)assert.ok(rootPool.cast('veil-sensor',rootActors[0],{x:-22,y:.12,z:33,flight:1},now-1,1));
      rootPool.update(rootActors,now,1,{reachable:()=>true,groundHeight:()=>0});
      const rootState=rootPool.snapshot(),rootFull={...renkoFull,ordinarySkills:{...renkoFull.ordinarySkills,...rootState}};
      assert.equal(rootState.roots.length,9);assert.equal(rootState.events.length,20);assert.ok(createCharacterSkills().restore(rootFull.ordinarySkills,now,1));
      const rootFitted=fitTrafficSnapshot(rootFull);assert.ok(rootFitted);assert.deepEqual(rootFitted.actors,rootFull.actors);assert.deepEqual(rootFitted.ordinarySkills,rootFull.ordinarySkills);assert.ok(Buffer.byteLength(JSON.stringify(rootFitted))<=65536);
      clock+=200;assert.equal((await send(host,'team:red','game',rootFitted)).status,201);console.log('ROOT20 /10x64char actors/9contacts/full bus '+Buffer.byteLength(JSON.stringify(rootFitted))+'B /65536B');
`;
const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(source.replace(anchor,addition+anchor),__filename);
