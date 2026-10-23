// Local presentation only: host clocks, actor positions and match rules stay untouched.
export function createDeathView() {
  let pose=null,remaining=0;
  return {
    begin(position,rotation) {
      if(pose||![...position,...rotation].every(Number.isFinite)||position.length!==3||rotation.length!==3)return false;
      pose={position:[...position],rotation:[...rotation]};remaining=1.2;return true;
    },
    tick(dt) { if(Number.isFinite(dt)&&dt>0)remaining=Math.max(0,remaining-dt); },
    reset() { pose=null;remaining=0; },
    get holding() { return remaining>1e-8; },
    view() { return remaining>1e-8&&pose?{position:[...pose.position],rotation:[...pose.rotation]}:null; },
  };
}
