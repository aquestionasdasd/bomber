import { WEAPONS } from './rules.js';

export function weaponDamage(id,part='body',distance=0){
  const w=WEAPONS[id];if(!w)return 0;
  let damage=w[part]??w.body;
  if(w.falloff){const [near,far,midScale,farScale]=w.falloff;damage*=distance>far?farScale:distance>near?midScale:1;}
  else if(['phantom','spectre','ghost','classic'].includes(id)&&distance>15)damage*=distance>30?.8:.9;
  return damage;
}
// Fixed bounded pattern: one authoritative trigger consumes one cartridge. The
// centre plus rotated sunflower rings avoid client-supplied pellet directions.
export function shotPattern(id,{ads=false,moving=false,airborne=false,steadyAir=false,sequence=1}={}){
  const w=WEAPONS[id];if(!w)return [];
  const n=Math.min(12,w.pellets||1),base=ads?(w.adsSpread??w.spread):w.spread;
  // Skill flight centres single bullets on the visible aim. A shotgun keeps
  // its ordinary pellet cone, without movement/air/burst enlargement.
  const spread=steadyAir===true?(n===1?0:base):base+(airborne?.13:moving?.055:0)+(id==='forge'?Math.min(.025,Math.max(0,sequence-4)*.0015):0);
  const turn=(sequence*2.399963229728653)%(Math.PI*2);
  if(n===1)return [{x:Math.cos(turn)*spread*.5,y:Math.sin(turn)*spread*.5}];
  return Array.from({length:n},(_,i)=>{const radius=i===0?0:Math.sqrt(i/(n-1))*spread*.5,angle=turn+i*2.399963229728653;return {x:Math.cos(angle)*radius,y:Math.sin(angle)*radius};});
}
export function weaponDescription(id){
  const w=WEAPONS[id];if(!w)return '';
  const pellets=w.pellets?`1発につき${w.pellets}粒（ダメージは1粒あたり）`:'1発あたり';
  const falloff=w.falloff?` · ${w.falloff[0]}m超は50%、${w.falloff[1]}m超は22%` : ['phantom','spectre','ghost','classic'].includes(id)?' · 15m超90%、30m超80%':' · 距離による威力低下なし';
  return `${w.name} / ${w.category||({secondary:'サイドアーム',primary:id==='spectre'?'サブマシンガン':'ライフル'}[w.slot])} · SC ${w.price.toLocaleString()}\n頭 ${w.head} / 胴 ${w.body} / 脚 ${w.leg} · ${pellets}${falloff}\n装弾 ${w.mag}発 + 予備 ${w.reserve}発 · ${w.auto?'フルオート':'単発'} ${(1/w.interval).toFixed(1)}発/秒 · リロード ${w.reload}秒${w.scope?' · 右クリック長押しでスコープ':''}\n重装備の敵はHP100 + シールド50。移動・空中射撃は精度が低下します。`;
}
