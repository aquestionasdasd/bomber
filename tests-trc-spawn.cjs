const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixture=fs.readFileSync(path.join(__dirname,'tests-renko-game.cjs'),'utf8'),cut=fixture.indexOf(' const h=harness();');
const fault=process.argv.find(a=>a.startsWith('--fault='))?.slice(8);
const faults={escape:['p.id!==separatingOwner&&','', 'overlap'],radius:['radius=other===player?.34:.4','radius=.34','radius']};
if(fault){const[a,b]=faults[fault]||[];if(!a)throw Error('Unknown fault');const read=fs.readFileSync;fs.readFileSync=function(file,...args){let t=read.call(this,file,...args);if(String(file).replaceAll('\\','/').endsWith('/public/game.js')&&typeof t==='string'){if(!t.includes(a))throw Error('Missing fault anchor');t=t.replace(a,b);}return t;};}
const suite=String.raw`
 const h=harness();
 function setup(){h.reset();h.clearWalls();h.run("mode='play';match.phase='live';player.x=10;player.z=10;makeBot({x:0,z:0},0,'red',{id:'grass',team:'red',secondary:'classic',kit:new DuelistKit({character:'veil'})});makeBot({x:.7,z:.31},1,'red',{id:'other',team:'red',secondary:'classic',kit:new DuelistKit({character:'nope'})});var block=bots[0],other=bots[1];for(const b of bots){b.y=0;b.vy=0;b.crouch=0;b.group.rotation.y=Math.PI;}");}
 check('overlap correction moves the embedded neighbour outward, including a rotated moving cube',()=>{
  for(const hz of[20,60,144])for(const yaw of[0,Math.PI/3,Math.PI]){setup();h.sandbox.spec={hz,yaw};h.run('block.group.rotation.y=spec.yaw;var p=grassPlatforms()[0],q=grassWorld(p,.7,0);other.x=q.x;other.z=q.z;var before={x:other.x,z:other.z};for(let i=0;i<Math.ceil(spec.hz*.3);i++)separateBots(1/spec.hz)');assert.ok(h.run('Math.hypot(other.x-before.x,other.z-before.z)')>.04,'neighbour must escape '+hz+'/'+yaw);assert.ok(h.run('(grassBodyContact(block,other)?.depth||0)')<.001);}
 });
 check('radius matches BOT movement while player jump contact keeps its existing radius',()=>{
  setup();h.run('other.x=.89');assert.ok(h.run('grassBodyContact(block,other)?.depth')>.029);h.run('player.x=.89;player.z=.31');assert.equal(h.run('grassBodyContact(block,player)'),null);
 });
 check('walls and every other grass cube remain solid during the outward correction',()=>{
  setup();h.wall({x:1.35,z:.31,width:.1,depth:5,height:5});h.run('for(let i=0;i<30;i++)separateBots(1/60)');assert.ok(h.run('other.x')<=.900001);assert.ok(h.run('canStand(other.x,other.z,.4,0,1.7)'));
  setup();h.run("makeBot({x:1.7,z:0},2,'red',{id:'second',team:'red',secondary:'classic',kit:new DuelistKit({character:'veil'})});var second=bots[2];second.y=0;second.vy=0;second.group.rotation.y=Math.PI;second.planting=true;other.x=.75;for(let i=0;i<30;i++)separateBots(1/60)");assert.ok(h.run('other.x')<=.780001);assert.equal(h.run('grassBlocks(grassPlatforms().find(p=>p.id===second.id),other.x,other.z,.4,0,1.7)'),false);
 });
 check('ordinary walking cannot pass through the cube; player and committed objective worker stay fixed',()=>{
  setup();h.run('other.x=2;moveEntity(other,-3,0,.4)');assert.ok(h.run('other.x')>.91);h.run('player.x=.7;player.z=.31;other.alive=false;var before={x:player.x,z:player.z};separateBots(.05)');near(h.run('player.x'),h.run('before.x'),'player x');near(h.run('player.z'),h.run('before.z'),'player z');
  for(const action of['planting','defusing']){setup();h.sandbox.action=action;h.run('other[action]=true;var before={x:other.x,z:other.z};separateBots(.05)');near(h.run('other.x'),h.run('before.x'),'worker x');near(h.run('other.z'),h.run('before.z'),'worker z');}
 });
 check('actual TRC five attackers leave the spawn with a grass carrier at20/60/144Hz, one updatePlay per frame',()=>{
  for(const hz of[20,60,144]){const g=harness({realMap:true});g.reset();g.sandbox.hz=hz;g.run("selectArena('trc');match.startingSide='defend';match.phase='buy';match.resetSpike();spawnRound(true);match.startLive();mode='play';elapsed=10;for(const b of bots)if(b.team==='blue')b.remoteId='passive-'+b.id;var starts=bots.filter(b=>b.team==='red').map(b=>({id:b.id,x:b.x,z:b.z}));for(let frame=0;frame<20*hz;frame++)updatePlay(1/hz)");assert.equal(g.run("bots.find(b=>b.id==='red-0').kit.character"),'veil');assert.ok(g.run("bots.filter(b=>b.team==='red').every(b=>{const p=starts.find(p=>p.id===b.id);return Math.hypot(b.x-p.x,b.z-p.z)>25})"),'all attackers progress '+hz);assert.ok(g.run("bots.find(b=>b.id==='red-0').z")<30,'carrier clears spawn approach '+hz);}
 });
 console.log('PASS: '+groups+' TRC spawn groups; real updatePlay once per frame; audio inert');
}main().catch(e=>{console.error(e);process.exitCode=1;});`;
if(cut<0)throw Error('Missing harness');const instance=new Module(__filename,module);instance.filename=__filename;instance.paths=module.paths;instance._compile(fixture.slice(0,cut).replace('fn(); groups++;',`if(${JSON.stringify(faults[fault]?.[2]||'')}&&!label.startsWith(${JSON.stringify(faults[fault]?.[2]||'')}))return;fn(); groups++;`)+suite,__filename);
