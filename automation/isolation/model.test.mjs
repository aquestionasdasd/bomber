import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {generate,review,endpoint,model} from './model.mjs';import {files} from './policy.mjs';import {sha256} from './gate.mjs';
const baseline=Object.fromEntries(Object.keys(files).map(p=>[p,readFileSync(new URL('../../'+p,import.meta.url),'utf8')])),baseCommit='f'.repeat(40);
const request={kind:'bug',description:'射撃練習の的選択で非有限の的数を拒否して'};
const proposal={version:1,baseCommit,changes:[{path:'public/range.js',beforeSha256:sha256(baseline['public/range.js']),after:baseline['public/range.js'].replace('if(count<=0)return-1;','if(!Number.isFinite(count)||count<=0)return-1;')}]};
const response=content=>new Response(JSON.stringify({done:true,message:{role:'assistant',content:JSON.stringify(content)}}));
test('generation is fixed localhost, tool-less, bounded strict JSON with no request metadata',async()=>{
 const plan=await generate({...request,authorId:'UNSENT_METADATA_SENTINEL',id:'UNSENT_METADATA_SENTINEL'},{baseCommit,baseline},async(url,options)=>{assert.equal(url,endpoint);assert.equal(options.redirect,'error');const b=JSON.parse(options.body);assert.equal(b.model,model);assert.equal(b.tools,undefined);assert.ok(b.format);assert.equal(options.body.includes('UNSENT_METADATA_SENTINEL'),false);return response({decision:'change',reason:'eligible',changes:[{path:'public/range.js',search:'if(count<=0)return-1;',replace:'if(!Number.isFinite(count)||count<=0)return-1;'}]});});assert.equal(plan.decision,'change');
});
test('external links/apparent credentials are held without any inference or fetch',async()=>{for(const description of ['token=confidential','参照 https://example.com/a']){let calls=0;const p=await generate({kind:'bug',description},{baseCommit,baseline},async()=>{calls++;});assert.equal(calls,0);assert.equal(p.decision,'held');}});
test('model policy escape and missing/incomplete review are rejected',async()=>{
 const p=structuredClone(proposal);p.changes[0].path='public/game.js';await assert.rejects(()=>generate(request,{baseCommit,baseline},async()=>response({decision:'change',reason:'eligible',changes:p.changes.map(({path,after})=>({path,after}))})));
 await assert.rejects(()=>review(request,proposal,baseline,async()=>response({approved:true})));
 const r=await review(request,proposal,baseline,async()=>response({approved:true,matchesRequest:false,preservesBehavior:true,noResourceAbuse:true}));assert.equal(r.approved,false);
});
