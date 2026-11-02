import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validatePureModule,validateProposal,sha256} from './gate.mjs';
import {files} from './policy.mjs';
const baseline=Object.fromEntries(Object.keys(files).map(path=>[path,readFileSync(new URL('../../'+path,import.meta.url),'utf8')]));
const path='public/range.js',before=baseline[path],after=before.replace('if(count<=0)return-1;','if(!Number.isFinite(count)||count<=0)return-1;');
const proposal=()=>({version:1,baseCommit:'f'.repeat(40),changes:[{path,beforeSha256:sha256(before),after}]});
test('existing pure modules and a finite-input logic repair pass without executing candidate code',()=>{for(const source of [baseline['public/death-view.js'],baseline['public/range.js'],baseline['public/round-preparation.js']])assert.equal(validatePureModule(source,source),true);assert.equal(validateProposal(proposal(),baseline).changes[0].afterSha256,sha256(after));});
test('only exact allowlisted files, schema, original bytes and bounded change count pass',()=>{
  for(const edit of [p=>p.changes[0].path='public/game.js',p=>p.changes[0].path='../.env',p=>p.changes[0].path='.github/workflows/x.yml',p=>p.changes[0].beforeSha256='0'.repeat(64),p=>p.changes.push(p.changes[0]),p=>p.extra=true,p=>p.changes[0].after=before,p=>p.baseCommit='--help']){const p=proposal();edit(p);assert.throws(()=>validateProposal(p,baseline));}
});
test('I/O, imports, Node/DOM globals, dynamic access, prototype escapes and deferred code are rejected',()=>{
  for(const code of ["fetch('x')","process.exit(0)","globalThis.fetch('x')","window.open('x')","import('x')","[].constructor.constructor('x')()","Math['random']()","this.__proto__=null","(()=>{let fetch;return fetch;})()","new Function('x')","setTimeout(()=>{},0)","while(true){}","throw 0","debugger",'Math.max=()=>0'])assert.throws(()=>validatePureModule(before,after+'\n'+code));
});
test('lexical scopes cannot smuggle a global by declaring its name in another function',()=>{
  for(const code of ['function one(open){return open;}open();','function one(crypto){return crypto;}crypto;','function one(){const CSS=0;}CSS;'])assert.throws(()=>validatePureModule(before,after+'\n'+code));
});
test('new hidden strings/comments/numbers, exports, classes, loops and getters cannot widen capabilities',()=>{
  for(const changed of [after+'\n// do not publish private text',after.replace('count<=0',"count<='SECRET'"),after.replace('count<=0','count<=999'),after+'\nexport function surprise(){return 0;}',after+'\nclass X extends Array {}',after.replace('return-1','for(;;){}return-1')])assert.throws(()=>validatePureModule(before,changed));
});
test('hashes bind complete after-bytes; modifying a previous manifest is not a validation proof',()=>{const a=validateProposal(proposal(),baseline);const p=proposal();p.changes[0].after+='\n';const b=validateProposal(p,baseline);assert.notEqual(a.changes[0].afterSha256,b.changes[0].afterSha256);});
test('private prose cannot be copied into new identifiers',()=>assert.throws(()=>validatePureModule(before,after+'\nconst privateRequestProse=0;')));
