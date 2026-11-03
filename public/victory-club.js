// Presentation follows the existing media clock; no audio, timers or game state.
export function createVictoryClub({element}={}) {
  let visible=false,disposed=false;
  function reset(){if(element)element.hidden=true;visible=false;}
  reset();
  function render({eligible=false,playing=false,time=0,reducedMotion=false}={}) {
    if(disposed||!element)return false;
    if(!eligible||!playing||!Number.isFinite(time)||time<0){reset();return false;}
    // Smooth colored light, with no white strobe or on/off luminance jumps.
    const clock=reducedMotion?0:time,pulse=reducedMotion?.35:(1+Math.cos(clock*Math.PI*2*160/60))/2;
    element.style.setProperty('--club-pulse',pulse.toFixed(4));
    element.style.setProperty('--club-sweep',`${(Math.sin(clock*.8)*20).toFixed(3)}deg`);
    element.style.setProperty('--club-counter',`${(-Math.sin(clock*.65+1)*24).toFixed(3)}deg`);
    element.style.setProperty('--club-hue',`${((clock*22)%360).toFixed(3)}deg`);
    element.dataset.reduced=String(reducedMotion);
    element.hidden=false;visible=true;return true;
  }
  function dispose(){reset();disposed=true;}
  return {render,reset,dispose,get active(){return visible;}};
}
