const assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),path=require('node:path');
for(const fault of['center','width','early','wall']){
 const r=spawnSync(process.execPath,[path.join(__dirname,'tests-veil-root-throw.cjs'),'--fault='+fault],{encoding:'utf8',timeout:120000});
 assert.notEqual(r.status,0,'undetected '+fault);assert.match(r.stderr,/AssertionError/,'must fail behavior '+fault+' '+r.stderr);assert.doesNotMatch(r.stderr,/anchor missing|SyntaxError|ReferenceError/);console.log('PASS: memory '+fault+' fault detected');
}
