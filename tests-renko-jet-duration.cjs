const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.join(__dirname,'public'),data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
async function load(fault=''){
 const absolute=s=>s.replace(/from '(\.\/[^']+)'/g,(_,rel)=>"from '"+pathToFileURL(path.join(root,rel)).href+"'");
 let abilities=fs.readFileSync(path.join(root,'abilities.js'),'utf8'),skills=fs.readFileSync(path.join(root,'character-skills.js'),'utf8');
 if(fault==='duration'){assert.ok(abilities.includes('flightDuration:3,flightSpeed:16'));abilities=abilities.replace('flightDuration:3,flightSpeed:16','flightDuration:4,flightSpeed:16');}
 if(fault==='renew'){const a='      return true;\n    }return false;\n  }\n  return {holdRenkoJet';assert.ok(skills.includes(a));skills=skills.replace(a,'      if(e.endsAt-now<=2){e.startedAt+=2;e.triggerAt+=2;e.endsAt+=2;}return true;\n    }return false;\n  }\n  return {holdRenkoJet');}
 const url=data(absolute(abilities));skills=absolute(skills.replace("'./abilities.js'",JSON.stringify(url)));return{...(await import(url)),...(await import(data(skills)))};
}
async function verify(fault=''){
 const {createCharacterSkills,RENKO_SKILLS}=await load(fault),pool=createCharacterSkills(),actor={id:'jet',team:'blue',x:0,y:0,z:0,hp:100,alive:true},target={x:0,y:0,z:0};assert.equal(RENKO_SKILLS.flightDuration,3);
 assert.ok(pool.cast('renko-jet',actor,target,10,1));const first=pool.renkoEvent('renko-jet','jet',10);assert.equal(first.endsAt,13);
 for(let i=0;i<100;i++){const now=10+i*.029;assert.equal(pool.holdRenkoJet('jet',now,true),true);const e=pool.renkoEvent('renko-jet','jet',now);assert.equal(e.startedAt,10);assert.equal(e.endsAt,13);}
 const snapshot=JSON.parse(JSON.stringify(pool.snapshot())),guest=createCharacterSkills();assert.equal(guest.restore(snapshot,12.9,1),true);assert.equal(guest.holdRenkoJet('jet',12.9,true),false,'restored event has no host authority');assert.equal(guest.renkoEvent('renko-jet','jet',13),null);
 const bad=JSON.parse(JSON.stringify(snapshot));bad.events[0].endsAt+=1;assert.equal(createCharacterSkills().restore(bad,12.9,1),false,'extended wire lifetime rejected');assert.equal(pool.holdRenkoJet('jet',13,true),false);assert.equal(pool.renkoEvent('renko-jet','jet',13),null);assert.equal(pool.holdRenkoJet('jet',13.1,true),false,'held input cannot recreate expired event');
 const stopped=createCharacterSkills();stopped.cast('renko-jet',actor,target,10,1);assert.equal(stopped.holdRenkoJet('jet',10.1,false),false);assert.equal(stopped.renkoEvent('renko-jet','jet',10.1),null);
}
(async()=>{await verify();console.log('PASS: fixed3second host event/strict snapshot/release/no revival; no audio');for(const f of['duration','renew']){await assert.rejects(()=>verify(f),{code:'ERR_ASSERTION'});console.log('PASS detects memory-only '+f+' fault')}})().catch(e=>{console.error(e);process.exitCode=1});
