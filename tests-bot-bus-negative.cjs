const assert=require('node:assert/strict'),path=require('node:path'),{spawnSync}=require('node:child_process');
for(const fault of['update','escape','teleport']){
 const result=spawnSync(process.execPath,[path.join(__dirname,'tests-bot-bus-navigation.cjs')],{cwd:__dirname,encoding:'utf8',env:{...process.env,BUS_NAV_FAULT:fault}});
 assert.equal(result.status,1,fault+' was not caught');assert.match(result.stderr,/AssertionError/,fault+' did not reach a behavior assertion');assert.doesNotMatch(result.stderr,/Mutation anchor|Unknown fault|SyntaxError|ReferenceError/);
 console.log('PASS memory fault caught: '+fault);
}
console.log('PASS 3 memory faults; source files unchanged; audio inert');
