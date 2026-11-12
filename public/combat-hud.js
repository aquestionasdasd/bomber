// Competitive combat HUD layer. Display only: it reads values that game.js
// already owns and never changes input, combat, inventory, economy or network.
const SVG_NS='http://www.w3.org/2000/svg';
const MAX_PIPS=40;
const ARMOR_MAX=50;
const FEED_LIMIT=5;
const FEED_LIFETIME_MS=5500;

export function combatHudLevel(hp){
  if(!(hp>0))return 'down';
  if(hp<=25)return 'critical';
  if(hp<35)return 'low';
  return 'ok';
}

export function magazinePips(mag,ammo){
  const size=Number.isFinite(mag)?Math.floor(mag):0;
  if(size<=0||size>MAX_PIPS)return null;
  const filled=Math.max(0,Math.min(size,Math.floor(Number(ammo)||0)));
  return {size,filled};
}

export function createCombatHUD({document:doc=globalThis.document,now=()=>Date.now(),setTimer=(fn,ms)=>setTimeout(fn,ms)}={}){
  const get=id=>doc?.getElementById?.(id);
  const make=(tag,cls)=>{const n=doc.createElement(tag);if(cls)n.className=cls;return n;};
  const restart=(node,name)=>{if(!node?.classList)return;node.classList.remove(name);void node.offsetWidth;node.classList.add(name);};
  const cls=(node,name,on)=>node?.classList?.toggle?.(name,on);
  const prop=(node,key,value)=>node?.style?.setProperty?.(key,value);
  let built=false,pipNodes=[],pipSize=-1,lastLevel=null,lastUltReady=false,lastPlanted=null,hitTimer=null;

  function build(){
    if(built||!doc?.createElement)return;
    built=true;
    const health=get('health-block');
    if(health&&!get('armor-track')){
      const armor=make('div','armor-track');armor.id='armor-track';armor.setAttribute('aria-hidden','true');
      const bar=make('i');bar.id='armor-bar';armor.append(bar);health.append(armor);
    }
    const weapon=get('weapon-block');
    if(weapon&&!get('mag-pips')){
      const pips=make('div','mag-pips');pips.id='mag-pips';pips.setAttribute('aria-hidden','true');
      const ammoRow=weapon.querySelector?.('.ammo-values');
      if(ammoRow)ammoRow.after(pips);else weapon.append(pips);
      const reload=make('div','reload-sweep');reload.id='reload-sweep';reload.setAttribute('aria-hidden','true');reload.append(make('span'),make('i'));
      reload.firstChild.textContent='RELOADING';pips.after(reload);
    }
    const hud=get('hud');
    if(hud&&!get('hud-low-hp')){const v=make('div','hud-low-hp');v.id='hud-low-hp';v.setAttribute('aria-hidden','true');hud.prepend(v);}
    const marker=get('hitmarker');
    if(marker&&!marker.querySelector?.('.hit-ring')){marker.append(make('b','hit-ring'));}
  }

  function renderPips(mag,ammo){
    const box=get('mag-pips');if(!box)return;
    const pips=magazinePips(mag,ammo);
    if(!pips){box.hidden=true;return;}
    box.hidden=false;
    if(pips.size!==pipSize){
      pipSize=pips.size;pipNodes=[];box.replaceChildren();
      prop(box,'--pips',String(pips.size));
      for(let i=0;i<pips.size;i++){const p=make('i');pipNodes.push(p);box.append(p);}
    }
    for(let i=0;i<pipNodes.length;i++)pipNodes[i].classList.toggle('spent',i>=pips.filled);
  }

  function update(state){
    build();
    const hud=get('hud');if(!hud)return;
    const level=state.alive===false?'down':combatHudLevel(state.hp);
    if(level!==lastLevel){if(hud.dataset)hud.dataset.hpLevel=level;lastLevel=level;}
    const armor=Math.max(0,Math.min(ARMOR_MAX,Number(state.armor)||0));
    prop(get('armor-bar'),'width',`${armor/ARMOR_MAX*100}%`);
    cls(get('health-block'),'has-armor',armor>0);
    renderPips(state.mag,state.ammo);
    cls(get('weapon-block'),'mag-empty',state.mag>0&&state.ammo<=0);
    const ultReady=(Number(state.ultPoints)||0)>=7;
    if(ultReady!==lastUltReady){cls(get('ability-x'),'ult-ready',ultReady);if(ultReady)restart(get('ability-x'),'ult-ready-burst');lastUltReady=ultReady;}
    const planted=!!state.planted&&state.uiMode==='match';
    if(planted!==lastPlanted){cls(hud,'bomber-planted',planted);lastPlanted=planted;}
  }

  // kind: 'hit' | 'kill'. count is the multi-kill number in this round (1-5).
  function hit(kind='hit',count=1){
    build();
    const marker=get('hitmarker');if(!marker?.classList)return;
    marker.classList.remove('hm-hit','hm-kill');void marker.offsetWidth;
    marker.classList.add(kind==='kill'?'hm-kill':'hm-hit');
    if(kind==='kill')prop(marker,'--kill-count',String(Math.max(1,Math.min(5,count|0))));
    if(hitTimer)clearTimeout(hitTimer);
    hitTimer=setTimer(()=>{marker.classList.remove('hm-hit','hm-kill');hitTimer=null;},kind==='kill'?520:260);
  }

  function weaponIcon(weaponId){
    const card=doc?.querySelector?.(`[data-buy="${weaponId}"] svg`);
    if(!card)return null;
    const icon=doc.createElementNS(SVG_NS,'svg');
    icon.setAttribute('viewBox',card.getAttribute('viewBox')||'0 0 200 70');icon.setAttribute('aria-hidden','true');icon.setAttribute('class','feed-weapon');
    for(const child of card.childNodes)icon.append(child.cloneNode(true));
    return icon;
  }

  function glyph(kind){
    const icon=doc.createElementNS(SVG_NS,'svg');
    icon.setAttribute('viewBox','0 0 36 30');icon.setAttribute('aria-hidden','true');icon.setAttribute('class','feed-glyph');
    const path=doc.createElementNS(SVG_NS,'path');
    path.setAttribute('d',kind==='knife'?'M4 26 24 6l6-2-2 6L8 30zM20 14l4 4':'m14 3-8 13h10l-5 11L31 11H19l5-8z');
    icon.append(path);return icon;
  }

  // Builds a structured kill-feed row. The row text stays "killer ⌁ victim"
  // so existing readers of the feed text still work.
  function feed(info){
    build();
    const box=get('killfeed');if(!box?.prepend||!doc?.createElement||!doc.createElementNS)return null;
    const row=make('div','feed-item');
    row.dataset.killer=info.killerAlly?'ally':'enemy';
    row.classList.toggle('feed-self',!!(info.killerSelf||info.victimSelf));
    row.classList.toggle('feed-self-kill',!!info.killerSelf);
    row.classList.toggle('feed-self-death',!!info.victimSelf);
    const killer=make('span',`feed-name ${info.killerAlly?'is-ally':'is-enemy'}`);killer.textContent=info.killer;
    const victim=make('span',`feed-name victim ${info.victimAlly?'is-ally':'is-enemy'}`);victim.textContent=info.victim;
    const how=make('span','feed-how');
    const icon=info.firearm&&info.weapon?weaponIcon(info.weapon):null;
    if(icon)how.append(icon);else how.append(glyph(info.weapon==='knife'?'knife':'skill'));
    const sep=make('span','feed-sep');sep.textContent=' ⌁ ';
    row.append(killer,how,sep,victim);
    box.prepend(row);
    while(box.children.length>FEED_LIMIT)box.lastElementChild.remove();
    setTimer(()=>{row.classList.add('feed-out');setTimer(()=>row.remove(),260);},FEED_LIFETIME_MS);
    return row;
  }

  return {update,hit,feed};
}
