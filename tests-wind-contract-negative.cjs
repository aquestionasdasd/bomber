const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{spawnSync}=require('node:child_process');
const fixturePath=path.join(__dirname,'tests-character-skills.cjs'),fixture=fs.readFileSync(fixturePath,'utf8');
const engine=fs.readFileSync(path.join(__dirname,'public/character-skills.js'),'utf8').replace(/\r\n/g,'\n');
const throwSource=fs.readFileSync(path.join(__dirname,'public/skill-throw.js'),'utf8').replace(/\r\n/g,'\n');
const sourceImport="await import(pathToFileURL(path.join(__dirname, 'public/character-skills.js')).href)";assert.ok(fixture.includes(sourceImport));
const at='const endsAt = now + spec.delay + spec.tail;';
const faults=[
 ['obsolete fixed comet flight',at,"if(type==='duelist-comet'){spec.flight=.25;spec.delay=.25;} "+at],
 ['comet field lifetime changes',at,"if(type==='duelist-comet')spec.tail+=1; "+at],
 ['fixed radius changes below pose tolerance',at,"if(type==='duelist-comet')spec.radius+=1e-9; "+at],
 ['requested cast timestamp shifts',at,"if(type==='duelist-comet')now+=1; "+at],
 ['range becomes horizontal only','Math.hypot(target.x - actor.x, target.y - sourceEyeY, target.z - actor.z)','Math.hypot(target.x - actor.x, target.z - actor.z)'],
 ['crouch eye height is ignored','fromY: feetSource(type) ? actor.y || 0 : eyeY(actor)',"fromY: feetSource(type) ? actor.y || 0 : type==='duelist-comet'?(actor.y||0)+1.7:eyeY(actor)"],
 ['comet loses its physical arc','if(isLobbedSkill(event.type))return throwPosition(event,now);',"if(isLobbedSkill(event.type)){const p=throwPosition(event,now);if(event.type==='duelist-comet')p.y=event.fromY+(event.y-event.fromY)*t;return p;}"],
 ['restore adds eye height twice','}, value, value.fromY)','}, value)'],
 ['forged comet fields accepted','if ((isLobbedSkill(value.type) ||',"if (value.type!=='duelist-comet' && (isLobbedSkill(value.type) ||"],
 ['capacity bypass for WIND','active.size >= CHARACTER_SKILLS.maxEvents',"active.size >= CHARACTER_SKILLS.maxEvents && !type.startsWith('duelist-')"],
 ['lift gains a grounded gate',at,"if(type==='duelist-lift'&&actor.grounded!==true)return null; "+at],
 ['passive lift mutates actor impulse',at,"if(type==='duelist-lift')actor.vy=7.8; "+at],
 ['over-speed comet flight accepted','return [vx,vy,vz].every(Number.isFinite)&&Math.hypot(vx,vy,vz)<=SKILL_THROW.speed+SKILL_THROW.lift+1e-6;',"return [vx,vy,vz].every(Number.isFinite)&&(e.type==='duelist-comet'||Math.hypot(vx,vy,vz)<=SKILL_THROW.speed+SKILL_THROW.lift+1e-6);",'throw'],
 ['rejected WIND consumes an ID','active.size >= CHARACTER_SKILLS.maxEvents',"(active.size >= CHARACTER_SKILLS.maxEvents && (type.startsWith('duelist-')?(++sequence,true):true))"],
];
for(const [name,before,after,kind]of faults){
 const original=kind==='throw'?throwSource:engine;assert.equal(original.split(before).length-1,1,'Exactly one real expression: '+name);
 const changed=original.replace(before,after),throwModule=kind==='throw'?'data:text/javascript;base64,'+Buffer.from(changed).toString('base64'):null;
 const mutated=(kind==='throw'?engine:changed).replace(/from '(\.\/[a-z-]+\.js)'/g,(_,file)=>`from ${JSON.stringify(file==='./skill-throw.js'&&throwModule?throwModule:pathToFileURL(path.join(__dirname,'public',file)).href)}`);
 const scoped=fixture.replace(sourceImport,`await import(${JSON.stringify('data:text/javascript;base64,'+Buffer.from(mutated).toString('base64'))})`);
 const child=`const Module=require('node:module');const m=new Module(${JSON.stringify(fixturePath)});m.filename=${JSON.stringify(fixturePath)};m.paths=Module._nodeModulePaths(${JSON.stringify(__dirname)});m._compile(${JSON.stringify(scoped)},m.filename);`;
 const result=spawnSync(process.execPath,['-'],{input:child,encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:512*1024});
 assert.equal(result.error?.code,undefined,'Fault subprocess failure: '+name);assert.equal(result.status,1,'Assertions must reject: '+name);
 assert.match(result.stderr,/AssertionError/);assert.doesNotMatch(result.stderr,/SyntaxError|ERR_MODULE_NOT_FOUND|TypeError/);
 const passed=(result.stdout.match(/^PASS: /gm)||[]).length;assert.ok(passed>=49&&passed<55,'Must fail in WIND after prior49: '+name);
 assert.doesNotMatch(result.stdout,/Character skill tests passed/);console.log(`PASS detects ${name} (memory only, prior${passed} groups passed)`);
}
console.log('WIND negative contract tests passed: 14 faults; product files never written.');
