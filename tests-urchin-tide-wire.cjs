const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');const source=fs.readFileSync(path.join(__dirname,'tests-online.cjs'),'utf8'),anchor='      const cameraPool=createCharacterSkills();';if(!source.includes(anchor))throw Error('Bounded transport fixture missing');
const addition=String.raw`
      const tidePool=createCharacterSkills(),tideActors=Array.from({length:10},(_,i)=>({...player,id:'owner'.padEnd(62,'o')+String(i).padStart(2,'0'),team:i?'red':'blue',x:0,y:0,z:i?-10:0,hp:100,alive:true}));
      for(let i=0;i<20;i++)assert.ok(tidePool.cast('urchin-disarm',tideActors[0],{...tideActors[1],targetId:tideActors[1].id,weaponId:'spectre'},now-.45,1));
      const tideState=tidePool.snapshot();tideState.events=tideState.events.map((e,i)=>({...e,id:'skill-urchin-disarm-'+(999999999999980+i),disarm:[1,999999999999980+i]}));
      tideState.tide=tideActors.map(a=>[a.id,a.team==='blue'?1:0,Math.floor((now-.7)*1000),Math.floor((now-.1)*1000)]);
      const tideDrops=Array.from({length:32},(_,i)=>({id:999999999999980+i,weapon:'spectre',x:-79.123,y:9.123,z:81.123,yaw:6.123456789,ammo:30,reserve:120,motion:[-8112,932,8112,Math.floor(now*1000),200,-8112,8112,912]}));
      const tideFull={...renkoFull,drops:tideDrops,ordinarySkills:{...renkoFull.ordinarySkills,...tideState}};assert.ok(createCharacterSkills().restore(tideState,now,1));
      const tideFit=fitTrafficSnapshot(tideFull);assert.ok(tideFit,'all gameplay states must fit');assert.deepEqual(tideFit.actors,tideFull.actors);assert.deepEqual(tideFit.ordinarySkills,tideFull.ordinarySkills);assert.deepEqual(tideFit.drops,tideDrops);assert.ok(Buffer.byteLength(JSON.stringify(tideFit))<=65536);clock+=200;assert.equal((await send(host,'team:red','game',tideFit)).status,201);console.log('TIDE10/slow10/Q20/maxID/32pull drops/10actors/fullbus '+Buffer.byteLength(JSON.stringify(tideFit))+'B /65536B');
`;
const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(source.replace(anchor,addition+anchor),__filename);
