// Add the new legal Cap payload to the existing full bus/actor/effect fixture.
// The underlying test uses real SQLite and the saved game serializer.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const source=fs.readFileSync(path.join(__dirname,'tests-online.cjs'),'utf8'),anchor='      const cameraPool=createCharacterSkills();';
if(!source.includes(anchor))throw Error('Bounded transport fixture missing');
const addition=String.raw`
      for(const type of ['cap-lens','cap-bank-grenade','cap-magazine-grenade','cap-cluster-damage']){
        const pool=createCharacterSkills(),owners=Array.from({length:10},(_,i)=>({...player,id:'owner'.padEnd(62,'o')+String(i).padStart(2,'0'),team:i>0&&(type==='cap-lens'||type==='cap-cluster-damage')?'red':'blue',x:-22,y:0,z:33,hp:100,alive:true}));
        const source={...owners[0],team:'blue'};
        for(let i=0;i<20;i++)assert.ok(pool.cast(type,source,{x:-22,y:.12,z:33,flight:1},now-1.22,1));
        pool.update(owners,now,1,{reachable:()=>true});
        const state=pool.snapshot(),full={...renkoFull,ordinarySkills:{...renkoFull.ordinarySkills,...state}};
        assert.equal(state.events.length,20);assert.ok(state.events.every(e=>e.hits?.length>0));
        assert.ok(createCharacterSkills().restore(full.ordinarySkills,now,1),type+' strict compact restore');
        const fitted=fitTrafficSnapshot(full);assert.ok(fitted,type+' authority fits without dropping events');assert.deepEqual(fitted.actors,full.actors);assert.deepEqual(fitted.ordinarySkills,full.ordinarySkills);assert.ok(Buffer.byteLength(JSON.stringify(fitted))<=65536);
        clock+=200;assert.equal((await send(host,'team:red','game',fitted)).status,201);console.log('CAP20 '+type+' /10x64char targets/full bus/actors '+Buffer.byteLength(JSON.stringify(fitted))+'B /65536B');
      }
`;
const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(source.replace(anchor,addition+anchor),__filename);
