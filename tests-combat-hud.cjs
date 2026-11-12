// Combat HUD layer: display-only behaviour with a tiny fake DOM. No browser,
// network, audio or game state is touched.
const assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),path=require('node:path'),fs=require('node:fs');

function fakeDocument(){
  const byId=new Map();
  class El{
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.parent=null;this._text='';this.dataset={};this.attributes={};this.hidden=false;this.offsetWidth=10;
      const classes=new Set(),props=new Map();this._classes=classes;
      this.classList={add:(...n)=>n.forEach(x=>classes.add(x)),remove:(...n)=>n.forEach(x=>classes.delete(x)),contains:n=>classes.has(n),toggle:(n,on)=>{const v=on===undefined?!classes.has(n):!!on;v?classes.add(n):classes.delete(n);return v;}};
      this.style={setProperty:(k,v)=>props.set(k,v),getPropertyValue:k=>props.get(k)??''};}
    set className(v){this._classes.clear();String(v).split(/\s+/).filter(Boolean).forEach(c=>this._classes.add(c));}
    get className(){return [...this._classes].join(' ');}
    set id(v){this._id=v;byId.set(v,this);}get id(){return this._id;}
    setAttribute(k,v){this.attributes[k]=String(v);if(k==='class')this.className=v;if(k==='id')this.id=v;}
    getAttribute(k){return this.attributes[k]??null;}
    get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
    set textContent(v){this._text=String(v);this.children=[];}
    get firstChild(){return this.children[0]||null;}
    get childNodes(){return this.children;}
    get lastElementChild(){return this.children[this.children.length-1]||null;}
    _adopt(n){if(n.parent)n.parent.children.splice(n.parent.children.indexOf(n),1);n.parent=this;}
    append(...n){for(const c of n){this._adopt(c);this.children.push(c);}}
    prepend(...n){for(const c of n.reverse()){this._adopt(c);this.children.unshift(c);}}
    after(n){const p=this.parent;p._adopt(n);p.children.splice(p.children.indexOf(this)+1,0,n);}
    replaceChildren(...n){this.children=[];this.append(...n);}
    remove(){if(this.parent){this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}}
    cloneNode(){const c=new El(this.tagName);c.attributes={...this.attributes};return c;}
    querySelector(sel){const cls=sel.startsWith('.')?sel.slice(1):null;const walk=n=>{for(const c of n.children){if(cls&&c.classList.contains(cls))return c;const r=walk(c);if(r)return r;}return null;};return cls?walk(this):null;}
  }
  const doc={byId,El,cards:new Map(),
    getElementById:id=>byId.get(id)||null,
    createElement:t=>new El(t),createElementNS:(_,t)=>new El(t),
    querySelector:sel=>{const m=/^\[data-buy="([^"]+)"\] svg$/.exec(sel);return m?doc.cards.get(m[1])||null:null;}};
  const mk=(id,parent)=>{const n=new El('div');n.id=id;if(parent)parent.append(n);return n;};
  const hud=mk('hud');const health=mk('health-block',hud);mk('health-bar',health);
  const weapon=mk('weapon-block',hud);const ammoRow=new El('div');ammoRow.className='ammo-values';weapon.append(ammoRow);
  mk('ability-x',hud);mk('hitmarker',hud);mk('killfeed',hud);
  const svg=new El('svg');svg.setAttribute('viewBox','0 0 240 70');svg.append(new El('path'));doc.cards.set('vandal',svg);
  return doc;
}

