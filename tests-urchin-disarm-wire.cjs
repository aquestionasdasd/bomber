const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');const source=fs.readFileSync(path.join(__dirname,'tests-online.cjs'),'utf8'),anchor='      const cameraPool=createCharacterSkills();';if(!source.includes(anchor))throw Error('Bounded transport fixture missing');
const addition=String.raw`
      const qPool=createCharacterSkills(),qActors=Array.from({length:10},(_,i)=>({...player,id:'owner'.padEnd(62,'o')+String(i).padStart(2,'0'),team:i?'red':'blue',x:0,y:0,z:i?-10:0,hp:100,alive:true}));
      for(let i=0;i<20;i++)assert.ok(qPool.cast('urchin-disarm',qActors[0],{...qActors[1],targetId:qActors[1].id,weaponId:'spectre'},now-1,1));
      const qState=qPool.snapshot();qState.events=qState.events.map((e,i)=>({...e,id:'skill-urchin-disarm-'+(999999999999980+i),targetId:qActors[1].id,weaponId:'spectre',disarm:[1,999999999999980+i]}));
      const qDrops=Array.from({length:32},(_,i)=>({id:999999999999980+i,weapon:'spectre',x:-81.123,y:9.123,z:81.123,yaw:6.123456789,ammo:30,reserve:120,motion:[-8112,932,8112,Math.floor(now*1000),200]}));
      const qFull={...renkoFull,drops:qDrops,ordinarySkills:{...renkoFull.ordinarySkills,...qState}};assert.ok(createCharacterSkills().restore(qState,now,1));
      const qFit=fitTrafficSnapshot(qFull);assert.ok(qFit);assert.deepEqual(qFit.actors,qFull.actors);assert.deepEqual(qFit.ordinarySkills,qFull.ordinarySkills);assert.deepEqual(qFit.drops,qDrops);assert.ok(Buffer.byteLength(JSON.stringify(qFit))<=65536);clock+=200;assert.equal((await send(host,'team:red','game',qFit)).status,201);console.log('Q20/maxID/32flying drops/10actors/fullbus '+Buffer.byteLength(JSON.stringify(qFit))+'B /65536B');
`;
const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(source.replace(anchor,addition+anchor),__filename);
