const assert=require('node:assert/strict'),path=require('node:path'),{spawnSync}=require('node:child_process');
for(const fault of['local','host','visual']){
 const result=spawnSync(process.execPath,[path.join(__dirname,'tests-renko-unarmed.cjs'),'--fault='+fault],{encoding:'utf8'});
 assert.notEqual(result.status,0,fault+' must be detected');assert.match(result.stdout+result.stderr,/AssertionError/);assert.doesNotMatch(result.stdout+result.stderr,/Missing fault anchor|SyntaxError|ReferenceError/);
 console.log('PASS: detected in-memory '+fault+' regression; disk source untouched');
}
