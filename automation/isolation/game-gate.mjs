// Parses source as data. No candidate module is imported or executed here.
import {parse} from './vendor/acorn.mjs';
import {limits} from './policy.mjs';
const deny=()=>{throw Error('Game source boundary rejected');};
const sensitive=new Set(['document','URL','Audio','Image','AudioContext','FileReader','Notification','openDatabase','eval','Function','AsyncFunction','GeneratorFunction','globalThis','process','require','module','exports','Buffer','Deno','Bun','fetch','navigator','localStorage','sessionStorage','indexedDB','XMLHttpRequest','WebSocket','Worker','SharedWorker','ServiceWorker','WebAssembly','SharedArrayBuffer','Atomics','Proxy','Reflect','window','self','global','location','parent','top','opener','frames','importScripts','BroadcastChannel','RTCPeerConnection','EventSource','atob','btoa']);
const members=new Set(['style','load','loadAsync','request','appendChild','replaceChildren','__proto__','prototype','constructor','cookie','credentials','credential','authorization','token','password','secret','online','network','send','sendBeacon','postMessage','open','connect','register','serviceWorker','write','writeln','innerHTML','outerHTML','insertAdjacentHTML','setAttribute','createElement','createElementNS','src','srcdoc','href','action','formAction','defineProperty','defineProperties','setPrototypeOf','getPrototypeOf','fromCharCode','fromCodePoint']);
const stable=value=>JSON.stringify(value,(key,item)=>['start','end','loc'].includes(key)?undefined:item);
function walk(node,fn,ancestors=[]){if(!node||typeof node!=='object')return;if(node.type)fn(node,ancestors);for(const[key,value]of Object.entries(node)){if(['start','end','loc'].includes(key))continue;if(Array.isArray(value))value.forEach(v=>walk(v,fn,[...ancestors,node]));else if(value&&typeof value==='object')walk(value,fn,[...ancestors,node]);}}
function bounded(text){if(typeof text!=='string'||Buffer.byteLength(text)>limits.moduleBytes||/[\p{Cf}\p{Cc}]/u.test(text.replace(/[\r\n\t]/g,'')))deny();}
function multiset(items){const m=new Map();for(const x of items)m.set(x,(m.get(x)??0)+1);return m;}
function subset(after,before){const remaining=multiset(before);for(const x of after){const count=remaining.get(x)??0;if(!count)deny();remaining.set(x,count-1);}}
function equal(a,b){if(stable([...a].sort())!==stable([...b].sort()))deny();}
function inspect(text){
  const comments=[],ast=parse(text,{ecmaVersion:'latest',sourceType:'module',onComment:comments});
  const imports=[],guards=new Map(),computed=[],strings=[];let count=0;
  walk(ast,(n,ancestors)=>{
    if(++count>limits.nodeCount)deny();
    if(n.type==='ImportDeclaration'||n.type==='ExportAllDeclaration'||n.type==='ExportNamedDeclaration'&&n.source)imports.push(stable(n));
    if(n.type==='MemberExpression'&&n.computed)computed.push(stable(n));
    if(n.type==='Literal'&&typeof n.value==='string')strings.push(n.value);
    const name=n.type==='Identifier'?n.name:n.type==='Literal'&&typeof n.value==='string'?n.value:null;
    const parent=ancestors.at(-1),propertyName=parent&&(parent.type==='MemberExpression'&&parent.property===n&&!parent.computed||['Property','MethodDefinition'].includes(parent.type)&&parent.key===n&&!parent.computed);
    const capability=n.type==='ImportExpression'||n.type==='MetaProperty'||name&&(n.type==='Identifier'&&!propertyName&&sensitive.has(name)||members.has(name))||n.type==='MemberExpression'&&n.computed&&n.property.type!=='Literal';
    if(capability){
      // Freeze the complete enclosing callable, including its original guards.
      // This conservatively holds changes to code that also performs I/O.
      const region=[...ancestors,n].reverse().find(x=>['MethodDefinition','FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(x.type))??ancestors.find(x=>ast.body.includes(x))??n;
      guards.set(region,stable(region));
    }
  });
  return{ast,imports,guards:[...guards.values()],computed,strings,comments:comments.map(c=>c.value)};
}
export function validateGameJavaScript(before,after){
  bounded(before);bounded(after);const a=inspect(before),b=inspect(after);
  equal(a.imports,b.imports);equal(a.guards,b.guards);equal(a.comments,b.comments);
  subset(b.computed,a.computed);
  // New strings may describe gameplay, but cannot introduce endpoints,
  // active markup, apparent credentials or obfuscated capability names.
  for(const value of b.strings.filter(v=>!a.strings.includes(v))){if(/(?:https?:|wss?:|data:|javascript:|file:|node:|url\s*\(|@import|\/\/|\\|<\s*\/?\s*(?:script|iframe|object|embed)|(?:token|password|secret|authorization)\s*[:=]|[a-z0-9_-]{64,}|__proto__|constructor|prototype)/i.test(value))deny();}
  return true;
}
function cssTokens(text){return text.match(/url\s*\([^)]*\)|@import[^;]*;|expression\s*\([^)]*\)|(?:-moz-binding|behavior)\s*:[^;}]*|\\[0-9a-f]{1,6}\s?/gi)??[];}
export function validateGameCss(before,after){bounded(before);bounded(after);equal(cssTokens(before),cssTokens(after));if(/<\s*\/\s*style/i.test(after))deny();return true;}
function jsonTree(text){const v=JSON.parse(text),active=[];let count=0;function visit(x){if(++count>limits.nodeCount)deny();if(typeof x==='number'&&!Number.isFinite(x))deny();if(typeof x==='string'&&/(?:https?:|wss?:|javascript:|data:|__proto__|constructor|prototype)/i.test(x))active.push(x);if(x&&typeof x==='object'){for(const[key,value]of Object.entries(x)){if(['__proto__','constructor','prototype'].includes(key))deny();visit(value);}}}visit(v);return active;}
function htmlActive(text){
  // Existing active blocks are immutable. New event handlers, executable URLs,
  // foreign documents, forms and metadata are not part of game UI delegation.
  const active=text.match(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>|<(?:meta|link|base)\b[^>]*>|\b(?:on[a-z]+|src|srcdoc|href|action|formaction|style)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi)??[];
  return active;
}
export function validateGameHtml(before,after){
  bounded(before);bounded(after);equal(htmlActive(before),htmlActive(after));
  const unsafe=/<\/?\s*(?:iframe|object|embed|form|foreignObject|template|math|noscript)\b|javascript\s*:|data\s*:\s*text\/html|<!--\[if/gi;
  equal(before.match(unsafe)??[],after.match(unsafe)??[]);
  const originalTags=before.match(/<\/?\s*[a-z][a-z0-9:-]*/gi)??[],tags=after.match(/<\/?\s*[a-z][a-z0-9:-]*/gi)??[];
  for(const tag of tags){if(!originalTags.some(x=>x.toLowerCase()===tag.toLowerCase())&&!/^<\/?\s*(?:div|span|p|section|button|label|input|output|small|strong|ul|li|h[1-6])$/i.test(tag))deny();}
  return true;
}
export function validateGameSource(path,before,after){
  if(path.endsWith('.js'))return validateGameJavaScript(before,after);
  if(path.endsWith('.css'))return validateGameCss(before,after);
  if(path.endsWith('.html'))return validateGameHtml(before,after);
  if(path.endsWith('.json')){bounded(before);bounded(after);equal(jsonTree(before),jsonTree(after));return true;}
  deny();
}
