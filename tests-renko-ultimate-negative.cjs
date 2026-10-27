const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
async function main(){
 const fixture=fs.readFileSync(path.join(__dirname,'tests-renko-game.cjs'),'utf8'),cut=fixture.indexOf(" check('C arms/cancels");
 const game=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8').replace(/\r\n/g,'\n');
 const faults=[
  ['refill','const refilled=killer.kit?.awardKill();','const refilled=false;'],
  ['death','entity.alive=false;entity.renkoUltimate=null;if(entity.kit)entity.kit.renkoActive=false;','entity.alive=false;'],
  ['authority',"function damageEntity(entity,amount,killer,{firearm=false,returned=false,chain=true,skill=null,vehicle=false}={}){\n  if(isGuest())return;","function damageEntity(entity,amount,killer,{firearm=false,returned=false,chain=true,skill=null,vehicle=false}={}){"]
 ];
 const probe=`
 setup();h.run("player.kit.ultPoints=7;useAbility('x');player.kit.smoke=0;player.kit.updraft=0;player.kit.dash=0;player.kit.nextSignatureAt=99");
 if(label==='refill'){h.run('damageEntity(enemy,999,player)');assert.deepEqual(copy(h.run('[player.kit.smoke,player.kit.updraft,player.kit.dash,player.kit.nextSignatureAt]')),[2,1,1,0]);}
 if(label==='death'){h.run('damageEntity(player,999,enemy)');assert.equal(h.run('player.kit.renkoActive'),false);}
 if(label==='authority'){h.run("onlinePlaying=true;online={host:false,session:{memberId:'guest',hostId:'host'}};damageEntity(enemy,999,player)");assert.equal(h.run('enemy.hp'),100);assert.equal(h.run('player.kit.smoke'),0);}
 }module.exports=main;`;
 for(const[label,needle,replacement]of faults){
  assert.ok(game.includes(needle),label);
  for(const mutant of[false,true]){
   const read=String.raw`fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8').replace(/\r\n/g,'\n').replace(needle,replacement)`;
   const prefix=fixture.slice(0,cut).replace("fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')",read);
   const text='const label='+JSON.stringify(label)+',needle='+JSON.stringify(mutant?needle:'UNUSED')+',replacement='+JSON.stringify(replacement)+';\n'+prefix+probe;
   const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(text,__filename);
   let failed=false;try{await m.exports();}catch(e){if(e.code!=='ERR_ASSERTION')throw e;failed=true;}assert.equal(failed,mutant,label);
  }
  console.log('PASS: Renko X memory fault detected '+label);
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
