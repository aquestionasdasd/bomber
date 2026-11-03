const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{spawnSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
async function main(){const url=f=>pathToFileURL(path.join(__dirname,'public',f)).href,load=f=>import(url(f));const bases=['24d87998f3334706d597479c4873403c8a917cc9','1abb735ab4d36187458830379ca96820f2ceabe0'];
 function original(file){for(const base of bases){const p=spawnSync('git',['show',base+':public/'+file],{cwd:__dirname,encoding:'utf8',windowsHide:true});if(p.status===0)return p.stdout;}throw Error('Pinned pre-C baseline missing');}
 const moduleFrom=s=>import('data:text/javascript;base64,'+Buffer.from(s.replace(/(['"])\.\/([^'"]+\.js)\1/g,(_,q,f)=>JSON.stringify(url(f)))).toString('base64'));
 const old=await moduleFrom(original('abilities.js')),current=await load('abilities.js');for(const id of Object.keys(old.CHARACTER_DEFS)){if(id!=='urchin')assert.deepEqual(current.CHARACTER_DEFS[id],old.CHARACTER_DEFS[id],id);else for(const key of['q','e','x'])assert.deepEqual(current.getCharacterSkill(id,key),old.getCharacterSkill(id,key),key);}
 for(const [key,value]of Object.entries(old.URCHIN_SKILLS))if(!key.startsWith('lance'))assert.deepEqual(current.URCHIN_SKILLS[key],value,key);
 console.log('PASS: pre-C immutable baseline matches Q/E/X and other15 character definitions/numbers');
 const a=await moduleFrom(original('audio.js')),b=await load('audio.js');for(const key of Object.keys(a.SAMPLE_CUES))if(key!=='urchin-lance')assert.deepEqual(b.SAMPLE_CUES[key],a.SAMPLE_CUES[key],key);
 for(const key of['urchin-lance','urchin-lance-pressure','urchin-rift-splash','urchin-lance-hit']){assert.ok(b.SAMPLE_CUES[key].length);for(const l of b.SAMPLE_CUES[key]){assert.ok(fs.existsSync(path.join(__dirname,'public/audio',l.file)));assert.ok(l.gain>0&&l.length>0&&l.length<=.4);}}
 console.log('PASS: every existing non-C audio recipe preserved; C water/pressure/hit/splash reuse existing assets without playback');
}
main().catch(e=>{console.error(e);process.exitCode=1});
