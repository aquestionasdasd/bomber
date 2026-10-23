const assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),path=require('node:path');
for(const fault of['floor','local','remote','barrier']){
 const p=spawnSync(process.execPath,[path.join(__dirname,'tests-round-preparation-game.cjs')],{cwd:__dirname,env:{...process.env,PREPARATION_FAULT:fault},encoding:'utf8',timeout:90000});
 const out=(p.stdout||'')+(p.stderr||'');assert.equal(p.status,1,fault+out.slice(-1200));assert.match(out,/AssertionError/);assert.doesNotMatch(out,/SyntaxError|ReferenceError|Mutation anchor missing/);console.log('PASS: '+fault+' memory fault detected');
}
