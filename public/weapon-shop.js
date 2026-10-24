import { WEAPONS } from './rules.js';
import { weaponDescription } from './weapon-ballistics.js';

export function createArsenalShop(doc){
  const columns=doc.querySelector?.('.shop-columns');if(!columns)return;
  const groups=[['サイドアーム','SIDEARMS',['classic','ghost']],['SMG','SMGS',['spectre']],['ショットガン','SHOTGUNS',['pump','drum']],['ライフル','RIFLES',['vandal','phantom']],['マシンガン','MACHINE GUNS',['forge']],['スナイパー','SNIPER RIFLES',['scout','atlas']],['シールド','SHIELDS',['light','heavy']]];
  const cards=new Map([...columns.querySelectorAll('[data-buy]')].map(card=>[card.dataset.buy,card]));
  const abilities=columns.querySelector('.ability-shop');
  for(const [id,w] of Object.entries(WEAPONS).filter(([,w])=>w.arsenal)){
    const card=doc.createElement('button');card.type='button';card.className='buy-card arsenal-card';card.dataset.buy=id;
    const name=doc.createElement('span');name.className='buy-name';name.textContent=w.name;
    const sub=doc.createElement('small');sub.textContent=w.category;name.append(sub);
    const silhouette=doc.createElement('span');silhouette.className=`weapon-silhouette silhouette-${id}`;silhouette.setAttribute('aria-hidden','true');
    const price=doc.createElement('span');price.className='buy-price';price.textContent=`SC ${w.price.toLocaleString()}`;card.append(name,silhouette,price);cards.set(id,card);
  }
  const lanes=Array.from({length:5},()=>{const lane=doc.createElement('div');lane.className='shop-lane';return lane;});
  const placement=[0,1,1,2,2,3,4];
  groups.forEach(([title,en,ids],i)=>{
    const section=doc.createElement('section');section.className='shop-category';
    const heading=doc.createElement('h3');heading.textContent=title;const small=doc.createElement('small');small.textContent=en;heading.append(small);section.append(heading);
    for(const id of ids){const card=cards.get(id);if(!card)continue;const state=doc.createElement('span');state.className='buy-state';card.append(state);section.append(card);}
    lanes[placement[i]].append(section);
  });
  columns.replaceChildren(...lanes);
  if(abilities){abilities.classList.add('shop-abilities-row');columns.after(abilities);}
  const panel=doc.createElement('div');panel.id='weapon-details';panel.className='weapon-details';panel.setAttribute('role','tooltip');
  panel.textContent='武器にカーソルを合わせると性能を表示';(abilities||columns).after(panel);
  for(const card of columns.querySelectorAll('[data-buy]')){
    const id=card.dataset.buy;
    // A focusable wrapper keeps stats accessible even when funds disable purchase.
    const wrap=doc.createElement('div');wrap.className='weapon-info-target';wrap.tabIndex=0;
    const name=WEAPONS[id]?.name||(id==='light'?'ライトシールド':'ヘヴィーシールド');
    wrap.setAttribute('aria-label',`${name} の性能`);wrap.setAttribute('aria-describedby','weapon-details');
    const sell=doc.createElement('button');sell.type='button';sell.className='shop-sell';sell.dataset.sell=id;sell.textContent='売却';sell.hidden=true;sell.setAttribute('aria-label',`${name}を売却`);
    card.before(wrap);wrap.append(card,sell);card.title=weaponDescription(id);
    const show=()=>{panel.textContent=WEAPONS[id]?weaponDescription(id):`${name} / ${id==='light'?25:50}アーマー\n受けたダメージの一部を吸収します。\n右クリックで当ラウンドに購入した装備を売却できます。`;panel.dataset.weapon=id;};
    for(const event of ['pointerenter','focusin','touchstart'])wrap.addEventListener(event,show,{passive:true});
  }
}
