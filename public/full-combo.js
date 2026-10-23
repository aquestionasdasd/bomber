// Round-local, host-only credit. Five eliminations of one revived enemy do not
// count as defeating all five distinct opposing seats.
export function createFullComboTracker(){
 let round=null,members=new Map(),hits=new Map();
 function reset(){round=null;members.clear();hits.clear();}
 function begin(value,actors){
  reset();if(!Number.isSafeInteger(value)||value<1||!Array.isArray(actors)||actors.length!==10)return;
  for(const a of actors){if(typeof a?.id!=='string'||!['blue','red'].includes(a.team)||members.has(a.id)){reset();return;}members.set(a.id,a.team);}
  if([...members.values()].filter(t=>t==='blue').length!==5){reset();return;}round=value;
 }
 function record(value,victim,killer){
  if(round===null||value!==round||!killer||!victim||!members.has(killer.id)||!members.has(victim.id)||members.get(killer.id)!==killer.team||members.get(victim.id)!==victim.team||killer.team===victim.team)return;
  if(!hits.has(killer.id))hits.set(killer.id,new Set());hits.get(killer.id).add(victim.id);
 }
 function winner(value,team){if(value!==round)return null;for(const[id,targets]of hits)if(members.get(id)===team&&targets.size===5)return id;return null;}
 return{begin,record,winner,reset};
}

export function fullComboRecord(match,roster){
 const result=match?.lastRound,index=result?.fullCombo;
 if(match?.phase!=='post'||!(match.phaseTime>0)||result?.round!==match.round||!Number.isInteger(index)||index<0||index>9||!Array.isArray(roster))return null;
 const actor=roster[index];return actor&&actor.team===result.team&&['blue','red'].includes(actor.team)?actor:null;
}

export function renderRoundBanner(banner,{document:doc,match,roster,viewerTeam,team,reason}){
 if(!banner)return;
 const won=team===viewerTeam,combo=won?fullComboRecord(match,roster):null;
 const name=combo?String(combo.name||'PLAYER').slice(0,48):'';
 const signature=JSON.stringify([match?.round,team,reason,won,combo?.id,name]);
 if(banner.dataset.roundResult===signature)return;
 banner.dataset.roundResult=signature;banner.classList.toggle('defeat',!won);banner.classList.toggle('full-combo',!!combo);
 const title=doc.createElement('strong');title.className=combo?'full-combo-title':'';title.textContent=combo?'フルコンボ':won?'開米':'閉米';
 const detail=doc.createElement('small');const reasons={elimination:'相手チームを全滅',timeout:'設置前にラウンド時間終了',detonation:'ボンバー起爆',defuse:'ボンバーの電源オフ'};detail.textContent=combo?`${name} · 敵5人を全員撃破`:reasons[reason]||'';
 if(combo){const result=doc.createElement('span');result.className='full-combo-result';result.textContent='開米';banner.replaceChildren(title,result,detail);}else banner.replaceChildren(title,detail);
}
