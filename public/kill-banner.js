// Cosmetic feedback only. The caller supplies an already confirmed local kill.
export function createKillBanner(doc) {
  const el=doc?.getElementById?.('kill-banner');
  let at=-Infinity,round=null;
  function reset(){at=-Infinity;round=null;if(el){el.hidden=true;el.style.opacity='0';}}
  function note(now,currentRound){
    if(!Number.isFinite(now)||!Number.isSafeInteger(currentRound)||currentRound<1)return;
    at=now;round=currentRound;
  }
  function render(now,{active=true,currentRound=round,reducedMotion=false}={}){
    const age=now-at;
    if(!active||currentRound!==round||!Number.isFinite(age)||age<0||age>=1.6){reset();return;}
    if(!el)return;
    const enter=Math.min(1,age/.13),settle=Math.min(1,Math.max(0,(age-.13)/.18));
    const scale=reducedMotion?1:age<.13?.35+.83*(1-(1-enter)**3):1+.18*(1-settle)**2;
    const lift=reducedMotion?0:age<.13?20*(1-enter):0;
    el.hidden=false;
    el.style.opacity=String(Math.min(1,age/.045,(1.6-age)/.3));
    el.style.transform=`translate(-50%,${lift.toFixed(2)}px) scale(${scale.toFixed(4)})`;
  }
  reset();return{note,render,reset};
}
