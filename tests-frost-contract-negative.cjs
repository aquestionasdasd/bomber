const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const{pathToFileURL}=require('node:url'),{spawnSync}=require('node:child_process');
const fixturePath=path.join(__dirname,'tests-character-skills.cjs'),fixture=fs.readFileSync(fixturePath,'utf8');
const engine=fs.readFileSync(path.join(__dirname,'public/character-skills.js'),'utf8').replace(/\r\n/g,'\n');
const sourceImport="await import(pathToFileURL(path.join(__dirname, 'public/character-skills.js')).href)";assert.ok(fixture.includes(sourceImport));
const faults=[
 ['stitch uses obsolete fixed flight','const endsAt = now + spec.delay + spec.tail;',"if(type==='frost-stitch'){spec.flight=.55;spec.delay=.8;} const endsAt = now + spec.delay + spec.tail;"],
 ['stitch loses its arming delay','const endsAt = now + spec.delay + spec.tail;',"if(type==='frost-stitch')spec.delay=spec.flight; const endsAt = now + spec.delay + spec.tail;"],
 ['mist lifetime changes','const endsAt = now + spec.delay + spec.tail;',"if(type==='frost-mist')spec.tail+=1; const endsAt = now + spec.delay + spec.tail;"],
 ['fixed mist radius changes even below pose tolerance','const endsAt = now + spec.delay + spec.tail;',"if(type==='frost-mist')spec.radius+=1e-9; const endsAt = now + spec.delay + spec.tail;"],
 ['FROST cast timestamps shift together','const endsAt = now + spec.delay + spec.tail;',"if(type.startsWith('frost-'))now+=1; const endsAt = now + spec.delay + spec.tail;"],
 ['stitch loses the exact inner edge','distance >= FROST_SKILLS.stitchInnerRadius - 1e-8','distance > FROST_SKILLS.stitchInnerRadius + .001'],
 ['stitch ignores cover','canReach(reachable, { ...event, x, y: projectedFloor, z }, actor)','true'],
 ['stitch joins unsupported heights','const tolerance = FROST_SKILLS.stitchHeightTolerance + 1e-8;','const tolerance = .9;'],
 ['unravel mitigation changes','return protectedNow ? 1 - (1 - raw) * FROST_SKILLS.unravelSlowFraction : raw;','return protectedNow ? 1 - (1 - raw) * (FROST_SKILLS.unravelSlowFraction+.1) : raw;'],
 ['unravel survives an airborne query',"if (event.type !== 'frost-unravel' || event.sourceId !== actor?.id) continue;\n      if (!alive || actor.team !== event.team || actor.grounded !== true)","if (event.type !== 'frost-unravel' || event.sourceId !== actor?.id) continue;\n      if (!alive || actor.team !== event.team)"],
 ['duplicate unravel snapshots are accepted','if ((groundedPersonal(event.type) ||',"if ((groundedPersonal(event.type) && event.type !== 'frost-unravel' ||"],
];
for(const[name,before,after]of faults){
 assert.equal(engine.split(before).length-1,1,'Fault must change exactly one actual expression: '+name);
 const mutated=engine.replace(before,after).replace(/from '(\.\/[a-z-]+\.js)'/g,(_,file)=>`from ${JSON.stringify(pathToFileURL(path.join(__dirname,'public',file)).href)}`);
 const scoped=fixture.replace(sourceImport,`await import(${JSON.stringify('data:text/javascript;base64,'+Buffer.from(mutated).toString('base64'))})`);
 const child=`const Module=require('node:module');process.argv.push('--through-frost');const m=new Module(${JSON.stringify(fixturePath)});m.filename=${JSON.stringify(fixturePath)};m.paths=Module._nodeModulePaths(${JSON.stringify(__dirname)});m._compile(${JSON.stringify(scoped)},m.filename);`;
 const result=spawnSync(process.execPath,['-'],{input:child,encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:512*1024});
 assert.equal(result.error?.code,undefined,'Fault subprocess failed: '+name);assert.equal(result.status,1,'Actual assertions must reject: '+name);
 assert.match(result.stderr,/AssertionError/);assert.doesNotMatch(result.stderr,/SyntaxError|ERR_MODULE_NOT_FOUND|TypeError/);
 const passed=(result.stdout.match(/^PASS: /gm)||[]).length;assert.ok(passed>=41&&passed<49,'Failure must be in FROST after all prior41 groups: '+name);
 assert.doesNotMatch(result.stdout,/Character contract prefix passed/);console.log(`PASS detects ${name} (memory only, prior${passed} groups passed)`);
}
console.log('FROST negative contract tests passed: 11 faults; product files never written.');
