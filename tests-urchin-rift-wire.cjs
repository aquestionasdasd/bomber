const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const source=fs.readFileSync(path.join(__dirname,'tests-online.cjs'),'utf8'),anchor='      const cameraPool=createCharacterSkills();';if(!source.includes(anchor))throw Error('Bounded transport fixture missing');
const addition=String.raw`
      const riftPool=createCharacterSkills(),riftActors=Array.from({length:10},(_,i)=>({...player,id:'owner'.padEnd(62,'o')+String(i).padStart(2,'0'),team:i?'red':'blue',x:i?2:0,y:0,z:i?-10:0,hp:100,alive:true,grounded:true}));
      for(let i=0;i<20;i++)assert.ok(riftPool.cast('urchin-lance',riftActors[0],{x:0,y:1.7,z:-40},now-.65,1));
      riftPool.update(riftActors,now,1,{reachable:()=>true,lanceGroundHeight:()=>0});for(const a of riftActors.slice(1))a.x=-2;
      riftPool.update(riftActors,now+.01,1,{reachable:()=>true,lanceGroundHeight:()=>0});
      const riftState=riftPool.snapshot(),riftFull={...renkoFull,ordinarySkills:{...renkoFull.ordinarySkills,...riftState}};
      assert.equal(riftState.rifts.length,20);assert.equal(riftState.events.length,20);assert.ok(riftState.events.every(e=>Object.keys(e).length===16));assert.ok(riftState.rifts.every(r=>r.length===7));assert.ok(createCharacterSkills().restore(riftFull.ordinarySkills,now+.01,1));
      const riftFitted=fitTrafficSnapshot(riftFull);assert.ok(riftFitted);assert.deepEqual(riftFitted.actors,riftFull.actors);assert.deepEqual(riftFitted.ordinarySkills,riftFull.ordinarySkills);assert.ok(Buffer.byteLength(JSON.stringify(riftFitted))<=65536);
      clock+=200;assert.equal((await send(host,'team:red','game',riftFitted)).status,201);console.log('RIFT20 /10x64char actors/20x7int pulses/full bus '+Buffer.byteLength(JSON.stringify(riftFitted))+'B /65536B');
`;
const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(source.replace(anchor,addition+anchor),__filename);
