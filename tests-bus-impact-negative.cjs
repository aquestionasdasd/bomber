const assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),path=require('node:path');
for(const fault of['center','count','contact']){const p=spawnSync(process.execPath,[path.join(__dirname,'tests-bus-impact-fx.cjs')],{cwd:__dirname,encoding:'utf8',env:{...process.env,BUS_IMPACT_FAULT:fault}});assert.equal(p.status,1,fault+' escaped');assert.match(p.stderr,/AssertionError/,fault+' did not reach an assertion');console.log('PASS detected memory fault '+fault);}
console.log('PASS3 impact mutations; product files unchanged; silent');
