// Display state only. No input, combat, inventory or network state is changed here.
export function createCompetitiveUI({document:doc=globalThis.document}={}){
  const get=id=>doc?.getElementById?.(id),text=(id,value)=>{const n=get(id);if(n&&n.textContent!==String(value))n.textContent=String(value);};
  let lastHealth=null,lastWeapon=null,lastRound=null,detailCharacter=null;
  const flash=(node,name)=>{if(!node)return;node.classList.remove(name);void node.offsetWidth;node.classList.add(name);};
  const button=get('skill-details-toggle'),details=get('skill-inspector');
  const menuVolume=get('menu-volume'),volume=get('volume');
  if(menuVolume&&volume){menuVolume.value=volume.value;menuVolume.addEventListener('input',()=>{volume.value=menuVolume.value;volume.dispatchEvent(new Event('input',{bubbles:true}));});volume.addEventListener('input',()=>{menuVolume.value=volume.value;});}
  doc?.querySelector?.('.menu-audio-settings')?.addEventListener('toggle',()=>{if(menuVolume&&volume)menuVolume.value=volume.value;});
  button?.addEventListener('click',event=>{event.stopPropagation();if(!details)return;details.hidden=!details.hidden;button.setAttribute('aria-expanded',String(!details.hidden));});
  get('skill-inspector-close')?.addEventListener('click',()=>{if(details)details.hidden=true;button?.setAttribute('aria-expanded','false');});
  function update(state){
    const hud=get('hud');if(!hud)return;
    hud.dataset.uiMode=state.uiMode||'match';hud.dataset.phase=state.phase;hud.dataset.alive=String(state.alive);
    const changedRound=lastRound!==state.round;
    if(!changedRound&&lastHealth!==null&&state.hp!==lastHealth)flash(get('health-block'),state.hp<lastHealth?'health-hit':'health-heal');
    if(lastWeapon!==state.weaponId){
      if(lastWeapon!==null)flash(get('weapon-block'),'weapon-changed');
      const icon=doc?.querySelector?.('.weapon-silhouette'),card=[...(doc?.querySelectorAll?.('[data-buy]')||[])].find(n=>n.dataset.buy===state.weaponId),source=card?.querySelector?.('svg');
      if(icon&&source){icon.setAttribute('viewBox',source.getAttribute('viewBox'));icon.replaceChildren(...[...source.childNodes].map(n=>n.cloneNode(true)));}
      if(icon)icon.style.visibility=source?'visible':'hidden';
    }
    if(changedRound){if(details)details.hidden=true;button?.setAttribute('aria-expanded','false');}
    lastHealth=state.hp;lastWeapon=state.weaponId;lastRound=state.round;
    get('health-block')?.classList.toggle('low-health',state.hp>0&&state.hp<35);
    get('weapon-block')?.classList.toggle('low-ammo',state.mag>0&&state.ammo<=Math.max(2,Math.ceil(state.mag*.2)));
    get('weapon-block')?.classList.toggle('is-reloading',!!state.reloading);
    text('ammo-capacity',state.mag>0?`/ ${state.mag}`:'');
    if(state.uiMode!=='objective'){text('ally-label',state.uiMode==='range'?'得点':'味方');text('enemy-label',state.uiMode==='range'?'ヘッド':'敵');}
    if(state.uiMode==='match'){
      text('round-label',`第${state.round}ラウンド${state.overtime?' · 延長':''}`);
      text('phase-label',state.phase==='buy'?'購入':state.phase==='post'?'ラウンド終了':'');
      text('objective-label',state.phase==='buy'?'装備を選択 · B':state.phase==='post'?'':state.planted?'':state.side==='attack'?'A / B に設置':'サイトを守る');
      text('spike-state',state.spikeStatus==='dropped'?'ボンバー落下':state.spikeStatus==='defused'?'解除完了':state.spikeStatus==='detonated'?'起爆':state.carrier?'ボンバー所持':'');
    }else if(state.uiMode==='range')text('round-label','射撃訓練');
    else if(state.uiMode==='practice'){text('round-label','マップ練習');text('phase-label','ルート確認');}
    hud.classList.toggle('timer-urgent',state.phase==='live'&&state.seconds<=10&&state.uiMode==='match');
    get('ability-x')?.style.setProperty('--charge',String(Math.min(1,Math.max(0,state.ultPoints/7))));
    if(get('ability-e-count')?.textContent==='READY')text('ability-e-count','1');
    for(const key of ['c','q','e','x'])get(`ability-${key}`)?.classList.toggle('selected',state.aimKey===key);
    if(state.character!==detailCharacter){
      detailCharacter=state.character;
      for(const skill of state.skills||[]){for(const prefix of ['inspect','pause-inspect']){text(`${prefix}-${skill.key}-name`,skill.name);text(`${prefix}-${skill.key}-description`,skill.description);}}
    }
    if(state.uiMode!=='match'||state.phase!=='live'||!state.alive)get('damage-direction')?.classList.remove('visible');
  }
  function damage({source,player}){
    if(!source||!player||!Number.isFinite(source.x)||!Number.isFinite(source.z))return;
    const node=get('damage-direction');if(!node)return;
    const bearing=Math.atan2(source.x-player.x,source.z-player.z);
    node.style.setProperty('--damage-angle',`${(-bearing-player.yaw+Math.PI)*180/Math.PI}deg`);
    flash(node,'visible');
  }
  return{update,damage};
}
