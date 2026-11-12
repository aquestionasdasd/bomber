const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
async function main(){
  const {bindFullscreenNotice}=await import(pathToFileURL(path.join(__dirname,'public/fullscreen-notice.js')).href);
  const {createKeyboardProtection}=await import(pathToFileURL(path.join(__dirname,'public/keyboard-protection.js')).href);
  function target(){
    const listeners=new Map();
    return {hidden:true,textContent:'フルスクリーン推奨',disabled:false,
      addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type,fn){if(listeners.get(type)===fn)listeners.delete(type);},
      emit(type,event={}){return listeners.get(type)?.(event);},count(){return listeners.size;}};
  }
  function setup({full=false,unsupported=false,request}={}){
    const elements=new Map(['','-enable','-dismiss','-message'].map(s=>['fullscreen-notice'+s,target()]));
    const document=Object.assign(target(),{getElementById:id=>elements.get(id),fullscreenElement:full?{}:null,fullscreenEnabled:!unsupported,documentElement:{}});
    let calls=0;
    document.documentElement.requestFullscreen=()=>{calls++;if(request)return request(document);document.fullscreenElement=document.documentElement;document.emit('fullscreenchange');return Promise.resolve();};
    const protection=createKeyboardProtection({document,navigator:{}});
    const ui=bindFullscreenNotice({document,onEnable:()=>protection.enable()});
    return {document,e:s=>elements.get('fullscreen-notice'+s),ui,calls:()=>calls};
  }
  const a=setup();assert.equal(a.calls(),0,'Never forces fullscreen on load');assert.equal(a.e('').hidden,false);assert.equal(a.e('-enable').hidden,false);
  await a.e('-enable').emit('click');assert.equal(a.calls(),1);assert.equal(a.e('').hidden,true,'Only actual fullscreen hides notice');
  a.document.fullscreenElement=null;a.document.emit('fullscreenchange');assert.equal(a.e('').hidden,false);
  console.log('PASS: windowed initial hint, user gesture through real keyboard controller, enter/exit sync');
  a.e('-dismiss').emit('click');assert.equal(a.e('').hidden,true);a.document.emit('fullscreenchange');assert.equal(a.e('').hidden,true,'Windowed events keep dismissal');
  a.document.fullscreenElement={};a.document.emit('fullscreenchange');a.document.fullscreenElement=null;a.document.emit('fullscreenchange');assert.equal(a.e('').hidden,false,'Leaving a later fullscreen session reoffers the hint');
  const b=setup({full:true});assert.equal(b.e('').hidden,true);assert.equal(b.calls(),0);b.document.fullscreenElement=null;b.document.emit('fullscreenchange');assert.equal(b.e('').hidden,false);
  console.log('PASS: optional dismissal, new windowed episode, initially fullscreen is quiet');
  let finish;const c=setup({request:doc=>new Promise(resolve=>{finish=()=>{doc.fullscreenElement={};doc.emit('fullscreenchange');resolve();};})});
  const pending=c.e('-enable').emit('click');assert.equal(c.calls(),1,'Request begins synchronously in click');assert.equal(c.e('-enable').disabled,true);await c.e('-enable').emit('click');assert.equal(c.calls(),1);finish();await pending;assert.equal(c.e('').hidden,true);assert.equal(c.e('-enable').disabled,false);
  console.log('PASS: activation preserved, pending request deduplication and completion');
  const d=setup({request:()=>Promise.reject(Object.assign(Error('denied'),{name:'NotAllowedError'}))});await d.e('-enable').emit('click');assert.equal(d.calls(),1,'No permission-error retry');assert.equal(d.e('').hidden,false);assert.match(d.e('-message').textContent,/切り替えられません/);assert.equal(d.e('-enable').disabled,false);d.e('-dismiss').emit('click');assert.equal(d.e('').hidden,true);
  const e=setup({unsupported:true});assert.equal(e.e('').hidden,false);assert.equal(e.e('-enable').hidden,true);assert.match(e.e('-message').textContent,/対応していません/);await e.e('-enable').emit('click');assert.equal(e.calls(),0);
  console.log('PASS: denied request remains dismissible, unsupported browser has no broken action');
  for(const code of ['Enter','Space','Tab']){let stopped=false;a.e('').emit('keydown',{code,stopPropagation(){stopped=true;}});assert.equal(stopped,true);}
  let stopped=false;a.e('').emit('keydown',{code:'Escape',stopPropagation(){stopped=true;}});assert.equal(stopped,false,'Escape still reaches pause handling');
  const f=setup({request:()=>new Promise(resolve=>{finish=resolve;})});const late=f.e('-enable').emit('click');f.ui.dispose();finish();await late;assert.equal(f.e('').hidden,true);assert.equal(f.document.count(),0);assert.equal(f.e('').count(),0);assert.equal(f.e('-enable').count(),0);f.ui.dispose();
  console.log('PASS: native button keys isolated, Escape retained, late settlement and listener cleanup');
  const html=fs.readFileSync(path.join(__dirname,'public/play.html'),'utf8'),game=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8');
  assert.match(html,/<aside id="fullscreen-notice"[^>]+hidden>/);assert.match(html,/id="fullscreen-notice-message" role="status"/);assert.match(html,/id="fullscreen-notice-dismiss"[^>]+aria-label=/);
  assert.match(game,/bindFullscreenNotice\(\{document,onEnable:\(\)=>keyboardProtection.enable\(\)\}\)/);assert.match(game,/fullscreenNotice.dispose\(\)/);
  for(const fixture of [a,b,c,d,e])fixture.ui.dispose();
  console.log('PASS: accessible markup, existing keyboard protection and page teardown integration');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
