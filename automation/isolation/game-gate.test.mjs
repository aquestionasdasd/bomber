import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {files,limits,selfTests,coreTests} from './policy.mjs';
import {validateGameSource,validateGameJavaScript} from './game-gate.mjs';
import {validateProposal,sha256} from './gate.mjs';
import {selectContext,generate} from './model.mjs';
const source=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('all 115 owner-delegated existing sources parse without executing their code',()=>{assert.equal(Object.keys(files).length,115);for(const path of Object.keys(files)){const text=source(path);assert.equal(validateGameSource(path,text,text),true,path);}});
test('character/weapon numbers, map geometry, presentation CSS and HTML text are eligible',()=>{
  for(const[path,search,replace]of [['public/rules.js','body:26,head:78,leg:22','body:27,head:78,leg:22'],['public/abilities.js','flightDuration:1','flightDuration:1.1'],['public/trc-layout.js','minX:-55,maxX:55','minX:-56,maxX:56'],['public/style.css','#',' #'],['public/play.html','Discord','DISCORD']]){
    const before=source(path);if(!before.includes(search)){if(path.endsWith('play.html')){assert.equal(validateGameSource(path,before,before.replace('<title>','<title>更新 ')),true);continue;}assert.fail('Fixture anchor missing '+path);}
    assert.equal(validateGameSource(path,before,before.replace(search,replace)),true,path);
  }
  assert.equal(validateGameJavaScript('export function step(x){return x+1;}','export function step(x){const boost=2;return x+boost;}'),true);
});
test('secrets, authentication, network, binary assets, dependencies, tests and publication are outside path scope',()=>{
  for(const path of ['public/online.js','public/audio.js','public/career-coins.js','public/../.env','server/rooms.ts','package.json','tests.cjs','.github/workflows/bd3do-isolated.yml','automation/isolation/policy.mjs','public/audio/a.wav','public/new-code.js'])assert.equal(Object.hasOwn(files,path),false,path);
});
test('added I/O, dynamic code, obfuscated access and credentials cannot enter game modules',()=>{
  const before='export function step(x){return x+1;}';
  for(const code of ["fetch('/api/x')","process.exit(0)","globalThis.fetch('x')","import('node:fs')","new Function('return 1')()","window.open('x')","document.cookie","navigator.sendBeacon('x')","localStorage.setItem('a','b')","new Image()","new THREE.TextureLoader().load('x')","x['con'+'structor']('return 1')()","x.style.background='url(//outside.invalid)'","x.__proto__={}","Reflect.get(x,'x')","const secret='token=private'","const hidden='https://outside.invalid'","const name='con'+'structor';x[name]()"]){assert.throws(()=>validateGameJavaScript(before,before+'\n'+code),undefined,code);}
});
test('pre-existing I/O callables and guards cannot be changed or moved into unguarded code',()=>{
  const before="export async function load(flag){if(flag)return fetch('/api/rooms');}export function step(x){return x+1;}";
  assert.equal(validateGameJavaScript(before,before.replace('x+1','x+2')),true);
  for(const after of [before.replace('if(flag)','if(true)'),before.replace('/api/rooms','/api/other'),before+"fetch('/api/rooms');",before.replace('return fetch','return other')])assert.throws(()=>validateGameJavaScript(before,after));
});
test('HTML/CSS/data changes cannot introduce script, events, navigation, loading or prototype keys',()=>{
  const html='<html><head><title>Game</title></head><body><div>Play</div><script src="game.js"></script></body></html>';
  for(const injected of ['<script>alert(1)</script>','<img src="//outside.invalid">','<input onfocus="alert(1)">','<iframe></iframe>','<meta http-equiv="refresh" content="0;url=//outside.invalid">','<svg><foreignObject></foreignObject></svg>'])assert.throws(()=>validateGameSource('public/play.html',html,html.replace('</body>',injected+'</body>')));
  for(const injected of ['body{background:url(//outside.invalid)}','@import "//outside.invalid";','a{behavior:url(x)}','a{background:u\\72l(x)}'])assert.throws(()=>validateGameSource('public/style.css','body{color:red}','body{color:red}'+injected));
  for(const json of ['{"__proto__":{}}','{"x":"https://outside.invalid"}','{"x":1e999}'])assert.throws(()=>validateGameSource('public/city-data.json','{"x":1}',json));
});
test('whole after-bytes, 8-file resource limit and original hashes remain mandatory',()=>{
  const baseline=Object.fromEntries(Object.keys(files).map(p=>[p,source(p)])),path='public/rules.js',before=baseline[path],after=before.replace('body:26,head:78,leg:22','body:27,head:78,leg:22');
  const proposal={version:1,baseCommit:'f'.repeat(40),changes:[{path,beforeSha256:sha256(before),after}]};
  assert.equal(validateProposal(proposal,baseline).changes[0].afterSha256,sha256(after));proposal.changes[0].beforeSha256='0'.repeat(64);assert.throws(()=>validateProposal(proposal,baseline));
  assert.equal(limits.files,8);assert.equal(coreTests.length,5);assert.equal(selfTests.length,4);
});
test('source selection is bounded and cannot name private files or unshown replacement anchors',async()=>{
  const baseline={'public/range.js':source('public/range.js')};
  assert.throws(()=>selectContext(baseline,[{path:'../.state/key',needles:[]}]));
  assert.ok(Buffer.byteLength(JSON.stringify(selectContext(baseline,[{path:'public/range.js',needles:[]}])))<limits.contextBytes+1000);
  let calls=0;const response=x=>new Response(JSON.stringify({done:true,message:{role:'assistant',content:JSON.stringify(x)}}));
  await assert.rejects(()=>generate({kind:'feature',description:'射撃練習の改善をお願いします'},{baseline,baseCommit:'f'.repeat(40)},async()=>response(++calls===1?{sources:[{path:'public/range.js',needles:[]}]}:{decision:'change',reason:'eligible',changes:[{path:'public/range.js',search:'UNSHOWN',replace:'hidden'}]})));
});
