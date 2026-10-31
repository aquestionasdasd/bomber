const{spawnSync}=require('node:child_process'),assert=require('node:assert/strict'),path=require('node:path');
for(const fault of['contact','assist','authority','approach']){const r=spawnSync(process.execPath,[path.join(__dirname,'tests-grass-jump.cjs'),'--fault='+fault],{encoding:'utf8'});assert.notEqual(r.status,0,'must detect '+fault);assert.match(r.stdout+r.stderr,/AssertionError/,'assertion detects '+fault);console.log('PASS: detects '+fault+' memory fault');}
console.log('PASS: 4 grass jump faults; product disk unchanged');
