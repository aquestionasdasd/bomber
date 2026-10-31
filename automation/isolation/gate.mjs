import {createHash} from 'node:crypto';
import {parse} from './vendor/acorn.mjs';
import {files,limits} from './policy.mjs';
import {validateGameSource} from './game-gate.mjs';
export const sha256=text=>createHash('sha256').update(text).digest('hex');
const plain=v=>!!v&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v,keys)=>plain(v)&&Object.keys(v).sort().join(',')===keys;
const globals=new Set(['Math','Number','Array','Infinity','NaN','undefined']);
const forbidden=new Set(['__proto__','prototype','constructor','eval','Function','globalThis','window','self','global','process','require','module','exports','document','navigator','location','top','parent','opener','frames','fetch','XMLHttpRequest','WebSocket','Worker','SharedWorker','importScripts','setTimeout','setInterval','queueMicrotask','console','Object','Reflect','Proxy','Promise','Symbol','WebAssembly','Atomics','SharedArrayBuffer']);
const methods={Math:new Set(['abs','min','max','round','floor','ceil','hypot','sqrt','sin','cos','atan2','random']),Number:new Set(['isFinite','isSafeInteger','isInteger']),Array:new Set(['isArray','from'])};
const types=new Set(['Program','ExportNamedDeclaration','FunctionDeclaration','FunctionExpression','ArrowFunctionExpression','BlockStatement','ReturnStatement','VariableDeclaration','VariableDeclarator','Identifier','Literal','ObjectExpression','Property','ArrayExpression','SpreadElement','MemberExpression','CallExpression','AssignmentExpression','AssignmentPattern','UpdateExpression','BinaryExpression','LogicalExpression','UnaryExpression','ConditionalExpression','IfStatement','ExpressionStatement','ThisExpression','ClassDeclaration','ClassBody','MethodDefinition','ObjectPattern','ArrayPattern','RestElement','EmptyStatement','ChainExpression']);
function rejected(){throw Error('Proposal policy rejected');}
function tree(text){if(Buffer.byteLength(text)>limits.moduleBytes||/[\p{Cf}\p{Cc}]/u.test(text.replace(/[\r\n\t]/g,'')))rejected();const comments=[];const ast=parse(text,{ecmaVersion:'latest',sourceType:'module',onComment:comments});return{ast,comments:comments.map(c=>c.value)};}
function all(node,fn){if(!node||typeof node!=='object')return;if(typeof node.type==='string')fn(node);for(const [key,value]of Object.entries(node)){if(['start','end','loc'].includes(key))continue;if(Array.isArray(value))for(const child of value)all(child,fn);else if(value&&typeof value==='object')all(value,fn);}}
function exportsOf(ast){return ast.body.filter(n=>n.type==='ExportNamedDeclaration').map(n=>{const d=n.declaration;if(!d?.id||!['FunctionDeclaration','ClassDeclaration'].includes(d.type))rejected();return d.type+':'+d.id.name;}).sort();}
function names(pattern,result){if(!pattern)return;if(pattern.type==='Identifier'){if(globals.has(pattern.name)||forbidden.has(pattern.name))rejected();result.add(pattern.name);}else if(pattern.type==='AssignmentPattern')names(pattern.left,result);else if(pattern.type==='RestElement')names(pattern.argument,result);else if(pattern.type==='ArrayPattern')pattern.elements.forEach(p=>names(p,result));else if(pattern.type==='ObjectPattern')pattern.properties.forEach(p=>{if(p.computed)rejected();names(p.type==='RestElement'?p.argument:p.value,result);});else rejected();}
function scope(parent,body=[],params=[]){const s={parent,names:new Set()};params.forEach(p=>names(p,s.names));for(const n of body){const node=n.type==='ExportNamedDeclaration'?n.declaration:n;if(!node)continue;if(node.type==='VariableDeclaration')node.declarations.forEach(d=>names(d.id,s.names));else if(['FunctionDeclaration','ClassDeclaration'].includes(node.type))names(node.id,s.names);}return s;}
function bound(s,name){for(;s;s=s.parent)if(s.names.has(name))return true;return false;}
export function validatePureModule(before,after){
  const original=tree(before),candidate=tree(after);
  if(JSON.stringify(exportsOf(original.ast))!==JSON.stringify(exportsOf(candidate.ast))||JSON.stringify(original.comments)!==JSON.stringify(candidate.comments))rejected();
  const properties=new Set(),literals=new Set(),identifiers=new Set();let originalCount=0;
  all(original.ast,n=>{originalCount++;if(n.type==='Identifier')identifiers.add(n.name);if((n.type==='Property'||n.type==='MethodDefinition')&&!n.computed&&n.key.type==='Identifier')properties.add(n.key.name);if(n.type==='MemberExpression'&&!n.computed)properties.add(n.property.name);if(n.type==='Literal')literals.add(JSON.stringify(n.value));});
  let count=0;all(candidate.ast,n=>{if(++count>Math.min(limits.nodeCount,originalCount*1.5+100)||(n.type==='Identifier'&&!identifiers.has(n.name)))rejected();});
  function pattern(p,s){if(!p)return;if(p.type==='AssignmentPattern'){pattern(p.left,s);visit(p.right,s);}else if(p.type==='ObjectPattern')p.properties.forEach(v=>{if(v.computed||forbidden.has(v.key?.name))rejected();pattern(v.type==='RestElement'?v.argument:v.value,s);});else if(p.type==='ArrayPattern')p.elements.forEach(v=>pattern(v,s));else if(p.type==='RestElement')pattern(p.argument,s);else if(p.type!=='Identifier')rejected();}
  function member(n,s){if(n.computed||n.property.type!=='Identifier'||forbidden.has(n.property.name)||!properties.has(n.property.name))rejected();visit(n.object,s);}
  function visit(n,s){
    if(!n)return;if(!types.has(n.type))rejected();
    if(n.type==='Program'){const t=scope(null,n.body);n.body.forEach(v=>visit(v,t));return;}
    if(n.type==='ExportNamedDeclaration'){if(!n.declaration||n.source||n.specifiers.length)rejected();visit(n.declaration,s);return;}
    if(n.type==='BlockStatement'){const t=scope(s,n.body);n.body.forEach(v=>visit(v,t));return;}
    if(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type)){if(n.async||n.generator)rejected();const t=scope(s,[],n.params);if(n.id)names(n.id,t.names);n.params.forEach(p=>pattern(p,t));visit(n.body,t);return;}
    if(n.type==='VariableDeclaration'){if(!['let','const'].includes(n.kind))rejected();n.declarations.forEach(d=>{pattern(d.id,s);visit(d.init,s);});return;}
    if(n.type==='Identifier'){if(forbidden.has(n.name)||(!globals.has(n.name)&&!bound(s,n.name)))rejected();return;}
    if(n.type==='Literal'){if(n.regex||n.bigint||!literals.has(JSON.stringify(n.value)))rejected();return;}
    if(n.type==='MemberExpression'){member(n,s);return;}
    if(n.type==='CallExpression'){
      if(n.optional)rejected();const c=n.callee;
      if(c.type==='Identifier'){if(c.name!=='random'||!bound(s,c.name))rejected();}
      else if(c.type==='MemberExpression'){
        member(c,s);const root=c.object.type==='Identifier'&&c.object.name;
        if(globals.has(root)){if(!methods[root]?.has(c.property.name))rejected();}
        else if(c.property.name!=='every')rejected();
      }else rejected();n.arguments.forEach(v=>visit(v,s));return;
    }
    if(n.type==='Property'){if(n.computed||n.key.type!=='Identifier'||forbidden.has(n.key.name)||!properties.has(n.key.name)||!['init','get'].includes(n.kind))rejected();visit(n.value,s);return;}
    if(n.type==='MethodDefinition'){if(n.computed||n.static||n.key.type!=='Identifier'||!properties.has(n.key.name)||(forbidden.has(n.key.name)&&n.kind!=='constructor'))rejected();visit(n.value,s);return;}
    if(n.type==='ClassDeclaration'){if(n.superClass)rejected();visit(n.body,s);return;}
    if(['AssignmentExpression','UpdateExpression'].includes(n.type)){
      const left=n.left??n.argument;if(left.type==='Identifier'){if(!bound(s,left.name)||globals.has(left.name))rejected();}
      else if(left.type==='MemberExpression'){member(left,s);let root=left.object;while(root.type==='MemberExpression')root=root.object;if(root.type!=='ThisExpression'&&(root.type!=='Identifier'||!bound(s,root.name)))rejected();}
      else rejected();if(n.right)visit(n.right,s);return;
    }
    if(n.type==='UnaryExpression'&&n.operator==='delete')rejected();
    for(const [key,v]of Object.entries(n)){if(['type','start','end','key','id'].includes(key))continue;if(Array.isArray(v))v.forEach(c=>{if(c?.type)visit(c,s);});else if(v?.type)visit(v,s);}
  }
  visit(candidate.ast,null);return true;
}
export function validateEnvelope(proposal){
  if(!exact(proposal,'baseCommit,changes,version')||proposal.version!==1||!/^[a-f0-9]{40}$/.test(proposal.baseCommit)||!Array.isArray(proposal.changes)||proposal.changes.length<1||proposal.changes.length>limits.files||Buffer.byteLength(JSON.stringify(proposal))>limits.proposalBytes)rejected();
  const seen=new Set();
  for(const change of proposal.changes){if(!exact(change,'after,beforeSha256,path')||typeof change.path!=='string'||!Object.hasOwn(files,change.path)||seen.has(change.path)||typeof change.after!=='string'||typeof change.beforeSha256!=='string'||!/^[a-f0-9]{64}$/.test(change.beforeSha256))rejected();seen.add(change.path);}
  return true;
}
export function validateProposal(proposal,baseline){
  validateEnvelope(proposal);
  for(const change of proposal.changes){const before=baseline[change.path];if(typeof before!=='string'||sha256(before)!==change.beforeSha256||before===change.after)rejected();validateGameSource(change.path,before,change.after);}
  return {version:1,baseCommit:proposal.baseCommit,changes:proposal.changes.map(c=>({path:c.path,beforeSha256:c.beforeSha256,afterSha256:sha256(c.after)}))};
}
