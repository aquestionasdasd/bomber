const assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),path=require('node:path');
for(const fault of['release','reverse','diagonal']){
 const result=spawnSync(process.execPath,[path.join(__dirname,'tests-movement-inertia.cjs')],{cwd:__dirname,env:{...process.env,MOVEMENT_FAULT:fault},encoding:'utf8',timeout:90000});
 const output=(result.stdout||'')+(result.stderr||'');
 assert.equal(result.status,1,fault+' must fail an actual movement assertion: '+output.slice(-1500));
 assert.match(output,/AssertionError/,fault+' must be detected by a behavioral assertion');
 assert.doesNotMatch(output,/SyntaxError|ReferenceError|Mutation anchor missing|Unknown fault/);
 console.log('PASS: in-memory '+fault+' fault detected; saved product unchanged');
}