(async()=>{
  const mod=await import(pathToFileURL(path.join(__dirname,'public/combat-hud.js')).href);
  let groups=0;const test=async(name,fn)=>{await fn();groups++;console.log('PASS: '+name);};
  const base={uiMode:'match',alive:true,hp:100,armor:0,mag:25,ammo:25,ultPoints:2,planted:false};

  await test('health levels and magazine pip bounds are pure and clamped',()=>{
    assert.equal(mod.combatHudLevel(100),'ok');assert.equal(mod.combatHudLevel(35),'ok');assert.equal(mod.combatHudLevel(34),'low');
    assert.equal(mod.combatHudLevel(25),'critical');assert.equal(mod.combatHudLevel(1),'critical');assert.equal(mod.combatHudLevel(0),'down');assert.equal(mod.combatHudLevel(NaN),'down');
    assert.deepEqual(mod.magazinePips(25,7),{size:25,filled:7});assert.deepEqual(mod.magazinePips(12,99),{size:12,filled:12});assert.deepEqual(mod.magazinePips(5,-3),{size:5,filled:0});
    assert.equal(mod.magazinePips(0,0),null);assert.equal(mod.magazinePips(41,41),null);assert.equal(mod.magazinePips(undefined,3),null);
  });

  await test('update reads a frozen state, builds widgets once and reflects vitals/ammo',()=>{
    const doc=fakeDocument(),ui=mod.createCombatHUD({document:doc,setTimer:()=>0}),get=id=>doc.getElementById(id);
    const frozen=Object.freeze({...base,hp:20,armor:25,ammo:3}),before=JSON.stringify(frozen);ui.update(frozen);
    assert.equal(JSON.stringify(frozen),before);
    assert.equal(get('hud').dataset.hpLevel,'critical');
    assert.equal(get('armor-bar').style.getPropertyValue('width'),'50%');assert.ok(get('health-block').classList.contains('has-armor'));
    const pips=get('mag-pips');assert.equal(pips.children.length,25);assert.equal(pips.children.filter(n=>n.classList.contains('spent')).length,22);
    ui.update({...base,ammo:0});assert.ok(get('weapon-block').classList.contains('mag-empty'));assert.equal(pips.children.length,25,'same magazine keeps its nodes');
    ui.update({...base,mag:12,ammo:12});assert.equal(pips.children.length,12);assert.ok(!get('weapon-block').classList.contains('mag-empty'));
    ui.update({...base,mag:0,ammo:0});assert.equal(pips.hidden,true,'knife / no magazine hides pips');assert.ok(!get('weapon-block').classList.contains('mag-empty'));
    ui.update({...base,alive:false,hp:40});assert.equal(get('hud').dataset.hpLevel,'down');
    ui.update(base);ui.update(base);
    for(const id of ['armor-track','mag-pips','reload-sweep','hud-low-hp'])assert.ok(get(id),id+' exists');
    assert.equal(get('hud').children.filter(n=>n.id==='hud-low-hp').length,1,'widgets are built only once');
  });

  await test('ultimate ready and planted states toggle only on change and only in match',()=>{
    const doc=fakeDocument(),ui=mod.createCombatHUD({document:doc,setTimer:()=>0}),get=id=>doc.getElementById(id);
    ui.update({...base,ultPoints:6});assert.ok(!get('ability-x').classList.contains('ult-ready'));
    ui.update({...base,ultPoints:7});assert.ok(get('ability-x').classList.contains('ult-ready'));assert.ok(get('ability-x').classList.contains('ult-ready-burst'));
    ui.update({...base,ultPoints:0});assert.ok(!get('ability-x').classList.contains('ult-ready'));
    ui.update({...base,planted:true});assert.ok(get('hud').classList.contains('bomber-planted'));
    ui.update({...base,planted:true,uiMode:'objective'});assert.ok(!get('hud').classList.contains('bomber-planted'),'objective practice never shows the live planted alarm');
  });

  await test('hit and kill markers restart and clear through the supplied timer',()=>{
    const doc=fakeDocument(),timers=[],ui=mod.createCombatHUD({document:doc,setTimer:(fn,ms)=>{timers.push({fn,ms});return timers.length;}}),m=doc.getElementById('hitmarker');
    ui.hit('hit');assert.ok(m.classList.contains('hm-hit'));assert.equal(timers.at(-1).ms,260);
    ui.hit('kill',9);assert.ok(m.classList.contains('hm-kill'));assert.ok(!m.classList.contains('hm-hit'));assert.equal(m.style.getPropertyValue('--kill-count'),'5');assert.equal(timers.at(-1).ms,520);
    timers.at(-1).fn();assert.ok(!m.classList.contains('hm-kill'));
    assert.ok(m.querySelector('.hit-ring'),'ring added once');
  });

  await test('kill feed rows keep readable text, team colours, self highlight and a 5-row limit',()=>{
    const doc=fakeDocument(),timers=[],ui=mod.createCombatHUD({document:doc,setTimer:(fn,ms)=>{timers.push({fn,ms});return 0;}}),box=doc.getElementById('killfeed');
    const row=ui.feed({killer:'YOU',victim:'蓮子',killerAlly:true,victimAlly:false,killerSelf:true,firearm:true,weapon:'vandal'});
    assert.equal(row.textContent,'YOU ⌁ 蓮子');assert.equal(row.dataset.killer,'ally');
    assert.ok(row.classList.contains('feed-item'));assert.ok(row.classList.contains('feed-self'));assert.ok(row.classList.contains('feed-self-kill'));
    assert.ok(row.children[0].classList.contains('is-ally'));assert.ok(row.children[3].classList.contains('is-enemy'));
    assert.equal(row.children[1].children[0].getAttribute('class'),'feed-weapon','firearm uses the shop silhouette');
    const skill=ui.feed({killer:'尾野',victim:'YOU',killerAlly:false,victimAlly:true,victimSelf:true,firearm:false,weapon:'vandal'});
    assert.equal(skill.children[1].children[0].getAttribute('class'),'feed-glyph','skill kill never shows a gun icon');assert.ok(skill.classList.contains('feed-self-death'));
    const unknown=ui.feed({killer:'A',victim:'B',firearm:true,weapon:'mystery'});assert.equal(unknown.children[1].children[0].getAttribute('class'),'feed-glyph');
    for(let i=0;i<6;i++)ui.feed({killer:'K'+i,victim:'V'+i,firearm:false});
    assert.equal(box.children.length,5);assert.equal(box.children[0].textContent,'K5 ⌁ V5');
    const life=timers.find(t=>t.ms===5500);life.fn();const fade=timers.at(-1);assert.equal(fade.ms,260);fade.fn();
  });

  await test('game wiring is display-only and keeps the plain feed fallback',()=>{
    const game=fs.readFileSync(path.join(__dirname,'public/game.js'),'utf8'),html=fs.readFileSync(path.join(__dirname,'public/play.html'),'utf8');
    assert.ok(game.includes("import { createCombatHUD } from './combat-hud.js';"));
    assert.equal((game.match(/combatHUD\.update\(/g)||[]).length,1);
    assert.ok(/function combatFeedback\(source,type\)\{\n  if\(isGuest\(\)\|\|!source\)return;\n  if\(source===player\)\{[^\n]*combatHUD\.hit\(/.test(game),'markers only for the local shooter after the guest guard');
    assert.ok(game.includes('if(!row)feed(`${killerName}  ⌁  ${victimName}`);'),'plain text fallback retained');
    const a=html.indexOf('href="competitive-ui.css"'),b=html.indexOf('href="combat-hud.css"');assert.ok(a>0&&b>a,'combat-hud.css loads after competitive-ui.css');
    const src=fs.readFileSync(path.join(__dirname,'public/combat-hud.js'),'utf8');
    for(const banned of ['fetch(','sound(','WebSocket','localStorage','match.','player.'])assert.ok(!src.includes(banned),'no '+banned+' in display layer');
  });

  console.log('Combat HUD: '+groups+' groups passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
