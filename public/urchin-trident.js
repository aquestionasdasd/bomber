// X is a temporary shot modifier. Weapon data and C/Q/E remain immutable.
export const URCHIN_TRIDENT=Object.freeze({points:7,duration:13,fireRate:1.5,angle:7*Math.PI/180,sideDamage:.65,adsRecoil:.8,activation:.35,warning:3,focusSoundGap:.3,hitSoundGap:.09,traceLife:.09,splashLife:.24,maxTraces:512,maxSplashes:192,maxWeapons:10});
const hip=Object.freeze([Object.freeze({angle:0,scale:1}),Object.freeze({angle:-URCHIN_TRIDENT.angle,scale:URCHIN_TRIDENT.sideDamage}),Object.freeze({angle:URCHIN_TRIDENT.angle,scale:URCHIN_TRIDENT.sideDamage})]);
const focus=Object.freeze([hip[0]]);
export const tridentFocus=(spec,ads)=>spec?.mag>0&&spec.slot==='primary'&&ads===true;
export const tridentLanes=(spec,ads)=>!spec?.mag?[]:tridentFocus(spec,ads)?focus:hip;
