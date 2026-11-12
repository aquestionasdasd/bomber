const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const{pathToFileURL}=require('node:url'),{spawnSync}=require('node:child_process');
const fixturePath=path.join(__dirname,'tests-character-skills.cjs'),fixture=fs.readFileSync(fixturePath,'utf8');
const engine=fs.readFileSync(path.join(__dirname,'public/character-skills.js'),'utf8');
const sourceImport="await import(pathToFileURL(path.join(__dirname, 'public/character-skills.js')).href)";assert.ok(fixture.includes(sourceImport));
const faults=[
 ['solder uses obsolete fixed flight','const endsAt = now + spec.delay + spec.tail;',"if(type==='ember-solder'){spec.flight=.45;spec.delay=.65;} const endsAt = now + spec.delay + spec.tail;"],
 ['solder loses its warning delay','const endsAt = now + spec.delay + spec.tail;',"if(type==='ember-solder')spec.delay=spec.flight; const endsAt = now + spec.delay + spec.tail;"],
 ['solder damage changes','solder ? EMBER_SKILLS.solderDamage : NOPE_SKILLS.bottleDamage','solder ? EMBER_SKILLS.solderDamage+1 : NOPE_SKILLS.bottleDamage'],
 ['solder damages teammates','if (actor.team === event.team || distance >= event.radius ||','if (actor.team === event.team && !solder || distance >= event.radius ||'],
 ['solder ignores cover','> CHARACTER_SKILLS.heightTolerance || !canReach(reachable, event, actor)) continue;','> CHARACTER_SKILLS.heightTolerance || !solder && !canReach(reachable, event, actor)) continue;'],
 ['solder repeats owned hits','owned.delete(id); const seen = new Set();',"if(event.type!=='ember-solder')owned.delete(id); const seen = new Set();"],
 ['shade protection factor changes','const duration = flashDuration(event.id) * (resisted ? EMBER_SKILLS.shadeFlashScale : 1);','const duration = flashDuration(event.id) * (resisted ? EMBER_SKILLS.shadeFlashScale+.1 : 1);'],
 ['service survives a weapon mismatch',"event.type !== 'ember-service' || actor.weaponId === event.weaponId","event.type !== 'ember-service' || true"],
 ['restored guests acquire solder ownership','for (const [id, event] of nextEvents) if (event.endsAt > currentTime) active.set(id, event);',"for (const [id, event] of nextEvents) if (event.endsAt > currentTime) {active.set(id,event);if(event.type==='ember-solder')owned.add(id);}"],
];
for(const[name,before,after]of faults){
 assert.equal(engine.split(before).length-1,1,'Fault must change exactly one actual expression: '+name);
 const mutated=engine.replace(before,after).replace(/from '(\.\/[a-z-]+\.js)'/g,(_,file)=>`from ${JSON.stringify(pathToFileURL(path.join(__dirname,'public',file)).href)}`);
 const scoped=fixture.replace(sourceImport,`await import(${JSON.stringify('data:text/javascript;base64,'+Buffer.from(mutated).toString('base64'))})`);
 const child=`const Module=require('node:module');process.argv.push('--through-ember');const m=new Module(${JSON.stringify(fixturePath)});m.filename=${JSON.stringify(fixturePath)};m.paths=Module._nodeModulePaths(${JSON.stringify(__dirname)});m._compile(${JSON.stringify(scoped)},m.filename);`;
 const result=spawnSync(process.execPath,['-'],{input:child,encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:512*1024});
 assert.equal(result.error?.code,undefined,'Fault subprocess failed: '+name);assert.equal(result.status,1,'Actual assertions must reject: '+name);
 assert.match(result.stderr,/AssertionError/);assert.doesNotMatch(result.stderr,/SyntaxError|ERR_MODULE_NOT_FOUND|TypeError/);
 const passed=(result.stdout.match(/^PASS: /gm)||[]).length;assert.ok(passed>=33&&passed<41,'Failure must be in legacy EMBER, after all prior33 groups: '+name);
 assert.doesNotMatch(result.stdout,/Character contract prefix passed/);console.log(`PASS detects ${name} (memory only, prior${passed} groups passed)`);
}
console.log('Legacy EMBER negative contract tests passed: 9 faults; product files never written.');
