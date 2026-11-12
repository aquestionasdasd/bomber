// Cosmetic feedback only. The caller supplies an already confirmed local kill.
export function createKillBanner(doc) {
  const el=doc?.getElementById?.('kill-banner');
  const label=doc?.getElementById?.('kill-banner-count');
  let at=-Infinity,round=null,kills=0;
  function hide(){at=-Infinity;if(el){el.hidden=true;el.style.opacity='0';}if(label)label.textContent='';}
  function reset(){hide();round=null;kills=0;}
  function note(now,currentRound,confirmedOrdinal=1){
    if(!Number.isFinite(now)||!Number.isSafeInteger(currentRound)||currentRound<1)return;
    if(currentRound!==round)kills=0;
    const ordinal=Number.isSafeInteger(confirmedOrdinal)&&confirmedOrdinal>=1&&confirmedOrdinal<=5?confirmedOrdinal:1;
    kills=Math.max(kills+1,ordinal);
    at=now;round=currentRound;
  }
  function render(now,{active=true,currentRound=round,reducedMotion=false}={}){
    if(currentRound!==round){reset();return;}
    const age=now-at;
    if(!active||!Number.isFinite(age)||age<0||age>=1.6){hide();return;}
    if(!el)return;
    const enter=Math.min(1,age/.13),settle=Math.min(1,Math.max(0,(age-.13)/.18));
    const scale=reducedMotion?1:age<.13?.35+.83*(1-(1-enter)**3):1+.18*(1-settle)**2;
    const lift=reducedMotion?0:age<.13?20*(1-enter):0;
    el.hidden=false;
    if(label)label.textContent=`${kills}キル目`;
    el.style.opacity=String(Math.min(1,age/.045,(1.6-age)/.3));
    el.style.transform=`translate(-50%,${lift.toFixed(2)}px) scale(${scale.toFixed(4)})`;
  }
  reset();return{note,render,hide,reset};
}
