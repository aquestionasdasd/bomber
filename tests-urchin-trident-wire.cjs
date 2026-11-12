const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');const source=fs.readFileSync(path.join(__dirname,'tests-urchin-tide-wire.cjs'),'utf8');
const anchor="const tideFull={...renkoFull,drops:tideDrops,ordinarySkills:";if(!source.includes(anchor))throw Error('Maximum snapshot fixture missing');
const patched=source.replace(anchor,"const tideFull={...renkoFull,actors:renkoFull.actors.map(a=>({...a,focus:true})),drops:tideDrops,ordinarySkills:").replace('TIDE10/slow10/Q20/maxID/32pull drops/10actors/fullbus','Xfocus10 + TIDE10/slow10/Q20/maxID/32pull drops/10actors/fullbus');
const m=new Module(__filename,module);m.filename=__filename;m.paths=module.paths;m._compile(patched,__filename);
