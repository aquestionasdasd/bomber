const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function run(){
 const fixture=fs.readFileSync(path.join(__dirname,'tests-car-game.cjs'),'utf8'),cut=fixture.indexOf('  const local=harness();');
 let current=['',''];const anchors=[
 ['damage',"beginCarMotion(target,{id:effect.eventId,phase:4","damageEntity(target,1,source);beginCarMotion(target,{id:effect.eventId,phase:4"],
 ['altitude','Math.min(11,e.y+RENKO_SKILLS.flightHeight)','Infinity'],
 ['rollback',"if(!predict&&!ordinarySkills.cast(effect,ordinaryActorView(actor),target,elapsed,match.round)){actor.kit.restore(before);return;}\n if(predict&&key!=='c')","if(!predict)ordinarySkills.cast(effect,ordinaryActorView(actor),target,elapsed,match.round);\n if(predict&&key!=='c')"]
 ];
 const probe=`
 const h=harness();h.reset();h.clearWalls();h.run("player.kit=new DuelistKit({character:'renko'});player.kit.smoke=2;player.kit.updraft=1;match.phase='live';makeBot({x:0,z:-12},0,'red',{id:'enemy',team:'red',credits:800,secondary:'classic',kit:new DuelistKit({character:'nope'})});var enemy=bots[0];enemy.remoteId='passive';enemy.hp=100;enemy.armor=50");
 if(label==='damage'){h.run("activateAbility(player,'c');for(let i=0;i<20;i++)updatePlay(1/60)");assert.equal(h.run('enemy.hp+enemy.armor'),150);}
 if(label==='altitude'){h.run("keys.add('Space');activateAbility(player,'e');for(let i=0;i<180;i++)updatePlay(1/60)");assert.ok(h.run('player.y')<=11.001);}
 if(label==='rollback'){h.run("for(let i=0;i<20;i++)ordinarySkills.cast('onnara-chain',{...ordinaryActorView(player),id:'s'+i},ordinaryActorView(player),elapsed,match.round);activateAbility(player,'e')");assert.equal(h.run('player.kit.dash'),1);}
 }module.exports=main;`;
 const product=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8');
 for(const [label,needle,replacement]of anchors){assert.ok(product.includes(needle),label);for(const mutant of[false,true]){let base=fixture.slice(0,cut).replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')",'fs.readFileSync(path.join(__dirname, \'public/game.js\'), \'utf8\').replace(needle,replacement)');if(mutant&&label==='rollback')base=base.replace("'utf8').replace(needle,replacement)","'utf8').replace(needle,replacement).replace('if(!target||ordinarySkills.events(elapsed).length>=CHARACTER_SKILLS.maxEvents)return;','if(!target)return;')");const source='const label='+JSON.stringify(label)+',needle='+JSON.stringify(mutant?needle:'UNUSED')+',replacement='+JSON.stringify(replacement)+';\n'+base+probe;const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(source,__filename);let failed=false;try{await m.exports();}catch(e){if(e.code!=='ERR_ASSERTION')throw e;failed=true;}assert.equal(failed,mutant,label);}console.log('PASS memory fault detected: '+label);}
 const {renkoDriveMotion}=await import(require('node:url').pathToFileURL(path.join(__dirname,'public/renko-motion.js')).href),a={alive:true,team:'blue',vx:0,vz:-12},event={id:'q',team:'blue',endsAt:8};renkoDriveMotion(a,event,1,.01,{x:0,z:-1,crouch:true});const turned=renkoDriveMotion(a,event,1.1,.1,{x:1,z:0,crouch:true});assert.ok(Math.abs(turned.x)<3&&turned.z<-10);console.log('PASS limited slide steering and jump exit contract');
}run().catch(e=>{console.error(e);process.exitCode=1;});
