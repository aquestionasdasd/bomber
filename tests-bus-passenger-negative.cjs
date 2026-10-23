// Exercise regressions in memory, without changing saved game or test files.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const file=path.join(__dirname,'tests-bus-passenger-game.cjs'),suite=fs.readFileSync(file,'utf8');
const read="fs.readFileSync(path.join(__dirname, 'public/game.js'), 'utf8')";
assert.ok(suite.includes(read));
for(const [name,label,anchor,replacement]of[
 ['glass blocks bullets','actual window rays','hit.object.userData.busGlass||','false||'],
 ['metal loses cover','metal body','function busSurfaceVisible(hit){','function busSurfaceVisible(hit){if(hit.object.userData.solid&&!hit.object.userData.busDriver)return false;'],
 ['opaque whole-bus sight','BOT sight','map.traffic.rayClear(','((...args)=>false)('],
]){
 const game=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8');assert.ok(game.includes(anchor),name+' anchor');
 const memory=suite.replace(read,`${read}.split(${JSON.stringify(anchor)}).join(${JSON.stringify(replacement)})`);
 const boot=`const Module=require('node:module');const m=new Module(${JSON.stringify(file)},module);m.filename=${JSON.stringify(file)};m.paths=Module._nodeModulePaths(${JSON.stringify(__dirname)});m._compile(${JSON.stringify(memory)},${JSON.stringify(file)});`;
 const result=spawnSync(process.execPath,['-e',boot],{cwd:__dirname,env:{...process.env,BUS_PASSENGER_TEST:label},encoding:'utf8'});
 assert.notEqual(result.status,0,name);assert.match(result.stderr,/AssertionError/,name+': '+result.stderr.slice(-700));console.log('PASS detects '+name);
}
console.log('PASS 3 passenger regression mutations; saved source unchanged; silent');
