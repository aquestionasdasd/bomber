import { WEAPONS } from './rules.js';
import { weaponDescription } from './weapon-ballistics.js';

export function createArsenalShop(doc){
  const columns=doc.querySelector?.('.shop-columns');if(!columns)return;
  const section=doc.createElement('section');section.className='shop-category arsenal-category';
  const heading=doc.createElement('h3');heading.textContent='SPECIALISTS / 特殊武器';section.append(heading);
  for(const [id,w] of Object.entries(WEAPONS).filter(([,w])=>w.arsenal)){
    const card=doc.createElement('button');card.type='button';card.className='buy-card arsenal-card';card.dataset.buy=id;
    const name=doc.createElement('span');name.className='buy-name';name.textContent=w.name;
    const sub=doc.createElement('small');sub.textContent=w.category;name.append(sub);
    const price=doc.createElement('span');price.className='buy-price';price.textContent=`SC ${w.price.toLocaleString()} · ${w.mag} / ${w.reserve}発`;card.append(name,price);section.append(card);
  }
  columns.insertBefore(section,columns.querySelector('.armor-category'));
  const panel=doc.createElement('div');panel.id='weapon-details';panel.className='weapon-details';panel.setAttribute('role','tooltip');
  panel.textContent='武器にカーソルを合わせると性能を表示 · キーボードでも選べます · 練習は無料';columns.after(panel);
  for(const card of columns.querySelectorAll('[data-buy]')){
    const id=card.dataset.buy;if(!WEAPONS[id])continue;
    // A focusable wrapper keeps stats accessible even when funds disable purchase.
    const wrap=doc.createElement('div');wrap.className='weapon-info-target';wrap.tabIndex=0;
    wrap.setAttribute('aria-label',`${WEAPONS[id].name} の性能`);wrap.setAttribute('aria-describedby','weapon-details');
    card.before(wrap);wrap.append(card);card.title=weaponDescription(id);
    const show=()=>{panel.textContent=weaponDescription(id);panel.dataset.weapon=id;};
    for(const event of ['pointerenter','focusin','touchstart'])wrap.addEventListener(event,show,{passive:true});
  }
}
