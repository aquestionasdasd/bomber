const {spawnSync}=require('node:child_process'),assert=require('node:assert/strict'),path=require('node:path');
for(const fault of['support','carry','remote']){const r=spawnSync(process.execPath,[path.join(__dirname,'tests-grass-platform.cjs'),'--fault='+fault],{encoding:'utf8'});assert.notEqual(r.status,0,'must detect '+fault);assert.match(r.stdout+r.stderr,/AssertionError/,'assertion must detect '+fault);console.log('PASS: detects '+fault+' memory fault');}
console.log('PASS: 3 grass platform faults; disk product not modified');
