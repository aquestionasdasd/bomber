// Shared low-gravity lob. Existing event endpoints + flight encode the entire arc.
export const SKILL_THROW = Object.freeze({speed:12, gravity:4, lift:2, maxFlight:8, minFlight:1/240, maxPitch:Math.PI/2-.01});
export const NOPE_FLASH_THROW = Object.freeze({gravity:12, fuse:1});
export const throwGravity = type => type==='nope-flash'?NOPE_FLASH_THROW.gravity:SKILL_THROW.gravity;
export const throwMaxFlight = type => type==='nope-flash'?NOPE_FLASH_THROW.fuse:SKILL_THROW.maxFlight;
export const LOBBED_SKILLS = Object.freeze(['urchin-disarm','cap-lens','cap-cluster-heal','cap-cluster-damage','cap-bank-grenade','cap-magazine-grenade','duelist-comet','nope-bottle','nope-flash','mend-seeds','mend-pollen','echo-tag','echo-glint','veil-sensor','veil-root-seed','ember-solder','frost-stitch','frost-mist','nobi-bell','nobi-whisker','nobi-toolbox','nobi-collar']);
export const isLobbedSkill = type => LOBBED_SKILLS.includes(type);
export function throwDuration(from,to,type){
  const distance=Math.hypot(to.x-from.x,to.z-from.z),dy=to.y-from.y;
  // A targeted BOT throw uses the low arc to a known location, with the same
  // bounded launch speed and gravity as manual throws. No actor tracking.
  const speed=SKILL_THROW.speed,g=throwGravity(type),disc=speed**4-g*(g*distance**2+2*dy*speed**2);
  if(disc<0)return null;
  if(distance<1e-7){const t=Math.sqrt(Math.max(0,-2*dy/g));return Math.max(.5,t);}
  const tangent=(speed**2-Math.sqrt(disc))/(g*distance),t=distance*Math.sqrt(1+tangent*tangent)/speed;
  return Math.max(.08,t);
}
export function validThrowFlight(e){
  if(!isLobbedSkill(e?.type)||!Number.isFinite(e.flight)||e.flight<SKILL_THROW.minFlight||e.flight>throwMaxFlight(e.type))return false;
  const t=e.flight,vx=(e.x-e.fromX)/t,vz=(e.z-e.fromZ)/t,vy=(e.y-e.fromY)/t+throwGravity(e.type)*t/2;
  return [vx,vy,vz].every(Number.isFinite)&&Math.hypot(vx,vy,vz)<=SKILL_THROW.speed+SKILL_THROW.lift+1e-6;
}
export function throwSpec(type,spec,from,to){
  if(!isLobbedSkill(type))return spec;
  const flight=to.flight??throwDuration(from,to,type),e={type,...to,fromX:from.x,fromY:from.y,fromZ:from.z,flight};
  if(!validThrowFlight(e))return null;
  const delay=throwDelay(e,spec.flight,spec.delay);
  return {...spec,flight,delay};
}
export function throwPosition(e,now){
  const t=Math.max(0,Math.min(e.flight,now-e.startedAt)),u=t/e.flight;
  return {x:e.fromX+(e.x-e.fromX)*u,y:e.fromY+(e.y-e.fromY)*u+throwGravity(e.type)*t*(e.flight-t)/2,z:e.fromZ+(e.z-e.fromZ)*u};
}
export function throwDelay(e,baseFlight,baseDelay=baseFlight){return e.type==='nope-flash'?NOPE_FLASH_THROW.fuse:e.type==='nope-bottle'?Math.max(baseDelay,e.flight):e.flight+baseDelay-baseFlight;}
