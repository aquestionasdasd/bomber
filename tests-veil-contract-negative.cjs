const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{spawnSync}=require('node:child_process');
const fixturePath=path.join(__dirname,'tests-character-skills.cjs'),fixture=fs.readFileSync(fixturePath,'utf8');
const engine=fs.readFileSync(path.join(__dirname,'public/character-skills.js'),'utf8');
const sourceImport="await import(pathToFileURL(path.join(__dirname, 'public/character-skills.js')).href)";
assert.ok(fixture.includes(sourceImport));
const faults=[
 ['dust ends at the obsolete seven-second duration','tail: VEIL_SKILLS.dustDuration','tail: 7'],
 ['dust arming delay changes','delay: VEIL_SKILLS.dustArmDelay','delay: .3'],
 ['dust radius changes','radius: VEIL_SKILLS.dustRadius','radius: 4'],
 // Both the general slow loop and its read-only predicate reject teammates.
 ['legacy roots slow teammates',["!['veil-roots','veil-root-seed'].includes(event?.type) || actor.team === event.team",'if (actor.team === event.team || currentTime < event.triggerAt) continue;'],["!['veil-roots','veil-root-seed'].includes(event?.type)",'if (currentTime < event.triggerAt) continue;']],
 ['legacy roots slow airborne actors',"!living(actor) || actor.grounded !== true || !['veil-roots','veil-root-seed'].includes(event?.type)","!living(actor) || !['veil-roots','veil-root-seed'].includes(event?.type)"],
 ['legacy roots ignore cover','&&canReach(reachable, { ...event, x, y: floor, z }, actor);',';'],
 ['turf survives an airborne movement query','if (groundedPersonal(event.type) && (!alive || actor.team !== event.team || actor.grounded !== true))','if (groundedPersonal(event.type) && (!alive || actor.team !== event.team))'],
 ['current Q loses its residual lifetime','tail:ROOT_SENSOR.duration+ROOT_SENSOR.linger','tail:ROOT_SENSOR.duration'],
];
for(const[name,before,after]of faults){
 const changes=Array.isArray(before)?before.map((old,i)=>[old,after[i]]):[[before,after]];
 let mutated=engine;for(const[old,replacement]of changes){assert.equal(mutated.split(old).length-1,1,'Each fault edit must change exactly one actual expression: '+name);mutated=mutated.replace(old,replacement);}
 mutated=mutated.replace(/from '(\.\/[a-z-]+\.js)'/g,(_,file)=>`from ${JSON.stringify(pathToFileURL(path.join(__dirname,'public',file)).href)}`);
 const scoped=fixture.replace(sourceImport,`await import(${JSON.stringify('data:text/javascript;base64,'+Buffer.from(mutated).toString('base64'))})`);
 const child=`const Module=require('node:module');process.argv.push('--through-veil');const m=new Module(${JSON.stringify(fixturePath)});m.filename=${JSON.stringify(fixturePath)};m.paths=Module._nodeModulePaths(${JSON.stringify(__dirname)});m._compile(${JSON.stringify(scoped)},m.filename);`;
 const result=spawnSync(process.execPath,['-'],{input:child,encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:512*1024});
 assert.equal(result.error?.code,undefined,'Fault subprocess failed: '+name);assert.equal(result.status,1,'Actual assertions must reject: '+name);
 assert.match(result.stderr,/AssertionError/);assert.doesNotMatch(result.stderr,/SyntaxError|ERR_MODULE_NOT_FOUND|TypeError/);
 const passed=(result.stdout.match(/^PASS: /gm)||[]).length;assert.ok(passed>=25&&passed<33,'The failure must be in VEIL, after all prior25 groups: '+name);
 assert.doesNotMatch(result.stdout,/Character contract prefix passed/);
 console.log(`PASS detects ${name} (memory only, prior${passed} groups passed)`);
}
console.log('VEIL negative contract tests passed: 8 faults; product files never written.');
